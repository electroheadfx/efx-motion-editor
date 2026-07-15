import type { PaintStroke, PenPoint } from '../types'

const STOP_MOTION_HOLD_FRAMES = 2
const MOVE_AMPLITUDE_PX = 12
const DEFORM_AMPLITUDE_PX = 8

export type RecordedStrokeHeldPose = {
  destinationSourceFrame: number
  strokeIndex: number
  deformation: number
  position: number
}

export function transformRecordedStrokeForHeldPose(
  stroke: Readonly<PaintStroke>,
  pose: Readonly<RecordedStrokeHeldPose>,
): PaintStroke {
  const deformation = clampPercent(pose.deformation) / 100
  const position = clampPercent(pose.position) / 100

  if (deformation === 0 && position === 0) return stroke as PaintStroke

  const seed = hashStroke(stroke, pose.strokeIndex)
  const poseFrame = quantizeStopMotionFrame(pose.destinationSourceFrame)
  const positionAmplitude = position * MOVE_AMPLITUDE_PX
  const deformationAmplitude = deformation * DEFORM_AMPLITUDE_PX
  const offsetX = positionAmplitude === 0 ? 0 : poseNoise(seed, poseFrame, 0) * positionAmplitude
  const offsetY = positionAmplitude === 0 ? 0 : poseNoise(seed, poseFrame, 1) * positionAmplitude

  return {
    ...stroke,
    points: stroke.points.map((point, pointIndex) => applyStopMotionPose(
      point,
      pointIndex,
      seed,
      poseFrame,
      offsetX,
      offsetY,
      deformationAmplitude,
    )),
    params: { ...stroke.params },
  }
}

function clampPercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function hashStroke(stroke: Readonly<PaintStroke>, strokeIndex: number): number {
  const source = `${strokeIndex}:${stroke.timestamp}:${stroke.color ?? ''}:${stroke.points.length}`
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

function applyStopMotionPose(
  point: Readonly<PenPoint>,
  pointIndex: number,
  seed: number,
  poseFrame: number,
  offsetX: number,
  offsetY: number,
  deformationAmplitude: number,
): PenPoint {
  if (deformationAmplitude === 0) {
    return { ...point, x: point.x + offsetX, y: point.y + offsetY }
  }

  const deformationX = poseNoise(seed, poseFrame, 11 + pointIndex * 2) * deformationAmplitude
  const deformationY = poseNoise(seed, poseFrame, 12 + pointIndex * 2) * deformationAmplitude
  return {
    ...point,
    x: point.x + offsetX + deformationX,
    y: point.y + offsetY + deformationY,
  }
}

function poseNoise(seed: number, poseFrame: number, channel: number): number {
  let hash = seed ^ Math.imul(poseFrame + 1, 374761393) ^ Math.imul(channel + 1, 668265263)
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  hash ^= hash >>> 16
  return ((hash >>> 0) / 0xffffffff) * 2 - 1
}
