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
