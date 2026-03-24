---
phase: 17-enhancements
plan: 04
subsystem: rendering
tags: [gradient, canvas-2d, rendering, export, project-format, persistence, preact]

# Dependency graph
requires:
  - phase: 17-03
    provides: "GradientData/GradientStop types, KeyPhoto.gradient field, FrameEntry.gradient field, GradientBar component, ColorPickerModal gradient mode"
  - phase: 17-02
    provides: "soloStore, solo-aware renderGlobalFrame"
  - phase: 15.2-solid-sequence
    provides: "KeyPhoto with solidColor/isTransparent, ColorPickerModal, solid rendering in previewRenderer"
provides:
  - "Canvas 2D gradient rendering for linear/radial/conic types with conic fallback"
  - "Gradient data propagation through frameMap and buildSequenceFrames"
  - "Project format v13 with MceGradientData serialization/deserialization"
  - "Rust MceGradientData/MceGradientStop structs with serde support"
  - "sequenceStore.updateKeyGradient and updateKeyGradientLive methods"
  - "ColorPickerModal gradient mode wired in KeyPhotoStrip (D-16: both entry points)"
  - "Gradient preview rendering on key photo cards"
affects: [export-renderer, preview-renderer, project-format]

# Tech tracking
tech-stack:
  added: []
  patterns: ["createCanvasGradient helper for Canvas 2D gradient rendering", "Conic gradient runtime fallback for older WebKit"]

key-files:
  created: []
  modified:
    - "Application/src/lib/previewRenderer.ts"
    - "Application/src/lib/exportRenderer.ts"
    - "Application/src/lib/frameMap.ts"
    - "Application/src/types/project.ts"
    - "Application/src/stores/projectStore.ts"
    - "Application/src-tauri/src/models/project.rs"
    - "Application/src/stores/sequenceStore.ts"
    - "Application/src/components/sequence/KeyPhotoStrip.tsx"
    - "Application/src/stores/projectStore.test.ts"

key-decisions:
  - "Project format bumped to v13 with serde(default) for v12 backward compat"
  - "createCanvasGradient uses Math.sqrt(w*w+h*h)/2 diagonal length for linear gradient endpoints"
  - "Conic gradient falls back to linear when createConicGradient is not available"
  - "Gradient check inserted before solidColor check in renderFrame for correct precedence"
  - "updateKeyGradient clears solidColor when gradient is set to avoid ambiguity"

patterns-established:
  - "Gradient rendering: entry.gradient checked before entry.solidColor in content layer rendering"
  - "MceGradientData uses snake_case (center_x, center_y) matching .mce format convention"

requirements-completed: [ENH-05]

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 17 Plan 04: Gradient Rendering Pipeline + Project Persistence v13 Summary

**Canvas 2D gradient rendering with linear/radial/conic support, project format v13 with gradient serialization, and gradient picker wired to key solid entries**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T09:56:17Z
- **Completed:** 2026-03-24T10:03:44Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Added createCanvasGradient helper supporting linear, radial, and conic gradient types with runtime fallback for older WebKit
- Propagated gradient data through both frameMap (preview) and buildSequenceFrames (export) pipelines
- Bumped project format to v13 with MceGradientData types in TypeScript and Rust, backward-compatible with v12
- Wired ColorPickerModal with showGradientMode in KeyPhotoStrip, covering both key photo solids and layer solids (D-16)
- Added gradient preview rendering on key photo cards using buildGradientCSS

## Task Commits

Each task was committed atomically:

1. **Task 1: Add gradient rendering to previewRenderer and exportRenderer, propagate through frameMap** - `7148a01` (feat)
2. **Task 2: Project persistence v13 + gradient UI wiring for key solids and layer solids** - `015b419` (feat)

## Files Created/Modified
- `Application/src/lib/previewRenderer.ts` - Added createCanvasGradient helper, gradient check before solidColor in renderFrame, gradient entry in hasDrawable check
- `Application/src/lib/exportRenderer.ts` - Added kp.gradient spread in buildSequenceFrames
- `Application/src/lib/frameMap.ts` - Added kp.gradient spread in frameMap computed signal
- `Application/src/types/project.ts` - Added MceGradientStop, MceGradientData interfaces, gradient field on MceKeyPhoto
- `Application/src/stores/projectStore.ts` - Version bump 12->13, gradient serialization in buildMceProject, deserialization in hydrateFromMce
- `Application/src-tauri/src/models/project.rs` - Added MceGradientStop, MceGradientData structs with serde, gradient field on MceKeyPhoto
- `Application/src/stores/sequenceStore.ts` - Added updateKeyGradient and updateKeyGradientLive methods with GradientData import
- `Application/src/components/sequence/KeyPhotoStrip.tsx` - Wired showGradientMode, gradient props on ColorPickerModal, gradient preview on cards
- `Application/src/stores/projectStore.test.ts` - Updated version test from 12 to 13

## Decisions Made
- Project format bumped to v13 with serde(default) on gradient field for seamless v12 backward compat
- createCanvasGradient uses diagonal length for linear gradient endpoints to ensure full canvas coverage at any angle
- Conic gradient falls back to linear when createConicGradient API is not available (older WebKit)
- Gradient check inserted before solidColor check in renderFrame -- gradient takes precedence over solidColor
- updateKeyGradient clears solidColor when a gradient is set to avoid ambiguous state where both are present

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated version test from 12 to 13**
- **Found during:** Task 2
- **Issue:** projectStore.test.ts had `expect(project.version).toBe(12)` which failed after version bump to 13
- **Fix:** Updated test expectation to 13
- **Files modified:** Application/src/stores/projectStore.test.ts
- **Committed in:** 015b419 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary update to keep tests green after version bump. No scope creep.

## Issues Encountered
- Worktree was branched before Plan 03 -- required merging main to get gradient type artifacts before execution could begin

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all gradient rendering, persistence, and UI wiring is fully implemented.

## Next Phase Readiness
- Gradient solids feature (D-12 through D-17, ENH-05) is complete end-to-end
- Cross-dissolve between gradient and image entries works naturally via Canvas 2D alpha blending
- Phase 17 enhancements complete: all 4 plans delivered

## Self-Check: PASSED

---
*Phase: 17-enhancements*
*Completed: 2026-03-24*
