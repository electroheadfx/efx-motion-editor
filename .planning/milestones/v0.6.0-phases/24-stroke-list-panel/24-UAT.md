---
status: diagnosed
phase: 24-stroke-list-panel
source:
  - 24-01-SUMMARY.md
  - 24-02-PLAN.md
started: 2026-03-27T16:30:00Z
updated: 2026-03-27T16:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Draw strokes then switch to select mode
expected: Draw several strokes (brush, line, rectangle, etc.) with different colors. Switch to select tool (S key). A STROKES collapsible section appears at the top of the properties panel showing the correct count of elements (e.g., "STROKES (5)").
result: issue
reported: "STROKES section shows but: (1) S key shortcut is overridden by 'hide paint layer from timeline' instead of selecting select tool; (2) STROKES section has left padding misalignment with other sections like SELECTION, BRUSH, ONION; (3) STROKES section should be moved after SELECTION and before BRUSH per plan D-02 ordering"
severity: major

### 2. Stroke row displays correctly
expected: Each stroke row shows: drag handle (grip icon), eye toggle icon, color swatch dot, tool label with index (e.g., "Brush 1", "Line 2"), and a delete button (X). Rows are visually grouped.
result: pass

### 3. Label numbering is correct
expected: With 3 strokes, the back-most stroke shows "Tool 1" and the front-most shows "Tool 3" in the list (front-most = highest number, matching canvas z-order).
result: pass

### 4. Click row selects on canvas
expected: Clicking a stroke row highlights the row visually and shows selection bounding box on the stroke on canvas. The sidebar row shows selected background.
result: pass

### 5. Click canvas selects in list
expected: With strokes already visible in the list, clicking a stroke on the canvas highlights the corresponding row in the STROKES list (bidirectional sync).
result: pass

### 6. Cmd+click multi-select
expected: Cmd+clicking multiple rows toggles selection on each without clearing previous selections. Selected rows all show selected background.
result: pass

### 7. Shift+click range select
expected: Shift+clicking a row selects all rows from the previous anchor to the clicked row (inclusive range). Previous individual selections are cleared.
result: pass

### 8. Drag to reorder
expected: Dragging a row by its grip handle and dropping in a new position updates the canvas rendering order immediately (the visual stacking of strokes changes). Release the drag and the new order persists on canvas.
result: pass

### 9. Eye toggle hides stroke
expected: Clicking the eye icon on a visible stroke hides it on the canvas immediately (stroke disappears from rendering). The row remains in the list but becomes visually dimmed (lower opacity). The eye icon changes to EyeOff.
result: pass

### 10. Eye toggle shows hidden stroke
expected: Clicking EyeOff icon on a hidden stroke makes it visible again on the canvas. Row opacity returns to normal. Icon changes back to Eye.
result: pass

### 11. Delete removes stroke
expected: Clicking the X delete button on a row removes that stroke from the canvas immediately. The row disappears from the list.
result: pass

### 12. Undo delete
expected: After deleting a stroke (previous test), pressing Ctrl+Z (undo) restores the stroke to its original position on the canvas and row reappears in the list.
result: issue
reported: "Undo restores stroke but the StrokeList and canvas don't refresh properly - visual update is incomplete after undo"
severity: major

### 13. Undo visibility toggle
expected: After hiding a stroke with eye toggle, pressing Ctrl+Z restores it to visible state on canvas.
result: pass

### 14. Undo reorder
expected: After reordering strokes, pressing Ctrl+Z restores the original z-order on canvas.
result: pass

### 15. Hidden stroke not selectable on canvas
expected: With a stroke hidden via eye toggle, clicking on its canvas position does NOT select it (hidden strokes cannot be hit by canvas click).
result: pass

## Summary

total: 15
passed: 13
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "S key switches to select tool and shows STROKES section"
  status: failed
  reason: "User reported: S key is overridden by 'hide paint layer from timeline' instead of selecting select tool"
  severity: major
  test: 1
  root_cause: "S key shortcut in shortcuts.ts (line 445) is bound to soloStore.toggleSolo() instead of paintStore.setTool('select'). Solo mode toggles overlay sequence visibility, creating the 'hide paint layer' behavior."
  artifacts:
    - path: "Application/src/lib/shortcuts.ts"
      issue: "Line 445: 's' key bound to soloStore.toggleSolo() instead of paintStore.setTool('select')"
  missing:
    - "Change S key binding to paintStore.setTool('select')"
    - "Assign solo toggle to a different keyboard shortcut (e.g., Alt+S)"
  debug_session: ".planning/debug/24-s-key-override.md"
- truth: "STROKES section aligns padding with SELECTION, BRUSH, ONION sections"
  status: failed
  reason: "User reported: STROKES section has left padding misalignment with other sections"
  severity: cosmetic
  test: 1
  root_cause: "CollapsibleSection.tsx header div applies px-3 (12px left padding) while SectionLabel has no container (0px padding). STROKES section via CollapsibleSection is indented 12px from left edge, while SELECTION/BRUSH/ONION use SectionLabel at 0px."
  artifacts:
    - path: "Application/src/components/sidebar/CollapsibleSection.tsx"
      issue: "Header has class 'px-3' causing 12px left indentation"
  missing:
    - "Remove px-3 from CollapsibleSection header or change to pl-0 pr-3 to keep right padding but remove left indentation"
  debug_session: ".planning/debug/24-strokes-padding.md"
- truth: "STROKES section positioned after SELECTION and before BRUSH"
  status: failed
  reason: "User reported: per plan D-02 ordering, STROKES should be after SELECTION and before BRUSH"
  severity: cosmetic
  test: 1
  root_cause: "Implementation correctly followed D-02 spec (StrokeList placed BEFORE SELECTION per 'at top' wording), but user expects STROKES AFTER SELECTION and BEFORE BRUSH. Need to move StrokeList from before SELECTION to after SELECTION section."
  artifacts:
    - path: "Application/src/components/sidebar/PaintProperties.tsx"
      issue: "StrokeList on line 146 placed before SELECTION SectionLabel on line 148"
  missing:
    - "Move StrokeList from before SELECTION to after SELECTION section content, before Copy to Next Frame and BRUSH sections"
  debug_session: ".planning/debug/24-strokes-ordering.md"
- truth: "Undo delete restores stroke and properly refreshes both StrokeList and canvas"
  status: failed
  reason: "User reported: undo restores stroke but StrokeList and canvas don't refresh properly after undo"
  severity: major
  test: 12
  root_cause: "removeElement undo closure does not call _notifyVisualChange(layerId, frame), so paintVersion is not bumped after undo. StrokeList subscribes to paintVersion for reactivity, so no re-render is triggered. All other element mutations (reorderElements, setElementVisibility, moveElements*) correctly call _notifyVisualChange in their undo closures."
  artifacts:
    - path: "Application/src/stores/paintStore.ts"
      issue: "removeElement undo closure (lines 145-148) only does splice without _notifyVisualChange call"
  missing:
    - "Add _notifyVisualChange(layerId, frame) call to removeElement undo closure"
    - "Consider adding invalidateFrameFxCache + refreshFrameFx to rebuild FX cache after undo"
  debug_session: ".planning/debug/24-undo-refresh.md"

