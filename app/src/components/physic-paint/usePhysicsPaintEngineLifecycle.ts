import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext, PhysicPaintPlayRenderOptionsSnapshot, PhysicPaintRotoBackgroundMetadata } from '../../types/physicPaint';
import { resizePhysicsPaintState } from './physicsPaintCanvasSizing';
import type { NativePenInputHandler } from './PhysicsPaintCanvasMount';

function getLaunchWorkflowMode(context: PhysicPaintLaunchContext | null): 'play' | 'roto' {
  if (context?.workflowMode === 'play' || context?.editableSource === 'play') return 'play';
  return 'roto';
}

function applyRotoBackgroundMetadataToEngine(engine: EfxPaintEngine, metadata: PhysicPaintRotoBackgroundMetadata): void {
  engine.setBgMode(metadata.background);
  engine.setPaperGrain(metadata.paperGrain);
  engine.setEmbossStrength(metadata.grainStrength);
}

function applyPlayRenderOptionsToEngine(engine: EfxPaintEngine, options: PhysicPaintPlayRenderOptionsSnapshot): void {
  engine.setTool(options.tool === 'erase' ? 'erase' : 'paint');
  engine.setPhysicsMode(options.tool === 'physics-paint' ? 'local' : null);
  engine.setColorHex(options.color);
  engine.setBrushOpacity(options.opacity);
  engine.setBrushSize(options.brushSize);
  engine.setBgMode(options.background);
  engine.setPaperGrain(options.paperGrain);
  engine.setEmbossStrength(options.grainStrength);
}

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
    if (!engine) return;
    if (input.launchContext?.editableState) {
      try {
        engine.load(resizePhysicsPaintState(input.launchContext.editableState, input.canvasWidth, input.canvasHeight));
      } catch (error) {
        console.error('[PhysicsPaintStudio] failed to restore editable state', error);
        input.setLastError('Could not restore the previous physics paint state for this layer.');
      }
    }
    if (getLaunchWorkflowMode(input.launchContext) === 'roto' && input.launchContext?.rotoBackground) {
      applyRotoBackgroundMetadataToEngine(engine, input.launchContext.rotoBackground);
    }
  }, [engine, input.canvasHeight, input.canvasWidth, input.launchContext?.editableState, input.launchContext?.rotoBackground, input.launchContext?.workflowMode, input.launchContext?.editableSource]);

  useEffect(() => {
    if (!engine || !input.launchContext?.playRenderOptions) return;
    applyPlayRenderOptionsToEngine(engine, input.launchContext.playRenderOptions);
  }, [engine, input.launchContext?.playRenderOptions]);

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
