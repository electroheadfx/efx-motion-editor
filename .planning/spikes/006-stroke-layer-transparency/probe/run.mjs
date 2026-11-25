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

const scenario = readFlag('scenario', 'composite')
const size = Number(readFlag('size', scenario === 'q3b' ? 2048 : 540))
const start = Number(readFlag('start', 0.30))
const amount = Number(readFlag('amount', 100))
const stride = Number(readFlag('stride', 2))
const fitSamples = Number(readFlag('fitSamples', 420))
const seed = Number(readFlag('seed', 0xc0ffee))
const falloff = Number(readFlag('falloff', 50))
const entry = scenario === 'cost' ? 'cost.ts' : scenario === 'q3b' ? 'q3b.ts' : 'probe.ts'
const gate = readFlag('gate', `${scenario}-${size}-s${start}-a${amount}`)

const pageQuery =
  `size=${size}` +
  `&start=${start}` +
  `&amount=${amount / 100}` +
  `&stride=${stride}` +
  `&fitSamples=${fitSamples}` +
  `&falloff=${falloff}` +
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

console.log(`[probe] bundling ${entry} (size=${size}, start=${start}, amount=${amount}, falloff=${falloff}) ...`)
const build = spawnSync(
  esbuild,
  [
    join(here, entry),
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
if (scenario === "q3b") {
  const r = result
  const lat = (l) => `${fmt(l.median)} ms (min ${fmt(l.min)} / p95 ${fmt(l.p95)} / max ${fmt(l.max)}, n ${l.rounds})`
  console.log(`  renderer      : ${r.renderer}`)
  console.log(`  sheet         : requested ${r.sheet.requested}, allocated ${r.sheet.actual} (${r.sheet.pixels} texels)${r.sheet.actual !== r.sheet.requested ? "  <-- CLAMPED" : ""}`)
  console.log(`  stroke rect   : ${JSON.stringify(r.geometry.strokeRect)} = ${r.geometry.strokePixels} texels`)
  console.log("")
  console.log(`  A  merge (stroke-end latency, single draw): ${lat(r.A_mergeLatency.singleDrawAfterIdle)}`)
  console.log(`     12 iterations: ${lat(r.A_mergeLatency.budget12)}   throughput (Q3 method, ${r.A_mergeLatency.budget} it): ${fmt(r.A_mergeLatency.throughputMs)} ms/draw`)
  console.log(`     fence floor: ${fmt(r.A_mergeLatency.fenceOnly.median)} ms`)
  const lad = r.A_mergeLatency.sizeLadder
  console.log(`     size ladder: 1x1 ${fmt(lad.r1.median)} ms, 512² ${fmt(lad.r512.median)} ms, 1024² ${fmt(lad.r1024.median)} ms, full ${fmt(lad.full.median)} ms`)
  console.log("")
  console.log(`  B  first-dab wait (artist pause excluded; floor ${fmt(r.B_firstDab.baselineFenceMs)} ms)`)
  for (const k of ["immediate", "after50ms", "after200ms"]) {
    console.log(`     ${k.padEnd(11)} read ${lat(r.B_firstDab[k])}  felt ${fmt(r.B_firstDab.feltDelayMs[k])} ms   (derived ${fmt(r.B_firstDab.derivedMs[k])} ms)`)
  }
  console.log("")
  console.log(`  C  display    : today ${fmt(r.C_display.cost.today.median)} ms, two states ${fmt(r.C_display.cost.twoStates.median)} ms (delta ${fmt(r.C_display.marginalMs)}), branch ${fmt(r.C_display.cost.branchOnCover.median)} ms — bar ${r.C_display.barMs} ms`)
  console.log(`  D  memory     : +${r.D_memory.addedMiB} MiB of ${r.D_memory.ceilingMiB} MiB (merge targets +${r.D_memory.mergeTargetsMiB})`)
  for (const it of r.D_memory.items) console.log(`       ${String(it.mib).padStart(6)} MiB  ${it.item}`)
  console.log("")
  if (Object.keys(r.E_variants).length) {
    for (const [name, v] of Object.entries(r.E_variants)) {
      const note = v.halfPixels ? ` (half ${v.halfPixels} texels)` : ""
      console.log(`  E  ${name}: latency ${lat(v.latency)}  felt immediate ${fmt(v.feltDelay.immediate)} ms, +50 ms ${fmt(v.feltDelay.after50ms)} ms${note}`)
    }
  } else {
    console.log(`  E  variants   : not needed — the immediate start already meets the bar`)
  }
  for (const c of r.residuals) {
    const mark = c.name === r.verdict.bestCandidate ? " <-- best" : ""
    console.log(`  residual ${c.name.padEnd(24)} felt ${fmt(c.feltMs).padStart(6)} ms  max ${String(c.maxChannel).padStart(3)}  mean ${fmt(c.meanChannel).padStart(5)}  p95 ${String(c.p95Channel).padStart(3)}  over ${String(c.overThreshold).padStart(7)}${mark}`)
  }
  if (r.residual.bins) {
    for (const b of r.residual.bins) {
      console.log(`     aEff ${b.aEff.padEnd(11)} n ${String(b.n).padStart(8)}  max ${String(b.max).padStart(3)}  mean ${fmt(b.mean).padStart(5)}  over ${b.over}`)
    }
  }
  console.log("")
  console.log(`  VERDICT       : merge latency ${r.verdict.mergeLatencyPass ? "PASS" : "FAIL"}, immediate ${r.verdict.immediateStartPass ? "PASS" : "FAIL"}, +50 ms ${r.verdict.after50msPass ? "PASS" : "FAIL"}, +200 ms ${r.verdict.after200msPass ? "PASS" : "FAIL"}`)
  console.log(`                  display fits frame ${r.verdict.displayFitsFrame ? "PASS" : "FAIL"}, memory ${r.verdict.memoryPass ? "PASS" : "FAIL"}, Q3b ${r.verdict.q3bPass ? "PASS" : "FAIL"}, Q4 ${r.verdict.q4Pass === null ? "(not run)" : r.verdict.q4Pass ? "PASS" : "FAIL"}`)
  if (r.q4) {
    const q = r.q4
    console.log("")
    console.log(`  Q4 live vs merged : max ${q.liveVsMerged.maxChannel}/255, mean ${q.liveVsMerged.meanChannel}, p95 ${q.liveVsMerged.p95Channel}, ${q.liveVsMerged.overThreshold} over ${q.liveVsMerged.bar} (${q.liveVsMerged.coveredTexels} covered texels)`)
    console.log(`     betweenness  : ${q.betweenness.outside} of ${q.betweenness.samples} band texels outside the interval`)
    console.log(`     amount 0     : reference ${q.amountZeroBypass.referenceDigest} repeat ${q.amountZeroBypass.repeatDigest} — deterministic ${q.amountZeroBypass.deterministic}`)
    console.log(`     capture      : digest ${q.captureParity.digestEqual ? "equal" : "DIFFERS"}, render vs restored max ${q.captureParity.renderVsRestoredMaxChannel}/255`)
    console.log(`     bake replay  : ${q.bakeReplay.pass ? "equal" : "DIFFERS"} (stroke max ${q.bakeReplay.sameStrokeMax})`)
  }
} else if (scenario === "cost") {
  const r = result
  console.log(`  renderer      : ${r.renderer}`)
  console.log(`  sheet         : requested ${r.sheet.requested}, allocated ${r.sheet.actual} (${r.sheet.pixels} texels)${r.sheet.actual !== r.sheet.requested ? "  <-- CLAMPED" : ""}`)
  console.log(`  thresholds    : realistic rect <= ${r.threshold.realisticRectMs} ms, full sheet <= ${r.threshold.fullSheetMs} ms, residual <= ${r.threshold.residualChannel8}/255`)
  console.log(`  stroke rect   : ${JSON.stringify(r.geometry.strokeRect)} = ${r.geometry.strokeRectPixels} texels (band ${fmt(r.geometry.bandPx)} px)`)
  console.log(`  memory        : layer ${r.memory.layerDoubleMb} MB (double) / ${r.memory.layerPreviewMb} MB (single), merge out ${r.memory.mergeOutputMb} MB, combined ${r.memory.combinedMb} MB vs ${r.memory.budgetMb} MB`)
  console.log("")
  console.log("  budget   rect ms   rect us/texel   full ms   full us/texel   residual(max/mean, iters)")
  for (const b of r.budgets) {
    const res = b.residual ? `${b.residual.maxChannel}/255 ${b.residual.meanChannel} it ${b.residual.iterationsUsedMean}/${b.residual.iterationsUsedMax}` : ""
    console.log(`  ${pad(b.iterations, 6)}  ${pad(fmt(b.rectMs), 7)}  ${pad(b.rectPerTexelUs, 13)}  ${pad(fmt(b.fullMs), 7)}  ${pad(b.fullPerTexelUs, 14)}   ${res}`)
  }
  console.log("")
  for (const [name, m] of Object.entries(r.mitigations)) {
    const res = m.residual ? `${m.residual.maxChannel}/255 ${m.residual.meanChannel} it ${m.residual.iterationsUsedMean}/${m.residual.iterationsUsedMax}` : ""
    console.log(`  ${name.padEnd(14)} rect ${pad(fmt(m.rectMs), 7)} ms   full ${pad(fmt(m.fullMs), 7)} ms   ${res}`)
  }
  console.log("")
  console.log(`  Q2 committed base: band ${r.q2.bandPx} px, between-interval width ${r.q2.betweenWidthPx} px (${(r.q2.betweenShare * 100).toFixed(0)} %), shipped vs ideal max ${fmt(r.q2.shippedVsIdeal.maxChannel8)}/255 mean ${fmt(r.q2.shippedVsIdeal.meanChannel8)}`)
  for (const p of r.q2.profile) {
    console.log(`    x ${pad(p.x, 5)} u ${pad(p.u, 5)} cover ${pad(p.cover, 5)}  t_sheet ${pad(p.tSheet8, 4)} t_base ${pad(p.tBase8, 4)}  shipped ${pad(p.shipped8, 4)} ideal ${pad(p.ideal8, 4)}  alpha ${pad(p.idealAlpha, 5)} implied ${pad(p.impliedAlpha, 6)}`)
  }
  console.log("")
  console.log(`  RIDER  display pool-blind ${r.rider.poolBlind.display}  capture pool-blind ${r.rider.poolBlind.capture}  pickup pool-blind ${r.rider.poolBlind.pickup}`)
  console.log(`         wet movement (fraction of ink moved): ${JSON.stringify(r.rider.wetMovement)}`)
  console.log(`         pickup shift at the crossing:        ${JSON.stringify(r.rider.pickupShift)}`)
} else {
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
    const wv = result.whiteHalf[key]
    console.log(`    ${key.padEnd(7)} layer ${JSON.stringify(wv.layerRgb8)} S=${wv.layerScatter}  linear ${JSON.stringify(wv.layerLinear)}`)
    console.log(`             target linear ${JSON.stringify(wv.targetLinear)}  vs 0.5*layer+0.5 -> err ${fmt(wv.linearMixError8)}/255 (PASS if 0)`)
    console.log(`             pinv delta ${fmt(wv.pinv.delta8)}/255   fit delta ${fmt(wv.fit.delta8)}/255 (${wv.fit.iterations} it)`)
  }
  console.log("")
  console.log("  the law, swept over the fade band (gate = none, the pure lateral alpha)")
  console.log("    scene       law     enc   fall      t=0 t=0.25  t=0.5 t=0.75    t=1")
  for (const r of result.reports) {
    if (r.gate !== "none") continue
    const stations = r.stations.map((st) => `${st.maxChannel}/${st.p95Channel}`)
    const scene = r.scene === "overPaper" ? "paper" : "stroke"
    console.log(`    ${scene.padEnd(11)} ${r.law.padEnd(7)} ${r.encoder.padEnd(4)} ${pad(r.falloff, 4)}  ` + stations.map((st) => st.padStart(7)).join(""))
  }
  console.log("")
  console.log("  the alpha gate (pinv, falloff 50) — station t=0.5, per scene")
  console.log("    scene       law     gate    max  mean  p95  hue    band>1  print   gapWash(max/mean over n)")
  for (const r of result.reports) {
    if (r.encoder !== "pinv" || r.falloff !== 50) continue
    const st = r.stations[2]
    const scene = r.scene === "overPaper" ? "paper" : "stroke"
    console.log(`    ${scene.padEnd(11)} ${r.law.padEnd(7)} ${r.gate.padEnd(7)} ${pad(st.maxChannel, 3)}  ${fmt(st.meanChannel).padStart(4)} ${pad(st.p95Channel, 3)} ${fmt(st.maxHueDeg).padStart(5)}  ${pad(st.bandOutsideBeyond1, 6)}  ${(st.printRetention * 100).toFixed(1)} %   ${fmt(st.gapWashMax)}/${fmt(st.gapWashMean)} (${st.gapN})`)
  }
  console.log("")
  console.log("  between-law violations beyond 1/255 (all stations, both scenes)")
  for (const r of result.reports) {
    const tot = r.stations.reduce((n, st) => n + st.bandOutsideBeyond1, 0)
    if (tot === 0) continue
    const scene = r.scene === "overPaper" ? "paper" : "stroke"
    console.log(`    ${scene}/ ${r.law}/${r.encoder}/${r.gate} falloff ${r.falloff}: ${tot} of ${r.samples * 5 * 16} band comparisons`)
  }
}
console.log("")
