import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { RotoPlayScriptController, RotoPlayScriptMode } from '../roto/physicsPaintRotoPlayScriptController';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';

export interface PhysicsPaintPlayScriptDialogProps {
  playScript: RotoPlayScriptController;
  confirmationOpen: boolean;
  // D-08R/D-18: the LIVE Studio brush color (settings.color; sole writer setBrushColor). The
  // dialog is read-only toward it — the Custom pane renders it and Generate snapshots it via
  // the controller getBrushColor port; the dialog never copies it into local state.
  brushColor: string;
  returnFocusRef: RefObject<HTMLButtonElement>;
}

// D-05: locked mode options, labels, and helper copy (42-UI-SPEC Copywriting Contract).
const PLAY_SCRIPT_MODES: ReadonlyArray<{ value: RotoPlayScriptMode; label: string; helper: string }> = [
  { value: 'progressive', label: 'Progressive', helper: 'The drawing builds stroke by stroke across frames.' },
  { value: 'static', label: 'Static / Hold', helper: 'The complete drawing is applied to every cycle frame.' },
];

// 43-06 S4 (D-05): locked apply-time source-cycle choice options and helper copy
// (43-UI-SPEC Copywriting Contract — English only).
const PLAY_SCRIPT_SOURCE_CHOICES = [
  { value: 'link' as const, label: 'Link to existing cycle', helper: 'Reuses the existing source cycle. Future source edits update every linked loop.' },
  { value: 'create' as const, label: 'Create new cycle', helper: 'Creates an independent source cycle. Future edits do not affect the existing loops.' },
];

// D-08R: locked color options — value is the overrideEnabled target (false = Original colors
// disables the override; true = Custom color resolves live from the brush color).
const PLAY_SCRIPT_COLORS: ReadonlyArray<{ value: boolean; label: string }> = [
  { value: false, label: 'Original colors' },
  { value: true, label: 'Custom color' },
];

// Decorative original-colors dots (data, not accent — 42-UI-SPEC Color contract).
const ORIGINAL_COLOR_DOTS = ['#d2654d', '#2d9d6c', '#5a7bd4', '#d4699e'];

// 0-100 clamp mirroring the Motion panel convention (PanelSlider/clampWiggleValue).
function clampMotionValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

export function PhysicsPaintPlayScriptDialog({
  playScript,
  confirmationOpen,
  brushColor,
  returnFocusRef,
}: PhysicsPaintPlayScriptDialogProps) {
  recordPhysicsPaintPerformanceCounter('render.playScriptDialog');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const repeatInputRef = useRef<HTMLInputElement>(null);
  const previousOpen = useRef(false);
  // 43-06 dialog modes (D-01/D-02): loop-edit locks every source field;
  // source-edit re-prefills the full form; apply is the Phase 42 surface.
  const dialogMode = playScript.dialogMode.value;
  const loopEdit = dialogMode === 'loop-edit';
  const sourceEdit = dialogMode === 'source-edit';
  const editTarget = playScript.loopEditTarget.value;

  useEffect(() => {
    // Focus discipline (Phase 42): the editable primary field takes focus on
    // open — the Repeat input in loop-edit (Frames-per-cycle is locked).
    if (confirmationOpen) {
      if (playScript.dialogMode.value === 'loop-edit') repeatInputRef.current?.focus();
      else inputRef.current?.focus();
    } else if (previousOpen.current) returnFocusRef.current?.focus();
    previousOpen.current = confirmationOpen;
  }, [confirmationOpen, returnFocusRef, playScript]);

  // Header drag (UAT remediation): the modal repositions by pointer drag on its compact
  // header. The offset is a translate() on top of the grid-centered surface, so the Paint
  // layout behind is never touched (D-19). Local component state by locality — never shared.
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    baseX: number;
    baseY: number;
    rect: { left: number; top: number; width: number } | null;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const onHeaderPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    const rect = surfaceRef.current?.getBoundingClientRect?.() ?? null;
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      baseX: dragOffset.x,
      baseY: dragOffset.y,
      rect: rect ? { left: rect.left, top: rect.top, width: rect.width } : null,
    };
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    setDragging(true);
    event.preventDefault();
  };

  const onHeaderPointerMove = (event: PointerEvent) => {
    const start = dragStart.current;
    if (!start) return;
    let nextX = start.baseX + (event.clientX - start.pointerX);
    let nextY = start.baseY + (event.clientY - start.pointerY);
    // Keep at least 80px of the modal visible horizontally and the header reachable
    // vertically. Clamping needs real viewport/rect values — skipped in DOM-less tests.
    if (start.rect && typeof window !== 'undefined') {
      const deltaX = nextX - start.baseX;
      const deltaY = nextY - start.baseY;
      const clampedX = Math.min(Math.max(deltaX, 80 - start.rect.width - start.rect.left), window.innerWidth - 80 - start.rect.left);
      const clampedY = Math.min(Math.max(deltaY, -start.rect.top), window.innerHeight - 48 - start.rect.top);
      nextX = start.baseX + clampedX;
      nextY = start.baseY + clampedY;
    }
    setDragOffset({ x: nextX, y: nextY });
  };

  const endHeaderDrag = () => {
    dragStart.current = null;
    setDragging(false);
  };

  if (!confirmationOpen) return null;

  const busy = playScript.canCancel.value;
  const activeMode = PLAY_SCRIPT_MODES.find((option) => option.value === playScript.mode.value) ?? PLAY_SCRIPT_MODES[0];

  // D-03 revised: switching to Static / Hold with 'Max' in the field normalizes it to '1';
  // a numeric value is never rewritten by a mode switch.
  const selectMode = (value: RotoPlayScriptMode) => {
    if (loopEdit) return; // D-01: source fields are locked in loop-edit mode
    playScript.mode.value = value;
    if (value === 'static' && playScript.countText.value.trim().toLowerCase() === 'max') playScript.countText.value = '1';
  };

  // W3C APG radio pattern (D-05): arrow keys move focus AND check with wrap-around; the checked
  // option is the group's single Tab stop via roving tabindex (integrates with the trap query).
  const onModeKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (playScript.canCancel.value || loopEdit) return;
    const currentIndex = PLAY_SCRIPT_MODES.findIndex((option) => option.value === playScript.mode.value);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + PLAY_SCRIPT_MODES.length) % PLAY_SCRIPT_MODES.length;
    selectMode(PLAY_SCRIPT_MODES[nextIndex].value);
    const radios = (event.currentTarget as HTMLElement | null)?.querySelectorAll?.('[role="radio"]');
    (radios?.[nextIndex] as HTMLElement | undefined)?.focus?.();
  };

  // D-08R: same APG radio pattern as the Mode control. Original colors only disables the
  // override; Custom color only enables it — neither touches the brush color (D-18).
  const onColorKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (playScript.canCancel.value || loopEdit) return;
    const currentIndex = PLAY_SCRIPT_COLORS.findIndex((option) => option.value === playScript.overrideEnabled.value);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + PLAY_SCRIPT_COLORS.length) % PLAY_SCRIPT_COLORS.length;
    playScript.overrideEnabled.value = PLAY_SCRIPT_COLORS[nextIndex].value;
    const radios = (event.currentTarget as HTMLElement | null)?.querySelectorAll?.('[role="radio"]');
    (radios?.[nextIndex] as HTMLElement | undefined)?.focus?.();
  };

  // D-13/D-16 Row 4: the loop readout splits into Requested (left) and Effective (right)
  // inside the summary bar. Infinity reads 'Cycle {N}f × ∞' on the left (D-12).
  const loopReadout = playScript.loopReadout.value;
  const EFFECTIVE_SEPARATOR = ' · Effective: ';
  const effectiveSplitAt = loopReadout ? loopReadout.indexOf(EFFECTIVE_SEPARATOR) : -1;
  const summaryRequested = loopReadout ? (effectiveSplitAt >= 0 ? loopReadout.slice(0, effectiveSplitAt) : loopReadout) : null;
  const summaryEffective = loopReadout && effectiveSplitAt >= 0 ? `Effective: ${loopReadout.slice(effectiveSplitAt + EFFECTIVE_SEPARATOR.length)}` : null;

  // 43-06 S4 (D-05): the apply-time Link/Create choice renders only when the
  // controller reports an identical source cycle.
  const identicalCycle = !loopEdit && !sourceEdit ? playScript.identicalSourceCycle.value : null;
  const activeSourceChoice = PLAY_SCRIPT_SOURCE_CHOICES.find((option) => option.value === playScript.linkChoice.value) ?? PLAY_SCRIPT_SOURCE_CHOICES[0];

  // Same APG radio pattern as Mode/Color for the S4 segmented control.
  const onSourceChoiceKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (playScript.canCancel.value) return;
    const currentIndex = PLAY_SCRIPT_SOURCE_CHOICES.findIndex((option) => option.value === playScript.linkChoice.value);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + PLAY_SCRIPT_SOURCE_CHOICES.length) % PLAY_SCRIPT_SOURCE_CHOICES.length;
    playScript.linkChoice.value = PLAY_SCRIPT_SOURCE_CHOICES[nextIndex].value;
    const radios = (event.currentTarget as HTMLElement | null)?.querySelectorAll?.('[role="radio"]');
    (radios?.[nextIndex] as HTMLElement | undefined)?.focus?.();
  };

  return (
    <div
      ref={dialogRef}
      class={`physics-paint-play-script-dialog${dragging ? ' physics-paint-play-script-dragging' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="physics-play-script-title"
      onKeyDown={(event) => {
        // CR-01: the modal owns the keyboard while open — no keydown may bubble to the
        // Studio shortcut dispatcher (frame navigation/playback/undo behind the modal).
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          playScript.cancel();
          return;
        }
        if (event.key === 'Enter' && !playScript.validationError.value && !playScript.repeatError.value && !playScript.canCancel.value) {
          event.preventDefault();
          void playScript.confirm();
          return;
        }
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div class="physics-paint-play-script-backdrop" aria-hidden="true" />
      <div
        ref={surfaceRef}
        class="physics-paint-play-script-surface"
        style={dragOffset.x !== 0 || dragOffset.y !== 0 ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
      >
        <div
          class="physics-paint-play-script-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endHeaderDrag}
          onPointerCancel={endHeaderDrag}
        >
          <strong id="physics-play-script-title">{loopEdit ? 'Edit Loop Clip' : sourceEdit ? 'Edit Source Cycle' : 'Play Script'}</strong>
          {loopEdit && editTarget
            ? <span class="physics-paint-play-script-header-range">{`F${editTarget.placementStart} · Cycle ${editTarget.sourceKeyIds.length}f`}</span>
            : <span class="physics-paint-play-script-header-range">Max {playScript.capacity.value}{playScript.destinationRange.value ? ` · ${playScript.destinationRange.value}` : ''}</span>}
        </div>
        <div class="physics-paint-play-script-content">
          {sourceEdit ? (
            <p class="physics-paint-play-script-notice">
              Confirming regenerates the source cycle and updates every linked Loop Clip referencing it.
              {playScript.sourceEditSharedLoopCount.value > 1 ? ` This source cycle is shared by ${playScript.sourceEditSharedLoopCount.value} loops.` : ''}
            </p>
          ) : null}
          <div class={`physics-paint-play-script-card physics-paint-play-script-card-wide physics-paint-play-script-card-mode${loopEdit ? ' physics-paint-play-script-locked' : ''}`}>
            <span class="physics-paint-play-script-card-title">Mode</span>
            <div
              class="physics-paint-play-script-mode-group"
              role="radiogroup"
              aria-label="Mode"
              aria-describedby="physics-play-script-mode-helper"
              onKeyDown={onModeKeyDown}
            >
              {PLAY_SCRIPT_MODES.map((option) => {
                const checked = playScript.mode.value === option.value;
                return (
                  <div
                    key={option.value}
                    class="physics-paint-play-script-mode-option"
                    role="radio"
                    aria-checked={checked}
                    aria-disabled={busy || loopEdit}
                    tabIndex={!busy && !loopEdit && checked ? 0 : -1}
                    onClick={(event) => {
                      if (playScript.canCancel.value || loopEdit) return;
                      selectMode(option.value);
                      (event.currentTarget as HTMLElement | null)?.focus?.();
                    }}
                  >
                    {option.label}
                  </div>
                );
              })}
            </div>
            <span id="physics-play-script-mode-helper" class="physics-paint-play-script-mode-helper">{activeMode.helper}</span>
          </div>
          <div class="physics-paint-play-script-card physics-paint-play-script-card-timing">
            <span class="physics-paint-play-script-card-title">Timing</span>
            <div class={`physics-paint-play-script-field${loopEdit ? ' physics-paint-play-script-locked' : ''}`}>
              <label for="physics-play-script-count">{playScript.mode.value === 'static' || loopEdit ? 'Frames per cycle' : 'Frames'}</label>
              <input
                ref={inputRef}
                id="physics-play-script-count"
                inputMode="numeric"
                value={playScript.countText.value}
                disabled={busy || loopEdit}
                aria-invalid={Boolean(playScript.validationError.value)}
                aria-describedby="physics-play-script-help physics-play-script-error"
                onInput={(event) => {
                  playScript.countText.value = (event.currentTarget as HTMLInputElement).value;
                }}
              />
              <span id="physics-play-script-help" class="physics-paint-play-script-hint">Enter a positive integer or Max.</span>
              {playScript.validationError.value ? <span id="physics-play-script-error" class="physics-paint-script-inline-error">{playScript.validationError.value}</span> : null}
            </div>
            <div class="physics-paint-play-script-field">
              <label for="physics-play-script-repeat">Repeat</label>
              <div class="physics-paint-play-script-repeat-row">
                <input
                  ref={repeatInputRef}
                  id="physics-play-script-repeat"
                  inputMode="numeric"
                  value={playScript.repeatText.value}
                  disabled={busy || playScript.infinity.value}
                  aria-invalid={Boolean(playScript.repeatError.value)}
                  aria-describedby="physics-play-script-repeat-help physics-play-script-repeat-error"
                  onInput={(event) => {
                    playScript.repeatText.value = (event.currentTarget as HTMLInputElement).value;
                  }}
                />
                <label class="physics-paint-play-script-infinity-toggle">
                  <input
                    type="checkbox"
                    checked={playScript.infinity.value}
                    disabled={busy}
                    onChange={(event) => playScript.setInfinity((event.currentTarget as HTMLInputElement).checked)}
                  />
                  Infinity
                </label>
              </div>
              <span id="physics-play-script-repeat-help" class="physics-paint-play-script-hint">Enter a positive integer.</span>
              {playScript.repeatError.value ? <span id="physics-play-script-repeat-error" class="physics-paint-script-inline-error">{playScript.repeatError.value}</span> : null}
            </div>
          </div>
          <div class="physics-paint-play-script-side-stack">
            <div class={`physics-paint-play-script-card physics-paint-play-script-card-color${loopEdit ? ' physics-paint-play-script-locked' : ''}`}>
              <span class="physics-paint-play-script-card-title">Color</span>
              <div
                class="physics-paint-play-script-mode-group"
                role="radiogroup"
                aria-label="Color"
                onKeyDown={onColorKeyDown}
              >
                {PLAY_SCRIPT_COLORS.map((option) => {
                  const checked = playScript.overrideEnabled.value === option.value;
                  return (
                    <div
                      key={option.label}
                      class="physics-paint-play-script-mode-option"
                      role="radio"
                      aria-checked={checked}
                      aria-disabled={busy || loopEdit}
                      tabIndex={!busy && !loopEdit && checked ? 0 : -1}
                      onClick={(event) => {
                        if (playScript.canCancel.value || loopEdit) return;
                        playScript.overrideEnabled.value = option.value;
                        (event.currentTarget as HTMLElement | null)?.focus?.();
                      }}
                    >
                      {option.label}
                    </div>
                  );
                })}
              </div>
              <div class="physics-paint-play-script-color-pane">
                {playScript.overrideEnabled.value ? (
                  <div class="physics-paint-play-script-color-custom-row">
                    <span class="physics-paint-play-script-override-chip" style={{ backgroundColor: brushColor }} />
                    <div class="physics-paint-play-script-color-meta">
                      <span class="physics-paint-play-script-color-hex">{brushColor}</span>
                      <span class="physics-paint-play-script-color-note">Picked from the app's brush color panel</span>
                    </div>
                  </div>
                ) : (
                  <div class="physics-paint-play-script-color-original-row">
                    <span class="physics-paint-play-script-color-dots" aria-hidden="true">
                      {ORIGINAL_COLOR_DOTS.map((color) => <i key={color} style={{ background: color }} />)}
                    </span>
                    Keep each stroke's original paint color.
                  </div>
                )}
              </div>
            </div>
            <div class={`physics-paint-play-script-card physics-paint-play-script-card-motion${loopEdit ? ' physics-paint-play-script-locked' : ''}`}>
              <div class="physics-paint-play-script-card-heading">
                <span class="physics-paint-play-script-card-title">Motion wiggle</span>
                <button
                  type="button"
                  class="physics-paint-play-script-heading-link"
                  disabled={busy || loopEdit}
                  onClick={() => playScript.resetDialogMotion()}
                >
                  Reset defaults
                </button>
              </div>
              <div class="physics-paint-play-script-motion-rows">
                <label class="physics-paint-play-script-slider-row" for="physics-play-script-motion-deformation">
                  <span>Deformation</span>
                  <input
                    id="physics-play-script-motion-deformation"
                    type="range"
                    min={0}
                    max={100}
                    value={playScript.dialogMotion.value.deformation}
                    disabled={busy || loopEdit}
                    onInput={(event) => {
                      playScript.dialogMotion.value = { ...playScript.dialogMotion.value, deformation: clampMotionValue(Number((event.currentTarget as HTMLInputElement).value)) };
                    }}
                  />
                  <output>{playScript.dialogMotion.value.deformation}</output>
                </label>
                <label class="physics-paint-play-script-slider-row" for="physics-play-script-motion-position">
                  <span>Position</span>
                  <input
                    id="physics-play-script-motion-position"
                    type="range"
                    min={0}
                    max={100}
                    value={playScript.dialogMotion.value.position}
                    disabled={busy || loopEdit}
                    onInput={(event) => {
                      playScript.dialogMotion.value = { ...playScript.dialogMotion.value, position: clampMotionValue(Number((event.currentTarget as HTMLInputElement).value)) };
                    }}
                  />
                  <output>{playScript.dialogMotion.value.position}</output>
                </label>
              </div>
            </div>
          </div>
          {identicalCycle ? (
            <div class="physics-paint-play-script-card physics-paint-play-script-card-wide physics-paint-play-script-card-source-choice">
              <span class="physics-paint-play-script-card-title">Source cycle</span>
              <div
                class="physics-paint-play-script-mode-group"
                role="radiogroup"
                aria-label="Source cycle"
                aria-describedby="physics-play-script-source-helper"
                onKeyDown={onSourceChoiceKeyDown}
              >
                {PLAY_SCRIPT_SOURCE_CHOICES.map((option) => {
                  const checked = playScript.linkChoice.value === option.value;
                  return (
                    <div
                      key={option.value}
                      class="physics-paint-play-script-mode-option"
                      role="radio"
                      aria-checked={checked}
                      aria-disabled={busy}
                      tabIndex={!busy && checked ? 0 : -1}
                      onClick={(event) => {
                        if (playScript.canCancel.value) return;
                        playScript.linkChoice.value = option.value;
                        (event.currentTarget as HTMLElement | null)?.focus?.();
                      }}
                    >
                      {option.label}
                    </div>
                  );
                })}
              </div>
              <span id="physics-play-script-source-helper" class="physics-paint-play-script-mode-helper">
                {activeSourceChoice.helper}
                {playScript.linkChoice.value === 'link'
                  ? ` Source F${identicalCycle.sourceStart}–F${identicalCycle.sourceStart + identicalCycle.sourceKeyIds.length - 1} · ${identicalCycle.loopCount} linked loop(s).`
                  : ''}
              </span>
            </div>
          ) : null}
          {summaryRequested ? (
            <p class="physics-paint-play-script-summary-bar">
              <span class="physics-paint-play-script-summary-requested">{summaryRequested}</span>
              {summaryEffective ? <span class="physics-paint-play-script-summary-effective">{summaryEffective}</span> : null}
            </p>
          ) : null}
        </div>
        {playScript.error.value ? <span class="physics-paint-script-inline-error physics-paint-play-script-dialog-error">{playScript.error.value}</span> : null}
        <div class="physics-paint-play-script-footer">
          <div class="physics-paint-play-script-progress-line">
            {playScript.progress.value ? <progress max={playScript.progress.value.total} value={playScript.progress.value.completed}>{playScript.progress.value.completed}/{playScript.progress.value.total}</progress> : null}
            <span class="physics-paint-play-script-progress-status">{playScript.progress.value ? `${playScript.progress.value.completed}/${playScript.progress.value.total}` : ''}</span>
          </div>
          <div class="physics-paint-play-script-actions">
            <button type="button" class="physics-paint-play-script-button physics-paint-play-script-button-ghost" onClick={playScript.cancel}>{playScript.canCancel.value ? 'Cancel generation' : 'Cancel'}</button>
            {loopEdit && !playScript.canCancel.value ? (
              <button
                type="button"
                class="physics-paint-play-script-button physics-paint-play-script-button-ghost"
                onClick={() => {
                  const targetId = playScript.loopEditTargetId.value;
                  if (targetId) void playScript.openSourceEdit(targetId);
                }}
              >
                Edit source cycle…
              </button>
            ) : null}
            {!playScript.canCancel.value ? (
              <button
                type="button"
                class="physics-paint-play-script-button physics-paint-play-script-button-primary"
                disabled={Boolean(playScript.validationError.value) || Boolean(playScript.repeatError.value)}
                onClick={() => { void playScript.confirm(); }}
              >
                {loopEdit ? 'Update loop' : sourceEdit ? 'Regenerate source cycle' : 'Generate'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
