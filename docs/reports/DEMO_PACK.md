# DEMO-PACK report

## Delivered
- `scripts/start-demo.sh` (+ `npm run showtime`, `npm run demo:interactive`) and `scripts/stop-demo.sh`; flags `--full --live --mute --debug --interactive --dry-run`. Env overrides for tests: `ALONGSIDE_USERDATA`, `DEMO_PID_FILE`, `DEMO_LOG_FILE`, `DEMO_SHOW_DOCK`, `ALONGSIDE_USE_LOCK=1`.
- `docs/DEMO_RUNBOOK.md`; teaching rewrite of `assets/showtime/script.json` (41 lines; new c2-tb and c2-tb2 teach-back lines; ladder, memory callback, "here is how to spot it yourself", counted do-it-for-you, owned profile, closing digital-confidence line).
- Small code fixes in `src/main/showtime/`: the panel is shown for the tour when `showDock` is false (and hidden again after the hand-over, not persisted); the stage takes frontmost focus when opened and when re-shown after ch7 (hides the macOS menu bar items and Dock behind the practice desktop); `ALONGSIDE_STAGE_ONLY=1` opens just the practice desktop for `--interactive`. Chapter waits trimmed (ch3, ch8, ch9) to keep the cut inside budget; teach-back beats added to ch2.

## Timings
Core cut 170.3 s (limit 172 s, test passes). Chapters: 12.8, 30.5, 25.1, 20.2, 8.9, 14.7, 14.5, 6.5, 8.3, 15.5, 13.3. Full tour 264 s. Real run 1 (first script version, 169 to 171 s) started chapters on the planned clock and ended in the hand-over at about 172 s.

## Real Electron tests (under the queue, isolated profiles)
- Tour run, panel visible, captions only: chapters 1 to 11 all ran, none skipped. Screenshots of chapters 2, 3, 4, 7 and the end showed the practice desktop, rings, level chip, the panel with the control bar, the scam marks area and the progress view. Chapter 7 logged the real toast ("[toast] hidden (cleared)" after the automated approve) and `openUrl`. The toast itself was not caught in a screenshot (it is its own window and the shot was after the approve).
- After the tour: `[showtime] profile restored`, no `.showtime-backup` or `.showtime-none` left, every seeded setting identical and the tour-flipped ones (glass, glass opacity, dyslexia font, text scale, theme) back to defaults, phase back to listening for the name.
- Stop mid-tour with `stop-demo.sh`: the app was gone in 2 s, profile restored (log line), lock released.
- Dock hidden (`showDock:false`): the panel still showed at once with the control bar; `showDock` stayed false in the settings file afterwards. Before the fix the panel would not have appeared.
- Interactive start: the practice desktop is fullscreen, the macOS Dock is hidden, the compact panel shows "Ready". `POST /tool spawn_agent scam_check` returned an agent and finished (on the empty desktop it correctly said it saw no message). The S key was not tested through a real key press: an `osascript` keystroke was sent while Terminal was the frontmost app by name in the menu bar, so it may have typed one stray "s" into a Terminal window; please check. The user should press S on the practice desktop.
- Audio: unit test confirms every clip resolves with a matching hash and the run logged no stale-clip warnings. A real audio-out assertion for the built-in speaker appeared while the tour ran, but it cannot be attributed to the app, so audible playback is NOT verified.

## Live phrase test (real gemini-3.8-live, real system instruction, synthetic voice, fresh learner)
| Phrase | Tool called | First spoken reply |
|---|---|---|
| Hey Marcus, I want to video call my granddaughter Lily. | start_lesson (goal: video call my granddaughter Lily) | none before the runner step |
| Marcus, can you check this message for me? | spawn_agent scam_check (useScreen) | "I can certainly take a look at that message for you. Let me check it over." |
| Marcus, where is the Settings app? | point_at (grey Settings gear icon) | none heard before the tool |
| Marcus, how am I doing? | none | "We haven't started a task together yet" (fresh learner; the seeded profile was not loaded in this harness) |
| Marcus, open the website for me. | none | asks which website; wording changed in the doc to name Age UK |
| Hey Amelia, goodbye. (wake matcher) | n/a | matches amelia, trailing text "goodbye"; whether the session honours the trailing word was not tested |

## Unfixed or unverified
- Medium: narration audio playback not verified. A narration clip can run longer than its slot in the full tour (c3-5, c7-3, c3-tech slots raised, not re-measured against the core budget).
- Medium: the toast position was not captured in a screenshot.
- Low: "how am I doing?" recall of last time depends on the real seeded profile loaded by the app; not tested against the live model with the seed.
- Low: the chapter-7 stage hide shows whatever the real browser opens; the stage comes back and takes focus afterwards.
