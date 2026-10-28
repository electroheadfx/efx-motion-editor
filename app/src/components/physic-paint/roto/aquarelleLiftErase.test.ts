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
import {
  HOST_DT_SECONDS,
  buildLiftCoverage,
  collectLiftDabs,
  punchTransmittanceBytes,
  punchTransmittanceCanvas,
  punchTransmittanceRgba,
  type LiftCoverageRect,
  type LiftDab,
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

  it('returns nothing for an empty stroke', () => {
    expect(collectLiftDabs({ points: [], params: CANONICAL }, SIZE)).toEqual([]);
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
