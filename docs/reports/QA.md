# QA report (living; last update 14:50 GMT, final regression pending 15:25-15:40)

## Final regression 15:23-15:26 (full table in docs/QA_STATUS.md)
- typecheck PASS; build PASS; vitest 1 failed / 1393 passed / 27 skipped (`tests/agency/act-for-me.test.ts:194`, routed to AGENCY); secrets scan 0 files; submit-check PASS 10 / WARN 3 / FAIL 1 (the vitest row); preflight network rows OK, 4 macOS rows unchecked because other roles held the Electron lock (not real failures).
- No real-macOS pointing/agency run by QA; mock/stage numbers below are practice-desktop tests only.

## Done
- SECURITY P1: the unauthenticated debug server (127.0.0.1:7777) now starts only with `ALONGSIDE_DEBUG=1` (`src/main/index.ts`, previously every unpackaged build). `scripts/electron-lock.sh` exports it (covers e2e, preflight probe, overlay/tray/live harnesses that go through the lock); `tests/e2e/run.mjs` sets it explicitly; `scripts/demo.sh` does not. Verified on real headless launches under the lock: without the flag the port refuses connections, with it `/health` returns 200. Docs touched (minimal): `.env.example` comment, README line 158, `docs/MANUAL_TESTS.md` (curl checks need the flag).
- Consequence: a plain `npm run demo` has no debug surface, so `curl :7777/shot` on the demo laptop needs `ALONGSIDE_DEBUG=1 npm run dev`. `npm run preflight`'s "already running" row can no longer see a demo instance (harmless).

## Update 14:50
- typecheck PASS, build PASS. vitest: 2 failures in `src/main/showtime/service.test.ts` (DEMO, routed). e2e mock: 7 files passed, 61 passed, 24 skipped (real-only), 08-privacy-spend 1 passed / 1 skipped; secrets scan clean (FILES fixed the literal).

## Verified at 14:45-14:50 (earlier run)
- `npm run typecheck`: PASS. `npx vitest run`: 63 files passed / 7 skipped, 1314 tests passed / 27 skipped. `npm run build`: PASS.
- `npm run e2e` (mock, headless): 59 passed, 25 skipped, 1 failed of 85. The failure: `07-security` secrets scan flags `tests/files/text.test.ts:26`, a synthetic `AIza...` literal (30+ chars). Checked: it is not the real key value. Routed to FILES on bus.md.
- `09-v2` alone (mock): 11 passed, 2 skipped. Skips: `act_for_me` confirmation (needs the real computer_use loop, `ALONGSIDE_AGENCY_LOOP=1`; not run, optional) and `showtime` ("showtime API not exposed yet").
- Live API calls used by QA in this session: 0.

## Open
- FILES: secrets-scan literal (above).
- Real desktopCapturer, spoken wake word, global hotkey: still need a person (`docs/MANUAL_TESTS.md`).
