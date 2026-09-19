/**
 * 52.2 D-18 (render-churn inventory): the three instrumented surfaces must be
 * countable from the SAME profile channel the native capture already reads —
 * `window.__EFX_PHYSICS_PAINT_PROFILE__.snapshot().counters` — and must cost
 * nothing while the `efx.physicsPaint.profile` gate is off.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PHYSICS_PAINT_RENDER_SURFACE_COUNTER_NAMES,
  countRender,
  resetRenderCounts,
  snapshotRenderCounts,
} from './renderCounters';
import {
  PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES,
  clearPhysicsPaintPerformance,
  snapshotPhysicsPaintPerformance,
} from './physicsPaintPerformanceTrace';

const PROFILE_KEY = 'efx.physicsPaint.profile';

const RENDER_COUNTER_NAMES = [
  'render.tracksStrip',
  'render.rightPanel',
  'render.canvas',
] as const;

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  storage.set(PROFILE_KEY, '1');
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
    },
  });
  clearPhysicsPaintPerformance();
});

afterEach(() => {
  clearPhysicsPaintPerformance();
  vi.unstubAllGlobals();
});

describe('Physics Paint render counters', () => {
  it('declares the three instrumented surfaces in the shared profile counter registry', () => {
    for (const name of RENDER_COUNTER_NAMES) {
      expect(PHYSICS_PAINT_PERFORMANCE_COUNTER_NAMES).toContain(name);
    }
    expect(PHYSICS_PAINT_RENDER_SURFACE_COUNTER_NAMES).toEqual({
      tracksStrip: 'render.tracksStrip',
      rightPanel: 'render.rightPanel',
      canvas: 'render.canvas',
    });
  });

  it('counts nothing while profiling is disabled, even across 100 render calls', () => {
    storage.delete(PROFILE_KEY);

    for (let index = 0; index < 100; index += 1) {
      countRender('tracksStrip');
      countRender('rightPanel');
      countRender('canvas');
    }

    expect(snapshotRenderCounts()).toEqual({
      'render.tracksStrip': 0,
      'render.rightPanel': 0,
      'render.canvas': 0,
    });
    const { counters } = snapshotPhysicsPaintPerformance();
    for (const name of RENDER_COUNTER_NAMES) {
      expect(counters[name], name).toBe(0);
    }
  });

  it('accumulates one count per rendered surface once profiling is enabled', () => {
    countRender('tracksStrip');
    countRender('tracksStrip');
    countRender('rightPanel');
    countRender('canvas');
    countRender('canvas');
    countRender('canvas');

    expect(snapshotRenderCounts()).toEqual({
      'render.tracksStrip': 2,
      'render.rightPanel': 1,
      'render.canvas': 3,
    });
  });

  it('snapshots a frozen plain object of string keys and number values', () => {
    countRender('canvas');

    const snapshot = snapshotRenderCounts();
    expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.keys(snapshot).sort()).toEqual([...RENDER_COUNTER_NAMES].sort());
    for (const [name, value] of Object.entries(snapshot)) {
      expect(typeof name, name).toBe('string');
      expect(typeof value, name).toBe('number');
      expect(Number.isFinite(value), name).toBe(true);
    }
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('surfaces the surface counters through the shared profile snapshot under their render.* names', () => {
    countRender('tracksStrip');
    countRender('tracksStrip');
    countRender('rightPanel');
    countRender('canvas');

    // The channel the native capture reads — not a registry of this module's own.
    const { counters } = snapshotPhysicsPaintPerformance();
    expect(counters['render.tracksStrip']).toBe(2);
    expect(counters['render.rightPanel']).toBe(1);
    expect(counters['render.canvas']).toBe(1);
  });

  it('resets deterministically so a before/after capture pair is comparable', () => {
    countRender('tracksStrip');
    countRender('canvas');
    const before = snapshotRenderCounts();

    resetRenderCounts();
    expect(snapshotRenderCounts()).toEqual({
      'render.tracksStrip': 0,
      'render.rightPanel': 0,
      'render.canvas': 0,
    });
    expect(snapshotPhysicsPaintPerformance().counters['render.tracksStrip']).toBe(0);

    countRender('tracksStrip');
    countRender('canvas');
    expect(snapshotRenderCounts()).toEqual(before);
  });

  it('fails closed when the profile flag cannot be read', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new DOMException('Storage read denied', 'SecurityError');
        },
      },
    });

    expect(() => countRender('tracksStrip')).not.toThrow();
    expect(snapshotRenderCounts()).toEqual({
      'render.tracksStrip': 0,
      'render.rightPanel': 0,
      'render.canvas': 0,
    });
  });
});
