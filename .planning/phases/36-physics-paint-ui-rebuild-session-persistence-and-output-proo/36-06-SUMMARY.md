---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 06
subsystem: ui
tags: [preact, physics-paint, workflow-strip, timeline, onion-skin]
requires:
  - phase: 36-01
    provides: physics paint workflow predicates and clamp helpers
  - phase: 36-04
    provides: frame sync bridge contract
  - phase: 36-05
    provides: rebuilt studio visual regions and shared CSS language
provides:
  - Bottom Physics Paint workflow strip component with Roto canvas and Play canvas modes
  - Physics-paint-specific timeline rows for Roto frames and Play canvas range inspection
  - Onion skin controls, preview overlay markup, and destructive confirmation dialog surfaces
affects: [36-07, physics-paint-studio, standalone-physics-paint-ui]
tech-stack:
  added: []
  patterns:
    - Preact functional component with typed callback surface for later Studio wiring
    - Source-contract tests for UI copy and threat-model invariants
key-files:
  created:
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
  modified:
    - app/src/components/physic-paint/physicsPaintStudio.css
key-decisions:
  - "Workflow strip owns a physics-paint-specific compact lane model rather than importing or cloning the main EFX Motion timeline."
  - "Play lane click handling remains inspection-only; conversion and clearing are explicit button/dialog flows."
patterns-established:
  - "Workflow strip accepts publication/onion/confirmation state via props so Plan 07 can wire real Studio data without changing the presentational contract."
  - "Destructive UI uses Cancel-first dialog actions and blocks Play-to-Roto conversion when rendered Play frames are missing."
requirements-completed: [UI-REBUILD-01, SAVE-01, SAVE-02, OUT-01, OUT-02]
duration: 7min
completed: 2026-06-12
---

# Phase 36 Plan 06: Physics Paint Workflow Strip Summary

**Bottom Physics Paint workflow strip with Roto/Play mode tabs, dedicated timeline lanes, onion preview controls, and destructive confirmation surfaces**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-12T13:40:26Z
- **Completed:** 2026-06-12T13:46:58Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Added `PhysicsPaintWorkflowStrip` with exact `Roto canvas` / `Play canvas` workflow tabs, primary CTAs, Save/Load state actions, frame count clamping, preview-only status, publication summary display, and Roto/Play lane rows.
- Implemented a physics-paint-specific spreadsheet/timeline surface: per-frame Roto cells, Play start square, range bar, marker positioning via `getPlayRangeMarker`, and an inspection-only Play lane click handler.
- Added Roto onion skin controls with count clamping, previous/next legend classes, renderable preview overlay markup, live-preview suppression, and required destructive confirmations for Play clearing and conversion flows.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: workflow strip contract tests** - `456c45b` (test)
2. **Task 1 GREEN: workflow tabs, actions, and lane rows** - `69ab70a` (feat)
3. **Task 2 RED: onion and confirmation contract tests** - `0806c83` (test)
4. **Task 2 GREEN: onion controls and destructive confirmations** - `e861317` (feat)

_Note: Both plan tasks were marked `tdd="true"`, so each task has a RED test commit followed by a GREEN implementation commit._

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx` - New typed Preact component for bottom workflow tabs, actions, lanes, onion overlay, and confirmation dialogs.
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts` - Source-contract Vitest coverage for required copy, lane ownership, inspection-only Play clicks, onion surfaces, and destructive confirmation copy.
- `app/src/components/physic-paint/physicsPaintStudio.css` - Styles for workflow strip, tabs, primary action, timeline lanes, Roto cells, Play range/marker, onion overlay/legend, and confirmation dialog.

## Decisions Made

- Kept the bottom timeline intentionally physics-paint-specific and self-contained, using lane/range markup instead of importing the main EFX Motion timeline.
- Represented same-mode replacement feedback through status/publication props, avoiding advanced conflict-resolution UI as required by D-36.
- Exposed onion preview frames and conversion/clear actions through props so Plan 07 can connect real Studio state and callbacks without changing the presentational API.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- Initial `pnpm --dir ... vitest run ...` failed because `pnpm` treated `vitest` as an executable path under `--dir`; reran with `pnpm --dir ... exec vitest run ...`, which is the correct pnpm invocation for direct binary execution.

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/physicsPaintWorkflowState.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts` passed.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` passed.
- Grep assertions for `Roto frames`, `Play canvas`, and `Convert Play to Roto` passed.

## Known Stubs

None found in files created/modified by this plan.

## Next Phase Readiness

Plan 07 can now import `PhysicsPaintWorkflowStrip` and provide real Studio callbacks for save/play, frame sync, onion preview sourcing, Play/Roto conversion, and clear actions.

## Self-Check: PASSED

- Found `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx`.
- Found `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`.
- Found `36-06-SUMMARY.md` in the phase directory.
- Found commits `456c45b`, `69ab70a`, `0806c83`, and `e861317` in git history.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-12*
