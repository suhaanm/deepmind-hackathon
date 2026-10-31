import type { ReactElement } from 'react'
import type { CompanionState } from '../../shared/protocol'
import type { Settings, SettingsPatch } from '../../shared/settings'
import { PERSONA_LIST } from '../../shared/personas'
import { Icon, LevelChip, ListeningLight, MuteButton, Onboarding, PHASE_LABELS, PresenceOrb, ProgressView, SettingsPanel, StopButton } from '../design'
import { useProgressData } from './hooks'
import { NowTab } from './NowTab'
import { ProfileTab } from './ProfileTab'

export type DockTab = 'now' | 'progress' | 'profile' | 'settings'
const TABS: readonly { id: DockTab; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'progress', label: 'Progress' },
  { id: 'profile', label: 'About you' },
  { id: 'settings', label: 'Settings' },
]
const PERSONA_OPTIONS = PERSONA_LIST.map((p) => ({ id: p.id, name: p.displayName }))

export interface PanelProps {
  state: CompanionState
  settings: Settings
  personaName: string
  tab: DockTab
  onTab: (tab: DockTab) => void
  onCollapse: () => void
  onStop: () => void
  onToggleMute: () => void
  onWake: () => void
  onCancelAgent: (id: string) => void
  onSettings: (patch: SettingsPatch) => void
  onboarding: { onRequestMicrophone: () => Promise<boolean>; onDone: () => void } | null
}

/** Expanded dock: header with presence and level, tabs (Now, Progress, Settings), and an always-visible footer with Stop. */
export function Panel(props: PanelProps): ReactElement {
  const { state, settings, personaName, tab, onTab, onboarding } = props
  const progress = useProgressData(tab === 'progress' && !onboarding, settings.demoMode)

  return (
    <>
      <div className="al-dock__head al-drag">
        <div className="al-dock__headrow">
          <PresenceOrb phase={state.phase} size={56} personaName={personaName} />
          <div className="al-pill__who" style={{ flex: 1, minWidth: 0 }}>
            <span className="al-pill__name">{personaName}</span>
            <span className="al-pill__phase">{PHASE_LABELS[state.phase]}</span>
          </div>
          <MuteButton muted={state.micMuted} onToggle={props.onToggleMute} />
          <button type="button" className="al-btn al-btn--quiet" aria-label="Collapse the panel" onClick={props.onCollapse}>
            <Icon name="up" />
          </button>
        </div>
        <div>
          <LevelChip level={state.level} locked={state.levelLocked} />
        </div>
      </div>

      {onboarding ? (
        <div className="al-dock__body" role="region" aria-label="Welcome">
          <Onboarding personaName={personaName} onRequestMicrophone={onboarding.onRequestMicrophone} onDone={onboarding.onDone} />
        </div>
      ) : (
        <>
          <div className="al-tabs" role="tablist" aria-label="Sections">
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" id={`al-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="al-tabpanel" className="al-tab" onClick={() => onTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="al-dock__body" role="tabpanel" id="al-tabpanel" aria-labelledby={`al-tab-${tab}`}>
            {tab === 'now' ? <NowTab state={state} personaName={personaName} onWake={props.onWake} onCancelAgent={props.onCancelAgent} /> : null}
            {tab === 'progress' ? <ProgressView data={progress} /> : null}
            {tab === 'profile' ? <ProfileTab carerSharing={settings.carerSharing} onCarerSharing={(carerSharing) => props.onSettings({ carerSharing })} /> : null}
            {tab === 'settings' ? <SettingsPanel settings={settings} onChange={props.onSettings} personas={PERSONA_OPTIONS} /> : null}
          </div>
        </>
      )}

      <div className="al-dock__foot">
        {settings.listeningLight ? <ListeningLight phase={state.phase} muted={state.micMuted} personaName={personaName} /> : <span style={{ flex: 1 }} />}
        <StopButton onStop={props.onStop} />
      </div>
    </>
  )
}
