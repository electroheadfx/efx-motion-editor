# Feature Research

**Domain:** Expressive paint brush FX and per-layer motion blur for stop-motion animation editor
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that users of expressive brush tools and motion blur in creative/animation software assume exist. Missing any of these makes the feature feel broken or half-baked.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Brush style selector UI with visual previews | Every painting app (Procreate, Krita, Rebelle, Photoshop) shows brush previews in a picker. Users must see what they'll get before painting. | LOW | Extends existing PaintProperties panel. Thumbnails can be pre-rendered static images or tiny canvas previews. |
| Ink brush with clean, confident strokes | Ink is the most common rotoscoping/animation brush. Hand-drawn animators use it 90% of the time. Defined edges, slight thickness variation from pressure. | MEDIUM | Built on existing perfect-freehand pipeline with WebGL2 edge-darkening post-pass. Simplest non-flat style. |
| Charcoal brush with grainy texture | Expected as a "sketch" tool in any natural media suite. Grainy, soft-edged strokes with paper texture interaction. | MEDIUM | Stamp-based rendering with texture atlas + alpha erosion. Grain intensity tied to pressure. |
| Watercolor with visible bleed/diffusion | The signature natural media effect. Users expect paint to spread beyond stroke edges with organic randomness. | HIGH | Tyler Hobbs polygon deformation algorithm: 7 recursive deformation rounds on base polygon, then 30-100 semi-transparent layers at ~4% opacity each. Most complex brush style. |
| Physically-based color mixing (overlapping strokes) | When two paint strokes overlap, users expect subtractive mixing (blue + yellow = green). RGB additive mixing (blue + yellow = gray) breaks immersion instantly. | MEDIUM | Use spectral.js (MIT, v3.0.0) with spectral.glsl for GPU mixing. 37-band Kubelka-Munk reflectance model. The spec already identifies this correctly. |
| Motion blur toggle in preview toolbar | Users need instant on/off when blur costs performance. Every NLE (Premiere, DaVinci, After Effects) has this. | LOW | Boolean toggle + icon button. Connects to a motionBlur enabled signal. |
| Shutter angle control for motion blur | Standard in After Effects, DaVinci Resolve, Nuke. Users think in shutter angle (180 degrees = standard film look). | LOW | UI slider 0-360 mapped to strength 0.0-1.0. The spec correctly identifies this mapping. |
| Motion blur applies per-layer based on keyframe velocity | Users expect stationary layers to stay sharp while moving layers blur. After Effects does this automatically from keyframe data. | MEDIUM | Velocity computed from keyframe deltas between current and previous frame. Already feasible since `interpolateAt()` accepts fractional frames. |
| Flat brush remains default and unaffected | Existing users must not see any regression. Current perfect-freehand strokes must render identically. | LOW | `brushStyle === 'flat'` skips WebGL2 pipeline entirely. Spec already specifies this fallback. |
| Export produces same visual output as preview | What you see in preview must match export. Motion blur in export should be at least as good as preview quality. | MEDIUM | GLSL velocity blur used in both paths. Export adds sub-frame accumulation for higher quality. |

### Differentiators (Competitive Advantage)

Features that set this apart from other stop-motion editors. These are not expected by users but create significant value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Spectral pigment mixing via Kubelka-Munk theory | No other stop-motion editor offers physically-accurate paint mixing. Most tools use RGB blending which produces muddy results. Spectral mixing makes overlapping paint strokes behave like real pigments (blue+yellow=green). | MEDIUM | spectral.js v3.0.0 provides spectral.glsl with `spectral_mix()` for 2-4 color blending on GPU. MIT licensed. The GLSL shader can be embedded directly into the WebGL2 offscreen renderer. |
| Flow field distortion on brush strokes | Organic, hand-drawn quality without requiring artist skill. Strokes follow vector fields (wobble, spiral, wave patterns) instead of precise cursor paths. Unique for animation tools. | MEDIUM | Grid-based 2D vector field (Perlin noise or preset patterns). Applied per-step during stroke rasterization, deflecting stamp positions. p5.brush demonstrates this technique well. |
| Combined GLSL + sub-frame motion blur for export | After Effects uses 16 fixed samples. Our combined approach achieves better quality with only 4-8 sub-frames because GLSL fills motion gaps between discrete positions. This is the approach used by high-end compositing tools (Nuke). | MEDIUM | The existing `interpolateAt()` already supports fractional frames. Sub-frame accumulation blends N renders at fractional positions. Each sub-frame also gets GLSL directional blur. |
| Per-layer motion blur override | Allow disabling motion blur on specific layers (e.g., text overlays, UI elements that should stay sharp). After Effects has this; most simpler tools don't. | LOW | Per-layer boolean `motionBlurEnabled` with default true. UI checkbox in layer properties. |
| Pencil brush with graphite texture | Sketching is a primary workflow for animation. A pencil that responds to pressure with realistic graphite grain is immediately useful for storyboarding. | MEDIUM | Similar architecture to charcoal but with finer grain texture, lighter default opacity, and narrower pressure-to-width mapping. |
| Marker brush with flat, saturated fills | Useful for bold coloring in animation. Flat tip with consistent opacity and hard edges. | LOW | Simpler than watercolor -- rectangular stamp with slight angle variation. No bleed or diffusion needed. |
| Watercolor edge darkening (ink pooling) | Subtle but high-impact visual effect where overlapping transparent regions darken at edges, simulating ink/paint pooling. | LOW | Fragment shader post-pass: darken pixels where alpha > 0.7. Simple and visually striking per the spec. |
| Grain/texture post-processing pass | Paper texture interaction makes all brush styles feel more organic. Stochastic erosion punches semi-transparent holes simulating paper absorption. | LOW | Single-pass shader with noise texture. Applied after stroke rendering, before compositing back to Canvas 2D. |
| Adaptive preview quality for motion blur | Auto-reduce sample count when FPS drops below target. Users get smooth playback without manual quality management. | LOW | Monitor frame timing; switch from 8 to 4 samples (or disable) if framerate drops below 20fps. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but create problems for this specific product.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time watercolor fluid simulation (Navier-Stokes) | Rebelle uses physics-based fluid simulation for watercolor. Users may expect the same. | Rebelle's simulation requires a dedicated physics engine and runs on native GPU with frame-budget control. Implementing Navier-Stokes in a WebGL2 offscreen pass would consume the entire frame budget at 24fps, killing preview playback. Also conflicts with the vector-data-model (strokes as point arrays) since fluid sim requires pixel-level state. | Tyler Hobbs polygon deformation gives watercolor appearance at a fraction of the cost. Pre-compute deformed polygons once per stroke, cache result. No per-frame simulation needed. |
| Full velocity buffer for whole-frame motion blur | Single-pass approach blurs the entire composited frame using per-pixel velocity. Seems more efficient (one pass vs N per-layer passes). | Causes artifacts at layer boundaries (color bleeding between layers), requires a separate velocity buffer render target, and cannot cleanly disable blur per-layer. John Chapman's per-object technique specifically calls out silhouette artifacts as a major issue. | Per-layer velocity blur (Strategy A in spec). One shader pass per moving layer. Clean boundaries, no artifacts, trivial per-layer override. |
| Brush preset import/export | Power users want to share brush configurations between projects or import from other tools. | Premature abstraction. The brush system doesn't exist yet. Designing an import/export format before the parameters stabilize leads to format churn. Procreate's .brush format is proprietary; Krita's .kpp is XML-heavy. | Build brush styles as code-defined presets first. After the parameter space stabilizes (v0.6+), add user-customizable presets with save/load. |
| Wet-on-wet paint interaction (strokes interact after placement) | Rebelle's signature feature: painting on wet areas causes colors to mix and flow. | Requires per-pixel wetness state that persists and decays over time. Fundamentally incompatible with the vector stroke model (strokes as `[x,y,pressure][]` arrays). Would require a complete rendering architecture change to pixel-based. | Spectral mixing handles overlap at render time. Overlapping strokes mix correctly via Kubelka-Munk compositing. Feels close enough without pixel-level state. |
| Motion blur on paint layers | Paint strokes are static per-frame (frame-by-frame animation). Motion blur on paint layers would blur hand-drawn content that is intentionally sharp. | Paint layers don't have keyframe transforms -- they're drawn frame-by-frame. There's no velocity vector to compute. Blurring would destroy the hand-drawn aesthetic. | Only apply motion blur to layers with keyframe animation (content + overlay layers). Paint layers are inherently excluded since they lack transform keyframes. |
| GPU-based real-time Kuwahara filter for painterly post-processing | Visually impressive post-processing that makes any image look like a painting. | This is a post-processing effect on the entire frame, not a brush style. It would conflict with the existing FX/shader pipeline and wouldn't give per-stroke control. Also, it's unrelated to the paint brush FX feature scope. | Could be added as a GLSL shader effect in the existing Shadertoy pipeline (v0.6+). Not a brush feature. |

## Feature Dependencies

```
[BrushStyle field + UI selector]
    |
    +--requires--> [WebGL2 offscreen renderer with point stamping]
    |                   |
    |                   +--enables--> [Spectral color mixing shader]
    |                   |                  |
    |                   |                  +--enhances--> [Watercolor bleed]
    |                   |                  +--enhances--> [Ink edge darkening]
    |                   |
    |                   +--enables--> [Flow field integration]
    |                   |
    |                   +--enables--> [Grain/texture post-pass]
    |                   |
    |                   +--enables--> [Charcoal brush]
    |                   |
    |                   +--enables--> [Pencil brush]
    |                   |
    |                   +--enables--> [Marker brush]
    |
    +--independent--> [Ink brush (can use Canvas 2D fallback initially)]

[GLSL velocity blur engine (glMotionBlur.ts)]
    |
    +--enables--> [Preview integration (per-layer blur in renderFrame)]
    |                  |
    |                  +--requires--> [Previous-frame velocity cache]
    |
    +--enables--> [Sub-frame accumulation (export only)]
    |                  |
    |                  +--requires--> [interpolateAt() fractional frames] (ALREADY EXISTS)
    |
    +--enables--> [Combined GLSL + sub-frame export pipeline]

[Shutter angle UI control] --independent--> [GLSL velocity blur engine]

[Per-layer motion blur override] --requires--> [Preview integration]

[Adaptive preview quality] --requires--> [Preview integration]
```

### Dependency Notes

- **WebGL2 offscreen renderer is the keystone for all brush FX:** Every non-flat brush style depends on it. This must be built first and built well, because everything else layers on top. The existing glBlur.ts and glslRuntime.ts provide proven patterns for lazy-init WebGL2 context management.
- **Spectral mixing enables watercolor and ink quality but is not strictly required for charcoal/pencil:** Charcoal and pencil could use simpler alpha blending initially, but spectral mixing elevates their overlap behavior. Build spectral mixing early.
- **Motion blur is fully independent of paint brush FX:** Zero shared dependencies. These two feature tracks can be built in parallel or in any order. The motion blur engine follows the same WebGL2 offscreen pattern as glBlur.ts.
- **Sub-frame accumulation depends on the existing `interpolateAt()` engine:** Already accepts fractional frame numbers, so no modifications needed. The export renderer's `interpolateLayers()` function already calls `interpolateAt()` -- it just needs to be called N times per output frame.
- **Flow fields enhance all stamp-based brushes:** Once the grid-based vector field system exists, it can be applied to charcoal, pencil, and watercolor. It's an enhancement layer, not a prerequisite.

## MVP Definition

### Launch With (v0.5.0 core)

Minimum feature set to ship the milestone with meaningful value.

- [ ] BrushStyle field on PaintStroke + UI selector in PaintProperties -- foundation for all styles
- [ ] WebGL2 offscreen renderer with point-stamp technique -- the rendering backbone
- [ ] Spectral color mixing via spectral.glsl -- transforms overlap behavior from broken (RGB) to correct (pigment)
- [ ] Ink brush style -- most useful for animation workflows, simplest non-flat style
- [ ] Charcoal brush style -- second most requested, demonstrates texture capability
- [ ] Grain/texture post-pass -- small effort, big visual impact across all styles
- [ ] Edge darkening post-pass -- small effort, dramatically improves ink appearance
- [ ] GLSL velocity motion blur engine (glMotionBlur.ts) -- core blur capability
- [ ] Motion blur preview integration with toolbar toggle -- users can see it in real time
- [ ] Shutter angle UI control -- standard professional control
- [ ] Sub-frame accumulation for export -- high-quality export output
- [ ] Project-level motion blur settings with .mce persistence -- settings survive save/load

### Add After Validation (v0.5.x polish)

Features to add once core paint FX and motion blur are working correctly.

- [ ] Watercolor bleed (polygon deformation + layered fill) -- most complex brush style, defer until WebGL2 renderer is proven stable
- [ ] Flow field integration with preset patterns -- enhances all brushes but not essential for v0.5.0
- [ ] Pencil brush style -- straightforward once charcoal exists (similar architecture, finer grain)
- [ ] Marker brush style -- simplest stamp-based brush, low priority
- [ ] Per-layer motion blur override -- useful but edge case for v0.5.0
- [ ] Adaptive preview quality -- nice-to-have performance optimization

### Future Consideration (v0.6+)

Features to defer until the brush system matures.

- [ ] User-customizable brush presets with save/load -- wait for parameter space to stabilize
- [ ] Watercolor wet-on-wet interaction -- requires fundamental architecture change, not feasible in vector model
- [ ] Motion blur visualization/debug mode (velocity vectors overlay) -- developer tool, not user-facing priority

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| BrushStyle field + UI selector | HIGH | LOW | P1 |
| WebGL2 offscreen renderer | HIGH | MEDIUM | P1 |
| Spectral color mixing (Kubelka-Munk) | HIGH | MEDIUM | P1 |
| Ink brush style | HIGH | MEDIUM | P1 |
| Charcoal brush style | MEDIUM | MEDIUM | P1 |
| Edge darkening post-pass | MEDIUM | LOW | P1 |
| Grain/texture post-pass | MEDIUM | LOW | P1 |
| GLSL velocity motion blur engine | HIGH | MEDIUM | P1 |
| Motion blur preview integration | HIGH | MEDIUM | P1 |
| Shutter angle UI control | MEDIUM | LOW | P1 |
| Sub-frame accumulation for export | HIGH | MEDIUM | P1 |
| Motion blur project settings + persistence | HIGH | LOW | P1 |
| Watercolor bleed simulation | HIGH | HIGH | P2 |
| Flow field integration | MEDIUM | MEDIUM | P2 |
| Pencil brush style | MEDIUM | LOW | P2 |
| Marker brush style | LOW | LOW | P2 |
| Per-layer motion blur override | LOW | LOW | P2 |
| Adaptive preview quality | LOW | LOW | P2 |
| User brush presets | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v0.5.0 launch
- P2: Should have, add during polish or as follow-up
- P3: Nice to have, future milestone

## Competitor Feature Analysis

| Feature | After Effects | Procreate | Krita | Rebelle 6 | Our Approach |
|---------|---------------|-----------|-------|-----------|--------------|
| Brush styles | Paint tool is basic, not focus | 200+ presets, stamp-based | 10+ engines, highly configurable | Physics-based watercolor/oil | 5-6 styles via WebGL2 point-stamping with spectral mixing |
| Pigment mixing | N/A (not a paint tool) | No (RGB blending) | Experimental Kubelka-Munk plugin | Yes (Mixbox integration) | Yes (spectral.js / spectral.glsl, MIT) |
| Watercolor simulation | N/A | Basic wet brush | Wet brush preset | Navier-Stokes fluid sim | Tyler Hobbs polygon deformation (visual approximation, no physics) |
| Motion blur type | Per-layer velocity + sub-frame (16 samples) | N/A (not animation tool) | N/A (not animation tool) | N/A (not animation tool) | Per-layer GLSL velocity + sub-frame accumulation (4-8 combined) |
| Shutter angle control | Yes (0-720 degrees + phase) | N/A | N/A | N/A | Yes (0-360 degrees) |
| Sub-frame accumulation | Yes (16 fixed samples) | N/A | N/A | N/A | Yes (4-16 configurable, combined with GLSL) |
| Flow fields on brushes | N/A | No | No | Paint flow follows canvas tilt | Yes (grid-based vector fields with presets) |
| Texture/grain on brushes | N/A | Yes (dual texture system) | Yes (texture brush engine) | Yes (canvas texture interaction) | Yes (stochastic erosion post-pass) |
| Per-layer blur override | Yes | N/A | N/A | N/A | Yes (planned P2) |

**Key competitive positioning:** No other stop-motion editor combines spectral pigment mixing with motion blur. After Effects has excellent motion blur but basic painting. Procreate/Krita have excellent painting but no motion/animation blur. Rebelle has the best watercolor simulation but is not an animation tool. This product occupies a unique niche: expressive natural media painting with professional motion blur, specifically for stop-motion animation workflows.

## Sources

- [spectral.js v3.0.0](https://github.com/rvanwijnen/spectral.js) -- MIT licensed, Kubelka-Munk pigment mixing with GLSL support (HIGH confidence)
- [p5.brush](https://github.com/acamposuribe/p5.brush) -- WebGL2 brush rendering library, reference implementation for techniques (HIGH confidence)
- [Tyler Hobbs - Watercolor Simulation](https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art) -- Polygon deformation algorithm (HIGH confidence)
- [Mixbox](https://scrtwpns.com/mixbox/) -- Alternative pigment mixing (proprietary license, not recommended) (HIGH confidence)
- [John Chapman - Per-Object Motion Blur](http://john-chapman-graphics.blogspot.com/2013/01/per-object-motion-blur.html) -- Velocity buffer technique reference (HIGH confidence)
- [After Effects motion blur](https://www.provideocoalition.com/motion_blur/) -- Shutter angle and sub-frame behavior reference (MEDIUM confidence)
- [Chris Arasin - Real-Time Paint System](https://chrisarasin.com/paint-system-webgl/) -- WebGL paint system reference (LOW confidence, limited docs)
- [Maxime Heckel - Painterly Shaders](https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders/) -- Kuwahara filter and anisotropic techniques (MEDIUM confidence)
- [Krita brush engines](https://docs.krita.org/en/reference_manual/krita_4_preset_bundle.html) -- Natural media brush reference (MEDIUM confidence)
- [Rebelle 6](https://www.escapemotions.com/products/rebelle/about) -- Physics-based watercolor reference (MEDIUM confidence)
- [NVIDIA Motion Blur Sample](https://docs.nvidia.com/gameworks/content/gameworkslibrary/graphicssamples/opengl_samples/motionblurgl4gles3advancedsample.htm) -- GLSL motion blur patterns (MEDIUM confidence)

---
*Feature research for: Expressive paint brush FX and per-layer motion blur*
*Researched: 2026-03-25*
