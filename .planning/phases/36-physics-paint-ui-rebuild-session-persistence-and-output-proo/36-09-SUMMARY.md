---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 09
subsystem: ui
tags: [physics-paint, onion-skin, uat-gap-closure, play-preview]
requires:
  - phase: 36-07
    provides: Integrated PhysicsPaintStudio canvas-region onion preview surface
  - phase: 36-08
    provides: Tab-driven workflow strip conversion UX and current PhysicsPaintWorkflowStrip tests
provides:
  - Real standalone Roto onion preview snapshots from saved/navigated editable Roto frames
  - Onion overlay filtering by count, previous/next toggles, current-frame distance, and live-preview suppression
  - Save play behavior that preserves conversion frame data without reusing saved Play frames as post-save yellow/orange onion overlays
affects: [physics-paint-ui, standalone-physics-paint, onion-skin, uat-gap-5, uat-gap-7]
tech-stack:
  added: []
  patterns:
    - Local rendered Roto snapshot cache keyed by app frame, alongside editable Roto state cache
    - Source-contract regression tests for Physics Paint onion preview behavior
    - Play preview frames retained in a ref for explicit conversion only, not rendered as ordinary onion overlay source
key-files:
  created:
    - .planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-09-SUMMARY.md
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
key-decisions:
  - "Roto onion overlays now use local Roto snapshot frames and persisted Roto output only, excluding latest Play frames from normal post-save overlay rendering."
  - "Save play keeps captured frames in an internal ref for explicit Play-to-Roto conversion while clearing visible latestPlayFrames state to avoid yellow/orange onion artifacts."
  - "Frame navigation snapshots the current editable Roto frame before loading the target frame so adjacent previews become available immediately in the standalone window."
patterns-established:
  - "Snapshot current Roto content with engine.exportCompositeCanvas() during save/navigation; do not headlessly replay or batch render strokes."
  - "Use live-preview and onion toggle filtering in both builder and strip-level presentation paths."
requirements-completed: [UI-REBUILD-01, UI-REBUILD-02, SAVE-01, OUT-01]
duration: 6min
completed: 2026-06-13
---

# Phase 36 Plan 09: Roto Onion Preview Gap Closure Summary

**Standalone Roto onion previews now use real local snapshots, and saved Play frames no longer remain as yellow/orange onion overlays.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-13T09:40:41Z
- **Completed:** 2026-06-13T09:46:00Z
- **Tasks:** 2
- **Files modified:** 2 production/test files plus this summary

## Accomplishments

- Added regression coverage for onion preview filtering, live-preview suppression, real Roto preview sources, and exclusion of saved Play frames from ordinary onion overlay rendering.
- Added `rotoPreviewFramesRef`, keyed by app frame, alongside `rotoFrameStatesRef` so the standalone studio can display adjacent Roto onion frames without waiting for parent-store persistence.
- Snapshot current Roto canvas content on frame navigation and `Save roto frame` using the live interactive engine canvas.
- Updated `buildOnionPreviewFrames` to return no frames while playing and to build overlays from persisted Roto frames plus local Roto snapshots only.
- Changed `savePlay` so captured Play frames are retained for explicit Play-to-Roto conversion in a ref, while visible `latestPlayFrames` state is cleared to prevent the post-save yellow/orange overlay artifact.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: onion preview regression coverage** - `b919dcd` (test)
2. **Task 2 GREEN: standalone Roto preview snapshots** - `2377847` (feat)

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts` - Added source-contract assertions for onion count/direction/live-preview filtering, Roto preview source usage, and no post-save Play-frame onion overlay reuse.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Added local Roto rendered snapshot cache, save/navigation snapshotting, Roto-only onion frame building, and ref-backed Play frames for conversion-only use.
- `.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-09-SUMMARY.md` - Execution summary and verification record.

## Decisions Made

- Kept the fix local to Phase 36 standalone behavior instead of introducing the deferred Phase 38 source-lane model.
- Preserved explicit Play-to-Roto conversion by retaining captured Play frames in an internal ref, but prevented those frames from being rendered as ordinary onion previews after Save play.
- Used `engine.exportCompositeCanvas()` from the live mounted engine for snapshots, preserving the interactive incremental engine path and avoiding headless replay or `renderFromStrokes` batch rendering.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The RED test failed as intended before implementation because `PhysicsPaintStudio.tsx` had no `rotoPreviewFramesRef` and still used `latestPlayFrames` as an onion source.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts` — passed, 1 file / 8 tests.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` — passed.
- `grep -n "latestPlayFrames.*addFrame\|addFrame.*latestPlayFrames" /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx | grep -v "preview"; test $? -ne 0` — passed; no `latestPlayFrames` addFrame onion-source path remains.

## Known Stubs

None found in files created/modified by this plan. Decorative `alt=""` attributes on onion overlay images remain intentional accessibility markup, not UI data stubs.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - this plan changes local preview-only data URL rendering and UI tests only; it does not introduce new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries.

## Next Phase Readiness

UAT gap 5 and the yellow-overlay portion of UAT gap 7 are closed in source and tests. Remaining UAT gap 7 persistence/reopen behavior is outside this plan and remains for the dedicated persistence gap-closure work.

## Self-Check: PASSED

- Found `app/src/components/physic-paint/PhysicsPaintStudio.tsx`.
- Found `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`.
- Found task commit `b919dcd` in git history.
- Found task commit `2377847` in git history.
- Created `36-09-SUMMARY.md` in the phase directory.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-13*
