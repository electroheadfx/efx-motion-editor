# Quick Task 260614-ujc: Phase 36.1 script play canvas update options - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Task Boundary

Phase 36.1
I would like to be able with script play canvas to update the animation by changing the paint tool (normal paint or physics) or the color, the stroke size or the background paper.
I have small ui change to do too:
- change "Preview / Save Play" button name to "Render play"
- Add a button : "Update", its mean it will check if the paint tool, the size brush, color, background paper or motion options changed for clear the cache and save these new options in script. It need for that script add this new options
- Brush size slider is difficult for small value, increase the slider and allow to enter a value from number click
- The change of background paper no work, if needed create a GSD debug

</domain>

<decisions>
## Implementation Decisions

### Update behavior
- The new Update button should compare current paint/render/motion options to the saved options for the current script play. If anything changed, it should save the new options and clear the cached render. It should not render immediately; the user renders with Render play.

### Script data
- Save paint tool, color, brush size, background paper, and motion options as a per-play render-options snapshot. Update affects the selected/current play only.

### Brush size control
- Improve the brush size control by making the slider wider and adding a clickable numeric input beside it for exact values, especially small values.

### Claude's Discretion
- Keep the requested UI changes minimal and aligned with existing Phase 36.1 UI: rename "Preview / Save Play" to "Render play", add "Update", and fix background paper changes. If the background paper issue requires deeper root-cause investigation, create or route to GSD debug.

</decisions>

<specifics>
## Specific Ideas

- The Update action is explicitly separate from rendering.
- The render cache should be cleared only when relevant saved options change.
- Background paper changes must be included in script play update detection and persistence.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
