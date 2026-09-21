import { testWebpBytes } from '../testUtils/testWebpBytes';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals';

// The gesture predicate lives in useRotoTimelineActions, which is a plain hook
// over injected ports — the established harness pattern (see
// useRotoTimelineActions.test.ts) replaces the two hooks it imports.
vi.mock('preact/hooks', () => ({
  useCallback: <Value>(callback: Value) => callback,
  useMemo: <Value>(factory: () => Value) => factory(),
}));

import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import type { PhysicPaintLaunchContext } from '../types/physicPaint';
import { sequenceStore } from '../stores/sequenceStore';
import { projectStore } from '../stores/projectStore';
import { timelineStore } from '../stores/timelineStore';
import {
  physicPaintStore,
  physicPaintVersion,
  physicPaintRotoPhysicalOperationLeaseVersion,
} from '../stores/physicPaintStore';
import {
  getDocument as getEfxPaintDocument,
  registerDocument,
  reset as resetEfxPaintStore,
} from '../stores/efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { resolveSequenceTimelineRange, totalFrames, trackLayouts } from './frameMap';
import { createPhysicPaintLaunchContext } from './physicPaintBridge';
import {
  getCarriedRotoPhysical,
  hydrateRotoPhysicalLaunchContext,
  prepareRotoPhysicalLaunch,
} from '../components/physic-paint/roto/rotoLaunchHydration';
import {
  PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { useRotoTimelineActions } from '../components/physic-paint/hooks/useRotoTimelineActions';
import { deriveKeyRailSegments } from '../components/physic-paint/view/physicsPaintKeyRailPresentation';
import {
  deriveEffectiveRailSetMembers,
  deriveRailSetOrder,
  reconcileRailSetSelection,
  type RailSetSelectionState,
} from '../components/physic-paint/roto/physicsPaintRotoRailSetSelection';

/**
 * quick 260921-pgd Task 1 — DIAGNOSTIC PROBE (zero production code).
 *
 * Builds two real physic-paint layers through the production creation path
 * (createFxSequence + registerDocument(createEfxPaintDocument)) with DISTINCT
 * layer ids and DISTINCT UUID track ids — the fidelity gap that made c7x's
 * layer-2 leg blind (physicPaintBridge.test.ts reseeds both layers as
 * TEST_TRACK_ID = 'track-1'). Then it reads, side by side, every input the
 * gesture decision consumes, and asks the real `useRotoTimelineActions` hook
 * (wired to the layer's real store reads, exactly as the Studio wires it)
 * whether `canDragKey` is eligible and why not.
 *
 * Output is a `[pgd]`-prefixed console log per hypothesis; the assertions pin
 * the invariants the verdict needs (they are NOT a fix contract).
 */

const PROBE = '[pgd]';

function probe(phase: string, payload: unknown): void {
  console.info(`${PROBE}[${phase}] ${JSON.stringify(payload)}`);
}

function makePhysicPaintLayer(layerId: string, name: string): Layer {
  return {
    id: layerId,
    name,
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId },
    isBase: false,
  };
}

function makePhysicalRecord(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    keyId,
    appFrame,
    kind: 'real-key',
    payload: {
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes(`pgd-frame-${appFrame}`),
      width: 64,
      height: 48,
    },
  } as PhysicPaintRotoRealKeyRecord;
}

/** Seed records under THE TRACK ID GIVEN — never the shared test default. */
function seedRecordsUnderTrack(
  layerId: string,
  trackId: string,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  capacity = 600,
): void {
  const result = physicPaintStore.replaceRotoPhysicalDocument(layerId, trackId, {
    capacity,
    realKeyRecords: records,
    interpolation: { enabled: false, mode: 'duplicate' },
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: records[0]?.appFrame ?? 0,
    revision: buildPhysicPaintRotoPhysicalRevision(
      records,
      { enabled: false, mode: 'duplicate' },
      [],
      PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
    ),
    incomingInterpolationBreakKeyIds: PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
  });
  if (!result.ok) throw new Error(`seed failed for ${layerId}/${trackId}: ${result.error}`);
}

interface BuiltLayer {
  readonly label: string;
  readonly layer: Layer;
  readonly layerId: string;
  readonly trackId: string;
  readonly sequenceId: string;
  readonly inFrame: number;
  readonly outFrame: number;
  readonly keyIds: readonly string[];
}

/**
 * The REAL creation path (AddFxMenu.tsx handleAddPhysicPaintLayer): a fresh
 * UUID layer id, createFxSequence, then registerDocument(createEfxPaintDocument).
 * Nothing else — this is what the user does in the main app.
 */
function buildLayerViaRealPath(
  label: string,
  opts: { inFrame?: number; outFrame?: number; keyFrames?: readonly number[] } = {},
): BuiltLayer {
  const layerId = crypto.randomUUID();
  const layer = makePhysicPaintLayer(layerId, label);
  const creation = opts.inFrame === undefined && opts.outFrame === undefined
    ? undefined
    : { inFrame: opts.inFrame ?? 0, outFrame: opts.outFrame ?? totalFrames.peek() };
  const sequence = sequenceStore.createFxSequence('Physic Paint', layer, totalFrames.peek(), creation);
  registerDocument(createEfxPaintDocument(layerId));
  const trackId = getEfxPaintDocument(layerId)?.activeTrackId ?? '';
  const keyIds: string[] = [];
  const keyFrames = opts.keyFrames ?? [];
  if (keyFrames.length > 0) {
    const records = keyFrames.map((appFrame, index) => {
      const keyId = `pgd-${label}-key-${index}`;
      keyIds.push(keyId);
      return makePhysicalRecord(keyId, appFrame);
    });
    seedRecordsUnderTrack(layerId, trackId, records);
  }
  probe('built', {
    label,
    layerId,
    trackId,
    sequenceId: sequence.id,
    inFrame: sequence.inFrame,
    outFrame: sequence.outFrame,
    keyIds,
  });
  return {
    label,
    layer,
    layerId,
    trackId,
    sequenceId: sequence.id,
    inFrame: sequence.inFrame ?? 0,
    outFrame: sequence.outFrame ?? 0,
    keyIds,
  };
}

/** Production `getLayerLocalTimelineRange` (physicPaintBridge.ts:3672-3675), unexported there. */
function layerLocalTimelineRange(built: BuiltLayer) {
  const sequence = sequenceStore.sequences.peek()
    .find((candidate) => candidate.layers.some((candidateLayer) => candidateLayer.id === built.layer.id));
  return sequence ? resolveSequenceTimelineRange(sequence, trackLayouts.peek()) : null;
}

/** The Studio's `trackIdOfLaunch` (PhysicsPaintStudio.tsx:459). */
function trackIdOfLaunch(lc: PhysicPaintLaunchContext | null | undefined): string {
  return lc?.document?.activeTrackId ?? '';
}

/**
 * The Studio's active-track reader (PhysicsPaintStudio.tsx:465-469).
 * `liveDocument` is what getEfxPaintDocument returns in THIS realm.
 */
function studioActiveTrackId(layerId: string, launch: PhysicPaintLaunchContext): string {
  return getEfxPaintDocument(layerId)?.activeTrackId ?? trackIdOfLaunch(launch);
}

/** Every (layerId, trackId) pair the probe's fixtures can hold a lease on. */
function leaseAvailabilityByScope(layerIds: readonly string[], trackIds: readonly string[]) {
  const projectContextId = projectStore.projectContextId.peek();
  const scopes: Record<string, boolean> = {};
  for (const layerId of layerIds) {
    for (const trackId of trackIds) {
      scopes[`${layerId}/${trackId}`] = physicPaintStore.isRotoPhysicalOperationAvailable(
        projectContextId,
        layerId,
        trackId,
      );
    }
  }
  return { projectContextId, leaseVersion: physicPaintRotoPhysicalOperationLeaseVersion.peek(), scopes };
}

/** Side-by-side gesture-time inputs for one built layer + its launch. */
function readGestureInputs(built: BuiltLayer, launch: PhysicPaintLaunchContext) {
  const liveTrackId = getEfxPaintDocument(built.layerId)?.activeTrackId ?? null;
  const launchTrackId = trackIdOfLaunch(launch);
  const range = layerLocalTimelineRange(built);
  const carriedSelectedKeyId = getCarriedRotoPhysical(launch)?.selectedKeyId ?? null;
  const candidates = [...new Set([liveTrackId ?? '', launchTrackId, built.trackId])];
  const perCandidate: Record<string, unknown> = {};
  for (const candidate of candidates) {
    perCandidate[candidate || '<empty>'] = {
      realKeyRecords: physicPaintStore.getRotoRealKeyRecords(built.layerId, candidate).length,
      physicalDocumentPresent: physicPaintStore.getRotoPhysicalDocument(built.layerId, candidate) !== null,
      canInsertFrame: physicPaintStore.getRotoPhysicalProjection(built.layerId, candidate) !== null,
      capacity: physicPaintStore.getRotoPhysicalCapacity(built.layerId, candidate),
    };
  }
  return {
    label: built.label,
    layerId: built.layerId,
    documentRegisteredTrackId: built.trackId,
    documentActiveTrackIdNow: liveTrackId,
    launchDocumentActiveTrackId: launchTrackId,
    readersAgree: liveTrackId === launchTrackId,
    launchStartFrame: launch.startFrame,
    launchedAtGlobalFrame: null as number | null,
    sequenceInFrame: built.inFrame,
    sequenceOutFrame: built.outFrame,
    resolvedRange: range,
    capacityOfActiveTrack: physicPaintStore.getRotoPhysicalCapacity(built.layerId, studioActiveTrackId(built.layerId, launch)),
    carriedSelectedKeyId,
    carriedRecordCount: getCarriedRotoPhysical(launch)?.realKeyRecords.length ?? -1,
    carriedLoopClips: getCarriedRotoPhysical(launch)?.loopClips.length ?? -1,
    perCandidate,
  };
}

/**
 * Ask the REAL gesture predicate. `useRotoTimelineActions` builds
 * `canDragKey = computed(() => computeDragAvailability(input).eligible)` and
 * `dragDisabledReason` from the same call — the reason string names which of
 * the four terms failed.
 */
function readDragAvailability(
  built: BuiltLayer,
  launch: PhysicPaintLaunchContext,
  overrideSelectedKeyId?: string | null,
) {
  const activeTrack = () => studioActiveTrackId(built.layerId, launch);
  const carried = getCarriedRotoPhysical(launch);
  const seededSelectedKeyId = overrideSelectedKeyId === undefined
    ? carried?.selectedKeyId ?? null
    : overrideSelectedKeyId;
  const selectedKeyIdSignal = signal<string | null>(seededSelectedKeyId);
  const pendingOperationIdSignal = signal<string | null>(null);
  const actions = useRotoTimelineActions({
    // The Studio's wiring, term for term (PhysicsPaintStudio.tsx:1573-1635).
    getModel: () => ({ settings: {}, realSourceFrames: [] }) as never,
    getRotoKeyRecords: () => physicPaintStore.getRotoRealKeyRecords(built.layerId, activeTrack()),
    getRotoInterpolationState: () => physicPaintStore.getRotoPhysicalInterpolationState(built.layerId, activeTrack()),
    getCapacity: () => physicPaintStore.getRotoPhysicalCapacity(built.layerId, activeTrack()),
    getParentEndExclusive: () => physicPaintStore.getRotoPhysicalCapacity(built.layerId, activeTrack()),
    getRotoLoopClips: () => physicPaintStore.getRotoPhysicalLoopClips(built.layerId, activeTrack()),
    getSelectedKeyId: () => selectedKeyIdSignal.value,
    getSelectedKeyIds: () => (selectedKeyIdSignal.value ? [selectedKeyIdSignal.value] : []),
    getStoreRealKeyFrames: () => [],
    getStoreRotoFrames: () => [],
    getCurrentSettings: () => physicPaintStore.getRotoInterpolationSettings(built.layerId, activeTrack()),
    setInterpolationSettings: (settings: unknown) => settings,
    getCurrentAppFrame: () => launch.startFrame,
    getPhysicalCells: () => [],
    getFrameResolution: () => ({ kind: 'empty' }),
    getIncomingInterpolationBreakKeyIds: () =>
      physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(built.layerId, activeTrack()),
    getLaunchContext: () => launch,
    getSelectedKeyRail: () => null,
    getSelectedLoopClipIds: () => [],
    getSelectedLoopRailDisplayName: () => null,
    getRailSetMembers: () => [],
    buildBlankRotoFrame: async (appFrame: number) => ({
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes('pgd-blank'),
      width: 64,
      height: 48,
    }),
    executePhysicalEdit: async () => true,
    pendingOperationId: pendingOperationIdSignal,
    publishStatus: () => {},
    setApplyStatus: () => {},
    publishDiagnostic: () => {},
  } as never);
  const physicalActions = actions.physicalActions;
  return {
    label: built.label,
    seededSelectedKeyId,
    canDragKey: physicalActions?.canDragKey.value ?? null,
    dragDisabledReason: physicalActions?.dragDisabledReason.value ?? null,
    canInsertFrame: physicalActions?.canInsertFrame.value ?? null,
    insertDisabledReason: physicalActions?.insertDisabledReason.value ?? null,
  };
}

beforeEach(() => {
  physicPaintStore.reset();
  resetEfxPaintStore();
  sequenceStore.sequences.value = [];
});

afterEach(() => {
  vi.restoreAllMocks();
  physicPaintStore.reset();
  resetEfxPaintStore();
  sequenceStore.sequences.value = [];
});

describe('quick 260921-pgd probe: physic-paint layer 1 vs layer 2 gesture inputs', () => {
  it('H-7 environment: is a DOM available in-process at all?', () => {
    const domAvailable = typeof globalThis.document !== 'undefined'
      && typeof (globalThis.document as Document).querySelectorAll === 'function';
    probe('H-7-environment', {
      domAvailable,
      documentType: typeof globalThis.document,
      elementsCounterReachable: domAvailable,
    });
    // The pointerdown-reaches-the-strip half is unreachable without a DOM.
    expect(domAvailable).toBe(false);
  });

  it('H-1/H-3/H-5: builds layer 1 and layer 2 through the real path and reads every gesture input', () => {
    const layerOne = buildLayerViaRealPath('layer-1', { keyFrames: [0, 3, 6] });
    const layerTwo = buildLayerViaRealPath('layer-2', { keyFrames: [0, 3, 6] });

    expect(layerOne.trackId).not.toBe(layerTwo.trackId);
    expect(layerOne.layerId).not.toBe(layerTwo.layerId);

    const launchOne = createPhysicPaintLaunchContext(
      layerOne.layer, 0, { width: 1920, height: 1080 }, 12, 'Physic Paint',
    );
    const launchTwo = createPhysicPaintLaunchContext(
      layerTwo.layer, 0, { width: 1920, height: 1080 }, 12, 'Physic Paint',
    );

    const inputsOne = readGestureInputs(layerOne, launchOne);
    const inputsTwo = readGestureInputs(layerTwo, launchTwo);
    probe('H-1-side-by-side', { layerOne: inputsOne, layerTwo: inputsTwo });

    probe('H-3-leases', leaseAvailabilityByScope(
      [layerOne.layerId, layerTwo.layerId, '<none>'],
      [layerOne.trackId, layerTwo.trackId, '', '<none>'],
    ));

    const dragOne = readDragAvailability(layerOne, launchOne);
    const dragTwo = readDragAvailability(layerTwo, launchTwo);
    probe('H-1-drag-availability', { layerOne: dragOne, layerTwo: dragTwo });

    // H-5: the move-membership flags, derived through the Studio's own helpers.
    const railFlags = [layerOne, layerTwo].map((built) => {
      const activeTrack = getEfxPaintDocument(built.layerId)?.activeTrackId ?? '';
      const records = physicPaintStore.getRotoRealKeyRecords(built.layerId, activeTrack);
      const segments = deriveKeyRailSegments({
        orderedRealKeys: [...records].sort((left, right) => (
          left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId)
        )),
        incomingInterpolationBreakKeyIds: new Set<string>(),
        groupOwnedKeyIds: new Set<string>(),
      });
      // Real shape: `{ members, anchor }` (physicsPaintRotoRailSetSelection.ts:25-28).
      // A missing/undefined `anchor` makes reconcile fail closed to null, which is
      // what made the first cut of this probe read as "both layers identical" for
      // the wrong reason. Anchor on the segment's own first key.
      const firstKeyId = segments[0]?.firstKeyId ?? null;
      const selection: RailSetSelectionState | null = firstKeyId === null
        ? null
        : {
          members: [{ kind: 'key-rail', firstKeyId }],
          anchor: { kind: 'key-rail', firstKeyId },
        };
      // The Studio derives the canonical ORDER first, then reconciles the set
      // against that ordered identity list (PhysicsPaintStudio.tsx:973-988).
      // Passing the deriveRailSetOrder INPUT (an object) where the list belongs
      // makes reconcile fail closed — the second fidelity gap this probe closes.
      const orderedIdentities = resolveOrderedRailSetIdentities(segments);
      const effective = reconcileRailSetSelection(selection, orderedIdentities);
      // The Studio's own resolver (PhysicsPaintStudio.tsx:1008-1022), verbatim:
      // membership is never re-derived in the view, the strip consumes `keyIds`.
      type MoveMember = { kind: 'loop'; loopId: string }
        | { kind: 'key-rail'; firstKeyId: string; keyIds: readonly string[] };
      const moveMembers: MoveMember[] = [];
      for (const member of effective?.members ?? []) {
        if (member.kind !== 'key-rail') {
          moveMembers.push({ kind: 'loop', loopId: member.loopId });
          continue;
        }
        const segment = segments.find((candidate) => candidate.firstKeyId === member.firstKeyId);
        if (segment) {
          moveMembers.push({ kind: 'key-rail', firstKeyId: segment.firstKeyId, keyIds: segment.keyIds });
        }
      }
      return {
        label: built.label,
        keyRailSegments: segments.length,
        segmentKeyIdCounts: segments.map((segment) => segment.keyIds.length),
        orderedRailSetIdentities: orderedIdentities,
        effectiveRailSetSelection: effective === null ? null : effective.members,
        railSetMoveMembers: moveMembers,
        derivedEffectiveMembers: deriveEffectiveRailSetMembers(effective, records[0]?.keyId ?? null, []).length,
      };
    });
    probe('H-5-move-members', railFlags);

    // The assertions the verdict needs: both layers behave IDENTICALLY, and
    // each layer's own document is keyed by ITS OWN track id (never the other's).
    expect(dragOne.canDragKey).toBe(dragTwo.canDragKey);
    expect(dragOne.canDragKey).toBe(true);
    expect(inputsOne.readersAgree).toBe(true);
    expect(inputsTwo.readersAgree).toBe(true);
    expect(inputsOne.perCandidate[inputsOne.documentActiveTrackIdNow ?? '']).toBeDefined();
    expect(inputsTwo.perCandidate[inputsTwo.documentActiveTrackIdNow ?? '']).toBeDefined();
    expect(inputsOne.documentActiveTrackIdNow).not.toBe(inputsTwo.documentActiveTrackIdNow);
    expect(dragOne.label).toBe('layer-1');
    expect(dragTwo.label).toBe('layer-2');
    void physicPaintVersion;
    void timelineStore;
  });

  it('H-2: the one-slot cached-frames carrier guard across a layer switch', () => {
    const layerOne = buildLayerViaRealPath('layer-1', { keyFrames: [0, 3] });
    const layerTwo = buildLayerViaRealPath('layer-2', { keyFrames: [0, 3] });

    // The Studio's render-body guard (PhysicsPaintStudio.tsx:946-957), verbatim.
    let latestRotoFramesTrackRef = layerOne.trackId;
    const carrierOwnerAtStart = layerOne.label;
    const activeTrackIdNow = getEfxPaintDocument(layerTwo.layerId)?.activeTrackId ?? '';
    const guardFires = latestRotoFramesTrackRef !== activeTrackIdNow;
    const physicalDocument = physicPaintStore.getRotoPhysicalDocument(layerTwo.layerId, activeTrackIdNow);
    let carrierRecovered = false;
    if (physicalDocument) {
      latestRotoFramesTrackRef = activeTrackIdNow;
      carrierRecovered = true;
    }
    probe('H-2-carrier-guard', {
      carrierOwnerAtStart,
      guardFires,
      documentPresentForLayerTwoActiveTrack: physicalDocument !== null,
      carrierRecovered,
      carrierTrackAfter: latestRotoFramesTrackRef,
      expectedTrack: activeTrackIdNow,
    });

    // The pathological arm the plan names: a track id with NO document at all.
    let pathologicalRef = layerOne.trackId;
    const orphanTrackId = 'pgd-orphan-track';
    const orphanDocument = physicPaintStore.getRotoPhysicalDocument(layerTwo.layerId, orphanTrackId);
    if (orphanDocument) pathologicalRef = orphanTrackId;
    probe('H-2-pathological-orphan-track', {
      orphanTrackId,
      documentPresent: orphanDocument !== null,
      guardRefAfter: pathologicalRef,
      guardRecovers: pathologicalRef === orphanTrackId,
    });

    expect(carrierRecovered).toBe(true);
    expect(physicalDocument).not.toBeNull();
  });

  it('H-8 (added): the launch DOOR — prepareRotoPhysicalLaunch accepts layer 2 as readily as layer 1', async () => {
    // The H-6 leg hand-rolled the install loop and so skipped the FIRST link of
    // the real adoption chain: `prepareRotoPhysicalLaunch`, which returns
    // NOT-OK (and therefore aborts the whole launch) when the carried active
    // track has no physical model, when the payload fails to parse, when the
    // projection fails, or when `startFrame !== cursorAppFrame`
    // (rotoLaunchHydration.ts:51-72). An aborted launch leaves the Studio with
    // no physical document, which locks EVERY gesture at once — the reported
    // symptom shape. Layer creation order must not appear anywhere in it.
    const layerOne = buildLayerViaRealPath('layer-1-door', { keyFrames: [0, 3, 6] });
    const layerTwo = buildLayerViaRealPath('layer-2-door', { keyFrames: [0, 3, 6] });
    const launchOne = createPhysicPaintLaunchContext(layerOne.layer, 0, { width: 1920, height: 1080 }, 12);
    const launchTwo = createPhysicPaintLaunchContext(layerTwo.layer, 0, { width: 1920, height: 1080 }, 12);
    // A second layer opened at its OWN playhead frame, the live case: the
    // Studio launches on whatever frame the main app was parked on.
    const launchTwoLater = createPhysicPaintLaunchContext(layerTwo.layer, 3, { width: 1920, height: 1080 }, 12);

    const doorOne = laneOfDoor(prepareRotoPhysicalLaunch(launchOne));
    const doorTwo = laneOfDoor(prepareRotoPhysicalLaunch(launchTwo));
    probe('H-8-launch-door', { layerOne: doorOne, layerTwo: doorTwo });

    // The live adoption call, not a hand-rolled loop: installs every carried
    // track and REJECTS when the active track carries no physical document.
    // Run it for BOTH layers: whatever it does, layer ORDER must not change it.
    // (In-process it stops in the media half — `prepareRotoPhysicalRealKeyFrames`
    // needs a real canvas/Image, absent in the node test environment. That is
    // the same in-process wall as H-7's missing DOM, and it is the reason this
    // leg records an environmental outcome rather than a pass/fail.)
    const installFor = (launch: PhysicPaintLaunchContext) => hydrateRotoPhysicalLaunchContext(launch, {
      replaceRotoPhysicalDocument: (layerId, trackId, value) =>
        physicPaintStore.replaceRotoPhysicalDocument(layerId, trackId, value),
    }).then((result) => ({ ok: result.ok, error: result.ok ? null : result.error }));
    const installOne = await installFor(launchOne);
    const installTwo = await installFor(launchTwo);
    probe('H-8-real-install', { layerOne: installOne, layerTwo: installTwo });

    // The cursor gate, exercised on a non-zero launch frame: startFrame must
    // equal the carried cursor, so a launch that MOVES the cursor is the exact
    // condition that would abort adoption.
    const doorTwoLater = laneOfDoor(prepareRotoPhysicalLaunch(launchTwoLater));
    probe('H-8-cursor-gate', {
      launchStartFrame: launchTwoLater.startFrame,
      carriedCursorAppFrame: getCarriedRotoPhysical(launchTwoLater)?.cursorAppFrame ?? null,
      layerTwoLater: doorTwoLater,
    });

    expect(doorOne.ok).toBe(true);
    expect(doorTwo.ok).toBe(true);
    expect(doorTwoLater.ok).toBe(true);
    // The invariant the defect violates, and the only one in-process can prove:
    // layer 2's adoption outcome is IDENTICAL to layer 1's, term for term.
    expect(installOne.ok).toBe(installTwo.ok);
    expect(installOne.error).toBe(installTwo.error);
  });

  it('H-4: layer-local range asymmetry — a second layer created with a non-zero inFrame', () => {
    // The isolated branch of AddFxMenu.tsx:151-155: the NEW sequence inherits
    // the isolated sub-range, so inFrame is non-zero while its records are
    // authored against a zero-based rail.
    const layerOne = buildLayerViaRealPath('layer-1-isolated-range', { inFrame: 0, outFrame: 60, keyFrames: [0, 3, 6] });
    const layerTwo = buildLayerViaRealPath('layer-2-isolated-range', { inFrame: 20, outFrame: 60, keyFrames: [0, 3, 6] });

    const launchOne = createPhysicPaintLaunchContext(layerOne.layer, 0, { width: 1920, height: 1080 }, 12);
    const launchTwo = createPhysicPaintLaunchContext(layerTwo.layer, 20, { width: 1920, height: 1080 }, 12);

    const rangeOne = layerLocalTimelineRange(layerOne);
    const rangeTwo = layerLocalTimelineRange(layerTwo);
    const inputsOne = readGestureInputs(layerOne, launchOne);
    const inputsTwo = readGestureInputs(layerTwo, launchTwo);

    probe('H-4-local-range', {
      layerOne: {
        range: rangeOne,
        launchStartFrame: launchOne.startFrame,
        capacity: physicPaintStore.getRotoPhysicalCapacity(layerOne.layerId, layerOne.trackId),
        recordsOnRail: physicPaintStore.getRotoRealKeyRecords(layerOne.layerId, layerOne.trackId).length,
      },
      layerTwo: {
        range: rangeTwo,
        launchStartFrame: launchTwo.startFrame,
        capacity: physicPaintStore.getRotoPhysicalCapacity(layerTwo.layerId, layerTwo.trackId),
        recordsOnRail: physicPaintStore.getRotoRealKeyRecords(layerTwo.layerId, layerTwo.trackId).length,
      },
      layerOneInputs: inputsOne.perCandidate,
      layerTwoInputs: inputsTwo.perCandidate,
    });

    const dragOne = readDragAvailability(layerOne, launchOne);
    const dragTwo = readDragAvailability(layerTwo, launchTwo);
    probe('H-4-drag-availability', { layerOne: dragOne, layerTwo: dragTwo });

    expect(rangeOne).not.toBeNull();
    expect(rangeTwo).not.toBeNull();
    expect(rangeTwo?.globalStart).toBe(20);
  });

  it('H-6: the child realm installs every carried track (two-realm leg)', async () => {
    const layerTwo = buildLayerViaRealPath('layer-2-two-realm', { keyFrames: [0, 3, 6] });
    const launchTwo = createPhysicPaintLaunchContext(
      layerTwo.layer, 0, { width: 1920, height: 1080 }, 12, 'Physic Paint',
    );
    const payloadTrackIds = (launchTwo.document?.tracks ?? [])
      .filter((track) => track.rotoPhysical !== null)
      .map((track) => track.id);
    probe('H-6-launch-payload', {
      documentActiveTrackId: launchTwo.document?.activeTrackId,
      documentParentLayerId: launchTwo.document?.parentLayerId,
      payloadLayerId: launchTwo.layerId,
      payloadTrackIds,
      payloadActiveTrackCarriesPhysical: (launchTwo.document?.tracks ?? [])
        .find((track) => track.id === launchTwo.document?.activeTrackId)?.rotoPhysical !== null,
    });

    // The child realm: a fresh module graph, exactly like
    // physicsPaintLaunchRevisionParity.test.ts's second half.
    const childHydration = await import('../components/physic-paint/roto/rotoLaunchHydration');

    vi.resetModules();
    const childStoreModule = await import('../stores/physicPaintStore');
    const childEfxModule = await import('../stores/efxPaintStore');
    const childStore = childStoreModule.physicPaintStore;
    childStore.reset();
    if (childEfxModule.getDocument(launchTwo.layerId) === null) {
      // The child's own efxPaintStore instance is separate; register the
      // carried document exactly as usePhysicsPaintLaunchIntegration does.
      childEfxModule.registerDocument(launchTwo.document!);
    }
    // Install every carried track's physical document, exactly as
    // hydrateRotoPhysicalLaunchContext (:114-119) does. The alpha-canvas
    // preparation is skipped: it needs real canvas/WebP encode ports and does
    // not touch the gesture inputs this probe reads.
    const childCarried = childHydration.getCarriedRotoPhysical(launchTwo);
    let childInstallError: string | null = null;
    for (const track of launchTwo.document?.tracks ?? []) {
      if (!track.rotoPhysical) continue;
      const replacement = childStore.replaceRotoPhysicalDocument(
        launchTwo.layerId, track.id, track.rotoPhysical,
      );
      if (!replacement.ok) childInstallError = replacement.error;
    }
    const childActiveTrackId = childEfxModule.getDocument(launchTwo.layerId)?.activeTrackId ?? null;
    const childRead = {
      childDocumentActiveTrackId: childActiveTrackId,
      childCarriedSelectedKeyId: childCarried?.selectedKeyId ?? null,
      childRealKeyRecordsOnActiveTrack:
        childStore.getRotoRealKeyRecords(launchTwo.layerId, childActiveTrackId ?? '').length,
      childPhysicalDocumentPresent:
        childStore.getRotoPhysicalDocument(launchTwo.layerId, childActiveTrackId ?? '') !== null,
      childLeaseAvailableOnActiveTrack: (() => {
        const contextId = launchTwo.project?.contextId ?? '';
        return contextId
          ? childStore.isRotoPhysicalOperationAvailable(contextId, launchTwo.layerId, childActiveTrackId ?? '')
          : null;
      })(),
      childInstallError,
    };
    probe('H-6-child-realm', childRead);

    expect(payloadTrackIds).toContain(layerTwo.trackId);
    expect(childRead.childRealKeyRecordsOnActiveTrack).toBe(3);
    expect(childRead.childPhysicalDocumentPresent).toBe(true);
  });
});

/** One `prepareRotoPhysicalLaunch` outcome, reduced to its comparable lane. */
function laneOfDoor(result: { ok: boolean; error?: string }) {
  return { ok: result.ok, error: result.ok ? null : (result.error ?? 'unknown') };
}

/**
 * The Studio's `orderedRailSetIdentities` (PhysicsPaintStudio.tsx:973-979),
 * verbatim: deriveRailSetOrder over the key-rail segments + loop ranges.
 */
function resolveOrderedRailSetIdentities(segments: ReturnType<typeof deriveKeyRailSegments>) {
  return deriveRailSetOrder({
    keyRailSegments: segments,
    loopRanges: [] as readonly never[],
  });
}
