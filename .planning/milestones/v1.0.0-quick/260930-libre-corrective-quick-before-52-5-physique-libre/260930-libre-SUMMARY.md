---
phase: quick-260930-libre
plan: 260930-libre
type: tdd
status: complete
tasks: 3
commits: 4
date: 2026-09-30
---

# 260930-libre SUMMARY — physique-libre (R8 revised: physics on a reduced clone, NO masking)

**AUTOMATED-READY — NOT done.** Acceptance is the user's live native UAT at
spread 60-65 against the painterly magenta target (*"before your fix / full
spread working"*). Nothing is done until that UAT passes.

## Why

260930-espace native UAT 2026-09-30: **REGRESSION (still)**. Do not push.

The reduced deposit clone was CORRECT and stays. What still killed the look
was `projectWetIntoEnvelope`, which (a) zeroed every pixel the solver carried
past the ribbon — that transport IS the edge physics we must keep — and
(b) renormalized the escaped mass onto the interior as a uniform gain
(`alpha_i × (1 + E/S)`), washing the texture into a saturated flat. Same
"effects cut to fit the thickness" defect as dy0.

**USER DESIGN ACT 2026-09-30c — PHYSICS ON A REDUCED CLONE, NO MASKING**
(spec act on disk at `SPECS/real-paint/01-brush-footprint.md` R8 revised +
`00-overview.md` Q10 — `SPECS/` is gitignored, no spec commit):

> *"calculer la physique sur un clone du stroke qui a une reduction de
> la size ... le stroke original pourra servir pour appliquer d'autres
> effets plus tard et ignore ou un garde fou"*

> *"instead of cutting/truncating it by masking"*

## The revised contract

1. Physics clone = the ONLY deposit the solver sees, at
   `size × (1 - depositRoom(spreadCurve))`. The solver runs UNCONSTRAINED —
   its outward transport is the edge physics.
2. Original stroke = the pressure geometry (8c thickness field). PRESERVED as
   the gesture record (260924-stb). Ignored by physics for now; later effects
   (granulation role 4, pigment mixing spec 03) or a SOFT guardrail may use it.
3. ZERO masking: `snapshotWetAlpha`, `projectWetIntoEnvelope`,
   `stampRibbonIntoEnvelope` and their pins are DELETED. Never clip to the
   deposit, never clip to the ribbon, never renormalize.
4. "2x thinner (à estimer)" = `depositRoom` reaches ~0.5 at the working spread
   65 and returns to 0 at rest (spread 0 still reads pressure width, matching
   the fullR live preview). `depositRoom` is the ONE look lever.

- Kept: `featherWetEdges` boundary-AA only (the solver supplies the organic
  edge now); solver ticks `Math.ceil(spreadCurve*10)` byte-unchanged (3 at 60,
  4 at 65); 260929-t2o footprint raster LOCKED.
- Accepted tradeoff: pressure width is no longer a HARD ceiling — the
  reduction factor aims at it and high spread may overshoot slightly. That is
  the price of not cutting the edge physics. If a ceiling is ever required it
  must be a soft outward fade, never a cut.

## What landed

| File | Change |
|------|--------|
| `packages/efx-physic-paint/src/core/wet-layer.libre.test.ts` | NEW — 12 pins (replaces `wet-layer.envelope.test.ts`; all 13 masking pins retired with the masking helpers) |
| `packages/efx-physic-paint/src/core/wet-layer.envelope.test.ts` | DELETED |
| `packages/efx-physic-paint/src/core/wet-layer.ts` | `snapshotWetAlpha` / `projectWetIntoEnvelope` / `stampRibbonIntoEnvelope` DELETED; `featherWetEdges` / `DEPOSIT_KEEP_TIER = 70` / all deposit transfers byte-identical |
| `packages/efx-physic-paint/src/core/spreadScale.ts` | `depositRoom` = `0.5 * min(1, sc / spreadCurveFor(65))` (2x thinner at 65, 0 at rest, capped at 0.5); `spreadCurveFor` byte-identical (260925-b7c law untouched) |
| `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` | envelope state + all snapshot/stamp/project wiring DELETED at both sites (`active.envelope` field gone; `smooth`/`resample`/`ribbonWithScales` import gone); tier=final deposit at reduced `depositR` at BOTH sites (D-07); live tier, feather calls, margin and tick arithmetic byte-unchanged |

Commits: `b61c1b82` (plan) → `40ddc9df` (RED) → `92feeb33` (GREEN) → docs close.

## Implementation contract

**Physics clone only.** Site A (interactive finalize) and Site B
(`applyStrokeToEngine`) each compute `depositR = brushRenderRadius × (1 -
depositRoom(spreadCurve))` and pass it as `size` to the ONE tier=final
`renderPaintStroke`. The tier=live raster keeps `fullR` (D-07: live writes
nothing to wet — a dry blit only). The solver therefore sees exactly one
deposit, already reduced.

**Unconstrained solver.** `createLocalFluidPhysicsContinuation` (site A) and
`localFluidPhysicsStep` (site B) run with no mask, no projection, no
renormalization. Their outward transport is the edge physics — that IS the
look the clip destroyed. Nothing follows them (the old
`projectWetIntoEnvelope` call is gone from the `phase === 'fluid'`
completion branch and from site B).

**Deposit reduction is a call-site parameter.** `paint.ts` / `stroke.ts` /
`footprintLanes.ts` are untouched (260929-t2o capsule-sweep contract LOCKED)
— the engine passes `size: depositR` to the tier=final deposit. One
`depositRoom(` call per site.

**`g` form.** `0.5 * Math.min(1, spreadCurve / spreadCurveFor(65))` —
`g(0) = 0` (spread 0 = full pressure width = the live preview), `g(0.363) = 0.5`
(spread 65 = 2x thinner before physics), capped at 0.5 so the deposit can never
invert. Tune ONLY in `spreadScale.depositRoom`.

## Pins (12)

| Pin | Role | RED assertion at base |
|-----|------|----------------------|
| `feather-empty-pixels` (law) | no EMPTY-pixel grower, all six buffers, passes=6 | green at base |
| `boundary-aa` (law) | feather still blends painted boundary alpha down | green at base |
| `helpers-deleted` | the three masking helpers are gone (exports + wet-layer source) | `expected 'function' to be 'undefined'` |
| `engine-zero-mask` | zero references to the helpers at the engine (imports included) | `expected 3 to be +0` |
| `envelope-gone` | no envelope state, local, or comment at the engine | `expected 13 to be +0` |
| `room-lever-2x` | `g(0)=0`; `g(sc65)≈0.5`; `g <= 0.5` | `expected 0.363 to be close to 0.5` |
| `deposit-is-reduced-clone` (law) | `size: depositR` == 2 (D-07 — one deposit feeds wet/physics) | green at base |
| `engine-room-lever` (law) | `depositRoom(` == 2 | green at base |
| `solver-wired` (law) | both solvers run, nothing wraps or follows them | green at base |
| `ticks-unchanged` (law) | `Math.ceil(spreadCurve * 10)` x2 — 3@60 / 4@65 / 1@50 | green at base |
| `margin-formula` (law) | `waterCurve * brushR * 0.6 + spreadCurve * brushR * 0.4` x2 | green at base |
| `feather-wired` (law) | `featherWetEdges(` x2 | green at base |

Retired with the masking layer (13): `projectWetIntoEnvelope` exported,
`renormalized`, `identity`, `never-clip-to-deposit`, `clip-past-ribbon`,
`existing-mass-kept`, `stampRibbonIntoEnvelope` exported, `stamp-marks-ribbon`,
`stamp-preserves-outside`, `engine-stamped`, `engine-wired`, `snapshot-before`,
`stamp-before`.

## Gates (all green, bounds unchanged)

- **RED** (`40ddc9df`): 12 tests / 4 failed / 8 passed — all failures
  AssertionError (0 crashes); the four target pins RED on assertions against
  the current tree (evidence: `260930-libre-RED-EVIDENCE.json`).
- **GREEN** (`92feeb33`): `wet-layer.libre.test.ts` = 12/12.
- **Full package suite**: 33 files / 261 passed | 3 pre-existing skips
  (battery files re-ran UNCHANGED: physicsSettledFootprint,
  physicsWidthScaling, productionAaSettleMeasurement,
  depositGateFieldMeasurement, drying.continuity, paint.bristleSeed,
  paint.depositSourceShape).
- **App metrics** (`depositSpeckleCapture.metrics.test.ts`): 23/23.
- **Typecheck** `pnpm --filter efx-physic-paint run check`: 0 errors.
- **Scope guard**: the `260930-libre` commit series touches ONLY
  `spreadScale.ts`, `wet-layer.ts`, `wet-layer.libre.test.ts` (new),
  `wet-layer.envelope.test.ts` (deleted), `EfxPaintEngine.ts` +
  `.planning/quick/260930-libre-*`. Footprint files (`paint.ts`,
  `footprintLanes.ts`, `stroke.ts`), `fluids.ts`, battery files, ROADMAP.md,
  `package.json`, `pnpm-lock.yaml` all absent. `OUT_OF_SCOPE_COUNT=0`.
- **Law preservation (zero bound edits)**: PIN 0 composite `[0.99, 1.01]`,
  PIN 0b `>= 0.95`, DEPOSIT_KEEP_TIER 70, DRY_ALPHA_THRESHOLD 1,
  LIVE_TIER_DIVISOR 4, LIVE_WIDTH_MUL 4, STREAK_ALPHA 0.55, WIDTH_FLOOR 0.5,
  RIM_WIDTH_MIN 1.0, CORE_MAX_TRACE_WIDTH 2, BODY_WIDTH_MIN 1.4 (R7-amended
  semantics), density ratio `>= 1.5`, SIZE excursion `<= 0.35`, gauge `<= 10%`,
  ink `+/- 15%`, spread scale (260925-b7c: new 50 = old 30) — `spreadCurveFor`
  byte-identical. ENVELOPE_BOUND is superseded by this act (the hard ceiling is
  retired — see the tradeoff); it was not retuned, it was removed with the
  masking layer.
  STOP rule: **not triggered** — no law-vs-look conflict surfaced.
- D-03 (soft-fill) and D-09 (baked lateral alpha) did NOT apply — feather
  stays boundary AA. PIN 0 stayed COMPOSITE (`k_body >= 4`,
  `1-prod(1-ga) >= 0.99`), never per-fibre at k=1. ROADMAP untouched;
  `verify_phase_goal` / `update_roadmap` not run; no installs; no push; no dev
  server; `vitest run` only.

## Accepted tradeoff (recorded in spec 01 R8)

Pressure width is no longer a HARD ceiling. The reduction factor aims at it
and high spread may overshoot slightly — that is the price of not cutting the
edge physics. Watercolour bleed past the stroke (capillary wicking) is back.
If a ceiling is ever required it must be a **soft outward fade**, never a cut.

## Kept measure-only (NOT implemented)

Fallback if edges still read uniform once the clip is gone and the reduced
clone is in place: per-fibre length variation and `W(t)` surviving the 2 px
clamp. The footprint raster algorithms were not touched by this act.

## Deferred to 52.5 (its actual scope, R2/R3 — not folded in)

Gesture coupling (pressure = pigment load + envelope, velocity = diffusion
distance + dry-out gaps, angle = diffusion anisotropy); charge / dry brush;
erase same-family. The preserved pressure geometry (8c thickness field) is the
input later effects (granulation role 4, pigment mixing spec 03) or a SOFT
guardrail may use — not this act.

## Native UAT rows — PENDING (the user's eye at spread 60-65)

- [ ] **Painterly relief recovered** — the "full spread working" look reads:
      mass transport at the edge, interior stays textured (never a saturated
      flat)
- [ ] **Max spread is visibly richer than min spread**
- [ ] **Residual pixel-noise gone**
- [ ] **Felt-tip uniformity improved** — the edge reads as a brush
- [ ] Solver ticks visibly unchanged in behavior (3 at 60 / 4 at 65)
- [ ] `g` look lever judged — if the stroke reads too thin, reduce `g`
      (toward 0.35-0.4 at 65); if it still reads thin-and-flat, increase it;
      one form in `spreadScale.depositRoom`. The 2x-thinner value is *à
      estimer* — your eye is the calibration.
- [ ] Slight width overshoot at high spread judged acceptable (the named
      tradeoff) — or flagged if it reads wrong
- [ ] t2o rows still standing: capsule sweep / no parcellaire / rim fibres
      read / R7 look a/b/c / live-vs-finalize
- [ ] 52.4 rows a-i

Re-UAT after this corrective quick. Nothing is done until that UAT passes.

Note: the dy0 series (`3ea4e5f8..32242ccb`), the espace series
(`71fa8521..4917b5a6`) and this series stay LOCAL until the look is back —
the user pushes.
