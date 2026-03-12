---
phase: 09-canvas-zoom
plan: 04
subsystem: ui
tags: [tauri, menu, zoom, keyboard-shortcuts, wkwebview, macos]

requires:
  - phase: 09-canvas-zoom/01
    provides: "canvasStore with zoomIn/zoomOut/fitToWindow methods"
provides:
  - "Tauri View menu with Zoom In/Zoom Out/Fit to Window items"
  - "Native accelerator interception for Cmd+=/Cmd+-/Cmd+0 on macOS"
  - "Frontend event listeners bridging menu events to canvasStore"
affects: []

tech-stack:
  added: []
  patterns: ["Tauri native menu -> emit -> frontend listener pattern extended to View menu"]

key-files:
  created: []
  modified:
    - "Application/src-tauri/src/lib.rs"
    - "Application/src/main.tsx"

key-decisions:
  - "Followed exact same pattern as Edit menu Undo/Redo for consistency"
  - "Kept tinykeys bindings in shortcuts.ts as non-macOS fallback"

patterns-established:
  - "View menu zoom items: same MenuItem::with_id + on_menu_event + listen pattern as Edit menu"

requirements-completed: [ZOOM-03]

duration: 2min
completed: 2026-03-12
---

# Phase 09 Plan 04: Keyboard Shortcuts via Tauri View Menu Summary

**Tauri View menu with Cmd+=/Cmd+-/Cmd+0 accelerators overriding WKWebView native zoom, bridged to canvasStore via event listeners**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T17:28:12Z
- **Completed:** 2026-03-12T17:29:44Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added View menu to Tauri native menu bar with Zoom In, Zoom Out, and Fit to Window items
- Wired native accelerators (CmdOrCtrl+=, CmdOrCtrl+-, CmdOrCtrl+0) to override WKWebView's built-in zoom handlers
- Added frontend event listeners in main.tsx that bridge menu events to canvasStore.zoomIn/zoomOut/fitToWindow

## Task Commits

Each task was committed atomically:

1. **Task 1: Add View menu with zoom items to Tauri native menu** - `314a517` (feat)
2. **Task 2: Add frontend listeners for zoom menu events** - `2ee9a4a` (feat)

## Files Created/Modified
- `Application/src-tauri/src/lib.rs` - Added View submenu with zoom MenuItem::with_id items and extended on_menu_event handler
- `Application/src/main.tsx` - Added canvasStore import and three event listeners for menu:zoom-in/zoom-out/fit-to-window

## Decisions Made
- Followed the exact same pattern as the Edit menu's Undo/Redo implementation for consistency and maintainability
- Kept existing tinykeys bindings in shortcuts.ts untouched -- they serve as fallback for non-macOS platforms

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All canvas zoom keyboard shortcuts now work on macOS via native menu interception
- Existing tinykeys shortcuts remain for cross-platform fallback
- No blockers for subsequent work

## Self-Check: PASSED

All files exist, all commits verified, key content confirmed in both lib.rs and main.tsx.

---
*Phase: 09-canvas-zoom*
*Completed: 2026-03-12*
