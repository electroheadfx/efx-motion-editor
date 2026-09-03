import { useEffect, useRef } from 'preact/hooks';
import { Camera, Eye, EyeOff, Image, ImageUp, Lock, LockOpen, Trash2, WandSparkles, X } from 'lucide-preact';
import {
  usePhysicsPaintPhotoReferenceController,
  PHOTO_REFERENCE_EMPTY_SOURCE,
  PHOTO_REFERENCE_UNLOCKED_TOOLTIP,
  REVEAL_UNAVAILABLE_NO_REFERENCE_COPY,
  REVEAL_VARIANT_OPTIONS,
  REVEAL_WITH_SCRIPT_COPY,
  type PhysicsPaintPhotoReferencePorts,
} from './physicsPaintPhotoReferenceController';

/**
 * 50-UAT (modal redesign): the floating `Photo Reference` dialog — a MOVABLE
 * dialog opened from the strip camera icon (Play Script dialog pattern: no
 * backdrop, no focus trap — the Studio palette stays interactive while the
 * dialog floats above it). It owns ALL photo reference controls — the old
 * right-panel `Photo Reference` section moved here:
 *   - `Overlay opacity` slider (D-12, release-commit)
 *   - `Lock reference transform` toggle (D-13)
 *   - `Show in studio` toggle (D-11)
 *   - Source facts with the Import/Replace source button (D-03) — the same
 *     full-area reference picker opens behind the dialog
 *   - `Remove` (D-03 remove, only when a source exists)
 *
 * The Phase 50 `Mode` 3-segment control is REMOVED entirely (52-02, D-15 clean
 * break) — the `PhotoReferenceMode` flag no longer exists.
 *
 * The component is a thin render shell: the state machine lives in
 * `usePhysicsPaintPhotoReferenceController` (accepted canonical state only, no
 * optimistic facts). The visual layout matches the user's 50-UAT compact
 * mockup (252px card, short segment labels, custom slider, two-state toggles).
 * Header drag repositions the dialog by a translate() on top of its centered
 * surface (Play Script D-19 treatment); Escape closes; focus returns to the
 * element that opened it.
 *
 * Signals-only state (efx-preact-reactivity): no useState, no render-body
 * signal writes — the opacity draft lives in the controller's signal, the drag
 * offset is local pointer-drag state kept in refs.
 */

export interface PhysicsPaintPhotoReferenceDialogProps {
  /** Dialog visibility (owned by the Studio — set from the strip camera icon). */
  open: boolean;
  /** The launch layer; null means no Studio target (dialog renders nothing). */
  layerId: string | null;
  /** Store ports — production defaults hit the real store. */
  ports?: Partial<PhysicsPaintPhotoReferencePorts>;
  /** Close intent (Escape, header X). */
  onClose: () => void;
  /** Import/Replace source intent — opens the full-area reference picker. */
  onImportSource: () => void;
  /** 52-04 (D-19): pre-open the reveal-creation surface — the track rail-creation
   *  flow entry (the modal's "Reveal with script…" button opens it directly). */
  revealCreationRequested?: boolean;
}

export function PhysicsPaintPhotoReferenceDialog({
  open,
  layerId,
  ports,
  onClose,
  onImportSource,
  revealCreationRequested = false,
}: PhysicsPaintPhotoReferenceDialogProps) {
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

  // 52-04 (D-19): the controller is created before the early return so the
  // reveal-creation flow can be pre-opened by the track rail-creation entry
  // (revealCreationRequested) even when the dialog is already mounted. The
  // controller reads the document through the ports; a null layer id resolves
  // to the empty defaults and the dialog still renders nothing.
  const controller = usePhysicsPaintPhotoReferenceController({ layerId: layerId ?? '', ports, revealCreationRequested });
  // The track-flow entry flips the prop while the dialog may already be open —
  // open the flow from the LIVE controller (never a render-captured closure).
  useEffect(() => {
    if (revealCreationRequested && open) controller.openRevealCreation();
  }, [revealCreationRequested, open]);

  if (!open || !layerId) return null;

  const {
    previewOpacityPercent, transformLocked, visibleInStudio, sourceCount, filenames, hasSource,
    previewOpacity, commitOpacity, toggleTransformLocked, toggleVisible, removeReference,
    revealCreationOpen, revealScriptId, revealVariant, revealProgress, revealBusy, revealError,
    revealSpanStart, revealFrameCount,
    revealScriptRows, openRevealCreation, selectRevealScript, setRevealVariant, setRevealFrameCount, createRevealRail, cancelRevealCreation,
  } = controller;

  // G-52-2c: Create stays disabled until the span length is a positive integer.
  const revealFrameCountValid = Number.isInteger(revealFrameCount.value) && revealFrameCount.value >= 1;

  return (
    <div
      class={`physics-paint-photo-reference-dialog${draggingRef.current ? ' physics-paint-photo-reference-dragging' : ''}`}
      role="dialog"
      aria-labelledby="physics-photo-reference-title"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          handleClose();
        }
      }}
    >
      <div ref={surfaceRef} class={`physics-paint-photo-reference-surface${revealCreationOpen.value ? ' physics-paint-photo-reference-surface-reveal' : ''}`} tabIndex={-1}>
        <div
          class="physics-paint-photo-reference-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endHeaderDrag}
          onPointerCancel={endHeaderDrag}
        >
          <Camera size={15} class="physics-paint-photo-reference-header-icon" aria-hidden="true" />
          <strong id="physics-photo-reference-title">Photo Reference</strong>
          <span class="physics-paint-photo-reference-header-spacer" aria-hidden="true" />
          <button
            type="button"
            class="physics-paint-photo-reference-close"
            aria-label="Close photo reference"
            title="Close"
            onClick={handleClose}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
        <div class="physics-paint-photo-reference-content">
          <div class="physics-paint-photo-reference-opacity">
            <div class="physics-paint-photo-reference-opacity-labels">
              <span class="physics-paint-photo-reference-label">Overlay opacity</span>
              <span class="physics-paint-photo-reference-label-spacer" aria-hidden="true" />
              <output>{previewOpacityPercent}%</output>
            </div>
            <div class="physics-paint-photo-reference-slider">
              <div class="physics-paint-photo-reference-slider-rail" aria-hidden="true" />
              <div
                class="physics-paint-photo-reference-slider-fill"
                aria-hidden="true"
                style={{ width: `${previewOpacityPercent}%` }}
              />
              <div
                class="physics-paint-photo-reference-slider-thumb"
                aria-hidden="true"
                style={{ left: `calc(${previewOpacityPercent}% - 6px)` }}
              />
              <input
                id="physics-photo-reference-opacity"
                type="range"
                role="slider"
                aria-label="Overlay opacity"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={previewOpacityPercent}
                min={0}
                max={100}
                step={1}
                value={previewOpacityPercent}
                class="physics-paint-photo-reference-slider-input"
                onInput={(event) => previewOpacity(Number((event.currentTarget as HTMLInputElement).value))}
                onPointerUp={(event) => commitOpacity(Number((event.currentTarget as HTMLInputElement).value))}
                onKeyUp={(event) => commitOpacity(Number((event.currentTarget as HTMLInputElement).value))}
                onBlur={(event) => commitOpacity(Number((event.currentTarget as HTMLInputElement).value))}
              />
            </div>
          </div>

          <div class="physics-paint-photo-reference-toggles">
            <button
              type="button"
              class="physics-paint-photo-reference-toggle"
              aria-label="Lock reference transform"
              aria-pressed={transformLocked}
              title={transformLocked ? undefined : PHOTO_REFERENCE_UNLOCKED_TOOLTIP}
              onClick={toggleTransformLocked}
            >
              {transformLocked ? <Lock size={12} aria-hidden="true" /> : <LockOpen size={12} aria-hidden="true" />}
              <span>{transformLocked ? 'Locked' : 'Unlocked'}</span>
            </button>
            <button
              type="button"
              class="physics-paint-photo-reference-toggle"
              aria-label="Show reference in studio"
              aria-pressed={visibleInStudio}
              title={visibleInStudio ? 'Hide reference' : 'Show reference'}
              onClick={toggleVisible}
            >
              {visibleInStudio ? <Eye size={12} aria-hidden="true" /> : <EyeOff size={12} aria-hidden="true" />}
              <span>{visibleInStudio ? 'Visible' : 'Hidden'}</span>
            </button>
          </div>

          <div class="physics-paint-photo-reference-divider" aria-hidden="true" />

          <div class="physics-paint-photo-reference-source">
            <span class="physics-paint-photo-reference-label">Source</span>
            <span class="physics-paint-photo-reference-label-spacer" aria-hidden="true" />
            {hasSource ? (
              <span class="physics-paint-photo-reference-chip" title={filenames.join('\n')}>
                <Image size={11} class="physics-paint-photo-reference-chip-icon" aria-hidden="true" />
                <span>{sourceCount} image(s)</span>
              </span>
            ) : (
              <span class="physics-paint-photo-reference-empty">{PHOTO_REFERENCE_EMPTY_SOURCE}</span>
            )}
          </div>

          <div class="physics-paint-photo-reference-actions">
            <button type="button" class="physics-paint-photo-reference-import" onClick={onImportSource}>
              <ImageUp size={13} aria-hidden="true" />
              <span>{hasSource ? 'Replace source' : 'Import'}</span>
            </button>
            {hasSource ? (
              <button
                type="button"
                class="physics-paint-photo-reference-remove"
                aria-label="Remove photo reference"
                title="Remove photo reference"
                onClick={removeReference}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/* 52-04 (D-16/D-19): the "Reveal with script…" primary CTA — gated on a
              placed reference (D-12 creation guard). The button is a thin render
              shell; the reveal-creation state machine lives in the controller. */}
          <button
            type="button"
            class="physics-paint-photo-reference-reveal"
            aria-label={REVEAL_WITH_SCRIPT_COPY}
            aria-disabled={!hasSource ? 'true' : undefined}
            title={hasSource ? REVEAL_WITH_SCRIPT_COPY : REVEAL_UNAVAILABLE_NO_REFERENCE_COPY}
            disabled={!hasSource}
            onClick={openRevealCreation}
          >
            <WandSparkles size={13} aria-hidden="true" />
            <span>{REVEAL_WITH_SCRIPT_COPY}</span>
          </button>

          {/* 52-04 (D-11/D-26): the reveal-creation surface — the UNFILTERED SCRIPTS
              picker, the creation-time variant choice, and the create+bake action
              with the onProgress bar. Creation IS the first bake (D-11). */}
          {revealCreationOpen.value ? (
            <div class="physics-paint-photo-reference-reveal-creation" role="group" aria-label="Reveal with script">
              <div class="physics-paint-photo-reference-reveal-scripts" role="listbox" aria-label="Choose a script">
                {revealScriptRows.length === 0 ? (
                  <span class="physics-paint-photo-reference-reveal-empty">No project scripts yet. Save a script in the SCRIPTS library first.</span>
                ) : revealScriptRows.map((row) => {
                  const selected = revealScriptId.value === row.id;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      role="option"
                      aria-selected={selected ? 'true' : 'false'}
                      class={`physics-paint-photo-reference-reveal-script${selected ? ' selected' : ''}`}
                      disabled={revealBusy.value}
                      onClick={() => selectRevealScript(row.id)}
                    >
                      <img class="physics-paint-photo-reference-reveal-thumbnail" src={row.thumbnail.dataUrl} width={row.thumbnail.width} height={row.thumbnail.height} alt="" />
                      <span class="physics-paint-photo-reference-reveal-script-copy">
                        <span class="physics-paint-photo-reference-reveal-script-name">{row.name}</span>
                        <span class="physics-paint-photo-reference-reveal-script-count">{row.brushCount} {row.brushCount === 1 ? 'brush' : 'brushes'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <div class="physics-paint-photo-reference-reveal-variants" role="radiogroup" aria-label="Reveal variant">
                {REVEAL_VARIANT_OPTIONS.map((option) => {
                  const checked = revealVariant.value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={checked ? 'true' : 'false'}
                      class={`physics-paint-photo-reference-reveal-variant${checked ? ' active' : ''}`}
                      disabled={revealBusy.value}
                      title={option.helper}
                      onClick={() => setRevealVariant(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              {/* G-52-2c: the span is visible and editable at creation — the
                  length defaults to the script's natural duration, the start is
                  the playhead snapshot shown as "from F{n}". */}
              <div class="physics-paint-photo-reference-reveal-span">
                <label class="physics-paint-photo-reference-label" for="physics-photo-reference-reveal-frames">Frames</label>
                <input
                  id="physics-photo-reference-reveal-frames"
                  type="number"
                  min={1}
                  step={1}
                  aria-label="Reveal span length in frames"
                  value={revealFrameCount.value}
                  disabled={revealBusy.value}
                  onInput={(event) => setRevealFrameCount(Number((event.currentTarget as HTMLInputElement).value))}
                />
                <span class="physics-paint-photo-reference-reveal-span-hint">from F{revealSpanStart.value}</span>
              </div>
              {revealProgress.value ? (
                <div class="physics-paint-photo-reference-reveal-progress">
                  <progress max={revealProgress.value.total} value={revealProgress.value.completed}>
                    {revealProgress.value.completed}/{revealProgress.value.total}
                  </progress>
                  <span>{revealProgress.value.completed}/{revealProgress.value.total}</span>
                </div>
              ) : null}
              {revealError.value ? (
                <span role="alert" class="physics-paint-photo-reference-reveal-error">{revealError.value}</span>
              ) : null}
              <div class="physics-paint-photo-reference-reveal-actions">
                <button
                  type="button"
                  class="physics-paint-photo-reference-reveal-create"
                  aria-label="Create reveal rail"
                  disabled={revealScriptId.value === null || revealBusy.value || !revealFrameCountValid}
                  onClick={() => { void createRevealRail(); }}
                >
                  {revealBusy.value ? 'Baking…' : 'Create'}
                </button>
                <button
                  type="button"
                  class="physics-paint-photo-reference-reveal-cancel"
                  aria-label="Cancel reveal creation"
                  disabled={revealBusy.value}
                  onClick={cancelRevealCreation}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
