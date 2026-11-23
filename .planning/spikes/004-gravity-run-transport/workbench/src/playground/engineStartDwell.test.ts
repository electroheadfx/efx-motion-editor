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

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WatercolorEngine } from './Engine'

const ENGINE_SOURCE = readFileSync(resolve(__dirname, 'Engine.ts'), 'utf8')

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

function harness(seed: Record<string, unknown>, queue: Array<Record<string, number>>, brushId = 'flat'): Harness {
  const engine = Object.create(WatercolorEngine.prototype) as unknown as Harness & Record<string, unknown>
  engine.dw = 1
  engine.dh = 1
  engine.clock = () => 16
  engine.schedule = () => undefined
  engine.stroke = seed
  engine.queue = queue
  // The classic response keeps the start-dwell law; a BRISTLE response never
  // dwells (2026-11-20: the full-dab-per-tick end cap the artist reported).
  engine.brush = { id: brushId }
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

  it('a BRISTLE brush never dwell-stamps — the artist’s release cap', () => {
    const engine = harness(stroke(true), [], 'bristle-flat')
    for (let tick = 0; tick < 4; tick += 1) engine.processInput(1 / 60)
    expect(engine.stampCalls).toEqual([])
  })

  // 2026-11-20 (the artist's pen cap): a tablet pen keeps reporting moves
  // after the nib leaves the glass — pressure 0, no buttons — before
  // pointerup. pushSample's 0 -> 0.5 fallback painted them, so sweeping the
  // hand away after the intended end stamped an isolated second impression.
  // No contact must END the stroke, never paint the hover path.
  it('ends the stroke on a tablet hover move instead of painting it', () => {
    // Buttons — not pressure — is the contact test: WKWebView's 0.5 pressure
    // sentinel and a lingering native pressure both make pressure lie. The
    // guard also covers tablet events that arrive as pointerType 'mouse'
    // (native pressure injected by the host), which a pen-only check missed.
    expect(ENGINE_SOURCE).toContain("const tabletInput = s.pointerType === 'pen' || this.pencilSeen")
    expect(ENGINE_SOURCE).toContain('if (tabletInput && s.buttons === 0) {')
    expect(ENGINE_SOURCE).toContain('this.stroke.ending = true;')
    const hoverAt = ENGINE_SOURCE.indexOf('if (tabletInput && s.buttons === 0) {')
    const pushAt = ENGINE_SOURCE.indexOf('this.pushSample(s);', hoverAt)
    expect(hoverAt, 'the hover guard exists').toBeGreaterThan(-1)
    expect(pushAt, 'the hover guard sits before the sample is queued').toBeGreaterThan(hoverAt)
  })
})
