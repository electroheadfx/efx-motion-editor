// ============================================================
//  AquarelleCanvasLayer — Water color live surface on the shared
//  Studio canvas (56-11). Sits in the same demo-canvas-shell as
//  EfxPaintCanvas; captures pointer input while
//  activeModule === 'watercolor' so the physics engine never sees
//  the gesture. Preact-free core lives in aquarelleLiveSurface.
// ============================================================

import type { CSSProperties } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { AquarelleStroke } from '@efxlab/efx-watercolor';
import {
  aquarelleActiveTool,
  aquarelleParams,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
} from '../view/aquarelleRecordState';
import {
  createAquarelleLiveSurface,
  type AquarelleLiveSurface,
} from './aquarelleLiveSurface';

export function AquarelleCanvasLayer(props: {
  width: number;
  height: number;
  color: string;
  disabled?: boolean;
  onStrokeEnd: (stroke: AquarelleStroke) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<AquarelleLiveSurface | null>(null);
  const onStrokeEndRef = useRef(props.onStrokeEnd);
  const colorRef = useRef(props.color);
  const disabledRef = useRef(props.disabled ?? false);
  onStrokeEndRef.current = props.onStrokeEnd;
  colorRef.current = props.color;
  disabledRef.current = props.disabled ?? false;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const surface = createAquarelleLiveSurface({
      width: props.width,
      height: props.height,
      display: canvas,
      getSnapshot: () => ({
        params: { ...aquarelleParams.value },
        toolOverrides: { ...aquarelleToolOverrides.value },
        brushId: aquarelleSelectedTipId.value ?? '',
        tool: aquarelleActiveTool.value,
      }),
      getColor: () => colorRef.current,
      onStrokeEnd: (stroke) => onStrokeEndRef.current(stroke),
    });
    surfaceRef.current = surface;

    const toSample = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width > 0 ? props.width / rect.width : 1;
      const scaleY = rect.height > 0 ? props.height / rect.height : 1;
      return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
        p: event.pressure > 0 ? event.pressure : 0.5,
        tx: event.tiltX ?? 0,
        ty: event.tiltY ?? 0,
        tw: 0,
        t: event.timeStamp,
      };
    };

    let active = false;
    const updateCursor = (event: PointerEvent) => {
      const cursor = cursorRef.current;
      if (!cursor) return;
      const rect = canvas.getBoundingClientRect();
      const snap = {
        params: { ...aquarelleParams.value },
        toolOverrides: { ...aquarelleToolOverrides.value },
      };
      const sizeParam = Number(snap.params['size']);
      const baseRadius = Math.max(1, (Number.isFinite(sizeParam) ? sizeParam : 12) / 2);
      const diameter = Math.max(4, baseRadius * (snap.toolOverrides.tip ?? 1) * 2 * (rect.width / props.width || 1));
      cursor.style.display = 'block';
      cursor.style.left = `${event.clientX - rect.left}px`;
      cursor.style.top = `${event.clientY - rect.top}px`;
      cursor.style.width = `${diameter}px`;
      cursor.style.height = `${diameter}px`;
    };
    const onDown = (event: PointerEvent) => {
      if (disabledRef.current) return;
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      active = true;
      canvas.setPointerCapture(event.pointerId);
      surface.pointerDown(toSample(event));
      updateCursor(event);
      event.preventDefault();
      event.stopPropagation();
    };
    const onMove = (event: PointerEvent) => {
      updateCursor(event);
      if (!active) return;
      surface.pointerMove(toSample(event));
      event.preventDefault();
      event.stopPropagation();
    };
    const onUp = (event: PointerEvent) => {
      if (!active) return;
      active = false;
      surface.pointerUp(toSample(event));
      event.preventDefault();
      event.stopPropagation();
    };
    const onLeave = () => {
      if (cursorRef.current) cursorRef.current.style.display = 'none';
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      surface.dispose();
      surfaceRef.current = null;
    };
  }, [props.width, props.height]);

  const style: CSSProperties = {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: props.disabled ? 'none' : 'auto',
    touchAction: 'none',
  };

  return (
    <div class="aquarelle-live-layer" style={{ position: 'absolute', inset: '0' }}>
      <canvas
        ref={canvasRef}
        class="aquarelle-live-canvas"
        width={props.width}
        height={props.height}
        style={style}
        aria-label="Water color canvas"
      />
      <div
        ref={cursorRef}
        class="aquarelle-brush-cursor"
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          border: '1px solid rgba(255,255,255,0.85)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
          display: 'none',
        }}
      />
    </div>
  );
}
