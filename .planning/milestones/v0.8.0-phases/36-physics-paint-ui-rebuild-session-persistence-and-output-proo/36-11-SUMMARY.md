---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 11
subsystem: physics-paint-session-persistence
tags: [physics-paint, play-canvas, persistence, launch-context, uat-gap-closure]
requires:
  - phase: 36-08
    provides: Tab-driven Roto/Play workflow conversion UX without standalone conversion buttons
  - phase: 36-09
    provides: Save play no longer reuses latestPlayFrames as post-save onion overlays
  - phase: 36-10
    provides: Active rebuilt Studio save-state path after native dialog gap closure
provides:
  - Typed Play workflow metadata on Physics Paint serialized outputs and launch contexts
  - Project output round-trip for workflow mode, Play start frame, frame count, and editable source association
  - Browser and Tauri native launch-context parity for saved Play workflow metadata
  - PhysicsPaintStudio initialization from saved Play launch metadata rather than hardcoded Roto/default range
affects: [physics-paint-ui, save-play, standalone-physics-paint, project-serialization, tauri-launch]
tech-stack:
  added: []
  patterns:
    - Narrow primitive Play metadata beside existing rendered frames and editable state
    - Store-owned workflow metadata hydration reused by bridge launch context
    - Studio startup state derived from validated launch context metadata
key-files:
  created:
    - app/src/components/physic-paint/PhysicsPaintStudio.test.tsx
    - .planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-11-SUMMARY.md
  modified:
    - app/src/types/physicPaint.ts
    - app/src/types/physicPaint.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src-tauri/src/lib.rs
key-decisions:
  - "Persist only narrow Play workflow primitives: workflowMode, playStartFrame, playFrameCount, and editableSource."
  - "Saved Play output relaunch uses the persisted Play start frame as the standalone Studio start frame so the user lands back in the saved range."
  - "Keep latestPlayFrames excluded from ordinary onion overlay rendering; Plan 36-09's yellow-overlay fix remains intact."
patterns-established:
  - "physicPaintStore owns Play workflow metadata and exposes getWorkflowMetadata for launch-context creation."
  - "Tauri native launch forwards metadata as URL primitives while still excluding large editableState from the URL."
requirements-completed: [SAVE-01, SAVE-02, OUT-01, OUT-02]
duration: 12min
completed: 2026-06-13
---

# Phase 36 Plan 11: Play Workflow Persistence Summary

**Save play now persists Play canvas workflow/range/source metadata and relaunches the standalone Studio back into the saved Play canvas context.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-13T10:41:28Z
- **Completed:** 2026-06-13T10:53:00Z
- **Tasks:** 2
- **Files modified:** 8 production/test files plus this summary

## Accomplishments

- Added RED regression coverage for Play metadata validation, store serialization/hydration, bridge launch context creation, and direct Studio relaunch hydration contracts.
- Added `PhysicPaintWorkflowMetadata` with optional `workflowMode`, `playStartFrame`, `playFrameCount`, and `editableSource` fields on `PhysicPaintLaunchContext`.
- Persisted workflow metadata in `physicPaintStore` when Save play succeeds and through `toMceOutputs` / `loadFromMceOutputs` using project-file keys `workflow_mode`, `play_start_frame`, `play_frame_count`, and `editable_source`.
- Updated Play/Roto conversions to switch metadata back to Roto or Play as appropriate.
- Updated `createPhysicPaintLaunchContext` to hydrate persisted metadata and use saved Play start frame when reopening saved Play output.
- Updated `PhysicsPaintStudio` startup and Tauri launch-listener hydration so workflow mode and frame range initialize from launch context instead of hardcoded Roto/default values.
- Added native Tauri launch parity for optional FPS/workflow/range/editable-source fields while keeping large `editableState` out of the URL.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add Play metadata persistence regressions** - `4d8f025` (test)
2. **Task 2 GREEN: Persist Play workflow metadata** - `ea24891` (feat)

## Files Created/Modified

- `app/src/types/physicPaint.ts` - Added workflow metadata types and launch-context validation for optional workflow/range/editable-source metadata.
- `app/src/types/physicPaint.test.ts` - Covered valid Play launch metadata and invalid workflow mode/start/count cases.
- `app/src/stores/physicPaintStore.ts` - Stored, serialized, hydrated, and exposed workflow metadata alongside frames/editable state.
- `app/src/stores/physicPaintStore.test.ts` - Covered Save play metadata, Play/Roto conversion metadata changes, and project output round-trip.
- `app/src/lib/physicPaintBridge.ts` - Included persisted workflow metadata in browser/native launch context and reopened saved Play output at the saved Play start frame.
- `app/src/lib/physicPaintBridge.test.ts` - Covered launch metadata hydration and adjusted project serialization expectations for Roto metadata.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Initialized workflow mode and Play frame range from launch context and kept Play start range consistent during save/preview/convert flows.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.tsx` - Added source-contract regression coverage for direct Studio relaunch hydration.
- `app/src-tauri/src/lib.rs` - Accepted and forwarded optional FPS/workflow/range/editable-source launch fields in the native window URL path.

## Decisions Made

- Kept Phase 36 scope narrow by persisting only primitives needed to restore the saved Play canvas context, not Phase 38 source lanes or hybrid/overlap behavior.
- Used `editableSource: 'play' | 'roto'` as the minimal editable source association so the saved editable state can be interpreted as a Play source after Save play.
- Preserved Plan 36-09 behavior by leaving `latestPlayFrames` out of normal onion preview sources after Save play.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The initial RED suite failed as expected: launch-context validation accepted unknown optional fields, store metadata APIs did not exist, project outputs omitted Play metadata, bridge launch context omitted Play metadata, and Studio still used hardcoded Roto/default startup state.
- During GREEN verification, existing bridge project-serialization expectations needed to accept the new Roto metadata fields on still apply outputs; the test was updated to assert the new contract explicitly.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/types/physicPaint.test.ts src/stores/physicPaintStore.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/PhysicsPaintStudio.test.tsx src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts` — passed, 4 files / 47 tests reported for executed suites.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` — passed.
- `cargo check --manifest-path /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/Cargo.toml` — passed.
- `grep -n "useState<PhysicsPaintWorkflowMode>('roto')" /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx; test $? -ne 0` — passed; hardcoded Roto startup state is gone.

## Known Stubs

None found in files created/modified by this plan. Existing empty-array/null state initializers in `PhysicsPaintStudio.tsx` remain runtime state defaults/resets, not UI placeholder data.

## Threat Flags

None beyond the planned trust-boundary changes. New project-file and launch-context metadata fields are narrow optional primitives validated before use; no new network endpoints, auth paths, or file-access surfaces were introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The persistence/reopen portion of active UAT gap 7 is closed in source and tests. Saved Play output now carries enough metadata for standalone relaunch to restore Play canvas mode, saved range, and editable source context without reintroducing the Plan 36-09 yellow onion overlay behavior.

## Self-Check: PASSED

- Found `/Users/lmarques/Dev/efx-motion-editor/app/src/types/physicPaint.ts`.
- Found `/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts`.
- Found `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts`.
- Found `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx`.
- Found `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.test.tsx`.
- Found `/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/src/lib.rs`.
- Found task commit `4d8f025` in git history.
- Found task commit `ea24891` in git history.
- Created `/Users/lmarques/Dev/efx-motion-editor/.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-11-SUMMARY.md`.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-13*
