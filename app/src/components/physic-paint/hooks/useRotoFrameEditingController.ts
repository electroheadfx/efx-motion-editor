import { useCallback, useEffect } from 'preact/hooks';
import type { RefObject } from 'preact';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import type { AquarelleEnginePort } from '../engine/aquarelleEnginePort';
import type { RotoPreviewBasePort } from '../roto/rotoCoordinatorPorts';
import type { RotoEditableState } from '../types/paintCore';
import { buildBlankRotoFrame, buildRotoFrameFromCanvas, exportTransparentStrokeCanvas, type RenderedFramePayload } from '../roto/rotoCanvasFrames';
import { mergeRotoAlphaCanvases } from '../roto/physicsPaintRotoAlphaMerge';
import { hasEditableRotoContent, shouldPersistRotoFrame } from '../roto/rotoEditBufferTransactions';
import type { RotoTimelineSelectionKind } from '../roto/rotoTimelineSelectors';

interface RotoEditBufferPort<TEditable> {
  dirtyFramesRef: RefObject<Set<number>>;
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
    hasEditableContent: boolean;
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
  loadReferenceFrame: (frame: number, previewBase: RotoPreviewBasePort | null) => void;
}

interface RotoEditingStatusPort {
  setApplyStatus: (status: 'idle' | 'applying' | 'success' | 'error') => void;
  setApplyMessage: (message: string) => void;
}

/** The watercolor truth for ONE frame (3.5): counts from `aquarelleRecordState`. */
export interface RotoFrameTruth {
  recordedStrokeCount: number;
  payloadEventCount: number;
  bgMode: string;
}

export interface UseRotoFrameEditingControllerInput<TEditable extends RotoEditableState> {
  workflowMode: PhysicsPaintWorkflowMode;
  currentFrame: number;
  currentFrameSelectionKind: RotoTimelineSelectionKind;
  canvasSize: { width: number; height: number };
  /** The narrow watercolor engine port (never the engine itself). */
  engine: AquarelleEnginePort | null;
  /** The app-owned preview base (cached key paint under the live sheet). */
  previewBase: RotoPreviewBasePort | null;
  /** Per-frame watercolor truth for the persist law — never the engine-1 mirror. */
  getFrameTruth: (frame: number) => RotoFrameTruth;
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
  const snapshotCurrentFrame = useCallback(async () => {
    if (!input.engine || !input.launchContext) return false;
    const state = input.engine.snapshot() as TEditable;
    const truth = input.getFrameTruth(input.currentFrame);
    const hasCachedReference = Boolean(
      input.reference.cachedReferenceUrl
      || input.reference.cachedRepaintBaseFrame?.appFrame === input.currentFrame,
    );
    const persist = shouldPersistRotoFrame(truth);
    const shouldCapture = !(hasCachedReference && !input.editBuffer.dirtyFramesRef.current.has(input.currentFrame)) && persist;
    const capturedFrame = shouldCapture
      ? await buildRotoFrameFromCanvas(
        // The live sheet holds only THIS session's strokes; the cached key's
        // paint is the app-owned preview base and must be merged under it in
        // transmittance space (the same pigment-alpha law the capture path
        // uses). Without this, an Update-frame on a cached key drops its paint.
        await mergeRotoAlphaCanvases(
          input.reference.cachedRepaintBaseFrame,
          exportTransparentStrokeCanvas(input.engine),
          input.canvasSize,
          undefined,
          'pigment-alpha',
        ),
        input.currentFrame,
        input.canvasSize,
      )
      : await buildBlankRotoFrame(input.canvasSize.width, input.canvasSize.height, input.currentFrame);
    return input.editBuffer.snapshotFrame({
      frame: input.currentFrame,
      state,
      capturedFrame,
      hasCachedReference,
      shouldPersist: persist,
      hasEditableContent: hasEditableRotoContent(truth),
    });
  }, [input]);

  const undo = useCallback(() => {
    if (input.isMutationLocked?.()) return false;
    input.playback.stop();
    if (!input.engine?.undo()) return false;
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
    if (!input.engine?.redo()) return false;
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
      // Faithful mapping of engine-1's `resetBackground()`: the app-owned
      // preview base has no engine background (the Studio fond is the
      // background), so this is a no-op. It must NOT be `clearPreviewBaseImage()`
      // — that wipes the visible multiply base and the first dirty stroke would
      // erase the cached key's paint.
      input.previewBase?.resetBackground();
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
    input.previewBase?.clearPreviewBaseImage();
    input.previewBase?.resetBackground();
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
    input.reference.loadReferenceFrame(input.currentFrame, input.previewBase);
    // `input.engine` stays in the deps: the preview base port is memoized from
    // mount, so the engine identity is what re-runs the load once the sheet is
    // actually mounted (otherwise the first frame enter is lost).
  }, [input.currentFrame, input.engine, input.previewBase, input.launchContext?.layerId, input.launchContext?.operationId, input.reference.loadReferenceFrame, input.workflowMode]);

  return { undo, redo, beginFrameEdit, acceptScriptBrush, clearCurrentFrame, snapshotCurrentFrame };
}
