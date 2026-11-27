#!/usr/bin/env node
// ============================================================
// featherNoise.mjs — quick 261126-v8j's five-state bar (Spec 11).
//
// The artist's law (2026-11-27, re-indexed 2026-11-27k): ONE three-scale
// cloud erodes the base shape from a wavy front INWARD as the slider rises,
// while a continuous core survives and sparse chip peaks restore the base
// footprint locally. The noisy mark may only REMOVE paint from the shipped
// base mark — never add — so no outward fibers or spikes can exist. The
// slider's meaning:
//
//     0    the CLEAN edge (no shipped Feather raggedness)
//     20   the delivered BASE look — the neutral program, byte-identical
//     40   light break-up
//     60   medium break-up
//     100  the full three-scale break-up: thin continuous core + chips
//
// The old band-period gate measured the retired grain law, so it was
// retired with it; this bar renders and reads the five states the artist
// drew. Bars, all declared here, never revised to fit a capture:
//
//   (1) NEUTRAL DIGESTS. The slider-20 cells at Size 120 / Feather 85 and
//       Size 120 / Feather 0 carry EXACTLY the pre-change capture's four
//       export digests (paper / transparent / white / pigment), and the
//       slider-0 digests DIFFER from them (the clean edge is a real state).
//   (2) KNOB ECHO. Every cell echoes the declared twins: paramsEcho carries
//       the slider, Feather and falloff, and the featherNoise block's
//       slider / drive / edgeClean / neutralProgram match the twins.
//   (3) NOTHING BEYOND THE BASE. At Feather > 0 every DRIVEN state (40 / 60 /
//       100) reads openingHalfOffsetPx, outerExtentPx and
//       measuredHalfWidthPx AT OR BELOW the slider-20 base cell: the chips
//       restore paint only up to the base silhouette (the max() floor), so a
//       reading past it is an outward fiber, a law break. The clean edge
//       (slider 0) is the opposite direction by definition — it removed the
//       shipped raggedness, never paint — so its three readings are AT OR
//       ABOVE the base cell.
//   (4) THE CORE ERODES PROGRESSIVELY. openingHalfOffsetPx is
//       NON-INCREASING across 20 -> 40 -> 60 -> 100 and opening(100) is
//       strictly smaller than opening(0) and still positive (the continuous
//       core survives, at least SPINE_MIN_SHARE of state 0); opening(0) is at
//       least opening(20) (the clean edge keeps the full width). The
//       FOOTPRINT readings are NOT ordered — chips are restoration — so they
//       are held to bar 3 and bar 5 instead.
//   (5) THE FOOTPRINT SURVIVES. measuredHalfWidthPx(100) keeps at least
//       FOOTPRINT_SHARE of the base cell's measuredHalfWidthPx: the chips
//       are kept paint inside the base silhouette, never a thin noodle.
//   (6) FEATHER 0 IS INERT. The law shapes the FEATHER rim, so at Feather 0
//       every extended-program state (0 / 40 / 60 / 100) must render EXACTLY
//       the same mark (identical four digests): no rim, no erosion, no
//       fibers. The slider-20 cell is outside this bar — it is the neutral
//       identity of bar 1.
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
//   --baseline-n85 <path> the pre-change neutral capture at Size 120 /
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

/** Mirrors bristles.ts FEATHER_NOISE_NEUTRAL: the neutral slider (20%). */
const NEUTRAL_SLIDER = 0.2
/** The five declared states. */
const STATES = [0, 20, 40, 60, 100]
/** Bar 1: the neutral identity cells (Size 120 at the two Feather cells). */
const IDENTITY_SIZE = 120
/** Bar 3/4 tolerance: the rounded readings are printed at 2 dp. */
const READ_EPSILON = 0.011
/** Bar 4: the core must retain this share of the state-0 opening. */
const SPINE_MIN_SHARE = 0.03
/** Bar 5: state 100 keeps this share of the base cell's measured half-width. */
const FOOTPRINT_SHARE = 0.8
/** Bar 2 tolerances for the echoed twins. */
const DRIVE_EPS = 5e-4
const EDGE_CLEAN_EPS = 5e-4
/**
 * The neutral cell's footprint cross-check. measuredHalfWidthPx is an integer
 * row index, so at a tiny radius one row is several percent (Size 4: radius
 * 15.26 px, row 17 — 11.4 %). The check therefore passes within the probe's
 * 10 % tolerance OR HALF_WIDTH_PX_FLOOR px of the engine's radius — the
 * metric's own resolution, not a law threshold. This is the NEUTRAL program,
 * which carries no law uniform, so the cell is the pre-change render by
 * construction; a failure here can only be the measurement, never the law.
 */
const HALF_WIDTH_TOLERANCE = 0.1
const HALF_WIDTH_PX_FLOOR = 2

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
const clamp01 = (value) => clamp(value, 0, 1)
const EPS = 1e-9

/** Mirrors bristles.ts featherNoiseDrive (the break-up amount). */
const driveOf = (slider) =>
  clamp01((clamp01(slider) - NEUTRAL_SLIDER) / (1 - NEUTRAL_SLIDER))
/** Mirrors bristles.ts featherEdgeClean (the shipped raggedness scale). */
const edgeCleanOf = (slider) => {
  const t = clamp01(clamp01(slider) / NEUTRAL_SLIDER)
  return t * t * (3 - 2 * t)
}
/** The engine's permutation switch, restated: drive 0, clean-edge 1, falloff 50. */
const neutralOf = (slider, falloff) =>
  driveOf(slider) === 0 && edgeCleanOf(slider) === 1 && falloff === 50

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
  // Bar 2: the declared twins' values for this cell — the bar's independent
  // echo. The probe derives them from the same %100 normalisation the engine
  // uses.
  const expectedDrive = driveOf(noise / 100)
  const expectedEdgeClean = edgeCleanOf(noise / 100)
  if (num(fn.slider) !== noise) {
    fail(`${gate}: featherNoise.slider ${JSON.stringify(fn.slider)} != ${noise}`)
  }
  if (num(fn.drive) === null || Math.abs(fn.drive - expectedDrive) > DRIVE_EPS) {
    fail(`${gate}: featherNoise.drive ${JSON.stringify(fn.drive)} != ${expectedDrive} (twin drift)`)
  }
  if (num(fn.edgeClean) === null || Math.abs(fn.edgeClean - expectedEdgeClean) > EDGE_CLEAN_EPS) {
    fail(`${gate}: featherNoise.edgeClean ${JSON.stringify(fn.edgeClean)} != ${expectedEdgeClean} (twin drift)`)
  }
  if (fn.neutralProgram !== neutralOf(noise / 100, 50)) {
    fail(`${gate}: featherNoise.neutralProgram ${JSON.stringify(fn.neutralProgram)} != ${neutralOf(noise / 100, 50)}`)
  }
  if (fn.effectiveFeather !== feather) {
    fail(`${gate}: effectiveFeather ${JSON.stringify(fn.effectiveFeather)} != ${feather} (the --feather operand never reached the bag?)`)
  }
  // The footprint cross-check is the NEUTRAL cell only: a driven mark is
  // SUPPOSED to lose paint (that is the artist's law), so its measured
  // half-width is read by bar 5, not held to the radius.
  if (noise === 20) {
    const deltaPx =
      num(fn.measuredHalfWidthPx) === null || num(fn.radiusPx) === null
        ? null
        : Math.abs(fn.measuredHalfWidthPx - fn.radiusPx)
    const withinTolerance =
      fn.halfWidthOk === true ||
      (deltaPx !== null && deltaPx <= HALF_WIDTH_PX_FLOOR)
    if (!withinTolerance) {
      fail(
        `${gate}: the neutral mark misses the engine radius — measured ${fixed(fn.measuredHalfWidthPx)} px ` +
          `vs radius ${fixed(fn.radiusPx)} px (delta ${fixed(deltaPx)} px / ${fixed(fn.halfWidthDeltaPct)} %, ` +
          `tolerance ${HALF_WIDTH_TOLERANCE * 100} % or ${HALF_WIDTH_PX_FLOOR} px)`,
      )
    }
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

console.log('=== quick 261126-v8j feather-noise five-state bar (Spec 11, re-indexed) ===')
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
          `clean ${fixed(cell.fn.edgeClean, 3)} neutral ${cell.fn.neutralProgram === true ? 'yes' : 'no '}`,
      )
    }
  }
}

// --- bar 1: the neutral identity at slider 20 ------------------------------

let bar1Checks = 0
const neutralCells = [
  [85, baselineN85, 'Feather 85'],
  [0, baselineF0, 'Feather 0'],
]
for (const [feather, baselinePath, label] of neutralCells) {
  if (!sizes.includes(IDENTITY_SIZE) || !feathers.includes(feather) || !noises.includes(20)) continue
  const cell = cells.get(`s${IDENTITY_SIZE}-f${feather}-n20`)
  if (cell === undefined) continue
  bar1Checks += 1
  const baseline = readBaseline(baselinePath, label)
  if (baseline === null) continue
  const mismatches = cell.digests
    .map((digest, index) => ({ digest, want: baseline[index] }))
    .filter(({ digest, want }) => digest !== want)
  if (mismatches.length > 0) {
    fail(
      `${cell.gate}: slider 20 is NOT the pre-change neutral render — ` +
        mismatches
          .map(({ digest, want }, index) => `${['paper', 'transparent', 'white', 'pigment'][index]} ${digest} != ${want}`)
          .join(', '),
    )
  }
  // State 0 must be a REAL state: the clean edge differs from the base look.
  const clean = cells.get(`s${IDENTITY_SIZE}-f${feather}-n0`)
  if (clean !== undefined && clean.digests.every((digest, index) => digest === cell.digests[index])) {
    fail(`${clean.gate}: slider 0 renders exactly like slider 20 — the clean edge did not reach the render`)
  }
}

// --- bar 3: nothing beyond the base ----------------------------------------

const READING_KEYS = ['openingHalfOffsetPx', 'outerExtentPx', 'measuredHalfWidthPx']
let bar3Checks = 0
for (const size of sizes) {
  for (const feather of feathers) {
    if (!(feather > 0)) continue // bar 6 owns the Feather-0 sweep
    const base = cells.get(`s${size}-f${feather}-n20`)
    if (base === undefined) continue
    bar3Checks += 1
    for (const noise of noises) {
      if (noise === 20) continue
      const cell = cells.get(`s${size}-f${feather}-n${noise}`)
      if (cell === undefined) continue
      for (const key of READING_KEYS) {
        const reading = cell.fn[key]
        const reference = base.fn[key]
        if (noise > 20 && reading > reference + READ_EPSILON) {
          fail(
            `${cell.gate}: ${key} ${fixed(reading)} exceeds the base's ${fixed(reference)} — ` +
              `a driven state painted beyond the base silhouette`,
          )
        }
        if (noise < 20 && reading < reference - READ_EPSILON) {
          fail(
            `${cell.gate}: ${key} ${fixed(reading)} falls below the base's ${fixed(reference)} — ` +
              `the clean edge must only remove the shipped raggedness, never paint`,
          )
        }
      }
    }
  }
}

// --- bar 4: the core erodes progressively -----------------------------------

let bar4Checks = 0
for (const size of sizes) {
  for (const feather of feathers) {
    if (!(feather > 0)) continue // bar 6 owns the Feather-0 sweep
    const ordered = noises
      .filter((noise) => noise >= 20)
      .map((noise) => cells.get(`s${size}-f${feather}-n${noise}`))
      .filter((cell) => cell !== undefined)
    const state0 = cells.get(`s${size}-f${feather}-n0`)
    const state20 = cells.get(`s${size}-f${feather}-n20`)
    const state100 = cells.get(`s${size}-f${feather}-n100`)
    if (state0 === undefined || state100 === undefined) continue
    if (ordered.length !== noises.filter((noise) => noise >= 20).length) continue
    bar4Checks += 1
    for (let i = 1; i < ordered.length; i += 1) {
      const previous = ordered[i - 1].fn.openingHalfOffsetPx
      const current = ordered[i].fn.openingHalfOffsetPx
      if (current > previous + READ_EPSILON) {
        fail(
          `${ordered[i].gate}: the core opening grew from slider ${ordered[i - 1].noise} ` +
            `(${fixed(previous)}) to slider ${ordered[i].noise} (${fixed(current)}) — the core must erode progressively`,
        )
      }
    }
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
    // The clean edge (state 0) keeps the full width: the shipped raggedness
    // was removed, never added, so its opening cannot be the narrow one.
    if (state20 !== undefined && !(open0 + READ_EPSILON >= state20.fn.openingHalfOffsetPx)) {
      fail(
        `s${size}-f${feather}: the clean edge is narrower than the base look ` +
          `(opening 0 ${fixed(open0)} vs 20 ${fixed(state20.fn.openingHalfOffsetPx)})`,
      )
    }
  }
}

// --- bar 5: the footprint survives -----------------------------------------

let bar5Checks = 0
for (const size of sizes) {
  for (const feather of feathers) {
    if (!(feather > 0)) continue // bar 6 owns the Feather-0 sweep
    const base = cells.get(`s${size}-f${feather}-n20`)
    const state100 = cells.get(`s${size}-f${feather}-n100`)
    if (base === undefined || state100 === undefined) continue
    bar5Checks += 1
    const keep = state100.fn.measuredHalfWidthPx
    const want = FOOTPRINT_SHARE * base.fn.measuredHalfWidthPx
    if (!(keep >= want - READ_EPSILON)) {
      fail(
        `s${size}-f${feather}: state 100 collapses the footprint ` +
          `(measured ${fixed(keep)} px vs ${fixed(base.fn.measuredHalfWidthPx)} px at state 20; ` +
          `kept ${fixed(keep / Math.max(base.fn.measuredHalfWidthPx, EPS))} < ${FOOTPRINT_SHARE})`,
      )
    }
  }
}

// --- bar 6: Feather 0 is inert ---------------------------------------------

/** The extended-program states (slider 20 is the neutral identity). */
const DRIVEN_STATES = STATES.filter((state) => state !== 20)
let bar6Checks = 0
for (const size of sizes) {
  if (!feathers.includes(0)) continue
  const reference = cells.get(`s${size}-f0-n${DRIVEN_STATES[0]}`)
  if (reference === undefined) continue
  bar6Checks += 1
  for (const noise of DRIVEN_STATES.slice(1)) {
    const cell = cells.get(`s${size}-f0-n${noise}`)
    if (cell === undefined) continue
    const differs = cell.digests.some((digest, index) => digest !== reference.digests[index])
    if (differs) {
      fail(
        `${cell.gate}: Feather 0 renders differently from slider ${DRIVEN_STATES[0]} — ` +
          `the rim law has no rim to shape and must be exactly inert`,
      )
    }
  }
}

// --- verdict ----------------------------------------------------------------

console.log('')
console.log(
  `bars: (1) neutral digests ${bar1Checks} cells | (2) knob echo ${cells.size} cells | ` +
    `(3) base bound ${bar3Checks} sweeps | (4) core erosion ${bar4Checks} sweeps | ` +
    `(5) footprint ${bar5Checks} sweeps | (6) Feather-0 inert ${bar6Checks} sweeps`,
)
if (bar1Checks === 0) {
  fail('bar 1 read no cell — needs Size 120 with Feather 85 and Feather 0 in --sizes/--feathers')
}
if (failures.length > 0) {
  console.log(`FAIL: ${failures.length} check${failures.length === 1 ? '' : 's'} failed`)
  for (const message of failures) console.log(`  - ${message}`)
  process.exit(1)
}
console.log(`PASS: ${cells.size} cells rendered, six bars hold`)
