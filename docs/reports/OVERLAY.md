# OVERLAY report

Full detail: `docs/OVERLAY_NOTES.md`. Screenshots: `docs/overlay-shots/`. Harness: `src/renderer/overlay/harness/` (`run.sh`, `real-check.sh`, `all.sh`).

## Delivered
- Overlay renderer (all 8 annotation kinds, captions, level-chip echo with draining bars), real capture (content protection excludes the overlay; `ALONGSIDE_OVERLAY_CAPTURABLE=1` for recording), real overlay controller.
- Real-window checks passed: ring lands on the STAGE element (<=1 px), content protection, click-through (synthetic OS click), point_at on the real grounder, ring above a native full-screen app.
- Caption band now moves to the top (below the level chip) when the bottom would cover a mark (QA P2 fix; fixture `caption-avoids`).
- Actuator (`src/main/actuator/**`): `Actuator` with status, canClick, openUrl, openApp, revealPath, openSettingsPane, clickAt(double?), typeText (argv, never in script source), pressKeys (allowlist), scroll. `ActResult {ok, reason?: accessibility|blocked|dry-run|failed, detail?}`. DRYRUN via `ALONGSIDE_ACTUATOR_DRYRUN=1`. `do_it_for_me` flow (default off, denylist, safety-critical/scam refusals, real-click confirm, one click per approval, audit 0600). `denylistMatch` exported from `policy.ts` for AGENCY.
- Tests: 173 actuator tests (injection payloads in typeText/app names/URLs, allowlists, flow refusals, Stop races) plus overlay and capture suites.

## State at report time
- My area is green: typecheck for my files, actuator/overlay/capture tests, build.
- Repo-wide red items are not mine: `tests/live/wire.test.ts`, `prompts.test.ts` and `dispatcher.ts` typecheck fail because AGENCY's `open_for_me`/`act_for_me` are in `LIVE_TOOL_NAMES` without handlers, declarations or prompt lines yet; `src/main/gemini/app-privacy.test.ts` fails in the gemini lane.

## Unverified
- No real click, key, type or scroll was ever performed: needs macOS Accessibility (and possibly an Automation prompt for System Events). Scripts were osacompile-checked only; the JXA scroll has never run.
- Second display / hot-plug, Windows, live chip-drain animation in a running window (stills only).
- `real-*` shots show the menu bar (username) and Dock: delete before publishing if that matters.
