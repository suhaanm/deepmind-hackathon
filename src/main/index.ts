import path from 'node:path'
import dotenv from 'dotenv'
import { app, systemPreferences } from 'electron'
import { IPC } from '../shared/ipc'
import type { EventArgs, EventChannel } from '../shared/ipc'
import { Bus } from './bus'
import { ConfirmBroker } from './confirm'
import type { ServiceContext } from './context'
import { startDebugServer } from './debug-server'
import { registerHotkeys } from './hotkey'
import { registerIpc } from './ipc'
import { createServices } from './services'
import { registerSession } from './session'
import { SettingsStore } from './settings'
import { StateStore } from './state'
import { createDispatcher } from './tools/dispatcher'
import { createWindows } from './windows'

// The key lives only in REPO/.env; it is never logged or sent to a renderer.
if (process.env.ALONGSIDE_USERDATA) app.setPath('userData', path.resolve(process.env.ALONGSIDE_USERDATA))
dotenv.config({ path: path.join(app.getAppPath(), '.env'), quiet: true })

const flag = (name: string) => process.env[name] === '1'

void app.whenReady().then(async () => {
  const headless = flag('ALONGSIDE_HEADLESS')
  const userDataDir = app.getPath('userData')

  const bus = new Bus()
  const settings = new SettingsStore(userDataDir)
  const state = new StateStore(settings.get())
  const windows = createWindows({ noOverlay: flag('ALONGSIDE_NO_OVERLAY'), headless })

  const ctx: ServiceContext = {
    state,
    bus,
    settings,
    userDataDir,
    sendOverlay: (cmd) => windows.sendOverlay(IPC.overlayCmd, cmd),
    sendDock: <C extends EventChannel>(channel: C, ...args: EventArgs<C>) => windows.sendDock(channel, ...args),
    log: (scope, ...args) => console.log(`[${scope}]`, ...args),
  }

  // Coalesce bursts of patches into one broadcast per tick.
  let flushQueued = false
  state.subscribe(() => {
    if (flushQueued) return
    flushQueued = true
    setImmediate(() => {
      flushQueued = false
      windows.broadcast(IPC.stateUpdate, state.get())
    })
  })

  const services = createServices(ctx)
  if (flag('ALONGSIDE_DEV_STAGE') || flag('ALONGSIDE_RECORD') || process.env.ALONGSIDE_REPLAY) void import('./dev').then((dev) => dev.installDev({ ctx, services })) // QA hooks + record/replay (dev only)
  const confirm = new ConfirmBroker(state)
  const dispatch = createDispatcher(ctx, services, confirm)
  const session = registerSession(ctx, services, confirm)
  registerIpc({ ctx, services, windows, dispatch, confirm, session })

  const unregisterHotkeys = registerHotkeys(bus, settings, { state, stop: (r) => session.stop(r) })
  app.on('will-quit', () => {
    unregisterHotkeys()
    services.agents.dispose?.() // AGENTS hook: dispose on quit
    settings.flush()
  })

  if (!app.isPackaged || flag('ALONGSIDE_DEBUG')) {
    startDebugServer({ ctx, services, dispatch, session, capture: { overlayPng: windows.overlayPng, dockPng: windows.dockPng } })
  }

  if (!headless && !flag('ALONGSIDE_MOCK') && process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('microphone') === 'not-determined') {
    void systemPreferences.askForMediaAccess('microphone')
  }
})

app.on('window-all-closed', () => app.quit())
