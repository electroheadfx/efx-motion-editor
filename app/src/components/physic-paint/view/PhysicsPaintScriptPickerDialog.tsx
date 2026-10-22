import { useEffect, useRef } from 'preact/hooks';
import { ListChecks, X } from 'lucide-preact';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import { resolveScriptProvenance } from '../roto/physicsPaintRotoScriptScope';

/**
 * 261022-o2a: the floating Script picker — the Tools popover's `Load + Apply`
 * and `Create Rail` open it so either action can target ANY project Script
 * without first selecting one in the sidebar. The pick selects the row in the
 * library and then runs the intent that opened it; no controller logic is
 * duplicated here.
 *
 * Presentation follows the Photo Reference dialog family: the fixed root is
 * `pointer-events: none`, only the surface is interactive (the Studio palette
 * stays usable), no backdrop, no focus trap. Unlike the sidebar it lists the
 * UNFILTERED library rows — the layer scope is a list-view presentation filter
 * and must never hide a Script from an explicit pick.
 *
 * Signals-only state: the library is read in render; local refs hold the
 * captured opener element and the previous-open flag. The two effects are the
 * sanctioned dialog pair — focus capture/restore and pointerdown/Escape
 * dismissal.
 */
export interface PhysicsPaintScriptPickerDialogProps {
  /** Dialog visibility (owned by the Studio intent signal). */
  open: boolean;
  /** Which Tools action opened the picker; the picker title reflects it. */
  intent: 'load-apply' | 'create-rail';
  /** The project Script library (rows + live layers for provenance). */
  library: RotoScriptLibraryController;
  /** A row was chosen — the Studio selects it and runs the intent. */
  onPick: (id: string) => void;
  /** Close intent (Escape, header X, outside pointerdown). */
  onClose: () => void;
}

const TITLE_ID = 'physics-paint-script-picker-title';

export function PhysicsPaintScriptPickerDialog({
  open,
  intent,
  library,
  onPick,
  onClose,
}: PhysicsPaintScriptPickerDialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<Element | null>(null);
  const previousOpen = useRef(false);

  // Focus follows the visible dialog state: capture the opener (the Tools
  // trigger button) on open, focus the surface, and restore on close only when
  // the captured element is still attached.
  useEffect(() => {
    if (open) {
      if (!previousOpen.current) previousActiveElement.current = document.activeElement;
      previousOpen.current = true;
      const timer = window.setTimeout(() => surfaceRef.current?.focus?.(), 0);
      return () => window.clearTimeout(timer);
    }
    if (previousOpen.current) {
      const previous = previousActiveElement.current;
      previousActiveElement.current = null;
      previousOpen.current = false;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus?.();
    }
    return undefined;
  }, [open]);

  // Dismissal owns one Escape layer: a capture-phase keydown handler closes the
  // picker and stops the event so the Studio's bubble-phase dispatcher never
  // sees it. The Tools popover's own Escape handler deliberately steps aside
  // while an exempt surface (this dialog) is open — see
  // TOOLBOX_DISMISS_EXEMPT_SELECTOR in PhysicsPaintWorkflowStrip.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const target = event.target;
      if (target instanceof Node && surface.contains(target)) return;
      onClose();
    };
    const onEscapeKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onEscapeKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onEscapeKeyDown, true);
    };
  }, [open, onClose]);

  if (!open) return null;

  const rows = library.rows.value;
  const layers = library.scriptLayers.value;

  return (
    <div class="physics-paint-script-picker-dialog" data-toolbox-dismiss-exempt role="presentation">
      <div
        ref={surfaceRef}
        class="physics-paint-script-picker-surface"
        tabIndex={-1}
        role="dialog"
        aria-modal="false"
        aria-labelledby={TITLE_ID}
      >
        <div class="physics-paint-script-picker-header">
          <ListChecks size={15} class="physics-paint-script-picker-header-icon" aria-hidden="true" />
          <strong id={TITLE_ID}>{intent === 'load-apply' ? 'Load + Apply' : 'Create Rail'}</strong>
          <span class="physics-paint-script-picker-header-spacer" aria-hidden="true" />
          <button
            type="button"
            class="physics-paint-script-picker-close"
            aria-label="Close script picker"
            title="Close"
            onClick={onClose}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
        <div class="physics-paint-script-picker-content">
          <p class="physics-paint-script-picker-hint">Pick a project Script.</p>
          {rows.length ? (
            <div class="physics-paint-script-picker-list" role="listbox" aria-label="Project Scripts">
              {rows.map((row) => {
                const provenance = resolveScriptProvenance(row, layers);
                return (
                  <div
                    key={row.id}
                    role="option"
                    tabIndex={0}
                    aria-label={`Pick ${row.name}`}
                    class="physics-paint-script-picker-row"
                    onClick={() => onPick(row.id)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      // Only Space carries a page-scroll default; Enter is
                      // activation-only on a non-native option row.
                      if (event.key === ' ') event.preventDefault();
                      onPick(row.id);
                    }}
                  >
                    <img
                      class="physics-paint-script-thumbnail"
                      src={row.thumbnail.dataUrl}
                      width={row.thumbnail.width}
                      height={row.thumbnail.height}
                      alt=""
                    />
                    <span class="physics-paint-script-row-copy">
                      <span class="physics-paint-script-name">{row.name}</span>
                      <span class="physics-paint-script-provenance">
                        {row.source.projectName} · {provenance.layerName} · F{row.source.displayFrame}
                        {provenance.unavailable ? <span class="physics-paint-script-provenance-unavailable"> · unavailable</span> : null}
                      </span>
                      <span class="physics-paint-script-count">{row.brushCount} {row.brushCount === 1 ? 'brush' : 'brushes'}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div class="physics-paint-script-picker-empty">
              <p>No project Scripts yet.</p>
              <p>Save the current real Roto frame as a Script first.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
