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
import {renderFrameFx} from '../../lib/brushP5Adapter';
import {floodFill, hexToRgba} from '../../lib/paintFloodFill';
import {pushAction} from '../../lib/history';
import type {PaintStroke, PaintShape, PaintFill, PaintElement, PaintToolType, BrushStyle, PaintFrame} from '../../types/paint';

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
    case 'select':
      return 'default';
    default:
      return 'crosshair';
  }
}

/**
 * Find the topmost element that a point falls on (hit testing for select tool).
 * Walks elements in reverse order (topmost first).
 * Handles PaintStroke, PaintShape, and PaintFill element types.
 */
function findElementAtPoint(
  paintFrame: PaintFrame,
  x: number,
  y: number,
): string | null {
  for (let i = paintFrame.elements.length - 1; i >= 0; i--) {
    const el = paintFrame.elements[i];

    if (el.tool === 'brush' || el.tool === 'eraser') {
      const stroke = el as PaintStroke;
      // Check if point is within stroke bounding box + padding
      const pad = stroke.size / 2 + 5;
      let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
      for (const [px, py] of stroke.points) {
        if (px < sMinX) sMinX = px;
        if (py < sMinY) sMinY = py;
        if (px > sMaxX) sMaxX = px;
        if (py > sMaxY) sMaxY = py;
      }
      if (x >= sMinX - pad && x <= sMaxX + pad && y >= sMinY - pad && y <= sMaxY + pad) {
        // Fine check: distance to any point in the stroke
        for (const [px, py] of stroke.points) {
          const dx = x - px;
          const dy = y - py;
          if (dx * dx + dy * dy <= pad * pad) {
            return stroke.id;
          }
        }
      }
    } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
      const shape = el as PaintShape;
      const pad = 5;
      const sMinX = Math.min(shape.x1, shape.x2);
      const sMinY = Math.min(shape.y1, shape.y2);
      const sMaxX = Math.max(shape.x1, shape.x2);
      const sMaxY = Math.max(shape.y1, shape.y2);
      if (x >= sMinX - pad && x <= sMaxX + pad && y >= sMinY - pad && y <= sMaxY + pad) {
        return shape.id;
      }
    } else if (el.tool === 'fill') {
      const fill = el as PaintFill;
      const dx = x - fill.x;
      const dy = y - fill.y;
      if (dx * dx + dy * dy <= 10 * 10) {
        return fill.id;
      }
    }
  }
  return null;
}

/** Get combined bounding box of all selected elements */
function getSelectionBounds(
  paintFrame: PaintFrame,
  selected: Set<string>,
): {minX: number; minY: number; maxX: number; maxY: number; pad: number} | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let maxPad = 6;
  let count = 0;
  for (const el of paintFrame.elements) {
    if (!selected.has(el.id)) continue;

    if (el.tool === 'brush' || el.tool === 'eraser') {
      const stroke = el as PaintStroke;
      const strokePad = stroke.size / 2 + 6;
      if (strokePad > maxPad) maxPad = strokePad;
      for (const [px, py] of stroke.points) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
    } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
      const shape = el as PaintShape;
      const shapePad = shape.strokeWidth / 2 + 6;
      if (shapePad > maxPad) maxPad = shapePad;
      const sx1 = Math.min(shape.x1, shape.x2);
      const sy1 = Math.min(shape.y1, shape.y2);
      const sx2 = Math.max(shape.x1, shape.x2);
      const sy2 = Math.max(shape.y1, shape.y2);
      if (sx1 < minX) minX = sx1;
      if (sy1 < minY) minY = sy1;
      if (sx2 > maxX) maxX = sx2;
      if (sy2 > maxY) maxY = sy2;
    } else if (el.tool === 'fill') {
      const fill = el as PaintFill;
      if (fill.x < minX) minX = fill.x;
      if (fill.y < minY) minY = fill.y;
      if (fill.x > maxX) maxX = fill.x;
      if (fill.y > maxY) maxY = fill.y;
      if (5 > maxPad) maxPad = 5;
    }

    count++;
  }
  if (count === 0) return null;
  return {minX: minX - maxPad, minY: minY - maxPad, maxX: maxX + maxPad, maxY: maxY + maxPad, pad: maxPad};
}

const HANDLE_SIZE = 6;

/** Check if a point hits a transform handle, returns corner name or null.
 * Returns 2-letter string for corner handles (uniform scale), 1-letter for edge handles (non-uniform scale).
 */
function hitTestHandle(
  x: number, y: number,
  bounds: {minX: number; minY: number; maxX: number; maxY: number},
): string | null {
  const hs = HANDLE_SIZE + 3;  // hit area slightly larger than visual
  const midX = (bounds.minX + bounds.maxX) / 2;
  const midY = (bounds.minY + bounds.maxY) / 2;

  // Corner handles (uniform scale) — check first (priority over edges at corners)
  const corners: [string, number, number][] = [
    ['tl', bounds.minX, bounds.minY],
    ['tr', bounds.maxX, bounds.minY],
    ['bl', bounds.minX, bounds.maxY],
    ['br', bounds.maxX, bounds.maxY],
  ];
  for (const [name, cx, cy] of corners) {
    if (Math.abs(x - cx) <= hs && Math.abs(y - cy) <= hs) return name;
  }

  // Edge midpoint handles (non-uniform scale) — per D-04
  const edges: [string, number, number][] = [
    ['t', midX, bounds.minY],
    ['r', bounds.maxX, midY],
    ['b', midX, bounds.maxY],
    ['l', bounds.minX, midY],
  ];
  for (const [name, cx, cy] of edges) {
    if (Math.abs(x - cx) <= hs && Math.abs(y - cy) <= hs) return name;
  }

  return null;
}

/** Get CSS cursor name for a handle */
function cursorForHandle(handleName: string): string {
  switch (handleName) {
    case 't': case 'b': return 'ns-resize';
    case 'l': case 'r': return 'ew-resize';
    case 'tl': case 'br': return 'nwse-resize';
    case 'tr': case 'bl': return 'nesw-resize';
    default: return 'default';
  }
}

/** Deep-clone selected elements for undo snapshot (D-07) */
function captureElementSnapshot(
  elements: PaintElement[],
  ids: Set<string>,
): Map<string, PaintElement> {
  const snapshot = new Map<string, PaintElement>();
  for (const el of elements) {
    if (ids.has(el.id)) {
      snapshot.set(el.id, structuredClone(el));
    }
  }
  return snapshot;
}

/** Restore elements from a snapshot (D-07) */
function restoreElementSnapshot(
  elements: PaintElement[],
  snapshot: Map<string, PaintElement>,
): void {
  for (let i = 0; i < elements.length; i++) {
    const saved = snapshot.get(elements[i].id);
    if (saved) {
      elements[i] = structuredClone(saved);
    }
  }
}

/**
 * Re-render all FX-applied strokes on a frame together via p5.brush.
 * All FX strokes go through renderFrameFx() on one canvas for spectral mixing.
 * Result is cached in paintStore.frameFxCache.
 */
function reRenderFrameFx(
  paintFrame: PaintFrame,
  layerId: string,
  frame: number,
  width: number,
  height: number,
): void {
  const brushStrokes = paintFrame.elements.filter(
    (el) => el.tool === 'brush'
  ) as PaintStroke[];

  // Show rendering indicator, defer actual render so UI can paint first
  paintStore.isRenderingFx.value = true;
  requestAnimationFrame(() => {
    try {
      const cached = renderFrameFx(brushStrokes, width, height);
      if (cached) {
        paintStore.setFrameFxCache(layerId, frame, cached);
      } else {
        paintStore.invalidateFrameFxCache(layerId, frame);
      }
      // Trigger re-render of the preview
      paintStore.markDirty(layerId, frame);
      paintStore.paintVersion.value++;
    } finally {
      paintStore.isRenderingFx.value = false;
    }
  });
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

  // --- Refs for select-mode drag ---
  const isDragging = useRef(false);
  const dragStart = useRef<{x: number; y: number} | null>(null);

  // --- Refs for path-based eraser ---
  const isErasing = useRef(false);
  const erasedStrokeIds = useRef<Set<string>>(new Set());

  // --- Refs for stroke transform (resize/rotate) ---
  const isTransforming = useRef(false);
  const transformType = useRef<'scale' | 'rotate' | null>(null);
  const transformCorner = useRef<string>('');  // 'tl','tr','bl','br'
  const transformCenter = useRef<{x: number; y: number}>({x: 0, y: 0});
  const transformStartAngle = useRef(0);
  const transformStartDist = useRef(1);

  // --- Ref for transform undo snapshot (D-07) ---
  const transformSnapshot = useRef<Map<string, PaintElement> | null>(null);
  const transformLayerId = useRef<string>('');
  const transformFrame = useRef<number>(0);

  // --- Refs for non-uniform edge scale (D-04, D-05) ---
  const edgeAnchorX = useRef(0);            // fixed X coordinate of opposite edge
  const edgeAnchorY = useRef(0);            // fixed Y coordinate of opposite edge
  const edgeOriginalWidth = useRef(1);      // original dimension for scale ratio
  const edgeOriginalHeight = useRef(1);

  // --- Ref for Alt+drag duplicate (D-01) ---
  const isDuplicating = useRef(false);
  const duplicateCloneIds = useRef<string[]>([]);

  // --- Flag to prevent FX useEffect from firing during style sync ---
  const isSyncingStyle = useRef(false);

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
      0, 16,  // paddingTop=0 (pt-0), paddingBottom=16 (p-4 bottom)
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

    if (tool === 'brush' && points.length > 0) {
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
        ctx.globalAlpha = paintStore.brushOpacity.peek();
        ctx.fillStyle = paintStore.brushColor.peek();
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

    // Draw selection indicators for selected strokes
    const layerId = getSelectedPaintLayerId();
    if (layerId) {
      const frame = timelineStore.currentFrame.peek();
      const paintFrame = paintStore.getFrame(layerId, frame);
      const selected = paintStore.selectedStrokeIds.peek();

      if (paintFrame && selected.size > 0) {
        // Draw individual element bounding boxes
        for (const el of paintFrame.elements) {
          if (!selected.has(el.id)) continue;

          let sMinX = Infinity, sMinY = Infinity, sMaxX = -Infinity, sMaxY = -Infinity;
          let sPad = 4;

          if (el.tool === 'brush' || el.tool === 'eraser') {
            const stroke = el as PaintStroke;
            for (const [px, py] of stroke.points) {
              if (px < sMinX) sMinX = px;
              if (py < sMinY) sMinY = py;
              if (px > sMaxX) sMaxX = px;
              if (py > sMaxY) sMaxY = py;
            }
            sPad = stroke.size / 2 + 4;
          } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
            const shape = el as PaintShape;
            sMinX = Math.min(shape.x1, shape.x2);
            sMinY = Math.min(shape.y1, shape.y2);
            sMaxX = Math.max(shape.x1, shape.x2);
            sMaxY = Math.max(shape.y1, shape.y2);
            sPad = shape.strokeWidth / 2 + 4;
          } else if (el.tool === 'fill') {
            const fill = el as PaintFill;
            sMinX = fill.x - 10;
            sMinY = fill.y - 10;
            sMaxX = fill.x + 10;
            sMaxY = fill.y + 10;
            sPad = 0;
          }

          ctx.save();
          ctx.strokeStyle = '#4A90D9';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.globalAlpha = 0.5;
          ctx.strokeRect(sMinX - sPad, sMinY - sPad, sMaxX - sMinX + sPad * 2, sMaxY - sMinY + sPad * 2);
          ctx.restore();
        }

        // Draw combined bounding box with transform handles
        const bounds = getSelectionBounds(paintFrame, selected);
        if (bounds) {
          const {minX, minY, maxX, maxY} = bounds;
          const bw = maxX - minX;
          const bh = maxY - minY;

          // Main bounding box
          ctx.save();
          ctx.strokeStyle = '#4A90D9';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(minX, minY, bw, bh);
          ctx.restore();

          // Corner handles (resize)
          const corners: [number, number][] = [
            [minX, minY], [maxX, minY],
            [minX, maxY], [maxX, maxY],
          ];
          for (const [cx, cy] of corners) {
            ctx.save();
            ctx.fillStyle = 'white';
            ctx.strokeStyle = '#4A90D9';
            ctx.lineWidth = 1.5;
            ctx.fillRect(cx - HANDLE_SIZE / 2, cy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            ctx.strokeRect(cx - HANDLE_SIZE / 2, cy - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE);
            ctx.restore();
          }

          // Edge midpoint handles (non-uniform scale) — per D-04
          const EDGE_HANDLE_RADIUS = 5;
          const edgeMidpoints: [number, number][] = [
            [(minX + maxX) / 2, minY],           // top
            [maxX, (minY + maxY) / 2],           // right
            [(minX + maxX) / 2, maxY],           // bottom
            [minX, (minY + maxY) / 2],           // left
          ];
          for (const [ex, ey] of edgeMidpoints) {
            ctx.save();
            ctx.fillStyle = 'white';
            ctx.strokeStyle = '#4A90D9';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(ex, ey, EDGE_HANDLE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          // Rotate handle (above top center)
          const rcx = (minX + maxX) / 2;
          const rcy = minY - 20;
          ctx.save();
          ctx.strokeStyle = '#4A90D9';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rcx, minY);
          ctx.lineTo(rcx, rcy);
          ctx.stroke();
          ctx.fillStyle = 'white';
          ctx.strokeStyle = '#4A90D9';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(rcx, rcy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
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

  // --- Select tool handler (per D-05) ---

  /** Sync sidebar style buttons to match the selected stroke's actual style */
  function syncStyleToSelection() {
    const selected = paintStore.selectedStrokeIds.peek();
    if (selected.size === 0) return;
    const layerId = getSelectedPaintLayerId();
    if (!layerId) return;
    const frame = timelineStore.currentFrame.peek();
    const paintFrame = paintStore.getFrame(layerId, frame);
    if (!paintFrame) return;

    // Use the first selected stroke's style — set flag to prevent FX useEffect
    isSyncingStyle.current = true;
    for (const el of paintFrame.elements) {
      if (el.tool !== 'brush') continue;
      if (!selected.has(el.id)) continue;
      const stroke = el as PaintStroke;
      paintStore.brushStyle.value = stroke.brushStyle || 'flat';
      paintStore.setBrushSize(Math.round(stroke.size));
      paintStore.setBrushColor(stroke.color);
      if (stroke.brushParams) {
        paintStore.brushFxParams.value = {...stroke.brushParams};
      }
      break;
    }
    // Clear flag after microtask (useEffect runs asynchronously)
    queueMicrotask(() => { isSyncingStyle.current = false; });
  }

  function handleSelectPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const point = getProjectPoint(e);
    const layerId = getSelectedPaintLayerId();
    if (!layerId) return;

    const frame = timelineStore.currentFrame.peek();
    const paintFrame = paintStore.getFrame(layerId, frame);
    if (!paintFrame) return;

    const selected = paintStore.selectedStrokeIds.peek();

    // Check transform handles first (only when strokes are selected)
    if (selected.size > 0) {
      const bounds = getSelectionBounds(paintFrame, selected);
      if (bounds) {
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cy = (bounds.minY + bounds.maxY) / 2;

        // Check rotate handle (circle above top center)
        const rcx = cx;
        const rcy = bounds.minY - 20;
        if (Math.hypot(point.x - rcx, point.y - rcy) <= 8) {
          isTransforming.current = true;
          transformType.current = 'rotate';
          transformCenter.current = {x: cx, y: cy};
          transformStartAngle.current = Math.atan2(point.y - cy, point.x - cx);
          transformSnapshot.current = captureElementSnapshot(paintFrame.elements, selected);
          transformLayerId.current = layerId;
          transformFrame.current = frame;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          e.preventDefault();
          return;
        }

        // Check corner and edge resize handles
        const handle = hitTestHandle(point.x, point.y, bounds);
        if (handle) {
          isTransforming.current = true;
          transformType.current = 'scale';
          transformCorner.current = handle;

          // Capture undo snapshot
          transformSnapshot.current = captureElementSnapshot(paintFrame.elements, selected);
          transformLayerId.current = layerId;
          transformFrame.current = frame;

          if (handle.length === 1) {
            // Edge handle → non-uniform scale (D-04)
            // Capture opposite-edge anchor and original dimension (D-05)
            if (handle === 'r') {
              edgeAnchorX.current = bounds.minX;
              edgeOriginalWidth.current = bounds.maxX - bounds.minX;
            } else if (handle === 'l') {
              edgeAnchorX.current = bounds.maxX;
              edgeOriginalWidth.current = bounds.maxX - bounds.minX;
            } else if (handle === 'b') {
              edgeAnchorY.current = bounds.minY;
              edgeOriginalHeight.current = bounds.maxY - bounds.minY;
            } else if (handle === 't') {
              edgeAnchorY.current = bounds.maxY;
              edgeOriginalHeight.current = bounds.maxY - bounds.minY;
            }
            dragStart.current = {x: point.x, y: point.y};
          } else {
            // Corner handle → uniform scale (existing behavior)
            transformCenter.current = {x: cx, y: cy};
            transformStartDist.current = Math.hypot(point.x - cx, point.y - cy);
            dragStart.current = {x: point.x, y: point.y};
          }
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          e.preventDefault();
          return;
        }
      }
    }

    const hitStrokeId = findElementAtPoint(paintFrame, point.x, point.y);

    if (hitStrokeId) {
      if (e.metaKey || e.ctrlKey) {
        paintStore.toggleStrokeSelection(hitStrokeId);
      } else if (selected.has(hitStrokeId)) {
        if (e.altKey) {
          // Alt+drag = duplicate all selected elements (D-01, D-02, D-03)
          const frameData = paintStore.getFrame(layerId, frame);
          if (!frameData) return;
          const clones: PaintElement[] = [];
          const cloneIds: string[] = [];

          for (const el of frameData.elements) {
            if (!selected.has(el.id)) continue;
            const clone = structuredClone(el) as PaintElement;
            (clone as {id: string}).id = crypto.randomUUID();
            cloneIds.push((clone as {id: string}).id);
            clones.push(clone);
          }

          // Add clones to frame (originals stay at original positions per D-01)
          for (const clone of clones) {
            frameData.elements.push(clone);
          }

          // Switch selection to clones (user drags clones, not originals)
          paintStore.selectedStrokeIds.value = new Set(cloneIds);

          // Mark as duplicating for undo tracking
          isDuplicating.current = true;
          duplicateCloneIds.current = cloneIds;

          // Capture snapshot of clones' initial positions for combined undo
          transformSnapshot.current = captureElementSnapshot(frameData.elements, new Set(cloneIds));
          transformLayerId.current = layerId;
          transformFrame.current = frame;

          // Start drag of clones
          isDragging.current = true;
          dragStart.current = {x: point.x, y: point.y};

          paintStore.markDirty(layerId, frame);
          paintStore.paintVersion.value++;
          paintStore.invalidateFrameFxCache(layerId, frame);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } else {
          // Normal drag (existing behavior)
          isDragging.current = true;
          dragStart.current = {x: point.x, y: point.y};
          transformSnapshot.current = captureElementSnapshot(paintFrame.elements, selected);
          transformLayerId.current = layerId;
          transformFrame.current = frame;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }
      } else {
        paintStore.clearSelection();
        paintStore.selectStroke(hitStrokeId);
      }
      syncStyleToSelection();
    } else {
      paintStore.clearSelection();
    }

    requestPreview();
    e.preventDefault();
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

    const tool = paintStore.activeTool.peek();

    // Route select tool (per D-05)
    if (tool === 'select') {
      handleSelectPointerDown(e);
      return;
    }

    // Detect pen via native bridge (WebKit reports pointerType:'mouse' for pen)
    const isPen = isNativePenActive();

    const point = getProjectPoint(e);
    const pressure = isPen ? nativePressure.current : 0.5;

    // Path-based eraser: detect and remove strokes under cursor
    if (tool === 'eraser') {
      isErasing.current = true;
      erasedStrokeIds.current = new Set();
      const layerId = getSelectedPaintLayerId();
      if (layerId) {
        const frame = timelineStore.currentFrame.peek();
        const paintFrame = paintStore.getFrame(layerId, frame);
        if (paintFrame) {
          const hitId = findElementAtPoint(paintFrame, point.x, point.y);
          if (hitId) {
            paintStore.removeElement(layerId, frame, hitId);
            erasedStrokeIds.current.add(hitId);
            paintStore.invalidateFrameFxCache(layerId, frame);
            paintStore.paintVersion.value++;
          }
        }
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (tool === 'brush') {
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
    // Cursor feedback: when select tool is active, show resize cursors over handles
    if (!isTransforming.current && !isDragging.current && !isErasing.current && !isDrawing.current) {
      const tool = paintStore.activeTool.peek();
      if (tool === 'select') {
        const point = getProjectPoint(e);
        const layerId = getSelectedPaintLayerId();
        if (layerId) {
          const frame = timelineStore.currentFrame.peek();
          const paintFrame = paintStore.getFrame(layerId, frame);
          const selected = paintStore.selectedStrokeIds.peek();
          if (paintFrame && selected.size > 0) {
            const bounds = getSelectionBounds(paintFrame, selected);
            if (bounds) {
              const handle = hitTestHandle(point.x, point.y, bounds);
              const overlay = e.currentTarget as HTMLElement;
              if (handle) {
                overlay.style.cursor = cursorForHandle(handle);
              } else {
                const cx = (bounds.minX + bounds.maxX) / 2;
                const rcy = bounds.minY - 20;
                if (Math.hypot(point.x - cx, point.y - rcy) <= 8) {
                  overlay.style.cursor = 'grab';
                } else {
                  overlay.style.cursor = 'default';
                }
              }
            }
          }
        }
      }
    }

    // Handle path-based eraser drag
    if (isErasing.current) {
      const point = getProjectPoint(e);
      const layerId = getSelectedPaintLayerId();
      if (layerId) {
        const frame = timelineStore.currentFrame.peek();
        const paintFrame = paintStore.getFrame(layerId, frame);
        if (paintFrame) {
          const hitId = findElementAtPoint(paintFrame, point.x, point.y);
          if (hitId && !erasedStrokeIds.current.has(hitId)) {
            paintStore.removeElement(layerId, frame, hitId);
            erasedStrokeIds.current.add(hitId);
            paintStore.invalidateFrameFxCache(layerId, frame);
            paintStore.paintVersion.value++;
          }
        }
      }
      return;
    }

    // Handle stroke transform (resize/rotate)
    if (isTransforming.current) {
      const point = getProjectPoint(e);
      const layerId = getSelectedPaintLayerId();
      if (!layerId) return;
      const frame = timelineStore.currentFrame.peek();
      const paintFrame = paintStore.getFrame(layerId, frame);
      if (!paintFrame) return;

      const selected = paintStore.selectedStrokeIds.peek();
      const center = transformCenter.current;

      if (transformType.current === 'rotate') {
        const newAngle = Math.atan2(point.y - center.y, point.x - center.x);
        const delta = newAngle - transformStartAngle.current;
        transformStartAngle.current = newAngle;
        const cos = Math.cos(delta);
        const sin = Math.sin(delta);

        for (const el of paintFrame.elements) {
          if (!selected.has(el.id)) continue;

          if (el.tool === 'brush' || el.tool === 'eraser') {
            const stroke = el as PaintStroke;
            for (let i = 0; i < stroke.points.length; i++) {
              const dx = stroke.points[i][0] - center.x;
              const dy = stroke.points[i][1] - center.y;
              stroke.points[i] = [
                center.x + dx * cos - dy * sin,
                center.y + dx * sin + dy * cos,
                stroke.points[i][2],
              ];
            }
          } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
            const shape = el as PaintShape;
            const dx1 = shape.x1 - center.x;
            const dy1 = shape.y1 - center.y;
            shape.x1 = center.x + dx1 * cos - dy1 * sin;
            shape.y1 = center.y + dx1 * sin + dy1 * cos;
            const dx2 = shape.x2 - center.x;
            const dy2 = shape.y2 - center.y;
            shape.x2 = center.x + dx2 * cos - dy2 * sin;
            shape.y2 = center.y + dx2 * sin + dy2 * cos;
          } else if (el.tool === 'fill') {
            const fill = el as PaintFill;
            const dx = fill.x - center.x;
            const dy = fill.y - center.y;
            fill.x = center.x + dx * cos - dy * sin;
            fill.y = center.y + dx * sin + dy * cos;
          }
        }
      } else if (transformType.current === 'scale') {
        if (transformCorner.current.length === 1) {
          // Non-uniform edge scale (D-04, D-05, D-06)
          const edge = transformCorner.current;

          // Restore from snapshot before applying absolute scale to prevent exponential compounding
          if (transformSnapshot.current) {
            restoreElementSnapshot(paintFrame.elements, transformSnapshot.current);
          }

          for (const el of paintFrame.elements) {
            if (!selected.has(el.id)) continue;

            if (edge === 'r' || edge === 'l') {
              // Horizontal scale — anchor at opposite edge X
              const anchor = edgeAnchorX.current;
              const origW = edgeOriginalWidth.current;
              if (Math.abs(origW) < 0.001) continue;
              const newW = edge === 'r'
                ? point.x - anchor
                : anchor - point.x;
              const scaleX = newW / origW;
              if (Math.abs(scaleX) < 0.01) continue;  // prevent collapse

              if (el.tool === 'brush' || el.tool === 'eraser') {
                const stroke = el as PaintStroke;
                for (let i = 0; i < stroke.points.length; i++) {
                  stroke.points[i] = [
                    anchor + (stroke.points[i][0] - anchor) * scaleX,
                    stroke.points[i][1],  // Y unchanged
                    stroke.points[i][2],  // pressure unchanged
                  ];
                }
                // D-06: brush size stays fixed — do NOT scale stroke.size
              } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
                const shape = el as PaintShape;
                shape.x1 = anchor + (shape.x1 - anchor) * scaleX;
                shape.x2 = anchor + (shape.x2 - anchor) * scaleX;
              } else if (el.tool === 'fill') {
                const fill = el as PaintFill;
                fill.x = anchor + (fill.x - anchor) * scaleX;
              }
            } else {
              // Vertical scale — anchor at opposite edge Y
              const anchor = edgeAnchorY.current;
              const origH = edgeOriginalHeight.current;
              if (Math.abs(origH) < 0.001) continue;
              const newH = edge === 'b'
                ? point.y - anchor
                : anchor - point.y;
              const scaleY = newH / origH;
              if (Math.abs(scaleY) < 0.01) continue;  // prevent collapse

              if (el.tool === 'brush' || el.tool === 'eraser') {
                const stroke = el as PaintStroke;
                for (let i = 0; i < stroke.points.length; i++) {
                  stroke.points[i] = [
                    stroke.points[i][0],  // X unchanged
                    anchor + (stroke.points[i][1] - anchor) * scaleY,
                    stroke.points[i][2],  // pressure unchanged
                  ];
                }
                // D-06: brush size stays fixed
              } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
                const shape = el as PaintShape;
                shape.y1 = anchor + (shape.y1 - anchor) * scaleY;
                shape.y2 = anchor + (shape.y2 - anchor) * scaleY;
              } else if (el.tool === 'fill') {
                const fill = el as PaintFill;
                fill.y = anchor + (fill.y - anchor) * scaleY;
              }
            }
          }

          // Note: edgeAnchorX/Y and edgeOriginalWidth/Height are captured once on pointerdown
          // and stay fixed throughout the gesture (Pitfall 4 — do NOT recalculate from current bounds)
        } else {
          // Uniform corner scale (existing behavior)
          const newDist = Math.hypot(point.x - center.x, point.y - center.y);
          const scale = newDist / transformStartDist.current;
          transformStartDist.current = newDist;

          for (const el of paintFrame.elements) {
            if (!selected.has(el.id)) continue;

            if (el.tool === 'brush' || el.tool === 'eraser') {
              const stroke = el as PaintStroke;
              for (let i = 0; i < stroke.points.length; i++) {
                stroke.points[i] = [
                  center.x + (stroke.points[i][0] - center.x) * scale,
                  center.y + (stroke.points[i][1] - center.y) * scale,
                  stroke.points[i][2],
                ];
              }
              // Scale brush size proportionally
              stroke.size = Math.max(1, stroke.size * scale);
            } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
              const shape = el as PaintShape;
              shape.x1 = center.x + (shape.x1 - center.x) * scale;
              shape.y1 = center.y + (shape.y1 - center.y) * scale;
              shape.x2 = center.x + (shape.x2 - center.x) * scale;
              shape.y2 = center.y + (shape.y2 - center.y) * scale;
              shape.strokeWidth = Math.max(1, shape.strokeWidth * scale);
            } else if (el.tool === 'fill') {
              const fill = el as PaintFill;
              fill.x = center.x + (fill.x - center.x) * scale;
              fill.y = center.y + (fill.y - center.y) * scale;
            }
          }
        }
      }

      paintStore.markDirty(layerId, frame);
      paintStore.paintVersion.value++;
      paintStore.invalidateFrameFxCache(layerId, frame);
      requestPreview();
      return;
    }

    // Handle select-mode drag (move selected strokes)
    if (isDragging.current && dragStart.current) {
      const point = getProjectPoint(e);
      const dx = point.x - dragStart.current.x;
      const dy = point.y - dragStart.current.y;
      dragStart.current = {x: point.x, y: point.y};

      const layerId = getSelectedPaintLayerId();
      if (!layerId) return;
      const frame = timelineStore.currentFrame.peek();
      const paintFrame = paintStore.getFrame(layerId, frame);
      if (!paintFrame) return;

      const selected = paintStore.selectedStrokeIds.peek();
      for (const el of paintFrame.elements) {
        if (!selected.has(el.id)) continue;

        if (el.tool === 'brush' || el.tool === 'eraser') {
          const stroke = el as PaintStroke;
          // Offset all points
          for (let i = 0; i < stroke.points.length; i++) {
            stroke.points[i] = [
              stroke.points[i][0] + dx,
              stroke.points[i][1] + dy,
              stroke.points[i][2],
            ];
          }
        } else if (el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') {
          const shape = el as PaintShape;
          shape.x1 += dx;
          shape.y1 += dy;
          shape.x2 += dx;
          shape.y2 += dy;
        } else if (el.tool === 'fill') {
          const fill = el as PaintFill;
          fill.x += dx;
          fill.y += dy;
        }
      }

      paintStore.markDirty(layerId, frame);
      paintStore.paintVersion.value++;
      // Invalidate frame FX cache since stroke positions changed
      paintStore.invalidateFrameFxCache(layerId, frame);
      requestPreview();
      return;
    }

    if (!isDrawing.current) return;

    const tool = paintStore.activeTool.peek();
    const isPen = isNativePenActive();

    if (tool === 'brush') {
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
    // Finalize path-based eraser
    if (isErasing.current) {
      isErasing.current = false;
      const erased = erasedStrokeIds.current.size;
      erasedStrokeIds.current = new Set();
      // Re-render FX cache if strokes were erased
      if (erased > 0) {
        const layerId = getSelectedPaintLayerId();
        if (layerId) {
          const frame = timelineStore.currentFrame.peek();
          const paintFrame = paintStore.getFrame(layerId, frame);
          if (paintFrame) {
            const projW = projectStore.width.peek();
            const projH = projectStore.height.peek();
            reRenderFrameFx(paintFrame, layerId, frame, projW, projH);
          }
        }
      }
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch { /* ok */ }
      return;
    }

    // Finalize transform (resize/rotate)
    if (isTransforming.current) {
      // Commit transform undo entry (D-07, D-09)
      if (transformSnapshot.current && transformSnapshot.current.size > 0) {
        const snapLayerId = transformLayerId.current;
        const snapFrame = transformFrame.current;
        const beforeSnap = transformSnapshot.current;
        const paintFrameForSnap = paintStore.getFrame(snapLayerId, snapFrame);
        if (paintFrameForSnap) {
          const selected = paintStore.selectedStrokeIds.peek();
          const afterSnap = captureElementSnapshot(paintFrameForSnap.elements, selected);
          pushAction({
            id: crypto.randomUUID(),
            description: 'Transform elements',
            timestamp: Date.now(),
            undo: () => {
              const f = paintStore.getFrame(snapLayerId, snapFrame);
              if (f) {
                restoreElementSnapshot(f.elements, beforeSnap);
                paintStore.markDirty(snapLayerId, snapFrame);
                paintStore.paintVersion.value++;
                paintStore.invalidateFrameFxCache(snapLayerId, snapFrame);
              }
            },
            redo: () => {
              const f = paintStore.getFrame(snapLayerId, snapFrame);
              if (f) {
                restoreElementSnapshot(f.elements, afterSnap);
                paintStore.markDirty(snapLayerId, snapFrame);
                paintStore.paintVersion.value++;
                paintStore.invalidateFrameFxCache(snapLayerId, snapFrame);
              }
            },
          });
        }
        transformSnapshot.current = null;
      }
      isTransforming.current = false;
      transformType.current = null;
      // Re-render FX cache after transform
      const layerId = getSelectedPaintLayerId();
      if (layerId) {
        const frame = timelineStore.currentFrame.peek();
        const paintFrame = paintStore.getFrame(layerId, frame);
        if (paintFrame) {
          const projW = projectStore.width.peek();
          const projH = projectStore.height.peek();
          reRenderFrameFx(paintFrame, layerId, frame, projW, projH);
        }
      }
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch { /* ok */ }
      requestPreview();
      return;
    }

    // Finalize select-mode drag
    if (isDragging.current) {
      isDragging.current = false;
      dragStart.current = null;

      const dragLayerId = transformLayerId.current;
      const dragFrame = transformFrame.current;

      if (isDuplicating.current) {
        // Alt+drag duplicate: single undo removes all clones (D-03, D-09)
        isDuplicating.current = false;
        const cloneIds = [...duplicateCloneIds.current];
        duplicateCloneIds.current = [];

        const paintFrameForDup = paintStore.getFrame(dragLayerId, dragFrame);
        if (paintFrameForDup && cloneIds.length > 0) {
          // Capture final state of clones for redo
          const cloneIdSet = new Set(cloneIds);
          const finalClones = paintFrameForDup.elements
            .filter(el => cloneIdSet.has(el.id))
            .map(el => structuredClone(el));

          pushAction({
            id: crypto.randomUUID(),
            description: `Duplicate ${cloneIds.length} element(s)`,
            timestamp: Date.now(),
            undo: () => {
              const f = paintStore.getFrame(dragLayerId, dragFrame);
              if (f) {
                f.elements = f.elements.filter(el => !cloneIdSet.has(el.id));
                paintStore.markDirty(dragLayerId, dragFrame);
                paintStore.paintVersion.value++;
                paintStore.invalidateFrameFxCache(dragLayerId, dragFrame);
              }
            },
            redo: () => {
              const f = paintStore.getFrame(dragLayerId, dragFrame);
              if (f) {
                for (const clone of finalClones) {
                  f.elements.push(structuredClone(clone));
                }
                paintStore.markDirty(dragLayerId, dragFrame);
                paintStore.paintVersion.value++;
                paintStore.invalidateFrameFxCache(dragLayerId, dragFrame);
              }
            },
          });
        }
        transformSnapshot.current = null;
      } else if (transformSnapshot.current && transformSnapshot.current.size > 0) {
        // Normal drag: standard snapshot-based undo (from Plan 01)
        const snapLayerId = dragLayerId;
        const snapFrame = dragFrame;
        const beforeSnap = transformSnapshot.current;
        const paintFrameForSnap = paintStore.getFrame(snapLayerId, snapFrame);
        if (paintFrameForSnap) {
          const selected = paintStore.selectedStrokeIds.peek();
          const afterSnap = captureElementSnapshot(paintFrameForSnap.elements, selected);
          pushAction({
            id: crypto.randomUUID(),
            description: 'Transform elements',
            timestamp: Date.now(),
            undo: () => {
              const f = paintStore.getFrame(snapLayerId, snapFrame);
              if (f) {
                restoreElementSnapshot(f.elements, beforeSnap);
                paintStore.markDirty(snapLayerId, snapFrame);
                paintStore.paintVersion.value++;
                paintStore.invalidateFrameFxCache(snapLayerId, snapFrame);
              }
            },
            redo: () => {
              const f = paintStore.getFrame(snapLayerId, snapFrame);
              if (f) {
                restoreElementSnapshot(f.elements, afterSnap);
                paintStore.markDirty(snapLayerId, snapFrame);
                paintStore.paintVersion.value++;
                paintStore.invalidateFrameFxCache(snapLayerId, snapFrame);
              }
            },
          });
        }
        transformSnapshot.current = null;
      }

      // Re-render FX cache after move
      const layerIdForFx = getSelectedPaintLayerId();
      if (layerIdForFx) {
        const frameForFx = timelineStore.currentFrame.peek();
        const paintFrameForFx = paintStore.getFrame(layerIdForFx, frameForFx);
        if (paintFrameForFx) {
          const projW = projectStore.width.peek();
          const projH = projectStore.height.peek();
          reRenderFrameFx(paintFrameForFx, layerIdForFx, frameForFx, projW, projH);
        }
      }
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch { /* ok */ }
      requestPreview();
      return;
    }

    const tool = paintStore.activeTool.peek();
    const layerId = getSelectedPaintLayerId();
    const frame = timelineStore.currentFrame.peek();
    const isPen = isNativePenActive();

    if (tool === 'brush' && isDrawing.current && layerId) {
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
          brushStyle: 'flat' as BrushStyle,  // per D-01: always draw flat
          brushParams: undefined,  // per D-01: FX params applied post-draw
          fxState: 'flat',  // per D-04: initial state is flat
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

    // Clear temp canvas and re-render selection indicators if needed
    const canvas = tempCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Re-render selection indicators (they live on the temp canvas)
    if (tool === 'select') {
      requestPreview();
    }

    // Release pointer capture
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may not be active
    }
  }

  // --- FX application via brushStyle change (per D-06, D-08) ---
  useEffect(() => {
    // Skip if this was triggered by selection sync (not user clicking a style button)
    if (isSyncingStyle.current) return;

    const style = paintStore.brushStyle.value;
    const selected = paintStore.selectedStrokeIds.peek();
    if (selected.size === 0) return;

    const layerId = getSelectedPaintLayerId();
    if (!layerId) return;
    const frame = timelineStore.currentFrame.peek();
    const paintFrame = paintStore.getFrame(layerId, frame);
    if (!paintFrame) return;

    const projW = projectStore.width.peek();
    const projH = projectStore.height.peek();

    if (style === 'flat') {
      // Rollback selected strokes to flat (per D-10)
      let changed = false;
      for (const el of paintFrame.elements) {
        if (el.tool !== 'brush') continue;
        if (!selected.has(el.id)) continue;
        const stroke = el as PaintStroke;
        if (stroke.fxState === 'fx-applied' || stroke.fxState === 'flattened') {
          stroke.brushStyle = 'flat';
          stroke.brushParams = undefined;
          stroke.fxState = 'flat';
          changed = true;
        }
      }
      if (changed) {
        paintStore.invalidateFrameFxCache(layerId, frame);
        reRenderFrameFx(paintFrame, layerId, frame, projW, projH);
        paintStore.markDirty(layerId, frame);
        paintStore.paintVersion.value++;
      }
      return;
    }

    // Apply FX style to selected strokes (per D-08)
    let changed = false;
    for (const el of paintFrame.elements) {
      if (el.tool !== 'brush') continue;
      if (!selected.has(el.id)) continue;
      const stroke = el as PaintStroke;

      stroke.brushStyle = style;
      stroke.brushParams = { ...paintStore.brushFxParams.peek() };
      stroke.fxState = 'fx-applied';
      changed = true;
    }

    if (changed) {
      // Re-render ALL FX strokes on the frame together (spectral mixing!)
      reRenderFrameFx(paintFrame, layerId, frame, projW, projH);
      paintStore.markDirty(layerId, frame);
      paintStore.paintVersion.value++;
    }
  }, [paintStore.brushStyle.value]);

  // --- FX params change (grain, bleed, etc.) — re-apply to selected strokes ---
  useEffect(() => {
    if (isSyncingStyle.current) return;

    const params = paintStore.brushFxParams.value;
    const selected = paintStore.selectedStrokeIds.peek();
    if (selected.size === 0) return;

    const style = paintStore.brushStyle.peek();
    if (style === 'flat') return;  // no FX params for flat

    const layerId = getSelectedPaintLayerId();
    if (!layerId) return;
    const frame = timelineStore.currentFrame.peek();
    const paintFrame = paintStore.getFrame(layerId, frame);
    if (!paintFrame) return;

    let changed = false;
    for (const el of paintFrame.elements) {
      if (el.tool !== 'brush') continue;
      if (!selected.has(el.id)) continue;
      const stroke = el as PaintStroke;
      if (stroke.fxState === 'fx-applied') {
        stroke.brushParams = {...params};
        changed = true;
      }
    }

    if (changed) {
      const projW = projectStore.width.peek();
      const projH = projectStore.height.peek();
      paintStore.invalidateFrameFxCache(layerId, frame);
      reRenderFrameFx(paintFrame, layerId, frame, projW, projH);
    }
  }, [paintStore.brushFxParams.value]);

  // --- Delete selected strokes in select mode (per D-07) ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selected = paintStore.selectedStrokeIds.peek();
        if (selected.size === 0) return;
        const tool = paintStore.activeTool.peek();
        if (tool !== 'select') return;

        const layerId = getSelectedPaintLayerId();
        if (!layerId) return;
        const frame = timelineStore.currentFrame.peek();

        for (const strokeId of selected) {
          paintStore.removeElement(layerId, frame, strokeId);
        }
        paintStore.clearSelection();

        // Re-render frame cache (remaining FX strokes)
        const paintFrame = paintStore.getFrame(layerId, frame);
        if (paintFrame) {
          const projW = projectStore.width.peek();
          const projH = projectStore.height.peek();
          reRenderFrameFx(paintFrame, layerId, frame, projW, projH);
        }

        requestPreview();
        e.preventDefault();
      }

      // Select All shortcut (Cmd/Ctrl+A in select mode)
      if ((e.key === 'a' || e.key === 'A') && (e.metaKey || e.ctrlKey)) {
        const tool = paintStore.activeTool.peek();
        if (tool === 'select') {
          const layerId = getSelectedPaintLayerId();
          if (layerId) {
            const frame = timelineStore.currentFrame.peek();
            const paintFrame = paintStore.getFrame(layerId, frame);
            if (paintFrame) {
              paintStore.clearSelection();
              for (const el of paintFrame.elements) {
                paintStore.selectStroke(el.id);
              }
              requestPreview();
              e.preventDefault();
            }
          }
        }
      }

      // Overlay toggle shortcut (per D-13)
      if (e.key === 'o' || e.key === 'O') {
        paintStore.toggleSequenceOverlay();
        e.preventDefault();
      }

      // Flat/FX preview toggle (F key)
      if (e.key === 'f' || e.key === 'F') {
        if (!e.metaKey && !e.ctrlKey) {
          paintStore.toggleFlatPreview();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // --- Clear selection when switching away from select tool ---
  useEffect(() => {
    const tool = paintStore.activeTool.value;
    if (tool !== 'select') {
      paintStore.clearSelection();
    }
  }, [paintStore.activeTool.value]);

  // --- Re-render preview when selection changes (show/hide selection indicators) ---
  useEffect(() => {
    // Subscribe to selection changes and undo/redo to re-draw indicators
    void paintStore.selectedStrokeIds.value;
    void paintStore.paintVersion.value;
    renderLivePreview();
  }, [paintStore.selectedStrokeIds.value, paintStore.paintVersion.value]);

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
