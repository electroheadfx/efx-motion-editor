---
phase: 13-sequence-fade-in-out
plan: 01
subsystem: data-model
tags: [transitions, fade, opacity, persistence, mce-format, preact-signals]

# Dependency graph
requires:
  - phase: 12-01
    provides: keyframeEngine with applyEasing, EasingType
provides:
  - TransitionType, FadeMode, Transition interfaces on sequence.ts
  - computeFadeOpacity and computeSolidFadeAlpha pure functions in transitionEngine.ts
  - sequenceStore transition CRUD (addTransition, removeTransition, updateTransition) with undo/redo
  - uiStore selectedTransition signal with mutual exclusion against selectedLayerId
  - .mce v7 format with fade_in/fade_out/cross_dissolve persistence
  - TrackLayout/FxTrackLayout fadeIn/fadeOut duration fields for timeline rendering
affects: [13-02, 13-03, 13-04, 13-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [transition-engine-pure-functions, product-rule-overlapping-fades]

key-files:
  created:
    - Application/src/lib/transitionEngine.ts
    - Application/src/lib/transitionEngine.test.ts
  modified:
    - Application/src/types/sequence.ts
    - Application/src/types/project.ts
    - Application/src/types/timeline.ts
    - Application/src/stores/sequenceStore.ts
    - Application/src/stores/uiStore.ts
    - Application/src/stores/projectStore.ts

key-decisions:
  - "Product rule for overlapping fadeIn/fadeOut (multiply opacities)"
  - "Reuse existing EasingType and applyEasing from keyframeEngine for transition curves"
  - "Mutual exclusion: selectedTransition clears selectedLayerId and vice versa"

patterns-established:
  - "Transition engine: pure functions with no signal reads, caller passes Transition | undefined"
  - "computeSolidFadeAlpha = 1 - computeFadeOpacity (inverse for solid color overlay)"

requirements-completed: [FADE-01, FADE-02]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 13 Plan 01: Data Model & Engine Summary

**Transition types, pure opacity engine with 10 tests, store CRUD with undo/redo, uiStore selection, and .mce v7 persistence**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T19:16:44Z
- **Completed:** 2026-03-20T19:22:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- TransitionType/FadeMode/Transition interfaces with fadeIn/fadeOut/crossDissolve on Sequence
- transitionEngine.ts pure functions (computeFadeOpacity, computeSolidFadeAlpha) verified by 10 tests
- sequenceStore transition CRUD (add/remove/update) with full undo/redo support
- uiStore selectedTransition signal with mutual exclusion against selectedLayerId
- .mce format bumped to v7 with backward-compatible transition serialization/deserialization

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Failing tests for transitionEngine** - `7d0a6c5` (test)
2. **Task 1 (GREEN): Transition types, engine, and store methods** - `fd12f87` (feat)
3. **Task 2: .mce v7 persistence** - `c1cbace` (feat)

_TDD flow: RED commit first (failing tests), then GREEN commit (implementation + types + stores)_

## Files Created/Modified
- `Application/src/types/sequence.ts` - Added TransitionType, FadeMode, Transition interfaces; extended Sequence with fadeIn/fadeOut/crossDissolve
- `Application/src/lib/transitionEngine.ts` - Pure functions: computeFadeOpacity, computeSolidFadeAlpha
- `Application/src/lib/transitionEngine.test.ts` - 10 vitest tests covering linear, eased, overlapping, edge cases
- `Application/src/stores/sequenceStore.ts` - addTransition, removeTransition, updateTransition with undo/redo
- `Application/src/stores/uiStore.ts` - selectedTransition signal, selectTransition method, mutual exclusion
- `Application/src/types/timeline.ts` - TrackLayout/FxTrackLayout extended with fadeIn/fadeOut duration fields
- `Application/src/types/project.ts` - MceTransition interface, fade_in/fade_out/cross_dissolve on MceSequence
- `Application/src/stores/projectStore.ts` - v7 serialization/deserialization with type casting and defaults

## Decisions Made
- Reused existing EasingType and applyEasing from keyframeEngine for transition curves (no new easing code)
- Product rule for overlapping fadeIn/fadeOut zones (multiply both opacity factors)
- Mutual exclusion between selectedTransition and selectedLayerId (selecting one clears the other)
- .mce v7 backward compatible: v6 files load fine (fadeIn/fadeOut/crossDissolve simply undefined)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data flows are wired (types defined, store methods functional, persistence complete).

## Next Phase Readiness
- Transition data model complete, ready for Plan 02 (timeline rendering with fade zone indicators)
- transitionEngine pure functions available for Plan 03 (preview compositing) and Plan 04 (frameMap integration)
- uiStore selection state ready for Plan 05 (sidebar UI controls)

## Self-Check: PASSED

All 8 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 13-sequence-fade-in-out*
*Completed: 2026-03-20*
