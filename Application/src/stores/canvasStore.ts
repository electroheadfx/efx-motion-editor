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

// --- Computed ---

const zoomPercent = computed(() => Math.round(zoom.value * 100));
const isAtMinZoom = computed(() => zoom.value <= ZOOM_PRESETS[0] + EPSILON);
const isAtMaxZoom = computed(() => zoom.value >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1] - EPSILON);

// --- Store ---

export const canvasStore = {
  zoom,
  panX,
  panY,
  containerWidth,
  containerHeight,
  zoomPercent,
  isAtMinZoom,
  isAtMaxZoom,

  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_PRESETS,

  /** Snap to next preset above current zoom (center-anchored) */
  zoomIn() {
    const current = zoom.value;
    let next: number | null = null;
    for (const preset of ZOOM_PRESETS) {
      if (preset > current + EPSILON) {
        next = preset;
        break;
      }
    }
    if (next === null) return; // Already at max

    const scale = next / current;
    panX.value = panX.value * scale;
    panY.value = panY.value * scale;
    zoom.value = next;
  },

  /** Snap to next preset below current zoom (center-anchored) */
  zoomOut() {
    const current = zoom.value;
    let next: number | null = null;
    for (let i = ZOOM_PRESETS.length - 1; i >= 0; i--) {
      if (ZOOM_PRESETS[i] < current - EPSILON) {
        next = ZOOM_PRESETS[i];
        break;
      }
    }
    if (next === null) return; // Already at min

    const scale = next / current;
    panX.value = panX.value * scale;
    panY.value = panY.value * scale;
    zoom.value = next;
  },

  /** Smooth zoom for wheel/pinch (cursor-anchored, no snapping) */
  setSmoothZoom(newZoom: number, cursorX: number, cursorY: number) {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    const oldZoom = zoom.peek();
    const scale = clamped / oldZoom;

    panX.value = panX.value * scale + cursorX * (1 - scale) / clamped;
    panY.value = panY.value * scale + cursorY * (1 - scale) / clamped;
    zoom.value = clamped;
  },

  /** Direct pan setter */
  setPan(x: number, y: number) {
    panX.value = x;
    panY.value = y;
  },

  /** Calculate and apply fit-to-window zoom, reset pan to centered */
  fitToWindow() {
    const containerW = containerWidth.peek();
    const containerH = containerHeight.peek();
    if (containerW <= 0 || containerH <= 0) return;

    const aspectRatio = projectStore.width.peek() / projectStore.height.peek();
    const natW = Math.min(containerW, 830);
    const natH = natW / aspectRatio;

    let fitScale: number;
    if (natH > containerH) {
      // Height-constrained: recalculate from height
      const adjustedH = containerH;
      const adjustedW = adjustedH * aspectRatio;
      fitScale = Math.min(containerW / adjustedW, containerH / adjustedH, MAX_ZOOM);
    } else {
      fitScale = Math.min(containerW / natW, containerH / natH, MAX_ZOOM);
    }

    zoom.value = Math.max(MIN_ZOOM, Math.min(fitScale, 1.0));
    panX.value = 0;
    panY.value = 0;
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
