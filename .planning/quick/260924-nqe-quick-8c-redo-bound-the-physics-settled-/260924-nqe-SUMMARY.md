---
phase: quick-260924-nqe
plan: 260924-nqe
title: Redo — bound the physics settled-stroke footprint onto the preview ribbon (geometric clip, body alpha untouched)
status: incomplete
subsystem: packages/efx-physic-paint (core/wet-layer, brush/paint)
tags: [quick, physics-paint, footprint, tdd, redo, geometric-clip, stop-clause]
requires: [260924-koa, 260924-m7w]
provides: [body-alpha-pin, clip-impossibility-evidence]
affects: [efx-physic-paint/wet-layer, efx-physic-paint/paint]
tech_stack:
  added: []
  patterns: [headless-stage-wise-width-harness, dual-green-gate, geometric-clip-never-alpha]
key_files:
  created: []
  modified:
    - packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
decisions:
  - "Cite m7w verdict (seam a = transferToWetLayerClipped, +2px of +3px); diagnosis NOT redone"
  - "Body deposit alpha is never modulated for a width bound — bound must be geometric (m7w failure mode)"
  - "STOP: dual gate (PIN 1 envelope + PIN 2 water monotone) is unreachable by a geometric clip under the committed pipeline — no GREEN shipped"
metrics:
  duration: ~40m
  completed: 2026-09-24
  tokens: ~14000
  tasks: 2
  commits: 1
---

# Phase quick 260924-nqe: Redo — geometric bound of the physics settled footprint — Summary

**Final status: STOPPED — `status: incomplete`.** Task 1 (RED, body-opacity pins)
shipped; Task 2 (GREEN geometric clip) evaluated and REJECTED by the plan's own
STOP clause: a geometric clip cannot satisfy both the envelope bound (PIN 1) and
the water monotone law (PIN 2) without the forbidden alpha modulation, and the
only envelope-holding configuration degrades the settled edge to a hard stamp.
Production is base-identical; no GREEN commit exists.

## Carry-over (cited, not redone)

m7w (260924-m7w, closed UAT-FAILED) established the diagnosis: seam (a) — production
deposit `transferToWetLayerClipped` — deposits the raster's 1px AA fringe at
alpha ≈ 941 ≫ visibility floor 125, accounting for +2px of the +3px settled inflation
(fluid settle +1px, compositor 0). Its GREEN 24f40261 bounded the envelope with an
ALPHA carry (waterAmount^6) that crushed stroke-body opacity → quasi-invisible live
marks; reverted (1648658b). Harness + width pins restored RED-at-base (af621f91).

## RED Evidence — Task 1 (COMMITTED: 747f3433, tests-only)

**Command:** `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts`

**Pre-Task-1 baseline (HEAD 2770c60d):** 2 failed | 2 passed — PIN 1 + PIN 2
RED-at-base confirmed before any edit.

**Post-Task-1 (PIN 0/0b added, zero production edits): 2 failed | 4 passed (6), exit 1.**

| Pin | Contract | Base outcome | Observed base values |
| --- | -------- | ------------ | -------------------- |
| PIN 0 | body deposit ratio ∈ [0.99, 1.01] of (a/255)*3000 × transferCount, every in-ribbon pixel (rows 29..34 incl. interior partial-alpha row a=240), per water {10,50,90}, paper=null | **PASSED at base (required — the floor m7w's GREEN would have failed)** | min=max=1.0000 at every water |
| PIN 0b | post-settle body meanAlpha AND meanDisplayAlpha ≥ 0.95 × Task-1 base literals | **PASSED at base (required)** | base means w10/w50: alpha 2622.31, display 225.96; w90: alpha 2638.37, display 227.41 (floors 2491.19/214.66 and 2506.45/216.04) |
| PIN 1 | default-water W_visible ≤ 2r + 2px (bound 8), both papers | **FAILED (RED)** | W_deposit=8, W_settle=9, W_visible=9 (null AND synthetic) |
| PIN 2 | width(90) > width(50) > width(10) strict | **FAILED (RED)** | water10=9 water50=9 water90=9 |
| PIN 3 | byte-identical footprints across identical runs | **PASSED (control)** | digests equal |
| sweep | stage-wise width table, all 24 cells | **PASSED** | verdict seam (a) reproduced |

Production diff at RED commit: empty for `wet-layer.ts`, `paint.ts`, `canvas.ts`,
`fluids.ts`, `compositor.ts` (RED commit contains only
`physicsSettledFootprint.test.ts`).

## STOP — geometric clip rejected (Task 2 HALTED before GREEN)

### What was evaluated

The prescribed fix: extend `transferToWetLayerClipped` with a ribbon-geometry
clip (deposit only pixels inside the polygon / within centerline distance
≤ radius + water-coupled feather margin; passing pixels deposit with byte base
math). Evaluation used an in-harness feasibility probe (temporary, reverted)
that reproduces the clip's effect exactly — a geometric clip only decides WHICH
pixels deposit, so zeroing the raster fringe ≡ a clip that excludes it, and
leaving the raster intact ≡ a clip that includes it (fringe pixels then deposit
base math). No production edit was ever made; no GREEN commit exists.

### Measured achievable outcomes (the complete geometric-clip outcome space)

Dense spacing, paper=null, K=3 settle ticks — the harness's synthetic raster
gives a binary geometry: body rows 29..34 (always inside the polygon, PIN 0
guarantees they pass) and one 1px AA fringe row per side at distance 0.5px from
the polygon edge. A symmetric distance-based feather margin therefore has only
two settings: < 0.5px (fringe excluded) or ≥ 0.5px (fringe included).

| clip config | water | W_deposit | W_settle | W_visible | bodyMean (post-settle) |
| --- | --- | --- | --- | --- | --- |
| fringe EXCLUDED (feather < 0.5) | 10 | 6 | 6 | **6** | 2795.00 |
| fringe EXCLUDED (feather < 0.5) | 50 | 6 | 6 | **6** | 2795.00 |
| fringe EXCLUDED (feather < 0.5) | 90 | 6 | 6 | **6** | 2845.92 |
| fringe INCLUDED (feather ≥ 0.5) | 10 | 8 | 9 | **9** | 2622.31 |
| fringe INCLUDED (feather ≥ 0.5) | 50 | 8 | 9 | **9** | 2622.31 |
| fringe INCLUDED (feather ≥ 0.5) | 90 | 8 | 9 | **9** | 2638.37 |

Identity check (proof that water cannot modulate width at equal deposit):
fringe-excluded w10 vs w50 → deposit 6/6, settle 6/6, visible 6/6,
**settled alpha digests byte-equal (`digestEqual=true`)**.

### Why the dual gate is unreachable — structural proof

1. **Width space is two-valued.** Every symmetric geometric clip yields
   W(water) ∈ {6, 9} (measured table above). PIN 2 needs three strictly
   increasing values → impossible from a two-valued space with a water-monotone
   feather (feather must grow with water: tighten at w10, feather at w90).
2. **PIN 1 ∧ PIN 2 contradiction.** PIN 1 requires W(50) ≤ 8 → must be the
   fringe-excluded config (6). Monotone feather then forces w10 to the same
   config → W(10) = W(50) = 6 → PIN 2 fails. Conversely, including the fringe
   at w50 gives exactly the base deposit → base settle → 9 > 8 → PIN 1 fails.
3. **No water→settle coupling exists to break the tie.** `localFluidPhysicsStep`
   reads only `wet.alpha` (height equalization, wetMask = alpha > 20, advection);
   `wetness` is passively advected and never feeds back; `waterAmount` reaches
   the solver only via the deposit's wetness write and a ±1px bbox margin
   (w10 and w50 both get margin 3 — hence byte-equal digests). Static evidence:
   `fluids.ts` contains no `waterAmount`/`waterCurve` read in the local path.
4. **Why m7w's GREEN showed 6/8/9:** its alpha carry made the FRINGE deposit
   vary with water (0.1⁶≈0 → 6; 0.5⁶≈15 → settle lifted to 8; 0.9⁶≈0.53 → 9).
   The intermediate width 8 came entirely from water-scaled fringe ALPHA —
   exactly the forbidden mechanism, and the same code that crushed body opacity.
5. **The plan's intended feather law (0 / ~1 / ~1.5-2px) cannot deliver
   6/8/9 either:** ~1px at w50 includes the fringe → deposit = base → 9, not 8;
   ~1.5-2px at w90 includes the same single fringe row → also 9 (nothing exists
   1.5px out in the raster) → w50 = w90 → PIN 2 fails even ignoring w10.

### Texture evaluation (STOP texture clause)

- **Envelope-holding config (feather < 0.5, W=6):** d(b) = 0 — fluid settle no
  longer softens the edge (base d(b) = +1); the settled visible silhouette is
  exactly the polygon cross-section — a hard binary stamp edge. Must-have 4
  ("bound is geometric, never a hard binary stamp", wet-edge feathering remains)
  is violated on the visible edge. Granulation (D-08/D-09 paper path) itself
  stays intact for passing pixels.
- **Texture-preserving config (feather ≥ 0.5):** wet-edge behavior identical to
  base (d(b) = +1) but the envelope is NOT held (9 > 8) — m7w's bug remains.

### Final disposition

- **No GREEN commit.** Production (`wet-layer.ts`, `paint.ts`, `canvas.ts`,
  `fluids.ts`, `compositor.ts`) is byte-identical to base — verified by empty
  `git diff` after reverting the temporary probe.
- **Test file reverted to the RED commit state** (747f3433): suite exits 1 with
  2 failed (PIN 1, PIN 2) | 4 passed (sweep, PIN 0, PIN 0b, PIN 3) — correct
  RED-at-base TDD state for whatever comes next.
- **Alpha modulation remains forbidden and was not used.**
- What a follow-up needs (out of this quick's scope, would be Rule 4
  architectural decisions): water coupling inside the solver (fluids.ts —
  explicitly out of scope here), a graduated multi-row AA raster model in the
  harness so feather selects intermediate widths (still cannot fix the
  PIN 1 ∧ PIN 2 contradiction alone — see structural proof), or a re-scoped
  contract where the monotone law is defined on PRODUCTION's continuous AA
  fringe rather than the binary harness raster. User decision required.

### STOP evaluation summary

| Clause | Triggered? | Evidence |
| --- | --- | --- |
| Cannot hold envelope without alpha tricks | **YES** | dual gate structurally unreachable (proof above); only m7w's alpha carry ever produced intermediate widths |
| Wet look hurt by geometric clip | **YES (secondary)** | envelope-holding config: d(b) 1→0, hard stamp edge; must-have 4 violated |
| Fall back to alpha modulation | **NO — forbidden, not used** | production base-identical |

## Deviations from Plan

**1. [Dispatch constraint] RED commit excludes SUMMARY.md**
- Plan Task 1 says commit test + SUMMARY; dispatch forbids committing docs
  artifacts (orchestrator owns the docs commit). Dispatch wins: RED commit is
  tests-only.

**2. [Rule 1 - Calibration] Interior partial-alpha row set to a=240 (plan example suggested a=180/200)**
- Found during: Task 1. a=180 cut settle mass → PIN 1 passed at base on null
  paper (under-reported RED); a=220 still let null land at 8.
- Fix: a=240 — still partial (≠255, covers the crushed sub-255 population) and
  mass-preserving: exact original base calibration restored (9/9/9, both width
  pins RED). No pin bound loosened.

**3. [STOP clause] Task 2 halted before any production edit**
- Geometric clip evaluated via equivalent in-harness probe; feasibility failed
  (see STOP section). Probe reverted; production never touched; no GREEN commit.

## Known Stubs

None — no production code shipped in Task 2.

## Threat Flags

None — no new network/auth/file-IO/schema surface (T-nqe-SC: no installs; T-nqe-04: none).

## Self-Check: PASSED

- FOUND: packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts (Task 1, committed)
- FOUND commit: 747f3433 (RED, tests-only,1 file)
- Production base-identical: git diff empty for wet-layer.ts, paint.ts, canvas.ts, fluids.ts, compositor.ts
- Final suite state = RED commit state: 2 failed | 4 passed, exit 1
- No GREEN commit exists (STOP honored); SUMMARY left uncommitted (orchestrator owns docs commit); status: incomplete
