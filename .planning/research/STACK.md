# Stack Research

**Domain:** Desktop stop-motion cinematic editor (macOS) -- v0.6.0 Various Enhancements
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

v0.6.0 is an enhancement milestone -- nine features spanning compositing, textures, stroke management, and UX improvements. The existing stack (Tauri 2.0, Preact, Canvas 2D, WebGL2, p5.brush, perfect-freehand, SortableJS) covers most needs. Only **one new dependency** is recommended: `bezier-js` for the bezier/spline stroke path editing feature. All other features are achievable with existing dependencies plus custom code, which is the correct approach for a desktop editor where bundle size and control matter.

## What the Existing Stack Already Covers

Before listing additions, it is critical to enumerate what NOT to add because the existing stack handles it:

| Feature | Covered By | How |
|---------|-----------|-----|
| Luma matte compositing | Canvas 2D API | `getImageData` + per-pixel luminance-to-alpha conversion, no library needed |
| Paper texture tiling | Canvas 2D `createPattern()` + `@tauri-apps/plugin-fs` | Load image from disk via `readFile`, create `ImageBitmap`, tile with `ctx.createPattern()` |
| Paper texture loading from `~/.config/` | `@tauri-apps/plugin-fs` + `assetUrl()` | `readDir` to list papers, `assetUrl()` for `<img>` src, or `readFile` for raw bytes |
| Duplicate stroke (Alt+move) | `paintStore` + `crypto.randomUUID()` | Clone `PaintElement`, assign new ID, offset points -- pure data operation |
| Non-uniform scale | Canvas 2D `ctx.scale(sx, sy)` + point math | Apply non-uniform scale around centroid to stroke points before rendering |
| Paint properties cleanup | Existing Tailwind v4 + Preact components | Pure UI refactor, no new libraries |
| Sequence-scoped layers | `sequenceStore` + `layerStore` | Logic-only change to `addLayer` flow, check `isolationStore.activeSequenceId` |
| Denser motion path dots | `interpolateAt()` from `keyframeEngine` | Sub-frame interpolation (0.5-frame steps) in `sampleMotionDots()` |
| Stroke list panel (DnD reorder) | SortableJS ^1.15.7 (already installed) | Same pattern as `LayerList.tsx` -- `forceFallback: true`, Preact DOM revert |

## Recommended Stack Addition

### New Dependency: bezier-js

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| bezier-js | ^6.1.4 | Cubic/quadratic bezier math for stroke path editing | De facto standard for JS bezier computation. Provides `split()`, `project()` (nearest point), `normal()`, `derivative()`, `getLUT()`, `bbox()`, `intersects()` -- all needed for interactive spline editing. Writing this from scratch would be 500+ lines of finicky math that Pomax has maintained for 10+ years with 354+ commits. ESM, tree-shakeable, zero dependencies. |

### Why bezier-js over alternatives

| Alternative | Why Not |
|-------------|---------|
| Custom cubic bezier math | Bezier math is notoriously subtle (de Casteljau subdivision, root finding for nearest-point projection, arc-length parameterization). bezier-js handles edge cases that custom code misses. The interactive editing feature needs `project()` (nearest point on curve to mouse), `split()` (insert control point), `normal()` (for handle visualization), and `getLUT()` (for rendering). Reimplementing correctly is not worth the time. |
| p5.bezier | Designed for p5.js ecosystem, not standalone. Adds p5 dependency overhead. bezier-js is framework-agnostic. |
| Paper.js curves | Massive library (200KB+). Overkill -- we only need the math primitives, not a full vector graphics framework. |
| Canvas native `bezierCurveTo()` only | Good for rendering, but provides zero computation utilities. Cannot find nearest point, split curves, compute normals, or do hit testing. |
| bezier-easing | Only handles 1D easing curves, not 2D path editing. |

### How bezier-js Integrates

The stroke path editing feature converts a freehand `PaintStroke.points` array into a sequence of cubic bezier segments. bezier-js handles:

1. **Fitting**: Convert sampled points to bezier control points (use `new Bezier(p1, c1, c2, p2)` per segment)
2. **Hit testing**: `curve.project(mousePoint)` returns nearest point on curve + parameter `t`
3. **Splitting**: `curve.split(t)` subdivides at a click point for inserting new control points
4. **Rendering**: `curve.getLUT(steps)` generates points for Canvas 2D `bezierCurveTo()` preview
5. **Bounding box**: `curve.bbox()` for efficient spatial queries during editing

The control point drag interaction is pure pointer event math (already proven in motion path dragging) -- bezier-js provides the curve math underneath.

## Installation

```bash
# New dependency (v0.6.0)
cd Application && pnpm add bezier-js

# TypeScript types
pnpm add -D @types/bezier-js
```

No other `pnpm add` needed. All other v0.6.0 features use existing dependencies.

## Integration Patterns by Feature

### 1. Luma Matte Compositing (Canvas 2D pixel manipulation)

**No new dependency.** Use `getImageData`/`putImageData` for luminance extraction.

The paint layer currently renders to an offscreen canvas with a solid background (`renderPaintFrameWithBg`). For luma matte compositing:

```typescript
// Extract luminance from paint layer and write to alpha channel
const imageData = offCtx.getImageData(0, 0, w, h);
const d = imageData.data;
for (let i = 0; i < d.length; i += 4) {
  // ITU-R BT.709 luminance coefficients
  const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  d[i + 3] = luma; // luminance -> alpha
}
offCtx.putImageData(imageData, 0, 0);

// Then composite paint over photo using source-in or destination-in
ctx.globalCompositeOperation = 'destination-in';
ctx.drawImage(offCanvas, 0, 0);
```

**Performance note**: `getImageData`/`putImageData` is O(width * height) per frame. At 1920x1080, this is ~8M pixel ops. For preview playback at 15/24fps, this is fine on M-series Macs. If it proves too slow, the fallback is a WebGL2 shader (same pattern as `glBlur.ts`), but start with Canvas 2D -- it's simpler and the existing pipeline already does per-frame pixel work (flood fill in `paintRenderer.ts`).

### 2. Paper/Canvas Texture (Canvas 2D pattern + Tauri FS)

**No new dependency.** Use existing `@tauri-apps/plugin-fs` + Canvas 2D `createPattern()`.

Loading flow:
1. Use `readDir('~/.config/efx-motion/papers/')` to list available paper textures (already using `readDir` in `paintPersistence.ts`)
2. Use `assetUrl(filePath)` to generate a protocol URL for `<img>` loading (existing pattern in `ipc.ts`)
3. Create `ctx.createPattern(img, 'repeat')` for tiling

Texture application options (from simplest to richest):
- **Canvas 2D overlay**: After painting strokes, apply paper texture via `ctx.globalCompositeOperation = 'multiply'` with a tiled pattern fill. This preserves the existing p5.brush WebGL2 rendering and just adds a post-process step.
- **WebGL2 shader**: If Canvas 2D multiply looks flat, write a GLSL paper texture shader (same pattern as `glBlur.ts`) that takes the paint canvas + texture as two inputs and composites with configurable blend/intensity.

Recommendation: Start with Canvas 2D multiply overlay. The existing `renderPaintFrameWithBg` already returns a composited canvas -- add texture as a final pass before returning to `PreviewRenderer`.

The Tauri asset protocol scope (`$HOME/**` in `tauri.conf.json`) already covers `~/.config/efx-motion/papers/*`. No config changes needed.

### 3. Bezier/Spline Stroke Path Editing (bezier-js)

**New dependency: `bezier-js ^6.1.4`.**

The stroke path editor converts `PaintStroke.points` (sampled `[x, y, pressure][]`) into editable cubic bezier segments. This is a new UI mode within roto paint edit mode.

Data model extension on `PaintStroke`:
```typescript
interface BezierSegment {
  p1: [number, number];  // start anchor
  c1: [number, number];  // control point 1
  c2: [number, number];  // control point 2
  p2: [number, number];  // end anchor
}

// Add to PaintStroke:
bezierPath?: BezierSegment[];  // null = use points[], set = use bezier path
```

When the user enters bezier edit mode on a stroke, the raw points are fitted to bezier segments (cubic spline fitting). The fitted `BezierSegment[]` is stored on the stroke and used for rendering instead of the raw `points` array.

bezier-js provides the math; Canvas 2D provides the rendering via `bezierCurveTo()`; pointer event handling reuses the same pattern as motion path keyframe dragging in `TransformOverlay.tsx`.

### 4. Non-Uniform Scale for Strokes (Canvas 2D transform math)

**No new dependency.** Pure math on `PaintStroke.points`.

Non-uniform scale requires:
1. Compute centroid of selected stroke(s) from points
2. Apply `scale(sx, sy)` relative to centroid: `newX = cx + (x - cx) * sx`, `newY = cy + (y - cy) * sy`
3. Update `PaintStroke.points` in-place (or store transform separately)

Two approaches:
- **Destructive**: Modify points directly. Simpler, matches existing stroke mutation pattern.
- **Non-destructive**: Store `scaleX`, `scaleY` on stroke, apply at render time via `ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, sy); ctx.translate(-cx, -cy);`.

Recommendation: Non-destructive via stored `scaleX`/`scaleY` on `PaintStroke`. This preserves original points for undo/redo and allows resetting scale. Add `transform?: { scaleX: number; scaleY: number; }` to `PaintStroke`.

### 5. Stroke List Panel (SortableJS -- already installed)

**No new dependency.** SortableJS ^1.15.7 is already in `package.json`.

Follow the exact pattern from `LayerList.tsx`:
- `Sortable.create(listRef.current, { forceFallback: true, ... })`
- Revert DOM mutation in `onEnd` before Preact re-renders
- Call `paintStore` reorder methods (already exist: `moveElementsForward/Backward/ToFront/ToBack`)

The stroke list panel is a sidebar component that shows `PaintFrame.elements[]` with:
- Drag handle (GripVertical icon, same as LayerList)
- Stroke preview thumbnail (render stroke to tiny offscreen canvas)
- Visibility toggle (filter at render time)
- Delete button
- Selection highlight (tied to `paintStore.selectedStrokeIds`)

### 6. Duplicate Stroke with Alt+Move

**No new dependency.** Pure logic in the paint overlay pointer handler.

On `pointerdown` with Alt key held while hovering a selected stroke:
1. Clone the stroke: `{...stroke, id: crypto.randomUUID(), points: [...stroke.points]}`
2. Add clone via `paintStore.addElement()`
3. Enter drag mode on the clone (offset all points by drag delta)

### 7. Sequence-Scoped Layer Creation

**No new dependency.** Logic change in the layer creation flow.

When `isolationStore.activeSequenceId` is set (sequence is soloed/isolated), `addLayer()` should add the layer only to that sequence instead of all sequences. This is a store-level logic change.

### 8. Denser Motion Path Dots

**No new dependency.** Change `sampleMotionDots()` in `MotionPath.tsx`.

Currently samples one dot per integer frame. For short sequences (e.g., 3-5 frames), interpolate at sub-frame intervals:
```typescript
const totalFrames = lastFrame - firstFrame;
const step = totalFrames <= 8 ? 0.5 : 1;  // half-frame steps for short sequences
```

Uses existing `interpolateAt()` from `keyframeEngine.ts` which already supports fractional frame values.

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Paper.js | 200KB+ full vector graphics framework. Overkill for bezier math only. | bezier-js (math only, ~15KB) |
| Fabric.js | Full canvas framework with its own rendering pipeline. Would conflict with existing Canvas 2D PreviewRenderer. | Keep existing PreviewRenderer + paintRenderer |
| konva / react-konva | React-specific canvas framework. Wrong paradigm for Preact + manual Canvas 2D rendering. | Existing Canvas 2D rendering pipeline |
| @dnd-kit/sortable | React-specific DnD library. SortableJS already works with Preact via forceFallback. | SortableJS (already installed) |
| WebGL2 for luma matte (initially) | Adds complexity for a per-pixel operation that Canvas 2D handles fine at target resolutions. | Canvas 2D getImageData/putImageData. Upgrade to WebGL2 shader only if perf insufficient. |
| External texture/paper libraries | Unnecessary overhead. Canvas 2D `createPattern()` with `'repeat'` handles tiling natively. | Native Canvas 2D pattern API |
| SVG-based path editing | Would require a parallel rendering pipeline. All rendering is Canvas 2D. | Canvas 2D bezierCurveTo + bezier-js math |

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| bezier-js@^6.1.4 | Node 14+, ESM, all modern browsers | Pure math library, no DOM dependency. Works in any JS runtime. |
| bezier-js@^6.1.4 | TypeScript via @types/bezier-js@^4.1.3 | DefinitelyTyped types. May need minor augmentation if v6 added new methods not in @types v4. |
| bezier-js@^6.1.4 | Vite 5 + ESM | ESM-first, tree-shakeable. Import as `import { Bezier } from 'bezier-js'`. |
| sortablejs@^1.15.7 | Preact + Tauri (already validated) | `forceFallback: true` required to bypass Tauri HTML5 DnD interception. Pattern proven in LayerList.tsx. |
| @tauri-apps/plugin-fs@^2.4.5 | Paper texture loading | `readDir` + `readFile` already used in paintPersistence.ts. No version change needed. |

## Stack Patterns by Feature Category

**If the feature is pixel-level compositing (luma matte, paper texture blend):**
- Start with Canvas 2D `getImageData`/`putImageData` or `globalCompositeOperation`
- Escalate to WebGL2 shader only if perf is insufficient at target resolution
- Because: simpler debugging, no WebGL state management, proven pattern in `paintFloodFill.ts`

**If the feature is geometric math (bezier editing, non-uniform scale, motion path):**
- Use bezier-js for curve math, raw arithmetic for point transforms
- Render via Canvas 2D `bezierCurveTo()` / `arc()` / `moveTo()`/`lineTo()`
- Because: matches existing motion path rendering pattern in `MotionPath.tsx`

**If the feature is list/panel UI (stroke list, paint properties cleanup):**
- Preact functional component + Preact Signals for reactivity
- SortableJS with `forceFallback: true` for drag reorder
- Tailwind v4 classes + inline styles with CSS variables for theming
- Because: matches every existing sidebar component pattern

**If the feature is store/data logic (sequence-scoped layers, duplicate stroke):**
- Preact Signal mutations + `pushAction()` for undo/redo
- `paintVersion.value++` after any visual change
- Because: matches all 13 existing stores

## Sources

- [Bezier.js documentation](https://pomax.github.io/bezierjs/) -- API reference for all curve methods (HIGH confidence)
- [Bezier.js GitHub](https://github.com/Pomax/bezierjs) -- v6.1.4, 354+ commits, actively maintained (HIGH confidence)
- [MDN globalCompositeOperation](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) -- luminosity blend mode reference (HIGH confidence)
- [MDN Pixel manipulation with canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas) -- getImageData/putImageData for luma matte (HIGH confidence)
- [MDN bezierCurveTo](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/bezierCurveTo) -- Canvas 2D bezier rendering (HIGH confidence)
- [Tauri asset protocol discussion](https://github.com/orgs/tauri-apps/discussions/11498) -- v2 image loading patterns (MEDIUM confidence)
- Existing codebase: `LayerList.tsx` SortableJS pattern, `previewRenderer.ts` compositing pipeline, `paintStore.ts` element reorder methods, `ipc.ts` assetUrl, `brushP5Adapter.ts` p5.brush integration (HIGH confidence -- direct code inspection)

---
*Stack research for: EFX Motion Editor v0.6.0 Various Enhancements*
*Researched: 2026-03-26*
