#!/usr/bin/env node
// ============================================================
//  SPIKE 001 — headless driver for the coverage-composite probe.
//
//  Bundles probe.ts and runs it in headless Chrome (real WebGL2), one page
//  load per gate, then writes results/<gate>.json.
//
//  Usage:
//    node run.mjs --gate <name> --engine baseline|coverage --scenario <s>
//                 [--size N] [--body 0..100]
//    node run.mjs --matrix          run the full comparison matrix
//
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

console.log('[spike-001] bundling probe.ts ...')
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

function unescapeHtml(text) {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

function runGate({ gate, engine, scenario, size, body }) {
  const query =
    `gate=${encodeURIComponent(gate)}` +
    `&engine=${engine}` +
    `&scenario=${scenario}` +
    (size === undefined ? '' : `&size=${size}`) +
    (body === undefined ? '' : `&body=${body}`)
  console.log(`\n[spike-001] gate=${gate} engine=${engine} scenario=${scenario}` +
    `${size === undefined ? '' : ` size=${size}`}${body === undefined ? '' : ` body=${body}`}`)
  const started = Date.now()
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
  const elapsed = Date.now() - started
  if (run.error) {
    console.error(`[spike-001] Chrome failed: ${run.error.message}`)
    process.exit(1)
  }
  const dom = run.stdout ?? ''
  const match = dom.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/)
  const statusMatch = dom.match(/<p id="status">([\s\S]*?)<\/p>/)
  const status = statusMatch ? statusMatch[1].trim() : '(missing)'
  if (!match || match[1].trim().length === 0) {
    console.error(`[spike-001] no result (status=${status}, chrome exit=${run.status}, ${elapsed} ms)`)
    if (run.stderr) console.error(run.stderr.slice(0, 4000))
    writeFileSync(join(outDir, `${gate}-dom.html`), dom)
    process.exit(1)
  }
  let result
  try {
    result = JSON.parse(unescapeHtml(match[1]))
  } catch (error) {
    writeFileSync(join(outDir, `${gate}-dom.html`), dom)
    console.error(`[spike-001] result JSON parse failed: ${error.message}`)
    process.exit(1)
  }
  writeFileSync(join(outDir, `${gate}.json`), JSON.stringify(result, null, 2) + '\n')
  if (typeof result.verdict !== 'string' || !result.verdict.startsWith('SPIKE-001 CAPTURED')) {
    console.error(`[spike-001] gate ${gate} FAILED: ${result.verdict ?? '(no verdict)'} ${result.error ?? ''}`)
    process.exit(1)
  }
  const p95 = result.strokeP95Ms
  console.log(
    `[spike-001] ok in ${(elapsed / 1000).toFixed(1)}s — bake ${result.bakeMs} ms` +
      `${p95 === null || p95 === undefined ? '' : `, p95 stroke ${p95} ms`}` +
      `, fullDoc draws ${result.draws?.fullDocument ?? '?'}/${result.draws?.total ?? '?'}` +
      `, peak +${(result.memory?.transientPeakBytes / 1048576).toFixed(2)} MB`,
  )
  return result
}

const args = process.argv.slice(2)
function flag(name) {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}

if (args.includes('--matrix')) {
  const matrix = []
  // Criterion 1: white over blue, 1080², all three Body values, both engines.
  for (const engine of ['baseline', 'coverage']) {
    for (const body of [100, 60, 30]) {
      matrix.push({
        gate: `white-over-blue-${engine}-b${body}`,
        engine,
        scenario: 'white-over-blue',
        size: 1080,
        body,
      })
    }
  }
  // Criterion 2 + 3: red over blue, 50 rapid strokes, 1080².
  for (const engine of ['baseline', 'coverage']) {
    matrix.push({ gate: `red-over-blue-50-${engine}`, engine, scenario: 'red-over-blue-50', size: 1080 })
  }
  // Watercolor control at Body 0 (both engines are byte-identical there).
  for (const engine of ['baseline', 'coverage']) {
    matrix.push({ gate: `watercolor-50-${engine}`, engine, scenario: 'watercolor-50', size: 1080 })
  }
  // Neutral identity: the variant must be byte-identical to the baseline at Body 0.
  for (const engine of ['baseline', 'coverage']) {
    matrix.push({ gate: `neutral-${engine}`, engine, scenario: 'neutral', size: 256 })
  }
  for (const item of matrix) runGate(item)
  console.log(`\n[spike-001] matrix complete — ${matrix.length} gates in ${outDir}`)
} else {
  const gate = flag('--gate')
  const engine = flag('--engine') ?? 'coverage'
  const scenario = flag('--scenario') ?? 'white-over-blue'
  const size = flag('--size') === undefined ? undefined : Number(flag('--size'))
  const body = flag('--body') === undefined ? undefined : Number(flag('--body'))
  if (!gate) {
    console.error('usage: node run.mjs --gate <name> --engine baseline|coverage --scenario <s> [--size N] [--body 0..100]')
    console.error('       node run.mjs --matrix')
    process.exit(1)
  }
  runGate({ gate, engine, scenario, size, body })
}
