---
status: diagnosed
phase: 33-enhance-current-engine
source: [33-01-SUMMARY.md, 33-02-SUMMARY.md, 33-03-SUMMARY.md, 33-04-SUMMARY.md, 33-05-SUMMARY.md, 33-06-SUMMARY.md, 33-07-SUMMARY.md, 33-08-SUMMARY.md, 33-09-SUMMARY.md, 33-10-SUMMARY.md, 33-11-SUMMARY.md]
started: 2026-04-05T14:00:00Z
updated: 2026-04-05T14:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Undo/Redo FX Strokes
expected: Draw 3-4 FX strokes (watercolor). Press Cmd+Z to undo each one. Canvas re-renders correctly — no stale FX pixels remain. Cmd+Shift+Z to redo also re-renders cleanly.
result: pass

### 2. FX Brush Style Applies During Drawing
expected: Select FX Paint mode, choose watercolor style, draw a stroke. The stroke renders with watercolor diffusion effect immediately — not as a flat stroke.
result: pass

### 3. Auto-Enter Paint Mode on Layer Creation
expected: Add a new paint layer from the timeline. Paint mode activates automatically — canvas is ready for drawing without manual toggle.
result: issue
reported: "yes but it choose the last paint FX used same if Iam not in a Paint FX. For example if before I used a water color, when I go on a simple paint layer, the paint stay on water color instead to be ton flat brush"
severity: major

### 4. Clear Brush in FX Mode Refreshes Canvas
expected: In FX paint mode, draw some strokes. Click "Clear Brush". Strokes disappear immediately with no confirmation dialog, and FX canvas refreshes — no stale cached rendering remains.
result: pass

### 5. Exit Paint Mode Button Animation
expected: The "Exit Paint Mode" button displays in orange with a strong pulsating animation (scale + glow) that is clearly noticeable.
result: issue
reported: "remove the scale animation"
severity: cosmetic

### 6. Sidebar Section Order (STROKES before SELECTION)
expected: In paint edit mode, STROKES section appears above SELECTION section in the sidebar.
result: pass

### 7. Brush Color/Size Persist Across Restart
expected: Set brush to a custom color (e.g. red #FF0000) and size (e.g. 20px). Quit and relaunch app. Brush color and size are restored.
result: issue
reported: "Not"
severity: major

### 8. Paint Mode Persists Across Restart
expected: Enter FX Paint mode on a layer, quit and relaunch app. The app restores FX Paint mode (not defaulting to Flat).
result: issue
reported: "No ! I dont want it does that ! I want it restore the paint fx brush if its a paint layer setupt to paint fx. If lastly I paint in water color and open a Paint layer in flat/paint mode it doens't use any FX brush but the unique flat paint !"
severity: major

### 9. Changing Brush Color Refreshes FX Canvas
expected: In FX Paint mode with strokes on canvas, change brush color. The FX canvas re-renders immediately reflecting the new color context — no need to draw to trigger refresh.
result: issue
reported: "if I select a brush FX for change the color, the canvas render switch on Paint mode, and for refresh the canvas to paint fx I need to move any stroke (for refresh the render)"
severity: major

### 10. Circle Cursor Position Matches Paint Position
expected: In paint mode, the circle cursor overlay precisely aligns with where the stroke actually appears on canvas. No offset between cursor and painted area.
result: issue
reported: "NO WORK, The circle size paint icon is not centered on the cursor position"
severity: major

### 11. Circle Cursor Visibility and Zoom Scaling
expected: Circle cursor is clearly visible on any background (light or dark images). It scales with zoom level. System cursor is hidden in paint mode.
result: pass

### 12. Color Picker Modal — No Buttons, Near Mouse, No Overlay
expected: Click a color swatch to open the picker. Color applies in real-time as you drag. No Apply/Cancel buttons. Picker appears near mouse click position (not centered). No dark overlay — rest of UI remains visible. Clicking outside closes and commits color.
result: pass

### 13. Paint Mode Selector (Flat/FX/Physical)
expected: In paint edit mode, a mode selector shows Flat, FX Paint, and Physical Paint (grayed out). Switching modes on a non-empty frame shows a conversion warning dialog.
result: pass

### 14. Conversion Dialog is Modal with Dark Overlay
expected: The paint mode conversion dialog has a dark semi-transparent overlay covering the entire app. Cannot click anywhere outside the dialog until answering. It's clearly a warning modal.
result: pass

### 15. FX Mode White BG / Flat Mode Transparent
expected: In FX Paint mode, the paint canvas background is white. In Flat mode, the background is transparent (underlying photo/video shows through unpainted areas).
result: issue
reported: "No work well: - when I switch from paint to paintfx, it should default auto switch on white background mode - I save/open a project with a paint FX layer, it show with a transparent background instead the default of paint fx (white background) - when I close and open a project with a paint Fx layer, the paintfx layer show with transparent background (default with normal flat paint) but it should show with the background of the paint instead."
severity: major

### 16. Layer Blend Mode and Opacity in Paint Mode
expected: In paint edit mode, blend mode dropdown and opacity slider are accessible and functional. Changing blend mode re-renders the canvas composite. Changing opacity adjusts the paint layer transparency.
result: pass

### 17. Inline Color Picker — Canvas-Adjacent Position
expected: Click the brush color button in PaintProperties. A 260px color picker panel appears to the LEFT of the canvas (not in sidebar). Canvas shrinks horizontally to accommodate. Clicking button again hides it. It auto-closes when exiting paint mode.
result: issue
reported: "NO, the color picker is offseted, not in the right place near the canvas, the container appear without the color picker"
severity: blocker

### 18. Inline Color Picker — 4 Modes Work
expected: All 4 modes (Box/TSL/RVB/CMYK) are functional. Switching between modes works smoothly. Dragging sliders in TSL/RVB/CMYK updates color in real-time without freezing or infinite re-render loops. HEX input works.
result: issue
reported: "- brush color picker TSL, RVB and CMYK has not visual representation - brush color picker TSL, RVB and CMYK sliders has a slow down UI maybe any excessive re-rendering, I reproduced the issue one time, please verify it"
severity: major

### 19. Recent and Favorite Color Swatches
expected: Colors you use are collected as recent swatches. You can add/remove favorites. Both persist across sessions. Clicking a swatch applies color without triggering re-render loops.
result: pass

### 20. FX Stroke Wireframe Overlay and Hit Testing
expected: Select an FX stroke. A dashed blue wireframe path and bounding box appear. Clicking inside the bounding box (even outside exact painted pixels) selects the stroke.
result: issue
reported: "it works only on paint fx, not in paint (flat)"
severity: minor

### 21. Stroke Animation — Single and Multi-Selection
expected: Select one or multiple strokes, click Animate. Modal offers target options. Animation distributes stroke points across frames by drawing speed. Single Cmd+Z undoes the entire animation. Animate button is active when any strokes are selected (not just one).
result: pass

### 22. Flat→FX Conversion Actually Converts Brushes
expected: When switching from Paint (flat) to Paint FX and choosing a default FX style, existing flat strokes on the frame are converted to FX paint strokes.
result: issue
reported: "When I switch from paint to Paint FX and choose a default FX paint, it doesn't convert brushes to FX paint"
severity: major

### 23. Mode Switch Resets Brush Tool
expected: After converting FX→Flat, brush tool resets to flat brush. After converting Flat→FX, brush tool switches to the selected FX style. Deleting and recreating a paint layer starts with the correct default tool for its mode.
result: issue
reported: "WHen I switch from FX Paint to Paint, convert all stroke fine, but It continue to paint with FX paint in the Paint mode! I delete the FX paint, recreate it, it goes default on Paint mode, when I paint, it does with the last FX paint (from paint mode)! seem it store in the app the last used tool but doesn't reset when I switch to any paint mode"
severity: major

## Summary

total: 23
passed: 11
issues: 12
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Auto-enter paint mode respects per-layer paint mode (flat layers use flat brush, not last-used FX)"
  status: failed
  reason: "User reported: yes but it choose the last paint FX used same if Iam not in a Paint FX. For example if before I used a water color, when I go on a simple paint layer, the paint stay on water color instead to be ton flat brush"
  severity: major
  test: 3
  root_cause: "togglePaintMode() in AddFxMenu.tsx auto-enters paint mode without checking frame mode. initFromPreferences() restores global last-used mode instead of inferring from layer's frame mode via getFrameMode()."
  artifacts:
    - path: "app/src/components/timeline/AddFxMenu.tsx"
      issue: "handleAddPaintLayer() toggles paint mode without setting mode from frame"
    - path: "app/src/stores/paintStore.ts"
      issue: "initFromPreferences() restores global mode, setActivePaintMode() at line 532 doesn't check frame"
    - path: "app/src/lib/paintPreferences.ts"
      issue: "savePaintMode/loadPaintMode persist single global mode, not per-layer"
  missing:
    - "On entering paint mode, call getFrameMode(layerId, currentFrame) to infer mode from existing strokes"
    - "Empty frames default to flat mode"
    - "Do NOT restore global last-used mode"
  debug_session: ""

- truth: "Exit Paint Mode button pulsate animation has no scale effect (glow only)"
  status: failed
  reason: "User reported: remove the scale animation"
  severity: cosmetic
  test: 5
  root_cause: "Pulsate keyframes in PaintProperties.tsx include transform:scale(1) at 0%/100% and scale(1.05) at 50%."
  artifacts:
    - path: "app/src/components/sidebar/PaintProperties.tsx"
      issue: "Lines 117-122: pulsate keyframes include scale transforms that should be removed"
  missing:
    - "Remove scale transforms from pulsate keyframes, keep only box-shadow and background-color glow"
  debug_session: ""

- truth: "Brush color and size persist across app restart"
  status: failed
  reason: "User reported: Not"
  severity: major
  test: 7
  root_cause: "main.tsx calls paintStore.initFromPreferences() as fire-and-forget without await. The async loading completes after UI renders, so signals still have defaults. Duplicate initFromPreferences() definitions add confusion."
  artifacts:
    - path: "app/src/main.tsx"
      issue: "Line 20: initFromPreferences() called without await"
    - path: "app/src/stores/paintStore.ts"
      issue: "Lines 107-113 and 537-549: duplicate initFromPreferences() methods; async race condition"
  missing:
    - "Await initFromPreferences() in main.tsx before rendering"
    - "Remove duplicate method definition"
  debug_session: ""

- truth: "Paint mode is per-layer (FX layers restore FX mode, flat layers restore flat mode) — not global last-used"
  status: failed
  reason: "User reported: No ! I dont want it does that ! I want it restore the paint fx brush if its a paint layer setupt to paint fx. If lastly I paint in water color and open a Paint layer in flat/paint mode it doens't use any FX brush but the unique flat paint !"
  severity: major
  test: 8
  root_cause: "activePaintMode is a global signal. When entering paint mode on any layer, it restores global last-used mode instead of computing from getFrameMode(). Mode should be inferred per-layer from existing strokes."
  artifacts:
    - path: "app/src/stores/paintStore.ts"
      issue: "activePaintMode is global signal (line 33), not per-layer"
    - path: "app/src/stores/paintStore.ts"
      issue: "setActivePaintMode() at line 532 saves to global preferences"
  missing:
    - "When entering paint mode, call getFrameMode() to infer mode from existing strokes"
    - "Empty frames default to flat"
    - "Remove global paint mode persistence or make it per-layer"
  debug_session: ""

- truth: "Changing brush color in FX mode refreshes FX canvas immediately without switching to flat render"
  status: failed
  reason: "User reported: if I select a brush FX for change the color, the canvas render switch on Paint mode, and for refresh the canvas to paint fx I need to move any stroke (for refresh the render)"
  severity: major
  test: 9
  root_cause: "setBrushColor() invalidates FX cache and calls refreshFrameFx(), but the live preview canvas is not re-rendered. requestPreview() only fires on pointer move (PaintOverlay line 1233), not on color change. The refresh doesn't trigger a full preview re-render."
  artifacts:
    - path: "app/src/stores/paintStore.ts"
      issue: "setBrushColor() at lines 551-568: invalidates cache but doesn't trigger preview re-render"
    - path: "app/src/components/canvas/PaintOverlay.tsx"
      issue: "requestPreview() only on pointer move, not on color change"
  missing:
    - "After setBrushColor invalidates FX cache, trigger a full preview re-render or bump a version signal"
  debug_session: ""

- truth: "Circle cursor overlay is centered on actual cursor/paint position"
  status: failed
  reason: "User reported: NO WORK, The circle size paint icon is not centered on the cursor position"
  severity: major
  test: 10
  root_cause: "cursorPos is calculated from containerRef.getBoundingClientRect() but PaintCursor renders inside overlayRef. Coordinate systems don't match — containerRef includes margins/padding from parent layout while overlayRef is positioned with inset:0 inside it."
  artifacts:
    - path: "app/src/components/canvas/PaintOverlay.tsx"
      issue: "Lines 1326-1331: cursorPos uses containerRef coords, but cursor renders in overlayRef"
    - path: "app/src/components/canvas/PaintCursor.tsx"
      issue: "Uses screenX/screenY directly without accounting for overlayRef origin offset"
  missing:
    - "Calculate cursorPos relative to overlayRef instead of containerRef, or account for the offset between them"
  debug_session: ""

- truth: "FX mode auto-switches to white background; saved/reopened FX layers restore white background"
  status: failed
  reason: "User reported: No work well: - when I switch from paint to paintfx, it should default auto switch on white background mode - I save/open a project with a paint FX layer, it show with a transparent background instead the default of paint fx (white background) - when I close and open a project with a paint Fx layer, the paintfx layer show with transparent background (default with normal flat paint) but it should show with the background of the paint instead."
  severity: major
  test: 15
  root_cause: "FX white bg only rendered at runtime in renderPaintFrameWithBg() but never persisted. paintBgColor defaults to 'transparent'. setActivePaintMode('fx-paint') doesn't set paintBgColor to white. paintPersistence.ts doesn't serialize bgColor per frame. On reopen, defaults to transparent."
  artifacts:
    - path: "app/src/lib/paintRenderer.ts"
      issue: "Lines 199-217: renders white for FX at runtime only, not persisted"
    - path: "app/src/stores/paintStore.ts"
      issue: "setActivePaintMode() doesn't set paintBgColor to white on FX switch"
    - path: "app/src/lib/paintPersistence.ts"
      issue: "Frame files don't include bgColor field"
    - path: "app/src/types/paint.ts"
      issue: "DEFAULT_PAINT_BG_COLOR = 'transparent' always used on start"
  missing:
    - "setActivePaintMode('fx-paint') must also call setPaintBgColor('#ffffff')"
    - "Add bgColor field to PaintFrame type; persist in frame JSON; restore on load"
    - "On loadPaintData(), restore paintBgColor per-layer"
  debug_session: ""

- truth: "Inline color picker renders correctly adjacent to canvas (not offset, picker visible inside container)"
  status: failed
  reason: "User reported: NO, the color picker is offseted, not in the right place near the canvas, the container appear without the color picker"
  severity: blocker
  test: 17
  root_cause: "InlineColorPicker uses createPortal() to render into document.body with hardcoded fixed positioning (left:60px, top:80px), while CanvasArea renders a 260px flex container. The portal bypasses the container entirely — picker appears at wrong coords, container is empty."
  artifacts:
    - path: "app/src/components/sidebar/InlineColorPicker.tsx"
      issue: "Lines 337-352: uses createPortal() with hardcoded left:60px, top:80px fixed position"
    - path: "app/src/components/layout/CanvasArea.tsx"
      issue: "Lines 368-399: renders 260px flex container that InlineColorPicker ignores"
  missing:
    - "Remove createPortal, render InlineColorPicker as normal child inside the CanvasArea flex container"
    - "Or calculate position relative to container's bounding rect"
  debug_session: ""

- truth: "TSL, RVB, CMYK modes have visual gradient representations and sliders work without UI slowdown"
  status: failed
  reason: "User reported: - brush color picker TSL, RVB and CMYK has not visual representation - brush color picker TSL, RVB and CMYK sliders has a slow down UI maybe any excessive re-rendering, I reproduced the issue one time, please verify it"
  severity: major
  test: 18
  root_cause: "renderSlider() renders plain HTML range inputs with only accentColor styling — no gradient backgrounds. Box mode uses canvas (lines 79-105) for visual gradients but TSL/RVB/CMYK have none. Possible re-render from slider onChange triggering full component re-renders."
  artifacts:
    - path: "app/src/components/sidebar/InlineColorPicker.tsx"
      issue: "Lines 245-274: renderSlider() has no gradient background"
    - path: "app/src/components/sidebar/InlineColorPicker.tsx"
      issue: "Lines 427-453: TSL/RVB/CMYK modes call renderSlider() without gradient rendering"
  missing:
    - "Add CSS linear-gradient or canvas-based gradient backgrounds per slider showing color progression"
    - "Throttle onChange to prevent excessive re-renders"
  debug_session: ""

- truth: "Stroke wireframe overlay and hit testing works for both flat and FX strokes"
  status: failed
  reason: "User reported: it works only on paint fx, not in paint (flat)"
  severity: minor
  test: 20
  root_cause: "PaintOverlay.tsx line 807 checks brushStyle !== 'flat' to show wireframe — flat strokes excluded. Hit testing at line 105 uses bounding box for FX but requires precise path proximity for flat, making flat harder to select."
  artifacts:
    - path: "app/src/components/canvas/PaintOverlay.tsx"
      issue: "Line 807: condition limits wireframe to FX strokes only"
    - path: "app/src/components/canvas/PaintOverlay.tsx"
      issue: "Lines 105-127: hit testing more lenient for FX than flat"
  missing:
    - "Show wireframe for all brush strokes regardless of brushStyle"
    - "Make hit testing consistent for flat and FX"
  debug_session: ""

- truth: "Flat→FX conversion actually converts existing flat strokes to FX paint"
  status: failed
  reason: "User reported: When I switch from paint to Paint FX and choose a default FX paint, it doesn't convert brushes to FX paint"
  severity: major
  test: 22
  root_cause: "PaintModeSelector conversion dialog only changes activePaintMode but does not update existing strokes' brushStyle property from 'flat' to the selected FX style."
  artifacts:
    - path: "app/src/components/sidebar/PaintModeSelector.tsx"
      issue: "Conversion handler changes mode but doesn't iterate and update existing stroke brushStyle"
    - path: "app/src/stores/paintStore.ts"
      issue: "No function to batch-update existing strokes' brushStyle on mode conversion"
  missing:
    - "On flat→FX conversion, iterate all strokes in current frame and set brushStyle to selected FX style"
    - "Invalidate FX cache and refresh after conversion"
  debug_session: ""

- truth: "Mode switch resets active brush tool to match new mode (flat→flat brush, FX→selected FX style)"
  status: failed
  reason: "User reported: WHen I switch from FX Paint to Paint, convert all stroke fine, but It continue to paint with FX paint in the Paint mode! I delete the FX paint, recreate it, it goes default on Paint mode, when I paint, it does with the last FX paint (from paint mode)! seem it store in the app the last used tool but doesn't reset when I switch to any paint mode"
  severity: major
  test: 23
  root_cause: "setActivePaintMode() changes the mode signal but doesn't reset brushStyle to 'flat' when switching to flat mode. The brushStyle signal retains the last FX value. savePaintMode() persists mode but brushStyle is independently stored and not reset."
  artifacts:
    - path: "app/src/stores/paintStore.ts"
      issue: "setActivePaintMode() at line 532 doesn't reset brushStyle when switching to flat"
    - path: "app/src/stores/paintStore.ts"
      issue: "brushStyle signal retains last FX value across mode switches"
  missing:
    - "setActivePaintMode('flat') must also set brushStyle to 'flat'"
    - "setActivePaintMode('fx-paint') must set brushStyle to selected FX style (or default watercolor)"
  debug_session: ""
