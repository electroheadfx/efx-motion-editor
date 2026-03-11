---
phase: 03-project-sequence-management
plan: 02
subsystem: frontend, stores, ui
tags: [preact, signals, auto-save, welcome-screen, project-dialog, toolbar, routing, temp-migration, asset-scope]

# Dependency graph
requires:
  - phase: 03-project-sequence-management
    provides: "Rust project CRUD commands, TypeScript types, IPC wrappers, AppConfig module"
provides:
  - "Enhanced projectStore with filePath, dirPath, isDirty, isSaving, and full project lifecycle methods"
  - "imageStore serialization: loadFromMceImages, toMceImages, updateProjectPaths"
  - "Auto-save module with 2s debounce + 60s periodic interval"
  - "WelcomeScreen with recent projects, New/Open buttons"
  - "NewProjectDialog for creating new projects with name, fps, folder picker"
  - "Toolbar wired: New/Open/Save with file dialogs and dirty indicator"
  - "Signal-based app routing between WelcomeScreen and EditorShell"
  - "Rust project_migrate_temp_images command for temp-to-real dir migration"
  - "Rust-side asset protocol scope registration on project_create and project_open"
affects: [03-03-PLAN, 04-timeline, 05-fx-layers, 08-export]

# Tech tracking
tech-stack:
  added: []
  patterns: [signal-routing, auto-save-debounce, temp-image-migration, asset-scope-registration, markDirty-callback]

key-files:
  created:
    - Application/src/lib/autoSave.ts
    - Application/src/components/project/WelcomeScreen.tsx
    - Application/src/components/project/NewProjectDialog.tsx
  modified:
    - Application/src/stores/projectStore.ts
    - Application/src/stores/imageStore.ts
    - Application/src/lib/ipc.ts
    - Application/src/app.tsx
    - Application/src/main.tsx
    - Application/src/components/layout/Toolbar.tsx
    - Application/src/components/layout/EditorShell.tsx
    - Application/src/components/layout/LeftPanel.tsx
    - Application/src-tauri/src/commands/project.rs
    - Application/src-tauri/src/services/project_io.rs
    - Application/src-tauri/src/lib.rs

key-decisions:
  - "Auto-save only fires when filePath is set (saved projects only); unsaved projects use temp dir as recovery"
  - "App routing uses computed signal on projectStore.dirPath (not filePath) to determine project-open state"
  - "Temp image migration handled Rust-side with rename-first, copy+delete fallback for cross-volume"
  - "Asset protocol scope expanded Rust-side on project_create and project_open for user-selected directories"

patterns-established:
  - "Signal-based routing: computed isProjectOpen drives WelcomeScreen vs EditorShell rendering"
  - "Auto-save debounce: effect() subscribes to store signals, 2s debounce, 60s periodic safety net"
  - "markDirty callback: sequenceStore._setMarkDirtyCallback wired by projectStore to avoid circular imports"
  - "Project dir resolution: projectStore.dirPath ?? tempProjectDir for all image import operations"

requirements-completed: [PROJ-04, PROJ-05]

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 03 Plan 02: Project Management UI Summary

**WelcomeScreen with recent projects, NewProjectDialog, wired Toolbar, auto-save with 2s debounce, signal-based app routing, and temp image migration**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-03T10:35:57Z
- **Completed:** 2026-03-03T10:44:27Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Enhanced projectStore with full project lifecycle: createProject, saveProject, openProject, saveProjectAs, closeProject, buildMceProject, hydrateFromMce
- imageStore serialization: loadFromMceImages (for hydration on open), toMceImages (for save), updateProjectPaths (for temp migration)
- Auto-save module with effect-based 2s debounce watching store signals and 60s periodic interval as safety net
- WelcomeScreen with real recent projects from AppConfig, file existence validation, and New/Open project buttons
- NewProjectDialog with name input, fps toggle (15/24), folder picker, and full create-and-save flow
- Toolbar buttons wired: New (opens dialog), Open (file picker), Save (serializes to .mce or Save As if never saved), dirty indicator dot
- Signal-based app routing: WelcomeScreen when no project open, EditorShell when dirPath is set
- Rust project_migrate_temp_images command moves images from temp dir to real project dir (rename with copy+delete fallback)
- Rust-side asset protocol scope registration on project_create and project_open for user-selected directories

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance projectStore, imageStore, auto-save, temp image migration** - `7464b21` (feat)
2. **Task 2: Build WelcomeScreen, NewProjectDialog, wire Toolbar, update App routing** - `0932724` (feat)

## Files Created/Modified
- `Application/src/stores/projectStore.ts` - Enhanced with filePath, dirPath, isDirty, isSaving, and full project lifecycle methods
- `Application/src/stores/imageStore.ts` - Added loadFromMceImages, toMceImages, updateProjectPaths
- `Application/src/lib/autoSave.ts` - Auto-save module with debounced effect + periodic interval
- `Application/src/lib/ipc.ts` - Added projectMigrateTempImages IPC wrapper
- `Application/src/components/project/WelcomeScreen.tsx` - Welcome screen with recent projects, New/Open buttons
- `Application/src/components/project/NewProjectDialog.tsx` - New project dialog with name, fps, folder picker
- `Application/src/components/layout/Toolbar.tsx` - Wired New/Open/Save buttons, dirty indicator, removed Set Folder
- `Application/src/components/layout/EditorShell.tsx` - Uses projectStore.dirPath for image imports
- `Application/src/components/layout/LeftPanel.tsx` - Uses projectStore.dirPath for image imports
- `Application/src/app.tsx` - Signal-based routing between WelcomeScreen and EditorShell
- `Application/src/main.tsx` - Starts auto-save after initialization
- `Application/src-tauri/src/commands/project.rs` - Asset scope registration, project_migrate_temp_images command
- `Application/src-tauri/src/services/project_io.rs` - migrate_temp_images and move_file functions
- `Application/src-tauri/src/lib.rs` - Registered project_migrate_temp_images command

## Decisions Made
- Auto-save only fires when filePath is set (saved projects only); unsaved projects use temp dir as recovery mechanism
- App routing uses computed signal on projectStore.dirPath (not filePath) to determine project-open state -- this means creating a project (which sets dirPath) immediately transitions to editor, even before first save
- Temp image migration handled Rust-side with rename-first, copy+delete fallback for cross-volume moves
- Asset protocol scope expanded Rust-side on project_create and project_open for user-selected directories outside $APPDATA

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated LeftPanel to use projectStore.dirPath for imports**
- **Found during:** Task 2 (UI wiring)
- **Issue:** LeftPanel import button still used tempProjectDir exclusively, but should prefer real project dir when open
- **Fix:** Added projectStore import and used `projectStore.dirPath.value ?? tempProjectDir.value` for the import directory
- **Files modified:** Application/src/components/layout/LeftPanel.tsx
- **Verification:** tsc --noEmit passes cleanly
- **Committed in:** 0932724 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary consistency fix -- LeftPanel needed same import directory logic as EditorShell. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Project management UI fully functional: create, open, save, recent projects, auto-save
- All stores enhanced with serialization/deserialization for .mce round-trips
- Ready for Phase 4 (Timeline) which will use the project and sequence data from stores
- Plan 03-03 (Sequence Management UI) can integrate with the project lifecycle

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 03-project-sequence-management*
*Completed: 2026-03-03*
