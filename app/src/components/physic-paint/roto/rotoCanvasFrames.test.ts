import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerRotoAlphaCanvasFrame } from '../../../stores/physicPaintStore';
import { addOccupiedRotoFrame, buildBlankRotoFrame, drawCanvasAtSize } from './rotoCanvasFrames';

vi.mock('../../../stores/physicPaintStore', () => ({
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
