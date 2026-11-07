import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { effect } from '@preact/signals';
import { physicsPaintCanvasZoom } from './physicsPaintCanvasZoom';
import { disarmHandTool, isHandToolArmed, isHandToolArmedPeek } from './physicsPaintHandTool';

/**
 * 261104-uyv: the Studio canvas zoom viewport.
 *
 * The viewport is the ONE clip in the canvas region — the region itself must
 * stay unclipped so its floating dialogs and the apply pill keep anchoring
 * past the region edges (the 52.1 lesson). The pan layer is a translate-only
 * ancestor of the whole stack, so every client-rect-derived mapping
 * (canvasBounds, pointer ratios, the picker, the brush ring) stays exact: the
 * shell grows by real CSS size, never by a scale transform.
 */

/** Safari/WKWebView pinch gesture events are not part of the DOM lib. */
interface GestureEventLike extends UIEvent {
  scale: number;
  clientX?: number;
  clientY?: number;
}

type PendingInteraction =
  | { kind: 'zoom'; scale: number; cursorX: number; cursorY: number }
  | { kind: 'pan'; x: number; y: number };

export function PhysicsPaintCanvasZoomViewport({ children }: { children: ComponentChildren }) {
  const viewportRef = useRef<HTMLDivElement>(null);

  // The Studio window is a fresh document per open, so this is a defensive
  // no-op there; it also covers a view remount inside one document.
  // 261105-cgl: a Hand armed in the previous document/mount never survives.
  useEffect(() => {
    physicsPaintCanvasZoom.resetForStudioOpen();
    disarmHandTool();
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    // One-frame coalescer: every wheel/gesture event only updates `pending`
    // and schedules ONE frame; the flush applies one store write and clears
    // its state. Termination: `flush` clears `pending` + `rafId`; cleanup
    // cancels the queued frame and drops the pending job.
    let rafId = 0;
    let pending: PendingInteraction | null = null;
    let gestureBaseScale = 0;

    const flush = () => {
      rafId = 0;
      const job = pending;
      pending = null;
      if (!job) return;
      if (job.kind === 'zoom') physicsPaintCanvasZoom.setZoomAtCursor(job.scale, job.cursorX, job.cursorY);
      else physicsPaintCanvasZoom.setPan(job.x, job.y);
    };

    const schedule = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(flush);
    };

    // Zoom targets accumulate multiplicatively from the previously QUEUED
    // target, so a burst of wheel events inside one frame never loses steps.
    const queueZoom = (scale: number, cursorX: number, cursorY: number) => {
      pending = { kind: 'zoom', scale, cursorX, cursorY };
      schedule();
    };

    const queuePan = (dx: number, dy: number) => {
      const base =
        pending?.kind === 'pan'
          ? { x: pending.x, y: pending.y }
          : { x: physicsPaintCanvasZoom.panX.peek(), y: physicsPaintCanvasZoom.panY.peek() };
      pending = { kind: 'pan', x: base.x + dx, y: base.y + dy };
      schedule();
    };

    const cursorFromClient = (clientX: number, clientY: number) => {
      const rect = viewport.getBoundingClientRect();
      return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
    };

    const onWheel = (event: WheelEvent) => {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        const cursor = cursorFromClient(event.clientX, event.clientY);
        const base = pending?.kind === 'zoom' ? pending.scale : physicsPaintCanvasZoom.effectiveScale.peek();
        const factor = Math.min(2, Math.max(0.5, Math.exp(-event.deltaY * 0.0025)));
        const min = physicsPaintCanvasZoom.minScale.peek();
        const max = physicsPaintCanvasZoom.maxScale.peek();
        queueZoom(Math.min(max, Math.max(min, base * factor)), cursor.x, cursor.y);
        return;
      }
      // Plain wheel pans ONLY while the sheet overflows; in fit it is left to
      // the platform (no preventDefault, no capture of the gesture).
      if (!physicsPaintCanvasZoom.hasOverflow.peek()) return;
      event.preventDefault();
      queuePan(-event.deltaX, -event.deltaY);
    };

    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureBaseScale = physicsPaintCanvasZoom.effectiveScale.peek();
    };

    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as GestureEventLike;
      const rect = viewport.getBoundingClientRect();
      const clientX = gesture.clientX ?? rect.left + rect.width / 2;
      const clientY = gesture.clientY ?? rect.top + rect.height / 2;
      const cursor = cursorFromClient(clientX, clientY);
      queueZoom(gestureBaseScale * gesture.scale, cursor.x, cursor.y);
    };

    let drag: {
      pointerId: number;
      startX: number;
      startY: number;
      startPanX: number;
      startPanY: number;
      hand: boolean;
    } | null = null;

    // CAPTURE phase: both pan gestures are consumed before the stack's
    // picker/block gates and the engine's own listeners, so neither can start
    // a stroke or a pick. Button 1 is always a pan; button 0 is one only while
    // the latched Hand is armed. The hand route proceeds at Fit too — setPan
    // simply clamps the pan to zero, so the control is never disabled (D-03).
    const onPointerDown = (event: PointerEvent) => {
      const handPan = event.button === 0 && isHandToolArmedPeek();
      if (event.button !== 1 && !handPan) return;
      event.preventDefault();
      event.stopPropagation();
      if (!handPan && !physicsPaintCanvasZoom.hasOverflow.peek()) return;
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPanX: physicsPaintCanvasZoom.panX.peek(),
        startPanY: physicsPaintCanvasZoom.panY.peek(),
        hand: handPan,
      };
      try {
        viewport.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort (the pointer may already be gone).
      }
      viewport.style.cursor = 'grabbing';
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      physicsPaintCanvasZoom.setPan(
        drag.startPanX + (event.clientX - drag.startX),
        drag.startPanY + (event.clientY - drag.startY),
      );
    };

    const finishDrag = (pointerId: number) => {
      if (!drag || drag.pointerId !== pointerId) return;
      drag = null;
      try {
        viewport.releasePointerCapture(pointerId);
      } catch {
        // Already released by the platform.
      }
      // A release while still armed returns to grab; disarm clears it.
      viewport.style.cursor = isHandToolArmedPeek() ? 'grab' : '';
    };

    const endDrag = (event: PointerEvent) => finishDrag(event.pointerId);

    // ONE narrow signals effect for the cursor law: it subscribes to the armed
    // signal only and writes DOM style only — no signal write and no
    // render-body write, so it cannot loop. A disarm is a hard exit: a live
    // hand drag is finished (pointer capture released) before the cursor
    // clears, so no grabbing cursor or captured pointer survives the mode.
    const disposeHandMode = effect(() => {
      const armed = isHandToolArmed();
      if (!armed && drag !== null) finishDrag(drag.pointerId);
      viewport.style.cursor = armed ? 'grab' : '';
    });

    const onAuxClick = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault();
    };

    viewport.addEventListener('wheel', onWheel, { passive: false });
    viewport.addEventListener('gesturestart', onGestureStart, { passive: false });
    viewport.addEventListener('gesturechange', onGestureChange, { passive: false });
    viewport.addEventListener('pointerdown', onPointerDown, true);
    viewport.addEventListener('pointermove', onPointerMove);
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);
    viewport.addEventListener('auxclick', onAuxClick);

    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      rafId = 0;
      pending = null;
      disposeHandMode();
      viewport.style.cursor = '';
      // Options matter only for `capture` on removal; passive defaults alike.
      viewport.removeEventListener('wheel', onWheel);
      viewport.removeEventListener('gesturestart', onGestureStart);
      viewport.removeEventListener('gesturechange', onGestureChange);
      viewport.removeEventListener('pointerdown', onPointerDown, true);
      viewport.removeEventListener('pointermove', onPointerMove);
      viewport.removeEventListener('pointerup', endDrag);
      viewport.removeEventListener('pointercancel', endDrag);
      viewport.removeEventListener('auxclick', onAuxClick);
    };
  }, []);

  return (
    <div class="physics-paint-canvas-zoom-viewport" ref={viewportRef}>
      <PhysicsPaintCanvasZoomPanLayer>{children}</PhysicsPaintCanvasZoomPanLayer>
    </div>
  );
}

/**
 * The narrow pan leaf: it reads ONLY panX/panY. The `children` vnode is the
 * stable MemoizedPhysicsPaintCanvasStack vnode created by the view, so a pan
 * re-renders this two-div leaf and never the memoized stack. The transform is
 * emitted only when non-zero, keeping the default DOM (and its stacking)
 * exactly as before — a transform creates a stacking context.
 */
export function PhysicsPaintCanvasZoomPanLayer({ children }: { children: ComponentChildren }) {
  const x = physicsPaintCanvasZoom.panX.value;
  const y = physicsPaintCanvasZoom.panY.value;
  return (
    <div class="physics-paint-canvas-zoom-pan" style={x || y ? { transform: `translate(${x}px, ${y}px)` } : undefined}>
      {children}
    </div>
  );
}
