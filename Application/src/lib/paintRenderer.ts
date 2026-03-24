import {getStroke} from 'perfect-freehand';
import type {PaintFrame, PaintElement, PaintStroke, PaintShape, PaintStrokeOptions} from '../types/paint';

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
  const outline = getStroke(points, {
    size,
    thinning: options.thinning,
    smoothing: options.smoothing,
    streamline: options.streamline,
    simulatePressure: options.simulatePressure,
    last: true,
  });

  if (outline.length < 2) return null;

  const path = new Path2D();
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1]);
  }
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
 * Render all paint elements for a single frame to a Canvas 2D context.
 *
 * Elements are rendered in order (first element = bottom, last = top).
 * Each element is wrapped in save/restore to isolate alpha and composite changes.
 *
 * @param ctx - The canvas 2D rendering context to draw on
 * @param frame - The PaintFrame containing elements to render
 * @param _width - Canvas width (reserved for future use, e.g. fill rendering)
 * @param _height - Canvas height (reserved for future use, e.g. fill rendering)
 */
export function renderPaintFrame(
  ctx: CanvasRenderingContext2D,
  frame: PaintFrame,
  _width: number,
  _height: number,
): void {
  for (const element of frame.elements) {
    renderElement(ctx, element);
  }
}

/**
 * Render a single PaintElement to a canvas context.
 * Dispatches to the appropriate renderer based on element tool type.
 */
function renderElement(ctx: CanvasRenderingContext2D, element: PaintElement): void {
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
      // Fill elements are pre-rasterized as ImageData.
      // Fill rendering will be implemented in Plan 06.
      break;
  }
}
