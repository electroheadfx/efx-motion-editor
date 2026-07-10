import { useCallback, useEffect, useState, type MutableRef } from 'preact/hooks';
import type { PhysicPaintApplyPayload } from '../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from './physicsPaintWorkflowState';

export type RotoClosePromptState = 'idle' | 'prompt' | 'saving' | 'error';

interface RotoCloseLifecycleInput {
  workflowMode: PhysicsPaintWorkflowMode;
  currentFrame: number;
  dirtyFramesRef: MutableRef<Set<number>>;
  closeGuardBypassRef: MutableRef<boolean>;
  closeAfterApplyOperationIdRef: MutableRef<string | null>;
  closeAfterRotoSaveRequestedRef: MutableRef<boolean>;
  snapshotCurrentRotoFrame: () => boolean;
  saveCurrentRotoFrame: (options: { onPayload: (payload: PhysicPaintApplyPayload) => void }) => Promise<PhysicPaintApplyPayload | null>;
}

export function useRotoCloseLifecycle(input: RotoCloseLifecycleInput) {
  const [rotoClosePromptState, setRotoClosePromptState] = useState<RotoClosePromptState>('idle');
  const [rotoClosePromptMessage, setRotoClosePromptMessage] = useState<string | null>(null);

  const closePhysicsPaintWindow = useCallback(async () => {
    try {
      const windowApi = await import('@tauri-apps/api/window');
      const appWindow = windowApi.getCurrentWindow();
      if (typeof appWindow.close === 'function') {
        await appWindow.close();
        return;
      }
    } catch {
      // Browser fallback below is expected outside Tauri.
    }
    window.close();
  }, []);

  const closeWithoutSavingRotoFrame = useCallback(() => {
    input.closeAfterApplyOperationIdRef.current = null;
    input.closeGuardBypassRef.current = true;
    setRotoClosePromptState('idle');
    setRotoClosePromptMessage(null);
    void closePhysicsPaintWindow();
  }, [closePhysicsPaintWindow, input]);

  const cancelRotoClose = useCallback(() => {
    input.closeAfterApplyOperationIdRef.current = null;
    input.closeGuardBypassRef.current = false;
    setRotoClosePromptState('idle');
    setRotoClosePromptMessage(null);
  }, [input]);

  const saveAndCloseRotoFrame = useCallback(async () => {
    if (input.closeAfterRotoSaveRequestedRef.current) return;
    input.closeAfterRotoSaveRequestedRef.current = true;
    input.closeGuardBypassRef.current = true;
    setRotoClosePromptState('idle');
    setRotoClosePromptMessage(null);
    try {
      const payload = await input.saveCurrentRotoFrame({
        onPayload: (payload) => {
          input.closeAfterApplyOperationIdRef.current = payload.operationId;
          if (payload.kind === 'apply-canvas') payload.closeWindowAfterApply = true;
        },
      });
      if (!payload?.operationId) {
        input.closeAfterApplyOperationIdRef.current = null;
        input.closeAfterRotoSaveRequestedRef.current = false;
        input.closeGuardBypassRef.current = false;
        setRotoClosePromptState('error');
        setRotoClosePromptMessage('Could not save before closing. Try Save current, then close again.');
      }
    } catch (error) {
      input.closeAfterApplyOperationIdRef.current = null;
      input.closeAfterRotoSaveRequestedRef.current = false;
      input.closeGuardBypassRef.current = false;
      const detail = error instanceof Error ? error.message : String(error);
      setRotoClosePromptState('error');
      setRotoClosePromptMessage(`Could not save before closing. ${detail}`);
    }
  }, [input]);

  useEffect(() => {
    const handleBeforeUnload = (_event: BeforeUnloadEvent) => {
      if (input.workflowMode !== 'roto') return;
      input.snapshotCurrentRotoFrame();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [input]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const installCloseHandler = async () => {
      try {
        const windowApi = await import('@tauri-apps/api/window');
        const appWindow = windowApi.getCurrentWindow();
        if (typeof appWindow.onCloseRequested !== 'function') return;
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (disposed || input.workflowMode !== 'roto') return;
          if (input.closeGuardBypassRef.current || input.closeAfterRotoSaveRequestedRef.current) return;
          input.snapshotCurrentRotoFrame();
          const isCurrentRotoFrameDirty = input.workflowMode === 'roto' && input.dirtyFramesRef.current.has(input.currentFrame);
          if (!isCurrentRotoFrameDirty) return;
          event.preventDefault();
          setRotoClosePromptState('prompt');
          setRotoClosePromptMessage(null);
        });
        if (disposed) unlisten?.();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] Tauri close listener unavailable', error);
      }
    };
    void installCloseHandler();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [input]);

  return {
    rotoClosePromptState,
    rotoClosePromptMessage,
    setRotoClosePromptState,
    setRotoClosePromptMessage,
    closePhysicsPaintWindow,
    closeWithoutSavingRotoFrame,
    cancelRotoClose,
    saveAndCloseRotoFrame,
  };
}
