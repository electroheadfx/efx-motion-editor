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
//  constants: §6's softness (0.09), which never moves, and Studio's Feather
//  reach — one declaration, read by the engine's binder.
//
//  64-23 adds the trace and edge laws — §4.3 (dryness, streak, broken),
//  §4.4 (the paper-tooth threshold), §4.5 (the wide/local body), §5.3 (rim
//  contact), §5.4 (the staggered landing) and §5.5 (the rim coverage bias) —
//  as §6's eight declared constants plus ten pure formulas. Each formula is
//  the tested twin of an expression in the gather's GLSL: `shaders.ts` must
//  carry the same expression, and the engine binds these constants as
//  uniforms, so a second copy of any number fails a source pin.
//
//  64-24 adds the §3.4 wetness gate: `LAST_TOUCH_DRY_SECONDS` (the last-touch
//  field's one-week cleared sentinel), `bristleWetness` (the carrier's
//  timestamp law in mode 1) and `bristleTouchValue` (`bristleTouchFS`'s mix).
//  The engine imports the sentinel — this module never imports anything.
//
//  261119-pod adds the §3.3 deposit smear (its 6 px hash cell and 0.8 clamp)
//  and its two pure twins. `bristleSmearRate` IS the Pickup 1:1 mapping
//  (D-A): one knob, no second curve. Each twin mirrors one expression in
//  `shaders.ts`; the engine binds the constants as uniforms, so a literal
//  that replaces a declared constant, or a second copy of a law, fails the
//  source pins. Feather never widens §6's band: it raises the §4.4 paper
//  threshold radially (`BRISTLE_FEATHER_REACH`), so F0 keeps the reference's
//  full stroke and F1 opens the rim into dry specks. It never scales the
//  film's depth — that law wrote the artist's pale lane (see the constant).
//
//  THE §4.4 NAME COLLISION: `BRISTLE_GRAIN` (1.2) is the paint's paper-tooth
//  scale from §6 — NOT `Brush.grain` (0..1, the dry re-threshold the engine's
//  footprint mask has always read). They are different quantities that share
//  a word, exactly like the Stam solver's "viscosity" gotcha: the gather's
//  `uGrain` receives `BRISTLE_GRAIN`, the footprint mask keeps the brush's
//  grain, and neither is ever interchanged.
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
 * §6 `paint.softness` — the REFERENCE's band, and its only one: the reference
 * has no Feather control, so every reference stroke uses this 0.09. It is a
 * constant in Studio too: Feather thins the film radially instead of touching
 * this band (a wider band ADDS paint — the inverted first cut). It remains the
 * neutral fallback for a missing / non-finite band width.
 */
export const BRISTLE_SOFTNESS = 0.09;
/**
 * Studio-only Feather (D-22; artist's rulings 2026-11-19, 2026-11-20, and the
 * 2026-11-22 pale-line rows): Feather owns the mark's EDGE, and F0 must read
 * CLEAN. Two earlier cuts were rejected: widening the threshold band lowered
 * the threshold and ADDS paint (the control read inverted); a lateral fade on
 * the coverage alone was erased by the dab-over-dab lerp, so F0/F100 differed
 * only by display blur. The 2026-11-20 law thinned the carried film at the
 * LATERAL rim — and wrote a continuous pale line (ENCLOSED 7.54 % in 231-px
 * runs at the artist's parameters): a depth fade gives the texel a small
 * deposit weight, and the dab lerp then holds the old film for ~100 px of
 * travel, so every pale cell froze into a lane. Its along-only selector was
 * rejected in UAT as a tiled band motif. The shipped law raises the §4.4
 * paper TOOTH threshold at the lateral rim and never scales the film's
 * depth: the edge opens into full-depth specks over paper, the way a drying
 * brush ends, and the rag comes from the paper (no along period). This
 * constant is the fraction of the silhouette the threshold opens over at F1
 * (`featherStart = edge · (1 - reach)`): F0 is a crisp edge, F1 opens the
 * outer band while the core stays loaded.
 *
 * 2026-11-20, the artist's live F100 report: at 0.65 the fade covered the
 * outer two-thirds of the silhouette, so F100 washed the stroke's body out
 * and where two feathered strokes met both films thinned to nothing — read as
 * a white glow seam. 0.30 keeps the mark's body solid and opens only the
 * outer rim.
 */
export const BRISTLE_FEATHER_REACH = 0.3;
/**
 * 2026-11-22 (the pale-line rows): how far the paper-tooth THRESHOLD rises at
 * the rim when Feather is 1, scaled by uFeather and ramped from `featherStart`
 * to BRISTLE_FEATHER_EDGE. 0.35 opens the rim into full-depth tooth specks
 * over paper without eating the loaded body — measured at the artist's
 * parameters: the core keeps 0.69-0.72 darkness out to 56 px, the specks
 * begin at ~64 px, and the fringe reaches paper by ~96 px. Feather never
 * scales the film's depth (that law wrote the pale lane); see
 * BRISTLE_FEATHER_REACH.
 */
export const BRISTLE_FEATHER_SHIFT = 0.35;
/**
 * The stroke's LEADING end cap: the fraction of the dab's forward half over
 * which the front of the mark fades. The start of a stroke is soft through
 * the reference's staggered landing ramp; without a matching takeoff the mark
 * ended on a hard dab edge (artist: "la fin est trop dure, elle devrait être
 * comme le début"). 2026-11-20: the cap no longer mixes toward
 * BRISTLE_FEATHER_REACH — that constant was lowered for the SIDES, which
 * made Feather shorten the ends. The cap now carries the gain at every
 * Feather, and the gather breaks it into hairs like the landing does.
 */
export const BRISTLE_FEATHER_CAP = 0.5;
/**
 * 2026-11-20 (artist: the end "like cutted by a knife"): the along-cap fade's
 * gain. The cap fraction above was tuned on small marks; on a 100 px brush it
 * spans ~30 px and reads as a cut. 1.8 lengthens the taper while leaving the
 * LATERAL fade (which owns its own constants) untouched.
 */
export const BRISTLE_CAP_GAIN = 1.8;
/**
 * 2026-11-20 (the artist's Dry re-range): the end transition's WIDTH follows
 * Dry. Dry 0 is a wet brush, and its end read as a long wet fade — it now
 * ends on a short, crisp taper. The ramp reaches full width at
 * BRISTLE_DRY_CAP_FULL, the acrylic default (Dry 70), so the validated
 * default is unchanged and Dry 100 keeps the width the artist approved.
 * The floor keeps the fade non-zero at Dry 0 (a zero width collapses
 * smoothstep's edges and hard-cuts every hair).
 */
export const BRISTLE_DRY_CAP_FLOOR = 0.12;
/** The Dry value (0..1) where the end cap reaches its full width. */
export const BRISTLE_DRY_CAP_FULL = 0.7;
/**
 * 2026-11-23 (the acrylic end-block): the stroke's TAKEOFF — the paper-tooth
 * threshold rise over the outer LEADING band of every dab, scaled by the same
 * `0.3 + 0.7 * uPressure` factor the coverage carries. A stroke ends on its
 * last running dab's leading frontier: every earlier frontier is repainted by
 * the dabs ahead, so the end that survives is exactly the band no later dab
 * covers. The along cap only fades DEPTH, and the deposit lerp holds film the
 * running dabs already committed (a small weight a keeps it for ~100 px), so
 * a depth fade cannot open that frontier — measured: the stopped end was a
 * wall at x = 1015 on every row, flat over 83 % of the width. Raising the
 * SAME paper threshold the Feather law uses turns the frontier into
 * full-depth tooth specks (no partial-depth window, no along-periodic motif):
 * at the acrylic record's parameters the stopped end reads 21.9 % flat / 12 px
 * longest same-x run (mouse 25.3 % / 34 px, decay 20.1 % / 17 px, mouse-lift
 * 10.4 % / 6 px, bake 23.7 % / 15 px) against the body's 0.578 darkness, and
 * the approved pen-lift end is unchanged (1.8 %). 1.1 clears a full-pressure
 * body (1.0 · 0.97) against the paper threshold's -0.25 floor, so a mouse
 * stop opens the frontier like a pen lift.
 */
export const BRISTLE_TAKEOFF_SHIFT = 1.1;
/**
 * 2026-11-20 (the artist's large-brush steps; "samples should be proportional
 * to the size of the brush, to not slow down normal size brush"): the dab
 * chain is SUPERSAMPLED with the brush's canonical Size — the 3D motion
 * supersampling law — so a large tip motif is re-sampled more finely instead
 * of repeating as visible steps. Gated on the canonical Size (the slider the
 * artist reads), never on the document-pixel radius, which moves with the
 * sheet resolution. The per-dab ink divides by the same factor, so the wash
 * per distance is unchanged — only the sampling.
 *
 * 2026-11-20 (the artist's explicit table, after both the linear and the
 * exponential first passes): <50 → 1x, 100 → 2x, 200 → 4x, 240 → 8x,
 * 300 → 16x, 340 → 30x, above 340 → 50x. Interpolated linearly between the
 * anchors; the jump above 340 is a STEP, exactly as specified. Cost is the
 * trade the artist accepted ("increase sampling, but it increases render"):
 * big sizes stamp far more dabs; ≤50 is untouched.
 */
export const BRISTLE_SAMPLE_TABLE: ReadonlyArray<readonly [sizePx: number, scale: number]> = Object.freeze([
  [0, 1],
  [50, 1],
  [100, 2],
  [200, 4],
  [240, 8],
  [300, 16],
  [340, 30],
] as const);
/** Above this canonical Size the factor steps to {@link BRISTLE_SAMPLE_ABOVE}. */
export const BRISTLE_SAMPLE_ABOVE_PX = 340;
/** The step value above BRISTLE_SAMPLE_ABOVE_PX. */
export const BRISTLE_SAMPLE_ABOVE = 50;

/** The motion-supersampling factor for a canonical Size in px (1 = off). */
export function bristleSampleScale(sizePx: number): number {
  if (!Number.isFinite(sizePx)) return BRISTLE_SAMPLE_ABOVE;
  if (sizePx > BRISTLE_SAMPLE_ABOVE_PX) return BRISTLE_SAMPLE_ABOVE;
  const table = BRISTLE_SAMPLE_TABLE;
  for (let i = 1; i < table.length; i += 1) {
    const [x1, y1] = table[i]!;
    if (sizePx > x1) continue;
    const [x0, y0] = table[i - 1]!;
    if (x1 === x0) return y1;
    return y0 + ((sizePx - x0) / (x1 - x0)) * (y1 - y0);
  }
  return BRISTLE_SAMPLE_ABOVE;
}

/**
 * The lateral threshold shift's start anchor for Feather > 0. The 2026-11-20
 * white-seam ruling supersedes the earlier "even F0 keeps a soft lateral
 * edge" cut: at F0 the gather applies NONE of this shift — the rim is the
 * thresholded bristle coverage, so a drying stroke breaks into hairs instead
 * of fading into a blurred band over the paper. From Feather > 0 the shift
 * opens from this fraction of the silhouette and widens to
 * BRISTLE_FEATHER_REACH at F1 (its strength is also scaled by uFeather, so
 * the edge grows continuously from the ragged F0 rim).
 */
export const BRISTLE_FEATHER_MIN = 0.18;
/**
 * Where the mark's SILHOUETTE sits, in fractions of the nominal bristle
 * footprint radius. The outer third of the footprint is intermittent bristle
 * spill: the reference's visible half-width measures ~0.66 of it (probe:
 * 19 px visible vs 29 px nominal at size 19). Studio's analytic edge anchors
 * here, so Feather opens the edge WITHOUT resizing the brush — an edge at
 * the full nominal radius made F0 50 % wider than F100 (measured: 29 px vs
 * 18.5 px) and the slider read as a size control.
 */
export const BRISTLE_FEATHER_EDGE = 0.66;
/**
 * The display polish's one strength: a 5-tap soften of the PAINT FILM only
 * (never the paper), for every bristle sheet regardless of Feather. The
 * gather deposits near-binary coverage, so the mark's rim stair-steps at
 * document resolution; the artist asked for a slight blur to tame that.
 * Display-only — it never touches the stored film.
 */
export const BRISTLE_FILM_BLUR = 0.35;

// ------------------------- the trace and edge constants (64-23) -------------------------

/**
 * §6 `paint.grain` — the paint's paper-tooth scale: `threshold = 1.2·(1 − height) − 0.25`
 * maps the whole paper-height range into [−0.25, 0.95]. NOT `Brush.grain` (0..1, the
 * footprint mask's dry re-threshold): see the header's §4.4 collision note.
 */
export const BRISTLE_GRAIN = 1.2;
/** §4.3 `paint.streak` — how early in the drying process the dashes start (0.9). */
export const BRISTLE_STREAK = 0.9;
/** §4.3 `paint.streakLength` — the dash wavelength along the stroke, in CSS px (18). */
export const BRISTLE_STREAK_LENGTH = 18;
/** §4.4 `streakShare` — how much of the paper height is brush-local streaks vs cloud (0.15). */
export const BRISTLE_STREAK_SHARE = 0.15;
/** §5.3 `rimContact` — the global amplitude of the rim's contact wobble (0.45). */
export const BRISTLE_RIM_CONTACT = 0.45;
/** §4.3/§4.5 `hairs` — how hard dryness cuts, and how much the body reads local (0.45). */
export const BRISTLE_HAIRS = 0.45;
/** §5.5 `dryEdge` — the coverage multiplier the outermost bristles sink to (0.35). */
export const BRISTLE_DRY_EDGE = 0.35;
/** §5.4 `paint.landing` — the spread of the staggered landing (1.6). */
export const BRISTLE_LANDING = 1.6;

// ------------------------- Spec 10: the stroke layer's lateral alpha -------------------------
//
//  Edge transparency (amount, 0..1) and Edge falloff (shape bias, 0..1) shape
//  ONE lateral factor on the per-stroke translucent LAYER's alpha — the
//  stroke's own deposited paint, never the gather film. The factor spans the
//  WHOLE lateral coordinate, from the centre line (u = 0, weight 1) to the
//  stroke's VISUAL edge (u = 1, weight 1 − amount) — there is no opaque
//  plateau: at amount 100 only the centre line retains full alpha. The shape
//  bias's exponent is the tested twin `edgeFalloffExponent` below.
/** The lateral field's anchor, in nominal-footprint units (0.9): the engine
 *  writes `u = clamp(|across| / (uRadius · BRISTLE_LAYER_EDGE), 0, 1)` into
 *  layerFilm attachment 1, so u = 1 is the stroke's visible edge.
 *
 *  261126: measured at 2048 on the shipped edge-layer scene (radius 55 px),
 *  the layer's own cover_L rows read a plateau to ~33 px, the 0.9-of-peak
 *  silhouette at ~35 px, half-cover at ~39.5 px, 5 % at ~46 px and zero at
 *  ~50-52 px. The old anchor (BRISTLE_FEATHER_EDGE, 0.66 ⇒ saturation at
 *  36 px) clamped to u = 1 INSIDE the visible deposit, then applied a 0.30
 *  start plateau on top — two plateaus at once, which is the solid core the
 *  artist reported. 0.9 places u = 1 at the coverage's visible end, where the
 *  fringe is under 2-5 % cover, so the fade spans the full mark. */
export const BRISTLE_LAYER_EDGE = 0.9;

// ------------------------- the contact pressure law (spike 004) -------------------------
//
//  The pointer's pressure is NOT the pressure the reference's carrier and
//  gather read. `press()` (app.js:445) seeds the brush at 0.3·penPressure and
//  `update()` (app.js:521-531) converges it, each frame, toward
//    mix(pressureSlow 1, pressureFast 0.42, speedRamp) · penPressure · attackRamp
//  with speedRamp = smoothstep(0, pressureSpeed 1.4, speed / shortSide) and
//  attackRamp = smoothstep(0, attack 0.018 · shortSide, distance). A fast mouse
//  drag therefore paints at ~0.42, not 1.0 — and BOTH the coverage factor
//  (0.3 + 0.7·pressure) and the touch gate follow it, which is the whole of
//  the reference's core porosity. The engine keeps its authored pressure for
//  the footprint/radius (Studio's size law) and feeds this contact pressure to
//  the bristle carrier and gather only.
export const BRISTLE_PRESSURE_SLOW = 1;
export const BRISTLE_PRESSURE_FAST = 0.42;
export const BRISTLE_PRESSURE_SPEED = 1.4;
export const BRISTLE_PRESSURE_ATTACK = 0.018;
export const BRISTLE_PRESSURE_ATTACK_FLOOR = 0.45;
/** `press()`: the brush starts a stroke at 0.3·penPressure. */
export const BRISTLE_PRESSURE_START = 0.3;

/**
 * §3.1: the reference's brush contact pressure. `speed` is in document heights
 * per second (app.js divides device px/s by the short side), `strokeDistPx`
 * is the brush's cumulative path in document texels, `docShortPx` the
 * document's short side. A non-finite argument reads as the neutral pen
 * pressure 1 / zero speed / zero distance, never NaN.
 *
 * `pressureLink` (0..1, quick 261121-umu) is how much the authored pen
 * pressure enters this CONTACT gate: 1 keeps the shipped formula exactly; 0
 * makes the gate independent of the authored pen while the speed and attack
 * ramps still apply — a light press then thins the mark through the footprint,
 * not through the gate. A non-finite link reads as 1 (the never-NaN contract).
 *
 * `speedLink` (0..1, 2026-11-21) is how much the HAND SPEED enters the same
 * gate: 1 keeps the shipped formula exactly; 0 removes the speed ramp, so a
 * fast hand deposits like a slow one and the Dry law alone decides whether the
 * paint runs out. A non-finite link reads as 1.
 */
export function bristleContactPressure(
  penPressure: number,
  speed: number,
  strokeDistPx: number,
  docShortPx: number,
  pressureLink = 1,
  speedLink = 1,
): number {
  const authored = Number.isFinite(penPressure) ? clamp01(penPressure) : 1;
  const link = Number.isFinite(pressureLink) ? clamp01(pressureLink) : 1;
  // mix(1, authored, link), associated so link 1 returns `authored` exactly.
  const pen = authored + (1 - authored) * (1 - link);
  const v = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const d = Number.isFinite(strokeDistPx) ? Math.max(0, strokeDistPx) : 0;
  const reach = Number.isFinite(docShortPx) && docShortPx > 0 ? BRISTLE_PRESSURE_ATTACK * docShortPx : 0;
  const speedLinkClamped = Number.isFinite(speedLink) ? clamp01(speedLink) : 1;
  // `× 1` is exact in IEEE, so the shipped link 1 is bit-identical.
  const speedRamp = smoothstep(0, BRISTLE_PRESSURE_SPEED, v) * speedLinkClamped;
  const attackRamp = reach > 0 ? smoothstep(0, reach, d) : 1;
  return (
    mix(BRISTLE_PRESSURE_SLOW, BRISTLE_PRESSURE_FAST, speedRamp) *
    pen *
    mix(BRISTLE_PRESSURE_ATTACK_FLOOR, 1, attackRamp)
  );
}

// ------------------------- the §3.4 wetness gate (64-24) -------------------------

/**
 * D-24: the last-touch field's CLEARED value — one week before the clock's
 * zero. A cleared R32F reads 0, which the gate would read as "touched at t = 0"
 * and every texel would start wet; −604800 s makes `exp(−age / wetSeconds)`
 * 0 to float precision for any tack time. The only cleared value the engine
 * ever writes into the field, declared HERE with the module's other laws and
 * imported by `Engine.ts` — never a second copy.
 */
export const LAST_TOUCH_DRY_SECONDS = -604800;

// ------------------------- the §3.3 smear (261119-pod) -------------------------

/**
 * §3.3 `smear`: the reference hashes in bands ALONG the stroke —
 * `floor(distanceAlong / 6)` at 1080 device pixels (app.js:1191-1193). The
 * 6 px period is the reference's own number, restated as a declared constant
 * so the gather's uniform and the twin cannot drift.
 */
export const BRISTLE_SMEAR_PERIOD_PX = 6;

/**
 * §3.3: `carried = mix(carried, canvas, clamp(smear, 0, cap))` — the clamp
 * on how much of the pre-dab snapshot one deposit texel may inherit.
 * 2026-11-20 (artist): raised from the reference's 0.8 to 1.0. The Pickup
 * knob now carries its own response curve (2x at 100 %), the cap was binding
 * across most of the contact band, and the artist's maximum must read as a
 * full wet-on-wet pull — the strongest texels may adopt the sheet's colour
 * outright.
 */
export const BRISTLE_SMEAR_CAP = 1.0;

/**
 * 2026-11-26 (the artist's big-brush smoothing): the canonical-Size band where
 * the big-brush laws blend in — 0 at 200 px, 1 at 300 px. Above 200 px the
 * smear's per-cell hash tiles read as pixelation on big brushes (measured on
 * the live yellow/pink overlap: hard 6-px rectangles in the colour blend) and
 * the cap alpha's per-hair stagger reads as a pale cap line. Both blend onto
 * their smooth arms; at or below 200 px every term reduces to the shipped law.
 */
export const BRISTLE_BIG_FROM_PX = 200;
export const BRISTLE_BIG_TO_PX = 300;

/**
 * 261126-rov: the seeded interior displacement. The dark bristle-run bands
 * read the run lattice; a per-stroke seeded Perlin fBm displacing the lattice
 * lookup breaks the straight stripes while the coverage/film laws stay
 * untouched. Every brush size is displaced; the fragment's Pickup gate
 * (uSmear 0..0.15) keeps Pickup 0 byte-identical. The pickup/blend colour
 * lines have NO field of their own (the artist's live ruling): they follow
 * the body lattice with no micro displacement. Engine.bindGather binds these
 * as uniforms, so the shader cannot drift from the twins.
 */
/** The three-octave fBm's cells per half-width (across, along). */
export const BRISTLE_DISPLACE_CELLS_X = 0.5;
export const BRISTLE_DISPLACE_CELLS_Y = 0.6;
/** The lookup displacement at gate 1 and full interior, across units. */
export const BRISTLE_DISPLACE_AMP = 0.5;
/** The interior mask: full displacement inside 0.75, zero past 0.95. */
export const BRISTLE_DISPLACE_RIM_INNER = 0.75;
export const BRISTLE_DISPLACE_RIM_OUTER = 0.95;
/** The two per-stroke seed coordinates derive from the recorded bristle set. */
export const BRISTLE_DISPLACE_SEED_A = 137;
export const BRISTLE_DISPLACE_SEED_B = 149;

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
 * 64-22 (D-22): the gather's coverage band. The reference's 0.09 is a
 * constant: Feather never widens it (a wider band lowers the threshold and
 * ADDS paint — the inverted first cut the artist rejected). The argument is
 * kept so every recorded call site and the replay record stay stable.
 */
export function gatherSoftness(_feather: number): number {
  // The band is the reference's constant; Feather never widens it (that was
  // the inversion: a wider band lowers the threshold and ADDS paint).
  return BRISTLE_SOFTNESS;
}

/**
 * Spec 10: `e = 2^(2b - 1)` — the falloff shape bias as the fade's exponent,
 * clamped to `[0.5, 2]`. Canonical falloff 0 / 50 / 100 maps to 0.5 / 1 / 2:
 * the broad fade, linear, and the rim fade. A non-finite bias reads as linear
 * (1): a missing record key replays the neutral shape, never NaN.
 */
export function edgeFalloffExponent(bias: number): number {
  if (!Number.isFinite(bias)) return 1;
  return clamp(2 ** (2 * clamp01(bias) - 1), 0.5, 2);
}

// ------------------------- the trace and edge formulas (64-23) -------------------------
//
//  Each function below is the tested twin of one expression in the gather's
//  GLSL (shaders.ts, BRISTLE_GATHER). The constants above are bound as
//  uniforms, so the fragment and these helpers cannot drift: a literal that
//  replaces a declared constant fails the source pins in bristles.test.ts.
//  Every helper is pure and total — no clock, no RNG, no module state — and a
//  non-finite argument returns the neutral value documented on it, never NaN.

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const fract = (v: number) => v - Math.floor(v);

/**
 * §4.3: `dryness = clamp((1 − load)·streak·1.6, 0, 1)` — how far a bristle has
 * dried. A loaded bristle (load 1) is 0; load 0.5 is 0.72; load 0 saturates at
 * 1. A non-finite load reads as fully loaded (0): a missing record key replays
 * a solid stroke, never a broken one.
 */
export function bristleDryness(load: number): number {
  const l = Number.isFinite(load) ? load : 1;
  return clamp((1 - l) * BRISTLE_STREAK * 1.6, 0, 1);
}

/**
 * §4.3: `broken = mix(1, smoothstep(0.3, 0.7, streak), dryness·hairs)` — the
 * stroke eating itself. A loaded bristle returns exactly 1 at any noise; as it
 * dries the term becomes the thresholded along-stroke noise at the `hairs`
 * weight, so each bristle prints in dashes whose wavelength is
 * `STREAK_LENGTH` and whose phase is its own seed. A non-finite load reads as
 * fully loaded and a non-finite noise as the smooth peak (1): both replay the
 * solid look.
 */
export function bristleBroken(load: number, streakNoise: number): number {
  const dryness = bristleDryness(load);
  const noise = Number.isFinite(streakNoise) ? streakNoise : 1;
  return mix(1, smoothstep(0.3, 0.7, noise), dryness * BRISTLE_HAIRS);
}

/**
 * §4.4: `threshold = grain·(1 − height) − 0.25` — the paper tooth as a bar,
 * not a texture. At grain 1.2 a peak (height 1) maps to −0.25 (any coverage
 * deposits) and a valley (height 0) to 0.95 (only a nearly solid load does).
 * A non-finite grain replays §6's `BRISTLE_GRAIN`; a non-finite height reads
 * as no tooth (0), so missing paper data never invents peaks.
 */
export function bristleThreshold(grain: number, height: number): number {
  const g = Number.isFinite(grain) ? grain : BRISTLE_GRAIN;
  const h = Number.isFinite(height) ? height : 0;
  return g * (1 - h) - 0.25;
}

/**
 * §4.4: `smoothstep(threshold − softness, threshold + softness, coverage)` —
 * the band the threshold is smoothed by. At coverage = threshold it is exactly
 * 0.5; it saturates at 0 below the low edge and 1 above the high edge. A width
 * of exactly 0 is the law's own limit: a HARD step (Feather 0 has no feather).
 * A non-finite coverage prints nothing (0), a non-finite threshold reads as no
 * tooth (0), and a non-finite or negative width replays the reference's own
 * band (0.09) — the band widens only through `gatherSoftness`.
 */
export function bristleSoftnessBand(coverage: number, threshold: number, softness: number): number {
  const c = Number.isFinite(coverage) ? coverage : 0;
  const t = Number.isFinite(threshold) ? threshold : 0;
  if (softness === 0) return c >= t ? 1 : 0;
  const s = Number.isFinite(softness) && softness > 0 ? softness : BRISTLE_SOFTNESS;
  return smoothstep(t - s, t + s, c);
}

/**
 * §5.4: `landing = (0.04 + 0.7·fract(seed·13.7)²)·landing` — how many brush
 * widths a bristle must travel before it prints at all. At the reference's
 * landing 1.6 the offset spans [0.064, 1.184), squared so most bristles land
 * early and a few land late. A non-finite seed reads as 0 → the earliest
 * landing (0.064).
 */
export function bristleLandingOffset(seed01: number): number {
  const seed = Number.isFinite(seed01) ? seed01 : 0;
  const f = fract(seed * 13.7);
  return (0.04 + 0.7 * f * f) * BRISTLE_LANDING;
}

/**
 * §5.4: `landed = smoothstep(offset, offset + 0.12, strokeDistance/halfWidth)` —
 * the per-bristle landing ramp. A non-finite offset lands at 0; a non-finite
 * distance reads as fully landed (1), i.e. no ramp — the pre-64-23 look.
 */
export function bristleLanded(offset: number, distOverHalfWidth: number): number {
  const o = Number.isFinite(offset) ? offset : 0;
  const d = Number.isFinite(distOverHalfWidth) ? distOverHalfWidth : 1;
  return smoothstep(o, o + 0.12, d);
}

/**
 * §5.3: `rim = 0.25 + 0.75·smoothstep(0.45, 1, |across|)` — the share of the
 * contact wobble this bristle receives: a quarter at the centre, the full
 * amount at the extreme edge. A non-finite across reads as the centre.
 */
export function bristleRim(across: number): number {
  const a = Number.isFinite(across) ? Math.abs(across) : 0;
  return 0.25 + 0.75 * smoothstep(0.45, 1, a);
}

/**
 * §5.5: `dryEdge = mix(1, dryEdge, smoothstep(0.3, 1.05, |across|))` — the rim
 * coverage bias: 1 at the core, §6's `BRISTLE_DRY_EDGE` (0.35) at the rim. A
 * non-finite across reads as no bias (1).
 */
export function bristleEdgeBias(across: number): number {
  const a = Number.isFinite(across) ? Math.abs(across) : 0;
  return mix(1, BRISTLE_DRY_EDGE, smoothstep(0.3, 1.05, a));
}

/**
 * §4.5: `body = mix(wide/5·presence, local, hairs)` — the wide brush body
 * versus the fine per-bristle fibres, mixed by the same `hairs` that breaks a
 * drying stroke. The caller supplies `presence = min(profileSum/0.5, 1)`. A
 * non-finite wide/local/presence reads as 0; a non-finite hairs reads as 1
 * (local only — 64-22's body), so a missing key replays the shipped look.
 */
export function bristleBody(wide: number, local: number, presence: number, hairs: number): number {
  const w = Number.isFinite(wide) ? wide : 0;
  const l = Number.isFinite(local) ? local : 0;
  const p = Number.isFinite(presence) ? presence : 0;
  const h = Number.isFinite(hairs) ? hairs : 1;
  return mix((w / 5) * p, l, h);
}

/**
 * §4.5/§5.5: `coverage = body·(0.3 + 0.7·pressure)·edgeBias` — the coverage
 * the threshold is tested against. Pressure arrives from the engine's existing
 * pressure law (§5.2, untouched); this helper only formats it. A non-finite
 * body prints nothing (0), a non-finite pressure reads as the 0.3 floor, and a
 * non-finite edge bias reads as no bias (1).
 */
export function bristleCoverage(body: number, pressure: number, edgeBias: number): number {
  const b = Number.isFinite(body) ? body : 0;
  const p = Number.isFinite(pressure) ? pressure : 0;
  const e = Number.isFinite(edgeBias) ? edgeBias : 1;
  return b * (0.3 + 0.7 * p) * e;
}

// ------------------------- the §3.4 wetness laws (64-24) -------------------------

/**
 * §3.4: `wetness = exp(−age / wetSeconds)` — how much of its paint a texel
 * still gives up. `age` is SECONDS since the last touch (the last-touch
 * field, on the virtual clock) and `wetSeconds` is the paint's tack time,
 * floored at 1 so a zero or negative record value can never divide by zero.
 * A negative or non-finite age reads as 1 — a future timestamp is not yet
 * old, and a missing one must replay the fresh look, never NaN. The result
 * is clamped to 0..1 (exact float: `exp(−600/7)` is ~6e−38, still finite).
 */
export function bristleWetness(ageSeconds: number, wetSeconds: number): number {
  if (!Number.isFinite(ageSeconds) || ageSeconds < 0) return 1;
  const tau = Number.isFinite(wetSeconds) && wetSeconds > 1 ? wetSeconds : 1;
  return clamp01(Math.exp(-ageSeconds / tau));
}

/**
 * §3.4 / the touch stamp: `value = prev + (now − prev)·clamp01(mask)` — the
 * exact law `bristleTouchFS` runs, and the tested twin of its
 * `mix(prev, uNow, weight)`. Mask 0 leaves the field untouched, mask 1
 * writes `now`, and the result always lies between the two inputs. Total:
 * a non-finite prev reads as `now` (nothing to keep), a non-finite now as
 * the kept value, a non-finite mask as 0 (a missing weight records no
 * touch), and two missing times as 0 — never NaN.
 */
export function bristleTouchValue(prev: number, now: number, mask: number): number {
  const p = Number.isFinite(prev) ? prev : Number.isFinite(now) ? now : 0;
  const n = Number.isFinite(now) ? now : p;
  const m = Number.isFinite(mask) ? clamp01(mask) : 0;
  return p + (n - p) * m;
}

// ------------------------- the §3.3 smear and four-side Feather twins (261119-pod) -------------------------

/**
 * 261119-pod (D-A): the §3.3 smear rate IS the Pickup global — one knob, two
 * laws. Canonical 0..100 maps 1:1 onto 0..1 before it reaches the engine, so
 * Pickup 0 returns EXACTLY 0 (the guard skips the snapshot read AND the
 * weight is zero — belt and braces) and Pickup 100 returns EXACTLY 1. A
 * non-finite value reads as 0: a missing key never invents a smear.
 */
export function bristleSmearRate(pickup: number): number {
  return Number.isFinite(pickup) ? clamp01(pickup) : 0;
}

/**
 * §3.3: `smear = pickup · wet · hash` clamped to `[0, BRISTLE_SMEAR_CAP]` —
 * how far one deposit texel is carried toward the pre-dab snapshot. `wet` is
 * the gather's own wetness (age off the snapshot's cover alpha) and `hash` is
 * the reference's `hash21(nearest, floor(along / period))`. Monotone in each
 * argument and exactly 0 at rate 0. Any non-finite argument reads as 0 — a
 * missing term replays the dry look, never NaN.
 */
export function bristleSmearWeight(rate: number, wet: number, hash: number): number {
  if (!Number.isFinite(rate) || !Number.isFinite(wet) || !Number.isFinite(hash)) return 0;
  return clamp(rate * wet * hash, 0, BRISTLE_SMEAR_CAP);
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
      // app.js C(): `o(0.55, 1, |across|)` — the radial weight is LINEAR, never
      // a smoothstep. It scales touchReach and loadRate, not the radius.
      const edge = clamp(Math.abs(across), 0.55, 1);
      // app.js C(): `l = 0.75 + a()*0.95` — the radius scale is plain per
      // bristle. The edge-thickening `g` law is shape.w (loadRate): the rim
      // bristles are NOT thicker, they DRY FIRST.
      const radiusScale = 0.75 + rng() * 0.95;
      // §4.2: touchReach is how much pressure a bristle needs to print.
      const touchReach = clamp(0.04 + 0.3 * rng() * rng() + 0.42 * edge + f, 0, 0.92);
      // app.js C(): `g = d·(0.88 + a()·0.24)·(1 + 1.4·radial)` — the rim dries first.
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
