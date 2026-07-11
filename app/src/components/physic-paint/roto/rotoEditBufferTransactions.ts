import type { RotoEditableState, RotoRenderedFrame } from '../roto/rotoSaveTransactions';

export interface RotoEditBuffer<State = RotoEditableState, Frame = RotoRenderedFrame> {
  dirtyFrames: Set<number>;
  frameStates: Map<number, State>;
  previewFrames: Map<number, Frame>;
  capturedFrames: Map<number, Frame>;
  liveOverlayActionCounts: Map<number, number>;
}

export function createRotoEditBuffer<State = RotoEditableState, Frame = RotoRenderedFrame>(): RotoEditBuffer<State, Frame> {
  return {
    dirtyFrames: new Set(),
    frameStates: new Map(),
    previewFrames: new Map(),
    capturedFrames: new Map(),
    liveOverlayActionCounts: new Map(),
  };
}

export function addEditableRotoFrame(frames: readonly number[], frame: number): number[] {
  return frames.includes(frame) ? [...frames] : [...frames, frame].sort((a, b) => a - b);
}

export function removeEditableRotoFrame(frames: readonly number[], frame: number): number[] {
  return frames.filter((editableFrame) => editableFrame !== frame);
}

export function hasEditableRotoContent(state: { strokes: readonly unknown[] }): boolean {
  return state.strokes.length > 0;
}

export function markRotoFrameDirty<State, Frame>(buffer: RotoEditBuffer<State, Frame>, frame: number): void {
  buffer.dirtyFrames.add(frame);
  buffer.liveOverlayActionCounts.set(frame, (buffer.liveOverlayActionCounts.get(frame) ?? 0) + 1);
}

export function undoRotoOverlay<State, Frame>(buffer: RotoEditBuffer<State, Frame>, frame: number): 'unchanged' | 'dirty' | 'empty' {
  const count = buffer.liveOverlayActionCounts.get(frame);
  if (!count) return 'unchanged';
  if (count > 1) {
    buffer.liveOverlayActionCounts.set(frame, count - 1);
    return 'dirty';
  }
  buffer.liveOverlayActionCounts.delete(frame);
  buffer.dirtyFrames.delete(frame);
  return 'empty';
}

export function clearCachedRepaintOverlay<State, Frame>(buffer: RotoEditBuffer<State, Frame>, frame: number): void {
  buffer.frameStates.delete(frame);
  buffer.previewFrames.delete(frame);
  buffer.capturedFrames.delete(frame);
  buffer.liveOverlayActionCounts.delete(frame);
  buffer.dirtyFrames.delete(frame);
}

export function clearRotoFrame<State, Frame>(buffer: RotoEditBuffer<State, Frame>, frame: number): void {
  buffer.frameStates.delete(frame);
  buffer.previewFrames.delete(frame);
  buffer.capturedFrames.delete(frame);
  buffer.liveOverlayActionCounts.delete(frame);
  buffer.dirtyFrames.add(frame);
}

export function snapshotRotoFrame<State extends { strokes: readonly unknown[] }, Frame>(input: {
  buffer: RotoEditBuffer<State, Frame>;
  frame: number;
  state: State;
  capturedFrame: Frame;
  hasCachedReference: boolean;
  shouldPersist: boolean;
}): { captured: boolean; editable: boolean } {
  const { buffer, frame } = input;
  if ((input.hasCachedReference && !buffer.dirtyFrames.has(frame)) || !input.shouldPersist) {
    buffer.frameStates.delete(frame);
    buffer.previewFrames.delete(frame);
    buffer.capturedFrames.delete(frame);
    return { captured: false, editable: false };
  }
  buffer.frameStates.set(frame, input.state);
  buffer.capturedFrames.set(frame, input.capturedFrame);
  buffer.previewFrames.set(frame, input.capturedFrame);
  return { captured: true, editable: hasEditableRotoContent(input.state) };
}

export function resetRotoEditBuffer<State, Frame>(buffer: RotoEditBuffer<State, Frame>): void {
  buffer.dirtyFrames.clear();
  buffer.frameStates.clear();
  buffer.previewFrames.clear();
  buffer.capturedFrames.clear();
  buffer.liveOverlayActionCounts.clear();
}
