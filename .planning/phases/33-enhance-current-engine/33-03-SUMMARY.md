---
phase: 33-enhance-current-engine
plan: 03
subsystem: ui
tags: [color-picker, modal, ux, preact]

# Dependency graph
requires: []
provides:
  - "Simplified ColorPickerModal: no buttons, no dark overlay, mouse-positioned"
affects: [any-plan-using-ColorPickerModal]

# Tech tracking
tech-stack:
  added: []
  patterns: ["mouse-position-capture-on-click for modal positioning"]

key-files:
  created: []
  modified:
    - "app/src/components/shared/ColorPickerModal.tsx"
    - "app/src/components/overlay/PaintToolbar.tsx"
    - "app/src/components/sequence/KeyPhotoStrip.tsx"
    - "app/src/components/shader-browser/ShaderBrowser.tsx"
    - "app/src/components/sidebar/SidebarFxProperties.tsx"
    - "app/src/components/sidebar/TransitionProperties.tsx"
    - "app/src/components/sidebar/PaintProperties.tsx"

key-decisions:
  - "Keep onCommit/onLiveChange API names unchanged; remove Apply/Cancel buttons and revert behavior"
  - "Clicking outside or pressing Escape commits current color (no cancel/revert)"
  - "Mouse position captured via clientX/clientY at swatch click, stored in component state"

patterns-established:
  - "Mouse-position capture pattern: onClick captures e.clientX/e.clientY into state, passed as mouseX/mouseY to modal"

requirements-completed: [ECUR-11]

# Metrics
duration: 7min
completed: 2026-04-05
---

# Phase 33 Plan 03: Simplify ColorPickerModal Summary

**Realtime color picker without Apply/Cancel buttons, no dark overlay, positioned near mouse click with bounds clamping**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-05T09:44:30Z
- **Completed:** 2026-04-05T09:51:54Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Removed Apply/Cancel buttons from color picker; color applies in realtime via onLiveChange
- Replaced dark bg-black/50 overlay with transparent click-catcher (no visual obstruction)
- Modal now opens near mouse click position, clamped to stay within window bounds with 12px margin
- Updated all 7 call sites across 6 components to capture mouse position and pass to modal

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Apply/Cancel buttons and dark overlay** - `0e73214` (feat)
2. **Task 2: Position modal near mouse position with bounds clamping** - `097bd39` (feat)

## Files Created/Modified
- `app/src/components/shared/ColorPickerModal.tsx` - Removed buttons, dark overlay, revert behavior; added mouseX/mouseY props and clamped positioning
- `app/src/components/overlay/PaintToolbar.tsx` - Capture mouse position on color swatch click
- `app/src/components/sequence/KeyPhotoStrip.tsx` - Capture mouse position on pipette button click
- `app/src/components/shader-browser/ShaderBrowser.tsx` - Capture mouse position on color swatch click
- `app/src/components/sidebar/SidebarFxProperties.tsx` - Capture mouse position on 3 color swatch clicks (tint, shader params, GLSL params)
- `app/src/components/sidebar/TransitionProperties.tsx` - Capture mouse position on 2 color swatch clicks
- `app/src/components/sidebar/PaintProperties.tsx` - Capture mouse position on bg color and brush color swatch clicks

## Decisions Made
- Kept existing `onCommit`/`onLiveChange` API names (plan suggested `onChange` but existing naming is clearer and already realtime)
- Clicking outside or pressing Escape now commits the current color instead of reverting (no cancel flow)
- Removed initialColor/initialGradient refs since revert behavior is no longer needed
- Simplified color preview to single swatch (removed "original" comparison)

## Deviations from Plan

None - plan executed exactly as written. The plan mentioned renaming `onApply` to `onChange`, but the component already used `onCommit`/`onLiveChange` (not `onApply`), so the plan's conditional instruction ("If `onChange` already exists and fires in realtime, simply remove `onApply` and `onCancel`") was followed.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None

## Next Phase Readiness
- ColorPickerModal is fully simplified and ready for use by all components
- No blocking issues for subsequent plans

---
*Phase: 33-enhance-current-engine*
*Completed: 2026-04-05*
