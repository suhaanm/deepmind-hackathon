// Grounder: "where is <natural-language target> on this screenshot?".
// Config chosen by the A/B + tuning runs (docs/GROUNDING_AB.md):
//   preset 'fast' (default): gemini-3.5-flash-lite box_2d, thinking low  (p50 ~0.9s). If it says not-found, is unsure
//     (confidence < 0.7) or errors, escalate to gemini-3.8-flash box_2d (slower, more accurate on dense real UIs).
//   preset 'accurate': gemini-3.8-flash box_2d only (p50 ~4s).
// If every box call fails or returns an implausible box, fall back to a computer_use dry-run (a click point only;
// nothing is ever executed). Never fabricates: unsure => found:false with a reason the assistant can say aloud.
import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { Grounder } from '../../shared/contracts'
import type { GroundResult, Shot } from '../../shared/protocol'
import {
  callModel,
  clamp01,
  functionCallsOf,
  GeminiError,
  imageInput,
  jsonFormat,
  parseModelJson,
  type GeminiDeps,
} from './client'
import { boxAroundPoint, boxCenter, boxProblem, fromComputerUsePoint, fromGeminiBox } from './grounding-utils'
import { INJECTION_GUARD } from './prompts'

export type GroundPreset = 'fast' | 'accurate'

export interface GroundConfig {
  preset?: GroundPreset
  resolution?: 'medium' | 'high' | 'ultra_high'
  timeoutMs?: number // hard budget for one ground() call as seen by the caller
  cacheTtlMs?: number
  lingerMs?: number // a call that outlives timeoutMs keeps running this long, to warm the cache
  escalateBelow?: number // fast preset: escalate when confidence is under this
}

const BOX_RESPONSE = z.object({
  found: z.boolean(),
  box_2d: z.array(z.number()).optional(),
  label: z.string().optional(),
  reason: z.string().optional(),
  confidence: z.number().optional(),
})

const BOX_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean', description: 'true only if the described element is clearly visible on screen' },
    label: { type: 'string', description: 'The exact visible text or appearance of the element you matched; empty if not found' },
    box_2d: {
      type: 'array',
      items: { type: 'integer' },
      description: 'Tight bounding box [ymin, xmin, ymax, xmax], integers normalised 0-1000. [0,0,0,0] when found is false.',
    },
    reason: { type: 'string', description: 'Short reason, especially when found is false' },
    confidence: { type: 'number', description: '0 to 1: how sure you are this is exactly the described element' },
  },
  required: ['found', 'label', 'box_2d', 'reason', 'confidence'],
}

export const normaliseTarget = (t: string): string => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const hashShot = (s: Shot): string => createHash('sha1').update(s.jpegBase64).digest('hex')

function groundPrompt(target: string, hint?: string): string {
  return [
    "You are the eyes of an accessibility assistant for people with low digital confidence. The image is a full screenshot of the user's screen.",
    `Find this one element: "${target}".`,
    hint ? `Extra context from the lesson (trusted): ${hint}` : '',
    'Rules: return found=true ONLY if you can see that exact element. A similar element with a different label is NOT a match. If it is not on this screen, return found=false and box_2d [0,0,0,0]. Never guess.',
    'First say in "label" what you actually see there, then give the tight bounding box [ymin, xmin, ymax, xmax], integers normalised to 0-1000 over the whole screenshot.',
    INJECTION_GUARD,
  ]
    .filter(Boolean)
    .join('\n')
}

function cuPrompt(target: string): string {
  return `DRY RUN for an accessibility overlay: nothing will actually be clicked. Look at the screenshot and decide where you would click to select: "${target}".\nIf that exact element is not visible on this screen, do not call any tool and reply with exactly NOT_FOUND.\n${INJECTION_GUARD}`
}

export interface GrounderWithPrefetch extends Grounder {
  // Start grounding in the background (30 s cache) so a later ground({target}) without a shot is instant or joins the call.
  prefetch(req: { target: string; shot?: Shot }): void
  // The screen changed: drop cached/prefetched results.
  invalidate(): void
}

interface Interim {
  current: GroundResult | null
}

export function createGrounder(deps: GeminiDeps, config: GroundConfig = {}): GrounderWithPrefetch {
  const preset: GroundPreset = config.preset ?? 'fast'
  const primaryModel = preset === 'fast' ? deps.models.lite : deps.models.flash
  const escalateModel = preset === 'fast' ? deps.models.flash : null
  const resolution = config.resolution ?? 'high'
  const timeoutMs = config.timeoutMs ?? 6000
  const ttl = config.cacheTtlMs ?? 30_000
  const linger = config.lingerMs ?? 25_000
  const escalateBelow = config.escalateBelow ?? 0.7

  const cache = new Map<string, { at: number; result: GroundResult }>() // key: shotHash|target
  const inflight = new Map<string, { promise: Promise<GroundResult>; interim: Interim }>()
  // Latest prefetch per target: lets ground({target}) with no shot reuse it (the runner prefetches on screen change).
  const prefetched = new Map<string, { key: string; at: number }>()

  const notFound = (reason: string, started: number, model = primaryModel): GroundResult => ({
    found: false,
    confidence: 0,
    reason,
    latencyMs: Date.now() - started,
    model,
  })

  async function boxCall(model: string, shot: Shot, target: string, hint: string | undefined, started: number): Promise<GroundResult> {
    const call = await callModel(deps, {
      name: `grounder.box.${model}`,
      model,
      timeoutMs: linger,
      retries: 0,
      params: {
        input: [{ type: 'text', text: groundPrompt(target, hint) }, imageInput(shot, resolution)],
        generation_config: { thinking_level: 'low' },
        response_format: jsonFormat(BOX_SCHEMA),
      },
    })
    const parsed = parseModelJson(call.text, BOX_RESPONSE)
    const confidence = clamp01(parsed.confidence ?? 0.8)
    if (!parsed.found) {
      return { found: false, confidence, reason: parsed.reason || "I can't see that on the screen.", label: parsed.label || undefined, latencyMs: Date.now() - started, model }
    }
    const box = fromGeminiBox(parsed.box_2d)
    if (!box) throw new GeminiError('parse', 'found=true but box_2d is missing or malformed')
    const problem = boxProblem(box)
    if (problem) throw new GeminiError('parse', problem === 'oversize' ? 'box covers more than half the screen' : 'box is degenerate')
    return { found: true, box, point: boxCenter(box), confidence, label: parsed.label || undefined, reason: parsed.reason || undefined, latencyMs: Date.now() - started, model }
  }

  async function cuFallback(shot: Shot, target: string, budgetMs: number, started: number): Promise<GroundResult | null> {
    if (budgetMs < 2500) return null
    try {
      const call = await callModel(deps, {
        name: 'grounder.computer_use',
        model: deps.models.flash,
        timeoutMs: budgetMs,
        retries: 0,
        params: {
          input: [{ type: 'text', text: cuPrompt(target) }, imageInput(shot, 'ultra_high')],
          generation_config: { thinking_level: 'low' },
          tools: [{ type: 'computer_use', environment: 'browser' }],
        },
      })
      const click = functionCallsOf(call.interaction).find((c) => ['click', 'double_click', 'triple_click', 'right_click', 'move'].includes(c.name))
      if (!click) return null
      const point = fromComputerUsePoint(Number(click.args.x), Number(click.args.y))
      if (!point) return null
      return {
        found: true,
        point,
        box: boxAroundPoint(point),
        confidence: 0.5, // a click point only; the box is a nominal square around it
        label: typeof click.args.intent === 'string' ? click.args.intent : undefined,
        reason: 'approximate location (fallback)',
        latencyMs: Date.now() - started,
        model: `${deps.models.flash}+computer_use`,
      }
    } catch {
      return null
    }
  }

  async function cascade(shot: Shot, target: string, hint: string | undefined, started: number, interim: Interim): Promise<GroundResult> {
    let first: GroundResult | null = null
    let firstError: unknown = null
    try {
      first = await boxCall(primaryModel, shot, target, hint, started)
    } catch (e) {
      if (e instanceof GeminiError && e.code === 'timeout') return notFound('timeout', started)
      firstError = e
    }
    if (first && first.found && first.confidence >= escalateBelow) return first
    if (first) interim.current = first // an honest not-found / low-confidence answer the caller can use if escalation is too slow

    if (escalateModel) {
      try {
        const second = await boxCall(escalateModel, shot, target, hint, started)
        // Escalation is the more accurate model: its answer wins, except it never turns a decisive find into nothing.
        if (second.found || !first?.found) return second
        return first
      } catch (e) {
        deps.log('grounder', `escalation failed: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    if (first) return first
    deps.log('grounder', `box call failed (${firstError instanceof Error ? firstError.message : String(firstError)}); trying computer_use fallback`)
    const remaining = Math.max(0, timeoutMs - (Date.now() - started))
    const fb = await cuFallback(shot, target, remaining, started)
    return fb ?? notFound('I could not pin down where that is on the screen.', started)
  }

  function start(shot: Shot, target: string, hint: string | undefined) {
    const key = `${hashShot(shot)}|${normaliseTarget(target)}`
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < ttl) return { key, promise: Promise.resolve({ ...hit.result, latencyMs: 0 }), interim: { current: null } as Interim }
    const existing = inflight.get(key)
    if (existing) return { key, ...existing }
    const started = Date.now()
    const interim: Interim = { current: null }
    const promise = cascade(shot, target, hint, started, interim)
      .then((r) => {
        // Cache decisive answers only; a timeout or "could not pin down" must be retried fresh.
        if (r.found || r.confidence > 0) cache.set(key, { at: Date.now(), result: r })
        return r
      })
      .finally(() => inflight.delete(key))
    inflight.set(key, { promise, interim })
    return { key, promise, interim }
  }

  const withDeadline = (p: Promise<GroundResult>, interim: Interim, started: number): Promise<GroundResult> =>
    Promise.race([
      p,
      new Promise<GroundResult>((resolve) =>
        setTimeout(() => resolve(interim.current ? { ...interim.current, latencyMs: Date.now() - started } : notFound('timeout', started)), timeoutMs),
      ),
    ])

  const shotFor = async (shot?: Shot): Promise<Shot | null> => shot ?? (deps.capture ? deps.capture.grab('ground') : null)

  return {
    async ground({ target, shot, hint }) {
      const started = Date.now()
      const norm = normaliseTarget(target)
      if (!norm) return notFound('Nothing to look for.', started)
      if (!shot) {
        const pre = prefetched.get(norm)
        if (pre && Date.now() - pre.at < ttl) {
          const hit = cache.get(pre.key)
          if (hit && Date.now() - hit.at < ttl) return { ...hit.result, latencyMs: Date.now() - started }
          const flying = inflight.get(pre.key)
          if (flying) return withDeadline(flying.promise, flying.interim, started)
        }
      }
      const s = await shotFor(shot)
      if (!s) return notFound('No screenshot available.', started)
      const { promise, interim } = start(s, target, hint)
      return withDeadline(promise, interim, started)
    },

    prefetch({ target, shot }) {
      const norm = normaliseTarget(target)
      if (!norm) return
      void (async () => {
        try {
          const s = await shotFor(shot)
          if (!s) return
          const { key } = start(s, target, undefined)
          prefetched.set(norm, { key, at: Date.now() })
        } catch (e) {
          deps.log('grounder', `prefetch skipped: ${e instanceof Error ? e.message : String(e)}`)
        }
      })()
    },

    invalidate() {
      cache.clear()
      prefetched.clear()
    },
  }
}
