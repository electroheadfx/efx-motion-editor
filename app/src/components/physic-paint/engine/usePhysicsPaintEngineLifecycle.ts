import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { NativePenInputHandler } from './PhysicsPaintCanvasMount';
import { applyRotoBackgroundMetadataToEngine } from '../engine/physicsPaintStudioSettings';


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
        if (disposed) unlisten?.();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] native tablet pressure listener unavailable', error);
      }
    };

    void installTabletPressureListener();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (engine && input.launchContext?.rotoBackground) {
      applyRotoBackgroundMetadataToEngine(engine, input.launchContext.rotoBackground);
    }
  }, [engine, input.launchContext?.rotoBackground]);


  useEffect(() => input.clearExternalState, []);

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
