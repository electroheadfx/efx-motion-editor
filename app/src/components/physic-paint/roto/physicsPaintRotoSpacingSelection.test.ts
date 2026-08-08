import { describe, expect, it } from 'vitest';
import {
  extendPhysicsPaintRotoSpacingProxyRange,
  getPhysicsPaintRotoSourceCycleId,
  reconcilePhysicsPaintRotoLoopClipSelection,
  reconcilePhysicsPaintRotoSpacingSelection,
  selectPhysicsPaintRotoSpacingProxyPlain,
  updatePhysicsPaintRotoLoopClipSelection,
  togglePhysicsPaintRotoSpacingProxy,
  type PhysicsPaintRotoSpacingProxy,
} from './physicsPaintRotoSpacingSelection';

const CYCLE = ['A', 'B', 'C', 'D'] as const;

function proxy(sourceKeyId: string, sourceIndex: number, sourceKeyIds: readonly string[] = CYCLE, loopId = 'loop-1'): PhysicsPaintRotoSpacingProxy {
  return {
    loopId,
    sourceCycleId: getPhysicsPaintRotoSourceCycleId(sourceKeyIds),
    sourceKeyIds,
    sourceKeyId,
    sourceIndex,
  };
}

describe('Physics Paint Roto Loop Rail selection', () => {
  const orderedLoopIds = ['loop-a', 'loop-b', 'loop-c'] as const;

  it('supports plain, contiguous Shift range, and non-contiguous Cmd/Ctrl toggle selection', () => {
    const plain = updatePhysicsPaintRotoLoopClipSelection(
      null,
      orderedLoopIds,
      'loop-a',
      'plain',
    );
    const ranged = updatePhysicsPaintRotoLoopClipSelection(
      plain,
      orderedLoopIds,
      'loop-c',
      'range',
    );
    const toggled = updatePhysicsPaintRotoLoopClipSelection(
      plain,
      orderedLoopIds,
      'loop-c',
      'toggle',
    );

    expect(plain).toEqual({
      selectedLoopClipIds: ['loop-a'],
      anchorLoopClipId: 'loop-a',
      primaryLoopClipId: 'loop-a',
    });
    expect(ranged).toEqual({
      selectedLoopClipIds: ['loop-a', 'loop-b', 'loop-c'],
      anchorLoopClipId: 'loop-a',
      primaryLoopClipId: 'loop-c',
    });
    expect(toggled).toEqual({
      selectedLoopClipIds: ['loop-a', 'loop-c'],
      anchorLoopClipId: 'loop-a',
      primaryLoopClipId: 'loop-c',
    });
    expect(Object.isFrozen(ranged)).toBe(true);
    expect(Object.isFrozen(ranged?.selectedLoopClipIds)).toBe(true);
  });

  it('reconciles stale rail identities without inventing a hidden replacement scope', () => {
    const selected = updatePhysicsPaintRotoLoopClipSelection(
      updatePhysicsPaintRotoLoopClipSelection(null, orderedLoopIds, 'loop-a', 'plain'),
      orderedLoopIds,
      'loop-c',
      'toggle',
    );

    expect(reconcilePhysicsPaintRotoLoopClipSelection(selected, ['loop-a', 'loop-b']))
      .toEqual({
        selectedLoopClipIds: ['loop-a'],
        anchorLoopClipId: 'loop-a',
        primaryLoopClipId: 'loop-a',
      });
    expect(reconcilePhysicsPaintRotoLoopClipSelection(selected, ['loop-b']))
      .toBeNull();
  });
});

describe('Physics Paint Roto source-position spacing selection', () => {
  it('plain selection collapses to one immutable source-position proxy', () => {
    const selected = selectPhysicsPaintRotoSpacingProxyPlain(null, proxy('B', 1));

    expect(selected).toEqual({
      sourceCycleId: getPhysicsPaintRotoSourceCycleId(CYCLE),
      sourceKeyIds: CYCLE,
      selectedSourceKeyIds: ['B'],
      anchorSourceIndex: 1,
    });
    expect(Object.isFrozen(selected)).toBe(true);
    if (selected === null) throw new Error('Expected a plain spacing selection.');
    expect(Object.isFrozen(selected.sourceKeyIds)).toBe(true);
    expect(Object.isFrozen(selected.selectedSourceKeyIds)).toBe(true);
  });

  it('Cmd/Ctrl toggle deduplicates equivalent repeats and shared-loop placements by source identity', () => {
    const first = selectPhysicsPaintRotoSpacingProxyPlain(null, proxy('B', 1, CYCLE, 'loop-original'));
    const sameSourceFromRepeat = togglePhysicsPaintRotoSpacingProxy(first, proxy('B', 1, CYCLE, 'loop-shared'));
    const reselected = togglePhysicsPaintRotoSpacingProxy(sameSourceFromRepeat, proxy('B', 1, CYCLE, 'loop-shared'));

    expect(sameSourceFromRepeat).toBeNull();
    expect(reselected?.selectedSourceKeyIds).toEqual(['B']);
  });

  it('Shift range selects the inclusive ordered source-index range from the stable anchor', () => {
    const first = selectPhysicsPaintRotoSpacingProxyPlain(null, proxy('B', 1));
    const ranged = extendPhysicsPaintRotoSpacingProxyRange(first, proxy('D', 3));

    expect(ranged?.selectedSourceKeyIds).toEqual(['B', 'C', 'D']);
    expect(ranged?.anchorSourceIndex).toBe(1);
  });

  it('a different ordered source cycle starts a fresh proxy selection for plain, toggle, and range gestures', () => {
    const first = selectPhysicsPaintRotoSpacingProxyPlain(null, proxy('B', 1));
    const otherCycle = ['A', 'C', 'D'] as const;

    for (const next of [
      selectPhysicsPaintRotoSpacingProxyPlain(first, proxy('C', 1, otherCycle, 'loop-2')),
      togglePhysicsPaintRotoSpacingProxy(first, proxy('C', 1, otherCycle, 'loop-2')),
      extendPhysicsPaintRotoSpacingProxyRange(first, proxy('C', 1, otherCycle, 'loop-2')),
    ]) {
      expect(next?.sourceCycleId).toBe(getPhysicsPaintRotoSourceCycleId(otherCycle));
      expect(next?.selectedSourceKeyIds).toEqual(['C']);
      expect(next?.anchorSourceIndex).toBe(1);
    }
  });

  it('reconciles only an exact current ordered cycle with unique current members and a valid anchor', () => {
    const selected = extendPhysicsPaintRotoSpacingProxyRange(
      selectPhysicsPaintRotoSpacingProxyPlain(null, proxy('B', 1)),
      proxy('D', 3),
    );

    expect(reconcilePhysicsPaintRotoSpacingSelection(selected, [
      { sourceKeyIds: ['A', 'B', 'C', 'D'] },
      { sourceKeyIds: ['A', 'B', 'C', 'D'] },
    ])).toEqual(selected);
    expect(reconcilePhysicsPaintRotoSpacingSelection(selected, [{ sourceKeyIds: ['A', 'B', 'D'] }])).toBeNull();
    expect(reconcilePhysicsPaintRotoSpacingSelection({ ...selected!, selectedSourceKeyIds: ['B', 'B'] }, [{ sourceKeyIds: CYCLE }])).toBeNull();
    expect(reconcilePhysicsPaintRotoSpacingSelection({ ...selected!, selectedSourceKeyIds: ['B', 'STALE'] }, [{ sourceKeyIds: CYCLE }])).toBeNull();
    expect(reconcilePhysicsPaintRotoSpacingSelection({ ...selected!, anchorSourceIndex: 99 }, [{ sourceKeyIds: CYCLE }])).toBeNull();
  });
});
