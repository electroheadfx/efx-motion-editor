---
phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room
plan: 02
subsystem: ui
tags: [preact, signals, module-switcher, panel-split, watercolor, segmented-control]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split
    provides: shared Studio engine seam (one engine for all modules)
provides:
  - activeModule signal (shared Brush/Water color module identity)
  - ModuleSwitcher component mounted in Toolbar + PhysicsPaintTopBar
  - Shared/module panel-split shell (D-05 structure)
  - WatercolorModuleSection empty-tolerant shell (56-07 fills it)
  - BrushModuleSection physics param bag + PaintModeSelector extraction
affects: [56-03, 56-04, 56-05, 56-06, 56-07]

actuals:
  tokens: 8337
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared activeModule signal for module identity (never per-mount copies)"
    - "Panel-split shell: shared block always visible, module-only block drains per activeModule"
    - "Empty-tolerant module shell pattern (section label only, body lands in later plan)"

key-files:
  created:
    - app/src/components/shared/activeModule.ts
    - app/src/components/shared/ModuleSwitcher.tsx
    - app/src/components/shared/ModuleSwitcher.test.tsx
    - app/src/components/shared/ModuleSwitcher.test.tsx.test.ts
    - app/src/components/physic-paint/view/WatercolorModuleSection.tsx
    - app/src/components/physic-paint/view/BrushModuleSection.tsx
    - app/src/components/physic-paint/view/panelSplitShell.test.tsx
    - app/src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts
  modified:
    - app/src/components/layout/Toolbar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css

key-decisions:
  - "Krita slot is disabled + no-op onClick (both belt and suspenders: disabled attr blocks real clicks, no-op handler satisfies the click-does-nothing contract)"
  - "Shared block section labels are structural (Color/Size/Opacity/Paper); Paper is a labelled placeholder row — picker lands in 56-05"
  - "BrushModuleSection extracts the physics param bag from the panel stack; SmoothingButton removed from PhysicsPaintRightPanel (moved into BrushModuleSection)"

patterns-established:
  - "Module identity via one shared signal — both mounts read/write activeModule, never local state"
  - "Panel-split shell: shared block always visible, module-only block drains per activeModule (D-05)"

requirements-completed: [MOD-01, MOD-02, MOD-03, MOD-06]

coverage:
  - id: D1
    description: "Top-bar module switcher with three segments Brush / Water color / Krita, Krita inert with v2.1.0 tooltip"
    requirement: "MOD-01"
    verification:
      - kind: unit
        ref: "src/components/shared/ModuleSwitcher.test.tsx.test.ts#renders three segments with the exact labels Brush, Water color, Krita"
        status: pass
      - kind: unit
        ref: "src/components/shared/ModuleSwitcher.test.tsx.test.ts#clicking Krita leaves activeModule unchanged"
        status: pass
    human_judgment: false
  - id: D2
    description: "One shared activeModule signal; both Toolbar and PhysicsPaintTopBar mounts share it; switch never mutates document/timeline"
    requirement: "MOD-02"
    verification:
      - kind: unit
        ref: "src/components/shared/ModuleSwitcher.test.tsx.test.ts#is the single shared signal imported by both top-bar mounts"
        status: pass
      - kind: unit
        ref: "src/components/shared/ModuleSwitcher.test.tsx.test.ts#switching module never calls a document or timeline store setter"
        status: pass
    human_judgment: false
  - id: D3
    description: "Shared/module panel-split: shared labels Color/Size/Opacity/Paper always visible; module block drains per activeModule; PaintModeSelector stays in Brush only"
    requirement: "MOD-03"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts#shared section labels appear regardless of activeModule"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts#watercolor branch does not render PaintModeSelector"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts#Brush branch keeps its physics param bag"
        status: pass
    human_judgment: false
  - id: D4
    description: "No krita implementation module, package, or engine adapter in the tree — the only Krita surface is the inert slot label"
    requirement: "MOD-06"
    verification:
      - kind: other
        ref: "grep for libmypaint/.myb/ktorita engine imports under packages/ and app/src — only type declarations and display names"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-15
status: complete
---

# Phase 56 Plan 02: Module Switcher and Panel-Split Shell Summary

**Module switcher (Brush | Water color | Krita) shipped as one shared component over one active-module signal, with Krita inert and the shared/module panel-split shell in the Studio right panel.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-15T22:40:01Z
- **Completed:** 2026-10-15T22:47:23Z
- **Tasks:** 2 completed
- **Files modified:** 12

## Accomplishments

- ModuleSwitcher renders three abutting segments (Brush / Water color / Krita) with locked UI-SPEC geometry (24px height, 72px min-width, 0px gap); Krita is greyed, disabled, and tooltipped "Coming in v2.1.0"
- One shared `activeModule` signal (`signal<'brush' | 'watercolor'>`) mounted in both Toolbar.tsx and PhysicsPaintTopBar.tsx — never a second local copy
- Panel-split shell: shared block (Color / Size / Opacity / Paper) always visible; module-only block drains per activeModule (BrushModuleSection or WatercolorModuleSection)
- PaintModeSelector stays in Brush module only (D-14); watercolour branch never shows it
- TDD: both tasks ran full RED→GREEN cycles with classifier-verified RED evidence

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: ModuleSwitcher + activeModule signal** - `4702701b` (test RED) → `bb015a60` (feat GREEN)
2. **Task 2: Panel-split shell** - `33e5cbc4` (test RED) → `6b91aacf` (feat GREEN)

## Files Created/Modified

- `app/src/components/shared/activeModule.ts` - One shared active-module signal (brush/watercolor)
- `app/src/components/shared/ModuleSwitcher.tsx` - Shared segmented control (Brush | Water color | Krita)
- `app/src/components/shared/ModuleSwitcher.test.tsx` - Behavioral tests (labels, clicks, inert Krita, shared mounts)
- `app/src/components/shared/ModuleSwitcher.test.tsx.test.ts` - Import-only launcher
- `app/src/components/physic-paint/view/WatercolorModuleSection.tsx` - Empty-tolerant shell (56-07 fills it)
- `app/src/components/physic-paint/view/BrushModuleSection.tsx` - Physics param bag + PaintModeSelector
- `app/src/components/physic-paint/view/panelSplitShell.test.tsx` - Panel-split behavior tests
- `app/src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts` - Import-only launcher
- `app/src/components/layout/Toolbar.tsx` - Mounts ModuleSwitcher
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` - Mounts ModuleSwitcher
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` - Shared/module split structure
- `app/src/components/physic-paint/physicsPaintStudio.css` - ModuleSwitcher geometry (24px/72px/0px gap)

## Decisions Made

- Krita inert slot uses both `disabled` attribute and a no-op `onClick` — disabled blocks real browser clicks, the no-op handler satisfies the click-does-nothing contract in tests
- Shared block section labels are structural; Paper is a labelled placeholder row (picker lands in 56-05 per plan)
- SmoothingButton was moved from PhysicsPaintRightPanel into BrushModuleSection (it was only used by the physics param bag)

## Deviations from Plan

None — plan executed as written.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Paper picker placeholder row ("—") | PhysicsPaintRightPanel.tsx | shared block | Intentional per plan: "picker lands in 56-05, placeholder row is fine" |
| WatercolorModuleSection empty body | WatercolorModuleSection.tsx | entire component | Intentional per plan: "body lands in 56-07" |

Both stubs are documented plan placeholders, not accidental gaps. The shell must tolerate a missing module body (MOD-02 flagged assumption).

## Issues Encountered

- Vitest TAP reporter produced YAML diagnostics too large for the RED classifier's TAP parser (the Toolbar source dump in the assertion diff). Switched to JUnit XML reporter which parsed cleanly. No code impact.

## TDD Gate Compliance

| Plan | RED | GREEN | REFACTOR | Status |
|------|-----|-------|----------|--------|
| 56-02 Task 1 | `4702701b` (RED_EVIDENCE_OK) | `bb015a60` | — | compliant |
| 56-02 Task 2 | `33e5cbc4` (RED_EVIDENCE_OK) | `6b91aacf` | — | compliant |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `activeModule` signal is ready for 56-03..56-07 to read (aquarelle panels, brush panels drain against it)
- WatercolorModuleSection is the empty shell 56-07 fills with the aquarelle body
- BrushModuleSection contains the extracted physics param bag; further Brush module work extends it
- Krita slot is inert; no implementation work until v2.1.0

---
*Phase: 56-efx-watercolor-engine-2-paint-aquarelle-clean-room*
*Completed: 2026-10-15*

## Self-Check: PASSED

All 8 created files found. All 4 task commits present in history.
