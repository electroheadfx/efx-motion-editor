// ============================================================
//  Erase pointer-delete (261003-ud9) — CURSOR GLYPH cell
//
//  - CURSOR GLYPH: with a recording 2D context, drawBrushCursor in pointer
//    mode draws the pointing-hand polyline with the dual dark/white treatment
//    (two offset passes), while brush mode still draws the ring/crosshair as
//    today.
// ============================================================

import { describe, expect, it } from 'vitest'
import { drawBrushCursor } from './canvas'

type RecordedCall = { op: string; fillStyle?: string; strokeStyle?: string; lineWidth?: number; x?: number; y?: number }

function recordingCtx() {
  const calls: RecordedCall[] = []
  let fillStyle = ''
  let strokeStyle = ''
  let lineWidth = 1
  const ctx = {
    get fillStyle() { return fillStyle },
    set fillStyle(v: string) { fillStyle = v },
    get strokeStyle() { return strokeStyle },
    set strokeStyle(v: string) { strokeStyle = v },
    get lineWidth() { return lineWidth },
    set lineWidth(v: number) { lineWidth = v },
    save() { calls.push({ op: 'save' }) },
    restore() { calls.push({ op: 'restore' }) },
    setLineDash() { calls.push({ op: 'setLineDash' }) },
    beginPath() { calls.push({ op: 'beginPath' }) },
    closePath() { calls.push({ op: 'closePath' }) },
    moveTo(x: number, y: number) { calls.push({ op: 'moveTo', x, y }) },
    lineTo(x: number, y: number) { calls.push({ op: 'lineTo', x, y }) },
    arc(_cx: number, _cy: number, _r: number) { calls.push({ op: 'arc' }) },
    stroke() { calls.push({ op: 'stroke', strokeStyle, lineWidth }) },
    fill() { calls.push({ op: 'fill', fillStyle }) },
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const DARK = 'rgba(17,17,17,0.9)'
const LIGHT = 'rgba(255,255,255,0.95)'

describe('drawBrushCursor glyph modes', () => {
  it('CURSOR GLYPH: pointer mode draws the pointing-hand polyline with the dual dark/white treatment (two offset passes)', () => {
    const { ctx, calls } = recordingCtx()

    drawBrushCursor(ctx, 40, 25, 6, 'erase', 100, 100, 'pointer')

    const fills = calls.filter((c) => c.op === 'fill')
    const strokes = calls.filter((c) => c.op === 'stroke')
    // Hand only — the brush ring must not appear in pointer mode.
    expect(calls.some((c) => c.op === 'arc')).toBe(false)
    // Two offset passes: dark under-pass (outline + fill), then white over-pass.
    expect(fills.length).toBe(2)
    expect(fills[0].fillStyle).toBe(DARK)
    expect(fills[1].fillStyle).toBe(LIGHT)
    expect(strokes.length).toBeGreaterThanOrEqual(1)
    expect(strokes[0].strokeStyle).toBe(DARK)
    expect(strokes[0].lineWidth).toBe(3)
    // Fingertip anchored exactly at the cursor point, body extending down (thumb left, knuckles right).
    expect(calls[0]).toBeDefined()
    const firstMove = calls.find((c) => c.op === 'moveTo')
    expect(firstMove).toMatchObject({ x: 40, y: 25 })
    expect(calls.some((c) => c.op === 'lineTo' && (c.y ?? 0) > 25)).toBe(true)
    expect(calls.some((c) => c.op === 'lineTo' && (c.x ?? 0) > 40)).toBe(true)
  })

  it('CURSOR GLYPH: brush mode keeps the ring/crosshair as today (default argument = brush)', () => {
    // radius >= 4 → dual ring, no fills
    const ring = recordingCtx()
    drawBrushCursor(ring.ctx, 40, 25, 6, 'erase', 100, 100, 'brush')
    expect(ring.calls.some((c) => c.op === 'arc')).toBe(true)
    expect(ring.calls.filter((c) => c.op === 'fill')).toHaveLength(0)
    const ringStrokes = ring.calls.filter((c) => c.op === 'stroke')
    expect(ringStrokes.some((c) => c.strokeStyle === DARK)).toBe(true)
    expect(ringStrokes.some((c) => c.strokeStyle === LIGHT)).toBe(true)

    // radius < 4 → dual crosshair, no fills
    const cross = recordingCtx()
    drawBrushCursor(cross.ctx, 40, 25, 2, 'erase', 100, 100, 'brush')
    expect(cross.calls.some((c) => c.op === 'arc')).toBe(false)
    expect(cross.calls.filter((c) => c.op === 'fill')).toHaveLength(0)
    expect(cross.calls.filter((c) => c.op === 'stroke').length).toBeGreaterThan(0)

    // Omitted mode argument stays brush (back-compat with every existing caller).
    const legacy = recordingCtx()
    drawBrushCursor(legacy.ctx, 40, 25, 6, 'erase', 100, 100)
    expect(legacy.calls.some((c) => c.op === 'arc')).toBe(true)
    expect(legacy.calls.filter((c) => c.op === 'fill')).toHaveLength(0)
  })
})
