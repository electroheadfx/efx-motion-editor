import { describe, expect, it } from 'vitest';
import { resolveFxReorderToIndex } from './fxReorder';

/**
 * One-gesture FX/Layer stack DnD (quick-260923-kcs, pre-53 small quics §7).
 *
 * `fxDropIndexFromY` already returns an insertion point in [0, trackCount];
 * the pointerup commit site must translate that into a final index WITHOUT
 * clamping the drop to length-1 BEFORE the removal adjustment — otherwise a
 * downward drag can never land the dragged stack in the final bottom slot
 * (max reachable toIndex when moving down was length-2) and the user had to
 * shuffle in multiple moves.
 */
describe('resolveFxReorderToIndex (one-gesture bottom drop, 260923-kcs)', () => {
  it('commits a drop past the last row from the top into the final bottom slot', () => {
    expect(resolveFxReorderToIndex(3, 0, 3)).toBe(2);
  });

  it('commits a drop past the last row from the middle into the final bottom slot', () => {
    expect(resolveFxReorderToIndex(3, 1, 3)).toBe(2);
  });

  it('lands a boundary drop just above the last row one slot above the end', () => {
    expect(resolveFxReorderToIndex(2, 0, 3)).toBe(1);
  });

  it('keeps an upward drop to the top at index 0', () => {
    expect(resolveFxReorderToIndex(0, 2, 3)).toBe(0);
  });

  it('treats a drop on the own index as identity so the caller no-ops', () => {
    expect(resolveFxReorderToIndex(1, 1, 3)).toBe(1);
  });

  it('clamps out-of-range insertion points into the stack bounds', () => {
    expect(resolveFxReorderToIndex(99, 0, 3)).toBe(2);
    expect(resolveFxReorderToIndex(-1, 0, 3)).toBe(0);
  });
});
