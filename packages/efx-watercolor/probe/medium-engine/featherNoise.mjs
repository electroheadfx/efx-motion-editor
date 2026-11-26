#!/usr/bin/env node
// ============================================================
// featherNoise.mjs — quick 261126-v8j's bar, as code (Spec 11).
//
// The declared acceptance for the brush-relative feather grain: the feather
// band must derive a feature period from the band itself (floored at 2 px),
// the grain must enter the rim at noise 100 and be absent at noise 0, the
// Feather falloff must distribute the grain from the core (f0) to the rim
// (f100) while leaving the silhouette exactly where the falloff-50 shape puts
// it, and the opening must follow the one exponent map in strict order. Six
// bars, all declared BEFORE the first post capture was taken; if a law cannot
// pass a bar, the law is revised, never the bar.
//
//   (1) periodPx == clamp(bandPx / 4, 2, 16) on EVERY cell, and
//       periodPx == 2 (FEATHER_NOISE_MIN_PX) at Size 4 — the floor proof.
//   (2) at noise 100, falloff 50: featureCount reads 2..4 at Sizes 40 / 200
//       and at least 1 at Sizes 4 / 12 (the accepted below-floor limit: a
//       single ragged notch on tiny brushes, never a smooth line).
//   (3) rimCrossings(noise 100) > rimCrossings(noise 0) at every size
//       (falloff 50, the shipped default) — the rim really holds grain.
//   (4) at noise 100: core RMS strictly ordered f0 > f50 > f100, rim RMS the
//       reverse (f0 < f50 < f100); the core/rim ratio exceeds 0.5 at f0 (the
//       grain reaches the core) and stays under 0.2 at f100 (rim-only).
//   (5) the noise-0 opening (half-peak crossing) is strictly ordered
//       f0 < f50 < f100 — the falloff shapes the opening even at noise 0.
//   (6) |outerExtentPx(f) - outerExtentPx(f50)| <= 1 px at every size and
//       noise — the silhouette never moves with the falloff.
//
// The constants below mirror the declared twins in
// src/playground/bristles.ts (FEATHER_NOISE_FEATURES / _MIN_PX / _MAX_PX /
// _REFERENCE_PX). This tool reads captures off disk; it never loads the TS
// source. A drift in the twins must therefore trip bar 1 on the captures.
//
// usage:
//   node featherNoise.mjs --sweep fn-post [--sizes 4,12,40,200]
//
//   --sweep <prefix>  the capture family to read (required)
//   --sizes <csv>     which stroke sizes to read (default 4,12,40,200)
//
// ONE naming law for every cell it consumes:
//   /tmp/medium-engine/<prefix>-s{size}-f{falloff}-n{noise}.json
// with falloff in {0,50,100} and noise in {0,100}. A missing cell is a named
// FAIL, never a silent skip — the sweep never borrows cells from another
// family.
//
// Per-cell integrity (a report-level FAIL, distinct from the six bars): the
// scenario / brush echo, the featherNoise block, a non-empty core and rim
// band, `halfWidthOk` (the engine footprint law within 10 % of the measured
// ink half-width) and `effectiveFeather == 100` (every sweep cell asks for
// Feather 100; a report reading 85 means the operand never reached the bag).
//
// Exit 0 only when every bar and every integrity check passes. This tool
// never writes a capture; it is a reader of /tmp/medium-engine.
// ============================================================

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// --- the declared bar -------------------------------------------------------

/** Mirrors bristles.ts FEATHER_NOISE_FEATURES: features across the band. */
const FN_FEATURES = 4
/** Mirrors bristles.ts FEATHER_NOISE_MIN_PX: the tiny-brush pixel floor. */
const FN_MIN_PX = 2
/** Mirrors bristles.ts FEATHER_NOISE_MAX_PX: the period ceiling. */
const FN_MAX_PX = 16
/** Mirrors bristles.ts FEATHER_NOISE_REFERENCE_PX: the tooth reference. */
const FN_REFERENCE_PX = 1.1
/** Tolerance for re-deriving the rounded period / rimScale from the rounded
 *  bandPx a capture carries (bandPx is printed at 2 dp, periodPx at 4 dp). */
const DERIVE_EPSILON = 1e-3
/** Bar 6: the silhouette may not move with the falloff, in document px. */
const OUTER_EXTENT_DRIFT_MAX_PX = 1
/** Bar 4: the core/rim delta ratio bounds. */
const CORE_RIM_RATIO_MIN_AT_F0 = 0.5
const CORE_RIM_RATIO_MAX_AT_F100 = 0.2
/** Every sweep cell asks for Feather 100 (the plan's operand law). */
const SWEEP_FEATHER = 100
/** Bar 2: the band must hold this many features at mid/large sizes. */
const FEATURES_MID = { min: 2, max: 4 }
/** Bar 2: and at least this many at tiny sizes (the below-floor limit). */
const FEATURES_SMALL_MIN = 1

/** The capture root. Fixed: the naming law below is the whole contract. */
const CAPTURE_DIR = '/tmp/medium-engine'
const FALLOFFS = [0, 50, 100]
const NOISES = [0, 100]
/** Sizes at or above this read the band's whole feature count (bar 2). */
const MID_SIZE = 40

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

const prefix = readFlag('--sweep', null)
if (prefix === null) {
  console.error('--sweep <prefix> is required (e.g. --sweep fn-post)')
  process.exit(2)
}
const sizes = readFlag('--sizes', '4,12,40,200')
  .split(',')
  .map((part) => part.trim())
  .filter((part) => part.length > 0)
  .map((part) => {
    const value = Number(part)
    if (!Number.isInteger(value) || value <= 0) {
      console.error(`invalid --sizes entry ${JSON.stringify(part)} (expected positive integers)`)
      process.exit(2)
    }
    return value
  })
if (sizes.length === 0) {
  console.error('--sizes is empty')
  process.exit(2)
}

const failures = []
const fail = (message) => failures.push(message)

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const fixed = (value, digits = 4) => (num(value) === null ? 'n/a' : num(value).toFixed(digits))
const signed = (value, digits = 4) => {
  const n = num(value)
  return n === null ? 'n/a' : (n >= 0 ? '+' : '') + n.toFixed(digits)
}
const pad = (value, width) => String(value).padEnd(width)
const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi)

const cellName = (size, falloff, noise) => `${prefix}-s${size}-f${falloff}-n${noise}`
const cellPath = (size, falloff, noise) => join(CAPTURE_DIR, `${cellName(size, falloff, noise)}.json`)

/** Read one cell; a missing or unparsable capture is a named FAIL. */
const readCell = (size, falloff, noise) => {
  const name = cellName(size, falloff, noise)
  const path = cellPath(size, falloff, noise)
  if (!existsSync(path)) {
    fail(`missing capture: ${path} (cell ${name})`)
    return null
  }
  let report
  try {
    report = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`)
    return null
  }
  // The scenario / brush echo: a capture that photographed another scene can
  // never stand in for the cell it claims.
  if (report.scenario !== 'feather-noise') {
    fail(`${name}: scenario echo is ${JSON.stringify(report.scenario)}, expected 'feather-noise'`)
  }
  if (report.brush !== 'bristle-round') {
    fail(`${name}: brush echo is ${JSON.stringify(report.brush)}, expected 'bristle-round'`)
  }
  const fn = report.featherNoise
  if (fn === undefined || fn === null) {
    fail(`${name}: no featherNoise block (the capture predates the scene's readout?)`)
    return null
  }
  const required = [
    'radiusPx',
    'bandPx',
    'periodPx',
    'rimScale',
    'featureCount',
    'rimCrossings',
    'openingHalfOffsetPx',
    'outerExtentPx',
    'measuredHalfWidthPx',
    'effectiveFeather',
  ]
  let ok = true
  for (const key of required) {
    if (num(fn[key]) === null) {
      fail(`${name}: featherNoise.${key} is ${JSON.stringify(fn[key])} (expected a finite number)`)
      ok = false
    }
  }
  for (const band of ['core', 'mid', 'rim']) {
    if (num(fn.variationByBand?.[band]) === null) {
      fail(`${name}: featherNoise.variationByBand.${band} is missing or not finite`)
      ok = false
    }
  }
  const samples = fn.variationByBand?.samples ?? {}
  for (const band of ['core', 'rim']) {
    if (!(num(samples[band]) > 0)) {
      fail(`${name}: variationByBand.samples.${band} is ${JSON.stringify(samples[band])} (an empty band cannot be measured)`)
      ok = false
    }
  }
  if (fn.halfWidthOk !== true) {
    fail(
      `${name}: halfWidthOk is ${JSON.stringify(fn.halfWidthOk)} — measuredHalfWidthPx ${JSON.stringify(fn.measuredHalfWidthPx)} vs radiusPx ${JSON.stringify(fn.radiusPx)} (delta ${JSON.stringify(fn.halfWidthDeltaPct)} %, tolerance 10 %)`,
    )
  }
  if (fn.effectiveFeather !== SWEEP_FEATHER) {
    fail(
      `${name}: effectiveFeather is ${JSON.stringify(fn.effectiveFeather)}, expected ${SWEEP_FEATHER} (the --feather operand never reached the rendered bag?)`,
    )
  }
  return ok ? { name, size, falloff, noise, fn } : null
}

// --- read every cell --------------------------------------------------------

console.log('=== quick 261126-v8j feather-noise bar (Spec 11) ===')
console.log(`prefix   : ${prefix}`)
console.log(`captures : ${CAPTURE_DIR}/${prefix}-s{size}-f{falloff}-n{noise}.json`)
console.log(`sizes    : ${sizes.join(', ')}  (falloffs ${FALLOFFS.join('/')}, noises ${NOISES.join('/')})`)
console.log('')
console.log(
  pad('cell', 22) +
    pad('radius', 8) +
    pad('band', 8) +
    pad('period', 8) +
    pad('rimScale', 9) +
    pad('feats', 6) +
    pad('core', 8) +
    pad('mid', 8) +
    pad('rim', 8) +
    pad('rimX', 8) +
    pad('open', 8) +
    pad('outer', 8) +
    'halfW%',
)

/** Keyed `s{size}-f{falloff}-n{noise}`; null when the cell could not be read. */
const cells = new Map()
for (const size of sizes) {
  for (const falloff of FALLOFFS) {
    for (const noise of NOISES) {
      const cell = readCell(size, falloff, noise)
      if (cell === null) continue
      cells.set(`s${size}-f${falloff}-n${noise}`, cell)
      console.log(
        pad(cell.name, 22) +
          pad(fixed(cell.fn.radiusPx, 2), 8) +
          pad(fixed(cell.fn.bandPx, 2), 8) +
          pad(fixed(cell.fn.periodPx, 4), 8) +
          pad(fixed(cell.fn.rimScale, 4), 9) +
          pad(cell.fn.featureCount, 6) +
          pad(fixed(cell.fn.variationByBand.core), 8) +
          pad(fixed(cell.fn.variationByBand.mid), 8) +
          pad(fixed(cell.fn.variationByBand.rim), 8) +
          pad(fixed(cell.fn.rimCrossings), 8) +
          pad(fixed(cell.fn.openingHalfOffsetPx, 2), 8) +
          pad(fixed(cell.fn.outerExtentPx, 2), 8) +
          fixed(cell.fn.halfWidthDeltaPct, 2),
      )
    }
  }
}

/** The cell or a named FAIL (only when the reader already failed it; a
 *  caller that needs a null-safe read uses `cells.get(...)` directly). */
const cellOf = (size, falloff, noise) => cells.get(`s${size}-f${falloff}-n${noise}`) ?? null

// --- bar 1: the derived period (the floor proof) ---------------------------

let bar1Checks = 0
for (const cell of cells.values()) {
  bar1Checks += 1
  const fn = cell.fn
  const derived = clamp(fn.bandPx / FN_FEATURES, FN_MIN_PX, FN_MAX_PX)
  if (!(Math.abs(fn.periodPx - derived) <= DERIVE_EPSILON)) {
    fail(
      `${cell.name}: periodPx ${fixed(fn.periodPx)} != clamp(bandPx/${FN_FEATURES}, ${FN_MIN_PX}, ${FN_MAX_PX}) = ${fixed(derived)} (bandPx ${fixed(fn.bandPx, 2)})`,
    )
  }
  const derivedScale = FN_REFERENCE_PX / fn.periodPx
  if (!(Math.abs(fn.rimScale - derivedScale) <= DERIVE_EPSILON)) {
    fail(
      `${cell.name}: rimScale ${fixed(fn.rimScale)} != ${FN_REFERENCE_PX} / periodPx = ${fixed(derivedScale)}`,
    )
  }
  if (cell.size === 4 && !(fn.periodPx === FN_MIN_PX)) {
    fail(`${cell.name}: Size 4 sits on the floor — periodPx ${fixed(fn.periodPx)} != FEATHER_NOISE_MIN_PX ${FN_MIN_PX}`)
  }
}

// --- bar 2: the band holds its feature count -------------------------------

let bar2Checks = 0
for (const size of sizes) {
  const cell = cellOf(size, 50, 100)
  if (cell === null) continue
  bar2Checks += 1
  const { min, max } = size >= MID_SIZE ? FEATURES_MID : { min: FEATURES_SMALL_MIN, max: Infinity }
  const count = cell.fn.featureCount
  if (!(count >= min && count <= max)) {
    fail(
      `${cell.name}: featureCount ${count} outside ${size >= MID_SIZE ? `${min}..${max}` : `>= ${min}`} (band ${fixed(cell.fn.bandPx, 2)} px, period ${fixed(cell.fn.periodPx, 4)} px)`,
    )
  }
}

// --- bar 3: the rim really holds grain -------------------------------------

let bar3Checks = 0
for (const size of sizes) {
  const withGrain = cellOf(size, 50, 100)
  const without = cellOf(size, 50, 0)
  if (withGrain === null || without === null) continue
  bar3Checks += 1
  if (!(withGrain.fn.rimCrossings > without.fn.rimCrossings)) {
    fail(
      `s${size}: rimCrossings(noise 100) ${fixed(withGrain.fn.rimCrossings)} <= rimCrossings(noise 0) ${fixed(without.fn.rimCrossings)} (the rim reads no grain beyond the paper's own)`,
    )
  }
}

// --- bar 4: the falloff distributes the grain ------------------------------

let bar4Checks = 0
for (const size of sizes) {
  const f0 = cellOf(size, 0, 100)
  const f50 = cellOf(size, 50, 100)
  const f100 = cellOf(size, 100, 100)
  if (f0 === null || f50 === null || f100 === null) continue
  bar4Checks += 1
  const core0 = f0.fn.variationByBand.core
  const core50 = f50.fn.variationByBand.core
  const core100 = f100.fn.variationByBand.core
  if (!(core0 > core50 && core50 > core100)) {
    fail(
      `s${size}: core RMS not strictly ordered f0 > f50 > f100 (${fixed(core0)} / ${fixed(core50)} / ${fixed(core100)})`,
    )
  }
  const rim0 = f0.fn.variationByBand.rim
  const rim50 = f50.fn.variationByBand.rim
  const rim100 = f100.fn.variationByBand.rim
  if (!(rim0 < rim50 && rim50 < rim100)) {
    fail(
      `s${size}: rim RMS not strictly ordered f0 < f50 < f100 (${fixed(rim0)} / ${fixed(rim50)} / ${fixed(rim100)})`,
    )
  }
  if (!(rim0 > 0)) {
    fail(`s${size}: rim RMS at f0 is ${fixed(rim0)} — no denominator for the core/rim ratio`)
  } else {
    const ratio0 = core0 / rim0
    if (!(ratio0 > CORE_RIM_RATIO_MIN_AT_F0)) {
      fail(
        `s${size}: core/rim ratio at f0 ${fixed(ratio0)} <= ${CORE_RIM_RATIO_MIN_AT_F0} (the grain never reaches the core)`,
      )
    }
  }
  if (!(rim100 > 0)) {
    fail(`s${size}: rim RMS at f100 is ${fixed(rim100)} — no denominator for the core/rim ratio`)
  } else {
    const ratio100 = core100 / rim100
    if (!(ratio100 < CORE_RIM_RATIO_MAX_AT_F100)) {
      fail(
        `s${size}: core/rim ratio at f100 ${fixed(ratio100)} >= ${CORE_RIM_RATIO_MAX_AT_F100} (the grain is not rim concentrated)`,
      )
    }
  }
}

// --- bar 5: the opening follows the one exponent map -----------------------

let bar5Checks = 0
for (const size of sizes) {
  const f0 = cellOf(size, 0, 0)
  const f50 = cellOf(size, 50, 0)
  const f100 = cellOf(size, 100, 0)
  if (f0 === null || f50 === null || f100 === null) continue
  bar5Checks += 1
  const o0 = f0.fn.openingHalfOffsetPx
  const o50 = f50.fn.openingHalfOffsetPx
  const o100 = f100.fn.openingHalfOffsetPx
  if (!(o0 < o50 && o50 < o100)) {
    fail(
      `s${size}: opening not strictly ordered f0 < f50 < f100 (${fixed(o0, 2)} / ${fixed(o50, 2)} / ${fixed(o100, 2)} px)`,
    )
  }
  for (const [falloff, cell] of [[0, f0], [100, f100]]) {
    if (cell.fn.openingClamped === true) {
      fail(
        `s${size}: opening at f${falloff} is clamped (${fixed(cell.fn.openingHalfOffsetPx, 2)} px) — the capture ended before the half-peak crossing`,
      )
    }
  }
}

// --- bar 6: the silhouette never moves with the falloff --------------------

let bar6Checks = 0
for (const size of sizes) {
  for (const noise of NOISES) {
    const f50 = cellOf(size, 50, noise)
    if (f50 === null) continue
    for (const falloff of [0, 100]) {
      const cell = cellOf(size, falloff, noise)
      if (cell === null) continue
      bar6Checks += 1
      const drift = cell.fn.outerExtentPx - f50.fn.outerExtentPx
      if (!(Math.abs(drift) <= OUTER_EXTENT_DRIFT_MAX_PX)) {
        fail(
          `s${size}-n${noise}: outerExtentPx(f${falloff}) - outerExtentPx(f50) = ${signed(drift, 2)} px > OUTER_EXTENT_DRIFT_MAX_PX ${OUTER_EXTENT_DRIFT_MAX_PX}`,
        )
      }
    }
  }
}

// --- verdict ----------------------------------------------------------------

console.log('')
console.log(
  `bars: (1) period derivation ${bar1Checks} cells | (2) featureCount ${bar2Checks} sizes | ` +
    `(3) rim crossings ${bar3Checks} sizes | (4) falloff distribution ${bar4Checks} sizes | ` +
    `(5) opening order ${bar5Checks} sizes | (6) silhouette ${bar6Checks} comparisons`,
)
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  for (const message of failures) console.log(`  - ${message}`)
  process.exit(1)
}
console.log(
  `PASS: ${cells.size} cells read, six bars hold` +
    (bar2Checks > 0 ? '' : ' (bar 2 had no size to read — check --sizes)'),
)
