# Manual tests (things the headless suite cannot check)

Run these on the demo machine before submission. Tick them in `docs/QA_STATUS.md`. Use the demo stage (`npm run stage`, then open `http://127.0.0.1:5180/index.html?still=1`) or the real desktop.

## Before every demo (2 minutes)
1. `npm run dev` under `scripts/electron-lock.sh demo npm run dev`. The dock appears bottom-right; the overlay is invisible until something is drawn.
2. macOS permissions granted to the Electron binary: Screen Recording and Microphone (System Settings > Privacy & Security). A black or blank `GET /shot` means Screen Recording is missing.
3. `curl -s 127.0.0.1:7777/health` returns `ok:true`. `curl -s 127.0.0.1:7777/state` shows `phase: listening_for_name`.
4. Wi-Fi works, or `ALONGSIDE_REPLAY=hybrid` is set with a prior `ALONGSIDE_RECORD=1` run (see QA_STATUS, replay section).

## Voice and wake
- [ ] Say "Hey Marcus" in a quiet room: dock goes connecting then live within 3 s, Marcus's voice answers.
- [ ] Say "Hey Amelia" mid-session: persona switches (different voice, name in dock).
- [ ] Global hotkey starts a session from another app in front.
- [ ] Say "stop" / "goodbye": session ends, listening light returns to wake mode.
- [ ] Talk over the assistant: it stops speaking quickly (interruption).
- [ ] 20 s of silence ends the session.

## Pointing on the real screen
- [ ] "Where is the Start call button?" on the stage: ring + arrow land on it, before the voice finishes the sentence.
- [ ] Ask for something that is not there ("the purple Unicorn menu"): the assistant says it cannot see that. No ring appears.
- [ ] Overlay ring is clearly visible on a white and on a dark window, and over the macOS menu bar / Dock area.
- [ ] Overlay never steals clicks: click through the ring onto the button underneath.
- [ ] Overlay is above a full-screen app (Spaces) and follows to other Spaces.

## Lesson and Help Ladder
- [ ] "Help me start a video call": steps appear one at a time with a numbered badge; each completed step gets a green tick; a wrong click gets a spoken repair hint, not a tick.
- [ ] Finish the lesson, then start it again: the level chip moves Walk with me to Nudge me (demo mode).
- [ ] "Show me again" / "let me try" override the level.
- [ ] Teach-back question and confidence 1-5 dial appear at the end; progress view shows hints per task.

## Scam Shield
- [ ] Deliver the staged scam text (`__stage.deliverScam()` or key S on the stage), say "is this message OK?": a Checking chip appears, red flags are highlighted on the message, the assistant gives at most three short sentences and a human-help line, and never says "safe".
- [ ] Deliver a genuine text (key G): it does not shout "scam"; it says it cannot be sure when unsure.

## Trust and control
- [ ] Stop button is reachable at all times (also while the confirm dialog is open) and ends everything.
- [ ] The confirm dialog can only be answered by clicking a button with the mouse or keyboard; speaking "yes" does nothing.
- [ ] Listening light is visible while a session is active and off when not.
- [ ] Settings: Do it for me is OFF on a fresh profile; turning on Captions off hides captions in dock and overlay.
- [ ] High contrast, big annotations, dyslexia font visibly change the dock and the rings.

## Look and feel (screenshots via `GET /dock.png` and `GET /overlay.png`)
- [ ] Dock text is at least 18 px and readable at arm's length.
- [ ] No overlap between captions, chips, agent tray and the Stop button at the compact size (400 x 460) and expanded size (600 x 780).
- [ ] Annotation draws in under 1 s after the answer starts; no flicker when the same target is pointed at twice.
