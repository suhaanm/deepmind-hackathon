// (f) Stop / idle / session lifecycle through the bus: wake -> connecting -> (live) -> stop -> resting; persona switch; Stop clears everything.
import { beforeAll, describe, expect, it } from 'vitest'
import { REAL, dbg, overlayLog, clearOverlayLog, resetApp, state, tool, waitFor } from './helpers'

const ACTIVE = ['connecting', 'live', 'thinking', 'speaking']
const RESTING = ['listening_for_name', 'asleep']

describe('session lifecycle', () => {
  beforeAll(async () => {
    await resetApp()
    await waitFor('resting', async () => RESTING.includes((await state()).phase), 5000)
  })

  it('wake (button) starts a session for the persona: phase leaves resting, persona set', async () => {
    const r = await dbg('/wake', { personaId: 'marcus' })
    expect(r.status).toBe(200)
    const s = await waitFor('session active', async () => {
      const cur = await state()
      return ACTIVE.includes(cur.phase) || cur.phase === 'error' ? cur : null
    }, 5000, 100)
    // A session that immediately errors (no mic, no network, no token) is a finding, not a pass.
    expect(s.phase, `phase ${s.phase}, lastError: ${s.lastError ?? '-'}`).not.toBe('error')
    expect(s.persona).toBe('marcus')
    expect(s.settings.persona).toBe('marcus')
  })

  it('a second wake with another persona replaces the session (persona switch)', async () => {
    await dbg('/wake', { personaId: 'amelia' })
    await waitFor('persona amelia', async () => (await state()).persona === 'amelia', 5000, 100)
    const s = await state()
    expect(ACTIVE).toContain(s.phase)
  })

  it('Stop returns to resting, clears the lesson, overlay, and any pending confirm', async () => {
    await tool('start_lesson', { goal: 'Join a video call' })
    const pending = tool('ask_user_confirm', { question: 'Is this a test?', options: ['Yes', 'No'] })
    await waitFor('confirm pending', async () => (await state()).pendingConfirm, 3000, 50)
    await clearOverlayLog()
    const stop = await dbg('/stop', {})
    expect(stop.status).toBe(200)
    const s = await waitFor('resting after stop', async () => {
      const cur = await state()
      return RESTING.includes(cur.phase) ? cur : null
    }, 5000, 100)
    expect(s.skill).toBeUndefined()
    expect(s.pendingConfirm).toBeUndefined()
    const answered = await pending
    expect(answered.result.error).toBeUndefined()
    expect((answered.result as { choice: string | null }).choice, 'Stop must cancel, never approve').toBeNull()
    expect((await overlayLog()).some((o) => o.op === 'clear')).toBe(true)
  })

  it('Stop while already resting is harmless (idempotent)', async () => {
    const before = await state()
    expect((await dbg('/stop', {})).status).toBe(200)
    const after = await state()
    expect(RESTING).toContain(after.phase)
    expect(after.persona).toBe(before.persona)
  })

  it('wakeEnabled=false rests at asleep after a session; true rests at listening_for_name', async () => {
    await dbg('/settings', { patch: { wakeEnabled: false } })
    await dbg('/wake', { personaId: 'marcus' })
    await waitFor('active', async () => ACTIVE.includes((await state()).phase), 5000, 100)
    await dbg('/stop', {})
    await waitFor('asleep', async () => (await state()).phase === 'asleep', 5000, 100)
    await dbg('/settings', { patch: { wakeEnabled: true } })
    await dbg('/wake', { personaId: 'marcus' })
    await waitFor('active', async () => ACTIVE.includes((await state()).phase), 5000, 100)
    await dbg('/stop', {})
    await waitFor('listening_for_name', async () => (await state()).phase === 'listening_for_name', 5000, 100)
  })

  // The brief says an idle session ends after 20 s. Slow; only meaningful once the dock's Live session really runs.
  it.skipIf(!REAL)('an idle session ends by itself (~20 s, reason idle)', async () => {
    await dbg('/wake', { personaId: 'amelia' })
    await waitFor('active', async () => ACTIVE.includes((await state()).phase), 8000, 200)
    await waitFor('idle timeout returns to resting', async () => RESTING.includes((await state()).phase), 45_000, 500)
  }, 60_000)
})
