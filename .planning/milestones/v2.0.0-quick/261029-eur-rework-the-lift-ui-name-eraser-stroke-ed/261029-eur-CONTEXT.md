# Quick Task 261029-eur: Rework the Lift (UI name: "Eraser") stroke-editing UX — Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Task Boundary

Rework the Lift / "Eraser" stroke-editing UX in Physic Paint Studio:

1. Replace the one-shot "Select lifts" top-bar button with an "Edit" switch
   (same markup/CSS as `ScriptRecordingSwitch`, `data-testid="physics-lift-edit"`).
2. Add a stroke-type filter (`all` | `paint` | `lift`) to the Stroke Settings dialog,
   affecting outline + hit-test only, with selection pruning.
3. Draw lift strokes as a red translucent ribbon matching the real eraser footprint,
   distinct from paint-stroke outlines, tracking drag/transform previews.
4. Rename every visible "Lift" string to "Eraser" — copy only, no identifier or
   serialization changes.

The full requirement text (verified context, 4 requirement blocks, 8 UAT rows,
constraints) is the description the orchestrator passes to the planner. This file
adds only the decisions taken during discussion; it never overrides that text.

</domain>

<decisions>
## Implementation Decisions

### Ribbon shape fidelity
- The lift ribbon is a **normal-offset band with round end caps**: walk the decimated
  centerline, offset each point by its own footprint support radius along the local
  normal to build the left and right edges, then close the polygon with
  semicircular caps at both ends (radius = the end point's own radius).
- Self-intersections on very tight turns are accepted and left to nonzero fill.
- No union-of-dabs outline tracing.

### Ribbon cost during drag
- The ribbon polygon is **memoized per stroke**, keyed by
  `(mutationId, aquarelleStrokesRevision, canvas width, canvas height)`.
- The overlay's drag and transform previews **translate / transform the cached
  polygon** — the same offset and the same transform matrix applied to the
  centerline — and never rebuild it during a pointermove.
- The memo must be bounded (entries for strokes that leave the listing are dropped,
  or the cache is reset on revision change) so repeated frame navigation cannot
  grow it without limit.

### Dialog dismissal in Edit
- An **explicit close wins**. Once the user dismisses the Stroke Settings dialog
  while select mode is on, it stays closed until select mode fully exits and
  re-enters. `keepOpenOnEmpty` must not resurrect it through the existing
  `sawEmptySinceDismiss` re-arm edge.
- **Consequence, accepted:** `keepOpenOnEmpty` is a watercolor select-mode law, not
  an Edit-mode law, so this applies to plain Move/Select paint editing too. Today
  the dialog re-arms when the selection empties; under `keepOpenOnEmpty` that edge
  is gated off and only the select-mode entry edge clears `dismissed`.
- This forces the watercolor close path to **dismiss without exiting select mode**.
  `closeMoveMode` currently calls `toggleAquarelleSelectMode()`; that must not be
  the watercolor close behavior. The `dismissed` reset belongs at the
  `setAquarelleSelectMode` choke point (compare-then-write), never in a render body.
- Brush-module behavior is unchanged.

### Switch placement and geometry frames
- The Edit switch replaces the button **in place inside the Eraser (Lift) cluster**,
  so it is visible only while the Eraser tool is active (`activeTool === 'lift'`).
  UAT row 1 is written against the Eraser tool's top bar, so this is the intended
  reading, not a global switch.
- The band support radius follows the spec's wording: **ellipse** for
  `aspect >= 0.6`, **rounded-rect** support for `aspect < 0.6`. The punch's true
  envelope is a rotated rectangle masked by the tip; the ellipse/capsule band is a
  declared visual approximation (UAT row 7 grades "reads as the footprint").
- Normals are derived in the **UV (y-up) frame** and only then mapped to canvas px.
  Using a canvas-frame angle with the UV tilt sign mirrors the ribbon on
  non-square sheets — the most likely geometry bug in this task.

### Claude's Discretion
- The exact signature that lets `setAquarelleSelectMode` distinguish a
  lift-edit entry from a normal toggle (an optional filter argument is the
  expected shape) — the planner chooses, provided `setAquarelleSelectMode` stays
  the single entry/exit choke point.
- The `AquarelleFootprint`-style helper's module name and export shape, provided
  it lives under `view/` and stays pure.
- Which existing source-pin tests are extended vs. rewritten, as long as coverage
  is not deleted.

</decisions>

<specifics>
## Specific Ideas

- Reuse the already-pure `liftShapeForStroke()` from `roto/aquarelleLiftErase.ts`
  (it returns tip data, aspect, preset angle and rotation) instead of re-deriving
  brush geometry.
- Reuse the punch's pressure sentinel (`p < 0` → 0.45) through a shared helper so a
  test can pin the outline radius against `collectLiftDabs`.
- `3^((engineSize - 0.5) * 2)` already exists three times in the engine layer
  (`aquarelleFootprint.ts`, `aquarelleLiftErase.ts`); prefer extracting or reusing
  rather than adding a fourth literal.
- The footprint helper must be **side-effect free** — `aquarelleFootprintFor` writes
  the module-level `lastShapedAngle`, so it must not be called from the outline path.
  For `rotation === 'random'`, use the preset angle (declared approximation).

</specifics>

<canonical_refs>
## Canonical References

- `app/src/components/physic-paint/engine/aquarelleFootprint.ts` — the footprint law
  (radius/aspect/angle/rounded) shared by the cursor and the punch.
- `app/src/components/physic-paint/roto/aquarelleLiftErase.ts` — `collectLiftDabs`,
  `liftShapeForStroke`, the pressure sentinel and the dab spacing law.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — listing,
  hit-test, select-mode choke point, the port.
- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — shared geometry,
  `SelectableScriptStroke`, `MIN_STROKE_PAD_PX`, `decimateScriptPoints`.
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` — the outline and
  gesture surface.
- `app/src/components/physic-paint/view/strokeSettingsModel.ts` — `resolveStrokeSettingsOpen`
  and the dialog bundle contract.
- `app/src/components/physic-paint/view/PhysicsPaintStrokeSettingsDialog.tsx` — tabs,
  hydration, empty-state site.
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` — `ScriptRecordingSwitch`
  (the markup to copy) and the Lift cluster.
- `~/.claude/skills/efx-preact-reactivity` (project skill `efx-preact-reactivity`) —
  mandatory reactivity rules.

</canonical_refs>
