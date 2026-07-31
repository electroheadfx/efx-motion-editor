import { useCallback, useMemo, useRef, useState } from 'preact/hooks';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { createRotoSession, isRotoSessionCopiedKeyGroup, type RotoSession, type RotoSessionActionResult, type RotoSessionCopiedGroupEntry, type RotoSessionCopiedKey, type RotoSessionCopiedKeyValue, type RotoSessionEffect } from '../roto/physicsPaintRotoSession';
import type { PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalKeyUtilityPort } from '../roto/rotoCoordinatorPorts';

export interface RotoKeyUtilitiesInput {
  currentFrame: number;
  currentKeyId: string | null;
  physicalKeyUtilities: RotoPhysicalKeyUtilityPort;
  getSelectedKeyIds: () => readonly string[];
  getRotoKeyRecords: () => readonly PhysicPaintRotoRealKeyRecord[];
  realKeyFrames: readonly PhysicPaintRotoCacheFrame[];
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  dirtyFrames: ReadonlySet<number>;
  canvasSize: { width: number; height: number };
  applyStatus: 'idle' | 'applying' | 'success' | 'error';
  flushInFlight: boolean;
  buildBlankRotoFrame: (frame: number) => PhysicPaintRotoCacheFrame;
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
  cutKey: (deleteSelection: () => Promise<boolean>) => void;
  pasteKey: () => void;
  addKey: () => void;
}

export function useRotoKeyUtilities(input: RotoKeyUtilitiesInput): RotoKeyUtilities {
  const [keyActionInFlight, setKeyActionInFlight] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const copiedKeyRef = useRef<RotoSessionCopiedKeyValue | null>(null);

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

  // Shared copy-side selection resolution (quick 260731-9l0): publishes its
  // own failure messages and returns null when it already messaged; otherwise
  // returns the raw session result so callers can compose Copy or Cut.
  const resolveCopySelection = useCallback((): RotoSessionActionResult | null => {
    const selectedKeyIds = input.getSelectedKeyIds();
    if (selectedKeyIds.length >= 2) {
      const records = input.getRotoKeyRecords();
      const entries: RotoSessionCopiedGroupEntry[] = [];
      for (const keyId of selectedKeyIds) {
        const record = records.find((candidate) => candidate.keyId === keyId);
        if (!record) {
          input.setApplyMessage('The selected Roto keys are no longer available.');
          return null;
        }
        entries.push(Object.freeze({ payload: record.payload, sourceAppFrame: record.appFrame, sourceKeyId: record.keyId }));
      }
      entries.sort((a, b) => a.sourceAppFrame - b.sourceAppFrame);
      return session.copyKeyGroup(entries);
    }
    const actionState = session.actionAvailability.value;
    if (!actionState.currentIsRealKey) {
      input.setApplyMessage(actionState.disabledReason ?? 'Key utilities require a real Roto key. Generated in-betweens are render-only.');
      return null;
    }
    return session.copyKey();
  }, [input, session]);

  const copyKey = useCallback(() => {
    if (blocked) return;
    const result = resolveCopySelection();
    if (result) void runSessionResult(result);
  }, [blocked, resolveCopySelection, runSessionResult]);

  // Cut (quick 260731-9l0): fail-closed copy + delete composition. The
  // pre-cut clipboard is snapshotted before copying; if the delete half
  // resolves false or rejects, BOTH the live session clipboard and the
  // rebuild-seed ref are restored so an earlier copied key survives intact.
  const cutKey = useCallback((deleteSelection: () => Promise<boolean>) => {
    if (blocked) return;
    const previousClipboard = session.copiedKey.value;
    const cutKeyCount = input.getSelectedKeyIds().length;
    const result = resolveCopySelection();
    if (!result) return;
    if (!result.ok) {
      if (result.message) input.setApplyMessage(result.message);
      return;
    }
    copiedKeyRef.current = session.copiedKey.value;
    setKeyActionInFlight(true);
    void deleteSelection().then((deleted) => {
      if (deleted) {
        input.setApplyMessage(cutKeyCount >= 2 ? `Cut ${cutKeyCount} Roto keys to the clipboard.` : 'Cut the Roto key to the clipboard.');
        input.setLastError(null);
        return;
      }
      session.copiedKey.value = previousClipboard;
      copiedKeyRef.current = previousClipboard;
      input.setApplyMessage('Cut canceled — the selected keys could not be deleted. Clipboard unchanged.');
    }).catch((error) => {
      session.copiedKey.value = previousClipboard;
      copiedKeyRef.current = previousClipboard;
      const detail = error instanceof Error ? error.message : String(error);
      input.setApplyStatus('error');
      input.setApplyMessage('Could not cut the selected Roto keys.');
      input.setLastError(detail);
    }).finally(() => {
      setKeyActionInFlight(false);
    });
  }, [blocked, input, resolveCopySelection, session]);

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
    if (isRotoSessionCopiedKeyGroup(copiedKey)) {
      setKeyActionInFlight(true);
      void input.physicalKeyUtilities.pasteKeyGroup(
        input.currentFrame,
        copiedKey.entries,
      ).catch((error) => {
        const detail = error instanceof Error ? error.message : String(error);
        input.setApplyStatus('error');
        input.setApplyMessage('Could not paste the copied Roto key group.');
        input.setLastError(detail);
      }).finally(() => {
        setKeyActionInFlight(false);
      });
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

  // + Key: promote the current empty/generated frame to a real, paintable key
  // carrying empty paint. Routes through the physical paste-to-empty machinery
  // with a blank payload, mirroring the script-target promotion path.
  const addKey = useCallback(() => {
    if (blocked) return;
    const actionState = session.actionAvailability.value;
    if (actionState.currentIsRealKey) {
      input.setApplyMessage('The current frame already has a real Roto key.');
      return;
    }
    const blank = input.buildBlankRotoFrame(input.currentFrame);
    setKeyActionInFlight(true);
    void input.physicalKeyUtilities.addEmptyKey(
      input.currentFrame,
      toEmptyKeyPayload(blank, input.currentFrame),
    ).catch((error) => {
      const detail = error instanceof Error ? error.message : String(error);
      input.setApplyStatus('error');
      input.setApplyMessage('Could not add an empty Roto key.');
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
    cutKey,
    pasteKey,
    addKey,
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

function toEmptyKeyPayload(blank: PhysicPaintRotoCacheFrame, destinationAppFrame: number): PhysicPaintRotoRealKeyPayload {
  return Object.freeze({
    frameIndex: blank.frameIndex,
    appFrame: destinationAppFrame,
    dataUrl: blank.dataUrl,
    ...(blank.width !== undefined ? { width: blank.width } : {}),
    ...(blank.height !== undefined ? { height: blank.height } : {}),
  }) as PhysicPaintRotoRealKeyPayload;
}
