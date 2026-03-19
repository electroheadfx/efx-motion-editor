---
phase: quick-40
plan: 01
subsystem: ui
tags: [scroll, trackpad, timeline, wheel-events, preact-signals]

requires:
  - phase: 12.5
    provides: "Timeline vertical scroll and scrollbar infrastructure"
provides:
  - "Natural 2D trackpad scrolling on timeline (deltaY=vertical, deltaX=horizontal)"
  - "Cmd+scroll vertical scroll for mouse users"
  - "scrollY auto-clamping when FX layers deleted"
affects: [timeline, shortcuts-overlay]

tech-stack:
  added: []
  patterns:
    - "effect() for auto-clamping signals when computed dependencies shrink"

key-files:
  created: []
  modified:
    - Application/src/components/timeline/TimelineInteraction.ts
    - Application/src/stores/timelineStore.ts
    - Application/src/components/overlay/ShortcutsOverlay.tsx

key-decisions:
  - "Ctrl+scroll for zoom only (not Cmd+Ctrl combined); metaKey gets its own vertical scroll branch"
  - "Use maxScrollY computed signal from timelineStore instead of recalculating locally in onWheel"
  - "effect() auto-clamp pattern for scrollY when content height shrinks"

patterns-established:
  - "Signal auto-clamping via effect(): subscribe to a max-bound computed, clamp the value signal when it exceeds"

requirements-completed: [QUICK-40]

duration: 2min
completed: 2026-03-19
---

# Quick-40: Fix Layer Panel Scroll / Natural Trackpad Summary

**Natural 2D trackpad scrolling with Ctrl=zoom / Cmd=vertical split and scrollY auto-clamping on FX layer deletion**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-19T17:54:16Z
- **Completed:** 2026-03-19T17:56:07Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Bare trackpad scroll now maps naturally: deltaY to vertical, deltaX to horizontal
- Ctrl+scroll zooms at cursor (trackpad pinch-to-zoom also sets ctrlKey on macOS)
- Cmd+scroll scrolls vertically for mouse users
- scrollY auto-clamps via effect() when FX layers are deleted (no stale blank space)
- Shortcut overlay updated to reflect new scroll mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix onWheel scroll mapping and scrollY clamping** - `739b798` (feat)
2. **Task 2: Update shortcut overlay hints for new scroll mapping** - `4bb41d2` (feat)

## Files Created/Modified
- `Application/src/components/timeline/TimelineInteraction.ts` - Rewritten onWheel handler with natural scroll, Ctrl=zoom, Cmd=vertical, Shift=vertical fallback
- `Application/src/stores/timelineStore.ts` - Added effect() import, scrollY auto-clamping effect, setScrollY clamped against maxScrollY
- `Application/src/components/overlay/ShortcutsOverlay.tsx` - Added Cmd+Scroll hint, renamed bare Scroll to "Natural scroll (trackpad)"

## Decisions Made
- Ctrl+scroll handles zoom exclusively (Cmd no longer combined with Ctrl for zoom); this separates pinch-to-zoom (which sets ctrlKey on macOS) from Cmd+scroll vertical
- Vertical scroll branches use `timelineStore.maxScrollY.peek()` instead of recalculating content height locally, reducing duplication
- Auto-clamp effect uses `scrollY.peek()` inside the effect to avoid circular subscription while still reacting to `maxScrollY.value` changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Timeline scroll behavior is now natural for both trackpad and mouse users
- No blockers

---
*Phase: quick-40*
*Completed: 2026-03-19*
