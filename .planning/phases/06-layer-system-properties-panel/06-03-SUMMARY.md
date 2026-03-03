---
phase: 06-layer-system-properties-panel
plan: 03
subsystem: ui
tags: [layers, sortablejs, drag-drop, layer-import, video, image-sequence, csp, preact]

# Dependency graph
requires:
  - phase: 06-layer-system-properties-panel
    provides: "Layer data model, layerStore with computed layers, sequenceStore layer mutations"
provides:
  - "LayerList component with SortableJS drag-and-drop and base layer protection"
  - "AddLayerMenu component with static image, image sequence, and video layer import"
  - "LeftPanel wired with real LayerList and AddLayerMenu (mock data removed)"
  - "CSP media-src directive for video asset protocol"
  - "Expanded Tauri FS capabilities for file operations"
  - "Rust create_project_dir creates videos/ subdirectory"
affects: [06-02, 06-04, preview-renderer, export-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["SortableJS reversed-index mapping for layer reorder", "Tauri FS plugin for video file copy and directory read", "Natural sort for image sequence filenames"]

key-files:
  created:
    - Application/src/components/layer/LayerList.tsx
    - Application/src/components/layer/AddLayerMenu.tsx
  modified:
    - Application/src/components/layout/LeftPanel.tsx
    - Application/src-tauri/tauri.conf.json
    - Application/src-tauri/src/services/project_io.rs
    - Application/src-tauri/capabilities/default.json

key-decisions:
  - "Used Tauri FS plugin (copyFile/mkdir/readDir) for video import instead of new Rust IPC command"
  - "Natural sort (localeCompare with numeric option) for image sequence frame ordering"
  - "Video layers default to 'screen' blend mode per plan specification"
  - "Reversed display order with index mapping (arrayIndex = totalLayers - 1 - visualIndex) for SortableJS"

patterns-established:
  - "Layer component directory: src/components/layer/ for all layer UI components"
  - "Reversed-index SortableJS pattern: display top-to-bottom, map visual indices back to array indices on reorder"
  - "AddLayerMenu popup pattern: state boolean + absolute positioned div + click-outside close"

requirements-completed: [LAYER-01, LAYER-02, LAYER-03, LAYER-06, LAYER-07, LAYER-08]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 6 Plan 3: Layer Management UI Summary

**SortableJS layer list with drag-and-drop reorder, visibility toggle, delete, and AddLayerMenu for importing static images, image sequences, and video layers**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T18:14:16Z
- **Completed:** 2026-03-03T18:19:39Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created LayerList component with SortableJS drag-and-drop, base layer protection (filter + onMove), visibility toggle, delete, and selection highlighting
- Created AddLayerMenu with three import flows: static image (file dialog), image sequence (directory picker with natural sort), and video (file dialog + copy to project)
- Updated LeftPanel to use real LayerList and AddLayerMenu components, completely removing inline mock layer rendering
- Added CSP media-src directive and expanded Tauri FS capabilities for video/file operations

## Task Commits

Each task was committed atomically:

1. **Task 1: Create LayerList component with SortableJS drag-and-drop, visibility toggle, and delete** - `80c2c50` (feat)
2. **Task 2: Create AddLayerMenu and wire into LeftPanel, add CSP media-src for video** - `e666698` (feat)

## Files Created/Modified

- `Application/src/components/layer/LayerList.tsx` - SortableJS-powered layer list with reversed display order, drag handle, visibility toggle, type indicators, delete, and selection
- `Application/src/components/layer/AddLayerMenu.tsx` - Popover menu for adding static image, image sequence, and video layers with file/directory dialogs
- `Application/src/components/layout/LeftPanel.tsx` - Replaced inline mock layer list with LayerList and AddLayerMenu components; removed unused imports
- `Application/src-tauri/tauri.conf.json` - Added media-src CSP directive for video asset protocol
- `Application/src-tauri/src/services/project_io.rs` - create_project_dir now creates videos/ subdirectory
- `Application/src-tauri/capabilities/default.json` - Added fs:allow-copy-file, fs:allow-mkdir, fs:allow-read-dir, fs:scope-appdata-recursive

## Decisions Made

- **Tauri FS plugin for video operations:** Used `@tauri-apps/plugin-fs` copyFile/mkdir/readDir instead of adding a new Rust IPC command. This keeps the Rust backend simple and leverages the existing FS plugin already in the project.
- **Natural sort for image sequences:** Used `localeCompare` with `{numeric: true}` for deterministic frame ordering (frame001.png before frame010.png), which is the VFX industry convention.
- **Reversed-index mapping:** The layer array is stored bottom-to-top (base at index 0) but displayed top-to-bottom. SortableJS visual indices are mapped back using `arrayIndex = totalLayers - 1 - visualIndex`.
- **Video default blend mode 'screen':** Video layers default to screen blend mode per plan specification, while image layers default to normal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Tauri FS capabilities for file operations**
- **Found during:** Task 2
- **Issue:** The `@tauri-apps/plugin-fs` copyFile/mkdir/readDir operations require explicit capabilities in Tauri 2, not just `fs:default`
- **Fix:** Added `fs:allow-copy-file`, `fs:allow-mkdir`, `fs:allow-read-dir`, `fs:allow-exists`, and `fs:scope-appdata-recursive` to capabilities/default.json
- **Files modified:** Application/src-tauri/capabilities/default.json
- **Committed in:** e666698 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Capability expansion was necessary for FS plugin operations to work at runtime. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Layer list UI complete with full CRUD operations (add/remove/reorder/toggle visibility)
- All three layer types can be imported via AddLayerMenu
- Ready for Plan 02 (PreviewRenderer canvas compositing) to render the layer stack
- Ready for Plan 04 (Properties Panel) to display/edit selected layer properties
- CSP and asset protocol configured for video layer support

## Self-Check: PASSED

- All 7 files verified present (2 created, 4 modified, 1 summary)
- Both task commits (80c2c50, e666698) verified in git log
- All content checks passed: Sortable in LayerList, Add in AddLayerMenu, LayerList in LeftPanel
- Mock data completely removed (allLayers=0, useSeedLayerMockData=0)
- CSP has media-src directive
- project_io.rs creates videos/ directory
- TypeScript compiles with zero errors
- Rust compiles with zero errors, 8 tests pass

---
*Phase: 06-layer-system-properties-panel*
*Completed: 2026-03-03*
