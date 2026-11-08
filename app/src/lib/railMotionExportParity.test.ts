import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  physicPaintStore,
  registerRotoAlphaCanvasFrame,
  _setPhysicPaintCompositorSizeProvider,
  _setPhysicPaintMarkDirtyCallback,
  type EfxPaintFlattenedFrameRecord,
} from '../stores/physicPaintStore';
import { registerDocument, reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { type PhysicPaintRotoRailMotionRecord } from '../components/physic-paint/roto/railMotionModel';
import {
  evaluateRailMotion,
  resolveRailLocalFrame,
} from '../components/physic-paint/roto/railMotionEvaluator';
import {
  setMotionKeyAtCursor as applySetMotionKeyAtCursor,
} from '../components/physic-paint/roto/railMotionCommands';
import {
  __resetRailMotionSnapFramesMemoForTests,
} from '../components/physic-paint/roto/railMotionSnapFrames';
import type { EfxPaintTrackMotionTransform } from '../efx-paint/compositor/efxPaintCompositor';
import { testWebpBytes } from '../testUtils/testWebpBytes';

// 59-09 (REL-04 / MOTN-08): the export sub-frame law, driven through the REAL
// store composite path — the same seam `exportRenderer` reaches through
// `previewRenderer.renderFrame` (`getFlattenedFrame(layerId, globalFrame + t)`).
//
// The law under test: content resolves at the INTEGER frame (the frame the
// per-track raster memo and every content key term are keyed by); the rail
// transform resolves at the UNFLOORED frame, so consecutive sub-frames of one
// export frame differ only by the transform applied to the SAME content raster.
// The fractional path is deliberately uncached at the flattened level.
//
// The environment is the same node harness the store's own flattened-composite
// suite establishes: a recording canvas/context stands in for the DOM, the
// compositor size provider is injected, and roto content is pre-registered in
// the alpha-canvas registry so the composite is synchronous (no decode tick).

const LAYER = 'layer-rail-motion-export';
const SUB_FRAMES = 8;

/** The export's base frame: the drawing key exists exactly at this frame. */
const BASE_FRAME = 5;
const KEY_A_BYTES = testWebpBytes('rail-export-key-A');
const KEY_B_BYTES = testWebpBytes('rail-export-key-B');

const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;
const CAPACITY = 600;

/**
 * One animated rail on the Key Rail [A@0 .. B@5]. Motion keys live at rail
 * frames 0 and 8, so every sub-frame of the 5.0-5.875 export sample sits
 * inside a live ease segment and the evaluated translateX strictly increases
 * with the fractional part.
 */
const MOTION_RECORD: PhysicPaintRotoRailMotionRecord = {
  railId: 'rail-1',
  anchorKeyId: 'A',
  channels: [
    {
      id: 'position-x',
      // 261108-gh0: non-default pair (2.5 / false). Global OFF keeps the
      // export's per-key fallback (every per-key wiggle here is 0), so the
      // sub-frame translateX pins still describe the same rendered motion.
      wiggle: 2.5,
      wiggleGlobal: false,
      keys: [
        { frame: 0, value: 0, easing: 'ease', wiggle: 0 },
        { frame: 8, value: 80, easing: 'ease', wiggle: 0 },
      ],
    },
    // The parser pairs the Position axes: both present, identical frame sets.
    // The Y axis holds 0, so only translateX varies across the sub-frames.
    {
      id: 'position-y',
      wiggle: 0,
      wiggleGlobal: true,
      keys: [
        { frame: 0, value: 0, easing: 'hold', wiggle: 0 },
        { frame: 8, value: 0, easing: 'hold', wiggle: 0 },
      ],
    },
  ],
};

/**
 * 59-19 (G2 / CR-04): one infinite Loop Clip over [A@0 .. B@4]. Its loop range
 * resolves to capacity (600), so the motion view must cover the whole rail —
 * not the two-frame first occurrence the identity module falls back to.
 */
const INFINITY_LOOP_ID = 'loop-inf';
const INFINITY_MOTION_RECORD: PhysicPaintRotoRailMotionRecord = {
  railId: INFINITY_LOOP_ID,
  anchorKeyId: 'A',
  channels: [
    {
      id: 'position-x',
      wiggle: 0,
      wiggleGlobal: true,
      keys: [
        { frame: 0, value: 0, easing: 'ease', wiggle: 0 },
        { frame: 3, value: 30, easing: 'ease', wiggle: 0 },
      ],
    },
    {
      id: 'position-y',
      wiggle: 0,
      wiggleGlobal: true,
      keys: [
        { frame: 0, value: 0, easing: 'hold', wiggle: 0 },
        { frame: 3, value: 0, easing: 'hold', wiggle: 0 },
      ],
    },
  ],
};

type RecordedOp =
  | { readonly type: 'clearRect'; readonly args: readonly number[] }
  | { readonly type: 'fillRect'; readonly args: readonly number[] }
  | { readonly type: 'save' }
  | { readonly type: 'restore' }
  | { readonly type: 'translate'; readonly args: readonly [number, number] }
  | { readonly type: 'rotate'; readonly args: readonly [number] }
  | { readonly type: 'scale'; readonly args: readonly [number, number] }
  | { readonly type: 'drawImage'; readonly source: unknown; readonly args: readonly number[] };

/** Recording 2D context: every transform/draw op is observable, in order. */
class RecordingContext {
  fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  constructor(private readonly ops: RecordedOp[]) {}

  save(): void { this.ops.push({ type: 'save' }); }
  restore(): void { this.ops.push({ type: 'restore' }); }
  clearRect(...args: number[]): void { this.ops.push({ type: 'clearRect', args }); }
  fillRect(...args: number[]): void { this.ops.push({ type: 'fillRect', args }); }
  translate(x: number, y: number): void { this.ops.push({ type: 'translate', args: [x, y] }); }
  rotate(radians: number): void { this.ops.push({ type: 'rotate', args: [radians] }); }
  scale(x: number, y: number): void { this.ops.push({ type: 'scale', args: [x, y] }); }
  drawImage(source: unknown, ...args: number[]): void {
    this.ops.push({ type: 'drawImage', source, args });
  }
  // Deliberately NO getImageData: every pixel probe in the composite path is
  // required to fail soft (the pigment-alpha conversion and the ink scan both
  // fall back), never to throw out of the store.
}

class RecordingCanvas {
  width = 0;
  height = 0;
  readonly ops: RecordedOp[] = [];
  getContext(kind: string): RecordingContext | null {
    return kind === '2d' ? new RecordingContext(this.ops) : null;
  }
}

let createdCanvases: RecordingCanvas[];
let trackRasters: { A: RecordingCanvas; B: RecordingCanvas };
let activeTrackId: string;

function rasterCanvas(width = 10, height = 10): RecordingCanvas {
  const canvas = new RecordingCanvas();
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function payload(appFrame: number, bytes: Uint8Array): PhysicPaintRotoRealKeyPayload {
  return { frameIndex: 0, appFrame, bytes, width: 10, height: 10 };
}

function record(keyId: string, appFrame: number, bytes: Uint8Array): PhysicPaintRotoRealKeyRecord {
  return { kind: 'real-key', keyId, appFrame, payload: payload(appFrame, bytes) };
}

/**
 * Register one physical track with drawing keys A@0 and B@5 plus an animated
 * Key Rail. The content rasters are pre-registered so every composite resolves
 * synchronously through the alpha-canvas registry (the production decode-once
 * path), and each registered canvas stays the ONE content raster of its key.
 */
function installAnimatedTrack(options: { motion?: boolean } = {}): void {
  const document = createEfxPaintDocument(LAYER);
  registerDocument(document);
  const trackId = document.tracks[0].id;
  activeTrackId = trackId;

  const seeded = physicPaintStore.replaceRotoPhysicalRecords(
    LAYER,
    trackId,
    [record('A', 0, KEY_A_BYTES), record('B', BASE_FRAME, KEY_B_BYTES)],
    INTERPOLATION,
    CAPACITY,
  );
  expect(seeded.ok).toBe(true);

  trackRasters = { A: rasterCanvas(), B: rasterCanvas() };
  registerRotoAlphaCanvasFrame(KEY_A_BYTES, trackRasters.A as unknown as HTMLCanvasElement);
  registerRotoAlphaCanvasFrame(KEY_B_BYTES, trackRasters.B as unknown as HTMLCanvasElement);

  if (options.motion !== false) {
    const applied = physicPaintStore.replaceRotoPhysicalRailMotions(LAYER, trackId, [MOTION_RECORD]);
    if (!applied.ok) throw new Error(`rail motion install failed: ${applied.error}`);
  }
}

/**
 * 59-19: register one physical track with an INFINITE progressive Loop Clip
 * over A@0/B@4 plus a rail-motion record on the loop's own identity. The loop
 * range derives to capacity, so the rail's resolved span is [0, 600).
 */
function installInfiniteLoopTrack(): void {
  const document = createEfxPaintDocument(LAYER);
  registerDocument(document);
  const trackId = document.tracks[0].id;
  activeTrackId = trackId;

  const seeded = physicPaintStore.replaceRotoPhysicalRecords(
    LAYER,
    trackId,
    [record('A', 0, KEY_A_BYTES), record('B', 4, KEY_B_BYTES)],
    INTERPOLATION,
    CAPACITY,
  );
  expect(seeded.ok).toBe(true);

  trackRasters = { A: rasterCanvas(), B: rasterCanvas() };
  registerRotoAlphaCanvasFrame(KEY_A_BYTES, trackRasters.A as unknown as HTMLCanvasElement);
  registerRotoAlphaCanvasFrame(KEY_B_BYTES, trackRasters.B as unknown as HTMLCanvasElement);

  const loops = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, trackId, [{
    loopId: INFINITY_LOOP_ID,
    placementStart: 0,
    sourceKeyIds: ['A', 'B'],
    repeat: 'infinity',
    mode: 'progressive',
    scriptId: 'script-59-19',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
  }]);
  if (!loops.ok) throw new Error(`loop install failed: ${loops.error}`);

  const applied = physicPaintStore.replaceRotoPhysicalRailMotions(
    LAYER,
    trackId,
    [INFINITY_MOTION_RECORD],
  );
  if (!applied.ok) throw new Error(`rail motion install failed: ${applied.error}`);
}

function opsOf(delivery: EfxPaintFlattenedFrameRecord): readonly RecordedOp[] {
  const raster = delivery.raster as unknown as RecordingCanvas | undefined;
  if (!raster || !Array.isArray(raster.ops)) throw new Error('delivery carries no recording raster');
  return raster.ops;
}

/** The transform ops the compositor applied, in order (none for identity). */
function transformOps(delivery: EfxPaintFlattenedFrameRecord): readonly RecordedOp[] {
  return opsOf(delivery).filter(
    (op) => op.type === 'translate' || op.type === 'rotate' || op.type === 'scale',
  );
}

/** The first translate's x — pixel-space transform output of the rail. */
function translateX(delivery: EfxPaintFlattenedFrameRecord): number {
  const first = opsOf(delivery).find((op) => op.type === 'translate');
  if (first === undefined || first.type !== 'translate') throw new Error('no translate op recorded');
  return first.args[0];
}

/** The raster the compositor actually drew for the track. */
function drawnTrackRaster(delivery: EfxPaintFlattenedFrameRecord): unknown {
  const draw = opsOf(delivery).find((op) => op.type === 'drawImage');
  if (draw === undefined || draw.type !== 'drawImage') throw new Error('no drawImage op recorded');
  return draw.source;
}

function deliveryAt(frame: number): EfxPaintFlattenedFrameRecord {
  const delivery = physicPaintStore.getFlattenedFrame(LAYER, frame);
  if (delivery === null) throw new Error(`expected a delivery at frame ${frame}`);
  return delivery;
}

describe('rail motion export sub-frame parity (59-09 REL-04 / MOTN-08)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    // 261108-d5o: the snap-frame memo outlives a store reset, so the suites
    // that seed different rail identities must clear it explicitly.
    __resetRailMotionSnapFramesMemoForTests();
    resetEfxPaintStore();
    createdCanvases = [];
    _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag !== 'canvas') return {};
        const canvas = new RecordingCanvas();
        createdCanvases.push(canvas);
        return canvas;
      },
    });
    vi.stubGlobal('HTMLCanvasElement', RecordingCanvas);
    vi.stubGlobal('ImageData', class {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    });
    vi.stubGlobal('createImageBitmap', async () => ({ width: 1, height: 1, close() {} }));
    vi.stubGlobal('Image', class {
      src = '';
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
    });
  });

  afterEach(() => {
    _setPhysicPaintCompositorSizeProvider(null);
    vi.unstubAllGlobals();
  });

  it('delivers paint on every motion-blur sub-frame (REL-04)', () => {
    installAnimatedTrack();
    const deliveries: EfxPaintFlattenedFrameRecord[] = [];
    for (let index = 0; index < SUB_FRAMES; index += 1) {
      const frame = BASE_FRAME + index / SUB_FRAMES;
      const delivery = physicPaintStore.getFlattenedFrame(LAYER, frame);
      expect(delivery, `sub-frame ${frame} delivers a composite`).not.toBeNull();
      expect(delivery!.missing, `sub-frame ${frame} reports no missing source`).toEqual([]);
      deliveries.push(delivery!);
    }
    // The paint is present on EVERY sub-frame: the compositor draws the track's
    // own content raster (not an empty composite, not a missing placeholder).
    for (const delivery of deliveries) {
      expect(drawnTrackRaster(delivery)).toBe(trackRasters.B);
    }
  });

  it('resolves content at the integer frame for every sub-frame', () => {
    installAnimatedTrack();
    const integer = deliveryAt(BASE_FRAME);
    for (let index = 0; index < SUB_FRAMES; index += 1) {
      const fractional = deliveryAt(BASE_FRAME + index / SUB_FRAMES);
      // The content identity (cache key = every content term + the integer
      // frame term) is the SAME as the integer delivery's.
      expect(fractional.cacheKey).toBe(integer.cacheKey);
      expect(fractional.frame).toBe(BASE_FRAME);
      expect(fractional.renderedFrame.appFrame).toBe(BASE_FRAME);
      expect(fractional.missing).toEqual(integer.missing);
    }
  });

  it('evaluates the rail transform at the unfloored frame', () => {
    installAnimatedTrack();
    const integerX = translateX(deliveryAt(BASE_FRAME));
    const subFrameXs = Array.from({ length: SUB_FRAMES }, (_, index) =>
      translateX(deliveryAt(BASE_FRAME + index / SUB_FRAMES)),
    );
    // The 0th sub-frame IS the integer sample: same transform as the integer
    // delivery (one interpolation authority, one sample of it).
    expect(subFrameXs[0]).toBeCloseTo(integerX, 12);
    // Every following sub-frame carries a strictly larger translate: the
    // transform is sampled at the unfloored frame, not floored with the content.
    for (let index = 1; index < subFrameXs.length; index += 1) {
      expect(subFrameXs[index], `sub-frame ${index} advances the transform`).toBeGreaterThan(subFrameXs[index - 1]);
    }
    // Only the transform varies: rotation and scale stay at identity.
    for (let index = 0; index < SUB_FRAMES; index += 1) {
      const ops = transformOps(deliveryAt(BASE_FRAME + index / SUB_FRAMES));
      const rotation = ops.find((op) => op.type === 'rotate');
      const scale = ops.find((op) => op.type === 'scale');
      expect(rotation !== undefined && rotation.type === 'rotate' ? rotation.args[0] : null).toBe(0);
      expect(scale !== undefined && scale.type === 'scale' ? scale.args : null).toEqual([1, 1]);
    }
  });

  it('floors the content frame for the composite: a missing track reports the integer frame', () => {
    installAnimatedTrack();
    // Frame 6 has no drawing key (the rail is [0,6)); 6.5 floors to 6 for
    // CONTENT — the missing report must never carry a fractional frame, which
    // is the observable proof the compositor was driven with the integer frame.
    const fractional = deliveryAt(6.5);
    expect(fractional.missing).toHaveLength(1);
    expect(fractional.missing[0].frame).toBe(6);
    const integer = deliveryAt(6);
    expect(fractional.cacheKey).toBe(integer.cacheKey);
    expect(fractional.missing).toEqual(integer.missing);
  });

  it('never serves a fractional delivery from the integer flattened memo (T-59-27)', () => {
    installAnimatedTrack();
    const fractional = deliveryAt(BASE_FRAME + 0.5);
    const integer = deliveryAt(BASE_FRAME);
    expect(integer).not.toBe(fractional);
    expect(translateX(integer)).not.toBeCloseTo(translateX(fractional), 6);
    // The integer entry is still stored and served (the fractional delivery did
    // not poison it): a second integer call is the same frozen record.
    expect(deliveryAt(BASE_FRAME)).toBe(integer);
  });

  it('does not read the integer memo for a fractional frame', () => {
    installAnimatedTrack();
    const integer = deliveryAt(BASE_FRAME);
    const fractional = deliveryAt(BASE_FRAME + 0.5);
    expect(fractional).not.toBe(integer);
    expect(translateX(fractional)).not.toBeCloseTo(translateX(integer), 6);
    expect(translateX(fractional)).toBeGreaterThan(translateX(integer));
  });

  it('still rejects negative and non-finite frames', () => {
    installAnimatedTrack();
    expect(physicPaintStore.getFlattenedFrame(LAYER, -0.5)).toBeNull();
    expect(physicPaintStore.getFlattenedFrame(LAYER, -1)).toBeNull();
    expect(physicPaintStore.getFlattenedFrame(LAYER, Number.NaN)).toBeNull();
    expect(physicPaintStore.getFlattenedFrame(LAYER, Number.POSITIVE_INFINITY)).toBeNull();
  });

  // 59-09 Task 2 (MOTN-08): export, Play and the edit view must agree on the
  // transform at every sampled time. The seam below reports what the store
  // ACTUALLY applied; the expectation is the 59-05 evaluator's own output at
  // the rail-local sub-frame — never a hand-written number, never a second
  // interpolation implemented in this test.
  describe('transform-frame parity (59-09 MOTN-08)', () => {
    function appliedTransform(): EfxPaintTrackMotionTransform | undefined {
      return physicPaintStore.getLastAppliedTrackTransforms(LAYER).get(activeTrackId);
    }

    it('applies the evaluator transform at the fractional frame (one interpolation authority)', () => {
      installAnimatedTrack();
      deliveryAt(BASE_FRAME + 0.5);
      const applied = appliedTransform();
      expect(applied, 'the store applied a transform for the animated rail').toBeDefined();
      // Key Rail [A@0 .. B@5]: the rail starts at frame 0, so the rail-local
      // frame is the app frame itself.
      const railStart = 0;
      const expected = evaluateRailMotion(
        MOTION_RECORD,
        resolveRailLocalFrame(BASE_FRAME + 0.5, railStart),
      );
      expect(applied!.translateX).toBeCloseTo(expected.translateX, 12);
      expect(applied!.translateY).toBeCloseTo(expected.translateY, 12);
      expect(applied!.scale).toBeCloseTo(expected.scale, 12);
      expect(applied!.rotationRadians).toBeCloseTo(expected.rotationRadians, 12);
      expect(applied!.opacity).toBeCloseTo(expected.opacity, 12);
      // The sub-frame is a genuinely different sample than the floored frame.
      const atInteger = evaluateRailMotion(
        MOTION_RECORD,
        resolveRailLocalFrame(BASE_FRAME, railStart),
      );
      expect(applied!.translateX).not.toBeCloseTo(atInteger.translateX, 6);
    });

    it('carries the same transform through getFlattenedFrame and getFlattenedFrameExcluding', () => {
      installAnimatedTrack();
      // The empty exclude set adds no key term, so the first call builds and
      // the second is a memo hit on the same record: one key, one transform.
      const excluding = physicPaintStore.getFlattenedFrameExcluding(LAYER, BASE_FRAME, new Set());
      expect(excluding).not.toBeNull();
      const builtTransform = appliedTransform();
      expect(builtTransform, 'the excluding seam built a transform').toBeDefined();
      const plain = deliveryAt(BASE_FRAME);
      expect(plain.cacheKey).toBe(excluding!.cacheKey);
      expect(appliedTransform()).toBe(builtTransform);
      const expected = evaluateRailMotion(MOTION_RECORD, resolveRailLocalFrame(BASE_FRAME, 0));
      expect(builtTransform!.translateX).toBeCloseTo(expected.translateX, 12);
    });

    it('applies exactly one affine to the shared content raster (no second application)', () => {
      installAnimatedTrack();
      const integer = deliveryAt(BASE_FRAME);
      const fractional = deliveryAt(BASE_FRAME + 0.5);
      // One content raster per integer frame: both composites draw the SAME
      // registered raster object.
      expect(drawnTrackRaster(integer)).toBe(trackRasters.B);
      expect(drawnTrackRaster(fractional)).toBe(trackRasters.B);
      // The transform is baked into a DISTINCT composite...
      expect(fractional.raster).not.toBe(integer.raster);
      // ...at exactly one application site: one rotate, one scale and the two
      // translate legs of the pivot sequence per draw.
      const ops = transformOps(fractional);
      expect(ops.filter((op) => op.type === 'rotate')).toHaveLength(1);
      expect(ops.filter((op) => op.type === 'scale')).toHaveLength(1);
      expect(ops.filter((op) => op.type === 'translate')).toHaveLength(2);
      // Content metadata is the integer delivery's, unchanged.
      expect(fractional.cacheKey).toBe(integer.cacheKey);
      expect(fractional.missing).toEqual(integer.missing);
      expect(fractional.renderedFrame.appFrame).toBe(integer.renderedFrame.appFrame);
    });

    it('delivers the untransformed integer composite when the rail has no motion', () => {
      installAnimatedTrack({ motion: false });
      const fractional = deliveryAt(BASE_FRAME + 0.5);
      expect(fractional).not.toBeNull();
      // The absent path stays the common path: no transform entry, no ops.
      expect(physicPaintStore.getLastAppliedTrackTransforms(LAYER).size).toBe(0);
      expect(transformOps(fractional)).toHaveLength(0);
      expect(drawnTrackRaster(fractional)).toBe(trackRasters.B);
      expect(deliveryAt(BASE_FRAME).cacheKey).toBe(fractional.cacheKey);
    });

    it('clears the diagnostic seam with the document', () => {
      installAnimatedTrack();
      deliveryAt(BASE_FRAME + 0.5);
      expect(appliedTransform()).toBeDefined();
      physicPaintStore.reset();
      expect(physicPaintStore.getLastAppliedTrackTransforms(LAYER).size).toBe(0);
    });
  });

  // 59-19 (G2 / CR-04): an infinite Loop Clip's motion view must reach the
  // rail's resolved end (the derived loop range, capacity-bounded), not stop
  // after the first occurrence the resolver-less identity fallback produces.
  describe('infinite Loop Clip motion span (59-19 G2 / CR-04)', () => {
    function appliedTransform(): EfxPaintTrackMotionTransform | undefined {
      return physicPaintStore.getLastAppliedTrackTransforms(LAYER).get(activeTrackId);
    }

    it('applies the infinite rail transform in a later cycle and at the resolved end minus one', () => {
      installInfiniteLoopTrack();
      // A@0/B@4 cycle twice: frame 6 is cycle 2 (frames 5..9) of the loop.
      const cycleTwo = physicPaintStore.getFlattenedFrame(LAYER, 6);
      expect(cycleTwo, 'cycle 2 delivers a composite').not.toBeNull();
      expect(appliedTransform(), 'cycle 2 carries the rail transform').toBeDefined();

      // The last frame before the capacity-bounded resolved end: still inside
      // the half-open span, so the transform is applied there too.
      const beforeEnd = physicPaintStore.getFlattenedFrame(LAYER, CAPACITY - 1);
      expect(beforeEnd, 'the last resolved frame delivers a composite').not.toBeNull();
      expect(appliedTransform(), 'the last resolved frame carries the rail transform').toBeDefined();
    });

    it('applies no transform at the resolved end (half-open span)', () => {
      installInfiniteLoopTrack();
      physicPaintStore.getFlattenedFrame(LAYER, CAPACITY);
      expect(appliedTransform(), 'the resolved end frame carries no rail transform').toBeUndefined();
    });
  });

  // 261108-d5o: Stop Motion steps the compositor at the DISPLAYED real keys and
  // Linear reads the raw ramp. Both tokens cross the real composite path here,
  // so a revert to the two-easing binary path fails these rows by construction.
  describe('stop-motion and linear compositing (261108-d5o)', () => {
    const SNAP_BYTES = {
      A: testWebpBytes('rail-snap-A'),
      B: testWebpBytes('rail-snap-B'),
      C: testWebpBytes('rail-snap-C'),
    } as const;
    const STOP_MOTION_RAIL_ID = 'rail-stop-motion';

    /**
     * Real keys at 0/3/6 and one stop-motion Position pair: X ramps 0 -> 6 and
     * Y ramps 0 -> 60 over the [0, 6] span, so the displayed-real list is
     * [0, 3, 6] and every interior sample steps at frame 3.
     */
    const STOP_MOTION_RECORD: PhysicPaintRotoRailMotionRecord = {
      railId: STOP_MOTION_RAIL_ID,
      anchorKeyId: 'A',
      channels: [
        {
          id: 'position-x',
          wiggle: 0,
          wiggleGlobal: true,
          keys: [
            { frame: 0, value: 0, easing: 'stop-motion', wiggle: 0 },
            { frame: 6, value: 6, easing: 'linear', wiggle: 0 },
          ],
        },
        {
          id: 'position-y',
          wiggle: 0,
          wiggleGlobal: true,
          keys: [
            { frame: 0, value: 0, easing: 'stop-motion', wiggle: 0 },
            { frame: 6, value: 60, easing: 'linear', wiggle: 0 },
          ],
        },
      ],
    };

    /** Real keys at 0/5/8 and a raw Linear ramp 0 -> 80 over [0, 8]. */
    const LINEAR_RECORD: PhysicPaintRotoRailMotionRecord = {
      railId: 'rail-linear',
      anchorKeyId: 'A',
      channels: [
        {
          id: 'position-x',
          wiggle: 0,
          wiggleGlobal: true,
          keys: [
            { frame: 0, value: 0, easing: 'linear', wiggle: 0 },
            { frame: 8, value: 80, easing: 'linear', wiggle: 0 },
          ],
        },
        {
          id: 'position-y',
          wiggle: 0,
          wiggleGlobal: true,
          keys: [
            { frame: 0, value: 0, easing: 'linear', wiggle: 0 },
            { frame: 8, value: 0, easing: 'linear', wiggle: 0 },
          ],
        },
      ],
    };

    function installSnapTrack(
      realKeys: readonly {
        readonly keyId: string;
        readonly appFrame: number;
        readonly bytes: Uint8Array;
      }[],
      motion: PhysicPaintRotoRailMotionRecord,
    ): void {
      const document = createEfxPaintDocument(LAYER);
      registerDocument(document);
      const trackId = document.tracks[0].id;
      activeTrackId = trackId;

      const seeded = physicPaintStore.replaceRotoPhysicalRecords(
        LAYER,
        trackId,
        realKeys.map((key) => record(key.keyId, key.appFrame, key.bytes)),
        INTERPOLATION,
        CAPACITY,
      );
      expect(seeded.ok).toBe(true);
      for (const key of realKeys) {
        registerRotoAlphaCanvasFrame(key.bytes, rasterCanvas() as unknown as HTMLCanvasElement);
      }
      const applied = physicPaintStore.replaceRotoPhysicalRailMotions(LAYER, trackId, [motion]);
      if (!applied.ok) throw new Error(`rail motion install failed: ${applied.error}`);
    }

    function appliedTransform(): EfxPaintTrackMotionTransform | undefined {
      return physicPaintStore.getLastAppliedTrackTransforms(LAYER).get(activeTrackId);
    }

    function translateOps(delivery: EfxPaintFlattenedFrameRecord): readonly number[][] {
      return opsOf(delivery)
        .filter((op) => op.type === 'translate')
        .map((op) => [...((op as Extract<RecordedOp, { type: 'translate' }>).args)]);
    }

    it('holds the compositor between displayed keys and steps at each one', () => {
      installSnapTrack([
        { keyId: 'A', appFrame: 0, bytes: SNAP_BYTES.A },
        { keyId: 'B', appFrame: 3, bytes: SNAP_BYTES.B },
        { keyId: 'C', appFrame: 6, bytes: SNAP_BYTES.C },
      ], STOP_MOTION_RECORD);

      // 3.5 and 4.5 both sample the SAME displayed key at frame 3: the exact
      // raw-ramp value 6 x 3/6 = 3. A continuous ease would advance here.
      deliveryAt(3.5);
      const atThreeAndAHalf = appliedTransform();
      if (atThreeAndAHalf === undefined) throw new Error('expected the rail transform at 3.5');
      deliveryAt(4.5);
      const atFourAndAHalf = appliedTransform();
      if (atFourAndAHalf === undefined) throw new Error('expected the rail transform at 4.5');
      expect(atThreeAndAHalf.translateX).toBeCloseTo(3, 12);
      expect(atFourAndAHalf.translateX).toBeCloseTo(3, 12);

      // At the real key frame 6 the channel holds its own value, so the step is
      // observable rather than a flat line.
      deliveryAt(6);
      const atSix = appliedTransform();
      if (atSix === undefined) throw new Error('expected the rail transform at 6');
      expect(atSix.translateX).toBeCloseTo(6, 12);
      expect(atFourAndAHalf.translateX).not.toBeCloseTo(atSix.translateX, 6);
    });

    it('reads a Linear outgoing key as a raw ramp, never as smoothstep', () => {
      installSnapTrack([
        { keyId: 'A', appFrame: 0, bytes: SNAP_BYTES.A },
        { keyId: 'B', appFrame: 5, bytes: SNAP_BYTES.B },
        { keyId: 'C', appFrame: 8, bytes: SNAP_BYTES.C },
      ], LINEAR_RECORD);

      deliveryAt(5);
      const transform = appliedTransform();
      if (transform === undefined) throw new Error('expected the rail transform at 5');
      // 80 x 5/8 = 50 — the raw ramp; smoothstep would read 54.6875.
      expect(transform.translateX).toBeCloseTo(50, 12);
    });

    it('leaves the displayed pose identical when a Motion key is inserted at the displayed frame', () => {
      installSnapTrack([
        { keyId: 'A', appFrame: 0, bytes: SNAP_BYTES.A },
        { keyId: 'B', appFrame: 3, bytes: SNAP_BYTES.B },
        { keyId: 'C', appFrame: 6, bytes: SNAP_BYTES.C },
      ], STOP_MOTION_RECORD);

      const before = deliveryAt(3);
      const beforeTransform = appliedTransform();
      if (beforeTransform === undefined) throw new Error('expected the rail transform at 3');
      expect(beforeTransform.translateX).toBeCloseTo(3, 12);
      expect(beforeTransform.translateY).toBeCloseTo(30, 12);
      // The compositor's translate op carries the pivot offset, so the identity
      // comparison below is op-arg identity, never the raw 3 / 30.
      const beforeTranslates = translateOps(before);

      const records = physicPaintStore.getRotoPhysicalRailMotions(LAYER, activeTrackId);
      const inserted = applySetMotionKeyAtCursor({
        records,
        railId: STOP_MOTION_RAIL_ID,
        channelId: 'position-x',
        keyFrame: 3,
        snapFrames: Object.freeze([0, 3, 6]),
      });
      if (!inserted.ok) throw new Error(inserted.reason);
      const written = physicPaintStore.replaceRotoPhysicalRailMotions(
        LAYER,
        activeTrackId,
        inserted.records,
      );
      expect(written.ok).toBe(true);
      // The insert really created the frame-3 keys on BOTH axes.
      const updated = physicPaintStore.getRotoPhysicalRailMotions(LAYER, activeTrackId);
      const updatedX = updated.find((entry) => entry.railId === STOP_MOTION_RAIL_ID)
        ?.channels.find((channel) => channel.id === 'position-x');
      const updatedY = updated.find((entry) => entry.railId === STOP_MOTION_RAIL_ID)
        ?.channels.find((channel) => channel.id === 'position-y');
      expect(updatedX?.keys.find((key) => key.frame === 3)?.value).toBeCloseTo(3, 12);
      expect(updatedY?.keys.find((key) => key.frame === 3)?.value).toBeCloseTo(30, 12);

      const after = deliveryAt(3);
      const afterTransform = appliedTransform();
      if (afterTransform === undefined) throw new Error('expected the rail transform after the insert');
      expect(afterTransform.translateX).toBeCloseTo(beforeTransform.translateX, 12);
      expect(afterTransform.translateY).toBeCloseTo(beforeTransform.translateY, 12);
      expect(translateOps(after)).toEqual(beforeTranslates);
    });
  });
});
