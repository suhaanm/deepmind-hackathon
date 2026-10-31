# Alongside launch video (v3): how it was made and how to rebuild

Files: alongside-launch.mp4 (1920x1080, 30 fps, 62 s, H.264 + AAC, faststart), alongside-launch-teaser-15s.mp4 (16.4 s), poster.png, storyboard.md, audio/ (stems + master_final.wav), v3/ (engine, frames), footage3/ (raw clips), audio3/, kit/. The older alongside-demo-v2.mp4 is superseded.

## REAL vs COMPOSED
| Element | Status |
|---|---|
| Google DeepMind careers page, "View open roles", job list, search box typing "research engineer", role page with Apply (footage3/*.mp4, role-apply.png) | REAL public web pages, recorded by the FOOTAGE lane with scripted clicks (not the assistant's own run) |
| Mail client and the "Talent Team" fee email | STAGED local page (mock mail client, fake sender address). It does not read anyone's real mail |
| Blue ghost cursor, ring, label chips, caption pill, level chip, toast ("Alongside needs your OK", "Yes, open it" / "No, I will"), menu-bar state, progress panel, red-flag rings | COMPOSED in v3/work/engine.html to match the product look (media/kit, src/renderer/overlay); not captured from Electron. The real Electron dock was not launched |
| User cursor (macOS arrow + white ripple) vs assistant cursor (blue ghost + blue ring pulse) | COMPOSED |
| Voices (user + "Marcus"), sfx, music bed, master mix | Gemini TTS + synthesised sfx/bed by the AUDIO lane (audio3/) |
| Kinetic type, camera zooms, whip transitions, waveform (synthetic amplitude gated by the voice cue times), counters, end card | COMPOSED motion design |

Everything is scripted and deterministic. The video shows the user (not the assistant) opening a role and pressing Apply; the assistant only points ("Showing you. I will not click.", the product's real ghost label) and never applies, signs in or submits. Nothing is called "safe". No "Concept" content.

Assumption: "the separate email thing" = the Scam Shield email check, shown on a staged recruiter-style email.

HUD truthfulness: the glass chip at right is driven by marks in v3/work/render.mjs (`marks`): Step 1 of 3 / Watch me until 17.9 s, Step 2 from the View open roles click, Step 3 / Walk with me from 26 s; Done for you 1 (page opened, 14.6 s) -> 2 (roles list, 18.2 s) -> 3 (search typed, 23.3 s); By you 1 at the Apply click (31.0 s). During the email it switches to "Check an email, Step 1 of 1". The closing panel shows Watch me -> Walk with me -> Nudge me with 3 / 1.

## Rebuild
```bash
cd /Users/suhaan/Desktop/hackathon/media/v3/work
# frames from the real clips (30 fps)
mkdir -p fr/car fr/b fr/em fr/r && cp ../../footage3/role-apply.png fr/r/role.png
ffmpeg -y -i ../../footage3/careers.mp4 -vf fps=30 -q:v 3 fr/car/%05d.jpg
ffmpeg -y -i ../../footage3/careers-search.mp4 -vf fps=30 -q:v 3 fr/b/%05d.jpg
ffmpeg -y -i ../../footage3/email.mp4 -vf fps=30 -q:v 3 fr/em/%05d.jpg
# render 1860 frames with 6 parallel headless Chromes (engine.html, deterministic R(t))
for i in 0 1 2 3 4 5; do a=$((i*310)); node render.mjs $((9380+i)) $a $((a+310)) & done; wait
# audio (loudnorm -16 LUFS, TP -1.5) and encode
cd ../.. && ffmpeg -y -i audio3/master.wav -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 audio/master_final.wav
ffmpeg -y -framerate 30 -i v3/frames/%05d.jpg -i audio/master_final.wav -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart alongside-launch.mp4
python3 v3/work/teaser.py
```
Voices, tick sounds and bed are rebuilt by the AUDIO lane's scripts in audio3/ (key read from the repo .env by script, never printed).

## Loudness (measured on the final mp4, ebur128)
Integrated -16.4 LUFS, LRA 3.0 LU, true peak -1.7 dBFS. Sound design (quiet sine ticks: user and assistant at different pitch, warm toast chime, soft whooshes, pad bed) is from audio3/.

## Checked by viewing frames
Contact sheets every 1.5 s and spot frames: no private content (public pages, staged mail only, no menu bar/dock/usernames), HUD text matches the step, cursors distinct, no overlapping caption/chip after fixes (flag chips for the fee and deadline sit below their boxes).

## Not verified
- Nobody has listened to the audio: voice quality, sfx taste and bed level are unheard; sync is by timestamps only (ticks at 17.9/20.4/22.9/31.0 s vs the visual clicks, cues in audio3/cues.json).
- Narration timing vs visuals: the line "This last step is yours..." starts at 20.4 s while the search typing is on screen; the Apply moment is at 29-31 s.
- No 60 fps motion-blur blend (blur is CSS only on whips/zooms). The real Electron dock was not recorded.

## Published subset and audio update (16:30)
This folder holds the final videos plus the storyboard, spec and design kit. Raw footage, stems, frames and the build engine (v3/, footage3/, audio/, audio3/, work/) stay local to keep the repo small. Final audio: voices + one very quiet constant music pad only. All sound effects (whooshes, toast chime, ticks) were removed because they were audible as screeches at line ends; the mix script is audio3/remix_clean.py (local).
