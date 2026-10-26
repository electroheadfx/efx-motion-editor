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
 * - `pigment-alpha`: aquarelle. The live MODE.transparent sheet is OPAQUE
 *   transmittance in storage (white = no pigment); it converts to
 *   straight-alpha pigment (alpha = 1 − min(r,g,b)) and composites over the
 *   base on a white paper fill. The stored result stays the opaque sheet
 *   t' = a*C + (1-a)*t_base — the later one-fond multiply reconstructs the
 *   live pigment composite exactly. Opaque source-over would cover the base
 *   wholesale, and multiply would glaze it (the round-2 bug).
 */
export type RotoAlphaMergeBlend = 'source-over' | 'pigment-alpha';

export async function mergeCachedRotoAlphaFrame(
  baseFrame: Pick<PhysicPaintRenderedFrame, 'bytes'> | null,
  liveAlphaCanvas: HTMLCanvasElement,
  appFrame: number,
  size: RotoAlphaMergeSize,
  mutationId?: number,
  baseCanvas?: HTMLCanvasElement | null,
  blend: RotoAlphaMergeBlend = 'source-over',
): Promise<PhysicPaintRenderedFrame> {
  const output = await mergeRotoAlphaCanvases(baseFrame, liveAlphaCanvas, size, baseCanvas, blend);
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
): Promise<HTMLCanvasElement> {
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Could not merge Roto alpha frames: 2D context unavailable.');

  context.clearRect(0, 0, size.width, size.height);
  if (blend === 'pigment-alpha') {
    // Round 2 law: paper white → cached base → converted live sheet. Over an
    // opaque base this stores t' = a*C + (1-a)*t_base; a partial-alpha base
    // shows paper instead of a black hole (single fond multiply downstream).
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size.width, size.height);
  }
  if (baseCanvas) {
    context.drawImage(baseCanvas, 0, 0, size.width, size.height);
  } else if (baseFrame) {
    const baseImage = await loadCachedRotoBaseImage(baseFrame.bytes);
    context.drawImage(baseImage, 0, 0, size.width, size.height);
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
