---
phase: 20-paint-brush-fx
plan: 04
subsystem: paint-ui
tags: [brush-style, paint-properties, svg-thumbnails, collapsible-sections, preact]

# Dependency graph
requires:
  - "20-01: BrushStyle type, BRUSH_STYLES array, BRUSH_FX_VISIBLE_PARAMS config, paintStore setBrushStyle/updateBrushFxParam"
provides:
  - "BRUSH STYLE visual selector strip with 6 SVG thumbnails and checkmark on active style"
  - "BRUSH FX collapsible section with per-style relevant parameter sliders"
  - "BRUSH_PREVIEW_URLS static SVG data URIs for all 6 brush styles"
affects: [20-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline SVG data URIs for zero-runtime-cost brush preview thumbnails"
    - "Per-style FX slider filtering via BRUSH_FX_VISIBLE_PARAMS config map"

key-files:
  created:
    - "Application/src/lib/brushPreviewData.ts"
  modified:
    - "Application/src/components/sidebar/PaintProperties.tsx"

key-decisions:
  - "SVG data URIs with per-style filter effects (feTurbulence, feDisplacementMap) for visually distinct brush previews"
  - "BRUSH FX section placed between BRUSH and STROKE sections for logical grouping"
  - "Removed unused BrushStyle type import to keep TypeScript clean"

patterns-established:
  - "FX_PARAM_LABELS constant map for user-facing parameter display names"

requirements-completed: [PAINT-01, PAINT-08]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 20 Plan 04: Brush Style UI Summary

**Procreate-style brush selector strip with 6 SVG thumbnails, checkmark on active style, and per-style BRUSH FX parameter sliders in PaintProperties sidebar**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T13:19:09Z
- **Completed:** 2026-03-25T13:23:05Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- 6 inline SVG brush preview thumbnails with style-specific filters (turbulence, grain, displacement)
- Collapsible BRUSH STYLE section with 3-column grid, accent border and checkmark on selected style
- Collapsible BRUSH FX section showing only relevant sliders per style (flat hides it entirely)
- Both sections default to open state per design decisions D-02 and D-06

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate static brush preview thumbnails** - `ccc23d0` (feat)
2. **Task 2: Add BRUSH STYLE selector strip and BRUSH FX collapsible section** - `2d1a9fd` (feat)

## Files Created/Modified
- `Application/src/lib/brushPreviewData.ts` - Static SVG data URIs for 6 brush style preview thumbnails
- `Application/src/components/sidebar/PaintProperties.tsx` - BRUSH STYLE selector and BRUSH FX sliders sections

## Decisions Made
- Used inline SVG with filter elements (feTurbulence, feDisplacementMap, feComponentTransfer) for visually distinct per-style previews at zero runtime cost
- Placed BRUSH FX section between BRUSH and STROKE for logical parameter grouping
- FX_PARAM_LABELS maps technical keys to user-friendly names (fieldStrength -> "Flow", edgeDarken -> "Edge Ink")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused BrushStyle type import**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** BrushStyle was imported as a type but not directly referenced in component code
- **Fix:** Removed from type import line
- **Files modified:** Application/src/components/sidebar/PaintProperties.tsx
- **Verification:** TypeScript compiles clean
- **Committed in:** 2d1a9fd (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial import cleanup. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all UI elements are wired to live paintStore signals.

## Next Phase Readiness
- Brush style UI is complete and ready for visual verification
- FX sliders write to paintStore.brushFxParams which downstream rendering plans (20-05, 20-06) will consume
- Preview thumbnails are static SVGs; when actual brush rendering is implemented, thumbnails could optionally be upgraded to live previews

## Self-Check: PASSED

All files exist, all commits verified.

---
*Phase: 20-paint-brush-fx*
*Completed: 2026-03-25*
