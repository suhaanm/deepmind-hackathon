# Alongside: architecture (first cut, ARCH)

A voice-activated companion that teaches instead of doing. It draws the next step on the user's real screen, checks the user did it, and gradually stops helping as they learn.

```
 wake name / hotkey / button
        |  (bus: session:request)
        v
 main  -------------------------------------------------------------
 |  StateStore --state:update--> dock window  +  overlay window
 |  Settings (settings.json)         |              ^ overlay:cmd (SVG annotations only)
 |  Bus (typed events)               | Live session (renderer: mic, 16 kHz PCM, 1 fps JPEG,
 |                                   |  gemini-3.8-live, persona voice, tools NON_BLOCKING)
 |                                   v
 |  tools/dispatcher  <--live:toolCall-- LiveSession   (same dispatcher as debug HTTP POST /tool)
 |     point_at -> Capture.grab('ground') -> Grounder -> OverlayController.show
 |     start_lesson -> LessonRunner -> LessonArchitect (Argon) -> steps
 |     verify_step -> Capture.grab('verify') -> Verifier -> tick / repair hint
 |     spawn_agent -> AgentRuntime (scam_check | lookup | lesson_summary) -> chip -> live:inject
 |  LevelEngine (pure code) + LearnerStore (markdown profile) decide the Help Ladder level
 '-------------------------------------------------------------------
```

## Windows
- `dock`: small always-on-top interactive panel. Hosts the mic, the Live session and the wake spotter (`backgroundThrottling:false`).
- `overlay`: full-screen, transparent, frameless, click-through, `screen-saver` level, all workspaces. SVG renderer only; no controls.

## Core loop
1. wake / hotkey / button emits `session:request`; main sets phase `connecting` and tells the dock (`session:start`).
2. Dock opens Live with the persona voice and the system instruction from `Teaching.systemInstruction(persona)`.
3. The user asks; the model calls `start_lesson` or `point_at`.
4. Main grabs a fresh full-res shot, grounds the target, and the overlay draws ring/arrow/badge before TTS finishes.
5. `Capture.watch` or `step_done` triggers `Verifier.verify`; the overlay shows a tick or a repair hint.
6. `LessonRunner` advances or fades help via `LevelEngine` (deterministic).
7. End: teach-back, confidence dial, `LearnerStore` updated; the progress view shows hints per task.

## Contracts
- `src/shared/protocol.ts` types and zod schemas, `contracts.ts` service interfaces, `ipc.ts` the single `IPC` const and typed maps, `settings.ts`, `personas.ts`, `models.ts`.
- All coordinates are normalised 0-1000 from the top-left of the target display. Gemini `box_2d` is `[ymin,xmin,ymax,xmax]` and is converted only in `src/main/gemini/grounding-utils.ts`.
- Services are created in `src/main/services.ts` with a mock per service (`ALONGSIDE_MOCK=1` or `ALONGSIDE_MOCK_<NAME>=1`).

## Trust and control
The screen is read only while a session is active; screenshots go out with `store:false`; on-screen text is data, never instructions; "do it for me" is off by default and needs a real click; Stop is always reachable; money and passwords stay with the user.
