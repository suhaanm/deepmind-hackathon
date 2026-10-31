import fs from 'node:fs'
import path from 'node:path'
import { coerceSettings, DEFAULT_SETTINGS, SettingsSchema } from '../shared/settings'
import type { Settings, SettingsPatch } from '../shared/settings'

type Listener = (settings: Settings, patch: SettingsPatch) => void

export class SettingsStore {
  private current: Settings
  private readonly file: string | null
  private readonly listeners = new Set<Listener>()
  private saveTimer: NodeJS.Timeout | null = null

  // dir === null keeps everything in memory (tests).
  constructor(dir: string | null) {
    this.file = dir ? path.join(dir, 'settings.json') : null
    this.current = this.load()
  }

  private load(): Settings {
    if (!this.file) return { ...DEFAULT_SETTINGS }
    try {
      return coerceSettings(JSON.parse(fs.readFileSync(this.file, 'utf8')))
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  }

  get(): Settings {
    return this.current
  }

  // Invalid values are dropped key by key; the rest of the patch still applies.
  patch(raw: unknown): Settings {
    const accepted: Record<string, unknown> = {}
    if (typeof raw === 'object' && raw !== null) {
      for (const key of Object.keys(SettingsSchema.shape) as (keyof Settings)[]) {
        if (!(key in raw)) continue
        const parsed = SettingsSchema.shape[key].safeParse((raw as Record<string, unknown>)[key])
        if (parsed.success) accepted[key] = parsed.data
      }
    }
    const patch = accepted as SettingsPatch
    if (Object.keys(patch).length === 0) return this.current
    this.current = { ...this.current, ...patch }
    this.scheduleSave()
    for (const listener of this.listeners) listener(this.current, patch)
    return this.current
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    if (!this.file) return
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true })
      fs.writeFileSync(this.file, JSON.stringify(this.current, null, 2))
    } catch (err) {
      console.error('[settings] save failed:', err)
    }
  }

  private scheduleSave(): void {
    if (!this.file) return
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flush(), 300)
  }
}
