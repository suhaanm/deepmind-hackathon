// Opt-in (WAKE_LIVE_LONG=1, ~12 minutes): proves the spotter survives the 10-minute connection cap of
// gemini-3.5-transcribe-live. "Hey Amelia" is played before, around and after the proactive rotation (9 min) and
// after the point where an un-rotated connection would have been closed by the server.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import dotenv from 'dotenv'
import { describe, expect, it } from 'vitest'
import { PERSONA_LIST } from '../../src/shared/personas'
import { mintWakeToken } from '../../src/main/live-auth'
import { createWakeSpotter, type WakeAudioSource, type WakeStatus } from '../../src/renderer/wake'

dotenv.config({ path: join(__dirname, '..', '..', '.env'), quiet: true })
const enabled = process.env.WAKE_LIVE_LONG === '1' && !!process.env.GEMINI_API_KEY
const clip = join(__dirname, '..', '..', 'spikes', 'wake', 'audio', 'amelia.karen.wav')

function wavPcm(path: string): Int16Array {
  const buf = readFileSync(path)
  const start = buf.indexOf(Buffer.from('data')) + 8
  return new Int16Array(buf.buffer.slice(buf.byteOffset + start, buf.byteOffset + buf.byteLength - ((buf.byteLength - start) % 2)))
}

class ScheduledMic implements WakeAudioSource {
  private timer: ReturnType<typeof setInterval> | null = null
  constructor(
    private readonly pcm: Int16Array,
    private readonly playAtSec: number[],
  ) {}
  async start(onPcm: (p: Int16Array) => void): Promise<void> {
    const t0 = Date.now()
    const frame = 1600
    const plays = this.playAtSec.map((s) => ({ s, played: 0 }))
    this.timer = setInterval(() => {
      const out = new Int16Array(frame)
      const now = (Date.now() - t0) / 1000
      let spoke = false
      for (const p of plays) {
        const off = Math.round((now - p.s) * 16000)
        if (off >= 0 && off < this.pcm.length) {
          out.set(this.pcm.subarray(off, Math.min(off + frame, this.pcm.length)))
          spoke = true
        }
      }
      if (!spoke) for (let k = 0; k < frame; k++) out[k] = Math.round((Math.random() - 0.5) * 60)
      onPcm(out)
    }, 100)
  }
  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

describe.skipIf(!enabled || !existsSync(clip))('spotter across the 10-minute connection cap', () => {
  it('keeps waking on the name before, during and after the rotation', async () => {
    const t0 = Date.now()
    const sec = () => Math.round((Date.now() - t0) / 1000)
    const plays = [30, 530, 575, 700] // seconds; rotation is due at ~540 s (+ up to 2 s quiet wait), cap would hit ~600 s
    const wakes: number[] = []
    const tokens: number[] = []
    const states: string[] = []
    let spotter!: ReturnType<typeof createWakeSpotter>
    spotter = createWakeSpotter({
      personas: PERSONA_LIST,
      getToken: async () => {
        tokens.push(sec())
        return mintWakeToken()
      },
      createAudioSource: () => new ScheduledMic(wavPcm(clip), plays),
      onStatus: (s: WakeStatus) => states.push(`${sec()}s:${s.state}`),
      onWake: (e) => {
        wakes.push(sec())
        expect(e.personaId).toBe('amelia')
        // Emulate LIVE: take the mic for a moment, then give it back, as session:ended would.
        spotter.pause('live')
        spotter.takePreroll()
        setTimeout(() => spotter.resume('live'), 1500)
      },
    })
    await spotter.start()
    await new Promise((r) => setTimeout(r, 730_000))
    spotter.dispose()
    console.log(`[wake-long] wakes at ${JSON.stringify(wakes)}s; token mints at ${JSON.stringify(tokens)}s; status trail ${states.join(' ')}`)
    expect(wakes).toHaveLength(plays.length)
    expect(tokens.some((s) => s >= 530 && s <= 560)).toBe(true) // proactive rotation happened
  }, 800_000)
})
