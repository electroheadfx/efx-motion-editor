import { Paintbrush, X } from 'lucide-preact';
import { useEffect, useRef } from 'preact/hooks';
import type { RotoScriptApplyMode } from '../roto/physicsPaintRotoScriptClipboard';

/**
 * 52.1 quick: the Apply render-mode chooser — a small MOVABLE floating dialog
 * (Play Script / Photo Reference pattern: no backdrop, no focus trap, Studio
 * stays interactive outside the surface) opened by the Scripts panel's Apply
 * actions. It is modal only for its own choice: picking a mode (or dismissing)
 * closes it immediately, and the apply then runs in the chosen mode.
 *
 * Signals-only state (efx-preact-reactivity): no useState — the drag offset
 * writes straight to the surface's style, focus restore rides the open flip.
 */
export interface PhysicsPaintScriptApplyModeDialogProps {
  /** Dialog visibility (owned by the Studio; the component stays mounted). */
  open: boolean;
  /** Mode pick — the Studio resolves the pending apply with this mode. */
  onChoose: (mode: RotoScriptApplyMode) => void;
  /** Dismiss intent (Escape, header X) — the pending apply aborts silently. */
  onDismiss: () => void;
}

export function PhysicsPaintScriptApplyModeDialog({
  open,
  onChoose,
  onDismiss,
}: PhysicsPaintScriptApplyModeDialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const liveChoiceRef = useRef<HTMLButtonElement>(null);
  const dragStart = useRef<{ pointerX: number; pointerY: number; baseX: number; baseY: number; rect: { left: number; top: number; width: number } | null } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const previousOpen = useRef(false);
  const previousActiveElement = useRef<Element | null>(null);

  // Focus follows the visible dialog state: on open capture the opener and focus
  // the Live choice (today's behavior is the default); on close restore focus.
  useEffect(() => {
    if (open) {
      if (!previousOpen.current) previousActiveElement.current = document.activeElement;
      previousOpen.current = true;
      dragOffsetRef.current = { x: 0, y: 0 };
      const timer = window.setTimeout(() => liveChoiceRef.current?.focus?.(), 0);
      return () => window.clearTimeout(timer);
    }
    if (previousOpen.current && previousActiveElement.current instanceof HTMLElement) {
      previousActiveElement.current.focus?.();
    }
    previousOpen.current = false;
    return undefined;
  }, [open]);

  const onHeaderPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      baseX: dragOffsetRef.current.x,
      baseY: dragOffsetRef.current.y,
      rect: rect ? { left: rect.left, top: rect.top, width: rect.width } : null,
    };
    draggingRef.current = true;
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onHeaderPointerMove = (event: PointerEvent) => {
    const start = dragStart.current;
    if (!start || !draggingRef.current) return;
    let nextX = start.baseX + (event.clientX - start.pointerX);
    let nextY = start.baseY + (event.clientY - start.pointerY);
    // Keep at least 80px visible horizontally and the header reachable vertically.
    if (start.rect && typeof window !== 'undefined') {
      nextX = start.baseX + Math.min(Math.max(nextX - start.baseX, 80 - start.rect.width - start.rect.left), window.innerWidth - 80 - start.rect.left);
      nextY = start.baseY + Math.min(Math.max(nextY - start.baseY, -start.rect.top), window.innerHeight - 48 - start.rect.top);
    }
    dragOffsetRef.current = { x: nextX, y: nextY };
    const surface = surfaceRef.current;
    if (surface) surface.style.transform = `translate(${nextX}px, ${nextY}px)`;
  };

  const endHeaderDrag = () => {
    dragStart.current = null;
    draggingRef.current = false;
  };

  const choose = (mode: RotoScriptApplyMode) => {
    endHeaderDrag();
    onChoose(mode);
  };

  if (!open) return null;

  return (
    <div
      class={`physics-paint-apply-mode-dialog${draggingRef.current ? ' physics-paint-apply-mode-dragging' : ''}`}
      role="dialog"
      aria-labelledby="physics-apply-mode-title"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          endHeaderDrag();
          onDismiss();
        }
      }}
    >
      <div ref={surfaceRef} class="physics-paint-apply-mode-surface" tabIndex={-1}>
        <div
          class="physics-paint-apply-mode-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endHeaderDrag}
          onPointerCancel={endHeaderDrag}
        >
          <Paintbrush size={15} class="physics-paint-apply-mode-header-icon" aria-hidden="true" />
          <strong id="physics-apply-mode-title">Apply Action</strong>
          <span class="physics-paint-apply-mode-header-spacer" aria-hidden="true" />
          <button
            type="button"
            class="physics-paint-apply-mode-close"
            aria-label="Cancel apply"
            title="Cancel"
            onClick={() => { endHeaderDrag(); onDismiss(); }}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
        <div class="physics-paint-apply-mode-content">
          <p class="physics-paint-apply-mode-hint">How should this Action render on the frame?</p>
          <div class="physics-paint-apply-mode-choices">
            <button
              ref={liveChoiceRef}
              type="button"
              class="physics-paint-apply-mode-choice"
              onClick={() => choose('live')}
            >
              <strong>Live render</strong>
              <span>Watch the Action paint in fast multi-stroke bursts on the canvas.</span>
            </button>
            <button
              type="button"
              class="physics-paint-apply-mode-choice"
              onClick={() => choose('background')}
            >
              <strong>Background render</strong>
              <span>No in-canvas animation — the engine renders as fast as it allows, with a progress bar; the finished frame appears at once.</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
