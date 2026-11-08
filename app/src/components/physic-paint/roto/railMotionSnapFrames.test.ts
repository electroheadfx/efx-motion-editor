// ============================================================
//  261108-d5o (Task 3) — the displayed-real-key frame list.
//
//  Stop Motion samples the linear ramp only at frames that DISPLAY a real
//  drawing key. This module resolves that rail-local frame list as pure data:
//  one memoized scan per rail + span + capacity + raster revision, so a
//  motion-only edit cannot invalidate it and a paint edit must.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import {
  RAIL_MOTION_SNAP_FRAMES_EMPTY,
  __resetRailMotionSnapFramesMemoForTests,
  isRailMotionDisplayedRealFrame,
  resolveRailMotionSnapFrames,
  type RailMotionSnapFrameRequest,
} from './railMotionSnapFrames';
import {
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import {
  derivePhysicPaintRotoLoopRanges,
  type PhysicPaintRotoLoopResolutionContext,
} from './physicsPaintRotoPhysicalResolver';

const CAPACITY = 40;

function record(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: { frameIndex: 0, appFrame },
  };
}

/** Real keys at 0/3/6 — ordinary keys outside every group. */
const RECORDS: readonly PhysicPaintRotoRealKeyRecord[] = [record('a', 0), record('b', 3), record('c', 6)];
const RECORD_MAP: ReadonlyMap<string, PhysicPaintRotoRealKeyRecord> = new Map(
  RECORDS.map((entry) => [entry.keyId, entry]),
);

/**
 * 8/9/10/11 exercise the classifier: source occurrence, generated
 * occurrence, group gap and override. 20 is an unresolvable cycle, 30 an
 * ambiguous overlap and 13 a lifecycle-less loop that only the per-frame
 * resolver can see.
 */
const LOOP_CLIPS: readonly PhysicPaintRotoLoopClip[] = [
  {
    loopId: 'loop-1',
    placementStart: 8,
    sourceKeyIds: ['a', 'b'],
    repeat: 1,
    mode: 'progressive',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 8,
    originalEndExclusive: 12,
    visibleRanges: [
      { start: 8, endExclusive: 10 },
      { start: 11, endExclusive: 12 },
    ],
    frameOverrides: [{ appFrame: 11, keyId: 'override-1' }],
  },
  {
    loopId: 'loop-less',
    placementStart: 13,
    sourceKeyIds: ['c'],
    repeat: 1,
    mode: 'progressive',
  },
  {
    loopId: 'loop-unresolved',
    placementStart: 20,
    sourceKeyIds: ['a', 'missing'],
    repeat: 1,
    mode: 'progressive',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 20,
    originalEndExclusive: 24,
    visibleRanges: [{ start: 20, endExclusive: 24 }],
    frameOverrides: [],
  },
  {
    loopId: 'loop-ambiguous-a',
    placementStart: 30,
    sourceKeyIds: ['a'],
    repeat: 1,
    mode: 'progressive',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 30,
    originalEndExclusive: 32,
    visibleRanges: [{ start: 30, endExclusive: 32 }],
    frameOverrides: [],
  },
  {
    loopId: 'loop-ambiguous-b',
    placementStart: 30,
    sourceKeyIds: ['a'],
    repeat: 1,
    mode: 'progressive',
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: 30,
    originalEndExclusive: 32,
    visibleRanges: [{ start: 30, endExclusive: 32 }],
    frameOverrides: [],
  },
];

const LOOP_RESOLUTION: PhysicPaintRotoLoopResolutionContext = derivePhysicPaintRotoLoopRanges({
  identities: RECORDS.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
  loopClips: LOOP_CLIPS,
  capacity: CAPACITY,
  interpolationEnabled: false,
});

function request(overrides: Partial<RailMotionSnapFrameRequest> = {}): RailMotionSnapFrameRequest {
  return {
    railId: 'rail-synthetic',
    startFrame: 0,
    endFrameExclusive: CAPACITY,
    capacity: CAPACITY,
    rasterRevision: 'raster-1',
    loopClips: LOOP_CLIPS,
    realKeyRecords: RECORD_MAP,
    loopResolution: LOOP_RESOLUTION,
    ...overrides,
  };
}

beforeEach(() => {
  __resetRailMotionSnapFramesMemoForTests();
});

describe('rail motion snap frames — displayed-real-key predicate', () => {
  it.each([0, 3, 6, 8, 11, 13])('treats app frame %i as displayed real', (appFrame) => {
    expect(isRailMotionDisplayedRealFrame(request(), appFrame)).toBe(true);
  });

  // 9 generated occurrence, 10 group gap, 20 unresolved cycle, 30 ambiguous
  // overlap and 5 a plain empty frame. None displays a drawing key.
  it.each([5, 9, 10, 20, 30])('treats app frame %i as not displayed real', (appFrame) => {
    expect(isRailMotionDisplayedRealFrame(request(), appFrame)).toBe(false);
  });
});

describe('rail motion snap frames — scan result', () => {
  it('returns the frozen ascending rail-local frame list', () => {
    const frames = resolveRailMotionSnapFrames(request());
    expect(frames).toEqual([0, 3, 6, 8, 11, 13]);
    expect(Object.isFrozen(frames)).toBe(true);
  });

  it('subtracts startFrame so the list is rail-local', () => {
    const frames = resolveRailMotionSnapFrames(request({ startFrame: 3, endFrameExclusive: 20 }));
    expect(frames).toEqual([0, 3, 5, 8, 10]);
  });

  it('returns the shared empty list for an empty or inverted span', () => {
    expect(resolveRailMotionSnapFrames(request({ startFrame: 12, endFrameExclusive: 12 }))).toBe(
      RAIL_MOTION_SNAP_FRAMES_EMPTY,
    );
    expect(resolveRailMotionSnapFrames(request({ startFrame: 12, endFrameExclusive: 4 }))).toBe(
      RAIL_MOTION_SNAP_FRAMES_EMPTY,
    );
    expect(resolveRailMotionSnapFrames(request({ startFrame: Number.NaN }))).toBe(
      RAIL_MOTION_SNAP_FRAMES_EMPTY,
    );
  });
});

describe('rail motion snap frames — bounded memo', () => {
  it('serves the same frozen array for repeat calls with the same identity', () => {
    const first = resolveRailMotionSnapFrames(request());
    const second = resolveRailMotionSnapFrames(request());
    expect(second).toBe(first);
  });

  it('re-scans when the raster revision, the rail id or the span moves', () => {
    const first = resolveRailMotionSnapFrames(request());
    expect(resolveRailMotionSnapFrames(request({ rasterRevision: 'raster-2' }))).not.toBe(first);
    expect(resolveRailMotionSnapFrames(request({ railId: 'rail-other' }))).not.toBe(first);
    expect(resolveRailMotionSnapFrames(request({ endFrameExclusive: 12 }))).not.toBe(first);
  });

  it('evicts the oldest entry past the bound', () => {
    const first = resolveRailMotionSnapFrames(request({ railId: 'rail-0' }));
    for (let index = 1; index <= 512; index += 1) {
      resolveRailMotionSnapFrames(request({ railId: `rail-${index}` }));
    }
    // rail-0 was the oldest entry and the 513th insert evicted it.
    expect(resolveRailMotionSnapFrames(request({ railId: 'rail-0' }))).not.toBe(first);
    // rail-511 is still resident.
    const resident = resolveRailMotionSnapFrames(request({ railId: 'rail-511' }));
    expect(resolveRailMotionSnapFrames(request({ railId: 'rail-511' }))).toBe(resident);
  });

  it('clears every entry on the test reset', () => {
    const first = resolveRailMotionSnapFrames(request());
    __resetRailMotionSnapFramesMemoForTests();
    expect(resolveRailMotionSnapFrames(request())).not.toBe(first);
  });
});
