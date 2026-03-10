---
status: diagnosed
trigger: "FX sequence layers cannot be selected in the UI. Only the last added layer shows properties. Users can't select FX layers for delete, visibility toggle, or settings."
created: 2026-03-10T14:00:00Z
updated: 2026-03-10T14:30:00Z
---

## Current Focus

hypothesis: FX layers live in separate FX sequences but the LayerList only renders layers from the active content sequence. Selection works (layerStore.setSelected sets the ID), but the LayerList never shows FX layers to click on. The "last added layer shows properties" symptom is because layerStore.setSelected is called at creation time, and PropertiesPanel searches all sequences. But subsequent selection via clicking in the LayerList is impossible because FX layers are not rendered there. Additionally, layerStore operations (updateLayer, remove, reorder) are all scoped to activeSequenceId, so even if selection worked, mutations would fail silently.
test: Trace data flow for FX layer creation through display and interaction
expecting: Multiple disconnected failures in the FX layer interaction pipeline
next_action: Return structured diagnosis

## Symptoms

expected: After adding an FX layer (generator or adjustment), it should appear in the layer list, be clickable to select it, and respond to visibility toggle, property edits, and delete actions.
actual: FX layers cannot be selected after initial creation. Only the most recently added FX layer shows properties (because setSelected is called during creation). Clicking in the layer list does not show FX layers at all. Delete and visibility toggle silently fail.
errors: No runtime errors - silent failures throughout the pipeline
reproduction: 1) Have an active content sequence. 2) Add any FX layer (e.g., Film Grain) from AddLayerMenu. 3) Click elsewhere to deselect. 4) Try to click the FX layer to re-select it - it is not shown in LayerList.
started: Phase 07 implementation - inherent in the architectural split between FX sequences and content sequences

## Eliminated

(none - root cause was immediately identifiable from code review)

## Evidence

- timestamp: 2026-03-10T14:05:00Z
  checked: layerStore.ts layers computed (line 8-11)
  found: `layers = computed(() => sequenceStore.getActiveSequence()?.layers ?? [])` -- only returns layers from the active sequence. FX sequences are never the active sequence (createFxSequence does not call setActive). Therefore FX layers are NEVER included in layerStore.layers.
  implication: LayerList, which renders layerStore.layers.value, will never display FX layers.

- timestamp: 2026-03-10T14:07:00Z
  checked: LayerList.tsx (line 11-16)
  found: `const layers = layerStore.layers.value` then `const displayLayers = [...layers].reverse()` -- exclusively renders the active sequence's layers. No code fetches or appends FX sequence layers.
  implication: FX layers are invisible in the layer list UI. Users have no way to click on them.

- timestamp: 2026-03-10T14:09:00Z
  checked: AddLayerMenu.tsx handleAddFxLayer (line 292-315)
  found: Creates FX layer, calls `sequenceStore.createFxSequence(name, fxLayer, totalFrames.peek())` to put it in a new FX sequence. Then calls `layerStore.setSelected(layerId)` and `uiStore.selectLayer(layerId)`. The selection signal IS set correctly at creation time.
  implication: Selection works at creation moment because setSelected is a simple signal write. But the layer cannot be re-selected later because it's not displayed in LayerList.

- timestamp: 2026-03-10T14:11:00Z
  checked: PropertiesPanel.tsx (line 473-484)
  found: Searches ALL sequences for the selected layer ID: `for (const seq of sequenceStore.sequences.value) { const found = seq.layers.find(...) }`. This correctly finds FX layers in FX sequences.
  implication: PropertiesPanel shows properties for the initially-selected FX layer. But once selection is lost, it cannot be regained through the UI.

- timestamp: 2026-03-10T14:13:00Z
  checked: layerStore.ts updateLayer (line 30-32) -> sequenceStore.updateLayer (line 435-461)
  found: `sequenceStore.updateLayer` operates on `activeSequenceId.peek()` only. It maps over sequences but only modifies layers in the sequence matching activeSequenceId. FX layers are in FX sequences, which are never the active sequence.
  implication: All property edits via layerStore.updateLayer silently fail for FX layers. The blend mode, opacity, visibility, and source parameter changes in PropertiesPanel do nothing.

- timestamp: 2026-03-10T14:15:00Z
  checked: layerStore.ts remove (line 24-27) -> sequenceStore.removeLayer (line 411-432)
  found: `sequenceStore.removeLayer` also uses `activeSequenceId.peek()` to scope which sequence's layers to filter. FX layers won't be found in the active content sequence.
  implication: Delete button in LayerList (if it were visible) would silently fail for FX layers.

- timestamp: 2026-03-10T14:17:00Z
  checked: sequenceStore.ts createFxSequence (line 163-191)
  found: Creates the FX sequence and adds it to sequences array, but does NOT call `activeSequenceId.value = seq.id`. The active sequence remains the content sequence.
  implication: This is correct behavior (we don't want FX sequences to become the "active" sequence for content editing), but it means all layerStore CRUD operations that rely on activeSequenceId will never find FX layers.

## Resolution

root_cause: Three cascading failures prevent FX layer interaction:

1. **DISPLAY FAILURE (LayerList):** `layerStore.layers` is computed exclusively from `sequenceStore.getActiveSequence()`. FX layers live in FX sequences (kind: 'fx'), which are never the active sequence. Therefore FX layers never appear in the LayerList component and users cannot click on them.

2. **MUTATION FAILURE (layerStore CRUD):** All layer mutation methods (updateLayer, removeLayer, reorderLayers) in sequenceStore are scoped to `activeSequenceId.peek()`. Since FX layers belong to FX sequences (not the active content sequence), all mutations silently fail -- the layer ID is not found in the active sequence's layers array, so the map/filter operations produce no change.

3. **SELECTION PERSISTENCE FAILURE:** `layerStore.setSelected(layerId)` works as a raw signal write (it just stores the ID string), so selection works at creation time. But since FX layers are not displayed in LayerList, there is no UI path to re-select them after any other interaction clears the selection.

fix: (not applied - diagnosis only)
verification: (not applicable)
files_changed: []
