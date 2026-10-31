# RENDER report: Showtime narration clips

## Result
- `npm run showtime:render` (scripts/showtime-render.mjs) renders `assets/showtime/script.json` into `assets/showtime/clips/<id>.wav` plus `manifest.json`.
- 41 of 41 lines rendered (final script), no failures. 229.9 s of audio in total.
- Voices: Charon for marcus (35 lines), Sulafat for amelia (6 lines: c5-1, c5-2, c6-1, c6-2, c6-3, c6-tech). `personas.ts` still says `TBD`, so the script uses the same fallback as the Live controller. A real `voiceName` there is picked up automatically (a changed voice re-renders that persona's lines).
- Model `gemini-3.8-flash-tts` through the Interactions API (`client.interactions.create`, `response_format` audio `audio/l16` 24 kHz, `generation_config.speech_config: [{voice}]`, style in a `speech_metadata` annotation). Verified live; the model id is not in `src/shared/models.ts` yet (script reads `MODEL_TTS`, default as above). Suggest main adds `tts: env.MODEL_TTS || 'gemini-3.8-flash-tts'`.
- Style string (one short constant, per the TTS prompting guide): "calm and warm, clear and steady, at a natural conversational pace". Probing showed "unhurried" or "slowly" made lines 15 to 30 percent longer than the script slots, so the pace is about 140 wpm, the calm end of conversational. Changing `STYLE` needs `--force`.

## Format
Mono 16-bit PCM at 24 kHz, wrapped in a 44-byte RIFF header by the script. `manifest.json` is `{generatedAt, model, lines: {id: {file, persona, voice, textHash, durationMs}}}`; `textHash` is `sha1(resolved text).slice(0,16)`, the same as `textHash` in `src/main/showtime/narration.ts` (`{name}` replaced by the persona's displayName).

## Usage
`npm run showtime:render` is incremental: it skips a line whose hash, voice, persona and model match and whose file exists. Flags: `-- --force`, `-- --only=id1,id2`, `-- --dry-run`, `-- --strict` (exit 1 if a clip is over 110% of its slot). Concurrency 3, one retry per line, a failed line is reported and the rest continue (exit 1 if any failed). The manifest is rewritten after every clip. The key is read from `REPO/.env` by dotenv and never printed.

## Verification
- All 41 WAVs open with `afinfo` (WAVE, 1 ch, 24000 Hz, Int16).
- `src/main/showtime/clips.test.ts` (new, vitest): loads the manifest through the real `createNarrator`, asserts every script line resolves to a clip with a matching hash, a changed text is rejected, and WAV headers and durations match the manifest. `npx vitest run src/main/showtime` is green (48 tests) and `npm run typecheck` is green.
- After any edit to script.json or personas.ts, run `npm run showtime:render` or this test fails with the list of stale ids.
- Not verified: playback inside Electron, and how the tour timeline behaves when a clip outlasts its slot.

## Over-long lines (clip longer than 110% of `durationMs`)
c1-hello 13.4 s vs 10.7, c2-tb2 3.2 vs 2.5, c3-1 10.0 vs 7.4, c3-5 7.2 vs 6.4, c4-2 6.9 vs 6.2, c5-1 6.8 vs 5.7, c6-3 6.4 vs 4.4, c7-3 6.1 vs 5.0, c8-1 5.2 vs 4.6, c10-1 5.8 vs 4.4, c11-1 7.8 vs 5.8, c11-2 8.4 vs 6.9, c3-tech 7.6 vs 6.7.
Between 100 and 110 percent (acceptable): c2-5, c3-4, c4-4, c8-2, c10-2, c10-3, c6-tech, c9-tech, c11-tech.
Each clip carries about 0.3 s of silence at the start and end, so trimming would gain up to 0.6 s per line but not fix the large overruns; shortening the text or raising the slot does.
Calls used: 51 of 80.
