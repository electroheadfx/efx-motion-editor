# Phase 21: Motion Blur - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-layer directional motion blur for preview playback and high-quality export. Users can toggle motion blur on/off, adjust shutter angle (0-360 degrees), choose preview quality tiers, and export with combined GLSL velocity blur + sub-frame accumulation. Motion blur settings persist in the .mce project file. Per-layer override is deferred to a future phase.

</domain>

<decisions>
## Implementation Decisions

### Blur approach
- **D-01:** Strategy A — per-layer velocity blur. Apply GLSL motion blur shader individually to each layer's offscreen canvas before compositing. No full-frame velocity buffer.
- **D-02:** New `glMotionBlur.ts` file following the same lazy-init WebGL2 pattern as `glBlur.ts`. Shared offscreen context, compiled shader cache, input canvas + velocity + settings → blurred canvas output.
- **D-03:** Velocity computed from keyframe interpolation deltas between current and previous frame using `interpolateAt()` from keyframeEngine.

### Blur scope
- **D-04:** Full transform-based blur — position (directional streak), rotation (radial smear), and scale (zoom blur). Not position-only.
- **D-05:** Stationary layers skip blur entirely. Velocity threshold check: if `|dx| + |dy| + |dRotation| + |dScale|` is below threshold, render sharp (MBLR-08).

### Controls UX
- **D-06:** Preview toolbar toggle button with dropdown popover. Click toggles on/off, dropdown opens shutter angle slider + quality tier selector. No sidebar section for motion blur.
- **D-07:** Shutter angle control (0-360 degrees) with 180° default. Maps to blur strength as `shutterAngle / 360`.
- **D-08:** Preview quality tiers: Off (no blur), Low (4 GLSL samples), Medium (8 GLSL samples). No "High" for preview — high quality is export-only.

### Export
- **D-09:** Export motion blur settings in the export dialog as a dedicated "Motion Blur" section. Shows enabled toggle, sub-frame count selector (4/8/16), and shutter angle override.
- **D-10:** Export uses combined pipeline: GLSL velocity blur applied per sub-frame render, then sub-frames accumulated via additive blending with `globalAlpha = 1.0 / subFrames`.
- **D-11:** Export shutter angle defaults to the project's preview shutter angle but can be overridden in the export dialog.

### Preview integration
- **D-12:** Motion blur pass hooks into `PreviewRenderer.renderFrame()` per-layer — after layer content is rendered to offscreen canvas and before compositing to main canvas.
- **D-13:** Previous frame interpolated values cached per layer for velocity delta computation.

### Export integration
- **D-14:** Sub-frame accumulation in export frame loop: render N sub-frames at fractional positions (e.g., frame + 0/N, frame + 1/N, ..., frame + (N-1)/N) with GLSL velocity blur on each, then blend.
- **D-15:** `interpolateAt()` already supports fractional frame values — sub-frame rendering works out of the box.

### Persistence
- **D-16:** `MotionBlurSettings` interface on `MceProject`: `{ enabled, strength, previewQuality, exportSubFrames }`.
- **D-17:** .mce format version bump for motion blur fields. Backward compatible via `serde(default)` / optional fields.

### Claude's Discretion
- Exact velocity threshold value for stationary layer detection
- Rotation/scale blur shader implementation approach (per-pixel velocity field vs approximation)
- WebGL2 context sharing strategy with existing `glBlur.ts` / `glslRuntime.ts`
- Export dialog layout details and sub-frame count default (spec suggests 8)
- Preview toolbar icon choice and popover styling
- Performance auto-bailout if blur causes frame drops (MBLR-09)
- New file organization (`glMotionBlur.ts`, `motionBlurEngine.ts` or combined)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Motion blur spec
- `SPECS/motion-blur.md` — Full architecture spec: GLSL shader source, velocity computation, sub-frame accumulation, combined pipeline, integration points, performance expectations, file manifest

### Requirements
- `.planning/REQUIREMENTS.md` — MBLR-01 through MBLR-09 acceptance criteria

### Existing WebGL2 infrastructure
- `Application/src/lib/glBlur.ts` — GPU Gaussian blur with lazy-init WebGL2 pattern (template for `glMotionBlur.ts`)
- `Application/src/lib/glslRuntime.ts` — GLSL shader runtime with Shadertoy-compatible uniforms (reference for shader compilation/caching)

### Rendering pipeline
- `Application/src/lib/previewRenderer.ts` — Canvas 2D compositing with per-layer offscreen canvases (preview blur integration point)
- `Application/src/lib/exportRenderer.ts` — Export rendering with `interpolateLayers()` (sub-frame accumulation integration point)
- `Application/src/lib/keyframeEngine.ts` — `interpolateAt()` for fractional frame interpolation (velocity computation + sub-frame rendering)

### Stores and types
- `Application/src/stores/blurStore.ts` — Existing blur bypass store (pattern reference)
- `Application/src/types/project.ts` — `MceProject` type (where `MotionBlurSettings` will be added)
- `Application/src/stores/projectStore.ts` — Project state management (motion blur settings persistence)
- `Application/src/stores/exportStore.ts` — Export settings state

### Existing motion blur reference
- `Application/src/lib/shaders/fx-image/filmoraShake.ts` — Existing shader with `motionBlur` parameter (reference for directional blur pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `glBlur.ts`: Lazy-init WebGL2 with shared context, ping-pong FBO, two-pass separable blur. Direct template for `glMotionBlur.ts` — same init pattern, different shader.
- `glslRuntime.ts`: Shader compilation and caching, fullscreen quad rendering, uniform binding. Could potentially share WebGL2 context.
- `keyframeEngine.ts`: `interpolateAt()` already handles fractional frame values — sub-frame accumulation works without modification.
- `blurStore.ts`: Simple signal-based store pattern for blur toggle — extend or create parallel `motionBlurStore`.
- `filmoraShake.ts`: Has a `motionBlur` uniform and directional sampling loop — reference for the motion blur shader approach.

### Established Patterns
- WebGL2 lazy initialization with `getContext('webgl2')` and graceful CPU fallback
- Signal-based stores with `.peek()` for render-loop reads (avoiding subscription overhead)
- Per-layer offscreen canvas rendering in PreviewRenderer before compositing
- `serde(default)` / optional fields for backward-compatible .mce format upgrades
- Toolbar buttons with keyboard shortcut tooltips (Lucide icons)

### Integration Points
- `PreviewRenderer.renderFrame()` per-layer pipeline — insert blur pass after layer render, before composite
- `exportRenderer.renderGlobalFrame()` frame loop — wrap with sub-frame accumulation
- `projectStore` — add motion blur settings signals
- Export dialog UI — add Motion Blur section
- Preview toolbar — add toggle button with popover

</code_context>

<specifics>
## Specific Ideas

- Toolbar button with click-to-toggle + dropdown popover for settings (like a camera HUD)
- Shutter angle in degrees (0-360) for cinematographic familiarity — 180° is standard half-frame exposure
- Full transform blur: position → directional streak, rotation → radial smear, scale → zoom blur
- Combined GLSL + sub-frame pipeline gives excellent quality at 4-8 sub-frames (vs 16-32 for sub-frame only)
- No "High" preview quality — export-only is the high quality path

</specifics>

<deferred>
## Deferred Ideas

- **Per-layer motion blur override** (MBLR-10) — Allow enabling/disabling blur on specific layers (e.g., text overlays stay sharp). Future phase.
- **Adaptive preview quality** (MBLR-11) — Auto-reduce samples when fps drops below threshold. Future phase.
- **Velocity vector visualization** (MBLR-12) — Debug mode showing velocity arrows per layer. Future phase.

</deferred>

---

*Phase: 21-motion-blur*
*Context gathered: 2026-03-26*
