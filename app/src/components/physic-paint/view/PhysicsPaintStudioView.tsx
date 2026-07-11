import type { ComponentChildren, ComponentProps } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
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
  inputDisabled?: boolean;
  inputDisabledMessage?: string;
  onionOverlay: ComponentChildren;
  onInputIntent?: () => void;
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
    rotoClosePromptState: 'idle' | 'prompt' | 'saving' | 'error';
    rotoClosePromptMessage: string | null;
    shortcutsVisible: boolean;
  };
  actions: {
    closeWithoutSavingRotoFrame: () => void;
    cancelRotoClose: () => void;
    saveAndCloseRotoFrame: () => void;
  };
}

export function PhysicsPaintStudioView(props: PhysicsPaintStudioViewProps) {
  const { layout, topBar, toolRail, canvas, rightPanel, workflow, status, actions } = props;
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

        {status.rotoClosePromptState !== 'idle' ? (
          <div class="physics-paint-confirmation physics-paint-roto-close-confirmation" role="dialog" aria-modal="true" aria-labelledby="physics-paint-roto-close-title">
            <div class="physics-paint-confirmation-card">
              <h2 id="physics-paint-roto-close-title">Close unsaved Roto frame?</h2>
              <p>The current Roto frame has unsaved changes. Choose whether to discard this edit, keep working, or save before closing.</p>
              {status.rotoClosePromptMessage ? (
                <p class={`physics-paint-roto-close-message ${status.rotoClosePromptState === 'error' ? 'error' : ''}`} role="status" aria-live="polite">{status.rotoClosePromptMessage}</p>
              ) : null}
              <div class="physics-paint-confirmation-actions">
                <button class="physics-paint-text-button destructive" type="button" disabled={status.rotoClosePromptState === 'saving'} onClick={actions.closeWithoutSavingRotoFrame}>Close without saving</button>
                <button class="physics-paint-text-button" type="button" disabled={status.rotoClosePromptState === 'saving'} onClick={actions.cancelRotoClose}>Cancel</button>
                <button class="physics-paint-text-button primary" type="button" disabled={status.rotoClosePromptState === 'saving'} onClick={actions.saveAndCloseRotoFrame}>Close saving</button>
              </div>
            </div>
          </div>
        ) : null}

        {status.shortcutsVisible ? (
          <aside class="physics-paint-shortcuts-help" aria-label="Physics Paint shortcuts">
            <strong>Physics Paint shortcuts</strong>
            <span>Cmd+Z undo · Cmd+S save active workflow · Esc stop preview · ? help</span>
            <span>Roto: arrows navigate · O onion · [ ] onion count · Save current caches the painted frame</span>
            <span>Play: Space/Enter preview · Cmd+S save play</span>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
