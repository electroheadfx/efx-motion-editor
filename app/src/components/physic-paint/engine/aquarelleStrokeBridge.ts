// ============================================================
//  aquarelleStrokeBridge — the ONE aquarelle → engine-1 point
//  crossing (script-playback-draws-nothing).
//
//  The two paint engines disagree about where a point lives:
//
//    aquarelle  WatercolorEngine.toUv   document UV, y UP
//               (x,y ∈ 0..1 across the sheet — "doc uv, y up")
//    engine-1   EfxPaintEngine capture  canvas pixels, y DOWN
//               (x ∈ 0..width, y ∈ 0..height — screen space)
//
//  Water color stroke-end bridges its AquarelleStroke into an
//  engine-1 PaintStroke so the Roto script save/play path sees
//  the mark. Copying the coordinates across without this map
//  stores 0..1 in a pixel slot: the script saves fine but replay
//  draws a sub-pixel blob at the top-left origin — invisible.
//
//  The map is the exact inverse of the aquarelle sheet's
//  exact-fit view (compositor mode, fitPadding 0) over the
//  Studio working canvas, so a point lands where it was painted.
// ============================================================

import type { AquarelleStroke } from '@efxlab/efx-watercolor';
import type { PaintStroke, PenPoint } from '@efxlab/efx-physic-paint';

/** Canvas size the engine-1 point space is measured in (Studio working pixels). */
export interface EnginePixelSize {
  width: number;
  height: number;
}

/**
 * Document UV (aquarelle, y up) → canvas pixels (engine-1, y down).
 * `y` is flipped: uv 0 is the sheet bottom, engine-1 y 0 is the canvas top.
 */
export function aquarelleUvToEnginePixel(
  point: { x: number; y: number },
  size: EnginePixelSize,
): { x: number; y: number } {
  return {
    x: point.x * size.width,
    y: (1 - point.y) * size.height,
  };
}

/**
 * Canvas pixels (engine-1, y down) → document UV (aquarelle, y up). The exact
 * inverse of {@link aquarelleUvToEnginePixel}: `x / width`, and y is flipped
 * back (`1 - y / height`). This is the ONE absolute pixel→UV crossing — a
 * transform centre captured in canvas pixels must pass through it, never a
 * hand-rolled flip. A degenerate (zero or non-finite) sheet or point returns
 * `{0, 0}` so no NaN/Infinity can reach the recorded script.
 */
export function aquarelleEnginePixelToUv(
  point: { x: number; y: number },
  size: EnginePixelSize,
): { x: number; y: number } {
  if (
    !Number.isFinite(point.x)
    || !Number.isFinite(point.y)
    || !Number.isFinite(size.width)
    || !Number.isFinite(size.height)
    || size.width === 0
    || size.height === 0
  ) {
    return { x: 0, y: 0 };
  }
  return { x: point.x / size.width, y: 1 - point.y / size.height };
}

/**
 * Canvas-pixel delta (engine-1, y down) → document-UV delta (aquarelle, y up).
 * The exact inverse of {@link aquarelleUvToEnginePixel}: `x / width` and a
 * NEGATED `y / height`. This is the ONE pixel→UV crossing — callers must not
 * hand-roll the y flip. A degenerate (zero or non-finite) sheet or delta
 * returns `{0, 0}` so no NaN/Infinity can reach the recorded script.
 */
export function aquarelleEnginePixelDeltaToUv(
  delta: { x: number; y: number },
  size: EnginePixelSize,
): { x: number; y: number } {
  if (
    !Number.isFinite(delta.x)
    || !Number.isFinite(delta.y)
    || !Number.isFinite(size.width)
    || !Number.isFinite(size.height)
    || size.width === 0
    || size.height === 0
  ) {
    return { x: 0, y: 0 };
  }
  return { x: delta.x / size.width, y: -delta.y / size.height };
}

/**
 * Project an aquarelle runtime stroke onto the engine-1 `PaintStroke` the
 * Roto script path records and replays. Points are converted through
 * {@link aquarelleUvToEnginePixel}; the canonical AQUA-04 globals map onto
 * engine-1 brush params (size/load/water/dry/edge → the matching sliders).
 */
export function aquarelleStrokeToPaintStroke(
  stroke: AquarelleStroke,
  size: EnginePixelSize,
): PaintStroke {
  const points: PenPoint[] = stroke.points.map((point) => {
    const pixel = aquarelleUvToEnginePixel(point, size);
    return {
      x: pixel.x,
      y: pixel.y,
      p: point.p,
      tx: point.tx,
      ty: point.ty,
      tw: point.tw,
      spd: 0,
    };
  });
  return {
    tool: 'paint',
    points,
    color: stroke.color,
    params: {
      size: Number(stroke.params['size']) || 12,
      opacity: Number(stroke.params['load']) || 50,
      pressure: 50,
      waterAmount: Number(stroke.params['water']) || 50,
      dryAmount: Number(stroke.params['dry']) || 50,
      edgeDetail: Number(stroke.params['edge']) || 50,
      pickup: 50,
      eraseStrength: 50,
      antiAlias: 1,
    },
    timestamp: stroke.timestamp,
    // quick-261026-odd follow-up: this projected stroke exists only so
    // engine-1 can draw the guide line / keep a ledger slot for the aquarelle
    // stroke. It is never Brush script content: capture, restore and the Move
    // overlay all refuse it by this flag, independent of the aquarelle
    // registry (which is empty on Motion/Static/Reveal rail cells).
    guideProxy: true,
  };
}
