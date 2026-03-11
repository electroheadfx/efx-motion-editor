# Phase 7: Cinematic FX Effects - Research

**Researched:** 2026-03-10
**Domain:** Canvas 2D procedural effects, pixel manipulation, seeded PRNG, layer type extension
**Confidence:** HIGH

## Summary

Phase 7 adds cinematic post-processing effects via two pipelines: imported video overlays (reusing Phase 6 video infrastructure) and procedural generators that draw directly into the Canvas 2D compositor. The procedural effects include film grain, particles, random lines/strokes, animated dots, vignette, and color grade. All effects are timeline layers with in/out points, freely positionable in the layer stack.

The implementation builds almost entirely on existing infrastructure. Video overlays reuse the Phase 6 video layer pipeline verbatim. Procedural generators draw directly onto the Canvas 2D context within PreviewRenderer's existing `drawLayer()` loop -- no MC scene graph needed, though MC's `Random` class provides the seeded PRNG for reproducible output. Color grade uses ImageData pixel manipulation (not `ctx.filter`, which has Safari compatibility concerns and cannot express the "fade to tint" parameter). Vignette uses `createRadialGradient()`, a universally-supported Canvas 2D API.

The main architectural changes are: extending `LayerType` and `LayerSourceData` with generator/adjustment types, adding in/out point fields to the `Layer` interface, extending `PreviewRenderer` with a generator rendering path, building FX-specific properties panel sections, and extending the AddLayerMenu with categorized FX options. The `.mce` project format needs a version bump to 3 to persist FX-specific layer data.

**Primary recommendation:** Implement all procedural effects as pure Canvas 2D drawing functions that receive `(ctx, canvasW, canvasH, params, frame, seed)`. Use MC's `Random` class standalone (imported from `@efxlab/motion-canvas-core`) for deterministic noise -- no MC scene/node tree needed. Color grade via ImageData getImageData/putImageData for cross-platform safety.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **FX architecture -- two pipelines**: Imported video overlays (reuses Phase 6 video layer infrastructure) and procedural generators (new layer source type "generator" that calls MC primitives to draw directly into Canvas 2D compositor at render time)
- **Procedural generator effects (full suite)**: Film grain, particles, random lines/strokes, animated dots, vignette, color grade
- **Randomness behavior**: Seeded/reproducible by default via deterministic seed; per-effect "Lock seed" toggle (locked=reproducible, unlocked=fresh randomness)
- **FX stacking & ordering**: Freely positionable anywhere in layer stack, unlimited instances, stack-based compositing via blend modes
- **FX layer duration**: In/out points per FX layer (clip-like behavior, not full-sequence-only); FX layers can start/end at specific frames
- **Color grade**: Built-in presets dropdown (Warm, Cool, Vintage, Bleach Bypass, etc.); five parameters (brightness, contrast, saturation, hue, fade); fade blends toward user-choosable tint color (default warm sepia); no custom preset save/load
- **FX UI presentation**: Categorized menu (Overlays, Generators, Adjustments); FX layers get distinct accent color in layer panel; FX-specific properties panel replaces transform section
- **No bundled assets**: User imports for overlays, code-generated for procedural effects

### Claude's Discretion
- Exact MC integration pattern for generator layers drawing into Canvas 2D
- Specific procedural effect parameters (particle count, speed, size ranges, etc.)
- Color grade preset values (exact brightness/contrast/saturation/hue/fade numbers per preset)
- Accent color choice for FX layers in the panel
- How in/out points are represented in the layer data model and timeline UI
- Lock seed toggle UI placement and default seed values

### Deferred Ideas (OUT OF SCOPE)
- Custom color grade preset save/load -- future phase
- AFX-02: Dual-quality rendering (Dual Kawase vs Gaussian blur toggle) -- future phase
- AFX-03: Composition templates (save/load FX presets) -- future phase
- AFX-04: Layer loop modes -- future phase

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FX-01 | User can add film grain effect (grain texture overlay with multiply blend) | Procedural generator using seeded Random + Canvas 2D fillRect for individual grain dots; drawn in PreviewRenderer's layer loop |
| FX-02 | User can adjust grain intensity | FX params stored on Layer.source; PropertiesPanel FX section with NumericInput slider |
| FX-03 | User can add vignette effect (radial gradient with multiply blend) | createRadialGradient() Canvas 2D API; drawn as full-canvas gradient overlay |
| FX-04 | User can adjust vignette intensity, size, and softness | Three parameters on vignette source data; NumericInput controls in PropertiesPanel |
| FX-05 | User can add color grade effect (brightness, contrast, saturation, hue, fade) | ImageData pixel manipulation (getImageData/putImageData); operates on composited output below |
| FX-06 | User can adjust color grade parameters individually | Five NumericInput sliders + preset dropdown + tint color picker in PropertiesPanel |
| FX-07 | User can add dirt/scratches effect (image sequence overlay with screen blend) | Reuses existing video overlay pipeline from Phase 6; imported video files |
| FX-08 | User can add light leaks effect (video overlay with screen blend) | Reuses existing video overlay pipeline from Phase 6; imported video files |
| FX-09 | User can adjust intensity for all FX effects | Intensity maps to layer opacity (existing opacity slider); all FX layers already have opacity control |
| FX-10 | FX parameters are resolution-independent (preview and export look identical) | All procedural drawing uses normalized coordinates (0-1 range scaled to canvas dimensions); seeded PRNG ensures same pattern at any resolution |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Canvas 2D API | native | Compositing, gradient rendering, pixel manipulation | Already used by PreviewRenderer; universal WebKit support |
| `@efxlab/motion-canvas-core` Random class | 4.0.0 | Seeded PRNG (Mulberry32) for reproducible procedural effects | Already installed; deterministic seed-based generation without MC scene graph |
| ImageData API | native | Pixel-level color grade (brightness, contrast, saturation, hue, fade) | getImageData/putImageData work universally; no browser compat concerns |
| createRadialGradient() | native | Vignette effect (radial darkening from center) | Standard Canvas 2D API with full support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@preact/signals` | ^2.8.1 | Reactive FX parameter storage | All FX params stored as part of layer state (via sequenceStore signals) |
| Existing PreviewRenderer | n/a | Layer compositing engine | Extended with generator rendering path alongside existing drawImage path |
| Existing video layer infrastructure | n/a | Imported FX overlay rendering | Dirt/scratches and light leaks reuse Phase 6 video path verbatim |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ImageData pixel manipulation | ctx.filter CSS filters | ctx.filter is faster but cannot express "fade to tint" and has a Safari 18+ requirement (build target is safari13); ImageData is safer and more flexible |
| MC Random class | Custom Mulberry32 | MC Random is already available, well-tested, identical algorithm; no reason to reimplement |
| Full MC scene graph for generators | Direct Canvas 2D drawing | Context says generators draw "directly into Canvas 2D compositor" -- no MC node tree needed. MC's value is the Random PRNG, not the renderer |
| WebGL shaders for color grading | Canvas 2D ImageData | WebGL would be faster but introduces a second rendering context and complexity; ImageData is sufficient for the parameter count (5 sliders) |

## Architecture Patterns

### Recommended Project Structure
```
Application/src/
  types/
    layer.ts                    # Extended: new FX LayerTypes, source data interfaces, in/out points
  lib/
    previewRenderer.ts          # Extended: generator rendering path, color grade pipeline
    fxGenerators.ts             # NEW: procedural drawing functions (grain, particles, lines, dots)
    fxColorGrade.ts             # NEW: ImageData color grading (brightness, contrast, saturation, hue, fade)
    fxPresets.ts                # NEW: color grade preset definitions
  components/
    layer/
      AddLayerMenu.tsx          # Extended: categorized FX menu (Overlays, Generators, Adjustments)
      LayerList.tsx             # Extended: FX accent color for FX layer rows
    layout/
      PropertiesPanel.tsx       # Extended: FX-specific parameter sections (replace transform for FX layers)
  stores/
    projectStore.ts             # Extended: serialize/deserialize FX layer data, version bump to 3
  types/
    project.ts                  # Extended: MceLayer gains FX-specific fields
```

### Pattern 1: Generator as Pure Drawing Function
**What:** Each procedural effect is a pure function `(ctx, width, height, params, frame, seed) => void` that draws directly onto the Canvas 2D context. No classes, no MC nodes -- just Canvas API calls.
**When to use:** For all procedural generators (grain, particles, lines, dots, vignette).
**Example:**
```typescript
// Source: Application architecture, Canvas 2D API
import { Random } from '@efxlab/motion-canvas-core';

interface GrainParams {
  density: number;      // 0-1, fraction of canvas pixels that get grain dots
  size: number;         // 1-4, pixel size of each grain dot
  intensity: number;    // 0-1, max alpha for grain dots
  lockSeed: boolean;
  seed: number;
}

export function drawGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: GrainParams,
  frame: number,
): void {
  // Seed: if locked, use fixed seed + frame for reproducibility
  // If unlocked, use frame * some prime for variety
  const effectiveSeed = params.lockSeed
    ? params.seed + frame
    : Date.now() + frame;
  const rng = new Random(effectiveSeed);

  const dotCount = Math.floor(width * height * params.density * 0.01);

  for (let i = 0; i < dotCount; i++) {
    const x = rng.nextFloat(0, width);
    const y = rng.nextFloat(0, height);
    const alpha = rng.nextFloat(0, params.intensity);
    const brightness = rng.nextInt(0, 2) === 0 ? 0 : 255; // dark or light grain

    ctx.fillStyle = `rgba(${brightness},${brightness},${brightness},${alpha})`;
    ctx.fillRect(Math.floor(x), Math.floor(y), params.size, params.size);
  }
}
```

### Pattern 2: Color Grade via ImageData
**What:** Color grading reads all composited pixels below, transforms them, and writes back. Uses getImageData/putImageData for full control over brightness, contrast, saturation, hue rotation, and fade-to-tint.
**When to use:** For the color grade adjustment layer.
**Example:**
```typescript
// Source: Canvas 2D API, MDN pixel manipulation
export function applyColorGrade(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: ColorGradeParams,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i], g = data[i + 1], b = data[i + 2];

    // Brightness: add offset
    r += params.brightness * 255;
    g += params.brightness * 255;
    b += params.brightness * 255;

    // Contrast: scale from midpoint
    const factor = (1 + params.contrast) / (1.001 - params.contrast);
    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    b = factor * (b - 128) + 128;

    // Saturation: desaturate toward luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + params.saturation * (r - lum);
    g = lum + params.saturation * (g - lum);
    b = lum + params.saturation * (b - lum);

    // Hue rotation (simplified RGB rotation)
    // ... (rotation matrix application)

    // Fade: blend toward tint color
    r = r + (params.tintR - r) * params.fade;
    g = g + (params.tintG - g) * params.fade;
    b = b + (params.tintB - b) * params.fade;

    data[i] = Math.max(0, Math.min(255, r));
    data[i + 1] = Math.max(0, Math.min(255, g));
    data[i + 2] = Math.max(0, Math.min(255, b));
  }

  ctx.putImageData(imageData, 0, 0);
}
```

### Pattern 3: In/Out Points on Layer Data Model
**What:** Add `inFrame` and `outFrame` optional fields to the Layer interface. The renderer checks whether the current local frame falls within `[inFrame, outFrame)` before drawing an FX layer. Default: span full sequence (null/undefined = no restriction).
**When to use:** All FX layers (new capability per CONTEXT.md).
**Example:**
```typescript
// In types/layer.ts
export interface Layer {
  // ... existing fields
  inFrame?: number;   // inclusive start frame (local to sequence)
  outFrame?: number;  // exclusive end frame (local to sequence); undefined = end of sequence
}
```

### Pattern 4: FX Source Data Discriminated Union Extension
**What:** Extend `LayerSourceData` with new generator and adjustment types, following the existing discriminated union pattern.
**When to use:** Adding any new FX layer type.
**Example:**
```typescript
export type LayerType =
  | 'static-image' | 'image-sequence' | 'video'
  | 'generator-grain' | 'generator-particles' | 'generator-lines'
  | 'generator-dots' | 'generator-vignette'
  | 'adjustment-color-grade';

export type LayerSourceData =
  | { type: 'static-image'; imageId: string }
  | { type: 'image-sequence'; imageIds: string[] }
  | { type: 'video'; videoPath: string }
  | { type: 'generator-grain'; density: number; size: number; intensity: number; lockSeed: boolean; seed: number }
  | { type: 'generator-particles'; count: number; speed: number; sizeMin: number; sizeMax: number; lockSeed: boolean; seed: number }
  | { type: 'generator-lines'; count: number; thickness: number; lengthMin: number; lengthMax: number; lockSeed: boolean; seed: number }
  | { type: 'generator-dots'; count: number; sizeMin: number; sizeMax: number; speed: number; lockSeed: boolean; seed: number }
  | { type: 'generator-vignette'; size: number; softness: number; intensity: number }
  | { type: 'adjustment-color-grade'; brightness: number; contrast: number; saturation: number; hue: number; fade: number; tintColor: string; preset: string };
```

### Anti-Patterns to Avoid
- **Full MC scene graph for generators:** Do NOT create MC View/Node trees just to draw procedural effects. The generators draw directly via Canvas 2D `ctx` calls. MC's value here is only the `Random` PRNG class.
- **Using ctx.filter for color grading:** Do NOT rely on `ctx.filter` for color grade. Safari/WebKit support was added in 18.0 but the Vite build target is safari13. More importantly, `ctx.filter` cannot express "fade toward tint color." Use ImageData pixel manipulation instead.
- **Separate rendering pipeline for FX:** FX layers are NOT rendered in a separate pass. They plug into the existing PreviewRenderer `renderFrame()` loop as regular layers. Generators draw instead of calling `drawImage()`. Color grade reads pixels back from the canvas.
- **Storing FX parameters outside the layer:** FX parameters MUST be part of `Layer.source` data (discriminated union). This ensures they flow through the existing sequenceStore snapshot/restore undo mechanism without any additional code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Seeded PRNG | Custom random number generator | `Random` from `@efxlab/motion-canvas-core` | Already installed, Mulberry32 algorithm, deterministic seed support, `.nextFloat()`, `.nextInt()`, `.gauss()`, `.spawn()` |
| Undo/redo for FX changes | Custom undo for FX parameters | Existing sequenceStore snapshot/restore | FX params live in Layer.source -> sequenceStore.updateLayer() triggers snapshot automatically |
| Radial gradient for vignette | Manual pixel-by-pixel darkening | `ctx.createRadialGradient()` | Native hardware-accelerated, anti-aliased, trivial API |
| Layer add/remove UI | Custom FX management panel | Extended existing AddLayerMenu and LayerList | Consistency with existing UX patterns; FX layers behave like content layers |
| Video FX overlays (grain clips, light leaks) | New video rendering pipeline | Existing Phase 6 video layer path | Imported video overlays use the exact same `resolveVideoSource()` + `drawLayer()` path |

**Key insight:** The existing layer infrastructure is designed for extension. The discriminated union type system, bottom-to-top compositing loop, and snapshot-based undo all accommodate new layer types without structural changes. The only new rendering code needed is the generator drawing functions and the color grade pixel pipeline.

## Common Pitfalls

### Pitfall 1: Color Grade Reads Wrong Pixels
**What goes wrong:** Color grade calls `getImageData()` but reads pixels from the wrong canvas state (e.g., before lower layers have drawn, or including DPI scaling artifacts).
**Why it happens:** The PreviewRenderer applies DPI scaling via `ctx.scale(dpr, dpr)` at the start of each frame. `getImageData()` operates in pixel coordinates, not logical coordinates.
**How to avoid:** Color grade must call `getImageData(0, 0, canvas.width, canvas.height)` using the physical canvas dimensions (not logical), then `putImageData()` at the same coordinates. It operates AFTER all lower layers have drawn but BEFORE any layers above it.
**Warning signs:** Color grade appears different at different zoom levels or on Retina vs non-Retina displays.

### Pitfall 2: Generator Performance at High Resolution
**What goes wrong:** Grain generator creates thousands of fillRect calls per frame, causing jank at 4K export.
**Why it happens:** Naive per-dot fillRect is O(n) canvas state changes. At 4K (3840x2160), even 0.5% density = ~41,000 dots.
**How to avoid:** For grain, create a smaller offscreen canvas (e.g., 256x256) with grain pattern, then tile it via `ctx.drawImage()` with `createPattern()`. Only regenerate the pattern when seed/frame changes. For particles/dots/lines, keep count reasonable (100-500 range).
**Warning signs:** Preview stutters during playback when grain layer is visible.

### Pitfall 3: In/Out Point Frame Reference Confusion
**What goes wrong:** FX layer appears on wrong frames because in/out points reference global frames instead of local sequence frames.
**Why it happens:** The timeline operates in global frames, but PreviewRenderer receives local frames (relative to sequence start).
**How to avoid:** In/out points on layers should use LOCAL frame numbers (relative to the sequence). The PreviewRenderer already receives `frame` as a local frame number. Comparison is simple: `if (layer.inFrame != null && frame < layer.inFrame) skip; if (layer.outFrame != null && frame >= layer.outFrame) skip;`.
**Warning signs:** FX disappears when switching sequences or when sequences are reordered.

### Pitfall 4: Seed Reproducibility Across Preview and Export
**What goes wrong:** Grain/particles look different in preview vs export despite "lock seed" being on.
**Why it happens:** If the seed derivation uses canvas dimensions or timing-dependent values, different render sizes produce different patterns.
**How to avoid:** Seed derivation MUST be purely `seed + frame`. Never include canvas dimensions, DPI, or timestamps in the seed calculation. The Random sequence should be identical regardless of resolution. Drawing coordinates are normalized (0-1) then scaled to canvas size.
**Warning signs:** Exporting at 4K produces visibly different grain pattern than 830px preview.

### Pitfall 5: Color Grade Order of Operations
**What goes wrong:** Applying brightness before contrast produces unexpected results. Hue rotation math is wrong.
**Why it happens:** Color adjustments are not commutative. The order matters significantly for the visual result.
**How to avoid:** Apply in this order: brightness -> contrast -> saturation -> hue rotation -> fade. This matches industry-standard color grading pipeline (DaVinci Resolve, Premiere Pro order).
**Warning signs:** "Warm" preset looks cold; "Vintage" preset looks neon.

### Pitfall 6: Serialization Round-Trip Data Loss
**What goes wrong:** FX layer parameters are lost on save/load because the MceLayer serializer doesn't handle new source types.
**Why it happens:** The projectStore serialize/deserialize code has hardcoded checks for `static-image`, `image-sequence`, and `video` source types.
**How to avoid:** Extend `MceLayerSource` to include all FX parameter fields. Add new discriminated cases to both serialize and deserialize paths. Bump project version to 3. Add migration path for v2 files (they have no FX layers, so migration is trivial -- just load normally).
**Warning signs:** FX layers disappear after saving and reopening project.

## Code Examples

### MC Random Class Usage (Standalone)
```typescript
// Source: @efxlab/motion-canvas-core lib/scenes/Random.d.ts
import { Random } from '@efxlab/motion-canvas-core';

// Create deterministic generator from seed
const rng = new Random(42);

// Float in range [from, to)
const x = rng.nextFloat(0, 1920); // 0 to 1920

// Integer in range [from, to)
const brightness = rng.nextInt(0, 256); // 0 to 255

// Gaussian distribution
const size = rng.gauss(3, 1); // mean=3, stdev=1

// Array of random floats
const positions = rng.floatArray(100, 0, 1); // 100 values in [0,1)

// Spawn independent sub-generator
const subRng = rng.spawn();
```

### Vignette with createRadialGradient
```typescript
// Source: MDN CanvasRenderingContext2D.createRadialGradient()
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: { size: number; softness: number; intensity: number },
): void {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.sqrt(cx * cx + cy * cy);
  const innerRadius = maxRadius * params.size;
  const outerRadius = maxRadius;

  const gradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(params.softness, `rgba(0,0,0,${params.intensity * 0.5})`);
  gradient.addColorStop(1, `rgba(0,0,0,${params.intensity})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
```

### Extending PreviewRenderer for Generators
```typescript
// Source: Existing PreviewRenderer.renderFrame() pattern
// In renderFrame(), after resolving layer source:
for (const layer of layers) {
  if (!layer.visible) continue;
  // NEW: in/out point check
  if (layer.inFrame != null && frame < layer.inFrame) continue;
  if (layer.outFrame != null && frame >= layer.outFrame) continue;

  if (isGeneratorLayer(layer)) {
    // Generator layers draw directly onto ctx
    this.drawGeneratorLayer(layer, logicalW, logicalH, frame);
  } else if (isAdjustmentLayer(layer)) {
    // Adjustment layers modify existing pixels
    this.drawAdjustmentLayer(layer, logicalW, logicalH);
  } else {
    // Existing path: resolve source + drawLayer()
    const source = this.resolveLayerSource(layer, frame, frames, fps);
    if (source) this.drawLayer(source, layer, logicalW, logicalH);
  }
}
```

### Color Grade Presets
```typescript
// Source: Industry-standard color grading values
export const COLOR_GRADE_PRESETS: Record<string, ColorGradeParams> = {
  none: { brightness: 0, contrast: 0, saturation: 1, hue: 0, fade: 0, tintColor: '#D4A574' },
  warm: { brightness: 0.02, contrast: 0.05, saturation: 1.1, hue: 10, fade: 0.08, tintColor: '#D4A574' },
  cool: { brightness: 0, contrast: 0.05, saturation: 0.9, hue: -15, fade: 0.06, tintColor: '#7BA7BC' },
  vintage: { brightness: -0.03, contrast: 0.1, saturation: 0.7, hue: 5, fade: 0.15, tintColor: '#C8A882' },
  bleachBypass: { brightness: 0.05, contrast: 0.2, saturation: 0.5, hue: 0, fade: 0.05, tintColor: '#CCCCCC' },
  cinematic: { brightness: -0.02, contrast: 0.15, saturation: 0.85, hue: -5, fade: 0.1, tintColor: '#2C4A5A' },
  highContrast: { brightness: 0, contrast: 0.3, saturation: 1.2, hue: 0, fade: 0, tintColor: '#D4A574' },
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ctx.filter for color adjustments | ImageData pixel manipulation | N/A (Safari compat) | ctx.filter now available in Safari 18+ but cannot express "fade to tint"; ImageData remains necessary for this project |
| MC scene graph for all rendering | Direct Canvas 2D for generators | Phase 6 architecture decision | PreviewRenderer owns compositing; MC provides utilities (Random) but not rendering |
| Full-sequence layers only | In/out point per layer | Phase 7 new capability | First time layers can have temporal bounds; previous layers always span full sequence |
| 3 layer types (static-image, image-sequence, video) | 9+ layer types (adding generators and adjustments) | Phase 7 | LayerType union expands; discriminated union source data pattern scales well |

**Deprecated/outdated:**
- None specific to this phase. The `ctx.filter` API is available in Safari 18+ but we avoid it for the "fade" parameter that has no CSS filter equivalent.

## Open Questions

1. **Performance of ImageData color grading at 4K**
   - What we know: getImageData/putImageData at 3840x2160 = ~33M pixel operations. At 60fps this is ~2B ops/sec.
   - What's unclear: Whether this causes perceptible jank in the preview canvas at 830px (much smaller, ~1.5M pixels).
   - Recommendation: Implement straightforward first. At 830px preview, the pixel count is small (~358K pixels with DPI). Only optimize (offscreen worker, partial update) if profiling shows issues. Export can be slower since it's not real-time.

2. **Grain pattern tiling vs per-pixel generation**
   - What we know: Per-pixel fillRect is simple but O(n). Pattern tiling via offscreen canvas is faster but may show visible tiling artifacts.
   - What's unclear: At what density threshold the fillRect approach becomes too slow for smooth preview playback.
   - Recommendation: Start with fillRect approach for simplicity. If performance is an issue, switch to offscreen pattern canvas (256x256 or 512x512) drawn once per frame and tiled. The tiling approach is a drop-in replacement with the same visual result if the tile size is large enough.

3. **Particles/dots/lines animation across frames**
   - What we know: These need to move across frames (animated). With seeded PRNG, positions are deterministic for each frame.
   - What's unclear: Whether per-frame random positions (no continuity) look cinematic, or whether frame-to-frame position interpolation is needed for smooth motion.
   - Recommendation: Use seed-per-frame for initial implementation (each frame generates fresh positions). If the effect looks too "noisy" without motion continuity, add velocity-based interpolation: `position(frame) = basePosition(seed) + velocity * frame`. This can be added later without API changes.

## Validation Architecture

> No test framework configured. This project has no vitest/jest setup.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None configured |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FX-01 | Film grain renders on canvas | manual-only | Visual inspection in app | N/A |
| FX-02 | Grain intensity adjustable | manual-only | Visual inspection in app | N/A |
| FX-03 | Vignette renders on canvas | manual-only | Visual inspection in app | N/A |
| FX-04 | Vignette params adjustable | manual-only | Visual inspection in app | N/A |
| FX-05 | Color grade applies to canvas | manual-only | Visual inspection in app | N/A |
| FX-06 | Color grade params adjustable | manual-only | Visual inspection in app | N/A |
| FX-07 | Dirt/scratches video overlay | manual-only | Visual inspection with imported video | N/A |
| FX-08 | Light leaks video overlay | manual-only | Visual inspection with imported video | N/A |
| FX-09 | Intensity adjustable for all FX | manual-only | Visual inspection in app | N/A |
| FX-10 | Resolution-independent parameters | manual-only | Compare preview at 830px vs mental model; full verification at Phase 10 export | N/A |

### Sampling Rate
- **Per task commit:** Build succeeds (`pnpm build` compiles without errors)
- **Per wave merge:** Manual visual inspection in running app
- **Phase gate:** All FX types addable, configurable, and visible in preview

### Wave 0 Gaps
- No test infrastructure exists -- all validation is manual (visual inspection in running Tauri app)
- `pnpm build` (TypeScript type-check + Vite build) serves as the automated correctness gate

## Sources

### Primary (HIGH confidence)
- `@efxlab/motion-canvas-core` Random class (lib/scenes/Random.d.ts) - Mulberry32 PRNG API with nextFloat, nextInt, gauss, floatArray, spawn
- `@efxlab/motion-canvas-core` useRandom (lib/utils/useRandom.d.ts) - Seed-based random generator factory
- Existing PreviewRenderer source code (`Application/src/lib/previewRenderer.ts`) - Full compositing architecture, layer rendering loop
- Existing Layer types (`Application/src/types/layer.ts`) - Discriminated union pattern for LayerSourceData
- Existing project serialization (`Application/src/stores/projectStore.ts`) - MceLayer serialize/deserialize round-trip
- [MDN: createRadialGradient()](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/createRadialGradient) - Vignette implementation API
- [MDN: Pixel manipulation with canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas) - ImageData API for color grading

### Secondary (MEDIUM confidence)
- [Can I Use: CanvasRenderingContext2D.filter](https://caniuse.com/mdn-api_canvasrenderingcontext2d_filter) - Safari 18.0+ support confirmed; used to inform decision NOT to use ctx.filter (build target safari13 + "fade" not expressible)
- [CSS-Tricks: Manipulating Pixels Using Canvas](https://css-tricks.com/manipulating-pixels-using-canvas/) - Brightness/contrast/saturation formulas
- [riptutorial: Increase color contrast with saturation](https://riptutorial.com/html5-canvas/example/19781/increase-the-color-contrast-with---saturation-) - Color adjustment algorithms

### Tertiary (LOW confidence)
- Color grade preset values (brightness/contrast/saturation/hue/fade numbers) are approximations based on training data knowledge of DaVinci Resolve and Premiere Pro color grading workflows. Should be tuned visually during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All APIs are native Canvas 2D or already-installed packages; verified via package.json and type declarations
- Architecture: HIGH - Direct extension of existing patterns; PreviewRenderer loop, discriminated union types, sequenceStore undo all proven in Phase 6
- Pitfalls: HIGH - DPI scaling, serialization round-trip, and frame reference pitfalls identified from reading existing code
- Procedural effect algorithms: MEDIUM - Grain/vignette patterns well-documented; particle/line/dot animation strategies may need visual tuning
- Color grade preset values: LOW - Approximate values; will need visual adjustment

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable -- Canvas 2D APIs don't change; MC 4.0.0 is pinned)
