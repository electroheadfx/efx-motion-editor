---
phase: 33-enhance-current-engine
verified: 2026-04-05T12:45:00Z
status: passed
score: 9/9 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 8/9
  gaps_closed:
    - "Inline color picker is positioned near/on canvas side (not in sidebar) — ECUR-10 positioning gap closed by plan 11 (commit 699c4ce)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Cmd+Z undo visual re-render for FX strokes"
    expected: "FX stroke disappears immediately on Cmd+Z with no stale pixels"
    why_human: "Canvas render correctness requires visual inspection in running Tauri app"
  - test: "FX brush style applies immediately during drawing"
    expected: "Drawing with 'watercolor' style produces watercolor diffusion effect immediately"
    why_human: "p5.brush visual output requires running app and visual inspection"
  - test: "Circle cursor alignment and visibility"
    expected: "Circle cursor is clearly visible on image backgrounds and aligns with actual paint position"
    why_human: "Coordinate alignment and visual contrast require running app; containerRef fix in place but alignment accuracy needs human confirmation"
  - test: "Brush preferences persist across app restart"
    expected: "Brush color, size, and paint mode (flat/fx-paint) are restored after app quit and relaunch"
    why_human: "Requires actual Tauri app restart to verify LazyStore persistence"
  - test: "Paint mode conversion dialog blocks interaction"
    expected: "Converting flat-to-FX shows dark overlay modal that blocks clicks outside it"
    why_human: "createPortal + rgba(0,0,0,0.5) overlay implemented but portal z-index in app layout needs visual confirmation"
  - test: "Inline color picker renders to the left of canvas"
    expected: "Toggling the color picker button in PaintProperties makes a 260px picker panel appear to the left of the canvas area; canvas shrinks to accommodate"
    why_human: "Layout rendering in Tauri webview needs visual confirmation; code wiring is verified"
---

# Phase 33: Enhance Current Paint Engine — Verification Report

**Phase Goal:** Current paint engine (perfect-freehand + p5.brush) receives bug fixes, UX improvements, paint mode system, inline color picker, and stroke animation
**Verified:** 2026-04-05T12:45:00Z
**Status:** passed
**Re-verification:** Yes — previous verification (2026-04-05T12:10:10Z) had 1 gap (ECUR-10 InlineColorPicker positioning). Plan 11 executed to close the gap. This verification confirms the gap is closed and no regressions introduced.

## Goal Achievement

### Observable Truths (from ROADMAP success criteria + REQUIREMENTS.md)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cmd+Z after any paint operation immediately re-renders canvas with correct visual state (flat and FX) | ✓ VERIFIED | `clearFrame` and `addElement` undo/redo closures all call `_notifyVisualChange` + `invalidateFrameFxCache` + `refreshFrameFx` (paintStore.ts 79 call sites confirmed). |
| 2 | FX brush style selection actually applies during drawing | ✓ VERIFIED | PaintOverlay.tsx line 2027: `brushStyle: paintStore.brushStyle.peek()` stamped at stroke creation; `invalidateFrameFxCache` + `refreshFrameFx` called after addElement when brushStyle is not 'flat'. |
| 3 | Brush color/size persist across sessions, defaulting to #203769/35px | ✓ VERIFIED | `paintPreferences.ts` exports `loadBrushPreferences`/`saveBrushColor`/`saveBrushSize`/`loadPaintMode`/`savePaintMode`; defaults #203769/35px at lines 11-12; `initFromPreferences()` called in main.tsx line 20. |
| 4 | Circle cursor at brush size scales with zoom | ✓ VERIFIED | `PaintCursor.tsx` line 14: `const diameter = brushSize * zoom`; `mixBlendMode: 'difference'` for visibility; cursor position uses `containerRef.getBoundingClientRect()` at PaintOverlay line 1329. |
| 5 | 3-mode paint system (flat/FX/physical-placeholder) with per-frame exclusivity | ✓ VERIFIED | `PaintModeSelector.tsx`: 3 mode buttons, physic-paint guarded at line 29; conversion dialog uses `createPortal` with `rgba(0,0,0,0.5)` dark overlay (line 122); `getFrameMode` + mode stamp at stroke creation enforces per-frame exclusivity. |
| 6 | Inline color picker with 4 modes (Box/TSL/RVB/CMYK), HEX, persistent swatches, positioned adjacent to canvas | ✓ VERIFIED | 4 modes present; `isExternalUpdate` ref guard (InlineColorPicker.tsx lines 38-72) prevents circular re-render; swatches persistent via LazyStore; **rendered in CanvasArea.tsx at line 368-399, to the left of the canvas container in a 260px panel** — satisfies ECUR-10 "on canvas side" requirement. Toggle controlled via `paintStore.showInlineColorPicker` signal. |
| 7 | Modal color picker: no buttons, no overlay, positioned near mouse | ✓ VERIFIED | `ColorPickerModal.tsx`: `background: 'transparent'` for backdrop (line 326); no `onApply`/`onCancel` props; `mouseX`/`mouseY` props with `Math.min`/`Math.max` bounds clamping (lines 297-304). |
| 8 | Selected FX strokes show wireframe overlay for easy grab | ✓ VERIFIED | `renderFxWireframe()` (line 399) and `renderFxStrokeBounds()` (line 432) in PaintOverlay.tsx; integrated at lines 810-811 in `renderLivePreview`; bounding-box hit testing for FX strokes at line 104. |
| 9 | Stroke draw-reveal animation distributes points across frames by speed | ✓ VERIFIED | `strokeAnimation.ts`: `distributeStrokeBySpeed` exported with inverse distance weighting and 0.5 min clamp; Animate button enabled for any selection size > 0 (line 526); iterates all selected strokes (lines 566-583); single `pushAction` for atomic undo (line 620); `paintVersion.value++` in apply/undo/redo. |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `app/src/stores/paintStore.ts` | Fixed undo closures, FX cache, mode system, showInlineColorPicker signal | ✓ VERIFIED | `_notifyVisualChange` in all undo/redo closures; `showInlineColorPicker: signal(false)` at line 38; `toggleInlineColorPicker` at line 519; `togglePaintMode` closes picker at line 515. Note: pre-existing duplicate definitions of `setActivePaintMode` (lines 137, 532) and `initFromPreferences` (lines 108, 538) — last definition wins in both cases; the operative definitions (532, 538) are functionally correct. Not introduced by plan 11. |
| `app/src/components/canvas/PaintOverlay.tsx` | Stroke creation with brushStyle, PaintCursor, wireframe | ✓ VERIFIED | `brushStyle.peek()` at creation (line 2027); `PaintCursor` imported and rendered; `renderFxWireframe/Bounds` at lines 399/432 |
| `app/src/components/sidebar/PaintProperties.tsx` | Orange exit button, STROKES first, Animate multi-selection, color picker toggle via store signal | ✓ VERIFIED | `#f97316` + scale/glow pulsate at lines 110-123; StrokeList before SELECTION SectionLabel; `paintStore.toggleInlineColorPicker()` at lines 392, 820 (no local state; no `<InlineColorPicker` render) |
| `app/src/components/layout/CanvasArea.tsx` | InlineColorPicker rendered adjacent to canvas | ✓ VERIFIED | Import at line 12; conditional render at lines 368-399 — 260px panel to the left of containerRef canvas div; guarded by `isPaintModeActive && paintStore.showInlineColorPicker.value` |
| `app/src/components/timeline/AddFxMenu.tsx` | Auto-enter paint mode on layer creation | ✓ VERIFIED | `togglePaintMode()` called at line 124 after `setSelected` |
| `app/src/lib/paintPreferences.ts` | Brush/mode persistence via LazyStore | ✓ VERIFIED | All 8 functions present; uses `app-config.json` (functionally equivalent to a dedicated store file) |
| `app/src/components/canvas/PaintCursor.tsx` | Circle cursor overlay | ✓ VERIFIED | `diameter = brushSize * zoom`; `borderRadius: '50%'`; `mixBlendMode: 'difference'`; `boxShadow` for contrast |
| `app/src/types/paint.ts` | PaintMode type, updated defaults | ✓ VERIFIED | `PaintMode = 'flat' \| 'fx-paint' \| 'physic-paint'`; `DEFAULT_BRUSH_COLOR='#203769'`; `DEFAULT_BRUSH_SIZE=35` |
| `app/src/components/shared/ColorPickerModal.tsx` | No-button, no-overlay, mouse-positioned modal | ✓ VERIFIED | `background: 'transparent'` backdrop; `mouseX`/`mouseY` props; bounds clamping; no Apply/Cancel |
| `app/src/components/sidebar/PaintModeSelector.tsx` | 3-mode toggle with dark modal conversion dialog | ✓ VERIFIED | 3 mode buttons; physic-paint guarded; `createPortal` with `rgba(0,0,0,0.5)` overlay |
| `app/src/lib/colorUtils.ts` | 8 color conversion functions | ✓ VERIFIED | `hexToRgba`, `rgbaToHex`, `rgbToHsl`, `hslToRgb`, `rgbToHsv`, `hsvToRgb`, `rgbToCmyk`, `cmykToRgb` |
| `app/src/components/sidebar/InlineColorPicker.tsx` | 4-mode inline color picker with swatches, no re-render loop | ✓ VERIFIED | Box/TSL/RVB/CMYK modes; HSV canvas; HEX input; `isExternalUpdate` ref guard; `loadRecentColors`/`saveFavoriteColors` wired |
| `app/src/lib/strokeAnimation.ts` | Speed-based point distribution algorithm | ✓ VERIFIED | `distributeStrokeBySpeed` exported; inverse distance weighting; 0.5 minimum clamp; last frame includes all points |
| `app/src/lib/paintRenderer.ts` | Mode-aware background: white for FX, transparent for flat | ✓ VERIFIED | `renderPaintFrameWithBg`: `bgColor = currentMode === 'fx-paint' ? '#ffffff' : paintStore.paintBgColor.peek()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `paintStore.clearFrame` immediate | `invalidateFrameFxCache + refreshFrameFx` | direct calls after `_notifyVisualChange` | ✓ WIRED | Lines 412-414 |
| `paintStore.clearFrame` undo closure | `_notifyVisualChange + invalidateFrameFxCache + refreshFrameFx` | direct calls | ✓ WIRED | Lines 422-424 |
| `paintStore.clearFrame` redo closure | `_notifyVisualChange + invalidateFrameFxCache + refreshFrameFx` | direct calls | ✓ WIRED | Lines 429-431 |
| `paintStore.addElement` undo closure | `_notifyVisualChange + invalidateFrameFxCache + refreshFrameFx` | direct calls | ✓ WIRED | Lines 167-169 |
| `paintStore.setBrushColor` | FX cache refresh | lazy-loaded `layerStore`/`timelineStore` + `invalidateFrameFxCache + refreshFrameFx` | ✓ WIRED | Lines 545-557 |
| `brushP5Adapter.ts` cache key | stroke color (`s.color`) | included in key string | ✓ WIRED | `` `${s.id}:${s.brushStyle}:${s.color}:...` `` |
| `PaintOverlay.tsx` stroke creation | `paintStore.brushStyle.peek()` | stamped at creation | ✓ WIRED | Line 2027 |
| `paintPreferences.ts` | `LazyStore('app-config.json')` | `new LazyStore('app-config.json')` | ✓ WIRED | Line 3 |
| `paintStore.initFromPreferences` | `activePaintMode.value` restoration | `loadPaintMode()` result applied | ✓ WIRED | Lines 538-548 (operative second definition) |
| `main.tsx` | `paintStore.initFromPreferences()` | direct call at startup | ✓ WIRED | main.tsx line 20 |
| `PaintCursor.tsx` | `paintStore.brushSize.value` | signal subscription | ✓ WIRED | PaintCursor.tsx line 13 |
| `PaintOverlay handlePointerMove` | `cursorPos` via `containerRef` | `containerRef.getBoundingClientRect()` | ✓ WIRED | Line 1329 |
| `PaintModeSelector.tsx` conversion dialog | `createPortal` with dark overlay | `style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}` | ✓ WIRED | Lines 122, 125 |
| `InlineColorPicker` prop sync | `isExternalUpdate` ref guard | prevents onChange re-trigger | ✓ WIRED | Lines 38-72 |
| `PaintProperties toggle button` | `paintStore.showInlineColorPicker` | `paintStore.toggleInlineColorPicker()` | ✓ WIRED | PaintProperties.tsx lines 392, 820 |
| `CanvasArea.tsx` | `InlineColorPicker` component | import + conditional render guarded by `showInlineColorPicker.value` | ✓ WIRED | Lines 12, 368-399 |
| `paintStore.togglePaintMode` | `showInlineColorPicker.value = false` | direct assignment when exiting paint mode | ✓ WIRED | paintStore.ts line 515 |
| `PaintProperties Animate button` | `distributeStrokeBySpeed` | dynamic import on confirm | ✓ WIRED | Line 578-581 |
| `PaintProperties handleAnimate` | iterates ALL selectedStrokeIds | `strokes.map(id => ...)` loop | ✓ WIRED | Lines 567-570 |
| `AddFxMenu.tsx` paint layer creation | `paintStore.togglePaintMode()` | direct call after `setSelected` | ✓ WIRED | Lines 123-125 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PaintCursor.tsx` | `brushSize` | `paintStore.brushSize.value` (signal) | Yes | ✓ FLOWING |
| `InlineColorPicker.tsx` | `recentColors` | `loadRecentColors()` → LazyStore `app-config.json` | Yes (persistent store) | ✓ FLOWING |
| `PaintModeSelector.tsx` | `activeMode` | `paintStore.activePaintMode.value` (signal) | Yes | ✓ FLOWING |
| `CanvasArea.tsx` | `showInlineColorPicker` | `paintStore.showInlineColorPicker.value` (signal) | Yes | ✓ FLOWING |
| `PaintProperties.tsx` | Animate frame range | `fxTrackLayouts.value` / `trackLayouts.value` computed signals | Yes | ✓ FLOWING |
| `paintRenderer.ts` | background color | `currentMode === 'fx-paint' ? '#ffffff' : paintStore.paintBgColor.peek()` | Yes (mode-aware) | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — Tauri desktop app; no runnable entry points without launching the full application.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| ECUR-01 | Plans 01, 09 | Cmd+Z re-renders canvas for flat and FX strokes | ✓ SATISFIED | All undo/redo closures call `_notifyVisualChange` + FX cache invalidation (79 call sites total) |
| ECUR-02 | Plan 01 | FX brush style applies during drawing | ✓ SATISFIED | `brushStyle: paintStore.brushStyle.peek()` stamped at stroke creation; FX refresh after add |
| ECUR-03 | Plans 02, 09 | Brush color/size persist, default #203769/35px | ✓ SATISFIED | `paintPreferences.ts` + `initFromPreferences` in main.tsx; mode persistence added |
| ECUR-04 | Plans 02, 10 | Circle cursor scales with zoom | ✓ SATISFIED | `diameter = brushSize * zoom`; `mixBlendMode: difference`; containerRef coords |
| ECUR-05 | Plan 01 | Creating paint layer auto-enters paint mode | ✓ SATISFIED | `togglePaintMode()` in AddFxMenu.tsx line 124 |
| ECUR-06 | Plans 01, 09 | Clear Brush instant, Cmd+Z undoes with re-render | ✓ SATISFIED | No `confirmClear` in PaintProperties; clearFrame all paths notify + invalidate FX |
| ECUR-07 | Plans 01, 10 | Exit Paint Mode button orange with pulsate animation | ✓ SATISFIED | `#f97316`, scale + glow pulsate at PaintProperties.tsx lines 110-123 |
| ECUR-08 | Plan 01 | STROKES panel before SELECTION in sidebar | ✓ SATISFIED | StrokeList at line 266, before SectionLabel "SELECTION" at line 274 |
| ECUR-09 | Plans 04, 09, 10 | Three brush modes with per-frame exclusivity and dark modal dialogs | ✓ SATISFIED | PaintModeSelector with createPortal dark overlay; getFrameMode enforcement |
| ECUR-10 | Plans 05, 08, 11 | Inline color picker 4 modes, HEX, auto-apply, persistent swatches, **on canvas side** | ✓ SATISFIED | 4 modes functional, re-render loop fixed, swatches persistent. **Picker now renders in CanvasArea.tsx (line 368-399) as a 260px panel to the left of the canvas** — satisfies "on canvas side" from REQUIREMENTS.md. Toggle via `paintStore.showInlineColorPicker` signal. |
| ECUR-11 | Plan 03 | Modal picker: no buttons, no overlay, near-mouse | ✓ SATISFIED | `ColorPickerModal.tsx` transparent backdrop, no Apply/Cancel, bounds-clamped mouse position |
| ECUR-12 | Plan 06 | FX stroke wireframe overlay + bounding box hit testing | ✓ SATISFIED | `renderFxWireframe` + `renderFxStrokeBounds` in PaintOverlay.tsx; FX bounding box hit test |
| ECUR-13 | Plans 07, 10 | Speed-based stroke animation with atomic undo, multi-selection | ✓ SATISFIED | `distributeStrokeBySpeed`; Animate iterates all selectedStrokeIds; single `pushAction` |

**All 13 requirements (ECUR-01 through ECUR-13) are satisfied.**

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PaintModeSelector.tsx` | 29, 113 | `physic-paint` returns early; tooltip says 'coming soon' | Info | Intentional — physic-paint is a declared placeholder by spec (ECUR-09 explicitly requires grayed-out placeholder) |
| `paintStore.ts` | 108, 137, 532, 538 | Duplicate `setActivePaintMode` (lines 137, 532) and `initFromPreferences` (lines 108, 538) method definitions | Warning | Pre-existing from plan 09; not introduced by plan 11. In JS object literals, last definition wins — operative definitions at lines 532/538 are functionally correct. `setActivePaintMode` at line 532 is missing the `brushStyle` auto-sync from line 137 (watercolor default on FX mode), but PaintModeSelector handles this via `selectedFxStyle` state. Does not block any requirement. Should be cleaned up. |

### Human Verification Required

#### 1. Cmd+Z Undo Visual Re-render for FX Strokes

**Test:** Draw 3-4 FX strokes (watercolor), press Cmd+Z three times. Observe canvas.
**Expected:** Each undo removes exactly one FX stroke with no stale pixels or partial renders.
**Why human:** Canvas render correctness after FX cache invalidation requires visual inspection in running Tauri app.

#### 2. FX Brush Style Applies Immediately During Drawing

**Test:** Enter FX paint mode, select 'watercolor', draw a stroke.
**Expected:** Stroke renders with watercolor diffusion immediately — not as flat stroke requiring re-apply.
**Why human:** p5.brush visual output quality requires running app + visual inspection.

#### 3. Circle Cursor Alignment and Visibility

**Test:** Open paint layer, brush 35px, zoom to 200%. Move cursor over canvas image background.
**Expected:** Circle cursor visible on any background (mixBlendMode:difference), cursor center aligns with where paint actually appears.
**Why human:** Coordinate alignment accuracy and visual contrast require running app. containerRef fix is in place but exact alignment depends on layout hierarchy.

#### 4. Brush Preferences Persist Across App Restart

**Test:** Set brush to red (#FF0000), size 20, FX mode. Quit app. Relaunch. Enter paint mode.
**Expected:** Brush color is red, size is 20, mode is FX Paint.
**Why human:** Requires actual Tauri app restart to verify LazyStore (app-config.json) persistence. Code paths confirmed but runtime behavior needs human test.

#### 5. Paint Mode Conversion Dialog Blocks Interaction

**Test:** Draw a flat stroke, click FX Paint in mode selector.
**Expected:** Dialog appears with dark semi-transparent overlay covering entire app; clicking outside overlay dismisses; dialog is visually prominent warning.
**Why human:** createPortal z-index stacking in Tauri webview needs visual confirmation; rgba(0,0,0,0.5) overlay code is correct but render depth in app layout requires confirmation.

#### 6. Inline Color Picker Adjacent to Canvas

**Test:** Enter paint mode on any layer, click the color swatch/picker toggle in PaintProperties. Observe layout.
**Expected:** A 260px color picker panel appears to the left of the canvas area (between sidebar and canvas); canvas shrinks horizontally to accommodate. All 4 modes (Box/TSL/RVB/CMYK) and swatches are accessible.
**Why human:** Layout rendering in Tauri webview needs visual confirmation of correct flex positioning and 260px panel width.

### Gaps Summary

No gaps remain. All 9 observable truths verified. All 13 requirements satisfied.

**Gap closed since previous verification:**
- ECUR-10 positioning: Plan 11 (commit `699c4ce`) moved InlineColorPicker from `PaintProperties.tsx` (sidebar) to `CanvasArea.tsx` (canvas-adjacent panel). The component now renders at lines 368-399 in `CanvasArea.tsx` as a 260px flex panel to the left of the canvas container. Visibility controlled by shared `paintStore.showInlineColorPicker` signal instead of local `useState`. Toggle buttons in `PaintProperties.tsx` (lines 392, 820) now call `paintStore.toggleInlineColorPicker()`. Picker auto-closes on `togglePaintMode()` (paintStore.ts line 515).

**Known technical debt (not blocking):**
- Duplicate method definitions in `paintStore.ts` (pre-existing from plan 09, not plan 11). The operative last-definition semantics mean the app functions correctly, but the dead first definitions should be removed in a future cleanup.

---

_Verified: 2026-04-05T12:45:00Z_
_Verifier: Claude (gsd-verifier) — re-verification after plan 11 gap closure_
