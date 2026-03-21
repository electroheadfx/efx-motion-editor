---
phase: 11-live-canvas-transform
plan: 01
subsystem: ui
tags: [canvas, transform, scaling, migration, serde]

# Dependency graph
requires: []
provides:
  - "LayerTransform with scaleX/scaleY for non-uniform scaling"
  - "MceLayerTransform v5 format with scale_x/scale_y and backward-compat v4 migration"
  - "Rust MceLayerTransform with serde defaults for v4 backward compat"
  - "PreviewRenderer non-uniform scaling via ctx.scale(scaleX, scaleY)"
  - "PropertiesPanel separate SX/SY inputs"
affects: [11-02, 11-03, 11-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Backward-compatible .mce format migration via optional legacy fields and nullish coalescing"

key-files:
  created: []
  modified:
    - "Application/src/types/layer.ts"
    - "Application/src/types/project.ts"
    - "Application/src-tauri/src/models/project.rs"
    - "Application/src/stores/projectStore.ts"
    - "Application/src/lib/previewRenderer.ts"
    - "Application/src/components/layout/PropertiesPanel.tsx"

key-decisions:
  - "v4-to-v5 migration uses nullish coalescing: scaleX = scale_x ?? scale ?? 1"
  - "Rust serde uses default_scale() -> 1.0 for scale_x/scale_y to handle v4 files missing these fields"
  - "Optional scale field in both TS and Rust skipped on serialization (skip_serializing_if)"

patterns-established:
  - "Format version bump pattern: increment version in buildMceProject, add fallback in hydrateFromMce"

requirements-completed: [XFORM-01, XFORM-02]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 11 Plan 01: Scale Split Summary

**Split LayerTransform.scale into scaleX/scaleY for non-uniform scaling, migrated .mce format v4 to v5 with backward-compatible deserialization**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T16:51:43Z
- **Completed:** 2026-03-13T16:54:12Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- LayerTransform interface now uses scaleX/scaleY instead of single scale field
- .mce project format bumped to v5 with scale_x/scale_y serialization and v4 backward-compat migration
- PreviewRenderer draws with non-uniform scaling via ctx.scale(scaleX, scaleY)
- PropertiesPanel shows separate SX and SY numeric inputs for content layers

## Task Commits

Each task was committed atomically:

1. **Task 1: Split scale into scaleX/scaleY across TS types, Rust serde, and serialization** - `9b9825c` (feat)
2. **Task 2: Update all scale consumers -- PreviewRenderer, PropertiesPanel, and remaining references** - `60ecb68` (feat)

## Files Created/Modified
- `Application/src/types/layer.ts` - LayerTransform with scaleX, scaleY replacing scale
- `Application/src/types/project.ts` - MceLayerTransform with scale_x, scale_y and optional scale for v4 compat
- `Application/src-tauri/src/models/project.rs` - Rust MceLayerTransform with scale_x, scale_y, serde defaults, optional scale
- `Application/src/stores/projectStore.ts` - v5 format version, buildMceProject writes scale_x/scale_y, hydrateFromMce migrates v4
- `Application/src/lib/previewRenderer.ts` - drawLayer and drawLayerToOffscreen use scaleX/scaleY
- `Application/src/components/layout/PropertiesPanel.tsx` - TransformSection with separate SX/SY inputs

## Decisions Made
- v4-to-v5 migration uses nullish coalescing: `scaleX = scale_x ?? scale ?? 1` for seamless backward compat
- Rust serde uses `default_scale() -> 1.0` for scale_x/scale_y so v4 files missing these fields parse correctly
- Optional scale field skipped on serialization in both TS and Rust (never written in v5, only read for migration)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- scaleX/scaleY data model is in place for edge midpoint handles (plan 11-02)
- All subsequent plans in phase 11 can depend on non-uniform scaling support
- Full build (TS + Rust) passes with zero errors

## Self-Check: PASSED

All 6 modified files verified on disk. Both task commits (9b9825c, 60ecb68) verified in git log.

---
*Phase: 11-live-canvas-transform*
*Completed: 2026-03-13*
