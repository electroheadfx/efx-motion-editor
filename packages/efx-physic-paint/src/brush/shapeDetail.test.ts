// ============================================================
//  R10 shape-detail pins (260930-detail — fractal brush-shape noise)
//
//  Law source: USER DESIGN ACT 2026-09-30e
//  (SPECS/real-paint/01-brush-footprint.md R10 + R8 scope note):
//  shape detail deforms the BRUSH SHAPE (the outline, not the pixels);
//  the noise follows the stroke shape (arc-space); amplitude is
//  modulated by width/pressure (260927-ton) and velocity; draws are
//  seeded on traceSeed (held-pose determinism law).
//
//  Look-continuity (R9's amplitude-not-presence here): the deform
//  pipeline ALWAYS runs — variance 0 = identity displacement, never a
//  different rendering.
//
//  R8 scope note: source-shape geometry is NOT bound by pressure-max-
//  width — the torn edge may spill outside the pressure ribbon
//  (image 154). The 260929-t2o capsule-sweep RASTER is untouched.
//
//  Control expectation at base (pre-GREEN): gauss/seededRng/wiring/
//  default pins fail on clean AssertionErrors; the variance/velocity
//  behavioral pins fail because the logs are still identical. Zero
//  crashes. That failure IS the RED evidence.
// ============================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gauss } from '../util/math'
import * as traceSeedNs from '../util/traceSeed'
import * as strokeNs from './stroke'
import { drawBristleFootprint } from './paint'
import type { PenPoint } from '../types'

const traceApi = traceSeedNs as Record<string, unknown>

const paintSrc = readFileSync(new URL('./paint.ts', import.meta.url), 'utf8')
const eraseSrc = readFileSync(new URL('./erase.ts', import.meta.url), 'utf8')
const strokeSrc = readFileSync(new URL('./stroke.ts', import.meta.url), 'utf8')
const engineSrc = readFileSync(new URL('../engine/EfxPaintEngine.ts', import.meta.url), 'utf8')
const appSettingsSrc = readFileSync(
  new URL('../../../../app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts', import.meta.url),
  'utf8',
)

function countOcc(s: string, needle: string): number {
  let n = 0
  let i = 0
  while ((i = s.indexOf(needle, i)) !== -1) {
    n++
    i += needle.length
  }
  return n
}

function straightCurve(p: number, spd: number): PenPoint[] {
  return Array.from({ length: 41 }, (_, i) => ({
    x: 10 + i * 10, y: 20, p, tx: 0, ty: 0, tw: 0, spd,
  }))
}

function recordingCanvas(log: string[]) {
  const ctx: Record<string, unknown> = {
    canvas: { width: 0, height: 0 },
    save: () => log.push('save'),
    restore: () => log.push('restore'),
    beginPath: () => log.push('begin'),
    closePath: () => log.push('close'),
    moveTo: (x: number, y: number) => log.push(`m:${x.toFixed(4)},${y.toFixed(4)}`),
    lineTo: (x: number, y: number) => log.push(`l:${x.toFixed(4)},${y.toFixed(4)}`),
    fill: () => log.push('fill'),
    stroke: () => log.push('stroke'),
    translate: () => log.push('translate'),
  }
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement
}

function footprintRun(
  curve: PenPoint[],
  radius: number,
  mutationId: number,
  variance: number,
): string[] {
  const log: string[] = []
  drawBristleFootprint(
    curve,
    {
      ctx: recordingCanvas(log).getContext('2d') as unknown as CanvasRenderingContext2D,
      radius,
      color: '#336699',
      opac: 1,
      hasPenInput: true,
      mutationId,
      variance,
    } as Parameters<typeof drawBristleFootprint>[1],
    'final',
  )
  return log
}

function lateralExtent(log: string[]): number {
  let maxAbs = 0
  for (const entry of log) {
    if (!entry.startsWith('m:') && !entry.startsWith('l:')) continue
    const [, xy] = entry.split(':')
    const y = Number(xy.split(',')[1])
    // straightCurve sits at y = 20 — lateral deviation from the centreline
    maxAbs = Math.max(maxAbs, Math.abs(y - 20))
  }
  return maxAbs
}

describe('R10 shape detail (260930-detail — fractal brush-shape noise)', () => {
  it('gauss-draws-from-rng: gauss consumes an injected rng (two Box-Muller draws per call)', () => {
    let calls = 0
    const rng = () => {
      calls++
      return 0.5
    }
    // The rng parameter is this quick's addition — cast so tsc is clean at RED.
    const gaussWithRng = gauss as unknown as (mean: number, stddev: number, r: () => number) => number
    gaussWithRng(0, 2, rng)
    expect(calls).toBe(2)
  })

  it('seededRng-on-traceSeed: seededRng is exported and deterministic per (strokeSeed, streamKey)', () => {
    expect(typeof traceApi.seededRng).toBe('function')
    const seededRng = traceApi.seededRng as (seed: number, key: string) => () => number
    const a = seededRng(42, 'shape-detail')
    const b = seededRng(42, 'shape-detail')
    const c = seededRng(42, 'erase-shape')
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    const seqC = [c(), c(), c()]
    expect(seqA).toEqual(seqB)
    expect(seqA).not.toEqual(seqC)
  })

  it('deform-wired-into-footprint: drawBristleFootprint deforms the ribbon contour via deformSampleSides (variance is a FootprintParams field)', () => {
    expect(countOcc(paintSrc, 'deformSampleSides(')).toBe(1)
    expect(paintSrc).toMatch(/variance\?: number/)
    expect(strokeSrc).toContain('export function deformSampleSides')
  })

  it('variance-scales-amplitude: the same stroke at variance 20 differs from variance 0 (variance reaches the drawn outline, not just curveBounds)', () => {
    const curve = straightCurve(1, 0)
    const log0 = footprintRun(curve, 20, 7, 0)
    const log20 = footprintRun(curve, 20, 7, 20)
    expect(log20).not.toEqual(log0)
  })

  it('velocity-scales-amplitude: amplitude rises with spd (fast stroke = more torn edge)', () => {
    const slow = footprintRun(straightCurve(1, 0), 20, 7, 20)
    const fast = footprintRun(straightCurve(1, 300), 20, 7, 20)
    expect(fast).not.toEqual(slow)
    expect(lateralExtent(fast)).toBeGreaterThan(lateralExtent(slow))
  })

  it('look-continuity-presence: the deform pipeline runs at variance 0 (identity displacement, never a different rendering)', () => {
    // presence pin: the call site is unconditional — never `if (variance > 0)`
    expect(paintSrc).not.toMatch(/if \(variance/)
    const curve = straightCurve(1, 0)
    // variance 0 = identity displacement: the outline stays on the ribbon
    const log0 = footprintRun(curve, 20, 7, 0)
    expect(lateralExtent(log0)).toBeLessThanOrEqual(20 * 1 + 2)
  })

  it('deform-draws-seeded: paint and erase deform draws come from traceSeed seededRng (held-pose determinism)', () => {
    expect(countOcc(paintSrc, 'seededRng(')).toBe(1)
    expect(countOcc(eraseSrc, 'seededRng(')).toBeGreaterThanOrEqual(1)
  })

  it('default-20: edgeDetail default is 20 at the engine and at app settings (tuned look default, 260930-ni6)', () => {
    expect(engineSrc).toContain('edgeDetail: 20')
    expect(appSettingsSrc).toContain('edgeDetail: 20')
  })

  it('held-pose-byte-identical: same mutationId + curve + variance replays byte-identical (stop-motion law)', () => {
    const curve = straightCurve(1, 0)
    const first = footprintRun(curve, 20, 7, 20)
    const second = footprintRun(curve, 20, 7, 20)
    expect(second).toEqual(first)
  })

  it('unseeded-deform-absent: zero Math.random() calls in the deform path (paint / erase / stroke)', () => {
    expect(countOcc(paintSrc, 'Math.random()')).toBe(0)
    expect(countOcc(eraseSrc, 'Math.random()')).toBe(0)
    expect(countOcc(strokeSrc, 'Math.random()')).toBe(0)
  })
})
