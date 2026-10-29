# Quick Task 261029-hy2: UI enhancements — top bar, Settings modal, brush tab, modal stacking - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Task Boundary

Nine UI changes in the Physics Paint Studio:

1. Move the top-bar settings cluster (Brush size, Pigment, Water, Edges, Grain) to the right edge of the window.
2. Remove the right-sidebar "Settings" tab; move its content into a new floating modal.
3. Add a button at the top of the right-sidebar Brush tab that opens that Settings modal.
4. Add 15px top padding to the Brush-tab content.
5. Remove the brush settings clone under the brush grid in the Brush tab (Brush size + globals).
6. Refine the top-bar Eraser control to match the brush trigger: one integrated pill (thumb + name + chevron) instead of a thumb plus a native select.
7. Show the concerned tool's icon in the top-bar trigger (Eraser icon for Eraser, Brush icon for Brush); tools with no settings remove the whole settings cluster from the top bar.
8. Fix the brush modal's top-left Close button (it does not close the modal).
9. Manage modal z-depth: clicking any of the floating sheets brings it to the front.

</domain>

<decisions>
## Implementation Decisions

### Top-bar alignment
- The settings cluster is pinned to the right edge at every width (never centered).
- The existing container-query rules that hide Water / Edges / Grain as the bar narrows stay in force.

### Tool-settings trigger
- Only Brush and Eraser own top-bar settings. When Water or Pen is the active tool, the entire settings cluster is removed from the top bar (not just disabled).
- The left trigger becomes ONE pill: tool icon + painted thumb + name + chevron.
  - Brush tool: Paintbrush icon (lucide) + brush thumb + brush name.
  - Eraser tool: Eraser icon (lucide) + eraser-shape thumb + shape name.
- Clicking the pill opens that tool's dropdown.

### Eraser dropdown
- Reuse the brush-menu popover pattern (same anchored popover, painted thumbs, 15 BRUSH_PRESETS shapes). No native `<select>`.
- Picking a shape writes `aquarelleLiftTipId` through `setAquarelleLiftTipId` (never flips the active tool, never touches the brush selection or multipliers).
- The eraser popover has NO "Open modal" action (the brush catalog's cards would flip the tool to Brush).

### Water / Pen
- The left brush pill STAYS for Water and Pen (they still paint with the selected brush tip). Only the right-side settings cluster is removed.

### Settings modal
- Content is exactly the old Settings tab: the 8 per-brush response multipliers (Tip, Aspect, Rotation, SizeCurve, Scatter, Capacity, Grain, Wet round) via `BrushResponsePanel`.
- Opened from ONE entry point: a button at the top of the right-sidebar Brush tab.
- Follows the floating-sheet mechanics of the brush modal (anchored top-right inset, draggable header, bottom resize, Escape to close, session-scoped layout).

### Brush tab cleanup and padding
- The Brush tab keeps the brush grid (WatercolorBrushLibrary) and the new Settings button only.
- The cloned settings block is removed: the Brush size slider and the `AquarelleGlobalsPanel`.
- Layout order: Settings button flush at the tab top, then a 15px gap, then the brush grid.

### Modal stacking
- Click-to-front applies to the three floating sheets: Stroke settings, Brushes, and the new Settings modal.
- A shared stack-order mechanism raises the clicked sheet above the others; z-index values must stop being three independent constants.

### Brush modal Close button
- Root cause: the modal header is the drag handle; its `pointerdown` calls `setPointerCapture` + `preventDefault`, which suppresses the Close button's click. The stroke-settings dialog already solves this with `onPointerDown={(event) => event.stopPropagation()}` on the Close button — apply the same fix.

### Claude's Discretion
- Exact Settings modal dimensions, inset, and default height (mirror the brush modal family).
- Whether the Settings modal resets its drag/resize layout on close or keeps it for the Studio session (mirror the existing sheets).
- Implementation shape of the shared stack-order store (signal-based registry vs. explicit ordered ids).
- Test updates required by the tab removal and the trigger restyle.
- Any CSS naming for the new cluster/button (follow existing `physics-paint-*` conventions).

</decisions>

<specifics>
## Specific Ideas

- Images supplied by the user: top-bar sliders boxed with a right-pointing arrow; Settings tab (Tip/Aspect/Rotation/SizeCurve); brush grid at the tab top; brush-tab settings clone crossed out; current eraser thumb + select; brush trigger pill as the target look; eraser and brush tool icons.
- "UI like brush modal" = the floating `PhysicsPaintBrushModal` treatment, not a centered dialog.

</specifics>

<canonical_refs>
## Canonical References

- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` — top-bar left cluster + settings cluster.
- `app/src/components/physic-paint/view/LiftShapePicker.tsx` — current eraser control to replace.
- `app/src/components/physic-paint/view/PhysicsPaintBrushMenu.tsx` — popover pattern to reuse.
- `app/src/components/physic-paint/view/PhysicsPaintBrushModal.tsx` — floating sheet pattern + close-button bug.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — close-button fix reference and sibling sheet.
- `app/src/components/physic-paint/view/RightPanelBrushTab.tsx` — Brush tab to slim down.
- `app/src/components/physic-paint/view/RightPanelSettingsTab.tsx` — content to move into the modal.
- `app/src/components/physic-paint/view/BrushResponsePanel.tsx` — the modal body.
- `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx` — tab list (`topPaneTabs`).
- `app/src/components/physic-paint/physicsPaintStudio.css` — top-bar layout + container queries.

</canonical_refs>
