import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { PhysicPaintLaunchContext, PhysicPaintScriptLibraryRequest, PhysicPaintScriptLibraryResult } from '../../../types/physicPaint';
import { createPersistedRotoScript, normalizeRotoScriptName, persistedRotoScriptToRuntime, type RotoScriptLibraryRow } from './physicsPaintRotoScriptSchema';
import type { RotoPaintScript, RotoScriptPersistenceCapture } from './physicsPaintRotoScriptClipboard';
import type { PersistedRotoScriptThumbnailV1 } from './physicsPaintRotoScriptSchema';

export interface RotoScriptLibraryControllerPorts {
  request: (request: PhysicPaintScriptLibraryRequest) => Promise<PhysicPaintScriptLibraryResult>;
  capturePersistence: () => Promise<RotoScriptPersistenceCapture | null>;
  captureThumbnail: (scriptAlphaCanvas: HTMLCanvasElement) => Promise<PersistedRotoScriptThumbnailV1>;
  replaceClipboard: (script: RotoPaintScript) => boolean;
  getLaunchContext: () => PhysicPaintLaunchContext | null;
  log: (message: string, error?: boolean) => void;
}

export interface RotoScriptLibraryAvailability {
  canSave: boolean;
  saveDisabledReason: string | null;
  canLoad: boolean;
  canRename: boolean;
  canDelete: boolean;
}

export interface RotoScriptLibraryController {
  rows: Signal<readonly RotoScriptLibraryRow[]>;
  selectedId: Signal<string | null>;
  selected: ReadonlySignal<RotoScriptLibraryRow | null>;
  busy: Signal<boolean>;
  status: Signal<string | null>;
  skippedInvalidCount: Signal<number>;
  rename: Signal<{ id: string; draft: string; error: string | null } | null>;
  deleteConfirmation: Signal<RotoScriptLibraryRow | null>;
  availability: ReadonlySignal<RotoScriptLibraryAvailability>;
  updateProjectContext: () => Promise<void>;
  enterScripts: () => Promise<void>;
  refresh: () => Promise<void>;
  saveActiveFrame: () => Promise<boolean>;
  loadSelected: () => Promise<boolean>;
  beginRename: () => void;
  updateRenameDraft: (draft: string) => void;
  commitRename: () => Promise<boolean>;
  cancelRename: () => void;
  requestDelete: () => void;
  confirmDelete: () => Promise<boolean>;
  cancelDelete: () => void;
  select: (id: string) => void;
  dispose: () => void;
}

export function createRotoScriptLibraryController(ports: RotoScriptLibraryControllerPorts): RotoScriptLibraryController {
  const rows = signal<readonly RotoScriptLibraryRow[]>([]);
  const selectedId = signal<string | null>(null);
  const busy = signal(false);
  const status = signal<string | null>(null);
  const skippedInvalidCount = signal(0);
  const rename = signal<{ id: string; draft: string; error: string | null } | null>(null);
  const deleteConfirmation = signal<RotoScriptLibraryRow | null>(null);
  const projectSaved = signal(Boolean(ports.getLaunchContext()?.project?.saved));
  let disposed = false;
  let contextGeneration = 0;
  let operationGeneration = 0;
  let contextKey = contextIdentity(ports.getLaunchContext());
  const selected = computed(() => rows.value.find((row) => row.id === selectedId.value) ?? null);
  const availability = computed<RotoScriptLibraryAvailability>(() => ({
    canSave: projectSaved.value && !busy.value,
    saveDisabledReason: !projectSaved.value ? 'Save the project first.' : busy.value ? 'Finish the current script library operation.' : null,
    canLoad: Boolean(selected.value) && !busy.value,
    canRename: Boolean(selected.value) && !busy.value,
    canDelete: Boolean(selected.value) && !busy.value,
  }));

  function contextIdentity(context: PhysicPaintLaunchContext | null): string { return context?.project ? `${context.project.contextId}:${context.layerId}` : 'closed'; }
  function operationId(kind: string): string { return `roto-library-${kind}-${Date.now()}-${crypto.randomUUID()}`; }
  function publishResult(result: PhysicPaintScriptLibraryResult, preferredId?: string): void {
    rows.value = [...result.rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    skippedInvalidCount.value = result.skippedInvalidCount;
    if (preferredId && rows.value.some((row) => row.id === preferredId)) selectedId.value = preferredId;
    else if (selectedId.value && !rows.value.some((row) => row.id === selectedId.value)) selectedId.value = rows.value[0]?.id ?? null;
    for (const diagnostic of result.diagnostics) ports.log(`${diagnostic.filename ? `${diagnostic.filename}: ` : ''}${diagnostic.message}`, true);
  }
  async function execute(request: PhysicPaintScriptLibraryRequest, preferredId?: string): Promise<PhysicPaintScriptLibraryResult> {
    if (disposed || busy.peek()) return { operationId: request.operationId, kind: request.kind, ok: false, rows: [...rows.peek()], skippedInvalidCount: skippedInvalidCount.peek(), diagnostics: [], error: 'Finish the current script library operation.' };
    const acceptedContextGeneration = contextGeneration;
    const acceptedOperationGeneration = ++operationGeneration;
    busy.value = true;
    try {
      const result = await ports.request(request);
      if (disposed || acceptedContextGeneration !== contextGeneration || acceptedOperationGeneration !== operationGeneration || result.operationId !== request.operationId || result.kind !== request.kind) return result;
      publishResult(result, preferredId);
      if (!result.ok) ports.log(result.error ?? `${request.kind} failed`, true);
      return result;
    } finally {
      if (!disposed && acceptedOperationGeneration === operationGeneration) busy.value = false;
    }
  }
  async function refresh(): Promise<void> {
    if (disposed) return;
    const context = ports.getLaunchContext();
    const nextContextKey = contextIdentity(context);
    if (nextContextKey !== contextKey) {
      contextKey = nextContextKey;
      contextGeneration += 1;
      operationGeneration += 1;
      busy.value = false;
      rows.value = [];
      selectedId.value = null;
      rename.value = null;
      deleteConfirmation.value = null;
    }
    const saved = Boolean(context?.project?.saved);
    projectSaved.value = saved;
    if (!projectSaved.value) { operationGeneration += 1; busy.value = false; rows.value = []; selectedId.value = null; skippedInvalidCount.value = 0; rename.value = null; deleteConfirmation.value = null; status.value = null; return; }
    const result = await execute({ kind: 'scan', operationId: operationId('scan') });
    status.value = result.ok ? `Found ${result.rows.length} scripts${result.skippedInvalidCount ? ` · Skipped ${result.skippedInvalidCount} invalid files` : ''}` : result.error ?? 'Refresh failed';
  }
  async function saveActiveFrame(): Promise<boolean> {
    const context = ports.getLaunchContext();
    if (!context?.project?.saved) { status.value = 'Save the project first.'; return false; }
    if (busy.peek()) return false;
    const acceptedContextGeneration = contextGeneration;
    const captured = await ports.capturePersistence();
    if (disposed || acceptedContextGeneration !== contextGeneration) return false;
    if (!captured) { status.value = 'Paint at least one brush on a real Roto key.'; return false; }
    try {
      const thumbnail = await ports.captureThumbnail(captured.scriptAlphaCanvas);
      if (disposed || acceptedContextGeneration !== contextGeneration) return false;
      const scriptSnapshot = captured.script;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const base = `${context.project.name}-${context.layerName ?? context.layerId}-${scriptSnapshot.sourceDisplayFrame}`;
      const existing = new Set(rows.peek().map((row) => row.name));
      let name = base;
      for (let suffix = 2; existing.has(name); suffix += 1) name = `${base}-${suffix}`;
      const script = createPersistedRotoScript({
        id, name, createdAt: now, updatedAt: now,
        source: {
          projectName: context.project.name, layerId: context.layerId, layerName: context.layerName ?? context.layerId,
          sourceFrame: scriptSnapshot.sourceFrame, displayFrame: scriptSnapshot.sourceDisplayFrame,
          width: context.width ?? 1000, height: context.height ?? 650,
          background: context.rotoBackground ?? { background: 'transparent', paperGrain: 'canvas1', grainStrength: 0 },
        },
        thumbnail, brushes: scriptSnapshot.brushes,
      });
      const result = await execute({ kind: 'save', operationId: operationId('save'), script }, id);
      status.value = result.ok ? `Saved ${name}` : result.error ?? 'Save failed';
      return result.ok;
    } catch (error) {
      const message = String(error);
      status.value = message;
      ports.log(message, true);
      return false;
    }
  }
  async function loadSelected(): Promise<boolean> {
    const row = selected.peek(); if (!row) return false;
    const result = await execute({ kind: 'load', operationId: operationId('load'), scriptId: row.id }, row.id);
    if (!result.ok || !result.script) { status.value = result.error ?? 'Load failed'; return false; }
    const loaded = ports.replaceClipboard(persistedRotoScriptToRuntime(result.script));
    status.value = loaded ? `Loaded ${row.name} — ${row.brushCount} brushes` : 'Loaded script could not replace the clipboard.';
    return loaded;
  }
  function beginRename(): void { const row = selected.peek(); if (row) rename.value = { id: row.id, draft: row.name, error: null }; }
  function updateRenameDraft(draft: string): void { if (rename.peek()) rename.value = { ...rename.peek()!, draft, error: null }; }
  async function commitRename(): Promise<boolean> {
    const edit = rename.peek(); if (!edit) return false;
    const name = normalizeRotoScriptName(edit.draft);
    if (!name) { rename.value = { ...edit, error: 'Enter a valid name.' }; return false; }
    if (rows.peek().some((row) => row.id !== edit.id && row.name.normalize('NFC') === name.normalize('NFC'))) { rename.value = { ...edit, error: 'Name already exists.' }; return false; }
    const row = rows.peek().find((candidate) => candidate.id === edit.id);
    if (!row) return false;
    const result = await execute({ kind: 'rename', operationId: operationId('rename'), scriptId: edit.id, expectedRevision: row.revision, name }, edit.id);
    if (!result.ok) { rename.value = { ...edit, error: result.error ?? 'Rename failed.' }; return false; }
    rename.value = null; status.value = `Renamed ${name}`; return true;
  }
  async function confirmDelete(): Promise<boolean> {
    const row = deleteConfirmation.peek(); if (!row) return false;
    const result = await execute({ kind: 'delete', operationId: operationId('delete'), scriptId: row.id, expectedRevision: row.revision });
    deleteConfirmation.value = null; status.value = result.ok ? `Deleted ${row.name}` : result.error ?? 'Delete failed'; return result.ok;
  }
  return {
    rows, selectedId, selected, busy, status, skippedInvalidCount, rename, deleteConfirmation, availability,
    updateProjectContext: refresh, enterScripts: refresh, refresh, saveActiveFrame, loadSelected, beginRename, updateRenameDraft, commitRename,
    cancelRename: () => { rename.value = null; }, requestDelete: () => { deleteConfirmation.value = selected.peek(); }, confirmDelete,
    cancelDelete: () => { deleteConfirmation.value = null; }, select: (id) => { if (rows.peek().some((row) => row.id === id)) selectedId.value = id; },
    dispose: () => { disposed = true; contextGeneration += 1; operationGeneration += 1; busy.value = false; rows.value = []; selectedId.value = null; rename.value = null; deleteConfirmation.value = null; },
  };
}
