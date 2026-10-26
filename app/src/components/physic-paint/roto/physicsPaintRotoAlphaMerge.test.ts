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
