import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 261017-mz9: the sheet arrives from the worker client (async). Mock it at
// module scope so the fond seam installs a field and the subscribe path
// delivers the sheet — same door production uses, no inline generation.
const clientMock = vi.hoisted(() => ({
  requestProceduralSheet: vi.fn(),
}));
vi.mock('../../../lib/paperSheetClient', () => clientMock);

import { createRotoScriptThumbnail } from './physicsPaintRotoScriptThumbnail';
import { capFieldSize, generatePaperSheetCpu } from '../../../lib/paperSheetField';
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

beforeEach(() => {
  clientMock.requestProceduralSheet.mockReset();
  clientMock.requestProceduralSheet.mockImplementation(async (request: {
    paperTexture: string;
    width: number;
    height: number;
    grainScale: number;
  }) => {
    const { fieldWidth, fieldHeight } = capFieldSize(request.width, request.height);
    const pixels = generatePaperSheetCpu(request.paperTexture, fieldWidth, fieldHeight, request.grainScale);
    return pixels ? { path: 'worker-cpu', fieldWidth, fieldHeight, durationMs: 1, pixels } : null;
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
    // flat fill (under) + field install + opaque paper sheet + script alpha
    expect(calls[0]).toBe('fill');
    expect(calls).toContain('put');
    expect(calls[calls.length - 1]).toBe('draw');
    expect(calls[calls.length - 2]).toBe('draw');
    expect(calls.filter((c) => c === 'draw').length).toBeGreaterThanOrEqual(2);
  });
});
