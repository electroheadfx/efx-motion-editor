// ============================================================
//  EfxPaintEngine — Facade Class
//  The single entry point for consumers of @efxlab/efx-physic-paint.
//  Owns ALL mutable state (typed array buffers, canvases, intervals).
//  Delegates to functional modules from core/, brush/, render/.
//  From efx-paint-physic-v3.html — D-03/D-08 public API.
// ============================================================

import type {
  EngineConfig,
  EngineState,
  ToolType,
  BgMode,
  BrushOpts,
  PenPoint,
  WetBuffers,
  SavedWetBuffers,
  TmpBuffers,
  ColorMap,
  DryingLUT,
  FluidBuffers,
  FluidConfig,
  PaintStroke,
  PhysicsMode,
  EfxPaintDocument,
  SerializedEngineStroke,
  EngineTrackSettings,
  NativePenInput,
  StrokeMetadata,
} from '../types'
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  LUT_SIZE,
} from '../types'
import { clamp, distXY, curveBounds } from '../util/math'
import { lerp } from '../util/math'
import { createWetBuffers, createSavedWetBuffers, createTmpBuffers, clearWetLayer, featherWetEdges } from '../core/wet-layer'
import { initDryingLUT, dryStep, forceDryAll } from '../core/drying'
import { physicsStep } from '../core/diffusion'
import { createLocalFluidPhysicsContinuation, localFluidPhysicsStep } from '../core/fluids'
import type { LocalFluidPhysicsContinuation } from '../core/fluids'
import { loadPaperTexture, sampleH, ensureHeightMap } from '../core/paper'
import { createPaintStrokeRasterContinuation, renderPaintStroke } from '../brush/paint'
import type { PaintStrokeRasterContinuation } from '../brush/paint'
import { applyEraseStroke } from '../brush/erase'
import { compositeWetLayer, wetDisplayAlpha } from '../render/compositor'
import { drawBg, drawBrushCursor, drawQueuedStrokePolyline, drawStrokePreview, setupDualCanvas } from '../render/canvas'
import type { StrokePreview, DualCanvas } from '../render/canvas'

/**
 * Quantized undo snapshot — the wet/saved buffers are stored at reduced
 * precision (Uint8 colors, Uint16 scaled scalars) to cut checkpoint memory
 * from ~34MB to ~14MB per level (10 levels held permanently: 338MB -> 143MB).
 * Restored values are visually and physically equivalent: colors are exact
 * (0-255), alpha precision is ±2 on a 0-200000 range (anything above ~800 is
 * fully opaque), and wetness/dryPos/strokeOpacity keep integer or 1/65535
 * precision.
 */
type UndoSnapshot = {
  mutationId: number
  canvas: ImageData
  wet: { r: Uint8Array; g: Uint8Array; b: Uint8Array; a: Uint16Array; w: Uint16Array; dp: Uint16Array; so: Uint16Array }
  saved: { r: Uint8Array; g: Uint8Array; b: Uint8Array; a: Uint16Array; so: Uint16Array }
}

const UNDO_ALPHA_SCALE = 4
const UNDO_OPACITY_SCALE = 65535

function quantizeScaledUint16(src: Float32Array, scale: number): Uint16Array {
  const out = new Uint16Array(src.length)
  for (let i = 0; i < src.length; i++) {
    out[i] = Math.min(65535, Math.max(0, Math.round(src[i] * scale)))
  }
  return out
}

function dequantizeScaled(dst: Float32Array, src: Uint16Array, scale: number): void {
  for (let i = 0; i < src.length; i++) dst[i] = src[i] * scale
}

/** Restore a scaled quantized snapshot, or copy a raw Float32 snapshot verbatim (test/legacy snapshots). */
function restoreScaledOrRaw(dst: Float32Array, src: Uint16Array | Float32Array, scale: number): void {
  if (src instanceof Uint16Array) {
    dequantizeScaled(dst, src, scale)
  } else {
    dst.set(src)
  }
}

type DeferredStrokeFinalization = {
  tool: ToolType
  points: PenPoint[]
  color: string | null
  opts: BrushOpts
  hasPenInput: boolean
  physicsMode: PhysicsMode
  continuationFrames: number
  mutationId: number
  queuedAt: number
  /** Scripted strokes (enqueueRecordedStroke) coalesce into one drain; interactive strokes pace one step per frame. */
  isScripted: boolean
}

export type RecordedStrokeGroup = {
  primary: Readonly<PaintStroke>
  continuations?: readonly Readonly<PaintStroke>[]
}

type PaintHistoryEntry = {
  mutationId: number
  actions: PaintStroke[]
  checkpoint: UndoSnapshot | null
  deferred: DeferredStrokeFinalization | null
}

type StrokeApplicationOptions = {
  startNaturalDrying?: boolean
  hasPenInput?: boolean
  physicsMode?: PhysicsMode
}

type ActiveStrokeFinalization = {
  pending: DeferredStrokeFinalization
  generation: number
  finalizationStartedAt: number
  phase: 'prepare' | 'raster' | 'post-raster' | 'fluid' | 'continuation' | 'complete'
  raster: PaintStrokeRasterContinuation | null
  fluid: LocalFluidPhysicsContinuation | null
  continuationFrame: number
}

export type PaintPerformanceCategory = 'sync-cpu' | 'scheduled-wait' | 'async-elapsed' | 'input-delay'

export type PaintPerformanceSample = {
  stage: string
  category: PaintPerformanceCategory
  durationMs: number
  timestamp: number
  mutationId?: number
  branch?: string
  outcome?: string
}

export type CompletedPaintMutation = {
  kind: ToolType | 'undo' | 'redo' | 'clear' | 'physics'
  isEmpty: boolean
  mutationId: number
}

export type PaintHistoryAvailability = {
  undo: number
  redo: number
}

const STROKE_FINALIZATION_IDLE_MS = 500
/** Scripted bursts drain at most this many strokes per visual frame — bounds the synchronous block. */
const MAX_COALESCED_STROKES_PER_FRAME = 4
/** Interactive strokes drain at most this many phase steps per visual frame — batches the final render. */
const MAX_INTERACTIVE_STEPS_PER_FRAME = 12
/** The display loop pauses after this much pointer inactivity, even with the cursor over the canvas or strokes queued. */
const RENDER_IDLE_MS = 4000

function brushRenderRadius(opts: Pick<BrushOpts, 'size'>): number {
  return Math.max(0.5, (opts.size || 24) / 2)
}

// === v1.0 DOCUMENT CONTRACT (D-03) ===
// The standalone engine speaks the same v1.0 EFX Paint document as the
// app-side session files and bridge. Legacy pre-v1.0 session payloads
// (version: 2 or the old strokes/settings top-level shape) reject with the
// distinct unsupported copy — never converted or partially read (Pitfall F5).

/** Distinct pre-v1.0 unsupported copy (same semantics as the app-side LOAD_STATE_UNSUPPORTED_VERSION_COPY). */
export const LOAD_STATE_UNSUPPORTED_VERSION_COPY = 'This file is a pre-v1.0 Physics Paint session, which v1.0.0 does not support. Choose a state file exported from the current version of Physics Paint.'
/** Generic invalid copy for malformed or unrecognized payloads. */
export const LOAD_STATE_INVALID_COPY = 'This file is not a valid Physics Paint state JSON. Choose a state file exported from Physics Paint.'

/** Fixed parent-layer identity of the standalone engine's own documents. */
const STANDALONE_PARENT_LAYER_ID = 'standalone'
/** Fixed default-track id of the standalone engine's own documents. */
const STANDALONE_TRACK_ID = 'track-1'
/** Fixed background-track id of the standalone engine's own documents. */
const STANDALONE_BACKGROUND_ID = 'background-1'

const DOCUMENT_KEYS = new Set(['version', 'parentLayerId', 'documentRevision', 'activeTrackId', 'tracks', 'background', 'photoReference', 'compositeRevision'])
const TRACK_KEYS = new Set(['id', 'name', 'order', 'visible', 'solo', 'opacity', 'blendMode', 'revision', 'frames', 'rotoPhysical', 'loopClips', 'strokes', 'settings'])
const BACKGROUND_KEYS = new Set(['id', 'clips', 'fallback', 'visible', 'revision'])
const STROKE_KEYS = new Set(['tool', 'pts', 'color', 'params', 'time', 'hasPenInput', 'diffusionFrames', 'playFrame', 'physicsMode'])
const SETTINGS_KEYS = new Set(['bgMode', 'paperGrain', 'embossStrength', 'wetPaper'])
const BLEND_MODES = new Set(['normal', 'screen', 'multiply', 'overlay', 'add'])

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every(key => allowed.has(key))
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function isSerializedEngineStroke(value: unknown): value is SerializedEngineStroke {
  if (!isPlainRecord(value)) return false
  if (!hasOnlyKeys(value, STROKE_KEYS)) return false
  if (typeof value.tool !== 'string' || value.tool.length === 0) return false
  if (!Array.isArray(value.pts) || !value.pts.every(point => Array.isArray(point) && point.length === 7 && point.every(component => typeof component === 'number'))) return false
  if (value.color !== null && typeof value.color !== 'string') return false
  if (!isPlainRecord(value.params)) return false
  if (typeof value.time !== 'number' || !Number.isFinite(value.time)) return false
  return true
}

function isEngineTrackSettings(value: unknown): value is EngineTrackSettings {
  if (!isPlainRecord(value)) return false
  if (!hasOnlyKeys(value, SETTINGS_KEYS)) return false
  if (typeof value.bgMode !== 'string') return false
  if (typeof value.paperGrain !== 'string') return false
  if (typeof value.embossStrength !== 'number' || !Number.isFinite(value.embossStrength)) return false
  return typeof value.wetPaper === 'boolean'
}

/**
 * Fail-closed structural validation of a v1.0 document payload, run BEFORE
 * any engine state is mutated. Legacy version:2 payloads (or the old
 * strokes/settings top-level shape) reject with the distinct unsupported
 * copy; any other malformed or unknown-member payload throws the generic
 * invalid copy. The engine only reads the active track's strokes/settings,
 * so validation covers the document skeleton plus those carriers — the
 * deep rotoPhysical/frames/loopClips validation stays with the app-side
 * parser (the package never reads those members).
 */
function validateEfxPaintDocument(value: unknown): asserts value is EfxPaintDocument {
  if (!isPlainRecord(value)) throw new Error(LOAD_STATE_INVALID_COPY)
  if (value.version === 2 || (Array.isArray(value.strokes) && isPlainRecord(value.settings))) {
    throw new Error(LOAD_STATE_UNSUPPORTED_VERSION_COPY)
  }
  if (!hasOnlyKeys(value, DOCUMENT_KEYS)) throw new Error(LOAD_STATE_INVALID_COPY)
  if (value.version !== 1) throw new Error(LOAD_STATE_INVALID_COPY)
  if (!isNonEmptyString(value.parentLayerId)) throw new Error(LOAD_STATE_INVALID_COPY)
  if (!isNonNegativeInteger(value.documentRevision)) throw new Error(LOAD_STATE_INVALID_COPY)
  if (!isNonNegativeInteger(value.compositeRevision)) throw new Error(LOAD_STATE_INVALID_COPY)
  if (value.photoReference !== null) throw new Error(LOAD_STATE_INVALID_COPY)
  if (!Array.isArray(value.tracks) || value.tracks.length === 0) throw new Error(LOAD_STATE_INVALID_COPY)
  if (!isNonEmptyString(value.activeTrackId)) throw new Error(LOAD_STATE_INVALID_COPY)
  const seenTrackIds = new Set<string>()
  for (const track of value.tracks) {
    if (!isPlainRecord(track)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (!hasOnlyKeys(track, TRACK_KEYS)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (!isNonEmptyString(track.id)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (seenTrackIds.has(track.id)) throw new Error(LOAD_STATE_INVALID_COPY)
    seenTrackIds.add(track.id)
    if (!isNonEmptyString(track.name)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (!isNonNegativeInteger(track.order)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (typeof track.visible !== 'boolean') throw new Error(LOAD_STATE_INVALID_COPY)
    if (typeof track.solo !== 'boolean') throw new Error(LOAD_STATE_INVALID_COPY)
    if (typeof track.opacity !== 'number' || !Number.isFinite(track.opacity)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (typeof track.blendMode !== 'string' || !BLEND_MODES.has(track.blendMode)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (!isNonNegativeInteger(track.revision)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (track.frames !== undefined && !isPlainRecord(track.frames)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (track.rotoPhysical !== null && !isPlainRecord(track.rotoPhysical)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (track.loopClips !== undefined && !Array.isArray(track.loopClips)) throw new Error(LOAD_STATE_INVALID_COPY)
    if (track.strokes !== undefined && (!Array.isArray(track.strokes) || !track.strokes.every(isSerializedEngineStroke))) throw new Error(LOAD_STATE_INVALID_COPY)
    if (track.settings !== undefined && !isEngineTrackSettings(track.settings)) throw new Error(LOAD_STATE_INVALID_COPY)
  }
  if (!seenTrackIds.has(value.activeTrackId)) throw new Error(LOAD_STATE_INVALID_COPY)
  if (!isPlainRecord(value.background) || !hasOnlyKeys(value.background, BACKGROUND_KEYS)) throw new Error(LOAD_STATE_INVALID_COPY)
}

/**
 * EfxPaintEngine — the facade class that ties all modules together.
 * Consumers create an instance, interact via the public API, and call destroy() to clean up.
 *
 * Usage:
 * ```ts
 * const engine = new EfxPaintEngine(container, {
 *   papers: [{ name: 'canvas1', url: '/paper_1.jpg' }],
 * })
 * engine.setTool('paint')
 * engine.setColorHex('#ff0000')
 * // ... later
 * engine.destroy()
 * ```
 */
export class EfxPaintEngine {
  // --- Dimensions ---
  private readonly width: number
  private readonly height: number
  private readonly size: number

  // --- Canvases ---
  private dualCanvas: DualCanvas
  private wetDisplayScratch: ImageData | null = null
  private lastRenderActivityTime = 0
  private bgCanvas: HTMLCanvasElement
  private bgCtx: CanvasRenderingContext2D

  // Dirty-flag display composite (GPU-process crash fix): the render loop only
  // re-composites the full wet layer when the paint pixels actually changed.
  // Cursor/preview/outline updates draw incrementally on top of the previous
  // composite, so the compositor uploads only small dirty regions instead of
  // the whole canvas every frame — the sustained full-canvas upload churn that
  // killed the WKWebView GPU process.
  private displayCompositeDirty = true
  private lastCursorRect: { x0: number; y0: number; x1: number; y1: number } | null = null
  private lastPreviewBbox: { x0: number; y0: number; x1: number; y1: number } | null = null
  private drawnQueuedOutlineCount = 0

  // --- Typed Array Buffers (owned by this class) ---
  private wet: WetBuffers
  private savedWet: SavedWetBuffers
  /** @deprecated Kept for backward compat; no longer used by stable fluids */
  private tmp: TmpBuffers
  /** @deprecated Kept for backward compat; no longer used by stable fluids */
  private colorMap: ColorMap
  /** @deprecated Kept for backward compat; replaced by FluidBuffers velocity field */
  private dispPxX: Float32Array
  /** @deprecated Kept for backward compat; replaced by FluidBuffers velocity field */
  private dispPxY: Float32Array
  private blowDX: Float32Array
  private blowDY: Float32Array
  private drying: DryingLUT
  private lastStrokeMask: Uint8Array
  private fluid: FluidBuffers
  private fluidConfig: FluidConfig

  // --- Paper & Brush Textures ---
  private paperTextures: Map<string, { tiledCanvas: HTMLCanvasElement; heightMap: Float32Array }> = new Map()
  private paperHeight: Float32Array | null = null
  private physicsHeightMap: Float32Array | null = null
  private texHeight: Float32Array | null = null
  private currentPaperKey: string = ''
  private userPhoto: HTMLImageElement | null = null

  // --- Background Data ---
  private bgData: ImageData | null = null
  private previewBackgroundRequestId: number = 0
  private previewBaseRequestId: number = 0
  private previewBaseEnabled: boolean = false
  private previewBackgroundSeparated: boolean = false
  private previewBaseImage: HTMLImageElement | null = null
  // 38.1-07: decoded-Image cache keyed by dataUrl — a frame revisit applies
  // the already-decoded image synchronously (zero new decode round-trips).
  // FIFO-capped; populated ONLY by actual setPreviewBaseImageUrl loads (no
  // decode-ahead); cleared on destroy.
  private static readonly PREVIEW_BASE_IMAGE_CACHE_CAP = 32
  private previewBaseImageCache: Map<string, HTMLImageElement> = new Map()
  // regression-refresh-multi-paint: the applied-state tracking and settle
  // notification backing the caller-side completion-paint guard. A dropped
  // decode (superseded/flag-guarded onload) is still CACHED — the pixels are
  // valid for the dataUrl — so a repair re-request is a synchronous cache-hit
  // apply instead of a second decode window.
  private appliedPreviewBaseDataUrl: string | null = null
  private previewBaseSettledListeners: Set<(dataUrl: string, outcome: 'applied' | 'dropped', generation?: number) => void> | null = null
  // regression-refresh-multi-paint (generation ordering): monotonic generation
  // tokens on the preview-base apply seam. Every request carries a generation;
  // a request settling with an OLDER generation than the last APPLIED paint is
  // a canvas NO-OP (it may populate the cache, it never paints). This stops a
  // stale async decode/apply — a late onload or a repair re-issue resolving
  // older content — from painting over a NEWER generation's settled paint.
  // Callers that do not pass a generation get one auto-assigned from the engine
  // counter (monotonic with respect to any explicit generation already seen).
  private previewBaseGenerationCounter: number = 0
  private appliedPreviewBaseGeneration: number | null = null
  // regression-refresh-multi-paint (3rd rejection): the generation gate is
  // issue-monotonic but content-agnostic — a LATER effect-driven paint of stale
  // content with an AUTO-generation above the explicit reconcile generation
  // passes the gate. The caller-side loader needs to know WHICH frame the
  // applied preview base belongs to and whether it was settled EXPLICITLY (a
  // completion reconcile) vs auto (navigation/editing), so it can no-op a plain
  // refresh that would re-issue different (older) content over the settled
  // accepted render for the same frame.
  private appliedPreviewBaseAppFrame: number | null = null
  private appliedPreviewBaseExplicit: boolean = false
  // 38.1-07: resetBackground skip memo — an unchanged background (same bgData
  // identity AND same input tuple) performs no drawBg/redraw work. Every other
  // background writer REPLACES this.bgData, so the identity half covers them
  // all. The previewBackgroundRequestId bump stays unconditional.
  private lastResetBackgroundData: ImageData | null = null
  private lastResetBackgroundInputs: {
    bgMode: BgMode
    width: number
    height: number
    paperTextures: Map<string, { tiledCanvas: HTMLCanvasElement; heightMap: Float32Array }>
    userPhoto: HTMLImageElement | null
  } | null = null

  // --- Engine State ---
  private state: EngineState

  // --- Stroke Recording ---
  private allActions: PaintStroke[] = []
  private undoStack: PaintHistoryEntry[] = []
  private redoStack: PaintHistoryEntry[] = []
  private historyEntries: PaintHistoryEntry[] = []
  private historyIndex: number = 0
  private pendingStrokeFinalizations: DeferredStrokeFinalization[] = []
  private activeStrokeFinalization: ActiveStrokeFinalization | null = null
  private strokeFinalizationScheduled: boolean = false
  private strokeFinalizationGeneration: number = 0

  // --- Pointer State ---
  private rawPts: PenPoint[] = []
  private cursorX: number = -1
  private cursorY: number = -1
  private lastPointerSampleTimeStamp: number = Number.NEGATIVE_INFINITY
  private lastAcceptedPointerSampleTimeStamp: number = Number.NEGATIVE_INFINITY
  private previewStroke: StrokePreview | null = null
  private lastStrokeBounds: { x0: number; y0: number; x1: number; y1: number } | null = null
  private color: string = '#103c65'

  // --- Intervals & Animation ---
  private physicsInterval: ReturnType<typeof setInterval> | null = null
  private physicsTickCount: number = 0
  private savedPhysicsMode: PhysicsMode = null
  private dryingInterval: ReturnType<typeof setInterval> | null = null
  private rafId: number = 0
  private destroyed: boolean = false
  private inputLocked: boolean = false
  private animationMode: boolean = false
  private nativePenInput: NativePenInput | null = null
  private lastNativePenInputTime: number = 0
  private lastPointerInputTime: number = 0
  private lastStrokeHandoffTime: number = 0
  private readonly getStrokeMetadata?: () => StrokeMetadata | null | undefined
  private readonly paperTextureScale: number
  private completedMutationListener: ((mutation: CompletedPaintMutation) => void) | null = null
  private historyAvailabilityListener: ((availability: PaintHistoryAvailability) => void) | null = null
  private performanceListener: ((sample: PaintPerformanceSample) => void) | null = null
  private nextMutationId: number = 1
  private activeMutationId: number | null = null
  private lastCompletedMutationId: number | null = null

  // --- Bound Event Handlers (for removeEventListener) ---
  private readonly boundPointerDown: (e: PointerEvent) => void
  private readonly boundPointerMove: (e: PointerEvent) => void
  private readonly boundPointerUp: (e: PointerEvent) => void
  private readonly boundPointerLeave: (e: PointerEvent) => void
  private readonly boundTouchStart: (e: TouchEvent) => void

  // --- Deferred Init (for async init()) ---
  private readonly _initPapers: Array<{ name: string; url: string }>
  private readonly _initDefaultPaper: string

  constructor(container: HTMLElement, config: EngineConfig) {
    this.width = config.width || DEFAULT_WIDTH
    this.height = config.height || DEFAULT_HEIGHT
    this.size = this.width * this.height
    this.getStrokeMetadata = config.getStrokeMetadata
    this.paperTextureScale = Number.isFinite(config.paperTextureScale) && config.paperTextureScale && config.paperTextureScale > 0 ? config.paperTextureScale : 1

    // Create dual canvases
    this.dualCanvas = setupDualCanvas(container, this.width, this.height)
    this.wetDisplayScratch = this.dualCanvas.displayCtx.createImageData(this.width, this.height)

    // Create offscreen background canvas
    this.bgCanvas = document.createElement('canvas')
    this.bgCanvas.width = this.width
    this.bgCanvas.height = this.height
    this.bgCtx = this.bgCanvas.getContext('2d', { willReadFrequently: true })!

    // Allocate ALL buffers via factory functions
    this.wet = createWetBuffers(this.size)
    this.savedWet = createSavedWetBuffers(this.size)
    this.tmp = createTmpBuffers(this.size)
    this.colorMap = {
      r: new Float32Array(this.size),
      g: new Float32Array(this.size),
      b: new Float32Array(this.size),
    }
    this.dispPxX = new Float32Array(this.size)
    this.dispPxY = new Float32Array(this.size)
    this.blowDX = new Float32Array(this.size)
    this.blowDY = new Float32Array(this.size)
    this.drying = {
      dryLUT: new Float32Array(LUT_SIZE + 1),
      invLUT: new Float32Array(LUT_SIZE + 1),
      dryPos: new Float32Array(this.size),
    }
    this.lastStrokeMask = new Uint8Array(this.size)

    // Allocate fluid solver buffers (Stam grid: (W+2)*(H+2) with boundary padding)
    const fluidGridSize = (this.width + 2) * (this.height + 2)
    this.fluid = {
      u: new Float32Array(fluidGridSize),
      v: new Float32Array(fluidGridSize),
      u0: new Float32Array(fluidGridSize),
      v0: new Float32Array(fluidGridSize),
      p: new Float32Array(fluidGridSize),
      div: new Float32Array(fluidGridSize),
      wetMask: new Float32Array(fluidGridSize),
      blurMask: new Float32Array(fluidGridSize),
    }
    this.fluidConfig = {
      viscosity: 0.0001,  // watery paint default (D-13)
      omega_h: 0.06,      // Van Laerhoven height equalization (D-02)
      darkening: 0.1,     // Curtis edge darkening strength (D-03)
    }

    // Initialize drying LUT
    initDryingLUT(this.drying.dryLUT, this.drying.invLUT)

    // Initialize engine state
    this.state = {
      width: this.width,
      height: this.height,
      tool: 'paint',
      bgMode: 'canvas1',
      embossStrength: 0.45,
      embossStack: 8,
      wetPaper: true,
      drawing: false,
      brushOpts: {
        size: 6,
        opacity: 100,
        pressure: 70,
        waterAmount: 50,
        dryAmount: 30,
        edgeDetail: 4,
        pickup: 0,
        eraseStrength: 50,
        antiAlias: 0,
      },
      drySpeed: 100, // Fixed fast drying
      physicsStrength: 0.2,
      physicsRunning: false,
      physicsMode: 'local',
      localSpreadStrength: 50,
      hasPenInput: false,
      diffusionFramesSinceLastStroke: 0,
    }

    // Bind event handlers
    this.boundPointerDown = this.onPointerDown.bind(this)
    this.boundPointerMove = this.onPointerMove.bind(this)
    this.boundPointerUp = this.onPointerUp.bind(this)
    this.boundPointerLeave = this.onPointerLeave.bind(this)
    this.boundTouchStart = (e: TouchEvent) => e.preventDefault()

    // Set up pointer event listeners on the dry canvas
    const canvas = this.dualCanvas.dryCanvas
    canvas.addEventListener('pointerdown', this.boundPointerDown)
    canvas.addEventListener('pointermove', this.boundPointerMove)
    canvas.addEventListener('pointerup', this.boundPointerUp)
    canvas.addEventListener('pointerleave', this.boundPointerLeave)
    canvas.addEventListener('touchstart', this.boundTouchStart, { passive: false })

    // Store paper config for async init() — consumers call init() to load textures
    this._initPapers = config.papers || []
    this._initDefaultPaper = config.defaultPaper || ''

    // brushTexture removed per D-07: paper-height modulates deposit instead

    // Draw initial background
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    this.dualCanvas.dryCtx.drawImage(this.bgCanvas, 0, 0)

    // Start render loop
    this.render()
  }

  /**
   * Async initialization: loads paper textures and redraws background.
   * Must be called after construction for full engine readiness.
   * onEngineReady should fire only after this resolves.
   */
  async init(): Promise<void> {
    this.lastRenderActivityTime = performance.now()
    await this.loadPaperTextures(this._initPapers, this._initDefaultPaper)
  }

  // ================================================================
  //  PUBLIC API (per D-08)
  // ================================================================

  /** Set the active tool */
  setTool(tool: ToolType): void {
    this.state.tool = tool
    this.requestRender()
  }

  /** Set brush size (1-80) */
  setBrushSize(size: number): void {
    this.state.brushOpts.size = clamp(size, 1, 80)
    this.requestRender()
  }

  /** Set brush opacity (10-100) */
  setBrushOpacity(opacity: number): void {
    this.state.brushOpts.opacity = clamp(opacity, 10, 100)
    this.requestRender()
  }

  /** Set brush pressure multiplier (10-100) */
  setBrushPressure(pressure: number): void {
    this.state.brushOpts.pressure = clamp(pressure, 10, 100)
  }

  /** Inject native pen input for hosts where PointerEvent.pressure is fixed at 0.5. */
  updateNativePenInput(input: NativePenInput): void {
    this.nativePenInput = {
      pressure: clamp(input.pressure, 0, 1),
      tiltX: input.tiltX ?? 0,
      tiltY: input.tiltY ?? 0,
    }
    this.lastNativePenInputTime = performance.now()
  }

  /** Set water amount (0-100) */
  setWaterAmount(amount: number): void {
    this.state.brushOpts.waterAmount = clamp(amount, 0, 100)
  }

  /** Set dry speed slider (0-100) — maps to internal drySpeed 10-100 */
  setDrySpeed(speed: number): void {
    this.state.drySpeed = 10 + (clamp(speed, 0, 100) / 100) * 90
  }

  /** Set edge detail (0-100) */
  setEdgeDetail(detail: number): void {
    this.state.brushOpts.edgeDetail = clamp(detail, 0, 100)
  }

  setAntiAlias(value: number): void {
    this.state.brushOpts.antiAlias = clamp(value, 0, 3)
  }

  /** Set color pickup amount (0-100) */
  setPickup(pickup: number): void {
    this.state.brushOpts.pickup = clamp(pickup, 0, 100)
  }

  /** Set erase strength (0-100) */
  setEraseStrength(strength: number): void {
    this.state.brushOpts.eraseStrength = clamp(strength, 0, 100)
  }

  /** Set physics strength (0-100) — maps to internal 0-1 range */
  setPhysicsStrength(strength: number): void {
    this.flushPendingStrokeFinalizations()
    this.state.physicsStrength = clamp(strength, 0, 100) / 100
  }

  /** Set fluid viscosity. Low=watery (0.0001), high=thick (0.01). Per D-13 */
  setViscosity(v: number): void {
    this.flushPendingStrokeFinalizations()
    this.fluidConfig.viscosity = Math.max(0.00001, Math.min(0.1, v))
  }

  /** Set physics mode: 'local' (auto during painting) or null (manual only). Per D-07 */
  setPhysicsMode(mode: 'local' | null): void {
    this.flushPendingStrokeFinalizations()
    this.state.physicsMode = mode
  }

  /** Set local spread strength (0-100). Per D-11 */
  setLocalSpreadStrength(strength: number): void {
    this.flushPendingStrokeFinalizations()
    this.state.localSpreadStrength = clamp(strength, 0, 100)
  }

  /** Set current paint color as hex string */
  setColorHex(hex: string): void {
    this.color = hex
    this.requestRender()
  }

  /** Change background mode and replay strokes */
  setBgMode(mode: BgMode): void {
    this.requestRender()
    this.flushPendingStrokeFinalizations()
    this.state.bgMode = mode
    // Replay strokes on new background
    const savedStrokes = this.allActions.filter(s => s.tool !== 'physics' as string)
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    this.redrawPreviewBase()
    // Clear dry canvas first — drawImage of transparent bg doesn't erase existing pixels
    this.dualCanvas.dryCtx.clearRect(0, 0, this.width, this.height)
    this.dualCanvas.dryCtx.drawImage(this.bgCanvas, 0, 0)
    clearWetLayer(this.wet, this.savedWet, this.drying.dryPos, this.blowDX, this.blowDY, this.lastStrokeMask)
    this.fluid.u.fill(0); this.fluid.v.fill(0)
    this.fluid.u0.fill(0); this.fluid.v0.fill(0)
    this.fluid.p.fill(0); this.fluid.div.fill(0)
    this.allActions = savedStrokes
    this.redrawAll()
  }

  setBackgroundImageUrl(dataUrl: string): void {
    this.requestRender()
    const requestId = ++this.previewBackgroundRequestId
    const image = new Image()
    image.onload = () => {
      if (requestId !== this.previewBackgroundRequestId || this.destroyed || this.animationMode || this.state.drawing) return
      this.stopNaturalDrying()
      this.bgCtx.clearRect(0, 0, this.width, this.height)
      this.bgCtx.drawImage(image, 0, 0, this.width, this.height)
      this.bgData = this.bgCtx.getImageData(0, 0, this.width, this.height)
      this.dualCanvas.dryCtx.clearRect(0, 0, this.width, this.height)
      this.dualCanvas.dryCtx.drawImage(this.bgCanvas, 0, 0)
      clearWetLayer(this.wet, this.savedWet, this.drying.dryPos, this.blowDX, this.blowDY, this.lastStrokeMask)
      this.fluid.u.fill(0); this.fluid.v.fill(0)
      this.fluid.u0.fill(0); this.fluid.v0.fill(0)
      this.fluid.p.fill(0); this.fluid.div.fill(0)
      // The next render frame re-composites the cleared wet layer (the scratch
      // stays an exact mirror — a direct clearRect here would desync it).
      this.displayCompositeDirty = true
    }
    image.src = dataUrl
  }

  resetBackground(): void {
    this.requestRender()
    this.previewBackgroundRequestId += 1
    const inputs = this.lastResetBackgroundInputs
    if (
      this.bgData !== null
      && this.bgData === this.lastResetBackgroundData
      && inputs !== null
      && inputs.bgMode === this.state.bgMode
      && inputs.width === this.width
      && inputs.height === this.height
      && inputs.paperTextures === this.paperTextures
      && inputs.userPhoto === this.userPhoto
    ) {
      return
    }
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    this.redrawPreviewBase()
    this.redrawAll()
    this.lastResetBackgroundData = this.bgData
    this.lastResetBackgroundInputs = {
      bgMode: this.state.bgMode,
      width: this.width,
      height: this.height,
      paperTextures: this.paperTextures,
      userPhoto: this.userPhoto,
    }
  }

  setPreviewBaseImageUrl(dataUrl: string, contentToken?: number, appFrame?: number): void {
    this.requestRender()
    const requestId = ++this.previewBaseRequestId
    const requestContentToken = contentToken ?? this.nextPreviewBaseContentToken()
    const requestExplicit = contentToken !== undefined
    // Keep the auto-assignment counter above any explicit content token this
    // engine has seen, so a later auto-issued paint (navigation/editing) is
    // never gated by an older explicit completion token. Layer 2 callers that
    // KNOW their content always pass a content-derived token; the auto path is
    // the fallback for non-content-aware callers.
    if (contentToken !== undefined) {
      this.previewBaseGenerationCounter = Math.max(this.previewBaseGenerationCounter ?? 0, contentToken)
    }
    const cached = this.previewBaseImageCache.get(dataUrl)
    if (cached) {
      // Cache hit: the image is already decoded — apply synchronously under
      // the identical guards (the regression-refresh-multi-paint revisit
      // timing win), PLUS the content-token ordering guard: a settle carrying
      // an OLDER content token than the last applied paint (e.g. a repair
      // reload resolving content from an older revision) must never paint
      // over the newer settled content.
      if (requestContentToken < (this.appliedPreviewBaseGeneration ?? 0)) {
        this.notifyPreviewBaseSettled(dataUrl, 'dropped', requestContentToken)
        return
      }
      this.applyPreviewBaseImage(cached, requestId, dataUrl, requestContentToken, appFrame, requestExplicit)
      return
    }
    const image = new Image()
    image.onload = () => {
      // Cache the decoded pixels even when the apply guard below drops this
      // request: the decode is valid for the dataUrl, and caching converts any
      // later repair re-request into a synchronous cache-hit apply. Without
      // this a superseded completion-published paint is lost silently until an
      // unrelated repaint (regression-refresh-multi-paint).
      if (!this.destroyed) {
        this.previewBaseImageCache.set(dataUrl, image)
        if (this.previewBaseImageCache.size > EfxPaintEngine.PREVIEW_BASE_IMAGE_CACHE_CAP) {
          const oldest = this.previewBaseImageCache.keys().next().value
          if (oldest !== undefined) this.previewBaseImageCache.delete(oldest)
        }
      }
      if (requestId !== this.previewBaseRequestId || this.destroyed || this.animationMode || this.state.drawing) {
        this.notifyPreviewBaseSettled(dataUrl, 'dropped', requestContentToken)
        return
      }
      if (requestContentToken < (this.appliedPreviewBaseGeneration ?? 0)) {
        // Content-token regression: a decode completing with an OLDER content
        // token than the last settled paint must never touch the canvas, even
        // when its requestId is current (a stale-content re-issue).
        this.notifyPreviewBaseSettled(dataUrl, 'dropped', requestContentToken)
        return
      }
      this.applyPreviewBaseImage(image, requestId, dataUrl, requestContentToken, appFrame, requestExplicit)
      this.notifyPreviewBaseSettled(dataUrl, 'applied', requestContentToken)
    }
    image.onerror = () => {
      this.notifyPreviewBaseSettled(dataUrl, 'dropped', requestContentToken)
    }
    image.src = dataUrl
  }

  /** The dataUrl of the preview base image currently applied to the canvas, or null. */
  getAppliedPreviewBaseDataUrl(): string | null {
    return this.appliedPreviewBaseDataUrl
  }

  /** The generation of the last preview base paint actually applied to the canvas, or null. */
  getAppliedPreviewBaseGeneration(): number | null {
    return this.appliedPreviewBaseGeneration
  }

  /** regression-refresh-multi-paint Layer 2: the applied CONTENT token — an
   * alias of the applied generation, which is now CONTENT-derived when the
   * caller knows its content (loader/Studio/coordinator) and only falls back to
   * issue-monotonic auto-assignment for content-agnostic callers. */
  getAppliedPreviewBaseContentToken(): number | null {
    return this.appliedPreviewBaseGeneration
  }

  /** The appFrame the applied preview base belongs to (when the caller supplied one), or null. */
  getAppliedPreviewBaseAppFrame(): number | null {
    return this.appliedPreviewBaseAppFrame
  }

  /** True when the applied preview base was settled by an EXPLICIT-generation
   * paint (a completion reconcile) rather than an auto-assigned one
   * (navigation/editing refresh). The caller-side loader uses this to no-op a
   * plain refresh that would re-issue different (older) content over the
   * settled accepted render for the same frame. */
  getAppliedPreviewBaseExplicit(): boolean {
    return this.appliedPreviewBaseExplicit
  }

  /**
   * Subscribe to preview-base request settlements. Fires once per cache-miss
   * decode ('applied' or 'dropped') and on decode failure ('dropped') with the
   * request's generation; synchronous cache-hit applies do not notify — read
   * getAppliedPreviewBaseDataUrl()/getAppliedPreviewBaseGeneration() for the
   * current state.
   */
  onPreviewBaseSettled(listener: (dataUrl: string, outcome: 'applied' | 'dropped', generation?: number) => void): () => void {
    if (!this.previewBaseSettledListeners) this.previewBaseSettledListeners = new Set()
    this.previewBaseSettledListeners.add(listener)
    return () => { this.previewBaseSettledListeners?.delete(listener) }
  }

  private notifyPreviewBaseSettled(dataUrl: string, outcome: 'applied' | 'dropped', generation?: number): void {
    if (!this.previewBaseSettledListeners || this.previewBaseSettledListeners.size === 0) return
    for (const listener of [...this.previewBaseSettledListeners]) listener(dataUrl, outcome, generation)
  }

  private nextPreviewBaseContentToken(): number {
    const floor = Math.max(this.previewBaseGenerationCounter ?? 0, this.appliedPreviewBaseGeneration ?? 0)
    this.previewBaseGenerationCounter = floor + 1
    return this.previewBaseGenerationCounter
  }

  private applyPreviewBaseImage(image: HTMLImageElement, requestId: number, dataUrl?: string, generation = 0, appFrame?: number, explicit = false): void {
    if (requestId !== this.previewBaseRequestId || this.destroyed || this.animationMode || this.state.drawing) return
    if (generation < (this.appliedPreviewBaseGeneration ?? 0)) return
    this.previewBaseImage = image
    this.previewBaseEnabled = true
    this.previewBackgroundSeparated = true
    this.appliedPreviewBaseDataUrl = dataUrl ?? null
    this.appliedPreviewBaseGeneration = generation
    this.appliedPreviewBaseAppFrame = appFrame ?? null
    this.appliedPreviewBaseExplicit = explicit
    this.redrawPreviewBase()
    this.redrawAll()
  }

  clearPreviewBaseImage(): void {
    this.requestRender()
    this.previewBaseRequestId += 1
    this.previewBaseEnabled = false
    this.previewBackgroundSeparated = false
    this.previewBaseImage = null
    this.appliedPreviewBaseDataUrl = null
    // The canvas no longer holds any preview base — the next paint is a fresh
    // generation again (the applied-generation gate resets with the canvas).
    this.appliedPreviewBaseGeneration = null
    this.appliedPreviewBaseAppFrame = null
    this.appliedPreviewBaseExplicit = false
    this.dualCanvas.previewBaseCtx.clearRect(0, 0, this.width, this.height)
    this.redrawAll()
  }

  /** Set paper grain for physics (key matches PaperConfig.name) */
  setPaperGrain(key: string): void {
    this.requestRender()
    this.flushPendingStrokeFinalizations()
    // The paper height modulates the wet composite — re-composite the display.
    this.displayCompositeDirty = true
    this.currentPaperKey = key
    const tex = this.paperTextures.get(key)
    if (tex) {
      this.texHeight = tex.heightMap
      this.paperHeight = tex.heightMap
      this.physicsHeightMap = tex.heightMap
    } else {
      this.texHeight = null
      // Generate procedural heightmap
      this.paperHeight = ensureHeightMap(null, null, this.width, this.height)
      this.physicsHeightMap = this.paperHeight
    }
  }

  /** Set emboss strength (0-1) */
  setEmbossStrength(strength: number): void {
    this.requestRender()
    this.flushPendingStrokeFinalizations()
    this.state.embossStrength = clamp(strength, 0, 1)
  }

  /** Toggle wet/dry paper mode */
  setWetPaper(wet: boolean): void {
    this.requestRender()
    this.flushPendingStrokeFinalizations()
    this.state.wetPaper = wet
  }

  /** Start physics simulation */
  startPhysics(mode: 'local' | 'last' | 'all'): void {
    this.requestRender()
    this.flushPendingStrokeFinalizations()
    if (this.state.physicsRunning) return
    this.savedPhysicsMode = this.state.physicsMode
    this.state.physicsMode = mode
    this.state.physicsRunning = true
    this.physicsTickCount = 0

    // Clear fluid solver state — prevents residual velocity from prior physics
    // sessions from advecting paint into dried areas (ghost reactivation bug)
    this.fluid.u.fill(0); this.fluid.v.fill(0)
    this.fluid.u0.fill(0); this.fluid.v0.fill(0)
    this.fluid.p.fill(0); this.fluid.div.fill(0)

    // Restore clean wet layer from saved snapshot
    const id = this.dualCanvas.dryCtx.getImageData(0, 0, this.width, this.height)
    const d = id.data
    const restoreData = this.getDryRestoreData()
    const bd = restoreData ? restoreData.data : null
    let canvasChanged = false
    const lastOnly = mode === 'last'

    for (let i = 0; i < this.size; i++) {
      if (this.savedWet.alpha[i] > 0 && (!lastOnly || this.lastStrokeMask[i])) {
        this.wet.r[i] = this.savedWet.r[i]
        this.wet.g[i] = this.savedWet.g[i]
        this.wet.b[i] = this.savedWet.b[i]
        this.wet.alpha[i] = this.savedWet.alpha[i]
        this.wet.strokeOpacity[i] = this.savedWet.strokeOpacity[i]
        this.wet.wetness[i] = 400
        this.drying.dryPos[i] = 0
        // Erase from dry canvas (restore background)
        const pi = i * 4
        if (bd) {
          d[pi] = bd[pi]; d[pi + 1] = bd[pi + 1]; d[pi + 2] = bd[pi + 2]; d[pi + 3] = bd[pi + 3]
        } else {
          d[pi] = 0; d[pi + 1] = 0; d[pi + 2] = 0; d[pi + 3] = 0
        }
        canvasChanged = true
      }
    }
    if (canvasChanged) this.dualCanvas.dryCtx.putImageData(id, 0, 0)

    // Start physics interval at 60fps (16ms)
    this.physicsInterval = setInterval(() => {
      const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)
      physicsStep(
        this.wet, this.drying, this.dualCanvas.dryCtx,
        this.fluid, this.fluidConfig,
        this.blowDX, this.blowDY,
        this.width, this.height,
        this.state.physicsStrength, this.state.drySpeed,
        this.state.physicsMode, this.lastStrokeBounds,
        this.physicsTickCount, sampleHFn, this.paperHeight,
      )
      this.physicsTickCount++
      this.displayCompositeDirty = true
    }, 16)
  }

  setCompletedMutationListener(listener: ((mutation: CompletedPaintMutation) => void) | null): void {
    this.completedMutationListener = listener
  }

  setHistoryAvailabilityListener(listener: ((availability: PaintHistoryAvailability) => void) | null): void {
    this.historyAvailabilityListener = listener
    if (listener) this.notifyHistoryAvailability()
  }

  setPerformanceListener(listener: ((sample: PaintPerformanceSample) => void) | null): void {
    this.performanceListener = listener
  }

  private recordPerformance(stage: string, category: PaintPerformanceCategory, startedAt: number, metadata: Pick<PaintPerformanceSample, 'mutationId' | 'branch' | 'outcome'> = {}): void {
    if (!this.performanceListener) return
    this.performanceListener({
      stage,
      category,
      durationMs: performance.now() - startedAt,
      timestamp: performance.now(),
      ...metadata,
    })
  }

  private recordPaintPrimitive(stage: string, durationMs: number): void {
    if (!this.performanceListener) return
    this.performanceListener({
      stage,
      category: 'sync-cpu',
      durationMs,
      timestamp: performance.now(),
      ...(this.activeMutationId !== null ? { mutationId: this.activeMutationId } : {}),
    })
  }

  /** Stop physics simulation and bake result */
  stopPhysics(): void {
    if (!this.state.physicsRunning) return
    this.requestRender()
    const completedMode = this.state.physicsMode
    this.state.physicsRunning = false
    if (this.physicsInterval !== null) {
      clearInterval(this.physicsInterval)
      this.physicsInterval = null
    }

    // Update saved wet layer with the mode that actually completed.
    if (completedMode === 'last') {
      for (let i = 0; i < this.size; i++) {
        if (this.wet.alpha[i] > 0 || this.lastStrokeMask[i]) {
          this.savedWet.r[i] = this.wet.r[i]
          this.savedWet.g[i] = this.wet.g[i]
          this.savedWet.b[i] = this.wet.b[i]
          this.savedWet.alpha[i] = this.wet.alpha[i]
          this.savedWet.strokeOpacity[i] = this.wet.strokeOpacity[i]
        }
      }
    } else {
      this.savedWet.r.set(this.wet.r)
      this.savedWet.g.set(this.wet.g)
      this.savedWet.b.set(this.wet.b)
      this.savedWet.alpha.set(this.wet.alpha)
      this.savedWet.strokeOpacity.set(this.wet.strokeOpacity)
    }

    // Bake diffused paint back to canvas
    forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height)
    this.displayCompositeDirty = true

    // Record physics run as action for deterministic replay
    const completedTickCount = this.physicsTickCount
    if (completedTickCount > 0) {
      this.allActions.push({
        tool: 'paint', // placeholder, actual physics strokes filtered during save
        points: [],
        color: null,
        params: { ...this.state.brushOpts },
        timestamp: Date.now(),
        diffusionFrames: completedTickCount,
        physicsMode: completedMode,
      })
    }

    // Restore previous physics mode only after completed-session finalization.
    this.state.physicsMode = this.savedPhysicsMode
    if (completedTickCount > 0) this.notifyCompletedMutation('physics')
  }

  /** Force-dry all wet paint immediately */
  forceDry(): void {
    this.requestRender()
    this.flushPendingStrokeFinalizations()
    this.stopNaturalDrying()
    forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height)
    // Clear savedWet — dried paint is permanent, won't be lifted by future physics
    this.savedWet.r.fill(0)
    this.savedWet.g.fill(0)
    this.savedWet.b.fill(0)
    this.savedWet.alpha.fill(0)
    this.savedWet.strokeOpacity.fill(0)
    // Clear fluid solver state — dried paint is permanent, residual velocity
    // must not leak into future physics sessions (ghost reactivation bug)
    this.fluid.u.fill(0); this.fluid.v.fill(0)
    this.fluid.u0.fill(0); this.fluid.v0.fill(0)
    this.fluid.p.fill(0); this.fluid.div.fill(0)
  }

  /** Start gradual natural drying (research: evaporation over time) */
  private startNaturalDrying(): void {
    if (this.dryingInterval) return // already drying
    this.requestRender()
    this.dryingInterval = setInterval(() => {
      // Check if there's still wet paint
      let hasWet = false
      for (let i = 0; i < this.size; i += 64) {
        if (this.wet.alpha[i] > 1) { hasWet = true; break }
      }
      if (!hasWet) {
        this.stopNaturalDrying()
        return
      }
      dryStep(this.wet, this.drying, this.dualCanvas.dryCtx,
        this.width, this.height, this.state.drySpeed, this.paperHeight)
      // Each drying step changes the visible wet — re-composite the display.
      this.displayCompositeDirty = true
      this.requestRender()
    }, 100) // 10fps drying
  }

  /** Stop natural drying timer */
  private stopNaturalDrying(): void {
    if (this.dryingInterval) {
      clearInterval(this.dryingInterval)
      this.dryingInterval = null
    }
  }

  /** Undo last accepted stroke without forcing deferred work to finalize first. */
  undo(): boolean {
    this.requestRender()
    const entry = this.undoStack.at(-1)
    if (!entry) return false
    const actionIndex = this.allActions.findIndex((action) => action.mutationId === entry.mutationId)
    if (actionIndex < 0) return false

    const pendingIndex = this.pendingStrokeFinalizations.findIndex((pending) => pending.mutationId === entry.mutationId)
    const active = this.activeStrokeFinalization
    const isActive = active?.pending.mutationId === entry.mutationId
    entry.actions = this.allActions.splice(actionIndex)

    if (pendingIndex >= 0 && !isActive) {
      entry.deferred = this.cloneDeferredFinalization(this.pendingStrokeFinalizations[pendingIndex])
      this.pendingStrokeFinalizations.splice(pendingIndex, 1)
      this.strokeFinalizationScheduled = this.pendingStrokeFinalizations.length > 0 || this.activeStrokeFinalization !== null
    } else {
      if (!entry.checkpoint) {
        this.allActions.splice(actionIndex, 0, ...entry.actions)
        return false
      }
      if (isActive) {
        entry.deferred = this.cloneDeferredFinalization(active.pending)
        this.strokeFinalizationGeneration++
        this.activeStrokeFinalization = null
        this.activeMutationId = null
        if (pendingIndex >= 0) this.pendingStrokeFinalizations.splice(pendingIndex, 1)
        this.strokeFinalizationScheduled = this.pendingStrokeFinalizations.length > 0
      }
      const postBrushCheckpoint = isActive ? null : this.captureUndoSnapshot(entry.mutationId)
      const preBrushCheckpoint = this.undoStack.pop()!.checkpoint
      if (!preBrushCheckpoint) return false
      this.restoreUndoSnapshot(preBrushCheckpoint)
      this.redoStack.push({ ...entry, checkpoint: postBrushCheckpoint })
      this.notifyHistoryAvailability()
      this.notifyCompletedMutation('undo', entry.mutationId)
      return true
    }

    this.undoStack.pop()
    this.redoStack.push(entry)
    this.historyIndex = this.undoStack.length
    this.notifyHistoryAvailability()
    return true
  }

  redo(): boolean {
    this.requestRender()
    const entry = this.redoStack.at(-1)
    if (!entry) return false

    if (entry.deferred) {
      this.allActions.push(...entry.actions)
      this.pendingStrokeFinalizations.push(this.cloneDeferredFinalization(entry.deferred))
      entry.checkpoint = null
      this.redoStack.pop()
      this.undoStack.push(entry)
      this.historyIndex = this.undoStack.length
      this.notifyHistoryAvailability()
      this.markStrokeHandoffComplete()
      this.scheduleStrokeFinalization()
      this.notifyCompletedMutation('redo', entry.mutationId)
      return true
    }

    if (!entry.checkpoint) return false
    const preBrushCheckpoint = this.captureUndoSnapshot(entry.mutationId)
    this.restoreUndoSnapshot(entry.checkpoint)
    this.allActions.push(...entry.actions)
    this.redoStack.pop()
    this.undoStack.push({ ...entry, checkpoint: preBrushCheckpoint })
    this.historyIndex = this.undoStack.length
    this.notifyHistoryAvailability()
    this.notifyCompletedMutation('redo', entry.mutationId)
    return true
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  getHistoryAvailability(): PaintHistoryAvailability {
    return { undo: this.undoStack.length, redo: this.redoStack.length }
  }

  private notifyHistoryAvailability(): void {
    this.historyAvailabilityListener?.(this.getHistoryAvailability())
  }

  private restoreUndoSnapshot(snap: UndoSnapshot): void {
    this.displayCompositeDirty = true
    this.dualCanvas.dryCtx.putImageData(snap.canvas, 0, 0)
    this.wet.r.set(snap.wet.r)
    this.wet.g.set(snap.wet.g)
    this.wet.b.set(snap.wet.b)
    restoreScaledOrRaw(this.wet.alpha, snap.wet.a, UNDO_ALPHA_SCALE)
    this.wet.wetness.set(snap.wet.w)
    this.drying.dryPos.set(snap.wet.dp)
    restoreScaledOrRaw(this.wet.strokeOpacity, snap.wet.so, 1 / UNDO_OPACITY_SCALE)
    this.savedWet.r.set(snap.saved.r)
    this.savedWet.g.set(snap.saved.g)
    this.savedWet.b.set(snap.saved.b)
    restoreScaledOrRaw(this.savedWet.alpha, snap.saved.a, UNDO_ALPHA_SCALE)
    restoreScaledOrRaw(this.savedWet.strokeOpacity, snap.saved.so, 1 / UNDO_OPACITY_SCALE)
  }

  /** Clear the canvas and all strokes */
  clear(): void {
    this.requestRender()
    this.pendingStrokeFinalizations = []
    this.strokeFinalizationScheduled = false
    this.strokeFinalizationGeneration++
    this.activeStrokeFinalization = null
    this.activeMutationId = null
    this.stopNaturalDrying()
    this.allActions = []
    this.undoStack = []
    this.redoStack = []
    this.historyEntries = []
    this.historyIndex = 0
    this.notifyHistoryAvailability()
    clearWetLayer(this.wet, this.savedWet, this.drying.dryPos, this.blowDX, this.blowDY, this.lastStrokeMask)
    // Clear fluid solver state
    this.fluid.u.fill(0); this.fluid.v.fill(0)
    this.fluid.u0.fill(0); this.fluid.v0.fill(0)
    this.fluid.p.fill(0); this.fluid.div.fill(0)
    this.savedWet.r.fill(0)
    this.savedWet.g.fill(0)
    this.savedWet.b.fill(0)
    this.savedWet.alpha.fill(0)
    this.savedWet.strokeOpacity.fill(0)
    // Hard reset both canvases — putImageData overwrites all pixels including alpha
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    this.redrawPreviewBase()
    this.dualCanvas.dryCtx.clearRect(0, 0, this.width, this.height)
    if (!this.previewBaseEnabled) {
      const bgPixels = this.bgCtx.getImageData(0, 0, this.width, this.height)
      this.dualCanvas.dryCtx.putImageData(bgPixels, 0, 0)
    }
    // The next render frame re-composites the cleared wet layer (the scratch
    // stays consistent — a direct display clearRect here would desync it).
    this.displayCompositeDirty = true
    this.notifyCompletedMutation('clear')
  }

  /** Serialize the project for saving (v1.0 document format, D-03) */
  save(): EfxPaintDocument {
    this.flushPendingStrokeFinalizations()
    return this.serializeProject()
  }

  /** Load a serialized project (v1.0 document format, D-03) */
  load(json: EfxPaintDocument): void {
    this.requestRender()
    this.flushPendingStrokeFinalizations()
    this.loadProjectData(json)
  }

  /** Clean up all resources: intervals, rAF, event listeners */
  destroy(): void {
    this.flushPendingStrokeFinalizations()
    this.destroyed = true
    this.previewBaseImageCache?.clear()
    this.previewBaseSettledListeners?.clear()
    this.appliedPreviewBaseDataUrl = null
    this.appliedPreviewBaseAppFrame = null
    this.appliedPreviewBaseExplicit = false
    // Cancel render loop
    if (this.rafId) cancelAnimationFrame(this.rafId)
    // Clear intervals
    this.strokeFinalizationScheduled = false
    this.stopNaturalDrying()
    if (this.physicsInterval !== null) {
      clearInterval(this.physicsInterval)
      this.physicsInterval = null
    }
    // Remove event listeners
    const canvas = this.dualCanvas.dryCanvas
    canvas.removeEventListener('pointerdown', this.boundPointerDown)
    canvas.removeEventListener('pointermove', this.boundPointerMove)
    canvas.removeEventListener('pointerup', this.boundPointerUp)
    canvas.removeEventListener('pointerleave', this.boundPointerLeave)
    canvas.removeEventListener('touchstart', this.boundTouchStart)
  }

  /** Get the dry canvas (for external screenshot/capture) */
  getCanvas(): HTMLCanvasElement {
    this.flushPendingStrokeFinalizations()
    return this.dualCanvas.dryCanvas
  }

  /** Get the display canvas (overlay with wet compositing) */
  getDisplayCanvas(): HTMLCanvasElement {
    this.renderVisibleWetLayer()
    return this.dualCanvas.displayCanvas
  }

  /**
   * Export the user-visible painting as a single canvas.
   * The engine renders into two canvases: dry/background pixels on the dry
   * canvas and wet/preview pixels on the display overlay. Applying or
   * playback-exporting only the display canvas drops already-dried strokes and
   * makes remaining wet paint look faded on transparent app layers.
   */
  exportCompositeCanvas(): HTMLCanvasElement {
    this.flushPendingStrokeFinalizations()
    this.renderVisibleWetLayer()
    const canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.drawImage(this.dualCanvas.dryCanvas, 0, 0)
    ctx.drawImage(this.dualCanvas.displayCanvas, 0, 0)
    return canvas
  }

  /** Copy the completed live paint only, excluding preview base and paper/background. */
  copyLiveAlphaCanvas(): HTMLCanvasElement {
    const mutationId = this.activeMutationId ?? this.lastCompletedMutationId ?? undefined
    const branch = this.previewBackgroundSeparated ? 'separated' : 'background-subtraction'

    const wetRenderStartedAt = this.performanceListener ? performance.now() : 0
    this.renderVisibleWetLayer()
    this.recordPerformance('live-alpha-render-wet', 'sync-cpu', wetRenderStartedAt, { mutationId, branch })

    const allocationStartedAt = this.performanceListener ? performance.now() : 0
    const canvas = document.createElement('canvas')
    canvas.width = this.width
    canvas.height = this.height
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, this.width, this.height)
    this.recordPerformance('live-alpha-allocate', 'sync-cpu', allocationStartedAt, { mutationId, branch })

    if (this.previewBackgroundSeparated) {
      const drawDryStartedAt = this.performanceListener ? performance.now() : 0
      ctx.drawImage(this.dualCanvas.dryCanvas, 0, 0)
      this.recordPerformance('live-alpha-draw-dry', 'sync-cpu', drawDryStartedAt, { mutationId, branch })
    } else {
      const dryReadbackStartedAt = this.performanceListener ? performance.now() : 0
      const dryPixels = this.dualCanvas.dryCtx.getImageData(0, 0, this.width, this.height)
      this.recordPerformance('live-alpha-dry-readback', 'sync-cpu', dryReadbackStartedAt, { mutationId, branch })

      const backgroundReadbackStartedAt = this.performanceListener ? performance.now() : 0
      const backgroundPixels = this.bgCtx.getImageData(0, 0, this.width, this.height)
      this.recordPerformance('live-alpha-background-readback', 'sync-cpu', backgroundReadbackStartedAt, { mutationId, branch })

      const comparisonStartedAt = this.performanceListener ? performance.now() : 0
      const dry = dryPixels.data
      const background = backgroundPixels.data
      for (let index = 0; index < dry.length; index += 4) {
        if (
          dry[index] === background[index]
          && dry[index + 1] === background[index + 1]
          && dry[index + 2] === background[index + 2]
          && dry[index + 3] === background[index + 3]
        ) {
          dry[index] = 0
          dry[index + 1] = 0
          dry[index + 2] = 0
          dry[index + 3] = 0
        }
      }
      this.recordPerformance('live-alpha-background-compare', 'sync-cpu', comparisonStartedAt, { mutationId, branch })

      const putPixelsStartedAt = this.performanceListener ? performance.now() : 0
      ctx.putImageData(dryPixels, 0, 0)
      this.recordPerformance('live-alpha-put-pixels', 'sync-cpu', putPixelsStartedAt, { mutationId, branch })
    }

    const drawDisplayStartedAt = this.performanceListener ? performance.now() : 0
    ctx.drawImage(this.dualCanvas.displayCanvas, 0, 0)
    this.recordPerformance('live-alpha-draw-display', 'sync-cpu', drawDisplayStartedAt, { mutationId, branch })
    return canvas
  }

  // ================================================================
  //  PUBLIC — Animation Player Hooks (per D-07)
  // ================================================================

  /** Get a deep copy of all recorded strokes (for AnimationPlayer, per D-07) */
  getStrokes(): PaintStroke[] {
    return this.allActions.map(s => ({
      ...s,
      points: s.points.map(p => ({ ...p })),
      params: { ...s.params },
    }))
  }

  getStrokeCount(): number {
    return this.allActions.length
  }

  /** Accept one immutable recorded logical brush through the normal mutation pipeline. */
  enqueueRecordedStroke(group: Readonly<RecordedStrokeGroup>): number {
    this.requestRender()
    const primary = this.cloneRecordedStroke(group.primary)
    if (primary.points.length === 0 || primary.diffusionFrames !== undefined) {
      throw new TypeError('Recorded stroke primary must contain points and cannot be a continuation')
    }

    if ((group.continuations?.length ?? 0) > 0 && primary.tool !== 'paint') {
      throw new TypeError('Recorded diffusion continuations require a paint primary')
    }

    const continuations = (group.continuations ?? []).map((continuation) => {
      const cloned = this.cloneRecordedStroke(continuation)
      if (cloned.points.length !== 0 || !Number.isFinite(cloned.diffusionFrames) || Math.trunc(cloned.diffusionFrames ?? 0) <= 0) {
        throw new TypeError('Recorded stroke continuations must be zero-point diffusion records')
      }
      return cloned
    })

    return this.acceptStroke(primary, continuations, undefined, true)
  }

  /** Lock/unlock pointer input (per D-11: painting disabled during animation) */
  setInputLocked(locked: boolean): void {
    this.inputLocked = locked
  }

  /** Render all strokes synchronously — public wrapper around redrawAll() */
  renderAllStrokes(): void {
    this.requestRender()
    this.flushPendingStrokeFinalizations()
    this.redrawAll()
  }

  /** Enter/exit animation mode — skips compositing in render loop */
  setAnimationMode(mode: boolean): void {
    this.animationMode = mode
    if (mode) this.requestRender()
  }

  /** Render strokes up to specified point counts — used by progressive playback consumers. */
  renderPartialStrokes(strokeData: Array<{ stroke: PaintStroke; pointCount: number }>): void {
    this.requestRender()
    this.flushPendingStrokeFinalizations()
    this.resetReplaySurface(true)

    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)

    for (const { stroke: a, pointCount } of strokeData) {
      const pts = pointCount >= a.points.length ? a.points : a.points.slice(0, pointCount)
      const completeStroke = pointCount >= a.points.length
      this.applyStrokeToEngine(a.tool, pts, a.color, a.params, { startNaturalDrying: false, hasPenInput: this.strokeHasPenInput(a), physicsMode: a.physicsMode })
      if (completeStroke) this.replayDiffusion(a.diffusionFrames || 0, sampleHFn, a.physicsMode)
    }

    this.renderVisibleWetLayer()
  }

  /** Render a progressive frame and return paint alpha without paper or preview background. */
  renderProgressiveAlphaFrame(strokeData: Array<{ stroke: PaintStroke; pointCount: number }>): HTMLCanvasElement {
    this.renderPartialStrokes(strokeData)
    return this.copyLiveAlphaCanvas()
  }

  // ================================================================
  //  PRIVATE — Render Loop
  // ================================================================

  private render(): void {
    if (this.destroyed) return

    // In animation mode, skip compositing — AnimationPlayer controls rendering
    if (this.animationMode) {
      this.rafId = requestAnimationFrame(() => this.render())
      return
    }

    const displayCtx = this.dualCanvas.displayCtx

    // Full wet composite runs only when the paint pixels changed (a drain step,
    // a drying step, or an explicit re-render). Overlay-only frames update the
    // queued outlines, the live stroke, and the cursor incrementally on top of
    // the previous composite — the compositor then uploads only the small
    // changed regions instead of the whole canvas every frame (the sustained
    // full-canvas upload churn that killed the WKWebView GPU process).
    if (this.displayCompositeDirty) {
      this.compositeDisplayNow()
      // The composite cleared the canvas — redraw every overlay on top.
      this.drawQueuedStrokePreviews(displayCtx)
      this.drawnQueuedOutlineCount = this.getQueuedStrokePreviews().length
      drawStrokePreview(displayCtx, this.previewStroke)
      this.lastPreviewBbox = this.previewStroke ? this.overlayBoundsForPreview(this.previewStroke) : null
      drawBrushCursor(displayCtx, this.cursorX, this.cursorY, brushRenderRadius(this.state.brushOpts), this.state.tool, this.width, this.height)
      this.lastCursorRect = this.overlayBoundsForCursor()
    } else {
      // 1. New queued stroke outlines. Append-only: the preview list only grows
      // between composites (a finalize re-runs the composite, which clears and
      // redraws every outline from scratch).
      const queued = this.getQueuedStrokePreviews()
      if (this.drawnQueuedOutlineCount < queued.length) {
        for (let i = this.drawnQueuedOutlineCount; i < queued.length; i++) this.drawQueuedStrokePreview(displayCtx, queued[i].points)
        this.drawnQueuedOutlineCount = queued.length
      }

      // 2. Live stroke preview: the smoothed ribbon shifts as points are added,
      // so the previous ribbon must be erased and the full ribbon redrawn.
      // Skipped while the stroke is stationary (no growth → no pixel change).
      const preview = this.previewStroke
      if (preview) {
        const bbox = this.overlayBoundsForPreview(preview)
        if (!this.lastPreviewBbox || bbox.x0 !== this.lastPreviewBbox.x0 || bbox.y0 !== this.lastPreviewBbox.y0 || bbox.x1 !== this.lastPreviewBbox.x1 || bbox.y1 !== this.lastPreviewBbox.y1) {
          if (this.lastPreviewBbox) {
            this.restoreDisplayRect(this.lastPreviewBbox)
            this.lastCursorRect = null // the restore erased the cursor at the pen tip — redraw below
          }
          drawStrokePreview(displayCtx, preview)
          this.lastPreviewBbox = bbox
        }
      } else if (this.lastPreviewBbox) {
        // Pen-up: the live ribbon disappears — the queued outline takes over.
        this.restoreDisplayRect(this.lastPreviewBbox)
        this.lastPreviewBbox = null
        this.lastCursorRect = null // the restore erased the cursor at the pen tip — redraw below
      }

      // 3. Brush cursor: erase the previous rect (restoring the composite and
      // the overlays under it), then draw at the new position.
      const cursorRect = this.overlayBoundsForCursor()
      if (cursorRect) {
        if (!this.lastCursorRect || cursorRect.x0 !== this.lastCursorRect.x0 || cursorRect.y0 !== this.lastCursorRect.y0 || cursorRect.x1 !== this.lastCursorRect.x1 || cursorRect.y1 !== this.lastCursorRect.y1) {
          if (this.lastCursorRect) this.restoreDisplayRect(this.lastCursorRect)
          drawBrushCursor(displayCtx, this.cursorX, this.cursorY, brushRenderRadius(this.state.brushOpts), this.state.tool, this.width, this.height)
          this.lastCursorRect = cursorRect
        }
      } else if (this.lastCursorRect) {
        this.restoreDisplayRect(this.lastCursorRect)
        this.lastCursorRect = null
      }
    }

    // Finalized pixels yield to active input and preview rendering. Advance at most
    // one retained FIFO continuation after the visible frame has been drawn.
    this.runScheduledStrokeFinalizationFrame()

    // Pause the loop when nothing needs the display (no wet paint, no previews,
    // no cursor, no pending finalization, no physics): a hot 60fps rAF keeps the
    // WKWebView compositor busy for the whole session — the GPU process burned
    // 43% CPU while idle and died under the sustained load (the long-idle black
    // window). Any state change re-arms it through requestRender().
    if (this.shouldKeepRendering()) {
      this.rafId = requestAnimationFrame(() => this.render())
    } else {
      this.rafId = 0
    }
  }

  /** Re-arm the display loop when it is paused and something needs redrawing. */
  private requestRender(): void {
    if (this.destroyed) return
    if (this.rafId !== 0) return
    if (typeof requestAnimationFrame !== 'function') return
    this.rafId = requestAnimationFrame(() => this.render())
  }

  private shouldKeepRendering(): boolean {
    if (this.state.physicsRunning) return true
    // The drain is the render loop's pump: an unfinished finalization queue or
    // an active natural-drying step must never be paused by the idle gate —
    // stopping mid-drain froze the remaining strokes until the next input
    // (strokes rendered in bunches with long gaps). The idle gate applies to
    // preview/cursor/outline redraws only, which do not need the display while
    // the user is away. A long-idle session must not keep the WKWebView
    // compositor busy (the sustained-load black window).
    if (this.pendingStrokeFinalizations.length > 0 || this.activeStrokeFinalization !== null) return true
    if (this.dryingInterval) return true
    if (performance.now() - this.lastRenderActivityTime >= RENDER_IDLE_MS) return false
    if (this.previewStroke !== null) return true
    if (this.getQueuedStrokePreviews().length > 0) return true
    if (this.cursorX >= 0) return true
    return false
  }

  /** Full wet composite into the display, keeping the scratch an exact mirror. */
  private compositeDisplayNow(): void {
    const displayCtx = this.dualCanvas.displayCtx
    const scratch = this.wetDisplayScratch
    // The scratch must mirror the composite EXACTLY: stale wet pixels from a
    // previous composite would be resurrected by overlay rect restores.
    if (scratch) scratch.data.fill(0)
    displayCtx.clearRect(0, 0, this.width, this.height)
    // Composite wet layer onto display (D-04: per-pixel strokeOpacity, no global userOpacity)
    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)
    compositeWetLayer(displayCtx, this.wet, this.width, this.height, sampleHFn, scratch ?? undefined)
    this.displayCompositeDirty = false
    // The composite cleared the display — every overlay must be redrawn from
    // scratch by the next overlay pass.
    this.drawnQueuedOutlineCount = 0
    this.lastPreviewBbox = null
    this.lastCursorRect = null
  }

  /**
   * Restore a display rect to the last composite, then redraw the overlays
   * clipped to it (the restore erased them). Used to erase the old cursor and
   * the live ribbon without a full-canvas re-composite — the compositor
   * uploads only this small region.
   */
  private restoreDisplayRect(rect: { x0: number; y0: number; x1: number; y1: number }): void {
    const x0 = Math.max(0, Math.floor(rect.x0))
    const y0 = Math.max(0, Math.floor(rect.y0))
    const x1 = Math.min(this.width, Math.ceil(rect.x1))
    const y1 = Math.min(this.height, Math.ceil(rect.y1))
    if (x1 <= x0 || y1 <= y0) return
    const displayCtx = this.dualCanvas.displayCtx
    const scratch = this.wetDisplayScratch
    if (scratch) {
      const w = x1 - x0
      const h = y1 - y0
      const restored = displayCtx.createImageData(w, h)
      const src = scratch.data
      const dst = restored.data
      for (let row = 0; row < h; row++) {
        const srcOff = ((y0 + row) * this.width + x0) * 4
        dst.set(src.subarray(srcOff, srcOff + w * 4), row * w * 4)
      }
      displayCtx.putImageData(restored, x0, y0)
    } else {
      displayCtx.clearRect(x0, y0, x1 - x0, y1 - y0)
    }
    // The restore erased the overlays inside the rect — redraw the queued
    // outlines and the live ribbon clipped to it (exactly one extra draw, so
    // the dashed outline alpha does not accumulate over frames).
    displayCtx.save()
    displayCtx.beginPath()
    displayCtx.rect(x0, y0, x1 - x0, y1 - y0)
    displayCtx.clip()
    for (const pending of this.getQueuedStrokePreviews()) this.drawQueuedStrokePreview(displayCtx, pending.points)
    if (this.previewStroke) drawStrokePreview(displayCtx, this.previewStroke)
    displayCtx.restore()
  }

  private overlayBoundsForCursor(): { x0: number; y0: number; x1: number; y1: number } | null {
    if (this.cursorX < 0) return null
    const r = brushRenderRadius(this.state.brushOpts)
    // The dual-ring cursor (radius + 3px stroke width) and the 6px crosshair
    // arms both fit inside a r+7 box.
    const m = Math.max(r + 3, 7)
    return { x0: this.cursorX - m, y0: this.cursorY - m, x1: this.cursorX + m, y1: this.cursorY + m }
  }

  private overlayBoundsForPreview(preview: StrokePreview): { x0: number; y0: number; x1: number; y1: number } {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const p of preview.pts) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y)
      x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y)
    }
    if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 0, y1: 0 }
    const m = Math.ceil(preview.radius) + 3
    return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m }
  }

  // ================================================================
  //  PRIVATE — Deferred Stroke Finalization
  // ================================================================

  private cloneDeferredFinalization(pending: DeferredStrokeFinalization): DeferredStrokeFinalization {
    return {
      ...pending,
      points: pending.points.map((point) => ({ ...point })),
      opts: { ...pending.opts },
      queuedAt: performance.now(),
    }
  }

  private cloneRecordedStroke(stroke: Readonly<PaintStroke>): PaintStroke {
    return {
      ...stroke,
      points: stroke.points.map((point) => ({ ...point })),
      params: { ...stroke.params },
    }
  }

  private acceptStroke(
    primaryInput: Readonly<PaintStroke>,
    continuationInputs: readonly Readonly<PaintStroke>[] = [],
    reservedMutationId?: number,
    isScripted: boolean = false,
  ): number {
    const mutationId = reservedMutationId ?? this.nextMutationId++
    const primary = this.cloneRecordedStroke(primaryInput)
    delete primary.mutationId
    const actionPoints = Object.freeze(primary.points.map((point) => Object.freeze({ ...point }))) as unknown as PenPoint[]
    const pendingPoints = Object.freeze(actionPoints.map((point) => Object.freeze({ ...point }))) as unknown as PenPoint[]
    primary.mutationId = mutationId
    primary.points = actionPoints

    const continuations = continuationInputs.map((continuationInput) => {
      const continuation = this.cloneRecordedStroke(continuationInput)
      delete continuation.mutationId
      continuation.points = []
      return continuation
    })
    const actions = [primary, ...continuations]
    this.allActions.push(...actions)

    const pending: DeferredStrokeFinalization = {
      tool: primary.tool,
      points: pendingPoints,
      color: primary.color,
      opts: { ...primary.params },
      hasPenInput: this.strokeHasPenInput(primary),
      physicsMode: primary.physicsMode ?? null,
      continuationFrames: continuations.reduce((total, continuation) => total + Math.max(0, Math.min(600, Math.trunc(continuation.diffusionFrames ?? 0))), 0),
      mutationId,
      queuedAt: performance.now(),
      isScripted,
    }

    this.redoStack = []
    this.undoStack.push({
      mutationId,
      actions,
      checkpoint: null,
      deferred: this.cloneDeferredFinalization(pending),
    })
    if (this.undoStack.length > 10) this.undoStack.shift()
    this.historyEntries = [...this.undoStack]
    this.historyIndex = this.undoStack.length
    this.notifyHistoryAvailability()
    this.pendingStrokeFinalizations.push(pending)
    this.markStrokeHandoffComplete()
    this.scheduleStrokeFinalization()
    return mutationId
  }

  private captureUndoSnapshot(mutationId: number): UndoSnapshot {
    const readbackStartedAt = this.performanceListener ? performance.now() : 0
    const snap = this.dualCanvas.dryCtx.getImageData(0, 0, this.width, this.height)
    this.recordPerformance('undo-dry-readback', 'sync-cpu', readbackStartedAt, { mutationId })

    const wetCopyStartedAt = this.performanceListener ? performance.now() : 0
    const wetSnap = {
      r: new Uint8Array(this.wet.r),
      g: new Uint8Array(this.wet.g),
      b: new Uint8Array(this.wet.b),
      a: quantizeScaledUint16(this.wet.alpha, 1 / UNDO_ALPHA_SCALE),
      w: new Uint16Array(this.wet.wetness),
      dp: new Uint16Array(this.drying.dryPos),
      so: quantizeScaledUint16(this.wet.strokeOpacity, UNDO_OPACITY_SCALE),
    }
    this.recordPerformance('undo-wet-buffer-copy', 'sync-cpu', wetCopyStartedAt, { mutationId })

    const savedCopyStartedAt = this.performanceListener ? performance.now() : 0
    const savedSnap = {
      r: new Uint8Array(this.savedWet.r),
      g: new Uint8Array(this.savedWet.g),
      b: new Uint8Array(this.savedWet.b),
      a: quantizeScaledUint16(this.savedWet.alpha, 1 / UNDO_ALPHA_SCALE),
      so: quantizeScaledUint16(this.savedWet.strokeOpacity, UNDO_OPACITY_SCALE),
    }
    this.recordPerformance('undo-saved-wet-buffer-copy', 'sync-cpu', savedCopyStartedAt, { mutationId })

    return { mutationId, canvas: snap, wet: wetSnap, saved: savedSnap }
  }

  private getQueuedStrokePreviews(): DeferredStrokeFinalization[] {
    const active = this.activeStrokeFinalization
    if (!active || active.phase === 'prepare' || active.phase === 'raster') {
      return this.pendingStrokeFinalizations
    }
    return this.pendingStrokeFinalizations.filter((pending) => pending !== active.pending)
  }

  private drawQueuedStrokePreview(
    displayCtx: CanvasRenderingContext2D,
    points: readonly PenPoint[],
  ): void {
    drawQueuedStrokePolyline(displayCtx, points)
  }

  private drawQueuedStrokePreviews(displayCtx: CanvasRenderingContext2D): void {
    for (const pending of this.getQueuedStrokePreviews()) {
      this.drawQueuedStrokePreview(displayCtx, pending.points)
    }
  }

  private markStrokeHandoffComplete(): void {
    this.lastStrokeHandoffTime = performance.now()
  }

  private scheduleStrokeFinalization(): void {
    if (this.strokeFinalizationScheduled || (this.pendingStrokeFinalizations.length === 0 && !this.activeStrokeFinalization)) return
    this.strokeFinalizationScheduled = true
    this.requestRender()
  }

  private hasPendingInput(): boolean {
    const scheduling = (navigator as Navigator & {
      scheduling?: { isInputPending?: (options?: { includeContinuous?: boolean }) => boolean }
    }).scheduling
    return scheduling?.isInputPending?.({ includeContinuous: true }) ?? false
  }

  private runScheduledStrokeFinalizationFrame(): void {
    if (!this.strokeFinalizationScheduled || this.destroyed) return
    const lastInteractionTime = Math.max(this.lastPointerInputTime, this.lastStrokeHandoffTime)
    if (
      this.state.drawing ||
      performance.now() - lastInteractionTime < STROKE_FINALIZATION_IDLE_MS ||
      this.hasPendingInput()
    ) return
    this.strokeFinalizationScheduled = false
    // Layer 3 coalescing is now SCRIPTED-ONLY: a scripted burst (Roto script
    // apply enqueueing many strokes inside the inactivity window) drains in one
    // turn so the canvas shows a single completed render, never intermediate
    // per-stroke physics renders. Interactive strokes NEVER coalesce — a burst
    // of user strokes must pace one phase step per visual frame, because a
    // synchronous multi-stroke drain blocks the main thread for hundreds of ms
    // (breaking the next stroke's curve) and a large queue blocks for seconds
    // (the long-idle black window). The drain is also bounded per frame so even
    // a huge scripted burst cannot stall the webview.
    const queued = this.pendingStrokeFinalizations
    const allScripted = queued.length > 1 && queued.every((pending) => pending.isScripted)
    if (allScripted) {
      this.runStrokeFinalizationTurn(true, MAX_COALESCED_STROKES_PER_FRAME, Infinity)
    } else {
      // Interactive strokes batch a bounded number of phase steps per visual
      // frame — one step per frame drains at ~1 stroke/second, so a long
      // painting session's queue takes minutes to finalize. Batching keeps the
      // final render fast while the per-frame block stays small (the drain
      // only runs in the 500ms inactivity window, never mid-stroke).
      this.runStrokeFinalizationTurn(false, Infinity, MAX_INTERACTIVE_STEPS_PER_FRAME)
    }
    if (this.pendingStrokeFinalizations.length > 0 || this.activeStrokeFinalization) {
      this.strokeFinalizationScheduled = true
    }
  }

  public flushPendingStrokeFinalizations(): void {
    this.requestRender()
    while (this.pendingStrokeFinalizations.length > 0 || this.activeStrokeFinalization) {
      this.runStrokeFinalizationTurn(true, Infinity, Infinity)
    }
    this.strokeFinalizationScheduled = false
  }

  private startNextStrokeFinalization(): ActiveStrokeFinalization | null {
    const pending = this.pendingStrokeFinalizations[0]
    if (!pending) return null
    if (this.performanceListener) {
      this.performanceListener({
        stage: 'stroke-finalization-queue-wait',
        category: 'scheduled-wait',
        durationMs: performance.now() - pending.queuedAt,
        timestamp: performance.now(),
        mutationId: pending.mutationId,
      })
    }
    this.activeMutationId = pending.mutationId
    const historyEntry = this.undoStack.find((entry) => entry.mutationId === pending.mutationId)
    if (historyEntry && !historyEntry.checkpoint) {
      historyEntry.checkpoint = this.captureUndoSnapshot(pending.mutationId)
    }
    return {
      pending,
      generation: this.strokeFinalizationGeneration,
      finalizationStartedAt: this.performanceListener ? performance.now() : 0,
      phase: pending.tool === 'paint' && pending.color ? 'prepare' : 'complete',
      raster: null,
      fluid: null,
      continuationFrame: 0,
    }
  }

  private runStrokeFinalizationTurn(flush: boolean = false, maxStrokes: number = Infinity, maxSteps: number = 1): void {
    let completedStrokes = 0
    let steps = 0
    do {
      const active = this.activeStrokeFinalization ?? this.startNextStrokeFinalization()
      if (!active) return
      this.activeStrokeFinalization = active
      if (active.generation !== this.strokeFinalizationGeneration) {
        this.activeStrokeFinalization = null
        this.activeMutationId = null
        return
      }
      if (active.phase === 'complete' || active.pending.tool !== 'paint' || !active.pending.color) {
        this.finishActiveStrokeSynchronously(active)
        completedStrokes++
        continue
      }
      do {
        this.stepInteractivePaintFinalization(active)
        steps++
      } while (flush && this.activeStrokeFinalization === active && steps < maxSteps)
      completedStrokes++
    } while ((flush || steps < maxSteps) && completedStrokes < maxStrokes && (this.pendingStrokeFinalizations.length > 0 || this.activeStrokeFinalization))
  }

  private finishActiveStrokeSynchronously(active: ActiveStrokeFinalization): void {
    const { pending } = active
    const applyStartedAt = this.performanceListener ? performance.now() : 0
    if (pending.tool !== 'paint' || !pending.color) {
      this.applyStrokeToEngine(pending.tool, pending.points, pending.color, pending.opts, {
        startNaturalDrying: true,
        hasPenInput: pending.hasPenInput,
        physicsMode: pending.physicsMode,
      })
    }
    this.recordPerformance('stroke-apply', 'sync-cpu', applyStartedAt, { mutationId: pending.mutationId })
    this.completeActiveStrokeFinalization(active)
  }

  private completeActiveStrokeFinalization(active: ActiveStrokeFinalization): void {
    if (active.generation !== this.strokeFinalizationGeneration) return
    const pending = active.pending
    if (this.pendingStrokeFinalizations[0] === pending) this.pendingStrokeFinalizations.shift()
    this.recordPerformance('stroke-finalization', 'sync-cpu', active.finalizationStartedAt, { mutationId: pending.mutationId })
    const historyEntry = this.undoStack.find((entry) => entry.mutationId === pending.mutationId)
    if (historyEntry) historyEntry.deferred = null
    this.notifyCompletedMutation(pending.tool, pending.mutationId)
    this.activeStrokeFinalization = null
    this.activeMutationId = null
  }

  private stepInteractivePaintFinalization(active: ActiveStrokeFinalization): void {
    // Every finalization step mutates the wet/dry pixels — the next render
    // frame re-composites the display.
    this.displayCompositeDirty = true
    const { pending } = active
    const observePrimitive = this.performanceListener ? this.recordPaintPrimitive.bind(this) : undefined
    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)
    const renderOpts = { ...pending.opts, size: brushRenderRadius(pending.opts) }

    if (active.phase === 'prepare') {
      this.prepareWetLayerForStroke(pending.points[0], pending.opts, pending.physicsMode)
      active.raster = createPaintStrokeRasterContinuation(
        pending.points, pending.color!, renderOpts,
        this.dualCanvas.dryCtx, this.wet, this.paperHeight,
        this.width, this.height, pending.hasPenInput,
        this.state.embossStrength, this.state.embossStack,
        pending.opts.waterAmount / 100, sampleHFn, observePrimitive,
      )
      active.phase = 'raster'
      return
    }

    if (active.phase === 'raster') {
      if (active.raster!.step()) {
        active.phase = 'post-raster'
        this.recordPerformance('stroke-first-raster-publication', 'scheduled-wait', pending.queuedAt, { mutationId: pending.mutationId })
      }
      return
    }

    if (active.phase === 'post-raster') {
      if (pending.opts.antiAlias > 0) {
        const brushR = brushRenderRadius(pending.opts)
        const strokeBounds = curveBounds(pending.points, brushR + 10, this.width, this.height)
        featherWetEdges(this.wet,
          { x0: strokeBounds.x0, y0: strokeBounds.y0, x1: strokeBounds.x0 + strokeBounds.w, y1: strokeBounds.y0 + strokeBounds.h },
          this.width, this.height, pending.opts.antiAlias * 2, observePrimitive)
      }
      const savedWetStartedAt = observePrimitive ? performance.now() : 0
      this.lastStrokeMask.fill(0)
      for (let i = 0; i < this.size; i++) {
        if (this.wet.alpha[i] <= 1) continue
        if (this.wet.alpha[i] > this.savedWet.alpha[i]) {
          const blend = this.wet.alpha[i] / (this.savedWet.alpha[i] + this.wet.alpha[i])
          this.savedWet.r[i] = lerp(this.savedWet.r[i], this.wet.r[i], blend)
          this.savedWet.g[i] = lerp(this.savedWet.g[i], this.wet.g[i], blend)
          this.savedWet.b[i] = lerp(this.savedWet.b[i], this.wet.b[i], blend)
          this.savedWet.alpha[i] = Math.max(this.savedWet.alpha[i], this.wet.alpha[i])
        }
        const existingOp = this.savedWet.strokeOpacity[i]
        const newOp = this.wet.strokeOpacity[i]
        this.savedWet.strokeOpacity[i] = existingOp + newOp * (1 - existingOp)
        this.lastStrokeMask[i] = 1
      }
      if (observePrimitive) observePrimitive('paint-saved-wet-full-frame-scan', performance.now() - savedWetStartedAt)

      if (pending.physicsMode === 'local') {
        const brushR = brushRenderRadius(pending.opts)
        let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
        for (const p of pending.points) {
          sx0 = Math.min(sx0, p.x); sy0 = Math.min(sy0, p.y)
          sx1 = Math.max(sx1, p.x); sy1 = Math.max(sy1, p.y)
        }
        const waterFrac = pending.opts.waterAmount / 100
        const spreadFrac = this.state.localSpreadStrength / 100
        const spreadCurve = spreadFrac * spreadFrac
        const waterCurve = waterFrac * waterFrac
        const margin = Math.ceil(2 + waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4)
        active.fluid = createLocalFluidPhysicsContinuation(
          this.wet, this.fluidConfig, this.width, this.height,
          {
            x0: Math.max(0, Math.floor(sx0 - brushR - margin)),
            y0: Math.max(0, Math.floor(sy0 - brushR - margin)),
            x1: Math.min(this.width - 1, Math.ceil(sx1 + brushR + margin)),
            y1: Math.min(this.height - 1, Math.ceil(sy1 + brushR + margin)),
          },
          Math.max(1, Math.ceil(spreadCurve * 10)), observePrimitive,
        )
        active.phase = 'fluid'
        return
      }
      forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height, observePrimitive, 'paint-final-force-dry')
      this.finishInteractivePaintFinalization(active)
      return
    }

    if (active.phase === 'fluid' && active.fluid?.step()) {
      this.startNaturalDrying()
      this.finishInteractivePaintFinalization(active)
      return
    }

    if (active.phase === 'continuation') {
      const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)
      this.replayDiffusionFrame(active.continuationFrame, sampleHFn, pending.physicsMode)
      active.continuationFrame += 1
      if (active.continuationFrame >= pending.continuationFrames) this.completeActiveStrokeFinalization(active)
    }
  }

  private finishInteractivePaintFinalization(active: ActiveStrokeFinalization): void {
    const { pending } = active
    let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
    for (const p of pending.points) {
      sx0 = Math.min(sx0, p.x); sy0 = Math.min(sy0, p.y)
      sx1 = Math.max(sx1, p.x); sy1 = Math.max(sy1, p.y)
    }
    const brushR = brushRenderRadius(pending.opts)
    this.lastStrokeBounds = {
      x0: Math.floor(sx0 - brushR), y0: Math.floor(sy0 - brushR),
      x1: Math.ceil(sx1 + brushR), y1: Math.ceil(sy1 + brushR),
    }
    if (pending.continuationFrames > 0) {
      active.phase = 'continuation'
      return
    }
    this.completeActiveStrokeFinalization(active)
  }

  private renderVisibleWetLayer(): void {
    this.requestRender()
    this.compositeDisplayNow()
  }

  private getDryRestoreData(): ImageData | null {
    return this.previewBaseEnabled ? null : this.bgData
  }

  private redrawPreviewBase(): void {
    this.dualCanvas.previewBaseCtx.clearRect(0, 0, this.width, this.height)
    if (!this.previewBaseEnabled || !this.previewBaseImage) return
    this.dualCanvas.previewBaseCtx.drawImage(this.bgCanvas, 0, 0)
    this.dualCanvas.previewBaseCtx.drawImage(this.previewBaseImage, 0, 0, this.width, this.height)
  }

  private resetReplaySurface(usePutImageData: boolean = false): void {
    this.stopNaturalDrying()
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    this.redrawPreviewBase()
    this.dualCanvas.dryCtx.clearRect(0, 0, this.width, this.height)
    if (!this.previewBaseEnabled) {
      if (usePutImageData) {
        const bgPixels = this.bgCtx.getImageData(0, 0, this.width, this.height)
        this.dualCanvas.dryCtx.putImageData(bgPixels, 0, 0)
      } else {
        this.dualCanvas.dryCtx.drawImage(this.bgCanvas, 0, 0)
      }
    }
    clearWetLayer(this.wet, this.savedWet, this.drying.dryPos, this.blowDX, this.blowDY, this.lastStrokeMask)
    this.fluid.u.fill(0); this.fluid.v.fill(0)
    this.fluid.u0.fill(0); this.fluid.v0.fill(0)
    this.fluid.p.fill(0); this.fluid.div.fill(0)
    this.renderVisibleWetLayer()
  }

  private prepareWetLayerForStroke(
    pt: PenPoint,
    opts: BrushOpts,
    physicsMode: PhysicsMode = this.state.physicsMode === 'local' ? 'local' : null,
  ): void {
    const observePrimitive = this.performanceListener ? this.recordPaintPrimitive.bind(this) : undefined
    if (physicsMode === 'local') {
      const keepR = brushRenderRadius(opts) * 3 + 40
      const keepR2 = keepR * keepR
      const readbackStartedAt = observePrimitive ? performance.now() : 0
      const id = this.dualCanvas.dryCtx.getImageData(0, 0, this.width, this.height)
      if (observePrimitive) observePrimitive('paint-pre-stroke-local-full-frame-readback', performance.now() - readbackStartedAt)
      const d = id.data
      let changed = false
      const pixelLoopStartedAt = observePrimitive ? performance.now() : 0
      for (let i = 0; i < this.size; i++) {
        if (this.wet.alpha[i] < 1) continue
        const x = i % this.width, y = (i / this.width) | 0
        const dx = x - pt.x, dy = y - pt.y
        if (dx * dx + dy * dy > keepR2) {
          const pixelOpacity = this.wet.strokeOpacity[i]
          const displayAlpha = wetDisplayAlpha(this.wet.alpha[i], pixelOpacity, sampleH(this.paperHeight, x, y, this.width, this.height)) / 255
          if (displayAlpha > 0.005) {
            const pi = i * 4, ma = d[pi + 3] / 255
            const oa = Math.min(1, ma + displayAlpha * (1 - ma))
            const bt = displayAlpha / Math.max(0.005, oa)
            d[pi] = Math.round(clamp(lerp(d[pi], this.wet.r[i], bt), 0, 255))
            d[pi + 1] = Math.round(clamp(lerp(d[pi + 1], this.wet.g[i], bt), 0, 255))
            d[pi + 2] = Math.round(clamp(lerp(d[pi + 2], this.wet.b[i], bt), 0, 255))
            d[pi + 3] = Math.round(clamp(oa * 255, 0, 255))
            changed = true
          }
          this.wet.alpha[i] = 0; this.wet.wetness[i] = 0
          this.wet.r[i] = 0; this.wet.g[i] = 0; this.wet.b[i] = 0
          this.wet.strokeOpacity[i] = 0
          this.drying.dryPos[i] = 0
        }
      }
      if (observePrimitive) observePrimitive('paint-pre-stroke-local-pixel-loop', performance.now() - pixelLoopStartedAt)
      if (changed) {
        const writebackStartedAt = observePrimitive ? performance.now() : 0
        this.dualCanvas.dryCtx.putImageData(id, 0, 0)
        if (observePrimitive) observePrimitive('paint-pre-stroke-local-full-frame-writeback', performance.now() - writebackStartedAt)
      }
      this.stopNaturalDrying()
      return
    }

    forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height, observePrimitive, 'paint-pre-stroke-force-dry')
  }

  private applyFinalizedStroke({ tool, points, color, opts, hasPenInput, physicsMode, mutationId }: DeferredStrokeFinalization, finalizationStartedAt: number): void {
    const applyStartedAt = this.performanceListener ? performance.now() : 0
    this.applyStrokeToEngine(tool, points, color, opts, { startNaturalDrying: true, hasPenInput, physicsMode })
    this.recordPerformance('stroke-apply', 'sync-cpu', applyStartedAt, { mutationId })
    this.recordPerformance('stroke-finalization', 'sync-cpu', finalizationStartedAt, { mutationId })
    this.notifyCompletedMutation(tool, mutationId)
  }

  private notifyCompletedMutation(kind: CompletedPaintMutation['kind'], mutationId: number = this.nextMutationId++): void {
    this.lastCompletedMutationId = mutationId
    const listenerStartedAt = this.performanceListener ? performance.now() : 0
    this.completedMutationListener?.({ kind, isEmpty: this.allActions.length === 0, mutationId })
    this.recordPerformance('completed-mutation-listener', 'sync-cpu', listenerStartedAt, { mutationId })
  }

  private strokeHasPenInput(stroke: PaintStroke): boolean {
    return stroke.hasPenInput ?? stroke.points.some(p => p.p !== 0.5)
  }

  private applyStrokeToEngine(
    tool: ToolType,
    points: PenPoint[],
    color: string | null,
    opts: BrushOpts,
    options: StrokeApplicationOptions = {},
  ): void {
    if (points.length === 0) return
    this.displayCompositeDirty = true

    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)
    const observePrimitive = this.performanceListener ? this.recordPaintPrimitive.bind(this) : undefined
    const hasPenInput = options.hasPenInput ?? this.state.hasPenInput
    const renderOpts = { ...opts, size: brushRenderRadius(opts) }
    const previousPhysicsMode = this.state.physicsMode
    if (options.physicsMode !== undefined) this.state.physicsMode = options.physicsMode

    try {
    if (tool === 'paint' && color) {
      this.prepareWetLayerForStroke(points[0], opts)
      renderPaintStroke(
        points, color, renderOpts,
        this.dualCanvas.dryCtx, this.wet, this.savedWet,
        this.drying.dryPos, this.lastStrokeMask,
        this.paperHeight,
        this.width, this.height,
        hasPenInput, this.state.wetPaper,
        this.state.embossStrength, this.state.embossStack,
        opts.waterAmount / 100,
        sampleHFn,
        observePrimitive,
      )
      // Edge feathering on wet layer for anti-aliased brush edges
      if (opts.antiAlias > 0) {
        const brushR = brushRenderRadius(opts)
        const strokeBounds = curveBounds(points, brushR + 10, this.width, this.height)
        // Passes: soft=2, med=4, high=6
        const featherPasses = opts.antiAlias * 2
        featherWetEdges(this.wet,
          { x0: strokeBounds.x0, y0: strokeBounds.y0, x1: strokeBounds.x0 + strokeBounds.w, y1: strokeBounds.y0 + strokeBounds.h },
          this.width, this.height, featherPasses, observePrimitive)
      }
      // Save clean wet layer (accumulate with previously saved data)
      const savedWetStartedAt = observePrimitive ? performance.now() : 0
      this.lastStrokeMask.fill(0)
      for (let i = 0; i < this.size; i++) {
        if (this.wet.alpha[i] > 1) {
          if (this.wet.alpha[i] > this.savedWet.alpha[i]) {
            const blend = this.wet.alpha[i] / (this.savedWet.alpha[i] + this.wet.alpha[i])
            this.savedWet.r[i] = lerp(this.savedWet.r[i], this.wet.r[i], blend)
            this.savedWet.g[i] = lerp(this.savedWet.g[i], this.wet.g[i], blend)
            this.savedWet.b[i] = lerp(this.savedWet.b[i], this.wet.b[i], blend)
            this.savedWet.alpha[i] = Math.max(this.savedWet.alpha[i], this.wet.alpha[i])
          }
          // Porter-Duff accumulate strokeOpacity across strokes
          const existingOp = this.savedWet.strokeOpacity[i]
          const newOp = this.wet.strokeOpacity[i]
          this.savedWet.strokeOpacity[i] = existingOp + newOp * (1 - existingOp)
          this.lastStrokeMask[i] = 1
        }
      }
      if (observePrimitive) observePrimitive('paint-saved-wet-full-frame-scan', performance.now() - savedWetStartedAt)

      // D-05/D-07: Local physics -- run Stam solver on stroke bbox
      if (this.state.physicsMode === 'local' && points.length > 0) {
        const brushR = brushRenderRadius(opts)
        let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
        for (const p of points) {
          sx0 = Math.min(sx0, p.x); sy0 = Math.min(sy0, p.y)
          sx1 = Math.max(sx1, p.x); sy1 = Math.max(sy1, p.y)
        }
        // D-06: margin and ticks scale with brush size, water, and spread
        const waterFrac = opts.waterAmount / 100
        const spreadFrac = this.state.localSpreadStrength / 100
        const spreadCurve = spreadFrac * spreadFrac
        const waterCurve = waterFrac * waterFrac
        const margin = Math.ceil(2 + waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4)
        const bx0 = Math.max(0, Math.floor(sx0 - brushR - margin))
        const by0 = Math.max(0, Math.floor(sy0 - brushR - margin))
        const bx1 = Math.min(this.width - 1, Math.ceil(sx1 + brushR + margin))
        const by1 = Math.min(this.height - 1, Math.ceil(sy1 + brushR + margin))

        const localBounds = { x0: bx0, y0: by0, x1: bx1, y1: by1 }
        const ticks = Math.max(1, Math.ceil(spreadCurve * 10))
        const localPhysicsStartedAt = observePrimitive ? performance.now() : 0
        localFluidPhysicsStep(
          this.wet, this.fluidConfig,
          this.width, this.height,
          localBounds, ticks,
          observePrimitive,
        )
        if (observePrimitive) observePrimitive('paint-local-fluid-total', performance.now() - localPhysicsStartedAt)
      }

      // Bake to canvas — in local mode, keep wet for stroke interaction
      if (this.state.physicsMode !== 'local') {
        forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height, observePrimitive, 'paint-final-force-dry')
      } else if (options.startNaturalDrying) {
        // Start natural drying timer (research: paint dries over time via evaporation)
        this.startNaturalDrying()
      }
    } else if (tool === 'erase') {
      applyEraseStroke(
        points, renderOpts,
        this.dualCanvas.dryCtx, this.wet,
        this.width, this.height,
        hasPenInput,
        this.state.embossStrength,
        this.paperHeight,
        this.state.bgMode,
        this.getDryRestoreData(),
        observePrimitive,
      )
      forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height, observePrimitive, 'erase-final-force-dry')
    }

    // Compute last stroke bounding box for physics "Last" mode
    if (points.length > 0) {
      let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
      for (const p of points) {
        sx0 = Math.min(sx0, p.x); sy0 = Math.min(sy0, p.y)
        sx1 = Math.max(sx1, p.x); sy1 = Math.max(sy1, p.y)
      }
      const brushR = brushRenderRadius(opts)
      this.lastStrokeBounds = {
        x0: Math.floor(sx0 - brushR),
        y0: Math.floor(sy0 - brushR),
        x1: Math.ceil(sx1 + brushR),
        y1: Math.ceil(sy1 + brushR),
      }
    }
    } finally {
      this.state.physicsMode = previousPhysicsMode
    }
  }

  // ================================================================
  //  PRIVATE — Pointer Events
  // ================================================================

  private onPointerDown(e: PointerEvent): void {
    if (this.inputLocked) return
    this.requestRender()
    const handlerStartedAt = performance.now()
    if (this.performanceListener) {
      const dispatchDelay = handlerStartedAt - e.timeStamp
      if (dispatchDelay >= 0 && dispatchDelay < 60_000) {
        this.performanceListener({
          stage: 'next-pointerdown-dispatch',
          category: 'input-delay',
          durationMs: dispatchDelay,
          timestamp: handlerStartedAt,
          ...(this.lastCompletedMutationId !== null ? { mutationId: this.lastCompletedMutationId } : {}),
        })
      }
      this.lastCompletedMutationId = null
    }
    e.preventDefault()
    this.lastPointerInputTime = handlerStartedAt
    this.lastRenderActivityTime = performance.now()
    this.dualCanvas.dryCanvas.setPointerCapture(e.pointerId)
    this.state.drawing = true
    this.rawPts = []
    this.lastPointerSampleTimeStamp = Number.NEGATIVE_INFINITY
    this.lastAcceptedPointerSampleTimeStamp = Number.NEGATIVE_INFINITY
    this.consumePointerSamples([e])
  }

  private onPointerMove(e: PointerEvent): void {
    this.requestRender()
    // Always update cursor position
    const r = this.dualCanvas.dryCanvas.getBoundingClientRect()
    this.cursorX = (e.clientX - r.left) * (this.width / r.width)
    this.cursorY = (e.clientY - r.top) * (this.height / r.height)
    this.lastPointerInputTime = performance.now()
    this.lastRenderActivityTime = this.lastPointerInputTime

    if (!this.state.drawing) return
    e.preventDefault()

    // Handle coalesced events for smooth strokes
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : null
    this.consumePointerSamples((events && events.length > 0) ? events : [e])

    // Update stroke preview
    if (this.rawPts.length >= 2) {
      this.previewStroke = {
        pts: this.rawPts,
        color: this.state.tool === 'paint' ? this.color : this.state.tool === 'erase' ? '#ff4444' : '#888888',
        radius: brushRenderRadius(this.state.brushOpts),
        opacity: this.state.tool === 'paint' ? this.state.brushOpts.opacity / 100 : 0.3,
        hasPenInput: this.state.hasPenInput,
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.state.drawing) return
    this.requestRender()
    const pointerUpStartedAt = this.performanceListener ? performance.now() : 0
    const mutationId = this.nextMutationId++
    this.lastPointerInputTime = performance.now()
    this.lastRenderActivityTime = this.lastPointerInputTime
    const coalesced = e.getCoalescedEvents ? e.getCoalescedEvents() : null
    if (coalesced && coalesced.length > 0) this.consumePointerSamples(coalesced)
    this.consumePointerSamples([e])
    this.state.drawing = false
    this.previewStroke = null
    this.dualCanvas.dryCanvas.releasePointerCapture(e.pointerId)

    if (this.rawPts.length < 3) {
      this.rawPts = []
      this.recordPerformance('pointer-up', 'sync-cpu', pointerUpStartedAt, { mutationId, outcome: 'discarded-short-stroke' })
      return
    }

    const opts = { ...this.state.brushOpts }
    const points = this.rawPts.map(p => ({ x: p.x, y: p.y, p: p.p, tx: p.tx, ty: p.ty, tw: p.tw, spd: p.spd }))
    const hasPenInput = this.state.hasPenInput
    const colorlessTools: string[] = ['erase']
    const color = colorlessTools.includes(this.state.tool) ? null : this.color
    const playFrame = this.getStrokeMetadata?.()?.playFrame
    const acceptedMutationId = this.acceptStroke({
      tool: this.state.tool,
      points,
      color,
      params: opts,
      timestamp: Date.now(),
      hasPenInput,
      physicsMode: this.state.tool === 'paint' && this.state.physicsMode === 'local' ? 'local' : null,
      ...(Number.isInteger(playFrame) && playFrame !== undefined && playFrame >= 0 ? { playFrame } : {}),
    }, [], mutationId)
    this.rawPts = []
    this.recordPerformance('pointer-up', 'sync-cpu', pointerUpStartedAt, { mutationId: acceptedMutationId, outcome: 'queued' })
  }

  private onPointerLeave(e: PointerEvent): void {
    this.cursorX = -1
    if (this.state.drawing) this.onPointerUp(e)
    else this.requestRender()
  }

  private consumePointerSamples(events: readonly PointerEvent[]): void {
    for (const event of events) {
      if (Number.isFinite(event.timeStamp) && event.timeStamp < this.lastPointerSampleTimeStamp) continue
      const point = this.extractPenPoint(event)
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue
      if (point.x < 0 || point.y < 0 || point.x > this.width || point.y > this.height) continue
      if (Number.isFinite(event.timeStamp)) this.lastPointerSampleTimeStamp = event.timeStamp
      if (this.rawPts.length > 0 && distXY(point, this.rawPts[this.rawPts.length - 1]) < 1.5) continue
      this.rawPts.push(point)
      if (Number.isFinite(event.timeStamp)) this.lastAcceptedPointerSampleTimeStamp = event.timeStamp
    }
  }

  private extractPenPoint(e: PointerEvent): PenPoint {
    const r = this.dualCanvas.dryCanvas.getBoundingClientRect()
    const sx = this.width / r.width
    const sy = this.height / r.height
    const now = performance.now()

    const x = (e.clientX - r.left) * sx
    const y = (e.clientY - r.top) * sy

    let pressure = e.pressure || 0
    let tiltX = e.tiltX || 0
    let tiltY = e.tiltY || 0
    const nativePenActive = this.lastNativePenInputTime > 0 && (now - this.lastNativePenInputTime) < 300
    const pointerReportsPenDynamics = e.pointerType === 'pen' && (
      pressure !== 0.5 || tiltX !== 0 || tiltY !== 0 || (e.twist || 0) !== 0
    )
    if (nativePenActive && this.nativePenInput && !pointerReportsPenDynamics) {
      this.state.hasPenInput = true
      pressure = this.nativePenInput.pressure
      tiltX = this.nativePenInput.tiltX ?? 0
      tiltY = this.nativePenInput.tiltY ?? 0
    } else if (e.pointerType === 'pen') {
      this.state.hasPenInput = true
      pressure = clamp(pressure, 0, 1)
    } else if (nativePenActive && this.nativePenInput && e.buttons > 0) {
      this.state.hasPenInput = true
      pressure = this.nativePenInput.pressure
      tiltX = this.nativePenInput.tiltX ?? 0
      tiltY = this.nativePenInput.tiltY ?? 0
    } else {
      this.state.hasPenInput = false
      if (e.buttons > 0 && pressure === 0) pressure = 0.5
    }

    let speed = 0
    if (this.rawPts.length > 0 && Number.isFinite(e.timeStamp) && Number.isFinite(this.lastAcceptedPointerSampleTimeStamp)) {
      const prev = this.rawPts[this.rawPts.length - 1]
      const dt = e.timeStamp - this.lastAcceptedPointerSampleTimeStamp
      if (dt > 0) speed = Math.hypot(x - prev.x, y - prev.y) / dt
    }

    return {
      x, y,
      p: pressure,
      tx: tiltX,
      ty: tiltY,
      tw: e.twist || 0,
      spd: speed,
    }
  }

  // ================================================================
  //  PRIVATE — Redraw / Replay
  // ================================================================

  private redrawAll(): void {
    this.resetReplaySurface()

    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)

    for (const a of this.allActions) {
      this.applyStrokeToEngine(a.tool, a.points, a.color, a.params, { startNaturalDrying: false, hasPenInput: this.strokeHasPenInput(a), physicsMode: a.physicsMode })
      this.replayDiffusion(a.diffusionFrames || 0, sampleHFn, a.physicsMode)
    }

    this.renderVisibleWetLayer()
  }

  private replayDiffusion(
    frames: number,
    sampleHFn: (x: number, y: number) => number,
    physicsMode: PhysicsMode = this.state.physicsMode,
  ): void {
    const count = Math.max(0, Math.min(600, Math.trunc(frames)))
    for (let i = 0; i < count; i++) this.replayDiffusionFrame(i, sampleHFn, physicsMode)
  }

  private replayDiffusionFrame(
    frame: number,
    sampleHFn: (x: number, y: number) => number,
    physicsMode: PhysicsMode = this.state.physicsMode,
  ): void {
    physicsStep(
      this.wet, this.drying, this.dualCanvas.dryCtx,
      this.fluid, this.fluidConfig,
      this.blowDX, this.blowDY,
      this.width, this.height,
      this.state.physicsStrength, this.state.drySpeed,
      physicsMode, this.lastStrokeBounds,
      frame, sampleHFn, this.paperHeight,
    )
  }

  // ================================================================
  //  PRIVATE — Serialization
  // ================================================================

  private serializeProject(): EfxPaintDocument {
    return {
      version: 1,
      parentLayerId: STANDALONE_PARENT_LAYER_ID,
      documentRevision: 0,
      activeTrackId: STANDALONE_TRACK_ID,
      tracks: [{
        id: STANDALONE_TRACK_ID,
        name: 'Track 1',
        order: 0,
        visible: true,
        solo: false,
        opacity: 1,
        blendMode: 'normal',
        revision: 0,
        frames: {},
        rotoPhysical: null,
        loopClips: [],
        strokes: this.allActions.map(s => ({
          tool: s.tool,
          pts: s.points.map(p => [
            Math.round(p.x * 100) / 100,
            Math.round(p.y * 100) / 100,
            Math.round(p.p * 1000) / 1000,
            p.tx || 0,
            p.ty || 0,
            p.tw || 0,
            Math.round(p.spd * 100) / 100,
          ] as [number, number, number, number, number, number, number]),
          color: s.color,
          params: { ...s.params },
          time: s.timestamp,
          hasPenInput: this.strokeHasPenInput(s),
          diffusionFrames: s.diffusionFrames || 0,
          ...(Number.isInteger(s.playFrame) && s.playFrame !== undefined && s.playFrame >= 0 ? { playFrame: s.playFrame } : {}),
          ...(s.physicsMode === 'local' || s.physicsMode === 'last' || s.physicsMode === 'all'
            ? { physicsMode: s.physicsMode }
            : { physicsMode: null }),
        })),
        settings: {
          bgMode: this.state.bgMode,
          paperGrain: this.currentPaperKey,
          embossStrength: this.state.embossStrength,
          wetPaper: this.state.wetPaper,
        },
      }],
      background: {
        id: STANDALONE_BACKGROUND_ID,
        clips: [],
        fallback: { mode: 'transparent' },
        visible: true,
        revision: 0,
      },
      photoReference: null,
      compositeRevision: 0,
    }
  }

  private loadProjectData(json: EfxPaintDocument): void {
    // Fail-closed validation BEFORE any engine state is mutated: legacy
    // version:2 payloads reject with the distinct unsupported copy, any
    // malformed or unknown-member payload throws the generic invalid copy.
    validateEfxPaintDocument(json)
    const activeTrack = json.tracks.find(track => track.id === json.activeTrackId)!

    // Restore brush settings but keep current background — allows loading strokes
    // onto different backgrounds (important for efx-motion-editor animations).
    // App-side documents carry no settings member; the engine keeps its own.
    const settings = activeTrack.settings
    if (settings) {
      if (settings.paperGrain) this.setPaperGrain(settings.paperGrain)
      if (settings.embossStrength != null) this.state.embossStrength = settings.embossStrength
      if (settings.wetPaper != null) {
        this.state.wetPaper = settings.wetPaper
      }
    }

    // Convert compact point arrays back to PenPoint objects. App-side
    // documents carry no strokes member; the engine loads an empty baseline.
    this.allActions = (activeTrack.strokes ?? []).map(s => ({
      tool: s.tool as ToolType,
      points: s.pts.map(p => ({
        x: p[0], y: p[1], p: p[2],
        tx: p[3], ty: p[4], tw: p[5], spd: p[6],
      })),
      color: s.color,
      params: s.params as unknown as BrushOpts,
      timestamp: s.time,
      hasPenInput: s.hasPenInput,
      diffusionFrames: s.diffusionFrames || 0,
      ...(Number.isInteger(s.playFrame) && s.playFrame !== undefined && s.playFrame >= 0 ? { playFrame: s.playFrame } : {}),
      ...(s.physicsMode === 'local' || s.physicsMode === 'last' || s.physicsMode === 'all'
        ? { physicsMode: s.physicsMode }
        : { physicsMode: null }),
    }))

    // Loaded state is a pixel/script baseline, never active-frame Undo/Redo history.
    this.undoStack = []
    this.redoStack = []
    this.historyEntries = []
    this.historyIndex = 0
    this.notifyHistoryAvailability()

    // Restore synchronously so loaded state is immediately available for apply/export.
    // Animated replay made apply race against setTimeout-delayed stroke restoration.
    this.redrawAll()
  }

  // ================================================================
  //  PRIVATE — Asset Loading
  // ================================================================

  private async loadPaperTextures(papers: Array<{ name: string; url: string }>, defaultPaper: string): Promise<void> {
    for (const paper of papers) {
      try {
        const result = await loadPaperTexture(paper.url, this.width, this.height, this.paperTextureScale)
        this.paperTextures.set(paper.name, result)
      } catch (e) {
        console.error(`Failed to load paper texture: ${paper.name}`, e)
      }
    }

    // Set default paper grain if specified
    if (defaultPaper && this.paperTextures.has(defaultPaper)) {
      this.setPaperGrain(defaultPaper)
    } else if (this.paperTextures.size > 0) {
      const firstKey = this.paperTextures.keys().next().value
      if (firstKey) this.setPaperGrain(firstKey)
    }

    // Redraw background with loaded textures
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    this.redrawPreviewBase()
    this.dualCanvas.dryCtx.drawImage(this.bgCanvas, 0, 0)
  }

}
