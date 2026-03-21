---
phase: 13-sequence-fade-in-out
plan: 02
subsystem: timeline-rendering
tags: [transitions, fade, canvas-2d, timeline, hit-testing, gradient-overlay]

# Dependency graph
requires:
  - phase: 13-01
    provides: Transition types, sequenceStore CRUD, uiStore selectedTransition signal, TrackLayout fadeIn/fadeOut fields
provides:
  - drawTransitionOverlay method rendering DaVinci Resolve-style gradient + border + diagonal + label
  - Transition overlays on both content tracks and FX tracks
  - transitionHitTest for click-to-select transitions
  - Delete key removes selected transition
  - Sequence name shifts right when fade-in present
  - Pointer cursor on hover over transition zones
affects: [13-03, 13-04, 13-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [canvas-2d-transition-overlay, gradient-opacity-indicator]

key-files:
  created: []
  modified:
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/timeline/TimelineInteraction.ts
    - Application/src/components/timeline/TimelineCanvas.tsx
    - Application/src/lib/frameMap.ts
    - Application/src/lib/shortcuts.ts

key-decisions:
  - "Transition overlays drawn after thumbnails but before pink boundary markers (z-order)"
  - "FX track transition overlays drawn after name text but before edge handles"
  - "transitionHitTest uses 4px inset matching the overlay inset for accurate hit zones"
  - "Delete key checks selectedTransition before keyframe/layer/sequence delete handlers"

patterns-established:
  - "Transition overlay: gradient fill + white border + diagonal line + center label (DaVinci Resolve style)"
  - "Hit test priority chain: keyframe diamonds > transition overlays > name labels > sequence selection"

requirements-completed: [FADE-01, FADE-03]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 13 Plan 02: Timeline Rendering & Interaction Summary

**DaVinci Resolve-style transition overlays with gradient + diagonal + label on both content and FX tracks, click-to-select, Delete-to-remove, and name shift**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T19:24:50Z
- **Completed:** 2026-03-20T19:33:23Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- drawTransitionOverlay renders graduated transparency gradient (dark-to-clear for fade-in, clear-to-dark for fade-out), white outline border, single diagonal line, and center label
- Transition overlays render on content tracks (drawLinearTrack) and FX range bars (drawFxTrack)
- transitionHitTest supports both content tracks and FX tracks with 4px inset matching visual overlay
- Click-to-select transitions with full white border highlight and mutual exclusion via uiStore
- Delete key removes selected transition via sequenceStore.removeTransition
- Sequence name label shifts right by fadeIn.duration + 4px when fade-in present
- Pointer cursor on hover over transition zones

## Task Commits

Each task was committed atomically:

1. **Task 1: Populate trackLayouts with fade data and extend DrawState** - `972b1c2` (feat)
2. **Task 2: drawTransitionOverlay renderer and hit testing interaction** - `c953d71` (feat)

## Files Created/Modified
- `Application/src/components/timeline/TimelineRenderer.ts` - drawTransitionOverlay method, integration in drawLinearTrack and drawFxTrack, DrawState extended with selectedTransition, name label fadeIn shift
- `Application/src/components/timeline/TimelineInteraction.ts` - transitionHitTest method, pointer-down integration for content and FX tracks, hover cursor change, click-away deselect
- `Application/src/components/timeline/TimelineCanvas.tsx` - Wired uiStore.selectedTransition.value into DrawState construction
- `Application/src/lib/frameMap.ts` - trackLayouts and fxTrackLayouts populated with fadeIn/fadeOut from sequence data
- `Application/src/lib/shortcuts.ts` - Delete key handler checks selectedTransition before keyframe/layer/sequence deletion

## Decisions Made
- Transition overlays drawn AFTER thumbnail tiles and key photo separators, BEFORE pink boundary markers (z-order follows UI-SPEC drawing order)
- FX track transition overlays drawn after bar fill/border/name but before edge handles
- transitionHitTest uses the same 4px inset as the visual overlay for precise hit zones on both content and FX tracks
- Delete key checks selectedTransition FIRST (before keyframes, key photos, layers, sequences) per the priority chain
- Hit test priority: keyframe diamonds > transition overlays > name labels > sequence selection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all rendering, hit testing, selection, and deletion flows are fully wired.

## Next Phase Readiness
- Transition overlays visible on timeline, ready for Plan 03 (preview compositing with opacity engine)
- Selection state working, ready for Plan 05 (sidebar transition property controls)
- Delete key flow working, ready for end-to-end transition management

## Self-Check: PASSED

All 5 files verified present. Both commit hashes verified in git log.

---
*Phase: 13-sequence-fade-in-out*
*Completed: 2026-03-20*
