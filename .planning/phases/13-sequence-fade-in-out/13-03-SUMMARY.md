---
phase: 13-sequence-fade-in-out
plan: 03
subsystem: ui
tags: [transitions, fade, opacity, preview, compositing, sidebar, preact-signals]

# Dependency graph
requires:
  - phase: 13-01
    provides: transitionEngine pure functions (computeFadeOpacity, computeSolidFadeAlpha), sequenceStore transition CRUD, uiStore selectedTransition
provides:
  - Preview compositing with fade opacity (transparency + solid color modes)
  - TransitionProperties sidebar component with Duration/Mode/Color/Curve/Remove controls
  - LeftPanel wiring with conditional rendering and add buttons for transitions
affects: [13-04, 13-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [sequenceOpacity-parameter-for-fade, solid-color-overlay-with-setTransform-dpi-safety]

key-files:
  created:
    - Application/src/components/sidebar/TransitionProperties.tsx
  modified:
    - Application/src/components/Preview.tsx
    - Application/src/lib/previewRenderer.ts
    - Application/src/components/layout/LeftPanel.tsx

key-decisions:
  - "sequenceOpacity parameter multiplied into per-layer globalAlpha rather than offscreen canvas compositing (simpler, more performant)"
  - "Solid color overlay drawn in physical pixel coords via setTransform(1,0,0,1,0,0) for DPI safety"
  - "SectionLabel uses text prop (existing API), NumericInput includes label prop (existing API)"

patterns-established:
  - "Fade opacity propagated via sequenceOpacity parameter through renderFrame -> drawLayer/drawGeneratorLayer"
  - "Solid mode: render full content then overlay solid color fillRect at physical coords"

requirements-completed: [FADE-02, FADE-03]

# Metrics
duration: 6min
completed: 2026-03-20
---

# Phase 13 Plan 03: Preview & Sidebar UI Summary

**Preview compositing with transparency/solid fade modes and TransitionProperties sidebar with Duration/Mode/Color/Curve/Remove controls**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T19:24:59Z
- **Completed:** 2026-03-20T19:31:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Preview renderer applies fade opacity via sequenceOpacity parameter in both reactive and rAF render paths
- Transparency mode multiplies fade opacity into each layer's globalAlpha
- Solid color mode overlays configurable hex color at computed alpha via fullscreen fillRect
- TransitionProperties component with Duration (NumericInput), Mode toggle (Transparency/Solid Color), Color picker, Curve dropdown, and Remove button
- LeftPanel shows TransitionProperties when transition is selected (before layer checks)
- LeftPanel shows TRANSITIONS section with Add Fade In / Add Fade Out buttons when content sequence is selected

## Task Commits

Each task was committed atomically:

1. **Task 1: Preview compositing with fade opacity** - `8c931a8` (feat)
2. **Task 2: TransitionProperties sidebar component and LeftPanel wiring** - `26fd81a` (feat)

## Files Created/Modified
- `Application/src/lib/previewRenderer.ts` - Added sequenceOpacity parameter to renderFrame, multiplied into globalAlpha in all draw paths
- `Application/src/components/Preview.tsx` - Imported computeFadeOpacity/computeSolidFadeAlpha, applied fade logic in both render paths
- `Application/src/components/sidebar/TransitionProperties.tsx` - New component with Duration/Mode/Color/Curve/Remove controls
- `Application/src/components/layout/LeftPanel.tsx` - TransitionProperties wiring, TRANSITIONS section with add buttons

## Decisions Made
- Used sequenceOpacity parameter (option a from research) over offscreen canvas compositing -- simpler, more performant, applied per-layer
- Solid color overlay uses setTransform(1,0,0,1,0,0) to reset to physical pixel coordinates for DPI-safe fullscreen fill
- SectionLabel and NumericInput use their existing APIs (text prop and label prop respectively) rather than plan's hypothetical children-based API

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SectionLabel and NumericInput API mismatch**
- **Found during:** Task 2 (TransitionProperties creation)
- **Issue:** Plan code used `<SectionLabel>{text}</SectionLabel>` children API and NumericInput without label, but actual components use `text` prop and require `label` prop
- **Fix:** Used correct APIs: `<SectionLabel text={sectionTitle} />` and `<NumericInput label="Duration" ... />`
- **Files modified:** Application/src/components/sidebar/TransitionProperties.tsx
- **Verification:** TypeScript compilation passes
- **Committed in:** 26fd81a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor API correction, no scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data flows are wired (fade opacity computation, store CRUD, sidebar controls).

## Next Phase Readiness
- Preview compositing with fade complete, ready for Plan 04 (frameMap integration) and Plan 05 (timeline overlay rendering)
- TransitionProperties component complete, reusable from both selected-transition and inline-in-sidebar contexts
- All property changes go through sequenceStore with full undo/redo support

## Self-Check: PASSED

All 4 source files verified present. All 2 commit hashes verified in git log. SUMMARY.md created.

---
*Phase: 13-sequence-fade-in-out*
*Completed: 2026-03-20*
