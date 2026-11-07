import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  physicPaintStore,
  registerRotoAlphaCanvasFrame,
  resolveContentToken,
  rotoPhysicalRevision,
} from './physicPaintStore';
import { __resetRailMotionPivotMemoForTests } from '../components/physic-paint/roto/railMotionPivot';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoLoopClip,
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

describe('59-07: raster revision vs canonical revision (REL-03/MOTN-07)', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerDocument(makeTrackDocument(LAYER));
    const layer = bridgeLayer();
    sequenceStore.sequences.value = [{
      id: 'store-rail-motion-raster-parent-sequence',
      kind: 'fx',
      extrapolation: 'hold',
      name: 'Store rail motion raster authority',
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
    seedBridgeDocument();
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

  function frameSource(appFrame: number) {
    const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, appFrame);
    // The seeded cycle has only real keys, so a placeholder source is a fixture
    // fault — and it is the one variant without a pixel revision.
    if (!source || source.kind === 'loop-placeholder') {
      throw new Error(`Expected a renderable source at frame ${appFrame}.`);
    }
    return source;
  }

  it('leaves every frame cache key byte-identical across a motion-only edit while the canonical revision moves', () => {
    const frames = [0, 1, 2, 3, 4];
    const keysBefore = frames.map((appFrame) => frameSource(appFrame));
    const tokensBefore = keysBefore.map((source) => resolveContentToken(source.contentRevision));
    const canonicalBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;

    const accepted = physicPaintStore.replaceRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID, [railMotion()]);
    expect(accepted.ok).toBe(true);

    const keysAfter = frames.map((appFrame) => frameSource(appFrame));
    // Pixel identity is byte-identical: no cache entry is invalidated by motion.
    expect(keysAfter.map((source) => source.cacheRevision)).toEqual(
      keysBefore.map((source) => source.cacheRevision),
    );
    expect(keysAfter.map((source) => source.contentRevision)).toEqual(
      keysBefore.map((source) => source.contentRevision),
    );
    // The content tokens observed by the FRAME path do not move.
    expect(keysAfter.map((source) => resolveContentToken(source.contentRevision))).toEqual(tokensBefore);

    // Persistence identity DID move, and the frame path never carries it.
    const canonicalAfter = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    expect(canonicalAfter).not.toBe(canonicalBefore);
    expect(keysAfter[0].contentRevision).not.toBe(canonicalAfter);
  });

  it('rotates both revisions when a drawing-key edit lands', async () => {
    const sourceBefore = frameSource(0);
    expect(sourceBefore.kind).toBe('real');
    if (sourceBefore.kind !== 'real') throw new Error('Expected the seed frame to be a real key.');
    expect(sourceBefore.keyId).toBe('A');
    const rasterBefore = sourceBefore.contentRevision;
    const canonicalBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;

    const launchOperationId = await launchBridge();
    const result = await applyBridgePayload(canonicalBridgePayload(launchOperationId, RIGID_CYCLE_MOVE, {
      omitRailMotions: true,
    }));
    if (!result.ok) throw new Error(`drawing-key edit rejected: ${result.error}`);

    const sourceAfter = frameSource(1);
    expect(sourceAfter.kind).toBe('real');
    if (sourceAfter.kind !== 'real') throw new Error('Expected the moved key to stay real.');
    expect(sourceAfter.keyId).toBe('A');
    // A drawing-key edit moves paint, so BOTH identities rotate.
    expect(sourceAfter.contentRevision).not.toBe(rasterBefore);
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).not.toBe(canonicalBefore);
  });

  it('keeps the canonical revision canonical for persistence and the frame path on the raster value', () => {
    const accepted = physicPaintStore.replaceRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID, [railMotion()]);
    expect(accepted.ok).toBe(true);

    const canonical = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;
    const document = physicPaintStore.getRotoPhysicalDocument(LAYER, TEST_TRACK_ID);
    const frame = frameSource(0);

    expect(document?.railMotions).toHaveLength(1);
    expect(document?.revision).toBe(canonical);
    expect(frame.contentRevision).not.toBe(canonical);
    expect(frame.cacheRevision.startsWith(`${frame.contentRevision}:`)).toBe(true);
  });
});

describe('59-15: store-direct removal reconciles the rail-motion collection (Gate B)', () => {
  interface SeedOptions {
    readonly records?: readonly PhysicPaintRotoRealKeyRecord[];
    readonly breaks?: readonly string[];
    readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
    readonly railMotions?: readonly PhysicPaintRotoRailMotionRecord[];
  }

  /**
   * Seeds the track through the canonical document port, exactly like the
   * real transport does, so the store holds records, loops, breaks and motion
   * in one revision. The removal helpers below never touch the bridge.
   */
  function seedMotionDocument(options: SeedOptions = {}): void {
    const records = options.records ?? cycleRecords();
    const breaks = options.breaks ?? [];
    const loopClips = options.loopClips ?? [];
    const railMotions = options.railMotions ?? [];
    const result = physicPaintStore.replaceRotoPhysicalDocument(LAYER, TEST_TRACK_ID, {
      capacity: 600,
      realKeyRecords: records,
      interpolation: INTERPOLATION,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(
        records,
        INTERPOLATION,
        loopClips,
        breaks,
        [],
        railMotions,
      ),
      loopClips,
      railMotions,
      incomingInterpolationBreakKeyIds: breaks,
    });
    if (!result.ok) throw new Error(result.error);
  }

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerDocument(makeTrackDocument(LAYER));
  });

  it('re-anchors the record in the same helper call when clearTrackFrames deletes the rail first key', () => {
    seedMotionDocument({ railMotions: [railMotion('rail-1', 'A')] });
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalRailMotions');
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)!;

    const result = physicPaintStore.clearTrackFrames(LAYER, TEST_TRACK_ID, [0]);

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0].railId).toBe('rail-1');
    expect(stored[0].anchorKeyId).toBe('B');
    expect(stored[0].channels).toEqual([{ id: 'opacity', keys: [{ frame: 0, value: 0.5, easing: 'ease', wiggle: 0 }] }]);
    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER, TEST_TRACK_ID)).not.toBe(revisionBefore);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('removes the record when clearTrackFrames removes the loop clip that owns its rail', () => {
    const loopClips: readonly PhysicPaintRotoLoopClip[] = [{
      loopId: 'loop-1',
      placementStart: 1,
      sourceKeyIds: ['B'],
      repeat: 1,
      mode: 'static',
    }];
    seedMotionDocument({ loopClips, railMotions: [railMotion('loop-1', 'B')] });

    const result = physicPaintStore.clearTrackFrames(LAYER, TEST_TRACK_ID, [1]);

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toHaveLength(0);
  });

  it('removes the record when clearTrackFrames removes every key of the rail', () => {
    seedMotionDocument({
      records: [record('A', 0), record('B', 1)],
      railMotions: [railMotion('rail-1', 'A')],
    });

    const result = physicPaintStore.clearTrackFrames(LAYER, TEST_TRACK_ID, [0, 1]);

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toHaveLength(0);
  });

  it('leaves a non-first key deletion byte-identical through one reconcile call', () => {
    seedMotionDocument({
      records: [record('A', 0), record('B', 1), record('C', 2)],
      railMotions: [railMotion('rail-1', 'A')],
    });
    const before = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalRailMotions');

    const result = physicPaintStore.clearTrackFrames(LAYER, TEST_TRACK_ID, [2]);

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID)).toBe(before);
  });

  // 59-20 (CR-02): the removal transaction computes the merge transition but
  // used to keep only `.railMotions`, so a two-sided merge could never be
  // announced. The fixture is the ONLY shape `onMergeRails` drops on: records
  // A@0, B@1, C@2, D@3 with incoming breaks at B and D split the rails into
  // [A] [B,C] [D]; clearing frame 1 joins [A] and the C half of [B,C] into
  // [A,C], so the B-anchored record is a merge whose head (A) AND tail (B)
  // anchors both carry records. The tail is dropped and must be reported.
  const MERGE_RECORDS = [record('A', 0), record('B', 1), record('C', 2), record('D', 3)] as const;
  const MERGE_BREAKS = ['B', 'D'] as const;

  // WR-02: cut/clear have no production consumer for the merge drop — the move
  // path owns that report. These rows assert the exact returned key surface:
  // the merge still drops the tail record from the stored collection, but the
  // result carries no member the UI never reads.
  it('still drops the merged rail from the stored collection without reporting it from clearTrackFrames', () => {
    seedMotionDocument({
      records: MERGE_RECORDS,
      breaks: MERGE_BREAKS,
      railMotions: [railMotion('rail-head', 'A'), railMotion('rail-tail', 'B')],
    });

    const result = physicPaintStore.clearTrackFrames(LAYER, TEST_TRACK_ID, [1]);

    expect('mergedDrop' in result).toBe(false);
    expect(result).toEqual({ ok: true });
    expect(Object.keys(result)).toEqual(['ok']);
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0].railId).toBe('rail-head');
    expect(stored[0].anchorKeyId).toBe('A');
    expect(stored[0].channels).toEqual([{ id: 'opacity', keys: [{ frame: 0, value: 0.5, easing: 'ease', wiggle: 0 }] }]);
  });

  it('still drops the merged rail from the stored collection without reporting it from cutTrackSelection', () => {
    seedMotionDocument({
      records: MERGE_RECORDS,
      breaks: MERGE_BREAKS,
      railMotions: [railMotion('rail-head', 'A'), railMotion('rail-tail', 'B')],
    });

    const result = physicPaintStore.cutTrackSelection(LAYER, TEST_TRACK_ID, ['B']);

    expect(result.ok, result.ok ? undefined : result.reason).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toBeDefined();
    expect('mergedDrop' in result).toBe(false);
    expect(Object.keys(result).sort()).toEqual(['ok', 'payload']);
    const stored = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(stored).toHaveLength(1);
    expect(stored[0].railId).toBe('rail-head');
    expect(stored[0].anchorKeyId).toBe('A');
  });

  it('reports no drop for the same edit when the tail anchor carries no record (control)', () => {
    // Same keys and breaks as the merge fixture, but the second record is
    // anchored at C — `onMergeRails` needs a record at BOTH the head and the
    // tail anchor of the merge, so this row proves the A/B fixture (not the
    // assertion style) is what makes the merge reachable.
    seedMotionDocument({
      records: MERGE_RECORDS,
      breaks: MERGE_BREAKS,
      railMotions: [railMotion('rail-head', 'A'), railMotion('rail-tail', 'C')],
    });
    const before = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);

    const result = physicPaintStore.clearTrackFrames(LAYER, TEST_TRACK_ID, [1]);

    expect(result).toEqual({ ok: true });
    const after = physicPaintStore.getRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID);
    expect(after).toEqual(before);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
  });

  it('fails closed with apply-failed and reports no drop when the motion write is rejected', () => {
    seedMotionDocument({
      records: MERGE_RECORDS,
      breaks: MERGE_BREAKS,
      railMotions: [railMotion('rail-head', 'A'), railMotion('rail-tail', 'B')],
    });
    vi.spyOn(physicPaintStore, 'replaceRotoPhysicalRailMotions').mockReturnValue({
      ok: false,
      error: 'PhysicPaintRotoRailMotions: rejected',
    });

    const result = physicPaintStore.cutTrackSelection(LAYER, TEST_TRACK_ID, ['B']);

    expect(result).toEqual({ ok: false, reason: 'apply-failed' });
  });
});

// ---------------------------------------------------------------------------
// 261107-tfp: the canvas boundary box sizes itself on the DISPLAYED drawing
// key's alpha ink (not the whole project raster), served from the SAME memo
// entry the compositor's union pivot already populates.
// ---------------------------------------------------------------------------

/** One ink region on the 100x100 fake scan grid, inclusive columns/rows. */
interface InkRegion {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

// 10..29 -> normalized { x: 0.1, width: 0.2 }; 40..59 -> { x: 0.4, width: 0.2 }.
const INK_REGIONS: Readonly<Record<string, InkRegion>> = {
  A: { x0: 10, y0: 10, x1: 29, y1: 29 },
  B: { x0: 40, y0: 40, x1: 59, y1: 59 },
};
const INK_SIZE = 100;

describe('261107-tfp: getRotoRailMotionCanvasInk per-key ink', () => {
  let regionBySource: Map<HTMLCanvasElement, InkRegion>;
  let activeRegion: InkRegion | null;

  /** The fake-canvas pattern from railMotionInkScan.test.ts (node env). */
  function installFakeInkDocument(): void {
    const drawImage = vi.fn((source: HTMLCanvasElement) => {
      activeRegion = regionBySource.get(source) ?? null;
    });
    const context = {
      clearRect: vi.fn(),
      drawImage,
      getImageData: (_x: number, _y: number, width: number, height: number) => {
        const data = new Uint8ClampedArray(width * height * 4);
        const region = activeRegion;
        if (region !== null) {
          for (let y = region.y0; y <= region.y1; y += 1) {
            for (let x = region.x0; x <= region.x1; x += 1) {
              data[(y * width + x) * 4 + 3] = 255;
            }
          }
        }
        return { data };
      },
    };
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    });
  }

  function registerInkCanvases(records: readonly PhysicPaintRotoRealKeyRecord[]): void {
    for (const entry of records) {
      const bytes = entry.payload.bytes;
      if (bytes === undefined) continue;
      const canvas = { width: INK_SIZE, height: INK_SIZE } as unknown as HTMLCanvasElement;
      const region = INK_REGIONS[entry.keyId];
      if (region !== undefined) regionBySource.set(canvas, region);
      registerRotoAlphaCanvasFrame(bytes, canvas);
    }
  }

  function seedInkDocument(
    records: readonly PhysicPaintRotoRealKeyRecord[],
    interpolation: typeof INTERPOLATION | { readonly enabled: true; readonly mode: 'duplicate' } = INTERPOLATION,
  ): void {
    const railMotions = [railMotion('rail-1', 'A')];
    const result = physicPaintStore.replaceRotoPhysicalDocument(LAYER, TEST_TRACK_ID, {
      capacity: 600,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, [], [], [], railMotions),
      loopClips: [],
      railMotions,
      incomingInterpolationBreakKeyIds: [],
    });
    if (!result.ok) throw new Error(result.error);
  }

  beforeEach(() => {
    // The 59-15 describe spies on `replaceRotoPhysicalRailMotions` without a
    // restore; without this the clearing call below silently runs the leaked
    // rejection stub (file-level mock hygiene, no test changes there).
    vi.restoreAllMocks();
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerDocument(makeTrackDocument(LAYER));
    __resetRailMotionPivotMemoForTests();
    regionBySource = new Map();
    activeRegion = null;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    __resetRailMotionPivotMemoForTests();
  });

  it('returns the displayed key ink box, the rail union pivot and a null base for an ink-less key', () => {
    const records = cycleRecords();
    seedInkDocument(records);
    registerInkCanvases(records);
    installFakeInkDocument();

    // Frame 0 displays key A: its own ink box, pivot over the A∪B union.
    const frameZero = physicPaintStore.getRotoRailMotionCanvasInk(LAYER, TEST_TRACK_ID, 0);
    expect(frameZero).not.toBeNull();
    expect(frameZero?.base).toEqual({ x: 0.1, y: 0.1, width: 0.2, height: 0.2 });
    expect(frameZero?.pivotX).toBeCloseTo(0.35, 12);
    expect(frameZero?.pivotY).toBeCloseTo(0.35, 12);
    expect(Object.isFrozen(frameZero)).toBe(true);

    // Memo identity: a repeat call returns the SAME base object (no re-scan).
    const repeated = physicPaintStore.getRotoRailMotionCanvasInk(LAYER, TEST_TRACK_ID, 0);
    expect(repeated?.base).toBe(frameZero?.base);

    // Frame 1 displays key B: the box re-fits to B's ink.
    const frameOne = physicPaintStore.getRotoRailMotionCanvasInk(LAYER, TEST_TRACK_ID, 1);
    expect(frameOne?.base).toEqual({ x: 0.4, y: 0.4, width: 0.2, height: 0.2 });
    expect(frameOne?.pivotX).toBeCloseTo(0.35, 12);

    // Frame 2 displays the ink-less key C: null base, unchanged union pivot.
    const frameTwo = physicPaintStore.getRotoRailMotionCanvasInk(LAYER, TEST_TRACK_ID, 2);
    expect(frameTwo).not.toBeNull();
    expect(frameTwo?.base).toBeNull();
    expect(frameTwo?.pivotX).toBeCloseTo(0.35, 12);
    expect(frameTwo?.pivotY).toBeCloseTo(0.35, 12);

    // Removing the rail motion retires the whole payload (the full-raster path).
    expect(physicPaintStore.replaceRotoPhysicalRailMotions(LAYER, TEST_TRACK_ID, []).ok).toBe(true);
    expect(physicPaintStore.getRotoRailMotionCanvasInk(LAYER, TEST_TRACK_ID, 0)).toBeNull();
  });

  it('unions the two flanking source keys for a generated in-between', () => {
    const records = [record('A', 0), record('B', 4)];
    seedInkDocument(records, { enabled: true, mode: 'duplicate' });
    registerInkCanvases(records);
    installFakeInkDocument();

    const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, TEST_TRACK_ID, 2);
    expect(source?.kind).toBe('generated');

    const generated = physicPaintStore.getRotoRailMotionCanvasInk(LAYER, TEST_TRACK_ID, 2);
    // A x 0.1..0.3 union B x 0.4..0.6 -> x 0.1..0.6; y likewise. The union
    // differences carry float noise from the normalized scan bounds.
    expect(generated?.base?.x).toBeCloseTo(0.1, 12);
    expect(generated?.base?.y).toBeCloseTo(0.1, 12);
    expect(generated?.base?.width).toBeCloseTo(0.5, 12);
    expect(generated?.base?.height).toBeCloseTo(0.5, 12);
    expect(generated?.pivotX).toBeCloseTo(0.35, 12);
  });

  it('returns null outside the rail span and for an unusable frame or track', () => {
    const records = cycleRecords();
    seedInkDocument(records);
    registerInkCanvases(records);
    installFakeInkDocument();

    // A..E span frames 0..4; 5 is outside the view.
    expect(physicPaintStore.getRotoRailMotionCanvasInk(LAYER, TEST_TRACK_ID, 5)).toBeNull();
    expect(physicPaintStore.getRotoRailMotionCanvasInk(LAYER, TEST_TRACK_ID, -1)).toBeNull();
    expect(physicPaintStore.getRotoRailMotionCanvasInk(LAYER, 'missing-track', 0)).toBeNull();
  });
});
