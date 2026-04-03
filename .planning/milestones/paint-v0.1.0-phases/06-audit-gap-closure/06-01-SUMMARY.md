---
phase: 06-audit-gap-closure
plan: 01
subsystem: engine
tags: [dead-code-removal, cleanup, typescript, build]

# Dependency graph
requires:
  - phase: 05.1
    provides: "Stam fluids solver replacing FBM diffusion, paper-height modulation replacing brush grain"
provides:
  - "Clean codebase with zero orphaned exports (18 dead exports removed)"
  - "Pruned diffusion.ts to physics orchestration only"
  - "Pruned paper.ts to live functions only (loadPaperTexture, sampleH, sampleTexH, ensureHeightMap)"
  - "Pruned math.ts to live functions only (removed pt2arr, ptsToArrs)"
  - "Removed brushGrain parameter chain from paint.ts and EfxPaintEngine.ts"
affects: [06-02, library-packaging]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - paint-rebelle-new/src/core/diffusion.ts
    - paint-rebelle-new/src/core/paper.ts
    - paint-rebelle-new/src/util/math.ts
    - paint-rebelle-new/src/brush/paint.ts
    - paint-rebelle-new/src/engine/EfxPaintEngine.ts

key-decisions:
  - "Left fluids.ts comment referencing diffuseStep as historical documentation (not a code dependency)"

patterns-established:
  - "Physics orchestration in diffusion.ts delegates entirely to fluids.ts and drying.ts"

requirements-completed: [PHYS-01, LIB-01, LIB-03, BRUSH-03]

# Metrics
duration: 5min
completed: 2026-04-02
---

# Phase 06 Plan 01: Dead Code Removal Summary

**Removed 18 dead exports, brush_texture.png asset, and brushGrain parameter chain -- 1,031 lines deleted, zero build errors**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-02T08:55:06Z
- **Completed:** 2026-04-02T09:01:01Z
- **Tasks:** 2
- **Files modified:** 5 (plus 2 deleted)

## Accomplishments
- Deleted brush/water.ts (11 dead exports, 0 callers -- all 6 water brush types removed)
- Pruned 5 deprecated functions from diffusion.ts (buildColorMap, sampleChannel, sampleColorPremul, precomputeDisplacement, diffuseStep) -- replaced by Stam fluids solver in Phase 05.1
- Removed createMirroredBrushGrain, sampleBrushGrain, and MIRRORED_GRAIN_SIZE from paper.ts
- Removed pt2arr and ptsToArrs from math.ts
- Deleted orphaned brush_texture.png asset (replaced by paper-height deposit modulation)
- Removed dead brushGrain parameter chain from renderPaintStroke, renderPaintStrokeSingleColor, and all 4 EfxPaintEngine call sites
- Cleaned up unused imports (lerp, clamp, fbm, ColorMap type from diffusion.ts; sampleBrushGrain from paint.ts)
- TypeScript compiles clean, Vite build succeeds

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete dead files and prune dead functions** - `6297151` (refactor)
2. **Task 2: Remove dead brushGrain parameter chain and verify build** - `8eb378d` (refactor)

## Files Created/Modified
- `paint-rebelle-new/src/brush/water.ts` - DELETED (11 dead exports)
- `paint-rebelle-new/public/img/brush_texture.png` - DELETED (orphaned asset)
- `paint-rebelle-new/src/core/diffusion.ts` - Pruned to physicsStep only, cleaned header and imports
- `paint-rebelle-new/src/core/paper.ts` - Removed brush grain functions and constant
- `paint-rebelle-new/src/util/math.ts` - Removed pt2arr and ptsToArrs
- `paint-rebelle-new/src/brush/paint.ts` - Removed brushGrain parameter and sampleBrushGrain import
- `paint-rebelle-new/src/engine/EfxPaintEngine.ts` - Removed brushGrain field and all call-site arguments

## Decisions Made
- Left the comment "replaces diffuseStep()" in fluids.ts as historical documentation -- it is not a code reference, just a JSDoc note

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
- Worktree did not have node_modules installed, causing tsc and vite build to fail initially. Resolved by running `pnpm install` before build verification (pre-existing environment issue, not caused by changes).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Codebase is clean with zero orphaned exports
- Ready for 06-02 plan (onEngineReady + requirements updates)
- All builds pass

## Self-Check: PASSED

All files verified, all commits exist, SUMMARY.md created.

---
*Phase: 06-audit-gap-closure*
*Completed: 2026-04-02*
