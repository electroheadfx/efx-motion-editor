// ============================================================
//  Animation Type Definitions — generic StudioStroke<P> contract
//  (HOST-02 / D-19). One schedule-stroke shape shared by every
//  engine; engine-specific data rides the opaque `engine: P` slot.
//  55-03 names this shape formally and re-exports it from script/.
// ============================================================

/** Shared stylus sample. `tick` is the integer tick offset within the stroke. */
export interface StudioPoint {
  x: number
  y: number
  p: number
  tx: number
  ty: number
  tw: number
  tick: number
}

/** Host-owned motion schedule input (wiggle / held-pose / drift). */
export interface StudioStrokeMotion {
  strokeDeformation: number
  strokePosition: number
}

/**
 * The ONE schedule-stroke contract. Engine-specific data (tool ids,
 * colour model, brush-opts bag, physics-mode) lives in the opaque
 * `engine: P` slot — host code never inspects P (R2.2).
 *
 * `color` is carried as a shared display field because held-pose
 * hashing (transformRecordedStrokeForHeldPose) keys on it and the
 * golden pin requires that hash to stay byte-stable across the move.
 */
export interface StudioStroke<P = unknown> {
  pts: readonly StudioPoint[]
  /** Stroke duration on the fixed tick grid (integer). */
  ticks: number
  /** Diffusion budget in ticks (per-stroke cuisson). */
  cuisson: number
  motion: StudioStrokeMotion | null
  /** Stable id into the engine's brush pack. */
  brushId: string
  toolOverrides: Readonly<Record<string, number | string | boolean>>
  /** FNV-1a-derived stroke seed (D-25 determinism law). */
  traceSeed: number
  /** Recording-order key — finite number used only for ordering comparison (DATA-03). */
  recordedOrder: number
  /** Host-owned play anchor. */
  playFrame: number | null
  /** Shared display colour (kept for held-pose hash stability). */
  color: string | null
  /** OPAQUE engine payload — host never reads this. */
  engine: P
}

/** Internal: a stroke mapped to its sequential frame range. */
export interface FrameStroke<P = unknown> {
  stroke: StudioStroke<P>
  startFrame: number
  endFrame: number
  /** How many points to render per frame for progressive drawing (per D-02) */
  pointsPerFrame: number
}

/** Optional stroke-motion noise for Play exports/previews. Values are 0-100. */
export interface AnimationWiggleConfig {
  /** Per-point stroke outline deformation during playback. */
  strokeDeformation: number
  /** Whole-stroke position drift during playback. */
  strokePosition: number
}

/**
 * Generic stroke-style override (D-18 / HOST-02). Carries only shared
 * fields plus an opaque engine slot — no engine-1 field names.
 */
export interface AnimationStrokeStyleOverride<P = unknown> {
  brushId?: string
  toolOverrides?: Readonly<Record<string, number | string | boolean>>
  /** Opaque engine payload copied through without inspection. */
  engine?: P
}

/** Configuration for animation playback (per D-03: FPS is configurable, no default) */
export interface AnimationConfig<P = unknown> {
  frameCount: number
  fps: number
  wiggle?: AnimationWiggleConfig
  strokeStyleOverride?: AnimationStrokeStyleOverride<P>
  onFrame?: (frameIndex: number, canvas: HTMLCanvasElement) => void  // per D-06
  onComplete?: () => void
}

/** Current animation state (for UI consumption, per D-10) */
export interface AnimationState {
  playing: boolean
  currentFrame: number
  totalFrames: number
}

/**
 * The generic EngineAdapter<P> plug point (HOST-02 / D-19). One interface
 * covering both live playback and bake — the player drives this seam,
 * never a concrete engine class. Engine-1 call sites project their runtime
 * stroke onto StudioStroke<P> via toStudioStroke before any host call.
 */
export interface EngineAdapter<P = unknown> {
  // — Live playback surface (AnimationPlayer) —
  setInputLocked(locked: boolean): void
  setAnimationMode(mode: boolean): void
  getStrokes(): readonly StudioStroke<P>[]
  renderPartialStrokes(strokeData: ReadonlyArray<{ stroke: StudioStroke<P>; pointCount: number }>): void
  renderAllStrokes(): void
  exportCompositeCanvas(): HTMLCanvasElement

  // — Bake surface (55-07 bake host) —
  applyStroke(stroke: StudioStroke<P>): void
  stepTick(tick: number): void
  captureFrame(): CanvasImageSource
  dispose(): void
}
