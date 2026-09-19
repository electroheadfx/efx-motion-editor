import { describe, expect, it } from 'vitest';
import {
  PAINT_WINDOW_WATCHDOG_ACTIVITY_WINDOW_MS,
  PAINT_WINDOW_WATCHDOG_RAF_STALL_MS,
  PAINT_WINDOW_WATCHDOG_RELOAD_COOLDOWN_MS,
  shouldReloadPaintWindow,
} from './paintWindowWatchdog';

const base = {
  now: 100_000,
  lastActivityAt: 100_000 - 1_000, // active 1s ago
  lastRafTick: 100_000 - 10_000, // rAF stalled 10s
  lastReloadAt: 0, // no prior reload
  hasFocus: true,
};

describe('shouldReloadPaintWindow', () => {
  it('reloads when focused, active, rAF stalled past 5s, and past the cooldown', () => {
    expect(shouldReloadPaintWindow(base)).toBe(true);
  });

  it('never reloads while the window is out of focus — rAF is paused for occluded windows by design', () => {
    expect(shouldReloadPaintWindow({ ...base, hasFocus: false })).toBe(false);
  });

  it('does not reload while the user is idle (no activity within 3s)', () => {
    expect(shouldReloadPaintWindow({ ...base, lastActivityAt: 100_000 - 4_000 })).toBe(false);
  });

  it('does not reload while rAF is still ticking (compositor alive)', () => {
    expect(shouldReloadPaintWindow({ ...base, lastRafTick: 100_000 - 1_000 })).toBe(false);
  });

  it('respects the 15s reload cooldown', () => {
    expect(shouldReloadPaintWindow({ ...base, lastReloadAt: 100_000 - 10_000 })).toBe(false);
    expect(shouldReloadPaintWindow({ ...base, lastReloadAt: 100_000 - 20_000 })).toBe(true);
  });

  it('pins the exact thresholds', () => {
    expect(PAINT_WINDOW_WATCHDOG_ACTIVITY_WINDOW_MS).toBe(3000);
    expect(PAINT_WINDOW_WATCHDOG_RAF_STALL_MS).toBe(5000);
    expect(PAINT_WINDOW_WATCHDOG_RELOAD_COOLDOWN_MS).toBe(15000);
  });
});
