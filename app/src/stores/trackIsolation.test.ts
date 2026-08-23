import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { resolvePhysicPaintRotoLoopFrame } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import { defaultTransform, type Layer } from '../types/layer';
import { layerStore } from './layerStore';
import { projectStore } from './projectStore';
import { sequenceStore } from './sequenceStore';
import { getDocument, registerDocument, reset as resetEfxPaintStore } from './efxPaintStore';
import { createEfxPaintDocument, type EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildEfxPaintTrackRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoPhysicalDocument,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoAuthorityResult } from '../types/physicPaint';
import { applyPhysicPaintPayload, getPhysicPaintRotoAuthority } from '../lib/physicPaintBridge';

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

/**
 * 46-03 Task 2 equivalence normalization: the move and the cut-then-paste
 * branches allocate fresh keyIds/loopIds at random, so the comparison maps
 * every track-local identity onto its appFrame (identity-free shape). Bytes,
 * timing, loop placement/sources, and breaks must be EXACTLY equal between the
 * two branches; the revision hash and cursor are excluded (fresh per write).
 */
function normalizeTrackDocument(trackId: string): {
  readonly records: readonly { appFrame: number; dataUrl: string }[];
  readonly loops: readonly { placementStart: number; sourceAppFrames: readonly number[] }[];
  readonly breaks: readonly number[];
} {
  const document = physicPaintStore.getRotoPhysicalDocument(LAYER, trackId)!;
  const frameByKeyId = new Map(document.realKeyRecords.map((record) => [record.keyId, record.appFrame]));
  const records = [...document.realKeyRecords]
    .sort((left, right) => left.appFrame - right.appFrame)
    .map((record) => ({ appFrame: record.appFrame, dataUrl: record.payload.dataUrl }));
  const loops = [...document.loopClips]
    .sort((left, right) => left.placementStart - right.placementStart)
    .map((clip) => ({
      placementStart: clip.placementStart,
      sourceAppFrames: [...clip.sourceKeyIds].map((keyId) => frameByKeyId.get(keyId) ?? -1),
    }));
  const breaks = [...document.incomingInterpolationBreakKeyIds]
    .map((keyId) => frameByKeyId.get(keyId) ?? -1)
    .sort((left, right) => left - right);
  return { records, loops, breaks };
}

describe('physicPaintStore moveTrackItems (46-03 Task 2 — D-08/D-09)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('RED: move removes the items from the source and adds fresh-identity copies at the same appFrames', () => {
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0'), makeRecord('k2', 2, 'a@2')], []);
    seedTrack(TRACK_B, [], []);

    const moved = physicPaintStore.moveTrackItems(LAYER, TRACK_A, TRACK_B, ['k0']);
    expect(moved.ok).toBe(true);
    if (!moved.ok) throw new Error(`move must resolve: ${moved.reason}`);

    // Destination: fresh-identity copy at the same appFrame, owning the source bytes.
    const destination = physicPaintStore.getRotoRealKeyRecordByAppFrame(LAYER, TRACK_B, 0);
    expect(destination).not.toBeNull();
    expect(destination!.keyId).not.toBe('k0');
    expect(destination!.payload.dataUrl).toBe(makePayload(0, 'a@0').dataUrl);
    expect(physicPaintStore.getFrame(LAYER, TRACK_B, 0)?.dataUrl).toBe(makePayload(0, 'a@0').dataUrl);

    // Source: k0's record, frame, and cache path are gone; k2 untouched.
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A).map((record) => record.appFrame)).toEqual([2]);
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 0)).toBeNull();
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 2)?.dataUrl).toBe(makeFrame(0, 2, 'frame-k2').dataUrl);
  });

  it('RED: move equals cut-then-paste — destination matches the cut payload pasted at its anchor, source matches the cut effect', () => {
    const seedBoth = () => {
      seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0'), makeRecord('k2', 2, 'a@2')], [makeLoop('hold-a', 0, ['k0'])]);
      seedTrack(TRACK_B, [], []);
    };

    // Branch 1: the move primitive.
    seedBoth();
    const moved = physicPaintStore.moveTrackItems(LAYER, TRACK_A, TRACK_B, ['k0']);
    expect(moved.ok).toBe(true);
    if (!moved.ok) throw new Error(`move must resolve: ${moved.reason}`);
    const movedDestination = normalizeTrackDocument(TRACK_B);
    const movedSource = normalizeTrackDocument(TRACK_A);

    // Branch 2: cut then paste (the move's definition, D-09).
    physicPaintStore.reset();
    seedBoth();
    const cut = physicPaintStore.cutTrackSelection(LAYER, TRACK_A, ['k0']);
    expect(cut.ok).toBe(true);
    if (!cut.ok) throw new Error(`cut must resolve: ${cut.reason}`);
    const pasted = physicPaintStore.pasteTrackSelection(LAYER, TRACK_B, cut.payload, cut.payload.anchorAppFrame);
    expect(pasted.ok).toBe(true);
    if (!pasted.ok) throw new Error(`paste must resolve: ${pasted.reason}`);
    const pastedDestination = normalizeTrackDocument(TRACK_B);
    const cutSource = normalizeTrackDocument(TRACK_A);

    // Identity-free equality: same frames, same bytes, same re-pointed Hold, same breaks.
    expect(movedDestination).toEqual(pastedDestination);
    expect(movedSource).toEqual(cutSource);
  });

  it('RED: a covered Hold re-points onto the destination fresh frames; a colliding move fails closed with the source untouched', () => {
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0'), makeRecord('k1', 1, 'a@1')], [makeLoop('hold-a', 0, ['k0', 'k1'])]);
    seedTrack(TRACK_B, [], []);

    const moved = physicPaintStore.moveTrackItems(LAYER, TRACK_A, TRACK_B, ['k0', 'k1']);
    expect(moved.ok).toBe(true);
    if (!moved.ok) throw new Error(`move must resolve: ${moved.reason}`);

    // The Hold travelled with fresh identity and its sources re-pointed to the
    // destination's own fresh keys (never the source keyIds).
    const clipsB = physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK_B);
    expect(clipsB).toHaveLength(1);
    const movedClip = clipsB[0];
    expect(movedClip.loopId).not.toBe('hold-a');
    const frameByKeyId = new Map(
      physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B).map((record) => [record.keyId, record.appFrame]),
    );
    expect(movedClip.sourceKeyIds.map((keyId) => frameByKeyId.get(keyId))).toEqual([0, 1]);
    expect(movedClip.sourceKeyIds).not.toContain('k0');
    expect(movedClip.placementStart).toBe(0);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A)).toEqual([]);

    // Fail-closed: a destination already owning frame 0 makes the paste half
    // impossible — the move rejects and the source stays byte-identical.
    physicPaintStore.reset();
    seedTrack(TRACK_A, [makeRecord('k0', 0, 'a@0')], []);
    seedTrack(TRACK_B, [makeRecord('b0', 0, 'b@0')], []);
    const colliding = physicPaintStore.moveTrackItems(LAYER, TRACK_A, TRACK_B, ['k0']);
    expect(colliding.ok).toBe(false);
    if (colliding.ok) throw new Error('A colliding move must fail closed');
    expect(colliding.reason).toBe('duplicate-destination-frame');
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A).map((record) => record.appFrame)).toEqual([0]);
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 0)?.dataUrl).toBe(makeFrame(0, 0, 'frame-k0').dataUrl);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B)).toHaveLength(1);
    expect(physicPaintStore.getFrame(LAYER, TRACK_B, 0)?.dataUrl).toBe(makeFrame(0, 0, 'frame-b0').dataUrl);
  });
});

/**
 * 46-06 Task 1 (TRK-02): the track-local Hold Loop Clip laws on top of the
 * shared resolver. Every Hold cell must answer from its owning track's live
 * records — a clip on A never resolves against B's records — empty tracks
 * answer 'linked-unresolved' (never a foreign frame, never a fabricated base),
 * half-open placementStart boundaries belong to exactly one clip, the
 * store-built context carries track provenance, and linked answers are virtual
 * query results that never persist.
 */
describe('physicPaintStore track-local Hold resolution context (46-06 Task 1 — TRK-02)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('adjacency: two tracks holding a Hold Loop Clip at the same appFrame each answer their own loopId/sourceKeyId — the A answer never shows B\'s', () => {
    seedTrack(TRACK_A, [makeRecord('kA-0', 5, 'a@5')], [makeLoop('hold-a', 10, ['kA-0'])]);
    seedTrack(TRACK_B, [makeRecord('kB-0', 5, 'b@5')], [makeLoop('hold-b', 10, ['kB-0'])]);

    const contextA = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    const contextB = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_B);
    expect(contextA).not.toBeNull();
    expect(contextB).not.toBeNull();
    expect(contextA!.trackId).toBe(TRACK_A);
    expect(contextB!.trackId).toBe(TRACK_B);

    const answerA = resolvePhysicPaintRotoLoopFrame(contextA!.context, 10);
    const answerB = resolvePhysicPaintRotoLoopFrame(contextB!.context, 10);
    expect(answerA).toMatchObject({ kind: 'linked', loopId: 'hold-a', sourceKeyId: 'kA-0' });
    expect(answerB).toMatchObject({ kind: 'linked', loopId: 'hold-b', sourceKeyId: 'kB-0' });
    expect(answerA.kind === 'linked' ? answerA.loopId : '').not.toBe('hold-b');
    expect(answerB.kind === 'linked' ? answerB.loopId : '').not.toBe('hold-a');
    // The two answers are byte-different when the clips are.
    expect(JSON.stringify(answerA)).not.toBe(JSON.stringify(answerB));
  });

  it('empty: a track with a Hold clip but zero real keys answers every clip cell linked-unresolved — never a foreign frame, never a fabricated base', () => {
    // The sibling track's real key must never leak into A's answer.
    seedTrack(TRACK_B, [makeRecord('kB-0', 5, 'b@5')], []);
    seedTrack(TRACK_A, [], [makeLoop('hold-a', 10, ['kA-0'])]);

    const contextA = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(contextA).not.toBeNull();
    const answer = resolvePhysicPaintRotoLoopFrame(contextA!.context, 10);
    expect(answer).toMatchObject({
      kind: 'linked-unresolved',
      loopId: 'hold-a',
      placementStart: 10,
      missingSourceKeyIds: ['kA-0'],
    });
    // Never a foreign-track frame and never a fabricated base: the answer
    // carries no sourceKeyId at all.
    expect('sourceKeyId' in answer).toBe(false);
    expect(answer.kind).not.toBe('real');
  });

  it('ordering: half-open boundaries — the frame at the next clip\'s placementStart belongs to the next clip, never both', () => {
    seedTrack(TRACK_A, [makeRecord('k1-0', 0, 'a@0'), makeRecord('k2-0', 20, 'a@20')], [
      { loopId: 'c1', placementStart: 10, sourceKeyIds: ['k1-0'], repeat: 10, mode: 'static' },
      { loopId: 'c2', placementStart: 20, sourceKeyIds: ['k2-0'], repeat: 2, mode: 'static' },
    ]);

    const context = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(context).not.toBeNull();
    // The frame just before the next placement start is C1's last repeat
    // instance; the frame AT the next placement start is C2's own real key.
    const at19 = resolvePhysicPaintRotoLoopFrame(context!.context, 19);
    expect(at19).toMatchObject({ kind: 'linked', loopId: 'c1', sourceKeyId: 'k1-0', repeatInstance: 9 });
    const at20 = resolvePhysicPaintRotoLoopFrame(context!.context, 20);
    expect(at20).toMatchObject({ kind: 'real', keyId: 'k2-0' });
    // No overlap and no gap inside the union: every frame answers exactly one clip.
    const at21 = resolvePhysicPaintRotoLoopFrame(context!.context, 21);
    expect(at21).toMatchObject({ kind: 'linked', loopId: 'c2', sourceKeyId: 'k2-0', repeatInstance: 1 });
    const answers = [10, 15, 19, 20, 21].map((frame) => resolvePhysicPaintRotoLoopFrame(context!.context, frame));
    expect(answers.every((answer) => answer.kind === 'linked' || answer.kind === 'real')).toBe(true);
  });

  it('context provenance: the context the store builds for track A contains no loopId and no keyId owned by track B', () => {
    seedTrack(TRACK_A, [makeRecord('kA-0', 5, 'a@5')], [makeLoop('hold-a', 10, ['kA-0'])]);
    seedTrack(TRACK_B, [makeRecord('kB-0', 5, 'b@5')], [makeLoop('hold-b', 10, ['kB-0'])]);

    const contextA = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(contextA).not.toBeNull();
    expect(contextA!.context.ranges.map((range) => range.loopId)).toEqual(['hold-a']);
    for (const range of contextA!.context.ranges) {
      expect(range.sourceKeyIds).not.toContain('kB-0');
      expect(range.sourceKeyIds).toEqual(['kA-0']);
    }
    expect(contextA!.context.keyIdByAppFrame.get(5)).toBe('kA-0');
    // No B-owned frame is indexed in A's context.
    expect(contextA!.context.keyIdByAppFrame.get(20)).toBeUndefined();
  });

  it('virtual-only: no linked or linked-unresolved resolution is ever persisted — frames, cache, projection, and document stay virtual', () => {
    seedTrack(TRACK_A, [makeRecord('kA-0', 5, 'a@5')], [makeLoop('hold-a', 10, ['kA-0'])]);
    const contextA = physicPaintStore.getTrackRotoResolutionContext(LAYER, TRACK_A);
    expect(contextA).not.toBeNull();
    expect(resolvePhysicPaintRotoLoopFrame(contextA!.context, 10)).toMatchObject({ kind: 'linked' });

    // The projection only ever contains real/generated/empty cells — never a
    // virtual 'linked' kind.
    const projection = physicPaintStore.getRotoPhysicalProjection(LAYER, TRACK_A);
    expect(projection).not.toBeNull();
    expect(projection!.cells.every((cell) => cell.kind === 'real' || cell.kind === 'generated' || cell.kind === 'empty')).toBe(true);
    // No persisted runtime frame exists at the virtual frame.
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 10)).toBeNull();
    expect(physicPaintStore.getFrames(LAYER, TRACK_A).has(10)).toBe(false);
    // The persisted document carries the clip's source records, never a
    // resolved answer. (The canonical clip parse attaches the group-lifecycle
    // enrichment fields — syncState/provenanceState/visibleRanges/... — so
    // assert the persistent source fields, not the full enriched shape.)
    const persisted = physicPaintStore.getRotoPhysicalDocument(LAYER, TRACK_A)!.loopClips;
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      loopId: 'hold-a',
      placementStart: 10,
      sourceKeyIds: ['kA-0'],
      repeat: 1,
      mode: 'static',
    });
  });
});

/**
 * 46-04 Task 3 (TRK-06 edge, T-46-10): the per-track stale-async law proof.
 * The async commit authority is three-dimensional (Task 1) and the commit gate
 * revalidates the captured terms (Task 2); these four laws prove the isolation
 * under concurrent track activity — a commit in flight on track A is gated only
 * by A's captured track term, never by a foreign track's edit nor by the
 * global paint clock.
 */
describe('physicPaintBridge per-track stale-async law (46-04 Task 3)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    resetEfxPaintStore();
    sequenceStore.sequences.value = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const physicLayer = (): Layer => ({
    id: LAYER,
    name: 'Physics Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: LAYER },
  });

  /** Parent authority harness: layer store, overlay store, and the layer's sequence. */
  function mockParentAuthority(): void {
    vi.spyOn(layerStore.layers, 'peek').mockReturnValue([physicLayer()]);
    vi.spyOn(layerStore.overlayLayers, 'peek').mockReturnValue([]);
    sequenceStore.sequences.value = [{
      id: 'stale-async-parent-sequence',
      kind: 'fx',
      name: 'Authority parent',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [physicLayer()],
      inFrame: 0,
      outFrame: 600,
    }];
  }

  /** Canonical per-track physical snapshot stored inside the document's tracks. */
  function buildTrackPhysicalSnapshot(records: readonly PhysicPaintRotoRealKeyRecord[]): PhysicPaintRotoPhysicalDocument {
    return {
      capacity: CAPACITY,
      realKeyRecords: Object.freeze([...records]),
      interpolation: Object.freeze(INTERPOLATION),
      scriptMotion: Object.freeze({ deformation: 0, position: 0 }),
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], []),
      loopClips: Object.freeze([]),
      incomingInterpolationBreakKeyIds: Object.freeze([]),
    };
  }

  /** Two-track document where both tracks carry their own physical snapshot. */
  function makeTwoTrackAuthorityDocument(
    activeTrackId: string,
    aRecords: readonly PhysicPaintRotoRealKeyRecord[],
    bRecords: readonly PhysicPaintRotoRealKeyRecord[],
  ): EfxPaintDocument {
    const base = createEfxPaintDocument(LAYER);
    const trackA = Object.freeze({
      ...base.tracks[0],
      id: TRACK_A,
      name: 'Track A',
      order: 0,
      rotoPhysical: Object.freeze(buildTrackPhysicalSnapshot(aRecords)),
    });
    const trackB = Object.freeze({
      ...base.tracks[0],
      id: TRACK_B,
      name: 'Track B',
      order: 1,
      rotoPhysical: Object.freeze(buildTrackPhysicalSnapshot(bRecords)),
    });
    return Object.freeze({
      ...base,
      activeTrackId,
      tracks: Object.freeze([trackA, trackB]),
    });
  }

  function registerTwoTrackAuthorityDocument(
    aRecords: readonly PhysicPaintRotoRealKeyRecord[],
    bRecords: readonly PhysicPaintRotoRealKeyRecord[],
    activeTrackId = TRACK_A,
  ): void {
    registerDocument(makeTwoTrackAuthorityDocument(activeTrackId, aRecords, bRecords));
  }

  /** Mount one track's runtime: records + capacity + interpolation (46-01 maps). */
  function seedRuntime(trackId: string, records: readonly PhysicPaintRotoRealKeyRecord[]): void {
    const seeded = physicPaintStore.replaceRotoPhysicalRecords(LAYER, trackId, records, INTERPOLATION, CAPACITY);
    if (!seeded.ok) throw new Error(`Runtime seed failed for ${trackId}: ${seeded.error}`);
  }

  function seedTwoTrackState(
    aRecords: readonly PhysicPaintRotoRealKeyRecord[],
    bRecords: readonly PhysicPaintRotoRealKeyRecord[],
  ): void {
    registerTwoTrackAuthorityDocument(aRecords, bRecords);
    mockParentAuthority();
    seedRuntime(TRACK_A, aRecords);
    seedRuntime(TRACK_B, bRecords);
  }

  function capture(trackId: string, canonicalStart = 2): PhysicPaintRotoAuthorityResult {
    const authority = getPhysicPaintRotoAuthority({
      operationId: `stale-async-capture-${crypto.randomUUID()}`,
      projectContextId: projectStore.projectContextId.peek(),
      layerId: LAYER,
      canonicalStart,
      trackId,
    });
    if (!authority.ok) throw new Error(`Authority must succeed for ${trackId}: ${authority.error}`);
    return authority;
  }

  /** Complete-set commit batch for the captured authority (targets its track). */
  function buildBatch(
    authority: PhysicPaintRotoAuthorityResult,
    options: { trackId?: string; tag?: string } = {},
  ): Record<string, unknown> {
    const trackId = options.trackId ?? TRACK_A;
    const tag = options.tag ?? 'a@2';
    return {
      kind: 'replace-roto-key-frames',
      trackId,
      operationId: `stale-async-commit-${crypto.randomUUID()}`,
      layerId: LAYER,
      startFrame: 2,
      projectContextId: projectStore.projectContextId.peek(),
      frameCount: 1,
      expectedLayerEndExclusive: authority.layerEndExclusive,
      expectedRotoRevision: authority.rotoRevision,
      expectedTrackRevision: authority.trackRevision,
      expectedDocumentRevision: authority.documentRevision,
      frames: [
        authority.frames[0],
        { frameIndex: 0, appFrame: 2, dataUrl: `data:image/png;base64,${btoa(tag)}`, width: 4, height: 4, source: 'real-key' },
      ],
    };
  }

  it('cross-track stale isolation: a track-B edit between capture and commit leaves the A capture valid and never moves B', () => {
    seedTwoTrackState([makeRecord('key-a-0', 0, 'a@0')], [makeRecord('key-b-0', 0, 'b@0')]);
    const capturedA = capture(TRACK_A, 2);

    // A track-B edit lands between A's capture and A's commit: B's document
    // track term and runtime move; A's deterministic term does not.
    registerTwoTrackAuthorityDocument([makeRecord('key-a-0', 0, 'a@0')], [makeRecord('key-b-5', 5, 'b@5')]);
    seedRuntime(TRACK_B, [makeRecord('key-b-5', 5, 'b@5')]);
    const bAfterEdit = capture(TRACK_B, 6);
    expect(bAfterEdit.trackRevision).not.toBe(capturedA.trackRevision);
    expect(capturedA.trackRevision).toBe(
      buildEfxPaintTrackRevision(getDocument(LAYER)!.tracks.find((track) => track.id === TRACK_A)),
    );

    // The document term moved with B's edit (a strict child would re-capture);
    // the per-track law under test: A's captured TRACK term still revalidates
    // and the commit lands on A, never on the edited B.
    const { expectedDocumentRevision: _omittedDocumentTerm, ...payload } = buildBatch(capturedA);
    const beforeB = physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B);
    const result = applyPhysicPaintPayload(payload);
    expect(result).toMatchObject({ ok: true });
    expect(physicPaintStore.getRealRotoKeyFrames(LAYER, TRACK_A)).toEqual([0, 2]);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B)).toEqual(beforeB);
    // A's commit never moved B's revision term: the post-edit B term is unchanged.
    expect(capture(TRACK_B, 6).trackRevision).toBe(bAfterEdit.trackRevision);
  });

  it('concurrent captures at a shared appFrame: both commit their own maps, the last never overwrites the first', () => {
    seedTwoTrackState([makeRecord('key-a-0', 0, 'a@0')], [makeRecord('key-b-0', 0, 'b@0')]);
    // Each track capture names its own track and its own operation: the
    // dedupe registry keys on the per-commit operationId, so A's entry can
    // never intercept B's commit (and vice versa).
    const capturedA = capture(TRACK_A, 2);
    const capturedB = capture(TRACK_B, 2);

    const commitA = applyPhysicPaintPayload(buildBatch(capturedA));
    expect(commitA).toMatchObject({ ok: true });
    const commitB = applyPhysicPaintPayload(buildBatch(capturedB, { trackId: TRACK_B, tag: 'b@2' }));
    expect(commitB).toMatchObject({ ok: true });

    // The shared appFrame 2 holds each track's own bytes: the last commit
    // writes its own track map and never overwrites the first's frame.
    expect(physicPaintStore.getFrame(LAYER, TRACK_A, 2)?.dataUrl).toBe(`data:image/png;base64,${btoa('a@2')}`);
    expect(physicPaintStore.getFrame(LAYER, TRACK_B, 2)?.dataUrl).toBe(`data:image/png;base64,${btoa('b@2')}`);
    expect(physicPaintStore.getRealRotoKeyFrames(LAYER, TRACK_A)).toEqual([0, 2]);
    expect(physicPaintStore.getRealRotoKeyFrames(LAYER, TRACK_B)).toEqual([0, 2]);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_A)).toEqual([makeRecord('key-a-0', 0, 'a@0')]);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B)).toEqual([makeRecord('key-b-0', 0, 'b@0')]);
  });

  it('B-dirty does not fail A: the per-track revision, not the global clock, gates A\'s commit', () => {
    seedTwoTrackState([makeRecord('key-a-0', 0, 'a@0')], [makeRecord('key-b-0', 0, 'b@0')]);
    const capturedA = capture(TRACK_A, 2);
    const globalBefore = physicPaintVersion.value;
    const bRotorBefore = getTrackRotorRevision(LAYER, TRACK_B).value;
    const aRotorBefore = getTrackRotorRevision(LAYER, TRACK_A).value;

    // B gets dirty after A's capture: the global clock and B's own signal
    // move; A's per-track signal stays put.
    seedRuntime(TRACK_B, [makeRecord('key-b-5', 5, 'b@5')]);
    expect(physicPaintVersion.value).toBe(globalBefore + 1);
    expect(getTrackRotorRevision(LAYER, TRACK_B).value).toBe(bRotorBefore + 1);
    expect(getTrackRotorRevision(LAYER, TRACK_A).value).toBe(aRotorBefore);

    const result = applyPhysicPaintPayload(buildBatch(capturedA));
    expect(result).toMatchObject({ ok: true });
    expect(physicPaintStore.getRealRotoKeyFrames(LAYER, TRACK_A)).toEqual([0, 2]);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK_B)).toEqual([makeRecord('key-b-5', 5, 'b@5')]);
    // The authority still speaks the unchanged A terms (track revision AND
    // roto revision are A-scoped; the global clock never entered the gate).
    const recapturedA = capture(TRACK_A, 0);
    expect(recapturedA.trackRevision).toBe(capturedA.trackRevision);
    expect(recapturedA.rotoRevision).toBe(capturedA.rotoRevision);
  });

  it('authority during a foreign-track edit: a request for A after a B edit returns A\'s terms and bytes unchanged', () => {
    seedTwoTrackState([makeRecord('key-a-0', 0, 'a@0')], [makeRecord('key-b-0', 0, 'b@0')]);
    const beforeA = capture(TRACK_A, 0);

    // A track-B edit (document + runtime) lands: the document term moves and
    // B's track term moves; A's track term, roto revision, and bytes do not.
    registerTwoTrackAuthorityDocument([makeRecord('key-a-0', 0, 'a@0')], [makeRecord('key-b-5', 5, 'b@5')]);
    seedRuntime(TRACK_B, [makeRecord('key-b-5', 5, 'b@5')]);

    const afterA = capture(TRACK_A, 0);
    const afterB = capture(TRACK_B, 6);
    expect(afterA.trackRevision).toBe(beforeA.trackRevision);
    expect(afterA.rotoRevision).toBe(beforeA.rotoRevision);
    expect(afterA.frames).toEqual(beforeA.frames);
    expect(afterA.documentRevision).not.toBe(beforeA.documentRevision);
    expect(afterB.trackRevision).not.toBe(beforeA.trackRevision);
    expect(afterB.frames).toEqual([expect.objectContaining({ appFrame: 5 })]);
  });
});
