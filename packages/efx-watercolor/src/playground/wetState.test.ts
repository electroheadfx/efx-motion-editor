import { describe, expect, it } from 'vitest';
import { isSheetWet, WET_THRESHOLD } from './wetState';

const wet = (over: Partial<{ wetPeak: number; wetUntilMs: number; nowMs: number; fixing: boolean; held: boolean }> = {}) =>
  isSheetWet({ wetPeak: 0.5, wetUntilMs: 5000, nowMs: 1000, fixing: false, ...over });

describe('isSheetWet', () => {
  it('is false during the Dry fix bake even with plenty of water', () => {
    expect(wet({ fixing: true, wetPeak: 0.9 })).toBe(false);
  });

  it('uses a strict threshold: exactly WET_THRESHOLD is dry, just above is wet', () => {
    expect(WET_THRESHOLD).toBe(0.004);
    expect(wet({ wetPeak: 0.004 })).toBe(false);
    expect(wet({ wetPeak: 0.005 })).toBe(true);
  });

  it('expires exactly at wetUntil: now === wetUntil is dry, one ms below is wet', () => {
    expect(wet({ nowMs: 5000, wetUntilMs: 5000 })).toBe(false);
    expect(wet({ nowMs: 4999, wetUntilMs: 5000 })).toBe(true);
  });

  it('a fresh or cleared sheet is dry even at now = 0', () => {
    expect(wet({ wetPeak: 0, wetUntilMs: -Infinity, nowMs: 0 })).toBe(false);
  });

  it('a wet sheet inside its window is wet', () => {
    expect(wet()).toBe(true);
  });
});

describe('isSheetWet — the held sheet (261123-pee)', () => {
  it('reads wet past its window while held and above the threshold', () => {
    // The live Studio sheet never auto-dries: the window law is the DRY
    // default, but a held sheet stays blendable however long the artist pauses.
    expect(wet({ held: true, nowMs: 5000, wetUntilMs: 5000 })).toBe(true);
    expect(wet({ held: true, nowMs: 60_000, wetUntilMs: 5000 })).toBe(true);
  });

  it('holding never overrides the fix bake or the threshold', () => {
    // An explicit Dry still wins (fixing), and there is nothing to blend below
    // the threshold — the hold keeps water, it does not invent it.
    expect(wet({ held: true, fixing: true, wetPeak: 0.9 })).toBe(false);
    expect(wet({ held: true, wetPeak: WET_THRESHOLD })).toBe(false);
    expect(wet({ held: true, wetPeak: 0 })).toBe(false);
    expect(wet({ held: true, wetPeak: 0.005 })).toBe(true);
  });

  it('an unheld sheet keeps the window law, even explicitly not held', () => {
    expect(wet({ held: false, nowMs: 5000, wetUntilMs: 5000 })).toBe(false);
    expect(wet({ held: false, nowMs: 60_000, wetUntilMs: 5000 })).toBe(false);
    expect(wet({ held: false })).toBe(true);
  });
});
