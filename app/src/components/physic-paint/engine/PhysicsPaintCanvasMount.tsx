import type { CSSProperties } from 'preact';
import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact';
import type { CompletedPaintMutation, EfxPaintEngine, InputActivityKind, PaintPerformanceSample } from '@efxlab/efx-physic-paint';
import type { AquarelleStroke } from '@efxlab/efx-watercolor';
import type { BlendMode } from '../../../efx-paint/document/efxPaintDocument';
import { getContainedCanvasDisplaySize } from './physicsPaintCanvasSizing';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { AquarelleCanvasLayer } from './AquarelleCanvasLayer';

const CANVAS_MOUNT_ERROR = 'Unable to mount physics paint canvas: canvas wrapper did not create a canvas';

/**
 * 48-06 (N2/N3): the active track is EXCLUDED from the program monitor's
 * composite (D-05 — the live engine stack supplies its pixels), so the track's
 * opacity/blend (D-01) would never reach the Studio surface. The shell carries
 * them as CSS group opacity + mix-blend-mode, the exact globalAlpha /
 * globalCompositeOperation analogues over the monitor beneath. 'add' maps to
 * the CSS additive 'plus-lighter' (the canvas 'lighter' equivalent).
 */
const TRACK_BLEND_TO_CSS_MIX: Record<BlendMode, CSSProperties['mixBlendMode']> = {
  normal: 'normal',
  screen: 'screen',
  multiply: 'multiply',
  overlay: 'overlay',
  add: 'plus-lighter',
};

export type NativePenInputHandler = (input: { pressure: number; tiltX?: number; tiltY?: number }) => void;

export function PhysicsPaintCanvasMount(props: { width: number; height: number; paperTextureScale: number; onEngineReady: (engine: EfxPaintEngine) => void; onCanvasMounted: (mounted: boolean) => void; onNativePenInputReady: (handler: NativePenInputHandler) => void; onCompletedMutation?: (mutation: CompletedPaintMutation, engine: EfxPaintEngine) => void; onPerformanceSample?: (sample: PaintPerformanceSample) => void; onInputActivity?: (kind: InputActivityKind, pointerId: number) => void; beforeEngineDestroy?: (engine: EfxPaintEngine) => void | Promise<void>; getStrokeMetadata?: () => { playFrame?: number } | null | undefined; trackOpacity?: number; trackBlendMode?: BlendMode; aquarelleActive?: boolean; aquarelleCachedBaseUrl?: string | null; color?: string; cursorOverlayCanvasRef?: { current: HTMLCanvasElement | null }; getAquarellePlayFrame?: () => number; getAquarellePaperId?: () => string; onAquarelleStrokeEnd?: (stroke: AquarelleStroke) => void; onAquarelleStrokeSettled?: (stroke: AquarelleStroke, ticks: number) => void; onAquarelleCaptureFrame?: (playFrame: number, snapshot: () => HTMLCanvasElement | null) => void; onAquarelleFlushCaptureReady?: (flushCapture: (() => void) | null) => void; onAquarelleSheetSessionEnd?: () => void; onAquarelleResetSheetReady?: (resetSheet: () => void) => void; onAquarelleDeleteStroke?: (mutationId: number) => void; onAquarelleMoveStroke?: (mutationId: number, dxPx: number, dyPx: number) => void; }) {
  recordPhysicsPaintPerformanceCounter('render.canvasMount');
  const shellRef = useRef<HTMLDivElement>(null);
  const [mountError, setMountError] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const engineRef = useRef<EfxPaintEngine | null>(null);
  const onEngineReadyRef = useRef(props.onEngineReady);
  const onCanvasMountedRef = useRef(props.onCanvasMounted);
  const onNativePenInputReadyRef = useRef(props.onNativePenInputReady);
  const onCompletedMutationRef = useRef(props.onCompletedMutation);
  const onPerformanceSampleRef = useRef(props.onPerformanceSample);
  const onInputActivityRef = useRef(props.onInputActivity);
  const beforeEngineDestroyRef = useRef(props.beforeEngineDestroy);
  const getStrokeMetadataRef = useRef(props.getStrokeMetadata);
  const onAquarelleStrokeEndRef = useRef(props.onAquarelleStrokeEnd);
  const onAquarelleStrokeSettledRef = useRef(props.onAquarelleStrokeSettled);
  const onAquarelleCaptureFrameRef = useRef(props.onAquarelleCaptureFrame);
  const onAquarelleFlushCaptureReadyRef = useRef(props.onAquarelleFlushCaptureReady);
  const onAquarelleSheetSessionEndRef = useRef(props.onAquarelleSheetSessionEnd);
  const onAquarelleResetSheetReadyRef = useRef(props.onAquarelleResetSheetReady);
  const onAquarelleDeleteStrokeRef = useRef(props.onAquarelleDeleteStroke);
  const onAquarelleMoveStrokeRef = useRef(props.onAquarelleMoveStroke);
  const getAquarellePlayFrameRef = useRef(props.getAquarellePlayFrame);
  const getAquarellePaperIdRef = useRef(props.getAquarellePaperId);
  const colorRef = useRef(props.color ?? '#103c65');
  onEngineReadyRef.current = props.onEngineReady;
  onCanvasMountedRef.current = props.onCanvasMounted;
  onNativePenInputReadyRef.current = props.onNativePenInputReady;
  onCompletedMutationRef.current = props.onCompletedMutation;
  onPerformanceSampleRef.current = props.onPerformanceSample;
  onInputActivityRef.current = props.onInputActivity;
  beforeEngineDestroyRef.current = props.beforeEngineDestroy;
  getStrokeMetadataRef.current = props.getStrokeMetadata;
  onAquarelleStrokeEndRef.current = props.onAquarelleStrokeEnd;
  onAquarelleStrokeSettledRef.current = props.onAquarelleStrokeSettled;
  onAquarelleCaptureFrameRef.current = props.onAquarelleCaptureFrame;
  onAquarelleFlushCaptureReadyRef.current = props.onAquarelleFlushCaptureReady;
  onAquarelleSheetSessionEndRef.current = props.onAquarelleSheetSessionEnd;
  onAquarelleResetSheetReadyRef.current = props.onAquarelleResetSheetReady;
  onAquarelleDeleteStrokeRef.current = props.onAquarelleDeleteStroke;
  onAquarelleMoveStrokeRef.current = props.onAquarelleMoveStroke;
  getAquarellePlayFrameRef.current = props.getAquarellePlayFrame;
  getAquarellePaperIdRef.current = props.getAquarellePaperId;
  colorRef.current = props.color ?? '#103c65';

  const aquarelleActive = props.aquarelleActive ?? false;
  useEffect(() => {
    engineRef.current?.setInputLocked(aquarelleActive);
  }, [aquarelleActive]);

  // Brush shows under the tracks group's paper multiply. The ring must stay
  // outside that group or the paper eats its white hairline — draw it on the
  // host-owned canvas (Water color already has its own DOM ring).
  useEffect(() => {
    engineRef.current?.setCursorOverlayCanvas(aquarelleActive ? null : props.cursorOverlayCanvasRef?.current ?? null);
  }, [aquarelleActive]);

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

  const trackOpacity = props.trackOpacity ?? 1;
  const trackBlendMode = props.trackBlendMode ?? 'normal';
  const trackTintActive = trackOpacity < 1 || trackBlendMode !== 'normal';
  const shellStyle = {
    position: 'relative' as const,
    aspectRatio: `${props.width} / ${props.height}`,
    '--physics-paint-paper-texture-scale': props.paperTextureScale,
    ...(displaySize ? { width: `${displaySize.width}px`, height: `${displaySize.height}px` } : {}),
    // N2/N3: the tint group must keep painting ABOVE the z-0 program monitor —
    // opacity<1 / mix-blend-mode create a stacking context that would otherwise
    // paint in tree order (the shell precedes the monitor in the DOM) and slip
    // BENEATH it. position+z-index pins the group at monitor 0 < shell 1 <
    // onion 5. Applied only while non-default so the untinted path is
    // byte-identical to before.
    ...(trackTintActive
      ? {
          position: 'relative',
          zIndex: 1,
          opacity: trackOpacity,
          mixBlendMode: TRACK_BLEND_TO_CSS_MIX[trackBlendMode],
        }
      : {}),
  } as CSSProperties;
  const handleEngineReady = useCallback((engine: EfxPaintEngine) => {
    engineRef.current = engine;
    engine.setTool('paint');
    // 48-06: the program monitor owns the visible background (the flattened
    // composite carries the paper fond) — the engine's canvases stay
    // transparent so the composite stacked beneath shows through.
    engine.setVisibleBackgroundSuppressed(true);
    engine.setInputLocked(aquarelleActive);
    engine.setCursorOverlayCanvas(aquarelleActive ? null : props.cursorOverlayCanvasRef?.current ?? null);
    setMountError(null);
    onCanvasMountedRef.current(true);
    recordPhysicsPaintPerformanceCounter('lifecycle.canvasMount.engineReady');
    return onEngineReadyRef.current(engine);
  }, [aquarelleActive]);
  const handleNativePenInputReady = useCallback((handler: NativePenInputHandler) => {
    onNativePenInputReadyRef.current(handler);
  }, []);
  const handleCompletedMutation = useCallback((mutation: CompletedPaintMutation, engine: EfxPaintEngine) => {
    return onCompletedMutationRef.current?.(mutation, engine);
  }, []);
  const handlePerformanceSample = useCallback((sample: PaintPerformanceSample) => {
    return onPerformanceSampleRef.current?.(sample);
  }, []);
  const handleInputActivity = useCallback((kind: InputActivityKind, pointerId: number) => {
    onInputActivityRef.current?.(kind, pointerId);
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
      <div
        class="physics-paint-engine-surface"
        style={{ position: 'absolute', inset: '0', pointerEvents: aquarelleActive ? 'none' : 'auto', opacity: aquarelleActive ? 0 : 1 } as CSSProperties}
      >
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
          onInputActivity={handleInputActivity}
          beforeEngineDestroy={handleBeforeEngineDestroy}
          getStrokeMetadata={handleGetStrokeMetadata}
          onEngineReady={handleEngineReady}
        />
      </div>
      {/* Water color cached base: the engine-1 preview base is invisible in
          aquarelle mode, so the committed sheet must render here, multiply over
          the fond and UNDER the live canvas — the same transmittance law as the
          live layer. Without it a cached key shows bare paper after return. */}
      {aquarelleActive && props.aquarelleCachedBaseUrl ? (
        <img class="aquarelle-cached-base" src={props.aquarelleCachedBaseUrl} alt="" aria-hidden="true" />
      ) : null}
      {aquarelleActive ? (
        <AquarelleCanvasLayer
          width={props.width}
          height={props.height}
          color={colorRef.current}
          getPlayFrame={() => getAquarellePlayFrameRef.current?.() ?? 0}
          getPaperId={() => getAquarellePaperIdRef.current?.() ?? 'paper/cold-press'}
          disabled={false}
          onStrokeEnd={(stroke) => onAquarelleStrokeEndRef.current?.(stroke)}
          onStrokeSettled={(stroke, ticks) => onAquarelleStrokeSettledRef.current?.(stroke, ticks)}
          onCaptureFrame={(playFrame, snapshot) => onAquarelleCaptureFrameRef.current?.(playFrame, snapshot)}
          onFlushCaptureReady={(flushCapture) => onAquarelleFlushCaptureReadyRef.current?.(flushCapture)}
          onSheetSessionEnd={() => onAquarelleSheetSessionEndRef.current?.()}
          onResetSheetReady={(resetSheet) => onAquarelleResetSheetReadyRef.current?.(resetSheet)}
          onDeleteStroke={(mutationId) => onAquarelleDeleteStrokeRef.current?.(mutationId)}
          onMoveStroke={(mutationId, dxPx, dyPx) => onAquarelleMoveStrokeRef.current?.(mutationId, dxPx, dyPx)}
        />
      ) : null}
      {mountError ? <p class="demo-error">{mountError}</p> : null}
    </div>
  );
}
