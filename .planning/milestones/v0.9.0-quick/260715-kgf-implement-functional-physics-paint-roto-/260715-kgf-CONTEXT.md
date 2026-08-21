# Quick Task 260715-kgf: Implement functional Physics Paint Roto Copy Script and Apply Script workflow as a prerequisite to Phase 36.14 - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Task Boundary

Implement the functional Physics Paint Roto Copy Script / Apply Script workflow as a dedicated prerequisite to Phase 36.14. Preserve the accepted Undo/Redo, cooperative finalization, rapid pointer input, live alpha caching, cached-key repaint, and Phase 36.13 timing contracts as immutable baselines. Stop at native functional UAT; Phase 36.14 retains final UI fidelity, layout, accessibility, status/LOG presentation, selection protection, and integration polish.

</domain>

<decisions>
## Implementation Decisions

### Copy and navigation handoff
- Temporarily block new source input only for the handoff duration.
- Await every already accepted queued or actively finalizing mutation through its normal cooperative `CompletedPaintMutation` path.
- Snapshot the final source script only after that drain completes, then complete Copy Script or navigation.
- Never force a synchronous flush or cancel accepted work.
- Resume input immediately after Copy Script; navigation remains protected through the destination transition.

### Multi-brush Apply progress
- Queue copied brushes in script order through the normal accepted-mutation pipeline.
- Report progress as completed brushes out of total brushes, not merely queued brushes.
- Scope progress to a distinct Apply operation identity and its expected mutation IDs so unrelated native painting, stale completions, or another operation cannot increment it.
- Protect input and navigation for the Apply operation until all copied brushes complete or the operation is explicitly cancelled.
- Report success only after the final expected brush completes. Each brush remains its own normal Undo/Redo transaction.

### True empty destination ownership
- Prepare the accepted Phase 36.13 destination target/spacing transaction before replay.
- Make the true empty destination a durable real key with the first accepted replay brush.
- If zero replay brushes are accepted, do not publish ownership and leave the frame truly empty.
- If a later brush fails after earlier brushes were accepted, retain the accepted partial result as normal independently undoable paint; do not claim full Apply success or publish ownership for unaccepted work.

### Temporary UAT UI
- Add `Copy Script` and `Apply Script` controls after Delete in the existing action row.
- Use current control styling with minimal layout changes.
- Expose native enabled/disabled behavior and reasons.
- Show one concise inline status such as `Copied 4`, `Applying 2/4`, `Applied 4`, or `Failed`.
- Leave detailed LOG presentation and the final visual redesign to Phase 36.14.

### Locked product and architecture constraints
- A script is an immutable deep copy of `EfxPaintEngine.getStrokes()` and is separate from real-key Copy/Paste.
- The clipboard is Studio-session-only and is never serialized, bridged, cached, or reconstructed from pixels.
- Generated and cached-only frames cannot be sources; generated destinations cannot be promoted or mutated.
- Apply is reusable and additive over cached alpha base plus the existing live overlay.
- Preserve every recorded stroke property and continuation relationship; current Motion values transform geometry deterministically using the destination real source frame.
- Add only the smallest engine API that submits an immutable recorded stroke through the existing cooperative mutation pipeline.
- Every replayed brush must update normal action history, publish `CompletedPaintMutation`, remain independently undoable/redoable, and obey existing Redo invalidation and stale-work protection.
- Use a focused Preact-native clipboard/controller or transaction boundary. Keep `PhysicsPaintStudio` as composition and wiring and expose a stable Phase 36.14 integration contract.
- Implement the mounted production path before finalizing regression tests. Automated success means ready for native UAT, not native completion.

### Claude's Discretion
- Exact module, signal, type, operation identity, mutation ID, disabled-reason, status, and error contract names may follow existing project conventions.
- Exact cancellation representation may follow existing navigation/disposal/generation invalidation boundaries, provided accepted work is not synchronously discarded and stale completion cannot publish over newer state.

</decisions>

<specifics>
## Specific Ideas

- Preserve the copied source identity and revision, refresh the bound clipboard after accepted source mutations including Undo and Redo, freeze it on navigation, resume updates on return, and clear it when the bound source becomes empty or Studio is disposed.
- Use operation-scoped expected mutation IDs to distinguish replay completion from native painting and stale completion events.
- Record concise status for the temporary UAT surface while retaining detailed error data for the existing LOG boundary.
- Required native UAT is the A–M scenario set in the invoking task, including repeated application, individual Undo/Redo, Redo invalidation, cached-base additivity, deterministic Motion, generated-frame rejection, source-bound refresh, automatic cache publication, reopen/export visibility, and rapid cooperative activity.

</specifics>

<canonical_refs>
## Canonical References

- The invoking quick-task specification is authoritative for locked product decisions, required focused coverage, verification gates, native UAT A–M, and the completion boundary.
- Existing accepted Phase 36.9–36.13 behavior and exact Undo/Redo implementation are regression baselines, not redesign targets.

</canonical_refs>
