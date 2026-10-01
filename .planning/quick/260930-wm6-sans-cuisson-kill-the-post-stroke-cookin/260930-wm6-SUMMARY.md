---
phase: quick-260930-wm6
plan: 260930-wm6
subsystem: efx-physic-paint (drying/transfer) + physic-paint tool rail
tags: [quick, tdd, one-look-law, drying, cooking-window, tool-rail]
dependency_graph:
  requires: [260930-q6t-superseded, 260928-dh1-cleared]
  provides: [sans-cuisson-engine, one-look-law-transfer, six-action-rail]
  affects: [SPECS/real-paint/08-retire-fluids wave 1]
tech_stack:
  added: []
  patterns: [telescoping-f-delta-transfer, source-shape-kill-pins, identity-memo-pair-edit]
key_files:
  created: []
  modified:
    - packages/efx-physic-paint/src/core/drying.parity.test.ts
    - packages/efx-physic-paint/src/core/drying.continuity.test.ts
    - packages/efx-physic-paint/src/core/drying.bboxLoss.test.ts
    - packages/efx-physic-paint/src/core/drying.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
    - packages/efx-physic-paint/src/types.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.previewBaseImageCache.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts
    - app/src/components/physic-paint/performance/depositSpeckleCapture.ts
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
decisions:
  - "One look law everywhere: every wet-to-dry transfer alpha is wetDisplayAlpha(alpha, pixelOpacity, sampleH(...))/255 — parity test is the only parity target"
  - "Fractional transfer = telescoping f-delta (f(before) − f(after)) so a full dry clock conserves exactly to the full-dry byte"
  - "Cooking window deleted, not gated: no replacement timer; wet stays live at lift and every existing flush point persists it (D4)"
  - "drySpeed control surface deleted; the solver receives the literal 100 — cadence not retuned"
  - "Rail removal stops at the rail + Studio wiring; solver-session layer (startPhysics/stopPhysics/activePhysicsAction) kept (D5)"
status: automated-ready
actuals:
  tokens: 18522
  tasks: 3
  commits: 5
metrics:
  duration: "41m commit window (00:05–00:46 CEST); Task 1 RED authored earlier in session"
  completed: 2026-10-01
plan_head_before: f0ad0c10e7106706364263129717704027f5c119
commits: 5
---

# Phase quick-260930-wm6 Plan 260930-wm6: sans-cuisson Summary

The post-stroke cooking window is deleted and every wet-to-dry transfer (fractional, full-dry, finalize, forceDryAll) now computes its alpha through the ONE LOOK LAW — `wetDisplayAlpha(alpha, pixelOpacity, sampleH(paperHeight, x, y, w, h)) / 255` from `render/compositor.ts` (imported, never edited), fast path included — proven byte-for-byte against the display over a 54-sample grid; the tool rail drops from nine actions to six.

**Accepted tradeoff (verbatim):** "the slow post-stroke densification is gone. The stroke freezes on what the solver produced at lift."

## Status: automated-ready

The four native UAT rows are user-judged and PENDING — nothing is `done`:

- **(a)** end-of-stroke look == persisted look == reloaded look, pixel digest equal — **pending**
- **(b)** the three removed tool-rail actions are gone from the UI and paint / paint-physics / erase / undo / redo / clear still work — **pending**
- **(c)** no post-stroke densification (the accepted tradeoff, judged by eye) — **pending**
- **(d)** already-dried content still renders (clean break, no migration) — **pending**

## Commit series (5, measured from the ledger)

Base `plan_head_before`: `f0ad0c10` — `git rev-list --count f0ad0c10..HEAD` = **5**.

| # | Hash | Message |
|---|------|---------|
| 1 | `f44ef3b4` | test(260930-wm6): one-look-law byte-for-byte finalize parity (RED) |
| 2 | `cfdffe46` | test(260930-wm6): re-pin continuity + bboxLoss to the one look law, pin the kill list (RED) |
| 3 | `3e8009b4` | feat(260930-wm6): one look law — wetDisplayAlpha is the only transfer law (GREEN) |
| 4 | `289ab25a` | feat(260930-wm6): kill the post-stroke cooking window and the drySpeed path (GREEN) |
| 5 | `591ec5cc` | feat(260930-wm6): remove dry + apply-physics actions from the paint tool rail |

Ordering guard satisfied: RED commits precede both GREEN commits.

## RED evidence

- **Task 1 (`f44ef3b4`):** `drying.parity.test.ts` pin B (compositeWetLayer display bytes == `round(wetDisplayAlpha(...))` over the 54-sample grid) PASSES at base; the one-look-law target FAILS at base with per-sample assertion output — forceDryAll transferred through the linear /800 model with no paper input, so dry bytes ≠ display bytes.
- **Task 2 RED (`cfdffe46`):** 10 failed / 4 passed across the three drying test files — every failure an AssertionError (kill-list source pins naming the existing carve//800/cooking-window symbols; behavioral pins expecting the display law; bboxLoss call re-signed so the extra args land wrong). No crashes, no zero-test discovery.

## GREEN anchors

**One look law call sites (`wetDisplayAlpha`/`sampleH`):**
- `packages/efx-physic-paint/src/core/drying.ts:107` — dryStep full-dry branch
- `packages/efx-physic-paint/src/core/drying.ts:145-146` — dryStep fractional telescoping f-delta (`f(before) − f(after)`; dh1 `sa > 0` continuous transfer preserved)
- `packages/efx-physic-paint/src/core/drying.ts:233` — forceDryAll (new required `paperHeight` param at position 7)
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — six forceDryAll sites thread `this.paperHeight`: `:1341`, `:1367`, `:2710`, `:2884`, `:3005`, `:3022` (a missed thread = compile error; `tsc --noEmit` clean)
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts:254` — `bakeParityPaperMods` re-pointed to the display-law paper response; no carve formula left in the engine

**Deleted symbol inventory (kill-list pins green in `drying.continuity.test.ts`):**
- `drying.ts`: `/800`, `/ 800`, `1.4 - `, `0.3, 1.4`, `pixelOpacity < 0.99`, `sa > 0.005`, `drawBristleTraces`, `Math.random` — all gone; `const DRY_ALPHA_THRESHOLD = 1` and `wetDisplayAlpha` present
- `EfxPaintEngine.ts`: `startNaturalDrying`, `stopNaturalDrying`, `DRYING_QUIET_MS`, `dryingInterval`, `setDrySpeed`, `drySpeed` — all gone (no wall-clock timer mutates paint buffers after finalize; dryStep reachable only via physicsStep/replayDiffusionFrame)
- `types.ts`: `EngineState.drySpeed` deleted; solver receives literal `100` at `EfxPaintEngine.ts:1266` and `:3296` (fixed default — cadence not retuned)
- Fixtures updated: liveAlphaCache, previewBaseImageCache, cooperativeFinalization.contract.red; `depositSpeckleCapture.ts` lost `eng.setDrySpeed(100)` + interface member

**Task 3:** rail renders exactly six items (paint, paint-physics, erase, undo, redo, clear-frame); `PhysicsPaintHoldButton`, the three icon imports, the three union members, the four rail-only props, the dry dispatch and the hold render branch are gone; Studio lost the `dryPaint` callback, the `startPhysics/stopPhysics` destructure, and the toolRail identity-memo deps+factory were edited **as a pair** (deps now enumerate exactly what the factory reads — efx-preact-reactivity law). Solver-session layer untouched (D5).

## Verification

- Full package suite: **37 files, 287 passed, 3 pre-existing skips** (`vitest run`, never watch)
- Guard batteries with ZERO edits, all green: `compositor.displayMapping.test.ts`, `spreadScale.test.ts`, `physicsSettledFootprint.test.ts`, `productionAaSettleMeasurement.test.ts`
- Targeted app tests (view + engine + `PhysicsPaintStudio.test.ts`): **46 files, 1001 passed**
- Both typechecks: `pnpm --filter @efxlab/efx-physic-paint check` + `pnpm --filter efx-motion-editor typecheck` — clean
- Full app suite: **231 files passed, 1 pre-existing failure (deferred below), 2 skipped**
- Plan greps: neither rail file references `physics-last`, `physics-all`, `PhysicsPaintHoldButton`, `id: 'dry'`, or `onDryPaint` — clean

## Deviations from Plan

**1. [Rule 1 - Bug] `Math.fround` needed on the fractional wet-drain pin**
- **Found during:** Task 2 GREEN A verification
- **Issue:** `wet.alpha` is a Float32Array — storing an f64 `alphaAfter` rounds to f32, so `toBeCloseTo` (tolerance 5e-11) failed at 4.47e-8.
- **Fix:** pin through `Math.fround(before - drain)` for an exact match both sides, with a comment explaining the f32 store rounding.
- **Files modified:** `packages/efx-physic-paint/src/core/drying.continuity.test.ts`
- **Commit:** 3e8009b4

**2. [Rule 1 - Bug] Kill-pin self-sabotage via comments (three times)**
- **Found during:** Task 2 GREEN A/B source edits
- **Issue:** the source-shape kill pins grep the raw source — my own doc/tombstone comments contained the literal dying strings (`/800`, `DRYING_QUIET_MS, dryingInterval`, `drySpeed`).
- **Fix:** reworded to "No linear density divisor", "its quiet-period constant, its interval field", "dry-speed state field" — comments now describe the deletion without tripping it.
- **Files modified:** `drying.ts` header, `EfxPaintEngine.ts` tombstone + physicsStep comments
- **Commit:** 3e8009b4 / 289ab25a

**3. [Rule 3 - Blocking] Unused `dryStep` import after cooking-window deletion**
- **Found during:** Task 2 GREEN B
- **Issue:** deleting `startNaturalDrying` removed the engine's only `dryStep` call site, leaving an unused import (typecheck risk).
- **Fix:** import trimmed to `initDryingLUT, forceDryAll`.
- **Files modified:** `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`
- **Commit:** 289ab25a

**4. [Scope - pre-existing, NOT fixed] `physicsPaintPerformanceTrace.test.ts` fails the full app suite**
- **Found during:** Task 3 full app suite run
- **Issue:** the native-profile pin at `:236` does not list the `enabled: isPhysicsPaintProfilingEnabled` key that superseded quick 260930-q6t added in `4e064c41` (ancestor of HEAD). Both files are byte-identical to HEAD — the failure predates this quick.
- **Action:** logged to `deferred-items.md` in this directory; SCOPE BOUNDARY — out of this quick's scope, not fixed.
- **Status:** open

None other — the plan executed as written. No forbidden file appeared in the diff: `compositor.ts` READ-ONLY (imported, never edited), `spreadScale.ts` / `fluids.ts` / `wet-layer.ts` / `diffusion.ts` untouched, no `traceSeed`/held-pose changes, no `applyPaperPass`/paper-tooth changes, no `package.json`/`pnpm-lock.yaml`/`ROADMAP.md` changes, `physicsTicks`/`dt`/iteration counts/`bounds` scoping untouched, no width-via-opacity, no replacement wet simulator, no dried-content migration.

## Scope-guard diff file list (ledger..HEAD — exactly the 12 plan-listed files)

```
app/src/components/physic-paint/PhysicsPaintStudio.tsx
app/src/components/physic-paint/performance/depositSpeckleCapture.ts
app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
packages/efx-physic-paint/src/core/drying.bboxLoss.test.ts
packages/efx-physic-paint/src/core/drying.continuity.test.ts
packages/efx-physic-paint/src/core/drying.parity.test.ts
packages/efx-physic-paint/src/core/drying.ts
packages/efx-physic-paint/src/engine/EfxPaintEngine.cooperativeFinalization.contract.red.test.ts
packages/efx-physic-paint/src/engine/EfxPaintEngine.liveAlphaCache.test.ts
packages/efx-physic-paint/src/engine/EfxPaintEngine.previewBaseImageCache.test.ts
packages/efx-physic-paint/src/engine/EfxPaintEngine.ts
packages/efx-physic-paint/src/types.ts
```

12 files, 396 insertions(+), 439 deletions(-). No file deletions in any commit.

## Known Stubs

None — no placeholder values, no TODO/FIXME left, no unwired data sources.

## Threat Flags

None — no new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes were introduced.

## Self-Check: PASSED

- 7/7 key files found on disk (including this SUMMARY)
- 5/5 commits found in history (`f44ef3b4`, `cfdffe46`, `3e8009b4`, `289ab25a`, `591ec5cc`)
- `commits: 5` measured via `git rev-list --count f0ad0c10..HEAD` (ledger on disk), not narrated

---

# Revision R1 — preview == settled (2026-10-01)

**Trigger: native UAT FAILED.** The one look law unified the wet layer's two
OUTPUT paths (display + dry transfer). It never touched the INPUT side, where
a THIRD path was still lying to the eye. The user reported "it's not fixed, and
stroke seem cooking again… the initial stroke render is altered with time, and
the cache seem store the wrong image state", with two screenshots — shot 1
dense and solid, shot 2 light and skeletal.

## Diagnosis: three render paths, and the eye judged the wrong one

| | radius | raster | alpha law | physics |
|---|---|---|---|---|
| `tier='live'` (the preview) | `fullR` | `drawBristleFootprint` blitted **straight onto the dry canvas**, `LIVE_WIDTH_MUL=4`, no keep-gate | raw canvas alpha | none |
| `tier='final'` (what persists) | `depositR = fullR·(1−depositRoom)` (half at Spread 65, R8) | `transferToWetLayerClipped`, `DEPOSIT_KEEP_TIER=70`, D-08 paper adsorption | `wetDisplayAlpha` | R9 `physicsTicks` solver |

The engine *showed* the first and *persisted* the second. On finalize it
restored `active.liveSnapshot`, erasing the blit, then deposited the reduced
clone. Which look the cache captured depended on when the capture ran relative
to that swap — hence "the cache stores the wrong image state". And the swap
being deferred read as "altered with time" / "cooking again".

Neither screenshot is the target. Shot 1 is the solid raw blit (that is
Paint's job, via `paint-width`); shot 2 is the strangled deposit.

## User decision (2026-10-01) — the binding scope

> Keep the physics pipeline intact (R8 `depositRoom`, `physicsTicks` Stam
> solver, `wetDisplayAlpha` READ-ONLY, `spreadScale.ts` byte-untouched). Tune
> only the three knobs that strangle the deposit **before** the solver:
> keep-gate 70 → lower, deposit scale → higher, D-08 paper adsorption →
> tuned. Target look = dense + physics texture (not the solid raw blit).
>
> Preview, screen-at-lift, cache and reload must all show that one look.
> Preview goes through the same pipeline as settled (required for the
> byte-equal digest). The timing + cache-capture fixes land regardless.
>
> Acceptance is native UAT by eye (no metric gate on the look). The byte-equal
> digest preview == cache == reloaded is the standing mechanical gate.
>
> Tradeoff accepted: one eye-tuned pass on three knobs, and the result is
> dense + physics texture — never the solid raw blit of screenshot 1. That
> solid look is Paint's job.

Answering the user's explicit question ("does this address the
`preview==settled` equality or just the timing?"): **both.** Timing alone was
never going to be enough — it only moves the surprise.

## What R1 changed

**Three named deposit knobs** (`core/wet-layer.ts`, the only look levers):

| lever | was | now | why |
|---|---|---|---|
| `DEPOSIT_KEEP_TIER` | `70` | `40` | it ate the bristle speckle → "lost consistency" |
| `DEPOSIT_DENSITY_SCALE` | bare `(a/255)*3000` | named, `4500` | thin mid-tones |
| D-08 adsorption | floor `userOpacity²`, `gamma 0.8` | floor `userOpacity` (linear), `gamma 0.5`, `delta 1.2` named | 50% opacity deposited 25% |

All four deposit functions share the named levers. `compositor.ts`'s
`DENSITY_NORM` is the DISPLAY normalizer and is untouched — the scale changes
only what the deposit WRITES, so a denser deposit is what the solver spreads.

**One pipeline** — the raw blit third path is deleted. Every deposit goes
`transferToWetLayerClipped` → R9 solver → `wetDisplayAlpha`, on the R8-reduced
clone. `ctx.drawImage` is gone from `paint.ts`; `active.liveSnapshot` /
`liveBounds` and their restore are gone from the engine; the separate second
`renderPaintStroke` pass is gone (the raster continuation IS the deposit).

**One landing** — revealed only in `completeActiveStrokeFinalization`, after
the `physicsTicks` solver has finished. Step turns leave `displayCompositeDirty`
alone, so no half-deposited or mid-solver state is ever painted.

**Cache capture** — `copyLiveAlphaCanvas` settles in-flight finalization before
reading pixels, *conditionally* so the 52.1 idle resolve path stays a fast
copy (the no-eager-flush pin is preserved).

## Standing mechanical gate

`core/lookLawDigest.test.ts` — **19 pins, green.** At settle, the paint bytes
are identical whether read from the screen export, the cache capture, or a
reload of that cache. Byte-equal. The four invariants it stands over:

1. **one pipeline** — raster never writes the dry canvas; engine never takes
   `tier='live'`; no `liveSnapshot`; every raster branch deposits through the
   one transfer; the live raster writes paint into the wet buffers
2. **one landing** — `stepInteractivePaintFinalization` never marks the display
   dirty; the solver completes before `finishInteractivePaintFinalization`;
   `completeActiveStrokeFinalization` is what reveals
3. **cache == preview** — `copyLiveAlphaCanvas` composes dry-then-display
   exactly like `exportCompositeCanvas`; flushes when work is queued; stays a
   fast copy when idle; background subtraction only zeros pixels equal to the
   background on all four channels
4. **three knobs** — keep-gate `< 70`, density scale `> 3000`, linear
   `userOpacity` floor, named gamma/delta not hardcoded at `paint.ts` call
   sites

## Pin re-points (laws kept, calibration unhardcoded)

None of these touched R8/R9 or the display law. Each pin's *law* survives; only
the now-tunable literal moved.

- `physicsSettledFootprint` / `physicsWidthScaling` / `productionAaSettleMeasurement`
  — **PIN 0 "body deposit is UNMODULATED by tier/water"** recomputes its
  expectation from `DEPOSIT_DENSITY_SCALE` + `PAPER_ADSORPTION_*` instead of
  `3000`/`0.8`/`1.2`. The anti-modulation guard (m7w 24f40261 / revert 1648658b)
  stays armed; the bound is still ratio ∈ [0.99, 1.01].
- `paint.depositSourceShape` **G6** — now pins the keep tier's *shape* (a named
  integer `const`, never inlined or computed); `DRY_ALPHA_THRESHOLD = 1` stays
  pinned to the byte (not a look lever). Value bound lives in `lookLawDigest`.
- `paint.bristleSeed` **D-07 gate** — was "tier=live emits zero wet-transfer
  stages", the exact third path. Now "EVERY tier emits exactly one wet-transfer
  and mutates wet.alpha" (one pipeline).
- `cooperativeFinalization.contract.red` — the two-pass `'finalize'` phase is
  deleted; raster completion goes straight to `'post-raster'`.
- `depositGateFieldMeasurement` — `GATE_TIER` reads `DEPOSIT_KEEP_TIER` rather
  than mirroring `70`, so the diagnosis tracks the lever.

## Verification (R1)

- Full package suite: **38 files, 306 passed, 3 skipped** (`vitest run`)
- `lookLawDigest.test.ts`: **19/19**
- Both typechecks clean
- **`spreadScale.ts` and `compositor.ts` `git diff --stat` EMPTY** — byte-untouched

## Commit series (R1, 3 commits)

| # | Hash | Message |
|---|------|---------|
| 1 | `fa91ade5` | test(260930-wm6): RED — look-law digest gate, preview == cache == reloaded |
| 2 | `b61358bc` | feat(260930-wm6): three named deposit knobs — the only look levers |
| 3 | `26e89093` | feat(260930-wm6): one pipeline, one landing — delete the raw blit third path |

Ordering guard satisfied: RED precedes both GREEN slices.

## Status after R1: automated-ready — look NOT judged

The mechanical gate is green and the two UAT-critical promises hold by
construction (`preview == settled == persisted == reloaded`, byte-equal). The
**look itself is unjudged** — the three knob values are a first eye-tuned pass
and will need a native UAT pass to accept or re-tune.

**Native UAT rows (all PENDING, nothing is `done`):**
- **(a)** the settled look reads **dense + physics texture** (by eye) — the three
  knobs are the levers if not
- **(b)** preview at lift == after leave/return == after Studio close (the
  byte-equal digest is the mechanical gate; this is the eye's confirmation)
- **(c)** no post-stroke change after the look lands (one landing, by eye)
- **(d)** already-dried content still renders (clean break, no migration)

**Do not reopen:** the 260928-dh1 paper hunt, bbox flush-loss, the leave-key
settle-through gate, the /800-vs-Beer-Lambert unification, the bake-speed
question (it dies with the cook).

**Sequence unchanged (do not reorder):** 1 `sans-cuisson` (this) → 2
`paint-width` → 3 `06-libmypaint-rasterizer` → 4 `08-retire-fluids` finished →
5 `07-paint-script`.

---

# Revision R2 — gesture stall + white seam (measure-first, one fix per defect)

Look UAT on R1 **PASSED** (Option 3 accepted: dense + physics texture, stable).
Knobs `DEPOSIT_KEEP_TIER 40` / `DEPOSIT_DENSITY_SCALE 4500` / `PAPER_ADSORPTION_GAMMA 0.5`
**stand** — not re-tuned here. Two pre-existing defects were scoped for R2 with a
binding order: **measure first, then one fix per defect.** `spreadScale.ts` and
`compositor.ts` stay byte-untouched.

## Defect 1 — mid-stroke gesture stall

**Named suspects (user's order):** (S1) previous-stroke finalize/solver drain
competing with the next gesture; (S2) `getImageData` per `transferToWetLayerClipped`;
(S3) full-canvas `getImageData` on the pickup path (`paint.ts:576`); (S4) R1 made
finalize heavier.

### The targeted log — `core/gestureStallMeasurement.test.ts`

Every readback the real raster+transfer path performs is counted (calls, pixels,
whether it reads the WHOLE source canvas) alongside the `measurePrimitive` stage
table. The engine-side hot path is inventoried the same way.

**Verdicts:**

| Suspect | Verdict | Evidence |
|---|---|---|
| **S3 pickup snapshot** | **THE WRITER — fixed** | Exactly **1 whole-source-canvas readback** on the pickup path: `paint-pickup-canvas-snap`, `getImageData(0, 0, width, height)` = **2,073,600px at 1080p**, paid before a single segment rasterizes. Its only consumer is `sampleAreaColor`'s `ceil(radius/2)` disc around each curve point. |
| S2 per-transfer readback | not the stall | 7 bounded `getImageData(0, 0, bounds.w, bounds.h)` reads, 22k–27k px each (~1.2% of a 1080p readback). Bounded by design. |
| S1 in-gesture preview | **EXONERATED** | `drawStrokePreview` = 0.030 / 0.033 / 0.078 / **0.310 ms/move** at n = 16 / 64 / 256 / 1024. Cheap and sub-linear. |
| S1 finalize drain | **NAMED, NOT FIXED** (one-fix-per-defect) | See below. |
| S4 finalize weight | folded into S1 | The full-canvas readbacks at finalize start (`captureUndoSnapshot`) and cache capture (`copyLiveAlphaCanvas`) are in the inventory; the R1 one-deposit change did not add a new one. |

**Hot-path inventory (12 full-canvas `getImageData` sites):** `seededRng` ×2,
`setBackgroundImageUrl`, `startPhysics`, `clearWetLayer`, `copyLiveAlphaCanvas` ×2,
`captureUndoSnapshot`, `measureBakeParityDrySplit`, `sampleBakeParityExport` ×2,
`resetReplaySurface`. Plus bounded rects in `prepareWetLayerForStroke` and the
transfer paths, and a 1px probe in `warmCanvasSurfaces`.

**S1 finalize drain — the named-but-not-fixed finding (the next suspect if the
stall survives UAT):**

- `runScheduledStrokeFinalizationFrame` **is** idle-gated
  (`state.drawing || idle < STROKE_FINALIZATION_IDLE_MS(400) || hasPendingInput()`).
- `flushPendingStrokeFinalizations()` is an **unbounded** `while (pending || active)
  runStrokeFinalizationTurn(true, Infinity, Infinity)`.
- `hasPendingInput()` reads `navigator.scheduling?.isInputPending?.({ includeContinuous: true }) ?? false`.
  **`navigator.scheduling` is absent in WKWebView (Tauri/macOS)** → always `false`
  → the cooperative turn can never yield to input on the native target.

So every `flushPendingStrokeFinalizations()` call site is an unbounded synchronous
drain that cannot see the next gesture arriving. This is logged with source pins;
it is **not** changed here because the rule is one fix per defect and S3 is the
measured writer on this path.

### Fix 1 (the one fix) — scope the pickup snapshot to the curve footprint

`paint.ts`: `paint-pickup-canvas-snap` now reads `getImageData(snapX, snapY, snapW, snapH)`
— the curve bbox ± `ceil(radius/2)+1` (the disc `sampleAreaColor` actually samples) —
and `buildCarriedColors` takes the snap origin so `sampleAreaColor` indexes into the
scoped buffer. Measured effect on the harness (320×160): whole-source readbacks
**1 → 0**; the snap is now 250×46 = 11,500px (**~0.6%** of a 1080p readback, was 100%).
Stage `paint-pickup-canvas-snap` drops 0.32ms → 0.09ms in the harness.

## Defect 2 — white cuts / full block outline through the paint

**Named suspects (user's order):** (a) bbox clipping on the segmented pickup path
(`paint.ts:581-601`, 30% overlap, per-segment `segBounds` offscreen — "that rectangle
matches the trace of a block"); (b) `copyLiveAlphaCanvas` torn extraction (pinned,
never fixed — `copyLiveExtractionTornEdge.test.ts`); (c) paper tile seams.

### The source pin — `core/whiteSeamSourcePin.test.ts`

`detectCuts(alpha, w, h)` reports axis-aligned cut runs (the visible symptom). Each
suspect is probed so the failure mode names the writer.

**Verdicts:**

| Suspect | Verdict | Evidence |
|---|---|---|
| (a) bbox / offscreen clip | **EXONERATED** | Real `drawBristleFootprint` hull vertices recorded per offscreen: **94,710 verts (pickup=60) / 76,230 (pickup=0), clippedVerts = 0**. The canvas never hard-clips a vertex — the "block outline" is not `segBounds`. |
| (b) torn extraction | not re-derived | `copyLiveExtractionTornEdge.test.ts` already feeds a CLEAN dry layer through the real `copyLiveAlphaCanvas` and scores `tornEdge=0`. Its numbers exonerate the extraction for clean input. |
| **(c) paper tile seams** | **THE WRITER — fixed** | A plain repeat of a photographed `paper_*.jpg` steps **0.8000** at every tile boundary vs **0.0323** interior. That step IS the horizontal+vertical cut grid and one tile's block outline. Fractional `tileScale` (2048/1920) steps **0.0686** vs 0.0457 interior even on a seamless source. |
| (d) solver vs dry region | logged, NOT the writer | `brushR=16 water=50 spread=65` → `dryHalf=16`, `solverHalf=26`, overflow band 10px/side. The pin's own note: *"an orphaned wet ring shows as a HALO (extra paint), not a white cut."* |

**Why (c) writes a white cut:** `loadPaperTexture` tiles the source with plain
`drawImage` repeat. A photographed tile's left edge ≠ its right edge, so `sampleH`
hands a height **step** to `wetDisplayAlpha`'s `paperMod` and to D-08's adsorption at
every tile boundary — a brightness cut through the paint, in a grid, one tile's
outline. The fractional-`tileScale` case adds a second seam: each cell's own
`drawImage` resample clamps at that cell's edge.

### Fix 2 (the one fix) — mirror-tile the paper

`paper.ts`: `loadPaperTexture` now mirrors alternate cells (`flipX = ix % 2 === 1`,
`flipY = iy % 2 === 1`, `tx.scale(±1, ±1)`). Both sides of a shared boundary read the
same source pixels, so **ANY** source tiles seam-free — and the fractional-tileScale
resample seam goes with it. `conditionHeightMap` and `sampleH` unchanged.

Measured effect: non-seamless boundary step **0.8000 → 0.0000**; fractional
boundary step **0.0686 → 0.0198** (below the 0.0457 interior floor).

## Verification (R2)

- Two harnesses: **15/15** (`gestureStallMeasurement` 7, `whiteSeamSourcePin` 8)
- Full package suite: **40 files, 321 passed, 3 skipped**
- `pnpm --filter @efxlab/efx-physic-paint check` + `pnpm --filter efx-motion-editor typecheck`: **clean**
- App suite: **4346 passed**, 1 pre-existing failure (`physicsPaintPerformanceTrace.test.ts:236`,
  the superseded-q6t `enabled` key, in `deferred-items.md` — out of scope)
- **Guardrails held:** `spreadScale.ts` / `compositor.ts` / `wet-layer.ts` `git diff --stat` **EMPTY**
- **Look knobs stand:** `DEPOSIT_KEEP_TIER = 40`, `DEPOSIT_DENSITY_SCALE = 4500`, `PAPER_ADSORPTION_GAMMA = 0.5`
  (asserted by a "look knobs stand" test in both harnesses)

## Status after R2: automated-ready — native UAT PENDING

Nothing is `done`. The two fixes are in and the pins are green; the eye decides.

**Native UAT rows (all PENDING):**
- **(a)** mid-stroke: the brush no longer stalls and the gesture completes. If the
  stall persists, the logged S1 drain structure (unbounded `flushPendingStrokeFinalizations`
  + dead `hasPendingInput` in WKWebView) is the next named suspect.
- **(b)** no more horizontal/vertical white cuts through the paint; no more full
  block outlines (the paper-tile mirror is the fix).
- **(c)** the accepted look is unchanged: dense + physics texture, knobs 40/4500/0.5.
- **(d)** preview == cache == reloaded still byte-equal (`lookLawDigest.test.ts` stays green).

**Do not reopen:** the 260928-dh1 paper hunt, bbox flush-loss, the leave-key
settle-through gate, the /800-vs-Beer-Lambert unification, the bake-speed question.

**Sequence unchanged (do not reorder):** 1 `sans-cuisson` (this) → 2
`paint-width` → 3 `06-libmypaint-rasterizer` → 4 `08-retire-fluids` finished →
5 `07-paint-script`.

## Commit series (R2, 3 commits)

| # | Hash | Message |
|---|------|---------|
| 1 | `4699fe02` | test(260930-wm6-r2): RED — measure-first gesture log + white-seam source pin |
| 2 | `dc87ee6e` | fix(260930-wm6-r2): scope the pickup snapshot to the curve footprint |
| 3 | `295c5e9f` | fix(260930-wm6-r2): mirror-tile paper so height map has no tile-boundary step |

Ordering guard satisfied: the RED pin commit precedes both GREEN fix slices
(S3 flips GREEN with commit 2; the two mirrored (c) pins flip GREEN with commit 3).

---

# Revision R3b — residual white seams are TRUE HOLES (paper exonerated)

Date: 2026-10-01 · branch `feat/v1.0.0-new-brush` · one fix only

## Context carried in

R2's paper-tile mirror landed and the user **still** sees seams. A separate,
unrelated defect ("come back on the key and the paint looks faded and poor") was
already fixed in the working tree as `EfxPaintEngine.ts` +
`EfxPaintEngine.previewBaseStaleCtx.test.ts` (uncommitted, 111/111 + 104/104
green). **That fix stays exactly as it is and is NOT part of these commits** —
it is the user's own UAT subject, separate from this quick.

## STEP 1 — discriminating measurement (user observation, before any fix)

The physics question is decisive: **can the paper height map punch a white hole?**

| Fact | Value | Source |
|---|---|---|
| `paperStrength` band | `[0.05, 0.25]` | `compositor.ts:40` |
| `conditionHeightMap` clamp on `h` | `[0.10, 0.90]` | `paper.ts:90` |
| `paperMod` band | `[0.775, 0.995]` | `1 − paperStrength·h` |
| fast path | `pixelOpacity >= 0.90` → **no paperMod at all** | `compositor.ts:35-36` |
| deposit floor at 100% | `Math.max(userOpacity, adsorption)` = full coverage | `wet-layer.ts` |

→ Paper can **lighten at most ~22%** and **can never reach 0**. At 100% brush
opacity the paper path is entirely out of the loop.

**User answers (2026-10-01):**
- line character = **True white hole** (background shows through, alpha ≈ 0)
- brush opacity = **100%**
- A/B 100% vs 70% = not tried (the first two answers are already decisive)

**→ Paper path EXONERATED. `paper.ts` stays byte-untouched.**
Measured in `whiteSeamHoleWriter.test.ts`: `min(paperMod applied) = 0.7756`,
paper never forced alpha to 0 while the no-paper path stayed lit, and
`wetDisplayAlpha(706, 1.0, 0.9) === wetDisplayAlpha(706, 1.0, 0.1) === 71`.

This goes STEP 2-ALT: re-open (a) and (d) as hole writers.

## THE INVARIANT

> **No VISIBLE wet pixel may vanish without landing in dry.**

Anything else is a true hole: `getBakedCanvas()` is `previewBaseCanvas +
dryCanvas` (`EfxPaintEngine.ts:1644-1646`) and carries **no wet overlay**, so
wet that never lands in dry is invisible on the monitor. "Visible" means
`wetDisplayAlpha(...) > 0` — a byte the display law would have shown.

## Verdicts

| Suspect | Verdict | Evidence |
|---|---|---|
| **(a)** footprint clipped by `segBounds` | **CLEAN** | Re-run at **production extremes** the R2 pin missed: `edgeDetail 100` → `edgeMul 2`, radius 8/32/64, `deformSampleSides` depth 4, **interior** offscreens (394×286 / 589×484 / 796×696). **60828 / 88160 / 84700** hull verts, `clippedVerts = 0`. `curveBounds`'s `2*(radius + variance*5) + 10` padding covers the deform at every extreme. |
| **(d1)** `forceDryAll` `sa==0` clear-without-transfer | **CLEAN** | Mechanism is real: `DENSITY_NORM = 3000` → `sa = round(alpha/10)/255` at op 1, so `wet.alpha` 1–4 rounds to 0 and is zeroed with `dryA = 0`. **But those bytes render 0 on the wet overlay TOO** — destroying them is the one look law being honest. Measured: **0 visible pixels destroyed**, 4 invisible destroyed (correct). |
| **(d2)** bbox clamp drops the solver margin ring | **THE WRITER** | **384 VISIBLE pixels (`sa = 71`)** placed outside `dryRegionForStroke` survive `forceDryAll` untouched (`ringTransferred = 0`) and never land in dry. The bbox rectangle is the **"full block outline"**; its four sides are the **horizontal/vertical white cuts**. |

**The disproven assumption** — `drying.ts:208-210` (52.1), verbatim:

> *"The wet pixels of one finalized stroke are bounded by the stroke bbox, so
> clamp every canvas op to it."*

They are not. `dryRegionForStroke` = `point-bbox ± brushRenderRadius` (= `size/2`,
`EfxPaintEngine.ts:323-325`, `:2728-2731`) but the solver solves `± (brushR +
margin)` (`:2680-2684`) where `margin = ceil(2 + waterCurve·brushR·0.6 +
spreadCurve·brushR·0.4)` (10px/side at `brushR=16 water=50 spread=65`, scaling
with brushR). The overflow band holds visible paint the clamp never transfers.

## The one fix — widen `forceDryAll`'s clamp to the wet extent

`drying.ts` `forceDryAll` now unions the caller's bounds with the **actual wet
bounding box** (the same `O(W·H)` Float32 scan `compositeWetLayer` already does
per composite). Every solved pixel lands in dry and is cleared.

The 52.1 bounded-readback law **holds** — the rect is still the wet footprint,
never the full frame. Only the false assumption is replaced.

Measured effect: `ring pixels written to dry` **0 → 384**; `visible pixels absent
from dry` **384 → 0**.

**Why the fix lives in `drying.ts` and not `EfxPaintEngine.ts`:** widening
`dryRegionForStroke` would be the other valid fix, but `EfxPaintEngine.ts` carries
the uncommitted previewBase fix that must stay out of this quick's commits.

## `drying.bboxLoss.test.ts` — the characterization pin flips

`260930-q6t Addendum B` pinned the bbox loss as **documented behavior** ("(ii)
outside-bounds wet does NOT transfer… (iii) outside mass is unaccounted for").
That is exactly what R3b removes, so the pin now gates the fix:

- (i) unchanged — inside transfers at exactly 40 (one look law)
- (ii) **the drift band also transfers** at exactly 70 and is cleared; **nothing
  survives as stranded wet**
- (iii) dry gains **640 + 560 = 1200** — no visible mass unaccounted

## Verification (R3b)

- `whiteSeamHoleWriter.test.ts`: **9/9** GREEN (RED at `c5914ff6`: (d2) GUILTY, 1 failed / 8 passed)
- `drying.bboxLoss.test.ts`: **6/6** GREEN under the new invariant
- Full package suite: **42 files, 334 passed, 3 skipped**
- `pnpm --filter @efxlab/efx-physic-paint check` + `pnpm --filter efx-motion-editor typecheck`: **clean**
- App suite: **4346 passed**, 1 pre-existing failure (`physicsPaintPerformanceTrace.test.ts`
  "retains the existing native profiler object…", the superseded-q6t `enabled` key,
  in `deferred-items.md` — out of scope)
- **Guardrails held:** `spreadScale.ts` / `compositor.ts` / `wet-layer.ts` / `paper.ts`
  `git diff --stat` **EMPTY**
- **Look knobs stand:** `DEPOSIT_KEEP_TIER = 40`, `DEPOSIT_DENSITY_SCALE = 4500`,
  `PAPER_ADSORPTION_GAMMA = 0.5` (asserted in-test)

## Status after R3b: automated-ready — native UAT PENDING

Nothing is `done`. The pin is green; the eye decides.

**Native UAT rows (all PENDING):**
- **(a)** no more true-white holes: no horizontal/vertical white cuts through the
  paint, no more full block outlines.
- **(b)** the accepted look is unchanged: dense + physics texture, knobs 40/4500/0.5.
- **(c)** preview == cache == reloaded still byte-equal (`lookLawDigest.test.ts` stays green).
- **(d)** performance holds — the fix must not reintroduce the 52.1 2nd-stroke
  freeze (the clamp is still bounded by the wet footprint, but judge it live).
- **(e)** the **previewBase stale-ctx fix** (uncommitted, separate) is judged on its
  own rows: returning to a key no longer shows faded/poor paint.

**Named but NOT fixed (the next suspect only if (a) fails):**
- (d1) `sa==0` clear-without-transfer — structurally WYSIWYG-correct today, but it
  is the last remaining destroy-without-transfer site. Harmless while
  `wetDisplayAlpha` rounds those bytes to 0.

**Do not reopen:** the 260928-dh1 paper hunt, the leave-key settle-through gate,
the /800-vs-Beer-Lambert unification, the bake-speed question.
**Narrowly reopened by R3b scope and now closed again:** bbox flush-loss — the
display-side hole is fixed; the save-path (leave/close) half of Addendum B is
whatever `forceDryAll` now does, which is the fix.

**Sequence unchanged (do not reorder):** 1 `sans-cuisson` (this) → 2
`paint-width` → 3 `06-libmypaint-rasterizer` → 4 `08-retire-fluids` finished →
5 `07-paint-script`.

## Commit series (R3b, 2 commits)

| # | Hash | Message |
|---|------|---------|
| 1 | `c5914ff6` | test(260930-wm6-r3b): RED — true-white hole writer pin (paper exonerated) |
| 2 | `70d79adf` | fix(260930-wm6-r3b): widen forceDryAll's clamp to the wet extent |

Ordering guard satisfied: the RED pin commit lands on an **unfixed** tree where
(d2) reports `384 VISIBLE pixels` and fails; commit 2 flips it GREEN and flips the
`drying.bboxLoss.test.ts` characterization to the new invariant in the same slice.
