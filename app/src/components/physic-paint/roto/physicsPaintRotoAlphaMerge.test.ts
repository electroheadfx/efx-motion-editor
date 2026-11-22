import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

const harness = vi.hoisted(() => ({
  encode: vi.fn(),
  convert: vi.fn(),
}));

vi.mock('./rotoCanvasFrames', () => ({ encodeRotoFrameFromCanvas: harness.encode }));
vi.mock('../../../lib/rasterAlpha', () => ({ transmittanceSourceToPigmentAlpha: harness.convert }));

import { mergeCachedRotoAlphaFrame } from './physicsPaintRotoAlphaMerge';

type RecordedCanvasOp =
  | { type: 'clearRect'; x: number; y: number; w: number; h: number }
  | { type: 'fillRect'; x: number; y: number; w: number; h: number; style: string }
  | { type: 'drawImage'; source: string; args: number[]; compositeOp: string };

let operations: RecordedCanvasOp[] = [];
let failContext = false;
let failImage = false;

class RecordingCanvasContext {
  globalCompositeOperation = 'source-over';
  fillStyle = '';

  clearRect(x: number, y: number, w: number, h: number): void {
    operations.push({ type: 'clearRect', x, y, w, h });
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    operations.push({ type: 'fillRect', x, y, w, h, style: this.fillStyle });
  }

  drawImage(source: CanvasImageSource, ...args: number[]): void {
    const typedSource = source as { marker?: string; src?: string };
    operations.push({
      type: 'drawImage',
      source: typedSource.marker ?? typedSource.src ?? 'unknown',
      args,
      compositeOp: this.globalCompositeOperation,
    });
  }
}

class TestCanvas {
  width = 0;
  height = 0;
  marker = 'output-canvas';

  getContext(contextId: string): RecordingCanvasContext | null {
    if (failContext || contextId !== '2d') return null;
    return new RecordingCanvasContext();
  }

  toDataURL(type?: string): string {
    return `data:${type ?? 'image/png'};base64,bWVyZ2Vk`;
  }

  toBlob(callback: BlobCallback, type?: string): void {
    callback(new Blob(['merged'], { type: type ?? 'image/png' }));
  }
}

class TestFileReader {
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  readAsDataURL(): void {
    this.result = 'data:image/png;base64,bWVyZ2Vk';
    this.onload?.();
  }
}

class TestImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  marker = '';
  private currentSrc = '';

  set src(value: string) {
    this.currentSrc = value;
    this.marker = value;
    if (failImage) {
      this.onerror?.();
      return;
    }
    this.onload?.();
  }

  get src(): string {
    return this.currentSrc;
  }
}

// ============================================================
//  The REAL 2D compositor, modelled (CR-04).
//
//  The original gate's `drawImage` was a no-op, so it asserted the intended
//  arithmetic without ever modelling alpha-over. The pre-fix `scratchOf`
//  white-filled EVERY scratch — but `exportCoverageCanvas` writes cover into
//  RGB *and* alpha, so source-over over white rewrites the observed red to
//  255·(1 - c + c²) and the merge law inverts (cover 0 reads 255).
//
//  These classes composite like the platform: `fillRect` writes OPAQUE white,
//  `drawImage` applies source-over with the SOURCE's alpha, and `getImageData`
//  returns unpremultiplied straight RGBA. Drawing an RGBA raster onto an
//  opaque white scratch therefore yields 255·(1 - a + a·c/255) per channel;
//  drawing onto a transparent scratch leaves the source colour.
// ============================================================
class ModelCanvas {
  private w = 0;
  private h = 0;
  pixels = new Uint8ClampedArray(0);
  /** false → this canvas's own context exposes no getImageData (fallback path). */
  readable = true;
  marker: string;

  constructor(marker = 'model-canvas') {
    this.marker = marker;
  }

  get width(): number {
    return this.w;
  }

  set width(value: number) {
    if (value === this.w) return;
    this.w = value;
    this.pixels = new Uint8ClampedArray(this.w * this.h * 4);
  }

  get height(): number {
    return this.h;
  }

  set height(value: number) {
    if (value === this.h) return;
    this.h = value;
    this.pixels = new Uint8ClampedArray(this.w * this.h * 4);
  }

  seed(rgba: ArrayLike<number>): void {
    this.pixels = Uint8ClampedArray.from(rgba);
  }

  getContext(contextId: string, _options?: unknown): ModelContext | null {
    if (contextId !== '2d') return null;
    const context = new ModelContext(this);
    if (!this.readable) (context as unknown as { getImageData?: unknown }).getImageData = undefined;
    return context;
  }
}

class ModelContext {
  globalCompositeOperation = 'source-over';
  fillStyle = '#000000';

  constructor(private canvas: ModelCanvas) {}

  clearRect(x: number, y: number, w: number, h: number): void {
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) {
        const index = ((y + row) * this.canvas.width + (x + col)) * 4;
        if (index < 0 || index + 3 >= this.canvas.pixels.length) continue;
        this.canvas.pixels[index] = 0;
        this.canvas.pixels[index + 1] = 0;
        this.canvas.pixels[index + 2] = 0;
        this.canvas.pixels[index + 3] = 0;
      }
    }
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    // Only the paper-white fill both blend branches open with is modelled.
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) {
        const index = ((y + row) * this.canvas.width + (x + col)) * 4;
        if (index < 0 || index + 3 >= this.canvas.pixels.length) continue;
        this.canvas.pixels[index] = 255;
        this.canvas.pixels[index + 1] = 255;
        this.canvas.pixels[index + 2] = 255;
        this.canvas.pixels[index + 3] = 255;
      }
    }
  }

  drawImage(source: CanvasImageSource, dx: number, dy: number, dWidth?: number, dHeight?: number): void {
    const src = source as unknown as ModelCanvas;
    if (!(src instanceof ModelCanvas)) throw new Error('ModelCanvas: source pixels unavailable');
    const sw = src.width;
    const sh = src.height;
    const dw = dWidth ?? sw;
    const dh = dHeight ?? sh;
    if (!sw || !sh || !dw || !dh) return;
    for (let row = 0; row < dh; row += 1) {
      const sy = Math.min(sh - 1, Math.floor((row * sh) / dh));
      for (let col = 0; col < dw; col += 1) {
        const sx = Math.min(sw - 1, Math.floor((col * sw) / dw));
        const s = (sy * sw + sx) * 4;
        const d = ((dy + row) * this.canvas.width + (dx + col)) * 4;
        if (d < 0 || d + 3 >= this.canvas.pixels.length) continue;
        this.composite(d, src.pixels[s]!, src.pixels[s + 1]!, src.pixels[s + 2]!, src.pixels[s + 3]!);
      }
    }
  }

  /** Source-over in straight-alpha space — the platform's readback contract. */
  private composite(index: number, sr: number, sg: number, sb: number, saByte: number): void {
    const p = this.canvas.pixels;
    const sa = saByte / 255;
    const da = p[index + 3]! / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) {
      p[index] = 0;
      p[index + 1] = 0;
      p[index + 2] = 0;
      p[index + 3] = 0;
      return;
    }
    p[index] = Math.round((sr * sa + p[index]! * da * (1 - sa)) / outA);
    p[index + 1] = Math.round((sg * sa + p[index + 1]! * da * (1 - sa)) / outA);
    p[index + 2] = Math.round((sb * sa + p[index + 2]! * da * (1 - sa)) / outA);
    p[index + 3] = Math.round(outA * 255);
  }

  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray; width: number; height: number } {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) {
        const src = ((y + row) * this.canvas.width + (x + col)) * 4;
        const dst = (row * w + col) * 4;
        if (src < 0 || src + 3 >= this.canvas.pixels.length) continue;
        data[dst] = this.canvas.pixels[src]!;
        data[dst + 1] = this.canvas.pixels[src + 1]!;
        data[dst + 2] = this.canvas.pixels[src + 2]!;
        data[dst + 3] = this.canvas.pixels[src + 3]!;
      }
    }
    return { data, width: w, height: h };
  }

  putImageData(image: { data: Uint8ClampedArray; width?: number; height?: number }, x: number, y: number): void {
    const w = image.width ?? this.canvas.width;
    const h = image.height ?? this.canvas.height;
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) {
        const src = (row * w + col) * 4;
        const dst = ((y + row) * this.canvas.width + (x + col)) * 4;
        if (dst < 0 || dst + 3 >= this.canvas.pixels.length) continue;
        this.canvas.pixels[dst] = image.data[src]!;
        this.canvas.pixels[dst + 1] = image.data[src + 1]!;
        this.canvas.pixels[dst + 2] = image.data[src + 2]!;
        this.canvas.pixels[dst + 3] = image.data[src + 3]!;
      }
    }
  }
}

function makeBaseFrame(appFrame = 12): PhysicPaintRenderedFrame {
  return {
    frameIndex: 0,
    appFrame,
    bytes: testWebpBytes('Y2FjaGVkLXJvdG8tYWxwaGE='),
    width: 320,
    height: 180,
  };
}

function makeLiveCanvas(): HTMLCanvasElement {
  const canvas = new TestCanvas() as unknown as HTMLCanvasElement;
  canvas.width = 320;
  canvas.height = 180;
  (canvas as unknown as { marker: string }).marker = 'live-transparent-stroke-canvas';
  return canvas;
}

describe('mergeCachedRotoAlphaFrame', () => {
  const originalDocument = globalThis.document;
  const originalImage = globalThis.Image;
  const originalFileReader = globalThis.FileReader;

  beforeEach(() => {
    operations = [];
    failContext = false;
    failImage = false;
    harness.convert.mockReset().mockReturnValue({ marker: 'pigment-alpha-sheet' });
    harness.encode.mockReset().mockImplementation(async (canvas: HTMLCanvasElement, appFrame: number) => ({
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes('bWVyZ2Vk'),
      width: canvas.width,
      height: canvas.height,
    }));
    vi.stubGlobal('document', {
      createElement: (tagName: string) => {
        if (tagName !== 'canvas') throw new Error(`Unexpected test element: ${tagName}`);
        return new TestCanvas() as unknown as HTMLElement;
      },
    });
    vi.stubGlobal('Image', TestImage);
    vi.stubGlobal('FileReader', TestFileReader);
    vi.stubGlobal('createImageBitmap', vi.fn(async () => {
      if (failImage) throw new Error('Could not merge cached Roto alpha frame: cached base image failed to load.');
      return { marker: 'cached-base-image' };
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('document', originalDocument);
    vi.stubGlobal('Image', originalImage);
    vi.stubGlobal('FileReader', originalFileReader);
    vi.unstubAllGlobals();
  });

  it('D-01/D-03/36.11-ALPHA-ONLY-MERGE draws cached base first, live alpha second, and returns real-key frame metadata', async () => {
    const result = await mergeCachedRotoAlphaFrame(makeBaseFrame(), makeLiveCanvas(), 12, { width: 320, height: 180 });

    expect(result).toEqual({
      frameIndex: 0,
      appFrame: 12,
      bytes: testWebpBytes('bWVyZ2Vk'),
      width: 320,
      height: 180,
    });
    expect(operations).toEqual([
      { type: 'clearRect', x: 0, y: 0, w: 320, h: 180 },
      { type: 'drawImage', source: 'cached-base-image', args: [0, 0, 320, 180], compositeOp: 'source-over' },
      { type: 'drawImage', source: 'live-transparent-stroke-canvas', args: [0, 0, 320, 180], compositeOp: 'source-over' },
    ]);
  });

  it('WATERCOLOR-ALPHA: pigment-alpha fills paper white, draws the base, then the converted sheet source-over', async () => {
    // Round 2 law: the stored result keeps the sheet opaque —
    // t' = a*C + (1-a)*t_base — by compositing the live transmittance through
    // its straight-alpha pigment conversion over the cached base on white.
    await mergeCachedRotoAlphaFrame(makeBaseFrame(), makeLiveCanvas(), 12, { width: 320, height: 180 }, undefined, undefined, 'pigment-alpha');

    expect(harness.convert).toHaveBeenCalledTimes(1);
    expect(harness.convert.mock.calls[0]![0]).toMatchObject({ marker: 'live-transparent-stroke-canvas' });
    expect(operations[0]).toEqual({ type: 'clearRect', x: 0, y: 0, w: 320, h: 180 });
    expect(operations[1]).toEqual({ type: 'fillRect', x: 0, y: 0, w: 320, h: 180, style: '#ffffff' });
    const draws = operations.filter((operation) => operation.type === 'drawImage');
    expect(draws).toEqual([
      { type: 'drawImage', source: 'cached-base-image', args: [0, 0, 320, 180], compositeOp: 'source-over' },
      { type: 'drawImage', source: 'pigment-alpha-sheet', args: [0, 0, 320, 180], compositeOp: 'source-over' },
    ]);
  });

  it('WATERCOLOR-ALPHA: falls back to the raw sheet when the conversion readback is unavailable', async () => {
    harness.convert.mockReturnValue(null);

    await mergeCachedRotoAlphaFrame(makeBaseFrame(), makeLiveCanvas(), 12, { width: 320, height: 180 }, undefined, undefined, 'pigment-alpha');

    const liveDraw = operations.find((operation) => operation.type === 'drawImage' && operation.source === 'live-transparent-stroke-canvas');
    expect(liveDraw).toMatchObject({ compositeOp: 'source-over' });
  });

  describe('COVERAGE-COMPOSITE on the real compositor (CR-04)', () => {
    interface ModeledScene {
      width: number;
      height: number;
      base: number[];
      sheet: number[];
      cover: number[];
      /** false → the coverage canvas's own context has no getImageData. */
      readableCoverage?: boolean;
      coverage?: 'canvas' | 'null' | 'unreadable';
    }

    let created: ModelCanvas[] = [];

    beforeEach(() => {
      created = [];
      vi.stubGlobal('document', {
        createElement: (tagName: string) => {
          if (tagName !== 'canvas') throw new Error(`Unexpected test element: ${tagName}`);
          const canvas = new ModelCanvas('merge-canvas');
          created.push(canvas);
          return canvas as unknown as HTMLElement;
        },
      });
    });

    async function runMerge(scene: ModeledScene): Promise<Uint8ClampedArray> {
      const live = new ModelCanvas('live-sheet');
      live.width = scene.width;
      live.height = scene.height;
      live.seed(scene.sheet);
      const base = new ModelCanvas('base-canvas');
      base.width = scene.width;
      base.height = scene.height;
      base.seed(scene.base);
      let coverage: HTMLCanvasElement | null = null;
      if (scene.coverage === 'unreadable') {
        coverage = {} as unknown as HTMLCanvasElement;
      } else if (scene.coverage !== 'null') {
        const raster = new ModelCanvas('coverage-canvas');
        raster.width = scene.width;
        raster.height = scene.height;
        raster.readable = scene.readableCoverage !== false;
        raster.seed(scene.cover);
        coverage = raster as unknown as HTMLCanvasElement;
      }
      created.length = 0;
      await mergeCachedRotoAlphaFrame(
        null,
        live as unknown as HTMLCanvasElement,
        12,
        { width: scene.width, height: scene.height },
        undefined,
        base as unknown as HTMLCanvasElement,
        'coverage-composite',
        coverage,
      );
      return created[0]!.pixels;
    }

    /**
     * The law fixture: base t = (128, 128, 255), uniform sheet t = (255, 255,
     * 64), and a REAL RGBA coverage raster whose red AND alpha are the cover
     * byte — exactly what `exportCoverageCanvas` writes. The uniform sheet is
     * chosen to make the exponent visible in red/green; it is not the
     * physically coherent cover-0 relationship (the alpha law stage below
     * carries that).
     */
    const lawScene = (readableCoverage: boolean): ModeledScene => ({
      width: 3,
      height: 1,
      base: [128, 128, 255, 255, 128, 128, 255, 255, 128, 128, 255, 255],
      sheet: [255, 255, 64, 255, 255, 255, 64, 255, 255, 255, 64, 255],
      cover: [0, 0, 0, 0, 128, 128, 128, 128, 255, 255, 255, 255],
      readableCoverage,
    });

    function expectEngineDabLaw(merged: Uint8ClampedArray): void {
      // cover 0: the BASE's own red/green survive (pre-fix the sheet's 255).
      expect(merged[0]).toBe(128);
      expect(merged[1]).toBe(128);
      expect(merged[2]).toBe(64);
      expect(merged[3]).toBe(255);
      // cover 128 → exponent 1 - 128/255 = 0.498 → red/green ≈ 182
      // (pre-fix the white fill gives 0.251 and red/green ≈ 215).
      expect(Math.abs(merged[4]! - 182)).toBeLessThanOrEqual(2);
      expect(Math.abs(merged[5]! - 182)).toBeLessThanOrEqual(2);
      expect(Math.abs(merged[6]! - 64)).toBeLessThanOrEqual(2);
      expect(merged[7]).toBe(255);
      // cover 255: the dab replaces the base with the sheet.
      expect(merged[8]).toBe(255);
      expect(merged[9]).toBe(255);
      expect(merged[10]).toBe(64);
      expect(merged[11]).toBe(255);
      expect(harness.convert).not.toHaveBeenCalled();
    }

    it('keeps the base at cover 0 and the 0.498 exponent at cover 128 — direct 2D read', async () => {
      expectEngineDabLaw(await runMerge(lawScene(true)));
    });

    it('keeps the base at cover 0 and the 0.498 exponent at cover 128 — transparent-scratch fallback', async () => {
      expectEngineDabLaw(await runMerge(lawScene(false)));
    });

    it('keeps the sheet on its white-filled transmittance scratch', async () => {
      // A partial-alpha sheet reads as its transmittance over paper white. A
      // no-fill draw would leave (255, 0, 0) and the merge would emit green 0.
      const merged = await runMerge({
        width: 1,
        height: 1,
        base: [128, 128, 255, 255],
        sheet: [255, 0, 0, 128],
        cover: [0, 0, 0, 0],
      });
      expect(merged[0]).toBe(128);
      expect(merged[1]!).toBeGreaterThan(120);
      expect(merged[2]!).toBeGreaterThan(120);
      expect(merged[3]).toBe(255);
    });

    it('fails open to the raw sheet when the coverage raster has no readback', async () => {
      for (const coverage of ['null', 'unreadable'] as const) {
        const merged = await runMerge({
          width: 1,
          height: 1,
          base: [128, 128, 255, 255],
          sheet: [255, 255, 64, 255],
          cover: [0, 0, 0, 0],
          coverage,
        });
        expect(merged[0]).toBe(255);
        expect(merged[1]).toBe(255);
        expect(merged[2]).toBe(64);
        expect(merged[3]).toBe(255);
        expect(harness.convert).not.toHaveBeenCalled();
      }
    });
  });

  it('COVERAGE-COMPOSITE: fails open to the raw sheet without a coverage readback', async () => {
    // The default harness canvas has no getImageData: the merge must still
    // produce a sheet (drawn raw), never drop the stroke.
    await mergeCachedRotoAlphaFrame(makeBaseFrame(), makeLiveCanvas(), 12, { width: 320, height: 180 }, undefined, undefined, 'coverage-composite', null);

    const liveDraw = operations.find((operation) => operation.type === 'drawImage' && operation.source === 'live-transparent-stroke-canvas');
    expect(liveDraw).toMatchObject({ compositeOp: 'source-over' });
    expect(harness.convert).not.toHaveBeenCalled();
  });

  it('56-12/WATERCOLOR-CLEAR: default blend stays source-over so engine-1 merges are unchanged', async () => {
    await mergeCachedRotoAlphaFrame(makeBaseFrame(), makeLiveCanvas(), 12, { width: 320, height: 180 });

    expect(harness.convert).not.toHaveBeenCalled();
    expect(operations.some((operation) => operation.type === 'fillRect')).toBe(false);
    const liveDraw = operations.find((operation) => operation.type === 'drawImage' && operation.source === 'live-transparent-stroke-canvas');
    expect(liveDraw).toMatchObject({ compositeOp: 'source-over' });
  });

  it('D-02/36.11-ALPHA-ONLY-MERGE keeps paper, background support, PreviewRenderer output, and engine background out of the merge inputs', async () => {
    await mergeCachedRotoAlphaFrame(makeBaseFrame(), makeLiveCanvas(), 12, { width: 320, height: 180 });

    const drawnSources = operations
      .filter((operation): operation is Extract<RecordedCanvasOp, { type: 'drawImage' }> => operation.type === 'drawImage')
      .map((operation) => operation.source);
    expect(drawnSources).toEqual([
      'cached-base-image',
      'live-transparent-stroke-canvas',
    ]);
    expect(drawnSources).not.toContain('paper-texture');
    expect(drawnSources).not.toContain('paper-color');
    expect(drawnSources).not.toContain('background-only-support-frame');
    expect(drawnSources).not.toContain('PreviewRenderer-paper-canvas');
    expect(drawnSources).not.toContain('engine-background-output');
  });

  it('D-16 throws a specific merge error when the output 2D context cannot be created', async () => {
    failContext = true;

    await expect(mergeCachedRotoAlphaFrame(makeBaseFrame(), makeLiveCanvas(), 12, { width: 320, height: 180 }))
      .rejects.toThrow('Could not merge Roto alpha frames: 2D context unavailable.');
  });

  it('D-16 throws a specific merge error when the cached base image cannot load', async () => {
    failImage = true;

    await expect(mergeCachedRotoAlphaFrame(makeBaseFrame(), makeLiveCanvas(), 12, { width: 320, height: 180 }))
      .rejects.toThrow('Could not merge cached Roto alpha frame: cached base image failed to load.');
  });
});
