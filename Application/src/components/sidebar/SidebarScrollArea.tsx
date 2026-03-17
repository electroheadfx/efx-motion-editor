import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface SidebarScrollAreaProps {
  children: ComponentChildren;
  class?: string;
}

/**
 * Custom scroll area that hides the native scrollbar and renders a 4px gray thumb.
 * Works reliably in Tauri WKWebView (macOS) where ::-webkit-scrollbar is ignored.
 */
export function SidebarScrollArea({ children, class: className }: SidebarScrollAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const scrollable = scrollHeight > clientHeight + 1;
    setIsScrollable(scrollable);
    if (!scrollable) return;
    const ratio = clientHeight / scrollHeight;
    const th = Math.max(24, ratio * clientHeight);
    setThumbHeight(th);
    const scrollRange = scrollHeight - clientHeight;
    const thumbRange = clientHeight - th;
    setThumbTop(scrollRange > 0 ? (scrollTop / scrollRange) * thumbRange : 0);
  }, []);

  // Track content size changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    // Also observe the first child (content) if it exists
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [updateThumb]);

  return (
    <div
      class={`relative flex-1 min-h-0 ${className ?? ''}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        ref={scrollRef}
        class="h-full overflow-y-auto overflow-x-hidden"
        style={{ scrollbarWidth: 'none' }}
        onScroll={updateThumb}
      >
        {children}
      </div>
      {/* Custom 4px scroll thumb */}
      {isScrollable && (
        <div
          class="absolute right-0 top-0 pointer-events-none transition-opacity duration-150"
          style={{
            width: '4px',
            height: `${thumbHeight}px`,
            transform: `translateY(${thumbTop}px)`,
            backgroundColor: 'var(--sidebar-scrollbar-thumb)',
            borderRadius: '2px',
            opacity: isHovering ? 0.7 : 0,
          }}
        />
      )}
    </div>
  );
}
