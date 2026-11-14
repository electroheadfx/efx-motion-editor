// ============================================================
//  vectorPathFit — the pure interpolating fit that turns a
//  painted stroke's recorded samples into `auto` anchors (62-01).
//
//  PURITY: type-only imports, no Preact, no DOM, no engine, no
//  document store, no RNG.
//
//  INTERPOLATING, NOT APPROXIMATING (D-04): every anchor returned
//  here is ONE OF THE INPUT SAMPLES (exact x/y, source order), so
//  the evaluated path passes exactly through recorded paint and an
//  anchor outside the edited span never moves. The least-squares
//  `fit-curve` family is a reference only — it is never used.
//
//  CURVATURE-ADAPTIVE (D-05): long straight runs carry no interior
//  anchors, corners keep theirs, and the list never exceeds the
//  cap. The law is sanitise (finite only, drop consecutive
//  duplicates), Douglas-Peucker on the ORIGINAL polyline, a turn
//  pass that guarantees a retained vertex at every cumulative turn
//  above the threshold, a floor that keeps at least the endpoints,
//  then the cap (tolerance doubling in a bounded loop, index
//  decimation only as the last resort).
//
//  DETERMINISTIC: identical input yields identical output. No
//  randomness, no clocks, no locale-dependent arithmetic; every
//  pass is bounded and every tie breaks toward the lower index.
// ============================================================
import type { AquarelleAnchor, AquarellePoint } from '@efxlab/efx-watercolor/payload';

/** Hard ceiling on anchors per stroke (D-05). */
export const VECTOR_PATH_FIT_MAX_ANCHORS = 40;

/** Below two distinct samples there is no path to fit — the caller refuses. */
export const VECTOR_PATH_FIT_MIN_ANCHORS = 2;

/**
 * Douglas-Peucker deviation budget in document uv. Matches
 * `PATH_SAMPLE_STEP_UV` (the sampler's step) — never coarser, or a
 * recorded sample could be lost between two chords.
 */
export const VECTOR_PATH_FIT_TOLERANCE_UV = 0.002;

/** Cumulative direction change (radians) that always earns an anchor. */
export const VECTOR_PATH_FIT_TURN_THRESHOLD_RAD = Math.PI / 4;

/** Consecutive samples closer than this (document uv) are one sample. */
const FIT_DUPLICATE_EPSILON_UV = 1e-6;

/** Bounded tolerance doubling before the cap falls back to index decimation. */
const FIT_TOLERANCE_DOUBLINGS = 8;

export interface VectorPathFitOptions {
  /** Optional cap override; clamped to a finite integer of at least the floor. */
  readonly maxAnchors?: number;
}

function resolveMaxAnchors(options?: VectorPathFitOptions): number {
  const raw = options?.maxAnchors;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return VECTOR_PATH_FIT_MAX_ANCHORS;
  return Math.max(VECTOR_PATH_FIT_MIN_ANCHORS, Math.trunc(raw));
}

/**
 * Finite samples only, with consecutive duplicates collapsed. The input is
 * never written: the returned list is a fresh array of fresh objects. A
 * malformed entry (non-finite coordinate, non-object) is dropped — the
 * caller refuses the whole conversion when too little survives (T-62-01).
 */
function sanitiseSamples(points: readonly AquarellePoint[]): readonly AquarellePoint[] {
  if (!Array.isArray(points)) return [];
  const kept: AquarellePoint[] = [];
  for (const sample of points) {
    if (typeof sample !== 'object' || sample === null) continue;
    const { x, y } = sample as { readonly x?: unknown; readonly y?: unknown };
    if (typeof x !== 'number' || !Number.isFinite(x)) continue;
    if (typeof y !== 'number' || !Number.isFinite(y)) continue;
    const previous = kept[kept.length - 1];
    if (
      previous !== undefined
      && Math.abs(previous.x - x) <= FIT_DUPLICATE_EPSILON_UV
      && Math.abs(previous.y - y) <= FIT_DUPLICATE_EPSILON_UV
    ) {
      continue;
    }
    kept.push({ ...sample, x, y });
  }
  return kept;
}

/**
 * Douglas-Peucker over the ORIGINAL samples, keeping indices. Iterative (an
 * explicit stack) so a pathological 5 000-sample wiggle cannot exhaust the
 * call stack; a tie on the maximum distance keeps the LOWER index, which is
 * what makes the output deterministic.
 */
function douglasPeucker(
  samples: readonly AquarellePoint[],
  tolerance: number,
): Set<number> {
  const last = samples.length - 1;
  const keep = new Set<number>([0, last]);
  const stack: Array<readonly [number, number]> = [[0, last]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    if (end - start < 2) continue;
    const first = samples[start]!;
    const final = samples[end]!;
    const dx = final.x - first.x;
    const dy = final.y - first.y;
    const chord = Math.hypot(dx, dy);
    let maxDistance = -1;
    let maxIndex = -1;
    for (let index = start + 1; index < end; index += 1) {
      const sample = samples[index]!;
      const distance = chord <= FIT_DUPLICATE_EPSILON_UV
        ? Math.hypot(sample.x - first.x, sample.y - first.y)
        : Math.abs(dy * (sample.x - first.x) - dx * (sample.y - first.y)) / chord;
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = index;
      }
    }
    if (maxIndex >= 0 && maxDistance > tolerance) {
      keep.add(maxIndex);
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }
  return keep;
}

/**
 * The turn pass: walk the sanitised samples accumulating direction change;
 * every cumulative turn at or above the threshold keeps the sample where it
 * crossed. This is what survives a tolerance so wide that Douglas-Peucker
 * would drop a corner entirely — the cap may thin a straight run, never a
 * turn. Straight runs accumulate nothing and gain nothing.
 */
function addTurnAnchors(
  samples: readonly AquarellePoint[],
  keep: Set<number>,
  thresholdRad: number,
): void {
  let previousX = 0;
  let previousY = 0;
  let hasDirection = false;
  let accumulated = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const before = samples[index - 1]!;
    const here = samples[index]!;
    const dx = here.x - before.x;
    const dy = here.y - before.y;
    const length = Math.hypot(dx, dy);
    if (length <= FIT_DUPLICATE_EPSILON_UV) continue;
    const directionX = dx / length;
    const directionY = dy / length;
    if (hasDirection) {
      const cosine = Math.min(
        1,
        Math.max(-1, previousX * directionX + previousY * directionY),
      );
      accumulated += Math.acos(cosine);
      if (accumulated >= thresholdRad) {
        keep.add(index);
        accumulated = 0;
      }
    }
    previousX = directionX;
    previousY = directionY;
    hasDirection = true;
  }
}

/** Sorted, evenly thinned indices — the LAST-resort cap, endpoints pinned. */
function indexDecimate(sorted: readonly number[], maxAnchors: number): Set<number> {
  const keep = new Set<number>([sorted[0]!, sorted[sorted.length - 1]!]);
  const interior = maxAnchors - 2;
  for (let stepIndex = 1; stepIndex <= interior; stepIndex += 1) {
    keep.add(sorted[Math.round((stepIndex * (sorted.length - 1)) / (interior + 1))]!);
  }
  return keep;
}

/**
 * Fit a painted stroke's recorded samples into interpolating `auto` anchors.
 *
 * Returns an EMPTY list when there is nothing usable to fit (fewer than two
 * distinct finite samples) — the caller refuses the conversion and writes
 * nothing rather than guessing a path. Never throws (T-62-01).
 */
export function fitVectorPathAnchors(
  points: readonly AquarellePoint[],
  options?: VectorPathFitOptions,
): readonly AquarelleAnchor[] {
  const samples = sanitiseSamples(points);
  if (samples.length < VECTOR_PATH_FIT_MIN_ANCHORS) return [];
  const maxAnchors = resolveMaxAnchors(options);

  // Endpoints are always pinned by Douglas-Peucker, so the floor is met while
  // two distinct samples exist; the cap loop can only ever add anchors back.
  let tolerance = VECTOR_PATH_FIT_TOLERANCE_UV;
  let keep = douglasPeucker(samples, tolerance);
  addTurnAnchors(samples, keep, VECTOR_PATH_FIT_TURN_THRESHOLD_RAD);
  for (
    let doubling = 0;
    keep.size > maxAnchors && doubling < FIT_TOLERANCE_DOUBLINGS;
    doubling += 1
  ) {
    tolerance *= 2;
    keep = douglasPeucker(samples, tolerance);
    addTurnAnchors(samples, keep, VECTOR_PATH_FIT_TURN_THRESHOLD_RAD);
  }
  const sorted = [...keep].sort((left, right) => left - right);
  if (sorted.length > maxAnchors) {
    keep = indexDecimate(sorted, maxAnchors);
  }
  return Object.freeze(
    [...keep]
      .sort((left, right) => left - right)
      .map((index) => ({ x: samples[index]!.x, y: samples[index]!.y, kind: 'auto' as const })),
  );
}
