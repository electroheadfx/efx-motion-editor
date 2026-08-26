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
import { MemoizedPhysicsPaintRightPanel } from './MemoizedPhysicsPaintRightPanel';
import { MemoizedPhysicsPaintTopBar } from './MemoizedPhysicsPaintTopBar';
import { PhysicsPaintRightPanelRegion } from './PhysicsPaintRightPanelRegion';
import { PhysicsPaintToolRail } from './PhysicsPaintToolRail';
import { PhysicsPaintWorkflowStrip } from '../view/PhysicsPaintWorkflowStrip';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import { subscribeRotoPlaybackBackground } from './rotoPlaybackBackground';

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
    <div class={`physics-paint-canvas-stack${props.cachedRotoPlaybackActive ? ' cached-roto-playback-active' : ''}${playbackReady ? ' cached-roto-playback-ready' : ''}`} ref={stackRef} style={{ pointerEvents: props.inputDisabled ? 'none' : undefined }} title={props.inputDisabled ? props.inputDisabledMessage : undefined} onPointerDownCapture={props.onInputIntent}>
      <MemoizedPhysicsPaintCanvasMount key={props.canvasKey} {...props.mount} />
      {canvasBounds ? (
        <div
          class="physics-paint-onion-overlay canvas-region"
          aria-hidden="true"
          style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}
        >
          {!props.cachedRotoPlaybackActive && props.cachedRotoReferenceUrl ? <img class="physics-paint-cached-roto-reference" src={props.cachedRotoReferenceUrl} alt="" /> : null}
          {props.cachedRotoPlaybackActive && props.cachedRotoPlaybackComposition ? (
            <PhysicsPaintRotoPlaybackBackground
              width={props.cachedRotoPlaybackComposition.width}
              height={props.cachedRotoPlaybackComposition.height}
              background={props.cachedRotoPlaybackComposition.background}
            />
          ) : null}
          <PhysicsPaintRotoPlaybackImage tick={props.cachedRotoPlaybackTick} />
          {!props.cachedRotoPlaybackActive ? props.onionOverlay : null}
        </div>
      ) : null}
    </div>
  );
}

const MemoizedPhysicsPaintCanvasStack = memo(PhysicsPaintCanvasStackImpl);
// 47-05 LEAK BISECT: the memo is kept defined but unused (void reference).
void MemoizedPhysicsPaintCanvasStack;

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
  workflow: ComponentProps<typeof PhysicsPaintWorkflowStrip>;
  status: {
    shortcutsVisible: boolean;
  };
}

export function PhysicsPaintStudioView(props: PhysicsPaintStudioViewProps) {
  recordPhysicsPaintPerformanceCounter('render.studioView');
  const { layout, topBar, toolRail, rightPanel, playScriptDialog, status } = props;
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
          {/* 47-05 LEAK BISECT (temporary): the canvas stack is removed to
              isolate it from the rest of the view. REVERT after. */}
          {/* <MemoizedPhysicsPaintCanvasStack {...canvas} /> */}
        </section>

        <PhysicsPaintRightPanelRegion
          collapsed={layout.rightPanelCollapsed}
          onSetCollapsed={layout.onSetRightPanelCollapsed}
          rightPanel={rightPanel}
        />

        <MemoizedPhysicsPaintPlayScriptDialog {...playScriptDialog} />

        {/* 47-05 LEAK BISECT (temporary): the workflow strip is removed to
            isolate the strip/DOM from the rest of the view. REVERT after. */}
        {/* <PhysicsPaintWorkflowStrip {...workflow} /> */}

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
