---
phase: 22-foundation-quick-wins
plan: 05
subsystem: ui
tags: [isolation, layer-creation, timeline, preact-signals, frame-range]

# Dependency graph
requires:
  - phase: 22-foundation-quick-wins/22-02
    provides: addLayerToSequence method and isolation detection logic
provides:
  - Isolation-mode layer creation as timeline-level sequences with aligned frame range
  - Optional frame range overrides on createFxSequence and createContentOverlaySequence
  - Amber indicator text for isolation mode in both AddFxMenu and AddLayerMenu
affects: [isolation, layer-creation, timeline, export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frame range opts pattern: optional { inFrame, outFrame } parameter on sequence creation methods"
    - "Intent-carried frame range: AddLayerIntent extended with isolatedInFrame/isolatedOutFrame for cross-component dispatch"

key-files:
  created: []
  modified:
    - Application/src/stores/sequenceStore.ts
    - Application/src/stores/uiStore.ts
    - Application/src/components/timeline/AddFxMenu.tsx
    - Application/src/components/layer/AddLayerMenu.tsx
    - Application/src/components/views/ImportedView.tsx

key-decisions:
  - "Create new timeline-level sequences in isolation mode rather than pushing internal sub-layers"
  - "Pass frame range through AddLayerIntent rather than re-computing in ImportedView"

patterns-established:
  - "Isolation-mode layer creation always creates new timeline-level sequences (FX or content-overlay) with inFrame/outFrame matching the isolated content sequence's range from trackLayouts"

requirements-completed: [UXP-02]

# Metrics
duration: 4min
completed: 2026-03-27
---

# Phase 22 Plan 05: Isolation-Mode Layer Creation Summary

**Fixed isolation-mode layer creation to produce timeline-level FX/content-overlay sequences with frame range aligned to the isolated content sequence, replacing incorrect internal sub-layer push; fixed indicator text color to amber**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-26T23:27:02Z
- **Completed:** 2026-03-26T23:31:18Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Isolation-mode FX/paint layers now create new FX sequences via createFxSequence with inFrame/outFrame from trackLayouts
- Isolation-mode content layers (static-image, video, image-sequence) now create new content-overlay sequences with aligned frame range
- "Adding to:" indicator color changed from unreadable blue (--color-accent) to amber (#F59E0B) in both menus
- All existing tests pass (277 passed, 26 test files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add optional frame range overrides to createFxSequence and createContentOverlaySequence** - `d62a17a` (feat)
2. **Task 2: Fix isolation-mode routing in AddFxMenu, AddLayerMenu, and ImportedView; fix indicator color** - `79175fc` (fix)

## Files Created/Modified
- `Application/src/stores/sequenceStore.ts` - Added optional opts parameter with inFrame/outFrame to createFxSequence and createContentOverlaySequence
- `Application/src/stores/uiStore.ts` - Extended AddLayerIntent type with isolatedInFrame and isolatedOutFrame fields
- `Application/src/components/timeline/AddFxMenu.tsx` - Replaced addLayerToSequence with createFxSequence + opts in isolation paths; added trackLayouts import and frame range computation; fixed indicator color to amber
- `Application/src/components/layer/AddLayerMenu.tsx` - Added trackLayouts import and frame range computation; passes isolatedInFrame/isolatedOutFrame through intent; fixed indicator color to amber
- `Application/src/components/views/ImportedView.tsx` - Replaced addLayerToSequence with createContentOverlaySequence + opts in all 3 isolation flows (static-image, video, image-sequence)

## Decisions Made
- Create new timeline-level sequences in isolation mode rather than pushing internal sub-layers -- this matches user expectation that isolation-scoped layer creation produces visible timeline entries
- Pass frame range through AddLayerIntent rather than re-computing in ImportedView -- avoids duplicate trackLayouts lookup and keeps intent data self-contained

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Isolation-mode layer creation is now correct for all layer types
- addLayerToSequence method is preserved for internal layer operations but no longer called from isolation code paths
- All 277 tests pass with zero regressions

## Self-Check: PASSED

All files verified present. All commit hashes verified in git log.

---
*Phase: 22-foundation-quick-wins*
*Completed: 2026-03-27*
