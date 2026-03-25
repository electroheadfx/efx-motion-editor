# Phase 19: Add Paint Layer Rotopaint - Research

**Researched:** 2026-03-24
**Domain:** Frame-by-frame vector painting with perfect-freehand brush engine, Canvas 2D rendering, sidecar persistence
**Confidence:** HIGH

## Summary

This phase adds a paint/rotopaint layer type for frame-by-frame drawing and rotoscoping directly on the canvas. The paint layer is a new entry in the existing `LayerType` union and `LayerSourceData` discriminated union, following the established pattern used by all other layer types (generators, adjustments, content layers). The brush engine is based on perfect-freehand (v1.2.3), which converts input point arrays `[x, y, pressure]` into outline polygons rendered via Canvas 2D `Path2D` and `ctx.fill()`.

The architecture decomposes into: (1) type system extensions for paint layers, (2) a paintStore for managing per-frame stroke data and active tool state, (3) paint mode event routing in the canvas overlay, (4) rendering paint strokes in both preview and export pipelines, (5) sidecar file persistence alongside the .mce project, (6) paint tool UI in sidebar properties and floating toolbar, and (7) onion skinning for rotoscoping workflow.

**Primary recommendation:** Treat paint strokes as vector data (point arrays) stored per-frame in a paintStore, rendered at display time via perfect-freehand + Canvas 2D Path2D fill. Use sidecar JSON files (`paint/<layer-id>/frame-<NNN>.json`) for persistence, lazy-loaded on demand. Paint mode is a modal state toggled via canvas toolbar button that routes pointer events to the paint engine instead of the transform overlay.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Brush engine is based on perfect-freehand library -- smooth, pressure-sensitive strokes with variable width based on velocity/pressure
- **D-02:** Strokes stored as point arrays (x, y, pressure) -- perfect-freehand generates outline polygons at render time
- **D-03:** Each stroke carries its own color and opacity (per-stroke color + opacity model)
- **D-04:** Full tool suite: Brush, Eraser, Color picker (eyedropper), Fill (flood-fill), Line/shape tools (straight lines, rectangles, ellipses)
- **D-05:** Brush and eraser use perfect-freehand for freehand strokes; shapes are geometric primitives
- **D-06:** Vector strokes per frame -- each frame stores an array of stroke objects using perfect-freehand's point format, rendered at display time
- **D-07:** One paint frame per timeline frame -- every single timeline frame gets its own paint canvas, independent of key photos. True frame-by-frame animation support
- **D-08:** Onion skinning with configurable range -- show ghosted paint from N previous and N next frames while painting, with configurable opacity falloff and frame range
- **D-09:** Toggle button in canvas toolbar to enter/exit paint mode -- clear visual indicator (cursor change, border color), mouse events route to paint instead of layer transforms
- **D-10:** Tool options in both sidebar properties panel AND compact floating toolbar on canvas -- full controls in sidebar, quick access to size/color in floating bar
- **D-11:** Space+drag to pan, pinch/scroll to zoom while in paint mode -- release Space to resume painting (Photoshop/Procreate convention)
- **D-12:** Standard layer compositing -- paint layer sits in the layer stack like any other layer, supports existing blend modes and opacity
- **D-13:** Renders during preview and export via existing pipeline -- paint strokes rasterized to canvas at render time per frame
- **D-14:** Paint data stored in sidecar files alongside the .mce project (e.g., `paint/layer-id/frame-001.json`) -- keeps .mce file small, paint data lazy-loaded
- **D-15:** Project format version bump required for paint layer type recognition

### Claude's Discretion
- Brush size range and default values
- Stroke undo granularity (per-stroke vs grouped)
- Keyboard shortcuts for tool switching
- Onion skin default opacity falloff curve
- Exact floating toolbar layout and positioning
- Export performance optimization (raster caching strategy during export)
- Fill tool algorithm (scanline vs flood-fill)
- Shape tool rendering approach (stroke outline vs filled path)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Project Constraints (from CLAUDE.md)

- GSD tools from `.claude/get-shit-done` (not `$HOME/.claude/get-shit-done`)
- Do not run the server

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| perfect-freehand | 1.2.3 | Brush stroke outline generation from pressure-sensitive point input | Locked decision D-01. Lightweight (no deps), battle-tested in tldraw. Converts `[x,y,pressure][]` to outline polygon points |
| preact | 10.28.4+ | UI framework (already in project) | Existing project dependency |
| @preact/signals | 2.8.1+ | Reactive state management (already in project) | Existing project dependency, used by all stores |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-preact | 0.577+ | Icons for paint tools (brush, eraser, pipette, etc.) | Already in project. Use for toolbar icons |

### Not Needed
| Problem | Why No Library |
|---------|----------------|
| Flood fill | Hand-roll iterative scanline -- it's 50-80 lines of code operating on ImageData, no library worth the dependency |
| Canvas drawing | Native Canvas 2D API (`Path2D`, `ctx.fill()`) -- perfect-freehand outputs polygon points, no drawing library needed |
| Color picker | Existing `ColorPickerModal` component already in the project (used by solid sequence) |
| Shape tools | Simple Canvas 2D primitives (`strokeRect`, `strokeOval` via arc, `moveTo/lineTo`) |

**Installation:**
```bash
cd Application && pnpm add perfect-freehand
```

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  types/
    layer.ts          # Add 'paint' to LayerType union, PaintSourceData to LayerSourceData
    paint.ts           # NEW: PaintStroke, PaintFrame, PaintTool types
  stores/
    paintStore.ts      # NEW: Paint mode state, active tool, brush settings, per-frame stroke arrays
  lib/
    paintRenderer.ts   # NEW: Render paint strokes to Canvas 2D context (shared by preview + export)
    paintPersistence.ts # NEW: Save/load sidecar JSON files for paint frames
    paintFloodFill.ts  # NEW: Iterative flood fill on rasterized canvas ImageData
  components/
    canvas/
      PaintOverlay.tsx # NEW: Paint mode event handler overlay (replaces TransformOverlay when active)
    sidebar/
      PaintProperties.tsx # NEW: Full paint tool controls in sidebar
    overlay/
      PaintToolbar.tsx  # NEW: Compact floating toolbar on canvas
```

### Pattern 1: Paint Layer Type Extension
**What:** Add `'paint'` to the `LayerType` union and a paint-specific entry to `LayerSourceData`
**When to use:** Following the exact pattern used by all 12 existing layer types
**Example:**
```typescript
// types/layer.ts -- extend existing union
export type LayerType =
  | 'static-image'
  | 'image-sequence'
  | 'video'
  // ... existing types ...
  | 'paint';  // NEW

export type LayerSourceData =
  // ... existing variants ...
  | { type: 'paint'; layerId: string };  // references sidecar files via layerId
```

### Pattern 2: Paint Mode as Modal State (per D-09)
**What:** A signal-based modal state that routes canvas pointer events to paint engine vs transform overlay
**When to use:** This is the core interaction pattern. When paint mode is active AND a paint layer is selected, pointer events go to PaintOverlay instead of TransformOverlay.
**Example:**
```typescript
// stores/paintStore.ts
const paintMode = signal(false);        // toggle via canvas toolbar button
const activeTool = signal<PaintTool>('brush');
const brushSize = signal(8);
const brushColor = signal('#FFFFFF');
const brushOpacity = signal(1.0);
```

### Pattern 3: Per-Frame Stroke Storage (per D-06, D-07)
**What:** Each timeline frame has its own array of stroke objects. paintStore holds a Map<number, PaintStroke[]> per paint layer.
**When to use:** Core data model. Strokes are added to the current frame's array on pointerUp.
**Example:**
```typescript
// types/paint.ts
interface PaintStroke {
  id: string;
  tool: 'brush' | 'eraser';
  points: [number, number, number][];  // [x, y, pressure]
  color: string;         // hex color
  opacity: number;       // 0-1
  size: number;          // brush diameter in project pixels
  options: StrokeOptions; // perfect-freehand options (thinning, smoothing, streamline)
}

interface PaintShape {
  id: string;
  tool: 'line' | 'rect' | 'ellipse';
  // shape-specific geometry
  color: string;
  opacity: number;
  strokeWidth: number;
}

type PaintElement = PaintStroke | PaintShape;

interface PaintFrame {
  elements: PaintElement[];
}
```

### Pattern 4: Sidecar File Persistence (per D-14)
**What:** Paint data stored as `paint/<layer-id>/frame-<NNN>.json` files alongside the .mce project file
**When to use:** On project save, serialize modified paint frames to sidecar files. On project open, register which frames have paint data but lazy-load on demand.
**Example:**
```
MyProject/
  MyProject.mce          # main project file (version 13+)
  images/
  videos/
  paint/                  # NEW directory
    abc123-uuid/          # one dir per paint layer (using layer.id)
      frame-000.json      # stroke data for frame 0
      frame-001.json      # stroke data for frame 1
      ...
```

### Pattern 5: Rendering Paint Strokes
**What:** Convert stroke point arrays to filled polygons using `getStroke()`, render to Canvas 2D
**When to use:** Called by PreviewRenderer for paint layers, and by exportRenderer for export
**Example:**
```typescript
import { getStroke } from 'perfect-freehand';

function renderPaintFrame(ctx: CanvasRenderingContext2D, frame: PaintFrame) {
  for (const element of frame.elements) {
    if (element.tool === 'brush' || element.tool === 'eraser') {
      const outlinePoints = getStroke(element.points, {
        size: element.size,
        thinning: 0.5,
        smoothing: 0.5,
        streamline: 0.5,
        simulatePressure: false, // real pressure data provided
      });

      const path = new Path2D();
      if (outlinePoints.length > 0) {
        path.moveTo(outlinePoints[0][0], outlinePoints[0][1]);
        for (let i = 1; i < outlinePoints.length; i++) {
          path.lineTo(outlinePoints[i][0], outlinePoints[i][1]);
        }
        path.closePath();
      }

      ctx.save();
      ctx.globalAlpha = element.opacity;
      if (element.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000000';
      } else {
        ctx.fillStyle = element.color;
      }
      ctx.fill(path);
      ctx.restore();
    }
  }
}
```

### Pattern 6: Onion Skinning (per D-08)
**What:** Render ghosted paint from adjacent frames while painting, with configurable range and opacity falloff
**When to use:** Only during paint mode (not during normal preview/export)
**Example:**
```typescript
function renderOnionSkin(
  ctx: CanvasRenderingContext2D,
  currentFrame: number,
  prevRange: number,    // e.g., 3 frames back
  nextRange: number,    // e.g., 2 frames forward
  baseOpacity: number,  // e.g., 0.3
) {
  // Previous frames: blue/red tint, decreasing opacity
  for (let i = 1; i <= prevRange; i++) {
    const frameNum = currentFrame - i;
    const paintFrame = paintStore.getFrame(layerId, frameNum);
    if (!paintFrame) continue;
    const opacity = baseOpacity * (1 - i / (prevRange + 1));
    ctx.save();
    ctx.globalAlpha = opacity;
    // Tint previous frames with a color (e.g., red/pink)
    renderPaintFrame(ctx, paintFrame);
    ctx.restore();
  }
  // Next frames: similar with different tint (e.g., green/blue)
}
```

### Anti-Patterns to Avoid
- **Rasterizing paint to bitmap per frame:** Store vector strokes, not pixel data. Rasterization happens at render time. Bitmaps would explode file size (1920x1080x4 = 8MB per frame) and prevent resolution-independent rendering.
- **Storing paint data inside .mce file:** The .mce file would balloon to hundreds of MB. Sidecar files are loaded lazily and save incrementally.
- **Blocking main thread with flood fill:** Flood fill on a 1920x1080 canvas scans ~2M pixels. Use an iterative (stack-based, not recursive) algorithm to avoid stack overflow, and consider doing it on a small raster snapshot rather than full resolution.
- **Creating a new rendering pipeline for paint:** Paint layers MUST use the existing PreviewRenderer compositing loop (blend modes, opacity, layer order). Add a case in the render switch, don't create a parallel renderer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Smooth pressure-sensitive strokes | Custom bezier/catmull-rom brush | perfect-freehand `getStroke()` | Handles velocity, pressure, thinning, tapering, end caps -- deceptively complex to get right |
| Color picker | Custom HSV/RGB color picker | Existing `ColorPickerModal` component | Already built for solid sequence (Phase 15.2), includes HSV area + hue slider |
| Undo/redo for paint | Separate undo stack for paint | Existing `pushAction()` from `lib/history.ts` | Already supports 200 levels, coalescing for drag operations. Per-stroke undo fits naturally |

## Common Pitfalls

### Pitfall 1: Coordinate System Mismatch
**What goes wrong:** Paint strokes drawn at screen coordinates don't align with project coordinates after zoom/pan changes
**Why it happens:** The canvas is displayed with CSS `scale()` and `translate()`, creating a mismatch between mouse events (screen pixels) and project space (project pixels)
**How to avoid:** Use the existing `clientToCanvas()` function from `canvas/coordinateMapper.ts` to convert all pointer event coordinates to project space before storing stroke points. Paint strokes MUST be stored in project-space coordinates (0,0 = top-left of project canvas, project width/height = bottom-right)
**Warning signs:** Strokes appear offset or scaled incorrectly after zooming in/out

### Pitfall 2: Event Routing Conflict with TransformOverlay
**What goes wrong:** Paint mode events fight with layer transform drag events
**Why it happens:** TransformOverlay currently captures ALL pointer events on the canvas area via `pointerEvents: 'all'`
**How to avoid:** When paint mode is active AND a paint layer is selected, either (a) conditionally render PaintOverlay instead of TransformOverlay, or (b) add an early return in TransformOverlay's handlePointerDown that delegates to paint handler. Option (a) is cleaner. Space+drag for panning must still work in paint mode (D-11).
**Warning signs:** Can't paint, or transform handles appear during painting

### Pitfall 3: Flood Fill Performance
**What goes wrong:** Flood fill on high-resolution canvas (1920x1080 = 2M pixels) freezes the UI
**Why it happens:** Recursive flood fill causes stack overflow; naive iterative still scans millions of pixels
**How to avoid:** Rasterize the current frame's paint to an offscreen canvas at a reduced resolution (e.g., 1/4 scale) for flood fill calculation, then scale the fill result back. Or use scanline flood fill which is more efficient than pixel-by-pixel.
**Warning signs:** UI freezes for >100ms on fill tool click

### Pitfall 4: Undo/Redo State Size
**What goes wrong:** Each undo entry snapshots the entire sequence store (structuredClone), and paint frames could be large
**Why it happens:** The existing snapshot/restore pattern clones all sequences including paint frame data
**How to avoid:** Paint frame data should NOT be stored in the sequence store's snapshot. Keep paint data in a separate paintStore with its own undo mechanism. Paint undo entries capture only the paint layer's frame data (the strokes array for the affected frame), not the entire sequence state. Use the existing `pushAction()` with closures that undo/redo only the paint operation.
**Warning signs:** Memory spikes when painting many strokes, undo becomes slow

### Pitfall 5: Sidecar File Sync
**What goes wrong:** Paint sidecar files get out of sync with .mce project file (orphaned files, missing data)
**Why it happens:** Project save writes .mce atomically but paint files are written separately
**How to avoid:** Write paint sidecar files BEFORE writing the .mce file during save. Track a dirty-frames set in paintStore. On load, only load frames that the paint layer references. Include cleanup logic for orphaned sidecar files on save.
**Warning signs:** Opening a project shows wrong paint data, or old strokes reappear after undo

### Pitfall 6: Layer Compositing Order
**What goes wrong:** Paint layer doesn't composite correctly with other layers (wrong order, missing blend modes)
**Why it happens:** Paint rendering bypasses the standard compositing pipeline
**How to avoid:** Paint layers must render through the SAME PreviewRenderer compositing loop as all other layers. Add a case in the `renderFrame()` method's layer loop, right alongside the existing generator/adjustment/content cases. The paint layer renders to the canvas context with proper `globalCompositeOperation` and `globalAlpha`.
**Warning signs:** Paint appears on top of everything regardless of layer order

### Pitfall 7: Project Format Backward Compatibility
**What goes wrong:** Older versions of the app can't open projects with paint layers
**Why it happens:** version bump to 13 with new layer type 'paint'
**How to avoid:** Use `serde(default)` on new Rust fields. The existing pattern (used by every version bump from v8 to v12) handles this gracefully. Old versions will simply ignore unknown layer types. The MceLayerSource already uses all-optional fields.
**Warning signs:** Opening project in older version crashes instead of gracefully skipping paint layers

### Pitfall 8: Memory from Per-Frame Stroke Data
**What goes wrong:** Loading a project with 500+ frames of paint data consumes excessive memory
**Why it happens:** All frames loaded eagerly into memory
**How to avoid:** Lazy-load paint frame data: only load frames near the current playhead position. During export, load frames sequentially and release after rendering. The paintStore should maintain a window of loaded frames (e.g., current +/- 30 frames for onion skinning), evicting distant frames from memory.
**Warning signs:** App memory grows linearly with total painted frames

## Code Examples

### Adding paint case to PreviewRenderer
```typescript
// In previewRenderer.ts renderFrame() method, inside the layer loop:
// Add after the existing content/generator/adjustment checks:

if (layer.type === 'paint') {
  const paintFrame = paintStore.getFrame(layer.id, frame);
  if (paintFrame && paintFrame.elements.length > 0) {
    ctx.save();
    ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
    ctx.globalAlpha = layer.opacity * sequenceOpacity;
    renderPaintFrame(ctx, paintFrame, logicalW, logicalH);
    ctx.restore();
  }
  continue;
}
```

### Paint layer source data in .mce format
```typescript
// types/project.ts -- MceLayerSource already uses optional fields
// No new fields needed on MceLayerSource. The layer_type = 'paint' is sufficient.
// Paint data lives in sidecar files, referenced by layer.id.

// The MceLayerSource 'type' field is already a string, so 'paint' passes through.
// The Rust MceLayerSource already has all fields as Option<T>, so no struct changes needed.
```

### Rendering a stroke with Path2D (Canvas 2D)
```typescript
import { getStroke } from 'perfect-freehand';

function strokeToPath(points: [number, number, number][], size: number): Path2D | null {
  const outline = getStroke(points, {
    size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,
    last: true,
  });

  if (outline.length < 2) return null;

  const path = new Path2D();
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    path.lineTo(outline[i][0], outline[i][1]);
  }
  path.closePath();
  return path;
}
```

### Iterative flood fill on ImageData
```typescript
function floodFill(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillColor: [number, number, number, number],
  tolerance: number = 10,
): void {
  const { data, width, height } = imageData;
  const idx = (startY * width + startX) * 4;
  const targetR = data[idx], targetG = data[idx+1], targetB = data[idx+2], targetA = data[idx+3];

  if (colorsMatch(fillColor, [targetR, targetG, targetB, targetA])) return;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startX, startY];

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const pos = y * width + x;

    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited[pos]) continue;

    const i = pos * 4;
    if (!withinTolerance(data[i], data[i+1], data[i+2], data[i+3],
                          targetR, targetG, targetB, targetA, tolerance)) continue;

    visited[pos] = 1;
    data[i] = fillColor[0];
    data[i+1] = fillColor[1];
    data[i+2] = fillColor[2];
    data[i+3] = fillColor[3];

    stack.push(x+1, y, x-1, y, x, y+1, x, y-1);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bitmap paint layers (pixel data per frame) | Vector paint layers (point arrays rendered at display time) | Always better for this use case | Resolution-independent, compact storage, editability |
| Canvas 2D `lineTo` with fixed width | perfect-freehand outline polygons | perfect-freehand v1 (2021) | Pressure-sensitive, variable-width, smooth strokes |
| Recursive flood fill | Iterative stack-based flood fill | Standard practice | Avoids stack overflow on large canvases |

## Integration Points Checklist

This is the complete set of files that need modification to add paint layer support:

### Type System
| File | Change |
|------|--------|
| `types/layer.ts` | Add `'paint'` to `LayerType` union, add paint variant to `LayerSourceData` |
| `types/paint.ts` | **NEW** -- PaintStroke, PaintShape, PaintFrame, PaintTool types |

### Stores
| File | Change |
|------|--------|
| `stores/paintStore.ts` | **NEW** -- paint mode state, active tool, brush settings, per-frame stroke data, undo integration |
| `stores/uiStore.ts` | Add paint mode awareness (optional, may not need changes if paintStore handles it) |

### Rendering
| File | Change |
|------|--------|
| `lib/previewRenderer.ts` | Add paint layer case in `renderFrame()` layer loop |
| `lib/exportRenderer.ts` | Paint rendering shared via `previewRenderer.ts` (same code path per existing architecture) |
| `lib/paintRenderer.ts` | **NEW** -- `renderPaintFrame()` function using perfect-freehand + Path2D |
| `lib/frameMap.ts` | Add paint layer color to `FX_TRACK_COLORS` record |

### Persistence
| File | Change |
|------|--------|
| `lib/paintPersistence.ts` | **NEW** -- sidecar file read/write via Tauri FS API |
| `stores/projectStore.ts` | Call paint sidecar save/load during `saveProject()` / `hydrateFromMce()` |
| `types/project.ts` | No structural changes needed (layer_type is already a string field) |

### Rust Backend
| File | Change |
|------|--------|
| `models/project.rs` | No changes needed -- MceLayerSource already uses all-optional fields, layer_type is a String |
| `services/project_io.rs` | Add `paint/` directory creation in `create_project_dir()` |

### UI Components
| File | Change |
|------|--------|
| `components/canvas/PaintOverlay.tsx` | **NEW** -- pointer event handler for paint mode |
| `components/canvas/TransformOverlay.tsx` | Skip rendering when paint mode active on paint layer |
| `components/layout/CanvasArea.tsx` | Add paint mode toggle button, conditionally render PaintOverlay |
| `components/sidebar/PaintProperties.tsx` | **NEW** -- full paint tool controls panel |
| `components/overlay/PaintToolbar.tsx` | **NEW** -- compact floating toolbar |
| `components/timeline/AddFxMenu.tsx` | Add paint layer option to the Layer menu |
| `lib/paintFloodFill.ts` | **NEW** -- iterative flood fill algorithm |

### Project Format
| File | Change |
|------|--------|
| `stores/projectStore.ts` | Bump version from 12 to 13 in `buildMceProject()` |

## Open Questions

1. **Export caching strategy for paint layers**
   - What we know: Each frame's paint strokes need to be rasterized during export. perfect-freehand + Path2D is fast for preview but export renders all frames sequentially.
   - What's unclear: Whether rasterizing 500+ frames of paint data causes export slowdown
   - Recommendation: Start without caching. If export is slow (>2x slower than non-paint exports), add an offscreen canvas cache that renders each paint frame once and reuses the bitmap. This is a discretion item.

2. **Flood fill approach**
   - What we know: Need to fill enclosed regions on the paint layer. Must work on the rasterized result of existing strokes.
   - What's unclear: Best resolution for flood fill computation vs visual quality
   - Recommendation: Rasterize current frame's strokes to an offscreen canvas at project resolution, get ImageData, run iterative stack-based flood fill, then store the fill as a special PaintElement (filled polygon or bitmap rect). Scanline is more efficient but harder to implement correctly. Start with iterative stack-based.

3. **Paint layer interaction with cross-dissolve**
   - What we know: Paint layers sit in the layer stack and composite normally
   - What's unclear: Should paint layers participate in cross-dissolve transitions between content sequences?
   - Recommendation: Yes -- paint layers added to a content sequence should dissolve with the rest of that sequence's layers. Paint layers added as FX sequences (content-overlay) would not dissolve. This falls out naturally from the existing compositing architecture.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.9+ |
| Config file | `Application/vitest.config.ts` |
| Quick run command | `cd Application && pnpm vitest run --reporter=verbose` |
| Full suite command | `cd Application && pnpm vitest run` |

### Phase Requirements to Test Map
Since this is a backlog phase (TBD requirements), tests should cover core behaviors:

| Behavior | Test Type | Automated Command |
|----------|-----------|-------------------|
| PaintStroke type creation and serialization | unit | `pnpm vitest run src/types/paint.test.ts -x` |
| paintStore stroke add/remove/frame management | unit | `pnpm vitest run src/stores/paintStore.test.ts -x` |
| Paint frame sidecar persistence round-trip | unit | `pnpm vitest run src/lib/paintPersistence.test.ts -x` |
| Flood fill correctness on simple ImageData | unit | `pnpm vitest run src/lib/paintFloodFill.test.ts -x` |
| Paint renderer stroke to Path2D conversion | unit | `pnpm vitest run src/lib/paintRenderer.test.ts -x` |

### Wave 0 Gaps
- [ ] `src/types/paint.test.ts` -- PaintStroke/PaintFrame type validation
- [ ] `src/stores/paintStore.test.ts` -- store operations
- [ ] `src/lib/paintPersistence.test.ts` -- sidecar file round-trip
- [ ] `src/lib/paintFloodFill.test.ts` -- flood fill algorithm
- [ ] `src/lib/paintRenderer.test.ts` -- stroke rendering logic

## Sources

### Primary (HIGH confidence)
- perfect-freehand GitHub README -- getStroke API, options, input/output format, v1.2.3 verified via npm registry
- Project codebase -- `types/layer.ts`, `types/sequence.ts`, `types/project.ts`, `lib/previewRenderer.ts`, `lib/exportRenderer.ts`, `stores/projectStore.ts`, `stores/sequenceStore.ts`, `stores/uiStore.ts`, `stores/canvasStore.ts`, `components/canvas/TransformOverlay.tsx`, `components/layout/CanvasArea.tsx`, `lib/history.ts`, `lib/frameMap.ts`, `src-tauri/src/models/project.rs`, `src-tauri/src/services/project_io.rs`
- npm registry -- `npm view perfect-freehand version` confirmed v1.2.3

### Secondary (MEDIUM confidence)
- [perfect-freehand GitHub](https://github.com/steveruizok/perfect-freehand) -- Path2D rendering approach from discussion #24
- [floodfill.js](https://github.com/binarymax/floodfill.js/) -- Uint8ClampedArray-based flood fill on ImageData
- [FloodFill2D](https://github.com/blindman67/FloodFill2D) -- Canvas 2D context-aware flood fill with composite ops

### Tertiary (LOW confidence)
- Web search for onion skinning implementation patterns -- all sources agree on opacity-falloff approach for previous/next frames

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- perfect-freehand is the locked decision, version verified against npm, API documented
- Architecture: HIGH -- follows established patterns in this exact codebase (LayerType union, PreviewRenderer switch, sidecar pattern from audio)
- Pitfalls: HIGH -- derived from deep analysis of existing codebase (coordinate mapping, event routing, compositing pipeline, undo system)
- Persistence: HIGH -- sidecar pattern proven by audio tracks, Rust backend already handles all-optional source fields
- UI integration: HIGH -- existing patterns for properties panels, toolbar buttons, layer menus thoroughly analyzed

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain, no breaking changes expected)
