# NOTIFY: permission prompts as a toast at the top of the screen

Status 16:05 GMT. Typecheck, `npm run build` and the full suite (1542 passed, 27 skipped) are green.

## What it does

When `state.pendingConfirm` is set (an `ask_user_confirm`, `open_for_me`, `act_for_me` approval) a small window opens at the top-right of the primary display, just under the menu bar, and one native macOS notification is fired. When the request is cleared (answer, 120 s timeout, Stop, session end, a verified lesson step, a newer request) the window is destroyed in the same tick.

- **Window** (`src/main/toast.ts`): 400 px wide, 12 px margin from `workArea` (which excludes the menu bar), frameless, transparent, `type: 'panel'` on macOS, `skipTaskbar`. Height follows the card: main asks the page for the card's height with `executeJavaScript` (no new IPC channel). Shown with `showInactive()` only after the page has loaded, so it never takes focus. Level `screen-saver` relative level 1 (above the overlay), visible on all Spaces and over full-screen apps (same flags as the overlay). `setContentProtection(true)`, off only with `ALONGSIDE_OVERLAY_CAPTURABLE=1`.
- **Page** (`src/renderer/toast/`): `ToastCard` (pure view), `ToastApp` (state, countdown, design settings), own `index.html`, third electron-vite renderer input. Title "Alongside needs your OK", question in `--fs-lg` bold, two full-width `al-btn--lg` buttons with the real option labels (first = primary, second = outlined "not now" style), a 4 px countdown bar. Uses `tokens.css`, `components.css` and `applyDesignSettings`, so dyslexia font, high contrast, text scale, theme and glass follow Settings.
- **Answering**: through the existing `window.alongside.answerConfirm` (IPC `confirm:answer`, still validated by `ConfirmBroker` against id and the two options). The click handler returns early when `event.isTrusted` is false, and also for the first 500 ms after the toast appears (a click already on its way to another window under the cursor cannot answer it). No key handler, no global shortcut, no Escape; Enter/Space on a focused button is the browser's own trusted click. Focus does not start on a button.
- **Notification**: `Notification` (title `Alongside needs your OK`, body = the question, first 240 chars, `silent: false`), guarded by `isSupported()`, fired once when the toast is revealed; click raises the toast (`showInactive` + `moveTop`). Kept referenced until the toast goes (macOS drops click handlers of collected notifications), and closed with it. No action buttons on purpose: the only approval path stays the real click on the toast.
- **Countdown**: `CONFIRM_TIMEOUT_MS` is now exported from `confirm.ts`; main stores `expiresAt = now + CONFIRM_TIMEOUT_MS` in the new `state.toastConfirm`; the page shows the share of time left since the request reached it. `expiresAt: null` means no bar.

## One prompt, never lost

New optional `CompanionState.toastConfirm?: { id, expiresAt }` is set only while the toast really is up for that request. The dock modal and its auto-expand are keyed on `pendingConfirm && toastConfirm?.id !== pendingConfirm.id`. So with `confirmStyle: 'dock'`, headless, no overlay, or any failure, the dock behaves exactly as before. Failures that clear `toastConfirm` (and so bring up the dock modal, never retrying the toast for that request): the constructor throws, `did-fail-load`, `render-process-gone`, the window is closed from outside, or the page has not loaded after 4 s.

## Shared-file edits (all additive)

`src/shared/settings.ts`: `confirmStyle: 'toast' | 'dock'`, default `'toast'`. `src/shared/protocol.ts`: `toastConfirm?`. `src/main/confirm.ts`: `export` on the timeout constant. `src/main/windows.ts`: exported `adoptOwner(webContentsId)` and `owns()` also accepts adopted ids (the toast must pass the IPC sender guard; it is deliberately NOT added to the mic/screen permission handlers). `src/main/index.ts`: import, `registerToast({ ctx, adoptOwner, disabled: headless || ALONGSIDE_NO_OVERLAY })`, `toast.dispose()` on quit. `src/renderer/dock/App.tsx`: the two `confirmPending` edits. `electron.vite.config.ts`: `toast` input.

Extra env: `ALONGSIDE_CONFIRM_STYLE=dock` forces the old behaviour. QA's e2e (`tests/e2e/07-security.e2e.ts`, `/dev/dock/click` on the dock modal) needs it, or those two tests skip ("dock shows no confirm button") because the prompt is now in the toast. I did not edit `tests/e2e`.

## Tests (30, Electron mocked)

`src/main/toast.test.ts` (22 incl. `it.each`): shows once on `pendingConfirm` with the right options and flags, fits height, protection on/off, notification content and click, hides on answer / Stop / session end / timeout (fake timers, real `ConfirmBroker`) / other clearing / replacement / dispose, never twice (unrelated state changes, page reload, after fallback), no window for `'dock'`, `ALONGSIDE_CONFIRM_STYLE=dock`, headless and no-overlay, mid-request switch to dock, fallbacks (throw, load fail, renderer gone, load timeout, closed from outside), default setting. `src/renderer/toast/ToastCard.test.ts` (8): trusted click answers exactly that option, synthetic click ignored on both buttons, ignored while not armed, no key handlers, countdown bar only when known, 500-char cap, countdown maths.

## Real run (one lock slot, isolated profile, `agency: ask_each`, actuator dry-run, confirm never answered)

`open_for_me` URL raised the confirm; state showed `pendingConfirm` and `toastConfirm` with the same id. Two launches:

- Default (protected): `GET /shot?purpose=ground` and an OS `screencapture -x` both showed NO toast, so content protection works for the app's own capture and for macOS screenshots (the model never sees it).
- `ALONGSIDE_OVERLAY_CAPTURABLE=1`: the OS screenshot showed the toast top-right under the menu bar with the title, "I'll open example.com for you. OK?", a filled primary "Yes, open it" and an outlined "No, I will", over other windows, without taking focus (frontmost app unchanged).
- `POST /stop`: `pendingConfirm` and `toastConfirm` cleared, log line `[toast] hidden (cleared)`, toast gone in the next screenshot, `open_for_me` returned `code: stopped`.
- Screenshots deleted afterwards (they showed the user's desktop).

## Not verified

- The native notification: I could not see our notification in the screenshots (only other apps' "Chrome for Testing" ones were present). An unsigned dev Electron may be blocked or need permission in System Settings, Notifications; delivery, sound and click-to-raise are unit-tested against a mock only. Notification action buttons were not tried (not wanted).
- A real click, Tab/Enter on the toast, and the 500 ms arming were not exercised in the real window (the brief says do not answer). Over full-screen apps and other Spaces: flags are set as for the overlay, not tried.
- After the capturable screenshot I tightened the toast's CSS shadow (a wide shadow showed as a pale rectangle with hard edges because the window is only 12 px larger than the card); that CSS change was not re-screenshotted.
- Multi-display: the toast uses the primary display, like the dock and overlay.

## Full suite

At 16:02 one test in another lane (`src/main/teaching/__tests__/prompts.test.ts:83`, per-task agency wording) failed while it was being edited; at 16:04 the whole suite passed (82 files, 1542 tests).
