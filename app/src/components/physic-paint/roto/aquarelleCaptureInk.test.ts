// ============================================================
//  aquarelleCaptureInk — the localized blank-sheet capture gate
//  (quick 261109-uj0), node-pure over raw RGBA data.
//
//  Measured evidence: blank cleared sheets score 0.05-0.12 on
//  the historical global per-mille scale, painted sheets
//  4.6-11.3 (261019-mj2) and accepted wet captures 1.32-1.81
//  (261109-pwt). The global mean falls with canvas coverage and
//  sampling timing, so the packaged beta2 build rejected a
//  dev-passing faint wash at the same 0.3 constant.
//
//  The localized window is pinned as a DIAGNOSTIC, not a gate: the
//  packaged-build UAT of 2026-11-09 showed paper texture can score a
//  near-blank sheet over the local floor, so localized acceptance
//  overwrote fresh paint. Acceptance is GLOBAL: the historical
//  luminance path OR a color-aware pigment path that measures each
//  pixel's per-channel deficit against the sheet's own paper baseline.
//
//  The pigment path exists because luminance is blind to yellow and
//  orange: they mostly absorb blue and stay luminance-bright, so a
//  visible wash scored below 0.3 and was rejected as blank (the user
//  painted the stroke twice as a workaround). Red/blue absorb
//  strongly and passed. Alpha cannot distinguish anything — the
//  sheet is opaque transmittance (alpha 255). The fixtures below pin
//  both paths and keep the localized measurements for diagnostics.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  AQUARELLE_CAPTURE_INK_UNMEASURABLE,
  AQUARELLE_CAPTURE_LOCAL_WINDOW,
  AQUARELLE_CAPTURE_PIXEL_DARKENING_CAP,
  AQUARELLE_CAPTURE_SAMPLE_SIZE,
  AQUARELLE_MIN_CAPTURE_INK,
  AQUARELLE_MIN_CAPTURE_LOCAL_INK,
  AQUARELLE_MIN_CAPTURE_PIGMENT_INK,
  measureAquarelleCaptureInk,
  passesAquarelleCaptureInkGate,
} from './aquarelleCaptureInk';

const SIZE = AQUARELLE_CAPTURE_SAMPLE_SIZE;

type Sample = readonly [x: number, y: number];

function rgbaFixture(luminance: (x: number, y: number) => number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const value = luminance(x, y);
      const index = (y * SIZE + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return data;
}

function paintSamples(data: Uint8ClampedArray, samples: readonly Sample[], luminance: number): void {
  for (const [x, y] of samples) {
    const index = (y * SIZE + x) * 4;
    data[index] = luminance;
    data[index + 1] = luminance;
    data[index + 2] = luminance;
    data[index + 3] = 255;
  }
}

function paintRect(
  data: Uint8ClampedArray,
  left: number,
  top: number,
  width: number,
  height: number,
  luminance: number,
): void {
  const samples: Sample[] = [];
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) samples.push([x, y]);
  }
  paintSamples(data, samples, luminance);
}

function rgbaColorFixture(base: readonly [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let pixel = 0; pixel < SIZE * SIZE; pixel += 1) {
    const index = pixel * 4;
    data[index] = base[0];
    data[index + 1] = base[1];
    data[index + 2] = base[2];
    data[index + 3] = 255;
  }
  return data;
}

function paintRectColor(
  data: Uint8ClampedArray,
  left: number,
  top: number,
  width: number,
  height: number,
  color: readonly [number, number, number],
): void {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const index = (y * SIZE + x) * 4;
      data[index] = color[0];
      data[index + 1] = color[1];
      data[index + 2] = color[2];
      data[index + 3] = 255;
    }
  }
}

// The retired acceptance metric, kept here to prove the color regression it had.
function legacyLuminanceInk(data: Uint8ClampedArray): number {
  let ink = 0;
  for (let index = 0; index < data.length; index += 4) {
    const luminance = 0.2126 * data[index]! + 0.7152 * data[index + 1]! + 0.0722 * data[index + 2]!;
    ink += Math.max(0, 248 - luminance);
  }
  return (ink / (255 * (data.length / 4))) * 1000;
}

// The measured blank baseline: a near-white textured sheet.
function blankBaseline(): Uint8ClampedArray {
  const data = rgbaFixture(() => 250);
  for (let index = 0; index < 32; index += 1) {
    const pixel = (index * 97) % (SIZE * SIZE);
    paintSamples(data, [[pixel % SIZE, Math.floor(pixel / SIZE)]], 247);
  }
  return data;
}

describe('quick 261109-uj0 — capture ink measurement and global-only gate', () => {
  it('measures a uniform cleared sheet as inkless and rejects it', () => {
    const measurement = measureAquarelleCaptureInk(rgbaFixture(() => 252), SIZE, SIZE);
    expect(measurement).toEqual({ globalInk: 0, localInk: 0, inkPixels: 0, pigmentInk: 0, pigmentPixels: 0 });
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('scores a uniformly tinted blank as zero pigment (any paper color)', () => {
    const cream = measureAquarelleCaptureInk(rgbaColorFixture([255, 250, 240]), SIZE, SIZE);
    expect(cream.globalInk).toBe(0);
    expect(cream.pigmentInk).toBe(0);
    expect(passesAquarelleCaptureInkGate(cream)).toBe(false);
  });

  it('accepts a faint yellow wash that the luminance metric rejects', () => {
    const data = rgbaColorFixture([255, 255, 255]);
    paintRectColor(data, 20, 20, 6, 6, [255, 245, 225]);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    // The retired luminance gate saw only 0.142 and rejected the visible wash.
    expect(legacyLuminanceInk(data)).toBeCloseTo(0.14, 2);
    expect(legacyLuminanceInk(data)).toBeLessThan(AQUARELLE_MIN_CAPTURE_INK);
    expect(measurement.globalInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_INK);
    expect(measurement.pigmentInk).toBeCloseTo(1.84, 2);
    expect(measurement.pigmentInk).toBeGreaterThanOrEqual(AQUARELLE_MIN_CAPTURE_PIGMENT_INK);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(true);
  });

  it('accepts orange, red and blue washes on the pigment path', () => {
    const cases: ReadonlyArray<readonly [readonly [number, number, number], number]> = [
      [[255, 240, 215], 2.45],
      [[220, 80, 80], 10.72],
      [[80, 80, 220], 10.72],
    ];
    for (const [color, expected] of cases) {
      const data = rgbaColorFixture([255, 255, 255]);
      paintRectColor(data, 20, 20, 6, 6, color);
      const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
      expect(measurement.pigmentInk).toBeCloseTo(expected, 2);
      expect(passesAquarelleCaptureInkGate(measurement)).toBe(true);
    }
  });

  it('accepts a yellow wash on a tinted paper through the paper-relative baseline', () => {
    const data = rgbaColorFixture([255, 250, 240]);
    paintRectColor(data, 20, 20, 6, 6, [255, 245, 225]);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    // The paper baseline is 255/250/240, so only the blue deficit (15) counts.
    expect(measurement.pigmentInk).toBeCloseTo(0.92, 2);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(true);
  });

  it('rejects the measured near-white blank baseline', () => {
    const measurement = measureAquarelleCaptureInk(blankBaseline(), SIZE, SIZE);
    expect(measurement.globalInk).toBeCloseTo(0.054, 2);
    expect(measurement.localInk).toBeCloseTo(0.163, 2);
    expect(measurement.inkPixels).toBe(32);
    expect(measurement.pigmentInk).toBeCloseTo(0.163, 2);
    expect(measurement.globalInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_INK);
    expect(measurement.pigmentInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_PIGMENT_INK);
    expect(measurement.localInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_LOCAL_INK);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('rejects scattered isolated paper flecks', () => {
    const data = blankBaseline();
    paintSamples(data, [[5, 7], [19, 11], [27, 31], [33, 17], [41, 39], [13, 43]], 240);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    expect(measurement.globalInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_INK);
    expect(measurement.pigmentInk).toBeCloseTo(0.27, 2);
    expect(measurement.pigmentInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_PIGMENT_INK);
    expect(measurement.localInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_LOCAL_INK);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('rejects the worst case where six flecks share one sampling window', () => {
    const data = blankBaseline();
    paintSamples(data, [[16, 20], [17, 20], [18, 20], [19, 20], [20, 20], [21, 20]], 240);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    // Six capped flecks plus the four baseline samples the same window holds:
    // (6 * 8 + 4) / 144 * 1000 / 255 = 1.416.
    expect(measurement.localInk).toBeCloseTo(1.42, 2);
    expect(measurement.localInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_LOCAL_INK);
    expect(measurement.pigmentInk).toBeCloseTo(0.27, 2);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('still rejects fifteen flecks clustered along one band', () => {
    const data = blankBaseline();
    // No 12x12 window holds more than eight of the fifteen, so the densest
    // window is eight capped flecks plus four baseline samples: 1.852.
    paintSamples(data, [
      [16, 20], [17, 20], [18, 20], [19, 20], [20, 20], [21, 20], [22, 20], [23, 20],
      [28, 20], [29, 20], [30, 20], [31, 20], [32, 20], [33, 20], [34, 20],
    ], 240);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    expect(measurement.localInk).toBeCloseTo(1.85, 2);
    expect(measurement.localInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_LOCAL_INK);
    // Colored-paper-grain stress: the paper-relative pigment path stays below
    // its own floor, so flecks cannot impersonate a wash.
    expect(measurement.pigmentInk).toBeCloseTo(0.42, 2);
    expect(measurement.pigmentInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_PIGMENT_INK);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('measures a faint neutral wash below every global floor and both paths reject it', () => {
    const data = rgbaFixture(() => 252);
    paintRect(data, 20, 20, 6, 6, 244);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    expect(measurement.globalInk).toBeCloseTo(0.245, 2);
    expect(measurement.globalInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_INK);
    // Diagnostic evidence only: the localized signal would have accepted it,
    // which is exactly why the packaged-build blank sheet must be measured
    // before localized acceptance can ever decide again.
    expect(measurement.localInk).toBeCloseTo(3.92, 2);
    expect(measurement.localInk).toBeGreaterThanOrEqual(AQUARELLE_MIN_CAPTURE_LOCAL_INK);
    // Neutral ink stays on the luminance path; the pigment deficit is just
    // below its own floor (0.49 vs 0.5) and does not rescue it.
    expect(measurement.pigmentInk).toBeCloseTo(0.49, 2);
    expect(measurement.pigmentInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_PIGMENT_INK);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('keeps the same rejection when the wash straddles the sampling-window grid', () => {
    const data = rgbaFixture(() => 252);
    paintRect(data, 14, 20, 6, 6, 244);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    expect(measurement.globalInk).toBeCloseTo(0.245, 2);
    expect(measurement.localInk).toBeCloseTo(3.92, 2);
    expect(measurement.pigmentInk).toBeCloseTo(0.49, 2);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('caps a single extreme sample so amplitude cannot impersonate coverage', () => {
    const data = rgbaFixture(() => 252);
    paintSamples(data, [[10, 10]], 0);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    // The cap bounds the LOCAL contribution: one fully black pixel is
    // min(248, 8) / 144 * 1000 / 255 = 0.218 — nowhere near the localized
    // floor. The historical global path still answers for the darkening
    // actually present, exactly as it always has.
    const cappedSingle = (AQUARELLE_CAPTURE_PIXEL_DARKENING_CAP / (AQUARELLE_CAPTURE_LOCAL_WINDOW ** 2)) * 1000 / 255;
    expect(measurement.localInk).toBeCloseTo(cappedSingle, 2);
    expect(measurement.localInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_LOCAL_INK);
    expect(measurement.globalInk).toBeCloseTo(0.42, 2);
    expect(measurement.inkPixels).toBe(1);
    // One extreme neutral pixel: the historical global path accepts it (0.42,
    // exactly as it always has); the paper-relative pigment path alone stays
    // below its 0.5 floor and adds no acceptance.
    expect(measurement.pigmentInk).toBeCloseTo(0.43, 2);
    expect(measurement.pigmentInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_PIGMENT_INK);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(true);
  });

  it('accepts a normal paint control on the global path', () => {
    // 20% coverage at luminance 210 (461 of 2304 pixels): mean darkening
    // 7.603, i.e. 29.817 on the historical per-mille scale.
    const data = rgbaFixture((x, y) => ((y * SIZE + x) % 5 === 0 ? 210 : 252));
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    expect(measurement.globalInk).toBeCloseTo(29.82, 2);
    expect(measurement.globalInk).toBeGreaterThanOrEqual(AQUARELLE_MIN_CAPTURE_INK);
    expect(measurement.pigmentInk).toBeCloseTo(32.95, 1);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(true);
  });

  it('keeps the historical per-mille global scale', () => {
    const measurement = measureAquarelleCaptureInk(rgbaFixture(() => 238), SIZE, SIZE);
    // 10 / 255 * 1000 on the frozen (48x48, white 248) sampling geometry.
    expect(measurement.globalInk).toBeCloseTo(39.2157, 3);
    expect(measurement.inkPixels).toBe(SIZE * SIZE);
    // A uniform sheet of ANY color is the paper itself: zero pigment deficit.
    expect(measurement.pigmentInk).toBe(0);
  });

  it('fails open when the sample cannot be measured and is deterministic', () => {
    expect(Object.isFrozen(AQUARELLE_CAPTURE_INK_UNMEASURABLE)).toBe(true);
    expect(AQUARELLE_CAPTURE_INK_UNMEASURABLE.globalInk).toBe(Number.POSITIVE_INFINITY);
    expect(AQUARELLE_CAPTURE_INK_UNMEASURABLE.localInk).toBe(Number.POSITIVE_INFINITY);
    expect(AQUARELLE_CAPTURE_INK_UNMEASURABLE.inkPixels).toBe(0);
    expect(AQUARELLE_CAPTURE_INK_UNMEASURABLE.pigmentInk).toBe(Number.POSITIVE_INFINITY);
    expect(AQUARELLE_CAPTURE_INK_UNMEASURABLE.pigmentPixels).toBe(0);
    expect(passesAquarelleCaptureInkGate(AQUARELLE_CAPTURE_INK_UNMEASURABLE)).toBe(true);
    expect(measureAquarelleCaptureInk(new Uint8ClampedArray(0), 0, 0)).toEqual({
      globalInk: Number.POSITIVE_INFINITY,
      localInk: Number.POSITIVE_INFINITY,
      inkPixels: 0,
      pigmentInk: Number.POSITIVE_INFINITY,
      pigmentPixels: 0,
    });
    const fixture = rgbaFixture(() => 238);
    expect(measureAquarelleCaptureInk(fixture, SIZE, SIZE)).toEqual(measureAquarelleCaptureInk(fixture, SIZE, SIZE));
  });
});
