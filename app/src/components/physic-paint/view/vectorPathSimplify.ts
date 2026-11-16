import {
  sampleVectorPath,
  type AquarelleAnchor,
  type AquarellePoint,
  type Vec2,
} from '@efxlab/efx-watercolor/payload';

/**
 * How far the SIMPLIFIED path may stray from the paint, in document uv.
 *
 * Measured: on a 24-sample hand stroke the fit mints 18 anchors and this budget
 * simplifies them to 11. 0.006 uv is 0.6% of a document unit — under the
 * painted stroke's own width — so the path reads as the same shape with fewer
 * vertices to edit. Raising it to 0.008 buys 9 anchors at a visible cost on
 * tight corners; lowering it to the fit's own 0.002 frees nothing at all.
 *
 * This is a CURVE budget, not the fit's chord tolerance: every candidate
 * removal is evaluated as a spline and measured against every recorded sample.
 */
export const VECTOR_PATH_SIMPLIFY_BUDGET_UV = 0.006;

/** Point-to-segment distance, in document uv. */
function distanceToSegment(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 0) return Math.hypot(point.x - from.x, point.y - from.y);
  const raw = ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared;
  const t = Math.min(1, Math.max(0, raw));
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
}

/** Distance from one sample to the evaluated polyline. */
function distanceToPath(point: Vec2, path: readonly Vec2[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return Math.hypot(point.x - path[0]!.x, point.y - path[0]!.y);
  let closest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    const distance = distanceToSegment(point, path[index - 1]!, path[index]!);
    if (distance < closest) closest = distance;
  }
  return closest;
}

/**
 * Does the candidate path stray beyond `budget` from ANY recorded sample?
 *
 * EVERY sample is checked, not just the removed anchor's neighbours: an `auto`
 * anchor derives its handles from the anchors either side of it, so dropping
 * one re-shapes the two segments that touched it and moves the tangent of the
 * anchors one step further out. A span-local check would accept a removal whose
 * damage lands outside the span it looked at.
 */
function exceedsBudget(
  candidate: readonly AquarelleAnchor[],
  samples: readonly AquarellePoint[],
  budget: number,
): boolean {
  const { points } = sampleVectorPath(candidate);
  if (points.length === 0) return true;
  for (const sample of samples) {
    if (distanceToPath(sample, points) > budget) return true;
  }
  return false;
}

/**
 * Drop anchors the path does not need, while keeping it within `budget` of the
 * recorded paint (quick 261116-r9k).
 *
 * `fitVectorPathAnchors` keeps an anchor at every sample that deviates from the
 * chord behind it, which on a hand stroke is nearly all of them — the user
 * converts a stroke and gets a path they can barely edit. This pass is the
 * other direction: it removes an interior anchor whenever the SPLINE through
 * the remaining anchors still passes within `budget` of every recorded sample
 * in the affected span, and repeats until no single removal is free.
 *
 * Endpoints are never removed and the source order is preserved, so the
 * evaluated path still starts and ends exactly where the paint does. A removal
 * is measured against the recorded samples, never against the previous fit, so
 * the fidelity guarantee is absolute rather than compounding.
 */
export function simplifyVectorPathAnchors(
  anchors: readonly AquarelleAnchor[],
  samples: readonly AquarellePoint[],
  budget: number = VECTOR_PATH_SIMPLIFY_BUDGET_UV,
): readonly AquarelleAnchor[] {
  if (anchors.length <= 2 || samples.length < 2) return anchors;
  const limit = Number.isFinite(budget) && budget > 0 ? budget : VECTOR_PATH_SIMPLIFY_BUDGET_UV;

  let current: readonly AquarelleAnchor[] = anchors;
  let simplified = true;
  // Every accepted removal shrinks the list by one, so the outer walk is bounded
  // by the anchor count even if a span keeps re-qualifying.
  let guard = anchors.length + 1;
  while (simplified && current.length > 2 && guard > 0) {
    guard -= 1;
    simplified = false;
    for (let index = 1; index < current.length - 1; index += 1) {
      const candidate = [...current.slice(0, index), ...current.slice(index + 1)];
      if (!exceedsBudget(candidate, samples, limit)) {
        current = candidate;
        simplified = true;
        break;
      }
    }
  }
  return Object.freeze([...current]);
}
