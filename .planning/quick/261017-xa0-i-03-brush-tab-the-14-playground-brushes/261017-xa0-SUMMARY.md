---
phase: quick-261017-xa0
plan: 261017-xa0
subsystem: ui
tags: [preact, physic-paint, watercolor, aquarelle, brush-tab, playground-presets, stroke-thumb, cache]

requires:
  - phase: 56
    provides: aquarelleRecordState tip seam, BrushResponsePanel (I-02), buildBrushForStroke record path, BRUSH_PRESETS playground catalog
provides:
  - Brush tab (watercolor) is the 14-card BRUSH_PRESETS grid with painted stroke thumbs
  - Tip seam accepts playground preset ids and forces the Brush tool on pick
  - Paint-once stroke-thumb cache (HTMLCanvasElement per preset id, never toDataURL)
affects: [phase-55-issues I-03 I-10, physic-paint right panel Brush tab, aquarelle record path]

actuals:
  tokens: 8518
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Spyable paint seam (`strokeThumbPainter.drawStroke` object) so a pin can count painter invocations without patching module internals"
    - "Module-level HTMLCanvasElement cache keyed by preset id: render-body cache fill is a Map hit after first paint (decode-once discipline, 52.1 D-19)"

key-files:
  created:
    - app/src/components/physic-paint/view/watercolorStrokeThumb.ts
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
    - app/src/components/physic-paint/view/aquarellePresetSelection.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
    - app/src/components/physic-paint/view/panelSplitShell.test.tsx

key-decisions:
  - "selectAquarelleTip resolves findTip first (wc/* unchanged), else BRUSH_PRESETS; a preset hit keeps the id and loads NEUTRAL_TOOL_OVERRIDES (presets own shape via buildBrush; multipliers stay a separate bag)"
  - "Any successful non-null pick calls setAquarelleTool('brush') before the compare-then-write return, so re-picking the already-selected id still flips Water/Pen/Lift back to Brush"
  - "Thumb painter ported app-side into watercolorStrokeThumb.ts (oracle SPECS/.../preview.ts is read-only; no package surface, no package rebuild)"
  - "One shared representative pigment hex (STROKE_THUMB_HEX) for every thumb — thumbs show brush shape, not per-pigment color"

patterns-established:
  - "Brush-tool variant picks are selection + force-Brush: never a second engine.setBrush call site (AquarelleCanvasLayer owns that seam)"

requirements-completed: [I-03]

coverage:
  - id: I-03
    description: "Brush tab (watercolor) is the 2-column 14-card BRUSH_PRESETS grid with drawn stroke thumbs, name, and hint; picking a card selects the preset and forces the Brush tool"
    requirement: I-03
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePresetSelection.test.ts#every BRUSH_PRESETS id selects without clearing selection"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePresetSelection.test.ts#buildBrushForStroke(id) matches buildBrush(preset) on the vendor Brush fields"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/aquarellePresetSelection.test.ts#a preset pick issued while water / pen / lift is active flips the tool to brush"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#renders exactly 14 cards in BRUSH_PRESETS catalog order"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts#paints each preset thumb at most once across two mounts"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/panelSplitShell.test.tsx#mounts WatercolorBrushLibrary then BrushResponsePanel (I-03 mount swap)"
        status: pass
    human_judgment: true
    rationale: "Card layout, thumb look, and tool-flip must be judged live in the Studio"

plan_head_before: 8cb403fbf97cfbbec2a2782aed79a4c3b697b080
plan_head_after: 195264ee560025043269b6554805eb437e1f94f0

duration: 17min
completed: 2026-10-17
status: complete
---

# Phase Quick 261017-xa0: I-03 Brush tab = the 14 playground brushes Summary

One-liner: Brush tab becomes a 14-card BRUSH_PRESETS grid with paint-once stroke thumbs; picking a card selects the preset id and forces the aquarelle tool back to Brush.

## Accomplishments

- **Task 1 (b0608e7b)** — I-03 seam: `selectAquarelleTip` now accepts the 14 bare `BRUSH_PRESETS` ids (was silently clearing them), loads `NEUTRAL_TOOL_OVERRIDES` on a preset hit, and forces `aquarelleActiveTool` to `brush` on any successful non-null pick. All 14 ids round-trip through `snapshotAquarelleRecord().brushId` / `buildAquarelleStrokePayload().brushId` and resolve through `buildBrushForStroke` to the same vendor Brush as `buildBrush(preset)`. Legacy `wc/*` tips and the null-clear path unchanged. D-20 traceSeed / record-store write path untouched.
- **Task 2 (195264ee)** — I-03 library: `WatercolorBrushLibrary` renders exactly 14 cards (2-column grid, catalog order) each with a 150x44 painted stroke thumb + name + hint. `watercolorStrokeThumb.ts` is a direct port of the oracle `drawStroke` (`SPECS/.../preview.ts`) with a module-level `HTMLCanvasElement` cache keyed by preset id — paint once, blit on later mounts, never `toDataURL`/`toBlob`. Brush-tab watercolor arm now mounts `WatercolorBrushLibrary` then `BrushResponsePanel`; `BrushesDocker` is unmounted (file stays on disk for I-10).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing pin] panelSplitShell had no Brush-tab arm pin to rewrite**
- **Found during:** Task 2
- **Issue:** The plan asked to rewrite any `panelSplitShell.test.tsx` pin naming the old picker in the Brush-tab arm. No such pin existed (only the Paint-tab "picker leaves the Paint-tab section" negative pin).
- **Fix:** Added a Brush-tab arm pin asserting `WatercolorBrushLibrary` before `BrushResponsePanel`, `<BrushesDocker` absent from that arm, and `BrushesDocker.tsx` still on disk. The existing Paint-tab pin stays as-is.
- **Files modified:** `app/src/components/physic-paint/view/panelSplitShell.test.tsx`
- **Commit:** 195264ee

## Known Stubs

None.

## Threat Flags

None beyond the plan's register — T-261017-XA0-01 (preset-id seam) and T-261017-XA0-02 (thumb toDataURL ban) are pinned by the new suites; T-261017-XA0-03 (mount swap) is pinned by the library suite + the new panelSplitShell Brush-tab pin.

## Live UAT Checklist (user-run)

1. Open Water color → Brush tab: 2-column grid of the 14 playground brushes (Round, Detail, Rigger, Flat, Hake, Filbert, Mop, Dry Brush, Fan, Sponge, Spatter, Sumi, Dagger, Stipple) with stroke thumbs and hints. No texture group, no size-variant rows, no Import control, no search.
2. Switch the tool to Water (or Pen/Lift), then click ROUND and Flat → the tool rail is back on Brush and the stroke uses that preset.
3. Click a card, then open Brush response → placeholder is gone and the 8 multipliers edit that preset; clear/reset selection → placeholder returns.
4. Paint with two different presets, apply, replay → the baked strokes match the picked presets (brushId round-trip).

## Self-Check: PASSED

- FOUND: app/src/components/physic-paint/view/aquarelleRecordState.ts
- FOUND: app/src/components/physic-paint/view/aquarellePresetSelection.test.ts
- FOUND: app/src/components/physic-paint/view/watercolorStrokeThumb.ts
- FOUND: app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
- FOUND: app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
- FOUND: app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
- FOUND: app/src/components/physic-paint/view/panelSplitShell.test.tsx
- FOUND: b0608e7b (Task 1 seam commit)
- FOUND: 195264ee (Task 2 library commit)
