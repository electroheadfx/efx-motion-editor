---
status: complete
phase: 33-enhance-current-engine
source: [33-01-SUMMARY.md, 33-02-SUMMARY.md, 33-03-SUMMARY.md, 33-04-SUMMARY.md, 33-05-SUMMARY.md, 33-06-SUMMARY.md, 33-07-SUMMARY.md]
started: 2026-04-05T10:30:00Z
updated: 2026-04-05T10:55:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Undo/Redo Renders Correctly for FX Strokes
expected: Draw a few FX strokes (watercolor or ink). Press Cmd+Z to undo. The canvas re-renders correctly — no stale FX artifacts remain. Redo with Cmd+Shift+Z also re-renders cleanly.
result: pass

### 2. FX Brush Style Applies Immediately When Drawing
expected: Select an FX brush style (watercolor, ink, charcoal) then draw. The stroke renders in that style immediately — no need to draw first and apply style after.
result: pass

### 3. Auto-Enter Paint Mode on Layer Creation
expected: Add a new paint layer from the timeline. Paint mode activates automatically — canvas is ready for drawing without manually entering paint mode.
result: pass

### 4. Clear Brush Without Confirmation
expected: Click Clear Brush. Strokes clear immediately with no confirmation dialog.
result: issue
reported: "yes it works but in FX paint, the canvas is not refreshed, it show brushes but they was deleted, I need to paint for refresh canvas and see the brushes was deleted"
severity: major

### 5. Exit Paint Mode Button Styling
expected: The Exit Paint Mode button is orange with a pulsate animation, making it clearly visible.
result: issue
reported: "make a orange pulsate animation stronger, its too subtle actually"
severity: cosmetic

### 6. Sidebar Section Order
expected: In paint edit mode sidebar, STROKES section appears before SELECTION section.
result: pass

### 7. Brush Preferences Persist Across Restart
expected: Change brush color and size. Quit and relaunch the app. Brush color and size are restored to what you set before.
result: issue
reported: "when I change brush color in FX paint mode, canvas is not refreshed, color change show canvas in Flat paint mode, I need to move a brush to refresh the render. Quit and relaunch the app doesn't restore color/size, and it not restore the Paint mode, if I created a paint in FX mode and re-open it goes in Flat/paint mode instead of FX mode."
severity: major

### 8. Circle Cursor Overlay
expected: In paint mode with brush or eraser, the system cursor is hidden and replaced by a circle showing brush size. The circle scales with zoom level.
result: issue
reported: "yes but the circle is subtle and its difficult to see it on image background. There is a big issue, the circle is not at the right position of paint. when I paint the circle position is offseted from the zone where I paint"
severity: major

### 9. Color Picker Realtime (No Apply/Cancel)
expected: Click any color swatch to open the picker. Color applies in realtime as you drag. No Apply/Cancel buttons. Clicking outside or pressing Escape closes the picker (commits current color).
result: pass

### 10. Color Picker Positioned Near Mouse
expected: The color picker modal opens near where you clicked the swatch, not centered on screen. It stays within window bounds.
result: pass

### 11. Paint Mode Selector (Flat/FX)
expected: In paint edit mode, a mode selector shows Flat, FX Paint, and Physical Paint (grayed out). Switching between Flat and FX on a non-empty frame shows a conversion dialog.
result: issue
reported: "yes for mode selectors, but dialog conversion should to be modal with dark background because it need to see the choice and not allow to click anywhere without this answer, its a warming dialog"
severity: minor

### 12. Flat Mode Transparent Background
expected: In flat paint mode, the paint layer background is transparent — the photo/video underneath shows through unpainted areas.
result: issue
reported: "Yes but in FX mode, the background is transparent, it should to be white."
severity: major

### 13. Layer Blend Mode and Opacity in Paint Mode
expected: In paint edit mode, blend mode dropdown and opacity slider are accessible. Changing them affects how the paint layer composites over content below.
result: issue
reported: "No work at all"
severity: blocker

### 14. Inline Color Picker with 4 Modes
expected: The brush color button in paint properties opens an inline color picker with 4 tabs: Box (HSV square), TSL (H/S/L sliders), RVB (R/G/B sliders), CMYK (C/M/Y/K sliders). HEX input is available.
result: issue
reported: "inline brush color picker should to be near the canvas not in sidebar, the canvas resize a bit to give the place for color picker Like the mini palette at top. TSL, RVB, CMYK should to be visual like TSL. TSL, RVB, CMYK no work, there is an endless re-rendering issue, the slider no work I need to close for solve this problem"
severity: blocker

### 15. Recent and Favorite Color Swatches
expected: Colors you use are collected as recent swatches (up to 16). You can add/remove favorite swatches. Both persist across sessions.
result: issue
reported: "it has an endless re-rendering issue when I select a recent or predefined swatches and change color. In final I can't anymore change color, I am forced to close the inline picker color"
severity: blocker

### 16. FX Stroke Wireframe Overlay
expected: Select an FX stroke. A dashed blue wireframe path and bounding box appear around it, showing the original stroke path.
result: pass

### 17. FX Stroke Hit Testing
expected: Click on an FX stroke (watercolor/ink with artistic spread). The stroke is selected even if you click on the spread area outside the exact path.
result: pass

### 18. Stroke Draw-Reveal Animation
expected: Select a stroke, click Animate. A modal offers target options (layer/sequence). After confirming, the stroke is distributed across frames as a draw-reveal animation. Single Cmd+Z undoes the entire animation.
result: issue
reported: "work, but I would like to apply to all brushes too. When I select all the animate button is inactive"
severity: minor

## Summary

total: 18
passed: 8
issues: 10
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Clear Brush in FX mode refreshes canvas immediately"
  status: failed
  reason: "User reported: yes it works but in FX paint, the canvas is not refreshed, it show brushes but they was deleted, I need to paint for refresh canvas and see the brushes was deleted"
  severity: major
  test: 4
  root_cause: "paintStore.clearFrame() calls _notifyVisualChange but missing invalidateFrameFxCache + refreshFrameFx after immediate execution (line ~412). Redo callback also missing refreshFrameFx."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Exit Paint Mode button orange pulsate animation is clearly visible"
  status: failed
  reason: "User reported: make a orange pulsate animation stronger, its too subtle actually"
  severity: cosmetic
  test: 5
  root_cause: "CSS pulsate animation keyframes use too subtle opacity/scale values. Increase amplitude in PaintProperties.tsx."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Brush color/size and paint mode persist across app restart"
  status: failed
  reason: "User reported: when I change brush color in FX paint mode, canvas is not refreshed, color change show canvas in Flat paint mode, I need to move a brush to refresh the render. Quit and relaunch the app doesn't restore color/size, and it not restore the Paint mode, if I created a paint in FX mode and re-open it goes in Flat/paint mode instead of FX mode."
  severity: major
  test: 7
  root_cause: "Three issues: (1) setBrushColor() missing invalidateFrameFxCache+refreshFrameFx — FX canvas not refreshed on color change. (2) FX cache key in brushP5Adapter.ts:202 doesn't include stroke color — stale cache reused. (3) paintPreferences.ts only persists color/size, not activePaintMode — mode lost on restart. initFromPreferences() doesn't restore mode."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Circle cursor overlay is clearly visible and aligned with paint position"
  status: failed
  reason: "User reported: yes but the circle is subtle and its difficult to see it on image background. There is a big issue, the circle is not at the right position of paint. when I paint the circle position is offseted from the zone where I paint"
  severity: major
  test: 8
  root_cause: "Coordinate mismatch: PaintCursor uses screen-space coords (overlayRef getBoundingClientRect) while paint uses project-space via clientToCanvas() with zoom/pan/padding inversions (containerRef). Cursor must use same transform chain. Also needs better visibility (thicker border, outline, or invert blend)."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Paint mode conversion dialog is modal with dark overlay"
  status: failed
  reason: "User reported: yes for mode selectors, but dialog conversion should to be modal with dark background because it need to see the choice and not allow to click anywhere without this answer, its a warming dialog"
  severity: minor
  test: 11
  root_cause: "PaintModeSelector conversion dialog uses transparent click-catcher. Needs dark bg-black/50 overlay to block interaction and visually signal warning modal."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "FX mode has white background, flat mode has transparent background"
  status: failed
  reason: "User reported: Yes but in FX mode, the background is transparent, it should to be white."
  severity: major
  test: 12
  root_cause: "renderPaintFrameWithBg() in paintRenderer.ts uses paintBgColor uniformly for all modes. FX mode (p5.brush) needs white background but gets transparent. Need mode check: fx-paint forces #ffffff, flat uses stored paintBgColor."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Layer blend mode and opacity controls work in paint edit mode"
  status: failed
  reason: "User reported: No work at all"
  severity: blocker
  test: 13
  root_cause: "previewRenderer.ts:299 intentionally forces blendMode to 'normal' when paintMode is active (comment: 'Task 12: normal blend in edit mode'). Need to remove this override so user-selected blend mode applies during paint edit. Opacity actually works (globalAlpha applied at line 301)."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Inline color picker positioned near canvas, all 4 modes functional without re-rendering issues"
  status: failed
  reason: "User reported: inline brush color picker should to be near the canvas not in sidebar, the canvas resize a bit to give the place for color picker Like the mini palette at top. TSL, RVB, CMYK should to be visual like TSL. TSL, RVB, CMYK no work, there is an endless re-rendering issue, the slider no work I need to close for solve this problem"
  severity: blocker
  test: 14
  root_cause: "Infinite re-render loop: circular dependency between prop sync useEffect (line ~44-50) and onChange useEffect (line ~59-62). External color prop change triggers HSV state update, which triggers onChange, which updates parent, which sends new prop — loop. Fix: add useRef to track external vs internal changes, only fire onChange on user interactions. Position: currently in sidebar portal, user wants it near canvas like mini palette."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Recent and favorite swatches work without re-rendering issues"
  status: failed
  reason: "User reported: it has an endless re-rendering issue when I select a recent or predefined swatches and change color. In final I can't anymore change color, I am forced to close the inline picker color"
  severity: blocker
  test: 15
  root_cause: "Same infinite re-render as test 14. Swatch click → applyFromSwatch sets HSV state → onChange effect fires → parent updates → prop sync effect fires → loop. Fix is shared with test 14 (decouple prop sync from onChange)."
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Animate button works when multiple strokes are selected"
  status: failed
  reason: "User reported: work, but I would like to apply to all brushes too. When I select all the animate button is inactive"
  severity: minor
  test: 18
  root_cause: "PaintProperties.tsx:526 has disabled={selectedStrokeIds.size !== 1} — only allows exactly 1 stroke. handleAnimate() at line ~556 assumes single selection (takes first ID). Need to change condition to === 0 and loop through all selected strokes."
  artifacts: []
  missing: []
  debug_session: ""
