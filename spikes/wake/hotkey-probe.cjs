// Which candidate global shortcuts can Electron register on this macOS? Hidden, no window.
const { app, globalShortcut } = require('electron')
const cands = ['CommandOrControl+Alt+Space', 'Control+Alt+Space', 'CommandOrControl+Alt+Shift+S', 'CommandOrControl+Alt+M', 'CommandOrControl+Alt+Escape', 'CommandOrControl+Alt+Shift+X', 'Alt+Space']
app.dock?.hide()
app.whenReady().then(() => {
  const res = {}
  for (const c of cands) {
    try { res[c] = globalShortcut.register(c, () => {}) && globalShortcut.isRegistered(c) } catch (e) { res[c] = `error: ${e.message}` }
  }
  console.log('HOTKEY_PROBE', JSON.stringify(res))
  globalShortcut.unregisterAll()
  app.quit()
})
