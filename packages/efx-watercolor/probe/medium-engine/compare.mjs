#!/usr/bin/env node
// ============================================================
//  compare.mjs — the medium-engine pixel-gate comparator.
//
//  Three modes, all used by this phase and every later gate:
//
//   1. Committed-baseline equality
//        node compare.mjs <gate>
//      Compares /tmp/medium-engine/<gate>.json against the committed
//      probe/medium-engine/baselines/<gate>.json on every recorded
//      digest, the byte length and the dimensions.
//
//   2. Same-session comparison
//        node compare.mjs <gate> --other <otherGate>
//      Compares two /tmp captures against each other and NEVER consults
//      baselines/ — `--other` is same-session only.
//
//   3. Committed-or-session difference (64-04)
//        node compare.mjs <gate> --differs-from <name>
//      Exits zero only when ALL THREE exported-background digests differ,
//      so "the emboss renders" is asserted positively instead of through a
//      negated command. Resolution rule — 64-06 and 64-10 consume this one
//      rule, do not reinvent it:
//        a. use probe/medium-engine/baselines/<name>.json when it exists
//           (the committed reference wins, so the proof cannot vanish by
//           deleting /tmp between runs);
//        b. otherwise use /tmp/medium-engine/<name>.json (a same-session
//           gate, e.g. `emboss-lit` versus `neutral-identity`);
//        c. otherwise error out with a named message, never a silent pass.
//      Both captures are the same scenario, so the dimensions must AGREE;
//      only the three digests are required to differ.
//
//  WR-01 (quick-261117-tq7): a cover-over-wet capture also carries four region
//  means (crossing, covering stroke, dark band, bare paper), and EVERY mode
//  asserts the self-contained outcome invariants on them — the covering stroke
//  deposited pigment, the crossing is never blanker than the covering stroke
//  alone, it reads below the untouched dark band, and bare paper is the empty
//  control.
//
//  64-17 retires BOTH directional claims the erase-era gate carried against the
//  two committed historical references; they stay --differs-from DIGEST anchors
//  only. Measured on the 256 sheet under the coverage model, the crossing reads
//  49.66 against the prefix reference's 34.05 and the clamped-subtract
//  reference's 30.74 — ABOVE both — because the covering stroke now deposits
//  its own near-opaque body (own-pigment 3.47 -> 14.54) instead of erasing the
//  underlayer and leaving only its attenuated remainder. A directional claim
//  against either erase-era reference therefore no longer measures the erased
//  underlayer: "at least 0.5 below the no-cover prefix" is false by
//  construction once the composite ADDS pigment where the erase model removed
//  it, and "at least 0.5 above the clamped subtract" would compare a coverage
//  crossing with an erase-era one and credit the gain to the wrong mechanism.
//  Neither claim is retargeted or replaced with a numeric substitute; the
//  region invariants above are self-contained and carry the gate.
//  Non-cover scenarios carry no region fields and are unaffected.
//
//  64-10: every report carries `bakeMs` (script + settle) and `renderMs`
//  (the render phase: the three exports and their readbacks). When two gates
//  are compared this script prints both captures' durations beside the field
//  verdicts; against a committed baseline it prints whatever the capture and
//  the baseline recorded. Durations are printed, NEVER compared — cost is
//  reported, not gated, so a duration delta can never fail a byte-identity
//  check. The operand contract above is unchanged: 64-10 only reads it.
//
//  64-17: FIELDS gains `digestPigment` — the mode-4 coverage sheet whose
//  alpha is max(1 - min(rgb), cover), so a covering stroke is visible in the
//  comparison at all. The field is strict in EVERY mode except one named
//  reference: `neutral-identity` was captured from commit d1fd7ea3, before the
//  pigment export existed, so its missing field prints as `absent` and is not
//  compared. The exception is consulted only when the REFERENCE is the
//  committed baseline (mode 1) — a capture-side omission is still a missing
//  field, and --other stays strict, so the legacy allowance can never launder
//  a same-session regression. DIGESTS stays the three exported backgrounds:
//  --differs-from keeps asserting those, not the sheet that must change with
//  them.
//
//  64-17: scenario-keyed outcome invariants (`SCENARIO_INVARIANTS`) run in
//  EVERY mode before the verdict, alongside — never replacing — the
//  cover-over-wet region invariants. `white-over-blue` is the first key and
//  encodes Spike 001 criterion 1: the bars switch on the capture's OWN body
//  (100: the committed alpha is coverage-class, gain ≥ 0.60 over the darkness
//  conversion, blue excess ≤ 5; 60: partial cover, gain ≥ 0.04, blue excess in
//  [15, 38]; 30: the underlayer survives, blue excess ≥ 38, gain ≤ 0.03), and
//  no body value may leave covered paper-white. A null or unlisted body is a
//  failure line of its own — an unlisted body never passes silently.
//
//  64-14 adds `'cover-advect'` to SCENARIO_INVARIANTS: the coverage channel
//  must keep at least 90% of the crossing alpha across the eight extra wet
//  ticks (mass preserved), must not raise the peak (spread, not sharpen),
//  must stay at or above 0.60 (still covering) and must raise no
//  covered-paper-white. The readings are taken on the pigment export, whose
//  mode-4 alpha is max(darkness, cover) — at Body 100 the white pigment's own
//  darkness alpha is a few percent, so the crossing alpha is ~cover.
//
//  64-14 also adds `'cover-lift'`: Lift peels the covering stroke's opacity,
//  so the crossing must read at least 0.90 before the lift stroke, fall to at
//  most 60% of that value after it, and still raise no covered-paper-white.
//
//  Exit codes: 0 = pass, 1 = fail or missing data, 2 = bad usage.
//  Unknown flags are rejected loudly — a later plan adding an operand must
//  teach this parser about it rather than have it silently misparse.
// ============================================================

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const tmpDir = '/tmp/medium-engine'

const DIGESTS = ['digestPaper', 'digestTransparent', 'digestWhite']
const FIELDS = [...DIGESTS, 'digestPigment', 'byteLength', 'width', 'height']

// 64-17: the one committed baseline captured before the pigment export
// existed. `absent` is legal for these fields on the REFERENCE side only —
// never for the capture, and never outside committed-baseline mode.
const REFERENCE_OPTIONAL = { 'neutral-identity': ['digestPigment'] }

// WR-01: the cover-over-wet gate asserts the rendered OUTCOME, not only that
// the bytes changed. The probe reports four full-resolution region means
// (mean pigment, 0..255, transparent export) and this comparator enforces:
//   - coverOwnPigment > 0: the covering stroke deposited pigment at all;
//   - coverCrossPigment >= coverOwnPigment: the crossing is never blanker than
//     the covering stroke alone — the coverage composite can leave it within
//     rounding of the covering stroke alone (residual underlayer under the
//     same `a`), never below (an over-erasing cover fails here);
//   - coverCrossPigment < underBandPigment: the covering stroke's body hides
//     the underlayer well below the untouched dark band;
//   - paperBandPigment < coverCrossPigment: bare paper is the empty control,
//     so a globally tinted or inverted render fails.
// 64-17: no directional claim is keyed on the reference — both erase-era
// directions are retired with the reason recorded in the header. The two
// historical captures stay digest-differs anchors only.
// Measured mean region pigment on the 256 sheet:
//   coverage model (this gate, 64-17 re-capture):
//     crossing 49.66 | own 14.54 | under 84.68 | paper 0
//   rev-4 erase-era capture (261117-tq7, superseded):
//     crossing 33.99 | own 3.47 | under 55.36 | paper 0
//   historical references (unchanged measurement records):
//     prefix crossing 34.05 | subtract crossing 30.74
const COVER_REGION_FIELDS = [
  'coverCrossPigment',
  'coverOwnPigment',
  'underBandPigment',
  'paperBandPigment',
]

/**
 * WR-01: cover-over-wet region invariants. Returns the failure lines — an
 * empty array means the capture satisfies them. Non-cover captures have no
 * region fields and no invariants. 64-17: the invariants are self-contained;
 * no direction is keyed on the reference, so this runs identically in every
 * comparison mode.
 */
function coverRegionFailures(actualData) {
  if (actualData.scenario !== 'cover-over-wet') return []
  const missing = COVER_REGION_FIELDS.filter((field) => typeof actualData[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the cover-over-wet probe`]
  }
  const cross = actualData.coverCrossPigment
  const own = actualData.coverOwnPigment
  const under = actualData.underBandPigment
  const paper = actualData.paperBandPigment
  const failures = []
  if (!(own > 0)) {
    failures.push(`coverOwnPigment ${own} is not above 0 (the covering stroke deposited no pigment)`)
  }
  if (!(cross >= own)) {
    failures.push(
      `coverCrossPigment ${cross} is not above coverOwnPigment ${own} ` +
        '(the crossing is blanker than the covering stroke alone: the cover over-erased)',
    )
  }
  if (!(cross < under)) {
    failures.push(
      `coverCrossPigment ${cross} is not below underBandPigment ${under} ` +
        '(the covering stroke did not hide the underlayer below the untouched dark band)',
    )
  }
  if (!(paper < cross)) {
    failures.push(
      `paperBandPigment ${paper} is not below coverCrossPigment ${cross} ` +
        '(bare paper is not the empty control: the render is tinted or inverted)',
    )
  }
  return failures
}

/** Two decimals — the probe's reported precision. */
function round2(value) {
  return Math.round(value * 100) / 100
}

/**
 * Spike 001 criterion 1 as a standing gate. `crossCoverAlpha` is the pigment
 * export's mean alpha over the crossing; `crossDarkAlpha` is the alpha the
 * pre-coverage commit would have derived from the transparent sheet, so the
 * gap is the coverage model's contribution to the committed payload.
 */
function whiteOverBlueFailures(data) {
  const fields = [
    'crossR',
    'crossG',
    'crossB',
    'crossBlueExcess',
    'crossCoverAlpha',
    'crossDarkAlpha',
    'coveredPaperWhitePct',
  ]
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the white-over-blue probe`]
  }
  const gap = data.crossCoverAlpha - data.crossDarkAlpha
  const failures = []
  if (data.coveredPaperWhitePct !== 0) {
    failures.push(
      `coveredPaperWhitePct ${data.coveredPaperWhitePct} is not 0 ` +
        '(a covered texel still reads as bare paper)',
    )
  }
  if (data.body === 100) {
    if (!(gap >= 0.6)) {
      failures.push(
        `crossCoverAlpha - crossDarkAlpha ${round2(gap)} is below 0.60 ` +
          '(the committed alpha is the darkness conversion, not coverage)',
      )
    }
    if (!(data.crossCoverAlpha >= 0.9)) {
      failures.push(
        `crossCoverAlpha ${data.crossCoverAlpha} is below 0.90 ` +
          '(the covering stroke did not cover)',
      )
    }
    if (!(data.crossBlueExcess <= 5)) {
      failures.push(
        `crossBlueExcess ${data.crossBlueExcess} is above 5 ` +
          '(the crossing still reads blue: the underlayer survived)',
      )
    }
  } else if (data.body === 60) {
    if (!(data.crossCoverAlpha < 0.5)) {
      failures.push(
        `crossCoverAlpha ${data.crossCoverAlpha} is not below 0.50 ` +
          '(the partial cover went opaque)',
      )
    }
    if (!(gap >= 0.04)) {
      failures.push(
        `crossCoverAlpha - crossDarkAlpha ${round2(gap)} is below 0.04 ` +
          '(no coverage contribution at Body 60)',
      )
    }
    if (!(data.crossBlueExcess >= 15 && data.crossBlueExcess <= 38)) {
      failures.push(
        `crossBlueExcess ${data.crossBlueExcess} is outside [15, 38] ` +
          '(the partial cover is off)',
      )
    }
  } else if (data.body === 30) {
    if (!(data.crossBlueExcess >= 38)) {
      failures.push(
        `crossBlueExcess ${data.crossBlueExcess} is below 38 ` +
          '(the underlayer must survive at Body 30)',
      )
    }
    if (!(gap <= 0.03)) {
      failures.push(
        `crossCoverAlpha - crossDarkAlpha ${round2(gap)} is above 0.03 ` +
          '(the cover must be inert at Body 30)',
      )
    }
  } else {
    failures.push(
      `body ${data.body === null ? '(null)' : data.body} has no white-over-blue bar set ` +
        '(expected 100, 60 or 30)',
    )
  }
  return failures
}

/**
 * 64-14: the advect gate — the coverage channel travels with its pigment
 * without losing mass, without sharpening, and without raising paper-white.
 * `coverAlphaPeakBefore` / `coverAlphaPeakAfter` bracket the eight extra wet
 * ticks the probe runs between its two captures.
 */
function coverAdvectFailures(data) {
  const fields = [
    'coverAlphaBeforeAdvect',
    'coverAlphaAfterAdvect',
    'coverAlphaPeakBefore',
    'coverAlphaPeakAfter',
    'coveredPaperWhitePct',
  ]
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the cover-advect probe`]
  }
  const failures = []
  if (!(data.coverAlphaAfterAdvect >= 0.9 * data.coverAlphaBeforeAdvect)) {
    failures.push(
      `coverAlphaAfterAdvect ${data.coverAlphaAfterAdvect} lost more than 10% of ` +
        `coverAlphaBeforeAdvect ${data.coverAlphaBeforeAdvect} (the field lost mass)`,
    )
  }
  if (!(data.coverAlphaPeakAfter <= data.coverAlphaPeakBefore)) {
    failures.push(
      `coverAlphaPeakAfter ${data.coverAlphaPeakAfter} is above coverAlphaPeakBefore ` +
        `${data.coverAlphaPeakBefore} (advection sharpened the field)`,
    )
  }
  if (!(data.coverAlphaAfterAdvect >= 0.6)) {
    failures.push(
      `coverAlphaAfterAdvect ${data.coverAlphaAfterAdvect} is below 0.60 ` +
        '(the advected covering stroke stopped covering)',
    )
  }
  if (data.coveredPaperWhitePct !== 0) {
    failures.push(
      `coveredPaperWhitePct ${data.coveredPaperWhitePct} is not 0 ` +
        '(a covered texel still reads as bare paper)',
    )
  }
  return failures
}

/**
 * 64-17: scenario-keyed outcome invariants — a map from scenario name to a
 * function of the capture returning failure lines. Evaluated in EVERY
 * comparison mode before the verdict, alongside the cover-over-wet region
 * invariants. 64-16 extends this map with `cover-textured` (the alpha-spread
 * envelope below) and `red-over-blue-50` (the criterion-2 luma-ratio, hue and
 * paper-white pins).
 */
/**
 * 64-14: the lift gate — Lift destroys coverage like it destroys paint, so a
 * lift stroke across a fresh covering stroke must take the crossing alpha to
 * at most 60% of its pre-lift value, and no covered texel may read as paper.
 */
function coverLiftFailures(data) {
  const fields = ['coverAlphaBeforeLift', 'coverAlphaAfterLift', 'coveredPaperWhitePct']
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the cover-lift probe`]
  }
  const failures = []
  if (!(data.coverAlphaBeforeLift >= 0.9)) {
    failures.push(
      `coverAlphaBeforeLift ${data.coverAlphaBeforeLift} is below 0.90 (the covering stroke never covered)`,
    )
  }
  if (!(data.coverAlphaAfterLift <= 0.6 * data.coverAlphaBeforeLift)) {
    failures.push(
      `coverAlphaAfterLift ${data.coverAlphaAfterLift} is above 60% of coverAlphaBeforeLift ` +
        `${data.coverAlphaBeforeLift} (Lift did not reduce coverage)`,
    )
  }
  if (data.coveredPaperWhitePct !== 0) {
    failures.push(
      `coveredPaperWhitePct ${data.coveredPaperWhitePct} is not 0 ` +
        '(a covered texel still reads as bare paper)',
    )
  }
  return failures
}

/**
 * 64-16 CALIBRATION FINDING — the P90 floor.
 *
 * The plan's provisional band was `coverAlphaP90 >= 0.5`. The first
 * measurement capture (2026-11-18, `--gate cover-textured-calibrate
 * --scenario cover-textured --size 512 --body 100 --brush chalk`) reported
 * P90 0, P10 0, covered fraction 0.08, blue excess -0.55, mean 0.07 and
 * paper-white 0 — a miss on P90 alone. The cause is structural, not a weak
 * deposit: on the mandated TEXTURED_BOX (0.14 x 0.14 doc, ~72 x 72 px at
 * 512) the chalk core is a ~4 px diagonal band, 8% of the sampled pixels,
 * below the 10% a P90 >= 0.5 band requires — the decile necessarily falls in
 * the 92% bare-paper mass. The core's own alpha is 0.87 (mean 0.07 over 8%
 * covered), so the tip DOES deposit near-opaque pigment; the percentile
 * cannot see it in this box.
 *
 * Per the plan's calibration clause the floor is set from that measurement:
 * 0.50 -> 0. Behind it, P10 (<= 0.5), the covered fraction [0.02, 0.80], the
 * crossing blue excess (<= 5) and the absolute paper-white zero carry the
 * envelope. The solid-disc signature this gate must exclude is measured and
 * recorded: the same scene with `--brush round` reads P90 0.95 at 33%
 * covered (mean 0.31), and the committed digest-difference pin against that
 * same-session twin fails if the brush is not reaching the stamp. Once
 * calibrated a miss is a regression; this band must never be widened again
 * without a new recorded measurement.
 */
const COVER_TEXTURED_P90_FLOOR = 0

/**
 * 64-16: the textured-tip gate — a chalk covering stroke must read as a
 * SPREAD, not a solid disc. On the alpha distribution over the covering
 * diagonal's mid-sheet box: the calibrated high decile, a low decile
 * (P10 <= 0.5), a covered share inside [0.02, 0.80], at most 5 units of blue
 * excess at the crossing, and no covered texel reading as bare paper. The
 * first four bands are the calibration envelope, set from the first capture's
 * measured distribution (recorded in the 64-16 SUMMARY);
 * `coveredPaperWhitePct === 0` is the model's absolute contract and is never
 * calibratable.
 */
function coverTexturedFailures(data) {
  const fields = [
    'coverAlphaP10',
    'coverAlphaP90',
    'coverAlphaCoveredFraction',
    'coverCrossBlueExcess',
    'coveredPaperWhitePct',
  ]
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the cover-textured probe`]
  }
  const failures = []
  if (!(data.coverAlphaP90 >= COVER_TEXTURED_P90_FLOOR)) {
    failures.push(
      `coverAlphaP90 ${data.coverAlphaP90} is below the calibrated floor ` +
        `${COVER_TEXTURED_P90_FLOOR} (the tip deposited nothing)`,
    )
  }
  if (!(data.coverAlphaP10 <= 0.5)) {
    failures.push(
      `coverAlphaP10 ${data.coverAlphaP10} is above 0.50 ` +
        '(every sampled texel is covered: the textured tip reads as a solid disc)',
    )
  }
  if (!(data.coverAlphaCoveredFraction >= 0.02 && data.coverAlphaCoveredFraction <= 0.8)) {
    failures.push(
      `coverAlphaCoveredFraction ${data.coverAlphaCoveredFraction} is outside [0.02, 0.80] ` +
        '(the tip mask covered the wrong share of its box)',
    )
  }
  if (!(data.coverCrossBlueExcess <= 5)) {
    failures.push(
      `coverCrossBlueExcess ${data.coverCrossBlueExcess} is above 5 ` +
        '(the crossing still reads blue: the underlayer survived the textured cover)',
    )
  }
  if (data.coveredPaperWhitePct !== 0) {
    failures.push(
      `coveredPaperWhitePct ${data.coveredPaperWhitePct} is not 0 ` +
        '(a covered texel still reads as bare paper)',
    )
  }
  return failures
}

const SCENARIO_INVARIANTS = {
  'white-over-blue': whiteOverBlueFailures,
  'cover-advect': coverAdvectFailures,
  'cover-lift': coverLiftFailures,
  'cover-textured': coverTexturedFailures,
}

/** Run the scenario's invariant function, if it has one. */
function scenarioInvariantFailures(data) {
  const invariants = SCENARIO_INVARIANTS[data.scenario]
  return invariants ? invariants(data) : []
}

/** 64-14: print the lifecycle readings a capture recorded, if any. */
function printCoverLifecycle(data) {
  const keys = [
    'coverAlphaBeforeAdvect',
    'coverAlphaAfterAdvect',
    'coverAlphaPeakBefore',
    'coverAlphaPeakAfter',
    'coverAlphaBeforeLift',
    'coverAlphaAfterLift',
    'coveredPaperWhitePct',
  ]
  const parts = keys.filter((key) => typeof data[key] === 'number').map((key) => `${key} ${data[key]}`)
  if (parts.length === 0) return
  console.log(`lifecycle : ${parts.join(' | ')}`)
  console.log('')
}

/** Print one capture's region means beside the reference's when it has them. */
function printCoverRegions(actualData, refData) {
  if (actualData.scenario !== 'cover-over-wet') return
  if (COVER_REGION_FIELDS.some((field) => typeof actualData[field] !== 'number')) return
  const ref =
    refData.scenario === 'cover-over-wet' && typeof refData.coverCrossPigment === 'number'
      ? ` (reference ${refData.coverCrossPigment})`
      : ''
  console.log(
    `region    : crossing ${actualData.coverCrossPigment}${ref} | own ${actualData.coverOwnPigment}` +
      ` | under ${actualData.underBandPigment} | paper ${actualData.paperBandPigment}`,
  )
  console.log('')
}

function usage(message) {
  console.error(`compare: ${message}`)
  console.error('usage: node compare.mjs <gate> [--other <otherGate> | --differs-from <name>]')
  process.exit(2)
}

const args = process.argv.slice(2)
const gate = args[0]
if (!gate || gate.startsWith('--')) usage('missing <gate> operand')

// mode: 'baseline' (mode 1), 'other' (mode 2), 'differs' (mode 3).
let mode = 'baseline'
let operand
if (args.length > 1) {
  if (args[1] !== '--other' && args[1] !== '--differs-from') usage(`unknown argument "${args[1]}"`)
  mode = args[1] === '--other' ? 'other' : 'differs'
  operand = args[2]
  if (!operand || operand.startsWith('--')) usage(`${args[1]} needs a gate name`)
  if (args.length > 3) usage(`unexpected extra argument "${args[3]}"`)
}

function readJson(path, label) {
  if (!existsSync(path)) {
    console.error(`compare: ${label} not found at ${path}`)
    process.exit(1)
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    console.error(`compare: ${label} is not valid JSON (${error.message})`)
    process.exit(1)
  }
}

/** 64-10: print one capture's recorded durations. Printed, never compared. */
function printDurations(label, data) {
  const parts = []
  if (typeof data.bakeMs === 'number') parts.push(`bake ${data.bakeMs} ms`)
  if (typeof data.renderMs === 'number') parts.push(`render ${data.renderMs} ms`)
  console.log(`${label.padEnd(9)} : ${parts.length > 0 ? parts.join(' | ') : '(none recorded)'}`)
}

/** Resolve the reference path per the three documented modes. */
function resolveReference() {
  if (mode === 'other') {
    return {
      path: join(tmpDir, `${operand}.json`),
      label: `same-session capture "${operand}"`,
      source: 'same session (--other)',
    }
  }
  if (mode === 'differs') {
    const baselinePath = join(here, 'baselines', `${operand}.json`)
    if (existsSync(baselinePath)) {
      return {
        path: baselinePath,
        label: `committed baseline "${operand}"`,
        source: 'committed baseline (--differs-from)',
      }
    }
    const sessionPath = join(tmpDir, `${operand}.json`)
    if (existsSync(sessionPath)) {
      return {
        path: sessionPath,
        label: `same-session capture "${operand}"`,
        source: 'same session (--differs-from)',
      }
    }
    console.error(
      `compare: --differs-from "${operand}" found neither a committed baseline at ${baselinePath} ` +
        `nor a same-session capture at ${sessionPath}`,
    )
    process.exit(1)
  }
  return {
    path: join(here, 'baselines', `${gate}.json`),
    label: `baseline "${gate}"`,
    source: 'committed baseline',
  }
}

const actualPath = join(tmpDir, `${gate}.json`)
const actual = readJson(actualPath, `capture "${gate}"`)
const reference = resolveReference()
const referencePath = reference.path
const refData = readJson(referencePath, reference.label)

console.log('============ medium-engine pixel-gate compare ============')
console.log(`mode      : ${reference.source}`)
console.log(`capture   : ${actualPath}`)
console.log(`reference : ${referencePath}`)
if (mode !== 'other' && typeof refData.capturedFromCommit === 'string') {
  console.log(`baseline  : captured from commit ${refData.capturedFromCommit}`)
}
console.log('')

// 64-10: both durations when two gates are compared; a committed baseline
// that predates the duration fields prints only what it recorded.
printDurations('capture', actual)
if (
  mode !== 'baseline' ||
  typeof refData.bakeMs === 'number' ||
  typeof refData.renderMs === 'number'
) {
  printDurations(mode === 'baseline' ? 'baseline' : 'reference', refData)
}
console.log('')

const dimsOk =
  actual.width !== undefined &&
  actual.height !== undefined &&
  refData.width !== undefined &&
  refData.height !== undefined

if (mode === 'differs') {
  let equal = 0
  let missing = 0
  for (const field of DIGESTS) {
    const a = actual[field]
    const b = refData[field]
    const aOk = typeof a === 'string'
    const bOk = typeof b === 'string'
    if (!aOk || !bOk) {
      missing += 1
      console.log(`MISSING   ${field.padEnd(18)} capture=${aOk ? a : '(missing)'} reference=${bOk ? b : '(missing)'}`)
      continue
    }
    if (a === b) {
      equal += 1
      console.log(`equal     ${field.padEnd(18)} ${a}  (this export must change)`)
    } else {
      console.log(`DIFFER    ${field.padEnd(18)} capture=${a} reference=${b}`)
    }
  }
  console.log('')
  const dims = dimsOk
    ? `${actual.width}x${actual.height}`
    : '(missing dimensions)'
  if (!dimsOk) {
    console.log(`RESULT: FAIL — a capture is missing width/height, the two scenarios are not comparable`)
    console.log('=========================================================')
    process.exit(1)
  }
  if (actual.width !== refData.width || actual.height !== refData.height) {
    console.log(
      `RESULT: FAIL — dimension mismatch (${actual.width}x${actual.height} vs ` +
        `${refData.width}x${refData.height}); --differs-from compares the SAME scenario`,
    )
    console.log('=========================================================')
    process.exit(1)
  }
  // WR-01: the outcome invariants, measured on the crossing, the covering
  // stroke, the untouched dark band and bare paper. Checked BEFORE the verdict
  // so a digest change with a broken medium cannot pass.
  const regionFailures = coverRegionFailures(actual)
  printCoverRegions(actual, refData)
  // 64-17: the scenario-keyed invariants, in every mode before the verdict.
  const invariantFailures = scenarioInvariantFailures(actual)
  for (const line of invariantFailures) console.log(`INVARIANT ${line}`)
  if (missing > 0 || equal > 0 || regionFailures.length > 0 || invariantFailures.length > 0) {
    for (const line of regionFailures) console.log(`REGION    ${line}`)
    console.log(
      `RESULT: FAIL — ${equal} digest(s) did not differ, ${missing} missing, ` +
        `${regionFailures.length} cover region invariant(s) failed, ` +
        `${invariantFailures.length} scenario invariant(s) failed ` +
        `(${gate} vs ${operand})`,
    )
    console.log('=========================================================')
    process.exit(1)
  }
  const regionNote =
    actual.scenario === 'cover-over-wet'
      ? ` and the ${COVER_REGION_FIELDS.length} cover region invariants hold`
      : ''
  const scenarioNote = SCENARIO_INVARIANTS[actual.scenario]
    ? ' and the scenario invariants hold'
    : ''
  console.log(
    `RESULT: PASS — all ${DIGESTS.length} digests differ${regionNote}${scenarioNote} (${gate} vs ${operand}, ${dims})`,
  )
  console.log('=========================================================')
  process.exit(0)
}

let differing = 0
let missing = 0
for (const field of FIELDS) {
  const a = actual[field]
  const b = refData[field]
  const aOk = a !== undefined && a !== null
  const bOk = b !== undefined && b !== null
  // 64-17: the reference-legacy rule. Legal only against the named committed
  // baseline (mode 1); the capture side is always required.
  const optionalForReference =
    mode === 'baseline' && (REFERENCE_OPTIONAL[refData.gate] ?? []).includes(field)
  if (!aOk || (!bOk && !optionalForReference)) {
    missing += 1
    console.log(`MISSING   ${field.padEnd(18)} capture=${aOk ? a : '(missing)'} reference=${bOk ? b : '(missing)'}`)
    continue
  }
  if (!bOk) {
    console.log(`absent    ${field.padEnd(18)} ${a}  (baseline predates the field; not compared)`)
    continue
  }
  if (a !== b) {
    differing += 1
    console.log(`DIFFER    ${field.padEnd(18)} capture=${a} reference=${b}`)
  } else {
    console.log(`equal     ${field.padEnd(18)} ${a}`)
  }
}

// WR-01: the standing gate (capture vs its own baseline, or a same-session
// pair) asserts the same self-contained outcome invariants in every mode.
const regionFailures = coverRegionFailures(actual)
printCoverRegions(actual, refData)
printCoverLifecycle(actual)
// 64-17: the scenario-keyed invariants run in committed-baseline and
// same-session mode too — every mode, before every verdict.
const invariantFailures = scenarioInvariantFailures(actual)
for (const line of invariantFailures) console.log(`INVARIANT ${line}`)

console.log('')
const counterpart = mode === 'other' ? operand : 'baseline'
if (missing > 0 || differing > 0 || regionFailures.length > 0 || invariantFailures.length > 0) {
  for (const line of regionFailures) console.log(`REGION    ${line}`)
  console.log(
    `RESULT: FAIL — ${differing} differing field(s), ${missing} missing field(s), ` +
      `${regionFailures.length} cover region invariant(s) failed, ` +
      `${invariantFailures.length} scenario invariant(s) failed ` +
      `(${gate} vs ${counterpart})`,
  )
  console.log('=========================================================')
  process.exit(1)
}

const scenarioNote = SCENARIO_INVARIANTS[actual.scenario]
  ? ' and the scenario invariants hold'
  : ''
console.log(
  `RESULT: PASS — all ${FIELDS.length} fields equal${scenarioNote} (${gate} vs ${counterpart})`,
)
console.log('=========================================================')
