import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyPaperPass, encodePassTiles, getPaperPassTile } from './paperPass';
import { resetProjectPaperRasterForTests, subscribeProjectPaperCanvas } from './projectPaperRaster';

// 260925-iy6 — Task 1 RED pins for the dynamic post-bake paper pass.
//
// P1 encode: the signed height model s = (h - 0.5) * 2 * strength is evaluated
// at TILE BUILD time only; valleys floor at the paper's own tint (never black —
// the locked hole-color semantics), peaks lift toward the tint, strength 0 is
// fully neutral (None preset), alpha stays 255 (straight-alpha D-02).
//
// P2 build: the height field is piped through the ONE shared conditioner
// (260925-dso law), the cache key carries all five terms, grain-off/unresolved
// textures return null with ZERO canvas ops, and the cache is bounded on both
// axes (12-entry cap + 64MB byte budget, oldest-first, just-inserted retained).
//
// P3 apply: ONE shared routine, GPU draws only — a unified op log spanning the
// passed context AND the routine's internal scratch context, first op save,
// last op restore, GCO order multiply → lighten → destination-in → copy,
// 'destination-out' (alpha-punch) locked absent, no pixel-array canvas API.

type PixelDataFactory = (width: number, height: number) => Uint8ClampedArray;

const CONTEXT_OPS = new Set([
  'save',
  'restore',
  'drawImage',
  'fillRect',
  'clearRect',
  'createPattern',
  'setTransform',
  'getImageData',
  'putImageData',
  'fillStyle',
]);

const PIXEL_ARRAY_API = /getImageData|putImageData/;

const TINT = { r: 230, g: 224, b: 212 };

function bytesOf(map: Uint8ClampedArray, index: number): number[] {
  const offset = index * 4;
  return [map[offset], map[offset + 1], map[offset + 2], map[offset + 3]];
}

/** Fills a full RGBA buffer (any per-pixel values the caller wants). */
function constantData(value: number): PixelDataFactory {
  return (width, height) => new Uint8ClampedArray(width * height * 4).fill(value);
}

/** Varied checker pattern — cache identity never depends on pixel content. */
function variedData(): PixelDataFactory {
  return (width, height) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      const value = i % 2 === 0 ? 40 : 220;
      data[i * 4] = value;
      data[i * 4 + 1] = value;
      data[i * 4 + 2] = value;
      data[i * 4 + 3] = 255;
    }
    return data;
  };
}

interface Harness {
  log: string[];
  createElement: ReturnType<typeof vi.fn>;
  makeCanvas(): any;
  setData(factory: PixelDataFactory): void;
  preload(paperTexture: string): void;
  clearLog(): void;
}

/**
 * Canvas/image harness: EVERY context the factory hands out (the caller's own
 * context AND any scratch context a routine creates) appends to ONE shared log,
 * so an apply-contract pin spans a whole routine. gco assignments log their
 * assigned value; pixel reads/writes log their API name.
 */
function createHarness(initialData: PixelDataFactory): Harness {
  const log: string[] = [];
  const images: any[] = [];
  const state = { dataFor: initialData };

  class FakeImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    width = 4;
    height = 4;
    private _src = '';
    constructor() {
      images.push(this);
    }
    set src(value: string) {
      this._src = value;
    }
    get src() {
      return this._src;
    }
  }

  const makeContext = (canvas: any) => {
    let gco = 'source-over';
    const context: any = {
      canvas,
      globalAlpha: 1,
      fillStyle: '',
      save: () => log.push('save'),
      restore: () => log.push('restore'),
      drawImage: () => log.push('drawImage'),
      fillRect: () => log.push('fillRect'),
      clearRect: () => log.push('clearRect'),
      createPattern: () => {
        log.push('createPattern');
        return { setTransform: () => log.push('setTransform') };
      },
      createImageData: (width: number, height: number) => ({
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4),
      }),
      getImageData: (_x: number, _y: number, width: number, height: number) => {
        log.push('getImageData');
        return { width, height, data: state.dataFor(width, height) };
      },
      putImageData: (imageData: { data: Uint8ClampedArray }) => {
        log.push('putImageData');
        canvas.pixels = imageData.data;
      },
    };
    Object.defineProperty(context, 'globalCompositeOperation', {
      get: () => gco,
      set: (value: unknown) => {
        gco = String(value);
        log.push(gco);
      },
    });
    return context;
  };

  const makeCanvas = () => {
    const canvas: any = { width: 0, height: 0, pixels: null as Uint8ClampedArray | null };
    canvas.getContext = () => (canvas.__context ??= makeContext(canvas));
    return canvas;
  };

  const createElement = vi.fn((_tag: string) => makeCanvas());

  vi.stubGlobal('document', { createElement });
  vi.stubGlobal('Image', FakeImage);

  return {
    log,
    createElement,
    makeCanvas,
    setData: (factory) => {
      state.dataFor = factory;
    },
    preload(paperTexture: string) {
      const before = images.length;
      const unsubscribe = subscribeProjectPaperCanvas(paperTexture, 4, 4, () => {});
      if (images.length > before) images[images.length - 1]?.onload?.();
      unsubscribe();
    },
    clearLog: () => {
      log.length = 0;
    },
  };
}

const paperPassSource = readFileSync(new URL('./paperPass.ts', import.meta.url), 'utf8');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetProjectPaperRasterForTests();
});

describe('260925-iy6 P1 — encodePassTiles (signed height at build time)', () => {
  it('P1(a) neutral height 0.5 encodes white valley + black peak (no-op for multiply/lighten)', () => {
    const { valley, peak } = encodePassTiles(new Float32Array([0.5]), 1, 1, 0.65, TINT);
    expect(bytesOf(valley, 0)).toEqual([255, 255, 255, 255]);
    expect(bytesOf(peak, 0)).toEqual([0, 0, 0, 255]);
  });

  it('P1(b) h=0.1 at strength 0.65 floors the valley at the PAPER TINT (never black multiply)', () => {
    // s = (0.1 - 0.5) * 2 * 0.65 = -0.52 → v = 0.52
    // valley = round(255 - v * (255 - tint)) per channel → [242, 239, 233]
    const { valley } = encodePassTiles(new Float32Array([0.1]), 1, 1, 0.65, TINT);
    expect(bytesOf(valley, 0)).toEqual([242, 239, 233, 255]);
    // Every channel stays far above 100 — the darkening is toward the paper's
    // own tone, never toward 0 (black multiply is a locked rejection).
    for (const channel of bytesOf(valley, 0)) expect(channel).toBeGreaterThan(100);
  });

  it('P1(c) h=0.9 at strength 0.65 lifts the peak toward the tint (fiber relief)', () => {
    // s = (0.9 - 0.5) * 2 * 0.65 = 0.52 → u = 0.52
    // peak = round(u * tint) per channel → [120, 116, 110]
    const { peak } = encodePassTiles(new Float32Array([0.9]), 1, 1, 0.65, TINT);
    expect(bytesOf(peak, 0)).toEqual([120, 116, 110, 255]);
  });

  it('P1(d) strength 0 (None) is fully neutral regardless of height', () => {
    const heights = new Float32Array([0.1, 0.5, 0.9, 0.0, 1.0]);
    const { valley, peak } = encodePassTiles(heights, 5, 1, 0, TINT);
    for (let index = 0; index < heights.length; index++) {
      expect(bytesOf(valley, index)).toEqual([255, 255, 255, 255]);
      expect(bytesOf(peak, index)).toEqual([0, 0, 0, 255]);
    }
  });

  it('P1(e) every output alpha byte is 255 (straight-alpha tiles)', () => {
    const { valley, peak } = encodePassTiles(new Float32Array([0.1, 0.5, 0.9, 0.73]), 2, 2, 0.95, TINT);
    expect(valley.length).toBe(2 * 2 * 4);
    expect(peak.length).toBe(2 * 2 * 4);
    for (let offset = 3; offset < valley.length; offset += 4) {
      expect(valley[offset]).toBe(255);
      expect(peak[offset]).toBe(255);
    }
  });
});

describe('260925-iy6 P2 — getPaperPassTile build + cache', () => {
  it('P2(b) pipes the height field through conditionHeightMap (flat input → neutral tiles)', () => {
    const harness = createHarness(constantData(200));
    harness.preload('canvas2');
    harness.clearLog();
    const tile = getPaperPassTile('canvas2', 8, 8, 1, 0.65);
    expect(tile).not.toBeNull();
    // Constant 200 → raw h = 0.784 → mean-centred to 0.5 → NEUTRAL output.
    // Unconditioned (h = 0.784) would encode peak rgb = round(0.369 * tint),
    // so a non-neutral tile proves the shared conditioner was skipped.
    const valleyPixels = (tile!.valley as any).pixels as Uint8ClampedArray;
    const peakPixels = (tile!.peak as any).pixels as Uint8ClampedArray;
    expect(valleyPixels.length).toBe(8 * 8 * 4);
    expect(peakPixels.length).toBe(8 * 8 * 4);
    for (let index = 0; index < 8 * 8; index++) {
      expect(bytesOf(valleyPixels, index)).toEqual([255, 255, 255, 255]);
      expect(bytesOf(peakPixels, index)).toEqual([0, 0, 0, 255]);
    }
  });

  it('P2(c) same params hit the cache; each of the five key terms isolates a miss', () => {
    const harness = createHarness(variedData());
    harness.preload('canvas1');
    harness.preload('canvas2');
    const base = getPaperPassTile('canvas2', 6, 6, 1, 0.35);
    expect(base).not.toBeNull();
    expect(getPaperPassTile('canvas2', 6, 6, 1, 0.35)).toBe(base);

    const variants: Array<[string, () => ReturnType<typeof getPaperPassTile>]> = [
      ['paperTexture', () => getPaperPassTile('canvas1', 6, 6, 1, 0.35)],
      ['width', () => getPaperPassTile('canvas2', 7, 6, 1, 0.35)],
      ['height', () => getPaperPassTile('canvas2', 6, 7, 1, 0.35)],
      ['grainScale', () => getPaperPassTile('canvas2', 6, 6, 2, 0.35)],
      ['strength', () => getPaperPassTile('canvas2', 6, 6, 1, 0.95)],
    ];
    for (const [term, build] of variants) {
      const variant = build();
      expect(variant, term).not.toBeNull();
      expect(variant, term).not.toBe(base);
    }
  });

  it("P2(d) grain-off '' returns null with zero canvas ops (CR-01 gate)", () => {
    const harness = createHarness(variedData());
    harness.preload('canvas2');
    harness.clearLog();
    harness.createElement.mockClear();
    expect(getPaperPassTile('', 6, 6, 1, 0.35)).toBeNull();
    expect(harness.log).toEqual([]);
    expect(harness.createElement).not.toHaveBeenCalled();
  });

  it('P2(e) an unresolved texture returns null with zero canvas ops (deterministic skip)', () => {
    const harness = createHarness(variedData());
    harness.clearLog();
    harness.createElement.mockClear();
    expect(getPaperPassTile('canvas3', 6, 6, 1, 0.35)).toBeNull();
    expect(harness.log).toEqual([]);
    expect(harness.createElement).not.toHaveBeenCalled();
  });

  it('P2(f) byte budget evicts oldest-first and never drops the just-inserted entry', () => {
    const harness = createHarness(constantData(200));
    harness.preload('canvas2');
    // 2560x2560 → per-entry bytes = width * height * 8 ≈ 52.4MB (fake source
    // stays 4x4 — only the ARGS size drives the accounting).
    const firstA = getPaperPassTile('canvas2', 2560, 2560, 1, 0.65);
    expect(firstA).not.toBeNull();
    // Second entry pushes the total to ≈105MB > 64MB budget → oldest-first
    // eviction runs until under budget, dropping A (and every smaller entry),
    // while the just-inserted B is retained.
    const b = getPaperPassTile('canvas2', 2560, 2560, 1, 0.95);
    expect(b).not.toBeNull();
    expect(getPaperPassTile('canvas2', 2560, 2560, 1, 0.95)).toBe(b);
    const rebuiltA = getPaperPassTile('canvas2', 2560, 2560, 1, 0.65);
    expect(rebuiltA).not.toBeNull();
    expect(rebuiltA).not.toBe(firstA);
  });
});

describe('260925-iy6 P3 — applyPaperPass shared-routine contract', () => {
  it('P3(a) a null/undefined tile returns before creating the scratch canvas or touching any context', () => {
    const harness = createHarness(constantData(200));
    const ctx = harness.makeCanvas().getContext('2d');
    harness.clearLog();
    harness.createElement.mockClear();
    applyPaperPass(ctx, 6, 6, null);
    expect(harness.log).toEqual([]);
    expect(harness.createElement).not.toHaveBeenCalled();
    applyPaperPass(ctx, 6, 6, undefined as unknown as Parameters<typeof applyPaperPass>[3]);
    expect(harness.log).toEqual([]);
    expect(harness.createElement).not.toHaveBeenCalled();
  });

  it('P3(bcd) unified op log: save first, restore last, pinned GCO order, GPU draws only', () => {
    const harness = createHarness(constantData(200));
    const canvas = harness.makeCanvas();
    const ctx = canvas.getContext('2d');
    const tile = { valley: harness.makeCanvas(), peak: harness.makeCanvas() };
    harness.clearLog();
    applyPaperPass(ctx, 6, 6, tile);

    // The literal sequence: capture → multiply valley → lighten peak →
    // destination-in alpha restore → copy writeback (5 GPU draws total).
    expect(harness.log).toEqual([
      'save', 'drawImage', 'multiply', 'drawImage', 'restore',
      'save', 'lighten', 'drawImage', 'restore',
      'save', 'destination-in', 'drawImage', 'restore',
      'save', 'copy', 'drawImage', 'restore',
    ]);
    expect(harness.log[0]).toBe('save');
    expect(harness.log[harness.log.length - 1]).toBe('restore');

    // GCO assignment order pinned; 'destination-out' (alpha-punch) locked absent.
    const gcoAssignments = harness.log.filter((entry) => !CONTEXT_OPS.has(entry));
    expect(gcoAssignments).toEqual(['multiply', 'lighten', 'destination-in', 'copy']);
    expect(gcoAssignments).not.toContain('destination-out');

    const draws = harness.log.filter((entry) => entry === 'drawImage');
    expect(draws.length).toBeLessThanOrEqual(5);

    // drawImage/composite-op only — no pixel-array read/write anywhere in the
    // routine (the only pixel work in the file lives in the BUILD path).
    expect(harness.log.filter((entry) => PIXEL_ARRAY_API.test(entry))).toEqual([]);
  });

  it('P3(e) source shape: the applyPaperPass region carries no pixel-array API identifiers', () => {
    const start = paperPassSource.indexOf('export function applyPaperPass');
    expect(start).toBeGreaterThanOrEqual(0);
    const rest = paperPassSource.slice(start);
    const nextExport = rest.indexOf('\nexport ', 1);
    const region = nextExport === -1 ? rest : rest.slice(0, nextExport);
    expect(region).not.toMatch(PIXEL_ARRAY_API);
  });
});

// 260925-iy6 WR-01 — strength must never drive the valley BELOW the paper tint.
// encodePassTiles is pure byte math, so this is unit-pinnable (unlike CR-01's
// colour law, which needs real pixels — see paperPass.composeLaw.test.ts).
//
// The encode is valley = round(255 - v * (255 - tint)) with v = max(0, -s) and
// s = (h - 0.5) * 2 * strength. v ≤ 1 keeps valley ≥ tint; v > 1 walks the
// valley PAST the paper's own tone toward black, breaking the locked hole-color
// semantics (holes read as the paper, never as black). The UI presets stay
// inside [0, 1] (None 0 / Soft 0.35 / Med 0.65 / Hard 0.95) but
// setRotoBackgroundMetadata stores whatever it is handed, so the tile builder
// is the last line of defence and must clamp.
describe('260925-iy6 WR-01 — strength clamp (valley floor is the paper tint, never black)', () => {
  it('W1(a) encodePassTiles: strength 2 at h=0 must NOT push the valley below the paper tint', () => {
    const { valley } = encodePassTiles(new Float32Array([0]), 1, 1, 2, TINT);
    expect(valley[0]).toBeGreaterThanOrEqual(TINT.r);
    expect(valley[1]).toBeGreaterThanOrEqual(TINT.g);
    expect(valley[2]).toBeGreaterThanOrEqual(TINT.b);
  });

  it('W1(b) encodePassTiles: strength 1.25 at h=0.05 must NOT push the valley below the paper tint', () => {
    // v = (0.5 - 0.05) * 2 * 1.25 = 1.125 → past the tint floor without a clamp.
    const { valley } = encodePassTiles(new Float32Array([0.05]), 1, 1, 1.25, TINT);
    expect(valley[0]).toBeGreaterThanOrEqual(TINT.r);
    expect(valley[1]).toBeGreaterThanOrEqual(TINT.g);
    expect(valley[2]).toBeGreaterThanOrEqual(TINT.b);
  });

  it('W1(c) encodePassTiles: strength 0.65 at h=0 is unchanged (the clamp must not soften Soft/Med/Hard)', () => {
    const { valley } = encodePassTiles(new Float32Array([0]), 1, 1, 0.65, TINT);
    expect(valley[0]).toBe(Math.round(255 - 0.65 * (255 - TINT.r)));
    expect(valley[1]).toBe(Math.round(255 - 0.65 * (255 - TINT.g)));
    expect(valley[2]).toBe(Math.round(255 - 0.65 * (255 - TINT.b)));
  });

  it('W1(d) getPaperPassTile entry clamps strength to [0, 1] — strength 5 builds the strength-1 tile', () => {
    const harness = createHarness(variedData());
    harness.preload('canvas2');
    const clamped = getPaperPassTile('canvas2', 6, 6, 1, 1);
    const overflow = getPaperPassTile('canvas2', 6, 6, 1, 5);
    expect(overflow).not.toBeNull();
    expect(overflow).toBe(clamped);
  });

  it('W1(e) getPaperPassTile entry treats NaN/negative strength as a deterministic skip', () => {
    const harness = createHarness(variedData());
    harness.preload('canvas2');
    harness.clearLog();
    expect(getPaperPassTile('canvas2', 6, 6, 1, Number.NaN)).toBeNull();
    expect(getPaperPassTile('canvas2', 6, 6, 1, -1)).toBeNull();
  });
});
