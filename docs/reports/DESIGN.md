# DESIGN report

## STATE
Verified by command at the end of this session: `npm run typecheck` clean, `npx vitest run src/renderer` 14 files / 129 tests pass, `npm run build` ok.

Done this session:
- Onboarding: ONBOARD had already mounted `OnboardingFlow` in `src/renderer/dock/App.tsx` (shown whenever `!settings.onboardingDone`, forces the dock open). "Set up again" (`MoreExtras` -> `onSetUpAgain` -> `onboardingDone:false`) therefore does re-run it. Confirmed by reading the code, not by running Electron.
- Progress view: `ProgressView` shows `data.doneForMe.text` as a quiet note (`.al-donefor`) under the headline only when present. The gallery fixture now includes a `doneForMe` sample (and an empty one for the empty state).
- Reduced motion: the pill's screen/wake ring (`.al-orbwrap__light::after`) now stops under `prefers-reduced-motion` and `data-motion='reduced'`.
- Escape: in a text box, select or textarea Escape only blurs the field and no longer collapses the panel (`App.tsx`). The chat draft also survives the panel collapsing (module-level `keptDraft` in `chat/ChatView.tsx`).
- Segmented controls (`design/Switch.tsx`): radio-group keys (arrows, Home, End, roving tabindex), buttons are `--target-min` (44px at the default size) tall.
- Focus ring: inside `.al-dock` and on `.al-seg__btn` the ring is inset (`outline-offset:-3px`) so the dock's `overflow:clip` no longer cuts it.
- Persona names left as placeholders (Marcus, Amelia, ...) in `src/shared/personas.ts`; untouched.

Polish pass (ORCH-B), verified by typecheck, 17 renderer test files / 139 tests, build at 14:50 GMT:
- Helper chips (`AgentTray`): removed the decorative kind icon and status icon; status is a text pill, spinner only while running.
- Calmer chrome: 1px dividers (head, tabs, footer), 3px tab underline, 48px tabs, softer eyebrow letter-spacing. Glass contrast untouched (tokens already tested by contrast.test.ts).
- `nextSegmentIndex` (arrow-key model) extracted from `Segmented` and unit-tested in `design/segmented.test.ts`.
- bus.md read at 14:50: no MAC-A/MAC-B `@DESIGN` defects yet (only the original doneForMe request, done). Re-read before freeze.

MAC-A defects (bus lines 14-17, 21), code changes verified by typecheck, renderer tests and build at 15:05 GMT; none seen on a real Mac or in a screenshot after the change:
- Showtime bar: now its own wrapping strip at the top of the dock (no longer `position:fixed` over the header), full-width chapter label, 44px buttons (`dock/ShowtimeBar.tsx`).
- Listening chip: `ListeningLight` gets a `blind` state ("I can't see your screen yet", warn-coloured dot) plus a Fix button that calls `permissions.openSettings('screen')`. Driven by `useScreenBlocked()` (`permissions.status().screen !== 'granted'` plus `onChange`); Pill orb light uses it too. Unit test `design/listening-light.test.ts`.
- Stop button: only shown while a session is connecting/live/thinking/speaking or the Showtime demo is running (panel footer and pill).
- Approval: `ConfirmModal compact` (used by the dock) is one line and two buttons pinned to the bottom of the dock, no scrim, no focus trap; still only trusted clicks answer. NOT done: auto-dismiss when the step is verified (that needs main to clear `pendingConfirm`; ask LIVE/CONTROLLER).
- Big text + dyslexia at 380px: tabs wrap to a second row (`min-width:min-content`), header row wraps and the persona name wraps instead of "Ma...", chat top row wraps, the listening chip and footer wrap and grow, empty-chat content uses `justify-content: safe center` so the Talk button stays reachable by scrolling.

## NEXT STEPS
1. Real-window check under `scripts/electron-lock.sh DESIGN` (<=3 min): Tab through the dock and check the inset ring on tabs and header; Arrow keys on Talk/Type; type a draft then press Escape.
2. Look at the gallery in light, dark, high-contrast and dyslexia font for the new Done-for-you note.
3. `docs/design-preview/index.html` was not regenerated (`node src/renderer/design/preview/build.mjs`).
4. `Panel` accepts a `files` section but `App.tsx` does not pass one (FILES lane).

## KNOWN ISSUES
- Not verified visually: I could not launch headless Chrome (Bash denied that call), so the focus ring, the Done-for-you note and the 44px segmented targets are checked by code and CSS only. A gallery build succeeded in a throwaway config.
- With reduced motion, the pill's ring is hidden (animation off leaves opacity 0); the dot still shows the state, same as the existing `.al-light__dot::after` rule.
- Inset focus ring means the ring overlaps the control edge on small buttons; judged better than clipping.
- No jsdom in the repo, so Segmented key handling and the Escape logic have no unit tests.

## VERIFY
```
cd /Users/suhaan/Desktop/hackathon/deepmind-hackathon
npm run typecheck
npx vitest run src/renderer
npm run build
```
