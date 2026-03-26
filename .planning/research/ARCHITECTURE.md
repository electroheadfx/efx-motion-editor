# Architecture Research: v0.6.0 Feature Integration

**Domain:** Stop-motion editor -- paint compositing, stroke management, UX enhancements
**Researched:** 2026-03-26
**Confidence:** HIGH (all 9 features analyzed against actual codebase)

## System Overview: Existing Architecture

```
+----------------------------------------------------------------+
|                     UI Components                               |
|  +----------+ +-----------+ +-----------+ +-------------------+ |
|  |CanvasArea| |LeftPanel  | |PaintOverlay| |PaintProperties   | |
|  |MotionPath| |AddFxMenu  | |PaintToolbar| |AddLayerMenu      | |
|  +----+-----+ +-----+-----+ +------+-----+ +-------+---------+ |
|       |             |              |                |           |
+-------+-------------+--------------+----------------+-----------+
|                    Signal Stores (13)                            |
|  +--------+ +----------+ +------+ +------+ +---------+         |
|  |paintSt | |sequenceSt| |layerS| |canvas| |isolation|  ...    |
|  +---+----+ +----+-----+ +--+---+ +--+---+ +----+----+         |
|      |           |           |        |          |              |
+------+-----------+-----------+--------+----------+--------------+
|                    Rendering Pipeline                            |
|  +---------------+ +------------+ +------------------+          |
|  |PreviewRenderer| |paintRendere| |brushP5Adapter.ts |          |
|  |(Canvas 2D)    | |r.ts        | |(p5.brush FX)     |          |
|  +-------+-------+ +-----+------+ +--------+---------+          |
|          |                |                 |                   |
|  +-------+-------+ +-----+------+ +--------+---------+          |
|  |glBlur.ts      | |glMotionBlur| |glslRuntime.ts    |          |
|  |(WebGL2)       | |(WebGL2)    | |(WebGL2)          |          |
|  +---------------+ +------------+ +------------------+          |
+----------------------------------------------------------------+
|                    Persistence                                  |
|  +---------------+ +-------------------+                        |
|  |.mce project   | |paint/{uuid}/      |                        |
|  |format v15     | |frame-NNN.json     |                        |
|  +---------------+ +-------------------+                        |
+----------------------------------------------------------------+
```

## Feature-by-Feature Integration Analysis

### Feature 1: Luma Matte Compositing for FX Paint

**What:** Composite paint layer over photo sequences using luminance (not alpha). White paint = fully visible photo, black = transparent. Eliminates the opaque white background that currently blocks the photo beneath.

**Current architecture:**
- Paint layer renders to offscreen canvas via `renderPaintFrameWithBg()` in `paintRenderer.ts`
- `PreviewRenderer.renderFrame()` composites the paint offscreen onto main canvas with `drawImage()` at lines 280-303
- Paint always fills with solid `paintBgColor` (default white) before strokes -- this is the current blocking behavior
- Canvas 2D `globalCompositeOperation` handles blend modes

**Integration approach:**
- New compositing mode on paint layer: `compositeMode: 'normal' | 'luma-matte'` field on `Layer` type (paint source variant)
- When `luma-matte`, skip the solid background fill in `renderPaintFrameWithBg()`
- After rendering paint strokes to offscreen, extract luminance channel as alpha mask
- Apply mask: `destination-in` composite operation with the luma-extracted canvas on the photo layer beneath
- Implementation path: render strokes to offscreen A (grayscale), convert to alpha via `getImageData` pixel manipulation or second offscreen with `luminosity` blend, then use as mask

**Components modified:**
| Component | Change |
|-----------|--------|
| `types/paint.ts` | Add `PaintCompositeMode` type |
| `types/layer.ts` | Extend `LayerSourceData` paint variant with `compositeMode` field |
| `lib/paintRenderer.ts` | New `renderPaintFrameLuma()` function, skip bg fill for luma mode |
| `lib/previewRenderer.ts` | Branch on `compositeMode` in paint layer rendering (line ~280), luma extraction + masking |
| `components/sidebar/PaintProperties.tsx` | Toggle button for composite mode |
| `stores/paintStore.ts` | Signal for `compositeMode` (or read from layer source) |

**Data flow:**
```
PaintFrame elements
    |
    v
renderPaintFrame() on offscreen (NO bg fill)
    |
    v
Luma extraction: getImageData -> for each pixel: alpha = 0.299*R + 0.587*G + 0.114*B
    |
    v
Write modified ImageData to mask canvas
    |
    v
PreviewRenderer main canvas:
  1. Draw photo (already composited from base layer)
  2. Draw mask canvas with globalCompositeOperation = 'destination-in'
  Result: photo visible only where paint was bright
```

**Complexity:** MEDIUM. The luma extraction is a per-pixel operation on an ImageData, which may need optimization for large canvases. Consider WebGL path if Canvas 2D perf is insufficient.

---

### Feature 2: Paper/Canvas Textures on Paint Layer

**What:** Apply paper/canvas texture overlays to the paint layer, loaded from `~/.config/efx-motion/papers/*`. Makes strokes look like they were drawn on real paper/canvas.

**Current architecture:**
- `brushP5Adapter.ts` already supports `grain` parameter via p5.brush (paper texture intensity)
- Paint rendering pipeline: flat strokes via Canvas 2D -> FX strokes via p5.brush frame cache -> composited in `renderPaintFrameWithBg()`
- p5.brush has built-in paper texture support via `brush.paper()` -- but this is internal to the p5.brush rendering pass

**Integration approach:**
- Paper texture is a post-process overlay on the entire paint layer (not per-stroke)
- Load texture images from `~/.config/efx-motion/papers/` via Tauri FS + asset protocol
- After rendering all paint content to offscreen, multiply-blend the paper texture on top
- Texture tiling: tile the paper image across the canvas dimensions if smaller than project resolution
- Could also use a shader approach for performance, but Canvas 2D `multiply` blend mode + tiling is sufficient

**Components modified/new:**
| Component | Change |
|-----------|--------|
| `lib/paperTextures.ts` | **NEW** -- Load, cache, and tile paper texture images from config dir |
| `lib/paintRenderer.ts` | After rendering frame, apply paper texture overlay via `multiply` blend |
| `stores/paintStore.ts` | Signals: `paperTexturePath`, `paperTextureOpacity`, `paperTextureEnabled` |
| `components/sidebar/PaintProperties.tsx` | Paper texture picker (dropdown/grid of available textures) |
| `src-tauri/` (Rust) | Possibly a command to list files in the papers directory |

**Data flow:**
```
User: selects paper texture from PaintProperties
    |
    v
paperTextures.ts: loadTexture(path) -> HTMLImageElement (cached)
    |
    v
renderPaintFrameWithBg():
  1. Render bg + strokes as before
  2. If paper texture enabled:
     ctx.globalCompositeOperation = 'multiply'
     ctx.globalAlpha = paperTextureOpacity
     drawTiledTexture(ctx, textureImage, width, height)
     ctx.globalCompositeOperation = 'source-over'
```

**Persistence:** Paper texture path stored per-layer in `LayerSourceData` paint variant. Absolute path references `~/.config/` so textures are user-global, not project-bundled.

**Complexity:** LOW-MEDIUM. File loading and tiling is straightforward. The main risk is texture loading latency on first use.

---

### Feature 3: Duplicate Stroke with Alt+Move in Roto Paint Edit Mode

**What:** When in select mode with strokes selected, holding Alt and dragging creates a copy of selected strokes at the new position (like Alt+drag in Photoshop).

**Current architecture:**
- `PaintOverlay.tsx` handles select-mode drag at lines 788-821: detects `isDragging`, computes dx/dy delta, offsets all selected stroke points
- Stroke data is mutated in-place on `PaintFrame.elements`
- `paintStore.addElement()` handles undo/redo for new elements
- Selection state: `paintStore.selectedStrokeIds` signal (Set<string>)

**Integration approach:**
- In `handleSelectPointerDown()` (line 504), detect `e.altKey` when starting drag on an already-selected stroke
- If Alt is held: deep-clone selected strokes with new UUIDs, add clones to frame via `paintStore.addElement()`, update selection to cloned IDs, then proceed with normal drag behavior (moving the clones)
- The original strokes stay in place (they were never moved because we switched selection to the clones before drag started)

**Components modified:**
| Component | Change |
|-----------|--------|
| `components/canvas/PaintOverlay.tsx` | `handleSelectPointerDown`: alt-key detection, clone strokes, swap selection |
| `stores/paintStore.ts` | Possibly a batch `addElements()` method for atomic undo of multi-stroke clone |

**Data flow:**
```
PointerDown + Alt key + strokes selected
    |
    v
For each selected stroke:
  clone = structuredClone(stroke)
  clone.id = crypto.randomUUID()
  paintStore.addElement(layerId, frame, clone)
    |
    v
paintStore.clearSelection()
Select cloned stroke IDs
    |
    v
Normal isDragging flow moves cloned strokes
Original strokes remain stationary
```

**Complexity:** LOW. The drag infrastructure already exists. This is a ~30 line change to PaintOverlay.tsx.

---

### Feature 4: Non-Uniform Scale for Paint Layer Strokes

**What:** Allow independent X and Y scaling of selected strokes (currently, scale transform in PaintOverlay only supports uniform scaling from corner handles).

**Current architecture:**
- Transform handles rendered at lines 427-460 of PaintOverlay.tsx
- Scale transform at lines 759-777: computes single `scale` factor from distance-to-center ratio, applies uniformly to both X and Y coordinates, also scales `stroke.size` proportionally
- Corner hit testing via `hitTestHandle()` returns corner names: 'tl', 'tr', 'bl', 'br'

**Integration approach:**
- Split scale into `scaleX` and `scaleY` components based on which axis the drag moves along
- When dragging a corner handle: compute separate X and Y scale factors based on displacement along each axis from center
- Edge handles (midpoints of bounding box sides) for axis-constrained scaling: top/bottom = scaleY only, left/right = scaleX only
- Apply non-uniform scale to stroke points: `newX = center.x + (x - center.x) * scaleX`, `newY = center.y + (y - center.y) * scaleY`
- Do NOT scale `stroke.size` with non-uniform scale (or scale by average of scaleX/scaleY)

**Components modified:**
| Component | Change |
|-----------|--------|
| `components/canvas/PaintOverlay.tsx` | Add edge midpoint handles, separate scaleX/scaleY tracking, non-uniform point transform |
| (no other files) | Self-contained in PaintOverlay |

**Data flow:**
```
PointerDown on edge handle (e.g., right-center)
    |
    v
Track horizontal displacement only -> scaleX factor
    |
    v
For each selected stroke point:
  point[0] = center.x + (point[0] - center.x) * scaleX
  // point[1] unchanged (horizontal-only edge handle)
```

**Complexity:** LOW. Extends existing transform infrastructure. Need to add 4 edge handles (mid-top, mid-bottom, mid-left, mid-right) and split the scale computation.

---

### Feature 5: Paint Properties Panel Cleanup

**What:** Space optimization, better button layout, more compact controls in `PaintProperties.tsx`.

**Current architecture:**
- `PaintProperties.tsx` is a single 500+ line component with inline rendering
- Contains: layer name + exit button, rendering indicators, paint background section, selection tools, brush style selector, stroke options (thinning/smoothing/etc), shape options, fill options, onion skin section, tablet section, brush FX sliders, frame actions (clear/copy/flatten)
- Collapsible sections via local state: `bgCollapsed`, `onionCollapsed`, `tabletCollapsed`

**Integration approach:**
- Extract sub-sections into smaller components for maintainability
- Compact the layout: use icon buttons instead of text buttons where possible
- Group related controls more tightly
- This is a pure UI refactor -- no store or data model changes

**Components modified/new:**
| Component | Change |
|-----------|--------|
| `components/sidebar/PaintProperties.tsx` | Major refactor: extract sub-components, compact layout |
| `components/sidebar/PaintBrushSettings.tsx` | **NEW** -- Extracted brush size/color/opacity controls |
| `components/sidebar/PaintStrokeOptions.tsx` | **NEW** -- Extracted thinning/smoothing/etc sliders |
| `components/sidebar/PaintFrameActions.tsx` | **NEW** -- Extracted clear/copy/flatten buttons |

**Complexity:** LOW. Pure UI work, no architectural changes.

---

### Feature 6: Sequence-Scoped Layer Creation

**What:** When a sequence is isolated (via isolationStore), the "Add Layer" action should add the layer only to that isolated sequence, not to the global active sequence.

**Current architecture:**
- `AddLayerMenu.tsx` dispatches layer add via `uiStore.setAddLayerIntent()` which routes to ImportedView
- `AddFxMenu.tsx` creates paint/FX layers via `sequenceStore.createFxSequence()` (global timeline scope)
- `sequenceStore.addLayer()` adds to `activeSequenceId` -- which is the sequence selected in the sidebar, not necessarily the isolated one
- `isolationStore.isolatedSequenceIds` tracks which sequences are in solo/isolation mode
- Content layers (static-image, image-sequence, video) are added to the active sequence via `sequenceStore.addLayer()`

**Integration approach:**
- When `isolationStore.hasIsolation` is true and exactly one sequence is isolated, use that sequence as the target for layer creation instead of the global active
- Modify `sequenceStore.addLayer()` to accept optional `targetSequenceId` parameter (defaults to `activeSequenceId`)
- Update `AddLayerMenu` and `AddFxMenu` to pass the isolated sequence ID when applicable
- For FX sequences created via `createFxSequence()`, scope `inFrame`/`outFrame` to the isolated sequence's frame range

**Components modified:**
| Component | Change |
|-----------|--------|
| `stores/sequenceStore.ts` | `addLayer()`: optional `targetSequenceId` param; new helper `getTargetSequenceId()` |
| `components/layer/AddLayerMenu.tsx` | Read isolation state, pass target sequence |
| `components/timeline/AddFxMenu.tsx` | Read isolation state, scope FX sequence range to isolated sequence |

**Data flow:**
```
User clicks "Add Layer" while sequence is isolated
    |
    v
AddLayerMenu reads isolationStore.isolatedSequenceIds
    |
    v
If exactly 1 isolated: targetId = isolatedId
Else: targetId = sequenceStore.activeSequenceId
    |
    v
sequenceStore.addLayer(layer, targetId)
```

**Complexity:** LOW. Mostly routing changes. The main risk is edge cases with multiple isolated sequences.

---

### Feature 7: Denser Motion Path Interpolation Visual

**What:** Show more dots for short sequences where one-dot-per-frame produces a sparse trail. Users need to see the path clearly even with 5-10 frame sequences.

**Current architecture:**
- `MotionPath.tsx` calls `sampleMotionDots()` which iterates `frame = firstFrame` to `lastFrame` with step = 1 (one dot per integer frame)
- For short sequences (e.g., 5 frames), this produces only 5 dots -- barely visible as a path
- For long sequences (>300 frames), switches to `<polyline>` SVG optimization
- Dots rendered as `<circle>` elements with `r={dotRadius}` at each sampled position

**Integration approach:**
- Modify `sampleMotionDots()` to accept a `density` multiplier or minimum dot count
- For sequences with few frames, interpolate at sub-frame positions (e.g., step = 0.25 instead of 1.0)
- The keyframe interpolation engine (`interpolateAt`) already handles fractional frame values (polynomial cubic easing)
- Set a minimum dot count (e.g., 30) -- if frame count < 30, use `step = frameRange / 30`

**Components modified:**
| Component | Change |
|-----------|--------|
| `components/canvas/MotionPath.tsx` | `sampleMotionDots()`: adaptive step size based on frame range |
| (no other files) | Self-contained change |

**Implementation:**
```typescript
// In sampleMotionDots():
const frameRange = lastFrame - firstFrame;
const MIN_DOTS = 30;
const step = frameRange < MIN_DOTS ? frameRange / MIN_DOTS : 1;

for (let t = firstFrame; t <= lastFrame; t += step) {
  const vals = interpolateAt(keyframes, t);  // already handles fractional frames
  if (vals) dots.push({ x: vals.x + canvasW / 2, y: vals.y + canvasH / 2, frame: t });
}
```

**Complexity:** VERY LOW. 5-10 line change to a pure function.

---

### Feature 8: Bezier/Spline Stroke Path Editing in Roto Paint

**What:** Edit individual stroke paths using bezier control points. Users can adjust the curvature of drawn strokes after drawing, similar to vector path editing in Illustrator.

**Current architecture:**
- `PaintStroke.points` stores `[x, y, pressure][]` -- raw recorded positions
- `strokeToPath()` in `paintRenderer.ts` converts points to a `Path2D` outline via `perfect-freehand` + quadratic bezier curves for smooth rendering
- Select tool can move/scale/rotate entire strokes but cannot edit individual control points
- Points are dense (every pointer move event), not sparse bezier anchors

**Integration approach:**
This is the most complex feature. Two paths:

**Path A (Recommended): Simplified path editing**
- Convert dense point array to simplified anchor points (Douglas-Peucker or similar reduction)
- Display anchor points as draggable handles when stroke is selected
- Moving an anchor updates the stroke path; re-densify or keep sparse
- No explicit bezier tangent handles -- just anchor point repositioning

**Path B: Full bezier editing**
- Convert point cloud to cubic bezier segments (least-squares fitting)
- Store bezier control points alongside or replacing the raw points
- Show anchor + tangent handles when editing
- Significantly more complex: needs bezier data model, hit testing for handles, tangent constraint logic

**Recommended: Path A** because it integrates naturally with existing `PaintStroke.points` format and avoids a parallel data model.

**Components modified/new:**
| Component | Change |
|-----------|--------|
| `lib/pathSimplify.ts` | **NEW** -- Douglas-Peucker point reduction algorithm |
| `types/paint.ts` | Optional `anchors?: [number, number][]` on PaintStroke for cached simplified path |
| `components/canvas/PaintOverlay.tsx` | New "edit path" mode within select tool: render anchor handles, handle drag on individual anchors |
| `lib/paintRenderer.ts` | When anchors exist, render from anchors instead of full points array |

**Data flow:**
```
User double-clicks selected stroke -> enters path edit mode
    |
    v
pathSimplify(stroke.points, tolerance) -> anchor points
    |
    v
Render anchor points as draggable circles on overlay canvas
    |
    v
User drags anchor point
    |
    v
Update anchor position, re-interpolate surrounding points
    |
    v
Re-render stroke with modified path
```

**Complexity:** HIGH. Path simplification is well-understood algorithmically but the UX for handle interaction, visual feedback, and re-rendering is substantial. This should be scheduled late in the milestone.

---

### Feature 9: Stroke List Panel in Roto Paint Edit Mode

**What:** Sidebar panel showing all strokes on the current frame as a list. Supports drag-and-drop reorder, delete, show/hide, and selection.

**Current architecture:**
- `PaintFrame.elements` is the ordered array of all paint elements on a frame
- `paintStore` has `moveElementsForward/Backward/ToFront/ToBack` methods for reordering
- `selectedStrokeIds` signal tracks selection
- `PaintProperties.tsx` shows selection actions but no element list
- SortableJS is already in the project (used for sidebar layer reorder)

**Integration approach:**
- New component rendered inside `PaintProperties.tsx` (or alongside it in LeftPanel)
- List items show: stroke type icon, color swatch, name/index, visibility toggle, delete button
- SortableJS for drag-and-drop reorder (proven pattern from LayerList)
- Click = select, Cmd+click = multi-select (mirrors PaintOverlay select behavior)
- Hidden strokes: add optional `visible` field to `PaintElement` union, default true
- Need to add `visible` check to `paintRenderer.ts` rendering loop

**Components modified/new:**
| Component | Change |
|-----------|--------|
| `components/sidebar/StrokeListPanel.tsx` | **NEW** -- List of strokes with SortableJS reorder |
| `types/paint.ts` | Optional `visible?: boolean` on PaintStroke (and other element types) |
| `lib/paintRenderer.ts` | Skip elements where `visible === false` |
| `components/sidebar/PaintProperties.tsx` or `components/layout/LeftPanel.tsx` | Mount StrokeListPanel when in paint edit mode |
| `stores/paintStore.ts` | `toggleElementVisibility(layerId, frame, elementId)` method |
| `stores/paintStore.ts` | `reorderElements(layerId, frame, fromIdx, toIdx)` method (for SortableJS callback) |

**Data flow:**
```
StrokeListPanel reads:
  paintStore.getFrame(layerId, currentFrame).elements
  paintStore.selectedStrokeIds
    |
    v
Renders list items with SortableJS wrapper
    |
    v
User interactions:
  Click item -> paintStore.selectStroke(id)
  Eye icon -> paintStore.toggleElementVisibility(layerId, frame, id)
  Drag reorder -> paintStore.reorderElements(layerId, frame, from, to)
  Delete icon -> paintStore.removeElement(layerId, frame, id)
```

**Complexity:** MEDIUM. The SortableJS integration pattern is proven (LayerList.tsx). The main work is the new component + store methods + visibility filtering in renderer.

---

## Component Boundaries

| Component | Responsibility | Modified By Features |
|-----------|----------------|---------------------|
| `types/paint.ts` | Paint data model | F1 (compositeMode), F8 (anchors), F9 (visible) |
| `types/layer.ts` | Layer data model | F1 (paint source composite field) |
| `stores/paintStore.ts` | Paint state management | F1, F2, F3, F9 |
| `lib/paintRenderer.ts` | Canvas 2D paint rendering | F1, F2, F8, F9 |
| `lib/previewRenderer.ts` | Multi-layer compositing | F1, F2 |
| `components/canvas/PaintOverlay.tsx` | Paint drawing/selection interaction | F3, F4, F8 |
| `components/sidebar/PaintProperties.tsx` | Paint tool properties UI | F1, F2, F5 |
| `components/canvas/MotionPath.tsx` | Motion path visualization | F7 |
| `stores/sequenceStore.ts` | Sequence/layer management | F6 |
| `components/layer/AddLayerMenu.tsx` | Layer creation UI | F6 |
| `components/timeline/AddFxMenu.tsx` | FX/paint layer creation | F6 |

## Recommended Build Order

Dependencies between features determine the optimal build sequence:

```
Phase 1: Foundation + Quick Wins (no cross-dependencies)
  F7: Denser motion path       -- isolated, 5-10 lines, instant win
  F5: Panel cleanup            -- pure UI, no data model changes
  F6: Sequence-scoped layers   -- isolated routing change

Phase 2: Paint Store Extensions
  F3: Alt+duplicate strokes    -- extends PaintOverlay select mode
  F4: Non-uniform scale        -- extends PaintOverlay transform mode
  F9: Stroke list panel        -- needs new store methods + UI component

Phase 3: Rendering Pipeline
  F2: Paper textures           -- post-process overlay on paint render
  F1: Luma matte compositing   -- changes compositing pipeline in PreviewRenderer

Phase 4: Complex Editing
  F8: Bezier path editing      -- most complex, benefits from F9 being done (stroke selection UX)
```

**Build order rationale:**
1. **Phase 1 first** because F7, F5, F6 are zero-risk, isolated changes that deliver immediate value.
2. **Phase 2** before Phase 3 because F3/F4/F9 extend the paint interaction model that F2/F1 depend on being stable. F9 (stroke list) provides better stroke management UX that makes testing F2/F1/F8 easier.
3. **Phase 3** touches the rendering pipeline which is shared by all features -- do this after interaction changes are stable.
4. **Phase 4 last** because F8 (bezier editing) is the riskiest feature with the most unknowns. It also benefits from F9 (stroke list for selection) and F4 (non-uniform scale for transform handles pattern).

**Cross-feature dependencies:**
- F9 -> F8: Stroke list panel makes testing bezier editing easier (select specific strokes)
- F4 -> F8: Edge handle pattern from non-uniform scale informs anchor point handle UX
- F1 depends on paint rendering pipeline being stable (F2 also modifies it)
- F2 and F1 modify the same rendering path -- build F2 first (additive overlay) then F1 (changes compositing logic)

## Architectural Patterns

### Pattern 1: Post-Process Paint Overlay

**What:** Apply visual effects as a final compositing step after all paint elements are rendered to the offscreen canvas, before the offscreen is composited onto the main preview canvas.

**When to use:** Paper textures (F2), luma matte extraction (F1), any future paint-layer-wide effects.

**Trade-offs:** Clean separation (effects don't interfere with stroke rendering), but adds one extra compositing pass per effect per frame.

```typescript
// In paintRenderer.ts
export function renderPaintFrameWithBg(ctx, frame, width, height, layerId, frameNum) {
  // 1. Background (skip for luma mode)
  if (compositeMode !== 'luma-matte') {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);
  }

  // 2. Render strokes (existing)
  renderFlatElements(ctx, frame, width, height);
  if (fxCache) ctx.drawImage(fxCache, 0, 0);

  // 3. Post-process: paper texture (F2)
  if (paperTextureEnabled && paperTexture) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = paperTextureOpacity;
    drawTiledTexture(ctx, paperTexture, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}
```

### Pattern 2: Alt-Key Modifier for Tool Variants

**What:** Use Alt key during pointer interactions to trigger variant behavior (clone instead of move, constrain axis, etc).

**When to use:** F3 (duplicate stroke), potentially other tool modifications.

**Trade-offs:** Discoverable via tooltip, matches Photoshop/After Effects conventions. Must check `e.altKey` at pointer-down time (not continuously during drag).

```typescript
// In PaintOverlay.tsx handleSelectPointerDown
if (selected.has(hitStrokeId)) {
  if (e.altKey) {
    // Clone selected strokes with new IDs
    const clones = cloneSelectedStrokes(paintFrame, selected, layerId, frame);
    paintStore.clearSelection();
    for (const clone of clones) paintStore.selectStroke(clone.id);
  }
  isDragging.current = true;
  dragStart.current = { x: point.x, y: point.y };
}
```

### Pattern 3: Adaptive Interpolation Density

**What:** Increase interpolation sample count when source data is sparse, to maintain visual continuity.

**When to use:** F7 (motion path dots), potentially future animation previews.

```typescript
// Ensure minimum visual density regardless of frame count
const frameRange = lastFrame - firstFrame;
const MIN_SAMPLES = 30;
const step = frameRange > 0 ? Math.min(1, frameRange / MIN_SAMPLES) : 1;
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying PaintStroke Points In-Place Without Undo

**What people do:** Directly mutate `stroke.points[i]` during transform operations without capturing before-state for undo.
**Why it's wrong:** The current transform code in PaintOverlay already does this (lines 749-777) -- transforms are not undoable. New features (F3, F4, F8) must not repeat this pattern.
**Do this instead:** Capture `structuredClone()` of affected strokes before transform begins. Push undo action on pointer-up with before/after snapshots.

### Anti-Pattern 2: Adding Signals to paintStore Without paintVersion Bump

**What people do:** Add new state to paintStore but forget to increment `paintVersion` on changes.
**Why it's wrong:** The preview canvas only re-renders when `paintVersion` changes. Without the bump, visual changes won't appear.
**Do this instead:** Every mutation that affects visual output must include `paintVersion.value++`. New features F2 (paper texture toggle), F9 (visibility toggle) must follow this pattern.

### Anti-Pattern 3: Blocking Rendering with Synchronous Pixel Manipulation

**What people do:** Run `getImageData` + pixel loop + `putImageData` synchronously for luma extraction (F1) on every frame.
**Why it's wrong:** For 1920x1080, that's 2M pixels * 4 channels = 8MB of data to process. At 24fps, this will cause frame drops.
**Do this instead:** Cache the luma-extracted canvas and only recompute when paint data changes (same pattern as `_frameFxCache` in paintStore). Use `paintVersion` as cache invalidation key.

### Anti-Pattern 4: Storing Absolute File Paths in Project Format

**What people do:** Store the full path to paper textures in the .mce project file.
**Why it's wrong:** Projects become non-portable between machines. `~/.config/efx-motion/papers/` path differs per user.
**Do this instead:** Store only the texture filename (e.g., `"cold-pressed.png"`). Resolve against the well-known config directory at load time. If texture not found, fall back gracefully (disable texture, show warning).

## Persistence and Format Considerations

### .mce Format Changes

Features F1, F2, and F9 introduce new data that must be persisted:

| Feature | Data | Storage Location | Migration |
|---------|------|-----------------|-----------|
| F1: Luma matte | `compositeMode` on paint source | `.mce` project file, Layer.source | v16: add `compositeMode` field with `serde(default)` |
| F2: Paper texture | `paperTexture`, `paperTextureOpacity` | `.mce` project file, Layer.source | v16: add fields with `serde(default)` |
| F9: Stroke visibility | `visible` on PaintElement | `paint/{uuid}/frame-NNN.json` sidecar | Backward compat: missing `visible` = true |
| F8: Bezier anchors | `anchors` on PaintStroke | `paint/{uuid}/frame-NNN.json` sidecar | Backward compat: missing `anchors` = use points |

All new fields use `serde(default)` or optional fields with backward-compatible defaults. This follows the proven progressive migration pattern (v1-v15).

**Recommendation:** Bump to .mce v16 in a single step covering F1 + F2 changes. Sidecar format changes (F8, F9) don't require version bumps since they use optional fields.

## Scaling Considerations

| Concern | Current State | With v0.6.0 Features |
|---------|---------------|---------------------|
| Paint render perf | Fast for < 100 strokes/frame | F1 (luma) adds per-frame pixel processing -- cache aggressively |
| Paper texture memory | N/A | ~2-4MB per loaded texture image, LRU cache for 5-10 textures |
| Stroke list DOM | N/A | F9: SortableJS handles 100+ items well (proven with layer list) |
| Bezier anchor count | N/A | F8: Douglas-Peucker with 5px tolerance typically reduces 500 points to 20-30 anchors |
| Motion path SVG | Polyline optimization > 300 dots | F7: More dots but still well within SVG performance (< 100 circles even with sub-frame) |

## Sources

- Codebase analysis: all findings verified against actual source files in `/Users/lmarques/Dev/efx-motion-editor/Application/src/`
- Key files examined:
  - `types/paint.ts` -- data model
  - `types/layer.ts` -- layer type system
  - `stores/paintStore.ts` -- paint state management
  - `stores/sequenceStore.ts` -- sequence/layer CRUD
  - `stores/isolationStore.ts` -- isolation state
  - `lib/paintRenderer.ts` -- Canvas 2D paint rendering
  - `lib/previewRenderer.ts` -- multi-layer compositing pipeline
  - `lib/brushP5Adapter.ts` -- p5.brush integration
  - `components/canvas/PaintOverlay.tsx` -- paint interaction handler
  - `components/canvas/MotionPath.tsx` -- motion path visualization
  - `components/sidebar/PaintProperties.tsx` -- paint properties panel
  - `components/layer/AddLayerMenu.tsx` -- layer creation menu
  - `components/timeline/AddFxMenu.tsx` -- FX/paint layer creation

---
*Architecture research for: EFX-Motion Editor v0.6.0 Various Enhancements*
*Researched: 2026-03-26*
