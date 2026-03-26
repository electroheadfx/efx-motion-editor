---
status: complete
phase: 22-foundation-quick-wins
source: [22-01-SUMMARY.md, 22-02-SUMMARY.md, 22-03-SUMMARY.md]
started: 2026-03-26T23:30:00Z
updated: 2026-03-27T00:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Paint Element Reorder Undo/Redo
expected: Reorder strokes in paint mode (move up/down in the stroke list), then Ctrl+Z. The stroke order reverts to the previous arrangement. Ctrl+Shift+Z redoes the reorder.
result: pass

### 2. Motion Path Density on Short Sequences
expected: Select a layer with fewer than 30 frames and view its motion path. Dots along the path should appear noticeably denser than before (sub-frame sampling produces smoother dot distribution on short sequences).
result: issue
reported: "Not enough dense"
severity: minor

### 3. Isolation-Aware Layer Creation (Sidebar)
expected: Isolate a sequence, then open the sidebar Add Layer menu. The menu shows an "Adding to: [Sequence Name]" indicator. Creating a layer adds it to the isolated sequence, not the root.
result: issue
reported: "Adding to: [Sequence Name] is in blue, not lisible by eyes on dark background — change to yellow/orange. Big issue: when adding layer it adds to Sequence/key photo layers instead of timeline. The purpose was to add layer on timeline exactly on the selected layer from In to Out time, aligned vertically with the sequence(s). Should not add timeline layer to key photo sequence layers."
severity: blocker

### 4. Isolation-Aware Layer Creation (Timeline)
expected: Isolate a sequence, then open the timeline Add FX menu. The menu shows an "Adding to: [Sequence Name]" indicator. Creating an FX/paint/content layer adds it to the isolated sequence.
result: issue
reported: "Same issue as test 3 — it adds FX/paint/content to Sequence key photo layer instead of on timeline aligned with isolated Sequence(s)"
severity: blocker

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
passed: 8
issues: 3
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Motion path dots appear noticeably denser on short sequences (< 30 frames) due to sub-frame sampling"
  status: failed
  reason: "User reported: Not enough dense"
  severity: minor
  test: 2
  artifacts: []
  missing: []
- truth: "Adding to indicator is readable on dark background"
  status: failed
  reason: "User reported: Adding to: [Sequence Name] is in blue, not lisible on dark background — change to yellow/orange"
  severity: cosmetic
  test: 3
  artifacts: []
  missing: []
- truth: "Layer creation adds layer to timeline aligned with selected layer from In to Out time, not to key photo sequence layers"
  status: failed
  reason: "User reported: when adding layer it adds to Sequence/key photo layers instead of timeline. Purpose was to add on timeline exactly on selected layer from In to Out time, aligned vertically with sequences. Should not add to key photo sequence layers."
  severity: blocker
  test: 3
  artifacts: []
  missing: []
- truth: "Timeline Add FX menu adds FX/paint/content layer to timeline aligned with isolated sequence, not to key photo sequence layers"
  status: failed
  reason: "User reported: Same issue as test 3 — it adds FX/paint/content to Sequence key photo layer instead of on timeline aligned with isolated Sequence(s)"
  severity: blocker
  test: 4
  artifacts: []
  missing: []
