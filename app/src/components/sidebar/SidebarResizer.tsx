import { uiStore } from '../../stores/uiStore';
import { setSidebarWidth } from '../../lib/appConfig';

const MIN_WIDTH = 240;
const MAX_WIDTH = 480;

export function SidebarResizer() {
  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    let lastX = e.clientX;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientX - lastX;
      lastX = ev.clientX;
      const current = uiStore.sidebarWidth.peek();
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, current + delta));
      uiStore.setSidebarWidth(next);
    };

    const onUp = () => {
      setSidebarWidth(uiStore.sidebarWidth.peek());
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };

  return (
    <div
      class="absolute top-0 right-0 w-2 h-full cursor-col-resize z-10"
      onPointerDown={handlePointerDown}
    />
  );
}
