---
phase: 04-timeline-preview
plan: 01
subsystem: timeline
tags: [preact-signals, motion-canvas, raf, playback, frame-map, computed-signals]

# Dependency graph
requires:
  - phase: 03-project-sequence
    provides: "sequenceStore with Sequence/KeyPhoto data, projectStore with fps"
  - phase: 01-foundation
    provides: "Motion Canvas player embedding, asset protocol, IPC layer"
provides:
  - "frameMap computed signal (linear frame array from sequences)"
  - "totalFrames and trackLayouts computed signals"
  - "PlaybackEngine class with rAF delta-time accumulation"
  - "previewScene.tsx Motion Canvas scene with Img node"
  - "previewBridge.ts signal for frame-to-image URL bridging"
  - "Preview component with frame image display and playback engine wiring"
affects: [04-02-timeline-canvas, 04-03-playback-controls, 05-compositing, 07-audio-sync]

# Tech tracking
tech-stack:
  added: []
  patterns: [rAF-delta-accumulation, computed-frame-map, preview-bridge-signal, peek-in-raf]

key-files:
  created:
    - Application/src/lib/frameMap.ts
    - Application/src/lib/playbackEngine.ts
    - Application/src/lib/previewBridge.ts
    - Application/src/scenes/previewScene.tsx
  modified:
    - Application/src/types/timeline.ts
    - Application/src/stores/timelineStore.ts
    - Application/src/project.ts
    - Application/src/components/Preview.tsx

key-decisions:
  - "PlaybackEngine uses performance.now() delta accumulation (not setInterval or frame counting) for PREV-05 audio sync readiness"
  - "Preview uses img overlay for reliable image display; Motion Canvas player kept hidden for Phase 5 compositing"
  - "Uses .peek() inside rAF tick to avoid Preact signal subscription tracking outside effects"
  - "timelineStore.seek() and stepForward() clamp to totalFrames-1 upper bound"

patterns-established:
  - "rAF delta accumulation: accumulator += delta, while loop drains frameDuration chunks for multi-frame catch-up"
  - "Preview bridge signal: previewBridge.ts holds currentPreviewUrl for decoupled frame-to-image mapping"
  - "Computed frame map: sequenceStore.sequences -> linear FrameEntry[] via nested loops"
  - "peek() in rAF: all signal reads inside requestAnimationFrame tick use .peek() not .value"

requirements-completed: [PREV-01, PREV-02, PREV-03, PREV-05]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 4 Plan 01: Timeline Data Layer & Preview Engine Summary

**Frame map computed signal, rAF PlaybackEngine with delta-time accumulation, and Preview component with frame-accurate image display**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T12:57:44Z
- **Completed:** 2026-03-03T12:59:51Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Frame map computed signal flattens all sequences' key photos into linear FrameEntry array with globalFrame indexing
- PlaybackEngine class uses rAF with performance.now() delta accumulation for frame-rate-limited playback at project fps
- Preview component displays current frame's image via img overlay with object-fit: contain letterboxing
- timelineStore extended with totalFrames, totalDuration, and upper-bound clamping on seek/step

## Task Commits

Each task was committed atomically:

1. **Task 1: Create frame map, extend timeline types, and extend timelineStore** - `b3ceee6` (feat)
2. **Task 2: Create PlaybackEngine, preview scene, and wire Preview component** - `b68ab39` (feat)

## Files Created/Modified
- `Application/src/types/timeline.ts` - Added FrameEntry, TrackLayout, KeyPhotoRange types
- `Application/src/lib/frameMap.ts` - Computed frame map, totalFrames, trackLayouts signals
- `Application/src/stores/timelineStore.ts` - Added totalFrames, totalDuration, seek/step clamping
- `Application/src/lib/playbackEngine.ts` - PlaybackEngine class with rAF delta-time accumulation
- `Application/src/lib/previewBridge.ts` - currentPreviewUrl signal bridge
- `Application/src/scenes/previewScene.tsx` - Motion Canvas scene with Img node (Phase 5 ready)
- `Application/src/project.ts` - Updated to use previewScene instead of testScene
- `Application/src/components/Preview.tsx` - Rewired with playback engine, frame image display

## Decisions Made
- PlaybackEngine uses performance.now() delta accumulation (not setInterval) for PREV-05 audio sync readiness
- Preview uses plain img overlay for reliable image display; Motion Canvas player kept hidden for Phase 5 compositing
- Uses .peek() inside rAF tick to avoid Preact signal subscription tracking outside effects
- timelineStore.seek() and stepForward() clamp to [0, totalFrames-1] upper bound

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Frame map and playback engine ready for 04-02 (timeline canvas) to render track layouts
- PlaybackEngine ready for 04-03 (playback controls) to wire play/pause/step buttons
- previewScene.tsx placeholder ready for Phase 5 compositing layer rendering
- performance.now() timing foundation ready for Phase 7 audio sync

## Self-Check: PASSED

All 8 created/modified files verified present on disk. Both task commits (b3ceee6, b68ab39) verified in git log.

---
*Phase: 04-timeline-preview*
*Completed: 2026-03-03*
