---
status: investigating
trigger: "Keyframe diamonds and properties disappear on timeline interaction"
created: 2026-03-15T00:00:00Z
updated: 2026-03-15T00:00:00Z
---

## Current Focus

hypothesis: Timeline click-to-seek on content track area clears selectedLayerId via layerStore.setSelected(null), which destroys the signal chain that feeds keyframe diamond rendering and PropertiesPanel keyframe UI.
test: Trace what happens on pointerdown in content track area in TimelineInteraction.ts
expecting: layerStore.setSelected(null) is called, which clears activeLayerKeyframes computed, removing diamonds
next_action: Confirm the code path at lines 419-433 of TimelineInteraction.ts

## Symptoms

expected: Keyframe diamonds persist on timeline during scrubbing, clicking, and interaction
actual: Any timeline interaction (scrub, click diamond, click track) causes diamonds and properties panel keyframe UI to disappear
errors: None (visual/reactivity bug)
reproduction: Select content layer with keyframes in sidebar -> see diamonds -> click/scrub timeline -> diamonds gone
started: Since keyframe feature was added

## Eliminated

## Evidence

- timestamp: 2026-03-15T00:01:00Z
  checked: TimelineInteraction.ts onPointerDown (lines 419-433)
  found: When clicking in the content track area (not ruler, not FX, not keyframe hit, not header), lines 425-429 explicitly call layerStore.setSelected(null) and uiStore.selectLayer(null) to "clear any selected FX layer so Delete targets the sequence"
  implication: This clears the selected layer which is the root signal driving activeLayerKeyframes computed, diamond rendering, and PropertiesPanel keyframe UI

- timestamp: 2026-03-15T00:01:00Z
  checked: TimelineInteraction.ts onPointerDown ruler/playhead area (lines 412-433)
  found: The else branch at line 419 handles click-to-seek on track area, and ALSO the ruler/playhead branch at 412-418 starts dragging. When dragging starts on ruler and pointer moves into track area, onPointerMove just seeks. But the initial click in track area already clears selection.
  implication: Even clicking in the track area to seek will clear layer selection, causing diamonds to vanish.

- timestamp: 2026-03-15T00:01:30Z
  checked: TimelineInteraction.ts content track header clicks (lines 378-410)
  found: Lines 388-390 also call layerStore.setSelected(null) and uiStore.selectLayer(null) when clicking on track headers
  implication: Track header clicks also clear layer selection

## Resolution

root_cause: In TimelineInteraction.ts onPointerDown, two code paths unconditionally call layerStore.setSelected(null) and uiStore.selectLayer(null):

1. **Content track click-to-seek** (lines 419-433): When clicking anywhere on the track area that isn't ruler, header, FX, or a keyframe diamond, lines 425-429 clear both layerStore.selectedLayerId and uiStore layer selection. This was added with the comment "Clear any selected FX layer so Delete targets the sequence" but it clears ALL layer selection, not just FX.

2. **Content track header click** (lines 384-410): Lines 388-390 do the same clearing when clicking on track headers.

The signal chain that breaks:
- `layerStore.selectedLayerId` -> null
- `keyframeStore.getSelectedContentLayer()` returns null
- `keyframeStore.activeLayerKeyframes` computed returns []
- TimelineCanvas effect: `selectedLayerKeyframes` becomes undefined
- `drawKeyframeDiamonds()` returns early (no keyframes to draw)
- PropertiesPanel: `selectedLayer` is null, shows "Select a layer to edit transform"

Secondary cascade effect: Once diamonds disappear due to cleared selection, subsequent clicks on the same spot fall through `keyframeHitTest()` (which depends on non-empty `activeLayerKeyframes`), landing in the same selection-clearing code path, making recovery impossible without re-selecting from the sidebar.

The core issue: these code paths need to only clear **FX layer** selection when the clicked track is a content track, not unconditionally null out the layer selection. When a content layer is selected and the user clicks on the same content track (or any content track), the selected content layer should be preserved (or updated to the correct content layer for that track).

fix:
verification:
files_changed: []
