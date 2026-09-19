---
phase: quick-260902-cfa
plan: 260902-cfa
subsystem: physic-paint audio preview (seek wiring)
tags: [physics-paint, audio-preview, seek, ruler, d-02, d-09, truth-table]
requires:
  - Phase 41 audio monitor (efxPaintAudioMonitor playAtCursor/positionedAt, locked truth table)
  - Quick 260827-s52 ruler seek (onSeek → onNavigateToSyncedFrame → navigateToSyncedPhysicalFrame)
provides:
  - useRotoCachedPlayback.seek(targetAppFrame) — the single child-side seek funnel
  - navigateToSyncedPhysicalFrame seek wiring (wasPlaying guard + seek after frame-sync)
affects:
  - Phase 51 (Read-only Audio Preview)
tech-stack:
  added: []
  patterns:
    - Seek-while-playing = full audio seek-restart (playAtCursor = stopAll + re-dispatch, truth table section 5) with visual playback re-anchored at the target frame
    - Seek-while-idle / out-of-range / after-stop = silent positionedAt re-anchor (D-09), zero engine dispatch
key-files:
  created: []
  modified:
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
    - app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts
key-decisions:
  - "Seek-while-playing re-anchors the frame index past the target (the next timer tick shows the frame AFTER the target) and dispatches playAtCursor at the new cursor — main-editor seek-restart parity"
  - "Seek-while-idle / out-of-range / after-stop is a silent positionedAt re-anchor with zero engine dispatch (D-09)"
requirements-completed: [AUD-01, AUD-02, AUD-03, AUD-04]
coverage:
  - id: D1
    description: "seek(targetAppFrame) on useRotoCachedPlayback — re-anchor + full audio seek-restart when active, silent positionedAt when idle/out-of-range/after-stop"
    requirement: AUD-01
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts#seek (D-02 seek-restart / D-09 silent re-anchor)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Seek path wired in navigateToSyncedPhysicalFrame — wasPlaying guard skips the stop when playing, seek(frame) after the frame-sync message"
    requirement: AUD-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#wires the seek path: skips the playback stop when playing and seeks after navigation (D-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Regression tests pinning the seek wiring against the locked truth table (seek-while-idle silent re-anchor; seek-while-playing full seek-restart)"
    requirement: AUD-04
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts#seek wiring regression (260902-cfa: D-02 seek-restart / D-09 silent re-anchor)"
        status: pass
    human_judgment: false
metrics:
  duration: 25min
  completed: 2026-09-02
  tasks: 3
  commits: 4
actuals:
  tokens: 4400
  tasks: 3
  commits: 4
status: complete
---

# Quick 260902-cfa: Wire the Ruler Seek to the Audio Monitor Summary

**One-liner:** The v1.0 ruler seek / cursor navigation path now funnels into the Phase 41 audio monitor per D-02 — seek-while-playing performs a full audio seek-restart at the new cursor (playAtCursor = stopAll + re-dispatch) with visual playback re-anchored at the target frame, and seek-while-idle silently re-positions the audio anchor (positionedAt, D-09) with zero engine dispatch.

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-02T09:16:00Z
- **Completed:** 2026-09-02T09:18:30Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `useRotoCachedPlayback.seek(targetAppFrame)` — the single child-side seek funnel: active → re-anchor the frame index at the target + `playAtCursor(targetAppFrame, rangeEnd)` full audio seek-restart; idle/out-of-range/after-stop → silent `positionedAt(targetAppFrame)` re-anchor. The playback frame index moved from a `start()`-local `let frameIndex` to a `frameIndexRef` so seek can re-anchor it mid-playback.
- `navigateToSyncedPhysicalFrame` seek wiring — the unconditional `rotoCachedPlayback.stop()` became a `wasPlaying` guard (a playing seek keeps the playback timer running through the flush), and `rotoCachedPlayback.seek(frame)` runs after the frame-sync message. The seek method is the only audio wiring in the Studio (AUDIO-01 authority boundary preserved — no new monitor rule, no new UI, no audioStore/timelineStore/playbackEngine import).
- Regression tests pinning the seek wiring against the locked Phase 41 truth table: seek-while-idle re-anchors silently (D-09/D-02), seek-while-playing is a full seek-restart (truth table section 5 — stopAll before the new-cursor re-dispatch). All existing truth-table behaviors (frame identity, audible window, revision guard, fps-match, ownership, toggle, engine release) still pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add seek(targetAppFrame) to useRotoCachedPlayback** (tracer, TDD)
   - `d3427e97` (test: RED seek tests)
   - `be9c3ec3` (feat: GREEN seek implementation)
2. **Task 2: Wire the seek path in navigateToSyncedPhysicalFrame** - `8f2340dc` (feat)
3. **Task 3: Regression tests pinning the seek wiring against the locked truth table** - `7af5382f` (test)

## Files Created/Modified

- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts` - `frameIndexRef` (playback frame index moved off the start()-local), `seek(targetAppFrame)` on the interface + implementation, `seek` in the returned object
- `app/src/components/physic-paint/hooks/useRotoCachedPlayback.test.ts` - `positionedAt` audio mock + 4 seek tests (active re-anchor + playAtCursor once, idle positionedAt, out-of-range silent re-anchor, after-stop silent re-anchor)
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - `wasPlaying` guard around the stop, `rotoCachedPlayback.seek(frame)` after the frame-sync message
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - source-inspection contract test pinning the seek wiring (wasPlaying guard before stop, seek after frame-sync)
- `app/src/components/physic-paint/audio/efxPaintAudioPreview.test.ts` - 2 seek regression tests (seek-while-idle silent re-anchor; seek-while-playing full seek-restart with stopAll-before-redispatch order)

## Decisions Made

- **Seek-while-playing is a full audio seek-restart, never a nudge** (D-02, truth table section 5): `seek` routes through `playAtCursor` = stopAll + re-dispatch at the new cursor, matching the main-editor `seekToFrame` template (playbackEngine.ts: if playing, stopAll + restart at the new position — visual playback continues).
- **Seek-while-idle is a silent re-anchor** (D-09): `positionedAt` repositions the anchor with zero engine dispatch, ready for the next Play.
- **The seek method is the single audio funnel**: no other audio wiring was added in the Studio; the navigation handler only calls `rotoCachedPlayback.seek(frame)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Seek frame-index re-anchor off-by-one (plan action text vs behavior spec)**
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan's action text said `set frameIndexRef.current = targetIndex`, but the plan's own behavior spec (Test 1) requires "the next timer tick shows the frame AFTER the target". With `frameIndexRef.current = targetIndex`, the next tick would re-display the target frame (double-display) — the seek's playbackTick write already shows the target immediately, so the tick must advance past it. The main-editor seek-restart template (seekToFrame moves the current frame to the target, the tick loop then advances) confirms the advance-past semantics.
- **Fix:** `frameIndexRef.current = targetIndex + 1` — the target frame is displayed by the seek's playbackTick write + onFrame, and the next timer tick shows the frame after the target.
- **Files modified:** app/src/components/physic-paint/hooks/useRotoCachedPlayback.ts
- **Verification:** The seek test "seek while active re-anchors at the target and dispatches playAtCursor exactly once" asserts the next tick shows frame 10 (after target 9); full suite green.
- **Committed in:** be9c3ec3 (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The auto-fix was necessary for the behavior spec to hold (no double-display of the target frame). No scope creep.

## Issues Encountered

- The `createHarness` helper in `useRotoCachedPlayback.test.ts` does not expose the `onFrame` mock; the seek tests capture it locally instead (test-only adjustment, no production impact).

## Next Phase Readiness

- The seek path (ruler seek → onNavigateToSyncedFrame → navigateToSyncedPhysicalFrame → rotoCachedPlayback.seek) is wired end-to-end; `positionedAt` now has a production caller.
- Phase 51 (Read-only Audio Preview) can build on the single seek funnel; the locked Phase 41 truth-table regression suite remains green.

## Self-Check

- Files: useRotoCachedPlayback.ts, useRotoCachedPlayback.test.ts, PhysicsPaintStudio.tsx, PhysicsPaintStudio.test.ts, efxPaintAudioPreview.test.ts — all confirmed on disk.
- Commits: d3427e97, be9c3ec3, 8f2340dc, 7af5382f — all present in git log.
- Full suite: 3306 passed / 1 skipped / 101 todo (179 files); `tsc --noEmit` clean.

## Self-Check: PASSED

---
*Phase: quick-260902-cfa*
*Completed: 2026-09-02*
