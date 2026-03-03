---
phase: 04-timeline-preview
plan: 03
subsystem: timeline
tags: [preview-zoom, preview-pan, drag-drop, sequence-reorder, canvas-2d, playback-controls]

# Dependency graph
requires:
  - phase: 04-timeline-preview
    provides: "PlaybackEngine, timelineStore, frameMap, trackLayouts from 04-01; TimelineRenderer, TimelineInteraction from 04-02"
  - phase: 03-project-sequence
    provides: "sequenceStore with reorderSequences()"
provides:
  - "Preview zoom/pan with Cmd+scroll and middle-click drag"
  - "Preview controls wired to PlaybackEngine (play/pause, step forward/backward)"
  - "Real timecode display from timelineStore (current time / total duration)"
  - "Timeline track header drag-and-drop for sequence reorder"
  - "Drag visual feedback: blue drop indicator line + ghost track"
affects: [05-compositing, 07-audio-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: [cursor-anchored-preview-zoom, middle-click-pan, track-header-drag-reorder, canvas-drag-ghost]

key-files:
  created: []
  modified:
    - Application/src/components/layout/CanvasArea.tsx
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/timeline/TimelineInteraction.ts

key-decisions:
  - "Preview zoom uses Cmd/Ctrl+scroll with cursor-anchored pan adjustment to keep point under cursor stable"
  - "Middle-click (button === 1) for preview panning to avoid conflicts with regular click interactions"
  - "Track header drag uses canvas hit testing (x < TRACK_HEADER_WIDTH) and manual drag state since canvas lacks native drag events"
  - "Drop index computed as insertion point with adjustment when dropping below source position"

patterns-established:
  - "Preview zoom/pan: separate signals for zoom, panX, panY; CSS transform: scale() translate() on preview wrapper"
  - "Canvas drag-and-drop: hit test on mousedown, drag state in interaction class, visual feedback via renderer.setDragState()"
  - "Drop index adjustment: when toIndex > fromIndex, subtract 1 to account for removed item shifting indices"

requirements-completed: [TIME-06, PREV-04]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 4 Plan 03: Preview Zoom/Pan & Sequence Reorder Summary

**Preview canvas zoom/pan with Cmd+scroll and middle-click drag, plus timeline track header drag-and-drop for sequence reordering**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T13:09:40Z
- **Completed:** 2026-03-03T13:12:08Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Preview canvas supports Cmd/Ctrl+scroll zoom (0.1x to 4x) with cursor-anchored pan adjustment
- Middle-click drag pans the preview, with pointer capture for smooth dragging
- Preview controls fully wired: play/pause, step forward/backward via PlaybackEngine; real timecode from timelineStore
- Fit button resets zoom and pan to defaults; zoom percentage displayed in controls bar
- Timeline track header drag-and-drop reorders sequences via sequenceStore.reorderSequences()
- Blue drop indicator line and ghost track provide visual feedback during drag
- Edge cases handled: single-sequence no-op, same-position no-op, grab/grabbing cursor feedback

## Task Commits

Each task was committed atomically:

1. **Task 1: Add preview zoom/pan and update CanvasArea with preview controls** - `2ea004e` (feat)
2. **Task 2: Add sequence reorder drag-and-drop on timeline track headers** - `7e4af54` (feat)

## Files Created/Modified
- `Application/src/components/layout/CanvasArea.tsx` - Preview zoom/pan signals, Cmd+scroll handler, middle-click pan, controls wired to playbackEngine
- `Application/src/components/timeline/TimelineRenderer.ts` - DragState interface, setDragState() method, drop indicator and ghost track drawing
- `Application/src/components/timeline/TimelineInteraction.ts` - Track header hit testing, drag-and-drop event handling, sequenceStore.reorderSequences() call

## Decisions Made
- Preview zoom uses Cmd/Ctrl+scroll with cursor-anchored pan adjustment (same pattern as timeline zoom)
- Middle-click (button === 1) chosen for preview panning to avoid conflicts with left-click interactions
- Track header drag uses manual canvas hit testing since canvas doesn't have native drag events for drawn items
- Drop index computed as insertion point between tracks, with index adjustment when dropping below source position

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 4 requirements complete (TIME-01 through TIME-06, PREV-01 through PREV-05)
- Preview zoom/pan ready for Phase 5 compositing layer inspection
- Sequence reorder on timeline ready -- all views (timeline + left panel) update via shared sequenceStore signal
- PlaybackEngine and preview controls ready for Phase 7 audio sync transport

## Self-Check: PASSED

All 3 modified files verified present on disk. Both task commits (2ea004e, 7e4af54) verified in git log.

---
*Phase: 04-timeline-preview*
*Completed: 2026-03-03*
