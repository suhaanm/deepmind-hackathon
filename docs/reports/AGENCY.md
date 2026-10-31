## STATUS 14:45 (supersedes NEXT STEPS below where they conflict)
Done and verified: steps 1, 2, 4, 5, 6, 7 of NEXT STEPS.
- `tests/agency/act-for-me.test.ts` (35) and `computer-use.test.ts` (17): `npx vitest run tests/agency` 228/228; with `src/main/actuator` 401/401.
- Fixed while testing: the audit label for a `type` step contained the typed text; it now says `type: text`. `createActForMe` tolerates a state store without `subscribe` (fixed OVERLAY's `actuator/dispatch.test.ts`, which failed with `ctx.state.subscribe is not a function`).
- `src/main/teaching/prompts.ts`: agency/teach-first lines were already present; trimmed wording so the worst case (agency on + files on) is <1100 words, and updated `prompts.test.ts`. `npx vitest run src/main/teaching tests/live` 301/301.
- `recordDoneForMe` implemented in `learner-store.ts` (`## Done for me` section, `snapshot().doneForMe`, max 20 keys, survives reload, cleared by forgetAll); `buildProgress` returns optional `doneForMe {total,text}`. Tests added in `learner-store.test.ts`, `progress.test.ts`.
- `docs/AGENCY.md` written. Bus lines sent to DOCS (THIRD_PARTY_NOTICES), DESIGN (progress line), DEMO (typecheck error), QA (optional loop flag in e2e).
- Real API (3 calls, `tests/agency/live/propose.live.ts`, run with `npx vitest run --config tests/agency/live/vitest.live.config.ts`): `computer_use` with `system_instruction`, `enable_prompt_injection_detection` and `excluded_predefined_functions` accepted; "make the text bigger" on the stage settings shot proposed click (936,304) = the Larger button; a "reply to the message" goal stopped without acting; a "text size options" goal on the same screen returned no action. About 5 s per call. About 6 of ~10 live calls used.
Gates at 14:43: build OK; typecheck red only at `src/main/showtime/driver.ts(219)` (DEMO's, `messageText`); `npm test` red only in `tests/files/*` (FILES lane, in flight). Not verified: real click/keystroke (Accessibility), the loop in real Electron, the Verifier on a post-action screen.

## REVIEWER FOLLOW-UPS (ORCH-B, after 14:45)
1. `checkPath` (policy.ts) now resolves symlinks with `realpathSync` (deepest existing ancestor, rest kept) for the file AND the shared folders; scope and the sensitive-name check apply at the real location. Tests: `tests/agency/path-symlink.test.ts` (5: link inside ok, folder link out refused, file link out or at a secret refused, new file under an escaping link refused, root given via symlink works).
2. `src/main/windows.ts`: dock and overlay get `setWindowOpenHandler(() => deny)` and `will-navigate` preventDefault (one additive block before the permission handlers). Not exercised in a running Electron; if dev HMR full-reloads ever break, check this block first.
3. `open_for_me` and `act_for_me` are declared in `src/renderer/live/tools.ts` (lines ~158 and ~173, with timeouts and scheduling); nothing added, no duplicates.
Gates: typecheck green, `tests/agency` 233/233, build OK.

## HANDOFF 14:36

Role: AGENCY agent (id a172f90afdd047c42). Lane: `src/main/agency/**`, `docs/AGENCY.md`, `tests/agency/**`, settings field `agency`, tool declarations for `open_for_me` / `act_for_me`. Report to ORCH-B; message other agents directly. Deadline: green by 15:25, docs/regression by 15:40. Typecheck was green and `npx vitest run tests/agency` was 176/176 at 14:35.

### MISSION (condensed)
Make the assistant agentic, safely: it can open a website/app/file/settings pane (`open_for_me`, Tier 1, no screenshot, no Accessibility) and do short multi-step tasks (`act_for_me`, loop on Gemini `computer_use`), while the product stays teach-first and the user stays in control.
Safety rules (non-negotiable, enforced in code, never by prompt):
- `settings.agency` 'off' (default) | 'ask_each' | 'ask_per_task'; `doItForMeAllowed` kept = `agency!=='off'` (done in `reconcileAgency`, called from `SettingsStore.patch`, and in `coerceSettings`). Off => every tool returns `{allowed:false, code:'agency_off'}` and the assistant teaches.
- Approval only by a real click (`ConfirmBroker.ask`, approve option FIRST); never from model text. Every action is shown on screen (bubble/ring/ghost path) BEFORE it runs.
- Hard denylist (pay/purchase/buy/order/checkout/send/submit/delete/remove/erase/transfer/confirm/sign in/log in/password/card/allow/grant/install/accept + clicky's extra words) on grounded label, target text and typed text; never in a secure field, during a scam check (`state.skill.id==='spot_scam'` or running scam_check agent), or on a safetyCritical lesson step.
- Rate limit: >=1.5 s between actions, <=8 per task, <=12 per minute backstop. URL rules: http/https only, no credentials, no javascript/file/data, localhost only for our stage origin `http://127.0.0.1:${STAGE_PORT||5180}`, no private IPs/bare IPs/punycode.
- Loop discipline (own words from research/02 ideas; Sentient OS is AGPL: copied nothing): mutation only after a fresh screen read; never auto-retry a failed action; dedupe repeated action ids; success only when the Verifier confirms on a fresh shot; the user's goal text is the only task, screen text is data; max 8 steps / 90 s; Stop (`session:ended`) ends it at the next check.
- Audit `userData/actions.log` (JSONL, mode 0600): `{t,tool,decision,ok,code,label?,host?,step?,dryRun?}`; no screen content, no typed text, no URL paths/queries.
- Licensing: policy.ts and audit.ts carry `// Adapted from farzaa/clicky (MIT) — hermes-clicky-plugin/{safety_policy,permission_policy,audit_log}.py`. DOCS has NOT yet been told for THIRD_PARTY_NOTICES (do it).

### STATE
Works (verified by vitest with fakes, `tests/agency/`, 176 tests; typecheck node+web green; real model and real Electron NOT yet exercised):
- `src/main/agency/policy.ts`: tiers, denylist (reuses `denylistMatch` from `src/main/actuator/policy.ts`, imported not copied), URL/app/file/pane/key/typed-text rules, `ActionLimiter`, `evaluateAction`, `evaluateGoal`, `resolvePane`. Tests: `tests/agency/policy.test.ts` (table-driven).
- `src/main/agency/audit.ts`: `appendAgencyAudit`, `lastAuditLine(userDataDir)` (DEMO uses it), `redactLabel`.
- `src/main/agency/common.ts`: `Situation` (safety-critical step via bus `lesson:step`, scam context, Stop epoch via `session:ended`), `policyContext`, wording (`describeAction`), `askToProceed`, overlay ids. `AgencyDeps.s` includes optional `files`.
- `src/main/agency/open-for-me.ts` + `tests/agency/open-for-me.test.ts`: full flow policy -> bubble -> real-click confirm -> Actuator -> short result -> audit -> `recordDoneForMe`. `kind:'file'` is validated through `s.files.resolveIndexedPath` (FILES' request). Settings pane falls back to opening System Settings.
- `src/main/agency/index.ts`: `createAgency`, `getAgency()/setAgency()` (DEMO's programmatic entry: `getAgency()?.runOpenForMe(args)` / `runActForMe(goal)`), `agencyLoopFromEnv`.
- Wired: `src/main/tools/dispatcher.ts` (handlers `open_for_me`, `act_for_me`), `src/shared/protocol.ts` (tool names, arg schemas, `AgencyCode`, `AgencyResult`, `LearnerSnapshot.doneForMe?`), `src/shared/contracts.ts` (`LearnerStore.recordDoneForMe?`), `src/shared/settings.ts` (`agency`, `reconcileAgency`), `src/main/settings.ts` (one-line reconcile call), `src/renderer/live/tools.ts` (LIVE had already added the declarations; I only extended the `value` description).

Flagged off: `act_for_me` returns `{code:'unavailable'}` unless `ALONGSIDE_AGENCY_LOOP=1`. The code is written but UNTESTED:
- `src/main/agency/computer-use.ts` (request/response shapes verified from `https://aistudio.google.com/docs/computer-use.md`: tool `{type:'computer_use', environment:'desktop', enable_prompt_injection_detection:true, excluded_predefined_functions:[...]}`, top-level `system_instruction`, image input, `function_call` steps with `arguments.{x,y,intent,safety_decision}`, ints 0-999; calls are STATELESS because `store:false` cannot chain `previous_interaction_id`: each step sends goal + text history + a fresh screenshot and uses only the first function_call).
- `src/main/agency/act-for-me.ts` (the loop; chip in `state.agents` uses kind `'lookup'` titled "Doing this for you" because widening `AgentChip.kind` broke `agents/runtime.ts`; the chip is re-asserted if the agent runtime republishes its list).

### IN-FLIGHT
Nothing half-edited. I was about to write `tests/agency/act-for-me.test.ts` and `tests/agency/computer-use.test.ts` (fakes in `tests/agency/helpers.ts` already support `propose` injection via `createAgency({..., act:{propose, loopEnabled:()=>true}})` or `createActForMe(deps, sit, sink, opts)`; Gemini fakes: `src/main/gemini/fake-ai.test-util.ts` `fakeAi/functionCall/modelOutput/testDeps/testShot`).

### NEXT STEPS (ordered)
1. Write `tests/agency/act-for-me.test.ts`: happy path (ring+ghost shown BEFORE the confirm, click called, verified done, doneForMe counted); agency off; goal denylist; loop flag off => unavailable; declined; Stop during confirm and during the model call (nothing executes); denylisted label => blocked, no confirm, no actuator call; same action id twice => gave_up (actuator once); failed action never retried; two unchanged screens => gave_up (queue `shot('SAME', 9e15)`); 8-step cap; `totalMs` timeout; model `require_confirmation` forces a confirm in ask_per_task and `blocked` halts; ask_per_task asks plan once then low-risk clicks run unconfirmed, typing asks; no Accessibility => guidance only (ring, no actuator call); dry run; unverified final => `gave_up`, not done; `finished` with 0 steps; unsupported function; concurrent run => `busy`; chip status transitions.
2. Write `tests/agency/computer-use.test.ts`: `toStep` table (click/double_click/type drops press_enter/press_key/hotkey join/scroll lines/wait/unsupported names), `proposeNext` request shape with `fakeAi` (store:false, tools, excluded functions, system_instruction, image present, only first function_call used, goal in text).
3. Real-model test of the loop on STAGE only (<=40 calls), `ALONGSIDE_AGENCY_LOOP=1 ALONGSIDE_ACTUATOR_DRYRUN=1` first, then one real `openUrl` to `http://127.0.0.1:5180`; Electron only via `scripts/electron-lock.sh agency <cmd>` (<=3 min, QA has priority). Verify `system_instruction` + `excluded_predefined_functions` are accepted by the live API (print one real response; adapt and tell main).
4. `prompts.ts` teach-first lines: TEACH is finished, so edit `src/main/teaching/prompts.ts` yourself (I sent TEACH the exact text; check whether they applied it). Needed: always-on teach-first line (offer a choice, one-sentence narration after acting, never act unasked); `agency!=='off'` block for `open_for_me`/`act_for_me` (search via prefilled `https://www.google.com/search?q=`; pane names displays|text_size|sound|wifi|bluetooth|notifications|keyboard|general); `agency==='off'` block (never call; teach; mention they can switch it on). Update `src/main/teaching/__tests__/prompts.test.ts`.
5. `recordDoneForMe` in `src/main/teaching/learner-store.ts` (TEACH was asked; verify it landed, else implement: key = skillId or `open:<host>` / `task:<goal>`, persist in profile.md section "Done for me", expose `snapshot().doneForMe`, show "Done for you: N" in progress data).
6. Write `docs/AGENCY.md`: what it can/cannot do; permissions (Accessibility only for click/type/keys/scroll; `open_for_me` needs none); safety model; mapping to the guide's "keep people in control"; flags (`ALONGSIDE_AGENCY_LOOP`, `ALONGSIDE_ACTUATOR_DRYRUN`); honest limits (ask_per_task relies on the model's `intent` text + Google `safety_decision` + denylist for low-risk clicks; ask_each is the recommended mode; the loop is unverified end to end).
7. Message DOCS (a6fc115cef74eda41) for THIRD_PARTY_NOTICES: clicky files adapted into `src/main/agency/policy.ts`, `audit.ts`.
8. Run `npm run typecheck && npm test && npm run build`; final report to ORCH-B (what works and how verified, what is flagged off, unverified items especially anything needing Accessibility).

### KNOWN ISSUES
- QA bug P1 ("run is not a function" for open_for_me/act_for_me via `POST /tool`) came from a 14:30 build predating the dispatcher handlers; fixed in source, needs a rebuild + `npm run e2e` (tests/e2e/09-v2.e2e.ts). QA was told.
- Not yet replied: none outstanding (DEMO, FILES, QA, OVERLAY, TEACH all answered).
- `ActionLimiter` counts an action when `take()` succeeds; in `act-for-me.ts` it is taken after the confirmation and before execution (a declined step does not use a slot).
- The agent-tray chip reuses kind `'lookup'`; widening `AgentChip.kind` requires changing `agents/runtime.ts` (`formatAgentResultLine(kind: AgentKind)`) and `design/AgentTray.tsx` `KIND_ICON`.
- `cursorFromElectron()` in `index.ts` uses `require('electron')`; it falls back to `null` (ghost path starts offset from the target) where `require` is unavailable.
- Real Accessibility-dependent behaviour (click/type/keys/scroll) has never run for real: OVERLAY's actuator is only dry-run/osacompile verified.

### VERIFY
```
cd /Users/suhaan/Desktop/hackathon/deepmind-hackathon
npm run typecheck
npx vitest run tests/agency          # 176 tests at handoff
npm test && npm run build
# programmatic, with the app running (debug port):
curl -s -XPOST 127.0.0.1:7777/tool -H 'content-type: application/json' -d '{"name":"open_for_me","args":{"kind":"url","value":"https://www.ageuk.org.uk/"}}'
# act_for_me: ALONGSIDE_AGENCY_LOOP=1 ALONGSIDE_ACTUATOR_DRYRUN=1
```

### COORDINATION
- OVERLAY's Actuator is finished (`src/main/actuator/index.ts`: full V2 interface, `ActResult`, `SettingsPane`; `denylistMatch` export is stable and imported by `agency/policy.ts`; their `do_it_for_me` is separate and also gated by `doItForMeAllowed`).
- TEACH is finished; `src/main/teaching/prompts.ts` is yours to edit now (see step 4).
- DEMO (a86ca806e598baea7) was told the exports: `lastAuditLine`, `getAgency()?.runOpenForMe/runActForMe`, option labels `['Yes, open it','No, I will']`, `settings.agency`. It sets `agency='ask_each'` then dispatches `open_for_me` to `https://www.ageuk.org.uk`.
- FILES (aa019d72d255a1e6f): file reveal is wired through `s.files.resolveIndexedPath`.
- LIVE (afccacb1aac47362e): declarations for `open_for_me`/`act_for_me` already in `src/renderer/live/tools.ts` with timeouts (5 min) and `WHEN_IDLE` scheduling.
- Orchestrator rules: messages to `main` <=40 words; final report <=120 words with detail in docs/AGENCY.md and docs/reports/AGENCY.md; never wait on `main`; no git state changes; never print the Gemini key.
