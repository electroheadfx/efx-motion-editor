import { useCallback, useEffect, type MutableRef } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { buildBlankRotoFrame, buildRotoFrameFromCanvas, exportTransparentStrokeCanvas, type RenderedFramePayload } from '../roto/rotoCanvasFrames';
import { shouldPersistRotoFrame, type RotoEditableState } from '../roto/rotoEditBufferTransactions';
import type { RotoTimelineSelectionKind } from '../roto/rotoTimelineSelectors';

interface RotoEditBufferPort<TEditable> {
  dirtyFramesRef: MutableRef<Set<number>>;
  markDirty: (frame: number) => void;
  undoOverlay: (frame: number) => 'empty' | 'dirty' | 'unchanged';
  redoOverlay?: (frame: number) => boolean;
  clearCachedOverlay: (frame: number) => void;
  clearFrame: (frame: number) => void;
  snapshotFrame: (input: {
    frame: number;
    state: TEditable;
    capturedFrame: RenderedFramePayload;
    hasCachedReference: boolean;
    shouldPersist: boolean;
  }) => boolean;
}

interface RotoSessionEditingPort {
  markLiveOverlayDirty: (frame: number) => void;
  markLiveOverlayEmpty: (frame: number) => void;
}

interface RotoReferenceEditingPort {
  cachedReferenceUrl: string | null;
  cachedRepaintBaseFrame: RenderedFramePayload | null;
  clearReference: () => void;
  resetReference: () => void;
  setReferenceUrl: (url: string | null) => void;
  loadReferenceFrame: (frame: number, engine: PreviewBackgroundEngine | null) => void;
}

interface RotoEditingStatusPort {
  setApplyStatus: (status: 'idle' | 'applying' | 'success' | 'error') => void;
  setApplyMessage: (message: string) => void;
}

type PreviewBackgroundEngine = EfxPaintEngine & {
  resetBackground: () => void;
};

type UndoRedoEngine = EfxPaintEngine & {
  undo: () => boolean;
  redo: () => boolean;
};

export interface UseRotoFrameEditingControllerInput<TEditable extends RotoEditableState> {
  workflowMode: PhysicsPaintWorkflowMode;
  currentFrame: number;
  currentFrameSelectionKind: RotoTimelineSelectionKind;
  canvasSize: { width: number; height: number };
  engine: EfxPaintEngine | null;
  launchContext: PhysicPaintLaunchContext | null;
  editBuffer: RotoEditBufferPort<TEditable>;
  session: RotoSessionEditingPort;
  reference: RotoReferenceEditingPort;
  clearCachedFrame: (keyId: string, appFrame: number, size: { width: number; height: number }) => boolean;
  playback: { stop: () => void };
  syncPendingFrames: () => void;
  status: RotoEditingStatusPort;
  isMutationLocked?: () => boolean;
  /** Physical selected keyId (D-01/D-10). Identity-based editing cutover. */
  selectedKeyId?: string | null;
  /** Physical selected real-key record (D-01). Re-read at action time for stale-identity guard. */
  selectedRealKey?: { keyId: string; appFrame: number } | null;
  /** Physical current semantic cell (D-10). Real/generated/empty cell at the navigation frame. */
  currentCell?: { kind: string; appFrame: number; keyId?: string } | null;
}

export function useRotoFrameEditingController<TEditable extends RotoEditableState>(input: UseRotoFrameEditingControllerInput<TEditable>) {
  const snapshotCurrentFrame = useCallback(() => {
    if (!input.engine || !input.launchContext) return false;
    const state = input.engine.save() as TEditable;
    const hasCachedReference = Boolean(
      input.reference.cachedReferenceUrl
      || input.reference.cachedRepaintBaseFrame?.appFrame === input.currentFrame,
    );
    const persist = shouldPersistRotoFrame(state);
    const shouldCapture = !(hasCachedReference && !input.editBuffer.dirtyFramesRef.current.has(input.currentFrame)) && persist;
    const capturedFrame = shouldCapture
      ? buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(input.engine), input.currentFrame, input.canvasSize)
      : buildBlankRotoFrame(input.canvasSize.width, input.canvasSize.height, input.currentFrame);
    return input.editBuffer.snapshotFrame({
      frame: input.currentFrame,
      state,
      capturedFrame,
      hasCachedReference,
      shouldPersist: persist,
    });
  }, [input]);

  const undo = useCallback(() => {
    if (input.isMutationLocked?.()) return false;
    input.playback.stop();
    if (!(input.engine as UndoRedoEngine | null)?.undo()) return false;
    if (input.workflowMode === 'roto' && input.reference.cachedRepaintBaseFrame?.appFrame === input.currentFrame) {
      const ownership = input.editBuffer.undoOverlay(input.currentFrame);
      if (ownership === 'empty') input.session.markLiveOverlayEmpty(input.currentFrame);
      else if (ownership === 'dirty') input.session.markLiveOverlayDirty(input.currentFrame);
      if (ownership !== 'unchanged') input.syncPendingFrames();
    }
    return true;
  }, [input]);

  const redo = useCallback(() => {
    if (input.isMutationLocked?.()) return false;
    input.playback.stop();
    if (!(input.engine as UndoRedoEngine | null)?.redo()) return false;
    if (input.workflowMode === 'roto' && input.reference.cachedRepaintBaseFrame?.appFrame === input.currentFrame) {
      input.editBuffer.redoOverlay?.(input.currentFrame);
      input.session.markLiveOverlayDirty(input.currentFrame);
      input.syncPendingFrames();
    }
    return true;
  }, [input]);

  const markCurrentFrameDirty = useCallback(() => {
    if (input.workflowMode !== 'roto') return;
    if (input.currentFrameSelectionKind === 'generated-interpolation') {
      input.status.setApplyMessage(`Generated frame ${input.currentFrame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.`);
      return;
    }
    const alreadyDirty = input.editBuffer.dirtyFramesRef.current.has(input.currentFrame);
    input.editBuffer.markDirty(input.currentFrame);
    input.session.markLiveOverlayDirty(input.currentFrame);
    input.playback.stop();
    if (!alreadyDirty) {
      input.reference.clearReference();
      (input.engine as PreviewBackgroundEngine | null)?.resetBackground?.();
    }
    input.syncPendingFrames();
  }, [input]);

  const beginFrameEdit = useCallback(() => {
    input.playback.stop();
    markCurrentFrameDirty();
  }, [input.playback, markCurrentFrameDirty]);

  const acceptScriptBrush = useCallback(() => {
    if (input.workflowMode !== 'roto' || input.currentFrameSelectionKind === 'generated-interpolation') return;
    input.editBuffer.markDirty(input.currentFrame);
    input.session.markLiveOverlayDirty(input.currentFrame);
    input.playback.stop();
    input.syncPendingFrames();
  }, [input]);

  const clearCurrentFrame = useCallback(() => {
    const selectedKeyId = input.selectedKeyId;
    const selectedRealKey = input.selectedRealKey;
    const currentCell = input.currentCell;
    if (
      input.isMutationLocked?.()
      || !input.engine
      || !input.launchContext
      || input.workflowMode !== 'roto'
      || input.currentFrameSelectionKind !== 'real-key'
      || !selectedKeyId
      || !selectedRealKey
      || selectedRealKey.keyId !== selectedKeyId
      || selectedRealKey.appFrame !== input.currentFrame
      || currentCell?.kind !== 'real'
      || currentCell.keyId !== selectedKeyId
      || currentCell.appFrame !== selectedRealKey.appFrame
    ) return false;

    const appFrame = selectedRealKey.appFrame;
    if (!input.clearCachedFrame(selectedKeyId, appFrame, input.canvasSize)) return false;
    input.playback.stop();
    input.engine.clear();
    (input.engine as PreviewBackgroundEngine).clearPreviewBaseImage();
    (input.engine as PreviewBackgroundEngine).resetBackground();
    input.reference.resetReference();
    input.editBuffer.clearFrame(appFrame);
    input.session.markLiveOverlayEmpty(appFrame);
    input.syncPendingFrames();
    input.status.setApplyStatus('success');
    input.status.setApplyMessage(`Cleared roto frame ${appFrame}.`);
    return true;
  }, [input]);

  useEffect(() => {
    if (input.workflowMode !== 'roto') return;
    input.reference.loadReferenceFrame(input.currentFrame, input.engine as PreviewBackgroundEngine | null);
  }, [input.currentFrame, input.engine, input.launchContext?.layerId, input.launchContext?.operationId, input.reference.loadReferenceFrame, input.workflowMode]);

  return { undo, redo, beginFrameEdit, acceptScriptBrush, clearCurrentFrame, snapshotCurrentFrame };
}
