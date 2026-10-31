// QA test hooks. Inert unless ALONGSIDE_DEV_STAGE=1 (installed by one guarded line in src/main/index.ts).
// Separate dev HTTP on 127.0.0.1:${ALONGSIDE_DEV_PORT:-7778}: stage window + ground truth, overlay call log,
// outbound Gemini request log (spend, store flag) and network fault injection. Never logs headers or keys.
import http from 'node:http'
import { BrowserWindow, screen } from 'electron'
import type { Services } from '../../shared/contracts'
import type { Annotation } from '../../shared/protocol'
import type { ServiceContext } from '../context'
import { installFetchProbe } from './fetch-probe'
import type { FaultSpec } from './fetch-probe'

export interface DevDeps {
  ctx: ServiceContext
  services: Services
}

const STAGE_URL = process.env.ALONGSIDE_STAGE_URL || `http://127.0.0.1:${process.env.STAGE_PORT || 5180}/`
const MAX_BODY = 100_000

interface GroundTruthRect {
  id: string
  x: number
  y: number
  w: number
  h: number
  // Same box in normalised 0-1000 coordinates of the stage viewport (== primary display when fullscreen).
  norm: { xmin: number; ymin: number; xmax: number; ymax: number }
  text: string
}

// Runs inside the stage page. Visible = non-empty rect inside the viewport and not covered by another element.
const RECTS_JS = `(() => {
  const vw = window.innerWidth, vh = window.innerHeight
  const out = []
  for (const el of document.querySelectorAll('[data-ground-id]')) {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue
    const cx = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(vh - 1, Math.max(0, r.top + r.height / 2))
    if (r.right < 0 || r.bottom < 0 || r.left > vw || r.top > vh) continue
    const top = document.elementFromPoint(cx, cy)
    if (!top || !(top === el || el.contains(top) || top.contains(el))) continue
    const x1 = Math.max(0, r.left), y1 = Math.max(0, r.top), x2 = Math.min(vw, r.right), y2 = Math.min(vh, r.bottom)
    out.push({ id: el.getAttribute('data-ground-id'), x: x1, y: y1, w: x2 - x1, h: y2 - y1,
      norm: { xmin: x1 / vw * 1000, ymin: y1 / vh * 1000, xmax: x2 / vw * 1000, ymax: y2 / vh * 1000 },
      text: (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 60) })
  }
  return { viewport: { w: vw, h: vh, dpr: window.devicePixelRatio }, rects: out }
})()`

function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) return reject(new Error('body too large'))
      chunks.push(c)
    })
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8')
      try {
        resolve(text ? (JSON.parse(text) as Record<string, unknown>) : {})
      } catch {
        reject(new Error('invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

export function installDev({ ctx, services }: DevDeps): void {
  const probe = installFetchProbe()
  const overlayLog: { t: number; op: 'show' | 'clear'; annotations?: Annotation[]; ids?: string[] }[] = []
  let stage: BrowserWindow | null = null

  // Record what the overlay was asked to draw; the real controller still runs.
  const overlay = services.overlay
  const show = overlay.show.bind(overlay)
  const clear = overlay.clear.bind(overlay)
  overlay.show = (annotations) => {
    overlayLog.push({ t: Date.now(), op: 'show', annotations })
    show(annotations)
  }
  overlay.clear = (ids) => {
    overlayLog.push({ t: Date.now(), op: 'clear', ids })
    clear(ids)
  }

  const stageEval = <T>(js: string): Promise<T> => {
    if (!stage || stage.isDestroyed()) return Promise.reject(new Error('stage window is not open'))
    return stage.webContents.executeJavaScript(js, true) as Promise<T>
  }

  async function openStage(): Promise<{ viewport: { w: number; h: number }; display: { w: number; h: number; scale: number } }> {
    const display = screen.getPrimaryDisplay()
    if (!stage || stage.isDestroyed()) {
      stage = new BrowserWindow({
        ...display.bounds,
        frame: false,
        show: false,
        backgroundColor: '#ffffff',
        title: 'Alongside QA stage',
        webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
      })
      stage.on('closed', () => {
        stage = null
      })
      await stage.loadURL(STAGE_URL)
      if (process.platform === 'darwin') stage.setSimpleFullScreen(true)
      stage.showInactive()
    }
    const deadline = Date.now() + 8000
    while (Date.now() < deadline) {
      const ready = await stageEval<boolean>('Boolean(window.__stage || document.querySelector("[data-ground-id]"))').catch(() => false)
      if (ready) break
      await new Promise((r) => setTimeout(r, 150))
    }
    const viewport = await stageEval<{ w: number; h: number }>('({ w: window.innerWidth, h: window.innerHeight })')
    return { viewport, display: { w: display.bounds.width, h: display.bounds.height, scale: display.scaleFactor } }
  }

  const server = http.createServer(async (req, res) => {
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    try {
      const host = req.headers.host ?? ''
      if (req.headers.origin || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(403, { error: 'forbidden' })
      const url = new URL(req.url ?? '/', `http://${host}`)
      const route = `${req.method} ${url.pathname}`
      switch (route) {
        case 'GET /dev/health':
          return send(200, { ok: true, stageOpen: Boolean(stage && !stage.isDestroyed()) })
        case 'POST /dev/stage/open':
          return send(200, await openStage())
        case 'POST /dev/stage/close':
          if (stage && !stage.isDestroyed()) stage.destroy()
          stage = null
          return send(200, { ok: true })
        case 'GET /dev/stage/rects':
          return send(200, await stageEval<{ viewport: unknown; rects: GroundTruthRect[] }>(RECTS_JS))
        case 'GET /dev/stage/flows':
          return send(200, await stageEval<unknown>('JSON.parse(JSON.stringify(window.STAGE_FLOWS || null))'))
        case 'POST /dev/stage/call': {
          // Only functions on window.__stage (setStep, deliverScam, ...); no arbitrary script.
          const body = await readJson(req)
          const fn = String(body.fn ?? '')
          if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(fn)) return send(400, { error: 'bad fn' })
          const args = JSON.stringify(Array.isArray(body.args) ? body.args : [])
          const result = await stageEval<unknown>(`(async () => { const f = window.__stage && window.__stage[${JSON.stringify(fn)}]; if (typeof f !== 'function') throw new Error('no __stage.' + ${JSON.stringify(fn)}); const r = await f(...${args}); return r === undefined ? null : JSON.parse(JSON.stringify(r)) })()`)
          return send(200, { result })
        }
        case 'POST /dev/dock': {
          const body = await readJson(req)
          for (const win of BrowserWindow.getAllWindows()) {
            if (win.getTitle() !== 'Alongside') continue
            if (body.visible === false) win.hide()
            else win.showInactive()
          }
          return send(200, { ok: true })
        }
        case 'GET /dev/overlay/log':
          return send(200, overlayLog)
        case 'POST /dev/overlay/log/clear':
          overlayLog.length = 0
          return send(200, { ok: true })
        case 'GET /dev/fetch/log':
          return send(200, probe.log)
        case 'POST /dev/fetch/log/clear':
          probe.log.length = 0
          return send(200, { ok: true })
        case 'POST /dev/fault': {
          const body = await readJson(req)
          probe.setFault(body as unknown as FaultSpec)
          return send(200, { ok: true, fault: probe.getFault() })
        }
        case 'GET /dev/fault':
          return send(200, { fault: probe.getFault() })
        case 'GET /dev/services':
          return send(200, {
            mockEnv: process.env.ALONGSIDE_MOCK === '1',
            perService: Object.fromEntries(Object.keys(services).map((n) => [n, process.env[`ALONGSIDE_MOCK_${n.toUpperCase()}`] === '1'])),
            keyPresent: Boolean(process.env.GEMINI_API_KEY),
          })
        default:
          return send(404, { error: 'not found' })
      }
    } catch (err) {
      send(500, { error: err instanceof Error ? err.message : String(err) })
    }
  })
  const port = Number(process.env.ALONGSIDE_DEV_PORT || 7778)
  server.listen(port, '127.0.0.1', () => ctx.log('dev', `qa hooks on 127.0.0.1:${port}`))
  server.on('error', (err) => ctx.log('dev', 'server error:', err.message))
}
