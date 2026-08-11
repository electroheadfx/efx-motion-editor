import { Clipboard, ClipboardPen, ClipboardX, Paintbrush, Pencil, Play, RefreshCw, Save, Trash2, X } from 'lucide-preact';
import type { ComponentChildren, Ref, RefObject } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import type { PhysicsPaintLoopClipPresentation } from './physicsPaintLoopClipPresentation';

export interface PhysicsPaintScriptsPanelProps {
  library: RotoScriptLibraryController;
  playScript: RotoPlayScriptController;
  rotoScript: RotoScriptClipboardController;
  playButtonRef: RefObject<HTMLButtonElement>;
  selectedLoopClip?: PhysicsPaintLoopClipPresentation | null;
  linkedGroupNavigation?: {
    currentIndex: number;
    total: number;
    onPrevious: () => void;
    onNext: () => void;
    onGoToGroup: () => void;
  } | null;
  onOpenLoopEdit: (loopId: string) => Promise<unknown>;
  onCloseLoopClip: () => void;
  onSave: () => void;
  onActivateRow: (id: string) => void;
  onLoadAndApply: () => void;
  onDiscardScript: () => void;
  onCopyScript: () => void;
  onApplyScript: () => void;
  onRefresh: () => void;
}

export function PhysicsPaintScriptsPanel({
  library,
  playScript,
  rotoScript,
  playButtonRef,
  selectedLoopClip = null,
  linkedGroupNavigation = null,
  onOpenLoopEdit,
  onCloseLoopClip,
  onSave,
  onActivateRow,
  onLoadAndApply,
  onDiscardScript,
  onCopyScript,
  onApplyScript,
  onRefresh,
}: PhysicsPaintScriptsPanelProps) {
  const rows = library.rows.value;
  const selectedActionId = library.selectedId.value;
  const availability = library.availability.value;
  const actionMutationDisabledReason = library.actionMutationDisabledReason.value;
  const confirmationBusy = actionMutationDisabledReason !== null;
  const loadAndApplyDisabledReason = actionMutationDisabledReason
    ?? (!library.selected.value
      ? 'Select a project Action first.'
      : rotoScript.availability.value.replacementApplyDisabledReason);
  const saveDisabledReason = actionMutationDisabledReason ?? availability.saveDisabledReason;
  const playScriptDisabledReason = actionMutationDisabledReason ?? playScript.disabledReason.value;
  const rename = library.rename.value;
  const confirmation = library.deleteConfirmation.value;
  const deleteError = library.deleteError.value;
  const referenceImpact = confirmation?.referenceImpact ?? null;
  const toolbarRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const previousConfirmation = useRef<typeof confirmation>(null);
  const saveReasonId = useId();
  const loadAndApplyReasonId = useId();
  const playReasonId = useId();
  const copyScriptReasonId = useId();
  const applyScriptReasonId = useId();
  const clearScriptBufferReasonId = useId();
  const copyScriptTooltip = useStyledTooltip();
  const applyScriptTooltip = useStyledTooltip();
  const clearScriptBufferTooltip = useStyledTooltip();
  const canCopyRotoScript = actionMutationDisabledReason === null && rotoScript.availability.value.canCopy;
  const canApplyRotoScript = actionMutationDisabledReason === null && rotoScript.availability.value.canApply;
  const copyRotoScriptDisabledReason = actionMutationDisabledReason ?? (canCopyRotoScript ? null : rotoScript.availability.value.copyDisabledReason);
  const applyRotoScriptDisabledReason = actionMutationDisabledReason ?? (canApplyRotoScript ? null : rotoScript.availability.value.applyDisabledReason);
  const canClearScriptBuffer = actionMutationDisabledReason === null && rotoScript.availability.value.canDiscard;
  const clearScriptBufferDisabledReason = actionMutationDisabledReason ?? (canClearScriptBuffer ? null : rotoScript.availability.value.discardDisabledReason);
  useEffect(() => {
    const previous = previousConfirmation.current;
    previousConfirmation.current = confirmation;
    let focusFrame: number | null = null;
    if (confirmation && !previous) {
      focusFrame = requestAnimationFrame(() => cancelDeleteRef.current?.focus());
    } else if (!confirmation && previous) {
      focusFrame = requestAnimationFrame(() => {
        if (rows.some((row) => row.id === previous.id)) {
          deleteButtonRef.current?.focus();
          return;
        }
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
  const stopRowPointerActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const stopRowKeyboardActivation = (event: { key: string; stopPropagation: () => void }) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
  };

  if (selectedLoopClip) {
    return (
      <div class="physics-paint-scripts-panel physics-paint-loop-clip-panel" role="tabpanel" aria-label={`Selected Group — ${selectedLoopClip.displayName}`}>
        <dl class="physics-paint-loop-clip-inspector">
          <div><dt>Name</dt><dd title={selectedLoopClip.displayName}>{selectedLoopClip.displayName}</dd></div>
          <div><dt>Source Action</dt><dd title={selectedLoopClip.sourceLabel}>{selectedLoopClip.sourceLabel}</dd></div>
          <div><dt>Placement</dt><dd>{selectedLoopClip.placementLabel}</dd></div>
          <div><dt>Cycle</dt><dd>{selectedLoopClip.cycleLabel}</dd></div>
          <div><dt>Effective</dt><dd>{selectedLoopClip.effectiveLabel}</dd></div>
          <div><dt>Group Type</dt><dd>{selectedLoopClip.modeLabel}</dd></div>
          <div><dt>Status</dt><dd>{selectedLoopClip.statusLabel}</dd></div>
        </dl>
        {linkedGroupNavigation ? (
          <section class="physics-paint-loop-clip-linked-navigation" aria-label="Linked Group navigation">
            <strong>Linked Groups — {linkedGroupNavigation.currentIndex + 1} of {linkedGroupNavigation.total}</strong>
            <div class={`physics-paint-loop-clip-inspector-actions${linkedGroupNavigation.total === 1 ? ' single' : ''}`}>
              {linkedGroupNavigation.total === 1 ? (
                <button
                  type="button"
                  class="physics-paint-loop-clip-inspector-action"
                  onClick={linkedGroupNavigation.onGoToGroup}
                >
                  Go to Group
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    class="physics-paint-loop-clip-inspector-action"
                    disabled={linkedGroupNavigation.currentIndex === 0}
                    onClick={linkedGroupNavigation.onPrevious}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    class="physics-paint-loop-clip-inspector-action"
                    disabled={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1}
                    onClick={linkedGroupNavigation.onNext}
                  >
                    Next
                  </button>
                </>
              )}
            </div>
          </section>
        ) : null}
        <div class="physics-paint-loop-clip-inspector-actions">
          <button
            ref={playButtonRef}
            type="button"
            class="physics-paint-loop-clip-inspector-action primary"
            aria-label={`Edit Group — ${selectedLoopClip.displayName}`}
            onClick={() => { void onOpenLoopEdit(selectedLoopClip.loopId); }}
          >
            <Pencil size={16} aria-hidden="true" />
            <span>Edit Group</span>
          </button>
          <button
            type="button"
            class="physics-paint-loop-clip-inspector-action"
            aria-label={`Close Group inspector — ${selectedLoopClip.displayName}`}
            onClick={onCloseLoopClip}
          >
            <X size={16} aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="physics-paint-scripts-panel" role="tabpanel" aria-label="Project Actions">
      <div ref={toolbarRef} class="physics-paint-scripts-toolbar" role="toolbar" aria-label="Actions">
        <IconButton label="Save Action" title={`Save Action — ${saveDisabledReason ?? 'Save the active real Roto frame'}`} disabled={saveDisabledReason !== null || !availability.canSave} disabledReason={saveDisabledReason ?? undefined} descriptionId={saveReasonId} onClick={onSave}><Save size={16} /></IconButton>
        <IconButton label="Load + Apply to Frame" title={`Load + Apply to Frame — ${loadAndApplyDisabledReason ?? 'Reload the selected preset and apply it to this Roto frame'}`} disabled={loadAndApplyDisabledReason !== null} disabledReason={loadAndApplyDisabledReason ?? undefined} descriptionId={loadAndApplyReasonId} onClick={onLoadAndApply}><Paintbrush size={16} /></IconButton>
        <IconButton buttonRef={playButtonRef} label="Create Group…" title={`Create Group… — ${actionMutationDisabledReason ?? (playScript.disabledReason.value ?? 'Create a Motion or Static Group from the selected Action')}`} disabled={playScriptDisabledReason !== null} disabledReason={playScriptDisabledReason ?? undefined} descriptionId={playReasonId} onClick={() => { void playScript.openConfirmation(); }}><Play size={16} /></IconButton>
        <IconButton buttonRef={deleteButtonRef} label="Delete Action" title={`Delete Action — ${actionMutationDisabledReason ?? 'Remove the selected project Action'}`} disabled={actionMutationDisabledReason !== null || !availability.canDelete} disabledReason={actionMutationDisabledReason ?? undefined} onClick={library.requestDelete}><Trash2 size={16} /></IconButton>
        <IconButton label="Refresh Actions" title={`Refresh Actions — ${actionMutationDisabledReason ?? 'Scan the project Actions folder'}`} disabled={actionMutationDisabledReason !== null} disabledReason={actionMutationDisabledReason ?? undefined} onClick={onRefresh}><RefreshCw size={16} /></IconButton>
        <span class="physics-paint-roto-key-icon-action" onPointerEnter={copyScriptTooltip.onPointerEnter} onPointerLeave={copyScriptTooltip.onPointerLeave}>
          <button
            type="button"
            class="physics-paint-script-icon-button"
            aria-label="Copy Action"
            aria-disabled={!canCopyRotoScript ? 'true' : undefined}
            aria-describedby={!canCopyRotoScript && copyRotoScriptDisabledReason ? copyScriptReasonId : undefined}
            onFocus={copyScriptTooltip.onFocus}
            onBlur={copyScriptTooltip.onBlur}
            onClick={() => {
              copyScriptTooltip.hide();
              if (!canCopyRotoScript) return;
              onCopyScript();
            }}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && !canCopyRotoScript) event.preventDefault();
            }}
          >
            <Clipboard size={16} aria-hidden="true" />
            <span class="physics-paint-roto-key-icon-label">Copy</span>
          </button>
          {!canCopyRotoScript && copyRotoScriptDisabledReason ? (
            <span id={copyScriptReasonId} class="physics-paint-sr-only">{copyRotoScriptDisabledReason}</span>
          ) : null}
          <PhysicsPaintStyledTooltip visible={copyScriptTooltip.visible} region="right-edge" avoidRowOverlap>
            {!canCopyRotoScript && copyRotoScriptDisabledReason ? `unavailable: ${copyRotoScriptDisabledReason}` : 'Copy Action'}
          </PhysicsPaintStyledTooltip>
        </span>
        <span class="physics-paint-roto-key-icon-action" onPointerEnter={applyScriptTooltip.onPointerEnter} onPointerLeave={applyScriptTooltip.onPointerLeave}>
          <button
            type="button"
            class="physics-paint-script-icon-button"
            aria-label="Apply to Frame"
            aria-disabled={!canApplyRotoScript ? 'true' : undefined}
            aria-describedby={!canApplyRotoScript && applyRotoScriptDisabledReason ? applyScriptReasonId : undefined}
            onFocus={applyScriptTooltip.onFocus}
            onBlur={applyScriptTooltip.onBlur}
            onClick={() => {
              applyScriptTooltip.hide();
              if (!canApplyRotoScript) return;
              onApplyScript();
            }}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && !canApplyRotoScript) event.preventDefault();
            }}
          >
            <ClipboardPen size={16} aria-hidden="true" />
            <span class="physics-paint-roto-key-icon-label">Apply</span>
          </button>
          {!canApplyRotoScript && applyRotoScriptDisabledReason ? (
            <span id={applyScriptReasonId} class="physics-paint-sr-only">{applyRotoScriptDisabledReason}</span>
          ) : null}
          <PhysicsPaintStyledTooltip visible={applyScriptTooltip.visible} region="right-edge" avoidRowOverlap>
            {!canApplyRotoScript && applyRotoScriptDisabledReason ? `unavailable: ${applyRotoScriptDisabledReason}` : 'Apply to Frame'}
          </PhysicsPaintStyledTooltip>
        </span>
        <span class="physics-paint-roto-key-icon-action" onPointerEnter={clearScriptBufferTooltip.onPointerEnter} onPointerLeave={clearScriptBufferTooltip.onPointerLeave}>
          <button
            type="button"
            class="physics-paint-script-icon-button"
            aria-label="Clear Action Buffer"
            aria-disabled={!canClearScriptBuffer ? 'true' : undefined}
            aria-describedby={!canClearScriptBuffer && clearScriptBufferDisabledReason ? clearScriptBufferReasonId : undefined}
            onFocus={clearScriptBufferTooltip.onFocus}
            onBlur={clearScriptBufferTooltip.onBlur}
            onClick={() => {
              clearScriptBufferTooltip.hide();
              if (!canClearScriptBuffer) return;
              onDiscardScript();
            }}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && !canClearScriptBuffer) event.preventDefault();
            }}
          >
            <ClipboardX size={16} aria-hidden="true" />
            <span class="physics-paint-roto-key-icon-label">Clear</span>
          </button>
          {!canClearScriptBuffer && clearScriptBufferDisabledReason ? (
            <span id={clearScriptBufferReasonId} class="physics-paint-sr-only">{clearScriptBufferDisabledReason}</span>
          ) : null}
          <PhysicsPaintStyledTooltip visible={clearScriptBufferTooltip.visible} region="right-edge" avoidRowOverlap>
            {!canClearScriptBuffer && clearScriptBufferDisabledReason ? `unavailable: ${clearScriptBufferDisabledReason}` : 'Clear Action from buffer'}
          </PhysicsPaintStyledTooltip>
        </span>
      </div>
      {linkedGroupNavigation ? (
        <section class="physics-paint-loop-clip-linked-navigation" aria-label="Linked Group navigation">
          <strong>Linked Groups — {linkedGroupNavigation.currentIndex + 1} of {linkedGroupNavigation.total}</strong>
          <div class={`physics-paint-loop-clip-inspector-actions${linkedGroupNavigation.total === 1 ? ' single' : ''}`}>
            {linkedGroupNavigation.total === 1 ? (
              <button type="button" class="physics-paint-loop-clip-inspector-action" onClick={linkedGroupNavigation.onGoToGroup}>Go to Group</button>
            ) : (
              <>
                <button type="button" class="physics-paint-loop-clip-inspector-action" disabled={linkedGroupNavigation.currentIndex === 0} onClick={linkedGroupNavigation.onPrevious}>Previous</button>
                <button type="button" class="physics-paint-loop-clip-inspector-action" disabled={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1} onClick={linkedGroupNavigation.onNext}>Next</button>
              </>
            )}
          </div>
        </section>
      ) : null}
      <div ref={listRef} class="physics-paint-scripts-list" role="listbox" aria-label="Saved Roto Actions">
        {rows.map((row) => (
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
              <span class="physics-paint-script-provenance">{row.source.projectName} · {row.source.layerName} · F{row.source.displayFrame}</span>
              <span class="physics-paint-script-count">{row.brushCount} {row.brushCount === 1 ? 'brush' : 'brushes'}</span>
            </span>
          </div>
        ))}
        {!rows.length ? (
          <div class="physics-paint-scripts-empty">
            <p>No project Actions yet.</p>
            <p>Save the current real Roto frame as an Action to create a Group.</p>
          </div>
        ) : null}
      </div>
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
                This Action is referenced by {referenceImpact.groupCount} {referenceImpact.groupCount === 1 ? 'Group' : 'Groups'} across {referenceImpact.visibleRangeCount} visible {referenceImpact.visibleRangeCount === 1 ? 'range' : 'ranges'}.
              </p>
              <ul aria-label="Affected Groups">
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
                  aria-label="Keep Groups"
                  aria-disabled={confirmationBusy ? 'true' : undefined}
                  onClick={() => {
                    if (confirmationBusy) return;
                    void library.confirmDelete('keep-groups');
                  }}
                >
                  <strong>Keep Groups</strong>
                  <span>Recommended. Delete the Action but keep every Group, fragment, key, timing value, cache, and rendered result. Groups become detached and timeline space stays occupied.</span>
                </button>
                <button
                  type="button"
                  class="physics-paint-action-delete-choice danger"
                  aria-label="Delete Action and Groups"
                  aria-disabled={confirmationBusy ? 'true' : undefined}
                  onClick={() => {
                    if (confirmationBusy) return;
                    void library.confirmDelete('delete-action-and-groups');
                  }}
                >
                  <strong>Delete Action and Groups</strong>
                  <span>Delete the Action and all {referenceImpact.groupCount} referencing Groups, including uniquely owned source, cache, and Group-gap data. Their occupied timeline ranges are freed.</span>
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
              <span>This removes the project Action file and cannot be undone.</span>
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
                  Delete Action
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

function IconButton(props: { buttonRef?: Ref<HTMLButtonElement>; label: string; title: string; disabled?: boolean; disabledReason?: string; descriptionId?: string; onClick?: () => void; children: ComponentChildren }) {
  const button = <button ref={props.buttonRef} type="button" class="physics-paint-script-icon-button" aria-label={props.label} title={props.title} disabled={props.disabled} aria-describedby={props.disabledReason ? props.descriptionId : undefined} onClick={props.onClick}>{props.children}</button>;
  if (!props.disabledReason || !props.descriptionId) return button;
  return <span class="physics-paint-script-disabled-control" tabIndex={0} title={props.title} aria-describedby={props.descriptionId}>{button}<span id={props.descriptionId} class="physics-paint-sr-only">{props.disabledReason}</span></span>;
}
