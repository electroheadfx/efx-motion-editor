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
//      inline clamp on P.body — and it guards BOTH the per-stamp protections
//      and the per-dab call, so Body 0 draws nothing and protects nothing.
//      The per-dab fraction is the dab's own LAYER ALPHA (rev 4):
//      `f = 1 - exp(-coverDensity * mask)` with coverDensity the pigment-scaled
//      optical density of this dab's deposit, so overlapping dabs erase
//      exactly the absorbance the paint adds. The relief erodes at
//      RELIEF_ERODE of the cover amount, linear in the mask.
//   2. Both pools are protected ONCE per stamp, before the first cover draw:
//      pool 0 through `this.touch(coverRect)`, pool 1 through
//      `this.history.protect(1, …)`, on a stamp-wide rect.
//   3. Inside a dab the cover draw precedes `this.brushInk`.
//   4. `coverPass` binds the deposit-footprint program (`bodyCoverFS`, the same
//      mask stampFS deposits with), draws only `this.fixed` and `this.relief`,
//      and takes no `touch()` of its own.
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

/** Zero-based indexes of every source line containing the literal. */
function lineIndexesOf(source: string, needle: string): number[] {
  return source
    .split('\n')
    .flatMap((line, index) => (line.includes(needle) ? [index] : []))
}

// Engine members are two-space class-body declarations; statements inside a
// method sit deeper. Control-flow keywords are filtered so a block opener can
// never be read as a method header.
const METHOD_HEADER =
  /^ {2}(?:(?:private|public|protected|static|async|override|readonly|get|set)\s+)*([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/
const NOT_A_METHOD = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'do', 'else'])

/** The method enclosing a line, derived by scanning back to its header. */
function enclosingMethod(lines: readonly string[], lineIndex: number): { name: string; header: number } {
  for (let i = lineIndex; i >= 0; i -= 1) {
    const match = lines[i]!.match(METHOD_HEADER)
    if (match && !NOT_A_METHOD.has(match[1]!)) return { name: match[1]!, header: i }
  }
  return { name: '(none)', header: -1 }
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
    // quick 261117-tq7 (rev 4): the erase tracks the dab's own OPACITY. The
    // density is the pigment-scaled optical density of this dab's deposit and
    // is computed only when Body is active, so a thin tip (or a texture gap)
    // keeps the old paint instead of paper-white.
    expectContains(brush, 'const coverDensity = coverAmount > 0 ? this.coverDensity(amount) : 0;')
    expectContains(ENGINE_SOURCE, 'private coverDensity(amount: number): number {')
    expectContains(ENGINE_SOURCE, 'return -Math.log(Math.max(1e-6, 1 - opacity));')
    expectNotContains(ENGINE_SOURCE, 'COVER_DEPOSIT_GAIN')
    expectContains(ENGINE_SOURCE, 'const COVER_GAIN = 2;')
    expectContains(ENGINE_SOURCE, 'const RELIEF_ERODE = 0.5;')
    // D-14 forbids an inline second curve or clamp on P.body at this site.
    expectNotContains(brush, 'Math.min(1, P.body)')
    expectNotContains(brush, 'Math.max(0, Math.min(1, P.body))')
    expect(
      (brush.match(/coverAmount > 0/g) ?? []).length,
      'three guards: the density, the protections, the per-dab call',
    ).toBe(3)
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
      'if (coverAmount > 0) this.coverPass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, dryness, grainThr);',
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

  it('erases through the deposit-footprint program, never Lift’s own mask', () => {
    const body = COVER_METHOD()
    expectContains(body, 'this.programs.bodyCover')
    expectNotContains(body, 'this.programs.lift')
    expect((body.match(/this\.bindFootprint\(/g) ?? []).length, 'one footprint binding').toBe(1)
    expectContains(
      body,
      'this.bindFootprint(this.programs.bodyCover, x, y, r, angle, 0, grain, grainThr);',
    )
    expectNotContains(body, 'uCover')
    expectContains(body, 'gl.uniform1f(p.u.uAmount, amount);')
    // The settled erase is alpha-shaped; the relief draw below switches the
    // same uniform back to the LINEAR delivered law.
    expectContains(body, 'gl.uniform1f(p.u.uDensity, density);')
    expectContains(body, 'gl.uniform1f(p.u.uShape, 1);')
    expectContains(body, 'gl.uniform1f(p.u.uAmount, reliefAmount);')
    expectContains(body, 'gl.uniform1f(p.u.uShape, 0);')
    // The relief keeps the DELIVERED erode law: coverAmount x RELIEF_ERODE.
    expectContains(
      BRUSH_CASE(),
      'const coverRelief = coverAmount * RELIEF_ERODE;',
    )
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
//  engine half: a PRE-STROKE ink snapshot (`preInk`), a cover draw that
//  subtracts ONLY the snapshot's current amount under the deposit footprint and
//  then decays it by (1 - f), so the stroke's own ink is never scaled, an
//  `onCoverDab` emission for the cached-base seam, and Body 0's neutrality.
//
//  Written RED by design (task 1 of the quick plan): every pin below names
//  a symbol task 2 adds. COVER_METHOD() must NOT grow — the cover lives
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

  it('self-heals a stale snapshot before allocating and copies both attachments positionally', () => {
    const arm = sliceBetween(ENGINE_SOURCE, 'private armInkCover() {', 'private inkCover(')
    // quick 261117-tq7 (rev 4, UAT round 3): arming is SELF-HEALING. An
    // early return on a non-null snapshot let a missed dropPreInk() outlive
    // its stroke, and the next stroke's cover subtracted that stale density
    // from the live ink (`ink - f * pre`) — deepening coefficients negative:
    // the reported hue shifts and paint that vanishes.
    expectNotContains(arm, 'if (this.preInk !== null) return;')
    expectContains(arm, 'this.dropPreInk();')
    expect(arm.indexOf('this.dropPreInk();'), 'release precedes the allocation').toBeLessThan(
      arm.indexOf('this.preInk = g.target('),
    )
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

  it('removes the snapshot’s current amount and decays it geometrically', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'private inkCover(', 'private dropPreInk(')
    // An unarmed snapshot or a non-positive amount draws nothing: the call
    // site is unguarded (the brush case keeps its `coverAmount > 0` guards).
    expectContains(body, 'if (this.preInk === null || !(amount > 0)) return;')
    expectContains(body, 'const p = this.programs.inkCover;')
    // The erase binds the SAME grain gate the deposit uses: a dotted or
    // tooth-gated dab must not rub out paint where it lands nothing.
    expectContains(
      body,
      'this.bindFootprint(this.programs.inkCover, x, y, r, angle, 0, grain, grainThr);',
    )
    expectContains(body, 'gl.uniform1i(p.u.uPreA, g.bindTex(2, this.preInk.tex[0]));')
    expectContains(body, 'gl.uniform1i(p.u.uPreB, g.bindTex(3, this.preInk.tex[1]));')
    expectContains(body, 'gl.uniform1i(p.u.uInkA, g.bindTex(4, this.ink.read.tex[0]));')
    expectContains(body, 'gl.uniform1i(p.u.uInkB, g.bindTex(5, this.ink.read.tex[1]));')
    // One bind for the removal, one for the decay: both use the same footprint.
    expect((body.match(/this\.bindFootprint\(/g) ?? []).length, 'two footprint bindings').toBe(2)
    expectContains(body, 'gl.uniform1f(p.u.uAmount, amount);')
    expectContains(body, 'gl.uniform1f(p.u.uDensity, density);')
    // Only the snapshot is subtracted in-shader; no reverse-subtract blend.
    expectNotContains(ENGINE_SOURCE, 'FUNC_REVERSE_SUBTRACT')
    expectContains(COVER_METHOD(), 'gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);')
    // The removal is a full-document ping-pong: ink.read feeds the samplers,
    // ink.write is the target with NO rect, then the halves swap.
    expectContains(body, 'g.draw(this.ink.write);')
    expectContains(body, 'this.ink.swap();')
    expectNotContains(body, 'g.draw(this.ink.read')
    // The snapshot decay is the only scissored draw, and it runs AFTER the
    // removal so this dab removes the pre-decay amount.
    expectContains(body, 'const rect = this.stampRect(x, y, r, this.dw, this.dh, 2);')
    expect(body.indexOf('g.draw(this.preInk, rect);')).toBeGreaterThan(
      body.indexOf('this.ink.swap();'),
    )
    // The decay is the deposit-footprint factor — the same mask the settle
    // pass erased with — never Lift's radial erase.
    expectContains(body, 'const c = this.programs.bodyCover;')
    expectContains(
      body,
      'this.bindFootprint(this.programs.bodyCover, x, y, r, angle, 0, grain, grainThr);',
    )
    expectContains(body, 'gl.uniform1f(c.u.uAmount, amount);')
    expectContains(body, 'gl.uniform1f(c.u.uDensity, density);')
    expectContains(body, 'gl.uniform1f(c.u.uShape, 1);')
    expectNotContains(body, 'uCover')
    expectContains(body, 'gl.enable(gl.BLEND);')
    expectContains(body, 'gl.disable(gl.BLEND);')
    // Undo and wake are the caller's: the pinned coverRect + protect already
    // cover this stamp, and the cover writes the pool brushInk touches.
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
    expectContains(callback, 'this.inkCover(dx, dy, dr, angle, coverAmount, coverDensity, dryness, grainThr);')
    expect(callback.indexOf('this.coverPass(')).toBeLessThan(callback.indexOf('this.inkCover('))
    expect(callback.indexOf('this.inkCover(')).toBeLessThan(callback.indexOf('this.brushInk('))
    // The call site stays UNGUARDED — inkCover's own early return is the guard.
    expect((BRUSH_CASE().match(/coverAmount > 0/g) ?? []).length, 'the density read and the two spec-06 guards').toBe(3)
    expect((ENGINE_SOURCE.match(/this\.inkCover\(/g) ?? []).length, 'one inkCover call site').toBe(1)
  })

  it('declares and emits onCoverDab, mirroring onLiftDab', () => {
    expectContains(
      ENGINE_SOURCE,
      'onCoverDab?(x: number, y: number, r: number, amount: number, angle: number, density: number): void;',
    )
    expect(ENGINE_SOURCE.indexOf('onCoverDab?(')).toBeGreaterThan(ENGINE_SOURCE.indexOf('onLiftDab?('))
    const cover = COVER_METHOD()
    expectContains(cover, 'this.callbacks.onCoverDab?.(x, y, r, amount, angle, density);')
    expect(cover.indexOf('g.draw(this.relief, rect);')).toBeLessThan(
      cover.indexOf('this.callbacks.onCoverDab?.(x, y, r, amount, angle, density);'),
    )
  })

  it('releases the snapshot wherever a lifecycle teardown runs', () => {
    // WR-02: the sites are DERIVED from the source, never hand-listed. Each
    // release line is mapped to its enclosing method by scanning backwards for
    // the nearest two-space class-member header, so a release that is added,
    // removed, or moved out of a lifecycle method changes this SET and fails.
    const lines = ENGINE_SOURCE.split('\n')
    const releases = lineIndexesOf(ENGINE_SOURCE, 'this.dropPreInk();')
    const disposes = lineIndexesOf(ENGINE_SOURCE, 'this.g.disposeTargets();')
    const releaseSites = [...new Set(releases.map((line) => enclosingMethod(lines, line).name))].sort()
    expect(releaseSites, 'the derived lifecycle release set').toEqual([
      'abortStroke',
      'armInkCover', // release-before-copy: the self-healing arm
      'clear',
      'createDocument', // allocation site
      'destroy',
      'processInput', // the stroke-end branch
      'resetSheet',
      'resizeDocument',
      'restore',
      'travel',
    ])
    expect(releases.length, 'one release per site').toBe(releaseSites.length)
    // The structural law: every disposeTargets() caller releases preInk in the
    // SAME method and BEFORE the bulk teardown, so a new dispose site cannot
    // ship without a release (the CR-02 gap this pin missed).
    const disposeSites = [...new Set(disposes.map((line) => enclosingMethod(lines, line).name))].sort()
    expect(disposeSites, 'the dispose callers').toEqual(['createDocument', 'destroy', 'restore'])
    for (const name of disposeSites) {
      expect(releaseSites, `dispose caller ${name} also releases preInk`).toContain(name)
    }
    for (const disposeLine of disposes) {
      const owner = enclosingMethod(lines, disposeLine)
      const releasesFirst = releases.some((releaseLine) => {
        const release = enclosingMethod(lines, releaseLine)
        return release.header === owner.header && releaseLine < disposeLine
      })
      expect(releasesFirst, `preInk release precedes disposeTargets in ${owner.name}`).toBe(true)
    }
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
      'if (coverAmount > 0) this.coverPass(dx, dy, dr, angle, coverAmount, coverDensity, coverRelief, dryness, grainThr);',
    )
  })

  it('gives the cover its own program with the deposit footprint and a snapshot-only subtraction', () => {
    expectContains(SHADER_SOURCE, 'export const inkCoverFS')
    expectContains(SHADER_SOURCE, 'const FOOTPRINT_MASK = `')
    const program = sliceBetween(SHADER_SOURCE, 'export const inkCoverFS', 'export const paperFieldFS')
    expectContains(program, 'export const inkCoverFS = `${HEADER}${FOOTPRINT_MASK}')
    expectContains(SHADER_SOURCE, 'export const bodyCoverFS = `${HEADER}${FOOTPRINT_MASK}')
    expectContains(program, 'uniform sampler2D uPreA, uPreB, uInkA, uInkB;')
    // f is the SAME alpha-shaped deposit fraction bodyCoverFS erases with.
    expectContains(program, 'uniform float uAmount, uDensity, uShape;')
    expectContains(program, 'float m = footprintMask();')
    expectContains(program, 'float f = uAmount * mix(m, 1.0 - exp(-uDensity * m), uShape);')
    expectNotContains(program, 'smoothstep(0.35')
    // Only the snapshot's current amount is removed; the stroke's own ink is
    // never scaled (a share inverted bands, a uniform scale punched holes).
    expectNotContains(program, 'share(')
    expectNotContains(program, 'inkA * (1.0 - f)')
    expectContains(program, 'vec4 preA = texture(uPreA, vUv);')
    expectContains(program, 'vec4 preB = texture(uPreB, vUv);')
    expectContains(program, 'o0 = inkA - f * preA;')
    expectContains(program, 'o1 = inkB - f * preB;')
    // Full-document draw: a discard would leave the write half stale.
    expectNotContains(program, 'discard')
    // bodyCoverFS (settled erase, relief erode and snapshot decay) runs the
    // same law, with uShape switching the relief draw back to LINEAR.
    const cover = sliceBetween(SHADER_SOURCE, 'export const bodyCoverFS', 'export const inkCoverFS')
    expectContains(cover, 'float f = uAmount * mix(m, 1.0 - exp(-uDensity * m), uShape);')
    expectContains(cover, 'o0 = vec4(f);')
    expectContains(cover, 'o1 = vec4(f);')
    // The shared mask is stampFS's footprint law, verbatim.
    expectContains(SHADER_SOURCE, 'float sharp = mix(t, dry, step(0.0001, uRough));')
    // The cover mask starts at the SAME low cut the deposit uses, then ramps
    // WIDE inward: erasing below the cut compounds to paper-white, and a hard
    // 1-in-1-out threshold carved the scalloped dab contours.
    expectContains(SHADER_SOURCE, 'float ramp = smoothstep(th, th + 0.5, t);')
    expectContains(SHADER_SOURCE, 'f *= 1.0 - smoothstep(0.82, 1.0, max(abs(q.x), abs(q.y)));')
    expectContains(SHADER_SOURCE, 'float round = 1.0 - smoothstep(0.15, 1.0, d);')
    expectContains(SHADER_SOURCE, 'smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h)')
    // Lift keeps its own tip-shaped law and has no cover profile.
    const lift = sliceBetween(SHADER_SOURCE, 'export const liftFS', 'const FOOTPRINT_MASK')
    expectContains(lift, 'float f = uAmount * exp(-pow(dot(q, q), 2.0)) * mix(t, 1.0, uRound);')
    expectNotContains(lift, 'uCover')
  })
})
