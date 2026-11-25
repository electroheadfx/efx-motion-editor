#!/usr/bin/env node
// ============================================================
// end-density.mjs — quick 261125-rtc's bar, as code.
//
// The declared acceptance for the bristle brush's end-cap density block:
// the stroked end must read at the BODY's density on both the carried-pigment
// and the inked-fraction surfaces, without moving the body, the start, the
// block-free stroke silhouettes or the pale-line baselines. Every constant
// below was DECLARED BEFORE the first post-fix capture was taken; none may be
// tuned after seeing post values. If a law cannot pass a constant, the law is
// revised, never the constant.
//
// usage:
//   node end-density.mjs --pre <dir>                 report + capture integrity
//   node end-density.mjs --pre <dir> --post <dir> --assert
//                                                    the full pre/post bar
//
//   --pre <dir>      where the rtc-pre-* captures live (default /tmp/medium-engine)
//   --post <dir>     where the rtc-post-* captures live (default: the --pre dir)
//   --assert         pair every pre cell with its post twin by suffix and
//                    enforce the constants below; also requires the two
//                    determinism captures
//
// Without --assert the tool is report-only over the PRE set, but it still
// exits 1 when an expected capture is missing, when a bristle-end capture
// lacks its census/gather proof, or when any capture's brush echo is not
// 'bristle-round' — a capture that photographed another brush is not evidence.
//
// The pre set is exactly 41 cells:
//   20 matrix   s{050,100,150,200,300}-d{00,70}-{stop,bake}
//   12 release  s{100,300}-d{00,70}-stop-rp{10,50,90}
//    1 lift     s100-d70-lift
//    8 pale line {line,line-over}-s{035,100}-mut{1,2}
// `det-s100-d70-stop-a/-b` is required in --assert mode only.
//
// The bristle-end report shape it reads (probe.ts `bristleEndReport`):
//   brush, endCensus { drive, taps, endCaps, last40 }, gather { calls, endCapCalls },
//   endSetup, endMetrics { density { zones { pigment|coverage|transparent { body|end
//   { mean, inked } } }, endZonePx, effectiveSampleScale }, end { flatPct,
//   longestFlatRunPx, ... }, start { flatPct, longestFlatRunPx, spreadPx, zoneDark },
//   thickness { body { meanPx } } }
// The pale-line report shape it reads (probe.ts `lineProfileSet`), per surface
// of `lineSurfaces` (postApply / postSettle / postFix):
//   tiling.enclosed { fracPct, maxRunPx }, tiling.coherence { mean, fracHigh },
//   halo.down|up { peakRel, run }
// Those captures emit no endCensus/gather/endMetrics/endSetup/drive, so no end
// field is read for a line row.
//
// Report contract: one row per cell. Exit 0 only when every check the mode
// declares passes. This tool never writes a capture and never moves a
// baseline; it is a reader of /tmp/medium-engine.
// ============================================================

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// --- the declared bar -------------------------------------------------------
// Declared 2026-11-25, BEFORE the post captures. Do not tune.

/** The carried-pigment surface: |end − body| zone-mean gap on the 32 matrix
 *  and release cells, post-fix. */
const PIGMENT_GAP_MAX = 0.02
/** The inked-fraction surface: |end − body| inked-share gap on the same 32. */
const COVERAGE_GAP_MAX = 0.03
/** The lift cell is an OBSERVATION cell: its pigment gap may grow by at most
 *  this much versus the pre capture; it is never asserted to PIGMENT_GAP_MAX.
 *  Declared because no admissible stamp-time trigger reaches the live lift's
 *  end (its terminal dabs are stamped before the engine knows the stroke
 *  ended) — the press-move-release UAT rows are that path's judge. */
const LIFT_OBSERVE_DRIFT_MAX = 0.01
/** The body must not move: zone-mean drift, pigment and transparent. */
const BODY_DRIFT_MAX = 0.01
/** The start (landing ramp) must not move: transparent zone-mean drift. */
const START_DRIFT_MAX = 0.01
/** The body thickness must not move, in document px. */
const BODY_THICKNESS_DRIFT_MAX = 2
/** The end silhouette may flatten by at most this many points. */
const FLAT_PCT_GROWTH_MAX = 5
/** The end's longest flat run must stay at or below this many px. */
const LONGEST_RUN_MAX_PX = 40
/** The start's silhouette may move by at most these amounts. */
const START_SHAPE_DRIFT = { flatPct: 5, longest: 3, spread: 3 }
/** The bake lane's pigment delta must sit within this of the stop lane's. */
const BAKE_LIVE_GAP_MAX = 0.02
/** Pale line: ENCLOSED share growth, points. */
const LINE_FRAC_GROWTH_MAX = 0.5
/** Pale line: ENCLOSED longest-run growth, px, under an absolute cap. */
const LINE_RUN_GROWTH_MAX = 3
const LINE_RUN_ABS_CAP_PX = 20
/** Pale line: fringe coherence growth. */
const LINE_COHERENCE_MEAN_GROWTH = 0.05
const LINE_COHERENCE_FRACHIGH_GROWTH = 0.05
/** Pale line: halo growth per side. */
const LINE_HALO_PEAK_GROWTH = 0.05
const LINE_HALO_RUN_GROWTH = 2
/** The doc's absolute ENCLOSED target; gates only when the pre cell already
 *  met it (a pre cell that never met it is not this law's to fix). */
const ENCLOSED_TARGET = { fracPct: 1, maxRunPx: 20 }
/** The determinism pair must agree on these. */
const DETERMINISM_FIELDS = ['digestPaper', 'digestTransparent', 'digestWhite', 'digestPigment', 'byteLength']

// --- the cell set -----------------------------------------------------------

const SIZES = ['050', '100', '150', '200', '300']
const DRYS = ['00', '70']
const LINE_SURFACES = ['postApply', 'postSettle', 'postFix']

/** Every expected pre cell: its suffix and its own drive (asserted so a
 *  crossed capture cannot stand in for the lane it claims). */
const END_CELLS = []
for (const size of SIZES) {
  for (const dry of DRYS) {
    for (const drive of ['stop', 'bake']) {
      END_CELLS.push({ suffix: `s${size}-d${dry}-${drive}`, drive })
    }
  }
}
for (const size of ['100', '300']) {
  for (const dry of DRYS) {
    for (const rp of ['10', '50', '90']) {
      END_CELLS.push({ suffix: `s${size}-d${dry}-stop-rp${rp}`, drive: 'stop' })
    }
  }
}
END_CELLS.push({ suffix: 's100-d70-lift', drive: 'lift' })

const LINE_CELLS = []
for (const kind of ['line', 'line-over']) {
  for (const size of ['035', '100']) {
    for (const mut of ['1', '2']) {
      LINE_CELLS.push({ suffix: `${kind}-s${size}-mut${mut}` })
    }
  }
}

const DETERMINISM_SUFFIXES = ['det-s100-d70-stop-a', 'det-s100-d70-stop-b']

/** The 32 cells the density bar applies to (every end cell except the lift). */
const DENSITY_CELLS = END_CELLS.filter((cell) => cell.drive !== 'lift')

// --- helpers ---------------------------------------------------------------

const args = process.argv.slice(2)
const readFlag = (name, fallback) => {
  const index = args.indexOf(name)
  if (index < 0) return fallback
  const value = args[index + 1]
  if (value === undefined || value.startsWith('--')) {
    console.error(`missing value for ${name}`)
    process.exit(2)
  }
  return value
}
const preDir = readFlag('--pre', '/tmp/medium-engine')
const postDir = readFlag('--post', preDir)
const assertMode = args.includes('--assert')

const failures = []
const fail = (message) => failures.push(message)

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const fixed = (value, digits = 4) => (num(value) === null ? 'n/a' : num(value).toFixed(digits))
const signed = (value, digits = 4) => {
  const n = num(value)
  return n === null ? 'n/a' : (n >= 0 ? '+' : '') + n.toFixed(digits)
}
const pad = (value, width) => String(value).padEnd(width)

const readCapture = (dir, phase, suffix) => {
  const path = join(dir, `rtc-${phase}-${suffix}.json`)
  if (!existsSync(path)) return null
  try {
    return { path, report: JSON.parse(readFileSync(path, 'utf8')) }
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`)
    return null
  }
}

const requireBrush = (label, report) => {
  if (report.brush !== 'bristle-round') {
    fail(`${label}: brush echo is ${JSON.stringify(report.brush)}, expected 'bristle-round'`)
    return false
  }
  return true
}

/** The three inked fractions of one end capture, or null when the report is
 *  too old to carry them (a named failure, never a silent skip). */
const endReadings = (label, report) => {
  const zones = report?.endMetrics?.density?.zones
  const d = report?.endMetrics
  if (zones === undefined || d === undefined) {
    fail(`${label}: no endMetrics.density zones (capture predates the density block?)`)
    return null
  }
  const read = (surface, key) => {
    const zone = zones?.[surface]?.[key]
    if (zone === undefined) {
      fail(`${label}: density.zones.${surface}.${key} is missing`)
      return null
    }
    return zone
  }
  const pigmentBody = read('pigment', 'body')
  const pigmentEnd = read('pigment', 'end')
  const coverageBody = read('coverage', 'body')
  const coverageEnd = read('coverage', 'end')
  const transparentBody = read('transparent', 'body')
  const transparentEnd = read('transparent', 'end')
  if (!pigmentBody || !pigmentEnd || !coverageBody || !coverageEnd || !transparentBody || !transparentEnd) {
    return null
  }
  return {
    scale: report.endMetrics.density.effectiveSampleScale,
    endZonePx: report.endMetrics.density.endZonePx,
    pigmentBody: pigmentBody.mean,
    pigmentEnd: pigmentEnd.mean,
    pigmentDelta: pigmentEnd.mean - pigmentBody.mean,
    coverageBody: coverageBody.inked,
    coverageEnd: coverageEnd.inked,
    coverageGap: coverageEnd.inked - coverageBody.inked,
    transparentBody: transparentBody.mean,
    transparentEnd: transparentEnd.mean,
    transparentDelta: transparentEnd.mean - transparentBody.mean,
    endFlatPct: d.end?.flatPct,
    endLongestRun: d.end?.longestFlatRunPx,
    startZoneDark: d.start?.zoneDark,
    startFlatPct: d.start?.flatPct,
    startLongestRun: d.start?.longestFlatRunPx,
    startSpread: d.start?.spreadPx,
    bodyThickness: d.thickness?.body?.meanPx,
  }
}

// --- the pre report ---------------------------------------------------------

console.log('=== quick 261125-rtc end-density bar ===')
console.log(`pre dir  : ${preDir}`)
console.log(`post dir : ${postDir}${assertMode ? '  (--assert)' : '  (report only)'}`)
console.log('')

const preEnd = new Map()
console.log('--- bristle-end cells (33) ----------------------------------------------------------------')
console.log(
  pad('suffix', 24) +
    pad('drive', 6) +
    pad('scale', 7) +
    pad('pigBody', 9) +
    pad('pigEnd', 9) +
    pad('pigDelta', 10) +
    pad('inkBody', 9) +
    pad('inkEnd', 9) +
    pad('inkGap', 9) +
    pad('trBody', 9) +
    pad('trEnd', 9) +
    pad('endFlat', 9) +
    pad('longRun', 9) +
    pad('gather', 8) +
    pad('gEndCap', 9) +
    pad('taps', 7) +
    'cEndCaps',
)
for (const cell of END_CELLS) {
  const capture = readCapture(preDir, 'pre', cell.suffix)
  if (capture === null) {
    fail(`missing pre capture: rtc-pre-${cell.suffix}.json`)
    continue
  }
  const { report, path } = capture
  preEnd.set(cell.suffix, report)
  requireBrush(`pre ${cell.suffix}`, report)
  const census = report.endCensus
  if (census === null || census === undefined) {
    fail(`pre ${cell.suffix}: endCensus is null (the shared census did not span this lane)`)
  } else {
    if (!(num(census.taps) > 0)) fail(`pre ${cell.suffix}: endCensus.taps is ${JSON.stringify(census.taps)} (expected > 0)`)
    if (census.drive !== cell.drive) {
      fail(`pre ${cell.suffix}: endCensus.drive is ${JSON.stringify(census.drive)}, expected '${cell.drive}'`)
    }
  }
  if (!(num(report.gather?.calls) > 0)) {
    fail(`pre ${cell.suffix}: gather.calls is ${JSON.stringify(report.gather?.calls)} (expected > 0)`)
  }
  const readings = endReadings(`pre ${cell.suffix}`, report)
  if (readings === null) continue
  console.log(
    pad(cell.suffix, 24) +
      pad(cell.drive, 6) +
      pad(fixed(readings.scale, 2), 7) +
      pad(fixed(readings.pigmentBody), 9) +
      pad(fixed(readings.pigmentEnd), 9) +
      pad(signed(readings.pigmentDelta), 10) +
      pad(fixed(readings.coverageBody), 9) +
      pad(fixed(readings.coverageEnd), 9) +
      pad(signed(readings.coverageGap), 9) +
      pad(fixed(readings.transparentBody), 9) +
      pad(fixed(readings.transparentEnd), 9) +
      pad(fixed(readings.endFlatPct, 2), 9) +
      pad(fixed(readings.endLongestRun, 0), 9) +
      pad(JSON.stringify(report.gather?.calls ?? 'n/a'), 8) +
      pad(JSON.stringify(report.gather?.endCapCalls ?? 'n/a'), 9) +
      pad(JSON.stringify(census?.taps ?? 'n/a'), 7) +
      JSON.stringify(census?.endCaps ?? 'n/a'),
  )
  if (!path.endsWith(`rtc-pre-${cell.suffix}.json`)) fail(`pre ${cell.suffix}: unexpected path ${path}`)
}

console.log('')
console.log('--- pale-line cells (8) ------------------------------------------------------------------')
console.log(
  pad('suffix', 22) +
    pad('surface', 12) +
    pad('enclose%', 10) +
    pad('enclRun', 9) +
    pad('cohMean', 9) +
    pad('cohHigh', 9) +
    pad('haloDn', 9) +
    pad('haloDnRun', 10) +
    pad('haloUp', 9) +
    'haloUpRun',
)
const preLine = new Map()
for (const cell of LINE_CELLS) {
  const capture = readCapture(preDir, 'pre', cell.suffix)
  if (capture === null) {
    fail(`missing pre capture: rtc-pre-${cell.suffix}.json`)
    continue
  }
  const { report } = capture
  preLine.set(cell.suffix, report)
  requireBrush(`pre ${cell.suffix}`, report)
  const surfaces = report.lineSurfaces
  if (surfaces === undefined || surfaces === null) {
    fail(`pre ${cell.suffix}: no lineSurfaces block (the capture photographed another scenario?)`)
    continue
  }
  for (const surface of LINE_SURFACES) {
    const entry = surfaces[surface]
    if (entry === undefined) {
      fail(`pre ${cell.suffix}: lineSurfaces.${surface} is missing`)
      continue
    }
    const enclosed = entry.tiling?.enclosed
    const coherence = entry.tiling?.coherence
    const halo = entry.halo
    if (enclosed === undefined || enclosed === null) {
      fail(`pre ${cell.suffix}.${surface}: tiling.enclosed is null (band too narrow for the scan?)`)
      continue
    }
    if (coherence === undefined) {
      fail(`pre ${cell.suffix}.${surface}: tiling.coherence is missing`)
      continue
    }
    if (halo?.down === undefined || halo?.up === undefined) {
      fail(`pre ${cell.suffix}.${surface}: halo sides are missing`)
      continue
    }
    console.log(
      pad(cell.suffix, 22) +
        pad(surface, 12) +
        pad(fixed(enclosed.fracPct, 2), 10) +
        pad(fixed(enclosed.maxRunPx, 0), 9) +
        pad(fixed(coherence.mean), 9) +
        pad(fixed(coherence.fracHigh), 9) +
        pad(fixed(halo.down.peakRel), 9) +
        pad(fixed(halo.down.run, 0), 10) +
        pad(fixed(halo.up.peakRel), 9) +
        fixed(halo.up.run, 0),
    )
  }
}
console.log('')
console.log(`pale-line absolute ENCLOSED target (doc): frac <= ${ENCLOSED_TARGET.fracPct}% and maxRun <= ${ENCLOSED_TARGET.maxRunPx} px;`)
console.log('  it gates a post cell only when its own pre capture already met it.')

// --- the post assert --------------------------------------------------------

if (assertMode) {
  console.log('')
  if (!existsSync(preDir)) fail(`--pre dir does not exist: ${preDir}`)
  if (!existsSync(postDir)) fail(`--post dir does not exist: ${postDir}`)

  // The 33 bristle-end post cells: the census/gather proof and the bar.
  const postEnd = new Map()
  const postReadings = new Map()
  for (const cell of END_CELLS) {
    const label = `post ${cell.suffix}`
    const capture = readCapture(postDir, 'post', cell.suffix)
    if (capture === null) {
      fail(`missing post capture: rtc-post-${cell.suffix}.json`)
      continue
    }
    const { report } = capture
    postEnd.set(cell.suffix, report)
    requireBrush(label, report)
    const census = report.endCensus
    if (census === null || census === undefined) {
      fail(`${label}: endCensus is null (bake lanes must carry a populated census)`)
    } else {
      if (!(num(census.taps) > 0)) fail(`${label}: endCensus.taps is ${JSON.stringify(census.taps)} (expected > 0)`)
      if (census.drive !== cell.drive) {
        fail(`${label}: endCensus.drive is ${JSON.stringify(census.drive)}, expected '${cell.drive}'`)
      }
    }
    if (!(num(report.gather?.calls) > 0)) {
      fail(`${label}: gather.calls is ${JSON.stringify(report.gather?.calls)} (expected > 0)`)
    }
    const readings = endReadings(label, report)
    if (readings === null) continue
    postReadings.set(cell.suffix, readings)

    // The density bar: the carried-pigment and inked-fraction gaps.
    if (cell.drive !== 'lift') {
      if (!(Math.abs(readings.pigmentDelta) <= PIGMENT_GAP_MAX)) {
        fail(
          `${label}: |pigment end - body| = ${fixed(Math.abs(readings.pigmentDelta))} > PIGMENT_GAP_MAX ${PIGMENT_GAP_MAX}`,
        )
      }
      if (!(Math.abs(readings.coverageGap) <= COVERAGE_GAP_MAX)) {
        fail(
          `${label}: |coverage inked end - body| = ${fixed(Math.abs(readings.coverageGap))} > COVERAGE_GAP_MAX ${COVERAGE_GAP_MAX}`,
        )
      }
    }

    // The structural bars against the pre twin.
    const pre = preEnd.get(cell.suffix)
    const preReadings = pre === undefined ? null : endReadings(`pre ${cell.suffix}`, pre)
    if (preReadings === null) {
      fail(`${label}: no usable pre twin for the structural bars`)
      continue
    }
    // BODY_DRIFT: pigment and transparent body zone means.
    if (!(Math.abs(readings.pigmentBody - preReadings.pigmentBody) <= BODY_DRIFT_MAX)) {
      fail(
        `${label}: pigment body drift ${signed(readings.pigmentBody - preReadings.pigmentBody)} > BODY_DRIFT_MAX ${BODY_DRIFT_MAX}`,
      )
    }
    if (!(Math.abs(readings.transparentBody - preReadings.transparentBody) <= BODY_DRIFT_MAX)) {
      fail(
        `${label}: transparent body drift ${signed(readings.transparentBody - preReadings.transparentBody)} > BODY_DRIFT_MAX ${BODY_DRIFT_MAX}`,
      )
    }
    // START_DRIFT: the transparent landing-ramp zone mean (the report carries
    // no pigment start zone; the transparent one is the start's writer).
    if (!(Math.abs(readings.startZoneDark - preReadings.startZoneDark) <= START_DRIFT_MAX)) {
      fail(
        `${label}: start zone drift ${signed(readings.startZoneDark - preReadings.startZoneDark)} > START_DRIFT_MAX ${START_DRIFT_MAX}`,
      )
    }
    // BODY_THICKNESS_DRIFT.
    if (!(Math.abs(readings.bodyThickness - preReadings.bodyThickness) <= BODY_THICKNESS_DRIFT_MAX)) {
      fail(
        `${label}: body thickness drift ${signed(readings.bodyThickness - preReadings.bodyThickness, 2)} px > BODY_THICKNESS_DRIFT_MAX ${BODY_THICKNESS_DRIFT_MAX}`,
      )
    }
    // The end silhouette: it may not flatten into a wall.
    if (!(readings.endFlatPct <= preReadings.endFlatPct + FLAT_PCT_GROWTH_MAX)) {
      fail(`${label}: end flatPct ${fixed(readings.endFlatPct, 2)} > pre ${fixed(preReadings.endFlatPct, 2)} + ${FLAT_PCT_GROWTH_MAX}`)
    }
    if (!(readings.endLongestRun <= LONGEST_RUN_MAX_PX)) {
      fail(`${label}: end longestFlatRunPx ${fixed(readings.endLongestRun, 0)} > LONGEST_RUN_MAX_PX ${LONGEST_RUN_MAX_PX}`)
    }
    // The start's silhouette: untouched.
    if (!(readings.startFlatPct <= preReadings.startFlatPct + START_SHAPE_DRIFT.flatPct)) {
      fail(`${label}: start flatPct ${fixed(readings.startFlatPct, 2)} > pre ${fixed(preReadings.startFlatPct, 2)} + ${START_SHAPE_DRIFT.flatPct}`)
    }
    if (!(readings.startLongestRun <= preReadings.startLongestRun + START_SHAPE_DRIFT.longest)) {
      fail(
        `${label}: start longestFlatRunPx ${fixed(readings.startLongestRun, 0)} > pre ${fixed(preReadings.startLongestRun, 0)} + ${START_SHAPE_DRIFT.longest}`,
      )
    }
    if (!(readings.startSpread <= preReadings.startSpread + START_SHAPE_DRIFT.spread)) {
      fail(`${label}: start spreadPx ${fixed(readings.startSpread, 2)} > pre ${fixed(preReadings.startSpread, 2)} + ${START_SHAPE_DRIFT.spread}`)
    }
    // The lift is an observation cell: growth is reported, never promoted.
    if (cell.drive === 'lift') {
      const preGap = Math.abs(preReadings.pigmentDelta)
      const postGap = Math.abs(readings.pigmentDelta)
      const verdict = postGap <= preGap + LIFT_OBSERVE_DRIFT_MAX ? 'observed' : 'DRIFT'
      console.log(
        `lift observation: pre gap ${fixed(preGap)} -> post gap ${fixed(postGap)} (${verdict}; never asserted to PIGMENT_GAP_MAX)`,
      )
      if (verdict === 'DRIFT') {
        fail(`${label}: lift pigment gap grew ${fixed(postGap - preGap)} > LIFT_OBSERVE_DRIFT_MAX ${LIFT_OBSERVE_DRIFT_MAX}`)
      }
    }
  }

  // BAKE_LIVE_GAP: at the same size and dry, the bake delta sits within the
  // stop delta's band.
  for (const size of SIZES) {
    for (const dry of DRYS) {
      const stop = postReadings.get(`s${size}-d${dry}-stop`)
      const bake = postReadings.get(`s${size}-d${dry}-bake`)
      if (stop === undefined || bake === undefined) continue // already failed as missing
      const gap = Math.abs(bake.pigmentDelta - stop.pigmentDelta)
      if (!(gap <= BAKE_LIVE_GAP_MAX)) {
        fail(
          `s${size}-d${dry} bake/live: |bake delta - stop delta| = ${fixed(gap)} > BAKE_LIVE_GAP_MAX ${BAKE_LIVE_GAP_MAX} (bake ${signed(bake.pigmentDelta)}, stop ${signed(stop.pigmentDelta)})`,
        )
      }
    }
  }

  // The 8 pale-line post cells: the historical pale-lane guard on the fields
  // the line report actually carries.
  for (const cell of LINE_CELLS) {
    const label = `post ${cell.suffix}`
    const capture = readCapture(postDir, 'post', cell.suffix)
    if (capture === null) {
      fail(`missing post capture: rtc-post-${cell.suffix}.json`)
      continue
    }
    const { report } = capture
    requireBrush(label, report)
    const pre = preLine.get(cell.suffix)
    const preSurfaces = pre?.lineSurfaces
    const postSurfaces = report.lineSurfaces
    if (preSurfaces === undefined || preSurfaces === null) {
      fail(`${label}: no pre lineSurfaces twin`)
      continue
    }
    if (postSurfaces === undefined || postSurfaces === null) {
      fail(`${label}: no post lineSurfaces block`)
      continue
    }
    for (const surface of LINE_SURFACES) {
      const before = preSurfaces[surface]
      const after = postSurfaces[surface]
      if (before === undefined || after === undefined) {
        fail(`${label}.${surface}: lineSurfaces.${surface} is missing on one side`)
        continue
      }
      const bar = `${label}.${surface}`
      const preEnclosed = before.tiling?.enclosed
      const postEnclosed = after.tiling?.enclosed
      if (preEnclosed === undefined || preEnclosed === null || postEnclosed === undefined || postEnclosed === null) {
        fail(`${bar}: tiling.enclosed is null on one side`)
      } else {
        if (!(postEnclosed.fracPct <= preEnclosed.fracPct + LINE_FRAC_GROWTH_MAX)) {
          fail(`${bar}: enclosed fracPct ${fixed(postEnclosed.fracPct, 2)} > pre ${fixed(preEnclosed.fracPct, 2)} + ${LINE_FRAC_GROWTH_MAX}`)
        }
        if (!(postEnclosed.maxRunPx <= Math.min(preEnclosed.maxRunPx + LINE_RUN_GROWTH_MAX, LINE_RUN_ABS_CAP_PX))) {
          fail(
            `${bar}: enclosed maxRunPx ${fixed(postEnclosed.maxRunPx, 0)} > min(pre ${fixed(preEnclosed.maxRunPx, 0)} + ${LINE_RUN_GROWTH_MAX}, ${LINE_RUN_ABS_CAP_PX})`,
          )
        }
        if (preEnclosed.fracPct <= ENCLOSED_TARGET.fracPct && !(postEnclosed.fracPct <= ENCLOSED_TARGET.fracPct)) {
          fail(`${bar}: enclosed fracPct left the absolute target (pre met it): ${fixed(postEnclosed.fracPct, 2)} > ${ENCLOSED_TARGET.fracPct}`)
        }
        if (preEnclosed.maxRunPx <= ENCLOSED_TARGET.maxRunPx && !(postEnclosed.maxRunPx <= ENCLOSED_TARGET.maxRunPx)) {
          fail(`${bar}: enclosed maxRunPx left the absolute target (pre met it): ${fixed(postEnclosed.maxRunPx, 0)} > ${ENCLOSED_TARGET.maxRunPx}`)
        }
      }
      const preCoherence = before.tiling?.coherence
      const postCoherence = after.tiling?.coherence
      if (preCoherence === undefined || postCoherence === undefined) {
        fail(`${bar}: tiling.coherence is missing on one side`)
      } else {
        if (!(postCoherence.mean <= preCoherence.mean + LINE_COHERENCE_MEAN_GROWTH)) {
          fail(`${bar}: coherence mean ${fixed(postCoherence.mean)} > pre ${fixed(preCoherence.mean)} + ${LINE_COHERENCE_MEAN_GROWTH}`)
        }
        if (!(postCoherence.fracHigh <= preCoherence.fracHigh + LINE_COHERENCE_FRACHIGH_GROWTH)) {
          fail(`${bar}: coherence fracHigh ${fixed(postCoherence.fracHigh)} > pre ${fixed(preCoherence.fracHigh)} + ${LINE_COHERENCE_FRACHIGH_GROWTH}`)
        }
      }
      for (const side of ['down', 'up']) {
        const preHalo = before.halo?.[side]
        const postHalo = after.halo?.[side]
        if (preHalo === undefined || postHalo === undefined) {
          fail(`${bar}: halo.${side} is missing on one side`)
          continue
        }
        // A null peakRel is a measured absence (no pale ring found); it can
        // grow from nothing only when there was no pre reading to grow from.
        if (num(preHalo.peakRel) !== null && num(postHalo.peakRel) !== null) {
          if (!(postHalo.peakRel <= preHalo.peakRel + LINE_HALO_PEAK_GROWTH)) {
            fail(`${bar}: halo.${side}.peakRel ${fixed(postHalo.peakRel)} > pre ${fixed(preHalo.peakRel)} + ${LINE_HALO_PEAK_GROWTH}`)
          }
        } else if (num(preHalo.peakRel) === null && num(postHalo.peakRel) === null) {
          // no pale ring before and none after: nothing grew
        } else {
          console.log(`  note ${bar}: halo.${side}.peakRel pre ${JSON.stringify(preHalo.peakRel)} post ${JSON.stringify(postHalo.peakRel)} (no comparable pair)`)
        }
        if (!(postHalo.run <= preHalo.run + LINE_HALO_RUN_GROWTH)) {
          fail(`${bar}: halo.${side}.run ${fixed(postHalo.run, 0)} > pre ${fixed(preHalo.run, 0)} + ${LINE_HALO_RUN_GROWTH}`)
        }
      }
    }
  }

  // The determinism pair.
  const pair = []
  for (const suffix of DETERMINISM_SUFFIXES) {
    const capture = readCapture(postDir, 'post', suffix)
    if (capture === null) {
      fail(`missing determinism capture: rtc-post-${suffix}.json (required in --assert mode)`)
      continue
    }
    pair.push({ suffix, report: capture.report })
  }
  if (pair.length === 2) {
    for (const field of DETERMINISM_FIELDS) {
      const a = pair[0].report[field]
      const b = pair[1].report[field]
      if (a !== b) fail(`determinism: ${field} differs (${JSON.stringify(a)} vs ${JSON.stringify(b)})`)
    }
    console.log('')
    console.log(`determinism: ${DETERMINISM_FIELDS.map((f) => `${f}=${JSON.stringify(pair[0].report[f])}`).join(' ')}`)
  }
}

// --- verdict ----------------------------------------------------------------

console.log('')
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  for (const message of failures) console.log(`  - ${message}`)
  process.exit(1)
}
console.log(`PASS: ${END_CELLS.length} bristle-end + ${LINE_CELLS.length} pale-line pre cells${assertMode ? ' and every declared post bar' : ''}`)
