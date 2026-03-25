# Architecture Research: v0.5.0 Paint Brush FX & Motion Blur

**Domain:** WebGL2 expressive brush rendering + per-layer GLSL motion blur for stop-motion editor
**Researched:** 2026-03-25
**Confidence:** HIGH

## Existing Architecture Snapshot

```
RENDERING PIPELINE (current v0.4.0)
=====================================================================

exportRenderer.renderGlobalFrame()
  │
  ├── interpolateLayers() ─── keyframeEngine.interpolateAt()
  │                            (already supports fractional frames)
  │
  └── PreviewRenderer.renderFrame(layers, localFrame, frames, fps, ...)
       │
       ├── per-layer loop (bottom → top):
       │   │
       │   ├── Generator layers ─── fxGenerators / glslRuntime
       │   │   └── optional: glBlur.ts (Gaussian blur offscreen)
       │   │
       │   ├── Paint layers ─── paintStore.getFrame(layerId, globalFrame)
       │   │   └── renderPaintFrame() ─── strokeToPath() + ctx.fill()
       │   │       (offscreen canvas per paint layer for eraser isolation)
       │   │
       │   ├── Content layers ─── resolveLayerSource() + drawLayer()
       │   │   └── optional: per-layer blur via getBlurOffscreen()
       │   │
       │   └── Adjustment layers ─── applyColorGrade() etc.
       │
       └── composite each layer to main canvas
            (blendMode → globalCompositeOperation, effectiveOpacity)

WebGL2 CONTEXTS (current)
=====================================================================
  glBlur.ts ─────── shared HTMLCanvasElement + WebGL2 context (lazy init)
                     compile-once shader, texStorage2D, ping-pong FBO
                     API: applyGPUBlur(source, targetCtx, radius, w, h)

  glslRuntime.ts ── separate shared HTMLCanvasElement + WebGL2 context
                     cached program map (shader.id → CachedProgram)
                     API: renderGlslGenerator(), renderGlslFxImage(),
                          renderGlslTransition()

PAINT DATA MODEL (current)
=====================================================================
  paintStore: Map<layerId, Map<frameNum, PaintFrame>>
  PaintFrame: { elements: PaintElement[] }
  PaintElement: PaintStroke | PaintShape | PaintFill
  PaintStroke: { points: [x,y,pressure][], color, opacity, size, options }
  Rendering: perfect-freehand → Path2D → ctx.fill() (Canvas 2D only)
```

## New Components

### 1. Brush FX Renderer (`glBrushFx.ts`)

**What:** WebGL2 offscreen renderer for expressive brush styles (watercolor, ink, charcoal, pencil, marker).

**Why new file:** The existing `paintRenderer.ts` is Canvas 2D only. Brush FX requires fragment shaders for spectral mixing, point stamping, and post-processing. Cleanly separated so flat brushes continue on the fast Canvas 2D path.

**Architecture:**

```
PaintStroke (brushStyle !== 'flat')
    │
    ▼
glBrushFx.ts ─── shared WebGL2 context (lazy init, same pattern as glBlur)
    │
    ├── Point-stamp renderer ─── GL_POINTS with soft-falloff sprite
    │   (each stroke point becomes a textured quad/point)
    │
    ├── Spectral mixing shader ─── spectral.glsl (Kubelka-Munk)
    │   (composites overlapping strokes with subtractive color blend)
    │
    ├── Post-process passes:
    │   ├── Edge darkening (alpha > threshold → darken)
    │   ├── Grain/texture erosion (stochastic holes)
    │   └── Flow field displacement (per-step UV distortion)
    │
    └── Result: framebuffer → readback to OffscreenCanvas
        (composited into paint layer's offscreen canvas)
```

**Integration point:** `paintRenderer.ts` dispatches based on `brushStyle`:
- `'flat'` → existing `strokeToPath()` + `ctx.fill()` (zero regression)
- anything else → `glBrushFx.renderStroke()` which returns a canvas

**WebGL2 context strategy:** Reuse a SINGLE new shared context for all brush FX (same lazy-init pattern as `glBlur.ts`). This is the 3rd WebGL2 context in the app. Chrome allows 16 per page; Safari/WebKit allows at least 8. Three contexts is well within limits. Do NOT create per-layer or per-frame contexts.

### 2. Spectral Mixing Module (`spectralMix.ts` + `spectral.glsl`)

**What:** Kubelka-Munk pigment mixing for physically-based color blending in brush FX.

**Why:** Standard RGB blending produces muddy colors when overlapping strokes (blue + yellow = gray). Spectral mixing produces physically correct results (blue + yellow = green). This is the core differentiator for expressive brush styles.

**Implementation:**
- Use `spectral.js` v3.0.0 GLSL shader (`spectral.glsl`) -- MIT licensed, 7-primary reflectance model
- The GLSL file is embedded directly (small, ~200 lines) as a string constant in `spectralMix.ts`
- Provides both JS-side mixing (for CPU fallback/preview) and GLSL include for the brush FX fragment shader
- Spectral.js chosen over Mixbox because: MIT license (Mixbox is commercial), GLSL shader included out-of-box, established use in p5.brush ecosystem

**Integration:** `glBrushFx.ts` `#include`s the spectral mixing functions into its fragment shader for stroke compositing.

### 3. Watercolor Bleed Engine (`watercolorBleed.ts`)

**What:** Tyler Hobbs polygon deformation algorithm for watercolor edge diffusion.

**Why new file:** Complex geometry algorithm (recursive polygon deformation + multi-layer transparent fill) that is conceptually separate from the WebGL rendering. Generates deformed polygon vertices that are then rendered by `glBrushFx.ts`.

**Algorithm:**
```
Input polygon (stroke outline from perfect-freehand)
    │
    ├── Assign per-segment variance (high at edges, low at center)
    ├── Deform N times (N~7) ─── displace vertices along edge normals
    │                             with Gaussian random offsets
    │   Result: "base polygon"
    │
    └── For each layer (20-40 layers):
        ├── Start from base polygon
        ├── Deform M more times (M~4-5)
        ├── Draw at low opacity (~4%)
        └── Optional: stochastic erosion pass (destination-out circles)
```

**Integration:** Called by `glBrushFx.ts` when `brushStyle === 'watercolor'`. The deformed polygons are tessellated into triangles and rendered via WebGL2 with spectral mixing active.

### 4. Flow Field Engine (`flowField.ts`)

**What:** 2D vector field grid that deflects stroke paths for organic rendering.

**Implementation:**
- Grid-based: divide canvas into cells, each with a 2D direction vector
- Preset patterns: wobble (Perlin noise), curved, zigzag, waves, spiral
- Applied per-step during stroke rasterization (CPU-side point displacement before GPU rendering)
- Lightweight: no WebGL needed for the field itself, just math on point arrays

**Integration:** Called before point stamping in `glBrushFx.ts`. Each stroke point's position is displaced by sampling the flow field at that location.

### 5. Motion Blur Engine (`glMotionBlur.ts`)

**What:** GLSL per-layer velocity-based directional blur.

**Why new file (not extending glBlur.ts):** Different shader (directional vs Gaussian), different uniforms (velocity vector vs radius), different use case (temporal motion vs static defocus). Same lazy-init pattern but separate program cache.

**Architecture:**

```
glMotionBlur.ts ─── reuses glBlur.ts WebGL2 context OR creates 4th context
    │
    ├── Shader: velocity-directed sampling along motion vector
    │   uniforms: iChannel0 (layer texture), uVelocity, uStrength, uSamples
    │
    ├── applyMotionBlur(source, velocity, {strength, samples}) → canvas
    │
    └── Context sharing decision:
        RECOMMENDED: Share glBlur.ts context (refactor to export getGL())
        because motion blur and Gaussian blur never run simultaneously
        on the same layer. This keeps total context count at 3.
```

**GLSL Shader (from spec, validated):**
```glsl
#version 300 es
precision highp float;

uniform sampler2D iChannel0;
uniform vec2 iResolution;
uniform vec2 uVelocity;         // pixels (dx, dy)
uniform float uStrength;        // 0.0 - 1.0
uniform int uSamples;           // 8 (preview) or 16 (export)

in vec2 vUV;
out vec4 fragColor;

void main() {
    vec2 texelSize = 1.0 / iResolution;
    vec2 velocity = uVelocity * texelSize * uStrength;
    vec4 color = vec4(0.0);
    float totalWeight = 0.0;

    for (int i = 0; i < uSamples; i++) {
        float t = float(i) / float(uSamples - 1) - 0.5;
        vec2 offset = velocity * t;
        vec2 sampleUV = clamp(vUV + offset, vec2(0.0), vec2(1.0));
        float weight = 1.0 - abs(t * 2.0);  // triangle filter
        color += texture(iChannel0, sampleUV) * weight;
        totalWeight += weight;
    }
    fragColor = color / totalWeight;
}
```

### 6. Motion Blur Velocity Engine (`motionBlurEngine.ts`)

**What:** Computes per-layer velocity vectors from keyframe transform deltas; manages sub-frame accumulation buffer for export.

**Architecture:**
```
motionBlurEngine.ts
    │
    ├── computeLayerVelocity(current, previous) → {dx, dy, dRotation, dScale}
    │   (uses InterpolatedKeyframeValues from two consecutive frames)
    │
    ├── renderFrameWithMotionBlur(globalFrame, subFrames, renderer, strength)
    │   → OffscreenCanvas
    │   (sub-frame accumulation: render N sub-frames, blend with 1/N opacity)
    │
    └── shouldApplyMotionBlur(velocity, threshold) → boolean
        (skip blur when velocity below perceptual threshold)
```

### 7. Motion Blur Store (`motionBlurStore.ts` or extend `projectStore`)

**What:** Project-level motion blur settings with signal-based reactivity.

**Decision: Extend projectStore** rather than creating a new store. Reason: Motion blur settings are project-level data that persists in .mce files, just like fps and resolution. A 13th store for 4 signals is excessive. Add to projectStore:

```typescript
// In projectStore
const motionBlurEnabled = signal(false);
const motionBlurStrength = signal(0.5);    // shutter angle 180 = 0.5
const motionBlurPreviewQuality = signal<'off' | 'low' | 'medium'>('off');
const motionBlurExportSubFrames = signal(8);
```

## Modified Components

### previewRenderer.ts -- Per-Layer Motion Blur Hook

**What changes:** After each layer is rendered to its offscreen canvas (or main canvas), apply motion blur if enabled.

**Where exactly:** In the `renderFrame()` method, the per-layer loop already renders each layer to an offscreen canvas when blur is active (lines ~226-350). Motion blur hooks into the SAME offscreen canvas pattern:

```
For each layer:
  1. Render layer content to offscreen canvas (existing)
  2. Apply Gaussian blur if layer.blur > 0 (existing)
  3. NEW: Apply motion blur if motionBlurEnabled && velocity > threshold
     └── computeLayerVelocity(currentValues, previousValues)
     └── applyMotionBlur(offscreenCanvas, velocity, {strength, samples})
  4. Composite offscreen → main canvas (existing)
```

**State needed:** Previous frame's interpolated values per layer. Store as `Map<layerId, InterpolatedKeyframeValues>` on the PreviewRenderer instance. Updated each frame.

**Paint layers + motion blur:** Paint layers CAN receive motion blur when the paint layer itself has animated transforms (position/rotation keyframes). The motion blur is applied to the composited paint layer offscreen canvas, not to individual strokes.

### paintRenderer.ts -- Brush Style Dispatch

**What changes:** The `renderElement()` function gains a branch for non-flat brush styles that delegates to `glBrushFx.ts`.

```
renderElement(ctx, element, width, height)
  │
  ├── element.tool === 'brush' && element.brushStyle !== 'flat'
  │   └── glBrushFx.renderStroke(element) → OffscreenCanvas
  │       ctx.drawImage(fxCanvas, 0, 0)
  │
  └── everything else → existing Canvas 2D paths (unchanged)
```

**Critical: eraser isolation.** Brush FX strokes must be rendered to the same offscreen canvas that erasers use `destination-out` on. The integration point in `previewRenderer.ts` already creates an offscreen canvas per paint layer (line ~287). The brush FX renderer blits its output onto this same offscreen, so erasers work correctly across mixed flat/FX strokes.

### exportRenderer.ts -- Sub-Frame Accumulation

**What changes:** `renderGlobalFrame()` gains an optional sub-frame accumulation wrapper.

```
Current:
  renderGlobalFrame(renderer, canvas, frame, fm, allSeqs, overlaps, solo)

With motion blur (export only):
  if (motionBlurEnabled && exportSubFrames > 1):
    accumulator = new OffscreenCanvas(w, h)
    for i in 0..subFrames:
      subFrame = globalFrame + (i / subFrames)
      renderGlobalFrame(renderer, tempCanvas, subFrame, ...)
      accumulator.drawImage(tempCanvas, globalAlpha=1/subFrames)
    canvas ← accumulator
  else:
    renderGlobalFrame(renderer, canvas, frame, ...) // unchanged
```

**Key insight from existing code:** `interpolateLayers()` calls `interpolateAt(layer.keyframes, localFrame)` which already supports fractional frame values. Sub-frame accumulation works out of the box for keyframe interpolation. No changes to `keyframeEngine.ts` needed.

### exportEngine.ts -- Motion Blur Settings Integration

**What changes:** The export frame loop (line 131: `for (let frame = startFromFrame; frame < total; frame++)`) wraps the existing `renderGlobalFrame()` call with the sub-frame accumulation logic from `motionBlurEngine.ts`. Export settings gain motion blur controls.

### types/paint.ts -- Brush Style Extension

**What changes:** Extend `PaintStroke` with optional brush style fields:

```typescript
interface PaintStroke {
  // ... existing fields unchanged ...
  brushStyle?: BrushStyle;       // default: 'flat' (backward compat)
  brushParams?: BrushFxParams;   // per-stroke FX params
}

type BrushStyle = 'flat' | 'watercolor' | 'ink' | 'charcoal' | 'pencil' | 'marker';

interface BrushFxParams {
  grain?: number;        // 0-1
  bleed?: number;        // 0-1
  scatter?: number;      // 0-1
  fieldStrength?: number;// 0-1
  edgeDarken?: number;   // 0-1
}
```

Optional fields ensure backward compatibility with existing .mce v14 paint sidecar files. Missing `brushStyle` defaults to `'flat'`.

### types/project.ts -- Motion Blur Settings Type

**What changes:** Add `MotionBlurSettings` interface and include in project type:

```typescript
interface MotionBlurSettings {
  enabled: boolean;
  strength: number;        // 0.0-1.0 (shutterAngle / 360)
  previewQuality: 'off' | 'low' | 'medium';
  exportSubFrames: number; // 4, 8, or 16
}
```

### projectStore.ts -- .mce v15

**What changes:** Add motion blur signals. Bump .mce format to v15 with `serde(default)` backward compatibility (same pattern as v8-v14 progressive migration).

## Data Flow

### Paint Brush FX Rendering Flow

```
User draws stroke (PaintOverlay pointer events)
    │
    ▼
paintStore.addElement(layerId, frame, PaintStroke{brushStyle:'watercolor',...})
    │
    ▼
paintVersion signal bumps → PreviewRenderer re-renders
    │
    ▼
PreviewRenderer.renderFrame() → paint layer branch (line 275)
    │
    ├── Creates project-sized offscreen canvas
    │
    ├── renderPaintFrame(offCtx, paintFrame, projW, projH)
    │   │
    │   └── for each element:
    │       ├── brushStyle === 'flat' → strokeToPath() + ctx.fill()
    │       │
    │       └── brushStyle !== 'flat' → glBrushFx.renderStroke()
    │           │
    │           ├── Apply flow field displacement to points
    │           ├── Point-stamp to WebGL2 framebuffer
    │           ├── Spectral mixing shader composites overlaps
    │           ├── Post-process: edge darken, grain, bleed
    │           └── readback → ctx.drawImage(fxResult, 0, 0)
    │
    ├── ctx.drawImage(offscreen, 0, 0, logicalW, logicalH)
    │   (with blendMode + effectiveOpacity)
    │
    └── offscreen composited onto main canvas
```

### Motion Blur Preview Flow

```
PlaybackEngine tick → frame N
    │
    ▼
exportRenderer.renderGlobalFrame(renderer, canvas, N, ...)
    │
    ▼
interpolateLayers(seq, localFrame) → layerValues[N]
    │
    ▼
PreviewRenderer.renderFrame(interpolatedLayers, ...)
    │
    ├── For each layer:
    │   ├── Render to offscreen canvas (existing logic)
    │   │
    │   ├── Retrieve previousValues from _prevFrameCache Map
    │   │
    │   ├── computeLayerVelocity(currentValues, previousValues)
    │   │   → {dx, dy} in pixels/frame
    │   │
    │   ├── if (|dx| > threshold || |dy| > threshold):
    │   │   applyMotionBlur(offscreen, {dx, dy}, {
    │   │     strength: projectStore.motionBlurStrength,
    │   │     samples: previewQuality === 'low' ? 4 : 8
    │   │   })
    │   │
    │   └── Composite to main canvas
    │
    └── Update _prevFrameCache with current layerValues
```

### Motion Blur Export Flow (Sub-Frame Accumulation)

```
ExportEngine frame loop → frame N
    │
    ▼
motionBlurEnabled && exportSubFrames > 1?
    │
    ├── YES: renderFrameWithMotionBlur(N, subFrames=8, renderer, strength)
    │   │
    │   ├── accumulator = new OffscreenCanvas(exportW, exportH)
    │   ├── accumCtx.globalAlpha = 1/8
    │   │
    │   └── for i in 0..7:
    │       ├── subFrame = N + (i/8)   // e.g., N+0.0, N+0.125, ...
    │       ├── interpolateLayers(seq, subFrame) // fractional → smooth interp
    │       ├── renderFrame() with per-layer GLSL velocity blur (samples=16)
    │       └── accumCtx.drawImage(tempCanvas, 0, 0)
    │
    │   Result: averaged 8 sub-frames, each with GLSL velocity blur
    │   Quality: Excellent (GLSL fills gaps between discrete sub-frames)
    │
    └── NO: renderGlobalFrame() as before (unchanged)
```

## Component Boundary Map

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `glBrushFx.ts` | WebGL2 brush stroke rendering (point stamp + spectral mix + post-process) | paintRenderer.ts (called by), spectralMix.ts (shader include), flowField.ts (point displacement), watercolorBleed.ts (polygon deformation for watercolor style) |
| `spectralMix.ts` | Kubelka-Munk color mixing (JS + GLSL shader source) | glBrushFx.ts (GLSL include) |
| `watercolorBleed.ts` | Tyler Hobbs polygon deformation algorithm | glBrushFx.ts (generates polygon vertices for watercolor rendering) |
| `flowField.ts` | 2D vector field for organic stroke distortion | glBrushFx.ts (displaces stroke points before GPU rendering) |
| `glMotionBlur.ts` | GLSL velocity-directed blur shader + WebGL2 pipeline | previewRenderer.ts (per-layer blur), motionBlurEngine.ts (called by accumulation) |
| `motionBlurEngine.ts` | Velocity computation, sub-frame accumulation buffer, threshold logic | exportRenderer.ts (export accumulation), previewRenderer.ts (velocity computation), keyframeEngine.ts (interpolateAt for sub-frames) |
| `paintRenderer.ts` (modified) | Dispatch: flat → Canvas 2D, styled → glBrushFx | glBrushFx.ts (delegates styled strokes) |
| `previewRenderer.ts` (modified) | Per-layer motion blur hook in render loop | glMotionBlur.ts (applies blur), motionBlurEngine.ts (computes velocity) |
| `exportRenderer.ts` (modified) | Sub-frame accumulation wrapper around renderGlobalFrame | motionBlurEngine.ts (accumulation logic) |
| `projectStore.ts` (modified) | Motion blur project settings (enabled, strength, quality) | .mce v15 persistence, previewRenderer, exportEngine |

## WebGL2 Context Budget

| Context | Owner | Purpose | Shared? |
|---------|-------|---------|---------|
| 1 | `glBlur.ts` | Gaussian blur (2-pass separable) | Could share with glMotionBlur |
| 2 | `glslRuntime.ts` | GLSL shader effects + GL transitions | No (many cached programs) |
| 3 | `glBrushFx.ts` | Brush FX point stamping + spectral mix | New, dedicated |
| 4 | `glMotionBlur.ts` | Velocity motion blur | **SHARE with glBlur.ts** |

**Recommendation:** Share context between `glBlur.ts` and `glMotionBlur.ts` by extracting a `glSharedContext.ts` module that manages the lazy-init WebGL2 context, fullscreen-quad VAO, and texture upload utilities. Both blur modules compile their own shader programs but share the context and VAO. Total contexts: **3** (well within all browser limits).

**Why not share all on one context?** `glslRuntime.ts` maintains a large program cache (17+ shader programs) with its own texture management. Mixing brush FX state (multiple render targets, framebuffer ping-pong for spectral compositing) with the shader effect pipeline would create fragile state coupling. Three contexts is safe and clean.

## Architectural Patterns

### Pattern 1: Lazy-Init Shared Context (Established)

**What:** WebGL2 context created on first use, cached as module-level singleton. Context loss handled via event listener that nullifies cached state, triggering re-initialization on next use.

**When:** Every WebGL2 module in this app.

**Example:** See `glBlur.ts` lines 89-124 -- `getGL()` function with `_initFailed` guard, `webglcontextlost` handler.

**Trade-offs:** Simple, proven in this codebase. Slight first-call latency (~5ms for context creation). Context loss recovery is automatic.

### Pattern 2: Offscreen Canvas Per-Layer Isolation (Established)

**What:** Each layer with special compositing needs (eraser, blur, FX) renders to a temporary offscreen canvas, which is then composited onto the main canvas with proper blend mode and opacity.

**When:** Paint layers (eraser needs destination-out isolation), blurred layers, motion-blurred layers.

**Trade-offs:** Memory cost per offscreen canvas (~4 bytes * W * H). Currently creates a new `document.createElement('canvas')` per paint layer per frame, which is wasteful. Should pool/reuse offscreen canvases (see Anti-Patterns section).

### Pattern 3: Signal-Bump Reactivity for Non-Reactive Data (Established)

**What:** `paintStore` stores actual data in plain `Map` (non-reactive) but bumps a `paintVersion` counter signal on mutations. Consumers (PreviewRenderer) react to the signal bump, not the Map changes.

**When:** Large mutable data structures (paint frames, potentially cached brush FX results) where making every entry reactive would be expensive.

**Trade-offs:** Requires manual signal bumps on every mutation. Missing a bump = stale render. But avoids O(n) reactive subscription overhead for thousands of strokes.

### Pattern 4: Shader Program Caching (Established)

**What:** GLSL programs compiled once and cached by ID in a `Map<string, CachedProgram>`. Uniform locations resolved at compile time.

**When:** `glslRuntime.ts` caches by shader ID. `glBrushFx.ts` should cache by brush style (6 styles = 6 programs max).

**Trade-offs:** Memory for compiled programs (~negligible). Fast subsequent renders. Must handle context loss (clear cache, recompile on next use).

## Anti-Patterns to Avoid

### Anti-Pattern 1: WebGL2 Context Per Paint Layer

**What people do:** Create a new WebGL2 context for each paint layer that uses brush FX.
**Why it's wrong:** Browsers limit contexts to 8-16 (OffscreenCanvas even lower at 4). A project with 3+ paint layers would exhaust the budget.
**Do this instead:** Single shared context in `glBrushFx.ts`. Render each layer's strokes sequentially through the same context, reading back between layers.

### Anti-Pattern 2: Allocating Offscreen Canvas Per Frame Per Layer

**What people do:** `document.createElement('canvas')` inside the per-frame render loop (the current paint layer code does this at line ~287 of previewRenderer.ts).
**Why it's wrong:** GC pressure from creating/destroying canvases at 24fps. Each allocation is ~W*H*4 bytes.
**Do this instead:** Pool offscreen canvases by size. Create once, clear and reuse. The existing `getBlurOffscreen()` method already does this for blur -- extend the pattern to paint layers.

### Anti-Pattern 3: Re-rendering All Brush FX Strokes Every Frame

**What people do:** Run every styled stroke through the WebGL pipeline on every frame, even when paint data hasn't changed.
**Why it's wrong:** Brush FX rendering is expensive (spectral mixing, multi-layer watercolor). At 24fps with 50+ strokes, this kills performance.
**Do this instead:** Cache the rendered paint layer result. Only re-render when `paintVersion` changes (stroke added/removed) or the frame changes. Store per-layer per-frame rendered canvases in a cache with LRU eviction.

### Anti-Pattern 4: Motion Blur on Static Layers

**What people do:** Apply motion blur to every layer unconditionally.
**Why it's wrong:** Most layers in stop-motion are static between keyframes. Blurring a stationary layer wastes GPU time and can introduce subtle quality loss from the sampling.
**Do this instead:** Compute velocity first. Skip blur when `|dx| < threshold && |dy| < threshold` (threshold ~0.5px). The `shouldApplyMotionBlur()` function handles this.

### Anti-Pattern 5: Full Sub-Frame Count in Preview

**What people do:** Use 8+ sub-frames for preview motion blur.
**Why it's wrong:** Each sub-frame requires a full `renderGlobalFrame()` pass. 8 sub-frames = 8x render cost = ~3fps instead of 24fps.
**Do this instead:** Preview uses GLSL velocity blur only (single pass, ~1ms). Sub-frame accumulation is export-only. The spec's "previewQuality" setting of 'off'/'low'/'medium' controls GLSL sample count, not sub-frame count.

## Suggested Build Order

Build order accounts for dependencies between paint FX and motion blur (they are largely independent and can be built in parallel, but brush FX is more complex).

### Phase 1: Foundation (Motion Blur GLSL Engine)
**Build:** `glMotionBlur.ts` + `motionBlurEngine.ts`
**Why first:** Smallest scope, cleanest integration (single new shader), provides immediate visual value. The GLSL velocity blur shader is self-contained and well-understood.
**Depends on:** Nothing new. Uses existing `glBlur.ts` lazy-init pattern.
**Delivers:** Per-layer velocity blur in preview.

### Phase 2: Motion Blur Integration (Preview + Store + UI)
**Build:** PreviewRenderer motion blur hook, projectStore extensions, preview toolbar toggle, .mce v15
**Why second:** Completes the motion blur preview pipeline end-to-end.
**Depends on:** Phase 1 (glMotionBlur engine).
**Delivers:** Togglable motion blur in live preview.

### Phase 3: Brush Style Data Model + UI
**Build:** `BrushStyle` type extension, PaintProperties UI selector, paintStore brush param support
**Why third:** Pure data model and UI work, no rendering. Establishes the contract that `glBrushFx` will implement.
**Depends on:** Nothing (parallel with Phase 1-2 if desired).
**Delivers:** Users can select brush styles (rendering still falls back to flat).

### Phase 4: WebGL2 Brush FX Core
**Build:** `glBrushFx.ts` with point-stamp renderer + basic brush presets (ink, charcoal, pencil, marker)
**Why fourth:** Core GPU rendering pipeline for non-watercolor brushes. Point stamping with soft falloff + opacity layering covers ink/charcoal/pencil/marker.
**Depends on:** Phase 3 (data model).
**Delivers:** 4 of 5 brush styles rendering with GPU acceleration.

### Phase 5: Spectral Pigment Mixing
**Build:** `spectralMix.ts` + `spectral.glsl` integration into `glBrushFx.ts`
**Why fifth:** Spectral mixing changes HOW strokes composite. Must have the basic point-stamp pipeline working first.
**Depends on:** Phase 4 (brush FX core).
**Delivers:** Physically-correct color blending for overlapping strokes.

### Phase 6: Watercolor Bleed + Flow Fields
**Build:** `watercolorBleed.ts` + `flowField.ts` integration
**Why sixth:** Most complex brush style. Polygon deformation is CPU-heavy and needs careful performance tuning.
**Depends on:** Phase 4 (brush FX core), Phase 5 (spectral mixing for watercolor color blending).
**Delivers:** Watercolor style with bleed + flow field distortion.

### Phase 7: Grain/Texture Post-Pass + Edge Darkening
**Build:** Post-processing shader passes in `glBrushFx.ts`
**Why seventh:** Polish passes that enhance all brush styles. Low complexity.
**Depends on:** Phase 4 (brush FX core).
**Delivers:** Paper grain texture, ink pooling at overlaps.

### Phase 8: Motion Blur Export (Sub-Frame Accumulation)
**Build:** Export sub-frame accumulation in `motionBlurEngine.ts` + `exportEngine.ts` integration + export panel UI
**Why eighth:** Export path is separate from preview. Can be built after preview blur is stable.
**Depends on:** Phase 1-2 (motion blur GLSL + preview integration).
**Delivers:** High-quality motion blur in exported video/PNG sequences.

### Phase 9: Polish + Performance
**Build:** Offscreen canvas pooling, brush FX render caching, shutter angle UI, adaptive preview quality
**Why last:** Optimization after correctness. Performance issues only visible with real-world usage.
**Depends on:** All prior phases.
**Delivers:** Production-ready performance.

## File Map (New + Modified)

```
Application/src/
├── lib/
│   ├── glBrushFx.ts          NEW  WebGL2 brush FX renderer
│   ├── spectralMix.ts        NEW  Kubelka-Munk JS + GLSL shader source
│   ├── watercolorBleed.ts    NEW  Polygon deformation algorithm
│   ├── flowField.ts          NEW  2D vector field engine
│   ├── glMotionBlur.ts       NEW  GLSL velocity blur shader + pipeline
│   ├── motionBlurEngine.ts   NEW  Velocity computation + sub-frame accumulation
│   ├── glSharedContext.ts    NEW  Shared WebGL2 context for glBlur + glMotionBlur
│   ├── paintRenderer.ts      MOD  Brush style dispatch
│   ├── previewRenderer.ts    MOD  Per-layer motion blur hook + prev-frame cache
│   ├── exportRenderer.ts     MOD  Sub-frame accumulation wrapper
│   ├── exportEngine.ts       MOD  Motion blur export settings
│   └── glBlur.ts             MOD  Refactor to use glSharedContext.ts
├── stores/
│   └── projectStore.ts       MOD  Motion blur settings signals + .mce v15
├── types/
│   ├── paint.ts              MOD  BrushStyle, BrushFxParams on PaintStroke
│   └── project.ts            MOD  MotionBlurSettings interface
└── components/
    ├── PaintProperties.tsx    MOD  Brush style selector UI
    ├── PreviewToolbar.tsx     MOD  Motion blur toggle
    └── ExportPanel.tsx        MOD  Motion blur export settings
```

## Sources

- [spectral.js v3.0.0](https://github.com/rvanwijnen/spectral.js) -- MIT licensed Kubelka-Munk pigment mixing with GLSL shader (HIGH confidence)
- [p5.brush](https://github.com/acamposuribe/p5.brush) -- WebGL2 brush rendering reference (algorithms ported, not used as dependency) (HIGH confidence)
- [Tyler Hobbs: Watercolor Simulation](https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art) -- Polygon deformation algorithm (HIGH confidence)
- [John Chapman: Per-Object Motion Blur](http://john-chapman-graphics.blogspot.com/2013/01/per-object-motion-blur.html) -- Velocity buffer motion blur technique (HIGH confidence)
- [Chromium WebGL context limits](https://issues.chromium.org/issues/40939743) -- 16 context limit on desktop, 4 for OffscreenCanvas (MEDIUM confidence -- may vary by browser version)
- [glbrush.js](https://github.com/Oletus/glbrush.js) -- WebGL brush rendering reference with 16-bit precision (MEDIUM confidence)

---
*Architecture research for: v0.5.0 Paint Brush FX & Motion Blur*
*Researched: 2026-03-25*
