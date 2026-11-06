import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  physicPaintStore,
  rotoPhysicalRevision,
} from './physicPaintStore';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
  type PhysicPaintRotoRailMotionRecord,
} from '../components/physic-paint/roto/railMotionModel';
import { defaultTransform, type Layer } from '../types/layer';
import { layerStore } from './layerStore';
import { projectStore } from './projectStore';
import { sequenceStore } from './sequenceStore';
import { applyPhysicPaintPayload, openPhysicPaintCanvas } from '../lib/physicPaintBridge';
import { resolvePhysicPaintRotoPhysicalEdit } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import {
  isPhysicPaintRotoPhysicalEditApplyPayload,
  isPhysicPaintRotoRailMotionCollection,
  type PhysicPaintRotoPhysicalEditIntent,
} from '../types/physicPaint';
import { registerDocument, reset as resetEfxPaintStore } from './efxPaintStore';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { testWebpBytes } from '../testUtils/testWebpBytes';

// 59-07: motion is a first-class store mutation. These specs drive the REAL
// bridge entry point (applyPhysicPaintPayload) against the REAL store, exactly
// like `physicPaintStore.rotoLoopClips.test.ts`, so the payload -> bridge ->
// store -> parent-document path is exercised end to end.
const TEST_TRACK_ID = 'track-1';
const LAYER = 'layer-roto-rail-motions';
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
    bytes: testWebpBytes(btoa(`rail-motion-store:${appFrame}:${tag}`)),
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

function seedBridgeDocument(): void {
  const records = cycleRecords();
  const result = physicPaintStore.replaceRotoPhysicalDocument(LAYER, TEST_TRACK_ID, {
    capacity: 600,
    realKeyRecords: records,
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], []),
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
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
    operationKind: overrides.operationKind ?? 'move-key',
    layerId: LAYER,
    leaseToken,
    projectContextId,
    startFrame: 0,
    launchOperationId,
    expectedRevision: physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!,
    records: bridgeRecordEntries(physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID)),
    interpolationEnabled: false,
    interpolationMode: 'duplicate' as const,
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

function canonicalBridgePayload(
  launchOperationId: string,
  intent: PhysicPaintRotoPhysicalEditIntent,
  options: {
    readonly omitRailMotions?: boolean;
    readonly railMotions?: readonly PhysicPaintRotoRailMotionRecord[];
  } = {},
) {
  const currentRecords = physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID);
  const currentLoopClips = physicPaintStore.getRotoPhysicalLoopClips(LAYER, TEST_TRACK_ID);
  const currentBreaks = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID);
  const resolution = resolvePhysicPaintRotoPhysicalEdit({
    identities: currentRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
    records: currentRecords,
    intent,
    parentEndExclusive: physicPaintStore.getRotoPhysicalCapacity(LAYER, TEST_TRACK_ID),
    capacity: physicPaintStore.getRotoPhysicalCapacity(LAYER, TEST_TRACK_ID),
    interpolationEnabled: false,
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
    ...(proposal.semanticDelta ? { semanticDelta: proposal.semanticDelta } : {}),
    ...(options.omitRailMotions ? {} : { railMotions: options.railMotions }),
  });
}

function bridgeRecordEntries(records: readonly PhysicPaintRotoRealKeyRecord[]) {
  return records.map(({ keyId, appFrame, payload: recordPayload }) => ({ keyId, appFrame, payload: recordPayload }));
}

const RIGID_CYCLE_MOVE: PhysicPaintRotoPhysicalEditIntent = {
  kind: 'move-key-group',
  movedKeyIds: ['A', 'B', 'C', 'D', 'E'],
  grabbedKeyId: 'A',
  target: { kind: 'physical-cell', appFrame: 1 },
};

describe('59-07: apply payload railMotions acceptance (MOTN-01/MOTN-12)', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerDocument(makeTrackDocument(LAYER));
    const layer = bridgeLayer();
    sequenceStore.sequences.value = [{
      id: 'store-rail-motion-bridge-parent-sequence',
      kind: 'fx',
      extrapolation: 'hold',
      name: 'Store rail motion bridge authority',
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
    vi.unstubAllGlobals();
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('lands one motion record in the parent document and moves the canonical revision', async () => {
    seedBridgeDocument();
    const launchOperationId = await launchBridge();
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);

    const command = canonicalBridgePayload(launchOperationId, RIGID_CYCLE_MOVE, {
      railMotions: [railMotion()],
    });
    const result = await applyBridgePayload(command);

    expect(result.ok).toBe(true);
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0].railId).toBe('rail-1');
    expect(stored[0].anchorKeyId).toBe('A');
    expect(stored[0].channels[0].id).toBe('opacity');
    expect(physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)?.railMotions).toHaveLength(1);
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).not.toBe(revisionBefore);
  });

  it('preserves the collection when a later payload omits railMotions', async () => {
    seedBridgeDocument();
    const launchOperationId = await launchBridge();
    const first = await applyBridgePayload(canonicalBridgePayload(launchOperationId, RIGID_CYCLE_MOVE, {
      railMotions: [railMotion()],
    }));
    expect(first.ok).toBe(true);
    const storedBefore = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(storedBefore).toHaveLength(1);

    const second = await applyBridgePayload(canonicalBridgePayload(launchOperationId, RIGID_CYCLE_MOVE, {
      omitRailMotions: true,
    }));

    expect(second.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toEqual(storedBefore);
    expect(physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)?.railMotions).toHaveLength(1);
  });

  it('clears the collection when a payload carries an explicit empty railMotions array', async () => {
    seedBridgeDocument();
    const launchOperationId = await launchBridge();
    const first = await applyBridgePayload(canonicalBridgePayload(launchOperationId, RIGID_CYCLE_MOVE, {
      railMotions: [railMotion()],
    }));
    expect(first.ok).toBe(true);

    const cleared = await applyBridgePayload(canonicalBridgePayload(launchOperationId, RIGID_CYCLE_MOVE, {
      railMotions: [],
    }));

    expect(cleared.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
    expect(physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID)?.railMotions).toHaveLength(0);
  });

  it('rejects a malformed motion payload before any mutation', async () => {
    seedBridgeDocument();
    const launchOperationId = await launchBridge();
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const physicalRevisionBefore = rotoPhysicalRevision.value;
    const storedBefore = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    const malformed = canonicalBridgePayload(launchOperationId, RIGID_CYCLE_MOVE, {
      railMotions: [{ railId: 'rail-1', anchorKeyId: 'A', channels: [] } as unknown as PhysicPaintRotoRailMotionRecord],
    });
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(malformed)).toBe(false);

    const result = await applyBridgePayload(malformed);

    expect(result.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toBe(storedBefore);
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).toBe(revisionBefore);
    expect(rotoPhysicalRevision.value).toBe(physicalRevisionBefore);
  });

  it('rejects a payload carrying an unknown sibling key instead of bypassing the allowlist', async () => {
    seedBridgeDocument();
    const launchOperationId = await launchBridge();
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;

    const typo = canonicalBridgePayload(launchOperationId, RIGID_CYCLE_MOVE, {
      railMotions: [railMotion()],
    });
    const salted = { ...typo, railMotion: [railMotion()] };
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(salted)).toBe(false);

    const result = await applyBridgePayload(salted as ReturnType<typeof bridgePayload>);
    expect(result.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).toBe(revisionBefore);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID).length).toBe(0);
  });
});

describe('59-07: isPhysicPaintRotoRailMotionCollection', () => {
  it('delegates to the 59-02 fail-closed parser and never repairs', () => {
    expect(isPhysicPaintRotoRailMotionCollection([])).toBe(true);
    expect(isPhysicPaintRotoRailMotionCollection([railMotion()])).toBe(true);
    expect(isPhysicPaintRotoRailMotionCollection(null)).toBe(false);
    expect(isPhysicPaintRotoRailMotionCollection([{ railId: 'rail-1', anchorKeyId: 'A', channels: [] }])).toBe(false);
    expect(isPhysicPaintRotoRailMotionCollection([railMotion(), railMotion()])).toBe(false);
  });
});

describe('59-07: replaceRotoPhysicalRailMotions transactionality', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerDocument(makeTrackDocument(LAYER));
    seedBridgeDocument();
  });

  it('fails closed for a track that does not exist and mutates nothing', () => {
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const physicalRevisionBefore = rotoPhysicalRevision.value;

    const result = physicPaintStore.replaceRotoPhysicalRailMotions(LAYER, 'missing-track', [railMotion()]);

    expect(result.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, 'missing-track')).toBe(PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY);
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).toBe(revisionBefore);
    expect(rotoPhysicalRevision.value).toBe(physicalRevisionBefore);
  });

  it('leaves records, interpolation, loop clips and breaks byte-identical on a rejected collection', () => {
    const recordsBefore = physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID);
    const interpolationBefore = physicPaintStore.getRotoPhysicalInterpolationState(LAYER, TEST_TRACK_ID);
    const loopsBefore = physicPaintStore.getRotoPhysicalLoopClips(LAYER, TEST_TRACK_ID);
    const breaksBefore = physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID);
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;

    const result = physicPaintStore.replaceRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID, [
      { railId: 'rail-1', anchorKeyId: 'A', channels: [], unexpected: true },
    ]);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('PhysicPaintRotoRailMotions:');
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID)).toEqual(recordsBefore);
    expect(physicPaintStore.getRotoPhysicalInterpolationState(LAYER, TEST_TRACK_ID)).toBe(interpolationBefore);
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TEST_TRACK_ID)).toBe(loopsBefore);
    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(LAYER, TEST_TRACK_ID)).toBe(breaksBefore);
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).toBe(revisionBefore);
  });

  it('re-applying the identical collection returns ok without bumping rotoPhysicalRevision', () => {
    const accepted = physicPaintStore.replaceRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID, [railMotion()]);
    expect(accepted.ok).toBe(true);
    const revisionAfterAccept = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const physicalRevisionAfterAccept = rotoPhysicalRevision.value;

    const replayed = physicPaintStore.replaceRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID, [railMotion()]);

    expect(replayed.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).toBe(revisionAfterAccept);
    expect(rotoPhysicalRevision.value).toBe(physicalRevisionAfterAccept);
  });
});
