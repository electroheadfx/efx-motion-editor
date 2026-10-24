// ============================================================
//  quick 261024-vga Task 1 — the ONE stack-position law.
//
//  Arrays are BOTTOM -> TOP everywhere in this feature (strokeStack,
//  payloadTimeline, the badge derivation). The public position is
//  1 = TOPMOST / total = bottom, so the target index is
//  `total - clamped(position)`.
//
//  The implementation lives in the package (the engine consumes it
//  too); this suite drives the app-facing re-export so both
//  adapters provably share one law.
// ============================================================

import { describe, expect, it } from 'vitest';
import {
  clampStackPosition,
  reorderForStackPosition,
  targetIndexForStackPosition,
} from './stackOrder';

/** Bottom -> top A B C D E: A is position 5, E is position 1. */
const ITEMS = ['A', 'B', 'C', 'D', 'E'] as const;

describe('quick 261024-vga shared stack-position law', () => {
  it('places a group at the exact public position (1 = topmost)', () => {
    expect(reorderForStackPosition(ITEMS, 2, 1).items).toEqual(['A', 'B', 'D', 'E', 'C']);
    expect(reorderForStackPosition(ITEMS, 2, 5).items).toEqual(['C', 'A', 'B', 'D', 'E']);
    expect(reorderForStackPosition(ITEMS, 0, 3).items).toEqual(['B', 'C', 'A', 'D', 'E']);
  });

  it('the target index is total - clamped(position)', () => {
    expect(targetIndexForStackPosition(1, 5)).toBe(4);
    expect(targetIndexForStackPosition(5, 5)).toBe(0);
    expect(targetIndexForStackPosition(3, 5)).toBe(2);
    // Out-of-range positions clamp to the ends.
    expect(targetIndexForStackPosition(0, 5)).toBe(4);
    expect(targetIndexForStackPosition(9, 5)).toBe(0);
    // A zero/negative total resolves to index 0.
    expect(targetIndexForStackPosition(1, 0)).toBe(0);
    expect(targetIndexForStackPosition(3, -2)).toBe(0);
  });

  it('a same-position placement returns changed false and the SAME items reference', () => {
    const result = reorderForStackPosition(ITEMS, 2, 3);
    expect(result.changed).toBe(false);
    // No allocation on the unchanged path.
    expect(result.items).toBe(ITEMS);
  });

  it('out-of-range positions clamp: 0 behaves as 1 and 99 as total', () => {
    expect(reorderForStackPosition(ITEMS, 2, 0).items).toEqual(['A', 'B', 'D', 'E', 'C']);
    expect(reorderForStackPosition(ITEMS, 2, 99).items).toEqual(['C', 'A', 'B', 'D', 'E']);
    // A clamped position that lands on the live slot is still a no-op.
    const noop = reorderForStackPosition(ITEMS, 2, 99);
    expect(noop.changed).toBe(true);
    expect(reorderForStackPosition(ITEMS, 2, 3).changed).toBe(false);
  });

  it('an invalid fromIndex returns changed false with the items untouched', () => {
    for (const fromIndex of [-1, 5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = reorderForStackPosition(ITEMS, fromIndex, 1);
      expect(result.changed, `fromIndex ${fromIndex}`).toBe(false);
      expect(result.items).toBe(ITEMS);
    }
    const empty: readonly string[] = [];
    const result = reorderForStackPosition(empty, 0, 1);
    expect(result.changed).toBe(false);
    expect(result.items).toBe(empty);
  });

  it('clampStackPosition truncates and clamps into 1..total', () => {
    expect(clampStackPosition(3, 5)).toBe(3);
    expect(clampStackPosition(3.9, 5)).toBe(3);
    expect(clampStackPosition(-4, 5)).toBe(1);
    expect(clampStackPosition(0, 5)).toBe(1);
    expect(clampStackPosition(99, 5)).toBe(5);
    // total <= 1 always resolves to 1.
    expect(clampStackPosition(3, 1)).toBe(1);
    expect(clampStackPosition(3, 0)).toBe(1);
    expect(clampStackPosition(3, -1)).toBe(1);
    // Non-finite input resolves to the nearest bound.
    expect(clampStackPosition(Number.POSITIVE_INFINITY, 5)).toBe(5);
    expect(clampStackPosition(Number.NaN, 5)).toBe(1);
    expect(clampStackPosition(2, Number.POSITIVE_INFINITY)).toBe(1);
  });

  it('a moved group keeps its internal order and every item appears exactly once', () => {
    const groups = [
      ['a1', 'a2'],
      ['b'],
      ['c1', 'c2', 'c3'],
    ];
    const result = reorderForStackPosition(groups, 0, 1);
    expect(result.changed).toBe(true);
    expect(result.items).toEqual([['b'], ['c1', 'c2', 'c3'], ['a1', 'a2']]);
    expect(result.items.flat()).toHaveLength(6);
    expect(new Set(result.items.flat()).size).toBe(6);

    // Moving DOWN keeps the group intact too.
    const down = reorderForStackPosition(groups, 2, 3);
    expect(down.items).toEqual([['c1', 'c2', 'c3'], ['a1', 'a2'], ['b']]);
  });
});
