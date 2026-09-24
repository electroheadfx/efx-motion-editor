---
phase: quick-260924-m7w
plan: 260924-m7w
title: Diagnose and bound the physics settled-stroke footprint onto the preview ribbon
status: incomplete
subsystem: packages/efx-physic-paint (core/wet-layer, core/fluids, render/compositor)
tags: [quick, physics-paint, footprint, diagnosis, tdd]
requires: [260924-koa]
provides: [settled-footprint-harness, seam-verdict, ribbon-envelope-bound]
affects: [efx-physic-paint/wet-layer]
tech_stack:
  added: []
  patterns: [headless-stage-wise-width-harness, single-seam-bound]
key_files:
  created:
    - packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
  modified:
    - packages/efx-physic-paint/src/core/wet-layer.ts
decisions:
  - "Guilty seam = (a) production transfer deposit; bounding fix lives only in transferToWetLayerClipped (water-coupled AA carry)"
  - "Plan-prescribed depositToWetLayer is dead code — harness measures both paths; verdict from production path"
metrics:
  duration: ~45m
  completed: 2026-09-24
  tokens: 3900
  tasks: 3
  commits: 3
---

# Phase quick 260924-m7w: Physics stroke settles bolder than the ribbon — Summary

## Diagnosis

**Verdict: seam (a) — the deposit stage (wet-layer.ts `transferToWetLayerClipped`) is GUILTY.**
It accounts for the majority (2 of +3 px) of the settled-mark inflation versus the drawn
ribbon envelope (2r = 6px) at default water; fluid spread contributes +1 px; the display
composite contributes 0.

### Stage-wise width table (Task 1 harness, default brush r=3, K=3 engine-equivalent local settle ticks, visible ≥ 13, alphaFloor = 125)

| deposit path            | water | spacing | paper      | W_deposit | W_settle | W_visible | d(a)=Wd−2r | d(b)=Ws−Wd | d(c)=Wv−Ws | total=Wv−2r |
| ----------------------- | ----- | ------- | ---------- | --------- | -------- | --------- | ---------- | ---------- | ---------- | ----------- |
| transfer (production)   | 10    | dense   | null       | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 10    | dense   | synthetic  | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 10    | sparse  | null       | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 10    | sparse  | synthetic  | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 50    | dense   | null       | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 50    | dense   | synthetic  | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 50    | sparse  | null       | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 50    | sparse  | synthetic  | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 90    | dense   | null       | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 90    | dense   | synthetic  | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 90    | sparse  | null       | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| transfer (production)   | 90    | sparse  | synthetic  | 8         | 9        | 9         | +2         | +1         | 0          | **+3**      |
| stamp (plan-prescribed `depositToWetLayer`) | all 12 cells (10/50/90 × dense/sparse × null/synthetic) | | | 5 | 5 | 5 | −1 | 0 | 0 | −1 |

All 24 cells: `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts` → 1 passed.

### Verdict rule application (default water = 50, dense spacing, both paper variants)

- **Production path:** total inflation = +3 px (W_visible 9 vs ribbon 6, +50%).
  d(a) = +2 (majority), d(b) = +1, d(c) = 0 → **GUILTY: seam (a) deposit**.
- Plan-prescribed `depositToWetLayer` path: no inflation (5/5/5, −1 vs ribbon) →
  it does not model production and cannot be the fix target.

### Why seam (a) inflates (measured mechanism)

Production deposit (`paint.ts` raster → `transferToWetLayerClipped`) keeps every raster
pixel with alpha ≥ 20 and writes `(alpha/255) * 3000` into `wet.alpha`. The raster's
1px anti-alias fringe outside the ribbon polygon (composite alpha 80 in the harness
model; production reaches ≥20 easily under ~30 accumulated layers) therefore lands at
alpha ≈ 941 — far above the visibility floor (125) — while the drawn preview shows that
same fringe only as faint AA. Net: two extra fully-counted cross-section rows (+2),
fluid settle then pushes one further row over the floor (+1). The Beer-Lambert display
curve adds nothing at these densities (d(c) = 0).

### Secondary finding (diagnosis evidence for pin 2)

Widths are **identical across waterAmount ∈ {10, 50, 90}** on every cell: water currently
does not modulate deposit extent or fluid spread at finalize (`fluids.ts` equalization is
driven by `wet.alpha`, not `wetness`; the only water→bbox-margin coupling is ±1px of
solver bbox). `waterAmount` is therefore **not yet** the visible spread control the
contract requires — the GREEN fix must introduce that coupling at the guilty seam.

### STOP-clause evaluation

Guilty seam is **(a)**, not (b) → the re-architecture STOP condition (seam b + Stam
solver re-architecture required) **does not trigger**. Proceeding to Task 2 (RED pins).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan-prescribed deposit path is dead code; harness measures both paths**
- **Found during:** Task 1
- **Issue:** The plan prescribes `depositToWetLayer` for the harness deposit stage, but
  production never calls it (only `transferToWetLayerClipped` from `brush/paint.ts` runs).
  The prescribed path reproduces no inflation (5/5/5), which would have made the
  diagnosis vacuous.
- **Fix:** Harness measures BOTH paths: plan-prescribed `depositToWetLayer` (reference
  rows) and production-faithful `transferToWetLayerClipped` driven by a deterministic
  synthetic ribbon raster (solid rows 29..34 + 1px AA fringe alpha 80; no RNG —
  production bristles/deform randomness excluded for pin-3 determinism). Verdict is
  taken from the production path, per the plan's rule ("reproduces the inflation").
- **Files modified:** packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
- **Commit:** eee2e629

**2. [Rule 1 - Bug] Water sweep shows zero spread coupling (recorded, not yet fixed)**
- **Found during:** Task 1
- **Issue:** `waterAmount` does not affect any measured stage width at finalize —
  contradicts must_have "waterAmount is the visible spread control".
- **Fix:** Fixed in Task 3 at the guilty seam only (water-coupled AA carry in
  `transferToWetLayerClipped`). Task 1/2 did not edit production (pin 2 was the RED
  evidence for this defect).
- **Commit:** 24f40261

**3. [Rule 1 - Bug] First GREEN attempt (aaCarry = water³) left default-water settle at 9px**
- **Found during:** Task 3
- **Issue:** Bounding deposit to W_deposit=6 was not enough — fringe alpha ≈118 sat in
  the wet mask (alpha > 20) and fluid settle lifted both fringe rows past the floor
  (+3) → W_visible still 9; also water50 = water90 = 9 (pin 2 non-strict).
- **Fix:** Sharpened AA carry to `waterAmount^6` so default-water fringe deposits
  below the wet-mask threshold (≈15 < 20): settle then behaves like the tight
  low-water case and lands at 8; water90 keeps a visible fringe → 9. No production
  behavior outside this carry curve changed.
- **Files modified:** packages/efx-physic-paint/src/core/wet-layer.ts
- **Commit:** 24f40261

## RED Evidence

**Command:** `cd packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/core/physicsSettledFootprint.test.ts`

**Result at base (HEAD = Task 1 commit, zero production edits): 2 failed | 2 passed (4)** — exit 1.

| Pin | Contract | Base outcome | Observed base widths |
| --- | -------- | ------------ | -------------------- |
| PIN 1 | default-water `W_visible ≤ 2r + 2px` (bound 8px; paper null AND synthetic) | **FAILED (RED)** — `expected 9 to be less than or equal to 8` | W_deposit=8, W_settle=9, **W_visible=9** (both papers) — fails because the settled mark is 9px vs the 6px ribbon (seam (a) keeps the raster AA fringe above the visibility floor), not because of a broken harness (sweep test passed and prints the full stage table) |
| PIN 2 | `width(90) > width(50) > width(10)` (production transfer path, dense, paper null) | **FAILED (RED)** — `width(90)=9 must be > width(50)=9` | water10=9, water50=9, water90=9 — additional diagnosis evidence: waterAmount has zero spread coupling at finalize today |
| PIN 3 | two identical deposit+settle runs → byte-identical alpha digests (deposit AND settled buffers) | **PASSED (control)** | digests equal — determinism already holds at base |

Base-state expectation log lines printed by pins 1 and 2:
- `PIN 1 base-state expectation: ribbon 2r=6, bound=8 (2r+2px). Measured @ water=50 dense: paper=null W_deposit=8 W_settle=9 W_visible=9; paper=synthetic W_deposit=8 W_settle=9 W_visible=9.`
- `PIN 2 base-state widths: water10=9 water50=9 water90=9 (contract: 90 > 50 > 10 strictly)`

Production diff at RED commit: empty for `wet-layer.ts`, `fluids.ts`, `compositor.ts`, `canvas.ts`, `paint.ts` (RED commit contains only `physicsSettledFootprint.test.ts`).

## Task 3 Results

**Fix (single seam, wet-layer.ts only):** `transferToWetLayerClipped` now water-couples
the deposit:
- solid ribbon pixels (`a >= 250`) keep a near-full core deposit
  (`coreCarry = 0.7 + 0.3 * waterAmount` — never thins below 2r at any water);
- partial-alpha AA/bristle pixels carry with `aaCarry = waterAmount^6`, so the raster's
  1px fringe deposits under the wet-mask/visibility thresholds at low/default water
  (tight to the ribbon) and deliberately lifts at high water (spread knob).
No RNG, no time-based branching; paper adsorption (D-08), subtractive mixing (D-10),
and Porter-Duff opacity accumulation are untouched.

### Before / after widths (production transfer path, dense spacing; null paper — synthetic matches)

| water | BEFORE W_d / W_s / W_v | AFTER W_d / W_s / W_v | after total vs 2r |
| ----- | ---------------------- | --------------------- | ----------------- |
| 10    | 8 / 9 / 9              | **6 / 6 / 6**         | 0 (tight to ribbon) |
| 50    | 8 / 9 / 9              | **6 / 8 / 8**         | +2 (within 2px bound) |
| 90    | 8 / 9 / 9              | **8 / 9 / 9**         | +3 (deliberate spread) |

Strict monotonicity: 6 < 8 < 9 ✓. Stamp reference path unchanged (5/5/5).

### Gates

| Gate | Result |
| ---- | ------ |
| Footprint pins 1–3 | **4/4 passed** (`vitest run src/core/physicsSettledFootprint.test.ts`) |
| Package suite | **14/15 files, 142/143 tests** — only `EfxPaintEngine.liveAlphaCache.test.ts` fails; **confirmed pre-existing at base** (fails identically with wet-layer reverted to 98cb79c0; deferred from 260924-koa per plan) |
| App suite | **228 files passed / 2 skipped; 4268 tests passed** (`cd app && npx vitest run`) |
| Guardrail sweep | `git diff` **empty** for `canvas.ts`, `canvas.strokePreviewRibbon.test.ts`, `brush/paint.ts` |
| Exactly one seam file | `wet-layer.ts` only (+11/−1); `fluids.ts` / `compositor.ts` untouched |
| Texture guard (analytic) | Default-water d(b)=+2: fluid settle still softens the edge inside the bound — not a hard stamp; D-08 granulation path and darkenEdges/equalization left running; fix only scales deposit magnitude |
| Determinism | PIN 3 green post-fix (no RNG in carry curve) |
| New UI / deps | none |

**Confirmed verdict:** seam (a) at base; post-fix residual +2px at default water is
diffusion's intentional softening (within the plan's `2r + 2px` antialiasing tolerance),
not deposit inflation. Water coupling restored at the same seam.

Commits: Task 1 `eee2e629` (harness) · Task 2 RED `98cb79c0` (pins, tests-only) ·
Task 3 GREEN `24f40261` (wet-layer.ts fix).

**Final status: automated-ready** — native UAT (5 rows: default-water envelope match
side-by-side, Normal unchanged, water up/down spread, two-stroke held-pose identity,
wet edges/granulation + cursor unchanged) is for the user to run live.

## Known Stubs

None.

## Threat Flags

None — no new network/auth/file-IO/schema surface; fix is a pure arithmetic carry in an
existing buffer write path (threat register T-m7w-02 mitigation satisfied by pins + suites).

## Self-Check: PASSED

- FOUND: packages/efx-physic-paint/src/core/physicsSettledFootprint.test.ts
- FOUND: packages/efx-physic-paint/src/core/wet-layer.ts (modified, committed)
- FOUND commits: eee2e629 (Task 1), 98cb79c0 (RED), 24f40261 (GREEN)
- Guardrail diff empty: canvas.ts, canvas.strokePreviewRibbon.test.ts, paint.ts, fluids.ts, compositor.ts
- SUMMARY left uncommitted (orchestrator owns docs commit); status: complete

## Post-UAT: REVERTED (live regression, 2026-09-24)

Native UAT round 1 FAILED row 1/goal 2: the waterAmount^6 AA-fringe carry in
`transferToWetLayerClipped` (24f40261) applied a large transparency — the
settled stroke became quasi-invisible. The envelope was met by destroying
deposit opacity, which the automated pins could not see (they measure width,
not visibility).

Reverted in 1648658b: 24f40261 + 98cb79c0 + eee2e629 all rolled back;
`wet-layer.ts` is byte-identical to pre-task fdffc05f. Render restored.

**Diagnosis verdict still stands** (harness evidence, commit eee2e629 in
history): seam (a) deposit contributes +2px of the +3px inflation; fluid
settle +1px; compositor 0. The dead `depositToWetLayer` (5/5/5, no
inflation) remains the likely correct target for a follow-up fix — it never
had the opacity bug. A retry must bound footprint WITHOUT scaling deposit
alpha down (RED pin should include an opacity/visibility floor, not just
width).

## Closed: UAT-FAILED / REVERTED (2026-09-24)

Verdict (user, live): hard regression — GREEN 24f40261 implemented the
envelope bound as an ALPHA carry (lowered deposited alpha to hide the AA
fringe) instead of clipping deposit GEOMETRY to the ribbon. Stroke body
opacity crushed → near-invisible marks. Width pins passed while visibility
was destroyed (harness blind to opacity).

Disposition:
- 24f40261 stays REVERTED (1648658b) — never modulate alpha for a width bound
- eee2e629 (harness) + 98cb79c0 (pins) RESTORED at af621f91 — RED at base
  (2 failed | 2 passed) is the correct TDD state for the redo
- wet-layer.ts byte-identical to pre-task fdffc05f

Carry-over for redo quick: diagnosis verdict (seam (a) =
transferToWetLayerClipped, +2px of +3px) + harness reusable — cite, do not
redo diagnosis. Redo order: (1) add MISSING opacity/visibility-floor RED pin
first, (2) geometric deposit clip to ribbon, body alpha untouched,
(3) water monotone law w10/w50/w90 = 6/8/9 stands, (4) preview untouched
(260924-koa locked). STOP if a geometric clip hurts the wet look.
