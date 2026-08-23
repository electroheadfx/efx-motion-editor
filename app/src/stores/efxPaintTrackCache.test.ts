import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from './physicPaintStore';
import * as physicalModelModule from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import * as physicalResolverModule from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import { resolvePhysicPaintRotoLoopFrame } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

/**
 * 46-06 Task 2 (TRK-08 / D-10..D-12): live single source of truth + atomic
 * per-track invalidation. Linked Hold cells derive from the owning track's
 * real keys as ONE source cycle; a source edit re-resolves every repeat cell
 * of the owning track and nothing on any other track; source-missing answers
 * fail closed 'linked-unresolved' and never persist into frames, cache lists,
 * or projection cells. The memo is the 46-01 composite-key structural memo —
 * invalidation is exactly the composite-key delete in bumpTrackRevision
 * (D-12), proven here by the derive spy (one rebuild per invalidated memo).
 */
const LAYER = 'layer-efx-paint-track-cache';
const TRACK_A = 'track-a';
const TRACK_B = 'track-b';
const CAPACITY = 24;
const INTERPOLATION = { enabled: true, mode: 'duplicate' } as const;

let deriveRangesSpy: MockInstance;

function payload(appFrame: number, tag: string): PhysicPaintRotoRealKeyPayload {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`cache:${appFrame}:${tag}`)}`,
    width: 4,
    height: 4,
  };
}

function record(keyId: string, appFrame: number, tag: string): PhysicPaintRotoRealKeyRecord {
  return { kind: 'real-key', keyId, appFrame, payload: payload(appFrame, tag) };
}

/** Seed one track: records → loop clips → one runtime frame per real key. */
function seedTrack(
  trackId: string,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loops: readonly { loopId: string; placementStart: number; sourceKeyIds: readonly string[]; repeat: number }[],
): void {
  const seeded = physicPaintStore.replaceRotoPhysicalRecords(LAYER, trackId, records, INTERPOLATION, CAPACITY);
  if (!seeded.ok) throw new Error(`Seed records failed for ${trackId}: ${seeded.error}`);
  const clips = physicPaintStore.replaceRotoPhysicalLoopClips(
    LAYER,
    trackId,
    loops.map((loop) => ({ ...loop, mode: 'static' as const })),
  );
  if (!clips.ok) throw new Error(`Seed clips failed for ${trackId}: ${clips.error}`);
  for (const entry of records) {
    physicPaintStore.upsertRealRotoKeyFrame(
      LAYER,
      trackId,
      entry.appFrame,
      { frameIndex: 0, appFrame: entry.appFrame, dataUrl: `data:image/png;base64,${btoa(`frame-${entry.keyId}`)}`, width: 1000, height: 650 },
    );
  }
}

describe('physicPaintStore linked Hold source laws (46-06 Task 2 — TRK-02, D-10..D-12)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    deriveRangesSpy = vi.spyOn(physicalResolverModule, 'derivePhysicPaintRotoLoopRanges');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('single source: a 3-repeat Hold resolves the same sourceKeyId for repeatInstance 0,1,2 with (frame - placementStart) % cycleLength', () => {
    seedTrack(TRACK_A, [record('kA-0', 5, 'a@5')], [{ loopId: 'hold-a', placementStart: 10, sourceKeyIds: ['kA-0'], repeat: 3 }]);
    const pair = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(pair).not.toBeNull();

    // cycleLength is the source span (single source → 1); the 3 repeats are
    // frames 10, 11, 12 with repeatInstance 0, 1, 2 over the SAME sourceKeyId.
    const answers = [10, 11, 12].map((frame) => resolvePhysicPaintRotoLoopFrame(pair!.context, frame));
    for (const [index, answer] of answers.entries()) {
      expect(answer).toMatchObject({
        kind: 'linked',
        loopId: 'hold-a',
        appFrame: 10 + index,
        sourceKeyId: 'kA-0',
        sourceIndex: 0,
        cycleOffset: 0,
        repeatInstance: index,
      });
    }

    // Editing the source frame changes EVERY repeat cell after invalidation.
    const revision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK_A)!;
    const edited = physicPaintStore.updateRotoPhysicalRealKeyPayload(LAYER, TRACK_A, 'kA-0', revision, payload(5, 'painted'));
    expect(edited.ok).toBe(true);
    for (const frame of [10, 11, 12]) {
      const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_A, frame);
      expect(source).not.toBeNull();
      expect(source!.kind).toBe('real');
      if (source!.kind === 'real') {
        expect(source!.keyId).toBe('kA-0');
        expect(source!.renderedFrame.dataUrl).toBe(payload(5, 'painted').dataUrl);
      }
    }
  });

  it('atomic invalidation: a Hold source edit rebuilds the owning memo exactly once and re-resolves every linked cell from the new source', () => {
    seedTrack(TRACK_A, [record('kA-0', 5, 'a@5')], [{ loopId: 'hold-a', placementStart: 10, sourceKeyIds: ['kA-0'], repeat: 3 }]);

    const warmed = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(warmed).not.toBeNull();
    // Warm memo: the reference is stable and repeated reads add zero rebuilds.
    expect(physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A)!.context).toBe(warmed!.context);
    deriveRangesSpy.mockClear();
    void physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(deriveRangesSpy.mock.calls.length, 'cached memo: no derive rebuild on repeated reads').toBe(0);

    const revision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK_A)!;
    const edited = physicPaintStore.updateRotoPhysicalRealKeyPayload(LAYER, TRACK_A, 'kA-0', revision, payload(5, 'painted'));
    expect(edited.ok).toBe(true);

    deriveRangesSpy.mockClear();
    const rebuilt = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A)!;
    expect(deriveRangesSpy.mock.calls.length, 'source edit invalidates the composite memo: exactly one rebuild').toBe(1);
    // The rebuilt context is a different resolution object than the warm one.
    expect(rebuilt.context).not.toBe(warmed!.context);

    // Every linked cell re-resolves from the NEW source — never a stale frame.
    const before = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK_A)!;
    for (const frame of [10, 11, 12]) {
      const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_A, frame);
      expect(source).not.toBeNull();
      expect(source!.kind).toBe('real');
      if (source!.kind === 'real') {
        expect(source!.renderedFrame.dataUrl).toBe(payload(5, 'painted').dataUrl);
        expect(source!.cacheRevision).toBe(`${before}:real:kA-0`);
      }
    }
  });

  it('no cross-track invalidation: an A source edit leaves B memo valid and B render answers byte-unchanged', () => {
    seedTrack(TRACK_A, [record('kA-0', 5, 'a@5')], [{ loopId: 'hold-a', placementStart: 10, sourceKeyIds: ['kA-0'], repeat: 1 }]);
    seedTrack(TRACK_B, [record('kB-0', 5, 'b@5')], [{ loopId: 'hold-b', placementStart: 10, sourceKeyIds: ['kB-0'], repeat: 1 }]);

    const pairA = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    const pairB = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_B);
    const beforeB = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_B, 10);
    expect(beforeB).not.toBeNull();
    expect(pairA).not.toBeNull();
    expect(pairB).not.toBeNull();

    const revisionA = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK_A)!;
    const edited = physicPaintStore.updateRotoPhysicalRealKeyPayload(LAYER, TRACK_A, 'kA-0', revisionA, payload(5, 'painted'));
    expect(edited.ok).toBe(true);

    deriveRangesSpy.mockClear();
    // A's memo rebuilds (its own derive call)…
    const rebuiltA = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A)!;
    expect(deriveRangesSpy.mock.calls.length, 'A edit rebuilds only A memo').toBe(1);
    // …and B's memo stays valid: reference stable, zero rebuilds, byte-identical answers.
    const readB = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_B)!;
    expect(deriveRangesSpy.mock.calls.length, 'A edit never rebuilds B memo').toBe(1);
    expect(readB.context).toBe(pairB!.context);
    const afterB = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_B, 10);
    expect(deriveRangesSpy.mock.calls.length, 'B reads stay memoized').toBe(1);
    expect(afterB).toEqual(beforeB);
    expect(rebuiltA.context).not.toBe(pairA!.context);
  });

  it('unresolved never cached: a deleted source answers linked-unresolved, persists nothing, and heals on re-add', () => {
    seedTrack(TRACK_A, [record('kA-0', 5, 'a@5')], [{ loopId: 'hold-a', placementStart: 10, sourceKeyIds: ['kA-0'], repeat: 3 }]);
    let pair = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(resolvePhysicPaintRotoLoopFrame(pair!.context, 10)).toMatchObject({ kind: 'linked' });

    const deleted = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK_A, [], INTERPOLATION, CAPACITY);
    expect(deleted.ok).toBe(true);

    pair = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(pair).not.toBeNull();
    for (const frame of [10, 11, 12]) {
      const answer = resolvePhysicPaintRotoLoopFrame(pair!.context, frame);
      expect(answer).toMatchObject({
        kind: 'linked-unresolved',
        loopId: 'hold-a',
        appFrame: frame,
        missingSourceKeyIds: ['kA-0'],
      });
      // The render source surfaces the fail-closed 'loop-placeholder' (D-28),
      // never a dangling answer and never Paint content.
      const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_A, frame);
      expect(source).toMatchObject({ kind: 'loop-placeholder', missingSourceKeyIds: ['kA-0'] });
      // Virtual-only: no frame entry and no projection cell for the cell.
      expect(physicPaintStore.getFrame(LAYER, TRACK_A, frame)).toBeNull();
      expect(physicPaintStore.getFrames(LAYER, TRACK_A).has(frame)).toBe(false);
      const projection = physicPaintStore.getRotoPhysicalProjection(LAYER, TRACK_A);
      expect(projection).not.toBeNull();
      expect(projection!.cells.find((cell) => cell.appFrame === frame)?.kind).toBe('empty');
    }

    // Re-adding a real key at the source frame heals the linked answer.
    const healed = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK_A, [record('kA-0', 5, 'a@5')], INTERPOLATION, CAPACITY);
    expect(healed.ok).toBe(true);
    pair = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(resolvePhysicPaintRotoLoopFrame(pair!.context, 10)).toMatchObject({ kind: 'linked', sourceKeyId: 'kA-0' });
  });
});
