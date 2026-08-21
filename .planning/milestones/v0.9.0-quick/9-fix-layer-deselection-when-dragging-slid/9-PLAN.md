---
phase: quick-9
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/layout/PropertiesPanel.tsx
autonomous: true
requirements: [QUICK-9]

must_haves:
  truths:
    - "Dragging a NumericInput label in the properties panel does NOT deselect the layer"
    - "Dragging the opacity range slider in the properties panel does NOT deselect the layer"
    - "Clicking dead space outside canvas/controls still deselects the layer"
  artifacts:
    - path: "Application/src/components/layout/PropertiesPanel.tsx"
      provides: "data-interactive attribute on draggable label spans"
  key_links:
    - from: "Application/src/components/layout/PropertiesPanel.tsx"
      to: "Application/src/components/layout/EditorShell.tsx"
      via: "INTERACTIVE_SELECTOR matching data-interactive attribute"
      pattern: "data-interactive"
---

<objective>
Fix layer deselection when drag-scrubbing NumericInput labels in the PropertiesPanel (bottom bar).

Purpose: When a user clicks and drags on a NumericInput label (e.g. "X", "Y", "Density", "Size", "Rot") to scrub a value, the pointerdown event bubbles up to EditorShell's handleShellPointerDown, which sees the target is a plain `<span>` (not in INTERACTIVE_SELECTOR) and deselects the layer. This causes the PropertiesPanel to collapse mid-drag since there's no longer a selected layer.

Output: PropertiesPanel stays visible during label drag-scrub interactions.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@Application/src/components/layout/PropertiesPanel.tsx
@Application/src/components/layout/EditorShell.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add data-interactive to NumericInput drag-scrub labels</name>
  <files>Application/src/components/layout/PropertiesPanel.tsx</files>
  <action>
In the NumericInput component (~line 111), add the `data-interactive` attribute to the `<span>` element that serves as the drag-to-scrub label. This span has `onPointerDown={handleLabelPointerDown}` and cursor-ew-resize styling.

Change from:
```tsx
<span
  class={`text-[10px] text-[var(--color-text-muted)] whitespace-nowrap select-none ${isDraggingLabel ? 'cursor-ew-resize' : 'cursor-ew-resize'}`}
  onPointerDown={handleLabelPointerDown}
>
```

To:
```tsx
<span
  class={`text-[10px] text-[var(--color-text-muted)] whitespace-nowrap select-none ${isDraggingLabel ? 'cursor-ew-resize' : 'cursor-ew-resize'}`}
  data-interactive
  onPointerDown={handleLabelPointerDown}
>
```

This works because EditorShell.tsx line 18 already includes `[data-interactive]` in INTERACTIVE_SELECTOR, and line 46 checks `target.closest(INTERACTIVE_SELECTOR)` before deselecting. Adding `data-interactive` to the draggable span makes it match, preventing deselection.

No changes needed in EditorShell.tsx -- the deselection guard infrastructure already supports `data-interactive`.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>NumericInput label spans have data-interactive attribute. Dragging labels in the bottom bar properties panel no longer triggers layer deselection via EditorShell's handleShellPointerDown. Clicking dead space elsewhere still deselects as before.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors
2. Manual test: Select a layer, drag-scrub any label in the properties bar (e.g. "X", "Rot", "Density") -- layer stays selected throughout the drag
3. Manual test: Click dead space (e.g. empty area in the editor shell) -- layer deselects as expected
</verification>

<success_criteria>
- Label drag-scrub in PropertiesPanel does not deselect the active layer
- All other deselection behavior (clicking dead space, clicking outside canvas) unchanged
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/9-fix-layer-deselection-when-dragging-slid/9-SUMMARY.md`
</output>
