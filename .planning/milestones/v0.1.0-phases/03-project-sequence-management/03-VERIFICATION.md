---
phase: 03-project-sequence-management
verified: 2026-03-09T16:30:00Z
status: passed
score: 42/42 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 37/37
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 03: Project & Sequence Management Verification Report

**Phase Goal:** Users can create, save, open, and auto-save projects in .mce format, manage sequences with key photos, and pick up recent projects on launch
**Verified:** 2026-03-09T16:30:00Z
**Status:** PASSED
**Re-verification:** Yes -- after Plans 03-09 and 03-10 (UAT round 3 gap closure for key photo strip button relocation and header bar controls)

---

## Goal Achievement

### Success Criteria Verification

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| SC-1 | User can create a new project with a name and frame rate (15 or 24 fps) and see it reflected in the UI | VERIFIED | `NewProjectDialog.tsx` (190 lines): name input, fps toggle 15/24, folder picker. Calls `projectStore.createProject()`. Rust `project_create` creates dir + returns `MceProject`. `app.tsx` routes to `EditorShell` when `dirPath` is non-null. |
| SC-2 | User can save the project to a .mce file and re-open it with all data intact (sequences, images, settings) | VERIFIED | `Toolbar.tsx` line 33-55: `handleSave` calls `saveProject()` or `saveProjectAs()`. Rust `project_save` uses atomic write (temp+rename). `project_open` deserializes `MceProject`. `hydrateFromMce` restores sequences, images, layers into stores. Roundtrip test in `project_io.rs` confirms. |
| SC-3 | Project auto-saves periodically and on significant actions without user intervention | VERIFIED | `autoSave.ts`: 2s debounce effect (line 13 `setTimeout(..., 2000)`) watches `projectStore.name`, `fps`, `width`, `height`, `sequenceStore.sequences`, `imageStore.images`. 60s interval safety net (line 44 `setInterval(..., 60_000)`). Both check `filePath` and `isDirty`. |
| SC-4 | User sees a recent projects list on launch and can open any previous project from it | VERIFIED | `WelcomeScreen.tsx` line 117: loads `getRecentProjects()`. Lines 119-126: validates each with `pathExists(p.path)` IPC. Line 151-161: `handleRecentClick` calls `projectStore.openProject()`. Text contrast `#CCCCCC`/`#999999` on dark bg. |
| SC-5 | User can create named sequences, add key photos with configurable hold duration, and reorder both sequences and photos via drag | VERIFIED | `sequenceStore.ts`: `createSequence`, `addKeyPhoto`, `updateHoldFrames`, `reorderSequences`, `reorderKeyPhotos`. `SequenceList.tsx`: SortableJS with `forceFallback:true`, portal context menu with Rename/Duplicate/Delete. `KeyPhotoStrip.tsx`: SortableJS drag + header bar move buttons (Plan 03-10). |

**Score: 5/5 success criteria verified**

---

### Observable Truths

All truths from Plans 03-01 through 03-10, organized by plan.

#### Plans 03-01 through 03-08 Truths (Previously Verified, Regression-Checked)

| # | Truth | Status | Regression Check |
|---|-------|--------|------------------|
| 1 | Rust project_create creates project directory with images/ and images/.thumbs/ subdirs | VERIFIED | `project_io.rs` lines 6-18 unchanged. Test present. |
| 2 | Rust project_save writes .mce JSON atomically (temp+rename) | VERIFIED | `project_io.rs` lines 23-37 unchanged. |
| 3 | Rust project_open reads .mce and returns MceProject | VERIFIED | `project_io.rs` lines 41-48 unchanged. |
| 4 | Image paths in .mce are relative (never absolute) | VERIFIED | `MceImageRef` fields: `relative_path`, `thumbnail_relative_path`. |
| 5 | tauri-plugin-store installed and registered | VERIFIED | `Cargo.toml` line 23. `lib.rs` plugin registration confirmed. |
| 6 | tauri-plugin-fs installed and registered | VERIFIED | `Cargo.toml` line 24. `lib.rs` plugin registration confirmed. |
| 7 | TypeScript MceProject types mirror Rust structs | VERIFIED | `types/project.ts` all 7 interfaces with snake_case fields. |
| 8 | IPC wrappers for all project commands | VERIFIED | `ipc.ts` lines 34-53: 5 project commands + `pathExists`. |
| 9 | AppConfig module with LazyStore | VERIFIED | `appConfig.ts` 58 lines: 6 exported functions. |
| 10 | App launches to WelcomeScreen | VERIFIED | `app.tsx` line 9: routes on `dirPath.value`. |
| 11 | New project creation with name/fps | VERIFIED | `NewProjectDialog.tsx` 190 lines. |
| 12 | Open .mce via file dialog | VERIFIED | `WelcomeScreen.tsx` lines 134-148. |
| 13 | Click recent project to open | VERIFIED | `WelcomeScreen.tsx` lines 151-161. |
| 14 | Recent projects mark missing files unavailable | VERIFIED | `pathExists` IPC validation, "Not found" display. |
| 15 | Toolbar Save button wired | VERIFIED | `Toolbar.tsx` lines 33-55: `saveProject()`/`saveProjectAs()`. |
| 16 | Auto-save 2s debounce | VERIFIED | `autoSave.ts` line 13: `setTimeout(..., 2000)`. |
| 17 | Auto-save 60s safety interval | VERIFIED | `autoSave.ts` line 44: `setInterval(..., 60_000)`. |
| 18 | filePath and isDirty tracked | VERIFIED | `projectStore.ts` lines 28, 34. |
| 19 | Temp images migrated on creation | VERIFIED | `projectStore.createProject()` calls `projectMigrateTempImages`. |
| 20 | markDirty callback registered | VERIFIED | `projectStore.ts` line 379: `_setMarkDirtyCallback`. |
| 21 | Sequence CRUD and reorder | VERIFIED | `sequenceStore.ts`: all methods present. `SequenceList.tsx`: SortableJS + portal menu. |
| 22 | Key photo add/remove/hold/reorder/fps/resolution | VERIFIED | All methods in `sequenceStore.ts`. Updated UI via Plans 03-09/03-10. |
| 23 | Key photo reorder does not trigger file import overlay | VERIFIED | `dragDrop.ts` line 44: `paths.length > 0` check. |
| 24 | Sequence drag does not trigger import overlay | VERIFIED | `forceFallback:true` uses pointer events, not HTML5 DnD. |
| 25 | Key photo image picker popover usable | VERIFIED | `KeyPhotoStrip.tsx` line 216: `top-7`, `max-h-[300px]`, `right-0`. Popover now in header context (Plan 03-10). |
| 26 | External file drag-and-drop still works | VERIFIED | `dragDrop.ts` `paths.length > 0` check preserves real OS file drags. |
| 27 | Recent projects text readable | VERIFIED | `WelcomeScreen.tsx` line 69: `text-[#CCCCCC]`, line 78: `text-[#999999]`. |
| 28 | Recent projects in user dirs recognized | VERIFIED | `path_exists` uses `std::path::Path::new().exists()` (no scope). |
| 29 | Click recent opens in editor | VERIFIED | `handleRecentClick` calls `projectStore.openProject()`. |
| 30 | Sequences deletable regardless of count | VERIFIED | `SequenceList.tsx` line 38: `[sequences.length]` dep recreates SortableJS. |
| 31 | Sequence drag reorder persists | VERIFIED | DOM revert pattern lines 31-33 + `reorderSequences`. |
| 32 | Key photos addable from picker | VERIFIED | `AddKeyPhotoButton` exported from `KeyPhotoStrip.tsx`, rendered in LeftPanel header. |
| 33 | Key photos reorderable | VERIFIED | SortableJS drag (line 55-71) + header bar move buttons (Plan 03-10). |
| 34 | Context menu as floating overlay (portal) | VERIFIED | `SequenceList.tsx` line 257: `createPortal(menuJSX, document.body)`. `fixed z-50`. |
| 35 | Sequence drag with forceFallback | VERIFIED | `SequenceList.tsx` line 25: `forceFallback: true`. |
| 36 | Key photo strip scrollbar hidden + wheel scroll | VERIFIED | `KeyPhotoStrip.tsx` line 77: `scrollbar-hidden` class. Lines 44-50: `handleWheel`. `index.css` line 47: `.scrollbar-hidden`. |
| 37 | Key photos reorderable (updated from arrow keys to buttons) | VERIFIED | SortableJS drag + header bar `<` `>` buttons (Plans 03-09/03-10 replaced arrow keys). |

#### Plan 03-09 Truths (Previously Verified in 03-09-VERIFICATION.md, Regression-Checked Against 03-10)

| # | Truth | Status | Regression Check |
|---|-------|--------|------------------|
| 38 | Add button at left/start of strip | SUPERSEDED by 03-10 | Plan 03-10 moved add button to header bar. Add button no longer in strip body. Empty state shows "No key photos yet" (line 23). Populated state has no add button in strip (line 74-90). This is the intended 03-10 behavior. |
| 39 | Strip fits 3 thumbnails | VERIFIED | Cards are `w-[72px]` (line 130). Gap `gap-1` (4px). 3 cards at 72px + 2 gaps = 224px fits in panel. |
| 40 | SortableJS drag reorder without timeline interference | VERIFIED | `KeyPhotoStrip.tsx` line 2: `import Sortable from 'sortablejs'`. Lines 55-71: SortableJS with `forceFallback: true`, `direction: 'horizontal'`, DOM revert pattern. |

Note: Plan 03-09 truths 4 (hover move buttons on cards) and 5 (arrow keys removed) were superseded by Plan 03-10, which moved buttons to the header bar and removed card overlay buttons. These are verified under 03-10 truths below.

#### Plan 03-10 Truths (New -- Full Verification)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 38 | The '+' add button appears in the KEY PHOTOS header bar at the right, not inside the thumbnail strip | VERIFIED | `LeftPanel.tsx` line 52: `<AddKeyPhotoButton sequenceId={activeSeq.id} />` inside header bar div. `KeyPhotoStrip.tsx` line 177: `export function AddKeyPhotoButton` (named export). No `AddKeyPhotoButton` rendered inside `KeyPhotoStripInner` or empty state. |
| 39 | Clicking a key photo card selects it with a visible ring highlight | VERIFIED | `KeyPhotoStrip.tsx` line 111: `isSelected = sequenceStore.selectedKeyPhotoId.value === keyPhotoId`. Line 132: `onClick={() => sequenceStore.selectKeyPhoto(keyPhotoId)}`. Line 130: `ring-1 ring-[var(--color-accent)]` when `isSelected`. |
| 40 | Move left, delete, and move right buttons appear in header bar when selected | VERIFIED | `LeftPanel.tsx` line 50: `<KeyPhotoHeaderActions sequenceId={activeSeq.id} />`. Lines 145-191: `KeyPhotoHeaderActions` component reads `selectedKeyPhotoId.value`, returns null when no selection. Lines 165-171: move-left button. Lines 174-180: delete button. Lines 183-188: move-right button. All call `sequenceStore.reorderKeyPhotos` or `removeKeyPhoto`. |
| 41 | Header layout is KEY PHOTOS [< X >] [+] with move/delete only when selected | VERIFIED | `LeftPanel.tsx` lines 44-54: header contains "KEY PHOTOS" label left, `flex items-center gap-1` right with `KeyPhotoHeaderActions` (conditional) + `AddKeyPhotoButton` (always). `KeyPhotoHeaderActions` returns null when `selectedId` is null (line 147). |
| 42 | Selecting different sequence or removing selected key photo clears selection | VERIFIED | `sequenceStore.ts` line 430: `setActive()` sets `selectedKeyPhotoId.value = null`. Line 251-253: `removeKeyPhoto()` clears if removed ID matches. Line 456: `reset()` clears in batch. |

**Score: 42/42 truths verified (37 previously verified + 5 new from 03-10, with 03-09 truths consolidated)**

---

### Required Artifacts

#### Plans 03-01 through 03-08 Artifacts (Regression Check)

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src-tauri/src/models/project.rs` | Full MceProject model hierarchy | VERIFIED | 101 lines. All structs with serde derives. |
| `Application/src-tauri/src/services/project_io.rs` | Project I/O service | VERIFIED | 229 lines. `create_project_dir`, `save_project` (atomic), `open_project`, `migrate_temp_images`, 4 tests. |
| `Application/src-tauri/src/commands/project.rs` | Tauri commands | VERIFIED | 102 lines. 5 commands: `project_create`, `project_save`, `project_open`, `project_migrate_temp_images`, `path_exists`. |
| `Application/src/types/project.ts` | TypeScript MceProject hierarchy | VERIFIED | 84 lines. 7 interfaces with snake_case fields. |
| `Application/src/lib/ipc.ts` | IPC wrappers | VERIFIED | 63 lines. All project commands + `pathExists` + `assetUrl`. |
| `Application/src/lib/appConfig.ts` | AppConfig with LazyStore | VERIFIED | 58 lines. 6 exported functions. |
| `Application/src/app.tsx` | Signal-based routing | VERIFIED | 10 lines. Routes on `dirPath`. |
| `Application/src/stores/projectStore.ts` | Project store | VERIFIED | 384 lines. Full CRUD + auto-save wiring + markDirty callbacks. |
| `Application/src/lib/autoSave.ts` | Auto-save module | VERIFIED | 67 lines. Debounce + interval. |
| `Application/src/components/project/WelcomeScreen.tsx` | Welcome screen | VERIFIED | 325 lines. Recent projects, New/Open buttons. |
| `Application/src/components/project/NewProjectDialog.tsx` | New project dialog | VERIFIED | 190 lines. Name/fps/folder. |
| `Application/src/components/layout/Toolbar.tsx` | Toolbar with Save | VERIFIED | 123 lines. New/Open/Save + dirty indicator. |
| `Application/src/components/layout/EditorShell.tsx` | Editor shell | VERIFIED | 52 lines. |
| `Application/src/components/sequence/SequenceList.tsx` | Sortable sequence list | VERIFIED | 297 lines. SortableJS forceFallback, portal context menu, drag handle. |

#### Plan 03-09 and 03-10 Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `Application/src/components/sequence/KeyPhotoStrip.tsx` | Key photo strip with SortableJS drag, click-to-select, exported AddKeyPhotoButton | VERIFIED | 242 lines. SortableJS with forceFallback (line 55-71). Click-to-select with ring highlight (line 111, 130). `AddKeyPhotoButton` exported (line 177). No overlay buttons on cards. Hold frame editing. Image picker popover with downward positioning. |
| `Application/src/stores/sequenceStore.ts` | selectedKeyPhotoId signal with select/clear methods | VERIFIED | 459 lines. Line 9: `selectedKeyPhotoId` signal. Line 49: exported. Line 433: `selectKeyPhoto()`. Line 437: `clearKeyPhotoSelection()`. Line 430: cleared in `setActive()`. Line 251-253: cleared in `removeKeyPhoto()`. Line 456: cleared in `reset()`. |
| `Application/src/components/layout/LeftPanel.tsx` | KEY PHOTOS header bar with '+' and conditional '< X >' buttons | VERIFIED | 263 lines. Lines 44-54: header bar with `KeyPhotoHeaderActions` + `AddKeyPhotoButton`. Lines 145-191: `KeyPhotoHeaderActions` inline component with move/delete controls. |
| `Application/src/index.css` | scrollbar-hidden utility | VERIFIED | `.scrollbar-hidden` at line 47. |
| `Application/src/lib/dragDrop.ts` | External vs internal drag distinction | VERIFIED | 71 lines. `paths.length > 0` check. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ipc.ts` | `commands/project.rs` | `safeInvoke('project_create')` etc. | WIRED | ipc.ts lines 34-52. lib.rs registers all 5 commands. |
| `commands/project.rs` | `services/project_io.rs` | Function delegation | WIRED | All CRUD commands call `project_io::` functions. |
| `appConfig.ts` | `capabilities/default.json` | store:default | WIRED | Capability present. |
| `types/project.ts` | `models/project.rs` | TypeScript mirrors Rust | WIRED | Field-for-field match. |
| `app.tsx` | `projectStore` | isProjectOpen computed | WIRED | Checks `dirPath.value`. |
| `WelcomeScreen.tsx` | `appConfig` | getRecentProjects | WIRED | Line 117. |
| `WelcomeScreen.tsx` | `ipc.ts` | pathExists | WIRED | Line 122. |
| `Toolbar.tsx` | `projectStore` | Save chain | WIRED | handleSave -> saveProject/saveProjectAs. |
| `autoSave.ts` | `projectStore` | effect() watches signals | WIRED | Lines 31-41. |
| `projectStore.ts` | `sequenceStore.ts` | _setMarkDirtyCallback | WIRED | Line 379. |
| `projectStore.ts` | `ipc.ts` | projectMigrateTempImages | WIRED | Import and call confirmed. |
| `SequenceList.tsx` | `sequenceStore` | reorderSequences via DOM revert | WIRED | Line 33. |
| `SequenceList context menu` | `document.body` | createPortal rendering | WIRED | Line 257-292. |
| `SortableJS (SequenceList)` | `sequenceStore` | forceFallback pointer events | WIRED | Line 25: forceFallback. Line 33: reorderSequences. |
| `KeyPhotoStrip SortableJS` | `sequenceStore.reorderKeyPhotos` | DOM revert + signal update | WIRED | Lines 65-67: DOM revert then `reorderKeyPhotos`. |
| `KeyPhotoCard click` | `sequenceStore.selectedKeyPhotoId` | onClick calling selectKeyPhoto | WIRED | Line 132: `sequenceStore.selectKeyPhoto(keyPhotoId)`. |
| `LeftPanel header buttons` | `sequenceStore.reorderKeyPhotos / removeKeyPhoto` | onClick handlers using selectedKeyPhotoId | WIRED | Lines 167, 176, 184: direct calls to store methods. |
| `LeftPanel header '+' button` | `AddKeyPhotoButton component` | import from KeyPhotoStrip | WIRED | Line 7: `import {KeyPhotoStrip, AddKeyPhotoButton}`. Line 52: `<AddKeyPhotoButton>` rendered. |
| `dragDrop.ts` | `DropZone.tsx` | isDraggingOver signal | WIRED | Only true when paths.length > 0. |

---

### Requirements Coverage

All 11 requirement IDs from phase plans cross-referenced against `v1.0-REQUIREMENTS.md`.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PROJ-01 | 03-01 | User can create a new project with name and frame rate | SATISFIED | Rust `project_create` + `NewProjectDialog` + `projectStore.createProject()` |
| PROJ-02 | 03-01 | User can save project to .mce file | SATISFIED | Rust `project_save` (atomic write) + `projectStore.saveProject()` + Toolbar Save |
| PROJ-03 | 03-01 | User can open existing .mce project files | SATISFIED | Rust `project_open` + `projectStore.openProject()` + WelcomeScreen Open |
| PROJ-04 | 03-02 | Project auto-saves on interval and significant actions | SATISFIED | `autoSave.ts`: 2s debounce effect + 60s periodic interval |
| PROJ-05 | 03-02, 03-05 | User can access recent projects list on launch | SATISFIED | `WelcomeScreen.tsx` loads from `appConfig`, validates via `pathExists` IPC. |
| PROJ-06 | 03-01, 03-05 | Global app config persists between sessions | SATISFIED | `appConfig.ts` LazyStore: recent projects, window prefs, last project path. |
| SEQN-01 | 03-03, 03-06, 03-07 | User can create named sequences | SATISFIED | `sequenceStore.createSequence(name)` + LeftPanel button. Portal context menu. |
| SEQN-02 | 03-03, 03-04, 03-06, 03-09, 03-10 | User can duplicate, delete, and reorder sequences | SATISFIED | Full CRUD + SortableJS drag with forceFallback + DOM revert. Header bar move/delete buttons for key photos (Plan 03-10). |
| SEQN-03 | 03-03, 03-06, 03-10 | User can add key photos with configurable hold duration | SATISFIED | `addKeyPhoto` + header bar `AddKeyPhotoButton` + `updateHoldFrames` inline editing. |
| SEQN-04 | 03-03, 03-04, 03-09, 03-10 | User can reorder key photos within a sequence | SATISFIED | SortableJS drag (forceFallback) + header bar move buttons (Plan 03-10 replaced card overlay buttons). |
| SEQN-05 | 03-03 | User can set per-sequence frame rate and resolution | SATISFIED | `setSequenceFps`/`setSequenceResolution` + SequenceSettings UI in LeftPanel. |

**Orphaned requirements check:** `v1.0-REQUIREMENTS.md` maps PROJ-01 through PROJ-06 and SEQN-01 through SEQN-05 to Phase 3. All 11 claimed by plans. No orphans.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `KeyPhotoStrip.tsx` | 134 | Comment "Placeholder icon when no image" | Info | Not an anti-pattern -- renders a "?" character as fallback when key photo has no associated image. Fully functional. |
| `WelcomeScreen.tsx` | 144, 157 | `console.error` on failed open | Info | Appropriate error logging for user-facing operations. |

No blocker or warning anti-patterns found. No TODO/FIXME/HACK comments in any phase files.

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

### 3. Recent Projects List

**Test:** Create projects in user directories, close app, relaunch. Check recent projects list.
**Expected:** Project names are clearly readable. Available projects are clickable. Missing projects show "Not found".
**Why human:** Visual contrast assessment and FS scope behavior require runtime verification.

### 4. Auto-Save Timing

**Test:** Open a project, rename a sequence, wait 2+ seconds.
**Expected:** .mce file updated on disk. Dirty indicator clears.
**Why human:** Timer-based debounce requires live observation.

### 5. Context Menu as Floating Overlay

**Test:** Create 4+ sequences. Right-click any sequence.
**Expected:** Context menu appears as floating overlay. No scrollbar in sequence list. Menu items clickable.
**Why human:** Portal rendering and position:fixed behavior need visual confirmation.

### 6. Sequence Drag Reorder

**Test:** Create 3+ sequences. Drag by grip handle.
**Expected:** Sequence moves smoothly (CSS transform ghost). New position persists. No file import overlay.
**Why human:** forceFallback behavior in Tauri WebView requires runtime verification.

### 7. Key Photo Strip Thumbnails and Scroll

**Test:** Add 5+ key photos.
**Expected:** Thumbnails are 72px wide. No visible scrollbar. Vertical mouse wheel scrolls horizontally.
**Why human:** Visual layout and wheel-to-horizontal behavior need live observation.

### 8. Key Photo Click-to-Select and Header Bar Controls

**Test:** Add 3+ key photos. Click a key photo card.
**Expected:** Clicked photo shows accent-colored ring border. Header bar shows [< X >] buttons. Click < to move left, > to move right, x to delete. Switch sequences -- selection clears. Delete selected -- selection clears.
**Why human:** Click interaction, header bar reactivity, and selection state clearing require runtime verification.

### 9. Key Photo SortableJS Drag Reorder

**Test:** Add 3+ key photos. Drag a card to a new position.
**Expected:** Card follows cursor, 30% opacity ghost. New position persists after drop.
**Why human:** forceFallback drag behavior in Tauri webview cannot be verified statically.

### 10. Add Key Photo from Header Bar

**Test:** Click the "+" button in the KEY PHOTOS header bar.
**Expected:** Image picker popover opens downward (below header). Clicking an image adds it as a key photo.
**Why human:** Popover positioning relative to header bar requires visual confirmation.

### 11. External File Drag-and-Drop

**Test:** Drag image files from Finder onto the app window.
**Expected:** Import overlay appears. Files are imported normally.
**Why human:** Tauri drag event integration requires runtime verification.

---

### Gaps Summary

No gaps found. All 42 must-have truths across ten plans are verified against the actual codebase. All 11 requirements (PROJ-01 through PROJ-06, SEQN-01 through SEQN-05) are satisfied. All 19 key links are wired.

**Plan 03-09 gap closure confirmed:**
- SortableJS re-added with `forceFallback: true` and horizontal direction for key photo drag reorder.
- Cards resized to 72px for 3-thumbnail fit in visible window.
- Arrow key handlers completely removed from strip (no timeline conflict).

**Plan 03-10 gap closure confirmed:**
- `selectedKeyPhotoId` signal added to `sequenceStore` with `selectKeyPhoto()` and `clearKeyPhotoSelection()` methods.
- `setActive()`, `removeKeyPhoto()`, and `reset()` all clear selection automatically.
- `AddKeyPhotoButton` exported from `KeyPhotoStrip.tsx` and rendered in LeftPanel header bar.
- `KeyPhotoHeaderActions` component in LeftPanel shows [< X >] buttons only when a key photo is selected.
- Card overlay buttons (move, delete) removed entirely -- cards now show only thumbnail + hold-frames badge + selection ring.
- Image picker popover repositioned to open downward (`top-7`) and right-aligned (`right-0`) for header context.

No regressions detected in previously verified truths. The phase goal is fully achieved.

---

*Verified: 2026-03-09T16:30:00Z*
*Verifier: Claude (gsd-verifier)*
