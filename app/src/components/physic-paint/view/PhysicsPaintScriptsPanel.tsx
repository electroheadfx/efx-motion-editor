import { ChevronLeft, ChevronRight, Paintbrush, Pencil, Play, RefreshCw, Save, Trash2, X } from 'lucide-preact';
import type { ComponentChildren, Ref, RefObject } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';
import { buildScriptScopeEntries, filterScriptRows, resolveScriptProvenance, resolveScriptScopeValue, ROTO_SCRIPT_SCOPE_ALL } from '../roto/physicsPaintRotoScriptScope';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import type { PhysicsPaintLoopClipPresentation } from './physicsPaintLoopClipPresentation';
import type { RailMotionInspectorPresentation, SelectedKeyRailInspectorPresentation } from './physicsPaintKeyRailPresentation';
import type { PhysicPaintRotoRailMotionChannelId } from '../roto/railMotionModel';
import { NumericStepper } from '../../shared/NumericStepper';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';

export interface PhysicsPaintScriptsPanelProps {
  library: RotoScriptLibraryController;
  playScript: RotoPlayScriptController;
  rotoScript: RotoScriptClipboardController;
  playButtonRef: RefObject<HTMLButtonElement | null>;
  selectedLoopClip?: PhysicsPaintLoopClipPresentation | null;
  selectedKeyRail?: SelectedKeyRailInspectorPresentation | null;
  /**
   * 59-16 (D-06/D-09): the numeric Motion value inspector projection. Null
   * when no Motion key is selected — the panel then renders no motion fields
   * at all. Every displayed value comes from this prop; the panel reads no
   * store.
   */
  selectedRailMotion?: RailMotionInspectorPresentation | null;
  /**
   * 59-16: the ONE write path out of a motion field. Receives the display-unit
   * value and returns the visible rejection reason, or null on success.
   */
  onCommitRailMotionValue?: (channelId: PhysicPaintRotoRailMotionChannelId, uiValue: number) => string | null;
  linkedGroupNavigation?: {
    currentIndex: number;
    total: number;
    onPrevious: () => void;
    onNext: () => void;
    onGoToGroup: () => void;
  } | null;
  onOpenLoopEdit: (loopId: string) => Promise<unknown>;
  onOpenKeyRailEdit?: (firstKeyId: string) => Promise<unknown> | void;
  onCloseLoopClip: () => void;
  onCloseKeyRail?: () => void;
  onSave: () => void;
  onActivateRow: (id: string) => void;
  onLoadAndApply: () => void;
  onRefresh: () => void;
}

export function PhysicsPaintScriptsPanel({
  library,
  playScript,
  rotoScript,
  playButtonRef,
  selectedLoopClip = null,
  selectedKeyRail = null,
  selectedRailMotion = null,
  onCommitRailMotionValue,
  linkedGroupNavigation = null,
  onOpenLoopEdit,
  onOpenKeyRailEdit,
  onCloseLoopClip,
  onCloseKeyRail,
  onSave,
  onActivateRow,
  onLoadAndApply,
  onRefresh,
}: PhysicsPaintScriptsPanelProps) {
  const rows = library.rows.value;
  // quick-260922-al1: the scope narrows ONLY what is rendered. `rows` stays the
  // unfiltered source for selection, rename, delete and the row lookup, so a
  // hidden Action keeps every contract it had before the filter existed.
  const scriptScope = library.scriptScope.value;
  const scriptLayers = library.scriptLayers.value;
  const scopeEntries = buildScriptScopeEntries(rows, scriptLayers);
  // code review WR-02: a scope the selector cannot render (its layer's last
  // Action was just deleted, or the id is stale) resolves to All, so the
  // control and the list always agree.
  const scopeValue = resolveScriptScopeValue(scopeEntries, scriptScope);
  const visibleRows = filterScriptRows(rows, scopeValue);
  const selectedActionId = library.selectedId.value;
  const availability = library.availability.value;
  const actionMutationDisabledReason = library.actionMutationDisabledReason.value;
  const confirmationBusy = actionMutationDisabledReason !== null;
  const loadAndApplyDisabledReason = actionMutationDisabledReason
    ?? (!library.selected.value
      ? 'Select a project Script first.'
      : rotoScript.availability.value.replacementApplyDisabledReason);
  const saveDisabledReason = actionMutationDisabledReason ?? availability.saveDisabledReason;
  const playScriptDisabledReason = actionMutationDisabledReason ?? playScript.disabledReason.value;
  const rename = library.rename.value;
  const confirmation = library.deleteConfirmation.value;
  const deleteError = library.deleteError.value;
  const referenceImpact = confirmation?.referenceImpact ?? null;
  const toolbarRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  // 261022-o2a: the row trash that opened the confirmation. The delete button
  // lives inside the row, so the cancel/confirm round-trip restores focus to
  // THAT trash (not a toolbar button) while the row still exists.
  const deleteTriggerId = useRef<string | null>(null);
  const previousConfirmation = useRef<typeof confirmation>(null);
  const saveReasonId = useId();
  const loadAndApplyReasonId = useId();
  const playReasonId = useId();
  const previousRailReasonId = useId();
  const nextRailReasonId = useId();
  const refreshReasonId = useId();
  const scopeSelectId = useId();
  const keyRailEditReasonId = useId();
  // 59-16: the ONLY transient state the Motion inspector owns. The numeric
  // draft itself lives inside the shared NumericStepper (EU-comma free entry,
  // commit on blur/Enter); this signal carries the reason a write was refused
  // and a rejection sequence that remounts the field so its optimistic text is
  // reverted to the projected value even when the same sentence repeats. A
  // signal per the project rule; held in a ref because useSignal is
  // unavailable to this component harness.
  const motionCommitState = useRef(
    signal<{ readonly reason: string | null; readonly rejectionSeq: number }>({ reason: null, rejectionSeq: 0 }),
  );
  const motionCommit = motionCommitState.current.value;
  // A new projection (selection or document change) retires the stale reason.
  useEffect(() => {
    const current = motionCommitState.current.value;
    if (current.reason !== null) {
      motionCommitState.current.value = { reason: null, rejectionSeq: current.rejectionSeq };
    }
  }, [selectedRailMotion]);
  useEffect(() => {
    const previous = previousConfirmation.current;
    previousConfirmation.current = confirmation;
    let focusFrame: number | null = null;
    if (confirmation && !previous) {
      focusFrame = requestAnimationFrame(() => cancelDeleteRef.current?.focus());
    } else if (!confirmation && previous) {
      focusFrame = requestAnimationFrame(() => {
        const triggerId = deleteTriggerId.current;
        deleteTriggerId.current = null;
        if (triggerId !== null && rows.some((row) => row.id === triggerId)) {
          const trigger = listRef.current?.querySelector<HTMLElement>(
            `[data-action-id="${CSS.escape(triggerId)}"] [data-script-delete]`,
          );
          if (trigger) {
            trigger.focus();
            return;
          }
        }
        // The triggering row is gone: fall back to the nearest surviving row,
        // then to the first enabled toolbar control.
        const selectedRow = selectedActionId
          ? listRef.current?.querySelector<HTMLElement>(`[data-action-id="${CSS.escape(selectedActionId)}"]`)
          : null;
        const nearestRow = selectedRow ?? listRef.current?.querySelector<HTMLElement>('[data-action-id]');
        const toolbarControl = toolbarRef.current?.querySelector<HTMLElement>('button:not(:disabled), [tabindex="0"]');
        (nearestRow ?? toolbarControl)?.focus();
      });
    }
    return () => {
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
    };
  }, [confirmation, rows, selectedActionId]);
  const requestRowDelete = (id: string) => {
    if (confirmationBusy) return;
    deleteTriggerId.current = id;
    library.select(id);
    library.requestDelete();
  };
  const stopRowPointerActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const stopRowKeyboardActivation = (event: { key: string; stopPropagation: () => void }) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
  };

  // 59-16 (D-06/D-09): the numeric Motion value inspector. Props-driven end to
  // end — every displayed value arrives through `selectedRailMotion` (the
  // 59-16 projection) and every write leaves through `onCommitRailMotionValue`;
  // the panel imports no store and mutates no record. A Motion key can only be
  // selected while its rail owns the pane, so the section rides whichever
  // surface is mounted (normal Scripts, Key Rail or Loop Clip inspector).
  // The fields render in the projection's fixed D-13 order. Grouped Position is
  // a display grouping over two independent model channels: each field emits
  // only its OWN channel, so no coupling control links the two axes.
  const commitMotionValue = (channelId: PhysicPaintRotoRailMotionChannelId, value: number): void => {
    const reason = onCommitRailMotionValue?.(channelId, value) ?? null;
    const current = motionCommitState.current.value;
    if (reason === null) {
      if (current.reason !== null) {
        motionCommitState.current.value = { reason: null, rejectionSeq: current.rejectionSeq };
      }
      return;
    }
    // Never a silent clamp: surface the sentence and bump the sequence so the
    // rejected field remounts at the projected value.
    motionCommitState.current.value = { reason, rejectionSeq: current.rejectionSeq + 1 };
  };
  const motionValuesSection = selectedRailMotion === null
    ? null
    : (
      <section class="physics-paint-motion-inspector" role="group" aria-label="Motion values">
        {selectedRailMotion.fields.map((field) => (
          <div key={field.channelId} class="physics-paint-motion-field">
            <span class="physics-paint-motion-field-label">{field.label} ({field.unit})</span>
            <NumericStepper
              key={`${field.channelId}:${motionCommit.rejectionSeq}`}
              ariaLabel={field.label}
              value={field.value}
              // Free entry, no grid snap: an out-of-domain number must reach
              // the command layer and be refused with a reason, never silently
              // clamped or rounded here (the 260924-d6l convention).
              freeEntry
              step={1}
              precision={3}
              onChange={(value) => { commitMotionValue(field.channelId, value); }}
            />
          </div>
        ))}
        {motionCommit.reason !== null ? (
          <p class="physics-paint-motion-rejection" role="alert">{motionCommit.reason}</p>
        ) : null}
      </section>
    );

  // 58-03 RAIL-01 (D-01): selecting a Key Rail takes over the Scripts pane with
  // exactly three facts (D-04) and one conversion entry. The branch returns
  // before the loop-clip inspector so a plain rail selection can never be
  // shadowed by a stale loop target, and it intentionally omits the loop-only
  // panel modifier (its declaration is a no-op CSS default) so the existing
  // loop-inspector source anchors keep pointing at their own branch.
  if (selectedKeyRail) {
    const railLabel = selectedKeyRail.framesLabel;
    const editDisabledReason = selectedKeyRail.editDisabledReason;
    return (
      <div class="physics-paint-scripts-panel" role="tabpanel" aria-label={`Selected Key Rail — ${railLabel}`}>
        <div class="physics-paint-loop-clip-inspector-top-actions">
          <IconButton buttonRef={playButtonRef} label={`Edit Rail — ${railLabel}`} title={`Edit Rail — ${railLabel}`} disabled={editDisabledReason !== null} disabledReason={editDisabledReason ?? undefined} descriptionId={keyRailEditReasonId} onClick={() => { void onOpenKeyRailEdit?.(selectedKeyRail.firstKeyId); }} className="physics-paint-loop-clip-nav-compact-button primary labeled" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><Pencil size={16} aria-hidden="true" /><span class="physics-paint-roto-key-icon-label">Edit Rail</span></IconButton>
          <IconButton label={`Close Rail inspector — ${railLabel}`} title={`Close Rail inspector — ${railLabel}`} onClick={() => { onCloseKeyRail?.(); }} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><X size={16} aria-hidden="true" /></IconButton>
        </div>
        <SidebarScrollArea class="physics-paint-scripts-list-scroll-area" interactive>
          {motionValuesSection}
          <dl class="physics-paint-loop-clip-inspector">
            <div><dt>Frames</dt><dd>{selectedKeyRail.framesLabel}</dd></div>
            <div><dt>Keys</dt><dd>{selectedKeyRail.keysLabel}</dd></div>
            <div><dt>Type</dt><dd>{selectedKeyRail.typeLabel}</dd></div>
          </dl>
        </SidebarScrollArea>
      </div>
    );
  }

  if (selectedLoopClip) {
    return (
      <div class="physics-paint-scripts-panel physics-paint-loop-clip-panel" role="tabpanel" aria-label={`Selected Rail — ${selectedLoopClip.displayName}`}>
        <div class="physics-paint-loop-clip-inspector-top-actions">
          <IconButton buttonRef={playButtonRef} label={`Edit Rail — ${selectedLoopClip.displayName}`} title={`Edit Rail — ${selectedLoopClip.displayName}`} onClick={() => { void onOpenLoopEdit(selectedLoopClip.loopId); }} className="physics-paint-loop-clip-nav-compact-button primary labeled" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><Pencil size={16} aria-hidden="true" /><span class="physics-paint-roto-key-icon-label">Edit Rail</span></IconButton>
          {linkedGroupNavigation && linkedGroupNavigation.total > 1 ? (
            <>
              <IconButton label="Previous Rail" title="Previous Rail" disabled={linkedGroupNavigation.currentIndex === 0} disabledReason={linkedGroupNavigation.currentIndex === 0 ? 'Already on the first linked Rail' : undefined} descriptionId={previousRailReasonId} onClick={linkedGroupNavigation.onPrevious} className="physics-paint-loop-clip-nav-compact-button labeled" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><ChevronLeft size={16} aria-hidden="true" /><span class="physics-paint-roto-key-icon-label">Previous Rail</span></IconButton>
              <IconButton label="Next Rail" title="Next Rail" disabled={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1} disabledReason={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1 ? 'Already on the last linked Rail' : undefined} descriptionId={nextRailReasonId} onClick={linkedGroupNavigation.onNext} className="physics-paint-loop-clip-nav-compact-button labeled" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><ChevronRight size={16} aria-hidden="true" /><span class="physics-paint-roto-key-icon-label">Next Rail</span></IconButton>
            </>
          ) : null}
          <IconButton label={`Close Rail inspector — ${selectedLoopClip.displayName}`} title={`Close Rail inspector — ${selectedLoopClip.displayName}`} onClick={onCloseLoopClip} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><X size={16} aria-hidden="true" /></IconButton>
        </div>
        <SidebarScrollArea class="physics-paint-scripts-list-scroll-area" interactive>
        {motionValuesSection}
        <dl class="physics-paint-loop-clip-inspector">
          <div><dt>Name</dt><dd title={selectedLoopClip.displayName}>{selectedLoopClip.displayName}</dd></div>
          <div><dt>Source Script</dt><dd title={selectedLoopClip.sourceLabel}>{selectedLoopClip.sourceLabel}</dd></div>
          <div><dt>Placement</dt><dd>{selectedLoopClip.placementLabel}</dd></div>
          <div><dt>Cycle</dt><dd>{selectedLoopClip.cycleLabel}</dd></div>
          <div><dt>Effective</dt><dd>{selectedLoopClip.effectiveLabel}</dd></div>
          <div><dt>Rail Type</dt><dd>{selectedLoopClip.modeLabel}</dd></div>
          <div><dt>Status</dt><dd>{selectedLoopClip.statusLabel}</dd></div>
        </dl>
        {linkedGroupNavigation ? (
          <section class="physics-paint-loop-clip-linked-navigation" aria-label="Linked Rail navigation">
            <strong>Linked Rails — {linkedGroupNavigation.currentIndex + 1} of {linkedGroupNavigation.total}</strong>
            {linkedGroupNavigation.total === 1 ? (
              <button
                type="button"
                class="physics-paint-loop-clip-inspector-action"
                onClick={linkedGroupNavigation.onGoToGroup}
              >
                Go to Rail
              </button>
            ) : null}
          </section>
        ) : null}
        </SidebarScrollArea>
      </div>
    );
  }

  return (
    <div class="physics-paint-scripts-panel" role="tabpanel" aria-label="Project Scripts">
      <div ref={toolbarRef} class="physics-paint-scripts-toolbar" role="toolbar" aria-label="Scripts">
        <IconButton label="Save Script" title={`Save Script — ${saveDisabledReason ?? 'Save the active real Roto frame'}`} disabled={saveDisabledReason !== null || !availability.canSave} disabledReason={saveDisabledReason ?? undefined} descriptionId={saveReasonId} onClick={onSave}><Save size={16} /></IconButton>
        <IconButton label="Load + Apply to Frame" title={`Load + Apply to Frame — ${loadAndApplyDisabledReason ?? 'Reload the selected preset and apply it to this Roto frame'}`} disabled={loadAndApplyDisabledReason !== null} disabledReason={loadAndApplyDisabledReason ?? undefined} descriptionId={loadAndApplyReasonId} onClick={onLoadAndApply}><Paintbrush size={16} /><span class="physics-paint-roto-key-icon-label">Apply</span></IconButton>
        <IconButton buttonRef={playButtonRef} label="Run Script…" title={`Run Script… — ${actionMutationDisabledReason ?? (playScript.disabledReason.value ?? 'Run the selected Script to create or update a Motion or Static Rail')}`} disabled={playScriptDisabledReason !== null} disabledReason={playScriptDisabledReason ?? undefined} descriptionId={playReasonId} onClick={() => { void playScript.openConfirmation(); }}><Play size={16} /><span class="physics-paint-roto-key-icon-label">Run Script</span></IconButton>
        <IconButton label="Refresh Scripts" title={`Refresh Scripts — ${actionMutationDisabledReason ?? 'Scan the project Scripts folder'}`} disabled={actionMutationDisabledReason !== null} disabledReason={actionMutationDisabledReason ?? undefined} descriptionId={refreshReasonId} onClick={onRefresh}><RefreshCw size={16} /></IconButton>
      </div>
      {motionValuesSection}
      {scopeEntries.length > 1 || linkedGroupNavigation ? (
        // quick-260922-jss amendment: ONE meta row carries both the scope
        // filter and the linked-Rail pager. They are independent — either can
        // be absent — so the row renders when EITHER exists and each half
        // keeps its own gate; the pager can never be hidden by the select's
        // absence (a project whose Actions come from a single layer has no
        // select but still navigates its Rails).
        <div class="physics-paint-scripts-meta-row">
          {scopeEntries.length > 1 ? (
            // quick-260922-al1: the select is a native control so it is
            // keyboard reachable and announced without inventing a widget. It
            // renders only when at least one layer actually owns an Action: a
            // single-option select would be dead UI. Its width is capped so it
            // cannot starve the pager beside it.
            <div class="physics-paint-scripts-scope">
              <label class="physics-paint-scripts-scope-label" htmlFor={scopeSelectId}>Scope</label>
              <select
                id={scopeSelectId}
                class="physics-paint-scripts-scope-select"
                value={scopeValue}
                onChange={(event) => { library.setScriptScope(event.currentTarget.value); }}
              >
                {scopeEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
              </select>
            </div>
          ) : null}
          {linkedGroupNavigation ? (
            // The pager replaces both the old count line and the old
            // total === 1 / total > 1 markup split: one shape serves every
            // total, the arrows simply disabling at the ends, so the row never
            // changes shape as the count moves.
            <div class="physics-paint-scripts-pager" role="group" aria-label="Linked Rail navigation">
              <IconButton label="Previous Rail" title="Previous Rail" disabled={linkedGroupNavigation.currentIndex === 0} disabledReason={linkedGroupNavigation.currentIndex === 0 ? 'Already on the first linked Rail' : undefined} descriptionId={previousRailReasonId} onClick={linkedGroupNavigation.onPrevious} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><ChevronLeft size={16} aria-hidden="true" /></IconButton>
              <span class="physics-paint-scripts-pager-count" aria-hidden="true">{linkedGroupNavigation.currentIndex + 1}/{linkedGroupNavigation.total}</span>
              <IconButton label="Next Rail" title="Next Rail" disabled={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1} disabledReason={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1 ? 'Already on the last linked Rail' : undefined} descriptionId={nextRailReasonId} onClick={linkedGroupNavigation.onNext} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><ChevronRight size={16} aria-hidden="true" /></IconButton>
              <button type="button" class="physics-paint-scripts-pager-go" title="Go to the linked Rail and jump to its placement start" aria-label="Go to the linked Rail" onClick={linkedGroupNavigation.onGoToGroup}>Go</button>
            </div>
          ) : null}
        </div>
      ) : null}
      <SidebarScrollArea class="physics-paint-scripts-list-scroll-area" interactive>
      <div ref={listRef} class="physics-paint-scripts-list" role="listbox" aria-label="Saved Roto Scripts">
        {visibleRows.map((row) => {
          const provenance = resolveScriptProvenance(row, scriptLayers);
          return (
          <div
            key={row.id}
            data-action-id={row.id}
            role="option"
            tabIndex={0}
            aria-selected={library.selectedId.value === row.id}
            aria-label={`Load ${row.name}`}
            aria-disabled={confirmationBusy ? 'true' : undefined}
            class={`physics-paint-script-row${selectedActionId === row.id ? ' selected' : ''}`}
            onClick={() => {
              if (confirmationBusy) return;
              onActivateRow(row.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              if (confirmationBusy) return;
              onActivateRow(row.id);
            }}
          >
            <img class="physics-paint-script-thumbnail" src={row.thumbnail.dataUrl} width={row.thumbnail.width} height={row.thumbnail.height} alt="" />
            <span class="physics-paint-script-row-copy">
              {rename?.id === row.id ? (
                <span class="physics-paint-script-rename-wrap" onClick={stopRowPointerActivation} onKeyDown={stopRowKeyboardActivation}>
                  <input
                    autoFocus
                    value={rename.draft}
                    aria-label={`Rename ${row.name}`}
                    onClick={stopRowPointerActivation}
                    onInput={(event) => library.updateRenameDraft((event.currentTarget as HTMLInputElement).value)}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === 'Enter') { event.preventDefault(); void library.commitRename(); }
                      else if (event.key === 'Escape') { event.preventDefault(); library.cancelRename(); }
                    }}
                  />
                  {rename.error ? <span class="physics-paint-script-inline-error">{rename.error}</span> : null}
                </span>
              ) : (
                <button
                  type="button"
                  class="physics-paint-script-name"
                  aria-label={`Rename ${row.name}`}
                  disabled={actionMutationDisabledReason !== null || !availability.canRename}
                  onClick={(event) => {
                    event.stopPropagation();
                    library.select(row.id);
                    library.beginRename();
                  }}
                >
                  {row.name}
                </button>
              )}
              {/* quick-260922-al1: the layer name is resolved LIVE (a renamed
                  layer is reflected at once); an orphan — a row whose origin
                  layer no longer exists — keeps its snapshotted name and says
                  so, rather than silently claiming a layer that is gone. */}
              <span class="physics-paint-script-provenance">
                {row.source.projectName} · {provenance.layerName} · F{row.source.displayFrame}
                {provenance.unavailable ? <span class="physics-paint-script-provenance-unavailable"> · unavailable</span> : null}
              </span>
              <span class="physics-paint-script-count">{row.brushCount} {row.brushCount === 1 ? 'brush' : 'brushes'}</span>
            </span>
            {/* 261022-o2a: per-row trash. Gated ONLY by the library mutation
                lock — `availability.canDelete` requires an EXISTING selection
                and would disable every unselected row. The trash never commits
                a delete: it selects the row and opens the shared confirmation,
                which stays the only commit surface. */}
            <button
              type="button"
              class="physics-paint-script-row-delete"
              data-script-delete
              aria-label={`Delete ${row.name}`}
              disabled={actionMutationDisabledReason !== null}
              title={actionMutationDisabledReason ?? `Delete ${row.name}`}
              onClick={(event) => {
                event.stopPropagation();
                requestRowDelete(row.id);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                // The row's own keydown would activate the row first; the
                // trash owns this press (default is suppressed so the native
                // click does not double-fire the request).
                event.stopPropagation();
                event.preventDefault();
                requestRowDelete(row.id);
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
          );
        })}
        {!rows.length ? (
          <div class="physics-paint-scripts-empty">
            <p>No project Scripts yet.</p>
            <p>Save the current real Roto frame as a Script to create a Rail.</p>
          </div>
        ) : !visibleRows.length ? (
          // Defensive: `filterScriptRows` fails OPEN, so a scope that matches
          // nothing renders every row rather than an empty list — this branch
          // only exists so that a future narrowing can never read as data
          // loss, and it always offers the way back.
          <div class="physics-paint-scripts-empty">
            <p>No Scripts from this layer.</p>
            <p>Every project Script is still available under All.</p>
            <button type="button" class="physics-paint-scripts-empty-action" onClick={() => library.setScriptScope(ROTO_SCRIPT_SCOPE_ALL)}>Show all Scripts</button>
          </div>
        ) : null}
      </div>
      </SidebarScrollArea>
      {confirmation ? (
        <div ref={confirmationRef} class="physics-paint-script-confirmation" role="dialog" aria-modal="true" aria-label={`Delete ${confirmation.name}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              if (confirmationBusy) return;
              library.cancelDelete();
              return;
            }
            if (event.key !== 'Tab') return;
            const controls = Array.from(confirmationRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
            if (!controls.length) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }}>
          <strong>Delete “{confirmation.name}”?</strong>
          {deleteError ? <span class="physics-paint-script-inline-error" role="alert">{deleteError}</span> : null}
          {referenceImpact ? (
            <div class="physics-paint-action-delete-groups">
              <p>
                This Script is referenced by {referenceImpact.groupCount} {referenceImpact.groupCount === 1 ? 'Rail' : 'Rails'} across {referenceImpact.visibleRangeCount} visible {referenceImpact.visibleRangeCount === 1 ? 'range' : 'ranges'}.
              </p>
              <ul aria-label="Affected Rails">
                {referenceImpact.affectedGroups.map((group) => (
                  <li key={group.groupId}>
                    <strong>{group.name} · {formatFrameRange(group.placementStart, group.endExclusive)}</strong>
                    {group.visibleRanges.length > 1 ? <span> · {group.visibleRanges.length} ranges</span> : null}
                    <span>Visible ranges: {group.visibleRanges.map((range) => formatFrameRange(range.start, range.endExclusive)).join(', ')}</span>
                  </li>
                ))}
              </ul>
              <div class="physics-paint-action-delete-choices">
                <button
                  type="button"
                  class="physics-paint-action-delete-choice recommended"
                  aria-label="Keep Rails"
                  aria-disabled={confirmationBusy ? 'true' : undefined}
                  onClick={() => {
                    if (confirmationBusy) return;
                    void library.confirmDelete('keep-groups');
                  }}
                >
                  <strong>Keep Rails</strong>
                  <span>Recommended. Delete the Script but keep every Rail, fragment, key, timing value, cache, and rendered result. Rails become detached and timeline space stays occupied.</span>
                </button>
                <button
                  type="button"
                  class="physics-paint-action-delete-choice danger"
                  aria-label="Delete Script and Rails"
                  aria-disabled={confirmationBusy ? 'true' : undefined}
                  onClick={() => {
                    if (confirmationBusy) return;
                    void library.confirmDelete('delete-action-and-groups');
                  }}
                >
                  <strong>Delete Script and Rails</strong>
                  <span>Delete the Script and all {referenceImpact.groupCount} referencing Rails, including uniquely owned source, cache, and Rail-gap data. Their occupied timeline ranges are freed.</span>
                </button>
                <button
                  ref={cancelDeleteRef}
                  type="button"
                  aria-label="Cancel"
                  aria-disabled={confirmationBusy ? 'true' : undefined}
                  onClick={() => {
                    if (confirmationBusy) return;
                    library.cancelDelete();
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <span>This removes the project Script file and cannot be undone.</span>
              <div>
                <button
                  ref={cancelDeleteRef}
                  type="button"
                  aria-disabled={confirmationBusy ? 'true' : undefined}
                  onClick={() => {
                    if (confirmationBusy) return;
                    library.cancelDelete();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="danger"
                  aria-disabled={confirmationBusy ? 'true' : undefined}
                  onClick={() => {
                    if (confirmationBusy) return;
                    void library.confirmDelete();
                  }}
                >
                  Delete Script
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function formatFrameRange(start: number, endExclusive: number): string {
  return `F${start}–F${endExclusive - 1}`;
}

function IconButton(props: { buttonRef?: Ref<HTMLButtonElement>; label: string; title: string; disabled?: boolean; disabledReason?: string; descriptionId?: string; onClick?: () => void; className?: string; wrapperClassName?: string; children: ComponentChildren }) {
  const tooltip = useStyledTooltip();
  const isDisabled = props.disabled ?? false;
  const reason = props.disabledReason ?? null;
  const buttonClass = props.className ?? 'physics-paint-script-icon-button';
  const wrapperClass = props.wrapperClassName ?? 'physics-paint-roto-key-icon-action';
  return (
    <span class={wrapperClass} onPointerEnter={tooltip.onPointerEnter} onPointerLeave={tooltip.onPointerLeave}>
      <button
        ref={props.buttonRef}
        type="button"
        class={buttonClass}
        aria-label={props.label}
        aria-disabled={isDisabled ? 'true' : undefined}
        aria-describedby={isDisabled && reason ? props.descriptionId : undefined}
        onFocus={tooltip.onFocus}
        onBlur={tooltip.onBlur}
        onClick={() => {
          tooltip.hide();
          if (isDisabled) return;
          props.onClick?.();
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && isDisabled) event.preventDefault();
        }}
      >
        {props.children}
      </button>
      {isDisabled && reason ? (
        <span id={props.descriptionId} class="physics-paint-sr-only">{reason}</span>
      ) : null}
      <PhysicsPaintStyledTooltip visible={tooltip.visible} region="right-edge" avoidRowOverlap>
        {isDisabled && reason ? `unavailable: ${reason}` : props.title}
      </PhysicsPaintStyledTooltip>
    </span>
  );
}
