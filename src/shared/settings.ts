import { z } from 'zod'
import { HelpLevelSchema, PersonaIdSchema } from './protocol'

export const SettingsSchema = z.object({
  persona: PersonaIdSchema.nullable().default(null),
  helpLevelMode: z.enum(['auto', 'locked']).default('auto'),
  lockedLevel: HelpLevelSchema.default(2),
  pacing: z.enum(['gentle', 'fast']).default('gentle'),
  voiceSpeed: z.number().min(0.75).max(1.25).default(1),
  captions: z.boolean().default(true),
  textOnly: z.boolean().default(false),
  bigAnnotations: z.boolean().default(true),
  highContrast: z.boolean().default(false),
  dyslexiaFont: z.boolean().default(false),
  explainJargon: z.boolean().default(true),
  teachBack: z.boolean().default(true),
  scamShield: z.boolean().default(true),
  // Both OFF unless the user turns them on; "do it for me" additionally needs a real-click confirmation per action.
  doItForMeAllowed: z.boolean().default(false),
  carerSharing: z.boolean().default(false),
  pushToTalkOnly: z.boolean().default(false),
  listeningLight: z.boolean().default(true),
  // One clean attempt is enough to step up a level. Default ON for the hackathon demo; say so honestly on stage.
  demoMode: z.boolean().default(true),
  wakeEnabled: z.boolean().default(true),
})

export type Settings = z.infer<typeof SettingsSchema>
export const SettingsPatchSchema = SettingsSchema.partial()
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>

export const DEFAULT_SETTINGS: Settings = SettingsSchema.parse({})

// Keeps every valid key from a (possibly corrupt or older) settings file and defaults the rest.
export function coerceSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS }
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS }
  for (const key of Object.keys(SettingsSchema.shape) as (keyof Settings)[]) {
    if (!(key in raw)) continue
    const parsed = SettingsSchema.shape[key].safeParse((raw as Record<string, unknown>)[key])
    if (parsed.success) out[key] = parsed.data
  }
  return out as Settings
}
