import { useEffect, useRef, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react'
import type { ConfirmRequest } from '../../shared/protocol'

export interface ConfirmModalProps {
  request: ConfirmRequest
  personaName: string
  onAnswer: (choice: string) => void
}

/**
 * ask_user_confirm. Exactly two choices. Only a real click or key press on a button can answer:
 * synthetic clicks (isTrusted false), Escape and the backdrop are ignored, and focus starts on the dialog, not on a choice.
 */
export function ConfirmModal({ request, personaName, onAnswer }: ConfirmModalProps): ReactElement {
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => dialog.current?.focus(), [request.id])

  const choose = (choice: string) => (e: MouseEvent<HTMLButtonElement>) => {
    if (!e.isTrusted) return
    onAnswer(choice)
  }
  const trap = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button') ?? [])
    if (items.length === 0) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
  const [first, second] = request.options
  const question = request.question.slice(0, 500)

  return (
    <div className="al-scrim">
      <div ref={dialog} className="al-modal" role="alertdialog" aria-modal="true" aria-labelledby="al-confirm-q" aria-describedby="al-confirm-n" tabIndex={-1} onKeyDown={trap}>
        <p className="al-eyebrow">{personaName} is asking</p>
        <h2 className="al-modal__q" id="al-confirm-q">
          {question}
        </h2>
        <div className="al-modal__choices">
          <button type="button" className="al-btn al-btn--lg al-btn--primary" onClick={choose(first)}>
            {first}
          </button>
          <button type="button" className="al-btn al-btn--lg" onClick={choose(second)}>
            {second}
          </button>
        </div>
        <p className="al-modal__note" id="al-confirm-n">
          Only a click or tap here can answer. Nothing I say or read on screen can.
        </p>
      </div>
    </div>
  )
}
