// STUB — owned by OVERLAY after .scaffold-ready
// Contract: `show` upserts annotations by id (same id replaces the previous drawing); `clear()` with no ids clears everything.
import type { OverlayController } from '../shared/contracts'
import type { ServiceContext } from './context'

export function createOverlayController(ctx: ServiceContext): OverlayController {
  return {
    show: (annotations) => ctx.sendOverlay({ type: 'show', annotations }),
    clear: (ids) => ctx.sendOverlay({ type: 'clear', ids }),
    caption: (speaker, text, final) => ctx.sendOverlay({ type: 'caption', speaker, text, final }),
    chip: (level, label) => ctx.sendOverlay({ type: 'chip', level, label }),
  }
}
