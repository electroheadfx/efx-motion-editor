---
status: complete
phase: 02-ui-shell-image-pipeline
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:01:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Run the Tauri app from scratch. The app boots without errors, the window opens, and the editor shell renders with all panels visible.
result: pass

### 2. Editor Shell Layout & Dark Theme
expected: The app displays a full-window dark-themed editor with these panels visible: Toolbar (top), LeftPanel (sidebar with Sequences and Layers sections), CanvasArea (center with Preview), TimelinePanel (bottom with FX/Photos/Audio tracks), and PropertiesPanel (right sidebar with Transform/Blend properties). No duplicate title bar — only native macOS window chrome.
result: pass

### 3. FPS Toggle
expected: In the Toolbar, clicking the FPS toggle switches between 30fps and 60fps. The active FPS option is visually highlighted.
result: pass

### 4. Drag-and-Drop Image Import
expected: Drag one or more image files (JPEG/PNG) from Finder onto the app window. A full-window drop overlay appears during the drag. After dropping, thumbnails of the imported images appear in the LeftPanel import section.
result: pass

### 5. File Dialog Import
expected: Click the "+ Import" button in the LeftPanel. A native macOS file picker opens. Select one or more image files. After confirming, thumbnails appear in the LeftPanel import section.
result: pass

### 6. Import Error Handling
expected: Drag a non-image file (e.g., .txt or .pdf) onto the app. The app does not crash — either the file is silently filtered out or a warning/error message is displayed. If a HEIC file is dragged, a "not yet supported" error appears per file.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
