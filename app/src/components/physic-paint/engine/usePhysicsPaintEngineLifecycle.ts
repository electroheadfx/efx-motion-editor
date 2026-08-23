import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { NativePenInputHandler } from './PhysicsPaintCanvasMount';
import { applyRotoBackgroundMetadataToEngine } from '../engine/physicsPaintStudioSettings';
import { getCarriedRotoPhysical } from '../roto/rotoLaunchHydration';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';


export function usePhysicsPaintEngineLifecycle(input: {
  canvasKey: string;
  canvasWidth: number;
  canvasHeight: number;
  launchContext: PhysicPaintLaunchContext | null;
  setLastError: (message: string | null) => void;
  clearExternalState: () => void;
}) {
  const [engine, setEngine] = useState<EfxPaintEngine | null>(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const engineRef = useRef<EfxPaintEngine | null>(null);
  const nativePenInputHandlerRef = useRef<NativePenInputHandler | null>(null);

  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  useEffect(() => {
    setEngine(null);
    setCanvasMounted(false);
  }, [input.canvasKey]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const cleanupTabletPressureListener = () => {
      if (!unlisten) return;
      const listener = unlisten;
      unlisten = undefined;
      recordPhysicsPaintPerformanceCounter('lifecycle.engine.tabletListener.cleanup');
      listener();
    };

    const installTabletPressureListener = async () => {
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlisten = await eventApi.listen<{ pressure: number; tilt_x: number; tilt_y: number }>('tablet:pressure', (event) => {
          nativePenInputHandlerRef.current?.({
            pressure: event.payload.pressure,
            tiltX: event.payload.tilt_x,
            tiltY: event.payload.tilt_y,
          });
        });
        recordPhysicsPaintPerformanceCounter('lifecycle.engine.tabletListener.install');
        if (disposed) cleanupTabletPressureListener();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] native tablet pressure listener unavailable', error);
      }
    };

    void installTabletPressureListener();
    return () => {
      disposed = true;
      cleanupTabletPressureListener();
    };
  }, []);

  useEffect(() => {
    const background = getCarriedRotoPhysical(input.launchContext)?.background;
    if (engine && background) applyRotoBackgroundMetadataToEngine(engine, background);
  }, [engine, getCarriedRotoPhysical(input.launchContext)?.background]);


  useEffect(() => () => {
    recordPhysicsPaintPerformanceCounter('lifecycle.engine.externalState.cleanup');
    return input.clearExternalState();
  }, []);

  const handleEngineReady = useCallback((readyEngine: EfxPaintEngine) => {
    engineRef.current = readyEngine;
    setEngine(readyEngine);
  }, []);

  const handleNativePenInputReady = useCallback((handler: NativePenInputHandler) => {
    nativePenInputHandlerRef.current = handler;
  }, []);

  return {
    engine,
    engineRef,
    canvasMounted,
    setCanvasMounted,
    handleEngineReady,
    handleNativePenInputReady,
  };
}
