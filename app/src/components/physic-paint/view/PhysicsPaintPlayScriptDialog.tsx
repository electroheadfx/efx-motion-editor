import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { SliderStepper } from '../../shared/SliderStepper';
import type { RotoPlayScriptController, RotoPlayScriptMode } from '../roto/physicsPaintRotoPlayScriptController';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';

export interface PhysicsPaintPlayScriptDialogProps {
  playScript: RotoPlayScriptController;
  confirmationOpen: boolean;
  // D-08R/D-18: the LIVE Studio brush color (settings.color; sole writer setBrushColor). The
  // dialog is read-only toward it — the Custom pane renders it and Generate snapshots it via
  // the controller getBrushColor port; the dialog never copies it into local state.
  brushColor: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

// D-05: locked mode options, labels, and helper copy (42-UI-SPEC Copywriting Contract).
const PLAY_SCRIPT_MODES: ReadonlyArray<{ value: RotoPlayScriptMode; label: string }> = [
  { value: 'progressive', label: 'Motion' },
  { value: 'static', label: 'Static' },
];

// 52-05 (G-52-3): the Reveal Photo Rail variant options — the same progressive/static
// union with the reveal captions (52 UI-SPEC Copywriting Contract, mirrors D-03/D-26).
const REVEAL_RAIL_TYPES: ReadonlyArray<{ value: RotoPlayScriptMode; label: string }> = [
  { value: 'progressive', label: 'Reveal Motion' },
  { value: 'static', label: 'Reveal Static' },
];

// 52-05 (G-52-3): the Create Rail dialog tabs (apply mode only).
const RAIL_TABS = [
  { value: 'paint' as const, label: 'Paint Rail' },
  { value: 'reveal' as const, label: 'Reveal Photo Rail' },
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

// Integer fields hand SliderStepper a number; an empty/invalid draft falls back
// to the floor (the controller's error channel still reports the real problem).
function dialogIntegerValue(text: string, floor: number): number {
  const trimmed = text.trim();
  const parsed = Number(trimmed);
  return trimmed !== '' && Number.isSafeInteger(parsed) && parsed >= floor ? parsed : floor;
}

// The top-bar Script switch's visuals, compacted for the dialog cards. Inline
// markup (not a component) so this dialog's node-tree tests see the label text.
function dialogSwitch(props: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      id={props.id}
      class={`physics-paint-script-switch physics-paint-play-script-switch${props.checked ? ' is-on' : ''}`}
      role="switch"
      aria-checked={props.checked ? 'true' : 'false'}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      <span class="physics-paint-script-switch-track" aria-hidden="true">
        <span class="physics-paint-script-switch-knob" />
      </span>
      <span class="physics-paint-script-switch-label">{props.label}</span>
    </button>
  );
}

export function PhysicsPaintPlayScriptDialog({
  playScript,
  confirmationOpen,
  brushColor,
  returnFocusRef,
}: PhysicsPaintPlayScriptDialogProps) {
  recordPhysicsPaintPerformanceCounter('render.playScriptDialog');
  const inputRef = useRef<HTMLInputElement>(null);
  const revealInputRef = useRef<HTMLInputElement>(null);
  const repeatInputRef = useRef<HTMLInputElement>(null);
  const previousOpen = useRef(false);
  // 43-06 dialog modes (D-01/D-02): loop-edit locks every source field;
  // source-edit re-prefills the full form; apply is the Phase 42 surface.
  const dialogMode = playScript.dialogMode.value;
  const loopEdit = dialogMode === 'loop-edit';
  const sourceEdit = dialogMode === 'source-edit';
  const editTarget = playScript.loopEditTarget.value;
  const regenerateImpact = sourceEdit ? playScript.regenerateImpact.value : null;
  const regenerateSecondaryRef = useRef<HTMLButtonElement>(null);
  const regenerateTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreRegenerateTriggerFocus = useRef(false);
  // 52-05 (G-52-3): the tab strip is an apply-mode creation surface — edit and
  // regenerate modes keep their existing single-surface layout.
  const tabsVisible = !loopEdit && !sourceEdit && !regenerateImpact;
  const revealTab = playScript.railTab.value === 'reveal' && !loopEdit && !sourceEdit;

  useEffect(() => {
    // Focus follows the visible dialog state: G3a starts on its non-destructive
    // action, while returning to Edit Rail restores the Regenerate trigger.
    if (confirmationOpen) {
      if (regenerateImpact) regenerateSecondaryRef.current?.focus();
      else if (dialogMode === 'loop-edit') {
        if (restoreRegenerateTriggerFocus.current) {
          restoreRegenerateTriggerFocus.current = false;
          regenerateTriggerRef.current?.focus();
        } else repeatInputRef.current?.focus();
      } else if (playScript.railTab.value === 'reveal') revealInputRef.current?.focus();
      else inputRef.current?.focus();
    } else if (previousOpen.current) returnFocusRef.current?.focus();
    previousOpen.current = confirmationOpen;
  }, [confirmationOpen, returnFocusRef, dialogMode, regenerateImpact]);

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
  // 52-05 (G-52-3): the Rail Type control renders the Paint labels on the Paint
  // tab and the Reveal labels on the Reveal tab — both write the same mode union.
  const activeModeOptions = revealTab ? REVEAL_RAIL_TYPES : PLAY_SCRIPT_MODES;

  const selectMode = (value: RotoPlayScriptMode) => {
    // D-01: source fields are locked in loop-edit.
    if (loopEdit) return;
    playScript.mode.value = value;
  };

  // W3C APG radio pattern (D-05): arrow keys move focus AND check with wrap-around; the checked
  // option is the group's single Tab stop via roving tabindex.
  const onModeKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (playScript.canCancel.value || loopEdit) return;
    const currentIndex = activeModeOptions.findIndex((option) => option.value === playScript.mode.value);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + activeModeOptions.length) % activeModeOptions.length;
    selectMode(activeModeOptions[nextIndex].value);
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
  const summaryBar = summaryRequested ? (
    <p class="physics-paint-play-script-summary-bar">
      <span class="physics-paint-play-script-summary-requested">{summaryRequested}</span>
      {summaryEffective ? <span class="physics-paint-play-script-summary-effective">{summaryEffective}</span> : null}
    </p>
  ) : null;

  // 43-06 S4 (D-05): the apply-time Link/Create choice renders only when the
  // controller reports an identical source cycle — a Paint Rail concept only
  // (the Reveal tab always bakes a fresh cycle through the reveal mutation).
  // 261030-ig0: linking is a creation choice — a key edit never rewrites
  // sourceKeyIds, so no Source cycle card renders in source-edit.
  const identicalCycle = !loopEdit && !sourceEdit && !revealTab ? playScript.identicalSourceCycle.value : null;
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

  const keepLocalChanges = () => {
    const targetId = playScript.loopEditTargetId.value;
    if (!targetId) return;
    restoreRegenerateTriggerFocus.current = true;
    void playScript.openLoopEdit(targetId);
  };

  // 52-05 (G-52-3): the Motion wiggle card is shared by both tabs — the wiggle
  // feeds the bake for BOTH reveal variants (D-09) and drives the Reveal Static
  // per-frame variation. Only one tab renders at a time, so the ids are unique.
  const motionCard = (
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
        <SliderStepper
          id="physics-play-script-motion-deformation"
          label="Deformation"
          ariaLabel="Deformation"
          value={playScript.dialogMotion.value.deformation}
          onChange={(value) => {
            playScript.dialogMotion.value = { ...playScript.dialogMotion.value, deformation: clampMotionValue(value) };
          }}
          min={0}
          max={100}
          step={1}
          disabled={busy || loopEdit}
        />
        <SliderStepper
          id="physics-play-script-motion-position"
          label="Position"
          ariaLabel="Position"
          value={playScript.dialogMotion.value.position}
          onChange={(value) => {
            playScript.dialogMotion.value = { ...playScript.dialogMotion.value, position: clampMotionValue(value) };
          }}
          min={0}
          max={100}
          step={1}
          disabled={busy || loopEdit}
        />
        <SliderStepper
          id="physics-play-script-motion-rotation"
          label="Rotation"
          ariaLabel="Rotation"
          value={playScript.dialogMotion.value.rotation}
          onChange={(value) => {
            playScript.dialogMotion.value = { ...playScript.dialogMotion.value, rotation: clampMotionValue(value) };
          }}
          min={0}
          max={100}
          step={1}
          disabled={busy || loopEdit}
        />
        <SliderStepper
          id="physics-play-script-motion-scale"
          label="Scale"
          ariaLabel="Scale"
          value={playScript.dialogMotion.value.scale}
          onChange={(value) => {
            playScript.dialogMotion.value = { ...playScript.dialogMotion.value, scale: clampMotionValue(value) };
          }}
          min={0}
          max={100}
          step={1}
          disabled={busy || loopEdit}
        />
      </div>
    </div>
  );

  // 261029-vbp: the Reveal tab's colorize card — the script's wash pigment tints
  // the revealed photo (hue+saturation from the wash, luminosity from the
  // photo) at the chosen mix. Off by default; the mix defaults to 100 on enable.
  // The class is deliberately `-card-colorize`: the Paint tab still owns the
  // `-card-color` token and its zero assertion must stay green.
  const colorizeCard = (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-colorize">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Colorize</span>
      </div>
      {dialogSwitch({
        id: 'physics-play-script-colorize',
        label: 'Colorize with wash color',
        checked: playScript.colorize.value,
        disabled: busy,
        onClick: () => playScript.setColorize(!playScript.colorize.value),
      })}
      <label class="physics-paint-play-script-slider-row" for="physics-play-script-colorize-mix">
        <span>Mix</span>
        <input
          id="physics-play-script-colorize-mix"
          type="range"
          min={0}
          max={100}
          value={playScript.colorizeMix.value}
          disabled={busy || !playScript.colorize.value}
          onInput={(event) => playScript.setColorizeMix(Number((event.currentTarget as HTMLInputElement).value))}
        />
        <output>{playScript.colorizeMix.value}</output>
      </label>
    </div>
  );

  // 261030-ey9: the Reveal tab's Photo wiggle — moves photo AND wash as ONE
  // rigid unit per held frame. Off keeps today's behaviour (only the wash
  // coverage wiggles). No separate strength: it reuses the Motion wiggle values,
  // so all values at 0 means no visible motion even when checked.
  const photoWiggleCard = (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-photo-wiggle">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Photo wiggle</span>
      </div>
      {dialogSwitch({
        id: 'physics-play-script-photo-wiggle',
        label: 'Wiggle photo and wash together',
        checked: playScript.photoWiggle.value,
        disabled: busy,
        onClick: () => playScript.setPhotoWiggle(!playScript.photoWiggle.value),
      })}
    </div>
  );

  // 261030-v1t: "Same strokes, new brush texture each frame" — every output
  // frame is re-baked from scratch under a per-frame paint salt. Off keeps the
  // cumulative-sheet pixels of today exactly. Creation setting only (apply
  // mode); one card serves both tabs, so only one renders at a time.
  const paintSeedVariationCard = (
    <div class="physics-paint-play-script-card physics-paint-play-script-card-paint-seed-variation">
      <div class="physics-paint-play-script-card-heading">
        <span class="physics-paint-play-script-card-title">Paint seed variation</span>
      </div>
      {dialogSwitch({
        id: 'physics-play-script-paint-seed-variation',
        label: 'Vary the brush texture per frame',
        checked: playScript.paintSeedVariation.value,
        disabled: busy,
        onClick: () => playScript.setPaintSeedVariation(!playScript.paintSeedVariation.value),
      })}
    </div>
  );

  return (
    <div
      class={`physics-paint-play-script-dialog${revealTab ? ' physics-paint-play-script-reveal' : ''}${dragging ? ' physics-paint-play-script-dragging' : ''}`}
      role="dialog"
      aria-labelledby="physics-play-script-title"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          if (regenerateImpact) keepLocalChanges();
          else playScript.cancel();
          return;
        }
        if (!regenerateImpact && event.key === 'Enter' && !playScript.canCancel.value) {
          const tabValidationError = revealTab ? playScript.revealValidationError.value : playScript.validationError.value;
          if (tabValidationError || playScript.repeatError.value) return;
          event.preventDefault();
          void playScript.confirm();
        }
      }}
    >
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
          <strong id="physics-play-script-title">{regenerateImpact
            ? `Regenerate “${regenerateImpact.groupName}”?`
            : loopEdit
              ? 'Edit Rail'
              : sourceEdit
                ? 'Edit Source Cycle'
                : 'Run Script'}</strong>
          {regenerateImpact
            ? <span class="physics-paint-play-script-header-range">{regenerateImpact.restoredRange}</span>
            : loopEdit && editTarget
              ? <span class="physics-paint-play-script-header-range">{`F${editTarget.placementStart} · Cycle ${editTarget.sourceKeyIds.length}f`}</span>
              : <span class="physics-paint-play-script-header-range">Max {playScript.capacity.value}{playScript.destinationRange.value ? ` · ${playScript.destinationRange.value}` : ''}</span>}
        </div>
        <div class="physics-paint-play-script-content">
          {regenerateImpact ? (
            <div class="physics-paint-play-script-regenerate">
              <p class="physics-paint-play-script-regenerate-lead">Regenerate discards accepted local Rail changes and restores the result from the saved Script and stored Rail settings.</p>
              <dl class="physics-paint-play-script-regenerate-facts">
                <div class="physics-paint-play-script-regenerate-fact"><dt>Rail</dt><dd>{regenerateImpact.groupName}</dd></div>
                <div class="physics-paint-play-script-regenerate-fact"><dt>Rail Type</dt><dd>{regenerateImpact.groupType}</dd></div>
                <div class="physics-paint-play-script-regenerate-fact"><dt>Restored range</dt><dd>{regenerateImpact.restoredRange}</dd></div>
                <div class="physics-paint-play-script-regenerate-fact"><dt>Locally painted frames</dt><dd>{regenerateImpact.locallyPaintedFrameCount}</dd></div>
                <div class="physics-paint-play-script-regenerate-fact"><dt>Deleted frames</dt><dd>{regenerateImpact.deletedFrameCount > 0 ? `${regenerateImpact.deletedFrameCount} · ${regenerateImpact.deletedFrameRanges}` : 'None'}</dd></div>
                <div class="physics-paint-play-script-regenerate-fact"><dt>Fragments</dt><dd>{regenerateImpact.fragmentCount} → 1</dd></div>
                <div class="physics-paint-play-script-regenerate-fact"><dt>Gaps cleared</dt><dd>{regenerateImpact.gapRanges}</dd></div>
                <div class="physics-paint-play-script-regenerate-fact"><dt>Result</dt><dd>Synchronized with Script.</dd></div>
                <div class="physics-paint-play-script-regenerate-fact"><dt>Source/cache effects</dt><dd>{regenerateImpact.sourceCacheEffects}</dd></div>
              </dl>
              {regenerateImpact.affectedGroups.length > 1 ? (
                <div class="physics-paint-play-script-regenerate-shared">
                  <p class="physics-paint-play-script-regenerate-shared-lead">Regenerate will update {regenerateImpact.affectedGroups.length} Rails that share the same accepted source cycle.</p>
                  <ul class="physics-paint-play-script-regenerate-group-list">
                    {regenerateImpact.affectedGroups.map((group) => (
                      <li key={group.groupId} class="physics-paint-play-script-regenerate-group-item">{group.name} · {group.range}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (<>
          {tabsVisible ? (
            <div class="physics-paint-play-script-tabs" role="tablist" aria-label="Rail kind">
              {RAIL_TABS.map((tab) => {
                const selected = playScript.railTab.value === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={selected ? 'true' : 'false'}
                    class={`physics-paint-play-script-tab${selected ? ' active' : ''}`}
                    disabled={busy}
                    onClick={() => playScript.setRailTab(tab.value)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          {sourceEdit ? (
            <p class="physics-paint-play-script-notice">
              Confirming regenerates the source cycle and updates every linked Rail referencing it.
              {playScript.sourceEditSharedLoopCount.value > 1 ? ` This source cycle is shared by ${playScript.sourceEditSharedLoopCount.value} Rails.` : ''}
            </p>
          ) : null}
          <div class={`physics-paint-play-script-card physics-paint-play-script-card-wide physics-paint-play-script-card-mode${loopEdit ? ' physics-paint-play-script-locked' : ''}`}>
            <span class="physics-paint-play-script-card-title">Rail Type</span>
            <div
              class="physics-paint-play-script-mode-group"
              role="radiogroup"
              aria-label="Rail Type"
              onKeyDown={onModeKeyDown}
            >
              {activeModeOptions.map((option) => {
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
          </div>
          {/* 52-05 (G-52-3): the Reveal tab's Timing card — the Frames field
              defaults to the script's natural duration with the "from F{n}" hint
              (the playhead snapshotted at open, D-20); Repeat + Infinity ride
              the same mutation law as the Paint Rail (D-08). No Max toggle. */}
          {/* 261030-np9 (D-08): column 1 is Timing plus, directly beneath it,
              the per-key script opt-in — it fills the empty space under Timing
              instead of opening a new grid row. Apply-mode creation only. */}
          <div class="physics-paint-play-script-key-column">
          {revealTab ? (
          <div class="physics-paint-play-script-card physics-paint-play-script-card-timing">
            <span class="physics-paint-play-script-card-title">Timing</span>
            <div class="physics-paint-play-script-timing-grid">
              <div class="physics-paint-play-script-field">
                <SliderStepper
                  id="physics-play-script-reveal-count"
                  inputRef={revealInputRef}
                  label="Frames"
                  ariaLabel="Frames"
                  value={dialogIntegerValue(playScript.revealCountText.value, 1)}
                  onChange={(value) => { playScript.revealCountText.value = String(value); }}
                  min={1}
                  max={Math.max(1, playScript.capacity.value)}
                  sliderMax={Math.max(1, playScript.capacity.value)}
                  step={1}
                  disabled={busy}
                  ariaInvalid={Boolean(playScript.revealValidationError.value)}
                  ariaDescribedBy={playScript.revealValidationError.value ? 'physics-play-script-reveal-error' : undefined}
                />
                <div class="physics-paint-play-script-timing-foot">
                  <span class="physics-paint-play-script-hint">from F{playScript.canonicalStart.value ?? 0}</span>
                </div>
                {playScript.revealValidationError.value ? <span id="physics-play-script-reveal-error" class="physics-paint-script-inline-error">{playScript.revealValidationError.value}</span> : null}
              </div>
              <div class="physics-paint-play-script-field">
                <SliderStepper
                  id="physics-play-script-repeat"
                  label="Cycle"
                  ariaLabel="Cycle"
                  value={dialogIntegerValue(playScript.repeatText.value, 1)}
                  onChange={(value) => { playScript.repeatText.value = String(value); }}
                  min={1}
                  sliderMax={16}
                  step={1}
                  disabled={busy || playScript.infinity.value}
                  ariaInvalid={Boolean(playScript.repeatError.value)}
                  ariaDescribedBy={playScript.repeatError.value ? 'physics-play-script-repeat-error' : undefined}
                />
                <div class="physics-paint-play-script-timing-foot">
                  {dialogSwitch({
                    id: 'physics-play-script-infinity',
                    label: 'Infinity',
                    checked: playScript.infinity.value,
                    disabled: busy,
                    onClick: () => playScript.setInfinity(!playScript.infinity.value),
                  })}
                </div>
                {playScript.repeatError.value ? <span id="physics-play-script-repeat-error" class="physics-paint-script-inline-error">{playScript.repeatError.value}</span> : null}
              </div>
            </div>
          </div>
          ) : (
          <div class="physics-paint-play-script-card physics-paint-play-script-card-timing">
            <span class="physics-paint-play-script-card-title">Timing</span>
            {/* 261030-v1t UAT: Frames and Repeat share one row; each capacity
                toggle sits directly under its own field. */}
            <div class="physics-paint-play-script-timing-grid">
              <div class={`physics-paint-play-script-field${loopEdit ? ' physics-paint-play-script-locked' : ''}`}>
                <SliderStepper
                  id="physics-play-script-count"
                  inputRef={inputRef}
                  label={playScript.mode.value === 'static' || loopEdit ? 'Frames per cycle' : 'Frames'}
                  ariaLabel={playScript.mode.value === 'static' || loopEdit ? 'Frames per cycle' : 'Frames'}
                  value={dialogIntegerValue(playScript.countText.value, 1)}
                  onChange={(value) => { playScript.countText.value = String(value); }}
                  min={1}
                  max={Math.max(1, playScript.capacity.value)}
                  sliderMax={Math.max(1, playScript.capacity.value)}
                  step={1}
                  disabled={busy || loopEdit || playScript.max.value}
                  ariaInvalid={Boolean(playScript.validationError.value)}
                  ariaDescribedBy={playScript.validationError.value ? 'physics-play-script-error' : undefined}
                />
                <div class="physics-paint-play-script-timing-foot">
                  {dialogSwitch({
                    id: 'physics-play-script-max',
                    label: 'Max',
                    checked: playScript.max.value,
                    disabled: busy || loopEdit,
                    onClick: () => playScript.setMax(!playScript.max.value),
                  })}
                </div>
                {playScript.validationError.value ? <span id="physics-play-script-error" class="physics-paint-script-inline-error">{playScript.validationError.value}</span> : null}
              </div>
              <div class="physics-paint-play-script-field">
                <SliderStepper
                  id="physics-play-script-repeat"
                  inputRef={repeatInputRef}
                  label="Cycle"
                  ariaLabel="Cycle"
                  value={dialogIntegerValue(playScript.repeatText.value, 1)}
                  onChange={(value) => { playScript.repeatText.value = String(value); }}
                  min={1}
                  sliderMax={16}
                  step={1}
                  disabled={busy || playScript.infinity.value}
                  ariaInvalid={Boolean(playScript.repeatError.value)}
                  ariaDescribedBy={playScript.repeatError.value ? 'physics-play-script-repeat-error' : undefined}
                />
                <div class="physics-paint-play-script-timing-foot">
                  {dialogSwitch({
                    id: 'physics-play-script-infinity',
                    label: 'Infinity',
                    checked: playScript.infinity.value,
                    disabled: busy,
                    onClick: () => playScript.setInfinity(!playScript.infinity.value),
                  })}
                </div>
                {playScript.repeatError.value ? <span id="physics-play-script-repeat-error" class="physics-paint-script-inline-error">{playScript.repeatError.value}</span> : null}
              </div>
            </div>
          </div>
          )}
          {playScript.dialogMode.value === 'apply' && !revealTab ? (
            <div class="physics-paint-play-script-card physics-paint-play-script-card-key-script">
              <span class="physics-paint-play-script-card-title">Key Script Editing</span>
              {dialogSwitch({
                id: 'physics-play-script-key-script-edits',
                label: 'Save script on each key',
                checked: playScript.keyScriptEdits.value,
                disabled: busy,
                onClick: () => playScript.setKeyScriptEdits(!playScript.keyScriptEdits.value),
              })}
            </div>
          ) : null}
          {playScript.dialogMode.value === 'apply' ? paintSeedVariationCard : null}
          {revealTab ? photoWiggleCard : null}
          {summaryBar}
          </div>
          {revealTab ? (
          <>
          <div class="physics-paint-play-script-side-stack">
            {motionCard}
            {colorizeCard}
          </div>
          {/* 52-05 (G-52-3, D-12): the reference guard — proactive, never a bare
              error. The action opens the Photo Reference modal so the user places
              a source, then returns to this dialog. */}
          {playScript.revealReferencePlaced.value ? null : (
            <div class="physics-paint-play-script-reveal-notice" role="note">
              <span>Reveal bakes the placed photo reference — no reference placed yet.</span>
              <button
                type="button"
                class="physics-paint-play-script-heading-link"
                disabled={busy}
                onClick={() => playScript.requestPhotoReference()}
              >
                Place a reference…
              </button>
            </div>
          )}
          </>
          ) : (
          <>
          <div class="physics-paint-play-script-side-stack">
            <div class={`physics-paint-play-script-card physics-paint-play-script-card-color${loopEdit ? ' physics-paint-play-script-locked' : ''}`}>
              <div class="physics-paint-play-script-card-heading">
                <span class="physics-paint-play-script-card-title">Color</span>
                <span class="physics-paint-play-script-color-dots" aria-hidden="true">
                  {ORIGINAL_COLOR_DOTS.map((color) => <i key={color} style={{ background: color }} />)}
                </span>
              </div>
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
              {playScript.overrideEnabled.value ? (
                <div class="physics-paint-play-script-color-pane">
                  <div class="physics-paint-play-script-color-custom-row">
                    <span class="physics-paint-play-script-override-chip" style={{ backgroundColor: brushColor }} />
                    <div class="physics-paint-play-script-color-meta">
                      <span class="physics-paint-play-script-color-hex">{brushColor}</span>
                      <span class="physics-paint-play-script-color-note">Picked from the app's brush color panel</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            {motionCard}
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
          </>)}
          </>)}
        </div>
        {playScript.error.value ? <span role="alert" class="physics-paint-script-inline-error physics-paint-play-script-dialog-error">{playScript.error.value}</span> : null}
        <div class="physics-paint-play-script-footer">
          <div class="physics-paint-play-script-progress-line">
            {playScript.progress.value ? <progress max={playScript.progress.value.total} value={playScript.progress.value.completed}>{playScript.progress.value.completed}/{playScript.progress.value.total}</progress> : null}
            <span class="physics-paint-play-script-progress-status">{playScript.progress.value ? `${playScript.progress.value.completed}/${playScript.progress.value.total}` : ''}</span>
          </div>
          <div class="physics-paint-play-script-actions">
            {regenerateImpact ? (<>
              <button
                ref={regenerateSecondaryRef}
                type="button"
                class="physics-paint-play-script-button physics-paint-play-script-button-ghost"
                disabled={busy}
                onClick={keepLocalChanges}
              >
                Keep Local Changes
              </button>
              <button
                type="button"
                class="physics-paint-play-script-button physics-paint-play-script-button-primary"
                disabled={busy || Boolean(playScript.regenerateDisabledReason.value)}
                onClick={() => { void playScript.confirm(); }}
              >
                {regenerateImpact.affectedGroups.length > 1
                  ? `Regenerate ${regenerateImpact.affectedGroups.length} Rails`
                  : 'Regenerate Rail'}
              </button>
            </>) : (<>
              <button
                type="button"
                class="physics-paint-play-script-button physics-paint-play-script-button-ghost"
                onClick={playScript.cancel}
              >
                {playScript.canCancel.value ? 'Cancel generation' : 'Cancel'}
              </button>
              {loopEdit && !playScript.canCancel.value ? (
                <button
                  ref={regenerateTriggerRef}
                  type="button"
                  class="physics-paint-play-script-button physics-paint-play-script-button-ghost"
                  onClick={() => {
                    const targetId = playScript.loopEditTargetId.value;
                    if (targetId) void playScript.openSourceEdit(targetId);
                  }}
                >
                  Regenerate Rail
                </button>
              ) : null}
              {!playScript.canCancel.value ? (
                <button
                  type="button"
                  class="physics-paint-play-script-button physics-paint-play-script-button-primary"
                  disabled={(revealTab ? Boolean(playScript.revealValidationError.value) : Boolean(playScript.validationError.value)) || Boolean(playScript.repeatError.value)}
                  onClick={() => { void playScript.confirm(); }}
                >
                  {loopEdit
                    ? playScript.mode.value === 'static' ? 'Update Static' : 'Update Motion'
                    : sourceEdit ? 'Regenerate source cycle' : 'Run Script'}
                </button>
              ) : null}
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
