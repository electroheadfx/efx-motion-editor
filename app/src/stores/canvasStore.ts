import {signal, computed} from '@preact/signals';
import {projectStore} from './projectStore';

// --- Constants ---

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const ZOOM_PRESETS = [0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0];
const EPSILON = 0.001;

// --- Signals ---

const zoom = signal(1);
const panX = signal(0);
const panY = signal(0);
const containerWidth = signal(0);
const containerHeight = signal(0);
const fitLocked = signal(false);

// --- Computed ---

const zoomPercent = computed(() => Math.round(zoom.value * 100));
const isAtMinZoom = computed(() => zoom.value <= ZOOM_PRESETS[0] + EPSILON);
const isAtMaxZoom = computed(() => zoom.value >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1] - EPSILON);

/** The zoom level that makes the project exactly fit the container */
const fitZoom = computed(() => {
  const cW = containerWidth.value;
  const cH = containerHeight.value;
  const pW = projectStore.width.value;
  const pH = projectStore.height.value;
  if (cW <= 0 || cH <= 0 || pW <= 0 || pH <= 0) return 1;
  return Math.min(cW / pW, cH / pH);
});

// --- Helpers ---

/** A pan coordinate: exact when finite, zero otherwise; -0 normalizes to +0. */
function sanitizePan(value: number): number {
  return Number.isFinite(value) ? (value === 0 ? 0 : value) : 0;
}

// --- Store ---

export const canvasStore = {
  zoom,
  panX,
  panY,
  containerWidth,
  containerHeight,
  fitLocked,
  zoomPercent,
  isAtMinZoom,
  isAtMaxZoom,
  fitZoom,

  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_PRESETS,

  /** Snap to next preset above current zoom (center-anchored) */
  zoomIn() {
    fitLocked.value = false;
    const current = zoom.value;
    let next: number | null = null;
    for (const preset of ZOOM_PRESETS) {
      if (preset > current + EPSILON) {
        next = preset;
        break;
      }
    }
    if (next === null) return; // Already at max
    zoom.value = next;
  },

  /** Snap to next preset below current zoom (center-anchored) */
  zoomOut() {
    fitLocked.value = false;
    const current = zoom.value;
    let next: number | null = null;
    for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
      if (ZOOM_PRESETS[i] < current - EPSILON) {
        next = ZOOM_PRESETS[i];
        break;
      }
    }
    if (next === null) return; // Already at min
    zoom.value = next;
  },

  /** Smooth zoom for wheel/pinch — center-anchored, no cursor tracking */
  setSmoothZoom(newZoom: number, _cursorX?: number, _cursorY?: number) {
    fitLocked.value = false;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    if (Math.abs(clamped - zoom.peek()) < EPSILON) return;
    zoom.value = clamped;
  },

  /**
   * Free pan: unbounded on both axes, so the canvas may be pushed entirely
   * off-screen. Fit (the Fit button, the F key and the `menu:fit-to-window`
   * event) is the recovery. A non-finite value sanitizes to zero, and each
   * axis is compare-then-write.
   */
  setPan(x: number, y: number) {
    fitLocked.value = false;
    const nextX = sanitizePan(x);
    const nextY = sanitizePan(y);
    if (!Object.is(panX.peek(), nextX)) panX.value = nextX;
    if (!Object.is(panY.peek(), nextY)) panY.value = nextY;
  },

  /** Calculate and apply fit-to-window zoom, reset pan to centered */
  fitToWindow() {
    const containerW = containerWidth.peek();
    const containerH = containerHeight.peek();
    if (containerW <= 0 || containerH <= 0) return;

    const projW = projectStore.width.peek();
    const projH = projectStore.height.peek();
    if (projW <= 0 || projH <= 0) return;

    // Scale that fits the full project resolution inside the container
    const fitScale = Math.min(containerW / projW, containerH / projH);
    // Clamp to valid zoom range (allow above 1.0 -- no artificial cap)
    zoom.value = Math.max(MIN_ZOOM, Math.min(fitScale, MAX_ZOOM));
    panX.value = 0;
    panY.value = 0;
    fitLocked.value = true;
  },

  /** Toggle fit lock: when turning ON, also snap to fit immediately */
  toggleFitLock() {
    if (fitLocked.value) {
      fitLocked.value = false;
    } else {
      this.fitToWindow();
      // fitToWindow already sets fitLocked = true
    }
  },

  /** Update container dimensions (called by ResizeObserver in CanvasArea) */
  updateContainerSize(w: number, h: number) {
    containerWidth.value = w;
    containerHeight.value = h;
  },

  /** Reset all signals to defaults */
  reset() {
    zoom.value = 1;
    panX.value = 0;
    panY.value = 0;
  },
};
