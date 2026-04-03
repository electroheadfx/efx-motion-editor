---
phase: 25-bezier-path-editing
plan: 03
subsystem: paint
tags: [bezier, pen-tool, path-editing, overlay, undo, interaction]

# Dependency graph
requires:
  - phase: 25-01
    provides: BezierAnchor types, bezierPath.ts math functions
  - phase: 25-02
    provides: Bezier-aware rendering, convertToBezier/convertShapeToBezier store methods, pen tool in toolbar
provides:
  - Full pen tool interaction system in PaintOverlay
  - Bezier overlay rendering (anchors, handles, path lines)
  - Anchor/handle/segment drag with real-time feedback
  - Point insertion (Cmd+click) and deletion (Delete key)
  - Handle coupling with Alt+drag corner break
  - Undo/redo for all bezier operations
  - Double-click to enter edit mode from select tool
  - Progressive simplify button in toolbar
  - Edit path icon in StrokeList
  - P keyboard shortcut for pen tool
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [bezier-overlay-rendering, snapshot-undo, progressive-simplification]

key-files:
  created: []
  modified:
    - Application/src/components/canvas/PaintOverlay.tsx
    - Application/src/components/overlay/PaintToolbar.tsx
    - Application/src/components/sidebar/StrokeList.tsx
    - Application/src/stores/paintStore.ts
    - Application/src/lib/shortcuts.ts
---

## What was built

Full pen tool interaction system for bezier path editing in PaintOverlay.tsx:
- Click stroke with pen tool to see anchor points along the path
- Drag anchors to reshape stroke with real-time visual feedback
- Drag handles to adjust curve tangents with smooth coupling by default
- Alt+drag handle to break tangent and create corner points
- Drag curve segments between anchors to reshape intuitively
- Cmd+click on path to insert new anchor points
- Delete/Backspace to remove selected anchor
- Blue overlay rendering: path lines, round handle dots, square anchor points
- Snapshot-before/commit-on-release undo for all operations

Additional UX features added during verification:
- Double-click on stroke in select mode enters pen edit mode
- Edit path (PenTool) icon in StrokeList sidebar on hover
- Progressive Simplify button in toolbar (Spline icon + point count)
- Selection boundary hidden during pen edit (only bezier overlay shown)
- Transform operations (move/rotate/scale) correctly update anchors
- Bezier-sampled hit testing for accurate stroke selection

## Deviations

- Added progressive simplify as manual button instead of auto-simplify (user preference)
- Initial fit tolerance kept at 4.0 for faithful representation; user clicks Simplify to reduce
- Used crosshair cursor for pen tool instead of custom SVG cursor (user preference)

## Self-Check: PASSED

- [x] All acceptance criteria from plan met
- [x] Human verification checkpoint approved
- [x] TypeScript compiles cleanly (no new errors)
- [x] Undo/redo works for all bezier operations
- [x] Select mode transforms work on bezier-edited strokes (regression fixed)
