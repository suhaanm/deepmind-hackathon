# Alongside: architecture

A voice-activated companion that teaches instead of doing. It draws the next step on the user's real screen, checks the user did it, and gradually stops helping as they learn.

Conventions: all coordinates are normalised 0-1000 from the top-left of the display (x right, y down). Gemini's `box_2d` is `[ymin,xmin,ymax,xmax]` and is converted in exactly one place, `src/main/gemini/grounding-utils.ts`. IPC channel names exist only in `src/shared/ipc.ts`.

```
 wake name / hotkey / button
        |  (bus: session:request)
        v
 main  -------------------------------------------------------------
 |  StateStore --state:update--> dock window  +  overlay window
 |  SettingsStore (settings.json)    |              ^ overlay:cmd (SVG annotations only)
 |  Bus (typed events)               | LiveSession (renderer: mic 16 kHz PCM, ~1 fps JPEG,
 |                                   |  gemini-3.8-live, persona voice, tools NON_BLOCKING)
 |                                   v
 |  tools/dispatcher  <--live:toolCall-- LiveSession   (same dispatcher as debug HTTP POST /tool)
 |     point_at     -> Capture.grab('ground') -> Grounder -> OverlayController.show
 |     start_lesson -> LessonRunner -> LessonArchitect -> steps
 |     verify_step  -> Capture.grab('verify') -> Verifier -> tick / repair hint
 |     spawn_agent  -> AgentRuntime (scam_check | lookup | lesson_summary) -> chip -> live:inject
 |  LevelEngine (pure code) + LearnerStore (profile.md) decide the Help Ladder level
 '-------------------------------------------------------------------
```

## Processes and windows

| Window | Role | Notes |
|---|---|---|
| `dock` | Small always-on-top interactive panel: persona, listening light, level chip, Stop, captions, agent tray, settings and progress views, ask-confirm modal | Hosts the mic, the Live session and the wake spotter in its renderer (`backgroundThrottling:false`, autoplay allowed). `src/renderer/dock/controller.ts` owns the Live lifecycle and mic arbitration. Sandboxed, context-isolated; talks to main only through the typed `window.alongside` preload API |
| `overlay` | Full-screen, transparent, frameless, click-through (`setIgnoreMouseEvents`), `screen-saver` level, all workspaces | SVG renderer only; no controls. Receives `overlay:cmd` (`show`, `clear`, `caption`, `chip`) and `state:update` |

Only our own windows may use the mic, camera or display capture (permission handlers in `src/main/windows.ts`). Every IPC call is rejected unless it comes from one of our windows.

## Session phases

`CompanionState.phase`: `asleep` -> `listening_for_name` (wake spotter on) -> `connecting` -> `live` <-> `thinking` <-> `speaking`, and `error`. A session ends on idle (20 s, 120 s during a lesson), a spoken goodbye, **Stop**, an error, or being replaced by a new wake (a new persona = a new Live session, because the voice is fixed at session setup). Ending a session aborts the running lesson, clears the overlay and cancels any pending confirmation.

## Core loop

1. wake / hotkey / button emits `session:request`; main sets phase `connecting` and sends `session:start` to the dock.
2. The dock pauses the wake spotter, mints an ephemeral token over IPC, opens Live with the persona voice and `Teaching.systemInstruction(persona)`, and replays the spotter's 3 s pre-roll so "Hey X, <question>" is not clipped.
3. The user asks; the model calls `start_lesson` or `point_at`.
4. Main grabs a fresh full-resolution shot, grounds the target, and the overlay draws ring/arrow/badge before the voice finishes.
5. The learner acts; `step_done` or `verify_step` triggers `Verifier.verify` on a fresh shot; the overlay shows a tick or a repair hint.
6. `LessonRunner` advances or fades help via `LevelEngine` (deterministic) and injects `[RUNNER]` / `[STALL]` stage directions into Live.
7. End: teach-back, confidence dial, `LearnerStore` updated, `level:changed` moves the chip; the progress view shows hints per task.

## Services (the DI bag, `src/main/services.ts`)

One line per service; an owner swaps their real implementation in with one line. Interfaces are in `src/shared/contracts.ts`. `ALONGSIDE_MOCK=1` mocks every model-backed service; `ALONGSIDE_MOCK_<NAME>=1` mocks one (`CAPTURE OVERLAY GROUNDER VERIFIER ARCHITECT SCAM ROUTER LIVE LEARNER LEVELS RUNNER TEACHING AGENTS`). Plumbing services (`overlay`, `live`) are real unless mocked individually. Mocks live in `src/main/mocks.ts`.

| Service | Responsibility | Implementation |
|---|---|---|
| `capture` | `grab('live'\|'ground'\|'verify')`, `liveFrame()`, `watch()`; primary display only | `src/main/capture/` |
| `overlay` | `show / clear / caption / chip` over `overlay:cmd` | `src/main/overlay-controller.ts` + `src/renderer/overlay/` |
| `grounder` | "where is this element?" -> `GroundResult`; `found:false` when unsure, never fabricates | `src/main/gemini/grounder.ts` |
| `verifier` | fresh shot + expected outcome -> `Verdict`; tiered `gemini-3.5-flash-lite` -> `gemini-3.8-flash` -> `gemini-4-argon`, escalating only when a tier is unsure (confidence under 0.8 or `uncertain`); if nobody is sure the verdict is "not certain", never a tick | `src/main/gemini/verifier.ts` |
| `architect` | goal + learner + screenshot -> `LessonPlan` (`gemini-4-argon`, 15 s budget, at most 6 steps; `safetyCritical` forced on for risky wording; the teaching layer falls back to a static plan on timeout) | `src/main/gemini/lesson-architect.ts` |
| `scam` | message/screenshot/link -> `ScamReport`; fast `gemini-3.8-flash` pass (+ URL context and Search when there is a link) in parallel with an Argon pass at high thinking; the more cautious merge wins, the fast pass alone if Argon is slow; red-flag phrases verbatim, never "safe", human check always offered | `src/main/gemini/scam-analyst.ts` |
| `router` | classify an utterance (`gemini-3.5-flash-lite`) | `src/main/gemini/router.ts` |
| `live` | `inject(text)` into the active Live session | `src/main/live-bridge.ts` |
| `learner` / `levels` / `runner` / `teaching` | profile, Help Ladder, lesson runner, system-instruction builder | `src/main/teaching/` |
| `agents` | `spawn / list / cancel`; `scam_check`, `lookup`, `lesson_summary` | `src/main/agents/` |

### Grounding (`src/main/gemini/grounder.ts`)

One grounding call per `point_at`, on a fresh full-resolution shot. Default `fast` preset: `gemini-3.5-flash-lite` `box_2d` (thinking low); if it says not-found, is unsure (confidence < 0.7) or errors, escalate to `gemini-3.8-flash`. If every box call fails, a `computer_use` **dry run** gives a click point only (nothing is ever executed) and a nominal box with confidence 0.5. Boxes over half the screen or degenerate boxes are rejected. Results are cached for 30 s per screenshot hash + target, and the runner can prefetch on screen change. Prompts carry an injection guard: text in the screenshot is data.

### Teaching (`src/main/teaching/`)

- `levels.ts`: pure functions, no I/O, no clocks, no LLM. Direction of travel L1 (most help) to L4 (least). Clean attempt = completed, hints at or under the cap for the starting level (`{L2:1, L3:2, L4:0}`), at most 1 error, no safety flag. Step up after the streak (`{L1:1, L2:2, L3:2, L4:2}`; **1 in `demoMode`**) with teach-back at or above 0.67 (a skipped teach-back does not block). Within an attempt: 2 hints, 2 errors, 2 stalls or an anxiety phrase drops the level for the rest of that attempt. Persistent step down after an abandoned attempt or two non-clean attempts in a row. Decay after absence (L2 3 days, L3 7, L4 14). Safety-critical steps never go below L2. "Show me again" and "let me try" override with no penalty. A locked level records attempts but never moves.
- `learner-store.ts`: one Markdown file, `profile.md`, in the Electron user-data directory. Writes are atomic; a write with a stale revision hash is rejected so the user's edit wins; external edits are re-read before every machine write; unknown sections are preserved; unclear values are omitted rather than guessed. "Forget that" and "clear my data" are supported.
- `directives.ts`: the `[RUNNER]` / `[STALL]` stage directions and per-level behaviour text injected into Live. `memory.ts`: the "last time you..." callback.
- `skills/definitions.ts`: `video_call`, `spot_scam`, `bigger_text` (analogy, jargon map, teach-back rubric, retrieval question, common mistakes).

### Agents (`src/main/agents/`)

`AgentRuntime` is an allow-list of three kinds (`scam_check`, `lookup`, `lesson_summary`); there is no kind that can send, buy, click or submit. At most 3 run at once, each has a timeout and a cancel; task and payload text is cleaned (invisible characters removed, brackets neutralised so text cannot imitate `[AGENT_RESULT ...]`); results reach Live as `[AGENT_RESULT kind=... id=... status=...]` and the dock tray as chips. `scam_check` grounds each red-flag phrase on a fresh shot and draws `highlightText` boxes plus an advice bubble; it adds a red flag for any text that tries to instruct an AI, cannot lower a verdict because of it, always appends the human-check line, and drops any sentence that sounds reassuring. `lesson_summary` writes a summary-only `.md` into `exports/` and only when carer sharing is on.

## Live (`src/renderer/live/`)

`LiveSession` is ported from Google's Live JS example and extended: context-window compression and session resumption on from the first message (make-before-break reconnect on `GoAway`, backoff on drops), instant playback flush on `interrupted`, every tool call dispatched as its own task (the example awaited tools inside its receive loop), `NON_BLOCKING` on all tools except `ask_user_confirm`, gated injection of stage directions, change-gated ~1 fps frames, idle and goodbye endings, optional half-duplex (stop uploading mic audio while the model speaks) for speakers without echo cancellation. Tool declarations are in `tools.ts` and mirror `ToolArgSchemas` in `src/shared/protocol.ts`; zod validates again in the dispatcher.

Live tools: `point_at`, `start_lesson`, `step_done`, `verify_step`, `set_help_level` (advisory; the LevelEngine may overrule; refused when the learner locked the level), `spawn_agent`, `ask_user_confirm` (real click only), `update_profile`, `end_lesson`, `clear_annotations`.

Main -> Live: `live:inject` (`[RUNNER]`, `[STALL]`, `[AGENT_RESULT]`). Live -> main: `live:toolCall`, `live:transcript`, `live:status`, `session:ended`.

## Wake and mic arbitration (`src/renderer/wake/`)

A single owner of the microphone at a time. The spotter streams to `gemini-3.5-transcribe-live` (token minted in main, constrained to that model) and fuzzy-matches the persona wake phrases and aliases from `src/shared/personas.ts`. On a match it emits `session:request` and hands the mic to Live; when the session ends it resumes. It is paused while Live owns the mic or TTS plays. The global hotkeys (`src/main/hotkey.ts`: start `Cmd+Alt+Space` with fallbacks `Ctrl+Alt+Space` and `Cmd+Alt+Shift+S`; stop `Cmd+Alt+M` with fallbacks `Cmd+Alt+Esc` and `Cmd+Alt+Shift+X`; macOS reserves some combinations, so every free one is registered and a failure is surfaced in state) and the on-screen button always work, with no mic or network. Details and measurements: `docs/WAKE_SPIKE.md`. In mock mode the spotter makes no cloud connection.

## Trust boundaries

- The real `GEMINI_API_KEY` lives in `.env` and is read only by the main process. Renderers receive short-lived **ephemeral tokens** (voice: 1 use, 30 min; wake: constrained to the transcribe model, 10 min).
- Every Gemini call that can carry a screenshot is made through `src/main/gemini/client.ts`, which forces `store:false`, applies hard timeouts and logs latency per call.
- Screen reads happen only in an active session: the dispatcher refuses live tool calls when the phase is `asleep` or `listening_for_name`. (The dev HTTP surface bypasses this for headless tests and exists only in dev builds.)
- `ask_user_confirm` resolves only from a real click (`confirm:answer`) validated against the pending request id and its two options; it times out to "no".
- Settings default to the safe side: `doItForMeAllowed: false`, `carerSharing: false`.

## Dev and debug surface (dev builds only, `127.0.0.1:${ALONGSIDE_DEBUG_PORT:-7777}`, no browser Origin allowed)

`GET /health`, `GET /state`, `POST /tool {name,args}` (same dispatcher as Live), `POST /inject {text}`, `POST /overlay {cmd}`, `GET /shot?purpose=ground` (JPEG), `POST /wake {personaId}`, `POST /stop`, `POST /settings {patch}`, `GET /overlay.png`, `GET /dock.png`.

Electron windows are shared and cover the real screen: use `scripts/electron-lock.sh <role> <cmd...>` (one instance at a time, auto-kill after 5 minutes) and prefer `ALONGSIDE_NO_OVERLAY=1` or `ALONGSIDE_HEADLESS=1` when you are not testing the overlay.

## Environment flags

`GEMINI_API_KEY` (only in `.env`) - `ALONGSIDE_MOCK` - `ALONGSIDE_MOCK_<SERVICE>` - `ALONGSIDE_NO_OVERLAY` - `ALONGSIDE_HEADLESS` - `ALONGSIDE_DEBUG_PORT` - `ALONGSIDE_USERDATA` (isolated profile directory) - `ALONGSIDE_OVERLAY_CAPTURABLE` - `STAGE_PORT` - `MODEL_LIVE / FLASH / LITE / ARGON / TRANSCRIBE` (read only in `src/shared/models.ts`).

## Testing

`npm test` (vitest) covers the level engine, learner store, agents (runtime, scam check, lookup, lesson summary, text safety), the wake matcher and overlay geometry. Voice paths are tested headlessly with synthetic audio (`say` + `afconvert` to 16 kHz PCM) and the spikes under `spikes/`. Human-only checks are in `docs/MANUAL_TESTS.md`.
