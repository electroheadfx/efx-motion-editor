---
status: diagnosed
phase: 04-timeline-preview
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-03-09T12:00:00Z
updated: 2026-03-09T15:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Preview Frame Display
expected: Open a project with sequences and key photos. The preview area displays the current frame's image with letterbox scaling (no stretching/cropping). The image fills the preview maintaining aspect ratio.
result: pass

### 2. Play/Pause Playback
expected: Click the Play button in the preview/timeline controls. Frames advance automatically at the project's fps rate — the preview image updates frame by frame. Click Pause to stop. Playhead position on the timeline moves in sync.
result: issue
reported: "The playback doesn't play all the sub key images from sequence (but show only one image which the last key of the sequence). Logs show imageId changes between frames but preview visually stays on one image. gf=0-13 in first sequence shows 3 different imageIds (0b89995c, ce3ee08e, c1ead52c) but only one image displays."
severity: major

### 3. Step Forward/Backward
expected: Click the step forward button to advance exactly one frame. Click step backward to go back one frame. Each step updates the preview image and the timecode display.
result: issue
reported: "No work, it show only One IMAGE key, and sometimes it show only the last key of the last sequence and nothing other. The player is broken"
severity: blocker

### 4. Timeline Canvas with Tracks and Thumbnails
expected: The timeline area shows horizontal tracks corresponding to each sequence. Frame thumbnails are rendered inside each track. A time ruler runs across the top. The playhead is visible as a vertical line at the current frame position.
result: pass

### 5. Click-to-Seek on Timeline
expected: Click anywhere on the timeline canvas (in the track/ruler area). The playhead jumps to the clicked position and the preview updates to show that frame's image.
result: issue
reported: "The playhead jumps to the clicked position but DO NOT show the preview of frame's image, it show the last image key of sequences keys of the last sequence"
severity: major

### 6. Playhead Drag Scrubbing
expected: Click and drag the playhead on the timeline. The preview updates in real-time as you scrub through frames. Dragging outside the canvas boundary still tracks the cursor (pointer capture).
result: issue
reported: "the playhead can't to be dragged so no real-time and no scrub frames."
severity: blocker

### 7. Timeline Zoom (Wheel/Pinch)
expected: Use mouse wheel (or trackpad pinch) on the timeline canvas. The timeline zooms in/out anchored at the cursor position (the frame under cursor stays stable). The zoom slider in the controls bar reflects the current zoom level. The "Fit All" button resets zoom to show all frames.
result: pass

### 8. Preview Zoom and Pan
expected: Hold Cmd (or Ctrl on non-Mac) and scroll on the preview to zoom in/out (range 0.1x to 4x). Middle-click and drag to pan the preview. Zoom percentage is displayed. The Fit button resets zoom and pan to defaults.
result: issue
reported: "Cmd and Ctrl and scroll make a zoom, it works fine. The middle-click and drag does nothing except to position the cursor time but I can pan with mouse scroll. Fit work very well."
severity: minor

### 9. Timecode Display
expected: The timeline controls bar shows the current time position and total duration in timecode format (e.g., "0:00.000 / 0:05.000"). Values update as you seek, play, or step through frames.
result: pass

### 10. Sequence Reorder via Track Drag
expected: On the timeline, click and drag a track header (the label area on the left side). A blue drop indicator line and ghost track show where the sequence will be placed. Releasing the drag reorders the sequences — both the timeline tracks and the left panel sequence list update to reflect the new order.
result: pass

## Summary

total: 10
passed: 5
issues: 5
pending: 0
skipped: 0

## Gaps

- truth: "Frames advance automatically at the project's fps rate — the preview image updates frame by frame"
  status: failed
  reason: "User reported: The playback doesn't play all the sub key images from sequence (but show only one image which the last key of the sequence). Logs show imageId changes between frames but preview visually stays on one image."
  severity: major
  test: 2
  root_cause: "Data layer is correct (imageIds change per frame, images cached). The efxasset:// custom protocol in lib.rs returns no Cache-Control headers — WebKit WebView may aggressively cache custom protocol responses, causing all Image() elements to display the same cached pixel data despite different src URLs. Additionally, previewRenderer.ts getImageSource() creates Image() objects asynchronously but there may be a race between the preload callback (onImageLoaded → renderCurrent using .peek()) and the signal effect re-render."
  artifacts:
    - path: "Application/src-tauri/src/lib.rs"
      issue: "efxasset:// protocol response missing Cache-Control: no-cache header"
    - path: "Application/src/lib/previewRenderer.ts"
      issue: "getImageSource async load may have race with render effect"
    - path: "Application/src/components/Preview.tsx"
      issue: "Dual render paths (signal effect + rAF tick) could conflict"
  missing:
    - "Add Cache-Control: no-cache/no-store header to efxasset response"
    - "Add debug instrumentation to verify different img.src URLs produce different pixel data"
    - "Consider using img.src directly in drawImage debug log to verify URLs differ"

- truth: "Step forward/backward advances exactly one frame, each step updates the preview image"
  status: failed
  reason: "User reported: No work, it show only One IMAGE key, and sometimes it show only the last key of the last sequence and nothing other. The player is broken"
  severity: blocker
  test: 3
  root_cause: "Same root cause as Test 2 — preview image resolution is broken across all navigation methods (play, step, seek). The frameMap data layer correctly maps frames to different imageIds but the rendered canvas always shows the same image."
  artifacts:
    - path: "Application/src/lib/previewRenderer.ts"
      issue: "resolveLayerSource returns cached HTMLImageElement but canvas shows same visual"
  missing:
    - "Fix preview image rendering (shared root cause with Tests 2 and 5)"

- truth: "Click on timeline jumps playhead and preview updates to show that frame's image"
  status: failed
  reason: "User reported: The playhead jumps to the clicked position but DO NOT show the preview of frame's image, it show the last image key of sequences keys of the last sequence"
  severity: major
  test: 5
  root_cause: "Same root cause as Tests 2 and 3 — preview image not updating when frame changes. Click-to-seek correctly updates currentFrame signal (playhead moves), but canvas renders the same cached image."
  artifacts:
    - path: "Application/src/lib/previewRenderer.ts"
      issue: "Same image displayed regardless of frame position"
  missing:
    - "Fix preview image rendering (shared root cause with Tests 2 and 3)"

- truth: "Click and drag the playhead on the timeline for real-time scrubbing"
  status: failed
  reason: "User reported: the playhead can't to be dragged so no real-time and no scrub frames."
  severity: blocker
  test: 6
  root_cause: "TimelineInteraction.ts onMouseDown uses MouseEvent but calls setPointerCapture() which requires PointerEvent.pointerId. Since MouseEvent has no pointerId, the expression (e as unknown as PointerEvent).pointerId evaluates to undefined, and undefined ?? 0 = 0. setPointerCapture(0) throws DOMException: InvalidPointerId. Additionally, isOnPlayhead() hit threshold is only 5px which may be too narrow to reliably click. Events should use pointerdown/pointermove/pointerup instead of mousedown/mousemove/mouseup."
  artifacts:
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      issue: "Lines 136-139: MouseEvent cast to PointerEvent for setPointerCapture — pointerId undefined causes throw"
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      issue: "Line 83: isOnPlayhead() hit area 5px threshold too narrow"
  missing:
    - "Switch from mousedown/mousemove/mouseup to pointerdown/pointermove/pointerup"
    - "Use e.pointerId directly instead of casting MouseEvent"
    - "Widen playhead hit area to 8-10px"
    - "Add try/catch around setPointerCapture or verify pointerId exists"

- truth: "Middle-click and drag to pan the preview"
  status: failed
  reason: "User reported: Middle-click and drag does nothing except to position the cursor time but can pan with mouse scroll. Fit works well."
  severity: minor
  test: 8
  root_cause: "CanvasArea.tsx handleMouseDown uses MouseEvent but calls setPointerCapture() with (e as unknown as PointerEvent).pointerId ?? 0. Same issue as playhead drag: MouseEvent has no pointerId, setPointerCapture(0) throws. The drag.isDragging flag IS set before the throw, but the exception may disrupt event processing. Without proper pointer capture, mouse events outside the element won't fire. Should use pointerdown/pointermove/pointerup events."
  artifacts:
    - path: "Application/src/components/layout/CanvasArea.tsx"
      issue: "Line 57: setPointerCapture with undefined pointerId from MouseEvent cast"
  missing:
    - "Switch from mousedown/mousemove/mouseup to pointerdown/pointermove/pointerup"
    - "Use e.pointerId directly from PointerEvent"
