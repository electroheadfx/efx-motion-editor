import {useRef, useEffect} from 'preact/hooks';
import type {RefObject} from 'preact';
import {paintStore} from '../../stores/paintStore';
import {canvasStore} from '../../stores/canvasStore';
import {projectStore} from '../../stores/projectStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {clientToCanvas} from './coordinateMapper';
import {strokeToPath, renderPaintFrame} from '../../lib/paintRenderer';
import {floodFill, hexToRgba} from '../../lib/paintFloodFill';
import type {PaintStroke, PaintShape, PaintFill, PaintToolType} from '../../types/paint';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaintOverlayProps {
  containerRef: RefObject<HTMLDivElement>;
  isSpaceHeld: RefObject<boolean>;
  onPanStart: (e: PointerEvent) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map active tool to CSS cursor */
function cursorForTool(tool: PaintToolType): string {
  switch (tool) {
    case 'brush':
    case 'eraser':
    case 'fill':
    case 'line':
    case 'rect':
    case 'ellipse':
      return 'crosshair';
    case 'eyedropper':
      return 'crosshair';
    default:
      return 'crosshair';
  }
}

/** Convert an RGBA pixel to a hex color string */
function rgbaToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PaintOverlay({
  containerRef,
  isSpaceHeld,
  onPanStart,
}: PaintOverlayProps) {
  // --- Refs for drawing state ---
  const isDrawing = useRef(false);
  const currentPoints = useRef<[number, number, number][]>([]);
  const shapeStart = useRef<{x: number; y: number} | null>(null);
  const currentElementId = useRef('');
  const overlayRef = useRef<HTMLDivElement>(null);
  const tempCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafId = useRef(0);

  // --- Tablet pen tracking refs ---
  const isPenStroke = useRef(false);
  const avgTilt = useRef(0);
  const tiltSamples = useRef(0);

  // --- Clean up rAF on unmount ---
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // --- Get project point from any event-like object with clientX/clientY ---
  function getProjectPointFromEvent(ev: {clientX: number; clientY: number}) {
    const container = containerRef.current;
    if (!container) return {x: 0, y: 0};
    const rect = container.getBoundingClientRect();
    return clientToCanvas(
      ev.clientX,
      ev.clientY,
      rect,
      canvasStore.zoom.peek(),
      canvasStore.panX.peek(),
      canvasStore.panY.peek(),
      projectStore.width.peek(),
      projectStore.height.peek(),
    );
  }

  function getProjectPoint(e: PointerEvent) {
    return getProjectPointFromEvent(e);
  }

  // --- Extract coalesced points from a PointerEvent (tablet high-frequency input) ---
  function getCoalescedPoints(e: PointerEvent): Array<{x: number; y: number; pressure: number; tiltX: number; tiltY: number}> {
    const coalesced = (e as any).getCoalescedEvents?.() as PointerEvent[] | undefined;
    const events = coalesced && coalesced.length > 0 ? coalesced : [e];
    return events.map(ev => {
      const pt = getProjectPointFromEvent(ev);
      return {
        ...pt,
        pressure: ev.pressure,
        tiltX: ev.tiltX || 0,
        tiltY: ev.tiltY || 0,
      };
    });
  }

  // --- Get selected paint layer ID ---
  function getSelectedPaintLayerId(): string | null {
    const id = layerStore.selectedLayerId.peek();
    if (!id) return null;
    // Find the layer in the layers list to check its type
    const allLayers = layerStore.layers.peek();
    const overlayLayers = layerStore.overlayLayers.peek();
    const layer = allLayers.find(l => l.id === id) ?? overlayLayers.find(l => l.id === id);
    if (layer && layer.type === 'paint') return id;
    return null;
  }

  // --- Live preview: render in-progress stroke to temp canvas ---
  function renderLivePreview() {
    const canvas = tempCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = projectStore.width.peek();
    const h = projectStore.height.peek();

    // Ensure temp canvas matches project size
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    const tool = paintStore.activeTool.peek();
    const points = currentPoints.current;

    if ((tool === 'brush' || tool === 'eraser') && points.length > 0) {
      const options = paintStore.strokeOptions.peek();
      const size = paintStore.brushSize.peek();

      // Override simulatePressure based on input device for live preview
      const previewOptions = {
        ...options,
        simulatePressure: !isPenStroke.current,
      };
      const path = strokeToPath(points, size, previewOptions);
      if (path) {
        ctx.save();
        if (tool === 'eraser') {
          // Show eraser preview as semi-transparent gray
          ctx.globalAlpha = 0.4;
          ctx.fillStyle = '#888888';
        } else {
          ctx.globalAlpha = paintStore.brushOpacity.peek();
          ctx.fillStyle = paintStore.brushColor.peek();
        }
        ctx.fill(path);
        ctx.restore();
      }
    } else if ((tool === 'line' || tool === 'rect' || tool === 'ellipse') && shapeStart.current && points.length > 0) {
      const start = shapeStart.current;
      const end = points[points.length - 1];

      ctx.save();
      ctx.globalAlpha = paintStore.brushOpacity.peek();
      ctx.strokeStyle = paintStore.brushColor.peek();
      ctx.fillStyle = paintStore.brushColor.peek();
      ctx.lineWidth = paintStore.brushSize.peek();
      ctx.lineCap = 'round';

      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end[0], end[1]);
        ctx.stroke();
      } else if (tool === 'rect') {
        const x = Math.min(start.x, end[0]);
        const y = Math.min(start.y, end[1]);
        const rw = Math.abs(end[0] - start.x);
        const rh = Math.abs(end[1] - start.y);
        if (paintStore.shapeFilled.peek()) {
          ctx.fillRect(x, y, rw, rh);
        } else {
          ctx.strokeRect(x, y, rw, rh);
        }
      } else if (tool === 'ellipse') {
        const cx = (start.x + end[0]) / 2;
        const cy = (start.y + end[1]) / 2;
        const rx = Math.abs(end[0] - start.x) / 2;
        const ry = Math.abs(end[1] - start.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
        if (paintStore.shapeFilled.peek()) {
          ctx.fill();
        } else {
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  /** Request a live preview render gated by rAF */
  function requestPreview() {
    if (rafId.current) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = 0;
      renderLivePreview();
    });
  }

  // --- Pointer event handlers ---

  function handlePointerDown(e: PointerEvent) {
    // Space+drag = pan (per D-11)
    if (isSpaceHeld.current === true) {
      onPanStart(e);
      return;
    }

    // Only left button
    if (e.button !== 0) return;

    // Auto-detect pen vs mouse
    const isPen = e.pointerType === 'pen';
    if (isPen && !paintStore.tabletDetected.peek()) {
      paintStore.setTabletDetected(true);
    }
    isPenStroke.current = isPen;

    const point = getProjectPoint(e);
    // For pen: use real pressure. For mouse: browser reports 0.5 for button down.
    // simulatePressure handles velocity-based width for mouse strokes.
    const pressure = isPen ? e.pressure : 0.5;
    const tool = paintStore.activeTool.peek();

    if (tool === 'brush' || tool === 'eraser') {
      isDrawing.current = true;
      currentPoints.current = [[point.x, point.y, pressure]];
      currentElementId.current = crypto.randomUUID();
      // Initialize tilt tracking for pen
      if (isPen) {
        const tiltMagnitude = Math.sqrt(e.tiltX ** 2 + e.tiltY ** 2) / 90;
        avgTilt.current = tiltMagnitude;
        tiltSamples.current = 1;
      } else {
        avgTilt.current = 0;
        tiltSamples.current = 0;
      }
      requestPreview();
    } else if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      shapeStart.current = {x: point.x, y: point.y};
      currentPoints.current = [[point.x, point.y, pressure]];
      currentElementId.current = crypto.randomUUID();
      isDrawing.current = true;
      requestPreview();
    } else if (tool === 'eyedropper') {
      // Read pixel color from canvas at click point
      const container = containerRef.current;
      if (container) {
        const canvas = container.querySelector('canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Scale by device pixel ratio since canvas may be at higher resolution
            const dpr = window.devicePixelRatio || 1;
            const px = Math.round(point.x * dpr);
            const py = Math.round(point.y * dpr);
            const imageData = ctx.getImageData(px, py, 1, 1);
            const [r, g, b] = imageData.data;
            paintStore.setBrushColor(rgbaToHex(r, g, b));
          }
        }
      }
    }
    if (tool === 'fill') {
      // 1. Rasterize current frame's existing paint to an offscreen canvas
      const projW = projectStore.width.peek();
      const projH = projectStore.height.peek();
      const offscreen = document.createElement('canvas');
      offscreen.width = projW;
      offscreen.height = projH;
      const offCtx = offscreen.getContext('2d')!;

      const layerId = getSelectedPaintLayerId();
      const frame = timelineStore.currentFrame.peek();
      if (!layerId) return;

      const existingFrame = paintStore.getFrame(layerId, frame);
      if (existingFrame) {
        renderPaintFrame(offCtx, existingFrame, projW, projH);
      }

      // 2. Get ImageData and run flood fill
      const imgData = offCtx.getImageData(0, 0, projW, projH);
      const fillRgba = hexToRgba(paintStore.brushColor.peek(), paintStore.brushOpacity.peek());
      floodFill(imgData, Math.round(point.x), Math.round(point.y), fillRgba, paintStore.fillTolerance.peek());

      // 3. Store as PaintFill element
      const fillElement: PaintFill = {
        id: crypto.randomUUID(),
        tool: 'fill',
        x: point.x,
        y: point.y,
        color: paintStore.brushColor.peek(),
        opacity: paintStore.brushOpacity.peek(),
        tolerance: paintStore.fillTolerance.peek(),
      };
      paintStore.addElement(layerId, frame, fillElement);
    }

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDrawing.current) return;

    const tool = paintStore.activeTool.peek();
    const isPen = e.pointerType === 'pen';

    if (tool === 'brush' || tool === 'eraser') {
      // Use coalesced events for higher-resolution tablet input
      const coalescedPts = getCoalescedPoints(e);
      for (const pt of coalescedPts) {
        const pressure = isPen ? pt.pressure : 0.5;
        currentPoints.current.push([pt.x, pt.y, pressure]);
        // Update running tilt average for pen
        if (isPen) {
          const tiltMag = Math.sqrt(pt.tiltX ** 2 + pt.tiltY ** 2) / 90;
          tiltSamples.current++;
          avgTilt.current += (tiltMag - avgTilt.current) / tiltSamples.current;
        }
      }
      requestPreview();
    } else if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      const point = getProjectPoint(e);
      const pressure = isPen ? e.pressure : 0.5;
      // Update shape end point (store as last point)
      currentPoints.current = [currentPoints.current[0], [point.x, point.y, pressure]];
      requestPreview();
    }
  }

  function handlePointerUp(e: PointerEvent) {
    const tool = paintStore.activeTool.peek();
    const layerId = getSelectedPaintLayerId();
    const frame = timelineStore.currentFrame.peek();
    const isPen = e.pointerType === 'pen';

    if ((tool === 'brush' || tool === 'eraser') && isDrawing.current && layerId) {
      const points = currentPoints.current;
      if (points.length > 0) {
        // Build per-stroke options with device-specific overrides
        const baseOptions = {...paintStore.strokeOptions.peek()};
        // Override simulatePressure: false for pen (real data), true for mouse (velocity-based)
        baseOptions.simulatePressure = !isPen;

        // When pen is tilted, reduce thinning (flatter stroke like a real brush on its side)
        if (isPen && baseOptions.tiltInfluence > 0) {
          const tiltFactor = avgTilt.current; // 0-1 normalized
          baseOptions.thinning = baseOptions.thinning * (1 - tiltFactor * baseOptions.tiltInfluence);
        }

        const stroke: PaintStroke = {
          id: currentElementId.current,
          tool,
          points: [...points],
          color: paintStore.brushColor.peek(),
          opacity: paintStore.brushOpacity.peek(),
          size: paintStore.brushSize.peek(),
          options: baseOptions,
        };
        paintStore.addElement(layerId, frame, stroke);
      }
    } else if ((tool === 'line' || tool === 'rect' || tool === 'ellipse') && shapeStart.current && layerId) {
      const start = shapeStart.current;
      const endPoints = currentPoints.current;
      if (endPoints.length > 1) {
        const end = endPoints[endPoints.length - 1];
        const shape: PaintShape = {
          id: currentElementId.current,
          tool,
          x1: start.x,
          y1: start.y,
          x2: end[0],
          y2: end[1],
          color: paintStore.brushColor.peek(),
          opacity: paintStore.brushOpacity.peek(),
          strokeWidth: paintStore.brushSize.peek(),
          filled: paintStore.shapeFilled.peek(),
        };
        paintStore.addElement(layerId, frame, shape);
      }
    }

    // Clear drawing state
    isDrawing.current = false;
    currentPoints.current = [];
    shapeStart.current = null;
    currentElementId.current = '';
    // Reset tilt tracking
    avgTilt.current = 0;
    tiltSamples.current = 0;
    isPenStroke.current = false;

    // Clear temp canvas
    const canvas = tempCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Release pointer capture
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may not be active
    }
  }

  // --- Render ---
  const cursor = cursorForTool(paintStore.activeTool.value);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'all',
        cursor,
        zIndex: 20,
        touchAction: 'none',  // prevent browser gestures on pen/touch input
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Temporary canvas for live stroke preview */}
      <canvas
        ref={tempCanvasRef}
        width={projectStore.width.value}
        height={projectStore.height.value}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
