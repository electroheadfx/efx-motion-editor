---
phase: quick-261018-ias
plan: 261018-ias
subsystem: physic-paint studio ui
tags: [preact, watercolor, paper-tab, texture-slider, css, uat]

# Dependency graph
requires:
  - phase: "261018-gqo"
    provides: "Paper tab grain pair (Grain strength + Grain scale) on the grainStrength seam; no second paper-strength store"
provides:
  - "Paper tab Texture slider (oracle PaperPanel control, 0..1) riding the grainStrength write-through"
  - "UAT CSS rhythm across Studio panels (15 literal class/value moves)"
  - "Onion frames + Onion Value on one 2-column row"
affects: [phase-56, watercolor-studio-ui, paper-tab, physic-paint-chrome]

# Actuals (#2632)
actuals:
  tokens: 6300
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Texture is a continuous view over the same grainStrength seam the segmented presets write — no second store field"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/view/PaperPicker.test.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/panelSplitShell.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightSidebar.test.ts
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts

key-decisions:
  - "Texture rides handleGrainStrengthChange unchanged (setGrainStrength + setPaperStrength + setRotoBackgroundMetadata + setBackgroundFallback) — no second paper-strength store"
  - "paint-tab-size-opacity keeps the item-3 11px control-row gap; item-4 15px applies to the other five selectors (plan's conflict resolution)"
  - "Brush card border is always #c8c8c8; selected cue is the accent background tint only"
  - "Prior-round pins overridden by the UAT list were retargeted (module-section 10px→15px, single-tab-panel top 0→10px, select font-size rule restored)"

patterns-established:
  - "Oracle PaperPanel Texture control ports as a SliderStepper over grainStrength with the oracle tooltip on the row wrapper"

requirements-completed: [UAT-4R-A1, UAT-4R-A2]

coverage:
  - id: UAT-4R-A1
    description: "Paper tab Texture slider under Grain scale, 0..1, writes the existing grainStrength seam"
    requirement: UAT-4R-A1
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PaperPicker.test.tsx#Texture slider sits under Grain scale and writes the grainStrength seam (261018-ias)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PaperPicker.test.tsx#Texture row carries the oracle tooltip and stays inside the grain block"
        status: pass
    human_judgment: true
    rationale: "Slider feel and the live write-through (engine paperTexture / bake) need a live Studio pass"
  - id: UAT-4R-A2
    description: "15 literal CSS moves: paper cell/name colors, panel gaps/padding, tool-rail 35px buttons, onion one-row, brush light-gray borders"
    requirement: UAT-4R-A2
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#every card border is a light gray; selected keeps the accent tint (261018-ias)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/panelSplitShell.test.tsx#paint-tab branch hosts the size/opacity pair above the module switch (261018-f15) — onion one-row pins"
        status: pass
    human_judgment: true
    rationale: "Class/value list is a visual UAT checklist; only the live Studio screenshots can judge the rhythm"

# Metrics
duration: 12min
completed: 2026-10-18
status: complete
plan_head_before: e52ec74fb79073e800fa920038f66b6a54194734
plan_head_after: e0a00b612c46b2553e9fe46b80d0b4d06178b62d
---

# Quick 261018-ias: Fourth UAT Round on the Watercolor Brush Summary

**Oracle Texture slider ported onto the grainStrength seam plus the user's 15-item Studio CSS list applied literally — two atomic commits for independent UAT.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2/2
- **Commits:** 2 (measured from plan ledger)

## Accomplishments

### AREA 1 — Texture slider (commit `3c87939b`)

- Ported the oracle `PaperPanel` Texture control into the Paper tab, under Grain scale: `SliderStepper` labeled `Texture`, range 0..1, step 0.01, `freeEntry`.
- Value and `onChange` ride the existing `grainStrength` prop / `onGrainStrengthChange` write-through (`handleGrainStrengthChange` in `PhysicsPaintStudio.tsx`) — no second paper-strength store, no metadata schema change.
- Oracle tooltip on the row wrapper: "How strongly the paper's tooth, fibres and flecks show. Saved images use the same strength."
- DOM order inside `data-paper-picker-grain`: Grain strength segmented → Grain scale → Texture. Names stay Grain strength + Grain scale (261018-gqo / Q6).
- Pins added in `PaperPicker.test.tsx` (Texture DOM order, 0..1 range, write-through).

### AREA 2 — CSS adjustments (commit `e0a00b61`)

All 15 UAT items applied:

| # | Item | Value |
|---|------|-------|
| 1 | `.paper-picker-cell` background | `#c4c4c4` |
| 2 | `.paper-picker-cell-name` color | `#3d3d3d` |
| 3 | `paint-tab-size-opacity` + `physics-paint-segmented-row` gap | `11px` |
| 4 | module-section / option-group / scripts-panel / onion panel / paper-picker-grain gap | `15px` |
| 5 | `.physics-paint-roto-interpolation-select` font-size | `12px` |
| 6 | `.physics-paint-option-row` gap | `10px` |
| 7 | Brush + Paper panels padding | `0 14px 14px` |
| 8 | Brush card borders | always `#c8c8c8` (selected keeps accent tint) |
| 9 | Onion frames + Onion Value | one 2-column row |
| 10 | `.physics-paint-topbar-slider` min-width | `140px` |
| 11 | `.module-switcher` margin-right | `15px` |
| 12 | `.physics-paint-single-tab-panel` padding-top | `10px` |
| 13 | `.physics-paint-audio-clip-import` padding | `15px` |
| 14 | `.physics-paint-tool-rail` gap | `7px` |
| 15 | tool-rail icon buttons | `35px × 35px` |

Item 3/4 conflict resolved per plan: `paint-tab-size-opacity` keeps `11px` (control-row gap); item 4's `15px` applies to the other five selectors.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run` — **5271 passed, 1 skipped, 96 todo, 0 failed** (305 files).
- Pin suites green after each commit: `PaperPicker.test.tsx.test.ts`, `paperThumb.test.ts`, `physicsPaintRightPanelPaperSingleHome.test.ts`, `physicsPaintRightPanelModuleGate.test.ts`, `WatercolorBrushLibrary.test.ts`, `PhysicsPaintTopBar.test.ts`, `panelSplitShell.test.tsx.test.ts`.
- Scope fence held: no `SPECS/` diff, no package.json / lockfile diff, no `physicPaintStore.ts` image APIs, no `phase-55-issues/index.md` ticks, `physicsPaintStudioSettings.ts` defaults untouched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment token tripped the `paper-strength` absence pin**
- **Found during:** Task 1
- **Issue:** The new Texture slider comment said "no second paper-strength store"; `physicsPaintRightPanelPaperSingleHome.test.ts` scans the picker source for the literal token `paper-strength`.
- **Fix:** Reworded the comment to "no second strength store".
- **Files modified:** `app/src/components/physic-paint/view/PaperPicker.tsx`
- **Commit:** `3c87939b`

**2. [Rule 1 - Bug] Three prior-round pins asserted retired values the UAT list overrides**
- **Found during:** Task 2 / full-suite verification
- **Issue:**
  - `PhysicsPaintRightSidebar.test.ts` pinned `.physics-paint-single-tab-panel { padding-top: 0 }` (36.15-13) — UAT item 12 wants `10px`.
  - `AquarelleGlobalsPanel.test.ts` pinned `.physics-paint-module-section` gap `10px` (261018-gqo) — UAT item 4 wants `15px`.
  - `PhysicsPaintWorkflowStrip.test.ts` pinned the absence of `.physics-paint-roto-interpolation-select` (260911-s1j retired Interpolation pill) — UAT item 5 styles that class (still live on the Track Blend select).
- **Fix:** Retargeted the three pins to the UAT values; the retired Interpolation pill chrome assertions (`--interpolation`, `-controls`, `-mode`) stay.
- **Files modified:** `PhysicsPaintRightSidebar.test.ts`, `AquarelleGlobalsPanel.test.ts`, `PhysicsPaintWorkflowStrip.test.ts`
- **Commit:** `e0a00b61`

### Notes

- AREA 1 was first committed without the pin file (launcher path `PaperPicker.test.tsx.test.ts` staged instead of the real suite `PaperPicker.test.tsx`); soft-reset and recommitted as one atomic AREA 1 commit before moving on.
- No package installs. No SPECS/ edits. No new dependencies.

## Known Stubs

None.

## Threat Flags

None — Texture rides the existing write-through seam (T-261018-IAS-01 mitigated); CSS is presentation-only (T-261018-IAS-02 accepted).

## Self-Check: PASSED

- FOUND: `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PaperPicker.tsx`
- FOUND: `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PaperPicker.test.tsx`
- FOUND: `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintStudio.css`
- FOUND: `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx`
- FOUND: `3c87939b` (feat Texture slider)
- FOUND: `e0a00b61` (style CSS adjustments)
