// ============================================================
//  aquarelleBrushSize — the ONE px <-> canonical paint-size law
//  (quick 261116-inu / Task 7).
//
//  At full pressure the engine paints a diameter of
//    2 · fullPressureSize · 0.8 · 3^((sizeToEngineScale(canonical) − 0.5) · 2) · H
//  (Engine.radius · 0.8, Engine.sizeMult), where `fullPressureSize` is
//  the RESOLVED brush's `size[1]` and `H` is the working render height —
//  the same `Engine.dh` the paint uses. This module owns that law in
//  both directions, so a px control can display the footprint the engine
//  will actually paint and store the canonical that paints the number
//  the user asked for.
//
//  NO CLAMPING, EITHER DIRECTION. The canonical returned here is stored
//  as-is: it may be negative (a real hairline below the retired floor)
//  or above the 800 track (a thin response at 512 px). Recorded strokes
//  remain the single source of truth; the display always derives.
//
//  The RETIRED floor: HEAD's `sizeToEngineScale` floored its sub-32
//  branch at 0, saturating every negative canonical at scale 0 — 28.8 px
//  on Round at 1080 and 3.74 px on Rigger. Task 7 removed that floor
//  (`Math.max(0, sizePx / 32)` → `sizePx / 32`), so 1 px is REAL: Round
//  at 1080 reaches S=1 at canonical ≈ −48.9, and the diameter keeps
//  shrinking below it. Nothing saturates and nothing snaps.
//
//  Guards: unusable input (no working height, no full-pressure size, a
//  non-positive diameter, a non-finite intermediate) returns the neutral
//  default canonical — never NaN. A non-finite canonical on the way back
//  mirrors `toEngineParams`' own non-finite guard.
//
//  Preact-free, DOM-free: pure math plus the existing brush resolution.
// ============================================================

import {
  DEFAULT_CANONICAL_PARAMS,
  LEGACY_SIZE_MAX_PX,
  SIZE_MAX_PX,
  SIZE_SCALE_AT_MAX,
  buildBrushForStroke,
  sizeToEngineScale,
  type BrushMultiplierOverrides,
} from '@efxlab/efx-watercolor';

/** The px paint control's range: a real 1 px hairline up to 512 px. */
export const PAINT_SIZE_MIN_PX = 1;
export const PAINT_SIZE_MAX_PX = 512;

/**
 * `sizeToEngineScale`'s linear-branch boundary: canonical 32 is scale 1.
 * Kept local because the package exports the law, not its branch literal.
 */
const ENGINE_UNITY_PX = 32;

/** Engine.radius: a brush's doc-space radius is `size · 0.8 · sizeMult`. */
const RADIUS_FACTOR = 0.8;

/**
 * The full-pressure footprint radius factor of the brush the engine would
 * stamp for this response + texture + overrides, in document heights
 * (`Brush.size[1]`). Reuses `buildBrushForStroke`, so the number is the
 * engine's own — never a re-derivation.
 */
export function responseFullPressureSize(
  brushId: string,
  textureId: string | null = null,
  overrides: BrushMultiplierOverrides | null = null,
): number {
  return buildBrushForStroke(brushId, { textureId, overrides }).size[1];
}

/**
 * The canonical that paints `diameterPx` at full pressure — the law
 * verbatim, inverted. UNCLAMPED: negatives and values above the 800
 * track are legal stored canonicals.
 */
export function canonicalFromDiameter(
  diameterPx: number,
  fullPressureSize: number,
  workingHeight: number,
): number {
  const neutral = DEFAULT_CANONICAL_PARAMS.size;
  if (!Number.isFinite(diameterPx) || diameterPx <= 0) return neutral;
  if (!Number.isFinite(fullPressureSize) || fullPressureSize <= 0) return neutral;
  if (!Number.isFinite(workingHeight) || workingHeight <= 0) return neutral;
  const base = fullPressureSize * RADIUS_FACTOR;
  const mult = diameterPx / 2 / workingHeight / base;
  if (!Number.isFinite(mult) || mult <= 0) return neutral;
  const scale = 0.5 + Math.log(mult) / Math.log(3) / 2;
  if (!Number.isFinite(scale)) return neutral;
  // The inverse of `sizeToEngineScale` after Task 7's clamp removal. The
  // 32..80 flat band is not injective (both ends are scale 1); the inverse
  // lands on its lower edge, and a scale just above 1 lands just above 80.
  return scale <= 1
    ? scale * ENGINE_UNITY_PX
    : LEGACY_SIZE_MAX_PX +
        ((scale - 1) / (SIZE_SCALE_AT_MAX - 1)) * (SIZE_MAX_PX - LEGACY_SIZE_MAX_PX);
}

/**
 * The diameter, in px at `workingHeight`, the engine paints at full
 * pressure for `canonical`. Mirrors the engine through the real
 * `sizeToEngineScale`, so the displayed number is the footprint the paint
 * will cover — including the negative region, where 1 px is reachable.
 *
 * Returns 0 when no footprint is renderable (no working height, no
 * full-pressure size); a non-finite canonical maps like `toEngineParams`
 * does — the neutral default.
 */
export function diameterFromCanonical(
  canonical: number,
  fullPressureSize: number,
  workingHeight: number,
): number {
  if (!Number.isFinite(fullPressureSize) || fullPressureSize <= 0) return 0;
  if (!Number.isFinite(workingHeight) || workingHeight <= 0) return 0;
  const size = Number.isFinite(canonical) ? canonical : DEFAULT_CANONICAL_PARAMS.size;
  return (
    2 *
    fullPressureSize *
    RADIUS_FACTOR *
    Math.pow(3, (sizeToEngineScale(size) - 0.5) * 2) *
    workingHeight
  );
}
