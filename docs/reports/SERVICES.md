# SERVICES report (src/main/gemini/**, spikes/grounding/**, fixtures/scam, fixtures/safety)

Full numbers: `docs/GROUNDING_AB.md` (grounding A/B, tuning, STAGE, latencies) and `docs/SAFETY_REVIEW.md` (injection, privacy, failure honesty).

## What it does
Five model-backed services behind `src/shared/contracts.ts`, wired in `src/main/services.ts` (mocks still available per service). All calls go through one path (`callModel` in `client.ts`): `store:false` forced, hard timeouts enforced by a race, typed errors with plain-English messages, redacted logging.

| Service | Models | Notes |
|---|---|---|
| Grounder | flash-lite (fast) then flash on not-found, low confidence or error; flash only for `precise` or the `accurate` preset; `computer_use` dry-run as last fallback | 6 s cap returns `found:false` reason `timeout` and keeps running to warm a 30 s cache; `prefetch`, `invalidate`; always sets `label`; rejects boxes over 50% of the screen |
| Verifier | flash-lite, flash, Argon only on a low-confidence dispute | unsure is `uncertain:true`, never a tick |
| LessonArchitect | Argon, thinking low, at most 4 steps, hedged second request at 7 s, 15 s hard cap | with a screenshot, step 1 is grounded and re-planned once if not visible; safetyCritical forced on risky steps in code |
| ScamAnalyst | 3 flash specialists (link, wording, sender) in parallel, then Argon (medium) synthesis; deterministic conservative merge on failure | verbatim red-flag phrases, never "safe", always a human check, never `likely_genuine` on fallback; injected AI-directed text is flagged and lifts the verdict to at least suspicious; `onProgress` messages |
| Router | flash-lite; regex fast path for stop | keyword fallback on any failure |

## Switches and wiring
- `ALONGSIDE_GROUNDING_PRESET=fast|accurate` (default fast). Logged at start-up and per call.
- `precise:true` on `ground()` for safetyCritical steps and scam-phrase highlighting (callers: TEACH, AGENTS).
- Contract additions (additive): `Grounder.ground({precise?})`, optional `prefetch?`/`invalidate?`, `ScamAnalyst.analyze(req, {onProgress})`.
- No key: the services still start and answer honestly ("it isn't set up yet"); nothing crashes.

## Measured (live)
Grounder fast p50 1.2 s, p95 1.7 s (95% UI, 94% effective with phrases on the precise path); accurate p50 3.4 s, p95 6.8 s. Verifier about 1 s. Router 0.8 s. Architect plan() p50 8.9 s, p95 12.5 s. ScamAnalyst p50 about 10 s, p95 about 13 s, 20 of 20 on the scam/genuine fixtures.

## Tests
`npx vitest run src/main/gemini` (142 pass, live tests gated by `RUN_LIVE=1`): unit tests with a fake AI that honours abort signals, safety and privacy tests including a wire-level `store:false` check and a whole-app probe, plus gated live suites (grounding on STAGE, scam fixtures, architect latency, adversarial injection matrix).

## Known limits
Accuracy was measured on synthetic UIs, STAGE and four public pages, not the user's real desktop; fast-preset grounding is weaker than flash on dense real UIs; scam fixtures are author-written; Live-voice injection and the actuator tools were not reviewed; `ctx.log` in `src/main/index.ts` is not redacted (see SAFETY_REVIEW).
