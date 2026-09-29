---
phase: quick-260929-m2z
plan: 260929-m2z
subsystem: paint
tags: [efx-physic-paint, bristle-footprint, filled-outline, fibre-coverage, halfw-regime, composite-alpha, seeded-geometry, vitest, tdd]

# Dependency graph
requires:
  - phase: 52.4-real-paint-kill-the-salt-and-pepper (plans 01-04)
    provides: seeded bristle footprint, source-shape gates G1-G6, acceptance battery (PIN 0/0b, envelope, W1-W7), rows a-i
  - phase: quick-260929-j47 (restore R1 continuous low-alpha bristle)
    provides: overlap-packed body band, composite PIN 0 with k_body >= 4, hairline regime baseline, amended G3/G5
provides:
  - R7 fibre coverage raster: one closed transparent filled outline per fibre (fill AA only, no ctx.stroke, no soft-under silhouette blur, no skip/run-flush dashing)
  - halfW-keyed thin regime (THIN_HALF_W = 8 on local halfW = radius x scales[ci]) with the 1-3 thin streak family
  - composite PIN 0 re-proven at EXISTING bound (1-prod(1-ga) >= 0.99, k_body >= 6 worst-case at STREAK_ALPHA 0.55)
  - amended source-shape gates: G3 single-fill-alpha whitelist, G5 R7 single-clamp width law
affects: [52.4 UAT re-run (rows a-i), future footprint work, 53.1 R2 deferrals]

# Actuals (#2632) — pairs with the plan's `estimate` (tokens 60000, tasks 3).
actuals:
  tokens: 25418    # chars/4 over the 4 changed files (101672 bytes total)
  tasks: 3
  commits: 2       # MEASURED: git rev-list --count 7b56c381..HEAD (docs commit is the orchestrator's)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - one save..restore block per fibre: fillStyle -> globalAlpha = STREAK_ALPHA * opac once -> beginPath (left boundary forward, end cap, right boundary backward, start cap) -> closePath -> fill -> restore
    - per-sample halfW regime with contiguous same-regime runs and +/-1 overlap at internal transitions (no boundary gap, no double-draw)
    - rim strata edge pulled in by worst-case rim half-width (rimEdge) so the R7 centreline clamp never shrinks the recovered D-13 Poisson gap
    - overlap-packed body strata tightened to 0.16/0.18 px so the band-edge one-sided window holds k >= 6 at every body sample
    - comment-stripped source-shape gates (G3 single-fill whitelist, G5 single-clamp tokens) reading the real drawBristleFootprint body slice

key-files:
  created: []
  modified:
    - packages/efx-physic-paint/src/brush/footprintLanes.ts
    - packages/efx-physic-paint/src/brush/paint.ts
    - packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts
    - packages/efx-physic-paint/src/brush/paint.depositSourceShape.test.ts

key-decisions:
  - "STREAK_ALPHA = 0.55 (top of the locked [0.4, 0.55] band): killing the under-pass leaves the body alone to carry PIN 0, so (1-0.55)^6 = 0.0083 -> composite 0.9917 >= 0.99 needs worst-case k >= 6; the packing was tightened until k >= 6 is guaranteed, the 0.99 bound never moved"
  - "THIN_HALF_W = 8 keyed on local halfW = radius x scales[ci] (replaces radius-keyed HAIRLINE_RADIUS): above the radius-3 cell (halfW <= 3), below every lane-field pin's mid-stroke halfW at p = 1 (radius 16/20/32/40); a fat brush at light pressure or on a taper takes the thin path wherever locally thin"
  - "Body packing BODY_GAP_PX = 0.16 / BODY_MIN_GAP_PX = 0.14 / BODY_MAX_REACH_PX = 0.18: floor(1.0 / 0.18) = 5 plus the edge lane = 6 body fills inside the 1 px band-edge window -> composite >= 0.9917 at every body sample at every radius (the plan's 0.24 candidate still allowed k = 5 -> 0.9815, measured fail)"
  - "R7 containment clamp: outline centreline lim = max(0, halfW - w/2 - 1e-3) keeps the full fibre width inside the ribbon; the outermost rim strata are pre-pulled by rimHalfWorstNorm so the clamp never shrinks the recovered D-13 gap (measured 0.0041 < 0.0055 at radius 40 without the pull)"
  - "Endpoint caps are lineTo-only arc approximations (capRad = SQRT1_2): R7a/R7b edge carriers stay in the W(t) gauge, endpoint arc and curvature normals — no ctx arc-family calls, no per-pixel passes, no paper read"
  - "BODY_WIDTH_MIN/MAX = 1.7/1.9 kept: MIN x pMod(1.5) x gauge floor (0.8) = 2.04 > CORE_MAX_TRACE_WIDTH, so at p = 1 every body outline width clamps to exactly 2 px and the edge-window arithmetic stays deterministic"
  - "Live tier still selects ceil(N / 4) lanes (ink preservation within 15%): tier only thins the lane field, it never changes the regime, the outline shape or the fill alpha"

patterns-established:
  - span-of-same-regime drawing: runs of contiguous thin/thick samples mapped to [start-1, end+1] at internal transitions, one filled outline block per (lane x span)
  - op-log harness extraction pairing left/right boundary vertices by x.toFixed(3) with yMid = pair.yc (centreline), lw/ga read from the block's single writes

requirements-completed: [QUICK-260929-M2Z]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "R7 fibre coverage contract proven by the filled-outline, halfW-regime, single-alpha, continuity, composite-overlap and containment pins plus the amended G3/G5 source-shape gates"
    requirement: QUICK-260929-M2Z
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts + paint.depositSourceShape.test.ts (34/34 green at GREEN; full package suite 245 passed | 3 pre-existing skips)"
        status: pass
    human_judgment: false
  - id: D2
    description: "R7 look lines (a fibre-scale textured edge, b correlated along the fibre, c single-boundary AA) + 52.4 acceptance rows a-i"
    requirement: QUICK-260929-M2Z
    verification: []
    human_judgment: true
    rationale: "The R7 texture look is a native UAT judgment (the user's eye; spec 01 acceptance rows a-i too) — no metric gate on it, no browser automation allowed"
  - id: D3
    description: "Full acceptance battery re-green at EXISTING bounds (PIN 0 [0.99,1.01], PIN 0b >= 0.95, ENVELOPE_BOUND, keep-gate 70, dry threshold 1, W1-W7) + app metrics + tsc clean + scope guard"
    requirement: QUICK-260929-M2Z
    verification:
      - kind: unit
        ref: "full package vitest run (32 files, 245 passed | 3 pre-existing skips) + app depositSpeckleCapture.metrics.test.ts (23 passed) + pnpm --filter efx-physic-paint run check (tsc exit 0)"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 15m
started: 2026-09-29T14:18:41Z
completed: 2026-09-29T15:33:00Z
status: complete
---

# Phase Quick 260929-m2z: Implement R7 Fibre Coverage Contract Summary

**ONE closed transparent filled outline per fibre (fill AA only) with the thin regime keyed on local halfW — soft-under silhouette blur, skip stream and run-flush deleted; composite PIN 0 re-proven at 0.99 via STREAK_ALPHA 0.55 + 0.18 px worst-case body packing — battery green at existing bounds, AUTOMATED-READY pending user UAT (rows a-i + R7 look a/b/c)**

## Performance

- **Duration:** 1h 15m (plan dispatch 14:18:41Z -> close 15:33Z)
- **Started:** 2026-09-29T14:18:41Z
- **Completed:** 2026-09-29T15:33:00Z
- **Tasks:** 3
- **Files modified:** 4

## Status: AUTOMATED-READY — NOT done

Automated acceptance is fully green. **Final acceptance = the user's live native UAT PASSES: 52.4 acceptance rows a-i plus the R7 texture look lines (a fibre-scale textured edge, b correlated along the fibre, c single-boundary fill AA — the user's eye, no metric gate).** Until then this quick is automated-ready only — nothing is declared done before that UAT passes (rows a-i and the R7 look lines are PENDING, user-side).

## RED / GREEN evidence (TDD)

- **Task 1 (RED, 9d32b812):** tests-only rewrite of the two contract files — zero production edits. G3 amended to the single-fill whitelist, G5 to the R7 single-clamp law; G1/G2/G4/G6 test code byte-unchanged. RED record: `.planning/quick/260929-m2z-implement-r7-fibre-coverage-contract-in-/260929-m2z-RED-EVIDENCE.json` — command `pnpm exec vitest run --reporter=tap src/brush/paint.bristleSeed.test.ts src/brush/paint.depositSourceShape.test.ts` (cwd `packages/efx-physic-paint`), exit 1, **verdict `RED_EVIDENCE_OK` / `target_test_failed`** (classifier `gsd_run check tdd-red-evidence`), flattened output `# tests 34 / # pass 16 / # fail 18` with raw TAP at `/tmp/m2z-red.tap` and default-reporter log at `/tmp/m2z-red.log` recorded in the record (vitest TAP lacks the trailer and indents nested lines — the dso flattening precedent). Failing highlights: `radius 16 tier final must contain no stroked path: expected [ Array(930) ] to have a length of +0 but got 930`, the `THIN_HALF_W` undefined TypeError against the still radius-keyed production, plus the composite/containment/consistency pins and the amended G3/G5 real-source gates. The 16 passes = model-agnostic pins + unchanged G1/G2/G4/G6 + negative controls — recorded honestly, never manufactured.
- **Task 2 (GREEN, 7a681fdd):** production implementation in `footprintLanes.ts` + `paint.ts` (plus the one harness fix in `paint.bristleSeed.test.ts`, see Deviations). Task 2 verify: both brush test files **34/34 passed**, exit 0.
- **Task 3 (close):** full package suite **32 files, 245 passed | 3 skipped (248)** — the 3 skips are pre-existing in the battery file `physicsSettledFootprint.test.ts`, untouched; app metrics **23 passed**; `pnpm --filter efx-physic-paint run check` **tsc exit 0**; **SCOPE GUARD: PASS** (ledger diff contains only the four brush files + the RED evidence record).

## Battery laws — all at EXISTING bounds (zero bound edits)

| Law | Bound | Result |
| --- | --- | --- |
| PIN 0 composite (physicsSettledFootprint) | [0.99, 1.01] | pass (unchanged test) |
| PIN 0b post-settle visibility | >= 0.95 | pass |
| ENVELOPE_BOUND | existing | pass |
| DEPOSIT_KEEP_TIER (wet-layer.ts) | 70 | pass, file untouched |
| DRY_ALPHA_THRESHOLD (drying.ts) | 1 | pass, file untouched |
| W1-W7 (physicsWidthScaling) | existing | pass (7/7) |
| bristleSeed composite PIN 0 | >= 0.99, k_body >= 4 @ r16/r32 | pass (worst-case k >= 6, composite 0.9917) |
| Rim Poisson floor (D-13 rim only) | POISSON_FILL x spacing | pass @ r40 (rimEdge pull) |
| Density ratio (D-02) | >= 1.5 (measured ~2.05) | pass |
| SIZE excursion | <= 0.35 | pass |
| Gauge low-freq | <= 10% consecutive | pass (channel 0, arc-keyed) |
| Ink preservation (live vs final) | within 15% | pass (live divisor 4) |
| Live divisor | 4 | kept |
| W1-W7 / SIZE / spread pins in app metrics | existing | 23/23 pass |

**Six battery files re-run, NEVER edited:** `physicsSettledFootprint.test.ts`, `physicsWidthScaling.test.ts`, `productionAaSettleMeasurement.test.ts`, `depositGateFieldMeasurement.test.ts`, `drying.continuity.test.ts`, app `depositSpeckleCapture.metrics.test.ts` — all green as-is.

**Digest re-records: NONE.** Every exact-value digest pin passed unchanged — nothing was re-recorded.

**STOP-rule status: NOT triggered** — the locked R7 path satisfied every battery law at its existing bound; no bound was loosened, no law-vs-look conflict silently resolved.

## Chosen constants + rationale

- `STREAK_ALPHA = 0.55` — top of the user-locked [0.4, 0.55] band. With the under-pass gone the body alone carries PIN 0: `(1-0.55)^6 = 0.0083 -> 0.9917 >= 0.99` needs worst-case `k >= 6` at the 1 px band-edge one-sided window; the packing below guarantees it. The 0.99 bound itself never moved.
- `THIN_HALF_W = 8` — plan-bounded on LOCAL halfW: above the radius-3 cell (`halfW <= 3`), below every lane-field pin's mid-stroke halfW at p = 1 (radius 16/20/32/40). `8 < 8` is false, so radius-8 cells at p = 1 stay on the lane field; fat brush at light pressure / taper takes the thin family wherever locally thin.
- `WIDTH_FLOOR = 0.5`, `CORE_MAX_TRACE_WIDTH = 2` — the R7 single-clamp law: one ceiling only (soft-under ceiling retired with the under-pass).
- `BODY_GAP_PX = 0.16 / BODY_MIN_GAP_PX = 0.14 / BODY_MAX_REACH_PX = 0.18` — worst gap 0.18 px packs `floor(1.0 / 0.18) = 5` plus the edge lane = 6 body fills inside the band-edge window (5 x 0.18 + jitter < 1), and the first rim lane covers the outer edge too -> composite >= 1-0.45^6 = 0.9917 >= 0.99 at every body sample at every radius. The plan's 0.24/0.28 candidate still admitted k = 5 -> 1-0.45^5 = 0.9815 (measured fail); MIN 0.14 keeps a >= 0.14 px draw gap so the strata keep seeded jitter.
- `rimEdge` pull: rim strata edge = `max(min(rimGap/2, 0.02), rimHalfWorstNorm + GAP_EPS)` with `rimHalfWorstNorm = ((RIM_WIDTH_MAX x 1.5 x 1.15)/2 + 0.001)/count` — the R7 centreline clamp (`lim = halfW - w/2 - 1e-3`) would otherwise pull the outermost rim lane inward and shrink the recovered D-13 gap below the Poisson floor (measured 0.0041 < 0.0055 at radius 40).
- `RIM_COUNT_RATIO = 0.45`, `POISSON_FILL = 0.7`, `BODY_BAND = 0.52`, `NW_AMPLITUDE = 0.4`, `NW_ARC_SCALE = 0.1`, `BODY_WIDTH_MIN/MAX = 1.7/1.9` — unchanged from 52.4-02/j47 (width determinism: 2.04 > 2 clamp at p = 1).
- Thin family: 1-3 seeded lanes per locally-thin span (keys `hairline` / `hs${j}` / `hw${j}`), body-width range, same single fill alpha.

## Task Commits

Each task committed atomically (ledger base `7b56c381`):

1. **Task 1: add failing R7 filled-outline coverage pins (RED)** - `9d32b812` (test)
2. **Task 2: R7 filled-outline fibre coverage with halfW regime (GREEN)** - `7a681fdd` (feat)
3. **Task 3: battery close** - no code changes (verification only)

**Plan metadata / SUMMARY / STATE docs commit:** handled by the orchestrator (docs commit rule — executor did not commit docs).

## Files Created/Modified

- `packages/efx-physic-paint/src/brush/footprintLanes.ts` — R7 constants (`STREAK_ALPHA 0.55`, `WIDTH_FLOOR 0.5`, `CORE_MAX_TRACE_WIDTH 2`, `THIN_HALF_W 8` replacing `HAIRLINE_RADIUS`), `SOFT_EDGE_ALPHA` / `MAX_TRACE_WIDTH` / `SOFT_WIDTH_MUL` deleted, body packing tightened to 0.16/0.14/0.18, `rimEdge` containment pull, rewritten comments (arithmetic on-page).
- `packages/efx-physic-paint/src/brush/paint.ts` — `drawBristleFootprint` rewritten: contiguous same-regime spans (+/-1 overlap at internal transitions), per-fibre `drawOutline` (one moveTo-less boundary walk, end cap, right boundary back, start cap, closePath, single `fill`), per-sample `halfW` regime, `lim` centreline clamp, skip stream / run-flush / `drawPass` stroke deleted, `arcSlot` import dropped.
- `packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts` — R7 contract pins: filled-outline (one moveTo + one fill, zero `ctx.stroke`, single ga/fs sets, radii 16/20/32 both tiers), halfW regime (radius 40 p = 0.15 thin 1-3 blocks; p = 1 thick > 3), shape-noise (41 lws, single ga), Poisson/composite/continuity at radius 32 (`expectedFibres` from `buildBristleLanes` must match blocks exactly), containment (`capBulgeMax = CORE_MAX_TRACE_WIDTH/2 + 1e-6`), source-shape body forbids skip/SOFT/`ctx.stroke(`/0.72/`Math.random`/`getImageData`/channel-1; plus the `yMid: mid.yc` harness fix.
- `packages/efx-physic-paint/src/brush/paint.depositSourceShape.test.ts` — G3 single-fill whitelist (`STREAK_ALPHA|params.opac|opac|digits|parens|*` only; under-pass RHS now a failing control), G5 R7 single-clamp law (`WIDTH_FLOOR` + `CORE_MAX_TRACE_WIDTH` present, `SOFT_EDGE_ALPHA` and `\bMAX_TRACE_WIDTH\b` forbidden, channel 0 + arc-key rules unchanged); G1/G2/G4/G6 byte-unchanged; all six negative-control teeth intact.
- `.planning/quick/260929-m2z-implement-r7-fibre-coverage-contract-in-/260929-m2z-RED-EVIDENCE.json` — RED evidence record (classifier RED_EVIDENCE_OK).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test harness centreline accessor typo (`mid.y` -> `mid.yc`)**
- **Found during:** Task 2 (GREEN) — three composite/consistency pins failed with NaN offsets
- **Issue:** `extractLanes` pushed `{ x, yc }` pairs but the midpoint read `mid.y`, so `yMid` was `undefined` -> NaN offsets -> `uniqueSortedOffsets` collapsed to one NaN entry -> `offA.length = 1`, `body = 0`, `k = 0`.
- **Fix:** read `mid.yc`; verified by escalating debug pins (block structure OK -> 202 pairs OK -> offsets numeric).
- **Files modified:** `packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts` (harness only, not a law pin)
- **Committed in:** 7a681fdd (Task 2)

**2. [Rule 1 - Bug] Body packing tightened to 0.16 / 0.18 beyond the plan's 0.24 candidate**
- **Found during:** Task 2 (GREEN) — composite pin measured `0.9815471875 = 1 - 0.45^5` (k = 5) at the radius-16 band edge
- **Issue:** The plan's composite arithmetic sanctioned levers `a in [0.4, 0.55]` and the body gap/width constants (never the 0.99 bound). With the under-pass removed, `BODY_GAP_PX 0.24 / BODY_MAX_REACH_PX 0.28` still allowed only 5 covering fills in the 1 px one-sided band-edge window -> 0.9815 < 0.99 at STREAK_ALPHA 0.55 (needs k >= 6).
- **Fix:** `BODY_GAP_PX 0.24 -> 0.16`, `BODY_MAX_REACH_PX 0.28 -> 0.18` — worst gap 0.18 packs floor(1.0/0.18) = 5 plus the edge lane = 6 fills inside the window -> composite >= 0.9917 at every body sample; MIN 0.14 kept so strata retain seeded jitter. Comments rewritten with the arithmetic (never appended). The 0.99 bound and the [0.4, 0.55] alpha band are untouched.
- **Files modified:** `packages/efx-physic-paint/src/brush/footprintLanes.ts`
- **Verification:** composite pin green at radius 16 and 32; full battery green unchanged.
- **Committed in:** 7a681fdd (Task 2)

**3. [Rule 1 - Bug] R7 containment clamp shrank the recovered rim Poisson gap**
- **Found during:** Task 2 (GREEN) — rim gap pin measured `0.004125 < 0.005534` at radius 40
- **Issue:** The R7 centreline clamp (`lim = halfW - w/2 - 1e-3`, required so the full fibre width stays inside the ribbon) pulled the outermost rim lane (intended offset ~0.997) inward, shrinking the recovered outer gap below the D-13 floor.
- **Fix:** pull the strata edge in by the worst-case rim half-width before laying the rim bands (`rimEdge` formula, documented on-site with the measured old gap); the old `rimGap/2` floor is kept for small counts where it is larger. Intended positions are then never clamped.
- **Files modified:** `packages/efx-physic-paint/src/brush/footprintLanes.ts`
- **Verification:** rim gap pin green at radius 40; density ratio and Poisson floor unchanged.
- **Committed in:** 7a681fdd (Task 2)

**4. [Rule 1 - Bug] Span-construction loop built shifted spans instead of ±1 overlaps (fixed inline, pre-commit)**
- **Found during:** Task 2 (GREEN)
- **Issue:** The first span loop compared `thin(ci) !== thin(spanStart)` and pushed shifted boundaries — the comment claimed ±1 overlap at internal transitions but the code produced a boundary shift.
- **Fix:** clean two-pass — build contiguous same-regime `runs`, then map each run to `[start-1, end+1]` where prev/next exist.
- **Committed in:** 7a681fdd (Task 2, fixed before the GREEN verify run)

---

**Total deviations:** 4 auto-fixed (4 bugs; #2 uses the plan's sanctioned body-gap lever with measured justification)
**Impact on plan:** All confined to the plan's named files (four brush files). No battery file, no battery bound, no out-of-scope file touched. The STOP-and-report link was evaluated at deviation #2 and did NOT trigger — the locked fix path (alpha within [0.4, 0.55] + body gap/width constants) satisfied PIN 0 at its existing bound.

## Issues Encountered

- **vitest TAP reporter vs the RED-evidence classifier:** raw TAP lacks the `# tests / # pass / # fail` trailer and indents nested `not ok` lines, which would classify INVALID_RED. Followed the 260925-dso precedent: flattened output field (leaf lines renumbered, trailer appended) with `rawTapPath` `/tmp/m2z-red.tap` and `defaultReporterLogPath` `/tmp/m2z-red.log` recorded in the record — classifier verdict `RED_EVIDENCE_OK / target_test_failed`.
- **Plan scope-guard regex unparseable by ugrep:** the pattern ends with a trailing empty `|)` alternative -> `ugrep` exits 2 ("empty (sub)expression"). Rewrote the guard as a bash `case` match over `git diff --name-only 7b56c381..HEAD` -> SCOPE GUARD: PASS (four brush files + RED evidence record only).
- **Unused `arcSlot` import** after the skip stream was deleted — removed in the GREEN commit (`tsc --noEmit` clean).

## Known Stubs

None — no placeholder values, TODO/FIXME markers, or unwired props were introduced by this plan.

## Next Phase Readiness

- Automated acceptance is complete: R7 footprint contract, amended G3/G5 gates, full battery, app metrics, typecheck all green at existing bounds.
- **Blocker to close-out: user-side native UAT** — 52.4 acceptance rows a-i plus the R7 texture look lines a/b/c (fibre-scale textured edge, correlation along the fibre, single-boundary fill AA — the user's eye). After that passes, the quick can be declared done (orchestrator commits this SUMMARY/STATE/PLAN).
- Out-of-scope items stay deferred exactly as planned: spread-as-thickener (wet-layer role law), the color-blending motif (Quick 8e), physics buttons (UI); doors D-03/D-09 do not apply.

## Self-Check: PASSED

- FOUND: `.planning/quick/260929-m2z-implement-r7-fibre-coverage-contract-in-/260929-m2z-SUMMARY.md`
- FOUND: commit `9d32b812` (Task 1 RED)
- FOUND: commit `7a681fdd` (Task 2 GREEN)
- FOUND: `packages/efx-physic-paint/src/brush/paint.ts`, `footprintLanes.ts`, `paint.bristleSeed.test.ts`, `paint.depositSourceShape.test.ts`
- Working tree: only this untracked SUMMARY.md (docs commit belongs to the orchestrator)

---
*Phase: quick-260929-m2z*
*Completed: 2026-09-29*
