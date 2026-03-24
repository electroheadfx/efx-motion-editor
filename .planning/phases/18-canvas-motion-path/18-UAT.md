---
status: complete
phase: 18-canvas-motion-path
source: 18-01-SUMMARY.md, 18-02-SUMMARY.md
started: 2026-03-24T18:30:00Z
updated: 2026-03-24T19:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Motion Path Trail Visibility
expected: Select a layer that has keyframed position (x/y) animation. A dotted trail should appear on the canvas showing the interpolated movement path between keyframes, using the accent color from the current theme.
result: pass

### 2. Keyframe Circle Display
expected: On the motion path trail, each keyframe position should display as a circle. The currently selected keyframe shows as a filled circle; unselected keyframes show as outlined (hollow) circles. Circles should maintain consistent visual size regardless of zoom level.
result: pass

### 3. Current Frame Highlight
expected: A larger dot should appear on the motion path at the current playhead position, visually distinct from the smaller keyframe circles.
result: pass

### 4. Path Auto-Hide Behavior
expected: Start playback — the motion path should hide while playing. Stop playback — it reappears. Select a layer without keyframed position — no motion path should be visible.
result: pass

### 5. Keyframe Circle Drag Repositioning
expected: Click and drag a keyframe circle on the motion path to move it to a new position. The dotted trail should update in real-time as you drag, reflecting the new path shape.
result: pass
retest: "Gap closure plan 18-03 fixed both dead-end signal paths. Sidebar edits and canvas drag now write to layer.keyframes, flowing through sequenceStore.sequences to Preview.tsx. User approved re-test."

### 6. Auto-Seek on Drag Start
expected: When you begin dragging a keyframe circle, the playhead (timeline scrubber) should automatically jump to that keyframe's frame.
result: pass

### 7. Keyframe Auto-Select on Click
expected: Clicking a keyframe circle on the motion path should select that keyframe — the circle becomes filled, and the timeline should reflect the selection.
result: pass

### 8. Undo After Drag
expected: After dragging a keyframe circle to a new position, press Cmd+Z. The entire drag should undo in a single step, returning the keyframe to its original position and the trail to its previous shape.
result: pass

### 9. Pointer Cursor on Hover
expected: Hover over a keyframe circle on the motion path — cursor should change to a pointer (hand). Moving off the circle onto the layer body should show the move cursor instead.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Keyframe modifications (move, resize, rotate) should update the canvas and motion path trail in real-time without requiring a manual 'update keyframe' click or page refresh"
  status: closed
  closed_by: 18-03-PLAN.md (gap closure)
  test: 5
