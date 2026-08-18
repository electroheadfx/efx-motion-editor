import { describe, expect, it } from 'vitest';
import {
  deriveRailSetOrder,
  reconcileRailSetSelection,
  updatePhysicsPaintRotoRailSetSelection,
  type RailSetIdentity,
  type RailSetSelectionState,
} from './physicsPaintRotoRailSetSelection';
import { deriveKeyRailSegments } from '../view/physicsPaintKeyRailPresentation';

const loop = (loopId: string): RailSetIdentity => ({ kind: 'loop', loopId });
const keyRail = (firstKeyId: string): RailSetIdentity => ({ kind: 'key-rail', firstKeyId });

function sameIdentity(left: RailSetIdentity, right: RailSetIdentity): boolean {
  return left.kind === right.kind
    && (left.kind === 'loop'
      ? left.loopId === (right as { kind: 'loop'; loopId: string }).loopId
      : left.firstKeyId === (right as { kind: 'key-rail'; firstKeyId: string }).firstKeyId);
}

const ORDERED: readonly RailSetIdentity[] = [
  keyRail('key-a'), // frame 2
  loop('loop-b'),   // frame 4
  keyRail('key-c'), // frame 6
  loop('loop-d'),   // frame 8
];

describe('Physics Paint Roto rail-set selection reducer', () => {
  it('plain click returns a fresh one-member set with the clicked identity as anchor', () => {
    const next = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, loop('loop-b'), 'plain');

    expect(next).toEqual({ members: [loop('loop-b')], anchor: loop('loop-b') });
    expect(Object.isFrozen(next)).toBe(true);
    if (next === null) throw new Error('Expected a plain rail-set selection.');
    expect(Object.isFrozen(next.members)).toBe(true);
  });

  it('Cmd/Ctrl toggle adds an absent identity and keeps the anchor unchanged', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const next = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-d'), 'toggle');

    expect(next).toEqual({ members: [keyRail('key-a'), loop('loop-d')], anchor: keyRail('key-a') });
  });

  it('Cmd/Ctrl toggle removes a present identity and keeps the anchor unchanged', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const second = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-d'), 'toggle');
    const next = updatePhysicsPaintRotoRailSetSelection(second, ORDERED, loop('loop-d'), 'toggle');

    expect(next).toEqual({ members: [keyRail('key-a')], anchor: keyRail('key-a') });
  });

  it('toggling off the anchor falls back to the first ordered member', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const second = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-d'), 'toggle');
    const next = updatePhysicsPaintRotoRailSetSelection(second, ORDERED, keyRail('key-a'), 'toggle');

    expect(next).toEqual({ members: [loop('loop-d')], anchor: loop('loop-d') });
  });

  it('toggling off the last member returns null (empty set is valid, D-05)', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, loop('loop-b'), 'plain');
    const next = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-b'), 'toggle');

    expect(next).toBeNull();
  });

  it('is fail-closed on an unknown target identity', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const next = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-unknown'), 'toggle');

    expect(next).toBe(first);
  });

  it('is fail-closed on a malformed target identity', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const malformed = { kind: 'loop', loopId: '' } as RailSetIdentity;
    const next = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, malformed, 'toggle');

    expect(next).toBe(first);
  });

  it('is fail-closed on a non-unique ordered identity list', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const duplicated = [keyRail('key-a'), keyRail('key-a')] as readonly RailSetIdentity[];
    const next = updatePhysicsPaintRotoRailSetSelection(first, duplicated, keyRail('key-a'), 'toggle');

    expect(next).toBe(first);
  });

  it('leaves state unchanged for range and union gestures (Task 2 scope)', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const ranged = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-d'), 'range');
    const unioned = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-d'), 'union');

    expect(ranged).toBe(first);
    expect(unioned).toBe(first);
  });
});

describe('deriveRailSetOrder', () => {
  it('merges Key Rail segments and loop ranges into one canonical first-frame order', () => {
    const order = deriveRailSetOrder({
      keyRailSegments: [
        { firstKeyId: 'key-c', firstKeyFrame: 6 },
        { firstKeyId: 'key-a', firstKeyFrame: 2 },
      ],
      loopRanges: [
        { loopId: 'loop-d', placementStart: 8 },
        { loopId: 'loop-b', placementStart: 4 },
      ],
    });

    expect(order).toEqual([
      keyRail('key-a'),
      loop('loop-b'),
      keyRail('key-c'),
      loop('loop-d'),
    ]);
  });

  it('breaks ties by kind (key-rail before loop) then identity id ascending', () => {
    const order = deriveRailSetOrder({
      keyRailSegments: [
        { firstKeyId: 'key-z', firstKeyFrame: 4 },
        { firstKeyId: 'key-a', firstKeyFrame: 4 },
      ],
      loopRanges: [
        { loopId: 'loop-m', placementStart: 4 },
      ],
    });

    expect(order).toEqual([
      keyRail('key-a'),
      keyRail('key-z'),
      loop('loop-m'),
    ]);
  });

  it('dedupes loop ranges by loopId using the earliest placementStart', () => {
    const order = deriveRailSetOrder({
      keyRailSegments: [],
      loopRanges: [
        { loopId: 'loop-b', placementStart: 8 },
        { loopId: 'loop-b', placementStart: 4 },
        { loopId: 'loop-a', placementStart: 2 },
      ],
    });

    expect(order).toEqual([loop('loop-a'), loop('loop-b')]);
  });

  it('derives the canonical order from deriveKeyRailSegments + loop ranges only (one ordering authority)', () => {
    const segments = deriveKeyRailSegments({
      orderedRealKeys: [
        { keyId: 'key-a', appFrame: 2 },
        { keyId: 'key-b', appFrame: 6 },
      ],
      incomingInterpolationBreakKeyIds: new Set(['key-b']),
      groupOwnedKeyIds: new Set(),
    });
    const order = deriveRailSetOrder({
      keyRailSegments: segments,
      loopRanges: [
        { loopId: 'loop-b', placementStart: 4 },
        { loopId: 'loop-d', placementStart: 8 },
      ],
    });

    expect(order).toEqual([
      keyRail('key-a'),
      loop('loop-b'),
      keyRail('key-b'),
      loop('loop-d'),
    ]);
  });
});

describe('reconcileRailSetSelection', () => {
  it('returns null when the selection is null', () => {
    expect(reconcileRailSetSelection(null, ORDERED)).toBeNull();
  });

  it('clears the set when any member is absent from the ordered list', () => {
    const selected = updatePhysicsPaintRotoRailSetSelection(
      updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain'),
      ORDERED,
      loop('loop-d'),
      'toggle',
    );
    const reduced = ORDERED.filter((identity) => !sameIdentity(identity, loop('loop-d')));

    expect(reconcileRailSetSelection(selected, reduced)).toBeNull();
  });

  it('clears the set on malformed or duplicated members', () => {
    const selected = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const malformed = { ...selected!, members: [{ kind: 'loop', loopId: '' }] } as RailSetSelectionState;
    const duplicated = { ...selected!, members: [keyRail('key-a'), keyRail('key-a')] } as RailSetSelectionState;

    expect(reconcileRailSetSelection(malformed, ORDERED)).toBeNull();
    expect(reconcileRailSetSelection(duplicated, ORDERED)).toBeNull();
  });

  it('keeps a valid set and falls the anchor back to the first member when the anchor is gone', () => {
    const selected = updatePhysicsPaintRotoRailSetSelection(
      updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain'),
      ORDERED,
      loop('loop-d'),
      'toggle',
    );
    const reconciled = reconcileRailSetSelection(selected, ORDERED);

    expect(reconciled).toEqual(selected);
    expect(Object.isFrozen(reconciled)).toBe(true);
    if (reconciled === null) throw new Error('Expected a reconciled rail-set selection.');
    expect(Object.isFrozen(reconciled.members)).toBe(true);
  });
});
