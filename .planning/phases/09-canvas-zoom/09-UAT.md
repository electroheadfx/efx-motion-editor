---
status: complete
phase: 09-canvas-zoom
source: [09-01-SUMMARY.md, 09-02-PLAN.md]
started: 2026-03-12T16:00:00Z
updated: 2026-03-12T16:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Toolbar Zoom In/Out Buttons
expected: Click + button increases zoom through preset stops. Click - button decreases through presets. Presets are 10%, 25%, 50%, 75%, 100%, 150%, 200%, 300%, 400%.
result: issue
reported: "its perfect but I'd like to have a hand icon for offset canvas when its zoomed to move the position. When I click and drag with direction I am able to move position"
severity: minor

### 2. Toolbar Zoom Percent Display
expected: The toolbar shows the current zoom percentage (e.g., "100%", "150%") and updates reactively as you zoom in/out. No hardcoded "100%".
result: pass

### 3. Toolbar Button Disabled States
expected: At 400% zoom, the + button appears grayed out (reduced opacity, no hover effect). At 10% zoom, the - button appears grayed out. Both prevent further clicks at limits.
result: pass

### 4. Keyboard Zoom Shortcuts
expected: Cmd+= zooms in (same preset snap as toolbar +). Cmd+- zooms out (same as toolbar -). Cmd+0 fits canvas to window, centering the content.
result: issue
reported: "Cmd+0 work, Cmd+- does a zoom in instead of a zoom out (minus decrease canvas), and Cmd+= (plus) no work: it should zoom in. The fit to canvas is not responsive because it set to 100% instead to fit on the canvas space. Something make me panic its that the project is HD (1920x1080), so 100% should show a bigger image look at snapshot image are something like ~829x461"
severity: blocker

### 5. Scroll Wheel Zoom
expected: Hold Cmd and scroll up/down — smooth continuous zoom anchored to cursor position. After wheel zoom to an in-between value (e.g., 137%), clicking toolbar + snaps to next preset up (150%).
result: issue
reported: "scroll with trackpad pinch make the image zoom not centered on canvas, sometimes the image go out of canvas window. Click on +/- doesn't not re-place the image in center. I asked before a tool to move the zoomed image canvas."
severity: major

### 6. Pinch-to-Zoom (Trackpad)
expected: Pinch gesture on trackpad smoothly zooms the canvas, anchored to cursor/finger position. Behaves same as Cmd+scroll.
result: issue
reported: "Pinch gesture on trackpad make the image canvas out of window, please fix it, I explained before"
severity: major

### 7. Fit-to-Window
expected: After zooming in (e.g., 400%), press Cmd+0 — canvas zooms to fit the window and centers. Resizing the window then pressing Cmd+0 again recalculates to the new size. Fit never exceeds 100%.
result: issue
reported: "the fit is a 100% mode, it doesn't fit to the window canvas, when I make the app fullscreen the fit dont use the space available. Screenshot shows fullscreen with large empty space around ~829x461 canvas for a 1920x1080 project."
severity: blocker

### 8. Fit-to-Window on Project Open
expected: Opening or creating a project automatically fits the canvas to the window (no manual zoom adjustment needed).
result: issue
reported: "it set to 100% but not fit the window at all"
severity: blocker

### 9. Zoom Persistence Across Navigation
expected: While zoomed in/out, navigating between frames (arrow keys), playing/pausing animation, or switching sequences does NOT reset the zoom level.
result: pass

### 10. Help Overlay Shows Zoom Shortcuts
expected: Press Shift+? to open the shortcuts overlay. A "Canvas" group appears listing: ⌘= (Zoom in), ⌘− (Zoom out), ⌘0 (Fit to window).
result: pass

## Summary

total: 10
passed: 4
issues: 6
pending: 0
skipped: 0

## Gaps

- truth: "When zoomed in, canvas should show a hand/grab cursor and allow click-drag to pan the canvas position"
  status: failed
  reason: "User reported: its perfect but I'd like to have a hand icon for offset canvas when its zoomed to move the position. When I click and drag with direction I am able to move position"
  severity: minor
  test: 1
  artifacts: []
  missing: []
- truth: "Cmd+= zooms in, Cmd+- zooms out, Cmd+0 fits to canvas space (not fixed 100%)"
  status: failed
  reason: "User reported: Cmd+- does zoom in instead of zoom out (reversed). Cmd+= does not work at all. Fit-to-window sets to 100% instead of fitting to canvas space. At 100% zoom a 1920x1080 project shows at ~829x461 — zoom percentage does not represent actual project resolution."
  severity: blocker
  test: 4
  artifacts: []
  missing: []
- truth: "Scroll/pinch zoom stays centered on canvas, image doesn't escape canvas bounds, and user can click-drag to pan zoomed image"
  status: failed
  reason: "User reported: scroll with trackpad pinch make the image zoom not centered on canvas, sometimes the image go out of canvas window. Click on +/- doesn't not re-place the image in center. I asked before a tool to move the zoomed image canvas."
  severity: major
  test: 5
  artifacts: []
  missing: []
- truth: "Pinch-to-zoom keeps image within canvas bounds"
  status: failed
  reason: "User reported: Pinch gesture on trackpad make the image canvas out of window, please fix it, I explained before"
  severity: major
  test: 6
  artifacts: []
  missing: []
- truth: "Fit-to-window scales canvas to fill available space, not just cap at 100%"
  status: failed
  reason: "User reported: the fit is a 100% mode, it doesn't fit to the window canvas, when I make the app fullscreen the fit dont use the space available. Screenshot shows fullscreen with large empty space around ~829x461 canvas for a 1920x1080 project."
  severity: blocker
  test: 7
  artifacts: []
  missing: []
- truth: "Project open/create auto-fits canvas to available window space"
  status: failed
  reason: "User reported: it set to 100% but not fit the window at all"
  severity: blocker
  test: 8
  artifacts: []
  missing: []
