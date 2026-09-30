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
