# Phase 20: Paint Brush FX - Gap Research: p5.brush Standalone Integration

**Researched:** 2026-03-25
**Domain:** p5.brush standalone library integration for brush stroke rendering in Preact/TypeScript/Vite
**Confidence:** HIGH (verified against npm package contents, source code, and official standalone docs)

## Summary

p5.brush v2.1.3-beta ships a fully functional standalone build (`dist/brush.esm.js`, 75KB / 28KB gzipped) that works without p5.js. The standalone adapter creates a WebGL2 context on any HTMLCanvasElement or OffscreenCanvas, handles its own transform stack, coordinate system, and frame lifecycle. The library includes 11 built-in brush presets (pen, rotring, 2B, HB, 2H, cpencil, pastel, crayon, charcoal, spray, marker), 7 flow field presets, a full Kubelka-Munk 38-band spectral pigment mixing pipeline in GLSL, watercolor fill with edge bleed/texture, and hatching. The standalone build bundles simplex-noise internally (zero runtime dependencies).

The integration strategy for our Preact/TypeScript motion editor is: replace the custom WebGL2 brush FX renderer (`brushFxRenderer.ts`, `brushFxShaders.ts`, `brushWatercolor.ts`, `brushFlowField.ts` -- ~2700 lines of hand-rolled code) with p5.brush standalone operating on an OffscreenCanvas. For each non-flat stroke, initialize p5.brush on an OffscreenCanvas sized to the paint layer, draw the stroke using `brush.spline()` (which accepts `[x, y, pressure]` point arrays -- exactly our data format), call `brush.render()`, then composite the WebGL canvas onto the main Canvas2D context via `ctx.drawImage()`.

**Primary recommendation:** Use `p5.brush/standalone` as a drop-in rendering backend. Map our 6 BrushStyle types (flat, watercolor, ink, charcoal, pencil, marker) to p5.brush's built-in brushes. The spectral pigment mixing, grain, scatter, and flow fields come free. Write ~50 lines of TypeScript type declarations for the API surface we use.

## Project Constraints (from CONTEXT.md)

### Locked Decisions
- D-01 through D-13 remain unchanged (brush selector UI, FX params, spectral mixing, watercolor, paper texture)
- D-09 (Kubelka-Munk spectral mixing) is satisfied natively by p5.brush's blend shader
- D-13 (procedural noise paper texture) is satisfied by p5.brush's fillTexture() system

### Claude's Discretion
- WebGL2 offscreen context management -- p5.brush manages its own context
- Point stamping vs textured quad -- p5.brush handles this internally
- Flow field preset patterns -- p5.brush provides 7 built-in presets
- Specific shader optimization -- p5.brush handles its own shader pipeline

### Impact on Existing Plans
The original research recommended building a custom WebGL2 pipeline from scratch (~1600 lines of shaders + ~1000 lines of renderer). p5.brush replaces all of this with a tested, battle-hardened library. The custom code attempted this and produced poor quality results. p5.brush has been developed over 2+ years with sophisticated rendering techniques.

---

## 1. Can p5.brush Work Standalone Without p5.js?

**Confidence: HIGH** -- verified by inspecting actual npm package contents and source code.

**YES.** The standalone build is a first-class output of the project's rollup build system.

### Build Artifacts (verified from `npm pack p5.brush`)
| File | Size | Purpose |
|------|------|---------|
| `dist/brush.esm.js` | 75KB (28KB gzip) | Standalone ESM module |
| `dist/brush.js` | 75KB | Standalone UMD module |
| `dist/p5.brush.esm.js` | 70KB | p5.js addon ESM (requires p5) |
| `dist/p5.brush.js` | 70KB | p5.js addon UMD |

The standalone build is actually 5KB larger than the p5 build because it bundles its own transform stack, color parser, and canvas management that the p5 build delegates to p5.js.

### Entry Points (from package.json exports field)
```json
{
  "exports": {
    ".": {
      "import": "dist/p5.brush.esm.js",
      "require": "dist/p5.brush.js"
    },
    "./standalone": {
      "import": "dist/brush.esm.js",
      "require": "dist/brush.js"
    }
  }
}
```

### Standalone Adapter Architecture
The standalone adapter (`src/adapters/standalone/`) mirrors the p5 adapter with 7 files:

| File | Responsibility |
|------|---------------|
| `target.js` | Canvas creation, WebGL2 context acquisition, OffscreenCanvas support |
| `runtime.js` | Transform stack (push/pop/translate/rotate/scale), color parser, angle modes |
| `renderer.js` | WebGL state management for mask rendering operations |
| `compositor.js` | Framebuffer management, fullscreen-triangle draw, dirty rect optimization |
| `stroke.js` | 2D canvas surface for custom brush tip rasterization |
| `frame.js` | Frame lifecycle: `render()` flushes pending composites, `clear()` resets |

### What the Standalone Build Provides Natively
- Its own `push()`/`pop()`/`translate()`/`rotate()`/`scale()` transform stack
- Color parsing (hex, RGB, CSS color strings)
- `angleMode(DEGREES)` / `angleMode(RADIANS)`
- `seed()` / `noiseSeed()` for deterministic rendering
- Frame lifecycle management (`render()` / `clear()`)

---

## 2. Installation and Import

**Confidence: HIGH** -- verified against npm registry.

### NPM Package
```bash
npm install p5.brush@2.1.3-beta
```

**Note:** The package declares `p5: ^2.2` as a peerDependency, but the standalone build does not actually import or use p5.js. You will get a peer dependency warning from npm, which can be suppressed with `--legacy-peer-deps` or by adding to `.npmrc`:
```
legacy-peer-deps=true
```

Or override in package.json:
```json
{
  "overrides": {
    "p5.brush": {
      "p5": "$p5.brush"
    }
  }
}
```

### Import
```typescript
import * as brush from 'p5.brush/standalone';
```

### Runtime Dependencies
| Dependency | Bundled? | Notes |
|------------|----------|-------|
| simplex-noise ^4.0.3 | YES (bundled into dist) | Used for flow fields and noise |
| p5.js | NO (not needed) | Only needed for p5 build |

---

## 3. Initializing p5.brush on an Offscreen WebGL Canvas

**Confidence: HIGH** -- verified from standalone target.js source code.

### OffscreenCanvas Support
The standalone adapter explicitly supports OffscreenCanvas (verified in source):

```javascript
// From src/adapters/standalone/target.js
function isSupportedTarget(target) {
  return (
    (typeof HTMLCanvasElement !== "undefined" && target instanceof HTMLCanvasElement) ||
    isOffscreenCanvasTarget(target)
  );
}

function isOffscreenCanvasTarget(target) {
  return (
    typeof OffscreenCanvas !== "undefined" &&
    target instanceof OffscreenCanvas
  );
}
```

### Initialization Pattern for Our Use Case
```typescript
import * as brush from 'p5.brush/standalone';

// Create an OffscreenCanvas matching the paint layer dimensions
const offscreen = new OffscreenCanvas(width, height);

// Load it as the p5.brush target (acquires WebGL2 context internally)
brush.load(offscreen);

// NOTE: brush.load() always sets density = 1
// For HiDPI, use createCanvas with pixelDensity option instead,
// or manually size the OffscreenCanvas to width*dpr x height*dpr
```

### Context Requirements
- **WebGL2 is mandatory.** The standalone target.js calls `getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true })`.
- `preserveDrawingBuffer: true` is set because p5.brush reads back from the canvas for compositing.
- If WebGL2 is unavailable, `brush.load()` throws: "brush.load(target) requires a canvas with a WebGL2 context."

### Canvas Reuse / Resizing
The `brush.load()` function can be called multiple times with different canvases, enabling runtime target switching. For our use case, we can maintain a single OffscreenCanvas and resize it when the project dimensions change.

### Coordinate System
p5.brush's WebGL origin is at canvas center. To use top-left origin (matching our Canvas2D coordinate system):
```typescript
brush.push();
brush.translate(-width / 2, -height / 2);
// ... draw in top-left coordinate space ...
brush.pop();
brush.render();
```

---

## 4. Rendering a Brush Stroke from [x, y, pressure] Points

**Confidence: HIGH** -- verified from primitives.js source code.

### Primary API: `brush.spline()`
This is the ideal API for our use case. It accepts exactly our data format: arrays of `[x, y, pressure]`.

```typescript
// Our PaintStroke has: points: [number, number, number][]
// This maps directly to brush.spline()

brush.set('charcoal', strokeColor, strokeWeight);
brush.spline(stroke.points, 0.5); // curvature 0-1 (0=straight, 1=max curve)
```

**How brush.spline() works internally:**
1. Takes `[x, y, pressure][]` array (minimum 2 points)
2. Creates a `Plot` object with computed segments, angles, and pressure interpolation
3. For each segment, computes circular arc control points (if curvature > 0)
4. `Plot.show()` iterates along the path at the brush's spacing interval
5. At each step, calls the brush tip's draw function (circle stamp, spray scatter, marker disc, etc.)
6. Pressure at each step is linearly interpolated from the per-point pressure values
7. Stamps accumulate in a WebGL framebuffer mask
8. Color blending happens via the Kubelka-Munk spectral shader

### Alternative APIs
| API | Use Case | Signature |
|-----|----------|-----------|
| `brush.spline(points, curvature)` | Best for freehand strokes from pointer input | `[[x,y,p], [x,y,p], ...]` |
| `brush.line(x1, y1, x2, y2)` | Single straight line segment | No pressure control |
| `brush.flowLine(x, y, length, dir)` | Line following active flow field | Direction-based |
| `brush.beginStroke(type,x,y)` + `brush.move()` + `brush.endStroke()` | Angle/length segment construction | Relative, not point-based |

### Full Rendering Sequence
```typescript
function renderStrokeWithP5Brush(
  stroke: PaintStroke,
  offscreen: OffscreenCanvas,
  targetCtx: CanvasRenderingContext2D,
): void {
  brush.load(offscreen);
  brush.clear();  // transparent background

  brush.push();
  brush.translate(-offscreen.width / 2, -offscreen.height / 2);

  // Map our BrushStyle to p5.brush preset name
  const brushName = STYLE_TO_P5BRUSH[stroke.brushStyle ?? 'flat'];

  // Set brush, color, and weight
  brush.set(brushName, stroke.color, stroke.size);

  // Optional: activate flow field if style uses it
  if (stroke.brushParams?.fieldStrength) {
    brush.field('curved');
    brush.wiggle(stroke.brushParams.fieldStrength);
  }

  // Draw the stroke -- points format matches exactly
  brush.spline(stroke.points, 0.5);

  brush.noField();
  brush.pop();
  brush.render();  // MUST call to flush compositing

  // Composite onto Canvas2D
  targetCtx.drawImage(offscreen, 0, 0);
}
```

---

## 5. Built-in Brush Types

**Confidence: HIGH** -- extracted from actual source code (`src/stroke/stroke.js` lines 764-861).

### 11 Standard Brushes (verified from `_standard_brushes` array)

| Brush Name | Type | Weight | Scatter | Sharpness | Grain | Opacity | Character |
|-----------|------|--------|---------|-----------|-------|---------|-----------|
| `pen` | default | 0.3 | 0.15 | 0.9 | 0.7 | 150 | Fine pen with slight scatter |
| `rotring` | default | 0.15 | 0.05 | 0.7 | 0.9 | 210 | Technical pen, very precise |
| `2B` | default | 0.3 | 0.75 | 0.45 | 0.8 | 180 | Soft graphite pencil |
| `HB` | default | 0.3 | 0.6 | 0.3 | 0.7 | 170 | Standard graphite pencil |
| `2H` | default | 0.2 | 0.6 | 0.3 | 0.75 | 120 | Hard graphite, lighter |
| `cpencil` | default | 0.35 | 0.55 | 0.8 | 0.7 | 75 | Colored pencil |
| `pastel` | default | 0.7 | 5.0 | 0.91 | 1.0 | 30 | Soft pastel, wide scatter, natural rotate |
| `crayon` | default | 0.33 | 1.9 | 0.75 | 2.0 | 159 | Waxy crayon, medium scatter |
| `charcoal` | default | 0.35 | 1.5 | 0.68 | 2.0 | 120 | Heavy scatter, grainy |
| `spray` | spray | 0.2 | 6.0 | 15 | 40 | 90 | Scattered dot pattern |
| `marker` | marker | 2.0 | 0.2 | -- | -- | 1 | Solid disc, minimal variation |

### Mapping Our BrushStyle to p5.brush Presets

| Our BrushStyle | p5.brush Preset | Rationale |
|---------------|-----------------|-----------|
| `flat` | (skip p5.brush, use Canvas2D) | No regression per D-11 |
| `watercolor` | `marker` + fill effects | Use marker tip + fillBleed/fillTexture for wash |
| `ink` | `pen` or `rotring` | Hard edge, precise, edge darkening via overlap |
| `charcoal` | `charcoal` | Heavy scatter, grainy -- perfect match |
| `pencil` | `HB` or `2B` | Standard graphite look |
| `marker` | `marker` | Solid flat strokes |

### Custom Brush Definition
p5.brush's `brush.add()` allows creating custom presets with precise control:

```typescript
brush.add('our_ink', {
  type: 'default',      // default | spray | marker | custom | image
  weight: 0.25,         // base tip diameter multiplier
  scatter: 0.2,         // random position offset (vibration)
  sharpness: 0.85,      // edge definition 0-1
  grain: 0.8,           // particle density
  opacity: 180,         // base alpha (0-255)
  spacing: 0.08,        // distance between stamps (fraction of weight)
  pressure: [0.8, 1.2], // [min, max] pressure curve
  rotate: 'natural',    // 'random' | 'natural' (follows path) | undefined
  noise: 0.3,           // per-stamp alpha noise 0-1
});
```

---

## 6. Flow Fields, Watercolor Fill, and Spectral Blending

**Confidence: HIGH** -- verified from source code.

### Flow Fields (7 Built-in Presets)

| Field Name | Character |
|-----------|-----------|
| `hand` | Organic noise (Perlin + sinusoidal) -- basis for `brush.wiggle()` |
| `curved` | Large-scale smooth noise curves with temporal variation |
| `zigzag` | Sharp alternating herringbone/wicker patterns |
| `waves` | Sinusoidal wave bands with row/column oscillation |
| `seabed` | Dense oscillation from row x column products |
| `spiral` | Radial vortex with multiple attractors |
| `columns` | Column-banded parallel rake marks |

**Usage:**
```typescript
brush.field('curved');           // activate preset
brush.wiggle(0.5);              // set influence strength
// ... draw strokes (they follow the field) ...
brush.noField();                // deactivate

// Custom field:
brush.addField('myField', (t, field) => {
  // populate field grid with angle values
  return fillField(field, (col, row) => angle);
}, { angleMode: 'radians' });
```

### Watercolor Fill

p5.brush has two fill systems:

**1. Standard fill (polygon-based watercolor):**
```typescript
brush.fill('#003c32', 110);     // color, opacity (0-255)
brush.fillBleed(0.6);           // edge bleed strength 0-1
brush.fillTexture(0.4, 0.4);   // texture strength, border strength
brush.circle(x, y, radius);     // filled shape with watercolor effect
```

The fill system creates a `FillPoly` that:
- Applies 20 layers with varying opacity and vertex offsets (polygon deformation)
- Uses `grow()` to expand vertices based on bleed direction
- Uses `erase()` to randomly remove circular regions simulating paper texture

**2. Wash (simplified solid fill):**
```typescript
brush.wash('#003c32', 110);      // solid fill via 2D canvas (fast)
```

### Spectral Pigment Blending (Kubelka-Munk)

**This is built into p5.brush's core blend shader** (`src/core/gl/shader.frag`). Every stroke-over-stroke interaction automatically uses spectral mixing.

The shader implements:
- sRGB <-> linear RGB conversion with gamma 2.4
- `KS(R)` and `KM(KS)` functions for Kubelka-Munk reflectance/absorption
- `spectral_linear_to_reflectance()` decomposes RGB into 7 constituent channels (white, cyan, magenta, yellow, red, green, blue) across **38 spectral bands**
- `spectral_mix()` blends two colors at the spectral level then reconstructs via XYZ -> sRGB

**This means D-09 (Kubelka-Munk) and D-10 (spectral mixing for all non-flat styles) are satisfied automatically.** We do not need to port spectral.js or write any spectral mixing code -- p5.brush already has it.

---

## 7. Offscreen Rendering and Canvas2D Compositing

**Confidence: HIGH** -- verified OffscreenCanvas support in source code.

### Architecture

```
PaintStroke data
       |
       v
  p5.brush standalone
  (OffscreenCanvas + WebGL2)
       |
       v  brush.render()
  OffscreenCanvas contains rendered stroke
       |
       v  ctx.drawImage(offscreen, 0, 0)
  Main Canvas2D compositing
```

### Key Pattern: brush.load() on OffscreenCanvas
```typescript
const offscreen = new OffscreenCanvas(width, height);
brush.load(offscreen);  // acquires WebGL2 context, sets density=1
```

### Multi-Stroke Accumulation
p5.brush is designed for accumulating multiple strokes on a single canvas. Between `brush.clear()` and `brush.render()`, all strokes are composited with spectral blending:

```typescript
brush.clear();           // reset to transparent
brush.push();
brush.translate(-w/2, -h/2);

// Render ALL styled strokes for this frame
for (const stroke of styledStrokes) {
  brush.set(mapStyle(stroke), stroke.color, stroke.size);
  brush.spline(stroke.points, 0.5);
}

brush.pop();
brush.render();          // flush all pending compositing

// Now composite the full result onto Canvas2D
mainCtx.drawImage(offscreen, 0, 0);
```

### Canvas2D Compositing
`ctx.drawImage()` works with both HTMLCanvasElement and OffscreenCanvas as source. Since p5.brush uses `preserveDrawingBuffer: true`, the WebGL canvas contents are always available for reading.

### Density / HiDPI Handling
`brush.load()` sets density=1. For HiDPI support:
- Size the OffscreenCanvas to `width * dpr` x `height * dpr`
- Scale `brush.translate()` accordingly
- Or use `brush.createCanvas()` with `pixelDensity` option (but this creates a DOM element, not suitable for offscreen)

**Recommendation:** Use `brush.load()` with a manually-sized OffscreenCanvas at `width * dpr` x `height * dpr`. Scale all coordinates by dpr before passing to p5.brush.

---

## 8. Performance Considerations

**Confidence: MEDIUM** -- based on architecture analysis, not runtime benchmarks.

### What Makes p5.brush Fast
1. **Batched GL draw calls:** Circle stamps are batched into a single `gl.drawArrays(gl.POINTS, ...)` call via pre-allocated Float32Array buffers
2. **Instanced rendering:** Image-tip brushes use `gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count)`
3. **Dirty rectangle optimization:** Only the modified region of the mask is uploaded to GPU via `texSubImage2D`
4. **Buffer reuse:** Vertex buffers grow dynamically but never shrink; subdata updates when fitting existing allocation
5. **Shader caching:** Programs are compiled once and reused
6. **Persistent VAO:** Fullscreen-triangle VAO is created once for all blend passes

### Performance Characteristics
| Operation | Expected Performance | Notes |
|-----------|---------------------|-------|
| Single stroke (50 points) | < 5ms | Batch stamp + single composite |
| Full frame (20 strokes) | 10-30ms | All strokes accumulated before render() |
| Spectral blend (per stroke) | ~2ms GPU | Fragment shader on dirty rect only |
| Flow field generation | ~5ms | Runs once when field is activated |
| brush.clear() | < 1ms | Single GL clear call |

### Potential Bottlenecks
1. **OffscreenCanvas WebGL2 context creation:** First `brush.load()` call takes ~50-100ms for shader compilation. Subsequent calls reuse cached programs.
2. **Large canvas sizes:** At 4K (3840x2160), framebuffer memory is significant. Each FBO texture = width * height * 4 bytes. p5.brush maintains ~4-5 framebuffers internally = ~130MB at 4K.
3. **Many small strokes:** Each `brush.spline()` call triggers stamp iteration. For frames with 100+ tiny strokes, the overhead per-stroke adds up.
4. **Context switching:** Each `brush.load()` call may trigger WebGL state reset. For multi-frame playback, keep the same OffscreenCanvas loaded and only `brush.clear()` between frames.

### Optimization Strategy
- **Cache the OffscreenCanvas and WebGL2 context** -- call `brush.load()` once at init, `brush.clear()` per frame
- **Batch all styled strokes per frame** -- render all at once between clear/render, not one stroke at a time
- **Flat strokes bypass p5.brush entirely** -- continue using Canvas2D fast path (D-11)
- **For preview during drawing** -- render only the active stroke via p5.brush (incremental), composite accumulated background from cache
- **Seed for determinism** -- `brush.seed(42)` ensures identical rendering for export parity (D-12)

---

## 9. TypeScript Type Definitions

**Confidence: HIGH** -- verified: no types exist in the package or DefinitelyTyped.

### Status
- **No `*.d.ts` files** in the npm package (verified via `npm pack` inspection)
- **No `@types/p5.brush`** on DefinitelyTyped (verified via npm registry)
- **No `types` or `typings` field** in package.json
- The library is written in plain JavaScript (no TypeScript source)

### Solution: Write a Minimal Declaration File

We need to declare only the ~25 functions we actually use. This should be placed at `Application/src/types/p5brush.d.ts`:

```typescript
// Type declarations for p5.brush standalone build
// Only declares the API surface used by our brush FX renderer

declare module 'p5.brush/standalone' {
  /** Canvas setup */
  export function createCanvas(
    width: number,
    height: number,
    options?: {
      pixelDensity?: number;
      parent?: string | HTMLElement;
      id?: string;
    },
  ): HTMLCanvasElement;

  export function load(target?: HTMLCanvasElement | OffscreenCanvas): void;

  /** Frame lifecycle */
  export function render(): void;
  export function clear(color?: string): void;

  /** Transform stack */
  export function push(): void;
  export function pop(): void;
  export function translate(x: number, y: number): void;
  export function rotate(angle: number): void;
  export function scale(x: number, y?: number): void;

  /** Angle mode */
  export const DEGREES: 'degrees';
  export const RADIANS: 'radians';
  export function angleMode(mode: 'degrees' | 'radians'): void;

  /** Seeding */
  export function seed(n: number): void;
  export function noiseSeed(n: number): void;

  /** Brush management */
  export function set(brushName: string, color: string, weight?: number): void;
  export function pick(brushName: string): void;
  export function stroke(color: string): void;
  export function strokeWeight(weight: number): void;
  export function noStroke(): void;
  export function add(name: string, params: BrushParams): void;
  export function box(): string[];
  export function scaleBrushes(scale: number): void;

  /** Drawing */
  export function line(x1: number, y1: number, x2: number, y2: number): void;
  export function flowLine(x: number, y: number, length: number, dir: number): void;
  export function spline(points: [number, number, number?][], curvature?: number): void;
  export function circle(x: number, y: number, radius: number, irregularity?: number): void;
  export function rect(x: number, y: number, w: number, h: number, mode?: string): void;

  /** Fill */
  export function fill(color: string, opacity?: number): void;
  export function noFill(): void;
  export function fillBleed(intensity: number, direction?: string): void;
  export function fillTexture(texture?: number, border?: number, scatter?: boolean): void;

  /** Wash */
  export function wash(color: string, opacity?: number): void;
  export function noWash(): void;

  /** Flow fields */
  export function field(name: string): void;
  export function noField(): void;
  export function addField(
    name: string,
    generator: (t: number, field: any) => any,
    options?: { angleMode?: 'degrees' | 'radians' },
  ): void;
  export function refreshField(time: number): void;
  export function listFields(): string[];
  export function wiggle(amount: number): void;

  /** Hatching */
  export function hatch(spacing: number, angle: number, options?: object): void;
  export function hatchStyle(brush: string, color: string, weight: number): void;
  export function noHatch(): void;

  /** Noise utilities */
  export function random(min?: number, max?: number): number;
  export function noise(x: number, y?: number, z?: number): number;

  /** Brush parameter types */
  interface BrushParams {
    type?: 'default' | 'spray' | 'marker' | 'custom' | 'image';
    weight?: number;
    scatter?: number;
    sharpness?: number;
    grain?: number;
    opacity?: number;
    spacing?: number;
    pressure?: [number, number] | [number, number, number] | ((t: number) => number);
    tip?: (surface: any) => void;
    rotate?: 'random' | 'natural';
    markerTip?: boolean;
    noise?: number;
  }
}
```

---

## 10. Gotchas for Non-p5.js Context

**Confidence: HIGH** -- identified from source code analysis and documentation.

### Gotcha 1: WebGL Origin is Canvas Center
**What:** p5.brush places (0,0) at the canvas center, not top-left.
**Fix:** Always wrap drawing in `brush.translate(-width/2, -height/2)`.
**Impact:** If forgotten, all strokes render offset by half the canvas dimensions.

### Gotcha 2: brush.render() is Mandatory
**What:** Unlike the p5.js build (which auto-composites in the draw loop), standalone requires explicit `brush.render()` after drawing.
**Fix:** Always call `brush.render()` after drawing commands.
**Warning:** p5.brush emits a console warning via `requestAnimationFrame` if you draw without calling `render()`.

### Gotcha 3: peer dependency warning for p5
**What:** `npm install p5.brush` warns about missing `p5@^2.2` peer dependency.
**Fix:** Use `--legacy-peer-deps` flag or add override to package.json. The standalone build never imports p5.

### Gotcha 4: brush.load() Sets Density to 1
**What:** `brush.load(canvas)` always uses density=1 regardless of canvas backing size.
**Fix:** For HiDPI, either: (a) size canvas to logical*dpr and scale coordinates, or (b) use `brush.createCanvas()` with `pixelDensity` option (but this creates a DOM element).
**Our approach:** OffscreenCanvas sized to logical dimensions is fine for our use case since we composite onto a Canvas2D that already handles DPR.

### Gotcha 5: Color Format Differences
**What:** p5.brush's standalone Color class accepts hex strings, CSS rgba(), and numeric RGB. It does NOT accept HSL or p5.Color objects.
**Fix:** Our paint system uses hex colors (`stroke.color: string` as hex) -- this maps directly. No conversion needed.

### Gotcha 6: No Framebuffer Support in Standalone
**What:** The standalone build does not support p5.js framebuffer objects. The `brush.load()` method accepts HTMLCanvasElement or OffscreenCanvas only.
**Fix:** Not an issue for us -- we use OffscreenCanvas.

### Gotcha 7: Custom Tip Rotation Always Uses Radians
**What:** Inside custom `tip` functions, `rotate()` always uses radians regardless of `brush.angleMode()`.
**Fix:** If defining custom tips, use `Math.PI / 4` not `45`.

### Gotcha 8: Minimum 2 Points for spline()
**What:** `brush.spline()` throws if given fewer than 2 points.
**Fix:** Guard with `if (stroke.points.length >= 2)` before calling.

### Gotcha 9: Version is Beta
**What:** v2.1.3-beta -- the standalone adapter is part of the v2.x rewrite which is still in beta (started March 2026).
**Risk:** API could change. However, the core drawing API (set/spline/line/fill) has been stable across all v2.x releases.
**Mitigation:** Pin exact version in package.json. Wrap all p5.brush calls in our own adapter layer (`brushP5Adapter.ts`) so we can absorb API changes in one file.

### Gotcha 10: WebGL2 Context Limit
**What:** Browsers limit WebGL contexts (~8-16 active contexts). p5.brush creates one WebGL2 context per `brush.load()` call.
**Fix:** Share a single OffscreenCanvas for all p5.brush rendering. Do not create separate canvases per stroke or per layer. Our existing `glslRuntime.ts` and `glBlur.ts` already consume 1-2 WebGL2 contexts.

---

## Architecture Pattern: Integration Adapter

### Recommended File Structure
```
Application/src/
  lib/
    brushP5Adapter.ts       # NEW: Adapter wrapping p5.brush standalone
    brushFxRenderer.ts       # REPLACE: Gutted to delegate to brushP5Adapter
    brushFxShaders.ts        # DELETE: No longer needed (p5.brush has its own)
    brushWatercolor.ts       # DELETE: p5.brush handles watercolor
    brushFlowField.ts        # KEEP/SIMPLIFY: May keep for custom fields
    brushPreviewData.ts      # KEEP: Static preview thumbnails
    paintRenderer.ts         # MODIFY: renderStyledStrokes calls adapter
  types/
    p5brush.d.ts             # NEW: TypeScript declarations
    paint.ts                 # KEEP: Add brush mapping constants
```

### Adapter Pattern
```typescript
// brushP5Adapter.ts - Single point of p5.brush integration

import * as brush from 'p5.brush/standalone';
import type { PaintStroke, BrushStyle } from '../types/paint';

// Map our styles to p5.brush brush names
const STYLE_MAP: Record<BrushStyle, string> = {
  flat: '',           // never reaches p5.brush
  watercolor: 'marker',  // + fill effects
  ink: 'pen',
  charcoal: 'charcoal',
  pencil: 'HB',
  marker: 'marker',
};

let _offscreen: OffscreenCanvas | null = null;
let _initialized = false;

export function ensureInitialized(width: number, height: number): void {
  if (!_offscreen || _offscreen.width !== width || _offscreen.height !== height) {
    _offscreen = new OffscreenCanvas(width, height);
    brush.load(_offscreen);
    brush.seed(42); // deterministic for export parity
    _initialized = true;
  }
}

export function renderStyledStrokes(
  strokes: PaintStroke[],
  width: number,
  height: number,
): OffscreenCanvas | null {
  const styled = strokes.filter(s => s.brushStyle && s.brushStyle !== 'flat');
  if (styled.length === 0) return null;

  ensureInitialized(width, height);

  brush.clear();
  brush.push();
  brush.translate(-width / 2, -height / 2);

  for (const stroke of styled) {
    const brushName = STYLE_MAP[stroke.brushStyle!];
    brush.set(brushName, stroke.color, stroke.size);

    // Apply FX params
    if (stroke.brushParams?.fieldStrength) {
      brush.field('curved');
      brush.wiggle(stroke.brushParams.fieldStrength);
    }

    if (stroke.points.length >= 2) {
      brush.spline(stroke.points, 0.5);
    }

    brush.noField();
  }

  brush.pop();
  brush.render();

  return _offscreen;
}

export function dispose(): void {
  _offscreen = null;
  _initialized = false;
}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brush stamp rendering | Custom WebGL2 point/quad stamping | p5.brush `set()` + `spline()` | p5.brush handles 4 tip types, pressure, scatter, grain natively |
| Spectral pigment mixing | GLSL Kubelka-Munk port from spectral.js | p5.brush's built-in blend shader | Already has full 38-band spectral mixing in fragment shader |
| Flow field distortion | Custom 2D angle grid + noise | p5.brush `field()` / `addField()` | 7 built-in presets + custom field support |
| Watercolor edge bleed | Tyler Hobbs polygon deformation | p5.brush `fillBleed()` + `fillTexture()` | Polygon deformation with configurable bleed/texture |
| Paper texture | Procedural noise fragment shader | p5.brush `fillTexture()` | Built-in texture and border simulation |
| WebGL2 framebuffer management | Multi-FBO ping-pong pipeline | p5.brush standalone context | Manages its own FBOs, shaders, compositing |

**Key insight:** Our custom implementation (`brushFxRenderer.ts` + `brushFxShaders.ts` + `brushWatercolor.ts` = ~2700 lines) attempts to replicate what p5.brush already does in 75KB of battle-tested code. The custom code produced poor visual quality because these rendering techniques require careful tuning of dozens of parameters (stamp spacing, scatter distributions, pressure curves, blend modes) that p5.brush has iterated on over 2+ years.

---

## Common Pitfalls

### Pitfall 1: Context Loss on Background Tab
**What goes wrong:** WebGL2 contexts can be lost when the browser tab goes to background.
**Why:** Browser reclaims GPU resources for foreground tabs.
**How to avoid:** Listen for `webglcontextlost` / `webglcontextrestored` on the OffscreenCanvas. On restore, call `brush.load()` again.
**Warning signs:** Strokes render as black or transparent after switching tabs.

### Pitfall 2: Forgetting coordinate translation
**What goes wrong:** All strokes appear in the wrong position (offset by half canvas).
**Why:** p5.brush uses center-origin coordinates.
**How to avoid:** Always wrap in `brush.push(); brush.translate(-w/2, -h/2); ... brush.pop();`

### Pitfall 3: Rendering one stroke at a time instead of batching
**What goes wrong:** Performance degrades significantly with many strokes.
**Why:** Each `brush.clear()` / `brush.render()` cycle involves GPU state changes and framebuffer operations.
**How to avoid:** Render ALL styled strokes for a frame in a single clear/render cycle.

### Pitfall 4: Not pinning the beta version
**What goes wrong:** Future npm install pulls a newer beta that breaks API.
**Why:** v2.x is still in beta, API may change.
**How to avoid:** Use exact version: `"p5.brush": "2.1.3-beta"` (no ^ or ~).

### Pitfall 5: WebGL context exhaustion
**What goes wrong:** Browser refuses to create WebGL2 context, p5.brush throws.
**Why:** Our app already uses 2 WebGL2 contexts (glslRuntime, glBlur). p5.brush adds a third. Some browsers cap at 8-16.
**How to avoid:** Share p5.brush's OffscreenCanvas across all brush rendering. Never create multiple OffscreenCanvas instances for p5.brush.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| WebGL2 | p5.brush rendering | Y (all modern browsers) | -- | Fall back to flat Canvas2D rendering |
| OffscreenCanvas | Offscreen brush rendering | Y (all modern browsers) | -- | Use hidden HTMLCanvasElement |
| npm | Package installation | Y | via project | -- |

**Missing dependencies:** None blocking.

---

## Sources

### Primary (HIGH confidence)
- npm package `p5.brush@2.1.3-beta` -- inspected via `npm pack` and extracted all files
- `src/adapters/standalone/target.js` -- verified OffscreenCanvas support, createCanvas, load()
- `src/adapters/standalone/frame.js` -- verified render()/clear() lifecycle
- `src/adapters/standalone/runtime.js` -- verified transform stack, color parsing
- `src/core/gl/shader.frag` -- verified Kubelka-Munk 38-band spectral mixing
- `src/stroke/stroke.js` -- verified all 11 built-in brush presets and parameters
- `src/core/primitives.js` -- verified spline() API accepting [x,y,pressure] arrays
- `src/core/flowfield.js` -- verified 7 built-in flow field presets
- `src/fill/fill.js` -- verified fillBleed/fillTexture watercolor API
- `docs/standalone.md` (GitHub) -- official standalone usage documentation

### Secondary (MEDIUM confidence)
- [GitHub README](https://github.com/acamposuribe/p5.brush) -- API overview
- [GitHub releases](https://github.com/acamposuribe/p5.brush/releases) -- version history, v2.0.0 rewrite timeline

### Notes
- Performance estimates are based on architecture analysis, not runtime benchmarks (MEDIUM confidence)
- Beta API stability assessment based on release history pattern (MEDIUM confidence)

---

## Metadata

**Confidence breakdown:**
- Standalone support: HIGH -- verified from source code and npm package
- API surface: HIGH -- verified from source code (spline, set, field, fill, render, clear, load)
- Spectral mixing: HIGH -- verified fragment shader contains full Kubelka-Munk implementation
- OffscreenCanvas: HIGH -- verified explicit support in target.js
- TypeScript types: HIGH -- verified none exist, must write our own
- Performance: MEDIUM -- architecture-based analysis, no benchmarks
- Beta stability: MEDIUM -- API appears stable across v2.0-v2.1 releases

**Research date:** 2026-03-25
**Valid until:** 2026-04-15 (beta library, check for updates)
