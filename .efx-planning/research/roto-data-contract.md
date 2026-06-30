# Roto Data Contract Research

## Question

What data must move between EFX Motion, Krita, and embedded paint adapters for roto animation: reference frames, masks, alpha, layers, frame ranges, timing, metadata, and editable state?

## Decision

Use a full-canvas, artifact-first roto contract with two separate lanes:

1. **Rendered outputs** are PNG RGBA artifacts mapped to EFX timeline frames.
2. **Editable state** is an adapter-owned document envelope, never mixed with rendered PNG frames.

EFX Motion owns timeline identity, layer identity, layer transforms/blend/opacity, cache invalidation, generated interpolation, and project persistence. Paint adapters own editable document internals and only have to exchange context rasters, opaque editable state, and rendered PNG outputs.

## Existing EFX shapes to align with

- `app/src/types/physicPaint.ts`
  - `PhysicPaintRenderedFrame`: `frameIndex`, `appFrame`, `dataUrl`, `width?`, `height?`, `source?`, `nearestRealKeyFrame?`.
  - `PhysicPaintRotoCacheFrame`: rendered frame plus `source`, `nearestRealKeyFrame?`, `backgroundOnly?`, `onionDataUrl?`.
  - Roto sources: `real-key`, `generated-interpolation`, `background-only-support`.
  - Apply payloads already separate rendered frames from `editableState`.
- `app/src/types/project.ts`
  - `McePhysicPaintOutput` persists rendered PNGs by `cache_path` and editable state separately.
  - `roto_cache_metadata` persists provenance and optional onion cache paths.
- `packages/efx-physic-paint/src/types.ts`
  - Current embedded editable state is `SerializedProject` version 2: width, height, strokes, settings.
  - Wet buffers, fluid buffers, alpha masks, and diffusion arrays are internal renderer state and are not serialized.
- `app/src/lib/physicPaintPersistence.ts`
  - Runtime PNG data URLs are persisted under `cache/physic-paint/<layer>/frame-<appFrame>-<frameIndex>.png`.
  - Onion PNGs use `onion-<appFrame>-<frameIndex>.png`.

## Canonical concepts

### Frame identity

- `appFrame`: the global EFX Motion timeline frame that receives or provides a roto frame.
- `frameIndex`: local sequence index inside an adapter render/export request.
- For stored roto keys, `appFrame` is the identity. EFX may normalize imported real-key roto frames to `frameIndex: 0` internally.
- `startFrame` is inclusive. `frameCount` covers `startFrame ... startFrame + frameCount - 1`.
- First implementation should stay integer-frame only. Motion blur/subframe export remains an EFX renderer concern.

### Layer identity

- Roto rendered PNGs are layer-local full-canvas images.
- EFX keeps layer transform, opacity, blend mode, order, visibility, and timeline placement outside the paint adapter.
- Reference composites may be flattened for artist context, but imported paint outputs must not bake EFX layer transforms or UI preview compositing into the pixels.

### Rendered frame provenance

- `real-key`: user/adapter-authored roto key for an `appFrame`; editable when the adapter has matching editable state.
- `generated-interpolation`: render-only frame derived by EFX from neighboring real keys.
- `background-only-support`: render-only support frame for missing-frame/background behavior.

External tools such as Krita should import back only `real-key` outputs. Generated interpolation and background support frames remain EFX-owned cache artifacts.

### Alpha and masks

- Canonical rendered output is PNG RGBA, 8-bit, sRGB, straight/unpremultiplied alpha.
- Transparent pixels mean no paint.
- The first contract treats roto masks as the output PNG alpha channel, not as separate vector masks or internal brush buffers.
- Optional mask/reference rasters may be provided as context images, but EFX should not depend on Krita layer masks or `.kra` internals for import.
- Background/reference imagery must not be baked into imported real-key paint unless the user explicitly exports a `background-only-support` artifact, which is not part of the first Krita import path.

## Adapter session context

EFX should open a paint adapter session with:

```ts
type RotoAdapterSessionContext = {
  operationId: string;
  sessionId: string;
  layerId: string;
  layerName?: string;
  workflowMode: 'roto';
  canvas: {
    width: number;
    height: number;
    colorSpace: 'srgb';
    alpha: 'straight';
  };
  timeline: {
    fps: number;
    startFrame: number;
    frameCount: number;
    frames: Array<{
      frameIndex: number;
      appFrame: number;
      timeSeconds?: number;
    }>;
  };
  background?: {
    background: 'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3';
    paperGrain: string;
    grainStrength: number;
    color?: string;
  };
  references: RotoReferenceFrame[];
  editableState?: RotoEditableStateEnvelope;
};
```

References are raster context artifacts:

```ts
type RotoReferenceFrame = {
  role: 'base-reference' | 'current-paint' | 'onion' | 'mask' | 'background';
  frameIndex: number;
  appFrame: number;
  path?: string;
  dataUrl?: string;
  width: number;
  height: number;
  opacity?: number;
  nearestRealKeyFrame?: number;
};
```

For external file exchange, prefer paths under the session folder. For embedded adapters, data URLs or image bitmaps are acceptable at the API boundary.

## Rendered output contract

Adapter render/import output should map cleanly to `PhysicPaintRotoCacheFrame`:

```ts
type RotoRenderedOutput = {
  frameIndex: number;
  appFrame: number;
  path?: string;
  dataUrl?: string;
  width: number;
  height: number;
  source: 'real-key';
  editableStateRevision?: string;
};
```

Validation rules:

- `appFrame` must be one of the declared session frames.
- Image must be PNG RGBA and match session width/height.
- Paths must stay inside the declared exchange/session folder.
- Missing outputs should be skipped or reported, not guessed.
- Unexpected output files should be ignored unless the manifest explicitly declares them.
- Import should invalidate generated interpolation/background cache for affected spans.

## Editable state envelope

Do not make EFX understand every adapter's document model. Store an envelope around adapter-owned state:

```ts
type RotoEditableStateEnvelope = {
  kind: 'efx-roto-editable-state';
  version: 1;
  adapterId: 'efx-physic-paint' | 'krita' | 'rust-wasm' | 'native-wgpu' | string;
  adapterSchemaVersion: string;
  canvas: { width: number; height: number };
  revision: string;
  savedAt: string;
  payload: unknown;
  assets?: Array<{
    role: 'document' | 'linked-image' | 'reference' | 'preview';
    path: string;
    mimeType?: string;
  }>;
};
```

Payload examples:

- `efx-physic-paint`: current `SerializedProject` JSON from `@efxlab/efx-physic-paint`.
- `krita`: `.kra` document path plus optional Krita-specific layer/group naming metadata. EFX does not parse `.kra` internals.
- `rust-wasm` or native renderer: adapter-specific JSON/binary state plus assets needed to reopen the session.

Rendered outputs remain valid even if editable state is absent. Editable state should only be loaded by an adapter with a matching `adapterId` and compatible schema version.

## Krita exchange folder

Use the folder shape from `krita-roundtrip`, with a stricter manifest:

```text
paint/krita/<session-id>/
  manifest.json
  references/
    base-000123.png
    current-paint-000123.png
    onion-prev-000123.png
  krita/
    session.kra
  out/
    paint-000123.png
```

Manifest v1:

```json
{
  "kind": "efx.krita.roto-session",
  "version": 1,
  "sessionId": "roto-layerA-2026-06-30T120000Z",
  "operationId": "...",
  "createdAt": "2026-06-30T12:00:00.000Z",
  "canvas": {
    "width": 1920,
    "height": 1080,
    "colorSpace": "srgb",
    "alpha": "straight"
  },
  "timeline": {
    "fps": 24,
    "startFrame": 123,
    "frameCount": 1,
    "frames": [
      { "frameIndex": 0, "appFrame": 123, "timeSeconds": 5.125 }
    ]
  },
  "layer": {
    "id": "physic-layer-id",
    "name": "Roto Paint",
    "workflowMode": "roto"
  },
  "references": [
    {
      "role": "base-reference",
      "frameIndex": 0,
      "appFrame": 123,
      "path": "references/base-000123.png",
      "width": 1920,
      "height": 1080,
      "opacity": 1
    }
  ],
  "outputs": [
    {
      "frameIndex": 0,
      "appFrame": 123,
      "path": "out/paint-000123.png",
      "source": "real-key",
      "required": true
    }
  ],
  "editableState": {
    "kind": "efx-roto-editable-state",
    "version": 1,
    "adapterId": "krita",
    "adapterSchemaVersion": "kra",
    "canvas": { "width": 1920, "height": 1080 },
    "revision": "...",
    "savedAt": "2026-06-30T12:00:00.000Z",
    "payload": { "document": "krita/session.kra" },
    "assets": [
      { "role": "document", "path": "krita/session.kra", "mimeType": "application/x-krita" }
    ]
  },
  "importRules": {
    "format": "image/png",
    "alpha": "straight",
    "missingOutput": "skip-with-warning",
    "unexpectedOutput": "ignore"
  }
}
```

Krita automation can create/open the `.kra`, export transparent PNGs to `out/`, and update `editableState.revision`. The EFX importer should rely on the manifest and PNGs, not on inspecting the `.kra` file.

## First implementation slice implied by the contract

1. Export one-frame Krita session folders with base reference PNG, optional current paint PNG, and `manifest.json`.
2. Import one declared `out/paint-<appFrame>.png` as a `real-key` roto frame.
3. Keep Krita `.kra` as external editable state metadata; do not force it into `SerializedProject`.
4. Expand to frame ranges after one-frame export/import is stable.
5. Add Krita plugin/docker only after the manual folder exchange proves useful.

## Non-goals for v1

- Parsing `.kra` internals.
- Importing Krita layer stacks as EFX layers.
- Preserving Krita brush strokes as EFX `SerializedProject` strokes.
- Exchanging wet/fluid/internal alpha buffers.
- Importing generated interpolation frames from external tools.
- Subframe/motion-blur paint outputs.

## Follow-up implications

- The paint adapter seam should move toward `RotoEditableStateEnvelope`; current `SerializedProject` becomes the `efx-physic-paint` payload type.
- `krita-launch-template` can now decide whether the first `.kra` is generated from references, opened from a reusable template, or created manually.
- `krita-plugin-exporter` should write the same manifest/output contract from inside Krita.
