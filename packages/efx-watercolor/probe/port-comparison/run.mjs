#!/usr/bin/env node
// ============================================================
//  run.mjs — drive the Studio half of the 261119-pod acceptance.
//
//  Scratch harness only: nothing here is imported by the package.
//
//  Usage:
//    node probe/port-comparison/run.mjs --run before|after
//           [--scene <name>] [--blue-size <px>] [--out <metrics.json>]
//    node probe/port-comparison/run.mjs --acceptance before after reference
//
//  `--run` renders the NINE-scene table (one Chrome page load per scene)
//  through the real vendored WebGL2 engine and writes
//    probe/port-comparison/captures/<label>/metrics.json
//  with the measures only; the panel PNGs go to
//  /tmp/port-comparison/<label>/<scene>-paper.png (and -pigment.png when the
//  scene paints a stroke). `--scene` narrows the set (size calibration and
//  smoke runs); a narrowed run never overwrites a full capture unless
//  `--out` says where to write instead.
//
//  `--acceptance` bundles the shared metric library for node and prints the
//  four blocks (drag, feather, strands, body) computed from the three
//  committed captures — the exact numbers the scenes produced, so Task 3 has
//  one command for the proof. It exits non-zero when a block misses its
//  declared threshold: a miss is a STOP, never tuned.
//
//  The bundle is written under /tmp/port-comparison/ and inlined into a /tmp
//  copy of index.html, so no .gitignore is needed and probe/medium-engine/
//  (the standing identity gate) stays byte-untouched.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/port-comparison'
const bundlePath = join(outDir, 'probe.bundle.js')
const pagePath = join(outDir, 'page.html')
const metricsNodePath = join(outDir, 'metrics.node.mjs')

const SCENE_NAMES = [
  'blank',
  'band',
  'band-p0',
  'band-p100',
  'blank-p0',
  'blank-f0',
  'blank-f100',
  'body0',
  'body100',
]

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function fail(message) {
  console.error(`[port-comparison] ${message}`)
  process.exit(1)
}

const esbuildCandidates = [
  join(repoRoot, 'node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild'),
  join(repoRoot, 'node_modules/.bin/esbuild'),
]
const esbuild = esbuildCandidates.find((path) => existsSync(path))
if (!esbuild) fail('esbuild not found; candidates:\n  ' + esbuildCandidates.join('\n  '))

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]
const chrome = chromeCandidates.find((path) => existsSync(path))
if (!chrome) fail('Chrome/Chromium not found; candidates:\n  ' + chromeCandidates.join('\n  '))

function unescapeHtml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

// ---------------------------------------------------------------- run mode

function buildBundle() {
  mkdirSync(outDir, { recursive: true })
  const build = spawnSync(
    esbuild,
    [
      join(here, 'probe.ts'),
      '--bundle',
      '--format=iife',
      '--platform=browser',
      '--target=es2022',
      '--log-level=warning',
      `--outfile=${bundlePath}`,
    ],
    { encoding: 'utf8' },
  )
  if (build.status !== 0) fail(build.stderr || build.stdout || 'esbuild failed')
  if (build.stderr.trim()) console.error(build.stderr.trim())
  const template = readFileSync(join(here, 'index.html'), 'utf8')
  const bundle = readFileSync(bundlePath, 'utf8')
  if (!template.includes('<!--PC-BUNDLE-->')) fail('index.html lost its <!--PC-BUNDLE--> placeholder')
  writeFileSync(pagePath, template.replace('<!--PC-BUNDLE-->', `<script>\n${bundle}\n</script>`))
}

function runScene(name, blueSize) {
  const t0 = Date.now()
  // No blueSize in the URL unless the caller pins one: the page's fitted
  // DEFAULT_BLUE_SIZE is the calibration of record, and only an explicit
  // --blue-size may override it.
  const query = `scene=${encodeURIComponent(name)}${blueSize !== undefined ? `&blueSize=${blueSize}` : ''}`
  const run = spawnSync(
    chrome,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--enable-unsafe-swiftshader',
      '--hide-scrollbars',
      '--window-size=900,700',
      '--allow-file-access-from-files',
      '--dump-dom',
      `file://${pagePath}?${query}`,
    ],
    { encoding: 'utf8', timeout: 600000, maxBuffer: 128 * 1024 * 1024 },
  )
  if (run.error) fail(`Chrome failed on scene "${name}": ${run.error.message}`)
  const dom = run.stdout ?? ''
  const match = dom.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/)
  if (!match || match[1].trim().length === 0) {
    writeFileSync(join(outDir, `dom-${name}.html`), dom)
    fail(`scene "${name}" produced no result element (DOM saved to ${join(outDir, `dom-${name}.html`)})`)
  }
  let result
  try {
    result = JSON.parse(unescapeHtml(match[1]))
  } catch (error) {
    writeFileSync(join(outDir, `dom-${name}.html`), dom)
    fail(`scene "${name}" result JSON parse failed: ${error.message}`)
  }
  if (result.verdict !== 'PORT-COMPARISON CAPTURED') {
    fail(`scene "${name}" failed: ${result.verdict ?? '(no verdict)'}${result.error ? ` — ${result.error}` : ''}`)
  }
  if (!result.record || typeof result.record.paperDigest !== 'string') {
    fail(`scene "${name}" record has no paperDigest`)
  }
  return { result, elapsedMs: Date.now() - t0 }
}

function runCapture(label) {
  const sceneFlag = flag('--scene')
  const scenes = sceneFlag ? [sceneFlag] : SCENE_NAMES
  for (const name of scenes) {
    if (!SCENE_NAMES.includes(name)) fail(`unknown --scene "${name}" (known: ${SCENE_NAMES.join(', ')})`)
  }
  const blueSizeRaw = flag('--blue-size')
  let blueSize
  if (blueSizeRaw !== undefined) {
    blueSize = Number(blueSizeRaw)
    if (!Number.isInteger(blueSize) || blueSize < 1 || blueSize > 800) {
      fail(`invalid --blue-size "${blueSizeRaw}" (expected an integer 1..800)`)
    }
  }

  buildBundle()
  console.log(
    `[port-comparison] running ${scenes.length} scene(s) for label "${label}" (blueSize ${blueSize ?? 'page default'}) ...`,
  )

  const panelDir = join(outDir, label)
  mkdirSync(panelDir, { recursive: true })

  const records = {}
  const timings = {}
  for (const name of scenes) {
    const { result, elapsedMs } = runScene(name, blueSize)
    timings[name] = elapsedMs
    // 261119-pod D-G: the body0 scene emits the touch-stamp proof; hang it on
    // that scene's record so the capture carries the raw stamps and uNow.
    records[name] = result.touchProof
      ? { ...result.record, touchProof: result.touchProof }
      : result.record
    writeFileSync(join(panelDir, `${name}-paper.png`), Buffer.from(result.paperPng.split(',')[1], 'base64'))
    if (typeof result.pigmentPng === 'string') {
      writeFileSync(join(panelDir, `${name}-pigment.png`), Buffer.from(result.pigmentPng.split(',')[1], 'base64'))
    }
    console.log(`  ${name.padEnd(10)} ${elapsedMs} ms  halfWidth ${result.record.strokeHalfWidthPx ?? 'n/a'} px`)
  }

  // The calibration echo: the blue size the page actually used (the fitted
  // default when no --blue-size was pinned), the band size it implies, and
  // the measured half-widths (the reference capture records its own).
  const echo = records['blank-p0'] ?? Object.values(records)[0] ?? {}
  const usedBlue = typeof echo.blueSizePx === 'number' ? echo.blueSizePx : blueSize
  const halfWidths = Object.values(records)
    .map((record) => record.strokeHalfWidthPx)
    .filter((value) => typeof value === 'number' && Number.isFinite(value))
  const calibration = {
    blueSizePx: usedBlue ?? null,
    bandSizePx: usedBlue ? Math.round(usedBlue * (0.12 / 0.085)) : null,
    measuredHalfWidthPx: halfWidths.length > 0 ? Math.round((halfWidths.reduce((a, b) => a + b, 0) / halfWidths.length) * 100) / 100 : null,
    referenceTargetHalfWidthPx: 25.5,
    referenceTargetNote: 'reference cycle-entry width 0.085 x 600 px / 2; compare per scene, not this mean',
  }

  const outPath = flag('--out')
  let target
  if (outPath) {
    target = outPath
  } else if (scenes.length === SCENE_NAMES.length) {
    target = join(here, 'captures', label, 'metrics.json')
  } else {
    fail('a narrowed --scene run needs --out <path> (it must never overwrite a full capture)')
  }
  // 261119-pod D-G: the plan stores `pickupGateWetPainted` /
  // `pickupGateWetUnpainted` in captures/before/metrics.json. A FULL capture
  // must carry them (the proof is a Task 1 acceptance); a narrowed run carries
  // the block only when its scene produced one.
  const touch =
    Object.values(records)
      .map((record) => record && record.touchProof)
      .find(Boolean) ?? null
  if (scenes.length === SCENE_NAMES.length && touch === null) {
    fail('full capture carries no D-G touch proof (the body0 scene must emit it)')
  }
  const payload = { label, calibration, timings, scenes: records }
  if (touch) {
    payload.pickupGateWetPainted = touch.pickupGateWetPainted
    payload.pickupGateWetUnpainted = touch.pickupGateWetUnpainted
    payload.touchProof = touch
  }
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, JSON.stringify(payload, null, 2) + '\n')
  console.log(`[port-comparison] capture written: ${target}`)
  console.log(`[port-comparison] panels: ${panelDir}`)
  console.log(`[port-comparison] calibration: blue ${calibration.blueSizePx} px, band ${calibration.bandSizePx} px, measured half-width ${calibration.measuredHalfWidthPx} px (reference target ${calibration.referenceTargetHalfWidthPx} px)`)
}

// --------------------------------------------------------- acceptance mode

async function runAcceptance(labels) {
  mkdirSync(outDir, { recursive: true })
  const build = spawnSync(
    esbuild,
    [
      join(here, 'metrics.ts'),
      '--bundle',
      '--format=esm',
      '--platform=node',
      '--target=node20',
      '--log-level=warning',
      `--outfile=${metricsNodePath}`,
    ],
    { encoding: 'utf8' },
  )
  if (build.status !== 0) fail(build.stderr || build.stdout || 'esbuild failed')

  const metrics = await import(pathToFileURL(metricsNodePath).href)
  const load = (label) => {
    const path = join(here, 'captures', label, 'metrics.json')
    if (!existsSync(path)) fail(`missing capture ${path}`)
    return JSON.parse(readFileSync(path, 'utf8'))
  }
  const before = load(labels[0])
  const after = load(labels[1])
  const reference = load(labels[2])

  for (const label of labels) {
    const capture = label === labels[0] ? before : label === labels[1] ? after : reference
    const expected = label === 'reference' ? 7 : 9
    const count = Object.keys(capture.scenes).length
    if (count !== expected) fail(`${label} carries ${count} scenes (expected ${expected})`)
  }

  // The no-drag identity contract, printed beside the acceptance blocks so
  // the report reads one output.
  const identity = {}
  for (const scene of ['band', 'band-p0', 'blank-p0']) {
    const b = before.scenes[scene]
    const a = after.scenes[scene]
    identity[scene] = Boolean(
      b && a && b.paperDigest === a.paperDigest && b.pigmentDigest === a.pigmentDigest,
    )
  }

  const result = metrics.acceptance(before, after, reference)
  const strip = (block) => {
    const { detail, ...rest } = block
    return rest
  }

  const report = {
    labels,
    identity,
    calibration: {
      studioBlueSizePx: after.calibration?.blueSizePx ?? null,
      studioBandSizePx: after.calibration?.bandSizePx ?? null,
      studioMeasuredHalfWidthPx: after.calibration?.measuredHalfWidthPx ?? null,
      referenceMeasuredHalfWidthPx: reference.calibration?.measuredHalfWidthPx ?? null,
      referenceTargetHalfWidthPx: after.calibration?.referenceTargetHalfWidthPx ?? null,
    },
    thresholds: result.thresholds,
    drag: result.drag,
    feather: result.feather,
    strands: result.strands,
    body: result.body,
    geometry: result.geometry,
  }
  console.log('')
  console.log('================ 261119-pod acceptance ================')
  console.log(JSON.stringify(report, null, 2))
  console.log('-------------------------------------------------------')
  console.log(`identity band/band-p0/blank-p0: ${JSON.stringify(identity)}`)
  console.log(`drag    ${result.drag.pass ? 'PASS' : 'FAIL'} — ${result.drag.detail}`)
  console.log(`feather ${result.feather.pass ? 'PASS' : 'FAIL'} — ${result.feather.detail}`)
  console.log(`strands ${result.strands.pass ? 'PASS' : 'FAIL'} — ${result.strands.detail}`)
  console.log(`body    ${result.body.pass ? 'PASS' : 'FAIL'} — ${result.body.detail}`)
  console.log(`geometry ${result.geometry.pass ? 'PASS' : 'FAIL'} — ${result.geometry.detail}`)
  console.log('=======================================================')

  const identityOk = Object.values(identity).every(Boolean)
  if (!identityOk) fail('the no-drag identity contract is broken (band / band-p0 / blank-p0 moved)')
  if (
    !result.drag.pass ||
    !result.feather.pass ||
    !result.strands.pass ||
    !result.body.pass ||
    !result.geometry.pass
  ) {
    fail('one or more acceptance blocks missed its declared threshold — report the numbers, do not tune')
  }
}

// ------------------------------------------------------------------- main

const acceptFlag = args.indexOf('--acceptance')
const runFlag = args.indexOf('--run')
if (acceptFlag >= 0) {
  const labels = args.slice(acceptFlag + 1).filter((token) => !token.startsWith('--'))
  if (labels.length !== 3) fail('usage: run.mjs --acceptance before after reference')
  await runAcceptance(labels)
} else if (runFlag >= 0) {
  const label = args[runFlag + 1]
  if (label !== 'before' && label !== 'after') fail('usage: run.mjs --run before|after')
  runCapture(label)
} else {
  console.error('usage: node run.mjs --run before|after [--scene <name>] [--blue-size <px>] [--out <path>]')
  console.error('       node run.mjs --acceptance before after reference')
  process.exit(1)
}
