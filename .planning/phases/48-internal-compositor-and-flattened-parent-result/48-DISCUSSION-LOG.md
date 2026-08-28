# Phase 48: Internal Compositor and Flattened Parent Result - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 48-internal-compositor-and-flattened-parent-result
**Areas discussed:** Opacity/blend order, Background scope, Studio preview surface, Flattened raster caching, Missing-source visual, Content precedence, Main-editor delivery

---

## Opacity/blend order

| Option | Description | Selected |
|--------|-------------|----------|
| Opacity first (AE) | The track's own pixels are scaled by its opacity first, then the blend mode composites that result onto the stack below. After Effects convention; what the milestone research recommends. | ✓ |
| Blend first | The full-strength blend mode is applied first, then opacity fades the blended result. Some NLEs (e.g. Resolve) do this. | |

**User's choice:** Opacity first (AE)
**Notes:** Matches the research recommendation.

## Alpha convention

| Option | Description | Selected |
|--------|-------------|----------|
| Straight alpha (Rec.) | The flattened raster carries unmultiplied RGBA; the main editor's compositor handles the alpha math. Enforced with a pixel test (50%-alpha white must composite as 50% white, not dark gray). | ✓ |
| Premultiplied | The flattened raster is premultiplied (RGB already multiplied by A). Faster downstream compositing but risks double-premultiplication dark halos. | |

**User's choice:** Straight alpha (Rec.)
**Notes:** Locked as a boundary contract (Pitfall 7).

## Background scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full resolution now (Rec.) | The compositor resolves Background clips now — modulo, repeat, gaps, next-clip interruption — reusing the existing Loop Clip resolver. Phase 49 only adds the import/repeat/fallback UI. | ✓ |
| Fallback only | The compositor handles only the transparent/solid fallback now; Background clip resolution lands with Phase 49's import UI. | |

**User's choice:** Full resolution now (Rec.)
**Notes:** Matches the spec's composition order and keeps the compositor a clean addition for later track types.

## Background solo interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Bg stays on solo (Rec.) | The Background is composited beneath all Paint tracks regardless of Paint solo — only Paint tracks participate in the solo truth table. | ✓ |
| Bg hides on solo | Soloing a Paint track also hides the Background, so the soloed track is seen in complete isolation. | |

**User's choice:** Bg stays on solo (Rec.)
**Notes:** Matches the spec's composition order.

## Studio preview surface

| Option | Description | Selected |
|--------|-------------|----------|
| Composite (Rec.) | The Studio canvas shows the flattened composite — all visible tracks composited, exactly what the main editor will show. Painting/onion-skin/stroke-editing still target the active track. | ✓ |
| Active track only | The Studio canvas shows only the active track's content, keeping the current single-track editing UX. | |
| Toggle | A view toggle between the flattened composite and the active-track editing view. | |

**User's choice:** Composite (Rec.)
**Notes:** Standard NLE program-monitor UX.

## Onion skin

| Option | Description | Selected |
|--------|-------------|----------|
| Ghost over composite (Rec.) | The onion skin shows the active track's previous/next frames ghosted on top of the current composite. | ✓ |
| Active track only | The onion skin replaces the composite with the active track's previous/next frames (current single-track behavior). | |

**User's choice:** Ghost over composite (Rec.)
**Notes:** The ghost is the active track's raw frames, not re-composited.

## Flattened raster caching

| Option | Description | Selected |
|--------|-------------|----------|
| Per-track + composite (Rec.) | Each track's frame content is cached keyed by track revision + composition deps; a composite pass combines the cached track rasters. When one track changes, only that track's cache recomputes. | ✓ |
| Full flattened cache | The flattened raster per frame is cached keyed by composite revision + frame. Simpler, but any track change recomputes the whole flattened raster. | |

**User's choice:** Per-track + composite (Rec.)
**Notes:** Matches the research recommendation; scales to many tracks.

## Composite pass caching

| Option | Description | Selected |
|--------|-------------|----------|
| Cache composite (Rec.) | The composite pass result per frame is cached (keyed by composite revision + frame), so playback draws the cached flattened raster. | ✓ |
| Recompute on demand | The composite pass re-runs on demand each frame, drawing the cached track rasters. Saves memory but heavier at 15/24 fps. | |

**User's choice:** Cache composite (Rec.)
**Notes:** Smoothest playback; invalidates when any participating track changes.

## Missing-source visual

| Option | Description | Selected |
|--------|-------------|----------|
| Transparent (Rec.) | The flattened raster renders transparent for missing sources — fail-closed, matching Phase 46 D-13. The Studio surfaces the issue via the status capsule. | ✓ |
| Studio placeholder | The Studio preview overlays a visible placeholder on the missing frame, but the placeholder is a Studio-only overlay, NOT part of the flattened raster. | |

**User's choice:** Transparent (Rec.)
**Notes:** No placeholder ever leaks into the flattened output or export.

## Content precedence

| Option | Description | Selected |
|--------|-------------|----------|
| Roto wins (Rec.) | Real key > generated interpolation > Hold Loop Clip > cached frame. Matches the current single-track resolver. | ✓ |
| Cached frame wins | The accepted cached frame is the durable truth and wins over roto content. | |

**User's choice:** Roto wins (Rec.)
**Notes:** The Roto timeline is the source of truth; a cached frame is a potentially-stale render of it.

## Main-editor delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Store function (Rec.) | A new store function getFlattenedFrame(layerId, frame) returns the composited raster + cache key, mirroring the current getRotoPhysicalRenderSource pattern. | ✓ |
| Direct compositor call | The main renderer imports the compositor module and calls it directly, bypassing the store. | |

**User's choice:** Store function (Rec.)
**Notes:** Keeps the main renderer decoupled and matches the existing render-cache pattern.

---

## Claude's Discretion

- Exact cache-key structure for the flattened raster (composite revision + per-track content revisions + frame) and the composite-revision bump semantics (number vs derived hash).
- Exact store/function shape for `getFlattenedFrame` and the compositor module layout in `app/src/efx-paint/compositor/`.
- How the Studio status capsule flags missing sources (reuse the existing red-warning-triangle pattern).
- The pixel-tolerance policy values for the pixel acceptance matrix (existing policy reused).

## Deferred Ideas

- Background import/repeat/fallback-config UI — Phase 49 (BKG).
- Photo/reference track — Phase 50 (REF).
- Shared mask compositor and Reveal — Phase 52.
