# Phase 25: Bezier Path Editing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-03
**Phase:** 25-bezier-path-editing
**Areas discussed:** Editing mode entry, Point conversion, Handle interaction, Add/delete points

---

## Editing Mode Entry

### How should users enter bezier editing mode?

| Option | Description | Selected |
|--------|-------------|----------|
| Double-click stroke | Double-click a selected stroke to enter bezier edit mode. Illustrator/Figma pattern | |
| Dedicated pen tool button | Add a new "Pen" tool to the paint toolbar. Selecting a stroke shows anchors | ✓ |
| Toggle in StrokeList | "Edit Path" button per stroke row in STROKES panel | |

**User's choice:** Dedicated pen tool button

### Auto-show anchors when switching strokes?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-show anchors | Any stroke clicked with pen tool immediately shows bezier anchors | ✓ |
| No, explicit click to edit | Click a stroke to select, another click to show anchors | |

**User's choice:** Yes, auto-show anchors

### Should pen tool work on shapes too?

| Option | Description | Selected |
|--------|-------------|----------|
| Brush/eraser strokes only | Shapes keep their coordinate editing | |
| All element types | Convert shapes to paths too | ✓ |

**User's choice:** All element types

### Shape-to-path conversion reversibility?

| Option | Description | Selected |
|--------|-------------|----------|
| One-way conversion | Shape becomes PaintStroke with bezier points, loses shape identity | ✓ |
| Reversible / dual mode | Shape keeps identity with optional bezier override | |

**User's choice:** One-way conversion

---

## Point Conversion

### Freehand point to bezier anchor strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-simplify on entry | Douglas-Peucker reduces to ~10-30 anchors with cubic bezier segments | ✓ |
| Show all original points | Every freehand point becomes an anchor | |
| Progressive detail levels | Start simplified, slider to adjust detail | |

**User's choice:** Auto-simplify on entry

### Shape anchor counts?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal anchors | Rect = 4, Ellipse = 4 quadrant, Line = 2 | ✓ |
| You decide | Claude picks appropriate counts | |

**User's choice:** Minimal anchors

### Preserve pressure through conversion?

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve pressure per anchor | Each bezier anchor keeps pressure value | ✓ |
| Flatten to uniform width | Single stroke width after conversion | |
| You decide | Claude picks based on complexity | |

**User's choice:** Preserve pressure per anchor

### Storage of edited bezier data?

| Option | Description | Selected |
|--------|-------------|----------|
| New bezier field on PaintStroke | Optional `anchors` field, replaces original points | ✓ |
| Replace original points | Convert back to dense point array | |
| You decide | Claude picks storage approach | |

**User's choice:** New bezier field on PaintStroke which replaces original points (no fallback)

---

## Handle Interaction

### Default handle behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Smooth (coupled handles) | Both handles stay aligned, Alt breaks tangent | ✓ |
| Corner (independent handles) | Handles move independently by default | |
| Auto-detect from curvature | Analyze stroke curvature per point | |

**User's choice:** Smooth (coupled handles)

### Visual style for anchors and handles?

| Option | Description | Selected |
|--------|-------------|----------|
| Illustrator-style | Square anchors, round handles, blue/white scheme | ✓ |
| Minimal dots | Small colored dots, thin lines | |
| You decide | Claude picks style fitting dark theme | |

**User's choice:** Illustrator-style

### Segment dragging support?

| Option | Description | Selected |
|--------|-------------|----------|
| Anchors and handles only | Only drag anchors or handles | |
| Segment drag too | Dragging curve adjusts nearby handles | ✓ |
| You decide | Claude picks based on complexity | |

**User's choice:** Segment drag too

---

## Add/Delete Points

### How to add new control points?

| Option | Description | Selected |
|--------|-------------|----------|
| Click on path segment | Insert anchor at click position, preserving shape | ✓ |
| Click anywhere + snap | Click near path, snaps to nearest position | |
| Context menu on segment | Right-click for "Add Point" option | |

**User's choice:** Click on path segment

### How to delete control points?

| Option | Description | Selected |
|--------|-------------|----------|
| Select anchor + Delete/Backspace | Standard keyboard deletion | ✓ |
| Alt+click anchor | Fast single-action but Alt conflict | |
| Both methods | Multiple delete methods | |

**User's choice:** Select anchor + Delete/Backspace key

### Path reconnection on delete?

| Option | Description | Selected |
|--------|-------------|----------|
| Smooth reconnect | Adjacent handles auto-adjust for continuity | ✓ |
| Sharp reconnect | Simple straight connection | |
| You decide | Claude picks best approach | |

**User's choice:** Smooth reconnect

---

## Claude's Discretion

- Douglas-Peucker tolerance calibration
- Anchor/handle sizes, colors, hit-test radii
- Segment drag algorithm
- Smooth reconnection algorithm
- Pen tool icon and toolbar placement
- Shape-to-path conversion for filled vs outline shapes
- Eraser stroke handling in bezier mode

## Deferred Ideas

- Dedicated bezier pen drawing tool (PINT-05) — v0.7+ future phase
