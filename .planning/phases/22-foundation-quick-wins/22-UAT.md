---
status: diagnosed
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
  root_cause: "Math.round(f) on line 63 collapses sub-frame samples to integers, and key={dot.frame} on line 186 causes Preact to deduplicate ~75% of dots. Sub-frame sampling computes correctly but results are destroyed before rendering."
  artifacts:
    - path: "Application/src/components/canvas/MotionPath.tsx"
      issue: "Line 63: Math.round(f) collapses sub-frame values; Line 186: key={dot.frame} deduplicates dots with same integer frame"
  missing:
    - "Store raw fractional frame value (or use sequential index for keys)"
    - "Change key={dot.frame} to key={index} for unique Preact keys"
    - "Adjust currentDot lookup to handle fractional frames (Math.round or nearest)"
  debug_session: ".planning/debug/motion-path-dots-not-dense.md"
- truth: "Adding to indicator is readable on dark background"
  status: failed
  reason: "User reported: Adding to: [Sequence Name] is in blue, not lisible on dark background — change to yellow/orange"
  severity: cosmetic
  test: 3
  root_cause: "Both AddLayerMenu (line 76) and AddFxMenu (line 124) use text-(--color-accent) which is blue (#2D5BE3) — unreadable on dark background"
  artifacts:
    - path: "Application/src/components/layer/AddLayerMenu.tsx"
      issue: "Line 76: blue accent color for Adding to indicator"
    - path: "Application/src/components/timeline/AddFxMenu.tsx"
      issue: "Line 124: blue accent color for Adding to indicator"
  missing:
    - "Change text-(--color-accent) to text-[#F59E0B] (amber) or text-[#F97316] (orange)"
  debug_session: ".planning/debug/isolation-add-layer-wrong-target.md"
- truth: "Layer creation adds layer to timeline aligned with selected layer from In to Out time, not to key photo sequence layers"
  status: failed
  reason: "User reported: when adding layer it adds to Sequence/key photo layers instead of timeline. Purpose was to add on timeline exactly on selected layer from In to Out time, aligned vertically with sequences. Should not add to key photo sequence layers."
  severity: blocker
  test: 3
  root_cause: "addLayerToSequence() pushes layers into sequence's internal layers[] array (sub-layers), not onto the timeline. Should create a NEW timeline-level sequence (kind=fx or content-overlay) with inFrame/outFrame matching the isolated content sequence's frame range from trackLayouts."
  artifacts:
    - path: "Application/src/stores/sequenceStore.ts"
      issue: "Line 643-662: addLayerToSequence adds to internal layers[] — wrong target for isolation-mode"
    - path: "Application/src/components/layer/AddLayerMenu.tsx"
      issue: "Routes to addLayerToSequence when isolated — should create timeline-level sequence"
    - path: "Application/src/components/views/ImportedView.tsx"
      issue: "Lines 95-108, 161-174, 229-244: all handlers route to addLayerToSequence when targetSequenceId set"
  missing:
    - "Replace addLayerToSequence calls with createFxSequence/createContentOverlaySequence with computed inFrame/outFrame"
    - "Compute isolated sequence frame range from trackLayouts"
    - "Repurpose targetSequenceId semantic from 'add inside' to 'align with'"
  debug_session: ".planning/debug/isolation-add-layer-wrong-target.md"
- truth: "Timeline Add FX menu adds FX/paint/content layer to timeline aligned with isolated sequence, not to key photo sequence layers"
  status: failed
  reason: "User reported: Same issue as test 3 — it adds FX/paint/content to Sequence key photo layer instead of on timeline aligned with isolated Sequence(s)"
  severity: blocker
  test: 4
  root_cause: "Same root cause as test 3 — AddFxMenu lines 60-64 and 103-104 call addLayerToSequence when isolated, pushing into internal layers[] instead of creating timeline-level sequences"
  artifacts:
    - path: "Application/src/components/timeline/AddFxMenu.tsx"
      issue: "Lines 60-64, 103-104: handleAddFxLayer and handleAddPaintLayer route to addLayerToSequence — should route to createFxSequence with computed inFrame/outFrame"
  missing:
    - "Route to createFxSequence with inFrame/outFrame from isolated sequence's trackLayouts range"
  debug_session: ".planning/debug/isolation-add-layer-wrong-target.md"
