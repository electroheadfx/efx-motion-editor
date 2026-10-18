---
phase: quick-261018-cy1
plan: 261018-cy1
subsystem: ui
tags: [watercolor, physic-paint, uat, right-panel, paper-picker, top-bar, tool-rail]

# Dependency graph
requires:
  - phase: "55"
    provides: "Phase 55 watercolor UI (I-01..I-10, Row 11) that these UAT moves correct"
provides:
  - "Mode-derived right-panel top tabs (brush: Color+Paper; watercolor: Color+Brush+Paper), top-pane Actions retired"
  - "Oracle compact watercolor brush list (white thumbs, #2338a8 wash, uppercase names, no description)"
  - "Centered top-bar Brush size + Opacity cluster"
  - "Undo / Redo / Trash on the watercolor left rail (existing history path)"
  - "Flat Paper tab (no card), Real before Procedural, grain Soft chip at 0.35"
affects: [phase-55, phase-56, physic-paint, watercolor]

actuals:
  tokens: 9764
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Mode-derived tab lists from activeModule with a derived (not effect) stale-tab fallback"
    - "Nearest-option grain chip match with non-finite -> factory Soft 0.35"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/RightPanelBrushTab.tsx
    - app/src/components/physic-paint/view/BrushModuleSection.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts
    - app/src/components/physic-paint/view/panelSplitShell.test.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/PaperPicker.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts

key-decisions:
  - "Top-pane Actions tab removed in every mode; bottom-pane scripts Actions label stays"
  - "Thumb pigment is the single oracle constant #2338a8 in watercolorStrokeThumb.ts (SPECS/ read-only)"
  - "Grain Soft active = nearest GRAIN_STRENGTH_OPTIONS match; non-finite -> 0.35; factory default untouched"
  - "Watercolor rail history reuses PhysicsPaintHistoryActionButton + existing onUndo/onRedo/onClearFrame props"

patterns-established:
  - "Mode-derived tab lists with derived stale-tab fallback (no effect)"
  - "Nearest-option segmented-chip match instead of strict ==="

requirements-completed: [Move-1, Move-2, Move-3, Move-4, Move-5, Move-6]

coverage:
  - id: Move-1
    description: "Right-panel top tabs are mode-derived; no top-pane Actions tab in any mode"
    requirement: "Move-1"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts#top-pane tab row is mode-derived with no Actions entry"
        status: pass
    human_judgment: false
  - id: Move-6
    description: "Paint tool tab has no PAINT/FX/PHYSIC control; top-bar ModuleSwitcher untouched"
    requirement: "Move-6"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/panelSplitShell.test.tsx#Brush branch has no retired mode-selector control"
        status: pass
    human_judgment: false
  - id: Move-2
    description: "Watercolor Brush tab = oracle compact list: white thumbs, #2338a8 washes, uppercase names, no description"
    requirement: "Move-2"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#thumbs paint the oracle French Ultramarine on a white canvas"
        status: pass
    human_judgment: false
  - id: Move-5
    description: "Paper tab flat (no card), Real before Procedural, Grain Soft active at 0.35"
    requirement: "Move-5"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PaperPicker.test.tsx#grainStrength 0.35 marks Soft active"
        status: pass
    human_judgment: false
  - id: Move-3
    description: "Top-bar Brush size + Opacity centered; left keeps status pill + ModuleSwitcher"
    requirement: "Move-3"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/PhysicsPaintTopBar.test.ts#centers the tool cluster with balanced flex sides"
        status: pass
    human_judgment: false
  - id: Move-4
    description: "Watercolor left rail shows Undo / Redo / Trash plus the aquarelle tools"
    requirement: "Move-4"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts#WatercolorRail shows Undo / Redo / Trash on the existing history path"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-10-18
status: complete
plan_head_before: 42b641b63e9262177f7956bb6998c1a5adbd58bd
plan_head_after: bba5bc2b8d579172f1de5a8a39adde936802d8b1
---

# Quick 261018-cy1: UAT feedback batch on the Phase 55 watercolor UI Summary

**Six UAT moves closed as six atomic fix commits: mode-derived right-panel tabs, oracle brush thumbs, centered top-bar cluster, watercolor-rail history tools, and a flat Real-first Paper tab with Soft grain chip.**

## Accomplishments

- **Move 1 + 6 (Commit `bba77a8d`):** Top-pane tab list is mode-derived from `activeModule` — brush mode offers Color + Paper, watercolor mode adds Brush. The retired top-pane Actions entry is gone from the list, labels, and body routing (the bottom-pane scripts tab keeps its "Actions" label). A stale `'brush'` tab falls back to the Color body when the module leaves watercolor (derived in render, no effect). `RightPanelBrushTab` is watercolor-only.
- **Move 1 Paint-tab half (Commit `65bcb41b`):** `BrushModuleSection` shows the physics param bag only — the PAINT/FX/PHYSIC mode-selector import and mount are gone. The top-bar ModuleSwitcher is untouched.
- **Move 2 (Commit `67c1f2a5`):** Brush thumbs paint the oracle French Ultramarine `#2338a8` on a white canvas. Cards are a compact 2-column list: 150x44 thumb, uppercase name with tight tracking, hint as `title` tooltip only (no description paragraph). Paint-once cache, `data-testid` contract, and click-to-`selectAquarelleTip` preserved.
- **Move 5 (Commit `5bb26aac`):** Paper tab content sits flat in the tab body (no card chrome on the grid wrapper; `data-paper-picker-popover` stays as a grouping hook). Real papers come before Procedural. Grain active chip is the nearest `GRAIN_STRENGTH_OPTIONS` match; non-finite strength resolves to Soft 0.35. Factory default untouched.
- **Move 3 (Commit `eaff9dd0`):** Brush size + Opacity sit in the center of the top-bar row via balanced flex sides (left `1 1 0`, primary `0 0 auto`, right spacer `1 1 0`). Status pill + ModuleSwitcher stay left.
- **Move 4 (Commit `bba5bc2b`):** Watercolor left rail shows Undo / Redo / Trash after Dry and before the swatch. Undo/Redo reuse `PhysicsPaintHistoryActionButton`; Trash is the existing clear-frame action. No second history path.

## Verification

- All six pin suites green (62 tests): `physicsPaintRightPanelModuleGate`, `physicsPaintRightPanelPaperSingleHome`, `panelSplitShell.test.tsx.test.ts`, `WatercolorBrushLibrary`, `PaperPicker.test.tsx.test.ts`, `PhysicsPaintTopBar`.
- No package.json / lockfile diff; no `SPECS/` diff; no phase-55 index row ticks.
- Six local commits, one per UAT move (Moves 1+6 share the tab-row commit pair as two commits).

## Deviations from Plan

None — plan executed as written.

## Self-Check: PASSED

- FOUND: `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`
- FOUND: `app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx`
- FOUND: `app/src/components/physic-paint/view/watercolorStrokeThumb.ts`
- FOUND: `app/src/components/physic-paint/view/PaperPicker.tsx`
- FOUND: `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx`
- FOUND: `app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx`
- FOUND: bba77a8d, 65bcb41b, 67c1f2a5, 5bb26aac, eaff9dd0, bba5bc2b (all ancestors of HEAD)
