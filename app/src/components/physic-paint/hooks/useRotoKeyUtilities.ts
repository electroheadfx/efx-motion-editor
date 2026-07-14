import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoSegmentSpacingOverride } from '../../../types/physicPaint';
import { applyRotoKeyUtilityTransactionToLocalState, type RotoKeyUtilityTransaction } from '../roto/physicsPaintRotoKeyController';
import { createRotoSession, type RotoSession, type RotoSessionActionResult, type RotoSessionCopiedKey, type RotoSessionEffect } from '../roto/physicsPaintRotoSession';

export interface RotoKeyUtilitiesInput<TPreview extends { appFrame: number }> {
  currentFrame: number;
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
  syncRotoKeyFrameLists: (cacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => void;
  applyRotoKeyFrames: (transaction: RotoKeyUtilityTransaction) => readonly PhysicPaintRotoCacheFrame[];
  persistRotoKeyFrameTransaction: (transaction: RotoKeyUtilityTransaction) => Promise<void>;
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
  insertBlankKey: () => void;
  deleteKey: () => void;
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

  const applyTransaction = useCallback((transaction: RotoKeyUtilityTransaction): readonly PhysicPaintRotoCacheFrame[] => {
    const nextLocalState = applyRotoKeyUtilityTransactionToLocalState({
      editableStates: new Map(),
      previewFrames: input.getPreviewFrames(),
      transaction,
    });
    input.setPreviewFrames(nextLocalState.previewFrames as Map<number, TPreview | PhysicPaintRotoCacheFrame>);
    const refreshedCacheFrames = input.applyRotoKeyFrames(transaction);
    const publishedFrames = refreshedCacheFrames.length > 0 ? refreshedCacheFrames : transaction.realKeyFrames;
    input.syncRotoKeyFrameLists(publishedFrames);
    return publishedFrames;
  }, [input]);

  const executeSessionEffects = useCallback(async (effects: readonly RotoSessionEffect[]) => {
    let replacedRotoKeys = false;
    let refreshedCacheFrames: readonly PhysicPaintRotoCacheFrame[] | undefined;
    for (const effect of effects) {
      switch (effect.type) {
        case 'replaceKeys':
          refreshedCacheFrames = applyTransaction(effect.transaction);
          replacedRotoKeys = true;
          void input.persistRotoKeyFrameTransaction(effect.transaction).catch((error) => {
            const detail = error instanceof Error ? error.message : String(error);
            const message = `Could not persist Roto key changes. ${detail}`;
            input.setApplyStatus('error');
            input.setApplyMessage(message);
            input.setLastError(message);
          });
          break;
        case 'restoreFrame':
          input.restoreFrame(effect, refreshedCacheFrames);
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
          if (!replacedRotoKeys) for (const frame of effect.frames) input.clearGeneratedFrame(frame);
          break;
        case 'clearCachedReferences':
        case 'clearBackgroundOnlySupport':
          if (!replacedRotoKeys) for (const frame of effect.frames) input.clearCachedReferenceFrame(frame);
          break;
        case 'clearDeletedFrames':
          if (!replacedRotoKeys) for (const frame of effect.frames) input.clearDeletedFrame(frame);
          break;
        default: {
          const exhaustive: never = effect;
          throw new Error(`Unknown Roto session effect: ${JSON.stringify(exhaustive)}`);
        }
      }
    }
  }, [applyTransaction, input, session]);

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
    void runSessionResult(session.duplicateKey());
  }, [blocked, input, requireCurrentRealKey, runSessionResult, session]);

  const insertBlankKey = useCallback(() => {
    if (blocked || !requireCurrentRealKey()) return;
    void runSessionResult(session.insertBlankKey());
  }, [blocked, input, requireCurrentRealKey, runSessionResult, session]);

  const deleteKey = useCallback(() => {
    if (blocked || !requireCurrentRealKey()) return;
    void runSessionResult(session.deleteKey());
  }, [blocked, input, requireCurrentRealKey, runSessionResult, session]);

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
    void runSessionResult(session.pasteKey());
  }, [blocked, input, runSessionResult, session]);

  return {
    session,
    keyActionInFlight,
    resetSession,
    executeSessionEffects,
    runSessionResult,
    duplicateKey,
    insertBlankKey,
    deleteKey,
    copyKey,
    pasteKey,
  };
}
