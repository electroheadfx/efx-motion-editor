import type { StudioStroke, StudioPoint } from './types'

const STOP_MOTION_HOLD_FRAMES = 2
const MOVE_AMPLITUDE_PX = 12
const DEFORM_AMPLITUDE_PX = 8
const ROTATION_AMPLITUDE_DEG = 10
const SCALE_AMPLITUDE = 0.1
// Channel occupancy in the seeded noise space: position uses 0/1 and the
// per-point deformation uses 11 + 2i / 12 + 2i, so 9 (rotation) and 10
// (scale) are provably free.
const ROTATION_CHANNEL = 9
const SCALE_CHANNEL = 10

export type RecordedStrokeHeldPose = {
  destinationSourceFrame: number
  strokeIndex: number
  deformation: number
  position: number
  /** Integer percent 0-100; ±10° at 100. Absent reads as 0. */
  rotation?: number
  /** Integer percent 0-100; ±10% uniform at 100. Absent reads as 0. */
  scale?: number
}

export function transformRecordedStrokeForHeldPose<P = unknown>(
  stroke: Readonly<StudioStroke<P>>,
  pose: Readonly<RecordedStrokeHeldPose>,
): StudioStroke<P> {
  const deformation = clampPercent(pose.deformation) / 100
  const position = clampPercent(pose.position) / 100
  const rotation = clampPercent(pose.rotation) / 100
  const scale = clampPercent(pose.scale) / 100

  if (deformation === 0 && position === 0 && rotation === 0 && scale === 0) {
    return stroke as StudioStroke<P>
  }

  const seed = hashStroke(stroke, pose.strokeIndex)
  const poseFrame = quantizeStopMotionFrame(pose.destinationSourceFrame)
  const positionAmplitude = position * MOVE_AMPLITUDE_PX
  const deformationAmplitude = deformation * DEFORM_AMPLITUDE_PX
  const offsetX = positionAmplitude === 0 ? 0 : poseNoise(seed, poseFrame, 0) * positionAmplitude
  const offsetY = positionAmplitude === 0 ? 0 : poseNoise(seed, poseFrame, 1) * positionAmplitude
  const rotationAngle = rotation === 0
    ? 0
    : (poseNoise(seed, poseFrame, ROTATION_CHANNEL) * rotation * ROTATION_AMPLITUDE_DEG * Math.PI) / 180
  const scaleFactor = scale === 0
    ? 1
    : 1 + poseNoise(seed, poseFrame, SCALE_CHANNEL) * scale * SCALE_AMPLITUDE
  const pivot = resolveStrokeCentroid(stroke.pts)

  return {
    ...stroke,
    pts: stroke.pts.map((point, pointIndex) => applyStopMotionPose(
      point,
      pointIndex,
      seed,
      poseFrame,
      offsetX,
      offsetY,
      deformationAmplitude,
      rotationAngle,
      scaleFactor,
      pivot,
    )),
  }
}

function applyStopMotionPose(
  point: Readonly<StudioPoint>,
  pointIndex: number,
  seed: number,
  poseFrame: number,
  offsetX: number,
  offsetY: number,
  deformationAmplitude: number,
  rotationAngle: number,
  scaleFactor: number,
  pivot: Readonly<{ x: number; y: number }>,
): StudioPoint {
  // Order is rigid -> position offset -> per-point deformation. The rigid pass
  // must run even when the deformation percent is zero, so the old
  // `deformationAmplitude === 0` early return is gone.
  let x = point.x
  let y = point.y
  if (rotationAngle !== 0 || scaleFactor !== 1) {
    const cos = Math.cos(rotationAngle)
    const sin = Math.sin(rotationAngle)
    const deltaX = point.x - pivot.x
    const deltaY = point.y - pivot.y
    x = pivot.x + scaleFactor * (cos * deltaX - sin * deltaY)
    y = pivot.y + scaleFactor * (sin * deltaX + cos * deltaY)
  }
  x += offsetX
  y += offsetY
  if (deformationAmplitude !== 0) {
    x += poseNoise(seed, poseFrame, 11 + pointIndex * 2) * deformationAmplitude
    y += poseNoise(seed, poseFrame, 12 + pointIndex * 2) * deformationAmplitude
  }
  return { ...point, x, y }
}

function resolveStrokeCentroid(pts: readonly Readonly<StudioPoint>[]): { x: number; y: number } {
  if (pts.length === 0) return { x: 0, y: 0 }
  let x = 0
  let y = 0
  for (const point of pts) {
    x += point.x
    y += point.y
  }
  return { x: x / pts.length, y: y / pts.length }
}

function clampPercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function hashStroke<P>(stroke: Readonly<StudioStroke<P>>, strokeIndex: number): number {
  // Source string kept byte-identical to the pre-split form so the golden
  // pin's held-pose deformation stays delta-zero across the move (D-25).
  const source = `${strokeIndex}:${stroke.recordedOrder}:${stroke.color ?? ''}:${stroke.pts.length}`
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function quantizeStopMotionFrame(frameIndex: number): number {
  const finiteFrame = Number.isFinite(frameIndex) ? frameIndex : 0
  return Math.floor(Math.max(0, finiteFrame) / STOP_MOTION_HOLD_FRAMES)
}

function poseNoise(seed: number, poseFrame: number, channel: number): number {
  let hash = seed ^ Math.imul(poseFrame + 1, 374761393) ^ Math.imul(channel + 1, 668265263)
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  hash ^= hash >>> 16
  return ((hash >>> 0) / 0xffffffff) * 2 - 1
}
