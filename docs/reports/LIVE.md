# LIVE report (voice + vision session, dock controller, chat transport)

## Public API (src/renderer/live/**, src/renderer/dock/controller.ts)
- `LiveSession` (`new LiveSession({host:{getAuth,systemInstruction}, audioIn, audioOut, model, toolHandler?, frames?, idleTimeoutMs?, vad?, duplex?, injectVia?, maxReconnectAttempts?})`):
  `start({voiceName, opening?, preRoll?, takePreRoll?, textOnly?, micOptional?})`, `stop(reason)`, `injectText(text,{interrupt?,silent?})` (interrupt:false waits for idle, max 8 s),
  `sendUserText(text)` (typed turn), `setMicMuted`, `setTextMode(on)`, `setIdleTimeout`, `getOutputLevel()/getInputLevel()`.
  Events: `transcript` (cumulative text per turn, `final` at turnComplete/interrupt), `state` (idle|connecting|live|thinking|speaking|error|ended, `reconnecting`), `toolCall`, `toolDone`, `error`, `ended`, `resumption`, `metrics` (setup, ttfa, usage), `notice` (echo_guard, mic_unavailable).
- `LiveConnection` (ws transport, compression+resumption from the first setup, GoAway handover, retry 6x ~10 s), `wire.ts` (builders/parser), `tools.ts` (14 declarations, per-tool scheduling + timeouts), `frames.ts` (1 fps change-gated sender + JPEG validation), `audio.ts` (MicCapture / AudioPlayer AudioWorklets).
- `startController()` (dock): session:start/stop, mic arbitration with the wake spotter, persona voice (Charon/Sulafat while personas say 'TBD'), live:transcript/status/toolCall/inject, chat bus (typed turn starts a session via main if none; text mode = no mic, no playback), `liveHandle.outputLevel()/inputLevel()` for the orb.

## Doc conflicts resolved empirically (real gemini-3.8-live)
- `thinkingConfig` must be omitted (1007 "Thinking level is not supported"); model is fixed at MINIMAL.
- Tool response `scheduling` is a TOP-LEVEL sibling of `response`. Inside `response` (docs example) it is ignored. Value is `INTERRUPT`; `INTERRUPTED` has no effect. SILENT/WHEN_IDLE/INTERRUPT all behave as documented.
- Omitting `behavior` = NON_BLOCKING on 3.8-live (tools.md "sequential by default" is stale); BLOCKING really blocks. We set it explicitly; only ask_user_confirm is BLOCKING.
- `realtimeInput.text` mid-speech DOES interrupt the model (so injections are gated on idle unless interrupt:true).
- One client per session: concurrent resume is refused (1008 "already connected"), so GoAway handover is break-before-make (verified, context survives).
- Ephemeral tokens work minted on v1beta or v1alpha, connected on either endpoint; one use each, so every (re)connect mints a fresh one (`live:token`). live-auth.ts now mints v1beta.
- Server sends `voiceActivity` (ACTIVITY_START/END) messages; unused beyond barge-in flush.
- END_SENSITIVITY_LOW stalled a turn 15 s; START LOW kept (same latency). Default turnCoverage is fine: 45 s silence with changing frames + real TEACH prompt produced no speech.
- A 1x1 JPEG frame (mock capture TINY_JPEG) makes the server close the session with 1007 at the first reply. `frames.ts` now refuses non-JPEG / <64 px frames.

## Numbers
- Setup (token mint + ws + setupComplete): 0.4-1.1 s. Wake to `live` in headless Chrome harness: ~0.7 s.
- Time to first audio: text/injected 0.45-0.9 s; voice 1.1-1.9 s after end of speech (server VAD ~0.8 s inside it).
- Barge-in: playback flushed 183 ms after the learner starts speaking.
- >2 min A/V session with compression: 151-161 s runs OK (128 frames sent), correct recall at 45/90/135 s, vision correct; forced socket drop resumed in ~1.2 s with context; GoAway handover ~2 s with context.

## Verified vs not
- Verified (real API): audio in/out, transcripts, point_at round trip, INTERRUPT scheduling, barge-in flush, injection, compression+resumption, handover, 30 voices render, tokens, real browser AudioWorklets (headless Chrome + fake mic wav), real dock controller + real wake spotter + real Live in headless Chrome, chat in text mode and with mic permission denied.
- Unit: tests/live (59). Smoke: spikes/live (smoke.mjs a|b|c|t5|idle, browser-smoke, browser-controller, browser-chat, probe-*).
- Not verified: speakers + open mic acoustics (echo guard is heuristic; half duplex is the fallback; override `localStorage['alongside.duplex']='half'|'full'`), Electron e2e after the frame fix if the lock was unavailable (see final report).

## HANDOFF (14:45 GMT, LIVE continuation)
STATE
- `src/renderer/live/tools.ts` declares all 17 tools including `open_for_me`, `act_for_me`, `search_files` (+ do_it_for_me), with timeouts (5 min for the confirm-gated ones) and WHEN_IDLE scheduling; names match `LIVE_TOOL_NAMES` in `src/shared/protocol.ts`. No bus request was needed.
- `src/main/index.ts`: `ctx.log` is now wrapped with `redactingLog` (import from `./gemini/redact`): two additive lines.
- Typed chat (text mode: mic off, playback muted, wake spotter paused) is implemented in `dock/controller.ts` (`sendTyped`, `chatBus.onMode`, mic_unavailable falls back to text).
- Prompt (bus line 20, user report "no browser" with browsers in the Dock): `src/main/teaching/prompts.ts` HOW YOU SPEAK now says the model sees the whole screen incl. the Dock, Dock apps count as available, never claim "no browser"; with agency on it offers `open_for_me` (kind url/app) or the Dock icon, with agency off it uses `point_at` on the browser icon; "Never assume their gender". Covered by a new test in `src/main/teaching/__tests__/prompts.test.ts`. A few unrelated words were trimmed to keep the agency+files prompt under 1100 words (now 1099; little headroom). Not verified against the real model.
- Approval auto-dismiss: `dismissConfirmOnStepVerified(bus, confirm)` in `src/main/confirm.ts`, wired in `src/main/index.ts` (one line). On bus `lesson:step` phase `verified` (emitted by the runner for screen, step_done and verify_step advances) it calls `confirm.cancel()`, which clears `pendingConfirm` and resolves the waiting tool as a decline (null), never an approval. Tests: `src/main/confirm.test.ts` (3). Side effect: an open_for_me/act_for_me/ask_user_confirm waiting at that moment returns declined. Not run in Electron.
NEXT STEPS
- Optional Electron e2e of typed chat once the lock is free; spikes/live/browser-chat is the headless version.
KNOWN ISSUES
- Echo guard is heuristic; half duplex is the fallback (`localStorage['alongside.duplex']`).
VERIFY (run at 14:45 GMT)
- `npm run typecheck` green; `npx vitest run` full: 1314 passed, 27 skipped, 0 failed; `npm run build` green. No live API calls and no Electron hold this pass.

## Tools
`spikes/live/voices.mjs` renders tools/voice-audition/*.wav; open tools/voice-audition.html to pick voices (gender is not in Google's docs; page labels are guesses).
