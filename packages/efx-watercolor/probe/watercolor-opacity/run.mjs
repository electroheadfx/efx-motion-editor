#!/usr/bin/env node
// ============================================================
//  run.mjs — build the watercolor-opacity feasibility probe and
//  execute it in headless Chrome (real WebGL2).
//
//  Scratch harness only: nothing here is imported by the package.
//  Usage: node packages/efx-watercolor/probe/watercolor-opacity/run.mjs
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/watercolor-opacity-probe'
const bundlePath = join(here, 'probe.bundle.js')
const resultPath = join(outDir, 'result.json')

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
    `file://${join(here, 'index.html')}`,
  ],
  { encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 },
)
const elapsedMs = Date.now() - t0
if (run.error) {
  console.error('[probe] Chrome failed:', run.error.message)
  process.exit(1)
}

const dom = run.stdout ?? ''
const match = dom.match(/<pre id="result">([\s\S]*?)<\/pre>/)
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

result.wallClockMs = elapsedMs
writeFileSync(resultPath, JSON.stringify(result, null, 2))

function pct(value) {
  return typeof value === 'number' ? value.toFixed(2) : 'n/a'
}

console.log('')
console.log('================ watercolor-opacity feasibility ================')
console.log(`renderer : ${result.env?.renderer ?? 'n/a'}`)
console.log(`ok       : ${result.ok}`)
console.log(`verdict  : ${result.verdict}`)
console.log('')
console.log(`driver vs adapter        : pctWithin1=${pct(result.driverValidation?.pctWithin1)} maxAbs=${result.driverValidation?.maxAbs}`)
console.log(`determinism pinned paper : pctWithin1=${pct(result.determinism?.pctWithin1)} maxAbs=${result.determinism?.maxAbs}`)
console.log(`unseeded paper           : pctWithin1=${pct(result.unseededPaper?.pctWithin1)} maxAbs=${result.unseededPaper?.maxAbs}`)
console.log('')
for (const scenario of result.scenarios ?? []) {
  console.log(`scenario: ${scenario.name} (cuissons ${scenario.cuissons.join('/')})`)
  for (const stroke of scenario.scratch ?? []) {
    console.log(
      `  boundary ${stroke.strokeIndex}: public(pct1=${pct(stroke.publicSnapshot?.pctWithin1)}, max=${stroke.publicSnapshot?.maxAbs})` +
        ` augmented(pct1=${pct(stroke.augmentedClone?.pctWithin1)}, max=${stroke.augmentedClone?.maxAbs})` +
        (stroke.augmentedError ? ` augmentedError=${stroke.augmentedError}` : ''),
    )
  }
  console.log(
    `  independent layers multiply: pctWithin1=${pct(scenario.independentLayersMultiply?.pctWithin1)} maxAbs=${scenario.independentLayersMultiply?.maxAbs}`,
  )
  console.log(
    `  crossfade opacity 100: pctWithin1=${pct(scenario.crossfadeOpacity100?.pctWithin1)} maxAbs=${scenario.crossfadeOpacity100?.maxAbs}` +
      ` | at 50: changed vs before=${pct(scenario.crossfadeAt50VsBefore?.changedPixelsPct)}%`,
  )
  console.log(
    `  last-stroke delta: changed=${pct(scenario.deltaForLastStroke?.changedPixelsPct)}% negative=${pct(scenario.deltaForLastStroke?.negativePixelsPct)}%` +
      ` range=[${scenario.deltaForLastStroke?.minDelta}, ${scenario.deltaForLastStroke?.maxDelta}]`,
  )
  console.log(
    `  alpha: min=${scenario.alpha?.min} max=${scenario.alpha?.max} nonOpaque=${scenario.alpha?.nonOpaque}`,
  )
}
console.log('')
const mem = result.memory ?? {}
console.log(
  `memory @${mem.docW}x${mem.docH}: snapshot cropped=${mem.snapshotCroppedBytes} B (${pct(mem.snapshotCroppedPerTexel)} B/texel)` +
    ` | full=${mem.snapshotFullBytes} B (${mem.snapshotFullPerTexel} B/texel)` +
    ` | clone=${mem.augmentedCloneBytes} B (${pct(mem.augmentedClonePerTexel)} B/texel)` +
    ` | live engine=${mem.liveEngineBytes} B | clone+scratch=${mem.clonePlusScratchEngineBytes} B`,
)
for (const [label, example] of Object.entries(result.examples ?? {})) {
  console.log(
    `  ${label}: snapshot=${example.snapshotMB} MB clone=${example.cloneMB} MB scratchEngine=${example.scratchEngineMB} MB` +
      ` clone+scratch=${example.clonePlusScratchMB} MB frame=${example.frameMB} MB 100 retained clones=${example.hundredRetainedClonesGB} GB`,
  )
}
console.log('')
for (const finding of result.findings ?? []) console.log(`- ${finding}`)
console.log('')
console.log(`cost: totalProbeMs=${result.cost?.totalProbeMs} scenarioMatrixMs=${result.cost?.scenarioMatrixMs} wallClockMs=${result.wallClockMs}`)
console.log(`result JSON: ${resultPath}`)
console.log('================================================================')
