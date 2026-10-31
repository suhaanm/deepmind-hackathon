import type { ReactElement } from 'react'
import type { Phase } from '../../shared/protocol'
import { Icon } from './icons'

export type LightState = 'off' | 'wake' | 'screen' | 'muted'

/** The honest indicator: red while I can see your screen, accent while I only wait for my name. */
export function listeningLightState(phase: Phase, muted: boolean): LightState {
  if (muted) return 'muted'
  if (phase === 'asleep' || phase === 'error') return 'off'
  if (phase === 'listening_for_name') return 'wake'
  return 'screen'
}

export function listeningLightText(state: LightState, personaName: string): string {
  switch (state) {
    case 'off':
      return 'Not listening'
    case 'wake':
      return `Listening for “Hey ${personaName}”`
    case 'screen':
      return 'I can see your screen'
    case 'muted':
      return 'Muted. I can’t hear you'
  }
}

export interface ListeningLightProps {
  phase: Phase
  muted: boolean
  personaName: string
}

export function ListeningLight({ phase, muted, personaName }: ListeningLightProps): ReactElement {
  const state = listeningLightState(phase, muted)
  const text = listeningLightText(state, personaName)
  return (
    <div className="al-light" data-state={state} role="status" aria-label={text}>
      <span className="al-light__dot" aria-hidden="true" />
      <span className="al-light__text">{text}</span>
    </div>
  )
}

export function MuteButton({ muted, onToggle }: { muted: boolean; onToggle: () => void }): ReactElement {
  const label = muted ? 'Unmute the microphone' : 'Mute the microphone'
  return (
    <button type="button" className="al-btn al-btn--quiet al-mute" aria-pressed={muted} aria-label={label} title={muted ? 'Unmute' : 'Mute'} onClick={onToggle}>
      <Icon name={muted ? 'micOff' : 'mic'} />
    </button>
  )
}
