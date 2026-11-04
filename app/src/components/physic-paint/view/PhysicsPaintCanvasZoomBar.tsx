import { Minus, Plus } from 'lucide-preact';
import { physicsPaintCanvasZoom } from './physicsPaintCanvasZoom';

/**
 * 261104-uyv: the floating canvas zoom pill.
 *
 * Narrow subscriber: it reads only the display values and drives only store
 * actions. No keyboard binding and no shortcut hint — wheel, trackpad pinch
 * and middle-drag are the only new inputs (bare keys stay untouched).
 */
export function PhysicsPaintCanvasZoomBar() {
  const zoomPercent = physicsPaintCanvasZoom.zoomPercent.value;
  const isAtMin = physicsPaintCanvasZoom.isAtMin.value;
  const isAtMax = physicsPaintCanvasZoom.isAtMax.value;
  const isFit = physicsPaintCanvasZoom.isFit.value;
  const isActualSize = physicsPaintCanvasZoom.isActualSize.value;

  return (
    <div class="physics-paint-canvas-zoom-bar" role="group" aria-label="Canvas zoom">
      <button
        type="button"
        class="physics-paint-canvas-zoom-button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={isAtMin}
        onClick={() => physicsPaintCanvasZoom.zoomOut()}
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <span class="physics-paint-canvas-zoom-percent" aria-label="Zoom level">
        {zoomPercent}%
      </span>
      <button
        type="button"
        class="physics-paint-canvas-zoom-button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={isAtMax}
        onClick={() => physicsPaintCanvasZoom.zoomIn()}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        class="physics-paint-canvas-zoom-text-button"
        title="Fit the whole sheet in the window"
        aria-pressed={isFit}
        onClick={() => physicsPaintCanvasZoom.fitToWindow()}
      >
        Fit
      </button>
      <button
        type="button"
        class="physics-paint-canvas-zoom-text-button"
        title="Actual size — one working pixel per screen pixel"
        aria-pressed={isActualSize}
        onClick={() => physicsPaintCanvasZoom.actualSize()}
      >
        1:1
      </button>
    </div>
  );
}
