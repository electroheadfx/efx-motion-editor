import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { physicPaintStore } from '../stores/physicPaintStore';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoRailMotionRecord } from '../components/physic-paint/roto/railMotionModel';
import { reconcileRailMotionsForDocumentEdit } from '../components/physic-paint/roto/railMotionDocumentReconciler';
import { proposeRails } from '../components/physic-paint/roto/physicsPaintRotoRailSetCopy';
import { proposePhysicPaintRotoDeleteRails } from '../components/physic-paint/roto/physicsPaintRotoGroupLifecycle';
import type { RailSetDeleteMember } from '../types/physicPaint';
import { defaultTransform, type Layer } from '../types/layer';
import { layerStore } from '../stores/layerStore';
import { projectStore } from '../stores/projectStore';
import { sequenceStore } from '../stores/sequenceStore';
import { applyPhysicPaintPayload, openPhysicPaintCanvas } from './physicPaintBridge';
import { resolvePhysicPaintRotoPhysicalEdit } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import {
  isPhysicPaintRotoPhysicalEditApplyResult,
  type PhysicPaintRotoPhysicalEditIntent,
} from '../types/physicPaint';
import { registerDocument, reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { testWebpBytes } from '../testUtils/testWebpBytes';

// 59-15 (Gate B): every product edit that changes which rail exists must write
// the reconciled rail-motion collection in the SAME bridge commit as the
// records/loops/breaks write, and one undo must restore it. These specs drive
// the REAL transport (`applyPhysicPaintPayload`) against the REAL store with
// payloads built by the REAL resolver — never hand-written record arrays.
const TEST_TRACK_ID = 'track-1';
const LAYER = 'layer-roto-gate-b';
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

function makeTrackDocument(layerId: string): EfxPaintDocument {
  return {
    version: 1,
    parentLayerId: layerId,
    documentRevision: 0,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{
      id: TEST_TRACK_ID,
      name: 'Paint',
      order: 0,
      visible: true,
      solo: false,
      opacity: 1,
      blendMode: 'normal',
      revision: 0,
      frames: {},
      rotoPhysical: null,
      loopClips: [],
    }],
    background: { id: 'background-1', clips: [], fallback: { mode: 'transparent' }, visible: true, revision: 0 },
    photoReference: null,
    audios: [],
    compositeRevision: 0,
  } as unknown as EfxPaintDocument;
}

function payload(appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyPayload {
  return {
    frameIndex: 0,
    appFrame,
    bytes: testWebpBytes(btoa(`rail-motion-gate-b:${appFrame}:${tag}`)),
    width: 4,
    height: 4,
  };
}

function record(keyId: string, appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyRecord {
  return { kind: 'real-key', keyId, appFrame, payload: payload(appFrame, tag) };
}

/** Five consecutive source-cycle keys A..E at frames 0..4. */
function cycleRecords(): PhysicPaintRotoRealKeyRecord[] {
  return [record('A', 0), record('B', 1), record('C', 2), record('D', 3), record('E', 4)];
}

function railMotion(railId = 'rail-1', anchorKeyId = 'A'): PhysicPaintRotoRailMotionRecord {
  return {
    railId,
    anchorKeyId,
    channels: [
      { id: 'opacity', keys: [{ frame: 0, value: 0.5, easing: 'ease', wiggle: 0 }] },
    ],
  };
}

function bridgeLayer(): Layer {
  return {
    id: LAYER,
    name: 'Physics Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: LAYER },
  };
}

interface SeedOptions {
  readonly railMotions?: readonly PhysicPaintRotoRailMotionRecord[];
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  readonly breaks?: readonly string[];
}

function seedBridgeDocument(
  records: readonly PhysicPaintRotoRealKeyRecord[] = cycleRecords(),
  options: SeedOptions = {},
): void {
  const loopClips = options.loopClips ?? [];
  const breaks = options.breaks ?? [];
  const railMotions = options.railMotions ?? [];
  const result = physicPaintStore.replaceRotoPhysicalDocument(LAYER, TEST_TRACK_ID, {
    capacity: 600,
    realKeyRecords: records,
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, loopClips, breaks, [], railMotions),
    loopClips,
    railMotions,
    incomingInterpolationBreakKeyIds: breaks,
  });
  if (!result.ok) throw new Error(result.error);
}

async function launchBridge(): Promise<string> {
  const opened = await openPhysicPaintCanvas({ layer: bridgeLayer(), frame: 0 });
  if (!opened.ok) throw new Error(opened.error);
  return opened.data.operationId;
}

function bridgePayload(launchOperationId: string, overrides: Record<string, unknown> = {}) {
  const projectContextId = projectStore.projectContextId.peek();
  const leaseToken = physicPaintStore.acquireRotoPhysicalOperationLease(projectContextId, LAYER, TEST_TRACK_ID);
  if (!leaseToken) throw new Error('Expected canonical bridge physical-operation lease.');
  return {
    kind: 'replace-roto-physical-map' as const,
    trackId: TEST_TRACK_ID,
    operationId: `op-${crypto.randomUUID()}`,
    operationKind: 'move-key',
    layerId: LAYER,
    leaseToken,
    projectContextId,
    startFrame: 0,
    launchOperationId,
    expectedRevision: physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!,
    records: bridgeRecordEntries(physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID)),
    interpolationEnabled: INTERPOLATION.enabled,
    interpolationMode: INTERPOLATION.mode,
    selectedKeyId: null,
    selectedAppFrame: null,
    cursorAppFrame:
      physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)?.cursorAppFrame ?? 0,
    ...overrides,
  };
}

async function applyBridgePayload(payload: ReturnType<typeof bridgePayload>) {
  const result = await applyPhysicPaintPayload(payload);
  if (!physicPaintStore.releaseRotoPhysicalOperationLease(payload.leaseToken)) {
    throw new Error('Expected canonical bridge physical-operation lease release.');
  }
  return result;
}

function bridgeRecordEntries(records: readonly PhysicPaintRotoRealKeyRecord[]) {
  return records.map(({ keyId, appFrame, payload: recordPayload }) => ({ keyId, appFrame, payload: recordPayload }));
}

/**
 * Builds the lifecycle delete-rails payload from the REAL proposer (the same
 * authority the child coordinator and the parent recompute use), never from a
 * hand-written target document.
 */
function deleteRailsPayload(
  launchOperationId: string,
  members: readonly RailSetDeleteMember[],
) {
  const document = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
  const proposed = proposePhysicPaintRotoDeleteRails({ document, members });
  if (!proposed.ok) throw new Error(`Expected canonical delete-rails proposal: ${proposed.reason}`);
  return bridgePayload(launchOperationId, {
    operationKind: 'delete-rails',
    records: bridgeRecordEntries(proposed.proposal.realKeyRecords),
    loopClips: proposed.proposal.loopClips,
    incomingInterpolationBreakKeyIds: proposed.proposal.incomingInterpolationBreakKeyIds,
    selectedKeyId: proposed.proposal.selectedKeyId,
    selectedAppFrame: proposed.proposal.selectedKeyId === null ? null : proposed.proposal.cursorAppFrame,
    cursorAppFrame: proposed.proposal.cursorAppFrame,
    semanticDelta: proposed.impact,
  });
}

/**
 * Builds a rail-set paste payload exactly like the child coordinator does:
 * copy through the real store, propose through the shared pure law, then ship
 * the proposal's records/loops/breaks + semantic delta + explicit collection.
 */
function railSetPastePayload(launchOperationId: string, destinationAppFrame: number) {
  const document = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
  const copied = physicPaintStore.copyTrackSelection(
    LAYER,
    TEST_TRACK_ID,
    document.realKeyRecords.map((record) => record.keyId),
  );
  if (!copied.ok) throw new Error(`Expected a rail-set copy payload: ${copied.reason}`);
  const proposed = proposeRails({
    document,
    payload: copied.payload,
    placementMode: 'paste',
    destinationAppFrame,
  });
  if (!proposed.ok) throw new Error(`Expected a rail-set paste proposal: ${proposed.reason}`);
  return bridgePayload(launchOperationId, {
    operationKind: 'paste',
    records: bridgeRecordEntries(proposed.proposal.realKeyRecords),
    loopClips: proposed.proposal.loopClips,
    incomingInterpolationBreakKeyIds: proposed.proposal.incomingInterpolationBreakKeyIds,
    selectedKeyId: proposed.proposal.selectedKeyId,
    selectedAppFrame: proposed.proposal.selectedKeyId === null ? null : proposed.proposal.cursorAppFrame,
    cursorAppFrame: proposed.proposal.cursorAppFrame,
    semanticDelta: proposed.impact,
    railMotions: proposed.proposal.railMotions,
  });
}

function documentSnapshot(document: PhysicPaintRotoPhysicalDocument) {
  return {
    realKeyRecords: document.realKeyRecords,
    incomingInterpolationBreakKeyIds: new Set(document.incomingInterpolationBreakKeyIds),
    loopClips: document.loopClips,
  };
}

/** The coordinator's replay emission for one undo of the forward operation. */
async function undoAcceptedEdit(
  launchOperationId: string,
  forwardOperationId: string,
  beforeDocument: PhysicPaintRotoPhysicalDocument,
  beforeRevision: string,
) {
  const sourceRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
  const undo = await applyBridgePayload(replayPayload(launchOperationId, 'undo', beforeDocument, {
    historyCommandId: forwardOperationId,
    sourceRevision,
    targetRevision: beforeRevision,
  }));
  expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
}

/**
 * Builds one forward payload from the REAL resolver proposal. `railMotions` is
 * omitted (the forward-edit contract) unless a test needs an explicit
 * collection.
 */
function canonicalPayload(
  launchOperationId: string,
  intent: PhysicPaintRotoPhysicalEditIntent,
  options: {
    readonly railMotions?: readonly PhysicPaintRotoRailMotionRecord[];
    readonly operationId?: string;
  } = {},
) {
  const currentRecords = physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID);
  const currentLoopClips = physicPaintStore.getRotoPhysicalLoopClips(LAYER, TEST_TRACK_ID);
  const currentBreaks = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID);
  const capacity = physicPaintStore.getRotoPhysicalCapacity(LAYER, TEST_TRACK_ID);
  const resolution = resolvePhysicPaintRotoPhysicalEdit({
    identities: currentRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    records: currentRecords,
    intent,
    parentEndExclusive: capacity,
    capacity,
    interpolationEnabled: INTERPOLATION.enabled,
    loopClips: currentLoopClips,
    incomingInterpolationBreakKeyIds: currentBreaks,
  });
  if (!resolution.ok) throw new Error(`Expected canonical ${intent.kind} proposal: ${resolution.failure.text}`);
  const proposal = resolution.proposal;
  const records = proposal.nextRecords ?? proposal.orderedKeyIds.map((keyId) => {
    const current = currentRecords.find((candidate) => candidate.keyId === keyId);
    const appFrame = proposal.mapping.get(keyId);
    if (!current || appFrame === undefined) throw new Error(`Missing canonical ${intent.kind} record for ${keyId}.`);
    return {
      ...current,
      appFrame,
      payload: { ...current.payload, appFrame },
    };
  });
  return bridgePayload(launchOperationId, {
    operationKind: intent.kind,
    ...(options.operationId === undefined ? {} : { operationId: options.operationId }),
    intent,
    records: bridgeRecordEntries(records),
    loopClips: proposal.nextLoopClips ?? currentLoopClips,
    incomingInterpolationBreakKeyIds: proposal.nextIncomingInterpolationBreakKeyIds ?? currentBreaks,
    selectedKeyId: proposal.selectedKeyId,
    selectedAppFrame: proposal.selectedAppFrame,
    cursorAppFrame:
      proposal.selectedAppFrame
      ?? physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)?.cursorAppFrame
      ?? 0,
    ...(options.railMotions === undefined ? {} : { railMotions: options.railMotions }),
  });
}

/**
 * The exact replay shape the child coordinator emits (59-07): the target
 * document's collection is submitted EXPLICITLY, so forward reconciliation is
 * bypassed and the target snapshot/revision can match the accepted command.
 */
function replayPayload(
  launchOperationId: string,
  operationKind: 'undo' | 'redo',
  targetDocument: PhysicPaintRotoPhysicalDocument,
  provenance: { readonly historyCommandId: string; readonly sourceRevision: string; readonly targetRevision: string },
) {
  return bridgePayload(launchOperationId, {
    operationKind,
    records: bridgeRecordEntries(targetDocument.realKeyRecords),
    loopClips: targetDocument.loopClips,
    incomingInterpolationBreakKeyIds: targetDocument.incomingInterpolationBreakKeyIds,
    selectedKeyId: targetDocument.selectedKeyId,
    selectedAppFrame: targetDocument.selectedKeyId === null ? null : targetDocument.cursorAppFrame,
    cursorAppFrame: targetDocument.cursorAppFrame,
    railMotions: targetDocument.railMotions,
    historyProvenance: {
      historyCommandId: provenance.historyCommandId,
      historyDirection: operationKind,
      sourceRevision: provenance.sourceRevision,
      targetRevision: provenance.targetRevision,
    },
  });
}

describe('59-15 Gate B: delete-first-key end to end', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerDocument(makeTrackDocument(LAYER));
    const layer = bridgeLayer();
    sequenceStore.sequences.value = [{
      id: 'gate-b-parent-sequence',
      kind: 'fx',
      extrapolation: 'hold',
      name: 'Gate B bridge authority',
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 600,
    }];
    vi.spyOn(layerStore.layers, 'peek').mockReturnValue([layer]);
    vi.spyOn(layerStore.overlayLayers, 'peek').mockReturnValue([]);
    Object.defineProperty(globalThis, 'window', {
      value: {
        open: vi.fn(() => ({ focus: vi.fn() })),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        location: { origin: 'http://localhost:1420' },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('re-anchors the motion record in the same commit as the delete, and one undo restores it', async () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const launch = await launchBridge();
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;

    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');
    const forward = canonicalPayload(launch, { kind: 'delete-key', selectedKeyId: 'A' });
    const result = await applyBridgePayload(forward);

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    if (!isPhysicPaintRotoPhysicalEditApplyResult(result)) {
      throw new Error('Expected an accepted physical edit result.');
    }
    expect(replace).toHaveBeenCalledTimes(1);

    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0].railId).toBe('rail-1');
    expect(stored[0].anchorKeyId).toBe('B');
    expect(stored[0].channels).toEqual([{ id: 'opacity', keys: [{ frame: 0, value: 0.5, easing: 'ease', wiggle: 0 }] }]);

    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const expectedRevision = buildPhysicPaintRotoPhysicalRevision(
      acceptedDocument.realKeyRecords,
      INTERPOLATION,
      acceptedDocument.loopClips,
      acceptedDocument.incomingInterpolationBreakKeyIds,
      acceptedDocument.groupOverrideRecords ?? [],
      stored,
    );
    expect(acceptedDocument.revision).toBe(expectedRevision);
    expect(acceptedDocument.revision).not.toBe(beforeRevision);
    expect(result.acceptedRevision).toBe(expectedRevision);
    expect(replace).toHaveBeenCalledTimes(1);

    const undo = await applyBridgePayload(replayPayload(launch, 'undo', beforeDocument, {
      historyCommandId: forward.operationId,
      sourceRevision: acceptedDocument.revision,
      targetRevision: beforeRevision,
    }));

    expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
    const restored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(restored).toHaveLength(1);
    expect(restored[0].railId).toBe('rail-1');
    expect(restored[0].anchorKeyId).toBe('A');
    expect(restored[0].channels).toEqual((beforeDocument.railMotions ?? [])[0].channels);
    expect(physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!.revision).toBe(beforeRevision);
  });

  it('does NOT reconcile a payload that carries an explicit collection', async () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const launch = await launchBridge();
    const explicit = railMotion('rail-explicit', 'A');

    const result = await applyBridgePayload(
      canonicalPayload(launch, { kind: 'delete-key', selectedKeyId: 'A' }, { railMotions: [explicit] }),
    );

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    // Stored verbatim: still anchored at the deleted key, never reconciled.
    expect(stored[0].railId).toBe('rail-explicit');
    expect(stored[0].anchorKeyId).toBe('A');
  });

  it('retains a record that was already orphaned before the edit, byte-identically', async () => {
    const orphan = railMotion('rail-orphan', 'Z');
    seedBridgeDocument(cycleRecords(), { railMotions: [orphan] });
    const launch = await launchBridge();

    const result = await applyBridgePayload(
      canonicalPayload(launch, { kind: 'delete-key', selectedKeyId: 'C' }),
    );

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    expect(stored).toContainEqual(orphan);
    expect(stored[0].anchorKeyId).toBe('Z');
  });

  it('uses each side OWN group ownership: the previous clip flushes the segment', async () => {
    const loopClips: readonly PhysicPaintRotoLoopClip[] = [{
      loopId: 'loop-1',
      placementStart: 1,
      sourceKeyIds: ['B'],
      repeat: 1,
      mode: 'static',
    }];
    seedBridgeDocument(
      [record('A', 0), record('B', 1), record('C', 2)],
      { loopClips, railMotions: [railMotion('rail-c', 'C')] },
    );
    const launch = await launchBridge();

    const result = await applyBridgePayload(
      canonicalPayload(launch, { kind: 'delete-key', selectedKeyId: 'C' }),
    );

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    // Previous segments with the clip's ownership are [A] and [C]: deleting C
    // leaves no successor sharing C, so the record is removed.
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toEqual([]);
  });

  it('classifies the same fixture differently without the ownership facts', async () => {
    seedBridgeDocument(
      [record('A', 0), record('B', 1), record('C', 2)],
      { railMotions: [railMotion('rail-c', 'C')] },
    );
    const launch = await launchBridge();

    const result = await applyBridgePayload(
      canonicalPayload(launch, { kind: 'delete-key', selectedKeyId: 'C' }),
    );

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    // Without ownership the previous segment is [A, B, C]: no transition row
    // matches, so the record is retained unchanged.
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0].railId).toBe('rail-c');
    expect(stored[0].anchorKeyId).toBe('C');
  });

  it('puts the resolved collection in the apply fingerprint', async () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const launch = await launchBridge();
    const operationId = 'gate-b-fingerprint-operation';
    const explicit = railMotion('rail-1', 'A');
    const first = canonicalPayload(
      launch,
      { kind: 'delete-key', selectedKeyId: 'A' },
      { railMotions: [explicit], operationId },
    );
    const firstResult = await applyBridgePayload(first);
    expect(firstResult.ok, firstResult.ok ? undefined : firstResult.error).toBe(true);

    // Duplicate delivery of the SAME payload is idempotent (cached result).
    const idempotent = await applyPhysicPaintPayload(first);
    expect(idempotent.ok, idempotent.ok ? undefined : idempotent.error).toBe(true);

    // Same operation id and every other field, ONLY the collection changes.
    // The delivered-operations guard runs before lease validation, so the
    // released lease does not mask the fingerprint verdict.
    const changedCollection = await applyPhysicPaintPayload({
      ...first,
      railMotions: [railMotion('rail-1', 'B')],
    });
    expect(changedCollection.ok).toBe(false);
    expect(changedCollection.ok ? null : changedCollection.error).toBe(
      'Operation ID was already used for a different payload.',
    );
  });

  it('keeps the collection byte-identical when a non-first key is deleted', async () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const launch = await launchBridge();
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const beforeMotions = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    const forward = canonicalPayload(launch, { kind: 'delete-key', selectedKeyId: 'C' });
    const result = await applyBridgePayload(forward);
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);

    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toEqual(beforeMotions);
    expect(stored).toHaveLength(1);
    expect(stored[0].anchorKeyId).toBe('A');
    expect(stored[0].channels).toEqual(beforeMotions[0].channels);

    await undoAcceptedEdit(launch, forward.operationId, beforeDocument, beforeRevision);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toEqual(beforeMotions);
  });

  it('removes the record in the same commit when the whole Key Rail is deleted', async () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const launch = await launchBridge();
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const beforeMotions = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    const forward = canonicalPayload(launch, {
      kind: 'delete-key-rail',
      keyIds: ['A', 'B', 'C', 'D', 'E'],
    });
    const result = await applyBridgePayload(forward);
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);

    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID)).toHaveLength(0);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toHaveLength(0);

    await undoAcceptedEdit(launch, forward.operationId, beforeDocument, beforeRevision);
    const restored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(restored).toHaveLength(1);
    expect(restored[0].railId).toBe('rail-1');
    expect(restored[0].anchorKeyId).toBe('A');
    expect(restored[0].channels).toEqual(beforeMotions[0].channels);
  });

  it('removes the record in the same commit when a rail-set delete removes the rail', async () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const launch = await launchBridge();
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const beforeMotions = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    const forward = deleteRailsPayload(launch, [{
      kind: 'key-rail',
      firstKeyId: 'A',
      keyIds: ['A', 'B', 'C', 'D', 'E'],
    }]);
    const result = await applyBridgePayload(forward);
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);

    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID)).toHaveLength(0);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toHaveLength(0);

    await undoAcceptedEdit(launch, forward.operationId, beforeDocument, beforeRevision);
    const restored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(restored).toHaveLength(1);
    expect(restored[0].railId).toBe('rail-1');
    expect(restored[0].anchorKeyId).toBe('A');
    expect(restored[0].channels).toEqual(beforeMotions[0].channels);
  });

  it('keeps the head record unchanged across a scissor split, inventing no tail', async () => {
    seedBridgeDocument(
      [record('A', 0), record('B', 1), record('C', 2), record('D', 3)],
      { railMotions: [railMotion('rail-1', 'A')] },
    );
    const launch = await launchBridge();
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const beforeMotions = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    const forward = canonicalPayload(launch, { kind: 'scissor-key-rail', breakOwnerKeyId: 'C' });
    const result = await applyBridgePayload(forward);
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);

    // The break landed: the rail really split at C.
    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID)).toContain('C');
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toEqual(beforeMotions);
    expect(stored).toHaveLength(1);
    expect(stored[0].railId).toBe('rail-1');
    expect(stored[0].anchorKeyId).toBe('A');
    expect(stored[0].channels).toEqual(beforeMotions[0].channels);
    // The split's tail owns no motion of its own.
    expect(stored.some((motion) => motion.anchorKeyId === 'C')).toBe(false);

    await undoAcceptedEdit(launch, forward.operationId, beforeDocument, beforeRevision);
    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID)).not.toContain('C');
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toEqual(beforeMotions);
  });

  it('adopts the surviving tail record onto the merged anchor when only the tail animated', async () => {
    seedBridgeDocument(
      [record('A', 0), record('B', 1), record('C', 2), record('D', 3)],
      { breaks: ['C'], railMotions: [railMotion('rail-tail', 'C')] },
    );
    const launch = await launchBridge();
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const beforeMotions = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    // Deleting the break owner is the product path that removes the break.
    const forward = canonicalPayload(launch, { kind: 'delete-key', selectedKeyId: 'C' });
    const result = await applyBridgePayload(forward);
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);

    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0].railId).toBe('rail-tail');
    expect(stored[0].anchorKeyId).toBe('A');
    expect(stored[0].channels).toEqual(beforeMotions[0].channels);

    const report = reconcileRailMotionsForDocumentEdit({
      previous: documentSnapshot(beforeDocument),
      next: documentSnapshot(acceptedDocument),
      railMotions: beforeMotions,
    });
    expect(report.adoptedRailId).toBe('rail-tail');
    expect(report.droppedRailId).toBeNull();
    expect(report.droppedRailFrames).toBeNull();
    expect(report.railMotions).toEqual(stored);

    await undoAcceptedEdit(launch, forward.operationId, beforeDocument, beforeRevision);
    const restored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(restored).toHaveLength(1);
    expect(restored[0].railId).toBe('rail-tail');
    expect(restored[0].anchorKeyId).toBe('C');
  });

  it('keeps the head record and drops the tail with its prior span when both sides animated', async () => {
    seedBridgeDocument(
      [record('A', 0), record('B', 1), record('C', 2), record('D', 3)],
      { breaks: ['C'], railMotions: [railMotion('rail-head', 'A'), railMotion('rail-tail', 'C')] },
    );
    const launch = await launchBridge();
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const beforeMotions = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    const forward = canonicalPayload(launch, { kind: 'delete-key', selectedKeyId: 'C' });
    const result = await applyBridgePayload(forward);
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);

    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0].railId).toBe('rail-head');
    expect(stored[0].anchorKeyId).toBe('A');

    const report = reconcileRailMotionsForDocumentEdit({
      previous: documentSnapshot(beforeDocument),
      next: documentSnapshot(acceptedDocument),
      railMotions: beforeMotions,
    });
    expect(report.adoptedRailId).toBeNull();
    expect(report.droppedRailId).toBe('rail-tail');
    // The dropped record's PRIOR segment span [C, D] in app frames.
    expect(report.droppedRailFrames).toEqual({ startFrame: 2, endFrameExclusive: 4 });
    expect(report.railMotions).toEqual(stored);

    await undoAcceptedEdit(launch, forward.operationId, beforeDocument, beforeRevision);
    const restored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(restored).toHaveLength(2);
    expect(restored.find((motion) => motion.railId === 'rail-head')?.anchorKeyId).toBe('A');
    expect(restored.find((motion) => motion.railId === 'rail-tail')?.anchorKeyId).toBe('C');
  });

  it('keeps every rail-local frame when the rail start moves', async () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const launch = await launchBridge();
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    const beforeRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const beforeMotions = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    const forward = canonicalPayload(launch, {
      kind: 'move-key-rail',
      memberKeyIds: ['A', 'B', 'C', 'D', 'E'],
      destinationFirstKeyAppFrame: 10,
    });
    const result = await applyBridgePayload(forward);
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);

    // The rail really moved: the first key now sits at frame 10.
    expect(
      physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID).map((entry) => entry.appFrame),
    ).toEqual([10, 11, 12, 13, 14]);
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toEqual(beforeMotions);
    expect(stored[0].railId).toBe('rail-1');
    expect(stored[0].anchorKeyId).toBe('A');
    expect(stored[0].channels).toEqual(beforeMotions[0].channels);

    await undoAcceptedEdit(launch, forward.operationId, beforeDocument, beforeRevision);
    expect(
      physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID).map((entry) => entry.appFrame),
    ).toEqual([0, 1, 2, 3, 4]);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toEqual(beforeMotions);
  });

  it('duplicates an animated rail onto a fresh identity through duplicateTrackFrames', () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const beforeMotions = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    const duplicated = physicPaintStore.duplicateTrackFrames(LAYER, TEST_TRACK_ID, [0, 1, 2, 3, 4]);
    expect(duplicated.ok, duplicated.ok ? undefined : duplicated.reason).toBe(true);
    if (!duplicated.ok) throw new Error(`Expected a duplicate impact: ${duplicated.reason}`);

    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(2);
    // The source rail keeps its record byte-identically.
    expect(stored.find((motion) => motion.railId === 'rail-1')).toEqual(beforeMotions[0]);
    // The fresh rail carries the same channels under the allocated railId,
    // anchored at the fresh first key (the duplicate scan starts at 6).
    const freshRailId = duplicated.impact.freshIdentityAllocation.railIds['rail-1'];
    expect(freshRailId).toBeDefined();
    expect(freshRailId).not.toBe('rail-1');
    const copy = stored.find((motion) => motion.railId === freshRailId);
    expect(copy).toBeDefined();
    const freshFirstKey = physicPaintStore.getRotoRealKeyRecordByAppFrame(LAYER, TEST_TRACK_ID, 6);
    expect(freshFirstKey).toBeDefined();
    expect(copy!.anchorKeyId).toBe(freshFirstKey!.keyId);
    expect(copy!.channels).toEqual(beforeMotions[0].channels);

    // The stored revision includes the collection (6th argument).
    const document = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)!;
    expect(document.revision).toBe(buildPhysicPaintRotoPhysicalRevision(
      document.realKeyRecords,
      document.interpolation,
      document.loopClips,
      document.incomingInterpolationBreakKeyIds,
      document.groupOverrideRecords ?? [],
      stored,
    ));
  });

  it('accepts a bridge paste whose explicit collection equals the parent recomputation', async () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const launch = await launchBridge();
    const paste = railSetPastePayload(launch, 20);

    const result = await applyBridgePayload(paste);
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);

    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(2);
    const impact = (paste as { semanticDelta?: unknown }).semanticDelta as Readonly<{
      freshIdentityAllocation: { railIds: Readonly<Record<string, string>> };
    }>;
    const freshRailId = impact.freshIdentityAllocation.railIds['rail-1'];
    expect(freshRailId).toBeDefined();
    const copy = stored.find((motion) => motion.railId === freshRailId);
    expect(copy).toBeDefined();
    const freshFirstKey = physicPaintStore.getRotoRealKeyRecordByAppFrame(LAYER, TEST_TRACK_ID, 20);
    expect(freshFirstKey).toBeDefined();
    expect(copy!.anchorKeyId).toBe(freshFirstKey!.keyId);
    expect(copy!.channels).toEqual(stored.find((motion) => motion.railId === 'rail-1')!.channels);
  });

  it('rejects a bridge paste whose explicit collection differs from the parent recomputation', async () => {
    seedBridgeDocument(cycleRecords(), { railMotions: [railMotion('rail-1', 'A')] });
    const launch = await launchBridge();
    const paste = railSetPastePayload(launch, 20);
    const beforeMotions = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    // Same records/loops/breaks/delta, ONLY the wire collection changes: the
    // parent recomputes the canonical re-key and must reject the divergence.
    const tampered = Object.freeze({
      ...paste,
      railMotions: [railMotion('rail-tampered', 'A')],
    });
    const result = await applyBridgePayload(tampered);

    expect(result.ok).toBe(false);
    // The bridge prefixes physical-edit failures with the generic apply hint;
    // the settlement detail is the canonical recomputation rejection.
    expect(result.ok ? null : result.error).toContain(
      'Rail-set paste/duplicate target document does not match parent recomputation.',
    );
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toEqual(beforeMotions);
  });
});
