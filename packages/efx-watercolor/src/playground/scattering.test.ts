// ============================================================
//  The one perceptual Body curve and the scattering deposit law
//  (Phase 64, D-14 / MED-21 / MED-32).
//
//  Family: plain unit test on the existing setup — no new config. Both laws
//  are pure functions, so they are tested directly; the cover pass and the
//  deposit sites that consume them are pinned by source scan in
//  coverage.test.ts and here, and the byte-level proof lives in
//  probe/medium-engine.
//
//  Laws pinned here:
//   1. BODY_CURVE_EXPONENT is 6 — the exponent is exported, never inlined.
//   2. bodyCurve(0) = 0, bodyCurve(0.5) = 0.015625 (a glaze, D-14),
//      bodyCurve(1) = 1 (a true cover at the tip core).
//   3. The curve is monotone over the band and clamps outside it; a
//      non-finite input maps to the neutral 0.
//   4. The module declares the curve exactly once, imports nothing from the
//      engine, and its header records D-14 (superseding spec 06 §3's inline
//      clamp) and that 64-08 extends this module.
//   5. SCATTERING_MAX is exactly 1 and SCATTER_EPSILON exactly 1e-3, both
//      exported as positive finite numbers, the epsilon far below any real
//      deposit the engine produces.
//   6. scatteringDeposit(body, amount) = SCATTERING_MAX × bodyCurve(body) ×
//      amount: it scales with the dab amount, is monotone in body, and a
//      zero, negative or non-finite amount deposits exactly 0 — never NaN.
//   7. The package barrel re-exports the law module, so the app and later
//      plans import the law from one place.
//   8. The brush dab, the pen splat and the bucket fill each write
//      `scatteringDeposit(P.body, amount)` into their second colour vector's
//      alpha, and no deposit site reads a retired pigment white member.
//   9. `settleFS` carries the mobile scattering into the fixed layer
//      (`oB = vec4(B.rgb * uSettle, B.a * uSettle)`), with no `keep` factor.
//  10. The bleach program, the composite coverage term and the gouache colour
//      are gone; the display mode structure and the final paper multiply stay.
//  11. `Pigment` has one member and only `pigmentFromHex` constructs one: the
//      retirement audit MED-37 asks for, recorded as a test, not assumed.
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BODY_CURVE_EXPONENT,
  SCATTERING_MAX,
  SCATTER_EPSILON,
  bodyCurve,
  scatteringDeposit,
} from './scattering'
import { displayFS } from './shaders'
import { COEFFS, LEVEL_COEFFS, coeffsToLinear, pigmentFromHex } from './spectral'
import { BASIS, DISPLAY_BANDS } from './spectralData'

const HERE = dirname(fileURLToPath(import.meta.url))

const SOURCE = readFileSync(resolve(HERE, 'scattering.ts'), 'utf8')
const INDEX_SOURCE = readFileSync(resolve(HERE, 'index.ts'), 'utf8')
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
const SHADERS_SOURCE = readFileSync(resolve(HERE, 'shaders.ts'), 'utf8')
const SPECTRAL_SOURCE = readFileSync(resolve(HERE, 'spectral.ts'), 'utf8')
const ADAPTER_SOURCE = readFileSync(resolve(HERE, '../adapter/engineAdapter.ts'), 'utf8')
const PAYLOAD_SOURCE = readFileSync(resolve(HERE, '../payload/toStudioStroke.ts'), 'utf8')
const APP_LAYER_SOURCE = readFileSync(
  resolve(HERE, '../../../../app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx'),
  'utf8',
)

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` would dump the module into the RED report and break its format.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectNotContains(source: string, needle: string): void {
  expect(source.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

/** Slice the source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe('the one Body curve (D-14 / MED-21)', () => {
  it('exports exponent 6 and pins the four band values', () => {
    expect(BODY_CURVE_EXPONENT, 'the exponent is 6').toBe(6)
    expect(bodyCurve(0), 'Body 0 erases nothing').toBe(0)
    expect(bodyCurve(0.5), 'Body 50 is a glaze (1/64)').toBe(0.015625)
    expect(bodyCurve(1), 'Body 100 reaches a true cover at the tip core').toBe(1)
  })

  it('is monotone over the band and clamps outside it', () => {
    let previous = -1
    for (let i = 0; i <= 200; i += 1) {
      const value = bodyCurve(i / 200)
      expect(value >= previous, `not monotone at ${i / 200}`).toBe(true)
      previous = value
    }
    expect(bodyCurve(-0.5), 'below the band clamps to 0').toBe(0)
    expect(bodyCurve(2), 'above the band clamps to 1').toBe(1)
  })

  it('maps a non-finite body to the neutral 0', () => {
    expect(bodyCurve(Number.NaN), 'NaN is the neutral 0').toBe(0)
    expect(bodyCurve(Number.POSITIVE_INFINITY), 'Infinity is the neutral 0').toBe(0)
    expect(bodyCurve(Number.NEGATIVE_INFINITY), '-Infinity is the neutral 0').toBe(0)
  })

  it('is the only declaration, imports nothing from the engine, and records D-14', () => {
    expect(
      (SOURCE.match(/export function bodyCurve/g) ?? []).length,
      'one curve declaration',
    ).toBe(1)
    expect(
      (SOURCE.match(/BODY_CURVE_EXPONENT = 6/g) ?? []).length,
      'one exponent declaration, at 6',
    ).toBe(1)
    expectContains(SOURCE, 'Math.pow(clamp01(body), BODY_CURVE_EXPONENT)')
    expect(
      /from '\.\/Engine'/.test(SOURCE),
      'the curve imports nothing from the engine',
    ).toBe(false)
    expect(SOURCE.includes('D-14'), 'the header records D-14').toBe(true)
    expect(SOURCE.includes('supersedes'), 'the header records the superseded inline clamp').toBe(true)
    expect(SOURCE.includes('64-08'), 'the header names the plan that extends this module').toBe(true)
  })
})

describe('the scattering deposit law (D-14 / MED-32)', () => {
  it('exports SCATTERING_MAX = 1 and SCATTER_EPSILON = 1e-3', () => {
    expect(SCATTERING_MAX, 'the saturated deposit at unit amount is 1').toBe(1)
    expect(SCATTER_EPSILON, 'the render-side cheap-branch switch is 1e-3').toBe(1e-3)
    expect(Number.isFinite(SCATTERING_MAX) && SCATTERING_MAX > 0, 'SCATTERING_MAX is positive and finite').toBe(true)
    expect(Number.isFinite(SCATTER_EPSILON) && SCATTER_EPSILON > 0, 'SCATTER_EPSILON is positive and finite').toBe(true)
    // The epsilon must stay far below any real deposit: Body 50 at unit
    // amount is the faintest value UAT 3 calls visible paint.
    expect(
      SCATTER_EPSILON < scatteringDeposit(0.5, 1),
      'the epsilon sits below a Body-50 unit-amount deposit',
    ).toBe(true)
  })

  it('equals SCATTERING_MAX × bodyCurve(body) × amount', () => {
    for (const body of [0, 0.25, 0.5, 0.75, 1]) {
      for (const amount of [0.125, 0.5, 1, 2]) {
        expect(scatteringDeposit(body, amount), `deposit at body ${body}, amount ${amount}`).toBe(
          SCATTERING_MAX * bodyCurve(body) * amount,
        )
      }
    }
    expect(scatteringDeposit(0.5, 1), 'Body 50, unit amount').toBe(0.015625)
    expect(scatteringDeposit(1, 1), 'Body 100, unit amount').toBe(1)
    expect(scatteringDeposit(1, 0.5), 'Body 100, half amount').toBe(0.5)
  })

  it('is monotone in body for a fixed amount', () => {
    let previous = -1
    for (let i = 0; i <= 200; i += 1) {
      const value = scatteringDeposit(i / 200, 0.37)
      expect(value >= previous, `not monotone at ${i / 200}`).toBe(true)
      previous = value
    }
  })

  it('deposits exactly 0 for a zero, negative or non-finite amount', () => {
    expect(scatteringDeposit(1, 0), 'zero amount deposits nothing').toBe(0)
    expect(scatteringDeposit(1, -0.5), 'a negative amount deposits nothing').toBe(0)
    expect(scatteringDeposit(1, Number.NaN), 'a NaN amount deposits nothing').toBe(0)
    expect(scatteringDeposit(1, Number.POSITIVE_INFINITY), 'an infinite amount deposits nothing').toBe(0)
    // 0 × Infinity would be NaN without the amount guard.
    expect(scatteringDeposit(0, Number.POSITIVE_INFINITY), 'a neutral body and an infinite amount').toBe(0)
  })

  it('stays finite and non-negative on a hostile grid', () => {
    const bodies = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -3, -0.01, 0, 0.5, 1, 2, 1e9]
    const amounts = [0, -1, 1e-9, 0.5, 1, 1e6]
    for (const body of bodies) {
      for (const amount of amounts) {
        const value = scatteringDeposit(body, amount)
        expect(Number.isFinite(value), `finite at body ${body}, amount ${amount}`).toBe(true)
        expect(value >= 0, `non-negative at body ${body}, amount ${amount}`).toBe(true)
      }
    }
  })

  it('declares the deposit law once, allocates nothing, and records both constants', () => {
    expect(
      (SOURCE.match(/export function scatteringDeposit/g) ?? []).length,
      'one deposit declaration',
    ).toBe(1)
    expect(
      (SOURCE.match(/SCATTERING_MAX = 1/g) ?? []).length,
      'one SCATTERING_MAX declaration, at 1',
    ).toBe(1)
    expect(
      (SOURCE.match(/SCATTER_EPSILON = 1e-3/g) ?? []).length,
      'one SCATTER_EPSILON declaration, at 1e-3',
    ).toBe(1)
    expectContains(SOURCE, 'SCATTERING_MAX * bodyCurve(body) * amount')
    expect(SOURCE.includes('new '), 'the law module allocates nothing').toBe(false)
    expect(
      /from '\.\/Engine'/.test(SOURCE),
      'the law module imports nothing from the engine',
    ).toBe(false)
    // The header names both constants with their reason; 64-09 consumes the
    // epsilon as its render-side switch.
    expectContains(SOURCE, 'SCATTERING_MAX')
    expectContains(SOURCE, 'SCATTER_EPSILON')
    expectContains(SOURCE, '64-09')
  })

  it('is re-exported from the package barrel', () => {
    expectContains(INDEX_SOURCE, "from './scattering'")
    for (const name of [
      'BODY_CURVE_EXPONENT',
      'SCATTERING_MAX',
      'SCATTER_EPSILON',
      'bodyCurve',
      'scatteringDeposit',
    ]) {
      expectContains(INDEX_SOURCE, name)
    }
  })
})

describe('the scattering transport and the white-channel retirement (MED-32 / MED-33 / MED-37)', () => {
  it('writes scatteringDeposit(P.body, amount) at the three deposit sites and nowhere else', () => {
    expectContains(ENGINE_SOURCE, "import { bodyCurve, scatteringDeposit } from './scattering';")
    expect(
      (ENGINE_SOURCE.match(/scatteringDeposit\(P\.body, amount\)/g) ?? []).length,
      'exactly three deposit sites: bucket fill, brush dab, pen splat',
    ).toBe(3)
    expectContains(
      ENGINE_SOURCE,
      'gl.uniform4f(p.u.uColor1, c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit(P.body, amount));',
    )
    expectContains(
      ENGINE_SOURCE,
      'const c1 = [c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit(P.body, amount)];',
    )
    expectContains(ENGINE_SOURCE, 'scatteringDeposit(P.body, amount)], 2);')
    // No deposit site may read the retired pigment member.
    expectNotContains(ENGINE_SOURCE, '.white')
  })

  it('keeps the cover pass on the same curve and declares no second one', () => {
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expectContains(brush, 'const coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN);')
    expect(
      (ENGINE_SOURCE.match(/bodyCurve\(/g) ?? []).length,
      'one call site: the cover pass reads the shared curve',
    ).toBe(1)
    expect(
      (SOURCE.match(/export function bodyCurve/g) ?? []).length,
      'the curve stays declared once, in scattering.ts',
    ).toBe(1)
  })

  it('carries the mobile scattering into the settled layer through settleFS', () => {
    const settle = sliceBetween(SHADERS_SOURCE, 'export const settleFS', 'export const liftFS')
    expectContains(settle, 'oA = A * uSettle;')
    expectContains(settle, 'oB = vec4(B.rgb * uSettle, B.a * uSettle);')
    expectNotContains(settle, 'keep')
    // The bleach program is gone from the shader module and from the registry.
    expectNotContains(SHADERS_SOURCE, 'bleach')
    expectNotContains(ENGINE_SOURCE, 'bleach')
  })

  it('has no gouache coverage term left in the composite or the layout comment', () => {
    // displayFS is emitted by displaySource(false) (261125-kvl Task 4); the
    // export is the shipped compositor's exact shader text.
    const display = displayFS
    expect(display.length, 'displayFS is present').toBeGreaterThan(0)
    // 2026-11-21: the mode-4 alpha is darkness-only, and the coverage channel
    // returns ONLY as the live-underlay composite weight (a dab attenuates the
    // settled paint under it by 1 - cover). The retired gouache coverage term
    // must not come back with it: no cov-driven alpha, no gouache.
    expect(
      (display.match(/\bcov\b/g) ?? []).length,
      'coverage appears only in the live underlay seam',
    ).toBe(2)
    expectNotContains(display, 'max(darkAlpha, cov)')
    expectNotContains(display, 'gouache')
    // The mode structure, the paper multiply and every remaining uniform stay.
    expectContains(display, 'if (uMode == 4){')
    expectContains(display, 'if (uMode == 2){')
    expectContains(display, 'vec3 paperCol = paperColour(paper, uMode == 3 ? vec3(1.0) : uPaperTint);')
    expectContains(display, 'vec3 litLinear = shade == 1.0 ? rgb : fromSRGB(lit);')
    expectContains(display, 'vec3 col = litLinear * paperCol;')
    expectContains(display, 'o = vec4(toSRGB(col), 1.0);')
    expectContains(SHADERS_SOURCE, 'B.a = scattering')
    expectNotContains(SHADERS_SOURCE, 'gouache')
  })

  it('retires the white member from the pigment record and its factory', () => {
    expectNotContains(SPECTRAL_SOURCE, 'WHITE_GOUACHE')
    expectNotContains(SPECTRAL_SOURCE, 'white:')
    expectContains(SPECTRAL_SOURCE, 'return { coeffs };')
    const pigment = sliceBetween(SPECTRAL_SOURCE, 'export interface Pigment {', '}')
    expectContains(pigment, 'coeffs: Float32Array;')
    expectNotContains(pigment, 'white')
  })

  it('constructs a pigment only through pigmentFromHex (MED-37 retirement audit)', () => {
    // The shipped consumers wrap the factory: two app sites, one adapter site.
    for (const [name, source] of [
      ['app AquarelleCanvasLayer.tsx', APP_LAYER_SOURCE],
      ['adapter engineAdapter.ts', ADAPTER_SOURCE],
    ] as const) {
      const calls = source.match(/setPigment\(/g) ?? []
      const factoryCalls = source.match(/setPigment\(pigmentFromHex\(/g) ?? []
      expect(calls.length, `${name} calls setPigment`).toBeGreaterThan(0)
      expect(factoryCalls.length, `${name} builds pigments only through pigmentFromHex`).toBe(
        calls.length,
      )
      expectNotContains(source, 'coeffs:')
    }
    // The engine's ONE Pigment-shaped literal is the per-dab interpolation
    // scratch, and it carries coeffs only. SPIKE 001: the coverage deposit
    // receives the same coefficients as a typed parameter, so the third token
    // is a method annotation, never a second pigment record.
    const scratch = sliceBetween(ENGINE_SOURCE, 'private readonly scratchPigment', 'private nav = false;')
    expectContains(scratch, 'coeffs: Float32Array')
    expectContains(scratch, 'coeffs: new Float32Array(COEFFS)')
    expectNotContains(scratch, 'white')
    expect(
      (ENGINE_SOURCE.match(/coeffs:/g) ?? []).length,
      'three coeffs tokens: the scratch type and value, plus the coverageDeposit parameter',
    ).toBe(3)
    expect(
      (ENGINE_SOURCE.match(/coeffs: Float32Array/g) ?? []).length,
      'the only bare annotations are the scratch field and the coverageDeposit parameter',
    ).toBe(2)
    expectContains(
      ENGINE_SOURCE,
      'private coverageDeposit(x: number, y: number, r: number, angle: number, amount: number, density: number, coeffs: Float32Array,',
    )
    // The stroke payload the app records never carries a pigment record, so no
    // shipped project file can hold the retired channel.
    expectNotContains(PAYLOAD_SOURCE, 'Pigment')
    expectNotContains(PAYLOAD_SOURCE, 'coeffs')
  })
})

// ============================================================
//  64-10 (MED-36 / MED-38) — the composition of order and opacity, the
//  erode coupling, and the no-cost pins.
//
//  Laws pinned here:
//   1. One curve, two consumers: the cover pass calls bodyCurve(P.body) and
//      the deposit law calls bodyCurve(body); no file in the package declares
//      a second curve, a second exponent, or re-derives the power.
//   2. The lift shader writes its erosion factor to both outputs, and the
//      cover pass draws the lift program into the two-attachment fixed target
//      and into the relief, so the settled scattering (fixed B.a) is eroded
//      beside the pigment it sits in.
//   3. Scattering adds no render target, no program and no history layer: the
//      allocation region, the programs registry and the recorded layer list
//      keep their pre-scattering counts.
//   4. One scattering scalar in the display shader and no per-pigment
//      scattering anywhere: the law module carries no pigment record.
//   5. `body` rides the recorded global params key list, is absent from the
//      brush / tool-override shape (whose `scatter` is the AQUA-03 tip
//      multiplier, not the optical S), and reaches the engine through the one
//      canonical mapping.
//   6. No scattering value is written into a stroke payload: the recorded
//      params bag is its only carrier.
// ============================================================

const RECORD_STATE_SOURCE = readFileSync(
  resolve(HERE, '../../../../app/src/components/physic-paint/view/aquarelleRecordState.ts'),
  'utf8',
)
const TIPS_SOURCE = readFileSync(resolve(HERE, '../brushes/tips.ts'), 'utf8')
const PARAMS_SOURCE = readFileSync(resolve(HERE, 'params.ts'), 'utf8')

const SRC_ROOT = resolve(HERE, '..')

function packageSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...packageSourceFiles(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

const PACKAGE_SOURCES = packageSourceFiles(SRC_ROOT).map(file => ({
  file: file.slice(SRC_ROOT.length + 1),
  text: readFileSync(file, 'utf8'),
}))

function filesMatching(pattern: RegExp): string[] {
  return PACKAGE_SOURCES.filter(({ text }) => pattern.test(text)).map(({ file }) => file)
}

describe('the composition of order and opacity (MED-36)', () => {
  it('reads the one curve in the cover pass and in the deposit law', () => {
    expect((SOURCE.match(/export function bodyCurve/g) ?? []).length, 'one curve declaration').toBe(1)
    expectContains(SOURCE, 'SCATTERING_MAX * bodyCurve(body) * amount')
    const deposit = sliceBetween(SOURCE, 'export function scatteringDeposit', '\n}')
    expectContains(deposit, 'bodyCurve(body)')
    expectNotContains(deposit, 'Math.pow(')
    expectNotContains(deposit, 'Math.min(')
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expectContains(brush, 'const coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN);')
    expectNotContains(brush, 'Math.pow(')
  })

  it('declares no second curve anywhere in the package', () => {
    expect(filesMatching(/function bodyCurve\s*\(/), 'one curve declaration').toEqual([
      'playground/scattering.ts',
    ])
    expect(filesMatching(/BODY_CURVE_EXPONENT\s*=/), 'one exponent declaration').toEqual([
      'playground/scattering.ts',
    ])
    // No consumer re-derives the curve as a power of a body value.
    expect(filesMatching(/Math\.pow\([^)]*body/), 'no re-derived curve').toEqual([
      'playground/scattering.ts',
    ])
  })

  it('erodes the scattering beside the pigment it erodes', () => {
    const lift = sliceBetween(SHADERS_SOURCE, 'export const liftFS', 'const FOOTPRINT_MASK')
    expect((lift.match(/o0 = vec4\(f\);/g) ?? []).length, 'the pale output').toBe(1)
    expect((lift.match(/o1 = vec4\(f\);/g) ?? []).length, 'the scattering output').toBe(1)
    // Both attachments receive the same factor: no second expression writes o1.
    expect((lift.match(/= vec4\(f\);/g) ?? []).length, 'one factor, two outputs').toBe(2)
    const cover = sliceBetween(ENGINE_SOURCE, 'private coverPass(', 'private brushWet(')
    expectContains(cover, 'const p = this.programs.bodyCover;')
    expectContains(cover, 'g.draw(this.fixed, rect);')
    expectContains(cover, 'g.draw(this.relief, rect);')
    // The fixed target carries the settled scattering in its second attachment's
    // alpha, so one two-output cover draw erodes both.
    expectContains(
      ENGINE_SOURCE,
      'this.fixed = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);',
    )
  })

  it('declares no additional render target, program or history layer', () => {
    const alloc = sliceBetween(ENGINE_SOURCE, 'private allocateTargets()', 'private allocateHistory()')
    expect(
      (alloc.match(/this\.\w+ = g\.(?:double|target)\(/g) ?? []).length,
      'fifteen target allocations: the coverage pair is the eleventh (SPIKE 001); 64-21 adds the three-reservoir bristle pair and the shape texture (SPIKE 002); 64-24 adds the document-sized R32F last-touch pair (D-24, D-29); 261119-pod adds the smear snapshot target (D-28)',
    ).toBe(15)
    expectContains(alloc, 'this.relief = g.target(')
    // 64-21: the fixed 1 × 256 bristle set — three RGBA16F reservoir
    // attachments (ping-pong) and the static shape texture, NEAREST.
    expectContains(
      alloc,
      'this.bristles = g.double(1, BRISTLE_CAP, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.NEAREST);',
    )
    expectContains(alloc, 'this.bristleShape = g.target(1, BRISTLE_CAP, [HALF_FLOAT_RGBA], gl.NEAREST);')
    const programs = sliceBetween(ENGINE_SOURCE, 'this.programs = {', '};')
    expect(
      (programs.match(/this\.g\.program\(/g) ?? []).length,
      'twenty-three programs: coverDeposit and coverMask join the literal (SPIKE 001)',
    ).toBe(23)
    expectContains(programs, 'relief: this.g.program(S.reliefFS)')
    expectContains(programs, 'lift: this.g.program(S.liftFS)')
    const history = sliceBetween(ENGINE_SOURCE, 'private allocateHistory()', 'private docTargets()')
    expectContains(
      history,
      '{ formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R, HALF_FLOAT_R, FLOAT_R, HALF_FLOAT_R], documents: 2 }',
    )
    expectContains(history, '{ formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], documents: 1 }')
    const snapshot = sliceBetween(ENGINE_SOURCE, 'private snapshotLayers()', 'private drawSplat(')
    expectContains(
      snapshot,
      'return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0], this.relief.views[0], this.lastTouch.read.views[0], this.cover.read.views[0]];',
    )
  })

  it('runs the 64-21 carrier before every deposit, only on a bristle response', () => {
    // The predicate is computed ONCE from the active brush and gates the
    // seeding and the carrier — a non-bristle response takes the shipping
    // path with no extra draw, bind or RNG draw (the identity proof).
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expect(
      (brush.match(/isBristleResponse\(/g) ?? []).length,
      'one predicate call site in the brush case',
    ).toBe(1)
    expectContains(brush, 'const bristle = isBristleResponse(b);')
    expectContains(brush, 'if (bristle && this.bristleStroke !== s) {')
    expectContains(brush, 'this.beginBristles(r);')
    // Inside eachDab the carrier comes FIRST, before the cover pass and the
    // deposit; the gather deposit itself is 64-22's.
    expectContains(brush, 'if (bristle) {')
    const dab = sliceBetween(brush, 'this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {', '});')
    const carrierAt = dab.indexOf('this.carrierPass(')
    const coverAt = dab.indexOf('this.coverPass(')
    const depositAt = dab.indexOf('this.brushInk(')
    expect(carrierAt, 'the carrier runs inside eachDab').toBeGreaterThan(-1)
    expect(coverAt, 'the cover pass still runs inside eachDab').toBeGreaterThan(-1)
    expect(depositAt, 'the deposit still runs inside eachDab').toBeGreaterThan(-1)
    expect(carrierAt, 'the carrier runs BEFORE the cover pass').toBeLessThan(coverAt)
    expect(carrierAt, 'the carrier runs BEFORE the deposit').toBeLessThan(depositAt)
    expectContains(dab, 'this.bristleTravel(dx, dy, dr);')
  })

  // 261119-pod FIRST-DAB ANCHOR: measuring travel from (0, 0) gave the first
  // dab's `alongPx` its distance from the page corner (hundreds of px), so
  // `landed` was already 1 before the stroke moved and the first dab
  // over-depleted and over-picked-up. The seed anchors the path at the
  // stroke's first dab; a new stroke re-seeds, the same stroke never does.
  it('anchors bristle travel at the stroke first dab, never the page origin', () => {
    const begin = sliceBetween(ENGINE_SOURCE, 'private beginBristles(', 'const a = new Float32Array')
    expectContains(begin, 'this.bristlePrev = null;')
    const travel = sliceBetween(ENGINE_SOURCE, 'private bristleTravel(', 'const aspect =')
    expectContains(travel, 'const prev = this.bristlePrev;')
    expectContains(travel, 'if (prev === null) {')
    expectContains(travel, 'return { travel: 0, travelPx: 0, alongPx: 0 };')
  })

  it('keeps the 64-21 bristle targets inside docTargets, before the coverage pair', () => {
    const targets = sliceBetween(ENGINE_SOURCE, 'private docTargets(): Target[] {', '\n  }')
    expectContains(targets, 'this.bristles.read, this.bristles.write, this.bristleShape,')
    // Commitments to the committed order: the wet mask precedes the bristle
    // entries, and the coverage pair stays LAST (the sheet-wipe law).
    expect(targets.indexOf('this.wetMask,')).toBeLessThan(targets.indexOf('this.bristles.read,'))
    expect(targets.indexOf('this.bristleShape,')).toBeLessThan(targets.indexOf('this.relief,'))
    expect(
      targets.trimEnd().endsWith('this.cover.read, this.cover.write];'),
      'the coverage pair stays LAST in docTargets()',
    ).toBe(true)
  })

  it('declares one scattering scalar per film reconstruction and no per-pigment scattering', () => {
    // 64-20: the FILM_PRESENCE snippet repeats the display's OWN expression
    // (`float scatter = iB.a + fB.a;`) because it rebuilds the same film. Two
    // sites, one literal — still no per-pigment scattering channel.
    expect(
      (SHADERS_SOURCE.match(/float scatter\b/g) ?? []).length,
      'the one scattering scalar per film reconstruction (display + FILM_PRESENCE)',
    ).toBe(2)
    expectContains(SHADERS_SOURCE, 'float scatter = iB.a + fB.a;')
    expectNotContains(SOURCE, 'Pigment')
    expectNotContains(SOURCE, 'coeffs')
  })

  it('carries body in the recorded params key list and not in the brush shapes', () => {
    expectContains(RECORD_STATE_SOURCE, 'body: number;')
    const keys = sliceBetween(RECORD_STATE_SOURCE, 'export const AQUARELLE_GLOBAL_KEYS', '] as const);')
    expectContains(keys, "'body',")
    expectContains(RECORD_STATE_SOURCE, 'body: 0,')
    // The brush / tool-override shape is the eight AQUA-03 multipliers; its
    // `scatter` is the tip multiplier, never the optical scattering scalar.
    const overrides = sliceBetween(TIPS_SOURCE, 'export interface AquarelleToolOverrides {', '\n}')
    expectNotContains(overrides, 'body')
    expectContains(PARAMS_SOURCE, 'body: number')
    expectContains(PARAMS_SOURCE, 'body: clamp01(num(p.body, d.body) / 100),')
  })

  it('writes no scattering value into a stroke payload', () => {
    expectNotContains(PAYLOAD_SOURCE, 'scattering')
    expectNotContains(PAYLOAD_SOURCE, 'scatteringDeposit')
    const payload = sliceBetween(PAYLOAD_SOURCE, 'export interface AquarelleStrokePayload {', '\n}')
    expect(/\bbody\s*[?:]/.test(payload), 'a body member on the payload').toBe(false)
    expect(/\bscatter\w*\s*[?:]/.test(payload), 'a scattering member on the payload').toBe(false)
    expectContains(payload, 'params: Record<string, number>')
  })
})

// ============================================================
//  64-22 (T-64-72) — the bristle gather rides the ONE curve.
//
//  A bristle dab deposits the five nearest bristles' ink-weighted CARRIED
//  COEFFICIENTS — the engine's seven absorbance coefficients plus alpha,
//  never RGB — averaged in coefficient space and written additively
//  (`ONE, ONE`), the same law `brushInk` already uses; and the SAME gather
//  writes the coverage channel exactly ONCE (`ONE, ONE_MINUS_SRC_ALPHA`).
//  The scattering S is not re-derived anywhere in the bristle path: the
//  engine computes `scatteringDeposit` (the one curve) and passes it as the
//  `uScatter` uniform, so no bristle fragment may contain `pow(`.
//
//  One shared snippet, three consumers in this plan: the ink deposit, the
//  coverage write, and D-21's Body mask — never a second copy.
// ============================================================

describe('64-22 — the bristle gather rides the one curve (T-64-72)', () => {
  it('declares one shared gather snippet and rebuilds the carrier on the exported helper', () => {
    // Spec 11: ONE generator emits both variants (the law-bearing one and the
    // neutral pre-change one); there is still exactly ONE gather law.
    expect(
      (SHADERS_SOURCE.match(/export function bristleGatherSource\(/g) ?? []).length,
      'one shared gather generator',
    ).toBe(1)
    expect(
      (SHADERS_SOURCE.match(/export const BRISTLE_GATHER = /g) ?? []).length,
      'one extended gather constant',
    ).toBe(1)
    expect(
      (SHADERS_SOURCE.match(/export const BRISTLE_GATHER_NEUTRAL = /g) ?? []).length,
      'one neutral gather constant',
    ).toBe(1)
    expect(
      (SHADERS_SOURCE.match(/Gathered gatherBristle\(/g) ?? []).length,
      'the gather law is declared once, inside the snippet',
    ).toBe(1)
    expect(
      (SHADERS_SOURCE.match(/export const BRISTLE_TEXTURES/g) ?? []).length,
      'the texture helper is exported so the carrier and the gather share it',
    ).toBe(1)
    const carrier = sliceBetween(
      SHADERS_SOURCE,
      'export const bristleCarrierFS',
      'export const BRISTLE_GATHER',
    )
    expectContains(carrier, '${HEADER}${BRISTLE_NOISE}${BRISTLE_TEXTURES}')
  })

  it('deposits the gathered coefficients as the reference lerp and takes the scatter as a uniform', () => {
    // Post-UAT 2026-11-19 (GAP-1): the shot law was an additive deposit; the
    // law is now the reference's ONE operation — mix(canvas, carried, a) —
    // split in two draws by `uMode` (attenuate, then add the carried half).
    const deposit = sliceBetween(
      SHADERS_SOURCE,
      'export const bristleDepositFS',
      'export const bristleCoverFS',
    )
    expectContains(deposit, '${HEADER}${BRISTLE_GATHER}')
    expectNotContains(deposit, 'pow(')
    expectContains(deposit, 'uniform float uScatter;')
    expectContains(deposit, 'uniform int uMode;')
    // The attenuation half writes the weight itself; the carried half writes
    // carried * a, with the scattering S riding the SAME weight.
    expectContains(deposit, 'oA = vec4(a);')
    expectContains(deposit, 'oB = vec4(a);')
    // 261119-pod: the carried half reads the smear-adjusted locals (`cA`,
    // `cB`), which equal the gathered value when Pickup is 0.
    expectContains(deposit, 'oA = cA * a;')
    expectContains(deposit, 'oB = vec4(cB * a, uScatter * a);')
    // The old additive law is gone: no bare `uAmount` multiply remains.
    expectNotContains(deposit, 'uAmount')
    // Never an RGB average: the gathered value stays in coefficient space.
    expectNotContains(deposit, 'rgb')
    // The coverage fragment writes the SAME gather's coverage, weighted by the
    // film's target opacity — never the bare union that outran the ink.
    const cover = SHADERS_SOURCE.slice(SHADERS_SOURCE.indexOf('export const bristleCoverFS'))
    expectContains(cover, '${HEADER}${BRISTLE_GATHER}')
    expectContains(cover, 'uniform float uCoverTarget;')
    // The carried weight rides src.a (the FOURTH slot) — the blend's
    // ONE_MINUS_SRC_ALPHA and the lerp both read it there. Written into the
    // green channel instead (the first cut), src.a stayed 0 and the
    // destination factor became 1: the channel accumulated additively past
    // its target and mode 4 re-promoted the alpha over its own paint.
    // 261119-pod: the write is the smear-adjusted `target`, which equals
    // `a * uCoverTarget * g.alpha` when Pickup is 0.
    expectContains(cover, 'o0 = vec4(target, 0.0, 0.0, a);')
  })

  it('wires the two lerp halves, the settled half and ONE coverage write per bristle dab', () => {
    // Slice ends at 261119-pod's snapshot pass (its five source binds are
    // pinned by their own test) and at 64-24's touch stamp: neither is a
    // deposit draw, so neither belongs in these counts.
    const ink = sliceBetween(ENGINE_SOURCE, 'private bristleInk(', 'private bristleSnapshot(')
    expectContains(ink, 'gl.blendFunc(gl.ONE, gl.ONE);')
    expectContains(ink, 'gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);')
    expectContains(ink, 'gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);')
    // The coverage write stays a LERP: its averaging over dabs IS the ragged
    // fringe. A MAX was tried 2026-11-20 and reverted the same hour — it
    // flattened every edge (Feather 0 and 100 both lost their bristle).
    expectNotContains(ink, 'gl.blendEquation(gl.MAX);')
    // Two ink draws — the attenuation and the carried add — and no more.
    expect((ink.match(/this\.ink\.read/g) ?? []).length, 'the two lerp halves').toBe(2)
    // The engine's canvas is ink + fixed: the settled half takes the SAME
    // attenuation, so an opaque film can displace dried paint.
    expect((ink.match(/this\.fixed, rect/g) ?? []).length, 'the settled half').toBe(1)
    expect((ink.match(/this\.cover\.read/g) ?? []).length, 'exactly ONE coverage write').toBe(1)
    // Attenuate before adding: mode 1 writes the weight, mode 0 the carried add.
    expect(ink.indexOf('gl.uniform1i(d.u.uMode!, 1);'), 'the attenuation comes first').toBeLessThan(
      ink.indexOf('gl.uniform1i(d.u.uMode!, 0);'),
    )
    // The dab's rectangle is touched BEFORE any draw (the undo bookkeeping).
    expect(
      ink.indexOf('this.touch('),
      'the dab is touched before the first draw',
    ).toBeGreaterThanOrEqual(0)
    expect(ink.indexOf('this.touch('), 'the touch precedes the deposit').toBeLessThan(
      ink.indexOf('g.draw(this.ink.read, rect);'),
    )
  })

  it('scatters through scatteringDeposit only — a uniform, never re-derived', () => {
    expect(
      (ENGINE_SOURCE.match(/scatteringDeposit\(/g) ?? []).length,
      'the shipped three deposit sites and no bristle re-derivation',
    ).toBe(3)
    expectContains(
      ENGINE_SOURCE,
      'const c1 = [c[4] * amount, c[5] * amount, c[6] * amount, scatteringDeposit(P.body, amount)];',
    )
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    // 64-23: the seventh argument became the dab's cumulative `alongPx` — the
    // §4.4 grain left the call because the gather derives the paper height.
    // Post-UAT 2026-11-19 (GAP-1): the fifth argument is Body's film opacity,
    // not the dab's pigment amount — the deposit is the gather's lerp weight.
    // Spike 004: the sixth argument is the reference's CONTACT pressure, not
    // the pointer's (the authored `pr` still owns the footprint and radius).
    expectContains(brush, 'if (bristle) this.bristleInk(dx, dy, dr, angle, bristleBodyAlpha, contactPr, c1[3]!, alongPx, this.bristleEndCap);')
    expectNotContains(brush, 'Math.pow(')
  })

  it('takes pickup and refill from the recorded bag and keeps the pinned counts', () => {
    // 2026-11-20 (artist): ONE response curve for the Pickup knob drives both
    // laws — 0 stays 0, 100 % is 2x the reference's drag (q·(1 + q²)).
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uPickupRate!, this.pickupResponse(this.params.pickup));')
    expectContains(ENGINE_SOURCE, 'return q * (1 + q * q);')
    // The carrier's canvas sample must be the canonical seven coefficients
    // (A = c0..c3, B.rgb = c4..c6). The old vec4(a.rgb, b.r) packing dropped
    // c3 and duplicated c4, making same-paint score ~0.97 and leaking a
    // little own-paint lift through the gate.
    expectContains(SHADERS_SOURCE, 'return texture(uInkA, uv) + texture(uFixedA, uv);')
    expectNotContains(SHADERS_SOURCE, 'vec4(a.rgb, b.r)')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uRefillRate!, this.params.refill);')
    expectContains(
      ENGINE_SOURCE,
      'gl.uniform1f(p.u.uSoftness!, gatherSoftness(this.params.feather));',
    )
    const programs = sliceBetween(ENGINE_SOURCE, 'this.programs = {', '};')
    expect(
      (programs.match(/this\.g\.program\(/g) ?? []).length,
      'the pinned literal keeps twenty-three programs',
    ).toBe(23)
    // Spec 11 (the identity gate): the DEFAULT programs are the neutral gather;
    // the law variants compile lazily the first time a slider needs them.
    expectContains(
      ENGINE_SOURCE,
      'this.programs.bristleDeposit = this.g.program(S.bristleDepositNeutralFS);',
    )
    expectContains(
      ENGINE_SOURCE,
      'this.programs.bristleCover = this.g.program(S.bristleCoverNeutralFS);',
    )
    const alloc = sliceBetween(ENGINE_SOURCE, 'private allocateTargets()', 'private allocateHistory()')
    expect(
      (alloc.match(/this\.\w+ = g\.(?:double|target)\(/g) ?? []).length,
      'fifteen allocations: 64-24 adds the documented R32F last-touch pair; 261119-pod adds the smear snapshot target; the gather adds no target of its own',
    ).toBe(15)
  })
})

// ============================================================
//  Post-UAT 2026-11-19 (GAP-1) — Body is the film's OPACITY, not a mask.
//
//  D-21 gave the bristle path a second, gather-shaped erode pass
//  (`bristleBodyCoverFS` / `coverBristlePass`): Body attenuated `fixed` and
//  `relief` under the dab while the deposit separately added ink. The live
//  UAT found the result reads as transparency — the cover union saturated
//  while the ink stayed faint, the compositor's max(darkAlpha, cov) promoted
//  the alpha and re-solved a near-white pigment, and every bristle stroke
//  wore a pale halo. The pass is REMOVED: a bristle response has no erode on
//  this path at all. Body now scales the coverage target inside the ONE
//  deposit lerp (`bristleBodyAlpha`), the settled pool is attenuated by the
//  SAME gather weight as the ink (paint replacing paint, Body absent), and
//  the non-bristle `coverPass` / `bodyCoverFS` path is untouched.
// ============================================================

describe('post-UAT — the bristle Body mask is gone, Body is film opacity', () => {
  it('deletes the D-21 program and never reintroduces a second erode', () => {
    expectNotContains(SHADERS_SOURCE, 'bristleBodyCoverFS')
    expectNotContains(ENGINE_SOURCE, 'bristleBodyCover')
    expectNotContains(ENGINE_SOURCE, 'coverBristlePass')
    // The shipped footprint twin is untouched: a non-bristle dab still reads
    // the tip-space mask.
    const shipped = sliceBetween(
      SHADERS_SOURCE,
      'export const bodyCoverFS',
      '// SPIKE 001 — the coverage composite',
    )
    expectContains(shipped, '${HEADER}${FOOTPRINT_MASK}')
    expectContains(shipped, 'float m = footprintMask();')
    // The ONE gather snippet now has exactly four program consumers: the
    // deposit, the coverage write, (post-UAT 2026-11-21) the thickness
    // deposit, so the emboss follows the mark the paint actually made, and
    // (261125-kvl) the stroke layer's two-attachment cover write, which
    // recomputes its own dab frame rather than widening `Gathered`.
    expect(
      (SHADERS_SOURCE.match(/export const bristle\w+FS = `\$\{HEADER\}\$\{BRISTLE_GATHER\}/g) ?? []).length,
      'four consumers: the deposit, the coverage write, the thickness deposit and the stroke layer cover',
    ).toBe(4)
  })

  it('maps Body to a linear film opacity with a floor that keeps Body 0 painting', () => {
    expectContains(ENGINE_SOURCE, 'const BRISTLE_BODY_ALPHA_FLOOR = 0.5;')
    expectContains(
      ENGINE_SOURCE,
      'BRISTLE_BODY_ALPHA_FLOOR + (1 - BRISTLE_BODY_ALPHA_FLOOR) * clamp(P.body, 0, 1)',
    )
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expectContains(brush, 'const bristleBodyAlpha = bristle')
    // The non-bristle order curve keeps the sixth power — untouched.
    expectContains(brush, 'const coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN);')
  })

  it('gates the ship cover pass off the bristle path and keeps the undo block in place', () => {
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expectContains(brush, 'if (coverAmount > 0 && !bristle) {')
    expectContains(
      brush,
      'this.coverPass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, dryness, grainThr);',
    )
    // The undo coverage moves WITH the write: the settled pool is now reached
    // by the bristle lerp too, so the protect block covers both paths and
    // still runs once per stamp, before eachDab's first draw.
    // LIVE-SEED (2026-11-21): the guarded form — the seed replay suppresses it.
    const protectAt = brush.indexOf('this.protectHistory(1,')
    const dabAt = brush.indexOf('this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {')
    expect(protectAt, 'the protect block survives').toBeGreaterThan(-1)
    expect(protectAt, 'the protect precedes every dab').toBeLessThan(dabAt)
    expectContains(brush, 'if (coverAmount > 0 || bristle) {')
    expectContains(brush, 'const coverRect = this.stampRect(')
    // Order inside eachDab: carrier -> (cover, non-bristle only) -> deposit.
    const dab = sliceBetween(brush, 'this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {', '});')
    const carrierAt = dab.indexOf('this.carrierPass(')
    const coverAt = dab.indexOf('this.coverPass(')
    const depositAt = dab.indexOf('this.bristleInk(')
    expect(carrierAt, 'the carrier runs first').toBeGreaterThan(-1)
    expect(coverAt, 'the cover branch runs inside eachDab').toBeGreaterThan(-1)
    expect(depositAt, 'the deposit runs inside eachDab').toBeGreaterThan(-1)
    expect(carrierAt, 'carrier before cover').toBeLessThan(coverAt)
    expect(coverAt, 'cover before deposit').toBeLessThan(depositAt)
  })

  it('composes a texture tip with the gather instead of disabling the engine (GAP-4)', () => {
    expectContains(SHADERS_SOURCE, 'uniform sampler2D uTip;')
    expectContains(SHADERS_SOURCE, 'uniform float uTipMix;')
    expectContains(SHADERS_SOURCE, 'float tipMask(vec2 uv){')
    // The tip BOUNDS where the dab lands; it never replaces the gather.
    expectContains(SHADERS_SOURCE, 'if (uTipMix > 0.0) g.coverage *= tipMask(uv);')
    // An untextured bristle brush keeps its exact law: mix(1, tip, 0) == 1.
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uTipMix!, this.brush.textureId != null ? 1 : 0);')
    expectContains(ENGINE_SOURCE, 'gl.uniform1i(p.u.uTip!, g.bindTex(4, this.tipTexture(this.brush)));')
    // 2026-11-20 (the artist's ruling): the texture-space directional blur
    // was the wrong tool and is REMOVED — the tip mask is one raw sample,
    // exactly as before, so the high-end paint is untouched. The large-brush
    // stepping is addressed on the sampling side (motion-vector supersampling),
    // never by blurring the texture.
    expectNotContains(SHADERS_SOURCE, 'uTipBlur')
    expectContains(SHADERS_SOURCE, 'return smoothstep(th, th + 0.5, t);')
  })

  it('supersamples the dab chain with the brush SIZE, never the document (the artist’s big-brush steps)', () => {
    // 2026-11-20 (artist: "samples should be proportional to the size of the
    // brush, to not slow down normal size brush"): the factor rides the
    // canonical Size and is exactly 1 below the start; the per-dab ink
    // divides by the same factor so the wash per distance is unchanged.
    expectContains(ENGINE_SOURCE, 'return bristleSampleScale(engineScaleToSize(this.params.size));')
    expectContains(ENGINE_SOURCE, "return tool === 'brush' ? frac / this.samplingScale() : frac;")
    // 2026-11-21 (261121-w5n): the declaration is `let` — the bristle dab floor
    // multiplies this same amount by the ratio it applied to the spacing, the
    // mirror of this divide, so wash per distance is still unchanged.
    expectContains(ENGINE_SOURCE, 'let amount = conc * Math.min(b.spacing, 1) / 1.8 * norm * dwell / this.samplingScale();')
  })

  it('keeps the pinned program and allocation counts', () => {
    const programs = sliceBetween(ENGINE_SOURCE, 'this.programs = {', '};')
    expect(
      (programs.match(/this\.g\.program\(/g) ?? []).length,
      'the pinned literal keeps twenty-three programs',
    ).toBe(23)
    const alloc = sliceBetween(ENGINE_SOURCE, 'private allocateTargets()', 'private allocateHistory()')
    expect(
      (alloc.match(/this\.\w+ = g\.(?:double|target)\(/g) ?? []).length,
      'fifteen allocations: removing the Body mask removes no render target; 64-24 keeps the documented R32F last-touch pair; 261119-pod adds the smear snapshot target',
    ).toBe(15)
  })
})

// ============================================================
//  64-23 — the traces in the gather and the carrier (§4.3–§5.5).
//
//  Every §6 constant is declared once in `bristles.ts` and bound here from
//  its name; each fragment expression matches the tested helper text-for-
//  text. The carrier (§3.1) and the gather (§5.1) share ONE noise family —
//  `bristleRimShare` + `bristleContact` live in `BRISTLE_NOISE`, so a
//  re-typed contact law fails every declaration scan below.
// ============================================================

describe('64-23 — the traces in the gather and the carrier', () => {
  // Spec 11: the gather body lives inside the ONE generator (both variants).
  const gather = sliceBetween(
    SHADERS_SOURCE,
    'export function bristleGatherSource(',
    '// 64-22 — the ink deposit',
  )
  const carrier = sliceBetween(SHADERS_SOURCE, 'export const bristleCarrierFS', 'export const BRISTLE_GATHER')

  it('shares one noise family between the carrier and the gather', () => {
    expect(
      (SHADERS_SOURCE.match(/float valueNoise\(/g) ?? []).length,
      'one value-noise declaration',
    ).toBe(1)
    expect(
      (SHADERS_SOURCE.match(/float bristleRimShare\(/g) ?? []).length,
      'one rim-share declaration',
    ).toBe(1)
    expect(
      (SHADERS_SOURCE.match(/float bristleContact\(/g) ?? []).length,
      'one contact-noise declaration',
    ).toBe(1)
    // Both fragments call the SHARED pair — carrier first, then gather.
    expectContains(
      carrier,
      'shape.y + bristleContact(uAlongPx, state.z, uStreakLen) * bristleRimShare(across) * uRimContact,',
    )
    expectContains(
      gather,
      'shape.y + bristleContact(uAlongPx, state.z, uStreakLen) * bristleRimShare(state.y) * uRimContact,',
    )
    // The gather composes on the SAME snippet the carrier does.
    // Spec 11: ONE composition, with the eroding-field snippet spliced in
    // only for the law variant — the neutral variant is
    // `${BRISTLE_NOISE}${BRISTLE_TEXTURES}`.
    expectContains(
      SHADERS_SOURCE,
      "return `${BRISTLE_NOISE}${extended ? FEATHER_FIELD : ''}${BRISTLE_TEXTURES}",
    )
  })

  it('builds grainHeight from three bands in two coordinate systems (§4.4)', () => {
    expectContains(gather, 'float grainHeight(vec2 css, vec2 normal){')
    // Band 1 — streaks: brush-local, rotated to the stroke normal.
    expectContains(gather, 'vec2 local = vec2(dot(css, tangent), dot(css, normal));')
    expectContains(gather, 'valueNoise(vec2(local.x / 11.0, local.y * 0.75)) * 0.65')
    expectContains(gather, 'valueNoise(vec2(local.x / 3.0, local.y * 1.9)) * 0.35')
    // Band 2 — tooth: isotropic, screen/CSS space.
    expectContains(gather, 'float tooth = valueNoise(css * 1.3) * 0.55 + valueNoise(css * 0.45 + 17.0) * 0.45;')
    // Band 3 — cloud: low frequency, screen/CSS space.
    expectContains(gather, 'float cloud = valueNoise(css * 0.12 + 41.0) * 0.45')
    expectContains(gather, 'valueNoise(css * 0.05 + 83.0) * 0.33')
    expectContains(gather, 'valueNoise(css * 0.02 + 7.0) * 0.22;')
    // The mix: streakShare swaps cloud weight for streaks; the tooth holds 0.35.
    expectContains(gather, 'return streaks * uStreakShare + tooth * 0.35 + cloud * (0.65 - uStreakShare);')
    // The trio replaces the paper tap outright: no sampler survives in the gather.
    expectContains(gather, 'float height = mix(grainHeight(css, uAxis), 0.5, rimCalm);')
    // 2026-11-22 (the pale-line rows): Feather opens the edge through this
    // threshold, never through a depth multiplier — a depth fade gives the
    // texel a small deposit weight a, and the dab lerp then holds the old
    // film for ~100 px of travel (measured ENCLOSED 7.54 % / 231 px; the
    // rejected along-only selector traded it for an 18-px band motif).
    expectContains(gather, 'float threshold = uGrain * (1.0 - height) - 0.25 + featherShift;')
    expectNotContains(gather, 'uPaper')
    expectNotContains(gather, 'texture(uPaper')
  })

  it('binds §6 grain to the gather and keeps the brush grain on the footprint', () => {
    // The §4.4 name collision, pinned on both sides of the seam: the gather's
    // uGrain receives BRISTLE_GRAIN (1.2, the paper-tooth scale), while the
    // footprint mask keeps receiving the stroke's brush grain.
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uGrain!, BRISTLE_GRAIN);')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uGrain, grain);')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uGrainThr, grainThr);')
    // No second declaration of the §6 number in the engine's bristle code.
    const binder = sliceBetween(ENGINE_SOURCE, 'private bindGather(', 'private bristleInk(')
    expectNotContains(binder, 'uGrain!, 1.2')
    // The gather's own comment records the distinction, never silent.
    expectContains(gather, 'never Brush.grain')
  })

  it('multiplies broken and landed into the ink weight in that order (§4.3 §5.4)', () => {
    expectContains(gather, 'float dryness = clamp((1.0 - load) * uStreak * 1.6, 0.0, 1.0);')
    expectContains(gather, 'float streak = noise1(uAlongPx / max(uStreakLen, 1.0) + state.z * 4096.0);')
    expectContains(gather, 'float broken = mix(1.0, smoothstep(0.3, 0.7, streak), dryness * uHairs);')
    expectContains(
      gather,
      'float landing = (0.04 + 0.7 * fract(state.z * 13.7) * fract(state.z * 13.7)) * uLanding;',
    )
    expectContains(
      gather,
      'float landed = smoothstep(landing, landing + 0.12, uStrokeDistPx / max(uHalfWidthPx, 1.0));',
    )
    expectContains(gather, 'float ink = profile * min(load * 1.5, 1.0) * touch * broken * landed;')
    const brokenAt = gather.indexOf('float broken =')
    const landedAt = gather.indexOf('float landed =')
    const inkAt = gather.indexOf('float ink =')
    expect(brokenAt, 'broken is computed before landed').toBeLessThan(landedAt)
    expect(landedAt, 'landed precedes the ink weight').toBeLessThan(inkAt)
  })

  it('biases the rim and mixes the wide/local body (§4.5 §5.5)', () => {
    expectContains(gather, 'wide += min(wState.x * 1.25, 1.0) * touchOf(wShape.y, uPressure);')
    expectContains(gather, 'float presence = min(profileSum / 0.5, 1.0);')
    expectContains(gather, 'float local = inkSum / max(profileSum, 0.5);')
    expectContains(gather, 'float body = mix(wide / 5.0 * presence, local, uHairs);')
    expectContains(gather, 'float dryEdge = mix(1.0, uDryEdge, smoothstep(0.3, 1.05, lateral));')
    // 2026-11-20: the along fade is pushed through the threshold so the end
    // breaks into paper-tooth specks (the artist's dry-end reference), and
    // the trailing rect is trimmed at the footprint (the pen end block).
    expectContains(gather, 'float coverage = body * (0.3 + 0.7 * uPressure) * dryEdge * alongFade * trailSupport;')
    expectContains(gather, 'float inked = uSoftness > 0.0')
    expectContains(gather, ': step(threshold, coverage);')
    expectContains(gather, 'g.coverage = inked * featherFade;')
  })

  it('binds every declared constant from bristles.ts — no literal survives', () => {
    const bindings: Array<[string, string]> = [
      ['uAlongPx', 'alongPx'],
      ['uStrokeDistPx', 'alongPx'],
      ['uHalfWidthPx', 'halfWidthPx'],
      ['uStreak', 'BRISTLE_STREAK'],
      ['uStreakLen', 'BRISTLE_STREAK_LENGTH'],
      ['uStreakShare', 'BRISTLE_STREAK_SHARE'],
      ['uRimContact', 'BRISTLE_RIM_CONTACT'],
      ['uHairs', 'BRISTLE_HAIRS'],
      ['uDryEdge', 'BRISTLE_DRY_EDGE'],
      ['uLanding', 'BRISTLE_LANDING'],
      ['uDrySpeed', 'clamp(this.params.dry, 0, 1)'],
      ['uDryCapFloor', 'BRISTLE_DRY_CAP_FLOOR'],
      ['uDryCapFull', 'BRISTLE_DRY_CAP_FULL'],
      ['uFeatherShift', 'BRISTLE_FEATHER_SHIFT'],
      ['uTakeoffShift', 'BRISTLE_TAKEOFF_SHIFT'],
    ]
    const binder = sliceBetween(ENGINE_SOURCE, 'private bindGather(', 'private bristleInk(')
    for (const [uniform, source] of bindings) {
      expectContains(gather, `uniform float ${uniform}`)
      expectContains(binder, `gl.uniform1f(p.u.${uniform}!, ${source});`)
    }
    // The carrier's two 64-21 spike literals now ride the declared constants.
    const pass = sliceBetween(ENGINE_SOURCE, 'private carrierPass(', 'private bindGather(')
    expectContains(pass, 'gl.uniform1f(p.u.uStreakLen!, BRISTLE_STREAK_LENGTH);')
    expectContains(pass, 'gl.uniform1f(p.u.uRimContact!, BRISTLE_RIM_CONTACT);')
    expectNotContains(pass, 'uStreakLen!, 18)')
    expectNotContains(pass, 'uRimContact!, 0.45)')
  })

  it('leaves the pressure path untouched (§5.2 out of scope)', () => {
    const bristleCode =
      sliceBetween(ENGINE_SOURCE, 'private carrierPass(', 'readBristles(): Uint16Array {') +
      gather
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uPressure!, clamp(pr, 0, 1));')
    expectContains(gather, 'uniform float uPressure;')
    // No new derivation: no speed read, no input-processing branch anywhere in
    // the bristle code — the pressure arrives as the existing uniform.
    expectNotContains(bristleCode, 'speed')
    expectNotContains(bristleCode, 'processInput')
  })

  it('keeps the pinned program and allocation counts', () => {
    const programs = sliceBetween(ENGINE_SOURCE, 'this.programs = {', '};')
    expect(
      (programs.match(/this\.g\.program\(/g) ?? []).length,
      'the traces add no program',
    ).toBe(23)
    const alloc = sliceBetween(ENGINE_SOURCE, 'private allocateTargets()', 'private allocateHistory()')
    expect(
      (alloc.match(/this\.\w+ = g\.(?:double|target)\(/g) ?? []).length,
      'fifteen allocations: the traces add no render target; 64-24 adds the documented R32F last-touch pair; 261119-pod adds the smear snapshot target',
    ).toBe(15)
  })
})

// ============================================================
//  64-24 — the §3.4 wetness gate and the touch refresh (D-24).
//
//  The carrier's wetness stops being the `wet * coverage` proxy and
//  becomes the timestamp law: `exp(−age / max(wetSeconds, 1)) · coverage`,
//  `age = max(now − lastTouch, 0)`, `now` from the engine's VIRTUAL clock —
//  never a wall clock. The proxy survives as mode 0, the recorded A/B
//  control 64-21 reserved `uWetMode` for. Each bristle dab then stamps its
//  own touch AFTER depositing and after its one coverage write, so a later
//  dab's carrier reads an honest age of the paint it crosses.
// ============================================================

describe('64-24 — the wetness gate and the touch refresh (D-24)', () => {
  // Resolved lazily: before GREEN the touch anchor does not exist, and a
  // collection-time slice would take the whole file's report down as a
  // fixture fault — each test must fail on its own assertion instead.
  const carrier = () =>
    sliceBetween(SHADERS_SOURCE, 'export const bristleCarrierFS', 'export const BRISTLE_GATHER')
  // 261125-kvl: the slice ends where the touch fragment ends. It used to run
  // to the paper section, which the stroke layer's shaders now sit between;
  // the pin is about THIS fragment (gather-free, one cheap draw), not about
  // its neighbours.
  const touch = () =>
    sliceBetween(
      SHADERS_SOURCE,
      'export const bristleTouchFS',
      'export const strokeLayerClearFS',
    )

  it('declares the timestamp gate on the carrier, with no wall clock in the bristle fragments', () => {
    const src = carrier()
    expectContains(src, 'uniform sampler2D uTimes;')
    expectContains(src, 'uniform float uNow;')
    expectContains(src, 'uniform float uWetSeconds;')
    expectContains(src, 'uniform int uWetMode;')
    // Mode 1 (shipped): §3.4's age law, read from the last-touch field and
    // gated by the PAINT's own COVERAGE — the reference's `canvas.a`
    // analogue. Corrected by 261119-pod: 4e6b974e1 gated on the scatter
    // channel instead, which is dead at the canonical Body 0 (measured 1080
    // sheet: cover max 0.500 / mean 0.184 against the scatter channel's max
    // 0.000), so `wet` was always 0 and Pickup had no effect at any value.
    // bristleCoverFS writes `cover` on every bristle dab, and
    // BRISTLE_BODY_ALPHA_FLOOR (0.5) keeps that write live at Body 0.
    expectContains(src, 'float age = max(uNow - texture(uTimes, uv).r, 0.0);')
    // 261119-pod FIX 1 — the §3.4 line. The read is normalised by the gate's
    // own Body-0 ceiling: raw cover tops at BRISTLE_BODY_ALPHA_FLOOR (0.500
    // measured max at Body 0), so the un-normalised term could only ever load
    // half the reference's canvas.a (~1.0) and the smear drag stalled at
    // 11.35 deg against the reference's 173.48 deg. The DISPLAY law is
    // unchanged — Body still owns opacity; only the READ gains the factor.
    // The literal 0.5 is forbidden: the ceiling travels as the uniform.
    expectContains(
      src,
      'return exp(-age / max(uWetSeconds, 1.0)) * clamp(texture(uCover, uv).x / uBodyFloor, 0.0, 1.0);',
    )
    expectNotContains(src, 'texture(uCover, uv).x / 0.5')
    // Mode 0 (the recorded A/B control): 64-21's proxy, unchanged.
    expectContains(src, 'return texture(uWet, uv).x * texture(uCover, uv).x;')
    expectContains(src, 'if (uWetMode == 1)')
    const touchSrc = touch()
    for (const fragment of [src, touchSrc]) {
      expectNotContains(fragment, 'Date.now(')
      expectNotContains(fragment, 'performance.now(')
      expectNotContains(fragment, 'Math.random(')
    }
  })

  it('declares ONE gather-free bristleTouchFS: the cover-weighted mix toward uNow', () => {
    const touchSrc = touch()
    expect(
      (SHADERS_SOURCE.match(/export const bristleTouchFS/g) ?? []).length,
      'one touch fragment',
    ).toBe(1)
    expectContains(touchSrc, '${HEADER}')
    expectContains(touchSrc, 'uniform sampler2D uTimes, uCover;')
    expectContains(touchSrc, 'uniform float uNow;')
    // 64-26 (IN-04): `uAmount` was declared and uploaded but never read.
    // 261119-pod measured that `cover * uAmount` (~0.01) leaves the one-week
    // sentinel at ~-48000 s after a whole stroke, so §3.4's exp(-age/7) was
    // always 0 and pickup was inert at every Body; the reference mixes the
    // last touch toward `now` by the dab's DEPOSIT weight, and the coverage
    // channel this pass samples is its accumulated analogue. The bare channel
    // IS the weight, so the dead uniform is removed — a declared-but-unread
    // uniform is a trap for the next reader.
    expectNotContains(touchSrc, 'uAmount')
    expectContains(touchSrc, 'float weight = clamp(texture(uCover, vUv).x, 0.0, 1.0);')
    expectContains(touchSrc, 'o0 = vec4(mix(texture(uTimes, vUv).r, uNow, weight));')
    // No gather: the coverage write is the weight, so the touch pass stays
    // one cheap document-sized draw over the dab rect (D-29's third pass).
    expectNotContains(touchSrc, 'BRISTLE_GATHER')
    expectNotContains(touchSrc, 'gatherBristle')
  })

  it('binds the gate from the last-touch read half and the virtual clock', () => {
    const pass = sliceBetween(ENGINE_SOURCE, 'private carrierPass(', 'private bindGather(')
    expectContains(pass, 'gl.uniform1i(p.u.uTimes!, g.bindTex(10, this.lastTouch.read.tex[0]!));')
    expectContains(pass, 'gl.uniform1f(p.u.uNow!, this.nowSec());')
    expectContains(pass, 'gl.uniform1f(p.u.uWetSeconds!, this.params.wetSeconds);')
    expectContains(pass, 'gl.uniform1i(p.u.uWetMode!, this.lastTouchMode);')
    // 261119-pod FIX 1: the carrier's normalised read needs the ceiling on
    // the same terms as the gather, bound from the one engine constant.
    expectContains(pass, 'gl.uniform1f(p.u.uBodyFloor!, BRISTLE_BODY_ALPHA_FLOOR);')
    // The mode is a compare-then-write A/B seam; the shipped default is the
    // timestamp law.
    expectContains(ENGINE_SOURCE, 'private lastTouchMode = 1;')
    expectContains(
      ENGINE_SOURCE,
      'if (mode !== this.lastTouchMode) this.lastTouchMode = mode === 0 ? 0 : 1;',
    )
    // Registered OUTSIDE the pinned literal, like every 64-21/22 program.
    expectContains(
      ENGINE_SOURCE,
      'this.programs.bristleTouch = this.g.program(S.bristleTouchFS);',
    )
  })

  it('stamps the touch into the write half, then swaps — after the deposit', () => {
    const stamp = sliceBetween(
      ENGINE_SOURCE,
      'private bristleTouch(',
      'readBristles(): Uint16Array {',
    )
    expectContains(stamp, 'gl.uniform1i(t.u.uTimes!, g.bindTex(0, this.lastTouch.read.tex[0]!));')
    expectContains(stamp, 'gl.uniform1i(t.u.uCover!, g.bindTex(1, this.cover.read.tex[0]!));')
    expectContains(stamp, 'gl.uniform1f(t.u.uNow!, this.nowSec());')
    // 64-26 (IN-04): the touch path declares, uploads and passes NO amount.
    expectNotContains(stamp, 'uAmount')
    expectContains(stamp, 'g.draw(this.lastTouch.write, rect);')
    expectContains(stamp, 'this.lastTouch.swap();')
    // 64-26 (CR-03): the previous dab's rect is carried read-to-write BEFORE
    // the stamp, so the scissored draw is the only change to the write half;
    // the dab's own rect is recorded after the swap as the next pending carry.
    expectContains(stamp, 'const carry = takeCarry(this.touchCarry);')
    expectContains(stamp, 'if (carry) g.blit(this.lastTouch.read.views[0]!, carry.x0, carry.y0, this.lastTouch.write.views[0]!, carry.x0, carry.y0, carry.x1 - carry.x0, carry.y1 - carry.y0);')
    expectContains(stamp, 'recordStamp(this.touchCarry, rect);')
    const carryAt = stamp.indexOf('takeCarry(this.touchCarry)')
    const bindAt = stamp.indexOf('t.bind();')
    const drawAt = stamp.indexOf('g.draw(this.lastTouch.write, rect);')
    const swapAt = stamp.indexOf('this.lastTouch.swap();')
    const recordAt = stamp.indexOf('recordStamp(this.touchCarry, rect);')
    expect(carryAt, 'the pending carry is taken').toBeGreaterThan(-1)
    expect(bindAt, 'the carry precedes the bind').toBeGreaterThan(carryAt)
    expect(drawAt, 'the write half is drawn').toBeGreaterThan(bindAt)
    expect(swapAt, 'the pair swaps after the write').toBeGreaterThan(drawAt)
    expect(recordAt, 'the stamp is recorded after the swap').toBeGreaterThan(swapAt)
    // The call site: deposit first, then touch, then anything else the dab does.
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    const depositAt = brush.indexOf('this.bristleInk(')
    const touchAt = brush.indexOf('this.bristleTouch(')
    const reliefAt = brush.indexOf('this.brushRelief(')
    expectContains(brush, 'if (bristle) this.bristleTouch(dx, dy, dr, angle);')
    expect(depositAt, 'the deposit runs inside eachDab').toBeGreaterThan(-1)
    expect(touchAt, 'the touch follows the deposit').toBeGreaterThan(depositAt)
    expect(reliefAt, 'the relief follows the touch').toBeGreaterThan(touchAt)
  })

  it('keeps the pinned program and allocation counts', () => {
    const programs = sliceBetween(ENGINE_SOURCE, 'this.programs = {', '};')
    expect(
      (programs.match(/this\.g\.program\(/g) ?? []).length,
      'the touch refresh registers outside the pinned literal',
    ).toBe(23)
    const alloc = sliceBetween(ENGINE_SOURCE, 'private allocateTargets()', 'private allocateHistory()')
    expect(
      (alloc.match(/this\.\w+ = g\.(?:double|target)\(/g) ?? []).length,
      'fifteen allocations: the gate adds no target — the last-touch pair landed in Task 1; 261119-pod adds the smear snapshot target',
    ).toBe(15)
  })
})

// ============================================================
//  261119-pod — the §3.3 smear, the per-dab snapshot and the
//  four-side Feather.
//
//  The reference's §3.3 drag (`carried = mix(carried, canvas, clamp(smear, 0, 0.8))`,
//  `smear = pickup · wet · hash21(vec2(nearest, floor(along / 6)))`) is ported in
//  COEFFICIENT space: a per-dab snapshot of the canvas (ink + fixed + cover),
//  a single `smearWeight` helper both gather consumers call, and a gate that
//  never samples the snapshot at Pickup 0. The gather gains its OWN `wetAt`
//  reading the snapshot's COVER alpha — the same pinned arithmetic shape the
//  carrier runs, so the two laws can never drift. Feather is a Studio-only
//  LATERAL fade after the threshold, thinning the carried coefficients, the
//  carried alpha and the coverage together — a coverage-only fade was erased
//  by the deposit lerp, and a radial one let each trailing dab re-write the
//  core. Feather 0 is exactly the shipped arithmetic.
// ============================================================

describe('261119-pod — the §3.3 smear, the snapshot and the four-side Feather', () => {
  // Spec 11: the gather law now lives inside the ONE generator (both variants);
  // the slice starts there, not at the exported constant lines.
  const gather = () =>
    sliceBetween(
      SHADERS_SOURCE,
      'export function bristleGatherSource(',
      'export const BRISTLE_GATHER = ',
    )
  const deposit = () =>
    sliceBetween(SHADERS_SOURCE, 'export const bristleDepositFS', 'export const bristleCoverFS')
  const cover = () =>
    sliceBetween(SHADERS_SOURCE, 'export const bristleCoverFS', 'export const bristleTouchFS')
  const snapshot = () =>
    sliceBetween(SHADERS_SOURCE, 'export const bristleCanvasFS', 'export const bristleCarrierFS')

  it('carries the §3.4 wetness shape on exactly TWO lines — the carrier and the gather', () => {
    const shape = SHADERS_SOURCE.match(/return exp\(-age \/ max\(uWetSeconds, 1\.0\)\) \*/g) ?? []
    expect(shape.length, 'one shape per gate, so the laws cannot drift').toBe(2)
    // The carrier's half gained FIX 1's normalisation on the same commit as
    // the gather's Lever 1 (261119-pod): both gates now divide their cover
    // term by the Body-0 ceiling, so the two reads carry one arithmetic.
    expectContains(
      SHADERS_SOURCE,
      'return exp(-age / max(uWetSeconds, 1.0)) * clamp(texture(uCover, uv).x / uBodyFloor, 0.0, 1.0);',
    )
    // 261119-pod Lever 1: the cover term is normalised by the Body-0 ceiling
    // (the uniform, never a literal) so the gate matches the reference's
    // canvas.a ~ 1 interior. The exp/age shape above is untouched.
    expectContains(
      SHADERS_SOURCE,
      'return exp(-age / max(uWetSeconds, 1.0)) * min(texture(uSnapB, uv).a / uBodyFloor, 1.0);',
    )
    expectNotContains(SHADERS_SOURCE, 'texture(uSnapB, uv).a / 0.5')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uBodyFloor!, BRISTLE_BODY_ALPHA_FLOOR);')
    expectContains(SHADERS_SOURCE, 'uniform float uBodyFloor;')
    const g = gather()
    expectContains(g, 'uniform sampler2D uSnapA;')
    expectContains(g, 'uniform sampler2D uSnapB;')
    expectContains(g, 'uniform sampler2D uTimes;')
    expectContains(g, 'uniform float uNow;')
    expectContains(g, 'uniform float uWetSeconds;')
    // Unconditional, one shipped law: `uWetMode` stays carrier-only.
    expectNotContains(g, 'uWetMode')
    // The §3.4 revert's deleted helper never returns — verified by the
    // shell gate over the whole file (this test file carries no such token).
  })

  it('copy the snapshot into two attachments: coefficients and the COVER alpha', () => {
    expect(
      (SHADERS_SOURCE.match(/export const bristleCanvasFS/g) ?? []).length,
      'one snapshot fragment',
    ).toBe(1)
    const s = snapshot()
    expectContains(s, 'uniform sampler2D uInkA, uInkB, uFixedA, uFixedB, uCover;')
    expectContains(s, 'oA = texture(uInkA, vUv) + texture(uFixedA, vUv);')
    expectContains(s, 'oB = vec4(b, texture(uCover, vUv).x);')
    expectContains(s, 'vec3 b = (texture(uInkB, vUv) + texture(uFixedB, vUv)).rgb;')
    // No gather, no clock: the copy is one cheap document-sized pass.
    expectNotContains(s, 'gatherBristle')
    expectNotContains(s, 'uNow')
  })

  it('computes ONE smearWeight from hash21(nearest, floor(alongPx / period))', () => {
    expect((SHADERS_SOURCE.match(/float smearWeight\(/g) ?? []).length, 'one smear helper').toBe(1)
    const g = gather()
    expectContains(g, 'float smearWeight(int nearest, float alongPx, float wet){')
    // 261126 (edge-leg): the hash arm is the shipped sheet law, kept verbatim
    // (uSmearSmooth defaults to 0 there). The layer programs turn on the
    // mean-preserving arm — the layer re-reads the same untouched sheet every
    // dab, so the hash froze into the accumulated film as a mosaic.
    // 2026-11-26 (the artist's big-brush smoothing): the sheet also blends
    // onto the mean above canonical Size 200 px (uSmearSmoothBig) — the 6-px
    // hash cells read as pixelation on big brushes.
    expectContains(g, 'float raw = clamp(k * hash21(vec2(float(nearest), floor(alongPx / uSmearPeriodPx))), 0.0, uSmearCap);')
    expectContains(g, 'return mix(raw, smoothSmearMean(k, uSmearCap), max(uSmearSmooth, uSmearSmoothBig));')
    expectContains(g, 'float k = uSmear * wet;')
    // The smooth arm is the hash's own mean E[min(k·h, cap)] for h uniform:
    // k/2 below the cap, cap − cap²/(2k) above — the tuned mean drag is
    // preserved, only the variance collapses.
    expectContains(g, 'if (k <= cap) return k * 0.5;')
    expectContains(g, 'return cap - (cap * cap) / (2.0 * k);')
    expectContains(g, 'uniform float uSmear;')
    expectContains(g, 'uniform float uSmearPeriodPx;')
    expectContains(g, 'uniform float uSmearCap;')
    expectContains(g, 'uniform float uSmearSmooth;')
    // 2026-11-26 (the artist's big-brush smoothing): the canonical-Size blend
    // onto the smooth arm, bound from the Size the artist reads.
    expectContains(g, 'uniform float uSmearSmoothBig;')
  })

  it('smooths the smear on the STROKE LAYER, and on the sheet above Size 200', () => {
    // Default 0 in the shared bind: at or below Size 200 px every sheet-path
    // program keeps the shipped hash verbatim.
    expect(ENGINE_SOURCE).toMatch(/gl\.uniform1f\(p\.u\.uSmearSmooth!, 0\)/)
    // ...and the big-brush blend rides its own uniforms, still 0 at <=200 px.
    expect(ENGINE_SOURCE).toMatch(/gl\.uniform1f\(p\.u\.uSmearSmoothBig!, bigBrush\);/)
    expect(ENGINE_SOURCE).toMatch(/gl\.uniform1f\(p\.u\.uCapBlurBig!, bigBrush\);/)
    const layer = sliceBetween(ENGINE_SOURCE, 'private bristleLayerInk(', 'private touch(')
    // The layer's two gather consumers turn the full-smooth arm on after the bind.
    expect(layer.match(/gl\.uniform1f\([dc]\.u\.uSmearSmooth!, 1\)/g) ?? []).toHaveLength(2)
  })

  it('reads the LAYER OWN film plus the under at its own transmittance as the smear reference', () => {
    // 261126 (edge-leg, Law 2): the sheet path's snapshot is its own
    // accumulated film PLUS the under it has not yet replaced — every dab
    // attenuates the settled pool (fixed <- fixed * (1 - a)), so the under's
    // share decays with the stroke's own opacity. The layer's reference is
    // the exact analogue: its own previous film, averaged over a ~3 px
    // optical kernel, plus the under weighted by the layer's transmittance
    // (the layerFilm cover attachment, the same weight the stroke-end merge
    // applies to the sheet), amplified to cover_L^1.5 so the partial-cover
    // fringe's smoothed film keeps the under's pigment (2026-11-26: the
    // linear weight left a milky tip apron; measured at 2048 the 1.5
    // exponent cuts the veil texels 3.6 % with 5.4 % more over-darkened
    // texels, gamma 2: 6.0 % / 8.8 %, body share 0.429 -> 0.430; the artist
    // approved live). No presence threshold, no
    // division, no normalization. Measured 2048 tip fringe (the sheet
    // control in parentheses): darkness 0.70 (0.69), the 46.87/255 ring at
    // 0; the constant additive under (the SUM) saturated the body to share
    // 1.0 and is pinned OUT below.
    const g = gather()
    expectContains(g, 'uniform sampler2D uPrevA;')
    expectContains(g, 'uniform sampler2D uPrevB;')
    expectContains(g, 'uniform sampler2D uPrevCover;')
    const d = deposit()
    expectContains(d, 'if (uSmearSmooth > 0.5) {')
    expectContains(d, 'vec2 po = vec2(1.5) / uSheet;')
    expectContains(d, 'vec4 prevA = 0.2 * (texture(uPrevA, vUv)')
    expectContains(d, 'vec4 prevB = 0.2 * (texture(uPrevB, vUv)')
    expectContains(d, 'float covL = clamp(texture(uPrevCover, vUv).r, 0.0, 1.0);')
    expectContains(d, 'float underW = 1.0 - covL * sqrt(covL);')
    expectContains(d, 'snapA = snapA * underW + prevA;')
    expectContains(d, 'snapB = vec4(snapB.xyz * underW + prevB.xyz, snapB.a);')
    // The retired presence gate must never come back, and the under is never
    // added at full strength: both saturated the body (the SUM read share
    // 1.0, near-black blue, at 2048).
    expectNotContains(d, 'prevW = smoothstep(1e-6, 1e-3, prev2)')
    expectNotContains(d, 'snapA = snapA + prevA;')
    // The cover alpha stays the SHEET's: the solid/wet gate asks whether the
    // paint the dab CROSSES is wet, never whether the layer has landed.
    expectContains(d, 'smear *= smoothstep(0.55, 0.85, clamp(snapB.a / uBodyFloor, 0.0, 1.0));')
    // The Engine binds the layer's read half and its cover on free units and
    // swaps the pair with the carry induction (pinned behaviourally in
    // lastTouch.test). The shared bind defaults them for the sheet path.
    const layer = sliceBetween(ENGINE_SOURCE, 'private bristleLayerInk(', 'private touch(')
    expectContains(layer, 'gl.uniform1i(d.u.uPrevA!, g.bindTex(8, layerInk.tex[0]!));')
    expectContains(layer, 'gl.uniform1i(d.u.uPrevB!, g.bindTex(9, layerInk.tex[1]!));')
    expectContains(layer, 'gl.uniform1i(d.u.uPrevCover!, g.bindTex(10, this.layerFilm!.tex[0]!));')
    expectContains(layer, 'this.layerInk!.swap();')
    // bindGather's default keeps every other gather consumer's sampler set
    // complete (the sheet path never samples it: uSmearSmooth 0).
    expect(ENGINE_SOURCE).toMatch(/gl\.uniform1i\(p\.u\.uPrevCover!, g\.bindTex\(10, this\.smearCanvas\.tex\[0\]!\)\)/)
  })

  it('keeps the sheet cover smear OFF the stroke layer', () => {
    // 261126 (edge-leg, Law 2): dragging cover_L toward the sheet's cover
    // pulled it down to the under's ~0.8 every dab and let the under show
    // through the stroke's core; the layer's cover is its deposit weight.
    // The sheet program keeps the arm verbatim.
    const layerCover = sliceBetween(SHADERS_SOURCE, 'export const bristleCoverLayerFS', 'export const strokeLayerMergeFS')
    expectContains(layerCover, 'if (uSmear > 0.0 && uSmearSmooth < 0.5) {')
    expectContains(layerCover, 'float target = a * uCoverTarget * g.alpha;')
    const sheetCover = sliceBetween(SHADERS_SOURCE, 'export const bristleCoverFS', 'export const bristleTouchFS')
    expectContains(sheetCover, 'if (uSmear > 0.0) {')
  })

  it('mixes the deposit and the cover target through the SAME helper, inside the guard', () => {
    const d = deposit()
    expectContains(d, 'if (uSmear > 0.0) {')
    expectContains(d, 'float smear = smearWeight(g.nearest, uAlongPx + q.y * uHalfWidthPx, wetAt(vUv));')
    expectContains(d, 'vec4 cA = g.cA;')
    expectContains(d, 'vec3 cB = g.cB;')
    // 2026-11-20 (the artist's yellow-on-white report): lift ONLY solid
    // paint — a partial or blank snapshot is a thin film whose
    // coverage-attenuated absorbance, lifted raw, reads as diluted pigment
    // and rotates the hue (yellow -> green). The gate uses the same
    // cover/floor normalization wetAt does.
    expectContains(d, 'vec4 snapB = texture(uSnapB, vUv);')
    expectContains(d, 'smear *= smoothstep(0.55, 0.85, clamp(snapB.a / uBodyFloor, 0.0, 1.0));')
    // 2026-11-20 (the artist's colour-blend regression): lift is decided by
    // COLOUR, never by AGE. The touch pass stamps uNow over the whole dab, so
    // a continuous stroke always sits on its own fresh stamps — a stroke-age
    // gate zeroed every live pickup ("no more color blend") and must not
    // return. The same-colour gate below owns the own-paint case.
    expectNotContains(SHADERS_SOURCE, 'uStrokeStart')
    // Same-paint is never re-deposited (an older stroke of the SAME yellow
    // turned green through the Body KM display), but the comparison is the
    // BRUSH'S PALETTE, not the carried mix: the mix drifts toward the canvas
    // as it drags, and a carried-side gate shut the drag off partway (the
    // artist's "not totally"). Different paint lifts at full strength.
    expectContains(d, 'float samePaint = cross7 / sqrt(max(own2 * can2, 1e-8));')
    expectContains(d, 'smear *= 1.0 - smoothstep(0.975, 0.995, samePaint);')
    const g = gather()
    expectContains(g, 'uniform vec4 uPigmentA;')
    expectContains(g, 'uniform vec3 uPigmentB;')
    expectContains(d, 'cA = mix(cA, snapA, smear);')
    expectContains(d, 'cB = mix(cB, snapB.xyz, smear);')
    expectContains(d, 'oA = cA * a;')
    expectContains(d, 'oB = vec4(cB * a, uScatter * a);')
    const c = cover()
    expectContains(c, 'if (uSmear > 0.0) {')
    expectContains(c, 'float target = a * uCoverTarget * g.alpha;')
    // The cover drag obeys the SAME same-paint gate as the ink smear: own
    // paint's cover re-deposited is the artist's "darker" half of the
    // yellow-on-white report (measured at Pickup 100 with the response curve).
    expectContains(c, 'smear *= 1.0 - smoothstep(0.975, 0.995, samePaint);')
    expectContains(c, 'target = mix(target, a * uCoverTarget * snapB.a, smear);')
    expectContains(c, 'o0 = vec4(target, 0.0, 0.0, a);')
    // Both mixes sit AFTER the guard's anchor: Pickup 0 never samples the
    // snapshot, and the weight is exactly zero there too (belt and braces).
    for (const src of [d, c]) {
      const guardAt = src.indexOf('if (uSmear > 0.0) {')
      const weightAt = src.indexOf('smearWeight(')
      expect(guardAt, 'the guard exists').toBeGreaterThan(-1)
      expect(weightAt, 'the weight is inside the guard').toBeGreaterThan(guardAt)
    }
    // One snapshot read per consumer: the law is never re-typed.
    expect((d.match(/texture\(uSnapA, vUv\)/g) ?? []).length).toBe(1)
    expect((d.match(/texture\(uSnapB, vUv\)/g) ?? []).length).toBe(1)
  })

  it('feathers by THINNING the carried film at the lateral rim — never by widening the band', () => {
    const g = gather()
    // The band is the reference's constant; Feather owns the edge law.
    expectContains(g, 'uniform float uSoftness;')
    expectContains(g, 'uniform float uFeather;')
    expectContains(g, 'uniform float uFeatherReach;')
    expectContains(g, 'uniform float uFeatherEdge;')
    expectContains(g, 'uniform float uFeatherCap;')
    expectContains(g, 'uniform float uFeatherMin;')
    // The analytic silhouette is anchored at the visible half-width
    // (BRISTLE_FEATHER_EDGE), never the full nominal footprint: Feather must
    // not resize the brush. F0 is a crisp edge (edge - 0.04); F1 opens the
    // fade over uFeatherReach of the silhouette.
    // 2026-11-20 white-seam ruling: F0 applies NONE of the analytic fade.
    // The rim is the thresholded bristle coverage (ragged paint); the fade
    // opens scaled by uFeather from there, so the two laws cannot fight.
    expectContains(
      g,
      'float featherStart = uFeatherEdge * (1.0 - mix(uFeatherMin, uFeatherReach, uFeather));',
    )
    // 2026-11-22 (UAT row 3 and after): the feather IS a threshold shift. The
    // film carries NO depth fade — every depth selector tried wrote a pale
    // lane or a band motif (across noise 7.54 % / 231 px enclosed; 2-D cell
    // 11.66 % / 205 px; along-only 0.60 % but an 18-doc-px tiled motif, the
    // artist-rejected row 3; per-dab seed 2.20 % residual with the control
    // nearly dead; monotone tip ramp line/tiling-clean but at full fringe
    // depth, the control dead). A depth fade gives the texel a small deposit
    // weight a, and the dab lerp `ink <- ink*(1-a) + carried*a` then holds the
    // old film for ~100 px of travel. Raising the threshold removes paint
    // where the tooth is low: the fringe breaks into full-depth specks over
    // paper (measured ENCLOSED 0.22 % / 9 px and 0.01 % / 4 px; fringe-row
    // coherence 0.094 / 4 % and 0.064 / 0 %, at the feather-pin's floor).
    // Spec 11 (feather falloff): the shipped smoothstep IS the neutral branch
    // — falloff 50 skips pow (pow(x, 1.0) is not guaranteed exact), so the
    // shipped bytes survive; every other bias shapes the same ramp with the
    // shipped 2^(2b-1) exponent. No second exponent map.
    expectContains(g, 'float featherShift = uFeather * uFeatherShift * smoothstep(featherStart, uFeatherEdge, lateral);')
    expectContains(g, 'uFeatherFalloff != 0.5')
    expectContains(g, 'float featherFade = 1.0;')
    // 2026-11-23 (the acrylic end-block): the stroke's TAKEOFF. The end of a
    // stroke is its last RUNNING dab's leading frontier — every earlier
    // frontier is repainted by the dabs ahead. The along cap can only fade
    // DEPTH, and the dab lerp holds committed film, so the frontier is opened
    // through this SAME threshold instead: an inked cell keeps the full
    // carried paint and an open cell discards, the way the Feather specks do.
    // Measured on the bristle-end probe (s100, acrylic record): the stopped
    // end was a wall at x = 1015 on every row, flat over 83 % of the width;
    // the takeoff grades every end path into tooth specks — stop 21.9 % flat /
    // 12 px longest same-x run, mouse 25.3 % / 34 px, decay 20.1 % / 17 px,
    // mouse-lift 10.4 % / 6 px, bake 23.7 % / 15 px — while the approved pen
    // lift stays at 1.8 %. Leading-only (q.y < 0), pressure-scaled by the SAME
    // factor the coverage carries, so a mouse's saturated stop opens the
    // frontier like a pen's lift; the magnitude is BRISTLE_TAKEOFF_SHIFT.
    expectContains(g, 'float takeoff = smoothstep(0.45, 1.05, -q.y);')
    expectContains(g, 'threshold += takeoff * (0.3 + 0.7 * uPressure) * uTakeoffShift;')
    // A threshold shift, never a depth multiplier: a deposit-level fade
    // freezes committed film into a lane (the pale-line lesson above).
    expectNotContains(g, 'g.cA *= takeoff')
    expectNotContains(g, 'g.cB *= takeoff')
    expectNotContains(g, 'g.alpha *= takeoff')
    expectNotContains(g, 'coverage * takeoff')
    // The cap's stagger still reads the streak noise (slow along it); the
    // across · hairFreq term survives ONLY for that cap.
    expectContains(g, 'float hairFreq = clamp(uHalfWidthPx / 5.0, 6.0, 40.0);')
    expectContains(g, 'float fadeStreak = noise1(across * hairFreq + uAlongPx / max(uStreakLen * 5.0, 1.0) + 11.3);')
    expectNotContains(g, 'float lateralFade')
    expectNotContains(g, 'float raggedFade')
    expectNotContains(g, 'float fadeAlong')
    // The front cap is LEADING-only (q.y < 0): an interior texel's last dab
    // sits at its trailing rim, so a symmetric along fade would erase the core.
    // 2026-11-20: the cap no longer mixes toward uFeatherReach (that inverted
    // the control — F100 got the shortest end taper); it carries the gain at
    // every Feather, and Dry (the artist's re-range) owns its WIDTH: short at
    // Dry 0, full from BRISTLE_DRY_CAP_FULL, the acrylic default.
    expectContains(g, 'float dryCap = mix(uDryCapFloor, 1.0, smoothstep(0.0, uDryCapFull, uDrySpeed));')
    expectContains(g, 'float capW = clamp(uFeatherCap * uCapGain * dryCap, 0.0, 0.85);')
    // 2026-11-20 (artist's box-at-release): the stroke's first dab fades its
    // trailing half too while the stroke is inside its first half-width.
    // 2026-11-20 (the artist's pen end block): a catch-up dab has no NEXT
    // dab to cover its trailing half, so uEndCap makes its cap symmetric —
    // the final impression dissolves into specks instead of re-inking the
    // whole footprint.
    // 2026-11-22 (the residual pale lane): "running dabs stay leading-only"
    // was the 11-20 assumption, but a running dab's leading half is repainted
    // by the dabs ahead and its cap is not harmless: hairEnd's stagger reads
    // fadeStreak, whose across · hairFreq term is the LATERAL fringe's
    // canvas-stationary texture, so the running cap wrote an across texture
    // into the deposit's saturation level (probe: pinning the caps collapsed
    // the band's across depth 5.5 % -> 0.6 %). The cap now exists only where
    // it is visible: the stroke's start (exposedTrail > 0) and the catch-up
    // end (uEndCap = 1 -> exposedTrail = 1). Interior dabs carry no cap.
    expectContains(g, 'uniform float uEndCap;')
    expectContains(g, 'float exposedTrail = max(')
    expectContains(g, '1.0 - smoothstep(0.0, 1.0, uStrokeDistPx / max(uHalfWidthPx, 1.0)),')
    expectContains(g, 'uEndCap);')
    expectContains(g, 'float along = exposedTrail > 0.0')
    expectContains(g, '? mix(max(-q.y, 0.0), abs(q.y), exposedTrail)')
    expectContains(g, ': 0.0;')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uEndCap!, endCap ? 1 : 0);')
    expectContains(ENGINE_SOURCE, 'this.bristleEndCap = true;')
    // 2026-11-26 (the artist's pale cap band): a mid-stroke PAUSE catches up
    // at FULL weight — the end cap belongs to the real end only, or every
    // hesitation leaves a faded band across the resumed stroke (pronounced
    // on big brushes and on the stroke layer). The end still stamps its cap
    // even when a rest catch-up already caught the curve up (a moved stroke).
    expectContains(ENGINE_SOURCE, 'if (s.started && !s.ending && !s.moved && !caughtUp) {')
    expectContains(ENGINE_SOURCE, 'if (s.started && s.ending && (!caughtUp || (bristleStroke && s.moved))) {')
    expectContains(ENGINE_SOURCE, 'this.bristleInk(dx, dy, dr, angle, bristleBodyAlpha, contactPr, c1[3]!, alongPx, this.bristleEndCap);')
    // The end report: one smooth along profile reads as a knife cut, so the
    // hairs LIFT OFF at staggered points inside the cap band (mirroring the
    // landing ramp). The per-hair mask must never restore paint past the
    // radius — that ran whole hairs to the deposit rect (end-block crop).
    // 2026-11-26 (the artist's big-brush smoothing): the cap alpha blends to
    // a smooth ramp above Size 200 px; at 0 the terms reduce to the shipped
    // stagger exactly (capStreak = fadeStreak, capEdge = capW * 0.4).
    expectContains(g, 'float capStreak = mix(fadeStreak, 0.5, uCapBlurBig);')
    expectContains(g, 'float capEdge = capW * mix(0.4, 1.0, uCapBlurBig);')
    expectContains(g, 'float hairEnd = 1.0 - (1.0 - capStreak) * capW * 0.6;')
    expectContains(g, 'float alongFade = 1.0 - smoothstep(hairEnd - capEdge, hairEnd, along);')
    // 2026-11-20 (the artist's pen end block): the trailing half has no fade
    // (the next dab covers it), but the trailing RECTANGLE outside the
    // footprint was painted at full weight — a stroke that stopped there
    // re-inked a solid block behind its last dab. The dab's support must end
    // at its own tip; interior texels sit at q.y <= one spacing, untouched.
    expectContains(g, 'float trailSupport = 1.0 - smoothstep(0.95, 1.2, q.y);')
    expectContains(g, 'float coverage = body * (0.3 + 0.7 * uPressure) * dryEdge * alongFade * trailSupport;')
    // 2026-11-26 (the artist's dark end block): the trailing trim gates the
    // coverage THRESHOLD only; the carried film keeps full weight, or the
    // running body reads lighter than the terminal band.
    expectContains(g, 'featherFade *= alongFade;')
    // F0 calms the paper tooth at the rim so the edge follows the smooth
    // bristle profile; it must never FABRICATE paint there (the old max() skin
    // left a 1 px line along the silhouette wherever the brush was dry).
    expectContains(g, 'float rimCalm = (1.0 - uFeather) * smoothstep(0.45, 0.75, lateral);')
    expectContains(g, 'float height = mix(grainHeight(css, uAxis), 0.5, rimCalm);')
    expectNotContains(g, 'max(inked, skin)')
    // The fade must reach every value the deposit carries: a coverage-only
    // multiply is erased by the dab-over-dab lerp (measured: F0/F100 differed
    // only by display blur).
    // 2026-11-26 (the artist's pale cap band — "the cap that was never
    // fixed"): on the END impression the film keeps its full weight; the end
    // breaks up through the coverage THRESHOLD only, so a pressure release
    // that ended a sweep leaves no pale alpha stripe under the next stroke.
    // The START cap keeps the shipped film fade (repainted by the dabs ahead).
    expectContains(g, 'float filmFade = mix(featherFade, 1.0, uEndCap);')
    expectContains(g, 'g.cA *= filmFade;')
    expectContains(g, 'g.cB *= filmFade;')
    expectContains(g, 'g.alpha *= filmFade;')
    expectContains(g, 'float inked = uSoftness > 0.0')
    expectContains(g, ': step(threshold, coverage);')
    expectContains(g, 'g.coverage = inked * featherFade;')
    // Load is the tank ONLY: scaling the pigment with it desaturated the low
    // values (artist: "il y a une perte de couleur sur le LOAD 0, 33, 66").
    expectNotContains(g, 'uLoadGain')
    expectNotContains(ENGINE_SOURCE, 'uLoadGain')
    expectContains(ENGINE_SOURCE, '? 0.3 + 1.4 * loadParam')
    expectContains(ENGINE_SOURCE, ': 1.0 + 6.0 * Math.pow((loadParam - 0.5) / 0.5, 3);')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uSoftness!, gatherSoftness(this.params.feather));')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uFeather!, clamp(this.params.feather, 0, 1));')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uFeatherReach!, BRISTLE_FEATHER_REACH);')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uFeatherEdge!, BRISTLE_FEATHER_EDGE);')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uFeatherCap!, BRISTLE_FEATHER_CAP);')
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uFeatherMin!, BRISTLE_FEATHER_MIN);')
    // The blur is display polish, independent of Feather.
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uFilmBlur, this.bristleContent ? BRISTLE_FILM_BLUR : 0);')
    // The two mechanisms the artist rejected must never come back.
    expectNotContains(g, 'featherFall(')
    expectNotContains(ENGINE_SOURCE, 'BRISTLE_FEATHER_GROW')
    expectNotContains(ENGINE_SOURCE, 'uFeatherBand')
  })

  it('registers the snapshot program OUTSIDE the pinned literal and allocates one pair', () => {
    expectContains(ENGINE_SOURCE, 'this.programs.bristleCanvas = this.g.program(S.bristleCanvasFS);')
    const literal = sliceBetween(ENGINE_SOURCE, 'this.programs = {', '};')
    expect(
      (literal.match(/this\.g\.program\(/g) ?? []).length,
      'twenty-three programs: the snapshot registers outside the literal',
    ).toBe(23)
    const alloc = sliceBetween(ENGINE_SOURCE, 'private allocateTargets()', 'private allocateHistory()')
    expectContains(
      alloc,
      'this.smearCanvas = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.NEAREST);',
    )
    const targets = sliceBetween(ENGINE_SOURCE, 'private docTargets(): Target[] {', '\n  }')
    expectContains(targets, 'this.bristleShape, this.smearCanvas, this.relief,')
  })

  it('takes the snapshot after touch(rect), before the first deposit draw, only at Pickup > 0', () => {
    const ink = sliceBetween(ENGINE_SOURCE, 'private bristleInk(', 'private bristleSnapshot(')
    const touchAt = ink.indexOf('this.touch(rect);')
    const snapAt = ink.indexOf('if (this.params.pickup > 0) this.bristleSnapshot(rect);')
    const depositAt = ink.indexOf('g.draw(this.ink.read, rect);')
    expect(touchAt, 'the rect bookkeeping runs first').toBeGreaterThan(-1)
    expect(snapAt, 'the snapshot is taken').toBeGreaterThan(touchAt)
    expect(depositAt, 'the first deposit draw follows the snapshot').toBeGreaterThan(snapAt)
    const snap = sliceBetween(ENGINE_SOURCE, 'private bristleSnapshot(', 'private bristleTouch(')
    expectContains(snap, 'g.bindTex(0, this.ink.read.tex[0]!)')
    expectContains(snap, 'g.bindTex(1, this.ink.read.tex[1]!)')
    expectContains(snap, 'g.bindTex(2, this.fixed.tex[0]!)')
    expectContains(snap, 'g.bindTex(3, this.fixed.tex[1]!)')
    expectContains(snap, 'g.bindTex(4, this.cover.read.tex[0]!)')
    expectContains(snap, 'g.draw(this.smearCanvas, rect);')
  })

  it('binds the snapshot on units 5/6, the last-touch read on 7, and the smear uniforms', () => {
    const bind = sliceBetween(ENGINE_SOURCE, 'private bindGather(', 'private bristleInk(')
    expectContains(bind, 'gl.uniform1i(p.u.uSnapA!, g.bindTex(5, this.smearCanvas.tex[0]!));')
    expectContains(bind, 'gl.uniform1i(p.u.uSnapB!, g.bindTex(6, this.smearCanvas.tex[1]!));')
    expectContains(bind, 'gl.uniform1i(p.u.uTimes!, g.bindTex(7, this.lastTouch.read.tex[0]!));')
    expectContains(bind, 'gl.uniform1f(p.u.uSmear!, this.pickupResponse(this.params.pickup));')
    expectContains(bind, 'gl.uniform1f(p.u.uSmearPeriodPx!, BRISTLE_SMEAR_PERIOD_PX);')
    expectContains(bind, 'gl.uniform1f(p.u.uSmearCap!, BRISTLE_SMEAR_CAP);')
    expectContains(bind, 'gl.uniform1f(p.u.uNow!, this.nowSec());')
    expectContains(bind, 'gl.uniform1f(p.u.uWetSeconds!, this.params.wetSeconds);')
    // The gather has one wetness law: no A/B mode rides it.
    expectNotContains(bind, 'uWetMode')
  })

  // 261119-pod — Feather is the reference's SOFTNESS only: no #ifdef region
  // and no ramp injector. Spec 11's law is a SECOND source built by the SAME
  // generator and selected at program level (neutral by default, law lazily),
  // never a compile-time variant of the shipped (neutral) program.
  it('feeds every gather program from ONE generator — no ramp injector', () => {
    expectContains(SHADERS_SOURCE, 'export const BRISTLE_GATHER')
    expectNotContains(SHADERS_SOURCE, '#ifdef BRISTLE_FEATHER_RAMP')
    expectNotContains(SHADERS_SOURCE, '#define BRISTLE_FEATHER_RAMP')
    expectNotContains(SHADERS_SOURCE, 'withFeatherRamp')
    expectNotContains(ENGINE_SOURCE, 'bristleFeatherVariant')
    expectNotContains(ENGINE_SOURCE, 'bristleDepositRamp')
    expectNotContains(ENGINE_SOURCE, 'bristleCoverRamp')
    // The neutral deposit and cover programs are registered once, outside the
    // pinned literal (which stays twenty-three), and selected by the helper.
    const literal = sliceBetween(ENGINE_SOURCE, 'this.programs = {', '};')
    expect(
      (literal.match(/this\.g\.program\(/g) ?? []).length,
      'twenty-three in the pinned literal',
    ).toBe(23)
    const ink = sliceBetween(ENGINE_SOURCE, 'private bristleInk(', 'private bristleSnapshot(')
    expectContains(ink, "const d = this.gatherProgram('bristleDeposit');")
    expectContains(ink, "const c = this.gatherProgram('bristleCover');")
    expectContains(ink, 'd.bind();')
    expectContains(ink, 'c.bind();')
  })

  // FIX 2c — the display's edge-darkening crispener (uEdgeDarken = 0.8, up to
  // 1.8× density at any gradient) turns a bristle rim into a dark 1-px
  // outline and pinned the fade gauge's core to the boundary. It is gated to
  // NON-bristle content only: the eight identity baselines are all
  // non-bristle, so they keep exactly 0.8 and stay byte-identical.
  it('gates the edge-darkening display law off for bristle content (FIX 2c)', () => {
    expectContains(ENGINE_SOURCE, 'private bristleContent = false;')
    expectContains(
      ENGINE_SOURCE,
      'gl.uniform1f(p.u.uEdgeDarken, this.bristleContent ? 0 : 0.8);',
    )
    const begin = sliceBetween(ENGINE_SOURCE, 'private beginBristles(', 'const halfWidthPx')
    expectContains(begin, 'this.bristleContent = true;')
    // A wiped sheet drops the flag on BOTH wipe paths (clear and resetSheet).
    expect(
      (ENGINE_SOURCE.match(/this\.bristleContent = false;/g) ?? []).length,
      'clear() and resetSheet() both reset',
    ).toBe(2)
  })
})

// ============================================================
//  The §4.2 value jitter is a REFLECTANCE multiply (2026-11-22, the acrylic
//  pale-line debug). The reference scales `brush.rgb` in linear light, so in
//  the absorbance basis the faithful image is a FLAT band offset
//  `u = -ln(jitter)` through the basis's level coefficients — never a raw
//  multiply of the absorbance coefficients (which scales the spectral shape
//  and, sign inverted, laid a continuous pale lane along every bristle film).
//  The behavioural rows below pin the law itself; the source rows pin both
//  application sites and forbid the retired raw multiply.
// ============================================================
describe('§4.2 value jitter — the flat absorbance offset, never a coefficient scale', () => {
  const pigment = pigmentFromHex('#2b6fd0')
  const VJ = 0.8
  const U = -Math.log(VJ)
  const bandAbs = (coeffs: ArrayLike<number>): number[] =>
    DISPLAY_BANDS.map((band) => {
      let a = 0
      for (let k = 0; k < COEFFS; k += 1) a += coeffs[k]! * BASIS[k]![band]!
      return a
    })
  const lifted = Array.from(pigment.coeffs, (c, k) => c + U * LEVEL_COEFFS[k]!)

  it('adds -ln(vj) to EVERY display band within the basis residual, so the display scales by vj', () => {
    const base = bandAbs(pigment.coeffs)
    const shifts = bandAbs(lifted).map((a, i) => a - base[i]!)
    // Flat: every band moves by the same amount (the basis residual is the
    // documented max 0.0353 per band, so the shift deviates from U by u·residual).
    expect(Math.max(...shifts) - Math.min(...shifts)).toBeLessThan(0.08)
    for (const shift of shifts) expect(Math.abs(shift - U)).toBeLessThan(0.04)
    const linBase = coeffsToLinear(pigment.coeffs)
    const linLifted = coeffsToLinear(lifted)
    for (let j = 0; j < 3; j += 1) {
      expect(Math.abs(linLifted[j]! / linBase[j]! - VJ), 'reflectance scales by vj').toBeLessThan(0.05)
    }
  })

  it('is NOT a coefficient scale: scaling the coefficients shifts bands unequally', () => {
    const raw = Array.from(pigment.coeffs, (c) => c * VJ)
    const base = bandAbs(pigment.coeffs)
    const shifts = bandAbs(raw).map((a, i) => a - base[i]!)
    expect(Math.max(...shifts) - Math.min(...shifts)).toBeGreaterThan(0.15)
  })

  it('applies the log offset at both sites and nowhere the retired raw multiply', () => {
    expectContains(SPECTRAL_SOURCE, 'export const LEVEL_COEFFS')
    expectContains(ENGINE_SOURCE, 'const level = -Math.log(vj);')
    expectContains(ENGINE_SOURCE, 'pig[0]! + level * LEVEL_COEFFS[0]!')
    expectNotContains(ENGINE_SOURCE, 'pig[0]! * vj')
    expectContains(SHADERS_SOURCE, 'float level = -log(state.w);')
    expectContains(SHADERS_SOURCE, 'uPigmentA + uLevelA * level')
    expectNotContains(SHADERS_SOURCE, 'uPigmentA * state.w')
  })
})
