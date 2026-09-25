// @efxlab/efx-physic-paint -- Library entry point
export { EfxPaintEngine } from './engine/EfxPaintEngine'
// 260925-iy6: the ONE height conditioner (260925-dso law) is shared with the
// app-side paper-pass tile builder — single source of truth, no re-derivation.
export { conditionHeightMap } from './core/paper'
export type { CompletedPaintMutation, InputActivityKind, PaintHistoryAvailability, PaintPerformanceCategory, PaintPerformanceSample, RecordedStrokeGroup } from './engine/EfxPaintEngine'
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
