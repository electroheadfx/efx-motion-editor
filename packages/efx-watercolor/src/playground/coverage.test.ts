// ============================================================
//  The Body cover pass (Phase 64, spec 06 / MED-19..MED-22).
//
//  Family: source-scan on the existing setup — no new config. vitest has no
//  WebGL2, so no draw can be read back here; the byte-level proof (Body 0
//  reproduces the pre-milestone baseline, Body 100 differs on every export)
//  lives in probe/medium-engine. What a source scan CAN prove is pinned below.
//
//  Laws pinned here:
//   1. The cover amount is `bodyCurve(P.body)`, the one curve declared in
//      scattering.ts — never an inline clamp — and a `coverAmount > 0` guard
//      wraps BOTH the per-stamp protections and the per-dab call, so Body 0
//      draws nothing and protects nothing.
//   2. Both pools are protected ONCE per stamp, before the first cover draw:
//      pool 0 through `this.touch(coverRect)`, pool 1 through
//      `this.history.protect(1, …)`, on a stamp-wide rect.
//   3. Inside a dab the cover draw precedes `this.brushInk`.
//   4. `coverPass` binds the ALREADY-REGISTERED Lift program through the
//      shared footprint binding with uRound = 0, draws only `this.fixed` and
//      `this.relief`, and takes no `touch()` of its own.
//   5. The water, pen and lift branches contain no cover call, and `lift()`'s
//      four draw lines are unchanged.
//   6. The package barrel re-exports the law module now that 64-08 owns it.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
const INDEX_SOURCE = readFileSync(resolve(HERE, 'index.ts'), 'utf8')

/** Slice the source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` would dump Engine.ts into the RED report and break its format.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectNotContains(source: string, needle: string): void {
  expect(source.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

const BRUSH_CASE = () =>
  sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
const CALLBACK = () =>
  sliceBetween(
    BRUSH_CASE(),
    'this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {',
    '});',
  )
const COVER_METHOD = () => sliceBetween(ENGINE_SOURCE, 'private coverPass(', 'private brushWet(')

describe('the Body cover pass (spec 06 / MED-19..MED-22)', () => {
  it('guards both the protections and the per-dab draw behind bodyCurve(P.body)', () => {
    const brush = BRUSH_CASE()
    expectContains(ENGINE_SOURCE, "import { bodyCurve, scatteringDeposit } from './scattering';")
    expectContains(brush, 'const coverAmount = bodyCurve(P.body);')
    // D-14 forbids an inline second curve or clamp on P.body at this site.
    expectNotContains(brush, 'Math.min(1, P.body)')
    expectNotContains(brush, 'Math.max(0, Math.min(1, P.body))')
    expect(
      (brush.match(/coverAmount > 0/g) ?? []).length,
      'two guards: one for the protections, one for the per-dab call',
    ).toBe(2)
    // The protection block itself is inside the first guard.
    const guarded = sliceBetween(brush, 'if (coverAmount > 0) {', 'this.eachDab(')
    expectContains(guarded, 'this.touch(coverRect);')
    expectContains(guarded, 'this.history.protect(1,')
  })

  it('protects both pools once per stamp, on a stamp-wide rect, before every dab', () => {
    const brush = BRUSH_CASE()
    const block = sliceBetween(
      brush,
      'if (coverAmount > 0) {',
      'this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {',
    )
    expectContains(
      block,
      'const coverRect = this.stampRect(x, y, r * (1 + b.sizeJitter + b.scatter), this.dw, this.dh, 2);',
    )
    expectContains(block, 'this.touch(coverRect);')
    expectContains(block, 'this.history.protect(1,')
    expectContains(block, 'this.fixed.views')
    expectContains(block, 'PROTECT_MARGIN')
    // Pool 0 is protected before pool 1, the same order lift() uses.
    expect(block.indexOf('this.touch(coverRect)')).toBeLessThan(
      block.indexOf('this.history.protect(1,'),
    )
    // Both protections sit OUTSIDE the per-dab callback, before its first run.
    const eachDabAt = brush.indexOf('this.eachDab(s, x, y, r, (dx, dy, dr, angle) => {')
    expect(brush.indexOf('this.touch(coverRect)')).toBeLessThan(eachDabAt)
    expect(brush.indexOf('this.history.protect(1,')).toBeLessThan(eachDabAt)
    const callback = CALLBACK()
    expectNotContains(callback, 'this.touch')
    expectNotContains(callback, '.protect(')
  })

  it('runs the cover draw before the dab deposits', () => {
    const callback = CALLBACK()
    expectContains(
      callback,
      'if (coverAmount > 0) this.coverPass(dx, dy, dr, angle, coverAmount, dryness, grainThr);',
    )
    expectContains(callback, 'this.brushInk(')
    expect(callback.indexOf('this.coverPass(')).toBeLessThan(callback.indexOf('this.brushInk('))
    // No cover call appears outside the one site: the method plus this call.
    expect(
      (ENGINE_SOURCE.match(/this\.coverPass\(/g) ?? []).length,
      'one coverPass call site',
    ).toBe(1)
    expect(
      (ENGINE_SOURCE.match(/private coverPass\(/g) ?? []).length,
      'one coverPass method',
    ).toBe(1)
  })

  it('reuses the Lift program through the shared footprint with uRound = 0', () => {
    const body = COVER_METHOD()
    expectContains(body, 'this.programs.lift')
    expect((body.match(/this\.bindFootprint\(/g) ?? []).length, 'one footprint binding').toBe(1)
    expectContains(body, 'this.bindFootprint(this.programs.lift, x, y, r, angle, 0, grain, grainThr);')
    expectContains(body, 'gl.uniform1f(p.u.uAmount, amount);')
    expectContains(body, 'const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);')
  })

  it('draws fixed then relief and never ink or wet', () => {
    const body = COVER_METHOD()
    expectContains(body, 'g.draw(this.fixed, rect);')
    expectContains(body, 'g.draw(this.relief, rect);')
    expect(body.indexOf('g.draw(this.fixed, rect);')).toBeLessThan(
      body.indexOf('g.draw(this.relief, rect);'),
    )
    expectNotContains(body, 'this.ink')
    expectNotContains(body, 'this.wet')
    // No undo bookkeeping inside the method: the caller protects per stamp.
    expectNotContains(body, 'this.touch')
    // No new GPU object and no allocation: one extra draw into two existing targets.
    expectNotContains(body, 'g.target(')
    expectNotContains(body, 'g.program(')
    expectNotContains(body, 'new ')
  })

  it('uses the exact multiplicative blend state lift() uses', () => {
    const body = COVER_METHOD()
    expectContains(body, 'gl.enable(gl.BLEND);')
    expectContains(body, 'gl.blendEquation(gl.FUNC_ADD);')
    expectContains(body, 'gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);')
    expectContains(body, 'gl.disable(gl.BLEND);')
  })

  it('leaves the water, pen and lift branches and lift() itself untouched', () => {
    const water = sliceBetween(ENGINE_SOURCE, "case 'water': {", "case 'pen': {")
    const pen = sliceBetween(ENGINE_SOURCE, "case 'pen': {", "case 'lift': {")
    const liftCase = sliceBetween(
      ENGINE_SOURCE,
      "case 'lift': {",
      '/* --------------------------------------------------------------- splats */',
    )
    expectNotContains(water, 'coverPass')
    expectNotContains(pen, 'coverPass')
    expectNotContains(liftCase, 'coverPass')
    // lift()'s four draw lines are byte-for-byte what they were.
    const liftBody = sliceBetween(
      ENGINE_SOURCE,
      'private lift(x: number, y: number, r: number, angle: number, amount: number) {',
      '/* ----------------------------------------------------------- simulation */',
    )
    expectContains(liftBody, 'g.draw(this.ink.read, rect);')
    expectContains(liftBody, 'g.draw(this.wet.read, rect);')
    expectContains(liftBody, 'g.draw(this.fixed, rect);')
    expectContains(liftBody, 'this.drawRelief(amount, x, y, r, angle, 0, 0, b, rect, 0, 0);')
  })

  it('re-exports the law module from the package barrel now that 64-08 owns the entry', () => {
    expectContains(INDEX_SOURCE, "from './scattering'")
  })
})
