import { conditionHeightMap } from '@efxlab/efx-physic-paint';
import { getProjectPaperTextureImage, normalizeGrainScale } from './projectPaperRaster';

// 260925-iy6 — the dynamic post-bake paper pass.
//
// 9a (260925-dso) deleted the bake-time grain/emboss raster passes; this module
// re-adds the tooth where it belongs: the composite stage, driven by the chosen
// paper. The signed height model s = (h - 0.5) * 2 * strength is evaluated ONCE
// at TILE BUILD time and encoded into two precomputed maps:
//
//   valley — multiply map, floor at the PAPER'S OWN TINT (never black: the
//            locked hole-color semantics — valleys darken toward the paper tone)
//   peak   — lighten map, tint-scaled fiber lift
//
// Application is drawImage + globalCompositeOperation only (GPU), so the frame
// path stays real-time — no per-frame pixel work, ever (hard guardrail).
//
// Export parity is structural: the SAME routine, tiles, and parameters serve
// canvas and export because both consume the one `_resolveFlattenedFrame`
// record (single seam — the dual-pipeline failure 9a cleaned up must not
// return). The routine takes a target 2D context + width/height and never
// reaches for a global canvas.

/** One precomputed tooth tile pair for a (paper, size, scale, strength) key. */
export interface PaperPassTile {
  readonly valley: HTMLCanvasElement;
  readonly peak: HTMLCanvasElement;
}

/** Entry-count bound: sizes/scales/strengths are finite but unbounded in theory. */
const TILE_CACHE_ENTRY_LIMIT = 12;
/** Footprint bound: 12 full-HD entries would be ~200MB in a WKWebView. */
const TILE_CACHE_BYTE_BUDGET = 64 * 1024 * 1024;

interface CachedTile {
  readonly tile: PaperPassTile;
  /** width * height * 8 — valley + peak RGBA maps. */
  readonly bytes: number;
}

const tileCache = new Map<string, CachedTile>();

/**
 * Oldest-insertion-first eviction (Map order) whenever either bound is
 * exceeded after an insert. The just-inserted entry is never evicted — an
 * entry larger than the whole budget stays as the sole occupant.
 */
function evictOverBounds(freshKey: string): void {
  const totalBytes = () => {
    let total = 0;
    for (const entry of tileCache.values()) total += entry.bytes;
    return total;
  };
  while (tileCache.size > TILE_CACHE_ENTRY_LIMIT || totalBytes() > TILE_CACHE_BYTE_BUDGET) {
    let evicted = false;
    for (const key of tileCache.keys()) {
      if (key === freshKey) continue;
      tileCache.delete(key);
      evicted = true;
      break;
    }
    if (!evicted) break;
  }
}

/**
 * Encode the signed height field into the valley (multiply) and peak (lighten)
 * maps. Evaluated at BUILD time only — the frame path never runs this.
 *
 * Per pixel: s = (h - 0.5) * 2 * strength; v = max(0, -s); u = max(0, s);
 * valley = round(255 - v * (255 - tint)) — the floor is the paper's own tone;
 * peak = round(u * tint) — the lift rides the paper's own tone;
 * alpha 255 everywhere (straight-alpha tiles, D-02).
 */
export function encodePassTiles(
  height: Float32Array,
  width: number,
  heightPx: number,
  strength: number,
  tint: { r: number; g: number; b: number },
): { valley: Uint8ClampedArray; peak: Uint8ClampedArray } {
  const count = width * heightPx;
  const valley = new Uint8ClampedArray(count * 4);
  const peak = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    const s = (height[i] - 0.5) * 2 * strength;
    const v = s < 0 ? -s : 0;
    const u = s > 0 ? s : 0;
    const offset = i * 4;
    valley[offset] = Math.round(255 - v * (255 - tint.r));
    valley[offset + 1] = Math.round(255 - v * (255 - tint.g));
    valley[offset + 2] = Math.round(255 - v * (255 - tint.b));
    valley[offset + 3] = 255;
    peak[offset] = Math.round(u * tint.r);
    peak[offset + 1] = Math.round(u * tint.g);
    peak[offset + 2] = Math.round(u * tint.b);
    peak[offset + 3] = 255;
  }
  return { valley, peak };
}

function mapToCanvas(width: number, height: number, map: Uint8ClampedArray): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const imageData = context.createImageData(width, height);
  imageData.data.set(map);
  context.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * Resolve the cached tooth tile for this paper/size/scale/strength, building it
 * on a miss. Deterministic skip (null) for grain-off ('' — CR-01), strength
 * None (≤ 0), or an unresolved texture — the call touches nothing on that path.
 *
 * The build is the ONLY place pixel work happens: probe the texture at the
 * grain scale, read the pixels once, pipe the red channel through the shared
 * conditioner (260925-dso law — one conditioner, no re-derivation), take the
 * sampled mean tint as the paper's own tone, encode, cache.
 */
export function getPaperPassTile(
  paperTexture: string,
  width: number,
  height: number,
  grainScale: number,
  strength: number,
): PaperPassTile | null {
  if (!paperTexture || !(strength > 0) || width <= 0 || height <= 0) return null;
  const image = getProjectPaperTextureImage(paperTexture);
  if (!image) return null;
  const scale = normalizeGrainScale(grainScale);
  const key = `v1:${paperTexture}:${width}x${height}:${scale}:${strength}`;
  const cached = tileCache.get(key);
  if (cached) return cached.tile;

  const probe = document.createElement('canvas');
  probe.width = width;
  probe.height = height;
  const probeContext = probe.getContext('2d');
  if (!probeContext) return null;
  // Height probe, NOT a fond draw: no white base, no alpha — the texture tiled
  // at the grain scale (the proven pattern-transform idiom, scale 1 stays the
  // natural-size hot path).
  const pattern = typeof probeContext.createPattern === 'function'
    ? probeContext.createPattern(image, 'repeat')
    : null;
  if (pattern) {
    if (scale !== 1 && typeof (pattern as { setTransform?: unknown }).setTransform === 'function') {
      pattern.setTransform({ a: scale, b: 0, c: 0, d: scale, e: 0, f: 0 });
    }
    probeContext.fillStyle = pattern;
    probeContext.fillRect(0, 0, width, height);
  } else {
    const source = image as unknown as { width?: number; height?: number };
    const stepX = Math.max(1, Math.floor((source.width ?? width) * scale));
    const stepY = Math.max(1, Math.floor((source.height ?? height) * scale));
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) probeContext.drawImage(image, x, y);
    }
  }

  let pixels: Uint8ClampedArray;
  try {
    pixels = probeContext.getImageData(0, 0, width, height).data;
  } catch {
    // A probe that cannot be read (security-restricted context) skips the pass
    // deterministically rather than breaking the flattened resolve.
    return null;
  }

  const count = width * height;
  const raw = new Float32Array(count);
  let redSum = 0;
  let greenSum = 0;
  let blueSum = 0;
  for (let i = 0; i < count; i++) {
    const offset = i * 4;
    raw[i] = pixels[offset] / 255;
    redSum += pixels[offset];
    greenSum += pixels[offset + 1];
    blueSum += pixels[offset + 2];
  }
  const conditioned = conditionHeightMap(raw);
  const tint = { r: redSum / count, g: greenSum / count, b: blueSum / count };
  const { valley, peak } = encodePassTiles(conditioned, width, height, strength, tint);
  const valleyCanvas = mapToCanvas(width, height, valley);
  const peakCanvas = mapToCanvas(width, height, peak);
  if (!valleyCanvas || !peakCanvas) return null;
  const tile: PaperPassTile = { valley: valleyCanvas, peak: peakCanvas };
  tileCache.set(key, { tile, bytes: width * height * 8 });
  evictOverBounds(key);
  return tile;
}

/**
 * Apply the tooth to a flattened mixed-paint raster, in place. THE shared
 * routine — canvas, program monitor, and export all reach it through the one
 * `_resolveFlattenedFrame` record, so the two paths cannot drift.
 *
 * The target context is the caller's own; this never reaches for a global
 * surface. save/restore brackets every globalCompositeOperation change, and
 * the whole routine is five GPU drawImage composites:
 *
 *   1. capture the composite (default source-over),
 *   2. multiply with the valley map — darkening toward the paper's own tint,
 *   3. lighten with the peak map — fiber relief,
 *   4. destination-in the original — alpha restore. A blend-mode draw also
 *      paints where the destination is transparent, which would leak tile color
 *      into unpainted regions (and over the fond in the fond branch); this mask
 *      keeps the paint's alpha byte-exact (straight-alpha law D-02, PIN 0
 *      deposit laws untouched — no alpha math, no alpha-punch),
 *   5. copy the result back — writeback preserving that restored alpha.
 */
export function applyPaperPass(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tile: PaperPassTile | null,
): void {
  if (!tile) return;
  const scratch = document.createElement('canvas');
  scratch.width = width;
  scratch.height = height;
  const scratchContext = scratch.getContext('2d');
  if (!scratchContext) return;

  scratchContext.save();
  scratchContext.drawImage(ctx.canvas, 0, 0);
  scratchContext.globalCompositeOperation = 'multiply';
  scratchContext.drawImage(tile.valley, 0, 0, width, height);
  scratchContext.restore();

  scratchContext.save();
  scratchContext.globalCompositeOperation = 'lighten';
  scratchContext.drawImage(tile.peak, 0, 0, width, height);
  scratchContext.restore();

  scratchContext.save();
  scratchContext.globalCompositeOperation = 'destination-in';
  scratchContext.drawImage(ctx.canvas, 0, 0);
  scratchContext.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'copy';
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}
