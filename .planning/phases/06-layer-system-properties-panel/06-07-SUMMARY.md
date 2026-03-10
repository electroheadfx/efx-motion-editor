---
phase: 06-layer-system-properties-panel
plan: 07
subsystem: ui
tags: [preact, popover, video, asset-picker, hydration]

# Dependency graph
requires:
  - phase: 06-layer-system-properties-panel
    provides: "Video asset tracking in imageStore (06-06), AddLayerMenu with image picker pattern (06-03)"
provides:
  - "Video picker popover in AddLayerMenu matching static image picker UX"
  - "Video asset re-discovery from loaded video layers during project hydration"
affects: [layer-system, import-panel, project-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns: ["video picker popover with name+icon list (no thumbnails)", "video asset re-discovery from layer source data during hydration"]

key-files:
  created: []
  modified:
    - "Application/src/components/layer/AddLayerMenu.tsx"
    - "Application/src/stores/projectStore.ts"

key-decisions:
  - "Video picker uses name+icon list (not thumbnail grid) since videos have no thumbnails"
  - "Video asset re-discovery iterates sequenceStore.sequences.value after deserialization (no getAll method needed)"

patterns-established:
  - "Video picker popover mirrors static image picker pattern for consistency"
  - "Asset re-discovery from layer source data during hydration for non-persisted asset metadata"

requirements-completed: [LAYER-02, LAYER-03]

# Metrics
duration: 2min
completed: 2026-03-10
---

# Phase 06 Plan 07: Video Picker & Hydration Summary

**Video picker popover in AddLayerMenu with name+icon asset list, and video asset re-discovery from loaded video layers during project hydration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-10T08:31:48Z
- **Completed:** 2026-03-10T08:33:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Video "Add Layer" button now opens picker popover showing existing video assets with purple dots and names
- Clicking a video asset creates a video layer directly (no file dialog needed)
- "Import new..." button in picker opens file dialog as fallback for importing new videos
- Opening saved projects with video layers populates imageStore.videoAssets, restoring IMPORTED panel

## Task Commits

Each task was committed atomically:

1. **Task 1: Add video picker popover to AddLayerMenu** - `3f60849` (feat)
2. **Task 2: Re-discover video assets from loaded video layers during hydration** - `3932eae` (feat)

## Files Created/Modified
- `Application/src/components/layer/AddLayerMenu.tsx` - Added videoPickerOpen state, click-outside effect, handleAddVideoFromAsset handler, handleImportNewVideo (renamed), video picker popover JSX
- `Application/src/stores/projectStore.ts` - Added video asset re-discovery loop after sequence deserialization in hydrateFromMce

## Decisions Made
- Video picker uses name+icon list (not thumbnail grid) since videos have no thumbnails per design decision from 06-06
- Used sequenceStore.sequences.value for iteration (sequenceStore.getAll() doesn't exist) -- simpler and equivalent since sequences are already added to the store at that point in hydration
- isDirty.value = false after re-discovery wins over addVideoAsset's _markDirty() call inside batch, as noted in plan

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UAT gaps 1 and 2 (tests 3 and 4) should now pass
- Video add flow uses picker popover with "Import new..." fallback
- Video assets persist in IMPORTED panel after project reload via hydration re-discovery

## Self-Check: PASSED

All files found. All commits verified.

---
*Phase: 06-layer-system-properties-panel*
*Completed: 2026-03-10*
