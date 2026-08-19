import { describe, expect, it } from 'vitest';
import {
  clearRailSetSnapshots,
  deriveRailSetOrder,
  reconcileRailSetSelection,
  recordRailSetSnapshot,
  resolveRailSetPostAcceptance,
  seedRailSetSelection,
  updatePhysicsPaintRotoRailSetSelection,
  type RailSetIdentity,
  type RailSetSelectionState,
} from './physicsPaintRotoRailSetSelection';
import { deriveKeyRailSegments } from '../view/physicsPaintKeyRailPresentation';
import { getRailsInCanonicalOrder } from '../view/physicsPaintRailKeyboardNavigation';

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

});

describe('range and union gestures (Task 2)', () => {
  it('Shift range replaces the set with the ordered anchor-to-target slice and keeps the anchor', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const ranged = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-d'), 'range');

    expect(ranged).toEqual({
      members: [keyRail('key-a'), loop('loop-b'), keyRail('key-c'), loop('loop-d')],
      anchor: keyRail('key-a'),
    });
  });

  it('Shift range from a later anchor selects the slice in canonical order', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, loop('loop-d'), 'plain');
    const ranged = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, keyRail('key-a'), 'range');

    expect(ranged).toEqual({
      members: [keyRail('key-a'), loop('loop-b'), keyRail('key-c'), loop('loop-d')],
      anchor: loop('loop-d'),
    });
  });

  it('Cmd+Shift union adds the anchor-to-target slice to the current set and keeps the anchor', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const toggled = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-d'), 'toggle');
    const unioned = updatePhysicsPaintRotoRailSetSelection(toggled, ORDERED, keyRail('key-c'), 'union');

    expect(unioned).toEqual({
      members: [keyRail('key-a'), loop('loop-b'), keyRail('key-c'), loop('loop-d')],
      anchor: keyRail('key-a'),
    });
  });

  it('union is idempotent on already-selected members', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const unioned = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, keyRail('key-a'), 'union');

    expect(unioned).toEqual(first);
  });

  it('range and union are fail-closed on an unknown target identity', () => {
    const first = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');
    const ranged = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-unknown'), 'range');
    const unioned = updatePhysicsPaintRotoRailSetSelection(first, ORDERED, loop('loop-unknown'), 'union');

    expect(ranged).toBe(first);
    expect(unioned).toBe(first);
  });

  it('range and union leave state unchanged with no valid anchor', () => {
    const ranged = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, loop('loop-d'), 'range');
    const unioned = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, loop('loop-d'), 'union');

    expect(ranged).toBeNull();
    expect(unioned).toBeNull();
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

  it('agrees with getRailsInCanonicalOrder on the same mixed-timeline fixture (one ordering authority)', () => {
    const fakes = [
      { id: 'loop-d', firstFrame: 8 },
      { id: 'key-a', firstFrame: 2 },
      { id: 'loop-b', firstFrame: 4 },
      { id: 'key-c', firstFrame: 6 },
    ];
    const scope = {
      querySelectorAll: () => fakes.map((fake) => ({
        getAttribute: (name: string) => (name === 'data-rail-first-frame' ? String(fake.firstFrame) : null),
      })),
    };
    const focusOrder = getRailsInCanonicalOrder(scope as never)
      .map((rail) => Number(rail.getAttribute('data-rail-first-frame')));
    const setOrder = deriveRailSetOrder({
      keyRailSegments: [
        { firstKeyId: 'key-a', firstKeyFrame: 2 },
        { firstKeyId: 'key-c', firstKeyFrame: 6 },
      ],
      loopRanges: [
        { loopId: 'loop-b', placementStart: 4 },
        { loopId: 'loop-d', placementStart: 8 },
      ],
    });
    const setFrames = setOrder.map((identity) => (
      identity.kind === 'loop'
        ? fakes.find((fake) => fake.id === identity.loopId)!.firstFrame
        : fakes.find((fake) => fake.id === identity.firstKeyId)!.firstFrame
    ));

    expect(setFrames).toEqual(focusOrder);
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

describe('rail-set post-acceptance snapshot side-channel (43.6-01 Task 3, D-06 carrier)', () => {
  const beforeSet = (): RailSetSelectionState => ({
    members: Object.freeze([keyRail('key-a'), loop('loop-b')]),
    anchor: keyRail('key-a'),
  });
  const afterSet = (): RailSetSelectionState => ({
    members: Object.freeze([keyRail('key-a'), loop('loop-b'), keyRail('key-c')]),
    anchor: keyRail('key-a'),
  });

  it('restores the recorded before set exactly on undo', () => {
    clearRailSetSnapshots();
    recordRailSetSnapshot('op-1', beforeSet(), afterSet());
    const resolved = resolveRailSetPostAcceptance({
      operationKind: 'undo',
      operationId: 'op-1',
      current: afterSet(),
    });
    expect(resolved).toEqual(beforeSet());
  });

  it('restores the recorded after set exactly on redo', () => {
    clearRailSetSnapshots();
    recordRailSetSnapshot('op-1', beforeSet(), afterSet());
    const resolved = resolveRailSetPostAcceptance({
      operationKind: 'redo',
      operationId: 'op-1',
      current: beforeSet(),
    });
    expect(resolved).toEqual(afterSet());
  });

  it('keeps the current set on move-rails (identities are move-stable)', () => {
    clearRailSetSnapshots();
    const current = afterSet();
    expect(resolveRailSetPostAcceptance({
      operationKind: 'move-rails',
      operationId: 'op-1',
      current,
    })).toBe(current);
  });

  it('keeps the current set on spacing-on-set (identities survive respacing)', () => {
    clearRailSetSnapshots();
    const current = afterSet();
    expect(resolveRailSetPostAcceptance({
      operationKind: 'spacing-on-set',
      operationId: 'op-1',
      current,
    })).toBe(current);
  });

  it('returns null on delete-rails', () => {
    clearRailSetSnapshots();
    expect(resolveRailSetPostAcceptance({
      operationKind: 'delete-rails',
      operationId: 'op-1',
      current: afterSet(),
    })).toBeNull();
  });

  it('records delete-rails with an empty after set so redo clears it again (D-06)', () => {
    clearRailSetSnapshots();
    recordRailSetSnapshot('op-1', beforeSet(), null);
    expect(resolveRailSetPostAcceptance({
      operationKind: 'redo',
      operationId: 'op-1',
      current: null,
    })).toBeNull();
    expect(resolveRailSetPostAcceptance({
      operationKind: 'undo',
      operationId: 'op-1',
      current: null,
    })).toEqual(beforeSet());
  });

  it('leaves the set unchanged for unlisted kinds (Pitfall 6 — no default collapse)', () => {
    clearRailSetSnapshots();
    const current = afterSet();
    expect(resolveRailSetPostAcceptance({
      operationKind: 'force-spacing',
      operationId: 'op-1',
      current,
    })).toBe(current);
  });

  it('leaves the set unchanged for undo/redo without a recorded snapshot (reconcile stays the stale authority)', () => {
    clearRailSetSnapshots();
    const current = afterSet();
    expect(resolveRailSetPostAcceptance({
      operationKind: 'undo',
      operationId: 'unrecorded-op',
      current,
    })).toBe(current);
  });

  it('prunes all snapshots on clearRailSetSnapshots (launch replacement)', () => {
    clearRailSetSnapshots();
    recordRailSetSnapshot('op-1', beforeSet(), afterSet());
    clearRailSetSnapshots();
    const current = afterSet();
    expect(resolveRailSetPostAcceptance({
      operationKind: 'undo',
      operationId: 'op-1',
      current,
    })).toBe(current);
  });
});

describe('seedRailSetSelection (43.6-08 seed bridge)', () => {
  it('returns a non-null current set unchanged (an active set always wins)', () => {
    const current = updatePhysicsPaintRotoRailSetSelection(null, ORDERED, keyRail('key-a'), 'plain');

    expect(seedRailSetSelection(current, loop('loop-d'))).toBe(current);
  });

  it('seeds a one-member key-rail set anchored on the plain-selected rail when the set is null', () => {
    const seeded = seedRailSetSelection(null, keyRail('key-a'));

    expect(seeded).toEqual({ members: [keyRail('key-a')], anchor: keyRail('key-a') });
    if (seeded === null) throw new Error('Expected a seeded key-rail set.');
    expect(Object.isFrozen(seeded)).toBe(true);
    expect(Object.isFrozen(seeded.members)).toBe(true);
  });

  it('seeds a one-member loop set anchored on the plain-selected rail when the set is null', () => {
    const seeded = seedRailSetSelection(null, loop('loop-b'));

    expect(seeded).toEqual({ members: [loop('loop-b')], anchor: loop('loop-b') });
  });

  it('returns null when both the current set and the single identity are null', () => {
    expect(seedRailSetSelection(null, null)).toBeNull();
  });

  it('is fail-closed on a malformed single identity (unknown kind, empty id, non-object)', () => {
    expect(seedRailSetSelection(null, { kind: 'mystery', id: 'x' } as unknown as RailSetIdentity)).toBeNull();
    expect(seedRailSetSelection(null, { kind: 'loop', loopId: '' } as RailSetIdentity)).toBeNull();
    expect(seedRailSetSelection(null, 'loop-b' as unknown as RailSetIdentity)).toBeNull();
  });

  it('carries the plain-selected rail into a Cmd+click toggle (seed {A} then toggle B yields {A, B} anchored on A)', () => {
    const seeded = seedRailSetSelection(null, keyRail('key-a'));
    const next = updatePhysicsPaintRotoRailSetSelection(seeded, ORDERED, loop('loop-b'), 'toggle');

    expect(next).toEqual({ members: [keyRail('key-a'), loop('loop-b')], anchor: keyRail('key-a') });
  });

  it('carries the plain-selected rail into a Shift+click range (seed {A} then range B yields the slice {A, B} anchored on A)', () => {
    const seeded = seedRailSetSelection(null, keyRail('key-a'));
    const next = updatePhysicsPaintRotoRailSetSelection(seeded, ORDERED, loop('loop-b'), 'range');

    expect(next).toEqual({ members: [keyRail('key-a'), loop('loop-b')], anchor: keyRail('key-a') });
  });
});
