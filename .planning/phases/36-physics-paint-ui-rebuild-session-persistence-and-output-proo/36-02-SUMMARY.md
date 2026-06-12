---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 02
subsystem: physics-paint-session-persistence
tags: [physics-paint, serialized-project, vitest, save-load, json-validation]

requires:
  - phase: 35-interactive-physics-paint-controls
    provides: Standalone efx-physic-paint engine controls and SerializedProject save/load behavior
provides:
  - Tested editable Physics Paint JSON serialization helper
  - Fail-closed SerializedProject JSON parsing helper with required UI copy
  - Browser/injected-adapter download helper for local editable state files
affects: [phase-36-ui-rebuild, physics-paint-workflow-wiring, save-load-session-state]

tech-stack:
  added: []
  patterns: [fail-closed-json-validation, injected-download-adapter, editable-state-rendered-output-separation]

key-files:
  created:
    - app/src/components/physic-paint/physicsPaintSessionFile.ts
    - app/src/components/physic-paint/physicsPaintSessionFile.test.ts
  modified:
    - app/src/types/physicPaint.ts

key-decisions:
  - "Session-file loading reuses the shared SerializedProject guard before any future engine mutation path."
  - "Download orchestration accepts an injected adapter for tests while defaulting to the existing browser Blob/anchor pattern."

patterns-established:
  - "Editable state helpers must not include rendered PNG output, apply payload fields, or PhysicPaintRenderedFrame responsibilities."
  - "Invalid session JSON throws the exact UI-SPEC copy string from a centralized constant."

requirements-completed: [SAVE-01, SAVE-02]

duration: 4min
completed: 2026-06-12
---

# Phase 36 Plan 02: Editable Physics Paint Session File Helpers Summary

**Editable Physics Paint state JSON helpers with fail-closed SerializedProject parsing and adapter-based local download orchestration.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-12T13:09:05Z
- **Completed:** 2026-06-12T13:13:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added RED Vitest coverage for SAVE-01/SAVE-02 session serialization, invalid-load rejection, exact copy strings, and rendered-output separation.
- Implemented `physicsPaintSessionFile.ts` with `serializePhysicsPaintState`, `parsePhysicsPaintStateFile`, and `downloadPhysicsPaintState`.
- Exported the existing `isSerializedProject` guard so session-file parsing validates user-selected JSON before returning editable engine state.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing session-file tests** - `89bd472` (test)
2. **Task 2: Implement editable state save/load helpers** - `d5d7ba5` (feat)

**Plan metadata:** pending final docs commit

_Note: TDD tasks used test then feature commits._

## Files Created/Modified

- `app/src/components/physic-paint/physicsPaintSessionFile.ts` - Centralized editable JSON state serialization, validated parsing, and browser/injected-adapter download helper.
- `app/src/components/physic-paint/physicsPaintSessionFile.test.ts` - Vitest coverage for SAVE-01/SAVE-02 helper behavior and required copy strings.
- `app/src/types/physicPaint.ts` - Exports the existing `isSerializedProject` guard for reuse by load helpers.

## Decisions Made

- Reused the existing `isSerializedProject` validation logic instead of duplicating a second session-file-only validator.
- Kept Tauri dynamic save imports out of the helper per plan; the helper provides a testable adapter seam and browser Blob fallback for later UI wiring.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Exported shared SerializedProject guard**
- **Found during:** Task 2 (Implement editable state save/load helpers)
- **Issue:** The plan required importing `isSerializedProject` from `../../types/physicPaint`, but the guard existed as a non-exported function.
- **Fix:** Exported the existing guard so user-selected JSON is validated before any later engine mutation path.
- **Files modified:** `app/src/types/physicPaint.ts`
- **Verification:** `pnpm -C /Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-a922d16a09d09b4b1/app exec vitest run src/components/physic-paint/physicsPaintSessionFile.test.ts src/types/physicPaint.test.ts` and `pnpm -C /Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-a922d16a09d09b4b1/app typecheck`
- **Committed in:** `d5d7ba5` (part of Task 2 commit)

**2. [Rule 3 - Blocking] Prepared workspace dependencies and package build artifacts for verification**
- **Found during:** Task 1/Task 2 verification
- **Issue:** The worktree lacked installed dependencies, and app typecheck could not resolve the workspace package declarations until `packages/efx-physic-paint` was built.
- **Fix:** Ran `pnpm install` with existing pinned dependencies, discarded the unrelated lockfile rewrite, and built the local physics paint package before typecheck.
- **Files modified:** None committed.
- **Verification:** Targeted Vitest and app typecheck passed after the package build.
- **Committed in:** Not applicable; environment-only fix.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both fixes were required to satisfy the planned import path and verification gates. No feature scope was added.

## Issues Encountered

- The plan-provided `pnpm --dir <app> vitest ...` form attempted to execute the app directory and failed with EACCES in this environment; verification used `pnpm -C <app> exec vitest ...`, which exercises the same Vitest target without running the dev server.
- The plan fixture said `settings: {}` while the current workspace package type requires concrete settings fields. The test fixture was updated to a valid `SerializedProject` shape while preserving the plan’s validation intent.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None - no new network endpoints, auth paths, file access beyond explicit browser local download, or schema trust boundaries were introduced beyond the plan threat model.

## Verification

- `pnpm -C /Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-a922d16a09d09b4b1/app exec vitest run src/components/physic-paint/physicsPaintSessionFile.test.ts src/types/physicPaint.test.ts` - passed
- `pnpm -C /Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-a922d16a09d09b4b1/app typecheck` - passed
- Source audit confirmed `physicsPaintSessionFile.ts` contains no `data:image/png`, `PhysicPaintRenderedFrame`, or `apply-play-canvas` strings.

## Self-Check: PASSED

- Found `app/src/components/physic-paint/physicsPaintSessionFile.ts`
- Found `app/src/components/physic-paint/physicsPaintSessionFile.test.ts`
- Found commit `89bd472`
- Found commit `d5d7ba5`

## Next Phase Readiness

- Plan 04 can import the helper constants and functions to relocate `Save state` / `Load state` UI without changing session-file validation behavior.
- Plan 03 remains responsible for debug PNG/still export and frame-sequence output; this plan intentionally kept editable state separate from rendered output.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-12*
