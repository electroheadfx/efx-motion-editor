# Quick Task 260717-m9k: Merge Physics Paint Play into the Roto SCRIPTS workflow and implement multi-frame Play Script - Context

**Gathered:** 2026-07-17
**Status:** Ready for research and planning

<domain>
## Task Boundary

Replace the separate Physics Paint Play workflow with a Play Script generation action inside the durable Roto SCRIPTS workflow. Preserve the current `AnimationPlayer` progressive stroke-distribution behavior by extracting or reusing its shared scheduling/rendering core rather than creating a parallel implementation. Play Script must reload the selected durable preset as an independent immutable snapshot, apply the current visible deterministic held-pose Motion values, stage the requested progressive frame sequence, and atomically publish it as ordinary real Roto keys. Existing Roto interpolation, cache regeneration, preview, cached playback, persistence, reopen, and export must then operate through their normal paths.

The SCRIPTS toolbar keeps three distinct behaviors: row activation is load-only, `paintBrush` reloads and applies the full script once to the current eligible real Roto key, and `play` opens an accessible frame-count confirmation before generating multiple real keys. The dialog accepts a positive integer or `Max`, resolves capacity from the authoritative parent/editor layer boundary, revalidates at confirmation and commit time, and never silently clamps invalid input.

Remove the obsolete separate Play workflow, UI, range markers, conversion controls, launch context, Play-only coordinator/cache/payload/persistence fields, bridge variants, selectors, styles, and tests after identifying every reference and retaining only genuinely reusable engine-level scheduling/rendering utilities. Preserve the existing Roto cached playback transport as a separate action that previews already committed keys.

Implementation must remain Preact-native, use existing Signals/controller and parent-authority boundaries, avoid expanding `PhysicsPaintStudio.tsx` with another large orchestration block, and not run the development server.

Production implementation and architectural removal come first. Run type checking and only minimum production build checks, then stop for native visible UAT. Do not create or modify regression tests until the user explicitly approves native UAT. After approval, add focused regression coverage and run it with `vitest run`, followed by broader gates and final verification.

</domain>

<decisions>
## Implementation Decisions

### Existing real-key collision behavior
- Preserve unrelated paint already present on an existing real key.
- Add the corresponding progressive script output through the established additive Roto composition path.
- Never erase an existing real key as an accidental consequence of old Play cache behavior.

### Canonical destination mapping
- Generate consecutive canonical real-key source positions beginning at the selected canonical Roto start position.
- Let the existing interpolation and display projection system determine visible spacing.
- Do not target projected display slots as editable identities.

### Generated render-only start positions
- Disable Play Script with a clear explanation when the selected start is a generated render-only interpolation frame.
- Require a real canonical key position rather than inventing an implicit owner mutation rule.

### Atomicity and cancellation
- Render and validate the complete sequence off-timeline first.
- Publish one coordinated all-or-nothing real-key batch.
- Cancellation or failure before commit leaves every Roto key unchanged.
- Regenerate interpolation once after the final real-key set is committed.

### Legacy Play data
- Make a clean format break: stop reading and writing obsolete Play workflow records.
- Remove the dual-workflow compatibility architecture rather than retaining adapters or migration code.
- Research must still identify current data-loss consequences and affected fields before removal.

### Completion focus
- After success, select the first newly affected real key.
- Preserve the complete generated sequence and leave cached Roto playback stopped.

### Locked behavioral constraints
- `Max` is the authoritative remaining real-key capacity from the selected canonical start through the current parent-owned layer/timeline boundary.
- Confirmation reloads and validates the selected durable row; stale clipboard content is never authoritative.
- Durable preset JSON and raw per-stroke brush properties remain unchanged.
- Current visible Deform and Move values are destination-time deterministic held-pose overrides only.
- Play Script creates or updates real Roto keys only; generated interpolation frames remain render-only.
- Existing row Load, single-frame `paintBrush` Apply, durable Save/Rename/Delete/Refresh, and cached Roto playback remain distinct and functional.

</decisions>

<specifics>
## Specific Ideas

- Reuse `AnimationPlayer` scheduling behavior and `transformRecordedStrokeForHeldPose` or the current shared equivalent.
- Expose progress phases for preparing, rendering `x / y`, committing, regenerating interpolation, and terminal complete/cancelled/failed states.
- Keep the existing `play` icon immediately after `paintBrush` and provide accurate disabled reasons, tooltip, accessible label, keyboard operation, focus containment/restoration, and compact-panel overflow safety.
- Revalidate selected-script loadability, canonical start ownership, operation locks, destination capacity, and parent revision/operation identity before rendering and before atomic publication.

</specifics>

<canonical_refs>
## Canonical References

- Existing `AnimationPlayer` implementation and tests are the oracle for progressive scheduling behavior.
- Existing durable Roto script library boundary and immutable clipboard are authoritative for preset loading.
- Existing Roto real-key, additive cached-key repaint, interpolation, source/display projection, revision, persistence, preview, playback, and export paths are authoritative for publication semantics.
- Parent/editor layer range state is authoritative for `Max` and commit-time capacity.

</canonical_refs>
