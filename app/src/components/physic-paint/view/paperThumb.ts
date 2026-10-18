// ============================================================
//  paperThumb — the oracle paper-card swatch, ported app-side
//  (261018-f15 B2). The look comes from the read-only playground
//  `engine/shaders.ts` paperSwatchFS: the engine paper sheet with
//  a granulating ultramarine wash across one diagonal corner.
//
//  Paint once per (id, size) into an HTMLCanvasElement, cache it,
//  and blit (drawImage) onto the visible cell canvas. Never
//  toDataURL / toBlob (52.1 D-19). Same idiom as
//  watercolorStrokeThumb.getStrokeThumb.
//
//  `paperThumbPainter` is the spyable seam: getPaperThumb paints
//  through it so a pin can assert one invocation per (id, size).
// ============================================================

import { PAPER_UNITS } from '@efxlab/efx-watercolor/papers';
import { getEnginePaperSheet } from '../../../lib/enginePaperSheet';

/** Thumb window: a ~256-paper-unit-tall slice of the sheet (PaperPicker idiom). */
const THUMB_WINDOW_UNITS = 256;

const thumbCache = new Map<string, HTMLCanvasElement>();

/**
 * paperSwatchFS wash, ported to Canvas 2D. Per texel:
 *   x = u*0.62 + (1-v)*0.38 + (paper.g - 0.5)*0.03
 *   wash past smoothstep(0.6, 0.605, x)
 *   pigment = pow(rgb(0.3, 0.38, 0.72), gran * tide)
 *   gran = 1 + (0.5 - paper.g) * 2.4
 *   tide = 1 + 0.5 * exp(-(x - 0.6) * 90) * wash   (bright edge line)
 * The sheet pixel's green channel is the paper.g sample.
 */
function applyPaperWash(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  for (let py = 0; py < height; py++) {
    const v = (py + 0.5) / height;
    for (let px = 0; px < width; px++) {
      const u = (px + 0.5) / width;
      const idx = (py * width + px) * 4;
      const paperG = data[idx + 1] / 255;
      const x = u * 0.62 + (1 - v) * 0.38 + (paperG - 0.5) * 0.03;
      // smoothstep(0.6, 0.605, x) — a sharp edge at x ≈ 0.6.
      const wash = x <= 0.6 ? 0 : x >= 0.605 ? 1 : (x - 0.6) / 0.005;
      if (wash <= 0) continue;
      const gran = 1 + (0.5 - paperG) * 2.4;
      const tide = 1 + 0.5 * Math.exp(-(x - 0.6) * 90) * wash;
      const exponent = gran * tide;
      const mulR = Math.pow(0.3, exponent);
      const mulG = Math.pow(0.38, exponent);
      const mulB = Math.pow(0.72, exponent);
      data[idx] = data[idx] * (1 - wash + wash * mulR);
      data[idx + 1] = data[idx + 1] * (1 - wash + wash * mulG);
      data[idx + 2] = data[idx + 2] * (1 - wash + wash * mulB);
    }
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Spyable paint seam. getPaperThumb paints through this object so a
 * pin can count painter invocations without patching the module.
 */
export const paperThumbPainter = {
  /** Procedural papers: engine sheet + the diagonal ultramarine wash. */
  paintProcedural(canvas: HTMLCanvasElement, id: string, width: number, height: number): void {
    const sheet = getEnginePaperSheet(id, width, height, PAPER_UNITS / THUMB_WINDOW_UNITS);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (sheet) {
      ctx.drawImage(sheet, 0, 0, width, height);
      applyPaperWash(ctx, width, height);
    }
  },
  /**
   * Real jpg scans: decode-once (content-keyed by source) and draw the
   * image into the cache — no wash required (efx-preact-reactivity rule 8).
   */
  paintReal(canvas: HTMLCanvasElement, source: string, width: number, height: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = source;
  },
};

/** Decode-once cache for real jpg sources (content-keyed). */
const realImageCache = new Map<string, HTMLImageElement>();

/**
 * Paint-once thumb cache, keyed by (id, size). The first call paints
 * the swatch; later calls return the same HTMLCanvasElement (never
 * repaint, never serialize).
 */
export function getPaperThumb(
  id: string,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  const key = `${id}:${width}x${height}`;
  const cached = thumbCache.get(key);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // Procedural ids paint sheet + wash; real ids are jpg scans.
  if (id.startsWith('paper/real-') || /\.(jpe?g|png)$/i.test(id)) {
    const source = id.startsWith('paper/real-') ? realSourceFor(id) : id;
    if (source) paperThumbPainter.paintReal(canvas, source, width, height);
  } else {
    paperThumbPainter.paintProcedural(canvas, id, width, height);
  }
  thumbCache.set(key, canvas);
  return canvas;
}

/** Shipped real-scan sources (keep in step with PAPER_LIBRARY real entries). */
function realSourceFor(id: string): string | null {
  const match = /^paper\/real-(\d+)$/.exec(id);
  if (!match) return null;
  return `/img/paper_${match[1]}.jpg`;
}

/** Blit a cached thumb onto a visible cell canvas. */
export function blitPaperThumb(
  target: HTMLCanvasElement,
  id: string,
  width: number,
  height: number,
): void {
  const thumb = getPaperThumb(id, width, height);
  const ctx = target.getContext('2d');
  if (!ctx || !thumb) return;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(thumb, 0, 0);
}

/** Test seam: drop every cached thumb (paints again on next get). */
export function clearPaperThumbCache(): void {
  thumbCache.clear();
  realImageCache.clear();
}
