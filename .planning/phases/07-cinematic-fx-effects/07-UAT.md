---
status: complete
phase: 07-cinematic-fx-effects
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md]
started: 2026-03-10T11:10:00Z
updated: 2026-03-10T11:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Add Generator Layer from Menu
expected: Open the AddLayerMenu (+ button). Menu shows categorized sections: Content, Overlays, Generators, Adjustments. Under Generators, options include Grain, Particles, Lines, Dots, Vignette. Clicking one (e.g. Grain) adds a new FX layer to the layer list.
result: issue
reported: "FX layers are added inside individual sequence layers (per-sequence), but they should be timeline-level sequences that apply across ALL sequences. FX should be added as global timeline sequences, not per-sequence layers."
severity: blocker

### 2. Generator Layer Renders on Canvas
expected: After adding a generator layer (e.g. Grain), the procedural effect is visible on the preview canvas overlaid on existing content. The effect should cover the canvas area.
result: pass

### 3. Add Color Grade Adjustment Layer
expected: From AddLayerMenu > Adjustments section, add a Color Grade layer. It appears in the layer list as an adjustment layer.
result: issue
reported: "Layer appears with name and parameters but the effect is not visible on canvas - no color grade rendering"
severity: major

### 4. Color Grade Renders on Canvas
expected: With a Color Grade layer added, the canvas visuals change based on the default color grade parameters (brightness, contrast, saturation, etc.). The effect is visible as a tonal shift on the content below.
result: issue
reported: "no work, no effect, no tonal shift"
severity: blocker

### 5. FX Layer List Styling
expected: In the layer list, generator FX layers show a pink type indicator and adjustment FX layers show an orange type indicator. FX layer rows have a tinted purple background distinguishing them from content layers. FX type labels (e.g. "Grain", "Color Grade") are displayed.
result: pass

### 6. FX Generator Properties Panel
expected: Select a generator FX layer (e.g. Grain). The PropertiesPanel shows effect-specific controls (sliders for parameters like density, size, intensity) and seed controls. Transform/Crop sections are NOT shown for FX layers.
result: pass

### 7. Color Grade Preset Dropdown
expected: Select the Color Grade layer. PropertiesPanel shows a preset dropdown with options including: none, warm, cool, vintage, bleachBypass, cinematic, highContrast. Selecting a preset auto-populates all 5 sliders (brightness, contrast, saturation, hue, fade) and the tint color picker.
result: pass

### 8. Preset Auto-Reset on Manual Adjustment
expected: With a color grade preset selected (e.g. "cinematic"), manually adjust any slider (e.g. brightness). The preset dropdown automatically resets to "none" indicating custom settings.
result: pass

### 9. In/Out Frame Controls
expected: FX layers show In/Out frame number inputs in the properties panel. Setting an in-frame and out-frame clips the layer's visibility to only that frame range during playback. The layer list metadata line shows the in/out range.
result: issue
reported: "In/out frame controls should NOT be on per-layer properties. Should only be on timeline sequences with visual range clipping on the timeline UI."
severity: major

### 10. Seed Controls for Generators
expected: Generator layers (e.g. Grain, Particles) show seed controls in the properties panel with a seed number input and a lock-seed toggle. Toggling lock-seed on makes the procedural pattern consistent across frames. Toggling it off makes the pattern vary each frame.
result: pass

## Summary

total: 10
passed: 6
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "FX layers should be added as timeline-level sequences that apply across all content sequences"
  status: failed
  reason: "User reported: FX layers are added inside individual sequence layers (per-sequence), but they should be timeline-level sequences that apply across ALL sequences. FX should be added as global timeline sequences, not per-sequence layers."
  severity: blocker
  test: 1
  artifacts: []
  missing: []

- truth: "Color Grade adjustment layer should visually alter canvas content"
  status: failed
  reason: "User reported: Layer appears with name and parameters but no effect visible on canvas. No color grade rendering, no tonal shift."
  severity: blocker
  test: 3-4
  artifacts: []
  missing: []

- truth: "In/Out frame clipping should be on timeline sequences, not per-layer properties"
  status: failed
  reason: "User reported: In/out frame controls should NOT be on per-layer properties. Should only be on timeline sequences with visual range clipping on the timeline UI."
  severity: major
  test: 9
  artifacts: []
  missing: []
