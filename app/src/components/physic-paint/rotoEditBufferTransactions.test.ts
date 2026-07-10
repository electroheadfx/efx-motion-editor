import { describe, expect, it } from 'vitest';
import {
  addEditableRotoFrame,
  clearCachedRepaintOverlay,
  clearRotoFrame,
  createRotoEditBuffer,
  markRotoFrameDirty,
  removeEditableRotoFrame,
  resetRotoEditBuffer,
  snapshotRotoFrame,
  undoRotoOverlay,
} from './rotoEditBufferTransactions';

type State = { strokes: unknown[]; settings: { bgMode: 'transparent' | 'white' } };
type Frame = { appFrame: number; dataUrl: string };

const state = (strokeCount: number, bgMode: State['settings']['bgMode'] = 'transparent'): State => ({
  strokes: Array.from({ length: strokeCount }),
  settings: { bgMode },
});

function seededBuffer() {
  const buffer = createRotoEditBuffer<State, Frame>();
  buffer.dirtyFrames.add(4);
  buffer.frameStates.set(4, state(1));
  buffer.previewFrames.set(4, { appFrame: 4, dataUrl: 'preview' });
  buffer.capturedFrames.set(4, { appFrame: 4, dataUrl: 'capture' });
  buffer.liveOverlayActionCounts.set(4, 2);
  return buffer;
}

describe('Roto edit buffer transactions', () => {
  it('keeps editable frame markers sorted and unique', () => {
    expect(addEditableRotoFrame([7, 2], 4)).toEqual([2, 4, 7]);
    expect(addEditableRotoFrame([2, 4, 7], 4)).toEqual([2, 4, 7]);
    expect(removeEditableRotoFrame([2, 4, 7], 4)).toEqual([2, 7]);
  });

  it('tracks live repaint actions and only empties dirty state after the final undo', () => {
    const buffer = createRotoEditBuffer<State, Frame>();
    markRotoFrameDirty(buffer, 9);
    markRotoFrameDirty(buffer, 9);
    expect(undoRotoOverlay(buffer, 9)).toBe('dirty');
    expect(buffer.dirtyFrames.has(9)).toBe(true);
    expect(buffer.liveOverlayActionCounts.get(9)).toBe(1);
    expect(undoRotoOverlay(buffer, 9)).toBe('empty');
    expect(buffer.dirtyFrames.has(9)).toBe(false);
    expect(buffer.liveOverlayActionCounts.has(9)).toBe(false);
  });

  it('clears only live repaint ownership when preserving a cached base', () => {
    const buffer = seededBuffer();
    clearCachedRepaintOverlay(buffer, 4);
    expect(buffer.frameStates.has(4)).toBe(false);
    expect(buffer.previewFrames.has(4)).toBe(false);
    expect(buffer.capturedFrames.has(4)).toBe(false);
    expect(buffer.liveOverlayActionCounts.has(4)).toBe(false);
    expect(buffer.dirtyFrames.has(4)).toBe(false);
  });

  it('marks a normal cleared frame dirty so deletion persists', () => {
    const buffer = seededBuffer();
    clearRotoFrame(buffer, 4);
    expect(buffer.frameStates.has(4)).toBe(false);
    expect(buffer.previewFrames.has(4)).toBe(false);
    expect(buffer.capturedFrames.has(4)).toBe(false);
    expect(buffer.liveOverlayActionCounts.has(4)).toBe(false);
    expect(buffer.dirtyFrames.has(4)).toBe(true);
  });

  it('does not capture an untouched cached reference or non-persistable state', () => {
    const buffer = createRotoEditBuffer<State, Frame>();
    const cached = snapshotRotoFrame({ buffer, frame: 3, state: state(1), capturedFrame: { appFrame: 3, dataUrl: 'x' }, hasCachedReference: true, shouldPersist: true });
    expect(cached).toEqual({ captured: false, editable: false });
    markRotoFrameDirty(buffer, 3);
    const empty = snapshotRotoFrame({ buffer, frame: 3, state: state(0), capturedFrame: { appFrame: 3, dataUrl: 'x' }, hasCachedReference: false, shouldPersist: false });
    expect(empty).toEqual({ captured: false, editable: false });
  });

  it('stores one injected transparent capture and distinguishes background-only from editable paint', () => {
    const buffer = createRotoEditBuffer<State, Frame>();
    const capturedFrame = { appFrame: 6, dataUrl: 'transparent-canvas' };
    const painted = snapshotRotoFrame({ buffer, frame: 6, state: state(1), capturedFrame, hasCachedReference: false, shouldPersist: true });
    expect(painted).toEqual({ captured: true, editable: true });
    expect(buffer.capturedFrames.get(6)).toBe(capturedFrame);
    expect(buffer.previewFrames.get(6)).toBe(capturedFrame);
    const backgroundOnly = snapshotRotoFrame({ buffer, frame: 7, state: state(0, 'white'), capturedFrame: { appFrame: 7, dataUrl: 'background' }, hasCachedReference: false, shouldPersist: true });
    expect(backgroundOnly).toEqual({ captured: true, editable: false });
  });

  it('clears all launch-scoped transient ownership', () => {
    const buffer = seededBuffer();
    resetRotoEditBuffer(buffer);
    expect(buffer.dirtyFrames.size).toBe(0);
    expect(buffer.frameStates.size).toBe(0);
    expect(buffer.previewFrames.size).toBe(0);
    expect(buffer.capturedFrames.size).toBe(0);
    expect(buffer.liveOverlayActionCounts.size).toBe(0);
  });
});
