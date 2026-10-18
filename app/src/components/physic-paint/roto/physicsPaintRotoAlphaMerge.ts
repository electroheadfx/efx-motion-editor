import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { encodeRotoFrameFromCanvas } from './rotoCanvasFrames';

export interface RotoAlphaMergeSize {
  width: number;
  height: number;
}

/**
 * How the live sheet meets the cached base.
 * - `source-over` (default): engine-1 real-alpha strokes over the base.
 * - `multiply`: aquarelle MODE.transparent transmittance (opaque) glazes the
 *   base — white (no pigment) leaves the base untouched, pigment tints it.
 *   Source-over would let the opaque sheet cover the base entirely
 *   (watercolor-clears-cached-paint).
 */
export type RotoAlphaMergeBlend = 'source-over' | 'multiply';

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
  if (baseCanvas) {
    context.drawImage(baseCanvas, 0, 0, size.width, size.height);
  } else if (baseFrame) {
    const baseImage = await loadCachedRotoBaseImage(baseFrame.bytes);
    context.drawImage(baseImage, 0, 0, size.width, size.height);
  }
  context.globalCompositeOperation = blend;
  context.drawImage(scriptAlphaCanvas, 0, 0, size.width, size.height);
  context.globalCompositeOperation = 'source-over';
  return output;
}

function loadCachedRotoBaseImage(bytes: Uint8Array): Promise<ImageBitmap> {
  // 261001-cache3: pin premultiply AT bitmap creation, same as the 52.1 fix in
  // physicPaintStore._decodeWebpToBitmap. drawImage only ever consumes
  // premultiplied data; a 'default'/'none'-flagged bitmap is drawn AS IF
  // premultiplied and every semi-transparent grain pixel washes toward white
  // at the same alpha. Harmless where the UA already premultiplies.
  return createImageBitmap(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'image/webp' }), { premultiplyAlpha: 'premultiply' });
}
