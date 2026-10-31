import { PERSONAS } from '../../shared/personas'
import type { PersonaId } from '../../shared/protocol'
import type { Settings } from '../../shared/settings'

export type DesignSettings = Pick<Settings, 'bigAnnotations' | 'highContrast' | 'dyslexiaFont'>

const ACCENT_VARS = ['--accent', '--accent-soft', '--on-accent'] as const

/** Mirrors the three look-and-feel settings and the persona accent onto <html>, where tokens.css reads them. */
export function applyDesignSettings(settings: DesignSettings, persona: PersonaId | null, root: HTMLElement = document.documentElement): void {
  root.dataset.bigAnnotations = String(settings.bigAnnotations)
  root.dataset.highContrast = String(settings.highContrast)
  root.dataset.dyslexiaFont = String(settings.dyslexiaFont)
  if (persona) {
    const token = PERSONAS[persona].accentToken
    root.dataset.persona = persona
    root.style.setProperty('--accent', `var(--${token})`)
    root.style.setProperty('--accent-soft', `var(--${token}-soft)`)
    root.style.setProperty('--on-accent', `var(--on-${token})`)
  } else {
    delete root.dataset.persona
    for (const name of ACCENT_VARS) root.style.removeProperty(name)
  }
}

/** Follows the operating system's light/dark choice. Returns an unsubscribe function. */
export function followSystemTheme(root: HTMLElement = document.documentElement): () => void {
  const query = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = (): void => {
    root.dataset.theme = query.matches ? 'dark' : 'light'
  }
  apply()
  query.addEventListener('change', apply)
  return () => query.removeEventListener('change', apply)
}
