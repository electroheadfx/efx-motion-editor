---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 05
subsystem: ui
tags: [preact, physics-paint, efx-ui, css, svg-icons]

requires:
  - phase: 36-04
    provides: Physics Paint Studio callback/orchestration readiness for five-region UI wiring
provides:
  - EFX-style Physics Paint top bar with brush/background/grain controls and compact status
  - Ordered SVG left tool rail preserving explicit engine callback props
  - Lightweight right panel for brush color, palette, blend preview, and tool options
affects: [phase-36-ui-rebuild, physics-paint-studio, phase-36-plan-07]

tech-stack:
  added: []
  patterns:
    - Callback-only Preact child components for engine mutations
    - CSS-variable EFX visual regions without shadcn or second physics engine

key-files:
  created:
    - app/src/components/physic-paint/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/PhysicsPaintRightPanel.tsx
  modified:
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "Kept the new UI components callback-only so engine state ownership remains in PhysicsPaintStudio."
  - "Implemented the right-sidebar blend preview as DOM/CSS color preview and palette controls, not a second EfxPaintEngine or canvas replay."

patterns-established:
  - "Top/rail/right Physics Paint regions use app CSS variables and 32px icon-button affordances for Phase 36 wiring."
  - "Dev PNG+manifest export is only rendered from the top bar when devExportEnabled is true."

requirements-completed: [UI-REBUILD-01, SAVE-01, SAVE-02, OUT-01, OUT-02]

duration: 6min 20s
completed: 2026-06-12
---

# Phase 36 Plan 05: Physics Paint Top/Rail/Right UI Regions Summary

**EFX-style Physics Paint top bar, SVG tool rail, and lightweight right panel for the rebuilt standalone UI.**

## Performance

- **Duration:** 6 min 20 sec
- **Started:** 2026-06-12T13:28:38Z
- **Completed:** 2026-06-12T13:34:58Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `PhysicsPaintTopBar` with brush size, opacity, background, paper grain, exact `Grain strength` choices, compact `Engine ready` / `Engine not ready` status, Save/Load state controls, and gated `Dev export` / `Export PNGs + manifest` actions.
- Created `PhysicsPaintToolRail` with the exact eight-item UI-SPEC order and local SVG icon paths for Paint, Paint with physics, Erase, Undo, Clear frame, physics-last, physics-all, and Dry/freeze actions.
- Created `PhysicsPaintRightPanel` with brush color selection, hex validation, palette/recent/favorite reuse, opacity-aware DOM/CSS blend preview, and active-tool options including erase strength only for erase mode.
- Extended `physicsPaintStudio.css` with five-region EFX-style layout classes, visible focus rings, active accent states, compact status, tool rail buttons, right panel styling, and CSS-variable color usage.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create top bar and left rail components** - `4532827` (feat)
2. **Task 2: Create right panel and shared visual styles** - `3311891` (feat)

**Plan metadata:** pending final docs commit

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintTopBar.tsx` - Top bar controls, compact readiness/apply/error status, gated dev export, Save/Load state callbacks.
- `app/src/components/physic-paint/PhysicsPaintToolRail.tsx` - Ordered SVG icon rail with tool/action/press-action callback props.
- `app/src/components/physic-paint/PhysicsPaintRightPanel.tsx` - Brush color widget, lightweight blend preview, palette controls, and tool option sliders.
- `app/src/components/physic-paint/physicsPaintStudio.css` - EFX-style top/left/canvas/right layout and shared control styling.

## Decisions Made

- Engine mutations remain behind explicit callback props, satisfying the control-callback threat mitigation and keeping ownership in `PhysicsPaintStudio.tsx` for Plan 07 wiring.
- The right panel uses a DOM/CSS color preview and existing color preference helpers rather than importing `@efxlab/efx-physic-paint/preact`, creating `EfxPaintCanvas`, or instantiating another engine.
- `Grain strength` keeps exactly `None`, `Soft`, `Med`, `Hard` per D-06 and the plan acceptance criteria.

## Deviations from Plan

None - plan executed as written.

## Issues Encountered

- The tasks were marked TDD, but the plan's verification was source assertions plus app typecheck for new unmounted UI components. No separate test harness file was added; verification followed the plan's automated commands.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` passed after Task 1.
- `test $(grep -v '^#' /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintTopBar.tsx | grep -c 'Grain strength') -ge 1` passed.
- `test $(grep -v '^#' /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintToolRail.tsx | grep -c 'physics-dry-paint.svg') -ge 1` passed.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` passed after Task 2.
- `test $(grep -v '^#' /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintRightPanel.tsx | grep -c 'EfxPaintCanvas') -eq 0` passed.
- `test $(grep -v '^#' /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintStudio.css | grep -c 'var(--color-accent)') -ge 1` passed.
- Final `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` passed.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The `placeholder="#103c65"` string in `PhysicsPaintRightPanel.tsx` is an input placeholder/example for the hex field, not a stubbed data path.

## Next Phase Readiness

- Plan 06 can build the bottom Roto/Play workflow strip using the new `.physics-paint-studio` layout and shared button/status styles.
- Plan 07 can wire `PhysicsPaintTopBar`, `PhysicsPaintToolRail`, and `PhysicsPaintRightPanel` into `PhysicsPaintStudio.tsx` through the callback props created here.

## Self-Check: PASSED

- Created files exist: `PhysicsPaintTopBar.tsx`, `PhysicsPaintToolRail.tsx`, `PhysicsPaintRightPanel.tsx`.
- Modified style file exists: `physicsPaintStudio.css`.
- Task commits exist: `4532827`, `3311891`.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-12*
