---
phase: 05-editing-infrastructure
plan: 03
subsystem: editing
tags: [tinykeys, keyboard-shortcuts, jkl-shuttle, speed-badge, overlay, preact-signals]

# Dependency graph
requires:
  - phase: 05-editing-infrastructure
    provides: guardUnsavedChanges(), undo/redo engine, closeProject lifecycle
provides:
  - "Global keyboard shortcuts via tinykeys (Space, arrows, JKL, Cmd+Z/S/N/O, Delete, ?)"
  - "JKL shuttle controller with DaVinci Resolve-style deceleration (4 speed tiers: 1x/2x/4x/8x)"
  - "SpeedBadge component for visual speed feedback near playback controls"
  - "ShortcutsOverlay modal with 2-column layout and macOS key symbols"
  - "Input field suppression for all shortcuts (INPUT, TEXTAREA, SELECT, contentEditable)"
affects: [06-layer-system, 07-fx-pipeline, 08-audio-integration]

# Tech tracking
tech-stack:
  added: [tinykeys@3.0.0]
  patterns: [global-keyboard-shortcuts, jkl-shuttle-rAF-loop, speed-badge-auto-hide, input-suppression-guard]

key-files:
  created:
    - Application/src/lib/jklShuttle.ts
    - Application/src/lib/shortcuts.ts
    - Application/src/components/overlay/ShortcutsOverlay.tsx
    - Application/src/components/overlay/SpeedBadge.tsx
  modified:
    - Application/src/main.tsx
    - Application/src/stores/uiStore.ts
    - Application/src/components/layout/EditorShell.tsx
    - Application/src/components/layout/CanvasArea.tsx
    - Application/src/components/layout/Toolbar.tsx
    - Application/src/vite-env.d.ts

key-decisions:
  - "tinykeys module declaration added to vite-env.d.ts to work around v3.0.0 missing types export"
  - "Toolbar refactored to use uiStore.showNewProjectDialog signal instead of local useState for Cmd+N parity"
  - "JKL shuttle uses its own rAF loop separate from PlaybackEngine for variable-rate frame stepping"

patterns-established:
  - "Input suppression guard: shouldSuppressShortcut() checks INPUT/TEXTAREA/SELECT/contentEditable before all shortcuts"
  - "JKL shuttle pattern: shared speed axis with deceleration-before-reversal, pressK resets to zero"
  - "Badge auto-hide pattern: signal-driven visibility with setTimeout fade-out after BADGE_DURATION ms"
  - "Overlay toggle pattern: uiStore signal drives render in EditorShell, dismiss via Escape/backdrop/toggle"

requirements-completed: [KEY-01, KEY-02, KEY-03, KEY-06, KEY-07, KEY-08]

# Metrics
duration: 4min
completed: 2026-03-03
---

# Phase 5 Plan 3: Keyboard Shortcuts & JKL Shuttle Summary

**tinykeys-based keyboard shortcuts with DaVinci Resolve JKL shuttle (1x/2x/4x/8x), speed badge, and macOS-symbol shortcuts overlay**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-03T17:15:52Z
- **Completed:** 2026-03-03T17:19:31Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Installed tinykeys and wired all keyboard shortcuts globally: Space (play/pause), Left/Right (step frame), JKL (shuttle), Cmd+Z/Shift+Cmd+Z (undo/redo), Cmd+S/N/O (file ops), Delete/Backspace (delete selected), ? (shortcuts overlay)
- Created JKL shuttle controller with DaVinci Resolve deceleration model -- J/L counter each other on a shared speed axis, K full-stops and resets tier to zero, 4 speed tiers (1x, 2x, 4x, 8x) with dedicated rAF loop
- Created SpeedBadge component showing speed multiplier near playback controls with auto-hide after 1200ms
- Created ShortcutsOverlay with centered dark modal, 2-column grouped layout, and macOS key symbols (command, shift, delete)
- Input field suppression prevents all shortcuts from firing when typing in INPUT, TEXTAREA, SELECT, or contentEditable elements

## Task Commits

Each task was committed atomically:

1. **Task 1: Create JKL shuttle controller and keyboard shortcuts module** - `3befcc8` (feat)
2. **Task 2: Create ShortcutsOverlay, SpeedBadge, and wire into EditorShell** - `35d9f4c` (feat)

## Files Created/Modified
- `Application/src/lib/jklShuttle.ts` - DaVinci Resolve-style JKL shuttle controller with 4 speed tiers and rAF-based variable-rate playback
- `Application/src/lib/shortcuts.ts` - tinykeys binding map with all keyboard shortcuts and input field suppression
- `Application/src/components/overlay/ShortcutsOverlay.tsx` - Keyboard shortcuts help modal with 2-column layout and macOS symbols
- `Application/src/components/overlay/SpeedBadge.tsx` - JKL speed indicator badge with fade-in/out
- `Application/src/main.tsx` - Added mountShortcuts() call at app startup
- `Application/src/stores/uiStore.ts` - Added shortcutsOverlayOpen, showNewProjectDialog signals with toggle/close methods
- `Application/src/components/layout/EditorShell.tsx` - Renders ShortcutsOverlay when overlay is open
- `Application/src/components/layout/CanvasArea.tsx` - Renders SpeedBadge above playback controls
- `Application/src/components/layout/Toolbar.tsx` - Refactored to use uiStore.showNewProjectDialog instead of local useState
- `Application/src/vite-env.d.ts` - Added tinykeys module declaration for TypeScript compatibility

## Decisions Made
- Added tinykeys module declaration in vite-env.d.ts because tinykeys v3.0.0 package.json exports field doesn't include a "types" condition, causing TypeScript errors with bundler module resolution
- Refactored Toolbar to use uiStore.showNewProjectDialog signal instead of local useState, so Cmd+N from shortcuts.ts and the New button both trigger the same dialog through shared state
- JKL shuttle uses its own requestAnimationFrame loop separate from PlaybackEngine to support variable-rate frame stepping without modifying the engine's internals

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added tinykeys module declaration for TypeScript compatibility**
- **Found during:** Task 1 (shortcuts.ts creation)
- **Issue:** tinykeys v3.0.0 package.json exports field lacks a "types" condition, causing TS7016 implicit-any error
- **Fix:** Added ambient module declaration in vite-env.d.ts with proper function signature
- **Files modified:** Application/src/vite-env.d.ts
- **Verification:** TypeScript compilation passes cleanly
- **Committed in:** 3befcc8 (Task 1 commit)

**2. [Rule 3 - Blocking] Added uiStore signals in Task 1 to unblock shortcuts.ts compilation**
- **Found during:** Task 1 (shortcuts.ts references uiStore.toggleShortcutsOverlay and showNewProjectDialog)
- **Issue:** shortcuts.ts needs uiStore methods planned for Task 2; TypeScript would fail without them
- **Fix:** Added shortcutsOverlayOpen, showNewProjectDialog signals and toggle/close methods to uiStore in Task 1 instead of Task 2
- **Files modified:** Application/src/stores/uiStore.ts
- **Verification:** TypeScript compilation passes cleanly
- **Committed in:** 3befcc8 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes necessary for compilation. No scope creep -- moved uiStore work from Task 2 to Task 1 for dependency ordering.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All keyboard shortcuts (KEY-01 through KEY-08) are wired and functional
- JKL shuttle ready for audio sync integration (Phase 8) -- shuttle speed could drive audio playback rate
- ShortcutsOverlay can be extended with new shortcuts as features are added in Phase 6+
- Delete shortcut currently handles layer deletion only; key photo deletion from keyboard to be refined when key photo selection state is added in Phase 6

## Self-Check: PASSED

All 10 files verified present. Both task commits (3befcc8, 35d9f4c) verified in git log.

---
*Phase: 05-editing-infrastructure*
*Completed: 2026-03-03*
