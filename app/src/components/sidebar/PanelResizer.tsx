import { GripHorizontal } from 'lucide-preact';

interface PanelResizerProps {
  onResize: (deltaY: number) => void;
  onResizeEnd: () => void;
}

export function PanelResizer({ onResize, onResizeEnd }: PanelResizerProps) {
  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    let lastY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      const delta = ev.clientY - lastY;
      lastY = ev.clientY;
      onResize(delta);
    };

    const onUp = () => {
      onResizeEnd();
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  };

  return (
    <div
      data-interactive
      class="h-4 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 select-none group"
      style={{ color: 'var(--sidebar-collapse-line)' }}
      onPointerDown={handlePointerDown}
    >
      <GripHorizontal size={14} class="opacity-70 transition-opacity duration-150 group-hover:opacity-100" />
    </div>
  );
}
