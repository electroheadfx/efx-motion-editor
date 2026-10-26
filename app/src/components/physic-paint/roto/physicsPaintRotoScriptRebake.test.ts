import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

const harness = vi.hoisted(() => ({
  merge: vi.fn(),
  encode: vi.fn(),
}));

vi.mock('./physicsPaintRotoAlphaMerge', () => ({ mergeRotoAlphaCanvases: harness.merge }));
vi.mock('./rotoCanvasFrames', () => ({ encodeRotoFrameFromCanvas: harness.encode }));

import { composeRotoScriptRebakeFrame } from './physicsPaintRotoScriptRebake';

type DrawCall = { source: string; args: number[] };

let drawCalls: DrawCall[] = [];
let sheetBitmap: { marker: string; close: ReturnType<typeof vi.fn> };
let decodeMock: ReturnType<typeof vi.fn>;

class SheetTestCanvas {
  width = 0;
  height = 0;
  marker = 'sheet-canvas';

  getContext(): { drawImage: (source: CanvasImageSource, ...args: number[]) => void } {
    return {
      drawImage: (source, ...args) => {
        drawCalls.push({ source: (source as { marker?: string }).marker ?? 'unknown', args });
      },
    };
  }
}

describe('261026 composeRotoScriptRebakeFrame (axis 2 — durable-base composite)', () => {
  const originalDocument = globalThis.document;
  const originalCreateImageBitmap = globalThis.createImageBitmap;

  beforeEach(() => {
    drawCalls = [];
    sheetBitmap = { marker: 'sheet-bitmap', close: vi.fn() };
    harness.merge.mockReset().mockResolvedValue({ marker: 'merged-canvas' });
    harness.encode.mockReset().mockImplementation(async (_canvas: unknown, appFrame: number) => ({
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes('merged'),
      width: 320,
      height: 180,
    }));
    vi.stubGlobal('document', {
      createElement: (tagName: string) => {
        if (tagName !== 'canvas') throw new Error(`Unexpected test element: ${tagName}`);
        return new SheetTestCanvas() as unknown as HTMLElement;
      },
    });
    decodeMock = vi.fn(async () => sheetBitmap);
    vi.stubGlobal('createImageBitmap', decodeMock);
  });

  afterEach(() => {
    vi.stubGlobal('document', originalDocument);
    vi.stubGlobal('createImageBitmap', originalCreateImageBitmap);
    vi.unstubAllGlobals();
  });

  it('multiply-composites the baked sheet OVER the durable base and re-encodes the composite', async () => {
    const durableBaseBytes = testWebpBytes('base-red-only');
    const sheetBytes = testWebpBytes('sheet-blue-only');

    const result = await composeRotoScriptRebakeFrame({
      durableBaseBytes,
      sheetBytes,
      appFrame: 6,
      size: { width: 320, height: 180 },
    });

    // The aquarelle bake decodes premultiply-pinned, like the cached base.
    expect(decodeMock.mock.calls[0]![1]).toEqual({ premultiplyAlpha: 'premultiply' });
    expect(drawCalls).toEqual([{ source: 'sheet-bitmap', args: [0, 0, 320, 180] }]);
    // The base frame stays the durable source-key payload; blend is MULTIPLY.
    expect(harness.merge).toHaveBeenCalledWith(
      { bytes: durableBaseBytes },
      expect.objectContaining({ width: 320, height: 180 }),
      { width: 320, height: 180 },
      undefined,
      'multiply',
    );
    expect(harness.encode).toHaveBeenCalledWith({ marker: 'merged-canvas' }, 6);
    expect(result).toEqual({
      frameIndex: 0,
      appFrame: 6,
      bytes: testWebpBytes('merged'),
      width: 320,
      height: 180,
    });
    expect(sheetBitmap.close).toHaveBeenCalledTimes(1);
    expect(durableBaseBytes).toEqual(testWebpBytes('base-red-only'));
  });

  it('returns null (fail closed) when the baked sheet cannot be decoded — no merge, no publish frame', async () => {
    decodeMock = vi.fn(async () => {
      throw new Error('decode failed');
    });
    vi.stubGlobal('createImageBitmap', decodeMock);

    const result = await composeRotoScriptRebakeFrame({
      durableBaseBytes: testWebpBytes('base'),
      sheetBytes: testWebpBytes('sheet'),
      appFrame: 6,
      size: { width: 320, height: 180 },
    });

    expect(result).toBeNull();
    expect(harness.merge).not.toHaveBeenCalled();
    expect(harness.encode).not.toHaveBeenCalled();
  });

  it('returns null (fail closed) when the merge fails — a stroke-only sheet never escapes', async () => {
    harness.merge.mockRejectedValue(new Error('merge failed'));

    const result = await composeRotoScriptRebakeFrame({
      durableBaseBytes: testWebpBytes('base'),
      sheetBytes: testWebpBytes('sheet'),
      appFrame: 6,
      size: { width: 320, height: 180 },
    });

    expect(result).toBeNull();
    expect(harness.encode).not.toHaveBeenCalled();
    expect(sheetBitmap.close).toHaveBeenCalledTimes(1);
  });

  it('returns null when the output 2D context is unavailable', async () => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }) as unknown as HTMLElement,
    });

    const result = await composeRotoScriptRebakeFrame({
      durableBaseBytes: testWebpBytes('base'),
      sheetBytes: testWebpBytes('sheet'),
      appFrame: 6,
      size: { width: 320, height: 180 },
    });

    expect(result).toBeNull();
    expect(harness.merge).not.toHaveBeenCalled();
  });
});
