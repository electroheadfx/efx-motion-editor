import { useRef, useCallback } from 'preact/hooks';
import { useComputed } from '@preact/signals';
import { timelineStore } from '../../stores/timelineStore';

const RULER_HEIGHT = 24;
const MIN_THUMB_HEIGHT = 24;

/**
 * TimelineScrollbar: 4px vertical scrollbar beside the timeline canvas.
 * Reads scrollY/totalContentHeight/viewportHeight from timelineStore.
 * Writes to timelineStore.setScrollY on drag/click.
 * Always visible (per user decision). Thumb color uses --sidebar-scrollbar-thumb.
 */
export function TimelineScrollbar() {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartScrollY = useRef(0);

  const totalH = timelineStore.totalContentHeight;
  const vpH = timelineStore.viewportHeight;
  const maxSY = timelineStore.maxScrollY;

  // Track area = container height minus ruler
  const trackAreaH = useComputed(() => Math.max(0, vpH.value - RULER_HEIGHT));

  // Thumb height: ratio of visible area to total content (below ruler)
  const thumbHeight = useComputed(() => {
    const contentBelowRuler = totalH.value - RULER_HEIGHT;
    if (contentBelowRuler <= 0) return trackAreaH.value;
    const ratio = trackAreaH.value / contentBelowRuler;
    return Math.max(MIN_THUMB_HEIGHT, Math.min(trackAreaH.value, ratio * trackAreaH.value));
  });

  // Thumb top position (offset from top of scrollbar, including ruler offset)
  const thumbTop = useComputed(() => {
    const max = maxSY.value;
    if (max <= 0) return RULER_HEIGHT;
    const scrollRatio = timelineStore.scrollY.value / max;
    const thumbRange = trackAreaH.value - thumbHeight.value;
    return RULER_HEIGHT + scrollRatio * thumbRange;
  });

  const scrollYFromClientY = useCallback((clientY: number) => {
    const track = trackRef.current;
    if (!track) return 0;
    const rect = track.getBoundingClientRect();
    const clickY = clientY - rect.top;
    const relY = clickY - RULER_HEIGHT;
    const tAreaH = rect.height - RULER_HEIGHT;
    if (tAreaH <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, relY / tAreaH));
    return ratio * maxSY.peek();
  }, []);

  const onPointerDown = useCallback((e: PointerEvent) => {
    // Check if click is on the thumb or the track
    const target = e.target as HTMLElement;
    if (target.dataset.thumb === 'true') {
      // Drag the thumb
      e.preventDefault();
      target.setPointerCapture(e.pointerId);
      dragging.current = true;
      dragStartY.current = e.clientY;
      dragStartScrollY.current = timelineStore.scrollY.peek();
    } else {
      // Click on track: jump to position
      e.preventDefault();
      const newScrollY = scrollYFromClientY(e.clientY);
      timelineStore.setScrollY(Math.min(maxSY.peek(), newScrollY));
    }
  }, [scrollYFromClientY]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const tAreaH = rect.height - RULER_HEIGHT;
    const thH = thumbHeight.peek();
    const thumbRange = tAreaH - thH;
    if (thumbRange <= 0) return;

    const deltaY = e.clientY - dragStartY.current;
    const scrollDelta = (deltaY / thumbRange) * maxSY.peek();
    const newScrollY = dragStartScrollY.current + scrollDelta;
    timelineStore.setScrollY(Math.max(0, Math.min(maxSY.peek(), newScrollY)));
  }, []);

  const onPointerUp = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <div
      ref={trackRef}
      class="shrink-0 relative cursor-pointer"
      style={{ width: '4px' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* Thumb */}
      <div
        data-thumb="true"
        class="absolute left-0 cursor-grab active:cursor-grabbing"
        style={{
          width: '4px',
          height: `${thumbHeight.value}px`,
          top: `${thumbTop.value}px`,
          backgroundColor: 'var(--sidebar-scrollbar-thumb)',
          borderRadius: '2px',
        }}
      />
    </div>
  );
}
