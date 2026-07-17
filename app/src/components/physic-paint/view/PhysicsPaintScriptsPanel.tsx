import { Paintbrush, Pencil, Play, RefreshCw, Save, Trash2 } from 'lucide-preact';
import type { ComponentChildren, Ref } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';

export interface PhysicsPaintScriptsPanelProps {
  library: RotoScriptLibraryController;
  loadAndApplyDisabledReason: string | null;
  onSave: () => void;
  onActivateRow: (id: string) => void;
  onLoadAndApply: () => void;
  onRefresh: () => void;
}

export function PhysicsPaintScriptsPanel({
  library,
  loadAndApplyDisabledReason,
  onSave,
  onActivateRow,
  onLoadAndApply,
  onRefresh,
}: PhysicsPaintScriptsPanelProps) {
  const rows = library.rows.value;
  const availability = library.availability.value;
  const rename = library.rename.value;
  const confirmation = library.deleteConfirmation.value;
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const previousConfirmation = useRef(false);
  const saveReasonId = useId();
  const loadAndApplyReasonId = useId();
  const playReasonId = useId();
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
        <IconButton label="Play Script" title="Script playback is unavailable" disabled disabledReason="Script playback is unavailable" descriptionId={playReasonId}><Play size={16} /></IconButton>
        <IconButton label="Rename Script" title="Rename Script — Edit the selected preset name" disabled={!availability.canRename} onClick={library.beginRename}><Pencil size={16} /></IconButton>
        <IconButton buttonRef={deleteButtonRef} label="Delete Script" title="Delete Script — Remove the selected project preset" disabled={!availability.canDelete} onClick={library.requestDelete}><Trash2 size={16} /></IconButton>
        <IconButton label="Refresh Scripts" title="Refresh Scripts — Scan the project scripts folder" disabled={library.busy.value} onClick={onRefresh}><RefreshCw size={16} /></IconButton>
      </div>
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
              ) : <span class="physics-paint-script-name">{row.name}</span>}
              <span class="physics-paint-script-provenance">{row.source.projectName} · {row.source.layerName} · F{row.source.displayFrame}</span>
              <span class="physics-paint-script-count">{row.brushCount} {row.brushCount === 1 ? 'brush' : 'brushes'}</span>
            </span>
          </div>
        ))}
        {!rows.length ? <p class="physics-paint-scripts-empty">No project scripts yet.</p> : null}
      </div>
      <p class="physics-paint-scripts-status" aria-live="polite">{library.status.value}{library.skippedInvalidCount.value ? ` · Skipped ${library.skippedInvalidCount.value} invalid files` : ''}</p>
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
