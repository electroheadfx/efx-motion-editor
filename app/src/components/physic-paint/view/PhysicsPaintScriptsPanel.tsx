import { ChevronLeft, ChevronRight, Clipboard, Paintbrush, Pencil, Play, RefreshCw, Save, Trash2, X } from 'lucide-preact';
import type { ComponentChildren, Ref, RefObject } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import type { PhysicsPaintLoopClipPresentation } from './physicsPaintLoopClipPresentation';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';

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
  onCopyScript: () => void;
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
  onCopyScript,
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
  const previousRailReasonId = useId();
  const nextRailReasonId = useId();
  const deleteReasonId = useId();
  const refreshReasonId = useId();
  const copyScriptTooltip = useStyledTooltip();
  const canCopyRotoScript = actionMutationDisabledReason === null && rotoScript.availability.value.canCopy;
  const copyRotoScriptDisabledReason = actionMutationDisabledReason ?? (canCopyRotoScript ? null : rotoScript.availability.value.copyDisabledReason);
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
      <div class="physics-paint-scripts-panel physics-paint-loop-clip-panel" role="tabpanel" aria-label={`Selected Rail — ${selectedLoopClip.displayName}`}>
        <div class="physics-paint-loop-clip-inspector-top-actions">
          <IconButton buttonRef={playButtonRef} label={`Edit Rail — ${selectedLoopClip.displayName}`} title={`Edit Rail — ${selectedLoopClip.displayName}`} onClick={() => { void onOpenLoopEdit(selectedLoopClip.loopId); }} className="physics-paint-loop-clip-nav-compact-button primary" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><Pencil size={16} aria-hidden="true" /></IconButton>
          {linkedGroupNavigation && linkedGroupNavigation.total > 1 ? (
            <>
              <IconButton label="Previous Rail" title="Previous Rail" disabled={linkedGroupNavigation.currentIndex === 0} disabledReason={linkedGroupNavigation.currentIndex === 0 ? 'Already on the first linked Rail' : undefined} descriptionId={previousRailReasonId} onClick={linkedGroupNavigation.onPrevious} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><ChevronLeft size={16} aria-hidden="true" /></IconButton>
              <IconButton label="Next Rail" title="Next Rail" disabled={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1} disabledReason={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1 ? 'Already on the last linked Rail' : undefined} descriptionId={nextRailReasonId} onClick={linkedGroupNavigation.onNext} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><ChevronRight size={16} aria-hidden="true" /></IconButton>
            </>
          ) : null}
          <IconButton label={`Close Rail inspector — ${selectedLoopClip.displayName}`} title={`Close Rail inspector — ${selectedLoopClip.displayName}`} onClick={onCloseLoopClip} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><X size={16} aria-hidden="true" /></IconButton>
        </div>
        <SidebarScrollArea class="physics-paint-scripts-list-scroll-area" interactive>
        <dl class="physics-paint-loop-clip-inspector">
          <div><dt>Name</dt><dd title={selectedLoopClip.displayName}>{selectedLoopClip.displayName}</dd></div>
          <div><dt>Source Action</dt><dd title={selectedLoopClip.sourceLabel}>{selectedLoopClip.sourceLabel}</dd></div>
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
    <div class="physics-paint-scripts-panel" role="tabpanel" aria-label="Project Actions">
      <div ref={toolbarRef} class="physics-paint-scripts-toolbar" role="toolbar" aria-label="Actions">
        <IconButton label="Save Action" title={`Save Action — ${saveDisabledReason ?? 'Save the active real Roto frame'}`} disabled={saveDisabledReason !== null || !availability.canSave} disabledReason={saveDisabledReason ?? undefined} descriptionId={saveReasonId} onClick={onSave}><Save size={16} /></IconButton>
        <IconButton label="Load + Apply to Frame" title={`Load + Apply to Frame — ${loadAndApplyDisabledReason ?? 'Reload the selected preset and apply it to this Roto frame'}`} disabled={loadAndApplyDisabledReason !== null} disabledReason={loadAndApplyDisabledReason ?? undefined} descriptionId={loadAndApplyReasonId} onClick={onLoadAndApply}><Paintbrush size={16} /></IconButton>
        <IconButton buttonRef={playButtonRef} label="Create Rail…" title={`Create Rail… — ${actionMutationDisabledReason ?? (playScript.disabledReason.value ?? 'Create a Motion or Static Rail from the selected Action')}`} disabled={playScriptDisabledReason !== null} disabledReason={playScriptDisabledReason ?? undefined} descriptionId={playReasonId} onClick={() => { void playScript.openConfirmation(); }}><Play size={16} /></IconButton>
        <IconButton buttonRef={deleteButtonRef} label="Delete Action" title={`Delete Action — ${actionMutationDisabledReason ?? 'Remove the selected project Action'}`} disabled={actionMutationDisabledReason !== null || !availability.canDelete} disabledReason={actionMutationDisabledReason ?? undefined} descriptionId={deleteReasonId} onClick={library.requestDelete}><Trash2 size={16} /></IconButton>
        <IconButton label="Refresh Actions" title={`Refresh Actions — ${actionMutationDisabledReason ?? 'Scan the project Actions folder'}`} disabled={actionMutationDisabledReason !== null} disabledReason={actionMutationDisabledReason ?? undefined} descriptionId={refreshReasonId} onClick={onRefresh}><RefreshCw size={16} /></IconButton>
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
      </div>
      {linkedGroupNavigation ? (
        <section class="physics-paint-loop-clip-linked-navigation physics-paint-loop-clip-nav-compact" aria-label="Linked Rail navigation">
          <strong>Linked Rails — {linkedGroupNavigation.currentIndex + 1} of {linkedGroupNavigation.total}</strong>
          {linkedGroupNavigation.total === 1 ? (
            <button type="button" class="physics-paint-loop-clip-inspector-action" onClick={linkedGroupNavigation.onGoToGroup}>Go to Group</button>
          ) : (
            <div class="physics-paint-loop-clip-nav-compact-actions">
              <IconButton label="Previous Rail" title="Previous Rail" disabled={linkedGroupNavigation.currentIndex === 0} disabledReason={linkedGroupNavigation.currentIndex === 0 ? 'Already on the first linked Rail' : undefined} descriptionId={previousRailReasonId} onClick={linkedGroupNavigation.onPrevious} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><ChevronLeft size={16} aria-hidden="true" /></IconButton>
              <IconButton label="Next Rail" title="Next Rail" disabled={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1} disabledReason={linkedGroupNavigation.currentIndex === linkedGroupNavigation.total - 1 ? 'Already on the last linked Rail' : undefined} descriptionId={nextRailReasonId} onClick={linkedGroupNavigation.onNext} className="physics-paint-loop-clip-nav-compact-button" wrapperClassName="physics-paint-roto-key-icon-action physics-paint-loop-clip-nav-compact-action"><ChevronRight size={16} aria-hidden="true" /></IconButton>
            </div>
          )}
        </section>
      ) : null}
      <SidebarScrollArea class="physics-paint-scripts-list-scroll-area" interactive>
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
            <p>Save the current real Roto frame as an Action to create a Rail.</p>
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
                This Action is referenced by {referenceImpact.groupCount} {referenceImpact.groupCount === 1 ? 'Rail' : 'Rails'} across {referenceImpact.visibleRangeCount} visible {referenceImpact.visibleRangeCount === 1 ? 'range' : 'ranges'}.
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
                  <span>Recommended. Delete the Action but keep every Rail, fragment, key, timing value, cache, and rendered result. Rails become detached and timeline space stays occupied.</span>
                </button>
                <button
                  type="button"
                  class="physics-paint-action-delete-choice danger"
                  aria-label="Delete Action and Rails"
                  aria-disabled={confirmationBusy ? 'true' : undefined}
                  onClick={() => {
                    if (confirmationBusy) return;
                    void library.confirmDelete('delete-action-and-groups');
                  }}
                >
                  <strong>Delete Action and Rails</strong>
                  <span>Delete the Action and all {referenceImpact.groupCount} referencing Rails, including uniquely owned source, cache, and Rail-gap data. Their occupied timeline ranges are freed.</span>
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
