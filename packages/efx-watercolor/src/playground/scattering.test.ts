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
    const display = SHADERS_SOURCE.slice(SHADERS_SOURCE.indexOf('export const displayFS'))
    expect(display.length, 'displayFS is present').toBeGreaterThan(0)
    // SPIKE 001 reintroduces a `cov` variable for the coverage CHANNEL (the
    // mode-4 alpha term), not the retired gouache coverage: exactly one read
    // and its one use, and no gouache term anywhere.
    expect(
      (display.match(/\bcov\b/g) ?? []).length,
      'one coverage-channel variable, read once and used once',
    ).toBe(2)
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
      'fourteen target allocations: the coverage pair is the eleventh (SPIKE 001); 64-21 adds the three-reservoir bristle pair and the shape texture (SPIKE 002); 64-24 adds the document-sized R32F last-touch pair (D-24, D-29)',
    ).toBe(14)
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
    expect(
      (SHADERS_SOURCE.match(/export const BRISTLE_GATHER/g) ?? []).length,
      'one shared gather snippet',
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

  it('deposits the gathered coefficients additively and takes the scatter as a uniform', () => {
    const deposit = sliceBetween(
      SHADERS_SOURCE,
      'export const bristleDepositFS',
      'export const bristleCoverFS',
    )
    expectContains(deposit, '${HEADER}${BRISTLE_GATHER}')
    expectNotContains(deposit, 'pow(')
    expectContains(deposit, 'uniform float uScatter;')
    expectContains(deposit, 'oA = g.cA * amount;')
    expectContains(deposit, 'oB = vec4(g.cB * amount, uScatter * deposit);')
    // Never an RGB average: the gathered value stays in coefficient space.
    expectNotContains(deposit, 'rgb')
    // The coverage fragment writes the SAME gather's coverage, nothing else.
    const cover = SHADERS_SOURCE.slice(SHADERS_SOURCE.indexOf('export const bristleCoverFS'))
    expectContains(cover, '${HEADER}${BRISTLE_GATHER}')
    expectContains(cover, 'o0 = vec4(clamp(g.coverage, 0.0, 1.0));')
  })

  it('wires one ink draw and ONE coverage write per bristle dab', () => {
    const ink = sliceBetween(ENGINE_SOURCE, 'private bristleInk(', 'readBristles(): Uint16Array {')
    expectContains(ink, 'gl.blendFunc(gl.ONE, gl.ONE);')
    expectContains(ink, 'gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);')
    expect((ink.match(/this\.ink\.read/g) ?? []).length, 'one ink deposit').toBe(1)
    expect((ink.match(/this\.cover\.read/g) ?? []).length, 'exactly ONE coverage write').toBe(1)
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
    expectContains(brush, 'if (bristle) this.bristleInk(dx, dy, dr, angle, amount, pr, c1[3]!, alongPx);')
    expectNotContains(brush, 'Math.pow(')
  })

  it('takes pickup and refill from the recorded bag and keeps the pinned counts', () => {
    expectContains(ENGINE_SOURCE, 'gl.uniform1f(p.u.uPickupRate!, this.params.pickup);')
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
    expectContains(ENGINE_SOURCE, 'this.programs.bristleDeposit = this.g.program(S.bristleDepositFS);')
    expectContains(ENGINE_SOURCE, 'this.programs.bristleCover = this.g.program(S.bristleCoverFS);')
    const alloc = sliceBetween(ENGINE_SOURCE, 'private allocateTargets()', 'private allocateHistory()')
    expect(
      (alloc.match(/this\.\w+ = g\.(?:double|target)\(/g) ?? []).length,
      'fourteen allocations: 64-24 adds the documented R32F last-touch pair; the gather adds no target of its own',
    ).toBe(14)
  })
})

// ============================================================
//  64-22 (D-21) — the bristle-modulated Body cover.
//
//  Spike 002 left the Body erode on the tip-space footprint mask while the
//  deposit read the bristle gather; D-21 closes that open decision for the
//  two bristle responses only. The erode mask IS `gatherBristle(...).coverage`
//  — the same film the deposit lands — with the two constants inherited
//  unchanged: the alpha-shaped `1 − exp(−uDensity·m)` paint law (uShape = 1)
//  and the delivered LINEAR `coverAmount × RELIEF_ERODE` thickness law
//  (uShape = 0). Every non-bristle response keeps `bodyCoverFS` and
//  `footprintMask()`, untouched.
// ============================================================

describe('64-22 — the bristle Body mask (D-21)', () => {
  it('builds the Body mask on the shared gather, never on footprintMask', () => {
    const body = sliceBetween(
      SHADERS_SOURCE,
      'export const bristleBodyCoverFS',
      '// Paper, generated per document',
    )
    expectContains(body, '${HEADER}${BRISTLE_GATHER}')
    expectNotContains(body, 'footprintMask()')
    expectContains(body, 'float m = gatherBristle(vUv).coverage;')
    expectContains(body, 'float f = uAmount * mix(m, 1.0 - exp(-uDensity * m), uShapeLaw);')
    // One factor, two outputs — the same law bodyCoverFS declares.
    expect((body.match(/= vec4\(f\);/g) ?? []).length, 'one factor, two outputs').toBe(2)
    // The shipped footprint twin is untouched: a non-bristle dab still reads
    // the tip-space mask (the branch below routes it there).
    const shipped = sliceBetween(
      SHADERS_SOURCE,
      'export const bodyCoverFS',
      '// SPIKE 001 — the coverage composite',
    )
    expectContains(shipped, '${HEADER}${FOOTPRINT_MASK}')
    expectContains(shipped, 'float m = footprintMask();')
  })

  it('erodes fixed alpha-shaped and relief linearly, and never writes coverage', () => {
    const pass = sliceBetween(ENGINE_SOURCE, 'private coverBristlePass(', 'private coverageDeposit(')
    expectContains(pass, 'const p = this.programs.bristleBodyCover;')
    expectContains(pass, 'this.bindGather(p, x, y, r, angle, pr, alongPx);')
    // The same two draws, the same blend law as coverPass: fixed then relief.
    expect((pass.match(/g\.draw\(/g) ?? []).length, 'two draws: fixed, then relief').toBe(2)
    expectContains(pass, 'gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);')
    expectContains(pass, 'g.draw(this.fixed, rect);')
    expectContains(pass, 'g.draw(this.relief, rect);')
    expect(pass.indexOf('g.draw(this.fixed, rect);'), 'fixed erodes first').toBeLessThan(
      pass.indexOf('g.draw(this.relief, rect);'),
    )
    // uShapeLaw = 1 (the paint's alpha-shaped law), then 0 (the delivered
    // LINEAR thickness law) — inherited from coverPass, never re-invented.
    // (Named uShapeLaw because the gather binds `uShape` as its sampler.)
    expectContains(pass, 'gl.uniform1f(p.u.uShapeLaw, 1);')
    expectContains(pass, 'gl.uniform1f(p.u.uShapeLaw, 0);')
    // The coverage channel is NOT written here: bristleInk owns the one write.
    expectNotContains(pass, 'this.cover.read')
    expectNotContains(pass, 'this.cover.write')
    expectContains(ENGINE_SOURCE, 'this.programs.bristleBodyCover = this.g.program(S.bristleBodyCoverFS);')
  })

  it('branches the stamp cover on the bristle predicate and keeps the undo block in place', () => {
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expectContains(
      brush,
      'if (bristle) this.coverBristlePass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, pr, alongPx);',
    )
    expectContains(
      brush,
      'else this.coverPass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, dryness, grainThr);',
    )
    // The erode's undo coverage stays exactly where it was: once per stamp,
    // before eachDab's first cover draw.
    const protectAt = brush.indexOf('this.history.protect(1,')
    const dabAt = brush.indexOf('this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {')
    expect(protectAt, 'the protect block survives').toBeGreaterThan(-1)
    expect(protectAt, 'the protect precedes every dab').toBeLessThan(dabAt)
    expectContains(brush, 'const coverRect = this.stampRect(')
    // Order inside eachDab: carrier -> cover -> deposit, as before.
    const dab = sliceBetween(brush, 'this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {', '});')
    const carrierAt = dab.indexOf('this.carrierPass(')
    const coverAt = dab.indexOf('this.coverBristlePass(')
    const depositAt = dab.indexOf('this.bristleInk(')
    expect(carrierAt, 'the carrier runs first').toBeGreaterThan(-1)
    expect(coverAt, 'the cover branch runs inside eachDab').toBeGreaterThan(-1)
    expect(depositAt, 'the deposit runs inside eachDab').toBeGreaterThan(-1)
    expect(carrierAt, 'carrier before cover').toBeLessThan(coverAt)
    expect(coverAt, 'cover before deposit').toBeLessThan(depositAt)
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
      'fourteen allocations: the bristle Body mask adds no render target; 64-24 adds the documented R32F last-touch pair',
    ).toBe(14)
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
  const gather = sliceBetween(SHADERS_SOURCE, 'export const BRISTLE_GATHER', '// 64-22 — the ink deposit')
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
    expectContains(SHADERS_SOURCE, 'export const BRISTLE_GATHER = `${BRISTLE_NOISE}${BRISTLE_TEXTURES}')
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
    expectContains(gather, 'float height = grainHeight(css, uAxis);')
    expectContains(gather, 'float threshold = uGrain * (1.0 - height) - 0.25;')
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
    expectContains(gather, 'float dryEdge = mix(1.0, uDryEdge, smoothstep(0.3, 1.05, abs(across)));')
    expectContains(gather, 'float coverage = body * (0.3 + 0.7 * uPressure) * dryEdge;')
    expectContains(gather, 'g.coverage = smoothstep(threshold - uSoftness, threshold + uSoftness, coverage);')
  })

  it('binds every declared constant from bristles.ts — no literal survives', () => {
    const bindings: Array<[string, string]> = [
      ['uAlongPx', 'alongPx'],
      ['uStrokeDistPx', 'alongPx'],
      ['uHalfWidthPx', 'r * this.dh'],
      ['uStreak', 'BRISTLE_STREAK'],
      ['uStreakLen', 'BRISTLE_STREAK_LENGTH'],
      ['uStreakShare', 'BRISTLE_STREAK_SHARE'],
      ['uRimContact', 'BRISTLE_RIM_CONTACT'],
      ['uHairs', 'BRISTLE_HAIRS'],
      ['uDryEdge', 'BRISTLE_DRY_EDGE'],
      ['uLanding', 'BRISTLE_LANDING'],
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
      'fourteen allocations: the traces add no render target; 64-24 adds the documented R32F last-touch pair',
    ).toBe(14)
  })
})
