import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from './physicPaintStore';
import * as physicalResolverModule from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import { resolvePhysicPaintRotoLoopFrame } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import type {
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

describe('physicPaintStore fail-closed Hold creation + linked ordering (46-06 Task 3 — D-13, TRK-08, T-46-16)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('empty refs rejected: a Hold clip with sourceFrameRefs [] fails closed empty-source-refs and writes nothing', () => {
    seedTrack(TRACK_A, [record('kA-0', 5, 'a@5')], []);
    const before = physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A);

    const rejected = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK_A, [
      { loopId: 'hold-empty', placementStart: 10, sourceKeyIds: [], repeat: 1, mode: 'static' },
    ]);
    expect(rejected).toEqual({ ok: false, error: 'empty-source-refs' });

    // Nothing was written: the clip collection and the record map are untouched.
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A)).toEqual(before);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A)).toHaveLength(1);
    expect(physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A)).not.toBeNull();

    // The exported validation closes the same way, document-shaped (46-03
    // re-pointing's second gate).
    expect(physicPaintStore.validateTrackHoldLoopClipRefs(LAYER, TRACK_A, {
      sourceFrameRefs: [],
      sourceKind: 'playscript-hold',
    })).toEqual({ ok: false, error: 'empty-source-refs' });
  });

  it('foreign refs rejected: a Hold clip on A referencing B\'s key fails closed foreign-refs and writes nothing', () => {
    seedTrack(TRACK_A, [record('kA-0', 5, 'a@5')], []);
    seedTrack(TRACK_B, [record('kB-0', 5, 'b@5')], []);
    const before = physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A);

    const rejected = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK_A, [
      { loopId: 'hold-foreign', placementStart: 10, sourceKeyIds: ['kB-0'], repeat: 1, mode: 'static' },
    ]);
    expect(rejected).toEqual({ ok: false, error: 'foreign-source-refs' });

    // Nothing was written on either track; A's own valid Hold still passes.
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A)).toEqual(before);
    const accepted = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, TRACK_A, [
      { loopId: 'hold-a', placementStart: 10, sourceKeyIds: ['kA-0'], repeat: 1, mode: 'static' },
    ]);
    expect(accepted.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A).map((clip) => clip.loopId)).toEqual(['hold-a']);

    // The exported validation is ref-based against the OWNING map only:
    // B's key is foreign on A, A's own key is fine under either sourceKind.
    expect(physicPaintStore.validateTrackHoldLoopClipRefs(LAYER, TRACK_A, {
      sourceFrameRefs: ['kB-0'],
      sourceKind: 'playscript-hold',
    })).toEqual({ ok: false, error: 'foreign-source-refs' });
    expect(physicPaintStore.validateTrackHoldLoopClipRefs(LAYER, TRACK_A, {
      sourceFrameRefs: ['kA-0'],
      sourceKind: 'playscript-hold',
    })).toEqual({ ok: true });
    expect(physicPaintStore.validateTrackHoldLoopClipRefs(LAYER, TRACK_A, {
      sourceFrameRefs: ['kA-0'],
      sourceKind: 'imported-background',
    })).toEqual({ ok: true });
  });

  it('missing source after create: deleting one source frame of a multi-source Hold turns the cycle unresolved and heals on re-add', () => {
    // Two sources at 5 and 7 → cycleLength 3; repeat 2 covers frames 10..15.
    seedTrack(TRACK_A, [record('kA-0', 5, 'a@5'), record('kA-1', 7, 'a@7')], [{ loopId: 'hold-a', placementStart: 10, sourceKeyIds: ['kA-0', 'kA-1'], repeat: 2 }]);
    let pair = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(resolvePhysicPaintRotoLoopFrame(pair!.context, 10)).toMatchObject({ kind: 'linked', sourceKeyId: 'kA-0' });
    expect(resolvePhysicPaintRotoLoopFrame(pair!.context, 12)).toMatchObject({ kind: 'linked', sourceKeyId: 'kA-1' });

    // Delete ONE source frame — the whole owned cycle fails closed unresolved,
    // naming exactly the missing key; never a dangling or partial answer. The
    // unresolved clip keeps its compact placeholder duration (cycleLength =
    // ref count = 2 → effectiveEnd 14), so the fail-closed window is 10..13
    // and the frames past it resolve 'empty', never a foreign answer.
    const deleted = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK_A, [record('kA-0', 5, 'a@5')], INTERPOLATION, CAPACITY);
    expect(deleted.ok).toBe(true);
    pair = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    for (const frame of [10, 11, 12, 13]) {
      const answer = resolvePhysicPaintRotoLoopFrame(pair!.context, frame);
      expect(answer).toMatchObject({ kind: 'linked-unresolved', loopId: 'hold-a', missingSourceKeyIds: ['kA-1'] });
      expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_A, frame)).toMatchObject({ kind: 'loop-placeholder' });
    }
    expect(resolvePhysicPaintRotoLoopFrame(pair!.context, 14)).toMatchObject({ kind: 'empty' });
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_A, 14)).toBeNull();

    // Re-adding a real key at the deleted frame heals the linked answers.
    const healed = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      TRACK_A,
      [record('kA-0', 5, 'a@5'), record('kA-1', 7, 'a@7')],
      INTERPOLATION,
      CAPACITY,
    );
    expect(healed.ok).toBe(true);
    pair = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(resolvePhysicPaintRotoLoopFrame(pair!.context, 10)).toMatchObject({ kind: 'linked', sourceKeyId: 'kA-0' });
    expect(resolvePhysicPaintRotoLoopFrame(pair!.context, 12)).toMatchObject({ kind: 'linked', sourceKeyId: 'kA-1' });
  });

  it('ordering: the boundary frame at the later clip\'s placementStart belongs to exactly one clip — stable over 10 repeat instances', () => {
    // C1: cycleLength 1 × repeat 10 → effectiveEnd 20, exactly C2's placementStart.
    seedTrack(TRACK_A, [record('k1-0', 0, 'a@0'), record('k2-0', 20, 'a@20')], [
      { loopId: 'c1', placementStart: 10, sourceKeyIds: ['k1-0'], repeat: 10 },
      { loopId: 'c2', placementStart: 20, sourceKeyIds: ['k2-0'], repeat: 2 },
    ]);
    const pair = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(pair).not.toBeNull();

    // The 10 repeat instances of C1 (frames 10..19): sourceIndex computed over
    // the own clip's cycle, deterministic repeatInstance per frame.
    for (let frame = 10; frame < 20; frame += 1) {
      expect(resolvePhysicPaintRotoLoopFrame(pair!.context, frame)).toMatchObject({
        kind: 'linked',
        loopId: 'c1',
        sourceKeyId: 'k1-0',
        sourceIndex: 0,
        repeatInstance: frame - 10,
      });
    }
    // The boundary frame belongs to the later clip alone: C2's own real key at
    // 20, and the cell after it is C2's first repeat — never C1.
    expect(resolvePhysicPaintRotoLoopFrame(pair!.context, 20)).toMatchObject({ kind: 'real', keyId: 'k2-0' });
    expect(resolvePhysicPaintRotoLoopFrame(pair!.context, 21)).toMatchObject({ kind: 'linked', loopId: 'c2', sourceKeyId: 'k2-0', repeatInstance: 1 });
    // At the render-source surface real/generated projection cells are the
    // authority: 19 is the projection interpolation cell toward k2-0, 20 is
    // k2-0's real cell, and 21 is C2's first linked repeat delivering the same
    // source key — the boundary still belongs to exactly one clip.
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_A, 19)?.kind).toBe('generated');
    const at20 = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_A, 20);
    expect(at20?.kind).toBe('real');
    if (at20 && at20.kind === 'real') expect(at20.keyId).toBe('k2-0');
    const at21 = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TRACK_A, 21);
    expect(at21?.kind).toBe('real');
    if (at21 && at21.kind === 'real') expect(at21.keyId).toBe('k2-0');
  });
});
