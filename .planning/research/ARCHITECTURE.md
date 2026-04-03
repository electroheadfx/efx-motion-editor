# Architecture Research

**Domain:** pnpm monorepo migration + physics paint engine swap for Tauri desktop editor
**Researched:** 2026-04-03
**Confidence:** HIGH

## System Overview

### Current Architecture (v0.6.0)

```
UI Layer (Preact + Signals)
  PaintOverlay.tsx -- PaintProperties.tsx -- StrokeList.tsx -- PaintToolbar.tsx
       |                     |                    |
       v                     v                    v
  paintStore (signals + Map<string,Map<number,PaintFrame>>)
       |                          |
       v                          v
  paintRenderer.ts            brushP5Adapter.ts
  (perfect-freehand            (p5.brush standalone
   getStroke -> Path2D)         WebGL2 spectral mixing)
       |                          |
       v                          v
  previewRenderer.ts -- Canvas2D compositing -- exportRenderer.ts
```

### Target Architecture (v0.7.0)

```
UI Layer (Preact + Signals)
  PaintOverlay.tsx -- PaintProperties.tsx -- StrokeList.tsx -- PaintToolbar.tsx
       |                     |                    |
       v                     v                    v
  paintStore (signals + Map<string,Map<number,PaintFrame>>)
       |                          |
       v                          v
  paintRenderer.ts            efxPaintAdapter.ts  <-- NEW (replaces brushP5Adapter.ts)
  (bezier path rendering       (wraps EfxPaintEngine
   via Canvas2D Path2D)         for headless frame rendering)
       |                          |
       v                          v
  previewRenderer.ts -- Canvas2D compositing -- exportRenderer.ts
```

### Monorepo Layout

```
efx-motion-editor/
  package.json              (root workspace, private)
  pnpm-workspace.yaml       (packages: ["Application", "packages/*"])
  pnpm-lock.yaml            (single lockfile at root)
  .planning/                (single GSD for everything)
  Application/
    package.json            ("@efxlab/efx-physic-paint": "workspace:*")
    vite.config.ts          (optimizeDeps.exclude: ['@efxlab/efx-physic-paint'])
    src/
  packages/
    efx-physic-paint/
      package.json          (publishable to npm, tsup build)
      src/
```

## Component Responsibilities

| Component | Current Role | v0.7.0 Change |
|-----------|-------------|---------------|
| `paintStore.ts` | Owns paint data (signals + Maps), undo/redo, FX cache, tool state | **MODIFY** -- replace `renderFrameFx` calls with efxPaintAdapter, update BrushStyle/BrushFxParams types, add paper/transparency signals |
| `brushP5Adapter.ts` | p5.brush WebGL2 rendering for FX styles (watercolor, ink, charcoal, pencil, marker) | **REPLACE** with `efxPaintAdapter.ts` |
| `paintRenderer.ts` | Canvas2D rendering: perfect-freehand `getStroke()` -> Path2D, shapes, fills | **MODIFY** -- replace `getStroke()` with EfxPaintEngine headless rendering, keep shape/fill rendering, keep bezier path sampling |
| `PaintOverlay.tsx` | Pointer capture, stroke recording, tool dispatch, bezier editing | **MODIFY** -- record PenPoint format (x,y,p,tx,ty,tw,spd) instead of [x,y,pressure], wire new brush params |
| `PaintProperties.tsx` | Brush size, color, opacity, style selector, FX params | **MODIFY** -- replace style selector with physics params (waterAmount, dryAmount, edgeDetail, pickup, physicsStrength), add paper selector |
| `StrokeList.tsx` | Drag-reorder, delete, visibility toggle | **NO CHANGE** -- operates on PaintElement[], engine-agnostic |
| `PaintToolbar.tsx` | Tool icons (brush, eraser, select, pen, etc.) | **MINOR** -- keep tools, possibly add paper/transparency toggle |
| `previewRenderer.ts` | Multi-layer compositing, calls `renderPaintFrameWithBg()` | **MINOR** -- swap to new adapter's output canvas, same drawImage() pattern |
| `exportRenderer.ts` | Export pipeline, calls same paint rendering | **MINOR** -- same change as previewRenderer |
| `paintPersistence.ts` | Sidecar JSON read/write for PaintFrame data | **MODIFY** -- serialize new stroke format (PenPoint[], BrushOpts, paper config) |
| `OnionSkinOverlay.tsx` | Previous/next frame ghost rendering | **MODIFY** -- use adapter for frame rendering instead of perfect-freehand |
| `types/paint.ts` | PaintStroke, PaintElement, BrushStyle, BrushFxParams types | **MODIFY** -- new types for physics brush params, paper config, transparency |
| `bezierPath.ts` | 10 pure math functions for curve conversion/editing | **NO CHANGE** -- bezier editing stays in the editor, not in paint engine |

## Integration Architecture: The Adapter Pattern

### Why an Adapter (not direct engine embedding)

The `EfxPaintEngine` is designed as a standalone paint app: it owns canvases, pointer events, render loops, and undo. The editor already owns all of those. Direct embedding would create dual ownership conflicts. Instead, use the engine **headlessly** for rendering only.

### efxPaintAdapter.ts -- The New Bridge

```typescript
// efxPaintAdapter.ts -- replaces brushP5Adapter.ts
import { EfxPaintEngine } from '@efxlab/efx-physic-paint'

// Headless engine instance (no container, no pointer events, no render loop)
// Used exclusively for stroke rendering via renderPartialStrokes() / renderAllStrokes()
let _engine: EfxPaintEngine | null = null

/**
 * Render a set of editor strokes through the physics engine.
 * Converts editor PaintStroke[] -> engine PaintStroke format,
 * calls renderAllStrokes(), returns the engine's display canvas.
 */
export function renderPhysicsFrame(
  strokes: EditorPaintStroke[],
  width: number,
  height: number,
  paperConfig?: PaperConfig,
): HTMLCanvasElement | null {
  ensureEngine(width, height, paperConfig)
  const engineStrokes = strokes.map(convertToEngineStroke)
  _engine!.load({ version: 2, width, height, strokes: engineStrokes, settings: {...} })
  _engine!.renderAllStrokes()
  return _engine!.getDisplayCanvas()
}
```

### Key Insight: EfxPaintEngine Needs API Extensions

The current `EfxPaintEngine` is tightly coupled to a DOM container. For headless use in the editor, these changes are needed in the paint library:

1. **Headless constructor** -- accept `{ width, height }` without requiring a container HTMLElement. Create offscreen canvases internally.
2. **Batch render from data** -- `renderFromStrokes(strokes: PaintStroke[])` that clears, renders all strokes, composites, and returns the canvas. Currently `load()` + `renderAllStrokes()` works but also modifies internal undo stack.
3. **Paper texture injection** -- ability to set paper textures from pre-loaded data (the editor may want to bundle textures differently than the standalone app).
4. **Canvas extraction** -- `getDisplayCanvas()` already exists, sufficient for drawImage() compositing.

These are the "Accord the efx-physic-paint to editor" changes mentioned in the milestone spec.

## Data Flow Changes

### Current Stroke Data Flow

```
PointerEvent (PaintOverlay)
    |
    v
Record [x, y, pressure][]
    |
    v
Create PaintStroke { points, color, size, options: PaintStrokeOptions }
    |
    v
paintStore.addElement() -> paintVersion++
    |
    v
Preview: paintRenderer.ts uses getStroke(points, options) -> Path2D -> ctx.fill()
FX:      brushP5Adapter.ts uses brush.spline()/brush.fill() -> p5.brush WebGL2 -> canvas
```

### Target Stroke Data Flow

```
PointerEvent (PaintOverlay)
    |
    v
Record PenPoint[] { x, y, p, tx, ty, tw, spd }   <-- richer input
    |
    v
Create PaintStroke { points: PenPoint[], color, params: BrushOpts }   <-- new format
    |
    v
paintStore.addElement() -> paintVersion++
    |
    v
efxPaintAdapter.ts:
  1. Convert editor strokes -> engine PaintStroke format
  2. Feed to headless EfxPaintEngine
  3. Engine renders with wet/dry physics, paper texture, diffusion
  4. Return display canvas
    |
    v
previewRenderer.ts: ctx.drawImage(engineCanvas, 0, 0)   <-- same compositing pattern
```

### What Gets Removed

| Dependency | Replaced By | Notes |
|-----------|-------------|-------|
| `perfect-freehand` | `EfxPaintEngine.renderPaintStroke()` | Engine handles stroke outline generation internally |
| `p5.brush` | `EfxPaintEngine` physics rendering | Engine has its own wet/dry, diffusion, paper physics |
| `brushP5Adapter.ts` | `efxPaintAdapter.ts` | New adapter wrapping EfxPaintEngine |
| `BrushStyle` type (`'watercolor'\|'ink'\|...`) | `BrushOpts` params | Physics params replace named style presets |
| `BrushFxParams` (`grain, bleed, scatter...`) | `BrushOpts` (`waterAmount, dryAmount, edgeDetail, pickup...`) | Different parameter model |
| `StrokeFxState` (`'flat'\|'fx-applied'\|'flattened'`) | Single rendering path | No more flat/FX duality -- all strokes go through physics engine |

### What Stays

| Component | Why |
|-----------|-----|
| `bezierPath.ts` | Bezier editing is an editor concern, not a paint engine concern |
| `fit-curve`, `bezier-js` | Used by bezier path conversion, orthogonal to paint engine |
| `PaintShape`, `PaintFill` types | Shapes and flood fill are Canvas2D operations, not physics strokes |
| `paintStore` signal architecture | Data ownership pattern is sound, just needs type updates |
| `_frameFxCache` mechanism | Still useful: cache rendered engine output per frame, invalidate on change |
| Undo/redo via `pushAction` | Editor owns undo. Engine undo is disabled (headless mode) |
| Sidecar JSON persistence | Same pattern, different payload shape |

## New Concepts Introduced

### Paper/Canvas Texture

`EfxPaintEngine` supports paper textures via `setPaperGrain(key)`. Papers are loaded as heightmap images that modulate paint deposit.

**Integration:** New `paperStore.ts` or extend `paintStore` with:
- `paperTexture` signal (string key or null)
- `paperTextures` signal (available textures loaded from assets)
- Paper texture files bundled in `Application/src/assets/papers/`

### Transparency Layers

`EfxPaintEngine` supports `BgMode = 'transparent'`. In transparent mode, the dry canvas has no background fill, allowing compositing over other layers.

**Integration:** The editor already composites paint layers over sequence content. Currently `renderPaintFrameWithBg()` fills a solid background. With `efx-physic-paint`:
- Set engine `bgMode = 'transparent'`
- The engine's display canvas output has alpha
- `previewRenderer` composites it over the sequence content (existing drawImage pattern)
- Remove the manual `paintBgColor` fill in `renderPaintFrameWithBg()` -- engine handles it

### JSON Brush Format

`EfxPaintEngine` uses `BrushOpts` (size, opacity, pressure, waterAmount, dryAmount, edgeDetail, pickup, eraseStrength, antiAlias). This replaces the editor's `PaintStrokeOptions` (thinning, smoothing, streamline, simulatePressure, etc.) which were perfect-freehand parameters.

**Migration:** Old saved strokes in `.mce` projects use `PaintStrokeOptions`. New strokes use `BrushOpts`. Sidecar format needs a version bump with backward-compatible reading (old strokes render as flat Canvas2D fallback or are converted on load).

## Architectural Patterns

### Pattern 1: Headless Engine Adapter

**What:** Wrap `EfxPaintEngine` in an adapter that creates it without DOM attachment, feeds stroke data programmatically, and extracts rendered canvases.

**When to use:** Any time the editor needs to render a paint frame (preview, export, onion skin).

**Trade-offs:**
- Pro: Clean separation -- editor controls layout, events, undo; engine controls physics rendering
- Pro: Engine can be swapped/upgraded independently
- Con: Some overhead converting between editor and engine stroke formats
- Con: Engine needs API modifications for headless use (Phase 2 work)

### Pattern 2: Lazy Engine Instantiation with Size-Keyed Caching

**What:** Create engine instances on demand, sized to the project resolution. Cache and reuse. Destroy on project close.

**When to use:** First paint frame render after project open or resolution change.

**Trade-offs:**
- Pro: No engine overhead when project has no paint layers
- Pro: Handles resolution changes cleanly (destroy + recreate)
- Con: First render has initialization latency (paper texture loading)

### Pattern 3: Stroke Format Bridging

**What:** Define a clear mapping between editor `PaintStroke` (with bezier anchors, visibility, fxState) and engine `PaintStroke` (with PenPoint[], BrushOpts). The adapter translates at render time.

**When to use:** Every render call in the adapter.

**Trade-offs:**
- Pro: Editor types stay stable, engine types stay clean
- Con: Translation overhead (mitigated by frame caching)

## Anti-Patterns

### Anti-Pattern 1: Dual Canvas Ownership

**What people do:** Let both the editor's PreviewRenderer and EfxPaintEngine manage their own render loops and canvas elements simultaneously in the DOM.

**Why it's wrong:** Two competing render loops fighting for GPU time. The engine's pointer event listeners conflict with the editor's PaintOverlay event handling.

**Do this instead:** Use the engine headlessly. Editor owns the DOM, render loop, and pointer events. Engine renders to an offscreen canvas that the editor composites.

### Anti-Pattern 2: Migrating Perfect-Freehand Types In-Place

**What people do:** Try to make `PaintStrokeOptions` (thinning, smoothing, streamline) work with the new engine by mapping them to `BrushOpts` (waterAmount, dryAmount, etc.).

**Why it's wrong:** The parameter models are fundamentally different. Forced mapping produces unpredictable results and creates a maintenance burden.

**Do this instead:** Define a clean break. New strokes use `BrushOpts`. Old strokes in saved projects get a legacy fallback renderer (Canvas2D path fill, no physics) or are one-time converted with sensible defaults.

### Anti-Pattern 3: Removing the Frame Cache

**What people do:** Assume the physics engine is fast enough for real-time per-frame rendering at 15/24fps.

**Why it's wrong:** `EfxPaintEngine.renderAllStrokes()` replays ALL strokes sequentially with wet/dry physics. A frame with 50 strokes is expensive. Preview playback will stutter.

**Do this instead:** Keep the `_frameFxCache` pattern. Render engine output to a cached canvas per frame. Invalidate only when strokes change. Preview compositing is a single `drawImage()`.

## Integration Points

### Editor -> Engine (what the editor sends)

| Data | Method | Notes |
|------|--------|-------|
| Stroke points | `load()` or new batch API | Convert PenPoint format |
| Brush parameters | Via `BrushOpts` in stroke data | Size, opacity, waterAmount, etc. |
| Paper selection | `setPaperGrain(key)` | Needs texture assets bundled |
| Background mode | `setBgMode('transparent')` | Always transparent for layer compositing |
| Canvas dimensions | Constructor `{ width, height }` | Match project resolution |

### Engine -> Editor (what the editor reads)

| Data | Method | Notes |
|------|--------|-------|
| Rendered frame | `getDisplayCanvas()` | HTMLCanvasElement with composited wet+dry layers |
| Dry canvas | `getCanvas()` | Dry layer only (for snapshot/caching) |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `paintStore` <-> `efxPaintAdapter` | Function calls (render requests) | Adapter is stateless; store owns data |
| `PaintOverlay` <-> `paintStore` | Signals + store methods | Same pattern as current architecture |
| `efxPaintAdapter` <-> `EfxPaintEngine` | Direct method calls | Adapter creates/manages engine lifecycle |
| `bezierPath.ts` <-> `paintRenderer.ts` | `sampleBezierPath()` -> point arrays | Bezier sampling feeds both renderers |
| Sidecar persistence <-> `paintStore` | `loadFrame()` / `getDirtyFrames()` | Same pattern, new stroke payload |

## Suggested Build Order

Build order follows dependency chains: infrastructure first, then engine modifications, then editor integration, then UI.

### Phase 1: Monorepo Scaffold (no code changes to existing features)

1. Create root `package.json` and `pnpm-workspace.yaml`
2. Move `Application/pnpm-lock.yaml` to root
3. Copy `efx-physic-paint` into `packages/`
4. Clean up copied package (remove `.planning/`, `.claude/`, etc.)
5. Add `"@efxlab/efx-physic-paint": "workspace:*"` to `Application/package.json`
6. Update `Application/vite.config.ts` with `optimizeDeps.exclude`
7. Run `pnpm install`, verify symlink resolution
8. Verify `pnpm dev` still works (no functional changes yet)

**Gate:** App builds and runs identically to v0.6.0.

### Phase 2: Engine API Adaptations (changes in `packages/efx-physic-paint/`)

1. Add headless constructor mode (offscreen canvases, no DOM container, no pointer events, no render loop)
2. Add `renderFromStrokes(strokes, settings)` batch API that clears -> renders all -> composites -> returns canvas
3. Add paper texture injection from pre-loaded ImageData (not just URL loading)
4. Ensure `'transparent'` bgMode produces correct alpha output
5. Build and verify `pnpm dev:paint` + `pnpm build` work

**Gate:** Engine can render strokes headlessly with correct output.

### Phase 3: Adapter + Type Migration (changes in `Application/`)

1. Create `efxPaintAdapter.ts` wrapping the headless engine
2. Define new `PhysicsBrushOpts` type in `types/paint.ts` alongside existing types
3. Create stroke format converter (editor PaintStroke <-> engine PaintStroke)
4. Wire adapter into `paintStore`: replace `renderFrameFx()` calls with `efxPaintAdapter.renderPhysicsFrame()`
5. Update `_frameFxCache` to store engine output canvases
6. Update `paintRenderer.ts`: replace `getStroke()` with adapter rendering for brush strokes
7. Keep `strokeToPath()` as legacy fallback for old saved strokes

**Gate:** Paint strokes render via physics engine; old projects load with fallback rendering.

### Phase 4: PaintOverlay + Input Enrichment

1. Update `PaintOverlay.tsx` pointer recording to capture full `PenPoint` data (tilt, twist, speed)
2. Create new stroke objects with `BrushOpts` params instead of `PaintStrokeOptions`
3. Wire `eraser` tool through adapter (engine has `applyEraseStroke`)
4. Verify onion skinning works via adapter rendering

**Gate:** Drawing new strokes uses physics engine end-to-end.

### Phase 5: UI + Paper + Transparency

1. Update `PaintProperties.tsx` -- replace style selector with physics param sliders (waterAmount, dryAmount, edgeDetail, pickup, physicsStrength)
2. Add paper texture selector UI
3. Bundle paper texture assets
4. Implement transparency layer mode (bgMode: 'transparent')
5. Update sidecar persistence for new stroke format (version bump)
6. Add backward-compatible loading for old paint sidecar data

**Gate:** Full feature parity with v0.6.0 paint, plus paper textures and transparency.

### Phase 6: Cleanup + Removal

1. Remove `perfect-freehand` dependency
2. Remove `p5.brush` dependency
3. Remove `brushP5Adapter.ts`
4. Remove `BrushStyle`, `StrokeFxState` types (or mark deprecated)
5. Remove flatten/unflatten workflow (single render path now)
6. Clean up `paintStore` -- remove `brushStyle`, `brushFxParams`, `isRenderingFx`, `showFlatPreview` signals
7. Update `.mce` format version for new paint data schema

**Gate:** No dead code, clean dependency tree, all tests pass.

## Scaling Considerations

| Concern | Current (v0.6.0) | After v0.7.0 |
|---------|-------------------|--------------|
| Frame render time | Fast (Canvas2D Path2D fill) | Slower (physics simulation per stroke) -- mitigated by frame caching |
| Memory per paint layer | Low (point arrays + optional FX cache canvas) | Higher (Float32Array buffers in engine ~40MB for 1920x1080) -- mitigated by lazy engine init |
| Stroke count per frame | 100+ strokes OK | Engine replays all strokes sequentially -- cache is critical |
| Export render time | Fast (same as preview) | Slower per frame (physics re-render) -- but cached frames reused |

### Scaling Priorities

1. **First bottleneck: Initial frame render with many strokes.** The engine replays every stroke with physics. Mitigation: aggressive frame caching, invalidate only changed frames.
2. **Second bottleneck: Memory for headless engine buffers.** ~40MB of Float32Arrays per 1920x1080 instance. Mitigation: single shared engine instance, resized lazily.

## Sources

- `Application/src/stores/paintStore.ts` -- current paint data architecture
- `Application/src/lib/brushP5Adapter.ts` -- current p5.brush rendering adapter
- `Application/src/lib/paintRenderer.ts` -- current perfect-freehand rendering
- `Application/src/lib/previewRenderer.ts` -- compositing pipeline
- `Application/src/types/paint.ts` -- current type definitions
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` -- engine facade API
- `packages/efx-physic-paint/src/types.ts` -- engine type definitions
- `packages/efx-physic-paint/src/animation/` -- animation player subsystem
- `SPECS/milestone-v0.7.0-plan.md` -- milestone specification

---
*Architecture research for: pnpm monorepo migration + physics paint engine swap*
*Researched: 2026-04-03*
