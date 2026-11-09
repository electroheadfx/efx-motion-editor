# Phase 60: Studio Timeline Horizontal Zoom - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-09
**Phase:** 60-Studio Timeline Horizontal Zoom
**Areas discussed:** Zoom pill placement, Wheel zoom feel, Ruler labels at extremes, Cells & markers at zoom

---

## Todo triage (pre-discussion)

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it pending | Keep `261024-frame-fade-compositing` in `.planning/todos/pending/`; record as reviewed-not-folded | ✓ |
| Fold it in | Widen Phase 60 beyond ZOOM-01..05 with a paint/compositing display effect | |

**User's choice:** Leave it pending
**Notes:** The user asked what the todo was ("je sais pas ce que c'est ? c'est un quick qui traine ?"). It is not a quick — it is a low-severity backlog note from a watercolor-opacity debug (2026-10-24) describing a cumulative-frame crossfade display effect, explicitly "not scheduled". Unrelated to timeline zoom; matched only on the words *frame* and *export*.

---

## Zoom pill placement

### Sub-question 1 — where the pill lives

| Option | Description | Selected |
|--------|-------------|----------|
| Studio workflow header | A new `.physics-paint-pill` in the existing 46px header row, beside navigation and playback | ✓ |
| Floating over timeline | Absolute, translucent, radius 999px, over the lanes (canvas-pill pattern) | |
| Ruler right end | Inline at the ruler's right end; competes with the ruler's pointer-down seek | |

**User's choice:** Studio workflow header
**Notes:** Follows quick 260324-ju7, where the user moved canvas zoom controls from the bottom to the top for accessibility.

### Sub-question 2 — percent interactivity

| Option | Description | Selected |
|--------|-------------|----------|
| Display-only | A plain `<span>`; minus/plus step the preset ladder | ✓ |
| Preset dropdown | Percent opens a menu of the eight presets | |
| Editable field | Numeric input, accepts any value in range | |

**User's choice:** Display-only
**Notes:** Mirrors the shipped `PhysicsPaintCanvasZoomBar`, whose percent is a non-interactive span.

### Sub-question 3 — Fit behaviour on resize

| Option | Description | Selected |
|--------|-------------|----------|
| One-shot scale | Fit computes and applies once; later resizes leave the zoom alone | ✓ |
| Live Fit mode | Fit stays pressed and recomputes on container resize | |

**User's choice:** One-shot scale
**Notes:** Keeps one number as the authority; no "fitting" state to explain alongside the percent.

---

## Wheel zoom feel

| Option | Description | Selected |
|--------|-------------|----------|
| Continuous exponential | ~×1.1 per 100px of wheel delta, clamped 0.25–4; percent can read any integer | ✓ |
| Snap to presets per tick | Each tick moves one preset step | |
| Continuous, snap on release | Free while wheeling, snaps to nearest preset after ~150ms idle | |

**User's choice:** Continuous exponential
**Notes:** The modifier gesture is the fine-control path; minus/plus remain the discrete ladder. Buttons step from the current value (137% → 150%), never rounding to a preset first. Trackpad pinch is covered because macOS delivers it as ctrl+wheel.

---

## Ruler labels at extremes

### Sub-question 1 — how the ruler adapts

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive step, one label per tick | Smallest multiple of the 3-frame step leaving ≥40px per tick | ✓ |
| Fixed 3-frame ticks, thin the labels | Dense grid, labels skipped when they collide | |
| Fixed 3-frame ticks, clip labels | No adaptation; digits overlap at 0.25× | |

**User's choice:** Adaptive step, one label per tick
**Notes:** At 1× (54px), 2× and 4× the step stays 3 frames, so today's ruler is unchanged at 1×. Zoomed out it becomes 6, 12, 24… frames per tick.

### Sub-question 2 — subdividing when zoomed in

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 3 frames | The rule only ever coarsens | ✓ |
| Subdivide to 1 frame | Drop to per-frame ticks when a tick exceeds ~150px | |

**User's choice:** Keep 3 frames
**Notes:** At 4× the viewport shows about five labels; accepted, so no second labeling rule is introduced.

---

## Cells & markers at zoom

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed markers, cells scale | Cell width/gap/pitch scale; 6×6 keys and the playhead marker keep their pixel size | ✓ |
| Scale markers too | Every horizontal dimension multiplies by the scale — keys become slivers at 0.25× | |
| Fixed markers + drop the grid | As above plus an explicit grid-off threshold below 50% | |

**User's choice:** Fixed markers, cells scale
**Notes:** No grid threshold rule is needed — at 0.25× the 0.5px gaps antialias away and cells read as one band. Key overlap at 0.25× (6px key in a 4.5px slot) is accepted.

---

## Claude's Discretion

- Which strip regions respond to Cmd/Ctrl+wheel (recommended: the timeline scroller and ruler band; the header column does not zoom).
- The exact exponential constant and line-mode wheel normalization.
- The pill's exact position/order within the header row and its spacing, within the existing pill grammar.
- How scaled geometry reaches CSS-drawn values (custom properties vs inline), subject to the no-`transform: scale` constraint.
- The metrics module's API shape, provided it is the single authority.
- Whether the playhead half-cell offset becomes `framePitch / 2 - 1` or an equivalent asserted at every preset.

## Deferred Ideas

- Preset dropdown from the percent label
- Editable percent input
- Live Fit mode re-fitting on resize
- Ruler sub-ticks at high zoom
- Timeline zoom keyboard shortcuts (Cmd+= / Cmd+-)
- VIS-02 `30` vs `31` row-height drift (explicitly excluded here)

## Reviewed Todos (not folded)

- `261024-frame-fade-compositing` — paint/compositing display effect with its own staleness contract; unrelated to timeline zoom.
