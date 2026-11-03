import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Image, Info, Paintbrush, Play, X } from 'lucide-preact';
import {
  isRevealRunKind,
  stackRunKindMode,
  type RotoPlayScriptController,
  type RotoPlayScriptMode,
  type RotoPlayScriptRailTab,
} from '../roto/physicsPaintRotoPlayScriptController';
import { isStandardMergedLoopClip } from '../roto/physicsPaintRotoRunScriptStacking';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import {
  CollisionCard,
  ColorCard,
  ColorizeCard,
  KeyScriptCard,
  MotionWiggleCard,
  PaintSeedCard,
  PaintTimingCard,
  PhotoWiggleCard,
  railTypeHelper,
  RailTypeCard,
  ReducedCycleCard,
  RevealTimingCard,
  SourceCycleCard,
} from './PhysicsPaintPlayScriptCards';

export interface PhysicsPaintPlayScriptDialogProps {
  playScript: RotoPlayScriptController;
  confirmationOpen: boolean;
  // D-08R/D-18: the LIVE Studio brush color (settings.color; sole writer setBrushColor). The
  // dialog is read-only toward it — the Custom pane renders it and Generate snapshots it via
  // the controller getBrushColor port; the dialog never copies it into local state.
  brushColor: string;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

// 52-05 (G-52-3): the Create Rail dialog tabs (apply mode only). 261101-cd5:
// folder tabs that own the panel, with a rail-kind icon each.
const RAIL_TABS = [
  { value: 'paint' as const, label: 'Paint', icon: Paintbrush },
  { value: 'reveal' as const, label: 'Photo', icon: Image },
];

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
  /* 58-04 (D-05/D-11): a Key Rail conversion opens this same shell reduced to
     Cycle + Infinity — no tabs, no rail type, no source controls. */
  const keyRailCreate = dialogMode === 'key-rail-create';
  const editTarget = playScript.loopEditTarget.value;
  /* 261031-vbo (Quick C1): a merged Standard Rail has no single-script
     provenance, so it has no editable Motion/Static rail type and no
     Regenerate path. The stored `mode` stays internal. */
  const standardEditTarget = loopEdit && editTarget !== null && isStandardMergedLoopClip(editTarget);
  /* 58-04 (D-07): the conversion and every later Standard edit share ONE
     reduced form. */
  const reducedForm = keyRailCreate || standardEditTarget;
  const regenerateImpact = sourceEdit ? playScript.regenerateImpact.value : null;
  const regenerateSecondaryRef = useRef<HTMLButtonElement>(null);
  const regenerateTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreRegenerateTriggerFocus = useRef(false);
  /* 261031-i54: Run Script stacking onto an existing rail. The target is
     resolved by the controller; the dialog renders ONE composition for creation
     and every stack (261101-cd5 UAT). A stack is not a creation surface, but
     its two Rail axes (Paint/Photo × Motion/Static) map 1:1 onto the four
     stack run kinds, so the same tab strip + Rail Type subheader drive both. */
  const stacking = !loopEdit && !sourceEdit && !keyRailCreate && playScript.runDestination.value.kind === 'stack';
  // 261031-qps (Quick B): a Reveal rail is a legal stack destination. Its render
  // uses the rail's own stored type, motion and color, so those controls are
  // visible but read-only. The reference guard stays a compact chip.
  const stackReveal = stacking && playScript.stackRailKind.value === 'reveal';
  // 261101-1pc (Quick C2): a Reveal RUN on a Paint / Standard destination.
  const stackRevealRun = stacking && !stackReveal && isRevealRunKind(playScript.stackRunKind.value);
  // Apply surface = creation + every stack; edit modes keep their own layout.
  const applySurface = !loopEdit && !sourceEdit && !keyRailCreate && !regenerateImpact;
  const revealTab = playScript.railTab.value === 'reveal' && !loopEdit && !sourceEdit && !keyRailCreate && !stacking;
  // The visual axis (which card set / timing / theme) for the current surface.
  const activeReveal = stacking ? (stackReveal || stackRevealRun) : revealTab;
  const activeTab: RotoPlayScriptRailTab = stacking
    ? (activeReveal ? 'reveal' : 'paint')
    : playScript.railTab.value;
  // A Photo destination owns its stored type: tabs and Rail Type stay visible
  // but read-only (the run renders through the rail's own mode).
  const tabAxisLocked = stacking && stackReveal;
  // The live Rail Type value: creation's `mode`, or the stack run kind's mode.
  const railMode = stacking ? stackRunKindMode(playScript.stackRunKind.value) : playScript.mode.value;
  const onSelectTab = (tab: RotoPlayScriptRailTab) => {
    if (!stacking) { playScript.setRailTab(tab); return; }
    if (tabAxisLocked) return;
    const mode = stackRunKindMode(playScript.stackRunKind.value);
    playScript.setStackRunKind(tab === 'reveal'
      ? (mode === 'static' ? 'reveal-static' : 'reveal-motion')
      : (mode === 'static' ? 'static' : 'motion'));
  };
  const onSelectRailType = (mode: RotoPlayScriptMode) => {
    if (!stacking) { playScript.mode.value = mode; return; }
    if (tabAxisLocked) return;
    playScript.setStackRunKind(activeReveal
      ? (mode === 'static' ? 'reveal-static' : 'reveal-motion')
      : (mode === 'static' ? 'static' : 'motion'));
  };
  const railHelper = stacking
    ? (stackReveal
      ? 'This destination is a Photo rail — it keeps its stored type.'
      : 'This run merges into the rail — the result is one Standard Rail.')
    : railTypeHelper(playScript.mode.value, revealTab);
  const referenceChip = !playScript.revealReferencePlaced.value
    ? (stacking && stackReveal)
      ? { label: 'No photo reference' }
      : ((stacking && stackRevealRun) || (!stacking && revealTab))
        ? { label: 'No photo reference', actionLabel: 'Place', onAction: () => playScript.requestPhotoReference() }
        : null
    : null;
  const keepScriptSwitch = stacking && playScript.keepScriptVisible.value
    ? {
      checked: playScript.keepScriptEffective.value,
      disabled: playScript.canCancel.value || playScript.keepScriptDisabledReason.value !== null,
      reason: playScript.keepScriptDisabledReason.value,
      onToggle: () => playScript.setKeepScript(!playScript.keepScript.value),
    }
    : null;
  const stackReadout = stacking ? playScript.stackReadout.value : null;
  const stackCollision = stacking ? playScript.stackCollision.value : null;
  const collisionOffers = stacking ? playScript.collisionOffers.value : [];
  // 261101-cd5 UAT: the fixed 660 shell now carries every stack too. Only edit
  // modes and an open collision prompt (a one-shot user-triggered state, never
  // a toggle) need the content-height surface.
  // 58-04 (D-05): the reduced Standard form is compact — it never grows, even
  // though its later-Standard entry point arrives through loop-edit.
  const surfaceTall = reducedForm ? false : (loopEdit || sourceEdit || stackCollision !== null);
  // UAT 261031-i54: a stack starts from the rail's stored color; null falls back
  // to the live brush color (the creation behavior), so "Custom color" on a
  // rail that had none picks up the app's current brush color.
  const colorValue = stacking
    ? (playScript.stackOverrideColor.value ?? brushColor)
    : brushColor;

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
      } else if (dialogMode === 'key-rail-create') repeatInputRef.current?.focus();
      else if (playScript.railTab.value === 'reveal') revealInputRef.current?.focus();
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
  // UAT 261031-i54: the footer reports the WHOLE operation, not only the bake's
  // frame counter — preparing, the post-bake rebuild/commit and the synchronous
  // key-script recording all keep the user informed instead of a full, silent bar.
  const progressValue = playScript.progress.value;
  const progressBusy = playScript.canCancel.value
    || playScript.phase.value === 'preparing'
    || playScript.phase.value === 'committing'
    || playScript.phase.value === 'regenerating';
  const progressLabel = playScript.status.value ?? (progressValue ? `${progressValue.completed}/${progressValue.total}` : '');
  // D-13/D-16 Row 4: the loop readout splits into Requested and Effective rows.
  // Infinity reads 'Cycle {N}f × ∞' on the left (D-12).
  // 261031-i54: a stack reports its resolved span/offset/outcome — prefer it over
  // the creation readout so the tooltip never mixes the two laws.
  // 261101-cd5: the readout is a footer tooltip opened on hover / keyboard focus;
  // the row values drop the display prefixes because the row keys carry them.
  const stackSummary = stackReadout ? `${stackReadout.spanLabel} · ${stackReadout.offsetLabel} · ${stackReadout.outcomeLabel}` : null;
  const loopReadout = stackSummary ?? playScript.loopReadout.value;
  const EFFECTIVE_SEPARATOR = ' · Effective: ';
  const REQUESTED_PREFIX = 'Requested: ';
  const effectiveSplitAt = loopReadout ? loopReadout.indexOf(EFFECTIVE_SEPARATOR) : -1;
  const requestedReadout = loopReadout ? (effectiveSplitAt >= 0 ? loopReadout.slice(0, effectiveSplitAt) : loopReadout) : null;
  const readoutRequested = requestedReadout?.startsWith(REQUESTED_PREFIX)
    ? requestedReadout.slice(REQUESTED_PREFIX.length)
    : requestedReadout;
  const readoutEffective = loopReadout && effectiveSplitAt >= 0
    ? loopReadout.slice(effectiveSplitAt + EFFECTIVE_SEPARATOR.length)
    : null;

  // 43-06 S4 (D-05): the apply-time Link/Create choice renders only when the
  // controller reports an identical source cycle — a Paint Rail concept only
  // (the Reveal tab always bakes a fresh cycle through the reveal mutation).
  // 261030-ig0: linking is a creation choice — a key edit never rewrites
  // sourceKeyIds, so no Source cycle card renders in source-edit.
  // 261031-i54: a stack destination reuses the rail's own cycle — linking is a
  // creation choice, so the Source cycle card never renders for a stack.
  const identicalCycle = !loopEdit && !sourceEdit && !keyRailCreate && !revealTab && !stacking ? playScript.identicalSourceCycle.value : null;

  const keepLocalChanges = () => {
    const targetId = playScript.loopEditTargetId.value;
    if (!targetId) return;
    restoreRegenerateTriggerFocus.current = true;
    void playScript.openLoopEdit(targetId);
  };

  return (
    <div
      class={`physics-paint-play-script-dialog${activeReveal ? ' physics-paint-play-script-reveal' : ''}${dragging ? ' physics-paint-play-script-dragging' : ''}`}
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
          // 261031-i54: an open collision owns Enter — Truncate is its default.
          if (stackCollision !== null) {
            if (!collisionOffers.includes('truncate')) return;
            event.preventDefault();
            void playScript.confirmStackCollision('truncate');
            return;
          }
          const tabValidationError = revealTab ? playScript.revealValidationError.value : playScript.validationError.value;
          if (tabValidationError || playScript.repeatError.value) return;
          event.preventDefault();
          void playScript.confirm();
        }
      }}
    >
      <div
        ref={surfaceRef}
        class={`physics-paint-play-script-surface${surfaceTall ? ' physics-paint-play-script-surface-tall' : ''}`}
        style={dragOffset.x !== 0 || dragOffset.y !== 0 ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
      >
        <div
          class="physics-paint-play-script-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endHeaderDrag}
          onPointerCancel={endHeaderDrag}
        >
          <div class="physics-paint-play-script-header-main">
            <span class="physics-paint-play-script-header-badge" aria-hidden="true">
              <Play size={12} aria-hidden="true" />
            </span>
            <strong id="physics-play-script-title">{regenerateImpact
              ? `Regenerate “${regenerateImpact.groupName}”?`
              : loopEdit || keyRailCreate
                ? 'Edit Rail'
                : sourceEdit
                  ? 'Edit Source Cycle'
                  : 'Run Script'}</strong>
          </div>
          <div class="physics-paint-play-script-header-meta">
            {regenerateImpact
              ? <span class="physics-paint-play-script-header-range">{regenerateImpact.restoredRange}</span>
              : keyRailCreate
                ? null
                : loopEdit && editTarget
                  ? <span class="physics-paint-play-script-header-range">{`F${editTarget.placementStart} · Cycle ${editTarget.sourceKeyIds.length}f`}</span>
                  : <span class="physics-paint-play-script-header-range">Max {playScript.framesMax.value}{playScript.destinationRange.value ? ` · ${playScript.destinationRange.value}` : ''}</span>}
            {/* T-261101-CD5-01: Close stops pointer-down so it never starts the
                header drag, and routes only through the existing cancel path. */}
            <button
              type="button"
              class="physics-paint-play-script-close"
              aria-label="Close"
              onPointerDown={(event) => { event.stopPropagation(); }}
              onClick={() => playScript.cancel()}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div class="physics-paint-play-script-workspace">
          {applySurface ? (
            <div class="physics-paint-play-script-tabs" role="tablist" aria-label="Rail kind">
              {RAIL_TABS.map((tab) => {
                const selected = activeTab === tab.value;
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={selected ? 'true' : 'false'}
                    class={`physics-paint-play-script-tab${selected ? ' active' : ''}`}
                    disabled={busy || tabAxisLocked}
                    onClick={() => onSelectTab(tab.value)}
                  >
                    <TabIcon size={14} aria-hidden="true" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div class="physics-paint-play-script-content">
          {reducedForm ? (
            /* 58-04 (D-05/D-10): the whole Standard surface — Cycle + Infinity
               only; every creation, stack, reveal and edit card is skipped. */
            <ReducedCycleCard playScript={playScript} busy={busy} repeatInputRef={repeatInputRef} />
          ) : regenerateImpact ? (
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
          {sourceEdit ? (
            <p class="physics-paint-play-script-notice">
              Confirming regenerates the source cycle and updates every linked Rail referencing it.
              {playScript.sourceEditSharedLoopCount.value > 1 ? ` This source cycle is shared by ${playScript.sourceEditSharedLoopCount.value} Rails.` : ''}
            </p>
          ) : null}
          {/* 261101-cd5: Rail Type is the panel's first row for creation AND
              every stack (a subheader, not a bordered card). The Reveal
              reference guard rides it as a compact chip; a stack adds its
              Keep script toggle in the same row. */}
          <RailTypeCard
            modeValue={railMode}
            getMode={() => (stacking ? stackRunKindMode(playScript.stackRunKind.value) : playScript.mode.value)}
            onSelectMode={onSelectRailType}
            busy={busy}
            locked={loopEdit}
            disabled={tabAxisLocked}
            helper={railHelper}
            referenceChip={referenceChip}
            keepScript={keepScriptSwitch}
          />
          {/* 52-05 (G-52-3): the Reveal tab's Timing card — the Frames field
              defaults to the script's natural duration with the "from F{n}" hint
              (the playhead snapshotted at open, D-20); Repeat + Infinity ride
              the same mutation law as the Paint Rail (D-08). No Max toggle. */}
          {!stacking && revealTab ? (
            <RevealTimingCard playScript={playScript} busy={busy} inputRef={revealInputRef} />
          ) : (
            <PaintTimingCard
              playScript={playScript}
              busy={busy}
              locked={loopEdit}
              stacking={stacking}
              inputRef={inputRef}
              repeatInputRef={repeatInputRef}
            />
          )}
          {/* 261101-cd5 UAT: Motion wiggle is part of the one composition. A
              Photo destination owns its stored motion, so the section is
              visible but read-only there. */}
          <MotionWiggleCard playScript={playScript} busy={busy} locked={loopEdit || stackReveal} />
          {/* 261101-cd5 UAT: ONE global row for creation and every stack.
              Paint: Key Script / Paint Seed / Color (+ Source cycle on
              creation); Photo: Paint Seed / Photo Wiggle / Colorize. A stack's
              Key Script is inert (Keep script owns per-key scripts). Edit modes
              keep their Color-only row. */}
          <span class="physics-paint-play-script-global-label">GLOBAL OPTIONS</span>
          <div class="physics-paint-play-script-global-row">
            {applySurface && !activeReveal ? (
              <KeyScriptCard
                playScript={playScript}
                busy={busy}
                disabled={stacking}
                disabledReason="Stacked runs record per-key scripts through Keep script."
              />
            ) : null}
            {applySurface ? <PaintSeedCard playScript={playScript} busy={busy} /> : null}
            {applySurface && activeReveal ? <PhotoWiggleCard playScript={playScript} busy={busy} /> : null}
            {!applySurface || !activeReveal ? (
              <ColorCard
                playScript={playScript}
                busy={busy}
                locked={loopEdit}
                stacking={stacking}
                colorValue={colorValue}
              />
            ) : null}
            {applySurface && activeReveal ? <ColorizeCard playScript={playScript} busy={busy} /> : null}
            {identicalCycle ? <SourceCycleCard playScript={playScript} identicalCycle={identicalCycle} busy={busy} /> : null}
          </div>
          {stacking && stackCollision !== null ? (
            <CollisionCard
              playScript={playScript}
              collision={stackCollision}
              offers={collisionOffers}
              busy={busy}
            />
          ) : null}
          </>)}
          </div>
        </div>
        <div class="physics-paint-play-script-footer">
          <div class="physics-paint-play-script-progress-line">
            {/* 261101-cd5: the 160 × 4 track is persistent; the real <progress>
                exists only while generating. */}
            <span class="physics-paint-play-script-progress-track">
              {progressValue ? (
                <progress max={progressValue.total} value={progressValue.completed} aria-label={progressLabel} />
              ) : progressBusy ? (
                <progress aria-label={progressLabel} />
              ) : null}
            </span>
            {readoutRequested ? (
              /* Borderless tooltip on hover AND keyboard focus — CSS only, no
                 state, no width work. Out of flow so the 56px footer never moves. */
              <span class="physics-paint-play-script-readout">
                <button
                  type="button"
                  class="physics-paint-play-script-readout-info"
                  aria-label="Run details"
                  aria-describedby="physics-play-script-readout-tooltip"
                >
                  <Info size={13} aria-hidden="true" />
                </button>
                <span id="physics-play-script-readout-tooltip" class="physics-paint-play-script-readout-tooltip" role="tooltip">
                  <span class="physics-paint-play-script-readout-row">
                    <span class="physics-paint-play-script-readout-key">Requested</span>
                    <span class="physics-paint-play-script-readout-value">{readoutRequested}</span>
                  </span>
                  {readoutEffective ? (
                    <span class="physics-paint-play-script-readout-row">
                      <span class="physics-paint-play-script-readout-key">Effective</span>
                      <span class="physics-paint-play-script-readout-value">{readoutEffective}</span>
                    </span>
                  ) : null}
                </span>
              </span>
            ) : null}
            {/* The generation failure replaces the status text in this same slot;
                it is never a direct child of the surface. */}
            {playScript.error.value ? (
              <span role="alert" title={playScript.error.value} class="physics-paint-script-inline-error physics-paint-play-script-dialog-error">{playScript.error.value}</span>
            ) : (
              <span class="physics-paint-play-script-progress-status">{progressLabel || 'Ready'}</span>
            )}
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
              {loopEdit && !reducedForm && !playScript.canCancel.value ? (
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
                  disabled={reducedForm
                    ? Boolean(playScript.repeatError.value)
                    : ((revealTab ? Boolean(playScript.revealValidationError.value) : Boolean(playScript.validationError.value)) || Boolean(playScript.repeatError.value) || (stacking && stackCollision !== null))}
                  onClick={() => { void playScript.confirm(); }}
                >
                  {keyRailCreate
                    ? 'Create Cycle'
                    : loopEdit
                      ? standardEditTarget
                        ? 'Update Rail'
                        : playScript.mode.value === 'static' ? 'Update Static' : 'Update Motion'
                      : sourceEdit
                        ? 'Regenerate source cycle'
                        : (<><Play size={11} aria-hidden="true" />Run Script</>)}
                </button>
              ) : null}
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
