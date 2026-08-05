import type { PaintStroke } from '../types'
import type { FrameStroke } from './types'

export type StaticStrokeTransform = (
  stroke: PaintStroke,
  frameIndex: number,
  strokeIndex: number,
) => PaintStroke

export interface StaticStrokeFrame {
  stroke: PaintStroke
  pointCount: number
}

/** Build the static/hold schedule: every stroke held complete on every frame. */
export function buildStaticStrokeSchedule(
  strokes: readonly PaintStroke[],
  frameCount: number,
): FrameStroke[] {
  const usableFrames = Math.max(1, Math.trunc(frameCount))
  if (strokes.length === 0) return []

  return strokes.map((stroke) => ({
    stroke,
    startFrame: 0,
    endFrame: usableFrames - 1,
    pointsPerFrame: stroke.points.length,
  }))
}

/** Reveal one frame from a static schedule: every stroke at full pointCount. */
export function getStaticFrameStrokes(
  schedule: readonly FrameStroke[],
  frameIndex: number,
  transform?: StaticStrokeTransform,
): StaticStrokeFrame[] {
  const strokes: StaticStrokeFrame[] = []

  for (let strokeIndex = 0; strokeIndex < schedule.length; strokeIndex += 1) {
    const entry = schedule[strokeIndex]
    strokes.push({
      stroke: transform?.(entry.stroke, frameIndex, strokeIndex) ?? entry.stroke,
      pointCount: entry.stroke.points.length,
    })
  }

  return strokes
}
