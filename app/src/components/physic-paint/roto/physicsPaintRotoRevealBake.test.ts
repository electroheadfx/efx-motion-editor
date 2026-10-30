import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';

/**
 * 52-01 (RVL-01/RVL-02/RVL-03) on the watercolor-only path (261027-klx).
 *
 * The reveal bake reuses the Play/Apply aquarelle wash bake and REPLACES the
 * old additive merge with a reference-mask composite: the reference image AS
 * PLACED (Phase 50 transform) at FULL source opacity (D-18), masked by the
 * wash's PIGMENT alpha via `destination-in` (D-17). The fluid sim itself is
 * mocked here — these tests own the reveal contract around it: the refusal of
 * an old Brush script, the transmittance→alpha conversion boundary, the
 * per-frame reference law (WR-02), static/progressive bake windows, paper
 * passthrough, abort, and disposal.
 */

type MaskOp =
  | { type: 'clearRect'; canvas: number }
  | { type: 'save'; canvas: number }
  | { type: 'restore'; canvas: number }
  | { type: 'translate'; canvas: number; x: number; y: number }
  | { type: 'rotate'; canvas: number; radians: number }
  | { type: 'scale'; canvas: number; x: number; y: number }
  | { type: 'drawImage'; canvas: number; source: string; sourceCanvas: number | null; args: number[]; globalAlpha: number; composite: string }
  | { type: 'getImageData'; canvas: number }
  | { type: 'putImageData'; canvas: number };

const harness = vi.hoisted(() => ({
  encode: vi.fn(),
  bakeResult: null as unknown,
  /**
   * Mutable harness ledger: `setupHarness` clears it and the bake pushes the
   * SAME event-array instance (a row asserts identity with `toBe`).
   */
  bakeEvents: [] as Array<readonly unknown[]>,
  bakeOptions: [] as Array<Record<string, unknown>>,
  bakeDispose: vi.fn(),
  bakeInterrupt: vi.fn(),
  adapterOptions: [] as Array<Record<string, unknown>>,
  adapterDispose: vi.fn(),
  paperPreset: vi.fn((paperId: string) => `preset:${paperId}`),
  canvases: [] as Array<{ width: number; height: number; ops: MaskOp[] }>,
  /** WR-02: every createObjectURL call, for the decode-once count. */
  objectUrlCalls: [] as Array<{ parts?: Uint8Array[] }>,
  failReadback: false,
}));

vi.mock('@efxlab/efx-watercolor', () => ({
  createAquarelleEngineAdapter: (options: Record<string, unknown>) => {
    harness.adapterOptions.push(options);
    return { dispose: harness.adapterDispose };
  },
}));
vi.mock('@efxlab/efx-watercolor/bake', () => ({
  createAquarelleBake: (_adapter: unknown, options: Record<string, unknown>) => {
    harness.bakeOptions.push(options);
    return {
      bake: async (events: readonly unknown[]) => {
        harness.bakeEvents.push(events);
        return harness.bakeResult;
      },
      flush: async () => {},
      beginFlush: () => () => {},
      dispose: harness.bakeDispose,
      interrupt: harness.bakeInterrupt,
      inFlight: 0,
    };
  },
}));
vi.mock('../engine/AquarelleCanvasLayer', () => ({
  paperPresetForStudioId: harness.paperPreset,
}));
vi.mock('../../../lib/webpFrameCodec', () => ({ encodeWebpFrame: vi.fn() }));
vi.mock('./rotoCanvasFrames', () => ({ encodeRotoFrameFromCanvas: harness.encode }));

import { renderRotoRevealFrames } from './physicsPaintRotoPlayScriptRenderer';
import { computeAquarelleSheetPose } from './aquarelleFramePose';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

class RecordingCanvas {
  readonly __recordingCanvasId: number;
  readonly ops: MaskOp[] = [];
  width = 0;
  height = 0;
  private context: RecordingContext | null = null;

  constructor() {
    this.__recordingCanvasId = harness.canvases.length;
    harness.canvases.push(this);
  }

  getContext(kind: string): RecordingContext | null {
    if (kind !== '2d') return null;
    this.context ??= new RecordingContext(this);
    return this.context;
  }
}

class RecordingContext {
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  private stack: Array<{ globalAlpha: number; globalCompositeOperation: string }> = [];
  constructor(private readonly canvas: RecordingCanvas) {}

  private record(op: MaskOp): void { this.canvas.ops.push(op); }
  private id(): number { return this.canvas.__recordingCanvasId; }

  clearRect(): void { this.record({ type: 'clearRect', canvas: this.id() }); }
  save(): void {
    this.record({ type: 'save', canvas: this.id() });
    this.stack.push({ globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
  }
  restore(): void {
    this.record({ type: 'restore', canvas: this.id() });
    const top = this.stack.pop();
    if (!top) return;
    this.globalAlpha = top.globalAlpha;
    this.globalCompositeOperation = top.globalCompositeOperation;
  }
  translate(x: number, y: number): void { this.record({ type: 'translate', canvas: this.id(), x, y }); }
  rotate(radians: number): void { this.record({ type: 'rotate', canvas: this.id(), radians }); }
  scale(x: number, y: number): void { this.record({ type: 'scale', canvas: this.id(), x, y }); }
  drawImage(source?: unknown, ...args: number[]): void {
    const candidate = source as { __recordingCanvasId?: unknown; src?: unknown } | null;
    const sourceCanvas = typeof candidate?.__recordingCanvasId === 'number'
      ? (candidate.__recordingCanvasId as number)
      : null;
    const label = sourceCanvas !== null
      ? `canvas:${sourceCanvas}`
      : typeof candidate?.src === 'string'
        ? candidate.src
        : 'unknown';
    this.record({
      type: 'drawImage',
      canvas: this.id(),
      source: label,
      sourceCanvas,
      args,
      globalAlpha: this.globalAlpha,
      composite: this.globalCompositeOperation,
    });
  }
  getImageData(): { data: Uint8ClampedArray } {
    this.record({ type: 'getImageData', canvas: this.id() });
    if (harness.failReadback) throw new Error('readback blocked');
    const data = new Uint8ClampedArray(this.canvas.width * this.canvas.height * 4);
    data.fill(255);
    return { data };
  }
  putImageData(): void { this.record({ type: 'putImageData', canvas: this.id() }); }
}

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 4;
  height = 3;
  private currentSrc = '';
  set src(value: string) {
    this.currentSrc = value;
    this.onload?.();
  }
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

function setupDom(): void {
  harness.canvases.length = 0;
  harness.failReadback = false;
  vi.stubGlobal('document', {
    createElement: (tag: string) => (tag === 'canvas' ? new RecordingCanvas() : { replaceChildren: vi.fn() }),
  });
  vi.stubGlobal('Image', FakeImage);
  vi.stubGlobal('HTMLImageElement', FakeImage);
  harness.objectUrlCalls.length = 0;
  // WR-02: the object-URL label is derived from the PAYLOAD CONTENT (the
  // testWebpBytes fixture appends its seed from byte 32), so the mask-op log
  // can tell distinct reference images apart.
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

function strokeEvent(recordedOrder = 1): AquarellePayloadEvent {
  return {
    pts: [{ x: 0.25, y: 0.75, p: 0.8, tx: 0, ty: 0, tw: 0, tick: 0 }],
    ticks: 0,
    cuisson: 0,
    motion: null,
    brushId: 'wc/round-medium',
    toolOverrides: {},
    traceSeed: 7,
    recordedOrder,
    playFrame: null,
    color: '#224466',
    engine: { tool: 'brush', color: '#224466', params: { size: 12 }, brushId: 'wc/round-medium', mutationId: recordedOrder, timestamp: recordedOrder },
  };
}

function script(events?: readonly AquarellePayloadEvent[]): RotoPaintScript {
  return {
    provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 },
    sourceFrame: 0,
    sourceDisplayFrame: 0,
    sourceRevision: 1,
    brushes: [],
    ...(events === undefined ? {} : { engineId: 'efx-watercolor', aquarelleEvents: events }),
  };
}

function washFrame(seed: string, eventIndex = 0) {
  return { eventIndex, strokeIndex: eventIndex, tick: 0, bytes: testWebpBytes(seed), width: 10, height: 10 };
}

function stagedBake(seeds: readonly string[]): void {
  harness.bakeResult = { ok: true, frames: seeds.map((seed, index) => washFrame(seed, index)) };
}

function input(extra: Partial<Parameters<typeof renderRotoRevealFrames>[0]> = {}): Parameters<typeof renderRotoRevealFrames>[0] {
  const canonicalStart = extra.canonicalStart ?? 4;
  const frameCount = extra.frameCount ?? 1;
  // WR-02: the reference carries a per-application-frame bytes map. The default
  // mirrors the store's single-image shape — ONE shared instance resolving every
  // frame of the span — which is also the decode-once case.
  const sharedBytes = testWebpBytes('ref');
  return {
    script: script([strokeEvent()]),
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

function setupHarness(): void {
  harness.encode.mockReset().mockImplementation(async (_canvas: HTMLCanvasElement, destination: number) => ({
    frameIndex: 0,
    appFrame: destination,
    bytes: testWebpBytes(`encoded-${destination}`),
    width: 10,
    height: 10,
  }));
  harness.bakeEvents.length = 0;
  harness.bakeOptions.length = 0;
  harness.bakeDispose.mockReset();
  harness.bakeInterrupt.mockReset();
  harness.adapterOptions.length = 0;
  harness.adapterDispose.mockReset();
  harness.paperPreset.mockClear();
  stagedBake(['wash-0']);
}

/** The mask canvas is the one that ever applies `destination-in`. */
function maskCanvasIndices(): number[] {
  return harness.canvases
    .map((canvas, index) => ({ canvas, index }))
    .filter(({ canvas }) => canvas.ops.some((op) => op.type === 'drawImage' && op.composite === 'destination-in'))
    .map(({ index }) => index);
}

/** Ops of the mask canvases only — wash-canvas draws are not references. */
function maskOps(): MaskOp[] {
  return maskCanvasIndices().flatMap((index) => harness.canvases[index]!.ops);
}

function referenceDraws(): Array<Extract<MaskOp, { type: 'drawImage' }>> {
  return maskOps().filter(
    (op): op is Extract<MaskOp, { type: 'drawImage' }> => op.type === 'drawImage' && op.source.startsWith('blob:'),
  );
}

/** True when ANY canvas received a `putImageData` (transmittanceToAlpha's output). */
function wroteConvertedPixels(): boolean {
  return harness.canvases.some((canvas) => canvas.ops.some((op) => op.type === 'putImageData'));
}

describe('renderRotoRevealFrames refuses an old Brush script (261027-klx)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  it('refuses a script with no recorded wash timeline before any bake is created', async () => {
    await expect(renderRotoRevealFrames(input({ script: script() }))).rejects
      .toThrow('Reveal needs a Water color script — this script has no recorded wash timeline.');
    expect(harness.bakeOptions).toHaveLength(0);
    expect(harness.adapterOptions).toHaveLength(0);
    expect(harness.encode).not.toHaveBeenCalled();
  });

  it('refuses a legacy engine id with an empty timeline the same way', async () => {
    await expect(renderRotoRevealFrames(input({ script: { ...script([]), engineId: 'efx-physic-paint' } }))).rejects
      .toThrow('Reveal needs a Water color script — this script has no recorded wash timeline.');
    expect(harness.bakeOptions).toHaveLength(0);
  });

  it('rejects with AbortError before dispatch when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(renderRotoRevealFrames(input({ signal: controller.signal }))).rejects.toMatchObject({ name: 'AbortError' });
    expect(harness.bakeOptions).toHaveLength(0);
  });

  const invalidInputs: Array<[string, Partial<Parameters<typeof renderRotoRevealFrames>[0]>]> = [
    ['frame count zero', { frameCount: 0 }],
    ['non-integer canonical start', { canonicalStart: 1.5 }],
    ['zero canvas size', { size: { width: 0, height: 10 } }],
    ['unsafe aggregate size', { frameCount: 2_000, size: { width: 4096, height: 4096 } }],
  ];
  it.each(invalidInputs)('keeps the render-input bounds check for %s', async (_label, extra) => {
    await expect(renderRotoRevealFrames(input(extra))).rejects.toBeInstanceOf(RangeError);
    expect(harness.bakeOptions).toHaveLength(0);
  });
});

describe('renderRotoRevealFrames happy path (52-01 Task 1)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  it('bakes the recorded wash timeline and stages one key per frame', async () => {
    const events = [strokeEvent(1), strokeEvent(2)];
    stagedBake(['wash-0', 'wash-1', 'wash-2']);
    const staged = await renderRotoRevealFrames(input({ script: script(events), frameCount: 3, canonicalStart: 15 }));

    expect(staged.map((frame) => frame.appFrame)).toEqual([15, 16, 17]);
    expect(staged.every((frame) => frame.source === 'real-key')).toBe(true);
    expect(staged.map((frame) => frame.frameIndex)).toEqual([0, 1, 2]);
    expect(harness.encode).toHaveBeenCalledTimes(3);
    // The ONE bake: the script's own timeline, no re-flattening.
    expect(harness.bakeEvents).toHaveLength(1);
    expect(harness.bakeEvents[0]).toBe(events);
  });

  it('draws the reference AS PLACED at full opacity, then applies the mask as destination-in (D-14/D-17/D-18)', async () => {
    await renderRotoRevealFrames(input({
      reference: { bytesByAppFrame: new Map([[4, testWebpBytes('ref')]]), transform: { x: 2, y: 3, scaleX: 1.5, scaleY: 0.5, rotation: 45 }, zoom: 1 },
    }));
    const maskId = maskCanvasIndices()[0]!;
    const ops = harness.canvases[maskId]!.ops;

    const referenceDrawIndex = ops.findIndex((op) => op.type === 'drawImage' && op.source === 'blob:ref');
    expect(referenceDrawIndex).toBeGreaterThan(-1);
    const draw = ops[referenceDrawIndex] as Extract<MaskOp, { type: 'drawImage' }>;
    expect(draw.globalAlpha).toBe(1); // D-18: full source opacity
    expect(draw.composite).toBe('source-over');

    const maskDrawIndex = ops.findIndex((op) => op.type === 'drawImage' && op.composite === 'destination-in');
    expect(maskDrawIndex).toBeGreaterThan(referenceDrawIndex);

    const translate = ops.find((op) => op.type === 'translate') as Extract<MaskOp, { type: 'translate' }>;
    expect(translate).toEqual({ type: 'translate', canvas: maskId, x: 7, y: 8 });
    const rotate = ops.find((op) => op.type === 'rotate') as Extract<MaskOp, { type: 'rotate' }>;
    expect(rotate.radians).toBeCloseTo((45 * Math.PI) / 180);
    const scale = ops.find((op) => op.type === 'scale') as Extract<MaskOp, { type: 'scale' }>;
    expect(scale).toEqual({ type: 'scale', canvas: maskId, x: 1.5, y: 0.5 });
  });

  it('scales the reference draw by zoom — the ghost math — so baked keys overlay the ghost (G-52-2a)', async () => {
    await renderRotoRevealFrames(input({
      reference: { bytesByAppFrame: new Map([[4, testWebpBytes('ref')]]), transform: { x: 2, y: 3, scaleX: 1, scaleY: 1, rotation: 0 }, zoom: 0.5 },
    }));
    const maskId = maskCanvasIndices()[0]!;
    const ops = harness.canvases[maskId]!.ops;
    const translate = ops.find((op) => op.type === 'translate') as Extract<MaskOp, { type: 'translate' }>;
    expect(translate).toEqual({ type: 'translate', canvas: maskId, x: 5 + 2 * 0.5, y: 5 + 3 * 0.5 });
    const referenceDraw = ops.find((op) => op.type === 'drawImage' && op.source === 'blob:ref') as Extract<MaskOp, { type: 'drawImage' }>;
    expect(referenceDraw.args).toEqual([-1, -0.75, 2, 1.5]);
  });

  it('masks with the CONVERTED pigment-alpha canvas, never the raw transmittance wash', async () => {
    await renderRotoRevealFrames(input());
    // The wash canvas is the one that received the decoded wash image AND a
    // pixel readback (transmittanceToAlpha).
    const washCanvas = harness.canvases.find((canvas) =>
      canvas.ops.some((op) => op.type === 'drawImage' && op.source.startsWith('blob:wash'))
      && canvas.ops.some((op) => op.type === 'getImageData'));
    expect(washCanvas).toBeDefined();
    // transmittanceToAlpha writes the converted pixels into a NEW canvas.
    expect(wroteConvertedPixels()).toBe(true);

    const maskId = maskCanvasIndices()[0]!;
    const maskDraw = harness.canvases[maskId]!.ops.find(
      (op): op is Extract<MaskOp, { type: 'drawImage' }> => op.type === 'drawImage' && op.composite === 'destination-in',
    )!;
    // If the mask drew the wash canvas directly the whole photo would be
    // revealed (opaque transmittance = alpha 1 everywhere).
    expect(maskDraw.sourceCanvas).not.toBe((washCanvas as unknown as RecordingCanvas).__recordingCanvasId);
    expect(maskDraw.args).toEqual([0, 0, 10, 10]);
  });

  it('fails loudly when the wash pixels cannot be converted to pigment alpha', async () => {
    harness.failReadback = true;
    await expect(renderRotoRevealFrames(input())).rejects.toThrow('Could not convert the aquarelle wash to pigment alpha.');
  });

  it('is deterministic: the same script + reference + motion produce identical staged output', async () => {
    stagedBake(['wash-a', 'wash-b']);
    const first = await renderRotoRevealFrames(input({ frameCount: 2, script: script([strokeEvent()]) }));
    harness.canvases.length = 0;
    const second = await renderRotoRevealFrames(input({ frameCount: 2, script: script([strokeEvent()]) }));
    expect(second.map((frame) => frame.bytes)).toEqual(first.map((frame) => frame.bytes));
    expect(second.map((frame) => frame.appFrame)).toEqual(first.map((frame) => frame.appFrame));
  });
});

describe('renderRotoRevealFrames bake window and paper (52-01 Task 2)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  it('progressive bakes exactly frameCount frames', async () => {
    stagedBake(['w0', 'w1', 'w2', 'w3']);
    await renderRotoRevealFrames(input({ mode: 'progressive', frameCount: 4 }));
    expect(harness.bakeOptions[0]!.frameCount).toBe(4);
    expect(harness.encode).toHaveBeenCalledTimes(4);
  });

  it('static bakes ONE settled wash and holds it across the span', async () => {
    stagedBake(['settled']);
    const staged = await renderRotoRevealFrames(input({ mode: 'static', frameCount: 3, canonicalStart: 15 }));
    expect(harness.bakeOptions[0]!.frameCount).toBe(1);
    expect(staged.map((frame) => frame.appFrame)).toEqual([15, 16, 17]);
    // One wash decode, three masks: the held wash is reused, never re-baked.
    expect(harness.bakeEvents).toHaveLength(1);
    expect(harness.encode).toHaveBeenCalledTimes(3);
    expect(maskCanvasIndices()).toHaveLength(3);
  });

  it('forwards the Studio paper to both the adapter and the bake', async () => {
    const aquarellePaper = { paperId: 'paper-x', grainStrength: 0.4, grainScale: 1.5 };
    await renderRotoRevealFrames(input({ aquarellePaper }));
    expect(harness.paperPreset).toHaveBeenCalledWith('paper-x');
    expect(harness.adapterOptions[0]).toMatchObject({ width: 10, height: 10, paperPreset: 'preset:paper-x', paperStrength: 0.4 });
    expect(harness.bakeOptions[0]!.paper).toEqual(aquarellePaper);
  });

  it('omits the paper from the bake when no Studio paper is supplied', async () => {
    await renderRotoRevealFrames(input());
    expect(harness.paperPreset).not.toHaveBeenCalled();
    expect(harness.adapterOptions[0]!.paperPreset).toBeUndefined();
    expect(harness.bakeOptions[0]!.paper).toBeUndefined();
  });

  it('poses the flattened coverage per OUTPUT frame when motion is set', async () => {
    stagedBake(['w0', 'w1']);
    await renderRotoRevealFrames(input({ frameCount: 2, canonicalStart: 15, motion: { deformation: 60, position: 40 } }));
    // Per output frame: wash canvas + pigment-alpha canvas + posed sheet
    // canvas + mask canvas.
    expect(harness.canvases).toHaveLength(8);
    expect(maskCanvasIndices()).toHaveLength(2);

    // Zero motion keeps the identity path (no posed sheet canvas) and the mask
    // still runs once per frame.
    harness.canvases.length = 0;
    await renderRotoRevealFrames(input({ frameCount: 2, canonicalStart: 15 }));
    expect(harness.canvases).toHaveLength(6);
    expect(maskCanvasIndices()).toHaveLength(2);
  });
});

describe('renderRotoRevealFrames photo wiggle (261030-ey9)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  /** Canvases that drew a MASK canvas as their source — the posed composite. */
  function posedCompositeIndices(): number[] {
    const maskIds = maskCanvasIndices();
    return harness.canvases
      .map((canvas, index) => ({ canvas, index }))
      .filter(({ canvas, index }) => !maskIds.includes(index)
        && canvas.ops.some((op) => op.type === 'drawImage' && op.sourceCanvas !== null && maskIds.includes(op.sourceCanvas)))
      .map(({ index }) => index);
  }

  const motion = { deformation: 60, position: 40 };
  const transform = { x: 3, y: -2, scaleX: 1, scaleY: 1, rotation: 0 };
  const zoom = 0.5;

  it('off parity: the coverage pose path is byte-identical to today', async () => {
    stagedBake(['w0', 'w1']);
    await renderRotoRevealFrames(input({ frameCount: 2, canonicalStart: 15, motion, photoWiggle: false }));
    // Per output frame: wash canvas + pigment-alpha canvas + posed sheet
    // canvas + mask canvas — exactly the pre-261030-ey9 count.
    expect(harness.canvases).toHaveLength(8);
    expect(maskCanvasIndices()).toHaveLength(2);
    expect(posedCompositeIndices()).toHaveLength(0);
  });

  it('on: masks the UNPOSED coverage, then poses the composite ONCE per frame around the placed photo centre', async () => {
    stagedBake(['w0', 'w1']);
    const bytesByAppFrame = new Map([
      [15, testWebpBytes('ref-15')],
      [16, testWebpBytes('ref-16')],
    ]);
    await renderRotoRevealFrames(input({
      frameCount: 2,
      canonicalStart: 15,
      motion,
      photoWiggle: true,
      reference: { bytesByAppFrame, transform, zoom },
    }));

    // Per output frame: wash + pigment-alpha + mask + posed composite. Still
    // FOUR canvases per frame — the composite pose replaces the coverage pose,
    // never adds to it.
    expect(harness.canvases).toHaveLength(8);
    // The mask draws the RAW coverage (a converted-pixel canvas with no rotate
    // op) — the coverage itself is never posed when the composite is.
    for (const maskId of maskCanvasIndices()) {
      const destinationIn = harness.canvases[maskId]!.ops.find(
        (op) => op.type === 'drawImage' && op.composite === 'destination-in',
      );
      expect(destinationIn).toBeDefined();
      const coverageCanvas = (destinationIn as Extract<MaskOp, { type: 'drawImage' }>).sourceCanvas;
      expect(coverageCanvas).not.toBeNull();
      expect(harness.canvases[coverageCanvas!]!.ops.some((op) => op.type === 'rotate')).toBe(false);
    }
    const posed = posedCompositeIndices();
    expect(posed).toHaveLength(2);
    for (const [frameIndex, index] of posed.entries()) {
      const destination = 15 + frameIndex;
      const pose = computeAquarelleSheetPose(10, 10, destination, motion);
      expect(pose).not.toBeNull();
      const photoCentreX = 10 / 2 + transform.x * zoom;
      const photoCentreY = 10 / 2 + transform.y * zoom;
      const translate = harness.canvases[index]!.ops.find((op) => op.type === 'translate');
      // The recorded operand is the PIVOT-RELATIVE target — not the raw photo
      // centre (they differ whenever the pose offset is nonzero).
      expect(translate).toEqual({
        type: 'translate',
        canvas: index,
        x: photoCentreX + pose!.centerX - 10 / 2,
        y: photoCentreY + pose!.centerY - 10 / 2,
      });
    }
  });

  it('on with all-zero motion: the composite is returned unposed and the counts match the off path', async () => {
    stagedBake(['w0', 'w1']);
    await renderRotoRevealFrames(input({
      frameCount: 2,
      canonicalStart: 15,
      photoWiggle: true,
      reference: { bytesByAppFrame: new Map([[15, testWebpBytes('ref-15')], [16, testWebpBytes('ref-16')]]), transform, zoom },
    }));
    expect(harness.canvases).toHaveLength(6);
    expect(posedCompositeIndices()).toHaveLength(0);
  });

  it('on in static mode: every span frame carries its own composite pose (the loop is never short-circuited)', async () => {
    stagedBake(['settled']);
    await renderRotoRevealFrames(input({ mode: 'static', frameCount: 3, canonicalStart: 15, motion, photoWiggle: true }));
    expect(harness.bakeOptions[0]!.frameCount).toBe(1);
    expect(harness.encode).toHaveBeenCalledTimes(3);
    // One wash decode + one alpha conversion, then mask + posed composite per
    // output frame.
    expect(harness.canvases).toHaveLength(2 + 3 * 2);
    expect(posedCompositeIndices()).toHaveLength(3);
  });
});

describe('renderRotoRevealFrames frame-aligned reference (WR-02, 260920-kov)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  function referenceDrawLabels(): string[] {
    return referenceDraws().map((op) => op.source);
  }

  it('WR-02: draws image N on application frame N across the span (D-15)', async () => {
    stagedBake(['w0', 'w1', 'w2']);
    const bytesByAppFrame = new Map([
      [15, testWebpBytes('ref-0')],
      [16, testWebpBytes('ref-1')],
      [17, testWebpBytes('ref-2')],
    ]);
    await renderRotoRevealFrames(input({
      frameCount: 3,
      canonicalStart: 15,
      reference: { bytesByAppFrame, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, zoom: 1 },
    }));

    expect(referenceDrawLabels()).toEqual(['blob:ref-0', 'blob:ref-1', 'blob:ref-2']);
    expect(harness.encode).toHaveBeenCalledTimes(3);
  });

  it('WR-02: a frame with no reference entry fails closed instead of drawing a stale image', async () => {
    stagedBake(['w0', 'w1', 'w2']);
    const bytesByAppFrame = new Map([
      [15, testWebpBytes('ref-0')],
      // frame 16 deliberately absent — the store pre-validates, so reaching
      // here means a caller bug and must never silently reuse frame 15's image.
      [17, testWebpBytes('ref-2')],
    ]);
    await expect(renderRotoRevealFrames(input({
      frameCount: 3,
      canonicalStart: 15,
      reference: { bytesByAppFrame, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, zoom: 1 },
    }))).rejects.toThrow('reference image for frame 16');
    expect(referenceDrawLabels()).toEqual(['blob:ref-0']);
    expect(harness.encode).toHaveBeenCalledTimes(1);
  });

  it('WR-02: each DISTINCT payload decodes once — clamped repeats reuse the decoded image (no decode storm)', async () => {
    // ONE wash payload instance across the three frames (a settled wash) and
    // ONE reference payload resolving the whole span: exactly what the store
    // hands for a clamped repeat.
    const sharedWash = testWebpBytes('shared-wash');
    harness.bakeResult = { ok: true, frames: [sharedWash, sharedWash, sharedWash].map((bytes, index) => ({ eventIndex: index, strokeIndex: index, tick: 0, bytes, width: 10, height: 10 })) };
    const sharedReference = testWebpBytes('ref-b');
    await renderRotoRevealFrames(input({
      frameCount: 3,
      canonicalStart: 15,
      reference: { bytesByAppFrame: new Map([[15, sharedReference], [16, sharedReference], [17, sharedReference]]), transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, zoom: 1 },
    }));

    expect(referenceDrawLabels()).toEqual(['blob:ref-b', 'blob:ref-b', 'blob:ref-b']);
    // TWO distinct payloads (one wash, one reference) → two decodes for three
    // frames, never one per frame (the project's decode-storm lesson).
    expect(harness.objectUrlCalls).toHaveLength(2);
  });

  it('WR-02: a multi-image span decodes each distinct payload exactly once', async () => {
    stagedBake(['w0', 'w1', 'w2']);
    await renderRotoRevealFrames(input({
      frameCount: 3,
      canonicalStart: 15,
      reference: {
        bytesByAppFrame: new Map([[15, testWebpBytes('ref-0')], [16, testWebpBytes('ref-1')], [17, testWebpBytes('ref-2')]]),
        transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
        zoom: 1,
      },
    }));
    // three wash payloads + three reference payloads
    expect(harness.objectUrlCalls).toHaveLength(6);
  });
});

describe('renderRotoRevealFrames colorize (261029-vbp)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  type DrawOp = Extract<MaskOp, { type: 'drawImage' }>;

  function allOps(): MaskOp[] {
    return harness.canvases.flatMap((canvas) => canvas.ops);
  }

  function opsWithComposite(composite: string): DrawOp[] {
    return allOps().filter((op): op is DrawOp => op.type === 'drawImage' && op.composite === composite);
  }

  function maskDrawOps(): DrawOp[] {
    const maskId = maskCanvasIndices()[0]!;
    return harness.canvases[maskId]!.ops.filter((op): op is DrawOp => op.type === 'drawImage');
  }

  /** The single 'source-atop' transfer identifies the scratch tint canvas. */
  function tintTransfer(): DrawOp {
    const transfers = opsWithComposite('source-atop');
    expect(transfers).toHaveLength(1);
    return transfers[0]!;
  }

  function scratchCanvas(): { ops: MaskOp[] } {
    const index = tintTransfer().sourceCanvas;
    expect(index).not.toBeNull();
    return harness.canvases[index!]!;
  }

  function scratchColorDraw(): DrawOp {
    const colors = scratchCanvas().ops.filter(
      (op): op is DrawOp => op.type === 'drawImage' && op.composite === 'color',
    );
    expect(colors).toHaveLength(1);
    return colors[0]!;
  }

  it('off, explicit false, and mix 0 record exactly today op ledger and add no scratch canvas', async () => {
    for (const extra of [{}, { colorize: false }, { colorize: true, colorizeMix: 0 }]) {
      harness.canvases.length = 0;
      await renderRotoRevealFrames(input(extra));
      expect(opsWithComposite('color')).toHaveLength(0);
      expect(opsWithComposite('source-atop')).toHaveLength(0);
      // wash canvas + pigment-alpha canvas + mask canvas — the pre-quick set.
      expect(harness.canvases).toHaveLength(3);
      expect(maskCanvasIndices()).toHaveLength(1);
    }
  });

  it('tints on a SCRATCH canvas and transfers it with source-atop before the last destination-in mask', async () => {
    await renderRotoRevealFrames(input({ colorize: true }));
    expect(harness.canvases).toHaveLength(4);
    const maskId = maskCanvasIndices()[0]!;
    const transfer = tintTransfer();
    expect(transfer.canvas).toBe(maskId);
    expect(transfer.globalAlpha).toBe(1);
    expect(transfer.args).toEqual([0, 0, 10, 10]);

    const maskDraws = maskDrawOps();
    const referenceIndex = maskDraws.findIndex((op) => op.source === 'blob:ref');
    const transferIndex = maskDraws.findIndex((op) => op.composite === 'source-atop');
    const maskIndex = maskDraws.findIndex((op) => op.composite === 'destination-in');
    expect(transferIndex).toBeGreaterThan(referenceIndex);
    expect(maskIndex).toBeGreaterThan(transferIndex);
    // The mask is the LAST recorded op on the output canvas, at full alpha.
    expect(maskIndex).toBe(maskDraws.length - 1);
    expect(maskDraws[maskIndex]!.globalAlpha).toBe(1);
    // The mask canvas itself never receives the 'color' tint.
    expect(maskDraws.some((op) => op.composite === 'color')).toBe(false);
  });

  it('the scratch mirrors the placed-reference footprint and tints the SAME posed coverage raster', async () => {
    await renderRotoRevealFrames(input({
      colorize: true,
      reference: { bytesByAppFrame: new Map([[4, testWebpBytes('ref')]]), transform: { x: 2, y: 3, scaleX: 1.5, scaleY: 0.5, rotation: 45 }, zoom: 1 },
    }));
    const maskId = maskCanvasIndices()[0]!;
    const maskOpsList = harness.canvases[maskId]!.ops;
    const scratchOps = scratchCanvas().ops;

    // A scratch canvas NEVER receives the mask draw, so the existing
    // maskOps/maskCanvasIndices helpers keep resolving to the output only.
    expect(scratchOps.some((op) => op.type === 'drawImage' && op.composite === 'destination-in')).toBe(false);

    // The scratch's placed-reference draw is identical to the output's — same
    // transforms and the same draw args, source-over at full alpha.
    const maskReference = maskOpsList.find((op): op is DrawOp => op.type === 'drawImage' && op.source === 'blob:ref')!;
    const scratchReference = scratchOps.find((op): op is DrawOp => op.type === 'drawImage' && op.source === 'blob:ref')!;
    expect(scratchReference.args).toEqual(maskReference.args);
    expect(scratchReference.globalAlpha).toBe(1);
    expect(scratchReference.composite).toBe('source-over');
    const maskTranslate = maskOpsList.find((op) => op.type === 'translate') as Extract<MaskOp, { type: 'translate' }>;
    const scratchTranslate = scratchOps.find((op) => op.type === 'translate') as Extract<MaskOp, { type: 'translate' }>;
    expect({ x: scratchTranslate.x, y: scratchTranslate.y }).toEqual({ x: maskTranslate.x, y: maskTranslate.y });
    const maskRotate = maskOpsList.find((op) => op.type === 'rotate') as Extract<MaskOp, { type: 'rotate' }>;
    const scratchRotate = scratchOps.find((op) => op.type === 'rotate') as Extract<MaskOp, { type: 'rotate' }>;
    expect(scratchRotate.radians).toBeCloseTo(maskRotate.radians);
    const maskScale = maskOpsList.find((op) => op.type === 'scale') as Extract<MaskOp, { type: 'scale' }>;
    const scratchScale = scratchOps.find((op) => op.type === 'scale') as Extract<MaskOp, { type: 'scale' }>;
    expect({ x: scratchScale.x, y: scratchScale.y }).toEqual({ x: maskScale.x, y: maskScale.y });

    // The tint draws the SAME posed coverage closure the mask uses.
    const maskDraw = maskOpsList.find((op): op is DrawOp => op.type === 'drawImage' && op.composite === 'destination-in')!;
    const colorDraw = scratchColorDraw();
    expect(colorDraw.sourceCanvas).toBe(maskDraw.sourceCanvas);
    expect(colorDraw.args).toEqual([0, 0, 10, 10]);
    expect(colorDraw.globalAlpha).toBe(1);
  });

  it('mix 40 tints at 0.4 on the scratch; mix 150 clamps to full strength', async () => {
    await renderRotoRevealFrames(input({ colorize: true, colorizeMix: 40 }));
    expect(scratchColorDraw().globalAlpha).toBe(0.4);
    expect(tintTransfer().globalAlpha).toBe(1);

    harness.canvases.length = 0;
    await renderRotoRevealFrames(input({ colorize: true, colorizeMix: 150 }));
    expect(scratchColorDraw().globalAlpha).toBe(1);
  });

  it('mix -5 records no tint at all; a non-finite mix defaults to full strength', async () => {
    await renderRotoRevealFrames(input({ colorize: true, colorizeMix: -5 }));
    expect(opsWithComposite('color')).toHaveLength(0);
    expect(opsWithComposite('source-atop')).toHaveLength(0);
    expect(harness.canvases).toHaveLength(3);

    harness.canvases.length = 0;
    await renderRotoRevealFrames(input({ colorize: true, colorizeMix: Number.NaN }));
    expect(scratchColorDraw().globalAlpha).toBe(1);
  });
});

describe('renderRotoRevealFrames abort and failure disposal (52-01 D-11)', () => {
  beforeEach(() => {
    setupDom();
    setupHarness();
  });

  it('rejects with AbortError when aborted mid-loop after the first frame — the staged prefix is discarded', async () => {
    stagedBake(['w0', 'w1', 'w2']);
    const controller = new AbortController();
    let encodeCalls = 0;
    harness.encode.mockImplementation(async (_canvas: HTMLCanvasElement, destination: number) => {
      encodeCalls += 1;
      if (encodeCalls === 2) controller.abort();
      return { frameIndex: 0, appFrame: destination, bytes: testWebpBytes(`encoded-${destination}`), width: 10, height: 10 };
    });
    await expect(renderRotoRevealFrames(input({ frameCount: 3, signal: controller.signal }))).rejects.toMatchObject({ name: 'AbortError' });
    expect(encodeCalls).toBe(2);
    expect(harness.bakeDispose).toHaveBeenCalledTimes(1);
    expect(harness.adapterDispose).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed bake and still disposes the bake and adapter', async () => {
    harness.bakeResult = { ok: false, reason: 'failed' };
    await expect(renderRotoRevealFrames(input())).rejects.toThrow('Aquarelle reveal bake failed.');
    expect(harness.bakeDispose).toHaveBeenCalledTimes(1);
    expect(harness.adapterDispose).toHaveBeenCalledTimes(1);
  });

  it('surfaces a cancelled bake with the cancellation wording', async () => {
    harness.bakeResult = { ok: false, reason: 'cancelled' };
    await expect(renderRotoRevealFrames(input())).rejects.toThrow('Aquarelle reveal bake cancelled.');
  });

  it('rejects a bake that produced no frames instead of staging an empty span', async () => {
    harness.bakeResult = { ok: true, frames: [] };
    await expect(renderRotoRevealFrames(input({ frameCount: 2 }))).rejects.toThrow('Aquarelle reveal bake produced no frames.');
  });
});
