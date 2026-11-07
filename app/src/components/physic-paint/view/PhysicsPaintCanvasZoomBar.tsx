import { Hand, Minus, Plus } from 'lucide-preact';
import { physicsPaintCanvasZoom } from './physicsPaintCanvasZoom';
import { isHandToolArmed, toggleHandTool } from './physicsPaintHandTool';

/**
 * 261104-uyv: the floating canvas zoom pill.
 *
 * 261107-sg3: the pill is the numeric zoom controls (out / level / in / Fit /
 * 1:1) plus the LATCHED Hand canvas tool. One click on the Hand icon arms pan
 * mode; a primary-button drag on the canvas pans through the zoom store (the
 * same path middle-drag uses) and stays armed on release; a second click on
 * the same icon disarms. The Hand is never disabled — at Fit the pan clamps to
 * zero.
 *
 * Narrow subscriber: it reads only the display values plus the armed flag and
 * drives only store actions. No keyboard binding and no shortcut hint — wheel,
 * trackpad pinch and middle-drag stay the baseline inputs.
 */
export function PhysicsPaintCanvasZoomBar() {
  const zoomPercent = physicsPaintCanvasZoom.zoomPercent.value;
  const isAtMin = physicsPaintCanvasZoom.isAtMin.value;
  const isAtMax = physicsPaintCanvasZoom.isAtMax.value;
  const isFit = physicsPaintCanvasZoom.isFit.value;
  const isActualSize = physicsPaintCanvasZoom.isActualSize.value;
  const handArmed = isHandToolArmed();

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
      {/* 261107-sg3: the LATCHED Hand canvas tool. Only this icon toggles it —
          no paint-tool, Select, picker or motion-mode coupling. Lives before
          Fit so the numeric zoom controls stay grouped. */}
      <button
        type="button"
        class="physics-paint-canvas-zoom-button"
        data-testid="aquarelle-hand-toggle"
        aria-label="Hand"
        aria-pressed={handArmed}
        title={handArmed
          ? 'Hand — click again to leave pan mode'
          : 'Hand — click to arm pan, then drag the canvas'}
        onClick={() => toggleHandTool()}
      >
        <Hand size={14} aria-hidden="true" />
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
