#!/usr/bin/env node
// ============================================================
// featherNoise.mjs — quick 261126-v8j's five-state bar (Spec 11).
//
// The artist's law (2026-11-27, revised after the live UAT): the feather
// noise is a CHIPPED BAND, never a receding front. A solid core recedes
// linearly with the slider while ONE fine chip field punches dry-brush
// flakes through the band outside it, so the mark keeps its footprint and
// its micro texture. The old front gate measured a law that no longer
// exists, so it was retired with it; this bar renders and reads the five
// states the artist drew:
//
//     0   the clean footprint (the neutral program)
//     20  a thin rim of flakes, the solid core at full width
//     40  deeper flakes, the core slightly narrower
//     60  a wide chipped band, a narrower continuous core
//     100 a thin meandering core with flakes across the footprint
//
// Bars (all declared here, never revised to fit a capture):
//   (1) NEUTRAL DIGESTS. The noise-0 cells at Size 120 / Feather 85 and
//       Size 120 / Feather 0 carry EXACTLY the pre-change capture's four
//       export digests (paper / transparent / white / pigment). The engine
//       must render the neutral program byte-for-byte when the drive is 0.
//   (2) KNOB ECHO. Every cell echoes the declared twins: parameters carry
//       the slider and Feather, and the featherNoise block's drive / coreU /
//       chipCut / chipFeaturePx / wobbleFeaturePx match bristles.ts for that
//       size.
//   (3) EROSION ONLY REMOVES. openingHalfOffsetPx, outerExtentPx and
//       measuredHalfWidthPx are NON-INCREASING across 0 -> 20 -> 40 -> 60 ->
//       100. A threshold shift can never add paint, so a growing reading is
//       a law break, not noise.
//   (4) STATES 0 AND 100 ARE THE DRAWN EXTREMES. opening(100) is strictly
//       smaller than opening(0) and still positive (the core survives);
//       at Feather 85, opening(20) stays within 1 px + 2 % of opening(0)
//       (state 20 flakes the rim, it does not shrink the body).
//   (5) THE FOOTPRINT SURVIVES. measuredHalfWidthPx(100) keeps at least
//       FOOTPRINT_SHARE of measuredHalfWidthPx(0): the chips are kept paint
//       across the mark's full width, never a thin smooth noodle.
//
// usage:
//   node featherNoise.mjs --sweep fn-v8j [--sizes 120] [--feathers 85,0]
//        [--noises 0,20,40,60,100] [--sheet 1080]
//        [--baseline-n85 <path>] [--baseline-f0 <path>]
//
//   --sweep <prefix>      the capture family to render/read (required)
//   --sizes <csv>         stroke sizes (default 120; the law's cell)
//   --feathers <csv>      Feather values (default 85,0)
//   --noises <csv>        the five states (default 0,20,40,60,100)
//   --sheet <px>          the sheet edge (default 1080; the pre-change
//                         baselines were captured at 1080)
//   --baseline-n85 <path> the pre-change noise-0 capture at Size 120 /
//                         Feather 85 (default /tmp/medium-engine/
//                         v8j-base-n0-s120.json)
//   --baseline-f0 <path>  the same at Feather 0 (default /tmp/medium-engine/
//                         v8j-base-f0-n0-s120.json)
//
// Every cell is RE-RENDERED through run.mjs with the scenario's own knobs
// (`--scenario feather-noise --noise N --feather F --stroke-size S --size
// sheet`), then read back from /tmp/medium-engine/<prefix>-s{size}-f{feather}
// -n{noise}.json. A missing or malformed capture is a named FAIL.
// ============================================================

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RUN = join(HERE, 'run.mjs')
const CAPTURE_DIR = '/tmp/medium-engine'

// --- the declared bar -------------------------------------------------------

/** Mirrors bristles.ts FEATHER_NOISE_CORE_DEPTH. */
const CORE_DEPTH = 0.82
/** Mirrors bristles.ts FEATHER_NOISE_CORE_WOBBLE. */
const CORE_WOBBLE = 0.05
/** Mirrors bristles.ts FEATHER_NOISE_WOBBLE_SCALE / _MIN_PX / _MAX_PX. */
const WOBBLE_SCALE = 0.35
const WOBBLE_MIN_PX = 8
const WOBBLE_MAX_PX = 48
/** Mirrors bristles.ts FEATHER_NOISE_CHIP_SCALE / _MIN_PX / _MAX_PX. */
const CHIP_SCALE = 0.05
const CHIP_MIN_PX = 2.5
const CHIP_MAX_PX = 6
/** Mirrors bristles.ts FEATHER_NOISE_CHIP_CUT_START / _END. */
const CHIP_CUT_START = 0.62
const CHIP_CUT_END = 0.47
/** Mirrors bristles.ts FEATHER_NOISE_CHIP_TOOTH. */
const CHIP_TOOTH = 0.15
/** The five declared states. */
const STATES = [0, 20, 40, 60, 100]
/** Bar 1: the neutral identity cells (Size 120 at the two Feather cells). */
const IDENTITY_SIZE = 120
/** Bar 3/4 tolerance: the rounded readings are printed at 2 dp. */
const READ_EPSILON = 0.011
/** Bar 4: state 20's body tolerance at Feather 85 (1 px + 2 %). */
const STATE20_REL = 0.02
const STATE20_ABS_PX = 1
/** Bar 4: the core must retain this share of the state-0 opening. */
const SPINE_MIN_SHARE = 0.03
/** Bar 5: state 100 keeps this share of state 0's measured half-width. */
const FOOTPRINT_SHARE = 0.6
/** Bar 2 tolerances for the echoed twins. */
const DRIVE_EPS = 5e-4
const FEATURE_EPS = 0.011
const THRESHOLD_EPS = 5e-4

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
const parseCsv = (raw, name) =>
  raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const value = Number(part)
      if (!Number.isFinite(value) || value < 0) {
        console.error(`invalid ${name} entry ${JSON.stringify(part)}`)
        process.exit(2)
      }
      return value
    })

const prefix = readFlag('--sweep', null)
if (prefix === null) {
  console.error('--sweep <prefix> is required (e.g. --sweep fn-v8j)')
  process.exit(2)
}
const sizes = parseCsv(readFlag('--sizes', '120'), '--sizes')
const feathers = parseCsv(readFlag('--feathers', '85,0'), '--feathers')
const noises = parseCsv(readFlag('--noises', STATES.join(',')), '--noises')
const sheet = Number(readFlag('--sheet', '1080'))
if (!Number.isInteger(sheet) || sheet < 32 || sheet > 4096) {
  console.error(`invalid --sheet ${JSON.stringify(readFlag('--sheet', '1080'))}`)
  process.exit(2)
}
const baselineN85 = readFlag('--baseline-n85', join(CAPTURE_DIR, 'v8j-base-n0-s120.json'))
const baselineF0 = readFlag('--baseline-f0', join(CAPTURE_DIR, 'v8j-base-f0-n0-s120.json'))

const failures = []
const fail = (message) => failures.push(message)
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const fixed = (value, digits = 2) =>
  num(value) === null ? 'n/a' : num(value).toFixed(digits)
const pad = (value, width) => String(value).padEnd(width)
const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi)
const EPS = 1e-9

const cellName = (size, feather, noise) => `${prefix}-s${size}-f${feather}-n${noise}`
const cellPath = (size, feather, noise) => join(CAPTURE_DIR, `${cellName(size, feather, noise)}.json`)

/** Render one cell through the probe harness and read its report back. */
const renderCell = (size, feather, noise) => {
  const gate = cellName(size, feather, noise)
  const run = spawnSync(
    process.execPath,
    [
      RUN,
      '--gate', gate,
      '--scenario', 'feather-noise',
      '--noise', String(noise),
      '--feather', String(feather),
      '--stroke-size', String(size),
      '--size', String(sheet),
    ],
    { encoding: 'utf8' },
  )
  if (run.status !== 0) {
    fail(`${gate}: run.mjs exited ${run.status}${run.stderr ? ` (${run.stderr.trim().split('\n').at(-1)})` : ''}`)
    return null
  }
  const path = cellPath(size, feather, noise)
  if (!existsSync(path)) {
    fail(`${gate}: run.mjs wrote no capture at ${path}`)
    return null
  }
  let report
  try {
    report = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${gate}: ${path} is not valid JSON: ${error.message}`)
    return null
  }
  if (report.scenario !== 'feather-noise') {
    fail(`${gate}: scenario echo ${JSON.stringify(report.scenario)} != 'feather-noise'`)
  }
  if (report.brush !== 'bristle-round') {
    fail(`${gate}: brush echo ${JSON.stringify(report.brush)} != 'bristle-round'`)
  }
  const fn = report.featherNoise
  if (fn === undefined || fn === null) {
    fail(`${gate}: no featherNoise block (the capture predates the scene's readout?)`)
    return null
  }
  const echo = report.paramsEcho ?? {}
  if (num(echo.featherNoise) !== noise) {
    fail(`${gate}: paramsEcho.featherNoise ${JSON.stringify(echo.featherNoise)} != ${noise}`)
  }
  if (num(echo.feather) !== feather) {
    fail(`${gate}: paramsEcho.feather ${JSON.stringify(echo.feather)} != ${feather}`)
  }
  if (num(echo.featherFalloff) !== 50) {
    fail(`${gate}: paramsEcho.featherFalloff ${JSON.stringify(echo.featherFalloff)} != 50`)
  }
  const expected = expectedKnobs(fn.halfWidthPx, noise)
  for (const [key, want, epsilon] of [
    ['drive', expected.drive, DRIVE_EPS],
    ['coreU', expected.coreU, DRIVE_EPS * CORE_DEPTH + 5e-4],
    ['chipCut', expected.chipCut, THRESHOLD_EPS],
    ['chipFeaturePx', expected.chipFeaturePx, FEATURE_EPS],
    ['wobbleFeaturePx', expected.wobbleFeaturePx, FEATURE_EPS],
    ['chipTooth', CHIP_TOOTH, THRESHOLD_EPS],
    ['wobbleU', CORE_WOBBLE, THRESHOLD_EPS],
  ]) {
    if (num(fn[key]) === null || Math.abs(fn[key] - want) > epsilon) {
      fail(`${gate}: featherNoise.${key} ${JSON.stringify(fn[key])} != ${want} (twin drift)`)
    }
  }
  if (fn.effectiveFeather !== feather) {
    fail(`${gate}: effectiveFeather ${JSON.stringify(fn.effectiveFeather)} != ${feather} (the --feather operand never reached the bag?)`)
  }
  // The footprint cross-check is the NEUTRAL bar only: a driven cell's mark
  // is SUPPOSED to lose width (that is the artist's law), so its measured
  // half-width may not be held to the radius.
  if (noise === 0 && fn.halfWidthOk !== true) {
    fail(`${gate}: halfWidthOk is ${JSON.stringify(fn.halfWidthOk)} (measured ${fixed(fn.measuredHalfWidthPx)} vs radius ${fixed(fn.radiusPx)} px, delta ${fixed(fn.halfWidthDeltaPct)} %)`)
  }
  for (const key of ['openingHalfOffsetPx', 'outerExtentPx', 'measuredHalfWidthPx']) {
    if (num(fn[key]) === null) {
      fail(`${gate}: featherNoise.${key} is ${JSON.stringify(fn[key])} (expected a finite number)`)
    }
  }
  return {
    gate,
    size,
    feather,
    noise,
    digests: [
      report.digestPaper,
      report.digestTransparent,
      report.digestWhite,
      report.digestPigment,
    ],
    fn,
  }
}

/** The declared twins' values for a cell — the bar's independent echo. */
function expectedKnobs(halfWidthPx, noise) {
  const drive = clamp(noise / 100, 0, 1)
  return {
    drive,
    coreU: 1 - CORE_DEPTH * drive,
    chipCut: CHIP_CUT_START + (CHIP_CUT_END - CHIP_CUT_START) * drive,
    chipFeaturePx: clamp(halfWidthPx * CHIP_SCALE, CHIP_MIN_PX, CHIP_MAX_PX),
    wobbleFeaturePx: clamp(halfWidthPx * WOBBLE_SCALE, WOBBLE_MIN_PX, WOBBLE_MAX_PX),
  }
}

/** Read the baseline capture's four digests; a missing baseline is a FAIL. */
const readBaseline = (path, label) => {
  if (!existsSync(path)) {
    fail(`${label}: baseline capture missing at ${path}`)
    return null
  }
  let report
  try {
    report = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    fail(`${label}: baseline ${path} is not valid JSON: ${error.message}`)
    return null
  }
  return [
    report.digestPaper,
    report.digestTransparent,
    report.digestWhite,
    report.digestPigment,
  ]
}

// --- render every cell ------------------------------------------------------

console.log('=== quick 261126-v8j feather-noise five-state bar (Spec 11) ===')
console.log(`prefix   : ${prefix}`)
console.log(`sizes    : ${sizes.join(', ')}   feathers: ${feathers.join(', ')}   noises: ${noises.join(', ')}`)
console.log(`sheet    : ${sheet} px      captures: ${CAPTURE_DIR}/${prefix}-s{size}-f{feather}-n{noise}.json`)
console.log('')

const cells = new Map()
for (const size of sizes) {
  for (const feather of feathers) {
    for (const noise of noises) {
      const cell = renderCell(size, feather, noise)
      if (cell === null) continue
      cells.set(`s${size}-f${feather}-n${noise}`, cell)
      console.log(
        `${pad(cell.gate, 24)} digests ${cell.digests.map((d) => String(d).slice(0, 8)).join(' ')}  ` +
          `open ${pad(fixed(cell.fn.openingHalfOffsetPx), 7)} outer ${pad(fixed(cell.fn.outerExtentPx), 7)} ` +
          `halfW ${pad(fixed(cell.fn.measuredHalfWidthPx), 7)} drive ${fixed(cell.fn.drive, 3)} ` +
          `core ${fixed(cell.fn.coreU, 3)} cut ${fixed(cell.fn.chipCut, 3)} ` +
          `chip ${fixed(cell.fn.chipFeaturePx)} wob ${fixed(cell.fn.wobbleFeaturePx)}`,
      )
    }
  }
}

// --- bar 1: the neutral identity -------------------------------------------

let bar1Checks = 0
const neutralCells = [
  [85, baselineN85, 'Feather 85'],
  [0, baselineF0, 'Feather 0'],
]
for (const [feather, baselinePath, label] of neutralCells) {
  if (!sizes.includes(IDENTITY_SIZE) || !feathers.includes(feather)) continue
  const cell = cells.get(`s${IDENTITY_SIZE}-f${feather}-n0`)
  if (cell === undefined) continue
  bar1Checks += 1
  const baseline = readBaseline(baselinePath, label)
  if (baseline === null) continue
  const mismatches = cell.digests
    .map((digest, index) => ({ digest, want: baseline[index] }))
    .filter(({ digest, want }) => digest !== want)
  if (mismatches.length > 0) {
    fail(
      `${cell.gate}: noise 0 is NOT the pre-change neutral render — ` +
        mismatches
          .map(({ digest, want }, index) => `${['paper', 'transparent', 'white', 'pigment'][index]} ${digest} != ${want}`)
          .join(', '),
    )
  }
}

// --- bar 3: erosion only removes -------------------------------------------

let bar3Checks = 0
for (const size of sizes) {
  for (const feather of feathers) {
    const ordered = noises
      .map((noise) => cells.get(`s${size}-f${feather}-n${noise}`))
      .filter((cell) => cell !== undefined)
    if (ordered.length !== noises.length) continue
    bar3Checks += 1
    for (const key of ['openingHalfOffsetPx', 'outerExtentPx', 'measuredHalfWidthPx']) {
      for (let i = 1; i < ordered.length; i += 1) {
        const previous = ordered[i - 1].fn[key]
        const current = ordered[i].fn[key]
        if (current > previous + READ_EPSILON) {
          fail(
            `s${size}-f${feather}: ${key} grew from noise ${ordered[i - 1].noise} (${fixed(previous)}) ` +
              `to noise ${ordered[i].noise} (${fixed(current)}) — erosion may only remove`,
          )
        }
      }
    }
  }
}

// --- bar 4: the drawn extremes ---------------------------------------------

let bar4Checks = 0
for (const size of sizes) {
  for (const feather of feathers) {
    const state0 = cells.get(`s${size}-f${feather}-n0`)
    const state20 = cells.get(`s${size}-f${feather}-n20`)
    const state100 = cells.get(`s${size}-f${feather}-n100`)
    if (state0 === undefined || state100 === undefined) continue
    bar4Checks += 1
    const open0 = state0.fn.openingHalfOffsetPx
    const open100 = state100.fn.openingHalfOffsetPx
    if (!(open100 < open0 - READ_EPSILON)) {
      fail(
        `s${size}-f${feather}: state 100 does not erode (opening ${fixed(open100)} vs state 0 ${fixed(open0)})`,
      )
    }
    if (!(open100 > 0 && open100 >= SPINE_MIN_SHARE * open0)) {
      fail(
        `s${size}-f${feather}: state 100 has no central spine (opening ${fixed(open100)} px vs state 0 ${fixed(open0)} px)`,
      )
    }
    if (feather >= 85 && state20 !== undefined) {
      const open20 = state20.fn.openingHalfOffsetPx
      const allowed = STATE20_ABS_PX + STATE20_REL * open0
      if (!(open0 - open20 <= allowed)) {
        fail(
          `s${size}-f${feather}: state 20 shrinks the body (opening ${fixed(open20)} vs ${fixed(open0)} px, ` +
            `loss ${fixed(open0 - open20)} > ${fixed(allowed)})`,
        )
      }
    }
  }
}

// --- bar 5: the footprint survives -----------------------------------------

let bar5Checks = 0
for (const size of sizes) {
  for (const feather of feathers) {
    const state0 = cells.get(`s${size}-f${feather}-n0`)
    const state100 = cells.get(`s${size}-f${feather}-n100`)
    if (state0 === undefined || state100 === undefined) continue
    bar5Checks += 1
    const keep = state100.fn.measuredHalfWidthPx
    const want = FOOTPRINT_SHARE * state0.fn.measuredHalfWidthPx
    if (!(keep >= want - READ_EPSILON)) {
      fail(
        `s${size}-f${feather}: state 100 collapses the footprint ` +
          `(measured ${fixed(keep)} px vs ${fixed(state0.fn.measuredHalfWidthPx)} px at state 0; ` +
          `kept ${fixed(keep / Math.max(state0.fn.measuredHalfWidthPx, EPS))} < ${FOOTPRINT_SHARE})`,
      )
    }
  }
}

// --- verdict ----------------------------------------------------------------

console.log('')
console.log(
  `bars: (1) neutral digests ${bar1Checks} cells | (2) knob echo ${cells.size} cells | ` +
    `(3) erosion order ${bar3Checks} sweeps | (4) drawn extremes ${bar4Checks} sweeps | ` +
    `(5) footprint ${bar5Checks} sweeps`,
)
if (bar1Checks === 0) {
  fail('bar 1 read no cell — needs Size 120 with Feather 85 and Feather 0 in --sizes/--feathers')
}
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  for (const message of failures) console.log(`  - ${message}`)
  process.exit(1)
}
console.log(`PASS: ${cells.size} cells rendered, four bars hold`)
