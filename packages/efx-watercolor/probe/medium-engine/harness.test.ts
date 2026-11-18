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
