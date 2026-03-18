---
phase: quick
plan: 260318-kn8
subsystem: ui
tags: [keyboard-shortcuts, preact-signals, context-aware-input]

requires:
  - phase: 11-04
    provides: arrow key nudge and step handlers in shortcuts.ts
provides:
  - mouseRegion signal in uiStore for cursor-position-aware behavior
  - Context-dependent arrow key handlers (timeline scrub vs canvas nudge)
affects: [shortcuts, uiStore, canvas, timeline]

tech-stack:
  added: []
  patterns: [mouseRegion signal for spatial context in keyboard handlers]

key-files:
  created: []
  modified:
    - Application/src/stores/uiStore.ts
    - Application/src/lib/shortcuts.ts
    - Application/src/components/layout/CanvasArea.tsx
    - Application/src/components/layout/TimelinePanel.tsx

key-decisions:
  - "mouseRegion signal with onMouseEnter/onMouseLeave (not pointer events) for reliable boundary detection during drags"
  - "seekToFrame with delta for timeline scrub supports multi-frame Shift+Arrow jumps naturally"
  - "Fallback 'other' region preserves original arrow key behavior for backward compat"

patterns-established:
  - "mouseRegion spatial context: read uiStore.mouseRegion.peek() in imperative handlers to vary behavior by cursor location"

requirements-completed: [quick-32]

duration: 2min
completed: 2026-03-18
---

# Quick Task 260318-kn8: Fix Arrow Key Scrubbing Summary

**Context-aware arrow keys via mouseRegion signal: timeline hover scrubs frames, canvas hover nudges layers, with Shift for 10x multiplier**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T13:54:57Z
- **Completed:** 2026-03-18T13:57:16Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Arrow keys over timeline always scrub frames (Left/Right and Up/Down), even when a layer is selected
- Arrow keys over canvas always nudge selected layer, never scrub timeline
- Shift modifier gives 10-frame jumps (timeline) or 10px nudge (canvas)
- Up/Down arrows over timeline now step frames (previously no-op unless layer selected)
- Fallback behavior preserved when mouse is outside canvas/timeline

## Task Commits

Each task was committed atomically:

1. **Task 1: Add mouseRegion signal and wire hover tracking** - `ac23356` (feat)
2. **Task 2: Update arrow key handlers to use mouseRegion context** - `05913fb` (feat)

## Files Created/Modified
- `Application/src/stores/uiStore.ts` - Added mouseRegion signal, setter, and reset
- `Application/src/lib/shortcuts.ts` - Replaced nudgeOrStep with handleArrow using mouseRegion context
- `Application/src/components/layout/CanvasArea.tsx` - Added onMouseEnter/onMouseLeave for 'canvas' region
- `Application/src/components/layout/TimelinePanel.tsx` - Added onMouseEnter/onMouseLeave for 'timeline' region

## Decisions Made
- Used onMouseEnter/onMouseLeave instead of onPointerEnter/onPointerLeave because pointer events stay captured during drag but mouse events properly fire on boundary crossing
- Used seekToFrame(current + delta) for timeline scrub instead of stepForward/stepBackward loops, supporting multi-frame Shift+Arrow jumps natively
- Fallback region ('other') preserves the original behavior: Left/Right nudge if layer selected else scrub, Up/Down always nudge

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- mouseRegion signal available for any future context-dependent keyboard behavior
- No blockers

---
*Quick task: 260318-kn8*
*Completed: 2026-03-18*
