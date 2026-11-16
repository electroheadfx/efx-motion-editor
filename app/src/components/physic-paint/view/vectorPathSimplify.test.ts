import { describe, expect, it } from 'vitest';
import {
  sampleVectorPath,
  type AquarellePoint,
  type Vec2,
} from '@efxlab/efx-watercolor/payload';
import { fitVectorPathAnchors } from './vectorPathFit';
import { VECTOR_PATH_SIMPLIFY_BUDGET_UV, simplifyVectorPathAnchors } from './vectorPathSimplify';

function sample(x: number, y: number): AquarellePoint {
  return { x, y, p: 0.5, tx: 0, ty: 0, tw: 0 };
}

/** A hand stroke: sparse, gently jittered, one broad curve. */
function handStroke(count = 24): AquarellePoint[] {
  const points: AquarellePoint[] = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const jitter = Math.sin(index * 2.3) * 0.004;
    points.push(sample(0.05 + 0.9 * t, 0.5 + 0.15 * Math.sin(t * Math.PI * 2) + jitter));
  }
  return points;
}

function distanceToSegment(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const raw = ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared;
  const t = Math.min(1, Math.max(0, raw));
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
}

function worstDeviationUv(points: readonly AquarellePoint[], path: readonly Vec2[]): number {
  let worst = 0;
  for (const point of points) {
    let closest = Number.POSITIVE_INFINITY;
    for (let index = 1; index < path.length; index += 1) {
      closest = Math.min(closest, distanceToSegment(point, path[index - 1]!, path[index]!));
    }
    worst = Math.max(worst, closest);
  }
  return worst;
}

describe('simplifyVectorPathAnchors (quick 261116-r9k)', () => {
  it('drops anchors while the curve stays within the budget of the paint', () => {
    const points = handStroke();
    const fitted = fitVectorPathAnchors(points);
    const simplified = simplifyVectorPathAnchors(fitted, points);

    expect(fitted.length).toBeGreaterThan(simplified.length);
    const { points: path } = sampleVectorPath(simplified);
    // The guarantee is measured on the CURVE, not the chords behind it.
    expect(worstDeviationUv(points, path)).toBeLessThanOrEqual(VECTOR_PATH_SIMPLIFY_BUDGET_UV);
  });

  it('keeps both endpoints and the source order', () => {
    const points = handStroke();
    const simplified = simplifyVectorPathAnchors(fitVectorPathAnchors(points), points);

    expect(simplified[0]).toMatchObject({ x: points[0]!.x, y: points[0]!.y });
    expect(simplified[simplified.length - 1]).toMatchObject({
      x: points[points.length - 1]!.x,
      y: points[points.length - 1]!.y,
    });
    const indices = simplified.map((anchor) =>
      points.findIndex((point) => point.x === anchor.x && point.y === anchor.y),
    );
    for (let index = 1; index < indices.length; index += 1) {
      expect(indices[index]).toBeGreaterThan(indices[index - 1]!);
    }
  });

  it('collapses a straight run to its two endpoints', () => {
    const points: AquarellePoint[] = [];
    for (let index = 0; index < 40; index += 1) points.push(sample(0.05 + index * 0.02, 0.5));
    const fitted = fitVectorPathAnchors(points);

    expect(simplifyVectorPathAnchors(fitted, points)).toHaveLength(2);
  });

  it('is a no-op for two anchors and never writes its inputs', () => {
    const points = [sample(0.1, 0.5), sample(0.9, 0.5)];
    const fitted = fitVectorPathAnchors(points);
    const snapshot = JSON.stringify(fitted);

    expect(simplifyVectorPathAnchors(fitted, points)).toEqual(fitted);
    simplifyVectorPathAnchors(fitted, points);
    expect(JSON.stringify(fitted)).toBe(snapshot);
  });
});
