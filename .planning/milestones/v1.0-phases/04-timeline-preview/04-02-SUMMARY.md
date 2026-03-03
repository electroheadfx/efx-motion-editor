---
phase: 04-timeline-preview
plan: 02
subsystem: timeline
tags: [canvas-2d, virtualized-rendering, dpi-scaling, thumbnail-cache, playhead, preact-signals]

# Dependency graph
requires:
  - phase: 04-timeline-preview
    provides: "frameMap, trackLayouts, timelineStore, PlaybackEngine from 04-01"
  - phase: 02-ui-image
    provides: "imageStore.getDisplayUrl() for thumbnail URLs"
provides:
  - "TimelineRenderer: pure Canvas 2D drawing with Retina DPI, virtualized rendering"
  - "ThumbnailCache: lazy image loading with redraw callback"
  - "TimelineInteraction: click-to-seek, drag scrub, wheel/pinch zoom"
  - "TimelineCanvas: Preact component wrapping canvas with signal subscriptions"
  - "Updated TimelinePanel with real controls wired to playbackEngine"
affects: [04-03-playback-controls, 05-compositing, 07-audio-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: [canvas-2d-retina-dpi, virtualized-frame-rendering, thumbnail-lazy-cache, pointer-capture-scrub, cursor-anchored-zoom]

key-files:
  created:
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/timeline/ThumbnailCache.ts
    - Application/src/components/timeline/TimelineInteraction.ts
    - Application/src/components/timeline/TimelineCanvas.tsx
  modified:
    - Application/src/components/layout/TimelinePanel.tsx

key-decisions:
  - "TimelineRenderer is a pure class with no signal dependencies -- all state passed via draw() params"
  - "ThumbnailCache returns null for unloaded images (caller draws placeholder) and fires onLoad for redraw"
  - "Pointer capture used for playhead scrubbing to maintain drag even when cursor leaves canvas"
  - "Cursor-anchored zoom: frame under cursor stays stable when zooming via wheel or pinch"
  - "formatTime utility duplicated in TimelinePanel (same as CanvasArea) -- can be shared later"

patterns-established:
  - "Canvas DPI scaling: getBoundingClientRect + devicePixelRatio + ctx.scale(dpr,dpr) for Retina"
  - "Virtualized canvas rendering: skip frames outside visible area (rangeX + rangeWidth < header || rangeX > width)"
  - "Thumbnail lazy cache: Map<id, HTMLImageElement> + Set<id> loading, onLoad callback triggers redraw"
  - "Cursor-anchored zoom: compute frameUnderCursor, apply new zoom, recompute scrollX to keep that frame at cursor position"

requirements-completed: [TIME-01, TIME-02, TIME-03, TIME-04, TIME-05]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 4 Plan 02: Timeline Canvas Rendering Summary

**Canvas-based timeline with virtualized frame thumbnails, playhead scrubbing, cursor-anchored zoom, and real playback controls replacing mock data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-03T13:02:46Z
- **Completed:** 2026-03-03T13:05:53Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Canvas 2D timeline renderer with Retina DPI scaling draws tracks, frames, ruler, and playhead
- Virtualized rendering skips off-screen frames for 100+ frame performance
- ThumbnailCache lazily loads images and triggers canvas redraw when loaded
- Full interaction layer: click-to-seek, playhead drag scrubbing with pointer capture, wheel/pinch zoom anchored at cursor
- TimelinePanel controls wired to playbackEngine with real timecode display, zoom slider, and Fit All button
- All hardcoded mock data (timelineClips, FX Track, Photos Track, Audio Track) removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TimelineRenderer and ThumbnailCache** - `b0f1a3c` (feat)
2. **Task 2: Create TimelineInteraction, TimelineCanvas, and update TimelinePanel** - `8bbe1e6` (feat)

## Files Created/Modified
- `Application/src/components/timeline/ThumbnailCache.ts` - Lazy-loading thumbnail image cache for canvas drawImage()
- `Application/src/components/timeline/TimelineRenderer.ts` - Pure Canvas 2D drawing with DPI scaling, virtualization, tracks, playhead
- `Application/src/components/timeline/TimelineInteraction.ts` - Mouse/wheel/touch event handling for seek, scrub, zoom
- `Application/src/components/timeline/TimelineCanvas.tsx` - Preact component wrapping canvas with signal-driven redraws
- `Application/src/components/layout/TimelinePanel.tsx` - Updated with real canvas timeline and playbackEngine-wired controls

## Decisions Made
- TimelineRenderer is a pure class with no signal dependencies -- all state passed via draw() params for testability
- ThumbnailCache returns null for unloaded images (caller draws placeholder) and fires onLoad for redraw
- Pointer capture used for playhead scrubbing to maintain drag even when cursor leaves canvas
- Cursor-anchored zoom: frame under cursor stays stable when zooming via wheel or pinch
- Step backward button added to TimelinePanel controls (not in original mock)
- formatTime utility duplicated in TimelinePanel (same as CanvasArea) -- can be extracted to shared utility later

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Canvas timeline ready for 04-03 (playback controls polish) to add keyboard shortcuts and transport refinements
- Track rendering ready for Phase 5 compositing layer visualization
- Interaction system ready for Phase 7 audio sync waveform display

## Self-Check: PASSED

All 5 created/modified files verified present on disk. Both task commits (b0f1a3c, 8bbe1e6) verified in git log.

---
*Phase: 04-timeline-preview*
*Completed: 2026-03-03*
