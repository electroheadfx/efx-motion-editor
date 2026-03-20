---
phase: quick-kn9
plan: 01
subsystem: ui
tags: [tauri, menu, shortcuts, macos, preact]

requires:
  - phase: 09-04
    provides: MenuItem::with_id + on_menu_event + emit pattern for native menu items

provides:
  - File submenu in macOS native menu bar with New/Open/Save/Close Project items
  - Close Project handler (Cmd+W) with unsaved changes guard returning to WelcomeScreen
  - Exported handler functions from shortcuts.ts for menu event listeners

affects: [shortcuts, menu, file-operations]

tech-stack:
  added: []
  patterns:
    - "File menu accelerators replace tinykeys for Cmd+N/O/S/W (same pattern as Edit menu Cmd+Z)"

key-files:
  created: []
  modified:
    - Application/src-tauri/src/lib.rs
    - Application/src/lib/shortcuts.ts
    - Application/src/main.tsx

key-decisions:
  - "Native macOS File menu accelerators intercept Cmd+N/O/S/W before webview, replacing tinykeys bindings"
  - "handleCloseProject guards unsaved changes then calls projectStore.closeProject() to reset dirPath"
  - "Cmd+W tinykeys binding kept as fallback for non-macOS platforms"

patterns-established:
  - "File operations routed through native menu accelerators, not tinykeys (consistent with Edit menu undo/redo)"

requirements-completed: []

duration: 2min
completed: 2026-03-20
---

# Quick Task kn9: Add Close Project to Return to Homepage Summary

**Native macOS File menu with New/Open/Save/Close Project items; Cmd+W closes project with unsaved guard and returns to WelcomeScreen**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T13:55:15Z
- **Completed:** 2026-03-20T13:57:27Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- File submenu added to macOS native menu bar between app submenu and Edit submenu
- Close Project (Cmd+W) handler with unsaved changes guard, returning to WelcomeScreen via projectStore.closeProject()
- Four handler functions exported from shortcuts.ts for menu event listeners in main.tsx
- Removed redundant tinykeys Cmd+N/O/S bindings (native accelerators handle them now)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add File submenu to Rust native menu and wire events** - `53d7cfc` (feat)
2. **Task 2: Add close-project handler, export handlers, wire menu listeners** - `f14b49d` (feat)

## Files Created/Modified
- `Application/src-tauri/src/lib.rs` - File submenu with four MenuItem::with_id items and on_menu_event handlers
- `Application/src/lib/shortcuts.ts` - handleCloseProject function, exported handlers, removed Cmd+N/O/S tinykeys, added Cmd+W fallback
- `Application/src/main.tsx` - Four menu event listeners for File menu items

## Decisions Made
- Native macOS File menu accelerators replace tinykeys bindings for Cmd+N/O/S/W (same pattern as Edit menu Cmd+Z/Shift+Z)
- handleCloseProject calls guardUnsavedChanges() before projectStore.closeProject() for safety
- Cmd+W tinykeys binding kept as non-macOS fallback (on macOS, native menu accelerator fires first)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

All files exist, all commits verified, all content assertions confirmed.

---
*Phase: quick-kn9*
*Completed: 2026-03-20*
