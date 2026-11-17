#!/usr/bin/env node
// ============================================================
//  run.mjs — build the medium-engine pixel gate and execute it in
//  headless Chrome (real WebGL2).
//
//  Scratch harness only: nothing here is imported by the package.
//  Usage: node packages/efx-watercolor/probe/medium-engine/run.mjs --gate <name> [--emboss <0..100>]
//
//  64-03: `--emboss` folds a thickness value into the fixed stroke's
//  params bag (probe.ts does the folding); the gate name is unchanged,
//  so the emboss-100 capture compares against the SAME plan-01 baseline.
//  The value is echoed by the probe report, never baked into the JSON
//  shape the compare step reads.
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
  console.error('usage: node run.mjs --gate <name> [--emboss <0..100>]   (e.g. neutral-identity)')
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

const pageQuery = `gate=${encodeURIComponent(gate)}` + (emboss === undefined ? '' : `&emboss=${emboss}`)
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
console.log(`emboss    : ${result.emboss === null ? '(absent)' : result.emboss}`)
console.log(`sheet     : ${result.width}x${result.height} (${result.byteLength} bytes/export)`)
console.log(`renderer  : ${result.renderer ?? 'n/a'}`)
console.log(`paper     : ${result.digestPaper}`)
console.log(`transparent: ${result.digestTransparent}`)
console.log(`white     : ${result.digestWhite}`)
console.log(`result JSON: ${resultPath}`)
console.log(`total probe: ${elapsedMs} ms`)
console.log('=========================================================')
