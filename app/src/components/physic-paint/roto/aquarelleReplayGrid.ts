import type { StudioPoint, StudioStroke } from '@efxlab/efx-paint-host/animation';
import {
  DEFAULT_AQUARELLE_CURVE_MODE,
  evaluateAquarellePath,
  type AquarelleStrokePayload,
} from '@efxlab/efx-watercolor/payload';
import {
  VECTOR_STROKE_BASE_PRESSURE,
  resampleVectorPaintPoints,
} from '../view/vectorPathHandles';

/** The pressure sentinel a mouse records — the engine derives it from speed. */
const VECTOR_PRESSURE_SENTINEL = -1;

function pressureAt(
  source: readonly StudioPoint[],
  fraction: number,
): number {
  const last = source.length - 1;
  if (last <= 0) return source[0]?.p ?? VECTOR_STROKE_BASE_PRESSURE;
  const position = Math.max(0, Math.min(1, fraction)) * last;
  const low = Math.floor(position);
  const high = Math.min(last, low + 1);
  const t = position - low;
  const from = source[low]?.p ?? VECTOR_STROKE_BASE_PRESSURE;
  const to = source[high]?.p ?? VECTOR_STROKE_BASE_PRESSURE;
  const value = from + (to - from) * t;
  return Number.isFinite(value) ? value : VECTOR_STROKE_BASE_PRESSURE;
}

/**
 * Derive a vector stroke's REPLAY grid from its anchors (quick 261116-r9k
 * follow-up). The document keeps the spline — anchors plus the samples the
 * conversion minted — and the paint is tessellated here, at the render seam.
 *
 * The grid comes from `resampleVectorPaintPoints`, the SAME sampler the
 * draw-time mint uses, so a converted stroke replays with the paint cadence a
 * stroke drawn as a vector gets: ~40 samples on a 1.4 uv path. The geometry
 * walk's 0.002 uv rate is deliberately NOT used — it was measured at 230-700
 * samples and a 4-24 s wash that spread into a cloud a hand never paints.
 *
 * Pressure is remapped by arc fraction from the source samples (the conversion
 * spread them evenly along the same spine), so the recorded profile survives
 * the re-gridding; an all-sentinel source stays all-sentinel and lets the
 * engine own pressure exactly as at draw time. Tilt is not carried: a vector
 * path has no tilt input.
 *
 * Hand-painted strokes (no anchors) are returned untouched.
 */
export function withAquarelleReplayGrid(
  stroke: StudioStroke<AquarelleStrokePayload>,
): StudioStroke<AquarelleStrokePayload> {
  const anchors = stroke.engine.anchors;
  const source = stroke.pts;
  const clone = (): StudioStroke<AquarelleStrokePayload> => ({
    ...stroke,
    pts: source.map((point) => ({ ...point })),
    engine: { ...stroke.engine },
  });
  if (anchors === undefined || anchors.length < 2 || source.length === 0) return clone();

  const curveMode = stroke.engine.curveMode ?? DEFAULT_AQUARELLE_CURVE_MODE;
  const { points: spine } = evaluateAquarellePath(anchors, curveMode);
  if (spine.length < 2) return clone();

  const paint = resampleVectorPaintPoints(spine);
  if (paint.length < 2) return clone();

  const sentinel = source.every((point) => point.p === VECTOR_PRESSURE_SENTINEL);
  const last = paint.length - 1;
  const pts: StudioPoint[] = paint.map((point, index) => ({
    x: point.x,
    y: point.y,
    p: sentinel ? VECTOR_PRESSURE_SENTINEL : pressureAt(source, last === 0 ? 0 : index / last),
    tx: 0,
    ty: 0,
    tw: 0,
    tick: index,
  }));

  return {
    ...stroke,
    pts,
    // The replay feeds one sample per engine tick, so the derived grid owns
    // the stroke's duration: it IS the wet lifetime.
    ticks: Math.max(1, pts.length - 1),
    engine: { ...stroke.engine },
  };
}
