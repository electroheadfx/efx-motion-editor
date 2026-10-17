/**
 * 261017-mdr: idle warm-up pins — deferred off first paint, idempotent
 * (second call is a fond-cache hit), non-procedural ids are no-ops, and
 * failures never throw into the Studio.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProjectPaperCanvas, resetProjectPaperRasterForTests } from './projectPaperRaster';
import { scheduleProceduralPaperWarmup, warmProceduralPaperSheet } from './paperSheetWarmup';

// GPU host returns null (CPU fallback) so the fond build is observable through
// the mock call count without a real WebGL2 context.
const glMock = vi.hoisted(() => ({
  renderPaperSheetGl: vi.fn((_w: number, _h: number, _s: number, _seed: number, _preset: unknown) => null as HTMLCanvasElement | null),
}));
vi.mock('./paperFieldGl', () => glMock);

type HarnessCanvas = {
  width: number;
  height: number;
  __pixels: Uint8ClampedArray | null;
  getContext: (type: string) => unknown;
};

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
    fillStyle: '#fff' as string,
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
    drawImage() {},
  };
  return canvas;
}

const originalDocument = globalThis.document;

function installPixelDocument(): void {
  Object.assign(globalThis, { document: { createElement: () => makePixelCanvas() } });
}

beforeEach(() => {
  resetProjectPaperRasterForTests();
  glMock.renderPaperSheetGl.mockReset(() => null);
  installPixelDocument();
});

afterEach(() => {
  resetProjectPaperRasterForTests();
  Object.assign(globalThis, { document: originalDocument });
  vi.useRealTimers();
});

const INPUT = {
  paperTexture: 'paper/cold-press',
  width: 16,
  height: 12,
  grainScale: 1,
};

describe('261017-mdr paperSheetWarmup', () => {
  it('warm-up fills the fond cache; a second getProjectPaperCanvas is an identity hit with no rebuild', () => {
    warmProceduralPaperSheet(INPUT);
    expect(glMock.renderPaperSheetGl).toHaveBeenCalledTimes(1);
    const first = getProjectPaperCanvas(INPUT.paperTexture, INPUT.width, INPUT.height, INPUT.grainScale);
    const again = getProjectPaperCanvas(INPUT.paperTexture, INPUT.width, INPUT.height, INPUT.grainScale);
    expect(first).not.toBeNull();
    expect(again).toBe(first);
    // Warm-up already built the sheet — the follow-up lookups did not rebuild.
    expect(glMock.renderPaperSheetGl).toHaveBeenCalledTimes(1);
  });

  it('scheduleProceduralPaperWarmup defers work (does not run inline)', () => {
    vi.useFakeTimers();
    scheduleProceduralPaperWarmup(INPUT);
    expect(glMock.renderPaperSheetGl).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(glMock.renderPaperSheetGl).toHaveBeenCalledTimes(1);
  });

  it('warm-up of a non-procedural id is a no-op (jpg arm is decode-cached elsewhere)', () => {
    warmProceduralPaperSheet({ ...INPUT, paperTexture: 'paper/real-1' });
    warmProceduralPaperSheet({ ...INPUT, paperTexture: 'canvas1' });
    warmProceduralPaperSheet({ ...INPUT, paperTexture: 'photo' });
    expect(glMock.renderPaperSheetGl).not.toHaveBeenCalled();
  });

  it('hostile sizes / grain scale are no-ops and never throw', () => {
    expect(() => warmProceduralPaperSheet({ ...INPUT, width: 0 })).not.toThrow();
    expect(() => warmProceduralPaperSheet({ ...INPUT, height: -1 })).not.toThrow();
    expect(() => warmProceduralPaperSheet({ ...INPUT, grainScale: 0 })).not.toThrow();
    expect(() => warmProceduralPaperSheet({ ...INPUT, grainScale: Number.NaN })).not.toThrow();
    expect(glMock.renderPaperSheetGl).not.toHaveBeenCalled();
  });

  it('warm-up failures never throw into the Studio', () => {
    Object.assign(globalThis, {
      document: {
        createElement: () => {
          throw new Error('boom');
        },
      },
    });
    expect(() => warmProceduralPaperSheet(INPUT)).not.toThrow();
    vi.useFakeTimers();
    expect(() => scheduleProceduralPaperWarmup(INPUT)).not.toThrow();
    expect(() => vi.runAllTimers()).not.toThrow();
  });

  it('a second schedule with the same input is a cache hit (no second rebuild)', () => {
    vi.useFakeTimers();
    scheduleProceduralPaperWarmup(INPUT);
    vi.runAllTimers();
    expect(glMock.renderPaperSheetGl).toHaveBeenCalledTimes(1);
    scheduleProceduralPaperWarmup(INPUT);
    vi.runAllTimers();
    expect(glMock.renderPaperSheetGl).toHaveBeenCalledTimes(1);
  });
});
