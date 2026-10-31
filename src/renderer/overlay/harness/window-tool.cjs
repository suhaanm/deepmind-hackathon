// Electron helper for real-check.mjs (run only inside scripts/electron-lock.sh). Modes:
//   stage <url> <outdir>            frameless window over the primary display showing the stage; writes rects.json
//   click <outdir>                  small frameless window with one big button; prints CLICKED when it receives a click
//   fullscreen                      native full-screen window (a new Space), to test the overlay above full-screen apps
//   analyze <png> <rects> <id> <hex>  ring bbox of colour <hex> in a PNG vs the stage element <id>; prints JSON
//   count <image> <hex>             number of pixels near colour <hex>; prints JSON
//   composite <shot> <overlay> <out>  overlay.png over shot.jpg -> out.png (for eyeballing)
const { app, BrowserWindow, nativeImage, screen } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const [mode, ...rest] = process.argv.slice(2)
// Own profile dir: two Electron processes sharing a userData dir make the second one exit (Chromium singleton).
app.setPath('userData', fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'overlay-tool-')))
app.disableHardwareAcceleration()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const say = (obj) => console.log('[window-tool] ' + (typeof obj === 'string' ? obj : JSON.stringify(obj)))

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function scan(image, hex, tol = 14) {
  const { width, height } = image.getSize()
  const bmp = image.toBitmap() // BGRA
  const [r, g, b] = hexToRgb(hex)
  let count = 0
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (bmp[i + 3] < 250) continue
      if (Math.abs(bmp[i + 2] - r) <= tol && Math.abs(bmp[i + 1] - g) <= tol && Math.abs(bmp[i] - b) <= tol) {
        count++
        if (x < x0) x0 = x
        if (y < y0) y0 = y
        if (x > x1) x1 = x
        if (y > y1) y1 = y
      }
    }
  }
  return { width, height, count, bbox: count ? { x0, y0, x1, y1 } : null }
}

app.whenReady().then(async () => {
  const display = screen.getPrimaryDisplay()
  if (mode === 'stage') {
    const [url, outdir] = rest
    const win = new BrowserWindow({ ...display.bounds, frame: false, show: false, alwaysOnTop: true, hasShadow: false, resizable: false, webPreferences: { backgroundThrottling: false } })
    win.setAlwaysOnTop(true, 'floating')
    await win.loadURL(url)
    win.setBounds(display.bounds)
    win.showInactive()
    await sleep(1800)
    const data = await win.webContents.executeJavaScript(`(() => { const out = {}; document.querySelectorAll('[data-ground-id]').forEach((el) => { const r = el.getBoundingClientRect(); out[el.getAttribute('data-ground-id')] = { x: r.x, y: r.y, w: r.width, h: r.height } }); return { viewport: { w: innerWidth, h: innerHeight }, rects: out } })()`)
    fs.writeFileSync(path.join(outdir, 'rects.json'), JSON.stringify(data))
    say('READY stage')
    return
  }
  if (mode === 'click') {
    const b = { x: 300, y: 330, width: 500, height: 300 }
    const win = new BrowserWindow({ ...b, frame: false, show: false, alwaysOnTop: true, hasShadow: false, resizable: false, webPreferences: { backgroundThrottling: false } })
    win.setAlwaysOnTop(true, 'floating')
    await win.loadURL('data:text/html,' + encodeURIComponent('<body style="margin:0"><button id=b style="width:100vw;height:100vh;font:32px sans-serif;background:#2d9d5b;color:#fff;border:0" onclick="document.body.style.background=\'#c0392b\';document.getElementById(\'b\').style.background=\'#c0392b\';document.getElementById(\'b\').textContent=\'CLICKED\';console.log(\'CLICK-TARGET-RECEIVED\')">click target</button></body>'))
    win.webContents.on('console-message', (_e, _l, message) => message.includes('CLICK-TARGET-RECEIVED') && say('CLICKED'))
    win.setBounds(b)
    win.showInactive()
    say({ ready: 'click', center: { x: b.x + b.width / 2, y: b.y + b.height / 2 } })
    return
  }
  if (mode === 'fullscreen') {
    const win = new BrowserWindow({ show: false, backgroundColor: '#00bcd4', fullscreenable: true })
    await win.loadURL('data:text/html,' + encodeURIComponent('<body style="margin:0;background:#00bcd4;font:48px sans-serif"><h1>full-screen test app</h1></body>'))
    win.show()
    win.setFullScreen(true)
    await sleep(3000)
    say({ ready: 'fullscreen', isFullScreen: win.isFullScreen() })
    return
  }
  if (mode === 'count') {
    say(scan(nativeImage.createFromPath(rest[0]), rest[1]))
    app.quit()
    return
  }
  if (mode === 'analyze') {
    const [png, rectsFile, id, hex] = rest
    const r = scan(nativeImage.createFromPath(png), hex, 10)
    const { viewport, rects } = JSON.parse(fs.readFileSync(rectsFile, 'utf8'))
    const el = rects[id]
    const toNorm = (b, w, h) => ({ xmin: (b.x0 / w) * 1000, ymin: (b.y0 / h) * 1000, xmax: (b.x1 / w) * 1000, ymax: (b.y1 / h) * 1000 })
    const ring = r.bbox ? toNorm(r.bbox, r.width, r.height) : null
    const element = el ? { xmin: (el.x / viewport.w) * 1000, ymin: (el.y / viewport.h) * 1000, xmax: ((el.x + el.w) / viewport.w) * 1000, ymax: ((el.y + el.h) / viewport.h) * 1000 } : null
    const centre = (b) => ({ x: (b.xmin + b.xmax) / 2, y: (b.ymin + b.ymax) / 2 })
    const contains = ring && element ? ring.xmin <= element.xmin && ring.ymin <= element.ymin && ring.xmax >= element.xmax && ring.ymax >= element.ymax : false
    const off = ring && element ? { dx: centre(ring).x - centre(element).x, dy: centre(ring).y - centre(element).y } : null
    say({ id, ring, element, ringContainsElement: contains, centreOffsetNorm: off, ringPixels: r.count })
    app.quit()
    return
  }
  if (mode === 'composite') {
    const [shot, overlay, out] = rest
    const win = new BrowserWindow({ width: 1440, height: 931, show: false, useContentSize: true, webPreferences: { webSecurity: false } })
    const url = (p) => 'file://' + p
    await win.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;position:relative"><img src="${url(shot)}" style="position:absolute;left:0;top:0;width:100%"><img src="${url(overlay)}" style="position:absolute;left:0;top:0;width:100%"></body>`))
    await sleep(600)
    const img = await win.webContents.capturePage()
    fs.writeFileSync(out, img.toPNG())
    say('wrote ' + out)
    app.quit()
    return
  }
  say('unknown mode ' + mode)
  app.quit()
}).catch((e) => {
  console.error('[window-tool] failed', e)
  app.exit(1)
})
