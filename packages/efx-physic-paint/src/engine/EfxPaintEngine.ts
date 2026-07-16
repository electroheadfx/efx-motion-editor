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
  SerializedProject,
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

type UndoSnapshot = {
  mutationId: number
  canvas: ImageData
  wet: { r: Float32Array; g: Float32Array; b: Float32Array; a: Float32Array; w: Float32Array; dp: Float32Array; so: Float32Array }
  saved: { r: Float32Array; g: Float32Array; b: Float32Array; a: Float32Array; so: Float32Array }
}

type DeferredStrokeFinalization = {
  tool: ToolType
  points: PenPoint[]
  color: string | null
  opts: BrushOpts
  hasPenInput: boolean
  physicsMode: 'local' | null
  continuationFrames: number
  mutationId: number
  queuedAt: number
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
  physicsMode?: 'local' | null
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

function brushRenderRadius(opts: Pick<BrushOpts, 'size'>): number {
  return Math.max(0.5, (opts.size || 24) / 2)
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
  private bgCanvas: HTMLCanvasElement
  private bgCtx: CanvasRenderingContext2D

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
  private savedPhysicsMode: 'local' | 'last' | 'all' | null = null
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
    await this.loadPaperTextures(this._initPapers, this._initDefaultPaper)
  }

  // ================================================================
  //  PUBLIC API (per D-08)
  // ================================================================

  /** Set the active tool */
  setTool(tool: ToolType): void {
    this.state.tool = tool
  }

  /** Set brush size (1-80) */
  setBrushSize(size: number): void {
    this.state.brushOpts.size = clamp(size, 1, 80)
  }

  /** Set brush opacity (10-100) */
  setBrushOpacity(opacity: number): void {
    this.state.brushOpts.opacity = clamp(opacity, 10, 100)
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
  }

  /** Change background mode and replay strokes */
  setBgMode(mode: BgMode): void {
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
      this.dualCanvas.displayCtx.clearRect(0, 0, this.width, this.height)
    }
    image.src = dataUrl
  }

  resetBackground(): void {
    this.previewBackgroundRequestId += 1
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    this.redrawPreviewBase()
    this.redrawAll()
  }

  setPreviewBaseImageUrl(dataUrl: string): void {
    const requestId = ++this.previewBaseRequestId
    const image = new Image()
    image.onload = () => {
      if (requestId !== this.previewBaseRequestId || this.destroyed || this.animationMode || this.state.drawing) return
      this.previewBaseImage = image
      this.previewBaseEnabled = true
      this.previewBackgroundSeparated = true
      this.redrawPreviewBase()
      this.redrawAll()
    }
    image.src = dataUrl
  }

  clearPreviewBaseImage(): void {
    this.previewBaseRequestId += 1
    this.previewBaseEnabled = false
    this.previewBackgroundSeparated = false
    this.previewBaseImage = null
    this.dualCanvas.previewBaseCtx.clearRect(0, 0, this.width, this.height)
    this.redrawAll()
  }

  /** Set paper grain for physics (key matches PaperConfig.name) */
  setPaperGrain(key: string): void {
    this.flushPendingStrokeFinalizations()
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
    this.flushPendingStrokeFinalizations()
    this.state.embossStrength = clamp(strength, 0, 1)
  }

  /** Toggle wet/dry paper mode */
  setWetPaper(wet: boolean): void {
    this.flushPendingStrokeFinalizations()
    this.state.wetPaper = wet
  }

  /** Start physics simulation */
  startPhysics(mode: 'local' | 'last' | 'all'): void {
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
    this.state.physicsRunning = false
    if (this.physicsInterval !== null) {
      clearInterval(this.physicsInterval)
      this.physicsInterval = null
    }

    // Restore previous physics mode (e.g. 'local' before hold-button override)
    this.state.physicsMode = this.savedPhysicsMode

    // Update saved wet layer with diffused result
    if (this.state.physicsMode === 'last') {
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

    // Record physics run as action for deterministic replay
    if (this.physicsTickCount > 0) {
      this.allActions.push({
        tool: 'paint', // placeholder, actual physics strokes filtered during save
        points: [],
        color: null,
        params: { ...this.state.brushOpts },
        timestamp: Date.now(),
        diffusionFrames: this.physicsTickCount,
        physicsMode: this.state.physicsMode === 'local' ? 'local' : null,
      })
      this.notifyCompletedMutation('physics')
    }
  }

  /** Force-dry all wet paint immediately */
  forceDry(): void {
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
    this.dualCanvas.dryCtx.putImageData(snap.canvas, 0, 0)
    this.wet.r.set(snap.wet.r)
    this.wet.g.set(snap.wet.g)
    this.wet.b.set(snap.wet.b)
    this.wet.alpha.set(snap.wet.a)
    this.wet.wetness.set(snap.wet.w)
    this.drying.dryPos.set(snap.wet.dp)
    this.wet.strokeOpacity.set(snap.wet.so)
    this.savedWet.r.set(snap.saved.r)
    this.savedWet.g.set(snap.saved.g)
    this.savedWet.b.set(snap.saved.b)
    this.savedWet.alpha.set(snap.saved.a)
    this.savedWet.strokeOpacity.set(snap.saved.so)
  }

  /** Clear the canvas and all strokes */
  clear(): void {
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
    // Also force-clear the display canvas so stale wet composite is gone
    this.dualCanvas.displayCtx.clearRect(0, 0, this.width, this.height)
    this.notifyCompletedMutation('clear')
  }

  /** Serialize the project for saving */
  save(): SerializedProject {
    this.flushPendingStrokeFinalizations()
    return this.serializeProject()
  }

  /** Load a serialized project */
  load(json: SerializedProject): void {
    this.flushPendingStrokeFinalizations()
    this.loadProjectData(json)
  }

  /** Clean up all resources: intervals, rAF, event listeners */
  destroy(): void {
    this.flushPendingStrokeFinalizations()
    this.destroyed = true
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

    return this.acceptStroke(primary, continuations)
  }

  /** Lock/unlock pointer input (per D-11: painting disabled during animation) */
  setInputLocked(locked: boolean): void {
    this.inputLocked = locked
  }

  /** Render all strokes synchronously — public wrapper around redrawAll() */
  renderAllStrokes(): void {
    this.flushPendingStrokeFinalizations()
    this.redrawAll()
  }

  /** Enter/exit animation mode — skips compositing in render loop */
  setAnimationMode(mode: boolean): void {
    this.animationMode = mode
  }

  /** Render strokes up to specified point counts — used by AnimationPlayer for progressive frame rendering (per D-02) */
  renderPartialStrokes(strokeData: Array<{ stroke: PaintStroke; pointCount: number }>): void {
    this.flushPendingStrokeFinalizations()
    this.resetReplaySurface(true)

    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)

    for (const { stroke: a, pointCount } of strokeData) {
      // Slice points to the requested count (progressive rendering per D-02)
      const pts = pointCount >= a.points.length ? a.points : a.points.slice(0, pointCount)
      const completeStroke = pointCount >= a.points.length
      this.applyStrokeToEngine(a.tool, pts, a.color, a.params, { startNaturalDrying: false, hasPenInput: this.strokeHasPenInput(a), physicsMode: a.physicsMode })
      if (completeStroke) this.replayDiffusion(a.diffusionFrames || 0, sampleHFn)
    }

    this.renderVisibleWetLayer()
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
    displayCtx.clearRect(0, 0, this.width, this.height)

    // Composite wet layer onto display (D-04: per-pixel strokeOpacity, no global userOpacity)
    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)
    compositeWetLayer(displayCtx, this.wet, this.width, this.height, sampleHFn)

    // Draw queued stroke outlines until their full render finalizes.
    this.drawQueuedStrokePreviews(displayCtx)

    // Draw stroke preview
    drawStrokePreview(displayCtx, this.previewStroke)

    // Draw brush cursor
    drawBrushCursor(displayCtx, this.cursorX, this.cursorY, brushRenderRadius(this.state.brushOpts), this.state.tool, this.width, this.height)

    // Finalized pixels yield to active input and preview rendering. Advance at most
    // one retained FIFO continuation after the visible frame has been drawn.
    this.runScheduledStrokeFinalizationFrame()

    this.rafId = requestAnimationFrame(() => this.render())
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
      physicsMode: primary.physicsMode === 'local' ? 'local' : null,
      continuationFrames: continuations.reduce((total, continuation) => total + Math.max(0, Math.min(600, Math.trunc(continuation.diffusionFrames ?? 0))), 0),
      mutationId,
      queuedAt: performance.now(),
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
      r: new Float32Array(this.wet.r),
      g: new Float32Array(this.wet.g),
      b: new Float32Array(this.wet.b),
      a: new Float32Array(this.wet.alpha),
      w: new Float32Array(this.wet.wetness),
      dp: new Float32Array(this.drying.dryPos),
      so: new Float32Array(this.wet.strokeOpacity),
    }
    this.recordPerformance('undo-wet-buffer-copy', 'sync-cpu', wetCopyStartedAt, { mutationId })

    const savedCopyStartedAt = this.performanceListener ? performance.now() : 0
    const savedSnap = {
      r: new Float32Array(this.savedWet.r),
      g: new Float32Array(this.savedWet.g),
      b: new Float32Array(this.savedWet.b),
      a: new Float32Array(this.savedWet.alpha),
      so: new Float32Array(this.savedWet.strokeOpacity),
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
    this.runStrokeFinalizationTurn()
    if (this.pendingStrokeFinalizations.length > 0 || this.activeStrokeFinalization) {
      this.strokeFinalizationScheduled = true
    }
  }

  public flushPendingStrokeFinalizations(): void {
    while (this.pendingStrokeFinalizations.length > 0 || this.activeStrokeFinalization) {
      this.runStrokeFinalizationTurn(true)
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

  private runStrokeFinalizationTurn(flush: boolean = false): void {
    do {
      const active = this.activeStrokeFinalization ?? this.startNextStrokeFinalization()
      if (!active) return
      this.activeStrokeFinalization = active
      if (active.generation !== this.strokeFinalizationGeneration) {
        this.activeStrokeFinalization = null
        this.activeMutationId = null
        continue
      }
      if (active.phase === 'complete' || active.pending.tool !== 'paint' || !active.pending.color) {
        this.finishActiveStrokeSynchronously(active)
        continue
      }
      do {
        this.stepInteractivePaintFinalization(active)
      } while (flush && this.activeStrokeFinalization === active)
    } while (flush && (this.pendingStrokeFinalizations.length > 0 || this.activeStrokeFinalization))
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
    const displayCtx = this.dualCanvas.displayCtx
    displayCtx.clearRect(0, 0, this.width, this.height)
    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)
    compositeWetLayer(displayCtx, this.wet, this.width, this.height, sampleHFn)
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
    physicsMode: 'local' | null = this.state.physicsMode === 'local' ? 'local' : null,
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
    this.dualCanvas.dryCanvas.setPointerCapture(e.pointerId)
    this.state.drawing = true
    this.rawPts = []
    this.lastPointerSampleTimeStamp = Number.NEGATIVE_INFINITY
    this.lastAcceptedPointerSampleTimeStamp = Number.NEGATIVE_INFINITY
    this.consumePointerSamples([e])
  }

  private onPointerMove(e: PointerEvent): void {
    // Always update cursor position
    const r = this.dualCanvas.dryCanvas.getBoundingClientRect()
    this.cursorX = (e.clientX - r.left) * (this.width / r.width)
    this.cursorY = (e.clientY - r.top) * (this.height / r.height)
    this.lastPointerInputTime = performance.now()

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
    const pointerUpStartedAt = this.performanceListener ? performance.now() : 0
    const mutationId = this.nextMutationId++
    this.lastPointerInputTime = performance.now()
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
      this.replayDiffusion(a.diffusionFrames || 0, sampleHFn)
    }

    this.renderVisibleWetLayer()
  }

  private replayDiffusion(frames: number, sampleHFn: (x: number, y: number) => number): void {
    const count = Math.max(0, Math.min(600, Math.trunc(frames)))
    for (let i = 0; i < count; i++) this.replayDiffusionFrame(i, sampleHFn)
  }

  private replayDiffusionFrame(
    frame: number,
    sampleHFn: (x: number, y: number) => number,
    physicsMode: 'local' | 'last' | 'all' | null = this.state.physicsMode,
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

  private serializeProject(): SerializedProject {
    return {
      version: 2,
      width: this.width,
      height: this.height,
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
        ...(s.physicsMode === 'local' ? { physicsMode: 'local' as const } : { physicsMode: null }),
      })),
      settings: {
        bgMode: this.state.bgMode,
        paperGrain: this.currentPaperKey,
        embossStrength: this.state.embossStrength,
        wetPaper: this.state.wetPaper,
      },
    }
  }

  private loadProjectData(json: SerializedProject): void {
    // Restore brush settings but keep current background — allows loading strokes
    // onto different backgrounds (important for efx-motion-editor animations)
    if (json.settings) {
      if (json.settings.paperGrain) this.setPaperGrain(json.settings.paperGrain)
      if (json.settings.embossStrength != null) this.state.embossStrength = json.settings.embossStrength
      if (json.settings.wetPaper != null) {
        this.state.wetPaper = json.settings.wetPaper
      }
    }

    // Convert compact point arrays back to PenPoint objects
    this.allActions = json.strokes.map(s => ({
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
      ...(s.physicsMode === 'local' ? { physicsMode: 'local' as const } : { physicsMode: null }),
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
