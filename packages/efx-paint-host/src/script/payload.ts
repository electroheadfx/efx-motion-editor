// ============================================================
//  Generic StudioScriptEnvelope<P> / EngineAdapter<P> contract
//  (HOST-02 / D-19).  Host code never inspects the opaque
//  engine payload slot `P` (R2.2).  Engine-1 parameter names
//  are prohibited from this surface.
//
//  The shared stroke shape re-exports the ONE schedule-stroke
//  contract 55-02's animation/ schedules already consume — one
//  contract, not two.
// ============================================================

// — Shared stroke shape (55-02 contract, re-exported) —
export type { StudioPoint, StudioStrokeMotion, StudioStroke } from '../animation/types'
import type { StudioStroke } from '../animation/types'

// ---------------------------------------------------------------------------
// Engine identity on disk (D-15: package identities, not display names)
// ---------------------------------------------------------------------------
export type EngineId = 'efx-physic-paint' | 'efx-watercolor' | 'efx-krita'

// ---------------------------------------------------------------------------
// Envelope sub-shapes (lifted from the app schema envelope law per PATTERNS)
// ---------------------------------------------------------------------------

/** Project / layer / frame / dims + display hint only — no engine params. */
export interface StudioScriptSource {
  projectName: string
  layerId: string
  layerName: string
  sourceFrame: number
  displayFrame: number
  width: number
  height: number
}

/** Thumbnail image record (shared limits across engines). */
export interface StudioScriptThumbnail {
  mimeType: 'image/webp'
  width: number
  height: number
  quality: number
  dataUrl: string
}

/** Brush-pack snapshot — TRAVELS IN .mce (deliberate exception to 52.2). */
export interface BrushPackSnapshot {
  /** Snapshot namespace / pack kind discriminator. */
  kind: string
  /** Opaque brush-pack entries — host never inspects. */
  entries: readonly unknown[]
}

// ---------------------------------------------------------------------------
// The shared script envelope
// ---------------------------------------------------------------------------

/**
 * Shared script envelope.  `engineId` is the Apply fail-closed discriminator.
 * The `strokes` array carries `StudioStroke<P>` where `P` is the opaque
 * per-engine payload slot.
 */
export interface StudioScriptEnvelope<P = unknown> {
  kind: 'efx-studio-paint-script'
  schemaVersion: number
  engineId: EngineId
  id: string
  name: string
  createdAt: string
  updatedAt: string
  source: StudioScriptSource
  thumbnail: StudioScriptThumbnail
  brushPack: BrushPackSnapshot
  strokes: readonly StudioStroke<P>[]
}

// ---------------------------------------------------------------------------
// EngineAdapter — ONE plug point covering both live playback and bake
// (the surface AnimationPlayer requires and A5 proves are the same adapter)
// ---------------------------------------------------------------------------

/**
 * The single engine plug point.  Engines implement this interface; the host
 * drives it.  `P` is the opaque per-engine stroke payload.
 */
export interface EngineAdapter<P = unknown> {
  /** Package identity (D-15). */
  readonly engineId: EngineId

  /**
   * Per-engine payload codec.  `parse` is total and fail-closed (null on any
   * malformed input).  The host never reads `P` — the codec is engine-owned.
   */
  readonly payloadCodec: {
    serialize(stroke: unknown): StudioStroke<P>
    parse(raw: unknown): StudioStroke<P> | null
  }

  // — Live playback surface (AnimationPlayer) —
  setInputLocked(locked: boolean): void
  setAnimationMode(mode: boolean): void
  getStrokes(): readonly StudioStroke<P>[]
  renderPartialStrokes(
    strokeData: ReadonlyArray<{ stroke: StudioStroke<P>; pointCount: number }>,
  ): void
  renderAllStrokes(): void
  exportCompositeCanvas(): HTMLCanvasElement

  // — Bake surface (55-07 bake host) —
  applyStroke(stroke: StudioStroke<P>): void
  stepTick(tick: number): void
  captureFrame(): CanvasImageSource
  dispose(): void
}
