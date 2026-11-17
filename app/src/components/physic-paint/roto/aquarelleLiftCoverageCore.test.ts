// ============================================================
//  aquarelleLiftCoverageCore — the `core` coverage profile
//  (quick 261117-tq7, spec 09 law 3).
//
//  The cached base of a reopened frame is punched in TRANSMITTANCE.
//  Lift's punch is tip-shaped; the Body cover must be SOLID-CORED so
//  the old paint disappears under the brush body instead of surviving
//  in the bristle gaps. This profile mirrors the engine's
//  `uCover = 1` law exactly: plateau to dot(q,q) = 0.35, smoothstep
//  falloff to 1, zero from there out.
//
//  Written KNOWINGLY RED by task 1 of the quick plan: at HEAD
//  `buildLiftCoverage` takes four arguments, so the fifth `'core'`
//  argument is ignored and the tip law fails the plateau values. That
//  is a VALUE failure naming the missing profile, not a compile error
//  (vitest's esbuild transform strips types without checking them).
//  Task 3 adds the parameter; do not weaken these pins to pass early.
//
//  Pure helpers only — node, no DOM, no WebGL. Numeric pins compare at
//  6 decimals because `coverage` is a Float32Array: a stored value carries
//  ~6e-8 of rounding, five orders below the ~0.1 tip-vs-core gap these
//  tests name. Do not tighten to float64 precision; do not widen further.
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

/** The engine's `uCover = 1` law, spelled once so the test owns its copy. */
function coreLaw(d: number): number {
  const t = Math.min(1, Math.max(0, (d - 0.35) / (1 - 0.35)));
  return 1 - AMOUNT * (1 - t * t * (3 - 2 * t));
}

function fullMaskShape(aspect: number): LiftFootprintShape {
  return {
    tipData: new Uint8Array(16).fill(255),
    tipSize: 4,
    aspect,
    angle: 0,
    rotation: 'fixed',
  };
}

function coreCoverage(dabs: readonly LiftDab[], shape?: LiftFootprintShape) {
  return buildLiftCoverage(dabs, WIDTH, HEIGHT, shape, 'core');
}

describe('the core coverage profile', () => {
  it('replaces a solid core plateau instead of the tip-shaped Lift law', () => {
    const { coverage, coverageRect } = coreCoverage([DAB]);
    // d = 0 at the centre and d <= 0.35 out to the plateau edge: f = amount.
    for (const [x, y] of [
      [50, 50],
      [60, 50], // dx = 10 -> d = 0.25
      [50, 60],
      [61, 50], // dx = 11 -> d = 0.3025
    ] as const) {
      expect(coverageAt(coverage, coverageRect, x, y)).toBeCloseTo(1 - AMOUNT, 6);
    }
  });

  it('falls off smoothly from dot(q,q) = 0.35 to 1 and stops at the unit circle', () => {
    const { coverage, coverageRect } = coreCoverage([DAB]);
    // dx = 12 -> d = 0.36: just inside the blend band.
    expect(coverageAt(coverage, coverageRect, 62, 50)).toBeCloseTo(coreLaw(0.36), 6);
    expect(coverageAt(coverage, coverageRect, 62, 50)).toBeGreaterThan(1 - AMOUNT);
    // dx = 15 -> d = 0.5625: mid-rim.
    expect(coverageAt(coverage, coverageRect, 65, 50)).toBeCloseTo(coreLaw(0.5625), 6);
    // dx = 20 -> d = 1: the core law is spent; the pixel is untouched.
    expect(coverageAt(coverage, coverageRect, 70, 50)).toBeCloseTo(1, 6);
    expect(coverageAt(coverage, coverageRect, 72, 50)).toBe(1);
    // Monotone: the removed fraction shrinks with distance.
    let previous = 0;
    for (let x = 62; x <= 70; x += 1) {
      const value = coverageAt(coverage, coverageRect, x, 50);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('stacks overlapping dabs multiplicatively, like every coverage profile', () => {
    const { coverage, coverageRect } = coreCoverage([DAB, DAB]);
    expect(coverageAt(coverage, coverageRect, 50, 50)).toBeCloseTo((1 - AMOUNT) ** 2, 6);
  });

  it('applies the tip-aspect squeeze after the unit-circle mapping', () => {
    const shape = fullMaskShape(2);
    const squeezed = coreCoverage([DAB], shape);
    // Vertical offset 18 px: across = 18 / 20 / 2 = 0.45 -> d = 0.2025, plateau.
    expect(coverageAt(squeezed.coverage, squeezed.coverageRect, 50, 68)).toBeCloseTo(
      1 - AMOUNT,
      6,
    );
    // The same offset without the squeeze is d = 0.81: past the plateau.
    const round = coreCoverage([DAB]);
    expect(coverageAt(round.coverage, round.coverageRect, 50, 68)).toBeGreaterThan(1 - AMOUNT);
    // Horizontal offset 18 px: along = 0.9 -> d = 0.81 — the long axis is
    // NOT stretched by the squeeze.
    expect(coverageAt(squeezed.coverage, squeezed.coverageRect, 68, 50)).toBeCloseTo(
      coreLaw(0.81),
      6,
    );
    // Outside the tip square (|across| = 1.125) the dab is discarded.
    expect(coverageAt(squeezed.coverage, squeezed.coverageRect, 50, 95)).toBe(1);
  });

  it('leaves every pixel outside the coverage rect untouched', () => {
    const { coverage, coverageRect } = coreCoverage([DAB]);
    expect(coverageRect).toEqual({ x: 29, y: 29, width: 43, height: 43 });
    expect(coverageAt(coverage, coverageRect, 28, 50)).toBe(1);
    expect(coverageAt(coverage, coverageRect, 72, 50)).toBe(1);
    expect(coverageAt(coverage, coverageRect, 50, 28)).toBe(1);
    expect(coverageAt(coverage, coverageRect, 50, 72)).toBe(1);
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
    const { coverage, coverageRect } = coreCoverage([DAB]);
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
