// ============================================================
//  quick-261025-awl Task 1 (D-02/D-03) — Studio-scoped module lock.
//
//  One ownership signal shared by the Studio seams and the top-bar
//  switcher: compare-then-write only.
//
//  261027-klx: @efxlab/efx-watercolor is the only paint engine, so the
//  owner union collapses to Water color or none and NO owner locks any
//  slot. brushMoveAvailable is retyped onto the single-engine owner.
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

describe('lockedModuleForOwner in the single-engine world', () => {
  it('locks nothing for any owner', () => {
    for (const owner of ['watercolor', null] as FrameScriptOwner[]) {
      expect(lockedModuleForOwner(owner), `owner ${String(owner)}`).toBeNull();
    }
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
      setFrameScriptOwner('watercolor');
      setFrameScriptOwner('watercolor');
      setFrameScriptOwner(null);
      setFrameScriptOwner(null);
    } finally {
      dispose();
    }
    // One initial effect run + one run per actual value change.
    expect(seen).toEqual([null, 'watercolor', null]);
  });

  it('clearFrameScriptOwner restores null', () => {
    setFrameScriptOwner('watercolor');
    clearFrameScriptOwner();
    expect(frameScriptOwner.value).toBeNull();
  });
});

describe('brushMoveAvailable', () => {
  it('opens only while the frame is owned by Water color', () => {
    expect(brushMoveAvailable.value).toBe(false);
    setFrameScriptOwner('watercolor');
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
      setFrameScriptOwner('watercolor');
      setFrameScriptOwner(null);
    } finally {
      dispose();
    }
    // One initial run + one per actual BOOLEAN change.
    expect(seen).toEqual([false, true, false]);
  });
});

describe('lockedModuleTooltip', () => {
  it('names the lock and the Raster remedy', () => {
    const copy = lockedModuleTooltip('watercolor');
    expect(copy).toContain('script from another module');
    expect(copy).toContain('Water color is unavailable');
    expect(copy).toContain('Raster');
    expect(copy).toContain('key can paint');
  });
});
