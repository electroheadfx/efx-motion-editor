import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type {
  PhysicPaintActionTransactionPrepareRequest,
  PhysicPaintActionTransactionRecord,
  PhysicPaintActionTransactionResult,
  PhysicPaintLaunchContext,
  PhysicPaintScriptLibraryRequest,
  PhysicPaintScriptLibraryResult,
} from '../../../types/physicPaint';
import { buildPhysicPaintRotoProjectEquality, type PhysicPaintRotoPhysicalDocument } from './physicsPaintRotoPhysicalModel';
import { proposePhysicPaintRotoActionGroupLifecycle, type PhysicPaintRotoActionGroupLifecycleImpact } from './physicsPaintRotoGroupLifecycle';
import { createPersistedRotoScript, normalizeRotoScriptName, persistedRotoScriptToRuntime, type RotoScriptLibraryRow } from './physicsPaintRotoScriptSchema';
import { RotoScriptClipboardReplacementOutcome, type PreparedRotoScriptLoadAndApply, type RotoPaintScript, type RotoScriptPersistenceCapture } from './physicsPaintRotoScriptClipboard';
import type { PersistedRotoScriptThumbnailV1 } from './physicsPaintRotoScriptSchema';

export type ReferencedActionDeletionMode = 'keep-groups' | 'delete-action-and-groups';

export interface ReferencedActionDeletionPorts {
  getPhysicalDocument: (layerId: string) => PhysicPaintRotoPhysicalDocument | null;
  getActionRevision?: (actionId: string) => string | null;
  getAuthority?: () => string | null;
  acquireLease: (projectContextId: string, layerId: string) => string | null;
  releaseLease: (leaseToken: string) => boolean;
  nextUuid: () => string;
  nextGeneration: () => number;
  digest: (value: unknown) => Promise<string>;
  prepare: (authority: string, request: PhysicPaintActionTransactionPrepareRequest) => Promise<PhysicPaintActionTransactionResult>;
  commit: (authority: string, request: PhysicPaintActionTransactionPrepareRequest) => Promise<PhysicPaintActionTransactionResult>;
  settle?: (prepared: Extract<ReferencedActionDeletionPreparation, { ok: true }>) => Readonly<{ ok: boolean; error?: string }>;
  acknowledge?: (authority: string, request: Readonly<{ token: string; commandId: string; generation: number; operationId: string; leaseToken: string; direction: 'forward' }>) => Promise<PhysicPaintActionTransactionResult>;
  transferLeaseToRecovery?: (leaseToken: string) => boolean;
  recoverBeforeAvailability?: (context: PhysicPaintLaunchContext) => Promise<Readonly<{ ok: boolean; error?: string }>>;
}

export type ReferencedActionDeletionPreparation = Readonly<{
  ok: true;
  request: PhysicPaintActionTransactionPrepareRequest;
  impact: PhysicPaintRotoActionGroupLifecycleImpact;
  before: PhysicPaintRotoPhysicalDocument;
  committed: PhysicPaintActionTransactionRecord;
}> | Readonly<{
  ok: false;
  code: 'unavailable' | 'lease-unavailable' | 'stale-authority' | 'invalid-candidate' | 'prepare-failed' | 'commit-failed';
  error: string;
  request?: PhysicPaintActionTransactionPrepareRequest;
}>;

export interface PrepareReferencedActionDeletionInput {
  readonly context: PhysicPaintLaunchContext;
  readonly row: RotoScriptLibraryRow;
  readonly mode: ReferencedActionDeletionMode;
}

export interface RotoScriptLibraryControllerPorts {
  request: (request: PhysicPaintScriptLibraryRequest) => Promise<PhysicPaintScriptLibraryResult>;
  capturePersistence: () => Promise<RotoScriptPersistenceCapture | null>;
  captureThumbnail: (scriptAlphaCanvas: HTMLCanvasElement) => Promise<PersistedRotoScriptThumbnailV1>;
  replaceClipboard: (script: RotoPaintScript, preparation?: PreparedRotoScriptLoadAndApply) => RotoScriptClipboardReplacementOutcome;
  getLaunchContext: () => PhysicPaintLaunchContext | null;
  log: (message: string, error?: boolean) => void;
  readonly referencedActionDeletion?: ReferencedActionDeletionPorts;
}

export interface RotoScriptLibraryAvailability {
  canSave: boolean;
  saveDisabledReason: string | null;
  canLoad: boolean;
  canRename: boolean;
  canDelete: boolean;
}

export interface RotoScriptDeleteAffectedGroup {
  readonly groupId: string;
  readonly name: string;
  readonly placementStart: number;
  readonly endExclusive: number;
  readonly visibleRanges: readonly Readonly<{ start: number; endExclusive: number }>[];
}

export interface RotoScriptDeleteReferenceImpact {
  readonly physicalRevision: string;
  readonly groupCount: number;
  readonly visibleRangeCount: number;
  readonly affectedGroups: readonly RotoScriptDeleteAffectedGroup[];
}

export type RotoScriptDeleteConfirmation = RotoScriptLibraryRow & Readonly<{
  referenceImpact: RotoScriptDeleteReferenceImpact | null;
}>;

type RotoScriptLibraryExecutionResult = PhysicPaintScriptLibraryResult & { stale?: true };

export interface RotoScriptLibraryController {
  rows: Signal<readonly RotoScriptLibraryRow[]>;
  selectedId: Signal<string | null>;
  selected: ReadonlySignal<RotoScriptLibraryRow | null>;
  busy: Signal<boolean>;
  status: Signal<string | null>;
  skippedInvalidCount: Signal<number>;
  rename: Signal<{ id: string; draft: string; error: string | null } | null>;
  deleteConfirmation: Signal<RotoScriptDeleteConfirmation | null>;
  referencedDeleteImpact: Signal<PhysicPaintRotoActionGroupLifecycleImpact | null>;
  transactionPhase: Signal<'idle' | 'preparing' | 'committed' | 'recovery-required'>;
  recoveryReady: Signal<boolean>;
  availability: ReadonlySignal<RotoScriptLibraryAvailability>;
  updateProjectContext: (context: PhysicPaintLaunchContext) => Promise<void>;
  enterScripts: () => Promise<void>;
  refresh: () => Promise<void>;
  saveActiveFrame: () => Promise<boolean>;
  activateAndLoad: (id: string, preparation?: PreparedRotoScriptLoadAndApply) => Promise<boolean>;
  loadSnapshot: (id: string) => Promise<RotoPaintScript | null>;
  beginRename: () => void;
  updateRenameDraft: (draft: string) => void;
  commitRename: () => Promise<boolean>;
  cancelRename: () => void;
  requestDelete: () => void;
  confirmDelete: (mode?: ReferencedActionDeletionMode) => Promise<boolean>;
  cancelDelete: () => void;
  select: (id: string) => void;
  dispose: () => void;
}

export async function prepareReferencedActionDeletion(
  input: PrepareReferencedActionDeletionInput,
  ports: ReferencedActionDeletionPorts,
): Promise<ReferencedActionDeletionPreparation> {
  const project = input.context.project;
  const initialDocument = ports.getPhysicalDocument(input.context.layerId);
  if (!project?.saved || !initialDocument) {
    return { ok: false, code: 'unavailable', error: 'Saved project physical authority is unavailable.' };
  }
  const hasReference = initialDocument.loopClips.some((group) =>
    group.scriptId === input.row.id && group.provenanceState === 'attached');
  if (!hasReference) {
    return { ok: false, code: 'unavailable', error: 'Action has no attached Groups.' };
  }
  const leaseToken = ports.acquireLease(project.contextId, input.context.layerId);
  if (!leaseToken) return { ok: false, code: 'lease-unavailable', error: 'Physical operation lease is unavailable.' };
  const fail = (code: Exclude<ReferencedActionDeletionPreparation, { ok: true }>['code'], error: string) => {
    ports.releaseLease(leaseToken);
    return { ok: false as const, code, error };
  };
  const currentDocument = ports.getPhysicalDocument(input.context.layerId);
  const currentActionRevision = ports.getActionRevision?.(input.row.id) ?? input.row.revision;
  if (!currentDocument
    || currentDocument.revision !== initialDocument.revision
    || currentActionRevision !== input.row.revision) {
    return fail('stale-authority', 'Action or physical authority changed during preflight.');
  }
  const proposed = proposePhysicPaintRotoActionGroupLifecycle({
    document: currentDocument,
    actionId: input.row.id,
    expectedActionRevision: input.row.revision,
    currentActionRevision,
    mode: input.mode === 'keep-groups' ? 'detach' : 'delete',
  });
  if (!proposed.ok) return fail('invalid-candidate', `Referenced Action candidate was rejected: ${proposed.reason}`);

  const commandId = ports.nextUuid();
  const token = ports.nextUuid();
  const generation = ports.nextGeneration();
  const impactDigest = await ports.digest(proposed.impact);
  const request: PhysicPaintActionTransactionPrepareRequest = Object.freeze({
    token,
    commandId,
    generation,
    operationId: `referenced-action-delete-${commandId}`,
    leaseToken,
    direction: 'forward',
    mode: input.mode,
    authority: Object.freeze({
      projectContextId: project.contextId,
      layerId: input.context.layerId,
      launchOperationId: input.context.operationId,
      actionId: input.row.id,
      expectedActionPresent: true,
      expectedActionRevision: input.row.revision,
      expectedPhysicalRevision: currentDocument.revision,
      expectedPhysicalHash: buildPhysicPaintRotoProjectEquality(currentDocument),
    }),
    impactDigest,
    retainedArtifact: Object.freeze({
      commandId,
      generation,
      actionId: input.row.id,
      managedPath: `scripts/${input.row.id}.efx-roto-script.json`,
      originalRevision: input.row.revision,
      integritySha256: input.row.integritySha256,
    }),
    target: Object.freeze({
      physicalRevision: proposed.proposal.revision,
      physicalHash: buildPhysicPaintRotoProjectEquality(proposed.proposal),
      physicalDocument: proposed.proposal,
      selectedGroupId: proposed.proposal.loopClips.some((group) => group.loopId === currentDocument.selectedKeyId)
        ? currentDocument.selectedKeyId
        : null,
      cursorAppFrame: proposed.proposal.cursorAppFrame,
    }),
  });
  const authority = ports.getAuthority?.() ?? project.contextId;
  if (!authority) return fail('unavailable', 'Script library authority is unavailable.');
  const prepared = await ports.prepare(authority, request);
  if (prepared.state !== 'prepared') {
    return fail('prepare-failed', prepared.state === 'failed' ? prepared.error : 'Rust prepare returned an invalid state.');
  }
  const committed = await ports.commit(authority, request);
  if (committed.state !== 'committed') {
    return {
      ok: false,
      code: 'commit-failed',
      error: committed.state === 'failed' ? committed.error : 'Rust commit returned an invalid state.',
      request,
    };
  }
  return Object.freeze({ ok: true, request, impact: proposed.impact, before: currentDocument, committed });
}

export function buildRotoScriptDeleteReferenceImpact(
  document: PhysicPaintRotoPhysicalDocument | null,
  row: RotoScriptLibraryRow,
): RotoScriptDeleteReferenceImpact | null {
  if (!document) return null;
  const affectedGroups = document.loopClips
    .filter((group) => group.scriptId === row.id && group.provenanceState === 'attached' && group.visibleRanges?.length)
    .sort((left, right) => left.placementStart - right.placementStart || left.loopId.localeCompare(right.loopId))
    .map((group) => {
      const visibleRanges = Object.freeze(group.visibleRanges!.map((range) => Object.freeze({
        start: range.start,
        endExclusive: range.endExclusive,
      })));
      return Object.freeze({
        groupId: group.loopId,
        name: `${row.name} Group`,
        placementStart: group.placementStart,
        endExclusive: Math.max(...visibleRanges.map((range) => range.endExclusive)),
        visibleRanges,
      });
    });
  if (!affectedGroups.length) return null;
  return Object.freeze({
    physicalRevision: document.revision,
    groupCount: affectedGroups.length,
    visibleRangeCount: affectedGroups.reduce((total, group) => total + group.visibleRanges.length, 0),
    affectedGroups: Object.freeze(affectedGroups),
  });
}

export function createRotoScriptLibraryController(ports: RotoScriptLibraryControllerPorts): RotoScriptLibraryController {
  const rows = signal<readonly RotoScriptLibraryRow[]>([]);
  const selectedId = signal<string | null>(null);
  const busy = signal(false);
  const status = signal<string | null>(null);
  const skippedInvalidCount = signal(0);
  const rename = signal<{ id: string; draft: string; error: string | null } | null>(null);
  const deleteConfirmation = signal<RotoScriptDeleteConfirmation | null>(null);
  const referencedDeleteImpact = signal<PhysicPaintRotoActionGroupLifecycleImpact | null>(null);
  const transactionPhase = signal<'idle' | 'preparing' | 'committed' | 'recovery-required'>('idle');
  const recoveryReady = signal(!ports.referencedActionDeletion?.recoverBeforeAvailability);
  const projectSaved = signal(Boolean(ports.getLaunchContext()?.project?.saved));
  let disposed = false;
  let contextGeneration = 0;
  let operationGeneration = 0;
  let contextKey = contextIdentity(ports.getLaunchContext());
  let lastAutoHydratedKey: string | null = null;
  let lastRecoveredContextKey: string | null = null;
  const selected = computed(() => rows.value.find((row) => row.id === selectedId.value) ?? null);
  const availability = computed<RotoScriptLibraryAvailability>(() => ({
    canSave: projectSaved.value && recoveryReady.value && !busy.value,
    saveDisabledReason: !projectSaved.value ? 'Save the project first.' : !recoveryReady.value ? 'Recover the pending Action transaction first.' : busy.value ? 'Finish the current script library operation.' : null,
    canLoad: Boolean(selected.value) && recoveryReady.value && !busy.value,
    canRename: Boolean(selected.value) && recoveryReady.value && !busy.value,
    canDelete: Boolean(selected.value) && recoveryReady.value && !busy.value,
  }));

  function contextIdentity(context: PhysicPaintLaunchContext | null): string { return context?.project ? `${context.project.contextId}:${context.layerId}` : 'closed'; }
  function operationId(kind: string): string { return `roto-library-${kind}-${Date.now()}-${crypto.randomUUID()}`; }
  function publishDiagnostics(result: PhysicPaintScriptLibraryResult): void {
    for (const diagnostic of result.diagnostics) ports.log(`${diagnostic.filename ? `${diagnostic.filename}: ` : ''}${diagnostic.message}`, true);
  }
  function publishResult(result: PhysicPaintScriptLibraryResult, preferredId?: string, updateSelection = true): void {
    rows.value = [...result.rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
    skippedInvalidCount.value = result.skippedInvalidCount;
    if (updateSelection) {
      if (preferredId && rows.value.some((row) => row.id === preferredId)) selectedId.value = preferredId;
      else if (selectedId.value && !rows.value.some((row) => row.id === selectedId.value)) selectedId.value = rows.value[0]?.id ?? null;
    }
    publishDiagnostics(result);
  }
  async function execute(request: PhysicPaintScriptLibraryRequest, preferredId?: string, updateSelection = true): Promise<RotoScriptLibraryExecutionResult> {
    if (disposed || busy.peek()) return { operationId: request.operationId, kind: request.kind, ok: false, rows: [...rows.peek()], skippedInvalidCount: skippedInvalidCount.peek(), diagnostics: [], error: 'Finish the current script library operation.' };
    const acceptedContextGeneration = contextGeneration;
    const acceptedOperationGeneration = ++operationGeneration;
    busy.value = true;
    try {
      const result = await ports.request(request);
      if (disposed || acceptedContextGeneration !== contextGeneration || acceptedOperationGeneration !== operationGeneration || result.operationId !== request.operationId || result.kind !== request.kind) {
        const error = 'Script library operation became stale.';
        return { ...result, ok: false, rows: [...rows.peek()], skippedInvalidCount: skippedInvalidCount.peek(), script: undefined, error, stale: true };
      }
      if (!result.ok) {
        publishDiagnostics(result);
        ports.log(result.error ?? `${request.kind} failed`, true);
        return result;
      }
      if (updateSelection) publishResult(result, preferredId, true);
      return result;
    } finally {
      if (!disposed && acceptedOperationGeneration === operationGeneration) busy.value = false;
    }
  }
  function applyContextReset(nextContextKey: string): void {
    contextKey = nextContextKey;
    contextGeneration += 1;
    operationGeneration += 1;
    busy.value = false;
    rows.value = [];
    selectedId.value = null;
    rename.value = null;
    deleteConfirmation.value = null;
    lastAutoHydratedKey = null;
    lastRecoveredContextKey = null;
    recoveryReady.value = !ports.referencedActionDeletion?.recoverBeforeAvailability;
  }
  async function ensureRecovery(context: PhysicPaintLaunchContext): Promise<boolean> {
    const recover = ports.referencedActionDeletion?.recoverBeforeAvailability;
    if (!recover) { recoveryReady.value = true; return true; }
    const key = contextIdentity(context);
    if (lastRecoveredContextKey === key && recoveryReady.peek()) return true;
    recoveryReady.value = false;
    transactionPhase.value = 'recovery-required';
    const recovered = await recover(context);
    if (disposed || key !== contextKey) return false;
    if (!recovered.ok) {
      status.value = recovered.error ?? 'Action transaction recovery failed.';
      ports.log(status.value, true);
      return false;
    }
    lastRecoveredContextKey = key;
    recoveryReady.value = true;
    transactionPhase.value = 'idle';
    return true;
  }
  async function refreshWithContext(context: PhysicPaintLaunchContext | null): Promise<void> {
    if (disposed) return;
    const nextContextKey = contextIdentity(context);
    if (nextContextKey !== contextKey) {
      applyContextReset(nextContextKey);
    }
    const saved = Boolean(context?.project?.saved);
    projectSaved.value = saved;
    if (!projectSaved.value) { operationGeneration += 1; busy.value = false; rows.value = []; selectedId.value = null; skippedInvalidCount.value = 0; rename.value = null; deleteConfirmation.value = null; status.value = null; return; }
    if (!context) return;
    if (ports.referencedActionDeletion?.recoverBeforeAvailability && !await ensureRecovery(context)) return;
    const result = await execute({ kind: 'scan', operationId: operationId('scan') });
    status.value = result.ok ? `Found ${result.rows.length} scripts${result.skippedInvalidCount ? ` · Skipped ${result.skippedInvalidCount} invalid files` : ''}` : result.error ?? 'Refresh failed';
  }
  async function refresh(): Promise<void> {
    await refreshWithContext(ports.getLaunchContext());
  }
  async function updateProjectContext(context: PhysicPaintLaunchContext): Promise<void> {
    if (disposed) return;
    const nextContextKey = contextIdentity(context);
    if (nextContextKey !== contextKey) {
      applyContextReset(nextContextKey);
    }
    projectSaved.value = Boolean(context?.project?.saved);
    if (!projectSaved.value) { operationGeneration += 1; busy.value = false; rows.value = []; selectedId.value = null; skippedInvalidCount.value = 0; rename.value = null; deleteConfirmation.value = null; status.value = null; return; }
    if (lastAutoHydratedKey === contextKey) return;
    if (ports.referencedActionDeletion?.recoverBeforeAvailability && !await ensureRecovery(context)) return;
    lastAutoHydratedKey = contextKey;
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
          background: context.rotoPhysical?.background ?? { background: 'transparent', paperGrain: 'canvas1', grainStrength: 0 },
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
  async function activateAndLoad(id: string, preparation?: PreparedRotoScriptLoadAndApply): Promise<boolean> {
    const row = rows.peek().find((candidate) => candidate.id === id);
    if (!row || busy.peek()) return false;
    const previousSelectedId = selectedId.peek();
    const result = await execute({ kind: 'load', operationId: operationId('load'), scriptId: row.id }, undefined, false);
    if (!result.ok || !result.script) {
      if (result.stale) return false;
      selectedId.value = previousSelectedId;
      status.value = result.error ?? 'Load failed';
      if (result.ok) ports.log(status.value, true);
      return false;
    }
    try {
      const replacement = ports.replaceClipboard(persistedRotoScriptToRuntime(result.script), preparation);
      if (replacement === RotoScriptClipboardReplacementOutcome.Stale) return false;
      if (replacement !== RotoScriptClipboardReplacementOutcome.Replaced) {
        selectedId.value = previousSelectedId;
        status.value = 'Loaded script could not replace the clipboard.';
        ports.log(status.value, true);
        return false;
      }
      publishResult(result, row.id, true);
      const loadedRow = rows.peek().find((candidate) => candidate.id === row.id) ?? row;
      status.value = `Loaded ${loadedRow.name} — ${loadedRow.brushCount} brushes`;
      return true;
    } catch (error) {
      selectedId.value = previousSelectedId;
      const message = String(error);
      status.value = message;
      ports.log(message, true);
      return false;
    }
  }
  async function loadSnapshot(id: string): Promise<RotoPaintScript | null> {
    const row = rows.peek().find((candidate) => candidate.id === id);
    if (!row || busy.peek()) return null;
    const result = await execute({ kind: 'load', operationId: operationId('snapshot'), scriptId: row.id }, undefined, false);
    if (!result.ok || !result.script) {
      status.value = result.error ?? 'Load failed';
      return null;
    }
    try {
      const runtime = persistedRotoScriptToRuntime(result.script);
      return deepFreezeSnapshot(runtime);
    } catch (error) {
      const message = String(error);
      status.value = message;
      ports.log(message, true);
      return null;
    }
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
  async function confirmDelete(mode: ReferencedActionDeletionMode = 'keep-groups'): Promise<boolean> {
    const row = deleteConfirmation.peek(); if (!row) return false;
    const transactionPorts = ports.referencedActionDeletion;
    const context = ports.getLaunchContext();
    const document = context ? transactionPorts?.getPhysicalDocument(context.layerId) ?? null : null;
    const currentImpact = buildRotoScriptDeleteReferenceImpact(document, row);
    const referenced = row.referenceImpact !== null;
    if (referenced && (!currentImpact || currentImpact.physicalRevision !== row.referenceImpact?.physicalRevision)) {
      status.value = 'Action references changed. Review the updated Groups and try again.';
      ports.log(status.value, true);
      return false;
    }
    if (!referenced && currentImpact) {
      status.value = 'Action references changed. Review the affected Groups before deleting.';
      ports.log(status.value, true);
      deleteConfirmation.value = Object.freeze({ ...row, referenceImpact: currentImpact });
      return false;
    }
    if (!referenced || !transactionPorts || !context) {
      const result = await execute({ kind: 'delete', operationId: operationId('delete'), scriptId: row.id, expectedRevision: row.revision });
      deleteConfirmation.value = null; status.value = result.ok ? `Deleted ${row.name}` : result.error ?? 'Delete failed'; return result.ok;
    }
    if (busy.peek()) return false;
    busy.value = true;
    transactionPhase.value = 'preparing';
    try {
      const prepared = await prepareReferencedActionDeletion({ context, row, mode }, transactionPorts);
      if (!prepared.ok) {
        if (prepared.code === 'commit-failed' && prepared.request) {
          transactionPorts.transferLeaseToRecovery?.(prepared.request.leaseToken);
          transactionPhase.value = 'recovery-required';
        } else {
          transactionPhase.value = 'idle';
        }
        status.value = prepared.error;
        ports.log(prepared.error, true);
        return false;
      }
      referencedDeleteImpact.value = prepared.impact;
      transactionPhase.value = 'committed';
      const settled = transactionPorts.settle?.(prepared) ?? { ok: false, error: 'Committed Action settlement port is unavailable.' };
      if (!settled.ok) {
        transactionPorts.transferLeaseToRecovery?.(prepared.request.leaseToken);
        transactionPhase.value = 'recovery-required';
        status.value = settled.error ?? 'Committed Action settlement requires recovery.';
        ports.log(status.value, true);
        return false;
      }
      const authority = transactionPorts.getAuthority?.() ?? context.project?.contextId ?? '';
      const acknowledged = await transactionPorts.acknowledge?.(authority, {
        token: prepared.request.token,
        commandId: prepared.request.commandId,
        generation: prepared.request.generation,
        operationId: prepared.request.operationId,
        leaseToken: prepared.request.leaseToken,
        direction: 'forward',
      });
      if (acknowledged && acknowledged.state !== 'acknowledged') {
        transactionPorts.transferLeaseToRecovery?.(prepared.request.leaseToken);
        transactionPhase.value = 'recovery-required';
      } else {
        transactionPorts.releaseLease(prepared.request.leaseToken);
        transactionPhase.value = 'idle';
      }
      const scanRequest = { kind: 'scan' as const, operationId: operationId('settled-scan') };
      const scan = await ports.request(scanRequest);
      if (!disposed && scan.ok && scan.operationId === scanRequest.operationId && scan.kind === 'scan') {
        publishResult(scan, undefined, true);
      }
      deleteConfirmation.value = null;
      status.value = `Deleted ${row.name}`;
      return true;
    } finally {
      busy.value = false;
    }
  }
  return {
    rows, selectedId, selected, busy, status, skippedInvalidCount, rename, deleteConfirmation,
    referencedDeleteImpact, transactionPhase, recoveryReady, availability,
    updateProjectContext, enterScripts: refresh, refresh, saveActiveFrame, activateAndLoad, loadSnapshot, beginRename, updateRenameDraft, commitRename,
    cancelRename: () => { rename.value = null; }, requestDelete: () => {
      const row = selected.peek();
      if (!row) return;
      const context = ports.getLaunchContext();
      const document = context ? ports.referencedActionDeletion?.getPhysicalDocument(context.layerId) ?? null : null;
      deleteConfirmation.value = Object.freeze({ ...row, referenceImpact: buildRotoScriptDeleteReferenceImpact(document, row) });
    }, confirmDelete,
    cancelDelete: () => { deleteConfirmation.value = null; }, select: (id) => { if (rows.peek().some((row) => row.id === id)) selectedId.value = id; },
    dispose: () => { disposed = true; contextGeneration += 1; operationGeneration += 1; busy.value = false; rows.value = []; selectedId.value = null; rename.value = null; deleteConfirmation.value = null; lastAutoHydratedKey = null; },
  };
}

function deepFreezeSnapshot(script: RotoPaintScript): RotoPaintScript {
  const snapshot: RotoPaintScript = {
    provenance: { ...script.provenance },
    sourceFrame: script.sourceFrame,
    sourceDisplayFrame: script.sourceDisplayFrame,
    sourceRevision: script.sourceRevision,
    brushes: script.brushes.map((brush) => ({
      primary: cloneSnapshotStroke(brush.primary),
      continuations: brush.continuations?.map(cloneSnapshotStroke),
    })),
  };
  Object.freeze(snapshot.provenance);
  for (const brush of snapshot.brushes) {
    for (const point of brush.primary.points) Object.freeze(point);
    Object.freeze(brush.primary.points); Object.freeze(brush.primary.params); Object.freeze(brush.primary);
    for (const continuation of brush.continuations ?? []) {
      Object.freeze(continuation.points); Object.freeze(continuation.params); Object.freeze(continuation);
    }
    if (brush.continuations) Object.freeze(brush.continuations);
    Object.freeze(brush);
  }
  Object.freeze(snapshot.brushes);
  return Object.freeze(snapshot);
}

function cloneSnapshotStroke(stroke: RotoPaintScript['brushes'][number]['primary']) {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })), params: { ...stroke.params } };
}
