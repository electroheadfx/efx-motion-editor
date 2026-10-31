import { describe, expect, it } from 'vitest';
import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoKeyIdentity,
} from './physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoLoopRange } from './physicsPaintRotoPhysicalResolver';
import {
  RUN_SCRIPT_KEEP_SCRIPT_DEFAULT,
  RUN_SCRIPT_OVERWRITE_COPY,
  buildRunScriptStackReadout,
  mergeStackedSourceKeyIds,
  planRunScriptStackExtension,
  planRunScriptStackLifecycle,
  resolveRunScriptDestination,
  resolveRunScriptStackBoundary,
  toRunScriptRailViews,
  type RunScriptRailView,
} from './physicsPaintRotoRunScriptStacking';

/**
 * Quick 261031-i54 (Quick A): Run Script targets an EXISTING Paint rail.
 *
 * This module is the ONE decision authority for the stack destination: which
 * rail the playhead selects, where the run re-anchors in the source cycle, how
 * far the cycle grows, where the next boundary is, and what lifecycle the rail
 * carries afterwards. It contains no Preact, no DOM and no capacity clamp: a
 * silent clamp is exactly the failure the lifecycle helper exists to prevent.
 */

function rail(overrides: Partial<RunScriptRailView> & { readonly clipId: string }): RunScriptRailView {
  return {
    railKind: 'playscript',
    placementStart: 10,
    effectiveEnd: 22,
    phaseOrigin: 10,
    cycleLength: 4,
    repeat: 3,
    sourceKeyIds: [],
    sourceOffsets: [],
    frameOverrideAppFrames: [],
    keyScriptEdits: false,
    truncated: false,
    ...overrides,
  };
}

function makeRange(overrides: Partial<PhysicPaintRotoLoopRange> & { readonly loopId: string }): PhysicPaintRotoLoopRange {
  return {
    placementStart: 10,
    phaseOrigin: 10,
    cycleLength: 4,
    sourceFrameCount: 2,
    sourceKeyIds: ['k10', 'k12'],
    sourceCycleId: 'cycle',
    sourceOffsets: [0, 2],
    strictInteriorPolicy: 'generate',
    repeat: 3,
    requestedEnd: 22,
    effectiveEnd: 22,
    boundary: { kind: 'parent-end', frame: 50 },
    truncated: false,
    partialCycle: false,
    unresolved: null,
    ...overrides,
  } as PhysicPaintRotoLoopRange;
}

function makeClip(loopId: string, overrides: Partial<PhysicPaintRotoLoopClip> = {}): PhysicPaintRotoLoopClip {
  return {
    loopId,
    placementStart: 10,
    sourceKeyIds: ['k10', 'k12'],
    repeat: 3,
    mode: 'progressive',
    ...overrides,
  };
}

describe('toRunScriptRailViews', () => {
  it('groups the canonical ranges by loopId into one view per rail', () => {
    const identities: readonly PhysicPaintRotoKeyIdentity[] = [
      { keyId: 'k10', appFrame: 10 },
      { keyId: 'k12', appFrame: 12 },
      { keyId: 'k15', appFrame: 15 },
    ];
    const views = toRunScriptRailViews({
      clips: [makeClip('a', { keyScriptEdits: true, frameOverrides: [{ appFrame: 15, keyId: 'k15' }] })],
      context: {
        ranges: [
          makeRange({ loopId: 'a', placementStart: 10, effectiveEnd: 22 }),
          makeRange({ loopId: 'a', placementStart: 22, effectiveEnd: 34 }),
        ],
        identities,
      },
    });
    expect(views).toHaveLength(1);
    const view = views[0]!;
    expect(view.clipId).toBe('a');
    expect(view.placementStart).toBe(10);
    expect(view.effectiveEnd).toBe(34);
    expect(view.phaseOrigin).toBe(10);
    expect(view.cycleLength).toBe(4);
    expect(view.repeat).toBe(3);
    expect(view.sourceKeyIds).toEqual(['k10', 'k12']);
    expect(view.sourceOffsets).toEqual([0, 2]);
    expect(view.frameOverrideAppFrames).toEqual([15]);
    expect(view.keyScriptEdits).toBe(true);
  });

  it('resolves frame-override key ids through the real-key index and skips unknown ids', () => {
    const views = toRunScriptRailViews({
      clips: [makeClip('a', {
        frameOverrides: [
          { appFrame: 15, keyId: 'k15' },
          { appFrame: 99, keyId: 'missing' },
        ],
      })],
      context: {
        ranges: [makeRange({ loopId: 'a' })],
        keyIdByAppFrame: new Map([[10, 'k10'], [15, 'k15']]),
      },
    });
    expect(views[0]!.frameOverrideAppFrames).toEqual([15]);
  });

  it('skips a clip whose ranges are all unresolved (dangling source keys)', () => {
    const views = toRunScriptRailViews({
      clips: [makeClip('broken')],
      context: {
        ranges: [makeRange({
          loopId: 'broken',
          unresolved: { missingSourceKeyIds: ['gone'] },
        })],
        identities: [],
      },
    });
    expect(views).toEqual([]);
  });

  it('orders the rails by placement start', () => {
    const views = toRunScriptRailViews({
      clips: [makeClip('b'), makeClip('a')],
      context: {
        ranges: [makeRange({ loopId: 'b', placementStart: 30, effectiveEnd: 40 }), makeRange({ loopId: 'a', placementStart: 10, effectiveEnd: 20 })],
        identities: [],
      },
    });
    expect(views.map((view) => view.clipId)).toEqual(['a', 'b']);
  });
});

describe('resolveRunScriptDestination', () => {
  const target = rail({ clipId: 'target' });

  it('maps a playhead inside the rail to the source-cycle offset', () => {
    const destination = resolveRunScriptDestination({ appFrame: 17, rails: [target] });
    expect(destination).toMatchObject({
      kind: 'stack',
      appFrame: 17,
      cycleOffset: 3,
      runStartAppFrame: 13,
      repeatInstance: 1,
    });
    if (destination.kind === 'stack') expect(destination.rail.clipId).toBe('target');
  });

  it('maps a real-key playhead inside the rail to itself', () => {
    const destination = resolveRunScriptDestination({ appFrame: 10, rails: [target] });
    expect(destination).toMatchObject({ kind: 'stack', cycleOffset: 0, runStartAppFrame: 10, repeatInstance: 0 });
  });

  it('never returns a repeated occurrence frame as the run start', () => {
    const destination = resolveRunScriptDestination({ appFrame: 17, rails: [target] });
    expect(destination.kind).toBe('stack');
    if (destination.kind === 'stack') expect(destination.runStartAppFrame).not.toBe(17);
  });

  it('falls back to create outside every rail (both edges)', () => {
    expect(resolveRunScriptDestination({ appFrame: 9, rails: [target] }).kind).toBe('create');
    expect(resolveRunScriptDestination({ appFrame: 22, rails: [target] }).kind).toBe('create');
  });

  it('fails closed on overlapping membership', () => {
    const other = rail({ clipId: 'other', placementStart: 12, effectiveEnd: 30 });
    expect(resolveRunScriptDestination({ appFrame: 17, rails: [target, other] })).toEqual({
      kind: 'refuse',
      reason: 'ambiguous-rail',
    });
  });

  it('refuses a reveal rail target', () => {
    const reveal = rail({ clipId: 'reveal', railKind: 'reveal' });
    expect(resolveRunScriptDestination({ appFrame: 17, rails: [reveal] })).toEqual({
      kind: 'refuse',
      reason: 'reveal-target',
    });
  });

  it('reports the overlap refusal before the reveal refusal when both apply', () => {
    const reveal = rail({ clipId: 'reveal', railKind: 'reveal' });
    const other = rail({ clipId: 'other', placementStart: 12, effectiveEnd: 30 });
    expect(resolveRunScriptDestination({ appFrame: 17, rails: [reveal, other] })).toEqual({
      kind: 'refuse',
      reason: 'ambiguous-rail',
    });
  });
});

describe('planRunScriptStackExtension', () => {
  it('grows the cycle to cover a run that reaches past it', () => {
    expect(planRunScriptStackExtension({
      runStartAppFrame: 13,
      cycleLength: 4,
      cycleOffset: 3,
      count: 5,
    })).toEqual({
      writeAppFrames: [13, 14, 15, 16, 17],
      newCycleLength: 8,
      appendedSlots: [4, 5, 6, 7],
      grew: 4,
    });
  });

  it('never shrinks the cycle when the run stays inside it', () => {
    expect(planRunScriptStackExtension({
      runStartAppFrame: 13,
      cycleLength: 4,
      cycleOffset: 3,
      count: 1,
    })).toEqual({
      writeAppFrames: [13],
      newCycleLength: 4,
      appendedSlots: [],
      grew: 0,
    });
    expect(planRunScriptStackExtension({
      runStartAppFrame: 10,
      cycleLength: 4,
      cycleOffset: 0,
      count: 2,
    }).newCycleLength).toBe(4);
  });
});

describe('mergeStackedSourceKeyIds', () => {
  it('merges every touched key in offset order with the existing order preserved', () => {
    const existing = [{ keyId: 'k0', offset: 0 }, { keyId: 'k2', offset: 2 }] as const;
    const incoming = [{ keyId: 'k4', offset: 4 }, { keyId: 'k1', offset: 1 }] as const;
    const merged = mergeStackedSourceKeyIds(existing, incoming);
    expect(merged).toEqual([
      { keyId: 'k0', offset: 0 },
      { keyId: 'k1', offset: 1 },
      { keyId: 'k2', offset: 2 },
      { keyId: 'k4', offset: 4 },
    ]);
    expect(existing).toEqual([{ keyId: 'k0', offset: 0 }, { keyId: 'k2', offset: 2 }]);
    expect(incoming).toEqual([{ keyId: 'k4', offset: 4 }, { keyId: 'k1', offset: 1 }]);
  });

  it('keeps an already present key at its existing position', () => {
    const merged = mergeStackedSourceKeyIds(
      [{ keyId: 'k2', offset: 2 }, { keyId: 'k0', offset: 0 }],
      [{ keyId: 'k0', offset: 0 }, { keyId: 'k3', offset: 3 }],
    );
    expect(merged).toEqual([
      { keyId: 'k0', offset: 0 },
      { keyId: 'k2', offset: 2 },
      { keyId: 'k3', offset: 3 },
    ]);
    expect(merged.filter((entry) => entry.keyId === 'k0')).toHaveLength(1);
  });
});

describe('resolveRunScriptStackBoundary', () => {
  const target = rail({ clipId: 'target', effectiveEnd: 22 });
  const base = {
    runStartAppFrame: 13,
    requestedCount: 5,
    newCycleEndExclusive: 18,
    targetClipId: 'target',
    parentEndExclusive: 50,
    ownedKeyIds: [] as readonly string[],
    frameOverrideAppFrames: [] as readonly number[],
    realKeyAppFrames: [] as readonly { readonly keyId: string; readonly appFrame: number }[],
  };

  it('is open when nothing bounds the run', () => {
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target],
      parentEndExclusive: Number.POSITIVE_INFINITY,
    });
    expect(boundary).toEqual({
      boundaryExclusive: Number.POSITIVE_INFINITY,
      blocker: 'open',
      victimClipId: null,
      collision: false,
      freeCount: Number.POSITIVE_INFINITY,
      offers: [],
      overrideInSpan: false,
      frameOverrideRefusal: null,
      targetEndAtBoundary: false,
    });
  });

  it('bounds at the next rail start and offers cancel/truncate/overwrite', () => {
    const other = rail({ clipId: 'other', placementStart: 29, effectiveEnd: 40 });
    const boundary = resolveRunScriptStackBoundary({ ...base, rails: [target, other] });
    expect(boundary).toMatchObject({
      boundaryExclusive: 29,
      blocker: 'other-rail',
      victimClipId: 'other',
      collision: false,
      freeCount: 16,
      offers: ['cancel', 'truncate', 'overwrite'],
      targetEndAtBoundary: false,
    });
    expect(resolveRunScriptStackBoundary({
      ...base,
      newCycleEndExclusive: 30,
      rails: [target, other],
    }).collision).toBe(true);
  });

  it('skips the target rail\'s own later occurrence fragments', () => {
    const ownRepeat = rail({ clipId: 'target', placementStart: 22, effectiveEnd: 34 });
    const ownRepeatTwo = rail({ clipId: 'target', placementStart: 34, effectiveEnd: 46 });
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target, ownRepeat, ownRepeatTwo],
      parentEndExclusive: Number.POSITIVE_INFINITY,
    });
    expect(boundary.blocker).toBe('open');
    expect(boundary.boundaryExclusive).toBe(Number.POSITIVE_INFINITY);
  });

  it('takes the earliest blocker', () => {
    const other = rail({ clipId: 'other', placementStart: 40, effectiveEnd: 50 });
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target, other],
      realKeyAppFrames: [{ keyId: 'k25', appFrame: 25 }],
    });
    expect(boundary.boundaryExclusive).toBe(25);
    expect(boundary.blocker).toBe('real-key');
    expect(boundary.victimClipId).toBeNull();
  });

  it('resolves coincident blockers with the canonical rank', () => {
    const other = rail({ clipId: 'other', placementStart: 29, effectiveEnd: 40 });
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target, other],
      realKeyAppFrames: [{ keyId: 'k29', appFrame: 29 }],
    });
    expect(boundary.blocker).toBe('other-rail');
    expect(boundary.victimClipId).toBe('other');
  });

  it('excludes owned source keys and frame-override frames from the real-key scan', () => {
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target],
      parentEndExclusive: Number.POSITIVE_INFINITY,
      ownedKeyIds: ['k25'],
      frameOverrideAppFrames: [27],
      realKeyAppFrames: [
        { keyId: 'k25', appFrame: 25 },
        { keyId: 'k27', appFrame: 27 },
      ],
    });
    expect(boundary.blocker).toBe('open');
  });

  it('bounds at the parent end with cancel/truncate only', () => {
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target],
      parentEndExclusive: 20,
      newCycleEndExclusive: 21,
    });
    expect(boundary).toMatchObject({
      boundaryExclusive: 20,
      blocker: 'parent-end',
      collision: true,
      freeCount: 7,
      offers: ['cancel', 'truncate'],
    });
  });

  it('never reports a negative free span', () => {
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target],
      parentEndExclusive: 10,
    });
    expect(boundary.boundaryExclusive).toBe(10);
    expect(boundary.freeCount).toBe(0);
    expect(boundary.collision).toBe(true);
  });

  it('refuses a frame override inside the requested written span', () => {
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target],
      frameOverrideAppFrames: [15],
    });
    expect(boundary.overrideInSpan).toBe(true);
    expect(boundary.frameOverrideRefusal).toBe('frame-override');
    expect(boundary.offers).toEqual([]);
  });

  it('does not refuse or truncate for an override before the run start', () => {
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target],
      parentEndExclusive: Number.POSITIVE_INFINITY,
      frameOverrideAppFrames: [9],
    });
    expect(boundary.overrideInSpan).toBe(false);
    expect(boundary.frameOverrideRefusal).toBeNull();
    expect(boundary.blocker).toBe('open');
  });

  it('keeps an other-rail crossing when it coincides with the target truncated end', () => {
    const truncatedTarget = rail({ clipId: 'target', effectiveEnd: 22, truncated: true });
    const other = rail({ clipId: 'other', placementStart: 22, effectiveEnd: 30 });
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [truncatedTarget, other],
    });
    expect(boundary.blocker).toBe('other-rail');
    expect(boundary.victimClipId).toBe('other');
    expect(boundary.offers).toContain('overwrite');
    expect(boundary.targetEndAtBoundary).toBe(true);
    expect(boundary.boundaryExclusive).toBe(22);
  });

  it('becomes target-end only when no canonical candidate sits on the truncated end', () => {
    const truncatedTarget = rail({ clipId: 'target', effectiveEnd: 22, truncated: true });
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [truncatedTarget],
      realKeyAppFrames: [{ keyId: 'k30', appFrame: 30 }],
    });
    expect(boundary.blocker).toBe('target-end');
    expect(boundary.boundaryExclusive).toBe(22);
    expect(boundary.offers).toEqual(['cancel', 'truncate']);
    expect(boundary.targetEndAtBoundary).toBe(true);
  });
});

describe('planRunScriptStackLifecycle', () => {
  it('extends the lifecycle end and continues the last visible range', () => {
    const plan = planRunScriptStackLifecycle({
      existing: {
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 10,
        originalEndExclusive: 18,
        visibleRanges: [{ start: 10, endExclusive: 18 }],
        frameOverrides: [],
      },
      phaseOrigin: 10,
      newCycleLength: 6,
      repeat: 2,
    });
    expect(plan.requestedRailEndExclusive).toBe(22);
    expect(plan.lifecycle).not.toBeNull();
    expect(plan.lifecycle!.originalEndExclusive).toBe(22);
    expect(plan.lifecycle!.visibleRanges).toEqual([{ start: 10, endExclusive: 22 }]);
  });

  it('preserves a longer existing lifecycle (extend only)', () => {
    const plan = planRunScriptStackLifecycle({
      existing: {
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 10,
        originalEndExclusive: 26,
        visibleRanges: [{ start: 10, endExclusive: 26 }],
        frameOverrides: [],
      },
      phaseOrigin: 10,
      newCycleLength: 8,
      repeat: 2,
    });
    expect(plan.requestedRailEndExclusive).toBe(26);
    expect(plan.lifecycle!.originalEndExclusive).toBe(26);
    expect(plan.lifecycle!.visibleRanges).toEqual([{ start: 10, endExclusive: 26 }]);
  });

  it('reports the unclamped repeat-extended end (no capacity, no Math.min)', () => {
    const plan = planRunScriptStackLifecycle({
      existing: null,
      phaseOrigin: 10,
      newCycleLength: 100000,
      repeat: 1,
    });
    expect(plan.requestedRailEndExclusive).toBe(100010);
    expect(plan.lifecycle!.originalEndExclusive).toBe(100010);
  });

  it('keeps infinity rails lifecycle-less', () => {
    const plan = planRunScriptStackLifecycle({
      existing: {
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 10,
        originalEndExclusive: 18,
        visibleRanges: [{ start: 10, endExclusive: 18 }],
      },
      phaseOrigin: 10,
      newCycleLength: 6,
      repeat: 'infinity',
    });
    expect(plan.lifecycle).toBeNull();
    expect(plan.requestedRailEndExclusive).toBe(Number.POSITIVE_INFINITY);
  });

  it('gives a lifecycle-less finite clip the full canonical shape', () => {
    const plan = planRunScriptStackLifecycle({
      existing: { frameOverrides: [{ appFrame: 15, keyId: 'k15' }] },
      phaseOrigin: 10,
      newCycleLength: 4,
      repeat: 2,
    });
    expect(plan.lifecycle).toEqual({
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 18,
      visibleRanges: [{ start: 10, endExclusive: 18 }],
      frameOverrides: [{ appFrame: 15, keyId: 'k15' }],
    });
  });

  it('copies frameOverrides without inventing any', () => {
    const existing = {
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 10,
      originalEndExclusive: 18,
      visibleRanges: [{ start: 10, endExclusive: 18 }],
      frameOverrides: [{ appFrame: 15, keyId: 'k15' }],
    };
    const plan = planRunScriptStackLifecycle({
      existing,
      phaseOrigin: 10,
      newCycleLength: 6,
      repeat: 2,
    });
    expect(plan.lifecycle!.frameOverrides).toEqual([{ appFrame: 15, keyId: 'k15' }]);
    expect(plan.lifecycle!.frameOverrides).not.toBe(existing.frameOverrides);
    expect(planRunScriptStackLifecycle({
      existing: null,
      phaseOrigin: 10,
      newCycleLength: 6,
      repeat: 2,
    }).lifecycle!.frameOverrides).toEqual([]);
    expect(existing.frameOverrides).toEqual([{ appFrame: 15, keyId: 'k15' }]);
  });

  it('pushes a new visible range when the prior lifecycle ended before its original end', () => {
    const plan = planRunScriptStackLifecycle({
      existing: {
        syncState: 'modified',
        provenanceState: 'attached',
        phaseOrigin: 10,
        originalEndExclusive: 18,
        visibleRanges: [{ start: 10, endExclusive: 14 }],
      },
      phaseOrigin: 10,
      newCycleLength: 6,
      repeat: 2,
    });
    expect(plan.lifecycle!.originalEndExclusive).toBe(22);
    expect(plan.lifecycle!.visibleRanges).toEqual([
      { start: 10, endExclusive: 14 },
      { start: 18, endExclusive: 22 },
    ]);
  });
});

describe('buildRunScriptStackReadout', () => {
  it('reports the span, the source offset and the growth', () => {
    const readout = buildRunScriptStackReadout({
      runStartAppFrame: 13,
      count: 5,
      cycleOffset: 3,
      grew: 4,
      truncated: false,
    });
    expect(readout.spanLabel).toBe('F13–F17');
    expect(readout.offsetLabel).toContain('3');
    expect(readout.outcomeLabel.toLowerCase()).toContain('extend');
  });

  it('reports a stacking-without-growth outcome', () => {
    const readout = buildRunScriptStackReadout({
      runStartAppFrame: 13,
      count: 1,
      cycleOffset: 3,
      grew: 0,
      truncated: false,
    });
    expect(readout.spanLabel).toBe('F13–F13');
    expect(readout.outcomeLabel.toLowerCase()).not.toContain('extend');
  });

  it('says a frame-override refusal is refused, never truncated', () => {
    const readout = buildRunScriptStackReadout({
      runStartAppFrame: 13,
      count: 5,
      cycleOffset: 3,
      grew: 0,
      truncated: false,
      frameOverrideRefusal: 'frame-override',
    });
    expect(readout.outcomeLabel.toLowerCase()).toContain('refused');
    expect(readout.outcomeLabel.toLowerCase()).not.toContain('truncated');
  });

  it('never describes overwrite as shortening a rail', () => {
    expect(RUN_SCRIPT_OVERWRITE_COPY.toLowerCase()).not.toContain('shorten');
    expect(RUN_SCRIPT_OVERWRITE_COPY.toLowerCase()).toContain('ordinary keys');
  });

  it('defaults Keep script ON for a flag-on stack destination', () => {
    expect(RUN_SCRIPT_KEEP_SCRIPT_DEFAULT).toBe(true);
  });
});
