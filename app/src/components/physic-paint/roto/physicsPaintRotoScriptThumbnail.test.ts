import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 261017-nnu: the sheet comes from the vendored engine host. Mock it at
// module scope so the fond seam gets a sheet — same door production uses,
// no inline generation.
const engineMock = vi.hoisted(() => ({
  getEnginePaperSheet: vi.fn(),
  getEnginePaperHeight: vi.fn(),
  resetEnginePaperSheetForTests: vi.fn(),
}));
vi.mock('../../../lib/enginePaperSheet', () => engineMock);

import { createRotoScriptThumbnail } from './physicsPaintRotoScriptThumbnail';
import { resetProjectPaperRasterForTests } from '../../../lib/projectPaperRaster';

const webpBytes = Uint8Array.from(atob('UklGRhIAAABXRUJQVlA4IAoAAAAAAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA=='), (char) => char.charCodeAt(0));

function installCanvas(toBlob: (callback: BlobCallback, type?: string, quality?: any) => void) {
  if (!globalThis.document) Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => null } });
  const calls: string[] = [];
  const context = {
    fillStyle: '', fillRect: vi.fn(() => calls.push('fill')), drawImage: vi.fn(() => calls.push('draw')),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) })),
  };
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => context), toBlob: vi.fn(toBlob) } as unknown as HTMLCanvasElement;
  vi.spyOn(document, 'createElement').mockReturnValue(canvas as never);
  return { canvas, context, calls };
}

/**
 * 261026-nvq: record the composite mode in force at every drawImage call so a
 * test can prove the script canvas (the LAST draw) is multiplied over the
 * paper, while the engine-1 default stays source-over.
 */
function installCompositeRecordingCanvas() {
  const composite = { value: 'source-over' };
  const scriptDrawModes: string[] = [];
  const context = {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(() => { scriptDrawModes.push(composite.value); }),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) })),
  };
  Object.defineProperty(context, 'globalCompositeOperation', {
    configurable: true,
    get: () => composite.value,
    set: (next: string) => { composite.value = next; },
  });
  const makeCanvas = () => ({ width: 0, height: 0, getContext: vi.fn(() => context), toBlob: vi.fn(() => {}) });
  if (!globalThis.document) Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => makeCanvas() } });
  else vi.spyOn(document, 'createElement').mockImplementation(() => makeCanvas() as never);
  return { context, scriptDrawModes };
}

beforeEach(() => {
  engineMock.getEnginePaperSheet.mockReset();
  engineMock.getEnginePaperSheet.mockImplementation((id: string, width: number, height: number) => {
    if (!id.startsWith('paper/') || id.startsWith('paper/real-')) return null;
    const sheet = {
      width,
      height,
      getContext: () => ({
        drawImage() {},
        getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(255), width: w, height: h }),
      }),
    } as unknown as HTMLCanvasElement;
    return sheet;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  // The fond cache is module-level — clear it so the paper/* case is a fresh miss.
  resetProjectPaperRasterForTests();
});

describe('Roto script thumbnail', () => {
  it('uses bounded native lossy WebP at quality 0.8 and bypasses unavailable WKWebView encoding', async () => {
    const fake = installCanvas(() => { throw new Error('browser encoder must be bypassed'); });
    const encodeWebp = vi.fn(async ({ width, height, quality, rgba }) => ({ width, height, quality, rgba, mimeType: 'image/webp' as const, bytes: webpBytes }));
    const result = await createRotoScriptThumbnail({ scriptAlphaCanvas: {} as HTMLCanvasElement, sourceWidth: 1600, sourceHeight: 900, background: { background: 'transparent', grainStrength: 0 }, nativeEncoder: { encodeWebp } });
    expect(result).toMatchObject({ mimeType: 'image/webp', width: 96, height: 54, quality: 0.8 });
    expect(encodeWebp).toHaveBeenCalledWith(expect.objectContaining({ width: 96, height: 54, quality: 0.8, rgba: expect.any(Uint8Array) }));
    expect(fake.canvas.toBlob).not.toHaveBeenCalled();
    expect(fake.context.fillRect).toHaveBeenCalledWith(0, 0, 96, 54);
    expect(fake.calls).toEqual(['fill', 'draw']);
  });

  it('requires strict actual browser WebP and rejects null, wrong MIME and invalid signatures', async () => {
    const input = { scriptAlphaCanvas: {} as HTMLCanvasElement, sourceWidth: 1, sourceHeight: 1, background: { background: 'white' as const, grainStrength: 0 } };
    installCanvas((callback) => callback(null));
    await expect(createRotoScriptThumbnail(input)).rejects.toThrow('Actual WebP encoding');
    vi.restoreAllMocks();
    installCanvas((callback) => callback(new Blob([webpBytes], { type: 'image/png' })));
    await expect(createRotoScriptThumbnail(input)).rejects.toThrow('Actual WebP encoding');
    vi.restoreAllMocks();
    installCanvas((callback) => callback(new Blob([new Uint8Array(20)], { type: 'image/webp' })));
    await expect(createRotoScriptThumbnail(input)).rejects.toThrow('validation failed');
  });

  it('validates native result correlation metadata and exact RGBA length', async () => {
    installCanvas(() => {});
    const input = { scriptAlphaCanvas: {} as HTMLCanvasElement, sourceWidth: 2, sourceHeight: 2, background: { background: 'white' as const, grainStrength: 0 } };
    await expect(createRotoScriptThumbnail({ ...input, nativeEncoder: { encodeWebp: async () => ({ width: 1, height: 2, mimeType: 'image/webp', bytes: webpBytes }) } })).rejects.toThrow('invalid metadata');
    await expect(createRotoScriptThumbnail({ ...input, nativeEncoder: { encodeWebp: async () => { throw new Error('native failed'); } } })).rejects.toThrow('native failed');
  });

  it('261026-nvq: an aquarelle sheet draws MULTIPLY over the composed background', async () => {
    resetProjectPaperRasterForTests();
    const { scriptDrawModes } = installCompositeRecordingCanvas();

    const encodeWebp = vi.fn(async ({ width, height }: { width: number; height: number }) => ({ width, height, mimeType: 'image/webp' as const, bytes: webpBytes }));
    await createRotoScriptThumbnail({
      scriptAlphaCanvas: {} as HTMLCanvasElement,
      sourceWidth: 16,
      sourceHeight: 16,
      background: { background: 'paper/cold-press', grainStrength: 1 },
      scriptComposite: 'multiply',
      nativeEncoder: { encodeWebp },
    });

    // The aquarelle sheet is OPAQUE transmittance (white = no pigment): it must
    // be multiplied over the paper, never source-over (which would cover it).
    expect(scriptDrawModes[scriptDrawModes.length - 1]).toBe('multiply');
    expect(scriptDrawModes.filter((mode) => mode === 'multiply')).toHaveLength(1);
  });

  it('261026-nvq: omitting scriptComposite keeps the engine-1 path source-over', async () => {
    resetProjectPaperRasterForTests();
    const { scriptDrawModes } = installCompositeRecordingCanvas();

    const encodeWebp = vi.fn(async ({ width, height }: { width: number; height: number }) => ({ width, height, mimeType: 'image/webp' as const, bytes: webpBytes }));
    await createRotoScriptThumbnail({
      scriptAlphaCanvas: {} as HTMLCanvasElement,
      sourceWidth: 16,
      sourceHeight: 16,
      background: { background: 'paper/cold-press', grainStrength: 1 },
      nativeEncoder: { encodeWebp },
    });

    expect(scriptDrawModes[scriptDrawModes.length - 1]).toBe('source-over');
  });

  it('261017-lny: a paper/* id paints the sheet under the script, not only the flat wash', async () => {
    resetProjectPaperRasterForTests();

    const calls: string[] = [];
    const context = {
      fillStyle: '', fillRect: vi.fn(() => calls.push('fill')), drawImage: vi.fn(() => calls.push('draw')),
      getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4).fill(255) })),
      createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
      putImageData: vi.fn(() => calls.push('put')),
    };
    const makeCanvas = () => ({ width: 0, height: 0, getContext: vi.fn(() => context), toBlob: vi.fn(() => {}) });
    if (!globalThis.document) Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => makeCanvas() } });
    else vi.spyOn(document, 'createElement').mockImplementation(() => makeCanvas() as never);
    const encodeWebp = vi.fn(async ({ width, height }: { width: number; height: number }) => ({ width, height, mimeType: 'image/webp' as const, bytes: webpBytes }));
    await createRotoScriptThumbnail({
      scriptAlphaCanvas: {} as HTMLCanvasElement,
      sourceWidth: 16,
      sourceHeight: 16,
      background: { background: 'paper/cold-press', grainStrength: 1 },
      nativeEncoder: { encodeWebp },
    });
    // flat fill (under) + opaque paper sheet + script alpha
    expect(calls[0]).toBe('fill');
    expect(calls[calls.length - 1]).toBe('draw');
    expect(calls[calls.length - 2]).toBe('draw');
    expect(calls.filter((c) => c === 'draw').length).toBeGreaterThanOrEqual(2);
  });
});
