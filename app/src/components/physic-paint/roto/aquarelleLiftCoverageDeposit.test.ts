// ============================================================
//  aquarelleLiftCoverageDeposit — the `deposit` coverage profile
//  (quick 261117-tq7, spec 09 law 3, rev 2).
//
//  The cached base of a reopened frame is punched in TRANSMITTANCE.
//  Lift's punch is tip-shaped WITH a radial envelope; the Body cover
//  erases exactly where the covering dab DEPOSITS, so the cache must
//  use the same tip mask and the same per-dab strength the engine
//  binds — no solid core (it erased texture the brush never painted,
//  punching paper-white into the bristle gaps) and no radial envelope
//  (it under-erased the rim the deposit does reach).
//
//  Pure helpers only — node, no DOM, no WebGL. Numeric pins compare at
//  6 decimals because `coverage` is a Float32Array: a stored value
//  carries ~6e-8 of rounding. Do not tighten to float64 precision.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  buildLiftCoverage,
  punchTransmittanceRgba,
  type LiftCoverageRect,
  type LiftDab,
  type LiftFootprintShape,
} from './aquarelleLiftErase';

const WIDTH = 100;
const HEIGHT = 100;
const AMOUNT = 0.8;
/** r * height = 20 px; the dab sits exactly on the sheet's centre. */
const DAB: LiftDab = { x: 0.5, y: 0.5, r: 0.2, amount: AMOUNT, angle: 0 };

/** Untouched pixels read exactly 1, mirroring the coverage contract. */
function coverageAt(
  coverage: Float32Array,
  rect: LiftCoverageRect,
  x: number,
  y: number,
): number {
  if (x < rect.x || x >= rect.x + rect.width || y < rect.y || y >= rect.y + rect.height) return 1;
  return coverage[(y - rect.y) * rect.width + (x - rect.x)]!;
}

function fullMaskShape(aspect: number, size = 4): LiftFootprintShape {
  return {
    tipData: new Uint8Array(size * size).fill(255),
    tipSize: size,
    aspect,
    angle: 0,
    rotation: 'fixed',
  };
}

function depositCoverage(dabs: readonly LiftDab[], shape?: LiftFootprintShape) {
  return buildLiftCoverage(dabs, WIDTH, HEIGHT, shape, 'deposit');
}

describe('the deposit coverage profile', () => {
  it('removes the dab strength inside the tip square and nothing outside it', () => {
    const { coverage, coverageRect } = depositCoverage([DAB], fullMaskShape(1));
    // A fully opaque tip: the mask is 1 everywhere inside the square, so the
    // underlayer loses exactly `amount` — the same fraction the engine's cover
    // subtracts from the pigment the covering dab lands.
    for (const [x, y] of [
      [50, 50], // centre
      [60, 50], // along 0.5
      [69, 69], // the square CORNER: along .95, across .95 — the deposited
      //           square, where a circular core would have stopped at d = 1
      [31, 31], // the opposite corner
    ] as const) {
      expect(coverageAt(coverage, coverageRect, x, y)).toBeCloseTo(1 - AMOUNT, 6);
    }
    // Outside the tip square the engine discards the dab, so nothing is erased.
    expect(coverageAt(coverage, coverageRect, 71, 50)).toBe(1);
    expect(coverageAt(coverage, coverageRect, 50, 71)).toBe(1);
    expect(coverageAt(coverage, coverageRect, 29, 50)).toBe(1);
  });

  it('follows the tip texture: a gap in the bristles keeps the old paint', () => {
    // A 2×2 tip whose right column is empty. The engine deposits nothing there,
    // so the cover must erase nothing there. The removed solid core erased it
    // anyway and left paper-white through every texture gap.
    const gapShape: LiftFootprintShape = {
      tipData: new Uint8Array([255, 0, 255, 0]),
      tipSize: 2,
      aspect: 1,
      angle: 0,
      rotation: 'fixed',
    };
    const { coverage, coverageRect } = depositCoverage([DAB], gapShape);
    // along = -0.5 -> u = 0.25 -> the full texel column.
    expect(coverageAt(coverage, coverageRect, 40, 50)).toBeCloseTo(1 - AMOUNT, 6);
    // along = +0.5 -> u = 0.75 -> the empty column.
    expect(coverageAt(coverage, coverageRect, 60, 50)).toBe(1);
    // The mask is bilinear, exactly as the engine samples it.
    expect(coverageAt(coverage, coverageRect, 50, 50)).toBeCloseTo(1 - AMOUNT * 0.5, 6);
  });

  it('stacks overlapping dabs multiplicatively, like every coverage profile', () => {
    const { coverage, coverageRect } = depositCoverage([DAB, DAB], fullMaskShape(1));
    expect(coverageAt(coverage, coverageRect, 50, 50)).toBeCloseTo((1 - AMOUNT) ** 2, 6);
  });

  it('applies the tip-aspect squeeze after the square cull', () => {
    const shape = fullMaskShape(2);
    const squeezed = depositCoverage([DAB], shape);
    // Vertical offset 18 px: across = 18 / 20 / 2 = 0.45 — inside the square.
    expect(coverageAt(squeezed.coverage, squeezed.coverageRect, 50, 68)).toBeCloseTo(
      1 - AMOUNT,
      6,
    );
    // Horizontal offset 18 px: along = 0.9 — the long axis is not squeezed.
    expect(coverageAt(squeezed.coverage, squeezed.coverageRect, 68, 50)).toBeCloseTo(
      1 - AMOUNT,
      6,
    );
    // Inside the square but outside the unit circle: still deposited (the tip
    // square is the silhouette, not a radial disc).
    expect(coverageAt(squeezed.coverage, squeezed.coverageRect, 66, 74)).toBeCloseTo(
      1 - AMOUNT,
      6,
    );
    // Outside the tip square (|across| = 1.125) the dab is discarded.
    expect(coverageAt(squeezed.coverage, squeezed.coverageRect, 50, 95)).toBe(1);
  });

  it('falls back to the unit disc when no recorded shape exists', () => {
    const { coverage, coverageRect } = depositCoverage([DAB]);
    expect(coverageAt(coverage, coverageRect, 50, 50)).toBeCloseTo(1 - AMOUNT, 6);
    expect(coverageAt(coverage, coverageRect, 69, 50)).toBeCloseTo(1 - AMOUNT, 6);
    // Radius 20 px: beyond it the fallback erases nothing.
    expect(coverageAt(coverage, coverageRect, 72, 50)).toBe(1);
  });

  it('keeps the tip profile byte-identical when no profile is given', () => {
    const implicit = buildLiftCoverage([DAB], WIDTH, HEIGHT);
    const explicit = buildLiftCoverage([DAB], WIDTH, HEIGHT, undefined, 'tip');
    expect(explicit.coverageRect).toEqual(implicit.coverageRect);
    expect(Array.from(explicit.coverage)).toEqual(Array.from(implicit.coverage));
    // The recorded Lift law: f = amount * exp(-(q*q)^2) with q = d.
    for (const [x, y] of [
      [50, 50],
      [60, 50],
      [62, 50],
      [65, 50],
    ] as const) {
      const dx = x - 50;
      const dyUp = 50 - y;
      const q = (dx * dx + dyUp * dyUp) / (20 * 20);
      const expected = 1 - AMOUNT * Math.exp(-(q * q));
      expect(coverageAt(implicit.coverage, implicit.coverageRect, x, y)).toBeCloseTo(expected, 6);
    }
    expect(coverageAt(implicit.coverage, implicit.coverageRect, 50, 50)).toBeCloseTo(0.2, 6);
  });

  it('punches only the in-rect transmittance and never the alpha channel', () => {
    const { coverage, coverageRect } = depositCoverage([DAB], fullMaskShape(1));
    const rgba = new Uint8ClampedArray(100 * 100 * 4);
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 200;
      rgba[i + 1] = 100;
      rgba[i + 2] = 50;
      rgba[i + 3] = 255;
    }
    const before = new Uint8ClampedArray(rgba);
    const changed = punchTransmittanceRgba(rgba, coverage, 100, 100, coverageRect);
    expect(changed).toBeGreaterThan(0);
    // Alpha is never written, anywhere.
    for (let i = 3; i < rgba.length; i += 4) expect(rgba[i]).toBe(255);
    // Outside the dirty rect every byte is identical.
    for (let y = 0; y < 100; y += 1) {
      for (let x = 0; x < 100; x += 1) {
        if (x >= coverageRect.x && x < coverageRect.x + coverageRect.width && y >= coverageRect.y && y < coverageRect.y + coverageRect.height) continue;
        const index = (y * 100 + x) * 4;
        expect(rgba[index]).toBe(before[index]);
        expect(rgba[index + 1]).toBe(before[index + 1]);
        expect(rgba[index + 2]).toBe(before[index + 2]);
      }
    }
    // The centre channel is lightened by t^(1-amount) in linear light.
    const centre = (50 * 100 + 50) * 4;
    expect(rgba[centre]).toBeGreaterThan(before[centre]);
  });
});

// ============================================================
//  rev 4 — the per-dab density
//
//  The engine's cover erases the dab's own LAYER ALPHA,
//  `amount * (1 - exp(-density * mask))`, with `density` the pigment-scaled
//  optical density of that dab's deposit at full mask. Across overlapping
//  dabs the product composes to the deposit's accumulated absorbance, so a
//  textured tip can never erase past the paint it lays. The cache punch must
//  walk the same law or a reopened frame diverges from the live sheet.
// ============================================================

describe('the deposit profile with a per-dab density (rev 4)', () => {
  const DENSITY = 0.7;
  const shaped = (mask: number) => AMOUNT * (1 - Math.exp(-DENSITY * mask));

  it('erases the dab layer alpha, not the raw mask', () => {
    const { coverage, coverageRect } = buildLiftCoverage(
      [{ ...DAB, density: DENSITY }],
      WIDTH,
      HEIGHT,
      fullMaskShape(1),
      'deposit',
    );
    expect(coverageAt(coverage, coverageRect, 50, 50)).toBeCloseTo(1 - shaped(1), 6);
    // The tip square still culls: nothing outside is touched.
    expect(coverageAt(coverage, coverageRect, 71, 50)).toBe(1);
  });

  it('composes overlapping dabs geometrically, one layer alpha each', () => {
    const dabs = [
      { ...DAB, density: DENSITY },
      { ...DAB, density: DENSITY },
    ];
    const { coverage, coverageRect } = depositCoverage(dabs, fullMaskShape(1));
    expect(coverageAt(coverage, coverageRect, 50, 50)).toBeCloseTo((1 - shaped(1)) ** 2, 6);
  });

  it('follows the bilinear tip mask through the exponential', () => {
    // A 2×2 tip whose right column is empty: the centre samples mask 0.5.
    const gapShape: LiftFootprintShape = {
      tipData: new Uint8Array([255, 0, 255, 0]),
      tipSize: 2,
      aspect: 1,
      angle: 0,
      rotation: 'fixed',
    };
    const { coverage, coverageRect } = buildLiftCoverage(
      [{ ...DAB, density: DENSITY }],
      WIDTH,
      HEIGHT,
      gapShape,
      'deposit',
    );
    expect(coverageAt(coverage, coverageRect, 50, 50)).toBeCloseTo(1 - shaped(0.5), 6);
    // The empty texel column deposits nothing, so it must erase nothing.
    expect(coverageAt(coverage, coverageRect, 60, 50)).toBe(1);
  });
});
