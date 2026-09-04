import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';

/**
 * G-52-10 registry ownership lifecycle pins.
 *
 * These tests drive renderRotoRevealFrames / renderRotoPlayScriptFrames through
 * the REAL encodeRotoFrameFromCanvas into the REAL alpha-canvas registry (only
 * the engine and the animation schedules are mocked). The bug was a
 * register-then-release in the render loop's `finally`: the registry ended up
 * mapping each baked dataUrl to a 0×0 canvas, and the compositor's FIX 3
 * branch then threw InvalidStateError at drawImage (the stuck-dialog bug).
 * The pin: after the render completes, every baked dataUrl's registry canvas
 * is alive at full size — a register-then-release fails this at any guard state.
 */

const harness = vi.hoisted(() => ({
  scriptAlpha: null as { width: number; height: number } | null,
  renderedFrames: [] as Array<Array<{ stroke: PaintStroke; pointCount: number }>>,
  buildStatic: vi.fn(),
  buildProgressive: vi.fn(),
  getStatic: vi.fn(),
  getProgressive: vi.fn(),
  transform: vi.fn(),
}));

vi.mock('@efxlab/efx-physic-paint', () => ({
  EfxPaintEngine: class {
    async init() {}
    setAnimationMode() {}
    setInputLocked() {}
    setBgMode() {}
    renderProgressiveAlphaFrame(frames: Array<{ stroke: PaintStroke; pointCount: number }>) {
      harness.renderedFrames.push(frames);
      return harness.scriptAlpha;
    }
    destroy() {}
  },
}));
vi.mock('@efxlab/efx-physic-paint/animation', () => ({
  buildProgressiveStrokeSchedule: harness.buildProgressive,
  getProgressiveFrameStrokes: harness.getProgressive,
  buildStaticStrokeSchedule: harness.buildStatic,
  getStaticFrameStrokes: harness.getStatic,
  transformRecordedStrokeForHeldPose: harness.transform,
}));

// The REAL modules under test: the encode registers into the REAL store registry.
import { hasRotoAlphaCanvasFrame } from '../../../stores/physicPaintStore';
import { renderRotoPlayScriptFrames, renderRotoRevealFrames } from './physicsPaintRotoPlayScriptRenderer';

class OwnedCanvas {
  width = 0;
  height = 0;
  getContext(kind: string) {
    if (kind !== '2d') return null;
    return {
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
    };
  }
  toBlob(callback: BlobCallback): void {
    callback(new Blob(['png'], { type: 'image/png' }));
  }
}

class StubFileReader {
  static count = 0;
  result: string | ArrayBuffer | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(): void {
    StubFileReader.count += 1;
    this.result = `data:image/png;base64,frame-${StubFileReader.count}`;
    this.onload?.();
  }
}

class StubImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 4;
  height = 3;
  #src = '';
  get src(): string { return this.#src; }
  set src(value: string) {
    this.#src = value;
    queueMicrotask(() => this.onload?.());
  }
}

const point = (index: number) => ({ x: index, y: index * 2, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 1 });
const stroke = (tool: 'paint' | 'erase', color: string | null, points: number, timestamp: number): PaintStroke => ({
  tool,
  color,
  timestamp,
  points: Array.from({ length: points }, (_, index) => point(index)),
  params: { size: 8, opacity: 70, pressure: 65, waterAmount: 40, dryAmount: 30, edgeDetail: 10, pickup: 3, eraseStrength: 20, antiAlias: 1 },
});

function scriptWithStrokes(): RotoPaintScript {
  return {
    provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 },
    sourceFrame: 0,
    sourceDisplayFrame: 0,
    sourceRevision: 1,
    brushes: [
      { primary: stroke('paint', '#123456', 3, 1), continuations: [stroke('erase', null, 2, 2)] },
      { primary: stroke('paint', '#654321', 1, 3), continuations: [] },
    ],
  };
}

function revealInput(extra: Record<string, unknown> = {}): Parameters<typeof renderRotoRevealFrames>[0] {
  return {
    script: scriptWithStrokes(),
    frameCount: 3,
    canonicalStart: 15,
    motion: { deformation: 0, position: 0 },
    mode: 'progressive',
    size: { width: 10, height: 10 },
    reference: { dataUrl: 'data:image/png;base64,ref', transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, zoom: 1 },
    signal: new AbortController().signal,
    ...extra,
  } as Parameters<typeof renderRotoRevealFrames>[0];
}

function paintInput(extra: Record<string, unknown> = {}): Parameters<typeof renderRotoPlayScriptFrames>[0] {
  return {
    script: scriptWithStrokes(),
    frameCount: 3,
    canonicalStart: 15,
    motion: { deformation: 0, position: 0 },
    mode: 'progressive',
    existingFrames: new Map(),
    size: { width: 10, height: 10 },
    signal: new AbortController().signal,
    ...extra,
  } as Parameters<typeof renderRotoPlayScriptFrames>[0];
}

describe('G-52-10 registry ownership (real encode → real registry)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: (tag: string) => (tag === 'canvas' ? new OwnedCanvas() : { replaceChildren: vi.fn() }),
    });
    vi.stubGlobal('Image', StubImage);
    vi.stubGlobal('HTMLImageElement', StubImage);
    vi.stubGlobal('FileReader', StubFileReader);
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    harness.scriptAlpha = { width: 10, height: 10 };
    harness.renderedFrames.length = 0;
    harness.transform.mockReset().mockImplementation((entry: PaintStroke) => entry);
    harness.buildStatic.mockReset().mockImplementation((strokes: PaintStroke[]) => strokes);
    harness.buildProgressive.mockReset().mockImplementation((strokes: PaintStroke[]) => strokes);
    const flow = (schedule: PaintStroke[], frameIndex: number, transform?: (entry: PaintStroke, frame: number, index: number) => PaintStroke) =>
      schedule.map((entry, strokeIndex) => ({ stroke: transform ? transform(entry, frameIndex, strokeIndex) : entry, pointCount: entry.points.length }));
    harness.getStatic.mockReset().mockImplementation(flow);
    harness.getProgressive.mockReset().mockImplementation(flow);
  });

  it('reveal bake: every baked dataUrl keeps a live full-size registry canvas', async () => {
    const staged = await renderRotoRevealFrames(revealInput());

    expect(staged.map((frame) => frame.appFrame)).toEqual([15, 16, 17]);
    for (const frame of staged) {
      // A register-then-release in the render loop zeroed this canvas AFTER
      // registration — the exact G-52-10 poison the compositor later drew from.
      expect(hasRotoAlphaCanvasFrame(frame.dataUrl, { width: 10, height: 10 })).toBe(true);
    }
    // The coverage alpha canvas is never registered, so it is still released.
    expect(harness.scriptAlpha?.width).toBe(0);
    expect(harness.scriptAlpha?.height).toBe(0);
  });

  it('paint PlayScript path: every baked dataUrl keeps a live full-size registry canvas (merged)', async () => {
    const staged = await renderRotoPlayScriptFrames(paintInput());

    expect(staged.map((frame) => frame.appFrame)).toEqual([15, 16, 17]);
    for (const frame of staged) {
      expect(hasRotoAlphaCanvasFrame(frame.dataUrl, { width: 10, height: 10 })).toBe(true);
    }
    expect(harness.scriptAlpha?.width).toBe(0);
    expect(harness.scriptAlpha?.height).toBe(0);
  });
});
