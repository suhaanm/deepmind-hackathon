# AGENTS report (src/main/agents/**)

## What it does
`spawn_agent{kind,task,payload}` returns `{agentId}` at once. A chip shows in the dock tray (running, then done, error or cancelled). The result is injected to the Live model as `[AGENT_RESULT kind=… id=… status=…] …`. Kinds: `scam_check`, `lookup`, `lesson_summary`. There is no other kind.

## Public API
- `createAgents(deps)` in `index.ts` returns the shared `AgentRuntime` plus `clearHighlights()`, `cancelAll()` and `dispose()`.
- `createAgentsFromServices(ctx, s)` in `wire.ts` is the only wiring. It is the `s.agents` line in `services.ts`.
- `wire.ts` also listens to the bus: `clear_annotations` clears highlights, and `session:ended` with reason `stop` cancels agents.

## Behaviour
- Concurrency cap 3; the 4th spawn gets a plain refusal. Timeouts: 30 s default, 60 s for scam_check. Cancel uses AbortSignal.
- Errors become one plain sentence. No stack trace, key or raw message reaches a chip or the model.
- scam_check:
  - Dictated text is analysed as text. Otherwise the analyst reads the screenshot directly, with no OCR step.
  - The spoken result is injected as soon as the ScamReport exists (`scope.announce`). Highlights follow, one per located phrase (max 5 grounder calls in flight, `precise:true`).
  - A long phrase may wrap onto a second line. It gets a wrap hint, then falls back to two half-phrase groundings.
  - The advice bubble is drawn once all groundings finish, or after 5 s at most.
  - Highlights expire after 25 s each. They are also cleared on clear_annotations, Stop, cancel and error.
  - Analyst stages (`onProgress`) accumulate into the running chip summary.
  - The summary is at most 3 short sentences, ends with the human-check line, and never says "safe". Text aimed at an AI becomes a red flag and is never obeyed.
  - Scam Shield off means a polite refusal.
- lookup: `gemini-3.8-flash` with `google_search`, store:false. It returns at most 5 short steps plus the source host. The summary says "could not confirm" when grounding found nothing.
- lesson_summary: needs carerSharing on. It writes a deterministic `.md` summary (no model call) to `userData/exports/`.

## Read-only guarantees in code
- Each kind gets only its own narrow ports. There is no send, buy, click, type, submit or speak port.
- Only the runtime calls `LiveBridge.inject`.
- The model port allows only `google_search` and store:false.
- Exports are `.md` files directly inside `exports/`.
- Text from messages and web results is sanitised (no brackets or control characters, no reassurance words).

## Measured (real services, demo-stage `#messages/scam`)
- Spoken result 10.4-11.2 s after spawn. Typically 3-4 highlights by 15-16 s and all 5 by about 19 s.
- Highlight accuracy 4/4 in the earlier full runs. Boxes enclose the right text; wrapped phrases get loose two-line boxes.
- Before the early-announce change, total time was about 30 s.

## Tests
75 tests in `src/main/agents/*.test.ts`, including the dispatcher, StateStore and Bus path in `wire.test.ts`. Full `npm test` last run: 920 passed, 2 failed in other lanes (Live tool declarations and teaching prompts), none in agents.

## Open
- The in-app Electron smoke with the real analyst was blocked by the busy electron lock. QA e2e covers it.
- The link specialist in SERVICES' analyst can hit its 5 s cap. SERVICES was asked to shorten it.
- `AgentResult` has no `unverified` or `path` field. Both are carried in the summary text.
