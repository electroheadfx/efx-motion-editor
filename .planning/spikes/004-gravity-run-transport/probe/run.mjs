#!/usr/bin/env node
// ============================================================
//  SPIKE 004 — headless driver for the gravity-run probe.
//
//  Bundles probe.ts and runs it in headless Chrome (real WebGL2), one page
//  load per gate, then writes results/<gate>.json and results/<gate>.png.
//
//  Usage:
//    node run.mjs --gate <name> --engine baseline|workbench
//                 [--gravity G] [--water 0|1] [--ticks N] [--size N]
//                 [--size-param N]
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
  console.error('usage: node run.mjs --gate <name> --engine baseline|workbench [--gravity G] [--water 0|1] [--ticks N] [--size N] [--size-param N]')
  process.exit(1)
}
const engine = flag('--engine') ?? 'workbench'
if (engine !== 'baseline' && engine !== 'workbench') {
  console.error(`invalid --engine "${engine}" (baseline|workbench)`)
  process.exit(1)
}
const gravity = Number(flag('--gravity') ?? '0')
if (!Number.isFinite(gravity) || gravity < 0 || gravity > 400) {
  console.error(`invalid --gravity "${flag('--gravity')}" (0..400)`)
  process.exit(1)
}
const waterRaw = flag('--water') ?? '0'
if (waterRaw !== '0' && waterRaw !== '1') {
  console.error(`invalid --water "${waterRaw}" (0|1)`)
  process.exit(1)
}
const ticks = Number(flag('--ticks') ?? '120')
if (!Number.isInteger(ticks) || ticks < 0 || ticks > 1200) {
  console.error(`invalid --ticks "${flag('--ticks')}" (0..1200)`)
  process.exit(1)
}
const size = Number(flag('--size') ?? '512')
if (!Number.isInteger(size) || size < 64 || size > 2048) {
  console.error(`invalid --size "${flag('--size')}" (64..2048)`)
  process.exit(1)
}
const sizeParam = Number(flag('--size-param') ?? '60')
if (!Number.isFinite(sizeParam) || sizeParam < 1 || sizeParam > 800) {
  console.error(`invalid --size-param "${flag('--size-param')}" (1..800)`)
  process.exit(1)
}

const scene = flag('--scene') ?? 'acrylic'
if (scene !== 'acrylic' && scene !== 'water' && scene !== 'cross') {
  console.error(`invalid --scene "${scene}" (acrylic|water|cross)`)
  process.exit(1)
}
const gain = Number(flag('--gain') ?? '0.08')
if (!Number.isFinite(gain) || gain < 0 || gain > 4) {
  console.error(`invalid --gain "${flag('--gain')}" (0..4)`)
  process.exit(1)
}
const thr = Number(flag('--thr') ?? '0')
if (!Number.isFinite(thr) || thr < 0 || thr > 1) {
  console.error(`invalid --thr "${flag('--thr')}" (0..1)`)
  process.exit(1)
}
const waterSize = Number(flag('--water-size') ?? String(sizeParam))
if (!Number.isFinite(waterSize) || waterSize < 1 || waterSize > 800) {
  console.error(`invalid --water-size "${flag('--water-size')}" (1..800)`)
  process.exit(1)
}
const focus = Number(flag('--focus') ?? '0')
if (!Number.isFinite(focus) || focus < 0 || focus > 32) {
  console.error(`invalid --focus "${flag('--focus')}" (0..32)`)
  process.exit(1)
}
const waterPasses = Number(flag('--water-passes') ?? '1')
if (!Number.isInteger(waterPasses) || waterPasses < 1 || waterPasses > 4) {
  console.error(`invalid --water-passes "${flag('--water-passes')}" (1..4)`)
  process.exit(1)
}
const noise = Number(flag('--noise') ?? '0')
if (!Number.isFinite(noise) || noise < 0 || noise > 1) {
  console.error(`invalid --noise "${flag('--noise')}" (0..1)`)
  process.exit(1)
}
const noiseScale = Number(flag('--noise-scale') ?? '8')
if (!Number.isFinite(noiseScale) || noiseScale < 1 || noiseScale > 64) {
  console.error(`invalid --noise-scale "${flag('--noise-scale')}" (1..64)`)
  process.exit(1)
}
const query = `gate=${encodeURIComponent(gate)}&engine=${engine}&gravity=${gravity}&gain=${gain}&thr=${thr}&focus=${focus}&noise=${noise}&noiseScale=${noiseScale}&water=${waterRaw}&waterPasses=${waterPasses}&ticks=${ticks}&size=${size}&sizeParam=${sizeParam}&waterSize=${waterSize}&scene=${scene}`

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

console.log(`[spike-004] bundling probe.ts (gate=${gate}, engine=${engine}, gravity=${gravity}) ...`)
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

console.log('[spike-004] running headless Chrome (WebGL2) ...')
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
  { encoding: 'utf8', timeout: 900000, maxBuffer: 128 * 1024 * 1024 },
)
const elapsedMs = Date.now() - t0
if (run.error) {
  console.error('[spike-004] Chrome failed:', run.error.message)
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
  console.error(`[spike-004] no result element content (status=${status}, chrome exit=${run.status}, ${elapsedMs} ms)`)
  if (run.stderr) console.error(run.stderr.slice(0, 4000))
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[spike-004] DOM saved to ${join(outDir, 'dom.html')}`)
  process.exit(1)
}

let result
try {
  result = JSON.parse(unescapeHtml(match[1]))
} catch (error) {
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[spike-004] result JSON parse failed: ${error.message} (DOM saved)`)
  process.exit(1)
}

if (typeof result.pngWhite === 'string' && result.pngWhite.startsWith('data:image/png;base64,')) {
  writeFileSync(join(outDir, `${gate}.png`), Buffer.from(result.pngWhite.slice('data:image/png;base64,'.length), 'base64'))
  delete result.pngWhite
}

const resultPath = join(outDir, `${gate}.json`)
writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n')

if (result.verdict !== 'SPIKE-004 CAPTURED') {
  console.error(`[spike-004] probe failed: ${result.verdict} ${result.error ?? ''}`)
  process.exit(1)
}

console.log('')
console.log('================ spike 004 gravity-run probe ================')
console.log(`gate      : ${result.gate}`)
console.log(`engine    : ${result.engine} | gravity ${result.gravity} | gain ${result.gain} | thr ${result.threshold} | focus ${result.focus} | noise ${result.noise}@${result.noiseScale} | water ${result.waterPass ? `ON x${result.waterPasses}` : 'off'} (size ${result.waterSize}) | ticks ${result.ticks} | sheet ${result.sheet}²`)
console.log(`timing    : ${result.run.bakeMs} ms for ${result.run.ticksApplied} ticks`)
console.log(`painted   : ${result.run.paintedPct} % of the sheet`)
const g = result.run.geometry
console.log(`geometry  : top ${g.topY} | bottom ${g.bottomY} | centroid ${g.centroidY} | extent ${g.extentY} (doc uv, y up)`)
console.log(`column bot: p50 ${g.bottomP50} | p90 ${g.bottomP90} | tongue ${g.tongueWidthPx} px wide | longest run ${g.maxColumnRunPx} px`)
if (result.run.wet) {
  const w = result.run.wet
  console.log(`wet       : peak ${w.peak} | mass ${w.mass} | centroid ${w.centroidY} | mobile ${w.mobileFrac} % | span ${w.mobileBottomY}..${w.mobileTopY} | param ${w.gravityParam}`)
  if (w.activeRect) console.log(`active    : x ${w.activeRect.x0}..${w.activeRect.x1} | y ${w.activeRect.y0}..${w.activeRect.y1} (texels, row 0 = doc bottom)`)
}
console.log(`digests   : ${JSON.stringify(result.run.digests)}`)
console.log(`result    : ${resultPath}`)
console.log(`png       : ${join(outDir, `${gate}.png`)}`)
