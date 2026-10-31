// Real-time voice+vision session with gemini-3.8-live.
// Ported from google-gemini/gemini-live-api-examples (frontend/geminilive.js, script.js, mediaUtils.js) and extended with:
// context-window compression + session resumption (transparent GoAway/drop recovery), instant playback flush on
// `interrupted`, per-call async tool dispatch with cancellation (the example's receive loop awaits tools), gated injection,
// idle/goodbye endings, change-gated 1 fps frames and phase detection. See THIRD_PARTY_NOTICES.md.
import { LiveConnection } from './connection'
import { FrameLoop, type FrameSample } from './frames'
import { isBlockingTool, LIVE_TOOLS, schedulingFor } from './tools'
import type {
  AudioInput,
  AudioOutput,
  LiveEndReason,
  LiveEventName,
  LiveHost,
  LivePhase,
  LiveSessionEvents,
  ToolCallRequest,
  ToolHandler,
} from './types'
import { msg, type FunctionCall, type FunctionDeclaration, type FunctionResponse, type LiveServerEvent, type VadConfig } from './wire'
import { buildSetup } from './wire'

export interface LiveSessionOptions {
  host: LiveHost
  audioIn: AudioInput
  audioOut: AudioOutput
  model: string
  toolHandler?: ToolHandler
  tools?: FunctionDeclaration[]
  // null disables screen frames.
  frames?: { grab: () => Promise<FrameSample | null> } | null
  idleTimeoutMs?: number
  vad?: VadConfig
  // realtime = realtimeInput.text (docs: preferred for live input); clientContent = a user turn with turnComplete.
  injectVia?: 'realtime' | 'clientContent'
  // half = stop uploading mic audio while the model speaks (no barge-in; the fix for speakers without echo cancellation).
  duplex?: 'full' | 'half'
  // Matches a final user transcript that means "end the session" (checked after the model's farewell finishes).
  goodbye?: RegExp
  maxInjectWaitMs?: number
  WebSocketImpl?: typeof WebSocket
  log?: (...a: unknown[]) => void
}

export interface StartOptions {
  voiceName: string
  // Spoken-turn opener, sent as text once connected (e.g. "[SESSION] Greet the learner in one short sentence.").
  opening?: string
  // base64 PCM16 chunks captured by the wake spotter just before handover, sent first so "Hey X, <question>" is not clipped.
  preRoll?: string[]
  // Called once the socket is open; returns the spotter's pre-roll. When it yields audio, the chunks buffered by our own
  // mic during connect are dropped (the spotter kept capturing the same period, so sending both would repeat the tail).
  takePreRoll?: () => string[] | null
}

type Handler<K extends LiveEventName> = (payload: LiveSessionEvents[K]) => void

const DEFAULT_GOODBYE = /\b(good ?bye|bye bye|bye for now|stop listening|see you (later|soon))\b/i
const NOISE_FLOOR = 0.015
const TOOL_TIMEOUT_MS = 45_000
const CONFIRM_TIMEOUT_MS = 5 * 60_000
const MAX_PENDING_AUDIO = 100 // ~3 s of 32 ms chunks buffered while the socket is still opening

export class LiveSession {
  phase: LivePhase = 'idle'
  private conn: LiveConnection | null = null
  private frameLoop: FrameLoop | null = null
  private handlers = new Map<LiveEventName, Set<Handler<LiveEventName>>>()
  private connected = false
  private reconnecting = false
  private stopped = false
  private micMuted = false
  private pendingAudio: string[] = []
  private inflight = new Map<string, AbortController>()
  private cancelled = new Set<string>()
  private generating = false
  private userTurnOpen = false
  private userTurnTimer: ReturnType<typeof setTimeout> | null = null
  private inBuf = ''
  private outBuf = ''
  private lastVoiceAt = 0
  private inLevel = 0
  private triggerAt: { at: number; kind: 'voice' | 'text' } | null = null
  private ttfaReported = true
  private lastActivityAt = Date.now()
  private idleTimer: ReturnType<typeof setInterval> | null = null
  private idleTimeoutMs: number
  private injectQueue: string[] = []
  private injectTimer: ReturnType<typeof setTimeout> | null = null
  private goodbyePending = false
  private goodbyeTimer: ReturnType<typeof setTimeout> | null = null
  private offIdle: (() => void) | null = null
  private opts: LiveSessionOptions
  private startOpts: StartOptions | null = null
  private readonly log: (...a: unknown[]) => void

  constructor(opts: LiveSessionOptions) {
    this.opts = opts
    this.idleTimeoutMs = opts.idleTimeoutMs ?? 20_000
    this.log = opts.log ?? (() => undefined)
  }

  // ---------- public API ----------
  on<K extends LiveEventName>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event)
    if (!set) this.handlers.set(event, (set = new Set()))
    const h = handler as unknown as Handler<LiveEventName>
    set.add(h)
    return () => set.delete(h)
  }

  async start(start: StartOptions): Promise<void> {
    if (this.phase !== 'idle') throw new Error('LiveSession already started')
    this.startOpts = start
    this.setPhase('connecting')
    const t0 = Date.now()
    try {
      const [systemInstruction] = await Promise.all([this.opts.host.systemInstruction(), this.opts.audioOut.init()])
      this.offIdle = this.opts.audioOut.onIdle(() => this.onPlaybackIdle())
      this.conn = new LiveConnection({
        getAuth: () => this.opts.host.getAuth(),
        buildSetup: (handle) =>
          buildSetup({
            model: this.opts.model,
            voiceName: start.voiceName,
            systemInstruction,
            tools: this.opts.tools ?? LIVE_TOOLS,
            resumptionHandle: handle,
            vad: this.opts.vad,
          }),
        onEvent: (e) => this.onServerEvent(e),
        onReconnecting: () => {
          this.reconnecting = true
          this.emitState()
        },
        onReconnected: ({ resumed }) => {
          this.reconnecting = false
          this.emit('resumption', { handle: this.conn?.resumptionHandle ?? null, reconnected: true, resumed })
          this.emitState()
        },
        onClosed: (info) => {
          if (this.stopped) return
          if (!info.expected) this.emit('error', { message: info.reason || `Live connection closed (${info.code})`, fatal: true })
          void this.stop(info.expected ? 'stop' : 'error')
        },
        WebSocketImpl: this.opts.WebSocketImpl,
        log: this.log,
      })
      // Mic starts while the socket is opening; chunks are buffered so the learner's first words are not lost.
      const micReady = this.opts.audioIn.start((b64, level) => this.onMicChunk(b64, level))
      const connected = this.conn.connect()
      await Promise.all([micReady, connected])
      this.connected = true
      this.emit('metrics', { kind: 'setup', ms: Date.now() - t0 })
      this.lastActivityAt = Date.now()
      this.setPhase('live')
      const taken = start.takePreRoll?.() ?? null
      const pre = taken && taken.length ? taken : (start.preRoll ?? [])
      for (const c of pre) this.conn.send(msg.audio(c))
      if (!(taken && taken.length)) for (const c of this.pendingAudio) this.conn.send(msg.audio(c))
      this.pendingAudio = []
      if (start.opening) this.sendInject(start.opening)
      this.startFrames()
      this.idleTimer = setInterval(() => this.checkIdle(), 1000)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit('error', { message, fatal: true })
      await this.stop('error')
      throw err
    }
  }

  async stop(reason: LiveEndReason = 'stop'): Promise<void> {
    if (this.stopped) return
    this.stopped = true
    this.connected = false
    this.reconnecting = false
    for (const t of [this.userTurnTimer, this.injectTimer, this.goodbyeTimer]) if (t) clearTimeout(t)
    if (this.idleTimer) clearInterval(this.idleTimer)
    this.idleTimer = null
    this.frameLoop?.stop()
    this.offIdle?.()
    for (const ac of this.inflight.values()) ac.abort()
    this.inflight.clear()
    this.finalizeTranscripts()
    try {
      this.opts.audioIn.stop()
    } catch (err) {
      this.log('audioIn.stop', err)
    }
    this.opts.audioOut.flush()
    this.opts.audioOut.close()
    this.conn?.close()
    this.phase = 'ended'
    this.emitState()
    this.emit('ended', { reason })
  }

  setMicMuted(muted: boolean): void {
    if (muted === this.micMuted) return
    this.micMuted = muted
    // The server keeps cached audio until told the stream paused (docs: send audioStreamEnd when the mic is paused).
    if (muted) this.conn?.send(msg.audioStreamEnd())
  }

  get isMicMuted(): boolean {
    return this.micMuted
  }

  // interrupt=false waits for the model to be idle (up to maxInjectWaitMs); interrupt=true cuts in now. silent=true adds
  // context without asking the model to respond (clientContent with turnComplete=false).
  injectText(text: string, o: { interrupt?: boolean; silent?: boolean } = {}): boolean {
    if (!this.connected || this.stopped || !text.trim()) return false
    if (o.silent) return this.conn?.send(msg.clientContent(text, false)) ?? false
    if (o.interrupt || this.isIdleForInject()) {
      this.sendInject(text)
      return true
    }
    this.injectQueue.push(text)
    this.injectTimer ??= setTimeout(() => this.flushInjectQueue(true), this.opts.maxInjectWaitMs ?? 8000)
    return true
  }

  setIdleTimeout(ms: number): void {
    this.idleTimeoutMs = ms
    this.lastActivityAt = Date.now()
  }

  // 0..1 smoothed model output level for the orb.
  getOutputLevel(): number {
    return this.opts.audioOut.level()
  }

  // 0..1 smoothed microphone level for the listening light (0 while muted).
  getInputLevel(): number {
    this.inLevel *= 0.98
    return this.micMuted ? 0 : this.inLevel
  }

  get resumptionHandle(): string | null {
    return this.conn?.resumptionHandle ?? null
  }

  // ---------- server events ----------
  private onServerEvent(e: LiveServerEvent): void {
    switch (e.type) {
      case 'audio':
        this.onModelAudio(e.base64)
        break
      case 'inputTranscription':
        if (e.text) {
          this.inBuf += e.text
          this.markUserTurn()
          this.emit('transcript', { role: 'user', text: this.inBuf, final: false })
        }
        if (e.finished) this.finalizeInput()
        break
      case 'interimInputTranscription':
        this.markUserTurn()
        break
      case 'outputTranscription':
        // A model reply started: the user's utterance is complete.
        this.finalizeInput()
        if (e.text) {
          this.outBuf += e.text
          this.emit('transcript', { role: 'assistant', text: this.outBuf, final: false })
        }
        if (e.finished) this.finalizeOutput()
        this.userTurnOpen = false
        this.recomputePhase()
        break
      case 'text':
        // AUDIO-modality sessions should not send text parts; show it rather than lose it.
        this.outBuf += e.text
        this.emit('transcript', { role: 'assistant', text: this.outBuf, final: false })
        break
      case 'interrupted':
        this.opts.audioOut.flush()
        this.generating = false
        this.userTurnOpen = false
        this.finalizeOutput()
        this.recomputePhase()
        break
      case 'voiceActivity':
        if (e.activity === 'start') {
          this.markUserTurn()
          // Barge-in: stop talking the instant the server hears the learner, ahead of its `interrupted` message.
          if (this.generating || this.opts.audioOut.isPlaying()) this.opts.audioOut.flush()
        }
        break
      case 'generationComplete':
        this.generating = false
        this.recomputePhase()
        break
      case 'turnComplete':
        this.generating = false
        this.userTurnOpen = false
        this.finalizeInput()
        this.finalizeOutput()
        this.recomputePhase()
        this.onTurnEnded()
        break
      case 'toolCall':
        this.lastActivityAt = Date.now()
        for (const call of e.calls) this.dispatchTool(call)
        this.recomputePhase()
        break
      case 'toolCallCancellation':
        for (const id of e.ids) {
          this.cancelled.add(id)
          this.inflight.get(id)?.abort()
        }
        break
      case 'resumptionUpdate':
        if (e.resumable) this.emit('resumption', { handle: e.handle, reconnected: false, resumed: false })
        break
      case 'usage':
        if (e.totalTokens !== null) this.emit('metrics', { kind: 'usage', totalTokens: e.totalTokens })
        break
      case 'goAway':
      case 'waitingForInput':
      case 'setupComplete':
        break
    }
  }

  private onModelAudio(b64: string): void {
    this.lastActivityAt = Date.now()
    if (!this.generating) {
      this.generating = true
      if (!this.ttfaReported && this.triggerAt) {
        this.ttfaReported = true
        this.emit('metrics', { kind: 'ttfa', ms: Date.now() - this.triggerAt.at, trigger: this.triggerAt.kind })
      }
    }
    this.userTurnOpen = false
    this.opts.audioOut.play(b64)
    this.recomputePhase()
  }

  private onPlaybackIdle(): void {
    this.recomputePhase()
    this.onTurnEnded()
  }

  // Called whenever the model might have just become idle.
  private onTurnEnded(): void {
    if (this.stopped) return
    if (!this.generating && !this.opts.audioOut.isPlaying()) {
      if (this.goodbyePending) {
        void this.stop('goodbye')
        return
      }
      this.flushInjectQueue(false)
    }
  }

  // ---------- tools ----------
  private dispatchTool(call: FunctionCall): void {
    const ac = new AbortController()
    this.inflight.set(call.id, ac)
    const req: ToolCallRequest = { id: call.id, name: call.name, args: call.args }
    this.emit('toolCall', req)
    const t0 = Date.now()
    // Own task per call: never awaited inside the receive path (the Google example blocks its receive loop here).
    void (async () => {
      let result: unknown
      let error: string | undefined
      try {
        if (!this.opts.toolHandler) throw new Error('no tool handler registered')
        const limit = isBlockingTool(call.name) ? CONFIRM_TIMEOUT_MS : TOOL_TIMEOUT_MS
        result = await withTimeout(this.opts.toolHandler(req, ac.signal), limit, ac.signal)
      } catch (err) {
        error = err instanceof Error ? err.message : String(err)
        result = { error }
      }
      this.inflight.delete(call.id)
      const wasCancelled = this.cancelled.delete(call.id)
      this.emit('toolDone', { id: call.id, name: call.name, ms: Date.now() - t0, error, cancelled: wasCancelled })
      this.recomputePhase()
      // The server discarded cancelled calls; answering them would be an error. Also nothing to send after stop.
      if (wasCancelled || this.stopped) return
      this.sendToolResponse(call, result)
    })()
  }

  private sendToolResponse(call: FunctionCall, result: unknown): void {
    const response = toResponseObject(result)
    const fr: FunctionResponse = { id: call.id, name: call.name, response }
    const scheduling = schedulingFor(call.name, result)
    if (scheduling) fr.scheduling = scheduling
    this.lastActivityAt = Date.now()
    this.conn?.send(msg.toolResponse([fr]))
  }

  // ---------- audio / frames ----------
  private onMicChunk(b64: string, level: number): void {
    if (this.stopped || this.micMuted) return
    this.inLevel = Math.max(Math.min(1, level * 4), this.inLevel * 0.85)
    if (level > NOISE_FLOOR) {
      this.lastVoiceAt = Date.now()
      this.lastActivityAt = this.lastVoiceAt
      this.triggerAt = { at: this.lastVoiceAt, kind: 'voice' }
      this.ttfaReported = false
    }
    if (!this.connected || this.reconnecting) {
      if (!this.connected) {
        this.pendingAudio.push(b64)
        if (this.pendingAudio.length > MAX_PENDING_AUDIO) this.pendingAudio.shift()
      }
      return
    }
    if (this.opts.duplex === 'half' && (this.generating || this.opts.audioOut.isPlaying())) return
    this.conn?.send(msg.audio(b64))
  }

  private startFrames(): void {
    const frames = this.opts.frames
    if (!frames) return
    this.frameLoop = new FrameLoop({
      grab: frames.grab,
      send: (jpeg) => {
        if (this.connected && !this.reconnecting) this.conn?.send(msg.video(jpeg))
      },
      onError: (err) => this.log('frame error', err),
    })
    this.frameLoop.start()
  }

  // ---------- injection ----------
  private isIdleForInject(): boolean {
    return !this.generating && !this.opts.audioOut.isPlaying() && !this.userTurnOpen
  }

  private flushInjectQueue(force: boolean): void {
    if (!this.injectQueue.length || !this.connected) return
    if (!force && !this.isIdleForInject()) return
    if (this.injectTimer) clearTimeout(this.injectTimer)
    this.injectTimer = null
    const text = this.injectQueue.join('\n')
    this.injectQueue = []
    this.sendInject(text)
  }

  private sendInject(text: string): void {
    this.lastActivityAt = Date.now()
    this.triggerAt = { at: Date.now(), kind: 'text' }
    this.ttfaReported = false
    this.conn?.send(this.opts.injectVia === 'clientContent' ? msg.clientContent(text, true) : msg.text(text))
  }

  // ---------- transcripts / phase ----------
  private markUserTurn(): void {
    this.userTurnOpen = true
    this.lastActivityAt = Date.now()
    if (this.userTurnTimer) clearTimeout(this.userTurnTimer)
    // The model may choose to stay silent (proactive audio); do not sit in "thinking" forever.
    this.userTurnTimer = setTimeout(() => {
      this.userTurnOpen = false
      this.recomputePhase()
    }, 8000)
    this.recomputePhase()
  }

  private finalizeInput(): void {
    if (!this.inBuf) return
    const text = this.inBuf
    this.inBuf = ''
    this.emit('transcript', { role: 'user', text, final: true })
    if ((this.opts.goodbye ?? DEFAULT_GOODBYE).test(text)) {
      this.goodbyePending = true
      // If the model never replies, still end.
      this.goodbyeTimer ??= setTimeout(() => void this.stop('goodbye'), 8000)
    }
  }

  private finalizeOutput(): void {
    if (!this.outBuf) return
    const text = this.outBuf
    this.outBuf = ''
    this.emit('transcript', { role: 'assistant', text, final: true })
  }

  private finalizeTranscripts(): void {
    this.finalizeInput()
    this.finalizeOutput()
  }

  private recomputePhase(): void {
    if (this.stopped || this.phase === 'connecting' || this.phase === 'idle' || this.phase === 'error') return
    const next: LivePhase =
      this.generating || this.opts.audioOut.isPlaying()
        ? 'speaking'
        : this.userTurnOpen || this.inflight.size > 0
          ? 'thinking'
          : 'live'
    this.setPhase(next)
  }

  private setPhase(p: LivePhase): void {
    if (p === this.phase) return
    this.phase = p
    this.emitState()
  }

  private emitState(): void {
    this.emit('state', { phase: this.phase, connected: this.connected, reconnecting: this.reconnecting })
  }

  private checkIdle(): void {
    if (this.stopped || this.idleTimeoutMs <= 0 || this.phase !== 'live' || this.micMuted) return
    if (this.inflight.size > 0 || this.injectQueue.length) return
    if (Date.now() - this.lastActivityAt >= this.idleTimeoutMs) void this.stop('idle')
  }

  private emit<K extends LiveEventName>(event: K, payload: LiveSessionEvents[K]): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const h of set) {
      try {
        h(payload)
      } catch (err) {
        this.log(`handler for ${event} threw`, err)
      }
    }
  }
}

function toResponseObject(result: unknown): Record<string, unknown> {
  if (typeof result === 'object' && result !== null && !Array.isArray(result)) return result as Record<string, unknown>
  return { result: result ?? null }
}

function withTimeout<T>(p: Promise<T>, ms: number, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`tool timed out after ${ms} ms`)), ms)
    const onAbort = () => reject(new Error('cancelled'))
    signal.addEventListener('abort', onAbort, { once: true })
    p.then(
      (v) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', onAbort)
        reject(e)
      },
    )
  })
}
