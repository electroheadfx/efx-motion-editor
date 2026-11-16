import { describe, expect, it } from 'vitest';
import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';
import type { AquarelleAnchor, AquarelleStrokePayload } from '@efxlab/efx-watercolor/payload';
import { withAquarelleReplayGrid } from './aquarelleReplayGrid';

const SENTINEL = -1;

function point(x: number, y: number, p: number, tick: number): StudioPoint {
  return { x, y, p, tx: 0, ty: 0, tw: 0, tick };
}

function stroke(
  pts: readonly StudioPoint[],
  anchors?: readonly AquarelleAnchor[],
): StudioStroke<AquarelleStrokePayload> {
  return {
    pts,
    ticks: Math.max(1, pts.length - 1),
    cuisson: 0,
    motion: null,
    brushId: 'default',
    toolOverrides: {},
    traceSeed: 0,
    recordedOrder: 1000,
    playFrame: null,
    color: '#103c65',
    engine: {
      tool: 'brush',
      color: '#103c65',
      params: {},
      brushId: 'default',
      timestamp: 1000,
      ...(anchors === undefined ? {} : { anchors }),
    },
  };
}

/** One hump: the chord midpoint sits at y=0, the curve's at y≈0.45. */
const HUMP: readonly AquarelleAnchor[] = [
  { x: 0, y: 0, kind: 'bezier', in: { x: 0, y: 0 }, out: { x: 0.3, y: 0.6 } },
  { x: 1, y: 0, kind: 'bezier', in: { x: 0.7, y: 0.6 }, out: { x: 1, y: 0 } },
];

describe('withAquarelleReplayGrid (quick 261116-r9k)', () => {
  it('leaves a hand-painted stroke byte-identical (no anchors, no re-gridding)', () => {
    const source = stroke([point(0, 0, 0.2, 0), point(0.5, 0.4, 0.5, 1), point(1, 0, 0.9, 2)]);
    const derived = withAquarelleReplayGrid(source);

    expect(derived.pts).toEqual(source.pts);
    expect(derived.ticks).toBe(source.ticks);
    expect(derived.pts).not.toBe(source.pts);
  });

  it('re-stations a converted stroke along the CURVE, not the anchor chord', () => {
    const source = stroke([point(0, 0, 0.4, 0), point(0.5, 0, 0.4, 1), point(1, 0, 0.4, 2)], HUMP);
    const derived = withAquarelleReplayGrid(source);

    expect(derived.pts.length).toBeGreaterThan(source.pts.length);
    // The old grid ran along y=0. The paint must now ride the hump.
    const peak = Math.max(...derived.pts.map((p) => p.y));
    expect(peak).toBeGreaterThan(0.3);
    expect(derived.pts[0]).toMatchObject({ x: 0, y: 0 });
    expect(derived.pts[derived.pts.length - 1]!.x).toBeCloseTo(1, 9);
    expect(derived.pts[derived.pts.length - 1]!.y).toBeCloseTo(0, 9);
  });

  it('keeps the segments no wider than the paint cadence can produce', () => {
    const source = stroke([point(0, 0, 0.4, 0), point(1, 0, 0.4, 1)], HUMP);
    const derived = withAquarelleReplayGrid(source);

    for (let index = 1; index < derived.pts.length; index += 1) {
      const previous = derived.pts[index - 1]!;
      const current = derived.pts[index]!;
      expect(Math.hypot(current.x - previous.x, current.y - previous.y)).toBeLessThanOrEqual(0.08 + 1e-9);
    }
  });

  it('remaps the recorded pressure by arc fraction, both ends pinned', () => {
    const source = stroke([point(0, 0, 0.2, 0), point(0.5, 0, 0.5, 1), point(1, 0, 0.9, 2)], HUMP);
    const derived = withAquarelleReplayGrid(source);

    expect(derived.pts[0]!.p).toBe(0.2);
    expect(derived.pts[derived.pts.length - 1]!.p).toBe(0.9);
    const middle = derived.pts[Math.floor((derived.pts.length - 1) / 2)]!;
    expect(middle.p).toBeGreaterThan(0.2);
    expect(middle.p).toBeLessThan(0.9);
  });

  it('keeps an all-sentinel stroke all-sentinel', () => {
    const source = stroke(
      [point(0, 0, SENTINEL, 0), point(0.5, 0, SENTINEL, 1), point(1, 0, SENTINEL, 2)],
      HUMP,
    );
    const derived = withAquarelleReplayGrid(source);

    expect(derived.pts.every((p) => p.p === SENTINEL)).toBe(true);
  });

  it('lets the derived grid own the tick span (it IS the wet lifetime)', () => {
    const source = stroke([point(0, 0, 0.4, 0), point(1, 0, 0.4, 1)], HUMP);
    const derived = withAquarelleReplayGrid(source);

    expect(derived.ticks).toBe(Math.max(1, derived.pts.length - 1));
    derived.pts.forEach((p, index) => expect(p.tick).toBe(index));
  });

  it('never mutates the document samples', () => {
    const source = stroke([point(0, 0, 0.4, 0), point(1, 0, 0.4, 1)], HUMP);
    const before = JSON.stringify(source.pts);
    withAquarelleReplayGrid(source);
    expect(JSON.stringify(source.pts)).toBe(before);
  });
});
