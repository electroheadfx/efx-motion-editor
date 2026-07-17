import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface SidebarScrollAreaProps {
  children: ComponentChildren;
  class?: string;
  interactive?: boolean;
}

interface ScrollThumbGeometry {
  top: number;
  height: number;
  scrollable: boolean;
}

const MIN_THUMB_HEIGHT = 24;

/**
 * Custom vertical scroll area for Tauri WKWebView. It preserves native wheel and
 * trackpad scrolling while replacing the native scrollbar with an EFX thumb.
 */
export function SidebarScrollArea({ children, class: className, interactive = false }: SidebarScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const [thumb, setThumb] = useState<ScrollThumbGeometry>({ top: 0, height: 0, scrollable: false });
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const scrollable = scrollHeight > clientHeight + 1;
    if (!scrollable) {
      setThumb({ top: 0, height: 0, scrollable: false });
      return;
    }
    const height = Math.min(clientHeight, Math.max(MIN_THUMB_HEIGHT, (clientHeight / scrollHeight) * clientHeight));
    const scrollRange = scrollHeight - clientHeight;
    const thumbRange = clientHeight - height;
    setThumb({
      top: scrollRange > 0 ? (scrollTop / scrollRange) * thumbRange : 0,
      height,
      scrollable: true,
    });
  }, []);

  const scrollToTrackPosition = useCallback((clientY: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const thumbRange = el.clientHeight - thumb.height;
    const scrollRange = el.scrollHeight - el.clientHeight;
    if (thumbRange <= 0 || scrollRange <= 0) return;
    const nextThumbTop = Math.max(0, Math.min(thumbRange, clientY - rect.top - thumb.height / 2));
    el.scrollTop = (nextThumbTop / thumbRange) * scrollRange;
  }, [thumb.height]);

  const handleThumbPointerDown = useCallback((event: PointerEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    event.preventDefault();
    event.stopPropagation();
    dragCleanupRef.current?.();
    const target = event.currentTarget as HTMLElement;
    const pointerId = event.pointerId;
    const startY = event.clientY;
    const startScrollTop = el.scrollTop;
    target.setPointerCapture(pointerId);
    setIsDragging(true);

    const handleMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      const thumbRange = el.clientHeight - thumb.height;
      const scrollRange = el.scrollHeight - el.clientHeight;
      if (thumbRange <= 0 || scrollRange <= 0) return;
      el.scrollTop = startScrollTop + ((moveEvent.clientY - startY) / thumbRange) * scrollRange;
    };
    const cleanup = () => {
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleEnd);
      target.removeEventListener('pointercancel', handleEnd);
      target.removeEventListener('lostpointercapture', cleanup);
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
      dragCleanupRef.current = null;
      setIsDragging(false);
    };
    const handleEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId === pointerId) cleanup();
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleEnd);
    target.addEventListener('pointercancel', handleEnd);
    target.addEventListener('lostpointercapture', cleanup);
    dragCleanupRef.current = cleanup;
  }, [thumb.height]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(updateThumb);
    const mutationObserver = new MutationObserver(() => {
      resizeObserver.disconnect();
      resizeObserver.observe(el);
      if (el.firstElementChild) resizeObserver.observe(el.firstElementChild);
      updateThumb();
    });
    resizeObserver.observe(el);
    if (el.firstElementChild) resizeObserver.observe(el.firstElementChild);
    mutationObserver.observe(el, { childList: true, subtree: true });
    updateThumb();
    return () => {
      dragCleanupRef.current?.();
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [updateThumb]);

  return (
    <div
      class={`relative flex-1 min-h-0 ${className ?? ''}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        ref={scrollRef}
        class="absolute inset-0 overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: 'none' }}
        onScroll={updateThumb}
      >
        {children}
      </div>
      {thumb.scrollable && (
        <div
          class="absolute right-0 top-0 bottom-0"
          style={{
            width: '10px',
            opacity: isHovering || isDragging ? 1 : 0,
            transition: 'opacity 150ms',
            pointerEvents: interactive ? 'auto' : 'none',
            touchAction: interactive ? 'none' : undefined,
          }}
          onPointerDown={interactive ? (event) => scrollToTrackPosition(event.clientY) : undefined}
        >
          <div
            class="absolute right-0 top-0"
            style={{
              width: '4px',
              height: `${thumb.height}px`,
              transform: `translateY(${thumb.top}px)`,
              backgroundColor: 'var(--sidebar-scrollbar-thumb)',
              borderRadius: '2px',
              opacity: 0.7,
              cursor: interactive ? 'grab' : undefined,
              touchAction: interactive ? 'none' : undefined,
            }}
            onPointerDown={interactive ? (event) => handleThumbPointerDown(event as unknown as PointerEvent) : undefined}
          />
        </div>
      )}
    </div>
  );
}
