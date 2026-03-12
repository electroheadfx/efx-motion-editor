---
status: investigating
trigger: "Investigate zoom panning and bounds issues in the EFX Motion Editor"
created: 2026-03-12T00:00:00Z
updated: 2026-03-12T00:00:00Z
---

## Current Focus

hypothesis: Multiple root causes across pan bounds, drag-pan input, and cursor-anchored zoom math
test: Static code analysis of canvasStore + CanvasArea
expecting: Confirm no bounds clamping, no left-click drag, and broken zoom anchor math
next_action: Document all three root causes with evidence

## Symptoms

expected: Zooming keeps image centered/anchored to cursor; user can pan with click-drag; image stays within visible bounds
actual: Image drifts off-screen during zoom; no left-click pan; toolbar +/- don't re-center offset image
errors: N/A (behavioral bugs, no runtime errors)
reproduction: Pinch-to-zoom or Cmd+scroll on canvas; try to drag canvas; use toolbar +/- after panning
started: Since zoom/pan implementation (09-01/09-02 features)

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-12T00:01:00Z
  checked: canvasStore.setPan() and all pan setters
  found: Zero bounds clamping anywhere - panX/panY accept any value without constraint
  implication: Image can be panned completely off-screen with no limit

- timestamp: 2026-03-12T00:02:00Z
  checked: CanvasArea handlePointerDown
  found: Pan drag gated by `e.button !== 1` (middle-click only). No left-click or grab-cursor panning.
  implication: Users without a middle mouse button (trackpad users) have no way to pan at all

- timestamp: 2026-03-12T00:03:00Z
  checked: canvasStore.setSmoothZoom() cursor-anchored math
  found: Formula `panX.value = panX.value * scale + cursorX * (1 - scale) / clamped` divides by clamped (new zoom) which is incorrect for the transform order used
  implication: Cursor-anchored zoom drifts because the pan offset formula doesn't match the CSS transform

- timestamp: 2026-03-12T00:04:00Z
  checked: CSS transform in CanvasArea line 145
  found: Transform is `scale(zoom) translate(panX, panY)` - scale is applied FIRST, then translate. This means panX/panY are in scaled space.
  implication: The pan math in setSmoothZoom divides by clamped which double-accounts for the scale, causing drift

- timestamp: 2026-03-12T00:05:00Z
  checked: canvasStore.zoomIn() / zoomOut() pan adjustment
  found: `panX.value = panX.value * scale` - scales existing pan proportionally but does NOT re-center or clamp
  implication: If image is already offset, toolbar zoom preserves and amplifies the offset

- timestamp: 2026-03-12T00:06:00Z
  checked: CanvasArea cursor style (line 140)
  found: `cursor: dragRef.current.isDragging ? 'grabbing' : 'default'` - always shows default cursor, never shows grab hint
  implication: Even if panning existed for left-click, there's no visual affordance

## Resolution

root_cause: See detailed analysis below (3 distinct root causes)
fix: (pending)
verification: (pending)
files_changed: []
