// @efxlab/efx-physic-paint -- Library entry point
export { EfxPaintEngine } from './engine/EfxPaintEngine'
export type { CompletedPaintMutation, PaintHistoryAvailability, PaintPerformanceCategory, PaintPerformanceSample, RecordedStrokeGroup } from './engine/EfxPaintEngine'
export { transformRecordedStrokeForHeldPose } from './animation/recordedStrokeMotion'
export type { RecordedStrokeHeldPose } from './animation/recordedStrokeMotion'
import type { EfxPaintDocument } from './types'
export type {
  EngineConfig,
  ToolType,
  BrushOpts,
  PenPoint,
  PaperConfig,
  BgMode,
  PaintStroke,
  EngineState,
} from './types'
export type { EfxPaintDocument } from './types'
// TEMP deprecated alias (removed in Task 4): keeps app-side consumers
// compiling against the pre-v1.0 name while the consumer sweep lands.
export type SerializedProject = EfxPaintDocument
