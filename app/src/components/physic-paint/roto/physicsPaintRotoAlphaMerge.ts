import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { stripOpaqueWhiteMatte } from '../../../lib/opaqueWhiteMatte';
import { transmittanceSourceToPigmentAlpha } from '../../../lib/rasterAlpha';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';

export interface RotoAlphaMergeSize {
  width: number;
  height: number;
}

/**
 * How the live sheet meets the cached base.
 * - `source-over` (default): engine-1 real-alpha strokes over the base.
 * - `pigment-alpha`: aquarelle (2026-10-26 round 2). The live MODE.transparent
 *   sheet is OPAQUE transmittance in storage (white = no pigment); it converts
 *   to straight-alpha pigment (alpha = 1 − min(r,g,b)) and composites over the
 *   base on a white paper fill. The stored result stays the opaque sheet
 *   t' = a*C + (1-a)*t_base.
 * - `coverage-composite` (2026-11-21, the artist's live-vs-committed report):
 *   THE ENGINE'S OWN DAB LAW. A dab REPLACES pigment — `ink <- ink*(1-a) +
 *   C*a` — so across the sheet the committed base's remaining share is exactly
 *   `1 - cover` (the coverage channel is the union of every dab's a). Stored in
 *   linear light: t' = t_sheet x t_base^(1 - cover). A full-core dab
 *   (cover 1) replaces the base; a bristle gap (cover 0) keeps it. This is
 *   what a full-script re-bake produces and what the artist's re-render shows
 *   (#142) — NOT a film multiply, which reads dark.
 */
export type RotoAlphaMergeBlend = 'source-over' | 'pigment-alpha' | 'coverage-composite';

/**
 * Lookup tables for the coverage composite, built once. `pow` is a 64 KiB
 * Float32 table over (base byte, cover byte): srgbToLinear(base/255) **
 * (1 - cover/255). `sheetLinear` and `encode` avoid per-pixel gamma math.
 */
let coverageLuts: {
  pow: Float32Array;
  sheetLinear: Float64Array;
  encode: Uint8Array;
} | null = null;
function coverageCompositeLuts() {
  if (coverageLuts) return coverageLuts;
  const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
  const linear = new Float64Array(256);
  for (let i = 0; i < 256; i += 1) linear[i] = toLinear(i / 255);
  const pow = new Float32Array(256 * 256);
  for (let base = 0; base < 256; base += 1) {
    for (let cov = 0; cov < 256; cov += 1) {
      pow[base * 256 + cov] = linear[base] ** (1 - cov / 255);
    }
  }
  const encode = new Uint8Array(4096);
  for (let i = 0; i < 4096; i += 1) {
    encode[i] = Math.max(0, Math.min(255, Math.round(toSrgb(i / 4095) * 255)));
  }
  coverageLuts = { pow, sheetLinear: linear, encode };
  return coverageLuts;
}

export async function mergeCachedRotoAlphaFrame(
  baseFrame: Pick<PhysicPaintRenderedFrame, 'bytes'> | null,
  liveAlphaCanvas: HTMLCanvasElement,
  appFrame: number,
  size: RotoAlphaMergeSize,
  mutationId?: number,
  baseCanvas?: HTMLCanvasElement | null,
  blend: RotoAlphaMergeBlend = 'source-over',
  coverageCanvas?: HTMLCanvasElement | null,
): Promise<PhysicPaintRenderedFrame> {
  const output = await mergeRotoAlphaCanvases(baseFrame, liveAlphaCanvas, size, baseCanvas, blend, coverageCanvas);
  return encodeRotoFrameFromCanvas(output, appFrame, undefined, mutationId);
}

export async function mergeRotoAlphaCanvases(
  baseFrame: Pick<PhysicPaintRenderedFrame, 'bytes'> | null,
  scriptAlphaCanvas: HTMLCanvasElement,
  size: RotoAlphaMergeSize,
  // 261003-erase-uat (B): the engine's ERASED copy of the cached paint. When a
  // pixel erase punched the preview base, merging the original cached bytes
  // resurrects the removed paint — draw the erased layer instead.
  baseCanvas?: HTMLCanvasElement | null,
  blend: RotoAlphaMergeBlend = 'source-over',
  coverageCanvas?: HTMLCanvasElement | null,
): Promise<HTMLCanvasElement> {
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not merge Roto alpha frames: 2D context unavailable.');

  context.clearRect(0, 0, size.width, size.height);
  if (blend === 'pigment-alpha' || blend === 'coverage-composite') {
    // Round 2 law / coverage law: paper white (the no-pigment identity) →
    // cached base → the live sheet. A partial-alpha base shows paper instead
    // of a black hole (single fond multiply downstream).
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
  }
  if (baseCanvas) {
    context.drawImage(baseCanvas, 0, 0, size.width, size.height);
  } else if (baseFrame) {
    const baseImage = await loadCachedRotoBaseImage(baseFrame.bytes);
    context.drawImage(baseImage, 0, 0, size.width, size.height);
  }
  if (blend === 'coverage-composite') {
    // 2026-11-21: THE ENGINE'S OWN DAB LAW. A dab replaces pigment with its
    // coverage `a` (`ink <- ink*(1-a) + C*a`); across the sheet the committed
    // base survives by exactly `1 - cover`. In linear light the stored sheet is
    //   t' = t_sheet x t_base^(1 - cover)
    // — a full-core dab (cover 1) replaces the base, a bristle gap (cover 0)
    // keeps it. That is the blended yellow-over-blue the re-render shows.
    // The sheet and the coverage are opaque rasters from the same engine state;
    // drawn over white so a partial raster still reads as transmittance.
    // Fail-open (no coverage / no readback) to the raw sheet: a merge missing
    // its paint is worse than an unconverted sheet.
    const scratchOf = (source: CanvasImageSource): HTMLCanvasElement | null => {
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size.width, size.height);
      ctx.drawImage(source, 0, 0, size.width, size.height);
      return canvas;
    };
    const sheetCanvas = scratchOf(scriptAlphaCanvas);
    const coverCanvas = coverageCanvas ? scratchOf(coverageCanvas) : null;
    const composed = (() => {
      if (!sheetCanvas || !coverCanvas) return null;
      const sheetContext = sheetCanvas.getContext('2d', { willReadFrequently: true });
      const coverContext = coverCanvas.getContext('2d', { willReadFrequently: true });
      if (!sheetContext || !coverContext || typeof context.getImageData !== 'function' || typeof sheetContext.getImageData !== 'function' || typeof coverContext.getImageData !== 'function') return null;
      try {
        const base = context.getImageData(0, 0, size.width, size.height);
        const sheet = sheetContext.getImageData(0, 0, size.width, size.height);
        const cover = coverContext.getImageData(0, 0, size.width, size.height);
        const { pow, sheetLinear, encode } = coverageCompositeLuts();
        const b = base.data;
        const s = sheet.data;
        const c = cover.data;
        for (let i = 0; i < b.length; i += 4) {
          // cover rides the coverage raster's red channel (exportCoverageCanvas).
          const cov = c[i];
          for (let k = 0; k < 3; k += 1) {
            const linear = sheetLinear[s[i + k]] * pow[b[i + k] * 256 + cov];
            b[i + k] = encode[Math.min(4095, Math.max(0, Math.round(linear * 4095)))];
          }
          b[i + 3] = 255;
        }
        return base;
      } catch {
        return null;
      }
    })();
    if (composed) {
      context.putImageData(composed, 0, 0);
    } else {
      context.globalCompositeOperation = 'source-over';
      context.drawImage(scriptAlphaCanvas, 0, 0, size.width, size.height);
    }
    context.globalCompositeOperation = 'source-over';
    return output;
  }
  // Fail-open to the raw sheet when the readback is unavailable: a merge
  // missing its paint is worse than an unconverted (still opaque) sheet.
  const sheet = blend === 'pigment-alpha'
    ? (transmittanceSourceToPigmentAlpha(scriptAlphaCanvas) ?? scriptAlphaCanvas)
    : scriptAlphaCanvas;
  context.globalCompositeOperation = 'source-over';
  context.drawImage(sheet, 0, 0, size.width, size.height);
  context.globalCompositeOperation = 'source-over';
  return output;
}

async function loadCachedRotoBaseImage(bytes: Uint8Array): Promise<CanvasImageSource> {
  // 261001-cache3: pin premultiply AT bitmap creation, same as the 52.1 fix in
  // physicPaintStore._decodeWebpToBitmap. drawImage only ever consumes
  // premultiplied data; a 'default'/'none'-flagged bitmap is drawn AS IF
  // premultiplied and every semi-transparent grain pixel washes toward white
  // at the same alpha. Harmless where the UA already premultiplies.
  const bitmap = await createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/webp' }), { premultiplyAlpha: 'premultiply' });
  // studio-multi-track-only-active: a legacy cached base can carry the engine's
  // white background. Merging it would re-bake the matte into every new cache,
  // so repair the base before it becomes the next merge source.
  try {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    // Capability gate: a platform without pixel readback (or a test double)
    // passes the base through untouched — the repair can never alter pixels it
    // cannot read.
    if (!context || typeof context.getImageData !== 'function' || typeof context.putImageData !== 'function') {
      return bitmap;
    }
    context.drawImage(bitmap, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    if (stripOpaqueWhiteMatte(data.data, canvas.width, canvas.height)) {
      context.putImageData(data, 0, 0);
    }
    bitmap.close();
    return canvas;
  } catch {
    return bitmap;
  }
}
