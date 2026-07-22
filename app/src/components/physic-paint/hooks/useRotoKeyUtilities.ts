import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoSegmentSpacingOverride } from '../../../types/physicPaint';
import { createRotoSession, type RotoSession, type RotoSessionActionResult, type RotoSessionCopiedKey, type RotoSessionEffect } from '../roto/physicsPaintRotoSession';
import type { RotoKeyUtilityTransaction } from '../roto/physicsPaintRotoKeyController';
import type { PhysicPaintRotoRealKeyPayload } from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalKeyUtilityPort } from '../roto/rotoCoordinatorPorts';

export interface RotoKeyUtilitiesInput<TPreview extends { appFrame: number }> {
  currentFrame: number;
  currentKeyId: string | null;
  physicalKeyUtilities: RotoPhysicalKeyUtilityPort;
  realKeyFrames: readonly PhysicPaintRotoCacheFrame[];
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  dirtyFrames: ReadonlySet<number>;
  canvasSize: { width: number; height: number };
  applyStatus: 'idle' | 'applying' | 'success' | 'error';
  flushInFlight: boolean;
  buildBlankRotoFrame: (frame: number) => PhysicPaintRotoCacheFrame;
  resolveSourceFrameForDisplayFrame: (displayFrame: number) => number | null;
  resolveDisplayFrameForSourceFrame?: (sourceFrame: number, transaction: RotoKeyUtilityTransaction) => number | null;
  resolvePasteTargetForDisplayFrame: (displayFrame: number) => { displayFrame: number; sourceFrame: number; previousSegmentOverride: PhysicPaintRotoSegmentSpacingOverride | null } | null;
  segmentSpacingOverrides?: readonly PhysicPaintRotoSegmentSpacingOverride[];
  getPreviewFrames: () => ReadonlyMap<number, TPreview>;
  setPreviewFrames: (frames: Map<number, TPreview | PhysicPaintRotoCacheFrame>) => void;
  setDirtyFrames: (frames: Set<number>) => void;
  syncPendingRotoFrames: () => void;
  restoreFrame: (effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>, refreshedCacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => void;
  clearCanvas: (frame: number) => void;
  showCachedReference: (frame: PhysicPaintRotoCacheFrame) => void;
  navigate: (frame: number) => Promise<void | boolean>;
  clearGeneratedFrame: (frame: number) => void;
  clearCachedReferenceFrame: (frame: number) => void;
  clearDeletedFrame: (frame: number) => void;
  setApplyMessage: (message: string | null) => void;
  setApplyStatus: (status: 'idle' | 'applying' | 'success' | 'error') => void;
  setLastError: (message: string | null) => void;
}

export interface RotoKeyUtilities {
  session: RotoSession;
  keyActionInFlight: boolean;
  resetSession: (options?: { clearClipboard?: boolean }) => void;
  executeSessionEffects: (effects: readonly RotoSessionEffect[]) => Promise<void>;
  runSessionResult: (result: RotoSessionActionResult, sourceSession?: RotoSession) => Promise<void>;
  duplicateKey: () => void;
  copyKey: () => void;
  pasteKey: () => void;
}

export function useRotoKeyUtilities<TPreview extends { appFrame: number }>(input: RotoKeyUtilitiesInput<TPreview>): RotoKeyUtilities {
  const [keyActionInFlight, setKeyActionInFlight] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const copiedKeyRef = useRef<RotoSessionCopiedKey | null>(null);

  const session = useMemo(() => createRotoSession({
    currentFrame: input.currentFrame,
    realKeyFrames: input.realKeyFrames,
    cachedRotoFrames: input.cachedRotoFrames,
    dirtyFrames: input.dirtyFrames,
    copiedKey: copiedKeyRef.current,
    canvasSize: input.canvasSize,
    keyActionInFlight,
    applyStatus: input.applyStatus,
    flushInFlight: input.flushInFlight,
    buildBlankRotoFrame: input.buildBlankRotoFrame,
    resolveSourceFrameForDisplayFrame: input.resolveSourceFrameForDisplayFrame,
    resolveDisplayFrameForSourceFrame: input.resolveDisplayFrameForSourceFrame,
    resolvePasteTargetForDisplayFrame: input.resolvePasteTargetForDisplayFrame,
    segmentSpacingOverrides: input.segmentSpacingOverrides,
  }), [
    input.currentFrame,
    input.realKeyFrames,
    input.cachedRotoFrames,
    input.dirtyFrames,
    input.canvasSize,
    keyActionInFlight,
    input.applyStatus,
    input.flushInFlight,
    input.buildBlankRotoFrame,
    input.resolveSourceFrameForDisplayFrame,
    input.resolveDisplayFrameForSourceFrame,
    input.resolvePasteTargetForDisplayFrame,
    input.segmentSpacingOverrides,
    sessionVersion,
  ]);

  const resetSession = useCallback((options?: { clearClipboard?: boolean }) => {
    if (options?.clearClipboard !== false) {
      copiedKeyRef.current = null;
    }
    setSessionVersion((version) => version + 1);
  }, []);

  const executeSessionEffects = useCallback(async (effects: readonly RotoSessionEffect[]) => {
    for (const effect of effects) {
      switch (effect.type) {
        case 'replaceKeys':
          throw new Error('Roto key replacement requires the physical edit coordinator.');
        case 'restoreFrame':
          input.restoreFrame(effect);
          break;
        case 'clearCanvas':
          input.clearCanvas(effect.frame);
          break;
        case 'showCachedReference':
          input.showCachedReference(effect.frameData);
          break;
        case 'navigate':
          await input.navigate(effect.frame);
          break;
        case 'clearGeneratedFrames':
          for (const frame of effect.frames) input.clearGeneratedFrame(frame);
          break;
        case 'clearCachedReferences':
        case 'clearBackgroundOnlySupport':
          for (const frame of effect.frames) input.clearCachedReferenceFrame(frame);
          break;
        case 'clearDeletedFrames':
          for (const frame of effect.frames) input.clearDeletedFrame(frame);
          break;
        default: {
          const exhaustive: never = effect;
          throw new Error(`Unknown Roto session effect: ${JSON.stringify(exhaustive)}`);
        }
      }
    }
  }, [input]);

  const runSessionResult = useCallback(async (result: RotoSessionActionResult, sourceSession = session) => {
    if (!result.ok) {
      if (result.message) input.setApplyMessage(result.message);
      return;
    }
    const hasSessionEffects = result.effects.length > 0;
    if (hasSessionEffects) setKeyActionInFlight(true);
    try {
      if (hasSessionEffects) await executeSessionEffects(result.effects);
      if (result.message) input.setApplyMessage(result.message);
      input.setLastError(null);
      input.setDirtyFrames(new Set(sourceSession.dirtyFrames.value));
      copiedKeyRef.current = sourceSession.copiedKey.value;
      if (hasSessionEffects) {
        input.syncPendingRotoFrames();
        setSessionVersion((version) => version + 1);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not complete Roto session action. ${detail}`;
      input.setApplyStatus('error');
      input.setApplyMessage(message);
      input.setLastError(message);
    } finally {
      if (hasSessionEffects) setKeyActionInFlight(false);
    }
  }, [executeSessionEffects, input, session]);

  const requireCurrentRealKey = useCallback(() => {
    const actionState = session.actionAvailability.value;
    if (actionState.currentIsRealKey) return true;
    input.setApplyMessage(actionState.disabledReason ?? 'Key utilities require a real Roto key. Generated in-betweens are render-only.');
    return false;
  }, [input, session]);

  const blocked = keyActionInFlight || input.flushInFlight || input.applyStatus === 'applying';

  const duplicateKey = useCallback(() => {
    if (blocked || !requireCurrentRealKey()) return;
    const sourceKeyId = input.currentKeyId;
    if (!sourceKeyId) {
      input.setApplyMessage('The selected Roto key is no longer available.');
      return;
    }
    setKeyActionInFlight(true);
    void input.physicalKeyUtilities.duplicateKey(sourceKeyId).catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      input.setApplyStatus('error');
      input.setApplyMessage('Could not duplicate the Roto key.');
      input.setLastError(detail);
    }).finally(() => {
      setKeyActionInFlight(false);
    });
  }, [blocked, input, requireCurrentRealKey]);

  const copyKey = useCallback(() => {
    if (blocked) return;
    const actionState = session.actionAvailability.value;
    if (!actionState.currentIsRealKey) {
      input.setApplyMessage(actionState.disabledReason ?? 'Key utilities require a real Roto key. Generated in-betweens are render-only.');
      return;
    }
    void runSessionResult(session.copyKey());
  }, [blocked, input, runSessionResult, session]);

  const pasteKey = useCallback(() => {
    if (blocked) return;
    const actionState = session.actionAvailability.value;
    if (!actionState.canPaste) {
      input.setApplyMessage(actionState.pasteDisabledReason ?? 'Copy a real Roto key before pasting.');
      return;
    }
    const copiedKey = session.copiedKey.value;
    if (!copiedKey) {
      input.setApplyMessage('Copy a real Roto key before pasting.');
      return;
    }
    const clipboardPayload = toClipboardPayload(copiedKey);
    setKeyActionInFlight(true);
    void input.physicalKeyUtilities.pasteKey(
      input.currentFrame,
      clipboardPayload,
      input.currentKeyId,
    ).catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      input.setApplyStatus('error');
      input.setApplyMessage('Could not paste the copied Roto paint.');
      input.setLastError(detail);
    }).finally(() => {
      setKeyActionInFlight(false);
    });
  }, [blocked, input, session]);

  return {
    session,
    keyActionInFlight,
    resetSession,
    executeSessionEffects,
    runSessionResult,
    duplicateKey,
    copyKey,
    pasteKey,
  };
}

function toClipboardPayload(copiedKey: RotoSessionCopiedKey): PhysicPaintRotoRealKeyPayload {
  const frame = copiedKey.cachedFrame;
  return Object.freeze({
    frameIndex: frame.frameIndex,
    appFrame: copiedKey.frame,
    dataUrl: frame.dataUrl,
    ...(frame.width !== undefined ? { width: frame.width } : {}),
    ...(frame.height !== undefined ? { height: frame.height } : {}),
  }) as PhysicPaintRotoRealKeyPayload;
}
