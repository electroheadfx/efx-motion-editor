#!/usr/bin/env node
// ============================================================
//  reference.mjs — drive the craft-brushes reference lab (WebGPU)
//  in headless Chrome and measure its panels with the SHARED metric
//  library, so the 261119-pod acceptance compares like with like.
//
//  Scratch harness only: nothing here is imported by the package.
//
//  Usage: node probe/port-comparison/reference.mjs [--out <metrics.json>]
//
//  Protocol (fixed):
//    - a transient python3 http.server, bound to 127.0.0.1 on an ephemeral
//      port and rooted at the reference site, is killed in a finally block;
//    - headless Chrome with WebGPU enabled and a throwaway /tmp profile;
//    - one page load per scene at
//        /lab.html?blank&clean&capture&hud=0&ratio=1&seed=7
//          &look.paper=%23f6f3ec&refill=0&pickup=<p>&smear=<p>&softness=<s>
//      (paper = Studio's cold tint, smear = pickup: the Studio mapping,
//      softness = 0.09 + 0.25 * Feather);
//    - the palette has no yellow, so before each band stroke
//      window.canvas.cycle.next is set to the yellow entry and before each
//      blue stroke to the cornflower entry — cycle.next() is the brush's
//      colour source at app.js:1949;
//    - one frame per move (a real 60 Hz drag) plus eight settle frames;
//    - the pixels are reduced IN PAGE by the bundled metric library; only
//      the small record and the panel PNG cross the wire.
//
//  The band must measure yellow on every band scene (hue 30..75, chroma
//  above the paper floor): an orange or blank LEFT panel is a failure,
//  never a result. A blank raster (mean luma 0) first retries through
//  Page.captureScreenshot and then STOPS with the Chrome version.
// ============================================================

import { spawn, spawnSync } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/port-comparison'
const SITE = '/Users/lmarques/Dev/craft-brushes/site'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const CANVAS = 'canvas.canvas'

const args = process.argv.slice(2)
const outFlag = args.indexOf('--out')
const outPath = outFlag >= 0 ? args[outFlag + 1] : join(here, 'captures', 'reference', 'metrics.json')

// The seven reference-paired scenes — the same table as probe.ts minus the
// two Studio-only Body scenes (the reference has no Body control).
const SCENES = [
  { name: 'blank', band: false, stroke: false, pickup: 0, softness: 0.09 },
  { name: 'band', band: true, stroke: false, pickup: 0, softness: 0.09 },
  { name: 'band-p0', band: true, stroke: true, pickup: 0, softness: 0.09 },
  { name: 'band-p100', band: true, stroke: true, pickup: 100, softness: 0.09 },
  { name: 'blank-p0', band: false, stroke: true, pickup: 0, softness: 0.09 },
  { name: 'blank-f0', band: false, stroke: true, pickup: 100, softness: 0.09 },
  { name: 'blank-f100', band: false, stroke: true, pickup: 100, softness: 0.34 },
]

// RULING 2026-11-19: the blue brush width is a CLI knob. The reference's
// widening is brush-width dependent, so it must be captured at the width
// that matches Studio's Feather-0 mark before its shape is used as a bar.
const widthFlag = args.indexOf('--width')
const BLUE_WIDTH = widthFlag >= 0 ? Number(args[widthFlag + 1]) : 0.085
if (!(BLUE_WIDTH > 0)) fail('--width must be a positive fraction of the short side')

const YELLOW = { color: '#e8c21a', depletion: 1, spread: 0.85, width: 0.12, name: 'yellow' }
const CORNFLOWER = { color: '#5994e4', depletion: 0.75, spread: 0.85, width: BLUE_WIDTH, name: 'cornflower' }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function fail(message) {
  console.error(`[port-comparison:reference] ${message}`)
  process.exit(1)
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

async function waitForJson(url, timeoutMs = 20000) {
  const t0 = Date.now()
  let lastErr
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return await res.json()
    } catch (error) {
      lastErr = error
    }
    await sleep(150)
  }
  throw new Error(`timeout waiting for ${url}: ${lastErr?.message}`)
}

class CDP {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP timeout: ${method}`))
        }
      }, 60000)
    })
  }
  async evaluate(expression, awaitPromise = false) {
    const r = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    })
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails))
    return r.result.value
  }
}

// ------------------------------------------------------- in-page helpers

const PAGE_HELPERS = `
window.__pcRead = function () {
  const c = document.querySelector('${CANVAS}')
  if (!c) throw new Error('reference: no ${CANVAS} element')
  const t = document.createElement('canvas')
  t.width = c.width
  t.height = c.height
  const g = t.getContext('2d')
  g.drawImage(c, 0, 0)
  const image = g.getImageData(0, 0, t.width, t.height)
  let sum = 0
  for (let i = 0; i < image.data.length; i += 4) {
    sum += image.data[i] + image.data[i + 1] + image.data[i + 2]
  }
  return {
    width: t.width,
    height: t.height,
    data: image.data,
    mean: sum / (image.data.length / 4) / 3,
    png: t.toDataURL('image/png'),
  }
}
window.__pcStore = function (key) {
  const r = window.__pcRead()
  window.__pc = window.__pc || {}
  window.__pc[key] = { width: r.width, height: r.height, data: r.data }
  return { width: r.width, height: r.height, mean: r.mean, png: r.png }
}
window.__pcStoreFromDataUrl = function (key, dataUrl) {
  return new Promise(function (resolve, reject) {
    const img = new Image()
    img.onload = function () {
      const t = document.createElement('canvas')
      t.width = img.naturalWidth
      t.height = img.naturalHeight
      const g = t.getContext('2d')
      g.drawImage(img, 0, 0)
      const image = g.getImageData(0, 0, t.width, t.height)
      window.__pc = window.__pc || {}
      window.__pc[key] = { width: t.width, height: t.height, data: image.data }
      let sum = 0
      for (let i = 0; i < image.data.length; i += 4) {
        sum += image.data[i] + image.data[i + 1] + image.data[i + 2]
      }
      resolve({ width: t.width, height: t.height, mean: sum / (image.data.length / 4) / 3, png: t.toDataURL('image/png') })
    }
    img.onerror = function () { reject(new Error('screenshot raster decode failed')) }
    img.src = dataUrl
  })
}
window.__pcMeasure = function (scene, params) {
  const pc = window.__pc || {}
  return PC_METRICS.measureScene({
    scene: scene,
    pre: pc.pre,
    substrate: pc.substrate || null,
    finalPaper: pc.final,
    finalPigment: null,
    params: params,
  })
}
window.__pcSetCycle = function (entry) {
  window.canvas.cycle.next = function () { return Object.assign({}, entry) }
  return window.canvas.cycle.peek ? window.canvas.cycle.peek().name : 'patched'
}
`

// ------------------------------------------------------------- the driver

async function main() {
  if (!existsSync(SITE)) fail(`reference site not found at ${SITE}`)
  if (!existsSync(CHROME)) fail(`Chrome not found at ${CHROME}`)

  // The shared metric library as a browser IIFE (global PC_METRICS), and the
  // helpers that read the lab canvas into it.
  mkdirSync(outDir, { recursive: true })
  const metricsPagePath = join(outDir, 'metrics.page.js')
  const esbuildCandidates = [
    join(repoRoot, 'node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild'),
    join(repoRoot, 'node_modules/.bin/esbuild'),
  ]
  const esbuild = esbuildCandidates.find((path) => existsSync(path))
  if (!esbuild) fail('esbuild not found; candidates:\n  ' + esbuildCandidates.join('\n  '))
  const build = spawnSync(
    esbuild,
    [
      join(here, 'metrics.ts'),
      '--bundle',
      '--format=iife',
      '--global-name=PC_METRICS',
      '--platform=browser',
      '--target=es2022',
      '--log-level=warning',
      `--outfile=${metricsPagePath}`,
    ],
    { encoding: 'utf8' },
  )
  if (build.status !== 0) fail(build.stderr || build.stdout || 'esbuild failed')
  const metricsSource = readFileSync(metricsPagePath, 'utf8')

  const httpPort = await freePort()
  const cdpPort = await freePort()
  const server = spawn('python3', ['-m', 'http.server', String(httpPort), '--bind', '127.0.0.1'], {
    cwd: SITE,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stderr.on('data', () => {})

  const profile = `/tmp/port-comparison/profile-${process.pid}`
  const PRIMARY_FLAGS = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-webgpu',
    '--disable-gpu-sandbox',
    '--enable-features=Vulkan',
    '--use-angle=metal',
    '--hide-scrollbars',
    '--window-size=800,600',
  ]
  // The SwiftShader fallback, tried once when the primary set yields no GPU
  // adapter (the plan's fallback rule).
  const FALLBACK_FLAGS = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,UseSkiaRenderer',
    '--use-angle=swiftshader',
    '--hide-scrollbars',
    '--window-size=800,600',
  ]

  let chrome = null
  let cdp = null
  let ws = null
  let chromeStderr = ''

  async function launch(flags) {
    chrome = spawn(
      CHROME,
      [...flags, `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, 'about:blank'],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    )
    chromeStderr = ''
    chrome.stderr.on('data', (d) => {
      chromeStderr += d.toString()
    })
    const targets = await waitForJson(`http://127.0.0.1:${cdpPort}/json/list`)
    const page = targets.find((t) => t.type === 'page')
    if (!page) throw new Error('no page target')
    ws = new WebSocket(page.webSocketDebuggerUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res)
      ws.addEventListener('error', rej)
    })
    cdp = new CDP(ws)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 800,
      height: 600,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: metricsSource })
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PAGE_HELPERS })
  }

  async function killChrome() {
    try {
      ws?.close()
    } catch {
      /* already closed */
    }
    if (chrome) chrome.kill('SIGKILL')
    chrome = null
    cdp = null
    ws = null
    await sleep(250)
  }

  const screenshotRaster = async (key, rect) => {
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: rect.left, y: rect.top, width: rect.width, height: rect.height, scale: 1 },
      captureBeyondViewport: false,
    })
    const dataUrl = `data:image/png;base64,${shot.data}`
    return cdp.evaluate(
      `window.__pcStoreFromDataUrl(${JSON.stringify(key)}, ${JSON.stringify(dataUrl)})`,
      true,
    )
  }

  /** Read the lab canvas into window.__pc[key]; screenshot fallback on a blank read. */
  const storeRaster = async (key, rect) => {
    const read = await cdp.evaluate(`window.__pcStore(${JSON.stringify(key)})`)
    if (read.mean > 1) return read
    console.error(`[port-comparison:reference] blank raster for "${key}" — retrying through Page.captureScreenshot`)
    const shot = await screenshotRaster(key, rect)
    if (!(shot.mean > 1)) {
      const version = await cdp.evaluate('navigator.userAgent')
      fail(
        `every raster for "${key}" is blank (mean luma ${shot.mean}). Chrome: ${version}. ` +
          `Flags tried: primary WebGPU set and the SwiftShader fallback. Chrome stderr tail: ${chromeStderr.slice(-1500)}`,
      )
    }
    return shot
  }

  /** One 1/60 s capture step (the lab's frame seam). */
  const stepFrame = () => cdp.evaluate('window.capture.frame()', true)

  const dispatchStroke = async (rect, from, to, steps = 12) => {
    const px = (uv) => ({ x: rect.left + uv.x * rect.width, y: rect.top + (1 - uv.y) * rect.height })
    const a = px(from)
    const b = px(to)
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: a.x,
      y: a.y,
      button: 'left',
      buttons: 1,
      clickCount: 1,
      pointerType: 'mouse',
    })
    for (let i = 1; i <= steps; i += 1) {
      const x = a.x + ((b.x - a.x) * i) / steps
      const y = a.y + ((b.y - a.y) * i) / steps
      await cdp.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x,
        y,
        button: 'left',
        buttons: 1,
        pointerType: 'mouse',
      })
      // One frame per move: the lab's brush smooths toward the pointer on
      // each frame, so a drag that never yields a frame paints nothing.
      await stepFrame()
    }
    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: b.x,
      y: b.y,
      button: 'left',
      buttons: 0,
      clickCount: 1,
      pointerType: 'mouse',
    })
  }

  const renderScene = async (scene) => {
    const pickup = scene.pickup
    const query =
      `blank&clean&capture&hud=0&ratio=1&seed=7&look.paper=%23f6f3ec&refill=0` +
      `&pickup=${pickup}&smear=${pickup}&softness=${scene.softness}`
    const url = `http://127.0.0.1:${httpPort}/lab.html?${query}`
    await cdp.send('Page.navigate', { url })

    // Readiness: capture mode adds `is-ready` to <html> when the frame seam
    // is installed. The href check is load-bearing — right after navigate the
    // old document is still alive, and its `is-ready` would read as this
    // scene's readiness. Poll rather than guess a sleep.
    const t0 = Date.now()
    let ready = false
    while (Date.now() - t0 < 45000) {
      try {
        ready = await cdp.evaluate(
          `location.href === ${JSON.stringify(url)} && document.documentElement.classList.contains('is-ready')`,
        )
      } catch {
        ready = false // mid-navigation execution context
      }
      if (ready) break
      await sleep(200)
    }
    if (!ready) fail(`scene "${scene.name}": the lab never reported is-ready`)
    const gpu = await cdp.evaluate('typeof navigator.gpu')
    if (gpu !== 'object') fail(`scene "${scene.name}": navigator.gpu is ${gpu}`)

    const rect = await cdp.evaluate(
      `(() => { const c = document.querySelector('${CANVAS}'); if (!c) return null; const r = c.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height } })()`,
    )
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) fail(`scene "${scene.name}": no canvas rect`)

    await stepFrame()
    await stepFrame()
    await storeRaster('pre', rect)

    if (scene.band) {
      await cdp.evaluate(`window.__pcSetCycle(${JSON.stringify(YELLOW)})`)
      await dispatchStroke(rect, { x: 0.12, y: 0.5 }, { x: 0.88, y: 0.5 })
      for (let i = 0; i < 8; i += 1) await stepFrame()
      await storeRaster('substrate', rect)
      await cdp.evaluate('delete window.__pc.final')
    }

    if (scene.stroke) {
      await cdp.evaluate(`window.__pcSetCycle(${JSON.stringify(CORNFLOWER)})`)
      await dispatchStroke(rect, { x: 0.12, y: 0.5 }, { x: 0.88, y: 0.5 })
      for (let i = 0; i < 8; i += 1) await stepFrame()
    }
    // The final raster is the sheet as the eye leaves it: blank for `blank`,
    // the band for `band`, the band + blue for the crossing scenes. Its png
    // is the committed panel: a direct WebGPU drawImage read is blank, so
    // the store's screenshot-fallback png is the only honest one.
    const finalStore = await storeRaster('final', rect)

    const params = {
      color: scene.stroke ? CORNFLOWER.color : scene.band ? YELLOW.color : null,
      brushId: 'reference-lab',
      sizePx: null,
      pickup: scene.pickup,
      feather: Math.round(((scene.softness - 0.09) / 0.25) * 100),
      body: null,
      refill: 0,
      cycleEntry: scene.stroke ? CORNFLOWER.name : scene.band ? YELLOW.name : null,
      urlPickup: pickup / 100,
      urlSmear: pickup / 100,
      urlSoftness: scene.softness,
    }
    const record = await cdp.evaluate(
      `window.__pcMeasure(${JSON.stringify(scene.name)}, ${JSON.stringify(params)})`,
    )
    return { record, panel: finalStore.png }
  }

  const records = {}
  const panels = {}
  const started = Date.now()
  try {
    console.log('[port-comparison:reference] launching headless Chrome (WebGPU) ...')
    await launch(PRIMARY_FLAGS)
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${httpPort}/lab.html?blank&clean&capture&hud=0&ratio=1&seed=7&look.paper=%23f6f3ec` })
    await sleep(1500)
    const adapter = await cdp.evaluate(
      '(async () => { const a = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" }); return a ? (a.info?.description ?? "adapter") : null })()',
      true,
    )
    if (!adapter) {
      console.error('[port-comparison:reference] no WebGPU adapter with the primary flags — retrying with the SwiftShader set')
      await killChrome()
      await launch(FALLBACK_FLAGS)
    } else {
      console.log(`[port-comparison:reference] WebGPU adapter: ${adapter}`)
    }

    for (const scene of SCENES) {
      const { record, panel } = await renderScene(scene)
      records[scene.name] = record
      panels[scene.name] = panel
      if (scene.band) {
        const hue = record.bandHueDeg
        const chroma = record.bandChroma
        console.log(`  ${scene.name.padEnd(10)} band hue ${hue} chroma ${chroma}`)
        if (!(typeof hue === 'number' && hue > 30 && hue < 75) || !(typeof chroma === 'number' && chroma > 0.05)) {
          fail(
            `scene "${scene.name}": the band is not yellow (hue ${hue}, chroma ${chroma}) — ` +
              'an orange or blank LEFT panel is a failure, never a result',
          )
        }
      } else {
        console.log(`  ${scene.name.padEnd(10)} ${record.strokeHalfWidthPx ?? 'n/a'} px half-width`)
      }
    }
  } finally {
    await killChrome()
    server.kill('SIGKILL')
  }

  const halfWidths = Object.values(records)
    .map((record) => record.strokeHalfWidthPx)
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
  const calibration = {
    measuredHalfWidthPx:
      halfWidths.length > 0
        ? Math.round((halfWidths.reduce((a, b) => a + b, 0) / halfWidths.length) * 100) / 100
        : null,
    referenceTargetHalfWidthPx: Math.round(BLUE_WIDTH * 600 * 50) / 100,
    referenceTargetNote: `cycle-entry width ${BLUE_WIDTH} x 600 px / 2`,
  }

  const panelDir = join(outDir, 'reference')
  mkdirSync(panelDir, { recursive: true })
  for (const [name, png] of Object.entries(panels)) {
    writeFileSync(join(panelDir, `${name}-paper.png`), Buffer.from(png.split(',')[1], 'base64'))
  }

  const payload = {
    label: 'reference',
    calibration,
    elapsedMs: Date.now() - started,
    scenes: records,
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n')
  console.log(`[port-comparison:reference] capture written: ${outPath}`)
  console.log(`[port-comparison:reference] panels: ${panelDir}`)
  console.log(
    `[port-comparison:reference] calibration: measured half-width ${calibration.measuredHalfWidthPx} px (Studio target ${calibration.referenceTargetHalfWidthPx} px)`,
  )
}

await main()
