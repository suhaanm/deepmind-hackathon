# WAKE report (voice activation, hotkeys, preflight, demo launcher)

Full detail lives in `docs/WAKE_SPIKE.md` (decision, measurements, matcher trade-offs, rename checklist, stage-day checklist, verification log). This is the index.

## Shipped
- **Wake spotter** `src/renderer/wake/` (`index.ts` is the public surface): `gemini-3.5-transcribe-live` streaming keyword spotter, alias/phonetic matcher driven only by `wakePhrases`/`wakeAliases`, 3 s pre-roll (`takePreroll()`), single-mic-owner pauses (`live`, `tts`, `muted`, `disabled`, `push-to-talk-only`), rotation before the 10-minute cap, backoff, self-recovery every 20 s, plain-English `WakeStatus.detail`. Web Speech in Electron is dead (silent, no events) and is not shipped.
- **Hotkeys** `src/main/hotkey.ts`: start Cmd/Ctrl+Alt+Space (+2 fallbacks), stop Cmd/Ctrl+Alt+M (+1). Start ignored while a session runs. Force Quit and input-switch combos deliberately not bound.
- **Preflight** `npm run preflight` (`scripts/preflight.mjs`, `scripts/preflight-probe.cjs`): about 3 s, exit 1 on red, key never printed. Covers key + models, latency, Live smoke, wake stream, permissions, real screen grab, hotkeys, stage server, seed, git-ignore of `.env`.
- **Demo launcher** `npm run demo` (`scripts/demo.sh`): stage server, seed with backup, demoMode, preflight, cheat sheet, then `npm run dev`. Flags after `--`: `--keep-profile`, `--accurate`, `--force`, `--no-app`.

## Evidence (31 Oct, real key, synthetic speech)
- Matcher: 0 false or wrong fires over 97 recorded transcript streams; 0 wakes in 10 live non-wake clips.
- Live e2e: 7/7 positives, 10/10 negatives on the final run; latency about 0.5 to 0.7 s after the name (outlier 1.7 s).
- 12-minute cap test: rotation at 573 s, wakes at 32 s and 692 s, no drop.
- Real renderer capture path verified in Electron with a synthesised MediaStream.
- Preflight: 13 ok, 1 warn (voices TBD), 0 red. Demo launcher run headless under the lock: app up in about 6 s.
- Tests: 80 wake tests pass. Typecheck for my files is clean; two errors currently come from `src/main/tools/dispatcher.ts` and `src/main/tray.ts` (not mine).

## Unverified
Real human voices and rooms; physical key presses (Cmd+Alt+Space may be claimed by Finder search); the spotter with a real microphone inside the full app; the presenter's own terminal permissions (preflight must be run from that terminal).

## Notes for others
- `wake:token` handler in `src/main/ipc.ts` logs a full stack when minting fails; a try/catch rethrowing a short error would quiet it.
- LIVE was asked to clear `lastError` in `dock/controller.ts` when the spotter leaves `unavailable`.
- With another agent holding the Electron lock the preflight probe waits up to 30 s.
