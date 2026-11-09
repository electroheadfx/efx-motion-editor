import { Minus, Plus, SquareDimensions } from 'lucide-preact';
import { timelineZoom } from './physicsPaintTimelineZoom';

/**
 * Phase 60 (D-01..D-04): the header timeline zoom pill.
 *
 * The percent is DISPLAY-ONLY (D-02/D-03): it is a span with no click handler
 * and no button role. Minus and plus step the preset ladder one step per press
 * from the current value (never rounded into a preset first) and disable at the
 * 0.25 / 4 ends. Fit is a ONE-SHOT action (D-04) — it never re-fits on a later
 * resize, so it carries no aria-pressed and is never a mode.
 *
 * Narrow subscriber: it reads exactly three signals in its own body (percent,
 * isAtMin, isAtMax) and drives only store actions — no scale, no metrics, no
 * scroller access, so a wheel zoom re-renders only this pill and its leaf peers.
 * The bar sits in the always-visible static chrome (D-01), between playback and
 * the live status.
 */
export function PhysicsPaintTimelineZoomBar() {
  const percent = timelineZoom.percent.value;
  const isAtMin = timelineZoom.isAtMin.value;
  const isAtMax = timelineZoom.isAtMax.value;
  return (
    <div class="physics-paint-pill physics-paint-pill--timeline-zoom" role="group" aria-label="Timeline zoom">
      <button
        type="button"
        class="physics-paint-nav-button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={isAtMin}
        onClick={() => timelineZoom.zoomOut()}
      >
        <Minus size={14} aria-hidden="true" />
      </button>
      <span class="physics-paint-canvas-zoom-percent" aria-label="Zoom level">
        {percent}%
      </span>
      <button
        type="button"
        class="physics-paint-nav-button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={isAtMax}
        onClick={() => timelineZoom.zoomIn()}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        class="physics-paint-nav-button"
        aria-label="Show timeline at 100% zoom"
        title="Show timeline at 100% zoom"
        onClick={() => timelineZoom.resetTo100()}
      >
        <SquareDimensions size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
