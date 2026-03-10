---
status: complete
phase: 06-layer-system-properties-panel
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md
started: 2026-03-10T12:00:00Z
updated: 2026-03-10T12:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Layer List with Base Layer
expected: Open a project. The left panel shows a Layers section with at least the base layer listed. The base layer should be visually identifiable (e.g., labeled or marked as base).
result: pass

### 2. Add Static Image Layer
expected: Click the add layer button/menu. Select "Static Image" (or similar). A file dialog opens. Select an image file. A new layer appears in the layer list above the base layer. The image is visible in the preview.
result: issue
reported: "It works fine, but it should not open a file dialog but use the source of imported assets, because it make double import if I want any image I already imported. Maybe add an option for import from file dialog too if needed. But First show a grid of already imported image exactely like 'KEY PHOTOS' manager."
severity: major

### 3. Add Video Layer
expected: Click the add layer button/menu. Select "Video". A file dialog opens. Select a video file. A new video layer appears in the layer list. The video is copied to the project's videos/ directory.
result: issue
reported: "work but the video do not show in IMPORTED window, its fine copied in project's videos/ directory"
severity: major

### 4. Drag-and-Drop Layer Reorder
expected: With multiple layers present, drag a non-base layer to a different position. The layer list order updates. The preview reflects the new compositing order (layers render bottom-to-top).
result: issue
reported: "the drag and drop re-order DO NOT WORK, please use the reorder fix used in KEYS PHOTOS manager"
severity: blocker

### 5. Base Layer Protection
expected: The base layer cannot be deleted (delete button missing or disabled). The base layer cannot be dragged below other layers or removed from its bottom position.
result: pass

### 6. Toggle Layer Visibility
expected: Click the visibility/eye icon on a layer. The layer disappears from the canvas preview. Click again to restore visibility. The preview updates in real-time.
result: pass

### 7. Delete Non-Base Layer
expected: Select a non-base layer. Click delete. The layer is removed from the list and disappears from the preview.
result: pass

### 8. Multi-Layer Canvas Preview
expected: With 2+ visible layers, the preview canvas shows all layers composited together (not just the base layer). Layers render with correct stacking order. The preview uses the canvas element (not an img tag).
result: pass

### 9. Properties Panel - Blend Mode & Opacity
expected: Select a layer. The properties panel shows blend mode dropdown and opacity slider. Changing blend mode (e.g., to Screen or Multiply) updates the preview compositing. Dragging the opacity slider changes layer transparency in real-time.
result: issue
reported: "blend mode and opacity work only on Image, not on video layer"
severity: major

### 10. Properties Panel - Transform Controls
expected: Select a layer. The properties panel shows position X/Y, scale, and rotation inputs. Changing these values moves/scales/rotates the layer in the preview.
result: issue
reported: "all seem work but the inputs has a problem, I can't type severals time, the input is reset all time (focus and rerender issues). I can type One number but not two or more, e.g. 10, 1.2, 200. I can't delete the value and enter mine. I think it should add a Enter event for create the new value, else not the old value is kept."
severity: blocker

### 11. Properties Panel - Crop Controls
expected: Select a layer. The properties panel shows crop controls (Top/Right/Bottom/Left). Adjusting crop values clips the layer's visible area in the preview. Values are constrained to 0-1 range.
result: issue
reported: "seem work, but the inputs has any issue I can't enter severals numbers and a comma, e.g. 10, 1.2, 200, it need to add a ENTER event for create the new value, else not it keep the old value"
severity: blocker

### 12. Properties Panel Empty State
expected: With no layer selected, the properties panel shows a message like "Select a layer to edit properties" instead of controls.
result: pass

### 13. Undo/Redo Layer Operations
expected: Add a layer, then Cmd+Z to undo - the layer is removed. Cmd+Shift+Z to redo - the layer reappears. Same for delete, reorder, and property changes (opacity, blend mode, etc.).
result: pass

## Summary

total: 13
passed: 7
issues: 6
pending: 0
skipped: 0

## Gaps

- truth: "Add static image layer should show grid of already imported assets (like KEY PHOTOS manager) instead of opening a file dialog, with optional file dialog fallback for new imports"
  status: failed
  reason: "User reported: It works fine, but it should not open a file dialog but use the source of imported assets, because it make double import if I want any image I already imported. Maybe add an option for import from file dialog too if needed. But First show a grid of already imported image exactely like 'KEY PHOTOS' manager."
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "Imported video should appear in the IMPORTED assets window after being added as a layer"
  status: failed
  reason: "User reported: work but the video do not show in IMPORTED window, its fine copied in project's videos/ directory"
  severity: major
  test: 3
  artifacts: []
  missing: []

- truth: "Drag-and-drop layer reorder updates layer list order and preview compositing order"
  status: failed
  reason: "User reported: the drag and drop re-order DO NOT WORK, please use the reorder fix used in KEYS PHOTOS manager"
  severity: blocker
  test: 4
  artifacts: []
  missing: []

- truth: "Blend mode and opacity controls work on all layer types including video layers"
  status: failed
  reason: "User reported: blend mode and opacity work only on Image, not on video layer"
  severity: major
  test: 9
  artifacts: []
  missing: []

- truth: "Numeric inputs in properties panel allow typing multi-digit values (e.g. 10, 1.2, 200) without resetting, and commit on Enter while keeping old value on escape/blur"
  status: failed
  reason: "User reported: all seem work but the inputs has a problem, I can't type severals time, the input is reset all time (focus and rerender issues). I can type One number but not two or more, e.g. 10, 1.2, 200. I can't delete the value and enter mine. I think it should add a Enter event for create the new value, else not the old value is kept."
  severity: blocker
  test: 10
  artifacts: []
  missing: []

- truth: "Crop numeric inputs allow typing multi-digit/decimal values and commit on Enter, keeping old value otherwise"
  status: failed
  reason: "User reported: seem work, but the inputs has any issue I can't enter severals numbers and a comma, e.g. 10, 1.2, 200, it need to add a ENTER event for create the new value, else not it keep the old value"
  severity: blocker
  test: 11
  note: "Same root cause as test 10 - shared NumericInput component"
  artifacts: []
  missing: []
