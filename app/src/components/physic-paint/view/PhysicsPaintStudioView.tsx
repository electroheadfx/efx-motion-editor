import type { ComponentChildren, ComponentProps } from 'preact';
import { memo } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import type { PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import { PhysicsPaintCanvasMount } from '../engine/PhysicsPaintCanvasMount';
import { MemoizedPhysicsPaintCanvasMount } from '../engine/MemoizedPhysicsPaintCanvasMount';
import type { RotoCachedPlaybackTick } from '../hooks/useRotoCachedPlayback';
import type { RenderedFramePayload } from '../roto/rotoCanvasFrames';
import { MemoizedPhysicsPaintPlayScriptDialog } from './MemoizedPhysicsPaintPlayScriptDialog';
import { PhysicsPaintPhotoReferenceDialog } from './PhysicsPaintPhotoReferenceDialog';
import { MemoizedPhysicsPaintRightPanel } from './MemoizedPhysicsPaintRightPanel';
import { MemoizedPhysicsPaintTopBar } from './MemoizedPhysicsPaintTopBar';
import { PhysicsPaintRightPanelRegion } from './PhysicsPaintRightPanelRegion';
import { PhysicsPaintToolRail } from './PhysicsPaintToolRail';
import { BackgroundAssetPickerView } from './BackgroundAssetPickerView';
import { PhysicsPaintReferenceGhostLayer } from './PhysicsPaintReferenceGhostLayer';
import { PhysicsPaintReferenceTransformHandles } from './PhysicsPaintReferenceTransformHandles';
import { PhysicsPaintWorkflowStrip } from '../view/PhysicsPaintWorkflowStrip';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { subscribeRotoPlaybackBackground } from './rotoPlaybackBackground';
import { PhysicsPaintProgramMonitor } from './PhysicsPaintProgramMonitor';
import type { PhysicsPaintProgramMonitorProps } from './PhysicsPaintProgramMonitor';

interface PhysicsPaintCanvasStackViewProps {
  canvasKey: string;
  mount: ComponentProps<typeof PhysicsPaintCanvasMount>;
  cachedRotoReferenceUrl?: string | null;
  cachedRotoPlaybackTick?: Signal<RotoCachedPlaybackTick<RenderedFramePayload> | null> | null;
  cachedRotoPlaybackActive?: boolean;
  cachedRotoPlaybackComposition?: {
    width: number;
    height: number;
    background: PhysicPaintRotoBackgroundMetadata;
  } | null;
  inputDisabled?: boolean;
  inputDisabledMessage?: string;
  onionOverlay: ComponentChildren;
  onInputIntent?: () => void;
  /**
   * Phase 48-05 (D-05): the program monitor config. Present when the Studio
   * has a launch layer. The monitor is mounted BELOW the engine canvas (the
   * engine supplies the active track's live pixels; the monitor draws the
   * composite of everything else during editing). While present, the legacy
   * playback background + playback image slots are suppressed — the flattened
   * composite already carries the paper and every participating track, so they
   * would double-draw.
   */
  programMonitor?: PhysicsPaintProgramMonitorProps | null;
  /**
   * 48-06 (UAT-B): the active track is hidden (or non-soloed under solo) — the
   * engine canvas is blank by law, so its surface must step aside
   * (visibility: hidden, the cached-roto-playback treatment) and let the
   * program monitor own the visible composite of the remaining tracks.
   */
  engineSurfaceHidden?: boolean;
  /**
   * 48-06 (UAT-C): the document paper fond metadata (the lowest-order track's
   * non-transparent paper setting). When present, the stack draws it on a
   * dedicated fond layer BENEATH the isolated tracks group — the program
   * monitor reads the fond-less composite, so the active track's CSS blend
   * (the engine shell inside the group) never meets the paper.
   */
  fondBackground?: PhysicPaintRotoBackgroundMetadata | null;
  /**
   * 49-03 (D-12): the monitor-only transparency checkerboard. True ONLY when
   * the effective fond is fully transparent for the current frame (transparent
   * document fallback AND no clip covering the frame — the gap verdict). The
   * stack draws the checkerboard on a dedicated layer BENEATH the monitor
   * content, clipped to canvas bounds. Paint-only: never a document state and
   * never in the flattened raster, main preview, or export.
   */
  showTransparencyCheckerboard?: boolean;
  /**
   * 50-04 (S3): the reference ghost monitor-paint layer — a narrow leaf canvas
   * drawn ON TOP of the composite (onion-ghost family, D-09) and the
   * fail-closed missing-source publication seam (D-04). Present whenever the
   * Studio has a launch layer; the ghost is absent during playback by not
   * drawing (D-14).
   */
  referenceGhost?: ComponentProps<typeof PhysicsPaintReferenceGhostLayer> | null;
  /**
   * 50-05 (Task 2, S4): the reference transform handles overlay — a sibling of
   * the ghost layer, ABOVE it (z-index 6). Present whenever the Studio has a
   * launch layer; the overlay owns pointer events ONLY while the transform is
   * unlocked (the component renders pointer-events none when locked/playing),
   * so painting gestures pass through by default (D-13).
   */
  referenceTransformHandles?: ComponentProps<typeof PhysicsPaintReferenceTransformHandles> | null;
}

/**
 * 38.1-D-01 live surface 1: the playback canvas image. Narrow subscriber —
 * reads the per-tick playback signal directly so each tick re-renders ONLY
 * this <img> slot, never the Studio. Renders the exact same element as the
 * previous url-driven slot (DOM byte-identical).
 */
function PhysicsPaintRotoPlaybackImage(props: { tick: Signal<RotoCachedPlaybackTick<RenderedFramePayload> | null> | null | undefined }) {
  const dataUrl = props.tick?.value?.frame?.dataUrl ?? null;
  return dataUrl ? <img class="physics-paint-cached-roto-playback" src={dataUrl} alt="" /> : null;
}

function PhysicsPaintRotoPlaybackBackground(props: { width: number; height: number; background: PhysicPaintRotoBackgroundMetadata }) {  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    return subscribeRotoPlaybackBackground({
      context,
      width: props.width,
      height: props.height,
      background: props.background,
    });
  }, [props.background.background, props.background.color, props.background.grainStrength, props.background.paperGrain, props.height, props.width]);

  return <canvas class="physics-paint-cached-roto-playback-background" ref={canvasRef} width={props.width} height={props.height} aria-hidden="true" />;
}

function PhysicsPaintCanvasStackImpl(props: PhysicsPaintCanvasStackViewProps) {
  recordPhysicsPaintPerformanceCounter('render.canvasStack');
  const stackRef = useRef<HTMLDivElement>(null);
  const [canvasBounds, setCanvasBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    let observedCanvas: HTMLCanvasElement | null = null;
    const updateCanvasBounds = () => {
      const canvases = stack.querySelectorAll('.paint-canvas > canvas');
      const staticCanvas = canvases[1] ?? canvases[0];
      if (!(staticCanvas instanceof HTMLCanvasElement)) return;
      if (observedCanvas !== staticCanvas) {
        if (observedCanvas) resizeObserver.unobserve(observedCanvas);
        observedCanvas = staticCanvas;
        resizeObserver.observe(staticCanvas);
      }
      const stackRect = stack.getBoundingClientRect();
      const canvasRect = staticCanvas.getBoundingClientRect();
      if (canvasRect.width <= 0 || canvasRect.height <= 0) return;
      setCanvasBounds({
        left: canvasRect.left - stackRect.left,
        top: canvasRect.top - stackRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      });
    };
    const resizeObserver = new ResizeObserver(updateCanvasBounds);
    resizeObserver.observe(stack);
    recordPhysicsPaintPerformanceCounter('observer.canvasStack.resize.install');
    const mutationObserver = new MutationObserver(updateCanvasBounds);
    mutationObserver.observe(stack, { childList: true, subtree: true });
    recordPhysicsPaintPerformanceCounter('observer.canvasStack.mutation.install');
    const frame = window.requestAnimationFrame(updateCanvasBounds);
    return () => {
      window.cancelAnimationFrame(frame);
      recordPhysicsPaintPerformanceCounter('observer.canvasStack.mutation.cleanup');
      mutationObserver.disconnect();
      recordPhysicsPaintPerformanceCounter('observer.canvasStack.resize.cleanup');
      resizeObserver.disconnect();
    };
  }, []);

  const playbackReady = Boolean(props.cachedRotoPlaybackActive && props.cachedRotoPlaybackComposition && canvasBounds);

  return (
    <div class={`physics-paint-canvas-stack${props.cachedRotoPlaybackActive ? ' cached-roto-playback-active' : ''}${playbackReady ? ' cached-roto-playback-ready' : ''}${props.engineSurfaceHidden ? ' active-track-hidden' : ''}`} ref={stackRef} style={{ pointerEvents: props.inputDisabled ? 'none' : undefined }} title={props.inputDisabled ? props.inputDisabledMessage : undefined} onPointerDownCapture={props.onInputIntent}>
      {/* 48-06 (UAT-C): the paper fond lives on its OWN layer beneath the
          isolated tracks group — the monitor reads the fond-less composite, so
          the active track's CSS blend (the engine shell inside the group) never
          meets the paper. The paper is generated at the PROJECT resolution
          (cachedRotoPlaybackComposition.width/height — the same size the
          flattened composite used, the compositor size authority) and
          CSS-scaled to the display bounds; generating it at the display or
          working size would change the paper motif scale. */}
      {canvasBounds && props.programMonitor && props.fondBackground ? (
        <div class="physics-paint-fond-layer" style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}>
          <PhysicsPaintRotoPlaybackBackground
            width={props.cachedRotoPlaybackComposition?.width ?? props.programMonitor.width}
            height={props.cachedRotoPlaybackComposition?.height ?? props.programMonitor.height}
            background={props.fondBackground}
          />
        </div>
      ) : null}
      {/* 49-03 (D-12): the monitor-only transparency checkerboard — a sibling
          layer BENEATH the monitor content, clipped to canvas bounds, shown
          ONLY when the effective fond is fully transparent for the current
          frame (transparent fallback AND no clip covering the frame). The
          two-gray repeating-conic-gradient treatment is paint-only on this
          monitor layer — never a document state, never in the flattened
          raster, main preview, or export. */}
      {canvasBounds && props.programMonitor && props.showTransparencyCheckerboard ? (
        <div class="physics-paint-transparency-checkerboard" style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }} aria-hidden="true" />
      ) : null}
      <div class="physics-paint-tracks-group">
        <MemoizedPhysicsPaintCanvasMount key={props.canvasKey} {...props.mount} />
        {canvasBounds && props.programMonitor ? (
          <div class="physics-paint-program-monitor" style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}>
            <PhysicsPaintProgramMonitor {...props.programMonitor} />
          </div>
        ) : null}
      </div>
      {canvasBounds ? (
        <div
          class="physics-paint-onion-overlay canvas-region"
          aria-hidden="true"
          style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}
        >
          {!props.cachedRotoPlaybackActive && props.cachedRotoReferenceUrl ? <img class="physics-paint-cached-roto-reference" src={props.cachedRotoReferenceUrl} alt="" /> : null}
          {props.cachedRotoPlaybackActive && props.cachedRotoPlaybackComposition && !props.programMonitor ? (
            <PhysicsPaintRotoPlaybackBackground
              width={props.cachedRotoPlaybackComposition.width}
              height={props.cachedRotoPlaybackComposition.height}
              background={props.cachedRotoPlaybackComposition.background}
            />
          ) : null}
          {!props.programMonitor ? <PhysicsPaintRotoPlaybackImage tick={props.cachedRotoPlaybackTick} /> : null}
          {!props.cachedRotoPlaybackActive ? props.onionOverlay : null}
        </div>
      ) : null}
      {/* 50-04 (S3): the reference ghost monitor-paint layer — a sibling of the
          onion overlay (same z-index 5 family, above the composite, beneath
          selection/tool paint). The ghost draws ON TOP of the composite and is
          monitor paint only — it never enters the flattened raster, main
          preview, or export (D-06). */}
      {canvasBounds && props.referenceGhost ? (
        <div
          class="physics-paint-reference-ghost"
          aria-hidden="true"
          style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}
        >
          <PhysicsPaintReferenceGhostLayer {...props.referenceGhost} />
        </div>
      ) : null}
      {/* 50-05 (Task 2, S4): the reference transform handles overlay — a sibling
          of the ghost layer, ABOVE it (z-index 6). The overlay owns pointer
          events ONLY while the transform is unlocked (pointer-events none when
          locked/playing), so painting gestures pass through by default (D-13). */}
      {canvasBounds && props.referenceTransformHandles ? (
        <div
          class="physics-paint-reference-transform"
          style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}
        >
          <PhysicsPaintReferenceTransformHandles {...props.referenceTransformHandles} />
        </div>
      ) : null}
    </div>
  );
}

const MemoizedPhysicsPaintCanvasStack = memo(PhysicsPaintCanvasStackImpl);

export interface PhysicsPaintStudioViewProps {
  layout: {
    rightPanelCollapsed: boolean;
    onKeyDown: (event: KeyboardEvent) => void;
    onSetRightPanelCollapsed: (collapsed: boolean) => void;
  };
  topBar: ComponentProps<typeof MemoizedPhysicsPaintTopBar>;
  toolRail: ComponentProps<typeof PhysicsPaintToolRail>;
  canvas: PhysicsPaintCanvasStackViewProps;
  rightPanel: ComponentProps<typeof MemoizedPhysicsPaintRightPanel>;
  playScriptDialog: ComponentProps<typeof MemoizedPhysicsPaintPlayScriptDialog>;
  /** 50-UAT (modal redesign): the floating Photo Reference dialog — a movable
   *  dialog opened from the strip camera icon (Play Script dialog pattern). */
  referenceDialog?: ComponentProps<typeof PhysicsPaintPhotoReferenceDialog> | null;
  workflow: ComponentProps<typeof PhysicsPaintWorkflowStrip>;
  status: {
    shortcutsVisible: boolean;
  };
  /** 49-04 (Task 2): the scoped full-area asset picker (S2) swap. */
  backgroundPicker?: ComponentProps<typeof BackgroundAssetPickerView>;
  /** 50-03 (S2): the reference picker — the same full-area region swap reused
   *  for the Photo row's Import/Replace control (D-01). */
  referencePicker?: ComponentProps<typeof BackgroundAssetPickerView>;
}

export function PhysicsPaintStudioView(props: PhysicsPaintStudioViewProps) {
  recordPhysicsPaintPerformanceCounter('render.studioView');
  const { layout, topBar, toolRail, canvas, rightPanel, playScriptDialog, referenceDialog, workflow, status, backgroundPicker, referencePicker } = props;
  return (
    <main class="demo-shell">
      <section
        class={`physics-paint-studio physics-paint-layout${layout.rightPanelCollapsed ? ' right-panel-collapsed' : ''}`}
        aria-label="EFX Physics Paint Studio"
        tabIndex={0}
        onKeyDown={(event) => layout.onKeyDown(event as unknown as KeyboardEvent)}
      >
        <MemoizedPhysicsPaintTopBar {...topBar} />
        <PhysicsPaintToolRail {...toolRail} />

        <section class="physics-paint-main physics-paint-canvas-region" aria-label="Physics Paint canvas">
          <MemoizedPhysicsPaintCanvasStack {...canvas} />
          {/* 49-04 (Task 2): the picker is an overlay INSIDE the canvas region —
              the engine canvas stays mounted underneath (D-01 lock). */}
          {backgroundPicker?.open ? <BackgroundAssetPickerView {...backgroundPicker} /> : null}
          {referencePicker?.open ? <BackgroundAssetPickerView {...referencePicker} /> : null}
        </section>

        <PhysicsPaintRightPanelRegion
          collapsed={layout.rightPanelCollapsed}
          onSetCollapsed={layout.onSetRightPanelCollapsed}
          rightPanel={rightPanel}
        />

        <MemoizedPhysicsPaintPlayScriptDialog {...playScriptDialog} />

        {referenceDialog ? <PhysicsPaintPhotoReferenceDialog {...referenceDialog} /> : null}

        <PhysicsPaintWorkflowStrip {...workflow} />

        {status.shortcutsVisible ? (
          <aside class="physics-paint-shortcuts-help" aria-label="Physics Paint shortcuts">
            <strong>Physics Paint shortcuts</strong>
            <span>Cmd+Z undo · Cmd+Shift+Z / Ctrl+Y redo · Esc stop preview · ? help</span>
            <span>Cmd/Ctrl+C copy selected key(s) · Cmd/Ctrl+V paste at current frame</span>
            <span>Backspace / Delete remove selected real key</span>
            <span>Roto: arrows navigate · O onion · [ ] onion count · completed paint caches automatically</span>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
