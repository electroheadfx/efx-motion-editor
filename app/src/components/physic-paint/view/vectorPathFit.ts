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
//  DETERMINISTIC (D-05): identical input yields identical output.
//  No randomness, no clocks, no locale-dependent arithmetic; the
//  passes are bounded (sanitise, endpoint pinning, one decimation).
//
//  62-01 T1 ships the tracer law: sanitise (finite only, drop
//  consecutive duplicates), pin the first and last samples and
//  index-decimate the interior to the cap. 62-01 T2 replaces the
//  decimation with the curvature-adaptive Douglas-Peucker law;
//  the public surface and the guarantees above do not change.
// ============================================================
import type { AquarelleAnchor, AquarellePoint } from '@efxlab/efx-watercolor/payload';

/** Hard ceiling on anchors per stroke (D-05). */
export const VECTOR_PATH_FIT_MAX_ANCHORS = 40;

/** Below two distinct samples there is no path to fit — the caller refuses. */
export const VECTOR_PATH_FIT_MIN_ANCHORS = 2;

/** Consecutive samples closer than this (document uv) are one sample. */
const FIT_DUPLICATE_EPSILON_UV = 1e-6;

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
  if (samples.length <= maxAnchors) {
    return Object.freeze(
      samples.map((sample) => ({ x: sample.x, y: sample.y, kind: 'auto' as const })),
    );
  }
  // Endpoints are always pinned; the interior is decimated from the ORIGINAL
  // samples (never interpolated), so every anchor stays ON recorded paint.
  const indices = new Set<number>([0, samples.length - 1]);
  const interior = maxAnchors - 2;
  for (let stepIndex = 1; stepIndex <= interior; stepIndex += 1) {
    indices.add(Math.round((stepIndex * (samples.length - 1)) / (interior + 1)));
  }
  return Object.freeze(
    [...indices]
      .sort((left, right) => left - right)
      .map((index) => ({ x: samples[index]!.x, y: samples[index]!.y, kind: 'auto' as const })),
  );
}
