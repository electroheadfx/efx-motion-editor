# Phase 6: Layer System & Properties Panel - Research

**Researched:** 2026-03-03
**Domain:** Canvas 2D compositing, layer management, UI properties panel
**Confidence:** HIGH

## Summary

Phase 6 transforms the existing single-image preview into a multi-layer compositing system with real-time Canvas 2D rendering. The current codebase already has foundational infrastructure: `types/layer.ts` defines Layer/LayerTransform/BlendMode types, `layerStore.ts` provides a basic signal store with add/remove/reorder/update operations, and `uiStore.ts` tracks `selectedLayerId`. The Preview component currently renders a single `<img>` element from the frame map -- this needs to be replaced with a `<canvas>` element that composites all visible layers bottom-to-top using `globalCompositeOperation` for blend modes and `globalAlpha` for opacity.

The three layer types (static image, image sequence, video) each have distinct source-frame resolution patterns: static images show the same content on every frame, image sequences sync frame-by-frame with the playhead, and video layers use an `<HTMLVideoElement>` with `requestVideoFrameCallback()` for frame-accurate sync. All three source types can be drawn to canvas via `drawImage()`, which accepts HTMLImageElement, HTMLCanvasElement, and HTMLVideoElement. Canvas 2D natively supports all five required blend modes (`normal`=`source-over`, `screen`, `multiply`, `overlay`, `add`=`lighter`) via `globalCompositeOperation`, and transforms (translate, rotate, scale) via `ctx.save()/translate()/rotate()/scale()/restore()`. Cropping is handled by the 9-argument `drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)` overload.

The Properties Panel currently shows hardcoded mockup values. It needs to become a reactive, context-sensitive panel that reads from `layerStore.layers` and `uiStore.selectedLayerId`, and writes layer property changes back through `layerStore.updateLayer()` with undo/redo integration via the existing `pushAction()` history engine. The `.mce` project file format needs a `layers` array added to `MceSequence` for persistence, with corresponding Rust model updates.

**Primary recommendation:** Build the compositing renderer as a standalone `PreviewRenderer` class that takes a `<canvas>` element and composites layers each frame using Canvas 2D context operations. Keep the renderer decoupled from UI components so it can be reused by Phase 10 (export) at arbitrary resolutions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | Browser native | Layer compositing, blend modes, transforms | Zero dependencies; `globalCompositeOperation` natively supports all 5 required blend modes; `drawImage` accepts img/video/canvas sources |
| @preact/signals | ^2.8.1 | Reactive state for layer store and properties panel | Already used by all 6 stores; signal subscriptions trigger re-render on layer changes |
| SortableJS | ^1.15.7 | Drag-and-drop layer reordering | Already used for sequence and key photo reordering; same pattern applies to layer list |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tinykeys | ^3.0.0 | Keyboard shortcuts for layer operations (Delete) | Already wired in shortcuts.ts; extend for layer-specific shortcuts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Canvas 2D | WebGL (via Motion Canvas) | WebGL is faster for complex shaders but Canvas 2D is simpler, sufficient for 5 blend modes at 1080p, and avoids Motion Canvas generator model complexity. The roadmap decision (STATE.md) already chose Canvas 2D over Motion Canvas for compositing. |
| Canvas 2D | OffscreenCanvas in worker | Better for heavy compositing; adds complexity. Not needed at 5-10 layers with Canvas 2D. Can be added in optimization pass if needed. |
| Manual canvas compositing | Konva.js / Fabric.js | These libraries add ~100-300KB and impose their own scene graph. Overkill when we only need `drawImage` + `globalCompositeOperation` + transforms. |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── types/
│   └── layer.ts               # Layer, LayerTransform, BlendMode (EXISTS -- extend with source data)
├── stores/
│   └── layerStore.ts           # Signal store for layers (EXISTS -- extend with undo/redo, per-sequence layers)
├── lib/
│   └── previewRenderer.ts      # NEW: Canvas 2D compositing engine (decoupled from UI)
├── components/
│   ├── Preview.tsx              # EXISTS -- replace <img> with <canvas>, wire PreviewRenderer
│   ├── layout/
│   │   ├── PropertiesPanel.tsx  # EXISTS -- replace mockup with reactive controls
│   │   └── LeftPanel.tsx        # EXISTS -- replace mock layer list with real LayerList
│   └── layer/
│       ├── LayerList.tsx        # NEW: SortableJS-powered layer list with drag handle
│       └── AddLayerMenu.tsx     # NEW: Popover for adding static-image/image-sequence/video layers
```

### Pattern 1: Canvas 2D Layer Compositing Loop
**What:** Bottom-to-top rendering of visible layers with per-layer blend mode, opacity, and transform
**When to use:** Every frame render (on playhead change or playback tick)
**Example:**
```typescript
// Source: MDN Canvas API docs (globalCompositeOperation, globalAlpha, drawImage)
function renderFrame(
  ctx: CanvasRenderingContext2D,
  layers: Layer[],
  frame: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Render bottom-to-top (layers[0] = bottom, layers[n-1] = top)
  for (const layer of layers) {
    if (!layer.visible) continue;

    const source = getLayerSource(layer, frame); // HTMLImageElement | HTMLVideoElement | null
    if (!source) continue;

    ctx.save();

    // Blend mode mapping
    const blendOp = blendModeToCompositeOp(layer.blendMode);
    ctx.globalCompositeOperation = blendOp;
    ctx.globalAlpha = layer.opacity;

    // Transform: translate to position, then rotate around center, then scale
    const { x, y, scale, rotation } = layer.transform;
    ctx.translate(x + canvasWidth / 2, y + canvasHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);

    // Draw with crop (9-arg drawImage for source rectangle)
    const { cropTop, cropRight, cropBottom, cropLeft } = layer.transform;
    const sw = source.width ?? (source as HTMLVideoElement).videoWidth;
    const sh = source.height ?? (source as HTMLVideoElement).videoHeight;
    const sx = cropLeft * sw;
    const sy = cropTop * sh;
    const sWidth = sw * (1 - cropLeft - cropRight);
    const sHeight = sh * (1 - cropTop - cropBottom);
    const dw = canvasWidth;
    const dh = canvasHeight;

    ctx.drawImage(source, sx, sy, sWidth, sHeight, -dw / 2, -dh / 2, dw, dh);

    ctx.restore();
  }
}

function blendModeToCompositeOp(mode: BlendMode): GlobalCompositeOperation {
  switch (mode) {
    case 'normal': return 'source-over';
    case 'screen': return 'screen';
    case 'multiply': return 'multiply';
    case 'overlay': return 'overlay';
    case 'add': return 'lighter';
  }
}
```

### Pattern 2: Layer Source Resolution by Type
**What:** Each layer type resolves its visual source differently per frame
**When to use:** When the compositing loop needs to get the drawable source for a layer
**Example:**
```typescript
// Base layer (image-sequence): resolves via frameMap
// Static image: same HTMLImageElement every frame
// Video layer: HTMLVideoElement with currentTime set from frame number

interface LayerSourceData {
  type: 'static-image';
  imageId: string;        // references imageStore entry
  element?: HTMLImageElement;  // cached decoded element
}

interface ImageSequenceSourceData {
  type: 'image-sequence';
  // Uses the existing frameMap + imageStore pipeline (base layer uses this)
}

interface VideoSourceData {
  type: 'video';
  videoPath: string;      // absolute path to video file in project
  element?: HTMLVideoElement;  // managed <video> element (hidden)
}
```

### Pattern 3: Properties Panel with Undo-Integrated Updates
**What:** Properties panel controls write through layerStore with snapshot/restore for undo
**When to use:** Any layer property change (opacity slider, blend mode dropdown, transform inputs)
**Example:**
```typescript
// Extend layerStore with undo-enabled update methods
function updateLayerProperty(
  layerId: string,
  updates: Partial<Layer>,
  description: string,
) {
  const before = snapshotLayers();
  layerStore.updateLayer(layerId, updates);
  markDirty();
  const after = snapshotLayers();
  pushAction({
    id: crypto.randomUUID(),
    description,
    timestamp: Date.now(),
    undo: () => restoreLayers(before),
    redo: () => restoreLayers(after),
  });
}

// For continuous controls (opacity slider), use coalescing:
// startCoalescing() on pointerdown, stopCoalescing() on pointerup
```

### Pattern 4: Per-Sequence Layer Storage
**What:** Layers belong to sequences, not globally. The base layer is auto-generated and non-deletable.
**When to use:** When switching sequences, the layer list must update to show that sequence's layers.
**Example:**
```typescript
// Extend Sequence type to include layers
interface Sequence {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  keyPhotos: KeyPhoto[];
  layers: Layer[];  // NEW -- ordered bottom-to-top
}

// Base layer is always layers[0], auto-created, type 'image-sequence', non-deletable
// UI must prevent deletion of layers[0] and prevent reordering it away from index 0
```

### Anti-Patterns to Avoid
- **Storing layers globally instead of per-sequence:** Each sequence has its own layer stack. The current `layerStore` has a single flat `layers` signal -- this must be refactored to per-sequence storage (either embedded in Sequence or keyed by sequenceId).
- **Recreating video elements every frame:** Video `<HTMLVideoElement>` elements must be created once per video layer and reused. Creating/destroying them per frame causes massive memory pressure and GC pauses.
- **Rendering layers top-to-bottom:** Canvas 2D paints on top of existing content. Layers must be drawn bottom-to-top (index 0 first, highest index last).
- **Using `source-over` for all blend modes:** Each layer has its own blend mode. `globalCompositeOperation` must be set *before* each `drawImage` call within the render loop, and reset via `ctx.save()`/`ctx.restore()`.
- **Mutating canvas transform state without save/restore:** Always wrap transform operations in `ctx.save()` / `ctx.restore()` to prevent transform accumulation.
- **Blocking the main thread with large image decodes:** Use `createImageBitmap()` for async image decoding when loading new layer sources, instead of synchronous `Image()` constructor pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop list reordering | Custom drag implementation | SortableJS (already a dependency) | Touch support, animation, edge cases (scroll during drag, multi-list) |
| Blend mode compositing | Manual pixel-by-pixel blending | Canvas 2D `globalCompositeOperation` | Browser-native, GPU-accelerated, correct color space handling |
| Video frame sync | Manual `currentTime` polling | `requestVideoFrameCallback()` + `drawImage(videoEl)` | Browser-optimized, compositor-thread sync, avoids drift |
| Layer transform math | Custom matrix multiplication | Canvas 2D `translate()`/`rotate()`/`scale()` | Browser-native matrix stack, hardware-accelerated |
| Unique ID generation | Custom counter or timestamp | `crypto.randomUUID()` | Already used throughout codebase (sequenceStore, history), collision-free |
| Reactive form controls | Manual DOM event → state sync | Preact signals + controlled inputs | Already the pattern in SequenceSettings component |

**Key insight:** Canvas 2D provides everything needed for the compositing pipeline at this scale (5-10 layers at 1080p). The blend modes, transforms, opacity, and clipping are all first-class browser APIs with GPU acceleration. There is no need for WebGL or custom pixel manipulation.

## Common Pitfalls

### Pitfall 1: CSP Blocks Video/Media Sources
**What goes wrong:** Adding video layers via `<video>` element with `convertFileSrc()` fails because the Content Security Policy doesn't include `media-src asset: http://asset.localhost`.
**Why it happens:** The current CSP in `tauri.conf.json` has `img-src` but no `media-src` directive. Without it, `<video src="asset://...">` is blocked.
**How to avoid:** Add `media-src 'self' asset: http://asset.localhost` to the CSP string in `tauri.conf.json`.
**Warning signs:** Video layer shows no content; browser console shows CSP violation errors.

### Pitfall 2: Layer Store Not Per-Sequence
**What goes wrong:** Switching sequences shows layers from the previous sequence, or layers are lost.
**Why it happens:** The current `layerStore` stores a single flat `layers` array, not per-sequence.
**How to avoid:** Store layers as part of each `Sequence` object (in `sequenceStore`), or key layers by `sequenceId` in layerStore. When `activeSequenceId` changes, the displayed layers must switch accordingly.
**Warning signs:** Layer list doesn't change when switching sequences.

### Pitfall 3: Undo/Redo Not Wired for Layer Operations
**What goes wrong:** User changes layer opacity or reorders layers, but Cmd+Z doesn't undo it.
**Why it happens:** Current `layerStore` methods (add, remove, updateLayer, reorder) don't call `pushAction()`.
**How to avoid:** Every user-initiated mutation must capture before/after snapshots and push an undo action, following the exact pattern in `sequenceStore.ts`. Use `startCoalescing()`/`stopCoalescing()` for continuous controls (opacity slider, position drag).
**Warning signs:** History stack doesn't grow when editing layers.

### Pitfall 4: Video Element Memory Leaks
**What goes wrong:** Memory grows unbounded when adding/removing video layers.
**Why it happens:** `<video>` elements not properly cleaned up: `src` not set to empty string, event listeners not removed, element not removed from DOM.
**How to avoid:** When removing a video layer: pause the video, set `src = ''`, call `load()` to release media resources, remove from hidden container. Track all video elements in a Map keyed by layer ID.
**Warning signs:** Memory usage in Activity Monitor grows steadily.

### Pitfall 5: Base Layer Deletion or Reorder
**What goes wrong:** User deletes the base key photo layer or reorders it above other layers, breaking the compositing assumption.
**Why it happens:** UI doesn't enforce the constraint that the base layer is always at index 0 and non-deletable.
**How to avoid:** Mark the base layer with a `isBase: true` flag (or detect by position/type). Disable delete button for base layer. In SortableJS `onMove` callback, return `false` if the moved item is the base layer or if the drop target would place a non-base layer below the base.
**Warning signs:** Layer list allows base layer deletion; preview goes black.

### Pitfall 6: Transform Origin Mismatch
**What goes wrong:** Rotation and scale appear to pivot around the wrong point (e.g., top-left corner instead of center).
**Why it happens:** Canvas transform operations apply relative to current origin. If you `rotate()` before `translate()`, the rotation center is the canvas origin (0,0), not the layer center.
**How to avoid:** Always translate to the desired center point FIRST, then rotate, then scale, then draw the image centered (offset by -width/2, -height/2).
**Warning signs:** Layers spin around the top-left corner when rotation is applied.

### Pitfall 7: Project File Format Migration
**What goes wrong:** Opening a v1 `.mce` file (which has no `layers` array in sequences) crashes or loses data.
**Why it happens:** The Rust deserializer expects `layers` field in `MceSequence` but old files don't have it.
**How to avoid:** Make the `layers` field optional in Rust (`Option<Vec<MceLayer>>` or `#[serde(default)]`). When loading a project without layers, auto-generate the base layer. Increment `MceProject.version` to 2.
**Warning signs:** Old projects fail to open after Phase 6 deployment.

## Code Examples

Verified patterns from official sources and existing codebase:

### Canvas 2D Compositing with Blend Modes
```typescript
// Source: MDN globalCompositeOperation, globalAlpha
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation

const canvas = document.createElement('canvas');
canvas.width = 1920;
canvas.height = 1080;
const ctx = canvas.getContext('2d')!;

// Draw base layer (normal blend)
ctx.globalCompositeOperation = 'source-over';
ctx.globalAlpha = 1.0;
ctx.drawImage(baseImage, 0, 0, 1920, 1080);

// Draw overlay layer (screen blend at 80% opacity)
ctx.globalCompositeOperation = 'screen';
ctx.globalAlpha = 0.8;
ctx.drawImage(overlayImage, 0, 0, 1920, 1080);

// Reset
ctx.globalCompositeOperation = 'source-over';
ctx.globalAlpha = 1.0;
```

### Canvas 2D Transform for Layer Position/Rotation/Scale
```typescript
// Source: MDN Transformations tutorial
// https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Transformations

function drawTransformedLayer(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  scale: number,
  rotationDeg: number,
  drawWidth: number,
  drawHeight: number,
) {
  ctx.save();
  ctx.translate(x, y);  // move to layer position
  ctx.rotate((rotationDeg * Math.PI) / 180);  // rotate around position
  ctx.scale(scale, scale);  // scale from position
  ctx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}
```

### Canvas 2D Crop via drawImage 9-arg
```typescript
// Source: MDN drawImage()
// https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage

// drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
// sx, sy = source crop start; sWidth, sHeight = source crop size
// dx, dy = dest position; dWidth, dHeight = dest draw size

function drawCroppedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cropTop: number,   // 0-1 fraction
  cropRight: number,
  cropBottom: number,
  cropLeft: number,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
) {
  const sx = cropLeft * img.naturalWidth;
  const sy = cropTop * img.naturalHeight;
  const sw = img.naturalWidth * (1 - cropLeft - cropRight);
  const sh = img.naturalHeight * (1 - cropTop - cropBottom);
  ctx.drawImage(img, sx, sy, sw, sh, destX, destY, destW, destH);
}
```

### SortableJS Layer Reorder with Base Layer Protection
```typescript
// Source: SortableJS README -- onMove callback, handle option
// Pattern already used in SequenceList.tsx and KeyPhotoStrip.tsx

import Sortable from 'sortablejs';

function initLayerSortable(container: HTMLElement, onReorder: (oldIdx: number, newIdx: number) => void) {
  return new Sortable(container, {
    animation: 150,
    handle: '.layer-drag-handle',
    filter: '.layer-base',  // Prevent dragging the base layer
    onMove(evt) {
      // Prevent dropping above the base layer (always at bottom = last DOM child)
      // In our layer list, top layer = first child, base layer = last child
      if (evt.related.classList.contains('layer-base')) {
        return false;  // Cancel drop onto base layer position
      }
      return true;
    },
    onEnd(evt) {
      if (evt.oldIndex != null && evt.newIndex != null && evt.oldIndex !== evt.newIndex) {
        onReorder(evt.oldIndex, evt.newIndex);
      }
    },
  });
}
```

### Video Layer with requestVideoFrameCallback
```typescript
// Source: MDN requestVideoFrameCallback
// https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback

function createVideoLayerElement(videoPath: string): HTMLVideoElement {
  const video = document.createElement('video');
  video.src = assetUrl(videoPath);  // Tauri asset protocol
  video.muted = true;              // No audio from overlay video
  video.playsInline = true;
  video.preload = 'auto';
  video.style.display = 'none';    // Hidden -- only drawn to canvas
  document.body.appendChild(video); // Must be in DOM for decode
  return video;
}

// Sync video to sequence playhead
function seekVideoToFrame(video: HTMLVideoElement, frame: number, fps: number) {
  const targetTime = frame / fps;
  if (Math.abs(video.currentTime - targetTime) > 0.02) {
    video.currentTime = targetTime;
  }
}
```

### Reactive Properties Panel (Preact + Signals)
```typescript
// Pattern from existing SequenceSettings in LeftPanel.tsx
// Uses layerStore signals for reactive updates

function OpacitySlider({ layer }: { layer: Layer }) {
  return (
    <div class="flex items-center gap-2">
      <span class="text-[10px] text-[var(--color-text-muted)]">Opacity</span>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(layer.opacity * 100)}
        onPointerDown={() => startCoalescing()}
        onPointerUp={() => stopCoalescing()}
        onInput={(e) => {
          const val = parseInt((e.target as HTMLInputElement).value) / 100;
          updateLayerProperty(layer.id, { opacity: val }, 'Change opacity');
        }}
        class="w-20"
      />
      <span class="text-[11px] text-[#CCCCCC]">
        {Math.round(layer.opacity * 100)}%
      </span>
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Motion Canvas generator model for compositing | Canvas 2D direct rendering | Decision in v2.0 roadmap (STATE.md) | Simpler architecture; no scene generator lifecycle; direct `drawImage` calls |
| img element for preview | Canvas element for compositing | Phase 6 (this phase) | Enables multi-layer compositing, blend modes, transforms |
| Global layer store | Per-sequence layer storage | Phase 6 (this phase) | Layers travel with their sequence; switching sequences shows correct layers |
| Mock layer data in LeftPanel | Real layer CRUD with undo | Phase 6 (this phase) | Remove `useSeedLayerMockData()` hook; replace with actual layer operations |

**Deprecated/outdated:**
- `useSeedLayerMockData()` in LeftPanel.tsx: Mock data seeding will be removed and replaced with real layer management
- Motion Canvas `<motion-canvas-player>` for preview rendering: Will be kept in DOM but fully hidden; Canvas 2D takes over visual rendering
- Single `<img>` element in Preview.tsx: Replaced by `<canvas>` with multi-layer compositing

## Open Questions

1. **Video file import workflow**
   - What we know: Images are imported via Rust backend (copy + thumbnail + metadata). Video files need a similar pipeline but don't need thumbnailing the same way.
   - What's unclear: Should video files be copied into the project `images/` directory, or a separate `videos/` directory? Should we extract a poster frame for the layer thumbnail?
   - Recommendation: Create a `videos/` subdirectory in the project. Copy video files there on import. Extract first frame as thumbnail via `<video>` + `<canvas>` capture on the frontend (no Rust video decode dependency needed). This keeps the Rust backend simple.

2. **Image sequence layer source**
   - What we know: The base layer uses the existing `frameMap` + `imageStore` pipeline. An "image sequence layer" is a separate set of images that overlay frame-by-frame.
   - What's unclear: How does the user specify which images belong to the image sequence layer? Is it a folder import? Individual file selection?
   - Recommendation: For Phase 6, implement image sequence layers as a folder of numbered images (e.g., `overlay_0001.png`, `overlay_0002.png`). Import the folder, sort by filename, map frame-by-frame. This is the standard VFX pipeline convention.

3. **Canvas resolution vs display size**
   - What we know: The preview area is max 830px wide (aspect-ratio constrained). The sequence resolution may be 1920x1080 or 3840x2160.
   - What's unclear: Should the compositing canvas render at full sequence resolution or display resolution?
   - Recommendation: Render at display resolution for preview (performance). Phase 10 (export) renders at full sequence resolution. The `PreviewRenderer` should accept target width/height as parameters so the same compositing code works at both resolutions.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LAYER-01 | User can add a static image layer to a sequence | Canvas 2D `drawImage()` with HTMLImageElement; extend Layer type with source data; import via existing imageStore pipeline |
| LAYER-02 | User can add an image sequence layer (frame-synced overlay) | Frame-synced source resolution using frame number; folder import of numbered image files; `drawImage()` with per-frame HTMLImageElement |
| LAYER-03 | User can add a video layer (plays in sync with sequence playhead) | Hidden `<video>` element + `seekVideoToFrame()`; `drawImage(videoElement)` in compositing loop; CSP `media-src` fix required |
| LAYER-04 | User can set blend mode per layer (normal, screen, multiply, overlay, add) | `globalCompositeOperation` mapping: normal=source-over, screen, multiply, overlay, add=lighter |
| LAYER-05 | User can adjust layer opacity from 0% to 100% | `ctx.globalAlpha` set per layer in compositing loop; opacity slider with coalescing for undo |
| LAYER-06 | User can toggle layer visibility on/off | Skip layer in compositing loop when `visible === false`; toggle button in layer list |
| LAYER-07 | User can reorder layers via drag-and-drop | SortableJS with handle, filter for base layer protection, onEnd callback to layerStore.reorder() with undo |
| LAYER-08 | User can delete a layer from a sequence | layerStore.remove() with undo snapshot; disabled for base layer (LAYER-14) |
| LAYER-09 | User can set layer position (x, y offset) | `ctx.translate(x, y)` in compositing loop; position inputs in properties panel |
| LAYER-10 | User can set layer scale | `ctx.scale(s, s)` in compositing loop; scale input in properties panel |
| LAYER-11 | User can set layer rotation | `ctx.rotate(rad)` in compositing loop; rotation input in properties panel (degrees) |
| LAYER-12 | User can crop a layer | 9-arg `drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)` with crop fractions; crop inputs in properties panel |
| LAYER-13 | Preview canvas renders all visible layers composited with correct blend modes and opacity in real-time | PreviewRenderer class with bottom-to-top compositing loop; `<canvas>` element replaces `<img>` in Preview.tsx; re-render on frame change or layer property change |
| LAYER-14 | Base key photo sequence is always the bottom layer (auto-generated, not deletable) | layers[0] is auto-created with type 'image-sequence' referencing the sequence's keyPhotos; SortableJS filter prevents drag; delete button disabled for base |
| PROP-01 | Properties panel shows controls for the currently selected layer | Read from `uiStore.selectedLayerId` + `layerStore` to get selected layer; conditional rendering of controls |
| PROP-02 | Properties panel shows blend mode dropdown, opacity slider, and visibility toggle | `<select>` for blend modes, `<input type="range">` for opacity, toggle button for visibility; all write through undo-enabled layerStore methods |
| PROP-03 | Properties panel shows transform controls (position, scale, rotation, crop) | Numeric inputs for x, y, scale, rotation; crop fraction inputs (0-1); all write through undo-enabled layerStore methods with coalescing |
| PROP-04 | Properties panel shows effect-specific parameters when an FX layer is selected | Stub for Phase 7 -- detect layer type, show placeholder "FX parameters available in Phase 7" for video/fx layers; show source info for static-image and image-sequence layers |
</phase_requirements>

## Sources

### Primary (HIGH confidence)
- [MDN globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) - blend mode support, all 5 required modes confirmed native
- [MDN drawImage](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage) - 9-arg crop, HTMLImageElement/HTMLVideoElement/HTMLCanvasElement support
- [MDN Canvas Transformations](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Transformations) - save/restore, translate, rotate, scale
- [MDN requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback) - frame-accurate video sync
- [MDN Optimizing Canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) - offscreen canvas, integer coordinates, layer caching
- [SortableJS README (Context7)](/sortablejs/sortable) - configuration, events, handle, filter, onMove
- Existing codebase: types/layer.ts, stores/layerStore.ts, stores/sequenceStore.ts, Preview.tsx, LeftPanel.tsx

### Secondary (MEDIUM confidence)
- [web.dev requestVideoFrameCallback](https://web.dev/articles/requestvideoframecallback-rvfc) - frame sync patterns, best-effort nature
- [web.dev OffscreenCanvas](https://web.dev/articles/offscreen-canvas) - worker-thread rendering optimization (not needed now, available for future)
- [Tauri asset protocol discussions](https://github.com/orgs/tauri-apps/discussions/11498) - convertFileSrc for video, CSP requirements

### Tertiary (LOW confidence)
- Video file handling in Tauri 2 -- confirmed `convertFileSrc` works for video `<src>`, but `media-src` CSP directive needs validation in actual Tauri 2 builds

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Canvas 2D API is stable browser standard; all required blend modes confirmed via MDN; existing dependencies sufficient
- Architecture: HIGH - Compositing pattern (save/transform/drawImage/restore loop) is well-documented; per-sequence layer model follows existing sequence architecture
- Pitfalls: HIGH - CSP issue verified via code inspection; format migration pattern established; base layer protection is straightforward SortableJS configuration
- Properties Panel: HIGH - Follows exact same reactive Preact + Signals pattern already used in SequenceSettings

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable browser APIs, no moving targets)
