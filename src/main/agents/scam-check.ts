import { NormBoxSchema } from '../../shared/protocol'
import type { Annotation, AnnotationTone, GroundResult, NormBox, ScamReport, Shot } from '../../shared/protocol'
import { AgentUserError, logAgentError } from './errors'
import { defineAgent } from './ports'
import type { AgentOutcome, ScamPorts } from './ports'
import { cleanText, findInjectionPhrases, inlineSafe, INJECTION_WHY, plainSentences, splitSentences } from './text-safety'

// Covers extract (~4s) + the multi-agent analysis (p95 ~35-40s) + grounding with retries (~8s).
export const SCAM_TIMEOUT_MS = 60_000
export const HIGHLIGHT_TTL_MS = 25_000
export const MAX_FLAGS = 5
const MAX_MESSAGE_CHARS = 6000
const FRESH_SHOT_MS = 6000
const GROUND_CONCURRENCY = 5
const BUBBLE_MAX_CHARS = 230
const MIN_WORDS_TO_SPLIT = 5

export const HUMAN_CHECK_LINE =
  'Before you do anything, ring the number on the back of your bank card, or ask Age UK or someone you trust.'

const VERDICT_LINE: Record<ScamReport['verdict'], string> = {
  likely_scam: 'This looks like a scam.',
  suspicious: 'This message has some warning signs.',
  cannot_tell: 'I cannot tell for sure about this one.',
  likely_genuine: 'I could not spot clear warning signs, but I cannot promise anything about it.',
}

const DEFAULT_ADVICE: Record<ScamReport['verdict'], string> = {
  likely_scam: 'Please do not click any links or share any details.',
  suspicious: 'Please do not click any links or share any details yet.',
  cannot_tell: 'Please do not click links or share details until you have checked.',
  likely_genuine: 'Still, do not click links or share details until you have checked.',
}

const REFUSAL_SCAM_OFF =
  'Scam Shield is switched off, so I have not looked at that message. You can turn it on in settings and ask me again.'

type Flag = ScamReport['redFlags'][number]

function toneFor(verdict: ScamReport['verdict']): AnnotationTone {
  return verdict === 'likely_scam' ? 'danger' : 'warn'
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

/**
 * The message is DATA. Anything in it that tries to instruct an AI is reported as a red flag
 * (and never followed), and it can only make the verdict more cautious.
 */
export function applyInjectionGuard(report: ScamReport, messageText: string): ScamReport {
  const phrases = findInjectionPhrases(messageText)
  if (phrases.length === 0) return report
  const known = new Set(report.redFlags.map((f) => f.phrase.toLowerCase()))
  const added: Flag[] = phrases.filter((p) => !known.has(p.toLowerCase())).map((phrase) => ({ phrase, why: INJECTION_WHY }))
  return {
    ...report,
    verdict: report.verdict === 'likely_scam' ? 'likely_scam' : 'suspicious',
    redFlags: [...added.slice(0, 2), ...report.redFlags],
  }
}

export function sanitizeReport(report: ScamReport): ScamReport {
  const redFlags = report.redFlags
    .map((f) => ({ phrase: inlineSafe(f.phrase, 120), why: inlineSafe(f.why, 140) }))
    .filter((f) => f.phrase.length >= 3)
    .slice(0, MAX_FLAGS)
  const advice = plainSentences(report.advice.join(' '), 3, 140)
  return {
    verdict: report.verdict,
    confidence: clamp(Number.isFinite(report.confidence) ? report.confidence : 0, 0, 1),
    redFlags,
    advice: advice.length > 0 ? advice : [DEFAULT_ADVICE[report.verdict]],
    // Fixed on purpose: the human-check line must always be present and never reassuring.
    humanHelp: HUMAN_CHECK_LINE,
    models: report.models.map((m) => inlineSafe(m, 60)).slice(0, 4),
    latencyMs: report.latencyMs,
  }
}

/** At most three short plain sentences: verdict, one piece of advice, the human check. Never "safe". */
export function buildSummary(report: ScamReport): string {
  return `${VERDICT_LINE[report.verdict]} ${report.advice[0] ?? DEFAULT_ADVICE[report.verdict]} ${HUMAN_CHECK_LINE}`
}

function validBox(result: GroundResult): NormBox | undefined {
  if (!result.found || !result.box) return undefined
  const parsed = NormBoxSchema.safeParse(result.box)
  if (!parsed.success) return undefined
  const { xmin, ymin, xmax, ymax } = parsed.data
  return xmax - xmin >= 4 && ymax - ymin >= 3 ? parsed.data : undefined
}

/** Whole sentences only, so the bubble never ends mid-thought. */
function fitSentences(sentences: string[], maxChars: number): string {
  const kept: string[] = []
  for (const sentence of sentences) {
    const next = [...kept, sentence].join(' ')
    if (next.length > maxChars && kept.length > 0) break
    kept.push(sentence)
  }
  return kept.join(' ')
}

export function buildHighlights(
  agentId: string,
  report: ScamReport,
  located: NormBox[][],
  ttlMs = HIGHLIGHT_TTL_MS,
): Annotation[] {
  const tone = toneFor(report.verdict)
  const annotations: Annotation[] = []
  located.forEach((boxes, i) => {
    const flag = report.redFlags[i]
    const [first, ...rest] = boxes
    if (!first || !flag) return
    annotations.push({ id: `${agentId}-flag-${i}`, kind: 'highlightText', tone, ttlMs, boxes: [first, ...rest], note: inlineSafe(flag.why, 90) })
  })
  const lowest = located.flat().reduce<NormBox | undefined>((acc, b) => (!acc || b.ymax > acc.ymax ? b : acc), undefined)
  const at = lowest
    ? { x: clamp((lowest.xmin + lowest.xmax) / 2, 160, 840), y: clamp(lowest.ymax + 30, 70, 930) }
    : { x: 500, y: 140 }
  const text = fitSentences([VERDICT_LINE[report.verdict], ...report.advice.slice(0, 2).flatMap((a) => splitSentences(a))], BUBBLE_MAX_CHARS)
  annotations.push({ id: `${agentId}-advice`, kind: 'bubble', tone, ttlMs, at, text })
  return annotations
}

function createLimiter(max: number): <T>(work: () => Promise<T>) => Promise<T> {
  let active = 0
  const waiting: (() => void)[] = []
  return async (work) => {
    while (active >= max) await new Promise<void>((resolve) => waiting.push(resolve))
    active += 1
    try {
      return await work()
    } finally {
      active -= 1
      waiting.shift()?.()
    }
  }
}

type Located = NormBox | 'missing' | 'error'

async function groundOnce(ports: ScamPorts, phrase: string, shot: Shot, limit: ReturnType<typeof createLimiter>): Promise<Located> {
  try {
    const result = await limit(() => ports.ground(`the text "${phrase.replace(/"/g, "'")}"`, shot))
    return validBox(result) ?? 'missing'
  } catch (err) {
    logAgentError('scam_check.ground', err)
    return 'error'
  }
}

/**
 * One grounding call per phrase. A phrase that wraps onto a second line is reported as "not present" by the grounder,
 * so a long miss is retried as two halves; highlightText takes several boxes for exactly this case.
 */
async function locatePhrase(ports: ScamPorts, phrase: string, shot: Shot, limit: ReturnType<typeof createLimiter>): Promise<NormBox[]> {
  const whole = await groundOnce(ports, phrase, shot, limit)
  if (typeof whole === 'object') return [whole]
  const words = phrase.split(/\s+/).filter(Boolean)
  if (whole === 'error' || words.length < MIN_WORDS_TO_SPLIT) return []
  const mid = Math.ceil(words.length / 2)
  const halves = await Promise.all([words.slice(0, mid), words.slice(mid)].map((part) => groundOnce(ports, part.join(' '), shot, limit)))
  return halves.filter((h): h is NormBox => typeof h === 'object')
}

async function readMessage(
  ports: ScamPorts,
  payload: { text?: string; url?: string },
): Promise<{ text: string; shot?: Shot }> {
  const given = payload.text ? cleanText(payload.text, MAX_MESSAGE_CHARS) : ''
  if (given) return { text: given }
  ports.progress('Reading the message…')
  const shot = await ports.grabScreen()
  const text = await ports.extractMessage(shot).then((t) => cleanText(t, MAX_MESSAGE_CHARS), () => '')
  return { text, shot }
}

export const scamCheckAgent = defineAgent<ScamPorts>({
  kind: 'scam_check',
  timeoutMs: SCAM_TIMEOUT_MS,
  title: () => 'Checking this message',

  createPorts(deps, scope) {
    // The analyst's parallel specialists announce themselves in a burst, so stages accumulate into a short checklist.
    const stages: string[] = []
    const reportStage = (message: string): void => {
      if (!stages.includes(message)) stages.push(message)
      scope.progress(stages.slice(-3).join(' · '))
    }
    const guard = <T>(work: Promise<T>): Promise<T> =>
      work.then((value) => {
        scope.signal.throwIfAborted()
        return value
      })
    return {
      settings: () => deps.settings(),
      grabScreen: () => guard(deps.capture.grab('ground')),
      extractMessage: (shot) => guard(deps.model.extractMessage({ shot, signal: scope.signal })),
      analyze: (req) => guard(deps.scam.analyze(req, { onProgress: reportStage })),
      progress: reportStage,
      // precise = flash-first grounding, required for the scam path (phrases sit inside dense text).
      ground: (target, shot) => guard(deps.grounder.ground({ target, shot, precise: true })),
      showHighlights: (annotations, ttlMs) => scope.highlights.show(annotations, ttlMs),
      now: scope.now,
    }
  },

  async run({ agentId, payload, ports }): Promise<AgentOutcome> {
    if (!ports.settings().scamShield) {
      return { summary: REFUSAL_SCAM_OFF, tell: `${REFUSAL_SCAM_OFF} Tell the user this plainly.` }
    }

    const message = await readMessage(ports, payload)
    if (!message.text && !message.shot) {
      throw new AgentUserError('I could not find a message to check. Please open it on your screen and ask me again.')
    }
    const url = payload.url
    ports.progress('Checking the message…')
    const raw = await ports.analyze(
      message.text ? { text: message.text, ...(message.shot ? { shot: message.shot } : {}), ...(url ? { url } : {}) } : { shot: message.shot, ...(url ? { url } : {}) },
    )
    const report = sanitizeReport(applyInjectionGuard(raw, message.text))

    // The analysis can take seconds; the user may have scrolled, so ground on a fresh shot.
    const groundShot =
      message.shot && ports.now() - message.shot.takenAt < FRESH_SHOT_MS ? message.shot : await ports.grabScreen()
    ports.progress('Marking the worrying parts…')
    const limit = createLimiter(GROUND_CONCURRENCY)
    const located = await Promise.all(report.redFlags.slice(0, MAX_FLAGS).map((flag) => locatePhrase(ports, flag.phrase, groundShot, limit)))
    ports.showHighlights(buildHighlights(agentId, report, located), HIGHLIGHT_TTL_MS)

    const summary = buildSummary(report)
    const marked = located.filter((boxes) => boxes.length > 0).length
    const onScreen = marked === 0 ? '' : ` ${marked} worrying ${marked === 1 ? 'part is' : 'parts are'} marked on the screen.`
    return {
      summary,
      result: { kind: 'scam_check', report },
      tell: `${summary}${onScreen} Say it in two short sentences, in your own words, without reassuring them about the message.`,
    }
  },
})
