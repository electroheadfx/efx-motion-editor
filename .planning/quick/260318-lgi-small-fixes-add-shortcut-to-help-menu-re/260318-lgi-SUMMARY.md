---
phase: quick
plan: 260318-lgi
subsystem: ui
tags: [tauri, menu, sidebar, preact, zoom]

requires:
  - phase: 12.7
    provides: "Timeline zoom and context-aware keyboard shortcuts"
provides:
  - "View menu shortcut hint labels (+/= and -)"
  - "Context-aware menu zoom (timeline vs canvas based on mouse region)"
  - "Full opacity on non-selected sidebar sequences"
  - "Key photo ring-2 border no longer clipped on first item"
  - "Click-to-deselect key photo via strip background or sequence card background"
affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - Application/src-tauri/src/lib.rs
    - Application/src/main.tsx
    - Application/src/components/sequence/SequenceList.tsx
    - Application/src/components/sequence/KeyPhotoStrip.tsx

key-decisions:
  - "Uniform p-0.5 padding on strip container replaces pb-1 for ring visibility on all sides"
  - "currentTarget === target guard pattern for deselect-on-background-click (avoids interfering with child clicks)"

patterns-established: []

requirements-completed: [QUICK-LGI]

duration: 1min
completed: 2026-03-18
---

# Quick Task 260318-lgi: Small Fixes Summary

**View menu zoom labels with +/= and - shortcut hints, context-aware menu zoom, full-opacity sequences, key photo border fix, and click-to-deselect**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-18T14:29:55Z
- **Completed:** 2026-03-18T14:31:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- View menu now shows "Zoom In (+/=)" and "Zoom Out (-)" with shortcut hints
- Menu-triggered zoom is context-aware: targets timeline when mouse hovers timeline, canvas otherwise
- Non-selected sidebar sequences render at full opacity (removed 0.5 transparency)
- Key photo ring-2 border visible on all 4 sides including first item (uniform p-0.5 padding)
- Key photo can be deselected by clicking strip background or sequence card background

## Task Commits

Each task was committed atomically:

1. **Task 1: View menu shortcut label + context-aware menu zoom + sequence opacity fix** - `f4f648a` (feat)
2. **Task 2: Fix key photo border clipping + add click-to-deselect key photo** - `f2eee95` (feat)

## Files Created/Modified

- `Application/src-tauri/src/lib.rs` - Updated zoom menu item labels with shortcut hints
- `Application/src/main.tsx` - Made menu:zoom-in/out listeners context-aware via uiStore.mouseRegion
- `Application/src/components/sequence/SequenceList.tsx` - Removed opacity:0.5 on inactive sequences, added deselect handler on card background
- `Application/src/components/sequence/KeyPhotoStrip.tsx` - Changed pb-1 to p-0.5 for uniform ring padding, added deselect handler on strip background

## Decisions Made

- Used uniform `p-0.5` (2px) padding on key photo strip container instead of just `pb-1`, providing ring visibility on all four sides
- Used `currentTarget === target` guard pattern for background click deselection to avoid interfering with child element clicks

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

---
*Quick task: 260318-lgi*
*Completed: 2026-03-18*
