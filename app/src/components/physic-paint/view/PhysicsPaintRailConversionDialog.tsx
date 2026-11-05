import { useEffect, useRef } from 'preact/hooks';
import { X } from 'lucide-preact';
import type {
  RotoRailConversionDialogBundle,
  RotoRailConversionRailKind,
} from '../hooks/useRotoTimelineActions';

const RAIL_KIND_LABEL: Record<RotoRailConversionRailKind, string> = {
  motion: 'Motion',
  static: 'Static',
  reveal: 'Reveal',
};

/**
 * Quick 261105-raf: the one-shot `Edit this rail?` prompt.
 *
 * A + Key or a paint promotion on an empty frame strictly AFTER a
 * script-generated Motion / Static / Reveal rail asks once before anything is
 * committed. `Convert to Standard` reproduces the shipped 261105-p9i dissolve;
 * `New rail` — also the Escape and header-close answer — is the
 * NON-DESTRUCTIVE choice: the scripted rail and its Loop Clip stay untouched
 * and the edit starts a real new rail (same fresh segment as Create rail → Key).
 *
 * The hook owns the transient request signal and the deferred resolver; this
 * component only reads the signal and calls `answer`. Same floating shell as
 * the Play Script dialog: no dimming backdrop, no full-screen pointer blocker,
 * no focus trap — the viewport root is pointer-events:none and only the surface
 * accepts pointer input, so the rest of the Studio stays interactive. Signals
 * only: no useState, no signal writes in the render body.
 *
 * UAT: the prompt opens over the timeline (the decision is about rails), not
 * over the canvas, and the header drags the surface by an imperative translate
 * on top of the grid-centered overlay — no layout reflow and no React state.
 */
export function PhysicsPaintRailConversionDialog({
  request,
  answer,
}: RotoRailConversionDialogBundle) {
  const primaryRef = useRef<HTMLButtonElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    baseX: number;
    baseY: number;
    rect: { left: number; top: number; width: number } | null;
  } | null>(null);
  const pending = request.value;

  // Focus the primary action and anchor the surface over the timeline on open.
  // The effect re-fires only when a NEW request object arrives (identity-stable
  // while the prompt is pending). The viewport root is grid-centered, so the
  // surface starts centered and the translate lands it on the timeline's box.
  useEffect(() => {
    if (pending === null) return;
    const surface = surfaceRef.current;
    // The surface starts transparent so the grid-centered frame never flashes
    // over the canvas before the timeline anchor is measured.
    const reveal = () => {
      if (surface) surface.style.opacity = '1';
      primaryRef.current?.focus();
    };
    if (!surface || typeof document === 'undefined') return reveal();
    const timeline = document.querySelector('.physics-paint-timeline');
    if (!timeline) return reveal();
    surface.style.transform = '';
    const surfaceRect = surface.getBoundingClientRect?.();
    const timelineRect = timeline.getBoundingClientRect?.();
    if (surfaceRect && timelineRect) {
      const x = timelineRect.left + timelineRect.width / 2 - (surfaceRect.left + surfaceRect.width / 2);
      const y = timelineRect.top + timelineRect.height / 2 - (surfaceRect.top + surfaceRect.height / 2);
      dragOffsetRef.current = { x, y };
      surface.style.transform = `translate(${x}px, ${y}px)`;
    }
    reveal();
  }, [pending]);

  const applyDragOffset = () => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const { x, y } = dragOffsetRef.current;
    surface.style.transform = x !== 0 || y !== 0 ? `translate(${x}px, ${y}px)` : '';
  };

  const onHeaderPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    dragStartRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      baseX: dragOffsetRef.current.x,
      baseY: dragOffsetRef.current.y,
      rect: rect ? { left: rect.left, top: rect.top, width: rect.width } : null,
    };
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onHeaderPointerMove = (event: PointerEvent) => {
    const start = dragStartRef.current;
    if (!start) return;
    let nextX = start.baseX + (event.clientX - start.pointerX);
    let nextY = start.baseY + (event.clientY - start.pointerY);
    // Keep at least 80px visible horizontally and the header reachable
    // vertically. Skipped in DOM-less tests where real rect values are absent.
    if (start.rect && typeof window !== 'undefined') {
      const deltaX = nextX - start.baseX;
      const deltaY = nextY - start.baseY;
      const clampedX = Math.min(Math.max(deltaX, 80 - start.rect.width - start.rect.left), window.innerWidth - 80 - start.rect.left);
      const clampedY = Math.min(Math.max(deltaY, -start.rect.top), window.innerHeight - 48 - start.rect.top);
      nextX = start.baseX + clampedX;
      nextY = start.baseY + clampedY;
    }
    dragOffsetRef.current = { x: nextX, y: nextY };
    applyDragOffset();
  };

  const endHeaderDrag = () => {
    dragStartRef.current = null;
  };

  if (pending === null) return null;

  const railKind = RAIL_KIND_LABEL[pending.railKind];

  return (
    <div
      class="physics-paint-play-script-dialog physics-paint-rail-conversion-dialog"
      role="dialog"
      aria-labelledby="physics-rail-conversion-title"
      onKeyDown={(event) => {
        // Studio shortcuts must never fire from inside the prompt.
        event.stopPropagation();
        if (event.key !== 'Escape') return;
        event.preventDefault();
        // Escape resolves the NON-destructive choice.
        answer('new-rail');
      }}
    >
      <div ref={surfaceRef} class="physics-paint-rail-conversion-surface" style={{ opacity: 0 }}>
        <div
          class="physics-paint-rail-conversion-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endHeaderDrag}
          onPointerCancel={endHeaderDrag}
        >
          <strong id="physics-rail-conversion-title">Edit this rail?</strong>
          <button
            type="button"
            class="physics-paint-play-script-close"
            aria-label="Close"
            onPointerDown={(event) => { event.stopPropagation(); }}
            onClick={() => answer('new-rail')}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <p class="physics-paint-rail-conversion-body">
          {`This ${railKind} rail is script-generated. Convert it to Standard to keep your edit — Regenerate will no longer rebuild it.`}
        </p>
        <div class="physics-paint-rail-conversion-actions physics-paint-play-script-actions">
          <button
            type="button"
            class="physics-paint-play-script-button physics-paint-play-script-button-ghost"
            onClick={() => answer('new-rail')}
          >
            New rail
          </button>
          <button
            ref={primaryRef}
            type="button"
            class="physics-paint-play-script-button physics-paint-play-script-button-primary"
            onClick={() => answer('convert')}
          >
            Convert to Standard
          </button>
        </div>
      </div>
    </div>
  );
}
