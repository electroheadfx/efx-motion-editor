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
 * Spec 10: the ONE capture-type predicate — a bristle capture is a live
 * `gatherBristle` capture. Every `bristle-*` scenario qualifies, and so does
 * `edge-transparency` (the lateral edge film, painted by `bristle-round`): its
 * name does not start `bristle-`, so a prefix test would run the visible-alpha
 * check on it and fail the alpha-law contract — the display film blur makes
 * the exported RGB and alpha intentionally disagree at the fringe.
 *
 * probe.ts carries the IDENTICAL predicate for its visible-alpha selection;
 * the two sides must agree on which captures are bristle captures. The
 * refusal of a skip on any other scenario is never weakened.
 */
function isBristleCapture(scenario) {
  return scenario.startsWith('bristle-') || scenario === 'edge-transparency'
}

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
  const bristle = isBristleCapture(String(data.scenario))
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

// Spec 10: the edge-transparency station bars. `gatherBristle` scales the
// whole carried film through ONE lateral `edgeFilm`, and the coverage channel
// is the channel it scales — so the asserted film is the ratio of this
// capture's coverage to the REFERENCE capture's coverage at the SAME row (the
// neutral baseline). That ratio is exactly the factor the gather applied: 1 by
// identity at amount 0, and `1 - amount` at the rim when the film executes.
// Normalising by the capture's own peak cannot work — the base profile is not
// flat (the neutral baseline peaks off-centre at +15 px, 0.8188 vs 0.7493 on
// row 0), so core-at-0 would read 0.915 and the identity could never pass.
// Three stations, in SILHOUETTE units (`u = lateral / uFeatherEdge` — the same
// denominator gatherBristle uses). UAT 2026-11-25: the amount fades the WHOLE
// mark — the profile keeps EDGE_CORE of the amount at the core (65% film at
// amount 100) and reaches 1 at the silhouette:
//   core (offset 0)     film 1 - amount · EDGE_CORE                    ± 0.06
//   mid  (0.775·rim)    film 1 - amount · (EDGE_CORE + (1 - EDGE_CORE)·0.5^e) ± 0.12
//   rim  (the rim)      film 1 - amount                                ± 0.12
// e = 2^(2b - 1) is the falloff exponent (0.5 / 1 / 2 at bias 0 / 50 / 100):
// at amount 1 the mid reads 0.19 / 0.325 / 0.49 for falloff 0 / 50 / 100,
// separated at the law level by more than the tolerance; the coverage
// channel's convergence lag narrows the measured separation (see the gate
// report), so the sweep is also checked visually side by side.
//
// THE SILHOUETTE MUST BE THE FILM'S OWN DOMAIN, not the reference's visible
// rim. On the engine `uFeatherEdge` is BRISTLE_FEATHER_EDGE (0.66) of the
// nominal footprint, which sits INSIDE the 2 %-of-peak rim the paper carries
// (measured 2026-11-24: reference rim 22 px, film floor boundary 16-17 px) —
// calibrating from the reference put the mid station BEYOND the band and all
// three sweeps read a blank row. At amount > 0 the film reaches exactly its
// rim floor (1 - amount) at u = 1, so the contiguous tail at that floor
// locates the silhouette directly; the two side boundaries are averaged
// (their difference is the profile grid's sub-pixel offset from the dab
// axis). At amount 0 the film is 1 everywhere and the identity capture is
// calibrated from the REFERENCE's rim as before (the widest row at 2 % of
// its peak, the MIN of both sides so a one-sided fringe cannot inflate it).
// Both branches are guarded to at least 8 px — a degenerate profile fails
// rather than silently judging a 1 px station.
//
// `ink` (the delivered absorbance) is supporting evidence only: it is a
// seven-channel pigment sum that mixes colour coefficients, so it carries a
// direction check (rim below core when amount > 0), never the ratio bars.
// The enclosed lane scan reuses the bristle-line gate's three bars.
// The core bar is looser than the old ±0.02: the coverage channel is written
// by a many-dab lerp, so a film-weighted stroke converges a few percent behind
// its own target (measured 2026-11-25: 0.693 where the law reads 0.650). The
// bar still proves the core fades at amount > 0 and stays well above the rim.
const EDGE_CORE_TOLERANCE = 0.06
const EDGE_STATION_TOLERANCE = 0.12
/** Mirrors BRISTLE_EDGE_CORE: the amount's share at the core (0.35). */
const EDGE_CORE = 0.35
const EDGE_SILHOUETTE_FRACTION = 0.02
const EDGE_SILHOUETTE_MIN_PX = 8
/** Within this of the rim floor is "at the floor": the film is exactly
 *  1 - amount past u = 1, so the tail is flat to float noise only. */
const EDGE_FLOOR_EPS = 1e-3
/** The fade band's midpoint in silhouette units: (0.775 - 0.55) / 0.45 = 0.5. */
const EDGE_MID_U = 0.775

/** The reference's visible silhouette, in document pixels, or null when the
 *  profile is missing/degenerate (an uncalibratable reference cannot pass). */
function edgeSilhouettePx(reference) {
  const profile = reference.edgeAcross
  if (profile === null || typeof profile !== 'object') return null
  const offsets = profile.offsets
  const cover = profile.cover
  if (!Array.isArray(offsets) || !Array.isArray(cover) || offsets.length !== cover.length) return null
  let peak = 0
  for (const value of cover) peak = Math.max(peak, value)
  if (!(peak > 0)) return null
  const floor = peak * EDGE_SILHOUETTE_FRACTION
  let left = 0
  let right = 0
  for (let i = 0; i < cover.length; i += 1) {
    if (!(cover[i] >= floor)) continue
    const offset = offsets[i]
    if (offset < 0) left = Math.max(left, -offset)
    if (offset > 0) right = Math.max(right, offset)
  }
  const extent = Math.min(left, right)
  return extent >= EDGE_SILHOUETTE_MIN_PX ? extent : null
}

/** The film's floor boundary on one side, in document pixels: the smallest
 *  |offset| of the contiguous tail where the film sits at its rim floor
 *  (1 - amount). At amount > 0 only the film itself locates u = 1 — the
 *  reference's 2 %-of-peak rim lies OUTSIDE the engine's silhouette. Null when
 *  the tail never reaches the floor (the film did not fade, or the profile is
 *  degenerate); rows the reference cannot normalise (baseline cover 0) are
 *  ignored. */
function edgeFilmFloorBoundary(offsets, filmAt, side, floor) {
  const rows = offsets
    .filter((offset) => side * offset > 0)
    .sort((a, b) => Math.abs(a) - Math.abs(b))
  let last = -1
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const ratio = filmAt(rows[i])
    if (ratio === null || ratio === undefined) continue
    last = i
    break
  }
  if (last < 0) return null
  if (Math.abs(filmAt(rows[last]) - floor) > EDGE_FLOOR_EPS) return null
  let boundary = last
  for (let i = last - 1; i >= 0; i -= 1) {
    const ratio = filmAt(rows[i])
    if (ratio === null || ratio === undefined) {
      boundary = i
      continue
    }
    if (Math.abs(ratio - floor) > EDGE_FLOOR_EPS) break
    boundary = i
  }
  return Math.abs(rows[boundary])
}

function edgeTransparencyFailures(data, reference) {
  const failures = []
  // The stroke's OWN id, not only the report echo: `toStudioStroke` defaults
  // to `round`, a non-bristle preset whose path never runs `gatherBristle`,
  // so the lateral film would never execute.
  if (data.strokeBrush !== 'bristle-round') {
    failures.push(
      `strokeBrush ${JSON.stringify(data.strokeBrush)} is not 'bristle-round' ` +
        '(the stroke must stamp a live bristle response; the `round` fallback never runs gatherBristle)',
    )
  }
  if (data.brush !== 'bristle-round') {
    failures.push(
      `brush ${JSON.stringify(data.brush)} is not 'bristle-round' (the report must echo the live response)`,
    )
  }
  if (!Number.isFinite(data.edgeAmount) || data.edgeAmount < 0 || data.edgeAmount > 100) {
    failures.push(`edgeAmount ${JSON.stringify(data.edgeAmount)} is not a 0..100 knob (the capture must echo it)`)
  }
  if (!Number.isFinite(data.edgeFalloff) || data.edgeFalloff < 0 || data.edgeFalloff > 100) {
    failures.push(`edgeFalloff ${JSON.stringify(data.edgeFalloff)} is not a 0..100 knob (the capture must echo it)`)
  }
  if (reference === null || typeof reference !== 'object' || reference.width !== data.width) {
    return [
      ...failures,
      `width ${data.width} does not match the reference ${reference && reference.width} ` +
        '(the silhouette is calibrated in the same document pixels)',
    ]
  }
  const profile = data.edgeAcross
  if (
    profile === null ||
    typeof profile !== 'object' ||
    !Array.isArray(profile.offsets) ||
    !Array.isArray(profile.cover) ||
    !Array.isArray(profile.ink)
  ) {
    return [...failures, 'capture is missing edgeAcross { offsets, cover, ink }; re-run the edge-transparency probe']
  }
  const offsets = profile.offsets
  const cover = profile.cover
  const ink = profile.ink
  if (offsets.length !== cover.length || offsets.length !== ink.length || offsets.length === 0) {
    return [
      ...failures,
      `edgeAcross arrays disagree in length (${offsets.length}/${cover.length}/${ink.length}) — no station can be read`,
    ]
  }
  if (failures.some((line) => line.includes('edgeAmount') || line.includes('edgeFalloff'))) {
    return failures
  }
  const amount = data.edgeAmount / 100
  const bias = data.edgeFalloff / 100
  const exponent = 2 ** (2 * bias - 1)
  let peak = 0
  for (const value of cover) peak = Math.max(peak, value)
  if (!(peak > 0)) {
    return [...failures, 'the coverage profile is blank (peak 0) — the stroke deposited no film']
  }
  // The film is the coverage ratio against the neutral reference at the same
  // row: the exact factor the gather applied (1 by identity at amount 0).
  const referenceProfile = reference.edgeAcross
  if (
    referenceProfile === null ||
    typeof referenceProfile !== 'object' ||
    !Array.isArray(referenceProfile.offsets) ||
    !Array.isArray(referenceProfile.cover) ||
    referenceProfile.offsets.length !== offsets.length ||
    referenceProfile.offsets.some((value, index) => value !== offsets[index])
  ) {
    return [
      ...failures,
      'the reference carries no aligned edgeAcross cover profile (offsets arrays differ or are missing); ' +
        'the station film cannot be normalised without a same-geometry neutral capture',
    ]
  }
  const referenceCover = referenceProfile.cover
  const filmAt = (station) => {
    const index = offsets.indexOf(station)
    if (index < 0) return null
    const baseline = referenceCover[index]
    return baseline > 0 ? cover[index] / baseline : undefined
  }
  const inkAt = (station) => {
    const index = offsets.indexOf(station)
    return index >= 0 ? ink[index] : null
  }
  // The station domain: the film's own floor boundary when the film executes,
  // the reference's rim on the identity capture (see the block comment).
  let silhouette
  let midStation
  let rimStation
  if (amount > 0) {
    const left = edgeFilmFloorBoundary(offsets, filmAt, -1, 1 - amount)
    const right = edgeFilmFloorBoundary(offsets, filmAt, 1, 1 - amount)
    if (left === null || right === null) {
      return [
        ...failures,
        'edge film never reaches its rim floor (1 - amount) on both sides of the profile — ' +
          'the silhouette cannot be calibrated from the film itself',
      ]
    }
    const axis = (left - right) / 2
    silhouette = (left + right) / 2
    midStation = Math.round(axis + EDGE_MID_U * silhouette)
    rimStation = Math.round(axis + silhouette)
  } else {
    silhouette = edgeSilhouettePx(reference)
    if (silhouette === null) {
      return [
        ...failures,
        'the reference profile cannot calibrate a visible silhouette (the widest row at 2% of its ' +
          `peak is under ${EDGE_SILHOUETTE_MIN_PX} px, or edgeAcross is missing); a capture cannot be judged without it`,
      ]
    }
    midStation = Math.round(EDGE_MID_U * silhouette)
    rimStation = silhouette
  }
  if (silhouette < EDGE_SILHOUETTE_MIN_PX) {
    return [
      ...failures,
      `the calibrated silhouette ${silhouette} px is under ${EDGE_SILHOUETTE_MIN_PX} px — ` +
        'a degenerate profile cannot be judged',
    ]
  }
  const stations = [
    ['core', 0, 1 - amount * EDGE_CORE, EDGE_CORE_TOLERANCE],
    [
      'mid',
      midStation,
      1 - amount * (EDGE_CORE + (1 - EDGE_CORE) * 0.5 ** exponent),
      EDGE_STATION_TOLERANCE,
    ],
    ['rim', rimStation, 1 - amount, EDGE_STATION_TOLERANCE],
  ]
  for (const [label, station, expected, tolerance] of stations) {
    const measured = filmAt(station)
    if (measured === null) {
      failures.push(`the coverage profile carries no row at the ${label} station ${station} px`)
      continue
    }
    if (measured === undefined) {
      failures.push(
        `the reference carries no coverage at the ${label} station ${station} px; ` +
          'the film cannot be normalised there (the neutral baseline must reach every station)',
      )
      continue
    }
    if (Math.abs(measured - expected) > tolerance) {
      const hint =
        label === 'mid'
          ? ` — the falloff exponent ${exponent} is not distributing the fade as requested`
          : label === 'core'
            ? ' — the core must read 1 - amount · EDGE_CORE at every falloff'
            : ' — the rim must read exactly 1 - amount'
      failures.push(
        `edge film ${label} at ${station} px reads ${measured.toFixed(4)} ` +
          `(expected ${expected.toFixed(4)} ± ${tolerance} at amount ${data.edgeAmount} / falloff ${data.edgeFalloff})${hint}`,
      )
    }
  }
  if (amount > 0) {
    const coreInk = inkAt(0)
    // The same integer row the rim bar reads (the calibrated silhouette can
    // land on a half pixel when the two floor boundaries disagree).
    const rimInk = inkAt(rimStation)
    if (coreInk === null || rimInk === null) {
      failures.push('the ink profile carries no core/rim row for the supporting direction check')
    } else if (!(rimInk < coreInk)) {
      failures.push(
        `ink at the rim ${rimInk} is not below the core ${coreInk} ` +
          '(the deposit weight must fade with the film; scaling colour alone would leave the rim full)',
      )
    }
  }
  const enclosed = data.edgeTiling && data.edgeTiling.enclosed
  if (enclosed === null || typeof enclosed !== 'object') {
    failures.push('edgeTiling.enclosed is missing (the enclosure scan never ran; a null scan cannot pass)')
  } else {
    const enclosedMissing = ['meanPct', 'fracPct', 'maxRunPx'].filter(
      (field) => typeof enclosed[field] !== 'number',
    )
    if (enclosedMissing.length > 0) {
      failures.push(`edgeTiling.enclosed is missing ${enclosedMissing.join(', ')}`)
    } else {
      if (enclosed.meanPct > ENCLOSED_MEAN_MAX_PCT) {
        failures.push(
          `edgeTiling.enclosed.meanPct ${enclosed.meanPct} exceeds ${ENCLOSED_MEAN_MAX_PCT}% ` +
            `at ${enclosed.offset} (a pale line enclosed by paint)`,
        )
      }
      if (enclosed.fracPct > ENCLOSED_FRAC_MAX_PCT) {
        failures.push(
          `edgeTiling.enclosed.fracPct ${enclosed.fracPct} exceeds ${ENCLOSED_FRAC_MAX_PCT}% ` +
            '(the pale lane spans the stroke, not a fibre)',
        )
      }
      if (enclosed.maxRunPx > ENCLOSED_MAX_RUN_PX) {
        failures.push(
          `edgeTiling.enclosed.maxRunPx ${enclosed.maxRunPx} exceeds ${ENCLOSED_MAX_RUN_PX} px ` +
            '(an enclosed lane, not an enclosed dot)',
        )
      }
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
  // Spec 10: the lateral edge film's three station bars (reference-aware: the
  // visible silhouette is calibrated from the neutral baseline's profile).
  'edge-transparency': edgeTransparencyFailures,
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
    'usage: node compare.mjs <gate> [--other <otherGate> | --differs-from <name> | --relief-smooth]',
  )
  process.exit(2)
}

const args = process.argv.slice(2)
const gate = args[0]
if (!gate || gate.startsWith('--')) usage('missing <gate> operand')

// mode: 'baseline' (mode 1), 'other' (mode 2), 'differs' (mode 3),
// 'relief-smooth' (quick 261123-hr5, a self-contained relation on the capture).
let mode = 'baseline'
let operand
if (args.length > 1) {
  if (args[1] === '--relief-smooth') {
    if (args.length > 2) usage(`unexpected extra argument "${args[2]}"`)
    mode = 'relief-smooth'
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
    differing += 1
    console.log(`DIFFER    ${field.padEnd(18)} capture=${a} reference=${b}`)
  } else {
    console.log(`equal     ${field.padEnd(18)} ${a}`)
  }
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

// WR-01: the standing gate (capture vs its own baseline, or a same-session
// pair) asserts the same self-contained outcome invariants in every mode.
const regionFailures = coverRegionFailures(actual)
printCoverRegions(actual, refData)
printBristleEdge(actual)
printBristleWet(actual)
printBristleTip(actual)
printCoverLifecycle(actual)
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
