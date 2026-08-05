---
phase: 42-playscript-application-modes-color-override
plan: 01
subsystem: animation
tags: [efx-physic-paint, stroke-schedule, static-hold, tdd, vitest]

requires:
  - phase: 41-efx-paint-audio-preview-monitoring-toggle
    provides: regression-locked progressiveStrokeSchedule module mirrored as sibling shape
provides:
  - buildStaticStrokeSchedule/getStaticFrameStrokes in '@efxlab/efx-physic-paint/animation' — every stroke, full pointCount, every frame (PLAY-01 deterministic core)
  - StaticStrokeTransform (stroke, frameIndex, strokeIndex) render-policy seam consumed by the 42-02 renderer
affects: [42-02 renderer mode selection, phase-43 linked-loop resolver]

actuals:
  tokens: 1500
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Static schedule mirrors progressive sibling shape: named exports, no semicolons in source, semicolons in tests, Math.max(1, Math.trunc(frameCount)) normalization"
    - "Additive barrel exports only — regression-locked progressive module never branched (D-01/roadmap boundary)"

key-files:
  created:
    - packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts
    - packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts
  modified:
    - packages/efx-physic-paint/src/animation/index.ts (append-only: one value-export line + one type-export line)

key-decisions:
  - "42-01: static/hold schedule shipped as NEW additive sibling module; progressive module byte-untouched (regression lock)"
  - "42-01: schedule is tool-agnostic — erase strokes pass through identically; color policy lives in the renderer (PLAY-02 boundary)"

patterns-established:
  - "Static schedule: every stroke startFrame 0 / endFrame usableFrames-1 / pointsPerFrame = stroke.points.length; accessor returns full pointCount every frame"
  - "TDD RED/GREEN: 9-case failing suite committed before implementation; green run proves static + progressive suites together"

requirements-completed: [PLAY-01]

coverage:
  - id: D1
    description: "Static/hold stroke schedule returns the complete script stroke set with full pointCount on every destination frame, with stable input order, empty-list edge, frameCount normalization, transform seam, and erase pass-through"
    requirement: PLAY-01
    verification:
      - kind: unit
        ref: "packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts (9 tests)"
        status: pass
      - kind: unit
        ref: "packages/efx-physic-paint/src/animation/progressiveStrokeSchedule.test.ts (4 tests, regression lock)"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-08-05
status: complete
---

# Phase 42 Plan 01: Static/Hold Stroke Schedule Summary

**Static/hold stroke schedule (buildStaticStrokeSchedule/getStaticFrameStrokes) shipped test-first as an additive sibling module in '@efxlab/efx-physic-paint/animation' — every stroke, full point count, every frame — with the progressive module provably byte-untouched.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-05T18:48:26Z
- **Completed:** 2026-08-05T18:51:30Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 append-only)

## Accomplishments
- 9-case failing test suite committed first (RED) encoding all PLAY-01 static schedule semantics
- `buildStaticStrokeSchedule` / `getStaticFrameStrokes` implemented mirroring the progressive sibling shape (GREEN); 9 static + 4 progressive tests green in one command
- Barrel exports appended additively; `git diff --exit-code` proves the regression-locked progressive module and its test are byte-untouched

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing package test for the static/hold schedule** - `2e7d4a6a` (test)
2. **Task 2 (GREEN): Implement staticStrokeSchedule.ts + additive barrel exports** - `156b58da` (feat)

## Files Created/Modified
- `packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts` - static/hold schedule builder + frame accessor with StaticStrokeTransform seam
- `packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts` - 9-case suite (complete set, boundaries, min hold, order, empty, truncation, zero-normalization, transform triple, erase pass-through)
- `packages/efx-physic-paint/src/animation/index.ts` - append-only value + type export lines

## Decisions Made
None - followed plan as specified.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. (Note: the vitest run also discovered a stale `.claude/worktrees/agent-*` copy of the progressive test file in the workspace; it passed identically and is out of scope for this plan.)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 42-02 can select the static schedule by `mode` and wrap the transform callback for the color override (applied AFTER the Motion transform per Pitfall 2)
- Phase 43's linked-loop resolver can consume `buildStaticStrokeSchedule` from the package export with no build config change
- PLAY-01 requirement marked complete

## Self-Check: PASSED
- FOUND: packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts
- FOUND: packages/efx-physic-paint/src/animation/staticStrokeSchedule.test.ts
- FOUND: commit 2e7d4a6a (test RED)
- FOUND: commit 156b58da (feat GREEN)
- Verify command exits 0; progressive lock gate exits 0

---
*Phase: 42-playscript-application-modes-color-override*
*Completed: 2026-08-05*
