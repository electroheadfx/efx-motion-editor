import { mergeRotoAlphaCanvases, type RotoAlphaMergeSize } from './physicsPaintRotoAlphaMerge';
import { encodeRotoFrameFromCanvas, type RenderedFramePayload } from './rotoCanvasFrames';

export interface RotoScriptRebakeCompositeInput {
  /** The group SOURCE key payload at the exact phase offset (pixel-only base). */
  durableBaseBytes: Uint8Array;
  /** The raw single-frame aquarelle bake (the SCRIPT layer, white = no pigment). */
  sheetBytes: Uint8Array;
  appFrame: number;
  /** Full-frame canvas size of both inputs and the output. */
  size: RotoAlphaMergeSize;
}

/**
 * 261026 (watercolor-loop-render-split, axis 2): compose a script re-bake over
 * the durable pixel-only base with the SAME multiply law the live capture
 * uses. The aquarelle bake is MODE.transparent OPAQUE transmittance — white
 * (no pigment) leaves the base untouched, pigment tints it. Publishing the raw
 * bake over a group frame would erase the rail's cached paint (the pre-revert
 * destruction), so the publish callback must use this composite instead.
 *
 * Returns null on any decode/merge/encode failure so the caller fails closed —
 * a stroke-only sheet must never reach a group base.
 */
export async function composeRotoScriptRebakeFrame(
  input: RotoScriptRebakeCompositeInput,
): Promise<RenderedFramePayload | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  let sheetBitmap: ImageBitmap | null = null;
  try {
    // 261001-cache3: pin premultiply AT bitmap creation, same as the cached
    // base decode and physicPaintStore._decodeWebpToBitmap.
    sheetBitmap = await createImageBitmap(
      new Blob([input.sheetBytes as Uint8Array<ArrayBuffer>], { type: 'image/webp' }),
      { premultiplyAlpha: 'premultiply' },
    );
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = input.size.width;
    sheetCanvas.height = input.size.height;
    const context = sheetCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(sheetBitmap, 0, 0, input.size.width, input.size.height);
    const merged = await mergeRotoAlphaCanvases(
      { bytes: input.durableBaseBytes },
      sheetCanvas,
      input.size,
      undefined,
      'multiply',
    );
    return await encodeRotoFrameFromCanvas(merged, input.appFrame);
  } catch {
    return null;
  } finally {
    sheetBitmap?.close();
  }
}
