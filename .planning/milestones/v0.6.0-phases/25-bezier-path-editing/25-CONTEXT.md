# Phase 25: Bezier Path Editing - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can edit freehand stroke paths (and shape paths after conversion) as bezier curves with draggable anchor points for precise shape refinement. Covers PINT-03 and PINT-04: entering bezier edit mode, converting points to anchors, handle interaction, and adding/deleting control points. A dedicated pen tool is NOT a drawing tool (PINT-05 is future scope) — it only edits existing strokes.

</domain>

<decisions>
## Implementation Decisions

### Editing Mode Entry
- **D-01:** Dedicated pen tool button in the paint toolbar. When the pen tool is active and a stroke is clicked, bezier anchors auto-show immediately — the tool IS the mode.
- **D-02:** Selecting a different stroke while pen tool is active automatically shows its anchors too (no extra click needed).
- **D-03:** Pen tool works on ALL element types: brush strokes, eraser strokes, and shapes (line, rect, ellipse). Shapes undergo one-way conversion to bezier paths (lose shape identity, become PaintStroke with bezier data).

### Point Conversion
- **D-04:** Auto-simplify freehand points on pen tool activation. Run Douglas-Peucker or similar to reduce [x,y,pressure] arrays to ~10-30 cubic bezier anchors. User edits the simplified path.
- **D-05:** Preserve pressure data per bezier anchor. Each anchor retains its pressure value so stroke width still varies along the path after editing.
- **D-06:** Shapes convert to minimal anchors: rect = 4 corners, ellipse = 4 quadrant points with handles, line = 2 endpoints.
- **D-07:** Store bezier data as a new field on PaintStroke (e.g., `anchors` or `bezierPoints`). This replaces the original `points` array — no fallback to original freehand points. Once bezier-edited, the stroke uses bezier data for rendering.

### Handle Interaction
- **D-08:** Smooth (coupled) handles by default — both handles stay aligned at 180 degrees. Alt+drag breaks tangent to create a corner point. Standard Illustrator/Figma convention.
- **D-09:** Illustrator-style visuals: square anchors (filled = selected, hollow = unselected), round handles connected by thin lines. Blue/white color scheme on the dark canvas.
- **D-10:** Segment dragging supported — dragging the curve between two anchors adjusts nearby handles automatically for intuitive reshaping.

### Add/Delete Points
- **D-11:** Click on a path segment (with pen tool active in edit mode) to insert a new anchor at that position. Path shape preserved, just gains a new editable point.
- **D-12:** Select an anchor, then press Delete or Backspace to remove it. Path reconnects smoothly — adjacent handles auto-adjust for continuity.
- **D-13:** Undo/redo follows Phase 23's snapshot-before/commit-on-release pattern. One undo entry per drag gesture, per point add, per point delete.

### Claude's Discretion
- Douglas-Peucker tolerance calibration and simplification algorithm details
- Exact anchor/handle sizes, colors, and hit-test radii for the dark theme
- Segment drag handle adjustment algorithm
- Smooth reconnection algorithm when deleting anchors
- Pen tool icon design and toolbar placement
- How shape-to-path conversion handles filled vs outline shapes
- Whether eraser strokes need special handling (they use destination-out compositing)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Paint types and data model
- `Application/src/types/paint.ts` — PaintStroke, PaintShape, PaintFill, PaintElement union type, PaintFrame. The `points` field and stroke options are defined here.

### Paint store and state management
- `Application/src/stores/paintStore.ts` — Paint state signals, element mutation methods, undo/redo via pushAction, paintVersion signal for reactivity

### Rendering pipeline
- `Application/src/lib/paintRenderer.ts` — Stroke rendering using quadratic bezier through midpoints. Must be updated to render from bezier anchor data when present.

### Canvas interaction and overlays
- `Application/src/components/canvas/PaintOverlay.tsx` — Tool interactions, pointer events, select mode, transform gestures (Phase 23). Pen tool interactions go here.
- `Application/src/components/canvas/TransformOverlay.tsx` — Existing handle rendering (move/rotate/scale). Reference for handle interaction patterns.

### Stroke list integration
- `Application/src/components/sidebar/StrokeList.tsx` — Stroke selection sync with canvas. Pen tool edits must sync selection state.

### Paint toolbar
- `Application/src/components/overlay/PaintToolbar.tsx` — Tool buttons. Pen tool button added here.

### Persistence
- `Application/src/lib/paintPersistence.ts` — Paint sidecar JSON save/load. Must persist bezier anchor data.

### Prior phase decisions
- `.planning/phases/23-stroke-interactions/23-CONTEXT.md` — Snapshot-before/commit-on-release undo pattern (D-07), brush size not scaled during transforms (D-06)
- `.planning/phases/24-stroke-list-panel/24-CONTEXT.md` — Visibility field conventions (D-05), selection sync patterns (D-09, D-10)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `paintRenderer.ts` already uses quadratic bezier curves through midpoints for smooth stroke outlines — rendering pipeline has bezier foundations
- `TransformOverlay.tsx` has handle rendering logic (8 handles + rotate) that can inform bezier handle drawing
- `PaintOverlay.tsx` has the full select-mode gesture pipeline (pointerdown/move/up, snapshot undo) — pen tool builds on this
- `perfect-freehand` library's `getStroke()` produces outline points — bezier editing replaces this path generation

### Established Patterns
- `paintVersion++` signal bump required on all paint mutations for reactivity (Phase 22)
- `pushAction()` for undo/redo with snapshot-before/commit-on-release (Phase 23)
- `PaintToolType` union in paint.ts — pen tool type added here
- `selectedStrokeIds` signal for selection state shared between canvas and StrokeList
- `structuredClone` for deep copying element state in undo snapshots

### Integration Points
- PaintToolbar.tsx — new pen tool button alongside existing 8 tools
- PaintOverlay.tsx — pen tool pointer event handling (anchor drag, segment click, etc.)
- paintRenderer.ts — conditional rendering from bezier anchors vs original points
- paint.ts types — new BezierAnchor type, optional `anchors` field on PaintStroke
- paintPersistence.ts — serialize/deserialize bezier anchor data in sidecar JSON
- shortcuts.ts — keyboard shortcut for pen tool (if needed)

</code_context>

<specifics>
## Specific Ideas

- Illustrator/Figma-style bezier editing conventions: smooth coupled handles, Alt to break tangent, square anchors with round handles
- One-way shape-to-path conversion when pen tool activates on a shape element
- Segment dragging for intuitive curve reshaping without finding exact handles

</specifics>

<deferred>
## Deferred Ideas

- Dedicated bezier pen drawing tool (draw new paths from scratch) — PINT-05, future phase (v0.7+)
- Bezier path for new shape creation (pen tool as a drawing instrument) — separate capability

None — discussion stayed within phase scope

</deferred>

---

*Phase: 25-bezier-path-editing*
*Context gathered: 2026-04-03*
