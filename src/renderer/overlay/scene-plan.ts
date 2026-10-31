// Turns the active annotations into concrete geometry (px rects, arrow plans, label placements) in one pure pass,
// so labels can avoid every mark and the scene component only has to draw. Sizes of HTML labels are the
// measured sizes reported by the DOM when known, an estimate otherwise.
import type { NormBox } from '../../shared/protocol'
import type { AnnotationStyle } from '../design/annotation-style'
import { planArrow, type ArrowPlan } from './arrow'
import { atLeast, clampPoint, inflate, normBoxToRect, normToPx, overlapArea, pointRect, rectRight, targetRect, unionRect, type Pt, type Rect, type Size } from './geometry'
import { estimateTextBox, placeLabels, type LabelRequest, type PlacedLabel } from './layout'
import type { ActiveAnnotation } from './store'

export interface ScenePlan {
  rings: Map<string, { rect: Rect; step: Pt | null }>
  arrows: Map<string, ArrowPlan>
  badges: Map<string, Pt>
  spotlights: Map<string, Rect>
  ticks: Map<string, { box: Rect; center: Pt }>
  highlights: Map<string, Rect[]>
  ghosts: Map<string, Pt[]>
  // Keys: `${annotationId}:label` (ring), `${annotationId}:bubble`, `${annotationId}:note` (highlightText).
  labels: Map<string, PlacedLabel>
  // Rects of every mark (rings, badges, ticks, arrows, highlights, spotlight cut-outs): what the captions must not cover.
  marks: Rect[]
}

export interface ChromeRects {
  caption?: Rect
  chip?: Rect
}

export const labelKey = (id: string, part: 'label' | 'bubble' | 'note'): string => `${id}:${part}`

export function captionRect(size: Size, vp: Size, style: AnnotationStyle): Rect {
  return { x: (vp.width - size.width) / 2, y: vp.height - style.caption.bottomInset - size.height, w: size.width, h: size.height }
}

export function chipRect(size: Size, vp: Size, top: number): Rect {
  return { x: (vp.width - size.width) / 2, y: top, w: size.width, h: size.height }
}

export const CHIP_TOP = 56

// Captions live at the bottom, but the learner's targets often do too (call controls, Dock). When a mark would be
// covered, the band moves to the top, below the level chip, unless that covers more.
export function chooseCaptionRect(marks: Rect[], size: Size, vp: Size, style: AnnotationStyle, chip?: Rect): { rect: Rect; atTop: boolean } {
  const bottom = captionRect(size, vp, style)
  const cover = (r: Rect): number => marks.reduce((sum, m) => sum + overlapArea(inflate(r, 10), m), 0)
  if (cover(bottom) === 0) return { rect: bottom, atTop: false }
  const top: Rect = { x: bottom.x, y: chip ? chip.y + chip.h + 14 : CHIP_TOP, w: size.width, h: size.height }
  return cover(top) < cover(bottom) ? { rect: top, atTop: true } : { rect: bottom, atTop: false }
}

export function planScene(entries: ActiveAnnotation[], vp: Size, style: AnnotationStyle, sizes: Record<string, Size>, chrome: ChromeRects = {}): ScenePlan {
  const plan: ScenePlan = {
    rings: new Map(),
    arrows: new Map(),
    badges: new Map(),
    spotlights: new Map(),
    ticks: new Map(),
    highlights: new Map(),
    ghosts: new Map(),
    labels: new Map(),
    marks: [],
  }
  const obstacles: Rect[] = []
  const note = (_id: string, r: Rect): void => {
    obstacles.push(r)
  }
  const boxRect = (b: NormBox): Rect => normBoxToRect(b, vp)
  const pointHalf = style.ring.minSize / 2

  for (const { annotation: a } of entries) {
    switch (a.kind) {
      case 'ring': {
        const rect = inflate(atLeast(boxRect(a.box), style.ring.minSize), style.ring.pad)
        const step =
          a.step !== undefined
            ? clampPoint({ x: rect.x - style.badge.offset + style.badge.diameter * 0.1, y: rect.y - style.badge.offset + style.badge.diameter * 0.1 }, vp, style.badge.diameter * 0.75)
            : null
        plan.rings.set(a.id, { rect, step })
        note(a.id, rect)
        if (step) note(a.id, pointRect(step, style.badge.diameter / 2 + 6))
        break
      }
      case 'badge': {
        const at = clampPoint(normToPx(a.at, vp), vp, style.badge.diameter * 0.75)
        plan.badges.set(a.id, at)
        note(a.id, pointRect(at, style.badge.diameter / 2 + 6))
        break
      }
      case 'spotlight': {
        const rect = inflate(atLeast(boxRect(a.box), style.ring.minSize), style.spotlight.pad)
        plan.spotlights.set(a.id, rect)
        note(a.id, rect)
        break
      }
      case 'tick': {
        const box = inflate(atLeast(boxRect(a.box), style.ring.minSize), style.ring.pad * 0.6)
        const m = style.tick.size * 0.7
        const center = clampPoint({ x: rectRight(box) + style.tick.offset * 0.6, y: box.y - style.tick.offset * 0.6 }, vp, m)
        plan.ticks.set(a.id, { box, center })
        note(a.id, box)
        note(a.id, pointRect(center, style.tick.size / 2 + 6))
        break
      }
      case 'highlightText': {
        const rects = a.boxes.map(boxRect)
        plan.highlights.set(a.id, rects)
        for (const r of rects) note(a.id, inflate(r, style.highlightText.pad + style.highlightText.underlineWidth))
        break
      }
      case 'ghostCursor':
        plan.ghosts.set(
          a.id,
          a.path.map((p) => normToPx(p, vp)),
        )
        break
      case 'bubble':
        // Bubble anchors are small; the bubble itself is placed with the labels below.
        break
    }
  }

  // Arrows after everything else so they can route around other marks (but never around their own target).
  for (const { annotation: a } of entries) {
    if (a.kind !== 'arrow') continue
    const target = targetRect(a.to, vp, pointHalf)
    const own = inflate(target, style.arrow.gap)
    // Marks around the same target (ring, step badge, tick) are part of it: stop short of all of them.
    const around = obstacles.filter((r) => overlapArea(r, own) > 0)
    const aim = around.length > 0 ? unionRect([target, ...around]) : target
    const avoid = obstacles.filter((r) => !around.includes(r))
    const arrow = planArrow({ to: a.to, from: a.from, vp, style: style.arrow, pointHalf, avoid, targetRect: aim })
    plan.arrows.set(a.id, arrow)
    note(a.id, {
      x: Math.min(arrow.start.x, arrow.tip.x),
      y: Math.min(arrow.start.y, arrow.tip.y),
      w: Math.abs(arrow.tip.x - arrow.start.x),
      h: Math.abs(arrow.tip.y - arrow.start.y),
    })
  }

  plan.marks = [...obstacles]
  if (chrome.caption) obstacles.push(chrome.caption)
  if (chrome.chip) obstacles.push(chrome.chip)

  const requests: LabelRequest[] = []
  const b = style.bubble
  const sizeOf = (key: string, text: string, scale: number, maxWidth: number, withGlyph: boolean): Size =>
    sizes[key] ??
    estimateTextBox(text, b.fontSize * scale, b.lineHeight, b.padding.x + (withGlyph ? b.fontSize * scale : 0), b.padding.y, maxWidth)
  for (const { annotation: a } of entries) {
    if (a.kind === 'ring' && a.label) {
      const key = labelKey(a.id, 'label')
      requests.push({ id: key, size: sizeOf(key, a.label, 0.85, b.maxWidth, true), anchor: plan.rings.get(a.id)!.rect, gap: style.ring.pad * 0.5 + 6 })
    } else if (a.kind === 'bubble') {
      const key = labelKey(a.id, 'bubble')
      const at = normToPx(a.at, vp)
      requests.push({ id: key, size: sizeOf(key, a.text, 1, b.maxWidth, false), anchor: pointRect(at, 6), gap: b.tail + 6, prefer: ['above', 'right', 'below', 'left'] })
    } else if (a.kind === 'highlightText' && a.note) {
      const key = labelKey(a.id, 'note')
      const first = plan.highlights.get(a.id)?.[0]
      if (first) requests.push({ id: key, size: sizeOf(key, a.note, 0.85, style.highlightText.noteMaxWidth, true), anchor: inflate(first, style.highlightText.pad + style.highlightText.underlineWidth), gap: 8 })
    }
  }
  plan.labels = placeLabels(requests, vp, obstacles)
  return plan
}
