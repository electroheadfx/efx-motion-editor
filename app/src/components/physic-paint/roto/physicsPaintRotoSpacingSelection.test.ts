import { describe, expect, it } from 'vitest';
import {
  extendPhysicsPaintRotoSpacingProxyRange,
  getPhysicsPaintRotoSourceCycleId,
  reconcilePhysicsPaintRotoSpacingSelection,
  selectPhysicsPaintRotoSpacingProxyPlain,
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
