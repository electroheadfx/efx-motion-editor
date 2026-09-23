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
