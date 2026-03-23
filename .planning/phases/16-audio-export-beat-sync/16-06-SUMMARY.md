---
phase: 16-audio-export-beat-sync
plan: 06
subsystem: ui
tags: [beat-sync, snap-to-beat, preact, signals, audio]

requires:
  - phase: 16-audio-export-beat-sync (plan 03)
    provides: beatMarkerEngine with snapToBeat, audioStore BPM integration, beat markers
provides:
  - snapHoldFramesToBeat pure function in beatMarkerEngine.ts
  - Snap-to-beat button in FramesPopover for key photo hold duration alignment
  - BEAT-04 gap closure for snap key photo hold-duration to nearest beat marker
affects: []

tech-stack:
  added: []
  patterns:
    - "Snap-to-beat uses Infinity threshold to always snap to nearest marker"
    - "Conditional UI rendering based on audioStore signal state (BPM presence)"

key-files:
  created: []
  modified:
    - Application/src/lib/beatMarkerEngine.ts
    - Application/src/lib/beatMarkerEngine.test.ts
    - Application/src/components/sequence/KeyPhotoStrip.tsx

key-decisions:
  - "D-20: Infinity threshold for snap-to-beat in FramesPopover (always snap to nearest, no distance limit)"
  - "D-21: kpStartFrame computed from trackLayouts.peek() in KeyPhotoCard for snap computation"

patterns-established:
  - "Snap-to-beat button conditionally renders based on audioStore.tracks/selectedTrackId signal values"

requirements-completed: [BEAT-04]

duration: 4min
completed: 2026-03-23
---

# Phase 16 Plan 06: Snap-to-Beat in FramesPopover Summary

**snapHoldFramesToBeat pure function with TDD tests and conditional Snap-to-beat button in KeyPhotoStrip FramesPopover**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T20:25:12Z
- **Completed:** 2026-03-23T20:29:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `snapHoldFramesToBeat` to beatMarkerEngine.ts with 5 TDD test cases (24 total tests pass)
- Added conditional "Snap to beat" button with Music icon in FramesPopover, visible only when an audio track with BPM data is selected
- Wired startFrame computation from trackLayouts in KeyPhotoCard for correct snap alignment

## Task Commits

Each task was committed atomically:

1. **Task 1: Add snapHoldFramesToBeat pure function with tests** - `c386de8` (test)
2. **Task 2: Add snap-to-beat button in FramesPopover** - `a346af8` (feat)

## Files Created/Modified
- `Application/src/lib/beatMarkerEngine.ts` - Added snapHoldFramesToBeat export (delegates to snapToBeat, translates startFrame+holdFrames domain)
- `Application/src/lib/beatMarkerEngine.test.ts` - Added 5 test cases for snapHoldFramesToBeat covering snap, threshold, no-markers, min-hold cases
- `Application/src/components/sequence/KeyPhotoStrip.tsx` - Added audioStore/snapHoldFramesToBeat/Music imports, startFrame prop, handleSnapToBeat callback, conditional Snap-to-beat button, kpStartFrame computation

## Decisions Made
- Used Infinity threshold for snap-to-beat in FramesPopover (always snap to nearest marker regardless of distance) since user explicitly clicks the button
- Computed kpStartFrame via trackLayouts.peek() in KeyPhotoCard rather than passing through from parent, keeping prop interface minimal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data paths are fully wired (audioStore signals -> beatMarkers -> snapHoldFramesToBeat -> onCommit).

## Next Phase Readiness
- BEAT-04 gap closure complete: users can now snap key photo hold-duration to nearest beat marker via FramesPopover button
- Phase 16 gap closure plans (16-04 through 16-06) are all complete

---
*Phase: 16-audio-export-beat-sync*
*Completed: 2026-03-23*

## Self-Check: PASSED
- All 3 source files exist
- Both task commits verified (c386de8, a346af8)
- SUMMARY.md created
