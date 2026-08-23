import { paintStore } from '../../stores/paintStore';

interface PaintCursorProps {
  screenX: number;  // mouse position in screen/viewport pixels relative to overlay
  screenY: number;
  zoom: number;     // current canvas zoom level
  visible: boolean; // only show when painting tool active and cursor is over canvas
}

export function PaintCursor({ screenX, screenY, visible }: PaintCursorProps) {
  if (!visible) return null;

  const brushSize = paintStore.brushSize.value;
  // Position is in pre-transform space (parent has CSS scale(zoom)),
  // so use raw brushSize — the parent transform handles visual scaling.
  const displayDiameter = Math.max(brushSize, 4);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${screenX - displayDiameter / 2}px`,
        top: `${screenY - displayDiameter / 2}px`,
        width: `${displayDiameter}px`,
        height: `${displayDiameter}px`,
        border: '1.5px solid rgba(255, 255, 255, 0.95)',
        borderRadius: '50%',
        pointerEvents: 'none',
        boxShadow:
          '0 0 0 1.5px rgba(0, 0, 0, 0.85), inset 0 0 0 1px rgba(0, 0, 0, 0.85)',
        zIndex: 50,
      }}
    />
  );
}
