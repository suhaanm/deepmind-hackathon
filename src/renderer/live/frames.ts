// 1 fps screen-frame sender with change gating. The Live API accepts at most 1 frame per second and, with the default
// turn coverage, every frame lands in context (about 70 tokens each), so an unchanged screen is sent at most every 5 s.
export interface FrameSample {
  jpegBase64: string
  changeScore: number
}

export interface FrameLoopOptions {
  grab: () => Promise<FrameSample | null>
  send: (jpegBase64: string) => void
  intervalMs?: number
  // changeScore at or below this counts as "nothing changed".
  epsilon?: number
  // After the last change, keep sending at full rate this long so the model sees the screen settle.
  settleMs?: number
  // Never go longer than this without a frame.
  maxGapMs?: number
  now?: () => number
  onError?: (err: unknown) => void
}

// Pure decision function so the gating is unit-testable without timers.
export function shouldSendFrame(
  s: { now: number; changeScore: number; lastChangeAt: number; lastSentAt: number | null },
  cfg: { epsilon: number; settleMs: number; maxGapMs: number },
): boolean {
  if (s.lastSentAt === null) return true
  if (s.changeScore > cfg.epsilon) return true
  if (s.now - s.lastChangeAt <= cfg.settleMs) return true
  return s.now - s.lastSentAt >= cfg.maxGapMs
}

export class FrameLoop {
  private timer: ReturnType<typeof setInterval> | null = null
  private inflight = false
  private lastChangeAt: number
  private lastSentAt: number | null = null
  readonly stats = { sent: 0, skipped: 0 }
  private readonly now: () => number
  private readonly cfg: { epsilon: number; settleMs: number; maxGapMs: number }

  constructor(private readonly o: FrameLoopOptions) {
    this.now = o.now ?? (() => Date.now())
    this.lastChangeAt = this.now()
    this.cfg = { epsilon: o.epsilon ?? 0.003, settleMs: o.settleMs ?? 3000, maxGapMs: o.maxGapMs ?? 5000 }
  }

  start(): void {
    if (this.timer) return
    void this.tick()
    this.timer = setInterval(() => void this.tick(), this.o.intervalMs ?? 1000)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  async tick(): Promise<void> {
    if (this.inflight) return
    this.inflight = true
    try {
      const frame = await this.o.grab()
      if (!frame || !frame.jpegBase64) return
      const now = this.now()
      if (frame.changeScore > this.cfg.epsilon) this.lastChangeAt = now
      if (!shouldSendFrame({ now, changeScore: frame.changeScore, lastChangeAt: this.lastChangeAt, lastSentAt: this.lastSentAt }, this.cfg)) {
        this.stats.skipped++
        return
      }
      this.lastSentAt = now
      this.stats.sent++
      this.o.send(frame.jpegBase64)
    } catch (err) {
      this.o.onError?.(err)
    } finally {
      this.inflight = false
    }
  }
}
