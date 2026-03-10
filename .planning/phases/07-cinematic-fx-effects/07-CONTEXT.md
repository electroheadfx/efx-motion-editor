# Phase 7: Cinematic FX Effects - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Add cinematic post-processing effects to sequences via two FX pipelines: imported video overlays and procedural Motion Canvas generators. Effects are timeline layers with in/out points, freely positionable in the stack, composited by the existing Canvas 2D renderer. All FX must be resolution-independent (preview at 830px and export at 1080p/4K produce visually identical results). This phase also pulls forward procedural FX (AFX-01) from the deferred backlog.

</domain>

<decisions>
## Implementation Decisions

### FX architecture — two pipelines
- **Imported video overlays**: User imports their own video files (grain, scratches, light leaks, etc.) applied as layers. Reuses existing video layer infrastructure from Phase 6.
- **Procedural generators**: New layer source type "generator" that calls Motion Canvas primitives (Circle, Rect, Line, Path, useRandom()) to draw directly into the Canvas 2D compositor at render time. NOT a separate offscreen pipeline — generators are timeline layers like any other, composited in the same stacking order by PreviewRenderer.
- No bundled assets — user import for overlays, code-generated for procedural effects.

### Procedural generator effects (full suite)
- Film grain (random dots via MC primitives)
- Particles (spawned with range()/sequence(), animated positions)
- Random lines/strokes (Line/Path nodes with random endpoints)
- Animated dots (Circle nodes with randomized movement)
- Vignette (radial gradient — could be plain Canvas 2D)
- Color grade (pixel manipulation — Canvas 2D ImageData)

### Randomness behavior
- Seeded/reproducible by default (same frame = same pattern via useRandom() with deterministic seed)
- Per-effect "Lock seed" toggle: locked = reproducible, unlocked = fresh randomness each render
- Default: locked (export matches preview)

### FX stacking & ordering
- Freely positionable anywhere in the layer stack — same drag-and-drop reordering as content layers
- Unlimited instances of same effect type (no restriction on duplicates)
- Stack-based compositing: FX affects whatever is below it using blend modes (same model as content layers, no special-case rendering)

### FX layer duration
- In/out points per FX layer (clip-like behavior, not full-sequence-only)
- FX layers can start and end at specific frames — e.g., a light leak only on frames 10-25
- This is a new capability for the layer system (current layers span full sequence)

### Color grade
- Built-in presets dropdown (Warm, Cool, Vintage, Bleach Bypass, etc.) that pre-fill slider values
- Built-in presets only — no custom preset save/load for Phase 7
- Five parameters: brightness, contrast, saturation, hue, fade
- Fade blends toward a user-choosable tint color (default warm sepia, enables vintage/sci-fi looks)
- No curves, levels, or shadow/highlight split — five params cover the cinematic grading needs

### FX UI presentation
- FX layers added from timeline/layer area via categorized menu:
  - **Overlays** (imported video: grain, scratches, light leaks)
  - **Generators** (procedural: particles, dots, lines, grain)
  - **Adjustments** (color grade, vignette)
- FX layers get a distinct accent color (tinted background or colored left border) in the layer panel to visually distinguish from content layers
- Properties panel: FX-specific controls replace transform section (position/scale/rotation/crop) when an FX layer is selected — FX layers don't need spatial transforms

### Claude's Discretion
- Exact Motion Canvas integration pattern for generator layers drawing into Canvas 2D
- Specific procedural effect parameters (particle count, speed, size ranges, etc.)
- Color grade preset values (exact brightness/contrast/saturation/hue/fade numbers per preset)
- Accent color choice for FX layers in the panel
- How in/out points are represented in the layer data model and timeline UI
- Lock seed toggle UI placement and default seed values

</decisions>

<specifics>
## Specific Ideas

- Generator layers should feel like "smart clips" — they behave exactly like video clips in the timeline but generate their content programmatically instead of reading from a file
- Motion Canvas value is specifically in the generative FX (particles, random strokes, animated dots) — grain/vignette/color grade could be plain Canvas 2D, but MC enables the procedural effects that are the differentiator
- The architecture must support both pipelines stacking together: imported video overlay + procedural generator + color grade adjustment, all in one layer stack
- MC primitives to leverage: useRandom() for reproducible noise, Circle/Rect/Line/Path for drawing, range()/sequence() for particle spawning, signals for dynamic animation

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **PreviewRenderer** (`src/lib/previewRenderer.ts`): Canvas 2D compositor with bottom-to-top layer iteration, blend mode mapping, DPI scaling. FX layers plug into the same `drawLayer()` loop — generators would draw MC primitives instead of `drawImage()`.
- **NumericInput** (`src/components/layout/PropertiesPanel.tsx`): Shared numeric input with coalescing support for undo — reuse for all FX parameter sliders.
- **Video layer infrastructure** (`src/stores/layerStore.ts`, `src/lib/previewRenderer.ts`): Video rasterization to offscreen canvas for blend modes — imported FX video overlays can reuse this exact path.
- **AddLayerMenu** (`src/components/layer/AddLayerMenu.tsx`): Current menu for adding layers — extend with FX categories.
- **Layer data model** (`src/types/layer.ts`): LayerType union, Layer interface with source discriminated union — extend with generator/FX types.

### Established Patterns
- Preact Signals for all reactive state — FX parameters stored as signals
- batch() for multi-signal updates — FX parameter changes use same pattern
- Undo via sequenceStore snapshot/restore — FX layer add/edit/remove automatically undoable
- snake_case TypeScript types matching Rust serde — FX types follow same convention
- DPI-aware canvas rendering (devicePixelRatio) — FX rendering must account for DPI

### Integration Points
- **PreviewRenderer.renderFrame()**: Add generator rendering path alongside existing drawImage path
- **PropertiesPanel.tsx**: Replace "FX parameters — Phase 7" placeholder with FX-specific controls
- **Layer type system** (`src/types/layer.ts`): Extend LayerType with FX types, add FX-specific source data interfaces
- **sequenceStore**: Layer mutations already support arbitrary layer types — no structural changes needed
- **@efxlab/motion-canvas-* packages**: Already installed (v4.0.0) — MC primitives available for import

</code_context>

<deferred>
## Deferred Ideas

- Custom color grade preset save/load — future phase
- AFX-02: Dual-quality rendering (Dual Kawase vs Gaussian blur toggle) — future phase
- AFX-03: Composition templates (save/load FX presets) — future phase
- AFX-04: Layer loop modes (loop, mirror, ping-pong for video/sequence layers) — future phase

</deferred>

---

*Phase: 07-cinematic-fx-effects*
*Context gathered: 2026-03-10*
