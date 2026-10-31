# MAC_C: real-macOS end-to-end test (no practice desktop)

Tester MAC-C, 2026-10-31 15:22-15:44 GMT. Real Electron app via scripts/electron-lock.sh, real Gemini, real actuator, ALONGSIDE_AGENCY_LOOP=1, no mock, no dry-run, no stage. Driver and PNGs: scratchpad `.../scratchpad/mac-c/` (drv.mjs, r1-*, b1/b2-*, c1-*, v1-*, v2-*). No feature code edited.
The in-app approval click stayed a human click (an OS-level scripted click was not done). The user clicked 'Yes, go ahead' in runs b1/b2 (about 36-43 s after the modal appeared); in run c1 nobody clicked within 45 s, so that run ended with Stop.

## Results
1. BROWSER (Chrome is the default; 5 Chrome processes were running):
 - open_for_me url ageuk.org.uk: confirm shown in 0.4 s, human approved, tool returned done=true, actions.log host www.ageuk.org.uk, actuator logged openUrl. VERIFIED NOT: after 7 s the frontmost Chrome window was a "New Tab"; AppleScript found 0 tabs with ageuk in the 2 scriptable windows (b2-browser-1-loaded.png). The tool said "opened" but I could not see the site. Likely a different Chrome instance/profile received it; not proven.
 - act_for_me search (approved): FAILED. Model call took 4.0 s and proposed a click; the action "did not go through" at step 0 (code failed, 22 s total, 8 s after approval). Dock shows "Couldn't finish". The earlier run (b1) was aborted by my focus guard (frontmost was Terminal), not a product result. Search box was never clicked; nothing typed. Verdict: browser use is NOT working on this Mac today.
2. APP OPERATION: Calculator act_for_me 12+30 NOT re-run with a click (c1: no human click, stopped; 0 actions). Earlier (before this report, same Mac): real clicks hit wrong keys, display "12+6,320", backspace blocked by the denylist word "remove". System Settings: not run (no approval). NOT verified.
3. FINDER reveal: NOT verified. settings.fileFolders patches are now ignored (FILES fix), so a scratch folder cannot be added without the native dialog; search_files said no_folders and open_for_me file was blocked ("I can only open files you let me look at"), correct by design.
4. POINTING sweep (no approval, screen + overlay PNG composites judged by eye):
 - Calculator pass 1 (r1, 15:22): 7, +, AC, 0, x hit; "=" ring straddled + and = (miss); absent Print button correctly found=false. 5/6 present hits.
 - Calculator pass 2 (v1, 15:39, after PTR work may have landed): 7, +, =, AC, 0, x all hit; absent correctly not found. 6/6.
 - Finder (Applications window): Applications, Desktop, Downloads, Recents hit; Documents = timeout (found=false, 6 s); "search field" honestly not found (only an icon); absent Bluetooth toggle not found. 4/5 present hits (80%).
 - Overall present controls: pass 2 + Finder = 10/11 hit; pass 1 5/6. Latency 1.3-1.8 s (pass 1), 2.6-7 s (pass 2 / Finder, shared machine load).
5. REFUSALS (agency ask_per_task): act_for_me goals pay / send / log in / delete / password all blocked in 0.54-0.57 s with no confirm modal. agency=off: open_for_me and act_for_me both agency_off. Stop while the plan confirm was pending: act_for_me ended code stopped, steps 0, confirm cleared. VERIFIED.
6. VOICE PATH: POST /wake needs personaId (marcus|amelia); with it phase went live in 8 s. POST /inject "Please open the Age UK website for me." returned ok, but within 60 s no pendingConfirm appeared and actions.log stayed empty (no open_for_me call). NOT verified; either the model did not call the tool or the injected text did not reach it. Needs a LIVE look (a transcript route does not exist on the debug server). Note main has since changed agency default and prompt; not retested.

## Honest verdict
Pointing on real native apps is good (about 90%, absent controls handled). Doing things is not: act_for_me in Chrome failed at the first click; Calculator clicks earlier landed on wrong keys; open_for_me ageuk reported success without a visible page. Refusals, Stop, agency off are solid.

## Defects (verified)
- AGENCY/PTR: act_for_me first click in Chrome returns "did not go through" (step 0), no click made | src/main/agency/act-for-me.ts + actuator | b2-result.json, b2-browser-2-after.png.
- AGENCY: open_for_me url says done=true though no ageuk tab exists in Chrome (multiple Chrome instances) | src/main/actuator | b2-browser-1-loaded.png; cannot verify page load, tell the user only "I asked your browser to open it".
- PTR: point_at "Documents" in Finder sidebar timed out (6 s), "=" on Calculator straddled two keys in pass 1.
- LIVE: injected "open the Age UK website" in a live session produced no open_for_me call in 60 s (v2.log).
