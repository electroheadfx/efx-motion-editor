---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 01
subsystem: ui
tags: [physics-paint, workflow-state, vitest, typescript]

requires:
  - phase: 35-interactive-physics-paint-controls
    provides: Standalone interactive Physics Paint controls and existing apply/play behavior
provides:
  - Pure Physics Paint workflow-state helper module for Roto/Play UI wiring
  - Vitest coverage for workflow labels, destructive predicates, onion counts, play range markers, preview FPS, and dev-export gate
affects: [phase-36-ui-rebuild, PhysicsPaintWorkflowStrip, PhysicsPaintStudio]

tech-stack:
  added: []
  patterns: [pure TypeScript predicates, fail-closed destructive action helpers, targeted Vitest helper tests]

key-files:
  created:
    - app/src/components/physic-paint/physicsPaintWorkflowState.ts
    - app/src/components/physic-paint/physicsPaintWorkflowState.test.ts
  modified:
    - app/src/types/physicPaint.ts

key-decisions:
  - "Workflow state helpers stay side-effect-free and browser-independent so later UI components can import them safely."
  - "Frame-count range limits are exported from the shared physics paint type module to avoid duplicate bounds in workflow helpers."

patterns-established:
  - "Roto and Play primary action labels are centralized through getActivePrimaryActionLabel."
  - "Destructive confirmation behavior is centralized through requiresDestructiveConfirmation and fails closed for conversions."
  - "Play range marker derivation clamps start/count/current frame without mutating or converting workflow data."

requirements-completed: [UI-REBUILD-01, UI-REBUILD-02]

duration: 4min 11s
completed: 2026-06-12
---

# Phase 36 Plan 01: Workflow-State Contract Summary

**Pure Physics Paint Roto/Play workflow predicates with Vitest coverage for destructive actions, onion limits, play range markers, FPS fallback, and dev-export gating**

## Performance

- **Duration:** 4min 11s
- **Started:** 2026-06-12T13:08:32Z
- **Completed:** 2026-06-12T13:12:43Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added a pure `physicsPaintWorkflowState.ts` module that centralizes Phase 36 Roto/Play workflow mode labels, destructive confirmation rules, onion-skin count clamping, preview FPS fallback, dev-export gating, and Play range marker derivation.
- Added Wave 0 Vitest coverage for the decisions required by UI-REBUILD-01/UI-REBUILD-02 and 36-VALIDATION.md.
- Exported the shared `PHYSIC_PAINT_MIN_APPLY_FRAMES` bound from `app/src/types/physicPaint.ts` so workflow range clamping uses the same limits as existing physics paint apply payload validation.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing workflow-state tests for Phase 36 decisions** - `2cbc22a` (test)
2. **Task 2: Implement workflow-state helpers** - `c8eda91` (feat)

**Plan metadata:** pending final docs commit

_Note: TDD tasks used separate RED and GREEN commits._

## Files Created/Modified

- `app/src/components/physic-paint/physicsPaintWorkflowState.ts` - Pure workflow-state types and helpers for later UI components.
- `app/src/components/physic-paint/physicsPaintWorkflowState.test.ts` - Vitest coverage for Phase 36 workflow decisions.
- `app/src/types/physicPaint.ts` - Exports the minimum apply frame bound for shared frame-range behavior.

## Decisions Made

- Kept workflow helpers browser-independent with no Preact, DOM, or server dependencies.
- Reused existing physics paint apply frame limits for Play range markers instead of introducing local duplicate constants.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Exported the shared minimum frame bound**
- **Found during:** Task 2 (Implement workflow-state helpers)
- **Issue:** The plan required using `PHYSIC_PAINT_MIN_APPLY_FRAMES`, `PHYSIC_PAINT_DEFAULT_APPLY_FRAMES`, and `PHYSIC_PAINT_MAX_APPLY_FRAMES` from `../../types/physicPaint`, but the minimum constant was not exported.
- **Fix:** Exported `PHYSIC_PAINT_MIN_APPLY_FRAMES` from `app/src/types/physicPaint.ts` so the workflow helper can share the established frame-count bound.
- **Files modified:** `app/src/types/physicPaint.ts`
- **Verification:** Targeted workflow Vitest passed and app typecheck passed after building the local workspace physics package.
- **Committed in:** `c8eda91`

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** The adjustment preserved the plan intent and avoided duplicate frame-limit constants. No scope creep.

## Issues Encountered

- `pnpm --dir <app> vitest ...` attempted to execute the app directory as a binary in this environment. Verification used `pnpm --dir <app> exec vitest ...` for the same targeted test file.
- App typecheck initially could not resolve the workspace physics paint package because `packages/efx-physic-paint/dist` was absent in the isolated worktree. Running the existing package build script generated local build artifacts needed for type resolution; no generated dist files were committed.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-a8dcd341c1bef7531/app exec vitest run src/components/physic-paint/physicsPaintWorkflowState.test.ts` — passed, 8 tests.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/.claude/worktrees/agent-a8dcd341c1bef7531/app typecheck` — passed after building the workspace physics package.

## Known Stubs

None.

## Threat Flags

None. This plan introduced pure local predicates only; it did not add network endpoints, auth paths, file access patterns, or schema changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Later Phase 36 UI components can import one tested helper module for Roto/Play labels, destructive confirmation, Play range marker state, preview FPS, onion count, and dev export visibility.
- No Phase 38 source-lane persistence, hybrid mixing, auto-publish, or conflict handling was introduced.

## Self-Check: PASSED

- Found `app/src/components/physic-paint/physicsPaintWorkflowState.ts`.
- Found `app/src/components/physic-paint/physicsPaintWorkflowState.test.ts`.
- Found `.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-01-SUMMARY.md`.
- Found task commit `2cbc22a`.
- Found task commit `c8eda91`.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-12*
