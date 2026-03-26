---
phase: 21-motion-blur
plan: 02
subsystem: lib
tags: [webgl2, glsl, motion-blur, preact-signals, toolbar, popover]

# Dependency graph
requires:
  - phase: 21-01
    provides: "motionBlurStore, motionBlurEngine, glMotionBlur GLSL shader module"
provides:
  - VelocityCache class for per-layer frame delta computation with seek invalidation
  - PreviewRenderer per-layer motion blur pass in render pipeline
  - Toolbar motion blur toggle button with dropdown popover (shutter angle + quality tier)
affects: [21-03, 21-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [velocity-cache-seek-invalidation, per-layer-motion-blur-compositing, toolbar-popover-click-outside]

key-files:
  modified:
    - Application/src/lib/motionBlurEngine.ts
    - Application/src/lib/previewRenderer.ts
    - Application/src/components/layout/Toolbar.tsx

key-decisions:
  - "VelocityCache invalidates on non-sequential frame for seek detection (Math.abs(currentFrame - lastFrame) > 1)"
  - "Content layers in else-branch already exclude generator/adjustment/paint -- only isFxLayer() check needed for motion blur gating"
  - "Motion blur pass goes after gaussian blur when both apply (coexistence per D-12)"

patterns-established:
  - "VelocityCache per-frame delta caching with seek invalidation for motion blur velocity computation"
  - "Toolbar split-button: main button toggles, chevron opens popover with settings"

requirements-completed: [MBLR-01, MBLR-02, MBLR-09]

# Metrics
duration: 5min
completed: 2026-03-26
---

# Phase 21 Plan 02: Preview Integration & Toolbar UI Summary

**Per-layer GLSL motion blur wired into PreviewRenderer with VelocityCache seek invalidation, plus toolbar toggle button with shutter angle slider and quality tier popover**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-26T16:14:14Z
- **Completed:** 2026-03-26T16:20:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- VelocityCache class caches per-layer KeyframeValues and computes velocity deltas, with automatic invalidation on seek (non-sequential frame detection)
- PreviewRenderer applies per-layer GLSL motion blur for animated content layers, coexisting with existing gaussian blur
- Toolbar has motion blur toggle button (Zap icon) with dropdown popover containing shutter angle slider (0-360deg) and preview quality tier selector (Off/Low 4/Med 8)
- Stationary layers skip motion blur pass for performance (MBLR-08)

## Task Commits

Each task was committed atomically:

1. **Task 1: Velocity cache and PreviewRenderer motion blur integration** - `aeed982` (feat)
2. **Task 2: Toolbar motion blur toggle button with dropdown popover** - `d2c677a` (feat)

## Files Created/Modified
- `Application/src/lib/motionBlurEngine.ts` - Added VelocityCache class with seek invalidation and per-layer delta computation
- `Application/src/lib/previewRenderer.ts` - Added motion blur imports, VelocityCache field, per-layer motion blur pass with gaussian blur coexistence
- `Application/src/components/layout/Toolbar.tsx` - Added motion blur toggle button with Zap icon, dropdown popover with shutter angle slider and quality tier selector

## Decisions Made
- VelocityCache invalidates on non-sequential frames (seek detection) -- Math.abs(currentFrame - lastFrame) > 1 clears the cache to prevent incorrect blur artifacts after seeking
- Removed redundant `layer.type !== 'paint'` check in motion blur gating since TypeScript already narrows the type in the content-layer else-branch (generator/adjustment/paint handled by earlier branches)
- Motion blur applied after gaussian blur when both effects are active on the same layer (per D-12 integration point)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed redundant type guard causing TS2367**
- **Found during:** Task 1 (PreviewRenderer integration)
- **Issue:** Plan specified `layer.type !== 'paint'` in wantMotionBlur check, but TypeScript had already narrowed the type in the content layer else-branch, causing TS2367 "comparison appears unintentional"
- **Fix:** Removed the `layer.type !== 'paint'` check since the else-branch already excludes paint layers
- **Files modified:** Application/src/lib/previewRenderer.ts
- **Verification:** TypeScript compiles with no errors (only pre-existing TS6133 warnings)
- **Committed in:** aeed982 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type guard simplification. No scope creep.

## Issues Encountered
- Pre-existing TypeScript TS6133 warnings in PaintProperties.tsx, SidebarProperties.tsx, glslRuntime.test.ts -- out of scope, not addressed
- Pre-existing test failures (3 audioWaveform + 1 projectStore version) -- out of scope, documented in PROJECT.md

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Preview motion blur pipeline fully wired: toggle, shutter angle, quality tiers, per-layer velocity blur
- Plan 03 can wire motion blur into exportRenderer with sub-frame accumulation
- Plan 04 can add .mce persistence for motion blur settings

## Known Stubs

None - all modules are fully implemented with real functionality.

## Self-Check: PASSED

All 3 files verified present. All 2 commits verified in git log.

---
*Phase: 21-motion-blur*
*Completed: 2026-03-26*
