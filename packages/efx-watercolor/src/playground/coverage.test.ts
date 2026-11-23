// ============================================================
//  The coverage seam (Phase 64, SPIKE 001 / MED-19..MED-25) — the
//  composite, display and deleted-seam contract.
//
//  Family: source-scan on the existing setup — no new config. vitest has no
//  WebGL2, so no draw can be read back here; the byte-level proof (Body 0
//  reproduces the pre-milestone baseline, a covering stroke hides its
//  underlayer, white covers) lives in probe/medium-engine. What a source
//  scan CAN prove is pinned below.
//
//  Every absence assertion runs on COMMENT-STRIPPED source: the landed code
//  explains the deleted rev-4 seam in prose, so a raw grep could invalidate a
//  negative gate on an explanatory sentence alone.
//
//  Laws pinned here:
//   1. A covering dab composites source-over inside the pigment layer:
//      attenuate ink, add C·a, union the coverage, on one shared footprint.
//   2. The amount is `bodyCurve(P.body)` and the density is the MEDIUM's —
//      pigment-independent, so a near-white pigment covers.
//   3. Both pools are protected once per stamp, before the first dab.
//   4. Mode 4 renders the committed darkness alpha (live/committed parity,
//      2026-11-21) and the emboss scales the premultiplied colour, never the
//      alpha. The coverage term 64-13 added here was retired with the law.
//   5. The rev-4 seam (preInk, inkCover, armInkCover, dropPreInk, onCoverDab,
//      the pigment-scaled coverDensity method) is gone from both sources.
//   6. The advect/undo/Lift lifecycle of the coverage sheet belongs to
//      64-14's coverageLifecycle.test.ts — deliberately not pinned here.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const RAW_ENGINE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
const RAW_SHADERS = readFileSync(resolve(HERE, 'shaders.ts'), 'utf8')

/** Remove block and line comments so prose can neither satisfy nor trip a pin. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, '')
}

const ENGINE = stripComments(RAW_ENGINE)
const SHADERS = stripComments(RAW_SHADERS)

/** Slice the source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` would dump the file into the RED report and break its format.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectNotContains(source: string, needle: string): void {
  expect(source.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

function countOf(source: string, needle: string): number {
  return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length
}

const BRUSH_CASE = () =>
  sliceBetween(ENGINE, "case 'brush': {", "case 'water': {")
const CALLBACK = () =>
  sliceBetween(
    BRUSH_CASE(),
    'this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {',
    '});',
  )
const COVERAGE_METHOD = () =>
  sliceBetween(ENGINE, 'private coverageDeposit(', 'private brushWet(')
const DISPLAY_DRAW = () =>
  sliceBetween(ENGINE, 'private drawDisplay(', 'private render() {')
const MODE_4 = () =>
  sliceBetween(SHADERS, 'if (uMode == 4){', 'if (uMode == 2){')

describe('comment-stripped source', () => {
  it('reads Engine.ts and shaders.ts with comments stripped before every assertion', () => {
    // The helper removes both comment forms...
    expectNotContains(stripComments('const a = 1 // preInk'), 'preInk')
    expectNotContains(stripComments('/* dropPreInk */ const b = 2'), 'dropPreInk')
    // ...and keeps the code around them, so a pin never passes by deletion.
    expectContains(stripComments('const a = 1 // preInk\nconst b = 2'), 'const b = 2')
    expectContains(stripComments('/* dropPreInk */ const b = 2'), 'const b = 2')
    // The real files DO carry comments, so the stripping is load-bearing.
    expect(RAW_ENGINE.includes('//'), 'Engine.ts carries line comments').toBe(true)
    expect(RAW_SHADERS.includes('//'), 'shaders.ts carries line comments').toBe(true)
    expectNotContains(ENGINE, '//')
    expectNotContains(SHADERS, '//')
    expectNotContains(ENGINE, '/*')
    expectNotContains(SHADERS, '/*')
  })
})

describe('the dab branch (SPIKE 001)', () => {
  it('routes a covering dab through coverageDeposit and leaves brushInk to the non-cover arm', () => {
    const callback = CALLBACK()
    expectContains(
      callback,
      'if (coverAmount > 0) this.coverageDeposit(dx, dy, dr, angle, coverAmount, coverDensity, c, c1[3]!, dryness, grainThr);',
    )
    expectContains(callback, 'else this.brushInk(dx, dy, dr, angle, c0, c1, dryness, grainThr);')
    // brushInk is reachable ONLY through the else arm: no unguarded call and no
    // second cover-arm call in the callback.
    expect(countOf(callback, 'this.brushInk(')).toBe(1)
    const brushAt = callback.indexOf('this.brushInk(')
    expect(callback.slice(brushAt - 5, brushAt), 'brushInk follows else').toBe('else ')
    expect(callback.indexOf('this.coverageDeposit(')).toBeLessThan(brushAt)
    expect(countOf(callback, 'this.coverageDeposit(')).toBe(1)
    // One call site and one method in the whole engine.
    expect(countOf(ENGINE, 'this.coverageDeposit(')).toBe(1)
    expect(countOf(ENGINE, 'private coverageDeposit(')).toBe(1)
  })
})

describe('the coverage composite', () => {
  it('runs three scissored draws in order — attenuate, deposit, union the coverage', () => {
    const body = COVERAGE_METHOD()
    expectContains(body, 'const c = this.programs.bodyCover;')
    expectContains(body, 'const d = this.programs.coverDeposit;')
    expectContains(body, 'const m = this.programs.coverMask;')
    expect(body.indexOf('this.programs.bodyCover')).toBeLessThan(body.indexOf('this.programs.coverDeposit'))
    expect(body.indexOf('this.programs.coverDeposit')).toBeLessThan(body.indexOf('this.programs.coverMask'))
    // One shared footprint rect and one footprint bind per draw.
    expect(countOf(body, 'const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);')).toBe(1)
    expect(countOf(body, 'this.bindFootprint(')).toBe(3)
    expectContains(body, 'this.bindFootprint(c, x, y, r, angle, 0, grain, grainThr);')
    expectContains(body, 'this.bindFootprint(d, x, y, r, angle, 0, grain, grainThr);')
    expectContains(body, 'this.bindFootprint(m, x, y, r, angle, 0, grain, grainThr);')
    // 1) ink <- ink * (1 - a): the seven coefficients and S are attenuated.
    expectContains(body, 'gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);')
    expectContains(body, 'gl.uniform1f(c.u.uAmount, amount);')
    expectContains(body, 'gl.uniform1f(c.u.uDensity, density);')
    expectContains(body, 'gl.uniform1f(c.u.uShape, 1);')
    // 2) ink <- ink + C * a, with the dab's scattering as the channel's S.
    expectContains(body, 'gl.uniform4f(d.u.uColor0, coeffs[0]!, coeffs[1]!, coeffs[2]!, coeffs[3]!);')
    expectContains(body, 'gl.uniform4f(d.u.uColor1, coeffs[4]!, coeffs[5]!, coeffs[6]!, scatter);')
    expectContains(body, 'gl.blendFunc(gl.ONE, gl.ONE);')
    // 3) cover <- a + cover * (1 - a): the union across the stroke's dabs.
    expectContains(body, 'gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);')
    // The two ink draws feed ink.read; the coverage union feeds cover.read.
    expect(countOf(body, 'g.draw(this.ink.read, rect);')).toBe(2)
    expect(countOf(body, 'g.draw(this.cover.read, rect);')).toBe(1)
    // Blending is enabled and restored for each of the three draws.
    expect(countOf(body, 'gl.enable(gl.BLEND);')).toBe(3)
    expect(countOf(body, 'gl.disable(gl.BLEND);')).toBe(3)
    expect(countOf(body, 'gl.blendEquation(gl.FUNC_ADD);')).toBe(3)
  })

  it('composites the landed coverDepositFS and coverMaskFS laws on the shared footprint', () => {
    const deposit = sliceBetween(SHADERS, 'export const coverDepositFS', 'export const coverMaskFS')
    expectContains(deposit, 'uniform vec4 uColor0, uColor1;')
    expectContains(deposit, 'uniform float uAmount, uDensity;')
    expectContains(deposit, 'float m = footprintMask();')
    expectContains(deposit, 'float a = uAmount * (1.0 - exp(-uDensity * m));')
    expectContains(deposit, 'o0 = uColor0 * a;')
    // The additive blend writes the whole scissor rect, so the scattering S
    // must ride the footprint mask (stampFS's o1 = uColor1 * f law); an
    // unmasked S painted a bright square over the paint around each covering
    // dab (the display reads B.a as Kubelka-Munk scatter).
    expectContains(deposit, 'o1 = vec4(uColor1.rgb * a, uColor1.a * m);')
    const mask = sliceBetween(SHADERS, 'export const coverMaskFS', '`;')
    // 64-20: the deposit stays ungated — the film-coherence law is the cover
    // TRANSPORT, and the census is closed at the capture boundary on the FINAL
    // film. A deposit gate read the dab's own transient film and starved the
    // white-over-blue Body-60 partial cover.
    expectContains(mask, 'o0 = vec4(uAmount * (1.0 - exp(-uDensity * m)));')
    expectNotContains(mask, 'filmPresence')
    // The attenuation program is the same footprint law, uShape switching the
    // relief draw back to LINEAR.
    const body = sliceBetween(SHADERS, 'export const bodyCoverFS', '`;')
    expectContains(body, 'float f = uAmount * mix(m, 1.0 - exp(-uDensity * m), uShape);')
    expectContains(body, 'o0 = vec4(f);')
    expectContains(body, 'o1 = vec4(f);')
  })
})

describe('the pigment-independent amount (T-64-36)', () => {
  it('derives the amount from bodyCurve(P.body) and the density from the medium alone', () => {
    const brush = BRUSH_CASE()
    expectContains(brush, 'const coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN);')
    expectContains(brush, 'const coverDensity = coverAmount > 0 ? COVER_MEDIUM_DENSITY * amount : 0;')
    expectContains(ENGINE, 'const COVER_MEDIUM_DENSITY = 8;')
    expectContains(ENGINE, 'const COVER_GAIN = 2;')
    // T-64-36: no pigment coefficient reaches either source.
    expectNotContains(brush, 'coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN) *')
    const densityLine = sliceBetween(brush, 'const coverDensity', ';')
    expectNotContains(densityLine, 'coeffs')
    expectNotContains(densityLine, 'pigment')
    // Body 0 computes nothing: the ternary's else arm is the literal 0.
    expectContains(brush, ': 0;')
    // The method receives the medium density, never a coefficient.
    expectContains(
      COVERAGE_METHOD(),
      'private coverageDeposit(x: number, y: number, r: number, angle: number, amount: number, density: number, coeffs: Float32Array, scatter: number, grain: number, grainThr: number)',
    )
  })
})

describe('the per-stamp protections (T-64-37)', () => {
  it('protects both pools once per stamp, before the first dab', () => {
    const brush = BRUSH_CASE()
    // Post-UAT 2026-11-19 (GAP-1): the block now also runs for a bristle
    // response, whose canvas lerp reaches the settled pool too.
    // quick 261123-jak: a relief-only stroke writes no cover and no history,
    // so the whole block sits behind the same per-stroke guard.
    const block = sliceBetween(brush, 'if (!s.reliefOnly && (coverAmount > 0 || bristle)) {', 'this.eachDab(')
    expectContains(
      block,
      'const coverRect = this.stampRect(x, y, r * (1 + b.sizeJitter + b.scatter), this.dw, this.dh, 2);',
    )
    expectContains(block, 'this.touch(coverRect);')
    // LIVE-SEED (2026-11-21): every protection routes through the guarded form,
    // so the seed replay (setStepRecording(false)) can never write history.
    expectContains(block, 'this.protectHistory(1,')
    expect(block.indexOf('this.touch(coverRect)')).toBeLessThan(block.indexOf('this.protectHistory(1,'))
    const eachDabAt = brush.indexOf('this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {')
    expect(brush.indexOf('this.touch(coverRect)')).toBeLessThan(eachDabAt)
    expect(brush.indexOf('this.protectHistory(1,')).toBeLessThan(eachDabAt)
    // The callback adds only the per-dab dirty bookkeeping touch -- never an
    // undo protection (the stamp-wide pair above already covers it).
    const callback = CALLBACK()
    expectNotContains(callback, '.protect(')
  })
})

describe('the display formula (T-64-39)', () => {
  it('renders the committed darkness alpha in mode 4 (live/committed parity)', () => {
    // 2026-11-21 (the artist's live-vs-committed report): the live compositor
    // emits exactly what the committed sheet converts to (alpha = 1 − min(t)),
    // so what is painted is what a move/re-bake lands. SPIKE 001's coverage
    // term made Body-100 paint opaque live and translucent committed.
    const mode4 = MODE_4()
    expectContains(SHADERS, 'uniform sampler2D uCover;')
    expectContains(mode4, 'float alpha = clamp(1.0 - tMin, 0.0, 1.0);')
    expectNotContains(mode4, 'max(darkAlpha, cov)')
    // The reconstruction is over WHITE through that same alpha.
    expectContains(mode4, 'vec3 pigment = alpha > 0.0 ? (tSrgb - vec3(1.0 - alpha)) / alpha : vec3(0.0);')
    expectContains(mode4, 'pigment = clamp(pigment, 0.0, 1.0);')
    // The emboss scales the premultiplied colour and never the alpha.
    expectContains(mode4, 'o = vec4(pigment * alpha * shade, alpha);')
    expectNotContains(mode4, 'alpha *= shade')
    expect(/\balpha\s*\*=\s*shade/.test(mode4), 'alpha must never be scaled by the shade').toBe(false)
    expectNotContains(mode4, 'rgb *= shade;')
    // Mode 2 keeps its early return after mode 4, so the alpha pin above is
    // the only display alpha either mode emits.
    expectContains(mode4, 'return;')
  })

  it('binds the coverage sheet to texture unit 8 on every display draw', () => {
    const body = DISPLAY_DRAW()
    expectContains(body, 'gl.uniform1i(p.u.uCover, g.bindTex(8, this.cover.read.tex[0]));')
    expect(countOf(body, 'p.u.uCover')).toBe(1)
    expect(countOf(body, 'g.bindTex(8,')).toBe(1)
  })
})

describe('the deleted rev-4 seam', () => {
  it('has no preInk, armInkCover, inkCover, dropPreInk, coverDensity( or onCoverDab in either source', () => {
    for (const [name, source] of [
      ['Engine.ts', ENGINE],
      ['shaders.ts', SHADERS],
    ] as const) {
      for (const token of ['preInk', 'armInkCover', 'inkCover', 'dropPreInk', 'coverDensity(', 'onCoverDab']) {
        expect(source.includes(token), `${name} must not carry ${token}`).toBe(false)
      }
    }
    // Canary: the absence scans read real code, not an emptied file -- the
    // sibling callback the seam mirrored is still there.
    expectContains(ENGINE, 'onLiftDab')
    expectContains(ENGINE, 'private brushInk(')
    expectContains(SHADERS, 'export const bodyCoverFS')
  })
})

describe('the untouched branches', () => {
  it('has no coverageDeposit call in the water, pen or lift branches', () => {
    const water = sliceBetween(ENGINE, "case 'water': {", "case 'pen': {")
    const pen = sliceBetween(ENGINE, "case 'pen': {", "case 'lift': {")
    // Comment-stripped anchors: the section banners are comments, so the
    // slices end on the next code declaration instead.
    const liftCase = sliceBetween(ENGINE, "case 'lift': {", 'private eachDab(s: Stroke')
    expectNotContains(water, 'coverageDeposit')
    expectNotContains(pen, 'coverageDeposit')
    expectNotContains(liftCase, 'coverageDeposit')
    const liftBody = sliceBetween(
      ENGINE,
      'private lift(x: number, y: number, r: number, angle: number, amount: number) {',
      'private dryTau()',
    )
    expectContains(liftBody, 'g.draw(this.ink.read, rect);')
    expectContains(liftBody, 'g.draw(this.wet.read, rect);')
    expectContains(liftBody, 'g.draw(this.fixed, rect);')
  })
})
