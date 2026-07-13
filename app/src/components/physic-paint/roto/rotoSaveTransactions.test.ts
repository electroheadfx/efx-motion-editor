import { describe, expect, it } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import {
  buildApplyCanvasPayload,
  buildDeleteRotoFramePayload,
  guardRotoFlush,
  guardRotoSaveFrame,
  isBackgroundOnlyRotoFrame,
  resolveRotoSaveSourceFrame,
  selectRotoEditableState,
  shouldPersistRotoFrame,
  sortedDirtyRotoFrames,
  type RotoEditableState,
} from './rotoSaveTransactions';

const state = (strokes: unknown[] = [], bgMode = 'transparent'): RotoEditableState => ({
  version: 1,
  strokes,
  settings: { bgMode },
} as unknown as RotoEditableState);

const launchContext = {
  operationId: 'launch-1',
  layerId: 'layer-1',
} as PhysicPaintLaunchContext;

const renderedFrame = { frameIndex: 0, appFrame: 8, dataUrl: 'data:image/png;base64,frame', width: 100, height: 80 };

const interpolationSettings = { enabled: true, inBetweenCount: 2, mode: 'duplicate' as const, deform: 0, position: 0 };

describe('rotoSaveTransactions', () => {
  it('guards invalid, clean, in-flight, and forced dirty flushes in order', () => {
    expect(guardRotoFlush({ hasActionContext: false, frame: 2, dirty: true, inFlight: false })).toEqual({ type: 'invalid' });
    expect(guardRotoFlush({ hasActionContext: true, frame: 2, dirty: false, inFlight: false })).toEqual({ type: 'clean' });
    expect(guardRotoFlush({ hasActionContext: true, frame: 2, force: true, dirty: false, inFlight: true })).toEqual({ type: 'in-flight' });
    expect(guardRotoFlush({ hasActionContext: true, frame: 2, force: true, dirty: false, inFlight: false })).toEqual({ type: 'flush' });
  });

  it('selects the live current state and restores live engine state around stored-frame saves', () => {
    const liveState = state([{}]);
    const storedState = state([], 'white');
    expect(selectRotoEditableState({ frame: 4, currentFrame: 4, liveState, storedState })).toEqual({ editableState: liveState, previousState: null });
    expect(selectRotoEditableState({ frame: 3, currentFrame: 4, liveState, storedState })).toEqual({ editableState: storedState, previousState: liveState });
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
      layerId: 'layer-1',
      startFrame: 8,
      sourceFrame: 3,
    });
  });

  it('constructs apply-canvas payloads with background and onion markers only when applicable', () => {
    expect(buildApplyCanvasPayload({
      launchContext,
      frame: 8,
      sourceFrame: 3,
      editableState: state([{}]),
      renderedFrame,
      backgroundMetadata: { background: 'transparent', paperGrain: 'canvas1', grainStrength: 0.45 },
      interpolationSettings,
      backgroundOnly: false,
      onionFrame: renderedFrame,
      now: 42,
    })).toMatchObject({
      operationId: 'launch-1:canvas:8:42',
      kind: 'apply-canvas',
      layerId: 'layer-1',
      startFrame: 8,
      sourceFrame: 3,
      renderedFrame,
      onionDataUrl: renderedFrame.dataUrl,
      rotoInterpolationSettings: interpolationSettings,
    });
    expect(buildApplyCanvasPayload({
      launchContext,
      frame: 8,
      sourceFrame: 8,
      editableState: state([], 'white'),
      renderedFrame,
      backgroundMetadata: { background: 'white', color: '#ffffff', paperGrain: 'canvas1', grainStrength: 0.45 },
      interpolationSettings,
      backgroundOnly: true,
      onionFrame: null,
      now: 43,
    })).toMatchObject({ backgroundOnly: true });
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
