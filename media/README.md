# Alongside launch v4 (teaching, one flow): how it was made

> In this repo the final video is `alongside-launch.mp4` (the file the build calls alongside-teaching.mp4): one flow where the assistant leads the learner through making text bigger while its help fades (Walk with me -> Nudge me -> On my own). Earlier cuts stay in git history. Raw footage, audio stems and the render engine stay local.

Files: alongside-teaching.mp4 (1920x1080, 30 fps, 55.0 s, H.264 + AAC 192k 48 kHz, faststart), poster.png (t = 15.5 s), storyboard.md, work/ (engine.html, render.mjs, mkD.py, build.sh, D.json, contact sheets contactC1/2.jpg, spectrogram.png, final_audio.wav; engine_v1/v2_backup.html are earlier cuts). Audio and footage come from ../audio4/ and ../footage4/.

Story: ONE task, ONE flow. The assistant leads and the user never goes wrong; help fades inside the task (Walk with me -> Nudge me -> On my own). The assistant never clicks anything.

## REAL vs COMPOSED
| Element | Status |
|---|---|
| System Settings windows (Accessibility pane, Display pane with Text size row) and highlight rects | REAL macOS captures (footage4/s1, s3); rects from the accessibility tree. Apple Account/Family sidebar rows were painted over by the footage lane; no name, network or email visible (checked at full size) |
| Voices (USER, Marcus) | Gemini TTS (audio4/), cleaned of end bursts; music = pure C-major sine pad; no sound effects |
| Level chip ("Help level N of 4 - ...", "Step N of 3"), ring + badge, golden glow, ticks, captions, side card, Progress card, dial, kinetic type, end card, camera zooms | COMPOSED motion design in the product's look (kit/), not captured from Electron; no Electron was launched |
| User cursor (macOS arrow + white ripple) and all clicks | COMPOSED and scripted on static captures; nothing was actually clicked. Screen changes are crossfades between real captures (s1 and s2 were identical, so Accessibility + Display are steps on one real pane) |
| Text size slider card (teach-back) | COMPOSED stand-in: the real Text size row opens a sub-pane that was not captured, so a small slider card with an animated knob is drawn under the real row |
| "Hints this time: 2" (1 spoken hint at step 1, 1 glow at step 2) | scripted to match the two assists |
| Hints-per-task bars 5 -> 3 -> 2 and "Fewer hints each time." | DEMO DATA (illustrative, not measured). Not labelled as such on screen |

No statistics or digital-exclusion figures are claimed. Persona "Marcus" is a placeholder.

## Rebuild
`cd /Users/suhaan/Desktop/hackathon/media/v4/work && ./build.sh` (reads audio4/cues.json + master.wav and footage4/*.png + rects.json; timeline derived from cue text).

## Checks performed
- Contact sheets every 1.5 s viewed (work/contactC1.jpg, contactC2.jpg).
- ffprobe: H.264 + AAC, both 55.000 s; muxed audio onsets within 0.01-0.25 s of every cue start; nothing in the 80 ms after each cue end. Integrated loudness about -15.8 LUFS. Spectrogram: speech bands only, no bars at sentence ends.

## Not verified
- Nobody listened to the audio. Largest sample jump is at 6.33 s (USER speech, probably a plosive).
- Step 1 click on the already-selected Accessibility sidebar row produces no visual change (the real Settings has no separate home pane).
- No 60 fps blend; the real Electron dock was not recorded.
