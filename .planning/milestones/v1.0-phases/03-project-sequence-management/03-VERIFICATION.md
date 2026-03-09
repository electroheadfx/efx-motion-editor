---
phase: 03-project-sequence-management
verified: 2026-03-09T14:00:00Z
status: passed
score: 26/26 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 22/22
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 03: Project & Sequence Management Verification Report

**Phase Goal:** Users can create, save, open, and auto-save projects in .mce format, manage sequences with key photos, reorder via drag-and-drop, and pick up recent projects on launch
**Verified:** 2026-03-09T14:00:00Z
**Status:** PASSED
**Re-verification:** Yes -- after Plan 03-04 gap closure and UAT

---

## Goal Achievement

### Observable Truths

All truths are drawn from the must_haves frontmatter of Plans 03-01, 03-02, 03-03, and 03-04.

#### Plan 03-01 Truths (Backend & Persistence)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Rust project_create command creates a project directory with images/ and images/.thumbs/ subdirectories and returns a serializable MceProject struct | VERIFIED | `commands/project.rs` lines 21-52: calls `project_io::create_project_dir`, registers asset scope, returns `MceProject`. `project_io.rs` lines 6-18: creates `images/.thumbs/` and `videos/` subdirs. Test `test_create_project_dir_creates_subdirectories` confirms. |
| 2 | Rust project_save command writes the .mce JSON file atomically (temp file + rename) with all project state | VERIFIED | `project_io.rs` lines 23-37: writes to `{path}.tmp` via `fs::write`, then `fs::rename`. Test `test_atomic_write_creates_no_temp_file` confirms temp file is cleaned up. |
| 3 | Rust project_open command reads a .mce file, validates it, and returns the full MceProject struct to the frontend | VERIFIED | `project_io.rs` lines 41-48: reads file, `serde_json::from_str` deserializes, returns `MceProject`. `commands/project.rs` lines 69-84: also registers asset scope for project directory. Roundtrip test confirms. |
| 4 | Image paths stored in .mce files are relative to the project root; absolute paths are never persisted | VERIFIED | `MceImageRef` fields are `relative_path` and `thumbnail_relative_path`. Frontend `projectStore.buildMceProject()` calls `imageStore.toMceImages(projectRoot)` which creates relative paths. `make_relative`/`make_absolute` helpers exist in `project_io.rs` (test-only). |
| 5 | tauri-plugin-store is installed and registered for persistent app config | VERIFIED | `Cargo.toml` line 23: `tauri-plugin-store = "2"`. `lib.rs` line 14: `.plugin(tauri_plugin_store::Builder::default().build())`. `default.json` line 14: `"store:default"`. |
| 6 | tauri-plugin-fs is installed and registered for frontend file existence checks | VERIFIED | `Cargo.toml` line 24: `tauri-plugin-fs = "2"`. `lib.rs` line 15: `.plugin(tauri_plugin_fs::init())`. `default.json` lines 15-20: `"fs:default"`, `"fs:allow-exists"`, etc. |
| 7 | TypeScript MceProject, MceSequence, MceKeyPhoto, MceImageRef types mirror Rust structs exactly | VERIFIED | `types/project.ts` has all four interfaces with snake_case fields matching Rust serde output: version, name, fps, width, height, created_at, modified_at, sequences, images; id, image_id, hold_frames, order; id, original_filename, relative_path, thumbnail_relative_path. |
| 8 | IPC wrappers exist for project_create, project_save, and project_open commands | VERIFIED | `ipc.ts` lines 34-48: `projectCreate`, `projectSave`, `projectOpen`, `projectMigrateTempImages`. All use `safeInvoke`. |
| 9 | AppConfig module wraps tauri-plugin-store LazyStore for recent projects and window preferences | VERIFIED | `appConfig.ts` (58 lines): `LazyStore` singleton on line 4, exports `getRecentProjects`, `addRecentProject`, `removeRecentProject`, `getAppConfig`, `setLastProjectPath`, `setWindowSize`. |

#### Plan 03-02 Truths (Project Management UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | App launches to a WelcomeScreen showing recent projects, 'New Project', and 'Open Project' buttons | VERIFIED | `app.tsx` line 6: `computed(() => projectStore.dirPath.value !== null)` shows `<WelcomeScreen />` when null. `WelcomeScreen.tsx` lines 183-225: "New Project" button. Lines 228-250: "Open Project" button. Lines 261-275: recent projects list from `getRecentProjects()`. |
| 11 | User can create a new project by entering name and selecting fps, which creates a project directory via Rust and transitions to the editor | VERIFIED | `NewProjectDialog.tsx`: name input (line 94-101), fps toggle 15/24 (lines 109-134), folder picker (lines 24-31). On Create calls `projectStore.createProject()` then `saveProjectAs()` (lines 47-57). App transitions because `dirPath` becomes non-null. |
| 12 | User can open an existing .mce file via file dialog, which loads all project data into stores and transitions to the editor | VERIFIED | `WelcomeScreen.tsx` lines 133-148: `handleOpenProject` calls `open()` with `.mce` filter, then `projectStore.openProject(selected)`. `projectStore.openProject` (lines 312-341) calls `ipcProjectOpen`, runs `hydrateFromMce` which populates all stores. |
| 13 | User can click a recent project entry on the welcome screen to open it directly | VERIFIED | `WelcomeScreen.tsx` lines 150-160: `handleRecentClick` checks `project.available`, calls `projectStore.openProject(project.path)`. |
| 14 | Recent projects list shows entries from tauri-plugin-store and marks missing files as unavailable | VERIFIED | `WelcomeScreen.tsx` lines 115-131: loads from `getRecentProjects()`, validates each with `exists(p.path)` from `@tauri-apps/plugin-fs`, sets `available` flag. Line 56: missing entries have `opacity-50`. Line 82: shows "Not found". |
| 15 | Toolbar Save button serializes current store state to the .mce file via Rust project_save command | VERIFIED | `Toolbar.tsx` lines 33-55: `handleSave` calls `projectStore.saveProject()` or `saveProjectAs()` if never saved. `projectStore.saveProject()` (lines 263-287) calls `buildMceProject()` then `ipcProjectSave`. |
| 16 | Auto-save triggers after a 2-second debounce when project/sequence stores change | VERIFIED | `autoSave.ts` lines 10-17: `scheduleSave()` uses `setTimeout(..., 2000)`. Lines 31-41: `effect()` subscribes to `projectStore.name`, `fps`, `width`, `height`, `sequenceStore.sequences`, `imageStore.images` and calls `scheduleSave()`. |
| 17 | Auto-save also runs every 60 seconds as a safety net if the project is dirty | VERIFIED | `autoSave.ts` lines 44-48: `setInterval(() => {...}, 60_000)` checks `filePath` and `isDirty`. |
| 18 | Project file path and dirty flag are tracked in projectStore | VERIFIED | `projectStore.ts` line 28: `filePath = signal<string | null>(null)`, line 34: `isDirty = signal(false)`. Both exposed on the store object (lines 195-198). |
| 19 | Images previously in temp dir are migrated to real project dir on project creation | VERIFIED | `projectStore.createProject()` lines 239-245: calls `projectMigrateTempImages(tempDir, projectDirPath)` then `imageStore.updateProjectPaths(tempDir, projectDirPath)`. Rust `migrate_temp_images` in `project_io.rs` lines 78-116 moves files with rename+copy fallback. |
| 20 | markDirty callback is registered: sequenceStore mutations set projectStore.isDirty to true | VERIFIED | `projectStore.ts` line 379: `_setMarkDirtyCallback(() => projectStore.markDirty())`. `sequenceStore.ts` lines 20-26: callback pattern. All mutation methods call `markDirty()`. |

#### Plan 03-03 Truths (Sequence Management UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 21 | User can create, duplicate, delete, and reorder sequences via drag-and-drop | VERIFIED | `sequenceStore.ts`: `createSequence` (line 52), `duplicate` (line 106), `remove` (line 87), `reorderSequences` (line 138). `SequenceList.tsx`: SortableJS with `handle: '.seq-drag-handle'`, `onEnd` -> `reorderSequences` (lines 20-31). Context menu with Rename/Duplicate/Delete (lines 228-261). |
| 22 | User can add key photos, change hold duration, reorder, and remove key photos; user can set per-sequence fps and resolution | VERIFIED | `sequenceStore.ts`: `addKeyPhoto` (line 217), `removeKeyPhoto` (line 241), `reorderKeyPhotos` (line 262), `updateHoldFrames` (line 289), `setSequenceFps` (line 177), `setSequenceResolution` (line 196). `KeyPhotoStrip.tsx`: thumbnails via `assetUrl(image.thumbnail_path)`, SortableJS reorder, inline hold frame editing, remove button. `LeftPanel.tsx` `SequenceSettings` with fps toggle and resolution dropdown. |

#### Plan 03-04 Truths (Gap Closure -- UAT Fixes)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 23 | Key photos can be dragged horizontally to reorder without triggering the file import overlay | VERIFIED | `dragDrop.ts` lines 41-46: `if (type === 'enter')` checks `event.payload.paths.length > 0` before setting `isDraggingOver.value = true`. SortableJS internal drags have empty paths arrays, so overlay does not trigger. |
| 24 | Sequences can be dragged by their handle to reorder without triggering the file import overlay | VERIFIED | Same fix in `dragDrop.ts` applies to all SortableJS drags. `enter` event handler only activates overlay when `paths.length > 0`. Line 62: `'over'` events ignored. |
| 25 | Key photo image picker popover is usable when adding photos, regardless of how many photos exist | VERIFIED | `KeyPhotoStrip.tsx` line 211: popover `bottom-14` (opens upward), `max-h-[300px]`, `min-w-[180px] max-w-[260px]`. Line 218: `grid-cols-4` with `w-11 h-8` thumbnails. |
| 26 | External file drag-and-drop import still works (overlay appears only for real file drags) | VERIFIED | `dragDrop.ts` line 44: `paths.length > 0` check means real OS file drags still trigger the overlay. Drop handling (lines 47-58) unchanged. |

**Score: 26/26 truths verified**

---

### Required Artifacts

#### Plan 03-01 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src-tauri/src/models/project.rs` | Full MceProject model hierarchy | VERIFIED | 101 lines. `MceProject`, `MceSequence`, `MceKeyPhoto`, `MceImageRef` with serde derives. |
| `Application/src-tauri/src/models/sequence.rs` | Sequence re-export convenience | VERIFIED | File exists, `mod.rs` declares `pub mod sequence`. |
| `Application/src-tauri/src/services/project_io.rs` | Project I/O service | VERIFIED | 229 lines. `create_project_dir`, `save_project` (atomic), `open_project`, `migrate_temp_images`, `move_file`, 4 tests. |
| `Application/src-tauri/src/commands/project.rs` | Tauri commands | VERIFIED | 94 lines. `project_create`, `project_save`, `project_open`, `project_migrate_temp_images`. Asset scope registration. |
| `Application/src/types/project.ts` | TypeScript MceProject hierarchy | VERIFIED | 84 lines. All four interfaces with snake_case fields. |
| `Application/src/types/sequence.ts` | Updated Sequence/KeyPhoto types | VERIFIED | 21 lines. `KeyPhoto.imageId` (not `imagePath`). |
| `Application/src/lib/ipc.ts` | IPC wrappers for project commands | VERIFIED | 57 lines. `projectCreate`, `projectSave`, `projectOpen`, `projectMigrateTempImages`. |
| `Application/src/lib/appConfig.ts` | AppConfig module with LazyStore | VERIFIED | 58 lines. `LazyStore` singleton, 6 exported functions. |
| `Application/src-tauri/capabilities/default.json` | store and fs permissions | VERIFIED | `"store:default"`, `"fs:default"`, `"fs:allow-exists"`. |

#### Plan 03-02 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/app.tsx` | Signal-based routing | VERIFIED | 10 lines. Routes between WelcomeScreen and EditorShell based on `dirPath`. |
| `Application/src/stores/projectStore.ts` | Enhanced project store | VERIFIED | 383 lines. `filePath`, `dirPath`, `isDirty`, `isSaving` signals. Full CRUD methods. |
| `Application/src/lib/autoSave.ts` | Auto-save module | VERIFIED | 66 lines. 2s debounce + 60s interval. Idempotent start guard. |
| `Application/src/lib/projectDir.ts` | Project directory management | VERIFIED | Minimal per plan. `tempProjectDir` signal. |
| `Application/src/components/project/WelcomeScreen.tsx` | Welcome screen | VERIFIED | 323 lines. Recent projects, existence validation, New/Open buttons. |
| `Application/src/components/project/NewProjectDialog.tsx` | New project dialog | VERIFIED | 190 lines. Name, fps toggle, folder picker, Create/Cancel. |
| `Application/src/components/layout/Toolbar.tsx` | Wired toolbar | VERIFIED | 123 lines. New/Open/Save buttons, dirty indicator, saving state. |
| `Application/src/components/layout/EditorShell.tsx` | Editor shell | VERIFIED | Uses `projectStore.dirPath.value ?? tempProjectDir.value`. |

#### Plan 03-03 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/stores/sequenceStore.ts` | Full sequence CRUD | VERIFIED | 444 lines. All sequence and key photo CRUD methods plus undo/redo. |
| `Application/src/types/sequence.ts` | Updated types with imageId | VERIFIED | `KeyPhoto.imageId` confirmed. |
| `Application/src/components/sequence/SequenceList.tsx` | Sortable sequence list | VERIFIED | 265 lines. SortableJS, drag handle, rename, context menu. |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Sortable key photo strip | VERIFIED | 236 lines. SortableJS horizontal, thumbnails, hold frame editing, popover. |
| `Application/src/components/layout/LeftPanel.tsx` | Updated left panel | VERIFIED | 207 lines. SequenceList, KeyPhotoStrip, SequenceSettings. No sequence mock data. |

#### Plan 03-04 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/lib/dragDrop.ts` | External vs internal drag distinction | VERIFIED | 70 lines. `paths.length > 0` check on enter event. |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Improved popover | VERIFIED | `bottom-14`, `max-h-[300px]`, `grid-cols-4`. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ipc.ts` | `commands/project.rs` | `safeInvoke('project_create')` etc. | WIRED | ipc.ts lines 34-48. lib.rs lines 51-55 registers commands. |
| `commands/project.rs` | `services/project_io.rs` | Commands delegate to project_io | WIRED | All four commands call `project_io::` functions. |
| `appConfig.ts` | `capabilities/default.json` | store:default | WIRED | Capability present. |
| `types/project.ts` | `models/project.rs` | TypeScript mirrors Rust | WIRED | Field-for-field match. |
| `app.tsx` | `stores/projectStore.ts` | isProjectOpen computed | WIRED | Line 6: checks `dirPath.value`. |
| `WelcomeScreen.tsx` | `lib/appConfig.ts` | getRecentProjects | WIRED | Line 117 in useEffect. |
| `Toolbar.tsx` | projectStore | Save chain | WIRED | handleSave -> projectStore.saveProject() -> ipcProjectSave. |
| `autoSave.ts` | `stores/projectStore.ts` | effect() watches signals | WIRED | Lines 33-38 subscribe to multiple store signals. |
| `projectStore.ts` | `stores/sequenceStore.ts` | _setMarkDirtyCallback | WIRED | Line 379. |
| `projectStore.ts` | `lib/ipc.ts` | projectMigrateTempImages | WIRED | Line 6 import, line 241 call. |
| `SequenceList.tsx` | `stores/sequenceStore.ts` | reorderSequences | WIRED | Line 26. |
| `KeyPhotoStrip.tsx` | `stores/sequenceStore.ts` | reorderKeyPhotos | WIRED | Line 56. |
| `KeyPhotoStrip.tsx` | `stores/imageStore.ts` | getById + assetUrl | WIRED | Lines 89-90. |
| `LeftPanel.tsx` | `SequenceList.tsx` | import + render | WIRED | Line 6 import, line 38 render. |
| `dragDrop.ts` | `DropZone.tsx` | isDraggingOver signal | WIRED | Exported signal, only true when paths.length > 0. |

---

### Requirements Coverage

Requirements from all four plan frontmatter sections. Cross-referenced against v1.0-REQUIREMENTS.md traceability table.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROJ-01 | 03-01 | User can create a new project with name and frame rate | SATISFIED | Rust `project_create` + `NewProjectDialog` + `projectStore.createProject()` |
| PROJ-02 | 03-01 | User can save project to .mce file | SATISFIED | Rust `project_save` (atomic write) + `projectStore.saveProject()` + Toolbar Save |
| PROJ-03 | 03-01 | User can open existing .mce project files | SATISFIED | Rust `project_open` + `projectStore.openProject()` + WelcomeScreen Open |
| PROJ-04 | 03-02 | Project auto-saves on interval and significant actions | SATISFIED | `autoSave.ts`: 2s debounce effect + 60s periodic interval |
| PROJ-05 | 03-02 | User can access recent projects list on launch | SATISFIED | `WelcomeScreen.tsx` loads from `appConfig`, validates existence |
| PROJ-06 | 03-01 | Global app config persists between sessions | SATISFIED | `appConfig.ts` LazyStore: recent projects, window prefs, last project path |
| SEQN-01 | 03-03 | User can create named sequences | SATISFIED | `sequenceStore.createSequence(name)` + LeftPanel "+ Add" button |
| SEQN-02 | 03-03, 03-04 | User can duplicate, delete, and reorder sequences | SATISFIED | Full CRUD + SortableJS drag. 03-04 fixed overlay blocking drag. |
| SEQN-03 | 03-03 | User can add key photos with configurable hold duration | SATISFIED | `addKeyPhoto` + picker popover + `updateHoldFrames` |
| SEQN-04 | 03-03, 03-04 | User can reorder key photos within a sequence via drag | SATISFIED | SortableJS horizontal reorder. 03-04 fixed overlay blocking drag. |
| SEQN-05 | 03-03 | User can set per-sequence frame rate and resolution | SATISFIED | `setSequenceFps`/`setSequenceResolution` + SequenceSettings UI |

**Orphaned requirements check:** v1.0-REQUIREMENTS.md maps PROJ-01 through PROJ-06 and SEQN-01 through SEQN-05 to Phase 3. All 11 claimed by plans. No orphans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `Toolbar.tsx` | 28, 46, 53 | `console.error` on failed open/save | INFO | Appropriate error logging. |
| `WelcomeScreen.tsx` | 143, 156 | `console.error` on failed open | INFO | Appropriate error logging. |

No blocker or warning anti-patterns found.

**Note on artifact spec mismatches:** Plan 03-02 specifies `contains: "project_save"` for Toolbar.tsx and `contains: "debouncedSave"` for autoSave.ts. The actual names are `projectStore.saveProject()` and `scheduleSave` respectively. Both are functionally correct implementations with different names. Not real gaps.

---

### Human Verification Required

### 1. New Project Flow End-to-End

**Test:** Launch app, click "New Project", enter name, select fps, choose folder, click Create.
**Expected:** Project directory created on disk with subdirectories; .mce file saved; app transitions to EditorShell.
**Why human:** Native file dialog and file system creation require runtime verification.

### 2. Open Project with Data Restoration

**Test:** Create a project with sequences and key photos, close app, relaunch, open the .mce file.
**Expected:** All project data restored exactly as saved.
**Why human:** Round-trip serialization across app restarts.

### 3. Recent Projects Persistence

**Test:** Create a project, close app, relaunch. Delete .mce on disk, relaunch again.
**Expected:** First relaunch shows project. After deletion, shows "Not found" with opacity-50.
**Why human:** Plugin-store persistence and plugin-fs checks require app lifecycle.

### 4. Auto-Save Timing

**Test:** Open a project, rename a sequence, wait 2+ seconds.
**Expected:** .mce file updated on disk. Dirty indicator clears.
**Why human:** Timer-based debounce requires live observation.

### 5. SortableJS Drag-and-Drop

**Test:** Drag sequence handle to reorder. Drag key photo horizontally. Drag file from Finder.
**Expected:** Sequence/key photo reorder without overlay. Finder drag shows overlay.
**Why human:** DOM sync + Tauri drag event filtering require visual inspection.

### 6. Image Picker Popover UX

**Test:** Import 20+ images, click "+" to add key photos.
**Expected:** Popover opens upward, 4-column grid, usable without excessive scrolling.
**Why human:** Visual layout assessment.

---

### Gaps Summary

No gaps found. All 26 must-have truths across four plans are verified against the actual codebase. All 11 requirements (PROJ-01 through PROJ-06, SEQN-01 through SEQN-05) are satisfied. All key links are wired. Plan 03-04 gap closure fixes confirmed in code. No blocker anti-patterns detected.

The phase goal is achieved: users can create, save, open, and auto-save projects in .mce format; manage sequences with key photos and drag-drop reorder; set per-sequence fps and resolution; and pick up recent projects on launch.

---

*Verified: 2026-03-09*
*Verifier: Claude (gsd-verifier)*
