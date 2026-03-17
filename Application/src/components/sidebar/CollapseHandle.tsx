import { useRef } from 'preact/hooks';
import { uiStore } from '../../stores/uiStore';
import { setSidebarWidth } from '../../lib/appConfig';

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;
/** If dragged below this width, collapse the sidebar */
const COLLAPSE_THRESHOLD = 180;
/** Minimum drag distance (px) to count as drag vs click */
const DRAG_THRESHOLD = 4;

/**
 * Combined resize + collapse handle on the right edge of the sidebar.
 * - Drag horizontally: resize the sidebar (240–480px)
 * - Drag below threshold: collapse
 * - Click (no drag): toggle collapse/expand
 */
export function CollapseHandle() {
  const didDrag = useRef(false);

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    didDrag.current = false;
    const isCollapsed = uiStore.sidebarCollapsed.peek();

    const onMove = (ev: PointerEvent) => {
      const totalDx = Math.abs(ev.clientX - startX);
      if (totalDx > DRAG_THRESHOLD) didDrag.current = true;

      if (isCollapsed) {
        // Dragging from collapsed state: expand if dragged far enough
        if (ev.clientX - startX > 40) {
          uiStore.sidebarCollapsed.value = false;
          uiStore.setSidebarWidth(MIN_WIDTH);
        }
        return;
      }

      // Resize: compute new width from absolute mouse position
      const sidebarLeft = target.closest('[data-sidebar]')?.getBoundingClientRect().left ?? 0;
      const newWidth = ev.clientX - sidebarLeft;

      if (newWidth < COLLAPSE_THRESHOLD) {
        // Below threshold: collapse
        uiStore.sidebarCollapsed.value = true;
        setSidebarWidth(uiStore.sidebarWidth.peek());
      } else {
        const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
        uiStore.setSidebarWidth(clamped);
      }
    };

    const onUp = () => {
      if (!didDrag.current) {
        // Click (no drag): toggle collapse
        uiStore.toggleSidebar();
      } else if (!uiStore.sidebarCollapsed.peek()) {
        // Persist final width after drag
        setSidebarWidth(uiStore.sidebarWidth.peek());
      }
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };

  return (
    <div
      class="absolute top-0 right-0 w-5 h-full flex items-center justify-end cursor-col-resize z-20 group"
      data-interactive
      onPointerDown={handlePointerDown}
      title={uiStore.sidebarCollapsed.value ? 'Drag or click to expand' : 'Drag to resize, click to collapse'}
    >
      {/* Double lines: 10% height, vertically centered */}
      <div class="flex gap-[4px] items-center" style={{ height: '10%' }}>
        <div
          class="h-full rounded-full transition-opacity duration-150 group-hover:opacity-100"
          style={{
            width: '1.5px',
            backgroundColor: 'var(--sidebar-collapse-line)',
            opacity: 0.6,
          }}
        />
        <div
          class="h-full rounded-full transition-opacity duration-150 group-hover:opacity-100"
          style={{
            width: '1.5px',
            backgroundColor: 'var(--sidebar-collapse-line)',
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
}
