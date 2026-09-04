import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasRotoAlphaCanvasFrame, registerRotoAlphaCanvasFrame } from '../../../stores/physicPaintStore';
import { addOccupiedRotoFrame, buildBlankRotoFrame, drawCanvasAtSize, encodeRotoFrameFromCanvas, isRotoPngDataUrl, registerRotoAlphaCanvasFrameFromDataUrl } from './rotoCanvasFrames';

vi.mock('../../../stores/physicPaintStore', () => ({
  hasRotoAlphaCanvasFrame: vi.fn(() => false),
  registerRotoAlphaCanvasFrame: vi.fn(),
}));

class TestCanvas {
  width = 0;
  height = 0;
  drawImage = vi.fn<(source: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) => void>();

  getContext(contextId: string): { drawImage: (source: CanvasImageSource, dx: number, dy: number, dw: number, dh: number) => void } | null {
    return contextId === '2d' ? { drawImage: this.drawImage } : null;
  }

  toDataURL(type?: string): string {
    return `data:${type ?? 'image/png'};base64,dGVzdA==`;
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
    vi.stubGlobal('FileReader', class {
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(): void {
        this.result = 'data:image/png;base64,dGVzdA==';
        this.onload?.();
      }
    });
    const canvas = new TestCanvas() as unknown as HTMLCanvasElement;
    canvas.width = 320;
    canvas.height = 180;

    await expect(encodeRotoFrameFromCanvas(canvas, 7, undefined, 23)).resolves.toEqual({
      frameIndex: 0,
      appFrame: 7,
      dataUrl: 'data:image/png;base64,dGVzdA==',
      width: 320,
      height: 180,
    });
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith('data:image/png;base64,dGVzdA==', canvas);
  });

  it('builds blank transparent frame metadata and registers its alpha canvas', () => {
    const frame = buildBlankRotoFrame(320, 180, 7);
    const canvas = createdCanvases[0] as unknown as HTMLCanvasElement;

    expect(frame).toEqual({
      frameIndex: 0,
      appFrame: 7,
      dataUrl: 'data:image/png;base64,dGVzdA==',
      width: 320,
      height: 180,
    });
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(frame.dataUrl, canvas);
  });
});

// G-52-7: launch hydration must decode canonical PNGs OFF the main thread —
// in WebKit, Image.onload for a data: URL fires before decode, so the decode
// serialized at the first drawImage (~10s for 15 photo-weight reveal keys).
const PNG_1X1_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('registerRotoAlphaCanvasFrameFromDataUrl (G-52-7)', () => {
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
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    const fetchSpy = vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) });
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('createImageBitmap', createImageBitmapSpy);
    vi.stubGlobal('Image', class {
      constructor() { throw new Error('Image must not be constructed when createImageBitmap succeeds.'); }
    });

    await registerRotoAlphaCanvasFrameFromDataUrl(PNG_1X1_DATA_URL, { width: 4, height: 2 });

    // G-52-8: the Blob comes from the native fetch(data:) pipeline.
    expect(fetchSpy).toHaveBeenCalledWith(PNG_1X1_DATA_URL);
    expect(createImageBitmapSpy).toHaveBeenCalledTimes(1);
    expect(createImageBitmapSpy.mock.calls[0]?.[0]).toBe(blob);
    const canvas = createdCanvases[0];
    expect(canvas.width).toBe(4);
    expect(canvas.height).toBe(2);
    expect(canvas.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 4, 2);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(PNG_1X1_DATA_URL, canvas);
  });

  it('decodes a photo-weight payload without any full-body base64 decode (G-52-8)', async () => {
    // A multi-hundred-KB body: the manual path would atob ALL of it; the native
    // path may only run the 40-char signature probe.
    const photoWeightDataUrl = 'data:image/png;base64,iVBORw0KGgo' + 'QUJD'.repeat(50000);
    const blob = new Blob(['png-bytes'], { type: 'image/png' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }));
    const bitmap = { width: 4, height: 2, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal('Image', class {
      constructor() { throw new Error('Image must not be constructed on the native decode path.'); }
    });
    const atobSpy = vi.spyOn(globalThis, 'atob');

    await registerRotoAlphaCanvasFrameFromDataUrl(photoWeightDataUrl, { width: 4, height: 2 });

    expect(atobSpy).toHaveBeenCalled();
    for (const call of atobSpy.mock.calls) {
      expect(String(call[0]).length).toBeLessThanOrEqual(40);
    }
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(photoWeightDataUrl, createdCanvases[0]);
  });

  it('keeps createImageBitmap reachable through the manual byte copy when fetch is blocked (G-52-8 packaged CSP)', async () => {
    // The packaged CSP connect-src grants no data: source, so fetch(data:)
    // rejects there; the manual copy must still hand createImageBitmap its
    // Blob rather than regressing to the Image path.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('CSP: connect-src has no data: grant')));
    const bitmap = { width: 4, height: 2, close: vi.fn() };
    const createImageBitmapSpy = vi.fn().mockResolvedValue(bitmap);
    vi.stubGlobal('createImageBitmap', createImageBitmapSpy);
    vi.stubGlobal('Image', class {
      constructor() { throw new Error('Image must not be constructed when the manual blob path succeeds.'); }
    });

    await registerRotoAlphaCanvasFrameFromDataUrl(PNG_1X1_DATA_URL, { width: 4, height: 2 });

    expect(createImageBitmapSpy).toHaveBeenCalledTimes(1);
    expect(createImageBitmapSpy.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    const canvas = createdCanvases[0];
    expect(canvas.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 4, 2);
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(PNG_1X1_DATA_URL, canvas);
  });

  it('falls back to a forced Image decode and never draws an undecoded image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })) }));
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

    const pending = registerRotoAlphaCanvasFrameFromDataUrl(PNG_1X1_DATA_URL, { width: 4, height: 2 });
    await vi.waitFor(() => expect(constructed[0]?.decode).toHaveBeenCalled());
    // decode() still pending: the canvas must not exist, nothing drawn.
    expect(createdCanvases).toHaveLength(0);
    resolveDecode();
    await pending;

    const canvas = createdCanvases[0];
    expect(canvas.drawImage).toHaveBeenCalledTimes(1);
    expect(constructed[0]?.decode.mock.invocationCallOrder[0]).toBeLessThan(canvas.drawImage.mock.invocationCallOrder[0]);
    expect(registerRotoAlphaCanvasFrame).toHaveBeenCalledWith(PNG_1X1_DATA_URL, canvas);
  });

  it('throws the canonical decode error when both decode paths fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })) }));
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

    await expect(registerRotoAlphaCanvasFrameFromDataUrl(PNG_1X1_DATA_URL)).rejects.toThrow('Canonical Roto PNG could not be decoded.');
    expect(registerRotoAlphaCanvasFrame).not.toHaveBeenCalled();
  });

  it('skips decoding entirely when the alpha canvas is already registered', async () => {
    vi.mocked(hasRotoAlphaCanvasFrame).mockReturnValueOnce(true);
    const fetchSpy = vi.fn();
    const createImageBitmapSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('createImageBitmap', createImageBitmapSpy);

    await registerRotoAlphaCanvasFrameFromDataUrl(PNG_1X1_DATA_URL, { width: 4, height: 2 });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createImageBitmapSpy).not.toHaveBeenCalled();
    expect(registerRotoAlphaCanvasFrame).not.toHaveBeenCalled();
  });
});

describe('isRotoPngDataUrl signature probe (G-52-7)', () => {
  it('checks the PNG signature without decoding the full base64 body', () => {
    // A body with invalid base64 beyond the 40-char probe window would throw
    // under the old full-body atob; the probe must never touch it.
    const probed = 'data:image/png;base64,iVBORw0KGgo' + 'QUJD'.repeat(20) + '####';
    expect(isRotoPngDataUrl(probed)).toBe(true);
  });

  it('still rejects a non-PNG signature and invalid base64 inside the probe window', () => {
    expect(isRotoPngDataUrl('data:image/png;base64,QUJDREVGR0hJS0tM' + 'iVBORw0KGgo'.repeat(8))).toBe(false);
    expect(isRotoPngDataUrl('data:image/png;base64,####')).toBe(false);
    expect(isRotoPngDataUrl('data:image/jpeg;base64,iVBORw0KGgo')).toBe(false);
    expect(isRotoPngDataUrl('not-a-data-url')).toBe(false);
  });
});
