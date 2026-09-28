---
phase: quick-260927-ton
plan: 260927-ton
subsystem: brush geometry / rendering
tags: [edgeDetail, ribbon, deform, pressure, taper, tdd, erase-parity]
requires:
  - phase: quick-260924-stb
    provides: "physics intensity scales with local thickness; thickness field in fluids.ts"
  - phase: quick-260925-b7c
    provides: "spreadCurveFor calibration law (new 50 = old 30, K=1 default intentional)"
  - phase: quick-260925-dso
    provides: "bake-time grain/emboss deleted; clean flat-layer edges"
  - phase: quick-260925-iy6
    provides: "paper pass CLOSED; paperGrain removed; confirmed edgeDetail defect unchanged"
provides:
  - "ribbonWithScales: ONE scale computation (s = max(0.1, pressure x endTaper)) shared by polygon geometry and deform amplitude"
  - "deformScaled / deformNScaled: midpoint displacement at gauss(0, variance * sMid)"
  - "production-path amplitude pins (hairline/thick, taper/thick, thick-band, substrate, determinism)"
  - "harness parity: physicsWidthScaling + productionAaSettleMeasurement on the same scale-aware seam"
affects: [brush-edges, erase-mask, shape-detail-ui, physics-width-laws]
actuals:
  tokens: 8400
  tasks: 3
  commits: 4
tech-stack:
  added: []
  patterns: [structural origin-t region filter through the deform chain; scale channel threaded alongside polygon vertices]
key-files:
  created:
    - packages/efx-physic-paint/src/brush/paint.edgeDetailWidthScale.test.ts
  modified:
    - packages/efx-physic-paint/src/brush/stroke.ts
    - packages/efx-physic-paint/src/brush/paint.ts
    - packages/efx-physic-paint/src/brush/erase.ts
    - packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts
    - packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts
key-decisions:
  - "Erase gets the SAME treatment as paint (explicit): the erase mask follows the local-width law so a hairline erase cannot clear a full-variance wobble band outside the painted silhouette — Normal and Physics erase stay consistent with paint geometry"
  - "ribbonWithScales is the ONE scale computation (s = w / halfWidth, the exact expression ribbon already used for w) — polygon geometry and deform scales cannot diverge; ribbon() delegates and stays byte-identical (paint.continuation polygon[1] == [10, 3] pin green)"
  - "deformScaled midpoint scale = (sA + sB) / 2, gauss call count unchanged (two reads per edge)"
  - "Gate decision 2026-09-28: Test 3 pin regions filtered by STRUCTURAL origin-t (where a vertex came from through the 5-pass deform chain), NOT by post-deform x-window — the constant-stub deform displaces vertices ~6-8 px and the x-window admitted vertices out of band. Threshold 0.80 UNCHANGED. Alternative (loosen 0.80 -> 0.90) rejected: 2% margin and the recipe stayed structurally wrong"
  - "No law-bound recalibration authority exercised: W1-W7 + pyp/rm2 gates pass at their EXISTING pre-calibrated bounds (stb 'calibrated once, never re-calibrated')"
patterns-established:
  - "Amplitude-vs-local-width laws pin through renderPaintStroke under a CONSTANT Math.random = 0.5 stub (every gauss(0, s) becomes exactly -1.17741 * s), so region-max differences isolate the scale factor"
  - "Region filters for amplitude pins read structural origin-t through the deform chain, never the post-deform coordinate"
requirements-completed: [QUICK-260927-TON]
duration: 45min
completed: 2026-09-28
status: complete
plan_head_before: 4484aec88700aa471771e3d10f664a4d9acb248a
---

# Quick 260927-ton: Shape detail scales with local stroke thickness Summary

**Shape-detail (`edgeDetail`) deform amplitude now follows the local ribbon width (`gauss(0, variance * s)`) instead of the base brush radius applied uniformly — thick parts keep the natural organic edge, hairlines and tapers keep their silhouette, and one gesture shows the gradient.**

**Verdict: automated-ready — native UAT pending.** Live visible UAT has NOT run; nothing here is "done/verified" until the user's native pass below.

## What landed

1. **`packages/efx-physic-paint/src/brush/stroke.ts`** — the scale channel + scale-aware deform seam:
   - `ribbonWithScales(curve, halfWidth, tPow, hasPenInput)` returns `{ poly, scales }`. The scale is `s = max(0.1, (hasPenInput ? p : 1) * endTaper)` — the **exact** expression `ribbon` already used for `w` (`w = halfWidth * s`), so polygon geometry and deform amplitude share one computation and cannot diverge.
   - `deformScaled(poly, scales, variance)` — same midpoint algorithm as the old `deform`, except the midpoint is displaced by `gauss(0, variance * sMid)` with `sMid = (sA + sB) / 2`. Output carries `[sA, sMid]` per edge, aligned to the output vertex order. Gauss call count per polygon unchanged (two reads per edge).
   - `deformNScaled(poly, scales, depth, variance)` — loops exactly like the old `deformN` with the same pass divisor `(1 + d * 0.65)`, threading the scales through every pass.
   - `ribbon()` delegates to `ribbonWithScales(...).poly` (byte-identical output — the `paint.continuation` pin `polygon[1] == [10, 3]` stays green).
   - Legacy uniform `deform` / `deformN` **deleted** — zero remaining call sites (comment-filtered grep over `packages/` + `app/src/`).
2. **`packages/efx-physic-paint/src/brush/paint.ts`** — all THREE variance sites now build `ribbonWithScales` → `deformNScaled` → per-layer `deformScaled`: pickup-less (~358), pickup segments (~398), single-color (~453). `variance = (1.5 + sqrt(radius) * 0.9) * edgeMul` is UNCHANGED — it is now scaled per vertex instead of applied uniformly.
3. **`packages/efx-physic-paint/src/brush/erase.ts`** — the fourth site, same seam. **Explicit decision: erase gets the same treatment** (see Decisions).
4. **No UI changes.** The `Shape detail` slider (`PhysicsPaintRightPanel.tsx:663`) and `physicsPaintStudioSettings.ts` are untouched (read-only proving).

## RED evidence (Task 1, at base, zero production edits)

Constant `Math.random = 0.5` stub makes every `gauss(0, s)` exactly `-1.17741 * s`, so region-max differences isolate the scale factor. Measured through `renderPaintStroke` (production path):

| Pin | base | threshold | verdict |
| --- | ---- | --------- | ------- |
| Test 1 hairline/thick | **1.000** | <= 0.30 | **RED** |
| Test 2 thick vs variance | in band | [0.95, 3.0] x | green (control) |
| Test 3 taper/thick | **1.000** | <= 0.80 | **RED** |
| Test 4 hairline ribbon width | 2.0000 px | <= 3.0 px | green (control) |
| Test 5 determinism | byte-identical | — | green (control) |

RED is preserved under every region reading (base >> 0.80 / 0.30 everywhere), so the defect was real and not a measurement artifact.

## GREEN evidence (Task 2 + gate resolution)

Measured post-fix (origin-t structural reading, threshold unchanged):

| Pin | measured | threshold | verdict |
| --- | -------- | --------- | ------- |
| hairline/thick | **0.0974** | <= 0.30 | **GREEN** |
| thick | 9.2519 | [4.1287, 13.0381] | GREEN |
| taper/thick | **0.7367** | <= 0.80 | **GREEN** |
| hairline ribbon width | 2.0000 px | <= 3.0 px | GREEN |
| determinism | byte-identical | — | GREEN |

Hairline amplitude is now **9.7%** of the thick-body amplitude (was 100%). Thick-body organic amplitude is inside the today-formula band — the slider's natural edge on the body is untouched.

### Gate decision (2026-09-28) — Test 3 region reading

Task 3 of the plan's own x-window recipe measured taper/thick = 0.8808 (RED) while the plan's prediction model said 0.61–0.73. Diagnosis: the **recipe** was wrong, not the fix. The constant-stub deform displaces vertices ~6–8 px, so the taper x-window `[10, 16]` admitted vertices whose origin-t was ~0.16–0.17 (s ≈ 0.71, outside the taper band 0.48–0.65). The plan's own "base taper/thick = exactly 1.000" claim was also distorted by the same window bleed (actually 1.1524).

Options presented; **user selected the origin-t reading** (2026-09-28):

| Reading | post-fix | base | verdict |
| ------- | -------- | ---- | ------- |
| Pinned x-window (recipe as written) | 0.8808 | 1.1524 | fails <= 0.80 |
| Nearest-B-segment-in-window | 0.7935 | 1.1006 | passes |
| **Origin-t (structural) — CHOSEN** | **0.7367** | **1.1082** | **passes, matches plan's predicted band** |
| Origin-t AND x-window | 0.8181 | — | fails |

`originTOfFillVertex` maps each fill index back through the 5-pass deform chain (4 in `deformNScaled` + 1 layer `deformScaled`) to the curve `t` it came from. The amplitude-vs-local-width law is about where a vertex **originated**, not where it landed. Threshold **0.80 unchanged** — only the measurement window moved to the structurally correct one. The alternative (loosen 0.80 → 0.90) was rejected: 2% margin and the recipe stayed structurally wrong.

## Harness parity + law gates (Task 3) — hard STOP tree resolved GREEN

`physicsWidthScaling.test.ts` (`buildProfileFor`) and `productionAaSettleMeasurement.test.ts` (`buildProfile`) now drive the **same** `ribbonWithScales → deformNScaled → deformScaled` seam as production. No bound recalibrated.

- **Package battery:** `23 passed (23)` files, `186 passed | 3 skipped` tests — includes `liveAlphaCache`, `previewBaseImageCache`, `previewBaseCompletion`, `paint.continuation` (ribbon identity pin), `paint.grainRemoval`.
- **Law gates at EXISTING bounds:** W1 tol 3.0 px, W2/W6 texture floors `d(b) >= 1` at Spread 80, W3 monotone, W4 PIN 0 `[0.99, 1.01]` + PIN 0b `>= 0.95x`, W5 byte-identical digests, W7 field-law (thick-edge `f >= 0.99`, hairline cols `max f <= 0.30`, production cols `min f >= 0.80`) — all PASS. pyp/rm2 production-path tables: `total STOP findings: 0`.
- **App suite:** `231 passed | 2 skipped (233)` files, `4322 passed | 1 skipped | 101 todo` tests.
- **Typecheck:** `app: tsc --noEmit` exit 0; `packages/efx-physic-paint: tsc --noEmit` exit 0.
- **Scope gate** (`4484aec8..HEAD`): exactly the 6 planned source files + this SUMMARY. **Locked surfaces EMPTY** — `fluids.ts`, `wet-layer`, `spreadScale`, `compositor`, `canvas`/preview, `PhysicsPaintRightPanel`, `PhysicsPaintToolRail`, `PhysicsPaintTopBar`, `package.json`, `pnpm-lock` all untouched. No installs in the diff, no push, no ROADMAP edit.

**Guardrails honoured:** `depositAlpha` / `strokeOpacity` / body coverage never scaled (260924-m7w law — PIN 0 ratio 1.0000 held in the battery). 260924-stb thickness field untouched. 260925-dso edge deletion untouched (no grain/emboss returned).

## Files Created/Modified

- `packages/efx-physic-paint/src/brush/paint.edgeDetailWidthScale.test.ts` — production-path amplitude pins (origin-t region filter)
- `packages/efx-physic-paint/src/brush/stroke.ts` — `ribbonWithScales` + `deformScaled`/`deformNScaled`; legacy `deform`/`deformN` deleted
- `packages/efx-physic-paint/src/brush/paint.ts` — 3 variance sites on the scale-aware seam
- `packages/efx-physic-paint/src/brush/erase.ts` — 4th site, same seam
- `packages/efx-physic-paint/src/core/physicsWidthScaling.test.ts` — harness parity migration
- `packages/efx-physic-paint/src/core/productionAaSettleMeasurement.test.ts` — harness parity migration

## Decisions Made

- **Erase gets the same treatment as paint.** A hairline erase on the old uniform deform would clear a full-variance wobble band outside the painted silhouette — erasing more than was drawn. Normal and Physics erase now stay consistent with paint geometry.
- **Origin-t reading for the Test 3 pin** (see gate table above). The user picked this over threshold loosening or re-planning.
- **No law-bound recalibration.** The plan's hard STOP tree had a recalibration branch; it was never reachable — every stb/b7c/pyp/rm2 gate passed at its existing bound.

## Deviations from Plan

### Auto-fixed / gate-resolved Issues

**1. [Plan-internal contradiction — Test 3 measurement recipe]**
- **Found during:** Task 2 gate (executor checkpoint, 1/3 tasks committed)
- **Issue:** the plan's x-window recipe measured taper/thick 0.8808 against its own predicted 0.61–0.73; the window admitted deform-displaced vertices out of the taper band.
- **Fix:** switched the region filter to structural origin-t (user-selected option 1). Threshold 0.80 unchanged.
- **Files modified:** `paint.edgeDetailWidthScale.test.ts`
- **Verification:** 5/5 pins green; taper/thick = 0.7367 lands in the plan's predicted band; base RED preserved (1.1082).
- **Committed in:** `51bb7665`

---

**Total deviations:** 1 gate-resolved (plan-internal measurement contradiction)
**Impact on plan:** No scope creep. Implementation was spec-faithful throughout; only the acceptance oracle's measurement window moved to the structurally correct one.

## Issues Encountered

- Stale `.git/worktrees/agent-af0041cdcc05012e3/index.lock` blocked the Task 3 commit (no holder per `lsof`, no live git process) — removed the lock only, retried, commit succeeded (CLAUDE.md recovery protocol).
- Worktree had no `node_modules`/`dist` at first; `pnpm install --frozen-lockfile` + `tsup` build were required before the app suite and `tsc` could resolve `@efxlab/efx-physic-paint`. Not a code issue.

## Native UAT rows (PENDING — user must run live; vitest cannot judge edges)

1. **THICK ORGANIC.** Draw a thick downstroke with `Shape detail` at a **high** value. The body edge must read as a natural organic edge (the feature's purpose), not as destruction or a uniform saw-tooth.
2. **HAIRLINE SILHOUETTE.** On the **same** project/settings, draw a hairline (light pressure or thin size) and a tapering stroke. Thin parts must keep a clean silhouette — no eaten hairline, no wobble that eats the 2px core. Compare against a `Shape detail = 0` hairline: the silhouette should be close, not chewed.
3. **GRADIENT.** One gesture from light to firm pressure (or thin to thick). The deformation must follow the local width along the stroke: thin end nearly clean, thick end organically wobbled. This is the core visual proof of the law.
4. **LOW VALUE.** Set `Shape detail` low and look at a mid-width stroke. It must NOT read as pixel noise (the pre-fix low-value failure mode). Low = quieter edge, not dirt.
5. **ERASE CONSISTENCY.** Paint a hairline, then erase along it with the same size. The erase mask must track the painted silhouette — it must NOT clear a wide wobble band around a thin stroke (the old uniform deform would).
6. **REGRESSION — 260924-stb + 260925-b7c.** A pressure gesture's physics intensity still scales with local thickness (hairline does not inflate past its footprint; thick still spreads/textures), and Spread 50 still reads as the preview-matched calibration (new 50 = old 30). If either regresses, report — do not tune.
7. **REGRESSION — 260925-dso + 260924-m7w.** Edges stay clean (no bake-time grain/emboss returned), and stroke body opacity/coverage is unchanged vs before this quick (this is geometry deformation only — opacity was never scaled). If body density changed, report.

---
*Quick: 260927-ton*
*Completed: 2026-09-28*
