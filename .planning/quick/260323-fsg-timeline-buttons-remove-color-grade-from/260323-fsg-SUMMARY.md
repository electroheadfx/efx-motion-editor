---
phase: quick
plan: 260323-fsg
subsystem: ui
tags: [timeline, toolbar, preact, lucide]

requires: []
provides:
  - "Cleaned up timeline toolbar: no Color Grade/Browse Shaders in Layer menu, Shader label, Audio label"
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - Application/src/components/timeline/AddFxMenu.tsx
    - Application/src/components/layout/TimelinePanel.tsx
    - Application/src/components/timeline/AddAudioButton.tsx

key-decisions:
  - "Removed unused capturePreviewCanvas import from AddFxMenu after GLSL section removal"
  - "Audio button hover style matches Shader/Layer buttons (hover:bg-border-subtle) instead of original hover:bg-hover-item"

patterns-established: []

requirements-completed: []

duration: 2min
completed: 2026-03-23
---

# Quick Task 260323-fsg: Timeline Buttons Cleanup Summary

**Removed Color Grade and Browse Shaders from Layer dropdown, renamed GLSL to Shader, added Audio text label to match sibling button style**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-23T07:04:44Z
- **Completed:** 2026-03-23T07:06:28Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Removed Color Grade entry from the Layer dropdown ADJUSTMENTS section
- Removed entire GLSL section (separator, header, Browse Shaders button) from Layer dropdown
- Renamed timeline bar shader button from "GLSL" to "Shader" with updated title attribute
- Added "Audio" text label next to Music icon on the audio button, styled consistently with Shader and Layer buttons

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Color Grade and Browse Shaders, rename GLSL to Shader, add Audio label** - `82f240c` (feat)

## Files Created/Modified
- `Application/src/components/timeline/AddFxMenu.tsx` - Removed Color Grade button, removed GLSL section, removed unused import
- `Application/src/components/layout/TimelinePanel.tsx` - Renamed GLSL button to Shader, updated title attribute
- `Application/src/components/timeline/AddAudioButton.tsx` - Added Audio text label with consistent button styling

## Decisions Made
- Removed unused `capturePreviewCanvas` import from AddFxMenu.tsx (Rule 1 - cleanup after GLSL section removal)
- Audio button hover style changed from `hover:bg-[var(--color-bg-hover-item)] hover:text-white` to `hover:bg-[var(--color-border-subtle)]` to match Shader and Layer button patterns

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused capturePreviewCanvas import**
- **Found during:** Task 1 (AddFxMenu.tsx edits)
- **Issue:** After removing the GLSL section that used `capturePreviewCanvas`, the import became unused
- **Fix:** Removed the unused import line
- **Files modified:** Application/src/components/timeline/AddFxMenu.tsx
- **Verification:** File compiles without unused import warnings
- **Committed in:** 82f240c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/cleanup)
**Impact on plan:** Necessary cleanup to avoid unused import. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Timeline toolbar is cleaned up and ready for visual verification
- No blockers

---
*Quick task: 260323-fsg*
*Completed: 2026-03-23*
