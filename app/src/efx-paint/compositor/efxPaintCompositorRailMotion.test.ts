/**
 * Rail motion at the compositor (Phase 59-08 — MOTN-07/MOTN-08).
 *
 * One affine transform per animated track, applied at BOTH existing draw sites
 * (the normal store-raster draw and the Studio engine-overlay draw at the
 * track's real stack position), between save() and drawImage(), in the order
 * translate -> rotate -> scale -> translate. The identity path records zero
 * transform ops and the identical drawImage argument list (the pre-Phase-59
 * baseline).
 *
 * The recording-context fixture mirrors `efxPaintCompositor.test.ts` — vitest
 * runs in a node environment with no real Canvas 2D, so the transform is
 * verified by recording the exact op sequence.
 */

import { describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../document/efxPaintDocument';
import type { BlendMode, EfxPaintDocument, InternalPaintTrack } from '../document/efxPaintDocument';
import { createKeyedMemo } from './efxPaintCompositeCache';
import {
  compositeFrame,
  isEfxPaintTrackMotionIdentity,
} from './efxPaintCompositor';
import type {
  EfxPaintCompositorPorts,
  EfxPaintCompositeSize,
  EfxPaintTrackContentResolution,
  EfxPaintTrackMotionTransform,
} from './efxPaintCompositor';

const BLEND_OPS: Record<string, GlobalCompositeOperation> = {
  normal: 'source-over',
  screen: 'screen',
  multiply: 'multiply',
  overlay: 'overlay',
  add: 'lighter',
};

const SIZE: EfxPaintCompositeSize = { width: 200, height: 100 };

type RecordedOp =
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'translate'; x: number; y: number }
  | { type: 'rotate'; angle: number }
  | { type: 'scale'; x: number; y: number }
  | {
      type: 'drawImage';
      source: string;
      args: readonly number[];
      globalAlpha: number;
      globalCompositeOperation: GlobalCompositeOperation;
    }
  | { type: 'fillRect'; x: number; y: number; w: number; h: number }
  | { type: 'clearRect'; w: number; h: number };

class TestRaster {
  constructor(public readonly id: string) {}
}

function raster(id: string): CanvasImageSource {
  return new TestRaster(id) as unknown as CanvasImageSource;
}

class RecordingCanvasContext {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  private readonly stack: Array<Pick<
    RecordingCanvasContext,
    'fillStyle' | 'globalAlpha' | 'globalCompositeOperation'
  >> = [];

  constructor(private readonly operations: RecordedOp[]) {}

  save(): void {
    this.operations.push({ type: 'save' });
    this.stack.push({
      fillStyle: this.fillStyle,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }

  restore(): void {
    this.operations.push({ type: 'restore' });
    const state = this.stack.pop();
    if (!state) return;
    this.fillStyle = state.fillStyle;
    this.globalAlpha = state.globalAlpha;
    this.globalCompositeOperation = state.globalCompositeOperation;
  }

  clearRect(_x: number, _y: number, w: number, h: number): void {
    this.operations.push({ type: 'clearRect', w, h });
  }

  fillRect(x: number, y: number, w: number, h: number): void {
    this.operations.push({ type: 'fillRect', x, y, w, h });
  }

  drawImage(source: CanvasImageSource, ...args: number[]): void {
    this.operations.push({
      type: 'drawImage',
      source: source instanceof TestRaster ? source.id : 'unknown',
      args,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
    });
  }

  translate(x: number, y: number): void {
    this.operations.push({ type: 'translate', x, y });
  }

  rotate(angle: number): void {
    this.operations.push({ type: 'rotate', angle });
  }

  scale(x: number, y: number): void {
    this.operations.push({ type: 'scale', x, y });
  }
}

function makeTrack(id: string, overrides: Partial<InternalPaintTrack> = {}): InternalPaintTrack {
  return {
    id,
    name: `Track ${id}`,
    order: 0,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal',
    revision: 0,
    frames: Object.freeze({}),
    rotoPhysical: null,
    loopClips: Object.freeze([]),
    ...overrides,
  };
}

function makeDocument(tracks: readonly InternalPaintTrack[]): EfxPaintDocument {
  const base = createEfxPaintDocument('layer-1');
  return {
    ...base,
    activeTrackId: tracks[0]?.id ?? base.activeTrackId,
    tracks,
  };
}

function makeHarness(options: {
  content?: Record<string, EfxPaintTrackContentResolution>;
  trackTransforms?: ReadonlyMap<string, EfxPaintTrackMotionTransform>;
  trackRasterMemo?: ReturnType<typeof createKeyedMemo<string, EfxPaintTrackContentResolution>>;
  trackContentRevisions?: ReadonlyMap<string, string>;
  excludeTrackIds?: ReadonlySet<string>;
  engineOverlay?: { readonly trackId: string; readonly raster: CanvasImageSource } | null;
} = {}): { ops: RecordedOp[]; ports: EfxPaintCompositorPorts; resolveTrackContent: ReturnType<typeof vi.fn> } {
  const ops: RecordedOp[] = [];
  const content = options.content ?? {};
  const resolveTrackContent = vi.fn(
    (trackId: string): EfxPaintTrackContentResolution =>
      content[trackId] ?? { kind: 'content', raster: raster(trackId) },
  );
  const ports = {
    createCanvas: () => ({
      canvas: raster('canvas'),
      ctx: new RecordingCanvasContext(ops) as unknown as CanvasRenderingContext2D,
    }),
    resolveTrackContent,
    resolveBackgroundFrame: () => ({ kind: 'gap' as const }),
    resolveBackgroundSourceImage: (sourceRef: string) => raster(sourceRef),
    compositeOp: (mode: BlendMode) => BLEND_OPS[mode] ?? 'source-over',
    trackTransforms: options.trackTransforms,
    trackRasterMemo: options.trackRasterMemo,
    trackContentRevisions: options.trackContentRevisions,
    excludeTrackIds: options.excludeTrackIds,
    engineOverlay: options.engineOverlay,
  };
  return { ops, ports: ports as unknown as EfxPaintCompositorPorts, resolveTrackContent };
}

const IDENTITY_MOTION: EfxPaintTrackMotionTransform = {
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotationRadians: 0,
  opacity: 1,
  pivotX: 0.5,
  pivotY: 0.5,
};

const ANIMATED_MOTION: EfxPaintTrackMotionTransform = {
  translateX: 10,
  translateY: -4,
  scale: 2,
  rotationRadians: Math.PI / 3,
  opacity: 0.5,
  pivotX: 0.25,
  pivotY: 0.5,
};

function transformOps(ops: readonly RecordedOp[]): RecordedOp[] {
  return ops.filter(
    (op) => op.type === 'translate' || op.type === 'rotate' || op.type === 'scale',
  );
}

function drawImages(ops: readonly RecordedOp[]) {
  return ops.filter((op) => op.type === 'drawImage');
}

describe('compositeFrame — rail motion transform (MOTN-07/MOTN-08)', () => {
  it('applies translate, rotate, scale, translate around the normalized pivot at the normal draw site', () => {
    const document = makeDocument([makeTrack('track-a', { revision: 1 })]);
    const transforms = new Map<string, EfxPaintTrackMotionTransform>([
      ['track-a', ANIMATED_MOTION],
    ]);
    const harness = makeHarness({ trackTransforms: transforms });

    compositeFrame(document, 0, SIZE, harness.ports);

    expect(transformOps(harness.ops)).toEqual([
      { type: 'translate', x: 0.25 * 200 + 10, y: 0.5 * 100 - 4 },
      { type: 'rotate', angle: Math.PI / 3 },
      { type: 'scale', x: 2, y: 2 },
      { type: 'translate', x: -0.25 * 200, y: -0.5 * 100 },
    ]);

    const [draw] = drawImages(harness.ops);
    expect(draw).toMatchObject({
      source: 'track-a',
      args: [0, 0, 200, 100],
      globalAlpha: 1 * 0.5,
    });
  });

  it('applies the same op sequence at the engine-overlay draw site', () => {
    const document = makeDocument([makeTrack('track-a', { revision: 1 })]);
    const transforms = new Map<string, EfxPaintTrackMotionTransform>([
      ['track-a', ANIMATED_MOTION],
    ]);
    const harness = makeHarness({
      trackTransforms: transforms,
      excludeTrackIds: new Set(['track-a']),
      engineOverlay: { trackId: 'track-a', raster: raster('engine-raster') },
    });

    compositeFrame(document, 0, SIZE, harness.ports);

    expect(transformOps(harness.ops)).toEqual([
      { type: 'translate', x: 0.25 * 200 + 10, y: 0.5 * 100 - 4 },
      { type: 'rotate', angle: Math.PI / 3 },
      { type: 'scale', x: 2, y: 2 },
      { type: 'translate', x: -0.25 * 200, y: -0.5 * 100 },
    ]);
    expect(drawImages(harness.ops)).toEqual([
      expect.objectContaining({
        source: 'engine-raster',
        args: [0, 0, 200, 100],
        globalAlpha: 0.5,
      }),
    ]);
  });

  it('multiplies track opacity by motion opacity (D-19) and keeps track opacity when unmoved', () => {
    const transformed = makeHarness({
      trackTransforms: new Map<string, EfxPaintTrackMotionTransform>([['track-a', ANIMATED_MOTION]]),
    });
    compositeFrame(
      makeDocument([makeTrack('track-a', { opacity: 0.4, revision: 1 })]),
      0,
      SIZE,
      transformed.ports,
    );
    expect(drawImages(transformed.ops)[0].globalAlpha).toBeCloseTo(0.2);

    const plain = makeHarness();
    compositeFrame(
      makeDocument([makeTrack('track-a', { opacity: 0.4, revision: 1 })]),
      0,
      SIZE,
      plain.ports,
    );
    expect(drawImages(plain.ops)[0].globalAlpha).toBe(0.4);
  });

  it('records zero transform ops and an identical drawImage for an identity transform', () => {
    const baseline = makeHarness();
    compositeFrame(
      makeDocument([makeTrack('track-a', { opacity: 0.7, revision: 1 })]),
      0,
      SIZE,
      baseline.ports,
    );

    const identity = makeHarness({
      trackTransforms: new Map<string, EfxPaintTrackMotionTransform>([['track-a', IDENTITY_MOTION]]),
    });
    compositeFrame(
      makeDocument([makeTrack('track-a', { opacity: 0.7, revision: 1 })]),
      0,
      SIZE,
      identity.ports,
    );

    expect(transformOps(identity.ops)).toEqual([]);
    expect(identity.ops).toEqual(baseline.ops);
  });

  it('leaves an un-animated sibling track on the byte-identical baseline path', () => {
    const baseline = makeHarness();
    compositeFrame(
      makeDocument([
        makeTrack('track-a', { order: 0, revision: 1 }),
        makeTrack('track-b', { order: 1, revision: 2, blendMode: 'multiply' }),
      ]),
      0,
      SIZE,
      baseline.ports,
    );

    const mixed = makeHarness({
      // opacity 1 so the only difference from the baseline is the geometry —
      // the D-19 alpha product has its own row.
      trackTransforms: new Map<string, EfxPaintTrackMotionTransform>([
        ['track-a', { ...ANIMATED_MOTION, opacity: 1 }],
      ]),
    });
    compositeFrame(
      makeDocument([
        makeTrack('track-a', { order: 0, revision: 1 }),
        makeTrack('track-b', { order: 1, revision: 2, blendMode: 'multiply' }),
      ]),
      0,
      SIZE,
      mixed.ports,
    );

    // Exactly one transform block — the animated track's.
    expect(transformOps(mixed.ops)).toHaveLength(4);
    // Stripping the transform block restores the baseline op list exactly.
    const withoutTransform = mixed.ops.filter(
      (op) => op.type !== 'translate' && op.type !== 'rotate' && op.type !== 'scale',
    );
    expect(withoutTransform).toEqual(baseline.ops);
  });

  it('reuses the cached track raster unchanged across a motion-only edit', () => {
    const memo = createKeyedMemo<string, EfxPaintTrackContentResolution>();
    const revisions = new Map([['track-a', 'rev-1']]);
    const document = makeDocument([makeTrack('track-a', { revision: 1 })]);

    const first = makeHarness({
      trackRasterMemo: memo,
      trackContentRevisions: revisions,
      trackTransforms: new Map<string, EfxPaintTrackMotionTransform>([['track-a', ANIMATED_MOTION]]),
    });
    compositeFrame(document, 0, SIZE, first.ports);

    const second = makeHarness({
      trackRasterMemo: memo,
      trackContentRevisions: revisions,
      trackTransforms: new Map<string, EfxPaintTrackMotionTransform>([
        ['track-a', { ...ANIMATED_MOTION, translateX: 99 }],
      ]),
    });
    compositeFrame(document, 0, SIZE, second.ports);

    expect(first.resolveTrackContent).toHaveBeenCalledTimes(1);
    expect(second.resolveTrackContent).not.toHaveBeenCalled();
    expect(memo.size).toBe(1);
    expect(transformOps(second.ops)[0]).toEqual({ type: 'translate', x: 0.25 * 200 + 99, y: 46 });
  });

  it('exposes an exact identity predicate', () => {
    expect(isEfxPaintTrackMotionIdentity(IDENTITY_MOTION)).toBe(true);
    expect(isEfxPaintTrackMotionIdentity({ ...IDENTITY_MOTION, translateX: 0.0001 })).toBe(false);
    expect(isEfxPaintTrackMotionIdentity({ ...IDENTITY_MOTION, scale: 1.0001 })).toBe(false);
    expect(isEfxPaintTrackMotionIdentity({ ...IDENTITY_MOTION, rotationRadians: 2 * Math.PI })).toBe(false);
    expect(isEfxPaintTrackMotionIdentity({ ...IDENTITY_MOTION, opacity: 0.999 })).toBe(false);
  });
});
