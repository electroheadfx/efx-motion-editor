# Quick Task 261030-ey9: Reveal rail wiggle enhancement - Context

**Gathered:** 2026-10-30
**Status:** Ready for planning

<domain>
## Task Boundary

Reveal rail wiggle enhancement:

- Add a checkbox in Reveal to wiggle the photo position during frames.
- Add rotation and scale wiggle for all modes (reveal/static/motion).

</domain>

<decisions>
## Implementation Decisions

### Photo wiggle target
- A checkbox in the Reveal tab (Reveal Photo Rail) that, when enabled, moves the WHOLE revealed result as one unit per frame: the placed photo AND the wash silhouette move together.
- Off keeps today's behavior: the existing Motion wiggle still poses the wash coverage; the photo stays as placed.
- No separate strength slider — the photo wiggle reuses the Motion wiggle values. All values at 0 means no visible motion even when checked.

### Reveal modes
- The photo wiggle applies to both Reveal Motion (progressive) and Reveal Static.

### Rotation and scale wiggle
- Add two Motion wiggle channels: Rotation (degrees) and Scale (uniform percent), each a 0-100 slider.
- At value 100: ±10 degrees rotation and ±10% uniform scale (bold).
- Pivot: each element around its own center — every stroke rotates/scales around its own centroid; the aquarelle sheet and the reveal photo pivot around their own center.
- Applies to all modes: Paint Motion, Paint Static, Reveal Motion, Reveal Static.

### Control homes
- Create Rail dialog "Motion wiggle" card: add Rotation and Scale rows alongside Deformation and Position.
- Right-panel Motion tab: add Rotate and Scale rows alongside Deform and Move.
- Both surfaces read/write the SAME settings model so their defaults stay in sync.

### Claude's Discretion
- Exact noise channels, hold law, and clamping follow the existing deterministic stop-motion held-pose law (2-frame hold, seeded noise).
- Copy: "Rotate" in the right panel, "Rotation" in the dialog; "Scale" in both.
- Persistence: motion records gain rotation/scale; absent values read as 0 (no legacy migration shims, per project policy).

</decisions>

<specifics>
## Specific Ideas

- Rotation and scale should feel like the same family as Deform/Move — a stop-motion boil, not a smooth animation.
- The Reveal checkbox should be a plain on/off toggle, consistent with the existing Reveal toggles (Colorize, Infinity).

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in the decisions above, grounded in the existing Reveal rail bake and the shared held-pose wiggle law.

</canonical_refs>
