import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasRotoAlphaCanvasFrame, registerRotoAlphaCanvasFrame } from '../../../lib/rotoAlphaCanvasRegistry';
import { addOccupiedRotoFrame, buildBlankRotoFrame, drawCanvasAtSize, encodeRotoFrameFromCanvas, registerRotoAlphaCanvasFrameFromBytes } from './rotoCanvasFrames';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

vi.mock('../../../lib/rotoAlphaCanvasRegistry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/rotoAlphaCanvasRegistry')>();
  return {
    ...actual,
    hasRotoAlphaCanvasFrame: vi.fn(() => false),
    registerRotoAlphaCanvasFrame: vi.fn(),
  };
});

vi.mock('../../../lib/webpFrameCodec', () => ({
  encodeWebpFrame: vi.fn(async () => testWebpBytes('dGVzdA==')),
  decodeWebpFrame: vi.fn(),
}));

class TestCanvas {
  width = 0;
  height = 0;
  drawImage = vi.fn<(source: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) => void>();

  getContext(contextId: string): { drawImage: (source: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) => void; getImageData: () => { data: Uint8Array } } | null {
    return contextId === '2d'
      ? { drawImage: this.drawImage, getImageData: () => ({ data: new Uint8Array(this.width * this.height * 4) }) }
      : null;
  }

  toDataURL(_type?: string): string {
    const bytes = testWebpBytes('dGVzdA==');
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return `data:image/webp;base64,${btoa(binary)}`;
  }

  toBlob(callback: BlobCallback, type?: string): void {
    callback(new Blob(['test'], { type: type ?? 'image/png' }));
  }
}

describe('rotoCanvasFrames', () => {
  const originalDocument = globalThis.document;
  let createdCanvases: TestCanvas[];

  beforeEach(() => {
    createdCanvases = [];
    vi.stubGlobal('document', {
      createElement: (tagName: string) => {
        if (tagName !== 'canvas') throw new Error(`Unexpected test element: ${tagName}`);
        const canvas = new TestCanvas();
        createdCanvases.push(canvas);
        return canvas as unknown as HTMLElement;
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('document', originalDocument);
  });

  it('adds occupied frames once and returns them in timeline order', () => {
    expect(addOccupiedRotoFrame([8, 2, 8], 5)).toEqual([2, 5, 8]);
    expect(addOccupiedRotoFrame([2, 5, 8], 5)).toEqual([2, 5, 8]);
  });

  it('reuses an already-sized canvas without drawing a copy', () => {
    const canvas = new TestCanvas() as unknown as HTMLCanvasElement;
    canvas.width = 320;
    canvas.height = 180;

    expect(drawCanvasAtSize(canvas, { width: 320, height: 180 })).toBe(canvas);
    expect(createdCanvases).toHaveLength(0);
  });

  it('draws a resized canvas at the requested dimensions', () => {
    const source = new TestCanvas() as unknown as HTMLCanvasElement;
    source.width = 640;
    source.height = 360;

    const output = drawCanvasAtSize(source, { width: 320, height: 180 }) as unknown as TestCanvas;

    expect(output.width).toBe(320);
    expect(output.height).toBe(180);
    expect(output.drawImage).toHaveBeenCalledWith(source, 0, 0, 320, 180);
  });

  it('encodes asynchronously without changing frame metadata', async () => {
    const canvas = new TestCanvas() as unknown as HTMLCanvasElement;
    canvas.width = 320;
    canvas.height = 180;

    await expect(encodeRotoFrameFromCanvas(canvas, 7, undefined, 23)).resolves.toEqual({
      frameIndex: 0,
      appFrame: 7,
      bytes: testWebpBytes('dGVzdA=='),
      width: 320,
      height: 180,
    });
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(testWebpBytes('dGVzdA=='), canvas);
  });

  it('builds blank transparent frame metadata and registers its alpha canvas', () => {
    const frame = buildBlankRotoFrame(320, 180, 7);
    const canvas = createdCanvases[0] as unknown as HTMLCanvasElement;

    expect(frame).toEqual({
      frameIndex: 0,
      appFrame: 7,
      bytes: testWebpBytes('dGVzdA=='),
      width: 320,
      height: 180,
    });
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(frame.bytes, canvas);
  });
});

// G-52-7: launch hydration must decode canonical WebP bytes OFF the main
// thread — in WebKit, Image.onload for a data: URL fires before decode, so the
// decode serialized at the first drawImage (~10s for 15 photo-weight reveal
// keys). 52.1 (D-05): the payload is now raw WebP bytes — no data URL, no
// base64, no fetch(data:) pipeline.
const WEBP_1X1_BYTES = testWebpBytes('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==');

describe('registerRotoAlphaCanvasFrameFromBytes (G-52-7)', () => {
  const originalDocument = globalThis.document;
  let createdCanvases: TestCanvas[];

  beforeEach(() => {
    createdCanvases = [];
    vi.stubGlobal('document', {
      createElement: (tagName: string) => {
        if (tagName !== 'canvas') throw new Error(`Unexpected test element: ${tagName}`);
        const canvas = new TestCanvas();
        createdCanvases.push(canvas);
        return canvas as unknown as HTMLElement;
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.stubGlobal('document', originalDocument);
  });

  it('decodes via createImageBitmap, draws the bitmap, and closes it', async () => {
    const bitmap = { width: 4, height: 2, close: vi.fn() };
    const createImageBitmapSpy = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal('createImageBitmap', createImageBitmapSpy);
    vi.stubGlobal('Image', class {
      constructor() { throw new Error('Image must not be constructed when createImageBitmap succeeds.'); }
    });

    await registerRotoAlphaCanvasFrameFromBytes(WEBP_1X1_BYTES, { width: 4, height: 2 });

    expect(createImageBitmapSpy).toHaveBeenCalledTimes(1);
    expect(createImageBitmapSpy.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    const canvas = createdCanvases[0];
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(2);
    expect(canvas.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 4, 2);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(WEBP_1X1_BYTES, canvas);
  });

  it('decodes a photo-weight payload without any base64 handling (G-52-8, 52.1)', async () => {
    const photoWeightBytes = testWebpBytes('QUJD'.repeat(50000));
    const bitmap = { width: 4, height: 2, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal('Image', class {
      constructor() { throw new Error('Image must not be constructed on the native decode path.'); }
    });
    const atobSpy = vi.spyOn(globalThis, 'atob');

    await registerRotoAlphaCanvasFrameFromBytes(photoWeightBytes, { width: 4, height: 2 });

    expect(atobSpy).not.toHaveBeenCalled();
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(photoWeightBytes, createdCanvases[0]);
  });

  it('falls back to a forced Image decode and never draws an undecoded image', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bitmap unsupported')));
    let resolveDecode!: () => void;
    const constructed: TestImage[] = [];
    class TestImage {
      naturalWidth = 4;
      naturalHeight = 2;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode = vi.fn(() => new Promise<void>((resolve) => { resolveDecode = resolve; }));
      #src = '';
      constructor() { constructed.push(this); }
      get src(): string { return this.#src; }
      set src(value: string) {
        this.#src = value;
        if (value) queueMicrotask(() => this.onload?.());
      }
    }
    vi.stubGlobal('Image', TestImage);

    const pending = registerRotoAlphaCanvasFrameFromBytes(WEBP_1X1_BYTES, { width: 4, height: 2 });
    await vi.waitFor(() => expect(constructed[0]?.decode).toHaveBeenCalled());
    // decode() still pending: the canvas must not exist, nothing drawn.
    expect(createdCanvases).toHaveLength(0);
    resolveDecode();
    await pending;

    const canvas = createdCanvases[0];
    expect(canvas.drawImage).toHaveBeenCalledTimes(1);
    expect(constructed[0]?.decode.mock.invocationCallOrder[0]).toBeLessThan(canvas.drawImage.mock.invocationCallOrder[0]);
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(WEBP_1X1_BYTES, canvas);
  });

  it('throws the canonical decode error when both decode paths fail', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bitmap unsupported')));
    class BrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      decode = vi.fn().mockResolvedValue(undefined);
      #src = '';
      get src(): string { return this.#src; }
      set src(value: string) {
        this.#src = value;
        if (value) queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', BrokenImage);

    await expect(registerRotoAlphaCanvasFrameFromBytes(WEBP_1X1_BYTES)).rejects.toThrow('Canonical Roto WebP could not be decoded.');
    expect(registerRotoAlphaCanvasFrame).not.toHaveBeenCalled();
  });

  it('rejects non-WebP bytes before any decode', async () => {
    const createImageBitmapSpy = vi.fn();
    vi.stubGlobal('createImageBitmap', createImageBitmapSpy);

    await expect(registerRotoAlphaCanvasFrameFromBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).rejects.toThrow('Canonical Roto payload is not valid WebP bytes.');
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
  });

  it('skips decoding entirely when the alpha canvas is already registered', async () => {
    vi.mocked(hasRotoAlphaCanvasFrame).mockReturnValueOnce(true);
    const createImageBitmapSpy = vi.fn();
    vi.stubGlobal('createImageBitmap', createImageBitmapSpy);

    await registerRotoAlphaCanvasFrameFromBytes(WEBP_1X1_BYTES, { width: 4, height: 2 });

    expect(createImageBitmapSpy).not.toHaveBeenCalled();
    expect(createdCanvases).toHaveLength(0);
  });
});

