// ============================================================
//  Animation Type Definitions
//  Types for AnimationPlayer playback system.
//  Per D-01 through D-07: frame-mapped stroke replay with
//  progressive point rendering and configurable FPS.
// ============================================================

import type { PaintStroke } from '../types'

/** Configuration for animation playback (per D-03: FPS is configurable, no default) */
export interface AnimationConfig {
  frameCount: number
  fps: number
  onFrame?: (frameIndex: number, canvas: HTMLCanvasElement) => void  // per D-06
  onComplete?: () => void
}

/** Current animation state (for UI consumption, per D-10) */
export interface AnimationState {
  playing: boolean
  currentFrame: number
  totalFrames: number
}

/** Internal: a stroke mapped to its frame range (per D-01: timestamp ratio mapping) */
export interface FrameStroke {
  stroke: PaintStroke
  startFrame: number
  endFrame: number
  /** How many points to render per frame for progressive drawing (per D-02) */
  pointsPerFrame: number
}
