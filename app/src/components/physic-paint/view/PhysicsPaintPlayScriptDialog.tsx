import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import {
  CollisionCard,
  ColorCard,
  ColorizeCard,
  KeepScriptCard,
  KeyScriptCard,
  MotionWiggleCard,
  PaintSeedCard,
  PaintTimingCard,
  PhotoWiggleCard,
  RailTypeCard,
  RevealTimingCard,
  SourceCycleCard,
  StackReadoutCard,
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

// 52-05 (G-52-3): the Create Rail dialog tabs (apply mode only).
const RAIL_TABS = [
  { value: 'paint' as const, label: 'Paint Rail' },
  { value: 'reveal' as const, label: 'Reveal Photo Rail' },
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
  const editTarget = playScript.loopEditTarget.value;
  const regenerateImpact = sourceEdit ? playScript.regenerateImpact.value : null;
  const regenerateSecondaryRef = useRef<HTMLButtonElement>(null);
  const regenerateTriggerRef = useRef<HTMLButtonElement>(null);
  const restoreRegenerateTriggerFocus = useRef(false);
  /* 261031-i54: Run Script stacking onto an existing Paint rail. The target is
     resolved by the controller; the dialog only renders its surface. A stack
     destination is not a creation surface: the Rail kind tabs are hidden and a
     stale Reveal tab can never take over the confirmation (WR-06). */
  const stacking = !loopEdit && !sourceEdit && playScript.runDestination.value.kind === 'stack';
  // 52-05 (G-52-3): the tab strip is an apply-mode creation surface — edit and
  // regenerate modes keep their existing single-surface layout.
  const tabsVisible = !loopEdit && !sourceEdit && !regenerateImpact && !stacking;
  const revealTab = playScript.railTab.value === 'reveal' && !loopEdit && !sourceEdit && !stacking;
  const stackReadout = stacking ? playScript.stackReadout.value : null;
  const stackCollision = stacking ? playScript.stackCollision.value : null;
  const collisionOffers = stacking ? playScript.collisionOffers.value : [];
  const keepScriptVisible = stacking && playScript.keepScriptVisible.value;
  const keepScriptReason = stacking ? playScript.keepScriptDisabledReason.value : null;
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
  // UAT 261031-i54: the footer reports the WHOLE operation, not only the bake's
  // frame counter — preparing, the post-bake rebuild/commit and the synchronous
  // key-script recording all keep the user informed instead of a full, silent bar.
  const progressValue = playScript.progress.value;
  const progressBusy = playScript.canCancel.value
    || playScript.phase.value === 'preparing'
    || playScript.phase.value === 'committing'
    || playScript.phase.value === 'regenerating';
  const progressLabel = playScript.status.value ?? (progressValue ? `${progressValue.completed}/${progressValue.total}` : '');
  // D-13/D-16 Row 4: the loop readout splits into Requested (left) and Effective (right)
  // inside the summary bar. Infinity reads 'Cycle {N}f × ∞' on the left (D-12).
  // 261031-i54: a stack reports its resolved span/offset/outcome — prefer it over
  // the creation readout so the bar never mixes the two laws.
  const stackSummary = stackReadout ? `${stackReadout.spanLabel} · ${stackReadout.offsetLabel} · ${stackReadout.outcomeLabel}` : null;
  const loopReadout = stackSummary ?? playScript.loopReadout.value;
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
  // 261031-i54: a stack destination reuses the rail's own cycle — linking is a
  // creation choice, so the Source cycle card never renders for a stack.
  const identicalCycle = !loopEdit && !sourceEdit && !revealTab && !stacking ? playScript.identicalSourceCycle.value : null;

  const keepLocalChanges = () => {
    const targetId = playScript.loopEditTargetId.value;
    if (!targetId) return;
    restoreRegenerateTriggerFocus.current = true;
    void playScript.openLoopEdit(targetId);
  };

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
              : <span class="physics-paint-play-script-header-range">Max {playScript.framesMax.value}{playScript.destinationRange.value ? ` · ${playScript.destinationRange.value}` : ''}</span>}
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
          <RailTypeCard
            playScript={playScript}
            revealTab={revealTab}
            busy={busy}
            locked={loopEdit}
            stacking={stacking}
          />
          {/* 52-05 (G-52-3): the Reveal tab's Timing card — the Frames field
              defaults to the script's natural duration with the "from F{n}" hint
              (the playhead snapshotted at open, D-20); Repeat + Infinity ride
              the same mutation law as the Paint Rail (D-08). No Max toggle. */}
          {/* 261030-np9 (D-08): column 1 is Timing plus, directly beneath it,
              the per-key script opt-in — it fills the empty space under Timing
              instead of opening a new grid row. Apply-mode creation only. */}
          <div class="physics-paint-play-script-key-column">
          {revealTab ? (
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
          {stacking && stackReadout ? <StackReadoutCard readout={stackReadout} /> : null}
          {keepScriptVisible ? <KeepScriptCard playScript={playScript} busy={busy} reason={keepScriptReason} /> : null}
          {playScript.dialogMode.value === 'apply' && !revealTab && !stacking ? <KeyScriptCard playScript={playScript} busy={busy} /> : null}
          {playScript.dialogMode.value === 'apply' && !stacking ? <PaintSeedCard playScript={playScript} busy={busy} /> : null}
          {revealTab ? <PhotoWiggleCard playScript={playScript} busy={busy} /> : null}
          {stacking && stackCollision !== null ? (
            <CollisionCard
              playScript={playScript}
              collision={stackCollision}
              offers={collisionOffers}
              busy={busy}
            />
          ) : null}
          {summaryBar}
          </div>
          {revealTab ? (
          <>
          <div class="physics-paint-play-script-side-stack">
            <MotionWiggleCard playScript={playScript} busy={busy} locked={loopEdit} />
            <ColorizeCard playScript={playScript} busy={busy} />
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
            <ColorCard
              playScript={playScript}
              busy={busy}
              locked={loopEdit}
              stacking={stacking}
              colorValue={colorValue}
            />
            <MotionWiggleCard playScript={playScript} busy={busy} locked={loopEdit} />
          </div>
          {identicalCycle ? (
            <SourceCycleCard playScript={playScript} identicalCycle={identicalCycle} busy={busy} />
          ) : null}
          </>)}
          </>)}
        </div>
        {playScript.error.value ? <span role="alert" class="physics-paint-script-inline-error physics-paint-play-script-dialog-error">{playScript.error.value}</span> : null}
        <div class="physics-paint-play-script-footer">
          <div class="physics-paint-play-script-progress-line">
            {progressValue ? (
              <progress max={progressValue.total} value={progressValue.completed} aria-label={progressLabel} />
            ) : progressBusy ? (
              <progress aria-label={progressLabel} />
            ) : null}
            <span class="physics-paint-play-script-progress-status">{progressLabel}</span>
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
                  disabled={(revealTab ? Boolean(playScript.revealValidationError.value) : Boolean(playScript.validationError.value)) || Boolean(playScript.repeatError.value) || (stacking && stackCollision !== null)}
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
