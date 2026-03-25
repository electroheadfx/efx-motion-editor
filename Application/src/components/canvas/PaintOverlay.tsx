import {useRef, useEffect} from 'preact/hooks';
import type {RefObject} from 'preact';
import {listen} from '@tauri-apps/api/event';
import {paintStore} from '../../stores/paintStore';
import {canvasStore} from '../../stores/canvasStore';
import {projectStore} from '../../stores/projectStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {clientToCanvas} from './coordinateMapper';
import {strokeToPath, renderPaintFrame} from '../../lib/paintRenderer';
import {floodFill, hexToRgba} from '../../lib/paintFloodFill';
import type {PaintStroke, PaintShape, PaintFill, PaintToolType, BrushStyle} from '../../types/paint';

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
  // WebKit (WKWebView) reports pointerType:'mouse' for pen input, so we detect
  // pen via native Tauri bridge timing instead of PointerEvent.pointerType.
  const nativePressure = useRef(0.5);     // latest pressure from native macOS NSEvent
  const nativeTiltX = useRef(0);
  const nativeTiltY = useRef(0);
  const lastNativeEventTime = useRef(0);  // timestamp of last native tablet event
  const avgTilt = useRef(0);
  const tiltSamples = useRef(0);

  // --- Clean up rAF on unmount ---
  useEffect(() => {
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // --- Listen for native tablet pressure from Tauri backend ---
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<{pressure: number; tilt_x: number; tilt_y: number}>('tablet:pressure', (event) => {
      nativePressure.current = event.payload.pressure;
      nativeTiltX.current = event.payload.tilt_x;
      nativeTiltY.current = event.payload.tilt_y;
      lastNativeEventTime.current = performance.now();
      // Mark tablet as detected
      if (!paintStore.tabletDetected.peek()) {
        paintStore.setTabletDetected(true);
      }
      // Update live pressure readout for sidebar
      paintStore.livePressure.value = event.payload.pressure;
    }).then(fn => { unlisten = fn; });
    return () => unlisten?.();
  }, []);

  // --- Detect pen input via native bridge timing ---
  // Returns true if native tablet events arrived recently (within 300ms).
  // WebKit reports pointerType:'mouse' for pen, so this is the only reliable check.
  function isNativePenActive(): boolean {
    return lastNativeEventTime.current > 0 &&
      (performance.now() - lastNativeEventTime.current) < 300;
  }

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

      // When native tablet bridge is active, use real pressure (disable simulation).
      const previewOptions = {
        ...options,
        simulatePressure: !isNativePenActive(),
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

    // Detect pen via native bridge (WebKit reports pointerType:'mouse' for pen)
    const isPen = isNativePenActive();

    const point = getProjectPoint(e);
    const pressure = isPen ? nativePressure.current : 0.5;
    const tool = paintStore.activeTool.peek();

    if (tool === 'brush' || tool === 'eraser') {
      isDrawing.current = true;
      currentPoints.current = [[point.x, point.y, pressure]];
      currentElementId.current = crypto.randomUUID();
      // Initialize tilt tracking for pen (use native tilt from Tauri bridge)
      if (isPen) {
        const tx = nativeTiltX.current;
        const ty = nativeTiltY.current;
        const tiltMagnitude = Math.min(1, Math.sqrt(tx * tx + ty * ty));
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
    const isPen = isNativePenActive();

    if (tool === 'brush' || tool === 'eraser') {
      // Use coalesced events for higher-resolution position input
      const coalescedPts = getCoalescedPoints(e);
      for (const pt of coalescedPts) {
        // Use native macOS pressure for pen (WebKit always reports 0.5)
        const pressure = isPen ? nativePressure.current : 0.5;
        currentPoints.current.push([pt.x, pt.y, pressure]);
        // Update running tilt average for pen
        if (isPen) {
          const tx = nativeTiltX.current;
          const ty = nativeTiltY.current;
          const tiltMag = Math.min(1, Math.sqrt(tx * tx + ty * ty));
          tiltSamples.current++;
          avgTilt.current += (tiltMag - avgTilt.current) / tiltSamples.current;
        }
      }
      requestPreview();
    } else if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
      const point = getProjectPoint(e);
      const pressure = isPen ? nativePressure.current : 0.5;
      // Update shape end point (store as last point)
      currentPoints.current = [currentPoints.current[0], [point.x, point.y, pressure]];
      requestPreview();
    }
  }

  function handlePointerUp(e: PointerEvent) {
    const tool = paintStore.activeTool.peek();
    const layerId = getSelectedPaintLayerId();
    const frame = timelineStore.currentFrame.peek();
    const isPen = isNativePenActive();

    if ((tool === 'brush' || tool === 'eraser') && isDrawing.current && layerId) {
      const points = currentPoints.current;
      if (points.length > 0) {
        // Build per-stroke options with device-specific overrides
        const baseOptions = {...paintStore.strokeOptions.peek()};
        // When native bridge provided real pressure, disable velocity simulation
        baseOptions.simulatePressure = !isPen;

        // When pen is tilted, reduce thinning (flatter stroke like a real brush on its side)
        if (isPen && baseOptions.tiltInfluence > 0) {
          const tiltFactor = Math.min(1, avgTilt.current); // 0-1 clamped
          baseOptions.thinning = Math.max(0.1, baseOptions.thinning * (1 - tiltFactor * baseOptions.tiltInfluence));
        }

        const stroke: PaintStroke = {
          id: currentElementId.current,
          tool,
          points: [...points],
          color: paintStore.brushColor.peek(),
          opacity: paintStore.brushOpacity.peek(),
          size: paintStore.brushSize.peek(),
          options: baseOptions,
          brushStyle: paintStore.brushStyle.peek() as BrushStyle,
          brushParams: { ...paintStore.brushFxParams.peek() },
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
