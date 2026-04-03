# Phase 22: Foundation & Quick Wins - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix pre-existing paint bugs (moveElements* missing paintVersion++ and undo), add _notifyVisualChange helper, and deliver three isolated UX improvements: paint properties panel reorganization, sequence-scoped layer creation, and denser motion path interpolation dots.

</domain>

<decisions>
## Implementation Decisions

### Panel Reorganization (UXP-01)
- **D-01:** Remove PAINT BACKGROUND title. Background color swatch and "Show Seq BG" checkbox on same row (2-col), with Reset button right-aligned at end of row. Remove description text under the checkbox.
- **D-02:** Rename "Show Sequence overlay" to "Show Seq BG"
- **D-03:** Remove BRUSH STYLE title. Move style buttons (Watercolor, Ink, Charcoal, Pencil, Marker) into the BRUSH section, before size controls
- **D-04:** BRUSH section uses 2-col rows: Size (slider+field) | Color (swatch+hex) on one row; Opacity (slider) | Clear Brushes (red button, white text) on second row
- **D-05:** Replace "Clear Frame" button with "Clear Brushes" inline in the BRUSH section (red bg, white text). Remove separate ACTIONS section
- **D-06:** Remove STROKE title. Thinning/Smoothing/Streamline sliders live under BRUSH section (no section label)
- **D-07:** Bottom section order (top to bottom): BRUSH, TABLET, ONION SKIN. These are the only sections at the bottom of the panel
- **D-08:** SELECT mode: group "Select All Strokes" and "Delete Selected" on one row (2-col). Group Width (slider+field) and Color (swatch+hex) on one row (2-col)

### Layer Scope Behavior (UXP-02)
- **D-09:** When a sequence is isolated (soloed), creating any new layer type (static image, image sequence, video, paint/roto) adds it only to that sequence
- **D-10:** Add menu shows "Adding to: [Sequence Name]" indicator when a sequence is isolated, so the user knows the target

### Motion Path Density (UXP-03)
- **D-11:** Use sub-frame sampling (fractional frame steps, e.g., 0.25) when total frame span is below a threshold, so short sequences always produce a smooth-looking dotted path

### Bug Fixes (pre-existing)
- **D-12:** Fix moveElementsForward, moveElementsBackward, moveElementsToFront, moveElementsToBack in paintStore.ts: add paintVersion++ and pushAction undo/redo support (matching pattern from addElement/removeElement)

### Claude's Discretion
- Sub-frame sampling threshold and step size for motion path density
- Exact 2-col CSS layout approach (grid vs flex) for panel reorganization
- _notifyVisualChange helper API design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Paint Properties Panel
- `Application/src/components/sidebar/PaintProperties.tsx` -- Current panel implementation (~930 lines, all sections)
- `Application/src/stores/paintStore.ts` -- Paint store with moveElements* bug sites and paintVersion signal

### Layer Creation
- `Application/src/components/layer/AddLayerMenu.tsx` -- Current add-layer menu (no isolation awareness)
- `Application/src/stores/soloStore.ts` -- Solo/isolation state
- `Application/src/stores/isolationStore.ts` -- Isolation store

### Motion Path
- `Application/src/components/canvas/MotionPath.tsx` -- sampleMotionDots() function and rendering
- `Application/src/lib/keyframeEngine.ts` -- interpolateAt() used by motion path sampling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SectionLabel` component: used for section headers in PaintProperties
- `ColorPickerModal`: reusable color picker modal, already integrated
- `soloStore` / `isolationStore`: provide isolation state signals to check during layer creation
- `interpolateAt()` in keyframeEngine: already supports fractional frame values for sub-frame sampling

### Established Patterns
- Collapsible sections use local `useState` booleans (e.g., `bgCollapsed`, `onionCollapsed`, `tabletCollapsed`)
- Tool-conditional rendering via `activeTool` checks (BRUSH_TOOLS, SHAPE_TOOLS, etc.)
- `paintVersion.value++` pattern for triggering visual updates after paint data mutations
- `pushAction()` for undo/redo with snapshot/restore pattern

### Integration Points
- `PaintProperties` is rendered by `LeftPanel.tsx` when paint mode is active
- `AddLayerMenu` is rendered in the sidebar — needs to read solo/isolation state
- `MotionPath` renders on `CanvasArea` — `sampleMotionDots` is a pure function, easy to modify

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 22-foundation-quick-wins*
*Context gathered: 2026-03-26*
