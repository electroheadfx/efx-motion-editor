import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';

/**
 * G-52-10 registry ownership lifecycle pins — watercolor-only reveal bake
 * (261027-klx).
 *
 * These tests drive `renderRotoRevealFrames` through the REAL
 * `encodeRotoFrameFromCanvas` into the REAL alpha-canvas registry (only the
 * wash bake, the image decode and the WebP encoder are scripted). The bug was
 * a register-then-release in the render loop's `finally`: the registry ended up
 * mapping each baked dataUrl to a 0×0 canvas, and the compositor's FIX 3
 * branch then threw InvalidStateError at drawImage (the stuck-dialog bug).
 * The pin: after the render completes, every baked dataUrl's registry canvas
 * is alive at full size — a register-then-release fails this at any guard
 * state.
 */

const harness = vi.hoisted(() => ({
  bakeResult: null as unknown,
  adapterDispose: vi.fn(),
  bakeDispose: vi.fn(),
  encodeCount: 0,
}));

vi.mock('@efxlab/efx-watercolor', () => ({
  createAquarelleEngineAdapter: () => ({ dispose: harness.adapterDispose }),
}));
vi.mock('@efxlab/efx-watercolor/bake', () => ({
  createAquarelleBake: () => ({
    bake: async () => harness.bakeResult,
    flush: async () => {},
    beginFlush: () => () => {},
    dispose: harness.bakeDispose,
    interrupt: () => {},
    inFlight: 0,
  }),
}));
vi.mock('../engine/AquarelleCanvasLayer', () => ({
  paperPresetForStudioId: (paperId: string) => paperId,
}));
vi.mock('../../../lib/webpFrameCodec', () => ({
  // Distinct bytes per bake: each frame must own its registry entry.
  encodeWebpFrame: vi.fn(async () => {
    harness.encodeCount += 1;
    const bytes = new Uint8Array(40);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
    bytes.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
    bytes.set([0x56, 0x50, 0x38, 0x4c], 12); // VP8L
    bytes[32] = harness.encodeCount & 0xff;
    return bytes;
  }),
  decodeWebpFrame: vi.fn(),
}));

// The REAL modules under test: the encode registers into the REAL store registry.
import { hasRotoAlphaCanvasFrame } from '../../../stores/physicPaintStore';
import { renderRotoRevealFrames } from './physicsPaintRotoPlayScriptRenderer';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

class OwnedContext {
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  constructor(private readonly canvas: OwnedCanvas) {}
  clearRect(): void {}
  save(): void {}
  restore(): void {}
  translate(): void {}
  rotate(): void {}
  scale(): void {}
  drawImage(): void {}
  getImageData(): { data: Uint8ClampedArray } {
    return { data: new Uint8ClampedArray(this.canvas.width * this.canvas.height * 4) };
  }
  putImageData(): void {}
}

class OwnedCanvas {
  width = 0;
  height = 0;
  private context: OwnedContext | null = null;
  getContext(kind: string): OwnedContext | null {
    if (kind !== '2d') return null;
    this.context ??= new OwnedContext(this);
    return this.context;
  }
}

class StubImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width = 4;
  height = 3;
  private currentSrc = '';
  set src(value: string) {
    this.currentSrc = value;
    queueMicrotask(() => this.onload?.());
  }
  get src(): string { return this.currentSrc; }
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

function script(): RotoPaintScript {
  return {
    provenance: { sessionId: 'session', layerId: 'layer', sourceFrame: 0 },
    sourceFrame: 0,
    sourceDisplayFrame: 0,
    sourceRevision: 1,
    brushes: [],
    engineId: 'efx-watercolor',
    aquarelleEvents: [strokeEvent()],
  };
}

function washFrame(seed: string) {
  return { eventIndex: 0, strokeIndex: 0, tick: 0, bytes: testWebpBytes(seed), width: 10, height: 10 };
}

function revealInput(extra: Partial<Parameters<typeof renderRotoRevealFrames>[0]> = {}): Parameters<typeof renderRotoRevealFrames>[0] {
  const canonicalStart = extra.canonicalStart ?? 15;
  const frameCount = extra.frameCount ?? 3;
  return {
    script: script(),
    frameCount: 3,
    canonicalStart: 15,
    motion: { deformation: 0, position: 0 },
    mode: 'progressive',
    size: { width: 10, height: 10 },
    reference: {
      bytesByAppFrame: new Map(Array.from({ length: frameCount }, (_, index) => [canonicalStart + index, testWebpBytes('ref')] as const)),
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
      zoom: 1,
    },
    signal: new AbortController().signal,
    ...extra,
  };
}

describe('G-52-10 registry ownership (real encode → real registry, reveal bake)', () => {
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: (tag: string) => (tag === 'canvas' ? new OwnedCanvas() : { replaceChildren: vi.fn() }),
    });
    vi.stubGlobal('Image', StubImage);
    vi.stubGlobal('HTMLImageElement', StubImage);
    vi.stubGlobal('Blob', class { constructor(public readonly parts: unknown[]) {} });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:payload'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { queueMicrotask(() => callback(0)); return 1; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    harness.encodeCount = 0;
    harness.adapterDispose.mockReset();
    harness.bakeDispose.mockReset();
    harness.bakeResult = {
      ok: true,
      frames: [washFrame('w0'), washFrame('w1'), washFrame('w2')],
    };
  });

  it('reveal bake: every baked dataUrl keeps a live full-size registry canvas', async () => {
    const staged = await renderRotoRevealFrames(revealInput());

    expect(staged.map((frame) => frame.appFrame)).toEqual([15, 16, 17]);
    for (const frame of staged) {
      // A register-then-release in the render loop zeroed this canvas AFTER
      // registration — the exact G-52-10 poison the compositor later drew from.
      expect(hasRotoAlphaCanvasFrame(frame.bytes, { width: 10, height: 10 })).toBe(true);
    }
    expect(harness.bakeDispose).toHaveBeenCalledTimes(1);
    expect(harness.adapterDispose).toHaveBeenCalledTimes(1);
  });

  it('static span: ONE held wash still registers a live canvas per OUTPUT frame', async () => {
    harness.bakeResult = { ok: true, frames: [washFrame('settled')] };
    const staged = await renderRotoRevealFrames(revealInput({ mode: 'static', frameCount: 3, canonicalStart: 15 }));

    expect(staged.map((frame) => frame.appFrame)).toEqual([15, 16, 17]);
    const tokens = new Set(staged.map((frame) => frame.bytes));
    expect(tokens.size).toBe(3);
    for (const frame of staged) {
      expect(hasRotoAlphaCanvasFrame(frame.bytes, { width: 10, height: 10 })).toBe(true);
    }
  });
});
