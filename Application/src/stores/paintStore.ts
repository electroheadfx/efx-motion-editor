import {signal} from '@preact/signals';
import type {PaintElement, PaintFrame, PaintToolType, PaintStrokeOptions} from '../types/paint';
import {DEFAULT_BRUSH_SIZE, DEFAULT_BRUSH_COLOR, DEFAULT_BRUSH_OPACITY, DEFAULT_STROKE_OPTIONS, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX} from '../types/paint';
import {pushAction} from '../lib/history';

// --- Signals (module-scoped, exposed on exported object) ---

/** Whether paint mode is active (toggle via canvas toolbar, per D-09) */
const paintMode = signal(false);

/** Current paint tool (per D-04) */
const activeTool = signal<PaintToolType>('brush');

/** Brush diameter in project pixels */
const brushSize = signal(DEFAULT_BRUSH_SIZE);

/** Hex color for brush/shapes */
const brushColor = signal(DEFAULT_BRUSH_COLOR);

/** Brush opacity 0-1 */
const brushOpacity = signal(DEFAULT_BRUSH_OPACITY);

/** Options passed to perfect-freehand getStroke() */
const strokeOptions = signal<PaintStrokeOptions>(DEFAULT_STROKE_OPTIONS);

/** Whether shapes are filled or outline-only */
const shapeFilled = signal(false);

/** Flood fill color-matching tolerance 0-255 */
const fillTolerance = signal(10);

/** Onion skinning toggle (per D-08) */
const onionSkinEnabled = signal(false);

/** Onion skin: how many frames back to show */
const onionSkinPrevRange = signal(3);

/** Onion skin: how many frames forward to show */
const onionSkinNextRange = signal(2);

/** Onion skin: base opacity for ghost frames */
const onionSkinOpacity = signal(0.3);

// --- Private state ---

/** layerId -> (frameNumber -> PaintFrame) */
const _frames = new Map<string, Map<number, PaintFrame>>();

/** "layerId:frameNum" strings for persistence dirty tracking */
const _dirtyFrames = new Set<string>();

// --- Internal helpers ---

function _getOrCreateFrame(layerId: string, frame: number): PaintFrame {
  let layerFrames = _frames.get(layerId);
  if (!layerFrames) {
    layerFrames = new Map<number, PaintFrame>();
    _frames.set(layerId, layerFrames);
  }
  let paintFrame = layerFrames.get(frame);
  if (!paintFrame) {
    paintFrame = {elements: []};
    layerFrames.set(frame, paintFrame);
  }
  return paintFrame;
}

function _dirtyKey(layerId: string, frame: number): string {
  return `${layerId}:${frame}`;
}

// --- Exported store ---

export const paintStore = {
  // Signals
  paintMode,
  activeTool,
  brushSize,
  brushColor,
  brushOpacity,
  strokeOptions,
  shapeFilled,
  fillTolerance,
  onionSkinEnabled,
  onionSkinPrevRange,
  onionSkinNextRange,
  onionSkinOpacity,

  /** Returns paint data for a specific frame, or null if no data exists */
  getFrame(layerId: string, frame: number): PaintFrame | null {
    const layerFrames = _frames.get(layerId);
    if (!layerFrames) return null;
    return layerFrames.get(frame) ?? null;
  },

  /** Replaces entire frame data */
  setFrame(layerId: string, frame: number, paintFrame: PaintFrame): void {
    let layerFrames = _frames.get(layerId);
    if (!layerFrames) {
      layerFrames = new Map<number, PaintFrame>();
      _frames.set(layerId, layerFrames);
    }
    layerFrames.set(frame, paintFrame);
    this.markDirty(layerId, frame);
  },

  /** Adds element to frame, pushes undo action */
  addElement(layerId: string, frame: number, element: PaintElement): void {
    const frameData = _getOrCreateFrame(layerId, frame);
    frameData.elements.push(element);
    this.markDirty(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Add paint element`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = f.elements.filter(e => e.id !== element.id);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements.push(element);
        this.markDirty(layerId, frame);
      },
    });
  },

  /** Removes element by id, pushes undo action */
  removeElement(layerId: string, frame: number, elementId: string): void {
    const frameData = _getOrCreateFrame(layerId, frame);
    const idx = frameData.elements.findIndex(e => e.id === elementId);
    if (idx === -1) return;
    const removed = frameData.elements[idx];
    frameData.elements.splice(idx, 1);
    this.markDirty(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Remove paint element`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements.splice(idx, 0, removed);
        this.markDirty(layerId, frame);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = f.elements.filter(e => e.id !== elementId);
        this.markDirty(layerId, frame);
      },
    });
  },

  /** Clears all elements from a frame, pushes undo action */
  clearFrame(layerId: string, frame: number): void {
    const frameData = _getOrCreateFrame(layerId, frame);
    const prevElements = [...frameData.elements];
    if (prevElements.length === 0) return;
    frameData.elements = [];
    this.markDirty(layerId, frame);
    pushAction({
      id: crypto.randomUUID(),
      description: `Clear paint frame`,
      timestamp: Date.now(),
      undo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = prevElements;
        this.markDirty(layerId, frame);
      },
      redo: () => {
        const f = _getOrCreateFrame(layerId, frame);
        f.elements = [];
        this.markDirty(layerId, frame);
      },
    });
  },

  /** Returns all frame numbers that have paint data for a layer */
  getLayerFrameNumbers(layerId: string): number[] {
    const layerFrames = _frames.get(layerId);
    if (!layerFrames) return [];
    return Array.from(layerFrames.keys()).sort((a, b) => a - b);
  },

  /** Removes all frames for a layer (called when layer is deleted) */
  removeLayer(layerId: string): void {
    _frames.delete(layerId);
  },

  /** Adds to _dirtyFrames set for persistence tracking */
  markDirty(layerId: string, frame: number): void {
    _dirtyFrames.add(_dirtyKey(layerId, frame));
  },

  /** Returns and clears dirty frames */
  getDirtyFrames(): Array<{layerId: string; frame: number}> {
    const result: Array<{layerId: string; frame: number}> = [];
    for (const key of _dirtyFrames) {
      const [layerId, frameStr] = key.split(':');
      result.push({layerId, frame: parseInt(frameStr, 10)});
    }
    _dirtyFrames.clear();
    return result;
  },

  /** Loads frame data without undo (used by persistence) */
  loadFrame(layerId: string, frame: number, paintFrame: PaintFrame): void {
    let layerFrames = _frames.get(layerId);
    if (!layerFrames) {
      layerFrames = new Map<number, PaintFrame>();
      _frames.set(layerId, layerFrames);
    }
    layerFrames.set(frame, paintFrame);
  },

  /** Clears all paint data (called on project close/new) */
  reset(): void {
    _frames.clear();
    _dirtyFrames.clear();
    paintMode.value = false;
    activeTool.value = 'brush';
    brushSize.value = DEFAULT_BRUSH_SIZE;
    brushColor.value = DEFAULT_BRUSH_COLOR;
    brushOpacity.value = DEFAULT_BRUSH_OPACITY;
    strokeOptions.value = DEFAULT_STROKE_OPTIONS;
    shapeFilled.value = false;
    fillTolerance.value = 10;
    onionSkinEnabled.value = false;
    onionSkinPrevRange.value = 3;
    onionSkinNextRange.value = 2;
    onionSkinOpacity.value = 0.3;
  },

  /** Toggles paintMode signal */
  togglePaintMode(): void {
    paintMode.value = !paintMode.value;
  },

  /** Sets activeTool signal */
  setTool(tool: PaintToolType): void {
    activeTool.value = tool;
  },

  /** Sets brush size, clamped to BRUSH_SIZE_MIN..BRUSH_SIZE_MAX */
  setBrushSize(size: number): void {
    brushSize.value = Math.max(BRUSH_SIZE_MIN, Math.min(BRUSH_SIZE_MAX, size));
  },

  /** Sets brush color */
  setBrushColor(color: string): void {
    brushColor.value = color;
  },

  /** Sets brush opacity, clamped to 0..1 */
  setBrushOpacity(opacity: number): void {
    brushOpacity.value = Math.max(0, Math.min(1, opacity));
  },
};
