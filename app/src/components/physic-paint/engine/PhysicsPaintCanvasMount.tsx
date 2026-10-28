import type { CSSProperties } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { AquarelleStroke } from '@efxlab/efx-watercolor';
import type { ScriptStrokeTransform } from '../view/scriptStrokeEdition';
import type { BlendMode } from '../../../efx-paint/document/efxPaintDocument';
import { getContainedCanvasDisplaySize } from './physicsPaintCanvasSizing';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { AquarelleCanvasLayer } from './AquarelleCanvasLayer';
import { AquarelleCachedBaseLayer } from './AquarelleCachedBaseLayer';
import type { AquarelleEnginePort } from './aquarelleEnginePort';

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

/**
 * 261027-klx: `@efxlab/efx-watercolor` is the ONLY paint engine, so the mount
 * renders exactly one live surface — `AquarelleCanvasLayer` over the cached
 * base layer. The engine-1 `EfxPaintCanvas`, its Brush script overlay and its
 * hard-coded paper URLs are gone; the shell keeps its sizing/observer duties,
 * the track opacity/blend tint group and every aquarelle seam.
 */
export function PhysicsPaintCanvasMount(props: {
  width: number;
  height: number;
  paperTextureScale: number;
  onCanvasMounted: (mounted: boolean) => void;
  trackOpacity?: number;
  trackBlendMode?: BlendMode;
  aquarelleCachedBaseUrl?: string | null;
  color?: string;
  getAquarellePlayFrame?: () => number;
  getAquarellePaperId?: () => string;
  getAquarellePaperGrainStrength?: () => number;
  /** 261028-k03 D3/D2: a Lift gesture is refused at pointerdown for every
   *  fail-closed state (Script OFF with a script, group frame, unknown base,
   *  no displayable paint). Returns the copy to publish, or null to proceed. */
  getAquarelleLiftBlocked?: () => string | null;
  onAquarelleLiftBlocked?: (message: string) => void;
  /** 261028-k03b: every lift dab the engine applied (doc uv, radius in doc
   *  heights, effective amount) — the cached-base live erase preview. */
  onAquarelleLiftDab?: (x: number, y: number, r: number, amount: number) => void;
  onAquarelleStrokeEnd?: (stroke: AquarelleStroke) => void;
  onAquarelleStrokeSettled?: (stroke: AquarelleStroke, ticks: number) => void;
  onAquarelleCaptureFrame?: (playFrame: number, snapshot: () => HTMLCanvasElement | null, captureTrackId?: string) => void;
  onAquarelleFlushCaptureReady?: (flushCapture: ((captureTrackId?: string) => void) | null) => void;
  onAquarelleSnapshotReady?: (snapshot: (() => HTMLCanvasElement | null) | null) => void;
  onAquarelleSheetSessionEnd?: () => void;
  onAquarelleResetSheetReady?: (resetSheet: () => void) => void;
  onAquarelleDeleteStrokes?: (mutationIds: readonly number[]) => void;
  onAquarelleMoveStrokes?: (mutationIds: readonly number[], dxPx: number, dyPx: number) => void;
  onAquarelleTransformStrokes?: (mutationIds: readonly number[], transform: ScriptStrokeTransform) => void;
  /** Wave 3 D8: the ONE narrow engine port, forwarded from the layer. */
  onEnginePortReady?: (port: AquarelleEnginePort | null) => void;
}) {
  recordPhysicsPaintPerformanceCounter('render.canvasMount');
  const shellRef = useRef<HTMLDivElement>(null);
  const [mountError, setMountError] = useState<string | null>(null);
  const [displaySize, setDisplaySize] = useState<{ width: number; height: number } | null>(null);
  const onCanvasMountedRef = useRef(props.onCanvasMounted);
  const onAquarelleStrokeEndRef = useRef(props.onAquarelleStrokeEnd);
  const onAquarelleStrokeSettledRef = useRef(props.onAquarelleStrokeSettled);
  const onAquarelleCaptureFrameRef = useRef(props.onAquarelleCaptureFrame);
  const onAquarelleFlushCaptureReadyRef = useRef(props.onAquarelleFlushCaptureReady);
  const onAquarelleSnapshotReadyRef = useRef(props.onAquarelleSnapshotReady);
  const onAquarelleSheetSessionEndRef = useRef(props.onAquarelleSheetSessionEnd);
  const onAquarelleResetSheetReadyRef = useRef(props.onAquarelleResetSheetReady);
  const onAquarelleDeleteStrokesRef = useRef(props.onAquarelleDeleteStrokes);
  const onAquarelleMoveStrokesRef = useRef(props.onAquarelleMoveStrokes);
  const onAquarelleTransformStrokesRef = useRef(props.onAquarelleTransformStrokes);
  const onEnginePortReadyRef = useRef(props.onEnginePortReady);
  const getAquarellePlayFrameRef = useRef(props.getAquarellePlayFrame);
  const getAquarellePaperIdRef = useRef(props.getAquarellePaperId);
  const getAquarellePaperGrainStrengthRef = useRef(props.getAquarellePaperGrainStrength);
  const getAquarelleLiftBlockedRef = useRef(props.getAquarelleLiftBlocked);
  const onAquarelleLiftBlockedRef = useRef(props.onAquarelleLiftBlocked);
  const onAquarelleLiftDabRef = useRef(props.onAquarelleLiftDab);
  const colorRef = useRef(props.color ?? '#103c65');
  onCanvasMountedRef.current = props.onCanvasMounted;
  onAquarelleStrokeEndRef.current = props.onAquarelleStrokeEnd;
  onAquarelleStrokeSettledRef.current = props.onAquarelleStrokeSettled;
  onAquarelleCaptureFrameRef.current = props.onAquarelleCaptureFrame;
  onAquarelleFlushCaptureReadyRef.current = props.onAquarelleFlushCaptureReady;
  onAquarelleSnapshotReadyRef.current = props.onAquarelleSnapshotReady;
  onAquarelleSheetSessionEndRef.current = props.onAquarelleSheetSessionEnd;
  onAquarelleResetSheetReadyRef.current = props.onAquarelleResetSheetReady;
  onAquarelleDeleteStrokesRef.current = props.onAquarelleDeleteStrokes;
  onAquarelleMoveStrokesRef.current = props.onAquarelleMoveStrokes;
  onAquarelleTransformStrokesRef.current = props.onAquarelleTransformStrokes;
  onEnginePortReadyRef.current = props.onEnginePortReady;
  getAquarellePlayFrameRef.current = props.getAquarellePlayFrame;
  getAquarellePaperIdRef.current = props.getAquarellePaperId;
  getAquarellePaperGrainStrengthRef.current = props.getAquarellePaperGrainStrength;
  getAquarelleLiftBlockedRef.current = props.getAquarelleLiftBlocked;
  onAquarelleLiftBlockedRef.current = props.onAquarelleLiftBlocked;
  onAquarelleLiftDabRef.current = props.onAquarelleLiftDab;
  colorRef.current = props.color ?? '#103c65';

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

  recordPhysicsPaintPerformanceCounter('render.efxChildRequest');

  return (
    <div class="demo-canvas-shell" ref={shellRef} style={shellStyle}>
      {/* Water color cached base: the committed sheet renders UNDER the live
          canvas. Storage is the opaque transmittance sheet; the layer converts
          it to pigment alpha at display (2026-10-26 round 2), the same law as
          the live surface — source-over inside the tracks group, whose ONE
          multiply over the fond stays the paper pass. Without it a cached key
          shows bare paper after return. */}
      {props.aquarelleCachedBaseUrl ? (
        <AquarelleCachedBaseLayer url={props.aquarelleCachedBaseUrl} />
      ) : null}
      <AquarelleCanvasLayer
        width={props.width}
        height={props.height}
        color={colorRef.current}
        getPlayFrame={() => getAquarellePlayFrameRef.current?.() ?? 0}
        getPaperId={() => getAquarellePaperIdRef.current?.() ?? 'paper/cold-press'}
        getPaperGrainStrength={() => getAquarellePaperGrainStrengthRef.current?.() ?? 1}
        disabled={false}
        getLiftBlocked={() => getAquarelleLiftBlockedRef.current?.() ?? null}
        onLiftBlocked={(message) => onAquarelleLiftBlockedRef.current?.(message)}
        onLiftDab={(x, y, r, amount) => onAquarelleLiftDabRef.current?.(x, y, r, amount)}
        onStrokeEnd={(stroke) => onAquarelleStrokeEndRef.current?.(stroke)}
        onStrokeSettled={(stroke, ticks) => onAquarelleStrokeSettledRef.current?.(stroke, ticks)}
        onCaptureFrame={(playFrame, snapshot, captureTrackId) => onAquarelleCaptureFrameRef.current?.(playFrame, snapshot, captureTrackId)}
        onFlushCaptureReady={(flushCapture) => onAquarelleFlushCaptureReadyRef.current?.(flushCapture)}
        onSnapshotReady={(snapshot) => onAquarelleSnapshotReadyRef.current?.(snapshot)}
        onSheetSessionEnd={() => onAquarelleSheetSessionEndRef.current?.()}
        onResetSheetReady={(resetSheet) => onAquarelleResetSheetReadyRef.current?.(resetSheet)}
        onDeleteStrokes={(mutationIds) => onAquarelleDeleteStrokesRef.current?.(mutationIds)}
        onMoveStrokes={(mutationIds, dxPx, dyPx) => onAquarelleMoveStrokesRef.current?.(mutationIds, dxPx, dyPx)}
        onTransformStrokes={(mutationIds, transform) => onAquarelleTransformStrokesRef.current?.(mutationIds, transform)}
        onEnginePortReady={(port) => onEnginePortReadyRef.current?.(port)}
      />
      {mountError ? <p class="demo-error">{mountError}</p> : null}
    </div>
  );
}
