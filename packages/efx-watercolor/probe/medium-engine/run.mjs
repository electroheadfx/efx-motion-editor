#!/usr/bin/env node
// ============================================================
//  run.mjs — build the medium-engine pixel gate and execute it in
//  headless Chrome (real WebGL2).
//
//  Scratch harness only: nothing here is imported by the package.
//  Usage: node packages/efx-watercolor/probe/medium-engine/run.mjs --gate <name>
//           [--scenario cover] [--emboss <0..100>] [--body <0..100>] [--light <0..4>]
//           [--size <32..4096>]
//
//  64-03: `--emboss` folds a thickness value into the fixed stroke's
//  params bag (probe.ts does the folding); the gate name is unchanged,
//  so the emboss-100 capture compares against the SAME plan-01 baseline.
//  The value is echoed by the probe report, never baked into the JSON
//  shape the compare step reads.
//
//  64-04: `--light` sets the emboss light intensity (0..4, the engine's
//  clamp band) before the three exports. Omitted leaves DEFAULT_LIGHT
//  (intensity 1); 0 is the unlit identity gate for a lit stroke.
//
//  64-06: `--body` folds the canonical Body value into EVERY stroke's
//  params bag, and `--scenario cover` renders the two-stroke cover script
//  (dark across, fix, light crossing at an angle, fix) instead of the
//  plan-01 single stroke. Omitted keeps the neutral script, so a plain
//  `--gate neutral-identity` run still reproduces the committed baseline.
//  The probe report also carries `bakeMs` (script + settle, exports
//  excluded) for the cover-on / cover-off cost comparison.
//
//  64-10 adds `--size <32..4096>`, the square sheet side (absent keeps the
//  phase-default 256). `--size 1024` is the high-definition sheet the
//  composite-cost matrix measures — no HD constant exists in the phase docs,
//  so the probe fixes its own and later plans reuse it. Every report also
//  carries `renderMs`, the render phase's wall clock (the three exports and
//  their readbacks), printed beside `bakeMs`; compare.mjs prints both
//  durations when two gates are compared.
//
//  Final flag contract (later phases inherit it, do not retype it):
//    run.mjs --gate <name>            required; [A-Za-z0-9._-]+, names the JSON
//             [--scenario cover]      omitted renders the plan-01 single stroke
//             [--emboss <0..100>]     omitted writes no emboss key
//             [--body <0..100>]       omitted writes no body key
//             [--light <0..4>]        omitted keeps DEFAULT_LIGHT
//             [--size <32..4096>]     omitted keeps the 256 square
//    compare.mjs <gate>               committed-baseline equality (6 fields)
//    compare.mjs <gate> --other <g>   same-session equality; never a baseline
//    compare.mjs <gate> --differs-from <n>
//                                     committed baseline <n> when it exists,
//                                     else the same-session capture; all
//                                     three exported-background digests must
//                                     differ and the dimensions must agree
//
//  Writes /tmp/medium-engine/<name>.json. The committed reference lives
//  at probe/medium-engine/baselines/<name>.json and is NEVER written by
//  this script — a gate run must not be able to move its own target.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/medium-engine'
const bundlePath = join(here, 'probe.bundle.js')

const args = process.argv.slice(2)
const gateFlag = args.indexOf('--gate')
const gate = gateFlag >= 0 ? args[gateFlag + 1] : undefined
if (!gate) {
  console.error(
    'usage: node run.mjs --gate <name> [--scenario cover] [--emboss <0..100>] [--body <0..100>] [--light <0..4>] [--size <32..4096>]   (e.g. neutral-identity)',
  )
  console.error(
    '       every operand except --gate is optional and additive; an omitted operand writes no key/value, so the neutral gate keeps reproducing the committed baseline',
  )
  process.exit(1)
}
if (!/^[A-Za-z0-9._-]+$/.test(gate)) {
  console.error(`invalid --gate "${gate}" (letters, digits, dot, underscore, hyphen only)`)
  process.exit(1)
}

// 64-03: optional thickness knob. Omitted means the neutral (absent-key)
// script — the exact pre-milestone stroke the baseline captured.
const embossFlag = args.indexOf('--emboss')
const embossRaw = embossFlag >= 0 ? args[embossFlag + 1] : undefined
let emboss
if (embossRaw !== undefined) {
  emboss = Number(embossRaw)
  if (!Number.isFinite(emboss) || emboss < 0 || emboss > 100) {
    console.error(`invalid --emboss "${embossRaw}" (expected 0..100)`)
    process.exit(1)
  }
}

// 64-04: optional light-intensity knob (0..4). Omitted keeps the default.
const lightFlag = args.indexOf('--light')
const lightRaw = lightFlag >= 0 ? args[lightFlag + 1] : undefined
let light
if (lightRaw !== undefined) {
  light = Number(lightRaw)
  if (!Number.isFinite(light) || light < 0 || light > 4) {
    console.error(`invalid --light "${lightRaw}" (expected 0..4)`)
    process.exit(1)
  }
}

// 64-06: optional Body knob (0..100). Omitted keeps the neutral bag.
const bodyFlag = args.indexOf('--body')
const bodyRaw = bodyFlag >= 0 ? args[bodyFlag + 1] : undefined
let body
if (bodyRaw !== undefined) {
  body = Number(bodyRaw)
  if (!Number.isFinite(body) || body < 0 || body > 100) {
    console.error(`invalid --body "${bodyRaw}" (expected 0..100)`)
    process.exit(1)
  }
}

// 64-06: optional scenario. Omitted keeps the plan-01 single stroke.
const scenarioFlag = args.indexOf('--scenario')
const scenarioRaw = scenarioFlag >= 0 ? args[scenarioFlag + 1] : undefined
let scenario
if (scenarioRaw !== undefined) {
  if (scenarioRaw !== 'cover') {
    console.error(`invalid --scenario "${scenarioRaw}" (expected "cover")`)
    process.exit(1)
  }
  scenario = scenarioRaw
}

// 64-10: optional square-sheet size. Omitted keeps the phase-default sheet,
// so the neutral gate still reproduces the committed 256x256 baseline.
const sizeFlag = args.indexOf('--size')
const sizeRaw = sizeFlag >= 0 ? args[sizeFlag + 1] : undefined
let size
if (sizeRaw !== undefined) {
  size = Number(sizeRaw)
  if (!Number.isInteger(size) || size < 32 || size > 4096) {
    console.error(`invalid --size "${sizeRaw}" (expected an integer 32..4096)`)
    process.exit(1)
  }
}

const pageQuery =
  `gate=${encodeURIComponent(gate)}` +
  (scenario === undefined ? '' : `&scenario=${scenario}`) +
  (emboss === undefined ? '' : `&emboss=${emboss}`) +
  (body === undefined ? '' : `&body=${body}`) +
  (light === undefined ? '' : `&light=${light}`) +
  (size === undefined ? '' : `&size=${size}`)
const resultPath = join(outDir, `${gate}.json`)

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

console.log(`[probe] bundling probe.ts (gate=${gate}) ...`)
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
    `file://${join(here, 'index.html')}?${pageQuery}`,
  ],
  { encoding: 'utf8', timeout: 600000, maxBuffer: 64 * 1024 * 1024 },
)
const elapsedMs = Date.now() - t0
if (run.error) {
  console.error('[probe] Chrome failed:', run.error.message)
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

const digests = ['digestPaper', 'digestTransparent', 'digestWhite']
const missing = digests.filter((key) => typeof result[key] !== 'string')
if (missing.length > 0) {
  console.error(`[probe] result is missing ${missing.join(', ')} (verdict=${result.verdict ?? '(missing)'})`)
  if (result.error) console.error(`[probe] probe error: ${result.error}`)
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[probe] DOM saved to ${join(outDir, 'dom.html')}`)
  process.exit(1)
}
if (result.gate !== gate) {
  console.error(`[probe] result gate "${result.gate}" does not match request "${gate}"`)
  process.exit(1)
}

// Keep the capture pristine: wall clock and machine strings are printed,
// never written, so the JSON is exactly the rendered-bytes record.
writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n')

console.log('')
console.log('================ medium-engine pixel gate ================')
console.log(`gate      : ${result.gate}`)
console.log(`scenario  : ${result.scenario ?? '(neutral)'}`)
console.log(`emboss    : ${result.emboss === null ? '(absent)' : result.emboss}`)
console.log(`body      : ${result.body === null ? '(absent)' : result.body}`)
console.log(`light     : ${result.light === null ? '(default)' : result.light}`)
console.log(`bake      : ${result.bakeMs ?? 'n/a'} ms (script + settle, exports excluded)`)
console.log(`render    : ${result.renderMs ?? 'n/a'} ms (three exports + readbacks)`)
console.log(`sheet     : ${result.width}x${result.height} (${result.byteLength} bytes/export)`)
console.log(`renderer  : ${result.renderer ?? 'n/a'}`)
console.log(`paper     : ${result.digestPaper}`)
console.log(`transparent: ${result.digestTransparent}`)
console.log(`white     : ${result.digestWhite}`)
console.log(`result JSON: ${resultPath}`)
console.log(`total probe: ${elapsedMs} ms`)
console.log('=========================================================')
