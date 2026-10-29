// ============================================================
//  aquarelleLiftErase — the lift punch law (261028-k03 D2).
//
//  Footprint constants mirror the engine's 'lift' stamp; the
//  punch is t' = t^K per channel in LINEAR light, K = PROD(1-f),
//  alpha never written, pixels outside the coverage rect
//  byte-identical. Pure helpers only — the wrappers take
//  injected doubles, so the suite runs in node with no DOM.
// ============================================================

import { describe, expect, it } from 'vitest';
import { buildBrushForStroke } from '@efxlab/efx-watercolor';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import {
  HOST_DT_SECONDS,
  LIFT_TIP_ROUND,
  buildLiftCoverage,
  collectLiftDabs,
  liftEngineSize,
  liftRadiusDoc,
  liftShapeForStroke,
  punchTransmittanceBytes,
  punchTransmittanceCanvas,
  punchTransmittanceRgba,
  type LiftCoverageRect,
  type LiftDab,
  type LiftFootprintShape,
} from './aquarelleLiftErase';

const SIZE = { width: 1000, height: 1000 };
/** Canonical AQUA-04 params: size 12 px → engine size 0.375. */
const CANONICAL = { size: 12 };
const SIZE_MULT = 3 ** -0.25;

function radiusForPressure(pressure: number): number {
  const dabs = collectLiftDabs(
    { points: [{ x: 0.5, y: 0.5, p: pressure, tx: 0, ty: 0, tw: 0 }], params: CANONICAL },
    SIZE,
  );
  return dabs[0]!.r;
}

function rgb(r: number, g: number, b: number): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, 255]);
}

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function srgbByteToPixel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(linearToSrgb(value) * 255)));
}

function dab(overrides: Partial<LiftDab> = {}): LiftDab {
  return { x: 0.5, y: 0.5, r: 0.05, amount: 0.4, ...overrides };
}

// ---------------------------------------------------------------------------
// 261028-k03c — tip-shaped footprint doubles.
// ---------------------------------------------------------------------------

const DEG = Math.PI / 180;

function point(x: number, y: number, tiltX = 0, tiltY = 0) {
  return { x, y, p: 0.5, tx: tiltX, ty: tiltY, tw: 0 };
}

/** A shape whose tip mask is uniform, so the sampled mask is a known scalar. */
function shape(overrides: Partial<LiftFootprintShape> = {}): LiftFootprintShape {
  return {
    tipData: new Uint8Array(4).fill(255),
    tipSize: 2,
    aspect: 1,
    angle: 0,
    rotation: 'fixed',
    ...overrides,
  };
}

/** Read a coverage pixel, treating anything outside the rect as untouched. */
function coverageAt(
  coverage: Float32Array,
  rect: LiftCoverageRect,
  x: number,
  y: number,
): number {
  if (x < rect.x || x >= rect.x + rect.width || y < rect.y || y >= rect.y + rect.height) return 1;
  return coverage[(y - rect.y) * rect.width + (x - rect.x)]!;
}

describe('collectLiftDabs — the engine footprint law', () => {
  it('maps canonical size 12 to the engine size and size multiplier', () => {
    expect(SIZE_MULT).toBeCloseTo(0.7598357, 6);
    expect(radiusForPressure(0)).toBeCloseTo((0.012 + 0.03 * 0) * SIZE_MULT, 6);
    expect(radiusForPressure(0)).toBeCloseTo(0.009118, 5);
    expect(radiusForPressure(0.5)).toBeCloseTo((0.012 + 0.03 * 0.5) * SIZE_MULT, 6);
    expect(radiusForPressure(0.5)).toBeCloseTo(0.0205156, 6);
    expect(radiusForPressure(1)).toBeCloseTo((0.012 + 0.03) * SIZE_MULT, 6);
    expect(radiusForPressure(1)).toBeCloseTo(0.0319131, 6);
  });

  it('uses 0.22 for a moving dab and 0.0293333 for a stationary dwell dab', () => {
    expect(HOST_DT_SECONDS).toBe(1 / 60);
    const moving = collectLiftDabs(
      { points: [{ x: 0.5, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 }], params: CANONICAL },
      SIZE,
    );
    expect(moving[0]!.amount).toBeCloseTo(0.22, 9);

    const dwell = collectLiftDabs(
      {
        points: [
          { x: 0.5, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
          { x: 0.5, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
        ],
        params: CANONICAL,
      },
      SIZE,
    );
    expect(dwell[1]!.amount).toBeCloseTo(Math.min(0.9, 0.22 * 8 * HOST_DT_SECONDS), 9);
    expect(dwell[1]!.amount).toBeCloseTo(0.0293333, 6);
  });

  it('spaces dabs at half the footprint radius along the segment', () => {
    const dabs = collectLiftDabs(
      {
        points: [
          { x: 0, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
          { x: 0.5, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
        ],
        params: CANONICAL,
      },
      SIZE,
    );
    expect(dabs.length).toBeGreaterThan(2);
    const spacing = 0.5 * radiusForPressure(0.5);
    for (let i = 1; i < dabs.length; i += 1) {
      expect(dabs[i]!.x - dabs[i - 1]!.x).toBeCloseTo(spacing, 6);
    }
  });

  it('interpolates pressure along the segment, so radius grows', () => {
    const dabs = collectLiftDabs(
      {
        points: [
          { x: 0, y: 0.5, p: 0, tx: 0, ty: 0, tw: 0 },
          { x: 0.5, y: 0.5, p: 1, tx: 0, ty: 0, tw: 0 },
        ],
        params: CANONICAL,
      },
      SIZE,
    );
    expect(dabs[dabs.length - 1]!.r).toBeGreaterThan(dabs[0]!.r);
    expect(dabs[0]!.r).toBeCloseTo(radiusForPressure(0), 6);
    expect(dabs[dabs.length - 1]!.r).toBeGreaterThan(radiusForPressure(0.5));
  });

  it('emits exactly one dwell dab per duplicate point and one dab for a single point', () => {
    const single = collectLiftDabs(
      { points: [{ x: 0.2, y: 0.4, p: 0.5, tx: 0, ty: 0, tw: 0 }], params: CANONICAL },
      SIZE,
    );
    expect(single).toHaveLength(1);
    expect(single[0]!.amount).toBeCloseTo(0.22, 9);

    const duplicates = collectLiftDabs(
      {
        points: [
          { x: 0.3, y: 0.3, p: 0.5, tx: 0, ty: 0, tw: 0 },
          { x: 0.3, y: 0.3, p: 0.5, tx: 0, ty: 0, tw: 0 },
          { x: 0.3, y: 0.3, p: 0.5, tx: 0, ty: 0, tw: 0 },
        ],
        params: CANONICAL,
      },
      SIZE,
    );
    expect(duplicates).toHaveLength(3);
    expect(duplicates[1]!.amount).toBeCloseTo(Math.min(0.9, 0.22 * 8 * HOST_DT_SECONDS), 9);
    expect(duplicates[2]!.amount).toBeCloseTo(Math.min(0.9, 0.22 * 8 * HOST_DT_SECONDS), 9);
  });

  it('caps a pathological stroke at 50000 dabs', () => {
    const points = Array.from({ length: 60_000 }, () => ({
      x: 0.4,
      y: 0.6,
      p: 0.5,
      tx: 0,
      ty: 0,
      tw: 0,
    }));
    const dabs = collectLiftDabs({ points, params: CANONICAL }, SIZE);
    expect(dabs).toHaveLength(50_000);
  });

  it('treats the negative pressure sentinel as 0.45', () => {
    expect(radiusForPressure(-1)).toBeCloseTo((0.012 + 0.03 * 0.45) * SIZE_MULT, 6);
  });

  it('uses the recorded Lift strength, and 0.22 when the key is absent', () => {
    const stroke = (params: Record<string, number>) => collectLiftDabs(
      { points: [{ x: 0.5, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 }], params },
      SIZE,
    )[0]!.amount;
    expect(stroke({ size: 12 })).toBeCloseTo(0.22, 9);
    expect(stroke({ size: 12, lift: 90 })).toBeCloseTo(0.9, 9);
    expect(stroke({ size: 12, lift: 5 })).toBeCloseTo(0.05, 9);
    // The engine's own ceiling.
    expect(stroke({ size: 12, lift: 100 })).toBeCloseTo(0.9, 9);
    // The dwell dab scales with the same strength.
    const dwell = collectLiftDabs(
      {
        points: [
          { x: 0.5, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
          { x: 0.5, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
        ],
        params: { size: 12, lift: 90 },
      },
      SIZE,
    )[1]!;
    expect(dwell.amount).toBeCloseTo(Math.min(0.9, 0.9 * 8 * HOST_DT_SECONDS), 9);
  });

  it('carries unspent spacing across recorded segments', () => {
    // Each segment is shorter than the 0.5r spacing, the pair is longer. The
    // old per-segment restart emitted no dab at all; the engine's carry emits
    // the dab where the combined distance reaches the spacing.
    const spacing = 0.5 * radiusForPressure(0.5);
    const dabs = collectLiftDabs(
      {
        points: [
          { x: 0, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
          { x: spacing * 0.6, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
          { x: spacing * 1.2, y: 0.5, p: 0.5, tx: 0, ty: 0, tw: 0 },
        ],
        params: CANONICAL,
      },
      SIZE,
    );
    expect(dabs).toHaveLength(2);
    expect(dabs[1]!.x).toBeCloseTo(spacing, 6);
  });

  it('returns nothing for an empty stroke', () => {
    expect(collectLiftDabs({ points: [], params: CANONICAL }, SIZE)).toEqual([]);
  });

  // 261029-eur: the ONE footprint law. The drawn ribbon derives its radius
  // through `liftRadiusDoc`; this pins that the punch stamps with the very
  // same exported helper, so the two can never drift.
  it('stamps r through the exported liftRadiusDoc law', () => {
    const cases: Array<{ params: Record<string, number>; pressure: number }> = [
      { params: CANONICAL, pressure: 0.5 },
      { params: CANONICAL, pressure: 0 },
      { params: { size: 120 }, pressure: 1 },
    ];
    for (const { params, pressure } of cases) {
      const dabs = collectLiftDabs(
        { points: [{ ...point(0.5, 0.5), p: pressure }], params },
        SIZE,
      );
      expect(dabs[0]!.r).toBeCloseTo(
        liftRadiusDoc(pressure, liftEngineSize(params)),
        12,
      );
    }
  });
});

describe('buildLiftCoverage — UV to pixel mapping and rect bounds', () => {
  it('flips y and treats r as document heights on both axes', () => {
    const width = 400;
    const height = 200;
    const { coverage, coverageRect } = buildLiftCoverage(
      [dab({ x: 0.25, y: 0.75, r: 0.05 })],
      width,
      height,
    );
    const covers = (x: number, y: number) =>
      coverage[(y - coverageRect.y) * coverageRect.width + (x - coverageRect.x)]!;
    // (0.25, 0.75) → pixel (100, 50); the mirrored row 150 must be untouched.
    expect(covers(100, 50)).toBeLessThan(1);
    const mirrored = 150;
    const insideMirrored =
      mirrored >= coverageRect.y && mirrored < coverageRect.y + coverageRect.height;
    if (insideMirrored) expect(covers(100, mirrored)).toBe(1);
    expect(coverageRect.y).toBeLessThanOrEqual(50);
    expect(coverageRect.y + coverageRect.height).toBeGreaterThan(50);
  });

  it('maps a dab on the top UV edge to row 0', () => {
    const { coverage, coverageRect } = buildLiftCoverage(
      [dab({ x: 0.5, y: 1, r: 0.1 })],
      20,
      20,
    );
    expect(coverageRect.y).toBe(0);
    expect(coverage[(0 - coverageRect.y) * coverageRect.width + (10 - coverageRect.x)]).toBeLessThan(1);
  });

  it('allocates only over the union bbox and leaves the rest of the frame out', () => {
    const width = 64;
    const height = 48;
    const dabs = [dab({ x: 0.25, y: 0.5, r: 0.1 }), dab({ x: 0.75, y: 0.5, r: 0.1 })];
    const { coverage, coverageRect } = buildLiftCoverage(dabs, width, height);
    expect(coverage).toHaveLength(coverageRect.width * coverageRect.height);
    expect(coverageRect.width * coverageRect.height).toBeLessThan(width * height);
    for (let y = coverageRect.y; y < coverageRect.y + coverageRect.height; y += 1) {
      for (let x = coverageRect.x; x < coverageRect.x + coverageRect.width; x += 1) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(width);
        expect(y).toBeLessThan(height);
      }
    }
    // Every written pixel sits inside the rect; nothing outside exists to write.
    let written = 0;
    for (let i = 0; i < coverage.length; i += 1) if (coverage[i]! < 1) written += 1;
    expect(written).toBeGreaterThan(0);
  });

  it('returns an empty rect for no dabs', () => {
    const { coverage, coverageRect } = buildLiftCoverage([], 10, 10);
    expect(coverageRect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(coverage).toHaveLength(1);
  });

  it('multiplies overlapping dabs', () => {
    const { coverage, coverageRect } = buildLiftCoverage(
      [dab({ x: 0.5, y: 0.5, r: 0.1, amount: 0.3 }), dab({ x: 0.5, y: 0.5, r: 0.1, amount: 0.2 })],
      32,
      32,
    );
    const single = coverage[(16 - coverageRect.y) * coverageRect.width + (16 - coverageRect.x)]!;
    // K = (1 - f)^2 at the centre.
    const expected = Math.pow(1 - 0.3, 1) * Math.pow(1 - 0.2, 1);
    expect(single).toBeCloseTo(expected, 5);
  });
});

describe('punchTransmittanceRgba — t^K in linear light', () => {
  it('applies the exponent in LINEAR light, not on the sRGB byte', () => {
    const pixels = rgb(64, 64, 64);
    const coverage = new Float32Array([0.5]);
    const rect: LiftCoverageRect = { x: 0, y: 0, width: 1, height: 1 };
    punchTransmittanceRgba(pixels, coverage, 1, 1, rect);

    const expected = srgbByteToPixel(Math.pow(srgbToLinear(64), 0.5));
    expect(Math.abs(pixels[0]! - expected)).toBeLessThanOrEqual(1);
    // Negative control: applying the exponent to the sRGB byte directly would
    // land on 128 at v=64; the linear-light law must differ by more than 1 LSB.
    const naive = Math.round(Math.sqrt(64 / 255) * 255);
    expect(Math.abs(expected - naive)).toBeGreaterThan(1);
    expect(Math.abs(pixels[0]! - naive)).toBeGreaterThan(1);
  });

  it('never writes alpha and leaves pixels outside the rect byte-identical', () => {
    const width = 4;
    const height = 2;
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = 96;
      pixels[i + 1] = 128;
      pixels[i + 2] = 200;
      pixels[i + 3] = 255;
    }
    const before = new Uint8ClampedArray(pixels);
    const coverage = new Float32Array([0.5]);
    punchTransmittanceRgba(pixels, coverage, width, height, { x: 1, y: 0, width: 1, height: 1 });

    for (let i = 0; i < pixels.length; i += 4) expect(pixels[i + 3]).toBe(255);
    // Pixel (1,0) = index 4..7 was punched; every other pixel is untouched.
    expect(pixels[4]).not.toBe(before[4]);
    for (const index of [0, 8, 12, 16, 20, 24, 28]) {
      expect(pixels[index]).toBe(before[index]);
      expect(pixels[index + 1]).toBe(before[index + 1]);
      expect(pixels[index + 2]).toBe(before[index + 2]);
    }
  });

  it('treats a zero-amount dab as a no-op', () => {
    const pixels = rgb(64, 64, 64);
    const { coverage, coverageRect } = buildLiftCoverage(
      [dab({ amount: 0 })],
      16,
      16,
    );
    punchTransmittanceRgba(pixels, coverage, 1, 1, { x: 0, y: 0, width: 1, height: 1 });
    expect(coverageRect.width).toBeGreaterThan(0);
    expect(Array.from(pixels)).toEqual([64, 64, 64, 255]);
  });

  it('makes two overlapping dabs equal two sequential punches', () => {
    const width = 32;
    const height = 32;
    const base = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < base.length; i += 4) {
      base[i] = (i * 7) % 200;
      base[i + 1] = (i * 11) % 200;
      base[i + 2] = (i * 13) % 200;
      base[i + 3] = 255;
    }
    const single = buildLiftCoverage([dab({ amount: 0.4, r: 0.2 })], width, height);
    const twin = buildLiftCoverage(
      [dab({ amount: 0.4, r: 0.2 }), dab({ amount: 0.4, r: 0.2 })],
      width,
      height,
    );

    const sequential = new Uint8ClampedArray(base);
    punchTransmittanceRgba(sequential, single.coverage, width, height, single.coverageRect);
    punchTransmittanceRgba(sequential, single.coverage, width, height, single.coverageRect);

    const once = new Uint8ClampedArray(base);
    punchTransmittanceRgba(once, twin.coverage, width, height, twin.coverageRect);

    for (let i = 0; i < once.length; i += 1) {
      expect(Math.abs(once[i]! - sequential[i]!)).toBeLessThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// Canvas doubles — node has no DOM; the wrappers must stay injectable.
// ---------------------------------------------------------------------------

interface FakeCanvas {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  ownerDocument: { createElement: (tag: string) => FakeCanvas };
  getContext: (id: string) => {
    getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray; width: number; height: number };
    putImageData: (image: { data: Uint8ClampedArray }, x: number, y: number) => void;
  } | null;
}

function makeCanvas(width: number, height: number, color: [number, number, number, number]): FakeCanvas {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3];
  }
  const canvas: FakeCanvas = {
    width,
    height,
    pixels,
    ownerDocument: { createElement: () => makeCanvas(width, height, [0, 0, 0, 0]) },
    getContext: () => ({
      // A real getImageData returns a COPY — the double must too, or the
      // punch would appear to mutate the source.
      getImageData: (_x, _y, w, h) => ({
        data: new Uint8ClampedArray(canvas.pixels),
        width: w,
        height: h,
      }),
      putImageData: (image) => {
        canvas.pixels.set(image.data);
      },
    }),
  };
  return canvas;
}

function asHtmlCanvas(canvas: FakeCanvas): HTMLCanvasElement {
  return canvas as unknown as HTMLCanvasElement;
}

describe('punchTransmittanceCanvas — never mutates its source', () => {
  it('returns a different canvas and leaves the source pixels unchanged', () => {
    const source = makeCanvas(8, 8, [80, 80, 80, 255]);
    const before = new Uint8ClampedArray(source.pixels);
    const punched = punchTransmittanceCanvas(asHtmlCanvas(source), [dab({ amount: 0.5, r: 0.3 })]);
    expect(punched).not.toBeNull();
    expect(punched).not.toBe(asHtmlCanvas(source));
    expect(Array.from(source.pixels)).toEqual(Array.from(before));
    const output = punched as unknown as FakeCanvas;
    expect(Array.from(output.pixels)).not.toEqual(Array.from(before));
    // The punch drove the grey toward white at the dab centre (4, 4).
    const centre = (4 * 8 + 4) * 4;
    expect(output.pixels[centre]).toBeGreaterThan(before[centre]!);
  });

  it('returns null when the source has no 2D readback', () => {
    const source = makeCanvas(4, 4, [0, 0, 0, 255]);
    source.getContext = () => null;
    expect(punchTransmittanceCanvas(asHtmlCanvas(source), [dab()])).toBeNull();
  });

  it('returns null without a document to create the target canvas', () => {
    const source = makeCanvas(4, 4, [0, 0, 0, 255]);
    (source as { ownerDocument?: unknown }).ownerDocument = undefined;
    expect(punchTransmittanceCanvas(asHtmlCanvas(source), [dab()])).toBeNull();
  });
});

describe('punchTransmittanceBytes — changed flag (261028-k03h)', () => {
  it('reports changed:false when the dabs hit already-erased (white) pixels', async () => {
    const result = await punchTransmittanceBytes(new Uint8Array([1]), { width: 16, height: 16 }, [dab({ amount: 0.9, r: 0.4 })], {
      appFrame: 1,
      codec: {
        decode: async () => asHtmlCanvas(makeCanvas(16, 16, [255, 255, 255, 255])),
        encode: async () => new Uint8Array([1, 2]),
      },
    });
    expect(result).not.toBeNull();
    expect(result!.changed).toBe(false);
  });

  it('reports changed:true when the dabs remove pigment', async () => {
    const result = await punchTransmittanceBytes(new Uint8Array([1]), { width: 16, height: 16 }, [dab({ amount: 0.9, r: 0.4 })], {
      appFrame: 1,
      codec: {
        decode: async () => asHtmlCanvas(makeCanvas(16, 16, [80, 80, 80, 255])),
        encode: async () => new Uint8Array([1, 2]),
      },
    });
    expect(result).not.toBeNull();
    expect(result!.changed).toBe(true);
  });

  it('reports changed:false with no dabs (the source is re-encoded as-is)', async () => {
    const result = await punchTransmittanceBytes(new Uint8Array([1]), { width: 4, height: 2 }, [], {
      appFrame: 1,
      codec: {
        decode: async () => asHtmlCanvas(makeCanvas(4, 2, [80, 80, 80, 255])),
        encode: async () => new Uint8Array([1, 2]),
      },
    });
    expect(result).not.toBeNull();
    expect(result!.changed).toBe(false);
  });
});

describe('punchTransmittanceBytes — awaited codec both legs', () => {
  it('awaits decode and encode once each and returns the resolved bytes', async () => {
    const input = new Uint8Array([1, 2, 3]);
    const source = makeCanvas(4, 2, [120, 120, 120, 255]);
    let decodeCalls = 0;
    let encodeCalls = 0;
    const result = await punchTransmittanceBytes(input, { width: 4, height: 2 }, [dab({ amount: 0.5, r: 0.4 })], {
      appFrame: 7,
      codec: {
        decode: async (bytes) => {
          decodeCalls += 1;
          // The caller's bytes are copied before any codec sees them.
          expect(bytes).not.toBe(input);
          return asHtmlCanvas(source);
        },
        encode: async (canvas, size, appFrame) => {
          encodeCalls += 1;
          await Promise.resolve();
          expect(canvas.width).toBe(size.width);
          expect(appFrame).toBe(7);
          return new Uint8Array([7, 8, 9]);
        },
      },
    });
    expect(decodeCalls).toBe(1);
    expect(encodeCalls).toBe(1);
    expect(result).not.toBeNull();
    expect(Array.from(result!.bytes)).toEqual([7, 8, 9]);
    expect(result!.canvas.width).toBe(4);
    // A synchronous `.bytes` read on the encode promise would surface undefined.
    expect(result!.bytes).toBeInstanceOf(Uint8Array);
  });

  it('never mutates the caller bytes', async () => {
    const input = new Uint8Array([4, 5, 6]);
    await punchTransmittanceBytes(input, { width: 4, height: 2 }, [dab()], {
      appFrame: 1,
      codec: {
        decode: async () => asHtmlCanvas(makeCanvas(4, 2, [100, 100, 100, 255])),
        encode: async () => new Uint8Array([1]),
      },
    });
    expect(Array.from(input)).toEqual([4, 5, 6]);
  });

  it('returns null when decode or encode cannot produce pixels', async () => {
    const nullDecode = await punchTransmittanceBytes(new Uint8Array([1]), { width: 4, height: 2 }, [dab()], {
      appFrame: 1,
      codec: {
        decode: async () => null,
        encode: async () => new Uint8Array([1]),
      },
    });
    expect(nullDecode).toBeNull();

    const throwingEncode = await punchTransmittanceBytes(new Uint8Array([1]), { width: 4, height: 2 }, [dab()], {
      appFrame: 1,
      codec: {
        decode: async () => asHtmlCanvas(makeCanvas(4, 2, [100, 100, 100, 255])),
        encode: async () => {
          throw new Error('encode failed');
        },
      },
    });
    expect(throwingEncode).toBeNull();

    const emptyEncode = await punchTransmittanceBytes(new Uint8Array([1]), { width: 4, height: 2 }, [dab()], {
      appFrame: 1,
      codec: {
        decode: async () => asHtmlCanvas(makeCanvas(4, 2, [100, 100, 100, 255])),
        encode: async () => new Uint8Array(0),
      },
    });
    expect(emptyEncode).toBeNull();
  });

  it('re-encodes the source unchanged when there are no dabs', async () => {
    let punchedBytes: Uint8Array | null = null;
    const result = await punchTransmittanceBytes(new Uint8Array([1]), { width: 4, height: 2 }, [], {
      appFrame: 2,
      codec: {
        decode: async () => asHtmlCanvas(makeCanvas(4, 2, [90, 90, 90, 255])),
        encode: async () => {
          punchedBytes = new Uint8Array([2, 4, 6]);
          return punchedBytes;
        },
      },
    });
    expect(result).not.toBeNull();
    expect(Array.from(result!.bytes)).toEqual([2, 4, 6]);
  });
});

// ---------------------------------------------------------------------------
// 261028-k03c — the tip-shaped footprint: per-dab angle + the punch mirror.
//
// The angle law mirrors Engine.brushAngle (Engine.ts:1550) so the live pass
// and the punch cannot disagree:
//   fixed  → the sticky recorded pen-tilt azimuth, else the preset angle;
//   follow → the segment direction + the preset angle;
//   random → the preset angle (declared approximation — the engine's RNG is
//            not reproducible from the record, already true of the bake).
// ---------------------------------------------------------------------------

describe('collectLiftDabs — per-dab tip angle (261028-k03c)', () => {
  it('fixed rotation with no tilt uses the preset angle for every dab', () => {
    const presetAngle = 30 * DEG;
    const dabs = collectLiftDabs(
      { points: [point(0.1, 0.5), point(0.4, 0.5), point(0.4, 0.8)], params: CANONICAL },
      SIZE,
      shape({ angle: presetAngle }),
    );
    expect(dabs.length).toBeGreaterThan(2);
    for (const one of dabs) expect(one.angle).toBeCloseTo(presetAngle, 9);
  });

  it('fixed rotation replaces the preset angle with the recorded tilt azimuth', () => {
    const dabs = collectLiftDabs(
      {
        // processInput scans the tilt BEFORE the point's stamps, so the second
        // point's tilt also governs the dabs of the segment that ends on it.
        points: [point(0.2, 0.5), point(0.4, 0.5, 0, 40)],
        params: CANONICAL,
      },
      SIZE,
      shape({ angle: 30 * DEG }),
    );
    // The first point has no tilt yet → the preset angle (π/6).
    expect(dabs[0]!.angle).toBeCloseTo(30 * DEG, 9);
    expect(dabs[dabs.length - 1]!.angle).toBeCloseTo(Math.atan2(-40, 0), 9);
    expect(dabs[dabs.length - 1]!.angle).toBeCloseTo(-Math.PI / 2, 9);
  });

  it('holds the azimuth sticky after a later untilted point', () => {
    const dabs = collectLiftDabs(
      { points: [point(0.2, 0.5, 0, -40), point(0.4, 0.5), point(0.6, 0.5)], params: CANONICAL },
      SIZE,
      shape({ angle: 30 * DEG }),
    );
    // The first point's own tilt (0, -40) → atan2(40, 0) = π/2, including its
    // own dab; the untilted points keep it (Engine.Stroke.azimuth is sticky).
    expect(dabs[0]!.angle).toBeCloseTo(Math.PI / 2, 9);
    for (const one of dabs.slice(1)) expect(one.angle).toBeCloseTo(Math.PI / 2, 9);
    // The preset angle never leaks back in after the azimuth is known.
    expect(dabs[dabs.length - 1]!.angle).not.toBeCloseTo(30 * DEG, 6);
  });

  it('follow rotation tracks the segment direction and adds the preset angle', () => {
    const dabs = collectLiftDabs(
      { points: [point(0.2, 0.5), point(0.4, 0.5), point(0.4, 0.7)], params: CANONICAL },
      SIZE,
      shape({ angle: 10 * DEG, rotation: 'follow' }),
    );
    const alongX = dabs.filter((one) => one.y === 0.5 && one.x > 0.2);
    expect(alongX.length).toBeGreaterThan(0);
    for (const one of alongX) expect(one.angle).toBeCloseTo(10 * DEG, 9);
    const alongY = dabs.filter((one) => one.x === 0.4 && one.y > 0.5);
    expect(alongY.length).toBeGreaterThan(0);
    for (const one of alongY) expect(one.angle).toBeCloseTo(Math.PI / 2 + 10 * DEG, 9);
  });

  it('random rotation holds the preset angle (declared approximation)', () => {
    const dabs = collectLiftDabs(
      { points: [point(0.1, 0.2), point(0.5, 0.6), point(0.8, 0.3, 10, 10)], params: CANONICAL },
      SIZE,
      shape({ angle: 25 * DEG, rotation: 'random' }),
    );
    expect(dabs.length).toBeGreaterThan(1);
    for (const one of dabs) expect(one.angle).toBeCloseTo(25 * DEG, 9);
  });

  it('emits angle 0 without a shape (the radial law ignores it)', () => {
    const dabs = collectLiftDabs(
      { points: [point(0.1, 0.2), point(0.5, 0.6)], params: CANONICAL },
      SIZE,
    );
    expect(dabs.length).toBeGreaterThan(0);
    for (const one of dabs) expect(one.angle).toBe(0);
  });
});

describe('liftShapeForStroke — the RECORDED brush is the punched shape', () => {
  it('resolves the preset through buildBrushForStroke, deterministically', () => {
    const overrides = { ...NEUTRAL_TOOL_OVERRIDES, aspect: 1.5 };
    const resolved = liftShapeForStroke({ brushId: 'flat', toolOverrides: overrides });
    const brush = buildBrushForStroke('flat', overrides);
    expect(resolved.tipSize).toBe(brush.tipSize);
    expect(resolved.aspect).toBeCloseTo(brush.aspect, 9);
    expect(resolved.rotation).toBe(brush.rotation);
    expect(resolved.angle).toBeCloseTo(brush.angle * DEG, 9);
    // buildBrush seeds from the preset id, so the app regenerates identical data.
    expect(Array.from(resolved.tipData)).toEqual(Array.from(brush.tipData));
  });

  it('falls back to filbert when a legacy stroke records no brushId', () => {
    const resolved = liftShapeForStroke({ brushId: '', toolOverrides: undefined });
    const brush = buildBrushForStroke('filbert');
    expect(resolved.aspect).toBeCloseTo(brush.aspect, 9);
    expect(resolved.rotation).toBe(brush.rotation);
  });
});

describe('buildLiftCoverage — the tip-shaped footprint (261028-k03c)', () => {
  it('a full-mask tip with aspect 1 reproduces the radial law inside the tip square', () => {
    const width = 200;
    const height = 200;
    const dabs = [dab({ x: 0.5, y: 0.5, r: 0.1, amount: 0.4, angle: 0 })];
    const radial = buildLiftCoverage(dabs, width, height);
    const shaped = buildLiftCoverage(dabs, width, height, shape());
    const rPx = 0.1 * height;
    let inside = 0;
    let outside = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const qx = (x - 100) / rPx;
        const qy = (100 - y) / rPx; // doc y is UP: canvas row = centre - dy
        const insideSquare = Math.max(Math.abs(qx), Math.abs(qy));
        const s = coverageAt(shaped.coverage, shaped.coverageRect, x, y);
        if (insideSquare <= 1) {
          inside += 1;
          const r = coverageAt(radial.coverage, radial.coverageRect, x, y);
          expect(Math.abs(s - r), `radial parity at ${x},${y}`).toBeLessThan(1e-6);
        } else if (insideSquare > 1.02) {
          // liftFS discards outside the tip square — and the radial law's tiny
          // tail beyond it is not reproduced.
          outside += 1;
          expect(s, `discarded pixel ${x},${y}`).toBe(1);
        }
      }
    }
    expect(inside).toBeGreaterThan(0);
    expect(outside).toBeGreaterThan(0);
  });

  it('a uniform half-mask tip scales every f by the sampled mask', () => {
    const width = 120;
    const height = 120;
    const dabs = [dab({ x: 0.5, y: 0.5, r: 0.2, amount: 0.5, angle: 0 })];
    const radial = buildLiftCoverage(dabs, width, height);
    const shaped = buildLiftCoverage(
      dabs,
      width,
      height,
      shape({ tipData: new Uint8Array(4).fill(128), tipSize: 2 }),
    );
    const mask = 128 / 255;
    // K = 1 - f with f = f_radial * mask, at every pixel of the tip square.
    for (let y = 60 - 24; y <= 60 + 24; y += 1) {
      for (let x = 60 - 24; x <= 60 + 24; x += 1) {
        const r = coverageAt(radial.coverage, radial.coverageRect, x, y);
        const s = coverageAt(shaped.coverage, shaped.coverageRect, x, y);
        expect(1 - s, `scaled f at ${x},${y}`).toBeCloseTo((1 - r) * mask, 6);
      }
    }
    // Sanity: the mask halves the deposit at the centre.
    expect(1 - coverageAt(shaped.coverage, shaped.coverageRect, 60, 60)).toBeCloseTo(
      0.5 * mask,
      5,
    );
  });

  it('aspect 0.5 shaves the short axis while the long axis keeps the radius', () => {
    const width = 400;
    const height = 400;
    const dabs = [dab({ x: 0.5, y: 0.5, r: 0.25, amount: 0.4, angle: 0 })];
    const radial = buildLiftCoverage(dabs, width, height);
    const shaped = buildLiftCoverage(dabs, width, height, shape({ aspect: 0.5 }));
    // 0.75r on the SHORT axis: q.y = 0.75 / 0.5 = 1.5 → discarded, while the
    // radial law still covers the pixel.
    expect(coverageAt(shaped.coverage, shaped.coverageRect, 200, 200 + 75)).toBe(1);
    expect(coverageAt(radial.coverage, radial.coverageRect, 200, 200 + 75)).toBeLessThan(1);
    // 0.75r on the LONG axis stays inside the tip square.
    expect(coverageAt(shaped.coverage, shaped.coverageRect, 275, 200)).toBeLessThan(1);
  });

  it('rotates the footprint with the dab angle (doc y up)', () => {
    const width = 400;
    const height = 400;
    const dabs = [dab({ x: 0.5, y: 0.5, r: 0.25, amount: 0.4, angle: Math.PI / 2 })];
    const shaped = buildLiftCoverage(dabs, width, height, shape({ aspect: 0.5 }));
    // The long axis now runs doc +y, i.e. UP in canvas rows.
    expect(coverageAt(shaped.coverage, shaped.coverageRect, 200, 200 - 75)).toBeLessThan(1);
    // The short axis now runs doc x → 0.75r is discarded.
    expect(coverageAt(shaped.coverage, shaped.coverageRect, 275, 200)).toBe(1);
  });

  it('keeps overlapping shaped dabs multiplicative', () => {
    const twin = buildLiftCoverage(
      [dab({ amount: 0.4, r: 0.2 }), dab({ amount: 0.4, r: 0.2 })],
      64,
      64,
      shape(),
    );
    const centre = coverageAt(twin.coverage, twin.coverageRect, 32, 32);
    expect(centre).toBeCloseTo((1 - 0.4) * (1 - 0.4), 5);
  });

  it('pins LIFT_TIP_ROUND to the engine binding (uRound = 0)', () => {
    expect(LIFT_TIP_ROUND).toBe(0);
  });

  it('forwards the shape to punchTransmittanceBytes (an empty tip erases nothing)', async () => {
    let encodedPixels: number[] = [];
    const result = await punchTransmittanceBytes(
      new Uint8Array([1]),
      { width: 4, height: 4 },
      [dab({ amount: 0.9, r: 0.5 })],
      {
        appFrame: 1,
        shape: shape({ tipData: new Uint8Array(4), tipSize: 2 }),
        codec: {
          decode: async () => asHtmlCanvas(makeCanvas(4, 4, [50, 50, 50, 255])),
          encode: async (canvas) => {
            encodedPixels = Array.from((canvas as unknown as FakeCanvas).pixels);
            return new Uint8Array([1]);
          },
        },
      },
    );
    expect(result).not.toBeNull();
    // f = amount * envelope * mask = 0 everywhere → K = 1 → byte-identical.
    expect(encodedPixels).toEqual(new Array(16).fill([50, 50, 50, 255]).flat());
  });
});
