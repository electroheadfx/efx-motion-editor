# Phase 20: Paint Brush FX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26 (updated — reimplementation discussion)
**Phase:** 20-paint-brush-fx
**Mode:** Update after 8/10 plans completed — architectural reimplementation
**Areas discussed:** Rendering engine strategy, FX workflow, paint background, compositing

---

## Prior Discussion (2026-03-25)

Original discussion covered: brush style selector UX, FX parameter exposure, spectral mixing fidelity, watercolor rendering approach. All decisions captured in original context. See git history for original log.

---

## Reimplementation Discussion (2026-03-26)

### Context

User experienced multiple issues during Phase 20 execution:
- Poor transparency support (especially watercolor) with p5.brush
- Single frame cache insufficient for smooth playback at 15/24fps
- Combining watercolor with other FX paint types causes issues
- Watercolor opacity broken with p5.brush transparency
- p5.brush re-rendering all styled strokes per frame too slow

### User's Notes (verbatim)

```
Issues
- very support for transparence (specially water color) solution -> add a blending mode ?
- added cache but its not enough for fast playback, its only one frame cache, maybe flatten whole in image (HD) ?
- combine watercolor with other FX paint has issue: maybe a paint layer only per FX ? or a flat in image at each brush stroke added ?
- Remove opacity for water color (issue with transparence with p5)
- it render each stroke but the stroke are stored so I could roll back to flat stroke and I could convert whole stroke to FX with cached image
- Make a new mode: Apply a strokes to all frame or next stroke
- is Eraser may delete whole stroke ?

Globally I think it need for FX to store flat path but render each stroke on image, you can back on stroke flat and change to FX
it need to store the color of each stroke
```

---

## Rendering Engine Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Keep p5.brush adapter (current) | Re-render all styled strokes per frame | |
| Render-once per stroke, cache as raster | Draw flat, apply FX after, cache per stroke | ✓ |
| Different rendering library | Replace p5.brush entirely | |

**User's choice:** Render-once per stroke with cached raster images
**Notes:** Core insight — p5.brush should never run during playback. Draw flat, select, apply FX on demand.

---

## FX Application Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| FX chosen before drawing (current) | Pick style then draw | |
| FX applied after drawing via select tool | Draw flat, select strokes, apply FX | ✓ |
| Automatic on frame switch | Auto-apply when leaving frame | |

**User's choice:** Select tool workflow — draw flat, select, apply FX to selection
**Notes:** User wants to swap FX freely on already-applied strokes (re-render immediately, no queue). Select tool enables stroke-level erasing (delete whole stroke, not pixels).

---

## Paint Background

| Option | Description | Selected |
|--------|-------------|----------|
| Transparent (current) | Paint on transparent layer, causes p5.brush issues | |
| Solid white/color | Render on solid, overlay sequence for reference | ✓ |
| Textured/grain paper | Procedural noise background | Deferred |

**User's choice:** Solid white default with color picker. Sequence overlay toggle for reference.
**Notes:** Grain/texture paper background deferred to future phase.

---

## Compositing & Flatten

| Option | Description | Selected |
|--------|-------------|----------|
| Multiple cached images per frame | Each stroke = one raster, composite for playback | ✓ |
| Single image per frame | Flatten after each stroke added | |

**User's choice:** Per-stroke images with explicit flatten option
**Notes:** Flatten is destructive for cached images but flat vector strokes preserved. Can rollback and re-apply FX. User wants explicit flatten action, not automatic. Per-stroke is "sexy because I not need erase the pixel but the whole stroke."

---

## Claude's Discretion

- Select tool interaction design (tap vs lasso vs both)
- Flatten UI placement and confirmation flow
- Cached image format and resolution strategy
- Overlay transparency level for sequence preview

## Deferred Ideas

- Grain/texture paper background — future phase
- "Apply stroke to all frames" mode — new capability, separate phase
- Spectral pigment mixing (Kubelka-Munk) — re-evaluate if color quality insufficient with new approach
