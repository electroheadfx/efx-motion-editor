/**
 * Rail-motion pivot pins (Phase 59-08, D-17, Gate D).
 *
 * The pivot is the union centre of the rail's drawing-key ink, measured ONCE
 * per rail revision and memoized. These tests use an injected measurer (the
 * module performs no canvas access), so the whole contract is verifiable in a
 * node environment.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetRailMotionPivotMemoForTests,
  computeRailInkBounds,
  RAIL_MOTION_PIVOT_FALLBACK,
  resolveRailMotionKeyInkBounds,
  resolveRailMotionPivot,
  unionRailInkBoxes,
} from './railMotionPivot';
import type { RailMotionInkSource, RailMotionMeasuredInk } from './railMotionPivot';

const root = resolve(__dirname, '../../../../');

function inkBox(
  x: number,
  y: number,
  width: number,
  height: number,
  alphaInk = true,
): RailMotionMeasuredInk {
  return { x, y, width, height, alphaInk };
}

/** 261107-tfp: a rail source now carries the key identity beside the raster. */
function keyed(keyId: string, source = keyId): RailMotionInkSource<string> {
  return { keyId, source };
}

beforeEach(() => {
  __resetRailMotionPivotMemoForTests();
});

describe('computeRailInkBounds', () => {
  it('returns the raster-centre fallback for an empty list', () => {
    expect(computeRailInkBounds([])).toEqual(RAIL_MOTION_PIVOT_FALLBACK);
    expect(computeRailInkBounds([])).toEqual({ x: 0.5, y: 0.5 });
  });

  it('unions two boxes and returns the centre of the union', () => {
    const centre = computeRailInkBounds([
      inkBox(0.1, 0.2, 0.2, 0.1),
      inkBox(0.5, 0.6, 0.2, 0.3),
    ]);
    // Union spans x 0.1..0.7, y 0.2..0.9 -> centre 0.4 / 0.55.
    expect(centre.x).toBeCloseTo(0.4, 12);
    expect(centre.y).toBeCloseTo(0.55, 12);
  });

  it('ignores degenerate and non-finite boxes', () => {
    expect(
      computeRailInkBounds([
        inkBox(0.1, 0.1, 0, 0.2),
        inkBox(Number.NaN, 0.2, 0.2, 0.2),
        inkBox(0.2, 0.2, 0.4, 0.4),
      ]),
    ).toEqual({ x: 0.4, y: 0.4 });
  });

  it('clamps the centre into 0..1', () => {
    expect(computeRailInkBounds([inkBox(-0.5, -0.5, 0.2, 0.2)])).toEqual({ x: 0, y: 0 });
    expect(computeRailInkBounds([inkBox(1.2, 1.2, 0.4, 0.4)])).toEqual({ x: 1, y: 1 });
  });
});

describe('resolveRailMotionPivot', () => {
  it('measures each source exactly once and returns zero measures on a memo hit', () => {
    const measure = vi.fn((_source: string) => inkBox(0, 0, 0.5, 0.5));
    const input = {
      railId: 'rail-1',
      contentRevision: 'rev-1',
      sources: [keyed('key-a'), keyed('key-b'), keyed('key-c')],
      measure,
    };

    const first = resolveRailMotionPivot(input);
    expect(measure).toHaveBeenCalledTimes(3);
    expect(first).toEqual({ pivotX: 0.25, pivotY: 0.25, measured: true });

    const second = resolveRailMotionPivot(input);
    expect(measure).toHaveBeenCalledTimes(3);
    expect(second).toBe(first);
  });

  it('contributes no bounds for a key whose alpha scan finds no ink', () => {
    const measure = vi.fn((source: string) =>
      source === 'blank' ? inkBox(0, 0, 1, 1, false) : inkBox(0.4, 0.4, 0.2, 0.2),
    );
    const pivot = resolveRailMotionPivot({
      railId: 'rail-ink',
      contentRevision: 'rev-1',
      sources: [keyed('blank'), keyed('inked')],
      measure,
    });
    // A full-frame box from the ink-less key would have pulled the centre to
    // the raster centre; the union of the one inked key is 0.5/0.5 by itself.
    expect(pivot).toEqual({ pivotX: 0.5, pivotY: 0.5, measured: true });

    const blankOnly = resolveRailMotionPivot({
      railId: 'rail-blank',
      contentRevision: 'rev-1',
      sources: [keyed('blank')],
      measure,
    });
    expect(blankOnly).toEqual({ pivotX: 0.5, pivotY: 0.5, measured: false });
  });

  it('uses the fallback (measured: false) for no sources or an unavailable decode', () => {
    const noSources = resolveRailMotionPivot({
      railId: 'rail-empty',
      contentRevision: 'rev-1',
      sources: [],
      measure: vi.fn(),
    });
    expect(noSources).toEqual({ pivotX: 0.5, pivotY: 0.5, measured: false });

    const undecodable = resolveRailMotionPivot({
      railId: 'rail-null',
      contentRevision: 'rev-1',
      sources: [keyed('key-a')],
      measure: () => null,
    });
    expect(undecodable).toEqual({ pivotX: 0.5, pivotY: 0.5, measured: false });
  });

  it('re-measures when the content revision changes', () => {
    const measure = vi.fn((_source: string) => inkBox(0.2, 0.2, 0.2, 0.2));
    const base = {
      railId: 'rail-rev',
      sources: [keyed('key-a'), keyed('key-b')],
      measure,
    };
    resolveRailMotionPivot({ ...base, contentRevision: 'rev-1' });
    expect(measure).toHaveBeenCalledTimes(2);
    resolveRailMotionPivot({ ...base, contentRevision: 'rev-2' });
    expect(measure).toHaveBeenCalledTimes(4);
  });

  it('does not re-measure when only the evaluated frame changes', () => {
    const measure = vi.fn((_source: string) => inkBox(0.2, 0.2, 0.2, 0.2));
    const base = {
      railId: 'rail-frame',
      contentRevision: 'rev-1',
      sources: [keyed('key-a')],
      measure,
    };
    // The pivot API carries no frame at all: resolving "for frame 0" and again
    // "for frame 48" is the same call.
    resolveRailMotionPivot(base);
    resolveRailMotionPivot(base);
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it('is independent of the evaluated transform values', () => {
    const measure = vi.fn((_source: string) => inkBox(0.1, 0.3, 0.2, 0.2));
    const base = {
      railId: 'rail-transform',
      contentRevision: 'rev-1',
      sources: [keyed('key-a')],
      measure,
    };
    const pivot = resolveRailMotionPivot(base);
    // Nothing in the module's input names translate/rotate/scale/opacity.
    expect(Object.keys(base).sort()).toEqual([
      'contentRevision',
      'measure',
      'railId',
      'sources',
    ]);
    expect(pivot).toEqual({ pivotX: 0.2, pivotY: 0.4, measured: true });
  });

  it('stays pure: no store, DOM or evaluator import', () => {
    const source = readFileSync(resolve(root, 'src/components/physic-paint/roto/railMotionPivot.ts'), 'utf8');
    expect(source).not.toContain('physicPaintStore');
    expect(source).not.toContain('document.createElement');
    expect(source).not.toContain('evaluateRailMotion');
    expect(source).not.toContain('getImageData');
  });
});

/**
 * 261107-tfp: the per-key ink boxes the canvas boundary box consumes. The
 * union helper only shrinks (never clamps to 0..1 — the pivot helper keeps its
 * own clamp), and the boxes map is served from the SAME memo entry as the
 * pivot, so sizing the gizmo adds no second alpha scan.
 */
describe('unionRailInkBoxes', () => {
  it('returns null for an empty list', () => {
    expect(unionRailInkBoxes([])).toBeNull();
  });

  it('unions two boxes and never clamps the result to 0..1', () => {
    const union = unionRailInkBoxes([
      { x: -0.25, y: 0.125, width: 0.5, height: 0.25 },
      { x: 0.75, y: 0.5, width: 0.5, height: 0.25 },
    ]);
    // x -0.25..1.25, y 0.125..0.75 — both bounds deliberately cross 0/1.
    expect(union).toEqual({ x: -0.25, y: 0.125, width: 1.5, height: 0.625 });
    expect(Object.isFrozen(union)).toBe(true);
  });

  it('ignores non-finite and degenerate boxes', () => {
    expect(unionRailInkBoxes([
      { x: Number.NaN, y: 0.1, width: 0.2, height: 0.2 },
      { x: 0.1, y: 0.1, width: 0, height: 0.3 },
      { x: 0.2, y: 0.3, width: -0.1, height: 0.1 },
      { x: 0.4, y: 0.5, width: 0.125, height: 0.125 },
    ])).toEqual({ x: 0.4, y: 0.5, width: 0.125, height: 0.125 });
  });

  it('returns null when every box is unusable', () => {
    expect(unionRailInkBoxes([
      { x: 0, y: 0, width: 0, height: 0 },
      { x: Number.POSITIVE_INFINITY, y: 0, width: 0.2, height: 0.2 },
    ])).toBeNull();
  });
});

describe('resolveRailMotionKeyInkBounds', () => {
  it('returns only the keys whose scan found ink', () => {
    const measure = vi.fn((source: string) => {
      if (source === 'blank') return inkBox(0, 0, 1, 1, false);
      if (source === 'undecoded') return null;
      return inkBox(0.1, 0.2, 0.3, 0.4);
    });
    const boxes = resolveRailMotionKeyInkBounds({
      railId: 'rail-boxes',
      contentRevision: 'rev-1',
      sources: [keyed('inked'), keyed('blank'), keyed('undecoded')],
      measure,
    });

    expect([...boxes.keys()]).toEqual(['inked']);
    expect(boxes.get('inked')).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
    expect(boxes.has('blank')).toBe(false);
    expect(boxes.has('undecoded')).toBe(false);
    expect(Object.isFrozen(boxes.get('inked'))).toBe(true);
  });

  it('shares ONE memo entry with the pivot: the second view measures nothing extra', () => {
    const measure = vi.fn((_source: string) => inkBox(0.1, 0.1, 0.2, 0.2));
    const input = {
      railId: 'rail-shared-memo',
      contentRevision: 'rev-1',
      sources: [keyed('key-a'), keyed('key-b')],
      measure,
    };

    const pivot = resolveRailMotionPivot(input);
    expect(measure).toHaveBeenCalledTimes(2);

    const boxes = resolveRailMotionKeyInkBounds(input);
    expect(measure).toHaveBeenCalledTimes(2);
    expect([...boxes.keys()].sort()).toEqual(['key-a', 'key-b']);

    // Memo identity holds for both views of the cache entry.
    expect(resolveRailMotionPivot(input)).toBe(pivot);
    expect(resolveRailMotionKeyInkBounds(input)).toBe(boxes);

    resolveRailMotionPivot({ ...input, contentRevision: 'rev-2' });
    expect(measure).toHaveBeenCalledTimes(4);
  });
});

/**
 * Gate D (measured, not asserted by intuition): the one-time pivot cost over a
 * 24-key 1920px rail, and the memo-hit cost. The alpha scan is simulated over
 * the SAME bounded grid the production measurer uses (256px long edge), so the
 * numbers cover the real scan component; decode is excluded because the
 * production measurer draws an already-decoded registry raster.
 */
describe('Gate D — pivot resolution cost (24 keys, 1920px long edge)', () => {
  const KEY_COUNT = 24;
  const SOURCE_LONG_EDGE = 1920;
  const SCAN_LONG_EDGE = 256;
  const scanWidth = SCAN_LONG_EDGE;
  const scanHeight = Math.round((SCAN_LONG_EDGE * 1080) / 1920);
  const alpha = new Uint8ClampedArray(scanWidth * scanHeight * 4);

  // Two inked discs per key, deterministic — the scan work is the measured part.
  for (let y = 0; y < scanHeight; y += 1) {
    for (let x = 0; x < scanWidth; x += 1) {
      const index = (y * scanWidth + x) * 4 + 3;
      const inDisc = (cx: number, cy: number) =>
        (x - cx) * (x - cx) + (y - cy) * (y - cy) < 900;
      alpha[index] = inDisc(60, 40) || inDisc(190, 110) ? 255 : 0;
    }
  }

  function measureScanGrid(): RailMotionMeasuredInk {
    let minX = scanWidth;
    let minY = scanHeight;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < scanHeight; y += 1) {
      for (let x = 0; x < scanWidth; x += 1) {
        if (alpha[(y * scanWidth + x) * 4 + 3] === 0) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return { x: 0, y: 0, width: 0, height: 0, alphaInk: false };
    return {
      x: minX / scanWidth,
      y: minY / scanHeight,
      width: (maxX - minX + 1) / scanWidth,
      height: (maxY - minY + 1) / scanHeight,
      alphaInk: true,
    };
  }

  it('records the first-resolution and memo-hit timings', () => {
    const sources = Array.from({ length: KEY_COUNT }, (_, index) => keyed(String(index)));
    const input = {
      railId: 'gate-d-rail',
      contentRevision: 'gate-d-rev',
      sources,
      measure: () => measureScanGrid(),
    };

    const firstStartedAt = performance.now();
    const first = resolveRailMotionPivot(input);
    const firstMs = performance.now() - firstStartedAt;

    const hitStartedAt = performance.now();
    const hit = resolveRailMotionPivot(input);
    const hitMs = performance.now() - hitStartedAt;

    expect(first.measured).toBe(true);
    expect(hit).toBe(first);
    expect(hitMs).toBeLessThan(firstMs);

    // eslint-disable-next-line no-console
    console.log(
      `GATE_D_PIVOT_FIRST_MS=${firstMs.toFixed(3)}`
      + ` GATE_D_PIVOT_HIT_MS=${hitMs.toFixed(4)}`
      + ` GATE_D_KEYS=${KEY_COUNT}`
      + ` GATE_D_SOURCE_LONG_EDGE=${SOURCE_LONG_EDGE}`
      + ` GATE_D_SCAN_GRID=${scanWidth}x${scanHeight}`,
    );
  });
});
