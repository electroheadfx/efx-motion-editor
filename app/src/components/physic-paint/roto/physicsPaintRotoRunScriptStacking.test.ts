import { describe, expect, it } from 'vitest';
import type { PhysicPaintRotoLoopClip } from './physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoLoopRange } from './physicsPaintRotoPhysicalResolver';
import {
  RUN_SCRIPT_KEEP_SCRIPT_DEFAULT,
  RUN_SCRIPT_OVERWRITE_COPY,
  STANDARD_RAIL_REGENERATE_REASON,
  STANDARD_RAIL_REPLAY_REASON,
  STANDARD_RAIL_STATUS_COPY,
  buildRunScriptStackReadout,
  buildStandardStackedLoopClip,
  isStandardMergedLoopClip,
  mergeStackedSourceKeyIds,
  planRunScriptStackExtension,
  planRunScriptStackLifecycle,
  resolveRunScriptDestination,
  resolveRunScriptStandardRailMerge,
  resolveRunScriptStackBoundary,
  toRunScriptRailViews,
  type RunScriptRailView,
  type RunScriptStackLifecycle,
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
  const placementStart = overrides.placementStart ?? 10;
  const effectiveEnd = overrides.effectiveEnd ?? 22;
  return {
    railKind: 'playscript',
    placementStart,
    effectiveEnd,
    placementFragments: [{ start: placementStart, endExclusive: effectiveEnd }],
    phaseOrigin: 10,
    cycleLength: 4,
    repeat: 3,
    mode: 'progressive',
    motion: undefined,
    overrideColor: null,
    colorize: false,
    colorizeMix: 100,
    photoWiggle: false,
    paintSeedVariation: false,
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
    const views = toRunScriptRailViews({
      clips: [makeClip('a', { keyScriptEdits: true, frameOverrides: [{ appFrame: 15, keyId: 'override:L1:15' }] })],
      context: {
        ranges: [
          makeRange({ loopId: 'a', placementStart: 10, effectiveEnd: 22 }),
          makeRange({ loopId: 'a', placementStart: 22, effectiveEnd: 34 }),
        ],
      },
    });
    expect(views).toHaveLength(1);
    const view = views[0]!;
    expect(view.clipId).toBe('a');
    expect(view.placementStart).toBe(10);
    expect(view.effectiveEnd).toBe(34);
    expect(view.placementFragments).toEqual([
      { start: 10, endExclusive: 22 },
      { start: 22, endExclusive: 34 },
    ]);
    expect(view.phaseOrigin).toBe(10);
    expect(view.cycleLength).toBe(4);
    expect(view.repeat).toBe(3);
    expect(view.sourceKeyIds).toEqual(['k10', 'k12']);
    expect(view.sourceOffsets).toEqual([0, 2]);
    expect(view.frameOverrideAppFrames).toEqual([15]);
    expect(view.keyScriptEdits).toBe(true);
    // 261031-qps: the reveal knobs ride the view so the dialog can seed them;
    // an unset knob reads off/100 exactly like the persisted record.
    expect(view.colorize).toBe(false);
    expect(view.colorizeMix).toBe(100);
    expect(view.photoWiggle).toBe(false);
    expect(view.paintSeedVariation).toBe(false);
  });

  it('carries a reveal rail’s stored knobs onto its view (261031-qps)', () => {
    const views = toRunScriptRailViews({
      clips: [makeClip('r', {
        railKind: 'reveal',
        colorize: true,
        colorizeMix: 40,
        photoWiggle: true,
        paintSeedVariation: true,
      })],
      context: { ranges: [makeRange({ loopId: 'r' })] },
    });
    expect(views).toHaveLength(1);
    const view = views[0]!;
    expect(view.railKind).toBe('reveal');
    expect(view.colorize).toBe(true);
    expect(view.colorizeMix).toBe(40);
    expect(view.photoWiggle).toBe(true);
    expect(view.paintSeedVariation).toBe(true);
  });

  it('reads frame-override app frames directly, even for a key id absent from the real-key index (CR-01)', () => {
    // The override key id is deliberately NOT a real source key: the physical
    // appFrame stored on the override is authoritative and must still map.
    const views = toRunScriptRailViews({
      clips: [makeClip('a', {
        frameOverrides: [
          { appFrame: 15, keyId: 'override:L1:15' },
          { appFrame: 15, keyId: 'override:L1:15:dup' },
          { appFrame: 12, keyId: 'k12' },
        ],
      })],
      context: { ranges: [makeRange({ loopId: 'a' })] },
    });
    expect(views[0]!.frameOverrideAppFrames).toEqual([12, 15]);

    const boundary = resolveRunScriptStackBoundary({
      runStartAppFrame: 13,
      requestedCount: 5,
      targetClipId: 'a',
      rails: views,
      parentEndExclusive: 50,
      ownedKeyIds: [],
      frameOverrideAppFrames: views[0]!.frameOverrideAppFrames,
      realKeyAppFrames: [],
    });
    // 261031-qps (Quick B): a frame override inside the written span is LEGAL.
    // The boundary keeps its ordinary blocker and offers; only the override's
    // own real-key candidates stay out of the scan.
    expect(boundary.blocker).toBe('parent-end');
    expect(boundary.collision).toBe(false);
    expect(boundary.offers).toEqual(['cancel', 'truncate']);
  });

  it('keeps one fragment per canonical range so a gap is not rail membership (CR-03)', () => {
    const views = toRunScriptRailViews({
      clips: [makeClip('a')],
      context: {
        ranges: [
          makeRange({ loopId: 'a', placementStart: 10, effectiveEnd: 14 }),
          makeRange({ loopId: 'a', placementStart: 18, effectiveEnd: 22 }),
        ],
      },
    });
    expect(views[0]!.placementFragments).toEqual([
      { start: 10, endExclusive: 14 },
      { start: 18, endExclusive: 22 },
    ]);
    expect(resolveRunScriptDestination({ appFrame: 16, rails: views }).kind).toBe('create');
    expect(resolveRunScriptDestination({ appFrame: 19, rails: views }).kind).toBe('stack');
  });

  it('skips a clip whose ranges are all unresolved (dangling source keys)', () => {
    const views = toRunScriptRailViews({
      clips: [makeClip('broken')],
      context: {
        ranges: [makeRange({
          loopId: 'broken',
          unresolved: { missingSourceKeyIds: ['gone'] },
        })],
      },
    });
    expect(views).toEqual([]);
  });

  it('orders the rails by placement start', () => {
    const views = toRunScriptRailViews({
      clips: [makeClip('b'), makeClip('a')],
      context: {
        ranges: [makeRange({ loopId: 'b', placementStart: 30, effectiveEnd: 40 }), makeRange({ loopId: 'a', placementStart: 10, effectiveEnd: 20 })],
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

  it('2026-10-31 (Quick B): resolves a reveal rail target like a Paint rail', () => {
    const reveal = rail({ clipId: 'reveal', railKind: 'reveal' });
    const destination = resolveRunScriptDestination({ appFrame: 17, rails: [reveal] });
    expect(destination.kind).toBe('stack');
    if (destination.kind === 'stack') {
      expect(destination.rail.railKind).toBe('reveal');
      expect(destination.rail.clipId).toBe('reveal');
      expect(destination.cycleOffset).toBe(3);
      expect(destination.runStartAppFrame).toBe(13);
    }
  });

  it('still fails closed when a reveal rail overlaps another rail', () => {
    const reveal = rail({ clipId: 'reveal', railKind: 'reveal' });
    const other = rail({ clipId: 'other', placementStart: 12, effectiveEnd: 30 });
    expect(resolveRunScriptDestination({ appFrame: 17, rails: [reveal, other] })).toEqual({
      kind: 'refuse',
      reason: 'ambiguous-rail',
    });
  });
});

/**
 * 2026-11-05 rail-on-rail rewrite law: a Run Script over an in-hand Standard
 * rail merges into that rail. The resolver is the pure authority for "which
 * hand rail does the playhead belong to"; it must mirror the timeline's anchor
 * law exactly and never capture a clip/override frame.
 */
describe('resolveRunScriptStandardRailMerge', () => {
  const keys = (...frames: number[]) => frames.map((appFrame) => ({ keyId: `k${appFrame}`, appFrame }));
  const none: readonly string[] = [];

  it('resolves the segment containing a real key', () => {
    const merge = resolveRunScriptStandardRailMerge({
      appFrame: 12,
      orderedRealKeys: keys(10, 11, 12, 13),
      incomingInterpolationBreakKeyIds: none,
      groupOwnedKeyIds: none,
    });
    expect(merge).not.toBeNull();
    expect(merge!.rail).toEqual({ firstKeyId: 'k10', keyIds: ['k10', 'k11', 'k12', 'k13'], firstKeyFrame: 10, lastKeyFrame: 13 });
    expect(merge!.appFrame).toBe(12);
  });

  it('treats an empty/gap frame inside the segment span as the same rail', () => {
    // Keys at 10 and 13 with nothing at 11–12: the span is the rail.
    const merge = resolveRunScriptStandardRailMerge({
      appFrame: 11,
      orderedRealKeys: keys(10, 13),
      incomingInterpolationBreakKeyIds: none,
      groupOwnedKeyIds: none,
    });
    expect(merge?.rail.firstKeyId).toBe('k10');
    expect(merge?.rail.lastKeyFrame).toBe(13);
  });

  it('is inclusive on both ends of the segment span', () => {
    for (const appFrame of [10, 13]) {
      expect(resolveRunScriptStandardRailMerge({
        appFrame,
        orderedRealKeys: keys(10, 11, 12, 13),
        incomingInterpolationBreakKeyIds: none,
        groupOwnedKeyIds: none,
      })?.appFrame).toBe(appFrame);
    }
  });

  it('returns null outside every segment span', () => {
    for (const appFrame of [9, 14, 40]) {
      expect(resolveRunScriptStandardRailMerge({
        appFrame,
        orderedRealKeys: keys(10, 11, 12, 13),
        incomingInterpolationBreakKeyIds: none,
        groupOwnedKeyIds: none,
      })).toBeNull();
    }
    expect(resolveRunScriptStandardRailMerge({
      appFrame: 10,
      orderedRealKeys: [],
      incomingInterpolationBreakKeyIds: none,
      groupOwnedKeyIds: none,
    })).toBeNull();
  });

  it('never claims a group-owned (clip source / override) key frame', () => {
    // A clip owns k11; the playhead on it must resolve the CLIP destination in
    // the caller, never the in-hand segment that spans it.
    expect(resolveRunScriptStandardRailMerge({
      appFrame: 11,
      orderedRealKeys: keys(10, 11, 12, 13),
      incomingInterpolationBreakKeyIds: none,
      groupOwnedKeyIds: ['k11'],
    })).toBeNull();
  });

  it('starts a new segment at an incoming interpolation break', () => {
    const input = {
      orderedRealKeys: keys(10, 11, 12, 13),
      incomingInterpolationBreakKeyIds: ['k12'],
      groupOwnedKeyIds: none,
    } as const;
    expect(resolveRunScriptStandardRailMerge({ ...input, appFrame: 11 })?.rail).toEqual({
      firstKeyId: 'k10', keyIds: ['k10', 'k11'], firstKeyFrame: 10, lastKeyFrame: 11,
    });
    expect(resolveRunScriptStandardRailMerge({ ...input, appFrame: 12 })?.rail).toEqual({
      firstKeyId: 'k12', keyIds: ['k12', 'k13'], firstKeyFrame: 12, lastKeyFrame: 13,
    });
  });

  it('derives segments from unsorted real keys', () => {
    const merge = resolveRunScriptStandardRailMerge({
      appFrame: 12,
      orderedRealKeys: [...keys(13, 10, 12, 11)],
      incomingInterpolationBreakKeyIds: none,
      groupOwnedKeyIds: none,
    });
    expect(merge?.rail.keyIds).toEqual(['k10', 'k11', 'k12', 'k13']);
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
    // WR-03: the collision is the RUN crossing the boundary, not the cycle end.
    expect(resolveRunScriptStackBoundary({
      ...base,
      requestedCount: 20,
      rails: [target, other],
    }).collision).toBe(true);
    expect(resolveRunScriptStackBoundary({
      ...base,
      requestedCount: 16,
      rails: [target, other],
    }).collision).toBe(false);
  });

  it('does not prompt when the run fits inside the truncated target (WR-03/WR-05)', () => {
    const truncatedTarget = rail({ clipId: 'target', effectiveEnd: 22, truncated: true });
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      runStartAppFrame: 13,
      requestedCount: 2,
      rails: [truncatedTarget],
      parentEndExclusive: 50,
      ownedKeyIds: ['k10', 'k12'],
    });
    expect(boundary.boundaryExclusive).toBe(22);
    expect(boundary.blocker).toBe('target-end');
    expect(boundary.collision).toBe(false);
  });

  it('bounds at a later fragment start of another fragment-split rail (CR-03)', () => {
    const split = rail({
      clipId: 'other',
      placementStart: 6,
      effectiveEnd: 22,
      placementFragments: [
        { start: 6, endExclusive: 9 },
        { start: 18, endExclusive: 22 },
      ],
    });
    const boundary = resolveRunScriptStackBoundary({ ...base, rails: [target, split] });
    expect(boundary.boundaryExclusive).toBe(18);
    expect(boundary.blocker).toBe('other-rail');
    expect(boundary.victimClipId).toBe('other');
  });

  it('bounds at the run start when another rail covers it (CR-06)', () => {
    const covering = rail({
      clipId: 'other',
      placementStart: 12,
      effectiveEnd: 16,
      placementFragments: [{ start: 12, endExclusive: 16 }],
    });
    const boundary = resolveRunScriptStackBoundary({ ...base, rails: [target, covering] });
    expect(boundary.boundaryExclusive).toBe(13);
    expect(boundary.freeCount).toBe(0);
    expect(boundary.collision).toBe(true);
    expect(boundary.blocker).toBe('other-rail');
    expect(boundary.victimClipId).toBe('other');
    expect(boundary.offers).toContain('overwrite');
  });

  it('ignores a fragment that ends exactly at the run start', () => {
    const before = rail({
      clipId: 'other',
      placementStart: 10,
      effectiveEnd: 16,
      placementFragments: [
        { start: 10, endExclusive: 13 },
        { start: 18, endExclusive: 22 },
      ],
    });
    const boundary = resolveRunScriptStackBoundary({ ...base, rails: [target, before] });
    expect(boundary.boundaryExclusive).toBe(18);
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
      requestedCount: 10,
      rails: [target],
      parentEndExclusive: 20,
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

  it('keeps a frame override inside the requested written span legal', () => {
    // 261031-qps (Quick B): the override's base resolves to its SOURCE key, so
    // an override in the span no longer refuses the run or suppresses offers.
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target],
      frameOverrideAppFrames: [15],
    });
    expect(boundary.blocker).toBe('parent-end');
    expect(boundary.collision).toBe(false);
    expect(boundary.offers).toEqual(['cancel', 'truncate']);
    expect(boundary).not.toHaveProperty('frameOverrideRefusal');
  });

  it('stays open for an override before the run start', () => {
    const boundary = resolveRunScriptStackBoundary({
      ...base,
      rails: [target],
      parentEndExclusive: Number.POSITIVE_INFINITY,
      frameOverrideAppFrames: [9],
    });
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

  it('caps growth at the explicit Truncate boundary (WR-05)', () => {
    // The rail's repeat-extended end is 20, but the run boundary sits at 15 —
    // an explicit Truncate may grow the rail only up to that boundary.
    const plan = planRunScriptStackLifecycle({
      existing: null,
      phaseOrigin: 10,
      newCycleLength: 5,
      repeat: 2,
      cap: 15,
    });
    expect(plan.requestedRailEndExclusive).toBe(20);
    expect(plan.lifecycle!.originalEndExclusive).toBe(15);
    expect(plan.lifecycle!.visibleRanges).toEqual([{ start: 10, endExclusive: 15 }]);
  });

  it('preserves an existing lifecycle end longer than the cap (WR-05)', () => {
    // Extend-only: a Truncate never shrinks an already longer stored end.
    const plan = planRunScriptStackLifecycle({
      existing: {
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 10,
        originalEndExclusive: 30,
        visibleRanges: [{ start: 10, endExclusive: 30 }],
        frameOverrides: [],
      },
      phaseOrigin: 10,
      newCycleLength: 5,
      repeat: 2,
      cap: 15,
    });
    expect(plan.requestedRailEndExclusive).toBe(20);
    expect(plan.lifecycle!.originalEndExclusive).toBe(30);
    expect(plan.lifecycle!.visibleRanges).toEqual([{ start: 10, endExclusive: 30 }]);
  });

  it('keeps a capped infinity rail lifecycle-less (WR-05)', () => {
    const plan = planRunScriptStackLifecycle({
      existing: null,
      phaseOrigin: 10,
      newCycleLength: 6,
      repeat: 'infinity',
      cap: 15,
    });
    expect(plan.lifecycle).toBeNull();
    expect(plan.requestedRailEndExclusive).toBe(Number.POSITIVE_INFINITY);
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

  it('names the RAIL capping for a parent-end overflow, never a run truncation (WR-03)', () => {
    const readout = buildRunScriptStackReadout({
      runStartAppFrame: 13,
      count: 2,
      cycleOffset: 3,
      grew: 1,
      truncated: false,
      parentEndOverflow: true,
    });
    expect(readout.spanLabel).toBe('F13–F14');
    expect(readout.outcomeLabel.toLowerCase()).toContain('rail');
    expect(readout.outcomeLabel.toLowerCase()).toContain('parent range end');
    expect(readout.outcomeLabel.toLowerCase()).not.toContain('truncated');
  });

  it('prefers the run truncation wording when the run itself crosses a boundary', () => {
    const readout = buildRunScriptStackReadout({
      runStartAppFrame: 13,
      count: 10,
      cycleOffset: 3,
      grew: 4,
      truncated: true,
      parentEndOverflow: true,
    });
    expect(readout.outcomeLabel).toBe('Truncated at the next boundary.');
  });

  it('has no frame-override refusal outcome left in the readout', () => {
    // 261031-qps (Quick B): overrides inside the written span are legal, so a
    // no-growth run reads as a plain stack instead of a refusal.
    const readout = buildRunScriptStackReadout({
      runStartAppFrame: 13,
      count: 5,
      cycleOffset: 3,
      grew: 0,
      truncated: false,
    });
    expect(readout.outcomeLabel).toBe('Stacks onto the existing cycle.');
    expect(readout.outcomeLabel.toLowerCase()).not.toContain('refused');
  });

  it('never describes overwrite as shortening a rail', () => {
    expect(RUN_SCRIPT_OVERWRITE_COPY.toLowerCase()).not.toContain('shorten');
    expect(RUN_SCRIPT_OVERWRITE_COPY.toLowerCase()).toContain('ordinary keys');
  });

  it('defaults Keep script ON for a flag-on stack destination', () => {
    expect(RUN_SCRIPT_KEEP_SCRIPT_DEFAULT).toBe(true);
  });
});

/**
 * Quick 261031-vbo (Quick C1): a Run Script stack is a MERGE OF RESULTS.
 *
 * The destination rail's cached picture, repeat and cycle stay; the merged
 * record keeps only the fields a flat Standard Rail can legally carry. Provenance
 * (`scriptId`, `motion`, `overrideColor`) and the Reveal identity (`railKind`,
 * `colorize`, `colorizeMix`, `photoWiggle`) are DROPPED in this same projection —
 * they are exactly what would let Regenerate rebuild a single-script rail and
 * wipe the blend. `mode` stays because the schema requires it; it is an internal
 * playback value, never a rail type.
 */

const FULL_REVEAL_LIFECYCLE: RunScriptStackLifecycle = {
  syncState: 'synchronized',
  provenanceState: 'attached',
  phaseOrigin: 10,
  originalEndExclusive: 22,
  visibleRanges: [{ start: 10, endExclusive: 22 }],
  frameOverrides: [{ appFrame: 15, keyId: 'k15' }],
};

describe('buildStandardStackedLoopClip', () => {
  it('keeps only the whitelist fields and drops the destination’s full provenance and reveal identity', () => {
    const destination = makeClip('L1', {
      scriptId: 'script-1',
      motion: { deformation: 0.5, position: 0.25 },
      overrideColor: '#ff0000',
      railKind: 'reveal',
      colorize: true,
      colorizeMix: 40,
      photoWiggle: true,
      paintSeedVariation: true,
      keyScriptEdits: true,
      repeat: 5,
      mode: 'static',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 22,
      visibleRanges: [{ start: 10, endExclusive: 22 }],
      frameOverrides: [{ appFrame: 15, keyId: 'k15' }],
    });
    const merged = buildStandardStackedLoopClip({
      target: destination,
      mergedSourceKeyIds: ['k10', 'k12', 'k14'],
      lifecycle: null,
    });

    expect(merged).toEqual({
      loopId: 'L1',
      placementStart: 10,
      repeat: 5,
      sourceKeyIds: ['k10', 'k12', 'k14'],
      mode: 'static',
      keyScriptEdits: true,
      paintSeedVariation: true,
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 22,
      visibleRanges: [{ start: 10, endExclusive: 22 }],
      frameOverrides: [{ appFrame: 15, keyId: 'k15' }],
    });
  });

  it('carries no own property for any dropped provenance or reveal field', () => {
    const destination = makeClip('L2', {
      scriptId: 'script-1',
      motion: { deformation: 0.5, position: 0.25 },
      overrideColor: '#ff0000',
      railKind: 'reveal',
      colorize: true,
      colorizeMix: 40,
      photoWiggle: true,
    });
    const merged = buildStandardStackedLoopClip({
      target: destination,
      mergedSourceKeyIds: ['k10'],
      lifecycle: null,
    });

    for (const field of ['scriptId', 'motion', 'overrideColor', 'railKind', 'colorize', 'colorizeMix', 'photoWiggle']) {
      expect(Object.prototype.hasOwnProperty.call(merged, field)).toBe(false);
    }
  });

  it('omits the optional flags unless the destination carried them as true', () => {
    const bare = buildStandardStackedLoopClip({
      target: makeClip('L3'),
      mergedSourceKeyIds: ['k10'],
      lifecycle: null,
    });
    expect(Object.prototype.hasOwnProperty.call(bare, 'keyScriptEdits')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(bare, 'paintSeedVariation')).toBe(false);

    const flagged = buildStandardStackedLoopClip({
      target: makeClip('L3', { keyScriptEdits: true, paintSeedVariation: true }),
      mergedSourceKeyIds: ['k10'],
      lifecycle: null,
    });
    expect(flagged.keyScriptEdits).toBe(true);
    expect(flagged.paintSeedVariation).toBe(true);
  });

  it('keeps the destination’s stored mode instead of converting the rail', () => {
    const merged = buildStandardStackedLoopClip({
      target: makeClip('L4', { mode: 'progressive' }),
      mergedSourceKeyIds: ['k10'],
      lifecycle: null,
    });
    expect(merged.mode).toBe('progressive');
  });

  it('copies the merged source keys into a frozen array without mutating the input', () => {
    const mergedIds = ['k10', 'k12', 'k14'];
    const merged = buildStandardStackedLoopClip({
      target: makeClip('L5'),
      mergedSourceKeyIds: mergedIds,
      lifecycle: null,
    });
    expect(merged.sourceKeyIds).not.toBe(mergedIds);
    expect(Object.isFrozen(merged.sourceKeyIds)).toBe(true);
    mergedIds.push('k16');
    expect(merged.sourceKeyIds).toEqual(['k10', 'k12', 'k14']);
  });

  it('preserves the destination’s lifecycle members when the plan is null', () => {
    const merged = buildStandardStackedLoopClip({
      target: makeClip('L6', FULL_REVEAL_LIFECYCLE),
      mergedSourceKeyIds: ['k10'],
      lifecycle: null,
    });
    expect(merged.syncState).toBe('synchronized');
    expect(merged.provenanceState).toBe('attached');
    expect(merged.phaseOrigin).toBe(10);
    expect(merged.originalEndExclusive).toBe(22);
    expect(merged.visibleRanges).toEqual([{ start: 10, endExclusive: 22 }]);
    expect(merged.frameOverrides).toEqual([{ appFrame: 15, keyId: 'k15' }]);
  });

  it('lets a non-null plan lifecycle win over the destination’s lifecycle', () => {
    const planLifecycle: RunScriptStackLifecycle = {
      syncState: 'modified',
      provenanceState: 'attached',
      phaseOrigin: 10,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 10, endExclusive: 30 }],
      frameOverrides: [],
    };
    const merged = buildStandardStackedLoopClip({
      target: makeClip('L7', FULL_REVEAL_LIFECYCLE),
      mergedSourceKeyIds: ['k10'],
      lifecycle: planLifecycle,
    });
    expect(merged.syncState).toBe('modified');
    expect(merged.originalEndExclusive).toBe(30);
    expect(merged.visibleRanges).toEqual([{ start: 10, endExclusive: 30 }]);
    expect(merged.frameOverrides).toEqual([]);
    expect(planLifecycle.provenanceState).toBe('attached');
  });

  it('invents no lifecycle members for a destination that carried none', () => {
    const merged = buildStandardStackedLoopClip({
      target: makeClip('L8'),
      mergedSourceKeyIds: ['k10'],
      lifecycle: null,
    });
    for (const field of ['syncState', 'provenanceState', 'phaseOrigin', 'originalEndExclusive', 'visibleRanges', 'frameOverrides']) {
      expect(Object.prototype.hasOwnProperty.call(merged, field)).toBe(false);
    }
  });
});

describe('isStandardMergedLoopClip', () => {
  it('is false for an undefined clip', () => {
    expect(isStandardMergedLoopClip(undefined)).toBe(false);
  });

  it('is false for a typed rail that still carries a scriptId', () => {
    expect(isStandardMergedLoopClip(makeClip('typed', { scriptId: 'script-1' }))).toBe(false);
  });

  it('is false for a reveal rail, scripted or not', () => {
    expect(isStandardMergedLoopClip(makeClip('reveal', { railKind: 'reveal' }))).toBe(false);
    expect(isStandardMergedLoopClip(makeClip('reveal', { railKind: 'reveal', scriptId: 'script-1' }))).toBe(false);
  });

  it('is true for a provenance-free playscript rail', () => {
    expect(isStandardMergedLoopClip(makeClip('merged'))).toBe(true);
    expect(isStandardMergedLoopClip(makeClip('merged', { railKind: 'playscript' }))).toBe(true);
  });
});

describe('Standard merged-rail copy', () => {
  it('names the merge as the reason Regenerate and Replay are unavailable', () => {
    expect(STANDARD_RAIL_STATUS_COPY).toBe('Merged rail — multiple scripts.');
    expect(STANDARD_RAIL_REGENERATE_REASON).toBe('Regenerate unavailable — this rail merges multiple scripts.');
    expect(STANDARD_RAIL_REPLAY_REASON).toBe('Replay unavailable — this rail merges multiple scripts.');
  });
});
