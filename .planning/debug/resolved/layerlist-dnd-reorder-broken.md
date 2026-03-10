---
status: resolved
trigger: "Drag-and-drop layer reorder does NOT work in the LayerList component"
created: 2026-03-10T00:00:00Z
updated: 2026-03-10T00:00:00Z
---

## Current Focus

hypothesis: LayerList SortableJS onEnd does NOT revert DOM mutation before calling store update, causing Preact VDOM/DOM mismatch
test: Compare LayerList.tsx onEnd vs KeyPhotoStrip.tsx onEnd
expecting: KeyPhotoStrip reverts DOM; LayerList does not
next_action: Return diagnosis

## Symptoms

expected: Dragging a layer row reorders it in the layer stack
actual: Drag-and-drop does not work (DOM/VDOM mismatch causes visual glitches or snap-back)
errors: No console errors likely - silent VDOM mismatch
reproduction: Drag any non-base layer in the LayerList
started: Since implementation

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-10T00:00:00Z
  checked: KeyPhotoStrip.tsx onEnd handler (lines 61-68)
  found: |
    It reverts the SortableJS DOM mutation BEFORE calling store update:
      from.removeChild(item);
      from.insertBefore(item, from.children[oldIndex] ?? null);
      sequenceStore.reorderKeyPhotos(sequenceId, oldIndex, newIndex);
  implication: This is the KEY PHOTOS working pattern - SortableJS mutates DOM directly, but Preact also manages the DOM via VDOM diffing. If SortableJS moves a DOM node and THEN the store update triggers a Preact re-render, Preact's diff sees the DOM already changed and gets confused. Reverting lets Preact do the DOM update itself.

- timestamp: 2026-03-10T00:00:00Z
  checked: LayerList.tsx onEnd handler (lines 32-38)
  found: |
    It does NOT revert DOM mutation - just calls layerStore.reorder(from, to) directly:
      layerStore.reorder(from, to);
  implication: SortableJS mutates the DOM (moves the dragged element), then Preact re-renders with the new order but finds the DOM already modified by SortableJS. This VDOM/DOM mismatch is the root cause.

- timestamp: 2026-03-10T00:00:00Z
  checked: KeyPhotoStrip also uses forceFallback: true
  found: KeyPhotoStrip has forceFallback:true and fallbackClass - LayerList does not
  implication: forceFallback can help with framework compatibility but the DOM revert is the critical fix

## Resolution

root_cause: |
  SortableJS directly mutates the DOM when a drag completes (moves the dragged element to its new position).
  LayerList.tsx does NOT revert this DOM mutation before calling layerStore.reorder().
  When the store update triggers a Preact re-render, Preact's VDOM diffing algorithm sees the DOM
  already modified by SortableJS and produces incorrect/duplicate/missing nodes.

  The KeyPhotoStrip.tsx component has the correct pattern: it reverts the SortableJS DOM mutation
  (from.removeChild(item) + from.insertBefore(item, ...)) BEFORE calling the store update,
  allowing Preact to be the sole owner of DOM mutations.

fix: Apply the KeyPhotoStrip DOM-revert pattern to LayerList.tsx onEnd handler
verification: (pending)
files_changed: []
