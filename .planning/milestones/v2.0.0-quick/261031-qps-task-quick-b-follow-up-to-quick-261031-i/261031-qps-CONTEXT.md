# Quick Task 261031-qps: Run Script stacking, part B — Context

**Gathered:** 2026-10-31
**Status:** Ready for planning

<domain>
## Task Boundary

Quick B is the deferred half of Run Script stacking (Quick A, quick `261031-i54`, CLOSED at `f7b0767b7`). Quick A shipped Paint-rail stacking, collision handling, extend-only growth, Keep script for flag-on rails, pixel-only composite, rail-settings adoption and the reusable dialog cards. Quick B completes the deferred scope:

1. **Pixel-only Paint rail "Keep script" ON**, with the durable-base authority seam.
2. **Frame-override bases** (Quick A refused a frame override inside the written span).
3. **Reveal rail stacking** with per-key script recording and photo-reference tail baking.

Do not re-implement Quick A. The full Quick A laws are locked in
`.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-CONTEXT.md`
("Deferred to Quick B" and "Quick B law (do not implement in Quick A)").

</domain>

<decisions>
## Implementation Decisions

### Durable-base authority (user decision: every script path)
- The new `app/src/components/physic-paint/roto/aquarelleScriptBaseAuthority.ts` governs **every** script-target path: creation Apply, raster-key edits, Run Script stacking, source occurrences, frame overrides, reopened rails, flag-on and flag-off rails.
- `prepareRotoScriptTarget` in `PhysicsPaintStudio.tsx` is rewritten to consume the authority; the current `durableBaseKeyId` payload-only path is removed.
- Resolution order, fail-closed:
  1. Persisted SNAP v5 durable base of the **resolution key** (`null` = known-empty).
  2. Session durable-base map.
  3. Resolution key has no recorded aquarelle events → its current payload IS the pre-script cache; pin it.
  4. Otherwise fail closed with `durable-base-unknown`, zero writes.
- Source occurrences and frame overrides resolve to the **source key**, never the occurrence/override composite.
- Never use a payload as a base when that key has recorded events.
- Freshly pinned bases persist; recovered bases stay session-only.

### Pixel-only Keep switch (user decisions)
- On a pixel-only (`keyScriptEdits !== true`) Paint rail the Keep script switch becomes available and defaults **ON**.
- **ON:** append this run's strokes to the touched keys' recorded scripts; the rail's existing picture is pinned as the durable base; re-bake composites base + recorded events. The rail's persisted `keyScriptEdits` flag is never implicitly flipped.
- **OFF:** flatten — composite the run over the key's current picture and record nothing (the Quick A behavior the UAT accepted). Non-destructive; no purge, no replace.
- The flag-on Keep OFF path (purge then replace) is unchanged from Quick A.

### Frame-override bases
- A frame override inside the written span is now supported.
- The override key's base authority is the **source key's** authority; the override composite is never used as a base.
- If the source key's base cannot be proven, fail closed with zero writes.

### Reveal rail stacking (user decisions)
- Reveal rails stack like Paint rails: playhead membership, extend-only growth, repeat unchanged and virtual, collision Cancel/Truncate(default)/Overwrite, one atomic undo.
- Keep script records the new strokes on Reveal rails (this intentionally changes today's "Reveal keys are script-incapable" contract).
- A Reveal stack run exposes **Colorize**, **Photo wiggle** and **Paint seed** as editable cards; the rail adopts the run's values in the same commit. Rail Type is hidden for Reveal destinations — the placed photo reference defines the kind.
- The placed photo reference stays the rail's own; extension bakes the new tail through it (same photo, new wash).
- No photo reference placed → refuse with a clear reason, zero writes.
- Plain-paper keys must never be mixed into a Reveal rail.

### Carried Quick A laws (re-affirm; do not revisit)
- Playhead membership only selects the destination; outside every rail = unchanged create path.
- `runStart = phaseOrigin + cycleOffset`; extend-only; repeat unchanged; infinity lifecycle-less.
- Truncate caps growth but never shrinks an existing lifecycle.
- Overwrite removes the victim Loop Clip; its keys survive as ordinary keys; one undo restores it.
- The open stack surface is pinned; confirm revalidates the live rail.
- The dialog is a shell over `PhysicsPaintPlayScriptCards.tsx`; a new variant is a new composition of the same cards.

### Claude's Discretion
- Internal module/API shape of `aquarelleScriptBaseAuthority.ts`.
- Exact refusal copy and the Reveal card copy/ordering.
- How the Reveal tail bake is composed (single bake vs per-key compositing) as long as it uses the placed photo reference and the same photo.
- Whether `prepareRotoScriptTarget` keeps its signature or becomes a thin adapter.
- Test harness details.

</decisions>

<specifics>
## Specific Ideas

- Quick A's artifacts are the authoritative law: `261031-i54-CONTEXT.md`, `261031-i54-PLAN.md` (UAT round 1 amendments), `261031-i54-SUMMARY.md` (Next Phase Readiness), `261031-i54-VERIFICATION.md`.
- Existing seams to read before planning: `prepareRotoScriptTarget`, `recordRailKeyScripts`, `sliceRailKeyScripts`, `aquarelleBaseRecovery.ts`, `composeRotoScriptRebakeFrame`, `bakeAquarelleScript`, `bakeAquarelleEventsToFrame`, `requirePhysicPaintRotoInlineBytes`, `getRotoRealKeyRecord`, `commitRevealBake`, `buildNewLoopLifecycle`, `derivePhysicPaintRotoLoopRanges`.
- The raster-key edit UAT row: stack on an unscripted raster key, then edit the new strokes; the original raster must remain under them after re-bake, save/reopen and repeat; reopen + repeat must not double; unprovable base → refusal, no erase.
- Existing tests pin today's laws; change them only where Quick B intentionally changes the law (Reveal script-incapability, pixel-only Keep OFF+disabled).

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-CONTEXT.md`
- `.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-PLAN.md`
- `.planning/quick/261031-i54-run-script-stack-a-script-onto-an-existi/261031-i54-SUMMARY.md`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts`
- `app/src/components/physic-paint/roto/physicsPaintRotoRunScriptStacking.ts`
- `app/src/components/physic-paint/roto/aquarelleBaseRecovery.ts`
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptCards.tsx`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx`
- `app/src/stores/physicPaintStore.ts`
- `app/src/stores/efxPaintStore.ts`
- Project skills: `efx-preact-reactivity`, `developing-preact`

</canonical_refs>
