import type { ReactElement, ReactNode } from 'react'
import type { HelpLevel, PersonaId } from '../../shared/protocol'
import type { Settings, SettingsPatch } from '../../shared/settings'
import { annotationStyle, strokeLayers } from './annotation-style'
import { LEVEL_NAMES } from './levels'
import { Segmented, Switch } from './Switch'

export interface SettingsPanelProps {
  settings: Settings
  onChange: (patch: SettingsPatch) => void
  personas: readonly { id: PersonaId; name: string }[]
}

function Group({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section className="al-group" aria-label={title}>
      <h3 className="al-eyebrow">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }): ReactElement {
  return (
    <div className="al-field">
      <span className="al-field__label">{label}</span>
      {hint ? <span className="al-small">{hint}</span> : null}
      {children}
    </div>
  )
}

/** What marks on the user's screen will look like with the current settings. */
export function AnnotationPreview({ settings }: { settings: Pick<Settings, 'bigAnnotations' | 'highContrast' | 'dyslexiaFont'> }): ReactElement {
  const st = annotationStyle(settings)
  const tone = 'guide'
  const ring = { x: 22, y: 40, w: 126, h: 60 }
  const rx = Math.min(st.ring.radius, ring.h / 2)
  const layers = strokeLayers(st, tone)
  const core = st.tones[tone]
  const arrow = `M270 120 Q 227 110 186 92`
  return (
    <div className="al-preview">
      <svg viewBox="0 0 320 150" role="img" aria-label="What on-screen marks will look like with these settings">
        <rect x="30" y="48" width="110" height="44" rx="10" fill="#e8ecf3" />
        <text x="85" y="76" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1d2330" fontFamily="system-ui">
          Send
        </text>
        {layers.map((l, i) => (
          <rect key={i} x={ring.x} y={ring.y} width={ring.w} height={ring.h} rx={rx} fill="none" stroke={l.color} strokeWidth={l.width} strokeOpacity={l.opacity} />
        ))}
        {layers.map((l, i) => (
          <path key={i} d={arrow} fill="none" stroke={l.color} strokeWidth={l.width} strokeOpacity={l.opacity} strokeLinecap="round" />
        ))}
        <polygon points="172,86 192,84 182,102" fill={core.core} stroke={core.casing} strokeWidth={st.stroke.core * 0.6} strokeLinejoin="round" />
        <circle cx={ring.x + 4} cy={ring.y + 2} r={st.badge.diameter / 2} fill={core.core} stroke={core.casing} strokeWidth={st.stroke.core * 0.5} />
        <text x={ring.x + 4} y={ring.y + 2 + st.badge.fontSize * 0.36} textAnchor="middle" fontSize={st.badge.fontSize} fontWeight="700" fill={core.onCore} fontFamily={st.badge.fontFamily}>
          1
        </text>
      </svg>
    </div>
  )
}

export function SettingsPanel({ settings, onChange, personas }: SettingsPanelProps): ReactElement {
  const toggle = (key: keyof Settings) => (checked: boolean) => onChange({ [key]: checked })
  const levels: HelpLevel[] = [1, 2, 3, 4]
  return (
    <div className="al-settings">
      <Group title="How I help">
        <Field label="Help level" hint="I step back as you get better. You can keep one level if you prefer.">
          <Segmented
            label="Help level mode"
            value={settings.helpLevelMode}
            onChange={(helpLevelMode) => onChange({ helpLevelMode })}
            options={[
              { value: 'auto', label: 'Adjust for me' },
              { value: 'locked', label: 'Keep it fixed' },
            ]}
          />
        </Field>
        {settings.helpLevelMode === 'locked' ? (
          <Field label="Keep me at">
            <Segmented label="Help level to keep" value={settings.lockedLevel} onChange={(lockedLevel) => onChange({ lockedLevel })} options={levels.map((l) => ({ value: l, label: LEVEL_NAMES[l] }))} />
          </Field>
        ) : null}
        <Field label="Pace" hint="Gentle gives smaller steps and more time.">
          <Segmented
            label="Pace"
            value={settings.pacing}
            onChange={(pacing) => onChange({ pacing })}
            options={[
              { value: 'gentle', label: 'Gentle' },
              { value: 'fast', label: 'Quick' },
            ]}
          />
        </Field>
        <Field label="Voice speed">
          <input className="al-range" type="range" min={0.75} max={1.25} step={0.05} value={settings.voiceSpeed} aria-label="Voice speed" onChange={(e) => onChange({ voiceSpeed: Number(e.target.value) })} />
          <span className="al-small" aria-live="polite">
            {settings.voiceSpeed.toFixed(2).replace(/0$/, '')}{'×'} {settings.voiceSpeed < 0.95 ? 'slower' : settings.voiceSpeed > 1.05 ? 'faster' : 'normal'}
          </span>
        </Field>
        <Switch label="Ask me to explain it back" hint="After a task, I ask you to say it in your own words. You can skip it." checked={settings.teachBack} onChange={toggle('teachBack')} />
        <Switch label="Explain computer words" hint="I use plain words and say what a term means." checked={settings.explainJargon} onChange={toggle('explainJargon')} />
        <Switch label="Demo mode" hint="Moves you up a level after one clean try. Normally it takes longer." checked={settings.demoMode} onChange={toggle('demoMode')} />
      </Group>

      <Group title="What you see and hear">
        <Switch label="Show captions" hint="Words appear on screen as I speak." checked={settings.captions} onChange={toggle('captions')} />
        <Switch label="Text only, no speaking" hint="I write instead of talking." checked={settings.textOnly} onChange={toggle('textOnly')} />
        <Switch label="Big marks on screen" hint="Arrows and circles are drawn larger." checked={settings.bigAnnotations} onChange={toggle('bigAnnotations')} />
        <Switch label="High contrast" hint="Black and white with thicker lines." checked={settings.highContrast} onChange={toggle('highContrast')} />
        <Switch label="Easier-to-read font" hint="Switches to OpenDyslexic." checked={settings.dyslexiaFont} onChange={toggle('dyslexiaFont')} />
        <Field label="Preview of marks on your screen">
          <AnnotationPreview settings={settings} />
        </Field>
      </Group>

      <Group title="Listening">
        <Switch label="Listen for my name" hint="Only to hear my name. Nothing is sent until you say it." checked={settings.wakeEnabled} onChange={toggle('wakeEnabled')} />
        <Switch label="Only listen when I press a key" hint="I stay quiet until you press the key." checked={settings.pushToTalkOnly} onChange={toggle('pushToTalkOnly')} />
        <Switch label="Show the listening light" hint="A light that shows when I can see or hear you." checked={settings.listeningLight} onChange={toggle('listeningLight')} />
      </Group>

      <Group title="Safety and sharing">
        <Switch label="Scam check" hint="I can look at a message and point out warning signs." checked={settings.scamShield} onChange={toggle('scamShield')} />
        <Switch label="Let me do things for you" hint="Off. I teach you instead. If you turn it on, I still ask before every click." checked={settings.doItForMeAllowed} onChange={toggle('doItForMeAllowed')} />
        <Switch label="Share progress with someone you trust" hint="Off. Nothing is shared. If on, only summaries, never your screen." checked={settings.carerSharing} onChange={toggle('carerSharing')} />
      </Group>

      <Group title="Who is helping">
        <Field label="Name to say" hint="Say “Hey” and their name to wake them.">
          <Segmented label="Companion" value={settings.persona ?? personas[0]?.id ?? 'marcus'} onChange={(persona) => onChange({ persona })} options={personas.map((p) => ({ value: p.id, label: p.name }))} />
        </Field>
      </Group>
    </div>
  )
}
