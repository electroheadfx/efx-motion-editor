import { describe, expect, it } from 'vitest';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import {
  collectDiscardableRotoGroupOwnedFrames,
  rebuildRotoPhysicalOwnership,
} from './rotoPhysicalOwnership';

function record(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    },
  };
}

function document(loopClips: readonly PhysicPaintRotoLoopClip[]): PhysicPaintRotoPhysicalDocument {
  const records = [record('A', 0), record('B', 2)];
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  return {
    capacity: 12,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 4,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, []),
    loopClips,
    incomingInterpolationBreakKeyIds: [],
  };
}

function lifecycleGroup(visibleRanges: readonly { start: number; endExclusive: number }[]): PhysicPaintRotoLoopClip {
  return {
    loopId: 'group-1',
    placementStart: 0,
    sourceKeyIds: ['A', 'B'],
    repeat: 2,
    mode: 'progressive',
    scriptId: 'action-1',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
    syncState: visibleRanges.length === 1 ? 'synchronized' : 'modified',
    provenanceState: 'attached',
    phaseOrigin: 0,
    originalEndExclusive: 6,
    visibleRanges,
    frameOverrides: [],
  };
}

function snapshot(appFrame: number) {
  const frame = {
    frameIndex: 0,
    appFrame,
    dataUrl: 'data:image/png;base64,VklSVFVBTA==',
  };
  return {
    frameStates: new Map([[appFrame, { strokes: 1 }]]),
    previewFrames: new Map([[appFrame, frame]]),
    capturedFrames: new Map([[appFrame, frame]]),
    confirmedFrames: new Map([[appFrame, frame]]),
    dirtyFrames: new Set([appFrame]),
    liveOverlayActionCounts: new Map([[appFrame, 1]]),
    editableFrames: [appFrame],
    reference: {
      url: 'blob:virtual-frame',
      cachedRepaintBase: frame,
    },
  };
}

describe('Roto physical ownership materialization', () => {
  it('identifies deleted Group gaps restored by accepted Regenerate as discardable derived frames', () => {
    const beforeDocument = document([lifecycleGroup([
      { start: 0, endExclusive: 4 },
      { start: 5, endExclusive: 6 },
    ])]);
    const afterDocument = document([lifecycleGroup([{ start: 0, endExclusive: 6 }])]);

    expect(collectDiscardableRotoGroupOwnedFrames({
      beforeDocument,
      afterDocument,
      snapshotFrames: [4, 7],
    })).toEqual([4]);
  });

  it('drops virtual occurrence buffers only at the accepted newly materialized override frame', () => {
    const result = rebuildRotoPhysicalOwnership({
      beforeRecords: [record('A', 0), record('B', 2)],
      afterRecords: [record('A', 0), record('B', 2), record('override-4', 4)],
      contentRevision: 'accepted-revision',
      discardUnownedAppFrames: [4],
      snapshot: snapshot(4),
    });

    expect(result).toEqual({
      ok: true,
      value: {
        frameStates: new Map(),
        previewFrames: new Map(),
        capturedFrames: new Map(),
        confirmedFrames: new Map(),
        dirtyFrames: new Set(),
        liveOverlayActionCounts: new Map(),
        editableFrames: [],
        reference: { url: null, cachedRepaintBase: null },
      },
    });
  });

  it('stamps every retained child buffer with the exact complete accepted revision', () => {
    const beforeRecords = [record('A', 0), record('B', 2)];
    const afterRecords = [record('A', 1), record('B', 3)];
    const groupOverrideRecords = [record('override-1', 1)];
    const incomingInterpolationBreakKeyIds = ['B'];
    const loopClips = [{
      ...lifecycleGroup([{ start: 0, endExclusive: 6 }]),
      frameOverrides: [{ appFrame: 1, keyId: 'override-1' }],
    }];
    const contentRevision = buildPhysicPaintRotoPhysicalRevision(
      afterRecords,
      { enabled: false, mode: 'duplicate' },
      loopClips,
      incomingInterpolationBreakKeyIds,
      groupOverrideRecords,
    );

    const result = rebuildRotoPhysicalOwnership({
      beforeRecords,
      afterRecords,
      contentRevision,
      snapshot: snapshot(0),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const owned of [
      result.value.previewFrames.get(1),
      result.value.capturedFrames.get(1),
      result.value.confirmedFrames.get(1),
      result.value.reference.cachedRepaintBase,
    ]) {
      expect(owned).toMatchObject({
        appFrame: 1,
        keyId: 'A',
        contentRevision,
        cacheRevision: `${contentRevision}:real:A`,
      });
    }
  });

  it('still fails closed for unrelated unowned child state', () => {
    const result = rebuildRotoPhysicalOwnership({
      beforeRecords: [record('A', 0), record('B', 2)],
      afterRecords: [record('A', 0), record('B', 2), record('override-4', 4)],
      contentRevision: 'accepted-revision',
      discardUnownedAppFrames: [4],
      snapshot: snapshot(5),
    });

    expect(result).toEqual({
      ok: false,
      error: 'Frame-indexed child state is not completely owned by the pre-state real-key identities.',
    });
  });
});
