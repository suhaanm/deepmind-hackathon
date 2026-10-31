// WebSocket transport for the Live API with transparent session resumption.
// Adapted from google-gemini/gemini-live-api-examples (frontend/geminilive.js); the example has no reconnect logic.
//
// Contract: connect() resolves after setupComplete. Afterwards the connection survives GoAway (make-before-break:
// a second socket is opened with the latest resumption handle and swapped in while the old one still serves audio)
// and unexpected drops (retry with backoff, resuming when a handle exists). Callers only ever see events.
import { decodeFrame, liveUrl, parseServerMessage, type LiveAuth, type LiveServerEvent } from './wire'

export type ConnState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface CloseInfo {
  code: number
  reason: string
  // True when we asked for the close; false = the connection was lost and could not be recovered.
  expected: boolean
}

export interface ConnectionOptions {
  getAuth: () => Promise<LiveAuth>
  // Full setup message for the given resumption handle (null = brand-new session).
  buildSetup: (handle: string | null) => object
  onEvent: (e: LiveServerEvent) => void
  onReconnecting?: (why: 'goaway' | 'dropped') => void
  onReconnected?: (info: { resumed: boolean }) => void
  onClosed: (info: CloseInfo) => void
  WebSocketImpl?: typeof WebSocket
  maxReconnectAttempts?: number
  setupTimeoutMs?: number
  log?: (...a: unknown[]) => void
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export class LiveConnection {
  state: ConnState = 'idle'
  private sock: WebSocket | null = null
  private handle: string | null = null
  private resumable = false
  private expectedClose = false
  private superseded = new WeakSet<WebSocket>()
  private handingOver = false
  private readonly WS: typeof WebSocket
  private readonly log: (...a: unknown[]) => void

  constructor(private readonly opts: ConnectionOptions) {
    this.WS = opts.WebSocketImpl ?? WebSocket
    this.log = opts.log ?? (() => undefined)
  }

  get resumptionHandle(): string | null {
    return this.handle
  }

  async connect(): Promise<void> {
    this.state = 'connecting'
    try {
      this.sock = await this.openSocket(null)
    } catch (err) {
      this.state = 'closed'
      throw err
    }
    this.state = 'open'
  }

  send(message: object): boolean {
    const s = this.sock
    if (!s || s.readyState !== 1 || this.state !== 'open') return false
    s.send(JSON.stringify(message))
    return true
  }

  close(code = 1000, reason = 'client closed'): void {
    this.expectedClose = true
    this.state = 'closed'
    const s = this.sock
    this.sock = null
    try {
      s?.close(code, reason)
    } catch {
      /* already closed */
    }
  }

  // Opens a socket, sends setup and resolves once the server answers setupComplete.
  private openSocket(handle: string | null): Promise<WebSocket> {
    return new Promise<WebSocket>((resolve, reject) => {
      this.opts
        .getAuth()
        .then((auth) => {
          const ws = new this.WS(liveUrl(auth))
          ws.binaryType = 'arraybuffer'
          let ready = false
          let settled = false
          const fail = (why: string) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            try {
              ws.close()
            } catch {
              /* ignore */
            }
            reject(new Error(why))
          }
          const timer = setTimeout(() => fail('Live setup timed out'), this.opts.setupTimeoutMs ?? 10_000)

          ws.addEventListener('open', () => {
            ws.send(JSON.stringify(this.opts.buildSetup(handle)))
          })
          ws.addEventListener('message', (ev: MessageEvent) => {
            const decoded = decodeFrame(ev.data)
            const events = parseServerMessage(decoded)
            if (!ready) {
              if (events.some((e) => e.type === 'setupComplete')) {
                ready = true
                settled = true
                clearTimeout(timer)
                resolve(ws)
              }
              // Anything else before setupComplete is ignored (nothing legitimate precedes it).
              return
            }
            if (ws !== this.sock) return // old socket after handover, or a stray one
            for (const e of events) this.route(e)
          })
          ws.addEventListener('error', () => {
            if (!ready) fail('Live connection error')
          })
          ws.addEventListener('close', (ev: CloseEvent) => {
            if (!ready) {
              fail(`Live connection closed before setup (${ev.code}${ev.reason ? `: ${ev.reason}` : ''})`)
              return
            }
            this.onSocketClosed(ws, ev.code, ev.reason)
          })
        })
        .catch((err: unknown) => reject(err instanceof Error ? err : new Error(String(err))))
    })
  }

  private route(e: LiveServerEvent): void {
    if (e.type === 'resumptionUpdate') {
      this.resumable = e.resumable
      if (e.resumable && e.handle) this.handle = e.handle
    } else if (e.type === 'goAway') {
      this.log('goAway', e.timeLeftMs)
      void this.handover(e.timeLeftMs)
    } else if (e.type === 'interrupted' || e.type === 'toolCall') {
      // Resuming while generating or running function calls loses data.
      this.resumable = false
    }
    this.opts.onEvent(e)
  }

  private async handover(timeLeftMs: number): Promise<void> {
    if (this.handingOver || this.state !== 'open') return
    this.handingOver = true
    this.opts.onReconnecting?.('goaway')
    const deadline = Date.now() + Math.max(0, timeLeftMs - 2500)
    try {
      while (!this.resumable && Date.now() < deadline && this.state === 'open') await sleep(120)
      if (this.state !== 'open') return
      const next = await this.openSocket(this.handle)
      const old = this.sock
      this.sock = next
      if (old) {
        this.superseded.add(old)
        try {
          old.close(1000, 'handover')
        } catch {
          /* ignore */
        }
      }
      this.opts.onReconnected?.({ resumed: this.handle !== null })
    } catch (err) {
      // Keep serving on the old socket; if it dies the normal reconnect path takes over.
      this.log('handover failed', err)
    } finally {
      this.handingOver = false
    }
  }

  private onSocketClosed(ws: WebSocket, code: number, reason: string): void {
    if (this.superseded.has(ws)) return
    if (ws !== this.sock) return
    if (this.expectedClose || this.state === 'closed') {
      this.opts.onClosed({ code, reason, expected: true })
      return
    }
    this.sock = null
    void this.reconnectLoop(code, reason)
  }

  private async reconnectLoop(code: number, reason: string): Promise<void> {
    this.state = 'reconnecting'
    this.opts.onReconnecting?.('dropped')
    const max = this.opts.maxReconnectAttempts ?? 4
    let lastError = `${code}${reason ? `: ${reason}` : ''}`
    for (let attempt = 0; attempt < max; attempt++) {
      await sleep(Math.min(250 * 2 ** attempt, 3000))
      if (this.expectedClose) return
      try {
        const next = await this.openSocket(this.handle)
        if (this.expectedClose) {
          next.close(1000)
          return
        }
        this.sock = next
        this.state = 'open'
        this.opts.onReconnected?.({ resumed: this.handle !== null })
        return
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        this.log('reconnect attempt failed', attempt, lastError)
      }
    }
    this.state = 'closed'
    this.opts.onClosed({ code, reason: `connection lost: ${lastError}`, expected: false })
  }
}
