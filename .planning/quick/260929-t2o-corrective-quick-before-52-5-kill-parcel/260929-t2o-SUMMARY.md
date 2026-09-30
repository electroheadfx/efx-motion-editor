---
phase: quick-260929-t2o
plan: 260929-t2o
type: tdd
status: complete
tasks: 3
commits: 3
date: 2026-09-30
---

# 260929-t2o SUMMARY — kill parcellaire + make rim fibres read

**AUTOMATED-READY — NOT done.** Acceptance is the user's live native UAT (52.4 rows
a-i + R7 look a/b/c + no-parcellaire + rim-fibres-read + the new live-vs-finalize
row). Nothing is done until that UAT passes.

## Why

260929-m2z native UAT FAIL (the mark itself good, two look defects, two halves of
one gap):

1. **REGRESSION "rendu parcellaire"** (new in m2z):
   (a) the filled whole-fibre outline self-intersects where `w/2` exceeds the local
   curvature radius → winding cancellation → holes / hollow tube (near-certain live,
   `w = 2 x 4 = 8` px over writing curls of ρ ~ 3 px);
   (b) the thin regime REPLACED the lane field with 1-3 fibres on locally-thin
   spans — `endTaper` floors the scale at 0.3 at both ends of every curve slice
   (stroke.ts) and the pickup path re-slices into ~15-point segments each with its
   own `endTaper` → manufactured mid-stroke thin spans → field drop-out → gaps.
2. **R7(a) FAIL** — too few fibres READ at the contour: body overlap-packed to
   PIN 0 (a solid mass), `CORE_MAX_TRACE_WIDTH = 2` clamps `W(t)/gauge` flat
   (every body fibre exactly 2 px), and the rim — the only visible relief —
   rasterized 0.5-0.9 px, i.e. sub-pixel. Live tier compounds: 1/4 lanes x 4
   width (Q16) is literally few fibres.

Fix locked by R7 amended **2026-09-29b (USER SPEC ACT, on disk at
SPECS/real-paint/01-brush-footprint.md — SPECS/ is gitignored, no spec commit)**:
round-cap capsule sweep per fibre, thin family dissolved into a continuous
density field (density/spacing scale with local `halfW`), endTaper at true stroke
ends only, rim widths >= 1 px, `W(t)` variation surviving the 2 px clamp.

## What landed

| File | Change |
|------|--------|
| `packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts` | RED rewrite: `capsule-sweep`, `parcellaire` curl convexity, `continuous field`, `tSpan`, `rim-width`, `clamp-surviving` pins + extractLanes capsule-subpath parser; law pins kept at unchanged bounds |
| `packages/efx-physic-paint/src/brush/paint.ts` | `drawFibre`: one convex round-cap capsule per short step (convex hull of the two sample discs — external tangent sides + lineTo-only inscribed cap arcs, 3 interior points per 180 deg cap), ONE fill per fibre, nonzero union; thin family + regime spans deleted; `FootprintParams.tSpan` forwarded to `ribbonWithScales`; pickup call site passes the segment global range |
| `packages/efx-physic-paint/src/brush/footprintLanes.ts` | `RIM_WIDTH_MIN/MAX = 1.0/1.4`; `BODY_WIDTH_MIN 1.7 -> 1.4`; `THIN_HALF_W` deleted (regime dissolved) |
| `packages/efx-physic-paint/src/brush/stroke.ts` | `ribbonWithScales` optional 5th arg `tSpan?: [number, number]` — global-t `endTaper`; four-arg callers byte-identical |

Commits: `a53bdb26` (plan) → `ea9d209c` (RED) → `7487575f` (GREEN) → docs close.

## Design notes (why this shape)

- **Capsule = convex hull of the two sample discs**, not the literal per-sample-
  normal quad. The literal recipe is non-convex when a fibre crosses the path's
  curvature centre (bowtie cross-sign flip). On straight equal-radius steps the
  hull vertices coincide with the per-sample normal points, so the look-geometry
  pins read the same seam. Caps are lineTo-only (battery ctx stubs have no arc
  family).
- **Winding is uniform by construction** (rotation-equivariant vertex ordering:
  `R(A)d = cos A * d + sin A * û`, forward cap `+û → +d̂ → -û`, back cap
  `-û → -d̂ → +û`). The nonzero union of the ONE fill per fibre can therefore
  never cancel — self-intersection winding holes are structurally impossible.
- **Steps shorter than 0.05 px collapse to one 8-gon disc** at the step midpoint
  (fibre centre parked on the curvature centre: two discs 0.001 px apart are one
  disc geometrically). Without this the hull emits near-duplicate tangent points
  whose turn cross-products (~0.003) drown in the op-log `toFixed(3)` rounding
  floor (~0.008) — measured on the curl pin before the fix (subpaths 2/37/5/34).
- **One `c` per step** (clamped against `min(halfW)` of the step) so both capsule
  ends share the lateral offset — containment law holds at both ends.
- **Continuous field**: `buildBristleLanes` layout at EVERY pressure; density
  scales through the existing `offset x halfW` mapping. `endTaper` runs only at
  true stroke ends (`tSpan`); the pickup re-slice passes
  `[start/(n-1), (end-1)/(n-1)]` so mid-stroke slices keep full lateral extent.

## Chosen constants (co-designed, bounds untouched)

| Constant | Value | Arithmetic |
|----------|-------|------------|
| `RIM_WIDTH_MIN/MAX` | 1.0 / 1.4 | rim >= 1 px law; emitted rim at p=1 lands in [1, 2] (raw = base x 1.5 x gauge[0.8, 1.15] = [1.2, 2.4] -> clamp spread) with visible variation; mean rim base 1.2 < mean body base 1.65 keeps D-02 mean-body > mean-rim |
| `BODY_WIDTH_MIN` | 1.4 (was 1.7) | raw min = 1.4 x 1.5 x 0.8 = 1.68 < 2 -> W(t) survives the clamp. Composite: 1.68 / 0.18 worst-gap ~ 9 covering fills >= 6 -> 1-0.45^6 = 0.9917 >= 0.99 (composite pin is the oracle; it passed) |
| disc-step threshold | 0.05 px | see design notes (measured rounding floor) |
| cap arcs | 3 interior points per 180 deg | convexity eps 1e-4 has 2-3 orders margin vs toFixed(3) noise at these chord lengths |

## Gates (all green, bounds unchanged)

- **RED** (commit `ea9d209c`): 26 tests / 10 failed / 16 passed — all failures
  AssertionError (0 crashes); the six target pins RED on assertions against the
  current raster (evidence: `260929-t2o-RED-EVIDENCE.json`).
- **GREEN** (commit `7487575f`): `paint.bristleSeed.test.ts` +
  `paint.depositSourceShape.test.ts` = 38/38. `depositSourceShape.test.ts`
  G1-G6 needed **zero edits** (as predicted — its rules encode alpha/clamp
  shape, not the outline shape).
- **Full package suite**: 32 files / 249 passed | 3 pre-existing skips.
- **App metrics** (`depositSpeckleCapture.metrics.test.ts`): 23/23.
- **Typecheck** `pnpm --filter efx-physic-paint run check`: 0 errors.
- **Scope guard**: the `260929-t2o` commit series touches only the 4 brush
  source files (paint, footprintLanes, stroke, bristleSeed test) + `.planning/quick/260929-t2o-*`.
  Six battery files RE-RUN ONLY, never edited: physicsSettledFootprint,
  physicsWidthScaling, productionAaSettleMeasurement, depositGateFieldMeasurement,
  drying.continuity, depositSpeckleCapture.metrics.
- **Law preservation (zero bound edits)**: PIN 0 composite `[0.99, 1.01]`,
  PIN 0b `>= 0.95`, ENVELOPE_BOUND, DEPOSIT_KEEP_TIER 70, DRY_ALPHA_THRESHOLD 1,
  W1-W7, density ratio `>= 1.5`, SIZE excursion `<= 0.35`, gauge `<= 10%`,
  ink `+/- 15%`, live divisor 4. STOP rule: **not triggered** — no law-vs-look
  conflict surfaced; every pin passed at its existing bound.
- G3 single-alpha whitelist and G5 single-clamp width law unchanged. D-03/D-09
  doors did not apply. PIN 0 stayed COMPOSITE (`k_body >= 4`,
  `1-prod(1-ga) >= 0.99`), never per-fibre at k=1. ROADMAP untouched;
  `verify_phase_goal` / `update_roadmap` not run; no installs; no push; no dev
  server; `vitest run` only.

## Native UAT rows — PENDING (user's eye, no metric gate on the texture call)

- [ ] 52.4 rows a-i (unchanged from m2z)
- [ ] R7(a) edge textured at fibre scale — never smoothed, never pixel-noise
- [ ] R7(b) edge texture correlated along the fibre
- [ ] R7(c) AA of a single fibre boundary; no silhouette blurring anywhere
- [ ] **no parcellaire** — no holes inside thick spans, no hollow tube on thin spans
- [ ] **rim fibres read** at zoom 4: >= 1 px with visible `W(t)` variation along the fibre
- [ ] **NEW — live vs finalize**: the same stroke captured live and at finalize —
      silhouette and coverage continuous; the Q16 1/4-brin live tier visible as
      fewer/thicker fibres (isolates the live-tier delta; Q16 divisor itself is
      unchanged)

Re-UAT after this corrective quick. Out of this fix, still not folded in:
spread-as-thickener (wet-layer role law), Quick 8e color motif, physics buttons
(UI, later).
