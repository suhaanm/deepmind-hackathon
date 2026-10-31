// Model IDs. The ONLY place that reads MODEL_* env overrides (main process; renderers get the defaults).
const env: Record<string, string | undefined> = typeof process !== 'undefined' && process.env ? process.env : {}

export const MODELS = {
  live: env.MODEL_LIVE || 'gemini-3.8-live',
  flash: env.MODEL_FLASH || 'gemini-3.8-flash',
  lite: env.MODEL_LITE || 'gemini-3.5-flash-lite',
  // Text-only output, no Live API. No temperature/top_p/top_k: use thinking_level.
  argon: env.MODEL_ARGON || 'gemini-4-argon',
  transcribe: env.MODEL_TRANSCRIBE || 'gemini-3.5-transcribe-live',
} as const

export type ModelKey = keyof typeof MODELS
