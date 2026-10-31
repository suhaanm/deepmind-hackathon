import path from 'node:path'
import { app, BrowserWindow, screen, session } from 'electron'
import type { DockMode, EventArgs, EventChannel } from '../shared/ipc'
import { configureOverlayWindow } from './capture/overlay-window'

export interface WindowOptions {
  noOverlay: boolean
  headless: boolean
}

export interface Windows {
  sendDock<C extends EventChannel>(channel: C, ...args: EventArgs<C>): void
  sendOverlay<C extends EventChannel>(channel: C, ...args: EventArgs<C>): void
  broadcast<C extends EventChannel>(channel: C, ...args: EventArgs<C>): void
  setDockMode(mode: DockMode): void
  owns(webContentsId: number): boolean
  overlayPng(): Promise<Buffer | null>
  dockPng(): Promise<Buffer | null>
  overlaySize(): { width: number; height: number } | null
}

const DOCK_SIZES: Record<DockMode, { width: number; height: number }> = {
  compact: { width: 380, height: 80 },
  expanded: { width: 380, height: 620 },
}
const MARGIN = 16

function loadRenderer(win: BrowserWindow, entry: 'dock' | 'overlay'): void {
  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) void win.loadURL(`${devUrl}/${entry}/index.html`)
  else void win.loadFile(path.join(__dirname, `../renderer/${entry}/index.html`))
}

function preloadPath(): string {
  return path.join(__dirname, '../preload/index.js')
}

export function createWindows(opts: WindowOptions): Windows {
  const display = screen.getPrimaryDisplay()
  let dockMode: DockMode = 'compact'

  const dockBounds = (mode: DockMode) => {
    const { width, height } = DOCK_SIZES[mode]
    const wa = display.workArea
    return { width, height, x: wa.x + wa.width - width - MARGIN, y: wa.y + wa.height - height - MARGIN }
  }

  const dock = new BrowserWindow({
    ...dockBounds(dockMode),
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#ffffff',
    title: 'Alongside',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // AudioContext and getUserMedia must work without a prior click (the wake spotter starts on its own).
      autoplayPolicy: 'no-user-gesture-required',
    },
  })
  dock.setAlwaysOnTop(true, 'floating')
  dock.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  loadRenderer(dock, 'dock')
  if (!opts.headless) dock.once('ready-to-show', () => dock.showInactive())

  let overlay: BrowserWindow | null = null
  if (!opts.noOverlay) {
    const { x, y, width, height } = display.bounds
    overlay = new BrowserWindow({
      x,
      y,
      width,
      height,
      show: false,
      transparent: true,
      frame: false,
      hasShadow: false,
      focusable: false,
      resizable: false,
      movable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      enableLargerThanScreen: true,
      ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
      webPreferences: { preload: preloadPath(), contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
    })
    overlay.setIgnoreMouseEvents(true)
    overlay.setAlwaysOnTop(true, 'screen-saver')
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
    overlay.setBounds({ x, y, width, height })
    configureOverlayWindow(overlay)
    loadRenderer(overlay, 'overlay')
    if (!opts.headless) overlay.once('ready-to-show', () => overlay?.showInactive())
  }

  // Our own windows may use the mic/camera/screen; nothing else may.
  const ours = (id: number | undefined) => id !== undefined && (id === dock.webContents.id || id === overlay?.webContents.id)
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    callback(ours(wc?.id) && ['media', 'display-capture', 'mediaKeyboardLock'].includes(permission))
  })
  session.defaultSession.setPermissionCheckHandler((wc, permission) => ours(wc?.id) && ['media', 'display-capture'].includes(permission))

  const safeSend = (win: BrowserWindow | null, channel: string, args: unknown[]) => {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send(channel, ...args)
  }

  const capture = async (win: BrowserWindow | null) => {
    if (!win || win.isDestroyed()) return null
    return (await win.webContents.capturePage()).toPNG()
  }

  app.on('before-quit', () => {
    dock.destroy()
    overlay?.destroy()
  })

  return {
    sendDock: (channel, ...args) => safeSend(dock, channel, args),
    sendOverlay: (channel, ...args) => safeSend(overlay, channel, args),
    broadcast: (channel, ...args) => {
      safeSend(dock, channel, args)
      safeSend(overlay, channel, args)
    },
    setDockMode(mode) {
      if (mode === dockMode) return
      dockMode = mode
      dock.setBounds(dockBounds(mode), true)
    },
    owns: ours,
    overlayPng: () => capture(overlay),
    dockPng: () => capture(dock),
    overlaySize: () => (overlay ? overlay.getBounds() : null),
  }
}
