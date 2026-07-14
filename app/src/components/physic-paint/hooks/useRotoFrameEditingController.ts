import { useCallback, useEffect, type MutableRef } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { buildBlankRotoFrame, buildRotoFrameFromCanvas, exportTransparentStrokeCanvas, type RenderedFramePayload } from '../roto/rotoCanvasFrames';
import { shouldPersistRotoFrame, type RotoEditableState } from '../roto/rotoSaveTransactions';
import type { RotoTimelineSelectionKind } from '../roto/rotoTimelineSelectors';

interface RotoEditBufferPort<TEditable> {
  dirtyFramesRef: MutableRef<Set<number>>;
  markDirty: (frame: number) => void;
  undoOverlay: (frame: number) => 'empty' | 'dirty' | 'unchanged';
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
  clearCachedFrame: (frame: number, size: { width: number; height: number }) => void;
  playback: { stop: () => void };
  syncPendingFrames: () => void;
  status: RotoEditingStatusPort;
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
    input.engine?.undo();
    if (input.workflowMode === 'roto' && input.reference.cachedRepaintBaseFrame?.appFrame === input.currentFrame) {
      if (input.editBuffer.undoOverlay(input.currentFrame) === 'empty') {
        input.session.markLiveOverlayEmpty(input.currentFrame);
        input.syncPendingFrames();
      }
    }
  }, [input]);

  const markCurrentFrameDirty = useCallback(() => {
    if (input.workflowMode !== 'roto') return;
    if (input.currentFrameSelectionKind !== 'real-key') {
      const label = input.currentFrameSelectionKind === 'generated-interpolation' ? 'Generated' : 'Empty';
      input.status.setApplyMessage(`${label} frame ${input.currentFrame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.`);
      return;
    }
    input.editBuffer.markDirty(input.currentFrame);
    input.session.markLiveOverlayDirty(input.currentFrame);
    input.reference.clearReference();
    input.playback.stop();
    (input.engine as PreviewBackgroundEngine | null)?.resetBackground?.();
    input.syncPendingFrames();
  }, [input]);

  const beginFrameEdit = useCallback(() => {
    input.playback.stop();
    markCurrentFrameDirty();
  }, [input.playback, markCurrentFrameDirty]);

  const clearCurrentFrame = useCallback(() => {
    if (!input.engine || !input.launchContext || input.workflowMode !== 'roto' || input.currentFrameSelectionKind !== 'real-key') return false;
    input.playback.stop();
    input.engine.clear();
    (input.engine as PreviewBackgroundEngine).clearPreviewBaseImage();
    (input.engine as PreviewBackgroundEngine).resetBackground();
    input.reference.resetReference();
    input.editBuffer.clearFrame(input.currentFrame);
    input.session.markLiveOverlayEmpty(input.currentFrame);
    input.clearCachedFrame(input.currentFrame, input.canvasSize);
    input.syncPendingFrames();
    input.status.setApplyStatus('success');
    input.status.setApplyMessage(`Cleared roto frame ${input.currentFrame}.`);
    return true;
  }, [input]);

  useEffect(() => {
    if (input.workflowMode !== 'roto') return;
    input.reference.loadReferenceFrame(input.currentFrame, input.engine as PreviewBackgroundEngine | null);
  }, [input.currentFrame, input.engine, input.launchContext, input.reference.loadReferenceFrame, input.workflowMode]);

  return { undo, beginFrameEdit, clearCurrentFrame, snapshotCurrentFrame };
}
