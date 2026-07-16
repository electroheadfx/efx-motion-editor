import { useEffect, useRef, useState } from 'preact/hooks';
import type { PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { isPhysicPaintApplyResult, isPhysicPaintApplyResultMessage, isPhysicPaintLaunchContext, isPhysicPaintScriptLibraryResult, isPhysicPaintScriptLibraryResultMessage } from '../../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT, PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT } from '../../../lib/physicPaintBridge';

export type PhysicsPaintBridgeMode = 'Tauri' | 'Browser fallback' | 'Unavailable';

export async function detectPhysicsPaintBridgeMode(): Promise<PhysicsPaintBridgeMode> {
  try {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emit === 'function') return 'Tauri';
  } catch {
    // Browser fallback below is expected outside Tauri.
  }
  if (typeof window !== 'undefined' && window.opener) return 'Browser fallback';
  return 'Unavailable';
}

export function usePhysicsPaintCloseFlush(hasPending: () => boolean, flush: () => Promise<void>): void {
  const hasPendingRef = useRef(hasPending);
  const flushRef = useRef(flush);
  hasPendingRef.current = hasPending;
  flushRef.current = flush;

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const appWindow = getCurrentWindow();
      unlisten = await appWindow.onCloseRequested(async (event) => {
        if (!hasPendingRef.current()) return;
        event.preventDefault();
        try {
          await flushRef.current();
          if (!disposed) await appWindow.destroy();
        } catch (error) {
          console.error('[PhysicsPaintStudio] Could not flush pending Roto pixels before close', error);
        }
      });
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); };
  }, []);
}

export function usePhysicsPaintBridgeMode(): PhysicsPaintBridgeMode {
  const [bridgeMode, setBridgeMode] = useState<PhysicsPaintBridgeMode>('Unavailable');
  useEffect(() => {
    let disposed = false;
    void detectPhysicsPaintBridgeMode()
      .then((mode) => { if (!disposed) setBridgeMode(mode); })
      .catch(() => { if (!disposed) setBridgeMode('Unavailable'); });
    return () => { disposed = true; };
  }, []);
  return bridgeMode;
}

export function usePhysicsPaintLaunchBridge(applyIncomingLaunchContext: (context: PhysicPaintLaunchContext) => void): void {
  const applyIncomingLaunchContextRef = useRef(applyIncomingLaunchContext);
  applyIncomingLaunchContextRef.current = applyIncomingLaunchContext;
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const installLaunchListener = async () => {
      try {
        let launchEventReceived = false;
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen === 'function') {
          unlisten = await eventApi.listen(PHYSIC_PAINT_LAUNCH_EVENT, (event) => {
            if (isPhysicPaintLaunchContext(event.payload)) {
              launchEventReceived = true;
              console.info('[PhysicsPaintStudio] launch context received', event.payload);
              applyIncomingLaunchContextRef.current(event.payload);
            } else {
              console.warn('[PhysicsPaintStudio] invalid launch context', event.payload);
            }
          });
          if (disposed) {
            unlisten?.();
            return;
          }
        }
        const coreApi = await import('@tauri-apps/api/core');
        if (typeof coreApi.invoke === 'function') {
          const storedContext = await coreApi.invoke('get_physics_paint_launch_context');
          if (!disposed && !launchEventReceived && isPhysicPaintLaunchContext(storedContext)) {
            console.info('[PhysicsPaintStudio] launch context fetched', storedContext);
            applyIncomingLaunchContextRef.current(storedContext);
          }
        }
      } catch (error) {
        console.warn('[PhysicsPaintStudio] Tauri launch listener unavailable', error);
      }
    };
    void installLaunchListener();
    return () => { disposed = true; unlisten?.(); };
  }, []);
}

export function usePhysicsPaintProjectContextBridge(handleProject: (project: PhysicPaintLaunchContext['project']) => void): void {
  const handleRef = useRef(handleProject); handleRef.current = handleProject;
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const accept = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      const project = value as { name?: unknown; saved?: unknown; contextId?: unknown };
      if (typeof project.name === 'string' && typeof project.saved === 'boolean' && typeof project.contextId === 'string') handleRef.current({ name: project.name, saved: project.saved, contextId: project.contextId });
    };
    const custom = (event: Event) => accept((event as CustomEvent).detail);
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.type === PHYSIC_PAINT_PROJECT_CONTEXT_EVENT) accept(event.data.payload); };
    window.addEventListener(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, custom);
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => {
      unlisten = await eventApi.listen?.(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, (event) => accept(event.payload));
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); window.removeEventListener(PHYSIC_PAINT_PROJECT_CONTEXT_EVENT, custom); window.removeEventListener('message', message); };
  }, []);
}

export function usePhysicsPaintScriptLibraryResultBridge(handleResult: (result: PhysicPaintScriptLibraryResult) => void): void {
  const handleRef = useRef(handleResult); handleRef.current = handleResult;
  useEffect(() => {
    let disposed = false; let unlisten: (() => void) | undefined;
    const custom = (event: Event) => { const result = (event as CustomEvent).detail; if (isPhysicPaintScriptLibraryResult(result)) handleRef.current(result); };
    const message = (event: MessageEvent) => { if (event.origin === window.location.origin && isPhysicPaintScriptLibraryResultMessage(event.data)) handleRef.current(event.data.payload); };
    window.addEventListener(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, custom);
    window.addEventListener('message', message);
    void import('@tauri-apps/api/event').then(async (eventApi) => {
      unlisten = await eventApi.listen?.(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, (event) => { if (isPhysicPaintScriptLibraryResult(event.payload)) handleRef.current(event.payload); });
      if (disposed) unlisten?.();
    }).catch(() => undefined);
    return () => { disposed = true; unlisten?.(); window.removeEventListener(PHYSIC_PAINT_SCRIPT_LIBRARY_RESULT_EVENT, custom); window.removeEventListener('message', message); };
  }, []);
}

export function usePhysicsPaintApplyResultBridge(
  bridgeMode: PhysicsPaintBridgeMode,
  handleApplyResult: (result: PhysicPaintApplyResult) => void,
): void {
  useEffect(() => {
    const handleCustomResult = (event: Event) => {
      const result = (event as CustomEvent<unknown>).detail;
      if (isPhysicPaintApplyResult(result)) handleApplyResult(result);
      else console.warn('[PhysicsPaintStudio] invalid apply result', result);
    };
    const handleMessageResult = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (isPhysicPaintApplyResultMessage(event.data)) handleApplyResult(event.data.payload);
    };
    const targetWindow = window;
    window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleCustomResult);
    window.addEventListener('message', handleMessageResult);
    return () => {
      targetWindow.removeEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleCustomResult);
      targetWindow.removeEventListener('message', handleMessageResult);
    };
  }, [handleApplyResult]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const installApplyResultListener = async () => {
      if (bridgeMode !== 'Tauri') return;
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlisten = await eventApi.listen(PHYSIC_PAINT_APPLY_RESULT_EVENT, (event) => {
          if (isPhysicPaintApplyResult(event.payload)) handleApplyResult(event.payload);
          else console.warn('[PhysicsPaintStudio] invalid Tauri apply result', event.payload);
        });
        if (disposed) unlisten?.();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] Tauri apply-result listener unavailable', error);
      }
    };
    void installApplyResultListener();
    return () => { disposed = true; unlisten?.(); };
  }, [bridgeMode, handleApplyResult]);
}
