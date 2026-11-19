// ============================================================
//  bristles.ts — the deterministic per-bristle set (64-21).
//
//  RED skeleton: type-correct, behavior wrong on purpose so the suite
//  collects and fails on its assertions rather than on a module-resolution
//  error. The GREEN commit ports the spike 002 generator law for law.
// ============================================================

export const BRISTLE_CAP = 256;
export const BRISTLE_SPACING_PX = 1.1;
export const BRISTLE_MIN = 40;

export interface BristleSet {
  readonly count: number;
  readonly data: Float32Array;
}

export function bristleCount(halfWidthPx: number): number {
  void halfWidthPx;
  return BRISTLE_MIN;
}

export function makeBristles(count: number, rng: () => number): BristleSet {
  void rng;
  return { count, data: new Float32Array(0) };
}
