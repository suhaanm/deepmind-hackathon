import type { ReactElement } from 'react'
import type { CaptionLine } from '../../shared/protocol'

export interface CaptionsProps {
  lines: readonly CaptionLine[]
  personaName: string
  /** How many of the latest lines to show; default 3. */
  max?: number
}

const WHO = { user: 'You', system: 'Note' } as const

export function Captions({ lines, personaName, max = 3 }: CaptionsProps): ReactElement {
  const shown = lines.slice(-max)
  return (
    <div className="al-captions" aria-live="polite" aria-label="Captions">
      {shown.map((line) => (
        <div key={line.id} className="al-caption" data-speaker={line.speaker} data-final={line.final}>
          <span className="al-caption__who">{line.speaker === 'assistant' ? personaName : WHO[line.speaker]}</span>
          <p className="al-caption__text">{line.text}</p>
        </div>
      ))}
    </div>
  )
}
