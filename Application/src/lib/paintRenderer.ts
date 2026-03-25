import {getStroke} from 'perfect-freehand';
import {floodFill, hexToRgba} from './paintFloodFill';
import type {PaintFrame, PaintElement, PaintStroke, PaintShape, PaintFill, PaintStrokeOptions} from '../types/paint';
import {renderStyledStrokes} from './brushFxRenderer';

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
  const path = strokeToPath(element.points, element.size, element.options);
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
 * Type guard: check if a paint element is a styled (non-flat) brush stroke
 * that should be routed to the WebGL2 renderer.
 *
 * Narrowing logic:
 * 1. element.tool is safe on PaintElement (all union members have .tool)
 * 2. tool === 'brush' narrows to PaintStroke (only PaintStroke has 'brush')
 * 3. Then .brushStyle access is type-safe on PaintStroke
 */
function isStyledStroke(element: PaintElement): element is PaintStroke {
  // All PaintElement union members have .tool -- no 'in' check needed.
  // Only PaintStroke has tool === 'brush' (eraser also PaintStroke but returns false).
  if (element.tool !== 'brush') return false;
  // After this check, TS narrows element to PaintStroke.
  // Now .brushStyle is safely accessible (optional field on PaintStroke).
  return !!element.brushStyle && element.brushStyle !== 'flat';
}

/**
 * Render accumulated styled strokes via WebGL2 and composite onto Canvas 2D.
 */
function flushStyledStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: PaintStroke[],
  width: number,
  height: number,
): void {
  const glCanvas = renderStyledStrokes(strokes, width, height);
  if (glCanvas) {
    ctx.drawImage(glCanvas, 0, 0);
  } else {
    // WebGL2 unavailable: fall back to flat rendering for all styled strokes
    for (const stroke of strokes) {
      renderStroke(ctx, stroke);
    }
  }
}

/**
 * Render all paint elements for a single frame to a Canvas 2D context.
 *
 * Elements are rendered in order (first element = bottom, last = top).
 * Flat elements (and erasers) use the existing Canvas 2D path unchanged.
 * Styled brush strokes are batched and rendered via the WebGL2 brush FX
 * renderer, then composited back onto the Canvas 2D context.
 *
 * Z-order is maintained: when a flat element follows styled strokes,
 * the styled batch is flushed before rendering the flat element.
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
  // Separate elements into flat (Canvas 2D) and styled (WebGL2) groups
  // IMPORTANT: Maintain rendering order! Elements must composite in their
  // original array order, so we process in order but track styled strokes.
  const styledStrokes: PaintStroke[] = [];

  for (const element of frame.elements) {
    if (isStyledStroke(element)) {
      // Collect styled strokes for batch WebGL2 rendering
      styledStrokes.push(element);
    } else {
      // Render flat elements inline via Canvas 2D (existing path, unchanged)
      // Before rendering flat elements, flush any accumulated styled strokes
      // to maintain correct z-order
      if (styledStrokes.length > 0) {
        flushStyledStrokes(ctx, styledStrokes, width, height);
        styledStrokes.length = 0;
      }
      renderElement(ctx, element, width, height);
    }
  }

  // Flush any remaining styled strokes
  if (styledStrokes.length > 0) {
    flushStyledStrokes(ctx, styledStrokes, width, height);
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
