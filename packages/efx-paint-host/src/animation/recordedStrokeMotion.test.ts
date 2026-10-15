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
