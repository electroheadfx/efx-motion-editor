/**
 * Rail-motion ink scan (Phase 59-08, D-17/T-59-24) — the pixel half of the
 * production pivot measurer.
 *
 * Draws one ALREADY-DECODED raster into a bounded offscreen canvas (long edge
 * <= 256px), reads the alpha channel once, and returns the ink bounds
 * normalized to the raster frame. Synchronous by construction (the composite
 * path is synchronous); it never triggers a decode.
 *
 * This lives OUTSIDE the store deliberately: `paperPass.frameGuard.test.ts`
 * P4(c) bans pixel-array canvas APIs anywhere in `physicPaintStore.ts` (the
 * real-time playback path). The store resolves the decoded raster from its
 * registries and delegates here; `railMotionPivot.ts` memoizes the result once
 * per rail + raster revision, so the scan never rides the per-frame path.
 */

import type { RailMotionMeasuredInk } from './railMotionPivot';

/** Gate D (T-59-24): the bounded pivot scan grid — 256px long edge. */
export const RAIL_MOTION_PIVOT_SCAN_LONG_EDGE = 256;

/**
 * Measures the alpha-channel ink bounds of one decoded raster, normalized to
 * its own frame (0..1). Returns null when the raster has no usable size or the
 * canvas context is unavailable / the raster is released mid-draw — a fallback
 * pivot, never a broken composite. `alphaInk: false` means the scan found no
 * ink at all (the key contributes no bounds).
 */
export function measureRailMotionRasterInk(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): RailMotionMeasuredInk | null {
  if (sourceWidth <= 0 || sourceHeight <= 0) return null;

  const longEdge = Math.max(sourceWidth, sourceHeight);
  const scale = Math.min(1, RAIL_MOTION_PIVOT_SCAN_LONG_EDGE / longEdge);
  const scanWidth = Math.max(1, Math.round(sourceWidth * scale));
  const scanHeight = Math.max(1, Math.round(sourceHeight * scale));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = scanWidth;
    canvas.height = scanHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, scanWidth, scanHeight);
    ctx.drawImage(source, 0, 0, scanWidth, scanHeight);
    const data = ctx.getImageData(0, 0, scanWidth, scanHeight).data;

    let minX = scanWidth;
    let minY = scanHeight;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < scanHeight; y += 1) {
      const rowOffset = y * scanWidth * 4;
      for (let x = 0; x < scanWidth; x += 1) {
        // Alpha only: the rail's ink is whatever the alpha channel covers.
        if (data[rowOffset + x * 4 + 3] === 0) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return { x: 0, y: 0, width: 0, height: 0, alphaInk: false };
    return {
      x: minX / scanWidth,
      y: minY / scanHeight,
      width: (maxX - minX + 1) / scanWidth,
      height: (maxY - minY + 1) / scanHeight,
      alphaInk: true,
    };
  } catch {
    // A released/failed raster is a fallback pivot, never a broken composite.
    return null;
  }
}
