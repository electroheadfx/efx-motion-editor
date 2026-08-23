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
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

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
