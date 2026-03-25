---
phase: 19-add-paint-layer-rotopaint
verified: 2026-03-24T21:38:06Z
status: human_needed
score: 8/8 must-haves verified
human_verification:
  - test: "Draw brush strokes on a paint layer and verify pressure-sensitive, smooth variable-width strokes appear in real-time on the canvas"
    expected: "Strokes render immediately with width variation driven by pointer pressure; stroke is committed and visible on mouse/pointer release"
    why_human: "Requires live pointer input and visual inspection of stroke quality — cannot be verified by static code analysis"
  - test: "Toggle onion skinning on, paint on frame 1, advance to frame 2, paint, navigate back to frame 1 — verify ghost frame from frame 2 is visible with reduced opacity"
    expected: "Ghost frame renders at reduced opacity behind the current frame's paint; opacity falls off with frame distance"
    why_human: "Requires multi-frame interactive workflow; visual appearance of ghost frames needs human confirmation"
  - test: "Save a project with paint strokes, close, and reopen — verify paint data persists"
    expected: "All paint strokes visible on the correct frames after project reload"
    why_human: "Requires Tauri FS sidecar file I/O to actually execute; file system operations are not testable statically"
  - test: "Export a project containing a paint layer to video — verify paint strokes appear in the exported frames"
    expected: "Paint strokes composite correctly in exported frames with correct blend mode and opacity"
    why_human: "Requires running the export pipeline end-to-end with actual video output"
---

# Phase 19: Add Paint Layer Rotopaint — Verification Report

**Phase Goal:** Add Paint Layer Rotopaint — Frame-by-frame drawing and rotoscoping with perfect-freehand brush engine, onion skinning, and sidecar persistence
**Verified:** 2026-03-24T21:38:06Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal has 8 observable truths derived from the success criteria in the milestone roadmap (v0.3.0-ROADMAP.md, Phase 999.1 → Phase 19). All 8 are verified by code evidence.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add a paint layer via Layer menu and toggle paint mode via toolbar button or P key | VERIFIED | `AddFxMenu.tsx:handleAddPaintLayer`, `CanvasArea.tsx:KeyP handler + togglePaintMode button` |
| 2 | User can draw pressure-sensitive brush strokes and erase with per-stroke color/opacity | VERIFIED (code) | `PaintOverlay.tsx:e.pressure`, `paintStore.addElement`, `paintRenderer:destination-out eraser` |
| 3 | User can use fill tool and geometric shape tools (line, rect, ellipse) | VERIFIED | `PaintOverlay.tsx:floodFill wiring`, `paintRenderer:line/rect/ellipse cases`, `paintFloodFill.ts:floodFill()` |
| 4 | Paint is per-frame (each timeline frame has its own canvas) | VERIFIED | `paintStore:Map<string, Map<number, PaintFrame>>`, `getFrame(layerId, frame)` per-frame lookup |
| 5 | Onion skinning shows ghosted adjacent frame paint with configurable range and opacity | VERIFIED (code) | `OnionSkinOverlay.tsx:opacity falloff loop`, `paintStore.onionSkinPrevRange/nextRange/onionSkinOpacity` |
| 6 | Paint layers composite normally in the layer stack with blend modes and opacity | VERIFIED | `previewRenderer.ts:layer.type==='paint' + blendModeToCompositeOp + effectiveOpacity` |
| 7 | Paint renders identically in preview and export | VERIFIED | `exportRenderer.ts:passthrough comment`, export calls `renderer.renderFrame()` which handles paint |
| 8 | Paint data persists as sidecar JSON files alongside the .mce project | VERIFIED (code) | `paintPersistence.ts:savePaintData/loadPaintData`, `projectStore:version 14`, `project_io.rs:paint/ dir` |

**Score:** 8/8 truths verified (4 require human confirmation for runtime behavior)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Application/src/types/paint.ts` | PaintStroke, PaintShape, PaintFill, PaintElement, PaintFrame, PaintToolType | VERIFIED | 64 lines; exports all 6 required types |
| `Application/src/stores/paintStore.ts` | Paint mode state, tool settings, per-frame stroke storage | VERIFIED | 232 lines; exports `paintStore` with all signals and methods |
| `Application/src/lib/paintRenderer.ts` | Render paint strokes to Canvas 2D context | VERIFIED | 163 lines; exports `renderPaintFrame` and `strokeToPath`; uses `getStroke` + `Path2D` |
| `Application/src/types/layer.ts` | Extended LayerType and LayerSourceData with paint variant | VERIFIED | Contains `\| 'paint'` at line 14 and `\| { type: 'paint'; layerId: string }` at line 32 |
| `Application/src/components/canvas/PaintOverlay.tsx` | Paint mode pointer event handler | VERIFIED | 392 lines; captures pointer events, converts coords, commits to paintStore |
| `Application/src/components/canvas/TransformOverlay.tsx` | Updated to skip when paint mode active | VERIFIED | Returns null when `paintStore.paintMode.value && layer.type === 'paint'` |
| `Application/src/components/layout/CanvasArea.tsx` | Paint mode toggle button, conditional PaintOverlay, PaintToolbar, OnionSkinOverlay | VERIFIED | Imports and conditionally renders all three; P key handler at line 159 |
| `Application/src/components/sidebar/PaintProperties.tsx` | Full paint tool controls in sidebar | VERIFIED | 395 lines; tool selection, brush size/color/opacity, stroke options, onion skin, clear frame |
| `Application/src/components/overlay/PaintToolbar.tsx` | Compact floating toolbar on canvas | VERIFIED | 124 lines; absolute positioned `top-3 left-1/2 z-30`, reads from paintStore signals |
| `Application/src/components/layout/LeftPanel.tsx` | PaintProperties integration in sidebar routing | VERIFIED | Routes to `<PaintProperties layer={selectedLayer} />` when `selectedLayer.type === 'paint'` |
| `Application/src/lib/previewRenderer.ts` | Paint layer rendering in compositing loop | VERIFIED | Lines 167-280; `layer.type === 'paint'` case with blend mode, opacity, `renderPaintFrame` |
| `Application/src/lib/exportRenderer.ts` | Paint layer passthrough in export pipeline | VERIFIED | Lines 84-88; verification comment confirming paint passes through `interpolateLayers` |
| `Application/src/lib/frameMap.ts` | Paint layer color in FX_TRACK_COLORS | VERIFIED | Line 105: `'paint': '#E91E63'` |
| `Application/src/components/timeline/AddFxMenu.tsx` | Paint layer entry in Layer menu | VERIFIED | `handleAddPaintLayer` creates paint layer; "Paint / Rotopaint" menu item at line 126 |
| `Application/src/lib/paintPersistence.ts` | Sidecar file read/write via Tauri FS API | VERIFIED | 135 lines; exports `savePaintData`, `loadPaintData`, `cleanupOrphanedPaintFiles`, `getPaintLayerIds` |
| `Application/src/stores/projectStore.ts` | Paint sidecar save/load wired into project cycle | VERIFIED | version 14 at line 225; `savePaintData` before save at line 608; `loadPaintData` in hydration at line 496; `paintStore.reset()` at line 717 |
| `Application/src-tauri/src/services/project_io.rs` | paint/ directory creation in project structure | VERIFIED | `let paint_dir = base.join("paint")` + `fs::create_dir_all(&paint_dir)` at lines 11, 19; test at line 148 |
| `Application/src/lib/paintFloodFill.ts` | Iterative stack-based flood fill on ImageData | VERIFIED | 78 lines; exports `floodFill` and `hexToRgba`; uses `Uint8Array` visited map and stack-based iteration |
| `Application/src/components/canvas/OnionSkinOverlay.tsx` | Onion skin rendering overlay | VERIFIED | 107 lines; renders ghost frames with opacity falloff; `pointerEvents: 'none'`; reads `paintStore.getFrame` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `paintRenderer.ts` | `perfect-freehand` | `import { getStroke }` | WIRED | Line 1: `import {getStroke} from 'perfect-freehand'` |
| `paintStore.ts` | `types/paint.ts` | import types | WIRED | Lines 2-3: imports all PaintElement types and constants |
| `PaintOverlay.tsx` | `paintStore.ts` | `paintStore.addElement` | WIRED | Lines 274, 315, 334: stroke/shape/fill elements committed |
| `PaintOverlay.tsx` | `coordinateMapper.ts` | `import clientToCanvas` | WIRED | Line 8: `import {clientToCanvas}` |
| `CanvasArea.tsx` | `PaintOverlay.tsx` | conditional render | WIRED | Line 385: `<PaintOverlay containerRef=...>` |
| `previewRenderer.ts` | `paintRenderer.ts` | `import renderPaintFrame` | WIRED | Line 14: `import {renderPaintFrame} from './paintRenderer'` |
| `previewRenderer.ts` | `paintStore.ts` | `paintStore.getFrame` | WIRED | Lines 168, 269: `paintStore.getFrame(layer.id, frame)` |
| `projectStore.ts` | `paintPersistence.ts` | `import savePaintData, loadPaintData` | WIRED | Line 25: `import {savePaintData, loadPaintData, cleanupOrphanedPaintFiles}` |
| `paintPersistence.ts` | `@tauri-apps/plugin-fs` | `import readTextFile, writeTextFile` | WIRED | Line 11: imports `readTextFile, writeTextFile, mkdir, exists, readDir, remove` |
| `PaintOverlay.tsx` | `paintFloodFill.ts` | `import floodFill` | WIRED | Line 10: `import {floodFill, hexToRgba}` |
| `OnionSkinOverlay.tsx` | `paintStore.ts` | `paintStore.getFrame` | WIRED | Lines 63, 79: `paintStore.getFrame(layerId, frameNum)` |
| `LeftPanel.tsx` | `PaintProperties.tsx` | conditional render | WIRED | Lines 295-299: renders `<PaintProperties layer={selectedLayer} />` |
| `CanvasArea.tsx` | `PaintToolbar.tsx` | conditional render | WIRED | Line 401: `{isPaintModeActive && <PaintToolbar />}` |
| `CanvasArea.tsx` | `OnionSkinOverlay.tsx` | conditional render | WIRED | Lines 380-384: conditional on `paintMode + onionSkinEnabled + paint layer` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PaintOverlay.tsx` | stroke points → `paintStore._frames` | `e.pressure`, `clientToCanvas(e.clientX, e.clientY, ...)` | Yes — pointer events, not hardcoded | FLOWING |
| `previewRenderer.ts` | `paintFrame.elements` | `paintStore.getFrame(layer.id, frame)` from `Map<string, Map<number, PaintFrame>>` | Yes — real per-frame data from store | FLOWING |
| `OnionSkinOverlay.tsx` | `frameData.elements` | `paintStore.getFrame(layerId, frameNum)` | Yes — reads actual adjacent frames | FLOWING |
| `paintPersistence.ts` | `PaintFrame` JSON | `paintStore.getDirtyFrames()` → `writeTextFile` | Yes — writes real dirty frame data | FLOWING |
| `projectStore.ts` | paint sidecar files | `loadPaintData(projectRoot, paintLayerIds)` → `paintStore.loadFrame` | Yes — loads from sidecar files on hydration | FLOWING |
| `Preview.tsx` | `paintVersion.value` | `paintStore.paintVersion` (signal bumped on every `addElement`) | Yes — `paintVersion.value++` in every mutating store method | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| floodFill exports function | `node -e "const m = require('.../paintFloodFill.ts'); console.log(typeof m.floodFill)"` | `function` | PASS |
| paint type in LayerType union | grep `\| 'paint'` in `layer.ts` | Found at line 14 | PASS |
| perfect-freehand in package.json | grep `perfect-freehand` in `package.json` | `"perfect-freehand": "^1.2.3"` at line 24 | PASS |
| TypeScript compilation | `npx tsc --noEmit` | 2 pre-existing unused-variable warnings (unrelated to phase 19) | PASS |
| Tauri fs write permission | grep `fs:allow-write-text-file` in `capabilities/default.json` | Found at line 21 | PASS |
| paintVersion signal in store | grep `paintVersion` in `paintStore.ts` | Signal at line 26, bumped in all mutating methods | PASS |
| Preview subscribes to paintVersion | grep `paintVersion` in `Preview.tsx` | `void paintStore.paintVersion.value` at line 59 | PASS |

Note: TypeScript compilation shows 2 pre-existing errors: unused `isOnKf` in `SidebarProperties.tsx` and unused `expect` in `glslRuntime.test.ts`. Both are unrelated to phase 19.

---

### Requirements Coverage

Requirements PAINT-01 through PAINT-13 are declared across phase 19 plans. There is no separate REQUIREMENTS.md file — requirements are tracked in the milestone roadmap. No REQUIREMENTS.md to cross-reference against.

| Requirement | Source Plan | Description (from milestone roadmap) | Status | Evidence |
|-------------|------------|--------------------------------------|--------|----------|
| PAINT-01 | 19-01 | Perfect-freehand brush engine integration | SATISFIED | `paintRenderer.ts:getStroke + Path2D` |
| PAINT-02 | 19-01 | PaintStroke type with per-frame vector storage | SATISFIED | `types/paint.ts:PaintStroke`, `paintStore:Map<layerId,Map<frame,PaintFrame>>` |
| PAINT-03 | 19-01 | LayerType and LayerSourceData extended with paint variant | SATISFIED | `layer.ts:\| 'paint'` and `\| { type: 'paint'; layerId: string }` |
| PAINT-04 | 19-02 | Canvas pointer event capture and stroke commit | SATISFIED | `PaintOverlay.tsx:handlePointerDown/Move/Up + paintStore.addElement` |
| PAINT-05 | 19-02 | Paint mode toggle (toolbar + P key) with TransformOverlay gating | SATISFIED | `CanvasArea.tsx:togglePaintMode + KeyP`, `TransformOverlay.tsx:early return` |
| PAINT-06 | 19-03 | Paint layer rendering in PreviewRenderer compositing loop | SATISFIED | `previewRenderer.ts:layer.type==='paint' case` |
| PAINT-07 | 19-03 | Paint layer in Layer menu and timeline color | SATISFIED | `AddFxMenu.tsx:Paint/Rotopaint`, `frameMap.ts:'paint':'#E91E63'` |
| PAINT-08 | 19-04 | PaintProperties sidebar panel with full tool controls | SATISFIED | `PaintProperties.tsx:395 lines with all tool sections` |
| PAINT-09 | 19-04 | PaintToolbar floating overlay and LeftPanel routing | SATISFIED | `PaintToolbar.tsx:z-30 overlay`, `LeftPanel.tsx:paint type routing` |
| PAINT-10 | 19-05 | Sidecar JSON persistence for paint frames | SATISFIED | `paintPersistence.ts:savePaintData/loadPaintData` |
| PAINT-11 | 19-05 | Project format v14, Rust paint/ directory | SATISFIED | `projectStore.ts:version 14`, `project_io.rs:create_dir_all paint/` |
| PAINT-12 | 19-06 | Flood fill tool with configurable tolerance | SATISFIED | `paintFloodFill.ts:floodFill()`, `PaintOverlay.tsx:fill tool wiring` |
| PAINT-13 | 19-06 | Onion skinning with frame range and opacity falloff | SATISFIED | `OnionSkinOverlay.tsx:opacity falloff loop`, `paintStore:onionSkin* signals` |

All 13 requirements satisfied. No orphaned requirements.

---

### Anti-Patterns Found

No anti-patterns found in phase 19 files. No TODOs, FIXMEs, placeholder returns, or empty implementations in any of the 9 created files or the 10 modified files.

The TypeScript compiler reports 2 pre-existing warnings in files not created or significantly modified by this phase:
- `src/components/sidebar/SidebarProperties.tsx:32` — unused `isOnKf` variable (pre-existing)
- `src/lib/glslRuntime.test.ts:1` — unused `expect` import (pre-existing)

Neither is a blocker for phase 19 goal achievement.

---

### Human Verification Required

#### 1. Brush Stroke Quality and Pressure Sensitivity

**Test:** Open the app, add a paint layer, enter paint mode (P key or toolbar button), draw brush strokes with varying pressure on a drawing tablet or notice width variation with mouse speed.
**Expected:** Strokes are smooth with variable width from perfect-freehand. Strokes commit to the canvas on pointer release and remain visible after releasing the mouse.
**Why human:** Requires live pointer input and visual inspection of stroke quality; `paintVersion` signal reactivity pattern must actually trigger re-render in the browser.

#### 2. Onion Skinning Visual Verification

**Test:** Enable onion skinning in PaintProperties. Paint on frame 1. Advance to frame 2 and paint. Navigate between frames.
**Expected:** Ghost frames from adjacent frames are visible with opacity falloff. Opacity decreases with frame distance. Ghost frames do not intercept pointer events.
**Why human:** Multi-frame interactive workflow; opacity calculation and offscreen canvas compositing requires visual confirmation.

#### 3. Sidecar Persistence Round-Trip

**Test:** Create a project, add a paint layer, draw strokes on multiple frames, save the project, close, and reopen.
**Expected:** All paint strokes are present on the correct frames after reopening. The paint/ directory exists alongside the .mce file with frame-NNN.json files.
**Why human:** Requires Tauri FS I/O and file system inspection. The `fs:allow-write-text-file` permission is present but the actual write execution requires a running app.

#### 4. Export with Paint Layer

**Test:** Export a project containing a paint layer to video.
**Expected:** Paint strokes appear in the exported video frames at the correct compositing position (respecting layer order, blend mode, and opacity).
**Why human:** Requires running the full export pipeline with actual video output. The export passthrough is verified by code comment but export rendering quality needs visual confirmation.

---

### Gaps Summary

No gaps found. All 8 observable truths are satisfied by code evidence. All 13 requirements are implemented. All key links are wired. No anti-patterns detected.

The 4 human verification items are confirmations of runtime behavior (stroke quality, onion skin visuals, file I/O round-trip, export output) — they are not blockers based on code analysis, but require interactive testing to fully confirm the goal is achieved end-to-end.

Notable implementation decisions from Plan 06 that went beyond the original spec:
- `paintVersion` signal added to `paintStore` as a reactive bridge (Map storage is not reactive; bumping the signal on every mutation triggers Preact re-renders in `Preview.tsx`)
- Offscreen canvas compositing pattern used for eraser (`destination-out`) and onion skin rendering to correctly isolate composite operations
- Paint mode auto-deactivates when a non-paint layer is selected

---

_Verified: 2026-03-24T21:38:06Z_
_Verifier: Claude (gsd-verifier)_
