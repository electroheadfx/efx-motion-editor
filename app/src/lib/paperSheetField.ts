/**
 * 261017-mz9: capped procedural paper-sheet field generation.
 *
 * The fond sheet used to be built at full W×H on the main thread (10–15 s at
 * 1080p). This module owns the pixel-mass cap and the pure CPU generator the
 * worker falls back to. Nothing here touches the DOM or worker APIs — it is
 * unit-testable in vitest and safe to import from either side of the worker
 * boundary.
 *
 * Scale law (playground Engine.ts:353): uScale = PAPER_UNITS / (fieldHeight *
 * grainScale) paper units per texel, computed from the CAPPED height so feature
 * size is preserved when the field is scaled up to the fond size. Using the
 * fond height here would zoom the grain on upscale (the wrong-scale blob look).
 * Seed stays 1 (the cache key's seed term).
 */
import {
  PAPER_UNITS,
  presetForPaperId,
  renderPaperSheet,
} from '@efxlab/efx-watercolor/papers';

/**
 * One named long-side cap. At 1920×1080 the field becomes 1024×576 (~3.5×
 * fewer pixels than 2.07M) with only a 1.875× upscale, which keeps Cold Press
 * grain recognizable at normal zoom. 768 would roughly halve worker CPU again
 * but doubles the soften; the worker itself is what kills the freeze.
 */
export const PAPER_FIELD_MAX_LONG_SIDE = 1024;

export interface CappedFieldSize {
  fieldWidth: number;
  fieldHeight: number;
}

/** Positive finite grain scale, else 1 (hostile input never hangs a tile loop). */
export function normalizeGrainScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * Isotropic scale-down to PAPER_FIELD_MAX_LONG_SIDE, aspect preserved. Both
 * sides floor at 1; the result is never larger than the request. A 1920×1080
 * request yields 1024×576; a portrait request clamps on its height.
 */
export function capFieldSize(width: number, height: number): CappedFieldSize {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { fieldWidth: 1, fieldHeight: 1 };
  }
  const requestWidth = Math.max(1, Math.floor(width));
  const requestHeight = Math.max(1, Math.floor(height));
  const longSide = Math.max(requestWidth, requestHeight);
  if (longSide <= PAPER_FIELD_MAX_LONG_SIDE) {
    return { fieldWidth: requestWidth, fieldHeight: requestHeight };
  }
  const scale = PAPER_FIELD_MAX_LONG_SIDE / longSide;
  return {
    fieldWidth: Math.max(1, Math.floor(requestWidth * scale)),
    fieldHeight: Math.max(1, Math.floor(requestHeight * scale)),
  };
}

/**
 * CPU field at the CAPPED size (the worker's no-WebGL fallback). Unknown id /
 * hostile size returns null — deterministic fail-soft to the flat tint arm.
 */
export function generatePaperSheetCpu(
  paperTexture: string,
  fieldWidth: number,
  fieldHeight: number,
  grainScale: number,
): Uint8ClampedArray | null {
  const preset = presetForPaperId(paperTexture);
  if (!preset) return null;
  if (!Number.isInteger(fieldWidth) || !Number.isInteger(fieldHeight) || fieldWidth <= 0 || fieldHeight <= 0) {
    return null;
  }
  const normalized = normalizeGrainScale(grainScale);
  const uScale = PAPER_UNITS / (fieldHeight * normalized);
  return renderPaperSheet(fieldWidth, fieldHeight, uScale, 1, preset);
}
