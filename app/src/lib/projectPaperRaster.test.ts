import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { drawProjectPaperRaster, getProjectPaperCanvas, resetProjectPaperRasterForTests, subscribeProjectPaperCanvas } from './projectPaperRaster';

interface Pixel { r: number; g: number; b: number; a: number }

const WHITE: Pixel = { r: 255, g: 255, b: 255, a: 255 };
const TEXTURE: Pixel[] = [
  { r: 40, g: 50, b: 60, a: 255 },
  { r: 220, g: 210, b: 190, a: 255 },
];
const PAINT: Pixel = { r: 210, g: 40, b: 20, a: 128 };

function over(base: Pixel, source: Pixel, opacity = 1): Pixel {
  const alpha = (source.a / 255) * opacity;
  return {
    r: Math.round(source.r * alpha + base.r * (1 - alpha)),
    g: Math.round(source.g * alpha + base.g * (1 - alpha)),
    b: Math.round(source.b * alpha + base.b * (1 - alpha)),
    a: 255,
  };
}

function renderPaper(textureOpacity: number, width = 6, height = 3): Pixel[] {
  return Array.from({ length: width * height }, (_, index) => over(WHITE, TEXTURE[index % TEXTURE.length], textureOpacity));
}

function addRegisteredPaint(pixels: Pixel[], width: number): Pixel[] {
  const result = pixels.map((pixel) => ({ ...pixel }));
  const paintIndex = width + 3;
  result[paintIndex] = over(result[paintIndex], PAINT);
  return result;
}

const root = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('authoritative project paper raster parity', () => {
  it('renders Physics playback from the same cached project-paper implementation as PreviewRenderer', () => {
    const preview = source('src/lib/previewRenderer.ts');
    const playback = source('src/components/physic-paint/view/PhysicsPaintStudioView.tsx');
    const playbackBackground = source('src/components/physic-paint/view/rotoPlaybackBackground.ts');
    const css = source('src/components/physic-paint/physicsPaintStudio.css');

    expect(preview).toContain("from './projectPaperRaster'");
    expect(playback).toContain("from './rotoPlaybackBackground'");
    expect(playbackBackground).toContain("from '../../../lib/projectPaperRaster'");
    expect(playback).not.toContain('drawMissingRotoBackground');
    expect(playback).not.toContain('paper.src = `/img/paper_');
    expect(css).not.toContain("background-image: url('/img/paper_1.jpg')");

    const width = 6;
    const editorPaper = renderPaper(0.18, width);
    const recorded: Array<{ alpha: number; kind: 'fill' | 'pattern' }> = [];
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: 'multiply',
      fillStyle: '#000',
      save() {},
      restore() {},
      fillRect(this: { globalAlpha: number; fillStyle: string }) { recorded.push({ alpha: this.globalAlpha, kind: String(this.fillStyle).startsWith('pattern') ? 'pattern' : 'fill' }); },
      createPattern() { return 'pattern:fixture'; },
      drawImage() {},
    } as unknown as CanvasRenderingContext2D;
    drawProjectPaperRaster(context, { width: 2, height: 1 } as CanvasImageSource, width, 3);
    const sharedPhysicsPaper = renderPaper(recorded.find((entry) => entry.kind === 'pattern')?.alpha ?? 0, width);
    const editorComposite = addRegisteredPaint(editorPaper, width);
    const sharedPhysicsComposite = addRegisteredPaint(sharedPhysicsPaper, width);

    expect({ width, height: 3 }).toEqual({ width: 6, height: 3 });
    expect(recorded).toEqual([{ alpha: 1, kind: 'fill' }, { alpha: 0.18, kind: 'pattern' }]);
    expect(sharedPhysicsPaper[0]).toEqual(editorPaper[0]);
    expect(sharedPhysicsPaper[1]).toEqual(editorPaper[1]);
    expect(sharedPhysicsPaper[2]).toEqual(editorPaper[2]);
    expect(sharedPhysicsComposite[width + 3]).toEqual(editorComposite[width + 3]);
  });

  // 260923-bcm Task 2 (RED): grain SCALE at the project-paper draw seam —
  // pattern transform at scale 2, no transform at the default 1 (byte-identical
  // hot path), cache keys isolate the scale, and a hostile scale still draws
  // (tile step floored — T-260923-01).
  it('260923-bcm: records a pattern transform at scale 2 and skips setTransform at scale 1', () => {
    const transforms: unknown[] = [];
    const makeContext = () => ({
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#fff',
      save() {},
      restore() {},
      fillRect() {},
      createPattern() {
        return {
          setTransform(matrix: unknown) {
            transforms.push(matrix);
          },
        };
      },
      drawImage() {},
    }) as unknown as CanvasRenderingContext2D;
    const texture = { width: 2, height: 1 } as CanvasImageSource;

    drawProjectPaperRaster(makeContext(), texture, 6, 3, 2);
    expect(transforms).toEqual([{ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }]);

    transforms.length = 0;
    drawProjectPaperRaster(makeContext(), texture, 6, 3);
    expect(transforms).toEqual([]);
    drawProjectPaperRaster(makeContext(), texture, 6, 3, 1);
    expect(transforms).toEqual([]);
  });

  it('260923-bcm: isolates the paper canvas cache by grain scale', () => {
    const images: Array<{ src: string; onload: null | (() => void); width: number; height: number }> = [];
    const makeCanvas = () => {
      const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
      const context = {
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        fillStyle: '#fff',
        save() {},
        restore() {},
        fillRect() {},
        createPattern() { return 'textured-pattern'; },
        drawImage() {},
      } as unknown as CanvasRenderingContext2D;
      Object.assign(canvas, { getContext: () => context });
      return canvas;
    };
    const originalImage = globalThis.Image;
    const originalDocument = globalThis.document;
    class FakeImage {
      onload: null | (() => void) = null;
      width = 2;
      height = 1;
      private source = '';
      constructor() { images.push(this as unknown as { src: string; onload: null | (() => void); width: number; height: number }); }
      set src(value: string) { this.source = value; }
      get src() { return this.source; }
    }
    Object.assign(globalThis, {
      Image: FakeImage,
      document: { createElement: () => makeCanvas() },
    });
    try {
      resetProjectPaperRasterForTests();
      const unsubscribe = subscribeProjectPaperCanvas('canvas2', 6, 3, () => {}, 1);
      images[0]?.onload?.();
      const atScale1 = getProjectPaperCanvas('canvas2', 6, 3, 1);
      const atScale2 = getProjectPaperCanvas('canvas2', 6, 3, 2);
      const atScale1Again = getProjectPaperCanvas('canvas2', 6, 3, 1);
      expect(atScale1).not.toBeNull();
      expect(atScale2).not.toBeNull();
      expect(atScale1).not.toBe(atScale2);
      expect(atScale1Again).toBe(atScale1);
      unsubscribe();
    } finally {
      resetProjectPaperRasterForTests();
      Object.assign(globalThis, { Image: originalImage, document: originalDocument });
    }
  });

  it('260923-bcm: a malformed grain scale still draws (tile step floored — T-260923-01)', () => {
    const fills: string[] = [];
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#fff',
      save() {},
      restore() {},
      fillRect() { fills.push('fill'); },
      createPattern() { return null; },
      drawImage() { fills.push('draw'); },
    } as unknown as CanvasRenderingContext2D;
    const texture = { width: 4, height: 2 } as CanvasImageSource;
    // Hostile scales must not hang the tile loop (zero/negative/NaN step).
    drawProjectPaperRaster(context, texture, 8, 4, 0);
    drawProjectPaperRaster(context, texture, 8, 4, -3);
    drawProjectPaperRaster(context, texture, 8, 4, Number.NaN);
    expect(fills.length).toBeGreaterThan(0);
  });

  it('260923-bcm: playback, thumbnail, and preload call sites pass an explicit grain scale', () => {
    const playback = source('src/components/physic-paint/view/rotoPlaybackBackground.ts');
    expect(playback).toContain('grainScale ?? 1');
    const thumbnail = source('src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts');
    expect(thumbnail).toContain('grainScale ?? 1');
    const preview = source('src/lib/previewRenderer.ts');
    const preloadBody = preview.slice(preview.indexOf('preloadPaperTextures'));
    expect(preloadBody).toMatch(/subscribeProjectPaperCanvas\([\s\S]*?,\s*1\s*\)/);
  });

  it('repaints a mounted playback surface after async texture resolution and ignores stale subscriptions', () => {
    const images: Array<{ src: string; onload: null | (() => void); onerror: null | (() => void); width: number; height: number }> = [];
    const visibleDraws: string[] = [];
    const originalImage = globalThis.Image;
    const originalDocument = globalThis.document;

    class FakeImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      width = 2;
      height = 1;
      private source = '';
      constructor() { images.push(this); }
      set src(value: string) { this.source = value; }
      get src() { return this.source; }
    }

    const makeCanvas = () => {
      const canvas = { width: 0, height: 0 } as HTMLCanvasElement;
      const context = {
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        fillStyle: '#fff',
        save() {},
        restore() {},
        fillRect() {},
        createPattern() { return 'textured-pattern'; },
        drawImage() {},
      } as unknown as CanvasRenderingContext2D;
      Object.assign(canvas, { getContext: () => context });
      return canvas;
    };

    Object.assign(globalThis, {
      Image: FakeImage,
      document: { createElement: () => makeCanvas() },
    });

    try {
      const unsubscribeOld = subscribeProjectPaperCanvas('canvas2', 6, 3, (paperCanvas) => {
        visibleDraws.push(paperCanvas ? 'old:textured' : 'old:white');
      });
      expect(visibleDraws).toEqual(['old:white']);
      expect(images[0]?.src).toBe('/img/paper_2.jpg');

      unsubscribeOld();
      const unsubscribeCurrent = subscribeProjectPaperCanvas('canvas3', 6, 3, (paperCanvas) => {
        visibleDraws.push(paperCanvas ? 'current:textured' : 'current:white');
      });
      expect(visibleDraws).toEqual(['old:white', 'current:white']);
      expect(images[1]?.src).toBe('/img/paper_3.jpg');

      images[0]?.onload?.();
      expect(visibleDraws).toEqual(['old:white', 'current:white']);

      images[1]?.onload?.();
      expect(visibleDraws).toEqual(['old:white', 'current:white', 'current:textured']);

      unsubscribeCurrent();
      images[1]?.onload?.();
      expect(visibleDraws).toEqual(['old:white', 'current:white', 'current:textured']);
    } finally {
      Object.assign(globalThis, { Image: originalImage, document: originalDocument });
    }
  });
});

// I-07: procedural PAPER_LIBRARY ids must synthesize a fond tile (tooth) instead
// of falling through to the flat #f4efe3 colour arm. proceduralHeightMap is the
// renderer — never jpeg.
describe('I-07 procedural fond tile', () => {
  type HarnessCanvas = {
    width: number;
    height: number;
    __pixels: Uint8ClampedArray | null;
    getContext: (type: string) => unknown;
  };

  /** Mini canvas with real pixel storage so the relief tile can be compared. */
  function makePixelCanvas(): HarnessCanvas {
    const canvas: HarnessCanvas = {
      width: 0,
      height: 0,
      __pixels: null,
      getContext: () => context,
    };
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#fff' as string | { __texture: HarnessCanvas },
      save() {},
      restore() {},
      createImageData(width: number, height: number) {
        return { data: new Uint8ClampedArray(width * height * 4), width, height };
      },
      putImageData(image: { data: Uint8ClampedArray; width: number; height: number }) {
        canvas.__pixels = new Uint8ClampedArray(image.data);
        canvas.width = image.width;
        canvas.height = image.height;
      },
      getImageData(x: number, y: number, width: number, height: number) {
        const out = new Uint8ClampedArray(width * height * 4);
        const src = canvas.__pixels;
        if (src && canvas.width > 0 && canvas.height > 0) {
          for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
              const sx = x + col;
              const sy = y + row;
              if (sx < 0 || sy < 0 || sx >= canvas.width || sy >= canvas.height) continue;
              const si = (sy * canvas.width + sx) * 4;
              const di = (row * width + col) * 4;
              out[di] = src[si];
              out[di + 1] = src[si + 1];
              out[di + 2] = src[si + 2];
              out[di + 3] = src[si + 3];
            }
          }
        }
        return { data: out, width, height };
      },
      fillRect(_x: number, _y: number, width: number, height: number) {
        const pixels = new Uint8ClampedArray(width * height * 4);
        const style = this.fillStyle as string | { __texture: HarnessCanvas };
        if (typeof style === 'string') {
          pixels.fill(255);
        } else if (style && style.__texture) {
          const source = style.__texture;
          const src = source.__pixels;
          const alpha = this.globalAlpha;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const i = (y * width + x) * 4;
              const sx = x % Math.max(1, source.width);
              const sy = y % Math.max(1, source.height);
              const si = (sy * source.width + sx) * 4;
              for (let c = 0; c < 3; c++) {
                const base = 255;
                const sample = src ? src[si + c] : base;
                pixels[i + c] = Math.round(sample * alpha + base * (1 - alpha));
              }
              pixels[i + 3] = 255;
            }
          }
        }
        canvas.__pixels = pixels;
        canvas.width = width;
        canvas.height = height;
      },
      createPattern(texture: HarnessCanvas) {
        return { __texture: texture, setTransform() {} };
      },
      drawImage() {},
    };
    return canvas;
  }

  function samplePixel(canvas: HTMLCanvasElement, x: number, y: number): number {
    const harness = canvas as unknown as HarnessCanvas;
    const ctx = harness.getContext('2d') as { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray } };
    const { data } = ctx.getImageData(x, y, 1, 1);
    return data[0];
  }

  function withPixelDocument(run: () => void): void {
    const originalDocument = globalThis.document;
    const originalImage = globalThis.Image;
    class FakeImage {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      width = 2;
      height = 1;
      set src(_value: string) {}
    }
    Object.assign(globalThis, {
      document: { createElement: () => makePixelCanvas() },
      Image: FakeImage,
    });
    try {
      run();
    } finally {
      resetProjectPaperRasterForTests();
      Object.assign(globalThis, { document: originalDocument, Image: originalImage });
    }
  }

  it('returns a non-null fond canvas for procedural paper/cold-press and paper/rough', () => {
    withPixelDocument(() => {
      resetProjectPaperRasterForTests();
      const cold = getProjectPaperCanvas('paper/cold-press', 64, 32, 1);
      const rough = getProjectPaperCanvas('paper/rough', 64, 32, 1);
      expect(cold).not.toBeNull();
      expect(rough).not.toBeNull();
      expect(cold!.width).toBe(64);
      expect(cold!.height).toBe(32);
    });
  });

  it('two different procedural ids produce different pixels (the tile is paper-specific)', () => {
    withPixelDocument(() => {
      resetProjectPaperRasterForTests();
      const cold = getProjectPaperCanvas('paper/cold-press', 32, 32, 1)!;
      const rough = getProjectPaperCanvas('paper/rough', 32, 32, 1)!;
      const samples: Array<[number, number]> = [[0, 0], [5, 7], [11, 13], [17, 19], [23, 29]];
      const coldPixels = samples.map(([x, y]) => samplePixel(cold, x, y));
      const roughPixels = samples.map(([x, y]) => samplePixel(rough, x, y));
      expect(coldPixels).not.toEqual(roughPixels);
    });
  });

  it('empty string and unknown paper/* stay fail-soft null; paper/real-1 stays on the image URL path', () => {
    withPixelDocument(() => {
      resetProjectPaperRasterForTests();
      expect(getProjectPaperCanvas('', 64, 32, 1)).toBeNull();
      expect(getProjectPaperCanvas('paper/nope-not-in-library-but-procedural', 64, 32, 1)).toBeNull();
      // Real scans keep the jpg path — null until the texture resolves.
      expect(getProjectPaperCanvas('paper/real-1', 64, 32, 1)).toBeNull();
    });
  });

  it('same id + size + scale returns the identical cached canvas; a different grainScale returns a different canvas', () => {
    withPixelDocument(() => {
      resetProjectPaperRasterForTests();
      const first = getProjectPaperCanvas('paper/cold-press', 64, 32, 1);
      const again = getProjectPaperCanvas('paper/cold-press', 64, 32, 1);
      const scaled = getProjectPaperCanvas('paper/cold-press', 64, 32, 2);
      expect(again).toBe(first);
      expect(scaled).not.toBeNull();
      expect(scaled).not.toBe(first);
    });
  });

  it('subscribeProjectPaperCanvas delivers a procedural canvas synchronously and returns a callable unsubscribe', () => {
    withPixelDocument(() => {
      resetProjectPaperRasterForTests();
      const delivered: Array<HTMLCanvasElement | null> = [];
      const unsubscribe = subscribeProjectPaperCanvas('paper/cold-press', 64, 32, (canvas) => {
        delivered.push(canvas);
      });
      expect(delivered).toHaveLength(1);
      expect(delivered[0]).not.toBeNull();
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  it('source-scan: getProjectPaperCanvas carries the procedural branch and PAPER_TEXTURE_URLS gains no procedural keys', () => {
    const src = source('src/lib/projectPaperRaster.ts');
    const fnBody = src.slice(
      src.indexOf('export function getProjectPaperCanvas'),
      src.indexOf('export function subscribeProjectPaperCanvas'),
    );
    expect(fnBody).toContain('isProceduralPaperTexture');
    expect(fnBody).toContain('proceduralHeightMap');
    const urlsBlock = src.slice(
      src.indexOf('const PAPER_TEXTURE_URLS'),
      src.indexOf('export function isProceduralPaperTexture'),
    );
    expect(urlsBlock).toContain("paper/real-1");
    expect(urlsBlock).not.toContain('paper/cold-press');
    expect(urlsBlock).not.toContain('paper/rough');
  });
});
