import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import { saveRotoRealKeyTransaction } from './physicsPaintRotoKeyController';
import {
  getRotoFrameKeyInteraction,
  resolveRotoVisibleFrameResolutions,
  selectProjectedRealCachedRotoFrames,
  selectRealCachedRotoFrames,
  selectRotoPhysicalTimelineStructuralView,
  selectRotoTimelineView,
} from './rotoTimelineSelectors';
import {
  derivePhysicPaintRotoLoopRanges,
  resolvePhysicPaintRotoLoopFrame,
} from './physicsPaintRotoPhysicalResolver';
import { createRotoTimelineModel } from '../hooks/useRotoTimelineModel';

function frame(appFrame: number, sourceFrame: number, source: PhysicPaintRotoCacheFrame['source'] = 'real-key'): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: appFrame,
    appFrame,
    sourceFrame,
    displayFrame: appFrame,
    source,
    dataUrl: `data:image/png;base64,${source}-${appFrame}`,
  };
}

describe('rotoTimelineSelectors', () => {
  it('normalizes cached real keys onto their display frames without including generated cells', () => {
    expect(selectRealCachedRotoFrames([
      frame(0, 0),
      { ...frame(3, 1), appFrame: 1, displayFrame: 3 },
      frame(2, 1, 'generated-interpolation'),
    ])).toEqual([
      frame(0, 0),
      { ...frame(3, 1), appFrame: 3, displayFrame: 3 },
    ]);
  });

  it('projects source-keyed cached payloads onto the same real display keys used by tool availability', () => {
    const cachedFrames = [frame(0, 0), frame(1, 1), frame(2, 2), frame(3, 3)];
    const view = selectRotoTimelineView({
      cachedRotoFrames: cachedFrames,
      currentFrame: 9,
      interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
    });

    expect(selectProjectedRealCachedRotoFrames(cachedFrames, view.projection).map((candidate) => ({
      appFrame: candidate.appFrame,
      sourceFrame: candidate.sourceFrame,
      displayFrame: candidate.displayFrame,
      dataUrl: candidate.dataUrl,
    }))).toEqual([
      { appFrame: 0, sourceFrame: 0, displayFrame: 0, dataUrl: 'data:image/png;base64,real-key-0' },
      { appFrame: 3, sourceFrame: 1, displayFrame: 3, dataUrl: 'data:image/png;base64,real-key-1' },
      { appFrame: 6, sourceFrame: 2, displayFrame: 6, dataUrl: 'data:image/png;base64,real-key-2' },
      { appFrame: 9, sourceFrame: 3, displayFrame: 9, dataUrl: 'data:image/png;base64,real-key-3' },
    ]);
  });

  it('projects workflow strip Roto cells from source keys and interpolation settings', () => {
    const view = selectRotoTimelineView({
      cachedRotoFrames: [frame(0, 0), frame(3, 1), frame(6, 2)],
      currentFrame: 4,
      interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
    });

    expect(view.model.realSourceFrames).toEqual([0, 1, 2]);
    expect(view.occupiedRotoFrames).toEqual([0, 3, 6]);
    expect(view.savedRotoFrames).toEqual([
      { frame: 0, saved: true, label: 'Frame 0' },
      { frame: 3, saved: true, label: 'Frame 3' },
      { frame: 6, saved: true, label: 'Frame 6' },
    ]);
    expect(view.currentFrameSelectionKind).toBe('generated-interpolation');
    expect(view.currentFrameOwnerSourceFrame).toBe(1);
    expect(view.currentFrameIsGenerated).toBe(true);
  });

  it('projects disabled interpolation as compact source keys with custom spacing retained', () => {
    const transaction = saveRotoRealKeyTransaction({
      model: selectRotoTimelineView({
        cachedRotoFrames: [frame(0, 0), frame(3, 1), frame(6, 2)],
        currentFrame: 11,
        interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
      }).model,
      displayFrame: 11,
      currentSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 },
    });
    const view = selectRotoTimelineView({
      cachedRotoFrames: [frame(0, 0), frame(1, 1), frame(2, 2), frame(4, 4)],
      currentFrame: 4,
      interpolationSettings: {
        enabled: false,
        inBetweenCount: transaction.model.settings.inBetweenCount ?? 1,
        mode: 'duplicate',
        deform: 0,
        position: 0,
        segmentSpacingOverrides: transaction.model.settings.segmentSpacingOverrides?.map((override) => ({ ...override })),
      },
    });

    expect(view.model.realSourceFrames).toEqual([0, 1, 2, 4]);
    expect(view.occupiedRotoFrames).toEqual([0, 1, 2, 4]);
    expect(view.savedRotoFrames.map((marker) => marker.frame)).toEqual([0, 1, 2, 4]);
    expect(view.currentFrameSelectionKind).toBe('real-key');
    expect(view.currentFrameIsGenerated).toBe(false);
  });

  it('classifies a true empty selected display separately from real and generated frames', () => {
    const view = selectRotoTimelineView({
      cachedRotoFrames: [frame(0, 0), frame(1, 1), frame(2, 2), frame(3, 3), frame(14, 14), frame(26, 26)],
      currentFrame: 10,
      interpolationSettings: { enabled: false, inBetweenCount: 2, mode: 'duplicate' },
    });

    expect(view.currentFrameSelectionKind).toBe('empty');
    expect(view.currentFrameIsGenerated).toBe(false);
  });

  it('exposes a thin Signals/computed adapter over the pure selector', () => {
    const model = createRotoTimelineModel({
      cachedRotoFrames: [frame(0, 0), frame(3, 1), frame(6, 2), frame(4, 1, 'generated-interpolation')],
      currentFrame: 4,
      interpolationSettings: { enabled: true, inBetweenCount: 2, mode: 'duplicate' },
    });

    expect(model.occupiedRotoFrames.value).toEqual([0, 3, 6]);
    expect(model.savedRotoFrames.value.map((marker) => marker.frame)).toEqual([0, 3, 6]);
    expect(model.cachedRotoFrames.value.map((cachedFrame) => cachedFrame.appFrame)).toEqual([0, 3, 6, 4]);
    expect(model.currentFrameSelectionKind.value).toBe('generated-interpolation');
    expect(model.currentFrameOwnerSourceFrame.value).toBe(1);
    expect(model.currentFrameIsGenerated.value).toBe(true);
  });
});

describe('Phase 43-02 loop resolution consumers (Pitfall 7 exhaustiveness)', () => {
  const LOOP_SOURCE_KEYS = [
    { keyId: 'A', appFrame: 10 },
    { keyId: 'B', appFrame: 11 },
    { keyId: 'C', appFrame: 12 },
    { keyId: 'D', appFrame: 13 },
    { keyId: 'E', appFrame: 14 },
  ];
  const LOOP_CLIP = {
    loopId: 'L1',
    placementStart: 10,
    sourceKeyIds: ['A', 'B', 'C', 'D', 'E'],
    repeat: 5,
    mode: 'static' as const,
  };

  function buildLoopContext(repeat: number | 'infinity' = 5, parentEndExclusive = 600) {
    return derivePhysicPaintRotoLoopRanges({
      identities: LOOP_SOURCE_KEYS,
      loopClips: [{ ...LOOP_CLIP, repeat }],
      parentEndExclusive,
      capacity: 600,
    });
  }

  it('getRotoFrameKeyInteraction excludes linked and linked-unresolved frames from selection and drag (D-23/D-11)', () => {
    const context = buildLoopContext();

    expect(getRotoFrameKeyInteraction(resolvePhysicPaintRotoLoopFrame(context, 10))).toEqual({
      keySelectable: true,
      dragEligible: true,
      selectedKeyId: 'A',
    });
    expect(getRotoFrameKeyInteraction(resolvePhysicPaintRotoLoopFrame(context, 18))).toEqual({
      keySelectable: false,
      dragEligible: false,
      selectedKeyId: null,
    });
    expect(getRotoFrameKeyInteraction(resolvePhysicPaintRotoLoopFrame(context, 99))).toEqual({
      keySelectable: false,
      dragEligible: false,
      selectedKeyId: null,
    });

    const unresolvedContext = derivePhysicPaintRotoLoopRanges({
      identities: LOOP_SOURCE_KEYS.slice(0, 3),
      loopClips: [LOOP_CLIP],
      parentEndExclusive: 600,
      capacity: 600,
    });
    const unresolved = resolvePhysicPaintRotoLoopFrame(unresolvedContext, 18);
    expect(unresolved.kind).toBe('linked-unresolved');
    expect(getRotoFrameKeyInteraction(unresolved)).toEqual({
      keySelectable: false,
      dragEligible: false,
      selectedKeyId: null,
    });
  });

  it('selectRotoPhysicalTimelineStructuralView derives the loop resolution context from loopClips', () => {
    const structural = selectRotoPhysicalTimelineStructuralView({
      realKeyRecords: LOOP_SOURCE_KEYS.map((identity) => ({
        kind: 'real-key' as const,
        keyId: identity.keyId,
        appFrame: identity.appFrame,
        payload: {
          frameIndex: 0,
          appFrame: identity.appFrame,
          dataUrl: 'data:image/png;base64,AAAA',
          width: 2,
          height: 2,
        },
      })),
      interpolation: { enabled: false, mode: 'duplicate' },
      capacity: 600,
      loopClips: [LOOP_CLIP],
      parentEndExclusive: 600,
    });

    expect(structural.loopResolution.ranges).toHaveLength(1);
    expect(structural.loopResolution.ranges[0]).toMatchObject({
      loopId: 'L1',
      placementStart: 10,
      effectiveEnd: 35,
    });
    expect(resolvePhysicPaintRotoLoopFrame(structural.loopResolution, 18)).toMatchObject({
      kind: 'linked',
      loopId: 'L1',
      sourceKeyId: 'D',
    });
  });

  it('resolveRotoVisibleFrameResolutions issues exactly one lazy query per visible frame — never range-proportional (D-32)', () => {
    const context = buildLoopContext(100000, 500010);
    const visibleFrames = Array.from({ length: 120 }, (_, index) => index + 10);
    const query = vi.fn(resolvePhysicPaintRotoLoopFrame);

    const resolutions = resolveRotoVisibleFrameResolutions(context, visibleFrames, query);

    expect(query).toHaveBeenCalledTimes(visibleFrames.length);
    expect(resolutions.size).toBe(visibleFrames.length);
    expect(resolutions.get(18)).toMatchObject({ kind: 'linked', loopId: 'L1' });
    // A visible window deep inside the huge repeat resolves without any
    // intermediate-frame querying.
    const distantWindow = [499990, 499991, 499992];
    const distantQuery = vi.fn(resolvePhysicPaintRotoLoopFrame);
    const distant = resolveRotoVisibleFrameResolutions(context, distantWindow, distantQuery);
    expect(distantQuery).toHaveBeenCalledTimes(3);
    expect(distant.get(499991)).toMatchObject({ kind: 'linked', sourceIndex: 1, repeatInstance: 99996 });
  });
});
