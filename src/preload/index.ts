import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC } from '../shared/ipc'
import type { AlongsideApi, EventArgs, EventChannel, InvokeArgs, InvokeChannel, InvokeResult, SendArgs, SendChannel, Unsubscribe } from '../shared/ipc'

const invoke = <C extends InvokeChannel>(channel: C, ...args: InvokeArgs<C>): Promise<InvokeResult<C>> => ipcRenderer.invoke(channel, ...args)
const send = <C extends SendChannel>(channel: C, ...args: SendArgs<C>): void => ipcRenderer.send(channel, ...args)
const on = <C extends EventChannel>(channel: C, cb: (...args: EventArgs<C>) => void): Unsubscribe => {
  const handler = (_event: IpcRendererEvent, ...args: unknown[]) => cb(...(args as EventArgs<C>))
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.off(channel, handler)
}

const api: AlongsideApi = {
  getState: () => invoke(IPC.stateGet),
  onState: (cb) => on(IPC.stateUpdate, cb),
  patchState: (patch) => invoke(IPC.statePatch, patch),
  getSettings: () => invoke(IPC.settingsGet),
  patchSettings: (patch) => invoke(IPC.settingsPatch, patch),

  overlayReady: (size) => send(IPC.overlayReady, size),
  onOverlayCommand: (cb) => on(IPC.overlayCmd, cb),

  wakeDetected: (req) => send(IPC.wakeDetected, req),
  onSessionStart: (cb) => on(IPC.sessionStart, cb),
  onSessionStop: (cb) => on(IPC.sessionStop, cb),
  sessionEnded: (reason) => send(IPC.sessionEnded, reason),
  pressStop: () => send(IPC.stopPressed),

  live: {
    getToken: (personaId) => invoke(IPC.liveToken, personaId),
    systemInstruction: (personaId) => invoke(IPC.teachingSystemInstruction, personaId),
    toolCall: (call) => invoke(IPC.liveToolCall, call),
    onInject: (cb) => on(IPC.liveInject, cb),
    transcript: (t) => send(IPC.liveTranscript, t),
    status: (s) => send(IPC.liveStatus, s),
    liveFrame: () => invoke(IPC.captureLiveFrame),
  },
  wake: {
    getToken: () => invoke(IPC.wakeToken),
  },

  answerConfirm: (answer) => send(IPC.confirmAnswer, answer),
  learnerSnapshot: () => invoke(IPC.learnerSnapshot),
  learnerMarkdown: (req) => invoke(IPC.learnerMarkdown, req),
  cancelAgent: (id) => invoke(IPC.agentCancel, id),
  setDockMode: (mode) => invoke(IPC.dockMode, mode),
}

contextBridge.exposeInMainWorld('alongside', api)
