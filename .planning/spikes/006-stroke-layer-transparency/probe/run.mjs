#!/usr/bin/env node
// ============================================================
//  SPIKE 006 — build the composite-law probe and run it in headless Chrome
//  (real WebGL2). Scratch harness only; nothing here is imported by the
//  package.
//
//  Usage:
//    node .planning/spikes/006-stroke-layer-transparency/probe/run.mjs \
//      [--size 540] [--start 0.30] [--amount 100] [--stride 2] [--fitSamples 420]
//
//  The report lands in results/<gate>.json; a failed run saves the DOM beside
//  it so the shader error is readable.
// ============================================================

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..')
const outDir = resolve(here, '../results')

const args = process.argv.slice(2)
const readFlag = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback
}

const size = Number(readFlag('size', 540))
const start = Number(readFlag('start', 0.30))
const amount = Number(readFlag('amount', 100))
const stride = Number(readFlag('stride', 2))
const fitSamples = Number(readFlag('fitSamples', 420))
const seed = Number(readFlag('seed', 0xc0ffee))
const gate = readFlag('gate', `composite-${size}-s${start}-a${amount}`)

const pageQuery =
  `size=${size}` +
  `&start=${start}` +
  `&amount=${amount / 100}` +
  `&stride=${stride}` +
  `&fitSamples=${fitSamples}` +
  `&seed=${seed}`

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

console.log(`[probe] bundling probe.ts (size=${size}, start=${start}, amount=${amount}) ...`)
const build = spawnSync(
  esbuild,
  [
    join(here, 'probe.ts'),
    '--bundle',
    '--format=iife',
    '--platform=browser',
    '--target=es2022',
    '--log-level=warning',
    `--outfile=${join(here, 'probe.bundle.js')}`,
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
  { encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 },
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

const unescapeHtml = (text) => text
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&')

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

if (result.error) {
  writeFileSync(join(outDir, 'dom.html'), dom)
  console.error(`[probe] probe error: ${result.error}`)
  console.error(`[probe] DOM saved to ${join(outDir, 'dom.html')}`)
  process.exit(1)
}
if (result.mirror && result.mirror.pass !== true) {
  writeFileSync(resultPath, JSON.stringify(result, null, 2))
  console.error(`[probe] MIRROR GATE FAILED: max ${result.mirror.maxChannel}/255 over ${result.mirror.n} states`)
  console.error(`[probe] report saved to ${resultPath}`)
  process.exit(2)
}

writeFileSync(resultPath, JSON.stringify(result, null, 2))
console.log(`[probe] done in ${elapsedMs} ms — report: ${resultPath}`)

// --- the console summary ----------------------------------------------------
const fmt = (v) => (typeof v === "number" ? v.toFixed(2) : String(v))
const pad = (v, n) => String(v).padStart(n)

console.log("")
console.log(`  mirror gate   : max ${fmt(result.mirror.maxChannel)}/255, p99 ${fmt(result.mirror.p99Channel)}/255 over ${result.mirror.n} states ` +
  `(scatter share ${(result.mirror.scatteredShare * 100).toFixed(0)} %) — ${result.mirror.pass ? "PASS" : "FAIL"}`)
if (result.endToEnd) {
  console.log(`  end-to-end    : real displayFS vs the mirror on a real composite sheet — max ${fmt(result.endToEnd.maxChannel)}/255 over ${result.endToEnd.samples} texels`)
}
const g = result.geometry
console.log(`  geometry      : stroke B centre x ${g.centreX}, band ${fmt(g.bandPx)} px, bbox ${JSON.stringify(g.bboxB)}`)
console.log(`  cells         : ${result.cells.overPaper} over paper, ${result.cells.overStroke} over stroke A`)
console.log(`  environment   : B alone ${JSON.stringify(result.environment.coreBAlone)} vs B over A ${JSON.stringify(result.environment.coreBOverA)} -> delta ${fmt(result.environment.envDeltaAtCore)}/255 at ${JSON.stringify(result.environment.at)}`)
console.log("")
console.log("  50 % layer over white — the law's own check, in LINEAR light")
for (const key of Object.keys(result.whiteHalf)) {
  const w = result.whiteHalf[key]
  console.log(`    ${key.padEnd(7)} layer ${JSON.stringify(w.layerRgb8)} S=${w.layerScatter}  linear ${JSON.stringify(w.layerLinear)}`)
  console.log(`             target linear ${JSON.stringify(w.targetLinear)}  vs 0.5*layer+0.5 -> err ${fmt(w.linearMixError8)}/255 (PASS if 0)`)
  console.log(`             pinv delta ${fmt(w.pinv.delta8)}/255   fit delta ${fmt(w.fit.delta8)}/255 (${w.fit.iterations} it)`)
}
console.log("")
console.log("  the law, swept over the fade band (gate = none, the pure lateral alpha)")
console.log("    scene       law     enc   fall  " + [0, 0.25, 0.5, 0.75, 1].map((t) => `t=${t}`.padStart(7)).join(""))
for (const r of result.reports) {
  if (r.gate !== "none") continue
  const stations = r.stations.map((s) => `${s.maxChannel}/${s.p95Channel}`)
  const scene = r.scene === "overPaper" ? "paper" : "stroke"
  console.log(`    ${scene.padEnd(11)} ${r.law.padEnd(7)} ${r.encoder.padEnd(4)} ${pad(r.falloff, 4)}  ` + stations.map((s) => s.padStart(7)).join(""))
}
console.log("")
console.log("  the alpha gate (pinv, falloff 50) — station t=0.5, per scene")
console.log("    scene       law     gate    max  mean  p95  hue    band>1  print   gapWash(max/mean over n)")
for (const r of result.reports) {
  if (r.encoder !== "pinv" || r.falloff !== 50) continue
  const s = r.stations[2]
  const scene = r.scene === "overPaper" ? "paper" : "stroke"
  console.log(`    ${scene.padEnd(11)} ${r.law.padEnd(7)} ${r.gate.padEnd(7)} ${pad(s.maxChannel, 3)}  ${fmt(s.meanChannel).padStart(4)} ${pad(s.p95Channel, 3)} ${fmt(s.maxHueDeg).padStart(5)}  ${pad(s.bandOutsideBeyond1, 6)}  ${(s.printRetention * 100).toFixed(1)} %   ${fmt(s.gapWashMax)}/${fmt(s.gapWashMean)} (${s.gapN})`)
}
console.log("")
console.log("  the alpha gate at the band midpoint, gap washing only (delta from the untouched base)")
console.log("    scene       law     none           cover          alpha")
for (const r of result.reports) {
  if (r.encoder !== "pinv" || r.falloff !== 50 || r.gate !== "none") continue
  const pick = (gate) => result.reports.find((x) => x.scene === r.scene && x.law === r.law && x.encoder === "pinv" && x.falloff === 50 && x.gate === gate)
  const cell = (x) => x ? `${fmt(x.stations[2].gapWashMax)}/${fmt(x.stations[2].gapWashMean)}` : "-"
  const scene = r.scene === "overPaper" ? "paper" : "stroke"
  console.log(`    ${scene.padEnd(11)} ${r.law.padEnd(7)} ${cell(pick("none")).padEnd(14)} ${cell(pick("cover")).padEnd(14)} ${cell(pick("alpha"))}`)
}
console.log("")
console.log("  between-law violations beyond 1/255 (all stations, both scenes)")
for (const r of result.reports) {
  const tot = r.stations.reduce((n, s) => n + s.bandOutsideBeyond1, 0)
  if (tot === 0) continue
  const scene = r.scene === "overPaper" ? "paper" : "stroke"
  console.log(`    ${scene}/ ${r.law}/${r.encoder}/${r.gate} falloff ${r.falloff}: ${tot} of ${r.samples * 5 * 16} band comparisons`)
}
console.log("")
