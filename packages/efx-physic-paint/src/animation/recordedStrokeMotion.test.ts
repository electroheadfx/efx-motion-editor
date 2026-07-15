import { describe, expect, it } from 'vitest'
import { transformRecordedStrokeForHeldPose } from './recordedStrokeMotion'
import type { PaintStroke } from '../types'

function makeStroke(): PaintStroke {
  return {
    mutationId: 91,
    tool: 'paint',
    points: [
      { x: 10, y: 20, p: 0.25, tx: 1, ty: 2, tw: 3, spd: 4 },
      { x: 30, y: 50, p: 0.75, tx: 5, ty: 6, tw: 7, spd: 8 },
    ],
    color: '#123456',
    params: {
      size: 9, opacity: 80, pressure: 70, waterAmount: 60, dryAmount: 30,
      edgeDetail: 12, pickup: 4, eraseStrength: 50, antiAlias: 2,
    },
    timestamp: 1234,
    hasPenInput: true,
    diffusionFrames: 6,
    playFrame: 8,
    physicsMode: 'local',
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

    expect(pose(10).points).toEqual(pose(11).points)
    expect(pose(12).points).not.toEqual(pose(10).points)
    expect(pose(12).points).toEqual(pose(12).points)
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

    expect(moved.points[1].x - moved.points[0].x).toBeCloseTo(stroke.points[1].x - stroke.points[0].x)
    expect(moved.points[1].y - moved.points[0].y).toBeCloseTo(stroke.points[1].y - stroke.points[0].y)
    expect(deformed.points[0].x - stroke.points[0].x).not.toBeCloseTo(deformed.points[1].x - stroke.points[1].x)
    expect(moved).toMatchObject({
      mutationId: 91,
      tool: 'paint',
      color: '#123456',
      params: stroke.params,
      timestamp: 1234,
      hasPenInput: true,
      diffusionFrames: 6,
      playFrame: 8,
      physicsMode: 'local',
    })
    expect(moved.points.map(({ p, tx, ty, tw, spd }) => ({ p, tx, ty, tw, spd }))).toEqual(
      stroke.points.map(({ p, tx, ty, tw, spd }) => ({ p, tx, ty, tw, spd })),
    )
    expect(moved.points).not.toBe(stroke.points)
    expect(moved.params).not.toBe(stroke.params)
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
    }).points).toEqual(maxed.points)
    expect(transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: Number.NaN,
      strokeIndex: 2,
      deformation: Number.NaN,
      position: Number.POSITIVE_INFINITY,
    })).toBe(stroke)
  })
})
