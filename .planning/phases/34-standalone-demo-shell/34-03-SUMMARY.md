---
phase: 34-standalone-demo-shell
plan: 03
subsystem: documentation
tags: [pnpm, vite, preact, efx-physic-paint, standalone-demo]

requires:
  - phase: 34-standalone-demo-shell
    provides: package-local Vite demo shell, root dev:paint script, and original-style demo controls from plans 34-01 and 34-02
provides:
  - README instructions for running the standalone physics paint browser demo from repo root
  - README examples using current EfxPaintCanvas public wrapper props
  - Static verification that documented commands match package scripts and library/demo boundaries
affects: [phase-35-interactive-physics-paint-controls, standalone-physics-paint-documentation]

tech-stack:
  added: []
  patterns:
    - Document repo-root pnpm aliases separately from package-local filtered commands
    - Keep Vite demo/HMR documentation separate from tsup library build/check documentation

key-files:
  created:
    - .planning/phases/34-standalone-demo-shell/34-03-SUMMARY.md
  modified:
    - packages/efx-physic-paint/README.md

key-decisions:
  - "Documented the current standalone demo as package-local with original-style toolbar/settings and paper assets, not editor paint-layer integration."
  - "Kept README command guidance to non-server build/check smoke commands plus user-run pnpm dev:paint, matching project instructions."

patterns-established:
  - "README examples should use current EngineConfig/EfxPaintCanvasProps: papers, defaultPaper, and onEngineReady."
  - "Phase 34 demo files remain outside package exports, published files, and tsup entries."

requirements-completed: [RUN-01, RUN-02, RUN-03]

duration: 3min
completed: 2026-06-08
---

# Phase 34 Plan 03: Standalone Demo README Summary

**Standalone physics paint README now matches the current package demo, public Preact wrapper props, and pnpm workflow boundaries.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-08T11:52:34Z
- **Completed:** 2026-06-08T11:55:28Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments

- Replaced stale `paperPath` / `onEngine` examples with `papers`, `defaultPaper`, and `onEngineReady` usage for `EfxPaintCanvas`.
- Documented `pnpm dev:paint`, package-local `demo:dev`, `demo:build`, library `build`, and package `check` commands exactly as scripts define them.
- Clarified that the demo includes original-style toolbar/settings and paper assets while remaining a standalone package demo, not editor paint-layer integration.
- Verified script values, README command coverage, package type check, library build, and Vite demo build without running any dev server.

## Task Commits

Each task was committed atomically where a file changed:

1. **Task 1: Replace stale README Preact example with current public wrapper props** - `558eacc` (docs)
2. **Task 2: Document executable Phase 34 commands and workflow boundaries** - `f7fb3fa` (docs)
3. **Task 3: Verify README commands against package scripts and demo boundaries** - no code/docs change after verification; covered by final summary commit

**Plan metadata:** pending final metadata commit

## Files Created/Modified

- `packages/efx-physic-paint/README.md` - Updated quick start, Preact wrapper example, development commands, and standalone/non-editor boundary notes.
- `.planning/phases/34-standalone-demo-shell/34-03-SUMMARY.md` - Execution summary and verification record.

## Verification

- `node` README wrapper example assertion: passed.
- `node` README command/workflow assertion: passed.
- `node` root/package script and tsup/demo boundary assertion: passed.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor --filter @efxlab/efx-physic-paint check`: passed.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor --filter @efxlab/efx-physic-paint build`: passed.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor --filter @efxlab/efx-physic-paint demo:build`: passed.

## Decisions Made

- Documented the user-requested current demo state from plan 34-02: original-style toolbar/settings and paper assets are present in the standalone package demo.
- Did not run `pnpm dev:paint` or any dev server, per project `CLAUDE.md`; validation used static checks and production/demo builds only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical documentation correctness] Updated the engine quick start to remove stale `paperPath` usage**
- **Found during:** Task 1 (README wrapper verification)
- **Issue:** The task explicitly targeted stale Preact props, but the README quick start also used stale `paperPath` and non-current readiness callback guidance. The task verification rejected any remaining `paperPath` in the README.
- **Fix:** Updated the engine quick start to pass `papers` and `defaultPaper`, call `await engine.init()`, and use a container element consistent with the current engine constructor.
- **Files modified:** `packages/efx-physic-paint/README.md`
- **Verification:** Task 1 Node assertion passed after the update.
- **Committed in:** `558eacc`

---

**Total deviations:** 1 auto-fixed (Rule 2)
**Impact on plan:** Documentation correctness improved; no scope creep beyond README accuracy.

## Issues Encountered

- Initial Task 1 verification failed because `paperPath` remained in the engine quick start section. Resolved by updating that section to current `EngineConfig` usage.

## Known Stubs

None found in files modified by this plan.

## Threat Flags

None. This plan changed documentation only and introduced no new network endpoints, auth paths, file access patterns, or schema changes.

## User Setup Required

None - no external service configuration required. The user may run `pnpm dev:paint` manually for browser UAT when desired.

## Next Phase Readiness

- RUN-01/RUN-02/RUN-03 documentation is complete and statically verified.
- Phase 35 can build on the standalone demo knowing README command/workflow boundaries now match the package scripts and current demo state.

## Self-Check: PASSED

- Found `packages/efx-physic-paint/README.md`.
- Found `.planning/phases/34-standalone-demo-shell/34-03-SUMMARY.md`.
- Found task commit `558eacc`.
- Found task commit `f7fb3fa`.

---
*Phase: 34-standalone-demo-shell*
*Completed: 2026-06-08*
