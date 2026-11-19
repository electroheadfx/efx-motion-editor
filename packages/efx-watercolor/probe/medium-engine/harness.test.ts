// ============================================================
//  The medium-engine probe harness contract (Phase 64, plan 64-17).
//
//  Family: source-scan on the existing setup. The harness runs real WebGL2
//  in headless Chrome (`run.mjs` bundles `probe.ts` and drives the page);
//  vitest cannot do that, so the byte-level proof lives in the captures and
//  the committed baselines. What a source scan CAN prove is that the harness
//  records what the gates assert: the coverage sheet is digested, every
//  capture must carry it, the one pre-field baseline stays an explicit
//  exception, the drive keeps the spike's cadence, and the scenarios the
//  baselines name are reachable from both closed lists.
//
//  Every pin runs on COMMENT-STRIPPED source: all three files explain the
//  laws in prose headers, so a raw substring check could be satisfied by a
//  comment alone.
//
//  Laws pinned here (task 1 of 64-17):
//   1. The report digests `engine.exportCanvas('pigment')` — the mode-4
//      coverage-aware sheet whose alpha is the compositor alpha.
//   2. run.mjs refuses a capture that lacks any of the FOUR digests.
//   3. compare.mjs compares `digestPigment` strictly everywhere except
//      against the one committed baseline that predates the field
//      (`neutral-identity`, captured before the export existed).
//   4. The drive reads a per-entry `settle` (default SETTLE_TICKS) and fixes
//      every tenth rapid entry plus once after the loop — the spike's exact
//      cadence, unreachable for every pre-existing script.
//   5. `watercolor-50` is the spike's 50-rapid-stroke script verbatim, and
//      both closed scenario lists accept it.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Remove block and line comments so prose can neither satisfy nor trip a pin. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, '')
}

const PROBE = stripComments(readFileSync(resolve(HERE, 'probe.ts'), 'utf8'))
const RUN = stripComments(readFileSync(resolve(HERE, 'run.mjs'), 'utf8'))
const COMPARE = stripComments(readFileSync(resolve(HERE, 'compare.mjs'), 'utf8'))

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` would dump the file into the RED report and break its format.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectNotContains(source: string, needle: string): void {
  expect(source.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

describe('the medium-engine probe harness (64-17)', () => {
  describe('the pigment sheet is digested and required', () => {
    it('digests engine.exportCanvas("pigment") into digestPigment', () => {
      expectContains(PROBE, "engine.exportCanvas('pigment')")
      expectContains(PROBE, 'digestPigment: pigment.digest')
    })

    it('refuses a capture that lacks any of the four digests', () => {
      expectContains(
        RUN,
        "const digests = ['digestPaper', 'digestTransparent', 'digestWhite', 'digestPigment']",
      )
      expectContains(RUN, '`pigment   : ${result.digestPigment}`')
    })

    it('keeps digestPigment out of the three-digest differs-from set', () => {
      expectContains(
        COMPARE,
        "const DIGESTS = ['digestPaper', 'digestTransparent', 'digestWhite']",
      )
      expectContains(
        COMPARE,
        "const FIELDS = [...DIGESTS, 'digestPigment', 'byteLength', 'width', 'height']",
      )
    })
  })

  describe('the reference-legacy rule is exactly one named baseline', () => {
    it('names digestPigment optional only on neutral-identity', () => {
      expectContains(COMPARE, "const REFERENCE_OPTIONAL = { 'neutral-identity': ['digestPigment'] }")
      expectContains(COMPARE, "mode === 'baseline'")
      expectContains(COMPARE, '(baseline predates the field; not compared)')
    })

    it('still counts a capture-side omission as a missing field', () => {
      // The exception is consulted only when the REFERENCE lacks the field;
      // the capture side keeps the ordinary missing-field path.
      expectContains(COMPARE, 'const aOk = a !== undefined && a !== null')
      expectContains(COMPARE, 'const optionalForReference =')
    })
  })

  describe('the drive keeps the spike settle cadence', () => {
    it('reads a per-entry settle defaulting to SETTLE_TICKS', () => {
      expectContains(PROBE, 'readonly settle?: number')
      expectContains(PROBE, 'const settle = entry.settle ?? SETTLE_TICKS')
      expectContains(PROBE, 'for (let tick = 0; tick <= settle; tick += 1) adapter.stepTick(tick)')
    })

    it('fixes every tenth rapid entry and once after the loop', () => {
      expectContains(PROBE, 'if (entry.fixAfter === false && (index + 1) % 10 === 0) adapter.fix()')
      expectContains(PROBE, 'if (script.some((entry) => entry.fixAfter === false)) adapter.fix()')
      expectContains(PROBE, 'script.forEach((entry, index) => {')
    })
  })

  describe('the watercolor-50 scenario is the spike script verbatim', () => {
    it('carries the 50 rapid #cc2222 strokes with the jittered line', () => {
      expectContains(PROBE, 'function watercolor50Script(): readonly ScriptEntry[] {')
      expectContains(PROBE, 'const jitter = ((i % 3) - 1) * 0.003')
      expectContains(PROBE, 'points: horizontalLine(0.5 + jitter),')
      expectContains(PROBE, 'mutationId: 0x7ee100 + i,')
      expectContains(PROBE, "color: '#cc2222'")
      expectContains(PROBE, 'settle: 1,')
      expectContains(PROBE, 'body: 0,')
      expectContains(PROBE, 'for (let i = 0; i < 50; i += 1) {')
    })

    it('accepts watercolor-50 in both closed scenario lists', () => {
      expectContains(PROBE, "raw !== 'cover' && raw !== 'cover-over-wet' && raw !== 'watercolor-50'")
      expectContains(
        RUN,
        "scenarioRaw !== 'cover' && scenarioRaw !== 'cover-over-wet' && scenarioRaw !== 'watercolor-50'",
      )
      expectContains(PROBE, "scenario === 'watercolor-50'")
    })
  })
})

// Laws pinned here (task 2 of 64-17):
//   6. The white-over-blue scenario is Spike 001's geometry verbatim — the
//      blue band at Body 0, the white diagonal at the body knob (default 100).
//   7. The seven metrics are measured on the SPIKE's boxes: the crossing at
//      (0.5, 0.5), and alpha on the pigment export against the transparent
//      export's darkness conversion.
//   8. compare.mjs dispatches scenario invariants in every mode, switches the
//      bars on the capture's own body, and fails an unlisted body loudly.
describe('the white-over-blue matrix (64-17 task 2)', () => {
  describe('the scenario is the spike geometry verbatim', () => {
    it('paints #0044dd at body 0 then #f0f0f0 at the body knob', () => {
      expectContains(PROBE, 'function whiteOverBlueScript(body: number): readonly ScriptEntry[] {')
      expectContains(PROBE, 'const BLUE_BAND: readonly AquarellePoint[] = [')
      expectContains(PROBE, 'const WHITE_DIAGONAL: readonly AquarellePoint[] = [')
      expectContains(PROBE, "color: '#0044dd'")
      expectContains(PROBE, "color: '#f0f0f0'")
      expectContains(PROBE, 'mutationId: 0x51a7e1')
      expectContains(PROBE, 'mutationId: 0x51a7e2')
      expectContains(PROBE, 'whiteOverBlueScript(body ?? 100)')
    })

    it('measures the spike boxes with the crossing at (0.5, 0.5)', () => {
      expectContains(PROBE, 'const WHITE_OVER_BLUE_BOXES')
      expectContains(PROBE, 'crossing: { x0: 0.49, y0: 0.49, x1: 0.51, y1: 0.51 },')
      expectContains(PROBE, 'coverOwn: { x0: 0.276, y0: 0.688, x1: 0.304, y1: 0.712 },')
      expectContains(PROBE, 'underOwn: { x0: 0.24, y0: 0.488, x1: 0.3, y1: 0.512 },')
      expectContains(PROBE, 'paper: { x0: 0.45, y0: 0.86, x1: 0.55, y1: 0.94 },')
    })

    it('reports the seven metrics for this scenario only', () => {
      for (const key of [
        'crossR:',
        'crossG:',
        'crossB:',
        'crossBlueExcess:',
        'crossCoverAlpha:',
        'crossDarkAlpha:',
        'coveredPaperWhitePct:',
      ]) {
        expectContains(PROBE, key)
      }
      expectContains(PROBE, "scenario === 'white-over-blue'")
    })

    it('accepts white-over-blue in both closed scenario lists', () => {
      expectContains(
        PROBE,
        "raw !== 'cover' && raw !== 'cover-over-wet' && raw !== 'watercolor-50' && raw !== 'white-over-blue'",
      )
      expectContains(
        RUN,
        "scenarioRaw !== 'cover' && scenarioRaw !== 'cover-over-wet' && scenarioRaw !== 'watercolor-50' && scenarioRaw !== 'white-over-blue'",
      )
    })
  })

  describe('the comparator dispatches scenario invariants in every mode', () => {
    it('maps white-over-blue to its failure function', () => {
      expectContains(COMPARE, 'const SCENARIO_INVARIANTS = {')
      expectContains(COMPARE, "'white-over-blue': whiteOverBlueFailures,")
      expectContains(COMPARE, 'function whiteOverBlueFailures(data) {')
    })

    it('switches the bars on the capture body and fails an unlisted one', () => {
      expectContains(COMPARE, 'if (data.body === 100) {')
      expectContains(COMPARE, '} else if (data.body === 60) {')
      expectContains(COMPARE, '} else if (data.body === 30) {')
      expectContains(COMPARE, 'gap >= 0.6')
      expectContains(COMPARE, 'data.crossCoverAlpha >= 0.9')
      expectContains(COMPARE, 'data.crossBlueExcess <= 5')
      expectContains(COMPARE, 'data.crossCoverAlpha < 0.5')
      expectContains(COMPARE, 'gap >= 0.04')
      expectContains(COMPARE, 'data.crossBlueExcess >= 15 && data.crossBlueExcess <= 38')
      expectContains(COMPARE, 'data.crossBlueExcess >= 38')
      expectContains(COMPARE, 'gap <= 0.03')
      expectContains(COMPARE, 'data.coveredPaperWhitePct !== 0')
      expectContains(COMPARE, 'has no white-over-blue bar set')
    })

    it('prints every failure with the INVARIANT prefix before the verdict', () => {
      expectContains(COMPARE, '`INVARIANT ${line}`')
      expectContains(COMPARE, 'scenarioInvariantFailures(actual)')
    })
  })
})

// Laws pinned here (64-16 task 1):
//   9. A `ScriptEntry` carries an optional `brushId`; `makeStroke` falls back
//      to `round`, and an unknown `--brush` id throws with the known list —
//      the silent fallback is the failure this gate exists to prevent.
//  10. `cover-textured` paints the dark band with `round` at Body 0, then the
//      diagonal with the requested brush (default chalk), and reports the
//      alpha spread on its own box, the crossing blue excess and the
//      whole-sheet paper-white scan.
//  11. compare.mjs dispatches `cover-textured` to its five bars in every mode.
//  12. Both closed scenario lists accept `cover-textured` and
//      `red-over-blue-50` with identical literals.
describe('the textured-tip gate (64-16 task 1)', () => {
  describe('the brush operand reaches every stroke', () => {
    it('carries a per-entry brushId resolved against the presets', () => {
      expectContains(PROBE, "import { BRUSH_PRESETS } from '../../src/playground/brushes'")
      expectContains(PROBE, 'readonly brushId?: string')
      expectContains(PROBE, 'brushId: entry.brushId ?? BRUSH_ID,')
    })

    it('throws on an unknown --brush id instead of falling back to round', () => {
      expectContains(PROBE, 'function readBrush(): string | undefined {')
      expectContains(PROBE, "const raw = new URLSearchParams(location.search).get('brush')")
      expectContains(PROBE, 'const known = BRUSH_PRESETS.map((preset) => preset.id)')
      expectContains(PROBE, '!known.includes(raw)')
      expectContains(PROBE, 'invalid brush "${raw}" (known: ${known.join')
    })

    it('accepts --brush in run.mjs and appends it to the page query', () => {
      expectContains(RUN, "const brushFlag = args.indexOf('--brush')")
      expectContains(RUN, 'expected a non-empty brush id')
      expectContains(RUN, '`&brush=${encodeURIComponent(brush)}`')
    })

    it('echoes the resolved brush in the report', () => {
      expectContains(
        PROBE,
        "const resolvedBrush = brush ?? (scenario === 'cover-textured' ? 'chalk' : undefined)",
      )
      expectContains(PROBE, 'brush: resolvedBrush ?? null,')
    })
  })

  describe('the cover-textured scenario measures the tip spread', () => {
    it('paints the dark band with round at Body 0 then the diagonal with the brush', () => {
      expectContains(
        PROBE,
        'function coverTexturedScript(emboss?: number, body?: number, brushId?: string): readonly ScriptEntry[] {',
      )
      expectContains(PROBE, "brushId: 'round',")
      expectContains(PROBE, 'const TEXTURED_BOX: BandBox = { x0: 0.44, y0: 0.41, x1: 0.58, y1: 0.55 }')
    })

    it('derives the spread without sorting and reuses the 64-17 helpers', () => {
      expectContains(PROBE, 'function alphaSpread(')
      expectContains(PROBE, 'const bins = new Uint32Array(256)')
      expectContains(PROBE, 'const spread = alphaSpread(pigment, TEXTURED_BOX)')
      expectContains(PROBE, 'coverAlphaMean: round2(alphaMean(pigment, TEXTURED_BOX)),')
      expectContains(PROBE, 'coverAlphaP10: round2(spread.p10),')
      expectContains(PROBE, 'coverAlphaP90: round2(spread.p90),')
      expectContains(PROBE, 'coverAlphaCoveredFraction: round2(spread.coveredFraction),')
      expectContains(PROBE, 'coverCrossBlueExcess: round2(bandStats(pigment, COVER_BOXES.crossing).blueExcess),')
      expectContains(PROBE, 'coveredPaperWhitePct: round2(coveredPaperWhitePct(transparent, pigment, 0.5)),')
    })
  })

  describe('the comparator gates the textured spread in every mode', () => {
    it('maps cover-textured to its failure function and its five bars', () => {
      expectContains(COMPARE, "'cover-textured': coverTexturedFailures,")
      expectContains(COMPARE, 'function coverTexturedFailures(data) {')
      // 64-16 calibration finding: the provisional P90 >= 0.5 band
      // could not hold on the mandated box (the chalk core occupies 8% of it,
      // below the 10% that band requires); the floor is set from the first
      // measurement capture and recorded in the SUMMARY.
      expectContains(COMPARE, 'const COVER_TEXTURED_P90_FLOOR = 0')
      expectContains(COMPARE, 'data.coverAlphaP90 >= COVER_TEXTURED_P90_FLOOR')
      expectContains(COMPARE, 'data.coverAlphaP10 <= 0.5')
      expectContains(
        COMPARE,
        'data.coverAlphaCoveredFraction >= 0.02 && data.coverAlphaCoveredFraction <= 0.8',
      )
      expectContains(COMPARE, 'data.coverCrossBlueExcess <= 5')
      expectContains(COMPARE, 'data.coveredPaperWhitePct !== 0')
    })
  })

  describe('both closed scenario lists accept the new names', () => {
    it('lists cover-textured, red-over-blue-50 and bristle-edge in probe.ts and run.mjs', () => {
      expectContains(
        PROBE,
        "raw !== 'cover-lift' && raw !== 'cover-textured' && raw !== 'red-over-blue-50' && raw !== 'bristle-edge'",
      )
      expectContains(
        RUN,
        "scenarioRaw !== 'cover-lift' && scenarioRaw !== 'cover-textured' && scenarioRaw !== 'red-over-blue-50' && scenarioRaw !== 'bristle-edge'",
      )
    })
  })
})

// Laws pinned here (64-16 task 2):
//  13. `red-over-blue-50` ports the spike's criterion-2 script verbatim: three
//      blue field lines at Body 0 (mutationIds 0x7ed001+), 50 rapid red
//      strokes at the body knob with settle 1 and no per-entry fix
//      (0x7ed100+), then one red reference stroke (0x7ed200) painting on
//      clean paper ON THE SAME SHEET, so the ratio cancels paper and light.
//  14. The report measures finalLuma / referenceLuma / lumaRatio / deltaHue
//      from the PIGMENT export's rgb through the spike's own hue formula,
//      plus 64-17's paper-white scan.
//  15. compare.mjs gates the criterion-2 numbers in every mode:
//      coveredPaperWhitePct === 0, lumaRatio >= 0.95, |deltaHue| <= 3.
describe('the red-over-blue-50 criterion-2 gate (64-16 task 2)', () => {
  describe('the scenario is the spike criterion-2 script verbatim', () => {
    it('paints three blue field lines at Body 0 then 50 rapid red strokes', () => {
      expectContains(PROBE, "const BLUE_FIELD = '#0044dd'")
      expectContains(PROBE, "const RED = '#cc2222'")
      expectContains(PROBE, 'const BLUE_FIELD_LINES: readonly number[] = [0.42, 0.5, 0.58]')
      expectContains(PROBE, 'function redOverBlueScript(')
      expectContains(PROBE, 'mutationId: 0x7ed001 + i')
      expectContains(PROBE, 'mutationId: 0x7ed100 + i')
      expectContains(PROBE, 'mutationId: 0x7ed200')
      expectContains(PROBE, 'body: redBody,')
    })

    it('paints the reference stroke on clean paper on the same sheet', () => {
      expectContains(PROBE, 'const RED_REF_POINTS: readonly AquarellePoint[] = [')
      expectContains(PROBE, 'const RED_FIELD_BOX: BandBox = { x0: 0.42, y0: 0.492, x1: 0.58, y1: 0.508 }')
      expectContains(PROBE, 'const RED_REFERENCE_BOX: BandBox = { x0: 0.42, y0: 0.848, x1: 0.58, y1: 0.872 }')
      expectContains(PROBE, 'redOverBlueScript(body ?? 100)')
    })
  })

  describe('the report measures luma and hue on the pigment export', () => {
    it('ports the spike hue formula and reports the five metrics', () => {
      expectContains(PROBE, 'function rgbToHsv(')
      expectContains(PROBE, 'function redOverBlueMetrics(')
      expectContains(PROBE, 'finalLuma: round2(finalLuma),')
      expectContains(PROBE, 'referenceLuma: round2(referenceLuma),')
      expectContains(PROBE, 'lumaRatio: round2(finalLuma / referenceLuma),')
      expectContains(PROBE, 'deltaHue: round2(deltaHue),')
      expectContains(PROBE, 'coveredPaperWhitePct: round2(coveredPaperWhitePct(transparent, pigment, 0.5)),')
      expectContains(PROBE, 'if (deltaHue > 180) deltaHue -= 360')
      expectContains(PROBE, "scenario === 'red-over-blue-50'")
    })
  })

  describe('the comparator gates the criterion-2 numbers in every mode', () => {
    it('maps red-over-blue-50 to its failure function and its three bars', () => {
      expectContains(COMPARE, "'red-over-blue-50': redOverBlueFailures,")
      expectContains(COMPARE, 'function redOverBlueFailures(data) {')
      expectContains(COMPARE, 'data.lumaRatio >= 0.95')
      expectContains(COMPARE, 'Math.abs(data.deltaHue) <= 3')
      expectContains(COMPARE, 'data.coveredPaperWhitePct !== 0')
    })
  })
})

// Laws pinned here (64-23):
//  16. `bristle-edge` paints TWO horizontal `bristle-flat` strokes of the same
//      length and speed on one sheet, identical but for the Feather global
//      (0 upper, 100 lower), each fixed after its own settle — the geometry
//      the directional-edge census compares.
//  17. The Feather knob is an entry-level optional bag key (0..100) forwarded
//      verbatim; an omitted key adds nothing, so every pre-existing script's
//      bag stays the plan-01 bag.
//  18. The report carries each stroke's edge softness and variation plus the
//      measured half-width and plateaus, measured on the TRANSPARENT export's
//      deposited darkness (`1 − min(rgb)` = the engine's `darkAlpha`), never
//      the mode-4 pigment alpha: on a bristle stroke that alpha is the
//      saturated union of the ~100+ overlapping dabs' coverage, so its edge is
//      the gather's support boundary at every Feather (measured 0.8 px / 0.8
//      px), while the feather band shapes the DEPOSIT. The report's field
//      names are the plan's; the section header records the measurement.
//  19. compare.mjs dispatches `bristle-edge` to its relation invariants in
//      every mode: both softnesses positive, Feather-100 strictly wider, both
//      variations non-zero, and the wide softness narrower than the measured
//      half-width — and the probe's own named degeneracies fail verbatim.
describe('the bristle-edge census (64-23)', () => {
  describe('the scenario is the two-stroke feather comparison', () => {
    it('paints both strokes through the same geometry, differing only in Feather', () => {
      expectContains(PROBE, 'function bristleEdgeScript(): readonly ScriptEntry[] {')
      expectContains(PROBE, 'points: horizontalLine(EDGE_FEATHER_0_Y),')
      expectContains(PROBE, 'points: horizontalLine(EDGE_FEATHER_100_Y),')
      expectContains(PROBE, 'mutationId: 0x7ee200,')
      expectContains(PROBE, 'mutationId: 0x7ee201,')
      expectContains(PROBE, 'feather: 0,')
      expectContains(PROBE, 'feather: 100,')
      expectContains(PROBE, "brushId: 'bristle-flat',")
    })

    it('reaches the scene only through the closed-list scenario name', () => {
      expectContains(PROBE, "scenario === 'bristle-edge'")
      expectContains(PROBE, 'bristleEdgeScript()')
    })
  })

  describe('the feather knob is an additive per-entry bag key', () => {
    it('forwards feather only when the entry carries it', () => {
      expectContains(PROBE, 'readonly feather?: number')
      expectContains(PROBE, "if (entry.feather !== undefined) bag['feather'] = entry.feather")
    })
  })

  describe('the report carries the census fields', () => {
    it('reports both strokes softness and variation plus the half-width', () => {
      expectContains(PROBE, 'edgeSoftnessPxFeather0: round2(feather0.softnessPx),')
      expectContains(PROBE, 'edgeSoftnessPxFeather100: round2(feather100.softnessPx),')
      expectContains(PROBE, 'edgeVariationPxFeather0: round2(feather0.variationPx),')
      expectContains(PROBE, 'edgeVariationPxFeather100: round2(feather100.variationPx),')
      expectContains(
        PROBE,
        'edgeHalfWidthPx: round2((feather0.halfWidthPx + feather100.halfWidthPx) / 2),',
      )
      expectContains(PROBE, 'edgePlateauAlphaFeather0: round2(feather0.plateauAlpha),')
      expectContains(PROBE, 'edgePlateauAlphaFeather100: round2(feather100.plateauAlpha),')
      expectContains(PROBE, 'edgeSkippedStations: skips,')
      expectContains(PROBE, 'edgeFailures: failures,')
    })

    it('measures the film darkness on the transparent export', () => {
      expectContains(PROBE, 'function bristleEdgeMetrics(sheet: HTMLCanvasElement)')
      expectContains(PROBE, 'const pixels = ctx.getImageData(0, 0, w, h).data')
      expectContains(
        PROBE,
        'data[i + 3] = 255 - Math.min(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!)',
      )
      expectContains(PROBE, 'bristleEdgeMetrics(transparentCanvas)')
    })

    it('guards the blank film and the dash-gap station by name', () => {
      expectContains(PROBE, 'const EDGE_MIN_PLATEAU = 0.02')
      expectContains(PROBE, 'if (!(plateauAlpha >= EDGE_MIN_PLATEAU)) {')
      expectContains(PROBE, 'if (!(startNorm >= 0.9)) {')
      expectContains(PROBE, 'a dash gap')
    })
  })

  describe('the comparator gates the census relations in every mode', () => {
    it('maps bristle-edge to its failure function', () => {
      expectContains(COMPARE, "'bristle-edge': bristleEdgeFailures,")
      expectContains(COMPARE, 'function bristleEdgeFailures(data) {')
    })

    it('bars the cardinal relations, never the absolute pixels', () => {
      expectContains(COMPARE, 'data.edgeSoftnessPxFeather0 > 0')
      expectContains(COMPARE, 'data.edgeSoftnessPxFeather100 > 0')
      expectContains(COMPARE, 'data.edgeSoftnessPxFeather100 > data.edgeSoftnessPxFeather0')
      expectContains(COMPARE, 'data.edgeVariationPxFeather0 > 0')
      expectContains(COMPARE, 'data.edgeVariationPxFeather100 > 0')
      expectContains(COMPARE, 'data.edgeSoftnessPxFeather100 < data.edgeHalfWidthPx')
      expectContains(COMPARE, 'Array.isArray(data.edgeFailures)')
    })
  })
})
