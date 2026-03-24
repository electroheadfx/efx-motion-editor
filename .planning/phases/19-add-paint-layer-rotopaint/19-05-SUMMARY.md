---
phase: 19-add-paint-layer-rotopaint
plan: 05
subsystem: persistence
tags: [tauri-fs, sidecar-json, project-format, rust, paint-layer]

# Dependency graph
requires:
  - phase: 19-01
    provides: "PaintFrame types, paintStore with getDirtyFrames/getFrame/loadFrame"
provides:
  - "paintPersistence.ts with savePaintData, loadPaintData, cleanupOrphanedPaintFiles, getPaintLayerIds"
  - "Project format v14 with paint layer persistence wired into save/load cycle"
  - "Rust paint/ directory creation in new projects"
affects: [19-06]

# Tech tracking
tech-stack:
  added: []
  patterns: [sidecar-json-persistence, non-fatal-error-handling, pre-save-data-write]

key-files:
  created:
    - Application/src/lib/paintPersistence.ts
  modified:
    - Application/src/stores/projectStore.ts
    - Application/src-tauri/src/services/project_io.rs

key-decisions:
  - "Paint sidecar files written BEFORE .mce file during save to prevent sync issues (per Pitfall 5)"
  - "Non-fatal error handling for all paint persistence operations matches Phase 16 audio pattern"
  - "Orphaned paint directories cleaned up on every save when paint layers are deleted"

patterns-established:
  - "Sidecar file persistence: paint/{layer-uuid}/frame-NNN.json alongside .mce project"
  - "Pre-save data write: ancillary data saved before main project file for consistency"

requirements-completed: [PAINT-10, PAINT-11]

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 19 Plan 05: Paint Persistence Summary

**Sidecar JSON persistence for paint frames with project format v14, Tauri FS read/write, and Rust paint/ directory creation**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T20:26:55Z
- **Completed:** 2026-03-24T20:34:00Z
- **Tasks:** 2
- **Files modified:** 3 (+ 3 dependency files created for parallel execution)

## Accomplishments
- Created paintPersistence.ts with full sidecar file I/O (save, load, cleanup, list)
- Wired paint persistence into projectStore save/load cycle with v14 format bump
- Added Rust paint/ directory creation for new projects
- Paint sidecar files written BEFORE .mce file during save (per Research Pitfall 5)
- All file operations use non-fatal error handling (try/catch with console.error)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create paintPersistence module for sidecar file I/O** - `0a112b8` (feat)
2. **Task 2: Wire paint persistence into projectStore and bump to v14** - `0cf2567` (feat)

## Files Created/Modified
- `Application/src/lib/paintPersistence.ts` - Sidecar file read/write for paint frames via Tauri FS API
- `Application/src/stores/projectStore.ts` - Paint save/load wired into saveProject/hydrateFromMce, version bumped to 14, paintStore.reset() in closeProject
- `Application/src-tauri/src/services/project_io.rs` - paint/ directory creation in create_project_dir(), test updated
- `Application/src/types/paint.ts` - Paint type definitions (dependency for parallel execution)
- `Application/src/stores/paintStore.ts` - Paint store with per-frame stroke management (dependency for parallel execution)
- `Application/src/types/layer.ts` - Added 'paint' to LayerType and LayerSourceData unions (dependency for parallel execution)

## Decisions Made
- Paint sidecar files written BEFORE .mce file during save to prevent sync issues (per Research Pitfall 5)
- Non-fatal error handling for all paint persistence operations -- paint failure should never block project save/load
- Frame filenames zero-padded to 3 digits (frame-000.json through frame-999.json) for filesystem sort order
- Orphaned paint directories cleaned up on every save to handle deleted paint layers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created dependency files for parallel execution**
- **Found during:** Task 1 (paintPersistence needs types/paint.ts and stores/paintStore.ts)
- **Issue:** Plan 01 dependency files (types/paint.ts, stores/paintStore.ts, layer.ts paint variant) don't exist in this worktree since Plan 01 runs in parallel
- **Fix:** Created minimal dependency files matching Plan 01 spec: types/paint.ts with all types, stores/paintStore.ts with full store, added 'paint' to layer.ts unions
- **Files modified:** Application/src/types/paint.ts, Application/src/stores/paintStore.ts, Application/src/types/layer.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 0a112b8 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed HistoryEntry interface compliance in paintStore**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** paintStore pushAction calls missing required id, description, timestamp fields on HistoryEntry
- **Fix:** Added crypto.randomUUID() for id, descriptive strings, Date.now() for timestamp
- **Files modified:** Application/src/stores/paintStore.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** 0a112b8 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for compilation in parallel execution environment. No scope creep.

## Issues Encountered
- Pre-existing Rust test compilation errors in project_io.rs test helpers (missing fields from newer model versions) -- not caused by this plan's changes, cargo check passes cleanly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Paint persistence fully wired -- paint data will survive project save/load cycles
- Ready for Plan 06 (UI integration) to use paint persistence through projectStore

## Self-Check: PASSED

All created files verified to exist. All commit hashes verified in git log.

---
*Phase: 19-add-paint-layer-rotopaint*
*Completed: 2026-03-24*
