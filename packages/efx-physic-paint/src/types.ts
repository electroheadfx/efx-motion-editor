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

export interface EngineConfig {
  width?: number           // default 1000
  height?: number          // default 650
  papers: PaperConfig[]
  defaultPaper?: string    // key to auto-select
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

export interface PaintStroke {
  tool: ToolType
  points: PenPoint[]
  color: string | null      // '#rrggbb' or null
  params: BrushOpts
  timestamp: number
  diffusionFrames?: number  // v2 format: frames of diffusion since last stroke
}

// === PROJECT SERIALIZATION ===

export interface SerializedProject {
  version: 2
  width: number
  height: number
  strokes: Array<{
    tool: string
    pts: Array<[number, number, number, number, number, number, number]>
    color: string | null
    params: Record<string, number>
    time: number
    diffusionFrames?: number
  }>
  settings: {
    bgMode: string
    paperGrain: string
    embossStrength: number
    wetPaper: boolean
  }
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
  physicsMode: 'local' | 'last' | 'all' | null
  localSpreadStrength: number  // 0-100, controls local physics spread (D-11)
  hasPenInput: boolean
  diffusionFramesSinceLastStroke: number
}
