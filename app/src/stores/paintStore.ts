import {signal, effect} from '@preact/signals';
import type {PaintElement, PaintFrame, PaintToolType, PaintStrokeOptions, BrushStyle, BrushFxParams, PaintStroke, PaintShape} from '../types/paint';
import {DEFAULT_BRUSH_SIZE, DEFAULT_BRUSH_COLOR, DEFAULT_BRUSH_OPACITY, DEFAULT_STROKE_OPTIONS, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX, DEFAULT_BRUSH_FX_PARAMS, DEFAULT_PAINT_BG_COLOR} from '../types/paint';
import {pointsToBezierAnchors, shapeToAnchors} from '../lib/bezierPath';
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
const sequenceOverlayOpacity = signal(0.3);
const isRenderingFx = signal(false);
const showFlatPreview = signal(false);
const activePaintMode = signal<'flat' | 'fx-paint'>('flat');
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

/** Centralized notification: mark frame dirty, bump paintVersion, and notify project */
function _notifyVisualChange(layerId: string, frame: number): void {
  _dirtyFrames.add(`${layerId}:${frame}`);
  paintVersion.value++;
  _markProjectDirty?.();
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
  sequenceOverlayOpacity,
  isRenderingFx,
  showFlatPreview,
  activePaintMode,
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
    _notifyVisualChange(layerId, frame);
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
    _notifyVisualChange(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Remove paint element from frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements.splice(idx, 0, removed);
        _notifyVisualChange(layerId, frame);
        paintStore.invalidateFrameFxCache(layerId, frame);
        paintStore.refreshFrameFx(layerId, frame);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = f.elements.filter(e => e.id !== elementId);
        paintStore.markDirty(layerId, frame);
      },
    });
  },

  /** Move selected elements forward (toward top/front) in rendering order */
  moveElementsForward(layerId: string, frame: number, ids: Set<string>): void {
    const frameData = _frames.get(layerId)?.get(frame);
    if (!frameData) return;
    const before = [...frameData.elements];
    const els = frameData.elements;
    for (let i = els.length - 2; i >= 0; i--) {
      if (ids.has(els[i].id) && !ids.has(els[i + 1].id)) {
        [els[i], els[i + 1]] = [els[i + 1], els[i]];
      }
    }
    const after = [...frameData.elements];
    _notifyVisualChange(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Move elements forward on frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...before];
        _notifyVisualChange(layerId, frame);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...after];
        _notifyVisualChange(layerId, frame);
      },
    });
  },

  /** Move selected elements backward (toward bottom/back) in rendering order */
  moveElementsBackward(layerId: string, frame: number, ids: Set<string>): void {
    const frameData = _frames.get(layerId)?.get(frame);
    if (!frameData) return;
    const before = [...frameData.elements];
    const els = frameData.elements;
    for (let i = 1; i < els.length; i++) {
      if (ids.has(els[i].id) && !ids.has(els[i - 1].id)) {
        [els[i - 1], els[i]] = [els[i], els[i - 1]];
      }
    }
    const after = [...frameData.elements];
    _notifyVisualChange(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Move elements backward on frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...before];
        _notifyVisualChange(layerId, frame);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...after];
        _notifyVisualChange(layerId, frame);
      },
    });
  },

  /** Move selected elements to the very front */
  moveElementsToFront(layerId: string, frame: number, ids: Set<string>): void {
    const frameData = _frames.get(layerId)?.get(frame);
    if (!frameData) return;
    const before = [...frameData.elements];
    const selected = frameData.elements.filter(e => ids.has(e.id));
    const rest = frameData.elements.filter(e => !ids.has(e.id));
    frameData.elements.length = 0;
    frameData.elements.push(...rest, ...selected);
    const after = [...frameData.elements];
    _notifyVisualChange(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Move elements to front on frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...before];
        _notifyVisualChange(layerId, frame);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...after];
        _notifyVisualChange(layerId, frame);
      },
    });
  },

  /** Move selected elements to the very back */
  moveElementsToBack(layerId: string, frame: number, ids: Set<string>): void {
    const frameData = _frames.get(layerId)?.get(frame);
    if (!frameData) return;
    const before = [...frameData.elements];
    const selected = frameData.elements.filter(e => ids.has(e.id));
    const rest = frameData.elements.filter(e => !ids.has(e.id));
    frameData.elements.length = 0;
    frameData.elements.push(...selected, ...rest);
    const after = [...frameData.elements];
    _notifyVisualChange(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Move elements to back on frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...before];
        _notifyVisualChange(layerId, frame);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...after];
        _notifyVisualChange(layerId, frame);
      },
    });
  },

  reorderElements(layerId: string, frame: number, oldIndex: number, newIndex: number): void {
    const frameData = _frames.get(layerId)?.get(frame);
    if (!frameData || oldIndex === newIndex) return;
    const before = [...frameData.elements];
    const [moved] = frameData.elements.splice(oldIndex, 1);
    frameData.elements.splice(newIndex, 0, moved);
    const after = [...frameData.elements];
    _notifyVisualChange(layerId, frame);
    this.invalidateFrameFxCache(layerId, frame);
    this.refreshFrameFx(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Reorder element on frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...before];
        _notifyVisualChange(layerId, frame);
        paintStore.invalidateFrameFxCache(layerId, frame);
        paintStore.refreshFrameFx(layerId, frame);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [...after];
        _notifyVisualChange(layerId, frame);
        paintStore.invalidateFrameFxCache(layerId, frame);
        paintStore.refreshFrameFx(layerId, frame);
      },
    });
  },

  setElementVisibility(layerId: string, frame: number, elementId: string, visible: boolean): void {
    const frameData = _frames.get(layerId)?.get(frame);
    if (!frameData) return;
    const el = frameData.elements.find(e => e.id === elementId);
    if (!el) return;
    const prevVisible = el.visible !== false; // undefined = true
    if (prevVisible === visible) return; // no-op
    el.visible = visible ? undefined : false; // store undefined for true (backward compat), false for hidden
    _notifyVisualChange(layerId, frame);
    this.invalidateFrameFxCache(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Toggle element visibility on frame ${frame}`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        const target = f.elements.find(e => e.id === elementId);
        if (target) {
          target.visible = prevVisible ? undefined : false;
          _notifyVisualChange(layerId, frame);
          paintStore.invalidateFrameFxCache(layerId, frame);
        }
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        const target = f.elements.find(e => e.id === elementId);
        if (target) {
          target.visible = visible ? undefined : false;
          _notifyVisualChange(layerId, frame);
          paintStore.invalidateFrameFxCache(layerId, frame);
        }
      },
    });
  },

  clearFrame(layerId: string, frame: number): void {
    const frameData = _frames.get(layerId)?.get(frame);
    if (!frameData || frameData.elements.length === 0) return;
    const backup = [...frameData.elements];
    frameData.elements = [];
    _notifyVisualChange(layerId, frame);
    paintStore.invalidateFrameFxCache(layerId, frame);
    paintStore.refreshFrameFx(layerId, frame);
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
        _notifyVisualChange(layerId, frame);
        paintStore.invalidateFrameFxCache(layerId, frame);
        paintStore.refreshFrameFx(layerId, frame);
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
    sequenceOverlayOpacity.value = 0.3;
    isRenderingFx.value = false;
    showFlatPreview.value = false;
    activePaintMode.value = 'flat';
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
    import('../lib/paintPreferences').then(m => m.saveBrushSize(size));
  },

  setActivePaintMode(mode: 'flat' | 'fx-paint'): void {
    activePaintMode.value = mode;
    import('../lib/paintPreferences').then(m => m.savePaintMode(mode));
  },

  /** Initialize paint preferences from persisted storage */
  initFromPreferences(): void {
    import('../lib/paintPreferences').then(async (m) => {
      const prefs = await m.loadBrushPreferences();
      brushColor.value = prefs.color;
      brushSize.value = prefs.size;
      // Restore paint mode
      const mode = await m.loadPaintMode();
      if (mode === 'flat' || mode === 'fx-paint') {
        activePaintMode.value = mode;
      }
    });
  },

  setBrushColor(color: string): void {
    brushColor.value = color;
    import('../lib/paintPreferences').then(m => m.saveBrushColor(color));
    // Refresh FX canvas when color changes in FX mode
    if (activePaintMode.peek() === 'fx-paint' && paintMode.peek()) {
      // Lazy import to avoid circular dependency (layerStore/timelineStore not imported at top)
      Promise.all([
        import('./layerStore'),
        import('./timelineStore'),
      ]).then(([{layerStore: ls}, {timelineStore: ts}]) => {
        const layerId = ls.selectedLayerId.peek();
        if (layerId) {
          const frame = ts.currentFrame.peek();
          paintStore.invalidateFrameFxCache(layerId, frame);
          paintStore.refreshFrameFx(layerId, frame);
        }
      });
    }
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
    paintVersion.value++;
  },

  // --- Sequence overlay (D-13, D-14) ---

  setShowSequenceOverlay(show: boolean): void {
    showSequenceOverlay.value = show;
  },

  toggleSequenceOverlay(): void {
    showSequenceOverlay.value = !showSequenceOverlay.peek();
    paintVersion.value++;
  },
  setSequenceOverlayOpacity(v: number): void {
    sequenceOverlayOpacity.value = v;
    paintVersion.value++;
  },

  toggleFlatPreview(): void {
    showFlatPreview.value = !showFlatPreview.peek();
    paintVersion.value++;
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

  /** Re-render FX cache for a frame (call after modifying stroke params like width/color) */
  refreshFrameFx(layerId: string, frame: number): void {
    const paintFrame = this.getFrame(layerId, frame);
    if (!paintFrame) return;

    const projW = projectStore.width.peek();
    const projH = projectStore.height.peek();

    const brushStrokes = paintFrame.elements.filter(
      (el) => el.tool === 'brush'
    ) as PaintStroke[];

    this.invalidateFrameFxCache(layerId, frame);
    const fxCanvas = renderFrameFx(brushStrokes, projW, projH);
    if (fxCanvas) {
      this.setFrameFxCache(layerId, frame, fxCanvas);
    }

    this.markDirty(layerId, frame);
    paintVersion.value++;
  },

  /** Expose _notifyVisualChange for external bezier editing undo/redo callbacks (Phase 25) */
  _notifyVisualChange(layerId: string, frame: number): void {
    _notifyVisualChange(layerId, frame);
  },

  // --- Bezier conversion methods (Phase 25) ---

  /** Convert a PaintStroke's freehand points to bezier anchors (D-04).
   * Called when pen tool first activates on a stroke that has no anchors yet. */
  convertToBezier(layerId: string, frame: number, elementId: string): void {
    const f = _getOrCreateFrame(layerId, frame);
    const idx = f.elements.findIndex(el => el.id === elementId);
    if (idx < 0) return;
    const el = f.elements[idx];
    if (el.tool !== 'brush' && el.tool !== 'eraser') return;
    const stroke = el as PaintStroke;
    if (stroke.anchors) return; // already converted
    stroke.anchors = pointsToBezierAnchors(stroke.points, 4.0);
    _notifyVisualChange(layerId, frame);
  },

  /** Re-fit a stroke's bezier anchors with a higher tolerance to reduce anchor count.
   * Each call increases tolerance, producing fewer anchors. Returns the new count. */
  _simplifyTolerance: new Map<string, number>(),
  simplifyBezier(layerId: string, frame: number, elementId: string): number {
    const f = _getOrCreateFrame(layerId, frame);
    const idx = f.elements.findIndex(el => el.id === elementId);
    if (idx < 0) return 0;
    const el = f.elements[idx];
    if (el.tool !== 'brush' && el.tool !== 'eraser') return 0;
    const stroke = el as PaintStroke;
    if (!stroke.anchors || stroke.points.length < 2) return stroke.anchors?.length ?? 0;
    // Progressive: each click doubles the tolerance from last used
    const prevTol = this._simplifyTolerance.get(elementId) ?? 4.0;
    const newTol = prevTol * 2.5;
    this._simplifyTolerance.set(elementId, newTol);
    const prevCount = stroke.anchors.length;
    stroke.anchors = pointsToBezierAnchors(stroke.points, newTol);
    // If no change (already minimal), don't notify
    if (stroke.anchors.length >= prevCount && stroke.anchors.length <= 2) return stroke.anchors.length;
    _notifyVisualChange(layerId, frame);
    return stroke.anchors.length;
  },

  /** Convert a PaintShape to a PaintStroke with bezier anchors (D-03, D-06).
   * One-way conversion: shape loses identity, becomes a stroke with bezier data. */
  convertShapeToBezier(layerId: string, frame: number, elementId: string): void {
    const f = _getOrCreateFrame(layerId, frame);
    const idx = f.elements.findIndex(el => el.id === elementId);
    if (idx < 0) return;
    const el = f.elements[idx];
    if (el.tool !== 'line' && el.tool !== 'rect' && el.tool !== 'ellipse') return;
    const shape = el as PaintShape;
    const { anchors, closedPath } = shapeToAnchors(shape);
    // Create a PaintStroke that replaces the shape
    const newStroke: PaintStroke = {
      id: shape.id,  // preserve ID for selection continuity
      tool: 'brush',
      points: [],    // empty -- rendering uses anchors
      color: shape.color,
      opacity: shape.opacity,
      size: shape.strokeWidth || 2,
      options: { ...DEFAULT_STROKE_OPTIONS },
      anchors,
      closedPath,
      visible: shape.visible,
    };
    f.elements[idx] = newStroke;
    _notifyVisualChange(layerId, frame);
  },
};

// Auto-flatten current frame when exiting paint mode
let _wasPaintMode = false;
effect(() => {
  const active = paintMode.value;
  if (_wasPaintMode && !active) {
    // Lazy imports to avoid circular dependencies
    const {layerStore} = require('./layerStore');
    const {timelineStore} = require('./timelineStore');
    const layerId = layerStore.selectedLayerId.peek();
    const frame = timelineStore.currentFrame.peek();
    if (layerId) {
      paintStore.flattenFrame(layerId, frame);
    }
  }
  _wasPaintMode = active;
});
