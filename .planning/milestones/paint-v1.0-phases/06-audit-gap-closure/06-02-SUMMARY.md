---
phase: 06-audit-gap-closure
plan: 02
subsystem: engine, docs
tags: [async-init, paper-textures, onEngineReady, requirements]

# Dependency graph
requires:
  - phase: 06-01
    provides: dead code removal completed
provides:
  - async init() method on EfxPaintEngine for post-construction texture loading
  - onEngineReady fires only after paper textures are loaded
  - REQUIREMENTS.md spec wording aligned with implementation reality
affects: [library-consumers, efx-motion-editor-integration]

# Tech tracking
tech-stack:
  added: []
  patterns: [async-init-pattern-for-engine-readiness]

key-files:
  created: []
  modified:
    - paint-rebelle-new/src/engine/EfxPaintEngine.ts
    - paint-rebelle-new/src/preact.tsx
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Removed fire-and-forget loadPaperTextures from constructor; init() is the only texture loading path"
  - "Used .then() in Preact useEffect (not async callback) per React/Preact convention"

patterns-established:
  - "Async init pattern: constructor is synchronous, init() awaits async resources, consumers call init() before using engine"

requirements-completed: [PHYS-01, LIB-01, LIB-03, BRUSH-03, CANVAS-02, DEMO-01, DEMO-02]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 06 Plan 02: onEngineReady Timing Fix and REQUIREMENTS.md Alignment Summary

**Async init() method delays onEngineReady until paper textures load; REQUIREMENTS.md spec wording updated for PHYS-01, BRUSH-03, CANVAS-02, LIB-01**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T09:04:50Z
- **Completed:** 2026-04-02T09:07:21Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- onEngineReady now fires only after paper textures have loaded (not synchronously after constructor)
- REQUIREMENTS.md spec wording updated to match design decisions: Stam solver, paper-height deposit, configurable canvas, ESM-only output
- All v1 requirement checkboxes verified as checked

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix onEngineReady timing** - `5dcfc16` (fix)
2. **Task 2: Update REQUIREMENTS.md checkboxes and spec wording** - `483a5ff` (docs)

## Files Created/Modified
- `paint-rebelle-new/src/engine/EfxPaintEngine.ts` - Added async init() method, stored paper config in private fields, removed fire-and-forget loadPaperTextures from constructor
- `paint-rebelle-new/src/preact.tsx` - Changed useEffect to await engine.init() before firing onEngineReady
- `.planning/REQUIREMENTS.md` - Updated spec wording for PHYS-01, BRUSH-03, CANVAS-02, LIB-01; updated last-updated date

## Decisions Made
- Removed fire-and-forget loadPaperTextures from constructor entirely (clean approach) rather than keeping backward-compatible dual path. Consumers must call init() for texture loading.
- Used .then() chaining in Preact useEffect rather than async IIFE, following React/Preact convention for effect callbacks.

## Deviations from Plan

None - plan executed exactly as written. LIB-03, DEMO-01, DEMO-02 checkboxes were already checked in REQUIREMENTS.md (plan context was based on earlier state), so no checkbox changes were needed for those.

## Issues Encountered
- node_modules not present in worktree; ran pnpm install to enable TypeScript type checking. Pre-existing environment issue, not a code problem.

## Known Stubs

None - no stubs or placeholder values in modified files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 06 audit gap closure is complete (both plans executed)
- Engine signals ready correctly, REQUIREMENTS.md reflects reality
- Ready for milestone completion or next phase

## Self-Check: PASSED

All files exist. All commit hashes verified.

---
*Phase: 06-audit-gap-closure*
*Completed: 2026-04-02*
