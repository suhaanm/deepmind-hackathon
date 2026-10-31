# Launch video SPEC (shared contract, written by the orchestrator). 1920x1080, 30 fps, ~60 s. Deterministic, scripted, no live model flows.
Persona placeholder name in the video: **Marcus** (assistant). User: an older adult called "Margaret" (never shown on screen).
Palette/design: use the REAL product design language (see media/kit/ once ready, else src/renderer/design/** tokens): calm teal accent, glass panels, rounded, small tight rings.
Cursors: USER = classic macOS arrow + white soft ripple. ASSISTANT = rounded teal ghost cursor with small name tag "Marcus" + teal ring pulse.

## Timeline (t in seconds, final video time)
| id | t | what | voice line (exact text) |
|----|---|------|-------------------------|
| S0 | 0-3 | kinetic title: "Every assistant wants to be needed." then "This one wants to be fired." | (music only) |
| S1 | 3-9 | user speaks, waveform pill, big calm caption | USER: "Hey Marcus, help me apply for a job at Google DeepMind." |
| S2 | 9-14 | assistant answers; browser window appears on the careers page | ASST: "Of course. I'll open the careers page for you." |
| S3 | 14-24 | assistant cursor clicks "View open roles", types "research engineer" in search, results list appears (3 actions, "Done for you: 3") | ASST: "Now I'll look for roles that match you." |
| S4 | 24-34 | ring on the Apply button of a role; assistant hands over; USER cursor clicks it; chip -> "By you: 1" | ASST: "This last step is yours. I never submit applications for you. Go ahead and press Apply." |
| S5 | 34-48 | email scene: recruiter-style email arrives (staged local page), Scam Shield boxes: "Asks for money", "Rushing you", "Fake address" | USER: "Marcus, is this email okay?" ASST: "I'd be careful. It asks you to pay a fee and rushes you. Real recruiters never do that. Please don't click the link." |
| S6 | 48-56 | progress panel: task "Apply to Google DeepMind", Step 3 of 3, level words Showing -> Guided -> Nudges, "Done for you 3 · By you 1" | ASST: "Next time, I'll only nudge. That's the point." |
| S7 | 56-62 | end card: product placeholder + "It tries to get fired." | (music resolves) |

## File contracts
- audio3/: `vo_<id>_<n>.wav` per line, `sfx_tick_user.wav`, `sfx_tick_bot.wav`, `sfx_whoosh.wav`, `bed.wav` (pad, 62 s), `master.wav` (mixed, -16 LUFS), `cues.json` = [{id,speaker,text,start,end}] in FINAL video time.
- footage3/: `careers.mp4` (1920x1080 30fps real DeepMind careers page, scripted scroll/clicks), `careers-rects.json` (per event: {t, kind:'click'|'type'|'hover', label, x,y,w,h} in video px, t relative to clip start), `email.mp4` + `email-rects.json` (staged mail client page, flag phrase boxes).
- kit/: `overlay-kit.html` + `kit.css` + `svg/` = pixel-faithful ring, label chip, caption pill, ghost cursor, user cursor, level chip, progress panel, glass dock/pill, copied in look from src/renderer/** (read-only).
Nothing may be written inside the repo. No git state changes. Never print .env or the key.

## Corrections from the product owner's orchestrator (16:00) - these override the table above
- Level words are the REAL ones: "Watch me" / "Walk with me" / "Nudge me" / "On my own" (chip text: "Help level N of 4 - <label>"; step text "Step N of M"). Use Watch me -> Walk with me -> Nudge me in S6, NOT Showing/Guided.
- The UI is changing: the dock panel is HIDDEN by default; a macOS MENU-BAR item shows the state (Listening / Live / Working... / Muted) and toggles "Show panel". Permission prompts appear as a TOP-RIGHT TOAST titled "Alongside needs your OK" with two big buttons (+ a macOS notification), not a dock modal. Exact strings: docs/reports/NOTIFY.md and SHELL2.md (expected ~16:10-16:15, read them when they exist).
- Honest scope: verified on a real Mac = careers page -> "View open roles" -> job list (6 audited steps). The video may NOT show the assistant opening a single role, applying, signing in, entering details or submitting: those are done by the USER (guided by ring + voice). S3 therefore = open page, click View open roles, search box typing, results list; S4 = ring on the Apply button of a listed role, user clicks. Approval = a human click on the toast (show a user cursor clicking it once, S2/S3 boundary).
- The email page is STAGED (local mock mail client). Do not imply it reads the user's real mail. Scam check was verified on the staged message with real Gemini.
- Everything in the video is deterministic and scripted; overlays must match the product's real annotations and design system (tight small rings, label chip, 16px frosted caption pill, ghost cursor with persona name tag, glass).
- Deadline: first full cut at 16:18 GMT. Parallel lanes: AUDIO, FOOTAGE, KIT (helpers) + VIDEO3 (assembler/motion design).
