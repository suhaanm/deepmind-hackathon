# FILES report

## STATE
- Backend (src/main/files/**): consent (native dialog only, home/Library/.ssh refused, real paths), extract, chunk, indexer, local index in userData, Gemini embeddings (gemini-embedding-2, 768-d) with BM25 keyword fallback, search (<= 3 snippets, injection flag, wrapped as untrusted data), rate limit, IPC `files:*`.
- Wiring (verified present): `search_files` declared in src/renderer/live/tools.ts, handled in src/main/tools/dispatcher.ts; `registerFilesIpc` called from src/main/ipc.ts (registerIpc, invoked by src/main/index.ts); `createFiles` in src/main/services.ts; preload `files` API; state.files progress.
- Fixed the red tests: the search score cut-offs (0.56/0.64) are calibrated for real embeddings, so the 64-d hash fake scored below them. `Embedder` gained optional `thresholds`; the test fake uses 256-d with {min 0.2, weak 0.35}. Production defaults unchanged.
- New UI: src/renderer/dock/files/ (FilesSection, describe, tests), mounted via the existing `files` slot in Panel with one additive edit to src/renderer/dock/App.tsx. Off by default (filesEnabled=false); switch, Add a folder, Remove, Refresh, Forget my files, plain-English status.

- Real-Mac defects fixed (15:10 GMT): (1) redact.ts now removes lines naming account number / sort code / IBAN / SWIFT / BIC, plus bare 8-digit numbers, dd-dd-dd sort codes and IBANs; `REDACT_VERSION=2` is stored in meta.json and `IndexStore.load()` deletes an index from older rules (stale snippets gone on next start). (2) `fileFolders` is stripped from renderer settings patches (src/main/ipc.ts) and from debug POST /settings (src/main/debug-server.ts); status.folders hides refused folders (/, home, .ssh) but keeps ones that went missing. Tests added in text/indexer/service tests.
- DOCS asked via bus to update docs/FILES.md item 3.

## NEXT STEPS
- Not yet visually checked in Electron (no electron hold taken).
- Optional: one live embedding smoke with the real key (<= 10 calls) to re-confirm thresholds.
- docs/FILES.md is referenced by a comment in search.ts but does not exist (DOCS lane).

## KNOWN ISSUES
- Files section styling uses inline styles and existing al-* classes; not reviewed by DESIGN.
- Onboarding does not offer the files switch.

## VERIFY
- `npm run typecheck` clean; `npx vitest run tests/files src/main/files src/renderer/dock/files` 66/66; files tests 70/70; `npm test` 1367 passed, 1 failed (src/main/teaching/__tests__/prompts.test.ts word-count, not FILES lane); `npm run build` ok.
