# Stack Research

**Domain:** Desktop stop-motion cinematic editor (macOS) -- v0.5.0 paint brush FX and motion blur
**Researched:** 2026-03-25
**Confidence:** HIGH

## Scope

This research covers ONLY the stack additions needed for v0.5.0 features:
1. Spectral pigment mixing (Kubelka-Munk) via WebGL2 shaders for physically-based brush color blending
2. Watercolor bleed simulation (polygon deformation + layered fill)
3. Flow field distortion for organic stroke paths
4. Grain/texture post-pass and edge darkening
5. WebGL2 offscreen brush renderer (point-stamping pipeline)
6. GLSL per-layer velocity motion blur for preview
7. Sub-frame accumulation buffer for export
8. Motion blur UI controls (shutter angle, quality settings)

The existing stack (Tauri 2.0, Preact, Preact Signals, Motion Canvas, Vite 5, Tailwind CSS v4, pnpm, perfect-freehand, WebGL2 glBlur.ts, WebGL2 glslRuntime.ts) is validated and unchanged.

## Critical Architecture Constraint: WebGL2 Context Budget

Chrome/WebKit allows a maximum of 16 WebGL2 contexts per page. The app currently uses 2 contexts:
- `glBlur.ts` -- lazy-init shared offscreen context for GPU Gaussian blur
- `glslRuntime.ts` -- lazy-init shared offscreen context for shader effects and GL transitions

**Decision: Do NOT create new WebGL2 contexts for brush FX or motion blur.**

Both new features must use framebuffer objects (FBOs) within the existing `glslRuntime.ts` context or adopt its lazy-init pattern with a single new shared context for the brush pipeline. The motion blur shader (`glMotionBlur.ts`) should follow the same single-context pattern as `glBlur.ts` since its rendering lifecycle is identical (per-layer post-process pass, blit back to Canvas 2D).

---

## Recommended Stack Additions

### 1. Spectral Pigment Mixing -- spectral.js v3.0.0

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| spectral.js | ^3.0.0 | Kubelka-Munk subtractive color mixing (JavaScript API + GLSL shader) | Ships both `spectral.js` (CPU) and `shader/spectral.glsl` (GPU). 38-band spectral reflectance model. MIT license. The GLSL file is the critical asset -- provides `spectral_mix()` function variants for 2-4 color blending directly in fragment shaders. |

**Why spectral.js over alternatives:**

| Considered | Verdict | Why |
|------------|---------|-----|
| **spectral.js v3.0.0** | **USE THIS** | Ships a ready-to-use GLSL include file (`shader/spectral.glsl`, ~442 lines). Provides `spectral_mix(vec3, vec3, float)` that can be called directly from the brush compositing fragment shader. Supports OKLab, OKLCh, CIE XYZ color spaces. v3.0 is the latest with proper gamut mapping. |
| Mixbox (Scribus) | Skip | Commercial license (not free for proprietary use). Similar Kubelka-Munk approach but GLSL header is proprietary. |
| Custom K-M implementation | Skip | spectral.js already solves this problem with a tested GLSL shader. Re-implementing 442 lines of spectral math is pure waste. |
| Lorentz Pigment Mixing (LPM) | Skip | Novel 2025 approach but works entirely in RGB without spectral data -- less physically accurate for paint simulation. No GLSL implementation available. Academic paper, not a library. |

**Integration approach:**

The `shader/spectral.glsl` file will be embedded as a string constant (like existing Shadertoy shaders in `shaderLibrary.ts`) and prepended to the brush compositing fragment shader. The JavaScript API (`spectral.Color`, `spectral.mix`) is useful for CPU-side color picker preview but not needed in the hot rendering path.

Key GLSL functions from spectral.glsl:
```glsl
vec3 spectral_mix(vec3 color1, vec3 color2, float factor)                    // 2-color blend
vec3 spectral_mix(vec3 c1, float ts1, float f1, vec3 c2, float ts2, float f2) // with tinting strength
```

**CPU-side usage:** The JavaScript API will be used in the PaintProperties color picker to preview how selected colors will mix on canvas. This gives real-time feedback before the user paints.

**Confidence:** HIGH -- npm package verified, GLSL shader file verified in repository, API documented, MIT licensed.

### 2. Flow Field Noise -- simplex-noise v4.0.3

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| simplex-noise | ^4.0.3 | 2D/3D noise generation for flow field distortion of brush strokes | Zero dependencies, ~2KB gzipped, TypeScript native, tree-shakeable ESM. 72M calls/sec for noise2D. Seeded PRNG support for deterministic fields. |

**Why simplex-noise over alternatives:**

| Considered | Verdict | Why |
|------------|---------|-----|
| **simplex-noise v4.0.3** | **USE THIS** | Industry standard for 2D noise in JS. Fast enough for CPU-side flow field computation (pre-computed per stroke, not per-frame). TypeScript types included. Seeding support means deterministic replay for export. |
| noisejs (josephg) | Skip | No TypeScript types. Abandoned (last update 2016). API is global mutation rather than factory functions. |
| @webvoxel/fast-simplex-noise | Skip | Wrapper library with unnecessary abstraction. Fewer downloads, less battle-tested. |
| Custom noise (GLSL-only) | Skip | Flow fields need CPU-side computation during stroke recording (pointer events), not GPU. GLSL noise would require readback which defeats the purpose. |

**Integration approach:**

Flow fields are computed CPU-side during stroke recording, not during rendering. When the user draws with a non-flat brush style, each pointer event position is deflected through a pre-computed 2D noise field before being added to the stroke's `points[]` array. This means:

1. The noise field is generated once when painting begins (seeded by stroke ID for determinism)
2. Each `[x, y, pressure]` point is perturbed by `noise2D(x * scale, y * scale) * fieldStrength`
3. The perturbed points are stored in the `PaintStroke.points` array as-is
4. Rendering is unchanged -- `perfect-freehand` processes the already-deflected points

This design preserves the vector data model and ensures export renders identically to preview. The flow field itself is NOT persisted -- it's deterministically reconstructable from the stroke's seed.

**Confidence:** HIGH -- npm package verified (4.0.3 latest), TypeScript native, zero deps, well-documented API.

### 3. Motion Blur -- No New Dependencies (Custom GLSL)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom `glMotionBlur.ts` | N/A | Per-layer GLSL velocity blur post-process | Follows exact same pattern as existing `glBlur.ts`. Single shared WebGL2 context, lazy-init, ping-pong FBO. The motion blur shader is 30 lines of GLSL -- no library needed. |

**Why no dependency:**

The motion blur GLSL shader (already specified in `SPECS/motion-blur.md`) is a simple directional blur that samples along a velocity vector. At ~30 lines of fragment shader code, adding a dependency would be absurd. The existing `glBlur.ts` module provides a battle-tested pattern for:

- Lazy-init WebGL2 context with context-loss recovery
- Shader compilation and program caching
- Texture upload via `texSubImage2D(canvas)`
- FBO ping-pong for multi-pass rendering
- Blit back to Canvas 2D via `drawImage(glCanvas)`

`glMotionBlur.ts` will clone this pattern with a different fragment shader. Uniforms: `uVelocity` (vec2, pixels/frame), `uStrength` (float, 0-1 from shutter angle), `uSamples` (int, 8 preview / 16 export).

**Integration point:** Hooks into `PreviewRenderer.renderFrame()` per-layer pipeline, after layer content is rendered to its offscreen canvas and before compositing to main canvas. Same position as the existing per-layer blur pass.

**Confidence:** HIGH -- pattern proven by glBlur.ts, shader trivial, no external dependencies.

### 4. Watercolor Simulation -- No New Dependencies (Custom Algorithm)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Custom polygon deformation | N/A | Watercolor bleed effect via Tyler Hobbs algorithm | Pure geometry algorithm (vertex displacement + Gaussian random offsets). Canvas 2D rendering with 20+ semi-transparent layers. No library exists for this. |

**Why no dependency:**

The Tyler Hobbs watercolor algorithm is a polygon deformation technique:
1. Start with stroke outline polygon (from `perfect-freehand` output)
2. For each edge, displace midpoint along normal by Gaussian random offset
3. Repeat 5-7 iterations to create organic shape
4. Render 20-30 overlapping semi-transparent layers with varying deformation
5. Apply stochastic erosion passes (`destination-out` circles) for paper texture

This is pure math operating on the polygon vertices -- no library captures this algorithm, and the implementation is ~100 lines of TypeScript. The rendering uses standard Canvas 2D compositing operations already proven in the paint renderer.

**Confidence:** HIGH -- algorithm well-documented by Tyler Hobbs, implementation is straightforward polygon math.

### 5. Sub-Frame Accumulation -- No New Dependencies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| OffscreenCanvas + Canvas 2D accumulation | Browser built-in | Sub-frame motion blur for export | The existing `interpolateAt()` keyframe engine already supports fractional frame values. Sub-frame accumulation is a loop of N renders with `globalAlpha = 1/N` composited onto an accumulation buffer. Zero new technology. |

**Integration point:** Wraps the existing `renderGlobalFrame()` call in `exportEngine.ts` with a sub-frame loop. Each iteration renders at `frame + (i/N)`, with the GLSL velocity blur applied per-layer within each sub-frame. The accumulation canvas uses standard `globalAlpha` compositing.

**Confidence:** HIGH -- uses existing rendering pipeline, no new APIs.

---

## Installation

```bash
# New dependencies for v0.5.0
pnpm add spectral.js@^3.0.0 simplex-noise@^4.0.3

# No new dev dependencies needed
```

Total new dependency footprint: ~2KB (simplex-noise gzipped) + ~15KB (spectral.js, estimated from source size). The spectral.js GLSL shader is embedded as a string constant at build time, not loaded at runtime.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| p5.brush / p5.js | Tightly coupled to p5.js canvas abstraction. Cannot extract WebGL2 pipeline without pulling in p5.js (~800KB). Algorithms must be ported, not the library. | Port specific algorithms (spectral mixing, flow fields, point-stamping) using spectral.js GLSL + custom shaders |
| Three.js / Babylon.js | Massive 3D frameworks (500KB+). We need 2D fragment shaders on fullscreen quads -- the exact pattern already implemented in glBlur.ts and glslRuntime.ts. | Existing WebGL2 pattern (compile shader, upload texture, draw quad, read back) |
| regl / twgl.js | WebGL wrapper libraries. Add abstraction overhead with no benefit -- the app already has a proven raw WebGL2 pattern. Adding a wrapper creates two patterns to maintain. | Raw WebGL2 (consistent with glBlur.ts and glslRuntime.ts) |
| GPU.js | Compute-focused WebGL abstraction. Adds 200KB for kernel functions we don't need. Motion blur and spectral mixing are standard fragment shader operations. | Custom GLSL fragment shaders |
| glslify | GLSL module system. Overkill for 2 shader files (spectral.glsl + motion blur). The existing approach of string constants works fine for the codebase size. | String constant embedding (consistent with shaderLibrary.ts) |
| Mixbox | Commercial license incompatible with this project. | spectral.js (MIT) |
| OffscreenCanvas with WebGL2 (for brush) | Creates a separate WebGL2 context per paint layer. With multiple paint layers, this burns through Chrome's 16-context limit. | FBO-based rendering within a shared WebGL2 context |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|------------------------|
| spectral.js GLSL (Kubelka-Munk) | Standard GLSL `mix()` (linear RGB) | If physically-based pigment mixing is deprioritized and simpler color blending is acceptable. Linear RGB mix creates muddy browns where K-M creates vibrant greens (blue+yellow). |
| simplex-noise (CPU flow fields) | GLSL noise functions (GPU) | If flow fields need to animate in real-time (e.g., flowing water effect). For static flow field distortion of stroke paths, CPU is correct because distortion happens during stroke recording, not rendering. |
| Per-layer velocity blur (Strategy A) | Full-frame velocity buffer (Strategy B) | If the app grows to 20+ animated layers per sequence and per-layer blur becomes a bottleneck. Strategy B is one shader pass for the whole frame but requires a velocity buffer render target. Start with A, measure, migrate to B only if needed. |
| Canvas 2D watercolor layers | WebGL2 watercolor | If the 20-30 layer compositing becomes too slow at high resolutions (4K+). Canvas 2D `globalAlpha` compositing is sufficient for the target resolution range (720p-2K). WebGL2 watercolor would require a fundamentally different approach (texture-based rather than polygon-based). |

---

## Integration Map: How New Stack Fits Existing Pipeline

```
Existing Pipeline (unchanged):
  PaintStroke.points[] --> perfect-freehand --> Path2D --> ctx.fill()  [flat brush]

New Paint FX Pipeline (brushStyle !== 'flat'):
  PaintStroke.points[] --> simplex-noise flow field deflection (during recording)
       |
       v
  WebGL2 offscreen renderer (shared context, FBO-based):
       |
       +--> Point-stamp geometry (GL_POINTS with soft falloff texture)
       +--> spectral.glsl color mixing (Kubelka-Munk fragment shader)
       +--> Edge darkening post-pass (simple alpha threshold shader)
       +--> Grain/texture post-pass (stochastic erosion)
       |
       v
  Blit to paint layer Canvas 2D --> standard compositing pipeline

New Watercolor Pipeline (brushStyle === 'watercolor'):
  PaintStroke.points[] --> perfect-freehand outline polygon
       |
       v
  Tyler Hobbs polygon deformation (CPU, ~7 iterations)
       |
       v
  Canvas 2D: 20-30 overlapping semi-transparent layers
       |
       +--> Stochastic erosion passes (destination-out circles)
       |
       v
  Paint layer Canvas 2D --> standard compositing pipeline

New Motion Blur Pipeline:
  PreviewRenderer.renderFrame() per-layer:
       |
       v
  computeLayerVelocity(current, previous interpolated values)
       |
       +--> velocity below threshold? --> skip, use original canvas
       +--> velocity above threshold? --> glMotionBlur.ts
            |
            +--> Upload layer canvas as texture
            +--> Run directional blur fragment shader (uVelocity, uStrength, uSamples)
            +--> Blit blurred result back to Canvas 2D
            |
            v
  Composite blurred layer to main canvas (existing blend mode pipeline)

  Export path adds sub-frame accumulation wrapper:
    for i in 0..N:
      renderGlobalFrame(frame + i/N) with per-layer motion blur
      accumulate with globalAlpha = 1/N
```

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| spectral.js@^3.0.0 | Vite 5 ESM bundling | Published as ES module with `spectral.js` entry. The GLSL file must be imported as a raw string via Vite's `?raw` import suffix or copied to a string constant. |
| simplex-noise@^4.0.3 | Vite 5 ESM bundling, TypeScript ~5.9 | Full ESM, tree-shakeable. Only `createNoise2D` will be imported. |
| spectral.js@^3.0.0 | WebGL2 (GLSL ES 300) | The `shader/spectral.glsl` uses standard GLSL functions compatible with `#version 300 es`. Verified: no GLSL extensions or compute shader features required. |

---

## WebGL2 Context Management Plan

Current contexts:
1. `glBlur.ts` -- shared context for Gaussian blur
2. `glslRuntime.ts` -- shared context for shader effects + GL transitions

New contexts for v0.5.0:
3. `glMotionBlur.ts` -- shared context for velocity motion blur (follows glBlur.ts pattern)
4. `glBrushRenderer.ts` -- shared context for paint brush FX (spectral mixing + point stamping)

**Total: 4 contexts** -- well within Chrome's 16-context limit. Each context is lazy-initialized (only created when the feature is first used) and includes context-loss recovery handlers.

**Why not reuse existing contexts:** The `glBlur.ts` and `glslRuntime.ts` contexts have different lifecycle requirements (blur is per-frame, shaders are per-effect, brush rendering is per-stroke, motion blur is per-layer-per-frame). Sharing contexts would require complex state save/restore between unrelated render passes. Four independent contexts with clear ownership is cleaner and still only uses 25% of the budget.

---

## Sources

- [spectral.js GitHub](https://github.com/rvanwijnen/spectral.js) -- v3.0.0 verified, GLSL shader confirmed in `/shader/spectral.glsl`, MIT license -- HIGH confidence
- [spectral.js GLSL Shadertoy demo](https://www.shadertoy.com/view/33XSWl) -- Demonstrates spectral_mix() function in real-time fragment shader -- HIGH confidence
- [simplex-noise.js GitHub](https://github.com/jwagner/simplex-noise.js) -- v4.0.3 verified, TypeScript, ESM, tree-shakeable -- HIGH confidence
- [Tyler Hobbs watercolor essay](https://tylerxhobbs.com/essays/2017/a-generative-approach-to-simulating-watercolor-paints) -- Polygon deformation algorithm reference -- HIGH confidence
- [John Chapman motion blur](http://john-chapman-graphics.blogspot.com/2013/01/per-object-motion-blur.html) -- Per-object GLSL velocity blur technique -- HIGH confidence
- [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) -- Context limit documentation -- HIGH confidence
- [Chrome WebGL context limit](https://issues.chromium.org/issues/40543269) -- 16-context limit per renderer process -- MEDIUM confidence (may vary by Chrome version)
- Existing codebase: `glBlur.ts`, `glslRuntime.ts`, `paintRenderer.ts`, `previewRenderer.ts`, `exportRenderer.ts` -- verified integration points -- HIGH confidence

---
*Stack research for: v0.5.0 Paint Brush FX and Motion Blur*
*Researched: 2026-03-25*
