# Third-party notices

Alongside adapts a small amount of third-party code and design. Every adapted file carries a header comment (`// Adapted from <project> (<licence>) ...`) and appears once in the table below. The list is generated from `grep -rn "Adapted from" src apps scripts` plus the "Ported from" / "Port of" headers noted below.

## 1. farzaa/clicky and its Windows fork (MIT)

Upstream: <https://github.com/farzaa/clicky> (Swift, macOS) and its Windows fork (C#). Both are MIT licensed. Alongside ported the *algorithm and animation* of the pointer flight and the arrow drawing to TypeScript and SVG; no Swift or C# code is included.

```
MIT License

Copyright (c) 2026 Farza

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

Not carried over from Clicky: its analytics, its Cloudflare worker, its audio assets, its login-item registration and its signing configuration.

## 2. Google Gemini example code (`google-gemini/gemini-live-api-examples`)

Provided to builders by the hackathon guide. **That repository ships no LICENSE file**, so no licence text can be reproduced here; it is used as the guide's own example code and each derived file says so in its header. If the upstream publishes a licence later, follow it. The Live JS example (`gemini-live-ephemeral-tokens-websocket/frontend`: `geminilive.js`, `mediaUtils.js`, `audio-processors/`) was converted to TypeScript and extended (context compression and session resumption, `GoAway` handover, instant interruption flush, per-call async tool dispatch, change-gated frames).

`google-gemini/gemini-skills` (Apache-2.0, per its `LICENSE` and `plugin.json`) was read as API reference for model IDs and parameters; no code from it is included in this repository.

## 3. Adapted files

| File in this repo | Adapted from | Upstream path | Licence | Header wording |
|---|---|---|---|---|
| `src/renderer/overlay/flight.ts` | farzaa/clicky and its Windows fork | `leanring-buddy/OverlayWindow.swift` (`animateBezierFlightArc`); Windows fork `FlyToSequence` | MIT | "Adapted from farzaa/clicky (MIT)" |
| `src/renderer/overlay/annotations/GhostCursor.tsx` | farzaa/clicky | `leanring-buddy/OverlayWindow.swift` (`BlueCursorView` flight) | MIT | "Port of Clicky's BlueCursorView flight (... MIT, farzaa/clicky)" |
| `src/renderer/overlay/arrow.ts` | farzaa/clicky Windows fork | `DrawingOverlayControl.cs` (`BuildArrowHead` head length and spread) | MIT | "Adapted in spirit from farzaa/clicky windows fork" |
| `src/renderer/overlay/annotations/shapes.tsx` | farzaa/clicky Windows fork | `DrawingOverlayControl.cs` (circle and arrow rendering approach) | MIT | "Rendering approach for the Windows fork's circle/arrow ... is kept" |
| `src/renderer/live/audio.ts` | google-gemini/gemini-live-api-examples | `frontend/mediaUtils.js`, `frontend/audio-processors/*.worklet.js` | none stated | "Adapted from google-gemini/gemini-live-api-examples" |
| `src/renderer/live/connection.ts` | google-gemini/gemini-live-api-examples | `frontend/geminilive.js` | none stated | "Adapted from google-gemini/gemini-live-api-examples" |
| `src/renderer/live/wire.ts` | google-gemini/gemini-live-api-examples | `gemini-live-ephemeral-tokens-websocket/frontend/geminilive.js` | none stated | "Adapted from google-gemini/gemini-live-api-examples" |
| `src/renderer/live/LiveSession.ts` | google-gemini/gemini-live-api-examples | `frontend/geminilive.js`, `script.js`, `mediaUtils.js` | none stated | "Ported from google-gemini/gemini-live-api-examples" |

Files that only mention Clicky in a comment, as an explanation of a decision and with no code derived from it (`src/renderer/overlay/geometry.ts`), are not listed above.

## 4. Ideas credited, no code taken

- **Sentient OS** (AGPL-3.0): read only for ideas (act only after a fresh read; one editable Markdown profile where the user's edit wins; approval only by a real click). **No code, comments, prompts or structure were copied or translated from it.** Alongside's own code is therefore not subject to the AGPL.
- **HeyClicky, Copilot Vision, Gemini Live, Coco and others** were studied as prior art (see the README); nothing was taken from them.

## 5. npm dependencies

Installed from the npm registry under their own licences: Electron, electron-vite, Vite, React, react-dom, zod, dotenv, `@google/genai`, vitest, TypeScript and their types. See each package's `LICENSE` in `node_modules`.

## 6. Data and facts

Statistics in the README are quoted from Age UK (3 Sep 2026) and Good Things Foundation (Digital Nation 2026) with links; they are reproduced as facts with attribution, not as text.
