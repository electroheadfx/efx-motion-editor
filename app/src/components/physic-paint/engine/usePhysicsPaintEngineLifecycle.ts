import { useEffect, useState } from 'preact/hooks';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';

/**
 * 261027-klx: the engine-1 lifecycle is gone with the Brush module. What
 * remains is the canvas lifecycle the Studio still needs:
 *
 *  - `canvasMounted` gates frame-editing paths until the live surface has a
 *    canvas in the DOM;
 *  - a canvas-key change resets that flag;
 *  - unmount clears the Studio's external pending-state slots.
 *
 * The watercolor engine itself is not owned here: `AquarelleCanvasLayer`
 * publishes the ONE `AquarelleEnginePort` through `onEnginePortReady`, and the
 * Studio mirrors it in `aquarelleEnginePortRef` for synchronous seams.
 */
export function usePhysicsPaintEngineLifecycle(input: {
  canvasKey: string;
  clearExternalState: () => void;
}) {
  const [canvasMounted, setCanvasMounted] = useState(false);

  useEffect(() => {
    setCanvasMounted(false);
  }, [input.canvasKey]);

  useEffect(() => () => {
    recordPhysicsPaintPerformanceCounter('lifecycle.engine.externalState.cleanup');
    return input.clearExternalState();
  }, []);

  return {
    canvasMounted,
    setCanvasMounted,
  };
}
