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
import { localFluidPhysicsStep } from '../core/fluids'
import { loadPaperTexture, sampleH, ensureHeightMap } from '../core/paper'
import { renderPaintStroke } from '../brush/paint'
import { applyEraseStroke } from '../brush/erase'
import { compositeWetLayer } from '../render/compositor'
import { setupDualCanvas, drawBg, drawBrushCursor, drawStrokePreview } from '../render/canvas'
import type { StrokePreview, DualCanvas } from '../render/canvas'

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

  // --- Engine State ---
  private state: EngineState

  // --- Stroke Recording ---
  private allActions: PaintStroke[] = []
  private undoStack: Array<{ canvas: ImageData; wet: { r: Float32Array; g: Float32Array; b: Float32Array; a: Float32Array; w: Float32Array; dp: Float32Array; so: Float32Array }; saved: { r: Float32Array; g: Float32Array; b: Float32Array; a: Float32Array; so: Float32Array } }> = []

  // --- Pointer State ---
  private rawPts: PenPoint[] = []
  private cursorX: number = -1
  private cursorY: number = -1
  private lastPointerTime: number = 0
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
    this.state.physicsStrength = clamp(strength, 0, 100) / 100
  }

  /** Set fluid viscosity. Low=watery (0.0001), high=thick (0.01). Per D-13 */
  setViscosity(v: number): void {
    this.fluidConfig.viscosity = Math.max(0.00001, Math.min(0.1, v))
  }

  /** Set physics mode: 'local' (auto during painting) or null (manual only). Per D-07 */
  setPhysicsMode(mode: 'local' | null): void {
    this.state.physicsMode = mode
  }

  /** Set local spread strength (0-100). Per D-11 */
  setLocalSpreadStrength(strength: number): void {
    this.state.localSpreadStrength = clamp(strength, 0, 100)
  }

  /** Set current paint color as hex string */
  setColorHex(hex: string): void {
    this.color = hex
  }

  /** Change background mode and replay strokes */
  setBgMode(mode: BgMode): void {
    this.state.bgMode = mode
    // Replay strokes on new background
    const savedStrokes = this.allActions.filter(s => s.tool !== 'physics' as string)
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
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

  /** Set paper grain for physics (key matches PaperConfig.name) */
  setPaperGrain(key: string): void {
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
    this.state.embossStrength = clamp(strength, 0, 1)
  }

  /** Toggle wet/dry paper mode */
  setWetPaper(wet: boolean): void {
    this.state.wetPaper = wet
  }

  /** Start physics simulation */
  startPhysics(mode: 'local' | 'last' | 'all'): void {
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
    const bd = this.bgData ? this.bgData.data : null
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
      })
    }
  }

  /** Force-dry all wet paint immediately */
  forceDry(): void {
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

  /** Undo last stroke */
  undo(): void {
    if (this.undoStack.length === 0) return
    const snap = this.undoStack.pop()!
    this.dualCanvas.dryCtx.putImageData(snap.canvas, 0, 0)
    this.wet.r.set(snap.wet.r)
    this.wet.g.set(snap.wet.g)
    this.wet.b.set(snap.wet.b)
    this.wet.alpha.set(snap.wet.a)
    this.wet.wetness.set(snap.wet.w)
    this.drying.dryPos.set(snap.wet.dp)
    if (snap.wet.so) this.wet.strokeOpacity.set(snap.wet.so)
    // Restore savedWet so physics doesn't bring back undone strokes
    if (snap.saved) {
      this.savedWet.r.set(snap.saved.r)
      this.savedWet.g.set(snap.saved.g)
      this.savedWet.b.set(snap.saved.b)
      this.savedWet.alpha.set(snap.saved.a)
      this.savedWet.strokeOpacity.set(snap.saved.so)
    }
    // Remove last action
    if (this.allActions.length > 0) this.allActions.pop()
  }

  /** Clear the canvas and all strokes */
  clear(): void {
    this.stopNaturalDrying()
    this.allActions = []
    this.undoStack = []
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
    const bgPixels = this.bgCtx.getImageData(0, 0, this.width, this.height)
    this.dualCanvas.dryCtx.putImageData(bgPixels, 0, 0)
    // Also force-clear the display canvas so stale wet composite is gone
    this.dualCanvas.displayCtx.clearRect(0, 0, this.width, this.height)
  }

  /** Serialize the project for saving */
  save(): SerializedProject {
    return this.serializeProject()
  }

  /** Load a serialized project */
  load(json: SerializedProject): void {
    this.loadProjectData(json)
  }

  /** Clean up all resources: intervals, rAF, event listeners */
  destroy(): void {
    this.destroyed = true
    // Cancel render loop
    if (this.rafId) cancelAnimationFrame(this.rafId)
    // Clear intervals
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
    return this.dualCanvas.dryCanvas
  }

  /** Get the display canvas (overlay with wet compositing) */
  getDisplayCanvas(): HTMLCanvasElement {
    return this.dualCanvas.displayCanvas
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

  /** Lock/unlock pointer input (per D-11: painting disabled during animation) */
  setInputLocked(locked: boolean): void {
    this.inputLocked = locked
  }

  /** Render all strokes synchronously — public wrapper around redrawAll() */
  renderAllStrokes(): void {
    this.redrawAll()
  }

  /** Enter/exit animation mode — skips compositing in render loop */
  setAnimationMode(mode: boolean): void {
    this.animationMode = mode
  }

  /** Render strokes up to specified point counts — used by AnimationPlayer for progressive frame rendering (per D-02) */
  renderPartialStrokes(strokeData: Array<{ stroke: PaintStroke; pointCount: number }>): void {
    // Clear canvas to background (clearRect needed for transparent bg — drawImage won't erase existing pixels)
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    this.dualCanvas.dryCtx.clearRect(0, 0, this.width, this.height)
    this.dualCanvas.dryCtx.drawImage(this.bgCanvas, 0, 0)
    clearWetLayer(this.wet, this.savedWet, this.drying.dryPos, this.blowDX, this.blowDY, this.lastStrokeMask)
    this.fluid.u.fill(0); this.fluid.v.fill(0)
    this.fluid.u0.fill(0); this.fluid.v0.fill(0)
    this.fluid.p.fill(0); this.fluid.div.fill(0)

    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)

    for (const { stroke: a, pointCount } of strokeData) {
      // Slice points to the requested count (progressive rendering per D-02)
      const pts = pointCount >= a.points.length ? a.points : a.points.slice(0, pointCount)
      const opts = a.params
      const color = a.color

      if (a.tool === 'paint' && color) {
        renderPaintStroke(
          pts, color, opts,
          this.dualCanvas.dryCtx, this.wet, this.savedWet,
          this.drying.dryPos, this.lastStrokeMask,
          this.paperHeight,
          this.width, this.height,
          this.state.hasPenInput, this.state.wetPaper,
          this.state.embossStrength, this.state.embossStack,
          opts.waterAmount / 100,
          sampleHFn,
        )
      } else if (a.tool === 'erase') {
        applyEraseStroke(
          pts, opts,
          this.dualCanvas.dryCtx, this.wet,
          this.width, this.height,
          this.state.hasPenInput,
          this.state.embossStrength,
          this.paperHeight,
          this.state.bgMode,
          this.bgData,
        )
      }
      // Force dry after each stroke (same pattern as redrawAll — no physics ticks)
      forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height)
    }

    // Composite wet layer for display (so getDisplayCanvas shows current frame)
    const displayCtx = this.dualCanvas.displayCtx
    displayCtx.clearRect(0, 0, this.width, this.height)
    compositeWetLayer(displayCtx, this.wet, this.width, this.height, sampleHFn)
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

    // Draw stroke preview
    drawStrokePreview(displayCtx, this.previewStroke)

    // Draw brush cursor
    drawBrushCursor(displayCtx, this.cursorX, this.cursorY, this.state.brushOpts.size, this.state.tool, this.width, this.height)

    this.rafId = requestAnimationFrame(() => this.render())
  }

  // ================================================================
  //  PRIVATE — Pointer Events
  // ================================================================

  private onPointerDown(e: PointerEvent): void {
    if (this.inputLocked) return
    e.preventDefault()
    this.dualCanvas.dryCanvas.setPointerCapture(e.pointerId)
    this.state.drawing = true
    this.lastPointerTime = performance.now()
    this.rawPts = [this.extractPenPoint(e)]

    // Force-dry before paint/erase strokes
    if (this.state.tool === 'paint') {
      if (this.state.physicsMode === 'local') {
        // Local mode: bake DISTANT paint, keep NEARBY paint wet for interaction
        const pt = this.rawPts[0]
        const keepR = (this.state.brushOpts.size || 24) * 3 + 40
        const keepR2 = keepR * keepR
        const id = this.dualCanvas.dryCtx.getImageData(0, 0, this.width, this.height)
        const d = id.data
        let changed = false
        for (let i = 0; i < this.size; i++) {
          if (this.wet.alpha[i] < 1) continue
          const x = i % this.width, y = (i / this.width) | 0
          const dx = x - pt.x, dy = y - pt.y
          if (dx * dx + dy * dy > keepR2) {
            // Far from pointer → bake to dry canvas
            const densityAlpha = Math.min(1, this.wet.alpha[i] / 800)
            const pixelOpacity = this.wet.strokeOpacity[i]
            const sa = densityAlpha * pixelOpacity
            if (sa > 0.005) {
              const pi = i * 4, ma = d[pi + 3] / 255
              const oa = Math.min(1, ma + sa * (1 - ma))
              const bt = sa / Math.max(0.005, oa)
              d[pi]     = Math.round(clamp(lerp(d[pi],     this.wet.r[i], bt), 0, 255))
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
        if (changed) this.dualCanvas.dryCtx.putImageData(id, 0, 0)
        this.stopNaturalDrying()
      } else {
        forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height)
      }
    }

    // Snapshot for undo
    const snap = this.dualCanvas.dryCtx.getImageData(0, 0, this.width, this.height)
    const wetSnap = {
      r: new Float32Array(this.wet.r),
      g: new Float32Array(this.wet.g),
      b: new Float32Array(this.wet.b),
      a: new Float32Array(this.wet.alpha),
      w: new Float32Array(this.wet.wetness),
      dp: new Float32Array(this.drying.dryPos),
      so: new Float32Array(this.wet.strokeOpacity),
    }
    const savedSnap = {
      r: new Float32Array(this.savedWet.r),
      g: new Float32Array(this.savedWet.g),
      b: new Float32Array(this.savedWet.b),
      a: new Float32Array(this.savedWet.alpha),
      so: new Float32Array(this.savedWet.strokeOpacity),
    }
    this.undoStack.push({ canvas: snap, wet: wetSnap, saved: savedSnap })
    if (this.undoStack.length > 25) this.undoStack.shift()
  }

  private onPointerMove(e: PointerEvent): void {
    // Always update cursor position
    const r = this.dualCanvas.dryCanvas.getBoundingClientRect()
    this.cursorX = (e.clientX - r.left) * (this.width / r.width)
    this.cursorY = (e.clientY - r.top) * (this.height / r.height)

    if (!this.state.drawing) return
    e.preventDefault()

    // Handle coalesced events for smooth strokes
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : null
    const evList = (events && events.length > 0) ? events : [e]

    for (const ev of evList) {
      const pt = this.extractPenPoint(ev)
      if (this.rawPts.length > 0 && distXY(pt, this.rawPts[this.rawPts.length - 1]) < 1.5) continue
      this.rawPts.push(pt)
    }

    // Update stroke preview
    if (this.rawPts.length >= 2) {
      this.previewStroke = {
        pts: this.rawPts,
        color: this.state.tool === 'paint' ? this.color : this.state.tool === 'erase' ? '#ff4444' : '#888888',
        radius: this.state.brushOpts.size,
        opacity: this.state.tool === 'paint' ? this.state.brushOpts.opacity / 100 : 0.3,
      }
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.state.drawing) return
    this.state.drawing = false
    this.previewStroke = null
    this.dualCanvas.dryCanvas.releasePointerCapture(e.pointerId)

    if (this.rawPts.length < 3) {
      // Not enough points for a stroke — undo the snapshot we pushed
      if (this.undoStack.length > 0) this.undoStack.pop()
      return
    }

    const opts = { ...this.state.brushOpts }
    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)

    if (this.state.tool === 'paint') {
      renderPaintStroke(
        this.rawPts, this.color, opts,
        this.dualCanvas.dryCtx, this.wet, this.savedWet,
        this.drying.dryPos, this.lastStrokeMask,
        this.paperHeight,
        this.width, this.height,
        this.state.hasPenInput, this.state.wetPaper,
        this.state.embossStrength, this.state.embossStack,
        this.state.brushOpts.waterAmount / 100,
        sampleHFn,
      )
      // Edge feathering on wet layer for anti-aliased brush edges
      if (opts.antiAlias > 0) {
        const brushR = opts.size || 24
        const strokeBounds = curveBounds(this.rawPts, brushR + 10, this.width, this.height)
        // Passes: soft=2, med=4, high=6
        const featherPasses = opts.antiAlias * 2
        featherWetEdges(this.wet,
          { x0: strokeBounds.x0, y0: strokeBounds.y0, x1: strokeBounds.x0 + strokeBounds.w, y1: strokeBounds.y0 + strokeBounds.h },
          this.width, this.height, featherPasses)
      }
      // Save clean wet layer (accumulate with previously saved data)
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

      // D-05/D-07: Local physics -- run Stam solver on stroke bbox
      if (this.state.physicsMode === 'local' && this.rawPts.length > 0) {
        const brushR = opts.size || 24
        let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
        for (const p of this.rawPts) {
          sx0 = Math.min(sx0, p.x); sy0 = Math.min(sy0, p.y)
          sx1 = Math.max(sx1, p.x); sy1 = Math.max(sy1, p.y)
        }
        // D-06: margin and ticks scale with brush size, water, and spread
        const waterFrac = this.state.brushOpts.waterAmount / 100
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
        localFluidPhysicsStep(
          this.wet, this.fluidConfig,
          this.width, this.height,
          localBounds, ticks,
        )
      }

      // Bake to canvas — in local mode, keep wet for stroke interaction
      if (this.state.physicsMode !== 'local') {
        forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height)
      } else {
        // Start natural drying timer (research: paint dries over time via evaporation)
        this.startNaturalDrying()
      }
    } else if (this.state.tool === 'erase') {
      applyEraseStroke(
        this.rawPts, opts,
        this.dualCanvas.dryCtx, this.wet,
        this.width, this.height,
        this.state.hasPenInput,
        this.state.embossStrength,
        this.paperHeight,
        this.state.bgMode,
        this.bgData,
      )
      forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height)
    }

    // Record stroke for replay
    const colorlessTools: string[] = ['erase']
    const stroke: PaintStroke = {
      tool: this.state.tool,
      points: this.rawPts.map(p => ({ x: p.x, y: p.y, p: p.p, tx: p.tx, ty: p.ty, tw: p.tw, spd: p.spd })),
      color: colorlessTools.includes(this.state.tool) ? null : this.color,
      params: opts,
      timestamp: Date.now(),
    }
    this.allActions.push(stroke)

    // Compute last stroke bounding box for physics "Last" mode
    if (this.rawPts.length > 0) {
      let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity
      for (const p of this.rawPts) {
        sx0 = Math.min(sx0, p.x); sy0 = Math.min(sy0, p.y)
        sx1 = Math.max(sx1, p.x); sy1 = Math.max(sy1, p.y)
      }
      const brushR = opts.size || 24
      this.lastStrokeBounds = {
        x0: Math.floor(sx0 - brushR),
        y0: Math.floor(sy0 - brushR),
        x1: Math.ceil(sx1 + brushR),
        y1: Math.ceil(sy1 + brushR),
      }
    }

    this.rawPts = []
  }

  private onPointerLeave(e: PointerEvent): void {
    this.cursorX = -1
    if (this.state.drawing) this.onPointerUp(e)
  }

  private extractPenPoint(e: PointerEvent): PenPoint {
    const r = this.dualCanvas.dryCanvas.getBoundingClientRect()
    const sx = this.width / r.width
    const sy = this.height / r.height
    const now = performance.now()

    const x = (e.clientX - r.left) * sx
    const y = (e.clientY - r.top) * sy

    let pressure = e.pressure || 0
    if (e.pointerType === 'pen') {
      this.state.hasPenInput = true
      pressure = clamp(pressure, 0, 1)
    } else {
      this.state.hasPenInput = false
      if (e.buttons > 0 && pressure === 0) pressure = 0.5
    }

    let speed = 0
    if (this.rawPts.length > 0 && now - this.lastPointerTime > 0) {
      const prev = this.rawPts[this.rawPts.length - 1]
      const dt = now - this.lastPointerTime
      speed = Math.hypot(x - prev.x, y - prev.y) / dt
    }
    this.lastPointerTime = now

    return {
      x, y,
      p: pressure,
      tx: e.tiltX || 0,
      ty: e.tiltY || 0,
      tw: e.twist || 0,
      spd: speed,
    }
  }

  // ================================================================
  //  PRIVATE — Redraw / Replay
  // ================================================================

  private redrawAll(): void {
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    this.dualCanvas.dryCtx.drawImage(this.bgCanvas, 0, 0)
    clearWetLayer(this.wet, this.savedWet, this.drying.dryPos, this.blowDX, this.blowDY, this.lastStrokeMask)
    this.fluid.u.fill(0); this.fluid.v.fill(0)
    this.fluid.u0.fill(0); this.fluid.v0.fill(0)
    this.fluid.p.fill(0); this.fluid.div.fill(0)

    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)

    for (const a of this.allActions) {
      const pts = a.points
      const opts = a.params
      const color = a.color

      if (a.tool === 'paint' && color) {
        renderPaintStroke(
          pts, color, opts,
          this.dualCanvas.dryCtx, this.wet, this.savedWet,
          this.drying.dryPos, this.lastStrokeMask,
          this.paperHeight,
          this.width, this.height,
          this.state.hasPenInput, this.state.wetPaper,
          this.state.embossStrength, this.state.embossStack,
          opts.waterAmount / 100,
          sampleHFn,
        )
      } else if (a.tool === 'erase') {
        applyEraseStroke(
          pts, opts,
          this.dualCanvas.dryCtx, this.wet,
          this.width, this.height,
          this.state.hasPenInput,
          this.state.embossStrength,
          this.paperHeight,
          this.state.bgMode,
          this.bgData,
        )
      }
      // Force dry after each stroke (replicates drying between strokes)
      forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height)
    }
  }

  /** Animated stroke replay — renders strokes one by one with yields for visual feedback.
   *  Used by load() so the user sees each stroke appear. */
  private replayAnimated(strokes: PaintStroke[]): void {
    this.allActions = strokes

    // Clear canvas
    this.bgData = drawBg(this.bgCtx, this.state.bgMode, this.width, this.height, this.paperTextures, this.userPhoto)
    const bgPixels = this.bgCtx.getImageData(0, 0, this.width, this.height)
    this.dualCanvas.dryCtx.putImageData(bgPixels, 0, 0)
    clearWetLayer(this.wet, this.savedWet, this.drying.dryPos, this.blowDX, this.blowDY, this.lastStrokeMask)
    this.fluid.u.fill(0); this.fluid.v.fill(0)
    this.fluid.u0.fill(0); this.fluid.v0.fill(0)
    this.fluid.p.fill(0); this.fluid.div.fill(0)

    if (strokes.length === 0) return

    const sampleHFn = (x: number, y: number) => sampleH(this.paperHeight, x, y, this.width, this.height)
    let idx = 0

    const replayNext = () => {
      if (idx >= strokes.length || this.destroyed) return

      const a = strokes[idx]
      idx++

      if (a.tool === 'paint' && a.color) {
        renderPaintStroke(
          a.points, a.color, a.params,
          this.dualCanvas.dryCtx, this.wet, this.savedWet,
          this.drying.dryPos, this.lastStrokeMask,
          this.paperHeight,
          this.width, this.height,
          this.state.hasPenInput, this.state.wetPaper,
          this.state.embossStrength, this.state.embossStack,
          a.params.waterAmount / 100,
          sampleHFn,
        )
        // Save to savedWet (matches live painting flow in onPointerUp)
        for (let i = 0; i < this.size; i++) {
          if (this.wet.alpha[i] > 1) {
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
          }
        }
      } else if (a.tool === 'erase') {
        applyEraseStroke(
          a.points, a.params,
          this.dualCanvas.dryCtx, this.wet,
          this.width, this.height,
          this.state.hasPenInput,
          this.state.embossStrength,
          this.paperHeight,
          this.state.bgMode,
          this.bgData,
        )
      }

      forceDryAll(this.wet, this.savedWet, this.drying, this.dualCanvas.dryCtx, this.width, this.height)

      // Yield for canvas repaint, then next stroke
      setTimeout(replayNext, 1)
    }

    replayNext()
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
        diffusionFrames: s.diffusionFrames || 0,
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
      diffusionFrames: s.diffusionFrames || 0,
    }))

    // Clear undo stack (loaded state is new baseline)
    this.undoStack = []

    // Animated replay — strokes appear one by one
    this.replayAnimated(this.allActions)
  }

  // ================================================================
  //  PRIVATE — Asset Loading
  // ================================================================

  private async loadPaperTextures(papers: Array<{ name: string; url: string }>, defaultPaper: string): Promise<void> {
    for (const paper of papers) {
      try {
        const result = await loadPaperTexture(paper.url, this.width, this.height)
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
    this.dualCanvas.dryCtx.drawImage(this.bgCanvas, 0, 0)
  }

}
