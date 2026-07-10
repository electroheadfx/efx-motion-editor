import { useCallback, type MutableRef } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { RotoSessionEffect } from './physicsPaintRotoSession';
import type { AcceptedRotoApplyResult } from './rotoApplyResultTransactions';
import { completeRotoApplyResult } from './rotoApplyResultTransactions';
import type { RotoRenderedFrame } from './rotoSaveTransactions';

interface RotoRenderedSave {
  renderedFrame: RotoRenderedFrame;
  backgroundOnly: boolean;
  onionFrame?: RotoRenderedFrame | null;
}

interface PendingCachedMerge extends RotoRenderedSave {
  frame: number;
}

interface RotoSessionSaveResult {
  message?: string | null;
  effects: RotoSessionEffect[];
}

export interface RotoApplyResultControllerInput<State> {
  pendingKeyActionMessageRef: MutableRef<string | null>;
  pendingAdvanceRef: MutableRef<number | null>;
  saveOnLeaveSourceFrameRef: MutableRef<number | null>;
  saveOnLeaveRenderedFrameRef: MutableRef<RotoRenderedSave | null>;
  pendingCachedMergeFrameRef: MutableRef<PendingCachedMerge | null>;
  saveOnLeaveDeleteFrameRef: MutableRef<number | null>;
  dirtyFramesRef: MutableRef<Set<number>>;
  capturedFramesRef: MutableRef<Map<number, RotoRenderedFrame>>;
  frameStatesRef: MutableRef<Map<number, State>>;
  liveOverlayActionCountsRef: MutableRef<Map<number, number>>;
  closeAfterApplyOperationIdRef: MutableRef<string | null>;
  closeAfterRotoSaveRequestedRef: MutableRef<boolean>;
  closeGuardBypassRef: MutableRef<boolean>;
  getSessionSavingFrame: () => number | null;
  onSessionSaveFailed: (frame: number, message: string) => RotoSessionSaveResult;
  onSessionSaveSucceeded: (frame: number) => RotoSessionSaveResult;
  getSessionDirtyFrames: () => Iterable<number>;
  executeSessionEffects: (effects: RotoSessionEffect[]) => Promise<void>;
  syncPendingFrames: () => void;
  upsertCachedFrame: (save: RotoRenderedSave) => void;
  removeCachedFrame: (frame: number) => void;
  removeEditableFrame: (frame: number) => void;
  setCachedReferenceUrl: (url: string | null) => void;
  setCachedRepaintBaseFrame: (frame: RotoRenderedFrame) => void;
  getEngine: () => EfxPaintEngine | null;
  getCurrentFrame: () => number;
  getBackgroundMode: () => Parameters<EfxPaintEngine['setBgMode']>[0];
  restorePreviewBase: (engine: EfxPaintEngine, dataUrl: string) => void;
  openFrameAfterSave: (frame: number) => Promise<void>;
  closeWindow: () => Promise<void>;
  setApplyStatus: (status: 'idle' | 'applying' | 'success' | 'error') => void;
  setApplyMessage: (message: string | ((current: string | null) => string | null)) => void;
  setLastError: (message: string | null) => void;
  setSavingFrame: (frame: number | null) => void;
  setClosePromptState: (state: 'idle' | 'prompt' | 'saving' | 'error') => void;
  setClosePromptMessage: (message: string | null) => void;
}

export function useRotoApplyResultController<State>(input: RotoApplyResultControllerInput<State>) {
  const clearPendingSave = useCallback(() => {
    input.pendingAdvanceRef.current = null;
    input.saveOnLeaveSourceFrameRef.current = null;
    input.saveOnLeaveRenderedFrameRef.current = null;
    input.pendingCachedMergeFrameRef.current = null;
    input.saveOnLeaveDeleteFrameRef.current = null;
    input.setSavingFrame(null);
  }, [input]);

  const clearCloseContinuation = useCallback(() => {
    input.closeAfterApplyOperationIdRef.current = null;
    input.closeAfterRotoSaveRequestedRef.current = false;
  }, [input]);

  const handleRotoApplyResult = useCallback((transition: AcceptedRotoApplyResult): boolean => {
    const completion = completeRotoApplyResult(transition, input.pendingKeyActionMessageRef.current);
    if (!completion) return false;

    if (completion.type === 'failure') {
      input.pendingKeyActionMessageRef.current = null;
      clearPendingSave();
      if (completion.frame !== null) {
        const failed = input.onSessionSaveFailed(completion.frame, 'Stay on this frame and try navigating again to retry.');
        input.dirtyFramesRef.current = new Set(input.getSessionDirtyFrames());
        input.syncPendingFrames();
        if (failed.message) input.setApplyMessage(failed.message);
      }
      if (completion.shouldCloseAfterSave) {
        clearCloseContinuation();
        input.setClosePromptState('error');
        input.setClosePromptMessage('Could not save before closing. Keep the window open and try again.');
      }
      input.setApplyStatus('error');
      input.setApplyMessage(completion.diagnosticMessage);
      input.setLastError(completion.diagnosticMessage);
      return true;
    }

    if (transition.shouldCloseAfterSave) {
      clearCloseContinuation();
      input.setClosePromptState('idle');
      input.setClosePromptMessage(null);
    }
    input.setApplyStatus('success');
    input.setLastError(null);

    if (completion.type === 'replace-key-frames') {
      input.setApplyMessage(completion.message);
      input.pendingKeyActionMessageRef.current = null;
      return true;
    }
    if (completion.type === 'update-interpolation-settings') {
      input.setApplyMessage((message) => message || 'Generated in-between settings synced.');
      return true;
    }

    const frame = completion.frame;
    const nextFrame = input.pendingAdvanceRef.current;
    const deletedFrame = input.saveOnLeaveDeleteFrameRef.current === frame;
    if (input.saveOnLeaveSourceFrameRef.current === frame && input.saveOnLeaveRenderedFrameRef.current) {
      input.upsertCachedFrame(input.saveOnLeaveRenderedFrameRef.current);
    } else if (deletedFrame) {
      input.removeCachedFrame(frame);
    }
    const saved = input.getSessionSavingFrame() === frame ? input.onSessionSaveSucceeded(frame) : null;
    input.dirtyFramesRef.current.delete(frame);
    input.capturedFramesRef.current.delete(frame);
    if (saved) input.dirtyFramesRef.current = new Set(input.getSessionDirtyFrames());
    input.syncPendingFrames();
    if (saved?.effects.length) void input.executeSessionEffects(saved.effects);
    const mergedFrame = input.pendingCachedMergeFrameRef.current?.frame === frame ? input.pendingCachedMergeFrameRef.current : null;
    if (mergedFrame) {
      input.upsertCachedFrame(mergedFrame);
      input.setCachedReferenceUrl(null);
      input.setCachedRepaintBaseFrame(mergedFrame.renderedFrame);
      input.frameStatesRef.current.delete(frame);
      input.liveOverlayActionCountsRef.current.delete(frame);
      input.removeEditableFrame(frame);
      input.pendingCachedMergeFrameRef.current = null;
      const engine = input.getEngine();
      if (engine && frame === input.getCurrentFrame()) {
        engine.setBgMode(input.getBackgroundMode());
        engine.clear();
        input.restorePreviewBase(engine, mergedFrame.renderedFrame.dataUrl);
      }
    }
    if (deletedFrame) input.removeEditableFrame(frame);
    clearPendingSave();
    if (nextFrame !== null) {
      void input.openFrameAfterSave(nextFrame).then(() => {
        input.setApplyMessage(`Saved roto frame ${frame}. Advanced to frame ${nextFrame}.`);
      });
    } else {
      input.setApplyMessage('Saved current frame');
    }
    if (completion.shouldCloseAfterSave) {
      input.closeGuardBypassRef.current = true;
      void input.closeWindow();
    }
    return true;
  }, [clearCloseContinuation, clearPendingSave, input]);

  return { handleRotoApplyResult };
}
