---
phase: quick-3
plan: 01
subsystem: ui
tags: [keyboard-shortcuts, tinykeys, tauri-menu, zoom]

requires:
  - phase: 09-canvas-zoom
    provides: canvasStore zoom/pan system, View menu zoom items
provides:
  - Bare = / - key bindings for canvas zoom (no Cmd modifier)
  - Updated tooltips and shortcuts overlay labels
affects: []

tech-stack:
  added: []
  patterns: [bare key shortcuts for frequently-used canvas actions]

key-files:
  created: []
  modified:
    - Application/src/lib/shortcuts.ts
    - Application/src-tauri/src/lib.rs
    - Application/src/main.tsx
    - Application/src/components/layout/CanvasArea.tsx
    - Application/src/components/overlay/ShortcutsOverlay.tsx

key-decisions:
  - "Removed Tauri menu accelerators for zoom in/out since bare keys cannot be native menu accelerators on macOS"

patterns-established: []

requirements-completed: [QUICK-3]

duration: 1min
completed: 2026-03-13
---

# Quick Task 3: Change Zoom Shortcuts Summary

**Bare = / - keys for canvas zoom replacing Cmd+= / Cmd+-, with updated Tauri menu, tooltips, and shortcuts overlay**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-13T08:57:49Z
- **Completed:** 2026-03-13T08:58:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Changed zoom in/out shortcuts from Cmd+= / Cmd+- to bare = / - keys via tinykeys
- Removed native CmdOrCtrl accelerators from Tauri View menu zoom items (bare keys cannot be macOS menu accelerators)
- Updated zoom button tooltips and shortcuts overlay to reflect new key bindings

## Task Commits

Each task was committed atomically:

1. **Task 1: Update zoom key bindings and Tauri menu accelerators** - `3e6e3da` (feat)
2. **Task 2: Update tooltips and shortcuts overlay labels** - `51aca11` (feat)

## Files Created/Modified
- `Application/src/lib/shortcuts.ts` - Changed $mod+Equal/$mod+Minus to Equal/Minus in tinykeys bindings
- `Application/src-tauri/src/lib.rs` - Removed CmdOrCtrl accelerators from zoom-in/zoom-out MenuItem
- `Application/src/main.tsx` - Updated comment explaining bare key zoom vs menu click path
- `Application/src/components/layout/CanvasArea.tsx` - Updated tooltip strings from "Cmd+-" / "Cmd+=" to "-" / "="
- `Application/src/components/overlay/ShortcutsOverlay.tsx` - Removed Cmd symbol from zoom in/out shortcut labels

## Decisions Made
- Removed Tauri menu accelerators for zoom in/out since bare keys (= / -) cannot be valid native menu accelerators on macOS; View menu items kept for discoverability but no longer show accelerator hints

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

All 5 modified files verified present. Both task commits (3e6e3da, 51aca11) verified in git log.

---
*Quick task: 3*
*Completed: 2026-03-13*
