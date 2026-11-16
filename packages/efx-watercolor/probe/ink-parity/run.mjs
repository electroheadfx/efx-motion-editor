#!/usr/bin/env node
// Scratch harness: bundle the ink-parity probe and run it in headless Chrome
// (real WebGL2). Usage:
//   node packages/efx-watercolor/probe/ink-parity/run.mjs

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const outDir = '/tmp/ink-parity'
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

console.log('[ink-parity] bundling probe.ts ...')
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

console.log('[ink-parity] running headless Chrome (WebGL2) ...')
const run = spawnSync(
  chrome,
  [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--enable-unsafe-swiftshader',
    '--hide-scrollbars',
    '--window-size=1200,1200',
    '--allow-file-access-from-files',
    '--dump-dom',
    `file://${join(here, 'index.html')}`,
  ],
  { encoding: 'utf8', timeout: 3600000, maxBuffer: 64 * 1024 * 1024 },
)
if (run.error) {
  console.error('[ink-parity] Chrome failed:', run.error.message)
  process.exit(1)
}

const dom = run.stdout ?? ''
const match = dom.match(/<pre id="result"[^>]*>([\s\S]*?)<\/pre>/)
const statusMatch = dom.match(/<p id="status">([\s\S]*?)<\/p>/)
const status = statusMatch ? statusMatch[1].trim() : '(missing)'
const unescapeHtml = (text) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

if (!match || match[1].trim().length === 0) {
  console.error(`[ink-parity] no result (status=${status}, exit=${run.status})`)
  if (run.stderr) console.error(run.stderr.slice(0, 4000))
  writeFileSync(join(outDir, 'dom.html'), dom)
  process.exit(1)
}

let result
try {
  result = JSON.parse(unescapeHtml(match[1]))
} catch (error) {
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[ink-parity] JSON parse failed: ${error.message}`)
  process.exit(1)
}
writeFileSync(join(outDir, 'result.json'), JSON.stringify(result, null, 2))
if (result.pngs) {
  for (const [name, dataUrl] of Object.entries(result.pngs)) {
    const prefix = 'data:image/png;base64,'
    if (typeof dataUrl === 'string' && dataUrl.startsWith(prefix)) {
      writeFileSync(join(outDir, `${name}.png`), Buffer.from(dataUrl.slice(prefix.length), 'base64'))
    }
  }
}
console.log(JSON.stringify(result, null, 2))
console.log(`result: ${join(outDir, 'result.json')}`)
