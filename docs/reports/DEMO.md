# DEMO report (Showtime)

## STATE
- Typecheck error fixed: `StageWindow.messageText(target)` added (reads the visible text of a stage element by `data-ground-id`); `driver.ts` live scam path uses it.
- New `src/main/showtime/service.ts` (electron-free lifecycle: seed demo profile with backup, open stage, build chapters, machine, hand-over, cleanup, `bindShowtimeBus`, `dockStopBox`) and `src/main/showtime/index.ts` (electron wiring: IPC `showtime:start|stop|next|prev|pause|state`, `showtime:update` broadcast to dock and overlay, bus `showtime:request`, dock Stop ends the tour, `ALONGSIDE_SHOWTIME_AUTOSTART=1`).
- Tray item "Run the demo walkthrough" now works: `showtime:request` is handled, and `registerTray` gets `showtimeRunning` so the label flips to "Stop the demo walkthrough".
- Shared-file edits (minimal, additive): `src/main/index.ts` (import, `restoreProfile` at startup, `registerShowtime`, `showtimeRunning`, dispose on quit), `src/renderer/dock/main.tsx` (`startShowtimeCues`), `src/renderer/dock/App.tsx` (`<ShowtimeBar />`), `src/renderer/overlay/Overlay.tsx` (`<Roadmap />`).
- Dock: `showtime-cues.ts` (narration audio, view/chat/profile cues to the existing window events), `ShowtimeBar.tsx` (Back, Pause, Next, Stop demo).
- Overlay: `annotations/Roadmap.tsx` + `roadmap-model.ts` (roadmap strip, "Scripted walkthrough" badge, off with `ALONGSIDE_SHOWTIME_BADGE=0`, hidden in live mode).
- Driver teardown now also restores the persona (including "none") and the resting phase. Found by a new driver test.
- `assets/showtime/demo-profile.md` (copy of the teaching fixture, so main does not depend on the teaching folder at runtime).
- Docs: `docs/SHOWTIME.md`.
- Showtime is wired in `src/main/index.ts`.

- MAC-A fixes (15:04): (1) driver teardown now restores EXACT prior settings (every key that differs from the pre-tour snapshot: agency, doItForMeAllowed, captions, persona, look-and-feel); per-chapter baselines still only undo the look-and-feel keys. Covered by driver tests. (2) stage window: `show()` and a 1 s keep-alive re-assert shown, always-on-top (floating, below the dock), all workspaces and simple fullscreen, and `moveTop()`; only the tour's own `hide()` (chapter 7) suspends it. Root cause of the ~40 s disappearance not reproduced (no Electron run here); the keep-alive is a defensive fix and is unverified on a real Mac.

## NEXT STEPS
1. A real Electron run under `scripts/electron-lock.sh DEMO` with `ALONGSIDE_MOCK=1 ALONGSIDE_SHOWTIME_AUTOSTART=1 ALONGSIDE_USERDATA=<tmp>` (Electron launches were refused by the permission system in this session): check the stage window, synthetic clicks, roadmap strip, control bar overlap with the dock header, and the Stop ring position.
2. Render narration clips (`assets/showtime/clips`, with `manifest.json`); currently none exist, so the tour is captions only. The narrator's stale-clip log mentions `npm run showtime:render`, which does not exist yet.
3. Optional: remove the `showtime-*` seeded attempts at the end of a tour.

## KNOWN ISSUES
- Untested on screen: everything that needs Electron (see VERIFY).
- `dockStopBox` is an estimate of where the Stop button sits (bottom-right of the work area); the dock does not report its real rect.
- `ShowtimeBar` is fixed at the top of the dock and covers the panel header while a tour runs.
- Seeded attempts `showtime-1..3` stay in the learner store after the tour.
- The tray shows "Stop the demo walkthrough" until the owner closes the hand-over (the practice desktop stays up for questions).

## VERIFY
- `npm run typecheck` (green at the last run)
- `npx vitest run src/main/showtime src/renderer/overlay/annotations src/renderer/dock/showtime-cues.test.ts src/main/tray.test.ts`
- `npm run build`
