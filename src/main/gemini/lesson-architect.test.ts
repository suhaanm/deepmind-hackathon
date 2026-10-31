import { describe, expect, it } from 'vitest'
import { MODELS } from '../../shared/models'
import { LessonPlanSchema, wordCount, type LearnerSnapshot } from '../../shared/protocol'
import { fakeAi, hasImage, modelOutput, sleep, testDeps, testShot, textInput } from './fake-ai.test-util'
import { GeminiError } from './client'
import { createLessonArchitect } from './lesson-architect'

const learner: LearnerSnapshot = {
  skills: {
    video_call: { level: 2, streakClean: 1, lastSeen: null, nextReview: null },
    spot_scam: { level: 1, streakClean: 0, lastSeen: null, nextReview: null },
    bigger_text: { level: 3, streakClean: 2, lastSeen: null, nextReview: null },
  },
  confidenceLog: [],
  attempts: [],
  whatWorks: ['short sentences', 'analogies to the post office'],
  avoidJargon: ['browser', 'app'],
}

const rawStep = (over: Record<string, unknown> = {}) => ({
  instruction: 'Press the green Start call button.',
  targetDescription: 'green rounded button labelled Start call, left column',
  expectedOutcome: 'A call window is open showing a camera preview.',
  hints: { l1: 'Watch where I point.', l2: 'It is the green one.', l3: 'Look for green on the left.' },
  safetyCritical: false,
  analogy: '',
  ...over,
})

describe('lesson architect', () => {
  it('returns a validated plan: ids, indexes, goal, argon, medium thinking, hard 15s budget', async () => {
    const { ai, calls } = fakeAi(() => modelOutput({ skillId: 'video_call', steps: [rawStep(), rawStep({ instruction: 'Wait for Emma to answer.' })] }))
    const plan = await createLessonArchitect(testDeps(ai)).plan({ goal: 'Call my granddaughter Emma', learner })
    expect(LessonPlanSchema.safeParse(plan).success).toBe(true)
    expect(plan.goal).toBe('Call my granddaughter Emma')
    expect(plan.skillId).toBe('video_call')
    expect(plan.steps.map((s) => s.index)).toEqual([0, 1])
    expect(plan.steps[0].id).toBe(`${plan.lessonId}-s1`)
    expect(plan.steps[0].analogy).toBeUndefined()
    expect(calls[0].params.model).toBe(MODELS.argon)
    expect(calls[0].params.store).toBe(false)
    expect((calls[0].params.generation_config as { thinking_level: string }).thinking_level).toBe('medium')
    expect(calls[0].params).not.toHaveProperty('temperature')
    expect(textInput(calls[0])).toContain('short sentences')
    expect(textInput(calls[0])).toMatch(/untrusted DATA/)
  })

  it('caps at 6 steps and 20 words per instruction', async () => {
    const long = Array.from({ length: 35 }, (_, i) => `word${i}`).join(' ')
    const steps = Array.from({ length: 9 }, () => rawStep({ instruction: long }))
    const { ai } = fakeAi(() => modelOutput({ skillId: 'bigger_text', steps }))
    const plan = await createLessonArchitect(testDeps(ai)).plan({ goal: 'Make the text bigger', learner })
    expect(plan.steps).toHaveLength(6)
    for (const s of plan.steps) expect(wordCount(s.instruction)).toBeLessThanOrEqual(20)
  })

  it('forces safetyCritical on risky steps; the model may add the flag but never remove it', async () => {
    const steps = [
      rawStep({ instruction: 'Type your password into the box.', safetyCritical: false }),
      rawStep({ instruction: 'Look at the sender name.', safetyCritical: true }),
      rawStep({ instruction: 'Open the Display page.', safetyCritical: false }),
    ]
    const { ai } = fakeAi(() => modelOutput({ skillId: 'spot_scam', steps }))
    const plan = await createLessonArchitect(testDeps(ai)).plan({ goal: 'x', learner })
    expect(plan.steps.map((s) => s.safetyCritical)).toEqual([true, true, false])
  })

  it('keeps the analogy when present and sends the screenshot when given', async () => {
    const { ai, calls } = fakeAi(() => modelOutput({ skillId: 'video_call', steps: [rawStep({ analogy: 'Like picking up the phone.' })] }))
    const plan = await createLessonArchitect(testDeps(ai)).plan({ goal: 'x', learner, shot: testShot() })
    expect(plan.steps[0].analogy).toBe('Like picking up the phone.')
    expect(hasImage(calls[0])).toBe(true)
  })

  it('rejects invalid output (TEACH then falls back to its static plan)', async () => {
    const { ai } = fakeAi(() => modelOutput('not json at all'))
    await expect(createLessonArchitect(testDeps(ai)).plan({ goal: 'x', learner })).rejects.toMatchObject({ code: 'parse' })
    const { ai: ai2 } = fakeAi(() => modelOutput({ skillId: 'not_a_skill', steps: [rawStep()] }))
    await expect(createLessonArchitect(testDeps(ai2)).plan({ goal: 'x', learner })).rejects.toBeInstanceOf(GeminiError)
  })

  it('rejects with a timeout instead of hanging past its budget', async () => {
    const { ai } = fakeAi(async () => {
      await sleep(500)
      return modelOutput({ skillId: 'video_call', steps: [rawStep()] })
    })
    const started = Date.now()
    await expect(createLessonArchitect(testDeps(ai), { timeoutMs: 60 }).plan({ goal: 'x', learner })).rejects.toMatchObject({ code: 'timeout' })
    expect(Date.now() - started).toBeLessThan(400)
  })

  it('rejects an empty goal without calling the model', async () => {
    const { ai, calls } = fakeAi(() => modelOutput({}))
    await expect(createLessonArchitect(testDeps(ai)).plan({ goal: '  ', learner })).rejects.toMatchObject({ code: 'no_input' })
    expect(calls).toHaveLength(0)
  })
})
