---
phase: 12-layer-keyframe-animation
plan: 01
subsystem: animation
tags: [keyframe, interpolation, easing, preact-signals, serde, vitest]

requires:
  - phase: 11-live-canvas-transform
    provides: Layer interface with transform, opacity, blur properties
provides:
  - Keyframe, KeyframeValues, EasingType types on Layer interface
  - Pure interpolation engine (interpolateAt, applyEasing, lerpValues)
  - keyframeStore with CRUD, selection, computed interpolation, transient overrides
  - .mce v6 format with keyframe serialization/deserialization
  - Rust MceKeyframe/MceKeyframeValues structs with serde defaults
affects: [12-02, 12-03, 12-04, timeline-ui, properties-panel, canvas-renderer]

tech-stack:
  added: [vitest@2.1.9]
  patterns: [sequence-local frame offsets, reusable mutable result for GC-free interpolation, transient overrides for between-keyframe edits]

key-files:
  created:
    - Application/src/lib/keyframeEngine.ts
    - Application/src/lib/keyframeEngine.test.ts
    - Application/src/stores/keyframeStore.ts
    - Application/vitest.config.ts
  modified:
    - Application/src/types/layer.ts
    - Application/src/types/project.ts
    - Application/src/stores/projectStore.ts
    - Application/src-tauri/src/models/project.rs

key-decisions:
  - "Polynomial cubic easing: ease-in (t^3), ease-out (1-(1-t)^3), ease-in-out (piecewise cubic)"
  - "Keyframe frame values are sequence-local offsets, not global frame numbers"
  - "Reusable mutable result object in interpolation engine to avoid GC during playback"
  - "Transient overrides pattern: edits between keyframes write to transientOverrides signal, not layerStore"
  - ".mce format version bumped from 5 to 6 with backward-compatible keyframe fields"

patterns-established:
  - "Sequence-local frame offsets: keyframes store frame relative to sequence start, store converts global<->local"
  - "Transient overrides: property edits between keyframes held in ephemeral signal, committed on addKeyframe"
  - "TDD with vitest: RED (failing test) -> GREEN (implementation) -> REFACTOR"

requirements-completed: [KF-01, KF-02, KF-06, KF-08]

duration: 5min
completed: 2026-03-14
---

# Phase 12 Plan 01: Keyframe Data Model and Interpolation Engine Summary

**Keyframe types on Layer, polynomial cubic easing engine with 21 tests, reactive keyframeStore with CRUD/interpolation/transient overrides, and .mce v6 format**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T15:26:17Z
- **Completed:** 2026-03-14T15:31:43Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- EasingType, KeyframeValues, Keyframe types exported from layer.ts with extractKeyframeValues helper
- Pure interpolation engine with polynomial cubic easing, GC-free mutable path, and 21 passing tests
- keyframeStore with addKeyframe/removeKeyframes/moveKeyframe/setEasing CRUD, computed interpolation, transient overrides for between-keyframe edits, and frame-change auto-clear effect
- .mce v6 format with keyframe serialization (camelCase<->snake_case), Rust serde structs, full v5 backward compatibility

## Task Commits

Each task was committed atomically:

1. **Task 1: Define keyframe types and interpolation engine (TDD RED)** - `870f610` (test)
2. **Task 1: Define keyframe types and interpolation engine (TDD GREEN)** - `2393a41` (feat)
3. **Task 2: Create keyframeStore with CRUD, computed interpolation, and transient overrides** - `688deae` (feat)
4. **Task 3: Add .mce v6 format support with keyframe serialization** - `d0ff1b8` (feat)

## Files Created/Modified
- `Application/src/types/layer.ts` - Added EasingType, KeyframeValues, Keyframe types; keyframes? on Layer; extractKeyframeValues helper
- `Application/src/lib/keyframeEngine.ts` - Pure interpolation engine: interpolateAt, applyEasing, lerpValues, lerp
- `Application/src/lib/keyframeEngine.test.ts` - 21 tests covering all interpolation edge cases and easing functions
- `Application/src/stores/keyframeStore.ts` - Reactive store: CRUD, selection, computed interpolation, transient overrides
- `Application/src/types/project.ts` - MceKeyframe, MceKeyframeValues interfaces for v6 serialization
- `Application/src-tauri/src/models/project.rs` - Rust MceKeyframe/MceKeyframeValues structs with serde defaults
- `Application/src/stores/projectStore.ts` - Version bump to 6, keyframe serialize/deserialize in buildMceProject/hydrateFromMce
- `Application/vitest.config.ts` - Vitest configuration for test infrastructure

## Decisions Made
- Polynomial cubic easing functions (not CSS bezier) for predictable, simple math
- Sequence-local frame offsets for keyframes (immune to sequence reorder/insert)
- Reusable mutable result object pattern for GC-free interpolation during playback
- Transient overrides signal pattern: property edits between keyframes are ephemeral until committed via addKeyframe
- Default easing for new keyframes is 'ease-in-out'
- vitest@2.1.9 chosen for compatibility with project's vite@5.4.21

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed vitest test framework**
- **Found during:** Task 1 (TDD setup)
- **Issue:** No test framework installed in the project
- **Fix:** Installed vitest@2.1.9 (compatible with vite@5.4.21) and created vitest.config.ts
- **Files modified:** package.json, pnpm-lock.yaml, vitest.config.ts
- **Verification:** Tests run and pass via `npx vitest run`
- **Committed in:** 870f610 (Task 1 RED commit)

**2. [Rule 1 - Bug] Removed unused Layer import from keyframeEngine.ts**
- **Found during:** Task 1 (GREEN phase tsc verification)
- **Issue:** Unused import `Layer` caused tsc --noEmit error (noUnusedLocals strict mode)
- **Fix:** Removed unused import, kept only Keyframe/KeyframeValues/EasingType
- **Files modified:** Application/src/lib/keyframeEngine.ts
- **Verification:** `npx tsc --noEmit` passes clean
- **Committed in:** 2393a41 (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both essential for task completion. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All keyframe types, interpolation engine, and store are ready for Plan 02 (timeline UI)
- keyframeStore.displayValues computed is ready for PropertiesPanel integration (Plan 03)
- .mce v6 format ready for save/load testing
- Transient overrides pattern established for between-keyframe property editing

---
*Phase: 12-layer-keyframe-animation*
*Completed: 2026-03-14*
