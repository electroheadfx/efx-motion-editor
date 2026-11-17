// ============================================================
//  The Body cover pass (Phase 64, spec 06 / MED-19..MED-22).
//
//  Family: source-scan on the existing setup — no new config. vitest has no
//  WebGL2, so no draw can be read back here; the byte-level proof (Body 0
//  reproduces the pre-milestone baseline, Body 100 differs on every export)
//  lives in probe/medium-engine. What a source scan CAN prove is pinned below.
//
//  Laws pinned here:
//   1. The cover amount is `bodyCurve(P.body)` — the one curve declared in
//      scattering.ts, lifted by COVER_GAIN for the order pass only, never an
//      inline clamp on P.body — and a `coverAmount > 0` guard wraps BOTH the
//      per-stamp protections and the per-dab call, so Body 0 draws nothing and
//      protects nothing. The relief erodes at RELIEF_ERODE of that amount.
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
    expectContains(brush, 'const coverAmount = Math.min(1, bodyCurve(P.body) * COVER_GAIN);')
    expectContains(ENGINE_SOURCE, 'const COVER_GAIN = 2;')
    expectContains(ENGINE_SOURCE, 'const RELIEF_ERODE = 0.5;')
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
    expectContains(body, 'gl.uniform1f(p.u.uCover, 1);')
    expectContains(body, 'gl.uniform1f(p.u.uAmount, amount);')
    expectContains(body, 'gl.uniform1f(p.u.uAmount, amount * RELIEF_ERODE);')
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

// ============================================================
//  Quick 261117-tq7 — the cover seam (spec 09).
//
//  The spec-06 pass above erases SETTLED pigment only. A cover must also
//  replace what it crosses while that paint is still mobile in `ink` and
//  while it lives in a reopened frame's cached base. This block pins the
//  engine half: a PRE-STROKE ink snapshot (`preInk`), a reverse-subtract
//  draw that removes it under the same solid core, an `onCoverDab`
//  emission for the cached-base seam, and Body 0's neutrality.
//
//  Written RED by design (task 1 of the quick plan): every pin below names
//  a symbol task 2 adds. COVER_METHOD() must NOT grow — the subtract lives
//  in a sibling method because the spec-06 pins pin the cover pass body.
// ============================================================

const SHADER_SOURCE = readFileSync(resolve(HERE, 'shaders.ts'), 'utf8')

describe('the cover seam', () => {
  it('declares the transient preInk snapshot beside the document targets, outside undo state', () => {
    const fields = sliceBetween(ENGINE_SOURCE, 'private relief!: Target;', 'private paper!: Target;')
    expectContains(fields, 'private preInk: Target | null = null;')
    // A transient, never a document target and never an undo layer.
    expectNotContains(
      sliceBetween(ENGINE_SOURCE, 'private docTargets(): Target[] {', 'private createDocument('),
      'preInk',
    )
    expectNotContains(
      sliceBetween(ENGINE_SOURCE, 'private snapshotLayers() {', 'private drawSplat('),
      'preInk',
    )
  })

  it('arms the snapshot lazily at stroke start from the raw Body, only for a Brush', () => {
    const startBranch = sliceBetween(
      ENGINE_SOURCE,
      'if (!s.started) {',
      'this.stampScripted(s, q.x, q.y, s.pr, 0, 0, 1, 0, q.w, 1);',
    )
    expectContains(startBranch, "if (s.tool === 'brush' && this.params && this.params.body > 0) this.armInkCover();")
    // The raw Body, not the curve: Engine.ts keeps exactly ONE bodyCurve(
    // call site (scattering.test.ts pins the whole-file count at 1).
    expect((ENGINE_SOURCE.match(/bodyCurve\(/g) ?? []).length, 'one bodyCurve call site').toBe(1)
  })

  it('allocates the snapshot once per stroke and copies both ink attachments positionally', () => {
    const arm = sliceBetween(ENGINE_SOURCE, 'private armInkCover() {', 'private inkCover(')
    expectContains(arm, 'if (this.preInk !== null) return;')
    expectContains(
      arm,
      'this.preInk = g.target(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);',
    )
    expectContains(
      arm,
      'this.ink.read.views.forEach((v, i) => g.blit(v, 0, 0, this.preInk!.views[i], 0, 0, this.dw, this.dh));',
    )
    expect((arm.match(/g\.blit\(/g) ?? []).length, 'one positional blit per index').toBe(1)
  })

  it('registers the subtract program after the fixed program literal', () => {
    const literal = sliceBetween(ENGINE_SOURCE, 'this.programs = {', '};')
    expectContains(literal, 'display: this.g.program(S.displayFS),')
    // Outside the literal: scattering.test.ts pins its program count at 21.
    expectNotContains(literal, 'inkCover')
    expectContains(ENGINE_SOURCE, 'this.programs.inkCover = this.g.program(S.inkCoverFS);')
    expect(ENGINE_SOURCE.indexOf('this.programs.inkCover = this.g.program(S.inkCoverFS);')).toBeGreaterThan(
      ENGINE_SOURCE.indexOf('display: this.g.program(S.displayFS),'),
    )
  })

  it('subtracts the snapshot from the mobile ink with reverse-subtract blending', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'private inkCover(', 'private dropPreInk(')
    // An unarmed snapshot or a non-positive amount draws nothing: the call
    // site is unguarded (the brush case keeps its two `coverAmount > 0`).
    expectContains(body, 'if (this.preInk === null || !(amount > 0)) return;')
    expectContains(body, 'const p = this.programs.inkCover;')
    expectContains(body, 'gl.uniform1i(p.u.uPreA, g.bindTex(2, this.preInk.tex[0]));')
    expectContains(body, 'gl.uniform1i(p.u.uPreB, g.bindTex(3, this.preInk.tex[1]));')
    expect((body.match(/this\.bindFootprint\(/g) ?? []).length, 'one footprint binding').toBe(1)
    expectContains(body, 'this.bindFootprint(this.programs.inkCover, x, y, r, angle, 0, 0, 0);')
    expectContains(body, 'gl.uniform1f(p.u.uAmount, amount);')
    expectContains(body, 'gl.enable(gl.BLEND);')
    expectContains(body, 'gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);')
    expectContains(body, 'gl.blendFunc(gl.ONE, gl.ONE);')
    // Both attachments: the draw into ink.read fans out through its MRT views.
    expectContains(body, 'g.draw(this.ink.read, rect);')
    expectContains(body, 'gl.blendEquation(gl.FUNC_ADD);')
    expectContains(body, 'gl.disable(gl.BLEND);')
    expectContains(
      body,
      'const rect = this.stampRect(x, y, r * (1 + b.sizeJitter + b.scatter), this.dw, this.dh, 2);',
    )
    // Undo and wake are the caller's: the pinned coverRect + protect already
    // cover this stamp, and the subtract writes the pool brushInk touches.
    expectNotContains(body, 'this.touch')
    expectNotContains(body, '.protect(')
    // A hand-bound tip uniform would move engineTipIdentity's whole-file count.
    expectNotContains(body, 'uTipRotation')
    expectNotContains(body, 'g.program(')
    expectNotContains(body, 'g.target(')
  })

  it('keeps the subtract out of coverPass and deposits after it', () => {
    expectNotContains(COVER_METHOD(), 'inkCover')
    const callback = CALLBACK()
    expectContains(callback, 'this.inkCover(dx, dy, dr, angle, coverAmount);')
    expect(callback.indexOf('this.coverPass(')).toBeLessThan(callback.indexOf('this.inkCover('))
    expect(callback.indexOf('this.inkCover(')).toBeLessThan(callback.indexOf('this.brushInk('))
    // The call site stays UNGUARDED — inkCover's own early return is the guard.
    expect((BRUSH_CASE().match(/coverAmount > 0/g) ?? []).length, 'the two spec-06 guards').toBe(2)
    expect((ENGINE_SOURCE.match(/this\.inkCover\(/g) ?? []).length, 'one inkCover call site').toBe(1)
  })

  it('declares and emits onCoverDab, mirroring onLiftDab', () => {
    expectContains(
      ENGINE_SOURCE,
      'onCoverDab?(x: number, y: number, r: number, amount: number, angle: number): void;',
    )
    expect(ENGINE_SOURCE.indexOf('onCoverDab?(')).toBeGreaterThan(ENGINE_SOURCE.indexOf('onLiftDab?('))
    const cover = COVER_METHOD()
    expectContains(cover, 'this.callbacks.onCoverDab?.(x, y, r, amount, angle);')
    expect(cover.indexOf('g.draw(this.relief, rect);')).toBeLessThan(
      cover.indexOf('this.callbacks.onCoverDab?.(x, y, r, amount, angle);'),
    )
  })

  it('releases the snapshot at every lifecycle site', () => {
    expect((ENGINE_SOURCE.match(/this\.dropPreInk\(\);/g) ?? []).length, 'eight release sites').toBe(8)
    const sites: Array<[string, string, string]> = [
      ['stroke end', 'if (s.ending) {', 'this.stroke = null;'],
      ['clear', 'clear() {', 'resetSheet() {'],
      ['resetSheet', 'resetSheet() {', 'abortStroke() {'],
      ['abortStroke', 'abortStroke() {', 'undo() {'],
      ['travel', 'private travel(', 'private notifyHistory()'],
      [
        'resizeDocument',
        'resizeDocument(w: number, h: number) {',
        '/* ------------------------------------------------- whole-document state */',
      ],
      ['createDocument', 'private createDocument(', 'private resetPaintState()'],
      ['destroy', 'destroy() {', '/* ------------------------------------------------------------------ input */'],
    ]
    for (const [name, start, end] of sites) {
      expectContains(sliceBetween(ENGINE_SOURCE, start, end), 'this.dropPreInk();')
      expect(name.length).toBeGreaterThan(0)
    }
    // Never a dangling field: the release precedes the bulk teardown.
    const create = sliceBetween(ENGINE_SOURCE, 'private createDocument(', 'private resetPaintState()')
    expect(create.indexOf('this.dropPreInk();')).toBeLessThan(create.indexOf('this.g.disposeTargets();'))
    const destroy = sliceBetween(
      ENGINE_SOURCE,
      'destroy() {',
      '/* ------------------------------------------------------------------ input */',
    )
    expect(destroy.indexOf('this.dropPreInk();')).toBeLessThan(destroy.indexOf('this.g.disposeTargets();'))
  })

  it('Body 0 allocates nothing, draws nothing and emits nothing', () => {
    // Allocation: armed only for a Brush stroke with a positive raw Body.
    expectContains(
      sliceBetween(
        ENGINE_SOURCE,
        'if (!s.started) {',
        'this.stampScripted(s, q.x, q.y, s.pr, 0, 0, 1, 0, q.w, 1);',
      ),
      "if (s.tool === 'brush' && this.params && this.params.body > 0) this.armInkCover();",
    )
    // Draw: the method is a no-op without a snapshot or a positive amount.
    expectContains(
      sliceBetween(ENGINE_SOURCE, 'private inkCover(', 'private dropPreInk('),
      'if (this.preInk === null || !(amount > 0)) return;',
    )
    // Emission: coverPass is only reached under the spec-06 guard.
    expectContains(
      CALLBACK(),
      'if (coverAmount > 0) this.coverPass(dx, dy, dr, angle, coverAmount, dryness, grainThr);',
    )
  })

  it('gives the subtract its own program with the same solid-core law', () => {
    expectContains(SHADER_SOURCE, 'export const inkCoverFS')
    const program = sliceBetween(SHADER_SOURCE, 'export const inkCoverFS', 'export const paperFieldFS')
    expectContains(program, 'uniform sampler2D uPreA, uPreB;')
    expectContains(program, 'vec2 p = vUv - uPoint; p.x *= uAspect;')
    expectContains(program, 'q.y /= uTipAspect;')
    expectContains(program, 'if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;')
    expectContains(program, 'float f = uAmount * (1.0 - smoothstep(0.35, 1.0, dot(q, q)));')
    expectContains(program, 'o0 = texture(uPreA, vUv) * f;')
    expectContains(program, 'o1 = texture(uPreB, vUv) * f;')
    // The Lift program keeps its tip-shaped law and its own uniforms.
    const lift = sliceBetween(SHADER_SOURCE, 'export const liftFS', 'export const inkCoverFS')
    expectContains(lift, 'float soft = exp(-pow(dot(q, q), 2.0)) * mix(t, 1.0, uRound);')
    expectContains(lift, 'float f = uAmount * mix(soft, core, uCover);')
  })
})
