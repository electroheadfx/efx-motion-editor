import { beforeEach, describe, expect, it } from 'vitest';
import {
  bumpTrackRevision,
  getTrackPaintVersion,
  getTrackRotorRevision,
  mountTrackRuntime,
  physicPaintStore,
  physicPaintVersion,
  removeTrackRuntime,
  _setPhysicPaintMarkDirtyCallback,
} from './physicPaintStore';
import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { buildRotoRailSetCopyPayload } from '../components/physic-paint/roto/physicsPaintRotoRailSetCopy';

// 46-01 TRK-01 base law: the runtime store is addressed layerId -> trackId ->
// value. Editing one internal track never changes another track's real keys,
// frames, or caches. trackId is the stable UUID identity from the document —
// never an array index (Pitfall 1).
// Node env, vitest run only; no jsdom, no config changes.

const LAYER = 'layer-track-isolation';
const TRACK_A = 'track-a';
const TRACK_B = 'track-b';
const CAPACITY = 24;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

const makeFrame = (frameIndex: number, appFrame: number, tag: string) => ({
  frameIndex,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(tag)}`,
  width: 1000,
  height: 650,
});

const makePayload = (appFrame: number, tag: string): PhysicPaintRotoRealKeyPayload => ({
  frameIndex: 0,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(tag)}`,
  width: 4,
  height: 4,
});

const makeRecord = (keyId: string, appFrame: number, tag: string): PhysicPaintRotoRealKeyRecord => ({
  kind: 'real-key',
  keyId,
  appFrame,
  payload: makePayload(appFrame, tag),
});

/** A Hold (static-mode) Loop Clip whose source frames live on the same track. */
const makeLoop = (loopId: string, placementStart: number, sourceKeyIds: readonly string[]): PhysicPaintRotoLoopClip => ({
  loopId,
  placementStart,
  sourceKeyIds,
  repeat: 1,
  mode: 'static',
});

/** Seed one track with records + loops + runtime frames (records first — the
 *  loop/break ports require the record map to exist). */
function seedTrack(
  trackId: string,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loops: readonly PhysicPaintRotoLoopClip[] = [],
): void {
  const seeded = physicPaintStore.replaceRotoPhysicalRecords(LAYER, trackId, records, INTERPOLATION, CAPACITY);
  if (!seeded.ok) throw new Error(`Seed failed for ${trackId}: ${seeded.error}`);
  const loopsResult = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, trackId, loops);
  if (!loopsResult.ok) throw new Error(`Seed loops failed for ${trackId}: ${loopsResult.error}`);
  for (const record of records) {
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, trackId, record.appFrame, makeFrame(0, record.appFrame, `frame-${record.keyId}`));
  }
}

function requireCopy(layerId: string, trackId: string, keyIds: readonly string[]) {
  const copied = physicPaintStore.copyTrackSelection(layerId, trackId, keyIds);
  if (!copied.ok) throw new Error(`Copy must resolve: ${copied.reason}`);
  return copied.payload;
}

describe('physicPaintStore track isolation (46-01 TRK-01 base law)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('re-key accessors: a real key upserted on track A is invisible on track B', () => {
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, TRACK_A, 5, makeFrame(0, 5, 'frame-a-5'));

    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 5)?.dataUrl).toBe(makeFrame(0, 5, 'frame-a-5').dataUrl);
    expect(physicPaintStore.getFrame(LAYER, TRACK_B, 5)).toBeNull();
  });

  it('isolation law: editing track A at frame 5 leaves track B record payload byte-identical', () => {
    const seedB = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      TRACK_B,
      [makeRecord('key-b-5', 5, 'b@5')],
      INTERPOLATION,
      CAPACITY,
    );
    expect(seedB.ok).toBe(true);
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, TRACK_B, 5, makeFrame(0, 5, 'frame-b-5'));

    const seedA = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      TRACK_A,
      [makeRecord('key-a-5', 5, 'a@5')],
      INTERPOLATION,
      CAPACITY,
    );
    expect(seedA.ok).toBe(true);
    const revisionA = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK_A);
    expect(revisionA).toBeTruthy();

    // Edit track A at frame 5: upsert then payload update.
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, TRACK_A, 5, makeFrame(0, 5, 'frame-a-5'));
    const updated = physicPaintStore.updateRotoPhysicalRealKeyPayload(
      LAYER,
      TRACK_A,
      'key-a-5',
      revisionA!,
      makePayload(5, 'a@5-painted'),
    );
    expect(updated.ok).toBe(true);

    const recordsB = physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B);
    expect(recordsB).toHaveLength(1);
    expect(recordsB[0].payload.dataUrl).toBe(makePayload(5, 'b@5').dataUrl);
    const recordsA = physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A);
    expect(recordsA).toHaveLength(1);
    expect(recordsA[0].payload.dataUrl).toBe(makePayload(5, 'a@5-painted').dataUrl);
  });

  it('empty track: removing the last real key leaves an empty-but-present track addressable by trackId', () => {
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, TRACK_B, 5, makeFrame(0, 5, 'frame-b-5'));
    const seeded = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      TRACK_B,
      [makeRecord('key-b-5', 5, 'b@5')],
      INTERPOLATION,
      CAPACITY,
    );
    expect(seeded.ok).toBe(true);
    expect(physicPaintStore.hasTrackRuntime(LAYER, TRACK_B)).toBe(true);

    expect(physicPaintStore.removeRealRotoKeyFrame(LAYER, TRACK_B, 5)).toBe(true);
    const emptied = physicPaintStore.replaceRotoPhysicalRecords(LAYER, TRACK_B, [], INTERPOLATION, CAPACITY);
    expect(emptied.ok).toBe(true);

    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B)).toEqual([]);
    expect(physicPaintStore.getFrame(LAYER, TRACK_B, 5)).toBeNull();
    expect(physicPaintStore.hasTrackRuntime(LAYER, TRACK_B)).toBe(true);
  });

  it('ordering: records of one track sort appFrame ascending, ties by keyId localeCompare', () => {
    const seeded = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      TRACK_B,
      [makeRecord('key-10', 10, 'k10'), makeRecord('key-0', 0, 'k0'), makeRecord('key-5', 5, 'k5')],
      INTERPOLATION,
      CAPACITY,
    );
    expect(seeded.ok).toBe(true);

    const ordered = physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B);
    expect(ordered.map((record) => record.appFrame)).toEqual([0, 5, 10]);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A)).toEqual([]);
  });
});

describe('physicPaintStore per-track revision signals (46-01 TRK-03)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('per-track revision isolation: bumpTrackRevision on track A bumps A and the global clock, track B untouched', () => {
    const globalBefore = physicPaintVersion.value;
    const aPaintBefore = getTrackPaintVersion(LAYER, TRACK_A).value;
    const aRotoBefore = getTrackRotorRevision(LAYER, TRACK_A).value;
    const bPaintBefore = getTrackPaintVersion(LAYER, TRACK_B).value;
    const bRotoBefore = getTrackRotorRevision(LAYER, TRACK_B).value;

    bumpTrackRevision(LAYER, TRACK_A);

    expect(getTrackPaintVersion(LAYER, TRACK_A).value).toBe(aPaintBefore + 1);
    expect(getTrackRotorRevision(LAYER, TRACK_A).value).toBe(aRotoBefore + 1);
    expect(physicPaintVersion.value).toBe(globalBefore + 1);
    expect(getTrackPaintVersion(LAYER, TRACK_B).value).toBe(bPaintBefore);
    expect(getTrackRotorRevision(LAYER, TRACK_B).value).toBe(bRotoBefore);
  });

  it('fresh track runtime mounted by mountTrackRuntime reports the baseline revision and not-dirty', () => {
    let dirtyCount = 0;
    _setPhysicPaintMarkDirtyCallback(() => { dirtyCount += 1; });
    const globalBefore = physicPaintVersion.value;

    mountTrackRuntime(LAYER, TRACK_A);

    expect(getTrackPaintVersion(LAYER, TRACK_A).value).toBe(0);
    expect(getTrackRotorRevision(LAYER, TRACK_A).value).toBe(0);
    expect(physicPaintVersion.value).toBe(globalBefore);
    expect(dirtyCount).toBe(0);
  });

  it('per-track dirty law: one mutation fires the injected dirty callback exactly once and bumps the global paint version', () => {
    let dirtyCount = 0;
    _setPhysicPaintMarkDirtyCallback(() => { dirtyCount += 1; });
    const globalBefore = physicPaintVersion.value;
    const beforeA = getTrackPaintVersion(LAYER, TRACK_A).value;

    const seeded = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      TRACK_A,
      [makeRecord('key-a-5', 5, 'a@5')],
      INTERPOLATION,
      CAPACITY,
    );
    expect(seeded.ok).toBe(true);

    expect(dirtyCount).toBe(1);
    expect(physicPaintVersion.value).toBe(globalBefore + 1);
    expect(getTrackPaintVersion(LAYER, TRACK_A).value).toBe(beforeA + 1);
    expect(getTrackPaintVersion(LAYER, TRACK_B).value).toBe(0);
  });
});

describe('physicPaintStore track-scoped operation leases (46-01 TRK-03 Task 3)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('lease scope: track A and track B each hold an exclusive lease on the same layer, with cross-track validation rejected', () => {
    const leaseA = physicPaintStore.acquireRotoPhysicalOperationLease('project-leases', LAYER, TRACK_A);
    expect(leaseA).toMatchObject({ projectContextId: 'project-leases', layerId: LAYER, trackId: TRACK_A, owner: 'exclusive' });
    const leaseB = physicPaintStore.acquireRotoPhysicalOperationLease('project-leases', LAYER, TRACK_B);
    expect(leaseB, 'a second track on the same layer acquires its own lease').not.toBeNull();

    expect(physicPaintStore.isRotoPhysicalOperationAvailable('project-leases', LAYER, TRACK_A)).toBe(false);
    expect(physicPaintStore.isRotoPhysicalOperationAvailable('project-leases', LAYER, TRACK_B)).toBe(false);

    expect(physicPaintStore.validateRotoPhysicalOperationLease('project-leases', LAYER, TRACK_B, leaseA!)).toEqual({ ok: false, reason: 'mismatched-token' });
    expect(physicPaintStore.validateRotoPhysicalOperationLease('project-leases', LAYER, TRACK_A, leaseA!)).toEqual({ ok: true });
    expect(physicPaintStore.validateRotoPhysicalOperationLease('project-leases', LAYER, TRACK_B, leaseB!)).toEqual({ ok: true });

    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseA!)).toBe(true);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseB!)).toBe(true);
    expect(physicPaintStore.isRotoPhysicalOperationAvailable('project-leases', LAYER, TRACK_A)).toBe(true);
    expect(physicPaintStore.isRotoPhysicalOperationAvailable('project-leases', LAYER, TRACK_B)).toBe(true);
  });

  it('track teardown: removeTrackRuntime clears B frames, records, caches, selection, leases, and memo entries while A stays untouched', () => {
    const seedA = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      TRACK_A,
      [makeRecord('key-a-0', 0, 'a@0')],
      INTERPOLATION,
      CAPACITY,
    );
    expect(seedA.ok).toBe(true);
    const seedB = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER,
      TRACK_B,
      [makeRecord('key-b-0', 0, 'b@0')],
      INTERPOLATION,
      CAPACITY,
    );
    expect(seedB.ok).toBe(true);
    physicPaintStore.upsertRealRotoKeyFrame(LAYER, TRACK_B, 0, makeFrame(0, 0, 'frame-b-0'));
    physicPaintStore.setRotoPhysicalSelection(LAYER, TRACK_B, 'key-b-0', 0);
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TRACK_B)).not.toBeNull();
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK_B)).toMatch(/^physical-/);
    const bRotorRevisionBefore = getTrackRotorRevision(LAYER, TRACK_B).value;
    expect(bRotorRevisionBefore).toBeGreaterThan(0);

    const leaseB = physicPaintStore.acquireRotoPhysicalOperationLease('project-teardown', LAYER, TRACK_B);
    expect(leaseB).not.toBeNull();

    expect(removeTrackRuntime(LAYER, TRACK_B)).toBe(true);
    expect(physicPaintStore.hasTrackRuntime(LAYER, TRACK_B)).toBe(false);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B)).toEqual([]);
    expect(physicPaintStore.getFrame(LAYER, TRACK_B, 0)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER, TRACK_B)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK_B)).toBeNull();
    expect(physicPaintStore.validateRotoPhysicalOperationLease('project-teardown', LAYER, TRACK_B, leaseB!)).toEqual({ ok: false, reason: 'replayed-token' });

    expect(physicPaintStore.hasTrackRuntime(LAYER, TRACK_A)).toBe(true);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A)).toHaveLength(1);

    expect(removeTrackRuntime(LAYER, TRACK_B), 'a second teardown of the same track is a no-op').toBe(false);
    // The trackRevisions entry was deleted with the runtime; the next read lazily
    // recreates it at the clean baseline 0 (TRK-03 mount semantics). Read it only
    // after the no-op assertion above so the entry is absent during that call.
    expect(getTrackRotorRevision(LAYER, TRACK_B).value).toBe(0);
  });

  it('empty-keep: removeTrackRuntime on a never-mounted track is a no-op returning false without throwing', () => {
    expect(removeTrackRuntime(LAYER, 'track-never-mounted')).toBe(false);
    expect(physicPaintStore.hasTrackRuntime(LAYER, 'track-never-mounted')).toBe(false);
  });
});

describe('physicPaintStore track-scoped copy/paste/duplicate/clear (46-03 Task 1)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('same-track copy/paste: fresh keyIds/loopIds (never S\'s ids) and identical payload bytes', () => {
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0'), makeRecord('k2', 2, 'a@2')], [makeLoop('hold-a', 0, ['k0'])]);
    const payload = requireCopy(LAYER, TRACK_A, ['k0']);
    // The selection copies its key rail AND the Hold loop fully covered by it.
    expect(payload.members.map((member) => member.kind)).toEqual(['key-rail', 'loop']);
    expect(payload.sourceTrackId).toBe(TRACK_A);

    physicPaintStore.setRotoPhysicalSelection(LAYER, TRACK_A, null, 10);
    const pasted = physicPaintStore.pasteTrackSelection(LAYER, TRACK_A, payload);
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`Paste must resolve: ${pasted.reason}`);

    const records = physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A);
    const fresh = records.filter((record) => record.keyId !== 'k0' && record.keyId !== 'k2');
    expect(fresh).toHaveLength(2);
    expect(fresh.map((record) => record.appFrame).sort((a, b) => a - b)).toEqual([10, 12]);
    // Fresh identities never reuse the source ids.
    expect(fresh.every((record) => !['k0', 'k2'].includes(record.keyId))).toBe(true);
    // Identical payload bytes, relocated onto the fresh frames.
    const sourcePayloads = new Map([
      [10, makePayload(0, 'a@0').dataUrl],
      [12, makePayload(2, 'a@2').dataUrl],
    ]);
    for (const record of fresh) expect(record.payload.dataUrl).toBe(sourcePayloads.get(record.appFrame));
    // Fresh loop identity; the same-track paste keeps source references verbatim.
    const clips = physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A);
    const freshClips = clips.filter((clip) => clip.loopId !== 'hold-a');
    expect(freshClips).toHaveLength(1);
    expect(freshClips[0].loopId).not.toBe('hold-a');
    expect(freshClips[0].sourceKeyIds).toEqual(['k0']);
  });

  it('cross-track paste isolation: pasting A\'s selection into B changes B only; A records, caches, and revisions stay byte-identical', () => {
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0'), makeRecord('k2', 2, 'a@2')], [makeLoop('hold-a', 0, ['k0'])]);
    seedTrack(TRACK_B, [makeRecord('b5', 5, 'b@5')], []);
    const documentABefore = physicPaintStore.getRotoPhysicalDocument(LAYER, TRACK_A);
    const revisionABefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK_A);
    const frameABefore = physicPaintStore.getFrame(LAYER, TRACK_A, 0);

    const payload = requireCopy(LAYER, TRACK_A, ['k0']);
    physicPaintStore.setRotoPhysicalSelection(LAYER, TRACK_B, null, 20);
    const pasted = physicPaintStore.pasteTrackSelection(LAYER, TRACK_B, payload);
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`Cross-track paste must resolve: ${pasted.reason}`);

    // B changed only: base record untouched, fresh records at 20/22.
    const recordsB = physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B);
    expect(recordsB.map((record) => record.appFrame).sort((a, b) => a - b)).toEqual([5, 20, 22]);
    expect(recordsB.find((record) => record.appFrame === 5)?.keyId).toBe('b5');
    // A byte-identical: document, content revision, and runtime frames.
    expect(physicPaintStore.getRotoPhysicalDocument(LAYER, TRACK_A)).toEqual(documentABefore);
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK_A)).toBe(revisionABefore);
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 0)).toEqual(frameABefore);
  });

  it('cross-track Hold re-pointing: pasted Hold references the destination\'s copied frames, never A\'s key ids', () => {
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0')], [makeLoop('hold-a', 0, ['k0'])]);
    seedTrack(TRACK_B, [makeRecord('b5', 5, 'b@5')], []);
    const payload = requireCopy(LAYER, TRACK_A, ['k0']);

    physicPaintStore.setRotoPhysicalSelection(LAYER, TRACK_B, null, 10);
    const pasted = physicPaintStore.pasteTrackSelection(LAYER, TRACK_B, payload);
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`paste must resolve: ${pasted.reason}`);

    const clipsB = physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_B);
    expect(clipsB).toHaveLength(1);
    const rePointed = clipsB[0];
    expect(rePointed.loopId).not.toBe('hold-a');
    expect(rePointed.placementStart).toBe(10);
    const freshKey = physicPaintStore.getRotoRealKeyRecordByAppFrame(LAYER, TRACK_B, 10);
    expect(freshKey).not.toBeNull();
    // The reference points at the destination's own copied frame.
    expect(rePointed.sourceKeyIds).toEqual([freshKey!.keyId]);
    expect(rePointed.sourceKeyIds).not.toContain('k0');
    // Nothing on A changed.
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A)).toHaveLength(1);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A)).toHaveLength(1);
  });

  it('reject not dangle: a payload whose Hold source frame is outside the pasted set fails closed with zero mutation', () => {
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0'), makeRecord('k1', 1, 'a@1')], [makeLoop('hold', 0, ['k0', 'k1'])]);
    seedTrack(TRACK_B, [makeRecord('b5', 5, 'b@5')], []);
    // Split the contiguous rail with a break on k1 so k0's segment carries k0
    // only: the Hold then references a source (k1) that is NOT part of the
    // pasted key set.
    const breaks = physicPaintStore.replaceRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TRACK_A, ['k1']);
    if (!breaks.ok) throw new Error(`Break seed failed: ${breaks.error}`);
    // Hand-build a payload that carries a Hold whose source key (k1) is NOT
    // part of the pasted key set — the engine must reject it, never write a
    // dangling cross-track reference (defensive; the clipboard never produces
    // one, because the store's copy only carries fully-covered Hold).
    const built = buildRotoRailSetCopyPayload({
      document: physicPaintStore.getRotoPhysicalDocument(LAYER, TRACK_A)!,
      members: [
        { kind: 'key-rail', firstKeyId: 'k0' },
        { kind: 'loop', loopId: 'hold' },
      ],
      trackId: TRACK_A,
    });
    if (!built.ok) throw new Error(`Payload must build: ${built.reason}`);
    physicPaintStore.setRotoPhysicalSelection(LAYER, TRACK_B, null, 10);
    const pasted = physicPaintStore.pasteTrackSelection(LAYER, TRACK_B, built.payload);
    expect(pasted.ok).toBe(false);
    if (pasted.ok) throw new Error('Un-re-pointable paste must reject');
    expect(pasted.reason).toBe('loop-source-outside-pasted-set');
    // Zero mutation on B.
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B).map((record) => record.appFrame)).toEqual([5]);
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_B)).toEqual([]);
  });

  it('deep-copy assets: the pasted frames own their bytes; deleting the destination leaves A intact', () => {
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0')], [makeLoop('hold-a', 0, ['k0'])]);
    seedTrack(TRACK_B, [makeRecord('b5', 5, 'b@5')], []);
    const payload = requireCopy(LAYER, TRACK_A, ['k0']);
    physicPaintStore.setRotoPhysicalSelection(LAYER, TRACK_B, null, 10);
    const pasted = physicPaintStore.pasteTrackSelection(LAYER, TRACK_B, payload);
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`paste must resolve: ${pasted.reason}`);
    // B's pasted frame holds the source bytes (deep copy, owned by B).
    expect(physicPaintStore.getFrame(LAYER, TRACK_B, 10)?.dataUrl).toBe(makePayload(0, 'a@0').dataUrl);
    // Deleting B leaves A untouched.
    expect(removeTrackRuntime(LAYER, TRACK_B)).toBe(true);
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 0)?.dataUrl).toBe(makeFrame(0, 0, 'frame-k0').dataUrl);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A)).toHaveLength(1);
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A)).toHaveLength(1);
  });

  it('clearTrackFrames removes only the target track\'s frames + records; the sibling track\'s cache paths untouched', () => {
    seedTrack(TRACK_A, [makeRecord('k5', 5, 'a@5'), makeRecord('k6', 6, 'a@6')], []);
    seedTrack(TRACK_B, [makeRecord('k5', 5, 'b@5')], []);
    const cleared = physicPaintStore.clearTrackFrames(LAYER, TRACK_A, [5, 6]);
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) throw new Error(`clear must resolve: ${cleared.reason}`);
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 5)).toBeNull();
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 6)).toBeNull();
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A)).toEqual([]);
    // B's cache path and record at the same frame are untouched.
    expect(physicPaintStore.getFrame(LAYER, TRACK_B, 5)?.dataUrl).toBe(makeFrame(0, 5, 'frame-k5').dataUrl);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B)).toHaveLength(1);
  });

  it('cutTrackSelection copies and removes the selection; cut fails closed on partial loop overlap', () => {
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0'), makeRecord('k2', 2, 'a@2')], [makeLoop('hold-a', 0, ['k0'])]);
    const cut = physicPaintStore.cutTrackSelection(LAYER, TRACK_A, ['k0']);
    expect(cut.ok).toBe(true);
    if (!cut.ok) throw new Error(`cut must resolve: ${cut.reason}`);
    expect(cut.payload.members.map((member) => member.kind)).toEqual(['key-rail', 'loop']);
    // The source lost the selected key (and only that key — k2 survives), its
    // frame, and the carried Hold.
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A).map((record) => record.appFrame)).toEqual([2]);
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A)).toEqual([]);
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 0)).toBeNull();

    // Partial overlap: cutting k0 alone when the Hold also references k1 must
    // fail closed with zero mutation (a dangling Hold can never be written).
    seedTrack(TRACK_B, [makeRecord('k0', 0, 'b@0'), makeRecord('k1', 1, 'b@1')], [makeLoop('hold-b', 0, ['k0', 'k1'])]);
    const partialCut = physicPaintStore.cutTrackSelection(LAYER, TRACK_B, ['k0']);
    expect(partialCut.ok).toBe(false);
    if (partialCut.ok) throw new Error('Partial-overlap cut must fail closed');
    expect(partialCut.reason).toBe('partial-loop-overlap');
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B)).toHaveLength(2);
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_B)).toHaveLength(1);
  });

  it('duplicateTrackFrames duplicates at the derived anchor with fresh identities', () => {
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0'), makeRecord('k2', 2, 'a@2')], [makeLoop('hold-a', 0, ['k0'])]);
    const duplicated = physicPaintStore.duplicateTrackFrames(LAYER, TRACK_A, [0, 2]);
    expect(duplicated.ok).toBe(true);
    if (!duplicated.ok) throw new Error(`duplicate must resolve: ${duplicated.reason}`);
    const records = physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A);
    const fresh = records.filter((record) => record.keyId !== 'k0' && record.keyId !== 'k2');
    // Duplicate scan: last set end 2 → first fitting anchor 4 → fresh 4/6.
    expect(fresh.map((record) => record.appFrame).sort((a, b) => a - b)).toEqual([4, 6]);
    expect(fresh.every((record) => !['k0', 'k2'].includes(record.keyId))).toBe(true);
    // The covered Hold is duplicated with a fresh loop identity (same-track verbatim sources).
    const clips = physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_A);
    expect(clips).toHaveLength(2);
    const freshClip = clips.find((clip) => clip.loopId !== 'hold-a')!;
    expect(freshClip.sourceKeyIds).toEqual(['k0']);
    expect(freshClip.placementStart).toBe(4);
  });
});
