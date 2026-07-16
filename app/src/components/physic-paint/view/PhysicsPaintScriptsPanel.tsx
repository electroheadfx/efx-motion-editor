import { Download, FolderOpen, Pencil, RefreshCw, Save, Trash2 } from 'lucide-preact';
import type { ComponentChildren, Ref } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';

export interface PhysicsPaintScriptsPanelProps {
  library: RotoScriptLibraryController;
  onSave: () => void;
  onLoad: () => void;
  onRefresh: () => void;
}

export function PhysicsPaintScriptsPanel({ library, onSave, onLoad, onRefresh }: PhysicsPaintScriptsPanelProps) {
  const rows = library.rows.value;
  const selected = library.selected.value;
  const availability = library.availability.value;
  const rename = library.rename.value;
  const confirmation = library.deleteConfirmation.value;
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const previousConfirmation = useRef(false);
  const saveReasonId = useId();
  const importReasonId = useId();
  useEffect(() => {
    if (confirmation) cancelDeleteRef.current?.focus();
    else if (previousConfirmation.current) deleteButtonRef.current?.focus();
    previousConfirmation.current = Boolean(confirmation);
  }, [confirmation]);
  const moveSelection = (offset: number) => {
    if (!rows.length) return;
    const current = Math.max(0, rows.findIndex((row) => row.id === library.selectedId.value));
    library.select(rows[Math.max(0, Math.min(rows.length - 1, current + offset))].id);
  };
  return (
    <div class="physics-paint-scripts-panel" role="tabpanel" aria-label="Project Roto scripts">
      <div class="physics-paint-scripts-toolbar" role="toolbar" aria-label="Roto script library actions">
        <IconButton label="Save Script" title={`Save Script — ${availability.saveDisabledReason ?? 'Save the active real Roto frame'}`} disabled={!availability.canSave} disabledReason={availability.saveDisabledReason ?? undefined} descriptionId={saveReasonId} onClick={onSave}><Save size={16} /></IconButton>
        <IconButton label="Load Script" title="Load Script — Load the selected preset into Apply Script" disabled={!availability.canLoad} onClick={onLoad}><FolderOpen size={16} /></IconButton>
        <IconButton label="Rename Script" title="Rename Script — Edit the selected preset name" disabled={!availability.canRename} onClick={library.beginRename}><Pencil size={16} /></IconButton>
        <IconButton buttonRef={deleteButtonRef} label="Delete Script" title="Delete Script — Remove the selected project preset" disabled={!availability.canDelete} onClick={library.requestDelete}><Trash2 size={16} /></IconButton>
        <IconButton label="Refresh Scripts" title="Refresh Scripts — Scan the project scripts folder" disabled={library.busy.value} onClick={onRefresh}><RefreshCw size={16} /></IconButton>
        <IconButton label="Import Script" title="Import from another project — coming later" disabled disabledReason="Import from another project — coming later" descriptionId={importReasonId} onClick={() => {}}><Download size={16} /></IconButton>
      </div>
      <div class="physics-paint-scripts-list" role="listbox" aria-label="Saved Roto scripts" tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') { event.preventDefault(); moveSelection(1); }
          else if (event.key === 'ArrowUp') { event.preventDefault(); moveSelection(-1); }
          else if (event.key === 'Home' && rows[0]) { event.preventDefault(); library.select(rows[0].id); }
          else if (event.key === 'End' && rows[rows.length - 1]) { event.preventDefault(); library.select(rows[rows.length - 1].id); }
          else if (event.key === 'Enter' && !rename) onLoad();
          else if (event.key === 'Delete' && !rename && selected) library.requestDelete();
        }}>
        {rows.map((row) => (
          <div key={row.id} role="option" aria-selected={library.selectedId.value === row.id}
            class={`physics-paint-script-row${library.selectedId.value === row.id ? ' selected' : ''}`}>
            <button type="button" class="physics-paint-script-select" aria-label={`Select ${row.name}`} onClick={() => library.select(row.id)}>
              <img class="physics-paint-script-thumbnail" src={row.thumbnail.dataUrl} width={row.thumbnail.width} height={row.thumbnail.height} alt="" />
            </button>
            <span class="physics-paint-script-row-copy">
              {rename?.id === row.id ? (
                <span class="physics-paint-script-rename-wrap">
                  <input autoFocus value={rename.draft} aria-label={`Rename ${row.name}`} onInput={(event) => library.updateRenameDraft((event.currentTarget as HTMLInputElement).value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void library.commitRename(); } else if (event.key === 'Escape') { event.preventDefault(); library.cancelRename(); } }} />
                  {rename.error ? <span class="physics-paint-script-inline-error">{rename.error}</span> : null}
                </span>
              ) : <button type="button" class="physics-paint-script-name" onClick={() => library.select(row.id)}>{row.name}</button>}
              <span class="physics-paint-script-provenance">{row.source.projectName} · {row.source.layerName} · F{row.source.displayFrame}</span>
              <span class="physics-paint-script-count">{row.brushCount} {row.brushCount === 1 ? 'brush' : 'brushes'}</span>
            </span>
          </div>
        ))}
        {!rows.length ? <p class="physics-paint-scripts-empty">No project scripts yet.</p> : null}
      </div>
      <p class="physics-paint-scripts-status" aria-live="polite">{library.status.value}{library.skippedInvalidCount.value ? ` · Skipped ${library.skippedInvalidCount.value} invalid files` : ''}</p>
      {confirmation ? (
        <div class="physics-paint-script-confirmation" role="dialog" aria-modal="true" aria-label={`Delete ${confirmation.name}`}
          onKeyDown={(event) => { if (event.key === 'Escape') { event.preventDefault(); library.cancelDelete(); } }}>
          <strong>Delete “{confirmation.name}”?</strong><span>This removes the project script file and cannot be undone.</span>
          <div><button ref={cancelDeleteRef} type="button" onClick={library.cancelDelete}>Cancel</button><button type="button" class="danger" onClick={() => void library.confirmDelete()}>Delete</button></div>
        </div>
      ) : null}
    </div>
  );
}

function IconButton(props: { buttonRef?: Ref<HTMLButtonElement>; label: string; title: string; disabled?: boolean; disabledReason?: string; descriptionId?: string; onClick: () => void; children: ComponentChildren }) {
  const button = <button ref={props.buttonRef} type="button" class="physics-paint-script-icon-button" aria-label={props.label} title={props.title} disabled={props.disabled} aria-describedby={props.disabledReason ? props.descriptionId : undefined} onClick={props.onClick}>{props.children}</button>;
  if (!props.disabledReason || !props.descriptionId) return button;
  return <span class="physics-paint-script-disabled-control" tabIndex={0} title={props.title} aria-describedby={props.descriptionId}>{button}<span id={props.descriptionId} class="physics-paint-sr-only">{props.disabledReason}</span></span>;
}
