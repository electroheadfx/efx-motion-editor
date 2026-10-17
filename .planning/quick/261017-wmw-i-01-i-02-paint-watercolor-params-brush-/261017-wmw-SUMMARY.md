---
phase: quick-261017-wmw
plan: 261017-wmw
subsystem: ui
tags: [preact, signals, watercolor, aquarelle, physic-paint, panel-split, playground-labels]

# Dependency graph
requires:
  - phase: quick-261017-w4x
    provides: "Paint tab settings-only shell (I-05/I-06) — WatercolorModuleSection with SectionLabel + params + BrushesDocker"
provides:
  - "Paint tab watercolor = SectionLabel + 7 playground-ordered globals + Reset (AquarelleGlobalsPanel)"
  - "Brush tab watercolor = BrushesDocker + BrushResponsePanel (8 multipliers + effective readout + placeholder)"
  - "AquarelleParamsPanel.tsx deleted — one file per visual unit"
affects: [phase-55-issues, I-10-adoption, physic-paint-view]

actuals:
  tokens: 10578
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "One file per visual unit (globals panel / response panel), no wrapper re-export"
    - "Reset derives write values from playground DEFAULT_PARAMS ×100 — playground stays the oracle"

key-files:
  created:
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx
    - app/src/components/physic-paint/view/BrushResponsePanel.tsx
    - app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts
    - app/src/components/physic-paint/view/BrushResponsePanel.test.ts
  modified:
    - app/src/components/physic-paint/view/WatercolorModuleSection.tsx
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/RightPanelBrushTab.tsx
    - app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx
    - app/src/components/physic-paint/view/panelSplitShell.test.tsx
    - app/src/components/physic-paint/view/AquarelleToolRow.test.tsx
  deleted:
    - app/src/components/physic-paint/view/AquarelleParamsPanel.tsx

key-decisions:
  - "Reset derives its 7 write values from DEFAULT_PARAMS (imported from @efxlab/efx-watercolor) scaled ×100, not a second hardcoded table — the playground remains the oracle"
  - "Reset iterates GLOBAL_ROWS only, so size is structurally unreachable from the handler (T-261017-WMW-01)"
  - "AquarelleParamsPanel.test.tsx keeps its filename but retargets at AquarelleGlobalsPanel — the launcher path stays valid for the plan's verify command"

patterns-established:
  - "Playground DEFAULT_PARAMS as single source for Reset defaults (no duplicated default bag)"

requirements-completed: [I-01, I-02]

coverage:
  - id: I-01
    description: "Paint tab watercolor globals: playground labels/order (Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed) + Reset restoring DEFAULT_PARAMS ×100 for the 7 non-size keys"
    requirement: "I-01"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/AquarelleToolRow.test.tsx.test.ts"
        status: pass
    human_judgment: true
    rationale: "Live stroke response to the renamed keys (load/edge/granulation/dry) and the visible Reset jump need native UAT"
  - id: I-02
    description: "Panel split: AquarelleGlobalsPanel (Paint) + BrushResponsePanel (Brush tab next to the picker); AquarelleParamsPanel.tsx deleted"
    requirement: "I-02"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/BrushResponsePanel.test.ts"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/AquarelleParamsPanel.test.tsx.test.ts"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts"
        status: pass
    human_judgment: true
    rationale: "Which tab shows which block and the per-brush response editing are visual layout judgments"

duration: 14min
completed: 2026-10-17
status: complete
---

# Quick 261017-wmw: I-01 + I-02 Paint/Brush watercolor split Summary

**Watercolor params de-duplicated: Paint tab owns the 7 playground-ordered globals + Reset, Brush tab owns the picker + per-brush response, and the old AquarelleParamsPanel wrapper is gone.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-17T21:40:46Z
- **Completed:** 2026-10-17T21:55:00Z
- **Tasks:** 2
- **Files modified:** 10 (6 modified, 2 created ×2 suites+panels, 1 deleted, renames)

## Accomplishments

- I-01: GLOBAL_ROWS rewritten to the playground SettingsPanel list minus Size/Hand — Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed — with param keys byte-identical (`water`/`load`/`flow`/`bleed`/`edge`/`granulation`/`dry`); Reset restores playground `DEFAULT_PARAMS` ×100 (60/50/45/50/50/45/40) through `setAquarelleParam` and never writes `size`.
- I-02: `AquarelleParamsPanel.tsx` split into `AquarelleGlobalsPanel.tsx` (7 sliders + Reset) and `BrushResponsePanel.tsx` (collapsible 8-multiplier block + effective readout + Select-a-brush placeholder), then deleted — no third wrapper. Brush tab mounts `BrushesDocker` + `BrushResponsePanel` (picker first).
- Pin suites rewritten to the post-split contract: 30 tests across the 4 verify targets, 1057 tests across the whole `physic-paint/view` suite green.

## Task Commits

Each task was committed atomically:

1. **Task 1: I-01 — watercolor globals single-home in Paint (playground labels + Reset)** - `36f13b30` (feat)
2. **Task 2: I-02 — split panels; Brush response single-home in the Brush tab** - `af5ce4d4` (refactor)

Plan head before: `7ef4671b` — 2 commits measured to `af5ce4d4`.

## Files Created/Modified

- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` — NEW: 7 playground-ordered sliders + Reset (`data-testid="aquarelle-globals-panel"` / `"aquarelle-params-reset"`)
- `app/src/components/physic-paint/view/BrushResponsePanel.tsx` — NEW: collapsible Brush response (8 multipliers, band 0.5–2.0, effective readout, placeholder)
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts` — NEW pins: label order, no Size/Hand, Reset ×100 defaults, size untouched
- `app/src/components/physic-paint/view/BrushResponsePanel.test.ts` — NEW pins: placeholder, toggle → 8 rows, band, effective formula
- `app/src/components/physic-paint/view/AquarelleParamsPanel.tsx` — DELETED (split into the two halves)
- `app/src/components/physic-paint/view/WatercolorModuleSection.tsx` — SectionLabel + AquarelleGlobalsPanel only
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — Brush-tab watercolor arm: BrushesDocker + BrushResponsePanel; Paint-tab arm unchanged (WatercolorModuleSection)
- `app/src/components/physic-paint/view/RightPanelBrushTab.tsx` — orphan repointed at BrushesDocker + BrushResponsePanel (compile fix only, I-10 adoption untouched)
- `app/src/components/physic-paint/view/AquarelleParamsPanel.test.tsx` — retargeted at AquarelleGlobalsPanel; record-path cases kept; response cases moved out
- `app/src/components/physic-paint/view/panelSplitShell.test.tsx` — I-06 pins rewritten to the post-split shape
- `app/src/components/physic-paint/view/AquarelleToolRow.test.tsx` — comment updated (Dry speed / AquarelleGlobalsPanel)

## Decisions Made

- **Reset derives from `DEFAULT_PARAMS` (playground oracle), not a second table.** `DEFAULT_PARAMS` is imported from `@efxlab/efx-watercolor` and scaled ×100 onto the app 0–100 band; Reset iterates `GLOBAL_ROWS` so `size` is structurally unreachable from the handler (T-261017-WMW-01).
- **`AquarelleParamsPanel.test.tsx` keeps its filename** but imports `AquarelleGlobalsPanel` — the plan's verify command path stays valid and the launcher (`AquarelleParamsPanel.test.tsx.test.ts`) is untouched.

## Deviations from Plan

None — plan executed exactly as written.

## Live UAT checklist (user-run, one by one)

### Task 1 (I-01) — commit `36f13b30`

1. Open Water color → Paint tab: top-to-bottom **Water color** label, then **Water / Pigment / Flow / Bleed / Edges / Grain / Dry speed**, then **Reset**. No Size row, no Hand row, no brush list, no BRUSH RESPONSE block.
2. Move **Pigment / Edges / Grain / Dry speed** → the stroke responds (keys `load`/`edge`/`granulation`/`dry` still drive the engine).
3. Click **Reset** → the 7 sliders jump to 60 / 50 / 45 / 50 / 50 / 45 / 40 and the top-bar Brush size does **not** move.
4. Brush tab still shows the brush picker (response block arrives with Task 2).

### Task 2 (I-02) — commit `af5ce4d4`

1. Open the Brush tab: brush picker on top, **Brush response** under it.
2. With no brush selected the placeholder **Select a brush to edit response** shows.
3. Select a brush, open the response → 8 multipliers (Tip, Aspect, Rotation, SizeCurve, Scatter, Capacity, Grain, Wet round) with effective values; editing them edits that brush.
4. Paint tab never shows the response block; Brush tab never shows the 7 global sliders. Console clean.

## Threat Flags

None — no new trust-boundary surface. Reset writes only through the existing `setAquarelleParam` seam; threat T-261017-WMW-01 (size clobber) is pinned by test (`size` unchanged after Reset).

## Known Stubs

None.

## Deferred Issues

- Pre-existing `tsc --noEmit` errors in unrelated files (`AquarelleCanvasLayer.tsx`, `projectPaperRaster.test.ts`, `PaperPicker.tsx`, `physicsPaintRotoPlayScriptController.ts`, …) — identical before and after this quick; out of scope, not touched.

## Guardrail audit

- `git diff SPECS/` empty
- `git diff app/src/components/physic-paint/view/PhysicsPaintToolRail.tsx` empty
- `git diff app/package.json app/vitest.config.ts` empty
- `git diff packages/efx-watercolor/src/playground/` empty
- `aquarelleRecordState.ts` untouched (multiplier exports unchanged)
- No new dependencies

## Self-Check: PASSED

- FOUND: `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx`
- FOUND: `app/src/components/physic-paint/view/BrushResponsePanel.tsx`
- FOUND: `app/src/components/physic-paint/view/AquarelleGlobalsPanel.test.ts`
- FOUND: `app/src/components/physic-paint/view/BrushResponsePanel.test.ts`
- MISSING (expected): `app/src/components/physic-paint/view/AquarelleParamsPanel.tsx` — deleted per plan
- FOUND: `36f13b30` (ancestor of HEAD)
- FOUND: `af5ce4d4` (ancestor of HEAD)
