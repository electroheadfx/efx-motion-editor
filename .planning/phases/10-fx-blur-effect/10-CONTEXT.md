# Phase 10: FX Blur Effect - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Add blur as a new FX capability operating at three levels: per-layer blur property, per-generator blur property, and standalone blur FX layer on the timeline. Dual-quality rendering — Dual Kawase for fast playback preview, Gaussian for high-quality export. Global toolbar toggles for HQ preview and blur bypass. No selective blur modes (tilt-shift, radial, directional) — full-frame only.

</domain>

<decisions>
## Implementation Decisions

### Blur scope & types
- Full-frame blur only — no tilt-shift, radial, or directional modes (future phase)
- Static blur strength within FX range — no fade in/out ramps over time
- Blur appears alongside existing effects in the Add FX menu (no category reorganization)

### Three levels of blur
- **Layer-level blur**: Blur radius slider added to layer properties in LAYERS sidebar. Applies to any layer in a sequence. Blurs that layer's content before compositing. Just a radius slider — layer already has its own opacity/blend mode.
- **Generator-level blur**: FX generators on the timeline (grain, particles, lines, dots, vignette) can receive blur on their output. Blur radius slider in generator properties. Preserves transparency (alpha) — blur RGB only, keep alpha intact. Blurred generator composites cleanly over the scene.
- **Standalone blur FX layer**: Blur as its own FX sequence on the timeline with radius + opacity + blend mode (full FX layer controls like other generators). Blurs everything composited below it (full composite, like color-grade).

### User controls
- Primary parameter: blur radius slider, normalized 0.0–1.0 range scaled to canvas dimensions (resolution-independent, matches existing FX parameter pattern)
- Default radius: 0 (no blur)
- No lockSeed/deterministic toggle — blur is deterministic by nature (no randomness)
- Properties panel matches existing FX style — labeled sliders, same layout as grain/vignette

### Pipeline behavior
- Layer blur: applied to that layer's content before compositing into the scene
- Generator blur: applied to generator output (RGB only, preserve alpha) before compositing
- Standalone blur FX: reads full composite below and blurs it (like color-grade)
- Blur applications stack — a layer with its own blur + a standalone blur FX = double blur. No special-case logic, each blur is independent.
- Standalone blur supports full compositing: opacity and blend mode controls (like all other FX layers)

### Quality switching
- **Auto switching**: playback and scrubbing use Dual Kawase (fast); PNG export uses Gaussian (high quality)
- **HQ Preview toggle**: global toggle in the toolbar that forces all blur to Gaussian during preview. Overrides auto behavior.
- **Bypass Blur toggle**: global toggle in the toolbar that disables all blur everywhere (layer, generator, standalone) for faster playback or to view scene without blur
- Both toggles live in the **top toolbar** (not canvas bottom bar)
- Both toggles get **keyboard shortcuts**
- No visual indicator for quality mode — the HQ toggle state is sufficient
- Scrubbing always uses fast mode unless HQ toggle is on

### Claude's Discretion
- Dual Kawase implementation details (number of passes, downscale factor)
- Gaussian kernel implementation for export quality
- Keyboard shortcut key assignments for HQ and Bypass toggles
- Toolbar button styling and placement within existing toolbar layout
- Exact normalized radius range and curve (linear vs logarithmic slider feel)
- How blur interacts with the existing PreviewRenderer draw loop architecture

</decisions>

<specifics>
## Specific Ideas

- Blur bypass is critical for workflow — user wants to quickly toggle blur off to check the scene without it or to speed up playback when blur makes it slow
- Generator blur must preserve transparency so blurred grain/particles composite cleanly (no halos)
- The three blur levels (layer, generator, standalone) should feel like one consistent feature, not three separate systems — same radius slider, same normalized parameter

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fxGenerators.ts`: All existing draw functions follow `drawXxx(ctx, width, height, params, frame)` pattern — blur will need a different pattern since it processes existing pixels
- `fxColorGrade.ts` + `applyColorGrade()`: Adjustment layer that processes the full composite via `getImageData`/`putImageData` — closest existing pattern to standalone blur
- `PreviewRenderer.drawGeneratorLayer()`: Dispatch switch for generator types — needs new case for blur
- `layer.ts`: `LayerType` union, `LayerSourceData` union, `createDefaultFxSource()` — extend for blur types
- `Layer` interface: `opacity`, `blendMode`, `transform` already on every layer — blur radius would be added here or in source data
- `isGeneratorLayer()`, `isFxLayer()` helpers: Already classify layer types

### Established Patterns
- Canvas 2D compositing with `ctx.save()`/`ctx.restore()` and `globalCompositeOperation` for blend modes
- Resolution-independent parameters (normalized 0–1) scaled to canvas dimensions at render time
- Single-pass draw loop in `PreviewRenderer.drawFrame()` — layers drawn bottom-to-top
- `ctx.filter = 'blur(Xpx)'` available for Canvas 2D fast blur (potential Dual Kawase alternative)
- `getImageData`/`putImageData` for pixel manipulation (used by color-grade)

### Integration Points
- `PreviewRenderer`: Main render pipeline — needs per-layer blur application before compositing, and standalone blur FX support
- `Toolbar.tsx`: Add HQ Preview and Bypass Blur toggle buttons
- `layer.ts`: Add `blur` property to Layer interface or new generator-blur source type
- `fxGenerators.ts`: Add blur draw function (or separate file for blur algorithms)
- Keyboard shortcuts registration: Add HQ and Bypass toggle shortcuts
- Export pipeline: Switch from Dual Kawase to Gaussian when rendering for export

</code_context>

<deferred>
## Deferred Ideas

- Selective blur modes (tilt-shift, radial, directional/motion blur) — future phase
- Blur fade in/out ramps over FX range — future phase (requires per-frame parameter interpolation)
- FX menu reorganization into categories (Generators vs Adjustments) — future cleanup

</deferred>

---

*Phase: 10-fx-blur-effect*
*Context gathered: 2026-03-13*
