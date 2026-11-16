/**
 * quick 261116-inu / Task 7 — the pixel-true paint size helper.
 *
 * Laws pinned here:
 *   1. A stored canonical maps to the diameter the ENGINE actually paints:
 *      `2 * fullPressureSize * 0.8 * 3^((sizeToEngineScale(canonical) − 0.5)·2) · H`.
 *   2. The px -> canonical inverse is that law verbatim, with NO clamping:
 *      negatives and values above the 800 track are legal stored canonicals.
 *   3. The retired `Math.max(0, ...)` floor is gone: S=1 is real (Round at
 *      1080 reads canonical ≈ −48.9, not 0 / 28.8 px), and nothing saturates.
 *   4. The mapping is strictly monotonic in S for every shipped response, and
 *      `diameterFromCanonical` is strictly increasing across the negative
 *      region too (canonical ≤ 32), so no stored value pins the display.
 *   5. Unusable input returns the neutral default canonical, never NaN.
 *
 * Pure math: no WebGL, no signals, no DOM. The response's full-pressure size
 * comes from `buildBrushForStroke`, so the number is the engine's own.
 */

import { describe, expect, it } from 'vitest';
import { BRUSH_PRESETS, DEFAULT_CANONICAL_PARAMS } from '@efxlab/efx-watercolor';
import {
  PAINT_SIZE_MAX_PX,
  PAINT_SIZE_MIN_PX,
  canonicalFromDiameter,
  diameterFromCanonical,
  responseFullPressureSize,
} from './aquarelleBrushSize';

/** Round's `size[1]` at HEAD: 0.05 document heights at full pressure. */
const ROUND_FULL = responseFullPressureSize('round', null, null);
/** Rigger's `size[1]` at HEAD: 0.0065. */
const RIGGER_FULL = responseFullPressureSize('rigger', null, null);
const WORKING_HEIGHT = 1080;

describe('pixel control constants', () => {
  it('spans 1..512 px with integer steps, no response-dependent floor', () => {
    expect(PAINT_SIZE_MIN_PX).toBe(1);
    expect(PAINT_SIZE_MAX_PX).toBe(512);
    expect(Number.isInteger(PAINT_SIZE_MAX_PX - PAINT_SIZE_MIN_PX)).toBe(true);
  });
});

describe('responseFullPressureSize — the engine\'s own number', () => {
  it('reads the resolved brush\'s full-pressure field', () => {
    // These are the shipped presets' `size[1]` values, reached through the ONE
    // resolution the engine stamps through — not re-derived here.
    expect(ROUND_FULL).toBe(0.05);
    expect(RIGGER_FULL).toBe(0.0065);
  });
});

describe('canonicalFromDiameter / diameterFromCanonical — one law, both ways', () => {
  it('Round at 1080: 512 px maps to ~293 canonical and back within 0.5 px', () => {
    const canonical = canonicalFromDiameter(512, ROUND_FULL, WORKING_HEIGHT);
    expect(canonical).toBeCloseTo(293, 0);
    expect(canonical).toBeLessThan(800);
    expect(diameterFromCanonical(canonical, ROUND_FULL, WORKING_HEIGHT)).toBeCloseTo(512, 1);
    // The plan's literal probe: the canonical a UI would show for 512.
    expect(diameterFromCanonical(293.1, ROUND_FULL, WORKING_HEIGHT)).toBeCloseTo(512, 0);
  });

  it('Rigger at 1080: 512 px is above the 800 track max and NOT clamped', () => {
    const canonical = canonicalFromDiameter(512, RIGGER_FULL, WORKING_HEIGHT);
    expect(canonical).toBeGreaterThan(800);
    expect(canonical).toBeCloseTo(930.6, 0);
    // A clamped canonical would display a smaller footprint; this one is 512.
    expect(diameterFromCanonical(canonical, RIGGER_FULL, WORKING_HEIGHT)).toBeCloseTo(512, 1);
  });

  it('round-trips S on Round and Rigger at 1080, S=1 within 0.01 px', () => {
    for (const [brushId, full] of [['round', ROUND_FULL], ['rigger', RIGGER_FULL]] as const) {
      for (const diameter of [1, 64, 128, 256, 430, 512]) {
        const canonical = canonicalFromDiameter(diameter, full, WORKING_HEIGHT);
        const back = diameterFromCanonical(canonical, full, WORKING_HEIGHT);
        if (diameter === 1) {
          // Plan tolerance: 1 ± 0.01 px. toBeCloseTo(…, 2) is 0.005.
          expect(back, `${brushId} S=1`).toBeCloseTo(1, 2);
        } else {
          // Plan tolerance: S ± 0.5 px. toBeCloseTo(…, 1) is 0.5.
          expect(back, `${brushId} S=${diameter}`).toBeCloseTo(diameter, 1);
        }
        expect(Number.isFinite(canonical), `${brushId} S=${diameter}`).toBe(true);
      }
    }
  });

  it('Round: S=1 is real — canonical ≈ −48.9, and S=8 reads 8 ± 0.5', () => {
    const canonicalOne = canonicalFromDiameter(1, ROUND_FULL, WORKING_HEIGHT);
    expect(canonicalOne).toBeLessThan(0);
    expect(canonicalOne).toBeCloseTo(-48.9, 0);
    expect(canonicalOne).not.toBe(0);
    expect(diameterFromCanonical(canonicalOne, ROUND_FULL, WORKING_HEIGHT)).toBeCloseTo(1, 2);

    // 8 px is far below the old 28.8 px saturation point: reachable only
    // because the `Math.max(0, ...)` floor is gone.
    const canonicalEight = canonicalFromDiameter(8, ROUND_FULL, WORKING_HEIGHT);
    expect(diameterFromCanonical(canonicalEight, ROUND_FULL, WORKING_HEIGHT)).toBeCloseTo(8, 1);
  });

  it('canonical 0 still reads the retired floor value (28.8 px), proving negatives are new', () => {
    // At HEAD every canonical < 0 mapped to scale 0, i.e. 28.8 px on Round at
    // 1080. That value is still the canonical-0 reading; below 0 now shrinks.
    expect(diameterFromCanonical(0, ROUND_FULL, WORKING_HEIGHT)).toBeCloseTo(28.8, 9);
    expect(diameterFromCanonical(-48.939927897, ROUND_FULL, WORKING_HEIGHT)).toBeCloseTo(1, 2);
  });

  it('is strictly monotonic in S on 1..512 for EVERY shipped response', () => {
    expect(BRUSH_PRESETS.length).toBeGreaterThan(10);
    for (const preset of BRUSH_PRESETS) {
      const full = preset.size[1];
      let previous = Number.NEGATIVE_INFINITY;
      for (let diameter = 1; diameter <= 512; diameter += 1) {
        const canonical = canonicalFromDiameter(diameter, full, WORKING_HEIGHT);
        expect(Number.isFinite(canonical), `${preset.id} S=${diameter}`).toBe(true);
        expect(canonical, `${preset.id} S=${diameter}`).toBeGreaterThan(previous);
        previous = canonical;
      }
    }
  });

  it('diameterFromCanonical is strictly increasing across the negative region', () => {
    // The injective region (canonical <= 32): every stored value moves the
    // displayed diameter, so nothing pins the number at a floor.
    let previous = Number.NEGATIVE_INFINITY;
    for (let canonical = -60; canonical <= 32; canonical += 0.5) {
      const diameter = diameterFromCanonical(canonical, ROUND_FULL, WORKING_HEIGHT);
      expect(diameter, `canonical ${canonical}`).toBeGreaterThan(previous);
      previous = diameter;
    }
    // Above the retired 32..80 flat band the 80..800 law keeps growing.
    previous = diameterFromCanonical(80, ROUND_FULL, WORKING_HEIGHT);
    for (let canonical = 81; canonical <= 800; canonical += 1) {
      const diameter = diameterFromCanonical(canonical, ROUND_FULL, WORKING_HEIGHT);
      expect(diameter, `canonical ${canonical}`).toBeGreaterThan(previous);
      previous = diameter;
    }
  });
});

describe('guards — neutral default, never NaN', () => {
  it('canonicalFromDiameter returns the neutral canonical for unusable input', () => {
    const neutral = DEFAULT_CANONICAL_PARAMS.size;
    expect(canonicalFromDiameter(512, ROUND_FULL, 0)).toBe(neutral);
    expect(canonicalFromDiameter(512, ROUND_FULL, -1080)).toBe(neutral);
    expect(canonicalFromDiameter(512, ROUND_FULL, Number.NaN)).toBe(neutral);
    expect(canonicalFromDiameter(0, ROUND_FULL, WORKING_HEIGHT)).toBe(neutral);
    expect(canonicalFromDiameter(-5, ROUND_FULL, WORKING_HEIGHT)).toBe(neutral);
    expect(canonicalFromDiameter(Number.NaN, ROUND_FULL, WORKING_HEIGHT)).toBe(neutral);
    expect(canonicalFromDiameter(512, 0, WORKING_HEIGHT)).toBe(neutral);
    expect(canonicalFromDiameter(512, Number.NaN, WORKING_HEIGHT)).toBe(neutral);
  });

  it('diameterFromCanonical reads 0 with no renderable height, neutral for NaN canonical', () => {
    expect(diameterFromCanonical(512, ROUND_FULL, 0)).toBe(0);
    expect(diameterFromCanonical(512, ROUND_FULL, Number.NaN)).toBe(0);
    expect(diameterFromCanonical(512, 0, WORKING_HEIGHT)).toBe(0);
    // A non-finite canonical mirrors `toEngineParams`' own guard: the default.
    expect(diameterFromCanonical(Number.NaN, ROUND_FULL, WORKING_HEIGHT)).toBeCloseTo(
      diameterFromCanonical(DEFAULT_CANONICAL_PARAMS.size, ROUND_FULL, WORKING_HEIGHT),
      12,
    );
  });
});
