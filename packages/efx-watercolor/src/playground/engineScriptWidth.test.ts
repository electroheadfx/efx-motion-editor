// ============================================================
//  engineScriptWidth — the per-sample width channel (61-04, VEC-03).
//
//  C-03, the trap this channel exists to close: `scriptScale` is
//  assigned with `Math.min(1, maxRadius / radius(...))`, so ANY width
//  routed through it silently caps at 1.0 and passes a unit test while
//  the feature does not work. The new factor is a SEPARATE term: it
//  rides each queued sample, multiplies the footprint, and never
//  touches the clamp. The clamp assignment itself is pinned here
//  character-for-character.
//
//  No WebGL2 is required: every law below is read off a real
//  `WatercolorEngine.prototype` instance whose fields are seeded by
//  hand (the same shape the class methods read), so this file runs on
//  every machine. The real-pixel proof lives in
//  probe/vector-spine (`--scenario width`).
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { ANCHOR_WIDTH_MAX } from '../vector/spine'
import { WatercolorEngine } from './Engine'

const ENGINE_SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'Engine.ts'),
  'utf8',
)

/** The engine fields the width channel's laws read, seeded by hand. */
interface StrokeInternals {
  pointerId: number
  widthFrom: number
  widthTo: number
}

interface SampleInternals {
  x: number
  y: number
  p: number
  w: number
}

interface EngineInternals {
  params: { size: number }
  stroke: StrokeInternals | null
  queue: SampleInternals[]
  scriptScale: number
  lastDir: [number, number]
  lastAngle: number
  clock: () => number
  schedule: () => void
  beginStep: (kind: string, label: string) => void
  radius: (tool: string, pressure: number, speed: number, widthFactor?: number) => number
  sizeMult: (widthFactor?: number) => number
  widthFactorAt: (stroke: StrokeInternals, fraction: number) => number
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
  ) => boolean
  scriptMove: (
    x: number,
    y: number,
    pressure: number,
    t: number,
    tiltX?: number,
    tiltY?: number,
    widthScale?: number,
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
  return engine
}

/** The footprint sizeMult() produced before this plan — 3^((size - 0.5) * 2). */
const BASE_FOOTPRINT = Math.pow(3, (0.72 - 0.5) * 2)

describe('sizeMult width factor (61-04 VEC-03)', () => {
  it('leaves every existing no-argument call site at factor 1', () => {
    const engine = makeEngine()
    expect(engine.sizeMult()).toBe(BASE_FOOTPRINT)
    expect(engine.sizeMult(1)).toBe(BASE_FOOTPRINT)

    // The scripting guard keeps its own meaning: scripted strokes multiply
    // by scriptScale, pointer strokes do not.
    engine.stroke = { pointerId: -1, widthFrom: 1, widthTo: 1 }
    engine.scriptScale = 0.5
    expect(engine.sizeMult()).toBe(BASE_FOOTPRINT * 0.5)
    expect(engine.scriptScale).toBe(0.5)
  })

  it('multiplies the footprint by exactly the factor it is given (1.8x)', () => {
    const engine = makeEngine()
    expect(engine.sizeMult(1.8) / engine.sizeMult(1)).toBeCloseTo(1.8, 12)

    engine.stroke = { pointerId: -1, widthFrom: 1, widthTo: 1 }
    engine.scriptScale = 0.6
    const scripted = engine.sizeMult(1)
    expect(engine.sizeMult(1)).toBe(BASE_FOOTPRINT * 0.6)
    expect(engine.sizeMult(1.8) / scripted).toBeCloseTo(1.8, 12)
  })
})

describe('the queued sample carries its own width (61-04)', () => {
  const beginWith = (widthScale: number): EngineInternals => {
    const engine = makeEngine()
    engine.scriptBegin('brush', 0.1, 0.2, 0.5, false, undefined, 0, 0, widthScale)
    return engine
  }

  it('writes the factor onto the sample queued by scriptBegin', () => {
    expect(beginWith(1.8).queue[0]!.w).toBe(1.8)
  })

  it('clamps the factor into the published 0.2..20 range and defaults a non-finite one to 1', () => {
    expect(beginWith(ANCHOR_WIDTH_MAX + 1).queue[0]!.w).toBe(ANCHOR_WIDTH_MAX)
    expect(beginWith(ANCHOR_WIDTH_MAX).queue[0]!.w).toBe(ANCHOR_WIDTH_MAX)
    expect(beginWith(10).queue[0]!.w).toBe(10)
    expect(beginWith(0.05).queue[0]!.w).toBe(0.2)
    expect(beginWith(Number.NaN).queue[0]!.w).toBe(1)
    expect(beginWith(Number.POSITIVE_INFINITY).queue[0]!.w).toBe(1)
  })

  it("stamps each sample at its own width, never at the last one set", () => {
    const engine = makeEngine()
    engine.scriptBegin('brush', 0.1, 0.2, 0.5, false, undefined, 0, 0, 1)
    engine.scriptMove(0.2, 0.2, 0.5, 1, 0, 0, 1.8)
    expect(engine.queue.map((sample) => sample.w)).toEqual([1, 1.8])
  })

  it('starts the active stroke width ramp at 1', () => {
    const engine = beginWith(1)
    expect(engine.stroke!.widthFrom).toBe(1)
    expect(engine.stroke!.widthTo).toBe(1)
  })

  it('advances the ramp from the consumed sample, not from a mutable script field', () => {
    // The factor rides the queued sample; engine state only ever holds the
    // pair of the segment being deposited. A field set by the caller would
    // stamp a queued sample with a later sample's width once the queue drains.
    expect(ENGINE_SOURCE.includes('s.widthFrom = s.widthTo')).toBe(true)
    expect(ENGINE_SOURCE.includes('s.widthTo = q.w')).toBe(true)
    expect(ENGINE_SOURCE.includes('private scriptWidth')).toBe(false)
  })
})

describe('between two samples the factor interpolates (61-04)', () => {
  it('ramps linearly along the segment and holds its ends instead of extrapolating', () => {
    const engine = makeEngine()
    expect(typeof engine.widthFactorAt).toBe('function')
    const ramp = { pointerId: -1, widthFrom: 1, widthTo: 1.8 }
    expect(engine.widthFactorAt(ramp, 0)).toBe(1)
    expect(engine.widthFactorAt(ramp, 0.25)).toBeCloseTo(1.2, 12)
    expect(engine.widthFactorAt(ramp, 0.5)).toBeCloseTo(1.4, 12)
    expect(engine.widthFactorAt(ramp, 1)).toBeCloseTo(1.8, 12)
    // out of range: nearest end, always finite (VEC-03 unclassified)
    expect(engine.widthFactorAt(ramp, 2)).toBeCloseTo(1.8, 12)
    expect(engine.widthFactorAt(ramp, -1)).toBe(1)
    expect(Number.isFinite(engine.widthFactorAt(ramp, 0.37))).toBe(true)
  })
})

describe('scriptScale keeps its own meaning (C-03 prohibition)', () => {
  const ASSIGNMENT =
    'this.scriptScale = maxRadius ? Math.min(1, maxRadius / this.radius(tool, 1, 0)) : 1;'

  it('keeps the footprint clamp assignment character-for-character, with no second writer', () => {
    expect(ENGINE_SOURCE.split(ASSIGNMENT).length - 1).toBe(1)
    expect(ENGINE_SOURCE.match(/this\.scriptScale\s*=/g)?.length ?? 0).toBe(1)
    expect(ENGINE_SOURCE.match(/Math\.min\(1, maxRadius/g)?.length ?? 0).toBe(1)
  })

  it('still caps a scripted maxRadius at 1x — the clamp is untouched by the new channel', () => {
    const engine = makeEngine()
    engine.radius = () => 10
    engine.scriptBegin('brush', 0, 0, 0.5, false, 20)
    expect(engine.scriptScale).toBe(1)

    const half = makeEngine()
    half.radius = () => 10
    half.scriptBegin('brush', 0, 0, 0.5, false, 5)
    expect(half.scriptScale).toBe(0.5)
  })
})
