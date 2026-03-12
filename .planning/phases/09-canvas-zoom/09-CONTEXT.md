# Phase 9: Canvas Zoom - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the canvas zoom functionality to the existing UI +/- percent controls in the toolbar. The zoom signals, wheel handlers, middle-click pan, and fit button already exist in CanvasArea.tsx — this phase connects the toolbar stub controls and adds missing interaction triggers (keyboard shortcuts, pinch-to-zoom). No new rendering capabilities.

</domain>

<decisions>
## Implementation Decisions

### Zoom step behavior
- Toolbar +/- buttons use **preset stops**: 10%, 25%, 50%, 75%, 100%, 150%, 200%, 300%, 400% (9 stops)
- Wheel/pinch zoom stays smooth and continuous (no snapping)
- When between presets (e.g. at 137% from wheel zoom), clicking + snaps to next preset up (150%), clicking - snaps to next preset down (100%)
- Percent display is **read-only** — no click-to-type direct input

### Zoom triggers
- **Toolbar +/- buttons** — snap to preset stops, zoom centered on canvas
- **Cmd+= / Cmd+-** keyboard shortcuts — same preset behavior as toolbar buttons, zoom centered on canvas
- **Cmd+0** — fit to window (same as Fit button)
- **Cmd/Ctrl + scroll wheel** — smooth continuous zoom anchored to cursor (already implemented)
- **Trackpad pinch-to-zoom** — smooth continuous zoom anchored to cursor, keep zoomed canvas centered in user's window (mirror existing timeline pinch pattern from TimelineInteraction.ts)
- **No double-click to fit** — avoids conflict with Phase 11 (Live Canvas Transform) click interactions
- **Zoom center rule**: buttons/keyboard = center of canvas; gestures (wheel/pinch) = cursor-anchored

### Zoom persistence
- **Session-only** — zoom is not saved to project file or app config
- **Fit-to-window on project open** — every project opens at calculated fit zoom, centered
- **Preserve across sequence switches** — switching sequences keeps current zoom/pan state
- **True fit-to-window** — Fit button calculates zoom level that makes full canvas visible in current window size (responsive to window resize), not a fixed 100% reset
- Pan resets to centered on Fit

### Claude's Discretion
- Zoom signal architecture (keep local vs move to store for toolbar access)
- Pinch-to-zoom implementation details (gesture event handling)
- Fit-to-window calculation approach (resize observer, container measurement)
- Toolbar button styling for active/disabled states at zoom limits

</decisions>

<specifics>
## Specific Ideas

- Pinch-to-zoom should try to keep the zoomed canvas centered in the user's window, even when the pinch gesture occurs near the edge of the canvas area
- Fit should be responsive — if the user resizes the window, the "fit" zoom level should recalculate accordingly
- Familiar Figma/Sketch-style preset stops for buttons

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `previewZoom` signal (0.1x–4x range, clamped): CanvasArea.tsx lines 8-10 — local signals for zoom, panX, panY
- `handleWheel`: CanvasArea.tsx lines 25-44 — Cmd/Ctrl + scroll wheel zoom with cursor anchoring, already working
- Middle-click pan: CanvasArea.tsx lines 46-77 — pointer event handlers for drag panning
- `handleFit`: CanvasArea.tsx lines 79-84 — currently resets to zoom=1, pan=0 (needs upgrade to true fit calculation)
- Zoom % display: CanvasArea.tsx line 148 — `{Math.round(previewZoom.value * 100)}%`, reactive
- Timeline pinch-to-zoom: TimelineInteraction.ts lines 567-587 — gesture event pattern to mirror
- Timeline zoom store: timelineStore.ts — `setZoom()` with clamping, good pattern reference
- tinykeys keyboard shortcuts: already wired throughout app

### Established Patterns
- CSS `transform: scale() translate()` for zoom/pan (CanvasArea.tsx line 100) — zoom applied at container level, not in PreviewRenderer
- PreviewRenderer is pure compositing (no zoom awareness) — zoom is a view concern
- Preact Signals for reactive state — zoom signals update UI automatically
- tinykeys for keyboard shortcut registration

### Integration Points
- Toolbar.tsx lines 108-114: stub +/- buttons and hardcoded "100%" display — need onClick handlers and signal binding
- CanvasArea.tsx: zoom signals may need to be accessible from Toolbar (either move to store or pass via context)
- Keyboard shortcuts registration: wherever existing shortcuts are bound (likely App.tsx or a shortcuts module)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-canvas-zoom*
*Context gathered: 2026-03-12*
