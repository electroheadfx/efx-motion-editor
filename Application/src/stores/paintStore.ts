import {signal} from '@preact/signals';
import type {PaintElement, PaintFrame, PaintToolType, PaintStrokeOptions, BrushStyle, BrushFxParams, PaintStroke} from '../types/paint';
import {DEFAULT_BRUSH_SIZE, DEFAULT_BRUSH_COLOR, DEFAULT_BRUSH_OPACITY, DEFAULT_STROKE_OPTIONS, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX, DEFAULT_BRUSH_FX_PARAMS, DEFAULT_PAINT_BG_COLOR} from '../types/paint';
import {pushAction} from '../lib/history';
import {renderFrameFx} from '../lib/brushP5Adapter';
import {projectStore} from './projectStore';

// Late-bound callback to mark project dirty without circular import
let _markProjectDirty: (() => void) | null = null;
export function _setPaintMarkDirtyCallback(cb: () => void) { _markProjectDirty = cb; }

// --- Signals ---

const paintMode = signal(false);
const activeTool = signal<PaintToolType>('brush');
const brushSize = signal(DEFAULT_BRUSH_SIZE);
const brushColor = signal(DEFAULT_BRUSH_COLOR);
const brushOpacity = signal(DEFAULT_BRUSH_OPACITY);
const strokeOptions = signal<PaintStrokeOptions>({...DEFAULT_STROKE_OPTIONS});
const shapeFilled = signal(false);
const fillTolerance = signal(10);
const tabletDetected = signal(false);
const livePressure = signal(0);  // real-time pressure readout from pen
const brushStyle = signal<BrushStyle>('flat');
const brushFxParams = signal<BrushFxParams>({});
const paintBgColor = signal(DEFAULT_PAINT_BG_COLOR);
const selectedStrokeIds = signal<Set<string>>(new Set());
const showSequenceOverlay = signal(false);
const onionSkinEnabled = signal(false);
const onionSkinPrevRange = signal(1);
const onionSkinNextRange = signal(0);
const onionSkinOpacity = signal(0.3);

/** Bumped on every paint data mutation so reactive consumers (Preview) re-render */
const paintVersion = signal(0);

// --- Private state ---

/** layerId -> (frameNumber -> PaintFrame) */
const _frames = new Map<string, Map<number, PaintFrame>>();

/** "layerId:frameNum" strings for persistence tracking */
const _dirtyFrames = new Set<string>();

/** Per-frame FX raster cache. Key: "layerId:frame". Value: HTMLCanvasElement with all FX strokes rendered together via p5.brush. */
const _frameFxCache = new Map<string, HTMLCanvasElement>();

// --- Helpers ---

function _getOrCreateFrame(layerId: string, frame: number): PaintFrame {
  let layerFrames = _frames.get(layerId);
  if (!layerFrames) {
    layerFrames = new Map();
    _frames.set(layerId, layerFrames);
  }
  let paintFrame = layerFrames.get(frame);
  if (!paintFrame) {
    paintFrame = {elements: []};
    layerFrames.set(frame, paintFrame);
  }
  return paintFrame;
}

// --- Store ---

export const paintStore = {
  // Signals (read-only externally via .value)
  paintMode,
  paintVersion,
  activeTool,
  brushSize,
  brushColor,
  brushOpacity,
  strokeOptions,
  shapeFilled,
  fillTolerance,
  tabletDetected,
  livePressure,
  brushStyle,
  brushFxParams,
  paintBgColor,
  selectedStrokeIds,
  showSequenceOverlay,
  onionSkinEnabled,
  onionSkinPrevRange,
  onionSkinNextRange,
  onionSkinOpacity,

  // Frame data access
  getFrame(layerId: string, frame: number): PaintFrame | null {
    return _frames.get(layerId)?.get(frame) ?? null;
  },

  setFrame(layerId: string, frame: number, pf: PaintFrame): void {
    _getOrCreateFrame(layerId, frame);
    _frames.get(layerId)!.set(frame, pf);
    this.markDirty(layerId, frame);
    paintVersion.value++;
  },

  addElement(layerId: string, frame: number, element: PaintElement): void {
    const frameData = _getOrCreateFrame(layerId, frame);
    frameData.elements.push(element);
    this.markDirty(layerId, frame);
    paintVersion.value++;
    _markProjectDirty?.();
    pushAction({
      id: crypto.randomUUID(),
      description: `Add paint element to frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = f.elements.filter(e => e.id !== element.id);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements.push(element);
        paintStore.markDirty(layerId, frame);
      },
    });
  },

  removeElement(layerId: string, frame: number, elementId: string): void {
    const frameData = _frames.get(layerId)?.get(frame);
    if (!frameData) return;
    const idx = frameData.elements.findIndex(e => e.id === elementId);
    if (idx === -1) return;
    const removed = frameData.elements.splice(idx, 1)[0];
    this.markDirty(layerId, frame);
    paintVersion.value++;
    _markProjectDirty?.();
    pushAction({
      id: crypto.randomUUID(),
      description: `Remove paint element from frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements.splice(idx, 0, removed);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = f.elements.filter(e => e.id !== elementId);
        paintStore.markDirty(layerId, frame);
      },
    });
  },

  clearFrame(layerId: string, frame: number): void {
    const frameData = _frames.get(layerId)?.get(frame);
    if (!frameData || frameData.elements.length === 0) return;
    const backup = [...frameData.elements];
    frameData.elements = [];
    this.markDirty(layerId, frame);
    paintVersion.value++;
    _markProjectDirty?.();
    pushAction({
      id: crypto.randomUUID(),
      description: `Clear paint frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...backup];
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [];
        paintStore.markDirty(layerId, frame);
      },
    });
  },

  getLayerFrameNumbers(layerId: string): number[] {
    const layerFrames = _frames.get(layerId);
    if (!layerFrames) return [];
    return Array.from(layerFrames.keys()).sort((a, b) => a - b);
  },

  removeLayer(layerId: string): void {
    _frames.delete(layerId);
    // Remove dirty entries for this layer
    for (const key of _dirtyFrames) {
      if (key.startsWith(layerId + ':')) {
        _dirtyFrames.delete(key);
      }
    }
  },

  markDirty(layerId: string, frame: number): void {
    _dirtyFrames.add(`${layerId}:${frame}`);
  },

  getDirtyFrames(): Array<{layerId: string; frame: number}> {
    const result: Array<{layerId: string; frame: number}> = [];
    for (const key of _dirtyFrames) {
      const [layerId, frameStr] = key.split(':');
      result.push({layerId, frame: parseInt(frameStr, 10)});
    }
    _dirtyFrames.clear();
    return result;
  },

  /** Load frame data without undo (used by persistence) */
  loadFrame(layerId: string, frame: number, pf: PaintFrame): void {
    let layerFrames = _frames.get(layerId);
    if (!layerFrames) {
      layerFrames = new Map();
      _frames.set(layerId, layerFrames);
    }
    layerFrames.set(frame, pf);
    paintVersion.value++;
  },

  /** Clear all paint data (called on project close/new) */
  reset(): void {
    _frames.clear();
    _dirtyFrames.clear();
    paintMode.value = false;
    activeTool.value = 'brush';
    brushSize.value = DEFAULT_BRUSH_SIZE;
    brushColor.value = DEFAULT_BRUSH_COLOR;
    brushOpacity.value = DEFAULT_BRUSH_OPACITY;
    strokeOptions.value = {...DEFAULT_STROKE_OPTIONS};
    shapeFilled.value = false;
    fillTolerance.value = 10;
    tabletDetected.value = false;
    livePressure.value = 0;
    brushStyle.value = 'flat';
    brushFxParams.value = {};
    paintBgColor.value = DEFAULT_PAINT_BG_COLOR;
    selectedStrokeIds.value = new Set();
    showSequenceOverlay.value = false;
    _frameFxCache.clear();
    onionSkinEnabled.value = false;
    onionSkinPrevRange.value = 1;
    onionSkinNextRange.value = 0;
    onionSkinOpacity.value = 0.3;
  },

  // Tool settings
  togglePaintMode(): void {
    paintMode.value = !paintMode.value;
  },

  setTool(tool: PaintToolType): void {
    activeTool.value = tool;
  },

  setBrushSize(size: number): void {
    brushSize.value = Math.max(BRUSH_SIZE_MIN, Math.min(BRUSH_SIZE_MAX, size));
  },

  setBrushColor(color: string): void {
    brushColor.value = color;
  },

  setBrushOpacity(opacity: number): void {
    brushOpacity.value = Math.max(0, Math.min(1, opacity));
  },

  setTabletDetected(detected: boolean): void {
    tabletDetected.value = detected;
  },

  setBrushStyle(style: BrushStyle): void {
    brushStyle.value = style;
    // Reset FX params to style defaults when style changes (per D-07)
    brushFxParams.value = { ...DEFAULT_BRUSH_FX_PARAMS[style] };
  },

  setBrushFxParams(params: BrushFxParams): void {
    brushFxParams.value = params;
  },

  updateBrushFxParam(key: keyof BrushFxParams, value: number): void {
    brushFxParams.value = { ...brushFxParams.value, [key]: value };
  },

  // --- Paint background color ---

  setPaintBgColor(color: string): void {
    paintBgColor.value = color;
  },

  // --- Sequence overlay (D-13, D-14) ---

  setShowSequenceOverlay(show: boolean): void {
    showSequenceOverlay.value = show;
  },

  toggleSequenceOverlay(): void {
    showSequenceOverlay.value = !showSequenceOverlay.peek();
  },

  // --- Stroke selection ---

  selectStroke(strokeId: string): void {
    const next = new Set(selectedStrokeIds.peek());
    next.add(strokeId);
    selectedStrokeIds.value = next;
  },

  deselectStroke(strokeId: string): void {
    const next = new Set(selectedStrokeIds.peek());
    next.delete(strokeId);
    selectedStrokeIds.value = next;
  },

  clearSelection(): void {
    selectedStrokeIds.value = new Set();
  },

  toggleStrokeSelection(strokeId: string): void {
    const current = selectedStrokeIds.peek();
    const next = new Set(current);
    if (current.has(strokeId)) {
      next.delete(strokeId);
    } else {
      next.add(strokeId);
    }
    selectedStrokeIds.value = next;
  },

  // --- Per-frame FX cache ---

  /** Store a frame-level FX cache canvas (all FX strokes rendered together by p5.brush). */
  setFrameFxCache(layerId: string, frame: number, canvas: HTMLCanvasElement): void {
    _frameFxCache.set(`${layerId}:${frame}`, canvas);
  },

  /** Get the cached frame-level FX canvas, or null if not cached. */
  getFrameFxCache(layerId: string, frame: number): HTMLCanvasElement | null {
    return _frameFxCache.get(`${layerId}:${frame}`) ?? null;
  },

  /** Invalidate the frame-level FX cache (called when any stroke on the frame changes). */
  invalidateFrameFxCache(layerId: string, frame: number): void {
    _frameFxCache.delete(`${layerId}:${frame}`);
  },

  /** Clear all frame FX caches (e.g., on project close). */
  clearAllFrameFxCaches(): void {
    _frameFxCache.clear();
  },

  // --- Flatten / Unflatten (per D-17) ---

  /**
   * Flatten a frame: re-render all FX strokes together via renderFrameFx,
   * store as frame cache, and mark strokes as 'flattened'.
   * Fastest playback: single drawImage() from frame cache.
   */
  flattenFrame(layerId: string, frame: number): void {
    const paintFrame = this.getFrame(layerId, frame);
    if (!paintFrame || paintFrame.elements.length === 0) return;

    const projW = projectStore.width.peek();
    const projH = projectStore.height.peek();

    // Collect all brush strokes for renderFrameFx
    const brushStrokes = paintFrame.elements.filter(
      (el) => el.tool === 'brush'
    ) as PaintStroke[];

    // Ensure all styled strokes are marked fx-applied for renderFrameFx to include them
    for (const s of brushStrokes) {
      if (s.brushStyle && s.brushStyle !== 'flat' && s.fxState !== 'fx-applied') {
        s.fxState = 'fx-applied';
      }
    }

    // Render all FX strokes together on one p5.brush canvas (spectral mixing)
    const fxCanvas = renderFrameFx(brushStrokes, projW, projH);
    if (fxCanvas) {
      this.setFrameFxCache(layerId, frame, fxCanvas);
    }

    // Mark all FX strokes as flattened
    for (const s of brushStrokes) {
      if (s.brushStyle && s.brushStyle !== 'flat') {
        s.fxState = 'flattened';
      }
    }

    this.markDirty(layerId, frame);
    paintVersion.value++;
    _markProjectDirty?.();
  },

  /**
   * Unflatten a frame: restore FX strokes to fx-applied state and
   * re-render the frame cache.
   */
  unflattenFrame(layerId: string, frame: number): void {
    const paintFrame = this.getFrame(layerId, frame);
    if (!paintFrame) return;

    const projW = projectStore.width.peek();
    const projH = projectStore.height.peek();

    // Restore FX strokes to fx-applied state
    const brushStrokes = paintFrame.elements.filter(
      (el) => el.tool === 'brush'
    ) as PaintStroke[];

    for (const s of brushStrokes) {
      if (s.brushStyle && s.brushStyle !== 'flat') {
        s.fxState = 'fx-applied';
      } else {
        s.fxState = 'flat';
      }
    }

    // Re-render frame cache with all FX strokes
    const fxCanvas = renderFrameFx(brushStrokes, projW, projH);
    if (fxCanvas) {
      this.setFrameFxCache(layerId, frame, fxCanvas);
    } else {
      this.invalidateFrameFxCache(layerId, frame);
    }

    this.markDirty(layerId, frame);
    paintVersion.value++;
  },
};
