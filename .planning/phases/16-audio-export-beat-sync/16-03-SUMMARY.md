---
phase: 16-audio-export-beat-sync
plan: 03
subsystem: audio
tags: [bpm, beat-markers, snap-to-beat, auto-arrange, timeline-rendering, project-format]

# Dependency graph
requires:
  - phase: 16-audio-export-beat-sync
    plan: 01
    provides: BPM detector, beat marker engine, AudioTrack BPM fields, ExportSettings includeAudio
provides:
  - audioStore BPM integration (detectAndSetBPM, recalculateBeatMarkers, updateTrackSilent)
  - Beat marker rendering on timeline (amber vertical lines with downbeat distinction)
  - Beat markers and snap-to-beat toggle buttons in timeline toolbar
  - Snap-to-beat during playhead scrubbing
  - AudioProperties BPM editing section (manual BPM, x2/div2, beat offset, re-detect)
  - AudioProperties auto-arrange section (strategy selector, Apply button, atomic undo)
  - Project format v12 with BPM field persistence
  - sequenceStore.snapshot, restore, updateKeyPhotoSilent exports
affects: [audioStore, sequenceStore, TimelineRenderer, TimelineInteraction, TimelinePanel, AudioProperties, projectStore]

# Tech tracking
tech-stack:
  added: []
  patterns: [beat marker Canvas 2D rendering with downbeat distinction, snap-to-beat magnetic interaction, auto-arrange atomic undo via snapshot/restore]

key-files:
  created: []
  modified:
    - Application/src/stores/audioStore.ts
    - Application/src/stores/sequenceStore.ts
    - Application/src/stores/projectStore.ts
    - Application/src/stores/projectStore.test.ts
    - Application/src/types/timeline.ts
    - Application/src/lib/frameMap.ts
    - Application/src/components/views/ImportedView.tsx
    - Application/src/components/timeline/TimelineRenderer.ts
    - Application/src/components/timeline/TimelineCanvas.tsx
    - Application/src/components/timeline/TimelineInteraction.ts
    - Application/src/components/layout/TimelinePanel.tsx
    - Application/src/components/sidebar/AudioProperties.tsx

key-decisions:
  - "Avoided circular dep audioStore->frameMap->audioStore by passing totalFrames as optional param with fallback"
  - "Beat markers render from selected audio track only to avoid visual chaos with multiple tracks"
  - "Snap-to-beat integrated into playhead scrubbing as immediate value; key photo boundary drag TBD"
  - "Auto-arrange uses sequenceStore.snapshot/restore for atomic undo of multi-key-photo batch update"
  - "Project format bumped to v12 (BPM fields already serialized conditionally in Plan 01)"

patterns-established:
  - "Beat marker rendering: amber lines at 20-30% opacity (50% for downbeats), zoom-based fade"
  - "Snap-to-beat: 10px magnetic threshold converted to frame units based on zoom"
  - "Auto-arrange: snapshot/restore pattern with pushAction for batch undoable operations"

requirements-completed: [BEAT-02, BEAT-03, BEAT-04, BEAT-05]

# Metrics
duration: 10min
completed: 2026-03-23
---

# Phase 16 Plan 03: Beat Sync Integration Summary

**Beat marker timeline rendering, BPM editing with x2/div2 and auto-arrange UI, snap-to-beat interaction, and project format v12 persistence**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-23T13:49:07Z
- **Completed:** 2026-03-23T13:59:18Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments
- Added BPM detection integration to audioStore with detectAndSetBPM triggering on audio import
- Beat markers render as amber vertical lines on timeline with downbeat distinction (brighter, thicker)
- Timeline toolbar has Music (beat markers) and Magnet (snap) toggle buttons visible when audio tracks exist
- AudioProperties panel has full BPM editing section with manual input, x2/div2, beat offset, re-detect
- Auto-arrange distributes key photos to beat positions with every-beat/2-beats/bar strategy selector
- Project format bumped to v12 with BPM data persistence and v11 backward compatibility
- Exposed snapshot/restore/updateKeyPhotoSilent from sequenceStore for external atomic operations

## Task Commits

Each task was committed atomically:

1. **Task 1: audioStore BPM integration + project persistence v12** - `6998a85` (feat)
2. **Task 2: Beat marker rendering + timeline toolbar toggles + snap-to-beat** - `7103c8f` (feat)
3. **Task 3: AudioProperties BPM editing and auto-arrange UI** - `6e4300d` (feat)

## Files Created/Modified
- `Application/src/stores/audioStore.ts` - Added BPM signals, detectAndSetBPM, recalculateBeatMarkers, updateTrackSilent, toggles
- `Application/src/stores/sequenceStore.ts` - Exported snapshot, restore, added updateKeyPhotoSilent
- `Application/src/stores/projectStore.ts` - Bumped version to 12
- `Application/src/stores/projectStore.test.ts` - Updated version assertion from 10 to 12
- `Application/src/types/timeline.ts` - Added beatMarkers, showBeatMarkers, bpm to AudioTrackLayout
- `Application/src/lib/frameMap.ts` - Pass BPM fields through audioTrackLayouts computed signal
- `Application/src/components/views/ImportedView.tsx` - Trigger BPM auto-detection on audio import
- `Application/src/components/timeline/TimelineRenderer.ts` - drawBeatMarkers method, DrawState extension, call in draw()
- `Application/src/components/timeline/TimelineCanvas.tsx` - Pass beatMarkersVisible and snapToBeatsEnabled to DrawState
- `Application/src/components/timeline/TimelineInteraction.ts` - snapFrame utility, snap-to-beat in scrubbing
- `Application/src/components/layout/TimelinePanel.tsx` - Music and Magnet toggle buttons in toolbar
- `Application/src/components/sidebar/AudioProperties.tsx` - BPM section, AutoArrangeSection component

## Decisions Made
- Avoided circular dependency by not importing totalFrames from frameMap in audioStore; instead pass as optional param with fallback to audio duration calculation
- Beat markers render from selected audio track only (not all tracks) to avoid visual clutter
- Snap-to-beat integrated into playhead scrubbing as immediate useful interaction; full key photo boundary drag snap will come when that feature is implemented
- Auto-arrange uses the snapshot/restore/pushAction pattern for atomic undo of multi-key-photo batch updates
- Version test in projectStore.test.ts was already failing (expected 10, code was 11) -- updated to 12

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Avoided circular dependency audioStore -> frameMap -> audioStore**
- **Found during:** Task 1
- **Issue:** Plan imports totalFrames from frameMap in audioStore, but frameMap already imports audioStore
- **Fix:** Made totalFrames an optional parameter in detectAndSetBPM and recalculateBeatMarkers with fallback calculation from audio buffer duration
- **Files modified:** Application/src/stores/audioStore.ts
- **Committed in:** 6998a85

**2. [Rule 1 - Bug] Fixed pre-existing version test assertion**
- **Found during:** Task 3 verification
- **Issue:** projectStore.test.ts expected version 10 but code was version 11 (pre-existing failure)
- **Fix:** Updated test to expect version 12 matching current project format
- **Files modified:** Application/src/stores/projectStore.test.ts
- **Committed in:** 6e4300d

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Key photo boundary dragging does not exist in TimelineInteraction.ts. Plan assumed it did. Snap-to-beat was instead integrated into playhead scrubbing (the existing drag-to-position behavior). The snapFrame utility is available for future boundary drag implementation.

## Known Stubs
None - all implementations are complete and functional.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Plan 01 + Plan 03 features integrated: BPM detection on import, beat markers on timeline, snap-to-beat, auto-arrange, project persistence
- Plan 02 (store integration and audio export) can proceed independently
- audioStore has full BPM lifecycle: detect, edit, recalculate, persist, restore

## Self-Check: PASSED

All 12 files verified present. All 3 task commits found in git history.

---
*Phase: 16-audio-export-beat-sync*
*Completed: 2026-03-23*
