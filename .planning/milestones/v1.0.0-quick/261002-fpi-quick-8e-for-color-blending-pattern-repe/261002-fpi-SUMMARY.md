---
phase: quick-261002-fpi
plan: 261002-fpi
type: tdd
status: complete
subsystem: paint
tags: [paint, brush, blending, pickup, raster, canvas2d, look-continuity, vitest]

requires:
  - phase: quick-260929-t2o
    provides: "capsule-sweep footprint + FootprintParams.tSpan + the per-segment pickup call site this quick deletes"
  - phase: quick-260930-wm6
    provides: "ONE-PIPELINE transfer law, measure-first gesture-stall readback accounting (S3), DEPOSIT_KEEP_TIER 40"

provides:
  - "ONE PIPELINE: rasterize() runs exactly one offscreen, one drawBristleFootprint (opac 1) and one transferToWetLayerClipped at EVERY Blending/pickup value — the `pickupAmt < 0.01` family switch and the fixed-step segment stamp loop are deleted"
  - "CONTINUOUS COLOUR: carried colours are applied as a per-sample source-atop recolour over the footprint silhouette BEFORE the transfer, in curve order — no more flat per-segment midpoint colour (the beaded repeating motif)"
  - "MONOTONE AMPLITUDE: pickup is now a single-process amplitude knob (0/25/50/75/100 deviation 0.000/7.378/16.528/26.774/37.351); pickup 0 is the same pipeline with a constant pure-picker colour input"

affects: [260930-wm6, 52.4, real-paint-06, look-continuity, native-UAT-paint]

actuals:
  tokens: 15146
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "colour-only source-atop recolour pass between footprint draw and wet transfer (alpha preserved by construction)"
    - "detector scope by canvas identity: S3 counts reads issued against the SOURCE canvas, not raster offscreens"

key-files:
  created: []
  modified:
    - packages/efx-physic-paint/src/brush/paint.ts
    - packages/efx-physic-paint/src/brush/paint.blendingContinuity.test.ts
    - packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts
    - packages/efx-physic-paint/src/core/gestureStallMeasurement.test.ts
    - .planning/quick/261002-fpi-quick-8e-for-color-blending-pattern-repe/261002-fpi-PLAN.md

key-decisions:
  - "The beaded repeating motif at Blending > 0 is a BUG, not a deliberate stamp: rasterize() inherited a v3.html-era loop slicing the curve into fixed steps (segLen 16, 30% overlap => step 12, 8 segments) and stamping each as an independent footprint with one flat midpoint colour. Verdict recorded, removal proceeded."
  - "Recolour runs AFTER drawBristleFootprint and BEFORE transferToWetLayerClipped reads the offscreen back; reversed order deposits the un-coloured silhouette while every structural pin stays green."
  - "Footprint opac is fixed at 1 on the unified path (the fresh-path law); the stroke opac is applied at TRANSFER as userOpacity. Passing stroke opac into the footprint re-creates opac-squared deposit and breaks monotonicity / blending-0 identity."
  - "pickup == 0 skips ONLY the snapshot + recolour data pass (the carried series is provably constant pure picker). It is a constant-colour INPUT shortcut, not a rendering family: pipeline shape is (1,1,1) for pickup in {0, 0.5, 1, 60, 100}."

requirements-completed: [QUICK-261002-FPI]

duration: 45min
completed: 2026-10-02
---

# Phase quick-261002-fpi: colour blending pattern repeat (QUICK 8e) Summary

**One continuous raster pipeline — a single footprint and a single transfer at every
Blending value, with carried colour applied as a continuous per-sample source-atop
recolour instead of a flat stamp per fixed segment.**

**VERDICT: done.** Native UAT passed 2026-10-02 — all four visual rows (a)-(d) approved.

## Why

At Blending > 0 the stroke rendered as a beaded chain of repeating stamps. Root cause
located in `paint.ts` `rasterize()`: a v3.html-era loop sliced the curve into fixed
segments and stamped each as an **independent** footprint carrying ONE flat colour taken
from the segment midpoint of `buildCarriedColors` — plus a second rendering family behind
the `pickupAmt < 0.01` threshold (look-continuity violation). Verdict: bug, not a
deliberate stamp.

## RED evidence — commit `2d05b1d6`

`test(261002-fpi): RED pins for blending periodicity + family switch`

Characterization block (probe has teeth — passes at RED, DELETED in Task 2):

- pipeline shape at **pickup 60 = `(8,8,8)`** (8 offscreens / 8 footprints / 8 transfers)
  vs pickup 0 = `(1,1,1)`; shape at pickup 1 also `(8,8,8)` — the 0.01 family boundary
  shows as a shape change between pickup 0.5 and 1
- legacy periodicity measured at the predicted step lag: **`segLen=16`, `step=12`
  (segLen − floor(segLen × 0.3)), `segs=8`**, curveLen 96
- **`r[lag]=0.481`, `medianOthers=-0.032`**, `peakDelta=0.513` at step lag 12

Target pins that FAILED at RED (the RED commit message records them verbatim):

- `ONE PIPELINE` — shape `(8,8,8)` not `(1,1,1)`
- `CONTINUOUS COLOUR` — `peakDelta 0.513 >= 0.3` (periodic peak at the legacy
  segment-step lag); `maxJump 8.19` (already ≤ 12 at RED)
- `RECOLOUR-ORDER + PATCH COVERAGE` — no source-atop carried-colour pass existed
- `MONOTONE AMPLITUDE` passed at RED (`0=0.000 25=7.583 50=17.292 75=28.208 100=39.292`)

## GREEN evidence — commit `75706546`

`feat(261002-fpi): one continuous pipeline with per-arc carried colour`

All four target pins in `paint.blendingContinuity.test.ts` pass:

| Pin | Measured GREEN |
|-----|----------------|
| ONE PIPELINE | shape **`(1,1,1)`** for pickup in `{0, 0.5, 1, 60, 100}` |
| CONTINUOUS COLOUR @ pickup 60 | `step=12  r[lag]=0.083  medianOthers=0.016  **peakDelta=0.067**  **maxJump=1.36**` (peakDelta < 0.3; RED was 0.513 at step lag 12. maxJump ≤ 12) |
| MONOTONE AMPLITUDE | deviation **`0=0.000 25=7.378 50=16.528 75=26.774 100=37.351`**, strictly increasing |
| PURE PICKER AT 0 | pickup 0 applies the pure picker colour at every sample (same pipeline, constant colour input) |
| RECOLOUR-ORDER + COVERAGE | recolour fillStyle writes come after the footprint fills and before `transferToWetLayerClipped`; each per-sample patch half-width (`radius * scales[si] + variance * 5 + 4`) ≥ the footprint's own lateral reach at that sample |

`drawBristleFootprint` body untouched — bristleSeed single-fill law and
`paint.depositSourceShape.test.ts` G1-G6 stay green with no edits to either file.

## Gate amendments (user-approved, landed inside `75706546`)

The two red gates left by the prior executor were approved with two *different* natures,
and the commit message distinguishes them explicitly:

### Gate A — `packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts:701`
**NATURE: TEXT-PIN RETIREMENT.**

- The assertion `pickup call site drawBristleFootprint(seg, ...) must exist` hard-pinned
  the legacy per-segment call the plan deletes, plus its dependent
  `expect(src.slice(segCall, segCall + 500), 'pickup call site must pass tSpan')`.
  Both dropped; the local comment now records the retirement and its reason.
- **KEPT:** the `FootprintParams declares tSpan` interface pin (lines 696-699) and every
  footprint-body pin in the file (capsule sweep, parcellaire convexity, continuous field,
  rim width, containment, Poisson, baked lateral profile, core sub-2 px). Nothing else in
  the file was weakened. The `it(...)` test title is untouched.

### Gate B — `packages/efx-physic-paint/src/core/gestureStallMeasurement.test.ts:381`
**NATURE: DETECTOR SCOPE CHANGE — NOT a text-pin retirement.**

- The unified path's transfer readback is full-canvas because `curveBounds` clamps to the
  320×160 harness canvas (on native 1920×1080 it is a bounded rect). It is the identical
  read the pickup-0 fresh path has always done; the old per-segment transfers were
  partial-width and therefore dodged the pin.
- The S3 detector now counts only reads issued against the **source** canvas: `ReadRec`
  carries `onSourceCanvas`, `makeCountingCanvas(reads, onSourceCanvas)` tags the surface
  (`true`) vs each `document.createElement` raster offscreen (`false`), and the assertion
  reads `pickup.sourceFullCanvasReads === 0`.
- **The bbox-scoped snapshot assertion is KEPT as the stall backstop** — not removed,
  weakened, or bypassed. The three `paint.ts` source-text scoping pins
  (`'paint-pickup-canvas-snap'` measured through `measurePrimitive`, and the
  not-`getImageData(0,0,width,height)` regex) are untouched.
- **No code-side alternative was taken:** no bound shrinking, no pickup-conditional
  bounds, no `wet-layer.ts` edit.

Neither amendment required touching anything beyond the described assertion/detector
scope, so no STOP was raised.

## What landed

| File | Change |
|------|--------|
| `packages/efx-physic-paint/src/brush/paint.ts` | `rasterize()` unified: one bounds, one offscreen, one `drawBristleFootprint(curve, {…, opac: 1})`, one `transferToWetLayerClipped` for every pickup value. `pickupAmt < 0.01` family switch and the whole segLen/overlap/per-segment stamp loop deleted. pickup > 0 runs the existing scoped snapshot + `paint-pickup-canvas-snap` / `paint-pickup-carried-colors` (names verbatim) then a source-atop colour-only per-sample recolour before transfer; pickup 0 skips snapshot/recolour. `drawBristleFootprint` body untouched. |
| `packages/efx-physic-paint/src/brush/paint.blendingContinuity.test.ts` | Task 2 mandate: characterization block DELETED; the four target pins remain and are GREEN. |
| `packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts` | Gate A: per-segment call-site text pin retired (2 assertions + comment). Interface and body pins kept. |
| `packages/efx-physic-paint/src/core/gestureStallMeasurement.test.ts` | Gate B: S3 detector scoped to source-canvas reads (`onSourceCanvas` tagging, `sourceFullCanvasReads/Pixels`); bbox-scoped snapshot assertion kept; log lines expose the new split. |

Commits: `29033ab7` (docs: create quick plan) → `2d05b1d6` (test: RED) → `75706546`
(feat: GREEN + the two gate amendments).

## Green commands (run verbatim, all passing)

```bash
cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run
#   -> Test Files 45 passed (45) | Tests 360 passed | 3 skipped (363) | 0 failed

cd /Users/lmarques/Dev/efx-motion-editor && pnpm --filter efx-physic-paint run check
#   -> tsc --noEmit, clean

# Task 2 verify set (7 files): 79/79 passed
cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run \
  src/brush/paint.blendingContinuity.test.ts src/brush/paint.continuation.test.ts \
  src/brush/paint.bristleSeed.test.ts src/brush/paint.depositSourceShape.test.ts \
  src/core/whiteSeamSourcePin.test.ts src/core/gestureStallMeasurement.test.ts \
  src/core/lookLawDigest.test.ts

# R8/R9/R10 guardian, explicit
cd /Users/lmarques/Dev/efx-motion-editor/packages/efx-physic-paint && ../../app/node_modules/.bin/vitest run src/brush/paint.depositSourceShape.test.ts
#   -> 12 passed (12)
```

Never watch mode. No dev server run (CLAUDE.md). pnpm only. No installs. No push.

## Guardrail scope proof

`git log --oneline 0ee6765f..HEAD` (this quick only):

```
75706546 feat(261002-fpi): one continuous pipeline with per-arc carried colour
2d05b1d6 test(261002-fpi): RED pins for blending periodicity + family switch
29033ab7 docs(261002-fpi): create quick plan
```

`git diff --name-only 0ee6765f..HEAD`:

```
.planning/quick/261002-fpi-quick-8e-for-color-blending-pattern-repe/261002-fpi-PLAN.md
packages/efx-physic-paint/src/brush/paint.blendingContinuity.test.ts
packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts
packages/efx-physic-paint/src/brush/paint.ts
packages/efx-physic-paint/src/core/gestureStallMeasurement.test.ts
```

Only allowed files. Guardrail file diff **EMPTY** (command returned no rows):

```bash
git diff --name-only 0ee6765f..HEAD -- \
  packages/efx-physic-paint/src/core/spreadScale.ts \
  packages/efx-physic-paint/src/brush/stroke.ts \
  packages/efx-physic-paint/src/brush/footprintLanes.ts \
  packages/efx-physic-paint/src/core/wet-layer.ts \
  packages/efx-physic-paint/src/core/paper.ts
# -> [empty]
```

`depositRoom` / `spreadCurveFor` / `physicsTicks` / shape-detail deform behaviour are
asserted unchanged by `paint.depositSourceShape.test.ts` (12/12) and
`brush/shapeDetail.test.ts` (10/10), both green with zero edits. `lookLawDigest.test.ts`
transfer-site count went 6 → 5 occurrences and its assertion is `>= 3`, so it passes
**unamended** — no gate edit was needed and none was made.

## Deviations from Plan

**1. [User-approved amendment] Gate A — text-pin retirement in `paint.bristleSeed.test.ts`**
- **Found during:** prior executor's Task 2 checkpoint (2 red gates)
- **Issue:** the `drawBristleFootprint(seg, ...)` call-site text pin hard-coded the segmented implementation the plan deletes
- **Fix:** drop that pin and its dependent assertion only; tSpan interface + footprint-body pins kept
- **Committed in:** `75706546`

**2. [User-approved amendment] Gate B — detector scope change in `gestureStallMeasurement.test.ts`**
- **Found during:** prior executor's Task 2 checkpoint (2 red gates)
- **Issue:** S3 counted every whole-canvas-sized `getImageData`, including the unified path's offscreen transfer readback (byte-identical to the fresh path's read)
- **Fix:** tag each read with `onSourceCanvas`; S3 asserts only on source-canvas reads. bbox-scoped snapshot assertion kept as the stall backstop. No code-side alternative used
- **Committed in:** `75706546`

**3. [Plan artifact not needed] `lookLawDigest.test.ts` amendment never became necessary**
- The plan's `artifacts`/`files_modified` listed a transfer-site count amendment. The
  unified path leaves 5 occurrences and the assertion is `>= 3`, so it passes unamended.
  Editing it anyway would have been a forbidden gate edit — the file diff is EMPTY.

**4. [Scope-proof command corrected] plan Task 3's `git diff --name-only main...HEAD` filter**
- That command spans the whole `feat/v1.0.0-new-brush` branch (119 commits, 129 files) and
  cannot isolate this quick. Scope was proven against this quick's own commit range
  `0ee6765f..HEAD` as instructed. Result above.

**5. [Note] `shapeDetail.test.ts` was NOT modified** — its `countOcc('deformSampleSides(')`
  and `countOcc('seededRng(')` pins are already `1` at the base and the unified recolour
  deliberately does not call `deformSampleSides` a second time, so no test edit was
  required. `shapeDetail` 10/10 green.

**Total deviations:** 4 (2 user-approved gate amendments, 2 plan-artifact/command corrections).
**Impact on plan:** no scope creep — guardrail files untouched, no gate weakened beyond the
two approved amendments.

## Known Stubs

None. No placeholder values, no TODO/FIXME introduced, no unwired data source.

## Native UAT — PASSED 2026-10-02 (all rows approved)

- **(a)** Blending raised smoothly mixes stroke and surface color — no periodic beads along the stroke. **PASSED**
- **(b)** Result is irregular/natural, not a repeating stamp. **PASSED**
- **(c)** Blending 0 to 100 is monotone: more mixing, never a different artifact. **PASSED**
- **(d)** Blending 0 = identical to today's clean single-color look. **PASSED**

## Next Phase Readiness

Native UAT approved 2026-10-02. The recolour patch half-width under-coverage risk
(picker-coloured streaks inside the stroke) was judged live and did not appear.

## Self-Check: PASSED

- FOUND: `.planning/quick/261002-fpi-quick-8e-for-color-blending-pattern-repe/261002-fpi-SUMMARY.md`
- FOUND: `29033ab7`, `2d05b1d6`, `75706546`
- No stub patterns (TODO / FIXME / placeholder / "coming soon" / "not available") in any
  file changed by this quick
- Guardrail diff EMPTY on `spreadScale.ts` / `stroke.ts` / `footprintLanes.ts` /
  `wet-layer.ts` / `paper.ts`

---
*Phase: quick-261002-fpi*
*Completed: 2026-10-02*
