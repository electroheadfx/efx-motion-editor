import { describe, expect, it } from 'vitest';
import { isSheetWet, WET_THRESHOLD } from './wetState';

const wet = (over: Partial<{ wetPeak: number; wetUntilMs: number; nowMs: number; fixing: boolean }> = {}) =>
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
