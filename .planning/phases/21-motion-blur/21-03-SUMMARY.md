---
phase: 21-motion-blur
plan: 03
subsystem: export
tags: [motion-blur, webgl2, sub-frame-accumulation, export-pipeline, project-persistence]

# Dependency graph
requires:
  - phase: 21-01
    provides: motionBlurStore, glMotionBlur.ts, exportStore motion blur signals, MceProject.motion_blur type
provides:
  - Sub-frame accumulation export renderer (renderFrameWithMotionBlur)
  - Fractional frame support in renderGlobalFrame for sub-frame rendering
  - Export dialog Motion Blur section with enable, shutter angle, sub-frame selector
  - Project persistence (.mce v15) for motion blur settings round-trip
  - motionBlurStore.reset() in closeProject for clean project switching
affects: [21-04, export, project-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns: [accumulator-canvas-blending, temporary-store-override, fractional-frame-interpolation]

key-files:
  created: []
  modified:
    - Application/src/lib/exportRenderer.ts
    - Application/src/lib/exportEngine.ts
    - Application/src/components/export/FormatSelector.tsx
    - Application/src/stores/projectStore.ts
    - Application/src/stores/projectStore.test.ts

key-decisions:
  - "Accumulator canvas with globalAlpha=1/N for equal-weight sub-frame blending"
  - "Temporary motionBlurStore.shutterAngle override during export for D-11 export shutter angle"
  - "Math.floor(globalFrame) for fm[] indexing with fractional offset for interpolation"
  - "Version bump to 15 for motion_blur field in .mce format"

patterns-established:
  - "Temporary store signal override with try/finally restore for export-specific values"
  - "Fractional frame support via Math.floor + offset pattern in renderGlobalFrame"

requirements-completed: [MBLR-05, MBLR-06, MBLR-07, MBLR-03]

# Metrics
duration: 6min
completed: 2026-03-26
---

# Phase 21 Plan 03: Export Sub-frame Accumulation, Dialog UI, and Project Persistence Summary

**Combined GLSL velocity blur + sub-frame accumulation export pipeline with Motion Blur dialog section and .mce v15 persistence**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-26T16:13:47Z
- **Completed:** 2026-03-26T16:19:47Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Export pipeline renders each frame with N sub-frames (4/8/16) at fractional positions, accumulating via 1/N alpha blending
- Export shutter angle override temporarily sets motionBlurStore.shutterAngle so GLSL uStrength receives the correct value
- Export dialog shows Motion Blur section with enable toggle, shutter angle slider (0-360), and sub-frame count selector (4/8/16)
- Motion blur settings fully persist in .mce v15 format with backward compatibility for v14 and older projects

## Task Commits

Each task was committed atomically:

1. **Task 1: Export pipeline sub-frame accumulation and engine integration** - `5939c57` (feat)
2. **Task 2: Export dialog UI section and project persistence** - `b3d2066` (feat)

## Files Created/Modified
- `Application/src/lib/exportRenderer.ts` - Added renderFrameWithMotionBlur with accumulator canvas; added fractional frame support via Math.floor in renderGlobalFrame
- `Application/src/lib/exportEngine.ts` - Wired motion blur toggle: conditionally calls renderFrameWithMotionBlur vs renderGlobalFrame
- `Application/src/components/export/FormatSelector.tsx` - Added Motion Blur section with enable toggle, shutter angle slider, sub-frame selector pills
- `Application/src/stores/projectStore.ts` - Added motion_blur serialization in buildMceProject, hydration in hydrateFromMce, version bump to 15, motionBlurStore.reset() in closeProject
- `Application/src/stores/projectStore.test.ts` - Fixed version assertion from 13 to 15

## Decisions Made
- Accumulator canvas with globalAlpha = 1/N for equal-weight sub-frame blending (simpler and correct for uniform temporal sampling)
- Temporary motionBlurStore.shutterAngle override with try/finally restore so getStrength() returns export-specific value during rendering (per D-11)
- Math.floor(globalFrame) for fm[] array indexing with fractionalOffset passed to interpolation for smooth sub-frame rendering
- export_sub_frames persisted via exportStore.motionBlurSubFrames.peek() (not hardcoded) for correct round-trip

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed stale version assertion in projectStore test**
- **Found during:** Task 2 (project persistence)
- **Issue:** Test expected version 13 but code was already on version 14 (pre-existing), now bumped to 15
- **Fix:** Updated test assertion from 13 to 15
- **Files modified:** Application/src/stores/projectStore.test.ts
- **Verification:** projectStore tests now all pass
- **Committed in:** b3d2066 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor test fix necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Export pipeline complete with motion blur support
- Project persistence complete with v15 format
- Ready for Plan 04: keyboard shortcut, final tests, and visual verification

## Self-Check: PASSED

All files verified present, all commits verified in history.

---
*Phase: 21-motion-blur*
*Completed: 2026-03-26*
