---
phase: 55-efx-paint-host-engine-1-host-split
plan: 02
subsystem: packages
tags: [host-split, animation, traceSeed, StudioStroke, EngineAdapter, workspace-package, generic-contract]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split (55-01)
    provides: Pre-split golden fixture + standing HOST-03 parity pin
provides:
  - "packages/efx-paint-host workspace package (Preact-free, exports . + ./animation)"
  - "Generic StudioStroke<P> schedule-stroke contract and EngineAdapter<P> seam"
  - "toStudioStroke / fromStudioStroke engine-1 boundary projection"
  - "animation/ folder + traceSeed/noise moved to host; engine-1 surface cleaned"
affects: [55-03, 55-04, 55-05, 55-06, 55-07, 55-08, 55-09]

# Actuals (#2632)
actuals:
  tokens: 31030
  tasks: 3
  commits: 3
  plan_head_before: 50ca2bb5fe4d70b1b278e10fb7d69e389214537d
  plan_head_after: 1b4c6d077fce07dbc71149fc3425766df923a3d8

# Tech tracking
tech-stack:
  added:
    - "@efxlab/efx-paint-host workspace package (Preact-free)"
    - "vitest ^2.1.9 as host package devDependency"
  patterns:
    - "ONE StudioStroke<P> schedule-stroke contract (pts/ticks/cuisson/motion/brushId/toolOverrides/traceSeed/recordedOrder/playFrame/color/engine: P)"
    - "EngineAdapter<P> plug point: live playback + bake surface on one interface"
    - "Engine-boundary projection toStudioStroke: the only place engine-1 field names meet host field names"

key-files:
  created:
    - packages/efx-paint-host/package.json
    - packages/efx-paint-host/src/index.ts
    - packages/efx-paint-host/src/util/traceSeed.ts
    - packages/efx-paint-host/src/util/noise.ts
    - packages/efx-paint-host/src/animation/types.ts
    - packages/efx-paint-host/src/animation/AnimationPlayer.ts
    - packages/efx-paint-host/src/animation/progressiveStrokeSchedule.ts
    - packages/efx-paint-host/src/animation/staticStrokeSchedule.ts
    - packages/efx-paint-host/src/animation/recordedStrokeMotion.ts
    - packages/efx-paint-host/src/animation/AnimationPlayer.test.ts
    - packages/efx-paint-host/src/animation/progressiveStrokeSchedule.test.ts
    - packages/efx-paint-host/src/animation/staticStrokeSchedule.test.ts
    - packages/efx-paint-host/src/animation/recordedStrokeMotion.test.ts
    - packages/efx-physic-paint/src/payload/toStudioStroke.ts
  modified:
    - packages/efx-physic-paint/package.json
    - packages/efx-physic-paint/src/index.ts
    - packages/efx-physic-paint/tsup.config.ts
    - packages/efx-physic-paint/README.md
    - packages/efx-physic-paint/demo/vite.config.ts
    - packages/efx-physic-paint/demo/src/App.tsx
    - packages/efx-physic-paint/src/brush/paint.ts
    - packages/efx-physic-paint/src/brush/erase.ts
    - packages/efx-physic-paint/src/brush/footprintLanes.ts
    - packages/efx-physic-paint/src/brush/paint.bristleSeed.test.ts
    - packages/efx-physic-paint/src/brush/shapeDetail.test.ts
    - packages/efx-physic-paint/src/engine/EfxPaintEngine.eraseContract.test.ts
    - app/vite.config.ts
    - app/vitest.config.ts
    - app/package.json
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRegistryOwnership.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoHoldDeterminism.test.ts
    - app/src/efx-paint/host-split/preSplitGoldenFixture.ts
    - app/src/efx-paint/host-split/preSplitGoldenParity.test.ts

key-decisions:
  - "color kept as a StudioStroke shared field so held-pose hashing (hashStroke) stays byte-identical across the move — the golden pin requires that hash to be stable"
  - "Bidirectional projection at the seam: toStudioStroke (forward) + fromStudioStroke (reverse for engine call sites that still consume PaintStroke)"
  - "Mock harness reveal functions in roto tests read entry.pts ?? entry.points to work with both shapes during the transition"

patterns-established:
  - "Engine-boundary projection: toStudioStroke is the ONLY place PaintStroke field names meet StudioStroke field names"

requirements-completed: [HOST-01]

coverage:
  - id: D1
    description: "packages/efx-paint-host workspace package with animation/ + util/ moved, Preact-free surface"
    requirement: "HOST-01"
    verification:
      - kind: command
        ref: "pnpm --filter @efxlab/efx-paint-host build"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/animation/AnimationPlayer.test.ts + progressiveStrokeSchedule.test.ts + recordedStrokeMotion.test.ts + staticStrokeSchedule.test.ts (22 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ONE StudioStroke<P> schedule-stroke contract with EngineAdapter<P> seam — no engine-1 types in host"
    requirement: "HOST-01"
    verification:
      - kind: unit
        ref: "packages/efx-paint-host/src/animation/AnimationPlayer.test.ts (drives EngineAdapter mock, no EfxPaintEngine import)"
        status: pass
      - kind: command
        ref: "pnpm --filter @efxlab/efx-physic-paint check (tsc — engine-1 compiles against host types)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Atomic animation/ move + complete 13-site consumer re-point; old path and dual ./animation export deleted"
    requirement: "HOST-01"
    verification:
      - kind: command
        ref: "pnpm --filter @efxlab/efx-physic-paint build + check + demo:build (all exit 0, no animation tsup entry)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/preSplitGoldenParity.test.ts (6 tests, delta-zero golden pin green)"
        status: pass
    human_judgment: false
  - id: D4
    description: "toStudioStroke engine-1 boundary projection with FIELD-MAPPING CONTRACT; app call sites project before host schedule calls"
    requirement: "HOST-01"
    verification:
      - kind: command
        ref: "pnpm --filter efx-motion-editor run typecheck (exit 0)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoHoldDeterminism.test.ts (19 tests, determinism preserved)"
        status: pass
    human_judgment: false

# Metrics
duration: 34min
completed: 2026-10-15
status: complete
---

# Phase 55 Plan 02: Atomic Host Split Summary

**Studio-law animation + traceSeed/noise moved into Preact-free efx-paint-host on ONE StudioStroke<P> contract, with engine-1 projecting through toStudioStroke at the seam**

## Performance

- **Duration:** 34 min
- **Started:** 2026-10-15T05:22:12Z
- **Completed:** 2026-10-15T05:56:05Z
- **Tasks:** 3
- **Files modified:** 37

## Accomplishments

- Created `packages/efx-paint-host` workspace package (Preact-free, D-17) owning `animation/` + `util/traceSeed.ts` + `util/noise.ts` with the `seededRng(strokeSeed, streamKey)` signature byte-stable (D-25)
- Genericized the entire animation surface onto ONE `StudioStroke<P>` contract (pts/ticks/cuisson/motion/brushId/toolOverrides/traceSeed/recordedOrder/playFrame/color/engine: P) — no engine-1 type names in host source
- `AnimationPlayer` drives the generic `EngineAdapter<P>` plug point (live playback + bake surface on one interface); `AnimationStrokeStyleOverride<P>` is generic with an opaque engine slot
- Atomic move + complete 13-site consumer re-point in one change set (D-18 clean-break): old `src/animation/` deleted, no re-export shim, no dual `./animation` export
- `toStudioStroke` / `fromStudioStroke` boundary projection in `packages/efx-physic-paint/src/payload/toStudioStroke.ts` with the FIELD-MAPPING CONTRACT — the ONLY place engine-1 field names meet host field names
- Golden pin (HOST-03) stays green after the move — 6/6 tests, delta-zero re-bake
- 4 moved animation tests green under the host package's own vitest run (22 tests); `app/vitest.config.ts` extended to collect host tests

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "host owns traceSeed"** - `c5029fd7` (feat)
2. **Task 2: Atomic animation/ move + complete consumer re-point** - `3de384cc` (feat)
3. **Task 3: Project engine-1 strokes and collect host tests** - `1b4c6d07` (feat)

**Plan metadata:** (committed after this SUMMARY)

## Files Created/Modified

- `packages/efx-paint-host/` - New Preact-free workspace package (package.json, tsup, tsconfig, index, util/, animation/)
- `packages/efx-physic-paint/src/payload/toStudioStroke.ts` - Engine-1 → StudioStroke<P> projection with FIELD-MAPPING CONTRACT
- `packages/efx-physic-paint/src/index.ts` - Re-pointed surface: exports toStudioStroke/fromStudioStroke, dropped animation re-exports
- `packages/efx-physic-paint/package.json` - Removed ./animation export, added workspace dep on efx-paint-host
- `packages/efx-physic-paint/tsup.config.ts` - Removed animation entry
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` - Projects through toStudioStroke at schedule call sites
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts` - Projects through toStudioStroke before transformRecordedStrokeForHeldPose
- `app/vitest.config.ts` - Extended test.include with host package tests
- `app/src/efx-paint/host-split/preSplitGoldenFixture.ts` - Bake entry adapted to project onto StudioStroke (stored data unchanged)

## Decisions Made

- **`color` kept as a StudioStroke shared field:** held-pose hashing (`hashStroke` in `transformRecordedStrokeForHeldPose`) keys on `stroke.color`. Dropping it would change the hash and break the golden pin. The field is generic (string | null) and carries no engine-1 type names.
- **Bidirectional projection at the seam:** `toStudioStroke` (forward, PaintStroke → StudioStroke) and `fromStudioStroke` (reverse, StudioStroke → PaintStroke) live in the engine-1 package. The reverse is needed because `renderProgressiveAlphaFrame` and `enqueueRecordedStroke` still consume the engine-1 stroke type.
- **Mock harness compatibility:** roto test mock `reveal` functions read `entry.pts ?? entry.points` to handle both shapes during the transition window.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Golden pin source-scan path updated after traceSeed move**
- **Found during:** Task 1
- **Issue:** `preSplitGoldenParity.test.ts` reads `packages/efx-physic-paint/src/util/traceSeed.ts` for its source-scan pin. Moving the file to the host would crash the pin (file not found).
- **Fix:** Updated `PACKAGE_TRACE_SEED` path constant to `packages/efx-paint-host/src/util/traceSeed.ts`. The pin's algorithm needles and stored fixture data are unchanged.
- **Files modified:** `app/src/efx-paint/host-split/preSplitGoldenParity.test.ts`
- **Verification:** Pin re-run green (6/6 tests)
- **Committed in:** `c5029fd7` (Task 1 commit)

**2. [Rule 3 - Blocking] App call sites needed projection to pass typecheck between Task 2 and Task 3**
- **Found during:** Task 2
- **Issue:** Task 2 genericizes the schedule functions to take `StudioStroke<P>`, but the app call sites still pass `PaintStroke`. Task 3's `toStudioStroke` would fix this, but Task 2's verify includes typecheck.
- **Fix:** Added minimal local `toStudioStroke`/`fromStudioStroke` helpers in the renderer and clipboard during Task 2. Task 3 formalized them into `packages/efx-physic-paint/src/payload/toStudioStroke.ts` and re-pointed the call sites.
- **Files modified:** `physicsPaintRotoPlayScriptRenderer.ts`, `physicsPaintRotoScriptClipboard.ts`
- **Verification:** Typecheck exit 0
- **Committed in:** `3de384cc` (Task 2), formalized in `1b4c6d07` (Task 3)

**3. [Rule 3 - Blocking] app package.json needed `@efxlab/efx-paint-host` dependency**
- **Found during:** Task 2
- **Issue:** TypeScript could not resolve `@efxlab/efx-paint-host/animation` from the app (no workspace dependency).
- **Fix:** Added `"@efxlab/efx-paint-host": "workspace:*"` to `app/package.json` dependencies. This is the same convention as the existing `@efxlab/efx-physic-paint` workspace dep.
- **Files modified:** `app/package.json`
- **Verification:** `pnpm install` links the package; typecheck resolves
- **Committed in:** `3de384cc` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All three were mechanical prerequisites for the move to compile. No scope creep. The projection helpers from deviation 2 were formalized in Task 3 as the plan intended.

## Issues Encountered

- Roto test mock `reveal` functions read `entry.points.length` which is `undefined` on `StudioStroke` (which has `pts`). Fixed by reading `entry.pts ?? entry.points` in the mock harness. Not a plan deviation — test adaptation during the type rename.
- The golden fixture's bake entry required a `toStudioStroke` projection to feed the renamed schedule functions. The stored `RotoPaintScript` data and baked frames are unchanged; only the bake code adapted to the new type surface.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `packages/efx-paint-host` is live with `animation/` + `util/` on the `StudioStroke<P>` contract. 55-03 can name and re-export the shape formally.
- `toStudioStroke` / `fromStudioStroke` are exported from `@efxlab/efx-physic-paint` — 55-05's serialize mapping must use identical field words (FIELD-MAPPING CONTRACT in `toStudioStroke.ts`).
- The golden pin remains the refactor guard for 55-03 through 55-09.
- Phase remains automated-ready until later plans and live UAT (A1–A4) close.

---
*Phase: 55-efx-paint-host-engine-1-host-split*
*Completed: 2026-10-15*

## Self-Check: PASSED

- FOUND: `packages/efx-paint-host/package.json`
- FOUND: `packages/efx-paint-host/src/util/traceSeed.ts`
- FOUND: `packages/efx-paint-host/src/util/noise.ts`
- FOUND: `packages/efx-paint-host/src/animation/types.ts`
- FOUND: `packages/efx-paint-host/src/animation/AnimationPlayer.ts`
- FOUND: `packages/efx-physic-paint/src/payload/toStudioStroke.ts`
- FOUND: `packages/efx-physic-paint/src/animation/` is gone (deleted)
- FOUND: task commit `c5029fd7`
- FOUND: task commit `3de384cc`
- FOUND: task commit `1b4c6d07`
- Re-run host vitest: 4 files / 22 tests passed
- Re-run golden pin: 6/6 tests passed
- Re-run physic-paint build + check + demo:build: all exit 0
- Re-run app typecheck: exit 0
