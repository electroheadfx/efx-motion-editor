# Pitfalls Research

**Domain:** v0.5.0 Paint Brush FX (spectral pigment mixing, watercolor sim, flow fields) and Motion Blur (GLSL velocity blur, sub-frame accumulation) for desktop stop-motion cinematic editor (Tauri 2.0 + Preact Signals + Canvas 2D + multiple WebGL2 contexts)
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH
**Focus:** Common mistakes when adding WebGL2-based expressive paint rendering and GLSL motion blur to an existing pipeline that already has two separate WebGL2 contexts (glBlur.ts and glslRuntime.ts), Canvas 2D PreviewRenderer compositing, and FFmpeg export with yielding frame loop

## Critical Pitfalls

### Pitfall 1: WebGL2 Context Exhaustion -- Four Independent Contexts Hitting Browser Limits

**What goes wrong:**
The codebase currently creates two independent WebGL2 contexts: one in `glBlur.ts` (GPU Gaussian blur) and one in `glslRuntime.ts` (GLSL shader effects + GL transitions). Adding paint brush FX requires a third context (spectral mixing offscreen renderer), and `glMotionBlur.ts` would be a fourth. Browsers enforce hard limits on simultaneous WebGL contexts: Chromium caps at ~16 active contexts (often fewer on resource-constrained machines), Safari/WKWebView on macOS is more conservative. When the limit is hit, the browser silently destroys the oldest context via `webglcontextlost`. Because `glBlur.ts` and `glslRuntime.ts` each have `webglcontextlost` handlers that null their cached state, a new paint FX context creation could destroy the blur context mid-render. The result: the GPU blur silently fails, falls back to CPU StackBlur (which exists as a fallback), but GLSL shader effects have no fallback -- they just return null and the effects disappear. Users see shader effects vanish intermittently with no error in the console beyond the warning.

**Why it happens:**
Each module (`glBlur.ts`, `glslRuntime.ts`) independently lazy-initializes its own `document.createElement('canvas').getContext('webgl2')`. This is the natural pattern when modules are developed independently -- each owns its context lifecycle. With two contexts this works fine. Adding a third and fourth pushes closer to limits, especially because Tauri's WKWebView on macOS shares WebGL context limits with the system compositor. The risk increases during export when all contexts may be active simultaneously: glBlur for per-layer blur, glslRuntime for shader FX/transitions, glMotionBlur for velocity blur, and paintFxRenderer for spectral mixing of brush strokes.

**How to avoid:**
- **Consolidate into a shared WebGL2 context pool.** Create a single `glContextManager.ts` that owns one (or at most two) WebGL2 contexts and lends them to consumers. The key insight: `glBlur`, `glslRuntime`, `glMotionBlur`, and paint FX never render simultaneously within a single frame -- they execute sequentially in the compositing pipeline. A single context can be time-shared with program switching.
- **If consolidation is too invasive for Phase 1**, at minimum reuse the `glslRuntime` context for `glMotionBlur` since both are fragment-shader-on-fullscreen-quad operations. The motion blur shader is just another cached program in the same pattern. This reduces from 4 contexts to 3.
- **Never create a WebGL2 context per paint layer.** The spec says "Offscreen WebGL2 context per paint layer (created on demand)" -- this must be one shared context with FBO per-layer targets, not N contexts. Even 3 paint layers would mean 3 + 2 existing = 5 contexts.
- **Register `webglcontextlost` on all contexts and propagate recovery.** The existing handlers null cached state but never re-initialize. Add a `webglcontextrestored` handler that re-creates resources when the browser restores the context.
- **Call `WEBGL_lose_context.loseContext()` eagerly** when a context is no longer needed (e.g., after export completes, release the export-only motion blur context).

**Warning signs:**
- Console message: "WARNING: Too many active WebGL contexts. Oldest context will be lost."
- GLSL shader effects randomly stop rendering during preview while paint layer is active
- GPU blur silently falls back to CPU (check `applyGPUBlur` return value in DevTools)
- Export produces frames with missing shader effects that preview showed correctly

**Phase to address:**
Phase 1 (WebGL2 offscreen renderer setup) -- must decide on shared vs. separate context architecture before writing any new GL code. This is the single most impactful architectural decision for the milestone.

---

### Pitfall 2: Canvas 2D to WebGL2 Texture Upload Stalls in the Compositing Pipeline

**What goes wrong:**
The paint brush FX pipeline requires a round-trip: Canvas 2D paint strokes rendered flat via `perfect-freehand` -> upload to WebGL2 texture via `texImage2D` -> run spectral mixing shader -> read back via `drawImage(glCanvas)` to Canvas 2D for compositing. Each `texImage2D(canvas)` call is a CPU-GPU synchronization point. In Chromium, this is fast (~1-2ms) because Chrome optimizes canvas-to-texture uploads by reusing GPU textures. But in WebKit/WKWebView (Tauri's renderer on macOS), the Firefox-class behavior applies: `texImage2D` from a Canvas 2D source can take 10-40ms per call because it reads back pixel data from the 2D canvas GPU surface, converts colorspace, and re-uploads. At 24fps with 3 paint layers using FX brushes, that is 3 x 40ms = 120ms per frame -- the entire frame budget is consumed by texture uploads alone.

**Why it happens:**
Canvas 2D and WebGL2 operate on different GPU command queues in most browser implementations. When `texImage2D` receives a canvas as source, the browser must: (1) flush the Canvas 2D command queue to ensure all pending draws are committed, (2) read the pixel data back to CPU, (3) convert from premultiplied alpha (Canvas 2D default) to straight alpha (WebGL2 with `premultipliedAlpha: false`), and (4) upload to the GL texture. Steps 2-3 are the bottleneck. The existing `glBlur.ts` and `glslRuntime.ts` do this same upload but only once per frame (not per layer). The paint FX pipeline potentially does it per stroke batch per paint layer per frame.

**How to avoid:**
- **Render paint strokes directly in WebGL2** instead of the Canvas 2D -> upload -> shader -> readback path. For FX brush styles, skip `perfect-freehand` + `Path2D` + `ctx.fill()` entirely. Instead, upload stroke point data as vertex attributes/SSBO and render directly via GL_POINTS with soft-falloff fragment shader. This eliminates the expensive round-trip.
- **Batch all flat strokes on Canvas 2D, then upload once per paint layer per frame.** Never upload after each individual stroke -- accumulate all strokes to the offscreen canvas, then do a single `texImage2D` of the complete layer.
- **Use `texSubImage2D` with pre-allocated `texStorage2D`** (already the pattern in `glBlur.ts`) instead of `texImage2D` which may reallocate on every call. Pre-allocate the texture at project resolution once.
- **Profile specifically on WKWebView.** Chrome DevTools shows fast uploads; the real-world Tauri performance on macOS may be 10-20x worse. Test with Safari Web Inspector's Timeline to measure actual texture upload cost.
- **Consider `ImageBitmap` as an intermediate.** `createImageBitmap(canvas)` returns a promise that decouples the readback from the upload, potentially allowing the browser to keep the data on GPU. Then `texImage2D(imageBitmap)` can be faster than `texImage2D(canvas)`.

**Warning signs:**
- Paint layers with FX brushes cause visible frame drops (fps counter drops below 15)
- DevTools Performance panel shows long `texImage2D` calls in the rendering waterfall
- Preview playback stutters only when FX-styled paint strokes are visible
- Export takes 5-10x longer per frame when paint FX layers are present

**Phase to address:**
Phase 2 (WebGL2 offscreen renderer with basic point stamping) -- the upload strategy must be decided here. Rendering strokes directly in WebGL2 vs. Canvas-to-WebGL upload is a fork in the road that cannot be changed later without rewriting the paint FX renderer.

---

### Pitfall 3: Spectral Pigment Mixing Precision Collapse in mediump / 16-bit Float

**What goes wrong:**
The Kubelka-Munk spectral mixing algorithm operates on 38 spectral reflectance bands and computes absorption (K) and scattering (S) coefficients. These coefficients involve division, exponentiation, and small differences between nearly-equal values. The spectral.js JavaScript implementation uses 64-bit `Float64` throughout. When ported to GLSL, if the shader uses `precision mediump float` (16-bit), the limited mantissa (10 bits) causes catastrophic cancellation in the K/S ratio computation. The result: certain color combinations produce unexpected greys or blacks instead of the expected mixed color. Blue + yellow should yield green via subtractive mixing; with mediump precision, it yields muddy dark grey because the spectral coefficients lose their distinguishing information.

**Why it happens:**
WebGL2 guarantees `highp float` in fragment shaders (32-bit, IEEE 754 single-precision), but developers sometimes use `mediump` for "performance" or copy shader boilerplate from tutorials that default to it. Even with `highp`, 32-bit float (23-bit mantissa) is significantly less precise than the 64-bit used in the JS reference implementation. The 38-band spectral computation involves accumulated products and sums where intermediate values can span 6+ orders of magnitude (e.g., 0.00001 to 100.0). At `mediump`, values below ~0.001 are flushed to zero. The Kubelka-Munk K/S ratio `(1-R)^2 / (2*R)` is numerically unstable when R approaches 0 or 1 (pure absorption or pure scattering), producing division-by-near-zero or 0/0 results.

**How to avoid:**
- **Always use `precision highp float`** in the spectral mixing shader. The existing codebase already uses this in `glBlur.ts` and `glslRuntime.ts` -- keep this consistent.
- **Add numerical guards** to the K/S ratio computation: clamp reflectance R to `[0.001, 0.999]` before computing `(1-R)^2 / (2*R)`. This prevents division by zero and limits the dynamic range.
- **Consider using Mixbox instead of raw Kubelka-Munk.** Mixbox is a LUT-based pigment mixing library that pre-computes the spectral math into a 256x256 lookup texture. The GLSL version (`mixbox.glsl`) replaces the 38-band computation with 3 texture lookups + linear algebra. This is both faster (no iterative spectral loop) and more numerically stable (the LUT stores pre-computed results at full precision). Mixbox supports GLSL natively and handles the sRGB <-> spectral conversion internally.
- **If using spectral.js GLSL port (spectral.glsl)**, verify it supports mixing 2-4 colors (confirmed in the README) and test edge cases: complementary colors (red+green), high-saturation mixing, near-white and near-black inputs.
- **Unit test the GLSL shader by rendering known color pairs and comparing RGB output** against the JavaScript reference implementation. Accept tolerance of ~1/255 (8-bit output) but flag deviations > 5/255.

**Warning signs:**
- Color mixing produces unexpected greys for complementary color pairs
- Mixed colors are consistently darker or less saturated than the JS reference
- Shader output varies between devices (integrated vs. discrete GPU) due to different `highp` implementations
- Mixing white + any color does not produce a lighter tint

**Phase to address:**
Phase 3 (Spectral color mixing shader) -- precision must be validated before building watercolor bleed and flow fields on top of it. If the base mixing is wrong, all subsequent effects compound the error.

---

### Pitfall 4: Sub-Frame Accumulation Alpha Compositing Produces Dark Fringing and Ghosting

**What goes wrong:**
The motion blur export pipeline renders N sub-frames (4-8) at fractional positions and blends them with `accumCtx.globalAlpha = 1.0 / subFrames`. This additive accumulation approach assumes straight (non-premultiplied) alpha throughout. But Canvas 2D uses premultiplied alpha internally. When a semi-transparent layer (e.g., paint strokes at 70% opacity, or a content layer with per-layer opacity < 1.0) is accumulated across sub-frames, the premultiplied RGB values are divided by alpha during composition, then re-multiplied. This double-premultiplication creates dark fringes at semi-transparent edges -- exactly where motion blur is most visible. The artifact appears as a dark halo around moving objects, most noticeable against light backgrounds.

**Why it happens:**
Canvas 2D's `drawImage` composites using premultiplied alpha. When you draw a semi-transparent image (alpha = 0.7) with `globalAlpha = 0.125` (1/8 sub-frames), the effective alpha per pixel is `0.7 * 0.125 = 0.0875`. The RGB values are multiplied by this tiny alpha before storage. When 8 such draws accumulate, the math should reconstruct the original: `8 * (R * 0.0875) / (8 * 0.0875) = R`. But Canvas 2D's premultiplied storage clips values and quantizes to 8-bit, so each sub-frame loses precision. After 8 rounds of quantization, the accumulated result is darker than the original. The error is worst at edges where alpha transitions from 0 to 1 (the motion trail).

**How to avoid:**
- **Accumulate in WebGL2 with floating-point framebuffers**, not Canvas 2D. Create an FBO with `gl.RGBA16F` or `gl.RGBA32F` color attachment (requires `EXT_color_buffer_float` extension, supported on all macOS WebGL2 implementations). Accumulate sub-frames into the float FBO. The 16-bit half-float has enough precision to accumulate 32 sub-frames without visible quantization. Then do a single readback to Canvas 2D for final compositing.
- **If staying with Canvas 2D accumulation**, render each sub-frame at full opacity (no `globalAlpha`) and use a two-pass approach: (1) render sub-frame to an intermediate canvas, (2) use WebGL2 to blend intermediate into the accumulation buffer with proper float-precision weighting.
- **Always test motion blur on semi-transparent layers**, not just fully opaque content. The spec's code example uses `accumCtx.globalAlpha = 1.0 / subFrames` which is correct mathematically but produces dark fringing due to 8-bit quantization.
- **Use `source-over` compositing (default) for accumulation, never `lighter` (additive).** Additive mode doubles the problem because it adds premultiplied values without alpha correction. The spec's example correctly does not specify a composite operation, which defaults to `source-over`.

**Warning signs:**
- Moving objects in exported frames have dark outlines or halos
- Motion-blurred areas appear slightly darker than non-blurred areas
- The artifact is more visible with higher sub-frame counts (counterintuitively worse quality with more sub-frames)
- Semi-transparent paint strokes produce noticeably different colors in motion-blurred vs. non-blurred frames

**Phase to address:**
Phase 3 (Export sub-frame accumulation) -- this must be addressed when building the accumulation buffer, before the combined GLSL + sub-frame pipeline. If the base accumulation is wrong, adding GLSL velocity blur on top will mask but not fix the artifacts.

---

### Pitfall 5: Shared WebGL2 State Corruption Between glBlur, glslRuntime, glMotionBlur, and Paint FX

**What goes wrong:**
When multiple shader systems share a WebGL2 context (the recommended fix for Pitfall 1), state leaks between consumers corrupt rendering. WebGL2 is a stateful API: the active program, bound textures, bound framebuffer, viewport, blend mode, active texture unit, and pixel store parameters persist between calls. If `glMotionBlur` runs after `glslRuntime` and fails to reset `UNPACK_FLIP_Y_WEBGL`, the motion blur texture upload is flipped. If the paint FX shader enables blending (`gl.enable(gl.BLEND)`) and does not disable it, the subsequent `glBlur` pass produces incorrect results because blur ping-pong rendering should not blend. The existing code already has this risk: `glslRuntime.ts` sets `UNPACK_FLIP_Y_WEBGL = true` then resets it, but if an exception occurs between set and reset, the state leaks.

**Why it happens:**
Each module assumes it is the sole user of its GL context. With separate contexts, this assumption holds -- each context has independent state. With a shared context, every module must either (a) fully save and restore GL state or (b) never assume state is in any particular default. The existing modules use a mix: they set specific state before use but rely on defaults for everything they don't touch. For example, `glBlur.ts` never calls `gl.disable(gl.BLEND)` because blending is disabled by default -- but after `paintFxRenderer` enables it, the default assumption is broken.

**How to avoid:**
- **Establish a "clean state contract" for the shared context.** Before each consumer uses the context, reset a minimal set of critical state: `gl.useProgram(null)`, `gl.bindFramebuffer(gl.FRAMEBUFFER, null)`, `gl.bindVertexArray(null)`, `gl.activeTexture(gl.TEXTURE0)`, `gl.disable(gl.BLEND)`, `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)`, `gl.viewport(0, 0, canvas.width, canvas.height)`. Put this in a `resetGLState()` utility called at the entry point of each consumer.
- **Alternatively, if contexts remain separate**, at minimum audit the two existing contexts and the two new ones for state leakage at handoff points. Document which GL state each module touches in a comment header.
- **Never use `try/catch` blocks that skip GL state cleanup.** If `texImage2D` or `drawArrays` throws (e.g., due to context loss), the state is left dirty. Use `try/finally` for any state that was modified.
- **Do not share VAOs between shader programs.** Even though all four modules use the same fullscreen quad geometry, create separate VAO handles per program. VAO state includes attribute bindings that may differ between programs.

**Warning signs:**
- Textures appear vertically flipped in some effects but not others
- Blur appears to "add" brightness or color (blending enabled when it should not be)
- Shader effects work in isolation but produce wrong results when paint FX or motion blur is also active
- Random visual glitches that disappear when disabling one of the WebGL2 consumers

**Phase to address:**
Phase 1 (WebGL2 infrastructure) -- establish the state management contract before any new shaders are written. If each module is written assuming private state and then consolidated later, every module must be audited and patched.

---

### Pitfall 6: Paint FX Offscreen Canvas Allocation Per-Frame Creates Memory Pressure and GC Pauses

**What goes wrong:**
The current `previewRenderer.ts` paint layer rendering creates a new `document.createElement('canvas')` on every frame for every paint layer (lines 287-291 in the paint branch of `renderFrame`). This is already a performance issue for flat paint rendering, but FX paint rendering compounds it: each frame now also needs a WebGL2 framebuffer-backed offscreen canvas for the spectral mixing pass. If the project has 2 paint layers with FX brushes at 1920x1080, each frame allocates 2 Canvas 2D offscreens (16MB each at RGBA 8-bit) + 2 GL framebuffer textures (16MB each). That is 64MB allocated and immediately garbage-collected per frame. At 24fps, the browser's GC must reclaim ~1.5GB/sec of canvas memory. The GC pauses cause visible playback stutter (dropped frames every 2-3 seconds).

**Why it happens:**
The pattern `const off = document.createElement('canvas'); off.width = projW; off.height = projH;` inside the render loop is a convenience pattern that works for low-frequency rendering but breaks at real-time frame rates. The existing blur path (`getBlurOffscreen`) correctly reuses a cached offscreen canvas, but the paint path does not. This inconsistency suggests the paint rendering was added quickly without applying the same optimization pattern. Adding FX rendering on top of this leak multiplies the allocation rate.

**How to avoid:**
- **Pool and reuse offscreen canvases.** Create a `CanvasPool` utility that maintains a small number of pre-allocated canvases at common dimensions. `acquire(width, height)` returns a cached canvas (clearing it first), `release(canvas)` returns it to the pool.
- **For the immediate fix before v0.5.0 FX work**, refactor the paint rendering path to use a single cached offscreen canvas per paint layer, stored as a class field on `PreviewRenderer` (following the `blurOffscreen` pattern already used for blur).
- **For WebGL2 FBO textures**, pre-allocate at project resolution using `texStorage2D` (immutable allocation) and reuse across frames. Never call `texImage2D` to reallocate -- only `texSubImage2D` to update content.
- **Monitor GPU memory in Activity Monitor** (macOS) during playback. Canvas GPU memory leaks are invisible to JavaScript heap profiling -- they appear only in GPU Process memory. A steadily increasing GPU memory graph indicates canvases are being allocated but not freed.

**Warning signs:**
- GC pauses visible in Performance panel as periodic spikes every 2-3 seconds
- GPU Process memory in Activity Monitor climbs steadily during playback
- Playback smooth for first 5 seconds, then periodic stutters at regular intervals
- `document.createElement('canvas')` appears in hot path in CPU profiler

**Phase to address:**
Phase 2 (WebGL2 offscreen renderer) -- fix the existing per-frame canvas allocation in the paint rendering path before adding FX rendering on top. This is a prerequisite optimization, not a nice-to-have.

---

### Pitfall 7: GLSL Velocity Blur Samples Outside Layer Bounds Produce Edge Bleeding

**What goes wrong:**
The motion blur shader samples along the velocity direction: `sampleUV = vUV + velocity * t` for t in [-0.5, +0.5]. When a layer is smaller than the canvas (a positioned content overlay or a paint layer with strokes only in one area), samples at the extremes of the velocity vector read pixels outside the layer content -- which are transparent black (0,0,0,0) in the layer's offscreen texture. These transparent samples get averaged into the motion trail, causing the blur to fade toward black at the edges instead of cleanly streaking the layer content. The effect looks like a dark vignette around moving layers.

**Why it happens:**
The spec's shader uses `clamp(sampleUV, vec2(0.0), vec2(1.0))` which clamps to the texture bounds. But clamping to the edge means edge pixels are repeated. For a layer that only occupies the center 50% of the canvas, the outer 50% is transparent black. Sampling into the transparent region and averaging produces `(content_color * 0.5 + transparent_black * 0.5)` = darkened, semi-transparent result. This is technically correct for the shader but visually wrong for the compositing use case, where the layer's transparent regions should be excluded from the blur.

**How to avoid:**
- **Apply motion blur to the layer content only, at the layer's native bounds, not at canvas resolution.** If a content overlay is 500x300 positioned at (200, 100), render the layer to a 500x300 offscreen, apply motion blur to that 500x300 texture, then composite the blurred result at (200-dx, 100-dy) to (200+dx, 100+dy) on the main canvas with appropriate padding for the blur extent.
- **Extend the layer offscreen by the blur radius on all sides.** If max velocity is 50px, create a (500+100) x (300+100) offscreen, render the layer at (50, 50), apply blur, then composite with offset adjustment. This provides the shader with non-transparent pixels to sample into.
- **Use the velocity magnitude to scale the offscreen extension dynamically.** No velocity = no extension needed. Large velocity = large extension. This avoids wasting memory on static layers.
- **In the shader, add an alpha-weighted accumulation**: weight each sample by its alpha value so transparent samples do not dilute the result: `totalWeight += weight * sample.a;` instead of `totalWeight += weight;`. This is a simple shader change with large visual improvement.

**Warning signs:**
- Moving layers have dark fringes in the direction of motion
- Small layers (icons, text overlays) become visibly darker when motion blur is active
- Blur strength appears to vary depending on layer size relative to canvas
- Paint strokes that do not fill the entire canvas appear to "shrink" during motion

**Phase to address:**
Phase 2 (Preview integration of GLSL motion blur) -- the per-layer blur application strategy must account for layer bounds from the start. Retrofitting bounds-aware blur onto a canvas-resolution-only implementation requires changing the offscreen allocation and shader uniform setup.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| One WebGL2 context per module | Simpler module isolation, no state sharing bugs | Context exhaustion at 4+ contexts, context loss cascades | Never for this codebase -- already at 2, adding 2 more crosses the risk threshold |
| `document.createElement('canvas')` in render loop for paint offscreen | Simple, no caching logic | 64MB+ GC churn per frame per layer, playback stutters | Never -- the blur path already demonstrates the caching pattern |
| `texImage2D(canvas)` per paint layer per frame | Simple upload path | 10-40ms stall per upload on WKWebView, cumulative | Only acceptable for single-layer, low-resolution projects; not the general case |
| `mediump` in spectral shader for "performance" | Marginal GPU perf gain on mobile (irrelevant for desktop macOS) | Precision collapse in K/S computation, wrong colors | Never -- macOS GPUs process highp at same speed as mediump |
| Canvas 2D accumulation for sub-frame motion blur | No WebGL dependency for export path | 8-bit quantization dark fringing on semi-transparent content | Acceptable only for fully opaque content layers; not for paint layers with per-stroke opacity |
| Hardcoded 8 sub-frames in export | Simple, no user configuration needed | Too few for fast motion (visible stepping), too many for slow motion (wasted render time) | Only in initial prototype; must expose as user setting before shipping |

## Integration Gotchas

Common mistakes when connecting the new systems to the existing pipeline.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Paint FX -> PreviewRenderer compositing | Drawing WebGL canvas to Canvas 2D without matching premultipliedAlpha setting | Ensure glCanvas was created with `premultipliedAlpha: false` (matching existing pattern in glBlur.ts) and use `globalCompositeOperation: 'source-over'` for compositing |
| Motion blur -> exportRenderer sub-frame loop | Calling `interpolateLayers()` with integer frame numbers for sub-frames | Use fractional frame numbers (e.g., 5.25, 5.5, 5.75) -- the keyframe engine's `interpolateAt()` already supports this |
| glMotionBlur -> per-layer offscreen canvas | Applying motion blur after the layer is composited onto main canvas | Apply motion blur to each layer's offscreen canvas before compositing to main canvas (Strategy A in spec) -- after compositing, per-layer velocity information is lost |
| Paint FX flat vs. styled dispatch | Running all strokes through WebGL2 path even when brushStyle is 'flat' | Check brushStyle first; flat strokes must continue through Canvas 2D `perfect-freehand` path for zero regression. Only non-flat strokes enter the WebGL2 pipeline |
| Spectral mixing -> sRGB output | Assuming shader output is sRGB-ready | Kubelka-Munk operates in linear-light spectral space. The shader must apply sRGB gamma encoding (`pow(color, vec3(1.0/2.2))` or precise sRGB transfer function) before writing to the framebuffer, or configure the framebuffer as sRGB with `gl.SRGB8_ALPHA8` internal format |
| Velocity computation across sequence boundaries | Computing velocity delta when previous frame is in a different sequence | Reset velocity to zero at sequence boundaries -- there is no meaningful velocity between the last frame of one sequence and the first frame of the next |
| Motion blur toggle in preview vs. export | Using same sample count for preview and export | Preview should use 4-8 samples for performance; export should use 8-16 samples for quality. The spec correctly distinguishes these but the implementation must carry the `isExport` flag through to the shader uniform |

## Performance Traps

Patterns that work at small scale but fail as resolution or layer count grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-stroke WebGL2 shader dispatch | Each brush stroke triggers a separate draw call with uniform setup | Batch all strokes into a single vertex buffer and render in one draw call per frame | > 50 strokes per frame (typical for a detailed painting) |
| Full-resolution spectral mixing for every paint element | Rendering 38-band spectral computation at 1920x1080 for each stroke | Render paint to a smaller canvas and upscale, or compute spectral mixing only at overlap regions | > 3 overlapping FX strokes at 4K resolution |
| Watercolor bleed polygon deformation on CPU | Tyler Hobbs algorithm displaces polygon vertices per-frame in JavaScript | Pre-compute bleed geometry and cache per paint element -- bleed is deterministic given the stroke data | > 5 watercolor strokes with 20 overlapping layers each |
| Sub-frame accumulation re-renders entire compositing pipeline N times | N=8 sub-frames means 8 full renders of all sequences, all layers, all FX | Only re-render layers that actually have non-zero velocity. Static layers can be rendered once and composited into all sub-frames | > 4 layers with motion, N > 4 sub-frames, at > 1080p resolution |
| Motion blur velocity computation iterates all keyframes every frame | `computeLayerVelocity` calls `interpolateAt` twice (current + previous frame) per layer per frame | Cache previous frame's interpolated values -- they are the current frame's "previous" values on the next frame | > 10 animated layers with dense keyframes |
| Re-uploading paint stroke data to GPU every preview frame | The paint data has not changed between frames (user is not actively drawing) | Track paint version (already exists: `paintVersion` signal) and skip re-render if unchanged for the current frame | Any project with paint layers during playback |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Motion blur enabled by default in preview | Preview drops below 15fps on integrated GPUs, user thinks the app is slow | Disable motion blur in preview by default; add explicit toggle in toolbar. Show blur only when user opts in |
| No visual feedback during sub-frame export | Export with 8 sub-frames takes 8x longer but progress bar shows same frame count | Show "Rendering frame 42/100 (sub-frame 3/8)" in export progress. Multiply ETA by sub-frame count |
| Brush style selector with no preview | User picks "watercolor" but cannot see what it looks like until they draw | Show small stroke preview swatch per brush style in the picker, rendered at low resolution |
| Shutter angle control without visual reference | "180 degrees" is meaningless to non-cinematographers | Show a small circular diagram or tooltip: "180 = standard film motion blur, 360 = maximum blur, 90 = sharp/stroboscopic" |
| Motion blur applied to text/UI overlay layers | Text becomes unreadable when it moves | Provide per-layer motion blur override (future phase in spec) but default motion blur OFF for layers named "title" or "text" |
| Paint brush FX has no undo granularity | User draws 5 FX strokes, wants to undo the last one, but FX rendering batches make undo unclear | Each stroke must remain a separate undo-able operation regardless of FX rendering batching. The existing pushAction per-stroke pattern must be preserved |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Spectral mixing shader:** Often missing sRGB gamma encoding on output -- verify mixed colors match the JavaScript reference when viewed on screen, not just in raw RGB values
- [ ] **Motion blur velocity:** Often missing rotation and scale velocity components -- verify a purely rotating layer gets directional blur, not just translating layers
- [ ] **Sub-frame accumulation:** Often missing fractional keyframe interpolation testing -- verify sub-frame positions 5.25, 5.5, 5.75 produce different interpolated transforms (not just snapping to frame 5)
- [ ] **Paint FX export:** Often missing paint data pre-loading before export starts -- verify `paintStore.getFrame()` returns data for all frames during export, not just the currently visible frame
- [ ] **Context loss recovery:** Often missing the `webglcontextrestored` handler -- verify all four WebGL2 consumers recover after `WEBGL_lose_context` is triggered (can be tested manually)
- [ ] **Motion blur on paint layers:** Often missing -- paint layers have transform keyframes too. Verify motion blur applies to animated paint layers, not just content/overlay layers
- [ ] **Flow field determinism:** Often missing seeded randomness -- verify flow field distortion produces identical output for the same stroke data across preview and export renders
- [ ] **Premultiplied alpha consistency:** Often missing between Canvas 2D (`premultiplied: true` default) and WebGL2 (`premultipliedAlpha: false` in codebase) -- verify no dark fringing at layer edges after round-trip

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Context exhaustion (4+ WebGL2 contexts) | MEDIUM | Consolidate to shared context manager. Requires modifying glBlur.ts, glslRuntime.ts, and new modules. All use the same lazy-init + cached resources pattern, so refactoring is mechanical. ~1 day of work. |
| Texture upload stalls | HIGH | Requires rewriting paint FX renderer from Canvas-to-GL upload to direct WebGL2 stroke rendering. Significant architectural change affecting data flow. ~2-3 days. |
| Spectral precision collapse | LOW | Change `mediump` to `highp`, add clamping guards. Shader-only change, no pipeline impact. ~1 hour. If using Mixbox LUT, swap spectral.glsl for mixbox.glsl. ~4 hours. |
| Sub-frame dark fringing | MEDIUM | Switch accumulation buffer from Canvas 2D to WebGL2 float FBO. Requires modifying exportRenderer.ts accumulation logic. ~1 day. |
| GL state corruption | MEDIUM | Add `resetGLState()` calls at each consumer entry point. Mechanical addition to 4 modules. ~2 hours. Audit takes longer (~4 hours) to verify all state touched. |
| Per-frame canvas allocation | LOW | Replace `createElement` with cached canvas, following existing `getBlurOffscreen` pattern. ~2 hours per module. |
| Motion blur edge bleeding | MEDIUM | Modify offscreen allocation to include blur padding and adjust composite position. Requires changes to previewRenderer layer rendering and shader UV setup. ~1 day. |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Context exhaustion | Phase 1: WebGL2 infrastructure setup | Count active WebGL2 contexts with `performance.getEntries()` or manual tracking; verify <= 2 at any point during combined preview + paint |
| Texture upload stalls | Phase 2: WebGL2 offscreen renderer | Profile `texImage2D` duration on macOS WKWebView; verify < 2ms per call at 1080p |
| Spectral precision | Phase 3: Spectral color mixing shader | Render 10 known color pairs; compare RGB against JS reference; max deviation < 3/255 per channel |
| Sub-frame dark fringing | Phase 3: Sub-frame accumulation export | Export frame with 50% opacity paint layer at 8 sub-frames; verify no visible dark halo in exported PNG |
| GL state corruption | Phase 1: WebGL2 infrastructure setup | Run all four WebGL2 consumers in sequence on same context; verify output matches isolated-context reference |
| Per-frame canvas allocation | Phase 2: WebGL2 offscreen renderer (prerequisite fix) | Profile GC pressure during 10-second playback with 2 paint layers; verify < 10MB/sec allocation rate |
| Motion blur edge bleeding | Phase 2: GLSL velocity blur preview | Apply motion blur to 300x200 overlay layer moving at 50px/frame; verify no dark fringe in blurred output |

## Sources

- [MDN WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) -- authoritative guidance on context management, state, texture uploads, resource cleanup
- [Chromium Issue #16118: Too many active WebGL contexts](https://github.com/openlayers/openlayers/issues/16118) -- real-world context limit behavior
- [Bugzilla #1246410: Slow canvas-to-WebGL texImage2D](https://bugzilla.mozilla.org/show_bug.cgi?id=1246410) -- Firefox/WebKit texture upload performance
- [Bugzilla #729385: Canvas to WebGL texture copies are slow](https://bugzilla.mozilla.org/show_bug.cgi?id=729385) -- cross-browser texture upload cost
- [Greggman/virtual-webgl](https://github.com/greggman/virtual-webgl) -- context virtualization approach for multi-context apps
- [spectral.js (rvanwijnen)](https://github.com/rvanwijnen/spectral.js) -- Kubelka-Munk reference implementation, 64-bit precision requirement
- [Mixbox (scrtwpns)](https://github.com/scrtwpns/mixbox) -- LUT-based pigment mixing alternative with native GLSL support
- [STVND/davis-pigment-mixing](https://github.com/STVND/davis-pigment-mixing) -- GLSL Kubelka-Munk implementation reference
- [p5.brush](https://github.com/acamposuribe/p5.brush) -- WebGL2 brush rendering library, spectral mixing integration patterns
- [John Chapman: Per-Object Motion Blur](http://john-chapman-graphics.blogspot.com/2013/01/per-object-motion-blur.html) -- per-layer velocity blur technique and edge artifacts
- [NVIDIA GPU Gems 3 Ch.27: Motion Blur as Post-Processing](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-27-motion-blur-post-processing-effect) -- velocity buffer approach, sample count guidance
- [Unity HDRP Accumulation](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@10.1/manual/Accumulation.html) -- sub-frame accumulation with proper alpha handling
- [Khronos WebGL Wiki: Handling Context Lost](https://www.khronos.org/webgl/wiki/HandlingContextLost) -- context loss recovery patterns
- [Tauri WebGL Context Lost Issue #6559](https://github.com/tauri-apps/tauri/issues/6559) -- Tauri-specific WebGL context issues in WKWebView
- [WebGL Precision Issues (webglfundamentals.org)](https://webglfundamentals.org/webgl/lessons/webgl-precision-issues.html) -- float precision in WebGL shaders
- Existing codebase: `glBlur.ts`, `glslRuntime.ts`, `previewRenderer.ts`, `paintRenderer.ts`, `exportRenderer.ts` -- current context management patterns and paint rendering pipeline

---
*Pitfalls research for: v0.5.0 Paint Brush FX + Motion Blur*
*Researched: 2026-03-25*
