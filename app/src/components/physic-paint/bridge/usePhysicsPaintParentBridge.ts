import { useEffect, useState } from 'preact/hooks';
import type { PhysicPaintApplyResult, PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { isPhysicPaintApplyResult, isPhysicPaintApplyResultMessage, isPhysicPaintLaunchContext } from '../../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT } from '../../../lib/physicPaintBridge';

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
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const installLaunchListener = async () => {
      try {
        const coreApi = await import('@tauri-apps/api/core');
        if (typeof coreApi.invoke === 'function') {
          const storedContext = await coreApi.invoke('get_physics_paint_launch_context');
          if (!disposed && isPhysicPaintLaunchContext(storedContext)) {
            console.info('[PhysicsPaintStudio] launch context fetched', storedContext);
            applyIncomingLaunchContext(storedContext);
          }
        }
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlisten = await eventApi.listen(PHYSIC_PAINT_LAUNCH_EVENT, (event) => {
          if (isPhysicPaintLaunchContext(event.payload)) {
            console.info('[PhysicsPaintStudio] launch context received', event.payload);
            applyIncomingLaunchContext(event.payload);
          } else {
            console.warn('[PhysicsPaintStudio] invalid launch context', event.payload);
          }
        });
        if (disposed) unlisten?.();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] Tauri launch listener unavailable', error);
      }
    };
    void installLaunchListener();
    return () => { disposed = true; unlisten?.(); };
  }, [applyIncomingLaunchContext]);
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
    window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleCustomResult);
    window.addEventListener('message', handleMessageResult);
    return () => {
      window.removeEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleCustomResult);
      window.removeEventListener('message', handleMessageResult);
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
