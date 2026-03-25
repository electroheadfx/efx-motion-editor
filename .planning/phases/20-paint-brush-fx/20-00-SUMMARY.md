---
phase: 20-paint-brush-fx
plan: 00
subsystem: testing
tags: [vitest, test-stubs, paint-brush-fx, tdd-scaffold]

# Dependency graph
requires: []
provides:
  - 7 vitest test stub files for paint brush FX verification scaffold
  - 57 todo test cases covering types, defaults, flow field, watercolor, spectral mix, renderer routing, persistence
affects: [20-01, 20-02, 20-03, 20-04, 20-05, 20-06, 20-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 test scaffold: create .todo stubs before implementation for Nyquist verification"

key-files:
  created:
    - Application/src/types/paint.test.ts
    - Application/src/lib/brushFxDefaults.test.ts
    - Application/src/lib/brushFlowField.test.ts
    - Application/src/lib/brushWatercolor.test.ts
    - Application/src/lib/spectralMix.test.ts
    - Application/src/lib/paintRenderer.test.ts
    - Application/src/lib/paintPersistence.test.ts
  modified: []

key-decisions:
  - "All test stubs use it.todo() for skip-by-default behavior, matching vitest convention"

patterns-established:
  - "Wave 0 scaffold pattern: test stubs created before any implementation, filled in by subsequent plans"

requirements-completed: [PAINT-01, PAINT-02, PAINT-03, PAINT-04, PAINT-05, PAINT-06, PAINT-07, PAINT-08, PAINT-09, PAINT-10, PAINT-11, PAINT-13]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 20 Plan 00: Test Scaffold Summary

**7 vitest test stub files with 57 todo test cases covering the full paint brush FX verification surface**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T13:06:10Z
- **Completed:** 2026-03-25T13:09:01Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments
- Created 7 test stub files matching the RESEARCH.md Wave 0 gap list exactly
- 57 meaningful .todo test cases spanning type system, defaults, flow field, watercolor, spectral mix, renderer routing, and persistence
- Full vitest suite passes (stubs are skipped, no existing tests broken)
- Every subsequent plan's verify commands can now reference these test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create type system and defaults test stubs** - `2fbe90c` (test)
2. **Task 2: Create module test stubs** - `1a13cca` (test)

## Files Created/Modified
- `Application/src/types/paint.test.ts` - 10 todo tests for BrushStyle type union, BRUSH_STYLES array, BrushFxParams, DEFAULT_BRUSH_FX_PARAMS, BRUSH_FX_VISIBLE_PARAMS, PaintStroke
- `Application/src/lib/brushFxDefaults.test.ts` - 7 todo tests for per-style default values, visible param mapping, value ranges
- `Application/src/lib/brushFlowField.test.ts` - 10 todo tests for flow field creation, sampling, displacement, caching
- `Application/src/lib/brushWatercolor.test.ts` - 13 todo tests for seedable Gaussian, polygon deformation, watercolor layers, triangulation, polygon center
- `Application/src/lib/spectralMix.test.ts` - 4 todo tests for GLSL spectral string exports, spectral_mix function, reflectance data
- `Application/src/lib/paintRenderer.test.ts` - 8 todo tests for isStyledStroke type guard routing (flat/eraser/styled), render order
- `Application/src/lib/paintPersistence.test.ts` - 5 todo tests for sidecar JSON round-trip with brushStyle/brushParams fields, backward compat

## Decisions Made
- Used it.todo() consistently for all stubs (vitest skips these by default, so no false failures)
- Matched exact describe/it pattern from existing codebase test files

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree required `pnpm install` for vitest to resolve (worktrees don't share node_modules). Resolved quickly.

## Known Stubs

None - this plan intentionally creates test stubs (it.todo). These are the scaffold, not stubs-that-block-features.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 7 test stub files ready for Plan 01+ to fill in as implementation proceeds
- Nyquist verification scaffold complete: every plan can run its verify commands against these files

## Self-Check: PASSED

All 7 test stub files verified present. Both task commits (2fbe90c, 1a13cca) verified in git log. SUMMARY.md exists.

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-25*
