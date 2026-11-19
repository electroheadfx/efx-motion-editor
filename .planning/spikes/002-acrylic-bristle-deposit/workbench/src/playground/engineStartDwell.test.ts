// ============================================================
//  engineStartDwell — the stroke's FIRST tick never dwell-stamps.
//
//  quick 261116-rp (apply parity): the tick that starts a stroke
//  already deposits its first dab. The old "resting in place" rule
//  also stamped a dwell on that same tick, a SECOND impression of
//  the stroke origin at the sim-pressure radius. Live usually hid
//  it (the first frame drains pointerdown + the first moves), but
//  the scripted feed — one sample per tick — always exposed it, so
//  a texture tip was stamped twice and every applied word doubled.
//
//  No WebGL2 here: a prototype-created engine with hand-seeded
//  fields and stubbed stamp/trace sinks, the engineScriptWidth law.
// ============================================================

import { describe, expect, it } from 'vitest'
import { WatercolorEngine } from './Engine'

interface StampCall {
  x: number
  y: number
  moving: number
  dt: number
}

interface Harness {
  stroke: Record<string, unknown> | null
  queue: Array<Record<string, number>>
  stampCalls: StampCall[]
  traceCalls: unknown[][]
  processInput: (dt: number) => void
}

function stroke(started: boolean): Record<string, unknown> {
  return {
    pointerId: -1,
    pointerType: 'pen',
    tool: 'brush',
    started,
    ending: false,
    x: 0.5,
    y: 0.5,
    cx: 0.5,
    cy: 0.5,
    pr: 0.5,
    t: 0,
    speed: 0,
    simPressure: 0.45,
    carry: 0,
    travelled: 0,
    moved: false,
    dx: 0,
    dy: 1,
    angle: 0,
    azimuth: null,
    widthFrom: 1,
    widthTo: 1,
    pigFrom: null,
    pigTo: null,
  }
}

function harness(seed: Record<string, unknown>, queue: Array<Record<string, number>>): Harness {
  const engine = Object.create(WatercolorEngine.prototype) as unknown as Harness & Record<string, unknown>
  engine.dw = 1
  engine.dh = 1
  engine.clock = () => 16
  engine.schedule = () => undefined
  engine.stroke = seed
  engine.queue = queue
  engine.stampCalls = []
  engine.traceCalls = []
  // The deposit sink AND the curve tracer are stubbed: this file pins the
  // INPUT law (whether a dab/dwell happens), not the stamp shader.
  engine.stampScripted = function (
    this: unknown, _s: unknown, x: number, y: number,
    _pr: number, _vx: number, _vy: number, moving: number, dt: number,
  ) {
    engine.stampCalls.push({ x, y, moving, dt })
  }
  engine.trace = function (this: unknown, ...args: unknown[]) {
    engine.traceCalls.push(args)
  }
  return engine as unknown as Harness
}

const sample = (x: number, y: number) => ({ x, y, p: 0.6, t: 16, tx: 0, ty: 0, w: 1 })

describe('quick 261116-rp start-dwell law', () => {
  it('the tick that STARTS a stroke deposits its first dab only — no same-tick dwell', () => {
    const engine = harness(stroke(false), [sample(0.5, 0.5)])
    engine.processInput(1 / 60)
    expect(engine.stampCalls).toEqual([{ x: 0.5, y: 0.5, moving: 1, dt: 0 }])
  })

  it('a later idle tick still dwells — resting is a NEXT-tick law', () => {
    const engine = harness(stroke(true), [])
    engine.processInput(1 / 60)
    expect(engine.stampCalls).toEqual([{ x: 0.5, y: 0.5, moving: 0, dt: 1 / 60 }])
  })

  it('a moving tick traces and never dwell-stamps', () => {
    const engine = harness(stroke(true), [sample(0.7, 0.5)])
    engine.processInput(1 / 60)
    expect(engine.traceCalls).toHaveLength(1)
    expect(engine.stampCalls).toEqual([])
  })
})
