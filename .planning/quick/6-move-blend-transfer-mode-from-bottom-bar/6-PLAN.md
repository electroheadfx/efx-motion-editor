---
phase: quick-6
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/layer/LayerList.tsx
  - Application/src/components/layout/PropertiesPanel.tsx
autonomous: true
requirements: [QUICK-6]
must_haves:
  truths:
    - "Content layer rows in the LAYERS sidebar show blend mode dropdown and opacity slider inline"
    - "Selecting a content layer in the sidebar does NOT show blend/opacity in the bottom properties bar"
    - "Selecting an FX layer from timeline shows blend mode + opacity + FX controls in the bottom properties bar"
    - "Blend mode and opacity changes from the sidebar immediately affect preview rendering"
  artifacts:
    - path: "Application/src/components/layer/LayerList.tsx"
      provides: "Inline blend mode + opacity controls per content layer row"
    - path: "Application/src/components/layout/PropertiesPanel.tsx"
      provides: "FX-only blend/opacity in bottom bar, content layers show transform+crop only"
  key_links:
    - from: "LayerList.tsx"
      to: "layerStore.updateLayer"
      via: "blendMode and opacity onChange handlers"
      pattern: "layerStore\\.updateLayer.*blendMode|opacity"
---

<objective>
Move blend mode dropdown and opacity slider from the bottom PropertiesPanel into the LAYERS sidebar (LayerList) for content layers. Content layers (static-image, image-sequence, video) will show blend mode and opacity inline in each LayerRow. The bottom PropertiesPanel will only show blend/opacity when an FX layer is selected from the timeline. For content layers, the bottom bar shows only Transform + Crop sections (no Blend).

Purpose: Blend mode and opacity are layer-level concerns that belong in the LAYERS panel alongside visibility. The bottom bar should focus on FX-specific controls when FX layers are selected.
Output: Updated LayerList.tsx with inline blend/opacity per row, updated PropertiesPanel.tsx with conditional blend section.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/layer/LayerList.tsx
@Application/src/components/layout/PropertiesPanel.tsx
@Application/src/stores/layerStore.ts
@Application/src/types/layer.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add inline blend mode and opacity controls to LayerRow in LayerList</name>
  <files>Application/src/components/layer/LayerList.tsx</files>
  <action>
Expand each LayerRow in LayerList.tsx to include blend mode and opacity controls below the layer name/metadata line. The row height should grow from h-11 to accommodate an extra row of controls.

For each non-base content layer row, add a second line below the name/type text containing:
1. A compact blend mode `<select>` dropdown (same values as BLEND_MODES: normal, screen, multiply, overlay, add) -- styled with `text-[9px]` compact styling matching the panel aesthetic
2. An opacity slider (`<input type="range">`) with percentage label

Import needed: `layerStore.updateLayer` is already available via `layerStore` import. Add imports for `startCoalescing` and `stopCoalescing` from `../../lib/history` for opacity slider coalescing. Import `BlendMode` type from `../../types/layer`.

Layout for each LayerRow (non-base):
```
[ drag | vis | color | Name                    | x ]
[                    | Blend: [Normal v] Op: [====] 75% ]
```

For base layer: show only the opacity slider (blend mode stays "normal" and locked).

The blend mode onChange calls `layerStore.updateLayer(layer.id, { blendMode: value as BlendMode })`.
The opacity slider onInput calls `layerStore.updateLayer(layer.id, { opacity: val / 100 })`.
Use `onPointerDown={() => startCoalescing()}` and `onPointerUp={() => stopCoalescing()}` on the opacity slider for undo coalescing (same pattern as PropertiesPanel's BlendSection).

Remove the existing `blendLabel` text from the metadata line (the `typeLabel . BlendLabel` line) since blend mode now has its own dropdown. Keep just the typeLabel and "Locked" indicator for base.

The row height should change from `h-11` to `h-[60px]` to accommodate the two-line layout. The inner content should use `flex flex-col` for the two rows.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Each content layer row in the LAYERS sidebar shows an inline blend mode dropdown and opacity slider. Changing blend mode or opacity from the sidebar updates the layer and triggers preview re-render.</done>
</task>

<task type="auto">
  <name>Task 2: Remove BlendSection from content layers in PropertiesPanel, keep for FX only</name>
  <files>Application/src/components/layout/PropertiesPanel.tsx</files>
  <action>
Modify the PropertiesPanel component so that the BlendSection is ONLY rendered for FX layers, not for content layers.

In the non-FX branch (line ~579-602), remove the `<BlendSection layer={selectedLayer} />` and its trailing divider. The non-FX (content layer) panel should show only:
- TRANSFORM section
- divider
- CROP section
- Source info (if applicable)

The FX layer branch (line ~569-576) remains unchanged -- it still shows `<BlendSection>` + divider + `<FxSection>` for FX layers.

Also update the empty-state message: change "Select a layer to edit properties" to "Select a layer to edit transform" since blend/opacity has moved to the sidebar for content layers.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Bottom properties bar no longer shows blend/opacity for content layers. FX layers still show blend + opacity + FX controls in the bottom bar. Content layers show only Transform + Crop in the bottom bar.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors
2. Select a content layer in the LAYERS sidebar -- blend mode dropdown and opacity slider appear inline in the row
3. Bottom bar shows only Transform + Crop for the selected content layer (no Blend section)
4. Select an FX layer from timeline -- bottom bar shows Blend + Opacity + FX controls
5. Changing blend mode or opacity from the sidebar immediately updates the preview
</verification>

<success_criteria>
- Content layer blend mode and opacity are editable from the LAYERS sidebar
- Bottom properties bar shows only Transform + Crop for content layers
- Bottom properties bar shows Blend + Opacity + FX controls for FX layers
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/6-move-blend-transfer-mode-from-bottom-bar/6-SUMMARY.md`
</output>
