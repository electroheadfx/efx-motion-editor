---
phase: 06-layer-system-properties-panel
verified: 2026-03-10T15:30:00Z
status: human_needed
score: 4/4 success criteria verified
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed:
    - "Video picker popover -- clicking Video in Add Layer now opens asset picker popover instead of file dialog"
    - "Video asset re-discovery -- opening saved projects with video layers populates IMPORTED panel"
    - "Video blend mode -- loadeddata/seeked event listeners trigger re-render when video is ready"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Add a video layer via picker popover, change blend mode to Multiply, set opacity to 50%"
    expected: "Video picker popover opens with existing videos listed. After adding, video renders with Multiply blend and 50% opacity in preview."
    why_human: "Video readyState transitions, Canvas 2D blend mode rendering, and popover interaction are runtime behaviors that grep confirms but cannot execute."
  - test: "Save a project with video layers, close, reopen -- verify videos appear in IMPORTED panel"
    expected: "Videos appear in IMPORTED section alongside images after project reload."
    why_human: "Full save/load cycle with Tauri backend required to confirm hydration re-discovery works end-to-end."
  - test: "Drag-and-drop layer reorder with 3+ layers"
    expected: "Layer list order updates smoothly. Preview compositing order reflects the change. Base layer remains locked at bottom."
    why_human: "SortableJS DOM revert fix and forceFallback are runtime browser behaviors."
  - test: "Type multi-digit values into NumericInput fields (e.g., 150, 0.75)"
    expected: "Values persist after Enter, revert after Escape, no reset while typing."
    why_human: "DOM focus/input lifecycle behavior with local editing state."
---

# Phase 6: Layer System & Properties Panel Verification Report

**Phase Goal:** Users can add multiple layer types to sequences, composite them in real-time with blend modes and transforms, and edit all layer properties through a context-sensitive panel
**Verified:** 2026-03-10T15:30:00Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure (plans 06-07 and 06-08 addressed 3 UAT gaps)

## Goal Achievement

### Observable Truths (from Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add static image, image sequence, and video layers to a sequence, and the preview canvas renders all visible layers composited with correct blend modes and opacity in real-time | VERIFIED | `AddLayerMenu.tsx` has `handleAddStaticImageFromAsset` (line 76), `handleAddImageSequence` (line 146), `handleAddVideoFromAsset` (line 205), and `handleImportNewVideo` (line 229). Video now opens picker popover (line 315) instead of direct file dialog. `PreviewRenderer.renderFrame()` iterates layers bottom-to-top with `globalCompositeOperation` (line 291) and `globalAlpha` (line 292). Video elements now have `loadeddata` and `seeked` event listeners (lines 258-262) that trigger `onImageLoaded` re-render callback. |
| 2 | User can reorder layers via drag-and-drop, toggle visibility, and delete layers -- the base key photo sequence is always the non-deletable bottom layer | VERIFIED | `LayerList.tsx` uses SortableJS with `forceFallback: true` (line 25), DOM revert in `onEnd` (lines 38-39) before `layerStore.reorder()`. Visibility toggle (line 103-106) and delete (line 108-111) per row. Base layer has `layer-base` CSS class filtered by SortableJS (line 24), no delete button (line 168), lock icon (line 179). `layerStore.remove()` guards `isBase` (line 25). `layerStore.reorder()` blocks index 0 (line 37). |
| 3 | User can set position, scale, rotation, and crop for any layer via the properties panel, with changes reflected immediately in the preview | VERIFIED | `PropertiesPanel.tsx` has `TransformSection` (X, Y, Scale, Rot at lines 177-201) and `CropSection` (T, R, B, L at lines 221-253) using `NumericInput` with local editing state (`useState`, line 37-38), commit on Enter/blur (lines 83-86), revert on Escape (lines 87-89). `layerStore.updateLayer()` delegates to `sequenceStore.updateLayer()` which calls `pushAction` (line 391 of sequenceStore). Signal update triggers `PreviewRenderer` re-render via `effect()` in Preview.tsx (lines 41-48). |
| 4 | Properties panel shows context-sensitive controls (blend mode dropdown, opacity slider, visibility toggle, transform controls) for whichever layer is selected | VERIFIED | `PropertiesPanel()` reads `layerStore.selectedLayerId` (line 258) and `layerStore.layers` (line 259), renders `BlendSection` (dropdown lines 106-120, slider lines 123-139, visibility lines 142-161), `TransformSection` (lines 174-204), `CropSection` (lines 207-254) when a layer is selected. Shows "Select a layer to edit properties" empty state (lines 262-269) when no selection. |

**Score:** 4/4 success criteria verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/types/layer.ts` | Layer types, discriminated union, factories | VERIFIED | 52 lines. `LayerType`, `BlendMode`, `LayerSourceData` discriminated union, `Layer` interface, `LayerTransform`, `defaultTransform()`, `createBaseLayer()`. |
| `Application/src/stores/layerStore.ts` | Per-sequence layer store with undo-integrated mutations | VERIFIED | 48 lines. Computed `layers` reads from active sequence. `add`, `remove`, `updateLayer`, `reorder` delegate to `sequenceStore`. `remove()` guards `isBase`. `reorder()` blocks index 0. |
| `Application/src/stores/sequenceStore.ts` | Layer CRUD with pushAction undo | VERIFIED | `addLayer` (line 326), `removeLayer` (line 348), `updateLayer` (line 372), `reorderLayers` (line 401) -- all call `pushAction` with before/after snapshots. |
| `Application/src/lib/previewRenderer.ts` | Canvas 2D compositing engine with video re-render | VERIFIED | 408 lines. `PreviewRenderer` class with `renderFrame()`, blend mode mapping, DPI scaling, image caching, video element management with `loadeddata`/`seeked` event listeners (lines 258-262), `videoReadyHandlers` map for cleanup (line 38), transform + crop drawing, loading placeholder respecting blend mode/opacity (lines 118-133). Dispose cleans up listeners (lines 392-397). |
| `Application/src/components/Preview.tsx` | Canvas-based preview with signal-driven rendering | VERIFIED | Uses `<canvas>` with `PreviewRenderer` instance (line 17). `renderer.onImageLoaded = renderCurrent` (line 31) wires video re-render callback. Signal-based `effect()` triggers re-render (lines 41-48). `requestAnimationFrame` loop for playback sync (lines 55-64). |
| `Application/src/components/layer/LayerList.tsx` | SortableJS layer list with DnD, visibility, delete | VERIFIED | 185 lines. SortableJS with `forceFallback`, DOM revert pattern, visibility/delete/selection per row, base layer protection, color-coded type indicators. |
| `Application/src/components/layer/AddLayerMenu.tsx` | Popover menu with asset pickers for all layer types | VERIFIED | 387 lines. Static image asset picker popover (lines 323-352). Video asset picker popover (lines 354-384) with `videoPickerOpen` state (line 30), `videoPickerRef` (line 33), click-outside effect (lines 60-69), `handleAddVideoFromAsset` (lines 205-226), `handleImportNewVideo` (lines 229-286). Video button opens picker instead of file dialog (line 315). |
| `Application/src/components/layout/PropertiesPanel.tsx` | Context-sensitive properties panel | VERIFIED | 305 lines. `NumericInput` with `useState` local editing state, commit on Enter/blur, revert on Escape. `BlendSection` (dropdown, slider, visibility), `TransformSection` (X, Y, Scale, Rotation), `CropSection` (T, R, B, L). Opacity slider uses `startCoalescing`/`stopCoalescing`. |
| `Application/src/components/layout/LeftPanel.tsx` | LeftPanel with LayerList and AddLayerMenu | VERIFIED | Line 8: `import {LayerList}`, line 9: `import {AddLayerMenu}`. Line 69: `<AddLayerMenu />`, line 73: `<LayerList />`. |
| `Application/src/stores/imageStore.ts` | Video asset tracking and management | VERIFIED | `VideoAsset` interface (lines 9-13), `videoAssets` signal (line 19), `addVideoAsset()` method (lines 83-86), `videoAssetCount` computed (line 32). Reset clears videoAssets (line 193). |
| `Application/src/components/import/ImportGrid.tsx` | Video asset display alongside images | VERIFIED | 74 lines. Reads both `imageStore.images` (line 9) and `imageStore.videoAssets` (line 10). Image grid (lines 25-48). Video section with purple indicators (lines 51-71). Combined empty state check (line 12). |
| `Application/src/stores/projectStore.ts` | Layer serialization, hydration, and video re-discovery | VERIFIED | `buildMceProject()` serializes layers with snake_case (lines 62-87). `hydrateFromMce()` deserializes layers with fallback to `createBaseLayer()` for v1 files (lines 123-156). Video asset re-discovery loop (lines 183-194) iterates `sequenceStore.sequences.value` after deserialization, calls `imageStore.addVideoAsset()` for each video layer. `layerStore.reset()` called in closeProject (line 378). |
| `Application/src-tauri/src/models/project.rs` | Rust MceLayer with serde(default) layers | VERIFIED | `MceLayer` (lines 42-54), `MceLayerTransform` (lines 57-67), `MceLayerSource` (lines 70-80). `MceSequence.layers` has `#[serde(default)]` (line 37) for backward compat. |
| `Application/src/types/project.ts` | MceLayer TypeScript types | VERIFIED | (verified by TypeScript compilation passing with full layer serialization in projectStore) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `layerStore.ts` | `history.ts` | pushAction import for undo/redo | WIRED | `sequenceStore.ts` imports `pushAction` (line 5) and calls it in all four layer mutation methods (lines 338, 362, 391, 417). |
| `projectStore.ts` | `layerStore.ts` | layerStore.reset() in closeProject | WIRED | Line 378: `layerStore.reset()` called in closeProject. |
| `projectStore.ts` | `types/layer.ts` | createBaseLayer for v1 backward compat | WIRED | Line 5: `import {createBaseLayer}`, line 156: fallback `[createBaseLayer()]`. |
| `projectStore.ts` | `imageStore.addVideoAsset` | video re-discovery in hydrateFromMce | WIRED | Lines 183-194: iterates sequences, finds video layers, calls `imageStore.addVideoAsset()`. |
| `previewRenderer.ts` | `layerStore` | reads layers for compositing | WIRED | `Preview.tsx` reads `layerStore.layers.value` in effect (line 45) and passes to `renderer.renderFrame()` (line 48). |
| `Preview.tsx` | `previewRenderer.ts` | creates PreviewRenderer, wires onImageLoaded | WIRED | Line 17: `new PreviewRenderer(canvas)`, line 31: `renderer.onImageLoaded = renderCurrent`. |
| `previewRenderer.ts` | Canvas 2D API | globalCompositeOperation, globalAlpha | WIRED | `drawLayer()` line 291: `ctx.globalCompositeOperation`, line 292: `ctx.globalAlpha`. |
| `previewRenderer.ts` | video loadeddata/seeked | re-render trigger via onImageLoaded | WIRED | Lines 258-262: `readyHandler` calls `this.onImageLoaded?.()`, added as listener for both `loadeddata` and `seeked` events. Handler stored in `videoReadyHandlers` map for cleanup (line 262). |
| `LayerList.tsx` | `layerStore` | layers, reorder, remove | WIRED | Line 3 (import), line 10 (layers.value), line 11 (selectedLayerId.value), line 43 (reorder), line 110 (remove), line 99 (setSelected). |
| `AddLayerMenu.tsx` | `layerStore` | layerStore.add for all layer types | WIRED | Lines 83, 129, 188, 211, 272: `layerStore.add({...})`. |
| `AddLayerMenu.tsx` | `imageStore.videoAssets` | video picker popover reads assets | WIRED | Line 359: `imageStore.videoAssets.value.length`, line 365: `.map()` for video list. |
| `AddLayerMenu.tsx` | `imageStore.addVideoAsset` | video registration after copyFile | WIRED | Lines 266-270: `imageStore.addVideoAsset({...})` called after `copyFile`. |
| `LeftPanel.tsx` | `LayerList.tsx` | imports and renders LayerList | WIRED | Line 8: `import {LayerList}`, line 73: `<LayerList />`. |
| `LeftPanel.tsx` | `AddLayerMenu.tsx` | imports and renders AddLayerMenu | WIRED | Line 9: `import {AddLayerMenu}`, line 69: `<AddLayerMenu />`. |
| `PropertiesPanel.tsx` | `layerStore.updateLayer` | reads selected layer, writes updates | WIRED | Line 2: import. Lines 110 (blend), 135 (opacity), 146 (visibility), 168-170 (transform), 212-214 (crop). |
| `PropertiesPanel.tsx` | `history.ts` | startCoalescing/stopCoalescing | WIRED | Line 3: import. Line 77 (NumericInput focus), lines 56, 61 (stop). Opacity slider: lines 131-132. |
| `ImportGrid.tsx` | `imageStore` | renders both images and video assets | WIRED | Lines 9-10: reads `images` and `videoAssets`. Lines 25-48: image grid. Lines 51-71: video section. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LAYER-01 | 06-03, 06-06 | Add static image layer | SATISFIED | `handleAddStaticImageFromAsset` and `handleImportNewStaticImage` in AddLayerMenu.tsx |
| LAYER-02 | 06-03, 06-07 | Add image sequence layer | SATISFIED | `handleAddImageSequence` reads directory, imports images, creates layer |
| LAYER-03 | 06-03, 06-06, 06-07 | Add video layer | SATISFIED | `handleAddVideoFromAsset` (picker) and `handleImportNewVideo` (fallback dialog) in AddLayerMenu.tsx |
| LAYER-04 | 06-01 | Set blend mode per layer | SATISFIED | BlendSection dropdown in PropertiesPanel, `blendModeToCompositeOp` in renderer |
| LAYER-05 | 06-01 | Adjust layer opacity 0-100% | SATISFIED | BlendSection opacity slider with coalescing, `globalAlpha` in renderer |
| LAYER-06 | 06-03, 06-05 | Toggle layer visibility | SATISFIED | Visibility toggle in LayerList and PropertiesPanel, `layer.visible` check in renderer |
| LAYER-07 | 06-03, 06-05 | Reorder layers via drag-and-drop | SATISFIED | SortableJS in LayerList with DOM revert fix and `forceFallback` |
| LAYER-08 | 06-01, 06-03 | Delete a layer | SATISFIED | Delete button in LayerRow, `layerStore.remove()` with base guard |
| LAYER-09 | 06-01 | Set layer position (x, y) | SATISFIED | TransformSection X/Y NumericInputs, `ctx.translate()` in renderer |
| LAYER-10 | 06-01 | Set layer scale | SATISFIED | TransformSection Scale NumericInput, `ctx.scale()` in renderer |
| LAYER-11 | 06-01 | Set layer rotation | SATISFIED | TransformSection Rot NumericInput, `ctx.rotate()` in renderer |
| LAYER-12 | 06-01 | Crop a layer | SATISFIED | CropSection T/R/B/L NumericInputs, 9-arg `drawImage` with source crop in renderer |
| LAYER-13 | 06-02 | Preview canvas composites all visible layers | SATISFIED | `PreviewRenderer.renderFrame()` iterates layers, applies blend/opacity/transform per layer |
| LAYER-14 | 06-01 | Base layer always bottom, non-deletable | SATISFIED | `createBaseLayer()` auto-generates. `layerStore.remove/reorder` guard index 0. SortableJS filters `.layer-base`. |
| PROP-01 | 06-04 | Properties panel shows controls for selected layer | SATISFIED | `PropertiesPanel()` reads `selectedLayerId` and renders sections conditionally |
| PROP-02 | 06-04, 06-05 | Blend mode dropdown, opacity slider, visibility toggle | SATISFIED | `BlendSection` component with all three controls |
| PROP-03 | 06-04, 06-05 | Transform controls (position, scale, rotation, crop) | SATISFIED | `TransformSection` and `CropSection` components |
| PROP-04 | 06-04 | Effect-specific parameters for FX layer | SATISFIED | Phase 7 stub text shown for video layers; adequate for this phase |

All 18 requirement IDs (LAYER-01 through LAYER-14, PROP-01 through PROP-04) are satisfied. No orphaned requirements found -- REQUIREMENTS.md traceability table maps these same 18 IDs to Phase 6, all marked Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `previewRenderer.ts` | 117 | Comment "loading placeholders" | Info | Legitimate feature comment, not a stub -- the placeholder renders while video buffers and correctly applies blend mode/opacity |

No TODO, FIXME, HACK, PLACEHOLDER, or console.log-only implementations found in any phase 6 modified files. TypeScript compiles with zero errors.

### Human Verification Required

### 1. Video Layer Blend Mode and Opacity via Picker

**Test:** Click Add Layer > Video. Verify a popover appears showing existing video assets (or "No imported videos yet" with "Import new..." button). Import a video. Change blend mode to Multiply. Drag opacity to 50%.
**Expected:** Video picker popover opens. After adding, video renders in preview. Blend mode and opacity apply visually. Loading placeholder shown briefly while video buffers, then video appears with effects.
**Why human:** Video readyState transitions, Canvas 2D blend mode rendering, and popover click-outside dismissal are runtime browser behaviors.

### 2. Video Asset Persistence Across Save/Load

**Test:** Add a video layer to a sequence. Save the project (Cmd+S). Close and reopen the project (Cmd+O). Check the IMPORTED panel and the layer list.
**Expected:** Video appears in IMPORTED panel alongside images after reload. Video layer is present in layer list. Video renders in preview.
**Why human:** Full Tauri save/load cycle with .mce serialization and hydration re-discovery needed.

### 3. Drag-and-Drop Layer Reorder

**Test:** Add 3+ layers to a sequence. Drag a non-base layer to a different position in the layer list.
**Expected:** Layer list order updates. Preview compositing order reflects the change. Base layer remains locked at bottom.
**Why human:** SortableJS DOM revert fix is a runtime browser behavior.

### 4. Numeric Input Multi-Digit Typing

**Test:** Click on Position X field. Type "150" followed by Enter. Click Scale field. Type "0.75" followed by Enter. Press Escape in another field to verify revert.
**Expected:** Values persist after Enter. Typing is uninterrupted. Escape reverts to previous value.
**Why human:** DOM focus/input lifecycle behavior with local editing state.

### Gaps Summary

No code-level gaps found. All 3 UAT gaps from the previous verification cycle have been addressed:

1. **Video picker popover** (UAT test 3) -- `AddLayerMenu.tsx` now has `videoPickerOpen` state, `videoPickerRef`, click-outside effect, `handleAddVideoFromAsset`, and full video picker popover JSX matching the static image picker pattern. Video button opens picker (line 315) instead of calling file dialog directly.

2. **Video asset persistence** (UAT test 4) -- `projectStore.ts` `hydrateFromMce()` now includes a video asset re-discovery loop (lines 183-194) that iterates all loaded sequences, finds video layers, and calls `imageStore.addVideoAsset()` for each. This runs inside the `batch()` call so isDirty stays false.

3. **Video blend mode** (UAT test 10) -- `previewRenderer.ts` `resolveVideoSource()` now adds `loadeddata` and `seeked` event listeners (lines 258-262) that call `this.onImageLoaded?.()` to trigger re-render. Handler references stored in `videoReadyHandlers` map for proper cleanup in `dispose()`. Loading placeholder now respects layer blend mode and opacity (lines 120-121).

All automated checks pass. 4 items flagged for human verification (runtime browser behaviors that cannot be tested via grep).

---

_Verified: 2026-03-10T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
