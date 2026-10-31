# DOCS report

## STATE (14:50 GMT)
- `THIRD_PARTY_NOTICES.md`: added `src/main/agency/policy.ts` (clicky `hermes-clicky-plugin/safety_policy.py`, `permission_policy.py`) and `src/main/agency/audit.ts` (`audit_log.py`); intro now mentions the Python plugin rules. 16 `Adapted from` files in `src` (11 clicky, 5 Gemini Live example), all listed. `grep -ri sentient src` returns nothing; the Sentient OS (AGPL) entry says so.
- `README.md`: added first-run setup, chat/look/menu bar, agency (off by default, `act_for_me` flagged off, nothing real-clicked yet) and files (off by default, text goes to Gemini for embeddings) to What it does, Trust, Limitations, Quickstart (onboarding on a fresh profile, debug surface opt-in), commands, flags, repo map, credits.
- `docs/ARCHITECTURE.md`: 14 Live tools, a V2 table with verified/unverified per piece, agency control flow, trust additions, `ALONGSIDE_DEBUG` opt-in, new flags.
- `docs/DEMO_SCRIPT.md`: settings row (agency off, files off, onboardingDone true), fresh-profile onboarding warning, a "V2 features not in the timed script" paragraph, updated control answer.
- `docs/SUBMISSION.md`: revised clock (15:25 / 15:40 / 15:50), notices count, V2 honesty items, two local commits.
- New `docs/FILES.md` (search.ts already referenced it). `docs/AGENCY.md` (AGENCY's) read and consistent with `docs/reports/AGENCY.md`.
- Bus lines sent: DEMO (SHOWTIME.md), QA (stale QA_STATUS), ORCH (flags missing from .env.example). Bus `@DOCS` line from AGENCY: done.

## Verified-vs-unverified I rely on
Agency: 228 tests, 3 real computer_use calls; `act_for_me` off unless `ALONGSIDE_AGENCY_LOOP=1`; no real click/key. Actuator: 173 tests, never real. Files: 66 tests, no real-window or fresh real-key run. Onboarding: 30 tests + gallery, no real window. Shell/tray: 22/22 real run. Showtime: no report, not wired in `src/main/index.ts` at 14:48, no `docs/SHOWTIME.md`.

## NEXT STEPS (final pass 15:30-15:40, after the 15:25 freeze)
1. Re-read `docs/QA_STATUS.md` and `docs/reports/*.md` (esp. DEMO, FILES, AGENCY, QA); update README/ARCHITECTURE/DEMO_SCRIPT claims to match. Delete or soften anything a report does not back.
2. Showtime: if `docs/SHOWTIME.md` and a DEMO report exist, describe it (scripted, badge); else keep "not described as working".
3. Re-run `grep -rn "Adapted from" src` (expect 16, or more if a lane added files) and `grep -ri sentient src`; add any new file to the notices table.
4. Re-check README paths/links (`npm run submit-check -- --fast` rules: backticked `docs|src|tests/...` paths must exist) and the stat figures against Age UK / Good Things Foundation if the user wants them re-opened.
5. Open points for the user: LICENSE, team names, repo public, demo video, event form fields (see `docs/SUBMISSION.md`).
