#!/usr/bin/env node
// ============================================================
//  run.mjs — drive the pickup-collapse readout (spike 003).
//
//  Scratch harness only: nothing here is imported by the package.
//
//  Usage:
//    node probe/pickup-collapse/run.mjs --label <name> [--blue-size <px>]
//
//  Bundles probe.ts with esbuild, inlines it into a /tmp copy of index.html
//  and renders ONE page load through the real vendored WebGL2 engine in
//  headless Chrome. Writes the full readout to
//  /tmp/pickup-collapse/<label>.json and prints the compact trajectory.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/pickup-collapse'
const bundlePath = join(outDir, 'probe.bundle.js')
const pagePath = join(outDir, 'page.html')

const args = process.argv.slice(2)
const flag = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function fail(message) {
  console.error(`[pickup-collapse] ${message}`)
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

const label = flag('--label')
if (!label) {
  fail(
    'usage: node run.mjs --label <name> [--scene band|blank|app-live|app-bake] [--size <px>] ' +
      '[--dry <0..100>] [--feather <0..100>] [--body <0..100>] [--pressure <0..1>] [--gap <ms>]',
  )
}
const sceneRaw = flag('--scene') ?? 'band'
if (!['band', 'blank', 'app-live', 'app-bake'].includes(sceneRaw)) fail(`invalid --scene "${sceneRaw}"`)
const sizeRaw = flag('--size') ?? flag('--blue-size')
const blueSize = sizeRaw === undefined ? 17 : Number(sizeRaw)
if (!Number.isInteger(blueSize) || blueSize < 1 || blueSize > 800) {
  fail(`invalid --size "${sizeRaw}"`)
}
const numericFlag = (name, fallback) => {
  const raw = flag(name)
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value)) fail(`invalid ${name} "${raw}"`)
  return value
}
const dry = numericFlag('--dry', sceneRaw === 'blank' ? 55 : 50)
const feather = numericFlag('--feather', 0)
const pressure = numericFlag('--pressure', 0.75)
const pickup = numericFlag('--pickup', 100)
const body = numericFlag('--body', 0)
const gapMs = numericFlag('--gap', 3000)
const centreRaw = flag('--centre')
const rimRaw = flag('--rim')
let pinQuery = ''
if (centreRaw !== undefined || rimRaw !== undefined) {
  if (centreRaw === undefined || rimRaw === undefined) fail('--centre and --rim go together')
  pinQuery = `&centre=${Number(centreRaw)}&rim=${Number(rimRaw)}`
}

function unescapeHtml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

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

function runPage() {
  const query =
    `scene=${sceneRaw}&size=${blueSize}&dry=${dry}&feather=${feather}&body=${body}&pressure=${pressure}&pickup=${pickup}&gap=${gapMs}${pinQuery}`
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
    { encoding: 'utf8', timeout: 600000, maxBuffer: 256 * 1024 * 1024 },
  )
  if (run.error) fail(`Chrome failed: ${run.error.message}`)
  const dom = run.stdout ?? ''
  const match = dom.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/)
  if (!match || match[1].trim().length === 0) {
    writeFileSync(join(outDir, `dom-${label}.html`), dom)
    fail(`no result element (DOM saved to ${join(outDir, `dom-${label}.html`)})`)
  }
  let result
  try {
    result = JSON.parse(unescapeHtml(match[1]))
  } catch (error) {
    writeFileSync(join(outDir, `dom-${label}.html`), dom)
    fail(`result JSON parse failed: ${error.message}`)
  }
  if (result.verdict !== 'PICKUP-COLLAPSE CAPTURED') {
    fail(`page failed: ${result.verdict ?? '(no verdict)'}${result.error ? ` — ${result.error}` : ''}`)
  }
  return result
}

function fmt(v, digits = 3) {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : 'n/a'
}

const st = (s, digits = 3) =>
  s === undefined || s === null ? 'n/a' : `${fmt(s.mean, digits)} [${fmt(s.p10, digits)} ${fmt(s.p50, digits)} ${fmt(s.p90, digits)}]`
const pct = (v) => (typeof v === 'number' && Number.isFinite(v) ? (v * 100).toFixed(1) + '%' : 'n/a')

function reportMid(mid) {
  if (!mid) {
    console.log('mid   | (no blank-scene mid capture)')
    return
  }
  console.log(
    `mid   | dab ${mid.captureAtDab}/${mid.dabs} head x ${fmt(mid.headX, 3)} along ${fmt(mid.alongPx, 1)} px ` +
      `r ${fmt(mid.radiusPx, 2)} px, region x [${fmt(mid.regionX[0], 3)}, ${fmt(mid.regionX[1], 3)}], ` +
      `|across| <= ${mid.coreAcross}, ${mid.texels} texels`,
  )
  console.log(`      | load      ${st(mid.load)}  (mean [p10 p50 p90])`)
  console.log(`      | local     ${st(mid.local)}  wide/5 ${st(mid.wideOver5)}  presence ${st(mid.presence)}`)
  console.log(`      | body      ${st(mid.body)}  dryEdge ${st(mid.dryEdge)}`)
  console.log(`      | height    ${st(mid.height)}  threshold ${st(mid.threshold)}`)
  console.log(
    `      | coverage  scene(pr ${fmt(mid.pressure, 2)}) ${st(mid.coverageScene)}  at pr 1.0 ${st(mid.coverageP100)}`,
  )
  console.log(
    `      | painted   predicted F0 ${pct(mid.predicted.f0)} F100 ${pct(mid.predicted.f100)} ` +
      `(scene F ${pct(mid.predicted.atSceneSoftness)}; deposit>=0.5: F0 ${pct(mid.predictedVisible.f0)} F100 ${pct(mid.predictedVisible.f100)})`,
  )
  console.log(
    `      | measured  cover>1e-3 ${pct(mid.measured.cover001)}  cover>0.05 ${pct(mid.measured.cover005)}  ` +
      `ink>1e-3 ${pct(mid.measured.ink001)}  cover mean ${fmt(mid.coverMean, 3)} p90 ${fmt(mid.coverP90, 3)}`,
  )
  if (Array.isArray(mid.pressureSweep)) {
    console.log(
      '      | sweep     ' +
        mid.pressureSweep
          .map((s) => `p${s.p}: cov ${fmt(s.coverage, 3)} F0 ${pct(s.f0)} F100 ${pct(s.f100)}`)
          .join(' | '),
    )
  }
}

function report(result) {
  console.log(`\n[pickup-collapse] ${label}: scene ${result.scene}, blue size ${result.blueSize}, band ${result.bandSize}, ` +
    `${result.totalDabs} dabs, ${result.bristleCount} bristles (centre ${result.centreIndex}, rim ${result.rimIndex})`)
  console.log(
    'dab | travelPx | travelBW |  wetC  coverC ageC  pickupC |   loadC    hueC |  wetR  pickupR |   loadR    hueR |  tapC   spC  tapR   spR | coverA smear',
  )
  for (const c of result.captures) {
    const centre = c.samples[0]
    const rim = c.samples[1]
    console.log(
      `${String(c.afterDab).padStart(3)} | ${fmt(c.perDab.travelPx, 2).padStart(8)} | ${fmt(c.perDab.travelWidths, 4).padStart(8)} | ` +
        `${fmt(centre.gate.wet, 3)} ${fmt(centre.gate.coverNorm, 3)} ${fmt(centre.gate.age, 2).padStart(5)} ${fmt(centre.gate.pickup, 4).padStart(7)} | ` +
        `${fmt(centre.load, 3)} ${fmt(centre.carriedHueDeg, 1).padStart(6)} | ` +
        `${fmt(rim.gate.wet, 3)} ${fmt(rim.gate.pickup, 4).padStart(7)} | ` +
        `${fmt(rim.load, 3)} ${fmt(rim.carriedHueDeg, 1).padStart(6)} | ` +
        `${fmt(centre.gate.tapHueDeg, 1).padStart(5)} ${fmt(centre.gate.samePaint, 3)} ` +
        `${fmt(rim.gate.tapHueDeg, 1).padStart(5)} ${fmt(rim.gate.samePaint, 3)} | ` +
        `${fmt(c.gather.coverMean, 3)} ${fmt(c.gather.smearMean, 3)}`,
    )
  }
  reportMid(result.mid)
  if (result.appSurface) {
    console.log(`app   | ${JSON.stringify(result.appSurface)}`)
  }
  if (result.surface) {
    console.log(`pixel | ${result.surface.law}`)
    console.log(`      | ${JSON.stringify(result.surface.metrics)}`)
  }
}

/**
 * Write the rendered surface PNG(s) next to the JSON and drop the (large)
 * data URLs from the record, so the JSON stays readable and greppable.
 */
function writeSurfacePngs(result) {
  const written = []
  for (const [key, suffix] of [['surfacePng', 'surface'], ['rawSheetPng', 'rawsheet']]) {
    const dataUrl = result[key]
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
      delete result[key]
      continue
    }
    const path = join(outDir, `${label}-${suffix}.png`)
    writeFileSync(path, Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'))
    written.push(path)
    delete result[key]
  }
  if (result.surface && written.length > 0) result.surface.png = written[0]
  return written
}

buildBundle()
const result = runPage()
const pngs = writeSurfacePngs(result)
const outPath = join(outDir, `${label}.json`)
writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n')
report(result)
console.log(`[pickup-collapse] wrote ${outPath}${pngs.length ? ' + ' + pngs.join(' ') : ''}`)
