---
status: complete
phase: 23-stroke-interactions
source: [23-01-SUMMARY.md, 23-02-SUMMARY.md]
started: 2026-03-27T10:00:00Z
updated: 2026-03-27T10:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Transform Undo — Move
expected: Select a paint element, drag-move it, Ctrl+Z undoes the move back to original position, Ctrl+Shift+Z redoes it.
result: issue
reported: "yes work but the handler stay to the old position but the brush moved fine to the right position. I click on the stroke for refresh the handlers"
severity: major

### 2. Transform Undo — Rotate
expected: Select a paint element, rotate it using the rotation handle, Ctrl+Z undoes the rotation back to original angle, Ctrl+Shift+Z redoes it.
result: issue
reported: "I can't do that, the handler show no icon on hover, I am unable to rotate when I click and drag the object is deselected. I think the interactivity zone is out of object handlers, same for scale."
severity: blocker

### 3. Transform Undo — Uniform Scale
expected: Select a paint element, scale it using a corner handle, Ctrl+Z undoes the scale back to original size, Ctrl+Shift+Z redoes it.
result: issue
reported: "the resize handler is offset from handler icon, it scale and undo/redo fine, but the interactivity is not the right handler zone"
severity: major

### 4. Select Non-Brush Elements
expected: PaintShape elements (line, rect, ellipse) and PaintFill elements are selectable by clicking. When selected, they show a bounding box with handles, just like brush strokes.
result: pass

### 5. Alt+Drag Duplicate
expected: Select one or more paint elements. Hold Alt and drag — clones are created and you drag the clones while originals stay in place.
result: pass

### 6. Alt+Drag Duplicate Undo
expected: After an Alt+drag duplicate, press Ctrl+Z — all cloned elements are removed in a single undo step, restoring the pre-duplicate state.
result: issue
reported: "work but handlers are not updated, stay in place after undo"
severity: major

### 7. Edge Midpoint Handles Visible
expected: When a paint element is selected, 4 circular midpoint handles appear at the top, right, bottom, and left edges of the bounding box (in addition to the 4 corner square handles and the rotation handle).
result: issue
reported: "yes but they are too small"
severity: cosmetic

### 8. Non-Uniform Edge Scale
expected: Drag an edge midpoint handle to scale the element on one axis only. Top/bottom handles scale vertically, left/right handles scale horizontally. Brush stroke size (thickness) stays the same — only coordinates change.
result: issue
reported: "if I found the handler (at the wrong zone), its resize but the resizing is very exponential and fast, it doesn't work like the uniform scale which is more predictable"
severity: major

### 9. Cursor Feedback on Handles
expected: Hovering over edge handles shows ns-resize (top/bottom) or ew-resize (left/right) cursors. Corner handles show nwse-resize or nesw-resize. Cursor changes back to default when moving off handles.
result: issue
reported: "yes but it doesn't work on the right icon zone handler"
severity: major

## Summary

total: 9
passed: 2
issues: 7
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Bounding box handles update position after undo/redo"
  status: failed
  reason: "User reported: handlers stay at old position after undo/redo, brush moves to correct position. Must re-click to refresh."
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "Rotation handle is interactive at its visual position"
  status: failed
  reason: "User reported: handle shows no icon on hover, clicking/dragging deselects object. Hit area is outside visual handle position."
  severity: blocker
  test: 2
  artifacts: []
  missing: []

- truth: "Corner scale handles hit area matches visual position"
  status: failed
  reason: "User reported: resize handler is offset from handler icon, interactivity not at right handler zone"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "Bounding box handles update after Alt+drag duplicate undo"
  status: failed
  reason: "User reported: handlers stay in place after undo removes clones"
  severity: major
  test: 6
  artifacts: []
  missing: []

- truth: "Edge midpoint handles are appropriately sized"
  status: failed
  reason: "User reported: they are too small"
  severity: cosmetic
  test: 7
  artifacts: []
  missing: []

- truth: "Non-uniform edge scale has linear, predictable behavior"
  status: failed
  reason: "User reported: resizing is very exponential and fast, doesn't work like uniform scale which is more predictable"
  severity: major
  test: 8
  artifacts: []
  missing: []

- truth: "Cursor feedback appears at visual handle position"
  status: failed
  reason: "User reported: cursor feedback works but at wrong zone, not on the visible handle icon"
  severity: major
  test: 9
  artifacts: []
  missing: []
