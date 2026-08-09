---
phase: quick-260809-aac-when-select-all-keyframes-is-used-clear
plan: 01
subsystem: ui
tags: [preact, signals, physics-paint, roto, timeline-selection]

requires:
  - phase: 37-04
    provides: Shared Select All callback and identity-based Roto multi-selection
  - phase: 43
    provides: Integrated workflow strip and Loop Rail selection precedence
provides:
  - Replacement-style Roto Select All that clears local and persisted primary selection
  - Primary-selection-aware workflow strip class projection
  - Regression contracts for uniform complete selection and preserved ordinary primary hierarchy
affects: [physics-paint, roto-timeline, keyframe-selection]

actuals:
  tokens: 3303
  tasks: 1
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Separate cursor overlays from nullable primary selection identity during render-time class projection"
    - "Clear duplicated Signal/store selection ownership synchronously in the shared action callback"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts

key-decisions:
  - "Select All preserves the cursor frame while clearing both local and persisted primary key identity."
  - "Real-key current styling is owned by stable primary key identity; non-real cells retain cursor styling so empty frames remain selectable Add key targets."

patterns-established:
  - "Complete key selection remains in rotoSelectedKeyIds while the stronger primary treatment is controlled by a separate nullable identity."

requirements-completed: [QUICK-260809-AAC]

coverage:
  - id: D1
    description: "Select All replaces the prior primary selection with the ordered complete real-key set while preserving the cursor frame."
    requirement: QUICK-260809-AAC
    verification:
      - kind: integration
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#replaces the primary selection before publishing the complete Select All set"
        status: pass
    human_judgment: false
  - id: D2
    description: "The workflow strip renders every Select All member uniformly while preserving ordinary primary-versus-secondary hierarchy."
    requirement: QUICK-260809-AAC
    verification:
      - kind: integration
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#keeps rail selection line-only while explicit physical spacing proxies remain visible"
        status: pass
    human_judgment: true
    rationale: "The source contract proves class ownership, but final native visual appearance remains a user-visible judgment."

duration: 7min
completed: 2026-08-09
status: complete
---

# Quick Task 260809-aac: Roto Select All Replacement Summary

**Roto Select All now clears the former primary key in Signal and store state, then renders every real key with one uniform complete-selection treatment.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-09T05:29:52Z
- **Completed:** 2026-08-09T05:36:34Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments

- Corrected the shared keyboard/button Select All callback to clear `selectedKeyId` locally and in the physical store without moving the cursor.
- Passed the nullable primary key identity separately from the complete selected-key set, using it for real-key `current` styling while retaining cursor-owned `current` styling for non-real cells.
- Preserved spacing-proxy and Loop Clip scope clearing, the `All keys selected` status, and ordinary primary-versus-secondary multi-selection behavior.
- Added focused source-contract regression coverage, including the UAT-found empty-frame click target regression; 115 focused tests and the TypeScript typecheck pass.

## Task Commits

1. **Task 1 RED: Lock Select All replacement semantics** - `368ba35a` (test)
2. **Task 1 GREEN: Replace primary key on Select All** - `15224dc8` (fix)
3. **UAT follow-up: Preserve empty-frame cursor selection** - `0431e812` (fix)

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Clears local/store primary selection, preserves the cursor, derives Select All with a null primary, and passes primary identity to the strip.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - Locks state-clearing order, null reducer input, disjoint scope clearing, and success feedback.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - Separates active primary class ownership from complete selected-set membership.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - Prevents overlapping cursor-current and complete-selection class projection.

## Decisions Made

- Kept cursor navigation unchanged: Select All clears selection ownership, not the current frame.
- Used direct Signal-derived props and render-time predicates; no effect synchronization, duplicate state, CSS override, or dependency was introduced.

## Deviations from Plan

- Native UAT required one corrective follow-up because the initial class projection also removed the cursor treatment from non-real cells. The correction stayed within the planned workflow-strip selection boundary.

## Issues Encountered

- Native UAT exposed that the first correction replaced cursor-owned `.current` styling globally, making clicked empty frames appear unselectable as Add key targets.
- The follow-up keeps primary identity ownership for real keys while restoring cursor treatment for non-real cells; its dedicated regression test failed before the correction and passed afterward.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` - passed, 115 tests.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` - passed.
- Application server was not started.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Automated implementation and verification are complete.
- Native visual UAT can confirm both behaviors: frame 32 loses its separate primary treatment after Select All, and clicking an empty frame visibly selects it so Add key targets that frame.

## Self-Check: PASSED

- All four modified source/test files exist.
- Commits `368ba35a`, `15224dc8`, and `0431e812` exist in repository history.

---
*Quick Task: 260809-aac*
*Completed: 2026-08-09*
