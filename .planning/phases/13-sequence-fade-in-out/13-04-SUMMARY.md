---
phase: 13-sequence-fade-in-out
plan: 04
subsystem: transitions
tags: [cross-dissolve, dual-render, timeline-shortening, frameMap, preview, canvas-2d]

# Dependency graph
requires:
  - phase: 13-01
    provides: Transition types, transitionEngine pure functions, sequenceStore CRUD, uiStore selectedTransition
  - phase: 13-02
    provides: drawTransitionOverlay method, transitionHitTest, TrackLayout fadeIn/fadeOut fields
  - phase: 13-03
    provides: Preview compositing with sequenceOpacity parameter, TransitionProperties sidebar component
provides:
  - computeCrossDissolveOpacity pure function returning [outgoing, incoming] opacity pair
  - frameMap timeline shortening (per D-14) -- skips incoming sequence overlapped head frames
  - trackLayouts shortened positions with crossDissolve field
  - crossDissolveOverlaps computed signal for dual-render overlap zone coordinates
  - CrossDissolveOverlap interface exported from frameMap.ts
  - Preview dual-sequence rendering during cross dissolve overlap zone
  - Cross dissolve overlay on timeline centered on sequence boundary
  - Cross dissolve hit testing and selection
  - "Add Cross Dissolve" button in sidebar TRANSITIONS section
affects: [13-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [cross-dissolve-dual-render, timeline-shortening-skip-incoming-head, overlap-zone-computed-signal]

key-files:
  created: []
  modified:
    - Application/src/lib/transitionEngine.ts
    - Application/src/lib/frameMap.ts
    - Application/src/types/timeline.ts
    - Application/src/components/Preview.tsx
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/timeline/TimelineInteraction.ts
    - Application/src/components/layout/LeftPanel.tsx

key-decisions:
  - "Outgoing sequence owns frameMap slots during overlap; incoming's head frames skipped (D-14 timeline shortening)"
  - "Refactored reactive render effect to delegate to renderFromFrameMap, eliminating code duplication"
  - "Cross dissolve default duration 24 frames (12 per side) per UI-SPEC"
  - "buildSequenceFrames helper constructs synthetic FrameEntry array for cross dissolve dual-render"

patterns-established:
  - "Cross dissolve overlap zone: outgoing sequence's last floor(D/2) frames + incoming's first ceil(D/2) frames"
  - "Dual-render pattern: outgoing at outOpacity with clearCanvas=true, incoming at inOpacity with clearCanvas=false"
  - "crossDissolveOverlaps signal provides overlap coordinates in shortened-timeline space for Preview and Timeline"

requirements-completed: [FADE-03]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 13 Plan 04: Cross Dissolve Summary

**Cross dissolve with timeline shortening (D-14), dual-sequence preview rendering, timeline overlay, and sidebar Add button**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T19:38:21Z
- **Completed:** 2026-03-20T19:46:23Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- computeCrossDissolveOpacity returns eased [outgoing, incoming] opacity pair for cross dissolve blending
- frameMap shortens timeline by skipping incoming sequence's overlapped head frames (per D-14)
- trackLayouts reflects shortened positions with crossDissolve duration field for timeline rendering
- crossDissolveOverlaps computed signal provides overlap zone coordinates in shortened-timeline space
- Preview renders both sequences simultaneously during overlap: outgoing fading out, incoming fading in on top
- Cross dissolve overlay renders on timeline centered on sequence boundary with two-zone gradient
- Hit testing and selection works for cross dissolve zones
- "Add Cross Dissolve" button appears in sidebar only when next content sequence exists

## Task Commits

Each task was committed atomically:

1. **Task 1: Cross dissolve engine, frameMap timeline shortening, and preview dual-render** - `5988b74` (feat)
2. **Task 2: Cross dissolve timeline rendering and Add button** - `8ff6d76` (feat)

## Files Created/Modified
- `Application/src/lib/transitionEngine.ts` - Added computeCrossDissolveOpacity pure function
- `Application/src/lib/frameMap.ts` - frameMap/trackLayouts shortened for cross dissolve, crossDissolveOverlaps signal, CrossDissolveOverlap interface
- `Application/src/types/timeline.ts` - TrackLayout extended with crossDissolve field
- `Application/src/components/Preview.tsx` - Cross dissolve dual-render with buildSequenceFrames/interpolateLayers helpers, refactored reactive effect
- `Application/src/components/timeline/TimelineRenderer.ts` - Cross dissolve overlay drawing in drawLinearTrack
- `Application/src/components/timeline/TimelineInteraction.ts` - Cross dissolve hit testing in transitionHitTest
- `Application/src/components/layout/LeftPanel.tsx` - "Add Cross Dissolve" button with hasNextSeq guard, inline TransitionProperties

## Decisions Made
- Outgoing sequence owns the frameMap slots during overlap; incoming sequence's head frames are skipped to shorten the timeline (per D-14 locked decision)
- Refactored the reactive render effect in Preview.tsx to delegate to renderFromFrameMap instead of duplicating rendering logic -- eliminates ~80 lines of duplicated code and ensures cross dissolve works in both scrub and playback paths
- Cross dissolve default duration is 24 frames (12 per side) per UI-SPEC specification
- buildSequenceFrames helper constructs synthetic FrameEntry arrays for cross dissolve dual-render since the incoming sequence's head frames are not in the global frameMap

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Eliminated duplicated render logic in Preview.tsx reactive effect**
- **Found during:** Task 1 (Preview dual-render implementation)
- **Issue:** The reactive render effect duplicated all of renderFromFrameMap's logic (~80 lines). Adding cross dissolve to both paths would double the maintenance surface.
- **Fix:** Refactored reactive effect to read signals for subscription, then delegate to renderFromFrameMap
- **Files modified:** Application/src/components/Preview.tsx
- **Verification:** TypeScript compilation passes, both scrub and playback paths use same cross dissolve logic
- **Committed in:** 5988b74 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Beneficial refactor that reduces code duplication and ensures both render paths have identical behavior.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data flows are wired (cross dissolve engine, frameMap shortening, dual-render, timeline overlay, sidebar button).

## Next Phase Readiness
- Cross dissolve complete, ready for Plan 05 (final integration and polish)
- All transition types (fade-in, fade-out, cross-dissolve) now fully functional
- Timeline shortening per D-14 validated by totalFrames reduction

## Self-Check: PASSED

All 7 files verified present. Both commit hashes verified in git log.

---
*Phase: 13-sequence-fade-in-out*
*Completed: 2026-03-20*
