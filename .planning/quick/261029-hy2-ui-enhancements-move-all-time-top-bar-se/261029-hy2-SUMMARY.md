---
phase: 261029-hy2
plan: 01
subsystem: ui
tags: [preact, signals, physics-paint, floating-sheets, vitest, source-pins]

# Dependency graph
requires: []
provides:
  - "Right-pinned top-bar settings cluster (flex-end) with the container-query hide chain intact"
  - "One unified TopBarBrushTrigger pill for Brush and Eraser, with a per-tool leading icon"
  - "Anchored Eraser shape popover (15 BRUSH_PRESETS, no Open-modal action) writing only aquarelleLiftTipId"
  - "Water/Pen drop the settings cluster from the DOM entirely"
  - "Right sidebar top-pane tabs reduced to Color | Brush | Paper | Memory"
  - "PhysicsPaintSettingsModal — a floating Settings sheet hosting RightPanelSettingsTab"
  - "Slimmed RightPanelBrushTab: Settings button, 15px gap, brush catalog"
  - "floatingSheetStack module owning the three sheets' z-indexes with click-to-front"
  - "Brush catalog Close-button pointerdown guard"
affects: [physics-paint-ui, studio-floating-sheets, quick-261030+]

# Actuals (#2632) — same estimateTokens scale as the plan estimate (chars/4).
actuals:
  tokens: 26400        # chars/4 over the realized app/ diff (105,553 chars)
  tasks: 3
  commits: 3
  plan_head_before: 2931fd2b69bc605c772daca7dcb79ed76ecd5c48
  plan_head_after: a88f04bfd1499d69851b7c273193e0b473a7b8e1

tech-stack:
  added: []
  patterns:
    - "Module-scope signals array + selector for cross-component z-order (floatingSheetStack)"
    - "Per-sheet id constants imported by each sheet — no inline id strings"

key-files:
  created:
    - app/src/components/physic-paint/view/PhysicsPaintSettingsModal.tsx
    - app/src/components/physic-paint/view/floatingSheetStack.ts
    - app/src/components/physic-paint/view/floatingSheetStack.test.ts
    - app/src/components/physic-paint/view/physicsPaintSettingsModal.test.ts
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/RightPanelBrushTab.tsx
    - app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "floatingSheetStack exports per-sheet id constants (SHEET_ID_*) so no component spells an id string inline"
  - "Sheet raise rides onPointerDownCapture so the Close buttons' stopPropagation cannot block raising"
  - "Water/Pen hide the whole settings cluster via a conditional render, not disabled styling"
  - "The Settings sheet reuses the stroke-settings sheet mechanics verbatim (inset, drag, resize, Escape, session layout)"
  - "LiftShapePicker deleted; the eraser pill + brush popover fully replace its role"

patterns-established:
  - "Stack ordering: one bottom-to-top signal, compare-then-write raise, selectors read narrowly"
  - "Source-pin suites strip comments before negative scans"

requirements-completed: [UI-TOPBAR, UI-TOOL-PILL, UI-SETTINGS-MODAL, UI-BRUSH-TAB, UI-SHEETS]

coverage:
  - id: D1
    description: "Top-bar settings cluster pinned right at every width; container-query hide chain unchanged"
    requirement: UI-TOPBAR
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts (flex-end + container-query pins)"
        status: pass
      - kind: manual_procedural
        ref: "Live UAT: top bar at ~1440/1180/861/720 px"
        status: unknown
    human_judgment: true
    rationale: "Right-edge alignment and the hide chain at four widths are visual judgments in the packaged app."
  - id: D2
    description: "One tool pill for Brush and Eraser (icon + thumb + name + chevron), disabled contract preserved"
    requirement: UI-TOOL-PILL
    verification:
      - kind: unit
        ref: "PhysicsPaintTopBar.test.ts (icon/name/aria, disabled on both mounts)"
        status: pass
      - kind: manual_procedural
        ref: "Live UAT: pill appearance and disabled state"
        status: unknown
    human_judgment: true
    rationale: "Pill rendering and disabled feel are visual/interaction judgments."
  - id: D3
    description: "Eraser popover lists the 15 shapes with no Open modal; a pick writes only the lift tip"
    requirement: UI-TOOL-PILL
    verification:
      - kind: unit
        ref: "PhysicsPaintBrushPicker.test.ts (lift tip written, tool/brush/multipliers untouched, region pin)"
        status: pass
      - kind: manual_procedural
        ref: "Live UAT: eraser pill opens the shape popover and a pick paints with that shape"
        status: unknown
    human_judgment: true
    rationale: "Actual erasing with the picked shape is only observable live."
  - id: D4
    description: "Water and Pen render no settings cluster in the DOM"
    requirement: UI-TOPBAR
    verification:
      - kind: unit
        ref: "PhysicsPaintTopBar.test.ts (no .physics-paint-topbar-primary with Water/Pen)"
        status: pass
      - kind: manual_procedural
        ref: "Live UAT: Water/Pen bar shows the pill only"
        status: unknown
    human_judgment: true
    rationale: "The UAT row is a live visual check of the tool switch."
  - id: D5
    description: "Right sidebar tabs reduced to Color | Brush | Paper | Memory"
    requirement: UI-BRUSH-TAB
    verification:
      - kind: unit
        ref: "PhysicsPaintRightPanel.test.ts + PhysicsPaintRightSidebar.test.ts + physicsPaintRightPanelModuleGate.test.ts"
        status: pass
      - kind: manual_procedural
        ref: "Live UAT: sidebar shows four tabs; no stranded Settings tab"
        status: unknown
    human_judgment: true
    rationale: "Stored tab ids from earlier sessions can only be exercised live."
  - id: D6
    description: "Brush tab: Settings button at the top, 15px gap, catalog; no Size slider or globals clone"
    requirement: UI-BRUSH-TAB
    verification:
      - kind: unit
        ref: "panelSplitShell.test.tsx.test.ts (order pin + 15px gap rule)"
        status: pass
      - kind: manual_procedural
        ref: "Live UAT: Brush tab layout and Settings entry point"
        status: unknown
    human_judgment: true
    rationale: "Spacing/layout fidelity is a visual judgment."
  - id: D7
    description: "Floating Settings sheet (drag, resize, Escape, session layout) hosting the eight multipliers"
    requirement: UI-SETTINGS-MODAL
    verification:
      - kind: unit
        ref: "physicsPaintSettingsModal.test.ts (dialog, close, drag, session layout, Escape source pins)"
        status: pass
      - kind: manual_procedural
        ref: "Live UAT: sheet opens from the Brush tab, drags/resizes, multipliers apply"
        status: unknown
    human_judgment: true
    rationale: "Pointer capture, Escape and live painting response need the packaged app."
  - id: D8
    description: "Brush catalog Close button closes via pointerdown guard (drag header no longer swallows it)"
    requirement: UI-SHEETS
    verification:
      - kind: unit
        ref: "PhysicsPaintBrushPicker.test.ts (stopPropagation spy, close flips the signal, header preventDefault intact)"
        status: pass
      - kind: manual_procedural
        ref: "Live UAT: catalog Close button click in WKWebView"
        status: unknown
    human_judgment: true
    rationale: "Compatibility click dispatch after a pointerdown guard is browser behavior only the packaged webview proves."
  - id: D9
    description: "Shared floating-sheet stack: pressing a sheet raises it; z-indexes 50/51/52 from one module"
    requirement: UI-SHEETS
    verification:
      - kind: unit
        ref: "floatingSheetStack.test.ts + z-index pins in PhysicsPaintBrushPicker.test.ts / physicsPaintSettingsModal.test.ts"
        status: pass
    human_judgment: false

# Metrics
duration: 17 min
completed: 2026-10-29
status: complete
---

# Phase 261029-hy2 Plan 01: UI enhancements Summary

**Right-pinned tool-first top bar with a unified Brush/Eraser pill, the Settings tab reborn as a floating sheet, and one shared click-to-front stack for the three Studio sheets**

## Performance

- **Duration:** 17 min (from the plan's base commit to the full-suite gate)
- **Started:** 2026-10-29T12:21:53Z
- **Completed:** 2026-10-29T12:39:00Z
- **Tasks:** 3/3
- **Files modified:** 22 (1,298 insertions, 266 deletions)

## Accomplishments
- Top bar is tool-first: the settings cluster is right-pinned (`flex-end`) and the container-query hide chain is untouched; Water/Pen render no cluster at all.
- One `TopBarBrushTrigger` serves Brush and Eraser with a per-tool leading icon; the Eraser pill opens an anchored 15-shape popover that writes only `aquarelleLiftTipId` (no tool flip, no multiplier touch), and `LiftShapePicker` is deleted.
- The right sidebar's Settings tab is retired into a new floating `PhysicsPaintSettingsModal` opened from a Settings button at the top of the Brush tab, separated from the catalog by 15px.
- A new `floatingSheetStack` module owns the three sheets' z-indexes; any press (capture phase, so Close buttons included) raises its sheet.
- The brush catalog's Close button stops its pointerdown before the drag header, so it closes again.

## Task Commits

Each task was committed atomically:

1. **Task 1: Right-pinned top bar and one tool pill** - `5bba67ef` (feat)
2. **Task 2: Settings tab retired into a floating sheet** - `2e7714d6` (feat)
3. **Task 3: Shared sheet stack and the brush Close fix** - `a88f04bf` (feat)

**Plan metadata:** handled by the orchestrator (docs commit is out of executor scope per the dispatch instructions).

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` - right-pinned cluster, `TopBarBrushTrigger`, tool-aware toggles
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` - lift branch first (15 shapes, no Open modal), brush branch second
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` - `aquarelleBrushMenuTarget`, `aquarelleSettingsModalOpen` (compare-then-write)
- `app/src/components/physic-paint/view/PhysicsPaintSettingsModal.tsx` (new) - the floating Settings sheet
- `app/src/components/physic-paint/view/floatingSheetStack.ts` (new) - shared bottom-to-top order, `sheetZIndex`, `bringSheetToFront`
- `app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx` - stack wiring + Close pointerdown guard
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` - stack wiring (behaviour untouched)
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - four-tab row, Settings branch removed
- `app/src/components/physic-paint/view/RightPanelBrushTab.tsx` - Settings button + catalog
- `app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx` - Settings sheet mount behind the picker gate
- `app/src/components/physic-paint/physicsPaintStudio.css` - flex-end cluster, brush-trigger icon, brush-tab body gap
- `app/src/components/physic-paint/view/LiftShapePicker.tsx` - deleted (superseded by the eraser pill)
- Test suites: `PhysicsPaintTopBar.test.ts`, `PhysicsPaintBrushPicker.test.ts`, `PhysicsPaintRightPanel.test.ts`, `physicsPaintRightPanelModuleGate.test.ts`, `panelSplitShell.test.tsx.test.ts`, `physicsPaintSettingsModal.test.ts` (new), `floatingSheetStack.test.ts` (new), `PhysicsPaintRightSidebar.test.ts`, `PhysicsPaintStudioView.test.ts`, `roto/aquarelleLiftEraseContract.test.ts`

## Decisions Made
- `floatingSheetStack` exports per-sheet id constants (`SHEET_ID_STROKE_SETTINGS`, `SHEET_ID_BRUSHES`, `SHEET_ID_SETTINGS`) so no sheet component spells an id string inline, as the plan requires.
- The raise rides `onPointerDownCapture`: the Close buttons stop pointerdown propagation by design, and raising must still happen for them.
- The Settings sheet reuses the stroke-settings sheet mechanics verbatim rather than introducing a second floating-window implementation.
- `LiftShapePicker.tsx` is deleted outright; its only mount was the top bar, and the eraser pill replaces it.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `gsd_run` CLI is unavailable in this environment (`__GSD_RUN_UNAVAILABLE__`): used the documented fallback for the protected-branch assertion (branch `dev` matches no protected pattern) and the manual plan-commit ledger (base `2931fd2b`).
- The compare-then-write test initially counted the subscription's immediate initial delivery; it now zeroes the counter after subscribing, so it measures writes only.
- The first execution of the lift region pin tripped on its own explanatory comment (the pin slices raw source); the comment was reworded to avoid naming the brush picker symbol.

## Known Stubs

None.

## Threat Flags

None — the plan's threat register records no new trust boundaries; all changes are local UI layout, composition and in-memory signals.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All three tasks are committed and the full suite is green: 354 test files passed (2 skipped), 6,313 tests passed, 1 skipped, 96 todo, zero failures; `tsc --noEmit` clean after every task.
- Automated-ready only: the live UAT rows (top bar at ~1440/1180/861/720 px, eraser pill behaviour, Water/Pen cluster absence, Brush tab layout, Settings sheet interaction, WKWebView Close-button click, click-to-front on the three sheets) remain user-run and were not claimed here.
- The plan's two advisory PLAN.md corrections remain uncommitted, as dispatched.

---
*Phase: 261029-hy2*
*Completed: 2026-10-29*

## Self-Check: PASSED

- All four created source/test files exist on disk.
- All three task commits are ancestors of HEAD: `5bba67ef`, `2e7714d6`, `a88f04bf`.
- `LiftShapePicker.tsx` is deleted as planned.
- Full suite rerun after the last commit: 354 files passed (2 skipped), 6,313 tests passed, zero failures; `tsc --noEmit` clean.
