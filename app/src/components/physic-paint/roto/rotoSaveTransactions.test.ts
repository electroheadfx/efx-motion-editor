import { describe, expect, it } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import {
  buildDeleteRotoFramePayload,
  guardRotoFlush,
  guardRotoSaveFrame,
  isBackgroundOnlyRotoFrame,
  resolveRotoSaveSourceFrame,
  shouldPersistRotoFrame,
  sortedDirtyRotoFrames,
  type RotoEditableState,
} from './rotoSaveTransactions';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

const state = (strokes: unknown[] = [], bgMode = 'transparent'): RotoEditableState => ({
  version: 1,
  parentLayerId: 'layer-1',
  documentRevision: 0,
  activeTrackId: 'track-1',
  tracks: [{
    id: 'track-1',
    name: 'Paint',
    order: 0,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal',
    revision: 0,
    frames: {},
    rotoPhysical: null,
    loopClips: [],
    strokes,
    settings: { bgMode, paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
  }],
  background: { id: 'background-1', clips: [], fallback: { mode: 'transparent' }, visible: true, revision: 0 },
  photoReference: null,
  compositeRevision: 0,
} as unknown as RotoEditableState);

const launchContext = {
  operationId: 'launch-1',
  layerId: 'layer-1',
  // 46-01: the launch IS the document — builders read the active track from it.
  document: { activeTrackId: TEST_TRACK_ID },
} as PhysicPaintLaunchContext;

describe('rotoSaveTransactions', () => {
  it('guards invalid, clean, in-flight, and forced dirty flushes in order', () => {
    expect(guardRotoFlush({ hasActionContext: false, frame: 2, dirty: true, inFlight: false })).toEqual({ type: 'invalid' });
    expect(guardRotoFlush({ hasActionContext: true, frame: 2, dirty: false, inFlight: false })).toEqual({ type: 'clean' });
    expect(guardRotoFlush({ hasActionContext: true, frame: 2, force: true, dirty: false, inFlight: true })).toEqual({ type: 'in-flight' });
    expect(guardRotoFlush({ hasActionContext: true, frame: 2, force: true, dirty: false, inFlight: false })).toEqual({ type: 'flush' });
  });

  it('classifies delete, painted, and background-only editable states', () => {
    expect(shouldPersistRotoFrame(state())).toBe(false);
    expect(shouldPersistRotoFrame(state([{}]))).toBe(true);
    expect(shouldPersistRotoFrame(state([], 'canvas1'))).toBe(true);
    expect(isBackgroundOnlyRotoFrame(state([], 'canvas1'))).toBe(true);
    expect(isBackgroundOnlyRotoFrame(state([{}], 'canvas1'))).toBe(false);
  });

  it('resolves explicit save targets before timeline source resolution', () => {
    expect(resolveRotoSaveSourceFrame(8, 3, 5)).toBe(3);
    expect(resolveRotoSaveSourceFrame(8, undefined, 5)).toBe(5);
  });

  it('constructs the exact delete payload contract', () => {
    expect(buildDeleteRotoFramePayload({ launchContext, frame: 8, sourceFrame: 3, now: 42 })).toEqual({
      operationId: 'launch-1:delete-roto:8:42',
      kind: 'delete-roto-frame',
      trackId: TEST_TRACK_ID,
      layerId: 'layer-1',
      startFrame: 8,
      sourceFrame: 3,
    });
  });

  it('guards render-only selections and no-new-paint saves with exact user copy', () => {
    expect(guardRotoSaveFrame({ readyToApply: true, hasLaunchContext: true, currentFrame: 6, selectionKind: 'generated-interpolation', cachedRepaint: false, dirty: false, snapshotHasLiveOverlay: false })).toEqual({
      type: 'render-only',
      message: 'Generated frame 6 is render-only. Navigate to a real Roto key to paint.',
    });
    expect(guardRotoSaveFrame({ readyToApply: true, hasLaunchContext: true, currentFrame: 10, selectionKind: 'empty', cachedRepaint: false, dirty: false, snapshotHasLiveOverlay: false })).toEqual({
      type: 'render-only',
      message: 'Empty frame 10 is render-only. Navigate to a real Roto key to paint.',
    });
    expect(guardRotoSaveFrame({ readyToApply: true, hasLaunchContext: true, currentFrame: 6, selectionKind: 'real-key', cachedRepaint: true, dirty: false, snapshotHasLiveOverlay: false })).toEqual({
      type: 'no-new-paint',
      message: 'No new paint to save for frame 6.',
    });
  });

  it('sorts pending dirty frames before sequential save', () => {
    expect(sortedDirtyRotoFrames(new Set([9, 2, 5]))).toEqual([2, 5, 9]);
  });
});
