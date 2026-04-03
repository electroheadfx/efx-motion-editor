/**
 * Unified blur API -- GPU-first with CPU StackBlur fallback.
 *
 * applyBlur() tries the WebGL2 GPU path first (glBlur.ts).
 * If the GPU is unavailable, falls back to StackBlur (CPU).
 *
 * NEVER uses ctx.filter -- it is broken in Tauri WebKit on tainted canvases.
 */

// @ts-expect-error -- stackblur-canvas package.json "exports" omits "types" entry; types exist at index.d.ts but TS bundler resolution can't find them
import {canvasRGB, canvasRGBA} from 'stackblur-canvas';
import {applyGPUBlur} from './glBlur';

/**
 * Convert normalized blur radius (0-1) to pixel radius.
 * Uses quadratic mapping for perceptually linear response.
 */
export function normalizedToPixelRadius(normalized: number, canvasMaxDim: number): number {
  if (normalized <= 0) return 0;
  return Math.max(0, Math.round(normalized * normalized * canvasMaxDim * 0.05));
}

/**
 * Apply blur to a canvas -- GPU-first with CPU fallback.
 *
 * Tries the WebGL2 two-pass separable Gaussian blur first.
 * If GPU is unavailable (WebGL2 context creation failed),
 * falls back to CPU StackBlur.
 *
 * @param canvas - source canvas to blur
 * @param ctx - canvas 2D context (used for GPU readback via drawImage)
 * @param radius - normalized blur radius (0-1)
 * @param width - canvas width in pixels
 * @param height - canvas height in pixels
 * @param preserveAlpha - if true, blur RGB only (keeps alpha channel intact)
 */
export function applyBlur(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  radius: number,
  width: number,
  height: number,
  preserveAlpha: boolean,
): void {
  if (radius <= 0) return;

  // Try GPU path first
  if (applyGPUBlur(canvas, ctx, radius, width, height, preserveAlpha)) {
    return;
  }

  // CPU fallback: StackBlur
  const pixelRadius = normalizedToPixelRadius(radius, Math.max(width, height));
  if (pixelRadius < 1) return;
  if (preserveAlpha) {
    canvasRGB(canvas, 0, 0, width, height, pixelRadius);
  } else {
    canvasRGBA(canvas, 0, 0, width, height, pixelRadius);
  }
}
