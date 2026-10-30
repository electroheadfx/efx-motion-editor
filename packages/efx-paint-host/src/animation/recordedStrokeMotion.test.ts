import { describe, expect, it } from 'vitest'
import { transformRecordedStrokeForHeldPose } from './recordedStrokeMotion'
import type { StudioStroke } from './types'

interface TestPayload {
  tool: string
  params: Record<string, number>
  hasPenInput: boolean
  diffusionFrames: number
  physicsMode: string | null
}

function makeStroke(): StudioStroke<TestPayload> {
  return {
    pts: [
      { x: 10, y: 20, p: 0.25, tx: 1, ty: 2, tw: 3, tick: 0 },
      { x: 30, y: 50, p: 0.75, tx: 5, ty: 6, tw: 7, tick: 1 },
    ],
    ticks: 1,
    cuisson: 6,
    motion: null,
    brushId: 'test-brush',
    toolOverrides: {},
    traceSeed: 91,
    recordedOrder: 1234,
    playFrame: 8,
    color: '#123456',
    engine: {
      tool: 'paint',
      params: {
        size: 9, opacity: 80, pressure: 70, waterAmount: 60, dryAmount: 30,
        edgeDetail: 12, pickup: 4, eraseStrength: 50, antiAlias: 2,
      },
      hasPenInput: true,
      diffusionFrames: 6,
      physicsMode: 'local',
    },
  }
}

describe('transformRecordedStrokeForHeldPose', () => {
  it('preserves source identity when Motion is zero', () => {
    const stroke = makeStroke()
    expect(transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 12,
      strokeIndex: 0,
      deformation: 0,
      position: 0,
    })).toBe(stroke)
    // 261030-ey9: the identity shortcut is ALL FOUR channels zero.
    expect(transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 12,
      strokeIndex: 0,
      deformation: 0,
      position: 0,
      rotation: 0,
      scale: 0,
    })).toBe(stroke)
  })

  it('261030-ey9: rotation-only poses about the stroke centroid even with zero deformation', () => {
    const stroke = makeStroke()
    const base = makeStroke()
    const centroid = {
      x: (base.pts[0].x + base.pts[1].x) / 2,
      y: (base.pts[0].y + base.pts[1].y) / 2,
    }
    const pose = (destinationSourceFrame: number) => transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame,
      strokeIndex: 5,
      deformation: 0,
      position: 0,
      rotation: 100,
      scale: 0,
    })
    const rotated = pose(10)

    // Centroid invariant: the rigid pass pivots on the stroke's own centroid.
    const rotatedCentroid = {
      x: (rotated.pts[0].x + rotated.pts[1].x) / 2,
      y: (rotated.pts[0].y + rotated.pts[1].y) / 2,
    }
    expect(rotatedCentroid.x).toBeCloseTo(centroid.x, 10)
    expect(rotatedCentroid.y).toBeCloseTo(centroid.y, 10)

    // Angle stays within ±10° and the transform is a similarity (length kept).
    const angle = Math.atan2(rotated.pts[1].y - rotated.pts[0].y, rotated.pts[1].x - rotated.pts[0].x)
      - Math.atan2(base.pts[1].y - base.pts[0].y, base.pts[1].x - base.pts[0].x)
    expect(Math.abs(angle)).toBeLessThanOrEqual((10 * Math.PI) / 180 + 1e-9)
    expect(Math.hypot(rotated.pts[1].x - rotated.pts[0].x, rotated.pts[1].y - rotated.pts[0].y))
      .toBeCloseTo(Math.hypot(base.pts[1].x - base.pts[0].x, base.pts[1].y - base.pts[0].y), 10)

    // Deterministic per (stroke, seed, held frame), different at the next hold step.
    expect(pose(10).pts).toEqual(pose(11).pts)
    expect(pose(12).pts).not.toEqual(pose(10).pts)
  })

  it('261030-ey9: scale-only is a uniform similarity within ±10 percent at 100, even with zero deformation', () => {
    const stroke = makeStroke()
    const base = makeStroke()
    const pose = (destinationSourceFrame: number) => transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame,
      strokeIndex: 2,
      deformation: 0,
      position: 0,
      rotation: 0,
      scale: 100,
    })
    const scaled = pose(6)
    const centroid = {
      x: (base.pts[0].x + base.pts[1].x) / 2,
      y: (base.pts[0].y + base.pts[1].y) / 2,
    }
    const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
    const baseDistance = distance(base.pts[0], centroid)
    const scaledDistance = distance(scaled.pts[0], centroid)
    const factor = scaledDistance / baseDistance
    expect(factor).toBeGreaterThanOrEqual(0.9 - 1e-9)
    expect(factor).toBeLessThanOrEqual(1.1 + 1e-9)
    // Uniform: the other point sits at the same factor from the centroid.
    expect(distance(scaled.pts[1], centroid) / distance(base.pts[1], centroid)).toBeCloseTo(factor, 10)
  })

  it('261030-ey9: deformation lands last — its per-point delta is unchanged by the rigid pass', () => {
    const stroke = makeStroke()
    const deformationOnly = transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 8,
      strokeIndex: 1,
      deformation: 80,
      position: 0,
    })
    const rigidOnly = transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 8,
      strokeIndex: 1,
      deformation: 0,
      position: 0,
      rotation: 60,
      scale: 70,
    })
    const combined = transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 8,
      strokeIndex: 1,
      deformation: 80,
      position: 0,
      rotation: 60,
      scale: 70,
    })
    for (let index = 0; index < stroke.pts.length; index += 1) {
      const deformationDelta = {
        x: deformationOnly.pts[index].x - stroke.pts[index].x,
        y: deformationOnly.pts[index].y - stroke.pts[index].y,
      }
      expect(combined.pts[index].x - rigidOnly.pts[index].x).toBeCloseTo(deformationDelta.x, 10)
      expect(combined.pts[index].y - rigidOnly.pts[index].y).toBeCloseTo(deformationDelta.y, 10)
    }
    // ...and at rotation = scale = 0 the deformation output is bit-identical to today.
    expect(transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 8,
      strokeIndex: 1,
      deformation: 80,
      position: 40,
      rotation: 0,
      scale: 0,
    }).pts).toEqual(transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 8,
      strokeIndex: 1,
      deformation: 80,
      position: 40,
    }).pts)
  })

  it('uses deterministic two-frame held poses keyed by destination real source frame', () => {
    const stroke = makeStroke()
    const pose = (destinationSourceFrame: number) => transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame,
      strokeIndex: 3,
      deformation: 80,
      position: 60,
    })

    expect(pose(10).pts).toEqual(pose(11).pts)
    expect(pose(12).pts).not.toEqual(pose(10).pts)
    expect(pose(12).pts).toEqual(pose(12).pts)
  })

  it('preserves Move spacing, varies Deform per point, and retains all metadata', () => {
    const stroke = makeStroke()
    const moved = transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 4,
      strokeIndex: 1,
      deformation: 0,
      position: 75,
    })
    const deformed = transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 4,
      strokeIndex: 1,
      deformation: 75,
      position: 0,
    })

    expect(moved.pts[1].x - moved.pts[0].x).toBeCloseTo(stroke.pts[1].x - stroke.pts[0].x)
    expect(moved.pts[1].y - moved.pts[0].y).toBeCloseTo(stroke.pts[1].y - stroke.pts[0].y)
    expect(deformed.pts[0].x - stroke.pts[0].x).not.toBeCloseTo(deformed.pts[1].x - stroke.pts[1].x)
    expect(moved).toMatchObject({
      recordedOrder: 1234,
      color: '#123456',
      playFrame: 8,
    })
    expect(moved.engine).toMatchObject({
      tool: 'paint',
      hasPenInput: true,
      diffusionFrames: 6,
      physicsMode: 'local',
    })
    expect(moved.engine.params).toBe(stroke.engine.params)
    expect(moved.pts.map(({ p, tx, ty, tw, tick }) => ({ p, tx, ty, tw, tick }))).toEqual(
      stroke.pts.map(({ p, tx, ty, tw, tick }) => ({ p, tx, ty, tw, tick })),
    )
    expect(moved.pts).not.toBe(stroke.pts)
  })

  it('clamps finite percentages and treats non-finite values as zero', () => {
    const stroke = makeStroke()
    const maxed = transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 6,
      strokeIndex: 2,
      deformation: 100,
      position: 100,
    })
    expect(transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: 6,
      strokeIndex: 2,
      deformation: 200,
      position: 200,
    }).pts).toEqual(maxed.pts)
    expect(transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: Number.NaN,
      strokeIndex: 2,
      deformation: Number.NaN,
      position: Number.POSITIVE_INFINITY,
    })).toBe(stroke)
  })
})
