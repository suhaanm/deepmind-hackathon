# QA status (living document, owner: QA)

Clock: freeze 15:10 GMT, submission 15:40. Times below are GMT. "Verified" means I ran it; anything else says UNVERIFIED.

## Quality gate

| Gate | Result | Last run |
|---|---|---|
| `npm run typecheck` | PASS | 13:34 |
| `npm test` (vitest) | PASS, 15 files / 272 tests | 13:34 |
| `npm run build` | PASS | 13:34 |

## P0 acceptance matrix

Legend: PASS / FAIL / PARTIAL (works with mocks only) / UNVERIFIED (not run yet).

| # | Criterion | Status | How verified | Last run |
|---|---|---|---|---|
| 1 | Wake / hotkey / button starts a session (`POST /wake` -> phase connecting) | UNVERIFIED | e2e `lifecycle` | - |
| 2 | `point_at` lands on the correct target on the real screen | UNVERIFIED | accuracy harness (`docs/QA_ACCURACY.md`), needs real Grounder + real Capture | - |
| 3 | Verification tick shown on a completed step; repair hint on a wrong step | UNVERIFIED | e2e `lesson` | - |
| 4 | Level chip fades Walk -> Nudge over two clean attempts in demoMode | UNVERIFIED | e2e `lesson` (two `video_call` attempts) | - |
| 5 | Captions and a working Stop | UNVERIFIED | e2e `lifecycle` + dock.png | - |
| 6 | Scam Shield highlights red flags; says "can't tell" honestly when unsure | UNVERIFIED | e2e `scam` | - |
| 7 | `spawn_agent` chips appear and complete | UNVERIFIED | e2e `scam` | - |
| 8 | Settings toggles take effect | UNVERIFIED | e2e `settings` | - |
| 9 | `doItForMeAllowed` defaults to false | UNVERIFIED | e2e `settings` | - |
| 10 | `ask_user_confirm` resolves only on a real answer (never from model text / `/inject`) | UNVERIFIED | e2e `trust` | - |
| 11 | Screenshots carry `store:false` | PARTIAL: static PASS (`src/main/gemini/client.ts` forces `store:false` on every `interactions.create`); runtime request-body check pending real run | grep + e2e `08-privacy-spend` (fetch probe reads the real request body) | 13:50 |
| 12 | No secrets in logs / repo / renderer bundles / `/state` | PASS (mock run, app log + userData + out/ + repo + /state + /health scanned for key shape and the real key value) | e2e `07-security` | 13:50 |
| 13 | Debug server binds 127.0.0.1 only and rejects `Origin` / foreign `Host` | PASS (lsof shows 127.0.0.1 only, Origin and foreign Host give 403, LAN address refused) | e2e `07-security` | 13:50 |
| 14 | Failure paths: Architect timeout -> static plan, grounder `found:false` -> "can't see that", API error -> plain-English error, no stack traces | UNVERIFIED | e2e `failures` (real services only) | - |

## Open bugs

None filed yet.

## Notes

- e2e launches Electron only through `scripts/electron-lock.sh QA ...`.
- Services still on mocks as of 13:35: grounder, verifier, architect, scam, router, runner, teaching, learner, levels (see `src/main/services.ts`). Real: capture (stub), overlay, live bridge, agents wire.
