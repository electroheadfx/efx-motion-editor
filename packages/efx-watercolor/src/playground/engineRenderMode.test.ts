// ============================================================
//  engineRenderMode — the stroke-scoped deposit mode (61-07, VEC-04).
//
//  D-12: the mode is an EXPLICIT per-stroke discriminator, never
//  inferred from a parameter value being zero. D-14: the mode is a
//  stroke property, so the interactive path seeds it from the active
//  brush while an explicit scriptBegin argument always wins.
//
//  No WebGL2 is required: every law below is read off a real
//  `WatercolorEngine.prototype` instance whose fields are seeded by
//  hand (the same shape engineScriptWidth.test.ts uses), so this
//  file runs on every machine. The real-pixel proof lives in
//  probe/vector-spine (`--scenario ribbon`).
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as EngineModule from './Engine'
import { WatercolorEngine } from './Engine'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
const SHADER_SOURCE = readFileSync(resolve(HERE, 'shaders.ts'), 'utf8')

/** The engine fields the render-mode laws read, seeded by hand. */
interface StrokeInternals {
  pointerId: number
  widthFrom: number
  widthTo: number
  renderMode?: string
}

interface EngineInternals {
  params: { size: number }
  stroke: StrokeInternals | null
  queue: Array<{ x: number; y: number; p: number; w: number }>
  scriptScale: number
  lastDir: [number, number]
  lastAngle: number
  clock: () => number
  schedule: () => void
  beginStep: (kind: string, label: string) => void
  brush: { renderMode?: string }
  radius: (tool: string, pressure: number, speed: number, widthFactor?: number) => number
  scriptBegin: (
    tool: string,
    x: number,
    y: number,
    pressure: number,
    step: string | false,
    maxRadius?: number,
    tiltX?: number,
    tiltY?: number,
    widthScale?: number,
    renderMode?: string,
  ) => boolean
}

/** A prototype-created engine: no WebGL2 surface, every field we need set. */
function makeEngine(): EngineInternals {
  const engine = Object.create(WatercolorEngine.prototype) as unknown as EngineInternals
  engine.params = { size: 0.72 }
  engine.stroke = null
  engine.queue = []
  engine.scriptScale = 1
  engine.clock = () => 0
  engine.schedule = () => {}
  engine.beginStep = () => {}
  engine.lastDir = [1, 0]
  engine.lastAngle = 0
  engine.brush = {}
  return engine
}

/** Count non-overlapping occurrences of `needle` in `haystack`. */
function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

/** The exported rim constant, read through the namespace so the RED run
 * fails on the assertion instead of on a missing named import. */
function ribbonRimFrac(): unknown {
  return (EngineModule as unknown as { RIBBON_RIM_FRAC?: unknown }).RIBBON_RIM_FRAC
}

describe('scriptBegin stores the stroke render mode (61-07 D-12)', () => {
  it('defaults to watercolor when the argument is omitted', () => {
    const engine = makeEngine()
    engine.scriptBegin('brush', 0.1, 0.2, 0.5, false)
    expect(engine.stroke!.renderMode).toBe('watercolor')
  })

  it('stores simple-ribbon on the active stroke when the argument says so', () => {
    const engine = makeEngine()
    engine.scriptBegin('brush', 0.1, 0.2, 0.5, false, undefined, 0, 0, 1, 'simple-ribbon')
    expect(engine.stroke!.renderMode).toBe('simple-ribbon')
  })

  it('lets an explicit script mode win over the loaded brush', () => {
    const engine = makeEngine()
    engine.brush = { renderMode: 'simple-ribbon' }
    engine.scriptBegin('brush', 0.1, 0.2, 0.5, false, undefined, 0, 0, 1, 'watercolor')
    expect(engine.stroke!.renderMode).toBe('watercolor')
  })
})

describe('interactive strokes seed their mode from the brush (61-07 D-14)', () => {
  it('sets the pointerdown stroke literal from the active brush, exactly once', () => {
    const seed = "renderMode: this.brush.renderMode ?? 'watercolor'"
    expect(occurrences(ENGINE_SOURCE, seed)).toBe(1)
  })

  it('the interactive sample queue still carries the neutral width factor', () => {
    // 61-04 guard rail: the pointer path has no vector width profile.
    expect(ENGINE_SOURCE).toContain('tx, ty, w: 1 }')
  })
})

describe('the ribbon deposit branch is explicit (61-07 D-12 / T-61-22)', () => {
  it('exports RIBBON_RIM_FRAC as the 0.08 rim fraction', () => {
    expect(ribbonRimFrac()).toBe(0.08)
  })

  it('selects the branch from stroke.renderMode, never from a zero parameter', () => {
    expect(ENGINE_SOURCE).toContain("s.renderMode === 'simple-ribbon'")
  })

  it('leaves the sampling law untouched (spacingFrac / carry / 48-substep cap)', () => {
    expect(ENGINE_SOURCE).toContain('clamp(Math.ceil(approx / Math.max(fine, 1e-5)), 1, 48)')
    expect(ENGINE_SOURCE).toContain('while (len - pos >= spacing - s.carry)')
    expect(ENGINE_SOURCE).toContain('this.radius(s.tool, p, s.speed, widthAt) * this.spacingFrac(s.tool)')
    expect(occurrences(ENGINE_SOURCE, 'spacingFrac(tool: Tool)')).toBe(1)
  })

  it('never reuses the watercolour branch floored wet / concentration expressions', () => {
    // The ribbon branch must multiply each global directly. The watercolour
    // branch keeps exactly one copy of each floored expression; the ribbon
    // branch adds none.
    expect(occurrences(ENGINE_SOURCE, '(0.25 + 0.75 * P.water)')).toBe(1)
    expect(occurrences(ENGINE_SOURCE, '0.15 * Math.exp(P.load * 2.8)')).toBe(1)
    // No unseeded randomness in the playground deposit path: the only
    // reference is the live default rng seam (declaration + its comment).
    expect(occurrences(ENGINE_SOURCE, 'Math.random')).toBe(2)
  })

  it('adds the ribbon coverage profile to the stamp shader', () => {
    expect(SHADER_SOURCE).toContain('uRibbon')
    expect(SHADER_SOURCE).toContain('uEdge')
  })
})
