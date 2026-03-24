---
status: partial
phase: 17-enhancements
source: [17-VERIFICATION.md]
started: 2026-03-24T12:20:00Z
updated: 2026-03-24T12:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Collapse/expand visual behavior
expected: Key photo strip animates closed (max-height transitions to 0). Clicking again or switching sequences expands it.
result: [pending]

### 2. Solo mode — overlay strip behavior in preview
expected: All overlay layers and FX disappear from preview. Toggle off restores overlays.
result: [pending]

### 3. Gradient fill — visual rendering in preview canvas
expected: Preview canvas renders the correct gradient (linear/radial/conic) matching stop positions/colors.
result: [pending]

### 4. ColorPickerModal drag isolation
expected: Background key photo cards do NOT move while dragging inside the modal.
result: [pending]

### 5. Gradient stop HEX/RGBA/HSL input
expected: Mode tab buttons (HEX, RGBA, HSL) and text input fields appear in gradient mode. Entering a hex value updates the selected stop's color.
result: [pending]

### 6. Timeline gradient thumbnail
expected: Timeline cell shows gradient preview instead of empty placeholder.
result: [pending]

### 7. Project file round-trip with gradients
expected: Gradient fills, stop colors, positions, type, angle, and center values survive save/load cycle.
result: [pending]

### 8. Backward compatibility — open v12 project
expected: File opens without errors; solid entries retain their solid colors; no crash or data loss.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
