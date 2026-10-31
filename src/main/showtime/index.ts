// Showtime wiring (electron side): the real stage window, driver, IPC handlers and the bus / Stop hooks.
import path from 'node:path'
import { app, ipcMain, screen } from 'electron'
import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { IPC } from '../../shared/ipc'
import type { Services } from '../../shared/contracts'
import type { ShowtimeStartOptions } from '../../shared/showtime'
import type { ConfirmBroker } from '../confirm'
import type { ServiceContext } from '../context'
import type { SessionController } from '../session'
import type { Dispatch } from '../tools/dispatcher'
import type { Windows } from '../windows'
import { createDriver } from './driver'
import { bindShowtimeBus, createShowtime, dockStopBox, type Showtime } from './service'
import { openStageWindow } from './stage-window'

export interface RegisterShowtimeDeps {
  ctx: ServiceContext
  services: Services
  windows: Windows
  dispatch: Dispatch
  confirm: ConfirmBroker
  session: SessionController
}

const ModeOk = (m: unknown): m is 'scripted' | 'live' => m === 'scripted' || m === 'live'

export function registerShowtime(deps: RegisterShowtimeDeps): Showtime {
  const { ctx, services, windows, dispatch, confirm, session } = deps
  const log = (msg: string): void => ctx.log('showtime', msg)
  const assetsDir = process.env.ALONGSIDE_SHOWTIME_ASSETS || path.join(app.getAppPath(), 'assets/showtime')

  const showtime = createShowtime({
    ctx,
    assetsDir,
    log,
    openStage: () => openStageWindow({ log }),
    publish: (s) => windows.broadcast(IPC.showtimeUpdate, s),
    stopSession: () => session.stop('replaced'),
    reloadLearner: async () => {
      await services.learner.load()
    },
    hasFiles: () => services.files !== undefined,
    makeDriver: ({ stage, narrator, mode, settingsBaseline }) =>
      createDriver({
        ctx,
        services,
        dispatch,
        confirm,
        stage,
        narrator,
        mode,
        settingsBaseline,
        dockStopBox: async () => {
          const d = screen.getPrimaryDisplay()
          return dockStopBox(d.bounds, d.workArea)
        },
        log,
      }),
  })

  const guard = (event: IpcMainEvent | IpcMainInvokeEvent): void => {
    if (!windows.owns(event.sender.id)) throw new Error('IPC from an unknown sender')
  }
  const sanitize = (raw: unknown): ShowtimeStartOptions => {
    const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
    return { ...(typeof o.full === 'boolean' ? { full: o.full } : {}), ...(ModeOk(o.mode) ? { mode: o.mode } : {}) }
  }
  ipcMain.handle(IPC.showtimeStart, async (event, opts) => {
    guard(event)
    await showtime.start(sanitize(opts))
  })
  ipcMain.handle(IPC.showtimeStop, async (event) => {
    guard(event)
    await showtime.stop()
  })
  ipcMain.handle(IPC.showtimeNext, (event) => {
    guard(event)
    showtime.next()
  })
  ipcMain.handle(IPC.showtimePrev, (event) => {
    guard(event)
    showtime.prev()
  })
  ipcMain.handle(IPC.showtimePause, (event) => {
    guard(event)
    showtime.pause()
  })
  ipcMain.handle(IPC.showtimeState, (event) => {
    guard(event)
    return showtime.state()
  })

  bindShowtimeBus(ctx.bus, showtime, log)
  // Hands-free launch for the demo and for headless smoke runs: ALONGSIDE_SHOWTIME_AUTOSTART=1 starts the tour once the windows are up.
  if (process.env.ALONGSIDE_SHOWTIME_AUTOSTART === '1') setTimeout(() => ctx.bus.emit('showtime:request', { source: 'cli' }), 3000)

  return showtime
}
