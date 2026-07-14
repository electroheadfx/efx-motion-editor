import type { ComponentChildren, ComponentProps } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import { subscribeProjectPaperCanvas } from '../../../lib/projectPaperRaster';
import { PhysicsPaintCanvasMount } from '../engine/PhysicsPaintCanvasMount';
import { PhysicsPaintRightPanel } from './PhysicsPaintRightPanel';
import { PhysicsPaintToolRail } from './PhysicsPaintToolRail';
import { PhysicsPaintTopBar } from './PhysicsPaintTopBar';
import { PhysicsPaintWorkflowStrip } from '../view/PhysicsPaintWorkflowStrip';

interface PhysicsPaintCanvasStackViewProps {
  children: ComponentChildren;
  cachedPlayPreviewUrl?: string | null;
  cachedRotoReferenceUrl?: string | null;
  cachedRotoPlaybackUrl?: string | null;
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

function PhysicsPaintRotoPlaybackBackground(props: { width: number; height: number; background: PhysicPaintRotoBackgroundMetadata }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    return subscribeProjectPaperCanvas(props.background.background, props.width, props.height, (paperCanvas) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = props.background.color ?? '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (paperCanvas) context.drawImage(paperCanvas, 0, 0, canvas.width, canvas.height);
    });
  }, [props.background.background, props.background.color, props.background.grainStrength, props.background.paperGrain, props.height, props.width]);

  return <canvas class="physics-paint-cached-roto-playback-background" ref={canvasRef} width={props.width} height={props.height} aria-hidden="true" />;
}

function PhysicsPaintCanvasStack(props: PhysicsPaintCanvasStackViewProps) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [canvasBounds, setCanvasBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    const updateCanvasBounds = () => {
      const canvas = stack.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const stackRect = stack.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      setCanvasBounds({
        left: canvasRect.left - stackRect.left,
        top: canvasRect.top - stackRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      });
    };
    updateCanvasBounds();
    const resizeObserver = new ResizeObserver(updateCanvasBounds);
    resizeObserver.observe(stack);
    const canvas = stack.querySelector('canvas');
    if (canvas) resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div class={`physics-paint-canvas-stack${props.cachedRotoPlaybackActive ? ' cached-roto-playback-active' : ''}`} ref={stackRef} style={{ pointerEvents: props.inputDisabled ? 'none' : undefined }} title={props.inputDisabled ? props.inputDisabledMessage : undefined} onPointerDownCapture={props.onInputIntent}>
      {props.children}
      {canvasBounds ? (
        <div
          class="physics-paint-onion-overlay canvas-region"
          aria-hidden="true"
          style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}
        >
          {!props.cachedRotoPlaybackActive && props.cachedRotoReferenceUrl ? <img class="physics-paint-cached-roto-reference" src={props.cachedRotoReferenceUrl} alt="" /> : null}
          {!props.cachedRotoPlaybackActive && props.cachedPlayPreviewUrl ? <img class="physics-paint-cached-play-preview" src={props.cachedPlayPreviewUrl} alt="" /> : null}
          {props.cachedRotoPlaybackActive && props.cachedRotoPlaybackComposition ? (
            <PhysicsPaintRotoPlaybackBackground
              width={props.cachedRotoPlaybackComposition.width}
              height={props.cachedRotoPlaybackComposition.height}
              background={props.cachedRotoPlaybackComposition.background}
            />
          ) : null}
          {props.cachedRotoPlaybackUrl ? <img class="physics-paint-cached-roto-playback" src={props.cachedRotoPlaybackUrl} alt="" /> : null}
          {!props.cachedRotoPlaybackActive ? props.onionOverlay : null}
        </div>
      ) : null}
    </div>
  );
}

export interface PhysicsPaintStudioViewProps {
  layout: {
    rightPanelCollapsed: boolean;
    onKeyDown: (event: KeyboardEvent) => void;
    onSetRightPanelCollapsed: (collapsed: boolean) => void;
  };
  topBar: ComponentProps<typeof PhysicsPaintTopBar>;
  toolRail: ComponentProps<typeof PhysicsPaintToolRail>;
  canvas: Omit<PhysicsPaintCanvasStackViewProps, 'children'> & {
    toastMessage: string | null;
    onDismissToast: () => void;
    canvasKey: string;
    mount: ComponentProps<typeof PhysicsPaintCanvasMount>;
  };
  rightPanel: ComponentProps<typeof PhysicsPaintRightPanel>;
  workflow: ComponentProps<typeof PhysicsPaintWorkflowStrip>;
  status: {
    shortcutsVisible: boolean;
  };
}

export function PhysicsPaintStudioView(props: PhysicsPaintStudioViewProps) {
  const { layout, topBar, toolRail, canvas, rightPanel, workflow, status } = props;
  return (
    <main class="demo-shell">
      <section
        class={`physics-paint-studio physics-paint-layout${layout.rightPanelCollapsed ? ' right-panel-collapsed' : ''}`}
        aria-label="EFX Physics Paint Studio"
        tabIndex={0}
        onKeyDown={(event) => layout.onKeyDown(event as unknown as KeyboardEvent)}
      >
        <PhysicsPaintTopBar {...topBar} />
        <PhysicsPaintToolRail {...toolRail} />

        <section class="physics-paint-main physics-paint-canvas-region" aria-label="Physics Paint canvas">
          {canvas.toastMessage ? (
            <div class="physics-paint-canvas-toast" role="status" aria-live="polite">
              <span>{canvas.toastMessage}</span>
              <button type="button" aria-label="Dismiss Play duration warning" onClick={canvas.onDismissToast}>×</button>
            </div>
          ) : null}
          <PhysicsPaintCanvasStack
            cachedPlayPreviewUrl={canvas.cachedPlayPreviewUrl}
            cachedRotoReferenceUrl={canvas.cachedRotoReferenceUrl}
            cachedRotoPlaybackUrl={canvas.cachedRotoPlaybackUrl}
            cachedRotoPlaybackActive={canvas.cachedRotoPlaybackActive}
            cachedRotoPlaybackComposition={canvas.cachedRotoPlaybackComposition}
            inputDisabled={canvas.inputDisabled}
            inputDisabledMessage={canvas.inputDisabledMessage}
            onInputIntent={canvas.onInputIntent}
            onionOverlay={canvas.onionOverlay}
          >
            <PhysicsPaintCanvasMount key={canvas.canvasKey} {...canvas.mount} />
          </PhysicsPaintCanvasStack>
        </section>

        {layout.rightPanelCollapsed ? (
          <aside class="physics-paint-right-panel-rail" aria-label="Physics Paint right panel collapsed">
            <button type="button" class="physics-paint-panel-toggle" aria-label="Open brush options panel" title="Open brush options panel" onClick={() => layout.onSetRightPanelCollapsed(false)}>▸</button>
          </aside>
        ) : (
          <div class="physics-paint-right-panel-shell">
            <button type="button" class="physics-paint-panel-toggle" aria-label="Close brush options panel" title="Close brush options panel" onClick={() => layout.onSetRightPanelCollapsed(true)}>▸</button>
            <PhysicsPaintRightPanel {...rightPanel} />
          </div>
        )}

        <PhysicsPaintWorkflowStrip {...workflow} />

        {status.shortcutsVisible ? (
          <aside class="physics-paint-shortcuts-help" aria-label="Physics Paint shortcuts">
            <strong>Physics Paint shortcuts</strong>
            <span>Cmd+Z undo · Esc stop preview · ? help</span>
            <span>Roto: arrows navigate · O onion · [ ] onion count · completed paint caches automatically</span>
            <span>Play: Space/Enter preview · Cmd+S save play</span>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
