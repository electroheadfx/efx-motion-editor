// 261117-e6j: the coordinator's post-publication drift check
// (useRotoPhysicalEditCoordinator.ts:1660-1690) is the consumer of this
// invariant: the six-argument revision staged from a Delete Rails proposal must
// equal the revision the store publishes and reads back, or every settlement
// drifts and a parent-accepted edit is reported as a failure. These specs drive
// the REAL proposer, reconciler, revision builder, strict parser and store
// write/read path — WITHOUT the coordinator — so the delete-specific drift
// hypothesis stays permanently falsifiable.
import { describe, expect, it } from 'vitest';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { proposePhysicPaintRotoDeleteRails } from './physicsPaintRotoGroupLifecycle';
import { reconcileRailMotionsForDocumentEdit } from './railMotionDocumentReconciler';
import type { PhysicPaintRotoRailMotionRecord } from './railMotionModel';
import type { RailSetDeleteMember } from '../../../types/physicPaint';

const TRACK = 'track-1';
const INTERPOLATION: PhysicPaintRotoInterpolationState = { enabled: false, mode: 'duplicate' };

/** Keys A@0 / B@2 / C@4, the one fixture every delete shape derives segments from. */
function scenarioRecords(): PhysicPaintRotoRealKeyRecord[] {
  return ['A', 'B', 'C'].map((keyId, index) => {
    const appFrame = index * 2;
    return {
      kind: 'real-key',
      keyId,
      appFrame,
      payload: {
        frameIndex: 0,
        appFrame,
        bytes: testWebpBytes(btoa(`delete-settlement:${keyId}:${appFrame}`)),
        width: 4,
        height: 4,
      },
    };
  });
}

function railMotion(railId: string, anchorKeyId: string): PhysicPaintRotoRailMotionRecord {
  return {
    railId,
    anchorKeyId,
    channels: [
      {
        id: 'opacity',
        wiggle: 0,
        wiggleGlobal: true,
        keys: [{ frame: 0, value: 0.5, easing: 'ease', wiggle: 0 }],
      },
    ],
  };
}

function keyFramePairs(records: readonly PhysicPaintRotoRealKeyRecord[]) {
  return records.map(({ keyId, appFrame }) => ({ keyId, appFrame }));
}

interface ScenarioInput {
  readonly layerId: string;
  readonly selectedKeyId: string | null;
  readonly cursorAppFrame: number;
  readonly incomingBreaks?: readonly string[];
  readonly railMotions?: readonly PhysicPaintRotoRailMotionRecord[];
  readonly deleteMember: RailSetDeleteMember;
}

interface ScenarioResult {
  readonly seeded: PhysicPaintRotoPhysicalDocument;
  readonly proposal: PhysicPaintRotoPhysicalDocument;
  readonly stagedRevision: string;
  readonly deferred: PhysicPaintRotoPhysicalDocument;
  readonly reconciledRailMotions: readonly PhysicPaintRotoRailMotionRecord[];
  readonly readBack: PhysicPaintRotoPhysicalDocument;
}

/**
 * Seed → propose → reconcile → stage → publish → read back, in the exact order
 * the coordinator stages a Delete Rails edit. Each scenario owns a distinct
 * layer id, so no store reset is needed.
 */
function runScenario(input: ScenarioInput): ScenarioResult {
  const records = scenarioRecords();
  const breaks = input.incomingBreaks ?? [];
  const railMotions = input.railMotions ?? [];
  const seeded = physicPaintStore.replaceRotoPhysicalDocument(input.layerId, TRACK, {
    capacity: 600,
    realKeyRecords: records,
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: input.selectedKeyId,
    cursorAppFrame: input.cursorAppFrame,
    revision: buildPhysicPaintRotoPhysicalRevision(records, INTERPOLATION, [], breaks, [], railMotions),
    loopClips: [],
    railMotions,
    incomingInterpolationBreakKeyIds: breaks,
  });
  if (!seeded.ok) throw new Error(`Seed rejected: ${seeded.error}`);

  const document = physicPaintStore.getRotoPhysicalDocument(input.layerId, TRACK);
  if (document === null) throw new Error('Seed read-back returned no document.');

  const proposed = proposePhysicPaintRotoDeleteRails({
    document,
    members: [input.deleteMember],
  });
  if (!proposed.ok) throw new Error(`Delete Rails proposal rejected: ${proposed.reason}`);
  const proposal = proposed.proposal;

  const reconciliation = reconcileRailMotionsForDocumentEdit({
    previous: {
      realKeyRecords: document.realKeyRecords,
      incomingInterpolationBreakKeyIds: new Set(document.incomingInterpolationBreakKeyIds),
      loopClips: document.loopClips,
    },
    next: {
      realKeyRecords: proposal.realKeyRecords,
      incomingInterpolationBreakKeyIds: new Set(proposal.incomingInterpolationBreakKeyIds),
      loopClips: proposal.loopClips,
    },
    railMotions: document.railMotions ?? [],
  });

  const stagedRevision = buildPhysicPaintRotoPhysicalRevision(
    proposal.realKeyRecords,
    proposal.interpolation,
    proposal.loopClips,
    proposal.incomingInterpolationBreakKeyIds,
    proposal.groupOverrideRecords ?? [],
    reconciliation.railMotions,
  );

  const deferred = parsePhysicPaintRotoPhysicalDocument({
    ...document,
    realKeyRecords: proposal.realKeyRecords,
    groupOverrideRecords: proposal.groupOverrideRecords,
    interpolation: proposal.interpolation,
    selectedKeyId: proposal.selectedKeyId,
    cursorAppFrame: proposal.cursorAppFrame,
    revision: stagedRevision,
    loopClips: proposal.loopClips,
    railMotions: reconciliation.railMotions,
    incomingInterpolationBreakKeyIds: proposal.incomingInterpolationBreakKeyIds,
  });

  const published = physicPaintStore.replaceRotoPhysicalDocument(input.layerId, TRACK, deferred);
  if (!published.ok) throw new Error(`Publish rejected: ${published.error}`);

  const readBack = physicPaintStore.getRotoPhysicalDocument(input.layerId, TRACK);
  if (readBack === null) throw new Error('Publish read-back returned no document.');

  return {
    seeded: document,
    proposal,
    stagedRevision,
    deferred,
    reconciledRailMotions: reconciliation.railMotions,
    readBack,
  };
}

function expectSettlementAgreement(result: ScenarioResult): void {
  expect(result.readBack.revision).toBe(result.stagedRevision);
  expect(result.readBack.selectedKeyId).toBe(result.deferred.selectedKeyId);
  expect(result.readBack.cursorAppFrame).toBe(result.deferred.cursorAppFrame);
  expect(keyFramePairs(result.readBack.realKeyRecords)).toEqual(
    keyFramePairs(result.proposal.realKeyRecords),
  );
  expect(result.readBack.railMotions).toEqual(result.reconciledRailMotions);
}

describe('261117-e6j: a rail delete republishes the exact revision it staged', () => {
  it('keeps the staged revision, selection and cursor when the whole rail with a selected middle key is deleted', () => {
    const result = runScenario({
      layerId: 'layer-e6j-whole-rail',
      selectedKeyId: 'B',
      cursorAppFrame: 2,
      deleteMember: { kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B', 'C'] },
    });

    expectSettlementAgreement(result);
    expect(result.readBack.realKeyRecords).toHaveLength(0);
    expect(result.readBack.selectedKeyId).toBeNull();
    expect(result.readBack.cursorAppFrame).toBe(2);
  });

  it('keeps the staged revision when a rail motion anchored on a deleted key reconciles away', () => {
    const result = runScenario({
      layerId: 'layer-e6j-motion-rail',
      selectedKeyId: 'B',
      cursorAppFrame: 2,
      railMotions: [railMotion('rail-1', 'B')],
      deleteMember: { kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B', 'C'] },
    });

    // Guard: the seed really carried motion, so "reconciled away" is not vacuous.
    expect(result.seeded.railMotions).toHaveLength(1);
    expectSettlementAgreement(result);
    expect(result.readBack.realKeyRecords).toHaveLength(0);
    expect(result.reconciledRailMotions).toHaveLength(0);
    expect(result.readBack.railMotions).toHaveLength(0);
  });

  it('keeps the staged revision for a break-separated trailing single-key rail', () => {
    const result = runScenario({
      layerId: 'layer-e6j-trailing-rail',
      selectedKeyId: 'C',
      cursorAppFrame: 4,
      incomingBreaks: ['C'],
      deleteMember: { kind: 'key-rail', firstKeyId: 'C', keyIds: ['C'] },
    });

    expectSettlementAgreement(result);
    expect(keyFramePairs(result.readBack.realKeyRecords)).toEqual([
      { keyId: 'A', appFrame: 0 },
      { keyId: 'B', appFrame: 2 },
    ]);
    expect(result.readBack.selectedKeyId).toBe('B');
    expect(result.readBack.cursorAppFrame).toBe(2);
  });

  it('keeps the staged revision for a leading rail whose selected survivor stays selected', () => {
    const result = runScenario({
      layerId: 'layer-e6j-leading-rail',
      selectedKeyId: 'C',
      cursorAppFrame: 4,
      incomingBreaks: ['C'],
      deleteMember: { kind: 'key-rail', firstKeyId: 'A', keyIds: ['A', 'B'] },
    });

    expectSettlementAgreement(result);
    expect(keyFramePairs(result.readBack.realKeyRecords)).toEqual([{ keyId: 'C', appFrame: 4 }]);
    expect(result.readBack.selectedKeyId).toBe('C');
    expect(result.readBack.cursorAppFrame).toBe(4);
  });
});
