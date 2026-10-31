import { useEffect, useState, type ReactElement } from 'react'
import { DEFAULT_PERSONA, PERSONAS } from '../../shared/personas'
import { ConfirmModal, applyDesignSettings } from '../design'
import { chatBus } from './chat/bus'
import { FilesSection } from './files'
import { useCompanionState, useSettings, useShowtimeActive } from './hooks'
import { OnboardingFlow, requestOnboarding } from './onboarding'
import { Panel, type DockTab } from './Panel'
import { Pill } from './Pill'
import { ShowtimeBar } from './ShowtimeBar'

interface ShowtimeChat {
  id: string
  role: 'user' | 'assistant'
  text: string
  final: boolean
  via: 'typed' | 'voice'
}

export function App(): ReactElement | null {
  const state = useCompanionState()
  const [settings, patchSettings] = useSettings()
  const [expanded, setExpanded] = useState(false)
  const [tab, setTab] = useState<DockTab>('chat')

  const personaId = state?.persona ?? settings?.persona ?? DEFAULT_PERSONA
  const personaName = PERSONAS[personaId].displayName
  const confirmPending = state?.pendingConfirm !== undefined
  const onboarding = settings !== null && !settings.onboardingDone
  // The walkthrough's controls need room, so the panel stays open while the demo runs (they never cover the header).
  const demoRunning = useShowtimeActive()
  const open = expanded || confirmPending || onboarding || demoRunning

  useEffect(() => {
    if (settings) applyDesignSettings(settings, personaId)
  }, [settings?.bigAnnotations, settings?.highContrast, settings?.dyslexiaFont, settings?.theme, settings?.glass, settings?.glassOpacity, settings?.textScale, personaId])

  useEffect(() => {
    void window.alongside.setDockMode(open ? 'expanded' : 'compact')
  }, [open])

  // Text-only setting and the chat's Talk | Type switch are one idea; keep them in step both ways.
  const textOnly = settings?.textOnly
  useEffect(() => {
    if (textOnly !== undefined) chatBus.setMode(textOnly ? 'text' : 'voice')
  }, [textOnly])
  useEffect(
    () =>
      chatBus.onMode((mode, info) => {
        if (info?.transient) return // menu-bar "Type instead": this chat only, never a saved preference
        if (settings && settings.textOnly !== (mode === 'text')) patchSettings({ textOnly: mode === 'text' })
      }),
    [settings?.textOnly, patchSettings], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || confirmPending || e.defaultPrevented) return
      // In a text box Escape only leaves the box, so a half-typed message is never lost with the panel.
      const t = e.target
      if (t instanceof HTMLElement && (t.isContentEditable || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'range'].includes(t.type)))) {
        t.blur()
        return
      }
      setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmPending])

  // Menu bar commands (SHELL) and scripted-tour cues (DEMO).
  useEffect(() => {
    const off = window.alongside.shell.onCommand((cmd) => {
      if (cmd.type === 'expand') setExpanded(true)
      else if (cmd.type === 'collapse') setExpanded(false)
      else if (cmd.type === 'toggle') setExpanded((v) => !v)
      else {
        setExpanded(true)
        if (cmd.view === 'chat') {
          setTab('chat')
          chatBus.setMode('text', { transient: true })
        } else if (cmd.view === 'settings') setTab('settings')
        else if (cmd.view === 'permissions') {
          requestOnboarding({ step: 'permissions' })
          void window.alongside.patchSettings({ onboardingDone: false })
        }
      }
    })
    const onView = (e: Event): void => {
      const view = (e as CustomEvent<{ view: string }>).detail?.view
      setExpanded(true)
      setTab(view === 'progress' || view === 'profile' || view === 'settings' ? view : 'chat')
    }
    const onChat = (e: Event): void => {
      const m = (e as CustomEvent<ShowtimeChat>).detail
      if (m) chatBus.push({ id: m.id, role: m.role, text: m.text, final: m.final, at: Date.now(), via: m.via })
    }
    window.addEventListener('alongside:showtime-view', onView)
    window.addEventListener('alongside:showtime-chat', onChat)
    return () => {
      off()
      window.removeEventListener('alongside:showtime-view', onView)
      window.removeEventListener('alongside:showtime-chat', onChat)
    }
  }, [])

  if (!state || !settings) return null

  const wake = (): void => window.alongside.wakeDetected({ personaId, source: 'button' })

  return (
    <div className="al-app al-dock al-dock--fill" data-phase={state.phase} data-mode={open ? 'expanded' : 'compact'}>
      <ShowtimeBar />
      {onboarding ? (
        <OnboardingFlow settings={settings} onPatch={patchSettings} onDone={() => setExpanded(false)} />
      ) : open ? (
        <Panel
          state={state}
          settings={settings}
          personaName={personaName}
          tab={tab}
          onTab={setTab}
          onCollapse={() => setExpanded(false)}
          onStop={() => window.alongside.pressStop()}
          onToggleMute={() => void window.alongside.patchState({ micMuted: !state.micMuted })}
          onWake={wake}
          onCancelAgent={(id) => void window.alongside.cancelAgent(id)}
          onSettings={patchSettings}
          onSetUpAgain={() => patchSettings({ onboardingDone: false })}
          files={<FilesSection enabled={settings.filesEnabled} onEnabled={(filesEnabled) => patchSettings({ filesEnabled })} />}
        />
      ) : (
        <Pill state={state} personaName={personaName} onExpand={() => setExpanded(true)} onStop={() => window.alongside.pressStop()} />
      )}
      {state.pendingConfirm ? (
        <ConfirmModal compact request={state.pendingConfirm} personaName={personaName} onAnswer={(choice) => window.alongside.answerConfirm({ id: state.pendingConfirm!.id, choice })} />
      ) : null}
    </div>
  )
}
