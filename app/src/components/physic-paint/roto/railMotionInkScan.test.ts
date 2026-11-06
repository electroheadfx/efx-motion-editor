/**
 * Rail-motion ink scan (Phase 59-08, D-17/T-59-24).
 *
 * The module owns the bounded alpha scan that the store delegates to (P4(c):
 * the store must contain no pixel-array canvas APIs). These tests stub
 * `document` with a fake canvas, so the whole contract is verifiable in the
 * node environment.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  measureRailMotionRasterInk,
  RAIL_MOTION_PIVOT_SCAN_LONG_EDGE,
} from './railMotionInkScan';

const SOURCE = {} as unknown as CanvasImageSource;

type AlphaFn = (x: number, y: number, width: number, height: number) => number;

interface FakeCanvasSetup {
  readonly canvas: { width: number; height: number };
  readonly drawImage: ReturnType<typeof vi.fn>;
  readonly createElement: ReturnType<typeof vi.fn>;
}

function installFakeDocument(
  alpha: AlphaFn,
  options: { nullContext?: boolean; throwOnDraw?: boolean } = {},
): FakeCanvasSetup {
  const drawImage = vi.fn(() => {
    if (options.throwOnDraw) throw new Error('raster released');
  });
  const canvas = { width: 0, height: 0 };
  const context = {
    clearRect: vi.fn(),
    drawImage,
    getImageData: (_x: number, _y: number, width: number, height: number) => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          data[(y * width + x) * 4 + 3] = alpha(x, y, width, height);
        }
      }
      return { data };
    },
  };
  const createElement = vi.fn(() => ({
    ...canvas,
    getContext: () => (options.nullContext ? null : context),
  }));
  // The module mutates canvas.width/height after createElement; route the
  // mutations back into the shared record so tests can assert the scan size.
  createElement.mockImplementation(() => ({
    get width() {
      return canvas.width;
    },
    set width(value: number) {
      canvas.width = value;
    },
    get height() {
      return canvas.height;
    },
    set height(value: number) {
      canvas.height = value;
    },
    getContext: () => (options.nullContext ? null : context),
  }));
  vi.stubGlobal('document', { createElement });
  return { canvas, drawImage, createElement };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('measureRailMotionRasterInk', () => {
  it('bounds the scan to the 256px long edge and returns normalized ink bounds', () => {
    // 1920x1080 -> 256x144. Ink covers x 64..191, y 36..107.
    const setup = installFakeDocument((x, y) => (x >= 64 && x <= 191 && y >= 36 && y <= 107 ? 255 : 0));

    const ink = measureRailMotionRasterInk(SOURCE, 1920, 1080);

    expect(setup.canvas).toEqual({
      width: RAIL_MOTION_PIVOT_SCAN_LONG_EDGE,
      height: 144,
    });
    expect(setup.drawImage).toHaveBeenCalledWith(SOURCE, 0, 0, 256, 144);
    expect(ink).not.toBeNull();
    expect(ink!.alphaInk).toBe(true);
    expect(ink!.x).toBeCloseTo(64 / 256, 12);
    expect(ink!.y).toBeCloseTo(36 / 144, 12);
    expect(ink!.width).toBeCloseTo(128 / 256, 12);
    expect(ink!.height).toBeCloseTo(72 / 144, 12);
  });

  it('never upscales a raster smaller than the scan grid', () => {
    const setup = installFakeDocument(() => 0);
    measureRailMotionRasterInk(SOURCE, 120, 80);
    expect(setup.canvas).toEqual({ width: 120, height: 80 });
  });

  it('returns alphaInk: false when the raster has no ink', () => {
    installFakeDocument(() => 0);
    expect(measureRailMotionRasterInk(SOURCE, 400, 300)).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      alphaInk: false,
    });
  });

  it('returns null and creates no canvas for a zero-size raster', () => {
    const setup = installFakeDocument(() => 255);
    expect(measureRailMotionRasterInk(SOURCE, 0, 200)).toBeNull();
    expect(setup.createElement).not.toHaveBeenCalled();
  });

  it('returns null when the 2d context is unavailable', () => {
    installFakeDocument(() => 255, { nullContext: true });
    expect(measureRailMotionRasterInk(SOURCE, 200, 100)).toBeNull();
  });

  it('returns null when the raster is released mid-draw', () => {
    installFakeDocument(() => 255, { throwOnDraw: true });
    expect(measureRailMotionRasterInk(SOURCE, 200, 100)).toBeNull();
  });

  it('stays free of store and evaluator imports', () => {
    // P4(c) sends this scan OUT of the store on purpose. Keep the module out of
    // the playback state graph too: it imports the pivot type only.
    const source = readFileSync(
      resolve(__dirname, 'railMotionInkScan.ts'),
      'utf8',
    );
    expect(source).not.toContain("from '../stores/");
    expect(source).not.toContain('evaluateRailMotion');
    expect(source).not.toContain('@preact');
    expect(source).not.toContain("from 'preact");
  });
});
