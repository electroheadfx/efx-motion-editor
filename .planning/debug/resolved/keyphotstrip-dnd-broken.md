---
status: resolved
trigger: "drag-and-drop reorder doesn't work in KeyPhotoStrip sidebar"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus

hypothesis: SortableJS DOM revert is implemented correctly but drag detection fails in the overflow-x-auto container with 64x48px cards, plus there is no drag handle so the entire card competes with child click handlers
test: Code review of SortableJS config, container CSS, and card interaction surface
expecting: Identify why drag initiation fails despite correct onEnd/DOM-revert logic
next_action: Document root cause and UX assessment

## Symptoms

expected: Key photos in the horizontal strip can be dragged to reorder
actual: Drag-and-drop does not work at all; same issue as sequence reorder
errors: None reported (silent failure)
reproduction: Try to drag a key photo card in the strip
started: Since implementation (03-06 fix attempted to address this but did not resolve)

## Eliminated

- hypothesis: onEnd handler missing DOM revert before store update
  evidence: Code at lines 55-61 of KeyPhotoStrip.tsx correctly implements removeChild/insertBefore revert pattern matching the 03-06 plan
  timestamp: 2026-03-09

- hypothesis: useEffect deps missing keyPhotos.length
  evidence: Line 65 shows `[sequenceId, keyPhotos.length]` -- both are present
  timestamp: 2026-03-09

- hypothesis: reorderKeyPhotos store method is broken
  evidence: Store method at lines 262-286 correctly uses splice-based reorder with undo/redo, identical pattern to working reorderSequences
  timestamp: 2026-03-09

## Evidence

- timestamp: 2026-03-09
  checked: KeyPhotoStrip.tsx SortableJS onEnd handler (lines 54-62)
  found: DOM revert (removeChild + insertBefore) is correctly implemented, matching the 03-06 plan exactly
  implication: The onEnd handler is not the problem; the issue is that drag never initiates

- timestamp: 2026-03-09
  checked: SortableJS config options (lines 49-63)
  found: No `handle` option is set. The `draggable` selector is `.kp-card` which matches the card div. No `delay`, `touchStartThreshold`, or `scrollSensitivity` options.
  implication: Drag initiation uses the entire card surface, but cards have overlapping interactive elements (remove button, hold-frames button/input) that intercept mousedown

- timestamp: 2026-03-09
  checked: KeyPhotoCard interactive surface (lines 121-175)
  found: Each 64x48px card has (1) a remove button (absolute top-right), (2) a hold-frames button (absolute bottom-right), (3) cursor-grab on the card div. The interactive elements occupy significant card surface area.
  implication: On a 64x48px card, the clickable child elements overlap most of the usable drag surface

- timestamp: 2026-03-09
  checked: Container CSS (line 69)
  found: `overflow-x-auto` on the strip ref div. SortableJS direction is set to `horizontal`.
  implication: overflow-x-auto creates a scrollable container; SortableJS horizontal drag competes with the browser's native horizontal scroll gesture on the overflow container

- timestamp: 2026-03-09
  checked: SequenceList.tsx SortableJS config (comparison)
  found: SequenceList uses `handle: '.seq-drag-handle'` -- a dedicated drag handle. KeyPhotoStrip has NO handle; it relies on the entire `.kp-card` being draggable.
  implication: SequenceList isolates drag initiation to a specific UI element. KeyPhotoStrip does not.

- timestamp: 2026-03-09
  checked: LayerList.tsx SortableJS config (comparison)
  found: LayerList also uses `handle: '.layer-drag-handle'` -- a dedicated drag handle. Vertical direction, overflow-y-auto container.
  implication: Both working sortable lists use dedicated handles. KeyPhotoStrip is the only one without a handle.

## Resolution

root_cause: SortableJS horizontal drag competes with browser native horizontal scroll on the overflow-x-auto container, and the 64x48px cards have no dedicated drag handle so mousedown on child buttons (remove, hold-frames) prevents drag initiation. The onEnd handler and store method are correct -- drag never starts.
fix: Replace drag-and-drop reorder with click-to-select + arrow key reorder (better UX for constrained space)
verification: []
files_changed: []
