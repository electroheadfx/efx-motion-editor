---
phase: 33-enhance-current-engine
verified: 2026-04-05T10:30:00Z
status: passed
score: 9/9 must-haves verified
re_verification: false
---

# Phase 33: Enhance Current Paint Engine — Verification Report

**Phase Goal:** Current paint engine (perfect-freehand + p5.brush) receives bug fixes, UX improvements, paint mode system, inline color picker, and stroke animation
**Verified:** 2026-04-05T10:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                              | Status     | Evidence                                                                                                                              |
|----|-----------------------------------------------------------------------------------------------------|------------|---------------------------------------------------------------------------------------------------------------------------------------|
| 1  | Cmd+Z after any paint operation immediately re-renders canvas with correct visual state             | ✓ VERIFIED | All undo/redo closures in paintStore.ts call `_notifyVisualChange` (28 call sites found), plus `invalidateFrameFxCache` + `refreshFrameFx` |
| 2  | FX brush style selection actually applies during drawing                                            | ✓ VERIFIED | PaintOverlay.tsx line 2027: `brushStyle: paintStore.brushStyle.peek()` stamped at stroke creation; FX refresh triggered after addElement |
| 3  | Brush color/size persist across sessions, defaulting to #203769/35px                               | ✓ VERIFIED | `paintPreferences.ts` exports `loadBrushPreferences`/`saveBrushColor`/`saveBrushSize`; types/paint.ts: `DEFAULT_BRUSH_COLOR='#203769'`, `DEFAULT_BRUSH_SIZE=35`; `initFromPreferences` called in main.tsx |
| 4  | Circle cursor at brush size scales with zoom                                                        | ✓ VERIFIED | `PaintCursor.tsx` line 14: `const diameter = brushSize * zoom`; renders `borderRadius: '50%'`; integrated in PaintOverlay.tsx line 2409; system cursor set to `none` at line 2375 |
| 5  | 3-mode paint system (flat/FX/physical-placeholder) with per-frame exclusivity                      | ✓ VERIFIED | `PaintMode` type in types/paint.ts; `PaintModeSelector.tsx` renders 3 modes; physic-paint has `opacity: 0.4, cursor: 'not-allowed'`; conversion dialog shows for flat↔FX with existing strokes; `getFrameMode` + `addElement` enforce mode per frame |
| 6  | Inline color picker with 4 modes (Box/TSL/RVB/CMYK) and persistent swatches                       | ✓ VERIFIED | `InlineColorPicker.tsx` has `ColorMode = 'Box' | 'TSL' | 'RVB' | 'CMYK'`; Box uses canvas HSV square; HEX input at line 441; recent+favorite swatches wired to `paintPreferences.ts`; toggled from PaintProperties brush color button |
| 7  | Modal color picker: no buttons, no overlay, positioned near mouse                                  | ✓ VERIFIED | `ColorPickerModal.tsx`: no `onApply`/Apply/Cancel; backdrop uses `background: 'transparent'`; `mouseX`/`mouseY` props with `Math.min`/`Math.max` bounds clamping; all 7 call sites updated |
| 8  | Selected FX strokes show wireframe overlay for easy grab                                            | ✓ VERIFIED | `renderFxWireframe()` and `renderFxStrokeBounds()` functions in PaintOverlay.tsx; integrated into `renderLivePreview` at line 806; bounding-box hit testing for FX strokes at line 104 |
| 9  | Stroke draw-reveal animation distributes points across frames by speed                             | ✓ VERIFIED | `strokeAnimation.ts` exports `distributeStrokeBySpeed` with inverse distance weighting and 0.5 min clamp; Animate button next to "Copy to Next Frame"; modal with layer/sequence targets; single `pushAction` for atomic undo; `paintVersion.value++` in apply/undo/redo |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact                                              | Provides                                           | Status     | Details                                                     |
|-------------------------------------------------------|----------------------------------------------------|------------|-------------------------------------------------------------|
| `app/src/stores/paintStore.ts`                        | Fixed undo closures, FX cache, mode system         | ✓ VERIFIED | `_notifyVisualChange` called in all 19 undo/redo closures; `getFrameMode`, `activePaintMode`, `setActivePaintMode`, `_getOrCreateFrame` exposed |
| `app/src/components/canvas/PaintOverlay.tsx`          | Stroke creation with brushStyle, PaintCursor, wireframe | ✓ VERIFIED | brushStyle.peek() at stroke creation; PaintCursor integrated; renderFxWireframe/Bounds present |
| `app/src/components/sidebar/PaintProperties.tsx`      | Orange exit button, STROKES first, Animate button  | ✓ VERIFIED | `#f97316` + pulsate animation at line 110–113; StrokeList before SELECTION at line 266–274; Animate button at line 523–531 |
| `app/src/components/timeline/AddFxMenu.tsx`           | Auto-enter paint mode on layer creation            | ✓ VERIFIED | `togglePaintMode()` called at lines 123–124                 |
| `app/src/lib/paintPreferences.ts`                     | Brush persistence via LazyStore                    | ✓ VERIFIED | `loadBrushPreferences`, `saveBrushColor`, `saveBrushSize`, `loadRecentColors`, `saveRecentColors`, `loadFavoriteColors`, `saveFavoriteColors` all present |
| `app/src/components/canvas/PaintCursor.tsx`           | Circle cursor overlay                              | ✓ VERIFIED | `borderRadius: '50%'`, `diameter = brushSize * zoom`, `pointerEvents: 'none'` |
| `app/src/types/paint.ts`                              | PaintMode type, updated defaults                   | ✓ VERIFIED | `PaintMode = 'flat' | 'fx-paint' | 'physic-paint'`; `DEFAULT_BRUSH_COLOR='#203769'`; `DEFAULT_BRUSH_SIZE=35`; `DEFAULT_PAINT_BG_COLOR='transparent'` |
| `app/src/components/shared/ColorPickerModal.tsx`      | No-button, no-overlay, mouse-positioned modal      | ✓ VERIFIED | `background: 'transparent'` for backdrop; `mouseX`/`mouseY` props; bounds clamping with `Math.min`/`Math.max` |
| `app/src/components/sidebar/PaintModeSelector.tsx`    | 3-mode toggle with conversion dialogs              | ✓ VERIFIED | 3 mode buttons; physic-paint disabled; `showConvertDialog` state; conversion for flat↔FX |
| `app/src/lib/colorUtils.ts`                           | 8 color conversion functions                       | ✓ VERIFIED | Exactly 8 exported functions: hexToRgba, rgbaToHex, rgbToHsl, hslToRgb, rgbToHsv, hsvToRgb, rgbToCmyk, cmykToRgb |
| `app/src/components/sidebar/InlineColorPicker.tsx`    | 4-mode inline color picker with swatches           | ✓ VERIFIED | Box/TSL/RVB/CMYK modes; HSV canvas; HEX input; recent+favorite swatches with persistence |
| `app/src/lib/strokeAnimation.ts`                      | Speed-based point distribution algorithm           | ✓ VERIFIED | `distributeStrokeBySpeed` exported; inverse distance weighting; 0.5 minimum clamp; last frame always complete |
| `app/src/lib/paintRenderer.ts`                        | Transparent background for flat mode              | ✓ VERIFIED | `ctx.clearRect` when `bgColor === 'transparent'` at line 209–210 |

### Key Link Verification

| From                                          | To                             | Via                               | Status     | Details                                               |
|-----------------------------------------------|--------------------------------|-----------------------------------|------------|-------------------------------------------------------|
| `paintStore clearFrame undo closure`          | `_notifyVisualChange`          | direct call                       | ✓ WIRED    | Called at line 358 and 365                            |
| `paintStore addElement undo closure`          | `invalidateFrameFxCache`       | direct call                       | ✓ WIRED    | Called at line 167 and 174                            |
| `PaintOverlay stroke creation`                | `paintStore.brushStyle.peek()` | direct read at creation           | ✓ WIRED    | Line 2027: `brushStyle: paintStore.brushStyle.peek()` |
| `paintPreferences.ts`                         | `LazyStore 'app-config.json'`  | `LazyStore('app-config.json')`    | ✓ WIRED    | File exists, exports confirmed, wired in paintStore   |
| `PaintCursor.tsx`                             | `paintStore.brushSize`         | signal subscription               | ✓ WIRED    | `brushSize * zoom` in PaintCursor; rendered at PaintOverlay line 2409 |
| `PaintModeSelector.tsx`                       | `paintStore.switchPaintMode`   | `setActivePaintMode` call         | ✓ WIRED    | handleModeSwitch calls `paintStore.setActivePaintMode` |
| `paintStore.addElement`                       | frame mode enforcement         | `activePaintMode.peek()` stamp    | ✓ WIRED    | Line 155: `(element as PaintStroke).mode = activePaintMode.peek()` |
| `InlineColorPicker`                           | `paintStore.setBrushColor`     | onChange callback                 | ✓ WIRED    | PaintProperties line 1273: `paintStore.setBrushColor(color)` |
| `InlineColorPicker swatches`                  | `paintPreferences`             | loadRecentColors/saveRecentColors | ✓ WIRED    | Lines 39, 94–98 in InlineColorPicker.tsx              |
| `PaintOverlay FX wireframe`                   | `paintStore.selectedStrokeIds` | signal subscription               | ✓ WIRED    | Line 806: checks selectedStrokeIds for FX wireframe render |
| `PaintProperties Animate button`              | `distributeStrokeBySpeed`      | dynamic import on confirm         | ✓ WIRED    | Line 575: `const { distributeStrokeBySpeed } = await import(...)` |
| `PaintProperties handleAnimate`               | `fxTrackLayouts`/`trackLayouts`| direct import and usage           | ✓ WIRED    | Lines 11, 544, 548: real timeline APIs used, no hardcoded fallbacks |
| `PaintProperties handleAnimate undo/redo`     | `paintVersion.value++`         | direct signal bump                | ✓ WIRED    | Lines 607, 625, 640 — bumped in apply, undo, and redo |

### Data-Flow Trace (Level 4)

| Artifact                     | Data Variable      | Source                      | Produces Real Data | Status      |
|------------------------------|--------------------|-----------------------------|--------------------|-------------|
| `PaintCursor.tsx`            | `brushSize`        | `paintStore.brushSize.value` | Yes (signal)      | ✓ FLOWING   |
| `InlineColorPicker.tsx`      | `recentColors`     | `loadRecentColors()` → LazyStore | Yes (persistent store) | ✓ FLOWING |
| `PaintModeSelector.tsx`      | `activeMode`       | `paintStore.activePaintMode.value` | Yes (signal) | ✓ FLOWING |
| `PaintProperties Animate`    | frame range        | `fxTrackLayouts.value` / `trackLayouts.value` | Yes (computed signals) | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — This is a Tauri desktop app; no runnable entry points without launching the full application.

### Requirements Coverage

| Requirement | Source Plan | Description                                                          | Status       | Evidence                                                          |
|-------------|-------------|----------------------------------------------------------------------|--------------|-------------------------------------------------------------------|
| ECUR-01     | Plan 01     | Cmd+Z re-renders canvas correctly for flat and FX strokes            | ✓ SATISFIED  | All undo closures call `_notifyVisualChange` + FX cache invalidation |
| ECUR-02     | Plan 01     | FX brush style applies during drawing without manual reselection     | ✓ SATISFIED  | `brushStyle: paintStore.brushStyle.peek()` at stroke creation     |
| ECUR-03     | Plan 02     | Brush color/size persist, default #203769/35px                       | ✓ SATISFIED  | `paintPreferences.ts` + `initFromPreferences` + updated defaults  |
| ECUR-04     | Plan 02     | Circle cursor at brush size scales with zoom                         | ✓ SATISFIED  | `PaintCursor.tsx` with `brushSize * zoom` diameter                |
| ECUR-05     | Plan 01     | Creating paint layer auto-switches to paint edit mode                | ✓ SATISFIED  | `togglePaintMode()` called in AddFxMenu.tsx lines 123–124         |
| ECUR-06     | Plan 01     | "Clear Brush" instant, Cmd+Z undoes and re-renders                   | ✓ SATISFIED  | `confirmClear` removed (0 matches); clearFrame undo calls `_notifyVisualChange` |
| ECUR-07     | *ORPHANED*  | Exit Paint Mode button orange with pulsate animation                 | ✓ SATISFIED  | Implemented in Plan 01 (not claimed in requirements field); `#f97316` + pulsate at PaintProperties.tsx lines 110–113. No plan declared this requirement ID. |
| ECUR-08     | Plan 04*    | STROKES panel before SELECTION panel                                 | ✓ SATISFIED  | StrokeList at line 266, before SectionLabel "SELECTION" at line 274. Note: Plan 04 claims ECUR-08 for 3-mode system — numbering diverges from REQUIREMENTS.md |
| ECUR-09     | Plan 04*    | Three brush modes with per-frame exclusivity and conversion dialogs  | ✓ SATISFIED  | `PaintModeSelector.tsx` with 3 modes; conversion dialogs; `getFrameMode` enforcement. Note: REQUIREMENTS.md numbering diverges from plan numbering |
| ECUR-10     | Plan 05     | Inline color picker 4 modes, HEX, auto-apply, persistent swatches   | ✓ SATISFIED  | `InlineColorPicker.tsx` fully implemented and wired               |
| ECUR-11     | Plan 03     | Modal picker: no buttons, no overlay, near-mouse positioning         | ✓ SATISFIED  | `ColorPickerModal.tsx` updated; all 7 call sites pass mouse coords |
| ECUR-12     | Plan 06     | FX stroke wireframe overlay + bounding box hit testing               | ✓ SATISFIED  | `renderFxWireframe` + `renderFxStrokeBounds` in PaintOverlay.tsx  |
| ECUR-13     | Plan 07     | Speed-based stroke animation with atomic undo                        | ✓ SATISFIED  | `distributeStrokeBySpeed` + Animate modal + single `pushAction`   |

**Note on ECUR-07/08/09 numbering:** REQUIREMENTS.md assigns ECUR-07 to the exit button, ECUR-08 to STROKES panel order, and ECUR-09 to the 3-mode system. The plans use a shifted numbering (Plan 01 = ECUR-01/02/05/06, Plan 04 = ECUR-08/09 for 3-mode system). ECUR-07 is not claimed by any plan's `requirements` field, but the functionality is fully implemented in Plan 01. This is a documentation numbering discrepancy — all 13 requirements are implemented.

### Anti-Patterns Found

| File                                          | Line | Pattern                              | Severity  | Impact                                                         |
|-----------------------------------------------|------|--------------------------------------|-----------|----------------------------------------------------------------|
| `PaintModeSelector.tsx`                       | 112  | `'coming soon'` in tooltip title     | Info      | Intentional design — physic-paint is a declared placeholder by spec |

No blocker or warning anti-patterns found.

### Human Verification Required

#### 1. Cmd+Z Undo Visual Re-render

**Test:** Draw an FX stroke (watercolor), press Cmd+Z, observe canvas.
**Expected:** FX stroke disappears immediately, canvas shows correct state without stale pixels.
**Why human:** Cannot verify canvas render correctness programmatically without running the Tauri app.

#### 2. FX Brush Style Immediate Application

**Test:** Enter FX Paint mode, select "watercolor" from brush style, draw a stroke.
**Expected:** Stroke renders with watercolor diffusion effect immediately during drawing (not as a flat stroke requiring select-and-apply).
**Why human:** p5.brush visual output requires visual inspection.

#### 3. Circle Cursor Zoom Scaling

**Test:** Open a paint layer, set brush to 35px, zoom canvas to 200%.
**Expected:** Circle cursor diameter doubles from ~35px screen size to ~70px screen size.
**Why human:** Requires running app and visual comparison.

#### 4. Mode Conversion Dialog

**Test:** Draw a flat stroke, switch to FX Paint mode via the mode selector.
**Expected:** Dialog appears asking to convert existing stroke(s) with "Current frame only" and "All frames" options.
**Why human:** Dialog render and interaction requires live app testing.

#### 5. Inline Color Picker Swatches Persistence

**Test:** Open inline picker, use 3 different colors. Close app, relaunch, open inline picker.
**Expected:** "Recent" swatch row shows the 3 colors used in prior session.
**Why human:** Requires actual app restart to verify Tauri LazyStore persistence.

#### 6. Animate Stroke Animation Quality

**Test:** Draw a stroke slowly in some areas and quickly in others. Select it, click Animate, choose "end of layer". Step through frames.
**Expected:** Slow-drawn portions of the stroke reveal over more frames than fast-drawn portions.
**Why human:** Speed-based distribution quality requires visual frame-by-frame inspection.

### Gaps Summary

No gaps found. All 9 observable truths are verified, all 13 artifacts exist with substantive implementations, all key links are wired, and data flows are confirmed. The only note is a documentation-level numbering discrepancy for ECUR-07 (no plan declared it in the `requirements` field, but the feature is fully implemented).

---

_Verified: 2026-04-05T10:30:00Z_
_Verifier: Claude (gsd-verifier)_
