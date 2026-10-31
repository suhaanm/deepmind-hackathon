import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { DEFAULT_PERSONA, PERSONAS } from '../../shared/personas'
import { ConfirmModal, applyDesignSettings } from '../design'
import { useCompanionState, useSettings } from './hooks'
import { Panel, type DockTab } from './Panel'
import { Pill } from './Pill'

const ONBOARDED_KEY = 'alongside.onboarded'

function readOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}

async function requestMicrophone(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

export function App(): ReactElement | null {
  const state = useCompanionState()
  const [settings, patchSettings] = useSettings()
  const [expanded, setExpanded] = useState(() => !readOnboarded())
  const [tab, setTab] = useState<DockTab>('now')
  const [onboarded, setOnboarded] = useState(readOnboarded)

  const personaId = state?.persona ?? settings?.persona ?? DEFAULT_PERSONA
  const personaName = PERSONAS[personaId].displayName
  const confirmPending = state?.pendingConfirm !== undefined
  const open = expanded || confirmPending

  useEffect(() => {
    if (settings) applyDesignSettings(settings, personaId)
  }, [settings?.bigAnnotations, settings?.highContrast, settings?.dyslexiaFont, personaId])

  useEffect(() => {
    void window.alongside.setDockMode(open ? 'expanded' : 'compact')
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !confirmPending) setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmPending])

  const finishOnboarding = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDED_KEY, '1')
    } catch {
      // Private mode: the welcome simply shows again next launch.
    }
    setOnboarded(true)
    setExpanded(false)
  }, [])

  if (!state || !settings) return null

  const wake = (): void => window.alongside.wakeDetected({ personaId, source: 'button' })
  const stop = (): void => window.alongside.pressStop()

  return (
    <div className="al-app al-dock al-dock--fill" data-phase={state.phase} data-mode={open ? 'expanded' : 'compact'}>
      {open ? (
        <Panel
          state={state}
          settings={settings}
          personaName={personaName}
          tab={tab}
          onTab={setTab}
          onCollapse={() => setExpanded(false)}
          onStop={stop}
          onToggleMute={() => void window.alongside.patchState({ micMuted: !state.micMuted })}
          onWake={wake}
          onCancelAgent={(id) => void window.alongside.cancelAgent(id)}
          onSettings={patchSettings}
          onboarding={onboarded ? null : { onRequestMicrophone: requestMicrophone, onDone: finishOnboarding }}
        />
      ) : (
        <Pill state={state} personaName={personaName} onExpand={() => setExpanded(true)} onStop={stop} />
      )}
      {state.pendingConfirm ? (
        <ConfirmModal request={state.pendingConfirm} personaName={personaName} onAnswer={(choice) => window.alongside.answerConfirm({ id: state.pendingConfirm!.id, choice })} />
      ) : null}
    </div>
  )
}
