// ============================================================
//  261018-f15 Task 2 B2 — oracle paper-thumb painter.
//
//  Pins (UAT images 66/67/68/69):
//    - one paint per (id, size); second call is a cache hit
//    - procedural thumbs show tooth + a diagonal granulating
//      ultramarine wash (paperSwatchFS look): a pixel past the
//      diagonal is blue-shifted vs the bare sheet
//    - never toDataURL / toBlob (52.1 D-19)
//
//  Node-friendly canvas stub with a real pixel buffer so the
//  wash predicate can compare RGBA samples (same stub idiom as
//  WatercolorBrushLibrary.test.ts).
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const source = readFileSync(resolve(__dirname, 'paperThumb.ts'), 'utf8');

/** Strip block + line comments so negative scans never trip on docs. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

interface StubImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface StubCanvas {
  width: number;
  height: number;
  _pixels: Uint8ClampedArray;
  getContext: (kind: string) => unknown;
  toDataURL: () => string;
  toBlob: () => void;
}

function makePixelCanvas(width: number, height: number): StubCanvas {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const canvas: StubCanvas = {
    width,
    height,
    _pixels: pixels,
    getContext: (kind: string) => {
      if (kind !== '2d') return null;
      return {
        clearRect() {
          pixels.fill(0);
        },
        drawImage(src: StubCanvas | StubImageData, dx = 0, dy = 0) {
          const srcPixels = '_pixels' in src ? src._pixels : src.data;
          const srcW = src.width;
          const srcH = src.height;
          for (let y = 0; y < srcH; y++) {
            for (let x = 0; x < srcW; x++) {
              const tx = dx + x;
              const ty = dy + y;
              if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
              const si = (y * srcW + x) * 4;
              const ti = (ty * width + tx) * 4;
              pixels[ti] = srcPixels[si];
              pixels[ti + 1] = srcPixels[si + 1];
              pixels[ti + 2] = srcPixels[si + 2];
              pixels[ti + 3] = srcPixels[si + 3];
            }
          }
        },
        createImageData(w: number, h: number): StubImageData {
          return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
        },
        getImageData(x: number, y: number, w: number, h: number): StubImageData {
          const out = new Uint8ClampedArray(w * h * 4);
          for (let row = 0; row < h; row++) {
            for (let col = 0; col < w; col++) {
              const si = ((y + row) * width + (x + col)) * 4;
              const ti = (row * w + col) * 4;
              out[ti] = pixels[si];
              out[ti + 1] = pixels[si + 1];
              out[ti + 2] = pixels[si + 2];
              out[ti + 3] = pixels[si + 3];
            }
          }
          return { data: out, width: w, height: h };
        },
        putImageData(image: StubImageData, dx = 0, dy = 0) {
          for (let row = 0; row < image.height; row++) {
            for (let col = 0; col < image.width; col++) {
              const si = (row * image.width + col) * 4;
              const ti = ((dy + row) * width + (dx + col)) * 4;
              pixels[ti] = image.data[si];
              pixels[ti + 1] = image.data[si + 1];
              pixels[ti + 2] = image.data[si + 2];
              pixels[ti + 3] = image.data[si + 3];
            }
          }
        },
      };
    },
    toDataURL: () => {
      throw new Error('toDataURL must never be called');
    },
    toBlob: () => {
      throw new Error('toBlob must never be called');
    },
  };
  return canvas;
}

/** A flat mid-gray sheet (paper.g ≈ 0.5) so the wash math is deterministic. */
function makeSheet(width: number, height: number, gray = 128): StubCanvas {
  const canvas = makePixelCanvas(width, height);
  for (let i = 0; i < canvas._pixels.length; i += 4) {
    canvas._pixels[i] = gray;
    canvas._pixels[i + 1] = gray;
    canvas._pixels[i + 2] = gray;
    canvas._pixels[i + 3] = 255;
  }
  return canvas;
}

describe('paperThumb (261018-f15 B2)', () => {
  it('source never calls toDataURL / toBlob (52.1 D-19)', () => {
    const body = stripComments(source);
    expect(body).not.toContain('toDataURL');
    expect(body).not.toContain('toBlob');
  });

  it('paints once per (id, size); the second call is a cache hit', async () => {
    vi.resetModules();
    const created: StubCanvas[] = [];
    const originalDocument = globalThis.document;
    Object.assign(globalThis, {
      document: {
        createElement: (tag: string) => {
          expect(tag).toBe('canvas');
          const canvas = makePixelCanvas(4, 4);
          created.push(canvas);
          return canvas;
        },
      },
    });
    try {
      const { getPaperThumb, clearPaperThumbCache, paperThumbPainter } = await import('./paperThumb');
      clearPaperThumbCache();
      const spy = vi.spyOn(paperThumbPainter, 'paintProcedural');
      const first = getPaperThumb('paper/cold-press', 4, 4);
      expect(first, 'first call paints').toBeTruthy();
      expect(spy).toHaveBeenCalledTimes(1);
      const second = getPaperThumb('paper/cold-press', 4, 4);
      expect(second, 'second call returns the cached canvas').toBe(first);
      expect(spy, 'no repaint on cache hit').toHaveBeenCalledTimes(1);
      // A different size is a different cache key.
      getPaperThumb('paper/cold-press', 8, 8);
      expect(spy).toHaveBeenCalledTimes(2);
    } finally {
      Object.assign(globalThis, { document: originalDocument });
    }
  });

  it('wash-region predicate: a pixel past the diagonal is blue-shifted vs the bare sheet', async () => {
    vi.resetModules();
    const originalDocument = globalThis.document;
    // Force a deterministic sheet via the engine-sheet host mock.
    vi.doMock('../../../lib/enginePaperSheet', () => ({
      getEnginePaperSheet: () => makeSheet(4, 4, 128),
    }));
    Object.assign(globalThis, {
      document: {
        createElement: () => makePixelCanvas(4, 4),
      },
    });
    try {
      const { getPaperThumb, clearPaperThumbCache } = await import('./paperThumb');
      clearPaperThumbCache();
      const thumb = getPaperThumb('paper/cold-press', 4, 4) as unknown as StubCanvas;
      expect(thumb).toBeTruthy();
      const pixels = thumb._pixels;
      // Diagonal: x = u*0.62 + (1-v)*0.38. Past x≈0.6 is wash; before is bare.
      // u=0.9, v=0.9 → x = 0.9*0.62 + 0.1*0.38 = 0.558 + 0.038 = 0.596 (bare).
      // u=0.9, v=0.1 → x = 0.558 + 0.9*0.38 = 0.558 + 0.342 = 0.900 (wash).
      const bareIdx = (3 * 4 + 3) * 4; // px(3,3) ≈ u=0.875, v=0.875 → bare
      const washIdx = (0 * 4 + 3) * 4; // px(3,0) ≈ u=0.875, v=0.125 → wash
      const bareR = pixels[bareIdx];
      const bareB = pixels[bareIdx + 2];
      const washR = pixels[washIdx];
      const washB = pixels[washIdx + 2];
      // The wash multiplies all channels down; blue holds up far better than
      // red (ultramarine), so the wash pixel's B/R ratio climbs.
      const bareRatio = bareB / Math.max(1, bareR);
      const washRatio = washB / Math.max(1, washR);
      expect(washRatio, 'wash pixel is blue-shifted vs the bare sheet').toBeGreaterThan(bareRatio * 1.5);
      expect(washR, 'wash pixel loses red').toBeLessThan(bareR);
    } finally {
      Object.assign(globalThis, { document: originalDocument });
      vi.doUnmock('../../../lib/enginePaperSheet');
    }
  });
});
