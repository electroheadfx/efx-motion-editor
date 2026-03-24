---
status: diagnosed
phase: 18-canvas-motion-path
source: 18-01-SUMMARY.md, 18-02-SUMMARY.md
started: 2026-03-24T18:30:00Z
updated: 2026-03-24T18:45:00Z
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
result: issue
reported: "edit work but update is bad, because each modification on each keyframe in live it need to click on 'update keyframe', I think a modification from a key frame should update in real time. When i click on keyframe and resize, move, rotate, the canvas is not updated, I do in blind mode, when I refresh I can see the change in canvas, not before."
severity: major

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
passed: 8
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Keyframe modifications (move, resize, rotate) should update the canvas and motion path trail in real-time without requiring a manual 'update keyframe' click or page refresh"
  status: failed
  reason: "User reported: edit work but update is bad, because each modification on each keyframe in live it need to click on 'update keyframe', I think a modification from a key frame should update in real time. When i click on keyframe and resize, move, rotate, the canvas is not updated, I do in blind mode, when I refresh I can see the change in canvas, not before."
  severity: major
  test: 5
  root_cause: "Two-part gap: (1) Sidebar edits between keyframes write to keyframeStore.transientOverrides which Preview.tsx never subscribes to — dead-end signal path. (2) Canvas drag move/scale/rotate handlers update layer.transform but not layer.keyframes, so interpolateLayers() in exportRenderer.ts immediately overwrites the change with keyframe-interpolated values."
  artifacts:
    - path: "Application/src/components/Preview.tsx"
      issue: "render effect subscribes to sequenceStore.sequences but not transientOverrides or displayValues"
    - path: "Application/src/lib/exportRenderer.ts"
      issue: "interpolateLayers overwrites layer.transform with keyframe data, ignoring direct transform edits"
    - path: "Application/src/stores/keyframeStore.ts"
      issue: "transientOverrides signal dead-ends at UI, never reaches renderer"
    - path: "Application/src/components/canvas/TransformOverlay.tsx"
      issue: "move/scale/rotate handlers update transform but not keyframes"
    - path: "Application/src/components/sidebar/SidebarProperties.tsx"
      issue: "between-keyframe edits write to transient-only path"
  missing:
    - "Preview.tsx render effect needs to subscribe to transientOverrides/displayValues"
    - "TransformOverlay move/scale/rotate handlers should update layer.keyframes (like kf-drag already does)"
    - "interpolateLayers needs to apply transient overrides for the selected layer"
  debug_session: ".planning/debug/canvas-no-live-update.md"
