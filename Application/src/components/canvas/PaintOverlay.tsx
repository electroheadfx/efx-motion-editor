import {useRef, useEffect} from 'preact/hooks';
import type {RefObject} from 'preact';
import {paintStore} from '../../stores/paintStore';
import {canvasStore} from '../../stores/canvasStore';
import {projectStore} from '../../stores/projectStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {clientToCanvas} from './coordinateMapper';
import {strokeToPath} from '../../lib/paintRenderer';
import type {PaintStroke, PaintShape, PaintToolType} from '../../types/paint';

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

  // --- Clean up rAF on unmount ---
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // --- Get project point from pointer event ---
  function getProjectPoint(e: PointerEvent) {
    const container = containerRef.current;
    if (!container) return {x: 0, y: 0};
    const rect = container.getBoundingClientRect();
    return clientToCanvas(
      e.clientX,
      e.clientY,
      rect,
      canvasStore.zoom.peek(),
      canvasStore.panX.peek(),
      canvasStore.panY.peek(),
      projectStore.width.peek(),
      projectStore.height.peek(),
    );
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

      const path = strokeToPath(points, size, options);
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

    const point = getProjectPoint(e);
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    const tool = paintStore.activeTool.peek();

    if (tool === 'brush' || tool === 'eraser') {
      isDrawing.current = true;
      currentPoints.current = [[point.x, point.y, pressure]];
      currentElementId.current = crypto.randomUUID();
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
    // fill: no-op for now (Plan 06)

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  function handlePointerMove(e: PointerEvent) {
    if (!isDrawing.current) return;

    const point = getProjectPoint(e);
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    const tool = paintStore.activeTool.peek();

    if (tool === 'brush' || tool === 'eraser') {
      currentPoints.current.push([point.x, point.y, pressure]);
      requestPreview();
    } else if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      // Update shape end point (store as last point)
      currentPoints.current = [currentPoints.current[0], [point.x, point.y, pressure]];
      requestPreview();
    }
  }

  function handlePointerUp(e: PointerEvent) {
    const tool = paintStore.activeTool.peek();
    const layerId = getSelectedPaintLayerId();
    const frame = timelineStore.currentFrame.peek();

    if ((tool === 'brush' || tool === 'eraser') && isDrawing.current && layerId) {
      const points = currentPoints.current;
      if (points.length > 0) {
        const stroke: PaintStroke = {
          id: currentElementId.current,
          tool,
          points: [...points],
          color: paintStore.brushColor.peek(),
          opacity: paintStore.brushOpacity.peek(),
          size: paintStore.brushSize.peek(),
          options: {...paintStore.strokeOptions.peek()},
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
