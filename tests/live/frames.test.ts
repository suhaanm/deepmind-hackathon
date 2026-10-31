import { describe, expect, it } from 'vitest'
import { FrameLoop, shouldSendFrame } from '../../src/renderer/live/frames'

const cfg = { epsilon: 0.003, settleMs: 3000, maxGapMs: 5000 }

describe('shouldSendFrame', () => {
  it('always sends the first frame and any changed frame', () => {
    expect(shouldSendFrame({ now: 0, changeScore: 0, lastChangeAt: 0, lastSentAt: null }, cfg)).toBe(true)
    expect(shouldSendFrame({ now: 1000, changeScore: 0.2, lastChangeAt: 1000, lastSentAt: 0 }, cfg)).toBe(true)
  })

  it('keeps sending for settleMs after the last change, then drops to one per maxGapMs', () => {
    const at = (now: number, lastSentAt: number) => shouldSendFrame({ now, changeScore: 0, lastChangeAt: 0, lastSentAt }, cfg)
    expect(at(2000, 1000)).toBe(true) // still settling
    expect(at(3500, 2500)).toBe(false) // quiet >3s, sent 1s ago
    expect(at(6000, 2500)).toBe(false) // 3.5s since last sent
    expect(at(7600, 2500)).toBe(true) // >=5s since last sent: always at least one
  })
})

describe('FrameLoop', () => {
  it('skips unchanged frames, never overlaps grabs, and reports errors without dying', async () => {
    let now = 0
    const sent: string[] = []
    const errors: unknown[] = []
    let score = 0.5
    let fail = false
    const loop = new FrameLoop({
      grab: async () => {
        if (fail) throw new Error('capture down')
        return { jpegBase64: `f${now}`, changeScore: score }
      },
      send: (j) => sent.push(j),
      now: () => now,
      onError: (e) => errors.push(e),
    })
    await loop.tick()
    score = 0
    now = 1000
    await loop.tick()
    now = 5000
    await loop.tick() // quiet for 5s since the change at t=0, sent at 1000 -> 4s gap -> skip
    expect(sent).toEqual(['f0', 'f1000'])
    now = 6500
    await loop.tick() // 5.5s since last send
    expect(sent).toEqual(['f0', 'f1000', 'f6500'])
    fail = true
    await loop.tick()
    expect(errors).toHaveLength(1)
    expect(loop.stats.skipped).toBe(1)
  })
})
