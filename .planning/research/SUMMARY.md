# Project Research Summary

**Project:** efx-motion-editor v0.5.0 — Paint Brush FX and Motion Blur
**Domain:** WebGL2 expressive brush rendering + per-layer GLSL motion blur for desktop stop-motion animation editor
**Researched:** 2026-03-25
**Confidence:** HIGH (stack, architecture) / MEDIUM-HIGH (features, pitfalls)

## Executive Summary

v0.5.0 adds two independent feature tracks to an existing Tauri 2.0 + Preact + Canvas 2D pipeline: expressive paint brush FX (spectral pigment mixing, watercolor bleed, flow field distortion, grain/texture post-processing) and per-layer GLSL velocity motion blur with sub-frame accumulation for export. The recommended approach for brush FX is a new shared WebGL2 context (`glBrushFx.ts`) that renders non-flat strokes via GPU point-stamping with spectral.js Kubelka-Munk GLSL for physically-correct color mixing — bypassing the expensive Canvas 2D round-trip entirely. Motion blur follows the exact same lazy-init shared context pattern as the existing `glBlur.ts`, using a simple directional GLSL shader and fractional frame interpolation that the existing keyframe engine already supports.

The single most critical architectural constraint is the browser WebGL2 context budget (Chrome: ~16, WKWebView: more conservative). The app currently owns 2 contexts; v0.5.0 must stay at 3 by sharing a context between `glBlur.ts` and `glMotionBlur.ts` via a new `glSharedContext.ts` module. Both new features are largely independent of each other and can be built in parallel after shared infrastructure is established, which gives the roadmap a clean two-track structure. The two external additions are minimal: `spectral.js@^3.0.0` (MIT, ships `shader/spectral.glsl` for GPU Kubelka-Munk mixing) and `simplex-noise@^4.0.3` (CPU-side flow field computation). All watercolor and motion blur implementations are custom, using well-documented algorithms with no additional dependency footprint.

The primary risks are performance-related rather than algorithmic: Canvas-to-WebGL2 texture upload stalls in WKWebView (10-40ms per call vs 1-2ms in Chrome), per-frame offscreen canvas allocation causing GC pressure, and sub-frame accumulation dark fringing from 8-bit Canvas 2D quantization. All three have clear mitigations documented in the pitfalls research: render strokes directly in WebGL2 to skip the round-trip, pool and reuse offscreen canvases following the existing `getBlurOffscreen` pattern, and accumulate sub-frames in a float FBO rather than Canvas 2D. These must be addressed during infrastructure phases before building visual features on top.

## Key Findings

### Recommended Stack

The existing stack (Tauri 2.0, Preact, Preact Signals, Vite 5, Tailwind CSS v4, pnpm, perfect-freehand, WebGL2) is unchanged. Only two new npm dependencies are added for v0.5.0.

**Core technologies:**

- `spectral.js@^3.0.0`: Kubelka-Munk pigment mixing — ships `shader/spectral.glsl` (MIT), provides `spectral_mix()` for 2-4 color GPU blending; the GLSL file is the critical asset, embedded as a string constant via Vite `?raw` import
- `simplex-noise@^4.0.3`: Flow field noise generation — CPU-side computation during stroke recording; zero deps, TypeScript-native, seeded PRNG for deterministic export replay; only `createNoise2D` imported
- `glMotionBlur.ts` (custom): ~30-line GLSL directional blur shader following the `glBlur.ts` lazy-init pattern; no library needed
- `watercolorBleed.ts` (custom): Tyler Hobbs polygon deformation algorithm (~100 lines TypeScript); no library exists for this
- Sub-frame accumulation via existing `interpolateAt()` fractional frame support — no new APIs needed

**What not to add:** p5.js, Three.js, regl, GPU.js, glslify, Mixbox (commercial license). OffscreenCanvas-per-layer WebGL2 contexts are explicitly forbidden — they would exhaust the context budget within a single project.

### Expected Features

**Must have (v0.5.0 table stakes):**
- Brush style selector UI with visual previews — users expect this in any natural media tool
- Ink brush with clean confident strokes — most common animation workflow brush
- Charcoal brush with grainy texture — second most requested, demonstrates texture capability
- Physically-based color mixing on overlapping strokes — RGB additive blending (blue+yellow=gray) breaks immersion; spectral subtractive mixing (blue+yellow=green) is expected
- Flat brush remains default and unaffected — zero regression for existing users
- Motion blur preview toggle — instant on/off; standard in every NLE
- Shutter angle UI control (0-360 degrees) — cinematographers think in shutter angle
- Per-layer velocity-based blur — stationary layers stay sharp, moving layers blur
- Export output matches preview quality — what you see must match what you get

**Should have (competitive differentiators):**
- Watercolor bleed via Tyler Hobbs polygon deformation — most visually distinctive brush style; no other stop-motion editor has this
- Flow field distortion on brush strokes — organic hand-drawn quality without artist skill required
- Combined GLSL + sub-frame motion blur export — better quality than After Effects' 16 fixed samples at only 4-8 sub-frames because GLSL fills gaps between discrete positions
- Grain/texture post-processing pass — paper texture interaction across all brush styles
- Edge darkening post-pass (ink pooling) — small effort, high visual impact

**Defer to v0.5.x and beyond:**
- Pencil and marker brush styles — straightforward once charcoal exists
- Per-layer motion blur override — useful edge case, not essential for v0.5.0
- Adaptive preview quality — performance optimization, not a launch requirement
- User brush preset save/load — wait for parameter space to stabilize in v0.6+
- Wet-on-wet paint interaction — incompatible with vector stroke model, requires full architecture change

### Architecture Approach

Seven new files and five modified files deliver the milestone. The architecture cleanly separates brush FX rendering (`glBrushFx.ts`) from motion blur (`glMotionBlur.ts`), both following the established lazy-init shared context pattern from `glBlur.ts`. A shared context module (`glSharedContext.ts`) reduces total WebGL2 context count from 4 to 3. The paint rendering dispatch in `paintRenderer.ts` routes `brushStyle === 'flat'` through the existing Canvas 2D path (zero regression) and all other styles through `glBrushFx.ts`. Motion blur hooks into `previewRenderer.ts` after each layer is rendered to its offscreen canvas, before compositing to the main canvas. Sub-frame accumulation wraps the export frame loop in `exportEngine.ts` using fractional `interpolateAt()` calls that already work. Motion blur settings extend `projectStore.ts` as four signals with .mce format bump to v15.

**Major components:**
1. `glBrushFx.ts` — WebGL2 shared-context brush renderer (point stamping, spectral mixing, post-process passes); the keystone for all brush FX
2. `glMotionBlur.ts` + `motionBlurEngine.ts` — GLSL velocity blur shader + velocity computation from keyframe deltas + sub-frame accumulation buffer
3. `watercolorBleed.ts` + `flowField.ts` — CPU-side geometry algorithms (polygon deformation, vector field) feeding into glBrushFx
4. `spectralMix.ts` — Kubelka-Munk JS+GLSL (spectral.js wrapper), included in glBrushFx fragment shader
5. `glSharedContext.ts` — shared WebGL2 context for glBlur + glMotionBlur (keeps total context count at 3)

**Four established patterns that must be followed:**
- Lazy-init shared context with `webglcontextlost`/`webglcontextrestored` handlers
- Offscreen canvas per-layer isolation (pool and reuse, never allocate per-frame)
- Signal-bump reactivity for paint data (paint version signal, not reactive Map entries)
- Shader program caching by ID/style to avoid recompilation

### Critical Pitfalls

1. **WebGL2 context exhaustion** — four independent contexts would push against WKWebView limits; must consolidate glBlur + glMotionBlur to share a context via `glSharedContext.ts`. Decide architecture in Phase 1 before writing any new GL code.

2. **Canvas-to-WebGL2 texture upload stalls** — `texImage2D(canvas)` takes 10-40ms per call on WKWebView vs 1-2ms in Chrome. Fix: render paint strokes directly in WebGL2 via vertex attributes, skipping the Canvas 2D round-trip entirely.

3. **Per-frame offscreen canvas allocation** — `document.createElement('canvas')` inside the render loop causes 64MB+ GC churn per frame with FX paint layers active. Fix: pool canvases following the existing `getBlurOffscreen` pattern; fix the existing paint path before adding FX on top.

4. **Sub-frame accumulation dark fringing** — Canvas 2D 8-bit quantization causes dark halos at semi-transparent edges. Fix: accumulate in WebGL2 float FBO (`RGBA16F` with `EXT_color_buffer_float`), single readback to Canvas 2D at end.

5. **Spectral precision collapse** — `mediump` float in GLSL causes catastrophic cancellation in K/S coefficient computation; always use `highp float`. Clamp reflectance R to [0.001, 0.999]. Validate against JavaScript reference with known color pairs.

6. **GL state corruption when sharing contexts** — blend mode, pixel store params, active program, and framebuffer binding persist between modules. Establish a `resetGLState()` call at each consumer entry point in Phase 1.

7. **Motion blur edge bleeding** — blur samples outside layer bounds return transparent black, producing dark fringes. Fix: extend offscreen allocation by velocity magnitude on all sides; use alpha-weighted sample accumulation in the shader.

## Implications for Roadmap

Based on combined research, the architecture suggests a 9-phase build order. Two feature tracks (brush FX and motion blur) are mostly independent after shared infrastructure is established. The motion blur track is simpler and should be completed first to deliver early value. The brush FX track is more complex and depends on the WebGL2 infrastructure being solid before layering spectral mixing and watercolor on top.

### Phase 1: WebGL2 Infrastructure and Shared Context

**Rationale:** Both feature tracks depend on reliable WebGL2 context management. All pitfalls rooted in context exhaustion and GL state corruption must be resolved here, before any feature-specific shader code is written. This is the single most impactful architectural decision for the milestone.
**Delivers:** `glSharedContext.ts` (shared context for glBlur + glMotionBlur), `resetGLState()` utility, `webglcontextrestored` handlers on all consumers. Total WebGL2 contexts: 3.
**Addresses:** Pitfalls 1 (context exhaustion), 6 (GL state corruption)
**Avoids:** Writing blur modules independently that require painful consolidation later

### Phase 2: GLSL Motion Blur Engine

**Rationale:** Motion blur is the simpler and more self-contained of the two features. Completing it first delivers immediate user value and proves the shared WebGL2 context pattern before the more complex brush FX work begins.
**Delivers:** `glMotionBlur.ts` (directional blur shader using Phase 1 shared context), `motionBlurEngine.ts` (velocity computation, sub-frame accumulation in float FBO)
**Avoids:** Pitfall 4 (sub-frame dark fringing — use float FBO accumulation from the start, not Canvas 2D globalAlpha)

### Phase 3: Motion Blur Preview Integration, Store, and UI

**Rationale:** Completes the motion blur feature end-to-end. Pure integration work: hooking Phase 2 into the existing renderer, adding UI controls, persisting settings to .mce.
**Delivers:** PreviewRenderer per-layer motion blur hook with bounds-aware offscreen, `projectStore.ts` extensions (4 signals), .mce v15 bump, preview toolbar toggle, shutter angle slider
**Addresses:** Pitfall 7 (edge bleeding — implement bounds-aware offscreen allocation with velocity padding)

### Phase 4: Brush Style Data Model and UI

**Rationale:** Pure TypeScript and UI work — no rendering. Establishes the `BrushStyle` type contract that glBrushFx will implement. Can be built in parallel with Phases 2-3 on a separate branch.
**Delivers:** `types/paint.ts` extensions (`BrushStyle`, `BrushFxParams` optional on `PaintStroke`), `PaintProperties` brush style selector with visual previews, paintStore brush param support. Backward compat: missing `brushStyle` defaults to `'flat'`.

### Phase 5: WebGL2 Brush FX Core (Point Stamping + Canvas Pool Fix)

**Rationale:** The keystone phase for all brush FX. Must also fix the existing per-frame canvas allocation before adding FX rendering on top — otherwise GC churn will mask performance characteristics of the new pipeline.
**Delivers:** `glBrushFx.ts` (shared WebGL2 context, point-stamp renderer via direct vertex rendering), canvas pooling fix in `previewRenderer.ts`, `paintRenderer.ts` flat/styled dispatch, ink + charcoal brush styles rendering in GPU
**Addresses:** Pitfall 3 (per-frame canvas allocation — pool canvases as prerequisite), Pitfall 2 (texture upload stalls — direct WebGL2 vertex rendering, no Canvas-to-GL round-trip)

### Phase 6: Spectral Pigment Mixing

**Rationale:** Spectral mixing changes how strokes composite. Must have the basic point-stamp pipeline stable before wiring in the Kubelka-Munk shader; color errors would otherwise compound rendering bugs.
**Delivers:** `spectralMix.ts`, `spectral.glsl` embedded and integrated into `glBrushFx.ts` compositing pass, physically-correct color blending for overlapping strokes
**Uses:** `spectral.js@^3.0.0`
**Addresses:** Pitfall 5 (spectral precision — `highp float` required, clamp K/S range, validate 10 known color pairs against JS reference)

### Phase 7: Watercolor Bleed and Flow Fields

**Rationale:** Most complex brush style, deferred until the WebGL2 pipeline is proven. Tyler Hobbs polygon deformation is CPU-intensive; bleed geometry must be pre-computed and cached per stroke, never re-computed per frame.
**Delivers:** `watercolorBleed.ts` (polygon deformation + 20-30 layer transparent fill + stochastic erosion), `flowField.ts` (simplex-noise grid distortion with preset patterns), watercolor brush style
**Uses:** `simplex-noise@^4.0.3`

### Phase 8: Grain/Texture Post-Pass, Edge Darkening, and Export Integration

**Rationale:** Polish passes that enhance all brush styles (low complexity, high visual impact). Motion blur export sub-frame accumulation finalizes here since it depends on stable per-layer GLSL blur from Phase 2.
**Delivers:** Grain/texture erosion post-pass (stochastic shader), edge darkening post-pass (alpha threshold shader) — both in `glBrushFx.ts`; export sub-frame accumulation in `exportEngine.ts`; export panel motion blur settings UI
**Addresses:** "Looks done but isn't" items: sRGB gamma encoding on spectral output, rotation velocity in motion blur, fractional frame interpolation validation, paint data pre-loading for export

### Phase 9: Polish and Performance

**Rationale:** Optimization after correctness is established. Only real-world usage reveals which paths need tuning.
**Delivers:** LRU cache for rendered paint layer results (skip WebGL re-render when paintVersion unchanged for current frame), adaptive preview quality (auto-reduce blur sample count below 20fps), shutter angle visual reference tooltip, export progress showing sub-frame count
**Addresses:** Performance traps: per-stroke draw call batching, watercolor polygon deformation caching, sub-frame accumulation skipping static layers, motion blur velocity caching (use previous frame's interpolated values)

### Phase Ordering Rationale

- Shared context infrastructure first prevents rework when consolidating separate contexts later — all six pitfall-prevention strategies depend on this being in place
- Motion blur before brush FX because it is simpler (1 shader, proven pattern) and delivers user-visible value without the complex GPU brush pipeline
- Data model before GPU rendering to establish the type contract without coupling; this phase is independent and can run in parallel
- Core WebGL2 brush renderer before spectral mixing so color errors do not obscure basic rendering bugs
- Watercolor deferred until the WebGL2 pipeline is stable — it is the most CPU-intensive brush style and needs a reliable performance baseline
- Post-pass polish before export integration because post-passes must be correct in preview before being validated in export frames

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (WebGL2 Brush FX Core):** Point-stamp rendering pipeline design has multiple valid approaches (GL_POINTS with sprite texture vs. instanced quads). The texture atlas design, pressure-to-size mapping curve, and WKWebView GL_POINTS compatibility need to be specified before implementation begins.
- **Phase 7 (Watercolor Bleed):** Tyler Hobbs algorithm parameters (deformation rounds, layer count, opacity per layer, erosion density) need empirical tuning against target visual quality. Budget explicit tuning time before coding the final implementation.

Phases with standard patterns (skip deeper research):
- **Phase 1 (WebGL2 Infrastructure):** Shared context pattern, context loss recovery, and state reset are all documented in `glBlur.ts` and MDN WebGL best practices. No open questions.
- **Phase 2 (GLSL Motion Blur):** 30-line directional blur shader is specified in full in ARCHITECTURE.md (see fragment shader listing). Pattern mirrors `glBlur.ts` exactly.
- **Phase 3 (Motion Blur UI):** Extends existing `projectStore.ts` signals and `previewRenderer.ts` per-layer loop. UI components extend existing panel patterns.
- **Phase 4 (Data Model):** TypeScript type extension and UI component are fully specified with field names and types in ARCHITECTURE.md.
- **Phase 6 (Spectral Mixing):** spectral.js GLSL API, integration approach, and test methodology are fully specified. Precision guards are documented.
- **Phase 8 (Post-Passes + Export):** Post-pass shaders are simple. Sub-frame export wraps an existing function call. No novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified on npm with correct versions. spectral.glsl shader confirmed in repo. Existing patterns (glBlur.ts, glslRuntime.ts) provide proven blueprint. No ambiguity about what to add or exclude. |
| Features | MEDIUM-HIGH | Table stakes, competitive features, and anti-features are clearly defined with reasoning. MVP scope is tight and well-argued. Slight uncertainty: watercolor visual quality targets are qualitative — the right parameter values require visual testing. |
| Architecture | HIGH | Build order is fully specified with 9 phases. Component boundaries are unambiguous. Modified files and integration points are identified by name. WebGL2 context strategy is resolved. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls are specific with warning signs, recovery costs, and phase assignments. Performance numbers (10-40ms texture upload on WKWebView) have source references but need direct profiling validation on the target macOS/Tauri hardware. |

**Overall confidence:** HIGH

### Gaps to Address

- **WKWebView texture upload performance:** The 10-40ms figure comes from Firefox/WebKit bug trackers, not a direct Tauri/WKWebView measurement. Profile `texImage2D(canvas)` vs. `texImage2D(imageBitmap)` vs. direct WebGL2 vertex rendering early in Phase 5 before committing to the pipeline architecture.
- **WKWebView context limit lower bound:** The Chrome 16-context limit is confirmed. WKWebView on macOS may be lower. Test `WEBGL_lose_context` trigger point on the actual Tauri binary before finalizing the context budget.
- **Watercolor visual quality targets:** Parameters (deformation rounds, layer count, opacity) are starting points from the Tyler Hobbs essay. Final values require visual comparison against reference watercolor. Budget tuning time during Phase 7.
- **Flow field preset definitions:** ARCHITECTURE.md names the presets (wobble, curved, zigzag, waves, spiral) but does not specify the noise math behind each. These need to be defined during Phase 7 planning.
- **sRGB gamma encoding in spectral shader:** PITFALLS.md flags this as commonly missing in Kubelka-Munk implementations. Must be validated explicitly during Phase 6 sign-off.

## Sources

### Primary (HIGH confidence)
- [spectral.js v3.0.0 GitHub](https://github.com/rvanwijnen/spectral.js) — GLSL shader verified, MIT license confirmed, API documented
- [simplex-noise.js v4.0.3 GitHub](https://github.com/jwagner/simplex-noise.js) — TypeScript native, ESM, seeded PRNG, zero deps verified
- [Tyler Hobbs: Watercolor Simulation](https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art) — polygon deformation algorithm, canonical reference
- [John Chapman: Per-Object Motion Blur](http://john-chapman-graphics.blogspot.com/2013/01/per-object-motion-blur.html) — per-layer velocity blur technique and edge artifact documentation
- [MDN WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) — context management, state, texture uploads
- [Khronos WebGL Wiki: Handling Context Lost](https://www.khronos.org/webgl/wiki/HandlingContextLost) — context loss recovery patterns
- Existing codebase: `glBlur.ts`, `glslRuntime.ts`, `previewRenderer.ts`, `paintRenderer.ts`, `exportRenderer.ts` — verified integration points and established patterns

### Secondary (MEDIUM confidence)
- [p5.brush](https://github.com/acamposuribe/p5.brush) — WebGL2 brush rendering reference for algorithm patterns (not a dependency)
- [spectral.js Shadertoy demo](https://www.shadertoy.com/view/33XSWl) — GPU spectral_mix() validated in real-time fragment shader
- [NVIDIA GPU Gems 3 Ch.27: Motion Blur](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-27-motion-blur-post-processing-effect) — velocity buffer, sample count guidance
- [Unity HDRP Accumulation](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@10.1/manual/Accumulation.html) — sub-frame accumulation with correct alpha handling
- [Chromium WebGL context limits](https://issues.chromium.org/issues/40939743) — 16 context limit documentation
- [Tauri WebGL Context Issue #6559](https://github.com/tauri-apps/tauri/issues/6559) — Tauri-specific WKWebView WebGL context behavior

### Tertiary (LOW confidence, needs validation)
- WKWebView texture upload cost (10-40ms) — inferred from Firefox/WebKit bug trackers; needs direct measurement on target hardware
- [Chris Arasin: Real-Time Paint System](https://chrisarasin.com/paint-system-webgl/) — WebGL paint system reference (limited documentation)

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
