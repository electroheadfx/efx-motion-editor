// ============================================================
//  quick-261025-awl Task 1 (D-02/D-03) — Studio-scoped module lock.
//
//  One ownership signal shared by the Studio seams and the top-bar
//  switcher: compare-then-write only, brush owns -> Water color locks,
//  watercolor owns -> Brush locks, both/none leaves both enabled.
// ============================================================

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { effect } from '@preact/signals';
import {
  brushMoveAvailable,
  clearFrameScriptOwner,
  frameScriptOwner,
  lockedModuleForOwner,
  lockedModuleTooltip,
  setFrameScriptOwner,
  type FrameScriptOwner,
} from './frameModuleLock';

beforeEach(() => {
  clearFrameScriptOwner();
});

afterEach(() => {
  clearFrameScriptOwner();
});

describe('lockedModuleForOwner', () => {
  it('locks Water color when Brush owns the frame', () => {
    expect(lockedModuleForOwner('brush')).toBe('watercolor');
  });

  it('locks Brush when Water color owns the frame', () => {
    expect(lockedModuleForOwner('watercolor')).toBe('brush');
  });

  it('locks nothing for a both-owned or empty frame', () => {
    expect(lockedModuleForOwner('both')).toBeNull();
    expect(lockedModuleForOwner(null)).toBeNull();
  });
});

describe('frameScriptOwner signal', () => {
  it('defaults to null', () => {
    expect(frameScriptOwner.value).toBeNull();
  });

  it('writes only on change (compare-then-write)', () => {
    const seen: FrameScriptOwner[] = [];
    const dispose = effect(() => {
      seen.push(frameScriptOwner.value);
    });
    try {
      setFrameScriptOwner('brush');
      setFrameScriptOwner('brush');
      setFrameScriptOwner('both');
      setFrameScriptOwner('both');
      setFrameScriptOwner(null);
      setFrameScriptOwner(null);
    } finally {
      dispose();
    }
    // One initial effect run + one run per actual value change.
    expect(seen).toEqual([null, 'brush', 'both', null]);
  });

  it('clearFrameScriptOwner restores null', () => {
    setFrameScriptOwner('watercolor');
    clearFrameScriptOwner();
    expect(frameScriptOwner.value).toBeNull();
  });
});

describe('brushMoveAvailable', () => {
  // 261027 (studio-strokes-lost-redraw): a raster key that carries BOTH the
  // live Brush capture and a leftover aquarelle registry script resolves
  // 'both'. Move must stay available there — the tracked live Brush ledger
  // holds the strokes even though the partial stored row is not hydratable.
  // The moveAvailable composite still gates the dead case (no hydratable
  // store row AND no engine-held strokes → no Move).
  it("opens for a Brush key and for the mixed 'both' state", () => {
    expect(brushMoveAvailable.value).toBe(false);
    setFrameScriptOwner('watercolor');
    expect(brushMoveAvailable.value).toBe(false);
    setFrameScriptOwner('both');
    expect(brushMoveAvailable.value).toBe(true);
    setFrameScriptOwner('brush');
    expect(brushMoveAvailable.value).toBe(true);
    clearFrameScriptOwner();
    expect(brushMoveAvailable.value).toBe(false);
  });

  it('tracks owner transitions in one effect and notifies only on a value change', () => {
    const seen: boolean[] = [];
    const dispose = effect(() => {
      seen.push(brushMoveAvailable.value);
    });
    try {
      setFrameScriptOwner('brush');
      setFrameScriptOwner('both');
      setFrameScriptOwner('watercolor');
      setFrameScriptOwner(null);
    } finally {
      dispose();
    }
    // One initial run + one per actual BOOLEAN change: brush/both stay open,
    // watercolor and none close.
    expect(seen).toEqual([false, true, false]);
  });
});

describe('lockedModuleTooltip', () => {
  it('names the Brush owner, the locked Water color slot and the Raster remedy', () => {
    const copy = lockedModuleTooltip('watercolor');
    expect(copy).toContain('Brush script');
    expect(copy).toContain('Water color is unavailable');
    expect(copy).toContain('Raster');
    expect(copy).toContain('either module can paint');
  });

  it('mirrors the copy for a locked Brush slot', () => {
    const copy = lockedModuleTooltip('brush');
    expect(copy).toContain('Water color script');
    expect(copy).toContain('Brush is unavailable');
    expect(copy).toContain('Raster');
    expect(copy).toContain('either module can paint');
  });
});
