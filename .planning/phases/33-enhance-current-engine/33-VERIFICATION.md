---
phase: 33-enhance-current-engine
verified: 2026-04-05T12:10:10Z
status: gaps_found
score: 8/9 must-haves verified
re_verification:
  previous_status: passed
  previous_score: 9/9
  note: "Previous verification was written alongside SUMMARY before UAT completed. This is a fresh independent verification against actual codebase post-UAT gap-closure (plans 08-10)."
  regressions: []
gaps:
  - truth: "Inline color picker is positioned near/on canvas side (not in sidebar)"
    status: partial
    reason: "ECUR-10 in REQUIREMENTS.md specifies 'on canvas side'. UAT test 14 flagged position as a reported issue. InlineColorPicker is rendered at the bottom of PaintProperties sidebar (line 1281), not positioned near the canvas. Gap-closure plan 08 only fixed the re-render loop; positioning was not addressed. ROADMAP success criterion 6 omits the positioning requirement, making this a REQUIREMENTS.md vs ROADMAP discrepancy."
    artifacts:
      - path: "app/src/components/sidebar/PaintProperties.tsx"
        issue: "InlineColorPicker rendered at line 1281 inside sidebar component, not adjacent to canvas area"
    missing:
      - "Move InlineColorPicker render site to CanvasArea or paint canvas overlay region, or resolve the REQUIREMENTS.md vs ROADMAP positioning discrepancy by updating one of them"
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
---

# Phase 33: Enhance Current Paint Engine — Verification Report

**Phase Goal:** Current paint engine (perfect-freehand + p5.brush) receives bug fixes, UX improvements, paint mode system, inline color picker, and stroke animation
**Verified:** 2026-04-05T12:10:10Z
**Status:** gaps_found
**Re-verification:** Yes — previous VERIFICATION.md showed `passed` but was written before UAT. This is an independent fresh verification post UAT gap-closure (plans 08-10 executed).

## Goal Achievement

### Observable Truths (from ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Cmd+Z after any paint operation immediately re-renders canvas with correct visual state (flat and FX) | ✓ VERIFIED | `clearFrame` and `addElement` undo/redo closures all call `_notifyVisualChange` + `invalidateFrameFxCache` + `refreshFrameFx` (paintStore.ts lines 159-304, 419-431). 30+ call sites confirmed. |
| 2 | FX brush style selection actually applies during drawing | ✓ VERIFIED | PaintOverlay.tsx line 2027: `brushStyle: paintStore.brushStyle.peek()` stamped at stroke creation; `invalidateFrameFxCache` + `refreshFrameFx` called after addElement when `brushStyle !== 'flat'` (lines 2033-2036). |
| 3 | Brush color/size persist across sessions, defaulting to #203769/35px | ✓ VERIFIED | `paintPreferences.ts` exports `loadBrushPreferences`/`saveBrushColor`/`saveBrushSize`/`loadPaintMode`/`savePaintMode`; defaults #203769/35px at lines 11-12; `initFromPreferences()` called in main.tsx line 20. |
| 4 | Circle cursor at brush size scales with zoom | ✓ VERIFIED | `PaintCursor.tsx` line 14: `const diameter = brushSize * zoom`; `mixBlendMode: 'difference'` for visibility; cursor position uses `containerRef.getBoundingClientRect()` at PaintOverlay line 1329 for coordinate alignment with paint system. |
| 5 | 3-mode paint system (flat/FX/physical-placeholder) with per-frame exclusivity | ✓ VERIFIED | `PaintModeSelector.tsx`: 3 mode buttons, physic-paint guarded at line 29; conversion dialog uses `createPortal` with `rgba(0,0,0,0.5)` dark overlay (line 125); `getFrameMode` + mode stamp at stroke creation enforces per-frame exclusivity. |
| 6 | Inline color picker with 4 modes (Box/TSL/RVB/CMYK) and persistent swatches | ✗ FAILED | 4 modes present and re-render loop fixed (isExternalUpdate ref guard at InlineColorPicker.tsx lines 38-72). Swatches persistent via paintPreferences. However, ECUR-10 in REQUIREMENTS.md specifies "on canvas side" — picker is rendered in PaintProperties sidebar (line 1281), not adjacent to canvas. ROADMAP success criterion omits positioning, creating a requirements/roadmap discrepancy. |
| 7 | Modal color picker: no buttons, no overlay, positioned near mouse | ✓ VERIFIED | `ColorPickerModal.tsx`: `background: 'transparent'` for backdrop (line 326); no `onApply`/`onCancel` props; `mouseX`/`mouseY` props with `Math.min`/`Math.max` bounds clamping (lines 297-304). |
| 8 | Selected FX strokes show wireframe overlay for easy grab | ✓ VERIFIED | `renderFxWireframe()` (line 399) and `renderFxStrokeBounds()` (line 432) in PaintOverlay.tsx; integrated at line 806-811 in `renderLivePreview`; bounding-box hit testing for FX strokes at line 104. |
| 9 | Stroke draw-reveal animation distributes points across frames by speed | ✓ VERIFIED | `strokeAnimation.ts`: `distributeStrokeBySpeed` exported with inverse distance weighting and 0.5 min clamp; Animate button enabled for any selection size > 0 (line 526); iterates all selected strokes (lines 566-583); single `pushAction` for atomic undo (line 622); `paintVersion.value++` in apply/undo/redo. |

**Score:** 8/9 truths verified (1 gap: inline picker positioning vs REQUIREMENTS.md)

### Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `app/src/stores/paintStore.ts` (854 lines) | Fixed undo closures, FX cache, mode system | ✓ VERIFIED | `_notifyVisualChange` in all undo/redo closures; `clearFrame` with immediate FX invalidation; `setBrushColor` with FX refresh; `activePaintMode` signal with persistence |
| `app/src/components/canvas/PaintOverlay.tsx` (2417 lines) | Stroke creation with brushStyle, PaintCursor, wireframe | ✓ VERIFIED | `brushStyle.peek()` at creation (line 2027); `PaintCursor` imported and rendered (lines 6, 2409); `renderFxWireframe/Bounds` at lines 399/432 |
| `app/src/components/sidebar/PaintProperties.tsx` (1311 lines) | Orange exit button, STROKES first, Animate multi-selection | ✓ VERIFIED | `#f97316` + scale/glow pulsate at lines 110-123; StrokeList at line 266 before SELECTION SectionLabel at line 274; Animate `disabled={size === 0}` at line 526 |
| `app/src/components/timeline/AddFxMenu.tsx` | Auto-enter paint mode on layer creation | ✓ VERIFIED | `togglePaintMode()` called at lines 122-125 after `setSelected` |
| `app/src/lib/paintPreferences.ts` (46 lines) | Brush/mode persistence via LazyStore | ✓ VERIFIED | All 8 functions present: `loadBrushPreferences`, `saveBrushColor`, `saveBrushSize`, `loadRecentColors`, `saveRecentColors`, `loadFavoriteColors`, `saveFavoriteColors`, `savePaintMode`/`loadPaintMode`. NOTE: uses `app-config.json` (not dedicated `paint-preferences.json` as SUMMARY claimed — functionally equivalent). |
| `app/src/components/canvas/PaintCursor.tsx` (36 lines) | Circle cursor overlay | ✓ VERIFIED | `diameter = brushSize * zoom`; `borderRadius: '50%'`; `mixBlendMode: 'difference'`; `boxShadow` for contrast |
| `app/src/types/paint.ts` | PaintMode type, updated defaults | ✓ VERIFIED | `PaintMode = 'flat' \| 'fx-paint' \| 'physic-paint'`; `DEFAULT_BRUSH_COLOR='#203769'`; `DEFAULT_BRUSH_SIZE=35`; `DEFAULT_PAINT_BG_COLOR='transparent'` (lines 8, 131, 134, 135) |
| `app/src/components/shared/ColorPickerModal.tsx` (630 lines) | No-button, no-overlay, mouse-positioned modal | ✓ VERIFIED | `background: 'transparent'` backdrop (line 326); `mouseX`/`mouseY` props (lines 23-24); bounds clamping at lines 297-304; no Apply/Cancel props or buttons found |
| `app/src/components/sidebar/PaintModeSelector.tsx` (195 lines) | 3-mode toggle with dark modal conversion dialog | ✓ VERIFIED | 3 mode buttons; physic-paint guarded (line 29); `createPortal` dialog with `rgba(0,0,0,0.5)` overlay (lines 122, 125) |
| `app/src/lib/colorUtils.ts` (111 lines) | 8 color conversion functions | ✓ VERIFIED | Exactly 8 exported functions: `hexToRgba`, `rgbaToHex`, `rgbToHsl`, `hslToRgb`, `rgbToHsv`, `hsvToRgb`, `rgbToCmyk`, `cmykToRgb` |
| `app/src/components/sidebar/InlineColorPicker.tsx` (486 lines) | 4-mode inline color picker with swatches, no re-render loop | ✓ VERIFIED | Box/TSL/RVB/CMYK modes; HSV canvas; HEX input (line 463); `isExternalUpdate` ref guard (lines 38-72) prevents circular re-render; `loadRecentColors`/`saveFavoriteColors` wired |
| `app/src/lib/strokeAnimation.ts` (83 lines) | Speed-based point distribution algorithm | ✓ VERIFIED | `distributeStrokeBySpeed` exported; inverse distance weighting; 0.5 minimum clamp (line 33); last frame includes all points (lines 67-69) |
| `app/src/lib/paintRenderer.ts` (297 lines) | Mode-aware background: white for FX, transparent for flat | ✓ VERIFIED | `renderPaintFrameWithBg` at line 209: `bgColor = currentMode === 'fx-paint' ? '#ffffff' : paintStore.paintBgColor.peek()`; `clearRect` for transparent at lines 210-211 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `paintStore.clearFrame` immediate execution | `invalidateFrameFxCache + refreshFrameFx` | direct calls after `_notifyVisualChange` | ✓ WIRED | Lines 412-414 |
| `paintStore.clearFrame` undo closure | `_notifyVisualChange + invalidateFrameFxCache + refreshFrameFx` | direct calls | ✓ WIRED | Lines 422-424 |
| `paintStore.clearFrame` redo closure | `_notifyVisualChange + invalidateFrameFxCache + refreshFrameFx` | direct calls | ✓ WIRED | Lines 429-431 |
| `paintStore.addElement` undo closure | `_notifyVisualChange + invalidateFrameFxCache + refreshFrameFx` | direct calls | ✓ WIRED | Lines 167-169 |
| `paintStore.setBrushColor` | FX cache refresh | lazy-loaded `layerStore`/`timelineStore` + `invalidateFrameFxCache + refreshFrameFx` | ✓ WIRED | Lines 545-557 |
| `brushP5Adapter.ts` cache key | stroke color (`s.color`) | included in key string | ✓ WIRED | Line 202: `` `${s.id}:${s.brushStyle}:${s.color}:...` `` |
| `PaintOverlay.tsx` stroke creation | `paintStore.brushStyle.peek()` | stamped at creation | ✓ WIRED | Line 2027 |
| `paintPreferences.ts` | `LazyStore('app-config.json')` | `new LazyStore('app-config.json')` | ✓ WIRED | Line 3 |
| `paintStore.initFromPreferences` | `activePaintMode.value` restoration | `loadPaintMode()` result applied | ✓ WIRED | Lines 534-537 |
| `main.tsx` | `paintStore.initFromPreferences()` | direct call at startup | ✓ WIRED | main.tsx line 20 |
| `PaintCursor.tsx` | `paintStore.brushSize.value` | signal subscription | ✓ WIRED | PaintCursor.tsx line 13 |
| `PaintOverlay handlePointerMove` | `cursorPos` via `containerRef` | `containerRef.getBoundingClientRect()` | ✓ WIRED | Line 1329 |
| `PaintModeSelector.tsx` conversion dialog | `createPortal` with dark overlay | `style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}` | ✓ WIRED | Lines 122, 125 |
| `InlineColorPicker` prop sync | `isExternalUpdate` ref guard | prevents onChange re-trigger | ✓ WIRED | Lines 38-72 |
| `InlineColorPicker` | `paintStore.setBrushColor` | `onChange` callback in PaintProperties | ✓ WIRED | PaintProperties.tsx line 1286 |
| `PaintProperties Animate button` | `distributeStrokeBySpeed` | dynamic import on confirm | ✓ WIRED | Line 580 |
| `PaintProperties handleAnimate` | iterates ALL selectedStrokeIds | `strokes.map(id => ...)` loop | ✓ WIRED | Lines 567-570 |
| `AddFxMenu.tsx` paint layer creation | `paintStore.togglePaintMode()` | direct call after `setSelected` | ✓ WIRED | Lines 123-125 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PaintCursor.tsx` | `brushSize` | `paintStore.brushSize.value` (signal) | Yes | ✓ FLOWING |
| `InlineColorPicker.tsx` | `recentColors` | `loadRecentColors()` → LazyStore `app-config.json` | Yes (persistent store) | ✓ FLOWING |
| `PaintModeSelector.tsx` | `activeMode` | `paintStore.activePaintMode.value` (signal) | Yes | ✓ FLOWING |
| `PaintProperties.tsx` | Animate frame range | `fxTrackLayouts.value` / `trackLayouts.value` computed signals | Yes | ✓ FLOWING |
| `paintRenderer.ts` | background color | `currentMode === 'fx-paint' ? '#ffffff' : paintStore.paintBgColor.peek()` | Yes (mode-aware) | ✓ FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — Tauri desktop app; no runnable entry points without launching the full application.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| ECUR-01 | Plans 01, 09 | Cmd+Z re-renders canvas for flat and FX strokes | ✓ SATISFIED | All undo/redo closures call `_notifyVisualChange` + FX cache invalidation (30+ sites) |
| ECUR-02 | Plan 01 | FX brush style applies during drawing | ✓ SATISFIED | `brushStyle: paintStore.brushStyle.peek()` stamped at stroke creation; FX refresh after add |
| ECUR-03 | Plans 02, 09 | Brush color/size persist, default #203769/35px | ✓ SATISFIED | `paintPreferences.ts` + `initFromPreferences` in main.tsx; mode persistence added |
| ECUR-04 | Plans 02, 10 | Circle cursor scales with zoom | ✓ SATISFIED | `diameter = brushSize * zoom`; `mixBlendMode: difference`; containerRef coords |
| ECUR-05 | Plan 01 | Creating paint layer auto-enters paint mode | ✓ SATISFIED | `togglePaintMode()` in AddFxMenu.tsx line 124 |
| ECUR-06 | Plans 01, 09 | Clear Brush instant, Cmd+Z undoes with re-render | ✓ SATISFIED | No `confirmClear` in PaintProperties; clearFrame all paths notify + invalidate FX |
| ECUR-07 | Plans 01, 10 | Exit Paint Mode button orange with pulsate animation | ✓ SATISFIED | `#f97316`, scale + glow pulsate at PaintProperties.tsx lines 110-123 |
| ECUR-08 | Plan 01 | STROKES panel before SELECTION in sidebar | ✓ SATISFIED | StrokeList at line 266, before SectionLabel "SELECTION" at line 274 |
| ECUR-09 | Plans 04, 09, 10 | Three brush modes with per-frame exclusivity and dark modal dialogs | ✓ SATISFIED | PaintModeSelector with createPortal dark overlay; getFrameMode enforcement |
| ECUR-10 | Plans 05, 08 | Inline color picker 4 modes, HEX, auto-apply, persistent swatches | ⚠️ PARTIAL | 4 modes functional, re-render fixed, swatches persistent. REQUIREMENTS.md says "on canvas side" — picker is in sidebar. ROADMAP success criterion omits positioning. Functional requirement met; position requirement from REQUIREMENTS.md not met. |
| ECUR-11 | Plan 03 | Modal picker: no buttons, no overlay, near-mouse | ✓ SATISFIED | `ColorPickerModal.tsx` transparent backdrop, no Apply/Cancel, bounds-clamped mouse position |
| ECUR-12 | Plan 06 | FX stroke wireframe overlay + bounding box hit testing | ✓ SATISFIED | `renderFxWireframe` + `renderFxStrokeBounds` in PaintOverlay.tsx; FX bounding box hit test |
| ECUR-13 | Plans 07, 10 | Speed-based stroke animation with atomic undo, multi-selection | ✓ SATISFIED | `distributeStrokeBySpeed`; Animate iterates all selectedStrokeIds; single `pushAction` |

**Note on ROADMAP plan count discrepancy:** ROADMAP.md shows `8/10 plans executed` with plan 09 unchecked (`[ ] 33-09-PLAN.md`). However, `33-09-SUMMARY.md` exists and confirms execution (completed 2026-04-05T11:59:45Z). All code changes from plan 09 are verified in the codebase. The ROADMAP metadata was not updated after plan 09 execution — this is a documentation discrepancy only.

**Note on paintPreferences.ts store file:** The 33-09-SUMMARY.md claims "Created dedicated paint-preferences.json Tauri store file" but the actual code uses `new LazyStore('app-config.json')`. This is a SUMMARY/code discrepancy. Functionally the persistence works correctly; the preference data is stored under app-config.json keys.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `PaintModeSelector.tsx` | 29, 113 | `physic-paint` returns early; tooltip says 'coming soon' | Info | Intentional — physic-paint is a declared placeholder by spec (ECUR-09 explicitly requires grayed-out placeholder) |

No blocker or warning anti-patterns found.

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

### Gaps Summary

**1 gap found** (ECUR-10 positioning):

The InlineColorPicker is rendered at the bottom of the PaintProperties sidebar component (line 1281 in PaintProperties.tsx). REQUIREMENTS.md ECUR-10 specifies "on canvas side" positioning. The user's UAT feedback (test 14) explicitly requested the picker be positioned near the canvas "like the mini palette at top." Gap-closure plan 08 addressed only the re-render loop bug, not the positioning.

However, the ROADMAP success criterion for phase 33 (criterion #6) states only "Inline color picker with 4 modes (Box/TSL/RVB/CMYK) and persistent swatches" — no positioning requirement. This creates a discrepancy between REQUIREMENTS.md and ROADMAP.md.

**Resolution options:**
1. Move InlineColorPicker render site to CanvasArea or as a canvas-adjacent overlay (satisfies ECUR-10 as written)
2. Update REQUIREMENTS.md to remove "on canvas side" from ECUR-10 (accepts current sidebar placement as-is)

**All other 8 success criteria are fully verified** with code evidence. The 10 UAT-reported issues have been addressed by plans 08-10, with the exception of InlineColorPicker positioning.

---

_Verified: 2026-04-05T12:10:10Z_
_Verifier: Claude (gsd-verifier) — independent fresh verification against actual codebase_
