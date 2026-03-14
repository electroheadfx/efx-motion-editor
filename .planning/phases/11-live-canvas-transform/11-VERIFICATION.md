---
phase: 11-live-canvas-transform
verified: 2026-03-14T12:30:00Z
status: passed
score: 3/3 success criteria verified
re_verification: false
human_verification_resolved:
  - test: "Deselect when canvas fully covered"
    resolution: "User accepted Escape key as sufficient workaround"
  - test: "Rotation cursor icon"
    resolution: "Fixed — replaced crosshair with dedicated rotation arrow SVG cursor (commit 51d4672)"
---

# Phase 11: Live Canvas Transform — Verification Report

**Phase Goal:** Click-to-select layers on the preview canvas, drag to reposition, scale via corner/edge handles, and rotate via an outer ring — all with undo support and synced to the Properties Panel.
**Verified:** 2026-03-14T12:30:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Success Criteria from ROADMAP.md

The roadmap defines 3 explicit success criteria for this phase. These were used as the primary truths.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Selecting a layer shows transform handles (bounding box, rotation, scale corners) on the canvas preview | VERIFIED | `TransformOverlay.tsx` renders SVG bounding box polygon (`#4A90D9`) and 8 handle divs (4 corner + 4 edge) when a content layer is selected and playback is stopped (line 80, 492–540). Handles are counter-scaled by `zoom` for fixed screen size. Handles are hidden when `isPlaying` is true (line 80). Wired into CanvasArea at line 255. |
| 2 | User can drag to move, corner-drag to scale, and rotate layers directly on the canvas | VERIFIED | Full drag state machine implemented in `TransformOverlay.tsx`: `pending` -> `move`/`scale`/`rotate` with 4px threshold (line 265–276). Move applies `dx/dy` in project space (line 288–296). Corner scale computes distance ratio from center for uniform scaleX/scaleY (line 318–324). Edge scale projects delta onto rotated axis for single-axis scaling (line 327–363). Rotation computes atan2 angle delta (line 366–383). All operations routed through `layerStore.updateLayer()`. UAT tests 3–6 confirmed pass. |
| 3 | Canvas transform changes sync bidirectionally with the parameter panel values in real-time | VERIFIED | TransformOverlay calls `layerStore.updateLayer()` during drag, which updates the reactive signal PropertiesPanel reads. Selection sync: TransformOverlay calls both `layerStore.setSelected()` and `uiStore.selectLayer()` on click (lines 213–218). Escape in `shortcuts.ts` calls both (lines 286–287). Delete handler also clears `layerStore.selectedLayerId` (line 85). UAT test 2 (bidirectional sync) confirmed pass. |

**Score:** 3/3 success criteria verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `Application/src/types/layer.ts` | VERIFIED | `LayerTransform` has `scaleX` and `scaleY` (no `scale`). `defaultTransform()` returns `scaleX: 1, scaleY: 1`. 109 lines, substantive. |
| `Application/src/types/project.ts` | VERIFIED | `MceLayerTransform` has `scale_x: number`, `scale_y: number`, `scale?: number` optional for v4 compat. |
| `Application/src-tauri/src/models/project.rs` | VERIFIED | `MceLayerTransform` has `scale_x: f64` and `scale_y: f64` with `#[serde(default = "default_scale")]`, plus `pub scale: Option<f64>` with `skip_serializing_if`. `default_scale()` returns 1.0. |
| `Application/src/stores/projectStore.ts` | VERIFIED | Version `5` written in `buildMceProject()`. `hydrateFromMce()` reads `ml.transform.scale_x ?? ml.transform.scale ?? 1` for both `scaleX` and `scaleY`. |
| `Application/src/lib/previewRenderer.ts` | VERIFIED | `drawLayer()` at line 652: `ctx.scale(layer.transform.scaleX, layer.transform.scaleY)`. `drawLayerToOffscreen()` at line 566: `offCtx.scale(layer.transform.scaleX, layer.transform.scaleY)`. |
| `Application/src/components/layout/PropertiesPanel.tsx` | VERIFIED | `TransformSection` shows separate SX/SY `NumericInput` elements (lines 416–427). |
| `Application/src/components/canvas/coordinateMapper.ts` | VERIFIED | 93 lines. Exports `clientToCanvas`, `canvasToClient`, `screenToProjectDistance`, `Point`. Correct inversion of `scale(zoom) translate(panX, panY)` with center origin. |
| `Application/src/components/canvas/transformHandles.ts` | VERIFIED | 328 lines. Exports `getLayerBounds`, `getHandlePositions`, `hitTestHandles`, `getRotationZone`, `getCursorForHandle`, `pointInPolygon`, `HandleType`, `HandlePosition`, `LayerBounds`. Bounding box math replicates PreviewRenderer pipeline: crop -> aspect-fit -> center -> scaleX/scaleY -> rotate. |
| `Application/src/components/canvas/hitTest.ts` | VERIFIED | 90 lines. Exports `hitTestLayers` (z-order top-to-bottom, skips FX/invisible layers) and `hitTestLayersCycle` (Alt+click cycling with wrap-around). |
| `Application/src/components/canvas/TransformOverlay.tsx` | VERIFIED | 543 lines. Full drag state machine. Bounding box + 8 handles rendered in project space. Pointer event routing. `startCoalescing`/`stopCoalescing` called on drag start/end. Middle-click and Space+drag forwarded to `onPanStart`. Handles hidden during playback. |
| `Application/src/components/layout/CanvasArea.tsx` | VERIFIED | Imports and renders `<TransformOverlay>` inside zoom/pan div (line 255–260). Passes `containerRef`, `getSourceDimensionsForLayer`, `isSpaceHeld`, `onPanStart`. Left-click no longer pans (line 109). Space+drag tracking implemented (lines 141–172). `overflow-visible` on inner div allows handles outside project bounds (line 252). |
| `Application/src/lib/shortcuts.ts` | VERIFIED | 290 lines. Context-dependent ArrowLeft/Right via `nudgeOrStep()` (checks `layerStore.selectedLayerId.peek()` to branch nudge vs frame step). ArrowUp/Down call `nudgeIfSelected()` (vertical nudge only when layer selected). Shift+Arrow variants for 10px nudge. Escape calls both `layerStore.setSelected(null)` and `uiStore.selectLayer(null)` (lines 282–288). |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `TransformOverlay.tsx pointerdown` | `layerStore.setSelected()` | Click on layer -> hit test -> select | WIRED | Lines 213–218: `layerStore.setSelected(hitLayerId)` and `uiStore.selectLayer(hitLayerId)` |
| `TransformOverlay.tsx pointermove` | `layerStore.updateLayer()` | Apply transform delta during drag | WIRED | Lines 290–296 (move), 320–323 (corner scale), 339–344 / 356–361 (edge scale), 377–383 (rotate) |
| `TransformOverlay.tsx pointerdown` | `history.ts startCoalescing()` | Begin drag -> start coalescing | WIRED | Line 276: `startCoalescing()` called on threshold exceeded in pending mode |
| `TransformOverlay.tsx pointerup` | `history.ts stopCoalescing()` | End drag -> stop coalescing | WIRED | Line 405: `stopCoalescing()` called in `handlePointerUp` |
| `CanvasArea.tsx` | `TransformOverlay.tsx` | Rendered inside same CSS-transformed div as Preview | WIRED | Lines 5 (import) and 255 (render inside scale/translate div) |
| `shortcuts.ts Arrow handlers` | `layerStore.selectedLayerId` | Check selection to decide nudge vs frame step | WIRED | `nudgeOrStep()` at line 117: `layerStore.selectedLayerId.peek()` branches |
| `shortcuts.ts Escape` | `layerStore.setSelected(null)` | Deselect on Escape | WIRED | Lines 286–287: `layerStore.setSelected(null); uiStore.selectLayer(null)` |
| `projectStore.ts hydrateFromMce` | `LayerTransform scaleX/scaleY` | v4->v5 migration reading `scale_x ?? scale` | WIRED | `scaleX: ml.transform.scale_x ?? ml.transform.scale ?? 1` (line 185) |
| `previewRenderer.ts drawLayer` | `LayerTransform scaleX/scaleY` | `ctx.scale(scaleX, scaleY)` | WIRED | Lines 566, 652 in `previewRenderer.ts` |

All 9 key links are WIRED.

---

### Requirements Coverage

REQUIREMENTS.md does not exist as a standalone file in this project. The requirement IDs are defined in the ROADMAP.md and plan frontmatter only. Cross-referencing plan declarations against ROADMAP.md Phase 11 listing:

| Requirement ID | Declared in Plan | ROADMAP Listed | Implementation Evidence | Status |
|----------------|-----------------|---------------|------------------------|--------|
| XFORM-01 | 11-01 | Yes | `LayerTransform` has `scaleX`/`scaleY`; `defaultTransform()` updated | SATISFIED |
| XFORM-02 | 11-01 | Yes | `projectStore.ts` writes v5, `hydrateFromMce` migrates v4 via nullish coalescing | SATISFIED |
| XFORM-03 | 11-02 | Yes | `coordinateMapper.ts` exports `clientToCanvas`/`canvasToClient` inverting CSS transform | SATISFIED |
| XFORM-04 | 11-02 | Yes | `transformHandles.ts` `getLayerBounds` replicates renderer pipeline; `hitTestLayers` in `hitTest.ts` | SATISFIED |
| XFORM-05 | 11-03 | Yes | `TransformOverlay.tsx` renders SVG bounding box + 8 handle divs on selected layer | SATISFIED |
| XFORM-06 | 11-03 | Yes | Drag state machine: `move` mode applies dx/dy to layer position | SATISFIED |
| XFORM-07 | 11-03 | Yes | Corner handles trigger uniform scale; edge handles trigger single-axis scale | SATISFIED |
| XFORM-08 | 11-03 | Yes | Rotation zone detected outside corners; `applyRotation()` applies atan2 delta | SATISFIED |
| XFORM-09 | 11-04 | Yes | Escape handler in `shortcuts.ts` (line 283); ArrowLeft/Right context-dependent via `nudgeOrStep` | SATISFIED |
| XFORM-10 | 11-04 | Yes | `hitTestLayersCycle` in `hitTest.ts`; TransformOverlay uses `e.altKey` to choose cycle vs normal | SATISFIED |

All 10 XFORM requirements have implementation evidence. No REQUIREMENTS.md file exists, so no orphaned requirements to flag.

---

### Anti-Patterns Found

No anti-patterns detected across all 7 phase files scanned:
- No TODO/FIXME/PLACEHOLDER comments
- No empty or stub implementations (`return null` only in conditional early-return paths that are semantically correct — e.g., when no layer selected or not playing)
- No console.log-only handlers
- All 7 commits verified in git history (9b9825c, 60ecb68, df3dd83, 31d7b98, 011480c, 8a086da, 3320a91)

One design note worth flagging (not a blocker):

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `transformHandles.ts` | 286 | `getCursorForHandle` returns `'crosshair'` for rotation zone | INFO | UAT test 6 noted user preference for rotation icon — cosmetic, fully functional |

---

### Human Verification Required

The automated checks all pass. Two items from the UAT record require human confirmation of acceptability before this phase can be considered fully closed.

#### 1. Deselect When Canvas Fully Covered by Layers

**Test:** Open a project where content layers cover the full canvas area. Attempt to deselect all layers.
**Expected:** Either (a) clicking anywhere outside the canvas UI deselects, or (b) pressing Escape deselects, or (c) pressing Escape is the documented workaround and the user has accepted it.
**Why human:** UAT test 1 recorded this as a "minor" issue. The code does implement deselection via Escape key (verified in shortcuts.ts) and via clicking empty canvas space. Whether the Escape key workaround is sufficient or whether click-outside-canvas deselect is needed is a product decision. The UAT entry shows severity "minor" and no fix was implemented.

#### 2. Rotation Cursor Icon

**Test:** Hover outside a corner of the bounding box on a selected layer and note the cursor.
**Expected:** Cursor shows either the crosshair (current implementation) or a custom rotation arrow icon.
**Why human:** UAT test 6 recorded user preference for a rotation icon instead of crosshair. This is cosmetic-only. `getCursorForHandle()` currently returns `'crosshair'` for the rotation zone. This was planned as a known-acceptable default with a note that a custom SVG data URL cursor can be added as an enhancement. Confirming whether this is accepted-for-now or needs to be addressed before phase closure.

---

### UAT Record Summary

Phase 11 completed a full UAT pass (11-UAT.md). Results:
- 8/10 items passed
- 2 items recorded as issues (severity: minor/cosmetic)
- Multiple bugs were found and fixed during UAT (drag coordinate fix, Shift+Arrow tinykeys binding, Space+drag pan suppression)
- The 2 open items are non-blocking to the core goal

---

### Gaps Summary

No structural gaps in goal achievement. All three success criteria are verified against actual code. All 10 XFORM requirements have implementation evidence. All 7 git commits exist. No stub artifacts. No orphaned wiring.

The `human_needed` status is due solely to two cosmetic/minor UAT items that require a product owner decision rather than a code fix:
1. Whether Escape-to-deselect is sufficient when layers cover the entire canvas, or if click-outside-canvas needs to be implemented.
2. Whether the crosshair rotation cursor is acceptable or requires a custom SVG rotation icon.

Neither item affects the verifiable codebase goal. Both are documented in 11-UAT.md with their severity classifications.

---

_Verified: 2026-03-14T12:30:00Z_
_Verifier: Claude (gsd-verifier)_
