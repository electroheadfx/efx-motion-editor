---
phase: quick-39
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/sidebar/SidebarFxProperties.tsx
autonomous: true
requirements: [FX-LAYOUT-01]

must_haves:
  truths:
    - "FX property fields are organized in 2-column rows, matching the Sequence properties layout"
    - "Labels and inputs are vertically aligned across all FX sections"
    - "Single-field rows (odd counts) display the field in the left column with an empty right column"
  artifacts:
    - path: "Application/src/components/sidebar/SidebarFxProperties.tsx"
      provides: "All FX section sub-components with 2-col layout"
  key_links:
    - from: "SidebarFxProperties.tsx FX sections"
      to: "NumericInput component"
      via: "flex row pairs with gap:16px matching SidebarProperties pattern"
      pattern: 'flex items-center.*gap.*16px'
---

<objective>
Reorganize all FX property sections in SidebarFxProperties.tsx to use the same 2-column layout pattern used in SidebarProperties.tsx (Sequence properties).

Purpose: Visual consistency between Sequence and FX property panels -- all NumericInput fields should pair into 2-column rows with aligned labels/inputs.
Output: Updated SidebarFxProperties.tsx with all FX sections using 2-col grid layout.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/sidebar/SidebarProperties.tsx (REFERENCE — the 2-col layout pattern to match)
@Application/src/components/sidebar/SidebarFxProperties.tsx (TARGET — current single-col layout to fix)
@Application/src/components/shared/NumericInput.tsx (shared input component — already flex-1, pairs naturally)

<interfaces>
<!-- Reference layout pattern from SidebarProperties.tsx (TRANSFORM section, lines 237-268) -->
<!-- This is the EXACT pattern to replicate in all FX sections -->

```tsx
// Container: flex-col with 10px vertical gap, 6px top margin after SectionLabel
<div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
  {/* Each row: flex items-center with 16px horizontal gap */}
  <div class="flex items-center" style={{ gap: '16px' }}>
    <NumericInput label="X" value={...} step={1} onChange={...} />
    <NumericInput label="Y" value={...} step={1} onChange={...} />
  </div>
  <div class="flex items-center" style={{ gap: '16px' }}>
    <NumericInput label="Scale" value={...} step={0.01} onChange={...} />
    <NumericInput label="Rot" value={...} step={1} onChange={...} />
  </div>
</div>
```

<!-- NumericInput is already `flex-1 min-w-0` so two inputs in a flex row will split 50/50 -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convert all FX sections to 2-column layout</name>
  <files>Application/src/components/sidebar/SidebarFxProperties.tsx</files>
  <action>
Refactor every FX section sub-component to use the 2-column row layout from SidebarProperties.tsx.

**Pattern to apply everywhere:** Replace `<div class="space-y-1.5">` with `<div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>` after SectionLabel. Pair NumericInputs into rows using `<div class="flex items-center" style={{ gap: '16px' }}>`.

**Specific pairings per section:**

1. **GrainSection** (3 numeric + seed):
   - Row 1: Density + Size
   - Row 2: Intensity + SeedControls
   Note: SeedControls currently renders a button and optional NumericInput as fragments. Wrap it in a flex-1 container so it takes half-width.

2. **ParticlesSection** (4 numeric + seed):
   - Row 1: Count + Speed
   - Row 2: Min + Max
   - Row 3: SeedControls (half-width left column)

3. **LinesSection** (4 numeric + seed):
   - Row 1: Count + Thick
   - Row 2: Min + Max
   - Row 3: SeedControls (half-width left column)

4. **DotsSection** (4 numeric + seed):
   - Row 1: Count + Speed
   - Row 2: Min + Max
   - Row 3: SeedControls (half-width left column)

5. **VignetteSection** (3 numeric, no seed):
   - Row 1: Size + Softness
   - Row 2: Intensity (single field, left column only)

6. **ColorGradeSection** (5 numeric + preset dropdown + tint + fade blend):
   - Keep preset dropdown full-width above the grid (it's a select, not a NumericInput)
   - Row 1: Bright + Contrast
   - Row 2: Sat + Hue
   - Row 3: Fade (single field, left column only)
   - Keep Tint color picker and Fade Blend dropdown as full-width rows below the grid (they are not NumericInputs and have different layout needs)

7. **BlurSection** (1 numeric):
   - Row 1: Radius (single field, left column only)

8. **Generator blur** section at bottom of SidebarFxProperties (1 numeric):
   - Wrap in same flex-col + marginTop pattern for consistency
   - Row 1: Radius (single field, left column only)

**SeedControls adaptation:** The SeedControls component renders a `<>` fragment with a button and conditional NumericInput. To fit in a 2-col row, wrap the SeedControls usage inside a `<div class="flex items-center gap-2 flex-1 min-w-0">` so it occupies one column-width. The lock button and seed input will sit inside that half.

**Also update the top-level sections** (Opacity + Visibility, Blend mode) to use `flex flex-col` with `gap: 10px` and `marginTop: 6px` instead of `space-y-1.5` for vertical consistency with the new pattern. Keep the opacity slider and blend dropdown as full-width elements (they aren't NumericInput pairs).

**Important:** Do NOT change the SeedControls component itself -- only change how it's placed in each section's layout.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>All FX section sub-components use 2-column row layout with flex items-center and gap:16px, matching the SidebarProperties TRANSFORM/CROP pattern. NumericInputs are paired into rows, SeedControls occupy half-width slots, and single fields sit in left columns. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
- TypeScript compilation passes (`npx tsc --noEmit`)
- Visual check: FX properties panel shows fields in 2-column layout matching Sequence properties
- Each FX section (Grain, Particles, Lines, Dots, Vignette, ColorGrade, Blur) uses paired rows
- Labels are vertically aligned across columns
</verification>

<success_criteria>
All FX property sections in SidebarFxProperties.tsx use the same 2-column paired-row layout as SidebarProperties.tsx. NumericInput fields are grouped into rows of 2, with consistent gap:16px horizontal and gap:10px vertical spacing.
</success_criteria>

<output>
After completion, create `.planning/quick/260319-pov-fx-layer-enhancement-fix-all-fx-properti/260319-pov-SUMMARY.md`
</output>
