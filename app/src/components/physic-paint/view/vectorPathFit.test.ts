// ============================================================
//  62-01 — the D-05 curvature-adaptive interpolating fit.
//
//  Every anchor is ONE OF THE INPUT SAMPLES (exact x/y, source
//  order), so the evaluated path passes exactly through recorded
//  paint and an untouched anchor never moves (D-04). Long straight
//  runs carry no interior anchors, turns keep theirs, and the list
//  is capped and deterministic (D-05).
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PATH_SAMPLE_STEP_UV } from '@efxlab/efx-watercolor/payload';
import type { AquarelleAnchor, AquarellePoint } from '@efxlab/efx-watercolor/payload';
import {
  VECTOR_PATH_FIT_MAX_ANCHORS,
  VECTOR_PATH_FIT_MIN_ANCHORS,
  fitVectorPathAnchors,
} from './vectorPathFit';

function sample(x: number, y: number): AquarellePoint {
  return { x, y, p: 0.5, tx: 0, ty: 0, tw: 0 };
}

/** 400 samples on one straight run — no interior anchor may survive. */
function straightRun(count = 400): AquarellePoint[] {
  const points: AquarellePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    points.push(sample(0.05 + (index / (count - 1)) * 0.8, 0.37));
  }
  return points;
}

/**
 * Two straight arms of 200 samples each with one exact 90-degree corner:
 * horizontal to (0.5, 0.3) at index 199, then vertical up to (0.5, 0.7).
 */
function cornerRun(): AquarellePoint[] {
  const points: AquarellePoint[] = [];
  for (let index = 0; index <= 199; index += 1) {
    points.push(sample(0.1 + (index / 199) * 0.4, 0.3));
  }
  for (let index = 200; index <= 399; index += 1) {
    points.push(sample(0.5, 0.3 + ((index - 199) / 200) * 0.4));
  }
  return points;
}

/** A smooth sine stroke: curved everywhere, no straight run to speak of. */
function waveRun(count: number): AquarellePoint[] {
  const points: AquarellePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    points.push(sample(0.05 + 0.9 * t, 0.5 + 0.2 * Math.sin(t * Math.PI * 2)));
  }
  return points;
}

/** A deliberately wiggly 5 000-sample stroke — the cap's worst case. */
function noisyRun(count: number): AquarellePoint[] {
  const points: AquarellePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    points.push(
      sample(
        0.05 + 0.9 * t,
        0.5 + 0.12 * Math.sin(t * Math.PI * 6) + 0.03 * Math.sin(t * Math.PI * 74),
      ),
    );
  }
  return points;
}

/** The index of the input sample an anchor sits on, or -1. */
function sampleIndex(points: readonly AquarellePoint[], anchor: AquarelleAnchor): number {
  return points.findIndex((point) => point.x === anchor.x && point.y === anchor.y);
}

describe('62-01 the curvature-adaptive interpolating fit', () => {
  it('fits a long straight run to exactly its two endpoints', () => {
    const points = straightRun(400);
    const anchors = fitVectorPathAnchors(points);

    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toEqual({ x: points[0]!.x, y: points[0]!.y, kind: 'auto' });
    expect(anchors[1]).toEqual({
      x: points[points.length - 1]!.x,
      y: points[points.length - 1]!.y,
      kind: 'auto',
    });
  });

  it('keeps the turn anchor at a 90-degree corner and leaves both arms bare', () => {
    const points = cornerRun();
    const anchors = fitVectorPathAnchors(points);
    const indices = anchors.map((anchor) => sampleIndex(points, anchor));

    // Both arms are straight, so every interior anchor must belong to the turn.
    expect(anchors.length).toBeGreaterThanOrEqual(3);
    expect(anchors.length).toBeLessThanOrEqual(4);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(points.length - 1);
    const interior = indices.slice(1, -1);
    expect(interior.length).toBeGreaterThan(0);
    for (const index of interior) expect(Math.abs(index - 199)).toBeLessThanOrEqual(1);
  });

  it('emits only original samples, in source order, with no extra anchor data', () => {
    const points = waveRun(300);
    const anchors = fitVectorPathAnchors(points);
    expect(anchors.length).toBeGreaterThanOrEqual(VECTOR_PATH_FIT_MIN_ANCHORS);
    expect(anchors.length).toBeLessThanOrEqual(VECTOR_PATH_FIT_MAX_ANCHORS);

    let previous = -1;
    for (const anchor of anchors) {
      expect(Object.keys(anchor).sort()).toEqual(['kind', 'x', 'y']);
      expect(anchor.kind).toBe('auto');
      const index = sampleIndex(points, anchor);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  });

  it('caps a 5 000-sample noisy stroke at 40 anchors and stays deterministic', () => {
    const points = noisyRun(5000);
    const first = fitVectorPathAnchors(points);
    const second = fitVectorPathAnchors(points);

    expect(first.length).toBeGreaterThanOrEqual(VECTOR_PATH_FIT_MIN_ANCHORS);
    expect(first.length).toBeLessThanOrEqual(VECTOR_PATH_FIT_MAX_ANCHORS);
    expect(second).toEqual(first);
    let previous = -1;
    for (const anchor of first) {
      const index = sampleIndex(points, anchor);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  });

  it('reports the floor honestly: two distinct samples in, both out', () => {
    const two = [sample(0.2, 0.2), sample(0.7, 0.6)];
    expect(fitVectorPathAnchors(two)).toEqual([
      { x: 0.2, y: 0.2, kind: 'auto' },
      { x: 0.7, y: 0.6, kind: 'auto' },
    ]);
  });

  it('returns an empty list when there is nothing distinct and finite to fit', () => {
    expect(fitVectorPathAnchors([])).toEqual([]);
    expect(fitVectorPathAnchors([sample(0.4, 0.4), sample(0.4, 0.4)])).toEqual([]);
    expect(
      fitVectorPathAnchors([sample(Number.NaN, 0.4), sample(0.4, Number.POSITIVE_INFINITY)]),
    ).toEqual([]);
  });

  it('does not move the anchors outside a local deviation', () => {
    const points = cornerRun();
    const bumped = points.map((point, index) =>
      index === 300 ? { ...point, x: point.x + 0.006 } : point,
    );
    const base = fitVectorPathAnchors(points);
    const local = fitVectorPathAnchors(bumped);

    // The deviation exceeds the tolerance, so the fit MUST carry it.
    expect(
      local.some((anchor) => anchor.x === bumped[300]!.x && anchor.y === bumped[300]!.y),
    ).toBe(true);
    // The other arm and the far endpoint do not move — not by one anchor.
    const onHorizontalArm = (fit: readonly AquarelleAnchor[]) =>
      fit.filter((anchor) => anchor.y === 0.3);
    expect(onHorizontalArm(local)).toEqual(onHorizontalArm(base));
    expect(local[local.length - 1]).toEqual(base[base.length - 1]);
  });

  it('never writes its input', () => {
    const points = waveRun(120);
    const snapshot = JSON.stringify(points);
    const frozen = points.map((point) => Object.freeze({ ...point }));
    Object.freeze(frozen);

    expect(() => fitVectorPathAnchors(frozen)).not.toThrow();
    expect(JSON.stringify(points)).toBe(snapshot);
  });

  it('exports the D-05 option defaults and states the tolerance against the sampler', async () => {
    const module = (await import('./vectorPathFit')) as unknown as Record<string, unknown>;
    const tolerance = module.VECTOR_PATH_FIT_TOLERANCE_UV;
    const threshold = module.VECTOR_PATH_FIT_TURN_THRESHOLD_RAD;

    expect(typeof tolerance).toBe('number');
    expect(tolerance as number).toBeGreaterThan(0);
    // Never coarser than the sampler's own step, or recorded paint would be lost.
    expect(tolerance as number).toBeLessThanOrEqual(PATH_SAMPLE_STEP_UV);
    expect(typeof threshold).toBe('number');
    expect(threshold as number).toBeGreaterThan(0);
    expect(threshold as number).toBeLessThan(Math.PI);
    expect(VECTOR_PATH_FIT_MAX_ANCHORS).toBe(40);
    expect(VECTOR_PATH_FIT_MIN_ANCHORS).toBe(2);
  });

  it('imports nothing but types — no Preact, no DOM, no store, no RNG', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./vectorPathFit.ts', import.meta.url)),
      'utf8',
    );
    const importLines = source.split('\n').filter((line) => line.startsWith('import '));
    expect(importLines.length).toBeGreaterThan(0);
    for (const line of importLines) expect(line.startsWith('import type ')).toBe(true);
  });
});
