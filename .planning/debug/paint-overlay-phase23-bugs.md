---
status: diagnosed
trigger: "Phase 23 UAT bugs: handle offset, bbox undo, edge scale, small handles"
created: 2026-03-27T00:00:00Z
updated: 2026-03-27T00:00:00Z
---

## Current Focus

hypothesis: Four distinct root causes identified for all four bug clusters
test: Code analysis of coordinate systems, rendering, hit-testing, undo closures, scale math
expecting: N/A - diagnosis complete
next_action: Apply fixes per cluster

## Symptoms

expected: Handles clickable at visual position; bbox refreshes on undo; edge scale is linear; edge handles visible
actual: Handles offset from visual; bbox stale after undo; edge scale exponential; edge handles too small
errors: No runtime errors - all are logic/coordinate bugs
reproduction: Select element in paint mode, try interacting with handles
started: Phase 23 implementation

## Eliminated

(none - direct code analysis)

## Evidence

- timestamp: 2026-03-27
  checked: Handle RENDERING (lines 558-609) vs handle HIT-TESTING (lines 158-189, 670-690, 929-959)
  found: CRITICAL MISMATCH - rendering draws handles on temp canvas in project-space; hit-testing uses getProjectPoint which converts client->project. But the temp canvas is CSS-scaled via the parent transform, so visual positions on screen differ from project-space coordinates when zoom != 1 or pan != 0.
  implication: Root cause of Cluster A

- timestamp: 2026-03-27
  checked: Undo closures (lines 1266-1284, 1370-1389) and paintVersion/selection invalidation
  found: Undo/redo callbacks call paintStore.markDirty + paintVersion++ + invalidateFrameFxCache but do NOT call requestPreview() or renderLivePreview(). The bounding box is drawn by renderLivePreview() on the temp canvas. It only re-renders via the selectedStrokeIds useEffect (line 1669-1673) — but undo doesn't change selectedStrokeIds.
  implication: Root cause of Cluster B

- timestamp: 2026-03-27
  checked: Edge scale math (lines 1034-1103) vs corner scale math (lines 1104-1137)
  found: Edge scale applies absolute scaleX/Y from snapshot-to-current every frame, but operates on ALREADY-SCALED points (mutated in-place). Corner scale is incremental (delta-based). Edge scale is snapshot-anchored but never restores from snapshot before scaling.
  implication: Root cause of Cluster C

- timestamp: 2026-03-27
  checked: Edge handle radius (line 573)
  found: EDGE_HANDLE_RADIUS = 3, making 6px diameter circles (tiny on high-DPI)
  implication: Root cause of Cluster D

## Resolution

root_cause: See detailed analysis per cluster below
fix: See suggested fixes per cluster below
verification: pending
files_changed: []
