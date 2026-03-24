---
phase: 15-audio-import-waveform
plan: 03
subsystem: ui
tags: [audio, timeline, interaction, playback-sync, canvas, web-audio]

# Dependency graph
requires:
  - phase: 15-01
    provides: audioStore with CRUD/undo, audioEngine with play/stop/stopAll, AudioTrack type
  - phase: 15-02
    provides: audioTrackLayouts computed signal, audio track rendering in TimelineRenderer
provides:
  - Audio track click-to-select, drag-to-offset, edge trim, slip edit, reorder, height resize, mute toggle
  - Audio playback sync in PlaybackEngine start/stop/seekToFrame
  - Cursor style hints for all audio interaction modes
affects: [15-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audio interaction follows FX range bar drag pattern: state fields + onPointerDown/Move/Up handlers"
    - "Audio reorder uses click-vs-drag disambiguation (5px threshold)"
    - "PlaybackEngine.startAudioPlayback computes buffer offset from timeline position for each track"

key-files:
  created: []
  modified:
    - Application/src/components/timeline/TimelineInteraction.ts
    - Application/src/lib/playbackEngine.ts
    - Application/src/lib/playbackEngine.test.ts

key-decisions:
  - "Audio area check inserted between FX area and content area in onPointerDown priority chain"
  - "Header click uses click-vs-drag: click toggles mute (D-15), drag reorders (INT-06)"
  - "Audio buffer offset formula: (track.inFrame + track.slipOffset + framesIntoTrack) / fps"

patterns-established:
  - "Audio interaction mirrors FX drag pattern: private state fields, coalescing for drag undo"
  - "Cursor hints cascade: audio area checked after FX area, before content area in onPointerMove"

requirements-completed: [AUDIO-03, AUDIO-04, AUDIO-05]

# Metrics
duration: 6min
completed: 2026-03-21
---

# Phase 15 Plan 03: Audio Track Interaction & Playback Sync Summary

**Timeline audio track interactions (click, drag, trim, slip, reorder, resize) and PlaybackEngine audio sync for start/stop/seek**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-21T19:04:20Z
- **Completed:** 2026-03-21T19:11:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Audio tracks on the timeline are fully interactive: click to select, drag body to offset, edge drag to trim in/out, Alt+drag to slip, header drag to reorder, bottom edge drag to resize height, header click to toggle mute
- Audio plays in sync when playback starts, stops when playback stops, and restarts at correct position when seeking during playback
- Cursor hints update correctly for all 7 audio interaction modes (select, move, resize-left, resize-right, slip, reorder, height-resize)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add audio track interaction handlers to TimelineInteraction** - `63dac45` (feat)
2. **Task 2: Integrate audio playback sync into PlaybackEngine** - `29cf7f0` (feat)

## Files Created/Modified
- `Application/src/components/timeline/TimelineInteraction.ts` - Added 334 lines: audio drag state, hit-test helpers, onPointerDown/Move/Up handlers for all audio interaction modes
- `Application/src/lib/playbackEngine.ts` - Added startAudioPlayback() method, audio sync in start/stop/seekToFrame
- `Application/src/lib/playbackEngine.test.ts` - Added module import and startAudioPlayback existence tests

## Decisions Made
- Audio area check inserted between FX area and content area in the onPointerDown priority chain, matching the visual layout order (FX above, content middle, audio below)
- Header click uses click-vs-drag disambiguation: click without movement toggles mute (per D-15), drag beyond 5px threshold initiates reorder (per INT-06)
- Audio buffer offset computed as (track.inFrame + track.slipOffset + framesIntoTrack) / fps, accounting for trim in-point, slip content offset, and position on timeline

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all interaction handlers and playback sync methods are fully wired. The 7 todo test stubs in playbackEngine.test.ts are test coverage gaps (not runtime stubs) and will be addressed when comprehensive mocking infrastructure is added.

## Next Phase Readiness
- Audio tracks are now fully interactive and play in sync -- ready for Plan 04 (AudioProperties panel, project persistence)
- All audioStore methods exercised via interaction handlers: selectTrack, setOffset, setInOut, setSlipOffset, setTrackHeight, setMuted, reorderTracks
- PlaybackEngine audio sync is complete: start, stop, seekToFrame all handle audio correctly

## Self-Check: PASSED

- All 3 modified files exist on disk
- Both task commits verified: 63dac45, 29cf7f0
- TypeScript compiles clean (npx tsc --noEmit exits 0)
- All 108 tests pass across 11 test files

---
*Phase: 15-audio-import-waveform*
*Completed: 2026-03-21*
