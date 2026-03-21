---
status: complete
phase: 11-live-canvas-transform
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 11-04-PLAN.md]
started: 2026-03-14T00:00:00Z
updated: 2026-03-14T01:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Select Layer on Canvas
expected: Click on a visible content layer in the canvas. A blue bounding box with 8 white handles (4 corners + 4 edge midpoints) appears around it. Click on empty canvas area to deselect -- handles disappear.
result: issue
reported: "work but it need to click on any space in canvas where there is nothing but its not possible if all the space has layers, so I think it would like nice to add click outside canvas area for deselect a layer(s)"
severity: minor

### 2. Bidirectional Selection Sync
expected: Click a layer on the canvas -- the sidebar highlights the same layer. Click a different layer in the sidebar -- the canvas handles move to that layer. Selection stays in sync both ways.
result: pass

### 3. Drag to Move Layer
expected: Click and drag a selected layer to reposition it. X/Y values in PropertiesPanel update in real-time during the drag. Press Cmd+Z -- the entire move reverts in one undo step (not per-pixel).
result: pass
note: Fixed during UAT -- (1) getSourceDimensionsForLayer now reads actual image dimensions from frameMap for base layers, (2) Preview canvas changed from hardcoded 16:9 aspect-video to fill project dimensions, (3) Renderer changed from getBoundingClientRect to clientWidth/clientHeight to exclude CSS zoom transform from coordinate space.

### 4. Corner Handle Uniform Scale
expected: Drag a corner handle. The layer scales uniformly -- both SX and SY change together in the PropertiesPanel. Press Cmd+Z to revert the scale in one step.
result: pass

### 5. Edge Handle Single-Axis Scale
expected: Drag an edge midpoint handle. The layer stretches on one axis only -- either SX or SY changes, not both. The PropertiesPanel reflects the single-axis change.
result: pass

### 6. Rotation via Corner Drag
expected: Hover just outside a corner of the bounding box -- cursor changes (crosshair). Drag to rotate the layer. The Rotation value updates in PropertiesPanel. Cmd+Z reverts.
result: issue
reported: "work but I prefer a Rotation icon instead of a crosshair icon"
severity: cosmetic

### 7. Arrow Key Nudge
expected: Select a layer, press arrow keys -- the layer moves 1px per press. Hold Shift + arrow keys -- moves 10px per press. Deselect the layer, press left/right arrows -- frames step as before (not nudge).
result: pass
note: Fixed during UAT -- tinykeys doesn't fire 'ArrowLeft' when Shift is held. Added separate Shift+Arrow bindings.

### 8. Escape Deselect
expected: Select a layer (handles visible). Press Escape -- layer deselects, handles disappear, and arrow keys return to frame stepping behavior.
result: pass
note: User requested ESC be added to shortcuts helper overlay (cosmetic enhancement).

### 9. Pan and Playback
expected: Space+drag pans the canvas. Space tap toggles play/pause. Left-click drag on empty canvas pans. Left-click on unselected layer selects. Left-click drag on selected layer moves.
result: pass
note: Fixed during UAT -- (1) Removed Space from tinykeys, deferred play/pause to keyup to avoid conflict with Space+drag pan, (2) Added tabIndex={-1} to playback buttons to prevent Space double-toggle, (3) Rewrote pan model so drag on non-selected area always pans, (4) Blur auto-bypassed during drag for smoother performance.

### 10. Zoom-Independent Handles
expected: Zoom in and out (= key or Cmd+scroll). Handles maintain a fixed screen-pixel size (don't shrink or grow with zoom). Handles stay precisely aligned with the rendered layer at all zoom levels.
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Click outside canvas area to deselect layers when layers cover full canvas"
  status: failed
  reason: "User reported: can't deselect when layers cover entire canvas, wants click outside canvas area"
  severity: minor
  test: 1
  artifacts: []
  missing: []

- truth: "Rotation cursor should be a rotation icon, not crosshair"
  status: failed
  reason: "User reported: prefer a Rotation icon instead of a crosshair icon"
  severity: cosmetic
  test: 6
  artifacts:
    - path: "Application/src/components/canvas/transformHandles.ts"
      issue: "getCursorForHandle returns 'crosshair' for rotation zone"
  missing:
    - "Replace crosshair with custom SVG rotation cursor data URL"

- truth: "ESC shortcut should appear in shortcuts helper overlay"
  status: failed
  reason: "User requested ESC be shown in shortcuts helper"
  severity: cosmetic
  test: 8
  artifacts: []
  missing:
    - "Add Escape shortcut entry to shortcuts overlay component"
