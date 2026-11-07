import { computed, signal, type Signal } from '@preact/signals';
import { getContainedCanvasDisplaySize } from '../engine/physicsPaintCanvasSizing';

/**
 * 261104-uyv: the Studio canvas zoom surface.
 *
 * DISPLAY-ONLY. The engine's working size, `paperTextureScale`, the document,
 * persistence, export and every paint byte are untouched. Zoom grows the shell
 * by REAL CSS size; the pan is a translate on an ancestor layer. A scale
 * transform would double-scale every client-rect-derived mapping (canvasBounds,
 * pointer ratios, the picker, the brush ring), so it is forbidden here.
 *
 * FIT stays the opening view and follows container resizes. It is not the
 * floor: the zoom-out floor is the ladder bottom (10%), so a sheet fitted at
 * 36% can still be viewed smaller. 1:1 maps one engine working pixel to one
 * CSS pixel and is pannable because a 1080x1920 sheet overflows a typical
 * Studio window.
 */

/** The same preset ladder as the main editor's canvasStore. */
export const PHYSICS_PAINT_ZOOM_PRESETS: readonly number[] = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
export const PHYSICS_PAINT_ZOOM_MAX = 4;

/** A step smaller than this is a no-op, never an overshoot. */
export const PHYSICS_PAINT_ZOOM_EPSILON = 0.001;

/**
 * The watercolor engine's `fitCanvas` sizes its WebGL backing store from the
 * shell's CSS box times devicePixelRatio (capped at 2), so backing pixels grow
 * with scale SQUARED. A flat 400% on a 1080x1920 sheet would allocate roughly
 * 132 megapixels (about 530 MB) and kill the WebView. This budget (about 64 MB
 * RGBA worst case) still admits 1:1 for every reachable working size: the
 * working long edge is capped at 1920, and 1920x1920 x 4 = 14.75 MP < 16 MP.
 */
export const PHYSICS_PAINT_ZOOM_BACKING_BUDGET = 16_000_000;
export const PHYSICS_PAINT_ENGINE_DPR_CAP = 2;

export interface ZoomPanOffset {
  x: number;
  y: number;
}

export interface ZoomDisplaySize {
  width: number;
  height: number;
}

export interface CursorAnchoredPanInput {
  containerWidth: number;
  containerHeight: number;
  displayWidth: number;
  displayHeight: number;
  panX: number;
  panY: number;
  nextDisplayWidth: number;
  nextDisplayHeight: number;
  /** Offset from the container CENTER, in CSS pixels. */
  cursorX: number;
  cursorY: number;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Fit delegates to the sizing authority so Fit is byte-identical to today. */
export function resolveFitScale(containerWidth: number, containerHeight: number, workWidth: number, workHeight: number): number {
  if (containerWidth <= 0 || containerHeight <= 0 || workWidth <= 0 || workHeight <= 0) return 0;
  const contained = getContainedCanvasDisplaySize(containerWidth, containerHeight, workWidth, workHeight);
  if (!contained) return 0;
  return contained.width / workWidth;
}

/**
 * The largest scale whose engine backing store stays inside the pixel budget.
 * 1:1 is always reachable for every working size the engine can produce.
 */
export function resolveMaxScale(
  workWidth: number,
  workHeight: number,
  budget: number = PHYSICS_PAINT_ZOOM_BACKING_BUDGET,
  dprCap: number = PHYSICS_PAINT_ENGINE_DPR_CAP,
): number {
  if (!Number.isFinite(workWidth) || !Number.isFinite(workHeight) || workWidth <= 0 || workHeight <= 0) {
    return PHYSICS_PAINT_ZOOM_MAX;
  }
  const backingPerCssPixel = dprCap * dprCap;
  const raw = Math.sqrt(budget / (workWidth * workHeight * backingPerCssPixel));
  return Math.max(1, Math.min(PHYSICS_PAINT_ZOOM_MAX, raw));
}

/**
 * The floor is the ladder bottom, so the view can zoom out BELOW Fit (a 36%
 * fit reaches 10%). Fit itself is never below the floor when a tiny sheet in a
 * huge container fits at under 10% — there the fit value is the floor so Fit
 * stays exact.
 */
export function resolveMinScale(fitScale: number): number {
  if (!Number.isFinite(fitScale) || fitScale <= 0) return 0;
  return Math.min(fitScale, PHYSICS_PAINT_ZOOM_PRESETS[0]);
}

export function clampZoomScale(scale: number, minScale: number, maxScale: number): number {
  if (!Number.isFinite(scale)) return minScale;
  const lower = Number.isFinite(minScale) ? minScale : 0;
  const upper = Number.isFinite(maxScale) ? Math.max(lower, maxScale) : PHYSICS_PAINT_ZOOM_MAX;
  return Math.min(upper, Math.max(lower, scale));
}

/**
 * First preset strictly beyond `current` (direction 1 = in, -1 = out), clamped
 * into the allowed range. A boundary step returns the clamped current value —
 * a no-op value the callers compare against, never an overshoot.
 */
export function nextScalePreset(current: number, direction: 1 | -1, minScale: number, maxScale: number): number {
  if (!Number.isFinite(current)) return current;
  if (direction > 0) {
    for (const preset of PHYSICS_PAINT_ZOOM_PRESETS) {
      if (preset > current + PHYSICS_PAINT_ZOOM_EPSILON) return clampZoomScale(preset, minScale, maxScale);
    }
    return current;
  }
  for (let index = PHYSICS_PAINT_ZOOM_PRESETS.length - 1; index >= 0; index -= 1) {
    const preset = PHYSICS_PAINT_ZOOM_PRESETS[index];
    if (preset < current - PHYSICS_PAINT_ZOOM_EPSILON) return clampZoomScale(preset, minScale, maxScale);
  }
  return current;
}

export function resolveDisplaySize(workWidth: number, workHeight: number, scale: number): ZoomDisplaySize {
  if (!Number.isFinite(workWidth) || !Number.isFinite(workHeight) || !Number.isFinite(scale) || workWidth <= 0 || workHeight <= 0 || scale <= 0) {
    return { width: 0, height: 0 };
  }
  return { width: workWidth * scale, height: workHeight * scale };
}

export function resolveZoomPercent(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  return Math.round(scale * 100);
}

/** Non-negative half-overflow per axis: the pan budget that keeps the sheet reachable. */
export function resolveMaxPan(displayWidth: number, displayHeight: number, containerWidth: number, containerHeight: number): ZoomPanOffset {
  const displayW = finiteOrZero(displayWidth);
  const displayH = finiteOrZero(displayHeight);
  const containerW = finiteOrZero(containerWidth);
  const containerH = finiteOrZero(containerHeight);
  return {
    x: Math.max(0, (displayW - containerW) / 2),
    y: Math.max(0, (displayH - containerH) / 2),
  };
}

export function clampPanToBounds(
  x: number,
  y: number,
  displayWidth: number,
  displayHeight: number,
  containerWidth: number,
  containerHeight: number,
): ZoomPanOffset {
  const max = resolveMaxPan(displayWidth, displayHeight, containerWidth, containerHeight);
  const clampedX = Math.max(-max.x, Math.min(max.x, Number.isFinite(x) ? x : 0));
  const clampedY = Math.max(-max.y, Math.min(max.y, Number.isFinite(y) ? y : 0));
  // Normalize -0 to +0: a clamped zero pan must compare equal on both axes.
  return { x: clampedX === 0 ? 0 : clampedX, y: clampedY === 0 ? 0 : clampedY };
}

/**
 * The ONE anchored-pan law, shared by the cursor wheel/pinch path and the
 * center-anchored button steps (a zero cursor).
 *
 * The sheet is centered in the container, so the local point under a cursor is
 * `(cursor + display/2 - pan) / display`. Holding that fraction fixed through
 * the size change solves the anchored pan. The result is clamped to the pan
 * budget, so anchoring degrades gracefully at the edges.
 */
export function resolveCursorAnchoredPan(input: CursorAnchoredPanInput): ZoomPanOffset {
  const displayW = finiteOrZero(input.displayWidth);
  const displayH = finiteOrZero(input.displayHeight);
  const nextW = finiteOrZero(input.nextDisplayWidth);
  const nextH = finiteOrZero(input.nextDisplayHeight);
  const cursorX = Number.isFinite(input.cursorX) ? input.cursorX : 0;
  const cursorY = Number.isFinite(input.cursorY) ? input.cursorY : 0;
  const fractionX = displayW > 0 ? (cursorX + displayW / 2 - input.panX) / displayW : 0.5;
  const fractionY = displayH > 0 ? (cursorY + displayH / 2 - input.panY) / displayH : 0.5;
  const anchoredX = cursorX + nextW / 2 - fractionX * nextW;
  const anchoredY = cursorY + nextH / 2 - fractionY * nextH;
  return clampPanToBounds(anchoredX, anchoredY, nextW, nextH, input.containerWidth, input.containerHeight);
}

// --- Signals -------------------------------------------------------------

const containerWidth = signal(0);
const containerHeight = signal(0);
const workWidth = signal(0);
const workHeight = signal(0);
const zoomMode = signal<'fit' | 'absolute'>('fit');
const absoluteScale = signal(1);
const panX = signal(0);
const panY = signal(0);

const fitScale = computed(() => resolveFitScale(containerWidth.value, containerHeight.value, workWidth.value, workHeight.value));
const minScale = computed(() => resolveMinScale(fitScale.value));
const maxScale = computed(() => resolveMaxScale(workWidth.value, workHeight.value));
const measured = computed(
  () => containerWidth.value > 0 && containerHeight.value > 0 && workWidth.value > 0 && workHeight.value > 0,
);

/** 0 while unmeasured — the mount keeps its CSS fallback in that frame. */
const effectiveScale = computed(() => {
  if (!measured.value) return 0;
  const raw = zoomMode.value === 'fit' ? fitScale.value : absoluteScale.value;
  return clampZoomScale(raw, minScale.value, maxScale.value);
});

const displayWidth = computed(() => workWidth.value * effectiveScale.value);
const displayHeight = computed(() => workHeight.value * effectiveScale.value);
const zoomPercent = computed(() => resolveZoomPercent(effectiveScale.value));
const hasOverflow = computed(
  () => displayWidth.value > containerWidth.value || displayHeight.value > containerHeight.value,
);
const isAtMin = computed(() => measured.value && effectiveScale.value <= minScale.value + PHYSICS_PAINT_ZOOM_EPSILON);
const isAtMax = computed(() => measured.value && effectiveScale.value >= maxScale.value - PHYSICS_PAINT_ZOOM_EPSILON);
const isFit = computed(() => zoomMode.value === 'fit');
const isActualSize = computed(
  () => zoomMode.value === 'absolute' && Math.abs(absoluteScale.value - 1) <= PHYSICS_PAINT_ZOOM_EPSILON,
);

// --- Store helpers -------------------------------------------------------

/** Compare-then-write: a repeated value writes nothing (reactivity rule 3). */
function setSignal<T>(target: Signal<T>, value: T): boolean {
  if (Object.is(target.peek(), value)) return false;
  target.value = value;
  return true;
}

function reClampPan(): void {
  const clamped = clampPanToBounds(
    panX.peek(),
    panY.peek(),
    displayWidth.peek(),
    displayHeight.peek(),
    containerWidth.peek(),
    containerHeight.peek(),
  );
  setSignal(panX, clamped.x);
  setSignal(panY, clamped.y);
}

/**
 * The shared anchored zoom write: every zoom input (wheel, pinch, preset
 * buttons) ends here, so one math path owns the mode/scale/pan triple.
 */
function applyAnchoredZoom(cursorX: number, cursorY: number, targetScale: number): void {
  if (!measured.peek() || !Number.isFinite(targetScale)) return;
  const scale = clampZoomScale(targetScale, minScale.peek(), maxScale.peek());
  // A target inside the epsilon of the current view changes nothing — keep the
  // current mode (a no-op wheel tick must not flip Fit off).
  if (Math.abs(scale - effectiveScale.peek()) <= PHYSICS_PAINT_ZOOM_EPSILON) return;
  const currentDisplay = resolveDisplaySize(workWidth.peek(), workHeight.peek(), effectiveScale.peek());
  const nextDisplay = resolveDisplaySize(workWidth.peek(), workHeight.peek(), scale);
  const anchored = resolveCursorAnchoredPan({
    containerWidth: containerWidth.peek(),
    containerHeight: containerHeight.peek(),
    displayWidth: currentDisplay.width,
    displayHeight: currentDisplay.height,
    panX: panX.peek(),
    panY: panY.peek(),
    nextDisplayWidth: nextDisplay.width,
    nextDisplayHeight: nextDisplay.height,
    cursorX,
    cursorY,
  });
  setSignal(zoomMode, 'absolute');
  setSignal(absoluteScale, scale);
  setSignal(panX, anchored.x);
  setSignal(panY, anchored.y);
}

function stepPreset(direction: 1 | -1): void {
  const current = effectiveScale.peek();
  if (current <= 0) return;
  const next = nextScalePreset(current, direction, minScale.peek(), maxScale.peek());
  applyAnchoredZoom(0, 0, next);
}

// --- Store ---------------------------------------------------------------

/**
 * Module-level store read by narrow leaves (the mount's sizing seam, the pan
 * layer, the pill). Every mutator clamps scale into [minScale, maxScale] and
 * pan into the half-overflow, and every write is compare-then-write.
 */
export const physicsPaintCanvasZoom = {
  containerWidth,
  containerHeight,
  workWidth,
  workHeight,
  mode: zoomMode,
  absoluteScale,
  panX,
  panY,
  fitScale,
  minScale,
  maxScale,
  effectiveScale,
  displayWidth,
  displayHeight,
  zoomPercent,
  hasOverflow,
  isAtMin,
  isAtMax,
  isFit,
  isActualSize,

  setContainerSize(width: number, height: number): void {
    const widthChanged = setSignal(containerWidth, finiteOrZero(width));
    const heightChanged = setSignal(containerHeight, finiteOrZero(height));
    if (widthChanged || heightChanged) reClampPan();
  },

  setWorkSize(width: number, height: number): void {
    const widthChanged = setSignal(workWidth, finiteOrZero(width));
    const heightChanged = setSignal(workHeight, finiteOrZero(height));
    if (!widthChanged && !heightChanged) return;
    setSignal(absoluteScale, clampZoomScale(absoluteScale.peek(), minScale.peek(), maxScale.peek()));
    reClampPan();
  },

  fitToWindow(): void {
    setSignal(zoomMode, 'fit');
    setSignal(panX, 0);
    setSignal(panY, 0);
  },

  /** 1:1 is always inside the range: the budget never excludes it. */
  actualSize(): void {
    setSignal(zoomMode, 'absolute');
    setSignal(absoluteScale, clampZoomScale(1, minScale.peek(), maxScale.peek()));
    reClampPan();
  },

  zoomIn(): void {
    stepPreset(1);
  },

  zoomOut(): void {
    stepPreset(-1);
  },

  setZoomAtCursor(scale: number, cursorX: number, cursorY: number): void {
    if (!Number.isFinite(scale) || scale <= 0) return;
    applyAnchoredZoom(Number.isFinite(cursorX) ? cursorX : 0, Number.isFinite(cursorY) ? cursorY : 0, scale);
  },

  setPan(x: number, y: number): void {
    const clamped = clampPanToBounds(
      x,
      y,
      displayWidth.peek(),
      displayHeight.peek(),
      containerWidth.peek(),
      containerHeight.peek(),
    );
    setSignal(panX, clamped.x);
    setSignal(panY, clamped.y);
  },

  /**
   * Studio open (and a view remount inside one document) always lands on the
   * fitted sheet. Container/work sizes are left for the next measurement so no
   * size flash is introduced before the observer reports.
   */
  resetForStudioOpen(): void {
    setSignal(zoomMode, 'fit');
    setSignal(absoluteScale, 1);
    setSignal(panX, 0);
    setSignal(panY, 0);
  },
};
