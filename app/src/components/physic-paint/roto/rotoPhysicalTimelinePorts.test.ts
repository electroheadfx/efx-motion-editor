import { describe, expect, it } from 'vitest';
import { signal } from '@preact/signals';
import {
  createRotoPhysicalTimelinePorts,
  getRotoPhysicalSelectableKeyId,
  type RotoPhysicalTimelineView,
} from './rotoPhysicalTimelinePorts';
import {
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoLoopFrame,
  resolvePhysicPaintRotoSpacingProxy,
} from './physicsPaintRotoPhysicalResolver';
import type { PhysicPaintRotoRealKeyRecord } from './physicsPaintRotoPhysicalModel';

/**
 * Phase 43-02 — selection-port exclusion for virtual linked occurrences
 * (D-23/D-11, RESEARCH Pitfall 7). A linked or 'linked-unresolved' frame
 * never produces a key selection, a drag start, or Force Spacing eligibility
 * through the read/selection port boundary.
 */

const SOURCE_KEYS = [
  { keyId: 'A', appFrame: 10 },
  { keyId: 'B', appFrame: 11 },
  { keyId: 'C', appFrame: 12 },
  { keyId: 'D', appFrame: 13 },
  { keyId: 'E', appFrame: 14 },
];

function realKeyRecord(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      dataUrl: 'data:image/png;base64,AAAA',
      width: 2,
      height: 2,
    },
  };
}

function buildLoopContext() {
  return derivePhysicPaintRotoLoopRanges({
    identities: SOURCE_KEYS,
    loopClips: [{
      loopId: 'L1',
      placementStart: 10,
      sourceKeyIds: ['A', 'B', 'C', 'D', 'E'],
      repeat: 5,
      mode: 'static',
    }],
    parentEndExclusive: 600,
    capacity: 600,
    interpolationEnabled: false,
  });
}

describe('getRotoPhysicalSelectableKeyId — virtual occurrence exclusion (D-23/D-11)', () => {
  it('returns a selection only for real frames; linked, linked-unresolved, and empty yield none', () => {
    const context = buildLoopContext();

    expect(getRotoPhysicalSelectableKeyId(resolvePhysicPaintRotoLoopFrame(context, 10))).toBe('A');
    expect(getRotoPhysicalSelectableKeyId(resolvePhysicPaintRotoLoopFrame(context, 18))).toBeNull();
    expect(getRotoPhysicalSelectableKeyId(resolvePhysicPaintRotoLoopFrame(context, 99))).toBeNull();

    const unresolvedContext = derivePhysicPaintRotoLoopRanges({
      identities: SOURCE_KEYS.slice(0, 3),
      loopClips: [{
        loopId: 'L1',
        placementStart: 10,
        sourceKeyIds: ['A', 'B', 'C', 'D', 'E'],
        repeat: 5,
        mode: 'static',
      }],
      parentEndExclusive: 600,
      capacity: 600,
      interpolationEnabled: false,
    });
    const unresolved = resolvePhysicPaintRotoLoopFrame(unresolvedContext, 18);
    expect(unresolved.kind).toBe('linked-unresolved');
    expect(getRotoPhysicalSelectableKeyId(unresolved)).toBeNull();
  });

  it('keeps linked-generated and linked-gap interiors non-selectable', () => {
    const variants = [
      {
        kind: 'linked-generated' as const,
        loopId: 'L1', appFrame: 16,
        leftSourceKeyId: 'A', rightSourceKeyId: 'B',
        leftSourceIndex: 0, rightSourceIndex: 1,
        progress: 1 / 3, sourceCycleId: '1:A|1:B|1:C', cycleOffset: 1, repeatInstance: 1,
      },
      {
        kind: 'linked-gap' as const,
        loopId: 'L1', appFrame: 16,
        leftSourceKeyId: 'A', rightSourceKeyId: 'B',
        leftSourceIndex: 0, rightSourceIndex: 1,
        cycleOffset: 1, repeatInstance: 1,
      },
    ];

    expect(variants.map(getRotoPhysicalSelectableKeyId)).toEqual([null, null]);
  });
});

describe('resolvePhysicPaintRotoSpacingProxy — exact source positions only', () => {
  it('finds original real source positions and linked repeat positions with one ordered cycle identity', () => {
    const context = buildLoopContext();

    const original = resolvePhysicPaintRotoSpacingProxy(context, 11);
    const repeat = resolvePhysicPaintRotoSpacingProxy(context, 16);

    expect(resolvePhysicPaintRotoLoopFrame(context, 11)).toEqual({ kind: 'real', keyId: 'B', appFrame: 11 });
    expect(original).toMatchObject({ loopId: 'L1', sourceKeyId: 'B', sourceIndex: 1, sourceKeyIds: ['A', 'B', 'C', 'D', 'E'] });
    expect(repeat).toMatchObject({ loopId: 'L1', sourceKeyId: 'B', sourceIndex: 1, sourceKeyIds: ['A', 'B', 'C', 'D', 'E'] });
    expect(repeat?.sourceCycleId).toBe(original?.sourceCycleId);
  });

  it('excludes generated, gap, unresolved, non-loop real, and empty frames', () => {
    const spacedIdentities = [
      { keyId: 'A', appFrame: 10 },
      { keyId: 'B', appFrame: 13 },
      { keyId: 'C', appFrame: 16 },
      { keyId: 'OUTSIDE', appFrame: 80 },
    ];
    const clip = [{ loopId: 'L1', placementStart: 10, sourceKeyIds: ['A', 'B', 'C'], repeat: 3, mode: 'static' as const }];
    const generatedContext = derivePhysicPaintRotoLoopRanges({ identities: spacedIdentities, loopClips: clip, parentEndExclusive: 100, capacity: 100, interpolationEnabled: true });
    const gapContext = derivePhysicPaintRotoLoopRanges({ identities: spacedIdentities, loopClips: clip, parentEndExclusive: 100, capacity: 100, interpolationEnabled: false });
    const unresolvedContext = derivePhysicPaintRotoLoopRanges({ identities: spacedIdentities.slice(0, 2), loopClips: clip, parentEndExclusive: 100, capacity: 100, interpolationEnabled: false });

    expect(resolvePhysicPaintRotoLoopFrame(generatedContext, 11).kind).toBe('linked-generated');
    expect(resolvePhysicPaintRotoSpacingProxy(generatedContext, 11)).toBeNull();
    expect(resolvePhysicPaintRotoLoopFrame(gapContext, 11).kind).toBe('linked-gap');
    expect(resolvePhysicPaintRotoSpacingProxy(gapContext, 11)).toBeNull();
    expect(resolvePhysicPaintRotoLoopFrame(unresolvedContext, 11).kind).toBe('linked-unresolved');
    expect(resolvePhysicPaintRotoSpacingProxy(unresolvedContext, 11)).toBeNull();
    expect(resolvePhysicPaintRotoSpacingProxy(generatedContext, 80)).toBeNull();
    expect(resolvePhysicPaintRotoSpacingProxy(generatedContext, 99)).toBeNull();
  });
});

describe('createRotoPhysicalTimelinePorts — loop resolution pass-through', () => {
  it('threads getFrameResolution and never selects a key at a linked frame', () => {
    const records = SOURCE_KEYS.map((identity) => realKeyRecord(identity.keyId, identity.appFrame));
    const context = buildLoopContext();
    const view: RotoPhysicalTimelineView = {
      orderedRealKeyRecords: records,
      physicalCells: [],
      generatedCells: [],
      orderedKeyIds: records.map((record) => record.keyId),
      currentCell: { kind: 'empty', appFrame: 0 },
      selectedKeyId: null,
      selectedRealKey: null,
      selectedAppFrame: null,
      currentAppFrame: 0,
      interpolation: { enabled: false, mode: 'duplicate' },
      capacity: 600,
    };

    const ports = createRotoPhysicalTimelinePorts({
      layerId: 'layer-1',
      view: signal(view),
      selectedKeyId: signal<string | null>(null),
      currentAppFrame: signal(0),
      interpolation: signal(view.interpolation),
      revision: signal(0),
      getOrderedRealKeyRecords: () => records,
      getRealKeyRecord: (keyId) => records.find((record) => record.keyId === keyId) ?? null,
      getRealKeyRecordByAppFrame: (appFrame) => records.find((record) => record.appFrame === appFrame) ?? null,
      getCurrentCell: () => view.currentCell,
      getView: () => view,
      getFrameResolution: (appFrame) => resolvePhysicPaintRotoLoopFrame(context, appFrame),
    });

    // Linked virtual frame 18: no key selection through either port surface.
    const linkedResolution = ports.getFrameResolution?.(18);
    expect(linkedResolution).toMatchObject({ kind: 'linked', loopId: 'L1' });
    expect(getRotoPhysicalSelectableKeyId(linkedResolution!)).toBeNull();
    expect(ports.getRealKeyRecordByAppFrame(18)).toBeNull();

    // Real source-key frame 10 keeps its selection.
    const realResolution = ports.getFrameResolution?.(10);
    expect(realResolution).toEqual({ kind: 'real', keyId: 'A', appFrame: 10 });
    expect(getRotoPhysicalSelectableKeyId(realResolution!)).toBe('A');
    expect(ports.getRealKeyRecordByAppFrame(10)?.keyId).toBe('A');
  });

  it('omitting getFrameResolution keeps the bundle behavior unchanged', () => {
    const records = SOURCE_KEYS.map((identity) => realKeyRecord(identity.keyId, identity.appFrame));
    const view: RotoPhysicalTimelineView = {
      orderedRealKeyRecords: records,
      physicalCells: [],
      generatedCells: [],
      orderedKeyIds: [],
      currentCell: { kind: 'empty', appFrame: 0 },
      selectedKeyId: null,
      selectedRealKey: null,
      selectedAppFrame: null,
      currentAppFrame: 0,
      interpolation: { enabled: false, mode: 'duplicate' },
      capacity: 600,
    };
    const ports = createRotoPhysicalTimelinePorts({
      layerId: 'layer-1',
      view: signal(view),
      selectedKeyId: signal<string | null>(null),
      currentAppFrame: signal(0),
      interpolation: signal(view.interpolation),
      revision: signal(0),
      getOrderedRealKeyRecords: () => records,
      getRealKeyRecord: () => null,
      getRealKeyRecordByAppFrame: () => null,
      getCurrentCell: () => view.currentCell,
      getView: () => view,
    });
    expect(ports.getFrameResolution).toBeUndefined();
    expect(ports.layerId).toBe('layer-1');
  });
});
