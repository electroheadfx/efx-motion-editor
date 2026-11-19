#!/usr/bin/env node
// ============================================================
//  SPIKE 002 — headless driver for the acrylic bristle probe.
//
//  Bundles probe.ts and runs it in headless Chrome (real WebGL2), one page
//  load per gate, then writes results/<gate>.json.
//
//  Usage:
//    node run.mjs --gate <name> --engine baseline|bristle --scenario <s>
//                 [--size N] [--touch 0|1] [--salt N]
//  Scratch harness only: nothing here is imported by the package.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const spikeRoot = join(here, '..')
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = join(spikeRoot, 'results')
const bundlePath = join(here, 'probe.bundle.js')

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

const gate = flag('--gate')
if (!gate || !/^[A-Za-z0-9._-]+$/.test(gate)) {
  console.error('usage: node run.mjs --gate <name> --engine baseline|bristle --scenario cross|watercolor-50|neutral [--size N] [--touch 0|1] [--salt N]')
  process.exit(1)
}
const engine = flag('--engine') ?? 'bristle'
if (engine !== 'baseline' && engine !== 'bristle') {
  console.error(`invalid --engine "${engine}" (baseline|bristle)`)
  process.exit(1)
}
const scenario = flag('--scenario') ?? 'cross'
if (!['cross', 'watercolor-50', 'neutral', 'acrylic-20'].includes(scenario)) {
  console.error(`invalid --scenario "${scenario}" (cross|watercolor-50|neutral|acrylic-20)`)
  process.exit(1)
}
const brush = flag('--brush') ?? 'round'
const sizeParamRaw = flag('--size-param')
const sizeParam = sizeParamRaw === undefined ? 12 : Number(sizeParamRaw)
if (!Number.isFinite(sizeParam) || sizeParam < 1 || sizeParam > 100) {
  console.error(`invalid --size-param "${sizeParamRaw}" (1..100)`)
  process.exit(1)
}
const sizeRaw = flag('--size')
const size = sizeRaw === undefined ? 256 : Number(sizeRaw)
if (!Number.isInteger(size) || size < 32 || size > 4096) {
  console.error(`invalid --size "${sizeRaw}" (expected 32..4096)`)
  process.exit(1)
}
const touchRaw = flag('--touch')
const touch = touchRaw === '1' ? 1 : 0
if (touchRaw !== undefined && touchRaw !== '0' && touchRaw !== '1') {
  console.error(`invalid --touch "${touchRaw}" (0|1)`)
  process.exit(1)
}
const saltRaw = flag('--salt')
const salt = saltRaw === undefined ? 0 : Number(saltRaw)
if (!Number.isInteger(salt) || salt < 0 || salt > 1e6) {
  console.error(`invalid --salt "${saltRaw}" (0..1000000)`)
  process.exit(1)
}
const runsRaw = flag('--runs')
const runs = runsRaw === undefined ? 2 : Number(runsRaw)
if (runs !== 1 && runs !== 2) {
  console.error(`invalid --runs "${runsRaw}" (1|2)`)
  process.exit(1)
}
const paperB = flag('--paper-b') ?? 'fixed'
if (paperB !== 'fixed' && paperB !== 'random') {
  console.error(`invalid --paper-b "${paperB}" (fixed|random)`)
  process.exit(1)
}

const query = `gate=${encodeURIComponent(gate)}&engine=${engine}&scenario=${scenario}&size=${size}&touch=${touch}&salt=${salt}&runs=${runs}&paperB=${paperB}&brush=${encodeURIComponent(brush)}&sizeParam=${sizeParam}`

const esbuildCandidates = [
  join(repoRoot, 'node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild'),
  join(repoRoot, 'node_modules/.bin/esbuild'),
]
const esbuild = esbuildCandidates.find((path) => existsSync(path))
if (!esbuild) {
  console.error('esbuild not found; candidates:\n  ' + esbuildCandidates.join('\n  '))
  process.exit(1)
}

const chromeCandidates = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]
const chrome = chromeCandidates.find((path) => existsSync(path))
if (!chrome) {
  console.error('Chrome/Chromium not found; candidates:\n  ' + chromeCandidates.join('\n  '))
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

console.log(`[spike-002] bundling probe.ts (gate=${gate}, engine=${engine}) ...`)
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
if (build.status !== 0) {
  console.error(build.stderr || build.stdout || 'esbuild failed')
  process.exit(build.status ?? 1)
}
if (build.stderr.trim()) console.error(build.stderr.trim())

console.log('[spike-002] running headless Chrome (WebGL2) ...')
const t0 = Date.now()
const run = spawnSync(
  chrome,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--window-size=512,512',
    '--allow-file-access-from-files',
    '--dump-dom',
    `file://${join(here, 'index.html')}?${query}`,
  ],
  { encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 },
)
const elapsedMs = Date.now() - t0
if (run.error) {
  console.error('[spike-002] Chrome failed:', run.error.message)
  process.exit(1)
}

const dom = run.stdout ?? ''
const match = dom.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/)
const statusMatch = dom.match(/<p id="status">([\s\S]*?)<\/p>/)
const status = statusMatch ? statusMatch[1].trim() : '(missing)'

function unescapeHtml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

if (!match || match[1].trim().length === 0) {
  console.error(`[spike-002] no result element content (status=${status}, chrome exit=${run.status}, ${elapsedMs} ms)`)
  if (run.stderr) console.error(run.stderr.slice(0, 4000))
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[spike-002] DOM saved to ${join(outDir, 'dom.html')}`)
  process.exit(1)
}

let result
try {
  result = JSON.parse(unescapeHtml(match[1]))
} catch (error) {
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[spike-002] result JSON parse failed: ${error.message} (DOM saved)`)
  process.exit(1)
}

const resultPath = join(outDir, `${gate}.json`)
writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n')

if (result.verdict !== 'SPIKE-002 CAPTURED') {
  console.error(`[spike-002] probe failed: ${result.verdict} ${result.error ?? ''}`)
  process.exit(1)
}

console.log('')
console.log('================ spike 002 bristle probe ================')
console.log(`gate      : ${result.gate}`)
console.log(`engine    : ${result.engine} | scenario ${result.scenario} | brush ${result.brush} | size ${result.sizeParam} | sheet ${result.sheet}²`)
console.log(`touch     : ${result.touch} | salt ${result.salt}`)
console.log(`bake A/B  : ${result.runA.bakeMs} / ${result.runB.bakeMs} ms`)
console.log(`render A/B: ${result.runA.renderMs} / ${result.runB.renderMs} ms`)
console.log(`identical images   : ${result.identicalImages}`)
console.log(`identical bristles : ${result.identicalBristles}`)
console.log(`digest A  : ${result.runA.digests.pigment} (pigment) ${result.runA.digests.transparent} (transparent)`)
console.log(`digest B  : ${result.runB.digests.pigment} (pigment) ${result.runB.digests.transparent} (transparent)`)
console.log(`gpu peak  : ${result.runA.gpuPeakBytes} B (run A) / ${result.runB.gpuPeakBytes} B (run B)`)
console.log(`painted   : ${result.runA.paintedPct}% (transparent sheet below paper-white)`)
console.log(`regions A : crossing ${JSON.stringify(result.runA.regions?.crossing)} redOwn ${JSON.stringify(result.runA.regions?.redOwn)}`)
if (result.runA.bristleDigest) console.log(`bristle A/B: ${result.runA.bristleDigest} / ${result.runB.bristleDigest}`)
if (result.runA.bristleInfo) {
  const info = result.runA.bristleInfo
  console.log(`reservoirs : count ${info.count} | ${info.reservoirBytes} B | touch ${info.touchSheetBytes} B | gpu peak ${result.runA.gpuPeakBytes} B`)
}
console.log(`result JSON: ${resultPath}`)
console.log(`total probe: ${elapsedMs} ms`)
console.log('=========================================================')
