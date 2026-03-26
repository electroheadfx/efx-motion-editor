# Phase 21: Motion Blur - Research

**Researched:** 2026-03-26
**Domain:** WebGL2 GLSL post-processing, per-layer velocity-based blur, sub-frame accumulation, Preact UI integration
**Confidence:** HIGH

## Summary

Phase 21 adds per-layer directional motion blur to both real-time preview and high-quality export. The architecture is well-defined by the SPECS/motion-blur.md spec and the CONTEXT.md decisions: Strategy A (per-layer velocity blur) applied via a new `glMotionBlur.ts` module following the identical lazy-init WebGL2 pattern as the existing `glBlur.ts`. Velocity is computed from `interpolateAt()` keyframe deltas. Export uses a combined pipeline: GLSL velocity blur applied per sub-frame, then sub-frames accumulated via additive blending.

The existing codebase provides strong foundations. `glBlur.ts` (368 lines) is a direct structural template -- same WebGL2 context init, shader compilation, texture upload via `texSubImage2D`, and readback via `drawImage`. The `interpolateAt()` function already handles fractional frame values, so sub-frame rendering works without modification. `PreviewRenderer.renderFrame()` already has per-layer offscreen canvas rendering with blur (lines 346-366), making the motion blur insertion point clear: after layer content render, before composite.

**Primary recommendation:** Build `glMotionBlur.ts` as a standalone WebGL2 module (own GL context, following `glBlur.ts` pattern exactly), implement velocity computation from keyframe deltas, then integrate into the existing per-layer rendering pipeline in PreviewRenderer and the export frame loop in exportEngine.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Strategy A -- per-layer velocity blur. Apply GLSL motion blur shader individually to each layer's offscreen canvas before compositing. No full-frame velocity buffer.
- **D-02:** New `glMotionBlur.ts` file following the same lazy-init WebGL2 pattern as `glBlur.ts`. Shared offscreen context, compiled shader cache, input canvas + velocity + settings -> blurred canvas output.
- **D-03:** Velocity computed from keyframe interpolation deltas between current and previous frame using `interpolateAt()` from keyframeEngine.
- **D-04:** Full transform-based blur -- position (directional streak), rotation (radial smear), and scale (zoom blur). Not position-only.
- **D-05:** Stationary layers skip blur entirely. Velocity threshold check: if `|dx| + |dy| + |dRotation| + |dScale|` is below threshold, render sharp (MBLR-08).
- **D-06:** Preview toolbar toggle button with dropdown popover. Click toggles on/off, dropdown opens shutter angle slider + quality tier selector. No sidebar section for motion blur.
- **D-07:** Shutter angle control (0-360 degrees) with 180 degrees default. Maps to blur strength as `shutterAngle / 360`.
- **D-08:** Preview quality tiers: Off (no blur), Low (4 GLSL samples), Medium (8 GLSL samples). No "High" for preview -- high quality is export-only.
- **D-09:** Export motion blur settings in the export dialog as a dedicated "Motion Blur" section. Shows enabled toggle, sub-frame count selector (4/8/16), and shutter angle override.
- **D-10:** Export uses combined pipeline: GLSL velocity blur applied per sub-frame render, then sub-frames accumulated via additive blending with `globalAlpha = 1.0 / subFrames`.
- **D-11:** Export shutter angle defaults to the project's preview shutter angle but can be overridden in the export dialog.
- **D-12:** Motion blur pass hooks into `PreviewRenderer.renderFrame()` per-layer -- after layer content is rendered to offscreen canvas and before compositing to main canvas.
- **D-13:** Previous frame interpolated values cached per layer for velocity delta computation.
- **D-14:** Sub-frame accumulation in export frame loop: render N sub-frames at fractional positions (e.g., frame + 0/N, frame + 1/N, ..., frame + (N-1)/N) with GLSL velocity blur on each, then blend.
- **D-15:** `interpolateAt()` already supports fractional frame values -- sub-frame rendering works out of the box.
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

### Deferred Ideas (OUT OF SCOPE)
- **Per-layer motion blur override** (MBLR-10) -- Allow enabling/disabling blur on specific layers. Future phase.
- **Adaptive preview quality** (MBLR-11) -- Auto-reduce samples when fps drops below threshold. Future phase.
- **Velocity vector visualization** (MBLR-12) -- Debug mode showing velocity arrows per layer. Future phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MBLR-01 | User can toggle motion blur on/off for preview playback | Toolbar toggle button (D-06); motionBlurStore signal pattern from blurStore; PreviewRenderer integration point at lines 346-366 |
| MBLR-02 | User can see per-layer directional blur based on layer movement velocity during preview | Per-layer velocity computation from interpolateAt() deltas (D-03); GLSL directional blur shader (spec shader source); drawLayerToOffscreen pattern at line 756 |
| MBLR-03 | User can adjust motion blur strength via shutter angle control (0-360 degrees) | Shutter angle -> strength mapping `shutterAngle / 360` (D-07); popover UI from toolbar button (D-06) |
| MBLR-04 | User can configure motion blur preview quality (off/low/medium) | Quality tiers: Off/Low(4)/Medium(8) samples (D-08); stored in MotionBlurSettings.previewQuality |
| MBLR-05 | User can enable motion blur for export with configurable sub-frame count (4/8/16) | Export dialog Motion Blur section (D-09); exportStore signals; sub-frame accumulation in export loop |
| MBLR-06 | Export renders motion blur using combined GLSL velocity blur + sub-frame accumulation | Combined pipeline (D-10, D-14); interpolateAt() fractional support (D-15); accumulator canvas with globalAlpha |
| MBLR-07 | Motion blur settings persist in project file (.mce format) | MotionBlurSettings interface (D-16); MceProject version bump to 15 (D-17); buildMceProject/hydrateFromMce patterns |
| MBLR-08 | Stationary layers are not blurred (velocity threshold skip) | Velocity threshold check (D-05); sum-of-absolute-deltas approach |
| MBLR-09 | Motion blur preview maintains smooth playback at target fps | GLSL shader ~1ms per layer (spec perf table); quality tiers limit sample count; rAF-based playback loop |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WebGL2 | Browser native | GPU-accelerated motion blur shader | Already used by glBlur.ts and glslRuntime.ts; ~1ms per pass on integrated GPU |
| @preact/signals | 2.8.1 | Reactive state for motion blur settings | Project standard; all stores use signal-based pattern |
| Preact | 10.28.4 | UI components (toolbar popover, export section) | Project framework |
| lucide-preact | 0.577.0 | Toolbar icons | Project standard for all toolbar buttons |
| vitest | 2.1.9 | Unit tests for velocity computation and settings | Project test framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Canvas 2D API | Browser native | Sub-frame accumulation buffer, offscreen rendering | Export accumulation with globalAlpha blending |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Separate WebGL2 context | Shared context with glslRuntime | Shared saves GPU memory but risks state conflicts; separate is simpler and matches glBlur.ts pattern |
| Per-pixel velocity field | Uniform velocity per layer | Per-pixel gives better rotation/scale blur but requires extra texture pass; uniform is sufficient for Strategy A |
| CSS-based blur | WebGL2 GLSL | CSS filter: blur() is isotropic only, no directional control |

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  lib/
    glMotionBlur.ts          # WebGL2 motion blur shader + pipeline (new)
    motionBlurEngine.ts      # Velocity computation, sub-frame accumulation (new)
  stores/
    motionBlurStore.ts       # Motion blur settings signals (new)
  types/
    project.ts               # MotionBlurSettings on MceProject (modified)
    export.ts                # Export motion blur options (modified)
  components/
    layout/
      Toolbar.tsx            # Motion blur toggle button + popover (modified)
    export/
      FormatSelector.tsx     # Motion blur section in export dialog (modified)
```

### Pattern 1: Lazy-Init WebGL2 Module (from glBlur.ts)
**What:** Singleton WebGL2 context created on first use, with cached shader program and fullscreen quad VAO. Returns false/null on failure for CPU fallback.
**When to use:** Any GPU-accelerated post-processing effect.
**Example:**
```typescript
// Source: Application/src/lib/glBlur.ts (lines 89-124)
let _gl: WebGL2RenderingContext | null = null;
let _glCanvas: HTMLCanvasElement | null = null;
let _resources: MotionBlurResources | null = null;
let _initFailed: boolean = false;

function getGL(): WebGL2RenderingContext | null {
  if (_initFailed) return null;
  if (_gl) return _gl;
  _glCanvas = document.createElement('canvas');
  const gl = _glCanvas.getContext('webgl2', {
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    antialias: false,
    depth: false,
    stencil: false,
  });
  if (!gl) { _initFailed = true; return null; }
  _glCanvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    _gl = null;
    _resources = null;
  });
  _gl = gl;
  return _gl;
}
```

### Pattern 2: Signal-Based Store (from blurStore.ts)
**What:** Minimal store with signal state, peek() for render-loop reads, and reset().
**When to use:** Any new reactive state that the render loop reads.
**Example:**
```typescript
// Source: Application/src/stores/blurStore.ts
import {signal} from '@preact/signals';

const enabled = signal(false);
const shutterAngle = signal(180);
const previewQuality = signal<'off' | 'low' | 'medium'>('medium');

export const motionBlurStore = {
  enabled,
  shutterAngle,
  previewQuality,
  // peek() for render loop
  isEnabled(): boolean { return enabled.peek(); },
  getStrength(): number { return shutterAngle.peek() / 360; },
  getSamples(): number {
    const q = previewQuality.peek();
    return q === 'low' ? 4 : q === 'medium' ? 8 : 0;
  },
};
```

### Pattern 3: Per-Layer Offscreen Blur Pass (from PreviewRenderer)
**What:** Render layer to offscreen canvas, apply GPU effect, composite result onto main canvas.
**When to use:** Any per-layer post-processing in the render pipeline.
**Example:**
```typescript
// Source: Application/src/lib/previewRenderer.ts (lines 346-366)
// Existing pattern for Gaussian blur -- motion blur follows same structure:
const off = this.getBlurOffscreen(Math.round(logicalW), Math.round(logicalH));
off.ctx.clearRect(0, 0, off.canvas.width, off.canvas.height);
off.ctx.save();
this.drawLayerToOffscreen(source, layer, off.ctx, logicalW, logicalH);
off.ctx.restore();
// Apply motion blur instead of Gaussian blur:
const blurred = applyMotionBlur(off.canvas, velocity, { strength, samples });
if (blurred) {
  ctx.save();
  ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
  ctx.globalAlpha = effectiveOpacity;
  ctx.drawImage(blurred, 0, 0, logicalW, logicalH);
  ctx.restore();
}
```

### Pattern 4: MceProject Persistence (from projectStore.ts)
**What:** Add optional fields to MceProject, serialize in buildMceProject(), deserialize in hydrateFromMce() with defaults for backward compatibility.
**When to use:** Persisting any new project-level settings.
**Example:**
```typescript
// In types/project.ts -- add to MceProject:
motion_blur?: {
  enabled: boolean;
  shutter_angle: number;
  preview_quality: string;
  export_sub_frames: number;
};
// In hydrateFromMce -- read with defaults:
const mb = project.motion_blur;
motionBlurStore.enabled.value = mb?.enabled ?? false;
motionBlurStore.shutterAngle.value = mb?.shutter_angle ?? 180;
```

### Anti-Patterns to Avoid
- **Reading signals with .value in render loop:** Use `.peek()` to avoid subscription tracking inside rAF callbacks. The playbackEngine docs explicitly warn about this.
- **Creating new WebGL2 contexts per frame:** The lazy-init singleton pattern is critical. WebGL contexts are limited resources (~16 per page in Chrome).
- **Modifying mutable result from interpolateAt():** The keyframeEngine uses a shared `_mutableResult` object. Always use the public `interpolateAt()` which returns a fresh copy, especially when storing previous-frame values for delta computation.
- **Applying motion blur to FX/generator/paint layers:** Only content layers and content-overlay layers with keyframe transforms should receive motion blur. FX layers have no spatial transform velocity; paint layers have no keyframes.
- **Sub-frame accumulation without resetting accumulator:** The accumulator canvas must be cleared before each frame's sub-frame loop. Using `globalAlpha = 1/N` with `source-over` compositing mode achieves correct averaging.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GPU shader compilation | Custom shader loader | Follow glBlur.ts `compileShader()` + `createResources()` pattern | Handles context loss, error logging, null checks; proven in production |
| Fullscreen quad rendering | Manual vertex setup | Copy VAO pattern from glBlur.ts (Float32Array [-1,-1,1,-1,-1,1,1,1]) | Standard pattern, TRIANGLE_STRIP with 4 vertices |
| Keyframe interpolation at fractional frames | Custom interpolation | `interpolateAt()` from keyframeEngine | Already handles fractional frames, easing, edge cases; battle-tested |
| Canvas texture upload to WebGL2 | getImageData + texImage2D | `texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, canvas)` | Zero-copy path used by glBlur.ts; avoids expensive pixel readback |
| Reactive state management | useState/useReducer | @preact/signals with `.peek()` for render loop | Project convention; all stores follow this pattern |

**Key insight:** Every piece of GPU infrastructure needed (context init, shader compilation, texture management, fullscreen quad) already exists in glBlur.ts. The motion blur module is a structural clone with a different shader and different uniforms.

## Common Pitfalls

### Pitfall 1: WebGL2 Y-Axis Flip
**What goes wrong:** Canvas 2D is top-down (Y=0 at top), WebGL2 is bottom-up (Y=0 at bottom). Without `UNPACK_FLIP_Y_WEBGL`, textures render upside down.
**Why it happens:** Canvas-to-WebGL texture upload doesn't auto-flip.
**How to avoid:** Set `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` before `texSubImage2D`, restore to false after. Both glBlur.ts (line 332) and glslRuntime.ts (line 412) do this.
**Warning signs:** Image appears vertically flipped in preview.

### Pitfall 2: Velocity Delta at Frame 0
**What goes wrong:** First frame has no previous frame to compute delta from, causing undefined velocity or zero-division.
**Why it happens:** Velocity = current - previous, but previous doesn't exist at frame 0.
**How to avoid:** Return zero velocity for the first frame (no blur). Cache previous values per-layer; if cache miss, skip blur for that layer that frame.
**Warning signs:** NaN values in velocity, visual artifacts on first frame.

### Pitfall 3: Accumulator Alpha Blending Math
**What goes wrong:** Sub-frame accumulation produces incorrect brightness if blending mode or alpha is wrong.
**Why it happens:** `globalAlpha = 1/N` with `source-over` compositing is only correct if each sub-frame has opaque pixels at the blur region. Transparent regions accumulate incorrectly.
**How to avoid:** Clear accumulator to transparent black (`clearRect`), draw each sub-frame with `globalAlpha = 1.0 / subFrames`, and use `source-over` blending. The GLSL pass should output premultiplied alpha in blur regions.
**Warning signs:** Export frames darker/lighter than preview; visible banding in semi-transparent areas.

### Pitfall 4: Performance Regression from Per-Layer GPU Readback
**What goes wrong:** Each motion blur pass requires canvas upload -> GPU render -> readback via drawImage. Multiple layers multiply this overhead.
**Why it happens:** WebGL2 <-> Canvas 2D context switching has fixed overhead per operation.
**How to avoid:** Skip blur for stationary layers (D-05 threshold check); keep sample counts low for preview (4/8 per D-08); ensure the velocity threshold catches layers with negligible motion.
**Warning signs:** Preview fps drops below target during playback with many animated layers.

### Pitfall 5: MceProject Version Compatibility
**What goes wrong:** Old projects crash when loading new fields, or new projects lose data when saved/loaded.
**Why it happens:** Missing backward/forward compat handling.
**How to avoid:** Version bump to 15; use optional fields (`motion_blur?: ...`) in MceProject interface; default values in hydrateFromMce for missing fields. This is the established pattern (v7 audio_tracks, v10 solid_color, v13 gradient).
**Warning signs:** TypeError when opening old projects; motion blur settings reset after save/reopen.

### Pitfall 6: Stale Previous-Frame Cache After Seek
**What goes wrong:** User seeks to a non-sequential frame, but cached previous values are from a different frame, producing incorrect velocity.
**Why it happens:** Cache assumes sequential frame progression; seek breaks this assumption.
**How to avoid:** Invalidate per-layer velocity cache on non-sequential frame change. Check if `abs(currentFrame - lastComputedFrame) > 1`; if so, clear cache and skip blur for one frame.
**Warning signs:** Momentary blur flash when scrubbing timeline; incorrect blur direction after seeking.

### Pitfall 7: Rotation/Scale Blur Approximation
**What goes wrong:** Using only positional (dx, dy) velocity for the GLSL shader produces linear streak blur, which is incorrect for rotating/scaling layers.
**Why it happens:** Rotation produces radial (circular) blur patterns; scale produces zoom (radial) patterns. A linear directional shader cannot represent these.
**How to avoid:** For the initial implementation, use the dominant velocity component (positional dx/dy) for the GLSL directional blur. Rotation and scale deltas can be converted to approximate positional equivalents by sampling the layer's bounding box corners and computing average displacement. This gives a "good enough" approximation that the sub-frame accumulation in export further refines.
**Warning signs:** Rotating layers show linear streak instead of rotational smear; zooming layers show directional instead of radial blur.

## Code Examples

### Velocity Computation from Keyframe Deltas
```typescript
// Source: SPECS/motion-blur.md + keyframeEngine.ts
import {interpolateAt} from './keyframeEngine';
import type {KeyframeValues, Keyframe} from '../types/layer';

export interface LayerVelocity {
  dx: number;       // pixels/frame
  dy: number;       // pixels/frame
  dRotation: number; // degrees/frame
  dScale: number;    // factor/frame
}

export function computeLayerVelocity(
  current: KeyframeValues,
  previous: KeyframeValues,
): LayerVelocity {
  return {
    dx: current.x - previous.x,
    dy: current.y - previous.y,
    dRotation: current.rotation - previous.rotation,
    dScale: (current.scaleX - previous.scaleX + current.scaleY - previous.scaleY) / 2,
  };
}

const VELOCITY_THRESHOLD = 0.5; // Total velocity below which layer is "stationary"

export function isStationary(v: LayerVelocity): boolean {
  return Math.abs(v.dx) + Math.abs(v.dy) + Math.abs(v.dRotation) + Math.abs(v.dScale) < VELOCITY_THRESHOLD;
}
```

### Motion Blur GLSL Shader
```glsl
// Source: SPECS/motion-blur.md
#version 300 es
precision highp float;

uniform sampler2D iChannel0;
uniform vec2 iResolution;
uniform vec2 uVelocity;    // velocity in pixels (dx, dy)
uniform float uStrength;   // blur strength (0.0 - 1.0) = shutterAngle / 360
uniform int uSamples;      // 4, 8, or 16

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
        float weight = 1.0 - abs(t * 2.0); // triangle filter
        color += texture(iChannel0, sampleUV) * weight;
        totalWeight += weight;
    }

    fragColor = color / totalWeight;
}
```

### Sub-Frame Accumulation for Export
```typescript
// Source: SPECS/motion-blur.md + exportRenderer.ts pattern
function renderFrameWithMotionBlur(
  globalFrame: number,
  subFrames: number,       // 4, 8, or 16
  renderer: PreviewRenderer,
  canvas: HTMLCanvasElement,
  fm: FrameEntry[],
  allSeqs: Sequence[],
  overlaps: CrossDissolveOverlap[],
): void {
  const accumulator = document.createElement('canvas');
  accumulator.width = canvas.width;
  accumulator.height = canvas.height;
  const accumCtx = accumulator.getContext('2d')!;

  accumCtx.globalAlpha = 1.0 / subFrames;

  for (let i = 0; i < subFrames; i++) {
    const t = i / subFrames;
    const subFrame = globalFrame + t;
    // renderGlobalFrame already uses interpolateAt() which supports fractional frames
    renderGlobalFrame(renderer, canvas, subFrame, fm, allSeqs, overlaps);
    accumCtx.drawImage(canvas, 0, 0);
  }

  // Copy accumulator to output canvas
  const outCtx = canvas.getContext('2d')!;
  outCtx.clearRect(0, 0, canvas.width, canvas.height);
  outCtx.drawImage(accumulator, 0, 0);
}
```

### applyMotionBlur Public API
```typescript
// Source: Pattern from glBlur.ts applyGPUBlur (lines 307-367)
export function applyMotionBlur(
  source: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  velocity: { dx: number; dy: number },
  strength: number,   // 0.0 - 1.0
  samples: number,    // 4, 8, 16
  width: number,
  height: number,
): boolean {
  const gl = getGL();
  if (!gl) return false;
  // ... WebGL2 pipeline: upload source, set uniforms, render, readback
  // Returns true on success, false for CPU fallback
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full-frame velocity buffer (MRT) | Per-layer velocity blur (Strategy A) | Decision D-01 | Cleaner per-layer blur, no boundary artifacts |
| Sub-frame only (16-32 samples) | Combined GLSL + sub-frame (4-8 samples) | Spec design | 4x fewer sub-frames needed for equivalent quality |
| CSS filter:blur() | WebGL2 GLSL directional shader | Project convention | Directional/anisotropic blur not possible with CSS |

**Deprecated/outdated:**
- WebGL1 approach: The project exclusively uses WebGL2 (`getContext('webgl2')`). No WebGL1 fallback needed.
- `texImage2D` for every frame: Both glBlur.ts and glslRuntime.ts use `texSubImage2D` for updates after initial allocation via `texStorage2D`. The motion blur module should follow this for immutable texture allocation.

## Open Questions

1. **Rotation/Scale to Directional Velocity Approximation**
   - What we know: D-04 requires full transform blur (position + rotation + scale). The GLSL shader in the spec is directional only (vec2 velocity).
   - What's unclear: Best approach to convert rotation delta (degrees/frame) and scale delta (factor/frame) into per-pixel directional vectors without a full velocity texture.
   - Recommendation: For the initial GLSL pass, compute an approximate directional velocity by averaging displacement of the layer's four bounding-box corners between current and previous frame. This captures the dominant motion direction. The sub-frame accumulation in export naturally handles the non-linear components (rotation curves, scale zoom) since each sub-frame renders at the correct interpolated transform. For preview, the approximation is visually acceptable because the sample count is low (4-8).

2. **Velocity Threshold Tuning**
   - What we know: D-05 specifies `|dx| + |dy| + |dRotation| + |dScale| < threshold`.
   - What's unclear: The exact threshold value that feels right perceptually.
   - Recommendation: Start with threshold = 0.5 (sum of absolute deltas in their respective units: pixels, degrees, factor). This is conservative -- it will skip blur for truly stationary layers while still blurring layers with even slight motion. Can be tuned with visual testing.

3. **WebGL2 Context Budget**
   - What we know: glBlur.ts and glslRuntime.ts each create their own WebGL2 contexts. Chrome allows ~16 contexts per page.
   - What's unclear: Whether adding a third context for glMotionBlur.ts risks hitting the limit.
   - Recommendation: Use a separate context (matching glBlur.ts pattern) for simplicity and isolation. Three contexts is well within the browser limit. Context sharing would save memory but risk state corruption bugs that are hard to debug.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | Application/vitest.config.ts |
| Quick run command | `cd Application && npx vitest run --reporter=verbose` |
| Full suite command | `cd Application && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MBLR-01 | Toggle motion blur on/off | unit | `cd Application && npx vitest run src/stores/motionBlurStore.test.ts -x` | Wave 0 |
| MBLR-02 | Per-layer directional blur from velocity | unit | `cd Application && npx vitest run src/lib/motionBlurEngine.test.ts -x` | Wave 0 |
| MBLR-03 | Shutter angle -> strength mapping | unit | `cd Application && npx vitest run src/lib/motionBlurEngine.test.ts -x` | Wave 0 |
| MBLR-04 | Preview quality tiers (off/low/medium) | unit | `cd Application && npx vitest run src/stores/motionBlurStore.test.ts -x` | Wave 0 |
| MBLR-05 | Export sub-frame count (4/8/16) | unit | `cd Application && npx vitest run src/lib/motionBlurEngine.test.ts -x` | Wave 0 |
| MBLR-06 | Combined GLSL + sub-frame export pipeline | unit | `cd Application && npx vitest run src/lib/motionBlurEngine.test.ts -x` | Wave 0 |
| MBLR-07 | Settings persist in .mce | unit | `cd Application && npx vitest run src/stores/projectStore.test.ts -x` | Existing (extend) |
| MBLR-08 | Stationary layer velocity threshold skip | unit | `cd Application && npx vitest run src/lib/motionBlurEngine.test.ts -x` | Wave 0 |
| MBLR-09 | Smooth preview playback | manual-only | Visual inspection during playback | N/A (perf) |

### Sampling Rate
- **Per task commit:** `cd Application && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd Application && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `Application/src/stores/motionBlurStore.test.ts` -- covers MBLR-01, MBLR-04
- [ ] `Application/src/lib/motionBlurEngine.test.ts` -- covers MBLR-02, MBLR-03, MBLR-05, MBLR-06, MBLR-08

*(Existing `projectStore.test.ts` will be extended for MBLR-07)*

## Sources

### Primary (HIGH confidence)
- `Application/src/lib/glBlur.ts` -- WebGL2 lazy-init pattern, shader compilation, texture pipeline (368 lines, read in full)
- `Application/src/lib/glslRuntime.ts` -- GLSL shader runtime, context management, program caching (560 lines, read in full)
- `Application/src/lib/previewRenderer.ts` -- Per-layer offscreen rendering, blur integration point, drawLayerToOffscreen transform math
- `Application/src/lib/exportRenderer.ts` -- renderGlobalFrame with interpolateLayers, frame compositing pipeline
- `Application/src/lib/keyframeEngine.ts` -- interpolateAt() with fractional frame support, KeyframeValues interface
- `Application/src/lib/exportEngine.ts` -- Export frame loop, canvas-to-blob-to-disk pipeline
- `Application/src/stores/blurStore.ts` -- Signal-based store pattern with peek() for render loop
- `Application/src/types/project.ts` -- MceProject interface, optional field patterns for version compat
- `Application/src/stores/projectStore.ts` -- buildMceProject() serialization, hydrateFromMce() deserialization
- `Application/src/stores/exportStore.ts` -- Export settings signals, ExportSettings type
- `SPECS/motion-blur.md` -- Full architecture spec with GLSL shader source, velocity computation, integration points
- `Application/src/lib/shaders/fx-image/filmoraShake.ts` -- Existing directional motion blur shader reference

### Secondary (MEDIUM confidence)
- `Application/src/components/layout/Toolbar.tsx` -- Toolbar layout, button styling, blur bypass toggle (integration point for motion blur button)
- `Application/src/components/views/ExportView.tsx` -- Export dialog structure (integration point for motion blur section)
- `Application/src/components/export/FormatSelector.tsx` -- Export settings UI patterns (section layout reference)

### Tertiary (LOW confidence)
- Rotation/scale-to-directional velocity approximation -- based on geometric reasoning, no external source verification. The bounding-box corner approach is a common technique but the exact quality tradeoff needs visual validation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- direct structural clone of glBlur.ts + established integration points
- Pitfalls: HIGH -- derived from reading actual codebase patterns and known WebGL2 gotchas
- Velocity/rotation approximation: MEDIUM -- geometric reasoning without visual validation

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, no moving targets)
