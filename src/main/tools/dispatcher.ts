// The single entry for every Live tool call: used by the Live IPC (live:toolCall) and the debug HTTP (POST /tool).
import { LiveToolNameSchema, ToolArgSchemas } from '../../shared/protocol'
import type { LiveToolName, ToolArgs, ToolResult, ToolResultMap } from '../../shared/protocol'
import type { Services } from '../../shared/contracts'
import type { ConfirmBroker } from '../confirm'
import type { ServiceContext } from '../context'

export type ToolSource = 'live' | 'debug'
export type Dispatch = (name: string, args: unknown, source?: ToolSource) => Promise<ToolResult>

const POINTER_IDS = ['point-ring', 'point-arrow', 'point-badge']

type Handlers = { [N in LiveToolName]: (args: ToolArgs<N>) => Promise<ToolResultMap[N]> }

export function createDispatcher(ctx: ServiceContext, s: Services, confirm: ConfirmBroker): Dispatch {
  const handlers: Handlers = {
    async point_at({ target, step }) {
      const shot = await s.capture.grab('ground')
      const res = await s.grounder.ground({ target, shot })
      s.overlay.clear(POINTER_IDS)
      if (!res.found || !res.box) {
        return { found: false, confidence: res.confidence, note: res.reason ?? "I can't see that on the screen." }
      }
      s.overlay.show([
        { id: 'point-ring', kind: 'ring', tone: 'guide', box: res.box, label: res.label ?? target, step },
        { id: 'point-arrow', kind: 'arrow', tone: 'guide', to: res.box },
        ...(step !== undefined ? [{ id: 'point-badge', kind: 'badge' as const, tone: 'guide' as const, at: { x: res.box.xmin, y: res.box.ymin }, n: step }] : []),
      ])
      return { found: true, confidence: res.confidence, note: res.label }
    },
    start_lesson: ({ goal }) => s.runner.start(goal),
    step_done: ({ note }) => s.runner.onStepDone(note),
    verify_step: ({ expected_outcome }) => s.runner.verifyStep(expected_outcome),
    async set_help_level({ level, reason }) {
      if (ctx.settings.get().helpLevelMode === 'locked') {
        return { applied: false, level: ctx.state.get().level, note: 'The learner locked the help level.' }
      }
      return s.runner.requestLevel(level, reason)
    },
    // AGENTS hook: spawn_agent
    spawn_agent: ({ kind, task, payload }) => s.agents.spawn(kind, task, payload),
    async ask_user_confirm({ question, options }) {
      return { choice: await confirm.ask(question, options) }
    },
    async update_profile({ note }) {
      await s.learner.addNote(note)
      return { ok: true }
    },
    async end_lesson({ summary, teachBackScore, confidence }) {
      await s.runner.end(summary, teachBackScore, confidence)
      return { ok: true }
    },
    // AGENTS hook: clear_annotations
    async clear_annotations() {
      s.overlay.clear()
      return { ok: true }
    },
  }

  return async (name, args, source = 'debug') => {
    const started = Date.now()
    const parsedName = LiveToolNameSchema.safeParse(name)
    if (!parsedName.success) return { error: `Unknown tool: ${name}` }
    const tool = parsedName.data

    // The screen is only readable while a session is active; the debug HTTP bypasses this for headless tests.
    const { phase } = ctx.state.get()
    if (source === 'live' && (phase === 'asleep' || phase === 'listening_for_name')) {
      return { error: 'No active session' }
    }

    const parsedArgs = ToolArgSchemas[tool].safeParse(args ?? {})
    if (!parsedArgs.success) return { error: `Bad arguments for ${tool}: ${parsedArgs.error.issues.map((i) => i.message).join('; ')}` }

    let ok = true
    try {
      const run = handlers[tool] as (a: unknown) => Promise<ToolResult>
      return await run(parsedArgs.data)
    } catch (err) {
      ok = false
      const message = err instanceof Error ? err.message : String(err)
      ctx.log('dispatcher', `${tool} failed:`, message)
      return { error: message }
    } finally {
      ctx.bus.emit('tool:called', { name: tool, args: parsedArgs.data, ms: Date.now() - started, ok })
    }
  }
}
