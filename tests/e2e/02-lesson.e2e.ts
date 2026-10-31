// (b) Full lesson run for video_call: start_lesson -> steps -> verify/step_done -> end_lesson -> profile -> higher level next attempt.
// With real services the learner's actions are simulated by moving the demo-stage to the state after each step (needs --visible).
import { beforeAll, describe, expect, it } from 'vitest'
import { REAL, VISIBLE, clearInjectLog, clearOverlayLog, dbg, dev, injectLog, overlayLog, resetApp, sleep, state, tool, waitFor } from './helpers'

interface LearnerAttemptView {
  skillId: string
  completed: boolean
  hintsUsed: number
}

const canDriveStage = !REAL || VISIBLE
const SCREEN_REAL = REAL && VISIBLE

async function learner() {
  return (await dev<{ skills: Record<string, { level: number; streakClean: number }>; attempts: LearnerAttemptView[] }>('/dev/learner')).body
}

async function runCleanAttempt(label: string): Promise<{ steps: number; levelBefore: number; levelAfter: number; ticks: number }> {
  await clearOverlayLog()
  const levelBefore = (await state()).level
  if (SCREEN_REAL) await dev('/dev/stage/call', { fn: 'setStep', args: ['video_call', 0] })
  const started = await tool<{ lessonId: string; skillId: string; stepCount: number }>('start_lesson', { goal: 'Join a video call with Lily' })
  expect(started.result.error, `${label}: start_lesson`).toBeUndefined()
  expect(started.result.skillId).toBe('video_call')
  expect(started.result.stepCount).toBeGreaterThanOrEqual(3)
  const s0 = await state()
  expect(s0.skill?.step).toBe(1)
  expect(s0.skill?.stepCount).toBe(started.result.stepCount)

  let ticks = 0
  for (let i = 1; i <= started.result.stepCount; i++) {
    if (SCREEN_REAL) await dev('/dev/stage/call', { fn: 'setStep', args: ['video_call', i] }) // the learner did the step
    const verdict = await tool<{ completed: boolean; confidence: number }>('verify_step', { expected_outcome: 'the step is done' })
    expect(verdict.result.error, `${label}: verify step ${i}`).toBeUndefined()
    expect(verdict.result.completed, `${label}: step ${i} verdict`).toBe(true)
    const done = await tool<{ ok: boolean; done: boolean }>('step_done', {})
    expect(done.result.ok, `${label}: step_done ${i}`).toBe(true)
    if (i < started.result.stepCount && done.result.done) break
  }
  const log = await overlayLog()
  ticks = log.filter((o) => o.op === 'show').flatMap((o) => o.annotations ?? []).filter((a) => a.kind === 'tick').length
  const ended = await tool<{ ok: boolean }>('end_lesson', { summary: `Joined a video call (${label}).`, teachBackScore: 0.9, confidence: 4 })
  expect(ended.result.ok).toBe(true)
  await sleep(300)
  return { steps: started.result.stepCount, levelBefore, levelAfter: (await state()).level, ticks }
}

describe.skipIf(!canDriveStage)('video_call lesson', () => {
  beforeAll(async () => {
    await resetApp()
    if (SCREEN_REAL) await dev('/dev/stage/open', {})
  })

  it('first attempt runs start -> verify -> step_done x N -> end and records the attempt', async () => {
    const before = (await learner()).attempts.length
    const r = await runCleanAttempt('attempt 1')
    expect(r.ticks, 'a verification tick is drawn for completed steps').toBeGreaterThan(0)
    const snap = await learner()
    expect(snap.attempts.length).toBe(before + 1)
    const last = snap.attempts[snap.attempts.length - 1]
    expect(last.skillId).toBe('video_call')
    expect(last.completed).toBe(true)
    expect((await state()).skill).toBeUndefined()
  })

  it.skipIf(!REAL)('level fades Walk -> Nudge after two clean attempts in demoMode (chip emitted)', async () => {
    await dbg('/settings', { patch: { demoMode: true, helpLevelMode: 'auto' } })
    const seq: number[] = [(await state()).level]
    await runCleanAttempt('attempt 2')
    seq.push((await state()).level)
    const chips = (await overlayLog()).filter((o) => o.op === 'chip').map((o) => o.level)
    // Evidence for the matrix: the level trajectory and chip stream.
    console.log(`[e2e] level trajectory ${seq.join(' -> ')}; chips ${JSON.stringify(chips)}`)
    expect(seq[seq.length - 1]).toBeGreaterThanOrEqual(3)
    expect(chips).toContain(3)
  })

  it.skipIf(!REAL)('a wrong step is NOT ticked: verify_step says not completed and gives a repair hint', async () => {
    await clearOverlayLog()
    await clearInjectLog()
    await dev('/dev/stage/call', { fn: 'setStep', args: ['video_call', 0] })
    await tool('start_lesson', { goal: 'Join a video call with Lily' })
    // The learner did nothing (screen still shows the desktop): step 1 must not verify.
    const verdict = await tool<{ completed: boolean; nextHint?: string; learnerMisstep?: string; evidence: string }>('verify_step', { expected_outcome: 'The VideoChat window is open with a contacts list.' })
    expect(verdict.result.error).toBeUndefined()
    expect(verdict.result.completed).toBe(false)
    const ticks = (await overlayLog()).filter((o) => o.op === 'show').flatMap((o) => o.annotations ?? []).filter((a) => a.kind === 'tick' && (a as { ok?: boolean }).ok !== false)
    expect(ticks, 'no success tick for an unfinished step').toHaveLength(0)
    const injected = (await injectLog()).map((i) => i.text).join('\n')
    expect(Boolean(verdict.result.nextHint) || /\[RUNNER\]/.test(injected), 'a repair hint reaches the learner').toBe(true)
    await tool('end_lesson', { summary: 'abandoned for test' })
  })

  it('aborting via /stop clears the lesson and the overlay', async () => {
    await dbg('/wake', { personaId: 'marcus' })
    await waitFor('session active', async () => ['connecting', 'live', 'thinking', 'speaking'].includes((await state()).phase), 5000, 100)
    await tool('start_lesson', { goal: 'Join a video call' })
    await waitFor('lesson active', async () => (await state()).skill)
    await dbg('/stop', {})
    await waitFor('lesson aborted', async () => !(await state()).skill)
    expect((await overlayLog()).some((o) => o.op === 'clear')).toBe(true)
  })
})
