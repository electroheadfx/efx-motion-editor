import { describe, expect, it } from 'vitest';
import {
  reconcileRailMotionsForDocumentEdit,
  type RailMotionDocumentLoopClipFact,
  type RailMotionDocumentSnapshot,
} from './railMotionDocumentReconciler';
import type { PhysicPaintRotoRailMotionRecord } from './railMotionModel';

// 59-15: the commit-point reconciler. These pins drive the classification
// table with real segment inputs (the production `deriveKeyRailSegments`) and
// real 59-06 transitions; the real-transport pins live in
// `app/src/lib/railMotionGateBEdits.test.ts`.

type KeyTuple = readonly [keyId: string, appFrame: number];

function snapshot(
  keys: readonly KeyTuple[],
  options: {
    readonly breaks?: readonly string[];
    readonly loopClips?: readonly RailMotionDocumentLoopClipFact[];
  } = {},
): RailMotionDocumentSnapshot {
  return {
    realKeyRecords: keys.map(([keyId, appFrame]) => ({ keyId, appFrame })),
    incomingInterpolationBreakKeyIds: new Set(options.breaks ?? []),
    loopClips: options.loopClips ?? [],
  };
}

/** One animated record with an opacity channel at the given rail-local frames. */
function motion(
  railId: string,
  anchorKeyId: string,
  frames: readonly number[] = [0, 20],
): PhysicPaintRotoRailMotionRecord {
  return {
    railId,
    anchorKeyId,
    channels: [{
      id: 'opacity',
      keys: frames.map((frame) => ({ frame, value: 0.5, easing: 'ease' as const, wiggle: 0 })),
    }],
  };
}

describe('59-15 rail motion document reconciler — delete-first-key', () => {
  it('re-anchors to the surviving first key without touching rail-local frames', () => {
    const record = motion('rail-1', 'A');
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['A', 0], ['B', 10]]),
      next: snapshot([['B', 10]]),
      railMotions: [record],
    });

    expect(result.railMotions).toHaveLength(1);
    expect(result.railMotions[0]).not.toBe(record);
    expect(result.railMotions[0].railId).toBe('rail-1');
    expect(result.railMotions[0].anchorKeyId).toBe('B');
    expect(result.railMotions[0].channels).toEqual(record.channels);
    expect(result.railMotions[0].channels[0].keys).toEqual(record.channels[0].keys);
    expect(result.adoptedRailId).toBeNull();
    expect(result.droppedRailId).toBeNull();
    expect(result.droppedRailFrames).toBeNull();
  });

  it('keeps the railId and anchor for a non-first key deletion', () => {
    const record = motion('rail-1', 'A');
    const input = [record];
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['A', 0], ['B', 10], ['C', 20]]),
      next: snapshot([['A', 0], ['C', 20]]),
      railMotions: input,
    });

    expect(result.railMotions).toBe(input);
    expect(result.railMotions[0]).toBe(record);
    expect(result.railMotions[0].anchorKeyId).toBe('A');
  });
});

describe('59-15 rail motion document reconciler — collection identity', () => {
  it('returns the input collection reference when no record changes', () => {
    const record = motion('rail-1', 'A');
    const input = [record];
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['A', 0], ['B', 10]]),
      next: snapshot([['A', 0], ['B', 10]]),
      railMotions: input,
    });

    expect(result.railMotions).toBe(input);
    expect(result.adoptedRailId).toBeNull();
    expect(result.droppedRailId).toBeNull();
    expect(result.droppedRailFrames).toBeNull();
  });

  it('retains an already-orphaned record byte-identically and never transitions it', () => {
    const orphan = motion('rail-orphan', 'Z');
    const input = [orphan];
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['A', 0], ['B', 10]]),
      next: snapshot([['A', 0]]),
      railMotions: input,
    });

    expect(result.railMotions).toBe(input);
    expect(result.railMotions[0]).toBe(orphan);
    expect(result.adoptedRailId).toBeNull();
    expect(result.droppedRailId).toBeNull();
    expect(result.droppedRailFrames).toBeNull();
  });

  it('freezes and canonicalizes a changed collection through the 59-02 parser', () => {
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['A', 0], ['B', 10]]),
      next: snapshot([['B', 10]]),
      railMotions: [motion('rail-b', 'A')],
    });

    expect(Object.isFrozen(result.railMotions)).toBe(true);
    expect(Object.isFrozen(result.railMotions[0])).toBe(true);
  });
});

describe('59-15 rail motion document reconciler — loop-owned rails', () => {
  const liveLoop = [{ loopId: 'loop-1', sourceKeyIds: ['A', 'B'] }];

  it('keeps the record while the loop clip survives', () => {
    const record = motion('loop-1', 'A');
    const input = [record];
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['A', 0], ['B', 10]], { loopClips: liveLoop }),
      next: snapshot([['A', 0], ['B', 10]], { loopClips: liveLoop }),
      railMotions: input,
    });

    expect(result.railMotions).toBe(input);
    expect(result.railMotions[0]).toBe(record);
  });

  it('removes the record when the loop clip is gone', () => {
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['A', 0], ['B', 10]], { loopClips: liveLoop }),
      next: snapshot([['A', 0], ['B', 10]]),
      railMotions: [motion('loop-1', 'A')],
    });

    expect(result.railMotions).toEqual([]);
    expect(result.adoptedRailId).toBeNull();
    expect(result.droppedRailId).toBeNull();
    expect(result.droppedRailFrames).toBeNull();
  });
});

describe('59-15 rail motion document reconciler — delete-only-key', () => {
  it('removes the record when no next segment shares any key', () => {
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['B', 10]]),
      next: snapshot([['A', 0]]),
      railMotions: [motion('rail-b', 'B')],
    });

    expect(result.railMotions).toEqual([]);
    expect(result.droppedRailId).toBeNull();
  });
});

describe('59-15 rail motion document reconciler — split', () => {
  it('keeps the head record unchanged and creates no tail record', () => {
    const record = motion('rail-1', 'A');
    const input = [record];
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['A', 0], ['B', 10], ['C', 20]]),
      next: snapshot([['A', 0], ['B', 10], ['C', 20]], { breaks: ['C'] }),
      railMotions: input,
    });

    expect(result.railMotions).toBe(input);
    expect(result.railMotions[0]).toBe(record);
    expect(result.adoptedRailId).toBeNull();
    expect(result.droppedRailId).toBeNull();
    expect(result.droppedRailFrames).toBeNull();
  });
});

describe('59-15 rail motion document reconciler — rail start moved', () => {
  it('leaves rail identity and every rail-local key frame unchanged', () => {
    const record = motion('rail-1', 'A');
    const input = [record];
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot([['A', 0], ['B', 10]]),
      next: snapshot([['A', 5], ['B', 15]]),
      railMotions: input,
    });

    expect(result.railMotions).toBe(input);
    expect(result.railMotions[0]).toBe(record);
    expect(result.railMotions[0].channels[0].keys).toEqual(record.channels[0].keys);
  });
});

describe('59-15 rail motion document reconciler — merge', () => {
  const splitPrevious = (): RailMotionDocumentSnapshot => snapshot(
    [['A', 0], ['B', 10], ['C', 20], ['D', 30]],
    { breaks: ['C'] },
  );
  const mergedNext = (): RailMotionDocumentSnapshot => snapshot(
    [['A', 0], ['B', 10], ['C', 20], ['D', 30]],
  );

  it('two animated sides: the head wins and the drop reports the prior app-frame span', () => {
    const head = motion('rail-head', 'A');
    const tail = motion('rail-tail', 'C');
    const result = reconcileRailMotionsForDocumentEdit({
      previous: splitPrevious(),
      next: mergedNext(),
      railMotions: [head, tail],
    });

    expect(result.railMotions).toHaveLength(1);
    expect(result.railMotions[0].railId).toBe('rail-head');
    expect(result.railMotions[0].anchorKeyId).toBe('A');
    expect(result.adoptedRailId).toBeNull();
    expect(result.droppedRailId).toBe('rail-tail');
    expect(result.droppedRailFrames).toEqual({ startFrame: 20, endFrameExclusive: 31 });
  });

  it('one animated side: the tail survives under its own railId, re-anchored, with no drop', () => {
    const tail = motion('rail-tail', 'C');
    const result = reconcileRailMotionsForDocumentEdit({
      previous: splitPrevious(),
      next: mergedNext(),
      railMotions: [tail],
    });

    expect(result.railMotions).toHaveLength(1);
    expect(result.railMotions[0].railId).toBe('rail-tail');
    expect(result.railMotions[0].anchorKeyId).toBe('A');
    expect(result.railMotions[0].channels).toEqual(tail.channels);
    expect(result.adoptedRailId).toBe('rail-tail');
    expect(result.droppedRailId).toBeNull();
    expect(result.droppedRailFrames).toBeNull();
  });

  it('classifies identically regardless of the collection iteration order', () => {
    const head = motion('rail-head', 'A');
    const tail = motion('rail-tail', 'C');
    const forward = reconcileRailMotionsForDocumentEdit({
      previous: splitPrevious(),
      next: mergedNext(),
      railMotions: [head, tail],
    });
    const reversed = reconcileRailMotionsForDocumentEdit({
      previous: splitPrevious(),
      next: mergedNext(),
      railMotions: [tail, head],
    });

    expect(reversed.railMotions).toEqual(forward.railMotions);
    expect(reversed.droppedRailId).toBe(forward.droppedRailId);
    expect(reversed.droppedRailFrames).toEqual(forward.droppedRailFrames);
  });
});

describe('59-15 rail motion document reconciler — group ownership is load-bearing', () => {
  // B is owned by the loop clip on the previous side, so the previous
  // derivation flushes at B: [A] and [C]. Without the ownership facts the same
  // key list derives one [A, B, C] segment and the record anchored at C is
  // unchanged. The removal of the owning clip turns B ordinary, so the next
  // side derives [A, B, C] and the C-anchored record is the tail of a merge.
  const keys: readonly KeyTuple[] = [['A', 0], ['B', 10], ['C', 20]];
  const explicitOwnership: readonly RailMotionDocumentLoopClipFact[] = [
    { loopId: 'loop-1', sourceKeyIds: ['B'] },
  ];

  it('flushes the prior segment at the group-owned key and merges the tail record', () => {
    const record = motion('rail-c', 'C');
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot(keys, { loopClips: explicitOwnership }),
      next: snapshot(keys),
      railMotions: [record],
    });

    expect(result.railMotions).toHaveLength(1);
    expect(result.railMotions[0].railId).toBe('rail-c');
    expect(result.railMotions[0].anchorKeyId).toBe('A');
    expect(result.adoptedRailId).toBe('rail-c');
    expect(result.droppedRailId).toBeNull();
  });

  it('classifies the same fixture differently when the ownership facts are absent', () => {
    const record = motion('rail-c', 'C');
    const input = [record];
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot(keys),
      next: snapshot(keys),
      railMotions: input,
    });

    expect(result.railMotions).toBe(input);
    expect(result.railMotions[0]).toBe(record);
    expect(result.railMotions[0].anchorKeyId).toBe('C');
    expect(result.adoptedRailId).toBeNull();
  });

  it('honours frameOverrides ownership exactly like sourceKeyIds ownership', () => {
    const record = motion('rail-c', 'C');
    const result = reconcileRailMotionsForDocumentEdit({
      previous: snapshot(keys, {
        loopClips: [{
          loopId: 'loop-1',
          sourceKeyIds: [],
          frameOverrides: [{ keyId: 'B' }],
        }],
      }),
      next: snapshot(keys),
      railMotions: [record],
    });

    expect(result.railMotions[0].anchorKeyId).toBe('A');
    expect(result.adoptedRailId).toBe('rail-c');
  });
});
