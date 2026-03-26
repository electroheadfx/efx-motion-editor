---
status: passed
phase: 22-foundation-quick-wins
source: [22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md, 22-04-SUMMARY.md, 22-05-SUMMARY.md]
started: 2026-03-26T23:30:00Z
updated: 2026-03-27T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Paint Element Reorder Undo/Redo
expected: Reorder strokes in paint mode (move up/down in the stroke list), then Ctrl+Z. The stroke order reverts to the previous arrangement. Ctrl+Shift+Z redoes the reorder.
result: pass

### 2. Motion Path Density on Short Sequences
expected: Select a layer with fewer than 30 frames and view its motion path. Dots along the path should appear noticeably denser than before (sub-frame sampling produces smoother dot distribution on short sequences).
result: pass
resolved_by: 22-04

### 3. Isolation-Aware Layer Creation (Sidebar)
expected: Isolate a sequence, then open the sidebar Add Layer menu. The menu shows an "Adding to: [Sequence Name]" indicator. Creating a layer adds it to the isolated sequence, not the root.
result: pass
resolved_by: 22-05

### 4. Isolation-Aware Layer Creation (Timeline)
expected: Isolate a sequence, then open the timeline Add FX menu. The menu shows an "Adding to: [Sequence Name]" indicator. Creating an FX/paint/content layer adds it to the isolated sequence.
result: pass
resolved_by: 22-05

### 5. Paint Panel Section Headers Removed
expected: Enter paint mode. The sidebar panel should NOT display the old section headers (PAINT BACKGROUND, BRUSH STYLE, STROKE, ACTIONS). Controls flow without heavy dividers.
result: pass

### 6. Paint Panel 2-Column Grid Layout
expected: In paint mode, brush controls (like brush type, size) and selection tools display in a compact 2-column grid layout rather than stacked vertically.
result: pass

### 7. Clear Brushes on Brush Color Row
expected: In paint mode, a "Clear Brushes" button appears on the same row as the Brush Color control.
result: pass

### 8. Auto-Flatten on Exit Paint Mode
expected: Paint some strokes on a frame, then exit paint mode. The frame auto-flattens immediately without needing to click a manual "Flatten Frame" button.
result: pass

### 9. Exit Paint Mode Button Styling
expected: The "Exit Paint Mode" button appears with a dark blue background and an arrow (→) icon. On hover, the button turns orange.
result: pass

### 10. Background Color and Show BG Sequence Row
expected: In paint mode, "Background Color" and "Show BG Sequence" checkbox appear on the same row. The checkbox wrapper has a gray background when unchecked.
result: pass

### 11. Canvas Toolbars Positioned Above Canvas
expected: Canvas toolbars (paint tools, etc.) appear above the canvas as separate elements, not overlapping the canvas content. There is visible spacing/padding between toolbars and canvas.
result: pass

## Summary

total: 11
passed: 11
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

All gaps resolved by plans 22-04 and 22-05.
