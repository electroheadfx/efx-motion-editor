# Phase 11: Live Canvas Transform - Research

**Researched:** 2026-03-13
**Domain:** Canvas 2D interactive transform handles, coordinate space mapping, pointer event routing
**Confidence:** HIGH

## Summary

This phase adds Figma-style interactive transform handles to the canvas preview, allowing users to click-select layers, drag to move, corner-drag to scale, and rotate layers directly on the canvas. The implementation involves five interlocking domains: (1) a data model migration from `scale` to `scaleX`/`scaleY`, (2) a coordinate mapping pipeline between mouse/screen/canvas/layer spaces, (3) an overlay rendering system for bounding boxes and handles, (4) a pointer event routing system that distinguishes between select, move, scale, rotate, and pan operations, and (5) keyboard shortcuts for nudge and deselect.

The project uses Preact with Signals for state management, Canvas 2D for rendering, and tinykeys for keyboard shortcuts. The existing `PreviewRenderer` already implements the exact transform pipeline (translate to center + offset, rotate, scale, aspect-fit) that the handle overlay must replicate. The existing `startCoalescing()`/`stopCoalescing()` history API is the correct pattern for batching drag operations into single undo entries.

**Primary recommendation:** Implement as a separate `TransformOverlay` component rendered as an absolutely-positioned HTML/SVG layer on top of the canvas `<div>`, using CSS transforms to stay aligned with the canvas zoom/pan. All pointer interactions route through this overlay before falling through to the existing pan/zoom handlers. The data model migration (`scale` to `scaleX`/`scaleY`) should be done first as a foundation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Auto-detect mode (Figma-style): click on a layer = select & show handles, click on empty area = deselect, middle-click or Space+drag = pan (any time), Cmd+scroll = zoom (unchanged)
- Small drag threshold (3-5px) before move begins -- click without dragging = just select, prevents accidental nudges
- Left-click pan (current behavior when zoomed beyond fit) is replaced by the auto-detect model -- pan moves to middle-click and Space+drag only
- Arrow keys context-based: when layer selected, arrows nudge 1px (Shift+arrows = 10px); when no layer selected, left/right arrows step frames as before
- Escape key deselects layer, hides handles, returns arrows to frame stepping mode
- Figma-style handles: thin blue bounding box outline (1-2px), small white-fill square corner handles with blue border
- Rotation: hover outside corners shows curved arrow rotation cursor -- drag to rotate
- Edge midpoint handles for non-uniform scaling (stretch width or height independently)
- Handles maintain fixed screen-pixel size regardless of canvas zoom level (counter-scale with zoom)
- Corner drag = uniform scale (lock aspect ratio). Edge drag = scale one axis only.
- Split `LayerTransform.scale` into `scaleX` and `scaleY` for non-uniform scaling
- Requires .mce format migration (v4 to v5): convert existing `scale` value to `scaleX: scale, scaleY: scale`
- PropertiesPanel TransformSection needs update from single "Scale" input to "ScaleX" + "ScaleY" inputs (or "W" + "H")
- Hit-test topmost visible layer whose non-transparent pixels are under cursor
- If clicked pixel is transparent on topmost layer, test next layer down in z-order
- Click on empty/background area = deselect all, hide handles
- Alt+click at same spot cycles through overlapping layers in z-order
- Only content layers (static-image, image-sequence, video) are selectable on canvas -- FX/generator/adjustment layers are selected via sidebar only
- Canvas selection and sidebar selection stay in sync bidirectionally (selecting on canvas highlights in sidebar, selecting in sidebar shows handles on canvas)
- No crop handles on canvas -- crop stays as panel-only controls (numeric T/R/B/L inputs)
- Bounding box and handles reflect the cropped (visible) content bounds, not the original uncropped extent

### Claude's Discretion
- Coordinate mapping implementation (mouse to screen to canvas zoom/pan to layer-local space)
- Handle hit-test areas and cursor changes (resize cursors, rotation cursor, move cursor)
- Transform overlay rendering approach (separate overlay canvas vs inline drawing vs HTML overlay)
- Rotation handle UX details (how far from corner to hover, visual indicator)
- Aspect ratio constraint behavior during corner scale (always locked vs Shift to unlock)
- Undo integration for canvas-initiated transforms (coalescing during drag, commit on pointerup)
- Performance optimization for hit-testing (pixel sampling vs bounding box pre-check)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Preact | ^10.28.4 | UI framework (JSX components) | Already in use project-wide |
| @preact/signals | ^2.8.1 | Reactive state management | Already in use for all stores |
| tinykeys | ^3.0.0 | Keyboard shortcuts | Already used for all shortcuts |
| Canvas 2D API | Browser native | Preview rendering | Already used by PreviewRenderer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| HTML/CSS overlay | Browser native | Transform handle rendering | Recommended over second canvas for DOM cursor support and CSS transform alignment |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML/CSS overlay | Second canvas overlay | HTML gives free cursor management, CSS transform alignment with parent canvas div. Second canvas would need manual cursor handling and pixel-perfect alignment math |
| HTML/CSS overlay | SVG overlay | SVG gives vector precision but adds complexity. HTML divs with CSS transforms are simpler and sufficient for rectangular handles |
| Pixel-perfect hit test | Bounding box only | Pixel sampling gives accurate hit testing for non-rectangular/rotated images but is slower. Bounding box pre-check + pixel fallback is the recommended hybrid |

**Installation:** No new dependencies needed -- everything uses existing project stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
  components/
    layout/
      CanvasArea.tsx          # MODIFIED: host TransformOverlay, route pointer events
      PropertiesPanel.tsx     # MODIFIED: scaleX/scaleY inputs
    canvas/                   # NEW directory
      TransformOverlay.tsx    # NEW: bounding box, handles, cursor management
      transformHandles.ts     # NEW: handle geometry, hit-testing, math utilities
      coordinateMapper.ts     # NEW: screen <-> canvas <-> layer coordinate transforms
      hitTest.ts              # NEW: layer hit testing (bounding box + pixel sampling)
  types/
    layer.ts                  # MODIFIED: scale -> scaleX, scaleY
    project.ts                # MODIFIED: MceLayerTransform gets scale_x, scale_y
  stores/
    canvasStore.ts            # MODIFIED: expose containerRect for coordinate mapping
    layerStore.ts             # MINOR: no structural changes, updateLayer already supports partial transform
  lib/
    previewRenderer.ts        # MODIFIED: scale(scaleX, scaleY) instead of scale(scale, scale)
    shortcuts.ts              # MODIFIED: context-dependent arrows, Escape deselect
  stores/
    projectStore.ts           # MODIFIED: v5 format, migration logic
```

### Pattern 1: Coordinate Space Pipeline
**What:** Chain of coordinate transforms from mouse event to layer-local space
**When to use:** Every pointer interaction on the canvas
**Example:**
```typescript
// Source: Canvas 2D specification + project's existing transform math

interface Point { x: number; y: number; }

/**
 * Convert mouse clientX/clientY to layer-local coordinates.
 * Must exactly mirror the transform chain in PreviewRenderer.drawLayer():
 *   1. Container DOM rect (client -> container-local)
 *   2. Canvas zoom/pan CSS transform: scale(zoom) translate(panX, panY)
 *   3. Canvas resolution: container-local to project-resolution space
 *   4. Layer transform: translate(x + w/2, y + h/2) -> rotate -> scale
 */
function clientToCanvas(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  zoom: number,
  panX: number,
  panY: number,
  projectWidth: number,
  projectHeight: number,
): Point {
  // 1. Client -> container center-relative
  const containerCenterX = containerRect.left + containerRect.width / 2;
  const containerCenterY = containerRect.top + containerRect.height / 2;
  const relX = clientX - containerCenterX;
  const relY = clientY - containerCenterY;

  // 2. Undo CSS transform: scale(zoom) translate(panX, panY)
  //    The CSS applies scale first, then translate (in scaled space)
  //    So to invert: divide by zoom, then subtract pan
  const canvasX = relX / zoom - panX;
  const canvasY = relY / zoom - panY;

  // 3. Canvas-relative -> project-resolution
  //    The canvas div is sized to projectWidth x projectHeight in CSS pixels
  //    canvasX/canvasY are now relative to the center of that div
  //    Convert to top-left origin project coordinates
  const projX = canvasX + projectWidth / 2;
  const projY = canvasY + projectHeight / 2;

  return { x: projX, y: projY };
}

/**
 * Convert project-resolution coordinates to client coordinates (for handle positioning).
 * Inverse of clientToCanvas.
 */
function canvasToClient(
  projX: number,
  projY: number,
  containerRect: DOMRect,
  zoom: number,
  panX: number,
  panY: number,
  projectWidth: number,
  projectHeight: number,
): Point {
  const canvasX = projX - projectWidth / 2;
  const canvasY = projY - projectHeight / 2;
  const relX = (canvasX + panX) * zoom;
  const relY = (canvasY + panY) * zoom;
  const containerCenterX = containerRect.left + containerRect.width / 2;
  const containerCenterY = containerRect.top + containerRect.height / 2;
  return {
    x: containerCenterX + relX,
    y: containerCenterY + relY,
  };
}
```

### Pattern 2: Transform Handle Overlay (HTML div approach)
**What:** Absolutely-positioned div on top of the canvas that matches the canvas zoom/pan transform
**When to use:** Rendering bounding box and handles
**Example:**
```typescript
// The TransformOverlay div sits inside the same container as the canvas
// and uses the SAME CSS transform, so handle positions are in project-resolution space.
// Handle elements counter-scale with zoom to maintain fixed screen-pixel size.

// In CanvasArea.tsx, both the canvas wrapper and overlay share the same transform:
<div style={{
  width: `${projectWidth}px`,
  height: `${projectHeight}px`,
  transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
  transformOrigin: 'center center',
}}>
  <Preview />
  <TransformOverlay />  {/* Absolutely positioned within same transformed div */}
</div>

// Inside TransformOverlay, handles are positioned in project-resolution coordinates
// and counter-scaled so they appear fixed-size on screen:
const handleSize = 8; // screen pixels
const counterScale = 1 / zoom;
<div style={{
  position: 'absolute',
  left: `${cornerX}px`,
  top: `${cornerY}px`,
  width: `${handleSize * counterScale}px`,
  height: `${handleSize * counterScale}px`,
  transform: `translate(-50%, -50%)`,
  // ... handle styling
}} />
```

### Pattern 3: Drag State Machine
**What:** Pointer event routing through a state machine for different interaction modes
**When to use:** Distinguishing click-select, move-drag, scale-drag, rotate-drag, and pan
**Example:**
```typescript
type DragMode = 'none' | 'pending' | 'move' | 'scale' | 'rotate' | 'pan';

interface DragState {
  mode: DragMode;
  startClientX: number;
  startClientY: number;
  startLayerTransform: LayerTransform;  // snapshot at pointerdown
  handleType?: HandleType;  // which handle was grabbed
  layerId?: string;
}

// DRAG_THRESHOLD prevents accidental moves on click
const DRAG_THRESHOLD = 4; // pixels

// On pointerdown:
//   1. Hit-test handles first (if layer selected)
//   2. If handle hit -> mode = 'pending', handleType = which handle
//   3. If no handle hit, hit-test layers
//   4. If layer hit -> select layer, mode = 'pending' (for potential move)
//   5. If nothing hit -> deselect, or start pan if Space held

// On pointermove:
//   If mode === 'pending' and distance > DRAG_THRESHOLD:
//     Transition to actual mode (move/scale/rotate)
//     Call startCoalescing()
//   If mode === 'move'/'scale'/'rotate':
//     Apply transform delta, update layer via layerStore.updateLayer()

// On pointerup:
//   If mode was active drag: call stopCoalescing()
//   If mode was 'pending' (never exceeded threshold): just select (already done)
//   Reset mode to 'none'
```

### Pattern 4: Bounding Box Geometry Calculation
**What:** Computing the 4 corners of a layer's visible bounding box in project space
**When to use:** Positioning the overlay bounding box and handles
**Example:**
```typescript
// Must replicate PreviewRenderer.drawLayer() transform math exactly:
// 1. Aspect-fit source to canvas (with crop applied)
// 2. Center at (transform.x + canvasW/2, transform.y + canvasH/2)
// 3. Rotate by transform.rotation
// 4. Scale by transform.scaleX, transform.scaleY

function getLayerBounds(
  layer: Layer,
  sourceWidth: number,
  sourceHeight: number,
  canvasW: number,
  canvasH: number,
): { corners: Point[]; center: Point; drawW: number; drawH: number } {
  const { cropTop, cropRight, cropBottom, cropLeft } = layer.transform;

  // Calculate effective source dimensions after crop
  let srcW = sourceWidth;
  let srcH = sourceHeight;
  const hasCrop = cropTop || cropRight || cropBottom || cropLeft;
  if (hasCrop) {
    srcW = sourceWidth * (1 - cropLeft - cropRight);
    srcH = sourceHeight * (1 - cropTop - cropBottom);
  }

  // Aspect-fit to canvas
  const aspect = srcW / srcH;
  const canvasAspect = canvasW / canvasH;
  let drawW: number, drawH: number;
  if (aspect > canvasAspect) {
    drawW = canvasW;
    drawH = canvasW / aspect;
  } else {
    drawH = canvasH;
    drawW = canvasH * aspect;
  }

  // Center point in project space
  const cx = layer.transform.x + canvasW / 2;
  const cy = layer.transform.y + canvasH / 2;

  // Half-dimensions after scale
  const hw = (drawW / 2) * layer.transform.scaleX;
  const hh = (drawH / 2) * layer.transform.scaleY;

  // Four corners before rotation (relative to center)
  const localCorners: Point[] = [
    { x: -hw, y: -hh }, // top-left
    { x:  hw, y: -hh }, // top-right
    { x:  hw, y:  hh }, // bottom-right
    { x: -hw, y:  hh }, // bottom-left
  ];

  // Rotate around center
  const rad = (layer.transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = localCorners.map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));

  return { corners, center: { x: cx, y: cy }, drawW, drawH };
}
```

### Anti-Patterns to Avoid
- **Drawing handles on the preview canvas:** The preview canvas is re-rendered every frame and handles would flicker/disappear. Use a separate overlay layer.
- **Using getBoundingClientRect on the canvas element for coordinate mapping:** The canvas element fills its parent via CSS and has DPI scaling. Map through the parent container div + CSS transform chain instead.
- **Storing handle positions in state:** Handle positions are derived from layer transform + canvas zoom/pan. Compute them on each render, never store them.
- **Separate selection signals for canvas vs sidebar:** Both use `layerStore.selectedLayerId` -- one signal, two consumers. Adding a separate canvas selection signal causes sync bugs.
- **Using CSS `pointer-events: none` on the overlay during pan:** Instead, let the overlay's pointerdown handler detect pan conditions (middle-click, Space held) and forward the event to the existing pan handler.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coordinate transforms | Custom matrix math from scratch | Systematic pipeline function mirroring CSS transform chain | The CanvasArea already applies `scale(zoom) translate(panX, panY)` via CSS -- the overlay lives inside this same div, so coordinates are already in project space |
| Undo for drag ops | Custom undo batching | Existing `startCoalescing()`/`stopCoalescing()` from `history.ts` | Already handles the exact pattern needed: first pushAction captures pre-drag state, subsequent pushes during drag only update the redo closure |
| Layer property updates | Direct signal mutation | Existing `layerStore.updateLayer()` -> `sequenceStore.updateLayer()` | Already handles undo push, snapshot, dirty marking |
| Keyboard shortcut registration | Direct addEventListener | Existing tinykeys setup in `shortcuts.ts` | Consistent with all other shortcuts, handles input suppression |
| .mce format versioning | Ad-hoc version checks | Version field in MceProject + migration in `hydrateFromMce()` | Project already uses version field (currently v4), migration logic is centralized |

**Key insight:** The existing codebase has mature patterns for undo coalescing, layer updates, and keyboard shortcuts. The new code should plug into these patterns rather than inventing parallel systems.

## Common Pitfalls

### Pitfall 1: CSS Transform Order Mismatch
**What goes wrong:** The coordinate mapping inverts the CSS transform in the wrong order, causing handles to drift from the actual layer position.
**Why it happens:** CSS `transform: scale(z) translate(px, py)` applies translate in scaled space. The inversion must account for this: divide by zoom first, then subtract pan.
**How to avoid:** Write the coordinate mapping function once, test it by clicking known positions and verifying the output matches expected project coordinates. The existing CSS transform is `scale(zoom) translate(panX, panY)` with `transformOrigin: center center`.
**Warning signs:** Handles are offset from the layer, and the offset changes with zoom level.

### Pitfall 2: Renderer Transform Pipeline Mismatch
**What goes wrong:** Handle bounding box doesn't align with the rendered layer because the overlay calculates bounds differently from `PreviewRenderer.drawLayer()`.
**Why it happens:** The renderer has a specific transform pipeline: translate(x + w/2, y + h/2) -> rotate(rotation) -> scale(scale) -> then aspect-fit drawImage centered. The overlay must replicate this exactly.
**How to avoid:** Extract the geometry calculation into a shared utility used by both the renderer and the overlay. Or at minimum, have the overlay calculation reference the renderer code line-by-line.
**Warning signs:** Handles are close but slightly off, especially with rotation or non-default scale.

### Pitfall 3: DPI/Retina Scaling Confusion
**What goes wrong:** Hit testing or handle positioning is off by 2x on Retina displays.
**Why it happens:** The canvas internal resolution is `displayWidth * devicePixelRatio`, but the CSS layout uses logical pixels. The overlay operates in CSS space, not canvas-pixel space.
**How to avoid:** The TransformOverlay is an HTML element positioned in CSS pixels -- it naturally uses logical coordinates. Never mix canvas-pixel coordinates with overlay CSS coordinates. For pixel-sampling hit tests, multiply by `devicePixelRatio` when reading canvas pixel data.
**Warning signs:** Everything works on 1x displays but is offset on Retina.

### Pitfall 4: Pointer Event Conflicts Between Overlay and Pan/Zoom
**What goes wrong:** Pan/zoom stops working when the overlay is visible, or the overlay intercepts events that should go to pan/zoom.
**Why it happens:** The overlay captures all pointer events and doesn't forward pan/zoom conditions.
**How to avoid:** The overlay's pointerdown handler must check for: (a) middle-click -> forward to pan handler, (b) Space key held -> forward to pan handler, (c) Cmd+scroll -> let wheel event propagate to zoom handler. The overlay should NOT use `pointer-events: none` conditionally -- instead, explicitly route events.
**Warning signs:** Users can't pan or zoom when a layer is selected.

### Pitfall 5: Undo Corruption from Missing Coalescing
**What goes wrong:** Every pixel of drag movement creates a separate undo entry, making Cmd+Z useless (dozens of undo steps for a single drag).
**Why it happens:** `layerStore.updateLayer()` calls `sequenceStore.updateLayer()` which pushes to undo on every call.
**How to avoid:** Call `startCoalescing()` when drag begins (mode transitions from 'pending' to 'move'/'scale'/'rotate'), and `stopCoalescing()` on pointerup. This is the exact pattern used by `NumericInput` label drag in `PropertiesPanel.tsx:72-105`.
**Warning signs:** Undoing a single move operation requires many Cmd+Z presses.

### Pitfall 6: scaleX/scaleY Migration Breaking Existing Projects
**What goes wrong:** Opening a v4 project after the scale split crashes or shows layers at wrong scale.
**Why it happens:** The `hydrateFromMce()` function reads `ml.transform.scale` but the new interface has `scaleX`/`scaleY`.
**How to avoid:** In `hydrateFromMce()`, detect version < 5 and convert: `scaleX: ml.transform.scale, scaleY: ml.transform.scale`. The MceLayerTransform type needs both old and new fields with fallback logic.
**Warning signs:** Old projects open with layers at scale 0 or default scale instead of their saved values.

### Pitfall 7: Layer Hit Test Performance with Pixel Sampling
**What goes wrong:** Clicking on the canvas causes a visible lag because pixel sampling reads ImageData for every visible layer.
**Why it happens:** `getImageData()` forces a GPU readback, which is expensive.
**How to avoid:** Use a two-phase approach: (1) bounding box check first (fast, eliminates most layers), (2) pixel sample only for layers whose bounding box contains the click point. For the bounding box check, compute the oriented bounding box from the layer's transform corners and use point-in-polygon test.
**Warning signs:** Noticeable delay when clicking on the canvas with many layers.

### Pitfall 8: Aspect Ratio Lost During Non-Uniform Scale
**What goes wrong:** Corner drag (which should lock aspect ratio) allows non-uniform scaling, or edge drag (which should be one-axis) affects both axes.
**Why it happens:** The scale delta calculation doesn't distinguish between corner and edge handles, or doesn't constrain the ratio correctly.
**How to avoid:** Corner handles compute a single scale factor from the diagonal distance change and apply it to both scaleX and scaleY. Edge handles compute the scale factor from the perpendicular distance change and apply it to only the relevant axis (X for left/right edges, Y for top/bottom edges).
**Warning signs:** Dragging a corner handle distorts the image aspect ratio.

## Code Examples

### Transform Update from Canvas Drag (Move)
```typescript
// Source: Existing pattern from PropertiesPanel.tsx NumericInput + history.ts

function onMovePointerMove(e: PointerEvent, dragState: DragState) {
  const zoom = canvasStore.zoom.peek();

  // Delta in screen pixels -> convert to project-resolution pixels
  const dx = (e.clientX - dragState.startClientX) / zoom;
  const dy = (e.clientY - dragState.startClientY) / zoom;

  // Apply delta to the starting transform (captured at pointerdown)
  layerStore.updateLayer(dragState.layerId!, {
    transform: {
      ...dragState.startLayerTransform,
      x: dragState.startLayerTransform.x + dx,
      y: dragState.startLayerTransform.y + dy,
    },
  });
}
```

### Rotation from Canvas Drag
```typescript
// Source: Standard 2D rotation interaction pattern

function onRotatePointerMove(e: PointerEvent, dragState: DragState) {
  const zoom = canvasStore.zoom.peek();
  const bounds = getSelectedLayerBounds();
  if (!bounds) return;

  // Get mouse position relative to layer center (in project space)
  const mouse = clientToCanvasProject(e.clientX, e.clientY);
  const startMouse = clientToCanvasProject(
    dragState.startClientX,
    dragState.startClientY,
  );

  // Angle from center to current mouse
  const currentAngle = Math.atan2(
    mouse.y - bounds.center.y,
    mouse.x - bounds.center.x,
  );
  const startAngle = Math.atan2(
    startMouse.y - bounds.center.y,
    startMouse.x - bounds.center.x,
  );

  const deltaAngle = ((currentAngle - startAngle) * 180) / Math.PI;

  layerStore.updateLayer(dragState.layerId!, {
    transform: {
      ...dragState.startLayerTransform,
      rotation: dragState.startLayerTransform.rotation + deltaAngle,
    },
  });
}
```

### Scale from Corner Handle Drag (Uniform)
```typescript
// Source: Standard 2D scale interaction pattern

function onScalePointerMove(e: PointerEvent, dragState: DragState) {
  const mouse = clientToCanvasProject(e.clientX, e.clientY);
  const bounds = getSelectedLayerBounds();
  if (!bounds) return;

  const center = bounds.center;

  // Distance from center to current mouse vs distance from center to start mouse
  const startMouse = clientToCanvasProject(
    dragState.startClientX,
    dragState.startClientY,
  );
  const startDist = Math.hypot(
    startMouse.x - center.x,
    startMouse.y - center.y,
  );
  const currentDist = Math.hypot(
    mouse.x - center.x,
    mouse.y - center.y,
  );

  if (startDist < 1) return; // avoid division by zero

  const scaleFactor = currentDist / startDist;

  if (dragState.handleType === 'corner') {
    // Uniform scale: apply same factor to both axes
    layerStore.updateLayer(dragState.layerId!, {
      transform: {
        ...dragState.startLayerTransform,
        scaleX: dragState.startLayerTransform.scaleX * scaleFactor,
        scaleY: dragState.startLayerTransform.scaleY * scaleFactor,
      },
    });
  } else if (dragState.handleType === 'edge-left' || dragState.handleType === 'edge-right') {
    // Horizontal scale only
    layerStore.updateLayer(dragState.layerId!, {
      transform: {
        ...dragState.startLayerTransform,
        scaleX: dragState.startLayerTransform.scaleX * scaleFactor,
      },
    });
  } else {
    // Vertical scale only
    layerStore.updateLayer(dragState.layerId!, {
      transform: {
        ...dragState.startLayerTransform,
        scaleY: dragState.startLayerTransform.scaleY * scaleFactor,
      },
    });
  }
}
```

### v4 to v5 Migration in hydrateFromMce
```typescript
// Source: Existing pattern from projectStore.ts hydrateFromMce

// In the layer deserialization inside hydrateFromMce():
transform: {
  x: ml.transform.x,
  y: ml.transform.y,
  // v5 migration: scale -> scaleX + scaleY
  scaleX: ml.transform.scale_x ?? ml.transform.scale ?? 1,
  scaleY: ml.transform.scale_y ?? ml.transform.scale ?? 1,
  rotation: ml.transform.rotation,
  cropTop: ml.transform.crop_top,
  cropRight: ml.transform.crop_right,
  cropBottom: ml.transform.crop_bottom,
  cropLeft: ml.transform.crop_left,
},

// In buildMceProject() -- write v5 format:
transform: {
  x: layer.transform.x,
  y: layer.transform.y,
  scale_x: layer.transform.scaleX,
  scale_y: layer.transform.scaleY,
  rotation: layer.transform.rotation,
  crop_top: layer.transform.cropTop,
  crop_right: layer.transform.cropRight,
  crop_bottom: layer.transform.cropBottom,
  crop_left: layer.transform.cropLeft,
},
```

### Pixel Sampling Hit Test
```typescript
// Source: Canvas 2D getImageData API

/**
 * Test if the pixel at (projX, projY) in the rendered canvas is non-transparent.
 * Used as the second phase of hit testing (after bounding box pre-check passes).
 */
function isPixelOpaque(
  canvas: HTMLCanvasElement,
  projX: number,
  projY: number,
  canvasLogicalW: number,
  canvasLogicalH: number,
): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  const dpr = window.devicePixelRatio || 1;
  // Convert project coordinates to canvas pixel coordinates
  const px = Math.round(projX * dpr);
  const py = Math.round(projY * dpr);

  if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) return false;

  try {
    const imageData = ctx.getImageData(px, py, 1, 1);
    return imageData.data[3] > 10; // alpha > ~4% threshold
  } catch {
    return false; // Cross-origin or other error
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `LayerTransform.scale` (uniform) | `scaleX` + `scaleY` (non-uniform) | Phase 11 (this phase) | Enables edge midpoint handles for independent axis scaling |
| Left-click pan when zoomed | Auto-detect mode (click = select/move, middle-click/Space = pan) | Phase 11 (this phase) | Breaking change to pan interaction -- users must use middle-click or Space+drag |
| `.mce` format v4 | v5 (scale_x/scale_y) | Phase 11 (this phase) | Requires migration logic for backward compatibility |

**Deprecated/outdated:**
- `LayerTransform.scale` (single number): Replaced by `scaleX` and `scaleY`. All reads of `scale` must be updated.
- Left-click pan when zoomed beyond fit: Replaced by auto-detect interaction model. `CanvasArea.tsx` lines 51-52 (`isLeftAndZoomed` check) must be removed.

## Open Questions

1. **Pixel-perfect hit testing across render pipeline**
   - What we know: The preview canvas is DPI-scaled and rendered with layer compositing (blend modes, opacity). Hit testing individual layers requires isolating their alpha channel.
   - What's unclear: Whether to sample the composited canvas (faster but tests the composite, not individual layers) or render each layer to a temporary canvas for isolated pixel testing (accurate but slower).
   - Recommendation: Use bounding box pre-check with oriented polygon test. For the pixel sampling fallback, render the topmost content layer to a small temporary canvas (just the clicked region) and test its alpha. This avoids the expense of full-canvas getImageData and gives per-layer accuracy.

2. **Space+drag pan while layer selected**
   - What we know: Space key is currently bound to play/pause toggle via tinykeys. The auto-detect model requires Space+drag for panning.
   - What's unclear: Whether to track Space key state separately (keydown/keyup) and suppress the play/pause action during drag, or remap play/pause.
   - Recommendation: Track `isSpaceHeld` via keydown/keyup on the canvas container. When Space is pressed AND a pointermove occurs before Space is released, suppress the play/pause toggle and enable pan mode. When Space is pressed and released without mouse movement, toggle play/pause as before. This is the standard Figma/Photoshop pattern.

3. **Handle rendering during playback**
   - What we know: During playback, the rAF loop redraws the canvas rapidly. If the overlay is an HTML element, it won't be affected by canvas redraws.
   - What's unclear: Whether handles should remain visible during playback (layer position may change if animated, though this app doesn't have keyframe animation).
   - Recommendation: Hide handles during playback (`timelineStore.isPlaying` signal). Show them again when playback stops. This avoids confusing static handles over changing content.

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set to false in config.json -- including this section.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No test framework currently configured |
| Config file | none -- no test infrastructure exists |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| N/A | scaleX/scaleY data model split | manual | Build + visual inspection | N/A |
| N/A | v4 to v5 migration | manual | Open old project, verify layers render correctly | N/A |
| N/A | Coordinate mapping accuracy | manual | Click on layer corner, verify handle aligns | N/A |
| N/A | Handle visibility follows selection | manual | Click layer, verify handles appear | N/A |
| N/A | Move drag updates position | manual | Drag layer, verify X/Y in PropertiesPanel | N/A |
| N/A | Scale drag updates scaleX/scaleY | manual | Corner-drag handle, verify scale in panel | N/A |
| N/A | Rotation drag updates rotation | manual | Rotate via handle, verify rotation in panel | N/A |
| N/A | Arrow key nudge | manual | Select layer, press arrow, verify 1px move | N/A |
| N/A | Escape deselects | manual | Select layer, press Escape, verify handles hidden | N/A |

### Sampling Rate
- **Per task commit:** Manual visual testing (no automated tests)
- **Per wave merge:** `pnpm build` (TypeScript type checking) + manual visual testing
- **Phase gate:** Build succeeds + all manual behaviors verified

### Wave 0 Gaps
- No test framework exists in the project -- all validation is manual
- `pnpm build` (which runs `tsc --noEmit && vite build`) serves as the only automated check

## Sources

### Primary (HIGH confidence)
- Project source code: `Application/src/components/layout/CanvasArea.tsx` -- current pointer event handling, CSS transform chain
- Project source code: `Application/src/lib/previewRenderer.ts` -- exact transform pipeline (translate, rotate, scale, drawImage)
- Project source code: `Application/src/types/layer.ts` -- LayerTransform interface, layer type guards
- Project source code: `Application/src/lib/history.ts` -- coalescing undo pattern
- Project source code: `Application/src/stores/projectStore.ts` -- .mce serialization, version field, hydrateFromMce
- Project source code: `Application/src/stores/canvasStore.ts` -- zoom/pan signals, coordinate system
- Project source code: `Application/src/lib/shortcuts.ts` -- tinykeys shortcut registration pattern
- Canvas 2D API specification -- getImageData, transform methods

### Secondary (MEDIUM confidence)
- Standard 2D transform handle UX patterns (Figma, Photoshop, Sketch) -- well-established interaction conventions

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, everything uses existing project patterns
- Architecture: HIGH -- transform overlay approach is well-established, coordinate mapping is deterministic math
- Pitfalls: HIGH -- derived from careful analysis of existing codebase (CSS transform chain, renderer pipeline, undo system, DPI handling)
- Data model migration: HIGH -- straightforward field split with fallback defaults, existing version/migration pattern in project

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable -- no external dependency changes)
