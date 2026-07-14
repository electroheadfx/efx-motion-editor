import { useCallback, useRef, useState } from 'preact/hooks';
import type { RotoEditableState, RotoRenderedFrame } from '../roto/rotoSaveTransactions';
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
} from '../roto/rotoEditBufferTransactions';

export function useRotoEditBufferController<State extends RotoEditableState, Frame extends RotoRenderedFrame>() {
  const bufferRef = useRef(createRotoEditBuffer<State, Frame>());
  const [editableFrames, setEditableFrames] = useState<number[]>([]);

  const addEditableFrame = useCallback((frame: number) => {
    setEditableFrames((frames) => addEditableRotoFrame(frames, frame));
  }, []);
  const removeEditableFrame = useCallback((frame: number) => {
    setEditableFrames((frames) => removeEditableRotoFrame(frames, frame));
  }, []);
  const markDirty = useCallback((frame: number) => markRotoFrameDirty(bufferRef.current, frame), []);
  const undoOverlay = useCallback((frame: number) => undoRotoOverlay(bufferRef.current, frame), []);
  const clearCachedOverlay = useCallback((frame: number) => {
    clearCachedRepaintOverlay(bufferRef.current, frame);
    removeEditableFrame(frame);
  }, [removeEditableFrame]);
  const clearFrame = useCallback((frame: number) => {
    clearRotoFrame(bufferRef.current, frame);
    removeEditableFrame(frame);
  }, [removeEditableFrame]);
  const snapshotFrame = useCallback((input: Omit<Parameters<typeof snapshotRotoFrame<State, Frame>>[0], 'buffer'>) => {
    const result = snapshotRotoFrame({ buffer: bufferRef.current, ...input });
    if (result.editable) addEditableFrame(input.frame);
    else removeEditableFrame(input.frame);
    return result.captured;
  }, [addEditableFrame, removeEditableFrame]);
  const setEditableFrameList = useCallback((update: (frames: number[]) => number[]) => {
    setEditableFrames(update);
  }, []);
  const acceptPixelCache = useCallback((frame: number) => {
    bufferRef.current.dirtyFrames.delete(frame);
    bufferRef.current.frameStates.delete(frame);
    bufferRef.current.previewFrames.delete(frame);
    bufferRef.current.capturedFrames.delete(frame);
    removeEditableFrame(frame);
  }, [removeEditableFrame]);
  const resetForLaunch = useCallback(() => {
    resetRotoEditBuffer(bufferRef.current);
    setEditableFrames([]);
  }, []);
  const replaceFrameStates = useCallback((states: Map<number, State>) => { bufferRef.current.frameStates = states; }, []);
  const replacePreviewFrames = useCallback((frames: Map<number, Frame>) => { bufferRef.current.previewFrames = frames; }, []);
  const replaceDirtyFrames = useCallback((frames: Set<number>) => { bufferRef.current.dirtyFrames = frames; }, []);

  return {
    bufferRef,
    editableFrames,
    addEditableFrame,
    removeEditableFrame,
    markDirty,
    undoOverlay,
    clearCachedOverlay,
    clearFrame,
    snapshotFrame,
    setEditableFrameList,
    acceptPixelCache,
    resetForLaunch,
    replaceFrameStates,
    replacePreviewFrames,
    replaceDirtyFrames,
  };
}
