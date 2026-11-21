#!/usr/bin/env node
// ============================================================
//  run.mjs — drive the long-stroke readout.
//
//  Scratch harness only: nothing here is imported by the package.
//  Usage: node probe/long-stroke/run.mjs
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/long-stroke'
const bundlePath = join(outDir, 'probe.bundle.js')
const pagePath = join(outDir, 'page.html')
const resultPath = join(outDir, 'result.json')

function fail(message) {
  console.error(`[long-stroke] ${message}`)
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

mkdirSync(outDir, { recursive: true })
console.log('[long-stroke] bundling probe.ts ...')
const bundle = spawnSync(
  esbuild,
  [
    join(here, 'probe.ts'),
    '--bundle',
    '--format=iife',
    '--platform=browser',
    '--target=es2020',
    '--define:process.env.NODE_ENV="production"',
    '--outfile=' + bundlePath,
  ],
  { encoding: 'utf8' },
)
if (bundle.status !== 0) {
  console.error(bundle.stderr)
  fail('esbuild failed')
}

const html = readFileSync(join(here, 'index.html'), 'utf8')
  .replace('<!--LS-BUNDLE-->', `<script>${readFileSync(bundlePath, 'utf8')}</script>`)
writeFileSync(pagePath, html)

console.log('[long-stroke] running headless Chrome (WebGL2) ...')
const run = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files',
    '--dump-dom',
    'file://' + pagePath,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 },
)
if (run.status !== 0) {
  console.error(run.stderr)
  fail(`headless Chrome exited ${run.status}`)
}
const dom = run.stdout ?? ''
const match = dom.match(/<pre id="result">([\s\S]*?)<\/pre>/)
if (!match) {
  writeFileSync(join(outDir, 'dom.html'), dom)
  fail(`no result block in the DOM (saved to ${join(outDir, 'dom.html')})`)
}
const unescapeHtml = (text) => text
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')
let result
try {
  result = JSON.parse(unescapeHtml(match[1]))
} catch (error) {
  writeFileSync(join(outDir, 'dom.html'), dom)
  fail(`result JSON parse failed: ${error.message}`)
}
writeFileSync(resultPath, JSON.stringify(result, null, 2) + '\n')

console.log('')
console.log('================ long stroke ================')
console.log(`brush ${result.brush} | size ${result.size} | params ${result.params}`)
console.log('pressure dry  covered%  load(min/mean/max)   segments (mean pigment alpha)')
for (const c of result.cases) {
  console.log(
    `${String(c.pressure).padEnd(8)} ${String(c.dry).padEnd(4)} ${String(c.covered).padStart(7)}   ${c.loadMin}/${c.loadMean}/${c.loadMax}`.padEnd(58) +
      c.segments.join(' '),
  )
}
console.log(`result JSON: ${resultPath}`)
console.log('=============================================')
