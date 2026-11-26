#!/usr/bin/env node
// ============================================================
//  compare.mjs — the medium-engine pixel-gate comparator.
//
//  Three modes, all used by this phase and every later gate:
//
//   1. Committed-baseline equality
//        node compare.mjs <gate>
//      Compares /tmp/medium-engine/<gate>.json against the committed
//      probe/medium-engine/baselines/<gate>.json on every recorded digest,
//      the byte length, the dimensions and the five alpha-law fields (64-31).
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
//  64-17: FIELDS gains `digestPigment` — the mode-4 compositor sheet. The
//  field is strict in EVERY mode except one named reference: `neutral-identity`
//  was captured from commit d1fd7ea3, before the pigment export existed, so its
//  missing field prints as `absent` and is not compared. The exception is
//  consulted only when the REFERENCE is the committed baseline (mode 1) — a
//  capture-side omission is still a missing field, and --other stays strict, so
//  the legacy allowance can never launder a same-session regression. DIGESTS
//  stays the three exported backgrounds: --differs-from keeps asserting those,
//  not the sheet that must change with them.
//
//  64-31 states the shipped alpha law (2026-11-21) once, here and in probe.ts
//  and run.mjs: committed and exported storage alpha is OPAQUE — every export
//  carries coverage-free straight alpha and no alpha is derived from coverage;
//  coverage lives only in the coverage raster, a probe-only instrument and
//  never an export channel; and the display alpha is the DARKNESS of the
//  visible pigment (alpha = 1 − min(rgb) of the compositor view), never
//  composed with a coverage term. `alphaLawFailures` enforces both halves on
//  EVERY capture in EVERY mode: the opaque-export block must report 255 on the
//  surface it names, and a non-bristle capture's `visibleAlphaMaxDelta` must
//  stay within one 8-bit step (the bristle captures report the check as
//  skipped with their film-blur reason). The five law fields are also part of
//  FIELDS, so a capture cannot silently drop them.
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
//  must keep at least 90% of its crossing coverage across the eight extra wet
//  ticks (mass preserved), must not raise the peak (spread, not sharpen),
//  must stay at or above 0.60 (still covering) and must raise no
//  covered-paper-white. 64-31: every reading comes from the coverage raster
//  itself — the only channel that carries coverage.
//
//  64-14 also adds `'cover-lift'`: Lift peels the covering stroke's opacity,
//  so the crossing must read at least 0.90 before the lift stroke, fall to at
//  most 60% of that value after it, and still raise no covered-paper-white.
//
//  64-23 adds `'bristle-edge'`: two Feather-0/100 strokes on one sheet, and
//  the census's named degeneracies (`edgeFailures`) fail verbatim. The barred
//  relations are the census's meaning — both softnesses positive, the
//  Feather-100 softness strictly wider (D-22's direction), both variations
//  non-zero (the edge is brushed, not a smooth band), and the wide softness
//  narrower than the measured edge half-width. The absolute pixel widths are
//  recorded in the SUMMARY, never gated: they are measurements, not contract.
//
//  64-24 adds `'bristle-wet'`: the wetness acceptance on one sheet and one
//  brush — a fresh crossing over a right-hand band versus a thirty-second-old,
//  re-wetted crossing over a left-hand band. Both pickup means must be finite,
//  positive and inside [0, 255], and their gap must reach PICKUP_MIN_DELTA,
//  derived at half the recorded gap of the committed `bristle-wet-1080`
//  capture (199.52 luma): a response collapsed to a fraction of what the age
//  gate recorded is not the feature (64-28, IN-07). The direction is recorded
//  evidence, never asserted. The A/B is a capture comparison (`--differs-from`
//  against the `--wet-mode 0` proxy), never a committed baseline.
//
//  quick 261123-hr5 adds a self-contained mode:
//        node compare.mjs <gate> --relief-smooth
//  It reads ONLY the capture's own six signed-emboss readings
//  (reliefMean/reliefPeak/pigmentMean, before and after the smoothing pass)
//  and asserts the relation: the +15 impasto landed (reliefMeanBefore > 0);
//  a normal negative pass at least HALVES the band mean
//  (reliefMeanAfter <= reliefMeanBefore * 0.5); it never raises the peak
//  (reliefPeakAfter <= reliefPeakBefore — the erode subtracts, it cannot
//  add); and the paint is KEPT (pigmentMeanAfter >= pigmentMeanBefore * 0.9 —
//  the standing contrast with Lift, which erases it). No baseline and no
//  other capture is read; the alpha law still runs on the capture. The same
//  mode name is the one operand that takes no gate name, so `--relief-smooth`
//  can never be mistaken for `--other`.
//  `--other` additionally compares those six readings FIELD FOR FIELD when
//  BOTH captures carry them, so an a/b replay of the negative stroke is
//  proven to reproduce its numbers, not just its digests.
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
const FIELDS = [...DIGESTS, 'digestPigment', 'byteLength', 'width', 'height', 'opaqueExportMinAlpha', 'opaqueExportMinAlphaSurface', 'visibleAlphaMaxDelta', 'visibleAlphaSamples', 'visibleAlphaWorstAt']

// quick 261123-hr5: the six signed-emboss readings an `emboss-smooth` capture
// carries (probe.ts embossSmoothReport). The self-contained relation reads them
// all; `--other` compares them field for field when both sides have them.
const RELIEF_SMOOTH_FIELDS = [
  'reliefMeanBefore',
  'reliefPeakBefore',
  'pigmentMeanBefore',
  'reliefMeanAfter',
  'reliefPeakAfter',
  'pigmentMeanAfter',
]

// 64-17: the one committed baseline captured before the pigment export
// existed. `absent` is legal for these fields on the REFERENCE side only —
// never for the capture, and never outside committed-baseline mode.
const REFERENCE_OPTIONAL = { 'neutral-identity': ['digestPigment'] }

// 64-31: the two alpha-law blocks every capture carries (probe.ts). Listed
// here so a capture that omits one fails BY NAME, and so the comparator can
// never read `undefined` as a satisfied bar.
const ALPHA_LAW_OPAQUE_FIELDS = ['opaqueExportMinAlpha', 'opaqueExportMinAlphaSurface']
const ALPHA_LAW_VISIBLE_FIELDS = ['visibleAlphaMaxDelta', 'visibleAlphaSamples', 'visibleAlphaWorstAt']
// The two slots a skipped (bristle) visible-alpha check records as null.
const ALPHA_LAW_NULLABLE_FIELDS = new Set(['visibleAlphaMaxDelta', 'visibleAlphaWorstAt'])
const ALPHA_LAW_MAX_DELTA = 1 // one 8-bit step: the law is exact up to rounding

/**
 * 64-31: the shipped alpha law enforced on a capture, in EVERY mode.
 *
 * OPAQUE — committed and exported storage alpha is OPAQUE: the opaque-export
 * check's minimum must be the 8-bit maximum 255, and a failure names the
 * surface that carried the translucency.
 *
 * DISPLAY — the display alpha is the DARKNESS of the visible pigment: a
 * non-bristle capture's `visibleAlphaMaxDelta` (pigment alpha vs the
 * transparent export's `255 − min(rgb)` on the same pixels) must stay within
 * one step, and a failure names the step count and the worst coordinate. A
 * bristle capture instead reports the check as skipped with its film-blur
 * reason; skipping it on any other scenario fails.
 */
function alphaLawFailures(data) {
  const failures = []
  const opaqueMissing = ALPHA_LAW_OPAQUE_FIELDS.filter((field) => !(field in data))
  if (opaqueMissing.length > 0) {
    failures.push(
      `capture is missing ${opaqueMissing.join(', ')}; re-run the probe ` +
        '(every capture carries the opaque-export law block)',
    )
  } else if (data.opaqueExportMinAlpha !== 255) {
    failures.push(
      `opaqueExportMinAlpha ${data.opaqueExportMinAlpha} on the ${data.opaqueExportMinAlphaSurface} ` +
        'surface is not the opaque maximum 255 (committed and exported storage alpha is OPAQUE)',
    )
  }
  const visibleMissing = ALPHA_LAW_VISIBLE_FIELDS.filter((field) => !(field in data))
  if (visibleMissing.length > 0) {
    failures.push(
      `capture is missing ${visibleMissing.join(', ')}; re-run the probe ` +
        '(every capture carries the visible-alpha law block)',
    )
    return failures
  }
  // Spec 10 (261125-kvl): `edge-layer` is a bristle scene (bristle-round,
  // Body 100) and carries the same film-blur exclusion. 261126-hgl adds
  // `edge-rim` (the artist's short stroke on the blue wash) — same brush,
  // same exclusion. The probe's skip predicate carries the identical
  // three-clause test; a drift between the two makes every layer capture
  // fail here by construction.
  const bristle =
    String(data.scenario).startsWith('bristle-') || data.scenario === 'edge-layer' ||
    data.scenario === 'edge-rim'
  if (bristle) {
    if (typeof data.visibleAlphaSkip !== 'string' || data.visibleAlphaSkip.length === 0) {
      failures.push(
        'capture is missing visibleAlphaSkip; a bristle capture must report why the ' +
          'visible-alpha check was skipped (the film-blur exclusion)',
      )
    } else if (data.visibleAlphaMaxDelta !== null || data.visibleAlphaSamples !== 0) {
      failures.push(
        `a bristle capture reports visibleAlphaMaxDelta ${data.visibleAlphaMaxDelta} / ` +
          `visibleAlphaSamples ${data.visibleAlphaSamples} beside its skip ` +
          '(a skipped check records no delta and no samples)',
      )
    }
    return failures
  }
  if (
    data.visibleAlphaMaxDelta === null ||
    data.visibleAlphaSamples === 0 ||
    typeof data.visibleAlphaSkip === 'string'
  ) {
    failures.push(
      'the visible-alpha check cannot be skipped for this scenario ' +
        `(visibleAlphaSkip ${JSON.stringify(data.visibleAlphaSkip)}, ` +
        `visibleAlphaMaxDelta ${data.visibleAlphaMaxDelta})`,
    )
  } else if (!(typeof data.visibleAlphaMaxDelta === 'number' && data.visibleAlphaMaxDelta <= ALPHA_LAW_MAX_DELTA)) {
    failures.push(
      `visibleAlphaMaxDelta ${data.visibleAlphaMaxDelta} steps at ${data.visibleAlphaWorstAt} ` +
        'exceeds one 8-bit step (the display alpha is not the darkness of the visible pigment)',
    )
  }
  return failures
}

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
 * Spike 001 criterion 1 as a standing gate. `crossCoverage` is the coverage
 * raster's mean coverage over the crossing (64-31: never the pigment export's
 * alpha, which since the 2026-11-21 law is darkness alone); `crossDarkAlpha`
 * is the alpha the pre-coverage commit would have derived from the transparent
 * sheet, so the gap is the coverage model's contribution beyond the darkness
 * conversion. A capture missing the coverage readings fails by name rather
 * than passing with a vacuum where a measurement belongs.
 */
function whiteOverBlueFailures(data) {
  const fields = [
    'crossR',
    'crossG',
    'crossB',
    'crossBlueExcess',
    'crossCoverage',
    'crossDarkAlpha',
    'coveredPaperWhitePct',
  ]
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the white-over-blue probe`]
  }
  if (!('coveredPaperWhiteBox' in data)) {
    return [
      'capture is missing the covered-paper-white census block (coveredPaperWhiteBox); ' +
        're-run the white-over-blue probe',
    ]
  }
  const gap = data.crossCoverage - data.crossDarkAlpha
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
        `crossCoverage - crossDarkAlpha ${round2(gap)} is below 0.60 ` +
          '(the coverage raster reports no coverage beyond the darkness conversion)',
      )
    }
    if (!(data.crossCoverage >= 0.9)) {
      failures.push(
        `crossCoverage ${data.crossCoverage} is below 0.90 ` +
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
    if (!(data.crossCoverage < 0.5)) {
      failures.push(
        `crossCoverage ${data.crossCoverage} is not below 0.50 ` +
          '(the partial cover went opaque)',
      )
    }
    if (!(gap >= 0.04)) {
      failures.push(
        `crossCoverage - crossDarkAlpha ${round2(gap)} is below 0.04 ` +
          '(the coverage raster reports no contribution at Body 60)',
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
        `crossCoverage - crossDarkAlpha ${round2(gap)} is above 0.03 ` +
          '(the coverage raster must read inert at Body 30)',
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
 * `coverCoveragePeakBefore` / `coverCoveragePeakAfter` bracket the eight extra
 * wet ticks the probe runs between its two captures. 64-31: the readings come
 * from the coverage raster itself, never from a pigment export's alpha.
 */
function coverAdvectFailures(data) {
  const fields = [
    'coverCoverageBeforeAdvect',
    'coverCoverageAfterAdvect',
    'coverCoveragePeakBefore',
    'coverCoveragePeakAfter',
    'coveredPaperWhitePct',
  ]
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the cover-advect probe`]
  }
  const failures = []
  if (!(data.coverCoverageAfterAdvect >= 0.9 * data.coverCoverageBeforeAdvect)) {
    failures.push(
      `coverCoverageAfterAdvect ${data.coverCoverageAfterAdvect} lost more than 10% of ` +
        `coverCoverageBeforeAdvect ${data.coverCoverageBeforeAdvect} (the field lost mass)`,
    )
  }
  if (!(data.coverCoveragePeakAfter <= data.coverCoveragePeakBefore)) {
    failures.push(
      `coverCoveragePeakAfter ${data.coverCoveragePeakAfter} is above coverCoveragePeakBefore ` +
        `${data.coverCoveragePeakBefore} (advection sharpened the field)`,
    )
  }
  if (!(data.coverCoverageAfterAdvect >= 0.6)) {
    failures.push(
      `coverCoverageAfterAdvect ${data.coverCoverageAfterAdvect} is below 0.60 ` +
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
 * lift stroke across a fresh covering stroke must take the crossing coverage
 * to at most 60% of its pre-lift value, and no covered texel may read as
 * paper. 64-31: both readings come from the coverage raster.
 */
function coverLiftFailures(data) {
  const fields = ['coverCoverageBeforeLift', 'coverCoverageAfterLift', 'coveredPaperWhitePct']
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the cover-lift probe`]
  }
  const failures = []
  if (!(data.coverCoverageBeforeLift >= 0.9)) {
    failures.push(
      `coverCoverageBeforeLift ${data.coverCoverageBeforeLift} is below 0.90 (the covering stroke never covered)`,
    )
  }
  if (!(data.coverCoverageAfterLift <= 0.6 * data.coverCoverageBeforeLift)) {
    failures.push(
      `coverCoverageAfterLift ${data.coverCoverageAfterLift} is above 60% of coverCoverageBeforeLift ` +
        `${data.coverCoverageBeforeLift} (Lift did not reduce coverage)`,
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
 * The plan's provisional band was `coverCoverageP90 >= 0.5` (reported then
 * under the pre-64-31 name `coverAlphaP90`). The first
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
 * SPREAD, not a solid disc. On the COVERAGE distribution over the covering
 * diagonal's mid-sheet box (64-31: the coverage raster, never a pigment
 * export's alpha): the calibrated high decile, a low decile (P10 <= 0.5), a
 * covered share inside [0.02, 0.80], at most 5 units of blue excess at the
 * crossing, and no covered texel reading as bare paper. The first four bands
 * are the calibration envelope, set from the first capture's measured
 * distribution (recorded in the 64-16 SUMMARY); `coveredPaperWhitePct === 0`
 * is the model's absolute contract and is never calibratable.
 */
function coverTexturedFailures(data) {
  const fields = [
    'coverCoverageP10',
    'coverCoverageP90',
    'coverCoverageCoveredFraction',
    'coverCrossBlueExcess',
    'coveredPaperWhitePct',
  ]
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the cover-textured probe`]
  }
  const failures = []
  if (!(data.coverCoverageP90 >= COVER_TEXTURED_P90_FLOOR)) {
    failures.push(
      `coverCoverageP90 ${data.coverCoverageP90} is below the calibrated floor ` +
        `${COVER_TEXTURED_P90_FLOOR} (the tip deposited nothing)`,
    )
  }
  if (!(data.coverCoverageP10 <= 0.5)) {
    failures.push(
      `coverCoverageP10 ${data.coverCoverageP10} is above 0.50 ` +
        '(every sampled texel is covered: the textured tip reads as a solid disc)',
    )
  }
  if (!(data.coverCoverageCoveredFraction >= 0.02 && data.coverCoverageCoveredFraction <= 0.8)) {
    failures.push(
      `coverCoverageCoveredFraction ${data.coverCoverageCoveredFraction} is outside [0.02, 0.80] ` +
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

/**
 * 64-16: Spike 001 criterion 2 as standing invariants — 50 rapid red strokes
 * over a dried blue field must keep at least 95% of a fresh-red reference
 * stroke's luma and stay within 3 signed degrees of its hue, with no covered
 * texel reading as bare paper. The reference paints on clean paper ON THE
 * SAME SHEET, so the ratio cancels the engine's paper and light. No latency
 * pin: the spike's p95 finding was a shared sim stall, not a model cost, and
 * a timing threshold in a committed gate is a flaky gate.
 */
function redOverBlueFailures(data) {
  const fields = ['finalLuma', 'referenceLuma', 'lumaRatio', 'deltaHue', 'coveredPaperWhitePct']
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the red-over-blue-50 probe`]
  }
  const failures = []
  if (!(data.lumaRatio >= 0.95)) {
    failures.push(
      `lumaRatio ${data.lumaRatio} below 0.95 ` +
        `(finalLuma ${data.finalLuma} vs referenceLuma ${data.referenceLuma}: the field darkened)`,
    )
  }
  if (!(Math.abs(data.deltaHue) <= 3)) {
    failures.push(
      `deltaHue ${data.deltaHue} exceeds ±3 degrees ` +
        '(the field hue drifted from the fresh-red reference)',
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
 * 64-23: the bristle-edge census as standing invariants. On the PIGMENT
 * export's mode-4 alpha the census measures, per stroke, the median 90 %-10 %
 * transition width ("softness") and the P90-P10 spread of the 50 % crossing
 * ("variation") in document pixels, plus the measured edge half-width and
 * each stroke's interior plateau. The gate asserts the RELATION facts, never
 * the absolute pixels (the SUMMARY records those; they are measurements, not
 * contract): both softnesses finite and > 0 (an edge exists), the Feather-100
 * softness strictly wider than the Feather-0 one (D-22's direction — a
 * feather-blind edge fails here), both variations > 0 (the edge is brushed,
 * not a mathematically smooth band), and the wide softness narrower than the
 * measured half-width (the band is an edge, not the whole stroke). A
 * non-empty `edgeFailures` array is the probe's own named degeneracy (stroke
 * not found, a station with fewer than three crossings) and fails verbatim.
 *
 * 64-29 adds the four shape scalars per Feather level, derived by the probe in
 * one shared pass (`edgeProfileStats`): irregularity (median |Δ| of the 50 %
 * crossing position between adjacent stations), roughness (median |Δ²|),
 * support (median distance from the crossing to the outermost row above 2 %
 * of the plateau) and fringe density (share of measured stations whose
 * support clears one device pixel). Bars, at BOTH levels:
 * - irregularity > 0 — "a ruler-straight crossing" is a synthetic edge, not a
 *   brushed one; 24 stations landing on one position means the stroke is not
 *   being measured.
 * - support > 0 — an edge with "no fringe beyond the crossing" is a binary
 *   cross-fade; the medium's deposit must carry a gradient past the 50 %.
 * - roughness finite and >= 0, and NOTHING ELSE: "is not a finite non-negative
 *   roughness" is the only failure text the gate owns here. Pinning a ceiling
 *   now would freeze a guess into a committed gate before the engine law that
 *   fixes it — 64-34 owns the roughness ceiling (sequencing, not an implicit
 *   bar).
 * - fringe density within [0, 100] — it is a percentage of measured stations.
 * The per-stroke half-widths (`edgeHalfWidthPxFeather0/100`) are required
 * numbers beside the compatibility mean; they are recorded evidence, not a
 * bar.
 */
function bristleEdgeFailures(data) {
  const fields = [
    'edgeSoftnessPxFeather0',
    'edgeSoftnessPxFeather100',
    'edgeVariationPxFeather0',
    'edgeVariationPxFeather100',
    'edgeIrregularityPxFeather0',
    'edgeIrregularityPxFeather100',
    'edgeRoughnessPxFeather0',
    'edgeRoughnessPxFeather100',
    'edgeSupportPxFeather0',
    'edgeSupportPxFeather100',
    'edgeFringeDensityPctFeather0',
    'edgeFringeDensityPctFeather100',
    'edgeHalfWidthPx',
    'edgeHalfWidthPxFeather0',
    'edgeHalfWidthPxFeather100',
  ]
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the bristle-edge probe`]
  }
  if (!Array.isArray(data.edgeFailures)) {
    return ['capture is missing edgeFailures; re-run the bristle-edge probe']
  }
  const failures = data.edgeFailures.map((line) => String(line))
  if (!(data.edgeSoftnessPxFeather0 > 0)) {
    failures.push(
      `edgeSoftnessPxFeather0 ${data.edgeSoftnessPxFeather0} is not a positive width ` +
        '(the Feather-0 edge is missing)',
    )
  }
  if (!(data.edgeSoftnessPxFeather100 > 0)) {
    failures.push(
      `edgeSoftnessPxFeather100 ${data.edgeSoftnessPxFeather100} is not a positive width ` +
        '(the Feather-100 edge is missing)',
    )
  }
  if (!(data.edgeSoftnessPxFeather100 > data.edgeSoftnessPxFeather0)) {
    failures.push(
      `edgeSoftnessPxFeather100 ${data.edgeSoftnessPxFeather100} is not wider than ` +
        `edgeSoftnessPxFeather0 ${data.edgeSoftnessPxFeather0} (Feather is not widening the band)`,
    )
  }
  if (!(data.edgeVariationPxFeather0 > 0)) {
    failures.push(
      `edgeVariationPxFeather0 ${data.edgeVariationPxFeather0} is 0 ` +
        '(the Feather-0 edge is perfectly smooth: not a brushed edge)',
    )
  }
  if (!(data.edgeVariationPxFeather100 > 0)) {
    failures.push(
      `edgeVariationPxFeather100 ${data.edgeVariationPxFeather100} is 0 ` +
        '(the Feather-100 edge is perfectly smooth: not a brushed edge)',
    )
  }
  if (!(data.edgeSoftnessPxFeather100 < data.edgeHalfWidthPx)) {
    failures.push(
      `edgeSoftnessPxFeather100 ${data.edgeSoftnessPxFeather100} is not narrower than ` +
        `edgeHalfWidthPx ${data.edgeHalfWidthPx} (the band is not an edge but the stroke)`,
    )
  }
  if (!(data.edgeIrregularityPxFeather0 > 0)) {
    failures.push(
      `edgeIrregularityPxFeather0 ${data.edgeIrregularityPxFeather0} is 0 ` +
        '(a ruler-straight crossing: every station landed on the same position)',
    )
  }
  if (!(data.edgeIrregularityPxFeather100 > 0)) {
    failures.push(
      `edgeIrregularityPxFeather100 ${data.edgeIrregularityPxFeather100} is 0 ` +
        '(a ruler-straight crossing: every station landed on the same position)',
    )
  }
  if (!(data.edgeSupportPxFeather0 > 0)) {
    failures.push(
      `edgeSupportPxFeather0 ${data.edgeSupportPxFeather0} is 0 ` +
        '(the Feather-0 edge has no fringe beyond the crossing: a binary cross-fade)',
    )
  }
  if (!(data.edgeSupportPxFeather100 > 0)) {
    failures.push(
      `edgeSupportPxFeather100 ${data.edgeSupportPxFeather100} is 0 ` +
        '(the Feather-100 edge has no fringe beyond the crossing: a binary cross-fade)',
    )
  }
  if (!(Number.isFinite(data.edgeRoughnessPxFeather0) && data.edgeRoughnessPxFeather0 >= 0)) {
    failures.push(
      `edgeRoughnessPxFeather0 ${data.edgeRoughnessPxFeather0} is not a finite non-negative roughness ` +
        '(the derivation or the capture is broken; 64-34 owns the roughness ceiling)',
    )
  }
  if (!(Number.isFinite(data.edgeRoughnessPxFeather100) && data.edgeRoughnessPxFeather100 >= 0)) {
    failures.push(
      `edgeRoughnessPxFeather100 ${data.edgeRoughnessPxFeather100} is not a finite non-negative roughness ` +
        '(the derivation or the capture is broken; 64-34 owns the roughness ceiling)',
    )
  }
  for (const level of ['Feather0', 'Feather100']) {
    const density = data[`edgeFringeDensityPct${level}`]
    if (!(density >= 0 && density <= 100)) {
      failures.push(
        `edgeFringeDensityPct${level} ${density} is outside [0, 100] ` +
          '(a share of measured stations cannot exceed 100 %)',
      )
    }
  }
  return failures
}

/**
 * 64-24: the wetness acceptance as standing invariants. `pickupFreshMean` and
 * `pickupAgedWetMean` are mean film darkness (0..255, transparent export) over
 * the crossing region of the FRESH right band and of the thirty-second-old,
 * re-wetted LEFT band. The gate asserts the RELATION facts, never a direction:
 * both finite and positive (the crossing deposited something on each side),
 * both inside [0, 255], and a gap of at least PICKUP_MIN_DELTA luma units —
 * the age gate must actually change the crossing, or Dry is decorative. Which
 * crossing reads darker is recorded in the SUMMARY as evidence, not asserted
 * (the two bands differ in age by construction, so the direction is a
 * measurement, not a contract).
 *
 * 64-28 (IN-07): the floor is not a decorative round number. The committed
 * `baselines/bristle-wet-1080.json` capture records pickupFreshMean 50.64
 * against pickupAgedWetMean 250.16 — a recorded gap of 199.52 luma units. A
 * response that collapses to half of that gap no longer carries the feature,
 * so the floor is derived at fifty percent. Re-authoring the baseline (a new
 * capture) REQUIRES re-deriving the floor from the new recorded pair; never
 * leave an old derivation behind a new baseline.
 */
const RECORDED_PICKUP_GAP = 199.52 // |50.64 - 250.16| in baselines/bristle-wet-1080.json
const PICKUP_MIN_DELTA = RECORDED_PICKUP_GAP / 2 // 99.76 luma units

function bristleWetFailures(data) {
  const fields = ['pickupFreshMean', 'pickupAgedWetMean']
  const missing = fields.filter((field) => typeof data[field] !== 'number')
  if (missing.length > 0) {
    return [`capture is missing ${missing.join(', ')}; re-run the bristle-wet probe`]
  }
  const fresh = data.pickupFreshMean
  const aged = data.pickupAgedWetMean
  const failures = []
  if (!Number.isFinite(fresh) || !(fresh > 0)) {
    failures.push(
      `pickupFreshMean ${fresh} is not a finite positive mean ` +
        '(the crossing deposited no film over the fresh band)',
    )
  }
  if (!Number.isFinite(aged) || !(aged > 0)) {
    failures.push(
      `pickupAgedWetMean ${aged} is not a finite positive mean ` +
        '(the crossing deposited no film over the aged band)',
    )
  }
  if (!Number.isFinite(fresh) || fresh < 0 || fresh > 255) {
    failures.push(`pickupFreshMean ${fresh} is outside [0, 255]`)
  }
  if (!Number.isFinite(aged) || aged < 0 || aged > 255) {
    failures.push(`pickupAgedWetMean ${aged} is outside [0, 255]`)
  }
  if (!(Math.abs(fresh - aged) >= PICKUP_MIN_DELTA)) {
    failures.push(
      `|pickupFreshMean ${fresh} - pickupAgedWetMean ${aged}| is below ${PICKUP_MIN_DELTA} luma ` +
        `(derived as half the recorded ${RECORDED_PICKUP_GAP}-luma gap of bristle-wet-1080; ` +
        'the age gate did not change the crossing: Dry is not load-bearing)',
    )
  }
  return failures
}

/**
 * 2026-11-22 (bristle-line gate): the acrylic pale-line defect's measured
 * properties, read from the three drive surfaces (`lineSurfaces`). UAT row 12
 * names two of them — a hard rim line and a pale halo — and the enclosure scan
 * names the third (a pale lane INSIDE the stroke's support).
 *
 * RIM — per side, the interior plateau's median darkness, the outward 90→10 %
 * band width and the worst adjacent-row step inside the outer third of the
 * band. Bars:
 *   RIM_MIN_BAND_PX = 2 at the 1080 capture scale: one device pixel of cliff
 *     IS a line (the artist's "hard line"); two pixels of falloff IS a blend.
 *   RIM_MAX_STEP_FRACTION = 0.5 of the plateau: the largest adjacent change a
 *     graded fringe can carry without reading as a step.
 * HEAD at 2026-11-22 reads 3.74 px / 5.60 px bands and 0.194 / 0.219 of the
 * plateau steps — both bars PASS; the bare gate's HEAD failure is the halo.
 *
 * HALO — per side, the peak darkness beyond the 50 % crossing RELATIVE to the
 * plateau, its mean over the fringe, and the longest run of fringe rows above
 * 5 % of the plateau. The probe clamps the fringe to the stroke's own outward
 * 2 %-of-plateau extent, so a wet understory (the `--over` variant) can never
 * masquerade as the line's halo: the understory is pressed at the lightest
 * touch and spread as one wide sweep, so its own visible film tops out at
 * 0.011 darkness = 1.8 % of the 0.622 plateau — below the clamp — and the
 * bare and `--over` halo readings are identical (recorded below).
 *   HALO_PEAK_MAX = 0.4: a graded fringe's first row beyond the half-crossing
 *     cannot still read 40 % of the plateau.
 *   HALO_RUN_FRACTION = 0.05, HALO_RUN_MAX = 2 rows: at most two consecutive
 *     fringe rows may carry a measurable film above 5 % of the plateau.
 * HEAD reads peak 0.4628 / 0.4493 and run 3 / 4 — the pale ring UAT row 12
 * names, failing at HEAD.
 *
 * ENCLOSED — the tiling block's own enclosed-line scan (a row paler than its
 * ±4..8 px neighbours on BOTH sides). A pale line INSIDE the support is the
 * UAT row-3 writer; bare paper cannot produce one.
 *   ENCLOSED_MEAN_MAX_PCT = 0.5 is half a luma step of 255 — the smallest
 *     mean prominence that is a film difference rather than quantisation.
 *   ENCLOSED_FRAC_MAX_PCT = 25 is a quarter of the sampled central half — a
 *     line, not a fibre.
 *   ENCLOSED_MAX_RUN_PX = 16 is the station half-width — a run longer than a
 *     station is a lane.
 * HEAD reads mean 0 % / frac 0 % / runs 0 / max-run 0 px on the bare capture
 * and mean 0.3 % / frac 1.85 % / runs 2 / max-run 8 px on the `--over`
 * capture — both pass every enclosure bar (the understory only registers as
 * faint fringe structure); the gate's HEAD failure is the halo, not an
 * enclosed line.
 *
 * Recorded HEAD readings, 2026-11-22, `--size 1080`, Body 0, stroke size 12 —
 * byte-identical on postApply / postSettle / postFix:
 *   bare `bristle-line`        interior [-17, 18] px, peakCover 0.409
 *     rim.down   plateau 0.6221  bandPx 3.74    step 0.1207 @ -19
 *     rim.up     plateau 0.6288  bandPx 5.60    step 0.1378 @ +20
 *     halo.down  peakRel 0.4628  mean 0.1157  run 3  peakAt -18
 *     halo.up    peakRel 0.4493  mean 0.1184  run 4  peakAt +19
 *     enclosed   offset 56  meanPct 0  fracPct 0  runs 0  maxRunPx 0
 *   `--over` `bristle-line-over` interior [-17, 18] px, peakCover 0.409
 *     rim / halo identical to the bare capture above (the understory's own
 *                  film stays under the 2 % clamp; its brightest visible row
 *                  is 0.011 darkness at offset +48)
 *     enclosed   offset 69  meanPct 0.3  fracPct 1.85  runs 2  maxRunPx 8
 *
 * The harness pins the metric labels these numbers move with, so a re-record
 * is deliberate, never silent.
 */
const RIM_MIN_BAND_PX = 2
const RIM_MAX_STEP_FRACTION = 0.5
const HALO_PEAK_MAX = 0.4
const HALO_RUN_FRACTION = 0.05
const HALO_RUN_MAX = 2
const ENCLOSED_MEAN_MAX_PCT = 0.5
const ENCLOSED_FRAC_MAX_PCT = 25
const ENCLOSED_MAX_RUN_PX = 16

const LINE_SURFACES = ['postApply', 'postSettle', 'postFix']

function bristleLineFailures(data) {
  const surfaces = data.lineSurfaces
  if (surfaces === null || typeof surfaces !== 'object' || Array.isArray(surfaces)) {
    return ['capture is missing lineSurfaces; re-run the bristle-line probe']
  }
  const failures = []
  for (const name of LINE_SURFACES) {
    const surface = surfaces[name]
    if (surface === null || typeof surface !== 'object') {
      failures.push(`lineSurfaces.${name} is missing (the capture recorded no ${name} profile)`)
      continue
    }
    if (!(typeof surface.peakCover === 'number' && surface.peakCover > 0)) {
      failures.push(
        `${name}: peakCover ${surface.peakCover} is not a positive coverage peak ` +
          '(the line deposited no coverage)',
      )
    }
    const span = surface.interior && surface.interior.span
    if (
      !Array.isArray(span) ||
      span.length !== 2 ||
      typeof span[0] !== 'number' ||
      typeof span[1] !== 'number' ||
      !(span[1] > span[0])
    ) {
      failures.push(
        `${name}: interior.span ${JSON.stringify(span)} is missing or degenerate ` +
          '(a zero-width plateau cannot certify a rim)',
      )
    }
    for (const side of ['down', 'up']) {
      const rim = surface.rim && surface.rim[side]
      if (rim === null || typeof rim !== 'object') {
        failures.push(`${name}: rim.${side} is missing (no ${side} rim walk was recorded)`)
        continue
      }
      const plateau = rim.plateau
      if (!(typeof plateau === 'number' && plateau > 0)) {
        failures.push(
          `${name}: rim.${side}.plateau ${plateau} is not a positive plateau ` +
            '(the interior is degenerate)',
        )
        continue
      }
      if (typeof rim.bandPx !== 'number') {
        failures.push(`${name}: rim.${side}.bandPx is not a number (the 90-to-10 band never crossed)`)
      } else if (rim.bandPx < RIM_MIN_BAND_PX) {
        failures.push(
          `${name}: rim.${side}.bandPx ${rim.bandPx} px is under the ${RIM_MIN_BAND_PX} px floor ` +
            '(a one-device-pixel cliff, not a graded edge)',
        )
      }
      if (typeof rim.step !== 'number') {
        failures.push(`${name}: rim.${side}.step is not a number (the outer-third walk was never measured)`)
      } else if (rim.step > RIM_MAX_STEP_FRACTION * plateau) {
        failures.push(
          `${name}: rim.${side}.step ${rim.step} at ${rim.stepAt} exceeds half the plateau ` +
            `${plateau} (an unblended step, not a fringe)`,
        )
      }
      const halo = surface.halo && surface.halo[side]
      if (halo === null || typeof halo !== 'object') {
        failures.push(`${name}: halo.${side} is missing (no ${side} fringe walk was recorded)`)
        continue
      }
      if (typeof halo.peakRel !== 'number') {
        failures.push(
          `${name}: halo.${side}.peakRel is not a number ` +
            '(no fringe beyond the 50% crossing inside the 2% extent)',
        )
      } else if (halo.peakRel > HALO_PEAK_MAX) {
        failures.push(
          `${name}: halo.${side}.peakRel ${halo.peakRel} exceeds HALO_PEAK_MAX ${HALO_PEAK_MAX} ` +
            `at ${halo.peakAt} (a pale ring beyond the 50% crossing)`,
        )
      }
      if (typeof halo.mean !== 'number') {
        failures.push(`${name}: halo.${side}.mean is not a number (the fringe mean was never measured)`)
      }
      if (typeof halo.run !== 'number') {
        failures.push(`${name}: halo.${side}.run is not a number (the fringe run was never measured)`)
      } else if (halo.run > HALO_RUN_MAX) {
        failures.push(
          `${name}: halo.${side}.run ${halo.run} exceeds HALO_RUN_MAX ${HALO_RUN_MAX} rows ` +
            `above ${HALO_RUN_FRACTION} of the plateau (a halo band, not a fibre)`,
        )
      }
    }
    const enclosed = surface.tiling && surface.tiling.enclosed
    if (enclosed === null || typeof enclosed !== 'object') {
      failures.push(
        `${name}: tiling.enclosed is missing (the enclosure scan never ran; a null scan cannot pass)`,
      )
      continue
    }
    const enclosedFields = ['meanPct', 'fracPct', 'runs', 'maxRunPx']
    const enclosedMissing = enclosedFields.filter((field) => typeof enclosed[field] !== 'number')
    if (enclosedMissing.length > 0) {
      failures.push(`${name}: tiling.enclosed is missing ${enclosedMissing.join(', ')}`)
      continue
    }
    if (enclosed.meanPct > ENCLOSED_MEAN_MAX_PCT) {
      failures.push(
        `${name}: tiling.enclosed.meanPct ${enclosed.meanPct} exceeds ` +
          `${ENCLOSED_MEAN_MAX_PCT}% at ${enclosed.offset} (a pale line enclosed by paint)`,
      )
    }
    if (enclosed.fracPct > ENCLOSED_FRAC_MAX_PCT) {
      failures.push(
        `${name}: tiling.enclosed.fracPct ${enclosed.fracPct} exceeds ${ENCLOSED_FRAC_MAX_PCT}% ` +
          '(the pale line spans the stroke, not a fibre)',
      )
    }
    if (enclosed.maxRunPx > ENCLOSED_MAX_RUN_PX) {
      failures.push(
        `${name}: tiling.enclosed.maxRunPx ${enclosed.maxRunPx} exceeds ${ENCLOSED_MAX_RUN_PX} px ` +
          '(an enclosed lane, not an enclosed dot)',
      )
    }
  }
  return failures
}

/**
 * 64-29: the mask the bristle-tip scenario registers itself (probe.ts).
 *  Any other requested id is a deliberate unknown: the capture must show the
 *  engine's own fallback, never a resolved tip.
 */
const PROBE_TIP_ID = 'probe/tip-ab'
/** A masked capture must add at least this many dark bands over the plain
 *  reference. The stripes eight-band mask resolves to several bands across
 *  the dab; two is the floor that separates "the mask composed" from "the
 *  capture merely shifted by a digest-irrelevant amount". */
const TIP_BANDS_MIN_GAIN = 2
/** The echo and band numbers every bristle-tip capture must carry. Exported
 *  ids are legitimately null on the plain leg, so presence is checked as a
 *  KEY (absent ⇒ the probe never recorded it), not as a truthiness test. */
const TIP_ECHO_KEYS = ['tipRequestedId', 'tipTextureId']
const TIP_NUMBER_KEYS = ['tipMix', 'tipBands', 'tipGapPx']

/**
 * 64-29: the texture-tip A/B. Bars (each names its reason):
 *  - shape: both id echoes present (null is a legal plain-leg value; ABSENT is
 *    a capture that never recorded the echo), tipMix / tipBands / tipGapPx
 *    finite numbers, tipMix ∈ {0, 1}, tipBands ≥ 1, tipGapPx ≥ 0;
 *  - plain leg (requested null): the capture must not report a carried id —
 *    a plain capture echoing a texture id is proof the scenario wired one;
 *  - either leg: the carried id must equal the requested one; a request for
 *    the probe's own `probe/tip-ab` must resolve (tipMix 1) or the mask did
 *    not reach the brush; any id this probe never registers must fall back
 *    (tipMix 0) WITH its named note, so a silent fallback cannot pass;
 *  - A/B (only when the reference is the PLAIN bristle-tip capture and the
 *    actual is masked): the masked capture must show at least
 *    TIP_BANDS_MIN_GAIN more across-profile bands than the plain one.
 *
 * HEAD readings (2026-11-22, `--size 1080`, no baseline committed — this
 * gate is proven by same-session A/B only):
 *   bristle-tip-plain   requested null  carried null  tipMix 0  bands 1  gap 0
 *   bristle-tip-mask    requested/carried "probe/tip-ab"  tipMix 1  bands 1  gap 0
 *   bristle-tip-unknown requested/carried "probe/does-not-exist"  tipMix 0
 *                       bands 1  gap 0 — and the capture's three digests are
 *                       BYTE-IDENTICAL to the plain leg's: the engine's
 *                       fallback is proven, not assumed
 * The A/B (mask vs plain) finds 3 differing digests with equal dimensions and
 * FIRES this band bar: 1 vs 1. The mask registers (tipMix 1) and moves the
 * pixels, but adds no separated bands — the across profile is a uniformly
 * attenuated copy of the plain one at every stripe period tried (row 64/256,
 * column 64). That is 64-35's finding, recorded here for the gap-closure
 * plan; the bar stays so the failing HEAD state can never pass silently.
 */
function bristleTipFailures(data, reference) {
  const absent = [
    ...TIP_ECHO_KEYS.filter((key) => !(key in data)),
    ...TIP_NUMBER_KEYS.filter((key) => typeof data[key] !== 'number' || !Number.isFinite(data[key])),
  ]
  if (absent.length > 0) {
    return [
      `capture is missing ${absent.join(', ')}; re-run the bristle-tip probe ` +
        '(a null echo is legal on the plain leg — an absent key is not)',
    ]
  }
  const failures = []
  const requested = data.tipRequestedId
  const carried = data.tipTextureId
  if (requested !== null && typeof requested !== 'string') {
    failures.push(
      `tipRequestedId ${JSON.stringify(requested)} is neither a string nor null ` +
        '(the probe records the requested id or the plain-leg null)',
    )
  }
  if (carried !== null && typeof carried !== 'string') {
    failures.push(
      `tipTextureId ${JSON.stringify(carried)} is neither a string nor null ` +
        '(the probe records the carried id or the plain-leg null)',
    )
  }
  const mix = data.tipMix
  if (mix !== 0 && mix !== 1) {
    failures.push(`tipMix ${mix} is neither 0 nor 1 (the mix is the engine registry boolean)`)
  }
  const bands = data.tipBands
  if (!(bands >= 1)) {
    failures.push(
      `tipBands ${bands} is not a positive band count ` +
        '(a blank across profile cannot certify a tip)',
    )
  }
  const gap = data.tipGapPx
  if (!(gap >= 0)) {
    failures.push(`tipGapPx ${gap} is not a non-negative gap (px between band runs)`)
  }
  if (failures.length > 0) return failures

  if (requested === null) {
    if (carried !== null) {
      failures.push(
        `the plain capture already reports a texture id "${carried}" ` +
          '(the request carried none — the scenario supplied a mask)',
      )
    }
    return failures
  }

  if (carried !== requested) {
    failures.push(
      `the echoes disagree with the requested texture (requested "${requested}", ` +
        `carried ${carried === null ? 'null' : `"${carried}"`})`,
    )
    return failures
  }
  if (requested === PROBE_TIP_ID) {
    if (mix !== 1) {
      failures.push(
        `the probe mask did not compose: tipMix ${mix} for the registered mask ` +
          `"${PROBE_TIP_ID}" (the registry resolved it, the brush did not)`,
      )
    }
  } else if (mix === 1) {
    failures.push(
      `tipMix 1 for "${requested}", which this probe never registers ` +
        `(only "${PROBE_TIP_ID}" is registered — an unknown id must fall back)`,
    )
  } else if (typeof data.tipNote !== 'string' || data.tipNote.length === 0) {
    failures.push(
      `the capture fell back from unknown texture "${requested}" without its fallback note ` +
        '(the fallback is measured, never silent)',
    )
  }

  if (
    reference &&
    reference.scenario === 'bristle-tip' &&
    reference.tipMix === 0 &&
    mix === 1 &&
    typeof reference.tipBands === 'number' &&
    Number.isFinite(reference.tipBands) &&
    bands < reference.tipBands + TIP_BANDS_MIN_GAIN
  ) {
    failures.push(
      `the masked capture has fewer bands than the plain one: ${bands} vs ${reference.tipBands} ` +
        `(the A/B needs at least ${TIP_BANDS_MIN_GAIN} more bands from the mask)`,
    )
  }
  return failures
}

/**
 * quick 261123-hr5: the signed-emboss smoothing relation. Self-contained on the
 * capture's own readings, so the gate cannot pass by comparing two equally
 * broken runs: the impasto must land, the smoothing pass must at least halve
 * the band mean without raising its peak, and the pigment must survive.
 */
function reliefSmoothFailures(data) {
  const failures = []
  const missing = RELIEF_SMOOTH_FIELDS.filter(
    (field) => typeof data[field] !== 'number' || !Number.isFinite(data[field]),
  )
  if (missing.length > 0) {
    failures.push(
      `capture "${data.gate}" is missing the signed-emboss readings ${missing.join(', ')} ` +
        '(run --scenario emboss-smooth)',
    )
    return failures
  }
  if (!(data.reliefMeanBefore > 0)) {
    failures.push(
      `reliefMeanBefore ${data.reliefMeanBefore} is not positive — the +15 impasto did not land`,
    )
  }
  if (!(data.reliefMeanAfter <= data.reliefMeanBefore * 0.5)) {
    failures.push(
      `reliefMeanAfter ${data.reliefMeanAfter} is above half of reliefMeanBefore ` +
        `${data.reliefMeanBefore} — the smoothing pass must visibly flatten the band`,
    )
  }
  if (!(data.reliefPeakAfter <= data.reliefPeakBefore)) {
    failures.push(
      `reliefPeakAfter ${data.reliefPeakAfter} exceeds reliefPeakBefore ` +
        `${data.reliefPeakBefore} — a smoothing pass may not raise the peak`,
    )
  }
  if (!(data.pigmentMeanAfter >= data.pigmentMeanBefore * 0.9)) {
    failures.push(
      `pigmentMeanAfter ${data.pigmentMeanAfter} fell below 90% of pigmentMeanBefore ` +
        `${data.pigmentMeanBefore} — the paint must be KEPT (this is not Lift)`,
    )
  }
  return failures
}

// ---- Spec 10 (261125-kvl): the per-stroke translucent stroke layer ---------
//
// The layer composites ONCE, at stroke end, and the shipped display shows the
// result. The pre-change tree has no layer at all, so the amount-0 capture is
// the identity witness and the amount>0 capture is the RED the tracer turns
// green. Two relations live here:
//
//  - the AMOUNT-KEYED invariant (`edgeLayerFailures`), which is what
//    SCENARIO_INVARIANTS runs: at amount 0 it runs ONLY the row-by-row
//    profile identity against the committed pre-change baseline; at amount>0
//    it requires every layer reading BY NAME and then applies the bars.
//  - two operands: `--falloff-sweep` (the strict mid-alpha ordering across
//    three same-amount captures, plus the falloff-independence of the layer's
//    own deposit — read on the PAPER profile, the one whose cover_L is the
//    deposit alone) and `--edge-structural` (the allocate/merge counters on
//    one capture — the amount-0 bypass is a BRANCH, so its proof is
//    structural, never a pixel comparison).
//
// The law (Spec 10, 261125; full-span weight 261126):
//   u = clamp(MIN(|across|) / (uRadius · 0.9), 0, 1); e = 2^(2b - 1);
//   A = lateralWeight(u, amount, b) = 1 - amount·u^e; A_eff = A·cover_L;
//   film_out = mix(film_S, film_L, A_eff)   component-wise, in ABSORBANCE
//   coefficients (the engine's subtractive pigment lerp). No band plateau, no
//   band average, no fit, no pre-blur, no granulation division — the commit is
//   pointwise. u = 0 is the centre line (A = 1), u = 1 the VISUAL edge
//   (A = 1 − amount). Every bar below names the number the law predicts at its
//   station.

/** The amount-0 identity row tolerance: the profile arrays are recorded at
 *  four decimals, so a row may move by one rounding step under GPU ULP drift.
 *  A real amount-0 change moves whole rows far past this. */
const EDGE_IDENTITY_TOLERANCE = 2e-4
const EDGE_SILHOUETTE_MIN_PX = 8
/** The anchor bar, in profile stations: the stored lateral field's own reach
 *  (`edgeLateralSat`, where u clamps at 1) must meet the stroke's VISUAL edge
 *  (`edgeCoverReach`, the outermost station at 5 % of the cover_L peak). The
 *  retired 0.66 anchor saturated at 36 px while the 5 % edge reached 44-47 px
 *  (measured 2048) — the fade died inside the deposit. One or two stations of
 *  slack cover the row-mean's shoulder and the field's 1e-3-floor spread. */
const EDGE_LATERAL_ANCHOR_TOL_PX = 3
/** The solid-band shrink bar applies from this amount up: the near-opaque
 *  band (aEff >= 0.9) must sit inside the stroke's half-cover station — the
 *  artist's solid core must be a core, not the mark. At amount 0 there is no
 *  layer and the band is not read. */
const EDGE_SOLID_SHRINK_AMOUNT = 0.5
/** The coefficient-mix identity bars, in 1/255 (spike 006 Q4's bar, kept):
 *  the committed film must reproduce the pointwise `mix(film_S, film_L, aEff)`
 *  through the display's own k; only the half-float storage round-trip is
 *  expected to move. */
const EDGE_ENCODE_MAX = 2
const EDGE_ENCODE_P95 = 1
const EDGE_ENCODE_OVER = 0
/** The live-vs-committed display settle (`edgePolishDelta`): the live
 *  compositor softens each film and then mixes; the committed display softens
 *  the stored mix. Both run the SAME coefficient law, so they agree wherever
 *  aEff is locally constant and differ only at the lateral stations (blur and
 *  mix do not commute there). The p95 is BARRED at one display step: the live
 *  state must match the committed state on at least 95 % of the interior
 *  texels (measured 0 on every cell; the retired band encoder measured 2–3,
 *  so this bar is the old settle's RED). The rim MAX and the over-count stay
 *  REPORTED — the prescribed blur order makes a byte-exact rim impossible, and
 *  UAT row 6 judges how the commit reads. All three must be real numbers. */
const EDGE_POLISH_P95 = 1
/** 261126-hgl — THE RIM BAR. The `edge-rim` layer arm is barred against its
 *  SAME-RECIPE `--edge 0` sheet control: the artist accepts Amount 0 as clean,
 *  so the sheet path is the accepted BASELINE (its residual is the
 *  yellow-over-blue KM crossing, not the halo — measured 3.41 lateral / 8.98
 *  tip light and 9.93 / 21.70 chroma at falloff 100). Per axis and surface
 *  the layer's `edgeRimLight*` / `edgeRimChroma*` must stay within one
 *  display step of the control's same field. The control has no layer, so its
 *  LIVE surface IS its committed one (the sheet path composites in the sheet;
 *  there is no separate live composite to reconstruct), and the live bar
 *  reads the control's committed reading. */
const EDGE_RIM_PARITY_MAX = 1

/** The eight rim readings, with the axis and surface each one names. */
const EDGE_RIM_FIELDS = [
  ['edgeRimLightLateralCommitted', 'Lateral', 'Committed'],
  ['edgeRimLightTipCommitted', 'Tip', 'Committed'],
  ['edgeRimChromaLateralCommitted', 'Lateral', 'Committed'],
  ['edgeRimChromaTipCommitted', 'Tip', 'Committed'],
  ['edgeRimLightLateralLive', 'Lateral', 'Live'],
  ['edgeRimLightTipLive', 'Tip', 'Live'],
  ['edgeRimChromaLateralLive', 'Lateral', 'Live'],
  ['edgeRimChromaTipLive', 'Tip', 'Live'],
]

/** The sheet-path control's gate name for a rim gate: `<prefix>-p<pickup>-
 *  <f##>` → `<prefix>-ctl-<f##>` at the recipe's pickup 100, else
 *  `<prefix>-ctl<pickup>-<f##>` (the pickup-0 arm keeps its own recipe). A
 *  name outside that convention cannot resolve a control and fails by name. */
function edgeRimControlGate(gateName) {
  const match = /^(.*)-p(\d+)-(f\d+)$/.exec(gateName)
  if (!match) return null
  const [, prefix, pickup, falloff] = match
  return pickup === '100' ? `${prefix}-ctl-${falloff}` : `${prefix}-ctl${pickup}-${falloff}`
}

/** The control capture, read once per process (a rim JSON carries the full
 *  profiles; the print path and the bar share one parse). */
const rimControlCache = new Map()
function edgeRimControl(gateName) {
  const controlGate = edgeRimControlGate(gateName)
  if (controlGate === null) return { controlGate: null, control: null, path: null }
  const path = join(tmpDir, `${controlGate}.json`)
  if (rimControlCache.has(path)) return { controlGate, control: rimControlCache.get(path), path }
  if (!existsSync(path)) return { controlGate, control: null, path }
  let control = null
  try {
    control = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    control = null
  }
  rimControlCache.set(path, control)
  return { controlGate, control, path }
}

/** The rim invariant (261126-hgl): a control capture must carry its committed
 *  readings (and null live halves by construction), and a LAYER capture's
 *  eight rim readings must sit within EDGE_RIM_PARITY_MAX of its same-recipe
 *  `--edge 0` control. A missing or mismatched control fails by name — never
 *  read as a satisfied bar. */
function edgeRimFailures(data) {
  const failures = []
  if (!Number.isFinite(data.edgeAmount) || data.edgeAmount < 0 || data.edgeAmount > 100) {
    failures.push(`edgeAmount ${JSON.stringify(data.edgeAmount)} is not a 0..100 knob`)
    return failures
  }
  const isControl = data.edgeAmount === 0
  for (const [field, , surface] of EDGE_RIM_FIELDS) {
    const value = data[field]
    if (isControl && surface === 'Live') {
      if (value !== null) {
        failures.push(
          `${field} ${JSON.stringify(value)} must be null on the sheet-path control ` +
            '(no layer, no live composite to reconstruct)',
        )
      }
      continue
    }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      failures.push(`${field} ${JSON.stringify(value)} is not a non-negative 1/255 rim reading`)
    }
  }
  if (isControl) return failures
  const { controlGate, control, path } = edgeRimControl(gate)
  if (controlGate === null) {
    failures.push(
      `cannot derive the sheet-path control gate from "${gate}" — a rim gate must be named ` +
        '<prefix>-p<pickup>-<f##> so its control is <prefix>-ctl[-<pickup>]-<f##>',
    )
    return failures
  }
  if (control === null) {
    failures.push(
      `the rim parity control "${controlGate}" is missing at ${path} (or unreadable) — ` +
        'run --scenario edge-rim --edge 0 with the same pickup / falloff / feather',
    )
    return failures
  }
  // The control must be the SAME recipe: a control from another pickup,
  // falloff or feather arm would silently widen the bar.
  for (const [field, expected] of [
    ['scenario', 'edge-rim'],
    ['edgeAmount', 0],
    ['edgeFalloff', data.edgeFalloff],
    ['edgePickupControl', data.edgePickupControl],
    ['edgeFeatherControl', data.edgeFeatherControl],
  ]) {
    if (control[field] !== expected) {
      failures.push(
        `the rim parity control "${controlGate}" records ${field} ` +
          `${JSON.stringify(control[field])}, not ${JSON.stringify(expected)} — ` +
          'the control must be the same-recipe --edge 0 arm',
      )
    }
  }
  if (failures.length > 0) return failures
  for (const [field, axis, surface] of EDGE_RIM_FIELDS) {
    const value = data[field]
    if (typeof value !== 'number') continue   // already reported above
    // The control has no layer: its live surface IS its committed one.
    const controlField = surface === 'Live' ? field.replace('Live', 'Committed') : field
    const base = control[controlField]
    if (typeof base !== 'number' || !Number.isFinite(base) || base < 0) {
      failures.push(
        `the rim parity control "${controlGate}" ${controlField} ${JSON.stringify(base)} is not a ` +
          'non-negative 1/255 reading — the control cannot baseline this bar',
      )
      continue
    }
    if (value > base + EDGE_RIM_PARITY_MAX) {
      failures.push(
        `${field} ${value}/255 exceeds its same-recipe --edge 0 control ${base}/255 + ` +
          `${EDGE_RIM_PARITY_MAX}/255 (${axis} ${surface.toLowerCase()}) — the layer arm still ` +
          'carries a rim the accepted Amount-0 sheet does not',
      )
    }
  }
  return failures
}

/** Print each layer/control rim pair (261126-hgl), one line per axis/surface
 *  and channel. Printed, never compared — the bar is edgeRimFailures. */
function printEdgeRim(data) {
  if (data.scenario !== 'edge-rim') return
  if (data.edgeAmount === 0) {
    const readings = EDGE_RIM_FIELDS.filter(([field]) => typeof data[field] === 'number').map(
      ([field]) => `${field.replace('edgeRim', '')} ${data[field]}`,
    )
    console.log(`rim       : sheet-path control (no layer; live null by construction) ${readings.join(' | ')}`)
    console.log('')
    return
  }
  const { controlGate, control } = edgeRimControl(gate)
  console.log(`rim       : layer vs ${controlGate ?? '(no control gate)'}`)
  for (const [field, axis, surface] of EDGE_RIM_FIELDS) {
    const value = data[field]
    const controlField = surface === 'Live' ? field.replace('Live', 'Committed') : field
    const base = control === null ? undefined : control[controlField]
    const channel = field.includes('Light') ? 'light' : 'chroma'
    const delta =
      typeof value === 'number' && typeof base === 'number'
        ? `${(value - base).toFixed(2)}`
        : '(n/a)'
    console.log(
      `rim       : ${axis.padEnd(7)} ${surface.padEnd(9)} ${channel.padEnd(6)} ` +
        `${String(value).padStart(6)} | control ${String(base).padStart(6)} | delta ${delta} (bar +${EDGE_RIM_PARITY_MAX})`,
    )
  }
  console.log('')
}

/** The printed-share reading at the band edge is REPORTED, not barred: the
 *  reverted film law's EDGE_PRINT_* floors were defined against `1 − amount·t^e`
 *  on the whole mark, and the layer law's raster mixes the base's own print
 *  (the under side carries stroke A's coverage) into the same station, so a
 *  numeric floor here would judge the scene, not the composite. The reading
 *  must be a fraction in [0, 1]; the bristle-gap survival is UAT row 9. */
const EDGE_PRINT_TOLERANCE = 0.12
/** The layer deposit does not read the falloff, so the three sweep captures'
 *  cover_L rows must agree to one 8-bit step (they are recorded at 4 dp).
 *  BARRED ON THE PAPER PROFILE ONLY (`edgeAcrossPaper`, stroke A over bare
 *  paper): that is the one profile whose cover_L is the deposit and nothing
 *  else. On the under profile (stroke B over A) the carrier legitimately lifts
 *  the committed sheet — `wetAt` reads uTimes/uCover, and pickup moves load ->
 *  body -> coverage — and stroke A's committed cover is the merge union
 *  `1 - (1-cover_S)(1 - A*cover_L)`, which reads the falloff BY LAW. Measured
 *  under the RETIRED 0.66-anchor law: the same under-side drift (0.0363 /
 *  0.0576 between f0 and f50/f100), so the coupling predates the full-span
 *  weight; it is deterministic, by design, and REPORTED, never an identity. */
const EDGE_COVER_ROW_TOLERANCE = 1 / 255

/** The two profile families every amount-0 capture must carry, and the four
 *  channels the identity compares inside each. */
const EDGE_PROFILE_FAMILIES = ['edgeAcrossPaper', 'edgeAcross']
const EDGE_PROFILE_CHANNELS = ['cover', 'dark', 'ink', 'print']

/** The layer-only readings: ABSENT at amount 0 (no layer exists), REQUIRED at
 *  amount > 0 — a missing one fails by name, never read as a satisfied bar. */
const EDGE_LAYER_READINGS = [
  'edgeMidAlphaPaper',
  'edgeMidAlphaUnder',
  'edgeMidCoverPaper',
  'edgeMidCoverUnder',
  // 261126 (the full-span falloff law): the mid station's lateral coordinate
  // and the band geometry the anchor and the plateau are judged on.
  'edgeMidLateralPaper',
  'edgeMidLateralUnder',
  'edgeLateralSatPaper',
  'edgeLateralSatUnder',
  'edgeCoverHalfPaper',
  'edgeCoverHalfUnder',
  'edgeCoverReachPaper',
  'edgeCoverReachUnder',
  'edgeSolidHalfPaper',
  'edgeSolidHalfUnder',
  'edgeCoreExactPaper',
  'edgeCoreExactUnder',
  'edgeContinuityPaper',
  'edgeContinuityUnder',
  // 261126-hgl: the halo readout on the `edge-layer` scene — a DIAGNOSTIC,
  // never a bar. The red-over-blue `edge-layer` pair pales by construction
  // (red's coefficient dominates the mix), so its dip score judges the scene,
  // not the halo; the artist's halo is judged on `edge-rim` (yellow over the
  // blue wash) by the rim block. Required so the reading stays emitted.
  'edgeFringeDipPaper',
  'edgeFringeDipUnder',
  'edgePrintRetentionPaper',
  'edgePrintRetentionUnder',
  'edgeEncodeMax',
  'edgeEncodeP95',
  'edgeEncodeOver',
  'edgePolishMax',
  'edgePolishP95',
  'edgePolishOver',
  // WR-01: the first merge's last-touch pairs — required at amount > 0 (the
  // merge must stamp), absent at amount 0 (no merge runs).
  'edgeMergedTouchBefore',
  'edgeMergedTouchAfter',
  'edgeMergedTouchPaperBefore',
  'edgeMergedTouchPaperAfter',
  // 261126: the pickup readout's layer-domain members — required at amount > 0
  // (a layer exists); `edgePickupSheetRgb`/`edgePickupTouch` also report on the
  // sheet path, where they are DIAGNOSTIC, not bar material.
  'edgePickupLayerRgb',
  'edgePickupMix',
  'edgePickupWet',
]

/** One profile's arrays, or a failure line when the shape is unusable. */
function edgeProfileOf(data, family) {
  const profile = data[family]
  if (profile === null || typeof profile !== 'object') {
    return { error: `capture is missing ${family} (re-run --scenario edge-layer)` }
  }
  const { offsets } = profile
  if (!Array.isArray(offsets) || offsets.length === 0) {
    return { error: `${family}.offsets is not a non-empty array` }
  }
  for (const channel of EDGE_PROFILE_CHANNELS) {
    const values = profile[channel]
    if (values === null) continue
    if (!Array.isArray(values) || values.length !== offsets.length) {
      return {
        error: `${family}.${channel} is not an array aligned with offsets (${values?.length} vs ${offsets.length})`,
      }
    }
  }
  return { profile }
}

/**
 * The amount-0 identity: every present profile channel must match the
 * committed pre-change baseline row by row within EDGE_IDENTITY_TOLERANCE.
 * The baseline was captured with NO layer machinery in the engine, so a row
 * that moves is a change to the shipped deposit or display — exactly what the
 * amount-0 branch is supposed to leave untouched.
 */
function edgeIdentityFailures(data, reference) {
  const failures = []
  if (reference === null || typeof reference !== 'object') {
    return ['amount-0 identity needs a reference capture (run with the committed baseline)']
  }
  if (reference.width !== data.width || reference.height !== data.height) {
    failures.push(
      `amount-0 identity: dimensions differ (${data.width}x${data.height} vs ` +
        `${reference.width}x${reference.height}); the identity is per-pixel`,
    )
    return failures
  }
  for (const family of EDGE_PROFILE_FAMILIES) {
    const here = edgeProfileOf(data, family)
    const there = edgeProfileOf(reference, family)
    if (here.error || there.error) {
      failures.push(here.error ?? there.error)
      continue
    }
    if (
      here.profile.offsets.length !== there.profile.offsets.length ||
      here.profile.offsets.some((value, index) => value !== there.profile.offsets[index])
    ) {
      failures.push(
        `amount-0 identity: ${family}.offsets does not match the baseline ` +
          '(the profile geometry moved; the identity is row-by-row)',
      )
      continue
    }
    for (const channel of EDGE_PROFILE_CHANNELS) {
      const a = here.profile[channel]
      const b = there.profile[channel]
      if (a === null && b === null) continue
      if (a === null || b === null) {
        failures.push(
          `amount-0 identity: ${family}.${channel} is ${a === null ? 'absent here' : 'absent in the baseline'} ` +
            '(a channel cannot appear or vanish at amount 0)',
        )
        continue
      }
      let worst = 0
      let worstAt = 0
      for (let i = 0; i < a.length; i += 1) {
        const delta = Math.abs(a[i] - b[i])
        if (delta > worst) {
          worst = delta
          worstAt = here.profile.offsets[i]
        }
      }
      if (worst > EDGE_IDENTITY_TOLERANCE) {
        failures.push(
          `amount-0 identity: ${family}.${channel} differs from the baseline by up to ` +
            `${worst.toFixed(6)} at ${worstAt} px (tolerance ${EDGE_IDENTITY_TOLERANCE}) — ` +
            'the edge law must be INERT at amount 0 (the shipped deposit and display run)',
        )
      }
    }
  }
  return failures
}

/**
 * Spec 10: the amount-keyed edge-layer invariant.
 *
 * At `edgeAmount === 0` it runs ONLY the identity block. At `edgeAmount > 0`
 * it requires every layer reading by name (a null at amount>0 is a capture
 * that never ran the layer path) and then applies the law's bars:
 *  - `edgeCoreExact*` <= 1/255: over the stations whose `aEff` reaches the
 *    merge's exact-endpoint set, the committed band IS the layer's band. The
 *    merge's write is exact (`layer − fixed`); the readback re-adds a nonzero
 *    fixed pool after RGBA16F storage, so one display step is the storage
 *    floor, never a bar to beat. A mix instead of the identity reads far over
 *    it;
 *  - `edgeContinuity*` = 0: no station leaves the [band_S, band_L] envelope
 *    (the coefficient decode must not overshoot the two endpoints);
 *  - the coefficient-mix identity max <= 2, p95 <= 1, zero over (1/255);
 *  - `edgePolishDelta`: the p95 must stay <= 1/255 (both displays run the
 *    same coefficient law; the retired band encoder settled 2–3). The rim
 *    max / over-count are REPORTED only — the prescribed blur order makes a
 *    byte-exact rim impossible (blur and mix do not commute at the lateral
 *    stations), and UAT row 6 judges how the commit reads. All three
 *    readings must be real numbers;
 *  - `edgePrintRetention*` is a measured share in [0, 1] (reported, not
 *    barred — the film law's EDGE_PRINT_* floors do not transfer to the layer
 *    law; see the constant's note).
 *  - `edgeMidCover*` > 0: the mid station must sit inside the deposit at all
 *    (a zero cover there would make the ordering vacuous);
 *  - `edgeMidAlpha*` in [0, 1] and finite.
 */
function edgeLayerFailures(data, reference) {
  const failures = []
  if (data.strokeBrush !== 'bristle-round') {
    failures.push(
      `strokeBrush ${JSON.stringify(data.strokeBrush)} is not 'bristle-round' — ` +
        'a non-bristle stroke never runs the bristle deposit the layer routes',
    )
  }
  if (!Number.isFinite(data.edgeAmount) || data.edgeAmount < 0 || data.edgeAmount > 100) {
    failures.push(`edgeAmount ${JSON.stringify(data.edgeAmount)} is not a 0..100 knob`)
  }
  if (!Number.isFinite(data.edgeFalloff) || data.edgeFalloff < 0 || data.edgeFalloff > 100) {
    failures.push(`edgeFalloff ${JSON.stringify(data.edgeFalloff)} is not a 0..100 knob`)
  }
  if (failures.length > 0) return failures

  // At amount 0 the identity block AND the Studio rows both run: the bypass
  // must reproduce the baseline pixel for pixel AND leave no layer behind.
  if (data.edgeAmount === 0) {
    return [
      ...failures,
      ...edgeIdentityFailures(data, reference),
      ...edgeStudioFailures(data),
      ...edgeMergeTouchFailures(data),
      ...edgePickupFailures(data),
    ]
  }

  const amount = data.edgeAmount / 100
  const missing = EDGE_LAYER_READINGS.filter((field) => !(field in data))
  if (missing.length > 0) {
    return [
      ...failures,
      `capture is missing ${missing.join(', ')} at amount ${data.edgeAmount}; ` +
        'every layer reading is required once the layer path runs',
    ]
  }
  // A core-exact reading is an IDENTITY at the merge's exact endpoint, so it
  // is only readable where a texel reaches `aEff >= 1 − 1e-4`. The scene's own
  // deposit can leave a side short of full coverage (the measured reach is
  // `debugMaxAeff*`); there the reading is NOT RUN and must be null — never a
  // fabricated 0. Every other layer reading is required unconditionally.
  const coreRunnable = (side) => {
    const reach = data[`debugMaxAeff${side}`]
    return typeof reach === 'number' && reach >= 1 - 1e-4
  }
  const absent = EDGE_LAYER_READINGS.filter((field) => {
    if (data[field] !== null) return false
    if (field === 'edgeCoreExactPaper') return coreRunnable('Paper')
    if (field === 'edgeCoreExactUnder') return coreRunnable('Under')
    return true
  })
  if (absent.length > 0) {
    return [
      ...failures,
      `capture reports ${absent.join(', ')} as absent at amount ${data.edgeAmount} — ` +
        'the pre-change engine cannot measure the layer; this is the RED the tracer closes',
    ]
  }
  // WR-01: the presence gates above named a missing/null pair; now the law —
  // the first merge must MOVE the region's last-touch forward (an unstamped
  // merge leaves the pair equal and the next stroke reads it as dry).
  failures.push(...edgeMergeTouchFailures(data))
  failures.push(...edgePickupFailures(data))
  for (const family of EDGE_PROFILE_FAMILIES) {
    const parsed = edgeProfileOf(data, family)
    if (parsed.error) {
      failures.push(parsed.error)
      continue
    }
    for (const channel of ['cover', 'print']) {
      if (parsed.profile[channel] === null) {
        failures.push(
          `${family}.${channel} is absent at amount ${data.edgeAmount} — ` +
            (channel === 'cover'
              ? 'the LAYER\'s own cover_L is the profile the sweep calibrates on'
              : 'the merged coverage raster\'s printed share is the dissolve witness'),
        )
      }
    }
  }
  if (failures.length > 0) return failures

  for (const side of ['Paper', 'Under']) {
    const core = data[`edgeCoreExact${side}`]
    if (core === null) {
      if (coreRunnable(side)) {
        failures.push(
          `edgeCoreExact${side} is absent although the merge's aEff reaches the exact ` +
            'endpoint — the identity must be read where it applies',
        )
      }
      // NOT RUN otherwise: this scene's deposit never saturates on this side
      // (the reach is reported by debugMaxAeff*), so there is no identity to
      // read. The coefficient-mix bar still governs every interior texel.
    } else if (!(core <= 1)) {
      // The endpoint identity is exact in the merge's write; the display
      // readback re-adds a nonzero fixed pool over RGBA16F storage, which
      // costs at most one 8-bit display step. The paper side measures 0
      // today; the under side's denser pool measures 1. More than one step
      // means the merge averaged instead of replacing.
      failures.push(
        `edgeCoreExact${side} ${core} exceeds 1/255 — over the texels whose merge ` +
          'aEff reaches the exact-endpoint set the committed band must BE ' +
          'the layer\'s band (an identity, not a mix; one step is the RGBA16F ' +
          'round trip through the fixed pool)',
      )
    }
    const continuity = data[`edgeContinuity${side}`]
    if (continuity !== 0) {
      failures.push(
        `edgeContinuity${side} ${continuity} station(s) leave the [band_S, band_L] envelope — ` +
          'the coefficient decode must stay between the two endpoint appearances (a pale ' +
          'fringe or a washed-out mark fails here)',
      )
    }
    const retention = data[`edgePrintRetention${side}`]
    if (!(typeof retention === 'number' && retention >= 0 && retention <= 1)) {
      failures.push(
        `edgePrintRetention${side} ${retention} is not a printed share in [0, 1] — the ` +
          'band edge reading must be a fraction of the station row (measured, see the ' +
          'EDGE_PRINT_TOLERANCE note: the film law\'s floors do not transfer)',
      )
    }
    const cover = data[`edgeMidCover${side}`]
    if (!(typeof cover === 'number' && cover > 0)) {
      failures.push(
        `edgeMidCover${side} ${cover} is not a positive cover_L at the u = 0.5 ` +
          'station — the deposit must reach the mid station or the ordering is vacuous',
      )
    }
    const alpha = data[`edgeMidAlpha${side}`]
    if (!(typeof alpha === 'number' && alpha >= 0 && alpha <= 1)) {
      failures.push(`edgeMidAlpha${side} ${alpha} is not a recovered alpha in [0, 1]`)
    }
    // The anchor: the lateral field must reach the stroke's VISUAL edge.
    const sat = data[`edgeLateralSat${side}`]
    const reach = data[`edgeCoverReach${side}`]
    if (!(typeof sat === 'number' && Number.isFinite(sat) && sat >= 0)) {
      failures.push(`edgeLateralSat${side} ${sat} is not a station in px`)
    } else if (!(typeof reach === 'number' && Number.isFinite(reach) && reach > 0)) {
      failures.push(`edgeCoverReach${side} ${reach} is not a station in px`)
    } else if (sat < reach - EDGE_LATERAL_ANCHOR_TOL_PX) {
      failures.push(
        `edgeLateralSat${side} ${sat} px ends before the stroke's visible edge (${reach} px ` +
          `at 5 % of the cover peak, tolerance ${EDGE_LATERAL_ANCHOR_TOL_PX} px) — u must reach ` +
          'the visual stroke edge (BRISTLE_LAYER_EDGE), not saturate inside the deposit',
      )
    }
    // The plateau: the near-opaque band must sit inside the stroke's
    // half-cover station — no interior plateau at a visible Edge amount.
    const solid = data[`edgeSolidHalf${side}`]
    const half = data[`edgeCoverHalf${side}`]
    if (!(typeof solid === 'number' && Number.isFinite(solid) && solid >= 0)) {
      failures.push(`edgeSolidHalf${side} ${solid} is not a band width in px`)
    } else if (!(typeof half === 'number' && Number.isFinite(half) && half > 0)) {
      failures.push(`edgeCoverHalf${side} ${half} is not a half-cover station in px`)
    } else if (amount >= EDGE_SOLID_SHRINK_AMOUNT && !(solid < half)) {
      failures.push(
        `edgeSolidHalf${side} ${solid} px is not inside the stroke's half-cover ${half} px ` +
          `at amount ${data.edgeAmount} — the lateral law must span the whole coordinate from ` +
          'the centre line (no opaque plateau)',
      )
    }
    const midLateral = data[`edgeMidLateral${side}`]
    if (!(typeof midLateral === 'number' && Math.abs(midLateral - 0.5) <= 0.05)) {
      failures.push(
        `edgeMidLateral${side} ${midLateral} is not ~0.5 — the mid station is found where the ` +
          'stored field crosses the law\'s half-weight coordinate',
      )
    }
  }
  if (!(data.edgeEncodeMax <= EDGE_ENCODE_MAX)) {
    failures.push(
      `edgeEncodeMax ${data.edgeEncodeMax} exceeds ${EDGE_ENCODE_MAX}/255 — the committed ` +
        'sheet must reproduce the pointwise coefficient mix (storage round-trip only)',
    )
  }
  if (!(data.edgeEncodeP95 <= EDGE_ENCODE_P95)) {
    failures.push(
      `edgeEncodeP95 ${data.edgeEncodeP95} exceeds ${EDGE_ENCODE_P95}/255 (the mix identity's p95 bar)`,
    )
  }
  if (data.edgeEncodeOver !== EDGE_ENCODE_OVER) {
    failures.push(
      `edgeEncodeOver ${data.edgeEncodeOver} is not ${EDGE_ENCODE_OVER} — no texel may sit ` +
        `over ${EDGE_ENCODE_MAX}/255`,
    )
  }
  // The live-vs-committed display settle (edgePolishDelta): its p95 is BARRED
  // at one step (both states run the same coefficient law; the retired band
  // encoder measured 2–3). The rim MAX and over-count are REPORTED only — the
  // prescribed blur order (live mixes the softened films, committed softens
  // the stored mix) makes a byte-exact rim impossible, and UAT row 6 judges
  // how the commit reads. All three readings must be real numbers.
  if (typeof data.edgePolishMax !== 'number' || !Number.isFinite(data.edgePolishMax) || data.edgePolishMax < 0) {
    failures.push(`edgePolishMax ${data.edgePolishMax} is not a non-negative 1/255 reading`)
  }
  if (typeof data.edgePolishP95 !== 'number' || !Number.isFinite(data.edgePolishP95) || data.edgePolishP95 < 0) {
    failures.push(`edgePolishP95 ${data.edgePolishP95} is not a non-negative 1/255 reading`)
  } else if (data.edgePolishP95 > EDGE_POLISH_P95) {
    failures.push(
      `edgePolishP95 ${data.edgePolishP95} exceeds ${EDGE_POLISH_P95}/255 — the live and committed ` +
        'displays run the same coefficient law and must agree on at least 95% of the interior ' +
        'without a step (the retired band encoder settle)',
    )
  }
  if (!Number.isInteger(data.edgePolishOver) || data.edgePolishOver < 0) {
    failures.push(`edgePolishOver ${data.edgePolishOver} is not a non-negative texel count`)
  }
  // 261126-hgl: `edgeFringeDipPaper/Under` are DIAGNOSTICS, never a bar. The
  // `edge-layer` pair is red over blue, which pales by construction (red's
  // coefficient dominates the mix), so a dip here cannot judge the halo; the
  // artist's halo is measured on `edge-rim` (yellow over the blue wash) by the
  // rim block Task 4 registers (Task 3 emits the readings only). The values
  // must still be real non-negative readings.
  for (const side of ['Paper', 'Under']) {
    const field = `edgeFringeDip${side}`
    const value = data[field]
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      failures.push(`${field} ${JSON.stringify(value)} is not a non-negative 1/255 reading`)
    }
  }
  failures.push(...edgeStudioFailures(data))
  return failures
}

/**
 * 261125-kvl task 5: every row the probe's `edgeStudioRows` reports. The
 * wall-clock readings (`edgeMergeMs*`) are deliberately NOT in this list —
 * they are reported in the capture and printed by `printEdgeStudio`, never
 * compared field for field.
 */
const EDGE_STUDIO_FIELDS = [
  // the memory row
  'edgeMemoryDim',
  'edgeMemoryLayerAllocated',
  'edgeMemoryTargets',
  'edgeMemoryLayerBytes',
  'edgeMemoryPerTexel',
  'edgeMemoryMiB',
  'edgeMemoryClampDim',
  'edgeMemoryClampedMiB',
  'edgeMemory4KRawMiB',
  // G1 — the live pointer stroke
  'edgeG1DrawsBefore',
  'edgeG1DrawsAtCallback',
  'edgeG1MergeDraws',
  'edgeG1CallbackCount',
  'edgeG1LayerOpenAtCallback',
  'edgeG1SheetPeakAtCallback',
  'edgeG1SheetPeak',
  'edgeG1LayerClosed',
  // G2 — the adapter's applyStroke
  'edgeG2MergeDraws',
  'edgeG2LayerClosed',
  'edgeG2SheetPeak',
  // undo / redo of a committed stroke
  'edgeUndoRestoreMax',
  'edgeUndoRestoreTexels',
  'edgeRedoRestoreMax',
  'edgeRedoRestoreTexels',
  'edgeMergeOutsideMax',
  'edgeMergeOutsideTexels',
  'edgeUndoOutsideMax',
  'edgeUndoOutsideTexels',
  'edgeRedoOutsideMax',
  'edgeRedoOutsideTexels',
  'edgeUndoLayerClosed',
  // I1 — abortStroke
  'edgeAbortWasOpen',
  'edgeAbortClosed',
  'edgeAbortSheetMax',
  'edgeAbortSheetTexels',
  'edgeAbortNextMerge',
  // I2 — undo with a layer open
  'edgeUndoOpenWasOpen',
  'edgeUndoOpenClosed',
  'edgeUndoOpenNextMerge',
  // I3 — restore with a layer open
  'edgeRestoreWasOpen',
  'edgeRestoreLayerAllocated',
  'edgeRestoreLayerFieldsNull',
  'edgeRestoreNextMerge',
  'edgeRestoreReallocated',
  // I4 — resizeDocument with a layer open
  'edgeResizeWasOpen',
  'edgeResizeDim',
  'edgeResizeLayerAllocated',
  'edgeResizeLayerFieldsNull',
  'edgeResizeNextMerge',
  'edgeResizeReallocated',
  // I5 — createDocument with a layer open
  'edgeCreateWasOpen',
  'edgeCreateLayerFieldsNull',
  'edgeCreateLayerAllocated',
  'edgeCreateDiscardIdempotent',
  'edgeCreateNextMerge',
  'edgeCreateReallocated',
]

/**
 * The Studio lifecycle bars (261125-kvl task 5). Every row is amount-keyed
 * where the bypass branch changes the count: at amount 0 no target exists, no
 * layer opens and no merge draws; at amount > 0 each live stroke merges
 * exactly once, BEFORE `onStrokeEnd` fires. Undo restores the pre-merge sheet
 * byte for byte over the merge rect, redo re-applies it, and neither moves a
 * texel outside — the interrupt rows prove each abandon path leaves no layer
 * behind and the NEXT Edge stroke re-allocates and merges once. A missing row
 * fails by name; `undefined` is never read as a satisfied bar.
 */
function edgeStudioFailures(data) {
  const failures = []
  const amountOn = data.edgeAmount > 0
  const key = amountOn ? 1 : 0
  const missing = EDGE_STUDIO_FIELDS.filter((field) => !(field in data))
  if (missing.length > 0) {
    return [
      `capture is missing ${missing.join(', ')} — re-run --scenario edge-layer ` +
        '(the Studio lifecycle rows run at the end of every edge-layer visit)',
    ]
  }
  const isNum = (value) => typeof value === 'number' && Number.isFinite(value)
  const expectEqual = (field, want, why) => {
    if (data[field] !== want) {
      failures.push(`${field} ${JSON.stringify(data[field])} is not ${JSON.stringify(want)} at amount ${data.edgeAmount} — ${why}`)
    }
  }

  // --- the memory row -------------------------------------------------------
  expectEqual(
    'edgeMemoryLayerAllocated',
    amountOn,
    amountOn
      ? 'an Edge stroke allocates the layer set'
      : 'amount 0 is the structural bypass: no layer target may exist',
  )
  const dim = data.edgeMemoryDim
  if (!Array.isArray(dim) || dim.length !== 2 || !dim.every((v) => Number.isInteger(v) && v > 0)) {
    failures.push(`edgeMemoryDim ${JSON.stringify(dim)} is not a positive [w, h] pair`)
  }
  const targets = data.edgeMemoryTargets
  const targetNames = ['layerInkRead', 'layerInkWrite', 'layerFilm', 'layerRelief', 'mergeRelief']
  const targetsOk =
    targets !== null &&
    typeof targets === 'object' &&
    targetNames.every((name) => isNum(targets[name]) && targets[name] >= 0)
  if (!targetsOk) {
    failures.push(`edgeMemoryTargets ${JSON.stringify(targets)} is not the five per-target byte counts`)
  } else {
    const sum = targetNames.reduce((total, name) => total + targets[name], 0)
    if (!isNum(data.edgeMemoryLayerBytes) || sum !== data.edgeMemoryLayerBytes) {
      failures.push(
        `edgeMemoryLayerBytes ${data.edgeMemoryLayerBytes} is not the sum of edgeMemoryTargets (${sum}) — ` +
          'the measured set is the five targets and nothing else',
      )
    }
    if (amountOn) {
      if (!(data.edgeMemoryLayerBytes > 0)) {
        failures.push(`edgeMemoryLayerBytes ${data.edgeMemoryLayerBytes} is not positive at amount > 0`)
      }
      if (!(isNum(data.edgeMemoryPerTexel) && data.edgeMemoryPerTexel > 0)) {
        failures.push(`edgeMemoryPerTexel ${data.edgeMemoryPerTexel} is not a positive bytes/texel reading`)
      }
      if (Array.isArray(dim) && data.edgeMemoryLayerBytes > 0 && isNum(data.edgeMemoryPerTexel)) {
        const area = dim[0] * dim[1]
        // 4-dp rounding of the per-texel ratio, never an equality on the quotient.
        if (Math.abs(data.edgeMemoryPerTexel * area - data.edgeMemoryLayerBytes) > area * 1e-4 + 1) {
          failures.push(
            `edgeMemoryPerTexel ${data.edgeMemoryPerTexel} does not match ` +
              `${data.edgeMemoryLayerBytes} bytes over ${area} texels`,
          )
        }
      }
      for (const field of ['edgeMemoryMiB', 'edgeMemoryClampedMiB', 'edgeMemory4KRawMiB']) {
        if (!(isNum(data[field]) && data[field] > 0)) {
          failures.push(`${field} ${data[field]} is not a positive MiB reading`)
        }
      }
    } else if (data.edgeMemoryLayerBytes !== 0) {
      failures.push(`edgeMemoryLayerBytes ${data.edgeMemoryLayerBytes} is not 0 at amount 0 — no layer target may exist`)
    }
  }
  const clamp = data.edgeMemoryClampDim
  if (!Array.isArray(clamp) || clamp.length !== 2 || !clamp.every((v) => Number.isInteger(v) && v > 0)) {
    failures.push(`edgeMemoryClampDim ${JSON.stringify(clamp)} is not a positive [w, h] pair`)
  }

  // --- G1: the live pointer stroke -----------------------------------------
  expectEqual('edgeG1MergeDraws', key, 'the live pointer stroke merges exactly once at its own end (never mid-stroke, never at amount 0)')
  expectEqual('edgeG1CallbackCount', 1, 'the release fires onStrokeEnd exactly once')
  expectEqual('edgeG1LayerOpenAtCallback', false, 'the merge runs BEFORE onStrokeEnd, so no layer may still be open at the callback')
  expectEqual('edgeG1LayerClosed', true, 'no layer may survive the stroke end')
  if (isNum(data.edgeG1DrawsBefore) && data.edgeG1DrawsAtCallback !== data.edgeG1DrawsBefore + key) {
    failures.push(
      `edgeG1DrawsAtCallback ${data.edgeG1DrawsAtCallback} is not edgeG1DrawsBefore + ${key} — ` +
        'the merge counter must have advanced before the callback reads it',
    )
  }
  for (const field of ['edgeG1SheetPeak', 'edgeG1SheetPeakAtCallback']) {
    if (!(isNum(data[field]) && data[field] > 0)) {
      failures.push(`${field} ${data[field]} is not a positive cover peak — the stroke's bytes must be down at the callback`)
    }
  }

  // --- G2: the adapter's applyStroke ---------------------------------------
  expectEqual('edgeG2MergeDraws', key, "the adapter's applyStroke drive merges exactly once at its own end (never at amount 0)")
  expectEqual('edgeG2LayerClosed', true, 'no layer may survive the adapter-driven stroke end')
  if (!(isNum(data.edgeG2SheetPeak) && data.edgeG2SheetPeak > 0)) {
    failures.push(`edgeG2SheetPeak ${data.edgeG2SheetPeak} is not a positive cover peak — the adapter drive must paint the sheet`)
  }

  // --- G3/G4: the replays ---------------------------------------------------
  expectEqual('edgeReplaySelfIdentical', true, 'the split drive and the one-shot replay must export identically')
  expectEqual('edgeReplayIdentical', true, 'the reset replay must reproduce the visit (the scene is pinned by pinStrokeStart)')
  const replayBar = amountOn ? 2 : 0
  if (!(isNum(data.edgeReplayMaxDelta) && data.edgeReplayMaxDelta <= replayBar)) {
    failures.push(
      `edgeReplayMaxDelta ${data.edgeReplayMaxDelta} exceeds ${replayBar}/255 at amount ${data.edgeAmount} — ` +
        (amountOn
          ? 'the seeded replay must reproduce the visit within the coefficient-mix bar'
          : 'amount 0 must reproduce the visit BYTE for byte'),
    )
  }

  // --- undo / redo of a committed stroke -----------------------------------
  for (const field of ['edgeUndoRestoreMax', 'edgeRedoRestoreMax', 'edgeMergeOutsideMax', 'edgeUndoOutsideMax', 'edgeRedoOutsideMax']) {
    if (data[field] !== 0) {
      failures.push(
        `${field} ${data[field]} is not 0 — undo must restore the pre-merge sheet byte for byte over ` +
          'the merge rect, redo must re-apply it, and neither may move a texel outside it',
      )
    }
  }
  for (const field of ['edgeUndoRestoreTexels', 'edgeRedoRestoreTexels', 'edgeMergeOutsideTexels', 'edgeUndoOutsideTexels', 'edgeRedoOutsideTexels']) {
    if (data[field] !== 0) {
      failures.push(`${field} ${data[field]} is not 0 — the undo/redo round trip must be exact (no tile left behind)`)
    }
  }
  expectEqual('edgeUndoLayerClosed', true, 'undo/redo must travel the sheet with no layer film left open')

  // --- the abandon paths ----------------------------------------------------
  const interruptRows = [
    ['edgeAbortWasOpen', 'edgeAbortClosed', 'edgeAbortNextMerge'],
    ['edgeUndoOpenWasOpen', 'edgeUndoOpenClosed', 'edgeUndoOpenNextMerge'],
    ['edgeRestoreWasOpen', null, 'edgeRestoreNextMerge'],
    ['edgeResizeWasOpen', null, 'edgeResizeNextMerge'],
    ['edgeCreateWasOpen', null, 'edgeCreateNextMerge'],
  ]
  for (const [wasField, closedField, nextField] of interruptRows) {
    expectEqual(wasField, amountOn, 'a layer-bearing stroke must be OPEN at this seam or the row proves nothing')
    if (closedField !== null) {
      expectEqual(closedField, true, 'the abandon path must close the layer')
    }
    expectEqual(
      nextField,
      key,
      'the next Edge stroke after the abandon path must merge exactly once (never anything at amount 0)',
    )
  }
  for (const field of ['edgeRestoreLayerFieldsNull', 'edgeResizeLayerFieldsNull', 'edgeCreateLayerFieldsNull']) {
    expectEqual(field, true, 'a recreate path with a layer open must leave no layer field behind')
  }
  for (const field of ['edgeRestoreLayerAllocated', 'edgeResizeLayerAllocated', 'edgeCreateLayerAllocated']) {
    expectEqual(field, false, 'the recreated document starts with no layer target (lazy allocation)')
  }
  for (const field of ['edgeRestoreReallocated', 'edgeResizeReallocated', 'edgeCreateReallocated']) {
    expectEqual(
      field,
      amountOn,
      amountOn ? 'the next Edge stroke must re-allocate the layer set' : 'amount 0 never allocates a layer target',
    )
  }
  expectEqual('edgeCreateDiscardIdempotent', true, 'discardLayer() must stay idempotent on an already-nulled layer')
  if (!Number.isInteger(data.edgeResizeDim) || data.edgeResizeDim <= 0) {
    failures.push(`edgeResizeDim ${JSON.stringify(data.edgeResizeDim)} is not the resized document side`)
  }
  if (data.edgeAbortSheetMax !== 0 || data.edgeAbortSheetTexels !== 0) {
    failures.push(
      `the aborted stroke moved the sheet (max ${data.edgeAbortSheetMax} over ` +
        `${data.edgeAbortSheetTexels} texel(s)) — abortStroke takes back its step, never repaints`,
    )
  }

  // --- the merge's own cost (reported here, judged by the artist) ----------
  if (amountOn) {
    for (const field of ['edgeMergeMsFirst', 'edgeMergeMsSecond', 'edgeMergeMsMax']) {
      if (!(isNum(data[field]) && data[field] >= 0)) {
        failures.push(`${field} ${JSON.stringify(data[field])} is not a measured merge time at amount > 0`)
      }
    }
  } else {
    for (const field of ['edgeMergeMsFirst', 'edgeMergeMsSecond', 'edgeMergeMsMax']) {
      if (data[field] !== null) {
        failures.push(`${field} ${JSON.stringify(data[field])} is not null at amount 0 — no merge runs`)
      }
    }
  }
  return failures
}

/**
 * WR-01 (261125-kvl, extended 261126): the stroke-end merge must STAMP the
 * merged region's last-touch. Since 261126 the layer's dabs stamp exactly
 * like the sheet path — weighted by the SHEET's cover — so the paint a dab
 * CROSSES is re-wet (that is the pickup input), while the layer's OWN film
 * over bare paper is untouched (sheet cover 0). The merge's post-merge cover
 * is what wets that film; without it the next stroke reads freshly merged
 * paint as fully dry — the pre-stroke age, up to the cleared one-week
 * sentinel.
 *
 * The probe reads two last-touch pairs around the FIRST
 * `mergeStrokeLayer`: the max over the merge rect (must not dry) and ONE
 * texel over bare paper (sentinel before, stroke-end clock after). Amount-
 * keyed: no merge runs at amount 0, so all four readings must be null there.
 * The wall-clock merge times are NOT involved — this is the layer's own
 * state, not a cost reading.
 */
function edgeMergeTouchFailures(data) {
  const fields = ['edgeMergedTouchBefore', 'edgeMergedTouchAfter', 'edgeMergedTouchPaperBefore', 'edgeMergedTouchPaperAfter']
  const missing = fields.filter((field) => !(field in data))
  if (missing.length > 0) {
    return [
      `capture is missing ${missing.join(', ')} — re-run --scenario edge-layer ` +
        "(the merge's last-touch pairs are read around each merge)",
    ]
  }
  if (data.edgeAmount === 0) {
    const failures = []
    for (const field of fields) {
      if (data[field] !== null) {
        failures.push(
          `${field} ${JSON.stringify(data[field])} is not null at amount 0 — ` +
            'no merge runs, so no touch stamp may be written',
        )
      }
    }
    return failures
  }
  const failures = []
  for (const field of fields) {
    if (typeof data[field] !== 'number' || !Number.isFinite(data[field])) {
      failures.push(
        `${field} ${JSON.stringify(data[field])} is not a finite last-touch reading at amount ${data.edgeAmount}`,
      )
    }
  }
  if (failures.length > 0) return failures
  // 261126: the dabs stamp the paint they cross (sheet cover), so the merge
  // rect's MAX is already live before the merge; the merge must never dry it.
  if (!(data.edgeMergedTouchAfter >= data.edgeMergedTouchBefore)) {
    failures.push(
      `edgeMergedTouchAfter ${data.edgeMergedTouchAfter} is before edgeMergedTouchBefore ` +
        `${data.edgeMergedTouchBefore} at amount ${data.edgeAmount} — the stroke-end merge must not ` +
        "push the merged region's last-touch backwards",
    )
  }
  // The merge's own witness is the bare-paper texel: every per-dab stamp is
  // weighted by the sheet's cover, which is 0 there, so only the post-merge
  // cover can wet it. An unstamped merge leaves the sentinel in place.
  if (!(data.edgeMergedTouchPaperAfter > data.edgeMergedTouchPaperBefore)) {
    failures.push(
      `edgeMergedTouchPaperAfter ${data.edgeMergedTouchPaperAfter} is not after ` +
        `edgeMergedTouchPaperBefore ${data.edgeMergedTouchPaperBefore} at amount ${data.edgeAmount} — ` +
        "the stroke-end merge must stamp the layer's OWN film, or the next stroke reads it as fully dry",
    )
  }
  return failures
}

/**
 * 261126 (Spec 10 pickup leg): the layer's gather must read the SAME
 * wet-pickup law as the sheet path. The probe decodes the layer film over the
 * crossing's core window and projects its departure from the brush pigment
 * onto the under-paint's own departure (`edgePickupMix`, 0 = the carried film
 * is pure brush colour, 1 = it is the under-paint). Bars:
 *  - pickup 0 (`edgePickupControl === 0`): mix is EXACTLY 0 — the control
 *    proves the reading is pickup, not a colour coincidence;
 *  - the canonical 100 (control null): mix >= EDGE_PICKUP_MIN_MIX — the stroke
 *    carried the under-paint in. Both the wet-under scene and the shipped
 *    dry-under scene pass: the sheet path self-wets per dab (bristleTouch's
 *    cover-weighted stamp), and so does the layer path since 261126;
 *  - the gather's own wet gate must be live (`edgePickupWet > 0.5`).
 * The sheet path (no layer) reports null layer members and is not judged here.
 */
const EDGE_PICKUP_MIN_MIX = 0.05

function edgePickupFailures(data) {
  const fields = ['edgePickupLayerRgb', 'edgePickupMix', 'edgePickupWet', 'edgePickupControl', 'edgeWetUnder']
  const missing = fields.filter((field) => !(field in data))
  if (missing.length > 0) {
    return [
      `capture is missing ${missing.join(', ')} — re-run --scenario edge-layer ` +
        '(the pickup readout profiles the crossing core)',
    ]
  }
  if (data.edgePickupLayerRgb === null) return []
  const failures = []
  if (typeof data.edgePickupMix !== 'number' || !Number.isFinite(data.edgePickupMix)) {
    failures.push(`edgePickupMix ${JSON.stringify(data.edgePickupMix)} is not a finite projection`)
  }
  if (typeof data.edgePickupWet !== 'number' || !Number.isFinite(data.edgePickupWet)) {
    failures.push(`edgePickupWet ${JSON.stringify(data.edgePickupWet)} is not a finite wetness`)
  }
  if (failures.length > 0) return failures
  if (data.edgePickupControl === 0) {
    if (data.edgePickupMix !== 0) {
      failures.push(
        `edgePickupMix ${data.edgePickupMix} is not 0 at pickup 0 — the smear weight is zero, ` +
          'so the layer film must be pure brush pigment',
      )
    }
    return failures
  }
  if (!(data.edgePickupMix >= EDGE_PICKUP_MIN_MIX)) {
    failures.push(
      `edgePickupMix ${data.edgePickupMix} is below ${EDGE_PICKUP_MIN_MIX} at pickup ` +
        `${JSON.stringify(data.edgePickupControl)} (wet-under ${data.edgeWetUnder}) — the layer's ` +
        "carried film does not contain the under-paint's colour; the gather is reading dry paint",
    )
  }
  if (!(data.edgePickupWet > 0.5)) {
    failures.push(
      `edgePickupWet ${data.edgePickupWet} is not above 0.5 — the gather's wet gate is cold at the ` +
        'crossing core, so no smear can be expected',
    )
  }
  return failures
}

/** The two counters the amount-0 bypass is proven by. */
const EDGE_STRUCTURAL_COUNTERS = ['layerAllocated', 'mergeDraws', 'mergeDrawsFirst']

/**
 * `--edge-structural`: the amount-0 bypass is a BRANCH, not a value, so its
 * proof is structural — no layer target allocated and no merge draw submitted
 * at amount 0, and exactly one allocation with one merge per stroke at
 * amount > 0. A missing counter FAILS by name; it is never read as a
 * satisfied bar (the pre-change tree cannot measure them at all).
 */
function edgeStructuralFailures(data) {
  const failures = []
  if (typeof data.layerAllocated !== 'boolean') {
    failures.push(
      `layerAllocated ${JSON.stringify(data.layerAllocated)} is not a boolean — ` +
        'the capture never read the engine\'s allocation seam',
    )
  }
  for (const field of ['mergeDraws', 'mergeDrawsFirst']) {
    if (typeof data[field] !== 'number' || !Number.isFinite(data[field])) {
      failures.push(`${field} ${JSON.stringify(data[field])} is not a number`)
    }
  }
  if (failures.length > 0) return failures
  if (!Number.isFinite(data.edgeAmount)) {
    return ['edgeAmount is missing — the counters cannot be keyed on the bypass']
  }
  if (data.edgeAmount === 0) {
    if (data.layerAllocated) {
      failures.push(
        'layerAllocated is true at amount 0 — the bypass must never allocate a layer target',
      )
    }
    if (data.mergeDraws !== 0) {
      failures.push(`mergeDraws ${data.mergeDraws} is not 0 at amount 0 — no merge draw may be submitted`)
    }
    if (data.mergeDrawsFirst !== 0) {
      failures.push(
        `mergeDrawsFirst ${data.mergeDrawsFirst} is not 0 at amount 0 — not even the first stroke may merge`,
      )
    }
    return failures
  }
  if (!data.layerAllocated) {
    failures.push(
      `layerAllocated is false at amount ${data.edgeAmount} — the first Edge-active stroke ` +
        'must allocate on its own per-stroke predicate',
    )
  }
  if (data.mergeDraws !== 1) {
    failures.push(
      `mergeDraws ${data.mergeDraws} is not 1 at amount ${data.edgeAmount} — the LAST stroke ` +
        'must merge exactly once, at its own stroke end',
    )
  }
  if (data.mergeDrawsFirst !== 1) {
    failures.push(
      `mergeDrawsFirst ${data.mergeDrawsFirst} is not 1 at amount ${data.edgeAmount} — the ` +
        'FIRST Edge-active stroke on a fresh engine must merge once too',
    )
  }
  return failures
}

const SCENARIO_INVARIANTS = {
  'white-over-blue': whiteOverBlueFailures,
  'cover-advect': coverAdvectFailures,
  'cover-lift': coverLiftFailures,
  'cover-textured': coverTexturedFailures,
  'red-over-blue-50': redOverBlueFailures,
  'bristle-edge': bristleEdgeFailures,
  'bristle-wet': bristleWetFailures,
  'bristle-line': bristleLineFailures,
  'bristle-line-over': bristleLineFailures,
  'bristle-tip': bristleTipFailures,
  'edge-layer': edgeLayerFailures,
  'edge-rim': edgeRimFailures,
}

/** Run the scenario's invariant function, if it has one. `reference` is the
 *  resolved counterpart capture (`--other` / `--differs-from` operand) and is
 *  what makes the bristle-tip band bar reference-aware; every other scenario
 *  ignores it. */
function scenarioInvariantFailures(data, reference) {
  const invariants = SCENARIO_INVARIANTS[data.scenario]
  return invariants ? invariants(data, reference) : []
}

/** 64-23: print the census readings a bristle-edge capture recorded, if any. */
function printBristleEdge(data) {
  if (data.scenario !== 'bristle-edge') return
  const keys = [
    'edgeSoftnessPxFeather0',
    'edgeSoftnessPxFeather100',
    'edgeVariationPxFeather0',
    'edgeVariationPxFeather100',
    'edgeHalfWidthPx',
    'edgePlateauAlphaFeather0',
    'edgePlateauAlphaFeather100',
  ]
  const parts = keys.filter((key) => typeof data[key] === 'number').map((key) => `${key} ${data[key]}`)
  if (parts.length === 0) return
  console.log(`edge      : ${parts.join(' | ')}`)
  // §4.3's dash breakup leaves stations the census cannot measure; a skip is
  // normal (the trace law working), a failure is not. Print the count so a
  // shrinking sample never goes unnoticed.
  if (Array.isArray(data.edgeSkippedStations) && data.edgeSkippedStations.length > 0) {
    console.log(`edge skips: ${data.edgeSkippedStations.length} station(s) in dash gaps`)
  }
  console.log('')
}

/** 261125-kvl task 5: print the Studio lifecycle readings a capture recorded. */
function printEdgeStudio(data) {
  if (data.scenario !== 'edge-layer') return
  const isNum = (value) => typeof value === 'number' && Number.isFinite(value)
  const dims = Array.isArray(data.edgeMemoryDim) ? data.edgeMemoryDim.join('x') : '(none)'
  const memory = data.edgeMemoryLayerAllocated
    ? `${data.edgeMemoryMiB} MiB @ ${data.edgeMemoryPerTexel} B/px (${dims}); ` +
      `4K clamp ${data.edgeMemoryClampedMiB} MiB, raw 4096² ${data.edgeMemory4KRawMiB} MiB`
    : 'none (structural bypass)'
  const parts = [`amount ${data.edgeAmount}`, `layer ${memory}`]
  if (isNum(data.edgeMergeMsFirst)) {
    parts.push(`merge ${data.edgeMergeMsFirst} / ${data.edgeMergeMsSecond} ms (max ${data.edgeMergeMsMax})`)
  }
  parts.push(
    `G1 merges ${data.edgeG1MergeDraws}, callback x${data.edgeG1CallbackCount}, ` +
      `peak ${data.edgeG1SheetPeak}`,
    `undo ${data.edgeUndoRestoreMax}/${data.edgeUndoRestoreTexels} texel(s), ` +
      `outside ${data.edgeUndoOutsideMax}/${data.edgeUndoOutsideTexels}`,
    `interrupt abort ${data.edgeAbortClosed}, undo ${data.edgeUndoOpenClosed}, ` +
      `restore ${data.edgeRestoreReallocated}, resize ${data.edgeResizeReallocated}, ` +
      `create ${data.edgeCreateReallocated}`,
  )
  // WR-01: the first merge's last-touch pairs — the max over the merge rect
  // and the layer's OWN film texel over bare paper (null at amount 0, where
  // no merge runs).
  if (typeof data.edgeMergedTouchBefore === 'number' || typeof data.edgeMergedTouchAfter === 'number') {
    parts.push(
      `merge last-touch ${JSON.stringify(data.edgeMergedTouchBefore)} → ` +
        `${JSON.stringify(data.edgeMergedTouchAfter)} s | paper ` +
        `${JSON.stringify(data.edgeMergedTouchPaperBefore)} → ` +
        `${JSON.stringify(data.edgeMergedTouchPaperAfter)} s`,
    )
  }
  console.log(`studio    : ${parts.join(' | ')}`)
  console.log('')
}

/** 64-24: print the wetness acceptance's readings a capture recorded, if any. */
function printBristleWet(data) {
  if (data.scenario !== 'bristle-wet') return
  const keys = ['pickupFreshMean', 'pickupAgedWetMean', 'wetMode']
  const parts = keys.filter((key) => typeof data[key] === 'number').map((key) => `${key} ${data[key]}`)
  if (parts.length === 0) return
  console.log(`wetness   : ${parts.join(' | ')}`)
  console.log('')
}

/** 64-29: print the texture-tip echoes the A/B was judged on, if any. */
function printBristleTip(data) {
  if (data.scenario !== 'bristle-tip') return
  const keys = ['tipMix', 'tipBands', 'tipGapPx']
  const parts = keys.filter((key) => typeof data[key] === 'number').map((key) => `${key} ${data[key]}`)
  if (parts.length === 0) return
  const requested = data.tipRequestedId ?? '(plain)'
  const carried = data.tipTextureId ?? '(none)'
  console.log(`tip       : requested ${requested} | carried ${carried} | ${parts.join(' | ')}`)
  if (typeof data.tipNote === 'string' && data.tipNote.length > 0) {
    console.log(`tip note  : ${data.tipNote}`)
  }
  console.log('')
}

/** 64-14: print the lifecycle coverage readings a capture recorded, if any. */
function printCoverLifecycle(data) {
  const keys = [
    'coverCoverageBeforeAdvect',
    'coverCoverageAfterAdvect',
    'coverCoveragePeakBefore',
    'coverCoveragePeakAfter',
    'coverCoverageBeforeLift',
    'coverCoverageAfterLift',
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
  console.error(
    'usage: node compare.mjs <gate> [--other <otherGate> | --differs-from <name> | --relief-smooth | --edge-structural | --falloff-sweep <linear> <rim>]',
  )
  process.exit(2)
}

const args = process.argv.slice(2)
const gate = args[0]
if (!gate || gate.startsWith('--')) usage('missing <gate> operand')

// mode: 'baseline' (mode 1), 'other' (mode 2), 'differs' (mode 3),
// 'relief-smooth' (quick 261123-hr5, a self-contained relation on the capture),
// 'edge-structural' (Spec 10, the allocate/merge counters on one capture) and
// 'falloff-sweep' (Spec 10, the strict mid-alpha ordering across three
// same-amount captures — the only cross-capture ordering gate).
let mode = 'baseline'
let operand
/** `--falloff-sweep`'s two extra operands, broad -> linear -> rim. */
let sweepOperands = null
if (args.length > 1) {
  if (args[1] === '--relief-smooth') {
    if (args.length > 2) usage(`unexpected extra argument "${args[2]}"`)
    mode = 'relief-smooth'
  } else if (args[1] === '--edge-structural') {
    if (args.length > 2) usage(`unexpected extra argument "${args[2]}"`)
    mode = 'edge-structural'
  } else if (args[1] === '--falloff-sweep') {
    for (const extra of args.slice(2)) {
      if (!extra || extra.startsWith('--')) usage(`--falloff-sweep needs two gate names (got "${extra}")`)
    }
    if (args.length < 4) usage('--falloff-sweep needs <linear> and <rim> gate names')
    if (args.length > 4) usage(`unexpected extra argument "${args[4]}"`)
    mode = 'falloff-sweep'
    sweepOperands = [args[2], args[3]]
  } else {
    if (args[1] !== '--other' && args[1] !== '--differs-from') usage(`unknown argument "${args[1]}"`)
    mode = args[1] === '--other' ? 'other' : 'differs'
    operand = args[2]
    if (!operand || operand.startsWith('--')) usage(`${args[1]} needs a gate name`)
    if (args.length > 3) usage(`unexpected extra argument "${args[3]}"`)
  }
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
  // 261125: edgePolishDelta prints here; its p95 is BARRED at one step, the
  // rim max / over-count are REPORTED (the live/committed blur order at a
  // moving lateral weight, and UAT row 6 judges the settle).
  if (typeof data.edgePolishP95 === 'number') {
    const over = data.edgePolishP95 > EDGE_POLISH_P95 ? ` — OVER the ${EDGE_POLISH_P95}/255 p95 bar` : ''
    console.log(
      `${label.padEnd(9)} : polish max ${data.edgePolishMax} | p95 ${data.edgePolishP95} | over ${data.edgePolishOver} (p95 bar ${EDGE_POLISH_P95}/255)${over}`,
    )
  }
  // 261126-hgl: the fringe's light-ring score per lateral axis — PRINTED as a
  // diagnostic, never barred. The red-over-blue `edge-layer` scene pales by
  // construction; the artist's halo is judged on `edge-rim`.
  if (typeof data.edgeFringeDipPaper === 'number' || typeof data.edgeFringeDipUnder === 'number') {
    console.log(
      `${label.padEnd(9)} : fringe dip paper ${data.edgeFringeDipPaper} | under ${data.edgeFringeDipUnder} (diagnostic — red-over-blue pales by construction)`,
    )
  }
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

// quick 261123-hr5: the self-contained signed-emboss relation. No baseline and
// no other capture is read — the capture's own six readings carry the gate.
if (mode === 'relief-smooth') {
  console.log('============ medium-engine pixel-gate compare ============')
  console.log('mode      : signed-emboss smoothing relation (--relief-smooth)')
  console.log(`capture   : ${actualPath}`)
  console.log('')
  printDurations('capture', actual)
  console.log('')
  if (typeof actual.smoothEmboss === 'number') {
    console.log(`emboss    : smooth ${actual.smoothEmboss} (the smoothing entry's value)`)
  }
  const readings = RELIEF_SMOOTH_FIELDS.filter((field) => typeof actual[field] === 'number').map(
    (field) => `${field} ${actual[field]}`,
  )
  if (readings.length > 0) console.log(`smoothing : ${readings.join(' | ')}`)
  console.log('')
  const lawFailures = alphaLawFailures(actual)
  for (const line of lawFailures) console.log(`INVARIANT ${line}`)
  const failures = reliefSmoothFailures(actual)
  for (const line of failures) console.log(`RELATION  ${line}`)
  if (lawFailures.length > 0 || failures.length > 0) {
    console.log(
      `RESULT: FAIL — ${failures.length} smoothing relation failure(s), ` +
        `${lawFailures.length} alpha law failure(s) (${gate})`,
    )
    console.log('=========================================================')
    process.exit(1)
  }
  console.log(`RESULT: PASS — the smoothing relation holds (${gate})`)
  console.log('=========================================================')
  process.exit(0)
}

// Spec 10: the structural relation on ONE capture — the amount-0 bypass is a
// BRANCH, so it is proven by counters, not by a pixel comparison. No baseline
// and no second capture is read (the --relief-smooth precedent); the alpha
// law still runs.
if (mode === 'edge-structural') {
  console.log('============ medium-engine pixel-gate compare ============')
  console.log('mode      : edge-layer structural relation (--edge-structural)')
  console.log(`capture   : ${actualPath}`)
  console.log('')
  printDurations('capture', actual)
  console.log('')
  if (actual.scenario !== 'edge-layer') {
    console.log(
      `RESULT: FAIL — --edge-structural reads an edge-layer capture ` +
        `(scenario "${actual.scenario}")`,
    )
    console.log('=========================================================')
    process.exit(1)
  }
  console.log(
    `structural : amount ${actual.edgeAmount} | layerAllocated ${JSON.stringify(actual.layerAllocated)} | ` +
      `mergeDraws ${JSON.stringify(actual.mergeDraws)} | first ${JSON.stringify(actual.mergeDrawsFirst)}`,
  )
  console.log('')
  const lawFailures = alphaLawFailures(actual)
  for (const line of lawFailures) console.log(`INVARIANT ${line}`)
  const failures = edgeStructuralFailures(actual)
  for (const line of failures) console.log(`STRUCTURE ${line}`)
  if (lawFailures.length > 0 || failures.length > 0) {
    console.log(
      `RESULT: FAIL — ${failures.length} structural failure(s), ` +
        `${lawFailures.length} alpha law failure(s) (${gate})`,
    )
    console.log('=========================================================')
    process.exit(1)
  }
  console.log(`RESULT: PASS — the structural relation holds (${gate})`)
  console.log('=========================================================')
  process.exit(0)
}

// Spec 10: the FALLOFF SWEEP — the only cross-capture ordering gate. The
// three operands are same-session captures (never baselines/): the amount is
// identical and the falloff differs BY DESIGN, so no committed baseline can
// express this relation. Reads /tmp/<gate>.json for all three, in operand
// order broad -> linear -> rim.
if (mode === 'falloff-sweep') {
  console.log('============ medium-engine pixel-gate compare ============')
  console.log('mode      : falloff sweep, broad < linear < rim (--falloff-sweep)')
  const sweepGates = [gate, ...sweepOperands]
  const captures = sweepGates.map((name) => readJson(join(tmpDir, `${name}.json`), `capture "${name}"`))
  for (let i = 0; i < sweepGates.length; i += 1) {
    console.log(`capture ${i}  : ${join(tmpDir, `${sweepGates[i]}.json`)}`)
  }
  console.log('')
  for (let i = 0; i < sweepGates.length; i += 1) printDurations(sweepGates[i], captures[i])
  console.log('')
  const failures = []
  const expectedFalloffs = [0, 50, 100]
  for (let i = 0; i < captures.length; i += 1) {
    const data = captures[i]
    if (data.scenario !== 'edge-layer') {
      failures.push(`capture "${sweepGates[i]}" is scenario "${data.scenario}", not "edge-layer"`)
      continue
    }
    if (data.edgeFalloff !== expectedFalloffs[i]) {
      failures.push(
        `capture "${sweepGates[i]}" records edgeFalloff ${data.edgeFalloff}, not ` +
          `${expectedFalloffs[i]} — the operands must be broad, linear, rim in that order`,
      )
    }
    if (data.width !== captures[0].width || data.height !== captures[0].height) {
      failures.push(
        `capture "${sweepGates[i]}" is ${data.width}x${data.height}, not ` +
          `${captures[0].width}x${captures[0].height} — the profiles must share one geometry`,
      )
    }
    if (data.edgeAmount !== captures[0].edgeAmount) {
      failures.push(
        `capture "${sweepGates[i]}" records amount ${data.edgeAmount}, not ` +
          `${captures[0].edgeAmount} — the sweep isolates the falloff`,
      )
    }
    // Each capture must first satisfy its own invariant (the amount-keyed
    // bars). The reference is null: at amount > 0 the invariant needs none,
    // and the sweep is an amount>0 relation by construction.
    for (const line of edgeLayerFailures(data, null)) {
      failures.push(`"${sweepGates[i]}": ${line}`)
    }
  }
  if (failures.length === 0) {
    // (a) the layer's own deposit does not read the falloff: identical
    // offsets, and every cover_L row agreeing to one 8-bit step across all
    // three captures. Without this the ordering could be an artefact of a
    // different scene or a different deposit. Read on `edgeAcrossPaper` —
    // stroke A over bare paper, whose cover_L IS the deposit. The under
    // profile (stroke B over A) is NOT barred: stroke A's committed cover is
    // the falloff-weighted merge union and B's carrier lifts it through
    // `wetAt` -> pickup -> load -> body -> coverage, so its cover_L rows move
    // by design (the retired law drifted the same 0.0363 / 0.0576 there).
    // That drift is printed below as a scene diagnostic.
    const profiles = captures.map((data) => edgeProfileOf(data, 'edgeAcrossPaper'))
    for (let i = 0; i < profiles.length; i += 1) {
      if (profiles[i].error) failures.push(`"${sweepGates[i]}": ${profiles[i].error}`)
    }
    if (failures.length === 0) {
      const base = profiles[0].profile
      const baseCover = base.cover
      if (baseCover === null) {
        failures.push('the broad capture carries no edgeAcrossPaper.cover (the layer\'s own cover_L)')
      } else {
        for (let i = 1; i < profiles.length; i += 1) {
          const other = profiles[i].profile
          if (
            other.offsets.length !== base.offsets.length ||
            other.offsets.some((value, index) => value !== base.offsets[index])
          ) {
            failures.push(
              `"${sweepGates[i]}" edgeAcrossPaper.offsets does not match "${sweepGates[0]}" ` +
                '(the profile geometry moved; the ordering is not comparable)',
            )
            continue
          }
          const cover = other.cover
          if (cover === null) {
            failures.push(`"${sweepGates[i]}" carries no edgeAcrossPaper.cover`)
            continue
          }
          let worst = 0
          let worstAt = 0
          for (let k = 0; k < cover.length; k += 1) {
            const delta = Math.abs(cover[k] - baseCover[k])
            if (delta > worst) {
              worst = delta
              worstAt = base.offsets[k]
            }
          }
          if (worst > EDGE_COVER_ROW_TOLERANCE) {
            failures.push(
              `"${sweepGates[i]}" edgeAcrossPaper.cover differs from "${sweepGates[0]}" by up to ` +
                `${worst.toFixed(6)} at ${worstAt} px (tolerance ${EDGE_COVER_ROW_TOLERANCE.toFixed(6)}) — ` +
                'the layer deposit does not read the falloff, so the cover_L rows must agree',
            )
          }
        }
      }
      // (a') the under-side drift, REPORTED: the carrier's pickup lifts stroke
      // A's falloff-weighted committed cover, so this number is expected to be
      // nonzero and non-monotone in nothing but the law. It must be real.
      {
        const under = captures.map((data) => edgeProfileOf(data, 'edgeAcross'))
        const baseUnder = under[0].profile
        if (!under.some((entry) => entry.error) && baseUnder && baseUnder.cover !== null) {
          const parts = []
          for (let i = 1; i < under.length; i += 1) {
            const other = under[i].profile
            if (!other || other.cover === null) continue
            let worst = 0
            for (let k = 0; k < other.cover.length && k < baseUnder.cover.length; k += 1) {
              worst = Math.max(worst, Math.abs(other.cover[k] - baseUnder.cover[k]))
            }
            parts.push(`${sweepGates[i]} ${worst.toFixed(4)}`)
          }
          if (parts.length > 0) {
            console.log(`cover    Under: ${parts.join(' | ')} (|dcov| vs ${sweepGates[0]}; pickup, reported)`)
          }
        }
      }
      // (b) the strict ordering, per side. No tolerance: broad < linear < rim.
      for (const side of ['Paper', 'Under']) {
        const key = `edgeMidAlpha${side}`
        const values = captures.map((data) => data[key])
        const bad = values.filter((value) => typeof value !== 'number')
        if (bad.length > 0) {
          failures.push(
            `${key} is missing on ${bad.length} of 3 captures — the ordering cannot be read ` +
              '(the pre-change engine reports it absent: this is the sweep\'s RED)',
          )
          continue
        }
        const strict =
          values[0] < values[1] && values[1] < values[2]
        console.log(
          `midAlpha ${side.padEnd(5)}: broad ${values[0]} | linear ${values[1]} | rim ${values[2]}`,
        )
        if (!strict) {
          failures.push(
            `${key} is not STRICTLY increasing broad < linear < rim ` +
              `(${values[0]} / ${values[1]} / ${values[2]}) — falloff 0 / 50 / 100 must order the ` +
              'midpoint alpha by the law `(1 - amount·0.5^e)·cover_L`',
          )
        }
      }
      // (c) the solid-band ordering (261126): the near-opaque band is widest
      // under the rim bias and narrowest under the broad bias — the falloff
      // chooses how fast the weight leaves the centre line. Barred on the
      // PAPER side only: its deposit saturates (cover_L ~1 in the plateau),
      // while the under side carries the pickup smear and can legitimately
      // sit below the band's floor on all three captures. Both are reported.
      for (const side of ['Paper', 'Under']) {
        const key = `edgeSolidHalf${side}`
        const values = captures.map((data) => data[key])
        console.log(
          `solid    ${side.padEnd(5)}: broad ${values[0]} | linear ${values[1]} | rim ${values[2]} ` +
            '(aEff >= 0.9, px)',
        )
        if (side !== 'Paper') continue
        const bad = values.filter((value) => typeof value !== 'number')
        if (bad.length > 0) {
          failures.push(`${key} is missing on ${bad.length} of 3 captures — the band ordering cannot be read`)
          continue
        }
        if (!(values[0] < values[1] && values[1] < values[2])) {
          failures.push(
            `${key} is not STRICTLY increasing broad < linear < rim ` +
              `(${values[0]} / ${values[1]} / ${values[2]}) — the full-span weight ` +
              '`1 - amount·u^e` widens the near-opaque core with the exponent',
          )
        }
      }
    }
  }
  console.log('')
  for (const line of failures) console.log(`SWEEP     ${line}`)
  if (failures.length > 0) {
    console.log(
      `RESULT: FAIL — ${failures.length} sweep failure(s) (${sweepGates.join(' < ')})`,
    )
    console.log('=========================================================')
    process.exit(1)
  }
  console.log(
    `RESULT: PASS — strict mid-alpha ordering broad < linear < rim on both sides, ` +
      `falloff-independent cover_L (${sweepGates.join(' < ')})`,
  )
  console.log('=========================================================')
  process.exit(0)
}

// 261126-hgl: the rim parity relation is SELF-CONTAINED — the capture is
// barred against its same-recipe `--edge 0` control (read from /tmp), not
// against a committed baseline (there is none for this scene, and a baseline
// would only freeze one engine's numbers while the control travels with the
// recipe). The standard field compare takes over if a baseline is ever
// committed; the invariant runs in every mode regardless.
if (
  mode === 'baseline' &&
  actual.scenario === 'edge-rim' &&
  !existsSync(join(here, 'baselines', `${gate}.json`))
) {
  console.log('============ medium-engine pixel-gate compare ============')
  console.log('mode      : edge-rim parity relation (no committed baseline)')
  console.log(`capture   : ${actualPath}`)
  console.log('')
  printDurations('capture', actual)
  console.log('')
  printEdgeRim(actual)
  const lawFailures = alphaLawFailures(actual)
  for (const line of lawFailures) console.log(`INVARIANT ${line}`)
  const failures = edgeRimFailures(actual)
  for (const line of failures) console.log(`RIM       ${line}`)
  if (lawFailures.length > 0 || failures.length > 0) {
    console.log(
      `RESULT: FAIL — ${failures.length} rim parity failure(s), ` +
        `${lawFailures.length} alpha law failure(s) (${gate})`,
    )
    console.log('=========================================================')
    process.exit(1)
  }
  console.log(
    `RESULT: PASS — every rim reading within ${EDGE_RIM_PARITY_MAX}/255 of its ` +
      `same-recipe --edge 0 control (${gate})`,
  )
  console.log('=========================================================')
  process.exit(0)
}

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
  printBristleTip(actual)
  // 64-31: the alpha-law blocks are enforced in this mode too — a digest that
  // differs on a capture whose law regressed is not a pass.
  const lawFailures = alphaLawFailures(actual)
  for (const line of lawFailures) console.log(`INVARIANT ${line}`)
  // 64-17: the scenario-keyed invariants, in every mode before the verdict.
  // 64-29: the reference rides along — the bristle-tip A/B bar needs the
  // plain leg's band count.
  const invariantFailures = scenarioInvariantFailures(actual, refData)
  for (const line of invariantFailures) console.log(`INVARIANT ${line}`)
  if (
    missing > 0 ||
    equal > 0 ||
    regionFailures.length > 0 ||
    lawFailures.length > 0 ||
    invariantFailures.length > 0
  ) {
    for (const line of regionFailures) console.log(`REGION    ${line}`)
    console.log(
      `RESULT: FAIL — ${equal} digest(s) did not differ, ${missing} missing, ` +
        `${regionFailures.length} cover region invariant(s) failed, ` +
        `${lawFailures.length} alpha law failure(s), ` +
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
// Spec 10: the amount-0 digest-drift exemption. The committed baseline was
// captured from a tree with NO layer machinery; the amount-0 branch must
// reproduce it byte for byte, but GPU ULPs may still move an export when the
// layer's targets and uniform pushes enter the program. A digest difference on
// this ONE capture class is COUNTED and PRINTED as drift — never silently
// passed — and any profile row moving still fails through edgeLayerFailures.
const digestDriftExempt =
  mode === 'baseline' && actual.scenario === 'edge-layer' && actual.edgeAmount === 0
let drift = 0
for (const field of FIELDS) {
  const a = actual[field]
  const b = refData[field]
  const aOk = a !== undefined && a !== null
  const bOk = b !== undefined && b !== null
  // 64-31: a skipped visible-alpha check records null in its numeric slots, so
  // null is a PRESENT value for those two fields on both sides — only an
  // absent key is a missing field. The opaque block is never nullable.
  const nullable = ALPHA_LAW_NULLABLE_FIELDS.has(field)
  const aPresent = aOk || (nullable && field in actual)
  const bPresent = bOk || (nullable && field in refData)
  // 64-17: the reference-legacy rule. Legal only against the named committed
  // baseline (mode 1); the capture side is always required.
  const optionalForReference =
    mode === 'baseline' && (REFERENCE_OPTIONAL[refData.gate] ?? []).includes(field)
  if (!aPresent || (!bPresent && !optionalForReference)) {
    missing += 1
    console.log(`MISSING   ${field.padEnd(18)} capture=${aPresent ? a : '(missing)'} reference=${bPresent ? b : '(missing)'}`)
    continue
  }
  if (!bPresent) {
    console.log(`absent    ${field.padEnd(18)} ${a}  (baseline predates the field; not compared)`)
    continue
  }
  if (a !== b) {
    if (digestDriftExempt && DIGESTS.includes(field)) {
      drift += 1
      console.log(
        `drift     ${field.padEnd(18)} capture=${a} reference=${b}  ` +
          '(amount-0 digest drift — reported, the profile identity is the gate)',
      )
      continue
    }
    differing += 1
    console.log(`DIFFER    ${field.padEnd(18)} capture=${a} reference=${b}`)
  } else {
    console.log(`equal     ${field.padEnd(18)} ${a}`)
  }
}
if (drift > 0) {
  console.log(
    `drift     ${drift} digest(s) moved at amount 0 — reported, not failed ` +
      '(the profile rows are the identity gate)',
  )
}

// quick 261123-hr5: an a/b replay pair of the signed-emboss scenario must
// replay to the SAME numbers, not only the same digests. Compared field for
// field only when BOTH captures carry the readings, so every other scenario's
// comparison shape is unchanged.
if (
  mode === 'other' &&
  RELIEF_SMOOTH_FIELDS.every(
    (field) => typeof actual[field] === 'number' && typeof refData[field] === 'number',
  )
) {
  for (const field of RELIEF_SMOOTH_FIELDS) {
    if (actual[field] !== refData[field]) {
      differing += 1
      console.log(`DIFFER    ${field.padEnd(18)} capture=${actual[field]} reference=${refData[field]}`)
    } else {
      console.log(`equal     ${field.padEnd(18)} ${actual[field]}`)
    }
  }
}

// 261125-kvl task 5: a re-capture of the same edge-layer scene must replay the
// Studio rows field for field too — the same merge counts, sheet windows,
// undo deltas and lifecycle booleans, not only the same digests. The wall
// clock (edgeMergeMs*) is deliberately excluded. Compared only when BOTH
// captures carry the rows, so every other scenario's shape is unchanged.
if (mode === 'other' && EDGE_STUDIO_FIELDS.every((field) => field in actual && field in refData)) {
  for (const field of EDGE_STUDIO_FIELDS) {
    const a = JSON.stringify(actual[field])
    const b = JSON.stringify(refData[field])
    if (a !== b) {
      differing += 1
      console.log(`DIFFER    ${field.padEnd(18)} capture=${a} reference=${b}`)
    } else {
      console.log(`equal     ${field.padEnd(18)} ${a}`)
    }
  }
}

// 261126-hgl: a re-capture of the same rim arm must replay its eight readings
// field for field too — the same layer/control parity numbers, not only the
// same digests. JSON comparison so a control arm's null live halves must also
// match (a live reading appearing on the sheet path would differ). Compared
// only when BOTH captures carry the keys, so every other scenario's shape is
// unchanged.
if (
  mode === 'other' &&
  actual.scenario === 'edge-rim' &&
  refData.scenario === 'edge-rim' &&
  EDGE_RIM_FIELDS.every(([field]) => field in actual && field in refData)
) {
  for (const [field] of EDGE_RIM_FIELDS) {
    const a = JSON.stringify(actual[field])
    const b = JSON.stringify(refData[field])
    if (a !== b) {
      differing += 1
      console.log(`DIFFER    ${field.padEnd(18)} capture=${a} reference=${b}`)
    } else {
      console.log(`equal     ${field.padEnd(18)} ${a}`)
    }
  }
}

// WR-01: the standing gate (capture vs its own baseline, or a same-session
// pair) asserts the same self-contained outcome invariants in every mode.
const regionFailures = coverRegionFailures(actual)
printCoverRegions(actual, refData)
printBristleEdge(actual)
printBristleWet(actual)
printBristleTip(actual)
printCoverLifecycle(actual)
printEdgeStudio(actual)
printEdgeRim(actual)
// 64-31: the alpha-law blocks run in committed-baseline and same-session mode
// too — every mode, before every verdict.
const lawFailures = alphaLawFailures(actual)
for (const line of lawFailures) console.log(`INVARIANT ${line}`)
// 64-17: the scenario-keyed invariants run in committed-baseline and
// same-session mode too — every mode, before every verdict.
const invariantFailures = scenarioInvariantFailures(actual, refData)
for (const line of invariantFailures) console.log(`INVARIANT ${line}`)

console.log('')
const counterpart = mode === 'other' ? operand : 'baseline'
if (
  missing > 0 ||
  differing > 0 ||
  regionFailures.length > 0 ||
  lawFailures.length > 0 ||
  invariantFailures.length > 0
) {
  for (const line of regionFailures) console.log(`REGION    ${line}`)
  console.log(
    `RESULT: FAIL — ${differing} differing field(s), ${missing} missing field(s), ` +
      `${regionFailures.length} cover region invariant(s) failed, ` +
      `${lawFailures.length} alpha law failure(s), ` +
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
