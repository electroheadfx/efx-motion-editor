---
phase: 05-editing-infrastructure
plan: 05
subsystem: playback
tags: [jkl-shuttle, playback-engine, preact-signals, keyboard-shortcuts]

# Dependency graph
requires:
  - phase: 05-editing-infrastructure
    provides: "Keyboard shortcuts system (tinykeys), initial JKL shuttle, PlaybackEngine"
provides:
  - "Split-responsibility JKL shuttle: state-only module with direction/speed signals"
  - "PlaybackEngine reads shuttle speed/direction for variable-rate playback"
  - "Auto-loop at frame boundaries (forward wraps to start, reverse wraps to end)"
  - "Updated ShortcutsOverlay descriptions matching new JKL behavior"
affects: [playback, preview, timeline]

# Tech tracking
tech-stack:
  added: []
  patterns: ["split-responsibility: shuttle state vs playback loop decoupled"]

key-files:
  created: []
  modified:
    - Application/src/lib/jklShuttle.ts
    - Application/src/lib/playbackEngine.ts
    - Application/src/components/overlay/ShortcutsOverlay.tsx

key-decisions:
  - "JKL shuttle is purely state-only (no rAF loop); PlaybackEngine reads shuttle signals in its tick"
  - "Space is sole play/stop control; J/L only modify direction and speed tier"
  - "K resets to 1x forward without stopping playback (Space owns stop)"
  - "Playback auto-loops endlessly at boundaries instead of stopping"
  - "stop() calls resetShuttle() for clean state when playback stops"

patterns-established:
  - "Split-responsibility shuttle: state module exports signals, engine reads them via .peek()"
  - "Auto-loop playback: seek(0) on forward boundary, seek(maxFrames-1) on reverse boundary"

requirements-completed: [KEY-01, KEY-03]

# Metrics
duration: 2min
completed: 2026-03-09
---

# Phase 05 Plan 05: JKL Shuttle Rewrite Summary

**Split-responsibility JKL shuttle: Space owns play/stop, J/L set direction and speed tier, K resets to 1x forward, PlaybackEngine auto-loops at boundaries**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-09T21:11:29Z
- **Completed:** 2026-03-09T21:13:30Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Rewrote jklShuttle.ts from rAF-based loop to pure state-only module exporting direction/speed signals
- Modified PlaybackEngine tick() to read shuttleSpeed and shuttleDirection for variable-rate directional playback
- Added auto-loop at frame boundaries (forward wraps to frame 0, reverse wraps to last frame)
- Updated ShortcutsOverlay descriptions to match new split-responsibility model

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite jklShuttle.ts and update PlaybackEngine** - `fc6d0db` (feat)
2. **Task 2: Update ShortcutsOverlay descriptions** - `164cd99` (feat)

## Files Created/Modified
- `Application/src/lib/jklShuttle.ts` - State-only shuttle module: exports shuttleDirection, shuttleSpeedTier, shuttleSpeed signals; pressJ/pressK/pressL modify state only
- `Application/src/lib/playbackEngine.ts` - Reads shuttle speed/direction in tick(), auto-loops at boundaries, stop() resets shuttle
- `Application/src/components/overlay/ShortcutsOverlay.tsx` - Updated J/K/L descriptions to match new behavior

## Decisions Made
- JKL shuttle is purely state-only (no rAF loop); PlaybackEngine reads shuttle signals in its tick -- clean separation of concerns
- Space is sole play/stop control; J/L only modify direction and speed tier -- matches user's requested UX model
- K resets to 1x forward without stopping playback -- differs from DaVinci Resolve model where K stops
- Playback auto-loops endlessly at boundaries instead of stopping -- user-requested behavior for stop-motion editing
- stop() calls resetShuttle() for clean state when playback stops via Space

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- JKL shuttle and playback engine fully rewritten with split-responsibility model
- Ready for UAT verification of new shuttle behavior
- SpeedBadge continues to work via existing currentSpeedLabel/showSpeedBadge signals (no changes needed)

## Self-Check: PASSED

- All 3 modified files exist on disk
- Commit fc6d0db (Task 1) verified in git log
- Commit 164cd99 (Task 2) verified in git log
- TypeScript compilation: PASS
- Vite build: PASS
- jklShuttle.ts has 0 requestAnimationFrame calls: PASS
- playbackEngine.ts reads shuttleSpeed/shuttleDirection: PASS
- playbackEngine.ts auto-loops at boundaries: PASS

---
*Phase: 05-editing-infrastructure*
*Completed: 2026-03-09*
