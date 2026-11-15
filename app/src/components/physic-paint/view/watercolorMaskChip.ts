// ============================================================
//  watercolorMaskChip — the texture row's chip IS the engine's tip
//  (quick-261115-oh9).
//
//  A chip is not a preview drawing: it is the exact 192x192
//  grayscale footprint `buildBrushForStroke` would stamp for the
//  same (response, texture) pair, obtained through `strokeTipData` —
//  the ONE resolution the engine and the bake share. White footprint
//  on a black ground: one ImageData pixel per mask byte as
//  (v, v, v, 255).
//
//  Why no asset path: masks already live in memory as Uint8Array
//  values (compile-time built-ins, project imports registered at
//  open), so a chip is a byte-to-pixel copy — no base64 constant, no
//  image decode, no fetch.
//
//  Cache, bounded by the catalog (three built-ins plus the project's
//  imports): `${responseId}|${textureId ?? ''}|g${maskGeneration()}`.
//  The response id is part of the key because the Default chip
//  follows the selected response; the registry generation is part of
//  it so a mask replaced under an unchanged id can never serve stale
//  bytes. clearMaskChipCache() is the test / registry-reset seam.
//
//  blitMaskChip matches the target bitmap to the cache (the
//  blitStrokeThumb contract); CSS scales the 192px bitmap into the
//  chip's 44px square.
// ============================================================

import { TIP_SIZE, maskGeneration, strokeTipData } from '@efxlab/efx-watercolor';

const chipCache = new Map<string, HTMLCanvasElement>();

/** Response id + texture id + registry generation — the change signal. */
function chipKey(responseId: string, textureId: string | null): string {
  return `${responseId}|${textureId ?? ''}|g${maskGeneration()}`;
}

/**
 * The cached chip bitmap for one (response, texture) pair. The bytes are the
 * engine's own tip bytes: the same call the live and bake paths resolve, so a
 * chip can never show a footprint the engine would not stamp.
 */
export function getMaskChipCanvas(
  responseId: string,
  textureId: string | null,
): HTMLCanvasElement {
  const key = chipKey(responseId, textureId);
  const cached = chipCache.get(key);
  if (cached) return cached;
  const data = strokeTipData(responseId, textureId);
  const canvas = document.createElement('canvas');
  canvas.width = TIP_SIZE;
  canvas.height = TIP_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const image = ctx.createImageData(TIP_SIZE, TIP_SIZE);
    for (let i = 0; i < data.length; i += 1) {
      const value = data[i]!;
      image.data[i * 4] = value;
      image.data[i * 4 + 1] = value;
      image.data[i * 4 + 2] = value;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }
  chipCache.set(key, canvas);
  return canvas;
}

/** Copy the cached chip onto a visible chip canvas (1:1 bitmap match). */
export function blitMaskChip(
  target: HTMLCanvasElement,
  responseId: string,
  textureId: string | null,
): void {
  const chip = getMaskChipCanvas(responseId, textureId);
  const ctx = target.getContext('2d');
  if (!ctx) return;
  // Sizing after getContext keeps the context valid; the guard avoids
  // resetting an already-matched canvas on a re-blit.
  if (target.width !== chip.width) target.width = chip.width;
  if (target.height !== chip.height) target.height = chip.height;
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.drawImage(chip, 0, 0);
}

/** Test seam and registry-change reset: drop every cached chip. */
export function clearMaskChipCache(): void {
  chipCache.clear();
}
