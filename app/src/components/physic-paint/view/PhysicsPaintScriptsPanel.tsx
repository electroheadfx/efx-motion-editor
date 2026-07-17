import { Paintbrush, Pencil, Play, RefreshCw, Save, Trash2 } from 'lucide-preact';
import type { ComponentChildren, Ref } from 'preact';
import { useEffect, useId, useRef } from 'preact/hooks';
import type { RotoScriptLibraryController } from '../roto/physicsPaintRotoScriptLibrary';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';

export interface PhysicsPaintScriptsPanelProps {
  library: RotoScriptLibraryController;
  playScript: RotoPlayScriptController;
  loadAndApplyDisabledReason: string | null;
  onSave: () => void;
  onActivateRow: (id: string) => void;
  onLoadAndApply: () => void;
  onRefresh: () => void;
}

export function PhysicsPaintScriptsPanel({
  library,
  playScript,
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
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const playDialogRef = useRef<HTMLDivElement>(null);
  const playInputRef = useRef<HTMLInputElement>(null);
  const previousPlayConfirmation = useRef(false);
  const saveReasonId = useId();
  const loadAndApplyReasonId = useId();
  const playReasonId = useId();
  useEffect(() => {
    if (confirmation) cancelDeleteRef.current?.focus();
    else if (previousConfirmation.current) deleteButtonRef.current?.focus();
    previousConfirmation.current = Boolean(confirmation);
  }, [confirmation]);
  useEffect(() => {
    if (playScript.confirmationOpen.value) playInputRef.current?.focus();
    else if (previousPlayConfirmation.current) playButtonRef.current?.focus();
    previousPlayConfirmation.current = playScript.confirmationOpen.value;
  }, [playScript.confirmationOpen.value]);
  const stopRowPointerActivation = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const stopRowKeyboardActivation = (event: { key: string; stopPropagation: () => void }) => {
    if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
  };
  return (
    <div class="physics-paint-scripts-panel" role="tabpanel" aria-label="Project Roto scripts">
      <div class="physics-paint-scripts-toolbar" role="toolbar" aria-label="Roto script library actions">
        <IconButton label="Save Script" title={`Save Script — ${availability.saveDisabledReason ?? 'Save the active real Roto frame'}`} disabled={!availability.canSave} disabledReason={availability.saveDisabledReason ?? undefined} descriptionId={saveReasonId} onClick={onSave}><Save size={16} /></IconButton>
        <IconButton label="Load and Apply Script" title={`Load and Apply Script — ${loadAndApplyDisabledReason ?? 'Reload the selected preset and apply it to this Roto frame'}`} disabled={loadAndApplyDisabledReason !== null} disabledReason={loadAndApplyDisabledReason ?? undefined} descriptionId={loadAndApplyReasonId} onClick={onLoadAndApply}><Paintbrush size={16} /></IconButton>
        <IconButton buttonRef={playButtonRef} label="Play Script" title={`Play Script — ${playScript.disabledReason.value ?? 'Generate progressive real Roto keys'}`} disabled={playScript.disabledReason.value !== null} disabledReason={playScript.disabledReason.value ?? undefined} descriptionId={playReasonId} onClick={() => { void playScript.openConfirmation(); }}><Play size={16} /></IconButton>
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
      <p class="physics-paint-scripts-status" aria-live="polite">{playScript.status.value ?? library.status.value}{library.skippedInvalidCount.value ? ` · Skipped ${library.skippedInvalidCount.value} invalid files` : ''}</p>
      {playScript.confirmationOpen.value ? (
        <div ref={playDialogRef} class="physics-paint-script-confirmation physics-paint-play-script-dialog" role="dialog" aria-modal="true" aria-labelledby="physics-play-script-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') { event.preventDefault(); playScript.cancel(); return; }
            if (event.key === 'Enter' && !playScript.validationError.value && !playScript.canCancel.value) { event.preventDefault(); void playScript.confirm(); return; }
            if (event.key !== 'Tab') return;
            const controls = Array.from(playDialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
            if (!controls.length) return;
            const first = controls[0]; const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }}>
          <strong id="physics-play-script-title">Play Script</strong>
          <span>Max {playScript.capacity.value}{playScript.destinationRange.value ? ` · ${playScript.destinationRange.value}` : ''}</span>
          <label for="physics-play-script-count">Frames</label>
          <input ref={playInputRef} id="physics-play-script-count" inputMode="numeric" value={playScript.countText.value} disabled={playScript.canCancel.value} aria-invalid={Boolean(playScript.validationError.value)} aria-describedby="physics-play-script-help physics-play-script-error" onInput={(event) => { playScript.countText.value = (event.currentTarget as HTMLInputElement).value; }} />
          <span id="physics-play-script-help">Enter a positive integer or Max.</span>
          {playScript.validationError.value ? <span id="physics-play-script-error" class="physics-paint-script-inline-error">{playScript.validationError.value}</span> : null}
          {playScript.progress.value ? <progress max={playScript.progress.value.total} value={playScript.progress.value.completed}>{playScript.progress.value.completed}/{playScript.progress.value.total}</progress> : null}
          {playScript.error.value ? <span class="physics-paint-script-inline-error">{playScript.error.value}</span> : null}
          <div>
            <button type="button" onClick={playScript.cancel}>{playScript.canCancel.value ? 'Cancel generation' : 'Cancel'}</button>
            {!playScript.canCancel.value ? <button type="button" disabled={Boolean(playScript.validationError.value)} onClick={() => { void playScript.confirm(); }}>Generate</button> : null}
          </div>
        </div>
      ) : null}
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
