import { paintStore } from '../../stores/paintStore';

interface PaintCursorProps {
  screenX: number;  // mouse position in screen/viewport pixels relative to overlay
  screenY: number;
  zoom: number;     // current canvas zoom level
  visible: boolean; // only show when painting tool active and cursor is over canvas
}

export function PaintCursor({ screenX, screenY, zoom, visible }: PaintCursorProps) {
  if (!visible) return null;

  const brushSize = paintStore.brushSize.value;
  const diameter = brushSize * zoom;

  // Minimum 4px so cursor is always visible even at tiny brush sizes
  const displayDiameter = Math.max(diameter, 4);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${screenX - displayDiameter / 2}px`,
        top: `${screenY - displayDiameter / 2}px`,
        width: `${displayDiameter}px`,
        height: `${displayDiameter}px`,
        border: '1.5px solid white',
        borderRadius: '50%',
        pointerEvents: 'none',
        boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(0, 0, 0, 0.3)',
        zIndex: 50,
        mixBlendMode: 'difference',
      }}
    />
  );
}
