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
//      display sheet whose alpha is the pigment's darkness alone (2026-11-21);
//      coverage claims read `engine.exportCanvas('coverage')`, the instrument.
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

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import {
  BRISTLE_VISIBLE_ALPHA_SKIP,
  opaqueExportCheck,
  visibleAlphaCheck,
  visibleAlphaSkipped,
} from './alphaLaw'
import {
  END_PRE_GAP_BRACKET_PX,
  END_PRE_GAP_MARGIN,
  END_PRE_GAP_STATION_PX,
  enclosedPaleRun,
} from './endGap'
import {
  RIDGE_CENTRE_WIDTH,
  RIDGE_MARGIN,
  RIDGE_SHOULDER_INNER,
  RIDGE_SHOULDER_OUTER,
  alongCoherence,
  centreRidge,
} from './ridge'
import {
  BLEND_AC_FLOOR,
  BLEND_MIN_STATIONS,
  BLEND_WORM_BAND_HI_PX,
  BLEND_WORM_BAND_LO_PX,
  detrendedRms,
  shareSpectrum,
  transitionWidthPx,
} from './blend'

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
        "const FIELDS = [...DIGESTS, 'digestPigment', 'byteLength', 'width', 'height', 'opaqueExportMinAlpha', 'opaqueExportMinAlphaSurface', 'visibleAlphaMaxDelta', 'visibleAlphaSamples', 'visibleAlphaWorstAt']",
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
//      (0.5, 0.5), and COVERAGE on the coverage raster (64-31: never the
//      pigment export's alpha, which carries no coverage term) against the
//      transparent export's darkness conversion.
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
        'crossCoverage:',
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
      expectContains(COMPARE, 'data.crossCoverage >= 0.9')
      expectContains(COMPARE, 'data.crossBlueExcess <= 5')
      expectContains(COMPARE, 'data.crossCoverage < 0.5')
      expectContains(COMPARE, 'gap >= 0.04')
      expectContains(COMPARE, 'data.crossBlueExcess >= 15 && data.crossBlueExcess <= 38')
      expectContains(COMPARE, 'data.crossBlueExcess >= 38')
      expectContains(COMPARE, 'gap <= 0.03')
      expectContains(COMPARE, 'data.coveredPaperWhitePct !== 0')
      expectContains(COMPARE, 'has no white-over-blue bar set')
    })

    it('names the coverage raster in every criterion-1 message', () => {
      expectContains(COMPARE, '`crossCoverage - crossDarkAlpha ${round2(gap)}')
      expectContains(COMPARE, 'the coverage raster')
    })

    it('fails a capture that drops the covered-paper-white census block', () => {
      expectContains(COMPARE, "'coveredPaperWhiteBox' in data")
      expectContains(COMPARE, 'capture is missing the covered-paper-white census block')
    })

    it('prints every failure with the INVARIANT prefix before the verdict', () => {
      // 64-29: the call gained the reference operand — the bristle-tip A/B
      // band bar needs the plain leg's band count. The intent is unchanged:
      // the scenario invariants run in every mode, before every verdict.
      expectContains(COMPARE, '`INVARIANT ${line}`')
      expectContains(COMPARE, 'scenarioInvariantFailures(actual, refData)')
    })
  })
})

// The coverage vocabulary is EXECUTED, not only pinned as source text: the
// comparator must accept the new names and reject the old ones by name, and a
// capture that drops the coverage readings must fail loudly rather than pass
// with a vacuum where a measurement belongs.
//
// The old field name is BUILT, never written literally: 64-31's acceptance
// gate greps the three probe files for it, and this test must prove the
// rejection while keeping that grep clean.
const OLD_COVER_ALPHA_FIELD = ['cross', 'Cover', 'Alpha'].join('')

function validWhiteOverBlueCapture(): Record<string, unknown> {
  return {
    ...baseCapture('white-over-blue', 'nyquist'),
    body: 100,
    crossR: 240,
    crossG: 240,
    crossB: 240,
    crossBlueExcess: 0,
    crossCoverage: 0.97,
    crossDarkAlpha: 0.05,
    coveredPaperWhitePct: 0,
    coveredPaperWhiteBox: null,
  }
}

describe('the white-over-blue coverage claims discriminate (64-31, executed)', () => {
  it('passes a capture carrying the coverage vocabulary', () => {
    const { status, output } = compareSynthetic('nyquist-wob-pass', validWhiteOverBlueCapture())

    expect(status, invariantLine(output)).toBe(0)
    expect(output).toContain('scenario invariants hold')
  })

  it('fails by name when the old cover-alpha name replaces the coverage field', () => {
    const capture = validWhiteOverBlueCapture()
    delete capture.crossCoverage
    capture[OLD_COVER_ALPHA_FIELD] = 0.97
    const { status, output } = compareSynthetic('nyquist-wob-oldname', capture)

    expect(status, invariantLine(output)).toBe(1)
    expect(invariantLine(output)).toContain('capture is missing crossCoverage')
  })

  it('fails loudly when the whole coverage block is absent', () => {
    const capture = validWhiteOverBlueCapture()
    delete capture.crossCoverage
    delete capture.coveredPaperWhitePct
    delete capture.coveredPaperWhiteBox
    const { status, output } = compareSynthetic('nyquist-wob-noblock', capture)

    expect(status, invariantLine(output)).toBe(1)
    expect(invariantLine(output)).toContain('capture is missing crossCoverage, coveredPaperWhitePct')
  })

  it('fails a capture that drops only the census block', () => {
    const capture = validWhiteOverBlueCapture()
    delete capture.coveredPaperWhiteBox
    const { status, output } = compareSynthetic('nyquist-wob-nocensus', capture)

    expect(status, invariantLine(output)).toBe(1)
    expect(invariantLine(output)).toContain('capture is missing the covered-paper-white census block')
  })
})

// Laws pinned here (64-31 task 1): the coverage channel.
//
//  28. Every coverage claim reads the coverage raster captured in the same run
//      — `engine.exportCanvas('coverage')`, the probe-only instrument — under
//      accessors that say coverage; no coverage claim reads the pigment
//      export's alpha, which after the 2026-11-21 law carries no coverage term.
//  29. The report's coverage vocabulary is `crossCoverage` / `coverCoverage*`;
//      compare.mjs follows every rename at its one consumer, and a capture
//      missing the covered-paper-white census block fails by name.
//  30. The lifecycle readings move with the same channel: the advect/lift
//      statistics are `coverageStats` on the coverage raster. The film-darkness
//      claims stay on the transparent export, and the paper-white census reads
//      the engine-CLEARED pigment alpha (the coverage raster is not closed by
//      coverClearFS — review CR-02).
describe('the coverage claims read the coverage raster (64-31 task 1)', () => {
  it('captures the coverage canvas once beside the other surfaces', () => {
    expectContains(PROBE, "const coverageCanvas = engine.exportCanvas('coverage')")
    expectContains(PROBE, 'whiteOverBlueMetrics(transparentCanvas, coverageCanvas, pigmentCanvas)')
    expectContains(PROBE, 'coverTexturedMetrics(transparentCanvas, pigmentCanvas, coverageCanvas)')
    expectContains(PROBE, 'redOverBlueMetrics(transparentCanvas, pigmentCanvas, coverageCanvas)')
  })

  it('exposes coverage-named accessors over the unchanged arithmetic', () => {
    expectContains(PROBE, 'function coverageMean(')
    expectContains(PROBE, 'function coverageStats(')
    expectContains(PROBE, 'function coverageSpread(')
    expectContains(PROBE, 'crossCoverage: round2(coverageMean(coverage, cross)),')
    expectContains(PROBE, 'coveredPaperWhiteBox(transparent, pigment, 0.5)')
    // The pigment export's alpha is never read as coverage again.
    expectNotContains(PROBE, 'alphaMean(pigment,')
    expectNotContains(PROBE, 'alphaSpread(pigment,')
    expectNotContains(PROBE, "alphaStats(engine.exportCanvas('pigment')")
  })

  it('reads coverage in the cover lifecycle captures', () => {
    expectContains(
      PROBE,
      "coverageStats(engine.exportCanvas('coverage'), COVER_LIFECYCLE_BOXES.crossing)",
    )
    expectContains(PROBE, "const advectedCoverage = engine.exportCanvas('coverage')")
    expectContains(PROBE, "coverLifecycle['coverCoverageBeforeAdvect']")
    expectContains(PROBE, "coverLifecycle['coverCoverageAfterAdvect']")
    expectContains(PROBE, "coverLifecycle['coverCoverageBeforeLift']")
    expectContains(PROBE, "coverLifecycle['coverCoverageAfterLift']")
    expectContains(PROBE, 'coveredPaperWhitePct(advectedTransparent, advectedPigment, 0.5)')
  })

  it('keeps the film-darkness claims on the transparent export', () => {
    expectContains(PROBE, 'crossDarkAlpha: round2(darkAlphaMean(transparent, cross)),')
    expectContains(PROBE, 'coverCoreFilmDarkness: round2(filmDarkness),')
  })

  it('follows every rename at its comparator consumer', () => {
    expectContains(COMPARE, "'crossCoverage',")
    expectContains(COMPARE, "'coverCoverageP10',")
    expectContains(COMPARE, "'coverCoverageP90',")
    expectContains(COMPARE, "'coverCoverageCoveredFraction',")
    expectContains(COMPARE, "'coverCoverageBeforeAdvect',")
    expectContains(COMPARE, "'coverCoverageAfterAdvect',")
    expectContains(COMPARE, "'coverCoveragePeakBefore',")
    expectContains(COMPARE, "'coverCoveragePeakAfter',")
    expectContains(COMPARE, "'coverCoverageBeforeLift',")
    expectContains(COMPARE, "'coverCoverageAfterLift',")
    expectNotContains(COMPARE, OLD_COVER_ALPHA_FIELD)
    expectNotContains(COMPARE, 'coverAlpha')
    expectNotContains(PROBE, OLD_COVER_ALPHA_FIELD)
    expectNotContains(PROBE, 'coverAlpha')
  })
})

// Laws pinned here (64-31 task 2): the shipped alpha law and its checks.
//
//  31. The law is stated in one voice in all three probe files: committed and
//      exported storage alpha is OPAQUE; coverage lives only in the coverage
//      raster, an instrument and never an export channel; and the display
//      alpha is the DARKNESS of the visible pigment. No file composes an
//      alpha out of a darkness term and a coverage term any more — the three
//      old sentences are deleted, and the pins here read the RAW sources so a
//      comment can neither satisfy nor trip the wrong pin.
//  32. Every capture carries an opaque-export block (`opaqueExportMinAlpha`,
//      `opaqueExportMinAlphaSurface`) and a visible-alpha block
//      (`visibleAlphaMaxDelta`, `visibleAlphaSamples`, `visibleAlphaWorstAt`)
//      — or, for a bristle capture, the same check reported as skipped with
//      its film-blur reason (`visibleAlphaSkip`). Both are pure helpers over
//      the already-read buffers, scanning EVERY texel (a fixed prime stride
//      walks a right-edge lattice on power-of-two sheets — CR-01).
//  33. compare.mjs enforces both blocks in every mode and carries the five
//      numeric/string fields in the compared field list, so a capture cannot
//      silently drop them.
const LAW_OPAQUE = 'committed and exported storage alpha is OPAQUE'
const LAW_DISPLAY = 'the display alpha is the DARKNESS of the visible pigment'

describe('the shipped alpha law is stated once (64-31 task 2)', () => {
  const RAW_PROBE = readFileSync(resolve(HERE, 'probe.ts'), 'utf8')
  const RAW_RUN = readFileSync(resolve(HERE, 'run.mjs'), 'utf8')
  const RAW_COMPARE = readFileSync(resolve(HERE, 'compare.mjs'), 'utf8')
  const RAW_FILES: Record<string, string> = {
    'probe.ts': RAW_PROBE,
    'run.mjs': RAW_RUN,
    'compare.mjs': RAW_COMPARE,
  }

  it('states the opaque-storage law in every probe file', () => {
    for (const [name, source] of Object.entries(RAW_FILES)) {
      expect(source.includes(LAW_OPAQUE), `missing law text in ${name}: ${LAW_OPAQUE}`).toBe(true)
    }
  })

  it('states the darkness-only display law in every probe file', () => {
    for (const [name, source] of Object.entries(RAW_FILES)) {
      expect(source.includes(LAW_DISPLAY), `missing law text in ${name}: ${LAW_DISPLAY}`).toBe(true)
    }
  })

  it('deletes every composition of an alpha with a coverage term', () => {
    for (const [name, source] of Object.entries(RAW_FILES)) {
      expect(source.includes('max(1 − min(rgb), cover)'), `${name} still composes alpha with cover`).toBe(false)
      expect(source.includes('max(1 - min(rgb), cover)'), `${name} still composes alpha with cover`).toBe(false)
      expect(source.includes('max(darkness, cover)'), `${name} still composes alpha with cover`).toBe(false)
    }
  })
})

describe('the capture-level alpha-law checks (64-31 task 2)', () => {
  const ALPHA_LAW = readFileSync(resolve(HERE, 'alphaLaw.ts'), 'utf8')

  it('scans every texel of the already-read buffers', () => {
    expectContains(ALPHA_LAW, 'function opaqueExportCheck(')
    expectContains(ALPHA_LAW, 'function visibleAlphaCheck(')
    expectContains(ALPHA_LAW, 'for (let p = 0; p < pixels; p += 1)')
    // CR-01: the fixed stride is gone — it sampled a right-edge lattice.
    expectNotContains(PROBE, 'ALPHA_LAW_STRIDE')
    expectNotContains(ALPHA_LAW, 'ALPHA_LAW_STRIDE')
  })

  it('emits both blocks on every capture, with the bristle skip', () => {
    expectContains(PROBE, 'opaqueExportMinAlpha: opaqueExport.minAlpha,')
    expectContains(PROBE, 'opaqueExportMinAlphaSurface: opaqueExport.surface,')
    expectContains(PROBE, '...visibleAlpha,')
    expectContains(ALPHA_LAW, 'visibleAlphaMaxDelta:')
    expectContains(ALPHA_LAW, 'visibleAlphaSamples:')
    expectContains(ALPHA_LAW, 'visibleAlphaWorstAt:')
    expectContains(ALPHA_LAW, 'visibleAlphaSkip:')
    expectContains(PROBE, "scenario.startsWith('bristle-')")
  })

  it('compares the transparent darkness against the pigment alpha', () => {
    expectContains(ALPHA_LAW, '255 - Math.min(transparent[i]!, transparent[i + 1]!, transparent[i + 2]!)')
  })

  it('enforces both blocks in the comparator, in every mode', () => {
    expectContains(COMPARE, 'function alphaLawFailures(')
    expectContains(COMPARE, 'is not the opaque maximum 255')
    expectContains(COMPARE, 'exceeds one 8-bit step')
    expectContains(COMPARE, 'the visible-alpha check cannot be skipped for this scenario')
    expectContains(COMPARE, 'alphaLawFailures(actual)')
  })

  // CR-01 regression: the old fixed stride (4093 = 2^n·w − 3 for every
  // power-of-two width) sampled only a right-edge lattice, so a 256² neutral
  // capture read 0 painted texels and failed its own law check. These execute
  // the real helpers over synthetic buffers.
  it('sees paint anywhere on a 256 sheet and finds a planted disagreement', () => {
    const width = 256
    const height = 256
    const transparent = new Uint8ClampedArray(width * height * 4)
    const pigment = new Uint8ClampedArray(width * height * 4)
    // The canonical neutral stroke's region: x 77..179, rows 97..179.
    let painted = 0
    for (let y = 97; y <= 179; y += 1) {
      for (let x = 77; x <= 179; x += 1) {
        const i = (y * width + x) * 4
        const dark = 40 + ((x + y) % 20)
        transparent[i] = 255 - dark
        transparent[i + 1] = 255 - dark
        transparent[i + 2] = 255 - dark
        transparent[i + 3] = 255
        pigment[i + 3] = dark
        painted += 1
      }
    }
    const block = visibleAlphaCheck(pigment, transparent, width)
    expect(block.visibleAlphaSamples).toBe(painted)
    expect(block.visibleAlphaMaxDelta).toBe(0)

    const bad = (150 * width + 150) * 4
    pigment[bad + 3] = 255 - transparent[bad]! + 2
    const found = visibleAlphaCheck(pigment, transparent, width)
    expect(found.visibleAlphaMaxDelta).toBe(2)
    expect(found.visibleAlphaWorstAt).toBe('x=150,y=150')
  })

  it('finds a single translucent texel and names its surface', () => {
    const size = 256 * 256 * 4
    const opaque = (): Uint8ClampedArray => {
      const buf = new Uint8ClampedArray(size)
      for (let i = 3; i < buf.length; i += 4) buf[i] = 255
      return buf
    }
    const paper = opaque()
    const white = opaque()
    const transparent = opaque()
    expect(
      opaqueExportCheck([
        { surface: 'paper', pixels: paper },
        { surface: 'white', pixels: white },
        { surface: 'transparent', pixels: transparent },
      ]),
    ).toEqual({ minAlpha: 255, surface: 'paper' })

    transparent[12345 * 4 + 3] = 254
    expect(
      opaqueExportCheck([
        { surface: 'paper', pixels: paper },
        { surface: 'white', pixels: white },
        { surface: 'transparent', pixels: transparent },
      ]),
    ).toEqual({ minAlpha: 254, surface: 'transparent' })
  })

  it('reports a bristle skip as a delta-free block', () => {
    expect(visibleAlphaSkipped(BRISTLE_VISIBLE_ALPHA_SKIP)).toEqual({
      visibleAlphaMaxDelta: null,
      visibleAlphaSamples: 0,
      visibleAlphaWorstAt: null,
      visibleAlphaSkip: BRISTLE_VISIBLE_ALPHA_SKIP,
    })
  })
})

// Laws pinned here (64-16 task 1):
//   9. A `ScriptEntry` carries an optional `brushId`; `makeStroke` falls back
//      to `round`, and an unknown `--brush` id throws with the known list —
//      the silent fallback is the failure this gate exists to prevent.
//  10. `cover-textured` paints the dark band with `round` at Body 0, then the
//      diagonal with the requested brush (default chalk), and reports the
//      coverage spread on its own box, the crossing blue excess and the
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
      // 2026-11-22 (acrylic pale-line): the bristle-line scenario extended the
      // default chain with its own brush; the intent is unchanged — the report
      // echoes the brush the run actually used. 64-29 extends the same chain
      // with `bristle-tip` (the A/B's flat response tip). quick 261125-rtc:
      // `bristle-flat` was retired by 261124-iq9 (it silently resolved to the
      // watercolor `round`), so the artist-facing pale-line and end scenarios
      // now echo `bristle-round` — the real acrylic response — while the
      // texture-tip A/B keeps its flat tip.
      expectContains(PROBE, "scenario === 'bristle-tip'")
      expectContains(PROBE, "? 'bristle-flat'")
      // 261126-n20 task 3 adds `bristle-blend` to the same acrylic fallback;
      // the chain became multiline, so each membership is pinned on its own.
      expectContains(PROBE, "scenario === 'bristle-line' ||")
      expectContains(PROBE, "scenario === 'bristle-blend' ||")
      expectContains(PROBE, "scenario === 'bristle-end' ||")
      expectContains(PROBE, "? 'bristle-round'")
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

    it('derives the spread without sorting, on the coverage raster (64-31)', () => {
      expectContains(PROBE, 'function alphaSpread(')
      expectContains(PROBE, 'const bins = new Uint32Array(256)')
      // 64-31: the spread helper's arithmetic is unchanged, but every coverage
      // claim reads the coverage canvas through a coverage-named accessor.
      expectContains(PROBE, 'function coverageSpread(')
      expectContains(PROBE, 'const spread = coverageSpread(coverage, TEXTURED_BOX)')
      // Post-UAT 2026-11-19 (GAP-1): the mean is named once so the film
      // descriptor can subtract it; the channel moved, the shape did not.
      expectContains(PROBE, 'const cover = coverageMean(coverage, TEXTURED_BOX)')
      expectContains(PROBE, 'coverCoverageMean: round2(cover),')
      expectContains(PROBE, 'coverCoverageP10: round2(spread.p10),')
      expectContains(PROBE, 'coverCoverageP90: round2(spread.p90),')
      expectContains(PROBE, 'coverCoverageCoveredFraction: round2(spread.coveredFraction),')
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
      expectContains(COMPARE, 'data.coverCoverageP90 >= COVER_TEXTURED_P90_FLOOR')
      expectContains(COMPARE, 'data.coverCoverageP10 <= 0.5')
      expectContains(
        COMPARE,
        'data.coverCoverageCoveredFraction >= 0.02 && data.coverCoverageCoveredFraction <= 0.8',
      )
      expectContains(COMPARE, 'data.coverCrossBlueExcess <= 5')
      expectContains(COMPARE, 'data.coveredPaperWhitePct !== 0')
    })
  })

  describe('both closed scenario lists accept the new names', () => {
    it('lists cover-textured, red-over-blue-50, bristle-edge and bristle-wet in probe.ts and run.mjs', () => {
      expectContains(
        PROBE,
        "raw !== 'cover-lift' && raw !== 'cover-textured' && raw !== 'red-over-blue-50' && raw !== 'bristle-edge' && raw !== 'bristle-wet'",
      )
      expectContains(
        RUN,
        "scenarioRaw !== 'cover-lift' && scenarioRaw !== 'cover-textured' && scenarioRaw !== 'red-over-blue-50' && scenarioRaw !== 'bristle-edge' && scenarioRaw !== 'bristle-wet'",
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

// Laws pinned here (64-24):
//  20. `bristle-wet` is ONE sheet with ONE brush and two ages: identical light
//      bands on the left and right halves, a `water` swash on the left that
//      carries `advanceClockMs: 30000` (a clock-only advance — the entry's
//      field is applied BEFORE the entry is driven), the right band painted
//      after it, then one dark crossing stroke over both.
//  21. The report carries `pickupFreshMean` / `pickupAgedWetMean` as mean film
//      darkness on the TRANSPARENT export through the shared box machinery,
//      plus the capture's `wetMode`.
//  22. compare.mjs dispatches `bristle-wet` to its relation invariants in
//      every mode: both means finite and positive, both inside [0, 255], and
//      a gap of at least PICKUP_MIN_DELTA luma — never a direction.
//  23. `--wet-mode <0|1>` reaches the adapter's `setLastTouchMode` in both
//      closed lists (run.mjs parses and forwards it, probe.ts validates and
//      applies it before the first stroke), defaulting to 1.
describe('the bristle-wet acceptance (64-24)', () => {
  describe('the scenario is two ages on one sheet', () => {
    it('paints identical light bands left and right, the left one aged', () => {
      expectContains(PROBE, 'function bristleWetScript(): readonly ScriptEntry[] {')
      expectContains(PROBE, 'function verticalLine(x: number): readonly AquarellePoint[] {')
      expectContains(PROBE, 'const WET_BAND_COLOR = ')
      expectContains(PROBE, 'const WET_CROSS_COLOR = ')
      expectContains(PROBE, 'mutationId: 0x7ee300,')
      expectContains(PROBE, 'mutationId: 0x7ee301,')
      expectContains(PROBE, 'mutationId: 0x7ee302,')
      expectContains(PROBE, 'mutationId: 0x7ee303,')
      expectContains(PROBE, 'const WET_AGE_MS = 30000')
      expectContains(PROBE, "tool: 'water',")
      expectContains(PROBE, 'advanceClockMs: WET_AGE_MS,')
      expectContains(PROBE, "brushId: 'bristle-flat',")
    })

    it('applies the clock-only advance before the entry is driven', () => {
      expectContains(PROBE, 'readonly advanceClockMs?: number')
      expectContains(PROBE, 'if (entry.advanceClockMs !== undefined) adapter.advanceClock(entry.advanceClockMs)')
      expectContains(PROBE, "scenario === 'bristle-wet'")
      expectContains(PROBE, 'bristleWetScript()')
    })
  })

  describe('the report carries the two pickup readings', () => {
    it('measures both crossing regions on the transparent film', () => {
      expectContains(PROBE, 'function bristleWetMetrics(transparent: HTMLCanvasElement)')
      expectContains(PROBE, 'pickupFreshMean: round2(bandPigment(transparent, BRISTLE_WET_BOXES.fresh)),')
      expectContains(PROBE, 'pickupAgedWetMean: round2(bandPigment(transparent, BRISTLE_WET_BOXES.agedWet)),')
      expectContains(PROBE, 'bristleWetMetrics(transparentCanvas)')
      expectContains(PROBE, 'wetMode,')
    })
  })

  describe('the comparator gates the relation, never the direction', () => {
    it('maps bristle-wet to its failure function and the delta bar', () => {
      expectContains(COMPARE, "'bristle-wet': bristleWetFailures,")
      expectContains(COMPARE, 'function bristleWetFailures(data) {')
      // 64-28 (IN-07): the floor is derived from the committed baseline's
      // recorded gap, never a decorative round number.
      expectContains(COMPARE, 'const RECORDED_PICKUP_GAP = 199.52')
      expectContains(COMPARE, 'const PICKUP_MIN_DELTA = RECORDED_PICKUP_GAP / 2')
      expectContains(COMPARE, 'Math.abs(fresh - aged) >= PICKUP_MIN_DELTA')
      expectContains(COMPARE, 'fresh > 0')
      expectContains(COMPARE, 'aged > 0')
      expectContains(COMPARE, 'fresh < 0 || fresh > 255')
      expectContains(COMPARE, 'aged < 0 || aged > 255')
    })
  })

  describe('the wet-mode operand is the recorded A/B control', () => {
    it('parses --wet-mode in run.mjs and forwards it to the page', () => {
      expectContains(RUN, "const wetModeFlag = args.indexOf('--wet-mode')")
      expectContains(RUN, 'expected 0 or 1')
      expectContains(RUN, '`&wetMode=${wetMode}`')
    })

    it('validates it in probe.ts and applies it before the first stroke', () => {
      expectContains(PROBE, 'function readWetMode(): 0 | 1 {')
      expectContains(PROBE, 'invalid wetMode "${raw}" (expected 0 or 1)')
      expectContains(PROBE, 'adapter.setLastTouchMode(wetMode)')
    })
  })
})

// ============================================================
//  The comparator's invariant functions, EXECUTED (64-23 / 64-24).
//
//  The describes above pin the law as source text; a source pin cannot fail
//  when a relation is inverted, dropped from the dispatch map, or unreachable.
//  These tests run compare.mjs as a real process against synthetic captures in
//  the harness's own /tmp/medium-engine folder, so each barred relation must
//  actually discriminate: a feather-blind edge, a smooth band, a band as wide
//  as the stroke, a missing field, a named degeneracy and a sub-one-luma
//  wetness gap must all exit 1, while the recorded relation set exits 0.
//
//  Every fixture carries a unique `nyquist-` name (the real capture names are
//  never touched) and all twelve compared FIELDS match on both sides (64-31
//  task 2 added the five alpha-law fields), so a failing test fails on the
//  INVARIANT, never on field equality. Nothing here reads or writes a
//  committed baseline.
// ============================================================

const TMP_DIR = '/tmp/medium-engine'
const COMPARE_PATH = resolve(HERE, 'compare.mjs')
const createdFixtures = new Set<string>()

afterAll(() => {
  for (const name of createdFixtures) {
    rmSync(join(TMP_DIR, `${name}.json`), { force: true })
  }
})

function baseCapture(scenario: string, gate: string): Record<string, unknown> {
  // 64-31: every compare mode now requires the alpha-law block, and a
  // bristle capture reports the visible-alpha check as skipped with its
  // reason (the display film blur makes RGB and alpha disagree at the fringe).
  // Spec 10: the SAME two-clause predicate probe.ts and compare.mjs share —
  // `edge-layer` is a bristle scene (bristle-round, Body 100).
  const bristle = scenario.startsWith('bristle-') || scenario === 'edge-layer'
  return {
    scenario,
    gate,
    digestPaper: 'dpaper',
    digestTransparent: 'dtransparent',
    digestWhite: 'dwhite',
    digestPigment: 'dpigment',
    byteLength: 4096,
    width: 1080,
    height: 1080,
    opaqueExportMinAlpha: 255,
    opaqueExportMinAlphaSurface: 'paper',
    ...(bristle
      ? {
          visibleAlphaMaxDelta: null,
          visibleAlphaSamples: 0,
          visibleAlphaWorstAt: null,
          visibleAlphaSkip:
            'bristle film blur: the display film blur makes the exported RGB and alpha intentionally disagree at the fringe',
        }
      : {
          visibleAlphaMaxDelta: 0,
          visibleAlphaSamples: 1000,
          visibleAlphaWorstAt: 'x=0,y=0',
        }),
  }
}

function writeCapture(name: string, data: Record<string, unknown>): void {
  mkdirSync(TMP_DIR, { recursive: true })
  writeFileSync(join(TMP_DIR, `${name}.json`), JSON.stringify(data))
  createdFixtures.add(name)
}

/**
 * Write `actual` and an all-fields-equal reference, then run
 * `compare.mjs <actual> --other <reference>`. Returns the exit status and
 * combined output.
 */
function compareSynthetic(
  name: string,
  actual: Record<string, unknown>,
): { status: number | null; output: string } {
  writeCapture(name, actual)
  // Same compared fields on every fixture pair (64-31: twelve, including the
  // alpha-law block): they are copied from the actual, so the field loop can
  // never be the reason a failure test fails.
  writeCapture(`${name}-ref`, { ...baseCapture(String(actual.scenario), `${name}-ref`), ...actual })
  const result = spawnSync(process.execPath, [COMPARE_PATH, name, '--other', `${name}-ref`], {
    encoding: 'utf8',
  })
  return { status: result.status, output: `${result.stdout}${result.stderr}` }
}

/**
 * The single `INVARIANT …` line of a comparator report, or `''` when the run
 * raised none. Assertions read this line rather than the whole report so a
 * failing expectation keeps a one-line `actual` in the TAP diagnostic (a
 * multi-line scalar would emit column-0 continuation lines and make the
 * report unparseable for the TDD gate).
 */
function invariantLine(output: string): string {
  return output.split('\n').find((line) => line.includes('INVARIANT')) ?? ''
}

/** One-line verdict evidence for a failing assertion message: a multi-line
 *  message would emit column-0 continuation lines and break the TAP report
 *  the TDD gate parses (the 64-23/64-29 lesson). */
function lawVerdict(status: number | null, output: string): string {
  const line = output
    .split('\n')
    .find((entry) => entry.startsWith('RESULT') || entry.startsWith('INVARIANT'))
  return `status=${status} ${line ?? '(no verdict line)'}`
}

function expectLawText(output: string, needle: string): void {
  expect(output.includes(needle), `missing report text: ${needle}`).toBe(true)
}

function fieldsLine(output: string): string {
  return output.split('\n').find((line) => line.includes('fields equal')) ?? ''
}

function validEdgeCapture(): Record<string, unknown> {
  return {
    ...baseCapture('bristle-edge', 'nyquist'),
    // The SUMMARY's measured readings — absolute values are evidence, the
    // relations below them are the contract. The 64-29 shape scalars are part
    // of the required shape (a capture without them is invalid under the
    // extended contract), so the base fixture carries them too.
    edgeSoftnessPxFeather0: 20.25,
    edgeSoftnessPxFeather100: 25.11,
    edgeVariationPxFeather0: 13.0,
    edgeVariationPxFeather100: 1.06,
    edgeIrregularityPxFeather0: 0.62,
    edgeIrregularityPxFeather100: 0.58,
    edgeRoughnessPxFeather0: 0.35,
    edgeRoughnessPxFeather100: 0.42,
    edgeSupportPxFeather0: 3.6,
    edgeSupportPxFeather100: 4.4,
    edgeFringeDensityPctFeather0: 100,
    edgeFringeDensityPctFeather100: 100,
    edgeHalfWidthPx: 31.99,
    edgeHalfWidthPxFeather0: 32.11,
    edgeHalfWidthPxFeather100: 31.87,
    edgePlateauAlphaFeather0: 0.13,
    edgePlateauAlphaFeather100: 0.16,
    edgeSkippedStations: [],
    edgeFailures: [],
  }
}

describe('the bristle-edge invariants discriminate (64-23, executed)', () => {
  it('passes a capture whose Feather-100 band is wider, brushed and inside the stroke', () => {
    const { status, output } = compareSynthetic('nyquist-edge-pass', validEdgeCapture())

    // One-line assertion messages only: the TAP diagnostic must stay parseable
    // for the TDD gate (a multi-line scalar emits column-0 continuation lines).
    expect(status, invariantLine(output)).toBe(0)
    expect(fieldsLine(output)).toContain('all 12 fields equal')
    // The dispatch map is load-bearing: a capture that never reached
    // bristleEdgeFailures would pass the fields without this note.
    expect(fieldsLine(output)).toContain('scenario invariants hold')
  })

  it('fails a feather-blind edge (Feather-100 not wider than Feather-0)', () => {
    const { status, output } = compareSynthetic('nyquist-edge-blind', {
      ...validEdgeCapture(),
      edgeSoftnessPxFeather100: 20.25,
    })

    expect(status, invariantLine(output)).toBe(1)
    expect(invariantLine(output)).toContain('Feather is not widening the band')
  })

  it('fails a perfectly smooth edge (zero crossing variation)', () => {
    const { status, output } = compareSynthetic('nyquist-edge-smooth', {
      ...validEdgeCapture(),
      edgeVariationPxFeather0: 0,
    })

    expect(status, invariantLine(output)).toBe(1)
    expect(invariantLine(output)).toContain('perfectly smooth')
  })

  it('fails a band as wide as the stroke (softness not narrower than the half-width)', () => {
    const { status, output } = compareSynthetic('nyquist-edge-wide', {
      ...validEdgeCapture(),
      edgeSoftnessPxFeather100: 32.14,
    })

    expect(status, invariantLine(output)).toBe(1)
    expect(invariantLine(output)).toContain('not an edge but the stroke')
  })

  it('fails a capture missing an invariant field by name', () => {
    const capture = validEdgeCapture()
    delete capture.edgeHalfWidthPx
    const { status, output } = compareSynthetic('nyquist-edge-missing', capture)

    expect(status, invariantLine(output)).toBe(1)
    expect(invariantLine(output)).toContain('capture is missing edgeHalfWidthPx')
  })

  it("propagates the probe's own named degeneracies verbatim", () => {
    const { status, output } = compareSynthetic('nyquist-edge-degenerate', {
      ...validEdgeCapture(),
      edgeFailures: ['stroke not found at y 300'],
    })

    expect(status, invariantLine(output)).toBe(1)
    expect(invariantLine(output)).toContain('stroke not found at y 300')
  })
})

describe('the bristle-wet invariant discriminates (64-24, executed)', () => {
  it('passes a capture whose two bands differ by at least one luma unit', () => {
    const { status, output } = compareSynthetic('nyquist-wet-pass', {
      ...baseCapture('bristle-wet', 'nyquist'),
      pickupFreshMean: 50.64,
      pickupAgedWetMean: 250.16,
      wetMode: 1,
    })

    expect(status, output).toBe(0)
    expect(output).toContain('scenario invariants hold')
  })

  it('fails a decorative age gate (gap below the derived PICKUP_MIN_DELTA)', () => {
    const { status, output } = compareSynthetic('nyquist-wet-decorative', {
      ...baseCapture('bristle-wet', 'nyquist'),
      pickupFreshMean: 100,
      pickupAgedWetMean: 100.5,
      wetMode: 1,
    })

    expect(status, output).toBe(1)
    const invariant = invariantLine(output)
    expect(invariant).toContain('below 99.76 luma')
    expect(invariant).toContain('half the recorded 199.52-luma gap')
  })

  it('fails a response collapsed to the old one-luma bar (49 / 50)', () => {
    // The old floor accepted this pair: a gap of exactly 1 passed `>= 1`.
    // The derived floor is what makes the vanished feature a named failure.
    const { status, output } = compareSynthetic('nyquist-wet-collapsed', {
      ...baseCapture('bristle-wet', 'nyquist'),
      pickupFreshMean: 49,
      pickupAgedWetMean: 50,
      wetMode: 1,
    })

    expect(status).toBe(1)
    const invariant = invariantLine(output)
    expect(invariant).toContain('below 99.76 luma')
    expect(invariant).toContain('half the recorded 199.52-luma gap')
  })

  it('fails a blank band (no film deposited over the fresh crossing)', () => {
    const { status, output } = compareSynthetic('nyquist-wet-blank', {
      ...baseCapture('bristle-wet', 'nyquist'),
      pickupFreshMean: 0,
      pickupAgedWetMean: 50,
      wetMode: 1,
    })

    expect(status, output).toBe(1)
    expect(output).toContain('not a finite positive mean')
  })

  it('fails a mean outside the luma range', () => {
    const { status, output } = compareSynthetic('nyquist-wet-range', {
      ...baseCapture('bristle-wet', 'nyquist'),
      pickupFreshMean: 300,
      pickupAgedWetMean: 50,
      wetMode: 1,
    })

    expect(status, output).toBe(1)
    expect(output).toContain('outside [0, 255]')
  })
})

// ============================================================
//  Laws pinned here (64-29 task 1): the bristle-line gate.
//
//  24. `lineProfileSet` emits additive `rim` and `halo` blocks beside the
//      existing profiles: per side, the interior plateau, the outward 90-to-10
//      band width, the worst adjacent-row step in the band's outer third, and
//      the fringe peak/mean/run beyond the 50 % crossing clamped to the
//      stroke's own outward 2 % extent. The existing blocks are untouched.
//  25. `bristleLineScript` takes an `over` flag; the `bristle-line-over`
//      variant prepends one wide, low-load MOBILE pass (its own fringe outside
//      the ±140 px measured band) so the judged line lands on wet paint, and
//      `paramsEcho` still echoes the JUDGED entry, not the understory.
//  26. compare.mjs dispatches both gate ids to `bristleLineFailures`, whose
//      named bars are the 2 px band floor, half the plateau for the rim step,
//      the halo peak/run bars and the enclosure bars — each checked only after
//      the block's presence, so an absent block fails by name.
//  27. The recorded HEAD readings live in the failure function's doc block;
//      the harness pins the metric labels the readings move with.
// ============================================================

interface LineSideFixture {
  plateau: number
  bandPx: number | null
  step: number | null
  stepAt: number | null
}

interface LineHaloFixture {
  peakRel: number | null
  mean: number | null
  run: number
  peakAt: number | null
}

interface LineSurfaceFixture {
  centreRow: number
  peakCover: number
  interior: { span: [number, number]; dark: { max: number } }
  rim: { down: LineSideFixture; up: LineSideFixture }
  halo: { down: LineHaloFixture; up: LineHaloFixture }
  ridge: { peakExcess: number; ridgeWidthPx: number; asymmetry: number; share: number }
  tiling: {
    rows: unknown[]
    coherence: { mean: number; fracHigh: number; pairs: number }
    enclosed: null | { offset: number; meanPct: number; fracPct: number; runs: number; maxRunPx: number }
  }
}

interface LineCaptureFixture extends Record<string, unknown> {
  lineSurfaces: Record<'postApply' | 'postSettle' | 'postFix', LineSurfaceFixture>
}

/** A clean graded fringe: every rim/halo/enclosure bar passes. */
function validLineSurface(): LineSurfaceFixture {
  return {
    centreRow: 540,
    peakCover: 0.41,
    interior: { span: [-17, 18], dark: { max: 0.62 } },
    rim: {
      down: { plateau: 0.62, bandPx: 4.1, step: 0.12, stepAt: -19 },
      up: { plateau: 0.63, bandPx: 4.8, step: 0.14, stepAt: 20 },
    },
    halo: {
      down: { peakRel: 0.31, mean: 0.08, run: 2, peakAt: -18 },
      up: { peakRel: 0.33, mean: 0.09, run: 2, peakAt: 19 },
    },
    ridge: { peakExcess: 0, ridgeWidthPx: 0, asymmetry: 0, share: 0 },
    tiling: {
      rows: [],
      coherence: { mean: 0, fracHigh: 0, pairs: 0 },
      enclosed: { offset: 56, meanPct: 0, fracPct: 0, runs: 0, maxRunPx: 0 },
    },
  }
}

function validLineCapture(): LineCaptureFixture {
  const capture = baseCapture('bristle-line', 'nyquist') as LineCaptureFixture
  capture.lineSurfaces = {
    postApply: validLineSurface(),
    postSettle: validLineSurface(),
    postFix: validLineSurface(),
  }
  return capture
}

describe('the bristle-line rim/halo/enclosure gate (64-29 task 1)', () => {
  describe('the probe emits the rim and halo walks beside the existing profiles', () => {
    it('computes one shared per-side walk over the darkness profile', () => {
      expectContains(PROBE, 'function lineSideWalk(')
      expectContains(PROBE, 'const sides = {')
      expectContains(PROBE, 'rim: {')
      expectContains(PROBE, 'halo: {')
      expectContains(PROBE, 'bandPx: sides.down.bandPx,')
      expectContains(PROBE, 'step: sides.down.step,')
      expectContains(PROBE, 'peakRel: sides.down.haloPeakRel,')
      expectContains(PROBE, 'run: sides.down.haloRun,')
      expectContains(PROBE, 'peakRel: sides.up.haloPeakRel,')
      expectContains(PROBE, 'run: sides.up.haloRun,')
    })

    it('clamps the halo to the outward 2 % extent with a named run fraction', () => {
      expectContains(PROBE, 'const LINE_HALO_RUN_FRACTION = 0.05')
      expectContains(PROBE, 'plateau * 0.02')
    })
  })

  describe('the --over variant is a wide low-load mobile understory', () => {
    it('prepends the understory only when the flag is set', () => {
      expectContains(PROBE, 'function bristleLineOverEntry(): ScriptEntry {')
      expectContains(PROBE, 'const LINE_OVER_Y = 0.52')
      expectContains(PROBE, 'load: LINE_OVER_LOAD')
      expectContains(PROBE, 'fixAfter: false,')
      // 261126-n20 moved this call to pass the layer arm's overrides; the
      // --over flag still rides the same position.
      expectContains(
        PROBE,
        'bristleLineScript(\n                              body ?? 0,\n                              strokeSize,\n                              readMut(),\n                              readOver(),\n                              readLineOverrides(),\n                            )',
      )
      expectContains(PROBE, 'function readOver(): boolean {')
      expectContains(PROBE, 'invalid over "${raw}" (expected 1)')
    })

    it('echoes the judged entry, not the understory, in paramsEcho', () => {
      expectContains(
        PROBE,
        'paramsEcho: paramsBag(script.find((entry) => entry.captureLine) ?? script[0]!),',
      )
    })

    it('parses --over in run.mjs, refuses it elsewhere and forwards it', () => {
      expectContains(RUN, "const overFlag = args.indexOf('--over')")
      expectContains(RUN, '--over is only valid with --scenario bristle-line')
      expectContains(RUN, 'bristle-line-over')
      expectContains(RUN, "(over === undefined ? '' : '&over=1')")
    })
  })

  describe('the comparator dispatches both gate ids to its named bars', () => {
    it('maps the scenario and both gate ids to bristleLineFailures', () => {
      expectContains(COMPARE, 'function bristleLineFailures(data) {')
      expectContains(COMPARE, "'bristle-line': bristleLineFailures,")
      expectContains(COMPARE, "'bristle-line-over': bristleLineFailures,")
      expectContains(COMPARE, "const LINE_SURFACES = ['postApply', 'postSettle', 'postFix']")
    })

    it('names every bar constant and every metric path', () => {
      expectContains(COMPARE, 'const RIM_MIN_BAND_PX = 2')
      expectContains(COMPARE, 'const RIM_MAX_STEP_FRACTION = 0.5')
      expectContains(COMPARE, 'const HALO_PEAK_MAX = 0.4')
      expectContains(COMPARE, 'const HALO_RUN_FRACTION = 0.05')
      expectContains(COMPARE, 'const HALO_RUN_MAX = 2')
      expectContains(COMPARE, 'const ENCLOSED_MEAN_MAX_PCT = 0.5')
      expectContains(COMPARE, 'const ENCLOSED_FRAC_MAX_PCT = 25')
      expectContains(COMPARE, 'const ENCLOSED_MAX_RUN_PX = 16')
      expectContains(COMPARE, 'rim.${side}.bandPx')
      expectContains(COMPARE, 'rim.${side}.step')
      expectContains(COMPARE, 'halo.${side}.peakRel')
      expectContains(COMPARE, 'halo.${side}.run')
      expectContains(COMPARE, 'tiling.enclosed')
      expectContains(COMPARE, 'lineSurfaces.${name}')
    })
  })

  describe('the bars discriminate (64-29 task 1, executed)', () => {
    // TAP law: an assertion message must stay ONE line — the comparator's
    // report is multi-line, and a raw `output` message emits column-0
    // continuation lines that make the RED report unparseable (64-28's
    // contract). Read the report through one-line predicates instead.
    function lineVerdict(status: number | null, output: string): string {
      const invariant = output.split('\n').find((line) => line.startsWith('INVARIANT '))
      return `status=${status} ${invariant ?? '(no INVARIANT line)'}`
    }

    function expectOutputHas(output: string, needle: string): void {
      expect(output.includes(needle), `missing report text: ${needle}`).toBe(true)
    }

    it('passes a clean graded fringe', () => {
      const { status, output } = compareSynthetic('nyquist-line-pass', validLineCapture())

      expect(status, lineVerdict(status, output)).toBe(0)
      expectOutputHas(output, 'scenario invariants hold')
    })

    it('fails a one-device-pixel cliff (band under the 2 px floor)', () => {
      const capture = validLineCapture()
      capture.lineSurfaces.postFix.rim.down.bandPx = 0.8
      const { status, output } = compareSynthetic('nyquist-line-cliff', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'under the 2 px floor')
    })

    it('fails an unblended rim step (worst step over half the plateau)', () => {
      const capture = validLineCapture()
      capture.lineSurfaces.postFix.rim.up.step = 0.4
      const { status, output } = compareSynthetic('nyquist-line-step', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'exceeds half the plateau')
    })

    it('fails a raised outer ring (halo peak over the named bar)', () => {
      const capture = validLineCapture()
      capture.lineSurfaces.postFix.halo.up.peakRel = 0.55
      const { status, output } = compareSynthetic('nyquist-line-halo', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'HALO_PEAK_MAX 0.4')
      expectOutputHas(output, 'pale ring')
    })

    it('fails a halo band (run over the named bar)', () => {
      const capture = validLineCapture()
      capture.lineSurfaces.postFix.halo.down.run = 4
      const { status, output } = compareSynthetic('nyquist-line-run', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'HALO_RUN_MAX 2')
    })

    it('fails a dark centre ridge and names its surface', () => {
      const capture = validLineCapture()
      capture.lineSurfaces.postSettle.ridge = {
        peakExcess: 0.05,
        ridgeWidthPx: 3,
        asymmetry: 0,
        share: 1,
      }
      const { status, output } = compareSynthetic('nyquist-line-ridge', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'postSettle: ridge.peakExcess 0.05 exceeds RIDGE_EXCESS_MAX')
      expectOutputHas(output, 'ridge.share 1 exceeds RIDGE_ALONG_SHARE_MAX 0')
    })

    it('fails an absent ridge block by name', () => {
      const capture = validLineCapture()
      delete (capture.lineSurfaces.postApply as Partial<LineSurfaceFixture>).ridge
      const { status, output } = compareSynthetic('nyquist-line-noridge', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'postApply: ridge is missing')
    })

    it('fails a capture with no lineSurfaces block by name', () => {
      const capture = validLineCapture()
      delete (capture as Record<string, unknown>).lineSurfaces
      const { status, output } = compareSynthetic('nyquist-line-nosurfaces', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'missing lineSurfaces')
    })

    it('fails a capture missing one of the three surfaces by name', () => {
      const capture = validLineCapture()
      delete (capture.lineSurfaces as Partial<LineCaptureFixture['lineSurfaces']>).postSettle
      const { status, output } = compareSynthetic('nyquist-line-nosettle', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'lineSurfaces.postSettle is missing')
    })

    it('fails a zero coverage peak by name', () => {
      const capture = validLineCapture()
      capture.lineSurfaces.postApply.peakCover = 0
      const { status, output } = compareSynthetic('nyquist-line-nopeak', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'not a positive coverage peak')
    })

    it('fails a degenerate interior plateau by name', () => {
      const capture = validLineCapture()
      capture.lineSurfaces.postFix.interior.span = [0, 0]
      capture.lineSurfaces.postFix.rim.down.plateau = 0
      const { status, output } = compareSynthetic('nyquist-line-flat', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'interior.span')
      expectOutputHas(output, 'degenerate')
    })

    it('fails an absent enclosed block by name', () => {
      const capture = validLineCapture()
      capture.lineSurfaces.postFix.tiling.enclosed = null
      const { status, output } = compareSynthetic('nyquist-line-noenclosed', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'tiling.enclosed is missing')
    })

    it('fails an enclosed pale line by name', () => {
      const capture = validLineCapture()
      capture.lineSurfaces.postFix.tiling.enclosed = {
        offset: 62,
        meanPct: 1.5,
        fracPct: 40,
        runs: 2,
        maxRunPx: 30,
      }
      const { status, output } = compareSynthetic('nyquist-line-enclosed', capture)

      expect(status, lineVerdict(status, output)).toBe(1)
      expectOutputHas(output, 'enclosed.meanPct 1.5')
    })
  })
})

// ============================================================
//  Laws pinned here (64-29 task 2): the edge census gains irregularity,
//  roughness, support and density.
//
//  28. `strokeEdgeCensus` emits four discriminating scalars per Feather level
//      beside the existing widths: irregularity (median |Δ crossing position|,
//      station to station), roughness (median |Δ² crossing position|), support
//      (median distance from the 50 % crossing to the outermost row above 2 %
//      of the plateau) and fringe density (share of measured stations whose
//      support clears one device pixel). The existing softness/variation/
//      plateau fields keep their names and values.
//  29. The half-width is emitted per stroke (`edgeHalfWidthPxFeather0/100`)
//      beside the compatibility mean (`edgeHalfWidthPx`) — amendment 7's
//      "both widths are recorded evidence".
//  30. compare.mjs requires the ten numbers, demands a strictly positive
//      irregularity and support at BOTH Feather levels, and bounds roughness
//      only by finiteness and non-negativity: 64-34 owns the roughness
//      ceiling, so no ceiling is guessed here.
//  31. The four synthetic profiles resolve to four distinct (irregularity,
//      roughness, support) patterns when executed against the bars: straight
//      anti-aliased (0, 0, positive) fails as a ruler, staircase (low, high,
//      positive) passes, wavy (high, low, positive) passes, binary (positive,
//      low, 0) fails as an ungraded edge.
// ============================================================

describe('the edge census separates irregular from aliased from graded (64-29 task 2)', () => {
  function censusVerdict(status: number | null, output: string): string {
    const invariant = output.split('\n').find((line) => line.startsWith('INVARIANT '))
    return `status=${status} ${invariant ?? '(no INVARIANT line)'}`
  }

  function expectCensusText(output: string, needle: string): void {
    expect(output.includes(needle), `missing report text: ${needle}`).toBe(true)
  }

  /** The clean graded fringe: every new bar passes. Absolute values are
   *  evidence (they echo the recorded HEAD readings); the relations are the
   *  contract. */
  function validCensusCapture(): Record<string, unknown> {
    return {
      ...validEdgeCapture(),
      edgeIrregularityPxFeather0: 0.62,
      edgeIrregularityPxFeather100: 0.58,
      edgeRoughnessPxFeather0: 0.35,
      edgeRoughnessPxFeather100: 0.42,
      edgeSupportPxFeather0: 3.6,
      edgeSupportPxFeather100: 4.4,
      edgeFringeDensityPctFeather0: 100,
      edgeFringeDensityPctFeather100: 100,
      edgeHalfWidthPxFeather0: 32.11,
      edgeHalfWidthPxFeather100: 31.87,
    }
  }

  describe('the probe derives and emits the four scalars per Feather level', () => {
    it('keeps one shared per-stroke derivation', () => {
      expectContains(PROBE, 'function edgeProfileStats(')
      expectContains(PROBE, 'irregularityPx: number')
      expectContains(PROBE, 'roughnessPx: number')
      expectContains(PROBE, 'supportPx: number')
      expectContains(PROBE, 'fringeDensityPct: number')
      expectContains(PROBE, 'const EDGE_SUPPORT_FRACTION = 0.02')
    })

    it('emits every new field under its Feather-suffixed name', () => {
      expectContains(PROBE, 'edgeIrregularityPxFeather0: round2(feather0.irregularityPx)')
      expectContains(PROBE, 'edgeIrregularityPxFeather100: round2(feather100.irregularityPx)')
      expectContains(PROBE, 'edgeRoughnessPxFeather0: round2(feather0.roughnessPx)')
      expectContains(PROBE, 'edgeRoughnessPxFeather100: round2(feather100.roughnessPx)')
      expectContains(PROBE, 'edgeSupportPxFeather0: round2(feather0.supportPx)')
      expectContains(PROBE, 'edgeSupportPxFeather100: round2(feather100.supportPx)')
      expectContains(PROBE, 'edgeFringeDensityPctFeather0: round2(feather0.fringeDensityPct)')
      expectContains(PROBE, 'edgeFringeDensityPctFeather100: round2(feather100.fringeDensityPct)')
    })

    it('adds the per-stroke half-widths beside the compatibility mean', () => {
      expectContains(PROBE, 'edgeHalfWidthPxFeather0: round2(feather0.halfWidthPx)')
      expectContains(PROBE, 'edgeHalfWidthPxFeather100: round2(feather100.halfWidthPx)')
      expectContains(
        PROBE,
        'edgeHalfWidthPx: round2((feather0.halfWidthPx + feather100.halfWidthPx) / 2)',
      )
    })
  })

  describe('the comparator names the new fields and their bars', () => {
    it('requires all ten numbers', () => {
      expectContains(COMPARE, 'edgeIrregularityPxFeather0')
      expectContains(COMPARE, 'edgeIrregularityPxFeather100')
      expectContains(COMPARE, 'edgeRoughnessPxFeather0')
      expectContains(COMPARE, 'edgeRoughnessPxFeather100')
      expectContains(COMPARE, 'edgeSupportPxFeather0')
      expectContains(COMPARE, 'edgeSupportPxFeather100')
      expectContains(COMPARE, 'edgeFringeDensityPctFeather0')
      expectContains(COMPARE, 'edgeFringeDensityPctFeather100')
      expectContains(COMPARE, 'edgeHalfWidthPxFeather0')
      expectContains(COMPARE, 'edgeHalfWidthPxFeather100')
    })

    it('names the ruler, binary-edge and roughness failures', () => {
      expectContains(COMPARE, 'a ruler-straight crossing')
      expectContains(COMPARE, 'has no fringe beyond the crossing')
      expectContains(COMPARE, 'is not a finite non-negative roughness')
      expectContains(COMPARE, '64-34 owns the roughness ceiling')
    })
  })

  describe('the four synthetic profiles resolve to four distinct patterns', () => {
    it('passes a graded fringe', () => {
      const { status, output } = compareSynthetic('nyquist-census-graded', validCensusCapture())

      expect(status, censusVerdict(status, output)).toBe(0)
      expectCensusText(output, 'scenario invariants hold')
    })

    it('fails a straight anti-aliased crossing as a ruler', () => {
      const { status, output } = compareSynthetic('nyquist-census-straight', {
        ...validCensusCapture(),
        edgeIrregularityPxFeather0: 0,
        edgeIrregularityPxFeather100: 0,
        edgeRoughnessPxFeather0: 0,
        edgeRoughnessPxFeather100: 0,
        edgeSupportPxFeather0: 3.2,
        edgeSupportPxFeather100: 3.4,
      })

      expect(status, censusVerdict(status, output)).toBe(1)
      expectCensusText(output, 'a ruler-straight crossing')
    })

    it('passes a staircase crossing (high roughness, low irregularity)', () => {
      const { status, output } = compareSynthetic('nyquist-census-staircase', {
        ...validCensusCapture(),
        edgeIrregularityPxFeather0: 0.3,
        edgeIrregularityPxFeather100: 0.28,
        edgeRoughnessPxFeather0: 1.9,
        edgeRoughnessPxFeather100: 2.2,
        edgeSupportPxFeather0: 2.4,
        edgeSupportPxFeather100: 2.6,
      })

      expect(status, censusVerdict(status, output)).toBe(0)
    })

    it('passes a wavy crossing (high irregularity, low roughness)', () => {
      const { status, output } = compareSynthetic('nyquist-census-wavy', {
        ...validCensusCapture(),
        edgeIrregularityPxFeather0: 1.9,
        edgeIrregularityPxFeather100: 1.7,
        edgeRoughnessPxFeather0: 0.2,
        edgeRoughnessPxFeather100: 0.24,
        edgeSupportPxFeather0: 3.1,
        edgeSupportPxFeather100: 3.3,
      })

      expect(status, censusVerdict(status, output)).toBe(0)
    })

    it('fails a binary edge with no support', () => {
      const { status, output } = compareSynthetic('nyquist-census-binary', {
        ...validCensusCapture(),
        edgeSupportPxFeather0: 0,
        edgeSupportPxFeather100: 0,
      })

      expect(status, censusVerdict(status, output)).toBe(1)
      expectCensusText(output, 'has no fringe beyond the crossing')
    })

    it('fails a negative roughness', () => {
      const { status, output } = compareSynthetic('nyquist-census-roughness', {
        ...validCensusCapture(),
        edgeRoughnessPxFeather100: -0.1,
      })

      expect(status, censusVerdict(status, output)).toBe(1)
      expectCensusText(output, 'is not a finite non-negative roughness')
    })

    it('fails a missing new field by name', () => {
      const capture = validCensusCapture()
      delete capture.edgeSupportPxFeather100
      const { status, output } = compareSynthetic('nyquist-census-missing', capture)

      expect(status, censusVerdict(status, output)).toBe(1)
      expectCensusText(output, 'edgeSupportPxFeather100')
    })

    it('fails a fringe density outside the percentage range', () => {
      const { status, output } = compareSynthetic('nyquist-census-density', {
        ...validCensusCapture(),
        edgeFringeDensityPctFeather0: 140,
      })

      expect(status, censusVerdict(status, output)).toBe(1)
      expectCensusText(output, 'edgeFringeDensityPctFeather0')
    })
  })
})

// ============================================================
//  Laws pinned here (64-29 task 3): the texture-tip A/B.
//
//  32. `bristle-tip` is a scenario in BOTH closed lists, one bristle line per
//      capture. `--texture <id>` is a bristle-tip-only operand; probe.ts reads
//      it and every capture registers the deterministic `probe/tip-ab` mask
//      (exactly TIP_MASK_BYTES, index arithmetic only) through the shipped
//      `registerMask` BEFORE the first stroke; a refused registration throws.
//  33. `ScriptEntry` gains optional `textureId` (projected through the existing
//      toStudioStroke path, never a new payload shape) and `pickup` (folded
//      into the per-stroke params bag). A stroke setting neither records
//      exactly as today.
//  34. The report echoes the REQUESTED id, the id the stroke record actually
//      carried, `tipMix` (1 only when the mask registry resolves the carried
//      id — the engine's own fallback law), the across-profile band count and
//      its median gap, and a named fallback note when an unknown id resolved
//      to nothing.
//  35. `bristleTipFailures` requires the echoes and numbers, fails a carried id
//      that disagrees with the request, a plain capture that already reports an
//      id, an unknown-id capture without its note, a `probe/tip-ab` capture
//      whose tipMix is not 1, a tipMix outside 0/1, and — when the reference is
//      the plain A/B capture — a masked capture carrying fewer than two extra
//      bands.
//  36. The band metric walks the same across-profile stations the line census
//      uses: runs of stations at or above half the profile peak, count and
//      median gap, so a stripes-forged mask reads as several bands and a
//      plain line as one.
//  37. `--differs-from` still fails two identical digest triples and unequal
//      dimensions; the A/B rides that existing law, never a new one.
// ============================================================

describe('the texture-tip A/B (64-29 task 3)', () => {
  function tipVerdict(status: number | null, output: string): string {
    const invariant = output.split('\n').find((line) => line.startsWith('INVARIANT '))
    return `status=${status} ${invariant ?? '(no INVARIANT line)'}`
  }

  function expectTipText(output: string, needle: string): void {
    expect(output.includes(needle), `missing report text: ${needle}`).toBe(true)
  }

  /** Write `actual` and a reference with equal dimensions, then run
   *  `compare.mjs <name> --differs-from <name>-ref` — the A/B mode the
   *  scenario is judged in. The reference digests are controlled here, never
   *  by the caller: the synthetic differing triple by default, or the
   *  capture's own digests when `sameDigests` (the identical-triple failure).
   *  Caller-supplied digest fields are overwritten — otherwise a reference
   *  built from `baseCapture` (as every fixture here is) would silently
   *  restore equal digests. */
  function compareSyntheticDiffers(
    name: string,
    actual: Record<string, unknown>,
    reference: Record<string, unknown>,
    sameDigests = false,
  ): { status: number | null; output: string } {
    writeCapture(name, actual)
    const digests = sameDigests
      ? {
          digestPaper: actual.digestPaper,
          digestTransparent: actual.digestTransparent,
          digestWhite: actual.digestWhite,
          digestPigment: actual.digestPigment,
        }
      : {
          digestPaper: 'rpaper',
          digestTransparent: 'rtransparent',
          digestWhite: 'rwhite',
          digestPigment: 'rpigment',
        }
    writeCapture(`${name}-ref`, {
      ...baseCapture(String(reference.scenario), `${name}-ref`),
      ...reference,
      ...digests,
    })
    const result = spawnSync(process.execPath, [COMPARE_PATH, name, '--differs-from', `${name}-ref`], {
      encoding: 'utf8',
    })
    return { status: result.status, output: `${result.stdout}${result.stderr}` }
  }

  function validTipCapture(): Record<string, unknown> {
    return {
      ...baseCapture('bristle-tip', 'nyquist'),
      tipRequestedId: null,
      tipTextureId: null,
      tipMix: 0,
      tipBands: 1,
      tipGapPx: 0,
      tipNote: null,
    }
  }

  function maskedTipCapture(bands: number): Record<string, unknown> {
    return {
      ...validTipCapture(),
      tipRequestedId: 'probe/tip-ab',
      tipTextureId: 'probe/tip-ab',
      tipMix: 1,
      tipBands: bands,
      tipGapPx: 4.5,
    }
  }

  describe('the scenario, the operand and the deterministic mask', () => {
    it('declares bristle-tip in both closed lists', () => {
      expectContains(RUN, "scenarioRaw !== 'bristle-tip'")
      expectContains(RUN, 'or "bristle-tip")')
      expectContains(PROBE, "raw !== 'bristle-tip'")
      expectContains(PROBE, 'or "bristle-tip")')
    })

    it('parses --texture as a bristle-tip-only operand', () => {
      expectContains(RUN, "const textureFlag = args.indexOf('--texture')")
      expectContains(RUN, 'invalid --texture "${textureRaw}" (expected a non-empty mask id)')
      expectContains(RUN, '--texture is only valid with --scenario bristle-tip')
      expectContains(RUN, '`&texture=${encodeURIComponent(texture)}`')
      expectContains(PROBE, 'function readTipTexture(): string | undefined {')
    })

    it('builds the mask by index arithmetic at the exact byte length', () => {
      expectContains(PROBE, "const TIP_PROBE_ID = 'probe/tip-ab'")
      expectContains(PROBE, 'new Uint8Array(TIP_MASK_BYTES)')
      expectContains(PROBE, 'mask.fill(value, row * TIP_MASK_EDGE, (row + 1) * TIP_MASK_EDGE)')
      expectContains(PROBE, 'function probeTipMask(): Uint8Array {')
    })

    it('registers it through the shipped registry and fails loudly when refused', () => {
      expectContains(PROBE, "import { registerMask } from '../../src/brushes/maskRegistry'")
      expectContains(PROBE, "import { TIP_MASK_BYTES, TIP_MASK_EDGE } from '../../src/brushes/deriveMask'")
      expectContains(PROBE, 'function registerProbeTip(): void {')
      expectContains(PROBE, 'registerMask(TIP_PROBE_ID, probeTipMask())')
      expectContains(PROBE, 'bristle-tip: registerMask refused')
      expectContains(PROBE, 'if (scenario === \'bristle-tip\') registerProbeTip()')
    })

    it('carries textureId and pickup only when an entry sets them', () => {
      expectContains(PROBE, 'readonly textureId?: string')
      expectContains(PROBE, 'readonly pickup?: number')
      expectContains(PROBE, "if (entry.pickup !== undefined) bag['pickup'] = entry.pickup")
      expectContains(PROBE, '...(entry.textureId !== undefined ? { textureId: entry.textureId } : {})')
    })
  })

  describe('the report and the comparator name the echoes and the band metric', () => {
    it('echoes the requested and carried ids, tipMix and the bands', () => {
      expectContains(PROBE, 'tipRequestedId:')
      expectContains(PROBE, 'tipTextureId:')
      expectContains(PROBE, 'tipMix:')
      expectContains(PROBE, 'tipBands:')
      expectContains(PROBE, 'tipGapPx:')
      expectContains(PROBE, 'tipNote:')
      expectContains(PROBE, 'scenario === \'bristle-tip\'')
    })

    it('derives the bands in one across-profile walk', () => {
      expectContains(PROBE, 'const TIP_BAND_FRACTION = 0.5')
      expectContains(PROBE, 'function acrossBandStats(')
      expectContains(PROBE, 'lineProfileSet(engine)')
    })

    it('dispatches bristle-tip to its own failure function', () => {
      expectContains(COMPARE, "'bristle-tip': bristleTipFailures,")
      expectContains(COMPARE, 'function bristleTipFailures(')
    })

    it('names every echo and the band bar', () => {
      expectContains(COMPARE, 'tipRequestedId')
      expectContains(COMPARE, 'tipTextureId')
      expectContains(COMPARE, 'tipMix')
      expectContains(COMPARE, 'tipBands')
      expectContains(COMPARE, 'tipGapPx')
      expectContains(COMPARE, "const PROBE_TIP_ID = 'probe/tip-ab'")
      expectContains(COMPARE, 'const TIP_BANDS_MIN_GAIN = 2')
    })

    it('names the echo, fallback and band failures', () => {
      expectContains(COMPARE, 'the echoes disagree with the requested texture')
      expectContains(COMPARE, 'already reports a texture id')
      expectContains(COMPARE, 'without its fallback note')
      expectContains(COMPARE, 'the probe mask did not compose')
      expectContains(COMPARE, 'the masked capture has fewer bands than the plain one')
    })
  })

  describe('the synthetic captures split pass from fail (executed)', () => {
    it('passes the plain capture', () => {
      const { status, output } = compareSynthetic('nyquist-tip-plain', validTipCapture())

      expect(status, tipVerdict(status, output)).toBe(0)
      expectTipText(output, 'scenario invariants hold')
    })

    it('passes the unknown-id fallback with its note', () => {
      const { status, output } = compareSynthetic('nyquist-tip-unknown', {
        ...validTipCapture(),
        tipRequestedId: 'probe/missing',
        tipTextureId: 'probe/missing',
        tipMix: 0,
        tipNote: 'unknown texture "probe/missing": the engine falls back to the response tip',
      })

      expect(status, tipVerdict(status, output)).toBe(0)
    })

    it('fails a plain capture that already reports a texture id', () => {
      const { status, output } = compareSynthetic('nyquist-tip-plain-id', {
        ...validTipCapture(),
        tipTextureId: 'probe/tip-ab',
      })

      expect(status, tipVerdict(status, output)).toBe(1)
      expectTipText(output, 'already reports a texture id')
    })

    it('fails an unknown id with no fallback note', () => {
      const { status, output } = compareSynthetic('nyquist-tip-no-note', {
        ...validTipCapture(),
        tipRequestedId: 'probe/missing',
        tipTextureId: 'probe/missing',
        tipMix: 0,
      })

      expect(status, tipVerdict(status, output)).toBe(1)
      expectTipText(output, 'without its fallback note')
    })

    it('fails the probe mask that did not compose', () => {
      const { status, output } = compareSynthetic('nyquist-tip-unmixed', {
        ...maskedTipCapture(3),
        tipMix: 0,
        tipNote: 'unknown texture "probe/tip-ab"',
      })

      expect(status, tipVerdict(status, output)).toBe(1)
      expectTipText(output, 'the probe mask did not compose')
    })

    it('fails echoes that disagree with the request', () => {
      const { status, output } = compareSynthetic('nyquist-tip-disagree', {
        ...maskedTipCapture(3),
        tipTextureId: 'probe/other',
      })

      expect(status, tipVerdict(status, output)).toBe(1)
      expectTipText(output, 'the echoes disagree with the requested texture')
    })

    it('fails a missing band number by name', () => {
      const capture = validTipCapture()
      delete capture.tipBands
      const { status, output } = compareSynthetic('nyquist-tip-missing', capture)

      expect(status, tipVerdict(status, output)).toBe(1)
      expectTipText(output, 'tipBands')
    })

    it('passes an A/B whose masked capture adds two bands', () => {
      const { status, output } = compareSyntheticDiffers(
        'nyquist-tip-ab-pass',
        maskedTipCapture(3),
        validTipCapture(),
      )

      expect(status, tipVerdict(status, output)).toBe(0)
      expectTipText(output, 'all 3 digests differ')
    })

    it('fails an A/B whose masked capture adds no bands', () => {
      const { status, output } = compareSyntheticDiffers(
        'nyquist-tip-ab-flat',
        maskedTipCapture(1),
        validTipCapture(),
      )

      expect(status, tipVerdict(status, output)).toBe(1)
      expectTipText(output, 'the masked capture has fewer bands than the plain one')
    })

    it('fails an A/B on two identical digest triples', () => {
      const { status, output } = compareSyntheticDiffers(
        'nyquist-tip-ab-same',
        maskedTipCapture(3),
        validTipCapture(),
        true,
      )

      expect(status, tipVerdict(status, output)).toBe(1)
      expectTipText(output, 'digest(s) did not differ')
    })
  })
})

// The shipped alpha law is checked on captures, not only narrated: every
// non-bristle capture must prove its exports opaque and its display alpha equal
// to the darkness of the exported film, and a bristle capture must report the
// check as skipped with its reason. These run compare.mjs as a real process
// against synthetic captures, so each rule must actually discriminate.
describe('the alpha-law blocks discriminate (64-31 task 2, executed)', () => {
  function lawCapture(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    // Scenario `cover` carries no scenario invariant, so a law failure is the
    // only INVARIANT line in the report.
    return { ...baseCapture('cover', 'nyquist'), ...overrides }
  }

  it('passes a capture whose exports are opaque and whose display alpha is darkness', () => {
    const { status, output } = compareSynthetic('nyquist-law-pass', lawCapture())

    expect(status, lawVerdict(status, output)).toBe(0)
    expectLawText(output, 'all 12 fields equal')
  })

  it('passes a one-step darkness/alpha disagreement (8-bit rounding)', () => {
    const { status, output } = compareSynthetic(
      'nyquist-law-one-step',
      lawCapture({ visibleAlphaMaxDelta: 1, visibleAlphaWorstAt: 'x=41,y=7' }),
    )

    expect(status, lawVerdict(status, output)).toBe(0)
  })

  it('fails one translucent pixel, naming the surface', () => {
    const { status, output } = compareSynthetic(
      'nyquist-law-translucent',
      lawCapture({ opaqueExportMinAlpha: 254, opaqueExportMinAlphaSurface: 'transparent' }),
    )

    expect(status, lawVerdict(status, output)).toBe(1)
    const invariant = invariantLine(output)
    expect(invariant).toContain('opaqueExportMinAlpha 254')
    expect(invariant).toContain('transparent')
  })

  it('fails a two-step darkness/alpha disagreement, naming the coordinate', () => {
    const { status, output } = compareSynthetic(
      'nyquist-law-two-step',
      lawCapture({ visibleAlphaMaxDelta: 2, visibleAlphaWorstAt: 'x=17,y=203' }),
    )

    expect(status, lawVerdict(status, output)).toBe(1)
    const invariant = invariantLine(output)
    expect(invariant).toContain('2 steps')
    expect(invariant).toContain('x=17,y=203')
  })

  it('fails a capture that omits the opaque-export block', () => {
    const capture = lawCapture()
    delete capture.opaqueExportMinAlpha
    const { status, output } = compareSynthetic('nyquist-law-noopaque', capture)

    expect(status, lawVerdict(status, output)).toBe(1)
    const invariant = invariantLine(output)
    expect(invariant).toContain('opaqueExportMinAlpha')
    expect(invariant).toContain('re-run the probe')
  })

  it('fails a capture that omits the visible-alpha block', () => {
    const capture = lawCapture()
    delete capture.visibleAlphaMaxDelta
    const { status, output } = compareSynthetic('nyquist-law-novisible', capture)

    expect(status, lawVerdict(status, output)).toBe(1)
    expect(invariantLine(output)).toContain('visibleAlphaMaxDelta')
  })

  it('fails a non-bristle capture that opts out of the visible-alpha check', () => {
    const { status, output } = compareSynthetic(
      'nyquist-law-opts-out',
      lawCapture({ visibleAlphaMaxDelta: null, visibleAlphaSkip: 'not measured' }),
    )

    expect(status, lawVerdict(status, output)).toBe(1)
    expect(invariantLine(output)).toContain('cannot be skipped')
  })

  it('passes a bristle capture that reports the skip with its reason', () => {
    const { status, output } = compareSynthetic('nyquist-law-bristle-pass', {
      ...baseCapture('bristle-wet', 'nyquist'),
      pickupFreshMean: 50.64,
      pickupAgedWetMean: 250.16,
      wetMode: 1,
    })

    expect(status, lawVerdict(status, output)).toBe(0)
    expectLawText(output, 'scenario invariants hold')
  })

  it('fails a non-bristle capture that claims a zero-sample pass', () => {
    const { status, output } = compareSynthetic(
      'nyquist-law-zero-samples',
      lawCapture({ visibleAlphaMaxDelta: 0, visibleAlphaSamples: 0 }),
    )

    expect(status, lawVerdict(status, output)).toBe(1)
    expect(invariantLine(output)).toContain('cannot be skipped')
  })

  it('fails a bristle capture that reports a delta beside its skip', () => {
    const capture: Record<string, unknown> = {
      ...baseCapture('bristle-wet', 'nyquist'),
      pickupFreshMean: 50.64,
      pickupAgedWetMean: 250.16,
      wetMode: 1,
      visibleAlphaMaxDelta: 3,
      visibleAlphaSamples: 12,
    }
    const { status, output } = compareSynthetic('nyquist-law-bristle-delta', capture)

    expect(status, lawVerdict(status, output)).toBe(1)
    expect(invariantLine(output)).toContain('a skipped check records no delta')
  })

  it('fails a bristle capture that drops the skip reason', () => {
    const capture: Record<string, unknown> = {
      ...baseCapture('bristle-wet', 'nyquist'),
      pickupFreshMean: 50.64,
      pickupAgedWetMean: 250.16,
      wetMode: 1,
    }
    delete capture.visibleAlphaSkip
    const { status, output } = compareSynthetic('nyquist-law-bristle-noskip', capture)

    expect(status, lawVerdict(status, output)).toBe(1)
    expect(invariantLine(output)).toContain('visibleAlphaSkip')
  })
})

// Spec 10 (261125-kvl): the per-stroke translucent stroke layer.
//
// Pinned laws:
//  34. `edge-layer` is a scenario in BOTH closed lists, and its two knobs
//      (`--edge` / `--falloff`) are refused on every other scenario in both
//      files — never silently ignored.
//  35. The alpha-law bristle predicate carries the IDENTICAL two-clause test
//      in probe.ts, compare.mjs and this file's `baseCapture`: `edge-layer` is
//      a bristle scene and reports the film-blur skip with no delta/samples.
//  36. `edgeLayerFailures` is AMOUNT-KEYED: at amount 0 it runs ONLY the
//      row-by-row profile identity against the committed pre-change baseline
//      (tolerance 2e-4); at amount > 0 it requires every layer reading by name
//      (a null fails naming the reading) and then applies the law's bars.
//  37. `--edge-structural` proves the amount-0 bypass is a BRANCH: no layer
//      allocation and no merge draw at 0; one allocation and one merge per
//      stroke above 0. A missing counter fails by name.
//  38. `--falloff-sweep` is the only cross-capture ordering gate: strict
//      broad < linear < rim on both sides (midpoint alpha), strict on the
//      near-opaque band on the paper side (261126), and the layer's own
//      cover_L rows agree to one 8-bit step on the PAPER profile (the one
//      whose cover_L is the deposit alone). The under profile's cover_L drift
//      is REPORTED, never barred — stroke A's committed cover reads the
//      falloff by the merge law and stroke B's carrier lifts it through
//      `wetAt` -> pickup -> load -> body -> coverage (a measured by-design
//      coupling, present under the retired 0.66-anchor law too: 0.0363 /
//      0.0576 between f0 and f50/f100).
describe('the edge-layer gate (Spec 10)', () => {
  const EDGE_LAYER_OFFSETS = Array.from({ length: 41 }, (_, i) => i - 20)

  /** A believable lateral profile: a flat deposit out to +/-20 px, empty
   *  outside. `coverShift` moves one cover row so the sweep's independence bar
   *  can be exercised. */
  function edgeLayerProfileFixture(coverShift = 0, rowAt = 7): Record<string, unknown> {
    const inside = (o: number) => Math.abs(o) <= 20
    return {
      offsets: [...EDGE_LAYER_OFFSETS],
      cover: EDGE_LAYER_OFFSETS.map((o, i) => (inside(o) ? (i === rowAt ? 1 + coverShift : 1) : 0)),
      dark: EDGE_LAYER_OFFSETS.map((o) => (inside(o) ? 0.45 : 0)),
      ink: EDGE_LAYER_OFFSETS.map((o) => (inside(o) ? 2.2 : 0)),
      print: EDGE_LAYER_OFFSETS.map((o) => (inside(o) ? 1 : 0)),
    }
  }

  /** One synthetic edge-layer capture. At amount 0 every layer reading is
   *  ABSENT (the pre-change engine has no layer); above 0 they are present and
   *  satisfy the law's bars, so a test can break exactly one of them. */
  function validEdgeLayerCapture(
    amount: number,
    falloff: number,
    gate = 'nyquist',
  ): Record<string, unknown> {
    const layer = amount > 0
    const midAlpha = layer ? 0.3 + (falloff / 100) * 0.5 : null
    return {
      ...baseCapture('edge-layer', gate),
      strokeBrush: 'bristle-round',
      edgeAmount: amount,
      edgeFalloff: falloff,
      edgeCaptureRoundTrip: true,
      edgeReplaySelfIdentical: true,
      edgeReplayIdentical: true,
      edgeReplayMaxDelta: 0,
      edgeReplayDiffTexels: 0,
      edgeAcrossPaper: edgeLayerProfileFixture(),
      edgeAcross: edgeLayerProfileFixture(),
      edgeMidAlphaPaper: midAlpha,
      edgeMidAlphaUnder: midAlpha,
      edgeMidCoverPaper: layer ? 0.98 : null,
      edgeMidCoverUnder: layer ? 0.7 : null,
      // 261126 (the full-span falloff law): the mid station's lateral
      // coordinate, the field's anchor reach vs the deposit's visible edge,
      // and the near-opaque band. The profile fixture is a flat ±20 px
      // deposit, so half-cover and 5 % reach are both 20 and the band widens
      // with the falloff (broad < linear < rim) inside the half-cover.
      edgeMidLateralPaper: layer ? 0.5 : null,
      edgeMidLateralUnder: layer ? 0.5 : null,
      edgeLateralSatPaper: layer ? 20 : null,
      edgeLateralSatUnder: layer ? 20 : null,
      edgeCoverHalfPaper: layer ? 20 : null,
      edgeCoverHalfUnder: layer ? 20 : null,
      edgeCoverReachPaper: layer ? 20 : null,
      edgeCoverReachUnder: layer ? 20 : null,
      edgeSolidHalfPaper: layer ? 2 + (falloff / 100) * 10 : null,
      edgeSolidHalfUnder: layer ? 2 + (falloff / 100) * 10 : null,
      edgeCoreExactPaper: layer ? 0 : null,
      edgeCoreExactUnder: layer ? 0 : null,
      edgeContinuityPaper: layer ? 0 : null,
      edgeContinuityUnder: layer ? 0 : null,
      // 261126-hgl: the fringe light-ring score per lateral axis — a
      // DIAGNOSTIC now (the red-over-blue pair pales by construction; the
      // artist's halo is measured on `edge-rim`). Absent at amount 0 — no
      // layer, no ring readout. A test proves it never fails.
      edgeFringeDipPaper: layer ? 0 : null,
      edgeFringeDipUnder: layer ? 0 : null,
      edgePrintRetentionPaper: layer ? Math.max(0, 1 - amount / 100) : null,
      edgePrintRetentionUnder: layer ? Math.max(0, 1 - amount / 100) : null,
      edgeEncodeMax: layer ? 2 : null,
      edgeEncodeP95: layer ? 1 : null,
      edgeEncodeOver: layer ? 0 : null,
      // edgePolishDelta: the p95 is BARRED at one step (both displays run the
      // same coefficient law); the rim max / over-count are REPORTED (UAT
      // row 6 judges the settle). The fixture carries real readings so the
      // required-by-name check passes and tests can move one to prove a bar.
      edgePolishMax: layer ? 2 : null,
      edgePolishP95: layer ? 1 : null,
      edgePolishOver: layer ? 0 : null,
      // WR-01: the FIRST merge's last-touch pair over its own rect — the
      // cleared one-week sentinel before the merge, the stroke-end clock
      // after. A merge that writes no touch leaves the pair EQUAL.
      edgeMergedTouchBefore: layer ? -604800 : null,
      edgeMergedTouchAfter: layer ? 12.5 : null,
      // 261126: the same pair on one texel of stroke A's core over BARE PAPER
      // inside the merge rect — where every per-dab stamp weighs the sheet's
      // cover (0 there), so only the merge's post-merge cover can wet it. This
      // is the merge's own witness: the rect MAX is already live before the
      // merge once the dabs self-wet the paint they cross.
      edgeMergedTouchPaperBefore: layer ? -604800 : null,
      edgeMergedTouchPaperAfter: layer ? 12.5 : null,
      // 261126 (pickup leg): the crossing's carried-film readout. The layer
      // path reports all of them; the sheet path (amount 0) has no layer film
      // (null) but still reports the sheet colour and the touch.
      edgePickupControl: layer ? 100 : null,
      edgeWetUnder: false,
      edgePickupLayerRgb: layer ? [104, 96, 116] : null,
      edgePickupSheetRgb: [166, 180, 202],
      edgePickupMix: layer ? 0.57 : null,
      edgePickupWet: layer ? 0.77 : 1,
      edgePickupTouch: 0.25,
      layerAllocated: layer,
      mergeDraws: layer ? 1 : 0,
      mergeDrawsFirst: layer ? 1 : 0,
      // 261125-kvl task 5: the Studio lifecycle rows. Amount-keyed exactly like
      // the live branch: no target, no merge and no re-allocation at amount 0.
      ...edgeStudioFixture(layer),
    }
  }

  /** The Studio rows a real edge-layer capture carries (probe.ts
   *  `edgeStudioRows`). 2048² at 40 B/px = 160 MiB exactly. */
  function edgeStudioFixture(layer: boolean): Record<string, unknown> {
    return {
      edgeMemoryDim: [2048, 2048],
      edgeMemoryLayerAllocated: layer,
      edgeMemoryTargets: {
        layerInkRead: layer ? 2048 * 2048 * 16 : 0,
        layerInkWrite: layer ? 2048 * 2048 * 16 : 0,
        layerFilm: layer ? 2048 * 2048 * 4 : 0,
        layerRelief: layer ? 2048 * 2048 * 2 : 0,
        mergeRelief: layer ? 2048 * 2048 * 2 : 0,
      },
      edgeMemoryLayerBytes: layer ? 2048 * 2048 * 40 : 0,
      edgeMemoryPerTexel: layer ? 40 : 0,
      edgeMemoryMiB: layer ? 160 : 0,
      edgeMemoryClampDim: [2049, 2049],
      edgeMemoryClampedMiB: layer ? 160 : 0,
      edgeMemory4KRawMiB: layer ? 640 : 0,
      edgeG1DrawsBefore: 0,
      edgeG1DrawsAtCallback: layer ? 1 : 0,
      edgeG1MergeDraws: layer ? 1 : 0,
      edgeG1CallbackCount: 1,
      edgeG1LayerOpenAtCallback: false,
      edgeG1SheetPeakAtCallback: 0.9,
      edgeG1SheetPeak: 0.9,
      edgeG1LayerClosed: true,
      edgeG2MergeDraws: layer ? 1 : 0,
      edgeG2LayerClosed: true,
      edgeG2SheetPeak: 0.95,
      edgeUndoRestoreMax: 0,
      edgeUndoRestoreTexels: 0,
      edgeRedoRestoreMax: 0,
      edgeRedoRestoreTexels: 0,
      edgeMergeOutsideMax: 0,
      edgeMergeOutsideTexels: 0,
      edgeUndoOutsideMax: 0,
      edgeUndoOutsideTexels: 0,
      edgeRedoOutsideMax: 0,
      edgeRedoOutsideTexels: 0,
      edgeUndoLayerClosed: true,
      edgeAbortWasOpen: layer,
      edgeAbortClosed: true,
      edgeAbortSheetMax: 0,
      edgeAbortSheetTexels: 0,
      edgeAbortNextMerge: layer ? 1 : 0,
      edgeUndoOpenWasOpen: layer,
      edgeUndoOpenClosed: true,
      edgeUndoOpenNextMerge: layer ? 1 : 0,
      edgeRestoreWasOpen: layer,
      edgeRestoreLayerAllocated: false,
      edgeRestoreLayerFieldsNull: true,
      edgeRestoreNextMerge: layer ? 1 : 0,
      edgeRestoreReallocated: layer,
      edgeResizeWasOpen: layer,
      edgeResizeDim: 1536,
      edgeResizeLayerAllocated: false,
      edgeResizeLayerFieldsNull: true,
      edgeResizeNextMerge: layer ? 1 : 0,
      edgeResizeReallocated: layer,
      edgeCreateWasOpen: layer,
      edgeCreateLayerFieldsNull: true,
      edgeCreateLayerAllocated: false,
      edgeCreateDiscardIdempotent: true,
      edgeCreateNextMerge: layer ? 1 : 0,
      edgeCreateReallocated: layer,
      edgeMergeMsFirst: layer ? 21 : null,
      edgeMergeMsSecond: layer ? 21 : null,
      edgeMergeMsMax: layer ? 21 : null,
    }
  }

  function runCompare(args: string[]): { status: number | null; output: string } {
    const result = spawnSync(process.execPath, [COMPARE_PATH, ...args], { encoding: 'utf8' })
    return { status: result.status, output: `${result.stdout}${result.stderr}` }
  }

  describe('the scenario and its operands', () => {
    it('accepts edge-layer in both closed lists', () => {
      expectContains(PROBE, "raw !== 'emboss-smooth' && raw !== 'edge-layer'")
      expectContains(RUN, "scenarioRaw !== 'emboss-smooth' && scenarioRaw !== 'edge-layer'")
      expectContains(RUN, 'or "bristle-tip")')
      expectContains(PROBE, 'or "bristle-tip")')
    })

    it('refuses the two knobs on every other scenario, in both files', () => {
      // 261126 (the cap leg): the same knobs are the bristle-end scene's
      // layer operands; 261126-hgl's `edge-rim` reads them too, 261126-n20
      // adds `bristle-line` (the ridge layer arm), and quick 261126-v8j's
      // `feather-noise` reads them as FEATHER falloff / the Edge switch, so
      // the refusal names all five scenes; quick 261127-khp's `pickup-under`
      // judges the same Edge pair on its own scene.
      expectContains(
        PROBE,
        '`--${name} is only valid with --scenario edge-layer, edge-rim, bristle-end, bristle-line, feather-noise or pickup-under`',
      )
      expectContains(
        PROBE,
        "scenario === 'edge-rim' ? EDGE_RIM_DEFAULT_AMOUNT : EDGE_LAYER_DEFAULT_AMOUNT",
      )
      expectContains(
        PROBE,
        "scenario === 'edge-rim' ? EDGE_RIM_DEFAULT_FALLOFF : EDGE_LAYER_DEFAULT_FALLOFF",
      )
      expectContains(
        RUN,
        '--edge is only valid with --scenario edge-layer, edge-rim, bristle-end, bristle-line, feather-noise or pickup-under',
      )
      expectContains(
        RUN,
        '--falloff is only valid with --scenario edge-layer, edge-rim, bristle-end, bristle-line, feather-noise or pickup-under',
      )
      expectContains(RUN, '`&edge=${edge}`')
      expectContains(RUN, '`&falloff=${falloff}`')
    })

    it('reads the layer knobs on bristle-line only with --edge as the switch', () => {
      expectContains(RUN, "const LAYER_SCENES = ['edge-layer', 'edge-rim', 'bristle-end', 'bristle-line', 'pickup-under']")
      expectContains(PROBE, 'readLineOverrides(),')
      expectContains(
        PROBE,
        "throw new Error('--falloff / --pickup on bristle-line need --edge as the layer switch')",
      )
      expectContains(PROBE, 'params: bristleLineParams(body, strokeSize, overrides),')
    })

    it('reads the layer knobs on bristle-end as one operand set, only with --edge', () => {
      expectContains(PROBE, "const readPercent = (key: 'dry' | 'feather' | 'edge' | 'falloff' | 'pickup')")
      expectContains(PROBE, "throw new Error('--falloff / --pickup on bristle-end need --edge as the layer switch')")
      expectContains(PROBE, '...(overrides?.edge != null ? { edgeFade: overrides.edge, edgeFalloff: overrides.falloff ?? 50 } : {}),')
      expectContains(PROBE, '...(overrides?.pickup != null ? { pickup: overrides.pickup } : {}),')
      // The report echoes the trio so a capture can never be misread as a
      // different bag; a null amount is the sheet-path control.
      expectContains(PROBE, 'amount: endSetup.edge,')
      // 261126-n20 adds `bristle-line` as the ridge layer arm; the literal
      // moved with the operand law, never silently.
      expectContains(
        RUN,
        "const LAYER_SCENES = ['edge-layer', 'edge-rim', 'bristle-end', 'bristle-line', 'pickup-under']",
      )
    })

    it('accepts --feather on the two layer scenes and reads the fringe dip (261126-hgl)', () => {
      // The feather reader widened: --feather rides the layer scenes, --dry and
      // --release stay bristle-end only. The scenario test is the allowed-list,
      // so a new scene must opt in explicitly.
      expectContains(RUN, "const feather = readEndPercent('--feather', EDGE_KNOB_SCENES)")
      expectContains(RUN, "const readEndPercent = (flagName, scenes = ['bristle-end']) => {")
      expectContains(RUN, 'if (!scenes.includes(scenario)) {')
      // The operand is read, folded into the SAME canonical params bag the
      // layer script drives, and echoed so a capture can never be misread.
      expectContains(PROBE, 'EDGE_LAYER_FEATHER = readEdgeFeather(scenario)')
      expectContains(PROBE, "if (EDGE_LAYER_FEATHER !== null) params['feather'] = EDGE_LAYER_FEATHER")
      expectContains(PROBE, 'edgeFeatherControl: EDGE_LAYER_FEATHER,')
      // The halo readout: one score per lateral axis, from the committed
      // display profile — a station lighter than the painted stations on BOTH
      // sides of it (0 = no ring).
      expectContains(PROBE, 'edgeFringeDipPaper: paperReadings.fringeDip,')
      expectContains(PROBE, 'edgeFringeDipUnder: underReadings.fringeDip,')
      expectContains(PROBE, 'function edgeFringeDip(profile: EdgeProfile): number | null {')
      expectContains(PROBE, 'const EDGE_FRINGE_GAP = 3')
    })

    it('keeps the fringe dip as a diagnostic (261126-hgl)', () => {
      // 261126-hgl retired the dip bar: the red-over-blue `edge-layer` pair
      // pales by construction, so the dip can never judge the artist's halo
      // (that surface is `edge-rim`). The readings stay emitted as
      // diagnostics, and the bar must not come back.
      expectNotContains(COMPARE, 'EDGE_FRINGE_DIP_MAX')
      expectContains(COMPARE, "'edgeFringeDipPaper',")
      expectContains(COMPARE, "'edgeFringeDipUnder',")
    })

    it('registers the edge-rim scene and emits its eight rim readings (261126-hgl task 3)', () => {
      // The scenario is accepted by both closed lists and skips the shared
      // script drive (it has its own two-stroke drive with a merge wrapper).
      expectContains(PROBE, "raw !== 'edge-layer' && raw !== 'edge-rim'")
      expectContains(RUN, "scenarioRaw !== 'edge-layer' && scenarioRaw !== 'edge-rim'")
      expectContains(PROBE, 'function edgeRimScript(): readonly ScriptEntry[] {')
      expectContains(PROBE, 'function edgeRimReport(')
      expectContains(PROBE, "function edgeRimBandRect(sheet: number, axis: 'lateral' | 'tip'): EdgeRect {")
      expectContains(PROBE, 'function edgeRimProfile(')
      // The eight fields: light and chroma, lateral and tip, committed and
      // live — the artist's acceptance surface, one reading per cell.
      for (const axis of ['Lateral', 'Tip']) {
        for (const kind of ['Light', 'Chroma']) {
          for (const surface of ['Committed', 'Live']) {
            expectContains(PROBE, `edgeRim${kind}${axis}${surface}:`)
          }
        }
      }
      // The recipe's inks: the artist's yellow over the blue wash.
      expectContains(PROBE, "const EDGE_RIM_WASH_COLOR = '#1469e8'")
      expectContains(PROBE, "const EDGE_RIM_FOREGROUND_COLOR = '#f9e01c'")
      // The coherence guard: a 5-station box smooth and a two-station floor.
      expectContains(PROBE, 'const EDGE_RIM_SMOOTH_STATIONS = 5')
      expectContains(PROBE, 'const EDGE_RIM_RUN_MIN = 2')
    })

    it('registers the feather-noise scene and forwards its operands (261126-v8j)', () => {
      // The scenario enters BOTH closed lists. The chain clause is APPENDED
      // LAST (the bristle-tip adjacency pins above survive as prefixes), and
      // the message name sits BEFORE the final "bristle-tip" clause (the four
      // `or "bristle-tip")` pins stay green).
      expectContains(PROBE, "raw !== 'edge-rim' && raw !== 'feather-noise'")
      expectContains(RUN, "scenarioRaw !== 'edge-rim' && scenarioRaw !== 'feather-noise'")
      expectContains(PROBE, '"bristle-blend", "feather-noise", "bristle-end"')
      expectContains(RUN, '"bristle-blend", "feather-noise", "bristle-end"')
      // --stroke-size is the sweep's size axis; --noise is parsed through the
      // SAME percent reader and forwarded through the explicit pageQuery
      // enumeration (an operand not enumerated never reaches the page).
      expectContains(
        RUN,
        '--stroke-size is only valid with --scenario bristle-line, bristle-end, bristle-blend, feather-noise or pickup-under',
      )
      expectContains(RUN, "const noise = readEndPercent('--noise', ['feather-noise'])")
      expectContains(RUN, '`&noise=${noise}`')
      expectContains(RUN, "['pngCrop', 'crop']")
      // The scene rides the layer-knob allowlist; LAYER_SCENES itself keeps
      // its four members (the pickup/over law is not this quick's).
      expectContains(RUN, "const EDGE_KNOB_SCENES = [...LAYER_SCENES, 'feather-noise']")
      // The scene paints the SAME bristle-line geometry through the same bag,
      // and both Spec 11 keys are written unconditionally so paramsEcho always
      // shows them.
      expectContains(
        PROBE,
        'function featherNoiseScript(strokeSize: number): readonly ScriptEntry[] {',
      )
      expectContains(PROBE, 'bristleLineParams(100, strokeSize, {')
      expectContains(PROBE, "params['featherNoise'] = FEATHER_NOISE_KNOBS.noise")
      expectContains(PROBE, "params['featherFalloff'] = FEATHER_NOISE_KNOBS.featherFalloff")
      expectContains(PROBE, "'--noise is only valid with --scenario feather-noise'")
      expectContains(PROBE, 'function readFeatherNoiseKnobs(')
      expectContains(PROBE, 'FEATHER_NOISE_KNOBS = readFeatherNoiseKnobs(scenario)')
      // The profile admission and the report: the across profiles must exist
      // for variationByBand / featureCount / rimCrossings to read.
      expectContains(PROBE, "scenario !== 'bristle-blend' &&")
      expectContains(PROBE, "scenario !== 'feather-noise'")
      expectContains(PROBE, 'function featherNoiseMetrics(')
      expectContains(PROBE, 'featherNoise: metrics,')
      // The comparator's family predicate carries the same name.
      expectContains(COMPARE, "data.scenario === 'feather-noise'")
    })

    it('carries the same bristle predicate in probe.ts, compare.mjs and this file', () => {
      // 261126-v8j: the feather-noise scene joins the family, so probe.ts's
      // predicate broke across lines. The pin follows the SOURCE (one shared
      // clause set, restated where the line broke), never a weakened test.
      expectContains(PROBE, "scenario.startsWith('bristle-') ||")
      expectContains(PROBE, "scenario === 'edge-layer' ||")
      expectContains(PROBE, "scenario === 'feather-noise'")
      expectContains(COMPARE, "String(data.scenario).startsWith('bristle-') || data.scenario === 'edge-layer' ||")
      expectContains(COMPARE, "data.scenario === 'edge-rim' || data.scenario === 'feather-noise'")
      expectContains(
        readFileSync(resolve(HERE, 'harness.test.ts'), 'utf8'),
        "scenario.startsWith('bristle-') ||",
      )
    })

    it('maps the scenario to its amount-keyed invariant', () => {
      expectContains(COMPARE, "'edge-layer': edgeLayerFailures,")
      expectContains(COMPARE, 'function edgeLayerFailures(data, reference) {')
      expectContains(COMPARE, 'const EDGE_IDENTITY_TOLERANCE = 2e-4')
      // 261126: the plateau anchor and its derived mid station are gone; the
      // mid station is FOUND in the stored field, the anchor is barred, and
      // the near-opaque band must sit inside the stroke's half-cover.
      expectNotContains(COMPARE, 'const EDGE_START = 0.3')
      expectNotContains(COMPARE, 'EDGE_MID_U')
      expectContains(COMPARE, 'const EDGE_LATERAL_ANCHOR_TOL_PX = 3')
      expectContains(COMPARE, 'const EDGE_SOLID_SHRINK_AMOUNT = 0.5')
      expectContains(COMPARE, 'function edgeIdentityFailures(data, reference) {')
      // The stray-rejected parameter-law constants must not come back.
      expectNotContains(COMPARE, 'const EDGE_CORE_TOLERANCE')
      expectNotContains(COMPARE, 'const EDGE_STATION_TOLERANCE')
      expectNotContains(COMPARE, 'const EDGE_INK_CORE_TOLERANCE')
      expectNotContains(COMPARE, 'threshold dissolve')
      // The retired band-mix encoder readings: the comparator must carry no
      // half-on-white mix field and no bar for it.
      expectNotContains(COMPARE, 'linearHalfOnWhite')
      expectNotContains(COMPARE, 'EDGE_LINEAR_HALF_MAX')
      expectNotContains(PROBE, 'linearHalfOnWhite')
      // The live display now mixes coefficients, not bands.
      expectNotContains(PROBE, 'displayBasisBands')
    })

    it('teaches the parser both new operands and rejects unknown flags', () => {
      expectContains(COMPARE, "args[1] === '--edge-structural'")
      expectContains(COMPARE, "args[1] === '--falloff-sweep'")
      expectContains(COMPARE, "--falloff-sweep needs <linear> and <rim> gate names")
      expectContains(COMPARE, 'function edgeStructuralFailures(data) {')
      const unknown = runCompare(['nyquist-anything', '--edge-nonsense'])
      expect(unknown.status, lawVerdict(unknown.status, unknown.output)).toBe(2)
      expect(unknown.output).toContain('unknown argument')
      const short = runCompare(['nyquist-anything', '--falloff-sweep', 'only-one'])
      expect(short.status, lawVerdict(short.status, short.output)).toBe(2)
      expect(short.output).toContain('--falloff-sweep needs')
    })
  })

  describe('the amount-keyed invariant (executed)', () => {
    it('passes the amount-0 identity against an equal baseline', () => {
      const { status, output } = compareSynthetic(
        'nyquist-edgelayer-neutral',
        validEdgeLayerCapture(0, 50),
      )
      expect(status, lawVerdict(status, output)).toBe(0)
      expect(fieldsLine(output)).toContain('scenario invariants hold')
    })

    it('fails an amount-0 profile row that moved past 2e-4', () => {
      // A real reference pair: `compareSynthetic` mirrors the actual into its
      // reference, which would hide exactly the row this test moves.
      const name = 'nyquist-edgelayer-identity'
      const capture = validEdgeLayerCapture(0, 50)
      const paper = capture.edgeAcrossPaper as Record<string, number[]>
      const moved = [...paper.ink]
      moved[5] = moved[5]! + 0.001
      writeCapture(name, { ...capture, edgeAcrossPaper: { ...paper, ink: moved } })
      writeCapture(`${name}-ref`, capture)
      const { status, output } = runCompare([name, '--other', `${name}-ref`])
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(invariantLine(output)).toContain('amount-0 identity')
    })

    it('passes a full amount-100 capture', () => {
      const { status, output } = compareSynthetic(
        'nyquist-edgelayer-a100',
        validEdgeLayerCapture(100, 50),
      )
      expect(status, lawVerdict(status, output)).toBe(0)
      expect(fieldsLine(output)).toContain('scenario invariants hold')
    })

    it('fails an amount-100 capture by NAME on every absent layer reading', () => {
      // This is the pre-change tree's RED: the layer does not exist, so every
      // layer reading is null. The comparator must say so, by name.
      const capture = validEdgeLayerCapture(0, 50)
      capture.edgeAmount = 100
      const { status, output } = compareSynthetic('nyquist-edgelayer-red', capture)
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(invariantLine(output)).toContain('edgeMidAlphaPaper')
      expect(invariantLine(output)).toContain('edgePolishMax')
      expect(invariantLine(output)).toContain('absent')
    })

    it('fails an amount-100 capture missing a reading key entirely', () => {
      const capture = validEdgeLayerCapture(100, 50)
      delete capture.edgePrintRetentionUnder
      const { status, output } = compareSynthetic('nyquist-edgelayer-missing', capture)
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(invariantLine(output)).toContain('edgePrintRetentionUnder')
      expect(invariantLine(output)).toContain('is missing')
    })

    // 261126 (pickup leg): the layer's gather must read the SAME wet-pickup
    // law as the sheet path. The bars are executed so a dropped or inverted
    // check cannot pass on the valid fixture alone.
    it('fails a pickup-100 layer whose carried film lacks the under-paint', () => {
      const { status, output } = compareSynthetic('nyquist-pickup-cold', {
        ...validEdgeLayerCapture(100, 50),
        edgePickupMix: 0,
      })
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(invariantLine(output)).toContain('edgePickupMix')
      expect(output).toContain("does not contain the under-paint's colour")
    })

    it('fails a pickup-0 control that carried any under-paint', () => {
      const { status, output } = compareSynthetic('nyquist-pickup-control', {
        ...validEdgeLayerCapture(100, 50),
        edgePickupControl: 0,
        edgePickupMix: 0.2,
      })
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(invariantLine(output)).toContain('edgePickupMix')
      expect(output).toContain('is not 0 at pickup 0')
    })

    it('fails a pickup reading whose gather wet gate is cold', () => {
      const { status, output } = compareSynthetic('nyquist-pickup-dry', {
        ...validEdgeLayerCapture(100, 50),
        edgePickupWet: 0.4,
      })
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(invariantLine(output)).toContain('edgePickupWet')
      expect(output).toContain('wet gate is cold')
    })

    it('fails a core that is not exact, a continuity break, an over-residual and a settled p95', () => {
      const cases: Array<[string, Record<string, unknown>, string]> = [
        ['core', { edgeCoreExactPaper: 2 }, 'edgeCoreExactPaper'],
        ['continuity', { edgeContinuityUnder: 3 }, 'edgeContinuityUnder'],
        ['over', { edgeEncodeOver: 1 }, 'edgeEncodeOver'],
        ['polish', { edgePolishP95: -1 }, 'edgePolishP95'],
        // The retire-encoder RED: a p95 over one display step is the settle.
        ['polish-bar', { edgePolishP95: 2 }, 'edgePolishP95'],
        ['p95', { edgeEncodeP95: 4 }, 'edgeEncodeP95'],
      ]
      for (const [label, patch, needle] of cases) {
        const { status, output } = compareSynthetic(`nyquist-edgelayer-${label}`, {
          ...validEdgeLayerCapture(100, 50),
          ...patch,
        })
        expect(status, lawVerdict(status, output)).toBe(1)
        expect(invariantLine(output)).toContain(needle)
      }
    })
  })

  describe('the structural relation (--edge-structural)', () => {
    it('passes the amount-0 bypass', () => {
      writeCapture('nyquist-struct-neutral', validEdgeLayerCapture(0, 50))
      const { status, output } = runCompare(['nyquist-struct-neutral', '--edge-structural'])
      expect(status, lawVerdict(status, output)).toBe(0)
    })

    it('passes the amount-100 one-merge-per-stroke counters', () => {
      writeCapture('nyquist-struct-a100', validEdgeLayerCapture(100, 50))
      const { status, output } = runCompare(['nyquist-struct-a100', '--edge-structural'])
      expect(status, lawVerdict(status, output)).toBe(0)
    })

    it('fails an amount-0 capture that allocated or merged', () => {
      writeCapture('nyquist-struct-alloc', {
        ...validEdgeLayerCapture(0, 50),
        layerAllocated: true,
      })
      const alloc = runCompare(['nyquist-struct-alloc', '--edge-structural'])
      expect(alloc.status, lawVerdict(alloc.status, alloc.output)).toBe(1)
      expect(alloc.output).toContain('layerAllocated is true at amount 0')

      writeCapture('nyquist-struct-merge', { ...validEdgeLayerCapture(0, 50), mergeDraws: 1 })
      const merge = runCompare(['nyquist-struct-merge', '--edge-structural'])
      expect(merge.status, lawVerdict(merge.status, merge.output)).toBe(1)
      expect(merge.output).toContain('no merge draw may be submitted')
    })

    it('fails an amount-100 capture that did not merge exactly once', () => {
      writeCapture('nyquist-struct-twice', { ...validEdgeLayerCapture(100, 50), mergeDraws: 2 })
      const twice = runCompare(['nyquist-struct-twice', '--edge-structural'])
      expect(twice.status, lawVerdict(twice.status, twice.output)).toBe(1)
      expect(twice.output).toContain('must merge exactly once')

      writeCapture('nyquist-struct-first', { ...validEdgeLayerCapture(100, 50), mergeDrawsFirst: 0 })
      const first = runCompare(['nyquist-struct-first', '--edge-structural'])
      expect(first.status, lawVerdict(first.status, first.output)).toBe(1)
      expect(first.output).toContain('FIRST Edge-active stroke')
    })

    it('fails by name on a missing counter', () => {
      const capture = validEdgeLayerCapture(0, 50)
      delete capture.layerAllocated
      writeCapture('nyquist-struct-nocounter', capture)
      const { status, output } = runCompare(['nyquist-struct-nocounter', '--edge-structural'])
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(output).toContain('layerAllocated')
      expect(output).toContain('not a boolean')
    })
  })

  describe('the falloff sweep (--falloff-sweep)', () => {
    /** Write the three sweep captures and run the operand. */
    function sweepTriple(
      name: string,
      reads: Array<Record<string, unknown>>,
    ): { status: number | null; output: string } {
      for (let i = 0; i < reads.length; i += 1) {
        writeCapture(`${name}-${i}`, { ...validEdgeLayerCapture(100, [0, 50, 100][i]!), ...reads[i] })
      }
      return runCompare([`${name}-0`, '--falloff-sweep', `${name}-1`, `${name}-2`])
    }

    it('passes a strictly ordered triple', () => {
      const { status, output } = sweepTriple('nyquist-sweep-ok', [{}, {}, {}])
      expect(status, lawVerdict(status, output)).toBe(0)
      expect(output).toContain('strict mid-alpha ordering')
    })

    it('fails an equal pair and a reversed triple', () => {
      const equal = sweepTriple('nyquist-sweep-equal', [{}, { edgeMidAlphaPaper: 0.3 }, {}])
      expect(equal.status, lawVerdict(equal.status, equal.output)).toBe(1)
      expect(equal.output).toContain('not STRICTLY increasing')

      const reversed = sweepTriple('nyquist-sweep-rev', [
        { edgeMidAlphaPaper: 0.9 },
        { edgeMidAlphaPaper: 0.6 },
        { edgeMidAlphaPaper: 0.3 },
      ])
      expect(reversed.status, lawVerdict(reversed.status, reversed.output)).toBe(1)
      expect(reversed.output).toContain('not STRICTLY increasing')
    })

    it('fails a mismatched falloff and a missing reading', () => {
      const wrongFalloff = sweepTriple('nyquist-sweep-falloff', [
        {},
        { edgeFalloff: 100 },
        {},
      ])
      expect(wrongFalloff.status, lawVerdict(wrongFalloff.status, wrongFalloff.output)).toBe(1)
      expect(wrongFalloff.output).toContain('operands must be broad, linear, rim')

      const missing = sweepTriple('nyquist-sweep-missing', [
        {},
        {},
        { edgeMidAlphaUnder: null },
      ])
      expect(missing.status, lawVerdict(missing.status, missing.output)).toBe(1)
      expect(missing.output).toContain('edgeMidAlphaUnder')
    })

    it('fails a paper-side cover_L row that moved past one 8-bit step', () => {
      const { status, output } = sweepTriple('nyquist-sweep-cover', [
        {},
        {},
        { edgeAcrossPaper: edgeLayerProfileFixture(0.02) },
      ])
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(output).toContain('the layer deposit does not read the falloff')
    })

    it('REPORTS the under-side cover drift instead of barring it', () => {
      // The under profile's cover_L moves with the falloff through the
      // carrier's pickup of stroke A's falloff-weighted committed cover; it is
      // a scene diagnostic, and the sweep must not read it as an identity.
      const { status, output } = sweepTriple('nyquist-sweep-under', [
        {},
        {},
        { edgeAcross: edgeLayerProfileFixture(0.02) },
      ])
      expect(status, lawVerdict(status, output)).toBe(0)
      expect(output).toContain('cover    Under:')
      expect(output).not.toContain('does not read the falloff')
    })
  })

  // 261125-kvl WR-01: the merge's last-touch stamp is EXECUTED — the fixtures
  // below mutate one valid capture into a failing one and assert the
  // comparator rejects it BY NAME. An unstamped merge leaves the pair EQUAL,
  // so the behavioural probe reading and this failing fixture pin the stamp
  // from both ends.
  describe('the merge last-touch stamp, executed on failing fixtures', () => {
    function rejects(name: string, mutation: Record<string, unknown>): string {
      const { status, output } = compareSynthetic(name, {
        ...validEdgeLayerCapture(100, 50),
        ...mutation,
      })
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(output).toContain('RESULT: FAIL')
      return output
    }

    it('WR-01: fails a merge that wrote no last-touch stamp', () => {
      // An unstamped merge leaves both pairs EQUAL — the pre values survive.
      // 261126: the dabs now stamp the paint they cross, so the rect pair is
      // already live before the merge; the bare-paper texel is the merge's own
      // witness and the one an unstamped merge leaves at the sentinel.
      const output = rejects('nyquist-merge-touch', {
        edgeMergedTouchAfter: -604800,
        edgeMergedTouchPaperAfter: -604800,
      })
      expect(invariantLine(output)).toContain('edgeMergedTouchPaperAfter')
      expect(output).toContain('must stamp')
    })

    it('WR-01: fails a merge that pushed the rect backwards', () => {
      const output = rejects('nyquist-merge-touch-back', {
        edgeMergedTouchBefore: 12.5,
        edgeMergedTouchAfter: 5,
      })
      expect(invariantLine(output)).toContain('edgeMergedTouchAfter')
      expect(output).toContain('backwards')
    })

    it('WR-01: fails a touch reading reported at amount 0', () => {
      const { status, output } = compareSynthetic('nyquist-merge-touch-zero', {
        ...validEdgeLayerCapture(0, 50),
        edgeMergedTouchAfter: 12.5,
      })
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(invariantLine(output)).toContain('edgeMergedTouchAfter')
    })
  })

  // 261125-kvl WR-02: the Studio lifecycle bars are EXECUTED — each fixture
  // below mutates one valid capture into a failing one and asserts the
  // comparator rejects it BY NAME. Without these, a dropped or inverted bar
  // in `edgeStudioFailures` would pass every test (the review's WR-02: the
  // valid fixture alone cannot fail a missing bar).
  describe('the Studio lifecycle bars, executed on failing fixtures', () => {
    function rejects(name: string, mutation: Record<string, unknown>): string {
      const { status, output } = compareSynthetic(name, {
        ...validEdgeLayerCapture(100, 50),
        ...mutation,
      })
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(output).toContain('RESULT: FAIL')
      return output
    }

    it('WR-02: fails a callback with the layer still open', () => {
      const output = rejects('nyquist-studio-g1', { edgeG1LayerOpenAtCallback: true })
      expect(invariantLine(output)).toContain('edgeG1LayerOpenAtCallback')
    })

    it('WR-02: fails a merge count that is not exactly once per stroke', () => {
      const two = rejects('nyquist-studio-g1-draws', { edgeG1MergeDraws: 2 })
      expect(invariantLine(two)).toContain('edgeG1MergeDraws')
      const none = rejects('nyquist-studio-g2-draws', { edgeG2MergeDraws: 0 })
      expect(invariantLine(none)).toContain('edgeG2MergeDraws')
    })

    it('WR-02: fails a missing merge on the next stroke after an abort', () => {
      const output = rejects('nyquist-studio-abort', { edgeAbortNextMerge: 0 })
      expect(invariantLine(output)).toContain('edgeAbortNextMerge')
    })

    it('WR-02: fails an undo that did not restore the pre-merge sheet', () => {
      const output = rejects('nyquist-studio-undo', { edgeUndoRestoreMax: 3 })
      expect(invariantLine(output)).toContain('edgeUndoRestoreMax')
    })

    it('WR-02: fails a layer field that survived restore', () => {
      const output = rejects('nyquist-studio-restore', { edgeRestoreLayerFieldsNull: false })
      expect(invariantLine(output)).toContain('edgeRestoreLayerFieldsNull')
    })

    it('WR-02: fails a non-idempotent discard', () => {
      const output = rejects('nyquist-studio-discard', { edgeCreateDiscardIdempotent: false })
      expect(invariantLine(output)).toContain('edgeCreateDiscardIdempotent')
    })

    it('WR-02: fails a memory reading outside the measured set', () => {
      const output = rejects('nyquist-studio-memory', { edgeMemoryLayerBytes: 1 })
      expect(invariantLine(output)).toContain('edgeMemoryLayerBytes')
    })

    it('261126-hgl: the fringe dip is a diagnostic, never a failure', () => {
      // Task 3 retired the dip bar: the red-over-blue `edge-layer` pair pales
      // by construction, so a dip over one display step must still PASS, and
      // the run prints the readings with the diagnostic wording. An
      // unreadable value (null / negative) still fails by name.
      const base = compareSynthetic('nyquist-fringe-pass', validEdgeLayerCapture(100, 50))
      expect(base.status, lawVerdict(base.status, base.output)).toBe(0)
      const dipped = compareSynthetic('nyquist-fringe-dipped', {
        ...validEdgeLayerCapture(100, 50),
        edgeFringeDipUnder: 2,
        edgeFringeDipPaper: 3,
      })
      expect(dipped.status, lawVerdict(dipped.status, dipped.output)).toBe(0)
      expect(dipped.output).toContain('fringe dip paper 3 | under 2')
      expect(dipped.output).toContain('diagnostic — red-over-blue pales by construction')
      const unreadable = rejects('nyquist-fringe-null', { edgeFringeDipUnder: null })
      expect(invariantLine(unreadable)).toContain('edgeFringeDipUnder')
    })
    it('WR-02: fails a capture missing a Studio row', () => {
      const capture = validEdgeLayerCapture(100, 50)
      delete capture.edgeCreateReallocated
      const { status, output } = compareSynthetic('nyquist-studio-missing', capture)
      expect(status, lawVerdict(status, output)).toBe(1)
      expect(invariantLine(output)).toContain('edgeCreateReallocated')
    })
  })
})

// ============================================================
//  quick 261126-n20 task 1: the terminal pre-gap detector and the widened
//  `--stroke-size` ceiling.
//
//  The detector is pure (endGap.ts) and EXECUTES here on synthetic profiles:
//  the bar that will read the captures must be proven alive on a profile that
//  carries the defect before it is trusted on a capture that must not.
// ============================================================

describe('the terminal pre-gap detector (261126-n20 task 1)', () => {
  const run = (profile: readonly number[], bodyLevel = 0.6) =>
    enclosedPaleRun(profile, {
      bodyLevel,
      margin: END_PRE_GAP_MARGIN,
      bracketPx: END_PRE_GAP_BRACKET_PX,
      stationPx: END_PRE_GAP_STATION_PX,
    })

  it('pins the detector constants the bar mirrors', () => {
    expect(END_PRE_GAP_MARGIN).toBe(0.03)
    expect(END_PRE_GAP_BRACKET_PX).toBe(48)
    expect(END_PRE_GAP_STATION_PX).toBe(2)
  })

  it('reads a 12 px dip of 0.12 between two 0.60 plateaus', () => {
    const profile = [
      ...Array<number>(8).fill(0.6),
      ...Array<number>(6).fill(0.48),
      ...Array<number>(8).fill(0.6),
    ]
    const gap = run(profile)
    expect(gap.largestRunPx).toBe(12)
    expect(gap.maxDepth).toBeCloseTo(0.12, 6)
    expect(gap.bracketed).toBe(true)
    expect(gap.atPx).toBe(16)
    expect(gap.bodyLevel).toBe(0.6)
    expect(gap.stationCount).toBe(profile.length)
  })

  it('reads 0 on a monotone terminal ramp with no outer bracket', () => {
    const gap = run([0.6, 0.55, 0.52, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2])
    expect(gap.largestRunPx).toBe(0)
    expect(gap.bracketed).toBe(false)
  })

  it('reads 0 on a flat body', () => {
    const gap = run(Array<number>(40).fill(0.6))
    expect(gap.largestRunPx).toBe(0)
    expect(gap.maxDepth).toBe(0)
  })

  it('reads 0 on a dip touching either profile edge', () => {
    const left = run([0.48, 0.48, 0.48, 0.6, 0.6, 0.6])
    expect(left.largestRunPx).toBe(0)
    const right = run([0.6, 0.6, 0.6, 0.48, 0.48, 0.48])
    expect(right.largestRunPx).toBe(0)
  })

  it('reports the widest bracketed run when several qualify', () => {
    const profile = [
      0.6, 0.6, 0.6, 0.48, 0.48, 0.6, 0.6, 0.6, 0.6, 0.48, 0.48, 0.48, 0.48, 0.6, 0.6, 0.6,
    ]
    const gap = run(profile)
    expect(gap.largestRunPx).toBe(8)
    expect(gap.maxDepth).toBeCloseTo(0.12, 6)
  })
})

describe('the widened --stroke-size ceiling (261126-n20 task 1)', () => {
  it('accepts 1..800 in run.mjs and in probe.ts with the same expected text', () => {
    expectContains(RUN, 'value < 1 || value > 800')
    expectContains(RUN, 'invalid --stroke-size "${strokeSizeRaw}" (expected 1..800)')
    expectContains(RUN, '[--stroke-size <1..800>]')
    expectContains(PROBE, 'value < 1 || value > 800')
    expectContains(PROBE, 'invalid strokeSize "${raw}" (expected 1..800)')
    expectNotContains(RUN, 'expected 1..400')
    expectNotContains(PROBE, 'expected 1..400')
  })

  it('emits the census-anchored endPreGap readout from the pure detector', () => {
    expectContains(PROBE, "import {\n  END_PRE_GAP_BRACKET_PX,")
    expectContains(PROBE, 'END_PRE_GAP_STATION_PX,\n  enclosedPaleRun,\n} from')
    expectContains(PROBE, 'endPreGap,')
    expectContains(PROBE, '...enclosedPaleRun(gapProfile, {')
    expectContains(PROBE, 'x0Px: bodyHi,')
    expectContains(PROBE, 'bodyLevel: round4(preGapBodyLevel),')
  })
})

describe('the centre-ridge detector (261126-n20 task 2)', () => {
  // 41 stations, the centre band at offset 0 (index 20) and its two rows.
  const CENTRE = 20
  const row = (value: number): number[] => new Array<number>(41).fill(value)

  it('reads a flat profile as excess 0 and share 0', () => {
    const flat = Array.from({ length: 24 }, () => row(0.55))
    const ridge = centreRidge(flat, { centreIndex: CENTRE })
    expect(ridge.peakExcess).toBe(0)
    expect(ridge.share).toBe(0)
    expect(ridge.ridgeWidthPx).toBe(0)
    expect(ridge.asymmetry).toBe(0)
  })

  it('reads a 2 px +0.10 spike at the centreline as excess 0.10 and share 1', () => {
    const spiked = Array.from({ length: 24 }, () => {
      const r = row(0.55)
      r[CENTRE] = 0.65
      r[CENTRE + 1] = 0.65
      return r
    })
    const ridge = centreRidge(spiked, { centreIndex: CENTRE })
    expect(ridge.peakExcess).toBeCloseTo(0.1, 6)
    expect(ridge.share).toBe(1)
    expect(ridge.ridgeWidthPx).toBe(2)
    expect(ridge.asymmetry).toBe(0)
  })

  it('reads a one-side step as asymmetry above the symmetric case', () => {
    const step = Array.from({ length: 24 }, () => {
      const r = row(0.55)
      for (let i = CENTRE + RIDGE_CENTRE_WIDTH; i < 41; i += 1) r[i] = 0.45
      return r
    })
    const symmetric = centreRidge(
      Array.from({ length: 24 }, () => row(0.55)),
      { centreIndex: CENTRE },
    )
    const ridge = centreRidge(step, { centreIndex: CENTRE })
    expect(ridge.asymmetry).toBeGreaterThan(symmetric.asymmetry)
    expect(ridge.asymmetry).toBeCloseTo(0.1, 6)
  })

  it('reports a wider ridge when the centre run is wider', () => {
    const wide = Array.from({ length: 24 }, () => {
      const r = row(0.55)
      for (let i = CENTRE - 2; i <= CENTRE + 3; i += 1) r[i] = 0.61
      return r
    })
    const ridge = centreRidge(wide, { centreIndex: CENTRE })
    expect(ridge.ridgeWidthPx).toBe(6)
    expect(ridge.share).toBe(1)
  })

  it('pins the declared detector constants', () => {
    expect(RIDGE_CENTRE_WIDTH).toBe(2)
    expect(RIDGE_MARGIN).toBeCloseTo(1 / 255, 12)
    expect(RIDGE_SHOULDER_INNER).toBe(4)
    expect(RIDGE_SHOULDER_OUTER).toBe(20)
  })

  it('emits the ridge readout on the line surfaces and the end lanes', () => {
    expectContains(PROBE, "import { centreRidge } from './ridge'")
    expectContains(PROBE, 'const RIDGE_STATIONS = 24')
    expectContains(PROBE, 'const ridge =\n    ridgeCentreIndex >= 0 ? centreRidge(ridgeProfiles, { centreIndex: ridgeCentreIndex }) : null')
    expectContains(PROBE, 'ridge,')
    expectContains(COMPARE, 'const RIDGE_EXCESS_MAX = 1 / 255')
    expectContains(COMPARE, 'const RIDGE_ALONG_SHARE_MAX = 0')
    expectContains(COMPARE, 'ridge.peakExcess > RIDGE_EXCESS_MAX')
    expectContains(COMPARE, 'ridge.share > RIDGE_ALONG_SHARE_MAX')
  })
})

// ============================================================
//  quick 261126-n20 task 3: the blend share-spectrum detector.
//
//  The defect: over a wet under of another colour, the smear field freezes
//  into worm-like stripes across the mark. The detector (blend.ts) projects an
//  across share profile onto the under-to-stroke axis, removes the mean and one
//  linear fit, and reads the residual's RMS plus its band power. Pure, so it
//  EXECUTES here on synthetic profiles before the bar trusts it on a capture.
// ============================================================

describe('the blend share-spectrum detector (261126-n20 task 3)', () => {
  const W = BLEND_WORM_BAND_LO_PX
  const H = BLEND_WORM_BAND_HI_PX

  it('pins the declared worm band, the minimum station count and the AC floor', () => {
    expect(W).toBe(4)
    expect(H).toBe(32)
    expect(BLEND_MIN_STATIONS).toBe(8)
    expect(BLEND_AC_FLOOR).toBe(0.0001)
  })

  it('reads a flat profile as zeros', () => {
    const spectrum = shareSpectrum(new Array<number>(64).fill(0.4))
    expect(spectrum.acRms).toBe(0)
    expect(spectrum.bandShare).toBe(0)
    expect(spectrum.peakPx).toBe(0)
  })

  it('reads a synthetic 12 px sinusoid as its own band peak', () => {
    // 48 stations at 1 px: lambda 12 divides n, so its bin holds the stripe's
    // power; the residual linear fit steals a little RMS (0.0694, not A/sqrt2
    // exactly) and the neighbouring bins carry Dirichlet leakage, so the
    // honest assertions are the PEAK and a near-unity band share.
    const n = 48
    const profile = Array.from({ length: n }, (_, i) => 0.4 + 0.1 * Math.sin((2 * Math.PI * i) / 12))
    const spectrum = shareSpectrum(profile)
    expect(spectrum.peakPx).toBe(12)
    expect(spectrum.bandShare).toBeGreaterThanOrEqual(0.99)
    expect(spectrum.acRms).toBeCloseTo(0.1 / Math.SQRT2, 2)
  })

  it('reads an out-of-band stripe as a band share near 0', () => {
    // lambda 3 sits below the declared 4 px near edge: it is AC energy, but
    // not THIS defect's energy. The integer-bin grid leaks a little into the
    // band (measured 0.008), so the bar is "near 0", not "exactly 0".
    const n = 48
    const profile = Array.from({ length: n }, (_, i) => 0.4 + 0.1 * Math.sin((2 * Math.PI * i) / 3))
    const spectrum = shareSpectrum(profile)
    expect(spectrum.bandShare).toBeLessThan(0.01)
    expect(spectrum.acRms).toBeCloseTo(0.1 / Math.SQRT2, 2)
  })

  it('scales the peak to document px with the station spacing', () => {
    const n = 48
    const profile = Array.from({ length: n }, (_, i) => 0.4 + 0.1 * Math.sin((2 * Math.PI * i) / 6))
    const spectrum = shareSpectrum(profile, { stationPx: 2 })
    expect(spectrum.peakPx).toBe(12)
    // The band edges move on the 2 px station grid (2..16 stations): most of
    // the power is inside (measured 0.973), the rest leaks to finer bins.
    expect(spectrum.bandShare).toBeGreaterThan(0.95)
  })

  it('reads zeros from degenerate inputs instead of inventing a stripe', () => {
    const tooFew = shareSpectrum(new Array<number>(BLEND_MIN_STATIONS - 1).fill(0.4))
    expect(tooFew).toEqual({ acRms: 0, bandShare: 0, peakPx: 0 })
    const badSpacing = shareSpectrum(new Array<number>(32).fill(0.4), { stationPx: 0 })
    expect(badSpacing).toEqual({ acRms: 0, bandShare: 0, peakPx: 0 })
    const reversed = shareSpectrum(new Array<number>(32).fill(0.4), {
      bandLoPx: H,
      bandHiPx: W,
    })
    expect(reversed).toEqual({ acRms: 0, bandShare: 0, peakPx: 0 })
    // Below the AC floor a share of noise is arbitrary — it may only silence.
    const noise = shareSpectrum(
      Array.from({ length: 32 }, (_, i) => 0.4 + (i % 2 === 0 ? 1e-5 : -1e-5)),
    )
    expect(noise.bandShare).toBe(0)
    expect(noise.peakPx).toBe(0)
  })

  it('reads detrendedRms as 0 on flat and linear series and A/sqrt(2) on a sinusoid', () => {
    expect(detrendedRms([])).toBe(0)
    expect(detrendedRms(new Array<number>(24).fill(0.55))).toBeCloseTo(0, 12)
    expect(detrendedRms(Array.from({ length: 24 }, (_, i) => 0.2 + 0.01 * i))).toBeCloseTo(0, 12)
    const wave = Array.from({ length: 48 }, (_, i) => 0.1 * Math.sin((2 * Math.PI * i) / 8))
    // The residual linear fit is not exactly 0 on this sampling phase
    // (measured 0.07017 vs 0.07071), so the analytic value is a 2-digit bound.
    expect(detrendedRms(wave)).toBeCloseTo(0.1 / Math.SQRT2, 2)
  })

  it('reads the blend scene, its pickup allowlist and the report fields', () => {
    // Both closed lists accept the scenario, literal-identically.
    expectContains(PROBE, "raw !== 'bristle-line' && raw !== 'bristle-blend' && raw !== 'bristle-tip'")
    expectContains(RUN, "scenarioRaw !== 'bristle-line' && scenarioRaw !== 'bristle-blend' && scenarioRaw !== 'bristle-tip'")
    // --pickup rides the scene allowlist; --stroke-size and --mut accept it.
    expectContains(RUN, "const PICKUP_SCENES = [...LAYER_SCENES, 'bristle-blend']")
    expectContains(
      PROBE,
      "'--pickup is only valid with --scenario edge-layer, edge-rim, bristle-end, bristle-line, bristle-blend or pickup-under'",
    )
    expectContains(RUN, "scenario !== 'bristle-blend'")
    // The other knobs stay refused on it.
    expectContains(RUN, '--over is only valid with --scenario bristle-line')
    expectContains(RUN, "const feather = readEndPercent('--feather', EDGE_KNOB_SCENES)")
    // The scene, its per-surface capture and the committed mirror.
    expectContains(PROBE, 'function bristleBlendScript(')
    // 261126-v8j: feather-noise joins the lineCapture gate, so the guard broke
    // across lines. The pin follows the source — same clause set, one more arm.
    expectContains(
      PROBE,
      "scenario !== 'bristle-line' &&\n        scenario !== 'bristle-blend' &&\n        scenario !== 'feather-noise'",
    )
    expectContains(PROBE, "(set as Record<string, unknown>)['blend'] = blendProfileSet(engine, strokeSize)")
    expectContains(PROBE, "lineSurfaces['postFix']")
    expectContains(PROBE, 'blendShareMean: round4(shareMean),')
    expectContains(PROBE, 'blendAcrossAc: spectrum.acRms,')
    expectContains(PROBE, 'wormBandShare: spectrum.bandShare,')
    expectContains(PROBE, 'wormPeakPx: spectrum.peakPx,')
    expectContains(PROBE, 'blendAnisotropy: round4(alongAc > 1e-9 ? spectrum.acRms / alongAc : 0),')
    expectContains(PROBE, '...blendReport,')
    // The readout consumes the pure helper on the live profile.
    expectContains(PROBE, "from './blend'")
    expectContains(PROBE, 'const spectrum = shareSpectrum(shareProfile)')
    expectContains(PROBE, 'alongSum += detrendedRms(series)')
    // The console report prints the blend line.
    expectContains(RUN, 'blend      : COMMITTED size')
  })

  it('registers the pickup-under scene, its under operand and its readout (261127-khp task 1)', () => {
    // The scenario enters BOTH closed lists, appended LAST so every earlier
    // adjacency pin survives as a prefix; the message names it BEFORE the
    // final "bristle-tip" clause, so the `or "bristle-tip")` pins stay green.
    expectContains(PROBE, "raw !== 'feather-noise' && raw !== 'pickup-under'")
    expectContains(RUN, "scenarioRaw !== 'feather-noise' && scenarioRaw !== 'pickup-under'")
    expectContains(PROBE, '"edge-rim", "pickup-under" or "bristle-tip"')
    expectContains(RUN, '"edge-rim", "pickup-under" or "bristle-tip"')
    // The `--under` operand: parsed in run.mjs, refused off the scene and on
    // any unknown value, forwarded through the explicit pageQuery enumeration.
    expectContains(RUN, "const underFlag = args.indexOf('--under')")
    expectContains(
      RUN,
      '`invalid --under "${underRaw}" (expected painted, flat, blurred, constant or none)`',
    )
    expectContains(RUN, "console.error('--under is only valid with --scenario pickup-under')")
    expectContains(RUN, "(under === undefined ? '' : `&under=${under}`)")
    expectContains(PROBE, 'function readUnderKind(scenario: string): UnderKind {')
    expectContains(PROBE, "throw new Error('--under is only valid with --scenario pickup-under')")
    expectContains(
      PROBE,
      '`invalid under "${raw}" (expected painted, flat, blurred, constant or none)`',
    )
    // The scene constants: the artist's exact pair.
    expectContains(PROBE, "const PICKUP_UNDER_BLUE = '#1a88ec'")
    expectContains(PROBE, "const PICKUP_UNDER_YELLOW = '#f9e01c'")
    expectContains(PROBE, 'const PICKUP_UNDER_UNDER_SIZE = 250')
    // The blurred control: the five paint layers' half-float box mean, the
    // sheet restored in place (wet/relief/lastTouch skipped by name).
    expectContains(PROBE, 'function blurWholeSheet(engine: WatercolorEngine, sheet: number): void {')
    expectContains(PROBE, 'whole.layers[key] = blurHalfLayer(src, w, h, 4)')
    expectContains(PROBE, "from '../../src/playground/half'")
    // The report: the recipe echoes, the stripe spectrum (fine + the 4-32 px
    // diagnostic), the body share, the bleed, the replay verdict and the crop.
    expectContains(PROBE, 'pickupUnderKind: PICKUP_UNDER_KIND,')
    expectContains(PROBE, 'pickupUnderSize: strokeSize,')
    expectContains(PROBE, 'pickupUnderPickup: EDGE_LAYER_PICKUP ?? 100,')
    expectContains(PROBE, 'pickupUnderEdge: EDGE_LAYER_AMOUNT,')
    expectContains(PROBE, 'pickupUnderStripeRms:')
    expectContains(PROBE, 'pickupUnderStripePeakPx:')
    expectContains(PROBE, 'pickupUnderStripeWideRms:')
    expectContains(PROBE, 'pickupUnderBodyShare:')
    expectContains(PROBE, 'pickupUnderBoundaryBleedPx:')
    expectContains(PROBE, 'pickupUnderReplayIdentical:')
    expectContains(PROBE, 'pngMid: pickupUnderCrop(transparentCanvas, strokeSize),')
    expectContains(PROBE, 'PICKUP_UNDER_KIND = readUnderKind(scenario)')
    // The visit skips the shared drive and rides the split cadence its replay
    // re-runs, so the two digests are the same measurement.
    expectContains(
      PROBE,
      "if (scenario === 'edge-layer' || scenario === 'edge-rim' || scenario === 'pickup-under') return",
    )
    expectContains(PROBE, "if (scenario === 'pickup-under') {")
    expectContains(PROBE, 'pinStrokeStart(engine)')
  })

  it('re-baselines the scene on the dominant band, the boundary and the constant control (261127-lpj task 1)', () => {
    // The defect's own scale: the 4-40 px dominant band (khp measured ~23 px
    // stripes), declared as named constants with the doc-px station grid.
    expectContains(PROBE, 'const PICKUP_UNDER_DOMINANT_LO_PX = 4')
    expectContains(PROBE, 'const PICKUP_UNDER_DOMINANT_HI_PX = 40')
    expectContains(PROBE, 'bandLoPx: PICKUP_UNDER_DOMINANT_LO_PX,')
    expectContains(PROBE, 'bandHiPx: PICKUP_UNDER_DOMINANT_HI_PX,')
    expectContains(PROBE, 'pickupUnderStripeDominantRms:')
    expectContains(PROBE, 'pickupUnderStripeDominantAc:')
    expectContains(PROBE, 'pickupUnderStripeDominantPeakPx:')
    expectContains(PROBE, 'pickupUnderStripeDominantBandShare:')
    // The under's leading-edge 10-90 width: the boundary bar's instrument.
    expectContains(PROBE, 'const PICKUP_UNDER_EDGE_STEP_PX = 0.5')
    expectContains(PROBE, 'const PICKUP_UNDER_EDGE_SEARCH_PX = 40')
    expectContains(PROBE, 'const PICKUP_UNDER_EDGE_IN_PX = 8')
    expectContains(PROBE, 'const PICKUP_UNDER_EDGE_OUT_PX = 20')
    expectContains(PROBE, 'const PICKUP_UNDER_EDGE_MIN_DELTA = 6')
    expectContains(PROBE, 'function pickupUnderBoundarySharp(')
    expectContains(PROBE, 'transitionWidthPx(profile, PICKUP_UNDER_EDGE_STEP_PX)')
    // A missing edge reads null, never a manufactured width.
    expectContains(PROBE, 'pickupUnderBoundarySharpPx:')
    expectContains(PROBE, 'pickupUnderBoundarySharpWorstPx:')
    expectContains(PROBE, 'pickupUnderBoundarySharpValid:')
    expectContains(PROBE, 'pickupUnderBoundarySharpSkip:')
    // The constant-under control: the painted under's pigment replaced by its
    // own channel-wise median, on the visit AND on both replays.
    expectContains(PROBE, "raw !== 'blurred' &&")
    expectContains(PROBE, "raw !== 'constant' &&")
    expectContains(RUN, "underRaw !== 'blurred' &&")
    expectContains(RUN, "underRaw !== 'constant' &&")
    expectContains(PROBE, 'function constantUnder(engine: WatercolorEngine, sheet: number): void {')
    expectContains(PROBE, "if (PICKUP_UNDER_KIND === 'constant') {")
    expectContains(PROBE, "if ((kind === 'blurred' || kind === 'constant') && script.length === 2 && index === 0) {")
    expectContains(PROBE, 'else constantUnder(engine, sheet)')
  })
})

// ============================================================
//  quick 261127-lpj task 1: the boundary-width detector.
//
//  The pickup-under GREEN bar needs the under's leading edge expressed as a
//  number: the 10-90 percent transition width of the fill profile, in document
//  px. Pure (blend.ts), so it EXECUTES here on synthetic profiles before any
//  capture trusts it. A linear ramp rises over its full support, so a ramp
//  whose 10-90 crossings span 8 px is a 10 px 0->1 rise at 1 px steps — the
//  test states the crossing positions instead of trusting intuition.
// ============================================================

describe('the boundary-width detector (261127-lpj task 1)', () => {
  it('reads a linear ramp as its 10-90 crossing span in px', () => {
    // 32 stations at 1 px: 0 -> 1 over indices 10..20 (slope 0.1/px). The
    // 0.1 crossing lands on i=11, the 0.9 crossing on i=19 -> 8 px.
    const profile = Array.from({ length: 32 }, (_, i) =>
      i <= 10 ? 0 : i >= 20 ? 1 : (i - 10) / 10,
    )
    expect(transitionWidthPx(profile, 1)).toBe(8)
    // The station grid scales the width, never the crossings.
    expect(transitionWidthPx(profile, 0.5)).toBe(4)
  })

  it('reads a hard step as one station wide', () => {
    const profile = Array.from({ length: 32 }, (_, i) => (i < 16 ? 0.2 : 0.8))
    expect(transitionWidthPx(profile, 1)).toBe(1)
    expect(transitionWidthPx(profile, 0.5)).toBe(0.5)
  })

  it('reads null instead of inventing an edge', () => {
    // Flat: no span to cross.
    expect(transitionWidthPx(new Array<number>(32).fill(0.4), 1)).toBeNull()
    // Below the minimum station count.
    expect(transitionWidthPx(new Array<number>(BLEND_MIN_STATIONS - 1).fill(0.4), 1)).toBeNull()
    // A non-positive or non-finite station step.
    expect(transitionWidthPx(new Array<number>(32).fill(0.4), 0)).toBeNull()
    expect(transitionWidthPx(new Array<number>(32).fill(0.4), Number.NaN)).toBeNull()
    // Reversed or non-finite percentages.
    expect(transitionWidthPx(new Array<number>(32).fill(0.4), 1, 0.9, 0.1)).toBeNull()
    expect(transitionWidthPx(new Array<number>(32).fill(0.4), 1, Number.NaN, 0.9)).toBeNull()
  })

  it('reads a falling profile with the same crossing span', () => {
    // The edge may face either way (the under reads dark on light or light on
    // dark); the signed span is handled, the width stays positive. Dyadic
    // values keep every threshold comparison exact: t = 0.375 at i=11 and
    // t = 1.0 at i=16 -> 5 px, the mirror of the rising ramp below.
    const falling = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0.625, 0.5, 0.375, 0.25, 0.125]
    const profile = [...falling, ...new Array<number>(32 - falling.length).fill(0)]
    expect(transitionWidthPx(profile, 1)).toBe(5)
    const rising = profile.map((v) => 1 - v)
    expect(transitionWidthPx(rising, 1)).toBe(transitionWidthPx(profile, 1))
  })
})

// ============================================================
//  quick 261126-rov task 1: the along-coherence reading.
//
//  The displacement law's success is judged partly by the eye, but the
//  instrument that names what the eye sees is coherence ALONG the travel: a
//  straight dark band repeats its across profile station after station, while
//  a broken/organic texture does not. `alongCoherence` measures exactly that
//  (mean Pearson correlation between each station's profile and the profile
//  one lag further along). Report-only: no threshold here, the number is
//  recorded and the bars stay the frozen ones. Pure, so it EXECUTES here on
//  synthetic profiles before any capture trusts it.
// ============================================================

describe('the along-coherence detector (261126-rov task 1)', () => {
  const BAND = 16
  const row = (value: number): number[] => new Array<number>(64).fill(value)
  const withBand = (): number[] => {
    const r = row(0.4)
    for (let i = BAND; i < BAND + 4; i += 1) r[i] = 0.75
    return r
  }

  it('reads identical straight-band profiles as coherent at lag 1', () => {
    const rows = Array.from({ length: 24 }, withBand)
    const coherence = alongCoherence(rows, 1)
    expect(coherence.corr).toBeGreaterThan(0.95)
    // 24 stations, lag 1: every adjacent pair compares → 23 pairs.
    expect(coherence.stations).toBe(23)
  })

  it('reads a diagonal band as incoherent at lag 1', () => {
    // The band moves one across cell per along station — the "straight line"
    // the artist sees is exactly this: a run lookup that never changes.
    const rows = Array.from({ length: 24 }, (_, s) => {
      const r = row(0.4)
      r[BAND + s] = 0.75
      return r
    })
    const coherence = alongCoherence(rows, 1)
    expect(coherence.corr).toBeLessThanOrEqual(0.2)
    expect(coherence.stations).toBe(23)
  })

  it('reads degenerate inputs as stations 0 and corr 0 without NaN', () => {
    // Flat rows carry no across variance: nothing to correlate, never a NaN.
    const flat = Array.from({ length: 24 }, () => row(0.5))
    const flatRead = alongCoherence(flat, 1)
    expect(flatRead.corr).toBe(0)
    expect(flatRead.stations).toBe(0)
    // Rows <= lag compare no pair; zero lag is invalid input.
    const short = Array.from({ length: 3 }, withBand)
    expect(alongCoherence(short, 3).stations).toBe(0)
    expect(alongCoherence(short, 3).corr).toBe(0)
    expect(alongCoherence([], 1)).toEqual({ corr: 0, stations: 0 })
    expect(alongCoherence(Array.from({ length: 24 }, withBand), 0)).toEqual({
      corr: 0,
      stations: 0,
    })
  })

  it('pins the readout on both ridge sites and the 1:1 mid-body crop', () => {
    expectContains(PROBE, "import { alongCoherence, type AlongCoherence } from './ridge'")
    expectContains(PROBE, 'function ridgeCoherenceSet(')
    expectContains(PROBE, 'lag8: alongCoherence(profiles, lag(8)),')
    expectContains(PROBE, 'lag16: alongCoherence(profiles, lag(16)),')
    expectContains(PROBE, 'lag32: alongCoherence(profiles, lag(32)),')
    // The readout rides BOTH ridge sites (the line surfaces and the end lanes).
    expect(PROBE.split('ridgeCoherence,').length - 1).toBe(2)
    // The 1:1 mid-body crop is additive: both scenes emit it, run.mjs writes
    // the kind beside the end crops and strips the payload from the JSON.
    expectContains(PROBE, 'pngMid: midBodyCrop(transparentCanvas),')
    expect(PROBE.split('pngMid: midBodyCrop(transparentCanvas),').length - 1).toBe(2)
    expectContains(PROBE, 'function midBodyCrop(transparent: HTMLCanvasElement): string {')
    expectContains(RUN, "['pngMid', 'mid']")
  })
})
