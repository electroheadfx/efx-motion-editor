# Quick Task 261029-vbp: Reveal Colorize Option - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Task Boundary

Add a Colorize option to the Reveal workflow. When enabled, the revealed photo is colorized by the script's wash pigment with a percent mix (default 100% when checked). A script containing different brushes and brush colours tints each stroke's revealed area with that stroke's colour, at the chosen mix. Watercolor variation (per-pixel pigment and density) must show through. Colorize is off by default, preserving today's reveal behaviour exactly.

</domain>

<decisions>
## Implementation Decisions

### Colorize blend
- Luminance-preserving colorize. At 100% mix the photo's detail (waves, texture) stays visible; hue and saturation come from the wash pigment. A blue sea revealed through a red wash reads as a red sea that still looks like a sea — not a flat red silhouette.
- Mix is a 0–100 slider; 0% equals the current (no colorize) result, 100% is full hue/saturation replacement. The mix interpolates the colorize strength.
- The reveal silhouette/alpha is unchanged by colorize: the wash alpha still defines the revealed area.

### Colour source
- Per-stroke wash pigment, taken from the watercolor wash itself (the same converted raster that supplies pigment alpha). Each brush colour tints its own revealed area; overlapping washes mix naturally; watercolor variation is preserved.
- No flat colour picker in this task.

### Controls scope
- Colorize checkbox + Mix slider live in the Reveal tab of the Create Rail dialog.
- Default: checkbox off; when checked, mix defaults to 100%.
- The chosen settings are persisted on the reveal rail record (`PhysicPaintRotoLoopClip` optional fields) so a Replay re-bakes identically.
- Existing reveal rails without the fields keep today's behaviour (colorize off).
- Editing an existing reveal rail's colorize/mix is NOT in scope for this task (edit modes currently render the Paint surface).

### Claude's Discretion
- Exact slider/checkbox markup and placement inside the Reveal tab, matching the existing dialog card conventions.
- Implementation technique for the luminance-preserving blend (canvas blend mode vs explicit pixel math), provided the result is deterministic and testable.
- Field naming for the persisted rail settings.

</decisions>

<specifics>
## Specific Ideas

- Example from the user: stroke is 100% red, photo is a blue sea → the revealed photo becomes a red sea, painted with the watercolor nuances.
- "So I can paint a reveal with a script which has different brush, brush color which will apply on the photo at the percent of mix" — per-stroke colours must be honoured, not a single global tint.
- Mix slider decides the blend between the brush/wash colour and the photo's colour.

</specifics>

<canonical_refs>
## Canonical References

- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptRenderer.ts` — the reveal bake; `compositeRevealMask` currently masks the reference by wash alpha.
- `app/src/lib/rasterAlpha.ts` — `transmittanceToAlpha` already derives per-pixel pigment colour and coverage from the watercolor transmittance raster.
- `app/src/stores/physicPaintStore.ts` — `commitRevealBake` / `RevealBakeInput` carry the bake through the acknowledged physical-edit transaction.
- `app/src/stores/efxPaintStore.ts` — `createRevealRail` (creation IS the first bake) and `replayRevealRail` (must reuse persisted settings).
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — `PhysicPaintRotoLoopClip` shape and its validator.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` and `physicsPaintRotoPlayScriptController.ts` — the Reveal tab UI and its ports.
- `app/src/components/physic-paint/roto/physicsPaintRotoRevealBake.test.ts` — existing reveal bake contract.

</canonical_refs>
