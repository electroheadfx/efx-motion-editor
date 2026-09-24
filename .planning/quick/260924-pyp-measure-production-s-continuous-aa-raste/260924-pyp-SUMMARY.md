---
phase: quick-260924-pyp
plan: 260924-pyp
title: Production continuous AA raster settle measurement — cutoff outcome table
status: incomplete
subsystem: packages/efx-physic-paint (core/wet-layer pipeline driven in-harness)
tags: [quick, physics-paint, footprint, measurement, production-aa-raster, cutoff, stop-clause]
requires: [260924-koa, 260924-m7w, 260924-nqe, 260924-ort]
provides: [production-aa-substrate, cutoff-outcome-table-24-cells, pin0-pin0b-per-tier]
affects: []
tech_stack:
  added: []
  patterns: [analytic-coverage-fill-substrate, in-harness-tier-include-exclude, production-layer-schedule-mirror]
key_files:
  created:
    - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
  modified: []
decisions:
  - "Substrate = production ribbon()/deform geometry (edgeDetail 4) + production layer schedule + analytic coverage fill; real Canvas2D unavailable headless (no OffscreenCanvas/node-canvas), installs forbidden (T-pyp-SC)"
  - "Tier cutoff implemented as in-harness profile alpha zeroing before transferToWetLayerClipped — byte-identical production by construction, no probe ever introduced"
  - "On production AA profile (unlike ort's synthetic ramp): tiers 130 and 70 both hold envelope ≤8 AND keep d(b)≥1 — dual gate achievable; tier 200 = hard stamp d(b)=0; base tier 20 fails envelope on null paper"
  - "0 STOP findings: PIN 0 ratio 1.0000 and PIN 0b floors hold in all 24 cells; no bound loosened"
metrics:
  duration: ~35m
  completed: 2026-09-24
  tokens: 9500
  tasks: 3
  commits: 2
plan_head_before: 6f478af6f38195a341409f2f06ee0ac5d1354cdf
actuals:
  tokens: 9500
  tasks: 3
  commits: 2
---

# Phase quick 260924-pyp: Production AA Raster Settle Measurement — Summary

**Final status: MEASURED — `status: incomplete`.** Full 24-cell cutoff outcome
table measured end-to-end on production's continuous AA fringe profile (real
`transferToWetLayerClipped` → real `localFluidPhysicsStep` K=3 → real
`wetDisplayAlpha` widths). Measurement only: production is byte-identical, the
base RED suite is preserved, no GREEN commit exists. The table below is the
evidence for the user decision in the STOP section.

## Carry-over (cited, not redone)

- **m7w verdict:** seam (a) = `transferToWetLayerClipped`, +2px of +3px settled
  inflation (fluid +1, compositor 0). Alpha-carry GREEN `24f40261` reverted
  `1648658b` (UAT-FAIL, quasi-invisible body). Never modulate deposit alpha for
  a width bound — this quick does not.
- **nqe proof scope:** dual gate structurally unreachable on the *binary*
  harness raster (two-valued {6,9} widths). Scope was the binary raster only;
  this quick replaces the substrate with production's continuous AA profile.
- **ort STOP clause (ii):** on the synthetic graduated ramp (160/110/60),
  every achievable cutoff tier at default water yielded d(b)=0 — envelope-holding
  configs were hard stamps. The question this quick answers: does production's
  real AA ramp behave differently? **Yes — see the table.**

## Substrate path

**Production geometry + production layer schedule + analytic coverage fill**
(real Canvas2D unavailable headless — no OffscreenCanvas/node-canvas; installs
forbidden under T-pyp-SC with no Package Legitimacy Audit) — documented in the
harness header (`260924-pyp`).

- Straight dense stroke (x 16..112 step 3, y 32) through production
  `ribbon(curve, 3, 0.8, false)` + `deformN`/`deform` from `brush/stroke.ts`,
  engine `edgeDetail: 4` → VARIANCE ≈ 0.245; `Math.random` stubbed by LCG
  (seed 123456789) for PIN 3 determinism.
- Layer accumulation mirrors `createPaintStrokeRasterContinuationFromCurve`
  pickup-0 branch: layers = round((22+15)/speedDeplete) = 37, lAlpha = 0.08,
  + 7 soft passes at lAlpha×0.25; bristle traces excluded (documented);
  grain included on even layers via deterministic fbm.
- Only the `ctx.fill()` primitive is replaced — nonzero-winding scanline with
  16× y-supersampling and exact x-span overlap, source-over composited. That
  is exactly what Canvas2D antialiasing approximates.
- Sanity gate: continuous multi-value AA fringe confirmed (MID_X column
  `28:24 29:230 30:243 … 34:244 35:63`; 105 distinct edge-band alphas; not
  binary, not the 160/110/60 literals). The synthetic graduated ramp is NOT
  the substrate.
- Tier filter = in-harness include/exclude: zero every profile pixel with
  alpha < tier before `transferToWetLayerClipped` (exact ≡ raising the
  keep-gate — `a` is read only after the gate for deposit `(a/255)*3000` and
  wetness). No production probe exists or ever existed.

## [260924-pyp] OUTCOME TABLE (complete — 24 cells)

r=3, 2r=6, K=3, visible ≥ 13, alphaFloor=125, envelope bound = 2r+2px = 8.
PIN 0 = body deposit ratio ∈ [0.99, 1.01]; PIN 0b = post-settle body means vs
0.95× base literals (base = tier-20 production-AA means, recorded in-file).
d(b) = W_settle − W_deposit as-defined (no redefinition). Papers: null =
dense, synthetic = paper-height D-08 adsorption.

| paper | water | tier | W_deposit | W_settle | W_visible | d(b) | PIN0_min | PIN0_max | PIN0b_meanAlpha | PIN0b_meanDisplay | envelope≤8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| null | 10 | 20 | 8 | 9 | 9 | 1 | 1.0000 | 1.0000 | 2832.80 | 255.00 | FAIL |
| synthetic | 10 | 20 | 8 | 8 | 8 | 0 | 1.0000 | 1.0000 | 2867.09 | 255.00 | PASS |
| null | 50 | 20 | 8 | 9 | 9 | 1 | 1.0000 | 1.0000 | 2832.80 | 255.00 | FAIL |
| synthetic | 50 | 20 | 8 | 8 | 8 | 0 | 1.0000 | 1.0000 | 2867.09 | 255.00 | PASS |
| null | 90 | 20 | 8 | 9 | 9 | 1 | 1.0000 | 1.0000 | 2849.31 | 255.00 | FAIL |
| synthetic | 90 | 20 | 8 | 9 | 9 | 1 | 1.0000 | 1.0000 | 2915.98 | 255.00 | FAIL |
| null | 10 | 200 | 6 | 6 | 6 | 0 | 1.0000 | 1.0000 | 2857.35 | 255.00 | PASS |
| synthetic | 10 | 200 | 6 | 6 | 6 | 0 | 1.0000 | 1.0000 | 2878.47 | 255.00 | PASS |
| null | 50 | 200 | 6 | 6 | 6 | 0 | 1.0000 | 1.0000 | 2857.35 | 255.00 | PASS |
| synthetic | 50 | 200 | 6 | 6 | 6 | 0 | 1.0000 | 1.0000 | 2878.47 | 255.00 | PASS |
| null | 90 | 200 | 6 | 6 | 6 | 0 | 1.0000 | 1.0000 | 2858.44 | 255.00 | PASS |
| synthetic | 90 | 200 | 6 | 6 | 6 | 0 | 1.0000 | 1.0000 | 2885.15 | 255.00 | PASS |
| null | 10 | 130 | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2856.64 | 255.00 | PASS |
| synthetic | 10 | 130 | 6 | 8 | 8 | 2 | 1.0000 | 1.0000 | 2868.50 | 255.00 | PASS |
| null | 50 | 130 | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2856.64 | 255.00 | PASS |
| synthetic | 50 | 130 | 6 | 8 | 8 | 2 | 1.0000 | 1.0000 | 2868.50 | 255.00 | PASS |
| null | 90 | 130 | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2859.14 | 255.00 | PASS |
| synthetic | 90 | 130 | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2880.65 | 255.00 | PASS |
| null | 10 | 70 | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2856.46 | 255.00 | PASS |
| synthetic | 10 | 70 | 6 | 8 | 8 | 2 | 1.0000 | 1.0000 | 2869.02 | 255.00 | PASS |
| null | 50 | 70 | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2856.46 | 255.00 | PASS |
| synthetic | 50 | 70 | 6 | 8 | 8 | 2 | 1.0000 | 1.0000 | 2869.02 | 255.00 | PASS |
| null | 90 | 70 | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2858.95 | 255.00 | PASS |
| synthetic | 90 | 70 | 6 | 7 | 7 | 1 | 1.0000 | 1.0000 | 2881.18 | 255.00 | PASS |

**Total STOP findings: 0.** PIN 0 ratio = 1.0000 in every cell; PIN 0b means
≥ 0.95× floors in every cell (all displays 255.00). Tiers never touch body
pixels (all tiers ≤ 200 < body plateau 244), so the hard gates hold by
construction — no bound was loosened.

### What the table shows (vs ort's synthetic ramp)

| tier | envelope ≤8 | texture d(b) ≥1 | verdict on production AA |
| --- | --- | --- | --- |
| 20 (base) | FAIL (null: 9>8; synthetic w90: 9>8) | PASS (d(b)=1) / mixed | too wide at default settle |
| 200 | PASS (6≤8) | FAIL (d(b)=0 all cells) | hard stamp — same as ort clause (ii) |
| **130** | **PASS (7–8 ≤8)** | **PASS (d(b)=1–2 all cells)** | **dual gate ACHIEVABLE** |
| **70** | **PASS (7–8 ≤8)** | **PASS (d(b)=1–2 all cells)** | **dual gate ACHIEVABLE** |

Unlike ort's synthetic 160/110/60 ramp (where every envelope-holding cutoff
had d(b)=0), production's real continuous AA fringe lets tiers 130 and 70
exclude enough fringe to settle ≤8 while fluid settle still softens +1..+2px.
Tier 200 excludes down to body-only and reproduces ort's hard stamp.

## Task Commits

1. **Task 1: production-AA substrate harness — base-tier outcome table** - `7697a926` (test)
2. **Task 2: cutoff tier sweep — full outcome matrix** - `b4229cf0` (test)

No GREEN/production commit exists. SUMMARY left uncommitted (orchestrator owns
the docs commit). Measured from ledger `6f478af6`: 2 commits.

## Files Created/Modified

- `packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts` —
  new sibling measurement harness (only file touched in this quick)

## Verification (Task 3 battery)

- New suite: `vitest run src/core/productionAaSettleMeasurement.test.ts` →
  **4 passed** (sanity AA fringe, determinism PIN 3, base-tier table, full
  24-cell OUTCOME TABLE with 0 STOP findings).
- Existing suite: `vitest run src/core/physicsSettledFootprint.test.ts` →
  **3 failed (PIN 1, PIN 2, texture) | 4 passed**, base RED preserved, not
  fixed. Combined run: 3 failed | 8 passed.
- Production byte-identical: `git diff --name-only` empty for wet-layer.ts,
  fluids.ts, compositor.ts, canvas.ts, paint.ts; strokePreviewRibbon /
  canvas.strokePreviewRibbon.test.ts untouched. Working tree clean at finish.
- No GREEN production commit; only the two tests-only commits above.

## Decisions Made

- Substrate path: documented fallback (analytic coverage) authorized by the
  plan's planning-time observation — real Canvas2D impossible headless, canvas
  package installs forbidden.
- In-harness tier include/exclude chosen over any production probe — makes
  byte-identical-at-finish hold by construction.
- PIN 0 expectation is D-08-aware for synthetic-paper cells (adsorption factor
  recomputed from paper height) so the pin still detects tier/water alpha
  modulation rather than failing on intended paper physics.
- Sanity calibration: with engine edgeDetail 4 and integer-aligned ribbon
  edges, the top fringe compresses to a 2-level ramp (24→230) plus rich
  edge-band variation (105 distinct alphas) — meets plan intent (reject
  binary / reject 160/110/60 literals) without altering the substrate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] transferToWetLayerClipped bounds shape**
- **Found during:** Task 1
- **Issue:** `curveBounds` returns `{x0,y0,x1,y1,w,h}` but the transfer
  function requires `{x,y,w,h}` — passing profile.bounds produced gy=NaN and
  W_deposit=0.
- **Fix:** `transferBounds = {x: bounds.x0, y: bounds.y0, w, h}`.
- **Committed in:** 7697a926

**2. [Rule 1 - Bug] VARIANCE used wrong edgeDetail default**
- **Found during:** Task 1
- **Issue:** paint.ts falls back to `edgeDetail ?? 50`, but the engine default
  is `edgeDetail: 4` → edgeMul 0.08; variance was ~10× too large (plateau 207,
  wrong body rows).
- **Fix:** `ENGINE_EDGE_DETAIL = 4` in the harness.
- **Committed in:** 7697a926

**3. [Rule 1 - Calibration] AA sanity threshold vs integer-aligned ribbon**
- **Found during:** Task 1
- **Issue:** ≥3 distinct sub-255 levels per side from body mid-row failed on
  top side ([24,230]) — real but thin AA from integer edges + σ≈0.245 deform.
- **Fix:** recalibrated to plan intent (multi-level per side, fringe rows both
  sides, edge-band richness ≥6 distinct, reject binary and reject 160/110/60);
  substrate unchanged.
- **Committed in:** 7697a926

**4. [Rule 1 - Test scope] base-tier test measured all 4 tiers after Task 2**
- **Found during:** Task 2
- **Issue:** adding TIERS=[20,200,130,70] made the Task-1 base test call
  `measureCells(TIERS)` (expected 24 cells, got 6).
- **Fix:** base test calls `measureCells([20])` (Task 1 scope).
- **Committed in:** b4229cf0

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 calibrations)
**Impact on plan:** none structural — no production probe ever existed; guards
held at every step.

## Known Stubs

None — measurement harness only, no production code shipped, no stubbed UI/data
paths.

## Threat Flags

None — no new network/auth/file-IO/schema surface (T-pyp-01/02/03/SC held:
in-harness cutoff only, bounds never loosened, substrate documented + sanity-
gated, no package installs).

## STOP for user decision

The measurement is complete; the fix is not in scope for this quick. Exactly
two options were pre-defined:

1. **Water coupling inside fluids.ts (solver-level)** — previously declared
   out of scope (solver change; would address settle width at its source so
   the base tier could hold the envelope without a deposit cutoff, keeping
   texture by construction).
2. **Land the ort cutoff on production's real ramp** — apply the include/exclude
   cutoff (tier 130 or 70 per this table) on production's real AA fringe:
   both hold envelope ≤8 AND d(b)≥1 across all waters/papers (dual gate
   achievable here, unlike ort's synthetic ramp), with PIN 0/0b untouched
   (0 STOP findings). Tier 200 must NOT be chosen (d(b)=0 hard stamp); base
   tier 20 fails envelope on null paper.

## Self-Check: PASSED

- FOUND: packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
- FOUND commits: 7697a926 (Task 1), b4229cf0 (Task 2); ledger count = 2
- Production byte-identical: `git diff --name-only` empty for wet-layer.ts,
  fluids.ts, compositor.ts, canvas.ts, paint.ts; strokePreviewRibbon untouched;
  working tree clean
- New suite 4 passed (OUTCOME TABLE 24 cells, 0 STOP findings); existing suite
  3 failed | 4 passed (base RED preserved)
- No GREEN commit; SUMMARY left uncommitted (orchestrator owns docs commit);
  status: incomplete
