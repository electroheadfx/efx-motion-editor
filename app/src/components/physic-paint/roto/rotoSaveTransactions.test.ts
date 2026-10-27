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
} from './rotoSaveTransactions';
import { shouldPersistRotoFrameFromTruth } from './rotoFramePersistTruth';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

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

  it('classifies painted, empty, and background-only frames from the watercolor truth table', () => {
    // 3.5 (261027-klx): the persist law reads `recordedStrokeCount` +
    // `payloadEventCount` + `bgMode` — never the engine-1 document mirror.
    expect(shouldPersistRotoFrame({ recordedStrokeCount: 0, payloadEventCount: 0, bgMode: 'transparent' })).toBe(false);
    expect(shouldPersistRotoFrame({ recordedStrokeCount: 1, payloadEventCount: 1, bgMode: 'transparent' })).toBe(true);
    expect(shouldPersistRotoFrame({ recordedStrokeCount: 0, payloadEventCount: 0, bgMode: 'canvas1' })).toBe(true);
    // Payload events are evidence only: strokes can be deleted while their
    // timeline entries survive, and such a frame must stay empty.
    expect(shouldPersistRotoFrame({ recordedStrokeCount: 0, payloadEventCount: 4, bgMode: 'transparent' })).toBe(false);
    expect(shouldPersistRotoFrameFromTruth({ recordedStrokeCount: 0, payloadEventCount: 4, bgMode: 'transparent' })).toBe(false);

    expect(isBackgroundOnlyRotoFrame({ recordedStrokeCount: 0, payloadEventCount: 0, bgMode: 'canvas1' })).toBe(true);
    expect(isBackgroundOnlyRotoFrame({ recordedStrokeCount: 1, payloadEventCount: 1, bgMode: 'canvas1' })).toBe(false);
  });

  it('261027-klx regression: engine-1 mirror empty, watercolor recorded strokes present → persist', () => {
    // The engine-1 mirror (`state.tracks[].strokes`) is empty the moment stroke
    // acceptance routes through the app-owned ledger. Before 3.5 that empty
    // mirror classified a painted watercolor frame as EMPTY and persistence
    // silently dropped real paint. The watercolor record decides now.
    expect(shouldPersistRotoFrame({ recordedStrokeCount: 2, payloadEventCount: 2, bgMode: 'transparent' })).toBe(true);
    // A frame with neither strokes nor a fond still refuses to persist.
    expect(shouldPersistRotoFrame({ recordedStrokeCount: 0, payloadEventCount: 0, bgMode: 'transparent' })).toBe(false);
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
