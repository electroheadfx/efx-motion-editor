# Krita Round-Trip Research

## Question

What is the smallest Krita-assisted workflow that lets EFX Motion export roto context, let the artist paint with Krita brushes, and import the result back reliably?

## Recommendation

Use a **project-folder exchange workflow** first, not live embedding.

EFX Motion should export a Krita exchange folder containing reference frames, optional current paint frames, and a JSON manifest. Krita should open a `.kra` document or imported frame sequence from that folder. The artist paints in Krita using normal Krita brushes. EFX Motion then imports a rendered PNG sequence exported by Krita back into the existing Physics Paint rendered-frame/cache path.

The first version can be manual/semi-automated:

1. EFX Motion writes an exchange folder under the project, preferably `paint/krita/<session-id>/`.
2. EFX Motion writes `manifest.json` plus reference PNGs named by app frame.
3. EFX Motion opens Krita with the first reference image or a generated `.kra` template.
4. Artist paints in Krita.
5. Artist exports a transparent PNG sequence into `out/`.
6. EFX Motion imports `out/` according to `manifest.json` and converts it into `PhysicPaintRenderedFrame[]`.

A later version can add a Krita Python plugin/docker with “Export to EFX Motion” and “Reload EFX Context” buttons, but that plugin still runs inside Krita and exchanges files with EFX Motion.

## Why not embedding

Krita’s Python API and plugin model are in-process automation for Krita. Plugins are installed under Krita resource folders, registered as `Krita/PythonPlugin`, and can add menu actions or dockers. The documentation exposes `Krita.instance()`, active documents, document export, document/layer access, and application windows; it does not describe embedding Krita as a paint engine inside another application.

The Krita source tree also includes GPLv3 COPYING, so direct source/linking reuse belongs to the separate `krita-license-assets` decision.

## Useful Krita automation facts

### Command line

Krita command line supports:

- Open a file: `krita file.png` or `krita file.kra`.
- Export a file: `krita input.kra --export --export-filename output.png`.
- Export an animation sequence: `krita --export-sequence --export-filename frame.png input.kra`.
- Open as template: `krita --template path/to/template.kra`.
- Add a file layer: `krita file.kra --file-layer image.png` or `krita --new-image RGBA,U8,1000,1000 --file-layer image.png`.
- Start with UI modes such as `--nosplash`, `--canvasonly`, `--fullscreen`, or `--workspace Animation`.

The CLI is useful for opening prepared context and batch-exporting rendered outputs. It is not a complete inter-app protocol.

### Python plugin/API

Krita plugins can:

- Add menu actions through `window.createAction(...)`.
- Add dockers through `DockWidgetFactory`.
- Access the active document with `Krita.instance().activeDocument()`.
- Open documents with `Krita.instance().openDocument(path)`.
- Export the active document with `doc.exportImage(path, InfoObject())`.
- Read dimensions with `doc.width()` and `doc.height()`.
- Access nodes/layers via `rootNode()`, `topLevelNodes()`, `activeNode()`, and `nodeByName(...)`.
- Create layers including `paintlayer`, `grouplayer`, and `filelayer`.
- Access animation timing methods such as `animationLength()`, `currentTime()`, `setCurrentTime(...)`, `framesPerSecond()`, and `importAnimation(...)`.
- Force/reconcile projection with `refreshProjection()` and `waitForDone()` before export/readback.

A plugin is useful for a later “Export to EFX Motion” button. It should write files and metadata into the exchange folder, not try to communicate live pixels directly into EFX Motion.

## EFX Motion integration facts

Existing EFX Motion code already has most of the receiving shape:

- `app/src/types/physicPaint.ts` defines `PhysicPaintRenderedFrame` with `frameIndex`, `appFrame`, `dataUrl`, `width`, and `height`.
- `app/src/lib/physicPaintBridge.ts` applies `physic-paint:apply` payloads into `physicPaintStore`.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` already captures PNG data URLs from canvases and applies roto/play frame ranges.
- `app/src/lib/physicPaintPersistence.ts` stores rendered PNG bytes under `cache/physic-paint/...` and hydrates them back into data URLs.
- `app/src/components/physic-paint/physicsPaintDevExport.ts` already has a useful precedent: `manifest.json`, `frame-0000.png`, MIME type, `startFrame`, `frameCount`, and `fps`.
- `app/src-tauri/src/services/project_io.rs` already creates `paint/` and `cache/physic-paint/` directories; `paint/` is a natural home for Krita exchange/session files.

## Proposed exchange folder

```text
paint/krita/<session-id>/
  manifest.json
  source/
    reference-000123.png
    reference-000124.png
  current-paint/
    paint-000123.png
    paint-000124.png
  krita/
    session.kra
  out/
    paint-000123.png
    paint-000124.png
```

## Proposed manifest fields

```json
{
  "version": 1,
  "sessionId": "shot-001-roto-2026-06-30",
  "width": 1920,
  "height": 1080,
  "fps": 24,
  "startFrame": 123,
  "frameCount": 2,
  "frames": [
    {
      "frameIndex": 0,
      "appFrame": 123,
      "reference": "source/reference-000123.png",
      "currentPaint": "current-paint/paint-000123.png",
      "output": "out/paint-000123.png"
    }
  ],
  "alpha": "straight",
  "colorSpace": "sRGB",
  "expectedFormat": "image/png"
}
```

Keep this manifest intentionally rendered-output focused. Editable state is a separate concern and belongs in `roto-data-contract`.

## Recommended first implementation slice

1. Add an EFX Motion export action that writes a single-frame exchange folder.
2. Include one reference PNG and `manifest.json`.
3. Open Krita with the reference PNG or generated `.kra` template.
4. Add an EFX Motion import action that reads one transparent PNG from `out/` and applies it through the existing `PhysicPaintRenderedFrame` path.
5. Expand to frame ranges only after the single-frame path is stable.
6. Add a Krita plugin/docker later if the manual export/import loop is proven useful but repetitive.

## Open follow-up decisions

- The exact `manifest.json` contract should be resolved in `roto-data-contract`.
- Launching external Krita from Tauri may require a dedicated Tauri command and OS-specific app discovery.
- Whether to create `.kra` templates automatically or start with PNG/frame-sequence imports remains an implementation choice after the data contract is fixed.
- Krita plugin packaging and source/asset licensing belong to `krita-license-assets`.

## Sources checked

- Krita command-line documentation: export, export sequence, template, file-layer, workspace flags.
- Krita Python plugin how-to: extension actions, docker structure, `doc.exportImage(...)` example.
- Krita Python API docs: `Krita.openDocument`, `activeDocument`, `batchmode`, `Document.exportImage`, `saveAs`, node/layer and animation methods.
- EFX Motion local code exploration of Physics Paint types, bridge, persistence, dev export, Tauri project directories, and PNG export commands.
