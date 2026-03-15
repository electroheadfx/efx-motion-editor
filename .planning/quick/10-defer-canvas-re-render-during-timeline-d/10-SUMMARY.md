---
phase: quick-10
plan: 01
subsystem: ui
tags: [preact-signals, canvas, performance, timeline, drag]

requires:
  - phase: 12-layer-keyframe-animation
    provides: keyframe drag interaction in TimelineInteraction.ts
provides:
  - timelineDragging signal gating Preview canvas renders during timeline drags
  - Deferred render pattern for expensive compositing during drag operations
affects: [timeline, preview, playback]

tech-stack:
  added: []
  patterns: [signal-based render gating for drag operations]

key-files:
  created: []
  modified:
    - Application/src/stores/timelineStore.ts
    - Application/src/components/Preview.tsx
    - Application/src/components/timeline/TimelineInteraction.ts

key-decisions:
  - "Gate Preview render effect via early-return on timelineDragging signal (Preact signals track deps before early return, so false->true->false transition triggers re-render)"
  - "Playhead scrub during drag uses timelineStore.seek() instead of playbackEngine.seekToFrame() to avoid syncDisplayFrame"

patterns-established:
  - "Signal-gated render deferral: use a boolean signal to skip expensive effects during continuous interactions, re-render on signal transition"

requirements-completed: [QUICK-10]

duration: 21min
completed: 2026-03-15
---

# Quick Task 10: Defer Canvas Re-render During Timeline Drags Summary

**timelineDragging signal gates Preview render effect to skip expensive compositing during playhead scrub, FX range drag, and keyframe drag -- rendering once on mouseup**

## Performance

- **Duration:** 21 min
- **Started:** 2026-03-15T15:04:13Z
- **Completed:** 2026-03-15T15:25:17Z
- **Tasks:** 1 (+ 1 human-verify checkpoint)
- **Files modified:** 3

## Accomplishments
- Added `timelineDragging` signal to timelineStore that acts as a render gate
- Preview.tsx render effect early-returns when timelineDragging is true, skipping full compositing pass (blur, generators, keyframe interpolation)
- All three timeline drag types (playhead scrub, FX range drag, keyframe drag) set the flag on drag start and clear it on drag end
- Playhead scrub during drag uses `timelineStore.seek()` instead of `playbackEngine.seekToFrame()` to avoid triggering displayFrame updates
- Single-click seek, step forward/backward, and rAF playback loop are unaffected (no regression)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add timelineDragging signal and gate Preview renders** - `979325f` (perf)

## Files Created/Modified
- `Application/src/stores/timelineStore.ts` - Added timelineDragging signal and setTimelineDragging method
- `Application/src/components/Preview.tsx` - Added early-return guard in render effect when timelineDragging is true
- `Application/src/components/timeline/TimelineInteraction.ts` - Set timelineDragging true/false on drag start/end for playhead scrub, FX range drag, keyframe drag; playhead scrub during drag uses seek() instead of seekToFrame()

## Decisions Made
- Gate Preview render effect via early-return on timelineDragging signal. Preact signals track dependencies accessed before an early return, so when timelineDragging transitions from true to false the effect re-runs and performs the full render with current state.
- Playhead scrub during drag uses `timelineStore.seek()` (updates currentFrame only) instead of `playbackEngine.seekToFrame()` (which also calls syncDisplayFrame). This means the timeline canvas (which reads currentFrame) updates in real-time while the Preview canvas (which reads displayFrame) stays frozen.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Performance optimization complete, ready for further timeline interactions
- Pattern can be reused for any future drag operations that trigger expensive renders

## Self-Check: PASSED

- FOUND: Application/src/stores/timelineStore.ts
- FOUND: Application/src/components/Preview.tsx
- FOUND: Application/src/components/timeline/TimelineInteraction.ts
- FOUND: 10-SUMMARY.md
- FOUND: commit 979325f

---
*Quick Task: 10-defer-canvas-re-render-during-timeline-d*
*Completed: 2026-03-15*
