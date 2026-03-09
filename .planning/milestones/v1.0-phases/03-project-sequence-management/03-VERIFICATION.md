---
phase: 03-project-sequence-management
verified: 2026-03-09T16:30:00Z
status: passed
score: 33/33 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 26/26
  gaps_closed:
    - "Recent projects list text is clearly readable against the dark background"
    - "Recent projects saved to user-chosen directories are recognized as available"
    - "Sequences can be deleted regardless of how many exist in the list"
    - "Sequences can be dragged to reorder and the new order persists"
    - "Key photos can be added from the image picker popover at any time"
    - "Key photos can be dragged to reorder in the horizontal strip"
  gaps_remaining: []
  regressions: []
---

# Phase 03: Project & Sequence Management Verification Report

**Phase Goal:** Users can create, save, open, and auto-save projects in .mce format, manage sequences with key photos, reorder via drag-and-drop, and pick up recent projects on launch
**Verified:** 2026-03-09T16:30:00Z
**Status:** PASSED
**Re-verification:** Yes -- after Plans 03-05 and 03-06 gap closure (UAT failures fixed)

---

## Goal Achievement

### Observable Truths

All truths are drawn from the must_haves frontmatter of Plans 03-01 through 03-06.

#### Plan 03-01 Truths (Backend & Persistence)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Rust project_create command creates a project directory with images/ and images/.thumbs/ subdirectories and returns a serializable MceProject struct | VERIFIED | `commands/project.rs` lines 21-52: calls `project_io::create_project_dir`, registers asset scope, returns `MceProject`. `project_io.rs` lines 6-18: creates `images/.thumbs/` and `videos/` subdirs. Test `test_create_project_dir_creates_subdirectories` confirms. |
| 2 | Rust project_save command writes the .mce JSON file atomically (temp file + rename) with all project state | VERIFIED | `project_io.rs` lines 23-37: writes to `{path}.tmp` via `fs::write`, then `fs::rename`. Test `test_atomic_write_creates_no_temp_file` confirms temp file is cleaned up. |
| 3 | Rust project_open command reads a .mce file, validates it, and returns the full MceProject struct to the frontend | VERIFIED | `project_io.rs` lines 41-48: reads file, `serde_json::from_str` deserializes, returns `MceProject`. `commands/project.rs` lines 69-84: also registers asset scope for project directory. Roundtrip test confirms. |
| 4 | Image paths stored in .mce files are relative to the project root; absolute paths are never persisted | VERIFIED | `MceImageRef` fields are `relative_path` and `thumbnail_relative_path`. Frontend `projectStore.buildMceProject()` calls `imageStore.toMceImages(projectRoot)` which creates relative paths. `make_relative`/`make_absolute` helpers exist in `project_io.rs` (test-only). |
| 5 | tauri-plugin-store is installed and registered for persistent app config | VERIFIED | `Cargo.toml` line 23: `tauri-plugin-store = "2"`. `lib.rs` line 14: `.plugin(tauri_plugin_store::Builder::default().build())`. `default.json` line 14: `"store:default"`. |
| 6 | tauri-plugin-fs is installed and registered for frontend file existence checks | VERIFIED | `Cargo.toml` line 24: `tauri-plugin-fs = "2"`. `lib.rs` line 15: `.plugin(tauri_plugin_fs::init())`. `default.json` lines 15-20: `"fs:default"`, `"fs:allow-exists"`, etc. Note: WelcomeScreen now uses `pathExists` IPC instead of the FS plugin for existence checks (Plan 03-05 fix), but the plugin remains registered for other uses. |
| 7 | TypeScript MceProject, MceSequence, MceKeyPhoto, MceImageRef types mirror Rust structs exactly | VERIFIED | `types/project.ts` has all four interfaces with snake_case fields matching Rust serde output. |
| 8 | IPC wrappers exist for project_create, project_save, and project_open commands | VERIFIED | `ipc.ts` lines 34-48: `projectCreate`, `projectSave`, `projectOpen`, `projectMigrateTempImages`. Plus `pathExists` added in Plan 03-05. All use `safeInvoke`. |
| 9 | AppConfig module wraps tauri-plugin-store LazyStore for recent projects and window preferences | VERIFIED | `appConfig.ts` (58 lines): `LazyStore` singleton on line 4, exports `getRecentProjects`, `addRecentProject`, `removeRecentProject`, `getAppConfig`, `setLastProjectPath`, `setWindowSize`. |

#### Plan 03-02 Truths (Project Management UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | App launches to a WelcomeScreen showing recent projects, 'New Project', and 'Open Project' buttons | VERIFIED | `app.tsx` line 6: `computed(() => projectStore.dirPath.value !== null)` shows `<WelcomeScreen />` when null. `WelcomeScreen.tsx` lines 183-225: "New Project" button. Lines 228-250: "Open Project" button. Lines 261-275: recent projects list from `getRecentProjects()`. |
| 11 | User can create a new project by entering name and selecting fps, which creates a project directory via Rust and transitions to the editor | VERIFIED | `NewProjectDialog.tsx`: name input, fps toggle 15/24, folder picker. On Create calls `projectStore.createProject()` then `saveProjectAs()`. App transitions because `dirPath` becomes non-null. |
| 12 | User can open an existing .mce file via file dialog, which loads all project data into stores and transitions to the editor | VERIFIED | `WelcomeScreen.tsx` lines 134-148: `handleOpenProject` calls `open()` with `.mce` filter, then `projectStore.openProject(selected)`. |
| 13 | User can click a recent project entry on the welcome screen to open it directly | VERIFIED | `WelcomeScreen.tsx` lines 151-161: `handleRecentClick` checks `project.available`, calls `projectStore.openProject(project.path)`. |
| 14 | Recent projects list shows entries from tauri-plugin-store and marks missing files as unavailable | VERIFIED | `WelcomeScreen.tsx` lines 115-131: loads from `getRecentProjects()`, validates each with `pathExists(p.path)` from IPC (upgraded from `@tauri-apps/plugin-fs` in Plan 03-05). Line 56: unavailable items show `cursor-default`. Line 80-82: shows "Not found" text. |
| 15 | Toolbar Save button serializes current store state to the .mce file via Rust project_save command | VERIFIED | `Toolbar.tsx`: `handleSave` calls `projectStore.saveProject()` or `saveProjectAs()` if never saved. |
| 16 | Auto-save triggers after a 2-second debounce when project/sequence stores change | VERIFIED | `autoSave.ts` lines 10-17: `scheduleSave()` uses `setTimeout(..., 2000)`. |
| 17 | Auto-save also runs every 60 seconds as a safety net if the project is dirty | VERIFIED | `autoSave.ts` lines 44-48: `setInterval(() => {...}, 60_000)` checks `filePath` and `isDirty`. |
| 18 | Project file path and dirty flag are tracked in projectStore | VERIFIED | `projectStore.ts`: `filePath = signal<string | null>(null)`, `isDirty = signal(false)`. |
| 19 | Images previously in temp dir are migrated to real project dir on project creation | VERIFIED | `projectStore.createProject()` calls `projectMigrateTempImages` then `imageStore.updateProjectPaths`. Rust `migrate_temp_images` moves files with rename+copy fallback. |
| 20 | markDirty callback is registered: sequenceStore mutations set projectStore.isDirty to true | VERIFIED | `projectStore.ts` line 379: `_setMarkDirtyCallback(() => projectStore.markDirty())`. |

#### Plan 03-03 Truths (Sequence Management UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 21 | User can create, duplicate, delete, and reorder sequences via drag-and-drop | VERIFIED | `sequenceStore.ts`: `createSequence`, `duplicate`, `remove`, `reorderSequences`. `SequenceList.tsx`: SortableJS with `handle: '.seq-drag-handle'`, DOM revert in onEnd (Plan 03-06), `[sequences.length]` deps (Plan 03-06). Context menu with Rename/Duplicate/Delete. |
| 22 | User can add key photos, change hold duration, reorder, and remove key photos; user can set per-sequence fps and resolution | VERIFIED | `sequenceStore.ts`: `addKeyPhoto`, `removeKeyPhoto`, `reorderKeyPhotos`, `updateHoldFrames`, `setSequenceFps`, `setSequenceResolution`. `KeyPhotoStrip.tsx`: SortableJS with DOM revert (Plan 03-06), button outside overflow (Plan 03-06). |

#### Plan 03-04 Truths (Gap Closure -- Overlay Fixes)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 23 | Key photos can be dragged horizontally to reorder without triggering the file import overlay | VERIFIED | `dragDrop.ts` line 44: `event.payload.paths.length > 0` check. SortableJS internal drags have empty paths arrays, so overlay does not trigger. |
| 24 | Sequences can be dragged by their handle to reorder without triggering the file import overlay | VERIFIED | Same `paths.length > 0` check applies to all SortableJS drags. |
| 25 | Key photo image picker popover is usable when adding photos, regardless of how many photos exist | VERIFIED | `KeyPhotoStrip.tsx` line 217: popover `bottom-14`, `max-h-[300px]`, `min-w-[180px] max-w-[260px]`. `grid-cols-4` with `w-11 h-8` thumbnails. Button now outside overflow container (Plan 03-06). |
| 26 | External file drag-and-drop import still works (overlay appears only for real file drags) | VERIFIED | `dragDrop.ts` line 44: `paths.length > 0` check means real OS file drags still trigger the overlay. |

#### Plan 03-05 Truths (Gap Closure -- Welcome Screen)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 27 | Recent projects list text is clearly readable against the dark background | VERIFIED | `WelcomeScreen.tsx` line 68: non-highlighted names use `text-[#CCCCCC]` (high contrast). Line 77: non-highlighted dates use `text-[#999999]`. No `opacity-50` class found anywhere in file. Unavailable items use `cursor-default` (line 56) instead of reduced opacity. |
| 28 | Recent projects saved to user-chosen directories are recognized as available (not greyed out) | VERIFIED | `WelcomeScreen.tsx` line 3: imports `pathExists` from `../../lib/ipc` (NOT from `@tauri-apps/plugin-fs`). Lines 120-126: `pathExists(p.path)` calls Rust `path_exists` command (line 90 of `commands/project.rs`) which uses `std::path::Path::new(&file_path).exists()` -- no FS scope restriction. |
| 29 | Clicking a recent project in the list opens it in the editor | VERIFIED | `WelcomeScreen.tsx` lines 151-161: `handleRecentClick` checks `project.available`, then calls `projectStore.openProject(project.path)`. Guard on `!project.available` prevents opening missing files. |

#### Plan 03-06 Truths (Gap Closure -- SortableJS Fixes)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 30 | Sequences can be deleted regardless of how many exist in the list | VERIFIED | `SequenceList.tsx` line 35: `[sequences.length]` as useEffect dep. SortableJS instance is destroyed and recreated when sequences are added/removed, preventing stale DOM refs from blocking context menu actions on 3rd+ items. Delete handler on lines 257-262 unchanged. |
| 31 | Sequences can be dragged to reorder and the new order persists | VERIFIED | `SequenceList.tsx` lines 28-29: `from.removeChild(item)` then `from.insertBefore(item, from.children[oldIndex] ?? null)` reverts SortableJS DOM mutation before `sequenceStore.reorderSequences(oldIndex, newIndex)` on line 30. Preact sees original DOM and correctly applies new order from signal update. |
| 32 | Key photos can be added from the image picker popover at any time, including 2nd, 3rd, etc. | VERIFIED | `KeyPhotoStrip.tsx` lines 67-76: outer `flex gap-1.5 items-start` div holds scrollable strip (line 69, `ref={stripRef}`) and `AddKeyPhotoButton` (line 74) as siblings. Button is OUTSIDE the `overflow-x-auto` sortable container, so: SortableJS never intercepts clicks, popover is not clipped by overflow. Line 65: `[sequenceId, keyPhotos.length]` deps ensure instance recreation on add/remove. |
| 33 | Key photos can be dragged to reorder in the horizontal strip | VERIFIED | `KeyPhotoStrip.tsx` lines 58-59: `from.removeChild(item)` then `from.insertBefore(item, from.children[oldIndex] ?? null)` reverts SortableJS DOM mutation before `sequenceStore.reorderKeyPhotos(sequenceId, oldIndex, newIndex)` on line 60. Same DOM revert pattern as SequenceList. |

**Score: 33/33 truths verified**

---

### Required Artifacts

#### Plan 03-01 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src-tauri/src/models/project.rs` | Full MceProject model hierarchy | VERIFIED | `MceProject`, `MceSequence`, `MceKeyPhoto`, `MceImageRef` with serde derives. |
| `Application/src-tauri/src/models/sequence.rs` | Sequence re-export convenience | VERIFIED | File exists, `mod.rs` declares `pub mod sequence`. |
| `Application/src-tauri/src/services/project_io.rs` | Project I/O service | VERIFIED | `create_project_dir`, `save_project` (atomic), `open_project`, `migrate_temp_images`, 4 tests. |
| `Application/src-tauri/src/commands/project.rs` | Tauri commands | VERIFIED | 102 lines. `project_create`, `project_save`, `project_open`, `project_migrate_temp_images`, `path_exists` (added Plan 03-05). |
| `Application/src/types/project.ts` | TypeScript MceProject hierarchy | VERIFIED | All four interfaces with snake_case fields. |
| `Application/src/types/sequence.ts` | Updated Sequence/KeyPhoto types | VERIFIED | `KeyPhoto.imageId` (not `imagePath`). |
| `Application/src/lib/ipc.ts` | IPC wrappers for project commands | VERIFIED | 63 lines. All project commands + `pathExists` (added Plan 03-05). |
| `Application/src/lib/appConfig.ts` | AppConfig module with LazyStore | VERIFIED | 58 lines. `LazyStore` singleton, 6 exported functions. |
| `Application/src-tauri/capabilities/default.json` | store and fs permissions | VERIFIED | `"store:default"`, `"fs:default"`, `"fs:allow-exists"`. |

#### Plan 03-02 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/app.tsx` | Signal-based routing | VERIFIED | Routes between WelcomeScreen and EditorShell based on `dirPath`. |
| `Application/src/stores/projectStore.ts` | Enhanced project store | VERIFIED | `filePath`, `dirPath`, `isDirty`, `isSaving` signals. Full CRUD methods. |
| `Application/src/lib/autoSave.ts` | Auto-save module | VERIFIED | 2s debounce + 60s interval. Idempotent start guard. |
| `Application/src/lib/projectDir.ts` | Project directory management | VERIFIED | Minimal per plan. `tempProjectDir` signal. |
| `Application/src/components/project/WelcomeScreen.tsx` | Welcome screen | VERIFIED | 325 lines. Recent projects with readable text (#CCCCCC/#999999), `pathExists` validation, New/Open buttons. |
| `Application/src/components/project/NewProjectDialog.tsx` | New project dialog | VERIFIED | Name, fps toggle, folder picker, Create/Cancel. |
| `Application/src/components/layout/Toolbar.tsx` | Wired toolbar | VERIFIED | New/Open/Save buttons, dirty indicator, saving state. |
| `Application/src/components/layout/EditorShell.tsx` | Editor shell | VERIFIED | Uses `projectStore.dirPath.value ?? tempProjectDir.value`. |

#### Plan 03-03 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/stores/sequenceStore.ts` | Full sequence CRUD | VERIFIED | All sequence and key photo CRUD methods plus undo/redo. |
| `Application/src/types/sequence.ts` | Updated types with imageId | VERIFIED | `KeyPhoto.imageId` confirmed. |
| `Application/src/components/sequence/SequenceList.tsx` | Sortable sequence list | VERIFIED | 270 lines. SortableJS with DOM revert, `[sequences.length]` deps, drag handle, rename, context menu. |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Sortable key photo strip | VERIFIED | 243 lines. SortableJS with DOM revert, `[sequenceId, keyPhotos.length]` deps, button outside overflow, thumbnails, hold frame editing, popover. |
| `Application/src/components/layout/LeftPanel.tsx` | Updated left panel | VERIFIED | SequenceList, KeyPhotoStrip, SequenceSettings. |

#### Plan 03-04 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/lib/dragDrop.ts` | External vs internal drag distinction | VERIFIED | `paths.length > 0` check on enter event. |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Improved popover | VERIFIED | `bottom-14`, `max-h-[300px]`, `grid-cols-4`. |

#### Plan 03-05 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src-tauri/src/commands/project.rs` | `path_exists` Tauri command bypassing FS scope | VERIFIED | Line 90: `pub fn path_exists(file_path: String) -> bool { std::path::Path::new(&file_path).exists() }`. Uses `#[command]` attribute. |
| `Application/src/lib/ipc.ts` | `pathExists` IPC wrapper | VERIFIED | Line 51: `export async function pathExists(filePath: string): Promise<Result<boolean>>` using `safeInvoke<boolean>('path_exists', { filePath })`. |
| `Application/src/components/project/WelcomeScreen.tsx` | Readable text colors and working click handler | VERIFIED | Line 68: `text-[#CCCCCC]` for names. Line 77: `text-[#999999]` for dates. Line 56: `cursor-default` for unavailable. No `opacity-50`. Lines 120-126: `pathExists` for validation. |

#### Plan 03-06 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/sequence/SequenceList.tsx` | SortableJS with proper deps and DOM revert | VERIFIED | Lines 25-31: onEnd destructures `{ oldIndex, newIndex, item, from }`, reverts DOM with `removeChild`/`insertBefore`, then calls store. Line 35: `[sequences.length]` dep. |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | SortableJS with DOM revert, add button outside overflow | VERIFIED | Lines 55-61: same DOM revert pattern. Lines 67-76: outer flex div with button as sibling outside overflow-x-auto strip. Line 65: `[sequenceId, keyPhotos.length]` deps. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ipc.ts` | `commands/project.rs` | `safeInvoke('project_create')` etc. | WIRED | ipc.ts lines 34-48. lib.rs lines 50-58 registers all commands. |
| `commands/project.rs` | `services/project_io.rs` | Commands delegate to project_io | WIRED | All four CRUD commands call `project_io::` functions. |
| `appConfig.ts` | `capabilities/default.json` | store:default | WIRED | Capability present. |
| `types/project.ts` | `models/project.rs` | TypeScript mirrors Rust | WIRED | Field-for-field match. |
| `app.tsx` | `stores/projectStore.ts` | isProjectOpen computed | WIRED | Checks `dirPath.value`. |
| `WelcomeScreen.tsx` | `lib/appConfig.ts` | getRecentProjects | WIRED | Line 117 in useEffect. |
| `Toolbar.tsx` | projectStore | Save chain | WIRED | handleSave -> projectStore.saveProject() -> ipcProjectSave. |
| `autoSave.ts` | `stores/projectStore.ts` | effect() watches signals | WIRED | Subscribes to multiple store signals. |
| `projectStore.ts` | `stores/sequenceStore.ts` | _setMarkDirtyCallback | WIRED | Line 379. |
| `projectStore.ts` | `lib/ipc.ts` | projectMigrateTempImages | WIRED | Import and call confirmed. |
| `SequenceList.tsx` | `stores/sequenceStore.ts` | reorderSequences via DOM revert | WIRED | Line 30: `sequenceStore.reorderSequences(oldIndex, newIndex)` after `removeChild`/`insertBefore` on lines 28-29. |
| `KeyPhotoStrip.tsx` | `stores/sequenceStore.ts` | reorderKeyPhotos via DOM revert | WIRED | Line 60: `sequenceStore.reorderKeyPhotos(sequenceId, oldIndex, newIndex)` after `removeChild`/`insertBefore` on lines 58-59. |
| `KeyPhotoStrip.tsx` | `stores/imageStore.ts` | getById + assetUrl | WIRED | Lines 95-96 in KeyPhotoCard. |
| `LeftPanel.tsx` | `SequenceList.tsx` | import + render | WIRED | Import and render confirmed. |
| `dragDrop.ts` | `DropZone.tsx` | isDraggingOver signal | WIRED | Only true when paths.length > 0. |
| `WelcomeScreen.tsx` | `lib/ipc.ts` | pathExists() call in useEffect | WIRED | Line 3: import. Line 122: `pathExists(p.path)` call in validation loop. (Plan 03-05) |
| `ipc.ts` | `commands/project.rs` | invoke('path_exists') | WIRED | `ipc.ts` line 52: `safeInvoke<boolean>('path_exists', { filePath })`. `lib.rs` line 56: `project::path_exists` in generate_handler. (Plan 03-05) |

---

### Requirements Coverage

Requirements from all six plan frontmatter sections. Cross-referenced against v1.0-REQUIREMENTS.md traceability table.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROJ-01 | 03-01 | User can create a new project with name and frame rate | SATISFIED | Rust `project_create` + `NewProjectDialog` + `projectStore.createProject()` |
| PROJ-02 | 03-01 | User can save project to .mce file | SATISFIED | Rust `project_save` (atomic write) + `projectStore.saveProject()` + Toolbar Save |
| PROJ-03 | 03-01 | User can open existing .mce project files | SATISFIED | Rust `project_open` + `projectStore.openProject()` + WelcomeScreen Open |
| PROJ-04 | 03-02 | Project auto-saves on interval and significant actions | SATISFIED | `autoSave.ts`: 2s debounce effect + 60s periodic interval |
| PROJ-05 | 03-02, 03-05 | User can access recent projects list on launch | SATISFIED | `WelcomeScreen.tsx` loads from `appConfig`, validates via `pathExists` IPC (scope-free). Plan 03-05 fixed: readable text contrast (#CCCCCC/#999999), replaced `@tauri-apps/plugin-fs` exists() with Rust `path_exists` command to bypass FS scope restriction. |
| PROJ-06 | 03-01, 03-05 | Global app config persists between sessions | SATISFIED | `appConfig.ts` LazyStore: recent projects, window prefs, last project path. Plan 03-05 ensured path validation works for all directories. |
| SEQN-01 | 03-03, 03-06 | User can create named sequences | SATISFIED | `sequenceStore.createSequence(name)` + LeftPanel "+ Add" button. Plan 03-06 fixed SortableJS instance recreation so new sequences are properly tracked. |
| SEQN-02 | 03-03, 03-04, 03-06 | User can duplicate, delete, and reorder sequences | SATISFIED | Full CRUD + SortableJS drag with DOM revert pattern. Plan 03-04 fixed overlay blocking drag. Plan 03-06 fixed: DOM revert for persistent reorder, `[sequences.length]` deps for delete on 3rd+ items. |
| SEQN-03 | 03-03, 03-06 | User can add key photos with configurable hold duration | SATISFIED | `addKeyPhoto` + picker popover + `updateHoldFrames`. Plan 03-06 fixed: AddKeyPhotoButton moved outside overflow container so clicks always work. |
| SEQN-04 | 03-03, 03-04, 03-06 | User can reorder key photos within a sequence via drag | SATISFIED | SortableJS horizontal reorder with DOM revert. Plan 03-04 fixed overlay. Plan 03-06 fixed: DOM revert for persistent reorder, `[sequenceId, keyPhotos.length]` deps. |
| SEQN-05 | 03-03 | User can set per-sequence frame rate and resolution | SATISFIED | `setSequenceFps`/`setSequenceResolution` + SequenceSettings UI |

**Orphaned requirements check:** v1.0-REQUIREMENTS.md maps PROJ-01 through PROJ-06 and SEQN-01 through SEQN-05 to Phase 3. All 11 claimed by plans. No orphans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `Toolbar.tsx` | 28, 46, 53 | `console.error` on failed open/save | INFO | Appropriate error logging. |
| `WelcomeScreen.tsx` | 144, 157 | `console.error` on failed open | INFO | Appropriate error logging. |

No blocker or warning anti-patterns found. No TODO/FIXME/PLACEHOLDER/HACK comments in any files modified by Plans 03-05 or 03-06.

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

### 3. Recent Projects -- Readable Text and Availability

**Test:** Create a project in a user directory (e.g. ~/Documents), close app, relaunch. Check recent projects list.
**Expected:** Project name is clearly readable (#CCCCCC on dark background). Project shows as available (not greyed out). Clicking it opens the project. Delete .mce on disk, relaunch -- shows "Not found" with `cursor-default`.
**Why human:** Visual contrast assessment and FS scope behavior require runtime verification.

### 4. Auto-Save Timing

**Test:** Open a project, rename a sequence, wait 2+ seconds.
**Expected:** .mce file updated on disk. Dirty indicator clears.
**Why human:** Timer-based debounce requires live observation.

### 5. Sequence Drag Reorder with DOM Revert

**Test:** Create 3+ sequences. Drag a sequence by its handle to a new position. Release.
**Expected:** Sequence moves to new position and stays there (order persists). No snap-back. No file import overlay appears.
**Why human:** DOM revert + Preact re-render synchronization requires visual confirmation.

### 6. Sequence Delete on 3rd+ Items

**Test:** Create or duplicate until 3+ sequences exist. Right-click the 3rd sequence, click Delete.
**Expected:** Sequence is removed. Repeat for any position -- all deletions work.
**Why human:** SortableJS instance recreation behavior requires runtime verification.

### 7. Key Photo Add Button Always Works

**Test:** Select a sequence. Add a key photo (1st). Click "+" to add a 2nd. Click "+" to add a 3rd. Delete the 2nd, then add again.
**Expected:** Add button works every time. Popover opens upward, not clipped by overflow. 4-column grid visible.
**Why human:** Popover positioning relative to overflow container requires visual confirmation.

### 8. Key Photo Drag Reorder

**Test:** Add 3+ key photos to a sequence. Drag one horizontally to a new position.
**Expected:** Key photo moves to new position and stays there (order persists). No snap-back.
**Why human:** DOM revert + Preact re-render synchronization requires visual confirmation.

### 9. External File Drag-and-Drop Still Works

**Test:** Drag image files from Finder onto the app window.
**Expected:** Import overlay appears. Files are imported normally.
**Why human:** Tauri drag event integration requires runtime verification.

---

### Gaps Summary

No gaps found. All 33 must-have truths across six plans are verified against the actual codebase. All 11 requirements (PROJ-01 through PROJ-06, SEQN-01 through SEQN-05) are satisfied. All 17 key links are wired. Plans 03-05 and 03-06 gap closure fixes confirmed in code:

- **Plan 03-05:** `path_exists` Rust command (line 90 of project.rs) using `std::path::Path::exists()` bypasses FS scope restriction. `pathExists` IPC wrapper (line 51 of ipc.ts) wired to WelcomeScreen (line 122). Text contrast fixed with #CCCCCC/#999999 hex colors. `opacity-50` removed, replaced with `cursor-default`.
- **Plan 03-06:** DOM revert pattern (`removeChild` + `insertBefore`) applied in both SequenceList.tsx (lines 28-29) and KeyPhotoStrip.tsx (lines 58-59). `sequences.length` and `keyPhotos.length` added to useEffect deps. AddKeyPhotoButton moved outside overflow-x-auto container as a sibling element (line 74 of KeyPhotoStrip.tsx).

No regressions detected in the original 26 truths. The phase goal is fully achieved.

---

*Verified: 2026-03-09*
*Verifier: Claude (gsd-verifier)*
