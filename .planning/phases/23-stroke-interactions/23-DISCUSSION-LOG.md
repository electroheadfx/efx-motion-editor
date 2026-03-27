# Phase 23: Stroke Interactions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 23-stroke-interactions
**Areas discussed:** Alt+drag duplicate, Non-uniform scale handles, Undo/redo for transforms

---

## Alt+Drag Duplicate

### Duplicate appearance behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Clone-in-place, drag clone | Alt+drag creates clone at original position, drags clone. Original stays. Like Illustrator/Figma. | ✓ |
| Clone at drop position | Ghost preview follows cursor, clone created only on release. | |
| Clone with offset | Alt+click creates duplicate at fixed offset (+10px). Stamp-like. | |

**User's choice:** Clone-in-place, drag clone
**Notes:** None

### Element types to duplicate

| Option | Description | Selected |
|--------|-------------|----------|
| Brush strokes only | Only PaintStroke elements. Matches requirement wording. | |
| All selected elements | Any PaintElement: strokes, shapes, fills. | ✓ |

**User's choice:** All selected elements
**Notes:** None

### Multi-selection support

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, duplicate all selected | Alt+drag clones all selected, preserving relative positions. One undo entry. | ✓ |
| Single stroke only | Only works with exactly one stroke selected. | |

**User's choice:** Yes, duplicate all selected
**Notes:** None

---

## Non-Uniform Scale Handles

### Handle arrangement

| Option | Description | Selected |
|--------|-------------|----------|
| Add edge midpoint handles | Keep 4 corner handles (uniform). Add 4 edge midpoints (single-axis). 8 total + rotate. | ✓ |
| Corners become non-uniform | Corner handles scale X/Y independently. Shift constrains uniform. 4 handles + rotate. | |
| Edge handles only | Replace corners with 4 edge midpoints. No uniform from corners. | |

**User's choice:** Add edge midpoint handles
**Notes:** None

### Scale pivot point

| Option | Description | Selected |
|--------|-------------|----------|
| From opposite edge | Opposite edge stays fixed. Like Photoshop/Figma. | ✓ |
| From center | Both sides stretch equally from center. | |

**User's choice:** From opposite edge
**Notes:** None

### Brush size during non-uniform scale

| Option | Description | Selected |
|--------|-------------|----------|
| Scale by average | Brush size scales by average of scaleX/scaleY. | |
| Keep brush size fixed | Only positions change. Thickness unchanged. | ✓ |
| Scale by max axis | Use larger of scaleX/scaleY for brush size. | |

**User's choice:** Keep brush size fixed
**Notes:** None

---

## Undo/Redo for Transforms

### Undo strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot before, commit on release | Capture snapshot before gesture. Push one undo entry on pointer-up. | ✓ |
| Diff-based undo | Track delta and reverse. More precise but more complex per transform type. | |

**User's choice:** Snapshot before, commit on release
**Notes:** None

### Retrofit scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fix all transforms | Add undo to ALL: drag-move, uniform scale, rotate, plus new operations. | ✓ |
| New operations only | Only add undo to Alt+duplicate and non-uniform scale. | |

**User's choice:** Fix all transforms
**Notes:** User asked about paint stroke drawing undo — confirmed addElement already has pushAction undo support (Ctrl+Z after drawing removes the stroke).

---

## Claude's Discretion

- Edge handle visual style and cursor changes
- Alt key visual indicator during duplicate drag
- Snapshot cloning strategy

## Deferred Ideas

None — discussion stayed within phase scope
