---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/layout/PropertiesPanel.tsx
  - Application/src/components/layer/LayerList.tsx
autonomous: true
requirements: [QUICK-7]
must_haves:
  truths:
    - "FX layer selected in bottom bar shows opacity slider and visibility toggle but NO blend mode dropdown"
    - "Base layer 'Key Photos' row in LAYERS sidebar shows NO opacity slider"
    - "Non-base content layers in sidebar still show blend mode dropdown + opacity slider"
  artifacts:
    - path: "Application/src/components/layout/PropertiesPanel.tsx"
      provides: "FX layer bottom bar without blend mode dropdown"
    - path: "Application/src/components/layer/LayerList.tsx"
      provides: "Base layer row without opacity slider"
  key_links:
    - from: "PropertiesPanel.tsx"
      to: "isFxLayer check"
      via: "FX branch renders opacity+visibility only (no BlendSection)"
      pattern: "isFxLayer.*opacity"
---

<objective>
Remove blend mode dropdown from the bottom bar for FX layers (they don't need blend mode controls) and remove the opacity slider from the base layer "Key Photos" row in the LAYERS sidebar (it's locked to 100% and not needed).

Purpose: Clean up the UI by removing controls that are not meaningful for specific layer types.
Output: Two modified component files with cleaner conditional rendering.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/layout/PropertiesPanel.tsx
@Application/src/components/layer/LayerList.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove blend mode from FX bottom bar and opacity from base layer sidebar</name>
  <files>Application/src/components/layout/PropertiesPanel.tsx, Application/src/components/layer/LayerList.tsx</files>
  <action>
In PropertiesPanel.tsx, modify the FX layer branch (lines 568-577):
- Replace `<BlendSection layer={selectedLayer} fxSequenceId={fxSequenceId} />` with an inline opacity slider + visibility toggle (no blend mode dropdown).
- Keep the FxSection and divider after it.
- The inline opacity section should match BlendSection's styling but only include:
  - SectionLabel text="OPACITY" (or similar, no "BLEND" label)
  - Opacity slider (range 0-100, same styling as BlendSection's opacity slider)
  - Opacity percentage text
  - Visibility toggle button (same eye icon pattern as BlendSection, using fxSequenceId for FX sequence visibility)
- Do NOT render the blend mode `<select>` dropdown for FX layers.

In LayerList.tsx, modify the LayerRow component's Row 2 section (lines 209-245):
- For the base layer (`isBase === true`), remove the entire opacity slider section. Only show the locked "Normal" text.
- The base layer Row 2 should contain just: the locked "Normal" text (existing span on line 226) -- no "Op" label, no range input, no percentage text.
- Non-base layers keep their existing blend mode dropdown + opacity slider unchanged.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>FX layers in the bottom bar show opacity+visibility controls but no blend mode dropdown. Base layer row in LAYERS sidebar shows only locked "Normal" text with no opacity slider. Non-base content layers unchanged.</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- Select an FX layer: bottom bar shows FX-specific controls + opacity slider + visibility toggle, but NO blend mode dropdown
- Select a content layer: bottom bar shows Transform + Crop (unchanged)
- LAYERS sidebar: base "Key Photos" row shows locked "Normal" text only, no opacity slider
- LAYERS sidebar: non-base content layers still show blend mode dropdown + opacity slider
</verification>

<success_criteria>
- FX layer bottom bar: no blend mode dropdown, opacity and visibility controls present
- Base layer sidebar row: no opacity slider, just locked "Normal" label
- All other layer behaviors unchanged
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/7-remove-blend-mode-from-bottom-bar-for-fx/7-SUMMARY.md`
</output>
