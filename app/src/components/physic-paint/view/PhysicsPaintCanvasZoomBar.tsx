import { useEffect, useRef } from 'preact/hooks';
import { Hand, Minus, Plus } from 'lucide-preact';
import { physicsPaintCanvasZoom } from './physicsPaintCanvasZoom';
import { disarmHandTool, isHandToolArmed, setHandToolArmed } from './physicsPaintHandTool';

/**
 * 261104-uyv: the floating canvas zoom pill.
 *
 * 261107-sg3 UAT: the pill is the numeric zoom controls (out / level / in /
 * Fit / 1:1) plus the PRESS-AND-HOLD Hand canvas tool. Pressing the Hand
 * button captures the pointer and arms pan mode; moving the pointer (mouse or
 * pen) pans the sheet through the zoom store — the same path middle-drag uses
 * — for as long as the press lasts; releasing stops the pan and disarms.
 * Nothing latches, so there is no lingering pan mode to leave. The Hand is
 * never disabled: the pan is free at every zoom, so the sheet can be pushed
 * out of the viewport, and Fit is the recovery.
 *
 * Narrow subscriber: it reads only the display values plus the armed flag and
 * drives only store actions. No keyboard binding and no shortcut hint — wheel,
 * trackpad pinch and middle-drag stay the baseline inputs.
 */

interface HandPanSession {
  readonly pointerId: number;
  readonly target: HTMLButtonElement;
  readonly startX: number;
  readonly startY: number;
  readonly startPanX: number;
  readonly startPanY: number;
  readonly onMove: (event: PointerEvent) => void;
  readonly onEnd: (event: PointerEvent) => void;
}

export function PhysicsPaintCanvasZoomBar() {
  const zoomPercent = physicsPaintCanvasZoom.zoomPercent.value;
  const isAtMin = physicsPaintCanvasZoom.isAtMin.value;
  const isAtMax = physicsPaintCanvasZoom.isAtMax.value;
  const isFit = physicsPaintCanvasZoom.isFit.value;
  const isActualSize = physicsPaintCanvasZoom.isActualSize.value;
  const handArmed = isHandToolArmed();
  const handSessionRef = useRef<HandPanSession | null>(null);

  const endHandSession = (pointerId?: number) => {
    const session = handSessionRef.current;
    if (!session) return;
    if (pointerId !== undefined && session.pointerId !== pointerId) return;
    handSessionRef.current = null;
    session.target.removeEventListener('pointermove', session.onMove);
    session.target.removeEventListener('pointerup', session.onEnd);
    session.target.removeEventListener('pointercancel', session.onEnd);
    session.target.removeEventListener('lostpointercapture', session.onEnd);
    try {
      if (session.target.hasPointerCapture(session.pointerId)) {
        session.target.releasePointerCapture(session.pointerId);
      }
    } catch {
      // Capture may already be gone with the pointer.
    }
    session.target.style.cursor = '';
    disarmHandTool();
  };

  // A Studio window closing mid-press must never leave the pan flag armed.
  useEffect(() => () => {
    const session = handSessionRef.current;
    if (session) endHandSession(session.pointerId);
  }, []);

  const beginHandSession = (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLButtonElement;
    const pointerId = event.pointerId;
    const session: HandPanSession = {
      pointerId,
      target,
      startX: event.clientX,
      startY: event.clientY,
      startPanX: physicsPaintCanvasZoom.panX.peek(),
      startPanY: physicsPaintCanvasZoom.panY.peek(),
      onMove: (moveEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        moveEvent.preventDefault();
        physicsPaintCanvasZoom.setPan(
          session.startPanX + (moveEvent.clientX - session.startX),
          session.startPanY + (moveEvent.clientY - session.startY),
        );
      },
      onEnd: (endEvent) => {
        if (endEvent.pointerId !== pointerId) return;
        endEvent.preventDefault();
        endHandSession(pointerId);
      },
    };
    handSessionRef.current = session;
    setHandToolArmed(true);
    target.style.cursor = 'grabbing';
    target.addEventListener('pointermove', session.onMove, { passive: false });
    target.addEventListener('pointerup', session.onEnd);
    target.addEventListener('pointercancel', session.onEnd);
    target.addEventListener('lostpointercapture', session.onEnd);
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // Capture is best-effort; without it the press simply ends early.
    }
  };

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
      {/* 261107-sg3: the press-and-hold Hand canvas tool. Only this button
          arms it — no paint-tool, Select, picker or motion-mode coupling.
          Pointer capture keeps the pan following the mouse or pen after it
          leaves the button, and releasing it disarms. Lives before Fit so the
          numeric zoom controls stay grouped. */}
      <button
        type="button"
        class="physics-paint-canvas-zoom-button"
        data-testid="aquarelle-hand-toggle"
        aria-label="Hand"
        aria-pressed={handArmed}
        title="Hand — press and hold, then move to pan; releasing stops"
        onPointerDown={beginHandSession}
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
