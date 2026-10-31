// Screen-level furniture: the captions band (bottom) and the help-level chip echo (top). Both are pictures
// only; the real controls live in the dock window.
import type { ReactElement } from 'react'
import type { CaptionSpeaker } from '../../../shared/protocol'
import type { AnnotationStyle } from '../../design/annotation-style'
import { LEVEL_SUPPORT } from '../../design/levels'
import type { Size } from '../geometry'
import { Measured } from './common'
import type { CaptionState, ChipState } from '../store'

// Long streaming lines keep the most recent words visible.
export function tailText(text: string, max = 240): string {
  if (text.length <= max) return text
  const cut = text.slice(text.length - max)
  const space = cut.indexOf(' ')
  return `… ${space > 0 && space < 40 ? cut.slice(space + 1) : cut}`
}

export function CaptionBand({
  caption,
  speakerName,
  style,
  viewport,
  onSize,
}: {
  caption: CaptionState
  speakerName: string
  style: AnnotationStyle
  viewport: Size
  onSize: (id: string, size: Size) => void
}): ReactElement {
  const c = style.caption
  const exiting = caption.exitingAt !== null
  return (
    <div className="ov-html" style={{ left: 0, width: '100%', bottom: c.bottomInset, display: 'flex', justifyContent: 'center' }}>
      <Measured
        id="caption"
        onSize={onSize}
        className={exiting ? 'ov-exit' : 'ov-fade-enter'}
        style={{
          width: 'max-content',
          maxWidth: Math.min(c.maxWidth, viewport.width - 48),
          maxHeight: viewport.height * c.maxHeightFraction,
          overflow: 'hidden',
          background: c.background,
          color: c.color,
          border: c.border,
          borderRadius: c.radius,
          padding: `${c.padding.y}px ${c.padding.x}px`,
          fontFamily: c.fontFamily,
          fontSize: c.fontSize,
          lineHeight: c.lineHeight,
          fontWeight: 600,
          boxShadow: '0 8px 28px rgba(5, 7, 13, 0.4)',
        }}
      >
        {speakerName ? (
          <div style={{ fontSize: c.speakerFontSize, color: c.speakerColor, fontWeight: 700, marginBottom: 4, letterSpacing: 0.2 }}>{speakerName}</div>
        ) : null}
        <div>{tailText(caption.text)}</div>
      </Measured>
    </div>
  )
}

export function speakerLabel(speaker: CaptionSpeaker, names: Partial<Record<CaptionSpeaker, string>>): string {
  if (names[speaker] !== undefined) return names[speaker] as string
  if (speaker === 'user') return 'You'
  if (speaker === 'assistant') return 'Assistant'
  return ''
}

export function LevelChipEcho({ chip, style, top, onSize }: { chip: ChipState; style: AnnotationStyle; top: number; onSize: (id: string, size: Size) => void }): ReactElement {
  const l = style.levelChip
  const filled = LEVEL_SUPPORT[chip.level]
  const exiting = chip.exitingAt !== null
  return (
    <div key={chip.changedAt} className="ov-html" style={{ left: 0, width: '100%', top, display: 'flex', justifyContent: 'center' }}>
      <Measured
        id="chip"
        onSize={onSize}
        className={exiting ? 'ov-exit' : 'ov-fade-enter'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: l.fontSize * 0.6,
          background: l.background,
          color: l.color,
          border: l.border,
          borderRadius: l.radius,
          padding: `${l.padding.y}px ${l.padding.x}px`,
          fontFamily: style.bubble.fontFamily,
          fontSize: l.fontSize,
          fontWeight: 700,
          boxShadow: '0 6px 22px rgba(5, 7, 13, 0.4)',
        }}
      >
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'flex-end', gap: l.fontSize * 0.15, height: l.fontSize }}>
          {[1, 2, 3, 4].map((i) => (
            <span
              key={i}
              style={{
                width: l.fontSize * 0.2,
                height: l.fontSize * (0.35 + i * 0.16),
                borderRadius: 2,
                background: i <= filled ? '#fff' : 'rgba(255,255,255,0.28)',
                transition: `background ${l.changeMs}ms ease`,
              }}
            />
          ))}
        </span>
        <span>{chip.label}</span>
      </Measured>
    </div>
  )
}
