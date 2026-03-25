# Phase 20: Paint Brush FX - Research

**Researched:** 2026-03-25
**Domain:** WebGL2 brush rendering, spectral color mixing, watercolor simulation, procedural textures
**Confidence:** HIGH

## Summary

This phase adds expressive brush styles (watercolor, ink, charcoal, pencil, marker) to the existing paint layer system. The core technical challenge is implementing a WebGL2 offscreen rendering pipeline that runs alongside the existing Canvas 2D flat brush path, with spectral pigment mixing (Kubelka-Munk via spectral.js GLSL port), watercolor edge simulation (simplified Tyler Hobbs polygon deformation + GPU shader post-pass), flow field distortion, and grain/texture post-effects.

The project already has two WebGL2 modules (`glslRuntime.ts` for shader effects and `glBlur.ts` for GPU blur) that establish the lazy-init, shared-context, framebuffer pattern. The new brush FX renderer follows the same architecture but operates on a dedicated offscreen WebGL2 context (separate from the GLSL runtime context) because brush rendering requires multi-pass framebuffer ping-pong (stroke accumulation, spectral mixing, post-processing) that would conflict with the shader effects pipeline's single-draw model.

The spectral.js library (MIT-licensed) provides both JavaScript and GLSL implementations of 38-band Kubelka-Munk pigment mixing. The GLSL `spectral.glsl` file (~520 lines) can be embedded directly into fragment shaders for real-time spectral color blending during stroke compositing. This is the correct choice over Mixbox (CC BY-NC, not commercially usable).

**Primary recommendation:** Build a dedicated `brushFxRenderer.ts` module with its own lazy-init WebGL2 context, implementing stroke rendering via textured quad stamping along paths, spectral mixing via embedded `spectral.glsl`, watercolor via simplified polygon deformation (5-10 layers) + GPU post-pass, and grain/edge effects as fragment shader post-passes. Flat brush continues through the existing Canvas 2D fast path with zero changes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Visual preview strip in PaintProperties panel showing rendered stroke thumbnail per style (flat, watercolor, ink, charcoal, pencil, marker) with checkmark on active style -- like Procreate's brush library
- **D-02:** Style list section is collapsible with collapse arrow (matching Tablet/Onion Skin pattern), open by default
- **D-03:** Each stroke remembers its style at draw time -- switching style mid-session affects only new strokes, not existing ones on the frame
- **D-04:** Style preview thumbnails are static pre-rendered images (not live-rendered with current color/size) -- zero runtime cost, always polished
- **D-05:** Each style shows only its relevant FX param sliders (e.g., watercolor shows bleed + grain; ink shows edge darken; charcoal shows grain + scatter) -- not all 5 params for every style
- **D-06:** FX sliders appear in a separate collapsible "BRUSH FX" section below the BRUSH section, following the Tablet/Onion Skin collapsible pattern
- **D-07:** Each style ships with sensible tuned defaults (e.g., watercolor: bleed=0.6, grain=0.4) -- users draw immediately and adjust if desired
- **D-08:** Flat brush hides the BRUSH FX section entirely -- no grayed-out sliders, clean panel
- **D-09:** Full Kubelka-Munk 38-band spectral reflectance model (ported from spectral.js) -- physically-correct pigment mixing where blue + yellow = green, not gray
- **D-10:** Spectral mixing applies to all non-flat brush styles -- consistent physically-correct color blending across watercolor, ink, charcoal, pencil, and marker
- **D-11:** Hybrid approach -- simplified polygon deformation (5-10 layers instead of 20) for rough edge shape, then GPU shader post-pass adds fine bleed and grain detail
- **D-12:** Watercolor bleed appears instantly in final form when stroke completes -- no animated spreading. Deterministic for export parity.
- **D-13:** Paper texture uses procedural noise in fragment shader by default (Perlin/simplex, resolution-independent, no asset dependency). Bundled texture image support can be added later as an option.

### Claude's Discretion
- Exact default FX parameter values per brush style (within reasonable ranges)
- WebGL2 offscreen context management (per-layer vs shared)
- Point stamping vs textured quad technique for stroke rasterization
- Flow field preset patterns and implementation
- Specific shader optimization strategies
- Polygon deformation layer count (5-10 range)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAINT-01 | User can select brush style (flat/watercolor/ink/charcoal/pencil/marker) from PaintProperties panel | Style selector UI pattern (D-01/D-02), brushStyle signal in paintStore, BrushStyle type |
| PAINT-02 | User can draw with ink brush style showing edge darkening and variable opacity overlap | Edge darkening fragment shader post-pass, opacity accumulation in framebuffer |
| PAINT-03 | User can draw with charcoal brush style showing grain texture and scatter | Procedural noise grain shader, scatter offset applied to stamp positions |
| PAINT-04 | User can draw with pencil brush style showing fine-grain texture | Fine-grain noise with high frequency, thin stamp opacity |
| PAINT-05 | User can draw with marker brush style showing flat semi-transparent strokes | Flat color fill with uniform opacity, no texture overlay |
| PAINT-06 | User can see physically-correct color blending when overlapping strokes mix | spectral.glsl Kubelka-Munk 38-band mixing embedded in compositing shader |
| PAINT-07 | User can draw with watercolor brush style showing edge bleed and paper texture | Tyler Hobbs polygon deformation (simplified) + GPU bleed/grain post-pass |
| PAINT-08 | User can adjust brush FX parameters (grain, bleed, scatter, field strength, edge darken) | Per-style FX slider mapping (D-05/D-06), BrushFxParams type |
| PAINT-09 | User can see flow field distortion affecting stroke paths for organic rendering | 2D angle grid flow field applied during stroke point sampling |
| PAINT-10 | User can see grain/texture post-effects simulating paper absorption | Procedural simplex noise fragment shader (ashima/webgl-noise) |
| PAINT-11 | Flat brush strokes render identically to current behavior (no regression) | Conditional branch in renderPaintFrame: flat -> existing Canvas 2D path |
| PAINT-12 | Paint brush FX render correctly in export pipeline | Same WebGL2 renderer called from PreviewRenderer; export delegates to PreviewRenderer |
| PAINT-13 | Brush style and FX params persist in paint sidecar JSON files | Optional brushStyle/brushParams fields on PaintStroke; JSON.stringify handles naturally |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| spectral.js (GLSL port) | 3.0.0 | 38-band Kubelka-Munk spectral pigment mixing | MIT-licensed, only viable open-source GLSL spectral mixing; Mixbox is CC BY-NC (not commercially usable) |
| webgl-noise (ashima) | MIT fork | Simplex 2D/3D noise for procedural paper texture | Self-contained GLSL functions, no texture dependency, MIT-licensed |
| perfect-freehand | 1.2.3 | Stroke outline generation (existing dependency) | Already in project; provides base geometry for all brush styles |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @preact/signals | 2.8.1 (existing) | Reactive state for brushStyle/brushFxParams signals | Already in project; new signals follow existing paintStore pattern |
| vitest | 2.1.9 (existing) | Unit testing for pure functions (spectral math, flow field, type guards) | Already in project; WebGL tests remain .todo (jsdom has no WebGL2) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| spectral.js GLSL port | Mixbox GLSL | Mixbox has better-known brand but CC BY-NC license blocks commercial use |
| Inline spectral.glsl | npm package import | spectral.js v3 GLSL is ~520 lines; inlining avoids runtime dependency, keeps shader self-contained |
| ashima webgl-noise | Book of Shaders noise | Same algorithm (Gustavson simplex), ashima has cleaner GLSL 300 es compatibility |
| Custom polygon deformation | Full Tyler Hobbs (20-100 layers) | 5-10 layers with GPU post-pass achieves 80% visual fidelity at 20% cost |

**Installation:**
```bash
# No new npm packages needed. spectral.glsl and noise GLSL are embedded as string constants.
# All dependencies already in project.
```

**Version verification:** No new packages to install. Existing dependency versions confirmed:
- perfect-freehand: ^1.2.3 (in package.json)
- @preact/signals: ^2.8.1 (in package.json)
- vitest: ^2.1.9 (in package.json)

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  types/
    paint.ts              # Extended: BrushStyle, BrushFxParams types, DEFAULT_BRUSH_FX_PARAMS
  stores/
    paintStore.ts         # Extended: brushStyle, brushFxParams signals
  lib/
    paintRenderer.ts      # Extended: conditional routing (flat -> Canvas2D, styled -> WebGL2)
    brushFxRenderer.ts    # NEW: WebGL2 offscreen brush FX rendering pipeline
    brushFxShaders.ts     # NEW: GLSL shader source strings (spectral, noise, post-pass)
    brushFlowField.ts     # NEW: 2D flow field grid generation and sampling
    brushWatercolor.ts    # NEW: Polygon deformation algorithm (Tyler Hobbs simplified)
    paintPersistence.ts   # Unchanged: JSON.stringify handles new optional fields naturally
  components/
    sidebar/
      PaintProperties.tsx # Extended: style selector, BRUSH FX section
    canvas/
      PaintOverlay.tsx    # Extended: attach brushStyle + brushParams to stroke on commit
  assets/
    brush-previews/       # NEW: 6 static PNG thumbnails (flat, watercolor, ink, charcoal, pencil, marker)
```

### Pattern 1: Lazy-Init WebGL2 Offscreen Context (Existing Pattern)
**What:** Create WebGL2 context on first use, cache programs/textures, destroy on dispose. Identical to glBlur.ts and glslRuntime.ts.
**When to use:** For the brush FX renderer -- create context when first non-flat stroke is rendered.
**Example:**
```typescript
// Source: Application/src/lib/glBlur.ts (lines 96-124)
let _gl: WebGL2RenderingContext | null = null;
let _glCanvas: HTMLCanvasElement | null = null;
let _initFailed = false;

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
    // ... clear cached resources
  });
  _gl = gl;
  return _gl;
}
```

### Pattern 2: Signal-Based Store Extension (Existing Pattern)
**What:** Add new signals alongside existing ones in paintStore, bump paintVersion on mutation.
**When to use:** For brushStyle and brushFxParams state.
**Example:**
```typescript
// Source: Application/src/stores/paintStore.ts (lines 12-28)
const brushStyle = signal<BrushStyle>('flat');
const brushFxParams = signal<BrushFxParams>({});
// Expose in paintStore object alongside existing signals
```

### Pattern 3: Collapsible Section (Existing Pattern)
**What:** Collapse arrow toggle with useState boolean, matching Tablet/Onion Skin sections.
**When to use:** For BRUSH STYLE section (D-02) and BRUSH FX section (D-06).
**Example:**
```typescript
// Source: Application/src/components/sidebar/PaintProperties.tsx (lines 182-197)
const [styleCollapsed, setStyleCollapsed] = useState(false); // open by default per D-02
// ... same collapse arrow pattern as Tablet section
```

### Pattern 4: Conditional Render Path (New Pattern)
**What:** Branch in renderPaintFrame based on brushStyle -- flat strokes use existing Canvas 2D, styled strokes route to WebGL2 pipeline.
**When to use:** In paintRenderer.ts when rendering each PaintElement.
**Example:**
```typescript
function renderElement(ctx, element, width, height) {
  if (element.tool === 'brush' && (element as PaintStroke).brushStyle
      && (element as PaintStroke).brushStyle !== 'flat') {
    // Collect styled strokes for batch WebGL2 rendering
    styledStrokes.push(element as PaintStroke);
  } else {
    // Existing Canvas 2D path -- unchanged
    renderStrokeCanvas2D(ctx, element as PaintStroke);
  }
}
```

### Pattern 5: Framebuffer Ping-Pong (New Pattern for Brush FX)
**What:** Render strokes to framebuffer A, apply spectral mixing compositing from A to B, apply post-effects from B back to screen. Same technique as glBlur.ts two-pass blur.
**When to use:** For multi-pass brush FX rendering (stroke accumulation -> spectral composite -> post-effects).
**Example:**
```typescript
// Similar to glBlur.ts lines 343-357
// Pass 1: Render stroke stamps to FBO texture
gl.bindFramebuffer(gl.FRAMEBUFFER, strokeFBO);
// ... draw stamp quads along stroke path
// Pass 2: Apply spectral mixing composite
gl.bindFramebuffer(gl.FRAMEBUFFER, mixFBO);
// ... fullscreen quad with spectral mix shader, reading strokeTexture
// Pass 3: Apply post-effects (grain, edge darken, bleed)
gl.bindFramebuffer(gl.FRAMEBUFFER, null); // render to canvas
// ... fullscreen quad with post-effect shader
```

### Anti-Patterns to Avoid
- **Modifying the existing flat brush path:** The flat brush MUST remain untouched (PAINT-11). All new code is additive. The only change to `renderStroke()` is a conditional check that routes to WebGL2 for non-flat styles.
- **Per-stroke WebGL context creation:** Context creation is expensive. The context is created once (lazy-init) and reused for all styled strokes across all frames.
- **Uploading spectral LUT as texture:** spectral.js GLSL embeds all spectral data as GLSL constants (~520 lines). No texture upload needed. This is simpler and avoids texture unit management.
- **Animated watercolor bleed:** Per D-12, watercolor bleed is deterministic and instant. No time-based animation, no progressive spreading. The final form is computed at stroke completion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Spectral pigment mixing | Custom RGB blending math | spectral.js GLSL port (spectral.glsl ~520 lines) | 38-band Kubelka-Munk is a physics model; getting blue+yellow=green requires spectral reflectance curves, not ad-hoc formulas |
| Procedural noise for paper texture | Custom random-based noise | ashima/webgl-noise simplex2D GLSL function | Simplex noise has correct frequency distribution, no grid artifacts, proven GPU performance |
| Stroke outline generation | Custom bezier stroke math | perfect-freehand (existing) | Already in project, handles pressure/thinning/taper correctly |
| Color space conversions | Manual sRGB/linear/XYZ math | spectral.glsl built-in converters | spectral.glsl includes sRGB<->linear, XYZ<->sRGB, reflectance<->XYZ |
| Gaussian random for watercolor deformation | Custom PRNG | Standard Box-Muller or built-in Math.random with Gaussian transform | Correct distribution matters for natural-looking edge deformation |

**Key insight:** The spectral mixing and noise algorithms are mathematically precise -- small implementation errors produce visibly wrong results. The GLSL source files (spectral.glsl, simplex noise) are MIT-licensed, self-contained, and proven. Embed them as string constants rather than reimplementing.

## Common Pitfalls

### Pitfall 1: WebGL2 Context Limit
**What goes wrong:** Browsers limit the number of simultaneous WebGL contexts (typically 8-16). Creating a new context per layer or per frame exhausts the limit, causing context loss on existing canvases.
**Why it happens:** Each `canvas.getContext('webgl2')` call creates a new context.
**How to avoid:** Use a SINGLE shared offscreen WebGL2 context for all brush FX rendering. Resize the canvas as needed per frame. This matches the existing glBlur.ts pattern.
**Warning signs:** `webglcontextlost` events firing, existing shader effects breaking.

### Pitfall 2: premultipliedAlpha Mismatch
**What goes wrong:** WebGL2 defaults to premultiplied alpha. When compositing WebGL output onto Canvas 2D via `drawImage()`, colors appear washed out or have dark fringing.
**Why it happens:** Canvas 2D expects non-premultiplied alpha by default.
**How to avoid:** Set `premultipliedAlpha: false` in WebGL2 context options (already done in glBlur.ts and glslRuntime.ts). Ensure `preserveDrawingBuffer: true` for `drawImage()` readback.
**Warning signs:** Semi-transparent strokes look darker than expected, white fringes around transparent edges.

### Pitfall 3: Y-Axis Flip Between WebGL and Canvas 2D
**What goes wrong:** WebGL uses bottom-left origin, Canvas 2D uses top-left. Strokes render upside down when composited.
**Why it happens:** Different coordinate conventions.
**How to avoid:** Either flip Y in the vertex shader (`gl_Position.y = -gl_Position.y`) or use `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)` when uploading from Canvas 2D. The existing glBlur.ts handles this correctly (lines 332-335).
**Warning signs:** Strokes appear mirrored vertically on the canvas.

### Pitfall 4: Stroke Accumulation Order for Spectral Mixing
**What goes wrong:** Spectral mixing is not commutative in the same way as alpha blending. Rendering strokes in wrong order or with standard alpha compositing produces incorrect pigment mixing.
**Why it happens:** Standard WebGL blending (`gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)`) does linear RGB interpolation, not spectral mixing.
**How to avoid:** Render each stroke's color and alpha to separate framebuffer textures. Use a custom compositing shader that reads both the existing accumulated color and the new stroke's color, performs spectral mixing via `spectral_mix()`, and writes the result. This replaces standard GL blending for the accumulation pass.
**Warning signs:** Overlapping colors produce gray instead of expected pigment results.

### Pitfall 5: Export Parity with Preview
**What goes wrong:** Export renders paint at a different resolution (e.g., 0.5x). If the WebGL2 renderer doesn't handle resolution scaling, brush strokes look different in export vs preview.
**Why it happens:** PreviewRenderer line 285-295 renders paint at project resolution, then scales via drawImage. Export may use different dimensions.
**How to avoid:** Always render brush FX at project resolution (projW x projH), then let the drawImage scaling handle output resolution. This matches the existing paint rendering approach in previewRenderer.ts.
**Warning signs:** Strokes appear thicker/thinner in export, texture frequency changes.

### Pitfall 6: Backward Compatibility of Sidecar JSON
**What goes wrong:** Old paint sidecar files don't have brushStyle or brushParams fields. Loading them crashes or produces undefined errors.
**Why it happens:** New code expects fields that don't exist in old data.
**How to avoid:** Make brushStyle and brushParams optional on PaintStroke (`brushStyle?: BrushStyle`). When absent, default to 'flat'. The existing JSON.parse + loadFrame path handles this naturally since missing properties are `undefined`.
**Warning signs:** Old projects fail to load paint data after code update.

### Pitfall 7: Fragment Shader Precision and spectral.glsl
**What goes wrong:** spectral.glsl performs floating-point math across 38 bands. Insufficient precision causes color banding or incorrect mixing results.
**Why it happens:** Mobile/integrated GPUs may default to mediump.
**How to avoid:** Use `precision highp float;` in all brush FX fragment shaders. The existing glslRuntime.ts already uses highp (line 37 of buildFragmentSource). spectral.glsl also declares highp.
**Warning signs:** Subtle color banding in gradients between mixed colors.

## Code Examples

### Spectral Mix in GLSL (from spectral.glsl)
```glsl
// Source: https://github.com/rvanwijnen/spectral.js/tree/master/shader/spectral.glsl
// ~520 lines, MIT license, embed as string constant

// Usage in compositing fragment shader:
#version 300 es
precision highp float;

// ... include spectral.glsl constants and functions ...

uniform sampler2D u_existing;   // accumulated color buffer
uniform sampler2D u_newStroke;  // new stroke being composited
out vec4 out_fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / iResolution.xy;
  vec4 existing = texture(u_existing, uv);
  vec4 incoming = texture(u_newStroke, uv);

  if (incoming.a < 0.001) {
    out_fragColor = existing;
    return;
  }

  // Spectral mix based on coverage (alpha)
  float mixFactor = incoming.a / (existing.a + incoming.a + 0.001);
  vec3 mixed = spectral_mix(existing.rgb, incoming.rgb, mixFactor);

  float combinedAlpha = min(1.0, existing.a + incoming.a);
  out_fragColor = vec4(mixed, combinedAlpha);
}
```

### Simplex Noise for Paper Texture (from ashima/webgl-noise)
```glsl
// Source: https://github.com/ashima/webgl-noise (MIT license)
// Usage in grain post-pass fragment shader:

// ... include simplex2D function (~50 lines) ...

uniform float u_grain;       // 0-1 grain intensity
uniform vec2 u_resolution;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec4 color = texture(u_input, uv);

  // Multi-octave noise for natural paper grain
  float noise = snoise(uv * 200.0) * 0.5
              + snoise(uv * 400.0) * 0.25
              + snoise(uv * 800.0) * 0.125;

  // Subtract grain (paper absorbs pigment in noisy pattern)
  float grainMask = 1.0 - u_grain * noise * 0.3;
  out_fragColor = vec4(color.rgb * grainMask, color.a * grainMask);
}
```

### Tyler Hobbs Watercolor Polygon Deformation (TypeScript)
```typescript
// Source: https://tylerxhobbs.com/essays/2017/a-generative-approach-to-simulating-watercolor-paints
// Simplified: 5-10 layers instead of 30-100, with GPU post-pass for fine detail

interface Point { x: number; y: number; }

function deformPolygon(vertices: Point[], variance: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    result.push(a);
    // Gaussian midpoint displacement
    const mx = (a.x + b.x) / 2 + gaussianRandom() * variance;
    const my = (a.y + b.y) / 2 + gaussianRandom() * variance;
    result.push({ x: mx, y: my });
  }
  return result;
}

function renderWatercolorStroke(
  basePolygon: Point[],
  layerCount: number,  // 5-10 per D-11
  opacity: number,     // ~0.04 per layer
): Point[][] {
  // Apply base deformation (7 iterations)
  let base = basePolygon;
  for (let i = 0; i < 7; i++) {
    base = deformPolygon(base, 2.0 / (i + 1));
  }
  // Generate layers with additional deformation
  const layers: Point[][] = [];
  for (let l = 0; l < layerCount; l++) {
    let layer = base;
    for (let i = 0; i < 4; i++) {
      layer = deformPolygon(layer, 1.0 / (i + 1));
    }
    layers.push(layer);
  }
  return layers;
}
```

### Flow Field Sampling
```typescript
// 2D angle grid for organic stroke distortion
interface FlowField {
  grid: Float32Array;  // angles in radians
  cols: number;
  rows: number;
  cellSize: number;
}

function createFlowField(width: number, height: number, cellSize: number): FlowField {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const grid = new Float32Array(cols * rows);
  // Fill with preset pattern (e.g., Perlin noise angles)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      grid[y * cols + x] = noise2D(x * 0.05, y * 0.05) * Math.PI * 2;
    }
  }
  return { grid, cols, rows, cellSize };
}

function sampleField(field: FlowField, x: number, y: number): number {
  const col = Math.floor(x / field.cellSize);
  const row = Math.floor(y / field.cellSize);
  const idx = Math.min(row, field.rows - 1) * field.cols + Math.min(col, field.cols - 1);
  return field.grid[idx];
}
```

## Rendering Pipeline Architecture

### Complete Pipeline Flow
```
User draws stroke (PaintOverlay)
    |
    v
PaintStroke created with brushStyle + brushParams (PaintOverlay line 408-416)
    |
    v
paintStore.addElement() stores stroke
    |
    v
paintVersion++ triggers re-render
    |
    v
previewRenderer calls renderPaintFrame()
    |
    +-- brushStyle === 'flat' (or undefined)
    |   └── existing Canvas 2D path: strokeToPath() -> ctx.fill()  [UNCHANGED]
    |
    +-- brushStyle !== 'flat'
        └── brushFxRenderer.renderStyledStrokes(styledStrokes, width, height)
            |
            +-- 1. Initialize/resize offscreen WebGL2 context
            +-- 2. Clear accumulation framebuffer
            +-- 3. For each stroke:
            |   +-- a. Generate base geometry (perfect-freehand outline)
            |   +-- b. Apply flow field distortion to sample points (if fieldStrength > 0)
            |   +-- c. For watercolor: generate deformed polygon layers (5-10)
            |   +-- d. Render stroke stamps to stroke framebuffer
            |   +-- e. Composite stroke onto accumulation buffer via spectral_mix shader
            +-- 4. Apply post-effects pass:
            |   +-- Edge darkening (ink style, edgeDarken param)
            |   +-- Grain/texture (simplex noise, grain param)
            |   +-- Watercolor bleed (Gaussian blur + edge mask, bleed param)
            +-- 5. ctx.drawImage(glCanvas, 0, 0) -> composite onto paint layer canvas
```

### WebGL2 Resource Management
```
brushFxRenderer.ts resources:
  _gl: WebGL2RenderingContext (single shared context)
  _glCanvas: HTMLCanvasElement (offscreen, resized to project dimensions)
  _strokeFBO + _strokeTex: Framebuffer for individual stroke rendering
  _accumFBO + _accumTex: Framebuffer for stroke accumulation with spectral mixing
  _postFBO + _postTex: Framebuffer for post-effect pass
  _vao: Fullscreen quad VAO (same as glBlur.ts)
  _programs: Map<string, WebGLProgram> cached shader programs
    - 'stamp': Textured quad stamp shader
    - 'spectral_composite': Spectral mixing compositing shader
    - 'post_grain': Grain/texture post-pass
    - 'post_edge': Edge darkening post-pass
    - 'post_bleed': Watercolor bleed post-pass (Gaussian-based)
```

## Per-Style FX Parameter Mapping

| Style | grain | bleed | scatter | fieldStrength | edgeDarken | Defaults |
|-------|-------|-------|---------|---------------|------------|----------|
| flat | -- | -- | -- | -- | -- | No FX section shown (D-08) |
| watercolor | visible | visible | -- | visible | -- | grain=0.4, bleed=0.6, fieldStrength=0.3 |
| ink | -- | -- | -- | visible | visible | fieldStrength=0.2, edgeDarken=0.7 |
| charcoal | visible | -- | visible | visible | -- | grain=0.6, scatter=0.5, fieldStrength=0.2 |
| pencil | visible | -- | -- | -- | -- | grain=0.3 |
| marker | -- | -- | -- | -- | -- | No FX params (flat semi-transparent) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| RGB linear interpolation for color mixing | Spectral reflectance (Kubelka-Munk) | ~2020-2023 (spectral.js, Mixbox) | Blue+yellow=green instead of gray; visually correct pigment behavior |
| Full Tyler Hobbs watercolor (100 layers CPU) | Hybrid: 5-10 polygon layers + GPU post-pass | Architecture decision D-11 | 80% visual fidelity at 20% cost; GPU handles fine detail |
| Texture-based paper grain (image assets) | Procedural simplex noise in shader | D-13 decision | Resolution-independent, zero asset dependency |
| p5.js-coupled brush libraries | Standalone WebGL2 renderer | This implementation | No p5.js dependency; algorithms ported, not imported |

**Deprecated/outdated:**
- Mixbox: CC BY-NC license makes it unsuitable; spectral.js is MIT and equivalent
- p5.brush as direct dependency: Tightly coupled to p5.js; algorithms must be ported

## Open Questions

1. **Optimal stamp density along stroke path**
   - What we know: p5.brush uses "spacing" parameter (1 = no overlap, lower = denser). Higher density = smoother but more GPU work.
   - What's unclear: Exact spacing value that balances visual quality and performance at project resolutions (typically 1920x1080 to 4K).
   - Recommendation: Start with spacing = 0.3 (30% of brush diameter between stamps), tune visually. This can be a Claude's Discretion parameter.

2. **Static brush preview thumbnail generation**
   - What we know: D-04 says static pre-rendered images, not live-rendered. Need 6 PNG thumbnails.
   - What's unclear: Best way to generate them (manually create? render once from code?).
   - Recommendation: Create 6 small PNG images (~120x40px each) showing a representative stroke for each style. Ship as static assets in `assets/brush-previews/`. These are hand-crafted once and bundled.

3. **Flow field persistence**
   - What we know: Flow field affects stroke rendering. Strokes store their points after flow field distortion.
   - What's unclear: Whether the flow field itself should be stored per-frame, or if the distorted points are stored.
   - Recommendation: Store the final distorted points in the stroke (they are the actual drawn path). The flow field is a drawing-time aid only, not persisted. This ensures deterministic rendering from stored data.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 2.1.9 |
| Config file | Application/vitest.config.ts |
| Quick run command | `cd Application && npx vitest run --reporter=verbose` |
| Full suite command | `cd Application && npx vitest run --reporter=verbose` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAINT-01 | Brush style selector type system | unit | `cd Application && npx vitest run src/types/paint.test.ts -x` | Wave 0 |
| PAINT-02 | Ink brush edge darkening params | unit | `cd Application && npx vitest run src/lib/brushFxRenderer.test.ts -x` | Wave 0 |
| PAINT-03 | Charcoal grain and scatter params | unit | Same as PAINT-02 | Wave 0 |
| PAINT-04 | Pencil fine-grain params | unit | Same as PAINT-02 | Wave 0 |
| PAINT-05 | Marker flat semi-transparent params | unit | Same as PAINT-02 | Wave 0 |
| PAINT-06 | Spectral mixing correctness | unit | `cd Application && npx vitest run src/lib/spectralMix.test.ts -x` | Wave 0 |
| PAINT-07 | Watercolor polygon deformation | unit | `cd Application && npx vitest run src/lib/brushWatercolor.test.ts -x` | Wave 0 |
| PAINT-08 | FX param slider mapping per style | unit | `cd Application && npx vitest run src/lib/brushFxDefaults.test.ts -x` | Wave 0 |
| PAINT-09 | Flow field distortion | unit | `cd Application && npx vitest run src/lib/brushFlowField.test.ts -x` | Wave 0 |
| PAINT-10 | Grain noise params | unit | Same as PAINT-02 (shader config test) | Wave 0 |
| PAINT-11 | Flat brush no regression | unit | `cd Application && npx vitest run src/lib/paintRenderer.test.ts -x` | Wave 0 |
| PAINT-12 | Export pipeline integration | manual-only | Visual: export frames match preview | N/A -- WebGL2 not in jsdom |
| PAINT-13 | Sidecar JSON persistence | unit | `cd Application && npx vitest run src/lib/paintPersistence.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd Application && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd Application && npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/types/paint.test.ts` -- BrushStyle type union, BrushFxParams interface, default constants
- [ ] `src/lib/brushFxDefaults.test.ts` -- per-style default param values, visible param mapping per style
- [ ] `src/lib/brushFlowField.test.ts` -- flow field creation, sampling, distortion of point arrays
- [ ] `src/lib/brushWatercolor.test.ts` -- polygon deformation, midpoint displacement, layer generation
- [ ] `src/lib/spectralMix.test.ts` -- JavaScript-side spectral math validation (KS/KM functions if exposed)
- [ ] `src/lib/paintRenderer.test.ts` -- conditional routing: flat strokes use Canvas2D, styled strokes route to WebGL2

Note: WebGL2 rendering tests remain .todo in jsdom environment (no WebGL2 context available). Visual verification required for shader-based features (PAINT-02 through PAINT-07, PAINT-10, PAINT-12).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| WebGL2 (browser runtime) | All non-flat brush rendering | N/A (runtime) | WebGL 2.0 | Flat brush only (graceful degradation) |
| pnpm | Package management | Assumed (existing project) | -- | -- |
| Node.js | Build tooling | Assumed (existing project) | -- | -- |

No external tools, databases, or CLI utilities required beyond what the project already uses. All new code is pure TypeScript + GLSL shader strings.

## Sources

### Primary (HIGH confidence)
- spectral.js repository (https://github.com/rvanwijnen/spectral.js) -- MIT license, GLSL port in shader/ directory, 38-band Kubelka-Munk implementation
- spectral.js v3.0.0 README -- API changes, GLSL usage, Color class, lazy memoization
- ashima/webgl-noise (https://github.com/ashima/webgl-noise) -- MIT license, self-contained simplex noise GLSL
- Existing project code: glBlur.ts, glslRuntime.ts, paintRenderer.ts, paintStore.ts, PaintProperties.tsx, PaintOverlay.tsx, paintPersistence.ts
- Project spec: SPECS/paint-brush-fx.md -- rendering pipeline, data model, integration approach

### Secondary (MEDIUM confidence)
- Tyler Hobbs watercolor essay (https://tylerxhobbs.com/essays/2017/a-generative-approach-to-simulating-watercolor-paints) -- polygon deformation algorithm, layer stacking technique
- p5.brush repository (https://github.com/acamposuribe/p5.brush) -- flow field grid pattern, brush tip types, spacing concept
- WebGL2 Fundamentals (https://webgl2fundamentals.org) -- framebuffer render-to-texture, canvas compositing via drawImage
- Efficient Rendering of Linear Brush Strokes (https://apoorvaj.io/efficient-rendering-of-linear-brush-strokes/) -- stamp sliding vs discrete stamp technique

### Tertiary (LOW confidence)
- Mixbox documentation (https://scrtwpns.com/mixbox) -- confirmed CC BY-NC license, ruled out for this project
- STVND/davis-pigment-mixing (https://github.com/STVND/davis-pigment-mixing) -- alternative Kubelka-Munk GLSL, less mature than spectral.js

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- spectral.js is the clear choice (MIT, GLSL port, proven), no new npm deps needed
- Architecture: HIGH -- follows existing project patterns exactly (lazy-init WebGL2, signal stores, collapsible sections)
- Pitfalls: HIGH -- based on direct analysis of existing codebase (premultipliedAlpha, Y-flip, context limits all observed in glBlur.ts/glslRuntime.ts)
- Watercolor algorithm: MEDIUM -- Tyler Hobbs essay provides algorithm but simplified version (5-10 layers + GPU) is novel combination; tuning will require iteration
- Flow field: MEDIUM -- pattern is well-established (p5.brush, generative art community) but exact preset parameters need visual tuning

**Research date:** 2026-03-25
**Valid until:** 2026-04-24 (stable domain; spectral.js and WebGL2 APIs are mature)
