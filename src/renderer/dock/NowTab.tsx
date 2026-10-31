import type { ReactElement } from 'react'
import type { CompanionState } from '../../shared/protocol'
import { AgentTray, Captions, ErrorBanner, SkillStepper } from '../design'

export interface NowTabProps {
  state: CompanionState
  personaName: string
  onWake: () => void
  onCancelAgent: (id: string) => void
}

export function NowTab({ state, personaName, onWake, onCancelAgent }: NowTabProps): ReactElement {
  const resting = state.phase === 'asleep' || state.phase === 'listening_for_name'
  return (
    <>
      {state.phase === 'error' ? (
        <ErrorBanner title="I lost my footing." message={state.lastError ?? 'Something went wrong. Your progress is saved.'} actionLabel="Try again" onAction={onWake} />
      ) : null}
      {resting ? (
        <>
          <p className="al-wake-hint">
            Say <strong>{`“Hey ${personaName}”`}</strong> and tell me what you’d like to do.
          </p>
          <button type="button" className="al-btn al-btn--lg al-btn--primary al-btn--block" onClick={onWake}>
            {`Talk to ${personaName}`}
          </button>
        </>
      ) : null}
      {state.skill ? <SkillStepper name={state.skill.name} step={state.skill.step} stepCount={state.skill.stepCount} /> : null}
      {!resting && state.phase !== 'error' && state.captions.length === 0 && !state.skill ? (
        <p className="al-wake-hint">{`Tell me what you’d like to do. For example: “How do I make the text bigger?”`}</p>
      ) : null}
      {state.settings.captions && state.captions.length > 0 ? <Captions lines={state.captions} personaName={personaName} /> : null}
      {state.agents.length > 0 ? (
        <>
          <h3 className="al-eyebrow">Helpers</h3>
          <AgentTray agents={state.agents} onCancel={onCancelAgent} />
        </>
      ) : null}
    </>
  )
}
