---
status: diagnosed
phase: 07-cinematic-fx-effects
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-07-SUMMARY.md]
started: 2026-03-10T13:00:00Z
updated: 2026-03-10T13:50:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Add Generator FX from Menu
expected: Open the AddLayerMenu (+ button). Menu shows categorized sections including Generators and Adjustments. Under Generators, options include Grain, Particles, Lines, Dots, Vignette. Clicking one (e.g. Grain) creates a new FX sequence visible in the timeline — NOT a layer inside the active content sequence.
result: issue
reported: "FX creation works perfectly as timeline-level sequences, but the + Add button is not at the right place — it should be in the timeline area at bottom right, not in the layers sidebar"
severity: cosmetic

### 2. Generator Renders on Canvas
expected: After adding a generator FX (e.g. Grain), the procedural effect is visible on the preview canvas overlaid on existing content. The effect covers the canvas area.
result: pass

### 3. Add Color Grade Adjustment from Menu
expected: From AddLayerMenu > Adjustments section, click Color Grade. A new FX sequence is created (timeline-level), not a layer inside the active content sequence.
result: pass

### 4. Color Grade Renders on Canvas
expected: With a Color Grade FX sequence added, the canvas visuals change based on the default color grade parameters. A tonal shift is visible on all content below.
result: issue
reported: "No work ! no color grade applied on the image"
severity: blocker

### 5. FX Layer List Styling
expected: In the layer list, generator FX layers show a pink type indicator and adjustment FX layers show an orange type indicator. FX layer rows have a tinted purple background. FX type labels (e.g. "Grain", "Color Grade") are displayed.
result: pass

### 6. FX Generator Properties Panel
expected: Select a generator FX layer (e.g. Grain). The PropertiesPanel shows effect-specific controls (sliders for parameters like density, size, intensity). Transform/Crop sections are NOT shown for FX layers.
result: issue
reported: "I can't choose a sequence FX layer ! only the last layer added has properties showed. Sequence layer can't be selected for delete, show off, or get settings"
severity: blocker

### 7. Color Grade Preset Dropdown
expected: Select the Color Grade layer. PropertiesPanel shows a preset dropdown with options including: none, warm, cool, vintage, bleachBypass, cinematic, highContrast. Selecting a preset auto-populates all 5 sliders (brightness, contrast, saturation, hue, fade) and the tint color picker.
result: skipped
reason: Can't select FX layers (blocked by test 6)

### 8. Preset Auto-Reset on Manual Adjustment
expected: With a color grade preset selected (e.g. "cinematic"), manually adjust any slider (e.g. brightness). The preset dropdown automatically resets to "none" indicating custom settings.
result: skipped
reason: Can't select FX layers (blocked by test 6)

### 9. Seed Controls for Generators
expected: Generator layers (e.g. Grain, Particles) show seed controls in the properties panel with a seed number input and a lock-seed toggle. Toggling lock-seed on makes the procedural pattern consistent across frames. Toggling it off makes the pattern vary each frame.
result: skipped
reason: Can't select FX layers (blocked by test 6)

### 10. FX Range Bars on Timeline
expected: FX sequences appear as colored range bars rendered above the content tracks on the timeline canvas. Each FX type has a distinct color. The bars show a color dot and the FX name.
result: issue
reported: "yes but I can't select the dot color near FX name for show on or show off the layer"
severity: major

### 11. FX Range Bar Drag Interaction
expected: Hovering over an FX range bar shows a grab cursor. Dragging the bar body moves the entire range (shifts inFrame/outFrame). Hovering near left/right edges shows a col-resize cursor; dragging edges resizes the range.
result: issue
reported: "All works except I can NOT drag and drop to re-order the FX layers. And when there are lots of layers vertically I have no vertical scroll to see the hidden layer sequences"
severity: major

### 12. FX Composites Across All Sequences
expected: FX sequences apply globally across all content sequences, not just the active one. Switch between content sequences — the FX overlay remains visible on the preview canvas for all of them.
result: pass

## Summary

total: 12
passed: 5
issues: 5
pending: 0
skipped: 3

## Gaps

- truth: "AddLayerMenu + button should be accessible from timeline area at bottom right"
  status: failed
  reason: "User reported: FX creation works perfectly as timeline-level sequences, but the + Add button is not at the right place — it should be in the timeline area at bottom right, not in the layers sidebar"
  severity: cosmetic
  test: 1
  root_cause: "AddLayerMenu is rendered in the layers sidebar only; no FX creation entry point exists in the timeline area"
  artifacts:
    - path: "Application/src/components/layer/AddLayerMenu.tsx"
      issue: "FX creation menu only accessible from layers sidebar + Add button"
  missing:
    - "Add FX creation button/menu to timeline bottom-right area"
  debug_session: ""

- truth: "Color Grade FX sequence visually alters canvas content with tonal shift"
  status: failed
  reason: "User reported: No work ! no color grade applied on the image"
  severity: blocker
  test: 4
  root_cause: "PreviewRenderer.renderFrame() hasDrawable pre-check skips adjustment layers (treats them as non-drawable). When FX overlay pass calls renderFrame with clearCanvas=false and only an adjustment-color-grade layer, hasDrawable is never set true, function returns early before draw loop."
  artifacts:
    - path: "Application/src/lib/previewRenderer.ts"
      issue: "hasDrawable guard (lines 92-113) does not account for adjustment-only layers in clearCanvas=false mode"
  missing:
    - "When clearCanvas is false, treat adjustment layers as drawable in the hasDrawable check (canvas already has content from prior pass)"
  debug_session: ".planning/debug/fx-colorgrade-no-render.md"

- truth: "FX sequence layers can be selected to view properties, delete, toggle visibility"
  status: failed
  reason: "User reported: I can't choose a sequence FX layer ! only the last layer added has properties showed. Sequence layer can't be selected for delete, show off, or get settings"
  severity: blocker
  test: 6
  root_cause: "Three cascading failures: (1) layerStore.layers computed only reads activeSequence, FX layers never appear in LayerList. (2) All layer CRUD in sequenceStore is scoped to activeSequenceId — mutations to FX layers silently no-op. (3) No UI path to re-select FX layers after creation."
  artifacts:
    - path: "Application/src/stores/layerStore.ts"
      issue: "layers computed = getActiveSequence()?.layers — never includes FX sequence layers"
    - path: "Application/src/components/layer/LayerList.tsx"
      issue: "Only renders layerStore.layers.value — no FX sequence awareness"
    - path: "Application/src/stores/sequenceStore.ts"
      issue: "updateLayer, removeLayer, reorderLayers all hardcoded to activeSequenceId.peek()"
  missing:
    - "LayerList must display FX layers (merged list or separate FX section from getFxSequences)"
    - "Layer mutations must be sequence-aware (accept sequenceId or auto-detect which sequence owns a layerId)"
    - "layerStore CRUD must route FX layer operations to the correct FX sequence"
  debug_session: ".planning/debug/fx-layer-selection-broken.md"

- truth: "FX range bar color dot is clickable to toggle FX sequence visibility on/off"
  status: failed
  reason: "User reported: yes but I can't select the dot color near FX name for show on or show off the layer"
  severity: major
  test: 10
  root_cause: "Color dot is purely decorative canvas drawing with no interactivity. No hit detection for FX header clicks, no visible field on Sequence type, no toggleFxVisibility store method."
  artifacts:
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      issue: "onPointerDown FX area branch lacks header click detection (no localX < TRACK_HEADER_WIDTH check)"
    - path: "Application/src/types/sequence.ts"
      issue: "Sequence type has no visible field"
    - path: "Application/src/stores/sequenceStore.ts"
      issue: "No toggleFxSequenceVisibility method"
  missing:
    - "Add visible?: boolean to Sequence type (defaults true)"
    - "Add toggleFxSequenceVisibility(id) to sequenceStore"
    - "Detect header clicks in FX area of TimelineInteraction and call toggle"
    - "Render dimmed dot and reduced bar opacity when !visible"
    - "Skip invisible FX sequences in Preview compositing"
  debug_session: ".planning/debug/fx-timeline-interaction-gaps.md"

- truth: "FX range bars can be reordered via drag-and-drop and timeline scrolls vertically when many layers exist"
  status: failed
  reason: "User reported: All works except I can NOT drag and drop to re-order the FX layers. And when there are lots of layers vertically I have no vertical scroll to see the hidden layer sequences"
  severity: major
  test: 11
  root_cause: "Two missing features: (1) FX reorder drag is completely unimplemented — no FX header drag initiation or reorder drag mode. (2) Timeline has no vertical scroll — container is overflow-hidden, canvas sized to container not content, onWheel routes deltaY to horizontal scroll only."
  artifacts:
    - path: "Application/src/components/timeline/TimelineInteraction.ts"
      issue: "No FX header drag initiation, no FX reorder drag mode, onWheel has no vertical scroll"
    - path: "Application/src/components/timeline/TimelineRenderer.ts"
      issue: "draw() has no scrollY offset, setupCanvas doesn't size to content"
    - path: "Application/src/components/timeline/TimelineCanvas.tsx"
      issue: "Container has overflow-hidden, no scroll container"
  missing:
    - "Add FX reorder drag state and header drag initiation in TimelineInteraction"
    - "Add reorderFxSequences(fromIndex, toIndex) to sequenceStore"
    - "Add scrollY signal to timelineStore, subtract from Y positions in draw()"
    - "Handle vertical scroll in onWheel, calculate total content height, clamp scrollY"
    - "Update all hit-testing methods to account for scrollY offset"
  debug_session: ".planning/debug/fx-timeline-interaction-gaps.md"
