// ============================================================
//  bristles.ts — the deterministic per-bristle set (64-21).
//
//  DETERMINISM CONTRACT: the whole bristle set is a pure function of ONE
//  seeded stream — the stroke's `traceSeed` RNG, installed per stroke by the
//  adapter. Nothing here reads wall-clock time, `Math.random`, or engine
//  state, and the module imports nothing.
//
//  RNG draws happen in a fixed order; changing it changes every bristle, so
//  the order is part of the record's meaning, not an implementation detail:
//    per run header: `run`, `d`, `f`, `p`, value pick, value multiplier
//                    (exactly ONE multiplier draw, in all three value bands)
//    per bristle:    `across`, `radiusScale`, `touchReach`, `loadRate`,
//                    `initialLoad`, `seed`, `valueJitter`
//  One draw per field even when a run is clipped by `count` — a run that ends
//  past the last bristle still consumed its whole header, so the stream stays
//  aligned whatever the count.
//
//  Port of the reference brush's bristle discretisation (§4.1) and
//  per-bristle/tuft jitter (§4.2) from
//  /Users/lmarques/Dev/craft-brushes/notes/brush-blending.md. Read-as-law
//  source: spike 002 (`sources/002-acrylic-bristle-deposit/src/bristles.ts`).
//
//  64-22 adds the gather's two constants here, beside the stroke's other
//  constants: §6's softness (0.09) and the Feather gain (0.25), with the
//  band law `gatherSoftness` — one declaration, read by the engine's binder.
//
//  Layout per bristle (stride 8):
//    0 across      normalised across-position, -1..1   (§4.1 shape.x)
//    1 radiusScale tuft radius multiplier               (§4.2 shape.y)
//    2 touchReach  pressure needed to print             (§4.2 shape.z)
//    3 loadRate    per-bristle depletion multiplier     (§4.2 shape.w)
//    4 seed        stable per-bristle noise seed        (§3.1 state.z)
//    5 valueJitter colour multiplier                    (§4.2 state.w)
//    6 initialLoad pigment charge at stroke start       (§3.1 paint.w)
//    7 spare
// ============================================================

/** The reference's bristle cap: the set never exceeds a `1 × 256` texture (§4.1). */
export const BRISTLE_CAP = 256;
/** The reference's fixed inter-bristle spacing, in document pixels (§4.1). */
export const BRISTLE_SPACING_PX = 1.1;
/** The reference's bristle floor: small brushes pack tighter, not fewer (§4.1). */
export const BRISTLE_MIN = 40;
/**
 * §6 `paint.softness` — the half-width of the band the gather's coverage
 * threshold is smoothed by, at Feather 0. This is the reference's own
 * default, not a tuning knob: the band widens only through Feather.
 */
export const BRISTLE_SOFTNESS = 0.09;
/** 64-22 (D-22): how far the Feather global widens the band — Feather 1 is 0.34. */
export const BRISTLE_FEATHER_GAIN = 0.25;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/**
 * §4.1: `count = round(clamp(2·halfWidth / 1.1, 40, 256))`.
 * `halfWidthPx` is the footprint half-width in document texels (the
 * reference's device pixels). A non-finite or non-positive half-width maps to
 * the floor: a stroke always prints some bristles.
 */
export function bristleCount(halfWidthPx: number): number {
  if (!Number.isFinite(halfWidthPx) || halfWidthPx <= 0) return BRISTLE_MIN;
  return clamp(
    Math.round(clamp((2 * halfWidthPx) / BRISTLE_SPACING_PX, BRISTLE_MIN, BRISTLE_CAP)),
    BRISTLE_MIN,
    BRISTLE_CAP,
  );
}

/**
 * 64-22 (D-22): the gather's coverage band — `softness = 0.09 + 0.25·feather`.
 * Feather 0 is §6's default band; 1 widens it to 0.34. A negative or
 * non-finite Feather clamps at the neutral 0 (a missing record key must
 * replay at the shipped look, never at a widened band), and the top clamps
 * at the canonical 1 so the band cannot leave its declared range.
 */
export function gatherSoftness(feather: number): number {
  const f = Number.isFinite(feather) ? clamp01(feather) : 0;
  return BRISTLE_SOFTNESS + BRISTLE_FEATHER_GAIN * f;
}

export interface BristleSet {
  readonly count: number;
  /** The 8-float records, count × 8. */
  readonly data: Float32Array;
}

/**
 * Port of the reference's `C()` (app.js:363), notes §4.2:
 *  - bristles are generated in runs of 3–17 sharing radius/touch/load/value,
 *  - 18 % of runs are 0.80–0.92 (dark fibres), 12 % 1.04–1.12 (light),
 *  - per bristle: ±30 % of a spacing of positional jitter, edge bristles
 *    thicker and drier, and a fine ±4 % value jitter.
 *
 * `rng` is the stroke's seeded generator. The call order is the determinism
 * contract (see the file header): changing it changes every bristle.
 */
export function makeBristles(count: number, rng: () => number): BristleSet {
  const n = clamp(Math.trunc(count), BRISTLE_MIN, BRISTLE_CAP);
  const data = new Float32Array(n * 8);
  const spacing = 2 / n;
  let i = 0;
  while (i < n) {
    // §4.2 run header — ONE draw per field, even when the run is clipped.
    const run = 3 + Math.floor(rng() * 14);
    const d = 0.75 + rng() * 0.6;
    const f = (rng() - 0.5) * 0.16;
    const p = 0.88 + rng() * 0.12;
    const valuePick = rng();
    let m: number;
    if (valuePick < 0.18) m = 0.8 + rng() * 0.12;
    else if (valuePick < 0.3) m = 1.04 + rng() * 0.08;
    else m = 0.96 + rng() * 0.08;
    for (let k = 0; k < run && i < n; k += 1, i += 1) {
      // §4.1: across-position jitter is ±30 % of one spacing — the difference
      // between a comb and a brush.
      const across = -1 + (i + 0.5) * spacing + (rng() - 0.5) * 0.6 * spacing;
      const edge = smoothstep(0.55, 1, Math.abs(across));
      // §4.2: edge bristles are thicker.
      const radiusScale = d * (0.88 + rng() * 0.24) * (1 + 1.4 * edge);
      // §4.2: touchReach is how much pressure a bristle needs to print.
      const touchReach = clamp(0.04 + 0.3 * rng() * rng() + 0.42 * edge + f, 0, 0.92);
      // §4.2: loadRate shares the radius law — the rim dries first.
      const loadRate = d * (0.88 + rng() * 0.24) * (1 + 1.4 * edge);
      // §4.2: the rim starts with less paint.
      const initialLoad = p * (1 - 0.3 * edge * rng());
      // §3.1: a stable per-bristle noise seed (state.z).
      const seed = rng();
      // §4.2: the run's value multiplier with a fine ±4 % fibre jitter.
      const valueJitter = m * (1 + (rng() * 2 - 1) * 0.04);
      const base = i * 8;
      data[base] = across;
      data[base + 1] = radiusScale;
      data[base + 2] = touchReach;
      data[base + 3] = loadRate;
      data[base + 4] = seed;
      data[base + 5] = valueJitter;
      data[base + 6] = initialLoad;
      data[base + 7] = 0;
    }
  }
  return { count: n, data };
}
