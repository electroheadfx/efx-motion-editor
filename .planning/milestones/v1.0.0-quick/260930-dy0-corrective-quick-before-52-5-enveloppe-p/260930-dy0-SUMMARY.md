---
phase: quick-260930-dy0
plan: 260930-dy0
type: tdd
status: complete
tasks: 3
commits: 3
date: 2026-09-30
---

# 260930-dy0 SUMMARY — enveloppe-pression (R8 hard ceiling)

**AUTOMATED-READY — NOT done.** Acceptance is the user's live native UAT at
spread 60-65 against the envelope law (width does not grow; interior contrast
reads; pixel-noise gone; felt-tip improved). Nothing is done until that UAT
passes.

## Why

260929-t2o native UAT 2026-09-30: **PARTIAL PASS**. The parcellaire regression
is gone and the capsule sweep holds (t2o contract LOCKED — untouched here), but
the look rows are still open:

- Default look reads as a **felt-tip**, not a brush (*"les bords sont devenus
  assez uniformes"*), with residual pixel-like noise.
- Spread at 60-65 gives the wanted painterly look, without pixels, **BUT**
  amplifies stroke thickness.

**USER DESIGN ACT 2026-09-30 — THE ENVELOPE LAW** (spec act on disk at
`SPECS/real-paint/01-brush-footprint.md` R8 + `00-overview.md` Q10 —
`SPECS/` is gitignored, no spec commit):

> The pressure-defined stroke thickness is the MAXIMUM thickness.
> Everything happens INSIDE that thickness. Spread must never widen
> the stroke; it redistributes mass within the envelope.

`spreadCurveFor(50) = 0.09` — the default does almost nothing; the felt-tip
look is largely spread at rest, not only the t2o footprint.

Three widening mechanisms (user-verified, re-verified against the tree):

1. `featherWetEdges` (`core/wet-layer.ts`) painted into EMPTY pixels at
   `frac = 0.35`, `antiAlias*2` passes = 2/4/6 (`EfxPaintEngine.ts:2332`,
   `:2611`) — extended the silhouette ~2-6 px (in tension with R7c).
2. Compute margin grew with spread — `margin = 2 + waterCurve*brushR*0.6 +
   spreadCurve*brushR*0.4` (`:2364`, `:2648`) — letting physics act past the
   deposit. **Left byte-unchanged** (it is the compute window; the battery
   mirrors it). The ceiling is enforced by the projection, not by shrinking
   the domain.
3. Physics ticks = `Math.ceil(spreadCurve*10)` = 3 at 60, 4 at 65 (`:2373`,
   `:2655`) — each tick advects mass outward. **Kept** — they are the source
   of the #144 organic look.

## What landed

| File | Change |
|------|--------|
| `packages/efx-physic-paint/src/core/wet-layer.envelope.test.ts` | NEW — 10 RED/law pins (see below) |
| `packages/efx-physic-paint/src/core/wet-layer.ts` | `featherWetEdges` rewritten to boundary AA only (never an outward grower); `snapshotWetAlpha` + `projectWetIntoEnvelope` added; `DEPOSIT_KEEP_TIER = 70` byte-identical (G6 raw-read) |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` | `envelope?: Float32Array \| null` on `ActiveStrokeFinalization`; snapshot strictly BEFORE the solver and projection strictly AFTER at BOTH local-physics sites; feather call sites, margin and tick arithmetic byte-unchanged |

Commits: `3ea4e5f8` (plan) → `2ddd61a4` (RED) → `6ef6ee9c` (GREEN) → docs close.

## Implementation contract

**featherWetEdges = boundary AA only.** Skip every pixel with `alpha <= 1`
entirely (never read for write, never written — no alpha, no color, no
wetness, no strokeOpacity, no halo). For a PAINTED pixel with >= 1 empty
orthogonal neighbor: alpha-only blend `newA = a + 0.35 * (mean4 - a)` where
`mean4` is the 4-neighbor mean with empty neighbors contributing 0. Pixels
with four painted neighbors untouched. All other arrays untouched.

**projectWetIntoEnvelope = HARD ceiling + renormalization.** Pass 1 collects
ESCAPED pixels (`envelope[i] <= 1 && wet.alpha[i] > 1`) and `escapedTotal`.
`escapedTotal <= 0` → identity return (zero writes, no float drift). Pass 2
redistributes `escapedTotal * (alpha[i] / interiorSum)` onto envelope-interior
pixels (same `Math.min(200000, …)` cap as the deposit family), then zeroes
every escaped pixel's alpha, wetness and strokeOpacity. If `interiorSum <= 0`
the escaped pixels are still zeroed — the ceiling is hard.

**Wiring (both sites, order is the law).** Site A (interactive finalize):
`active.envelope = snapshotWetAlpha(this.wet)` immediately BEFORE
`createLocalFluidPhysicsContinuation(`; projection in the
`phase === 'fluid' && active.fluid?.step()` completion branch, before
`startNaturalDrying()`. Site B (synchronous local step):
`const envelope = snapshotWetAlpha(this.wet)` immediately BEFORE
`localFluidPhysicsStep(`; `projectWetIntoEnvelope(this.wet, envelope)` after
the `paint-local-fluid-total` observe call. A reversed or missing order would
snapshot the grown state and legitimize the growth — the `snapshot-before`
nth-occurrence pin is the guard.

## Pins (10)

| Pin | Role | RED assertion at base |
|-----|------|----------------------|
| `feather-empty-pixels` | no EMPTY-pixel grower, all six buffers, passes=6 | `expected 1.8382656574249268 to be +0` (halo alpha propagated outward) |
| `boundary-aa` | feather still blends painted boundary alpha down; interior untouched | `expected 1000 to be less than 1000` (base never touches painted pixels) |
| `projectWetIntoEnvelope` | exported (typeof-first guard) | `expected 'undefined' to be 'function'` |
| `renormalized` | escaped zeroed, mass conserved, interior rises, deterministic | `expected 'undefined' to be 'function'` |
| `identity` | zero escape → byte-identical | `expected 'undefined' to be 'function'` |
| `engine-wired` | `snapshotWetAlpha(` == 2 and `projectWetIntoEnvelope(` == 2 | `expected +0 to be 2` |
| `snapshot-before` | nth-occurrence chain strictly increasing at both sites | `expected -1 to be greater than -1` |
| `ticks-unchanged` (law) | `Math.ceil(spreadCurve * 10)` x2 — 3@60 / 4@65 / 1@50 | green at base |
| `margin-formula` (law) | `waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4` x2 | green at base |
| `feather-wired` (law) | `featherWetEdges(` x2 | green at base |

## Gates (all green, bounds unchanged)

- **RED** (`2ddd61a4`): 10 tests / 7 failed / 3 passed — all failures
  AssertionError (0 crashes); the seven target pins RED on assertions against
  the current raster (evidence: `260930-dy0-RED-EVIDENCE.json`).
- **GREEN** (`6ef6ee9c`): `wet-layer.envelope.test.ts` +
  `paint.depositSourceShape.test.ts` = 22/22 (G6 `DEPOSIT_KEEP_TIER = 70`
  raw-read needed zero edits).
- **Full package suite**: 33 files / 259 passed | 3 pre-existing skips
  (battery files re-ran UNCHANGED: physicsSettledFootprint,
  physicsWidthScaling, productionAaSettleMeasurement,
  depositGateFieldMeasurement, drying.continuity, paint.bristleSeed,
  paint.depositSourceShape).
- **App metrics** (`depositSpeckleCapture.metrics.test.ts`): 23/23.
- **Typecheck** `pnpm --filter efx-physic-paint run check`: 0 errors.
- **Scope guard**: the `260930-dy0` commit series touches ONLY
  `wet-layer.ts`, `wet-layer.envelope.test.ts`, `EfxPaintEngine.ts` +
  `.planning/quick/260930-dy0-*`. Footprint files (`paint.ts`,
  `footprintLanes.ts`, `stroke.ts`), `fluids.ts`, battery files, ROADMAP.md,
  `package.json`, `pnpm-lock.yaml` all absent.
- **Law preservation (zero bound edits)**: PIN 0 composite `[0.99, 1.01]`,
  PIN 0b `>= 0.95`, ENVELOPE_BOUND, DEPOSIT_KEEP_TIER 70,
  DRY_ALPHA_THRESHOLD 1, W1–W7, WIDTH_FLOOR 0.5 / rim `>= 1 px` /
  CORE_MAX_TRACE_WIDTH 2 (R7-amended semantics), density ratio `>= 1.5`,
  SIZE excursion `<= 0.35`, gauge `<= 10%`, ink `+/- 15%`, live divisor 4,
  spread scale (260925-b7c: new 50 = old 30). STOP rule: **not triggered** —
  no law-vs-look conflict surfaced; every pin passed at its existing bound.
- D-03 (soft-fill) and D-09 (baked lateral alpha) did NOT apply — feather
  stops growing the silhouette; it does not soften the fibre fill. PIN 0
  stayed COMPOSITE (`k_body >= 4`, `1-prod(1-ga) >= 0.99`), never per-fibre
  at k=1. ROADMAP untouched; `verify_phase_goal` / `update_roadmap` not run;
  no installs; no push; no dev server; `vitest run` only.

## Accepted tradeoff (recorded in spec 01 R8)

A hard envelope removes watercolour bleed past the stroke (capillary
wicking). If wanted later, it becomes a separate **gesture-driven lever in
52.5**, never a passive spread growth.

## Kept measure-only (NOT implemented)

Fallback if edges still read uniform after re-UAT: per-fibre length variation
and `W(t)` surviving the 2 px clamp. The footprint raster was not touched by
this act.

## Deferred to 52.5 (its actual scope, R2/R3 — not folded in)

Gesture coupling (pressure = pigment load + envelope, velocity = diffusion
distance + dry-out gaps, angle = diffusion anisotropy); charge / dry brush;
erase same-family.

## Native UAT rows — PENDING (user's eye at spread 60-65)

- [ ] **Envelope law**: stroke width does NOT grow past the pressure-defined
      envelope at spread 60-65
- [ ] **Interior contrast / painterly relief reads** — the relief is mass
      redistribution inside the envelope, never widening
- [ ] **Residual pixel-noise gone**
- [ ] **Felt-tip uniformity improved** — the edge reads as a brush
- [ ] Solver ticks visibly unchanged in behavior (3 at 60 / 4 at 65) — the
      #144 organic look is preserved
- [ ] t2o rows still standing: capsule sweep / no parcellaire / rim fibres
      read / R7 look a/b/c / live-vs-finalize
- [ ] 52.4 rows a-i

Re-UAT after this corrective quick. Nothing is done until that UAT passes.
