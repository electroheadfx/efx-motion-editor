---
phase: 03-project-sequence-management
verified: 2026-03-03T12:00:00Z
status: passed
score: 22/22 must-haves verified
re_verification: false
---

# Phase 03: Project & Sequence Management Verification Report

**Phase Goal:** Users can create, save, open, and auto-save projects in .mce format, manage sequences with key photos, and pick up recent projects on launch
**Verified:** 2026-03-03T12:00:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

All truths are drawn directly from the three plan must_haves frontmatter sections (03-01, 03-02, 03-03).

#### Plan 03-01 Truths (Backend & Persistence)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Rust project_create command creates a project directory with images/ and images/.thumbs/ subdirectories and returns a serializable MceProject struct | VERIFIED | `commands/project.rs` calls `project_io::create_project_dir`, returns `MceProject`. `project_io.rs` test `test_create_project_dir_creates_subdirectories` confirms subdirectories. |
| 2 | Rust project_save command writes the .mce JSON file atomically (temp file + rename) with all project state | VERIFIED | `project_io.rs` line 23-31: writes to `{path}.tmp`, then `fs::rename`. Test `test_atomic_write_creates_no_temp_file` confirms temp file gone after save. |
| 3 | Rust project_open command reads a .mce file, validates it, and returns the full MceProject struct to the frontend | VERIFIED | `project_io::open_project` reads file, deserializes via `serde_json::from_str`, returns `MceProject`. Roundtrip test confirms. |
| 4 | Image paths stored in .mce files are relative to the project root; absolute paths are never persisted in the file | VERIFIED | `save_project` signature accepts `project_root`. `make_relative`/`make_absolute` helpers exist with passing tests. `open_project` docs confirm paths remain relative for frontend resolution. |
| 5 | tauri-plugin-store is installed and registered for persistent app config | VERIFIED | `Cargo.toml` line 23: `tauri-plugin-store = "2"`. `lib.rs` line 13: `.plugin(tauri_plugin_store::Builder::default().build())`. `capabilities/default.json` includes `"store:default"`. |
| 6 | tauri-plugin-fs is installed and registered for frontend file existence checks | VERIFIED | `Cargo.toml` line 24: `tauri-plugin-fs = "2"`. `lib.rs` line 14: `.plugin(tauri_plugin_fs::init())`. `capabilities/default.json` includes `"fs:default"`. |
| 7 | TypeScript MceProject, MceSequence, MceKeyPhoto, MceImageRef types mirror Rust structs exactly | VERIFIED | `types/project.ts` has all four interfaces with snake_case fields matching Rust serde output field-for-field (version, name, fps, width, height, created_at, modified_at, sequences, images; id, image_id, hold_frames, order; id, original_filename, relative_path, thumbnail_relative_path). |
| 8 | IPC wrappers exist for project_create, project_save, and project_open commands | VERIFIED | `ipc.ts` lines 31-44: `projectCreate`, `projectSave`, `projectOpen`, and also `projectMigrateTempImages`. All use `safeInvoke`. |
| 9 | AppConfig module wraps tauri-plugin-store LazyStore for recent projects and window preferences persistence | VERIFIED | `appConfig.ts`: `LazyStore` singleton, `getRecentProjects`, `addRecentProject`, `removeRecentProject`, `getAppConfig`, `setLastProjectPath`, `setWindowSize` -- all implemented substantively. |

#### Plan 03-02 Truths (Project Management UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | App launches to a WelcomeScreen showing recent projects, 'New Project', and 'Open Project' buttons | VERIFIED | `app.tsx` routes to `<WelcomeScreen />` when `projectStore.dirPath.value === null`. `WelcomeScreen.tsx` has "New Project" button (`onClick={() => setShowNewDialog(true)}`), "Open Project" button (`onClick={handleOpenProject}`), and recent projects list loaded from `getRecentProjects()`. |
| 11 | User can create a new project by entering name and selecting fps, which creates a project directory via Rust and transitions to the editor | VERIFIED | `NewProjectDialog.tsx`: name input, fps toggle (15/24), folder picker via `openDialog({directory: true})`. On Create calls `projectStore.createProject()` then `saveProjectAs()`. App.tsx computed routes to EditorShell when `dirPath != null`. |
| 12 | User can open an existing .mce file via file dialog, which loads all project data into stores and transitions to the editor | VERIFIED | `WelcomeScreen.tsx` `handleOpenProject`: calls `open()` with `.mce` filter, then `projectStore.openProject(selected)`. `projectStore.openProject` calls `ipcProjectOpen`, runs `hydrateFromMce` which populates projectStore, imageStore, sequenceStore. |
| 13 | User can click a recent project entry on the welcome screen to open it directly | VERIFIED | `WelcomeScreen.tsx` `handleRecentClick`: checks `project.available`, calls `projectStore.openProject(project.path)`. |
| 14 | Recent projects list shows entries from tauri-plugin-store and marks missing files as unavailable | VERIFIED | `WelcomeScreen.tsx` useEffect: loads from `getRecentProjects()`, validates each with `exists(p.path)` from `@tauri-apps/plugin-fs`, sets `available` flag. Missing entries show "Not found" and have `opacity-50`. |
| 15 | Toolbar Save button serializes current store state to the .mce file via Rust project_save command | VERIFIED | `Toolbar.tsx` `handleSave`: calls `projectStore.saveProject()` (which calls `ipcProjectSave` -> `project_save` Rust command) or `saveProjectAs()` if never saved. Confirmed via `projectStore.ts` lines 192-196. |
| 16 | Auto-save triggers after a 2-second debounce when project/sequence stores change | VERIFIED | `autoSave.ts`: `effect()` subscribes to store signals, calls `scheduleSave()` which uses `setTimeout(..., 2000)`. |
| 17 | Auto-save also runs every 60 seconds as a safety net if the project is dirty | VERIFIED | `autoSave.ts` line 38-43: `setInterval(() => {...}, 60_000)` checks `isDirty.value`. |
| 18 | Project file path and dirty flag are tracked in projectStore | VERIFIED | `projectStore.ts`: `filePath = signal<string | null>(null)` (line 20), `isDirty = signal(false)` (line 26). Both exposed on store object (lines 122-125). |
| 19 | Images previously in temp dir are migrated to real project dir on project creation | VERIFIED | `projectStore.createProject()` calls `projectMigrateTempImages(tempDir, projectDirPath)` then `imageStore.updateProjectPaths(tempDir, projectDirPath)`. Rust `migrate_temp_images` in `project_io.rs` moves files with rename+copy fallback. |
| 20 | markDirty callback is registered: sequenceStore mutations set projectStore.isDirty to true | VERIFIED | `sequenceStore.ts` exports `_setMarkDirtyCallback`. `projectStore.ts` line 284: `_setMarkDirtyCallback(() => projectStore.markDirty())` called at module load. All 10 sequenceStore mutation methods call `markDirty()`. |

#### Plan 03-03 Truths (Sequence Management UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 21 | User can create, duplicate, delete, and reorder sequences via drag-and-drop | VERIFIED | `sequenceStore.ts`: `createSequence`, `duplicate`, `remove`, `reorderSequences` all implemented. `SequenceList.tsx` uses SortableJS with `onEnd` callback calling `sequenceStore.reorderSequences(evt.oldIndex, evt.newIndex)`. Context menu wires Rename/Duplicate/Delete. |
| 22 | User can add key photos, change hold duration, reorder, and remove key photos; user can set per-sequence fps and resolution | VERIFIED | `sequenceStore.ts`: `addKeyPhoto`, `removeKeyPhoto`, `reorderKeyPhotos`, `updateHoldFrames`, `setSequenceFps`, `setSequenceResolution` all implemented. `KeyPhotoStrip.tsx` renders thumbnails via `assetUrl(image.thumbnail_path)`, horizontal SortableJS reorder, inline hold frame editing, remove button. `LeftPanel.tsx` `SequenceSettings` component has fps toggle (15/24) and resolution dropdown. |

**Score: 22/22 truths verified**

---

### Required Artifacts

#### Plan 03-01 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src-tauri/src/models/project.rs` | Full MceProject model hierarchy | VERIFIED | File exists (58 lines), contains `MceProject`, `MceSequence`, `MceKeyPhoto`, `MceImageRef` with serde derives. |
| `Application/src-tauri/src/models/sequence.rs` | Sequence re-export convenience | VERIFIED | File exists, re-exports `MceSequence`, `MceKeyPhoto` from project.rs. |
| `Application/src-tauri/src/services/project_io.rs` | Project I/O service | VERIFIED | 223 lines. Contains `create_project_dir`, `save_project` (atomic write), `open_project`, `make_relative`, `make_absolute`, `migrate_temp_images`, `move_file`, 4 inline tests. |
| `Application/src-tauri/src/commands/project.rs` | Tauri commands: project_create, project_save, project_open | VERIFIED | Exports `project_create`, `project_save`, `project_open`, `project_migrate_temp_images`. All delegate to `project_io` service. Asset scope registration on create/open. |
| `Application/src/types/project.ts` | TypeScript MceProject type hierarchy | VERIFIED | 51 lines. Contains `MceProject`, `MceSequence`, `MceKeyPhoto`, `MceImageRef` with snake_case fields. |
| `Application/src/types/sequence.ts` | Updated Sequence/KeyPhoto types | VERIFIED | `KeyPhoto` uses `imageId` (not `imagePath`). `MceKeyPhoto` reference comment present. |
| `Application/src/lib/ipc.ts` | IPC wrappers for project commands | VERIFIED | Contains `projectCreate`, `projectSave`, `projectOpen`, `projectMigrateTempImages`. |
| `Application/src/lib/appConfig.ts` | AppConfig module with LazyStore | VERIFIED | 58 lines. `LazyStore` singleton, 6 exported functions for recent projects and app config. |
| `Application/src-tauri/capabilities/default.json` | Capabilities with store and fs permissions | VERIFIED | Contains `"store:default"` and `"fs:default"`. |

#### Plan 03-02 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/app.tsx` | Signal-based routing | VERIFIED | `isProjectOpen = computed(() => projectStore.dirPath.value !== null)`. Routes to EditorShell or WelcomeScreen. |
| `Application/src/stores/projectStore.ts` | Enhanced project store | VERIFIED | 285 lines. `filePath`, `dirPath`, `isDirty`, `isSaving` signals. `createProject`, `saveProject`, `openProject`, `saveProjectAs`, `closeProject`, `buildMceProject`, `hydrateFromMce` all implemented. |
| `Application/src/lib/autoSave.ts` | Auto-save module | VERIFIED | 61 lines. `startAutoSave`/`stopAutoSave`. 2s debounce via `effect()` + `setTimeout`. 60s interval. Guards: only fires when `filePath` set and `isDirty` true. Note: `scheduleSave` is the debounce function (plan named it `debouncedSave` -- same mechanism, different name). |
| `Application/src/lib/projectDir.ts` | Project directory management | VERIFIED (kept minimal per plan deviation note) | Plan decision to keep minimal: `projectStore.dirPath ?? tempProjectDir` used at call sites. |
| `Application/src/components/project/WelcomeScreen.tsx` | Welcome screen | VERIFIED | 323 lines. Real recent projects from `appConfig`, file existence validation via `plugin-fs`, New/Open buttons, recent project click handling. |
| `Application/src/components/project/NewProjectDialog.tsx` | New project dialog | VERIFIED | 190 lines. Name input (auto-focused), fps toggle (15/24), directory picker, Create/Cancel buttons. Calls `projectStore.createProject` then `saveProjectAs`. |
| `Application/src/components/layout/Toolbar.tsx` | Wired toolbar | VERIFIED | New/Open/Save buttons wired to projectStore methods. Save shows "Saving..." via `isSaving.value`. Dirty indicator dot via `isDirty.value`. "Set Folder" button removed. Note: `contains: project_save` in plan is satisfied via `projectStore.saveProject()` which calls `ipcProjectSave` -> Rust `project_save`. No direct string "project_save" in Toolbar; the functional wiring is correct. |
| `Application/src/components/layout/EditorShell.tsx` | Editor shell with real project dir | VERIFIED | Line 15: `const dir = projectStore.dirPath.value ?? tempProjectDir.value`. |

#### Plan 03-03 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/stores/sequenceStore.ts` | Full sequence CRUD | VERIFIED | 197 lines. `createSequence`, `duplicate`, `reorderSequences`, `rename`, `setSequenceFps`, `setSequenceResolution`, `addKeyPhoto`, `removeKeyPhoto`, `reorderKeyPhotos`, `updateHoldFrames`. All mutation methods call `markDirty()`. |
| `Application/src/types/sequence.ts` | Updated types with imageId | VERIFIED | `KeyPhoto.imageId` (not `imagePath`). Confirmed. |
| `Application/src/components/sequence/SequenceList.tsx` | Sortable sequence list | VERIFIED | SortableJS (`import Sortable from 'sortablejs'`), drag handle `.seq-drag-handle`, `onEnd` -> `reorderSequences`. Inline rename (double-click), context menu (Rename/Duplicate/Delete with confirmation). First key photo thumbnail display. |
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Sortable key photo strip | VERIFIED | Horizontal SortableJS, `draggable: '.kp-card'`, `onEnd` -> `reorderKeyPhotos`. Thumbnails via `assetUrl(image.thumbnail_path)`. Hold frame inline editing (click badge -> input). Remove button (visible on hover). Image picker popover for adding photos. |
| `Application/src/components/layout/LeftPanel.tsx` | Updated left panel | VERIFIED | Uses `<SequenceList />` and `<KeyPhotoStrip />`. Sequence mock data removed (only layer mock data remains with Phase 5 TODO comment). "+ Add" button calls `sequenceStore.createSequence`. `<SequenceSettings />` component provides fps toggle and resolution dropdown. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ipc.ts` | `commands/project.rs` | `invoke('project_create')`, `invoke('project_save')`, `invoke('project_open')` | WIRED | `ipc.ts` lines 31-44: `safeInvoke('project_create', ...)`, `safeInvoke('project_save', ...)`, `safeInvoke('project_open', ...)`. Commands registered in `lib.rs` invoke_handler. |
| `commands/project.rs` | `services/project_io.rs` | Commands delegate to project_io | WIRED | All four commands call `project_io::` functions directly. |
| `appConfig.ts` | `capabilities/default.json` | tauri-plugin-store requires store:default | WIRED | `capabilities/default.json` includes `"store:default"`. `appConfig.ts` uses `LazyStore`. |
| `types/project.ts` | `models/project.rs` | TypeScript MceProject mirrors Rust MceProject | WIRED | Field-for-field match confirmed: version, name, fps, width, height, created_at, modified_at, sequences, images. Snake_case throughout. |
| `app.tsx` | `stores/projectStore.ts` | `computed isProjectOpen checks projectStore.dirPath` | WIRED | `app.tsx` line 6: `computed(() => projectStore.dirPath.value !== null)`. |
| `WelcomeScreen.tsx` | `lib/appConfig.ts` | Reads recent projects from appConfig on mount | WIRED | Line 117: `getRecentProjects()` called inside `useEffect`. |
| `Toolbar.tsx` | `lib/ipc.ts` (via projectStore) | Save button calls projectSave via IPC | WIRED | Toolbar -> `projectStore.saveProject()` -> `ipcProjectSave(project, filePath)` -> `safeInvoke('project_save', ...)`. Functionally wired; not a direct ipc.ts import in Toolbar. |
| `autoSave.ts` | `stores/projectStore.ts` | effect() watches projectStore signals | WIRED | Lines 28-32: accesses `projectStore.name.value`, `projectStore.fps.value`, etc. inside `effect()`. |
| `projectStore.ts` | `stores/sequenceStore.ts` | `_setMarkDirtyCallback` wired | WIRED | Line 6: imports `_setMarkDirtyCallback`. Line 284: `_setMarkDirtyCallback(() => projectStore.markDirty())`. |
| `projectStore.ts` | `lib/ipc.ts` | `projectMigrateTempImages` IPC after project creation | WIRED | Line 4: `import {..., projectMigrateTempImages}`. `createProject()` calls it at line 165. |
| `SequenceList.tsx` | `stores/sequenceStore.ts` | SortableJS onEnd -> reorderSequences | WIRED | Line 24: `sequenceStore.reorderSequences(evt.oldIndex, evt.newIndex)`. |
| `KeyPhotoStrip.tsx` | `stores/sequenceStore.ts` | SortableJS onEnd -> reorderKeyPhotos | WIRED | Line 56: `sequenceStore.reorderKeyPhotos(sequenceId, evt.oldIndex, evt.newIndex)`. |
| `KeyPhotoStrip.tsx` | `stores/imageStore.ts` | Thumbnails via imageStore for each keyPhoto's imageId | WIRED | Line 89: `imageStore.getById(imageId)`. Line 90: `assetUrl(image.thumbnail_path)`. |
| `LeftPanel.tsx` | `components/sequence/SequenceList.tsx` | LeftPanel renders SequenceList | WIRED | Line 9: `import {SequenceList}`. Line 105: `<SequenceList />`. |

---

### Requirements Coverage

All requirements listed in the prompt are accounted for across the three plans:

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROJ-01 | 03-01 | User can create a new project with name and frame rate | SATISFIED | `project_create` Rust command + `NewProjectDialog` + `projectStore.createProject()` |
| PROJ-02 | 03-01 | User can save project to .mce file | SATISFIED | `project_save` Rust command (atomic write) + `projectStore.saveProject()` + Toolbar Save button |
| PROJ-03 | 03-01 | User can open existing .mce project files | SATISFIED | `project_open` Rust command + `projectStore.openProject()` + WelcomeScreen Open button |
| PROJ-04 | 03-02 | Project auto-saves on interval and significant actions | SATISFIED | `autoSave.ts`: 2s debounce effect + 60s periodic interval, both guarded by `filePath` and `isDirty` |
| PROJ-05 | 03-02 | User can access recent projects list on launch | SATISFIED | `WelcomeScreen.tsx` loads from `appConfig.getRecentProjects()`, validates existence, renders list |
| PROJ-06 | 03-01 | Global app config persists between sessions | SATISFIED | `appConfig.ts` LazyStore: recent projects (max 10, dedup), window prefs, last project path |
| SEQN-01 | 03-03 | User can create named sequences | SATISFIED | `sequenceStore.createSequence(name)` + LeftPanel "+ Add" button |
| SEQN-02 | 03-03 | User can duplicate, delete, and reorder sequences | SATISFIED | `sequenceStore.duplicate/remove/reorderSequences` + SequenceList context menu + SortableJS drag |
| SEQN-03 | 03-03 | User can add key photos with configurable hold duration | SATISFIED | `sequenceStore.addKeyPhoto(seqId, imageId, 4)` + KeyPhotoStrip image picker + `updateHoldFrames` |
| SEQN-04 | 03-03 | User can reorder key photos within a sequence via drag | SATISFIED | `sequenceStore.reorderKeyPhotos` + KeyPhotoStrip horizontal SortableJS |
| SEQN-05 | 03-03 | User can set per-sequence frame rate and resolution | SATISFIED | `sequenceStore.setSequenceFps/setSequenceResolution` + LeftPanel `SequenceSettings` component (fps toggle + resolution dropdown) |

**Orphaned requirements check:** REQUIREMENTS.md traceability table maps only PROJ-01 through PROJ-06 and SEQN-01 through SEQN-05 to Phase 3. All 11 are claimed by the three plans. No orphans found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `LeftPanel.tsx` | 13, 137 | `TODO(Phase 5)` for layer mock data | INFO | Intentional -- layer mock data kept for visual completeness per plan decision. Non-blocking for phase 3 goal. |
| `Toolbar.tsx` | 18, 36, 43 | `console.error` on failed open/save | INFO | Appropriate error logging, not a stub. Errors surface to Tauri console for debugging. |
| `WelcomeScreen.tsx` | 143, 156 | `console.error` on failed open | INFO | Same -- appropriate error logging. |

No blocker or warning anti-patterns found. All `console.error` calls are proper error handling, not stub implementations.

**Note on Toolbar `contains: project_save` artifact check:** The PLAN frontmatter specifies `contains: "project_save"` for `Toolbar.tsx`. The literal string `"project_save"` does not appear in Toolbar.tsx -- instead, Toolbar calls `projectStore.saveProject()` which internally calls `ipcProjectSave` which calls `safeInvoke('project_save', ...)`. The functional wiring is correct and the save path is fully implemented end-to-end. This is a naming mismatch in the artifact spec, not a real gap.

**Note on autoSave `contains: debouncedSave` artifact check:** The PLAN frontmatter for `autoSave.ts` specifies `contains: "debouncedSave"`. The actual implementation uses `scheduleSave` as the debounce function name. Functionally identical -- the 2s `setTimeout` debounce pattern is correctly implemented. Different name, same mechanism.

---

### Human Verification Required

The following items require runtime testing to fully confirm:

**1. New Project Flow End-to-End**
- Test: Launch app, click "New Project", enter name, select fps, choose folder, click Create
- Expected: Project directory created on disk with images/ and images/.thumbs/ subdirectories; .mce file saved; app transitions to EditorShell
- Why human: File system creation and dialog interaction cannot be verified programmatically

**2. Open Project Flow End-to-End**
- Test: Create a project, close app, relaunch, click "Open Project", select the .mce file
- Expected: All project data (sequences, key photos, images) restored; editor shows correct state
- Why human: Round-trip deserialization across app restarts requires runtime verification

**3. Recent Projects Persistence**
- Test: Create or open a project, close app, relaunch
- Expected: Welcome screen shows the project in recent projects list with correct name and time
- Why human: tauri-plugin-store persistence requires actual app restart cycle

**4. Auto-Save Timing**
- Test: Open a project with filePath set, make a change (e.g., rename a sequence), wait 2 seconds
- Expected: .mce file on disk is updated automatically
- Why human: Timer-based behavior requires live observation

**5. Temp Image Migration**
- Test: Import images before creating a project, then create a new project
- Expected: Images appear in the new project directory (not temp dir); thumbnails still display
- Why human: File system migration with path updates requires runtime verification

**6. SortableJS Drag-and-Drop Visual Behavior**
- Test: Drag a sequence to a new position in the list; drag a key photo within the strip
- Expected: Smooth animation (150ms), correct reorder with no visual jitter after Preact re-render
- Why human: DOM sync between SortableJS and Preact's virtual DOM requires visual inspection

---

### Gaps Summary

No gaps found. All 22 must-have truths are verified against the actual codebase. All 11 requirements (PROJ-01 through PROJ-06, SEQN-01 through SEQN-05) are satisfied by substantive implementations. Key links are wired. No blocker anti-patterns detected.

The phase goal is achieved: users can create, save, open, and auto-save projects in .mce format; manage sequences with key photos and drag-drop reorder; and pick up recent projects on launch.

---

*Verified: 2026-03-03*
*Verifier: Claude (gsd-verifier)*
