---
phase: quick-261018-ias
plan: 261018-ias
type: execute
wave: 1
depends_on: []
files_modified:
  - app/src/components/physic-paint/view/PaperPicker.tsx
  - app/src/components/physic-paint/view/PaperPicker.test.tsx.test.ts
  - app/src/components/physic-paint/view/RightPanelPaperTab.tsx
  - app/src/components/physic-paint/physicsPaintStudio.css
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  - app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts
  - app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx
  - app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
autonomous: true
requirements:
  - UAT-4R-A1
  - UAT-4R-A2

must_haves:
  truths:
    - "Paper tab shows a continuous slider labeled 'Texture' under Grain scale (oracle PaperPanel Texture control, 0..1)."
    - "The Texture slider writes through the existing grainStrength seam (setPaperStrength + setRotoBackgroundMetadata + setBackgroundFallback) — no second paper-strength store."
    - "Brush + Paper tab panels use padding 0px 14px 14px; Color and other tabs keep 20px 14px 14px (single-tab-panel top 10px)."
    - "CSS values match the UAT list literally (cell #c4c4c4 / name #3d3d3d, gaps 11px / 15px / 10px / 7px, topbar slider min-width 140px, module-switcher margin-right 15px, tool-rail buttons 35px)."
    - "Onion frames + Onion Value share one 2-column row."
  artifacts:
    - app/src/components/physic-paint/view/PaperPicker.tsx
    - app/src/components/physic-paint/physicsPaintStudio.css
    - app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx
    - app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx
  key_links:
    - "Oracle Texture slider lives at SPECS/v1.1.0-water-color/watercolor-playground/src/components/PaperPanel.tsx — read only, never edit SPECS/."
    - "grainStrength is the oracle paperTexture seam (aquarelleBake: 'grainStrength feeds the engine's paperTexture setter'); gqo locked no second paper-strength store."
    - "Existing write-through idiom is handleGrainStrengthChange in PhysicsPaintStudio.tsx — Texture rides it."
---

<objective>
Fourth UAT round on the watercolor/brush Studio UI. Two directed areas, one atomic commit each so the user can UAT independently.

1. **AREA 1 — missing Texture slider (asked twice, top priority).** Port the oracle's PaperPanel `Texture` slider app-side, under Grain scale in the Paper tab.
2. **AREA 2 — CSS adjustments.** Apply the user's exact class/value list literally (15 items).

Purpose: match the UAT screenshots without reopening I-01..I-10 / PAPER-01..04 contracts. Ride existing machinery. No new dependencies. No SPECS/ edits.

**Oracle finding (AREA 1 investigation, locked for the executor):**
- `SPECS/v1.1.0-water-color/watercolor-playground/src/components/PaperPanel.tsx` exposes exactly ONE paper-look slider: `<Slider label="Texture" title="How strongly the paper's tooth, fibres and flecks show. Saved images use the same strength." value={app.paperLook.value.texture} ... />`.
- Range 0..1, step 0.01 (oracle `Slider` defaults), factory default 1 (`store.ts` `paperLook = persisted(..., { texture: 1 }, ...)`).
- Drives `engine.paperTexture` (getter/setter alias of `paperStrength`, 0..1) → `uTexture` uniform in `paperUniforms`.
- There is NO second paper-look strength param in the oracle. `SettingsPanel` "Grain" is brush `granulation` (pigment settling) — a brush param, not a paper tab param. `papers.ts` `bump`/`mottle` are per-preset constants, not user sliders.
- App-side `grainStrength` IS this param: `packages/efx-watercolor/src/bake/aquarelleBake.ts` documents "grainStrength feeds the engine's paperTexture setter". Round 261018-gqo already locked "Do NOT add a second paper-strength store. grainStrength -> engine.paperTexture is the Texture control."
- Therefore the missing control is the oracle's continuous "Texture" slider (label + 0..1 range + tooltip). The current "Grain strength" segmented row is a preset UI for the same `grainStrength` value and stays. No new settings field, no metadata schema change.

Scope fence (locked):
- Do NOT edit `SPECS/`. Oracle is read-only. Port app-side only.
- Do NOT add a second paper-strength store or a new metadata field. Texture writes the existing `grainStrength` seam.
- Do NOT change `physicsPaintStudioSettings.ts` factory defaults (`grainStrength: 0.35`, `grainScale: 1`).
- Do NOT tick rows in `phase-55-issues/index.md`.
- Preact + `@preact/signals`. No NEW `useState`. Narrow signal reads; selection in click handlers (never `useEffect`); store setters stay compare-then-write. Consult `efx-preact-reactivity` before any component edit.
- `physicPaintStore.ts` must contain ZERO `getImageData|putImageData` (frameGuard).
- No new dependencies (viteBuild 2 MO ceiling). Local commits only, never push.
- Tests `.test.ts` only (`pnpm vitest run`, never watch).

</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@SPECS/v1.1.0-water-color/watercolor-playground/src/components/PaperPanel.tsx
@SPECS/v1.1.0-water-color/watercolor-playground/src/ui/Slider.tsx
@SPECS/v1.1.0-water-color/watercolor-playground/src/app/store.ts
@app/src/components/physic-paint/view/PaperPicker.tsx
@app/src/components/physic-paint/view/RightPanelPaperTab.tsx
@app/src/components/physic-paint/engine/physicsPaintStudioSettings.ts
@app/src/components/physic-paint/physicsPaintStudio.css
</context>

<tasks>

<task type="auto">
  <name>Task 1 (AREA 1): Texture slider under Grain scale</name>
  <files>app/src/components/physic-paint/view/PaperPicker.tsx, app/src/components/physic-paint/view/RightPanelPaperTab.tsx, app/src/components/physic-paint/view/PaperPicker.test.tsx.test.ts</files>
  <action>
One atomic commit (AREA 1).

Port the oracle PaperPanel `Texture` slider into the Paper tab, UNDER the existing Grain scale slider, same row styling as the grain sliders.

**Oracle control to port** (read `SPECS/v1.1.0-water-color/watercolor-playground/src/components/PaperPanel.tsx`):
- Label: `Texture`
- Tooltip / title: `How strongly the paper's tooth, fibres and flecks show. Saved images use the same strength.`
- Range: min 0, max 1, step 0.01 (oracle `Slider` defaults)
- Value: `paperLook.texture` → `engine.paperTexture` (0..1)

**Implementation:**
1. In `PaperPicker.tsx`, inside the existing `.paper-picker-grain` block and AFTER the `SliderStepper` labeled `Grain scale`, add a `SliderStepper` labeled `Texture`:
   - `label="Texture"`, `ariaLabel="Texture"`
   - `value={props.grainStrength}` (the existing paperTexture seam — do NOT invent a new prop/field)
   - `min={0}`, `max={1}`, `step={0.01}`, `freeEntry`
   - `onChange={props.onGrainStrengthChange}` (same write-through as the segmented row)
   - Same row styling as the Grain scale `SliderStepper` (it already is one).
2. Keep the existing `RuleSectionHeader text="Texture"` section title, the `Grain strength` segmented row, and the `Grain scale` slider exactly as they are (names stay Grain strength + Grain scale per 261018-gqo / Q6). DOM order inside `.paper-picker-grain` becomes: Grain strength segmented → Grain scale → Texture.
3. The slider is a continuous view over the same `grainStrength` value the segmented presets write (nearest-match display already handled by `activeGrainOptionValue`). Moving the slider to e.g. 0.5 writes `grainStrength=0.5` through `handleGrainStrengthChange` in `PhysicsPaintStudio.tsx` (setGrainStrength + physicPaintStore.setPaperStrength + setRotoBackgroundMetadata + setBackgroundFallback). Do NOT add a parallel handler, a second store field, or a metadata schema change — ride the existing idiom verbatim.
4. `RightPanelPaperTab.tsx` needs no new props (`grainStrength` / `onGrainStrengthChange` already flow through). Only touch it if the Texture slider needs a pass-through the picker does not already have.
5. Tooltip: if the shared slider row supports a `title` / description, set the oracle sentence above. If `SliderStepper` has no title slot, put the sentence in an `aria-description` / `title` on the row wrapper — do not add a new tooltip component.

**Pin test** in `PaperPicker.test.tsx.test.ts` (or `physicsPaintRightPanelPaperSingleHome.test.ts` if that is where the Paper-tab body pins live — follow the existing pin style in those files):
- Assert the Paper tab body contains a control with label `Texture` positioned after `Grain scale` in DOM order (`body.indexOf('Texture')` after the Grain scale label, and inside `data-paper-picker-grain`).
- Assert rendering the picker with `grainStrength={0.5}` and firing the Texture control's change calls `onGrainStrengthChange` with that value (writes through the existing seam).
- Keep the existing pins green: `Grain strength` / `Grain scale` names stay, grain pair stays out of the top bar, handleGrainStrengthChange write-through tokens stay.

Do NOT change: factory defaults, the segmented GRAIN_STRENGTH_OPTIONS, grainScaleStep, paperThumb, SPECS/, package.json.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/PaperPicker.test.tsx.test.ts app/src/components/physic-paint/view/paperThumb.test.ts app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts</automated>
  </verify>
  <done>
    Paper tab shows Grain strength, Grain scale, then a continuous Texture slider (0..1) under Grain scale. Texture fires onGrainStrengthChange (full write-through). Oracle label + range ported. Pin suites green. One commit: AREA 1.
  </done>
</task>

<task type="auto">
  <name>Task 2 (AREA 2): CSS adjustments — exact UAT values</name>
  <files>app/src/components/physic-paint/physicsPaintStudio.css, app/src/components/physic-paint/view/WatercolorBrushLibrary.tsx, app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts, app/src/components/physic-paint/view/RightPanelOnionMotionTabs.tsx, app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx, app/src/components/physic-paint/view/PaperPicker.tsx</files>
  <action>
One atomic commit (AREA 2). Apply the user's list literally. Override prior-round values. Do not invent extra changes.

1. `.paper-picker-cell` background → `#c4c4c4`.
   - Today the cell background is inline `var(--color-bg-input)` in `PaperPicker.tsx` `PaperCard`. Set the cell background to `#c4c4c4` (inline style or a CSS rule on `.paper-picker-cell` that wins — pick one place, not both). Active cell keeps its accent border; only the fill changes.
2. `.paper-picker-cell-name` color → `#3d3d3d`.
   - Today the name span carries inline `color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'`. Replace with `#3d3d3d` (same approach as item 1 — one source of truth).
3. gap of `paint-tab-size-opacity` and `physics-paint-segmented-row` → `11px`.
   - `.physics-paint-segmented-row` currently `gap: 4px` in `physicsPaintStudio.css`. `.paint-tab-size-opacity` is inline `gap: '6px'` in `PhysicsPaintRightPanel.tsx` (~line 437). Set both to `11px`.
4. gap of `physics-paint-module-section`, `paint-tab-size-opacity`, `physics-paint-option-group`, `physics-paint-scripts-panel`, `physics-paint-options-tab-panel physics-paint-options-tab-panel-onion physics-paint-onion-tab-panel`, `paper-picker-grain` → `15px`.
   - Current values: `.physics-paint-module-section` 10px, `.physics-paint-option-group` 10px, `.physics-paint-scripts-panel` 8px, onion panel 12px, `.paper-picker-grain` inline 6px (`PaperPicker.tsx`).
   - `paint-tab-size-opacity` appears in both item 3 and item 4. Resolve: item 3's `11px` is the control-row gap on `paint-tab-size-opacity` and `physics-paint-segmented-row`; item 4's `15px` applies to the other five selectors. If UAT wants 15px on `paint-tab-size-opacity` instead, flip that one value.
5. select element `.physics-paint-roto-interpolation-select` font-size → `12px` (class lives on the select in `RightPanelTrackTab.tsx`).
6. `.physics-paint-option-row` gap → `10px` (currently 6px).
7. Only Brush and Paper tab panels get padding `0px 14px 14px`. Color tab and other tabs keep `20px 14px 14px`.
   - Today `.physics-paint-options-tab-panel` is `padding: 20px 14px 14px`. The Brush panel (`aria-label="Brush"`) and Paper panel (`aria-label="Paper"`) in `PhysicsPaintRightPanel.tsx` get a modifier class (e.g. `physics-paint-options-tab-panel-flat`) with `padding: 0 14px 14px`. Color / Paint options / other panels unchanged.
8. All brush button borders → light gray (instead of white).
   - `WatercolorBrushLibrary.tsx` `BrushCard` button border: force light gray `#c8c8c8` on every card (unselected already `#c8c8c8`; selected is accent — make sure no state renders a white/near-white border). Selected keeps its accent background tint as the active cue. If another brush-tab button surface shows a white border (BrushesDocker / BrushModuleSection), fix that same way — but do not change non-brush chrome.
9. Onion Tab: put Onion frames and Onion Value on ONE row (2 columns) instead of two stacked rows.
   - `RightPanelOnionMotionTabs.tsx` currently has two `.physics-paint-option-row.physics-paint-onion-value-row` labels (count then opacity). Combine into one row with two columns (grid or flex): left cell = Onion frames (label + range + output), right cell = Onion Value (label + range + output). Keep both inputs' ids (`physics-onion-count`, `physics-onion-opacity`) and their clamps. Adjust `.physics-paint-onion-value-row` CSS from `grid-template-columns: 92px minmax(0, 1fr) 28px` to a 2-column layout that holds both controls (e.g. `grid-template-columns: 1fr 1fr` with each cell keeping its own label|range|output sub-grid).
10. `.physics-paint-topbar-slider` → `min-width: 140px` (currently 112px).
11. `.module-switcher` → `margin-right: 15px`.
12. `.physics-paint-single-tab-panel` → `padding-top: 10px` (currently 0). Note this is the Color / single-tab panel top padding — item 7 keeps the DEFAULT panel at 20px top for "other tabs"; this explicit class rule wins where it applies.
13. `.physics-paint-audio-clip-import` → `padding: 15px`.
14. `.physics-paint-tool-rail` gap → `7px` (currently 8px).
15. All buttons in the left sidebar tool nav `.physics-paint-tool-rail` → width `35px` and height `35px`.
    - Today `.physics-paint-icon-button` is 32px x 32px. Override to 35px x 35px for buttons inside `.physics-paint-tool-rail` (scoped selector so other icon buttons are untouched): `.physics-paint-tool-rail .physics-paint-icon-button { width: 35px; height: 35px; }`.

**Pin test** in `WatercolorBrushLibrary.test.ts` (brush border) and, if natural, a small CSS/DOM pin for the Onion one-row layout in the existing onion/panel pin suite. Keep green: `WatercolorBrushLibrary.test.ts`, `PhysicsPaintTopBar.test.ts`, `physicsPaintRightPanelPaperSingleHome.test.ts`, `physicsPaintRightPanelModuleGate.test.ts`, `panelSplitShell.test.tsx.test.ts`, `PaperPicker.test.tsx.test.ts`, `paperThumb.test.ts`.

Do NOT touch: SPECS/, package.json, physicPaintStore.ts image APIs, factory defaults, write-through handlers, phase-55-issues/index.md.
</action>
  <verify>
    <automated>pnpm --filter efx-motion-editor exec vitest run app/src/components/physic-paint/view/WatercolorBrushLibrary.test.ts app/src/components/physic-paint/view/PhysicsPaintTopBar.test.ts app/src/components/physic-paint/view/panelSplitShell.test.tsx.test.ts app/src/components/physic-paint/view/PaperPicker.test.tsx.test.ts app/src/components/physic-paint/view/physicsPaintRightPanelPaperSingleHome.test.ts app/src/components/physic-paint/view/physicsPaintRightPanelModuleGate.test.ts app/src/components/physic-paint/view/paperThumb.test.ts</automated>
  </verify>
  <done>
    All 15 CSS values match the UAT list (cell #c4c4c4, name #3d3d3d, gaps 11/15/10/7px, select 12px, Brush+Paper padding 0 14px 14px, single-tab-panel top 10px, topbar slider 140px, module-switcher +15px, audio import 15px, tool-rail 35px buttons + 7px gap, brush borders light gray, Onion frames+Value one 2-col row). Pin suites green. One commit: AREA 2.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Studio UI -> grain write-through | Texture slider clicks write the existing grainStrength seam only |
| CSS / layout | pure presentation, no data crossing |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261018-IAS-01 | Tampering | grainStrength write-through | low | mitigate | Texture rides handleGrainStrengthChange unchanged (setPaperStrength + setRotoBackgroundMetadata + setBackgroundFallback); no new store field, no metadata schema change |
| T-261018-IAS-02 | Information Disclosure | paper thumbs / brush borders | low | accept | presentation-only CSS and existing cached thumbs; no new decode or serialization path |
| T-261018-IAS-SC | Tampering | npm/pip/cargo installs | high | mitigate | no new packages this quick; package-legitimacy gate N/A (no install tasks) |
</threat_model>

<verification>
From the checkout root after both commits:

`pnpm --filter efx-motion-editor exec vitest run`

Expect at least: `PaperPicker.test.tsx.test.ts`, `paperThumb.test.ts`, `physicsPaintRightPanelPaperSingleHome.test.ts`, `physicsPaintRightPanelModuleGate.test.ts`, `WatercolorBrushLibrary.test.ts`, `PhysicsPaintTopBar.test.ts`, `panelSplitShell.test.tsx.test.ts` green.

Scope fence: no `SPECS/` diff, no package.json / lockfile diff, no `physicPaintStore.ts` getImageData/putImageData, no phase-55-issues/index.md row ticks. `physicsPaintStudioSettings.ts` defaults untouched.
</verification>

<success_criteria>
- Two commits (AREA 1 Texture slider, AREA 2 CSS) so each UAT area can be judged alone.
- Paper tab: Grain strength → Grain scale → Texture (continuous 0..1, oracle label), Texture writes through grainStrength.
- All 15 CSS values match the user's list literally.
- Onion frames + Onion Value on one 2-column row.
- Pin suites green after each commit.
</success_criteria>

<output>
Create `.planning/quick/261018-ias-fourth-uat-round-on-the-watercolor-brush/261018-ias-SUMMARY.md` when done
</output>
