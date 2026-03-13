/**
 * Blur FX module -- two blur algorithms for the PreviewRenderer.
 *
 * Fast blur: downscale-upscale using Canvas 2D imageSmoothingEnabled bilinear interpolation.
 * HQ blur: StackBlur algorithm for higher quality (per-pixel convolution).
 *
 * Both use cached offscreen canvases to avoid per-frame allocations.
 * NEVER uses ctx.filter -- it is broken in Tauri WebKit on tainted canvases.
 */

// @ts-expect-error -- stackblur-canvas package.json "exports" omits "types" entry; types exist at index.d.ts but TS bundler resolution can't find them
import StackBlur from 'stackblur-canvas';

// --- Cached offscreen canvases for ping-pong downscale ---

let _blurCanvasA: HTMLCanvasElement | null = null;
let _blurCanvasB: HTMLCanvasElement | null = null;

function getBlurCanvas(
  slot: 'A' | 'B',
  w: number,
  h: number,
): {canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D} | null {
  let canvas = slot === 'A' ? _blurCanvasA : _blurCanvasB;
  if (!canvas) {
    canvas = document.createElement('canvas');
    if (slot === 'A') _blurCanvasA = canvas;
    else _blurCanvasB = canvas;
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return {canvas, ctx};
}

/**
 * Convert normalized blur radius (0-1) to pixel radius.
 * Uses quadratic mapping for perceptually linear response.
 */
export function normalizedToPixelRadius(normalized: number, canvasMaxDim: number): number {
  if (normalized <= 0) return 0;
  return Math.max(0, Math.round(normalized * normalized * canvasMaxDim * 0.05));
}

/**
 * Fast blur using iterative downscale-upscale with bilinear interpolation.
 * Low quality but very fast -- suitable for real-time preview.
 *
 * @param source - source canvas to read from
 * @param targetCtx - target context to draw the blurred result onto
 * @param radius - normalized blur radius (0-1)
 * @param width - target width in pixels
 * @param height - target height in pixels
 */
export function applyFastBlur(
  source: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  radius: number,
  width: number,
  height: number,
): void {
  if (radius <= 0) return;

  const passes = Math.max(1, Math.min(4, Math.ceil(radius * 4)));

  // Start: copy source to canvas A at full size
  const slotA = getBlurCanvas('A', width, height);
  if (!slotA) return;
  slotA.ctx.clearRect(0, 0, width, height);
  slotA.ctx.drawImage(source, 0, 0, width, height);

  let currentCanvas = slotA.canvas;
  let currentW = width;
  let currentH = height;

  // Iterative downscale: halve dimensions each pass
  for (let i = 0; i < passes; i++) {
    const nextW = Math.max(1, Math.ceil(currentW / 2));
    const nextH = Math.max(1, Math.ceil(currentH / 2));

    const nextSlot = getBlurCanvas(i % 2 === 0 ? 'B' : 'A', nextW, nextH);
    if (!nextSlot) return;

    nextSlot.ctx.imageSmoothingEnabled = true;
    nextSlot.ctx.clearRect(0, 0, nextW, nextH);
    nextSlot.ctx.drawImage(currentCanvas, 0, 0, currentW, currentH, 0, 0, nextW, nextH);

    currentCanvas = nextSlot.canvas;
    currentW = nextW;
    currentH = nextH;
  }

  // Upscale back to target size with bilinear smoothing
  targetCtx.save();
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.clearRect(0, 0, width, height);
  targetCtx.drawImage(currentCanvas, 0, 0, currentW, currentH, 0, 0, width, height);
  targetCtx.restore();
}

/**
 * High-quality blur using StackBlur algorithm.
 * Higher quality but slower -- used when HQ preview is enabled.
 *
 * Modifies the canvas in-place.
 *
 * @param canvas - canvas to blur in-place
 * @param radius - normalized blur radius (0-1)
 * @param width - canvas width in pixels
 * @param height - canvas height in pixels
 * @param preserveAlpha - if true, blur RGB only (keeps alpha channel intact)
 */
export function applyHQBlur(
  canvas: HTMLCanvasElement,
  radius: number,
  width: number,
  height: number,
  preserveAlpha: boolean,
): void {
  if (radius <= 0) return;

  const pixelRadius = normalizedToPixelRadius(radius, Math.max(width, height));
  if (pixelRadius < 1) return;

  if (preserveAlpha) {
    StackBlur.canvasRGB(canvas, 0, 0, width, height, pixelRadius);
  } else {
    StackBlur.canvasRGBA(canvas, 0, 0, width, height, pixelRadius);
  }
}
