import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { drawProjectPaperRaster, getProjectPaperCanvas, isProjectPaperTextureResolved, resetProjectPaperRasterForTests, subscribeProjectPaperCanvas, subscribeProjectPaperTextureResolve } from './projectPaperRaster';

// 261017-nnu: the engine host is the only generation door. The mock returns
// deterministic per-(id, size, scale) pixels so pixel-look pins stay honest
// while the seam stays a pure cache-read + engine call.
const engineMock = vi.hoisted(() => ({
  getEnginePaperSheet: vi.fn(),
  getEnginePaperHeight: vi.fn(),
  resetEnginePaperSheetForTests: vi.fn(),
}));
vi.mock('./enginePaperSheet', () => engineMock);

function seededPixels(id: string, width: number, height: number, scale: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  let h = 2166136261;
  for (const ch of `${id}|${width}x${height}|${scale}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const n = (h ^ Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263)) >>> 0;
      out[i] = n & 255;
      out[i + 1] = (n >>> 8) & 255;
      out[i + 2] = (n >>> 16) & 255;
      out[i + 3] = 255;
    }
  }
  return out;
}

const PROCEDURAL_IDS = new Set([
  'paper/cold-press',
  'paper/hot-press',
  'paper/rough',
  'paper/khadi',
  'paper/washi',
  'paper/laid',
  'paper/canvas',
  'paper/toned-sand',
  'paper/kraft',
  'paper/student',
]);

engineMock.getEnginePaperSheet.mockImplementation((id: string, width: number, height: number, scale: number) => {
  if (!PROCEDURAL_IDS.has(id)) return null;
  const canvas = document.createElement('canvas') as HTMLCanvasElement & {
    getContext: (type: string) => {
      createImageData: (w: number, h: number) => { data: Uint8ClampedArray; width: number; height: number };
      putImageData: (image: { data: Uint8ClampedArray; width: number; height: number }) => void;
      getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray; width: number; height: number };
    };
  };
  canvas.width = width;
  canvas.height = height;
  const pixels = seededPixels(id, width, height, scale);
  const context = canvas.getContext('2d');
  const image = context.createImageData(width, height);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
  return canvas;
});

engineMock.getEnginePaperHeight.mockImplementation((id: string, width: number, height: number, scale: number) => {
  if (!PROCEDURAL_IDS.has(id)) return null;
  const out = new Float32Array(width * height);
  const pixels = seededPixels(id, width, height, scale);
  for (let i = 0; i < out.length; i++) out[i] = pixels[i * 4] / 255;
  return out;
});

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

// Shared pixel-canvas helpers (I-07 + 261017-fz3).
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
    drawImage(source: HarnessCanvas, _x: number, _y: number, width?: number, height?: number) {
      // Upscale blit: stamp the source field into this canvas at the requested
      // size (the continuous-field upscale seam).
      const outWidth = width ?? source.width;
      const outHeight = height ?? source.height;
      const out = new Uint8ClampedArray(outWidth * outHeight * 4);
      const src = source.__pixels;
      for (let y = 0; y < outHeight; y++) {
        for (let x = 0; x < outWidth; x++) {
          const sx = Math.min(source.width - 1, Math.floor((x / outWidth) * source.width));
          const sy = Math.min(source.height - 1, Math.floor((y / outHeight) * source.height));
          const si = (sy * source.width + sx) * 4;
          const di = (y * outWidth + x) * 4;
          if (src) {
            out[di] = src[si];
            out[di + 1] = src[si + 1];
            out[di + 2] = src[si + 2];
            out[di + 3] = src[si + 3];
          }
        }
      }
      canvas.__pixels = out;
      canvas.width = outWidth;
      canvas.height = outHeight;
    },
  };
  return canvas;
}

function samplePixel(canvas: HTMLCanvasElement, x: number, y: number): number {
  const harness = canvas as unknown as HarnessCanvas;
  const ctx = harness.getContext('2d') as { getImageData: (x: number, y: number, w: number, h: number) => { data: Uint8ClampedArray } };
  const { data } = ctx.getImageData(x, y, 1, 1);
  return data[0];
}

async function withPixelDocument(run: () => Promise<void> | void): Promise<void> {
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
    await run();
  } finally {
    resetProjectPaperRasterForTests();
    Object.assign(globalThis, { document: originalDocument, Image: originalImage });
  }
}

function fond(paperTexture: string, width: number, height: number, scale: number): HTMLCanvasElement {
  const canvas = getProjectPaperCanvas(paperTexture, width, height, scale);
  if (!canvas) throw new Error(`expected a fond canvas for ${paperTexture}`);
  return canvas;
}

// I-07: procedural PAPER_LIBRARY ids must synthesize a fond tile (tooth) instead
// of falling through to the flat #f4efe3 colour arm. The vendored engine is the
// renderer — never jpeg.
describe('I-07 procedural fond tile', () => {

  it('returns a fond canvas for procedural paper/cold-press and paper/rough the same tick', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const cold = fond('paper/cold-press', 64, 32, 1);
      const rough = fond('paper/rough', 64, 32, 1);
      expect(cold).not.toBeNull();
      expect(rough).not.toBeNull();
      expect(cold!.width).toBe(64);
      expect(cold!.height).toBe(32);
    });
  });

  it('two different procedural ids produce different pixels (the sheet is paper-specific)', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const cold = fond('paper/cold-press', 32, 32, 1);
      const rough = fond('paper/rough', 32, 32, 1);
      const samples: Array<[number, number]> = [[0, 0], [5, 7], [11, 13], [17, 19], [23, 29]];
      const coldPixels = samples.map(([x, y]) => samplePixel(cold, x, y));
      const roughPixels = samples.map(([x, y]) => samplePixel(rough, x, y));
      expect(coldPixels).not.toEqual(roughPixels);
    });
  });

  it('empty string and unknown paper/* stay fail-soft null; paper/real-1 stays on the image URL path', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      expect(getProjectPaperCanvas('', 64, 32, 1)).toBeNull();
      expect(getProjectPaperCanvas('paper/nope-not-in-library-but-procedural', 64, 32, 1)).toBeNull();
      // Real scans keep the jpg path — null until the texture resolves.
      expect(getProjectPaperCanvas('paper/real-1', 64, 32, 1)).toBeNull();
    });
  });

  it('same id + size + scale returns the identical cached canvas; a different grainScale returns a different canvas', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const first = fond('paper/cold-press', 64, 32, 1);
      const again = getProjectPaperCanvas('paper/cold-press', 64, 32, 1);
      const scaled = fond('paper/cold-press', 64, 32, 2);
      expect(again).toBe(first);
      expect(scaled).not.toBeNull();
      expect(scaled).not.toBe(first);
    });
  });

  it('subscribeProjectPaperCanvas delivers the sheet the same tick; unsubscribe is callable', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const delivered: Array<HTMLCanvasElement | null> = [];
      const unsubscribe = subscribeProjectPaperCanvas('paper/cold-press', 64, 32, (canvas) => {
        delivered.push(canvas);
      });
      expect(delivered.length).toBeGreaterThanOrEqual(1);
      expect(delivered[delivered.length - 1]).not.toBeNull();
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  it('studio-reopen-paper-washout: a null engine sheet retries and then delivers the real sheet', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const defaultSheet = engineMock.getEnginePaperSheet.getMockImplementation()!;
      vi.useFakeTimers();
      try {
        let failNext = 2;
        engineMock.getEnginePaperSheet.mockImplementation((id: string, width: number, height: number, scale: number) => {
          if (!PROCEDURAL_IDS.has(id)) return null;
          if (failNext > 0) {
            failNext -= 1;
            return null;
          }
          return defaultSheet(id, width, height, scale);
        });
        const delivered: Array<HTMLCanvasElement | null> = [];
        const unsubscribe = subscribeProjectPaperCanvas('paper/cold-press', 64, 32, (canvas) => {
          delivered.push(canvas);
        });
        expect(delivered[delivered.length - 1]).toBeNull();
        await vi.advanceTimersByTimeAsync(200);
        expect(delivered[delivered.length - 1]).not.toBeNull();
        unsubscribe();
      } finally {
        vi.useRealTimers();
        engineMock.getEnginePaperSheet.mockImplementation(defaultSheet);
      }
    });
  });

  it('studio-reopen-paper-washout: a permanently-null sheet stops after the bounded retries', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const defaultSheet = engineMock.getEnginePaperSheet.getMockImplementation()!;
      vi.useFakeTimers();
      try {
        engineMock.getEnginePaperSheet.mockClear();
        engineMock.getEnginePaperSheet.mockImplementation(() => null);
        subscribeProjectPaperCanvas('paper/cold-press', 64, 32, () => {});
        await vi.advanceTimersByTimeAsync(10_000);
        // 1 initial + 8 retries — never an unbounded spin.
        expect(engineMock.getEnginePaperSheet.mock.calls.length).toBeLessThanOrEqual(9);
      } finally {
        vi.useRealTimers();
        engineMock.getEnginePaperSheet.mockImplementation(defaultSheet);
      }
    });
  });

  it('source-scan: getProjectPaperCanvas carries the procedural branch and PAPER_TEXTURE_URLS gains no procedural keys', () => {
    const src = source('src/lib/projectPaperRaster.ts');
    const fnBody = src.slice(
      src.indexOf('export function getProjectPaperCanvas'),
      src.indexOf('export function subscribeProjectPaperCanvas'),
    );
    expect(fnBody).toContain('isProceduralPaperTexture');
    expect(fnBody).toContain('buildProceduralPaperFond');
    const urlsBlock = src.slice(
      src.indexOf('const PAPER_TEXTURE_URLS'),
      src.indexOf('export function isProceduralPaperTexture'),
    );
    expect(urlsBlock).toContain("paper/real-1");
    expect(urlsBlock).not.toContain('paper/cold-press');
    expect(urlsBlock).not.toContain('paper/rough');
  });
});

// 261017-nnu: the fond is the vendored engine sheet — opaque paperColour
// sRGB at full WxH, uScale = PAPER_UNITS / (height * grainScale), no tiling.
describe('261017-nnu engine fond', () => {
  it('source-scan: the cache-key string shape from 20f9dfdc stays untouched', () => {
    const src = source('src/lib/projectPaperRaster.ts');
    expect(src).toContain('${paperTexture}|1|${width}x${height}|${normalized}');
  });

  it('per-paper look differs (hot-press smoother than rough; washi ≠ student)', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const cold = fond('paper/cold-press', 32, 32, 1);
      const hot = fond('paper/hot-press', 32, 32, 1);
      const rough = fond('paper/rough', 32, 32, 1);
      const washi = fond('paper/washi', 32, 32, 1);
      const student = fond('paper/student', 32, 32, 1);
      const samples: Array<[number, number]> = [[8, 8], [12, 16], [20, 12], [24, 24], [16, 20]];
      const of = (canvas: HTMLCanvasElement) => samples.map(([x, y]) => samplePixel(canvas, x, y));
      expect(of(cold)).not.toEqual(of(hot));
      expect(of(cold)).not.toEqual(of(rough));
      expect(of(washi)).not.toEqual(of(student));
    });
  });

  it('determinism across a cache clear: same id + size + scale rebuilds identical bytes', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const first = fond('paper/cold-press', 32, 32, 1);
      const samples: Array<[number, number]> = [[0, 0], [5, 7], [11, 13], [17, 19], [23, 29]];
      const before = samples.map(([x, y]) => samplePixel(first, x, y));
      resetProjectPaperRasterForTests();
      const rebuilt = fond('paper/cold-press', 32, 32, 1);
      const after = samples.map(([x, y]) => samplePixel(rebuilt, x, y));
      expect(after).toEqual(before);
    });
  });

  it('unknown paper/* still returns null (fail-soft to flat-color arm)', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      expect(getProjectPaperCanvas('paper/nope-not-real', 32, 32, 1)).toBeNull();
      expect(getProjectPaperCanvas('', 32, 32, 1)).toBeNull();
    });
  });
});

// 261017-nnu: fond at full raster — no tiling, scale law, cache identity.
describe('261017-nnu fond no-tile continuous field', () => {
  it('no tiling: at 64x64 the pixel at (0,y) differs from (32,y) for some interior y', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const sheet = fond('paper/cold-press', 64, 64, 1);
      expect(sheet).not.toBeNull();
      let anyDiffers = false;
      for (let y = 8; y < 56; y += 4) {
        if (samplePixel(sheet, 0, y) !== samplePixel(sheet, 32, y)) {
          anyDiffers = true;
          break;
        }
      }
      expect(anyDiffers).toBe(true);
    });
  });

  it('scale law: coarse grainScale 2 differs from fine grainScale 1', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const fine = fond('paper/cold-press', 32, 32, 1);
      const coarse = fond('paper/cold-press', 32, 32, 2);
      const samples: Array<[number, number]> = [[4, 4], [10, 12], [18, 8], [22, 20], [28, 26]];
      const fineVals = samples.map(([x, y]) => samplePixel(fine, x, y));
      const coarseVals = samples.map(([x, y]) => samplePixel(coarse, x, y));
      expect(fineVals).not.toEqual(coarseVals);
    });
  });

  it('cache identity: same content key returns the identical canvas object; different scale returns a different canvas', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      const first = fond('paper/cold-press', 64, 64, 1);
      const again = getProjectPaperCanvas('paper/cold-press', 64, 64, 1);
      const scaled = fond('paper/cold-press', 64, 64, 2);
      expect(again).toBe(first);
      expect(scaled).not.toBeNull();
      expect(scaled).not.toBe(first);
    });
  });

  it('real-jpg arm still uses createPattern repeat (260923-bcm path unchanged)', () => {
    const fills: string[] = [];
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#fff',
      save() {},
      restore() {},
      fillRect() { fills.push('fill'); },
      createPattern() { fills.push('pattern'); return 'textured-pattern'; },
      drawImage() {},
    } as unknown as CanvasRenderingContext2D;
    drawProjectPaperRaster(context, { width: 2, height: 1 } as CanvasImageSource, 8, 4);
    expect(fills).toContain('pattern');
  });
});

// 261017-nnu: the fond seam is cache-read + engine call — never a generator.
describe('261017-nnu engine fond seam', () => {
  it('source-scan: the getProjectPaperCanvas / buildProceduralPaperFond region has no inline sheet build', () => {
    const src = source('src/lib/projectPaperRaster.ts');
    const seam = src.slice(
      src.indexOf('function buildProceduralPaperFond'),
      src.indexOf('export function normalizeGrainScale'),
    );
    expect(seam).toContain('getEnginePaperSheet');
    // The blocking entries are not reachable from the seam.
    expect(seam).not.toContain('requestProceduralSheet');
    expect(seam).not.toContain('createPattern');
  });

  it('source-scan: the engine host is the only generation door (import, no inline CPU/GL)', () => {
    const src = source('src/lib/projectPaperRaster.ts');
    expect(src).toContain("from './enginePaperSheet'");
    // No second generation door is imported (fragmented so this pin stays clean).
    expect(src).not.toContain(`from './${['paperSheet', 'Client'].join('')}'`);
    expect(src).not.toContain(`from './${['paperField', 'Gl'].join('')}'`);
    expect(src).not.toContain(['renderPaperSheet', 'Gl'].join(''));
  });

  it('a cache miss returns the sheet the same tick and calls the engine exactly once', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      engineMock.getEnginePaperSheet.mockClear();
      const first = getProjectPaperCanvas('paper/cold-press', 16, 16, 1);
      expect(first).not.toBeNull();
      expect(engineMock.getEnginePaperSheet).toHaveBeenCalledTimes(1);
      const second = getProjectPaperCanvas('paper/cold-press', 16, 16, 1);
      expect(second).toBe(first);
      // Fond cache hit — the engine is not asked again.
      expect(engineMock.getEnginePaperSheet).toHaveBeenCalledTimes(1);
    });
  });

  it('isProjectPaperTextureResolved flips true the same tick the sheet is cached', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      expect(isProjectPaperTextureResolved('paper/cold-press')).toBe(false);
      getProjectPaperCanvas('paper/cold-press', 16, 16, 1);
      expect(isProjectPaperTextureResolved('paper/cold-press')).toBe(true);
    });
  });

  it('insertion fires the existing texture-resolve notify so the fond watcher recomposites', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      let resolvedFired = 0;
      const unsubscribe = subscribeProjectPaperTextureResolve('paper/cold-press', () => {
        resolvedFired += 1;
      });
      getProjectPaperCanvas('paper/cold-press', 16, 16, 1);
      expect(resolvedFired).toBeGreaterThanOrEqual(1);
      unsubscribe();
    });
  });

  it('per-frame getProjectPaperCanvas for the same key is an identity cache hit', async () => {
    await withPixelDocument(async () => {
      resetProjectPaperRasterForTests();
      engineMock.getEnginePaperSheet.mockClear();
      const first = fond('paper/cold-press', 32, 32, 1);
      const second = getProjectPaperCanvas('paper/cold-press', 32, 32, 1);
      const third = getProjectPaperCanvas('paper/cold-press', 32, 32, 1);
      expect(second).toBe(first);
      expect(third).toBe(first);
      // One engine request total — the later frames are pure cache hits.
      expect(engineMock.getEnginePaperSheet).toHaveBeenCalledTimes(1);
    });
  });
});

// 261017-mdr: cache discipline the per-frame flatten path depends on. The
// flattener's own per-frame document.createElement('canvas') composite is out
// of scope (it is the composite target, not the paper sheet).
describe('261017-mdr cache discipline', () => {
  it('source-scan: proceduralFondCache.clear() occurs only in the two reset functions', () => {
    const src = source('src/lib/projectPaperRaster.ts');
    const clearHits = src.match(/proceduralFondCache\.clear\(\)/g) ?? [];
    expect(clearHits).toHaveLength(2);
    const clearFn = src.slice(
      src.indexOf('export function clearProjectPaperRasterCache'),
      src.indexOf('export function resetProjectPaperRasterForTests'),
    );
    expect(clearFn).toContain('proceduralFondCache.clear()');
    const resetFn = src.slice(src.indexOf('export function resetProjectPaperRasterForTests'));
    expect(resetFn).toContain('proceduralFondCache.clear()');
  });

  it('source-scan: clearProjectPaperRasterCache is not called from physicPaintStore paint/revision paths', () => {
    const storeSrc = source('src/stores/physicPaintStore.ts');
    expect(storeSrc).not.toContain('clearProjectPaperRasterCache');
  });

  it('source-scan: the production clear caller is a dispose path, not a paint bump', () => {
    const previewSrc = source('src/lib/previewRenderer.ts');
    const callHits = previewSrc.match(/clearProjectPaperRasterCache\(\)/g) ?? [];
    expect(callHits).toHaveLength(1);
    const disposeBody = previewSrc.slice(previewSrc.indexOf('dispose(): void'));
    expect(disposeBody).toContain('clearProjectPaperRasterCache()');
  });

  it('source-scan: proceduralFondCache.clear() is still only in the two reset functions', () => {
    const src = source('src/lib/projectPaperRaster.ts');
    const clearHits = src.match(/proceduralFondCache\.clear\(\)/g) ?? [];
    expect(clearHits).toHaveLength(2);
  });
});

// Opaque-sheet density arm is unchanged (drawProjectPaperRaster options).
describe('261017-lny opaque density', () => {
  it('opaque-sheet arm: globalAlpha = 1 and no white fillRect before the sheet draw', () => {
    const ops: string[] = [];
    let alphaAtDraw = 1;
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#fff',
      save() { ops.push('save'); },
      restore() { ops.push('restore'); },
      fillRect() { ops.push(`fill:${String(this.fillStyle)}:a=${this.globalAlpha}`); },
      createPattern() { ops.push('pattern'); return 'textured-pattern'; },
      drawImage() { ops.push(`draw:a=${this.globalAlpha}`); alphaAtDraw = this.globalAlpha; },
    } as unknown as CanvasRenderingContext2D & { globalAlpha: number };
    drawProjectPaperRaster(context, { width: 2, height: 1 } as CanvasImageSource, 8, 4, 1, { opaqueSheet: true });
    expect(alphaAtDraw).toBe(1);
    expect(ops).toEqual(['save', 'draw:a=1', 'restore']);
    expect(ops.some((op) => op.startsWith('fill:'))).toBe(false);
    expect(ops).not.toContain('pattern');
  });

  it('jpg arm keeps white + 0.18 (and the opaque flag is opt-in)', () => {
    const ops: Array<{ kind: string; alpha: number }> = [];
    const context = {
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      fillStyle: '#fff',
      save() {},
      restore() {},
      fillRect() { ops.push({ kind: String(this.fillStyle).startsWith('pattern') ? 'pattern' : 'fill', alpha: this.globalAlpha }); },
      createPattern() { return 'pattern:fixture'; },
      drawImage() { ops.push({ kind: 'draw', alpha: this.globalAlpha }); },
    } as unknown as CanvasRenderingContext2D;
    drawProjectPaperRaster(context, { width: 2, height: 1 } as CanvasImageSource, 8, 4);
    expect(ops).toEqual([
      { kind: 'fill', alpha: 1 },
      { kind: 'pattern', alpha: 0.18 },
    ]);
  });
});
