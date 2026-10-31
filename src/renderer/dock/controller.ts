// Dock-side wiring: owns the Live session lifecycle and the single-owner microphone arbitration with the wake spotter.
//   session:start (wake/hotkey/button) -> pause spotter -> LiveSession (persona voice + teaching system instruction)
//   Live -> main: live:transcript (captions), live:status (phase), live:toolCall (tools), session:ended (idle/goodbye/stop/error)
//   main -> Live: live:inject (stage directions), session:stop
// Not UI: DESIGN owns the rest of src/renderer/dock.
import { MODELS } from '../../shared/models'
import { PERSONAS, PERSONA_LIST } from '../../shared/personas'
import type { PersonaConfig } from '../../shared/personas'
import type { CompanionState, LiveStatus, SessionEndReason, SessionRequest } from '../../shared/protocol'
import { AudioPlayer, LiveSession, MicCapture, pcm16ToBase64Chunks } from '../live'
import type { LiveAuth, LivePhase } from '../live'
import { createWakeSpotter } from '../wake'
import type { WakeSpotter } from '../wake'

const IDLE_MS = 20_000
// During a lesson the learner is busy on their own screen, so silence is expected.
const LESSON_IDLE_MS = 120_000
// Used while personas carry voiceName 'TBD' (set by the voice audition). Both verified accepted by gemini-3.8-live.
const FALLBACK_VOICE = { male: 'Charon', female: 'Sulafat' } as const
const OPENING_BY_BUTTON = '[RUNNER] The learner opened this session with a button press, not by speaking. Greet them in one short sentence and ask what they would like help with.'

class MockLiveError extends Error {}

export interface LiveHandle {
  // 0..1 smoothed levels for the orb / listening light; 0 when no session.
  outputLevel(): number
  inputLevel(): number
  active(): boolean
}

let handle: LiveHandle = { outputLevel: () => 0, inputLevel: () => 0, active: () => false }
// DESIGN polls this (rAF) to animate the orb; stable reference for the lifetime of the dock.
export const liveHandle: LiveHandle = {
  outputLevel: () => handle.outputLevel(),
  inputLevel: () => handle.inputLevel(),
  active: () => handle.active(),
}

export function resolveVoice(p: PersonaConfig): string {
  return p.voiceName && p.voiceName !== 'TBD' ? p.voiceName : FALLBACK_VOICE[p.gender]
}

function mapPhase(p: LivePhase): LiveStatus['phase'] | null {
  switch (p) {
    case 'connecting':
    case 'live':
    case 'thinking':
    case 'speaking':
    case 'error':
      return p
    default:
      return null
  }
}

export interface ControllerOptions {
  // Tests/dev: skip the wake spotter (hotkey and button paths never touch it anyway).
  wake?: boolean
}

export function startController(opts: ControllerOptions = {}): () => void {
  const api = window.alongside
  let session: LiveSession | null = null
  let mockActive = false
  let current: CompanionState | null = null
  let spotter: WakeSpotter | null = null
  let beginSeq = 0
  const cleanups: Array<() => void> = []
  // Sessions whose end must not be reported to main (replaced by a newer one, which main is already setting up).
  const silenced = new WeakSet<LiveSession>()

  const log = (...a: unknown[]) => console.debug('[live]', ...a)

  // ---------- state mirror ----------
  const applyState = (next: CompanionState): void => {
    current = next
    session?.setMicMuted(next.micMuted)
    session?.setIdleTimeout(next.skill ? LESSON_IDLE_MS : IDLE_MS)
    spotter?.setSettings({ wakeEnabled: next.settings.wakeEnabled, pushToTalkOnly: next.settings.pushToTalkOnly, micMuted: next.micMuted })
  }
  void api.getState().then(applyState).catch((err: unknown) => log('getState failed', err))
  cleanups.push(api.onState(applyState))

  // ---------- wake spotter (mic owner while no Live session) ----------
  const wakeSettings = (): { wakeEnabled: boolean; pushToTalkOnly: boolean; micMuted: boolean } | undefined => {
    const c = current as CompanionState | null
    return c ? { wakeEnabled: c.settings.wakeEnabled, pushToTalkOnly: c.settings.pushToTalkOnly, micMuted: c.micMuted } : undefined
  }
  if (opts.wake !== false) {
    try {
      spotter = createWakeSpotter({
        personas: PERSONA_LIST,
        getToken: () => api.wake.getToken(),
        settings: wakeSettings(),
        onWake: (e) => api.wakeDetected({ personaId: e.personaId, source: 'wake' }),
        onStatus: (s) => {
          if (session || mockActive) return
          const phase = current?.phase
          if (phase === 'connecting' || phase === 'live' || phase === 'thinking' || phase === 'speaking') return
          void api.patchState({
            phase: s.listening ? 'listening_for_name' : s.state === 'unavailable' ? 'asleep' : (phase ?? 'asleep'),
            lastError: s.state === 'unavailable' ? s.detail : undefined,
          })
        },
      })
      void spotter.start().catch((err: unknown) => log('wake spotter failed to start', err))
      cleanups.push(() => spotter?.dispose())
    } catch (err) {
      log('wake spotter unavailable', err)
    }
  }

  // ---------- Live session ----------
  async function begin(req: SessionRequest): Promise<void> {
    const seq = ++beginSeq
    if (session) await endSession('replaced', true)
    mockActive = false
    spotter?.pause('live')
    const persona = PERSONAS[req.personaId]
    let firstToken: LiveAuth | null
    try {
      const t = await api.live.getToken(req.personaId)
      if (t.token === 'mock') throw new MockLiveError('Live voice needs a real GEMINI_API_KEY (mock mode)')
      firstToken = { kind: 'token', value: t.token }
    } catch (err) {
      spotter?.resume('live')
      if (err instanceof MockLiveError) {
        // Mock mode (no key): keep the loop observable without a voice; the debug HTTP / dock buttons still drive tools.
        mockActive = true
        handle = { outputLevel: () => 0, inputLevel: () => 0, active: () => true }
        api.live.status({ connected: true, phase: 'live' })
        api.live.transcript({ role: 'assistant', text: 'Voice is off in mock mode. Add GEMINI_API_KEY to use the real voice.', final: true })
        log('mock mode: no Live voice')
      } else {
        const message = err instanceof Error ? err.message : String(err)
        void api.patchState({ lastError: friendlyError(message) })
        api.sessionEnded('error')
      }
      return
    }
    if (seq !== beginSeq) return

    const s = new LiveSession({
      host: {
        getAuth: () => {
          // Reconnects and GoAway handovers mint a fresh single-use token.
          if (firstToken) {
            const t = firstToken
            firstToken = null
            return Promise.resolve(t)
          }
          return api.live.getToken(req.personaId).then((t): LiveAuth => ({ kind: 'token', value: t.token }))
        },
        systemInstruction: () => api.live.systemInstruction(req.personaId),
      },
      audioIn: new MicCapture(),
      audioOut: new AudioPlayer(),
      model: MODELS.live,
      toolHandler: (call) => api.live.toolCall({ id: call.id, name: call.name, args: call.args }),
      frames: { grab: () => api.live.liveFrame() },
      idleTimeoutMs: current?.skill ? LESSON_IDLE_MS : IDLE_MS,
      duplex: safeLocalStorage('alongside.duplex') === 'half' ? 'half' : 'full',
      log: (...a) => log(...a),
    })
    session = s
    handle = { outputLevel: () => s.getOutputLevel(), inputLevel: () => s.getInputLevel(), active: () => true }
    s.setMicMuted(current?.micMuted ?? false)
    s.on('state', (st) => {
      if (session !== s) return
      const phase = st.reconnecting ? 'connecting' : mapPhase(st.phase)
      if (phase) api.live.status({ connected: st.connected, phase })
    })
    s.on('transcript', (t) => {
      if (session === s) api.live.transcript(t)
    })
    s.on('error', (e) => {
      log('error', e.message)
      void api.patchState({ lastError: friendlyError(e.message) })
    })
    s.on('resumption', (r) => r.reconnected && log('reconnected', r.resumed ? '(resumed)' : '(fresh session)'))
    s.on('ended', ({ reason }) => {
      if (session === s) {
        session = null
        handle = { outputLevel: () => 0, inputLevel: () => 0, active: () => false }
      }
      spotter?.resume('live')
      if (!silenced.has(s)) api.sessionEnded(reason)
    })

    try {
      await s.start({
        voiceName: resolveVoice(persona),
        opening: req.source === 'wake' ? undefined : OPENING_BY_BUTTON,
        takePreRoll: () => {
          const pcm = spotter?.takePreroll() ?? null
          return pcm && pcm.length ? pcm16ToBase64Chunks(pcm) : null
        },
      })
      if (seq !== beginSeq) {
        silenced.add(s)
        await s.stop('replaced')
      }
    } catch (err) {
      log('start failed', err instanceof Error ? err.message : err)
    }
  }

  async function endSession(reason: SessionEndReason, silent: boolean): Promise<void> {
    if (mockActive) {
      mockActive = false
      handle = { outputLevel: () => 0, inputLevel: () => 0, active: () => false }
      spotter?.resume('live')
      if (!silent) api.sessionEnded(reason)
      return
    }
    const s = session
    if (!s) return
    if (silent) silenced.add(s)
    await s.stop(reason)
  }

  cleanups.push(api.onSessionStart((req) => void begin(req)))
  cleanups.push(api.onSessionStop((reason) => void endSession(reason, reason === 'replaced')))
  cleanups.push(
    api.live.onInject(({ text, interrupt }) => {
      if (!session) return
      session.injectText(text, { interrupt: interrupt === true })
    }),
  )

  return () => {
    for (const c of cleanups) c()
    void session?.stop('stop')
  }
}

function safeLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

// Plain words for the dock; the raw text stays in the console.
function friendlyError(raw: string): string {
  if (/microphone|getUserMedia|NotAllowed|Permission/i.test(raw)) return 'I cannot hear you: the microphone is blocked. Allow it in System Settings, then try again.'
  if (/token|auth|API key|403|401/i.test(raw)) return 'I could not connect: the API key was refused.'
  if (/timed out|network|closed|lost|connection/i.test(raw)) return 'I lost the connection. Check the internet and say my name again.'
  return `Something went wrong: ${raw.slice(0, 120)}`
}
