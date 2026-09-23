/**
 * Pure insertion-point translation for FX/Layer stack reorders (quick-260923-kcs).
 *
 * `fxDropIndexFromY` returns an insertion point in [0, trackCount] — including
 * `trackCount` for a drop PAST the last row. Clamping that to `length - 1`
 * BEFORE the removal adjustment (the old commit-site math) made the final
 * bottom slot unreachable when moving down (max toIndex = length - 2), forcing
 * multi-move shuffles. This resolver clamps the drop to [0, trackCount],
 * adjusts for the removal, then clamps the final index to [0, trackCount - 1].
 * The caller no-ops when the result equals `fromIndex`.
 */
export function resolveFxReorderToIndex(dropIndex: number, fromIndex: number, trackCount: number): number {
  const clampedDrop = Math.max(0, Math.min(dropIndex, trackCount));
  const toIndex = clampedDrop > fromIndex ? clampedDrop - 1 : clampedDrop;
  return Math.max(0, Math.min(toIndex, trackCount - 1));
}
