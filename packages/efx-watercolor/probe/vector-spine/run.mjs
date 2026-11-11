#!/usr/bin/env node
// ============================================================
//  run.mjs — build the vector-spine feasibility probe and
//  execute it in headless Chrome (real WebGL2).
//
//  Scratch harness only: nothing here is imported by the package.
//  Usage: node packages/efx-watercolor/probe/vector-spine/run.mjs
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/vector-spine'
const bundlePath = join(here, 'probe.bundle.js')

// 61-04: `--scenario width` replays the per-sample width channel and writes
// /tmp/vector-spine/width-result.json. No scratch scenario may ever overwrite
// the committed phase evidence (result.json), which the uniform-path
// byte-identity pins.
const SCENARIOS = ['width', 'natural', 'real']
const args = process.argv.slice(2)
const scenarioFlag = args.indexOf('--scenario')
const scenario = scenarioFlag >= 0 ? args[scenarioFlag + 1] : undefined
if (scenario !== undefined && !SCENARIOS.includes(scenario)) {
  console.error(`unknown --scenario "${scenario}" (supported: ${SCENARIOS.join(', ')})`)
  process.exit(1)
}
const widthScenario = scenario === 'width'
const naturalScenario = scenario === 'natural'
const realScenario = scenario === 'real'
const scratchScenario = widthScenario || naturalScenario || realScenario
const pageQuery = scratchScenario ? `?scenario=${scenario}` : ''
const resultPath = join(
  outDir,
  widthScenario
    ? 'width-result.json'
    : naturalScenario
      ? 'natural-result.json'
      : realScenario
        ? 'real-result.json'
        : 'result.json',
)

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

console.log('[probe] bundling probe.ts ...')
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

console.log('[probe] running headless Chrome (WebGL2) ...')
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
    `file://${join(here, 'index.html')}${pageQuery}`,
  ],
  // The cost matrix replays 200 strokes at three sheet sizes under
  // SwiftShader; the reference probe's 15 min ceiling is too tight here.
  { encoding: 'utf8', timeout: 3600000, maxBuffer: 64 * 1024 * 1024 },
)
const elapsedMs = Date.now() - t0
if (run.error) {
  console.error('[probe] Chrome failed:', run.error.message)
  process.exit(1)
}

const dom = run.stdout ?? ''
// The page tags the <pre> with a data-verdict attribute, so allow attributes.
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
  console.error(`[probe] no result element content (status=${status}, chrome exit=${run.status}, ${elapsedMs} ms)`)
  if (run.stderr) console.error(run.stderr.slice(0, 4000))
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[probe] DOM saved to ${join(outDir, 'dom.html')}`)
  process.exit(1)
}

let result
try {
  result = JSON.parse(unescapeHtml(match[1]))
} catch (error) {
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[probe] result JSON parse failed: ${error.message} (DOM saved to ${join(outDir, 'dom.html')})`)
  process.exit(1)
}

if (widthScenario) {
  if (typeof result.widthRatio !== 'object' || result.widthRatio === null) {
    console.error(`[probe] width result has no widthRatio (verdict=${result.verdict ?? '(missing)'})`)
    writeFileSync(join(outDir, 'dom.html'), dom)
    console.error(`[probe] DOM saved to ${join(outDir, 'dom.html')}`)
    process.exit(1)
  }
} else if (naturalScenario || realScenario) {
  if (typeof result.arms !== 'object' || result.arms === null) {
    console.error(`[probe] ${scenario} result has no arms (verdict=${result.verdict ?? '(missing)'})`)
    writeFileSync(join(outDir, 'dom.html'), dom)
    console.error(`[probe] DOM saved to ${join(outDir, 'dom.html')}`)
    process.exit(1)
  }
} else if (!('digestA' in result)) {
  console.error(`[probe] result JSON has no digestA (verdict=${result.verdict ?? '(missing)'})`)
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[probe] DOM saved to ${join(outDir, 'dom.html')}`)
  process.exit(1)
}

result.wallClockMs = elapsedMs
const payload = JSON.stringify(result, null, 2)
writeFileSync(resultPath, payload)
if (!scratchScenario) {
  // Committed evidence — byte-equal to the /tmp copy of this same run. The
  // scratch scenarios write /tmp only: they must never overwrite this file.
  writeFileSync(join(here, 'result.json'), payload)
}
if ((naturalScenario || realScenario) && typeof result.sheetPng === 'string') {
  const prefix = 'data:image/png;base64,'
  if (result.sheetPng.startsWith(prefix)) {
    writeFileSync(
      join(outDir, `${naturalScenario ? 'natural' : 'real'}-sheet.png`),
      Buffer.from(result.sheetPng.slice(prefix.length), 'base64'),
    )
  }
}

console.log('')
if (widthScenario) {
  console.log(result.verdict)
  console.log(`result JSON: ${resultPath}`)
  // exitCode (not exit) so the buffered stdout above is flushed.
  process.exitCode = /^VECTOR-WIDTH PASS/.test(result.verdict) ? 0 : 1
} else if (naturalScenario || realScenario) {
  console.log(result.verdict)
  for (const [arm, metrics] of Object.entries(result.arms)) {
    console.log(`${arm.padEnd(20)}: ${JSON.stringify(metrics)}`)
  }
  if (result.sampleCounts) console.log(`samples   : ${JSON.stringify(result.sampleCounts)}`)
  console.log(`sheet PNG : ${join(outDir, `${naturalScenario ? 'natural' : 'real'}-sheet.png`)}`)
  console.log(`result JSON: ${resultPath}`)
} else {
  console.log('================ vector-spine feasibility ================')
console.log(`renderer : ${result.env?.renderer ?? 'n/a'}`)
console.log(`${result.scenario ?? 'vector-spine'}: ${result.verdict}`)
if (result.seamStepPx) {
  const seg = result.seamStepPx.segmentRuns
  const pay = result.seamStepPx.payloadExtension
  console.log(`seam     : segmentRuns 1/4/16=${seg?.['1']}/${seg?.['4']}/${seg?.['16']}px  payloadExtension=${pay?.['1']}/${pay?.['4']}/${pay?.['16']}px`)
  console.log(`density  : settled=${result.settledDensity}`)
}
for (const [size, c] of Object.entries(result.cost ?? {})) {
  console.log(
    `cost ${size}: dabs/stroke=${c.dabsPerStroke} ms/stroke=${c.msPerStroke} ` +
      `sheet10=${c.msPerSheet10}ms sheet50=${c.msPerSheet50}ms sheet200=${c.msPerSheet200}ms`,
  )
}
if (typeof result.referenceStrokeCount === 'number') {
  console.log(`ref      : ${result.referenceStrokeCount} strokes under 33ms at 1920x1080`)
}
if (result.widthRatio) {
  const w = result.widthRatio
  const m = w.maxRadius ?? {}
  console.log(
    `width    : ${w.channel} ${w.baseRadiusPx}->${w.scaledRadiusPx}px observed=${w.observed} | ` +
      `${m.channel} ${m.baseRadiusPx}->${m.scaledRadiusPx}px observed=${m.observed}`,
  )
}
console.log('')
  console.log(`result JSON: ${resultPath} (committed copy: ${join(here, 'result.json')})`)
  console.log(`total probe: ${result.totalProbeMs} ms`)
  console.log('=========================================================')
}
