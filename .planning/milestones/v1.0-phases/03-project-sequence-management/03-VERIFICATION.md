---
phase: 03-project-sequence-management
verified: 2026-03-09T13:49:47Z
status: passed
score: 37/37 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 33/33
  gaps_closed:
    - "Context menu renders as a floating overlay without causing scrollbar in the sequence list"
    - "Sequences can be dragged to reorder in the left sidebar and the new order persists"
    - "Key photo strip has larger thumbnails, hidden scrollbar, and horizontal wheel scroll"
    - "Key photos can be reordered via click-to-select and arrow keys"
  gaps_remaining: []
  regressions: []
---

# Phase 03: Project & Sequence Management Verification Report

**Phase Goal:** Users can create, save, open, and auto-save projects in .mce format, manage sequences with key photos, reorder via drag-and-drop, and pick up recent projects on launch
**Verified:** 2026-03-09T13:49:47Z
**Status:** PASSED
**Re-verification:** Yes -- after Plans 03-07 and 03-08 gap closure (UAT round 2 failures fixed)

---

## Goal Achievement

### Observable Truths

All truths are drawn from the must_haves frontmatter of Plans 03-01 through 03-08.

#### Plan 03-01 Truths (Backend & Persistence)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Rust project_create command creates a project directory with images/ and images/.thumbs/ subdirectories and returns a serializable MceProject struct | VERIFIED | `commands/project.rs` lines 21-52: calls `project_io::create_project_dir`, registers asset scope, returns `MceProject`. `project_io.rs` lines 6-18: creates `images/.thumbs/` and `videos/` subdirs. Test `test_create_project_dir_creates_subdirectories` confirms. |
| 2 | Rust project_save command writes the .mce JSON file atomically (temp file + rename) with all project state | VERIFIED | `project_io.rs` lines 23-37: writes to `{path}.tmp` via `fs::write`, then `fs::rename`. Test `test_atomic_write_creates_no_temp_file` confirms temp file is cleaned up. |
| 3 | Rust project_open command reads a .mce file, validates it, and returns the full MceProject struct to the frontend | VERIFIED | `project_io.rs` lines 41-48: reads file, `serde_json::from_str` deserializes, returns `MceProject`. `commands/project.rs` lines 69-84: also registers asset scope for project directory. Roundtrip test confirms. |
| 4 | Image paths stored in .mce files are relative to the project root; absolute paths are never persisted | VERIFIED | `MceImageRef` fields are `relative_path` and `thumbnail_relative_path`. Frontend `projectStore.buildMceProject()` calls `imageStore.toMceImages(projectRoot)` which creates relative paths. `make_relative`/`make_absolute` helpers exist in `project_io.rs` (test-only). |
| 5 | tauri-plugin-store is installed and registered for persistent app config | VERIFIED | `Cargo.toml`: `tauri-plugin-store = "2"`. `lib.rs`: `.plugin(tauri_plugin_store::Builder::default().build())`. `default.json`: `"store:default"`. |
| 6 | tauri-plugin-fs is installed and registered for frontend file existence checks | VERIFIED | `Cargo.toml`: `tauri-plugin-fs = "2"`. `lib.rs`: `.plugin(tauri_plugin_fs::init())`. Note: WelcomeScreen now uses `pathExists` IPC instead of the FS plugin for existence checks (Plan 03-05 fix), but the plugin remains registered for other uses. |
| 7 | TypeScript MceProject, MceSequence, MceKeyPhoto, MceImageRef types mirror Rust structs exactly | VERIFIED | `types/project.ts` has all four interfaces with snake_case fields matching Rust serde output. |
| 8 | IPC wrappers exist for project_create, project_save, and project_open commands | VERIFIED | `ipc.ts` lines 34-53: `projectCreate`, `projectSave`, `projectOpen`, `projectMigrateTempImages`, `pathExists`. All use `safeInvoke`. |
| 9 | AppConfig module wraps tauri-plugin-store LazyStore for recent projects and window preferences | VERIFIED | `appConfig.ts` (58 lines): `LazyStore` singleton on line 4, exports `getRecentProjects`, `addRecentProject`, `removeRecentProject`, `getAppConfig`, `setLastProjectPath`, `setWindowSize`. |

#### Plan 03-02 Truths (Project Management UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | App launches to a WelcomeScreen showing recent projects, 'New Project', and 'Open Project' buttons | VERIFIED | `app.tsx` line 6: `computed(() => projectStore.dirPath.value !== null)` shows `<WelcomeScreen />` when null. `WelcomeScreen.tsx` lines 183-225: "New Project" button. Lines 228-250: "Open Project" button. Lines 261-275: recent projects list from `getRecentProjects()`. |
| 11 | User can create a new project by entering name and selecting fps, which creates a project directory via Rust and transitions to the editor | VERIFIED | `NewProjectDialog.tsx`: name input, fps toggle 15/24, folder picker. On Create calls `projectStore.createProject()` then `saveProjectAs()`. App transitions because `dirPath` becomes non-null. |
| 12 | User can open an existing .mce file via file dialog, which loads all project data into stores and transitions to the editor | VERIFIED | `WelcomeScreen.tsx` lines 134-148: `handleOpenProject` calls `open()` with `.mce` filter, then `projectStore.openProject(selected)`. |
| 13 | User can click a recent project entry on the welcome screen to open it directly | VERIFIED | `WelcomeScreen.tsx` lines 151-161: `handleRecentClick` checks `project.available`, calls `projectStore.openProject(project.path)`. |
| 14 | Recent projects list shows entries from tauri-plugin-store and marks missing files as unavailable | VERIFIED | `WelcomeScreen.tsx` lines 115-131: loads from `getRecentProjects()`, validates each with `pathExists(p.path)` from IPC. Line 56: unavailable items show `cursor-default`. Line 80-82: shows "Not found" text. |
| 15 | Toolbar Save button serializes current store state to the .mce file via Rust project_save command | VERIFIED | `Toolbar.tsx`: `handleSave` calls `projectStore.saveProject()` or `saveProjectAs()` if never saved. |
| 16 | Auto-save triggers after a 2-second debounce when project/sequence stores change | VERIFIED | `autoSave.ts` lines 10-17: `scheduleSave()` uses `setTimeout(..., 2000)`. |
| 17 | Auto-save also runs every 60 seconds as a safety net if the project is dirty | VERIFIED | `autoSave.ts` lines 44-48: `setInterval(() => {...}, 60_000)` checks `filePath` and `isDirty`. |
| 18 | Project file path and dirty flag are tracked in projectStore | VERIFIED | `projectStore.ts`: `filePath = signal<string | null>(null)`, `isDirty = signal(false)`. |
| 19 | Images previously in temp dir are migrated to real project dir on project creation | VERIFIED | `projectStore.createProject()` calls `projectMigrateTempImages` then `imageStore.updateProjectPaths`. Rust `migrate_temp_images` moves files with rename+copy fallback. |
| 20 | markDirty callback is registered: sequenceStore mutations set projectStore.isDirty to true | VERIFIED | `projectStore.ts` line 379: `_setMarkDirtyCallback(() => projectStore.markDirty())`. |

#### Plan 03-03 Truths (Sequence Management UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 21 | User can create, duplicate, delete, and reorder sequences | VERIFIED | `sequenceStore.ts`: `createSequence`, `duplicate`, `remove`, `reorderSequences`. `SequenceList.tsx`: SortableJS with `handle: '.seq-drag-handle'`, DOM revert in onEnd, `[sequences.length]` deps. Portal context menu with Rename/Duplicate/Delete. |
| 22 | User can add key photos, change hold duration, reorder, and remove key photos; user can set per-sequence fps and resolution | VERIFIED | `sequenceStore.ts`: `addKeyPhoto`, `removeKeyPhoto`, `reorderKeyPhotos`, `updateHoldFrames`, `setSequenceFps`, `setSequenceResolution`. `KeyPhotoStrip.tsx`: click-select + arrow reorder (Plan 03-08), button outside overflow. |

#### Plan 03-04 Truths (Gap Closure -- Overlay Fixes)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 23 | Key photos can be reordered without triggering the file import overlay | VERIFIED | `dragDrop.ts` line 44: `event.payload.paths.length > 0` check. Internal reorder has no file paths, so overlay does not trigger. |
| 24 | Sequences can be dragged by their handle to reorder without triggering the file import overlay | VERIFIED | Same `paths.length > 0` check. SortableJS forceFallback (Plan 03-07) uses pointer events, not HTML5 DnD, so Tauri does not see a file drag. |
| 25 | Key photo image picker popover is usable when adding photos, regardless of how many photos exist | VERIFIED | `KeyPhotoStrip.tsx` line 267: popover `bottom-14`, `max-h-[300px]`, `min-w-[180px] max-w-[260px]`. `grid-cols-4` with `w-11 h-8` thumbnails. Button outside overflow container at line 109. |
| 26 | External file drag-and-drop import still works (overlay appears only for real file drags) | VERIFIED | `dragDrop.ts` line 44: `paths.length > 0` check means real OS file drags still trigger the overlay. |

#### Plan 03-05 Truths (Gap Closure -- Welcome Screen)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 27 | Recent projects list text is clearly readable against the dark background | VERIFIED | `WelcomeScreen.tsx` line 68: non-highlighted names use `text-[#CCCCCC]` (high contrast). Line 76: non-highlighted dates use `text-[#999999]`. No `opacity-50` class found anywhere in file. |
| 28 | Recent projects saved to user-chosen directories are recognized as available | VERIFIED | `WelcomeScreen.tsx` line 3: imports `pathExists` from `../../lib/ipc`. Lines 120-126: `pathExists(p.path)` calls Rust `path_exists` command (line 90 of `commands/project.rs`) which uses `std::path::Path::new(&file_path).exists()` -- no FS scope restriction. |
| 29 | Clicking a recent project in the list opens it in the editor | VERIFIED | `WelcomeScreen.tsx` lines 151-161: `handleRecentClick` checks `project.available`, then calls `projectStore.openProject(project.path)`. |

#### Plan 03-06 Truths (Gap Closure -- SortableJS Fixes)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 30 | Sequences can be deleted regardless of how many exist in the list | VERIFIED | `SequenceList.tsx` line 38: `[sequences.length]` as useEffect dep. SortableJS instance is destroyed and recreated when sequences are added/removed, preventing stale DOM refs. Delete handler at line 132. |
| 31 | Sequences can be dragged to reorder and the new order persists | VERIFIED | `SequenceList.tsx` lines 31-32: `from.removeChild(item)` then `from.insertBefore(item, from.children[oldIndex] ?? null)` reverts SortableJS DOM mutation before `sequenceStore.reorderSequences(oldIndex, newIndex)` on line 33. |
| 32 | Key photos can be added from the image picker popover at any time | VERIFIED | `KeyPhotoStrip.tsx` lines 88-111: outer `flex gap-1.5 items-start` div holds scrollable strip (line 91, `ref={stripRef}`) and `AddKeyPhotoButton` (line 109) as siblings. Button is OUTSIDE the `overflow-x-auto` container. |
| 33 | Key photos can be reordered in the strip | VERIFIED | Replaced by click-select + arrow key reorder in Plan 03-08. `sequenceStore.reorderKeyPhotos` still called from `handleKeyDown` at lines 67, 77. |

#### Plan 03-07 Truths (Gap Closure -- Portal Context Menu & forceFallback)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 34 | Context menu renders as a floating overlay without causing scrollbar in the sequence list | VERIFIED | `SequenceList.tsx` line 2: `import {createPortal} from 'preact/compat'`. Line 257: `createPortal(menuJSX, document.body)`. Line 260: context menu div uses `fixed z-50` positioning. Menu position computed from `getBoundingClientRect()` in `openMenu` function (lines 146-154). No `relative` class on SequenceItem wrapper. |
| 35 | Sequences can be dragged to reorder in the left sidebar and the new order persists | VERIFIED | `SequenceList.tsx` line 25: `forceFallback: true` in SortableJS config. Line 26: `fallbackClass: 'opacity-30'`. This uses CSS transforms + pointer events instead of native HTML5 DnD, bypassing Tauri's DnD interception. DOM revert pattern on lines 31-33 ensures Preact sees correct state. Commit `6e326bc` confirmed. |

#### Plan 03-08 Truths (Gap Closure -- Key Photo Strip UX)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 36 | Key photo strip has larger thumbnails, hidden scrollbar, and horizontal wheel scroll | VERIFIED | `KeyPhotoStrip.tsx` line 172: `w-20 h-14` (80x56px, up from 64x48). `AddKeyPhotoButton` line 256: `w-20 h-14` matches. Line 92: `scrollbar-hidden` class applied. `index.css` lines 47-53: `.scrollbar-hidden` with `scrollbar-width: none` (Firefox), `::-webkit-scrollbar { display: none }` (WebKit), `-ms-overflow-style: none` (IE/Edge). Lines 52-58: `handleWheel` converts `e.deltaY` to `scrollLeft`, calls `e.preventDefault()`. Applied at line 94. |
| 37 | Key photos can be reordered via click-to-select and arrow keys | VERIFIED | `KeyPhotoStrip.tsx` line 44: `selectedKpId` state. Lines 61-86: `handleKeyDown` handler with `ArrowLeft`/`ArrowRight` calling `sequenceStore.reorderKeyPhotos(sequenceId, idx, idx-1/idx+1)`. Lines 69-73 and 79-83: `requestAnimationFrame` + `scrollIntoView` after reorder. Line 104: `isSelected={kp.id === selectedKpId}`. Line 172: `ring-2 ring-[var(--color-accent)]` when selected. Lines 160-168: `handleCardClick` with `target.closest('button') || target.closest('input')` guard. No SortableJS import in file (confirmed by grep). Line 93: `tabIndex={0}` and `outline-none` for keyboard focus. Commits `31d6472` and `87cba92` confirmed. |

**Score: 37/37 truths verified**

---

### Required Artifacts

#### Plan 03-01 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src-tauri/src/models/project.rs` | Full MceProject model hierarchy | VERIFIED | `MceProject`, `MceSequence`, `MceKeyPhoto`, `MceImageRef` with serde derives. |
| `Application/src-tauri/src/models/sequence.rs` | Sequence re-export convenience | VERIFIED | File exists, `mod.rs` declares `pub mod sequence`. |
| `Application/src-tauri/src/services/project_io.rs` | Project I/O service | VERIFIED | `create_project_dir`, `save_project` (atomic), `open_project`, `migrate_temp_images`, 4 tests. |
| `Application/src-tauri/src/commands/project.rs` | Tauri commands | VERIFIED | 102 lines. `project_create`, `project_save`, `project_open`, `project_migrate_temp_images`, `path_exists`. |
| `Application/src/types/project.ts` | TypeScript MceProject hierarchy | VERIFIED | All four interfaces with snake_case fields. |
| `Application/src/types/sequence.ts` | Updated Sequence/KeyPhoto types | VERIFIED | `KeyPhoto.imageId` (not `imagePath`). |
| `Application/src/lib/ipc.ts` | IPC wrappers for project commands | VERIFIED | 63 lines. All project commands + `pathExists`. |
| `Application/src/lib/appConfig.ts` | AppConfig module with LazyStore | VERIFIED | 58 lines. `LazyStore` singleton, 6 exported functions. |
| `Application/src-tauri/capabilities/default.json` | store and fs permissions | VERIFIED | `"store:default"`, `"fs:default"`, `"fs:allow-exists"`. |

#### Plan 03-02 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/app.tsx` | Signal-based routing | VERIFIED | Routes between WelcomeScreen and EditorShell based on `dirPath`. |
| `Application/src/stores/projectStore.ts` | Enhanced project store | VERIFIED | `filePath`, `dirPath`, `isDirty`, `isSaving` signals. Full CRUD methods. |
| `Application/src/lib/autoSave.ts` | Auto-save module | VERIFIED | 2s debounce + 60s interval. Idempotent start guard. |
| `Application/src/lib/projectDir.ts` | Project directory management | VERIFIED | `tempProjectDir` signal. |
| `Application/src/components/project/WelcomeScreen.tsx` | Welcome screen | VERIFIED | 324 lines. Recent projects with readable text, `pathExists` validation, New/Open buttons. |
| `Application/src/components/project/NewProjectDialog.tsx` | New project dialog | VERIFIED | Name, fps toggle, folder picker, Create/Cancel. |
| `Application/src/components/layout/Toolbar.tsx` | Wired toolbar | VERIFIED | New/Open/Save buttons, dirty indicator, saving state. |
| `Application/src/components/layout/EditorShell.tsx` | Editor shell | VERIFIED | Uses `projectStore.dirPath.value ?? tempProjectDir.value`. |

#### Plan 03-03 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/stores/sequenceStore.ts` | Full sequence CRUD | VERIFIED | All sequence and key photo CRUD methods plus undo/redo. 444 lines. |
| `Application/src/types/sequence.ts` | Updated types with imageId | VERIFIED | `KeyPhoto.imageId` confirmed. |
| `Application/src/components/sequence/SequenceList.tsx` | Sortable sequence list | VERIFIED | 297 lines. SortableJS with forceFallback + DOM revert, portal context menu, drag handle, rename. |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Key photo strip with click-select reorder | VERIFIED | 293 lines. Click-select + arrow key reorder (SortableJS removed), larger thumbnails, hidden scrollbar, wheel scroll. |
| `Application/src/components/layout/LeftPanel.tsx` | Updated left panel | VERIFIED | SequenceList, KeyPhotoStrip, SequenceSettings. |

#### Plan 03-04 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/lib/dragDrop.ts` | External vs internal drag distinction | VERIFIED | `paths.length > 0` check on enter event. |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Improved popover | VERIFIED | `bottom-14`, `max-h-[300px]`, `grid-cols-4`. |

#### Plan 03-05 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src-tauri/src/commands/project.rs` | `path_exists` Tauri command | VERIFIED | Line 90: `std::path::Path::new(&file_path).exists()`. No FS scope restriction. |
| `Application/src/lib/ipc.ts` | `pathExists` IPC wrapper | VERIFIED | Line 51: `safeInvoke<boolean>('path_exists', { filePath })`. |
| `Application/src/components/project/WelcomeScreen.tsx` | Readable text colors | VERIFIED | `text-[#CCCCCC]` for names, `text-[#999999]` for dates. No `opacity-50`. |

#### Plan 03-06 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/sequence/SequenceList.tsx` | SortableJS with deps and DOM revert | VERIFIED | `[sequences.length]` dep, DOM revert in onEnd. |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Add button outside overflow | VERIFIED | Button as sibling outside overflow-x-auto strip. |

#### Plan 03-07 Artifacts (NEW)

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/sequence/SequenceList.tsx` | Portal-based context menu and forceFallback SortableJS | VERIFIED | Line 2: `createPortal` import from `preact/compat`. Line 257: `createPortal(menuJSX, document.body)`. Line 260: `fixed z-50`. Lines 146-154: `openMenu` with `getBoundingClientRect()`. Line 25: `forceFallback: true`. Line 26: `fallbackClass: 'opacity-30'`. |

#### Plan 03-08 Artifacts (NEW)

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Improved key photo strip with click-select + arrow reorder | VERIFIED | Line 44: `selectedKpId` state. Lines 61-86: `handleKeyDown` with ArrowLeft/ArrowRight. Line 172: `w-20 h-14` (80x56px). Line 92: `scrollbar-hidden`. No SortableJS import. |
| `Application/src/index.css` | Scrollbar-hidden utility class | VERIFIED | Lines 47-53: `.scrollbar-hidden` with `scrollbar-width: none` (Firefox), `::-webkit-scrollbar { display: none }` (WebKit), `-ms-overflow-style: none` (IE/Edge). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ipc.ts` | `commands/project.rs` | `safeInvoke('project_create')` etc. | WIRED | ipc.ts lines 34-48. lib.rs registers all commands. |
| `commands/project.rs` | `services/project_io.rs` | Commands delegate to project_io | WIRED | All four CRUD commands call `project_io::` functions. |
| `appConfig.ts` | `capabilities/default.json` | store:default | WIRED | Capability present. |
| `types/project.ts` | `models/project.rs` | TypeScript mirrors Rust | WIRED | Field-for-field match. |
| `app.tsx` | `stores/projectStore.ts` | isProjectOpen computed | WIRED | Checks `dirPath.value`. |
| `WelcomeScreen.tsx` | `lib/appConfig.ts` | getRecentProjects | WIRED | Line 117 in useEffect. |
| `Toolbar.tsx` | projectStore | Save chain | WIRED | handleSave -> projectStore.saveProject() -> ipcProjectSave. |
| `autoSave.ts` | `stores/projectStore.ts` | effect() watches signals | WIRED | Subscribes to multiple store signals. |
| `projectStore.ts` | `stores/sequenceStore.ts` | _setMarkDirtyCallback | WIRED | Line 379. |
| `projectStore.ts` | `lib/ipc.ts` | projectMigrateTempImages | WIRED | Import and call confirmed. |
| `SequenceList.tsx` | `stores/sequenceStore.ts` | reorderSequences via DOM revert | WIRED | Line 33: `sequenceStore.reorderSequences(oldIndex, newIndex)` after DOM revert. |
| `KeyPhotoStrip.tsx` | `stores/sequenceStore.ts` | reorderKeyPhotos via arrow keys | WIRED | Lines 67, 77: `sequenceStore.reorderKeyPhotos(sequenceId, idx, idx-1/idx+1)` in handleKeyDown. |
| `KeyPhotoStrip.tsx` | `stores/imageStore.ts` | getById + assetUrl | WIRED | Lines 134-135 in KeyPhotoCard. |
| `LeftPanel.tsx` | `SequenceList.tsx` | import + render | WIRED | Import and render confirmed. |
| `dragDrop.ts` | `DropZone.tsx` | isDraggingOver signal | WIRED | Only true when paths.length > 0. |
| `WelcomeScreen.tsx` | `lib/ipc.ts` | pathExists() call in useEffect | WIRED | Line 3: import. Line 122: `pathExists(p.path)` call. |
| `ipc.ts` | `commands/project.rs` | invoke('path_exists') | WIRED | ipc.ts line 52. |
| `SequenceList context menu` | `document.body` | createPortal rendering | WIRED | Line 257: `createPortal(menuDiv, document.body)`. (Plan 03-07) |
| `SortableJS instance` | `sequenceStore.reorderSequences` | forceFallback pointer events | WIRED | Line 25: `forceFallback: true`. Line 33: `sequenceStore.reorderSequences`. (Plan 03-07) |
| `KeyPhotoCard click` | `selectedKpId state` | onClick handler sets selected | WIRED | Line 105: `onSelect={() => setSelectedKpId(kp.id)}`. Line 174: `onClick={handleCardClick}`. (Plan 03-08) |
| `Arrow key handler` | `sequenceStore.reorderKeyPhotos` | keydown event on strip container | WIRED | Lines 65-66: `ArrowLeft` check, line 67: `sequenceStore.reorderKeyPhotos(sequenceId, idx, idx - 1)`. Lines 75-76: `ArrowRight` check, line 77: `sequenceStore.reorderKeyPhotos(sequenceId, idx, idx + 1)`. (Plan 03-08) |

---

### Requirements Coverage

Requirements from all eight plan frontmatter sections. Cross-referenced against v1.0-REQUIREMENTS.md traceability table.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROJ-01 | 03-01 | User can create a new project with name and frame rate | SATISFIED | Rust `project_create` + `NewProjectDialog` + `projectStore.createProject()` |
| PROJ-02 | 03-01 | User can save project to .mce file | SATISFIED | Rust `project_save` (atomic write) + `projectStore.saveProject()` + Toolbar Save |
| PROJ-03 | 03-01 | User can open existing .mce project files | SATISFIED | Rust `project_open` + `projectStore.openProject()` + WelcomeScreen Open |
| PROJ-04 | 03-02 | Project auto-saves on interval and significant actions | SATISFIED | `autoSave.ts`: 2s debounce effect + 60s periodic interval |
| PROJ-05 | 03-02, 03-05 | User can access recent projects list on launch | SATISFIED | `WelcomeScreen.tsx` loads from `appConfig`, validates via `pathExists` IPC (scope-free). Text contrast #CCCCCC/#999999. |
| PROJ-06 | 03-01, 03-05 | Global app config persists between sessions | SATISFIED | `appConfig.ts` LazyStore: recent projects, window prefs, last project path. |
| SEQN-01 | 03-03, 03-06, 03-07 | User can create named sequences | SATISFIED | `sequenceStore.createSequence(name)` + LeftPanel button. Plan 03-07 added portal context menu and forceFallback so sequence operations work properly in sidebar. |
| SEQN-02 | 03-03, 03-04, 03-06, 03-08 | User can duplicate, delete, and reorder sequences | SATISFIED | Full CRUD + SortableJS drag with forceFallback (Plan 03-07) and DOM revert. Portal context menu for delete/duplicate. Plan 03-08 fixed key photo reorder UX. |
| SEQN-03 | 03-03, 03-06, 03-07 | User can add key photos with configurable hold duration | SATISFIED | `addKeyPhoto` + picker popover + `updateHoldFrames`. Button outside overflow. Portal context menu fixes. |
| SEQN-04 | 03-03, 03-04, 03-06, 03-08 | User can reorder key photos within a sequence | SATISFIED | Click-to-select + ArrowLeft/ArrowRight keyboard reorder (Plan 03-08 replaced drag-and-drop per user UAT feedback). `sequenceStore.reorderKeyPhotos` still used, scrollIntoView after reorder. |
| SEQN-05 | 03-03 | User can set per-sequence frame rate and resolution | SATISFIED | `setSequenceFps`/`setSequenceResolution` + SequenceSettings UI |

**Orphaned requirements check:** v1.0-REQUIREMENTS.md maps PROJ-01 through PROJ-06 and SEQN-01 through SEQN-05 to Phase 3. All 11 claimed by plans. No orphans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `WelcomeScreen.tsx` | 144, 157 | `console.error` on failed open | INFO | Appropriate error logging. |
| `KeyPhotoStrip.tsx` | 176 | Comment "Placeholder icon when no image" | INFO | Not a placeholder implementation -- renders a `?` character as fallback when no thumbnail is available. Fully functional. |

No blocker or warning anti-patterns found. No TODO/FIXME/HACK comments in any files modified by Plans 03-07 or 03-08.

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
**Expected:** Project name is clearly readable (#CCCCCC on dark background). Project shows as available (not greyed out). Clicking it opens the project.
**Why human:** Visual contrast assessment and FS scope behavior require runtime verification.

### 4. Auto-Save Timing

**Test:** Open a project, rename a sequence, wait 2+ seconds.
**Expected:** .mce file updated on disk. Dirty indicator clears.
**Why human:** Timer-based debounce requires live observation.

### 5. Context Menu as Floating Overlay (Plan 03-07 fix)

**Test:** Create 4+ sequences. Right-click any sequence (including ones below the fold).
**Expected:** Context menu appears as floating overlay. NO scrollbar appears in the sequence list. Menu items (Rename/Duplicate/Delete) are clickable.
**Why human:** Portal rendering and position:fixed behavior need visual confirmation. Specifically checks that createPortal to document.body escapes the overflow-y-auto container.

### 6. Sequence Drag Reorder in Sidebar (Plan 03-07 fix)

**Test:** Create 3+ sequences. Drag a sequence by its grip handle to a new position in the left sidebar.
**Expected:** Sequence moves smoothly (CSS transform ghost, not native HTML5 DnD ghost). New position persists after drop. No file import overlay appears.
**Why human:** forceFallback behavior in Tauri WebView requires runtime verification. This was the core UAT-r2 test 3 failure.

### 7. Key Photo Strip Larger Thumbnails and Scroll (Plan 03-08 fix)

**Test:** Add 5+ key photos to a sequence. Observe the strip area.
**Expected:** Thumbnails are 80x56px (noticeably larger than before). No visible scrollbar. Vertical mouse wheel scrolls the strip horizontally.
**Why human:** Visual size comparison, scrollbar visibility, and wheel-to-horizontal behavior need live observation.

### 8. Key Photo Click-Select and Arrow Reorder (Plan 03-08 fix)

**Test:** Add 3+ key photos. Click a key photo in the strip.
**Expected:** Clicked photo shows an accent-colored ring border. Press ArrowRight -- photo moves one position right. Press ArrowLeft -- photo moves one position left. Strip auto-scrolls to keep the selected photo visible.
**Why human:** Keyboard interaction, visual selection ring, and scroll-into-view after reorder need runtime verification. This replaced drag-and-drop per user's UAT suggestion.

### 9. Key Photo Add Button Always Works

**Test:** Select a sequence. Add key photos (1st, 2nd, 3rd). Delete one, add again.
**Expected:** Add button works every time. Popover opens upward, not clipped by overflow.
**Why human:** Popover positioning relative to overflow container requires visual confirmation.

### 10. External File Drag-and-Drop Still Works

**Test:** Drag image files from Finder onto the app window.
**Expected:** Import overlay appears. Files are imported normally.
**Why human:** Tauri drag event integration requires runtime verification.

---

### Gaps Summary

No gaps found. All 37 must-have truths across eight plans are verified against the actual codebase. All 11 requirements (PROJ-01 through PROJ-06, SEQN-01 through SEQN-05) are satisfied. All 21 key links are wired.

**Plan 03-07 gap closure confirmed:**
- Context menu now renders via `createPortal(menuJSX, document.body)` with `position: fixed` -- completely escapes the overflow-y-auto container, eliminating the scrollbar issue (UAT-r2 test 2).
- SortableJS uses `forceFallback: true` -- bypasses Tauri's HTML5 DnD interception with CSS transforms + pointer events (UAT-r2 test 3).

**Plan 03-08 gap closure confirmed:**
- Key photo thumbnails enlarged from 64x48px to 80x56px for better visibility (UAT-r2 test 4).
- Scrollbar hidden via `.scrollbar-hidden` CSS utility; `onWheel` handler converts vertical scroll to horizontal (UAT-r2 test 4).
- SortableJS removed entirely from KeyPhotoStrip; replaced with click-to-select + ArrowLeft/ArrowRight keyboard reorder per user's UAT suggestion (UAT-r2 test 5).

No regressions detected in the previous 33 truths. The phase goal is fully achieved.

---

*Verified: 2026-03-09T13:49:47Z*
*Verifier: Claude (gsd-verifier)*
