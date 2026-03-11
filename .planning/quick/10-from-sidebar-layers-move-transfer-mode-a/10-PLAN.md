---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/layer/LayerList.tsx
  - Application/src/components/layout/PropertiesPanel.tsx
autonomous: true
requirements: [QUICK-10]
must_haves:
  truths:
    - "Content layer sidebar rows show only name, type, visibility, drag handle, delete -- no blend or opacity controls"
    - "Bottom bar shows Blend mode + Opacity + Transform + Crop when a content layer is selected"
    - "Base layer still cannot change blend mode (locked Normal) but opacity slider appears in bottom bar"
    - "FX layer bottom bar unchanged (opacity + visibility + FX-specific controls)"
  artifacts:
    - path: "Application/src/components/layer/LayerList.tsx"
      provides: "Simplified layer rows without blend/opacity inline controls"
    - path: "Application/src/components/layout/PropertiesPanel.tsx"
      provides: "Blend mode + Opacity section in bottom bar for content layers"
  key_links:
    - from: "Application/src/components/layout/PropertiesPanel.tsx"
      to: "layerStore.updateLayer"
      via: "blend mode and opacity change handlers"
      pattern: "updateLayer.*blendMode|opacity"
---

<objective>
Move blend mode (transfer mode) and opacity controls from the LAYERS sidebar inline rows to the bottom properties bar. Content layer sidebar rows become compact (name + type + visibility only). When a content layer is selected, the bottom bar shows: BLEND | OPACITY | TRANSFORM | CROP.

Purpose: Declutter sidebar layer rows and consolidate all property editing in the bottom bar for consistency with the transform/crop controls already there.
Output: Simplified LayerList.tsx rows, enriched PropertiesPanel.tsx bottom bar for content layers.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/layer/LayerList.tsx
@Application/src/components/layout/PropertiesPanel.tsx
@Application/src/types/layer.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove blend mode and opacity from LayerList sidebar rows</name>
  <files>Application/src/components/layer/LayerList.tsx</files>
  <action>
In LayerList.tsx, simplify the LayerRow component:

1. Remove the entire "Row 2" section (lines 209-248) which contains the blend mode dropdown and opacity slider for all layers. This includes:
   - The `handleBlendChange` function
   - The `handleOpacityInput` function
   - The `opacityPercent` calculation
   - The `startCoalescing`/`stopCoalescing` imports (check if used elsewhere in file first -- they are NOT used elsewhere so remove)
   - The `BlendMode` type import (no longer needed in this file)
   - The `BLEND_MODES` constant array at the top
   - The `capitalize` helper function

2. Reduce the fixed height of each LayerRow from `h-[60px]` to `h-[36px]` since Row 2 is gone. The row now only contains the single line: drag handle, visibility, color indicator, name, delete.

3. Keep everything else: SortableJS integration, selection, visibility toggle, delete, drag handle, type indicator, name label, base layer lock icon.
  </action>
  <verify>Run `cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30` -- no errors in LayerList.tsx</verify>
  <done>Layer sidebar rows are single-line compact rows with no blend/opacity controls. No TypeScript errors.</done>
</task>

<task type="auto">
  <name>Task 2: Add blend mode and opacity to bottom bar for content layers</name>
  <files>Application/src/components/layout/PropertiesPanel.tsx</files>
  <action>
In PropertiesPanel.tsx, add a BLEND + OPACITY section to the content layer (non-FX) bottom bar:

1. Add at the top of the file (alongside existing imports):
   - Import `BlendMode` type from `../../types/layer`
   - Add `const BLEND_MODES: BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];` (same as was in LayerList)

2. In the non-FX return block (the one that currently shows Transform + Crop, around line 555), add a BLEND + OPACITY section BEFORE the Transform section. The layout becomes:

   BLEND dropdown | OPACITY slider | divider | TRANSFORM | divider | CROP | source info

3. The BLEND + OPACITY section implementation:

   For the base layer (`selectedLayer.isBase`):
   - Show "BLEND" SectionLabel followed by locked "Normal" text (no dropdown)
   - Show "OPACITY" SectionLabel followed by a range slider (0-100) + percentage text
   - Opacity slider uses `startCoalescing`/`stopCoalescing` on pointer down/up
   - Opacity change calls `layerStore.updateLayer(selectedLayer.id, { opacity: val / 100 })`

   For non-base content layers:
   - Show "BLEND" SectionLabel followed by a `<select>` dropdown with BLEND_MODES, value = `selectedLayer.blendMode`
   - On change: `layerStore.updateLayer(selectedLayer.id, { blendMode: value as BlendMode })`
   - Show "OPACITY" SectionLabel followed by a range slider (0-100) + percentage text
   - Same coalescing pattern for opacity slider

   Style the blend dropdown: `text-[11px] bg-[var(--color-bg-input)] text-[#CCCCCC] rounded px-2 py-[3px] outline-none cursor-pointer`
   Style the opacity slider: `w-20 h-1 accent-[var(--color-accent)] cursor-pointer` (same as FX opacity slider pattern)
   Style the opacity value text: `text-[11px] text-[#CCCCCC] w-8 text-right`

   Wrap blend + opacity together in: `<div class="flex items-center gap-3 shrink-0">...</div>`
   Add a vertical divider (`<div class="w-px h-8 bg-[#2A2A2A]" />`) between the blend/opacity section and the Transform section.

4. The `capitalize` helper already exists in PropertiesPanel.tsx -- reuse it for blend mode option labels.
  </action>
  <verify>Run `cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30` -- no errors. Then run `npm run build 2>&1 | tail -5` to verify successful build.</verify>
  <done>Bottom bar for content layers shows BLEND + OPACITY + TRANSFORM + CROP. Base layer shows locked Normal text with opacity slider. FX bottom bar is unchanged.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `cd Application && npx tsc --noEmit`
2. Build succeeds: `cd Application && npm run build`
3. Visual check: LAYERS sidebar rows are compact (single-line, no blend/opacity)
4. Visual check: Select a content layer -> bottom bar shows blend dropdown + opacity slider + transform + crop
5. Visual check: Select base layer -> bottom bar shows locked "Normal" + opacity slider + transform + crop
6. Visual check: Select FX layer -> bottom bar shows opacity + visibility + FX controls (unchanged)
</verification>

<success_criteria>
- Blend mode dropdown and opacity slider removed from all LAYERS sidebar rows
- Layer rows reduced to compact single-line height
- Content layer bottom bar shows: BLEND | OPACITY | TRANSFORM | CROP
- Base layer bottom bar shows: Normal (locked) | OPACITY | TRANSFORM | CROP
- FX layer bottom bar unchanged
- No TypeScript errors, build succeeds
</success_criteria>

<output>
After completion, create `.planning/quick/10-from-sidebar-layers-move-transfer-mode-a/10-SUMMARY.md`
</output>
