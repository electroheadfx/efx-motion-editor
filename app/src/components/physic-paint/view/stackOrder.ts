// ============================================================
//  quick 261024-vga — the ONE stack-position law (Brush + Watercolor).
//
//  quick 261027-klx: the implementation is now APP-OWNED (copied
//  verbatim from the retired Brush engine's engine/stackOrder.ts
//  before that package was removed). `stackOrder.parity.test.ts`
//  proved the copy against the package while it still existed.
//
//  Arrays are BOTTOM -> TOP everywhere (strokeStack, payloadTimeline,
//  the badge derivation). The public position is 1 = TOPMOST and
//  `total` = bottom, so the target array index is
//  `total - clamp(position)`. Both adapters (the brush stack and the
//  app's watercolor timeline) consume these helpers instead of
//  re-deriving the arithmetic.
// ============================================================

import type { StackReorderResult } from '../types/paintCore';

export type { StackReorderResult };

/**
 * Clamp a public stack position into 1..total. Truncates fractions, and
 * resolves non-finite input to the nearest bound (NaN -> 1).
 */
export function clampStackPosition(position: number, total: number): number {
  const totalCount = Math.trunc(total);
  if (!Number.isFinite(totalCount) || totalCount <= 1) return 1;
  const truncated = Math.trunc(position);
  if (Number.isNaN(truncated)) return 1;
  return Math.min(totalCount, Math.max(1, truncated));
}

/**
 * The array index (bottom-first) for a public position (1 = topmost).
 * A zero/negative total resolves to index 0.
 */
export function targetIndexForStackPosition(position: number, total: number): number {
  const totalCount = Math.trunc(total);
  if (!(totalCount > 0)) return 0;
  return totalCount - clampStackPosition(position, totalCount);
}

/**
 * Move one item (a group) to the exact public position. An invalid
 * `fromIndex` or a placement on the live slot is a no-op that returns the
 * SAME input reference (no allocation).
 */
export function reorderForStackPosition<T>(
  items: readonly T[],
  fromIndex: number,
  positionFromTop: number,
): StackReorderResult<T> {
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= items.length) {
    return { items, changed: false };
  }
  const targetIndex = targetIndexForStackPosition(positionFromTop, items.length);
  if (targetIndex === fromIndex) return { items, changed: false };

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(targetIndex, 0, moved);
  return { items: next, changed: true };
}
