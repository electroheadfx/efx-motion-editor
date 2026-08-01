---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 04
subsystem: ui
tags: [physics-paint, preact, bridge, vitest, fps, frame-sync]

requires:
  - phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
    provides: Plan 01-03 helper modules for workflow state, editable JSON state files, and debug proof exports
provides:
  - Optional positive finite FPS in Physics Paint launch context validation and bridge creation
  - Editor-side D-26 frame-sync receiver for validated standalone seek-frame messages
  - Callback-oriented PhysicsPaintStudio actions for preview, save roto frame, Save play, editable state, and debug proof export
affects: [phase-36-ui-rebuild, physics-paint-standalone, future-editor-transport]

tech-stack:
  added: []
  patterns:
    - Fail-closed cross-window message validation before timeline mutation
    - Preview-only Play separated from rendered-output publishing
    - Helper-backed editable-state and debug-proof actions in the studio orchestrator

key-files:
  created: []
  modified:
    - app/src/types/physicPaint.ts
    - app/src/types/physicPaint.test.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/components/sidebar/PhysicPaintProperties.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx

key-decisions:
  - "Use optional positive finite launch FPS from project context with getPreviewFps fallback instead of exposing a custom FPS UI."
  - "Keep Save play in the standalone window after publish by replacing auto-close behavior with a frame-range summary."
  - "Validate D-26 frame sync through a namespaced message before seeking and ensuring editor timeline visibility."

patterns-established:
  - "PhysicsPaintStudio action callbacks isolate saveRotoFrame, savePlay, playPreview, stopPreview, saveEditableState, loadEditableState, exportDebugProof, and frame sync."
  - "Standalone-to-editor frame navigation uses physic-paint:seek-frame messages and rejects malformed frames before store mutation."

requirements-completed: [UI-REBUILD-02, SAVE-01, SAVE-02, OUT-01, OUT-02]

duration: 7min
completed: 2026-06-12
---

# Phase 36 Plan 04: Physics Paint Studio Action Callback Summary

**Project-FPS launch context, validated D-26 frame-sync bridge, and callback-oriented Physics Paint studio actions for preview-only Play, Save play summaries, editable state, and debug proof output.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-12T13:19:17Z
- **Completed:** 2026-06-12T13:26:07Z
- **Tasks:** 2 completed
- **Files modified:** 6

## Accomplishments

- Added optional `fps?: number` to the Physics Paint launch context with validation that accepts positive finite project FPS and rejects zero, negative, non-finite, and string FPS.
- Added the D-26 editor-side `physic-paint:seek-frame` receiver and browser message listener, validated before mutating `timelineStore.seek(frame)` and `timelineStore.ensureFrameVisible(frame)`.
- Refactored `PhysicsPaintStudio.tsx` around action callbacks for Play preview, stop preview, save roto frame, save-and-advance, Save play, editable state save/load, debug proof export, and synced frame navigation.
- Changed Play canvas publishing to use `getPreviewFps(launchContext?.fps)`, keep the window open after Save play, and report `Saved play range: ...` instead of auto-closing.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add FPS launch-context and D-26 receiver coverage** - `87ff6c3` (test)
2. **Task 1 GREEN: Add FPS launch-context and D-26 receiver coverage** - `53a31d0` (feat)
3. **Task 2: Refactor Studio actions for save/load/publish/export behavior** - `c9a48cf` (feat)

## Files Created/Modified

- `app/src/types/physicPaint.ts` - Adds optional launch FPS plus `PhysicPaintFrameSyncMessage` and validation.
- `app/src/types/physicPaint.test.ts` - Covers valid/invalid FPS and namespaced frame-sync message validation.
- `app/src/lib/physicPaintBridge.ts` - Carries FPS into launch context and adds validated frame-sync handling/listener.
- `app/src/lib/physicPaintBridge.test.ts` - Covers encoded FPS, invalid FPS omission, valid timeline sync, invalid frame rejection, and listener cleanup.
- `app/src/components/sidebar/PhysicPaintProperties.tsx` - Supplies current project FPS when opening the standalone Physics Paint canvas.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Refactors studio behaviors into action callbacks, uses project FPS for preview/publish playback, keeps Save play open, wires helper-backed state/debug actions, and sends seek-frame sync messages.

## Decisions Made

- Project FPS is transported as optional context from the editor and consumed via `getPreviewFps`, preserving 24 fps only as the internal fallback.
- `Save play` remains an explicit publishing action and no longer closes the standalone UI on success.
- D-26 frame sync uses a small namespaced message contract and fail-closed receiver rather than expanding editor integration scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used the working pnpm invocation from the app directory**
- **Found during:** Task 1 verification
- **Issue:** The planned `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app ...` invocation was interpreted as spawning the app directory and failed with `EACCES` in this environment.
- **Fix:** Ran the same commands from `/Users/lmarques/Dev/efx-motion-editor/app` using `cd ... && pnpm ...`; no server was started.
- **Files modified:** None
- **Verification:** Targeted Vitest suites and typecheck passed.
- **Committed in:** N/A

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Verification command form changed only; implementation scope stayed within the plan.

## Issues Encountered

- Task 1 RED tests failed as expected before implementation, proving missing FPS validation and missing D-26 receiver coverage.
- Task 2 typecheck initially caught an unused `closePhysicsPaintWindow` helper after Save play auto-close removal; the obsolete helper was removed and typecheck passed.

## Verification

- `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/types/physicPaint.test.ts src/lib/physicPaintBridge.test.ts`
- `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm vitest run src/components/physic-paint/physicsPaintWorkflowState.test.ts src/components/physic-paint/physicsPaintSessionFile.test.ts src/components/physic-paint/physicsPaintDevExport.test.ts src/lib/physicPaintBridge.test.ts`
- `cd /Users/lmarques/Dev/efx-motion-editor/app && pnpm typecheck`

## Known Stubs

None found in files modified by this plan.

## Threat Flags

None. The planned trust-boundary changes were covered by launch FPS validation, apply-payload reuse, frame-sync validation, and helper-backed state/debug actions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 05 can consume the callback-oriented studio actions and bridge contracts for the rebuilt visual components without reworking save/load/output behavior. The old diagnostics layout still exists visually and is expected to be addressed by the later UI layout plans.

## Self-Check: PASSED

- Summary written to `/Users/lmarques/Dev/efx-motion-editor/.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-04-SUMMARY.md`.
- Task commits found: `87ff6c3`, `53a31d0`, `c9a48cf`.
- Modified implementation and test files exist at the absolute paths listed above.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-12*
