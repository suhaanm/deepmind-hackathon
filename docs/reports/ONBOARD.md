# ONBOARD report

Onboarding flow lives in `src/renderer/dock/onboarding/**` (9 screens, skippable, keyboard and screen-reader friendly, mounted in `dock/App.tsx`). Web typecheck green, 30 onboarding unit tests green, renderer build green at 14:34. Not verified: a real Electron window, real macOS permission prompts.

## HANDOFF 14:36

### MISSION
Calm, short, skippable get-to-know-you flow that also grants every permission and lets the user shape the look. One idea per screen, one short line, large type, big buttons, visible "Skip for now", progress, Back, Re-runnable from Settings "Set up again". Writes preferences through the settings patch and the answers into profile.md (revision-safe). `onboardingDone=true` at the end or on skip. No names or details leave the machine beyond normal model context. Deadline: green by 15:25.

### STATE
Done and verified (gallery PNGs read at 380px in light, dark, high contrast light and dark, dyslexia font, big text; an interactive run through all 9 screens in headless Chrome inspected `window.__log`; vitest):
- Screens (order): hello, about (name + help topics), style (comfort 5 steps + gentle/quick), comfort (live sample, text size, dyslexia font, high contrast, words instead of talking, voice speed), look (self-contained glass preview, theme, glass on/off, "how solid" slider), helper (PERSONAS cards), permissions (live status chips, one action per row, mic level meter "Test it", Check again, hint line, Restart note), hands (agency: off / ask_each / ask_per_task, files switch with disclosure, calls files.addFolder), ready (Hey <persona>, hotkey from hotkey.ts constant, menu bar, Chat). 9 screens, not 8: "About you" split in two for one idea per screen.
- State machine and mappings: `flow.ts`. Persistence: `persist.ts` (settings patch live on every change; name saved on leaving its screen; profile lines saved after the style screen and at finish; re-run replaces only lines it owns; stale revision retried 3 times; finish always sets onboardingDone even if the profile write fails).
- Permissions model: `permissions.ts` (SHELL's real API, with a browser fallback). Resume after restart: `resume.ts` (localStorage step).
- Mount: three additive edits in `src/renderer/dock/App.tsx` (import, `onboarding = !settings.onboardingDone` forces panel open and renders the flow instead of Panel/Pill, shell view 'permissions' -> `requestOnboarding({step:'permissions'})` + `onboardingDone:false`). DESIGN's MoreExtras `onSetUpAgain` (sets onboardingDone:false) works as "Set up again".
- Exports (`./onboarding`): `OnboardingFlow`, `requestOnboarding`, `useOnboardingRequested`.
- Tests: `flow.test.ts`, `persist.test.ts` (real TeachingLearnerStore behind a fake IPC, conflicts, idempotence), `permissions.test.ts`. A drift test checks the hotkey constant against `src/main/hotkey.ts`.
- Gallery: `gallery.html` + `gallery.tsx` (query: `variant=light|dark|hc|hcdark|dyslexia|big|glass`, `only=<step index>`, `perm=mixed|none|restart`, `opacity=0.NN`). Built with a throwaway vite config (see VERIFY).

### IN-FLIGHT
Nothing half-edited. Last edits: `OnboardingSettingsPatch` now equals `SettingsPatch` (agency/filesEnabled landed in settings.ts), blank-line tidy in `applyProfileLines`.

### NEXT STEPS
1. One short real-window check under `scripts/electron-lock.sh ONBOARD` once QA releases (<=3 min): fresh `ALONGSIDE_USERDATA`, walk all screens, confirm the dock is transparent-friendly with glass on, confirm Skip and Start collapse the dock.
2. DONE 14:38: `steps.tsx` now types `getFilesApi()` from `AlongsideApi['files']` (no local interface). Web typecheck clean, 30 onboarding tests pass, `npm run build` ok. The `controls.tsx` typecheck error from main did not reproduce at 14:37 (web typecheck printed nothing). Bash was intermittently denied during this session.
3. Confirm with a real permission run: mic prompt, Screen Recording prompt via `requestScreen()`, the restart note, accessibility prompt.
4. Debounce the glass slider patches (one settings write per tick today) if it feels heavy.
5. Optional: a real voice sample on the helper cards (skipped: not available).
6. Optional: a safe on-screen "Test it" ring for screen recording via point_at (skipped on purpose; dispatcher refuses when asleep).
7. Add a short "Set up again" and onboarding section to docs/DESIGN.md or MANUAL_TESTS.md (not in my lane; ask DOCS).

### KNOWN ISSUES
- A fresh profile always shows onboarding and forces the dock open until finished or skipped (`onboardingDone` defaults false). Tests or demos on a fresh `ALONGSIDE_USERDATA` need `onboardingDone:true` first (POST /settings {patch}).
- Topics, comfort and name typed before a restart are saved to profile.md/settings at the style screen, but answers on the current screen at restart time are lost.
- Persona colour: there is no separate accent setting, so colour follows the helper chosen on the next screen (the look screen previews the current persona's accent).
- Hotkey label is a constant in `flow.ts` (hotkey.ts imports Electron so a renderer cannot import it); the test keeps it in step.
- Unrelated failing tests at 14:34 belong to other lanes (`actuator/dispatch.test.ts`, `teaching/__tests__/prompts.test.ts`).

### VERIFY
```
cd /Users/suhaan/Desktop/hackathon/deepmind-hackathon
npx tsc --noEmit -p tsconfig.web.json          # web typecheck (npm run typecheck also runs the node project, which another lane may break)
npx vitest run src/renderer/dock/onboarding     # 30 tests
npm run build
# gallery (needs a vite config with the react plugin; root = src/renderer/dock/onboarding, entry gallery.html), then:
python3 -m http.server 8765 --directory <outDir> &
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --screenshot=out.png --window-size=1190,1900 --virtual-time-budget=4000 "http://localhost:8765/gallery.html?variant=dark"
```

### COORDINATION
- SHELL: permissions IPC finished and used as-is (`status`, `requestMicrophone`, `requestScreen`, `requestAccessibility`, `openSettings`, `relaunch`, `onChange`); tray 'Set up again' patches onboardingDone:false; 'Permissions...' handled in App.tsx via `requestOnboarding({step:'permissions'})`.
- AGENCY: `agency` setting is in settings.ts and written by the hands screen.
- FILES: `window.alongside.files.addFolder()` called after the user ticks the switch; `filesEnabled` patched only on `ok`; `fileFolders` never patched by me.
- DESIGN: settings fields and `applyDesignSettings` (theme, glass, textScale) apply live; my root is transparent so their glass shows. The old `design/Onboarding.tsx` is unused now.
