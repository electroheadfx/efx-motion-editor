---
phase: 18-canvas-motion-path
plan: 01
subsystem: ui
tags: [preact, svg, canvas, motion-path, keyframe, animation, hit-test]

# Dependency graph
requires:
  - phase: 15-keyframe-animation
    provides: keyframeStore, keyframeEngine interpolateAt, KeyframeValues type
provides:
  - MotionPath SVG overlay component with dotted trail and keyframe circles
  - motionPathHitTest utility for keyframe circle hit detection
  - sampleMotionDots and hasMotion pure helper functions
  - CanvasArea integration rendering motion path in project space
affects: [18-canvas-motion-path-plan-02]

# Tech tracking
tech-stack:
  added: []
  patterns: [counter-scaled SVG overlay in CSS-transformed canvas wrapper, polyline optimization for high frame counts]

key-files:
  created:
    - Application/src/components/canvas/MotionPath.tsx
    - Application/src/components/canvas/motionPathHitTest.ts
    - Application/src/components/canvas/motionPath.test.ts
    - Application/src/components/canvas/motionPathHitTest.test.ts
  modified:
    - Application/src/components/layout/CanvasArea.tsx

key-decisions:
  - "Polyline optimization for >300 frame paths using stroke-dasharray instead of individual circles"
  - "Counter-scaled SVG sizes using 1/zoom pattern matching TransformOverlay convention"

patterns-established:
  - "SVG overlay in CSS-transformed wrapper: position absolute, inset 0, pointerEvents none"
  - "Exported pure functions for testability: sampleMotionDots, hasMotion separated from component"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-03-24
---

# Phase 18 Plan 01: Motion Path Visualization Summary

**SVG motion path overlay with dotted trail, keyframe markers, current-frame highlight, and hit test utility for canvas keyframe visualization**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T17:58:34Z
- **Completed:** 2026-03-24T18:02:59Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- MotionPath.tsx renders dotted trail using interpolateAt() with accent color CSS variable across all themes
- Keyframe circles rendered as filled (selected) or outlined (not selected) with counter-scaled radii
- Current frame position highlighted with larger dot; path auto-hides during playback and for non-keyframed layers
- Hit test utility ready with zoom-aware radius scaling for Plan 02 drag interaction
- 17 unit tests covering pure logic functions and hit testing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create motionPathHitTest.ts and MotionPath.tsx with tests** - `69d0b52` (feat)
2. **Task 2: Integrate MotionPath into CanvasArea and verify rendering** - `9850395` (feat)

## Files Created/Modified
- `Application/src/components/canvas/MotionPath.tsx` - SVG overlay with dotted trail, keyframe circles, current-frame highlight
- `Application/src/components/canvas/motionPathHitTest.ts` - Hit testing for keyframe circles with counter-scaled radius
- `Application/src/components/canvas/motionPath.test.ts` - 10 tests for sampleMotionDots and hasMotion
- `Application/src/components/canvas/motionPathHitTest.test.ts` - 7 tests for hit testing with zoom counter-scaling
- `Application/src/components/layout/CanvasArea.tsx` - Added MotionPath import and JSX between Preview and TransformOverlay

## Decisions Made
- Used polyline with stroke-dasharray for paths exceeding 300 frames to avoid rendering hundreds of individual SVG circles
- Replicated findLayerContext logic locally in MotionPath since it is not exported from keyframeStore
- Exported sampleMotionDots and hasMotion as named exports for unit testability while keeping the component as the default entry point

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all data paths are wired to live signals from keyframeStore, timelineStore, canvasStore, projectStore, and layerStore.

## Next Phase Readiness
- MotionPath component is integrated and renders in project space behind transform handles
- motionPathHitTest utility is ready for Plan 02 drag interaction
- SVG has pointerEvents: none as required; Plan 02 will add interaction via TransformOverlay
- All 17 unit tests pass

## Self-Check: PASSED

---
*Phase: 18-canvas-motion-path*
*Completed: 2026-03-24*
