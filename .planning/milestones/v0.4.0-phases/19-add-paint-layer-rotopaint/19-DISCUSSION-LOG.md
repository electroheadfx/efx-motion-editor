# Phase 19: Add Paint Layer Rotopaint - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 19-add-paint-layer-rotopaint
**Areas discussed:** Drawing tools & brush types, Per-frame paint model, Canvas interaction mode, Rendering & export pipeline

---

## Drawing Tools & Brush Types

### Brush Engine Level

| Option | Description | Selected |
|--------|-------------|----------|
| Basic paint tools | Solid brush, soft brush, eraser. Fixed round shape, size slider, color picker | |
| Mid-range brush engine | Solid, soft, eraser + opacity per stroke, pressure sensitivity, customizable hardness | |
| Full rotopaint suite | Brush, clone, smear, dodge/burn, reveal. Nuke/Silhouette-style toolset | |

**User's choice:** Custom — brush engine based on perfect-freehand library (https://github.com/steveruizok/perfect-freehand)
**Notes:** User specified a concrete library rather than picking an abstraction level. Perfect-freehand provides smooth pressure-sensitive strokes with variable width.

### Tool Types

| Option | Description | Selected |
|--------|-------------|----------|
| Brush + Eraser | Draw and erase strokes. Minimum viable rotopaint | ✓ |
| Color picker | Eyedropper to match existing frame colors | ✓ |
| Fill tool | Flood-fill enclosed areas with solid color | ✓ |
| Line/shape tools | Straight lines, rectangles, ellipses | ✓ |

**User's choice:** All four tool types selected
**Notes:** Full tool suite for both freehand and geometric work

### Stroke Color Model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-stroke color + opacity | Each stroke has own color and opacity. Multi-colored paint per frame | ✓ |
| Global paint color only | One active color at a time, all strokes share it | |
| Per-stroke color, layer opacity | Each stroke has color but opacity at layer level only | |

**User's choice:** Per-stroke color + opacity
**Notes:** Maximum artistic flexibility

---

## Per-Frame Paint Model

### Paint Data Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Vector strokes per frame | Array of stroke objects per frame, rendered at display time | ✓ |
| Raster bitmap per frame | PNG/bitmap per frame. Simpler but large, no stroke editing | |
| Hybrid: vector + raster cache | Vector source of truth, cached bitmaps for playback | |

**User's choice:** Vector strokes per frame using perfect-freehand's API
**Notes:** Consistent with library choice — store input points, generate outlines at render time

### Frame Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| One paint frame per key photo | Paint follows key photo structure, hold frames share paint | |
| One paint frame per timeline frame | Every timeline frame gets own paint canvas | ✓ |
| Sparse paint frames | Paint only on chosen frames, rest transparent | |

**User's choice:** One paint frame per timeline frame
**Notes:** True frame-by-frame animation support, independent of key photo structure

### Onion Skinning

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with configurable range | Ghosted paint from N prev/next frames, configurable opacity falloff | ✓ |
| Yes, simple (prev/next only) | Ghosted paint from just previous and next frame | |
| No onion skinning | Current frame only | |
| You decide | Claude picks during planning | |

**User's choice:** Yes, with configurable range
**Notes:** Essential for rotoscoping workflow

---

## Canvas Interaction Mode

### Enter/Exit Paint Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle button in toolbar | Paint mode toggle in canvas toolbar, cursor change, border color | ✓ |
| Auto when paint layer selected | Selecting paint layer auto-enters paint mode | |
| Dedicated paint panel | Floating tool panel appears when paint layer selected | |

**User's choice:** Toggle button in toolbar
**Notes:** Explicit mode switching with clear visual feedback

### Tool Options Location

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar properties panel | Reuse existing properties panel pattern | |
| Floating toolbar on canvas | Compact floating bar near canvas | |
| Both: sidebar + compact canvas bar | Full controls in sidebar, quick access in floating bar | ✓ |

**User's choice:** Both sidebar and compact canvas bar
**Notes:** Full controls in sidebar for detailed editing, floating bar for quick brush/color while painting

### Zoom/Pan in Paint Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Hold Space to pan, pinch to zoom | Standard Photoshop/Procreate convention | ✓ |
| Modifier key switches modes | Alt+drag pans, Ctrl+scroll zooms | |
| You decide | Claude picks based on existing implementation | |

**User's choice:** Hold Space to pan, pinch to zoom
**Notes:** Industry-standard convention

---

## Rendering & Export Pipeline

### Compositing

| Option | Description | Selected |
|--------|-------------|----------|
| Standard layer compositing | Paint in layer stack, existing blend modes and opacity | ✓ |
| Paint above everything | Always on top, ignoring layer order | |
| Paint as mask layer | Alpha mask for layer below | |

**User's choice:** Standard layer compositing
**Notes:** Consistent with existing layer system

### Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in .mce file | Stroke data in project JSON | |
| Sidecar files | Separate files alongside .mce (paint/layer-id/frame-NNN.json) | ✓ |
| You decide | Claude picks based on data sizes | |

**User's choice:** Sidecar files
**Notes:** Keeps .mce file small, paint data lazy-loaded

---

## Claude's Discretion

- Brush size range and default values
- Stroke undo granularity
- Keyboard shortcuts for tool switching
- Onion skin default opacity falloff
- Floating toolbar layout and positioning
- Export performance optimization
- Fill tool algorithm
- Shape tool rendering approach

## Deferred Ideas

None
