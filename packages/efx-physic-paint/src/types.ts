// ============================================================
//  EFX Paint Physics — TypeScript Type Definitions
//  Source of truth: efx-paint-physic-v3.html
//  Rewritten from scratch per D-04 (old types.ts referenced v2)
// ============================================================

// === CANVAS DEFAULTS ===
export const DEFAULT_WIDTH = 1000
export const DEFAULT_HEIGHT = 650

// === TEXTURE CONSTANTS ===
export const TEXTURE_SIZE = 512
export const TEXTURE_HALF = 256
export const TEXTURE_MASK = 511

// === PHYSICS CONSTANTS ===
export const LUT_SIZE = 3000
export const DENSITY_NORM = 3000
export const DENSITY_K_DISPLAY = 4.0   // Compositor: single stroke at 100% → near-full coverage
export const DENSITY_K_PHYSICS = 3.5   // Drying/forceDryAll: strong wet layer values
/** @deprecated Use DENSITY_K_DISPLAY or DENSITY_K_PHYSICS */
export const DENSITY_K = DENSITY_K_DISPLAY
export const MAX_DISPLAY_ALPHA = 255
export const BLOW_DECAY = 0.92
export const BLOW_STRENGTH = 8.0

// === PAPER CONFIGURATION ===

export interface PaperConfig {
  name: string
  url: string
}

// === ENGINE CONFIGURATION ===

export interface StrokeMetadata {
  playFrame?: number
}

export interface EngineConfig {
  width?: number           // default 1000
  height?: number          // default 650
  papers: PaperConfig[]
  defaultPaper?: string    // key to auto-select
  paperTextureScale?: number
  getStrokeMetadata?: () => StrokeMetadata | null | undefined
}

/** Native tablet sample injected by host apps when PointerEvent.pressure is unavailable. */
export interface NativePenInput {
  pressure: number         // pressure 0-1
  tiltX?: number           // tilt X degrees
  tiltY?: number           // tilt Y degrees
}

// === TOOL TYPES ===
// v3 has only paint and erase active (D-12)

export type ToolType = 'paint' | 'erase'

// === BRUSH OPTIONS ===

export interface BrushOpts {
  size: number             // 1-80 (slider id="sz")
  opacity: number          // 10-100 (slider id="op")
  pressure: number         // 10-100 (slider id="pr")
  waterAmount: number      // 0-100 (slider id="wa")
  dryAmount: number        // 0-100 (slider id="da")
  edgeDetail: number       // 0-100 (slider id="ed")
  pickup: number           // 0-100 paint tool (slider id="pu")
  eraseStrength: number    // 0-100 erase tool (slider id="es")
  antiAlias: number        // 0=off, 1=soft(2 passes), 2=med(4 passes), 3=high(6 passes)
}

/** Optional, synchronous timing observer used only by the disabled performance profiler. */
export type PaintPrimitiveTimingObserver = (stage: string, durationMs: number) => void

// === PEN INPUT ===

export interface PenPoint {
  x: number
  y: number
  p: number    // pressure 0-1
  tx: number   // tilt X degrees
  ty: number   // tilt Y degrees
  tw: number   // twist degrees
  spd: number  // speed px/ms
}

// === BACKGROUND MODE ===

export type BgMode = 'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3' | 'photo'

// === WET PAINT BUFFERS ===
// All Float32Array of size width*height

export interface WetBuffers {
  r: Float32Array
  g: Float32Array
  b: Float32Array
  alpha: Float32Array       // 0-200000 range
  wetness: Float32Array     // water content
  strokeOpacity: Float32Array  // per-pixel visual opacity 0-1 (Porter-Duff accumulated, D-01)
}

// Saved wet layer (clean brush deposit colors, no grain artifacts)
export interface SavedWetBuffers {
  r: Float32Array
  g: Float32Array
  b: Float32Array
  alpha: Float32Array
  strokeOpacity: Float32Array
}

// Diffusion ping-pong buffers
export interface TmpBuffers {
  r: Float32Array
  g: Float32Array
  b: Float32Array
  alpha: Float32Array
}

// Color map for diffusion (precomputed average color)
export interface ColorMap {
  r: Float32Array
  g: Float32Array
  b: Float32Array
}

// === DIFFUSION PARAMETERS ===

export interface DiffusionParams {
  physicsStrength: number   // 1-100 (slider id="physStr", default 20)
  blowDX: Float32Array     // per-pixel directional force X
  blowDY: Float32Array     // per-pixel directional force Y
}

// === FLUID SOLVER BUFFERS ===

/** Stam stable fluids solver buffers -- (W+2)*(H+2) grids with boundary padding */
export interface FluidBuffers {
  u: Float32Array       // velocity X
  v: Float32Array       // velocity Y
  u0: Float32Array      // velocity X scratch
  v0: Float32Array      // velocity Y scratch
  p: Float32Array       // pressure
  div: Float32Array     // divergence
  wetMask: Float32Array // binary wet area for edge darkening
  blurMask: Float32Array // gaussian-blurred wet mask
}

/** Parameters for the fluid solver */
export interface FluidConfig {
  viscosity: number     // 0.0001 (watery) to 0.01 (thick) -- per D-13
  omega_h: number       // height equalization strength, ~0.06 per Van Laerhoven
  darkening: number     // edge darkening strength, ~0.1
}

// === DRYING LUT ===

export interface DryingLUT {
  dryLUT: Float32Array      // size LUT_SIZE+1
  invLUT: Float32Array      // size LUT_SIZE+1
  dryPos: Float32Array      // size width*height
}

// === STROKE RECORDING ===

export type PhysicsMode = 'local' | 'last' | 'all' | null

export interface PaintStroke {
  mutationId?: number       // stable in-memory identity for accepted brush history
  tool: ToolType
  points: PenPoint[]
  color: string | null      // '#rrggbb' or null
  params: BrushOpts
  timestamp: number
  hasPenInput?: boolean
  diffusionFrames?: number  // v2 format: frames of diffusion since last stroke
  playFrame?: number        // optional Play-canvas frame where this stroke starts
  physicsMode?: PhysicsMode // per-stroke mode for Play-canvas replay
}

// === PROJECT SERIALIZATION (v1.0 document) ===
// The standalone engine adopts the v1.0 EFX Paint document format (D-03):
// one document format everywhere. The declarations below are a structural
// mirror of the app-side schema (app/src/efx-paint/document/efxPaintDocument.ts)
// — the workspace package cannot import app code, so field names are kept
// identical so payloads inter-operate across the bridge without mapping.
// The engine's own strokes/settings ride on the default track as optional
// engine-only carriers (absent in app-side documents).

/** Main-editor blend mode union (mirrors the app-side schema). */
export type BlendMode = 'normal' | 'screen' | 'multiply' | 'overlay' | 'add'

/** Document fallback revealed in Background gaps (mirrors the app-side schema). */
export type BackgroundFallback =
  | { readonly mode: 'transparent' }
  | { readonly mode: 'solid'; readonly color: string }
  | {
      readonly mode: 'paper'
      readonly texture: 'canvas1' | 'canvas2' | 'canvas3'
      readonly paperGrain: boolean
      readonly grainStrength: number
    }

/** Repeat policy of a Background Loop Clip (mirrors the app-side schema). */
export type FrameLoopClipRepeat =
  | { readonly mode: 'finite'; readonly count: number }
  | { readonly mode: 'infinite' }

/** One Background Loop Clip (mirrors the app-side schema). */
export interface FrameLoopClip {
  readonly id: string
  readonly startFrame: number
  readonly sourceFrameRefs: readonly string[]
  readonly repeat: FrameLoopClipRepeat
  readonly sourceKind: 'playscript-hold' | 'imported-background'
  readonly revision: number
}

/** Cached-frame sidecar reference record (mirrors the app-side schema). */
export interface CachedFrameReference {
  readonly cachePath: string
  readonly width: number
  readonly height: number
}

/** One serialized engine stroke carried on the default track (engine-only). */
export interface SerializedEngineStroke {
  tool: string
  pts: Array<[number, number, number, number, number, number, number]>
  color: string | null
  params: Record<string, number>
  time: number
  hasPenInput?: boolean
  diffusionFrames?: number
  playFrame?: number
  physicsMode?: PhysicsMode
}

/** Engine settings carried on the default track (engine-only). */
export interface EngineTrackSettings {
  bgMode: string
  paperGrain: string
  embossStrength: number
  wetPaper: boolean
}

/** One internal Paint track inside the document (mirrors the app-side schema). */
export interface InternalPaintTrack {
  readonly id: string
  readonly name: string
  readonly order: number
  readonly visible: boolean
  readonly solo: boolean
  readonly opacity: number
  readonly blendMode: BlendMode
  readonly revision: number
  readonly frames: Readonly<Record<number, CachedFrameReference>>
  readonly rotoPhysical: unknown | null
  readonly loopClips: readonly FrameLoopClip[]
  /** Engine-only carrier: serialized strokes of the standalone engine. */
  readonly strokes?: readonly SerializedEngineStroke[]
  /** Engine-only carrier: engine settings. */
  readonly settings?: EngineTrackSettings
}

/** The single fixed Background track beneath all Paint tracks (mirrors the app-side schema). */
export interface BackgroundTrack {
  readonly id: string
  readonly clips: readonly FrameLoopClip[]
  readonly fallback: BackgroundFallback
  readonly visible: boolean
  readonly revision: number
}

/** The v1.0 EFX Physic Paint document owned by one parent layer (mirrors the app-side schema). */
export interface EfxPaintDocument {
  readonly version: number
  readonly parentLayerId: string
  readonly documentRevision: number
  readonly activeTrackId: string
  readonly tracks: readonly InternalPaintTrack[]
  readonly background: BackgroundTrack
  readonly photoReference: null
  readonly compositeRevision: number
}

// === ENGINE STATE ===
// Mutable internal state of EfxPaintEngine

export interface EngineState {
  width: number
  height: number
  tool: ToolType
  bgMode: BgMode
  embossStrength: number
  embossStack: number
  wetPaper: boolean
  drawing: boolean
  brushOpts: BrushOpts
  drySpeed: number         // 10-100, derived from dryAmount slider: 10 + (dryAmount/100)*90
  physicsStrength: number
  physicsRunning: boolean
  physicsMode: PhysicsMode
  localSpreadStrength: number  // 0-100, controls local physics spread (D-11)
  hasPenInput: boolean
  diffusionFramesSinceLastStroke: number
}
