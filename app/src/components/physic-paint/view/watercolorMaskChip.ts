// ============================================================
//  watercolorMaskChip — the texture row's chip IS the engine's tip
//  (quick-261115-oh9).
//
//  A chip is not a preview drawing: it is the exact grayscale
//  footprint `buildBrushForStroke` would stamp for the same
//  (response, texture, rotation) tuple, obtained through
//  `strokeTipData` — the ONE resolution the engine and the bake
//  share. White footprint on a black ground: one ImageData pixel per
//  mask byte as (v, v, v, 255). The canvas edge comes from the BYTES
//  themselves (`Math.round(Math.sqrt(data.length))` — 512 for a
//  machine-library texture, 192 for a procedural response tip), never
//  from a fixed icon constant.
//
//  Why no asset path: masks already live in memory as Uint8Array
//  values (the machine library's decoded WebPs, registered at boot), so
//  a chip is a byte-to-pixel copy — no base64 constant, no image
//  decode, no fetch.
//
//  Rotation (quick 261116-inu / Task 10): the chip shows the texture
//  as the stamp shader would — rotated about the centre by integer
//  DEGREES, smoothed so a rotated mask stays continuous. The chip is
//  display-only: the stroke snapshot, never the library row, is the
//  replay authority.
//
//  Cache, bounded by the machine library's rows: `${responseId}|
//  ${textureId ?? ''}|r${degrees}|g${maskGeneration()}`. The response
//  id is part of the key because the Default chip follows the selected
//  response; the rotation because a rotated chip is a different
//  bitmap; the registry generation so a mask replaced under an
//  unchanged id can never serve stale bytes. clearMaskChipCache() is
//  the test / registry-reset seam.
//
//  blitMaskChip matches the target bitmap to the cache (the
//  blitStrokeThumb contract); CSS scales the bitmap into the chip's
//  square.
// ============================================================

import { maskGeneration, strokeTipData } from '@efxlab/efx-watercolor';

const chipCache = new Map<string, HTMLCanvasElement>();

/** Response id + texture id + rotation + registry generation — the change signal. */
function chipKey(
  responseId: string,
  textureId: string | null,
  textureRotation: number,
): string {
  return `${responseId}|${textureId ?? ''}|r${textureRotation}|g${maskGeneration()}`;
}

/**
 * The cached chip bitmap for one (response, texture, rotation) tuple. The
 * bytes are the engine's own tip bytes: the same call the live and bake paths
 * resolve, so a chip can never show a footprint the engine would not stamp.
 */
export function getMaskChipCanvas(
  responseId: string,
  textureId: string | null,
  textureRotation = 0,
): HTMLCanvasElement {
  const key = chipKey(responseId, textureId, textureRotation);
  const cached = chipCache.get(key);
  if (cached) return cached;
  const data = strokeTipData(responseId, textureId);
  // The mask's OWN edge: an imported texture is 512, a procedural response
  // tip is 192. Never a fixed icon constant — one cannot describe both.
  const edge = Math.max(1, Math.round(Math.sqrt(data.length)));
  const canvas = document.createElement('canvas');
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Source pixels first: one ImageData byte per mask byte as (v, v, v, 255).
    const source = document.createElement('canvas');
    source.width = edge;
    source.height = edge;
    const sourceCtx = source.getContext('2d');
    if (sourceCtx) {
      const image = sourceCtx.createImageData(edge, edge);
      for (let i = 0; i < data.length; i += 1) {
        const value = data[i]!;
        image.data[i * 4] = value;
        image.data[i * 4 + 1] = value;
        image.data[i * 4 + 2] = value;
        image.data[i * 4 + 3] = 255;
      }
      sourceCtx.putImageData(image, 0, 0);
      // Same tip-space rotation as the stamp shader: about the centre, with
      // smoothing so a rotated mask keeps its gradients.
      ctx.imageSmoothingEnabled = true;
      ctx.translate(edge / 2, edge / 2);
      ctx.rotate((textureRotation * Math.PI) / 180);
      ctx.translate(-edge / 2, -edge / 2);
      ctx.drawImage(source, 0, 0);
    }
  }
  chipCache.set(key, canvas);
  return canvas;
}

/** Copy the cached chip onto a visible chip canvas (1:1 bitmap match). */
export function blitMaskChip(
  target: HTMLCanvasElement,
  responseId: string,
  textureId: string | null,
  textureRotation = 0,
): void {
  const chip = getMaskChipCanvas(responseId, textureId, textureRotation);
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
