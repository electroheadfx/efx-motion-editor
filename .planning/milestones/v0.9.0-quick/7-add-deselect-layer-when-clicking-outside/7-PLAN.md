---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - Application/src/components/layout/EditorShell.tsx
autonomous: true
must_haves:
  truths:
    - "Clicking outside the canvas area deselects the currently selected layer"
    - "Clicking inside the canvas area still works normally (select, deselect, transform)"
    - "Clicking on interactive sidebar controls (layer list items, buttons) does NOT deselect"
    - "Escape key deselection still works"
  artifacts:
    - path: "Application/src/components/layout/EditorShell.tsx"
      provides: "Pointerdown handler that deselects layer on outside-canvas clicks"
  key_links:
    - from: "EditorShell.tsx pointerdown handler"
      to: "layerStore.setSelected(null) + uiStore.selectLayer(null)"
      via: "event delegation with canvas area exclusion"
---

<objective>
Add click-to-deselect behavior when clicking outside the canvas area.

Purpose: Currently clicking on empty canvas area deselects (via TransformOverlay), and Escape deselects, but clicking on non-interactive chrome (toolbar background, timeline background, panel backgrounds) does not deselect. This is inconsistent -- users expect a click on dead space to clear selection.

Output: EditorShell with a pointerdown handler that deselects the selected layer when clicking outside the canvas container, while preserving interactive controls (sidebar layer list, buttons, inputs).
</objective>

<context>
@Application/src/components/layout/EditorShell.tsx
@Application/src/stores/layerStore.ts
@Application/src/stores/uiStore.ts
@Application/src/components/layout/CanvasArea.tsx
</context>

<interfaces>
From Application/src/stores/layerStore.ts:
```typescript
layerStore.setSelected(id: string | null): void
layerStore.selectedLayerId: Signal<string | null>
```

From Application/src/stores/uiStore.ts:
```typescript
uiStore.selectLayer(id: string | null): void
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Add outside-canvas click deselection to EditorShell</name>
  <files>Application/src/components/layout/EditorShell.tsx</files>
  <action>
Add a `pointerdown` handler on the outermost shell div in EditorShell that deselects the selected layer when clicking outside the canvas area.

Implementation:
1. Import `layerStore` and `uiStore` (uiStore is already imported).
2. Import `layerStore` from `../../stores/layerStore`.
3. Add a `useCallback` handler `handleShellPointerDown` that:
   a. Checks if `layerStore.selectedLayerId.peek()` is null -- if so, return early (nothing to deselect).
   b. Checks if the click target is inside the CanvasArea by walking up from `e.target` to see if it reaches an element with a data attribute `data-canvas-area`. If it does, return early (canvas handles its own selection/deselection).
   c. Checks if the click target is an interactive element or inside one: `button`, `input`, `textarea`, `select`, `[role="button"]`, `[data-interactive]`, or has `contentEditable`. If so, return early (don't interfere with interactive controls).
   d. Otherwise, call `layerStore.setSelected(null)` and `uiStore.selectLayer(null)`.
4. Add `onPointerDown={handleShellPointerDown}` to the outermost `<div>` in EditorShell's return.
5. Add `data-canvas-area` attribute to the outermost container div in CanvasArea.tsx (the one with class `relative flex flex-col...`). This is the simplest marker to identify canvas area clicks.

IMPORTANT: Also modify `Application/src/components/layout/CanvasArea.tsx` -- add `data-canvas-area` to the outermost div (line 233). This is a one-line change.

The handler should use event delegation (single handler on the shell root), NOT `stopPropagation` on the canvas. This avoids breaking any existing event handling.

The `closest()` check on interactive elements is intentionally broad: the sidebar layer list items are `<button>` elements, so they will be excluded naturally. Any clickable UI control (blend mode dropdowns, opacity sliders, etc.) will also be excluded since they are interactive form elements or buttons.
  </action>
  <verify>
    <automated>cd /Users/lmarques/Dev/efx-motion-editor/Application && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>
- Clicking on non-interactive areas outside the canvas (toolbar background, timeline background, panel backgrounds) deselects the selected layer
- Clicking inside the canvas area is unaffected (TransformOverlay handles its own logic)
- Clicking on buttons, inputs, layer list items, and other interactive elements outside the canvas does NOT deselect
- TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `cd Application && npx tsc --noEmit`
2. Manual test: select a layer on canvas, then click on empty space in the toolbar area -- layer should deselect
3. Manual test: select a layer, click on a layer list item in sidebar -- layer selection should change (not deselect)
4. Manual test: select a layer, click on empty canvas -- should still deselect (existing behavior preserved)
5. Manual test: select a layer, press Escape -- should still deselect (existing behavior preserved)
</verification>

<success_criteria>
Clicking on non-interactive chrome outside the canvas area deselects the selected layer. All existing selection/deselection behaviors (canvas click, Escape key, sidebar layer selection) continue to work correctly.
</success_criteria>
