---
phase: 05-editing-infrastructure
verified: 2026-03-09T22:00:00Z
status: passed
score: 27/27 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 23/23
  uat_gaps_found: 4
  gaps_closed:
    - "Cmd+Z undoes the last sequence mutation on macOS"
    - "Cmd+Shift+Z redoes the last undone change on macOS"
    - "JKL shuttle provides intuitive speed/direction control separate from play/pause"
    - "Pressing ? opens the shortcuts overlay regardless of keyboard layout"
  gaps_remaining: []
  regressions: []
---

# Phase 5: Editing Infrastructure Verification Report

**Phase Goal:** Users can undo/redo any editing action, operate the app with keyboard shortcuts, and switch between projects without data corruption
**Verified:** 2026-03-09
**Status:** PASSED
**Re-verification:** Yes -- after UAT gap closure (Plans 04 + 05)

## Context

Initial verification (2026-03-03) passed 23/23 code-level truths. Subsequent UAT (2026-03-09) revealed 4 runtime failures:
1. Cmd+Z / Cmd+Shift+Z intercepted by Tauri default macOS menu (tests 5, 6)
2. JKL shuttle model unintuitive -- user wanted split-responsibility (test 9)
3. ? shortcut used physical key code, broken on non-US keyboards (test 11)

Plans 04 and 05 were created and executed to close these gaps. This re-verification confirms all 4 gaps are closed with no regressions, bringing the total to 27 verified truths (23 original + 4 new from gap closure plans).

---

## Goal Achievement

### Success Criteria (from ROADMAP.md)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | User can create a new project while editing and all stores reset cleanly | VERIFIED | `closeProject()` in projectStore.ts (line 344) resets 6 stores + historyStore; called by `createProject()` and `openProject()` |
| 2 | User can undo any editing action with Cmd+Z and redo with Cmd+Shift+Z, with rapid slider changes coalescing | VERIFIED | Custom Tauri menu emits `menu:undo/redo` events to frontend; `main.tsx` listens and calls `undo()/redo()`; history.ts coalescing API intact |
| 3 | User can play/pause with Space, step frames with arrows, scrub with JKL, and save/open/create with Cmd shortcuts | VERIFIED | shortcuts.ts wires all bindings; JKL rewritten to split-responsibility model; playbackEngine reads shuttle state with auto-loop |
| 4 | Keyboard shortcuts do not fire when typing in input fields, and pressing ? shows a shortcuts help overlay | VERIFIED | `shouldSuppressShortcut()` guards all handlers; `Shift+?` character matching for layout-independent binding |

**Score:** 4/4 success criteria verified

### Observable Truths

#### Original Truths (Plans 01-03) -- Regression Check

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Creating a new project resets all stores | VERIFIED | `createProject()` calls `closeProject()` first (line 231); `closeProject()` batch-resets all stores |
| 2 | Opening a different project resets all stores before loading | VERIFIED | `openProject()` calls `closeProject()` at line 314 |
| 3 | Auto-save timer stops when project is closed | VERIFIED | `closeProject()` calls `stopAutoSave()` at line 346 |
| 4 | User sees native macOS Save/Don't Save/Cancel dialog | VERIFIED | `unsavedGuard.ts` uses `message()` with `buttons: {yes:'Save', no:"Don't Save", cancel:'Cancel'}` |
| 5 | If never saved and user picks Save, Save As picker appears | VERIFIED | `unsavedGuard.ts` line 30-35: `save()` dialog when `filePath.value` is null |
| 6 | Closing window with unsaved changes shows dialog | VERIFIED | `main.tsx` line 26-30: `onCloseRequested` calls `guardUnsavedChanges()` |
| 7 | Cmd+S/N/O file operations with guard | VERIFIED | `shortcuts.ts` lines 144-158 |
| 8 | Undo stack supports 200 levels | VERIFIED | `history.ts` line 5: `MAX_STACK_SIZE = 200` |
| 9 | Rapid slider changes coalesce into single undo entry | VERIFIED | `history.ts` `startCoalescing/stopCoalescing` API intact |
| 10 | New action after undo truncates redo branch | VERIFIED | `history.ts` line 27: `stack.value.slice(0, pointer.value + 1)` |
| 11 | Project settings NOT in undo stack | VERIFIED | Only `sequenceStore` mutations call `pushAction` (15 calls confirmed) |
| 12 | Undo stack is global across all sequences | VERIFIED | Single `historyStore` with one shared stack |
| 13 | Space bar toggles play/pause | VERIFIED | `shortcuts.ts` line 98-101: calls `playbackEngine.toggle()` |
| 14 | Arrow keys step one frame | VERIFIED | `shortcuts.ts` lines 103-112 |
| 15 | Speed badge shows near playback controls | VERIFIED | `SpeedBadge.tsx` reads `currentSpeedLabel` and `showSpeedBadge` signals |
| 16 | Shortcuts suppressed in input fields | VERIFIED | `shouldSuppressShortcut()` checks INPUT/TEXTAREA/SELECT/contentEditable |
| 17 | ShortcutsOverlay has dark theme, 2-column layout, macOS symbols | VERIFIED | `ShortcutsOverlay.tsx`: `bg-[#1C1C1C]`, `grid grid-cols-2`, unicode symbols |
| 18 | Delete/Backspace deletes selected layer | VERIFIED | `shortcuts.ts` lines 161-168 |

All 18 regression items pass. No regressions detected.

#### Gap Closure Truths (Plan 04 -- Undo/Redo + ? Fix)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 19 | Cmd+Z undoes the last sequence mutation on macOS | VERIFIED | `lib.rs` line 43: `MenuItem::with_id(app, "undo", ...)` with `CmdOrCtrl+Z`; line 67-68: emits `menu:undo`; `main.tsx` line 22: `listen('menu:undo', () => { undo(); })` |
| 20 | Cmd+Shift+Z redoes the last undone change on macOS | VERIFIED | `lib.rs` line 45: `MenuItem::with_id(app, "redo", ...)` with `CmdOrCtrl+Shift+Z`; line 69-70: emits `menu:redo`; `main.tsx` line 23: `listen('menu:redo', () => { redo(); })` |
| 21 | Pressing ? opens shortcuts overlay regardless of keyboard layout | VERIFIED | `shortcuts.ts` line 171: `'Shift+?'` (character matching via `event.key`) replaces old `'Shift+Slash'` (physical key code) |

#### Gap Closure Truths (Plan 05 -- JKL Shuttle Rewrite)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 22 | Space starts and stops playback -- J/L do NOT start playback | VERIFIED | `jklShuttle.ts` `pressJ/pressK/pressL` only modify `shuttleDirection` and `shuttleSpeedTier` signals; no `playbackEngine.start()` or rAF calls; Space handler calls `playbackEngine.toggle()` |
| 23 | L sets direction to forward; repeated presses increase speed tier | VERIFIED | `jklShuttle.ts` lines 40-54: `pressL()` increments tier if forward, resets to 0 if switching from reverse |
| 24 | J sets direction to reverse; repeated presses increase reverse speed tier | VERIFIED | `jklShuttle.ts` lines 62-76: `pressJ()` increments tier if reverse, resets to 0 if switching from forward |
| 25 | K resets speed and direction to 1x forward but does NOT stop playback | VERIFIED | `jklShuttle.ts` lines 83-88: `pressK()` sets tier=0, direction=1; no `playbackEngine.stop()` call |
| 26 | Playback auto-loops at boundaries | VERIFIED | `playbackEngine.ts` lines 107-121: forward at maxFrames-1 seeks to 0; reverse at 0 seeks to maxFrames-1; no `this.stop()` at boundaries |
| 27 | Speed badge shows current multiplier when J/L/K change shuttle state | VERIFIED | `jklShuttle.ts` `updateLabel()` + `flashBadge()` called in all three press functions; `SpeedBadge.tsx` reads signals |

**Score:** 27/27 truths verified

---

### Required Artifacts

#### Original Artifacts (Regression Check)

| Artifact | Status | Details |
|----------|--------|---------|
| `Application/src/lib/unsavedGuard.ts` | VERIFIED | 48 lines; exports `GuardResult` type and `guardUnsavedChanges()` |
| `Application/src/stores/projectStore.ts` | VERIFIED | `closeProject()` resets all stores including historyStore |
| `Application/src/lib/history.ts` | VERIFIED | 117 lines; full command-pattern engine with coalescing |
| `Application/src/stores/historyStore.ts` | VERIFIED | 11 lines; `stack` and `pointer` signals |
| `Application/src/stores/sequenceStore.ts` | VERIFIED | 15 `pushAction` calls for all mutations |
| `Application/src/stores/uiStore.ts` | VERIFIED | `shortcutsOverlayOpen`, `showNewProjectDialog` signals; toggle/close methods |
| `Application/src/components/overlay/SpeedBadge.tsx` | VERIFIED | 28 lines; reads shuttle signals |

#### Gap Closure Artifacts (Full Verification)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src-tauri/src/lib.rs` | Custom Tauri menu with `MenuItem::with_id` for Undo/Redo; `on_menu_event` emitting to frontend | VERIFIED | 124 lines; imports `MenuBuilder`, `MenuItem`, `SubmenuBuilder`, `Emitter`; app + edit submenus; `on_menu_event` at line 66 emits `menu:undo`/`menu:redo` |
| `Application/src/main.tsx` | Frontend `listen()` handlers for `menu:undo`/`menu:redo` | VERIFIED | 32 lines; `listen('menu:undo', () => { undo(); })` at line 22; `listen('menu:redo', () => { redo(); })` at line 23; imports `undo, redo` from `./lib/history` |
| `Application/src/lib/shortcuts.ts` | Layout-independent `?` binding; all shortcut wiring | VERIFIED | 178 lines; line 171: `'Shift+?'`; all J/K/L/Space/arrows/Cmd shortcuts wired with `shouldSuppressShortcut` guard |
| `Application/src/lib/jklShuttle.ts` | State-only shuttle (no rAF loop); exports direction/speed signals | VERIFIED | 136 lines; exports `shuttleDirection`, `shuttleSpeedTier`, `shuttleSpeed` (computed), `currentSpeedLabel`, `showSpeedBadge`; zero `requestAnimationFrame` calls |
| `Application/src/lib/playbackEngine.ts` | Reads shuttle speed/direction in tick(); auto-loops at boundaries | VERIFIED | 138 lines; imports `shuttleDirection`, `shuttleSpeed`, `resetShuttle` from `./jklShuttle`; tick() at line 92 reads both via `.peek()`; auto-loop at lines 109-121; `stop()` calls `resetShuttle()` at line 43 |
| `Application/src/components/overlay/ShortcutsOverlay.tsx` | Updated JKL descriptions matching new model | VERIFIED | 121 lines; J="Set reverse / increase speed"; K="Reset speed to 1x forward"; L="Set forward / increase speed" |

---

### Key Link Verification

#### Gap Closure Key Links (Full Verification)

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib.rs` (Tauri menu) | `main.tsx` (frontend) | `emit("menu:undo")` / `listen('menu:undo')` | WIRED | lib.rs line 68: `handle.emit("menu:undo", ())` -> main.tsx line 22: `listen('menu:undo', () => { undo(); })` |
| `lib.rs` (Tauri menu) | `main.tsx` (frontend) | `emit("menu:redo")` / `listen('menu:redo')` | WIRED | lib.rs line 70: `handle.emit("menu:redo", ())` -> main.tsx line 23: `listen('menu:redo', () => { redo(); })` |
| `jklShuttle.ts` | `playbackEngine.ts` | PlaybackEngine reads shuttle signals in tick() | WIRED | playbackEngine.ts line 6: imports `shuttleDirection, shuttleSpeed, resetShuttle`; tick() lines 94-95: `shuttleSpeed.peek()` and `shuttleDirection.peek()` |
| `shortcuts.ts` | `jklShuttle.ts` | J/K/L keys call `pressJ/pressK/pressL` | WIRED | shortcuts.ts line 3: `import {pressJ, pressK, pressL}`; lines 118, 123, 128 call them |
| `playbackEngine.ts` | `jklShuttle.ts` | `stop()` calls `resetShuttle()` | WIRED | playbackEngine.ts line 6: imports `resetShuttle`; line 43: `resetShuttle()` inside `stop()` |
| `EditorShell.tsx` | `ShortcutsOverlay.tsx` | Renders overlay when `shortcutsOverlayOpen` is true | WIRED | EditorShell.tsx line 8: import; line 49: conditional render |

#### Original Key Links (Regression Check)

| From | To | Via | Status |
|------|----|-----|--------|
| `projectStore.ts` | stores (6+history) | `closeProject()` resets all | WIRED |
| `main.tsx` | `unsavedGuard.ts` | Window close intercept | WIRED |
| `shortcuts.ts` | `playbackEngine.ts` | Space/Arrow bindings | WIRED |
| `shortcuts.ts` | `history.ts` | Cmd+Z/Shift+Z call undo/redo | WIRED |
| `shortcuts.ts` | `unsavedGuard.ts` | Cmd+N/O trigger guard | WIRED |
| `main.tsx` | `shortcuts.ts` | `mountShortcuts()` at startup | WIRED |
| `history.ts` | `historyStore.ts` | Reads/writes signals | WIRED |
| `sequenceStore.ts` | `history.ts` | 15 `pushAction` calls | WIRED |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| INFRA-01 | Plan 01 | App resets all stores on create/close | SATISFIED | `closeProject()` resets 6 stores + historyStore |
| INFRA-02 | Plan 01 | `stopAutoSave()` on project close | SATISFIED | `closeProject()` calls `stopAutoSave()` first |
| INFRA-03 | Plans 02, 04 | Undo with Cmd+Z -- 100+ levels, command pattern | SATISFIED | history.ts engine (200 levels); custom Tauri menu routes Cmd+Z to frontend |
| INFRA-04 | Plans 02, 04 | Redo with Cmd+Shift+Z | SATISFIED | history.ts `redo()`; custom Tauri menu routes Cmd+Shift+Z to frontend |
| INFRA-05 | Plan 02 | Rapid slider/drag changes coalesce | SATISFIED | `startCoalescing/stopCoalescing` in history.ts |
| KEY-01 | Plans 03, 05 | Space bar toggles play/pause | SATISFIED | Space calls `playbackEngine.toggle()`; sole play/stop control |
| KEY-02 | Plan 03 | Arrow keys step one frame | SATISFIED | ArrowLeft/ArrowRight bindings |
| KEY-03 | Plans 03, 05 | JKL variable-speed scrubbing | SATISFIED | Rewritten to split-responsibility: J/L set direction+speed, K resets, Space owns play/stop; auto-loop at boundaries |
| KEY-04 | Plans 02, 04 | Cmd+Z/Shift+Z undo/redo | SATISFIED | Custom Tauri menu with `MenuItem::with_id` + `on_menu_event` + frontend `listen()` |
| KEY-05 | Plan 01 | Cmd+S/N/O file operations with guard | SATISFIED | `handleSave/handleNewProject/handleOpenProject` in shortcuts.ts |
| KEY-06 | Plan 03 | Delete/Backspace deletes selected item | SATISFIED | Bindings call `handleDelete()` |
| KEY-07 | Plan 03 | Shortcuts suppressed in input fields | SATISFIED | `shouldSuppressShortcut()` in all handlers |
| KEY-08 | Plans 03, 04 | ? key shows shortcuts overlay | SATISFIED | `'Shift+?'` character matching for layout independence |

All 13 requirements accounted for and satisfied.

**Orphaned requirements check:** REQUIREMENTS.md traceability maps INFRA-01 through INFRA-05 and KEY-01 through KEY-08 to Phase 5. All 13 are claimed by plans. No orphaned requirements.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | -- | -- | -- | -- |

Scanned all phase-modified files (lib.rs, main.tsx, shortcuts.ts, jklShuttle.ts, playbackEngine.ts, history.ts, unsavedGuard.ts, ShortcutsOverlay.tsx, SpeedBadge.tsx, historyStore.ts, projectStore.ts, uiStore.ts, sequenceStore.ts):
- TODO/FIXME/HACK/PLACEHOLDER: none found
- Empty implementations / stub returns: none found
- Console.log-only handlers: none found
- jklShuttle.ts has zero `requestAnimationFrame` calls (confirmed state-only)

TypeScript compilation: clean (zero errors) via `npx tsc --noEmit`.

---

### Human Verification Required

#### 1. Cmd+Z/Cmd+Shift+Z on macOS

**Test:** Make a sequence edit (e.g., add a key photo). Press Cmd+Z. The edit should undo. Press Cmd+Shift+Z to redo.
**Expected:** Undo reverses the edit; redo restores it. The Edit menu shows Undo/Redo items with correct accelerators.
**Why human:** Verifying the full Tauri menu event pipeline (native menu accelerator -> Rust on_menu_event -> emit -> JS listen -> undo/redo) requires running the app on macOS.

#### 2. ? Shortcut on Non-US Keyboard Layouts

**Test:** Switch keyboard layout to one where ? is not Shift+Slash (e.g., French AZERTY where ? is Shift+Comma). Press ?
**Expected:** The shortcuts overlay appears regardless of keyboard layout.
**Why human:** Character-vs-keycode matching behavior of tinykeys can only be confirmed with actual non-US keyboard layouts.

#### 3. JKL Split-Responsibility Model Feel

**Test:** Start playback with Space. Press L to increase speed (should show 2x badge). Press L again (4x). Press J once (should decelerate to 1x forward, not reverse). Press K (reset to 1x forward, playback continues). Press Space (stops playback).
**Expected:** J/L only change direction and speed without starting/stopping playback. K resets without stopping. Space is the sole play/stop control.
**Why human:** The user specifically requested this UX model as "more intuitive" -- needs runtime validation of the feel.

#### 4. Auto-Loop at Boundaries

**Test:** Play a short sequence forward. Let it reach the last frame.
**Expected:** Playback wraps to frame 0 and continues endlessly. Press J to go reverse, let it reach frame 0 -- wraps to last frame.
**Why human:** Boundary wrapping timing and visual continuity need runtime validation.

#### 5. Coalescing in Practice (Slider Drag)

**Test:** Drag a hold-frames slider on a key photo. Release. Press Cmd+Z.
**Expected:** Single undo step undoes the entire drag.
**Why human:** Whether slider component UI calls `startCoalescing/stopCoalescing` at mousedown/mouseup needs runtime confirmation.

---

### Gaps Summary

No gaps found. All 4 UAT-reported issues have been fixed:

1. **Undo/Redo (Cmd+Z/Shift+Z):** Custom Tauri menu replaces default macOS Edit menu. Undo/Redo use `MenuItem::with_id` that emit events to the frontend via `on_menu_event` + `Emitter::emit`. Frontend `listen()` handlers call `undo()/redo()` directly.

2. **JKL Shuttle:** Rewritten from DaVinci Resolve model (J/L toggle play AND speed) to split-responsibility (Space owns play/stop, J/L only modify direction+speed signals, K resets to 1x forward). PlaybackEngine reads shuttle signals in its tick loop. Auto-loop at frame boundaries.

3. **? Shortcut:** Changed from physical key code `'Shift+Slash'` to character matching `'Shift+?'` for layout independence.

No regressions detected in the 18 originally-verified truths. All 13 requirements (INFRA-01 through INFRA-05, KEY-01 through KEY-08) remain satisfied.

All gap-closure commits verified in git: `6d6f628` (custom Tauri menu), `365f4ad` (menu listeners + ? fix), `fc6d0db` (JKL rewrite), `164cd99` (ShortcutsOverlay descriptions).

---

_Verified: 2026-03-09_
_Verifier: Claude (gsd-verifier)_
