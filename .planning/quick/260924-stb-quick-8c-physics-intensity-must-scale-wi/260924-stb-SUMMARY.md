---
phase: quick-260924-stb
plan: 260924-stb
status: complete
subsystem: efx-physic-paint/core
tags: [physics, fluids, width-scaling, tdd, falsification, neighborhood-field, carrier-revision]
requires: [QUICK-260924-STB]
provides: []
affects: [efx-physic-paint/settle]
tech-stack:
  added: []
  patterns: [tdd-red-green, velocity-source-modulation, bound-sweep-falsification, neighborhood-mean-field]
key-files:
  created:
    - .planning/quick/260924-stb-quick-8c-physics-intensity-must-scale-wi/260924-stb-VERDICT.md
    - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts
  modified:
    - packages/efx-physic-paint/src/core/fluids.ts # neighborhood mean-thickness field carrier (mean min(h,v)-run, R=2, knee 4/6, residual 0.25)
decisions:
  - Carrier (c): run-length width field from raster alpha, equalization-only f(localWidth)
  - Option 1 re-calibration (both substrates, W6 first-class) — FALSIFIED: no scalar f(run) bound pair passes W1–W6
  - Carrier revision (orchestrator option 1): neighborhood mean-thickness field, R=2 unique passing radius, knee (4,6), residual 0.25 — joint satisfiability HOLDS (2/122 sweep)
  - W1/W3 never weakened; W7 field-law pin added pre-RED; GREEN at 6341afba
metrics:
  duration: session
  completed: 2026-09-25
  actuals:
    tokens: 17600
    tasks: 7
    commits: 7
estimate:
  tokens: 42000
  tasks: 3
plan_head_before: a5abd04733e20c410788b85a99e31904f8f5bd71
---

# Phase quick-260924-stb Plan 260924-stb Summary

Physics intensity now scales with local stroke width via a **neighborhood mean-thickness
equalization field**: `f = 0.25 + 0.75·clamp((T−4)/2, 0, 1)` where `T` is the mean
`min(h-run, v-run)` over inside cells (`alpha > 20`) in the 5×5 Chebyshev box (R=2),
computed once per settle before tick 0 and applied only at the height-equalization
sources in the local fluid continuation. The falsified scalar `f(run)` law (falsification
append `d04f6068`) is replaced; the re-diagnosis argued joint satisfiability on
measurement (2/122 candidates pass the full pin set) and was committed as `fcd0b0fe`
before any production code. **All pins W1–W7 + PIN 0/0b + determinism + footprint +
legacy pyp GREEN. No pin bound was ever weakened.**

## Completed Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | DIAGNOSIS — verdict, carrier, bounds | 2cc9021e | `260924-stb-VERDICT.md` (6 sections, `VERDICT: START`) |
| 2 | RED — width→physics contract pins (W1–W5) | 07b2e090 | `packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts` |
| 2b | RED — W6 production texture pin (Option 1) | 30541402 | `physicsWidthScaling.test.ts` (W6 first-class; W1–W5 tolerances unchanged) |
| 2c | Docs — re-calibration cycle FALSIFIED append | d04f6068 | `260924-stb-VERDICT.md` (+108 lines, history preserved) |
| 3a | Docs — re-diagnosis append, joint satisfiability HOLDS | fcd0b0fe | `260924-stb-VERDICT.md` (+182 lines: field law, R=2 calibration, W7 bounds pre-RED, cost bound, identity V1/V2 + 2 record corrections) |
| 3b | RED — W7 neighborhood field-law pin | b7acf990 | `physicsWidthScaling.test.ts` (+102; W1–W6 byte-untouched; RED: no `buildWidthScaleField` export) |
| 3c | GREEN — neighborhood mean-thickness field carrier | 6341afba | `fluids.ts` (+109: `buildWidthScaleField` exported, `fScale` on `addHeightEqualization`, wired into local continuation pre-tick 0) |

Plan-head ledger base: `a5abd04733e20c410788b85a99e31904f8f5bd71`; measured commits: 7.

## Final pin table (tree at 6341afba)

| Pin | Bound | Result |
| --- | ----- | ------ |
| W1 hairline tol 3.0 px | max thin excess ≤ 3.0 | **PASS** (excess 0.975–1.975, all 6 cells; base had 2 cells at 3.975) |
| W2 thick d(b) ≥ 1 @ w50 (control) | ≥ 1 both papers | **PASS** (null 1 / syn 2 — base values, zero margin consumed) |
| W3 monotone physics inflation thin ≤ thick | all cells | **PASS** (thinPhys −0.494…0 ≤ thickPhys 0.050–0.101, all 6 cells; base failed 5) |
| W4 PIN 0 ratio | ∈ [0.99, 1.01] | **PASS** (ratio 1.0000 — deposit untouched) |
| W4 PIN 0b body means | ≥ 0.95× base literals | **PASS** (minBody 0.9994) |
| W5 determinism | 2 runs byte-identical × 6 cells | **PASS** (field is a pure function of the deposit) |
| W6 production texture d(b) ≥ 1 | every water × both papers | **PASS** (d(b) = 1 in all 6 cells; base 1/1/1, 2/2/1 held) |
| W7a thick-edge min f | ≥ 0.99 | **PASS** (measured 1.0, both papers) |
| W7b hairline cols 40–46 max f | ≤ 0.30 | **PASS** (measured 0.25, both papers) |
| W7c production cols 40–90 min f | ≥ 0.80 | **PASS** (measured 0.875, both papers) |
| physicsSettledFootprint | 4 passed + 3 skipped | **PASS** |
| pyp legacy (productionAaSettleMeasurement) | 7/7 incl. rm2 texture pin | **PASS** (7 passed; substrate base d(b) tables match W6 cell-for-cell) |
| Full package vitest run | only pre-existing failure allowed | **PASS** — 156 passed / 3 skipped; sole failure `EfxPaintEngine.liveAlphaCache.test.ts` verified failing at HEAD base too (pre-existing, deferred since 260924-koa) |
| Locked-file guardrail diffs (canvas, compositor, stroke, paint, drying, wet-layer, package.json, pnpm-lock) | EMPTY | **PASS** |
| DEPOSIT_KEEP_TIER = 70 | intact | **PASS** (wet-layer.ts untouched) |

## Field construction (one-liner)

`f(c) = 0.25 + 0.75·clamp((T(c)−4)/2, 0, 1)` with `T(c)` = mean of
`min(h-run, v-run)` over `alpha > 20` cells in the clamped 5×5 Chebyshev box (R=2) of
`c`, built once per settle from `wet.alpha` before tick 0 — pure/deterministic
(no RNG/clock), cost O(25N), applied only at `addHeightEqualization` sources in the
local continuation (`f ≡ 1` path byte-identical to the unmodulated law).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prior SUMMARY claimed "W6 RED at committed base" — false**
- **Found during:** Task 3a (authoritative base re-measurement)
- **Issue:** The falsification-era SUMMARY asserted W6 was RED on the committed tree; the authoritative base run showed W6 GREEN at base (W6 was RED only against the uncommitted `f(run)` carrier).
- **Fix:** Recorded as an explicit correction in the VERDICT re-diagnosis append (`fcd0b0fe`); original falsified sections left untouched.
- **Files modified:** `260924-stb-VERDICT.md`

**2. [Rule 1 - Bug] VERDICT pin-bounds excess-list 5th entry contradicted its own table**
- **Found during:** Task 3a (V2 identity validation failed against doc literal 1.975)
- **Issue:** Excess list said synthetic/w50 1.975; the visible-width table implies 2.975.
- **Fix:** Reverted carrier to HEAD, re-measured authoritative base (table correct), recorded the typo correction in the append. V2 then passed byte-identity on all 18 cells.
- **Files modified:** `260924-stb-VERDICT.md`

**3. [Rule 3 - Blocker] `pnpm vitest run` unavailable at repo root**
- **Found during:** Task 3c verification
- **Issue:** `ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL Command vitest not found`.
- **Fix:** Ran `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run …` (project test setup, no config hacks).
- **Files modified:** none

No other deviations. Architecture unchanged: equalization-only modulation inside
`core/fluids.ts` (the plan's authorized edit set for the carrier); `wet-layer.ts`,
`paint.ts`, `types.ts` from the plan's `files_modified` proved unnecessary and untouched.

## Stop-Clause Audit

- PIN 0 ratio 1.0000 / PIN 0b minBody 0.9994 — no movement.
- W2 PASS at base values (1/2), W5 byte-identical — no flip.
- W6 + pyp legacy 7/7 GREEN — no regression.
- Locked-file diffs all empty; keep-gate tier 70 intact — no leak.
- None of the STOP conditions fired.

## Known Stubs

None — no placeholder values, TODOs, or unwired data sources in the changed files.

## Native UAT rows (deferred — automated-ready, live UAT not yet run)

Native UAT rows from the plan, verbatim (automated gates all green; live rows pending):

1. Pressure gesture (thin→thick→thin): settled silhouette follows the gesture — hairlines and taper ends thin and clean, thick parts paint-like; side by side with the preview ribbon the silhouette reads the same gesture
2. Thin parts are not speckled mush and are not inflated up to some constant minimum width
3. Thick parts keep the Physics identity — wet edges, granulation, spread still present (physics not disabled)
4. One continuous stroke shows the gradient: physics follows local width ALONG the stroke, not a per-stroke average
5. Determinism: the same gesture produces the same footprint, pose after pose (no boil)
6. Body opacity unchanged — the stroke body is exactly as opaque as the pre-fix build (no wash-out; PIN 0 law)
7. Normal mode unchanged; water behaves as before (water is still not a width control — the PIN 2 deferral stays)

Status: **automated-ready** — all 7 contract pins + legacy harnesses green; no live UAT
claimed (memory law: no done before live visible UAT).

## Self-Check: PASSED
