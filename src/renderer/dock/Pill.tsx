import type { ReactElement } from 'react'
import type { CompanionState } from '../../shared/protocol'
import { sessionActive, useScreenBlocked, useShowtimeActive } from './hooks'
import { LevelChip, PresenceOrb, StopButton, listeningLightState } from '../design'

export interface PillProps {
  state: CompanionState
  personaName: string
  onExpand: () => void
  onStop: () => void
}

/** Collapsed dock: orb with its listening dot, the level chip, and Stop. 72px tall. */
export function Pill({ state, personaName, onExpand, onStop }: PillProps): ReactElement {
  const screenBlocked = useScreenBlocked()
  const demoActive = useShowtimeActive()
  const stoppable = sessionActive(state.phase) || demoActive
  const light = state.settings.listeningLight ? listeningLightState(state.phase, state.micMuted, screenBlocked) : undefined
  return (
    <div className="al-pill al-drag" role="region" aria-label={`${personaName}, collapsed`}>
      <span className="al-grip" aria-hidden="true" title="Drag to move">
        <span /><span /><span /><span /><span /><span />
      </span>
      <button type="button" className="al-pill__main" aria-label={`Open the ${personaName} panel`} onClick={onExpand}>
        <PresenceOrb phase={state.phase} size={48} personaName={personaName} light={light} />
        {state.phase === 'error' ? (
          <span className="al-pill__who">
            <span className="al-pill__name">Something went wrong</span>
            <span className="al-pill__phase">Tap for details</span>
          </span>
        ) : (
          <LevelChip level={state.level} locked={state.levelLocked} variant="compact" />
        )}
      </button>
      {stoppable ? <StopButton compact onStop={onStop} /> : null}
    </div>
  )
}
