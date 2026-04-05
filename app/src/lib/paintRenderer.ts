import {getStroke} from 'perfect-freehand';
import {floodFill, hexToRgba} from './paintFloodFill';
import {sampleBezierPath} from './bezierPath';
import type {PaintFrame, PaintElement, PaintStroke, PaintShape, PaintFill, PaintStrokeOptions} from '../types/paint';
import {paintStore} from '../stores/paintStore';

/** Legacy pressure easing presets → curve exponent mapping */
const LEGACY_EASING_CURVES: Record<string, number> = {
  linear: 1.0,
  gentle: 0.5,
  firm: 2.0,
};

/**
 * Convert stroke points to a Path2D outline using perfect-freehand.
 * Returns null if the outline has fewer than 2 points.
 *
 * Exported for reuse in onion skinning preview.
 */
export function strokeToPath(
  points: [number, number, number][],
  size: number,
  options: PaintStrokeOptions,
): Path2D | null {
  // Resolve pressure curve: prefer numeric pressureCurve, fall back to legacy string preset
  const curveExponent = options.pressureCurve
    ?? LEGACY_EASING_CURVES[options.pressureEasing ?? 'linear']
    ?? 1.0;
  const easing = (p: number) => Math.pow(p, curveExponent);
  const taperStart = options.taperStart ?? 0;
  const taperEnd = options.taperEnd ?? 0;

  const outline = getStroke(points, {
    size,
    thinning: options.thinning,
    smoothing: options.smoothing,
    streamline: options.streamline,
    simulatePressure: options.simulatePressure,
    easing,
    start: taperStart > 0 ? {
      taper: taperStart === -1 ? true : taperStart,
      cap: true,
    } : {cap: true},
    end: taperEnd > 0 ? {
      taper: taperEnd === -1 ? true : taperEnd,
      cap: true,
    } : {cap: true},
    last: true,
  });

  if (outline.length < 2) return null;

  // Use quadratic bezier curves through midpoints for smooth outlines.
  // Straight lineTo produces angular/faceted strokes at large brush sizes.
  const path = new Path2D();
  const len = outline.length;
  path.moveTo(outline[0][0], outline[0][1]);

  for (let i = 0; i < len - 1; i++) {
    const curr = outline[i];
    const next = outline[i + 1];
    // Midpoint between current and next
    const mx = (curr[0] + next[0]) / 2;
    const my = (curr[1] + next[1]) / 2;
    path.quadraticCurveTo(curr[0], curr[1], mx, my);
  }
  // Final segment to close back to the last point
  const last = outline[len - 1];
  path.lineTo(last[0], last[1]);
  path.closePath();
  return path;
}

/**
 * Render a single PaintStroke element (brush or eraser) to a canvas context.
 */
function renderStroke(ctx: CanvasRenderingContext2D, element: PaintStroke): void {
  // If stroke has bezier anchors, re-sample to points for perfect-freehand rendering
  const points = element.anchors
    ? sampleBezierPath(element.anchors, 2.0, element.closedPath)
    : element.points;
  const path = strokeToPath(points, element.size, element.options);
  if (!path) return;

  ctx.save();
  if (element.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000000';
  } else {
    ctx.globalAlpha = element.opacity;
    ctx.fillStyle = element.color;
  }
  ctx.fill(path);
  ctx.restore();
}

/**
 * Render a single PaintShape element (line, rect, ellipse) to a canvas context.
 */
function renderShape(ctx: CanvasRenderingContext2D, element: PaintShape): void {
  ctx.save();
  ctx.globalAlpha = element.opacity;

  // Apply rotation around shape center if present
  const rot = element.rotation || 0;
  if (rot !== 0) {
    const cx = (element.x1 + element.x2) / 2;
    const cy = (element.y1 + element.y2) / 2;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.translate(-cx, -cy);
  }

  switch (element.tool) {
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(element.x1, element.y1);
      ctx.lineTo(element.x2, element.y2);
      ctx.strokeStyle = element.color;
      ctx.lineWidth = element.strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
      break;
    }
    case 'rect': {
      const x = Math.min(element.x1, element.x2);
      const y = Math.min(element.y1, element.y2);
      const w = Math.abs(element.x2 - element.x1);
      const h = Math.abs(element.y2 - element.y1);
      if (element.filled) {
        ctx.fillStyle = element.color;
        ctx.fillRect(x, y, w, h);
      } else {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.strokeWidth;
        ctx.strokeRect(x, y, w, h);
      }
      break;
    }
    case 'ellipse': {
      const cx = (element.x1 + element.x2) / 2;
      const cy = (element.y1 + element.y2) / 2;
      const rx = Math.abs(element.x2 - element.x1) / 2;
      const ry = Math.abs(element.y2 - element.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      if (element.filled) {
        ctx.fillStyle = element.color;
        ctx.fill();
      } else {
        ctx.strokeStyle = element.color;
        ctx.lineWidth = element.strokeWidth;
        ctx.stroke();
      }
      break;
    }
  }

  ctx.restore();
}

/**
 * Render all paint elements for a single frame to a Canvas 2D context.
 *
 * Elements are rendered in order (first element = bottom, last = top).
 * Each element is wrapped in save/restore to isolate alpha and composite changes.
 *
 * @param ctx - The canvas 2D rendering context to draw on
 * @param frame - The PaintFrame containing elements to render
 * @param width - Canvas width (used for fill rendering)
 * @param height - Canvas height (used for fill rendering)
 */
export function renderPaintFrame(
  ctx: CanvasRenderingContext2D,
  frame: PaintFrame,
  width: number,
  height: number,
): void {
  for (const element of frame.elements) {
    if (element.visible === false) continue;  // D-05: skip hidden elements
    renderElement(ctx, element, width, height);
  }
}

/**
 * Render paint frame with solid background (per D-11) and frame-level FX cache.
 *
 * Rendering order:
 * 1. Solid background fill (paintBgColor)
 * 2. Flat strokes via Canvas2D (strokeToPath)
 * 3. Frame-level FX cache via single drawImage() if available
 *    (all FX strokes were batch-rendered together by p5.brush for spectral mixing)
 * 4. Falls back to renderPaintFrame() if no frame cache exists yet
 *
 * @param layerId - Optional layer ID for frame cache lookup
 * @param frameNum - Optional frame number for frame cache lookup
 */
export function renderPaintFrameWithBg(
  ctx: CanvasRenderingContext2D,
  frame: PaintFrame,
  width: number,
  height: number,
  layerId?: string,
  frameNum?: number,
): void {
  // Paint background per D-17: transparent for flat mode, user-configurable
  const bgColor = paintStore.paintBgColor.peek();
  if (bgColor === 'transparent') {
    ctx.clearRect(0, 0, width, height);
  } else {
    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // Flat preview mode: skip FX cache, render everything as flat
  if (paintStore.showFlatPreview.peek()) {
    renderPaintFrame(ctx, frame, width, height);
    return;
  }

  // Check for frame-level FX cache (all FX strokes pre-rendered together)
  let hasFrameCache = false;
  if (layerId !== undefined && frameNum !== undefined) {
    const fxCache = paintStore.getFrameFxCache(layerId, frameNum);
    if (fxCache) {
      // Render flat strokes first (Canvas2D), then overlay the FX cache
      renderFlatElements(ctx, frame, width, height);
      ctx.drawImage(fxCache, 0, 0);
      hasFrameCache = true;
    }
  }

  if (!hasFrameCache) {
    // No frame cache -- render all elements normally (flat via Canvas2D)
    renderPaintFrame(ctx, frame, width, height);
  }
}

/**
 * Render only flat elements (non-FX strokes, shapes, fills, erasers).
 * Used when frame-level FX cache handles all FX-applied strokes separately.
 */
function renderFlatElements(
  ctx: CanvasRenderingContext2D,
  frame: PaintFrame,
  width: number,
  height: number,
): void {
  for (const el of frame.elements) {
    if (el.visible === false) continue;  // D-05: skip hidden elements
    // Skip FX-applied strokes -- they're in the frame cache
    if (el.tool === 'brush') {
      const stroke = el as PaintStroke;
      if (stroke.fxState === 'fx-applied' || stroke.fxState === 'flattened') {
        continue;
      }
    }
    // Render flat strokes, erasers, shapes, fills via existing Canvas2D path
    renderElement(ctx, el, width, height);
  }
}

/**
 * Render a single PaintFill element by re-executing flood fill at render time.
 * Deterministic given prior elements already rendered to the context.
 */
function renderFill(ctx: CanvasRenderingContext2D, element: PaintFill, width: number, height: number): void {
  const imgData = ctx.getImageData(0, 0, width, height);
  const rgba = hexToRgba(element.color, element.opacity);
  floodFill(imgData, Math.round(element.x), Math.round(element.y), rgba, element.tolerance);
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Render a single PaintElement to a canvas context.
 * Dispatches to the appropriate renderer based on element tool type.
 */
function renderElement(ctx: CanvasRenderingContext2D, element: PaintElement, width: number, height: number): void {
  switch (element.tool) {
    case 'brush':
    case 'eraser':
      renderStroke(ctx, element as PaintStroke);
      break;
    case 'line':
    case 'rect':
    case 'ellipse':
      renderShape(ctx, element as PaintShape);
      break;
    case 'fill':
      renderFill(ctx, element as PaintFill, width, height);
      break;
  }
}
