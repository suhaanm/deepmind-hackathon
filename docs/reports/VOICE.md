# VOICE: "voice mode is not speaking back" (2026-10-31 15:30-15:41 GMT)

## Result
No defect in the playback or session path was found. Voice output was measured working on the real app (real Gemini Live, real mode).
Most likely cause of the user's silence: the chat was in text mode (saved `textOnly=true` from the old Talk|Type switch / tray
"Type instead", which used to persist it). The working-tree App.tsx (UIX) already clears a saved textOnly once at launch and the
Talk|Type switch no longer writes the setting. Not reproducible on this machine because no real profile holds the flag.

## Evidence (real app via scripts/electron-lock.sh voice, marcus, /wake + /inject)
- Temporary instrumentation in AudioPlayer (removed afterwards): AudioContext state "running", sampleRate 24000, currentTime advancing
  (1.8 s to 14.6 s), 13 then 31 audio chunks received (393 KB PCM in one turn), worklet output RMS peak 0.30 to 0.44, destination channels 2.
- Assistant transcripts arrived ("Hello, I'm Marcus...", "One... two... three... four... five."), phase "speaking".
- Saved textOnly=true then POST /wake: a spoken/button start switches to voice, 26 new chunks played, RMS 0.43 (begin() forces voice mode).
- No flush() (interrupt) during replies; the only flush was the session stop.
- System: output volume 100, muted false, default output MacBook Pro Speakers (built-in); input MacBook Pro Microphone.
- User profile: no settings.json under ~/Library/Application Support/Electron or ~/.alongside-demo, so no persisted flag to read.
  The only textOnly=true file found is a MAC-A shell test dir in $TMPDIR (alongside-shell-*).
- Personas use voiceName 'TBD' -> fallback voices; accepted by the model (audio returned).

## Fix
None needed by VOICE beyond UIX's launch-time clear of textOnly (already in the working tree). Reset by hand if needed:
set `"textOnly": false` in the app's settings.json (userData), or press Talk in the chat / switch off "Text only, no speaking".

## Verified vs not
Verified: playback pipeline, AudioContext running, scheduling, RMS, volume/mute/device state, Talk default after wake.
Not verified: actual audibility (cannot hear), the user's own profile, a relaunch with seeded textOnly=true (lock was held by others;
code path read only), mic permission failure path (mic_unavailable switches the chat to text and mutes speech by design).

## Housekeeping
The 15:39 checkpoint commit captured my temporary `[voicedbg]` console.warn lines in src/renderer/live/audio.ts (harmless logging).
They are removed from the working tree; the next checkpoint will drop them.
