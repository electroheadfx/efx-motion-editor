# Phase 33: Enhance Current Engine - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Small improvements and fixes to the existing perfect-freehand + p5.brush paint layers. No engine swap (phases 27-32 failed on that approach). This phase works with the current Canvas 2D + p5.brush standalone pipeline. Physical paint mode is grayed/placeholder only.

</domain>

<decisions>
## Implementation Decisions

### Auto-enter paint mode
- **D-01:** Creating a new paint layer auto-switches to paint edit mode (equivalent to pressing `[p]`)
- **D-02:** Default brush color is last-used color from preferences; without saved preference, default is `#203769` at size 35px. Color and size persist across sessions in app preferences.

### Clear Brush
- **D-03:** "Clear Brush" button deletes all strokes on current frame without confirmation dialog
- **D-04:** `Cmd+Z` must properly undo clear brush and re-render the canvas (currently broken)

### Undo rendering bugs
- **D-05:** `Cmd+Z` after drawing or clearing must update the canvas render immediately — both flat and FX strokes must re-render correctly after undo
- **D-06:** FX paint mode undo bug: after undo, FX strokes render as flat until next interaction. Fix: invalidate FX cache on undo and force re-render.

### Circle cursor
- **D-07:** Paint brush shows a circle cursor at the current brush pixel size
- **D-08:** Circle cursor scales with canvas zoom (35px brush at 200% zoom = 70px circle on screen), matching Photoshop behavior

### Inline color picker (canvas-side)
- **D-09:** The brush color button in PaintProperties does NOT open the modal color picker. Instead it toggles an inline color picker docked on the left side of the canvas, like the mini brush palette.
- **D-10:** Inline picker has 4 visual modes: Box (HSV square + hue/alpha sliders, default), TSL (H/S/L/A sliders), RVB (R/G/B/A sliders), CMYK (C/M/Y/K/A sliders). Plus HEX input field.
- **D-11:** Inline picker auto-applies color on interaction — no Apply/Cancel buttons. Stays open until user closes it via the picker's own close button or the color toggle button in sidebar.
- **D-12:** Swatches section: row of recent colors (auto-collected) + row of saved favorites (user-managed, add/remove). Both persisted in preferences.

### Color picker modal (non-paint contexts)
- **D-13:** Remove Apply/Cancel buttons — selected color applies in realtime on interaction
- **D-14:** Remove dark background overlay effect on modal
- **D-15:** Modal opens near mouse position instead of center of app. If mouse is near window border, modal is clamped to stay fully visible within app bounds.
- **D-16:** Close by clicking outside the modal (already implemented, but now the color is already applied so no confirmation needed)

### Flat brush transparency
- **D-17:** Flat brush mode renders on transparent background by default (no white background)
- **D-18:** User can toggle a colored background if desired. When in flat brush mode, the "Show Seq BG" option is hidden from sidebar.

### Exit paint mode button
- **D-19:** "Exit Paint Mode" button is larger and styled in orange with a CSS pulsate color animation to make it visually prominent

### Sidebar layout
- **D-20:** STROKES panel moves before SELECTION panel in the sidebar ordering

### Paint mode system (3 modes)
- **D-21:** Three brush modes in UI: **Paint (flat)**, **FX Paint**, **Physical Paint** (grayed out, placeholder for next phase)
- **D-22:** Default mode is Paint (flat). FX brush styles (watercolor, ink, charcoal, pencil, marker) are hidden in flat mode.
- **D-23:** Mode switch only affects the current frame
- **D-24:** Each individual stroke has a mode type: flat, fx-paint (future: physic-paint)
- **D-25:** Cannot mix flat and FX strokes on the same frame — modes are mutually exclusive per frame

### Mode conversion flow
- **D-26:** Switching from flat to FX when canvas has strokes: dialog asks to pick FX style (watercolor/ink/charcoal/pencil/marker) to convert all strokes, then asks "current frame only or all frames?"
- **D-27:** Switching from FX to flat: confirmation dialog asks "Convert all strokes to flat on current frame or all frames?"
- **D-28:** Switching when canvas is empty: toggles immediately, no dialog

### Layer settings in paint edit mode
- **D-29:** All paint modes show Blend Mode and Opacity slider in edit mode (layer-level settings) instead of "Show BG Background"
- **D-30:** "Show flat preview" toggle only visible in FX Paint mode

### FX paint background
- **D-31:** FX paint background is always white (p5.brush limitation). Background color option is hidden in sidebar when in FX mode.
- **D-32:** Compositing over photos is done via layer blend mode and opacity (accessible from edit/paint mode or normal layer properties)

### FX paint bug fixes
- **D-33:** BUG FIX: Selecting an FX brush style (e.g., watercolor) in FX mode must actually paint in that style — currently paints flat and requires manual reselection in edit mode
- **D-34:** BUG FIX: Undo in FX mode must invalidate FX cache and re-render all strokes with correct FX style (currently falls back to flat rendering after undo)
- **D-35:** Selected FX stroke shows visible stroke wireframe/path line so user can grab and move it without needing to click exactly on the rendered stroke area. Transform bounding box interaction for move within the selection bounds.

### Animation (stroke draw reveal)
- **D-36:** "Animate" button placed to the right of "Copy to next frame" button
- **D-37:** Animate opens a modal dialog with two target options: (1) from current frame to end of layer, (2) from current frame to end of current sequence
- **D-38:** Animation distributes the selected stroke's points across the target frame range using the original drawing speed — slow parts take more frames, fast parts fewer (speed-based distribution for natural reveal)
- **D-39:** No preview before confirming — user sets parameters and goes. Can undo if result is not satisfactory.

### Claude's Discretion
- Inline color picker component implementation (build custom or adapt existing library)
- Circle cursor rendering approach (CSS, canvas overlay, or SVG)
- FX cache invalidation strategy details for undo fix
- Speed-based point distribution algorithm for animate feature
- Exact pulsate animation CSS keyframes for exit button

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Paint engine (current)
- `app/src/lib/paintRenderer.ts` — Canvas 2D flat stroke rendering via perfect-freehand
- `app/src/lib/brushP5Adapter.ts` — p5.brush standalone FX rendering (watercolor, ink, charcoal, pencil, marker)
- `app/src/stores/paintStore.ts` — Paint state signals, frame management, FX cache, paintVersion bumping
- `app/src/types/paint.ts` — PaintStroke, BrushStyle, BrushFxParams, StrokeFxState types

### Paint UI
- `app/src/components/canvas/PaintOverlay.tsx` — Pointer input handling, drawing, bezier editing, coordinate mapping
- `app/src/components/sidebar/PaintProperties.tsx` — Brush style selector, stroke options, FX params UI
- `app/src/components/overlay/PaintToolbar.tsx` — Paint mode toolbar

### Supporting
- `app/src/lib/paintPersistence.ts` — Sidecar JSON save/load for paint frames
- `app/src/lib/paintFloodFill.ts` — Flood fill implementation
- `app/src/lib/bezierPath.ts` — Bezier anchor editing, path sampling
- `app/src/lib/brushPreviewData.ts` — Brush style preview SVG data

### Requirements
- `.planning/REQUIREMENTS.md` — ENGN and PAINT requirement IDs (many will be addressed by this phase)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `paintStore.ts` already has `brushStyle`, `brushFxParams`, `paintBgColor` signals — mode system can build on these
- `brushP5Adapter.ts` has `renderFrameFx()` for FX rendering with per-stroke style mapping — needs cache invalidation fix
- `_frameFxCache` Map in paintStore for FX render caching — needs invalidation on undo
- `ColorPickerModal` component exists (`app/src/components/shared/ColorPickerModal.tsx`) — can be adapted for inline picker
- `StrokeList` component exists in sidebar — reorder for STROKES before SELECTION

### Established Patterns
- Signal-based reactivity with `paintVersion` bump on every mutation
- `pushAction()` for undo/redo via command pattern
- `renderPaintFrame()` in paintRenderer for flat strokes, `renderFrameFx()` in brushP5Adapter for FX
- Canvas coordinate mapping via `clientToCanvas()` in PaintOverlay

### Integration Points
- PaintOverlay renders on top of the canvas — circle cursor goes here
- Inline color picker docks alongside canvas (like mini palette)
- Animate feature writes to paintStore frames via existing `addStroke()` API
- Mode conversion uses existing `setBrushStyle()` and stroke mutation APIs
- Preferences persistence via existing app config system (Tauri store or localStorage)

</code_context>

<specifics>
## Specific Ideas

- Inline color picker modes match the screenshots provided: Box (HSV square), TSL (H/S/L/A sliders), RVB (R/G/B/A sliders), CMYK (C/M/Y/K/A sliders)
- Speed-based animation: the original pointer speed during drawing determines how many frames each segment of the stroke takes — fast drawing = fewer frames, slow drawing = more frames
- Physical Paint mode is grayed out in the UI as a placeholder — clicking it does nothing or shows a tooltip "Coming in next phase"
- The flat/FX mode exclusivity is per-frame, not per-layer — different frames on the same layer could theoretically have different modes after conversion

</specifics>

<deferred>
## Deferred Ideas

- Physical Paint mode integration (efx-physic-paint engine) — next phase
- Custom user brush presets via JSON (PAINT-09 from requirements) — future phase
- Per-stroke physics parameter isolation (PAINT-10) — future phase
- Multi-frame stroke operations (PAINT-11) — separate from animate feature
- Stroke grouping/nesting hierarchy (PAINT-12) — future phase

</deferred>

---

*Phase: 33-enhance-current-engine*
*Context gathered: 2026-04-05*
