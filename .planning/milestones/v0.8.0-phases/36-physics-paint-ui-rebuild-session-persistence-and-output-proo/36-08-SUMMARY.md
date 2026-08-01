---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 08
subsystem: ui
tags: [preact, physics-paint, workflow-strip, tab-conversion, uat-gap-closure]
requires:
  - phase: 36-06
    provides: Bottom Physics Paint workflow strip with Roto/Play tabs, state actions, timeline lanes, and destructive confirmation surfaces
  - phase: 36-07
    provides: Integrated PhysicsPaintStudio wiring with Studio-owned conversion callbacks
provides:
  - Tab-driven Roto canvas and Play canvas conversion UX for UAT gap 4
  - Workflow strip without standalone Convert Play to Roto or Convert Roto to Play buttons
  - Regression coverage for tab-driven conversion confirmation and Play-lane inspection-only behavior
affects: [physics-paint-ui, workflow-strip, uat-gap-4, standalone-physics-paint]
tech-stack:
  added: []
  patterns:
    - Presentational workflow strip requests mode changes through guarded tab clicks
    - PhysicsPaintStudio remains owner of workflow mode mutation and conversion callbacks
key-files:
  created:
    - .planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-08-SUMMARY.md
  modified:
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
key-decisions:
  - "Roto canvas and Play canvas tabs are now the sole visible conversion affordance in the bottom workflow strip."
  - "Active-tab clicks return early, so they do not open confirmation dialogs or invoke conversion callbacks."
  - "Play-lane clicks remain inspection/navigation-only and are not connected to conversion behavior."
patterns-established:
  - "Cross-mode workflow tab requests open the existing destructive confirmation dialog before invoking conversion callbacks."
  - "State actions stay limited to Save state and Load state, avoiding noisy duplicate conversion controls."
requirements-completed: [UI-REBUILD-01, UI-REBUILD-02, SAVE-01, SAVE-02, OUT-01, OUT-02]
duration: 5min
completed: 2026-06-13
---

# Phase 36 Plan 08: Tab-Driven Physics Paint Conversion Summary

**Roto/Play workflow tabs now drive guarded conversion confirmations without separate bottom-strip conversion buttons**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-13T09:35:49Z
- **Completed:** 2026-06-13T09:40:00Z
- **Tasks:** 2
- **Files modified:** 3 production/test files plus this summary

## Accomplishments

- Replaced the rejected standalone `Convert Play to Roto` and `Convert Roto to Play` bottom-strip buttons with tab-click conversion requests.
- Added regression coverage that fails if visible conversion buttons return outside the confirmation dialog copy, and verifies the workflow tabs use guarded request behavior.
- Preserved D-24 Play-lane inspection-only behavior: clicking the Play lane still navigates/inspects the range and does not call conversion callbacks.
- Kept D-37/D-38 destructive confirmation copy and D-39 missing Play-output gating for Play-to-Roto conversion.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: tab-driven conversion strip contract** - `0a78037` (test)
2. **Task 2 GREEN: route conversion through workflow tabs** - `d162a75` (feat)

_Note: Both plan tasks were marked `tdd="true"`; Task 1 produced the failing source-contract test and Task 2 implemented the behavior plus final contract alignment._

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts` - Replaced the old standalone conversion-button contract with tab-driven conversion assertions, absence checks for visible conversion buttons, confirmation copy checks, and preserved Play-lane inspection coverage.
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx` - Added guarded `requestWorkflowModeChange`, removed standalone conversion buttons from `.physics-paint-state-actions`, and routed tab transitions into the existing confirmation dialog/callback flow.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Updated Studio wiring to pass `onRequestModeChange` while keeping Studio-owned workflow mode mutation and conversion callbacks.

## Decisions Made

- Kept conversion confirmation UI inside `PhysicsPaintWorkflowStrip` because the existing component already owned D-37/D-38/D-39 dialog copy and disabled Continue behavior.
- Kept actual workflow mode state in `PhysicsPaintStudio`; the strip only requests the confirmed target mode and invokes the existing conversion callbacks.
- Did not add Phase 38 source-lane behavior or casual lane conversion; the fix is limited to UAT gap 4.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The RED source-contract assertion initially checked for `onRequestModeChange` inside the literal tab markup block. During GREEN, the assertion was tightened to check tab markup calls the local guarded request function while also verifying the public callback prop exists elsewhere in the component. This preserved the intended contract without requiring noisy prop references in button JSX.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts` — passed, 1 file / 6 tests.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` — passed.
- `grep -R "Convert Play to Roto</button>\|Convert Roto to Play</button>" /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx | grep -v "confirmation"; test $? -ne 0` — passed; no visible standalone conversion buttons remain.

## Known Stubs

None found in files created/modified by this plan. Decorative `alt=""` attributes on onion overlay images are intentional accessibility markup, not UI data stubs.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None - this plan changes existing local UI event routing only; it does not introduce new network endpoints, auth paths, file access patterns, or schema changes.

## Next Phase Readiness

UAT gap 4 is closed in source and tests. Plans 09-11 can proceed with the remaining active UAT gaps without depending on standalone conversion buttons.

## Self-Check: PASSED

- Found `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx`.
- Found `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts`.
- Found `app/src/components/physic-paint/PhysicsPaintStudio.tsx`.
- Found task commit `0a78037` in git history.
- Found task commit `d162a75` in git history.
- Created `36-08-SUMMARY.md` in the phase directory.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-13*
