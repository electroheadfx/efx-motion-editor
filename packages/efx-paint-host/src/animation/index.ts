// @efxlab/efx-paint-host/animation -- Animation sub-path export
export { AnimationPlayer } from './AnimationPlayer'
export { buildProgressiveStrokeSchedule, getProgressiveFrameStrokes } from './progressiveStrokeSchedule'
export type { ProgressiveStrokeFrame, ProgressiveStrokeTransform } from './progressiveStrokeSchedule'
export { transformRecordedStrokeForHeldPose } from './recordedStrokeMotion'
export type { RecordedStrokeHeldPose } from './recordedStrokeMotion'
export { buildStaticStrokeSchedule, getStaticFrameStrokes } from './staticStrokeSchedule'
export type { StaticStrokeFrame, StaticStrokeTransform } from './staticStrokeSchedule'
export type {
  AnimationConfig,
  AnimationState,
  AnimationStrokeStyleOverride,
  AnimationWiggleConfig,
  EngineAdapter,
  FrameStroke,
  StudioPoint,
  StudioStroke,
  StudioStrokeMotion,
} from './types'
