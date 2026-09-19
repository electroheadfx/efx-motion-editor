import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';

const harness = vi.hoisted(() => ({
  scriptAlpha: null as HTMLCanvasElement | null,
  merged: null as HTMLCanvasElement | null,
  merge: vi.fn(),
  encode: vi.fn(),
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
vi.mock('./physicsPaintRotoAlphaMerge', () => ({ mergeRotoAlphaCanvases: harness.merge }));
vi.mock('./rotoCanvasFrames', () => ({ encodeRotoFrameFromCanvas: harness.encode }));

import { renderRotoPlayScriptFrames } from './physicsPaintRotoPlayScriptRenderer';

function canvas(): HTMLCanvasElement {
  return { width: 10, height: 10 } as HTMLCanvasElement;
}

function input(onProgress?: () => void, extra: Record<string, unknown> = {}) {
  return {
    script: { provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 }, sourceFrame: 0, sourceDisplayFrame: 0, sourceRevision: 1, brushes: [] },
    frameCount: 1,
    canonicalStart: 4,
    motion: { deformation: 0, position: 0 },
    existingFrames: new Map(),
    size: { width: 10, height: 10 },
    signal: new AbortController().signal,
    onProgress,
    ...extra,
  };
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

/** Route the mocked schedule pair like the real modules: builder returns the stroke list, accessor applies the transform per frame. */
function enableScheduleFlow(): void {
  harness.buildStatic.mockImplementation((strokes: PaintStroke[]) => strokes);
  harness.buildProgressive.mockImplementation((strokes: PaintStroke[]) => strokes);
  const reveal = (schedule: PaintStroke[], frameIndex: number, transform?: (entry: PaintStroke, frame: number, index: number) => PaintStroke) =>
    schedule.map((entry, strokeIndex) => ({ stroke: transform ? transform(entry, frameIndex, strokeIndex) : entry, pointCount: entry.points.length }));
  harness.getStatic.mockImplementation(reveal);
  harness.getProgressive.mockImplementation(reveal);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

const modes = ['static', 'progressive'] as const;

describe('renderRotoPlayScriptFrames cleanup', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ replaceChildren: vi.fn() })) });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    harness.scriptAlpha = canvas();
    harness.merged = canvas();
    harness.merge.mockReset().mockResolvedValue(harness.merged);
    harness.encode.mockReset().mockResolvedValue({ frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,encoded', width: 10, height: 10 });
    harness.renderedFrames.length = 0;
    harness.buildStatic.mockReset().mockImplementation(() => ({}));
    harness.buildProgressive.mockReset().mockImplementation(() => ({}));
    harness.getStatic.mockReset().mockImplementation(() => []);
    harness.getProgressive.mockReset().mockImplementation(() => []);
    harness.transform.mockReset().mockImplementation((entry: PaintStroke) => entry);
  });

  it.each([
    ['merge failure', () => harness.merge.mockRejectedValueOnce(new Error('merge failed')), undefined],
    ['encode failure', () => harness.encode.mockRejectedValueOnce(new Error('encode failed')), undefined],
    ['progress failure', () => undefined, () => { throw new Error('progress failed'); }],
  ])('releases the coverage canvas after %s (G-52-10: the merged canvas is registry-owned, never released)', async (_name, configure, onProgress) => {
    configure();
    await expect(renderRotoPlayScriptFrames(input(onProgress))).rejects.toThrow();
    expect(harness.scriptAlpha?.width).toBe(0);
    expect(harness.scriptAlpha?.height).toBe(0);
    if (_name !== 'merge failure' && harness.merged) {
      // encodeRotoFrameFromCanvas adopts `merged` into the alpha-canvas
      // registry (same-size path) — the renderer must never release it; GC
      // reclaims it on the failure paths where registration never happened.
      expect(harness.merged.width).toBe(10);
      expect(harness.merged.height).toBe(10);
    }
  });
});

describe('renderRotoPlayScriptFrames mode selection and color override', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ replaceChildren: vi.fn() })) });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    harness.scriptAlpha = canvas();
    harness.merged = canvas();
    harness.merge.mockReset().mockResolvedValue(harness.merged);
    harness.encode.mockReset().mockResolvedValue({ frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,encoded', width: 10, height: 10 });
    harness.renderedFrames.length = 0;
    harness.transform.mockReset().mockImplementation((entry: PaintStroke) => entry);
    harness.buildStatic.mockReset();
    harness.buildProgressive.mockReset();
    harness.getStatic.mockReset();
    harness.getProgressive.mockReset();
    enableScheduleFlow();
  });

  it("routes mode 'static' through the static schedule pair, never the progressive pair", async () => {
    await renderRotoPlayScriptFrames(input(undefined, { mode: 'static' }));
    expect(harness.buildStatic).toHaveBeenCalledTimes(1);
    expect(harness.getStatic).toHaveBeenCalledTimes(1);
    expect(harness.buildProgressive).not.toHaveBeenCalled();
    expect(harness.getProgressive).not.toHaveBeenCalled();
  });

  it("keeps the progressive schedule pair when mode is omitted or 'progressive'", async () => {
    await renderRotoPlayScriptFrames(input());
    expect(harness.buildProgressive).toHaveBeenCalledTimes(1);
    expect(harness.getProgressive).toHaveBeenCalledTimes(1);
    expect(harness.buildStatic).not.toHaveBeenCalled();
    expect(harness.getStatic).not.toHaveBeenCalled();

    harness.buildProgressive.mockClear();
    harness.getProgressive.mockClear();
    await renderRotoPlayScriptFrames(input(undefined, { mode: 'progressive' }));
    expect(harness.buildProgressive).toHaveBeenCalledTimes(1);
    expect(harness.getProgressive).toHaveBeenCalledTimes(1);
    expect(harness.buildStatic).not.toHaveBeenCalled();
    expect(harness.getStatic).not.toHaveBeenCalled();
  });

  it.each(modes)('recolors paint strokes only under %s mode; erase strokes pass through untouched', async (mode) => {
    await renderRotoPlayScriptFrames(input(undefined, { mode, script: scriptWithStrokes(), overrideColor: '#ff8800' }));
    const rendered = harness.renderedFrames[0].map((entry) => entry.stroke);
    expect(rendered.map((entry) => entry.tool)).toEqual(['paint', 'erase', 'paint']);
    expect(rendered.map((entry) => entry.color)).toEqual(['#ff8800', null, '#ff8800']);
  });

  it.each(modes)('leaves original colors untouched under %s mode when no override is set', async (mode) => {
    await renderRotoPlayScriptFrames(input(undefined, { mode, script: scriptWithStrokes() }));
    const rendered = harness.renderedFrames[0].map((entry) => entry.stroke);
    expect(rendered.map((entry) => entry.color)).toEqual(['#123456', null, '#654321']);
  });

  it.each(modes)('applies the override after the Motion transform under %s mode: original color into the transform, point-identical geometry', async (mode) => {
    // Deterministic color-sensitive transform: recoloring BEFORE the transform would change geometry.
    const seenColors: Array<string | null | undefined> = [];
    harness.transform.mockImplementation((entry: PaintStroke, pose: { deformation: number; position: number }) => {
      seenColors.push(entry.color);
      const colorShift = (entry.color ?? '').length;
      return {
        ...entry,
        points: entry.points.map((p) => ({ ...p, x: p.x + pose.position + colorShift, y: p.y + pose.deformation + colorShift })),
        params: { ...entry.params },
      };
    });
    const motion = { deformation: 60, position: 40 };
    await renderRotoPlayScriptFrames(input(undefined, { mode, script: scriptWithStrokes(), overrideColor: '#ff8800', motion }));
    const overrideGeometry = harness.renderedFrames.map((frame) => frame.map((entry) => entry.stroke.points));
    expect(seenColors).toEqual(['#123456', null, '#654321']);

    harness.renderedFrames.length = 0;
    await renderRotoPlayScriptFrames(input(undefined, { mode, script: scriptWithStrokes(), motion }));
    const originalGeometry = harness.renderedFrames.map((frame) => frame.map((entry) => entry.stroke.points));
    expect(overrideGeometry).toEqual(originalGeometry);
  });

  it.each(modes)('leaves the source script deeply unchanged under %s mode (override and no-override)', async (mode) => {
    const source = scriptWithStrokes();
    const snapshot = structuredClone(source);
    await renderRotoPlayScriptFrames(input(undefined, { mode, script: source, overrideColor: '#ff8800' }));
    expect(source).toEqual(snapshot);
    await renderRotoPlayScriptFrames(input(undefined, { mode, script: source }));
    expect(source).toEqual(snapshot);
  });

  it.each(modes)('renders a deep-frozen script input without mutation attempts under %s mode', async (mode) => {
    const frozen = deepFreeze(scriptWithStrokes());
    await expect(renderRotoPlayScriptFrames(input(undefined, { mode, script: frozen, overrideColor: '#00ff00' }))).resolves.toHaveLength(1);
  });
});

// 43-04 Task 1 (HOLD-01): static/hold complete-stroke-set materialization and
// adjacent-range half-open boundaries. Hardening specs against shipped machinery —
// expected to PASS on first run; a RED result is a genuine Phase 42 regression and
// routes through the bounded deviation protocol (never asserted away).
describe('renderRotoPlayScriptFrames HOLD-01 static/hold materialization', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ replaceChildren: vi.fn() })) });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    harness.scriptAlpha = canvas();
    harness.merged = canvas();
    harness.merge.mockReset().mockResolvedValue(harness.merged);
    // Encode echoes the destination so staged output is traceable per frame.
    harness.encode.mockReset().mockImplementation(async (_canvas: HTMLCanvasElement, destination: number) => ({
      frameIndex: 0,
      appFrame: destination,
      dataUrl: `data:image/png;base64,encoded-${destination}`,
      width: 10,
      height: 10,
    }));
    harness.renderedFrames.length = 0;
    harness.transform.mockReset().mockImplementation((entry: PaintStroke) => entry);
    harness.buildStatic.mockReset();
    harness.buildProgressive.mockReset();
    harness.getStatic.mockReset();
    harness.getProgressive.mockReset();
    enableScheduleFlow();
  });

  it('materializes the complete stroke set on every destination frame under static mode', async () => {
    const script = scriptWithStrokes(); // 3 flattened strokes: 3, 2, and 1 points
    const staged = await renderRotoPlayScriptFrames(input(undefined, { mode: 'static', script, frameCount: 3, canonicalStart: 15 }));
    expect(staged.map((frame) => frame.appFrame)).toEqual([15, 16, 17]);
    expect(harness.renderedFrames).toHaveLength(3);
    for (const frame of harness.renderedFrames) {
      expect(frame.map((entry) => entry.stroke.color)).toEqual(['#123456', null, '#654321']);
      expect(frame.map((entry) => entry.pointCount)).toEqual([3, 2, 1]);
    }
  });

  it('progressive on frames 10-14 then static/hold on frames 15-19: no overlap, no gap, no cross-range strokes', async () => {
    const progressiveScript: RotoPaintScript = {
      provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 },
      sourceFrame: 0,
      sourceDisplayFrame: 0,
      sourceRevision: 1,
      brushes: [{ primary: stroke('paint', '#aaaaaa', 2, 11), continuations: [] }],
    };
    const holdScript: RotoPaintScript = {
      provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 },
      sourceFrame: 0,
      sourceDisplayFrame: 0,
      sourceRevision: 1,
      brushes: [{ primary: stroke('paint', '#bbbbbb', 2, 22), continuations: [stroke('erase', null, 1, 33)] }],
    };

    const progressiveStaged = await renderRotoPlayScriptFrames(input(undefined, { mode: 'progressive', script: progressiveScript, frameCount: 5, canonicalStart: 10 }));
    const progressiveFrames = harness.renderedFrames.map((frame) => frame.map((entry) => entry.stroke.color));

    harness.renderedFrames.length = 0;
    const holdStaged = await renderRotoPlayScriptFrames(input(undefined, { mode: 'static', script: holdScript, frameCount: 5, canonicalStart: 15 }));
    const holdFrames = harness.renderedFrames.map((frame) => frame.map((entry) => entry.stroke.color));

    // Half-open boundaries: [10,15) then [15,20) — no overlap, no gap.
    expect(progressiveStaged.map((frame) => frame.appFrame)).toEqual([10, 11, 12, 13, 14]);
    expect(holdStaged.map((frame) => frame.appFrame)).toEqual([15, 16, 17, 18, 19]);
    const destinations = [...progressiveStaged, ...holdStaged].map((frame) => frame.appFrame);
    expect(new Set(destinations).size).toBe(10); // zero overlap
    expect(Math.min(...destinations)).toBe(10);
    expect(Math.max(...destinations)).toBe(19); // zero gap

    // No frame receives strokes from the other range; no frame is empty of its own script's strokes.
    expect(progressiveFrames).toHaveLength(5);
    for (const frame of progressiveFrames) expect(frame).toEqual(['#aaaaaa']);
    expect(holdFrames).toHaveLength(5);
    for (const frame of holdFrames) expect(frame).toEqual(['#bbbbbb', null]);
  });

  it('a single-stroke static script over 3 frames yields 3 frames each containing exactly that stroke', async () => {
    const single: RotoPaintScript = {
      provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 },
      sourceFrame: 0,
      sourceDisplayFrame: 0,
      sourceRevision: 1,
      brushes: [{ primary: stroke('paint', '#00ff00', 4, 7), continuations: [] }],
    };
    const staged = await renderRotoPlayScriptFrames(input(undefined, { mode: 'static', script: single, frameCount: 3, canonicalStart: 6 }));
    expect(staged.map((frame) => frame.appFrame)).toEqual([6, 7, 8]);
    expect(harness.renderedFrames).toHaveLength(3);
    for (const frame of harness.renderedFrames) {
      expect(frame).toHaveLength(1);
      expect(frame[0].stroke.color).toBe('#00ff00');
      expect(frame[0].pointCount).toBe(4);
    }
  });

  it('seeds the held-pose transform with the destination appFrame for every frame (HOLD-02 seeding contract)', async () => {
    const seen: Array<{ destinationSourceFrame: number; strokeIndex: number }> = [];
    harness.transform.mockImplementation((entry: PaintStroke, pose: { destinationSourceFrame: number; strokeIndex: number }) => {
      seen.push({ destinationSourceFrame: pose.destinationSourceFrame, strokeIndex: pose.strokeIndex });
      return entry;
    });
    await renderRotoPlayScriptFrames(input(undefined, { mode: 'static', script: scriptWithStrokes(), frameCount: 3, canonicalStart: 15 }));
    // 3 frames × 3 strokes; per frame the seed is the destination appFrame, stroke index stable.
    expect(seen).toEqual([
      { destinationSourceFrame: 15, strokeIndex: 0 },
      { destinationSourceFrame: 15, strokeIndex: 1 },
      { destinationSourceFrame: 15, strokeIndex: 2 },
      { destinationSourceFrame: 16, strokeIndex: 0 },
      { destinationSourceFrame: 16, strokeIndex: 1 },
      { destinationSourceFrame: 16, strokeIndex: 2 },
      { destinationSourceFrame: 17, strokeIndex: 0 },
      { destinationSourceFrame: 17, strokeIndex: 1 },
      { destinationSourceFrame: 17, strokeIndex: 2 },
    ]);
  });
});
