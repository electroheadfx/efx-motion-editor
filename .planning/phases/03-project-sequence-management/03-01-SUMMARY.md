---
phase: 03-project-sequence-management
plan: 01
subsystem: backend, persistence
tags: [tauri, rust, serde, atomic-write, mce-format, tauri-plugin-store, tauri-plugin-fs, chrono, sortablejs]

# Dependency graph
requires:
  - phase: 02-ui-shell-image-pipeline
    provides: "Image import pipeline, project directory structure, IPC patterns"
provides:
  - "MceProject, MceSequence, MceKeyPhoto, MceImageRef Rust models"
  - "project_create, project_save, project_open Tauri commands"
  - "Atomic .mce file write (temp+rename) via project_io service"
  - "TypeScript types mirroring Rust models (snake_case for IPC)"
  - "IPC wrappers: projectCreate, projectSave, projectOpen"
  - "AppConfig module with LazyStore for recent projects and window preferences"
  - "tauri-plugin-store and tauri-plugin-fs registered and configured"
affects: [03-02-PLAN, 03-03-PLAN, 04-timeline, 08-export]

# Tech tracking
tech-stack:
  added: [tauri-plugin-store, tauri-plugin-fs, chrono, sortablejs, "@types/sortablejs", "@tauri-apps/plugin-store", "@tauri-apps/plugin-fs"]
  patterns: [atomic-write-temp-rename, relative-path-storage, snake-case-ipc-types, lazy-store-singleton]

key-files:
  created:
    - Application/src-tauri/src/models/sequence.rs
    - Application/src-tauri/src/services/project_io.rs
    - Application/src/lib/appConfig.ts
  modified:
    - Application/src-tauri/Cargo.toml
    - Application/src-tauri/src/models/project.rs
    - Application/src-tauri/src/models/mod.rs
    - Application/src-tauri/src/services/mod.rs
    - Application/src-tauri/src/commands/project.rs
    - Application/src-tauri/src/lib.rs
    - Application/src-tauri/capabilities/default.json
    - Application/package.json
    - Application/src/types/project.ts
    - Application/src/types/sequence.ts
    - Application/src/lib/ipc.ts
    - Application/src/components/layout/LeftPanel.tsx

key-decisions:
  - "Relative paths stored in .mce files for project portability; frontend resolves to absolute"
  - "TypeScript types use snake_case to match Rust serde default serialization across IPC"
  - "KeyPhoto.imagePath renamed to imageId to align with .mce reference-by-ID pattern"
  - "AppConfig uses LazyStore singleton pattern for persistent recent projects and window prefs"

patterns-established:
  - "Atomic write: temp file + rename for .mce saves (prevents corruption on crash)"
  - "Relative path storage: .mce files store relative paths, commands pass project_root for resolution"
  - "Type mirroring: Rust structs <-> TypeScript interfaces with snake_case field names"
  - "LazyStore singleton: single store instance for all persistent app config"

requirements-completed: [PROJ-01, PROJ-02, PROJ-03, PROJ-06]

# Metrics
duration: 8min
completed: 2026-03-03
---

# Phase 03 Plan 01: Project Backend & Persistence Summary

**Rust project CRUD commands with atomic .mce file I/O, TypeScript type mirrors, IPC wrappers, and AppConfig persistence via tauri-plugin-store**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-03T10:23:46Z
- **Completed:** 2026-03-03T10:32:33Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Full MceProject model hierarchy in Rust (MceProject, MceSequence, MceKeyPhoto, MceImageRef) with serde derives
- Project I/O service with atomic write (temp+rename), directory creation, and relative path handling
- project_create, project_save, project_open Tauri commands registered and functional
- tauri-plugin-store and tauri-plugin-fs installed, registered, and configured with capabilities
- TypeScript type mirrors with snake_case fields for seamless IPC deserialization
- AppConfig module with LazyStore for recent projects (max 10, dedup by path) and window preferences
- 8 Rust tests pass (4 project_io + 4 image_pool), TypeScript compiles cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Install plugins, create Rust models and project I/O service** - `7cad549` (feat)
2. **Task 2: Create TypeScript types, IPC wrappers, and AppConfig module** - `594663d` (feat)

## Files Created/Modified
- `Application/src-tauri/Cargo.toml` - Added tauri-plugin-store, tauri-plugin-fs, chrono dependencies
- `Application/src-tauri/src/models/project.rs` - Full MceProject model hierarchy with serde derives
- `Application/src-tauri/src/models/sequence.rs` - Re-export convenience for MceSequence, MceKeyPhoto
- `Application/src-tauri/src/models/mod.rs` - Added sequence module declaration
- `Application/src-tauri/src/services/project_io.rs` - Project I/O: create dir, atomic save, open, path conversion
- `Application/src-tauri/src/services/mod.rs` - Added project_io module declaration
- `Application/src-tauri/src/commands/project.rs` - project_create, project_save, project_open commands
- `Application/src-tauri/src/lib.rs` - Registered store/fs plugins and new project commands
- `Application/src-tauri/capabilities/default.json` - Added store:default and fs:default permissions
- `Application/package.json` - Added @tauri-apps/plugin-store, @tauri-apps/plugin-fs, sortablejs
- `Application/src/types/project.ts` - MceProject, MceSequence, MceKeyPhoto, MceImageRef interfaces
- `Application/src/types/sequence.ts` - Updated KeyPhoto: imagePath -> imageId
- `Application/src/lib/ipc.ts` - Added projectCreate, projectSave, projectOpen wrappers
- `Application/src/lib/appConfig.ts` - LazyStore wrapper for recent projects and window config
- `Application/src/components/layout/LeftPanel.tsx` - Updated mock data for KeyPhoto.imageId

## Decisions Made
- Relative paths stored in .mce files for project portability; frontend resolves to absolute using project root
- TypeScript types use snake_case to match Rust serde default serialization across IPC boundary
- KeyPhoto.imagePath renamed to imageId to align with .mce format's reference-by-ID pattern (Phase 2 used empty strings)
- AppConfig uses LazyStore singleton pattern for persistent recent projects and window preferences

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated mock data in LeftPanel.tsx for KeyPhoto type change**
- **Found during:** Task 2 (TypeScript types update)
- **Issue:** KeyPhoto type changed imagePath to imageId, but LeftPanel.tsx mock data still used imagePath
- **Fix:** Updated 3 mock data entries in useSeedMockData() to use imageId field
- **Files modified:** Application/src/components/layout/LeftPanel.tsx
- **Verification:** tsc --noEmit passes cleanly
- **Committed in:** 594663d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Necessary type alignment fix. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Rust project CRUD commands ready for frontend integration (Plan 02: Project Management UI)
- TypeScript types and IPC wrappers ready for state management and UI binding
- AppConfig module ready for welcome screen recent projects list
- sortablejs installed and ready for Plan 03 (sequence drag-drop reordering)

## Self-Check: PASSED

All created files verified present. All commit hashes verified in git log.

---
*Phase: 03-project-sequence-management*
*Completed: 2026-03-03*
