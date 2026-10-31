# OVERLAY notes: what is drawn on the real screen, and how we see it

Owner: OVERLAY. Code: `src/renderer/overlay/**`, `src/main/capture/**`, `src/main/overlay-controller.ts`.
Test machine: MacBook Pro, Liquid Retina XDR 3456x2234 (1728x1117 DIPs, scaleFactor 2), macOS 26.2 (25C56), Electron 45.1 (experiment) and 45.2.1 (repo).

## 1. Overlay exclusion experiment (the result that shaped the design)

Question: can the overlay be kept out of `desktopCapturer` frames so grounding and verification never see our own marks?

Method: a throwaway Electron app opened a transparent, frameless, click-through, `screen-saver`-level window over the primary display with an opaque magenta square and green text, then called `desktopCapturer.getSources({types:['screen'], thumbnailSize: full-res})` in each state and sampled the pixel under the square.

| State | Overlay visible in the capture? |
|---|---|
| baseline (no protection) | yes (magenta + green text present) |
| `win.setContentProtection(true)` | **no** (checked twice, 500 ms after the call and again later; PNGs inspected) |
| `win.setOpacity(0)`, grab after 0, 16, 33, 50, 80, 120 ms | no at every delay, including 0 ms (the capture itself takes ~100 ms) |
| `win.hide()` then `showInactive()` | hidden, then visible again |

**Decision:** `setContentProtection(true)` is proven on this macOS, so it is the default (`configureOverlayWindow` in `src/main/capture/overlay-window.ts`). Every `Shot` therefore has `overlayHidden: false` and `ground`/`verify`/`live` frames are all clean: the model never sees its own annotations, and the Verifier judges the user's real screen.

**Demo-recording caveat.** Content protection also hides the overlay from QuickTime, OBS, `screencapture` and screen-share. To record the demo video set `ALONGSIDE_OVERLAY_CAPTURABLE=1`: protection is off and capture falls back to the hide strategy (below).

**Fallback strategy (capturable mode).** For `ground` and `verify` grabs the overlay is set to opacity 0, one 16 ms frame passes, the grab runs, opacity returns to 1 the moment the frame is back. The window is invisible for roughly the capture time (about 100-230 ms measured, slightly over the 120 ms budget on a cold first grab). `live` frames leave the overlay visible, as the contract allows. `Shot.overlayHidden` is `true` for the hidden grabs.

## 2. desktopCapturer behaviour worth knowing

- Primary display only (`screen.getPrimaryDisplay()`); `displayId` is carried in every `Shot`.
- Latency on this machine: full-res 3456x2234 about 100-125 ms warm (first call 215-240 ms); we ask for 1280 (`live`) or 1920 (`ground`/`verify`) wide thumbnails, JPEG q60 / q80.
- **Flaky first call.** In 2 of about 6 fresh processes the first `getSources()` returned `[]`, and one call stalled for minutes. `captureDisplay` therefore wraps each attempt in a 3 s timeout and retries 3 times (150 ms apart) before failing with a clear error.
- `getSources` does not need a window; it works with none open.
- Screen Recording permission: `systemPreferences.getMediaAccessStatus('screen')` was `granted` for the Electron binary launched from the development terminal. When it is `denied`/`restricted` we throw a `CaptureError('permission')` with the exact path to fix it (System Settings > Privacy & Security > Screen Recording, enable the app, **quit and reopen it**: macOS applies the grant only to a relaunched process). `not-determined` is not blocked, because the first grab is what triggers the macOS prompt; an empty source list after retries is reported with the same hint.

## 3. Capture API (`src/main/capture/`)

- `grab('live'|'ground'|'verify')`: sizing per TEAM_BRIEF (`sizing.ts`: never upscales past physical pixels), JPEG base64, `widthPx/heightPx` from the actual image, `scaleFactor`, `overlayHidden`. Concurrent calls for the same purpose share one capture.
- `liveFrame()`: a `live` grab plus `changeScore` (0..1) against the previous live frame (`change-score.ts`: 64x36 resize, 32x18 luma grid, mean absolute difference / 255). A button appearing scores about 0.005, a window opening 0.05+, black vs white 1.
- `watch(on)`: returns an unsubscribe function and also emits `screen:changed` on the bus. It polls a 128x72 thumbnail every 500 ms **only while someone is subscribed**, and fires once after a material change (score >= 0.02 against the baseline) has **settled** (frame-to-frame diff < 0.004) or after 1.8 s of continuous change, so the Verifier looks at the finished state, not a half-open window. Time and sampling are injected (`watcher.ts`) and unit-tested.

## 4. Overlay window behaviour

`configureOverlayWindow(win)` (called from `windows.ts`): click-through (`setIgnoreMouseEvents(true)`), `screen-saver` level, visible on all workspaces and over full-screen apps, content protection per section 1, and a re-fit to the primary display on `display-metrics-changed`, `display-added` and `display-removed`. The renderer re-reads its size on `resize` and re-sends `overlay:ready`.

Real-window results are in section 7.

## 5. Coordinates

All annotation coordinates are normalised 0-1000, top-left origin. `geometry.ts` maps them:
CSS px = norm / 1000 * window size (window fills the display). Helpers also cover global screen DIPs (display not at the origin, negative origins), physical pixels (`scaleFactor`) and screenshot pixels of any downscale. Clicky's redundant double Y-flip is not ported. Unit-tested for retina and an external display at (-2560, -300).

## 6. Renderer

Draws with DESIGN's `annotationStyle(settings, {reducedMotion})` (`bigAnnotations` x1.6, `highContrast`, `dyslexiaFont`); every stroke is halo + casing + core (`strokeLayers`) so it reads on light and dark backdrops, and tone is also carried by dash pattern and a glyph. Kinds: ring (+step badge, label), arrow (planned to stop short of the target and any ring around it, stay on screen, avoid other marks), badge, spotlight (dim with a soft cut-out), ghostCursor (Clicky's bezier flight, scale pulse, trail, optional click-echo ring; **visual only: the window is click-through and no code dispatches input**), bubble (typed text, tail), tick (draw-in check, or a gentle warn mark for a miss), highlightText (wash + underline + note), plus the captions band and the level-chip echo.

Command semantics (`overlay-controller.ts`, `store.ts`):
- `show` upserts by annotation id; the same id and kind updates in place without replaying the entrance animation.
- `clear(ids?)` fades out; no ids clears every annotation (captions and the chip are separate).
- Defaults when `ttlMs` is absent: ring/arrow/badge/spotlight/highlightText stay until cleared but never past a 120 s stale guard; tick 3.5 s; bubble 12 s; ghostCursor flight + 2.2 s.
- `caption` text is the whole line so far; `final=true` starts the linger (3-9 s by length); an empty text dismisses it.
- `chip` is shown for 6 s then fades (the dock owns the persistent chip).
- Out-of-range coordinates are clamped to 0-1000, swapped box corners are fixed, NaN annotations are dropped (one bad drawing never blanks the rest).
- A one-point ghost path flies in from the user's current mouse position.
- Annotations are sent as soon as they are decided; nothing waits for speech.

## 7. Real-window verification

(see below)

## 8. Headless render harness

`src/renderer/overlay/harness/run.sh [--out dir] [--fixtures a,b] [--backdrops light,dark,stage]` bundles `demo.html` with the repo's Vite and screenshots each fixture in `src/renderer/overlay/fixtures.ts` with `webContents.capturePage()` through `scripts/electron-lock.sh OVERLAY`. Fixtures: ring-badge, arrow-box, arrow-point, spotlight, ghost-flight, ghost-press, highlight-text, tick-ok, tick-fail, bubble, captions, tones, big-off, big-on, high-contrast, each over a light and a dark mock desktop. Stills disable entrance animations (hidden windows do not advance CSS animations reliably) and freeze the ghost cursor mid-flight. Output: `docs/overlay-shots/*.png`.

`src/renderer/overlay/harness/real-check.sh` runs the real-window checks (section 7).

## 9. Not verified

- Behaviour on a second display or with a hot-plugged projector (the re-fit handler is wired but only the code path was exercised, not a real hot-plug).
- Windows: none of this was run there.
- A `display-metrics-changed` event was not produced on this machine; the handler is a plain `setBounds(primary.bounds)`.
