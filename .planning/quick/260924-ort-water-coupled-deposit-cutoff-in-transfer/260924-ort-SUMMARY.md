---
phase: quick-260924-ort
plan: 260924-ort
title: Water-coupled deposit CUTOFF in transfer — graduated harness + texture gate
status: incomplete
subsystem: packages/efx-physic-paint (core/wet-layer, footprint harness)
tags: [quick, physics-paint, footprint, tdd, graduated-raster, cutoff, texture-gate, stop-clause]
requires: [260924-koa, 260924-m7w, 260924-nqe]
provides: [graduated-fringe-harness, texture-gate-assertion, cutoff-outcome-table]
affects: [efx-physic-paint/wet-layer]
tech_stack:
  added: []
  patterns: [graduated-aa-fringe-harness, include-exclude-cutoff-never-alpha, dual-gate-with-texture]
key_files:
  created: []
  modified:
    - packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
decisions:
  - "Cite m7w verdict (seam a = transferToWetLayerClipped, +2px of +3px) and nqe STOP proof; diagnosis not redone"
  - "Graduated 3-row-per-side AA fringe makes deposit width continuous (12/8/6) — nqe's two-valued {6,9} proof superseded as planned"
  - "STOP clause (ii) fired: every achievable cutoff tier at default water yields d(b)=0 — envelope-holding configs are hard stamps; no GREEN shipped"
metrics:
  duration: ~50m
  completed: 2026-09-24
  tokens: 1600
  tasks: 2
  commits: 2
---

# Phase quick 260924-ort: Water-coupled deposit CUTOFF — Summary

**Final status: STOPPED — `status: incomplete`.** Task 1 (graduated-raster RED)
shipped; Task 2's texture gate (`d(b) ≥ 1` at default water) added as an explicit
assertion, then the water-coupled keep-threshold cutoff was measured across the
complete outcome space and REJECTED by STOP clause (ii): envelope-holding
configs (W=6, 8) settle with d(b)=0 — a hard stamp — and no wider config holds
the envelope. Production is base-identical; no GREEN commit exists.

## Carry-over (cited, not redone)

- **m7w verdict:** seam (a) = `transferToWetLayerClipped`, +2px of +3px settled
  inflation (fluid +1, compositor 0). ALPHA carry GREEN 24f40261 reverted
  1648658b (UAT-FAIL, quasi-invisible body). Never modulate deposit alpha for
  a width bound.
- **nqe STOP:** dual gate structurally unreachable on the *binary* harness
  raster (two-valued {6,9}); its graduated-raster follow-up option is exactly
  scope item 1 of this plan — executed, not refuted.

## Task 1 — Graduated AA fringe raster (COMMITTED: f711dd19, tests-only)

- Binary 1px fringe (a=80 at rows 28/35) replaced with a strictly decreasing
  3-row-per-side ramp: top rows 28→27→26 = 160/110/60, bottom rows 35→36→37 =
  160/110/60; all fringe alphas ≥ 20 (admitted by the existing transfer
  keep-gate at base). Bounds height already covered rows 26..37 — no growth
  needed.
- PIN 0b re-pinned from the graduated raster's own base measurements (floors
  remain 0.95×): `BASE_BODY_MEAN_ALPHA = {10: 2678.14, 50: 2678.14, 90: 2679.67}`,
  `BASE_BODY_MEAN_DISPLAY = {10: 230.70, 50: 230.70, 90: 230.86}`.
- Base suite after Task 1: 2 failed (PIN 1, PIN 2) | 4 passed (PIN 0, 0b, 3,
  sweep), exit 1 — exactly the prescribed RED split. W_deposit=12 at base
  proves intermediate-width headroom (width space no longer two-valued).

## Task 2 — Texture gate + STOP clause (ii)

Texture assertion added first (committed 0b297596 with the STOP evidence):

```ts
// texture gate: default-water fluid settle still softens the edge — d(b) >= 1
```

Cutoff probes measured the complete keep-threshold outcome space at default
water (dense, paper null; synthetic identical) — production path
`transferToWetLayerClipped`, deposited pixels use unchanged `(a/255)*3000`:

| cutoff config (water50 tier) | W_deposit | W_settle | W_visible | d(b) | envelope ≤8 | texture ≥1 |
| --- | --- | --- | --- | --- | --- | --- |
| threshold 200 (body rows only) | 6 | 6 | 6 | **0** | PASS | **FAIL** |
| threshold 130 (body + a160) | 8 | 8 | 8 | **0** | PASS | **FAIL** |
| threshold 70 (body + a160/110) | 10 | 10 | 10 | **0** | FAIL | **FAIL** |
| threshold 20 = base (all rows) | 12 | 12 | 12 | **0** | FAIL | **FAIL** |

A full 3-tier cutoff (200/130/20) run also achieved PIN 1 GREEN (8≤8), PIN 2
GREEN (6<8<13), PIN 0 GREEN (ratio 1.0000), PIN 0b GREEN (body means 2795.00 /
2722.44 / 2679.67 ≥ floors), PIN 3 + sweep GREEN — with the texture gate the
SOLE failure (1 failed | 6 passed). That is precisely STOP clause (ii): the
envelope holds only by excluding enough rows that fluid settle no longer
softens the edge (d(b)=0 → hard stamp), and no included-row configuration both
holds ≤8 and leaves room for settle to push +1.

### STOP disposition

- **No GREEN commit.** `wet-layer.ts` reverted/probed-only — byte-identical to
  Task-1 base; `git diff 73c7cddd HEAD` shows only
  `physicsSettledFootprint.test.ts`.
- **Suite left RED** (correct TDD state for a follow-up): final run
  `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts`
  → **3 failed (PIN 1, PIN 2, texture) | 4 passed (PIN 0, 0b, 3, sweep), exit 1**.
- Alpha modulation remains forbidden and was not used.
- What a follow-up needs (out of scope, user decision): water coupling inside
  the solver (fluids.ts — explicitly out of scope here), a raster/settle model
  where default-water settle still feathers +1px inside the ≤8 envelope
  (production's continuous AA may behave differently from the synthetic ramp),
  or a re-scoped texture contract (e.g. d(b) ≥ 1 measured on edge-softness,
  not width delta).

## Task Commits

1. **Task 1: graduated AA fringe RED** - `f711dd19` (test)
2. **Task 2: texture gate d(b) ≥ 1 assertion (STOP evidence)** - `0b297596` (test)

No GREEN/production commit exists.

## Files Created/Modified

- `packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts` — graduated
  3-row fringe raster, re-pinned PIN 0b bases, explicit texture-gate test

## Decisions Made

- Graduated fringe alphas 160/110/60 chosen for continuity and strict
  monotonicity (plan left literals to executor); all ≥ 20 so base keep-gate
  admits them.
- Texture assertion kept as a hard test even though it is RED at graduated
  base (plan's "red-compatible because base d(b)=+1" was binary-raster
  calibration — see deviations).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Calibration] Texture gate is RED at graduated base — plan assumed it would be red-compatible**
- **Found during:** Task 2 (adding the texture assertion before any production edit)
- **Issue:** Plan stated base d(b)=+1 already (true for the old binary raster:
  8→9). Graduated raster base is 12/12/12 → d(b)=0, so the texture assertion
  fails at base alongside PIN 1 + PIN 2 (suite 3 failed, not 2).
- **Fix:** Kept the assertion (hard must-have 4 / STOP clause ii); STOP-state
  suite documented as 3 failed | 4 passed. No pin bound loosened.
- **Files modified:** physicsSettledFootprint.test.ts
- **Committed in:** 0b297596

**2. [Rule 1 - Calibration] `makeRasterBounds` height needed no growth**
- **Found during:** Task 1
- **Issue:** Plan expected bounds height to grow for fringe rows 26..37;
  existing bounds h=13 already covers them.
- **Fix:** Comment-only; no functional change.
- **Committed in:** f711dd19

**3. [STOP clause (ii)] Task 2 halted before any production commit**
- Complete outcome table measured (above); envelope-holding configs are hard
  stamps. Probes reverted; wet-layer base-identical; no GREEN.

---

**Total deviations:** 2 auto-fixed (calibration), 1 STOP
**Impact on plan:** Plan executed to its designed stop; no scope creep, no production change.

## Known Stubs

None — no production code shipped in Task 2.

## Threat Flags

None — no new network/auth/file-IO/schema surface (T-ort-01/02/SC: no installs,
no untrusted input; probes were temporary local edits, fully reverted).

## Self-Check: PASSED

- FOUND: packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts (modified, committed)
- FOUND commits: f711dd19 (Task 1 RED), 0b297596 (texture gate STOP evidence)
- Production base-identical: `git diff 73c7cddd HEAD --name-only` = test file only;
  wet-layer.ts, fluids.ts, compositor.ts, canvas.ts, paint.ts, strokePreviewRibbon untouched
- Final suite: 3 failed (PIN 1, PIN 2, texture) | 4 passed, exit 1 — RED at base
- No GREEN commit exists (STOP honored); SUMMARY left uncommitted (orchestrator owns docs commit); status: incomplete
