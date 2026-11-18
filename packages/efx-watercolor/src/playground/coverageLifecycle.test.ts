// ============================================================
//  The coverage channel's lifecycle (Phase 64, plan 64-14) — the
//  three bounded limitations Spike 001 declared.
//
//  Family: source-scan on the existing setup. vitest has no WebGL2, so the
//  byte-level proof (a wet covering stroke moves with its pigment, undo
//  restores the field, Lift destroys it) lives in the probe's captures and
//  committed baselines. What a source scan CAN prove is pinned below.
//
//  Every assertion runs on COMMENT-STRIPPED source: the landed code explains
//  the laws in prose, so a raw grep could be satisfied by a comment alone.
//
//  Laws pinned here:
//   task 1 — advection
//   1. `advectCoverFS` declares only the uniforms it reads and no keep
//      factor: coverage never decays through the settle.
//   2. Its mobility gate, near-zero guard, back-trace, brush-weighted
//      diffusion and edge term are the SAME literals `advectInkFS` uses.
//   3. The program registers outside the pinned 23-entry literal.
//   4. `step()` draws it into the cover write half and swaps, after the ink
//      swap and before the dirty union.
//
//   task 2 — undo, whole-document transport, resize
//   5. `LayerId` carries `'cover'`; pool 0 has five formats with coverage
//      last; `snapshotLayers()` and `travel()`'s pool-0 map agree, entry for
//      entry (a parsed length check, so a sixth channel cannot drift).
//   6. `captureWhole` reads the cover field at one channel and `uploadWhole`
//      writes it into BOTH halves.
//
//   task 3 — Lift
//   7. `lift()` draws `this.cover.read` after the fixed draw and before
//      `drawRelief`, inside the already-enabled blend pair, with no new
//      uniform and the touch / pool-1 protection still ahead of every draw.
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

const ADVECT_COVER = () => sliceBetween(SHADERS, 'export const advectCoverFS', '`;')
const ADVECT_INK = () => sliceBetween(SHADERS, 'export const advectInkFS', '`;')
const STEP = () => sliceBetween(ENGINE, 'private step(dt: number)', 'private trimActive()')
const LIFT = () =>
  sliceBetween(
    ENGINE,
    'private lift(x: number, y: number, r: number, angle: number, amount: number)',
    'private dryTau()',
  )

/** Index of the first occurrence of `needle` at or after `from`; throws when absent. */
function firstIndexAfter(source: string, needle: string, from = 0): number {
  const at = source.indexOf(needle, from)
  expect(at, `anchor not found: ${needle}`).toBeGreaterThanOrEqual(0)
  return at
}

/**
 * Count the top-level comma-separated entries of the bracket group opening at
 * `openAt`. Commas nested inside a child entry (the travel map's pairs) do not
 * count, so a desynchronised layer list is caught by arithmetic, not by a
 * hand-maintained number.
 */
function countTopLevelEntries(source: string, openAt: number): number {
  let depth = 0
  let entries = 1
  for (let i = openAt; i < source.length; i++) {
    const ch = source[i]
    if (ch === '[' || ch === '(' || ch === '{') depth += 1
    else if (ch === ']' || ch === ')' || ch === '}') {
      depth -= 1
      if (depth === 0) return entries
    } else if (ch === ',' && depth === 1) {
      entries += 1
    }
  }
  throw new Error(`unterminated bracket group at ${openAt}`)
}

describe('the coverage advect program (64-14 task 1)', () => {
  it('declares only the uniforms it reads, with a single clamped output', () => {
    const cover = ADVECT_COVER()
    expectContains(cover, 'layout(location=0) out vec4 o0;')
    expectContains(cover, 'uniform sampler2D uVelocity, uCover, uWet;')
    expectContains(cover, 'uniform vec2 uSimTexel, uTexel;')
    expectContains(cover, 'uniform float uDt, uBleed, uEdge, uAspect;')
    expectContains(cover, 'uniform vec3 uBrush;')
    // T-64-41 / the no-decay prohibition: no keep factor, no settle term.
    expectNotContains(cover, 'uKeep')
    expectNotContains(cover, 'uSettle')
    // Coverage is a committed alpha in [0, 1]: the transported sum is clamped.
    expectContains(cover, 'clamp(c + dC, 0.0, 1.0)')
  })

  it('shares the ink law literals: mobility, near-zero guard, back-trace, fluxes', () => {
    const cover = ADVECT_COVER()
    const ink = ADVECT_INK()
    for (const source of [cover, ink]) {
      expectContains(source, 'float mobility(float w){ return smoothstep(0.02, 0.45, w); }')
      expectContains(source, 'if (m < 0.002)')
      expectContains(source, 'vec2 coord = vUv - uDt * vel * uSimTexel * m;')
      expectContains(source, 'float diffusion = clamp(uBleed * (0.25 + 1.3 * brush) * 0.3, 0.0, 0.15);')
      expectContains(source, 'float e = clamp(edge * (w - wn), -0.08, 0.08) * g;')
      for (const off of [
        'face(vec2( uTexel.x, 0.0)',
        'face(vec2(-uTexel.x, 0.0)',
        'face(vec2(0.0,  uTexel.y)',
        'face(vec2(0.0, -uTexel.y)',
      ]) {
        expectContains(source, off)
      }
    }
    // The single channel's own expressions: the unchanged early return, the
    // semi-Lagrangian mix, and the face accumulation on one scalar.
    expectContains(cover, 'if (m < 0.002){ o0 = vec4(C); return; }')
    expectContains(cover, 'float c = mix(C, texture(uCover, coord).x, m);')
    expectContains(cover, 'dC += d * (Cn - C) - (e > 0.0 ? e * C : e * Cn);')
  })

  it('registers the program outside the pinned 23-entry literal', () => {
    expectContains(ENGINE, 'this.programs.advectCover = this.g.program(S.advectCoverFS);')
    const bodyCoverAt = ENGINE.indexOf('this.programs.bodyCover = this.g.program(S.bodyCoverFS);')
    const advectCoverAt = ENGINE.indexOf('this.programs.advectCover = this.g.program(S.advectCoverFS);')
    expect(bodyCoverAt).toBeGreaterThanOrEqual(0)
    expect(advectCoverAt).toBeGreaterThan(bodyCoverAt)
  })
})

describe('the cover pass in step() (64-14 task 1)', () => {
  it('draws into the write half and swaps, after the ink swap and before the dirty union', () => {
    const step = STEP()
    const inkSwap = step.indexOf('g.draw(this.ink.write, rect); this.ink.swap();')
    const bind = step.indexOf('P.advectCover.bind();')
    const draw = step.indexOf('g.draw(this.cover.write, rect); this.cover.swap();')
    const dirty = step.indexOf('this.dirty = union(this.dirty, rect);')
    expect(inkSwap, 'the ink advect draw+swap').toBeGreaterThanOrEqual(0)
    expect(bind, 'the cover pass bind').toBeGreaterThan(inkSwap)
    expect(draw, 'the cover draw+swap').toBeGreaterThan(bind)
    expect(dirty, 'the dirty union').toBeGreaterThan(draw)
  })

  it('binds the same velocity, wet and texel locals the ink advect used, and no keep', () => {
    const step = STEP()
    const block = sliceBetween(step, 'P.advectCover.bind();', 'this.cover.swap()')
    expectContains(block, 'g.bindTex(0, vel.read.tex[0])')
    expectContains(block, 'g.bindTex(1, this.cover.read.tex[0])')
    expectContains(block, 'g.bindTex(2, this.wet.read.tex[0])')
    expectContains(block, 'gl.uniform2fv(P.advectCover.u.uSimTexel, simTexel);')
    expectContains(block, 'gl.uniform2fv(P.advectCover.u.uTexel, texel);')
    expectContains(block, 'gl.uniform1f(P.advectCover.u.uDt, dt);')
    expectContains(block, 'gl.uniform1f(P.advectCover.u.uBleed, this.params.bleed);')
    expectContains(block, 'gl.uniform1f(P.advectCover.u.uEdge, this.params.edge * 1.4);')
    expectContains(block, 'gl.uniform1f(P.advectCover.u.uAspect, this.dw / this.dh);')
    expectContains(block, 'gl.uniform3f(P.advectCover.u.uBrush, this.brushNow.x, this.brushNow.y, this.brushNow.r);')
    // The settlement's keep factor belongs to the ink's pigment only.
    expectNotContains(block, 'uKeep')
  })
})

describe('coverage rides the document lifecycle (64-14 task 2)', () => {
  it("adds 'cover' to LayerId after 'relief'", () => {
    expectContains(
      ENGINE,
      "export type LayerId = 'inkA' | 'inkB' | 'fixedA' | 'fixedB' | 'wet' | 'relief' | 'cover';",
    )
  })

  it('gives pool 0 five formats with coverage last', () => {
    const alloc = sliceBetween(ENGINE, 'private allocateHistory()', 'private docTargets()')
    expectContains(alloc, 'formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R, HALF_FLOAT_R, HALF_FLOAT_R]')
  })

  it('returns five snapshotLayers() views with the cover read half last', () => {
    const snap = sliceBetween(ENGINE, 'private snapshotLayers()', 'private drawSplat(')
    expectContains(
      snap,
      'return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0], this.relief.views[0], this.cover.read.views[0]];',
    )
  })

  it("lists the cover pair last in travel()'s pool-0 layer map", () => {
    const travel = sliceBetween(ENGINE, "private travel(dir: 'undo' | 'redo'", 'const res = dir ===')
    expectContains(
      travel,
      '[[ink.read.views[0], ink.write.views[0]], [ink.read.views[1], ink.write.views[1]], [wet.read.views[0], wet.write.views[0]], [this.relief.views[0]], [this.cover.read.views[0], this.cover.write.views[0]]],',
    )
  })

  it('reads cover in captureWhole and uploads it into both halves', () => {
    const whole = sliceBetween(ENGINE, 'private captureWhole()', 'private applyWhole(')
    expectContains(whole, 'cover: read(this.cover.read.views[0], 1),')
    expectContains(
      whole,
      'for (const t of [this.cover.read, this.cover.write]) up(t.tex[0], gl.RED, whole.layers.cover);',
    )
  })

  it('keeps the three positional lists the same length — five entries, cover last', () => {
    const alloc = sliceBetween(ENGINE, 'private allocateHistory()', 'private docTargets()')
    const formatsAt = firstIndexAfter(alloc, 'formats: [')
    const formats = countTopLevelEntries(alloc, formatsAt + 'formats: '.length)

    const snap = sliceBetween(ENGINE, 'private snapshotLayers()', 'private drawSplat(')
    const snapshotAt = firstIndexAfter(snap, 'return [')
    const snapshot = countTopLevelEntries(snap, snapshotAt + 'return '.length)

    const travel = sliceBetween(ENGINE, "private travel(dir: 'undo' | 'redo'", 'const res = dir ===')
    const layersAt = firstIndexAfter(travel, 'const layers = [')
    const poolOpen = firstIndexAfter(travel, '[', layersAt + 'const layers = '.length + 1)
    const travelPool0 = countTopLevelEntries(travel, poolOpen)

    expect(formats, 'allocateHistory pool-0 formats').toBe(5)
    expect(snapshot, 'snapshotLayers() entries').toBe(5)
    expect(travelPool0, "travel() pool-0 layer entries").toBe(5)
    // One arithmetic gate instead of three hand-maintained numbers: a sixth
    // channel added to only some of the lists fails here.
    expect(formats).toBe(snapshot)
    expect(snapshot).toBe(travelPool0)
  })
})

describe('Lift destroys coverage (64-14 task 3)', () => {
  it('draws the cover field after fixed and before relief, under the bound program', () => {
    const lift = LIFT()
    const fixedDraw = firstIndexAfter(lift, 'g.draw(this.fixed, rect);')
    const coverDraw = firstIndexAfter(lift, 'g.draw(this.cover.read, rect);')
    const reliefDraw = firstIndexAfter(lift, 'this.drawRelief(')
    expect(coverDraw, 'the cover draw follows the fixed draw').toBeGreaterThan(fixedDraw)
    expect(reliefDraw, 'drawRelief follows the cover draw').toBeGreaterThan(coverDraw)
  })

  it('sits inside the blend pair and adds no uniform after the fixed draw', () => {
    const lift = LIFT()
    const blendOn = firstIndexAfter(lift, 'gl.enable(gl.BLEND);')
    const fixedDraw = firstIndexAfter(lift, 'g.draw(this.fixed, rect);')
    const coverDraw = firstIndexAfter(lift, 'g.draw(this.cover.read, rect);')
    const reliefDraw = firstIndexAfter(lift, 'this.drawRelief(')
    const blendOff = firstIndexAfter(lift, 'gl.disable(gl.BLEND);')
    expect(fixedDraw).toBeGreaterThan(blendOn)
    expect(coverDraw).toBeGreaterThan(fixedDraw)
    expect(reliefDraw).toBeGreaterThan(coverDraw)
    expect(blendOff).toBeGreaterThan(reliefDraw)
    // The uAmount last written before the fixed draw is the paint amount —
    // exactly what coverage must lose. A uniform here would re-scale it.
    const between = lift.slice(fixedDraw, reliefDraw)
    expectNotContains(between, 'uniform')
  })

  it('touches and protects pool 1 before the first draw', () => {
    const lift = LIFT()
    const firstDraw = lift.indexOf('g.draw(this.ink.read, rect);')
    expect(firstDraw, 'the first lift draw').toBeGreaterThanOrEqual(0)
    const preamble = lift.slice(0, firstDraw)
    expectContains(preamble, 'this.touch(rect);')
    // Lift reaches fixed pigment, so the fixed pool is saved before its draw.
    expectContains(preamble, 'this.history.protect(1,')
  })
})
