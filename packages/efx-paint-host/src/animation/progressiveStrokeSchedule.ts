import type { StudioStroke, FrameStroke } from './types'

export type ProgressiveStrokeTransform<P = unknown> = (
  stroke: StudioStroke<P>,
  frameIndex: number,
  strokeIndex: number,
) => StudioStroke<P>

export interface ProgressiveStrokeFrame<P = unknown> {
  stroke: StudioStroke<P>
  pointCount: number
}

/** Build the canonical progressive schedule shared by timed and offline playback. */
export function buildProgressiveStrokeSchedule<P = unknown>(
  strokes: readonly StudioStroke<P>[],
  frameCount: number,
): FrameStroke<P>[] {
  const usableFrames = Math.max(1, Math.trunc(frameCount))
  if (strokes.length === 0) return []

  const scheduledStrokes = orderStrokesForPlayback(strokes, usableFrames)
  const sourceAnchors = new Map(strokes.map((stroke) => [stroke, getPlayFrameAnchor(stroke, usableFrames)]))

  if (scheduledStrokes.length > usableFrames) {
    for (const scheduledStroke of scheduledStrokes) {
      if (scheduledStroke.playFrameAnchor === null) {
        scheduledStroke.playFrameAnchor = sourceAnchors.get(scheduledStroke.stroke) ?? null
      }
    }
    return scheduledStrokes.map(({ stroke, playFrameAnchor }, index) => {
      const startFrame = playFrameAnchor ?? Math.min(usableFrames - 1, Math.floor((index * (usableFrames + 1)) / scheduledStrokes.length))
      const endFrame = playFrameAnchor === null ? startFrame : usableFrames - 1
      const pointsPerFrame = Math.max(1, Math.ceil(stroke.pts.length / Math.max(1, endFrame - startFrame + 1)))
      return { stroke, startFrame, endFrame, pointsPerFrame }
    })
  }

  const weights = scheduledStrokes.map(({ stroke }) => Math.max(1, stroke.pts.length))
  const remainingWeights = new Array<number>(scheduledStrokes.length)
  let runningWeight = 0
  for (let index = scheduledStrokes.length - 1; index >= 0; index -= 1) {
    runningWeight += weights[index]
    remainingWeights[index] = runningWeight
  }

  let allocatedFrames = 0
  const playFrameCursors = new Map<number, number>()

  return scheduledStrokes.map(({ stroke, playFrameAnchor }, index) => {
    const remainingStrokeCount = scheduledStrokes.length - index
    const latestStartFrame = playFrameAnchor === null
      ? usableFrames - 1
      : Math.max(0, usableFrames - remainingStrokeCount)
    const requestedStartFrame = playFrameAnchor === null
      ? allocatedFrames
      : playFrameCursors.get(playFrameAnchor) ?? playFrameAnchor
    const startFrame = Math.min(usableFrames - 1, Math.min(requestedStartFrame, latestStartFrame))
    const remainingFrames = Math.max(1, usableFrames - startFrame)
    const remainingFrameBudget = playFrameAnchor === null
      ? Math.max(1, usableFrames - allocatedFrames)
      : remainingFrames
    const weightedExactFrames = (weights[index] / Math.max(1, remainingWeights[index])) * remainingFrameBudget
    let frameSpan = Math.max(1, Math.floor(weightedExactFrames))

    if (index === scheduledStrokes.length - 1) {
      frameSpan = remainingFrames
    } else if (playFrameAnchor !== null) {
      const laterStrokeCount = scheduledStrokes.length - index - 1
      const maxSpanBeforeLaterStrokes = Math.max(1, remainingFrames - laterStrokeCount)
      frameSpan = Math.min(frameSpan, maxSpanBeforeLaterStrokes)
    }

    const endFrame = Math.min(usableFrames - 1, startFrame + frameSpan - 1)
    allocatedFrames = Math.max(allocatedFrames, endFrame + 1)
    if (playFrameAnchor !== null) playFrameCursors.set(playFrameAnchor, endFrame + 1)
    const pointsPerFrame = Math.max(1, Math.ceil(stroke.pts.length / Math.max(1, endFrame - startFrame + 1)))
    return { stroke, startFrame, endFrame, pointsPerFrame }
  })
}

/** Reveal one cumulative frame from a schedule, with an optional render-time transform. */
export function getProgressiveFrameStrokes<P = unknown>(
  schedule: readonly FrameStroke<P>[],
  frameIndex: number,
  transform?: ProgressiveStrokeTransform<P>,
): ProgressiveStrokeFrame<P>[] {
  const finalFrame = schedule.length > 0 && frameIndex >= Math.max(...schedule.map((entry) => entry.endFrame))
  const strokes: ProgressiveStrokeFrame<P>[] = []

  for (let strokeIndex = 0; strokeIndex < schedule.length; strokeIndex += 1) {
    const entry = schedule[strokeIndex]
    if (entry.startFrame > frameIndex) continue

    const complete = finalFrame || entry.endFrame < frameIndex
    const framesIntoStroke = frameIndex - entry.startFrame + 1
    const pointCount = complete
      ? entry.stroke.pts.length
      : Math.min(entry.stroke.pts.length, entry.pointsPerFrame * framesIntoStroke)
    strokes.push({
      stroke: transform?.(entry.stroke, frameIndex, strokeIndex) ?? entry.stroke,
      pointCount,
    })
  }

  return strokes
}

type ScheduledStroke<P> = { stroke: StudioStroke<P>; sourceIndex: number; playFrameAnchor: number | null }

function orderStrokesForPlayback<P>(strokes: readonly StudioStroke<P>[], usableFrames: number): Array<{ stroke: StudioStroke<P>; playFrameAnchor: number | null }> {
  const scheduled = strokes.map((stroke, sourceIndex) => ({ stroke, sourceIndex, playFrameAnchor: getPlayFrameAnchor(stroke, usableFrames) }))
  const orderedByRecording = [...scheduled].sort(compareAnchoredPlaybackOrder)
  if (!hasSourceOrderInsertion(scheduled)) return orderedByRecording.map(({ stroke, playFrameAnchor }) => ({ stroke, playFrameAnchor }))

  const insertedSourceStart = getInsertedSourceStart(scheduled)
  const base = scheduled.filter(({ sourceIndex }) => sourceIndex < insertedSourceStart).sort(compareAnchoredPlaybackOrder)
  if (base.length === 0) return orderedByRecording.map(({ stroke, playFrameAnchor }) => ({ stroke, playFrameAnchor }))

  const playbackOrder = [...base]
  const appended = scheduled.filter(({ sourceIndex }) => sourceIndex >= insertedSourceStart).sort(comparePlayFrameInsertionOrder)
  const insertedByTarget = new Map<number, number>()

  for (const inserted of appended) {
    const targetIndex = getInsertionTargetIndex(inserted, playbackOrder, usableFrames)
    const offset = inserted.playFrameAnchor === null ? 0 : insertedByTarget.get(targetIndex) ?? 0
    playbackOrder.splice(targetIndex + offset, 0, inserted)
    if (inserted.playFrameAnchor !== null) insertedByTarget.set(targetIndex, offset + 1)
  }

  return playbackOrder.map(({ stroke }) => ({ stroke, playFrameAnchor: null }))
}

function hasSourceOrderInsertion<P>(scheduled: ScheduledStroke<P>[]): boolean {
  return scheduled.some(({ sourceIndex, playFrameAnchor }) => playFrameAnchor !== null && playFrameAnchor > 0 && sourceIndex > playFrameAnchor)
}

function getInsertedSourceStart<P>(scheduled: ScheduledStroke<P>[]): number {
  return scheduled.find(({ sourceIndex, playFrameAnchor }) => playFrameAnchor !== null && playFrameAnchor > 0 && sourceIndex > playFrameAnchor)?.sourceIndex ?? scheduled.length
}

function compareAnchoredPlaybackOrder<P>(a: ScheduledStroke<P>, b: ScheduledStroke<P>): number {
  return compareStrokeRecordingTime(a, b) || comparePlayFrameAnchor(a, b)
}

function comparePlayFrameAnchor<P>(a: ScheduledStroke<P>, b: ScheduledStroke<P>): number {
  return (a.playFrameAnchor ?? Number.POSITIVE_INFINITY) - (b.playFrameAnchor ?? Number.POSITIVE_INFINITY)
}

function comparePlayFrameInsertionOrder<P>(a: ScheduledStroke<P>, b: ScheduledStroke<P>): number {
  return comparePlayFrameAnchor(a, b) || compareStrokeRecordingTime(a, b)
}

function compareStrokeRecordingTime<P>(a: ScheduledStroke<P>, b: ScheduledStroke<P>): number {
  const aTime = Number.isFinite(a.stroke.recordedOrder) ? a.stroke.recordedOrder : a.sourceIndex
  const bTime = Number.isFinite(b.stroke.recordedOrder) ? b.stroke.recordedOrder : b.sourceIndex
  return aTime - bTime || a.sourceIndex - b.sourceIndex
}

function getInsertionTargetIndex<P>(inserted: ScheduledStroke<P>, playbackOrder: ScheduledStroke<P>[], usableFrames: number): number {
  if (inserted.playFrameAnchor !== null) return Math.min(inserted.playFrameAnchor, playbackOrder.length)
  const timestampTarget = playbackOrder.findIndex(candidate => compareStrokeRecordingTime(inserted, candidate) < 0)
  return timestampTarget === -1 ? playbackOrder.length : Math.min(timestampTarget, usableFrames)
}

function getPlayFrameAnchor<P>(stroke: StudioStroke<P>, usableFrames: number): number | null {
  if (!Number.isInteger(stroke.playFrame) || stroke.playFrame === null || stroke.playFrame < 0) return null
  return Math.min(usableFrames - 1, stroke.playFrame)
}
