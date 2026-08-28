import type { JSX } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact';
import type { CompletedPaintMutation, EfxPaintEngine, PaintPerformanceSample } from '@efxlab/efx-physic-paint';
import { getContainedCanvasDisplaySize } from './physicsPaintCanvasSizing';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';

const CANVAS_MOUNT_ERROR = 'Unable to mount physics paint canvas: canvas wrapper did not create a canvas';

export type NativePenInputHandler = (input: { pressure: number; tiltX?: number; tiltY?: number }) => void;

export function PhysicsPaintCanvasMount(props: { width: number; height: number; paperTextureScale: number; onEngineReady: (engine: EfxPaintEngine) => void; onCanvasMounted: (mounted: boolean) => void; onNativePenInputReady: (handler: NativePenInputHandler) => void; onCompletedMutation?: (mutation: CompletedPaintMutation, engine: EfxPaintEngine) => void; onPerformanceSample?: (sample: PaintPerformanceSample) => void; beforeEngineDestroy?: (engine: EfxPaintEngine) => void | Promise<void>; getStrokeMetadata?: () => { playFrame?: number } | null | undefined }) {
  recordPhysicsPaintPerformanceCounter('render.canvasMount');
  const shellRef = useRef<HTMLDivElement>(null);
  const [mountError, setMountError] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const onEngineReadyRef = useRef(props.onEngineReady);
  const onCanvasMountedRef = useRef(props.onCanvasMounted);
  const onNativePenInputReadyRef = useRef(props.onNativePenInputReady);
  const onCompletedMutationRef = useRef(props.onCompletedMutation);
  const onPerformanceSampleRef = useRef(props.onPerformanceSample);
  const beforeEngineDestroyRef = useRef(props.beforeEngineDestroy);
  const getStrokeMetadataRef = useRef(props.getStrokeMetadata);
  onEngineReadyRef.current = props.onEngineReady;
  onCanvasMountedRef.current = props.onCanvasMounted;
  onNativePenInputReadyRef.current = props.onNativePenInputReady;
  onCompletedMutationRef.current = props.onCompletedMutation;
  onPerformanceSampleRef.current = props.onPerformanceSample;
  beforeEngineDestroyRef.current = props.beforeEngineDestroy;
  getStrokeMetadataRef.current = props.getStrokeMetadata;

  useEffect(() => {
    const shell = shellRef.current;
    const region = shell?.parentElement;
    const updateDisplaySize = () => {
      if (!region) return;
      const rect = region.getBoundingClientRect();
      setDisplaySize(getContainedCanvasDisplaySize(rect.width, rect.height, props.width, props.height));
    };
    updateDisplaySize();
    const resizeObserver = region ? new ResizeObserver(updateDisplaySize) : null;
    if (region && resizeObserver) {
      resizeObserver.observe(region);
      recordPhysicsPaintPerformanceCounter('observer.canvasMount.resize.install');
    }
    const frame = window.requestAnimationFrame(() => {
      const mounted = Boolean(shellRef.current?.querySelector('canvas'));
      onCanvasMountedRef.current(mounted);
      if (!mounted) setMountError(CANVAS_MOUNT_ERROR);
      updateDisplaySize();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (resizeObserver) {
        recordPhysicsPaintPerformanceCounter('observer.canvasMount.resize.cleanup');
        resizeObserver.disconnect();
      }
    };
  }, [props.height, props.width]);

  const shellStyle = {
    aspectRatio: `${props.width} / ${props.height}`,
    '--physics-paint-paper-texture-scale': props.paperTextureScale,
    ...(displaySize ? { width: `${displaySize.width}px`, height: `${displaySize.height}px` } : {}),
  } as JSX.CSSProperties;
  const handleEngineReady = useCallback((engine: EfxPaintEngine) => {
    engine.setTool('paint');
    // 48-06: the program monitor owns the visible background (the flattened
    // composite carries the paper fond) — the engine's canvases stay
    // transparent so the composite stacked beneath shows through.
    engine.setVisibleBackgroundSuppressed(true);
    setMountError(null);
    onCanvasMountedRef.current(true);
    recordPhysicsPaintPerformanceCounter('lifecycle.canvasMount.engineReady');
    return onEngineReadyRef.current(engine);
  }, []);
  const handleNativePenInputReady = useCallback((handler: NativePenInputHandler) => {
    onNativePenInputReadyRef.current(handler);
  }, []);
  const handleCompletedMutation = useCallback((mutation: CompletedPaintMutation, engine: EfxPaintEngine) => {
    return onCompletedMutationRef.current?.(mutation, engine);
  }, []);
  const handlePerformanceSample = useCallback((sample: PaintPerformanceSample) => {
    return onPerformanceSampleRef.current?.(sample);
  }, []);
  const handleBeforeEngineDestroy = useCallback((engine: EfxPaintEngine) => {
    recordPhysicsPaintPerformanceCounter('lifecycle.canvasMount.beforeDestroy');
    return beforeEngineDestroyRef.current?.(engine);
  }, []);
  const handleGetStrokeMetadata = useCallback(() => {
    return getStrokeMetadataRef.current?.();
  }, []);
  recordPhysicsPaintPerformanceCounter('render.efxChildRequest');

  return (
    <div class="demo-canvas-shell" ref={shellRef} style={shellStyle}>
      <EfxPaintCanvas
        width={props.width}
        height={props.height}
        papers={[
          { name: 'canvas1', url: '/img/paper_1.jpg' },
          { name: 'canvas2', url: '/img/paper_2.jpg' },
          { name: 'canvas3', url: '/img/paper_3.jpg' },
        ]}
        defaultPaper="canvas1"
        paperTextureScale={props.paperTextureScale}
        class="paint-canvas"
        onNativePenInputReady={handleNativePenInputReady}
        onCompletedMutation={handleCompletedMutation}
        onPerformanceSample={handlePerformanceSample}
        beforeEngineDestroy={handleBeforeEngineDestroy}
        getStrokeMetadata={handleGetStrokeMetadata}
        onEngineReady={handleEngineReady}
      />
      {mountError ? <p class="demo-error">{mountError}</p> : null}
    </div>
  );
}
