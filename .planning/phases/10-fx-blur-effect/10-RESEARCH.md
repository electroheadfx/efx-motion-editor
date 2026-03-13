# Phase 10: FX Blur Effect - Research

**Researched:** 2026-03-13
**Domain:** Canvas 2D blur algorithms, render pipeline integration, UI controls
**Confidence:** HIGH

## Summary

Phase 10 adds blur as a cross-cutting FX capability at three levels: per-layer blur property, per-generator blur property, and standalone blur FX layer on the timeline. The primary technical challenge is implementing two distinct blur algorithms (fast preview vs high-quality export) entirely within Canvas 2D -- without WebGL and without `ctx.filter` (which is broken in Tauri WebKit on tainted canvases, as documented in `fxColorGrade.ts`).

For fast preview blur, the downscale-upscale technique is the recommended approach: draw to a smaller offscreen canvas (1/2, 1/4, 1/8 resolution depending on blur radius) then scale back up with `imageSmoothingEnabled = true`. This provides a convincing blur approximation with minimal CPU cost -- just two `drawImage` calls per blur pass. This is the Canvas 2D equivalent of Dual Kawase's downscale/upsample strategy but uses the browser's built-in bilinear interpolation instead of custom shaders. For high-quality export blur, use the `stackblur-canvas` library (500K weekly npm downloads, MIT license, works directly with `ImageData` / `CanvasRenderingContext2D`) which provides a fast approximation of Gaussian blur via the StackBlur algorithm operating on pixel data.

The architecture integrates cleanly with existing patterns: layer-level and generator-level blur use offscreen canvases per-layer (similar to the video rasterization pattern in `drawLayer`), while standalone blur follows the `applyColorGrade` adjustment layer pattern. A new `blurStore` manages the two global toolbar toggles (HQ Preview, Bypass Blur) as Preact signals.

**Primary recommendation:** Use downscale-upscale for fast preview blur (zero dependencies, two drawImage calls) and `stackblur-canvas` for HQ/export blur. Add a `blur` property directly to the `Layer` interface for layer-level and generator-level blur. Create a new `adjustment-blur` layer type for standalone blur FX.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full-frame blur only -- no tilt-shift, radial, or directional modes (future phase)
- Static blur strength within FX range -- no fade in/out ramps over time
- Blur appears alongside existing effects in the Add FX menu (no category reorganization)
- Three levels of blur: layer-level (radius slider in LAYERS sidebar), generator-level (radius slider in generator properties, preserve alpha), standalone blur FX layer (full compositing controls)
- Primary parameter: blur radius slider, normalized 0.0-1.0 range scaled to canvas dimensions (resolution-independent)
- Default radius: 0 (no blur)
- No lockSeed/deterministic toggle -- blur is deterministic by nature
- Layer blur applied before compositing; generator blur applied to output (RGB only, preserve alpha); standalone blur reads full composite below
- Blur applications stack -- no special-case logic, each blur is independent
- Standalone blur supports full compositing: opacity and blend mode controls
- Auto quality switching: playback/scrubbing use fast blur; PNG export uses Gaussian
- HQ Preview toggle: global toolbar toggle forces Gaussian during preview
- Bypass Blur toggle: global toolbar toggle disables all blur everywhere
- Both toggles in the top toolbar (not canvas bottom bar)
- Both toggles get keyboard shortcuts
- No visual indicator for quality mode -- the HQ toggle state is sufficient
- Scrubbing always uses fast mode unless HQ toggle is on

### Claude's Discretion
- Dual Kawase implementation details (number of passes, downscale factor)
- Gaussian kernel implementation for export quality
- Keyboard shortcut key assignments for HQ and Bypass toggles
- Toolbar button styling and placement within existing toolbar layout
- Exact normalized radius range and curve (linear vs logarithmic slider feel)
- How blur interacts with the existing PreviewRenderer draw loop architecture

### Deferred Ideas (OUT OF SCOPE)
- Selective blur modes (tilt-shift, radial, directional/motion blur) -- future phase
- Blur fade in/out ramps over FX range -- future phase (requires per-frame parameter interpolation)
- FX menu reorganization into categories (Generators vs Adjustments) -- future cleanup
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| stackblur-canvas | latest | HQ blur (StackBlur algorithm on ImageData) | 500K+ weekly npm downloads, MIT, works with Canvas 2D getImageData/putImageData, fast near-Gaussian quality |
| Canvas 2D (built-in) | N/A | Fast preview blur via downscale-upscale drawImage | Zero dependencies, uses browser's built-in bilinear interpolation, 2 drawImage calls per blur |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @preact/signals | ^2.8.1 | Already in project -- blurStore signals for HQ/Bypass toggles | Global reactive state for blur quality mode |
| tinykeys | ^3.0.0 | Already in project -- keyboard shortcut registration | HQ Preview and Bypass Blur toggle shortcuts |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| stackblur-canvas | ctx.filter = 'blur(Xpx)' | ctx.filter is broken in Tauri WebKit on tainted canvases (documented in fxColorGrade.ts) -- NOT viable |
| stackblur-canvas | Manual Gaussian convolution via getImageData | Much slower (O(radius^2) per pixel), complex to implement correctly, StackBlur is a well-tested near-Gaussian approximation |
| Downscale-upscale | WebGL Dual Kawase shaders | This project uses Canvas 2D exclusively -- adding WebGL would be a major architecture change; downscale-upscale achieves the same visual effect in Canvas 2D |

**Installation:**
```bash
cd Application && pnpm add stackblur-canvas
```

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  lib/
    fxBlur.ts              # Blur algorithm implementations (fast + HQ)
    fxGenerators.ts        # Existing -- no changes needed
    fxColorGrade.ts        # Existing -- pattern reference for standalone blur
    previewRenderer.ts     # Modified -- integrate blur at 3 levels
  stores/
    blurStore.ts           # HQ Preview + Bypass Blur toggle signals
  types/
    layer.ts               # Modified -- add blur property + adjustment-blur type
  components/
    layout/
      Toolbar.tsx          # Modified -- add HQ + Bypass toggle buttons
      PropertiesPanel.tsx  # Modified -- add BlurSection for standalone blur + blur slider for layers/generators
    overlay/
      ShortcutsOverlay.tsx # Modified -- add blur shortcut entries
    timeline/
      AddFxMenu.tsx        # Modified -- add Blur entry under Adjustments
```

### Pattern 1: Downscale-Upscale Fast Blur
**What:** Draw content to a smaller offscreen canvas, then draw back to target at full size with `imageSmoothingEnabled = true`. The browser's bilinear interpolation creates a blur effect. Multiple downscale steps increase blur radius.
**When to use:** During playback preview and scrubbing (fast mode).
**Example:**
```typescript
// Source: Canvas 2D downscale-upscale blur technique
// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas

function applyFastBlur(
  sourceCanvas: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  radius: number, // normalized 0-1
  width: number,
  height: number,
): void {
  if (radius <= 0) return;

  // Map normalized radius to downscale passes (1-4 passes)
  // Each pass halves resolution, creating progressively more blur
  const passes = Math.max(1, Math.min(4, Math.ceil(radius * 4)));

  // Create two ping-pong offscreen canvases (cached, reused)
  const tmpA = getCachedCanvas('blurA', width, height);
  const tmpB = getCachedCanvas('blurB', width, height);

  const ctxA = tmpA.getContext('2d')!;
  const ctxB = tmpB.getContext('2d')!;

  // Initial copy
  ctxA.clearRect(0, 0, width, height);
  ctxA.drawImage(sourceCanvas, 0, 0, width, height);

  let current = tmpA;
  let currentCtx = ctxA;
  let other = tmpB;
  let otherCtx = ctxB;
  let w = width;
  let h = height;

  // Downscale passes
  for (let i = 0; i < passes; i++) {
    const newW = Math.max(1, Math.floor(w / 2));
    const newH = Math.max(1, Math.floor(h / 2));
    otherCtx.clearRect(0, 0, newW, newH);
    otherCtx.imageSmoothingEnabled = true;
    otherCtx.drawImage(current, 0, 0, w, h, 0, 0, newW, newH);
    w = newW;
    h = newH;
    // Swap
    [current, other] = [other, current];
    [currentCtx, otherCtx] = [otherCtx, currentCtx];
  }

  // Upscale back to full size
  targetCtx.imageSmoothingEnabled = true;
  targetCtx.drawImage(current, 0, 0, w, h, 0, 0, width, height);
}
```

### Pattern 2: StackBlur HQ Blur
**What:** Use stackblur-canvas library to apply near-Gaussian blur directly on canvas pixel data.
**When to use:** During PNG export or when HQ Preview toggle is active.
**Example:**
```typescript
// Source: stackblur-canvas npm (https://github.com/flozz/StackBlur)
import StackBlur from 'stackblur-canvas';

function applyHQBlur(
  canvas: HTMLCanvasElement,
  radius: number, // normalized 0-1
  width: number,
  height: number,
  preserveAlpha: boolean = false,
): void {
  if (radius <= 0) return;

  // Map normalized radius to pixel radius (scale to canvas dimension)
  const maxDim = Math.max(width, height);
  const pixelRadius = Math.max(1, Math.round(radius * maxDim * 0.05));

  if (preserveAlpha) {
    // RGB only -- preserves alpha channel (for generator blur)
    StackBlur.canvasRGB(canvas, 0, 0, width, height, pixelRadius);
  } else {
    // RGBA -- blurs alpha too (for full-frame blur)
    StackBlur.canvasRGBA(canvas, 0, 0, width, height, pixelRadius);
  }
}
```

### Pattern 3: Layer Blur via Offscreen Canvas
**What:** For per-layer and per-generator blur, render the layer to an offscreen canvas, apply blur, then composite the blurred result onto the main canvas. Follows the existing video rasterization pattern in `drawLayer`.
**When to use:** When a layer has `blur > 0` (layer-level or generator-level blur).
**Example:**
```typescript
// In PreviewRenderer -- pattern similar to video offscreen rasterization
private applyLayerBlur(
  layerCanvas: HTMLCanvasElement,
  blur: number,
  width: number,
  height: number,
  preserveAlpha: boolean,
): void {
  if (blur <= 0 || this.isBlurBypassed()) return;

  if (this.isHQMode()) {
    applyHQBlur(layerCanvas, blur, width, height, preserveAlpha);
  } else {
    const ctx = layerCanvas.getContext('2d')!;
    applyFastBlur(layerCanvas, ctx, blur, width, height);
  }
}
```

### Pattern 4: Standalone Blur as Adjustment Layer
**What:** Standalone blur follows the `applyColorGrade` adjustment layer pattern -- reads full composite below, applies blur, writes back. Uses `adjustment-blur` layer type.
**When to use:** When blur is added as a standalone FX sequence from the Add FX menu.
**Example:**
```typescript
// In PreviewRenderer.drawAdjustmentLayer -- new case alongside color-grade
case 'adjustment-blur': {
  if (this.isBlurBypassed()) break;
  const blurRadius = layer.source.radius;
  if (blurRadius <= 0) break;

  // Reset transform to physical pixel coords (same as color-grade)
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  if (this.isHQMode()) {
    applyHQBlur(this.canvas, blurRadius * layer.opacity,
      this.canvas.width, this.canvas.height, false);
  } else {
    applyFastBlur(this.canvas, ctx, blurRadius * layer.opacity,
      this.canvas.width, this.canvas.height);
  }
  break;
}
```

### Pattern 5: blurStore for Global Toggles
**What:** New store with two Preact signals for HQ Preview and Bypass Blur, following existing store patterns (canvasStore, uiStore).
**When to use:** Global blur quality and bypass state.
**Example:**
```typescript
// stores/blurStore.ts
import { signal } from '@preact/signals';

const hqPreview = signal(false);
const bypassBlur = signal(false);

export const blurStore = {
  hqPreview,
  bypassBlur,

  toggleHQ() { hqPreview.value = !hqPreview.value; },
  toggleBypass() { bypassBlur.value = !bypassBlur.value; },

  /** True when blur should use HQ algorithm (HQ toggle ON, or export mode) */
  isHQ(): boolean { return hqPreview.peek(); },

  /** True when all blur should be skipped */
  isBypassed(): boolean { return bypassBlur.peek(); },

  reset() {
    hqPreview.value = false;
    bypassBlur.value = false;
  },
};
```

### Anti-Patterns to Avoid
- **Using ctx.filter = 'blur(Xpx)':** Broken in Tauri WebKit on tainted canvases. The existing codebase already documents this in `fxColorGrade.ts` (line 4 and line 125). Do NOT use ctx.filter for any blur operation.
- **Creating new offscreen canvases every frame:** Allocating HTMLCanvasElement per frame causes GC pressure. Cache and reuse offscreen canvases (pattern already used in fxColorGrade.ts with `getOffscreen()`).
- **Blurring the main canvas in-place for layer blur:** This would blur ALL content below. Layer-level blur must render to an isolated offscreen canvas first, then composite the blurred result.
- **Using getImageData/putImageData for fast preview:** Pixel-level operations are too slow for real-time playback. Only use for HQ/export mode via StackBlur.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Near-Gaussian blur on pixel data | Custom convolution kernel | stackblur-canvas | Handles edge cases (boundary clamping, integer overflow), optimized sliding stack algorithm, 15+ years battle-tested |
| Fast preview blur | Custom downscale shader | drawImage downscale-upscale | Browser's bilinear interpolation is hardware-accelerated and already available in Canvas 2D |
| Keyboard shortcut binding | Custom keydown listener | tinykeys (already in project) | Handles modifier keys, key combos, OS-specific behavior (already used for all shortcuts) |
| Reactive global state | Custom event emitter | @preact/signals (already in project) | Consistent with all existing stores (canvasStore, uiStore, blurStore pattern) |

**Key insight:** The `ctx.filter` prohibition is the most important constraint. Without it, blur must be implemented through either pixel manipulation (StackBlur) or resolution tricks (downscale-upscale). Both approaches are well-understood and fit naturally into the existing Canvas 2D architecture.

## Common Pitfalls

### Pitfall 1: ctx.filter Broken in Tauri WebKit
**What goes wrong:** `ctx.filter = 'blur(Xpx)'` silently fails in Tauri's WebKit WebView when the canvas is tainted (uses custom protocol images).
**Why it happens:** Tauri's `efxasset://` protocol loads images that taint the canvas. WebKit silently ignores ctx.filter on tainted canvases.
**How to avoid:** Never use ctx.filter. Use StackBlur (pixel manipulation) or downscale-upscale (drawImage scaling) instead.
**Warning signs:** Blur works in browser dev mode but fails in Tauri production build.

### Pitfall 2: Generator Blur Alpha Halo
**What goes wrong:** Blurring a generator (grain, particles) that has alpha transparency causes dark/light halos around particles because blur smears the alpha channel, causing premultiplied alpha artifacts.
**Why it happens:** When blurring RGBA, the blur radius extends opaque pixels into transparent areas, creating visible edges.
**How to avoid:** For generator-level blur, use RGB-only blur (StackBlur.canvasRGB / skip alpha in downscale). The alpha channel must be preserved unblurred so compositing remains clean.
**Warning signs:** Blurred grain/particles have visible rectangular edges or dark outlines when composited over the scene.

### Pitfall 3: Offscreen Canvas Memory Pressure
**What goes wrong:** Creating new offscreen canvases per frame per layer causes memory churn and GC pauses, stuttering playback.
**Why it happens:** Each `document.createElement('canvas')` allocates GPU-backed memory. Multiple layers with blur each need their own offscreen canvas.
**How to avoid:** Cache offscreen canvases and reuse them (resize only when dimensions change). Follow the pattern in `fxColorGrade.ts` (`getOffscreen()` with cached `_offscreen` variable). Pool a small set of blur canvases.
**Warning signs:** Playback gets progressively slower, memory usage climbs in dev tools.

### Pitfall 4: DPI Scaling Mismatch
**What goes wrong:** Blur radius appears different at different DPI settings or zoom levels because the radius is applied in physical pixels but the user thinks in logical pixels.
**Why it happens:** PreviewRenderer scales by `dpr` (devicePixelRatio) for Retina displays. Blur radius must account for this scaling.
**How to avoid:** Apply blur after DPI scaling or normalize the radius to logical dimensions. The normalized 0-1 range should map to logical canvas dimensions, then be multiplied by DPR when computing actual pixel radius.
**Warning signs:** Blur looks weaker on Retina displays or inconsistent between preview and export.

### Pitfall 5: Standalone Blur FX Ordering
**What goes wrong:** Standalone blur FX layer reads the composite but applies to the wrong scope because of the render loop structure. FX sequences are composited in a second pass (see `Preview.tsx` lines 43-52) after content sequences.
**Why it happens:** The current rendering architecture renders content layers first, then overlays FX sequences. A standalone blur FX needs to read and modify the full composite that exists so far.
**How to avoid:** Standalone blur adjustment layers work within the FX sequence overlay pass. Since FX sequences are already rendered with `clearCanvas = false`, the blur reads whatever is on the canvas at that point (content + earlier FX). This naturally works with the existing architecture.
**Warning signs:** Blur only affects FX layers above it instead of the full composite.

### Pitfall 6: Performance of HQ Blur During Preview
**What goes wrong:** Enabling HQ Preview toggle causes frame drops because StackBlur processes every pixel for every blurred layer on every frame.
**Why it happens:** StackBlur operates on pixel data (getImageData/putImageData) which is CPU-bound and copies data between CPU and GPU memory.
**How to avoid:** Document that HQ Preview is for quality checks, not continuous playback. The Bypass Blur toggle exists specifically for performance recovery. Consider caching the HQ blur result when the frame hasn't changed.
**Warning signs:** FPS drops significantly when HQ toggle is enabled with multiple blur layers.

## Code Examples

### Type System Extensions

```typescript
// types/layer.ts -- additions

export type LayerType =
  | 'static-image'
  | 'image-sequence'
  | 'video'
  | 'generator-grain'
  | 'generator-particles'
  | 'generator-lines'
  | 'generator-dots'
  | 'generator-vignette'
  | 'adjustment-color-grade'
  | 'adjustment-blur';        // NEW: standalone blur FX

export type LayerSourceData =
  | { type: 'static-image'; imageId: string }
  // ... existing types ...
  | { type: 'adjustment-blur'; radius: number };  // NEW

export interface Layer {
  id: string;
  name: string;
  type: LayerType;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  transform: LayerTransform;
  source: LayerSourceData;
  isBase?: boolean;
  blur?: number;  // NEW: per-layer blur radius (0-1, normalized)
}
```

### Blur Algorithm Module

```typescript
// lib/fxBlur.ts

// Cached offscreen canvases for blur operations
let _blurCanvasA: HTMLCanvasElement | null = null;
let _blurCanvasB: HTMLCanvasElement | null = null;

function getBlurCanvas(
  slot: 'A' | 'B',
  w: number,
  h: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const ref = slot === 'A' ? _blurCanvasA : _blurCanvasB;
  let canvas = ref;
  if (!canvas) {
    canvas = document.createElement('canvas');
    if (slot === 'A') _blurCanvasA = canvas;
    else _blurCanvasB = canvas;
  }
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

/**
 * Fast blur via downscale-upscale.
 * Draws sourceCanvas through multiple half-resolution passes,
 * then scales back up. Uses browser bilinear interpolation.
 */
export function applyFastBlur(
  source: HTMLCanvasElement,
  targetCtx: CanvasRenderingContext2D,
  radius: number,
  width: number,
  height: number,
): void {
  // ... implementation as shown in Pattern 1
}

/**
 * High-quality blur via StackBlur algorithm.
 * Operates directly on canvas pixel data.
 */
export function applyHQBlur(
  canvas: HTMLCanvasElement,
  radius: number,
  width: number,
  height: number,
  preserveAlpha: boolean,
): void {
  // ... implementation as shown in Pattern 2
}
```

### PreviewRenderer Integration Points

```typescript
// In previewRenderer.ts -- layer-level blur integration

// For content layers with blur > 0:
// 1. Render layer to offscreen canvas
// 2. Apply blur to offscreen canvas
// 3. Composite blurred offscreen onto main canvas
private drawLayerWithBlur(
  source: CanvasImageSource,
  layer: Layer,
  canvasW: number,
  canvasH: number,
): void {
  if (!layer.blur || layer.blur <= 0 || blurStore.isBypassed()) {
    // No blur -- use existing drawLayer path
    this.drawLayer(source, layer, canvasW, canvasH);
    return;
  }

  // Render to offscreen canvas, apply blur, composite
  // (offscreen canvas pattern matches existing video rasterization)
}

// For generator layers with blur:
// 1. Render generator to offscreen canvas (not main canvas)
// 2. Apply RGB-only blur (preserve alpha)
// 3. Composite blurred offscreen onto main canvas
private drawGeneratorLayerWithBlur(
  layer: Layer,
  logicalW: number,
  logicalH: number,
  frame: number,
): void {
  // Similar to drawGeneratorLayer but routes through offscreen + blur
}
```

### Toolbar Toggle Buttons

```typescript
// In Toolbar.tsx -- blur toggle buttons placement
// Add between the ThemeSwitcher and the spacer

{/* Blur Controls */}
<div class="w-px h-6 bg-[var(--color-border-subtle)]" />
<button
  class={`rounded-[5px] px-2.5 py-1 transition-colors ${
    blurStore.hqPreview.value
      ? 'bg-[var(--color-accent)]'
      : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)]'
  }`}
  onClick={() => blurStore.toggleHQ()}
  title="HQ Blur Preview (B)"
>
  <span class={`text-[10px] ${
    blurStore.hqPreview.value ? 'text-white' : 'text-[var(--color-text-secondary)]'
  }`}>HQ</span>
</button>
<button
  class={`rounded-[5px] px-2.5 py-1 transition-colors ${
    blurStore.bypassBlur.value
      ? 'bg-[var(--color-dot-orange)]'
      : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)]'
  }`}
  onClick={() => blurStore.toggleBypass()}
  title="Bypass All Blur (Shift+B)"
>
  <span class={`text-[10px] ${
    blurStore.bypassBlur.value ? 'text-white' : 'text-[var(--color-text-secondary)]'
  }`}>Blur Off</span>
</button>
```

### Keyboard Shortcuts

```typescript
// In shortcuts.ts -- recommended key assignments
// B = toggle HQ blur preview
// Shift+B = toggle bypass all blur

'KeyB': (e: KeyboardEvent) => {
  if (shouldSuppressShortcut(e)) return;
  e.preventDefault();
  blurStore.toggleHQ();
},
'Shift+KeyB': (e: KeyboardEvent) => {
  if (shouldSuppressShortcut(e)) return;
  e.preventDefault();
  blurStore.toggleBypass();
},
```

### Normalized Radius to Pixel Radius Mapping

```typescript
// Recommendation: logarithmic-feel mapping for better UX at low values
// normalized 0-1 range where 0.1 gives subtle blur, 1.0 gives heavy blur

function normalizedToPixelRadius(normalized: number, canvasMaxDim: number): number {
  // Scale factor: at normalized=1.0, blur radius is ~5% of max dimension
  // This gives a good range from subtle (1-2px) to heavy blur
  // Quadratic curve gives finer control at low values
  const scaled = normalized * normalized; // quadratic for better low-end control
  return Math.max(0, Math.round(scaled * canvasMaxDim * 0.05));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ctx.filter = 'blur(Xpx)' | StackBlur / downscale-upscale | N/A (ctx.filter never worked in Tauri) | Must avoid ctx.filter entirely; pixel-level or scaling-based blur required |
| WebGL shaders for blur | Canvas 2D with StackBlur library | N/A (project is Canvas 2D only) | No WebGL in this project; StackBlur provides near-Gaussian quality in pure Canvas 2D |
| Heavy Gaussian convolution | StackBlur approximation | 2004+ (Mario Klingemann) | O(n) vs O(n*radius) -- StackBlur is linear time regardless of radius |

**Deprecated/outdated:**
- `ctx.filter`: While standardized across browsers since Sept 2024, it remains broken in Tauri WebKit with tainted canvases. Do not use.

## Open Questions

1. **Export pipeline integration**
   - What we know: Export is Phase 17 (PNG Export). PreviewRenderer is designed to be reusable at arbitrary resolutions. The Toolbar has an "Export" button but no export logic yet.
   - What's unclear: How will the export pipeline signal "use HQ blur"? Currently there's no export rendering path.
   - Recommendation: Add an `isExporting` parameter or have the export pipeline set `blurStore.hqPreview = true` before rendering export frames. Or pass a `blurQuality: 'fast' | 'hq'` parameter to the blur functions directly.

2. **Blur radius normalization curve**
   - What we know: User decision specifies 0-1 normalized range. Existing FX params use linear 0-1 ranges.
   - What's unclear: Whether linear or quadratic/logarithmic mapping feels better for the blur slider.
   - Recommendation: Start with quadratic mapping (`radius * radius * maxDim * 0.05`) for finer low-end control. Can be adjusted after user testing.

3. **Performance ceiling for multiple blur layers**
   - What we know: Each blurred layer needs an offscreen canvas + blur pass. Fast blur is ~2 drawImage calls. HQ blur is full pixel scan.
   - What's unclear: What's the practical limit before playback stutters (3 blurred layers? 5?).
   - Recommendation: The Bypass Blur toggle exists for exactly this scenario. Fast blur should handle 3-5 layers at 1080p comfortably. HQ mode is inherently slower -- user should expect reduced performance.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected |
| Config file | None -- no test infrastructure in project |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| N/A | Blur appears in Add FX menu | manual-only | Visual inspection in Tauri app | N/A |
| N/A | Fast blur during playback | manual-only | Play sequence with blur layer, check FPS | N/A |
| N/A | HQ blur during export | manual-only | Toggle HQ, compare quality visually | N/A |
| N/A | Blur radius slider updates in real-time | manual-only | Drag slider, observe preview | N/A |
| N/A | Bypass toggle disables all blur | manual-only | Toggle bypass, verify no blur visible | N/A |
| N/A | Generator blur preserves alpha | manual-only | Add grain + blur, check no halos | N/A |

### Sampling Rate
- **Per task commit:** Manual visual inspection in Tauri dev mode
- **Per wave merge:** Full manual walkthrough of all blur levels and toggles
- **Phase gate:** All success criteria verified visually

### Wave 0 Gaps
- No test infrastructure exists in this project
- All validation is manual (visual inspection in Tauri app)
- This is consistent with all previous phases (Phases 1-9 had no automated tests)

## Sources

### Primary (HIGH confidence)
- `/Users/lmarques/Dev/efx-motion-editor/Application/src/lib/fxColorGrade.ts` -- ctx.filter prohibition confirmed (lines 4, 125)
- `/Users/lmarques/Dev/efx-motion-editor/Application/src/lib/previewRenderer.ts` -- full render pipeline architecture, offscreen canvas patterns
- `/Users/lmarques/Dev/efx-motion-editor/Application/src/types/layer.ts` -- existing type system, LayerType union, LayerSourceData union
- `/Users/lmarques/Dev/efx-motion-editor/Application/src/lib/shortcuts.ts` -- keyboard shortcut registration pattern (tinykeys)
- `/Users/lmarques/Dev/efx-motion-editor/Application/src/components/layout/Toolbar.tsx` -- toolbar layout and button patterns
- `/Users/lmarques/Dev/efx-motion-editor/Application/src/components/layout/PropertiesPanel.tsx` -- FxSection dispatch, NumericInput component
- `/Users/lmarques/Dev/efx-motion-editor/Application/src/components/timeline/AddFxMenu.tsx` -- Add FX menu pattern
- [StackBlur GitHub](https://github.com/flozz/StackBlur) -- API documentation, MIT license, Canvas 2D integration
- [MDN Canvas 2D Optimizing](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) -- offscreen canvas, drawImage performance

### Secondary (MEDIUM confidence)
- [Dual Kawase Blur blog](https://blog.frost.kiwi/dual-kawase/) -- Algorithm concept (GPU-focused, adapted as downscale-upscale for Canvas 2D)
- [Tauri tainted canvas issue #12999](https://github.com/tauri-apps/tauri/issues/12999) -- Confirms canvas taint with custom protocols
- [Joan Xie - Real-time Video Gaussian Blurs](https://medium.com/quick-code/a-simple-technique-for-real-time-video-gaussian-blurs-that-did-seem-to-work-42b2c6bb9989) -- Downscale technique for blur

### Tertiary (LOW confidence)
- None -- all findings verified through project code or official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- StackBlur is well-established (500K+ weekly downloads), downscale-upscale is a proven Canvas 2D technique
- Architecture: HIGH -- Patterns directly mirror existing codebase (fxColorGrade adjustment layer, offscreen canvas, PreviewRenderer integration points)
- Pitfalls: HIGH -- ctx.filter prohibition confirmed from project source code, alpha halo is a well-known compositing issue

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (stable domain -- Canvas 2D APIs are mature)
