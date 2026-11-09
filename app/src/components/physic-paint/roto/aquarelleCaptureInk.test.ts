// ============================================================
//  aquarelleCaptureInk — the localized blank-sheet capture gate
//  (quick 261109-uj0), node-pure over raw RGBA data.
//
//  Measured evidence: blank cleared sheets score 0.05-0.12 on
//  the historical global per-mille scale, painted sheets
//  4.6-11.3 (261019-mj2) and accepted wet captures 1.32-1.81
//  (261109-pwt). The global mean falls with canvas coverage and
//  sampling timing, so the packaged beta2 build rejected a
//  dev-passing faint wash at the same 0.3 constant. The fixtures
//  below reproduce the measured bands and pin the densest
//  sampling window that decides the gate.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  AQUARELLE_CAPTURE_INK_UNMEASURABLE,
  AQUARELLE_CAPTURE_LOCAL_WINDOW,
  AQUARELLE_CAPTURE_PIXEL_DARKENING_CAP,
  AQUARELLE_CAPTURE_SAMPLE_SIZE,
  AQUARELLE_MIN_CAPTURE_INK,
  AQUARELLE_MIN_CAPTURE_LOCAL_INK,
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

// The measured blank baseline: a near-white textured sheet.
function blankBaseline(): Uint8ClampedArray {
  const data = rgbaFixture(() => 250);
  for (let index = 0; index < 32; index += 1) {
    const pixel = (index * 97) % (SIZE * SIZE);
    paintSamples(data, [[pixel % SIZE, Math.floor(pixel / SIZE)]], 247);
  }
  return data;
}

describe('quick 261109-uj0 — localized aquarelle capture ink', () => {
  it('measures a uniform cleared sheet as inkless and rejects it', () => {
    const measurement = measureAquarelleCaptureInk(rgbaFixture(() => 252), SIZE, SIZE);
    expect(measurement).toEqual({ globalInk: 0, localInk: 0, inkPixels: 0 });
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('rejects the measured near-white blank baseline', () => {
    const measurement = measureAquarelleCaptureInk(blankBaseline(), SIZE, SIZE);
    expect(measurement.globalInk).toBeCloseTo(0.054, 2);
    expect(measurement.localInk).toBeCloseTo(0.163, 2);
    expect(measurement.inkPixels).toBe(32);
    expect(measurement.globalInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_INK);
    expect(measurement.localInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_LOCAL_INK);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('rejects scattered isolated paper flecks', () => {
    const data = blankBaseline();
    paintSamples(data, [[5, 7], [19, 11], [27, 31], [33, 17], [41, 39], [13, 43]], 240);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    expect(measurement.globalInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_INK);
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
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(false);
  });

  it('accepts a faint localized wet wash whose global ink is below the floor', () => {
    const data = rgbaFixture(() => 252);
    paintRect(data, 20, 20, 6, 6, 244);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    expect(measurement.globalInk).toBeCloseTo(0.245, 2);
    expect(measurement.globalInk).toBeLessThan(AQUARELLE_MIN_CAPTURE_INK);
    expect(measurement.localInk).toBeCloseTo(3.92, 2);
    expect(measurement.localInk).toBeGreaterThanOrEqual(AQUARELLE_MIN_CAPTURE_LOCAL_INK);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(true);
  });

  it('accepts the same wash when it straddles the sampling-window grid', () => {
    const data = rgbaFixture(() => 252);
    paintRect(data, 14, 20, 6, 6, 244);
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    expect(measurement.globalInk).toBeCloseTo(0.245, 2);
    expect(measurement.localInk).toBeCloseTo(3.92, 2);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(true);
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
  });

  it('accepts a normal paint control on the global path', () => {
    // Twenty percent coverage at luminance 210: mean darkening 7.6, 29.8.
    const data = rgbaFixture((x, y) => ((y * SIZE + x) % 5 === 0 ? 210 : 252));
    const measurement = measureAquarelleCaptureInk(data, SIZE, SIZE);
    expect(measurement.globalInk).toBeCloseTo(29.8, 2);
    expect(measurement.globalInk).toBeGreaterThanOrEqual(AQUARELLE_MIN_CAPTURE_INK);
    expect(passesAquarelleCaptureInkGate(measurement)).toBe(true);
  });

  it('keeps the historical per-mille global scale', () => {
    const measurement = measureAquarelleCaptureInk(rgbaFixture(() => 238), SIZE, SIZE);
    // 10 / 255 * 1000 on the frozen (48x48, white 248) sampling geometry.
    expect(measurement.globalInk).toBeCloseTo(39.2157, 3);
    expect(measurement.inkPixels).toBe(SIZE * SIZE);
  });

  it('fails open when the sample cannot be measured and is deterministic', () => {
    expect(Object.isFrozen(AQUARELLE_CAPTURE_INK_UNMEASURABLE)).toBe(true);
    expect(AQUARELLE_CAPTURE_INK_UNMEASURABLE.globalInk).toBe(Number.POSITIVE_INFINITY);
    expect(AQUARELLE_CAPTURE_INK_UNMEASURABLE.localInk).toBe(Number.POSITIVE_INFINITY);
    expect(AQUARELLE_CAPTURE_INK_UNMEASURABLE.inkPixels).toBe(0);
    expect(passesAquarelleCaptureInkGate(AQUARELLE_CAPTURE_INK_UNMEASURABLE)).toBe(true);
    expect(measureAquarelleCaptureInk(new Uint8ClampedArray(0), 0, 0)).toEqual({
      globalInk: Number.POSITIVE_INFINITY,
      localInk: Number.POSITIVE_INFINITY,
      inkPixels: 0,
    });
    const fixture = rgbaFixture(() => 238);
    expect(measureAquarelleCaptureInk(fixture, SIZE, SIZE)).toEqual(measureAquarelleCaptureInk(fixture, SIZE, SIZE));
  });
});
