# Quick Task 261024-p5q: Studio stroke settings modal - Context

**Gathered:** 2026-10-24
**Status:** Ready for planning

<domain>
## Task Boundary

Add a selection-gated, movable dialog for the selected Studio stroke(s) in Brush Move and Water color Select.

SCOPE
- Intrinsic settings from the right-sidebar Paint tab:
  - Brush: size, opacity, shape detail, blending, smoothing, erase strength (eraser strokes only). Skip Spread (physics-mode engine global, not per-stroke).
  - Water color: size, pigment/opacity, water, flow, bleed, edges, grain, dry speed.
- Color: reuse the right-sidebar Color tab's picker/palette (one shared color control, no second picker). Color is a per-stroke field in both engines.
- Geometry: position (center X/Y), uniform scale, scale X, scale Y, rotation as numeric controls.

BEHAVIOR
- Modal opens only while stroke selection is non-empty; closes when selection empties; Escape closes.
- Hydrate controls from the selected stroke(s). Single selection: absolute values. Multi-selection: mixed values shown as mixed; a touched control applies its value to all selected strokes; untouched controls never write.
- Modal is the only editing surface — never mirror into or restore from the sidebar/top view.
- Scale/rotation are session-relative (open = 100% / 0°); position is the selection center. No persistent transform record.
- Intrinsic and color edits: one undo checkpoint per commit. Brush = one batch write + flush; water color = one snapshot edit + one re-bake with rollback on refusal (reuse existing paths).
- Geometry reuses the existing transform commit: brush Move law (redo cleared, no new checkpoint); water color one edit + one re-bake.

GUARDRAILS
- Preact signals only; no useState; selection writes in pointer handlers, never effects; no render-body signal writes.
- No changes to the legacy inline editor.
- No new dependency, schema, or persistence change.
- English artifacts; pnpm only; vitest run only; do not start the dev server.
- Non-goals: persistent absolute scale/rotation, sidebar/top-view mirroring, marquee selection.

</domain>

<decisions>
## Implementation Decisions

### Per-engine field list and control types
- Brush (Brush module, Move tool):
  - Size: slider/stepper, min 1, max 80, step 1 (matches the top-bar Brush size).
  - Opacity: slider/stepper, min 10, max 100, step 1.
  - Shape detail: slider/stepper, 0-100 (`params.edgeDetail`).
  - Blending: slider/stepper, 0-100 (`params.pickup`).
  - Smoothing: segmented control Off / Soft / Med / High = `params.antiAlias` 0/1/2/3.
  - Erase strength is OMITTED: eraser gestures are never recorded as strokes (the eraser removes strokes or punches pixels), so there is no selectable eraser-stroke target.
  - Spread is omitted (physics-mode engine global, not per-stroke).
- Water color (Water color module, Select mode):
  - Size: 1-80 (canonical params are size 1-80 px, the other seven 0-100; see `packages/efx-watercolor/src/playground/params.ts`).
  - Pigment: 0-100 (`load`). This is the "opacity" — the top-bar Opacity control routes to `load` in Water color.
  - Water, Flow, Bleed, Edges, Grain (`granulation`), Dry speed (`dry`): 0-100 sliders.
  - No separate opacity param exists in the watercolor engine.
- Color (both engines): reuse `RightPanelColorTab` — the one shared HSV + hex + palette control. No second picker. Per-stroke `color` field edits.
- Geometry (both engines): numeric controls for center X / center Y (canvas px), uniform scale %, Scale X %, Scale Y %, rotation degrees.

### Mixed-value display and apply rule
- A field whose value differs across the selection shows "Mixed" in the value box and a neutral track.
- The first gesture on that control (drag, +/- step, typed entry, swatch, picker commit) writes that one value to every selected stroke.
- Untouched controls never write.
- Mixed color: show the first-selected stroke's color plus a "Mixed" badge; the first color commit writes to all selected strokes.

### Commit granularity and undo entry
- Commit on release, not per tick. `SliderStepper` uses `commitOnRelease`; the shared color picker keeps its own cursors live but the stroke write happens on pointer release (swatch click is one immediate commit; typed hex commits on Enter/blur).
- Brush intrinsic/color edits: ONE engine batch edit + ONE flush per commit; redo cleared, NO new undo checkpoint (the existing Move law). One gesture = one edit.
- Water color intrinsic/color edits: ONE snapshot edit + ONE re-bake with rollback on refusal, recorded as ONE `aquarelle-script` ledger entry (reuse the existing begin/edit/restore path).
- Geometry reuses the existing transform commit: Brush Move law (redo cleared, no new checkpoint); Water color one edit + one re-bake.
- Undo granularity therefore matches the existing script-edit laws: watercolor gets one ledger entry per commit; brush commits clear redo without adding an entry.

### Geometry session semantics
- X/Y show the live selection centre in canvas px and move by the typed delta.
- Uniform scale, Scale X, Scale Y start at 100%; Rotation starts at 0°.
- Each commit applies the delta from the last applied value (100→120 then 120→90 compounds to 0.9x); the fields keep cumulative session values until the dialog closes.
- Any selection-membership change re-baselines scale/rotation to 100% / 0° and re-reads X/Y.
- No persistent transform record; closing/reopening resets the geometry session baseline.

### Dialog placement, size, and canvas interaction
- Floating dialog, about 320 px wide, default seat at the canvas region's top-right, movable by header drag (Play Script / Photo Reference dialog pattern).
- No backdrop. A single scrolling panel with sections: per-engine Paint settings, Color, Geometry.
- Canvas selection and transform handles remain interactive behind the dialog. Clicking outside never closes it.
- Visible only while the stroke selection is non-empty AND the module's edition surface is active (Brush: Move tool; Water color: Select mode).
- Closes/hides when the selection empties. Escape hides the dialog without clearing the selection; the next empty-to-non-empty selection transition while the surface is active reopens it.
- The modal is the only editing surface: edits never mirror into or restore from the sidebar/top view.

### Claude's Discretion
- Exact component/module names, file placement, section order, styling details, and test names.
- Internal dialog draft/mixed-detection signal shapes; no render-body signal writes.
- Whether the read/write surface is added to the shared `ScriptStrokeEditionPort` or to a new adapter module.
- Dialog drag offset is session-only, reset on each open (no persistence change).
- Numeric precision details (integer px / % / degrees, free entry) that do not change the locked behaviour.

</decisions>

<specifics>
## Specific Ideas

- The existing shared selection seam is `scriptStrokeEdition.ts`; the overlay is `ScriptStrokeOverlay.tsx`; transform geometry is `scriptStrokeTransform.ts`.
- Brush engine commit laws: `EfxPaintEngine.moveStrokes` / `transformStrokes` (drain queued finalizations, clear redo, no checkpoint, one notification). Replay uses each stroke's own `params` and `color`, so per-stroke intrinsic and color edits are meaningful.
- Brush edition adapter: `brushScriptEditionPort.ts` (engine-backed port, locks, one flush per edit).
- Watercolor selection/edits: `aquarelleStrokeSelection.ts` (`beginAquarelleMoveEdit`, `beginAquarelleTransformEdit`, snapshots, in-flight guard) and `aquarelleRecordState.ts` (object-replacement law, same timeline index).
- Watercolor re-bake: Studio handlers reset the sheet and re-apply `getAquarelleEventsForFrame(playFrame)`; a failed apply restores the snapshot and surfaces an error.
- Existing pin/lock gates: `isPhysicalMutationLocked`, `rotoScript.applying`, `rotoScript.mutationLocked`, `rotoTimelineModel.currentCell.kind === 'real'`, `isAquarelleScriptEditInFlight`.
- Dialog precedent: `PhysicsPaintPlayScriptDialog.tsx` and `PhysicsPaintPhotoReferenceDialog.tsx` (fixed/centred surface + translate() header drag, no backdrop, focus restore).
- The shared color control is `RightPanelColorTab.tsx`; it owns its own picker/palette interactions and emits live `onColorChange` — the modal must wrap that as a draft and commit on release without changing the legacy inline editor.

</specifics>

<canonical_refs>
## Canonical References

- `app/src/components/physic-paint/view/scriptStrokeEdition.ts` — shared selection/drag/transform signals and edition port.
- `app/src/components/physic-paint/view/scriptStrokeTransform.ts` — transform geometry law and handle hit-testing.
- `app/src/components/physic-paint/engine/ScriptStrokeOverlay.tsx` — shared selection overlay and gesture surface.
- `app/src/components/physic-paint/view/brushScriptEditionPort.ts` — brush engine-backed edition adapter.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — watercolor selection, edit snapshots, move/transform commits.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — watercolor recorded-stroke registry and script mutation law.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — watercolor delete/move/transform handlers, re-bake, ledger recording.
- `app/src/components/physic-paint/view/RightPanelColorTab.tsx` — the one shared color picker/palette.
- `app/src/components/physic-paint/view/BrushModuleSection.tsx` — Brush Paint-tab fields and ranges.
- `app/src/components/physic-paint/view/AquarelleGlobalsPanel.tsx` — Water color Paint-tab fields.
- `app/src/components/physic-paint/view/PhysicsPaintTopBar.tsx` — shared Size/Opacity routing.
- `packages/efx-physic-paint/src/types.ts` — `BrushOpts` fields.
- `packages/efx-physic-paint/src/engine/EfxPaintEngine.ts` — move/transform commit laws and replay.
- `packages/efx-watercolor/src/playground/params.ts` — canonical param units and engine mapping.
- `packages/efx-watercolor/src/adapter/engineAdapter.ts` — per-stroke replay configuration.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — movable-dialog precedent.
- `app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.tsx` — movable-dialog precedent.

</canonical_refs>
