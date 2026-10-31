# Alongside launch v4 (teaching focus): how it was made

> In this repo the final video is `alongside-launch.mp4` (the file the build calls alongside-teaching.mp4). It replaces the earlier 'apply for a job' cut, which stays in git history (commit d772757). Raw footage, audio stems and the render engine stay local.

Files: alongside-teaching.mp4 (1920x1080, 30 fps, 63.0 s, H.264 + AAC 192k 48 kHz, faststart), poster.png (t = 31 s), storyboard.md, work/ (engine.html, render.mjs, mkD.py, build.sh, D.json, contact1/2.jpg = contact sheets every 1.5 s, spectrogram.png, final_audio.wav). Audio and footage come from ../audio4/ and ../footage4/.

## REAL vs COMPOSED
| Element | Status |
|---|---|
| System Settings windows (Accessibility pane, Display pane with Text size row, Appearance pane), highlight rects | REAL macOS System Settings captures (footage4/s1,s3,s4); rects from the accessibility tree (AX), not estimated. Apple Account/Family sidebar rows were painted over by the footage lane; no name, network or email visible (checked at full size) |
| Voices (USER, Marcus) | Gemini TTS (audio4/), cleaned of end bursts; music = pure C-major sine pad. No sound effects |
| Blue ghost cursor + label "Showing you. I will not click.", level chip text "Help level N of 4 - ...", "Step N of 3", ring + badge, repair hint pill, caption pill | COMPOSED in engine.html to match the product look (kit/, real strings). Not captured from Electron. No Electron was launched |
| User cursor (macOS arrow + white ripple) | COMPOSED. The user's clicks are scripted on the static captures: nothing was actually clicked. The assistant never clicks anything on screen |
| Screen changes after each click (crossfade between captures) | COMPOSED; s1 and s2 were identical (Settings has no separate home pane) so Accessibility and Display are shown as steps on the one real pane; the Appearance capture is used for the wrong click |
| Text size slider card in T5 | COMPOSED stand-in: the real Text size row opens a sub-pane that was not captured (s5 close-up only shows the row), so a small light slider card with an animated knob and "Everything looks bigger" is drawn under the real row |
| Confidence dial, Hints card ("Hints this time: 1"), Progress card, kinetic type, end card, camera zooms | COMPOSED motion design |
| Hints-per-try bars 5 -> 3 -> 1, "Last time you found Display on your own", ticked 'Make text bigger' | DEMO DATA (illustrative, not measured from any real user). Not stated as such on screen |
| Hints-this-time = 1 in T4 | scripted to match the single spoken clue |

Teaching, not doing: "Done for you" is never shown; the assistant is never shown clicking. Persona "Marcus" is a placeholder. No statistics or exclusion figures are claimed.

## Rebuild
```bash
cd /Users/suhaan/Desktop/hackathon/media/v4/work && ./build.sh   # reads audio4/cues.json + master.wav, footage4/*.png + rects.json
```
Everything is timed from cues.json (see storyboard.md).

## Checks performed
- Contact sheets every 1.5 s viewed (work/contact1.jpg, contact2.jpg); spot frames at 25 s and 62.4 s.
- ffprobe: H.264 + AAC, both 63.000 s; cues.json durations vs master.wav: speech onset in the muxed audio is within 0.01-0.05 s of each cue start; no energy bursts in the 80 ms after each cue end.
- Integrated loudness of the mp4: about -15.8 LUFS. Spectrogram (work/spectrogram.png): speech bands only, no wide vertical bars at sentence ends.

## Not verified
- Nobody listened to the audio (voice quality, music level, any tiny click). A single-sample spike (jump 0.41) exists at about 32.0 s inside "Take your time" and shows as a hairline in the spectrogram: possibly a TTS artifact; audio lane to confirm.
- T4 stall: cues put the clue at 31.6 s, so the on-screen stall before the glow is about 1.2 s (silence from 30.0 s), not 3 s.
- "Display is just below" is the spec line; on the real Appearance sidebar Display is not literally the next row.
- No 60 fps blend; the real Electron dock was not recorded.
