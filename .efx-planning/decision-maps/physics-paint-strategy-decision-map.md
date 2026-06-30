# Physics Paint Strategy Decision Map

Purpose: choose the path from the failed standalone Rust paint lab toward an EFX Motion real-paint/roto workflow, using Krita where it gives leverage and preserving a future embedded paint engine path.

Context assets:
- `SPECS/physics-paint-rust-realtime-renderer/context.md`
- `SPECS/physics-paint-rust-realtime-renderer/minimal-rust-paint-lab.md`
- `SPECS/physics-paint-rust-realtime-renderer/literature-map.md`
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts`
- `packages/efx-physic-paint/src/preact.tsx`
- `packages/efx-physic-paint/src/types.ts`

## v1-track: First Useful Version Strategy

Blocked by: none
Status: resolved
Type: Grilling

### Question

Should the first useful version integrate Krita as an external paint/roto companion, require direct painting inside EFX Motion, or run both tracks?

### Answer

Run both tracks. Short-term work should make Krita usable as an external paint/roto companion so EFX Motion can benefit from mature brushes quickly. In parallel, define and clean the EFX paint module interface so a future embedded renderer can replace or augment the current TypeScript Canvas2D implementation without changing EFX Motion workflows.

## krita-roundtrip: Krita Companion Workflow

Blocked by: none
Status: resolved
Type: Research

### Question

What is the smallest Krita-assisted workflow that lets EFX Motion export roto context, let the artist paint with Krita brushes, and import the result back reliably?

### Answer

Use a project-folder exchange workflow first, not live embedding. EFX Motion should export `paint/krita/<session-id>/manifest.json` plus reference/current-paint PNGs, open Krita with a prepared image or `.kra` template, let the artist paint normally in Krita, then import transparent PNGs from `out/` back through the existing `PhysicPaintRenderedFrame`/Physics Paint apply path. Start with one frame, then expand to frame ranges. A later Krita Python plugin/docker can add “Export to EFX Motion” convenience, but it should still exchange files because Krita plugins run inside Krita and do not provide an external embedded paint-engine API.

Asset: `.efx-planning/research/krita-roundtrip.md`.

## paint-module-interface: EFX Paint Module Interface

Blocked by: none
Status: resolved
Type: Grilling

### Question

What small, deep interface should EFX Motion depend on so the current TypeScript engine, a Krita round-trip adapter, a Rust/WASM renderer, and a later native/wgpu renderer can all sit behind the same seam?

### Answer

Use an artifact-first, sessionful paint adapter seam. EFX Motion should depend on document/context/render operations, not on `EfxPaintEngine`, pointer events, stroke arrays, wet buffers, brush internals, or live canvas implementation details.

Canonical boundary:
- `openSession(context) / dispose()`: context includes layer id, size, fps, workflow mode, current frame/range, reference/cached frames, and background metadata.
- `loadEditableState(state) / saveEditableState()`: adapter-owned editable document envelope with adapter id/schema/version/size plus opaque payload. Current TS state, Krita `.kra`/manifest state, Rust/WASM state, and native state all live here.
- `setFrameContext(context)`: switch current app frame, reference/onion/base frames, and roto/play metadata without changing the adapter implementation.
- `renderStill(request) -> RenderedFrame` and `renderRange(request) -> RenderedFrame[]`: return app-owned rendered PNG/bitmap artifacts matching the existing rendered-frame split: frame index, app frame, size, provenance, and data URL/blob. Rendered outputs are never editable state.
- `getRevision() / getDiagnostics()`: expose content/render revision and optional timing/debug metrics for cache invalidation and bottleneck work.

Live painting is an optional capability behind the adapter, not the core seam: `mountInteractiveSurface(container)`, `setTool`, `setBrush`, `undo`, `clear`, `forceDry`, `start/stopPhysics`, etc. The current TypeScript adapter can implement these by wrapping `EfxPaintEngine.save/load/exportCompositeCanvas` and `AnimationPlayer`; Krita can skip them and instead implement external exchange/launch/import capabilities over the same editable-state and rendered-frame artifacts.

This keeps EFX Motion stable while allowing different backends: the app stores opaque editable state, imports/exports rendered frames, and marks caches stale by revision/options changes. The detailed DTOs for layers, references, alpha, frame ranges, and metadata are deferred to `roto-data-contract`.

## roto-data-contract: Roto Frame And Layer Contract

Blocked by: krita-roundtrip, paint-module-interface
Status: resolved
Type: Research

### Question

What data must move between EFX Motion, Krita, and embedded paint adapters for roto animation: reference frames, masks, alpha, layers, frame ranges, timing, metadata, and editable state?

### Answer

Use a full-canvas, artifact-first contract with two separate lanes: rendered roto outputs are PNG RGBA artifacts mapped to EFX `appFrame`s, while editable state is an adapter-owned document envelope. EFX Motion owns timeline identity, layer identity, transforms/blend/opacity, cache invalidation, generated interpolation, and project persistence; adapters own editable document internals and exchange only context rasters, opaque editable state, and rendered PNG outputs.

Canonical rendered output maps to `PhysicPaintRotoCacheFrame`: `appFrame` is the global EFX timeline frame, `frameIndex` is local to the render/export request, `source` is `real-key` for imported artist/authored frames, and generated/background frames stay EFX-owned render-only cache artifacts. PNGs should be 8-bit sRGB RGBA with straight alpha; roto masks are represented by the PNG alpha channel for v1, not separate Krita masks or internal wet/fluid buffers.

Krita exchange should use `paint/krita/<session-id>/manifest.json` with declared canvas, timeline frames, layer id/name, reference raster paths, output PNG paths, and optional Krita editable-state metadata pointing at `krita/session.kra`. The importer should trust the manifest plus declared PNGs, not parse `.kra` internals or import Krita layer stacks.

Asset: `.efx-planning/research/roto-data-contract.md`.

## onion-skinning-contract: Onion Skin Reference Frames

Blocked by: krita-roundtrip, roto-data-contract
Status: resolved
Type: Research

### Question

How should EFX Motion provide previous and/or next painted frames to Krita and embedded paint adapters for onion-skin roto painting?

### Answer

Use EFX-owned onion reference rasters in the adapter session context, not Krita-native onion skinning as the v1 contract. Native Krita onion skins are tied to transparent animated layers and Krita timeline state; the first companion workflow is a manifest-driven folder exchange, so onion skins should be exported as declared reference PNGs and optionally materialized by Krita launch/template automation as locked reference/file layers.

Each onion reference records `role: onion`, target/current `appFrame`, source real-key `appFrame`, `direction: previous | next`, `distance: 1 | 2 | 3`, normalized `opacity`, dimensions, path/data URL, and whether the image is a stroke-only preview or cached composite. Build candidates only from `real-key` roto frames; exclude generated interpolation and background-only support frames. Prefer `onionDataUrl` when present, fall back to the cached real-key composite, and never import onion rasters back as paint output.

File exchange should name references explicitly, e.g. `references/onion-prev-01-000120-for-000123.png`, `onion-prev-02-000118-for-000123.png`, and `onion-next-01-000126-for-000123.png`. Default opacity falloff should match the embedded preview: 0.50, 0.25, 0.15 by distance, optionally multiplied by a master onion opacity if exposed. Tint/color is adapter-local; EFX should not bake red/green tint into canonical reference PNGs.

Asset: `.efx-planning/research/onion-skinning-contract.md`.

## krita-license-assets: Krita Source And Asset Constraints

Blocked by: none
Status: resolved
Type: Research

### Question

What can this project safely learn from Krita source, Python APIs, brush presets, and bundles without accidentally copying GPL-covered code/assets into EFX Motion?

### Answer

Treat Krita as an external GPL application and use it through process/file exchange. Safe: launch the installed Krita app, exchange project-folder files, import artist-exported PNGs, read public docs/API pages for behavior, and write original Krita-side automation against the documented Python plugin/CLI surface. Avoid: vendoring Krita source, closely porting GPL implementation details, copying Krita docs/manual text, or bundling Krita/default/third-party brush presets, bundles, patterns, textures, or palettes without a per-asset license audit.

Artist artwork exported from Krita is normally safe to import as user output; GPL generally does not cover program output unless the output copies substantial protected material from the program/assets. Brush presets and bundles are separate asset/data risks because `.kpp`, `.myb`, and `.bundle` resources can contain thumbnails, tips, textures, parameters, metadata, and manifests. Krita’s bundled resources are mixed-license, not uniformly GPL, so EFX Motion should not package them by default.

If a Krita exporter plugin is built, treat it as an optional Krita-side helper that runs inside Krita and writes EFX-compatible files/metadata. Keep the plugin original and separately identifiable; choose a GPL-compatible license for distributed Krita plugin code unless legal review says otherwise.

Asset: `.efx-planning/research/krita-license-assets.md`.

## brush-scope: Minimum Useful Roto Brush Behavior

Blocked by: paint-module-interface
Status: open
Type: Grilling

### Question

What brush/material behavior is required for EFX Motion roto paint to be useful before attempting a full natural-media engine?

### Answer

Unresolved. Candidate minimums: pressure opacity/radius, smooth stroke interpolation, alpha-preserving paint, wet smudge or RGBA-wet-like blending, eraser/mask behavior, and predictable frame-to-frame editing. Need user confirmation against real roto tasks.

## current-engine-bottleneck: Existing TypeScript Engine Evidence

Blocked by: brush-scope
Status: open
Type: Research

### Question

Which current TypeScript Canvas2D costs actually block real-time painting, and can the delayed finalization be reduced before Rust?

### Answer

Unresolved. Existing clues point to deferred stroke finalization, offscreen canvas/image-data work in the brush renderer, and full-canvas wet compositing. This ticket should add or design measurements and representative stroke fixtures before choosing Rust/WASM work.

## rust-wasm-spike: Rust/WASM Dirty-Rect Brush Prototype

Blocked by: brush-scope, current-engine-bottleneck, paint-module-interface
Status: open
Type: Prototype

### Question

Can a tiny Rust/WASM dirty-rect brush implementation produce better real-time feedback than the current TypeScript path while preserving the EFX paint module interface?

### Answer

Unresolved. Prototype should be throwaway, one brush only, no full UI, no native wgpu, and benchmarked against current representative strokes.

## native-wgpu-threshold: When Native/wgpu Becomes Worth It

Blocked by: rust-wasm-spike, roto-data-contract
Status: open
Type: Grilling

### Question

What evidence would justify restarting native Rust/wgpu work after the failed Phase 2 brush implementation?

### Answer

Unresolved. Candidate threshold: a proven brush/material model, stable EFX module interface, clear frame handoff strategy, and evidence that WASM/Canvas2D cannot hit required latency or quality.

## krita-launch-template: Krita Launch And Template Strategy

Blocked by: krita-roundtrip, roto-data-contract, onion-skinning-contract
Status: open
Type: Research

### Question

Should EFX Motion launch Krita with PNG references, create/open a `.kra` template, use Krita `--file-layer`, or install a Krita plugin/docker for the first usable companion workflow?

### Answer

Unresolved. The `krita-roundtrip` research recommends delaying this until the rendered-frame/data contract is fixed. The first implementation can start manually, but automation will need OS-specific Krita discovery/launch behavior and a decision about template ownership.

## krita-plugin-exporter: Krita Plugin Exporter Shape

Blocked by: krita-roundtrip, roto-data-contract, krita-license-assets
Status: open
Type: Research

### Question

If the manual Krita exchange loop is useful, what minimal Krita Python plugin/docker should be built to export EFX-compatible PNG sequences and metadata from inside Krita?

### Answer

Unresolved. Known direction: plugin runs inside Krita, uses `Krita.instance().activeDocument()`, `Document.exportImage(...)`, document animation methods, and the exchange manifest. It should not be treated as an embedded Krita engine inside EFX Motion.
