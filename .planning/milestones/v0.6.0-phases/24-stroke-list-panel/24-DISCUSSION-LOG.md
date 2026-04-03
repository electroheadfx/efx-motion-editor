# Phase 24: Stroke List Panel - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 24-stroke-list-panel
**Areas discussed:** Panel placement, Stroke labeling, Visibility behavior, Selection sync

---

## Panel Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New section in PaintProperties | STROKES collapsible section at top of PaintProperties in SELECT mode. Reuses CollapsibleSection pattern. | ✓ |
| Dedicated right-side panel | Separate panel on right side, only in paint edit mode. More room but adds layout complexity. | |
| Popover from toolbar | Floating popover triggered by toolbar button. Dismissible, no permanent space. | |

**User's choice:** New section in PaintProperties (Recommended)
**Notes:** None

---

## Stroke Labeling

| Option | Description | Selected |
|--------|-------------|----------|
| Type + index | Auto-label: 'Brush 1', 'Line 2', 'Fill 3', 'Eraser 4'. Color swatch dot next to label. | ✓ |
| Type icon + color swatch only | Minimal: tool type icon + color dot, no text. Compact rows. | |
| Thumbnail preview | Tiny rendered preview of each stroke's shape. More visual but complex. | |

**User's choice:** Type + index (Recommended)
**Notes:** None

---

## Visibility Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fully hidden | Hidden strokes don't render on canvas at all. Eye icon toggle. Matches Photoshop layer visibility. | ✓ |
| Dimmed on canvas | Hidden strokes render at ~20% opacity. More visual context but more rendering complexity. | |

**User's choice:** Fully hidden (Recommended)
**Notes:** None

---

## Selection Sync

| Option | Description | Selected |
|--------|-------------|----------|
| Cmd+click and Shift+click | Standard macOS multi-select: click=single, Cmd+click=toggle, Shift+click=range. Syncs with selectedStrokeIds. | ✓ |
| Click only, no multi | Single selection from list only. Multi-select only via canvas marquee. | |
| Checkbox-based multi-select | Checkboxes on each row for batch operations. | |

**User's choice:** Cmd+click and Shift+click (Recommended)
**Notes:** None

---

## Claude's Discretion

- Exact row height, padding, spacing
- Eye icon and delete button sizing/styling
- Drag handle visual style
- Auto-scroll behavior details
- SortableJS configuration specifics

## Deferred Ideas

None — discussion stayed within phase scope
