import { describe, expect, it } from 'vitest';
import type { KeyRailSegment } from '../view/physicsPaintKeyRailPresentation';
import type { PhysicPaintRotoLoopRange } from './physicsPaintRotoPhysicalResolver';
import type { RailSetIdentity } from './physicsPaintRotoRailSetSelection';
import { deriveRotoSelectionPlaybackWindow } from './physicsPaintRotoSelectionPlaybackWindow';

function segment(firstKeyFrame: number, lastKeyFrame: number, firstKeyId = 'key-1'): KeyRailSegment {
  return { firstKeyId, keyIds: [firstKeyId], firstKeyFrame, lastKeyFrame };
}

function loopRange(loopId: string, placementStart: number, effectiveEnd: number): PhysicPaintRotoLoopRange {
  return {
    loopId,
    placementStart,
    phaseOrigin: placementStart,
    cycleLength: Math.max(1, effectiveEnd - placementStart),
    sourceFrameCount: 1,
    sourceKeyIds: [`${loopId}-source`],
    sourceCycleId: `${loopId}-cycle`,
    sourceOffsets: [0],
    strictInteriorPolicy: 'hold',
    repeat: 'infinity',
    requestedEnd: 'infinity',
    effectiveEnd,
    boundary: { kind: 'parent-end', frame: effectiveEnd },
    truncated: false,
    partialCycle: false,
    unresolved: null,
  };
}

const keyRail = (firstKeyId = 'key-1'): RailSetIdentity => ({ kind: 'key-rail', firstKeyId });
const loop = (loopId: string): RailSetIdentity => ({ kind: 'loop', loopId });

describe('deriveRotoSelectionPlaybackWindow (JQ0 range derivation)', () => {
  it('fails closed on an empty member list', () => {
    expect(deriveRotoSelectionPlaybackWindow({
      members: [],
      keyRailSegments: [segment(12, 20)],
      loopRanges: [loopRange('loop-1', 30, 38)],
      capacity: 100,
    })).toBeNull();
  });

  it('fails closed on an unknown Key Rail identity', () => {
    expect(deriveRotoSelectionPlaybackWindow({
      members: [keyRail('missing-key')],
      keyRailSegments: [segment(12, 20)],
      loopRanges: [],
      capacity: 100,
    })).toBeNull();
  });

  it('fails closed on a loop id that owns no visible range', () => {
    expect(deriveRotoSelectionPlaybackWindow({
      members: [loop('missing-loop')],
      keyRailSegments: [],
      loopRanges: [loopRange('loop-1', 30, 38)],
      capacity: 100,
    })).toBeNull();
  });

  it('fails closed on an unknown member kind', () => {
    expect(deriveRotoSelectionPlaybackWindow({
      members: [{ kind: 'group', loopId: 'loop-1' } as unknown as RailSetIdentity],
      keyRailSegments: [],
      loopRanges: [loopRange('loop-1', 30, 38)],
      capacity: 100,
    })).toBeNull();
  });

  it('fails closed on malformed input', () => {
    expect(deriveRotoSelectionPlaybackWindow(null as never)).toBeNull();
    expect(deriveRotoSelectionPlaybackWindow({} as never)).toBeNull();
    expect(deriveRotoSelectionPlaybackWindow({
      members: null as never,
      keyRailSegments: [],
      loopRanges: [],
      capacity: 100,
    })).toBeNull();
  });

  it('fails closed on a non-positive or non-integer capacity', () => {
    const input = {
      members: [keyRail()],
      keyRailSegments: [segment(12, 20)],
      loopRanges: [],
    };
    expect(deriveRotoSelectionPlaybackWindow({ ...input, capacity: 0 })).toBeNull();
    expect(deriveRotoSelectionPlaybackWindow({ ...input, capacity: -3 })).toBeNull();
    expect(deriveRotoSelectionPlaybackWindow({ ...input, capacity: 12.5 })).toBeNull();
  });

  it('derives the half-open span of a single Key Rail (lastKeyFrame + 1)', () => {
    const window = deriveRotoSelectionPlaybackWindow({
      members: [keyRail()],
      keyRailSegments: [segment(12, 20)],
      loopRanges: [],
      capacity: 100,
    });
    expect(window).toEqual({ start: 12, endExclusive: 21 });
  });

  it('spans every visible range a Loop Clip owns', () => {
    const window = deriveRotoSelectionPlaybackWindow({
      members: [loop('loop-1')],
      keyRailSegments: [],
      loopRanges: [loopRange('loop-1', 30, 38), loopRange('loop-1', 45, 53)],
      capacity: 100,
    });
    expect(window).toEqual({ start: 30, endExclusive: 53 });
  });

  it('unions a Key Rail and Loop members into one contiguous span regardless of order', () => {
    const forward = deriveRotoSelectionPlaybackWindow({
      members: [keyRail(), loop('loop-1')],
      keyRailSegments: [segment(12, 20)],
      loopRanges: [loopRange('loop-1', 30, 38)],
      capacity: 100,
    });
    const reversed = deriveRotoSelectionPlaybackWindow({
      members: [loop('loop-1'), keyRail()],
      keyRailSegments: [segment(12, 20)],
      loopRanges: [loopRange('loop-1', 30, 38)],
      capacity: 100,
    });
    expect(forward).toEqual({ start: 12, endExclusive: 38 });
    expect(reversed).toEqual(forward);
  });

  it('clamps the end to capacity and the start to 0', () => {
    expect(deriveRotoSelectionPlaybackWindow({
      members: [keyRail()],
      keyRailSegments: [segment(8, 20)],
      loopRanges: [],
      capacity: 10,
    })).toEqual({ start: 8, endExclusive: 10 });

    expect(deriveRotoSelectionPlaybackWindow({
      members: [keyRail()],
      keyRailSegments: [segment(-4, 3)],
      loopRanges: [],
      capacity: 10,
    })).toEqual({ start: 0, endExclusive: 4 });
  });

  it('fails closed when the clamp degenerates the window', () => {
    expect(deriveRotoSelectionPlaybackWindow({
      members: [keyRail()],
      keyRailSegments: [segment(12, 20)],
      loopRanges: [],
      capacity: 5,
    })).toBeNull();
  });

  it('returns a frozen window', () => {
    const window = deriveRotoSelectionPlaybackWindow({
      members: [keyRail()],
      keyRailSegments: [segment(12, 20)],
      loopRanges: [],
      capacity: 100,
    });
    expect(window).not.toBeNull();
    expect(Object.isFrozen(window)).toBe(true);
  });

  it('clamps a loop end to the composite capacity', () => {
    expect(deriveRotoSelectionPlaybackWindow({
      members: [loop('loop-1')],
      keyRailSegments: [],
      loopRanges: [loopRange('loop-1', 30, 150)],
      capacity: 100,
    })).toEqual({ start: 30, endExclusive: 100 });
  });

  it('fails closed when an out-of-capacity loop cannot bound a window', () => {
    expect(deriveRotoSelectionPlaybackWindow({
      members: [loop('loop-1')],
      keyRailSegments: [],
      loopRanges: [loopRange('loop-1', 120, 150)],
      capacity: 100,
    })).toBeNull();
  });
});
