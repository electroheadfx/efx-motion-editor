# Onion Skin Reference Frames Research

## Question

How should EFX Motion provide previous and/or next painted frames to Krita and embedded paint adapters for onion-skin roto painting?

## Decision

Use EFX-owned onion reference rasters as part of the adapter session context. Do not make the v1 Krita exchange depend on Krita's native animation onion-skin system.

Krita native onion skins are useful when the artist is working in a Krita animation timeline with transparent animated layers. The first EFX companion workflow is a project-folder exchange centered on declared PNG references and imported real-key outputs, so v1 should provide onion skins as locked reference/file layers in the generated `.kra` or as clearly named reference images in the session folder. A later Krita template/plugin may choose to mirror those rasters into Krita animation frames and enable native onion skins, but that is an implementation detail behind the same manifest contract.

## Contract

Add onion references to the existing `RotoReferenceFrame` concept:

```ts
type RotoOnionReferenceFrame = RotoReferenceFrame & {
  role: 'onion';
  targetAppFrame: number;
  sourceAppFrame: number;
  direction: 'previous' | 'next';
  distance: 1 | 2 | 3;
  opacity: number;
  imageKind: 'stroke-preview' | 'cached-composite';
  source: 'real-key';
};
```

Selection rules:

- Build onion candidates only from real authored roto keys.
- Exclude generated interpolation and background-only support frames.
- For each target frame, pick the nearest previous and/or next real keys according to the session settings.
- Clamp count to 1-3 per enabled direction.
- Prefer `onionDataUrl`/stroke-only preview when available; fall back to the cached full-canvas real-key composite.
- The current target frame is not an onion reference; current paint remains a separate `current-paint` reference when needed.

Opacity rules:

- Store final normalized opacity on each onion reference.
- Default depth falloff should match the current embedded preview: distance 1 = `0.50`, distance 2 = `0.25`, distance 3 = `0.15`.
- If the UI exposes a master onion opacity, multiply the depth falloff by that master opacity before writing the manifest/session context.
- Tint/color is adapter-local. Krita may tint previous/next references if a plugin/template supports it; EFX should not bake tint into the canonical reference PNG.

## Krita exchange shape

Use the same `references` array from `roto-data-contract`, with onion-specific fields:

```json
{
  "role": "onion",
  "frameIndex": 0,
  "targetAppFrame": 123,
  "sourceAppFrame": 120,
  "direction": "previous",
  "distance": 1,
  "path": "references/onion-prev-01-000120-for-000123.png",
  "width": 1920,
  "height": 1080,
  "opacity": 0.5,
  "imageKind": "stroke-preview",
  "source": "real-key"
}
```

Recommended filenames:

```text
references/
  onion-prev-01-000120-for-000123.png
  onion-prev-02-000118-for-000123.png
  onion-next-01-000126-for-000123.png
```

For a generated `.kra`, put these into a locked group such as `EFX Onion References`, below the editable paint layer, with each layer/file layer locked and its layer opacity set from the manifest. Without a plugin/template, the manifest and PNG files are still the source of truth and the user can manually load them as references.

## Embedded adapter shape

Embedded adapters receive the same onion references as data URLs, image bitmaps, or paths. They should render onion references as non-editable overlays behind the active paint strokes and above any neutral base/background reference. They must not serialize onion references into editable stroke state or import them back as paint output.

## Implementation implications

- `PhysicPaintRotoCacheFrame.onionDataUrl` remains a useful stroke-only preview cache for EFX-authored keys.
- Existing Physics Paint settings already model `enabled`, `previous`, `next`, `count`, and `opacity`; the export path should convert those settings into explicit per-reference manifest records.
- Krita launch/template work should decide how to materialize locked reference layers, but not redefine the onion data contract.

## Sources checked

- Local Physics Paint types/store/persistence: `PhysicPaintRotoCacheFrame.onionDataUrl`, `PhysicsPaintOnionState`, persisted `onion_cache_path`, and embedded onion preview selection.
- Krita manual/API docs for animation/onion skins: native onion skins are tied to transparent animated layers and timeline frame offsets, with configurable previous/next visibility, opacity, and tint.
