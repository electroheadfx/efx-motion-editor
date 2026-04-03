# Feature Research

**Domain:** Physics paint engine integration and monorepo migration for stop-motion editor
**Researched:** 2026-04-03
**Confidence:** HIGH (both codebases fully reviewed; engine capabilities verified against source)

## Feature Landscape

### Table Stakes (Users Expect These)

Features that MUST work after the engine swap. Missing any of these = regression from v0.6.0. These are not new features; they are existing capabilities that must survive the migration.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Freehand brush rendering with pressure | Core drawing tool since v0.4.0. Users draw strokes with tablet pressure. Must produce output at least as good as perfect-freehand. | MEDIUM | efx-physic-paint `renderPaintStroke()` uses its own point processing (smooth, resample, ribbon, deform) with pressure/tilt. Different algorithm than perfect-freehand but richer: wet paint buffers, Beer-Lambert compositing, paper grain modulation. Must map editor's `[x, y, pressure]` point format to engine's `PenPoint {x, y, p, tx, ty, tw, spd}`. |
| Eraser tool | One of the 7 drawing tools. Users erase strokes or parts of strokes. | LOW | efx-physic-paint has `applyEraseStroke()` with `eraseStrength` parameter. Maps directly. |
| Color selection and rendering | Users pick hex colors and paint with them. | LOW | Engine has `setColorHex(hex)`. Direct mapping. |
| Brush size and opacity controls | Users adjust brush diameter and opacity via sliders in PaintProperties panel. | LOW | Engine has `setBrushSize(1-80)`, `setBrushOpacity(10-100)`. Note: engine range is 1-80 for size vs editor's 1-200 (`BRUSH_SIZE_MAX`). May need engine-side range extension or editor-side clamping. |
| Stroke persistence via sidecar JSON | Paint data saved as `paint/{uuid}/frame-NNN.json`. Must survive format migration. | HIGH | Current sidecar stores `PaintElement[]` with `PaintStroke.points` as `[x, y, pressure][]` plus `PaintStrokeOptions` (perfect-freehand params: thinning, smoothing, streamline, simulatePressure, pressureCurve, taper). New engine uses `PenPoint[]` with `BrushOpts` (size, opacity, pressure, waterAmount, dryAmount, edgeDetail, pickup, antiAlias). Need migration layer: load old format, convert to new, save in new format. Backward compat for .mce v15 files containing old paint data. |
| Onion skinning | Ghosted previous/next frames during paint mode. | MEDIUM | Currently renders via offscreen canvas with reduced opacity. Engine swap doesn't break this if we can render a frame's strokes to an offscreen canvas. efx-physic-paint's `renderAllStrokes()` and `renderPartialStrokes()` render to its internal dual canvas. Need a way to extract rendered frame as ImageData or canvas for compositing as onion skin ghost. `getCanvas()` and `getDisplayCanvas()` provide this. |
| Shape tools (line, rect, ellipse) | Part of the 7 tools. Users draw geometric shapes. | LOW-MEDIUM | efx-physic-paint only has `paint` and `erase` tools (`ToolType = 'paint' | 'erase'`). Shapes are NOT in the engine. Must keep editor's existing shape rendering code separate from engine. Shapes never went through perfect-freehand anyway; they use Canvas 2D primitives directly. |
| Flood fill tool | Users click to fill a region with color. | LOW | Editor's `paintFloodFill.ts` is engine-independent (pixel-level flood fill on a canvas). Keep as-is. |
| Eyedropper tool | Users pick colors from canvas. | LOW | Editor-level feature, engine-independent. Keep as-is. |
| Bezier path editing | Edit stroke paths as bezier curves with anchor/handle manipulation (shipped v0.6.0). | MEDIUM | fit-curve and bezier-js remain in the editor (milestone spec confirms: "Bezier path editing remains in the editor"). The issue is conversion: bezier anchors -> sampled points -> engine rendering. Currently anchors get re-sampled to `[x, y, pressure][]` via `sampleBezierPath()` then fed to perfect-freehand. Same flow works with new engine: sample to points, convert to `PenPoint[]`, feed to engine's `renderPaintStroke()`. |
| Stroke management (reorder, visibility, multi-select) | Shipped v0.6.0. StrokeList with SortableJS drag-reorder, visibility toggles, selection sync. | LOW | Editor-level feature. The stroke list manages `PaintElement[]` in `paintStore`. Engine swap is transparent to this layer. |
| FX brush styles (watercolor, ink, charcoal, pencil, marker) | Shipped v0.5.0 via p5.brush. Users apply styles to strokes. | HIGH | This is the core replacement. p5.brush used spectral pigment mixing (Kubelka-Munk) with 5 style presets. efx-physic-paint does NOT have named style presets. Instead it has continuous physics parameters: waterAmount, dryAmount, edgeDetail, pickup, physicsStrength, viscosity, embossStrength. Must create preset mappings that produce visually comparable results to p5.brush styles. The "flat" style maps to low waterAmount, high dryAmount. "Watercolor" maps to high waterAmount, low dryAmount, physics enabled. This is the riskiest mapping. |
| Non-destructive FX workflow (draw flat, select, apply style) | Shipped v0.5.0. Users draw strokes flat, then apply brush styles after. | MEDIUM | Conceptually the same: store strokes with base points, re-render with physics params applied. But efx-physic-paint's physics is real-time simulation (wet buffers, drying, fluid solver), not post-hoc image processing like p5.brush. Applying style means re-rendering the stroke through the physics engine. Must ensure deterministic results for the same stroke+params. |
| Per-frame FX cache | Shipped v0.5.0. Cached rendered frames avoid re-rendering unchanged strokes. | MEDIUM | efx-physic-paint renders to its own dual canvas (dry + display overlay). Cache must store the final composited frame. Use `getCanvas()` / `getDisplayCanvas()` to capture ImageData after rendering. Invalidation logic stays in editor. |
| Alt+drag duplicate | Shipped v0.6.0. Duplicate stroke while dragging. | LOW | Editor-level interaction. Engine-independent. |
| Non-uniform scale transforms | Shipped v0.6.0. Scale strokes independently on X/Y axes. | LOW | Editor-level point manipulation. Engine-independent. |
| Select tool with hit-testing | Users click to select strokes on canvas. | LOW | Editor-level feature using stroke bounding boxes. Engine-independent. |
| Pen tool (bezier point-by-point) | Shipped v0.6.0 via PaintOverlay pen interaction system. | LOW | Editor-level interaction. Creates bezier anchors, engine renders the sampled points. |
| 15/24 fps preview playback | Paint layers composite into the real-time preview at project fps. | MEDIUM | efx-physic-paint's physics simulation runs at 60fps internally (physics interval). For preview, we need to render a single completed frame (all strokes dry) without running real-time physics. Use `renderAllStrokes()` which replays and force-dries, then capture canvas. Performance budget: must complete per-frame render in <16ms for 60fps preview. |

### Differentiators (Competitive Advantage)

New capabilities that efx-physic-paint brings beyond what p5.brush + perfect-freehand offered.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Physics-based wet paint simulation | Real fluid dynamics via Stam stable fluids solver. Paint flows, pools at edges, diffuses based on water content. Fundamentally different from p5.brush's post-hoc spectral mixing -- this is real-time physically-based simulation. | LOW (engine has it) | Already implemented in efx-physic-paint's `fluids.ts` (Stam solver with Navier-Stokes), `diffusion.ts` (orchestration), `drying.ts` (evaporation LUT). Editor needs UI controls for physicsStrength, viscosity, localSpreadStrength, and buttons to start/stop physics. |
| Paper/canvas texture interaction | Paper heightmap modulates paint deposit and drying. Paint settles in paper valleys, creates granulation on rough surfaces. Physical paper-paint interaction, not just overlay. | LOW (engine has it) | Engine loads paper texture images, extracts heightmaps, uses `sampleH()` for per-pixel modulation. Papers configured via `PaperConfig[]` in engine constructor. Editor needs: paper selector UI, bundled paper texture images, Tauri FS for user papers. |
| Transparency / transparent background | Draw on transparent canvas (BgMode = 'transparent'). Enables compositing paint directly onto scene without luma matte workaround. | LOW (engine has it) | Engine's `BgMode` includes 'transparent'. The milestone spec explicitly lists this as a target feature. Compositing onto the scene in `previewRenderer.ts` becomes simpler: just composite the engine's display canvas with globalAlpha. No luma matte needed for basic compositing. |
| Paint drying simulation | Wet paint dries over time via exponential LUT-based evaporation. DrySpeed controls rate. Wet paint can be re-activated by physics. Creates temporal interaction between strokes. | LOW (engine has it) | `dryStep()` in `drying.ts`. Natural drying runs on a 100ms interval. `forceDryAll()` for immediate bake. For frame-by-frame animation, each frame likely needs forced dry after rendering (strokes are temporal per frame). |
| Wet-on-wet paint mixing | New strokes interact with still-wet previous strokes. Color pickup (`pickup` param) lifts underlying color. Physical mixing model, not spectral. | LOW (engine has it) | `renderPaintStroke()` reads existing wet buffer values and mixes via `mixSubtractive()`. This is a differentiator over p5.brush where strokes rendered independently on a shared WebGL2 canvas with spectral mixing. Here, the physics buffer mediates mixing. |
| Emboss / paper grain surface effect | Paper grain creates visible 3D surface texture on dried paint via emboss shader. Adjustable strength and stack depth. | LOW (engine has it) | Engine's `embossStrength` and `embossStack` parameters. Visible in dry canvas rendering. |
| Blow / directional force on wet paint | Per-pixel directional force vectors push wet paint. Simulates blowing on wet watercolor. | LOW (engine has it) | `blowDX/blowDY` Float32Arrays with `BLOW_DECAY`. Could be exposed as a tool or gesture (e.g., pointer drag while holding a modifier key). Deferred to v0.7.x. |
| Animation playback (stroke replay) | AnimationPlayer replays strokes as progressive frame-by-frame animation. Maps stroke timestamps to frames, renders point-by-point. | MEDIUM | `AnimationPlayer` class wraps engine, distributes strokes across frames proportionally by timestamp. Fires `onFrame(frameIndex, canvas)` callback per frame. This is different from the editor's frame-by-frame animation model (each frame has independent strokes). Could be exposed as a "paint reveal" preview mode within a single frame. Not directly used for timeline animation -- the editor already has its own frame model. |
| JSON brush format / project serialization | Engine serializes all strokes + settings as a compact JSON `SerializedProject`. Version 2 format with compressed point arrays `[x, y, p, tx, ty, tw, spd]`. | MEDIUM | Editor currently stores paint data per-frame as `PaintFrame { elements: PaintElement[] }` in sidecar JSON. Engine's `SerializedProject` stores all strokes globally. Must adapt: editor manages per-frame scope; engine's serialize/load used for per-frame data. Store `BrushOpts` per stroke instead of `PaintStrokeOptions`. |
| Anti-aliasing passes for wet edges | Configurable edge feathering on wet paint (0-3 levels, 2/4/6 passes). Soft brush edges without GPU shaders. | LOW (engine has it) | `featherWetEdges()` in `wet-layer.ts`. Expose as UI control. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time physics during timeline playback | Users see physics simulation and want it during playback across frames | Physics simulation is stateful and non-deterministic (depends on timing). Frame-by-frame animation needs reproducible per-frame results. Running physics during playback would give different results on each play. | Force-dry after rendering each frame's strokes. Physics applied explicitly per-frame during drawing, baked before save. |
| Per-stroke physics parameters | Different waterAmount/viscosity per stroke, like Krita's per-brush texture | Engine's physics operates on a shared wet buffer. All wet paint on canvas interacts. Per-stroke physics would require isolated wet layers per stroke, multiplying memory (6x Float32Arrays per stroke). | Per-frame physics settings. All strokes in a frame share the same physics context. Users adjust physics before drawing. Store settings in frame metadata. |
| Spectral pigment mixing (Kubelka-Munk) preservation | Users may miss p5.brush's spectral mixing which was physically more accurate for pigment blending | efx-physic-paint uses subtractive RGB mixing (`mixSubtractive` in color.ts), not spectral. Implementing Kubelka-Munk requires wavelength-domain color representation (4+ channels per pixel instead of 3), doubling memory. The benefit over subtractive mixing is subtle for most use cases. | Accept subtractive mixing. efx-physic-paint's wet buffer mixing with Beer-Lambert compositing produces convincing results. The physics simulation (flow, drying, paper interaction) more than compensates for less accurate color mixing. |
| Backward compatibility with p5.brush rendered output | Users want existing saved files to render identically after engine swap | Different rendering algorithms produce different visual output. Pixel-perfect backward compat is impossible. | Preserve stroke data (points, color, size, opacity). Re-render through new engine. Accept visual differences. Document migration in release notes. Old .mce files load; strokes re-render with new engine. |
| Multiple physics engines selectable per layer | "Use p5.brush for some layers, efx-physic-paint for others" | Two rendering engines = double maintenance, double the rendering code, incompatible buffer formats, confusing UX. | Clean break: efx-physic-paint replaces p5.brush entirely. Simpler, maintainable. The engine covers all use cases p5.brush handled plus adds physics. |
| Exposing full engine UI (all sliders from demo) | The engine demo has 10+ sliders for fine-grained control | Overwhelming for stop-motion workflow. Users want presets, not fluid dynamics parameters. | Create named brush presets (like the existing BrushStyle names) that map to engine parameter combinations. Expose only key controls: size, opacity, waterAmount, drySpeed. Advanced: physics strength, viscosity behind expandable section. |

## Feature Dependencies

```
[Monorepo Scaffold]
    └──requires──> pnpm workspace setup, lockfile migration
    └──enables──> [Engine Integration]

[Engine Integration (core)]
    └──requires──> [Monorepo Scaffold]
    └──requires──> Adapter layer: editor PaintStroke <-> engine PenPoint/BrushOpts
    └──enables──> [All paint rendering features]

[Stroke Format Migration]
    └──requires──> [Engine Integration]
    └──enables──> [Sidecar persistence with new format]

[Brush Style Preset Mapping]
    └──requires──> [Engine Integration]
    └──maps──> p5.brush styles -> engine BrushOpts combinations

[Paper Texture UI]
    └──requires──> [Engine Integration]
    └──requires──> Paper texture images (bundled + user-loadable via Tauri FS)

[Transparency Layer Support]
    └──requires──> [Engine Integration]
    └──modifies──> previewRenderer.ts paint compositing path

[Onion Skinning Reconnection]
    └──requires──> [Engine Integration]
    └──uses──> engine.getCanvas() / getDisplayCanvas()

[FX Cache Reconnection]
    └──requires──> [Engine Integration]
    └──requires──> [Brush Style Preset Mapping]

[Physics UI Controls]
    └──requires──> [Engine Integration]
    └──enhances──> PaintProperties panel

[Non-destructive FX Workflow Reconnection]
    └──requires──> [Engine Integration]
    └──requires──> [Brush Style Preset Mapping]
    └──requires──> Deterministic re-render through engine
```

### Dependency Notes

- **Engine Integration requires Monorepo Scaffold:** The engine is imported as `@efxlab/efx-physic-paint` workspace package. Must be linked before any code changes.
- **Brush Style Preset Mapping is the riskiest dependency:** All FX-related features (cache, non-destructive workflow, style UI) depend on having convincing preset mappings from the old 6 BrushStyle names to new engine params. Must be validated visually early.
- **Transparency and Paper Texture are independent of each other:** Both modify how the paint layer renders/composites but at different stages. Paper texture affects paint appearance. Transparency affects compositing onto the scene.
- **Shape/fill tools are independent of engine swap:** They use Canvas 2D primitives directly, not the brush engine. No migration needed.
- **Bezier editing is independent of engine swap:** fit-curve and bezier-js stay in the editor. The only touchpoint is that sampled bezier points feed into the engine instead of perfect-freehand.

## MVP Definition

### Phase 1: Monorepo Scaffold

Infrastructure. No user-visible changes.

- [ ] pnpm workspace root with `pnpm-workspace.yaml` -- enables engine as workspace dependency
- [ ] Copy efx-physic-paint into `packages/` -- engine source available
- [ ] Lockfile migration to root -- pnpm workspaces requirement
- [ ] Vite config for workspace package -- optimizeDeps exclude
- [ ] Verify `import { EfxPaintEngine } from '@efxlab/efx-physic-paint'` compiles

### Phase 2: Engine Swap Core

Replace rendering pipeline. Preserve all user-facing behavior.

- [ ] Adapter layer: convert editor `PaintStroke` to engine `PenPoint[] + BrushOpts` -- bridge between data models
- [ ] Replace perfect-freehand `getStroke()` calls with engine rendering -- core swap
- [ ] Replace p5.brush adapter with engine-based FX rendering -- style migration
- [ ] Brush style preset mapping: 6 BrushStyle names -> BrushOpts combinations -- visual parity
- [ ] Reconnect eraser tool to engine's `applyEraseStroke()` -- tool parity
- [ ] Reconnect onion skinning via engine canvas capture -- preview parity
- [ ] Reconnect FX cache with engine-rendered output -- performance parity
- [ ] Sidecar format migration: read old format, write new -- backward compat

### Phase 3: New Capabilities

Expose efx-physic-paint features not available in the old stack.

- [ ] Paper texture support with UI selector -- new differentiator
- [ ] Transparency layer support in compositing -- simplifies paint-over-photo workflow
- [ ] Physics UI controls (waterAmount, drySpeed, physicsStrength) -- expose engine power
- [ ] Brush caching and re-render optimization -- performance for complex frames

### Defer to v0.7.x or Later

- [ ] Blow/directional force tool -- interesting but not essential for engine swap milestone
- [ ] AnimationPlayer integration (stroke replay within frame) -- niche feature
- [ ] Custom user brush presets via JSON -- needs UX design for brush management
- [ ] Wet-on-wet mixing UI controls (pickup parameter) -- advanced, needs tuning

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Risk | Priority |
|---------|------------|---------------------|------|----------|
| Monorepo scaffold | LOW (infra) | LOW | LOW | P1 |
| Engine adapter layer | HIGH | MEDIUM | MEDIUM | P1 |
| Replace perfect-freehand rendering | HIGH | HIGH | HIGH | P1 |
| Replace p5.brush FX rendering | HIGH | HIGH | HIGH | P1 |
| Brush style preset mapping | HIGH | MEDIUM | HIGH | P1 |
| Eraser reconnection | HIGH | LOW | LOW | P1 |
| Sidecar format migration | HIGH | MEDIUM | MEDIUM | P1 |
| Onion skinning reconnection | MEDIUM | MEDIUM | LOW | P1 |
| FX cache reconnection | MEDIUM | MEDIUM | LOW | P1 |
| Paper texture support | MEDIUM | LOW | LOW | P2 |
| Transparency layer support | HIGH | LOW | LOW | P2 |
| Physics UI controls | MEDIUM | LOW | LOW | P2 |
| Brush caching / re-render | MEDIUM | MEDIUM | MEDIUM | P2 |
| Non-destructive FX reconnection | MEDIUM | MEDIUM | MEDIUM | P2 |

**Priority key:**
- P1: Must complete for engine swap -- regression without these
- P2: New capabilities enabled by the engine -- the "why" of the swap

## Existing Editor Features Preservation Matrix

Explicit mapping of what changes vs what stays untouched.

| Editor Feature | Depends on Engine? | Migration Action |
|----------------|-------------------|------------------|
| Brush stroke rendering | YES (perfect-freehand) | Replace with efx-physic-paint |
| FX brush styles | YES (p5.brush) | Replace with engine preset mapping |
| Eraser tool | YES (partial) | Swap to engine's erase function |
| Shape tools (line/rect/ellipse) | NO | Keep as-is (Canvas 2D primitives) |
| Flood fill | NO | Keep as-is (paintFloodFill.ts) |
| Eyedropper | NO | Keep as-is |
| Select tool / hit-testing | NO | Keep as-is |
| Bezier path editing | NO (fit-curve/bezier-js) | Keep as-is; sampled points feed new engine |
| Pen tool interaction | NO | Keep as-is |
| Stroke list / SortableJS | NO | Keep as-is |
| Alt+drag duplicate | NO | Keep as-is |
| Non-uniform scale | NO | Keep as-is |
| Onion skinning | PARTIAL | Reconnect: use engine canvas output |
| FX cache | PARTIAL | Reconnect: cache engine canvas output |
| Sidecar JSON persistence | YES (data format) | Migrate format; backward compat reader |
| PaintProperties panel | PARTIAL | Update controls to match engine params |
| paintStore signals | NO | Keep as-is; adapter converts at render time |
| Undo/redo | NO | Keep as-is (editor's command pattern) |

## Competitor Feature Analysis

| Feature | p5.brush (current) | efx-physic-paint (replacement) | Rebelle 7 | Krita |
|---------|-------------------|-------------------------------|-----------|-------|
| Color mixing | Spectral (Kubelka-Munk) -- physically accurate pigment mixing | Subtractive RGB + wet buffer interaction | Spectral | RGB (some spectral plugins) |
| Paper interaction | None (post-process overlay only) | Physics-based: heightmap modulates deposit, drying, grain | Full physical paper simulation (NanoPixel) | Texture overlay per-brush |
| Wet paint flow | None (static rendering) | Stam stable fluids solver, edge darkening, diffusion | Wet paint simulation | Basic smudge |
| Drying | None (instant render) | LUT-based exponential evaporation, natural drying timer | Simulated drying with timeline | None |
| Transparency | None (renders on opaque WebGL2 canvas) | Full transparent background support | Yes | Yes |
| Animation | None | AnimationPlayer with progressive stroke replay | Painting process video | Frame-by-frame animation |
| Serialization | None (editor manages) | JSON v2 format with compact point arrays | .reb proprietary | .kra (zip archive) |
| Named brush presets | External (brush.add for variants) | None (continuous parameters) | Extensive preset library | Extensive preset library |
| Performance | WebGL2 (fast rendering, one pass) | Canvas 2D with per-pixel wet buffers (slower for large canvases) | GPU-accelerated | CPU with some OpenGL |

## Key Risk: Visual Regression on Style Mapping

The highest-risk feature is mapping the 6 BrushStyle presets to efx-physic-paint parameters. Current p5.brush styles each use a built-in brush type with tuned parameters:

| BrushStyle | p5.brush Preset | efx-physic-paint Equivalent (proposed) |
|------------|----------------|---------------------------------------|
| flat | Direct canvas fill | waterAmount: 0, dryAmount: 100, edgeDetail: 0, antiAlias: 0 |
| watercolor | marker + bleed/grain/fieldStrength | waterAmount: 60-80, dryAmount: 20, edgeDetail: 30, physicsMode: 'local', viscosity: 0.0001 |
| ink | pen + edgeDarken/fieldStrength | waterAmount: 10, dryAmount: 80, edgeDetail: 60, pickup: 0, opacity: 100, antiAlias: 2 |
| charcoal | charcoal preset | waterAmount: 0, dryAmount: 100, edgeDetail: 80, paper grain: high embossStrength |
| pencil | HB preset | waterAmount: 0, dryAmount: 100, edgeDetail: 40, size: small, paper grain: medium |
| marker | marker preset | waterAmount: 5, dryAmount: 90, edgeDetail: 0, opacity: 80, antiAlias: 1, size: large |

These mappings are LOW confidence -- they need visual tuning against p5.brush reference output. Plan for an iterative visual comparison phase.

## Sources

- efx-physic-paint source code: `~/Dev/efx-physic-paint/src/` -- full engine review (types.ts, EfxPaintEngine.ts, compositor.ts, paper.ts, diffusion.ts, fluids.ts, drying.ts, paint.ts, erase.ts, AnimationPlayer.ts, preact.tsx)
- efx-motion-editor paint architecture: `Application/src/types/paint.ts`, `Application/src/lib/paintRenderer.ts`, `Application/src/lib/brushP5Adapter.ts`, `Application/src/stores/paintStore.ts`
- Milestone spec: `SPECS/milestone-v0.7.0-plan.md`
- PROJECT.md: `.planning/PROJECT.md`

---
*Feature research for: EFX-Motion v0.7.0 Physics Paint Engine Integration*
*Researched: 2026-04-03*
