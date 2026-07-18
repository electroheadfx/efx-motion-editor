import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  scriptAlpha: null as HTMLCanvasElement | null,
  merged: null as HTMLCanvasElement | null,
  merge: vi.fn(),
  encode: vi.fn(),
}));

vi.mock('@efxlab/efx-physic-paint', () => ({
  EfxPaintEngine: class {
    async init() {}
    setAnimationMode() {}
    setInputLocked() {}
    setBgMode() {}
    renderProgressiveAlphaFrame() { return harness.scriptAlpha; }
    destroy() {}
  },
}));
vi.mock('@efxlab/efx-physic-paint/animation', () => ({
  buildProgressiveStrokeSchedule: vi.fn(() => ({})),
  getProgressiveFrameStrokes: vi.fn(() => []),
  transformRecordedStrokeForHeldPose: vi.fn((stroke) => stroke),
}));
vi.mock('./physicsPaintRotoAlphaMerge', () => ({ mergeRotoAlphaCanvases: harness.merge }));
vi.mock('./rotoCanvasFrames', () => ({ encodeRotoFrameFromCanvas: harness.encode }));

import { renderRotoPlayScriptFrames } from './physicsPaintRotoPlayScriptRenderer';

function canvas(): HTMLCanvasElement {
  return { width: 10, height: 10 } as HTMLCanvasElement;
}

function input(onProgress?: () => void) {
  return {
    script: { provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 }, sourceFrame: 0, sourceDisplayFrame: 0, sourceRevision: 1, brushes: [] },
    frameCount: 1,
    canonicalStart: 4,
    motion: { deformation: 0, position: 0 },
    existingFrames: new Map(),
    size: { width: 10, height: 10 },
    signal: new AbortController().signal,
    onProgress,
  };
}

describe('renderRotoPlayScriptFrames cleanup', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ replaceChildren: vi.fn() })) });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { callback(0); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    harness.scriptAlpha = canvas();
    harness.merged = canvas();
    harness.merge.mockReset().mockResolvedValue(harness.merged);
    harness.encode.mockReset().mockResolvedValue({ frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,encoded', width: 10, height: 10 });
  });

  it.each([
    ['merge failure', () => harness.merge.mockRejectedValueOnce(new Error('merge failed')), undefined],
    ['encode failure', () => harness.encode.mockRejectedValueOnce(new Error('encode failed')), undefined],
    ['progress failure', () => undefined, () => { throw new Error('progress failed'); }],
  ])('releases temporary canvases after %s', async (_name, configure, onProgress) => {
    configure();
    await expect(renderRotoPlayScriptFrames(input(onProgress))).rejects.toThrow();
    expect(harness.scriptAlpha?.width).toBe(0);
    expect(harness.scriptAlpha?.height).toBe(0);
    if (_name !== 'merge failure' && harness.merged) {
      expect(harness.merged.width).toBe(0);
      expect(harness.merged.height).toBe(0);
    }
  });
});
