import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import { TIP_MASK_BYTES, asTipRecord, type AquarelleTip } from '@efxlab/efx-watercolor';
import type {
  PhysicPaintActionTransactionPrepareRequest,
  PhysicPaintActionTransactionRecord,
  PhysicPaintActionTransactionResult,
  PhysicPaintLaunchContext,
  PhysicPaintScriptLibraryRequest,
  PhysicPaintProjectContextLayer,
  PhysicPaintScriptLibraryResult,
} from '../../../types/physicPaint';
import { ROTO_SCRIPT_SCOPE_ALL } from './physicsPaintRotoScriptScope';
import { buildPhysicPaintRotoProjectEquality, type PhysicPaintRotoPhysicalDocument } from './physicsPaintRotoPhysicalModel';
import { getCarriedRotoPhysical } from './rotoLaunchHydration';
import { proposePhysicPaintRotoActionGroupLifecycle, type PhysicPaintRotoActionGroupLifecycleImpact } from './physicsPaintRotoGroupLifecycle';
import {
  decodeScriptMaskDataUrl,
  isRefusedRotoScriptRow,
  normalizeRotoScriptName,
  parseRotoScript,
  persistedRotoScriptToRuntime,
  serializeAquarelleRotoScript,
  type PersistedRotoScriptAnyV1,
  type RotoScriptLibraryRow,
} from './physicsPaintRotoScriptSchema';
import { brushCatalogSynced, customBrushTips, registerScriptMask, unavailableTipIds } from '../../../stores/aquarelleBrushCatalog';
import { isAquarelleDryEvent, type AquarellePayloadEvent } from '@efxlab/efx-watercolor/payload';
import {
  ipcEfxPaintDecodeBrushMask,
  type EfxPaintBrushMaskDecodeResult,
  type EfxPaintMediaFailure,
  type Result,
} from '../../../lib/ipc';
import { RotoScriptClipboardReplacementOutcome, type PreparedRotoScriptLoadAndApply, type RotoPaintScript, type RotoScriptPersistenceCapture } from './physicsPaintRotoScriptClipboard';
import type { PersistedRotoScriptThumbnailV1 } from './physicsPaintRotoScriptSchema';
import type { RotoScriptThumbnailComposite } from './physicsPaintRotoScriptThumbnail';

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
  /**
   * 261026-nvq: `composite` tells the encoder how the source composites over
   * the thumbnail's paper. Aquarelle sheets are opaque transmittance and pass
   * 'multiply'; engine-1 alpha canvases pass (or omit) 'source-over'.
   */
  captureThumbnail: (scriptAlphaCanvas: HTMLCanvasElement, composite?: RotoScriptThumbnailComposite) => Promise<PersistedRotoScriptThumbnailV1>;
  replaceClipboard: (script: RotoPaintScript, preparation?: PreparedRotoScriptLoadAndApply) => RotoScriptClipboardReplacementOutcome;
  getLaunchContext: () => PhysicPaintLaunchContext | null;
  log: (message: string, error?: boolean) => void;
  /**
   * quick-260922-al1: the OUTBOUND half of the layer-scope round trip — the
   * ONLY place a user scope choice leaves this realm. `setScriptScope` calls it
   * exactly once per accepted change and nothing else calls it, so the loop is
   * one-directional by construction: choice → port → main stores + republishes
   * → `updateProjectContext` writes both signals DIRECTLY (never back through
   * this port) → stop. A port that fed the inbound hydrate would be a signal
   * write reacting to a signal it wrote — the OOM shape this repo has already
   * been bitten by.
   */
  publishScriptScope: (scope: string) => void;
  /**
   * 63-08 / TIP-14: register a loaded script's inline brush masks into THIS
   * realm's engine registry. Optional — the default calls
   * `registerScriptBrushMasks` against the real native decode boundary, so
   * production needs no extra wiring; the unit harness injects it.
   */
  registerScriptMasks?: (script: PersistedRotoScriptAnyV1) => Promise<void>;
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
  deleteError: Signal<string | null>;
  referencedDeleteImpact: Signal<PhysicPaintRotoActionGroupLifecycleImpact | null>;
  transactionPhase: Signal<'idle' | 'preparing' | 'committed' | 'recovery-required'>;
  recoveryReady: Signal<boolean>;
  actionMutationDisabledReason: ReadonlySignal<string | null>;
  availability: ReadonlySignal<RotoScriptLibraryAvailability>;
  /** quick-260922-al1: the Scripts-panel filter value — `'all'` or a LIVE layer id. */
  scriptScope: Signal<string>;
  /** quick-260922-al1: the live physic-paint layers the panel's filter and provenance read. */
  scriptLayers: Signal<readonly PhysicPaintProjectContextLayer[]>;
  /** quick-260922-al1: the OUTBOUND edge — stores, then publishes. Never touches rows or selection. */
  setScriptScope: (scope: string) => void;
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
    return { ok: false, code: 'unavailable', error: 'Script has no attached Groups.' };
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
    return fail('stale-authority', 'Script or physical authority changed during preflight.');
  }
  const proposed = proposePhysicPaintRotoActionGroupLifecycle({
    document: currentDocument,
    actionId: input.row.id,
    expectedActionRevision: input.row.revision,
    currentActionRevision,
    mode: input.mode === 'keep-groups' ? 'detach' : 'delete',
  });
  if (!proposed.ok) return fail('invalid-candidate', `Referenced Script candidate was rejected: ${proposed.reason}`);

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

function mapReferencedActionDeleteError(
  code: 'unavailable' | 'lease-unavailable' | 'stale-authority' | 'invalid-candidate' | 'prepare-failed' | 'commit-failed',
): string {
  if (code === 'lease-unavailable') return 'Another Group operation is in progress. Nothing changed. Try again when it finishes.';
  if (code === 'stale-authority' || code === 'invalid-candidate') {
    return 'Script or Rail references changed. Nothing changed. Review the affected Rails and try again.';
  }
  if (code === 'commit-failed') return 'Recovery is required before another Script change. Accepted Scripts and Groups remain unchanged.';
  return 'Couldn’t delete this Script. Nothing changed. Review the affected Groups and try again.';
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

// ---------------------------------------------------------------------------
// 63-08 / TIP-14 / D-14: the script brush carrier.
//
// A script cannot reference another project's package asset, so each CUSTOM
// tip travels with its mask inline as a WebP data URL. The save leg copies the
// bytes the STUDIO realm already holds; the load leg decodes them back into
// the engine registry — never into the project catalog.
// ---------------------------------------------------------------------------

/** A script-carrier brush entry: a CUSTOM tip plus its inline mask data URL. */
export type ScriptBrushTipEntry = AquarelleTip & { readonly maskDataUrl: string };

export type ScriptBrushEntryBuild =
  | {
    readonly ok: true;
    readonly entries: readonly ScriptBrushTipEntry[];
    /** Ids the open already reported unavailable; skipped, never refused (WR-02). */
    readonly unavailableSkipped: readonly string[];
  }
  | { readonly ok: false; readonly reason: string };

/**
 * Build the script carrier's `brushPack` entries from the machine library
 * rows. quick 261116-inu: the cross-realm payload no longer carries stored
 * WebP bodies (the library owns the files), so this realm has no inline mask
 * bytes to stamp. Until the next task makes the carrier metadata-only, the
 * row keeps its tip metadata with an empty carrier — the schema's own guard
 * then refuses to persist a maskless entry rather than writing a script that
 * silently paints fallbacks elsewhere.
 *
 * WR-02 / T-63-29: a tip the library already reported unavailable degrades
 * alone — it is skipped and its id returned in `unavailableSkipped` so the
 * caller can log it.
 */
export function buildScriptBrushEntries(): ScriptBrushEntryBuild {
  const entries: ScriptBrushTipEntry[] = [];
  const unavailableSkipped: string[] = [];
  for (const tip of customBrushTips.value) {
    if (unavailableTipIds.value.has(tip.id)) {
      unavailableSkipped.push(tip.id);
      continue;
    }
    entries.push({ ...tip, maskDataUrl: '' });
  }
  return { ok: true, entries, unavailableSkipped };
}

/**
 * WR-03 / T-63-28 (quick-261115-oh9): the custom ids a capture actually
 * PAINTS, unique and in first-seen order. Both axes are read from the engine
 * slot — never the top-level `brushId`, which `serializeAquarelleRotoScript`
 * stamps with the engine id:
 *   · `engine.brushId`   the RESPONSE id (a custom catalog tip, when custom)
 *   · `engine.textureId` the TEXTURE mask id, when the stroke names one
 * A custom TEXTURE must travel exactly like a custom response tip — the same
 * inline-mask carrier. Built-in textures (`wc/builtin-*`) ship with the app,
 * so they are never reported and can never block a save. Dry events carry no
 * ids; preset and built-in response ids are ignored.
 */
export function referencedCustomBrushIds(events: readonly AquarellePayloadEvent[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const collect = (id: string | undefined): void => {
    if (id === undefined || !id.startsWith('wc/custom-') || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  for (const event of events) {
    if (isAquarelleDryEvent(event)) continue;
    collect(event.engine.brushId);
    collect(event.engine.textureId);
  }
  return ids;
}

/** The injectable seams of the load leg's mask registration. */
export interface ScriptBrushMaskPorts {
  decode: (webp: Uint8Array) => Promise<Result<EfxPaintBrushMaskDecodeResult, EfxPaintMediaFailure>>;
  register: (id: string, mask: Uint8Array) => boolean;
  log: (message: string, error?: boolean) => void;
}

const SCRIPT_BRUSH_MASK_PORTS: ScriptBrushMaskPorts = {
  decode: ipcEfxPaintDecodeBrushMask,
  register: registerScriptMask,
  log: () => {},
};

/**
 * Register a loaded script's inline masks into THIS realm's engine registry
 * (63-08 / TIP-14 / D-14 / T-63-23). Registry only — a script's tips must
 * never become project catalog rows, and the next open or close resets the
 * registry wholesale, so nothing a script registers survives a switch.
 *
 * Total and per-entry isolated: a malformed entry, an undecodable payload, a
 * wrong-size mask or a refused registration each skip THAT entry with a named
 * log and never abort the script's activation. Re-parses the document so it is
 * safe to call directly on a wire value. Returns how many masks became live
 * paint state.
 */
export async function registerScriptBrushMasks(
  document: PersistedRotoScriptAnyV1,
  overrides: Partial<ScriptBrushMaskPorts> = {},
): Promise<number> {
  const ports: ScriptBrushMaskPorts = { ...SCRIPT_BRUSH_MASK_PORTS, ...overrides };
  const parsed = parseRotoScript(document);
  if (!parsed.ok) return 0;
  let registered = 0;
  for (const raw of parsed.document.brushPack.entries) {
    const tip = asTipRecord(raw);
    if (tip === null) {
      ports.log('Script brush entry is malformed — skipped.', true);
      continue;
    }
    const webp = decodeScriptMaskDataUrl((raw as Record<string, unknown>).maskDataUrl);
    if (webp === null) {
      ports.log(`Script tip "${tip.id}" carries no valid mask data URL — skipped.`, true);
      continue;
    }
    let decoded: Result<EfxPaintBrushMaskDecodeResult, EfxPaintMediaFailure>;
    try {
      decoded = await ports.decode(webp);
    } catch (error) {
      // A rejected native seam is a bad mask, not a dead script: isolate it.
      ports.log(`Script tip "${tip.id}" mask could not be decoded — skipped (${String(error)}).`, true);
      continue;
    }
    if (!decoded.ok) {
      ports.log(`Script tip "${tip.id}" mask could not be decoded — skipped.`, true);
      continue;
    }
    if (decoded.data.mask.length !== TIP_MASK_BYTES) {
      ports.log(`Script tip "${tip.id}" mask has the wrong size — skipped.`, true);
      continue;
    }
    if (!ports.register(tip.id, decoded.data.mask)) {
      ports.log(`Script tip "${tip.id}" mask was refused by the registry — skipped.`, true);
      continue;
    }
    registered += 1;
  }
  return registered;
}

export function createRotoScriptLibraryController(ports: RotoScriptLibraryControllerPorts): RotoScriptLibraryController {
  const rows = signal<readonly RotoScriptLibraryRow[]>([]);
  const selectedId = signal<string | null>(null);
  const busy = signal(false);
  const status = signal<string | null>(null);
  const skippedInvalidCount = signal(0);
  const rename = signal<{ id: string; draft: string; error: string | null } | null>(null);
  const deleteConfirmation = signal<RotoScriptDeleteConfirmation | null>(null);
  const deleteError = signal<string | null>(null);
  const referencedDeleteImpact = signal<PhysicPaintRotoActionGroupLifecycleImpact | null>(null);
  const transactionPhase = signal<'idle' | 'preparing' | 'committed' | 'recovery-required'>('idle');
  const recoveryReady = signal(!ports.referencedActionDeletion?.recoverBeforeAvailability);
  const projectSaved = signal(Boolean(ports.getLaunchContext()?.project?.saved));
  // quick-260922-al1: the child-realm half of the Scripts-panel scope. Both are
  // INBOUND-only (written by updateProjectContext) except for scriptScope's one
  // OUTBOUND user edge (setScriptScope). `scriptLayers` is [] until the first
  // project-context payload lands, which renders exactly the pre-al1 All-only
  // panel with snapshotted provenance — a degraded render, never a crash.
  const scriptScope = signal<string>(ROTO_SCRIPT_SCOPE_ALL);
  const scriptLayers = signal<readonly PhysicPaintProjectContextLayer[]>([]);
  /** The project identity the scope state belongs to; a CHANGE is a project rotation. */
  let lastSeenContextId: string | null = ports.getLaunchContext()?.project?.contextId ?? null;
  let disposed = false;
  let contextGeneration = 0;
  let operationGeneration = 0;
  let contextKey = contextIdentity(ports.getLaunchContext());
  let lastAutoHydratedKey: string | null = null;
  let lastRecoveredContextKey: string | null = null;
  const selected = computed(() => rows.value.find((row) => row.id === selectedId.value) ?? null);
  const actionMutationDisabledReason = computed<string | null>(() => {
    if (!recoveryReady.value || transactionPhase.value === 'recovery-required') {
      return 'Recover the pending Script change before starting another operation.';
    }
    if (busy.value || transactionPhase.value === 'preparing' || transactionPhase.value === 'committed') {
      return 'Finish the current Script operation.';
    }
    return null;
  });
  const availability = computed<RotoScriptLibraryAvailability>(() => {
    // D-16: a refused (clean-break) row stays listed and deletable, but is not
    // loadable — the format refuses to parse, and deletion is the user's action.
    const row = selected.value;
    const refused = row ? isRefusedRotoScriptRow(row) : false;
    return {
      canSave: projectSaved.value && actionMutationDisabledReason.value === null,
      saveDisabledReason: !projectSaved.value ? 'Save the project first.' : actionMutationDisabledReason.value,
      canLoad: Boolean(row) && !refused && actionMutationDisabledReason.value === null,
      canRename: Boolean(row) && !refused && actionMutationDisabledReason.value === null,
      canDelete: Boolean(row) && actionMutationDisabledReason.value === null,
    };
  });

  /**
   * 63-08 / TIP-14: the load leg's mask registration. The default routes to
   * `registerScriptBrushMasks` against the real native decode boundary, so
   * production needs no extra wiring; the harness overrides it. The explicit
   * async arrow keeps the port's `Promise<void>` shape (the helper counts).
   */
  const registerLoadedScriptMasks = ports.registerScriptMasks
    ?? (async (script: PersistedRotoScriptAnyV1) => {
      await registerScriptBrushMasks(script, { log: ports.log });
    });

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
  /**
   * quick-260922-al1: the OUTBOUND edge of the layer-scope round trip, and the
   * only one. Idempotent by explicit compare-then-write: a repeat of the stored
   * value returns before the signal write AND before the port call, so it can
   * neither notify a subscriber nor emit a redundant request. It publishes —
   * it never refreshes, never selects and never touches a row: the filter is
   * presentation-only, so a hidden Action stays selectable and applicable.
   */
  function setScriptScope(scope: string): void {
    if (scriptScope.peek() === scope) return;
    scriptScope.value = scope;
    ports.publishScriptScope(scope);
  }

  /**
   * quick-260922-al1: the INBOUND hop — the FINAL leg of the round trip, and
   * the reason the loop terminates. It writes `scriptLayers`/`scriptScope`
   * DIRECTLY and must NEVER route through `setScriptScope`: that function is
   * the outbound port, so reusing it here would let the inbound write re-emit
   * the request that produced it. Round trip: artist picks a scope → outbound
   * port → main stores + republishes → this function writes the signals → stop.
   * No effect reacts to a signal this function writes.
   *
   * A project-identity CHANGE (open / close / new) is the only reset trigger.
   * The layer identity is deliberately NOT part of it: a Studio layer switch
   * re-boots the child, and the locked decision is that the artist's scope
   * survives it.
   */
  function hydrateProjectContext(context: PhysicPaintLaunchContext | null | undefined): void {
    const contextId = context?.project?.contextId ?? null;
    if (contextId !== lastSeenContextId) {
      lastSeenContextId = contextId;
      if (scriptScope.peek() !== ROTO_SCRIPT_SCOPE_ALL) scriptScope.value = ROTO_SCRIPT_SCOPE_ALL;
      if (scriptLayers.peek().length) scriptLayers.value = [];
    }
    const layers = context?.project?.layers ?? [];
    if (scriptLayers.peek() !== layers) scriptLayers.value = layers;
    const scope = context?.project?.scriptScope;
    if (typeof scope === 'string' && scriptScope.peek() !== scope) scriptScope.value = scope;
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
    deleteError.value = null;
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
      status.value = recovered.error ?? 'Script transaction recovery failed.';
      ports.log(status.value, true);
      return false;
    }
    lastRecoveredContextKey = key;
    recoveryReady.value = true;
    transactionPhase.value = 'idle';
    deleteError.value = null;
    deleteConfirmation.value = null;
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
    if (!projectSaved.value) { operationGeneration += 1; busy.value = false; rows.value = []; selectedId.value = null; skippedInvalidCount.value = 0; rename.value = null; deleteConfirmation.value = null; deleteError.value = null; status.value = null; return; }
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
    // quick-260922-al1: the inbound hop runs BEFORE every early return below —
    // the layer list and the stored scope are panel state, not library state,
    // so an unlocked project or a repeat context must still land them (only the
    // SCAN is once-per-context). See hydrateProjectContext for the loop
    // termination contract.
    hydrateProjectContext(context);
    const nextContextKey = contextIdentity(context);
    if (nextContextKey !== contextKey) {
      applyContextReset(nextContextKey);
    }
    projectSaved.value = Boolean(context?.project?.saved);
    if (!projectSaved.value) { operationGeneration += 1; busy.value = false; rows.value = []; selectedId.value = null; skippedInvalidCount.value = 0; rename.value = null; deleteConfirmation.value = null; deleteError.value = null; status.value = null; return; }
    if (lastAutoHydratedKey === contextKey) return;
    if (ports.referencedActionDeletion?.recoverBeforeAvailability && !await ensureRecovery(context)) return;
    lastAutoHydratedKey = contextKey;
    const result = await execute({ kind: 'scan', operationId: operationId('scan') });
    status.value = result.ok ? `Found ${result.rows.length} scripts${result.skippedInvalidCount ? ` · Skipped ${result.skippedInvalidCount} invalid files` : ''}` : result.error ?? 'Refresh failed';
  }
  async function saveActiveFrame(): Promise<boolean> {
    const context = ports.getLaunchContext();
    // Every exit reports through ports.log (the rendered applyMessage channel).
    // `status` alone has no reader in the panel, so a failure used to look like
    // a dead button.
    const fail = (message: string): false => { status.value = message; ports.log(message, true); return false; };
    if (!context?.project?.saved) return fail('Save the project first.');
    if (busy.peek()) return fail('Finish the current Script operation.');
    const acceptedContextGeneration = contextGeneration;
    try {
      // Inside the try: a rejection here (or from thumbnail capture) must reach
      // the catch's ports.log, not escape into `void onSave` and vanish.
      const captured = await ports.capturePersistence();
      if (disposed || acceptedContextGeneration !== contextGeneration) return fail('Save cancelled — the project context changed.');
      if (!captured) return fail('Paint at least one brush on a real Roto key.');
      // 261026-nvq: aquarelle captures carry the live wash sheet — the engine-1
      // canvas holds only the invisible guide proxies. The sheet is opaque
      // transmittance and multiplies over the paper (same law as the live seam).
      const thumbnailSource = captured.aquarelleAlphaCanvas ?? captured.scriptAlphaCanvas;
      const thumbnailComposite: RotoScriptThumbnailComposite = captured.aquarelleAlphaCanvas ? 'multiply' : 'source-over';
      const thumbnail = await ports.captureThumbnail(thumbnailSource, thumbnailComposite);
      if (disposed || acceptedContextGeneration !== contextGeneration) return fail('Save cancelled — the project context changed.');
      const scriptSnapshot = captured.script;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const base = `${context.project.name}-${context.layerName ?? context.layerId}-${scriptSnapshot.sourceDisplayFrame}`;
      const existing = new Set(rows.peek().map((row) => row.name));
      let name = base;
      for (let suffix = 2; existing.has(name); suffix += 1) name = `${base}-${suffix}`;
      const sourceBag = {
        projectName: context.project.name, layerId: context.layerId, layerName: context.layerName ?? context.layerId,
        sourceFrame: scriptSnapshot.sourceFrame, displayFrame: scriptSnapshot.sourceDisplayFrame,
        width: context.width ?? 1000, height: context.height ?? 650,
        background: getCarriedRotoPhysical(context)?.background ?? { background: 'transparent', grainStrength: 0 },
      };
      // 261027-klx: watercolor is the only engine, so every persisted script is
      // the efx-watercolor envelope. A capture without an aquarelle timeline has
      // no persistable payload — report it instead of writing a half-document.
      if (!scriptSnapshot.aquarelleEvents) return fail('This script has no Water color timeline to save.');
      // 63-08 / TIP-14 / D-14: the painted CUSTOM tips travel INSIDE the script
      // as inline mask data URLs. A tip whose stored bytes this realm never
      // received refuses the save by name — dropping its mask would write a
      // script that silently paints that tip with the neutral fallback.
      const referenced = referencedCustomBrushIds(scriptSnapshot.aquarelleEvents);
      const build = buildScriptBrushEntries();
      if (!build.ok) return fail(build.reason);
      // WR-02 / T-63-29: an unavailable tip costs ONE entry, logged by name —
      // the open already knows it cannot travel, so it never blocks a save.
      if (build.unavailableSkipped.length > 0) {
        const ids = build.unavailableSkipped.map((id) => `"${id}"`).join(', ');
        ports.log(
          `Save: brush tip${build.unavailableSkipped.length === 1 ? '' : 's'} ${ids} unavailable in this project — saved without the mask; painting falls back to the neutral round elsewhere.`,
          true,
        );
      }
      // WR-03 / T-63-28: every custom id the capture PAINTS must travel. A gap
      // is either a realm that never received the catalog or an id this
      // project does not carry — both would write a script with a silent hole.
      const carried = new Set(build.entries.map((entry) => entry.id));
      const missing = referenced.filter((id) => !carried.has(id));
      if (missing.length > 0) {
        const first = missing[0]!;
        return fail(brushCatalogSynced.value
          ? `Save refused — custom tip "${first}" is painted in the capture but its mask cannot travel (unavailable, or loaded from another script). The script would fall back to the neutral round.`
          : `Save refused — this Studio never received the project's brush catalog, so the mask for custom tip "${first}" is missing. Reopen the project and try again.`);
      }
      const script = serializeAquarelleRotoScript({ id, name, createdAt: now, updatedAt: now, source: sourceBag, thumbnail, events: scriptSnapshot.aquarelleEvents, brushEntries: build.entries });
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
    // D-16 / D-14: a refused row stays listed and deletable but never loads.
    if (isRefusedRotoScriptRow(row)) {
      status.value = `Refused script: ${row.refusal}`;
      ports.log(status.value, true);
      return false;
    }
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
      // 63-08 / TIP-14 / T-63-23: the script's masks become live paint state in
      // THIS realm's registry only — never a project catalog row.
      await registerLoadedScriptMasks(result.script);
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
      // 63-08 / TIP-14: a snapshot read is another load path — same registry-only law.
      await registerLoadedScriptMasks(result.script);
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
      deleteError.value = 'Script or Rail references changed. Nothing changed. Review the affected Rails and try again.';
      ports.log(deleteError.value, true);
      return false;
    }
    if (!referenced && currentImpact) {
      deleteError.value = 'Script references changed. Nothing changed. Review the affected Groups before deleting.';
      ports.log(deleteError.value, true);
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
        deleteError.value = mapReferencedActionDeleteError(prepared.code);
        status.value = prepared.error;
        ports.log(prepared.error, true);
        return false;
      }
      referencedDeleteImpact.value = prepared.impact;
      transactionPhase.value = 'committed';
      const settled = transactionPorts.settle?.(prepared) ?? { ok: false, error: 'Committed Script settlement port is unavailable.' };
      if (!settled.ok) {
        transactionPorts.transferLeaseToRecovery?.(prepared.request.leaseToken);
        transactionPhase.value = 'recovery-required';
        deleteError.value = 'Recovery is required before another Script change. Accepted Scripts and Groups remain unchanged.';
        status.value = settled.error ?? 'Committed Script settlement requires recovery.';
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
        deleteError.value = 'Recovery is required before another Script change. Accepted Scripts and Groups remain unchanged.';
        return false;
      }
      transactionPorts.releaseLease(prepared.request.leaseToken);
      transactionPhase.value = 'idle';
      const scanRequest = { kind: 'scan' as const, operationId: operationId('settled-scan') };
      const scan = await ports.request(scanRequest);
      if (!disposed && scan.ok && scan.operationId === scanRequest.operationId && scan.kind === 'scan') {
        publishResult(scan, undefined, true);
      }
      deleteError.value = null;
      deleteConfirmation.value = null;
      status.value = `Deleted ${row.name}`;
      return true;
    } finally {
      busy.value = false;
    }
  }
  return {
    rows, selectedId, selected, busy, status, skippedInvalidCount, rename, deleteConfirmation, deleteError,
    referencedDeleteImpact, transactionPhase, recoveryReady, actionMutationDisabledReason, availability,
    scriptScope, scriptLayers, setScriptScope,
    updateProjectContext, enterScripts: refresh, refresh, saveActiveFrame, activateAndLoad, loadSnapshot, beginRename, updateRenameDraft, commitRename,
    cancelRename: () => { rename.value = null; }, requestDelete: () => {
      const row = selected.peek();
      if (!row || actionMutationDisabledReason.peek()) return;
      deleteError.value = null;
      const context = ports.getLaunchContext();
      const document = context ? ports.referencedActionDeletion?.getPhysicalDocument(context.layerId) ?? null : null;
      deleteConfirmation.value = Object.freeze({ ...row, referenceImpact: buildRotoScriptDeleteReferenceImpact(document, row) });
    }, confirmDelete,
    cancelDelete: () => {
      if (actionMutationDisabledReason.peek()) return;
      deleteError.value = null;
      deleteConfirmation.value = null;
    }, select: (id) => { if (rows.peek().some((row) => row.id === id)) selectedId.value = id; },
    dispose: () => { disposed = true; contextGeneration += 1; operationGeneration += 1; busy.value = false; rows.value = []; selectedId.value = null; rename.value = null; deleteConfirmation.value = null; deleteError.value = null; lastAutoHydratedKey = null; lastSeenContextId = null; scriptScope.value = ROTO_SCRIPT_SCOPE_ALL; scriptLayers.value = []; },
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
    ...(script.engineId !== undefined ? { engineId: script.engineId } : {}),
    ...(script.aquarelleEvents !== undefined ? { aquarelleEvents: script.aquarelleEvents } : {}),
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
