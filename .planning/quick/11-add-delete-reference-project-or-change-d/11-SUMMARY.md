---
phase: quick-11
plan: 01
subsystem: ui
tags: [preact, tauri, welcome-screen, file-dialog, recent-projects]

requires:
  - phase: 03-project-mgmt
    provides: WelcomeScreen with recent projects list and appConfig store

provides:
  - Remove action button for stale recent project references
  - Locate action button to re-associate moved .mce project files
  - updateRecentProjectPath function in appConfig

affects: [welcome-screen, project-management]

tech-stack:
  added: []
  patterns: [inline action buttons for unavailable list items, file re-association via dialog]

key-files:
  created: []
  modified:
    - Application/src/lib/appConfig.ts
    - Application/src/components/project/WelcomeScreen.tsx

key-decisions:
  - "Inline text-link buttons (Remove/Locate) replace plain 'Not found' text for unavailable projects"
  - "Thumbnail opacity reduced to 0.4 for unavailable projects as visual staleness indicator"

patterns-established:
  - "Unavailable item action pattern: inline Remove + Locate buttons separated by middle dot"

requirements-completed: [QUICK-11]

duration: 2min
completed: 2026-03-11
---

# Quick Task 11: Remove/Locate Actions for Unavailable Recent Projects Summary

**Remove and Locate inline action buttons for unavailable recent projects on welcome screen, with updateRecentProjectPath for file re-association**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T14:58:44Z
- **Completed:** 2026-03-11T15:00:50Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Unavailable recent projects now show Remove and Locate action buttons instead of plain "Not found" text
- Remove button deletes stale reference from recent list and updates UI immediately
- Locate button opens .mce file picker, validates the new path, and re-associates the project entry
- Thumbnail opacity reduced to 0.4 for unavailable projects as a visual staleness indicator

## Task Commits

Each task was committed atomically:

1. **Task 1: Add updateRecentProjectPath to appConfig and wire Remove/Locate buttons in WelcomeScreen** - `37c4f77` (feat)

## Files Created/Modified
- `Application/src/lib/appConfig.ts` - Added updateRecentProjectPath(oldPath, newPath) function
- `Application/src/components/project/WelcomeScreen.tsx` - Added Remove/Locate inline action buttons for unavailable projects, handleRemove and handleLocate handlers, reduced thumbnail opacity for stale entries

## Decisions Made
- Inline text-link style buttons (no backgrounds) separated by a middle dot for minimal visual footprint
- Remove button uses muted red (#CC6666) with hover brightening (#DD7777)
- Locate button uses accent link color via CSS variable
- Thumbnail opacity 0.4 for unavailable projects provides visual differentiation without hiding the color

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Welcome screen now handles all recent project states (available, moved, deleted)
- No blockers

---
*Quick Task: 11*
*Completed: 2026-03-11*
