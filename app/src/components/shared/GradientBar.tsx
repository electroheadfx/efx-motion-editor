import {useRef, useCallback} from 'preact/hooks';
import type {GradientStop} from '../../types/sequence';

interface GradientBarProps {
  stops: GradientStop[];
  gradientType: 'linear' | 'radial' | 'conic';
  angle?: number;
  centerX?: number;
  centerY?: number;
  onStopsChange: (stops: GradientStop[]) => void;
  onStopSelect: (index: number) => void;
  selectedStopIndex: number;
}

/** Build a CSS gradient string from stops and gradient config */
export function buildGradientCSS(
  stops: GradientStop[],
  type: string,
  angle?: number,
  cx?: number,
  cy?: number,
): string {
  const colorStops = stops
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((s) => `${s.color} ${(s.position * 100).toFixed(1)}%`)
    .join(', ');
  if (type === 'linear') return `linear-gradient(${angle ?? 180}deg, ${colorStops})`;
  if (type === 'radial')
    return `radial-gradient(circle at ${(cx ?? 0.5) * 100}% ${(cy ?? 0.5) * 100}%, ${colorStops})`;
  return `conic-gradient(from ${angle ?? 0}deg at ${(cx ?? 0.5) * 100}% ${(cy ?? 0.5) * 100}%, ${colorStops})`;
}

/** Interpolate a hex color at a given position along sorted stops */
function sampleGradientColor(stops: GradientStop[], position: number): string {
  const sorted = stops.slice().sort((a, b) => a.position - b.position);
  if (position <= sorted[0].position) return sorted[0].color;
  if (position >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (position >= a.position && position <= b.position) {
      const t = (position - a.position) / (b.position - a.position);
      return lerpColor(a.color, b.color, t);
    }
  }
  return sorted[0].color;
}

function lerpColor(hex1: string, hex2: string, t: number): string {
  const parse = (h: string) => {
    const m = h.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return [0, 0, 0];
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  };
  const [r1, g1, b1] = parse(hex1);
  const [r2, g2, b2] = parse(hex2);
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(b1 + (b2 - b1) * t)}`;
}

export function GradientBar({
  stops,
  gradientType,
  angle,
  centerX,
  centerY,
  onStopsChange,
  onStopSelect,
  selectedStopIndex,
}: GradientBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const draggingIndex = useRef<number | null>(null);

  const gradientCSS = buildGradientCSS(stops, gradientType, angle, centerX, centerY);

  const getPositionFromEvent = useCallback(
    (e: PointerEvent): number => {
      if (!barRef.current) return 0;
      const rect = barRef.current.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    },
    [],
  );

  const handleBarPointerDown = useCallback(
    (e: PointerEvent) => {
      // Only add stop if clicking empty space on the bar (not on a handle)
      if ((e.target as HTMLElement).dataset.stopHandle) return;
      if (stops.length >= 5) return;
      e.preventDefault();
      const position = getPositionFromEvent(e);
      const color = sampleGradientColor(stops, position);
      const newStops = [...stops, {color, position}];
      const newIndex = newStops.length - 1;
      onStopsChange(newStops);
      onStopSelect(newIndex);
    },
    [stops, onStopsChange, onStopSelect, getPositionFromEvent],
  );

  const handleStopPointerDown = useCallback(
    (e: PointerEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      draggingIndex.current = index;
      onStopSelect(index);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [onStopSelect],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (draggingIndex.current === null) return;
      const position = getPositionFromEvent(e);
      const newStops = stops.map((s, i) =>
        i === draggingIndex.current ? {...s, position} : s,
      );
      onStopsChange(newStops);
    },
    [stops, onStopsChange, getPositionFromEvent],
  );

  const handlePointerUp = useCallback(() => {
    draggingIndex.current = null;
  }, []);

  const handleStopRemove = useCallback(
    (e: MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (stops.length <= 2) return;
      const newStops = stops.filter((_, i) => i !== index);
      onStopsChange(newStops);
      onStopSelect(Math.min(index, newStops.length - 1));
    },
    [stops, onStopsChange, onStopSelect],
  );

  return (
    <div
      ref={barRef}
      class="relative rounded cursor-pointer"
      style={{
        width: '100%',
        height: '24px',
        background: gradientCSS,
        border: '1px solid rgba(255,255,255,0.1)',
      }}
      onPointerDown={handleBarPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Checkerboard behind for alpha visibility */}
      {stops.map((stop, i) => (
        <div
          key={i}
          data-stop-handle="true"
          class="absolute cursor-grab"
          style={{
            left: `${stop.position * 100}%`,
            bottom: '-4px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: stop.color,
            border: i === selectedStopIndex ? '2px solid var(--color-accent)' : '2px solid white',
            transform: 'translateX(-50%)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            zIndex: i === selectedStopIndex ? 10 : 1,
          }}
          onPointerDown={(e: PointerEvent) => handleStopPointerDown(e, i)}
          onContextMenu={(e: MouseEvent) => handleStopRemove(e, i)}
          onDblClick={(e: MouseEvent) => handleStopRemove(e, i)}
          title={
            stops.length > 2
              ? 'Drag to move | Right-click or double-click to remove'
              : 'Drag to move'
          }
        />
      ))}
    </div>
  );
}
