/**
 * A5 automated pin (D-05 / D-06 / HOST-04) — fake engine-2 record → play → bake.
 *
 * Genericity is a contract, not a visible behavior (D-05): this pin proves a
 * second engine's payload round-trips through the ONE `StudioStroke<P>` shape
 * and the FULL `EngineAdapter<P>` plug point with assertable pixels.
 *
 *   - play  = AnimationPlayer (the host schedule player) on StudioStroke<P>
 *             schedules and the integer tick/frame grid
 *   - bake  = the applyStroke → stepTick* → captureFrame lifecycle (D-06)
 *
 * Both legs consume the same StudioStroke<P> shared fields + opaque
 * `FakeEngine2StrokePayload` — no second stroke shape, no mapping that reads P.
 *
 * Family: paintVersionDisciplineContract / efxPaintCleanBreakContract /
 * hostAnimationResidueContract / hostSplitFailClosedApply — a normal
 * `.test.ts` on the existing vitest setup.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudioStroke } from '@efxlab/efx-paint-host';
import {
  createFakeEngine2Adapter,
  makeFakeEngine2Envelope,
  makeFakeEngine2Stroke,
  playFakeEngine2Schedule,
  FAKE_ENGINE2_TINT,
  type FakeEngine2Adapter,
  type FakeEngine2StrokePayload,
  type TintedFrame,
} from './fakeEngine2Fixture';

const HOST_SPLIT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const FIXTURE_PATH = resolve(HOST_SPLIT_DIR, 'fakeEngine2Fixture.ts');
const FIXTURE_SOURCE = readFileSync(FIXTURE_PATH, 'utf8');

// --- rAF mock (same idiom as AnimationPlayer.test.ts) -----------------------

let rafCallback: FrameRequestCallback | null = null;

function installAnimationFrameMock(): void {
  rafCallback = null;
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback: FrameRequestCallback) => {
      rafCallback = callback;
      return 1;
    }),
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

function advanceAnimationFrames(frameCount: number, fps = 12): void {
  const frameDuration = 1000 / fps;
  rafCallback?.(1);
  for (let frame = 0; frame < frameCount; frame += 1) {
    if (!rafCallback) break;
    rafCallback(1 + (frame + 1) * frameDuration);
  }
}

// --- bake leg: applyStroke → stepTick* → captureFrame ----------------------

function bakeEnvelopeStrokes(
  adapter: FakeEngine2Adapter,
  strokes: readonly StudioStroke<FakeEngine2StrokePayload>[],
): TintedFrame[] {
  const frames: TintedFrame[] = [];
  for (const stroke of strokes) {
    adapter.applyStroke(stroke);
    for (let tick = 0; tick <= stroke.ticks; tick += 1) {
      adapter.stepTick(tick);
    }
    const captured = adapter.captureFrame() as unknown as TintedFrame;
    frames.push(captured);
  }
  return frames;
}

function isTinted(frame: TintedFrame, lastTick = 0): boolean {
  const expectedR = (FAKE_ENGINE2_TINT.r + (lastTick % 8)) & 0xff;
  if (frame.width <= 0 || frame.height <= 0) return false;
  const first = frame.data.subarray(0, 4);
  return (
    first[0] === expectedR &&
    first[1] === FAKE_ENGINE2_TINT.g &&
    first[2] === FAKE_ENGINE2_TINT.b &&
    first[3] === FAKE_ENGINE2_TINT.a
  );
}

// ---------------------------------------------------------------------------

describe('A5 fake engine-2 record → play → bake (HOST-04 / D-05 / D-06)', () => {
  beforeEach(() => {
    installAnimationFrameMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips record → play → bake on the ONE StudioStroke<P> shape with assertable pixels', () => {
    // — record: StudioStroke<FakeEngine2StrokePayload> values in an envelope —
    const strokes = [
      makeFakeEngine2Stroke({ recordedOrder: 0, pointCount: 6, ticks: 10 }),
      makeFakeEngine2Stroke({ recordedOrder: 1, pointCount: 4, ticks: 6, playFrame: 3 }),
    ];
    const envelope = makeFakeEngine2Envelope(strokes);
    expect(envelope.engineId).toBe('efx-watercolor');
    expect(envelope.strokes).toHaveLength(2);

    const adapter = createFakeEngine2Adapter({ strokes: envelope.strokes, width: 32, height: 24 });

    // — play: AnimationPlayer on StudioStroke values + integer frame grid —
    const playResult = playFakeEngine2Schedule(adapter, 4, 12, advanceAnimationFrames);
    expect(playResult.framesRendered).toBeGreaterThan(0);
    expect(playResult.completed).toBe(true);

    // — bake: applyStroke → stepTick* → captureFrame on the same stub —
    const baked = bakeEnvelopeStrokes(adapter, envelope.strokes);
    expect(baked).toHaveLength(2);

    // (1) non-trivial captured pixels — the stub tint
    for (let i = 0; i < baked.length; i += 1) {
      const frame = baked[i];
      const lastTick = envelope.strokes[i].ticks;
      expect(frame.width).toBe(32);
      expect(frame.height).toBe(24);
      expect(frame.data.length).toBe(32 * 24 * 4);
      expect(isTinted(frame, lastTick)).toBe(true);
    }
    // Distinct ticks produce distinct red-channel nudges (non-trivial pixels).
    expect(baked[0].data[0]).not.toBe(baked[1].data[0]);

    // (2) AnimationPlayer live-surface calls AND lifecycle methods exercised
    expect(adapter.callCount('setInputLocked')).toBeGreaterThan(0);
    expect(adapter.callCount('setAnimationMode')).toBeGreaterThan(0);
    expect(adapter.callCount('getStrokes')).toBeGreaterThan(0);
    expect(adapter.callCount('renderPartialStrokes')).toBeGreaterThan(0);
    expect(adapter.callCount('renderAllStrokes')).toBeGreaterThan(0);
    expect(adapter.callCount('exportCompositeCanvas')).toBeGreaterThan(0);

    expect(adapter.callCount('applyStroke')).toBe(2);
    expect(adapter.callCount('stepTick')).toBe(10 + 1 + 6 + 1);
    expect(adapter.callCount('captureFrame')).toBe(2);

    // The stub records real stroke identity — not a second stroke shape.
    expect(adapter.appliedStrokes.map((s) => s.brushId)).toEqual([
      'fake-engine2-brush',
      'fake-engine2-brush',
    ]);
    expect(adapter.steppedTicks[0]).toBe(0);
    expect(adapter.steppedTicks[adapter.steppedTicks.length - 1]).toBe(6);

    adapter.dispose();
    expect(adapter.disposed).toBe(true);
    expect(adapter.callCount('dispose')).toBe(1);
  });

  it('consumes only StudioStroke<P> values — no engine-1 stroke type appears', () => {
    const stroke = makeFakeEngine2Stroke({ recordedOrder: 4 });
    // Shared fields + opaque payload; host-level identity only.
    expect(stroke).toMatchObject({
      brushId: 'fake-engine2-brush',
      recordedOrder: 4,
      playFrame: null,
    });
    expect(stroke.engine).toMatchObject({ wash: 60, granulation: 25, bleed: 40, pigment: 'cerulean' });
    // The opaque slot is never mapped through an engine-1 type.
    expect(typeof stroke.traceSeed).toBe('number');
    expect(Array.isArray(stroke.pts)).toBe(true);
  });

  it('fixture file imports nothing from @efxlab/efx-physic-paint and carries no engine-1 stroke type', () => {
    // Strip header/prose comments so documentation cannot self-invalidate.
    const stripped = FIXTURE_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/@efxlab\/efx-physic-paint/);
    expect(stripped).not.toMatch(/from\s+['"]efx-physic-paint['"]/);
    // Engine-1 stroke vocabulary must not appear in the fixture source.
    expect(stripped).not.toMatch(/EfxPaintEngine/);
    expect(stripped).not.toMatch(/PaintStroke/);
    expect(stripped).not.toMatch(/physicsMode/);
    // The fake payload bag is its own vocabulary.
    expect(stripped).toMatch(/FakeEngine2StrokePayload/);
    expect(stripped).toMatch(/wash/);
  });

  it('payloadCodec.parse is fail-closed on foreign shapes and accepts the fake payload', () => {
    const adapter = createFakeEngine2Adapter();
    const stroke = makeFakeEngine2Stroke();
    expect(adapter.payloadCodec.parse(stroke)).toBe(stroke);
    expect(adapter.payloadCodec.parse({ pts: [], engine: { waterAmount: 50 } })).toBeNull();
    expect(adapter.payloadCodec.parse(null)).toBeNull();
    expect(adapter.payloadCodec.parse('nope')).toBeNull();
  });
});
