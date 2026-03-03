---
phase: 02-ui-shell-image-pipeline
plan: 03
subsystem: ui
tags: [preact, signals, drag-drop, tauri-webview, lru-pool, thumbnails, file-dialog]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Tauri scaffolding, Preact app, signal store architecture, asset protocol"
  - phase: 02-ui-shell-image-pipeline (plan 01)
    provides: "EditorShell layout, LeftPanel, Toolbar, all panel components"
  - phase: 02-ui-shell-image-pipeline (plan 02)
    provides: "Rust import pipeline, importImages IPC wrapper, ImportedImage types, thumbnail generation"
provides:
  - "imageStore with LRU pool tracking (max 50 full-res), importFiles(), getDisplayUrl(), loadFullRes()"
  - "useFileDrop hook using Tauri onDragDropEvent for native drag-and-drop"
  - "DropZone full-window overlay component for drag visual feedback"
  - "ImportGrid thumbnail grid component reading from imageStore"
  - "LeftPanel import section with + Import button, file dialog, error display, thumbnail grid"
  - "EditorShell wired with DropZone overlay and drag-drop event handling"
  - "Temporary project directory using Tauri appDataDir (replaced in Phase 3)"
affects: [03-project-management, timeline-thumbnails, layer-system]

# Tech tracking
tech-stack:
  added: ["@tauri-apps/api (webview drag-drop events)", "@tauri-apps/plugin-dialog (file picker)"]
  patterns: [Tauri onDragDropEvent for drag-drop (not browser ondrop), LRU eviction via Map with timestamp tracking, appDataDir for temp project paths]

key-files:
  created:
    - Application/src/stores/imageStore.ts
    - Application/src/lib/dragDrop.ts
    - Application/src/lib/projectDir.ts
    - Application/src/components/import/DropZone.tsx
    - Application/src/components/import/ImportGrid.tsx
  modified:
    - Application/src/components/layout/EditorShell.tsx
    - Application/src/components/layout/LeftPanel.tsx
    - Application/src/main.tsx
    - Application/src-tauri/tauri.conf.json
    - Application/src-tauri/src/services/image_pool.rs

key-decisions:
  - "Tauri onDragDropEvent used instead of browser ondrop -- browser drag events don't provide file paths in Tauri"
  - "LRU pool uses Map<id, timestamp> with manual eviction loop -- simple and effective for max 50 entries"
  - "HEIC/HEIF accepted in drag filter and file dialog but backend returns graceful error per file"
  - "Temp project dir uses Tauri appDataDir instead of /tmp to avoid macOS /tmp symlink and permission issues"
  - "Asset protocol scope set to $APPDATA/** and $RESOURCE/** for proper user data directory coverage"
  - "Canonical paths used for thumbnails to resolve macOS symlinks before Tauri scope matching"

patterns-established:
  - "Drag-drop pattern: useFileDrop hook -> imageStore.importFiles() -> IPC -> thumbnail display"
  - "Asset URL pattern: Rust returns canonical absolute path -> assetUrl() converts to https://asset.localhost/ URL"
  - "Import error pattern: per-file errors collected in importErrors signal, displayed below import header"
  - "Project dir pattern: appDataDir + /temp-project for Phase 2 testing (replaced by real project dir in Phase 3)"

requirements-completed: [IMPT-01, IMPT-02, IMPT-04]

# Metrics
duration: 45min
completed: 2026-03-03
---

# Phase 02 Plan 03: Frontend Import UI Summary

**Drag-and-drop and file dialog image import with imageStore LRU pool, thumbnail grid display, and full-window drop overlay wired into EditorShell and LeftPanel**

## Performance

- **Duration:** ~45 min (including 4 bug fix iterations for macOS asset protocol issues)
- **Started:** 2026-03-03T08:30:00Z
- **Completed:** 2026-03-03T10:00:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 10

## Accomplishments
- Built complete frontend image import pipeline: drag images from Finder or use native file dialog, see thumbnails appear in LeftPanel
- Created imageStore with Preact Signals and LRU pool tracking (max 50 full-res images with timestamp-based eviction)
- Implemented useFileDrop hook using Tauri's native onDragDropEvent (not browser ondrop which doesn't work in Tauri)
- Added full-window DropZone overlay with visual feedback during drag operations
- Built ImportGrid thumbnail component displaying imported images via asset protocol URLs
- Wired import section into LeftPanel with "+ Import" button, progress spinner, error messages, and thumbnail grid
- Fixed 4 macOS-specific issues: thumbnail 403, symlink resolution, /tmp permissions, and asset scope configuration
- Human verified complete end-to-end pipeline on macOS (drag-drop, file dialog, thumbnails, error handling)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create imageStore with LRU pool, drag-drop hook, and import UI components** - `27eaf95` (feat)
2. **Task 2: Wire import UI into EditorShell and LeftPanel** - `fe65c8e` (feat)
3. **Fix: thumbnail 403 and non-image drop warning** - `12dfba6` (fix)
4. **Fix: canonicalize thumbnail paths for macOS symlink resolution** - `664d38b` (fix)
5. **Fix: use Tauri appDataDir for temp project instead of /tmp** - `06cde11` (fix)
6. **Fix: missing path separator and explicit asset scope** - `15819b9` (fix)
7. **Task 3: Human verification checkpoint** - approved (no commit needed)

## Files Created/Modified
- `Application/src/stores/imageStore.ts` - Image state management with LRU pool (max 50), importFiles, getDisplayUrl, loadFullRes, touchFullRes
- `Application/src/lib/dragDrop.ts` - useFileDrop hook using Tauri onDragDropEvent, isDraggingOver signal, image extension filtering
- `Application/src/lib/projectDir.ts` - getProjectDir() helper using Tauri appDataDir for temp project path
- `Application/src/components/import/DropZone.tsx` - Full-window drag overlay with visual feedback
- `Application/src/components/import/ImportGrid.tsx` - Thumbnail grid reading from imageStore, lazy loading, hover filename display
- `Application/src/components/layout/EditorShell.tsx` - Added DropZone overlay and useFileDrop wiring to imageStore.importFiles
- `Application/src/components/layout/LeftPanel.tsx` - Added import section: header, + Import button, file dialog, progress, errors, ImportGrid
- `Application/src/main.tsx` - Added CSS for drag-drop spin animation
- `Application/src-tauri/tauri.conf.json` - Updated asset protocol scope to $APPDATA/** and $RESOURCE/**
- `Application/src-tauri/src/services/image_pool.rs` - Added path canonicalization for macOS symlink resolution

## Decisions Made
- Used Tauri's native `onDragDropEvent` from `@tauri-apps/api/webview` instead of browser drag events -- browser ondrop doesn't provide file system paths in Tauri
- LRU pool implemented with `Map<id, timestamp>` and manual eviction loop -- simple approach sufficient for max 50 entries
- HEIC/HEIF files accepted in both drag filter and file dialog, but backend returns a clear "not yet supported" error per file -- graceful deferral
- Switched from `/tmp` to Tauri `appDataDir()` for temporary project directory -- avoids macOS `/tmp` -> `/private/tmp` symlink issues and sandboxing restrictions
- Canonical path resolution added in Rust before returning paths to frontend -- Tauri asset protocol resolves symlinks before scope checking, causing 403 without canonicalization
- Asset protocol scope changed from `["**"]` to `["$APPDATA/**", "$RESOURCE/**"]` -- wildcard alone doesn't cover user data directories

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Thumbnail 403 Forbidden due to non-image drop and asset URL mismatch**
- **Found during:** Task 2 (end-to-end testing)
- **Issue:** Thumbnails returned 403 from asset protocol; also non-image files caused silent failures
- **Fix:** Added warning toast for non-image drops; fixed asset URL path construction
- **Files modified:** Application/src/lib/dragDrop.ts, Application/src/components/import/ImportGrid.tsx
- **Verification:** Thumbnails display correctly after import
- **Committed in:** 12dfba6

**2. [Rule 1 - Bug] macOS /tmp symlink causing path mismatch in asset protocol scope**
- **Found during:** Task 2 (continued debugging)
- **Issue:** On macOS, /tmp is a symlink to /private/tmp. Rust returned /tmp/... paths but Tauri asset protocol resolved symlinks before scope checking, causing 403
- **Fix:** Added fs::canonicalize() calls on project_path and thumbnail_path before returning from Rust
- **Files modified:** Application/src-tauri/src/services/image_pool.rs
- **Verification:** Asset URLs resolve correctly with canonical /private/tmp paths
- **Committed in:** 664d38b

**3. [Rule 1 - Bug] /tmp directory permissions and Tauri sandboxing restrictions**
- **Found during:** Task 2 (continued debugging)
- **Issue:** Using /tmp for project directory caused permission issues within Tauri's sandbox model
- **Fix:** Switched to Tauri's appDataDir() API for the temp project directory; created projectDir.ts helper
- **Files modified:** Application/src/lib/projectDir.ts (new), Application/src/components/layout/EditorShell.tsx, Application/src/components/layout/LeftPanel.tsx
- **Verification:** Import works with appDataDir-based paths
- **Committed in:** 06cde11

**4. [Rule 1 - Bug] Missing path separator and overly broad asset scope**
- **Found during:** Task 2 (final fix iteration)
- **Issue:** Path concatenation missing separator between appDataDir and "temp-project"; asset scope ["**"] didn't cover user data directories
- **Fix:** Added explicit separator in projectDir.ts; changed scope to ["$APPDATA/**", "$RESOURCE/**"]
- **Files modified:** Application/src/lib/projectDir.ts, Application/src-tauri/tauri.conf.json
- **Verification:** Full end-to-end import pipeline works on macOS
- **Committed in:** 15819b9

---

**Total deviations:** 4 auto-fixed (4 bugs -- all related to macOS asset protocol path handling)
**Impact on plan:** All fixes were necessary for the import pipeline to work on macOS. The core issue was the macOS /tmp symlink + Tauri asset protocol scope interaction, which required iterative debugging. No scope creep.

## Issues Encountered
- macOS /tmp -> /private/tmp symlink caused 4 rounds of debugging to fully resolve. The root cause chain: /tmp symlink -> canonical path mismatch -> asset protocol 403 -> scope misconfiguration. Each fix uncovered the next layer of the issue. This is a known Tauri pain point on macOS.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete image import pipeline working end-to-end on macOS (drag-drop + file dialog + thumbnails)
- imageStore ready for consumption by future phases (sequence management, timeline, layer system)
- Phase 2 fully complete -- all 3 plans (editor shell, Rust import, frontend import UI) delivered
- Temporary project directory pattern established (appDataDir/temp-project) -- Phase 3 will replace with actual project paths
- LRU pool ready to be exercised by timeline thumbnail loading and layer preview

## Self-Check: PASSED

All 10 created/modified files verified present. All 6 commit hashes verified in git log.

---
*Phase: 02-ui-shell-image-pipeline*
*Completed: 2026-03-03*
