---
phase: quick
plan: "260327-tqg"
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/sidebar/PaintProperties.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Brush color picker modal opens when color button is clicked"
  artifacts:
    - path: "Application/src/components/sidebar/PaintProperties.tsx"
      provides: "ColorPickerModal import and rendering"
      min_lines: 1
  key_links:
    - from: "PaintProperties.tsx"
      to: "ColorPickerModal.tsx"
      via: "import statement"
      pattern: "import.*ColorPickerModal"
---

<objective>
Fix the brush color picker modal not opening due to a missing import. The ColorPickerModal component is used on line 1010 of PaintProperties.tsx but was never imported, causing a ReferenceError at runtime.
</objective>

<context>
@Application/src/components/sidebar/PaintProperties.tsx
@Application/src/components/shared/ColorPickerModal.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add missing ColorPickerModal import to PaintProperties.tsx</name>
  <files>Application/src/components/sidebar/PaintProperties.tsx</files>
  <action>
    Add the missing import statement to the top of PaintProperties.tsx alongside the other imports:

    ```tsx
    import {ColorPickerModal} from '../shared/ColorPickerModal';
    ```

    Place it after the existing `import {SectionLabel} from '../shared/SectionLabel';` line or with other shared component imports. The ColorPickerModal component already exists at `Application/src/components/shared/ColorPickerModal.tsx` and is exported as a named export `export function ColorPickerModal`.
  </action>
  <verify>
    <automated>grep -n "import.*ColorPickerModal" /Users/lmarques/Dev/efx-motion-editor/Application/src/components/sidebar/PaintProperties.tsx</automated>
  </verify>
  <done>PaintProperties.tsx imports ColorPickerModal; no ReferenceError on brush color button click</done>
</task>

</tasks>

<verification>
grep -n "ColorPickerModal" Application/src/components/sidebar/PaintProperties.tsx
</verification>

<success_criteria>
Brush color picker modal opens and closes correctly when clicking the color button in the Paint toolbar or PaintProperties panel.
</success_criteria>

<output>
After completion, create `.planning/quick/260327-tqg-fix-brush-color-picker-modal-not-opening/260327-tqg-SUMMARY.md`
</output>
