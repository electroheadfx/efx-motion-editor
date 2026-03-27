---
status: investigating
trigger: "Undo delete restores stroke but StrokeList and canvas don't refresh properly after undo"
created: 2026-03-27T16:35:00Z
updated: 2026-03-27T16:35:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: "The undo closure in `removeElement` does not call `_notifyVisualChange`, so `paintVersion` is not bumped and no re-render is triggered"
test: "Compare `removeElement` undo closure with other methods like `reorderElements`, `moveElementsForward` that DO trigger re-renders on undo"
expecting: "All methods that mutate elements should call `_notifyVisualChange` in their undo closure"
next_action: "Confirm pattern and document root cause"

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: After deleting a stroke and pressing Ctrl+Z to undo, the stroke should reappear in both the canvas and the StrokeList
actual: Undo restores the stroke data (element is back in the array) but StrokeList and canvas don't visually refresh
errors: None (just visual non-update)
reproduction: Test 12 in UAT - delete a stroke then press Ctrl+Z
started: Discovered during UAT

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: "paintVersion is not subscribed to in StrokeList"
  evidence: "Line 31 in StrokeList.tsx: `const _pv = paintStore.paintVersion.value; // subscribe to re-renders` - it IS subscribed"
  timestamp: 2026-03-27T16:35:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-03-27T16:35:00Z
  checked: "StrokeList.tsx line 31 - paintVersion subscription"
  found: "Component subscribes to `paintStore.paintVersion.value` to trigger re-renders"
  implication: "If paintVersion doesn't bump, component won't re-render"

- timestamp: 2026-03-27T16:35:00Z
  checked: "paintStore.ts `removeElement` method (lines 134-155)"
  found: "undo closure only does `f.elements.splice(idx, 0, removed)` - NO call to `_notifyVisualChange`"
  implication: "paintVersion is NOT bumped when undo is executed"

- timestamp: 2026-03-27T16:35:00Z
  checked: "paintStore.ts `reorderElements` method (lines 273-302)"
  found: "undo closure DOES call `_notifyVisualChange(layerId, frame)` AND `refreshFrameFx`"
  implication: "Other mutations DO trigger proper re-render on undo - this is the expected pattern"

- timestamp: 2026-03-27T16:35:00Z
  checked: "paintStore.ts `moveElementsForward` (lines 158-185), `moveElementsBackward` (188-215), `moveElementsToFront` (218-243), `moveElementsToBack` (246-271)"
  found: "ALL call `_notifyVisualChange(layerId, frame)` in their undo closures"
  implication: "Pattern consistency: all element mutations except `removeElement` properly notify on undo"

- timestamp: 2026-03-27T16:35:00Z
  checked: "paintStore.ts `setElementVisibility` method (lines 304-337)"
  found: "undo/redo both call `_notifyVisualChange(layerId, frame)` AND `invalidateFrameFxCache`"
  implication: "Visibility toggle (Test 13) works because it notifies - matches pattern"

- timestamp: 2026-03-27T16:35:00Z
  checked: "history.ts undo function (lines 50-59)"
  found: "undo() calls entry.undo() inside a `batch` - the undo closure is executed but without any notification"
  implication: "The undo closure itself is responsible for triggering any re-renders"

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: "The `removeElement` undo closure does not call `_notifyVisualChange(layerId, frame)`, so `paintVersion` is not bumped after undo. Since `StrokeList` subscribes to `paintVersion` for reactivity, and the canvas rendering likely also depends on it, the restored stroke is not visually shown."
fix: "Add `_notifyVisualChange(layerId, frame)` call to the undo closure in `removeElement`, and potentially `invalidateFrameFxCache` + `refreshFrameFx` for full cache rebuild"
verification: ""
files_changed: ["Application/src/stores/paintStore.ts"]
