import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaintStroke } from '@efxlab/efx-physic-paint';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';

/**
 * 52-01 (RVL-01/RVL-02/RVL-03): the reveal bake mask semantics.
 *
 * The bake reuses the PlayScript coverage path (progressive/static schedules →
 * `renderProgressiveAlphaFrame`) but REPLACES the additive merge with a
 * reference-mask composite: the reference image AS PLACED (Phase 50 transform)
 * at FULL source opacity (D-18), masked by the coverage alpha via
 * `destination-in` (D-17). These tests drive a recording canvas context so the
 * composite operations are asserted directly — the reference draw transform,
 * the destination-in mask, and the straight-alpha encode boundary.
 */

type MaskOp =
  | { type: 'clearRect' }
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'translate'; x: number; y: number }
  | { type: 'rotate'; radians: number }
  | { type: 'scale'; x: number; y: number }
  | { type: 'drawImage'; source: string; args: number[]; globalAlpha: number; globalCompositeOperation: string }
  | { type: 'setComposite'; op: string };

const harness = vi.hoisted(() => ({
  scriptAlpha: null as HTMLCanvasElement | null,
  encode: vi.fn(),
  renderedFrames: [] as Array<Array<{ stroke: PaintStroke; pointCount: number }>>,
  buildStatic: vi.fn(),
  buildProgressive: vi.fn(),
  getStatic: vi.fn(),
  getProgressive: vi.fn(),
  transform: vi.fn(),
  maskOps: [] as MaskOp[],
  referenceImage: null as HTMLImageElement | null,
  canvases: [] as Array<{ width: number; height: number }>,
  /** WR-02 (260920-kov): every createObjectURL call, for the decode-once count. */
  objectUrlCalls: [] as Array<{ parts?: Uint8Array[] }>,
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
vi.mock('./rotoCanvasFrames', () => ({ encodeRotoFrameFromCanvas: harness.encode }));

import { renderRotoRevealFrames } from './physicsPaintRotoPlayScriptRenderer';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

class RecordingContext {
  readonly ops: MaskOp[];
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  private stack: Array<{ globalAlpha: number; globalCompositeOperation: string }> = [];
  constructor(ops: MaskOp[]) { this.ops = ops; }
  clearRect(): void { this.ops.push({ type: 'clearRect' }); }
  save(): void {
    this.ops.push({ type: 'save' });
    this.stack.push({ globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
  }
  restore(): void {
    this.ops.push({ type: 'restore' });
    const top = this.stack.pop();
    if (!top) return;
    this.globalAlpha = top.globalAlpha;
    this.globalCompositeOperation = top.globalCompositeOperation;
  }
  translate(x: number, y: number): void { this.ops.push({ type: 'translate', x, y }); }
  rotate(radians: number): void { this.ops.push({ type: 'rotate', radians }); }
  scale(x: number, y: number): void { this.ops.push({ type: 'scale', x, y }); }
  drawImage(source?: unknown, ...args: number[]): void {
    const sourceLabel = source !== null && typeof source === 'object' && 'src' in source
      ? String((source as { src: unknown }).src)
      : 'canvas';
    this.ops.push({ type: 'drawImage', source: sourceLabel, args, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
  }
}

class RecordingCanvas {
  width = 0;
  height = 0;
  constructor(readonly ops: MaskOp[]) {}
  getContext(kind: string): RecordingContext | null {
    return kind === '2d' ? new RecordingContext(this.ops) : null;
  }
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 4;
  height = 3;
  private currentSrc = '';
  set src(value: string) { this.currentSrc = value; this.onload?.(); }
  get src(): string { return this.currentSrc; }
}

/** WR-02: a Blob stub that exposes its parts synchronously so the URL mock can label by content. */
class RecordingBlob {
  readonly parts: Uint8Array[];
  readonly type: string;
  readonly size: number;
  constructor(parts: Array<Uint8Array | string>, options?: { type?: string }) {
    this.parts = parts.filter((part): part is Uint8Array => part instanceof Uint8Array);
    this.type = options?.type ?? '';
    this.size = this.parts.reduce((total, part) => total + part.byteLength, 0);
  }
}

function canvas(): HTMLCanvasElement {
  return { width: 10, height: 10 } as HTMLCanvasElement;
}

function input(extra: Partial<Parameters<typeof renderRotoRevealFrames>[0]> = {}): Parameters<typeof renderRotoRevealFrames>[0] {
  const canonicalStart = extra.canonicalStart ?? 4;
  const frameCount = extra.frameCount ?? 1;
  // WR-02 (260920-kov): the reference now carries a per-application-frame bytes
  // map. The default mirrors the store's single-image shape — ONE shared
  // instance resolving every frame of the span — which is also the decode-once
  // case (the renderer caches by payload identity).
  const sharedBytes = testWebpBytes('ref');
  return {
    script: { provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 }, sourceFrame: 0, sourceDisplayFrame: 0, sourceRevision: 1, brushes: [] },
    frameCount: 1,
    canonicalStart: 4,
    motion: { deformation: 0, position: 0 },
    mode: 'progressive',
    size: { width: 10, height: 10 },
    reference: {
      bytesByAppFrame: new Map(Array.from({ length: frameCount }, (_, index) => [canonicalStart + index, sharedBytes] as const)),
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      zoom: 1,
    },
    signal: new AbortController().signal,
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

function setupDom(): void {
  harness.maskOps.length = 0;
  harness.canvases.length = 0;
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        const created = new RecordingCanvas(harness.maskOps);
        harness.canvases.push(created);
        return created;
      }
      return { replaceChildren: vi.fn() };
    },
  });
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('HTMLImageElement', FakeImage);
  harness.objectUrlCalls.length = 0;
  // WR-02 (260920-kov): the object-URL label is derived from the PAYLOAD
  // CONTENT (the testWebpBytes fixture appends its seed from byte 32), so the
  // mask-op log can tell distinct reference images apart. A constant label
  // cannot express "application frame N drew source image N".
  vi.stubGlobal('Blob', RecordingBlob);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: unknown) => {
      const parts = (blob as { parts?: Uint8Array[] } | null)?.parts ?? [];
      harness.objectUrlCalls.push({ parts });
      const seed = Array.from(parts[0]?.slice(32) ?? []).map((code) => String.fromCharCode(code)).join('');
      return `blob:${seed}`;
    }),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

function setupHarness(): void {
  harness.scriptAlpha = canvas();
  harness.encode.mockReset().mockImplementation(async (_canvas: HTMLCanvasElement, destination: number) => ({
    frameIndex: 0,
    appFrame: destination,
    bytes: testWebpBytes(`encoded-${destination}`),
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
}

describe('renderRotoRevealFrames happy path (52-01 Task 1)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  it('produces one staged key per frame across the span, straight-alpha encoded', async () => {
    const staged = await renderRotoRevealFrames(input({ frameCount: 3, canonicalStart: 15 }));
    expect(staged.map((frame) => frame.appFrame)).toEqual([15, 16, 17]);
    expect(staged.every((frame) => frame.source === 'real-key')).toBe(true);
    expect(harness.encode).toHaveBeenCalledTimes(3);
  });

  it('draws the reference AS PLACED at full opacity, then applies the coverage alpha as destination-in (D-14/D-17/D-18)', async () => {
    await renderRotoRevealFrames(input({
      reference: { bytesByAppFrame: new Map([[4, testWebpBytes('ref')]]), transform: { x: 2, y: 3, scaleX: 1.5, scaleY: 0.5, rotation: 45 }, zoom: 1 },
    }));
    const ops = harness.maskOps;
    // The reference draw: save → translate(center + x·zoom, center + y·zoom) → rotate → scale → drawImage(ref, full alpha) → restore
    const referenceDraw = ops.findIndex((op) => op.type === 'drawImage' && op.source === 'blob:ref');
    expect(referenceDraw).toBeGreaterThan(-1);
    const draw = ops[referenceDraw] as Extract<MaskOp, { type: 'drawImage' }>;
    expect(draw.globalAlpha).toBe(1); // D-18: full source opacity, guide opacity ignored
    expect(draw.globalCompositeOperation).toBe('source-over');
    // The mask: destination-in over the coverage alpha canvas
    const maskDraw = ops.findIndex((op) => op.type === 'drawImage' && op.source === 'canvas');
    expect(maskDraw).toBeGreaterThan(referenceDraw);
    const mask = ops[maskDraw] as Extract<MaskOp, { type: 'drawImage' }>;
    expect(mask.globalCompositeOperation).toBe('destination-in');
    // The transform sequence: translate(5 + 2, 5 + 3) → rotate(45deg) → scale(1.5, 0.5)
    const translate = ops.find((op) => op.type === 'translate') as Extract<MaskOp, { type: 'translate' }>;
    expect(translate).toEqual({ type: 'translate', x: 7, y: 8 });
    const rotate = ops.find((op) => op.type === 'rotate') as Extract<MaskOp, { type: 'rotate' }>;
    expect(rotate.radians).toBeCloseTo((45 * Math.PI) / 180);
    const scale = ops.find((op) => op.type === 'scale') as Extract<MaskOp, { type: 'scale' }>;
    expect(scale).toEqual({ type: 'scale', x: 1.5, y: 0.5 });
  });

  it('scales the reference draw by zoom — the ghost math — so baked keys overlay the ghost (G-52-2a)', async () => {
    // Working size 10×10 with zoom 0.5 (a 20×20 project): the reference image
    // (4×3) draws at 2×1.5 and the transform translation scales by zoom.
    await renderRotoRevealFrames(input({
      reference: { bytesByAppFrame: new Map([[4, testWebpBytes('ref')]]), transform: { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0 }, zoom: 0.5 },
    }));
    const ops = harness.maskOps;
    const translate = ops.find((op) => op.type === 'translate') as Extract<MaskOp, { type: 'translate' }>;
    expect(translate).toEqual({ type: 'translate', x: 5 + 2 * 0.5, y: 5 + 3 * 0.5 });
    const referenceDraw = ops.find((op) => op.type === 'drawImage' && op.source === 'blob:ref') as Extract<MaskOp, { type: 'drawImage' }>;
    expect(referenceDraw.args).toEqual([-1, -0.75, 2, 1.5]);
  });

  it('is deterministic: the same script + reference + motion produce identical staged output', async () => {
    const first = await renderRotoRevealFrames(input({ frameCount: 2, script: scriptWithStrokes() }));
    harness.renderedFrames.length = 0;
    harness.maskOps.length = 0;
    const second = await renderRotoRevealFrames(input({ frameCount: 2, script: scriptWithStrokes() }));
    expect(second.map((frame) => frame.bytes)).toEqual(first.map((frame) => frame.bytes));
    expect(second.map((frame) => frame.appFrame)).toEqual(first.map((frame) => frame.appFrame));
  });

  it('releases the temporary coverage canvas but keeps the registry-owned mask canvas alive (G-52-10)', async () => {
    await renderRotoRevealFrames(input());
    expect(harness.scriptAlpha?.width).toBe(0);
    expect(harness.scriptAlpha?.height).toBe(0);
    // The mask canvas is adopted by the alpha-canvas registry inside
    // encodeRotoFrameFromCanvas — releasing it zeroed the compositor's
    // drawImage source (the stuck-dialog bug).
    expect(harness.canvases.length).toBeGreaterThan(0);
    for (const created of harness.canvases) {
      expect([created.width, created.height]).toEqual([10, 10]);
    }
  });
});

describe('renderRotoRevealFrames mask semantics (52-01 Task 2, RVL-02/RVL-03)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  it('routes mode progressive through the progressive schedule pair, never the static pair (RVL-03 motion)', async () => {
    await renderRotoRevealFrames(input({ mode: 'progressive' }));
    expect(harness.buildProgressive).toHaveBeenCalledTimes(1);
    expect(harness.getProgressive).toHaveBeenCalledTimes(1);
    expect(harness.buildStatic).not.toHaveBeenCalled();
    expect(harness.getStatic).not.toHaveBeenCalled();
  });

  it('routes mode static through the static schedule pair, never the progressive pair (RVL-03 static)', async () => {
    await renderRotoRevealFrames(input({ mode: 'static' }));
    expect(harness.buildStatic).toHaveBeenCalledTimes(1);
    expect(harness.getStatic).toHaveBeenCalledTimes(1);
    expect(harness.buildProgressive).not.toHaveBeenCalled();
    expect(harness.getProgressive).not.toHaveBeenCalled();
  });

  it('empty coverage (no strokes on a frame) still runs the mask composite — the destination-in keeps nothing (RVL-02 empty)', async () => {
    // A script with zero brushes produces an empty frameStrokes list; the engine
    // returns the coverage alpha canvas (empty in production), and the mask
    // composite still runs — reference pixels survive only where coverage is.
    await renderRotoRevealFrames(input({ script: { ...scriptWithStrokes(), brushes: [] } }));
    expect(harness.renderedFrames).toHaveLength(1);
    expect(harness.renderedFrames[0]).toEqual([]);
    const maskDraw = harness.maskOps.findIndex((op) => op.type === 'drawImage' && op.source === 'canvas');
    expect(maskDraw).toBeGreaterThan(-1);
  });

  it('full coverage bakes the full reference: the reference draw precedes the destination-in mask on every frame (RVL-02 full)', async () => {
    await renderRotoRevealFrames(input({ frameCount: 2, script: scriptWithStrokes() }));
    // Two frames → two reference draws + two destination-in masks.
    const referenceDraws = harness.maskOps.filter((op) => op.type === 'drawImage' && op.source === 'blob:ref');
    const maskDraws = harness.maskOps.filter((op) => op.type === 'drawImage' && op.source === 'canvas');
    expect(referenceDraws).toHaveLength(2);
    expect(maskDraws).toHaveLength(2);
    for (const mask of maskDraws) {
      expect((mask as Extract<MaskOp, { type: 'drawImage' }>).globalCompositeOperation).toBe('destination-in');
    }
  });

  it('partial coverage produces soft edges: the destination-in keeps the reference RGB unmodified (straight alpha, Pitfall 1)', async () => {
    // The destination-in composite never premultiplies: the reference draw uses
    // source-over at full alpha, and the mask only clips alpha. The encode
    // boundary is the existing straight-alpha `encodeRotoFrameFromCanvas`.
    await renderRotoRevealFrames(input({ script: scriptWithStrokes() }));
    const referenceDraw = harness.maskOps.find((op) => op.type === 'drawImage' && op.source === 'blob:ref') as Extract<MaskOp, { type: 'drawImage' }>;
    expect(referenceDraw.globalAlpha).toBe(1);
    expect(referenceDraw.globalCompositeOperation).toBe('source-over');
    // No alpha-blend or multiply op is ever set on the mask canvas.
    expect(harness.maskOps.some((op) => op.type === 'setComposite')).toBe(false);
  });

  it('progressive coverage extends frame after frame: the schedule accessor is called once per frame (RVL-03 motion)', async () => {
    await renderRotoRevealFrames(input({ mode: 'progressive', frameCount: 4, script: scriptWithStrokes() }));
    expect(harness.getProgressive).toHaveBeenCalledTimes(4);
    expect(harness.renderedFrames).toHaveLength(4);
  });

  it('static coverage replays the full stroke set on every frame (RVL-03 static)', async () => {
    await renderRotoRevealFrames(input({ mode: 'static', frameCount: 3, script: scriptWithStrokes() }));
    expect(harness.getStatic).toHaveBeenCalledTimes(3);
    expect(harness.renderedFrames).toHaveLength(3);
    for (const frame of harness.renderedFrames) {
      expect(frame.map((entry) => entry.stroke.color)).toEqual(['#123456', null, '#654321']);
    }
  });

  it('the eraser is a normal key eraser afterward: erase strokes pass through the schedule untouched (RVL-02 eraser)', async () => {
    await renderRotoRevealFrames(input({ mode: 'static', script: scriptWithStrokes() }));
    const rendered = harness.renderedFrames[0].map((entry) => entry.stroke);
    expect(rendered.map((entry) => entry.tool)).toEqual(['paint', 'erase', 'paint']);
    expect(rendered.map((entry) => entry.color)).toEqual(['#123456', null, '#654321']);
  });
});

// WR-02 (260920-kov): the D-15 frame-aligned law at the RENDERER boundary.
// The bake used to decode ONE reference image before the frame loop and reuse
// it for every frame of the span — the second half of the WR-02 surface. The
// reference now arrives as a per-application-frame bytes map resolved (and
// fail-closed pre-validated) by the store, and the render loop picks the image
// for the frame it is drawing.
describe('renderRotoRevealFrames frame-aligned reference (WR-02, 260920-kov)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  /** The ordered labels of the reference draws, one per frame. */
  function referenceDrawLabels(): string[] {
    return harness.maskOps
      .filter((op): op is Extract<MaskOp, { type: 'drawImage' }> => op.type === 'drawImage' && op.source.startsWith('blob:'))
      .map((op) => op.source);
  }

  it('WR-02: draws image N on application frame N across the span (D-15)', async () => {
    const bytesByAppFrame = new Map([
      [15, testWebpBytes('ref-0')],
      [16, testWebpBytes('ref-1')],
      [17, testWebpBytes('ref-2')],
    ]);
    await renderRotoRevealFrames(input({
      frameCount: 3,
      canonicalStart: 15,
      script: scriptWithStrokes(),
      reference: { bytesByAppFrame, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, zoom: 1 },
    }));

    // One reference draw per frame, in frame order, each the image that
    // resolves at that application frame.
    expect(referenceDrawLabels()).toEqual(['blob:ref-0', 'blob:ref-1', 'blob:ref-2']);
    expect(harness.encode).toHaveBeenCalledTimes(3);
  });

  it('WR-02: a frame with no reference entry fails closed instead of drawing a stale image', async () => {
    const bytesByAppFrame = new Map([
      [15, testWebpBytes('ref-0')],
      // frame 16 deliberately absent — the store pre-validates, so reaching
      // here means a caller bug and must never silently reuse frame 15's image.
      [17, testWebpBytes('ref-2')],
    ]);
    await expect(renderRotoRevealFrames(input({
      frameCount: 3,
      canonicalStart: 15,
      script: scriptWithStrokes(),
      reference: { bytesByAppFrame, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, zoom: 1 },
    }))).rejects.toThrow('reference image for frame 16');
    // Fail closed: frame 15 renders, frame 16 THROWS before any draw — the
    // reference is never substituted, and the staged prefix is discarded by
    // the same `staged.length = 0` catch the abort legs rely on.
    expect(referenceDrawLabels()).toEqual(['blob:ref-0']);
    expect(harness.encode).toHaveBeenCalledTimes(1);
  });

  it('WR-02: each DISTINCT payload decodes once — clamped repeats reuse the decoded image (no decode storm)', async () => {
    // The single-image reference: ONE payload instance resolving every frame of
    // a 3-frame span (exactly what the store hands for a one-image reference).
    const shared = testWebpBytes('ref-a');
    await renderRotoRevealFrames(input({
      frameCount: 3,
      canonicalStart: 15,
      script: scriptWithStrokes(),
      reference: { bytesByAppFrame: new Map([[15, shared], [16, shared], [17, shared]]), transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, zoom: 1 },
    }));

    expect(referenceDrawLabels()).toEqual(['blob:ref-a', 'blob:ref-a', 'blob:ref-a']);
    // THREE frames, ONE decode: the count is the number of distinct payloads,
    // never the frame count (the project's decode-storm lesson).
    expect(harness.objectUrlCalls).toHaveLength(1);
  });

  it('WR-02: a multi-image span decodes each distinct payload exactly once', async () => {
    await renderRotoRevealFrames(input({
      frameCount: 3,
      canonicalStart: 15,
      script: scriptWithStrokes(),
      reference: {
        bytesByAppFrame: new Map([[15, testWebpBytes('ref-0')], [16, testWebpBytes('ref-1')], [17, testWebpBytes('ref-2')]]),
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        zoom: 1,
      },
    }));
    expect(harness.objectUrlCalls).toHaveLength(3);
  });
});

describe('renderRotoRevealFrames abort (52-01 D-11 — an interrupted bake stages no keys)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  it('rejects with AbortError when the bake is aborted before it starts — nothing renders (throwIfAborted)', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(renderRotoRevealFrames(input({ signal: controller.signal }))).rejects.toMatchObject({ name: 'AbortError' });
    // Zero frames rendered, zero encodes — the bake never produces output to stage.
    expect(harness.renderedFrames).toHaveLength(0);
    expect(harness.encode).not.toHaveBeenCalled();
  });

  it('rejects with AbortError when aborted mid-bake after the first frame — never resolves the already-staged frame (D-11)', async () => {
    const controller = new AbortController();
    let encodeCalls = 0;
    harness.encode.mockImplementation(async (_canvas: HTMLCanvasElement, destination: number) => {
      encodeCalls += 1;
      // Interrupt on the second frame, AFTER frame index 0 was fully staged —
      // the harshest seam: a partial staged key already exists inside the loop.
      if (encodeCalls === 2) controller.abort();
      return {
        frameIndex: 0,
        appFrame: destination,
        dataUrl: `data:image/png;base64,encoded-${destination}`,
        width: 10,
        height: 10,
      };
    });
    await expect(renderRotoRevealFrames(input({ frameCount: 3, signal: controller.signal }))).rejects.toMatchObject({ name: 'AbortError' });
    // The remaining frame never renders — the loop stopped at the second frame
    // (two encodes, not three), and the promise rejected instead of resolving
    // the partial [frame 0] output.
    expect(encodeCalls).toBe(2);
  });
});
