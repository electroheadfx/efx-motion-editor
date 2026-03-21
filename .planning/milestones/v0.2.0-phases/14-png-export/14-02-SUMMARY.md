---
phase: 14-png-export
plan: 02
subsystem: ui
tags: [preact, tauri, export-dialog, toolbar, menu, shortcut]

# Dependency graph
requires:
  - phase: 12.1-03
    provides: "EditorMode pattern and SettingsView full-window modal"
  - phase: 12.14
    provides: "Toolbar Export button (unwired)"
provides:
  - "ExportView full-window modal with FormatSelector and ExportPreview panels"
  - "EditorMode 'export' support across EditorShell routing"
  - "Three entry points to export dialog: toolbar button, File menu, Cmd+Shift+E"
  - "Export types (ExportFormat, ExportResolution) and exportStore (created as Plan 01 dependency)"
affects: [14-03-export-engine, 14-04-ffmpeg, 14-05-metadata]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-window modal view pattern extended for export (same as SettingsView/ImportedView)"
    - "Toolbar button toggle pattern for mode switching"
    - "Native Cocoa menu accelerator for Cmd+Shift+E (no tinykeys binding needed)"

key-files:
  created:
    - Application/src/components/views/ExportView.tsx
    - Application/src/components/export/FormatSelector.tsx
    - Application/src/components/export/ExportPreview.tsx
    - Application/src/types/export.ts
    - Application/src/stores/exportStore.ts
  modified:
    - Application/src/stores/uiStore.ts
    - Application/src/components/layout/EditorShell.tsx
    - Application/src/components/layout/Toolbar.tsx
    - Application/src-tauri/src/lib.rs
    - Application/src/main.tsx

key-decisions:
  - "menu:export listener placed in main.tsx (not shortcuts.ts) following existing File menu listener pattern"
  - "Export types and exportStore created inline as Rule 3 dependency (Plan 01 not yet executed)"
  - "Preview thumbnail is placeholder div (actual canvas rendering wired in Plan 03)"
  - "Export button onClick is no-op placeholder (actual export trigger wired in Plan 03)"

patterns-established:
  - "EditorMode 'export' conditional render in EditorShell"
  - "Toolbar Export button toggles between export/editor modes"
  - "File > Export... with CmdOrCtrl+Shift+E native accelerator"

requirements-completed: [EXPORT-06]

# Metrics
duration: 5min
completed: 2026-03-21
---

# Phase 14 Plan 02: Export Dialog UI Summary

**Full-window export dialog with format selector (PNG/ProRes/H.264/AV1), resolution multipliers (0.15x-2x), native folder picker, and three entry points (toolbar, menu, Cmd+Shift+E)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T10:50:15Z
- **Completed:** 2026-03-21T10:56:05Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Created ExportView full-window modal following SettingsView pattern with header, body (FormatSelector + ExportPreview), and bottom export button bar
- Created FormatSelector with 4 format radio buttons (PNG/ProRes/H.264/AV1) and 5 resolution multipliers showing computed pixel dimensions
- Created ExportPreview with frame count, duration, estimated size, and native macOS folder picker via @tauri-apps/plugin-dialog
- Wired toolbar Export button as toggle, added File > Export... menu item with Cmd+Shift+E native accelerator, added menu:export event listener

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend EditorMode, create ExportView + sub-components, wire EditorShell** - `6d390dc` (feat)
2. **Task 2: Wire toolbar Export button, File menu item, and Cmd+Shift+E shortcut** - `db818ff` (feat)

## Files Created/Modified
- `Application/src/components/views/ExportView.tsx` - Full-window export dialog view (header + body + bottom bar)
- `Application/src/components/export/FormatSelector.tsx` - Left panel: format radio group + resolution multiplier + quality display + naming pattern
- `Application/src/components/export/ExportPreview.tsx` - Right panel: preview thumbnail placeholder + output summary + folder picker
- `Application/src/types/export.ts` - ExportFormat, ExportResolution, ExportSettings, ExportProgress types
- `Application/src/stores/exportStore.ts` - Reactive export state (format, resolution, outputFolder, progress, cancel)
- `Application/src/stores/uiStore.ts` - Extended EditorMode with 'export'
- `Application/src/components/layout/EditorShell.tsx` - Added ExportView conditional render for 'export' mode
- `Application/src/components/layout/Toolbar.tsx` - Wired Export button onClick + tooltip with shortcut hint
- `Application/src-tauri/src/lib.rs` - Added Export... menu item with CmdOrCtrl+Shift+E and event handler
- `Application/src/main.tsx` - Added menu:export listener to set editorMode

## Decisions Made
- **menu:export listener in main.tsx**: Plan specified shortcuts.ts, but all other menu:* listeners live in main.tsx. Followed existing codebase pattern for consistency.
- **Export types/store created as Rule 3 dependency**: Plan 01 (which creates these) runs in parallel. Created them inline to unblock Plan 02 compilation.
- **Preview thumbnail as placeholder**: Plan explicitly defers actual canvas rendering to Plan 03. Shows resolution text in a styled box with correct aspect ratio.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created export types and exportStore (Plan 01 dependency)**
- **Found during:** Task 1 (component creation)
- **Issue:** FormatSelector and ExportPreview import from exportStore and types/export which Plan 01 creates, but Plan 01 runs in parallel and hadn't completed yet
- **Fix:** Created Application/src/types/export.ts and Application/src/stores/exportStore.ts with the exact definitions specified in Plan 01
- **Files modified:** Application/src/types/export.ts, Application/src/stores/exportStore.ts
- **Verification:** TypeScript compiles cleanly with all imports resolved
- **Committed in:** 6d390dc (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed Preview.tsx canvas null type narrowing**
- **Found during:** Task 2 (TypeScript verification)
- **Issue:** Plan 01's exportRenderer extraction changed Preview.tsx to pass canvas to renderGlobalFrame, but canvas type is HTMLCanvasElement | null in the closure
- **Fix:** Added non-null assertion (canvas!) since the early return guard ensures canvas is not null
- **Files modified:** Application/src/components/Preview.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** Already handled by Plan 01 agent (concurrent)

**3. [Rule 1 - Bug] Fixed unused variable TS6133 in FormatSelector**
- **Found during:** Task 1 (TypeScript verification)
- **Issue:** w and h variables declared inside RESOLUTIONS.map callback but unused (pixel dimensions displayed below the buttons instead)
- **Fix:** Simplified map callback to arrow expression without intermediate variables
- **Files modified:** Application/src/components/export/FormatSelector.tsx
- **Verification:** TypeScript compiles cleanly
- **Committed in:** 6d390dc (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking)
**Impact on plan:** All auto-fixes necessary for compilation. No scope creep.

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| ExportView.tsx | 32 | Export button onClick is no-op | Wired in Plan 03 (export engine) |
| ExportPreview.tsx | 35 | Preview thumbnail is placeholder div | Actual canvas rendering wired in Plan 03 |

Both stubs are intentional per the plan and will be resolved in Plan 03.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Export dialog UI complete and accessible via three paths (toolbar, menu, shortcut)
- Ready for Plan 03 to wire export engine to the Export button and add real preview rendering
- exportStore signals in place for Plan 03 to bind progress tracking

## Self-Check: PASSED

All created files verified on disk. Both task commits (6d390dc, db818ff) verified in git log.

---
*Phase: 14-png-export*
*Completed: 2026-03-21*
