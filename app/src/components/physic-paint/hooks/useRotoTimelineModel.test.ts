import { afterEach, describe, expect, it, vi } from 'vitest';
import { effect } from '@preact/signals';

vi.mock('preact/hooks', () => ({
  useMemo: <Value>(factory: () => Value) => factory(),
}));

import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type {
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import * as physicalResolverModule from '../roto/physicsPaintRotoPhysicalResolver';
import {
  createRotoTimelineModel,
  useRotoTimelineModel,
  type RotoTimelineModelInput,
} from './useRotoTimelineModel';

const BLANK_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

function blankPayload(appFrame: number): PhysicPaintRotoRealKeyPayload {
  return Object.freeze({
    frameIndex: 0,
    appFrame,
    dataUrl: BLANK_PNG_DATA_URL,
    width: 100,
    height: 80,
  }) as PhysicPaintRotoRealKeyPayload;
}

function realKeyRecord(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return Object.freeze({
    kind: 'real-key',
    keyId,
    appFrame,
    payload: blankPayload(appFrame),
  }) as PhysicPaintRotoRealKeyRecord;
}

/** 60 frozen real-key records at spacing 2 (appFrames 0, 2, ..., 118). */
function buildSixtyRecords(): PhysicPaintRotoRealKeyRecord[] {
  return Array.from({ length: 60 }, (_, index) => realKeyRecord(`key-${index}`, index * 2));
}

function physicalInput(overrides: Partial<RotoTimelineModelInput> = {}): RotoTimelineModelInput {
  return {
    rotoKeyRecords: buildSixtyRecords(),
    rotoInterpolationState: { enabled: true, mode: 'duplicate' },
    capacity: 200,
    currentFrame: 0,
    selectedKeyId: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useRotoTimelineModel structural/frame split (38.1 D-07)', () => {
  it('writes to the current frame trigger zero structural projection rebuilds', () => {
    const projectionSpy = vi.spyOn(physicalResolverModule, 'projectPhysicPaintRotoPhysicalTimeline');
    const model = createRotoTimelineModel(physicalInput());
    const dispose = effect(() => {
      void model.currentCell.value;
      void model.physicalCells.value;
    });
    const cellsBefore = model.physicalCells.value;
    const callsBefore = projectionSpy.mock.calls.length;
    // Sanity: the spy intercepts the structural projection call.
    expect(callsBefore).toBeGreaterThan(0);

    for (let frame = 0; frame < 50; frame += 1) {
      model.setCurrentFrame(frame);
    }

    expect(projectionSpy.mock.calls.length).toBe(callsBefore);
    expect(model.physicalCells.value).toBe(cellsBefore);
    dispose();
  });

  it('tracks frame and selection writes through cheap frame-dependent computeds', () => {
    const records = [realKeyRecord('key-a', 0), realKeyRecord('key-b', 4)];
    const model = createRotoTimelineModel(physicalInput({
      rotoKeyRecords: records,
      capacity: 10,
      currentFrame: 0,
    }));

    // Real-key frame.
    model.setCurrentFrame(0);
    expect(model.currentCell.value.kind).toBe('real');

    // Selection tracks setSelectedKeyId.
    model.setSelectedKeyId('key-b');
    expect(model.selectedKeyId.value).toBe('key-b');
    expect(model.selectedRealKey.value?.keyId).toBe('key-b');
    expect(model.selectedAppFrame.value).toBe(4);

    // Empty frame falls back to { kind: 'empty', appFrame }.
    model.setCurrentFrame(7);
    expect(model.currentCell.value).toEqual({ kind: 'empty', appFrame: 7 });

    // Generated interior frame.
    model.setCurrentFrame(2);
    expect(model.currentCell.value.kind).toBe('generated');
  });

  it('suppresses only the generated span entering an accepted break owner', () => {
    const model = createRotoTimelineModel(physicalInput({
      rotoKeyRecords: [
        realKeyRecord('key-0', 0),
        realKeyRecord('key-16', 16),
        realKeyRecord('key-32', 32),
      ],
      incomingInterpolationBreakKeyIds: ['key-32'],
      capacity: 40,
      currentFrame: 31,
    }));

    expect(model.physicalCells.value[1]).toMatchObject({ kind: 'generated', appFrame: 1 });
    expect(model.currentCell.value).toEqual({ kind: 'empty', appFrame: 31 });
    expect(model.generatedCells.value.at(-1)).toMatchObject({ kind: 'generated', appFrame: 15 });
  });

  it('re-runs the structural projection exactly once when the records input is replaced', () => {
    const projectionSpy = vi.spyOn(physicalResolverModule, 'projectPhysicPaintRotoPhysicalTimeline');
    const modelA = useRotoTimelineModel(physicalInput());
    const cellsA = modelA.physicalCells.value;
    const callsAfterA = projectionSpy.mock.calls.length;
    expect(callsAfterA).toBeGreaterThan(0);

    const modelB = useRotoTimelineModel(physicalInput({ rotoKeyRecords: buildSixtyRecords() }));
    const cellsB = modelB.physicalCells.value;

    expect(projectionSpy.mock.calls.length).toBe(callsAfterA + 1);
    expect(cellsB).not.toBe(cellsA);
    // Value parity: identical inputs produce identical values.
    expect(cellsB).toEqual(cellsA);
  });

  it('fails closed with the selector empty-view shape on invalid identities', () => {
    const model = createRotoTimelineModel(physicalInput({
      rotoKeyRecords: [realKeyRecord('key-a', 3), realKeyRecord('key-b', 3)],
      rotoInterpolationState: { enabled: false, mode: 'duplicate' },
      capacity: 10,
      currentFrame: 5,
      selectedKeyId: 'key-a',
    }));

    expect(model.physicalCells.value).toEqual([]);
    expect(model.currentCell.value).toEqual({ kind: 'empty', appFrame: 5 });
    expect(model.selectedRealKey.value).toBeNull();
    expect(model.selectedAppFrame.value).toBeNull();
    expect(model.physicalView.value.projection).toBeNull();
  });
});

describe('useRotoTimelineModel legacy parity (38.1 D-09)', () => {
  function cachedRealKeyFrame(appFrame: number, sourceFrame: number): PhysicPaintRotoCacheFrame {
    return {
      frameIndex: appFrame,
      appFrame,
      sourceFrame,
      displayFrame: appFrame,
      source: 'real-key',
      dataUrl: `data:image/png;base64,real-${appFrame}`,
    };
  }

  it('legacy frame-dependent computeds track frame writes with selector semantics', () => {
    const model = createRotoTimelineModel(physicalInput({
      cachedRotoFrames: [cachedRealKeyFrame(0, 0), cachedRealKeyFrame(4, 4)],
      interpolationSettings: { enabled: true, inBetweenCount: 1, mode: 'duplicate' },
      currentFrame: 0,
    }));

    // Real-key frame.
    model.setCurrentFrame(0);
    expect(model.currentFrameSelectionKind.value).toBe('real-key');
    expect(model.currentFrameIsGenerated.value).toBe(false);

    // Generated-interpolation frame (source keys 0 and 4 with 1 in-between
    // -> display 0 real, display 1 generated, display 2 real).
    model.setCurrentFrame(1);
    expect(model.currentFrameSelectionKind.value).toBe('generated-interpolation');
    expect(model.currentFrameIsGenerated.value).toBe(true);

    // Empty frame.
    model.setCurrentFrame(3);
    expect(model.currentFrameSelectionKind.value).toBe('empty');
    expect(model.currentFrameIsGenerated.value).toBe(false);
    expect(model.currentFrameOwnerSourceFrame.value).toBeNull();
  });

  it('legacy structural outputs keep reference identity across frame writes', () => {
    const model = createRotoTimelineModel(physicalInput({
      cachedRotoFrames: [cachedRealKeyFrame(0, 0), cachedRealKeyFrame(4, 4)],
      interpolationSettings: { enabled: true, inBetweenCount: 1, mode: 'duplicate' },
      currentFrame: 0,
    }));

    const occupiedBefore = model.occupiedRotoFrames.value;
    const savedBefore = model.savedRotoFrames.value;
    const cachedBefore = model.cachedRotoFrames.value;

    for (let frame = 0; frame < 50; frame += 1) {
      model.setCurrentFrame(frame);
    }

    expect(model.occupiedRotoFrames.value).toBe(occupiedBefore);
    expect(model.savedRotoFrames.value).toBe(savedBefore);
    expect(model.cachedRotoFrames.value).toBe(cachedBefore);
  });
});

describe('useRotoTimelineModel loop resolution threading (43-02)', () => {
  function loopInput(overrides: Partial<RotoTimelineModelInput> = {}): RotoTimelineModelInput {
    return physicalInput({
      rotoKeyRecords: [10, 11, 12, 13, 14].map((appFrame, index) => realKeyRecord(`key-${index}`, appFrame)),
      rotoInterpolationState: { enabled: false, mode: 'duplicate' },
      capacity: 600,
      currentFrame: 0,
      rotoLoopClips: [{
        loopId: 'L1',
        placementStart: 10,
        sourceKeyIds: ['key-0', 'key-1', 'key-2', 'key-3', 'key-4'],
        repeat: 5,
        mode: 'static',
      }],
      rotoParentEndExclusive: 600,
      ...overrides,
    });
  }

  it('derives the loop resolution context structurally and resolves frames lazily', () => {
    const model = createRotoTimelineModel(loopInput());

    expect(model.loopResolutionContext.value.ranges).toHaveLength(1);
    expect(model.loopResolutionContext.value.ranges[0]).toMatchObject({
      loopId: 'L1',
      placementStart: 10,
      effectiveEnd: 35,
    });

    // Real frames win; virtual frames resolve linked; the typed contract also
    // covers 'linked-unresolved' and 'empty' (kind handling lives in the
    // exhaustiveness-guarded consumer helpers, not in this model).
    expect(model.getFrameResolution(10)).toEqual({ kind: 'real', keyId: 'key-0', appFrame: 10 });
    expect(model.getFrameResolution(18)).toMatchObject({ kind: 'linked', loopId: 'L1', sourceKeyId: 'key-3' });
    expect(model.getFrameResolution(99)).toEqual({ kind: 'empty' });
  });

  it('a linked frame never produces a key selection through the model', () => {
    const model = createRotoTimelineModel(loopInput({ currentFrame: 18 }));

    // No selected keyId exists for a virtual occurrence: selection signals
    // stay null unless a real-key keyId is explicitly selected (D-23/D-11).
    expect(model.getFrameResolution(18).kind).toBe('linked');
    expect(model.selectedKeyId.value).toBeNull();
    expect(model.selectedRealKey.value).toBeNull();
    expect(model.selectedAppFrame.value).toBeNull();
  });

  it('threads interpolation state into spaced linked generated/gap variants without selecting them', () => {
    const records = [realKeyRecord('A', 0), realKeyRecord('B', 3), realKeyRecord('C', 6)];
    const loop = [{ loopId: 'L1', placementStart: 10, sourceKeyIds: ['A', 'B', 'C'], repeat: 2 as const, mode: 'static' as const }];
    const generated = createRotoTimelineModel(loopInput({
      rotoKeyRecords: records,
      rotoInterpolationState: { enabled: true, mode: 'duplicate' },
      rotoLoopClips: loop,
      currentFrame: 11,
    }));
    expect(generated.loopResolutionContext.value.ranges[0]).toMatchObject({ cycleLength: 7, sourceFrameCount: 3 });
    expect(generated.getFrameResolution(11)).toMatchObject({ kind: 'linked-generated', progress: 1 / 3 });
    expect(generated.selectedKeyId.value).toBeNull();

    const gaps = createRotoTimelineModel(loopInput({
      rotoKeyRecords: records,
      rotoInterpolationState: { enabled: false, mode: 'duplicate' },
      rotoLoopClips: loop,
      currentFrame: 11,
    }));
    expect(gaps.getFrameResolution(11)).toMatchObject({ kind: 'linked-gap' });
    expect(gaps.selectedKeyId.value).toBeNull();
  });

  it('absent loop inputs derive an empty loop resolution context with unchanged behavior', () => {
    const model = createRotoTimelineModel(physicalInput());

    expect(model.loopResolutionContext.value.ranges).toEqual([]);
    expect(model.getFrameResolution(0)).toEqual({ kind: 'real', keyId: 'key-0', appFrame: 0 });
    expect(model.getFrameResolution(1)).toEqual({ kind: 'empty' });
  });
});
