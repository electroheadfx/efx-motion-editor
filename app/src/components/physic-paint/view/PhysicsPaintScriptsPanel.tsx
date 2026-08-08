import { Clipboard, ClipboardPen, ClipboardX, Paintbrush, Pencil, Play, RefreshCw, Save, Trash2 } from 'lucide-preact';
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
  onOpenLoopEdit?: (loopId: string) => Promise<unknown>;
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
  onOpenLoopEdit,
  onSave,
  onActivateRow,
  onLoadAndApply,
  onDiscardScript,
  onCopyScript,
  onApplyScript,
  onRefresh,
}: PhysicsPaintScriptsPanelProps) {
  const rows = library.rows.value;
  const availability = library.availability.value;
  const loadAndApplyDisabledReason = !library.selected.value
    ? 'Select a project script first.'
    : library.busy.value
      ? 'Finish the current script library operation.'
      : rotoScript.availability.value.replacementApplyDisabledReason;
  const rename = library.rename.value;
  const confirmation = library.deleteConfirmation.value;
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const previousConfirmation = useRef(false);
  const saveReasonId = useId();
  const loadAndApplyReasonId = useId();
  const playReasonId = useId();
  const copyScriptReasonId = useId();
  const applyScriptReasonId = useId();
  const clearScriptBufferReasonId = useId();
  const copyScriptTooltip = useStyledTooltip();
  const applyScriptTooltip = useStyledTooltip();
  const clearScriptBufferTooltip = useStyledTooltip();
  const canCopyRotoScript = rotoScript.availability.value.canCopy;
  const canApplyRotoScript = rotoScript.availability.value.canApply;
  const copyRotoScriptDisabledReason = canCopyRotoScript ? null : rotoScript.availability.value.copyDisabledReason;
  const applyRotoScriptDisabledReason = canApplyRotoScript ? null : rotoScript.availability.value.applyDisabledReason;
  const canClearScriptBuffer = rotoScript.availability.value.canDiscard;
  const clearScriptBufferDisabledReason = canClearScriptBuffer ? null : rotoScript.availability.value.discardDisabledReason;
  useEffect(() => {
    if (confirmation) cancelDeleteRef.current?.focus();
    else if (previousConfirmation.current) deleteButtonRef.current?.focus();
    previousConfirmation.current = Boolean(confirmation);
  }, [confirmation]);
  const stopRowPointerActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const stopRowKeyboardActivation = (event: { key: string; stopPropagation: () => void }) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
  };
  return (
    <div class="physics-paint-scripts-panel" role="tabpanel" aria-label="Project Roto scripts">
      <div class="physics-paint-scripts-toolbar" role="toolbar" aria-label="Roto script library actions">
        <IconButton label="Save Script" title={`Save Script — ${availability.saveDisabledReason ?? 'Save the active real Roto frame'}`} disabled={!availability.canSave} disabledReason={availability.saveDisabledReason ?? undefined} descriptionId={saveReasonId} onClick={onSave}><Save size={16} /></IconButton>
        <IconButton label="Load and Apply Script" title={`Load and Apply Script — ${loadAndApplyDisabledReason ?? 'Reload the selected preset and apply it to this Roto frame'}`} disabled={loadAndApplyDisabledReason !== null} disabledReason={loadAndApplyDisabledReason ?? undefined} descriptionId={loadAndApplyReasonId} onClick={onLoadAndApply}><Paintbrush size={16} /></IconButton>
        {selectedLoopClip ? (
          <IconButton
            buttonRef={playButtonRef}
            label={`Edit Loop Clip — ${selectedLoopClip.displayName}`}
            title={`Edit Loop Clip — ${selectedLoopClip.displayName}`}
            onClick={() => { void onOpenLoopEdit?.(selectedLoopClip.loopId); }}
          >
            <Pencil size={16} />
          </IconButton>
        ) : (
          <IconButton buttonRef={playButtonRef} label="Play Script" title={`Play Script — ${playScript.disabledReason.value ?? 'Generate real Roto keys (progressive or static/hold)'}`} disabled={playScript.disabledReason.value !== null} disabledReason={playScript.disabledReason.value ?? undefined} descriptionId={playReasonId} onClick={() => { void playScript.openConfirmation(); }}><Play size={16} /></IconButton>
        )}
        <IconButton buttonRef={deleteButtonRef} label="Delete Script" title="Delete Script — Remove the selected project preset" disabled={!availability.canDelete} onClick={library.requestDelete}><Trash2 size={16} /></IconButton>
        <IconButton label="Refresh Scripts" title="Refresh Scripts — Scan the project scripts folder" disabled={library.busy.value} onClick={onRefresh}><RefreshCw size={16} /></IconButton>
        <span class="physics-paint-roto-key-icon-action" onPointerEnter={copyScriptTooltip.onPointerEnter} onPointerLeave={copyScriptTooltip.onPointerLeave}>
          <button
            type="button"
            class="physics-paint-script-icon-button"
            aria-label="Copy Script"
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
            {!canCopyRotoScript && copyRotoScriptDisabledReason ? `unavailable: ${copyRotoScriptDisabledReason}` : 'Copy Script'}
          </PhysicsPaintStyledTooltip>
        </span>
        <span class="physics-paint-roto-key-icon-action" onPointerEnter={applyScriptTooltip.onPointerEnter} onPointerLeave={applyScriptTooltip.onPointerLeave}>
          <button
            type="button"
            class="physics-paint-script-icon-button"
            aria-label="Apply Script"
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
            {!canApplyRotoScript && applyRotoScriptDisabledReason ? `unavailable: ${applyRotoScriptDisabledReason}` : 'Apply Script'}
          </PhysicsPaintStyledTooltip>
        </span>
        <span class="physics-paint-roto-key-icon-action" onPointerEnter={clearScriptBufferTooltip.onPointerEnter} onPointerLeave={clearScriptBufferTooltip.onPointerLeave}>
          <button
            type="button"
            class="physics-paint-script-icon-button"
            aria-label="Clear Script Buffer"
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
            {!canClearScriptBuffer && clearScriptBufferDisabledReason ? `unavailable: ${clearScriptBufferDisabledReason}` : 'Clear script from buffer'}
          </PhysicsPaintStyledTooltip>
        </span>
      </div>
      {selectedLoopClip ? (
        <dl class="physics-paint-loop-clip-inspector" aria-label={`Selected Loop Clip — ${selectedLoopClip.displayName}`}>
          <div><dt>Name</dt><dd title={selectedLoopClip.displayName}>{selectedLoopClip.displayName}</dd></div>
          <div><dt>Source script</dt><dd title={selectedLoopClip.sourceLabel}>{selectedLoopClip.sourceLabel}</dd></div>
          <div><dt>Placement</dt><dd>{selectedLoopClip.placementLabel}</dd></div>
          <div><dt>Cycle</dt><dd>{selectedLoopClip.cycleLabel}</dd></div>
          <div><dt>Effective</dt><dd>{selectedLoopClip.effectiveLabel}</dd></div>
          <div><dt>Mode</dt><dd>{selectedLoopClip.modeLabel}</dd></div>
          <div><dt>Status</dt><dd>{selectedLoopClip.statusLabel}</dd></div>
        </dl>
      ) : (
        <p class="physics-paint-scripts-summary">
          <span class="physics-paint-scripts-summary-line1">{playScript.appliedSummary.line1.value}</span>
          <span class="physics-paint-scripts-summary-line2">{playScript.appliedSummary.line2.value}</span>
        </p>
      )}
      <div class="physics-paint-scripts-list" role="listbox" aria-label="Saved Roto scripts">
        {rows.map((row) => (
          <div
            key={row.id}
            role="option"
            tabIndex={0}
            aria-selected={library.selectedId.value === row.id}
            aria-label={`Load ${row.name}`}
            class={`physics-paint-script-row${library.selectedId.value === row.id ? ' selected' : ''}`}
            onClick={() => onActivateRow(row.id)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
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
                  disabled={library.busy.value}
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
        {!rows.length ? <p class="physics-paint-scripts-empty">No project scripts yet.</p> : null}
      </div>
      <p class="physics-paint-scripts-status" aria-live="polite">{playScript.status.value ?? library.status.value}{library.skippedInvalidCount.value ? ` · Skipped ${library.skippedInvalidCount.value} invalid files` : ''}</p>
      {confirmation ? (
        <div ref={confirmationRef} class="physics-paint-script-confirmation" role="dialog" aria-modal="true" aria-label={`Delete ${confirmation.name}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); library.cancelDelete(); return; }
            if (event.key !== 'Tab') return;
            const controls = Array.from(confirmationRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
            if (!controls.length) return;
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }}>
          <strong>Delete “{confirmation.name}”?</strong><span>This removes the project script file and cannot be undone.</span>
          <div><button ref={cancelDeleteRef} type="button" onClick={library.cancelDelete}>Cancel</button><button type="button" class="danger" onClick={() => void library.confirmDelete()}>Delete</button></div>
        </div>
      ) : null}
    </div>
  );
}

function IconButton(props: { buttonRef?: Ref<HTMLButtonElement>; label: string; title: string; disabled?: boolean; disabledReason?: string; descriptionId?: string; onClick?: () => void; children: ComponentChildren }) {
  const button = <button ref={props.buttonRef} type="button" class="physics-paint-script-icon-button" aria-label={props.label} title={props.title} disabled={props.disabled} aria-describedby={props.disabledReason ? props.descriptionId : undefined} onClick={props.onClick}>{props.children}</button>;
  if (!props.disabledReason || !props.descriptionId) return button;
  return <span class="physics-paint-script-disabled-control" tabIndex={0} title={props.title} aria-describedby={props.descriptionId}>{button}<span id={props.descriptionId} class="physics-paint-sr-only">{props.disabledReason}</span></span>;
}
