import { useEffect, useRef } from 'preact/hooks';
import { Layers, X } from 'lucide-preact';
import type { RotoScriptLibraryRow } from '../roto/physicsPaintRotoScriptSchema';

/**
 * AM-3 (52 UAT): the Create Rail script picker — a floating MOVABLE dialog
 * (Play Script / Photo Reference pattern: no backdrop, no focus trap — the
 * Studio palette stays interactive while the dialog floats above it).
 *
 * The strip's "+ Rail" (Create rail) flow needs a selected library Action to
 * bake from; with none selected the Create Rail dialog would open fully
 * disabled (a dead end). Instead the Studio interposes THIS picker: it lists
 * the library Actions (thumbnail + name + natural duration — the Scripts panel
 * row data), picking one sets the library selection and opens the Create Rail
 * dialog on the tab/kind chosen in the menu (Reveal → Reveal Photo Rail tab),
 * and cancelling closes ONLY the picker. An empty library shows an explanatory
 * empty state — never a dead dialog.
 *
 * Signals-only state (efx-preact-reactivity): no useState, no render-body
 * signal writes — the drag offset is local pointer-drag state kept in refs.
 */

export type PhysicsPaintScriptPickerIntent =
  | { readonly kind: 'paint'; readonly mode: 'progressive' | 'static' }
  | { readonly kind: 'reveal' };

export interface PhysicsPaintScriptPickerDialogProps {
  /** Dialog visibility (owned by the Studio — set from the strip "+ Rail" flow). */
  open: boolean;
  /** The rail kind chosen in the "+ Rail" menu — drives the header title. */
  intent: PhysicsPaintScriptPickerIntent | null;
  /** Library Actions (the Scripts panel row data). */
  rows: readonly RotoScriptLibraryRow[];
  /** Pick intent — the Studio sets the library selection and opens Create Rail. */
  onPick: (id: string) => void;
  /** Close intent (Escape, header X, Cancel) — closes ONLY the picker. */
  onClose: () => void;
}

export const SCRIPT_PICKER_EMPTY_LINE_1 = 'No project Actions yet.';
export const SCRIPT_PICKER_EMPTY_LINE_2 = 'Save the current real Roto frame as an Action first, then create a Rail.';

function intentTitle(intent: PhysicsPaintScriptPickerIntent | null): string {
  if (intent?.kind === 'reveal') return 'Create Reveal Photo Rail';
  if (intent?.kind === 'paint') return intent.mode === 'static' ? 'Create Static Rail' : 'Create Motion Rail';
  return 'Create Rail';
}

export function PhysicsPaintScriptPickerDialog({
  open,
  intent,
  rows,
  onPick,
  onClose,
}: PhysicsPaintScriptPickerDialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ pointerX: number; pointerY: number; baseX: number; baseY: number; rect: { left: number; top: number; width: number } | null } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const previousActiveElement = useRef<Element | null>(null);
  const previousOpen = useRef(false);

  // Focus follows the visible dialog state: on open capture the opening element
  // and focus the dialog; on close restore focus to it (Play Script pattern).
  useEffect(() => {
    if (open) {
      if (!previousOpen.current) previousActiveElement.current = document.activeElement;
      previousOpen.current = true;
      const timer = window.setTimeout(() => surfaceRef.current?.focus?.(), 0);
      return () => window.clearTimeout(timer);
    }
    if (previousOpen.current && previousActiveElement.current instanceof HTMLElement) {
      previousActiveElement.current.focus?.();
    }
    previousOpen.current = false;
    return undefined;
  }, [open]);

  const handleClose = () => {
    draggingRef.current = false;
    dragStart.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    onClose();
  };

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

  if (!open) return null;

  return (
    <div
      class={`physics-paint-script-picker-dialog${draggingRef.current ? ' physics-paint-script-picker-dragging' : ''}`}
      role="dialog"
      aria-labelledby="physics-script-picker-title"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          handleClose();
        }
      }}
    >
      <div ref={surfaceRef} class="physics-paint-script-picker-surface" tabIndex={-1}>
        <div
          class="physics-paint-script-picker-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endHeaderDrag}
          onPointerCancel={endHeaderDrag}
        >
          <Layers size={15} class="physics-paint-script-picker-header-icon" aria-hidden="true" />
          <strong id="physics-script-picker-title">{intentTitle(intent)}</strong>
          <span class="physics-paint-script-picker-header-spacer" aria-hidden="true" />
          <button
            type="button"
            class="physics-paint-script-picker-close"
            aria-label="Close Action picker"
            title="Close"
            onClick={handleClose}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
        <div class="physics-paint-script-picker-content">
          {rows.length > 0 ? (
            <>
              <p class="physics-paint-script-picker-hint">Pick the Action to bake from.</p>
              <div class="physics-paint-script-picker-list" role="listbox" aria-label="Saved Roto Actions">
                {rows.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    role="option"
                    aria-selected="false"
                    class="physics-paint-script-row"
                    aria-label={`Use ${row.name}`}
                    onClick={() => onPick(row.id)}
                  >
                    <img class="physics-paint-script-thumbnail" src={row.thumbnail.dataUrl} width={row.thumbnail.width} height={row.thumbnail.height} alt="" />
                    <span class="physics-paint-script-row-copy">
                      <span class="physics-paint-script-name">{row.name}</span>
                      <span class="physics-paint-script-count">{row.brushCount} {row.brushCount === 1 ? 'frame' : 'frames'}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div class="physics-paint-script-picker-empty">
              <p>{SCRIPT_PICKER_EMPTY_LINE_1}</p>
              <p>{SCRIPT_PICKER_EMPTY_LINE_2}</p>
            </div>
          )}
          <div class="physics-paint-script-picker-actions">
            <button type="button" class="physics-paint-script-picker-cancel" onClick={handleClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
