---
status: complete
phase: 17-enhancements
source: [17-01-SUMMARY.md, 17-02-SUMMARY.md, 17-03-SUMMARY.md, 17-04-SUMMARY.md]
started: 2026-03-24T10:15:00Z
updated: 2026-03-24T10:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Key Photo Collapse/Expand Toggle
expected: Clicking on the active sequence header a second time collapses the key photo list. Clicking a different sequence auto-expands its key photos. The collapsed state is toggled per click.
result: pass

### 2. Solo Mode Toggle Button
expected: A Headphones icon button appears in the timeline toolbar (after loop toggle, before beat markers). Clicking it toggles solo mode on/off with active/inactive styling.
result: pass

### 3. Solo Mode Keyboard Shortcut
expected: Pressing S toggles solo mode on/off (same as clicking the toolbar button).
result: pass

### 4. Solo Mode Overlay Gating
expected: When solo mode is active, FX overlays (text, shapes, etc.) are NOT rendered on the preview canvas — only the base content (images/video/solids) and content transitions (cross-dissolve, fade) remain visible. Disabling solo restores overlays.
result: pass

### 5. Gradient Mode in Color Picker
expected: When editing a key photo solid color, the ColorPickerModal shows a Solid/Gradient toggle. Switching to Gradient mode shows gradient type selector (linear/radial/conic), angle/center controls, and a gradient preview bar. The modal is slightly wider in gradient mode.
result: issue
reported: "I have a small bug in color picker, if I drag and drop on the UI (for example for select angle text), it drag the key solid in background. Another issue in timeline no preview thumb of the gradient, with solid the thumb preview work"
severity: major

### 6. Gradient Bar Stop Editing
expected: In gradient mode, the gradient bar shows draggable color stops. Stops can be dragged to reposition. Clicking the bar adds a new stop. Right-click or double-click a stop removes it (minimum 2 stops remain). Selecting a stop lets you edit its color via the HSV picker.
result: issue
reported: "perfect but I'd like to have the pickers option from simple solid color, not only HSV picker"
severity: minor

### 7. Gradient Rendering in Preview
expected: After setting a gradient fill on a key photo (via the color picker), the preview canvas renders the gradient correctly — linear shows directional color blend at the set angle, radial shows circular color blend from center, conic shows angular sweep.
result: pass

### 8. Gradient Preview on Key Photo Cards
expected: Key photo cards in the sidebar strip show a visual gradient preview (CSS gradient) matching the assigned gradient, instead of a solid color swatch.
result: pass

### 9. Gradient Persistence (Save/Load)
expected: After setting a gradient on a key photo and saving the project (.mce), closing and reopening the project restores the gradient data — the key photo card shows the gradient preview and the color picker opens in gradient mode with the correct stops, type, and angle.
result: pass

### 10. Gradient in Export
expected: Exporting a sequence that contains a gradient key photo renders the gradient correctly in the exported output (not as a solid color or blank).
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "ColorPickerModal interactions should not propagate to elements beneath the modal"
  status: failed
  reason: "User reported: I have a small bug in color picker, if I drag and drop on the UI (for example for select angle text), it drag the key solid in background"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Timeline thumbnail should show gradient preview for gradient key photos"
  status: failed
  reason: "User reported: Another issue in timeline no preview thumb of the gradient, with solid the thumb preview work"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Gradient stop color editing should offer all color input modes (hex/rgba/hsl), not only HSV picker"
  status: failed
  reason: "User reported: perfect but I'd like to have the pickers option from simple solid color, not only HSV picker"
  severity: minor
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
