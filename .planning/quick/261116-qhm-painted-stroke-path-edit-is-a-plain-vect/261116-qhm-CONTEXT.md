# Quick Task 261116-qhm: Painted-stroke path edit is a plain vector session from entry - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Task Boundary

Entering path edit on an anchorless painted stroke becomes exactly a vector edit
session from entry: fit the stroke's own recorded samples, commit the conversion
through the existing ONE writer at entry, then open the shipped path-edit latch
only when that write resolved. The now-dead painted-curve machinery — the held
fit, the original-spine ghost, the entry wireframe/Draft bracket and the
path-edit exit hook — is deleted with its pins.

The amended laws below supersede the Phase 62 record for THIS entry only.
Historical phase artifacts (including
`.planning/milestones/v2.1.0-phases/62-painted-stroke-curve-editing/62-CONTEXT.md`)
are NOT edited.

</domain>

<decisions>
## Implementation Decisions

1. **D-03 is REVERSED: the conversion now commits ON ENTRY.** `enterPaintedCurve`
   fits the stroke's own samples and hands them to the shipped ONE writer
   (`commitAquarelleVectorPathEdit`) before the latch opens. Entering and leaving
   path edit with no gesture therefore still leaves ONE undoable conversion —
   one `aquarelle-script` ledger entry, one undo step.
2. **D-06's automatic wireframe on entry is REMOVED.** Entering a painted
   stroke's path edit no longer turns wireframe or Draft on; no ghost of the
   original spine is drawn, and the stroke's anchors come from the record.
3. **D-14 now scopes to the MANUAL wireframe latch only.** A session entered
   while the user's own wireframe or Draft is ON keeps today's deferred
   behaviour: every gesture records the script edit and marks the pixels dirty,
   and no bake runs. Closing a path edit no longer settles anything.
4. **Fail-closed entry:** path edit opens ONLY when the conversion resolves an
   edit id. A null resolution publishes the existing refusal copy and opens
   nothing; Lift and degenerate strokes keep their shipped copy, malformed
   anchors still fail closed, and a refused durable-base arm still publishes
   `DRAFT_ARM_REFUSAL_MESSAGE`.
5. **Kept:** `fitVectorPathAnchors` (`view/vectorPathFit.ts`), the
   eligibility/refusal law (`resolvePaintedCurveEligibility` /
   `admitsPathEditWrite`), the manual deferred route, the settle single-flight
   (`settleDraftScript`), the Draft leave-guard, capture/save/export and
   undo/redo of a path edit.

</decisions>

<specifics>
## Specific Ideas

- The shipped writer `commitAquarelleVectorPathEdit` already owns the entire
  conversion: it detects the anchorless stroke, mints
  `DEFAULT_VECTOR_PATH_CURVE_MODE`, writes through `beginAquarellePathEdit`,
  bakes once, records exactly ONE `aquarelle-script` ledger entry on success,
  publishes its own failure copy and rolls back on failure. The entry therefore
  only fits the stroke's own samples, hands them to that writer, and refuses to
  open the latch when it returns null.
- The entry reaches the writer through the existing
  `aquarellePathEditCommitRef` — the Studio's shipped TDZ convention (the entry
  is declared before the shared commit). Do NOT reorder callbacks: every
  shipped region slice in `PhysicsPaintStudio.test.ts` keeps its exact
  boundaries.
- The entry still arms the durable base FIRST (`await armDraftBase()`),
  preserving the shipped pre-edit base contract and its fixed refusal copy. It
  re-reads the recorded stroke after that await and re-requires the `painted`
  verdict (the WR-03 precedent): a concurrent entry or another edit that
  converted the stroke ends this entry silently, with no refusal copy.

</specifics>

<canonical_refs>
## Canonical References

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — the ONE painted
  entrance, the ONE path-edit writer and the (removed) exit-hook registration.
- `app/src/components/physic-paint/view/vectorPathCurveBracket.ts` — deleted by
  this quick (held fit, wireframe bracket, exit half).
- `app/src/components/physic-paint/view/vectorPathLatches.ts` — the path-edit
  latch; the exit hook is deleted from this leaf.
- `app/src/components/physic-paint/engine/VectorPathOverlay.tsx` — edit-target
  resolution; after this quick the record is the ONLY anchor source.
- `app/src/components/physic-paint/view/vectorPathFit.ts` — KEPT
  (`fitVectorPathAnchors`).
- `.planning/milestones/v2.1.0-phases/62-painted-stroke-curve-editing/62-CONTEXT.md`
  — historical, superseded here for this entry, NOT edited.

</canonical_refs>
