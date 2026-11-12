# Phase 61: Vector Painting Tool - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-10
**Phase:** 61-Vector Painting Tool
**Areas discussed:** Curve family, Vector mode entry, Per-vertex width, Rendered look

---

## Curve family

| Option | Description | Selected |
|--------|-------------|----------|
| Bézier only | Corner + smooth anchors, handles per segment, handle break. Exactly matches VEC-01/02's vocabulary and Phase 62 reuses it one-for-one. Interpolating, so the curve always passes through your anchors. | |
| Bézier + auto-smooth | Bézier as above, plus a Catmull-Rom 'auto' anchor whose handles derive from its neighbours — place points and the curve flows through them with no handle dragging. | ✓ |
| Full curve menu | Per-stroke Bézier / Hermite / Catmull-Rom / B-Spline / TCB. Each needs its own evaluator, its own persisted curveType, and its own editing affordances. | |

**User's choice:** Bézier + auto-smooth
**Notes:** The full menu was rejected. B-Spline is approximating and would not pass through placed anchors — the same objection that rejected B-spline on Phase 59 motion channels.

| Option | Description | Selected |
|--------|-------------|----------|
| Auto by default, Alt = corner | Every placed point is auto-smooth; Alt while clicking places a hard corner. | ✓ |
| Corner by default, drag = smooth | Illustrator / Toon Boom / Phase 25 convention; the drag is the only way to get a smooth point. | |
| Corner default, Alt = auto | Corner is the norm; auto-smooth is the deliberate exception. | |

**User's choice:** Auto by default, Alt = corner

| Option | Description | Selected |
|--------|-------------|----------|
| Promote to Bézier | Auto-smooth anchors draw no handles; dragging a tangent promotes that anchor permanently. Exactly two anchor kinds. | ✓ |
| Explicit convert first | A separate convert action before handles appear. | |
| Keep auto, store an override | Third state: auto, auto-with-override, Bézier. | |

**User's choice:** Promote to Bézier

---

## Vector mode entry

| Option | Description | Selected |
|--------|-------------|----------|
| 5th tool in the tool row | Distinct vector entry in `AquarelleToolRow`; spline-pointer toggle in the Stroke Settings dialog header. | ✓ |
| Inside the Stroke Settings dialog | Both icons in the modal plus a 'New vector stroke' action — but the modal only exists once something is selected. | |
| Dedicated Vector mode in the header | A mode entry that swaps the tool row into vector tools. | |

**User's choice:** 5th tool in the tool row
**Notes:** The row already contains a watercolor tool named `pen` bound to `P`, so the vector entry needs a distinct label and a non-`P` shortcut.

| Option | Description | Selected |
|--------|-------------|----------|
| Two distinct controls | Tool-row button always means draw; dialog-header spline-pointer always means edit-the-selected-path. | ✓ |
| One button that changes meaning | A true toggle whose meaning depends on selection state. | |
| Auto-edit on click | Phase 25 precedent — clicking an existing stroke enters edit automatically. | |

**User's choice:** Two distinct controls

| Option | Description | Selected |
|--------|-------------|----------|
| Finish open, close on first anchor | Clicking the first anchor closes the path (stroke only, no fill). | |
| Always open | Enter or double-click ends the path; a vector stroke is always an open path. | ✓ |
| Defer the close question | Ship open, revisit when fill exists. | |

**User's choice:** Always open

---

## Per-vertex width

| Option | Description | Selected |
|--------|-------------|----------|
| Numeric field in the modal | Select anchors, set width with a stepper reusing `SliderStepper`; the canvas shows the resulting width. | ✓ |
| On-canvas width handles | Illustrator width-tool style perpendicular handles per anchor. | |
| Pressure at draw time only | Width captured from pen pressure, edited numerically after. | |

**User's choice:** Numeric field in the modal

| Option | Description | Selected |
|--------|-------------|----------|
| Multiplier of brush size | Factor against the stroke's brush size — matches the engine's `toolOverrides` multiplier vocabulary. | ✓ |
| Absolute pixels | A real diameter independent of the brush Size slider. | |
| Absolute, seeded from brush size | Stored absolute, initialised from brush size at draw time. | |

**User's choice:** Multiplier of brush size

| Option | Description | Selected |
|--------|-------------|----------|
| Sparse — only edited anchors | Untouched anchors interpolate from nearest set neighbours; a uniform stroke writes nothing. | ✓ |
| Dense — every anchor | Every anchor always stores a factor, default 1.0. | |
| Sparse, seeded while drawing | Sparse storage but seeded from pen pressure while drawing. | |

**User's choice:** Sparse — only edited anchors

---

## Rendered look

| Option | Description | Selected |
|--------|-------------|----------|
| Watercolor replay | Resample the Bézier and replay the watercolor deposit; indistinguishable in medium from hand-painted strokes. | |
| Clean vector ribbon | A flat swept band — truly resolution-independent, but a second renderer inside a single-engine product. | |
| Watercolor replay, supersampled | Replay baked at a multiple of sheet resolution and downsampled. | |

**User's choice:** Both worlds — but in one engine.
**Notes (verbatim intent):** *"if I want 'effect brush' and 'simple stroke' render, we should add to watercolor brushes this mode which support width pen sensitive pression, size, color and transparence."* and *"the clean ribbon should implemented in watercolor system in one engine. because all law for watercolor apply."*

| Option | Description | Selected |
|--------|-------------|----------|
| On the brush preset | Each brush declares its render mode. | |
| Per stroke, any brush either way | The mode is a stroke property; any brush can render either way. | ✓ |
| Two brush groups in the picker | The pack splits visibly into Effect and Simple groups. | |

**User's choice:** Per stroke, any brush either way — with the explicit constraint that both modes live in the one watercolor engine.

| Option | Description | Selected |
|--------|-------------|----------|
| Size, width, colour, opacity only | The seven wet globals inert and greyed in simple mode. | |
| All eight, minus wet simulation | Every global keeps a meaning; water/bleed/dry do nothing. | |
| A separate small param set | Simple mode brings its own parameter bag. | |
| *(free-text response)* | Size, width, colour, opacity exposed; a collapsed section exposes the seven wet globals, zero by default, so raising them blends physics into the ribbon. A new `simple-ribbon` brush joins the list. | ✓ |

**User's choice:** Free-text — the collapsed-advanced-section design.

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit mode + a preset | Per-stroke `renderMode`, with a `simple-ribbon` preset that selects it by default. | ✓ |
| The preset owns the mode | The chosen brush decides; no per-stroke override. | |
| Derived from the params | No mode field; all-zero wet params render as a ribbon. | |

**User's choice:** Explicit mode + a preset

| Option | Description | Selected |
|--------|-------------|----------|
| Both, vector and hand-painted | One spine sweep serves both stroke kinds. | ✓ |
| Vector strokes only for now | Hand-painted strokes always render watercolor in this phase. | |
| Both, but freehand is follow-up | The sweep supports both; only vector strokes expose the toggle. | |

**User's choice:** Both, vector and hand-painted

| Option | Description | Selected |
|--------|-------------|----------|
| All strokes, whole sheet | Every stroke renders as wireframe; nothing is baked, so it is a real performance mode. | ✓ |
| Vector strokes only | Hand-painted strokes keep their painted look. | |
| Automatic during vertex drags | Wireframe switches itself on during a drag. | |

**User's choice:** All strokes, whole sheet
**Notes:** The user additionally asked for a per-vertex stroke-width preview in the wireframe, mirroring the existing Move/Edit stroke mode.

---

## Claude's Discretion

- The auto-smooth tangent derivation (centripetal recommended over uniform, which overshoots and can loop).
- The vector tool's keyboard shortcut — `P` belongs to the watercolor pen.
- The visual form of anchors, handles and the width envelope in the wireframe.
- Insert/delete semantics on a sparse width profile.
- Whether the new `simple-ribbon` preset appears in the dropdown, the sidebar tab, or both.
- Undo granularity for anchor / handle / width operations, following the existing one-entry-per-gesture law.
- The reference stroke count for the responsiveness target — measured during the spike.
- Exact placement of the wireframe toggle.

## Deferred Ideas

- Closed paths and filled vector shapes.
- The full curve menu (Hermite / selectable Catmull-Rom / B-Spline / TCB).
- On-canvas width handles.
- Pressure-seeded per-vertex widths at draw time.
- Painted-stroke curve editing (Phase 62).
- Interpolation wiggle on vector strokes (milestone gate 5, not in VEC-01..07).

## Reviewed Todos (not folded)

- `261024-frame-fade-compositing` — composite-time crossfade effect, not vector painting. Reviewed and left pending, consistent with Phases 59 and 60.
