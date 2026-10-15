/**
 * Test-only fake engine-2 fixture (D-06 / D-08 / HOST-04).
 *
 * NOT published from `@efxlab/efx-paint-host`, NOT importable by app/ production
 * code or engine packages. Lives under `app/src/efx-paint/host-split/` so the
 * host package surface stays free of test scaffolding.
 *
 * Proves the host is engine-agnostic: a second engine's payload rides the ONE
 * `StudioStroke<P>` shape (shared fields + opaque `engine: P`) through the FULL
 * 55-03 `EngineAdapter<P>` plug point — lifecycle (applyStroke / stepTick /
 * captureFrame / dispose) with real recorded behavior that emits deterministic
 * tinted frames, PLUS the live-playback surface AnimationPlayer requires.
 *
 * Zero engine-1 imports: nothing from `@efxlab/efx-physic-paint`, and no
 * engine-1 stroke type. The payload bag uses watercolor-flavoured names
 * (wash / granulation / bleed / pigment) so it cannot be confused with
 * engine-1's tool/params/physicsMode vocab.
 */
import type {
  EngineAdapter,
  EngineId,
  StudioPoint,
  StudioScriptEnvelope,
  StudioStroke,
} from '@efxlab/efx-paint-host';
import { AnimationPlayer } from '@efxlab/efx-paint-host/animation';

// ---------------------------------------------------------------------------
// Fake engine-2 payload — its own params bag, deliberately not engine-1 vocab
// ---------------------------------------------------------------------------

export interface FakeEngine2StrokePayload {
  /** Watercolor wash intensity 0-100. */
  wash: number;
  /** Granulation amount 0-100. */
  granulation: number;
  /** Edge bleed 0-100. */
  bleed: number;
  /** Pigment identifier. */
  pigment: string;
}

/** Deterministic tint the stub paints into every captured frame. */
export const FAKE_ENGINE2_TINT = Object.freeze({
  r: 37,
  g: 197,
  b: 244,
  a: 255,
});

/** Package identity the stub declares (D-15). */
export const FAKE_ENGINE2_ID: EngineId = 'efx-watercolor';

// ---------------------------------------------------------------------------
// ImageData-shaped frame + mock canvas (existing mock-canvas/ImageData idiom)
// ---------------------------------------------------------------------------

export interface TintedFrame {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

function makeTintedFrame(width: number, height: number, tint: { r: number; g: number; b: number; a: number }): TintedFrame {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = tint.r;
    data[i + 1] = tint.g;
    data[i + 2] = tint.b;
    data[i + 3] = tint.a;
  }
  return { width, height, data };
}

function makeMockCanvas(width: number, height: number, pixels: Uint8ClampedArray): HTMLCanvasElement {
  const canvas = {
    width,
    height,
    getContext: (id: string) => {
      if (id !== '2d') return null;
      return {
        canvas,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          width: w,
          height: h,
          data: pixels.slice(0, w * h * 4),
        }),
        putImageData: (imageData: { data: Uint8ClampedArray }) => {
          pixels.set(imageData.data.subarray(0, pixels.length));
        },
      };
    },
  };
  return canvas as unknown as HTMLCanvasElement;
}

// ---------------------------------------------------------------------------
// Call log — every adapter interaction is recorded for assertion
// ---------------------------------------------------------------------------

export type FakeEngine2Call =
  | { method: 'setInputLocked'; locked: boolean }
  | { method: 'setAnimationMode'; mode: boolean }
  | { method: 'getStrokes' }
  | { method: 'renderPartialStrokes'; strokeCount: number }
  | { method: 'renderAllStrokes' }
  | { method: 'exportCompositeCanvas' }
  | { method: 'applyStroke'; brushId: string; recordedOrder: number }
  | { method: 'stepTick'; tick: number }
  | { method: 'captureFrame' }
  | { method: 'dispose' };

export interface FakeEngine2Adapter extends EngineAdapter<FakeEngine2StrokePayload> {
  readonly calls: readonly FakeEngine2Call[];
  readonly appliedStrokes: readonly StudioStroke<FakeEngine2StrokePayload>[];
  readonly steppedTicks: readonly number[];
  readonly capturedFrames: readonly TintedFrame[];
  readonly disposed: boolean;
  callCount(method: FakeEngine2Call['method']): number;
}

// ---------------------------------------------------------------------------
// Stroke / envelope builders — ONE shape: StudioStroke<FakeEngine2StrokePayload>
// ---------------------------------------------------------------------------

export function makeFakeEngine2Point(index: number): StudioPoint {
  return {
    x: 10 + index * 4,
    y: 20 + index * 2,
    p: 0.6,
    tx: 0,
    ty: 0,
    tw: 0,
    tick: index * 2,
  };
}

export function makeFakeEngine2Stroke(overrides?: {
  recordedOrder?: number;
  pointCount?: number;
  ticks?: number;
  cuisson?: number;
  playFrame?: number | null;
  payload?: Partial<FakeEngine2StrokePayload>;
}): StudioStroke<FakeEngine2StrokePayload> {
  const pointCount = overrides?.pointCount ?? 6;
  const recordedOrder = overrides?.recordedOrder ?? 0;
  return {
    pts: Array.from({ length: pointCount }, (_, i) => makeFakeEngine2Point(i)),
    ticks: overrides?.ticks ?? Math.max(1, (pointCount - 1) * 2),
    cuisson: overrides?.cuisson ?? 0,
    motion: null,
    brushId: 'fake-engine2-brush',
    toolOverrides: {},
    traceSeed: 0xf00d + recordedOrder,
    recordedOrder,
    playFrame: overrides?.playFrame ?? null,
    color: `#f2e2${String(recordedOrder).padStart(2, '0')}`,
    engine: {
      wash: 60,
      granulation: 25,
      bleed: 40,
      pigment: 'cerulean',
      ...overrides?.payload,
    },
  };
}

export function makeFakeEngine2Envelope(
  strokes: readonly StudioStroke<FakeEngine2StrokePayload>[],
): StudioScriptEnvelope<FakeEngine2StrokePayload> {
  return {
    kind: 'efx-studio-paint-script',
    schemaVersion: 1,
    engineId: FAKE_ENGINE2_ID,
    id: '00000000-0000-4000-8000-00000000f002',
    name: 'Fake engine-2 round-trip',
    createdAt: '2026-10-15T00:00:00.000Z',
    updatedAt: '2026-10-15T00:00:00.000Z',
    source: {
      projectName: 'genericity',
      layerId: 'layer-fake-engine2',
      layerName: 'Fake engine-2 layer',
      sourceFrame: 0,
      displayFrame: 0,
      width: 32,
      height: 24,
    },
    thumbnail: {
      mimeType: 'image/webp',
      width: 32,
      height: 24,
      quality: 80,
      dataUrl: 'data:image/webp;base64,',
    },
    brushPack: { kind: 'fake-engine2-pack', entries: [] },
    strokes,
  };
}

// ---------------------------------------------------------------------------
// The stub adapter — FULL 55-03 EngineAdapter plug point
// ---------------------------------------------------------------------------

export interface FakeEngine2AdapterOptions {
  width?: number;
  height?: number;
  /** Strokes the live-playback surface reports. */
  strokes?: readonly StudioStroke<FakeEngine2StrokePayload>[];
}

export function createFakeEngine2Adapter(
  options: FakeEngine2AdapterOptions = {},
): FakeEngine2Adapter {
  const width = options.width ?? 32;
  const height = options.height ?? 24;
  const strokes = options.strokes ?? [];
  const calls: FakeEngine2Call[] = [];
  const appliedStrokes: StudioStroke<FakeEngine2StrokePayload>[] = [];
  const steppedTicks: number[] = [];
  const capturedFrames: TintedFrame[] = [];
  let disposed = false;
  let currentTick = 0;

  const record = (call: FakeEngine2Call): void => {
    calls.push(call);
  };

  const adapter: FakeEngine2Adapter = {
    engineId: FAKE_ENGINE2_ID,
    payloadCodec: {
      serialize(stroke: unknown): StudioStroke<FakeEngine2StrokePayload> {
        if (isFakeEngine2Stroke(stroke)) return stroke;
        throw new Error('fake engine-2 payloadCodec.serialize: not a FakeEngine2 stroke');
      },
      parse(raw: unknown): StudioStroke<FakeEngine2StrokePayload> | null {
        return isFakeEngine2Stroke(raw) ? raw : null;
      },
    },

    // — Live playback surface (AnimationPlayer) —
    setInputLocked(locked: boolean): void {
      record({ method: 'setInputLocked', locked });
    },
    setAnimationMode(mode: boolean): void {
      record({ method: 'setAnimationMode', mode });
    },
    getStrokes(): readonly StudioStroke<FakeEngine2StrokePayload>[] {
      record({ method: 'getStrokes' });
      return strokes;
    },
    renderPartialStrokes(
      strokeData: ReadonlyArray<{ stroke: StudioStroke<FakeEngine2StrokePayload>; pointCount: number }>,
    ): void {
      record({ method: 'renderPartialStrokes', strokeCount: strokeData.length });
    },
    renderAllStrokes(): void {
      record({ method: 'renderAllStrokes' });
    },
    exportCompositeCanvas(): HTMLCanvasElement {
      record({ method: 'exportCompositeCanvas' });
      const frame = makeTintedFrame(width, height, FAKE_ENGINE2_TINT);
      return makeMockCanvas(width, height, frame.data);
    },

    // — Bake surface —
    applyStroke(stroke: StudioStroke<FakeEngine2StrokePayload>): void {
      record({ method: 'applyStroke', brushId: stroke.brushId, recordedOrder: stroke.recordedOrder });
      appliedStrokes.push(stroke);
    },
    stepTick(tick: number): void {
      record({ method: 'stepTick', tick });
      steppedTicks.push(tick);
      currentTick = tick;
    },
    captureFrame(): CanvasImageSource {
      record({ method: 'captureFrame' });
      // Deterministic tinted frame keyed only by canvas size + the constant
      // tint — plus a per-tick red-channel nudge so distinct ticks are
      // distinguishable without leaving the tint family.
      const frame = makeTintedFrame(width, height, {
        ...FAKE_ENGINE2_TINT,
        r: (FAKE_ENGINE2_TINT.r + (currentTick % 8)) & 0xff,
      });
      capturedFrames.push(frame);
      return frame as unknown as CanvasImageSource;
    },
    dispose(): void {
      record({ method: 'dispose' });
      disposed = true;
    },

    // — Recording surface (test-only) —
    get calls() {
      return calls;
    },
    get appliedStrokes() {
      return appliedStrokes;
    },
    get steppedTicks() {
      return steppedTicks;
    },
    get capturedFrames() {
      return capturedFrames;
    },
    get disposed() {
      return disposed;
    },
    callCount(method: FakeEngine2Call['method']): number {
      return calls.filter((c) => c.method === method).length;
    },
  };

  return adapter;
}

function isFakeEngine2Stroke(raw: unknown): raw is StudioStroke<FakeEngine2StrokePayload> {
  if (typeof raw !== 'object' || raw === null) return false;
  const candidate = raw as Record<string, unknown>;
  if (!Array.isArray(candidate.pts)) return false;
  if (typeof candidate.engine !== 'object' || candidate.engine === null) return false;
  const engine = candidate.engine as Record<string, unknown>;
  return (
    typeof engine.wash === 'number' &&
    typeof engine.granulation === 'number' &&
    typeof engine.bleed === 'number' &&
    typeof engine.pigment === 'string'
  );
}

// ---------------------------------------------------------------------------
// Play helper — drives AnimationPlayer on the integer tick/frame grid
// ---------------------------------------------------------------------------

export interface FakeEngine2PlayResult {
  framesRendered: number;
  completed: boolean;
}

/**
 * Runs the A5 play leg: AnimationPlayer (the host schedule player) driven on
 * StudioStroke<FakeEngine2StrokePayload> values and the integer frame grid.
 * The caller supplies the rAF mock (same idiom as AnimationPlayer.test.ts).
 */
export function playFakeEngine2Schedule(
  adapter: FakeEngine2Adapter,
  frameCount: number,
  fps: number,
  advance: (frameCount: number, fps: number) => void,
): FakeEngine2PlayResult {
  const player = new AnimationPlayer<FakeEngine2StrokePayload>(adapter);
  let framesRendered = 0;
  let completed = false;
  player.play({
    frameCount,
    fps,
    onFrame: () => {
      framesRendered += 1;
    },
    onComplete: () => {
      completed = true;
    },
  });
  // Advance past frameCount: the rAF tick's frame-duration comparison is
  // float-sensitive (1000/fps), so the last frame needs an extra tick or two
  // — same idiom as AnimationPlayer.test.ts (advance(18) for frameCount 16).
  advance(frameCount + 2, fps);
  return { framesRendered, completed };
}
