---
status: passed
phase: 07-cinematic-fx-effects
source: [07-01-SUMMARY.md, 07-02-SUMMARY.md, 07-03-SUMMARY.md, 07-04-SUMMARY.md, 07-05-SUMMARY.md, 07-06-SUMMARY.md, 07-07-SUMMARY.md, 07-08-SUMMARY.md, 07-09-SUMMARY.md, 07-10-SUMMARY.md]
started: 2026-03-10T14:00:00Z
updated: 2026-03-10T15:30:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 16
name: Timeline Vertical Scroll
result: pass

## Tests

### 1. Add Generator FX from Menu
expected: Open the + FX button in the timeline toolbar. Menu shows categorized sections including Generators and Adjustments. Under Generators, options include Grain, Particles, Lines, Dots, Vignette. Clicking one creates a new FX sequence visible in the timeline as a colored range bar above the content tracks. FX does NOT appear in the Layers sidebar.
result: pass (fixed — FX moved from Layers sidebar to timeline-only + FX button)

### 2. Generator Renders on Canvas
expected: After adding a generator FX (e.g. Grain), the procedural effect is visible on the preview canvas overlaid on existing content. The effect covers the canvas area.
result: pass

### 3. Add Color Grade Adjustment
expected: From AddLayerMenu > Adjustments section, click Color Grade. A new FX sequence is created (timeline-level colored range bar), not a layer inside the active content sequence.
result: pass

### 4. Color Grade Renders on Canvas
expected: With a Color Grade FX sequence added, the canvas visuals change based on the default color grade parameters. All parameters work: Brightness, Contrast, Saturation, Hue (color temperature shift), Fade with configurable blend mode. Effects are strong and visible.
result: pass

### 5. FX Selection from Timeline
expected: Click on an FX range bar in the timeline. The FX layer's properties appear in the Properties panel. Click on the FX header/name area — also selects the FX layer. Delete key removes the selected FX layer (and auto-removes empty FX sequence).
result: pass

### 6. FX Layer Selection & Interaction
expected: Selecting an FX sequence from the timeline shows its layer properties. Visibility toggle, delete, and property editing all work for FX layers. Deleting the sole layer in an FX sequence removes the entire FX sequence.
result: pass

### 7. FX Generator Properties Panel
expected: Select a generator FX layer (e.g. Grain). The PropertiesPanel shows effect-specific controls (sliders for parameters like density, size, intensity). Transform/Crop sections are NOT shown for FX layers. Each generator type shows its own relevant controls.
result: pass

### 8. Color Grade Preset Dropdown
expected: Select the Color Grade layer. PropertiesPanel shows a preset dropdown with options including: none, warm, cool, vintage, bleachBypass, cinematic, highContrast. Selecting a preset auto-populates all 5 sliders (brightness, contrast, saturation, hue, fade) and the tint color picker.
result: pass

### 9. Preset Auto-Reset on Manual Adjustment
expected: With a color grade preset selected (e.g. "cinematic"), manually adjust any slider (e.g. brightness). The preset dropdown automatically resets to "none" indicating custom settings.
result: pass

### 10. Seed Controls for Generators
expected: Generator layers (e.g. Grain, Particles) show seed controls in the properties panel with a seed number input and a lock-seed toggle. Toggling lock-seed on makes the procedural pattern consistent across frames.
result: pass

### 11. FX Range Bars on Timeline
expected: FX sequences appear as colored range bars rendered above the content tracks on the timeline canvas. Each FX type has a distinct color. The bars show a color dot and the FX name.
result: pass

### 12. FX Range Bar Drag (Move & Resize)
expected: Hovering over an FX range bar shows a grab cursor. Dragging the bar body moves the entire range (shifts inFrame/outFrame). Hovering near left/right edges shows a col-resize cursor; dragging edges resizes the range.
result: pass

### 13. FX Visibility Toggle on Timeline
expected: Clicking the color dot in an FX track header toggles the FX sequence on/off. When hidden, the dot and bar render dimmed (reduced opacity). Hidden FX sequences are not visible on the preview canvas.
result: pass

### 14. FX Reorder on Timeline
expected: Dragging an FX track header to a different FX track position reorders the FX sequences. The order change is reflected in both the timeline and the compositing order on canvas.
result: pass

### 15. FX Composites Globally
expected: FX sequences apply globally across all content sequences, not just the active one. Switch between content sequences — the FX overlay remains visible on the preview canvas for all of them.
result: pass

### 16. Timeline Vertical Scroll
expected: When many FX + content tracks overflow the visible timeline area, scrolling vertically (mouse wheel) pans the tracks up/down. The ruler stays fixed at the top. All click/drag interactions work correctly at any scroll position.
result: pass

## Summary

total: 16
passed: 16
issues: 0
pending: 0
skipped: 0

## Gaps

(none — previously reported issues fixed inline during testing)
