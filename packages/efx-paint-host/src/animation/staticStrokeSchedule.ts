import type { StudioStroke, FrameStroke } from './types'

export type StaticStrokeTransform<P = unknown> = (
  stroke: StudioStroke<P>,
  frameIndex: number,
  strokeIndex: number,
) => StudioStroke<P>

export interface StaticStrokeFrame<P = unknown> {
  stroke: StudioStroke<P>
  pointCount: number
}

/** Build the static/hold schedule: every stroke held complete on every frame. */
export function buildStaticStrokeSchedule<P = unknown>(
  strokes: readonly StudioStroke<P>[],
  frameCount: number,
): FrameStroke<P>[] {
  const usableFrames = Math.max(1, Math.trunc(frameCount))
  if (strokes.length === 0) return []

  return strokes.map((stroke) => ({
    stroke,
    startFrame: 0,
    endFrame: usableFrames - 1,
    pointsPerFrame: stroke.pts.length,
  }))
}

/** Reveal one frame from a static schedule: every stroke at full pointCount. */
export function getStaticFrameStrokes<P = unknown>(
  schedule: readonly FrameStroke<P>[],
  frameIndex: number,
  transform?: StaticStrokeTransform<P>,
): StaticStrokeFrame<P>[] {
  const strokes: StaticStrokeFrame<P>[] = []

  for (let strokeIndex = 0; strokeIndex < schedule.length; strokeIndex += 1) {
    const entry = schedule[strokeIndex]
    strokes.push({
      stroke: transform?.(entry.stroke, frameIndex, strokeIndex) ?? entry.stroke,
      pointCount: entry.stroke.pts.length,
    })
  }

  return strokes
}
