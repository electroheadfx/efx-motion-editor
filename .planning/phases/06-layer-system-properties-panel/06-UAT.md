---
status: diagnosed
phase: 06-layer-system-properties-panel
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md, 06-04-SUMMARY.md, 06-05-SUMMARY.md, 06-06-SUMMARY.md
started: 2026-03-10T13:00:00Z
updated: 2026-03-10T13:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Layer List with Base Layer
expected: Open a project. The left panel shows a Layers section with the base layer listed. The base layer is visually identifiable.
result: pass

### 2. Add Static Image via Asset Picker
expected: Click the add layer button/menu and select "Static Image". Instead of a file dialog, a popover grid appears showing already-imported images (same pattern as KEY PHOTOS manager). Clicking an image adds it as a new layer. An "Import new..." button at the bottom opens a file dialog as fallback.
result: pass

### 3. Add Video Layer
expected: Click add layer > Video. A file dialog opens. Select a video file. A new video layer appears in the layer list. The video is copied to the project's videos/ directory and renders in the preview.
result: issue
reported: "I want the same mechanical from the image import: it show a popover grid appears showing already-imported video, with An 'Import new...' button at the bottom opens a file dialog as fallback."
severity: major

### 4. Video in IMPORTED Panel
expected: After adding a video layer, the video appears in the IMPORTED assets window alongside images.
result: issue
reported: "No, no video in IMPORTED assets window alongside images. The video still in project."
severity: major

### 5. Drag-and-Drop Layer Reorder
expected: With multiple layers, drag a non-base layer to a different position. The layer list order updates smoothly. The preview reflects the new compositing order (layers render bottom-to-top).
result: pass

### 6. Base Layer Protection
expected: The base layer cannot be deleted (delete button missing or disabled). The base layer stays at the bottom position and cannot be dragged below other layers.
result: pass

### 7. Toggle Layer Visibility
expected: Click the eye icon on a layer. The layer disappears from the canvas preview. Click again to restore. Preview updates in real-time.
result: pass

### 8. Delete Non-Base Layer
expected: Select a non-base layer. Click delete. The layer is removed from the list and disappears from the preview.
result: pass

### 9. Multi-Layer Canvas Preview
expected: With 2+ visible layers, the preview canvas shows all layers composited together. Layers render with correct stacking order (bottom-to-top). The preview uses a canvas element.
result: pass

### 10. Blend Mode & Opacity on All Layer Types
expected: Select an image layer. Change blend mode (e.g., Multiply) — preview updates. Drag opacity slider — transparency changes in real-time. Now select a video layer. Same controls work identically on video layers. Video layers default to 'normal' blend mode.
result: issue
reported: "Blend mode with Video layer DO NOT WORK"
severity: major

### 11. Transform Controls (NumericInput)
expected: Select a layer. The properties panel shows position X/Y, scale, and rotation inputs. You can type multi-digit values (e.g., 10, 1.2, 200) without the input resetting. Press Enter to commit the value. Press Escape to revert to the previous value.
result: pass

### 12. Crop Controls (NumericInput)
expected: Select a layer. The properties panel shows crop controls (Top/Right/Bottom/Left). You can type multi-digit and decimal values (e.g., 0.5, 0.25). Press Enter to commit. Values are constrained to 0-1 range. The crop clips the layer's visible area in the preview.
result: pass

### 13. Properties Panel Empty State
expected: With no layer selected, the properties panel shows a message like "Select a layer to edit properties" instead of controls.
result: pass

### 14. Undo/Redo Layer Operations
expected: Add a layer, then Cmd+Z — the layer is removed. Cmd+Shift+Z — the layer reappears. Same works for delete, reorder, and property changes (opacity, blend mode, transform, crop).
result: pass

## Summary

total: 14
passed: 11
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "Add video layer should show asset picker popover with grid of already-imported videos (same pattern as static image picker), with 'Import new...' fallback button for file dialog"
  status: failed
  reason: "User reported: I want the same mechanical from the image import: it show a popover grid appears showing already-imported video, with An 'Import new...' button at the bottom opens a file dialog as fallback."
  severity: major
  test: 3
  root_cause: "Video 'Add Layer' flow was never updated to use asset picker popover. Plan 06-06 only added the popover for static images. handleAddVideo directly calls open() file dialog with no intermediate picker. The data infrastructure exists (imageStore.videoAssets) but the UI (popover, select-from-existing handler) was never built."
  artifacts:
    - path: "Application/src/components/layer/AddLayerMenu.tsx"
      issue: "Missing videoPickerOpen state, videoPickerRef, video picker popover JSX, handleAddVideoFromAsset function. Video button calls handleAddVideo directly instead of opening picker."
  missing:
    - "Add videoPickerOpen state and videoPickerRef mirroring imagePickerOpen/imagePickerRef"
    - "Add click-outside effect for video picker popover"
    - "Change Video button onClick to open picker instead of calling handleAddVideo"
    - "Add handleAddVideoFromAsset(videoId) function that looks up video in imageStore.videoAssets"
    - "Rename handleAddVideo to handleImportNewVideo as fallback"
    - "Add video picker popover JSX with name+icon list and 'Import new...' button"
  debug_session: ".planning/debug/video-layer-no-asset-picker.md"

- truth: "Imported video should appear in the IMPORTED assets window alongside images"
  status: failed
  reason: "User reported: No, no video in IMPORTED assets window alongside images. The video still in project."
  severity: major
  test: 4
  root_cause: "Video assets are never persisted to .mce project file and never re-discovered from videos/ directory on project load. imageStore.reset() clears videoAssets to [], hydrateFromMce only restores images. addVideoAsset IS called during handleAddVideo but videos are lost on any project reload/reopen."
  artifacts:
    - path: "Application/src/stores/imageStore.ts"
      issue: "Has videoAssets signal and addVideoAsset but no loadVideoAssets or persistence methods"
    - path: "Application/src/stores/projectStore.ts"
      issue: "hydrateFromMce only calls imageStore.loadFromMceImages, no video restoration; closeProject calls reset() which wipes videoAssets"
    - path: "Application/src/types/project.ts"
      issue: "MceProject has no video_assets field"
    - path: "Application/src/components/import/ImportGrid.tsx"
      issue: "Render code is correct — will display videos when signal has data"
  missing:
    - "Implement video asset re-discovery in hydrateFromMce by scanning videos/ dir or deriving from loaded video layers"
    - "Alternatively add video_assets to MceProject schema and serialize/deserialize"
    - "Add videoAssets restoration to loadFromMceImages or create parallel loadVideoAssets method"
  debug_session: ".planning/debug/videos-not-in-imported-panel.md"

- truth: "Blend mode and opacity controls work on video layers the same as image layers"
  status: failed
  reason: "User reported: Blend mode with Video layer DO NOT WORK"
  severity: major
  test: 10
  root_cause: "Video layers lack a re-render callback when video.readyState transitions to >= 2. resolveVideoSource() creates video elements with zero event listeners. When readyState < 2, returns null and draws a gray placeholder that ignores blend mode. Nothing triggers a re-render when video finishes loading, so blend mode (applied in drawLayer for resolved sources) never takes effect while paused."
  artifacts:
    - path: "Application/src/lib/previewRenderer.ts"
      issue: "resolveVideoSource() (lines 247-252) creates video with no event listeners for readyState changes. readyState < 2 guard returns null with no retry mechanism."
    - path: "Application/src/components/Preview.tsx"
      issue: "onImageLoaded callback exists for images but no equivalent onVideoReady for videos"
  missing:
    - "Add loadeddata/canplay event listeners to video elements in resolveVideoSource() that call onImageLoaded to trigger re-render"
    - "Add seeked event listener for frame sync re-render after seeking"
    - "Loading placeholder should respect layer blendMode and opacity instead of hardcoding"
  debug_session: ".planning/debug/video-blend-mode-broken.md"
