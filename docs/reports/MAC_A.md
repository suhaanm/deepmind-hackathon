# MAC_A: real-Mac test (14:49-14:58 GMT, 2026-10-31)

Method: `scripts/electron-lock.sh macA npm run dev` twice (fresh profiles `scratchpad/mac-a/ud1`, `ud2`; Showtime narration muted), driven over the debug server (/state /tray /settings /dock.png /overlay.png /shot /tool /wake /stop) plus `screencapture -x`. Real desktop with Terminal, Finder (/Applications) and System Settings open. Logs and screenshots: `docs/reports/mac-a/` (h1.log, h2.log, PNGs; full set in the session scratchpad `.../scratchpad/mac-a/`). A request to kill my own lock-script PID was denied by the auto-mode classifier, so hold 1 ended on its own timeout (175 s).

## Verified on the real Mac
- Launch under the lock: `/health` ok in 2 s, phase `listening_for_name`, hotkeys registered (log: start Cmd+Alt+Space, Cmd+Alt+Shift+Space, Cmd+Alt+Shift+S; stop Cmd+Alt+M, Cmd+Alt+Shift+X), tray created (38x33 at top bar).
- Permissions as the app sees them: microphone Allowed, Screen recording Blocked (onboarding permissions screen, 02-permissions-via-tray.png; point_at and /shot return the Screen Recording error; /shot is HTTP 400). Accessibility not shown in the visible part of the screen; not checked.
- Onboarding: mounted on a fresh profile (9 steps, "Skip for now", Begin), and the permissions step (7 of 9) is reachable via tray "Permissions..." (01, 02). Looks calm and legible. Steps 2-6, 8, 9 (name, style, comfort, look/theme) were NOT walked: osascript keystrokes are not allowed (error 1002) and there is no click tool.
- Tray menu: status, Talk to Marcus/Amelia, Type instead, Mute, Stop (disabled when idle), Hide/Show panel, Run/Stop demo walkthrough, Set up again, Permissions, Quit. `demo`, `type`, `permissions`, `panel` entries worked via /tray/click.
- Dock themes via /dock.png: light, dark, dyslexia+1.5x, high contrast, 380 px width (03, 04, 07). Dark contrast is good.
- Live voice session: POST /wake marcus went connecting to live in about 3 s; assistant greeting streamed in and showed as a bubble in the dock (live-dock.png). /stop returned to `listening_for_name`.
- Showtime (scripted, tray "demo"): started instantly, chapters progressed 1 to 11 of 11 in about 150 s (captions in state: video call, level step-down, scam text, "mute myself", agency approval, GP letter, settings, progress), `listening_for_name` at t=154 s, Stop worked, tray label returned to "Run the demo walkthrough", dock back to normal Marcus/Chat view (s99-after-stop.png). Whether the tour ended by itself before my Stop click is unclear.
- Dock sits bottom-right over the real desktop; it did not block my Terminal.

## Failed or defective (repro in bus lines)
1. Pointing on real apps could not be tested. Electron launched from this Terminal has no Screen Recording grant. `POST /tool point_at` returns "Screen Recording permission is not granted..." (h1.log). Honest failure text, but the dock listening chip still says "I can see your screen" (live-dock.png). Ring placement, absent-target refusal, overlay-not-in-grounding-frame and click-through are NOT VERIFIED on the real desktop. A macOS dialog "Terminal is requesting to bypass the system private window picker" appeared during the run; I did not answer it (the user's decision).
2. Dyslexia font + text scale 1.5 at 380 px: header name truncated, tabs overlap, listening chip overflows, main button scrolls out (07-dyslexia-big.png).
3. Showtime bar overlays the dock header and truncates its label (s05, s14).
4. Showtime stage window visible only until about t=30 s (s01-s03); from about t=40 s the screen captures show the real Terminal while chapters 3-11 ran (s04-s14). Cause unknown.
5. After Showtime stop: captions=false, agency=ask_each, doItForMeAllowed=true (h2.log settings-after). Consistent with the two failing `service.test.ts` cases reported on the bus. Tour launches in my fresh profile only; the real profile was not used.
6. Tray "Type instead" sets `textOnly=true` persistently (h1 /state).
7. Global hotkeys, typed chat reply, reduced motion, focus order, glass on the real desktop (screencapture failed intermittently with "could not create image from display" while windows were changing), light/dark menu bar: NOT VERIFIED. Hotkeys are only confirmed as registered in the log; osascript cannot press them. Typed chat is not verified (no input path); an /inject text got no reply.

## User questions, answered from code (not from real capture)
- Capture scope: `desktopCapturer.getSources({types:['screen']})` on the primary display, so the model sees the whole primary screen: menu bar, Dock and all windows, not one window. Other displays are not captured. The overlay is hidden from capture by content protection (`src/main/capture/overlay-window.ts`); not verified here.
- "No browser window" while two browsers sit in the Dock and "open Safari for me": the default is `agency:'off'`, so the assistant teaches instead of opening; with agency on, `open_for_me` can open a URL. Needs prompt change (bus line to LIVE) and a compact approve panel (bus line to DESIGN). Not reproduced by me.
- The user also asked (pasted URL github.com/webadderallorg/Recordly) for a Recordly-made hype demo video with extra invented features. Out of my lane (tester, no UI edits, no installs, report only verified facts); NOT done. The parent/orchestrator must handle it, and anything shown in a video that the product cannot do should be labelled as concept.

## Prioritised UI fix list (max 12)
1. Fix status honesty: listening chip must reflect Screen Recording state (`design/ListeningLight.tsx`, live-dock.png).
2. Dyslexia + big text layout at 380 px (`design/components.css`, `dock/Panel.tsx`, 07-dyslexia-big.png).
3. Showtime bar must not cover the dock header (`dock/ShowtimeBar.tsx`, s05-showtime.png).
4. Hide Stop when idle; one primary action per screen (`dock/Panel.tsx`, 03-main-light.png).
5. Compact inline approval panel that auto-collapses on detected success (`design/ConfirmModal.tsx`, user request).
6. Header: unlabeled "Aa", mic and chevron icons; replace with text or tooltips, drop the stacked-bars icon in the level chip (`design/LevelChip.tsx`, 03-main-light.png).
7. Focus ring on onboarding heading is a heavy blue box on a non-interactive element (`dock/onboarding/*`, 02-permissions-via-tray.png); keep rings on controls only.
8. Tabs row: "Settings" touches the right edge and tabs scroll; use shorter labels or an overflow (`dock/Panel.tsx`, 03-main-light.png).
9. Idle chat view: "Say Hey Marcus" + big button + "Or type here" repeats the Talk/Type toggle; drop the toggle or the input row (`dock/ChatTab.tsx`, 03-main-light.png).
10. Empty progress/skill list shows three "Not tried yet" cards; collapse into one line (`design/ProgressView.tsx`, s99-after-stop.png).
11. Permission cards in onboarding stack tall; show one card per screen (`dock/onboarding/*`, 02-permissions-via-tray.png).
12. Glass look: verify legibility over busy backgrounds (not verified; `design/tokens.css`).

Bus lines posted: 8 (DESIGN x5 incl. 2 user requests, SHELL, DEMO, LIVE).
