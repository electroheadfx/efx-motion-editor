---
phase: 21-motion-blur
plan: 01
subsystem: lib
tags: [webgl2, glsl, motion-blur, preact-signals, vitest]

# Dependency graph
requires: []
provides:
  - MotionBlurSettings type on MceProject (types/project.ts)
  - motionBlur field on ExportSettings (types/export.ts)
  - motionBlurStore with reactive signals and peek() accessors
  - motionBlurEngine with computeLayerVelocity and isStationary
  - glMotionBlur WebGL2 GLSL directional blur shader module
  - exportStore extended with motion blur signals and setters
affects: [21-02, 21-03, 21-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [lazy-init-webgl2-motion-blur, velocity-delta-computation, triangle-filter-blur-kernel]

key-files:
  created:
    - Application/src/stores/motionBlurStore.ts
    - Application/src/lib/motionBlurEngine.ts
    - Application/src/lib/glMotionBlur.ts
    - Application/src/stores/motionBlurStore.test.ts
    - Application/src/lib/motionBlurEngine.test.ts
  modified:
    - Application/src/types/project.ts
    - Application/src/types/export.ts
    - Application/src/stores/exportStore.ts

key-decisions:
  - "VELOCITY_THRESHOLD = 0.5 for stationary layer detection (sum of absolute deltas)"
  - "Separate WebGL2 context for glMotionBlur.ts (not shared with glBlur.ts or glslRuntime.ts) for isolation and simplicity"
  - "Triangle filter weighting in GLSL shader for smooth blur falloff at edges"
  - "Samples clamped to minimum 2 to avoid division by zero in shader t-formula"

patterns-established:
  - "motionBlurStore follows blurStore pattern: signal state with peek() for render-loop reads"
  - "glMotionBlur follows glBlur lazy-init WebGL2 singleton pattern with separate offscreen context"
  - "Velocity computation decoupled from interpolation engine -- pure delta function for testability"

requirements-completed: [MBLR-01, MBLR-03, MBLR-04, MBLR-08]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 21 Plan 01: Motion Blur Foundation Summary

**MotionBlurSettings type, reactive store with peek() accessors, WebGL2 GLSL directional blur shader, and velocity computation engine with 17 unit tests**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T16:04:07Z
- **Completed:** 2026-03-26T16:09:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- motionBlurStore provides enabled/shutterAngle/previewQuality signals with peek() accessors for render-loop-safe reads
- motionBlurEngine exports computeLayerVelocity and isStationary with correct velocity delta math from KeyframeValues
- glMotionBlur.ts provides applyMotionBlur() with lazy-init WebGL2 context, GLSL directional blur shader using triangle filter kernel, texSubImage2D upload, and FBO readback
- MceProject type extended with motion_blur? optional field for persistence readiness
- ExportSettings extended with motionBlur field; exportStore has motion blur signals with setter methods
- All 17 unit tests pass across 2 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, store, and test scaffolds (TDD RED)** - `3687be5` (test)
2. **Task 1: Types, store, and test scaffolds (TDD GREEN)** - `be35a44` (feat)
3. **Task 2: WebGL2 GLSL motion blur shader module** - `34271e3` (feat)

_Note: Task 1 followed TDD with separate RED and GREEN commits_

## Files Created/Modified
- `Application/src/stores/motionBlurStore.ts` - Reactive motion blur settings store with peek() accessors
- `Application/src/lib/motionBlurEngine.ts` - Velocity computation from KeyframeValues deltas, stationary detection
- `Application/src/lib/glMotionBlur.ts` - WebGL2 GLSL directional motion blur shader pipeline
- `Application/src/stores/motionBlurStore.test.ts` - 10 unit tests for store signals and accessors
- `Application/src/lib/motionBlurEngine.test.ts` - 7 unit tests for velocity computation and stationary detection
- `Application/src/types/project.ts` - Added motion_blur? optional field to MceProject
- `Application/src/types/export.ts` - Added motionBlur field to ExportSettings
- `Application/src/stores/exportStore.ts` - Added motionBlurEnabled/motionBlurShutterAngle/motionBlurSubFrames signals with setters

## Decisions Made
- VELOCITY_THRESHOLD = 0.5 for stationary layer detection -- conservative value that skips truly stationary layers while still blurring layers with slight motion
- Separate WebGL2 context for glMotionBlur.ts rather than sharing with glBlur.ts/glslRuntime.ts -- simplicity and isolation, well within browser 16-context limit
- Triangle filter weighting in GLSL shader for smooth blur falloff (higher weight at center, lower at edges)
- Samples clamped to minimum 2 in applyMotionBlur to prevent division-by-zero in shader t-formula

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree did not have node_modules installed; resolved by running `pnpm install` in the Application directory
- Pre-existing TypeScript warnings (TS6133 unused variables) in unrelated files (PaintProperties.tsx, SidebarProperties.tsx, glslRuntime.test.ts) -- out of scope, not addressed

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All building blocks ready for Plan 02 (preview integration): motionBlurStore, motionBlurEngine, and glMotionBlur
- Plan 02 can wire motionBlurStore into PreviewRenderer.renderFrame() per-layer pipeline
- Plan 03 can wire exportStore motion blur signals into export dialog and sub-frame accumulation
- Plan 04 can add .mce persistence using the MceProject motion_blur? field

## Known Stubs

None - all modules are fully implemented with real functionality.

## Self-Check: PASSED

All 6 files verified present. All 3 commits verified in git log.

---
*Phase: 21-motion-blur*
*Completed: 2026-03-26*
