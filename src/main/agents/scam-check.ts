import { NormBoxSchema } from '../../shared/protocol'
import type { Annotation, AnnotationTone, GroundResult, NormBox, ScamReport, Shot } from '../../shared/protocol'
import { AgentUserError } from './errors'
import { defineAgent } from './ports'
import type { AgentOutcome, ScamPorts } from './ports'
import { cleanText, findInjectionPhrases, inlineSafe, INJECTION_WHY, plainSentences } from './text-safety'

export const SCAM_TIMEOUT_MS = 45_000
export const HIGHLIGHT_TTL_MS = 25_000
export const MAX_FLAGS = 5
const MAX_MESSAGE_CHARS = 6000
const FRESH_SHOT_MS = 6000

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

export function buildHighlights(
  agentId: string,
  report: ScamReport,
  located: (NormBox | undefined)[],
  ttlMs = HIGHLIGHT_TTL_MS,
): Annotation[] {
  const tone = toneFor(report.verdict)
  const annotations: Annotation[] = []
  located.forEach((box, i) => {
    const flag = report.redFlags[i]
    if (!box || !flag) return
    annotations.push({ id: `${agentId}-flag-${i}`, kind: 'highlightText', tone, ttlMs, boxes: [box], note: inlineSafe(flag.why, 90) })
  })
  const boxes = located.filter((b): b is NormBox => b !== undefined)
  const lowest = boxes.reduce<NormBox | undefined>((acc, b) => (!acc || b.ymax > acc.ymax ? b : acc), undefined)
  const at = lowest
    ? { x: clamp((lowest.xmin + lowest.xmax) / 2, 160, 840), y: clamp(lowest.ymax + 30, 70, 930) }
    : { x: 500, y: 140 }
  const bubbleText = inlineSafe(`${VERDICT_LINE[report.verdict]} ${report.advice.join(' ')}`, 220)
  annotations.push({ id: `${agentId}-advice`, kind: 'bubble', tone, ttlMs, at, text: bubbleText })
  return annotations
}

async function readMessage(
  ports: ScamPorts,
  payload: { text?: string; url?: string },
): Promise<{ text: string; shot?: Shot }> {
  const given = payload.text ? cleanText(payload.text, MAX_MESSAGE_CHARS) : ''
  if (given) return { text: given }
  const shot = await ports.grabScreen()
  const text = await ports.extractMessage(shot).then((t) => cleanText(t, MAX_MESSAGE_CHARS), () => '')
  return { text, shot }
}

export const scamCheckAgent = defineAgent<ScamPorts>({
  kind: 'scam_check',
  timeoutMs: SCAM_TIMEOUT_MS,
  title: () => 'Checking this message',

  createPorts(deps, scope) {
    const guard = <T>(work: Promise<T>): Promise<T> =>
      work.then((value) => {
        scope.signal.throwIfAborted()
        return value
      })
    return {
      settings: () => deps.settings(),
      grabScreen: () => guard(deps.capture.grab('ground')),
      extractMessage: (shot) => guard(deps.model.extractMessage({ shot, signal: scope.signal })),
      analyze: (req) => guard(deps.scam.analyze(req)),
      ground: (target, shot) => guard(deps.grounder.ground({ target, shot })),
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
    const raw = await ports.analyze(
      message.text ? { text: message.text, ...(message.shot ? { shot: message.shot } : {}), ...(url ? { url } : {}) } : { shot: message.shot, ...(url ? { url } : {}) },
    )
    const report = sanitizeReport(applyInjectionGuard(raw, message.text))

    // The analysis can take seconds; the user may have scrolled, so ground on a fresh shot.
    const groundShot =
      message.shot && ports.now() - message.shot.takenAt < FRESH_SHOT_MS ? message.shot : await ports.grabScreen()
    const results = await Promise.all(
      report.redFlags.slice(0, MAX_FLAGS).map((flag) =>
        ports.ground(`the text "${flag.phrase.replace(/"/g, "'")}"`, groundShot).then(
          (r) => r,
          () => undefined,
        ),
      ),
    )
    const located = results.map((r) => (r ? validBox(r) : undefined))
    ports.showHighlights(buildHighlights(agentId, report, located), HIGHLIGHT_TTL_MS)

    const summary = buildSummary(report)
    const marked = located.filter(Boolean).length
    return {
      summary,
      result: { kind: 'scam_check', report },
      tell:
        `${summary} ${marked} worrying ${marked === 1 ? 'part is' : 'parts are'} marked on the screen. ` +
        'Say this in your own words in two short sentences. Do not say anything that sounds reassuring about the message.',
    }
  },
})
