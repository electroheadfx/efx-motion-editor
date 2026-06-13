---
phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo
plan: 07
subsystem: ui
tags: [physics-paint, preact, ui-rebuild, shortcuts, onion-skin, workflow]

requires:
  - phase: 36-06
    provides: Bottom Physics Paint workflow strip with Roto/Play lanes, state actions, timeline lanes, onion controls, and confirmation prompts
provides:
  - Integrated five-region Physics Paint Studio layout using top bar, tool rail, canvas region, right panel, and workflow strip
  - Contextual Physics Paint keyboard shortcuts scoped to the studio surface
  - Canvas-region onion preview overlays and explicit Play/Roto conversion behavior
  - Final Physics Paint UI redlines, real paper texture labels, and bundled rail icons
affects: [physics-paint-ui, standalone-physics-paint, session-persistence, output-proof]

tech-stack:
  added: []
  patterns:
    - Five-region Physics Paint Studio composition through child components and studio-owned callbacks
    - Local keyboard shortcut handling guarded to the Physics Paint root and editable targets
    - Store-backed frame range mutations that bump physics paint version through focused store methods

key-files:
  created:
    - app/src/assets/physics-paint-ui/icons/LineiconsEraser.svg
    - app/src/assets/physics-paint-ui/icons/MaterialSymbolsUndo.svg
    - app/src/assets/physics-paint-ui/icons/clear-canvas-pencil.svg
    - app/src/assets/physics-paint-ui/icons/paint-mode-normal.svg
    - app/src/assets/physics-paint-ui/icons/paint-mode-physics.svg
    - app/src/assets/physics-paint-ui/icons/physics-all-active-paint.svg
    - app/src/assets/physics-paint-ui/icons/physics-dry-paint.svg
    - app/src/assets/physics-paint-ui/icons/physics-last-stroke.svg
  modified:
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.test.ts
    - app/src/types/physicPaint.ts

key-decisions:
  - "Recovered existing 36-07 commits instead of re-dispatching the executor because production commits already existed without a SUMMARY.md."
  - "Kept shortcut handling local to PhysicsPaintStudio rather than modifying global shortcuts, preserving contextual behavior and input guards."
  - "Moved final onion controls into the sidebar workflow surface while leaving canvas-region onion preview rendering in the integrated studio path."

patterns-established:
  - "PhysicsPaintStudio owns destructive workflow callbacks and passes them into visual regions instead of letting child panels mutate shared state directly."
  - "Physics Paint UI redlines are applied through component/CSS refinements without reintroducing the retired toolbar or diagnostics grid render path."

requirements-completed: [UI-REBUILD-01, UI-REBUILD-02, SAVE-01, SAVE-02, OUT-01, OUT-02]

duration: recovered
completed: 2026-06-13
---

# Phase 36: Plan 07 Summary

**Integrated five-region standalone Physics Paint Studio with contextual shortcuts, onion previews, workflow conversions, and final UI redlines**

## Performance

- **Duration:** recovered from existing commits
- **Started:** 2026-06-12T13:55:15Z
- **Completed:** 2026-06-13T06:23:57Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- Replaced the old studio toolbar render path with the rebuilt five-region layout: top bar, left tool rail, central canvas, right panel, and bottom workflow strip.
- Preserved Physics Paint bridge, frame sync, save/load, publish, play preview, and debug export behavior through Studio-owned callbacks.
- Added canvas-region onion preview generation, explicit Play→Roto and Roto→Play conversion behavior, and focused store cleanup/version mutations.
- Scoped Physics Paint shortcuts to the studio surface with editable-target guards for undo/redo, preview stop, save, help, frame navigation, onion controls, and workflow actions.
- Applied final visual redlines: bundled real rail icons, real paper texture choices, compact panels, relocated onion controls, and tightened Pencil-spec styling.

## Task Commits

Existing production commits were recovered and summarized instead of re-executed:

1. **Task 1: Wire five-region layout into PhysicsPaintStudio** - `a5ccc71` (feat)
2. **Task 2: Implement synced onion overlays and workflow conversions** - `4551848` (feat)
3. **Visual redline pass: align UI with Pencil spec** - `dfdc268` (fix)
4. **Visual redline pass: use real paper textures** - `a370c23` (fix)
5. **Visual redline pass: final Physics Paint UI redlines** - `0869af3` (fix)

**Plan metadata:** this recovery summary documents the already-committed 36-07 work after the safe-resume gate found commits without a summary.

## Files Created/Modified

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Integrated five-region studio composition, frame navigation, onion preview construction, conversion callbacks, and local shortcut handling.
- `app/src/components/physic-paint/PhysicsPaintRightPanel.tsx` - Final right-panel controls and workflow/onion presentation refinements.
- `app/src/components/physic-paint/PhysicsPaintToolRail.tsx` - Final left rail actions and bundled icon usage.
- `app/src/components/physic-paint/PhysicsPaintTopBar.tsx` - Compact top controls, engine/status actions, and real paper texture options.
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.tsx` - Roto/Play workflow strip behavior, active lane states, and final control placement.
- `app/src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts` - Updated workflow strip expectations for the final UI behavior.
- `app/src/components/physic-paint/physicsPaintStudio.css` - Final integrated layout, panel, canvas, overlay, and responsive styling.
- `app/src/stores/physicPaintStore.ts` - Focused frame-range cleanup mutation used by conversion behavior.
- `app/src/stores/physicPaintStore.test.ts` - Store mutation expectations updated for focused cleanup behavior.
- `app/src/types/physicPaint.ts` - Type refinement for final workflow strip/control state.
- `app/src/assets/physics-paint-ui/icons/*.svg` - Bundled rail/action icons used by the rebuilt Physics Paint UI.

## Decisions Made

- Closed out the plan manually because the safe-resume gate found five `36-07` commits with no `36-07-SUMMARY.md`; re-dispatching would have risked duplicate work.
- Kept `PhysicsPaintStudioToolbar.tsx` out of the Studio render path rather than deleting it blindly, limiting cleanup to the integration requirement.
- Kept keyboard handling local to the Physics Paint root, preserving global shortcut behavior elsewhere and satisfying the input/contenteditable guard requirement.

## Deviations from Plan

### Auto-fixed Issues

**1. Recovery summary created after committed work**
- **Found during:** execute-phase safe-resume gate
- **Issue:** `36-07` production commits existed but `36-07-SUMMARY.md` was missing, so standard plan discovery treated the plan as incomplete.
- **Fix:** Inspected the existing commits, verified source gates/tests/typecheck, and created this SUMMARY.md instead of re-running the executor.
- **Files modified:** `.planning/phases/36-physics-paint-ui-rebuild-session-persistence-and-output-proo/36-07-SUMMARY.md`
- **Verification:** `git log --grep="36-07"` found the recovered commits; targeted tests and typecheck passed.
- **Committed in:** pending summary commit

---

**Total deviations:** 1 recovery deviation
**Impact on plan:** Prevented duplicate implementation while preserving GSD tracking and verification evidence.

## Issues Encountered

- The first manual test command used `pnpm --dir app vitest ...`, which pnpm interpreted as an executable path and failed with `EACCES`. The same target suite passed when rerun as `pnpm --dir app exec vitest run ...`.
- Human visual review generated redline commits (`dfdc268`, `a370c23`, `0869af3`) that were already present before this recovery summary was created.

## Verification

- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vitest run src/components/physic-paint/physicsPaintWorkflowState.test.ts src/components/physic-paint/physicsPaintSessionFile.test.ts src/components/physic-paint/physicsPaintDevExport.test.ts src/lib/physicPaintBridge.test.ts src/components/physic-paint/PhysicsPaintWorkflowStrip.test.ts src/stores/physicPaintStore.test.ts` — passed, 6 files / 53 tests.
- `pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck` — passed.
- Source gates confirmed `PhysicsPaintStudio.tsx` renders `PhysicsPaintTopBar`, `PhysicsPaintToolRail`, `PhysicsPaintRightPanel`, and `PhysicsPaintWorkflowStrip`.
- Source gates confirmed `buildOnionPreviewFrames`, `convertPlayToRoto`, and the D-39 missing Play output copy exist in `PhysicsPaintStudio.tsx`.
- Source gates confirmed frame-sync bridge behavior calls `timelineStore.seek` and `timelineStore.ensureFrameVisible`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 36 now has a complete plan summary set and is ready for post-execution gates, code review, regression checks, and phase-level verification.

---
*Phase: 36-physics-paint-ui-rebuild-session-persistence-and-output-proo*
*Completed: 2026-06-13*
