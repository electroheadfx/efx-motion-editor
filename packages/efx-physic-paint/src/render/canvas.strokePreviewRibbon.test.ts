// ============================================================
//  RED-first pins — quick 260924-koa (stroke preview as pressure var)
//  Live preview must FILL the ribbon polygon (pressure-varying width),
//  queued strokes must render as their own sized ribbon, and the
//  clear-on-commit sequence must leave only the queued fill.
// ============================================================

import { describe, expect, it, vi } from 'vitest'
import { drawQueuedStrokePolyline, drawStrokePreview, type StrokePreview } from './canvas'
import { EfxPaintEngine } from '../engine/EfxPaintEngine'
import type { PenPoint } from '../types'

type EngineInternals = EfxPaintEngine & Record<string, any>

type PathVertex = [number, number]

type FillSnapshot = {
  verts: PathVertex[]
  fillStyle: string
  globalAlpha: number
}

type RecordedEvent = { type: 'fill' | 'stroke' | 'clear' }

function createRecordingCtx() {
  let path: PathVertex[] = []
  const fills: FillSnapshot[] = []
  const strokes: PathVertex[][] = []
  const dashes: number[][] = []
  const events: RecordedEvent[] = []

  const ctx = {
    lineWidth: 1,
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineDashOffset: 0,
    beginPath: vi.fn(() => {
      path = []
    }),
    moveTo: vi.fn((x: number, y: number) => {
      path = [[x, y]]
    }),
    lineTo: vi.fn((x: number, y: number) => {
      path.push([x, y])
    }),
    closePath: vi.fn(),
    fill: vi.fn(() => {
      fills.push({
        verts: path.map(([x, y]) => [x, y] as PathVertex),
        fillStyle: ctx.fillStyle,
        globalAlpha: ctx.globalAlpha,
      })
      events.push({ type: 'fill' })
    }),
    stroke: vi.fn(() => {
      strokes.push(path.map(([x, y]) => [x, y] as PathVertex))
      events.push({ type: 'stroke' })
    }),
    setLineDash: vi.fn((dash: number[]) => {
      dashes.push(dash)
    }),
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(() => {
      events.push({ type: 'clear' })
    }),
  }

  return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, strokes, dashes, events }
}

function pt(x: number, y: number, p: number): PenPoint {
  return { x, y, p, tx: 0, ty: 0, tw: 0, spd: 0 }
}

/** Horizontal line with varying pen pressure (Leg 1/2 geometry). */
function penLine(): PenPoint[] {
  return [
    pt(10, 50, 0.2),
    pt(30, 50, 0.4),
    pt(50, 50, 0.9),
    pt(70, 50, 1.0),
    pt(90, 50, 0.5),
    pt(110, 50, 0.8),
  ]
}

/**
 * ribbon() returns [...L, ...R.reverse()], so pairing L_i with R_i means
 * poly[i] against poly[2N-1-i] — full cross-ribbon width per curve sample.
 */
function ribbonWidths(fill: FillSnapshot): number[] {
  const v = fill.verts
  const n = v.length / 2
  const widths: number[] = []
  for (let i = 0; i < n; i++) {
    const l = v[i]
    const r = v[2 * n - 1 - i]
    widths.push(Math.hypot(l[0] - r[0], l[1] - r[1]))
  }
  return widths
}

const basePreview = (): StrokePreview => ({
  pts: penLine(),
  color: '#123456',
  opacity: 0.8,
  radius: 10,
  hasPenInput: true,
})

const queuedStyle = { radius: 10, hasPenInput: true, color: '#123456', opacity: 0.8 } as const

const queuedPoints = (): PenPoint[] => [
  pt(10, 50, 1),
  pt(40, 50, 1),
  pt(70, 50, 1),
  pt(100, 50, 1),
]

describe('stroke preview ribbon — filled, pressure-varying, sized queue', () => {
  it('Leg 1: live preview fills the ribbon polygon — zero stroke()/setLineDash() on the preview path', () => {
    const { ctx, fills, strokes, dashes } = createRecordingCtx()

    drawStrokePreview(ctx, basePreview())

    expect(fills.length).toBeGreaterThanOrEqual(1)
    expect(strokes.length).toBe(0)
    expect(dashes.length).toBe(0)
    expect(fills[0].fillStyle).toBe('#123456')
    expect(fills[0].globalAlpha).toBeCloseTo(0.8)
  })

  it('Leg 2: fill width tracks per-point pressure — pen run thins where p is low, uniform run does not', () => {
    const penRun = createRecordingCtx()
    const uniRun = createRecordingCtx()

    drawStrokePreview(penRun.ctx, { ...basePreview(), hasPenInput: true })
    drawStrokePreview(uniRun.ctx, { ...basePreview(), hasPenInput: false })

    expect(penRun.fills.length).toBeGreaterThanOrEqual(1)
    expect(uniRun.fills.length).toBeGreaterThanOrEqual(1)

    const penW = ribbonWidths(penRun.fills[0])
    const uniW = ribbonWidths(uniRun.fills[0])
    expect(penW.length).toBe(uniW.length)

    // Same index, both runs: where the pen run is thinnest (low-pressure head
    // sample, p=0.2), the uniform run must be at least 2x wider — pressure
    // feeds the fill geometry, not a constant lineWidth.
    let iMin = 0
    for (let i = 1; i < penW.length; i++) if (penW[i] < penW[iMin]) iMin = i
    expect(uniW[iMin]).toBeGreaterThanOrEqual(2 * penW[iMin])

    // The thick/thin variation is visible along the pen stroke itself.
    const penMax = Math.max(...penW)
    const penMin = Math.min(...penW)
    expect(penMax).toBeGreaterThanOrEqual(2 * penMin)

    expect(penRun.fills[0].fillStyle).toBe('#123456')
    expect(penRun.fills[0].globalAlpha).toBeCloseTo(0.8)
  })

  it('Leg 3: queued stroke draws its own sized filled ribbon (radius 10 → ≥5px off-centerline)', () => {
    const { ctx, fills, strokes, dashes } = createRecordingCtx()

    drawQueuedStrokePolyline(ctx, queuedPoints(), queuedStyle)

    expect(fills.length).toBeGreaterThanOrEqual(1)
    expect(strokes.length).toBe(0)
    expect(dashes.length).toBe(0)
    expect(fills[0].fillStyle).toBe('#123456')
    expect(fills[0].globalAlpha).toBeCloseTo(0.8)

    const maxDev = Math.max(...fills[0].verts.map(([, y]) => Math.abs(y - 50)))
    expect(maxDev).toBeGreaterThanOrEqual(5)
  })

  it('Leg 4: clear-on-commit sequence — after composite clear, only the queued ribbon fill remains', () => {
    const { ctx, fills, events } = createRecordingCtx()

    drawStrokePreview(ctx, basePreview())
    expect(fills.length).toBeGreaterThanOrEqual(1)

    // Commit path, exactly as the engine drives it:
    ctx.clearRect(0, 0, 120, 80) // compositeDisplayNow starts with this clear
    drawStrokePreview(ctx, null) // pointer-up cleared previewStroke
    drawQueuedStrokePolyline(ctx, queuedPoints(), queuedStyle)

    const lastClear = events.map((e) => e.type).lastIndexOf('clear')
    expect(lastClear).toBeGreaterThanOrEqual(0)
    const afterClear = events.slice(lastClear + 1)
    expect(afterClear.filter((e) => e.type === 'fill')).toHaveLength(1)
    expect(afterClear.filter((e) => e.type === 'stroke')).toHaveLength(0)
  })

  it('Leg 5: engine control — pointer-up clears previewStroke (the restore path depends on it)', () => {
    const engine = Object.create(EfxPaintEngine.prototype) as EngineInternals
    Object.assign(engine, {
      state: { drawing: true, tool: 'paint', hasPenInput: false, physicsMode: null, brushOpts: { size: 12, opacity: 100 } },
      width: 100,
      height: 100,
      previewStroke: {
        pts: [pt(10, 10, 0.5), pt(11, 10, 0.5), pt(12, 10, 0.5)],
        color: '#123456',
        radius: 6,
        opacity: 0.8,
      },
      rawPts: [pt(10, 10, 0.5), pt(11, 10, 0.5)],
      lastPointerSampleTimeStamp: Number.NEGATIVE_INFINITY,
      lastAcceptedPointerSampleTimeStamp: Number.NEGATIVE_INFINITY,
      lastNativePenInputTime: 0,
      nativePenInput: null,
      pendingExplicitPreviewBase: null,
      performanceListener: null,
      nextMutationId: 1,
      inputLocked: false,
      dualCanvas: {
        dryCanvas: {
          getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
          releasePointerCapture: vi.fn(),
        },
      },
      onInputActivity: undefined,
      getStrokeMetadata: undefined,
      recordPerformance: vi.fn(),
    })

    const release = {
      clientX: 11, // maps onto the last raw point → dist < 1.5 → not appended
      clientY: 10,
      timeStamp: 30,
      pressure: 0.5,
      tiltX: 0,
      tiltY: 0,
      twist: 0,
      buttons: 0,
      pointerType: 'mouse',
      pointerId: 1,
      preventDefault: vi.fn(),
    } as unknown as PointerEvent

    engine.onPointerUp(release)

    expect(engine.previewStroke).toBeNull()
    expect(engine.state.drawing).toBe(false)
  })
})
