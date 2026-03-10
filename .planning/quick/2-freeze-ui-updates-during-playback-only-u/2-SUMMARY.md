---
phase: quick
plan: 2
subsystem: ui
tags: [preact-signals, playback, performance, timeline]

requires:
  - phase: 07-cinematic-fx-effects
    provides: timelineStore, playbackEngine, TimelineCanvas, Preview
provides:
  - displayFrame/displayTime signals for frozen UI during playback
  - syncDisplayFrame() method for on-demand UI sync
affects: [timeline, preview, properties-panel]

tech-stack:
  added: []
  patterns: [dual-signal pattern for playback-frozen vs per-frame reactive state]

key-files:
  created: []
  modified:
    - Application/src/stores/timelineStore.ts
    - Application/src/lib/playbackEngine.ts
    - Application/src/components/layout/TimelinePanel.tsx
    - Application/src/components/layout/CanvasArea.tsx

key-decisions:
  - "displayFrame signal separate from currentFrame: UI panels subscribe to displayFrame which freezes during playback"
  - "syncDisplayFrame called on stop/seek/step only, not in tick loop -- prevents per-frame DOM updates"
  - "PropertiesPanel and LayerList unchanged -- they do not read currentFrame per-frame so no freeze needed"

patterns-established:
  - "Dual-signal pattern: currentFrame for render loop, displayFrame for UI panels"

requirements-completed: [QUICK-02]

duration: 1min
completed: 2026-03-10
---

# Quick Task 2: Freeze UI Updates During Playback Summary

**displayFrame/displayTime dual-signal pattern freezes timecode displays during playback while preview canvas and playhead continue animating per-frame**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-10T18:22:20Z
- **Completed:** 2026-03-10T18:23:32Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added displayFrame and displayTime signals to timelineStore that only update on stop/scrub/step (not per-frame during playback)
- Wired PlaybackEngine to call syncDisplayFrame() on stop, seekToFrame, stepForward, stepBackward
- Switched TimelinePanel and CanvasArea timecode displays from currentTime to displayTime
- Preview canvas and TimelineCanvas continue using currentFrame for per-frame rendering (unchanged)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add displayFrame signal and wire PlaybackEngine to sync it** - `5b0a880` (feat)
2. **Task 2: Switch UI components to use displayFrame/displayTime** - `5e2773f` (feat)

## Files Created/Modified
- `Application/src/stores/timelineStore.ts` - Added displayFrame signal, displayTime computed, syncDisplayFrame() method
- `Application/src/lib/playbackEngine.ts` - Added syncDisplayFrame() calls in stop/seekToFrame/stepForward/stepBackward
- `Application/src/components/layout/TimelinePanel.tsx` - Timecode display switched to displayTime
- `Application/src/components/layout/CanvasArea.tsx` - Timecode display switched to displayTime

## Decisions Made
- Used separate displayFrame signal rather than gating currentFrame writes -- cleaner separation, no impact on render loop consumers
- PropertiesPanel and LayerList left unchanged: they do not subscribe to currentFrame/currentTime directly, so they do not re-render per-frame during playback
- syncDisplayFrame() placed in PlaybackEngine (consumer) rather than in seek/step methods (source) to avoid redundant writes during tick loop

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

- All 4 modified files exist on disk
- Commit 5b0a880 (Task 1) verified in git log
- Commit 5e2773f (Task 2) verified in git log
- TypeScript compiles clean (npx tsc --noEmit)

---
*Quick task: 2-freeze-ui-updates-during-playback-only-u*
*Completed: 2026-03-10*
