#!/usr/bin/env node
// ============================================================
// end-density.mjs — quick 261125-rtc's bar, as code.
//
// The declared acceptance for the bristle brush's end-cap density block:
// the stroked end must read at the BODY's density on three surfaces — the
// carried pigment (RAW-P), the coverage inked share (RAW-C) and the visible
// composite over white (VIS) — without moving the body, the start, the
// stroke silhouettes or the pale-line baselines. Every constant below was
// DECLARED BEFORE the first post-fix capture was taken; none may be tuned
// after seeing post values. If a law cannot pass a constant, the law is
// revised, never the constant.
//
// TASK 2 RE-DECLARATION (FROZEN 2026-11-25): the first measurement diagnosed
// its own window as wrong — the old end window started 26.7-48.8 document px
// AHEAD of the last recorded dab, sampling the leading frontier of the
// terminal dabs where a trailing-side law is inert. The bar below reads the
// probe's CENSUS-ANCHORED window instead:
//
//   WINDOW    lastTap = endCensus.last40.at(-1).x * dw (a document-width
//             fraction); r = strokeSize / 2 document px; end window
//             [lastTap - 2.4r, lastTap + 1.05r] clamped to [0, dw - 1];
//             body zone unchanged at [0.40, 0.55] dw.
//   RAW-P     pigment zone MEAN, (255 - mean RGB) / 255.
//   RAW-C     INKED SHARE, the fraction of zone cells with coverage
//             alpha / 255 >= 0.5.
//   VIS       visible-composite MEAN, the `endFine.vis` reader
//             (1 - min(r*a + 255*(1-a), ...) / 255) on the transparent raster.
//             The raw transparent mean stays a report-only diagnostic column.
//   TOLERANCES post-fix, on the 32 matrix and release cells:
//             |RAW-P end - body| <= 0.02, |RAW-C| <= 0.03, |VIS| <= 0.02.
//   LIFT      OBSERVATION cell: its pigment gap may grow by at most 0.01 vs
//             its pre twin; the VIS gap is printed beside it and NEVER
//             asserted — no admissible stamp-time trigger reaches the live
//             lift's pre-release dabs, so the press-move-release UAT rows are
//             that path's judge.
//   SIGN RULE per cell, sign = sign(end - body) per series. A series is
//             OPPOSITE when at least one cell reads end > body + 0.001 and at
//             least one reads end < body - 0.001; otherwise UNIFORM (zero
//             cells are neutral). The overall verdict is UNIFORM only when
//             all three series are UNIFORM; it admits the relative law.
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
// Without --assert the tool is report-only over the PRE set: it prints the
// per-cell table and the per-series SIGN VERDICT, and exits 1 only on capture
// integrity (missing cell, brush echo not 'bristle-round', null or zero
// census, crossed drive, zero gather) -- NEVER on a pre gap or on the sign
// verdict. The pre run measures the defect.
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
//   endSetup, endMetrics { density { window { lastTapX, radiusPx, lo, hi, widthPx },
//   zones { transparent|pigment|coverage|visible { body|end { mean, inked } } },
//   effectiveSampleScale }, end { flatPct, longestFlatRunPx, ... }, start { ... },
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

/** RAW-P: the carried-pigment zone-mean gap, |end − body|, on the 32 matrix
 *  and release cells, post-fix. */
const PIGMENT_GAP_MAX = 0.02
/** RAW-C: the inked-fraction gap (coverage alpha ≥ 0.5), |end − body|. */
const COVERAGE_GAP_MAX = 0.03
/** VIS: the visible-composite mean gap, |end − body| — the composite over
 *  white the eye reads. */
const VISIBLE_GAP_MAX = 0.02
/** The sign rule's neutral band: a cell within ±this of parity reads 0. */
const SIGN_EPSILON = 0.001
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

/** The sign rule's per-cell reading: '+' / '-' / '0' with the neutral band. */
const signOf = (delta) => {
  const n = num(delta)
  if (n === null) return '?'
  if (n > SIGN_EPSILON) return '+'
  if (n < -SIGN_EPSILON) return '-'
  return '0'
}

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

/** The four surfaces' body/end readings of one end capture, or null when the
 *  report predates the census-anchored bar (a named failure, never a silent
 *  skip). */
const endReadings = (label, report) => {
  const density = report?.endMetrics?.density
  const zones = density?.zones
  const win = density?.window
  const d = report?.endMetrics
  if (zones === undefined || win === undefined || d === undefined) {
    fail(`${label}: no endMetrics.density window/zones (capture predates the census-anchored bar?)`)
    return null
  }
  for (const key of ['lastTapX', 'radiusPx', 'lo', 'hi', 'widthPx']) {
    if (num(win[key]) === null) {
      fail(`${label}: density.window.${key} is ${JSON.stringify(win[key])} (expected a finite number)`)
      return null
    }
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
  const visibleBody = read('visible', 'body')
  const visibleEnd = read('visible', 'end')
  if (
    !pigmentBody || !pigmentEnd || !coverageBody || !coverageEnd ||
    !transparentBody || !transparentEnd || !visibleBody || !visibleEnd
  ) {
    return null
  }
  return {
    scale: density.effectiveSampleScale,
    lastTapX: win.lastTapX,
    radiusPx: win.radiusPx,
    winLo: win.lo,
    winHi: win.hi,
    winWidth: win.widthPx,
    pigmentBody: pigmentBody.mean,
    pigmentEnd: pigmentEnd.mean,
    pigmentDelta: pigmentEnd.mean - pigmentBody.mean,
    coverageBody: coverageBody.inked,
    coverageEnd: coverageEnd.inked,
    coverageGap: coverageEnd.inked - coverageBody.inked,
    visibleBody: visibleBody.mean,
    visibleEnd: visibleEnd.mean,
    visibleDelta: visibleEnd.mean - visibleBody.mean,
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

/** The declared SIGN VERDICT over one phase's 32 matrix+release cells. A
 *  series is OPPOSITE when it has both a > +SIGN_EPSILON cell and a
 *  < -SIGN_EPSILON cell; zero cells are neutral. Overall UNIFORM only when
 *  all three series are UNIFORM. */
const signVerdict = (rows) => {
  const series = [
    { key: 'pigmentDelta', name: 'RAW-P' },
    { key: 'coverageGap', name: 'RAW-C' },
    { key: 'visibleDelta', name: 'VIS' },
  ].map(({ key, name }) => {
    let positive = 0
    let negative = 0
    let zero = 0
    let maxPositive = null
    let maxNegative = null
    for (const row of rows) {
      const delta = row.readings[key]
      if (num(delta) === null) continue
      if (delta > SIGN_EPSILON) {
        positive += 1
        if (maxPositive === null || delta > maxPositive.delta) maxPositive = { suffix: row.suffix, delta }
      } else if (delta < -SIGN_EPSILON) {
        negative += 1
        if (maxNegative === null || delta < maxNegative.delta) maxNegative = { suffix: row.suffix, delta }
      } else {
        zero += 1
      }
    }
    return { name, positive, negative, zero, opposite: positive > 0 && negative > 0, maxPositive, maxNegative }
  })
  return { series, uniform: series.every((entry) => !entry.opposite) }
}

const printSignVerdict = (title, rows) => {
  const verdict = signVerdict(rows)
  console.log('')
  console.log(`${title} (${rows.length} matrix+release cells; a series is OPPOSITE only when it holds both a > +${SIGN_EPSILON} cell and a < -${SIGN_EPSILON} cell):`)
  for (const entry of verdict.series) {
    const extremes = [
      entry.maxPositive === null ? null : `max +${fixed(entry.maxPositive.delta)} at ${entry.maxPositive.suffix}`,
      entry.maxNegative === null ? null : `min ${fixed(entry.maxNegative.delta)} at ${entry.maxNegative.suffix}`,
    ].filter((part) => part !== null)
    console.log(
      `  ${pad(entry.name, 6)}+${entry.positive} / -${entry.negative} / 0:${entry.zero} -> ${entry.opposite ? 'OPPOSITE' : 'UNIFORM'}` +
        (extremes.length > 0 ? `  (${extremes.join('; ')})` : ''),
    )
  }
  console.log(`  OVERALL: ${verdict.uniform ? 'UNIFORM' : 'OPPOSITE'}`)
  return verdict
}

const printEndRow = (label, drive, readings, report) => {
  const census = report.endCensus
  console.log(
    pad(label, 24) +
      pad(drive, 6) +
      pad(fixed(readings.scale, 2), 6) +
      pad(fixed(readings.lastTapX, 1), 9) +
      pad(fixed(readings.radiusPx, 1), 7) +
      pad(fixed(readings.winLo, 0), 7) +
      pad(fixed(readings.winHi, 0), 7) +
      pad(fixed(readings.pigmentBody), 8) +
      pad(fixed(readings.pigmentEnd), 8) +
      pad(signed(readings.pigmentDelta), 9) +
      pad(signOf(readings.pigmentDelta), 2) +
      pad(fixed(readings.coverageBody), 8) +
      pad(fixed(readings.coverageEnd), 8) +
      pad(signed(readings.coverageGap), 8) +
      pad(signOf(readings.coverageGap), 2) +
      pad(fixed(readings.visibleBody), 8) +
      pad(fixed(readings.visibleEnd), 8) +
      pad(signed(readings.visibleDelta), 9) +
      pad(signOf(readings.visibleDelta), 2) +
      pad(fixed(readings.transparentBody), 8) +
      pad(fixed(readings.transparentEnd), 8) +
      pad(fixed(readings.endFlatPct, 2), 8) +
      pad(fixed(readings.endLongestRun, 0), 8) +
      pad(JSON.stringify(report.gather?.calls ?? 'n/a'), 7) +
      pad(JSON.stringify(report.gather?.endCapCalls ?? 'n/a'), 8) +
      pad(JSON.stringify(census?.taps ?? 'n/a'), 6) +
      JSON.stringify(census?.endCaps ?? 'n/a'),
  )
}

const printEndHeader = () => {
  console.log(
    pad('suffix', 24) +
      pad('drive', 6) +
      pad('scale', 6) +
      pad('lastTap', 9) +
      pad('radius', 7) +
      pad('winLo', 7) +
      pad('winHi', 7) +
      pad('pigBody', 8) +
      pad('pigEnd', 8) +
      pad('pigDelta', 9) +
      pad('s', 2) +
      pad('inkBody', 8) +
      pad('inkEnd', 8) +
      pad('inkGap', 8) +
      pad('s', 2) +
      pad('visBody', 8) +
      pad('visEnd', 8) +
      pad('visDelta', 9) +
      pad('s', 2) +
      pad('trBody', 8) +
      pad('trEnd', 8) +
      pad('endFlat', 8) +
      pad('longRun', 8) +
      pad('gather', 7) +
      pad('gEndCap', 8) +
      pad('taps', 6) +
      'cEndCaps',
  )
}

/** The capture-integrity checks every bristle-end cell owes, pre or post: the
 *  brush echo, a populated census with its own drive name, and a non-zero
 *  gather. Returns true when the cell's report can be read. */
const requireEndIntegrity = (label, report, expectedDrive) => {
  requireBrush(label, report)
  let ok = true
  const census = report.endCensus
  if (census === null || census === undefined) {
    fail(`${label}: endCensus is null (the shared census did not span this lane)`)
    ok = false
  } else {
    if (!(num(census.taps) > 0)) {
      fail(`${label}: endCensus.taps is ${JSON.stringify(census.taps)} (expected > 0)`)
      ok = false
    }
    if (census.drive !== expectedDrive) {
      fail(`${label}: endCensus.drive is ${JSON.stringify(census.drive)}, expected '${expectedDrive}'`)
      ok = false
    }
  }
  if (!(num(report.gather?.calls) > 0)) {
    fail(`${label}: gather.calls is ${JSON.stringify(report.gather?.calls)} (expected > 0)`)
    ok = false
  }
  return ok
}

// --- the pre report ---------------------------------------------------------

console.log('=== quick 261125-rtc end-density bar ===')
console.log(`pre dir  : ${preDir}`)
console.log(`post dir : ${postDir}${assertMode ? '  (--assert)' : '  (report only)'}`)
console.log('')

const preEnd = new Map()
const preSignRows = []
console.log('--- bristle-end cells (33) ----------------------------------------------------------------')
printEndHeader()
for (const cell of END_CELLS) {
  const capture = readCapture(preDir, 'pre', cell.suffix)
  if (capture === null) {
    fail(`missing pre capture: rtc-pre-${cell.suffix}.json`)
    continue
  }
  const { report, path } = capture
  preEnd.set(cell.suffix, report)
  requireEndIntegrity(`pre ${cell.suffix}`, report, cell.drive)
  const readings = endReadings(`pre ${cell.suffix}`, report)
  if (readings === null) continue
  printEndRow(cell.suffix, cell.drive, readings, report)
  if (cell.drive !== 'lift') preSignRows.push({ suffix: cell.suffix, readings })
  if (!path.endsWith(`rtc-pre-${cell.suffix}.json`)) fail(`pre ${cell.suffix}: unexpected path ${path}`)
}

// The declared verdict over the re-measured pre set. Report-only: the pre run
// measures the defect, it never fails on the sign.
const preVerdict = printSignVerdict('SIGN VERDICT (pre)', preSignRows)

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
  const postSignRows = []
  console.log('--- bristle-end post cells (33) ----------------------------------------------------------')
  printEndHeader()
  for (const cell of END_CELLS) {
    const label = `post ${cell.suffix}`
    const capture = readCapture(postDir, 'post', cell.suffix)
    if (capture === null) {
      fail(`missing post capture: rtc-post-${cell.suffix}.json`)
      continue
    }
    const { report } = capture
    postEnd.set(cell.suffix, report)
    requireEndIntegrity(label, report, cell.drive)
    const readings = endReadings(label, report)
    if (readings === null) continue
    postReadings.set(cell.suffix, readings)
    printEndRow(cell.suffix, cell.drive, readings, report)
    if (cell.drive !== 'lift') postSignRows.push({ suffix: cell.suffix, readings })

    // The density bar: the three declared surfaces.
    if (cell.drive !== 'lift') {
      if (!(Math.abs(readings.pigmentDelta) <= PIGMENT_GAP_MAX)) {
        fail(
          `${label}: |RAW-P end - body| = ${fixed(Math.abs(readings.pigmentDelta))} > PIGMENT_GAP_MAX ${PIGMENT_GAP_MAX}`,
        )
      }
      if (!(Math.abs(readings.coverageGap) <= COVERAGE_GAP_MAX)) {
        fail(
          `${label}: |RAW-C inked end - body| = ${fixed(Math.abs(readings.coverageGap))} > COVERAGE_GAP_MAX ${COVERAGE_GAP_MAX}`,
        )
      }
      if (!(Math.abs(readings.visibleDelta) <= VISIBLE_GAP_MAX)) {
        fail(
          `${label}: |VIS end - body| = ${fixed(Math.abs(readings.visibleDelta))} > VISIBLE_GAP_MAX ${VISIBLE_GAP_MAX}`,
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
    // START_DRIFT: the transparent landing-ramp zone mean.
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
        `lift observation: pre RAW-P gap ${fixed(preGap)} -> post ${fixed(postGap)}; ` +
          `pre VIS gap ${fixed(Math.abs(preReadings.visibleDelta))} -> post ${fixed(Math.abs(readings.visibleDelta))} ` +
          `(${verdict}; never asserted to PIGMENT_GAP_MAX)`,
      )
      if (verdict === 'DRIFT') {
        fail(`${label}: lift pigment gap grew ${fixed(postGap - preGap)} > LIFT_OBSERVE_DRIFT_MAX ${LIFT_OBSERVE_DRIFT_MAX}`)
      }
    }
  }

  printSignVerdict('SIGN VERDICT (post)', postSignRows)

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
console.log(
  `PASS: ${END_CELLS.length} bristle-end + ${LINE_CELLS.length} pale-line pre cells` +
    `${assertMode ? ' and every declared post bar' : ''}` +
    ` (pre sign verdict: ${preVerdict.uniform ? 'UNIFORM' : 'OPPOSITE'})`,
)
