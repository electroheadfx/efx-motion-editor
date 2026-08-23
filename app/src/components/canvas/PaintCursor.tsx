import { paintStore } from '../../stores/paintStore';

interface PaintCursorProps {
  screenX: number;  // mouse position in screen/viewport pixels relative to overlay
  screenY: number;
  zoom: number;     // current canvas zoom level
  visible: boolean; // only show when painting tool active and cursor is over canvas
}

// Crosshair used when the brush is too small to render a legible ring.
// 11px arms each side + 1px center gap = 23px total span.
const CROSSHAIR_SIZE = 23;
const CROSSHAIR_CENTER = CROSSHAIR_SIZE / 2;
const GAP = 1;
const ARM = (CROSSHAIR_SIZE - GAP) / 2; // 11

// Black stroke sits under the white one so the white hairline is flanked by
// black on both sides — readable on light AND dark backgrounds. vector-effect
// non-scaling-stroke keeps line widths constant on screen at any zoom.
const UNDER = { stroke: '#111111', strokeWidth: 3 };
const OVER = { stroke: '#ffffff', strokeWidth: 1 };

const crosshairSegments = [
  { x1: 0, y1: CROSSHAIR_CENTER, x2: ARM, y2: CROSSHAIR_CENTER },
  { x1: ARM + GAP, y1: CROSSHAIR_CENTER, x2: CROSSHAIR_SIZE, y2: CROSSHAIR_CENTER },
  { x1: CROSSHAIR_CENTER, y1: 0, x2: CROSSHAIR_CENTER, y2: ARM },
  { x1: CROSSHAIR_CENTER, y1: ARM + GAP, x2: CROSSHAIR_CENTER, y2: CROSSHAIR_SIZE },
];

export function PaintCursor({ screenX, screenY, visible }: PaintCursorProps) {
  if (!visible) return null;

  const brushSize = paintStore.brushSize.value;
  const showCircle = brushSize >= 8;

  const size = showCircle ? brushSize : CROSSHAIR_SIZE;
  const left = screenX - size / 2;
  const top = screenY - size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'visible',
      }}
    >
      {showCircle ? (
        <g>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - UNDER.strokeWidth / 2}
            fill="none"
            stroke={UNDER.stroke}
            strokeWidth={UNDER.strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - UNDER.strokeWidth / 2}
            fill="none"
            stroke={OVER.stroke}
            strokeWidth={OVER.strokeWidth}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ) : (
        <g>
          {crosshairSegments.map((seg, i) => (
            <g key={i}>
              <line
                {...seg}
                stroke={UNDER.stroke}
                strokeWidth={UNDER.strokeWidth}
                vectorEffect="non-scaling-stroke"
              />
              <line
                {...seg}
                stroke={OVER.stroke}
                strokeWidth={OVER.strokeWidth}
                vectorEffect="non-scaling-stroke"
              />
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}
