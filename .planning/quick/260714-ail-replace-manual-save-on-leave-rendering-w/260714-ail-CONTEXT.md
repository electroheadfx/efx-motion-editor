# Quick Task 260714-ail: Replace manual/save-on-leave rendering with direct live pixel caching in Physics Paint Roto - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Task Boundary

Replace the Roto-only manual Save current/save-on-leave persistence model with automatic pixel-first caching after completed live paint mutations. Reuse the already-rendered alpha-only paint result, preserve existing cached-base additive repaint and per-brush Undo, keep navigation non-blocking, remove obsolete Roto save machinery, and leave Play canvas persistence unchanged.

Mandatory coverage and regression constraints are defined in the invoking task specification. Stop after automated verification and present the exact native UAT checklist; do not run the application server.

</domain>

<decisions>
## Implementation Decisions

### Capture ownership and cached-base composition
- The existing extracted Roto controller transaction owns when and where an automatic cache update commits.
- Capture must reuse the live engine's already-rendered alpha-only pixels at an existing completed-mutation boundary.
- Preserve the existing additive cached-base repaint path for an existing flattened real key: `flattened cached base + current live overlay = updated flattened real-key cache`.
- Never replace an existing cached base with the live overlay alone.
- Raster composition through the established additive repaint helper/path is allowed and is not a second paint render, stroke replay, or physics simulation.
- Opening a cached key still displays its flattened base; new brushes remain a live overlay; Undo affects only new live brushes; undoing all new brushes returns exactly to the original base.
- Paper/background pixels remain outside the paint cache.

### Asynchronous ordering
- Use a monotonic revision per durable source frame.
- Fix source-frame identity and revision when the mutation transaction begins.
- A capture may commit only if its revision is still latest for that source frame when encoding/compositing finishes.
- Different source frames commit independently; do not introduce a global queue.
- Older frame-A results cannot overwrite newer frame-A results or write into frame B after navigation.
- Additive captures bind the correct flattened base and live overlay to their revision.
- Clear, Undo-to-empty, key removal, and deletion increment the frame revision; removal wins over older pending non-empty captures.
- Derived interpolation regeneration starts only from the latest accepted real-key commit.
- Store/project invalidation occurs only for accepted commits, not discarded stale results.
- Do not use timers, polling, or require cancellation.

### Editable Roto JSON
- Keep editable engine/session state only in memory while Physics Paint is open, and only as required for existing live painting and per-brush Undo.
- Do not serialize editable Roto engine JSON into durable project output.
- Do not send or retain editable JSON for the removed Save current/save-on-leave workflow.
- Do not reconstruct old strokes or Undo history after close/reopen.
- Do not retain editable JSON as an optional second durable source of truth.
- Reopening a cached real key loads its flattened pixels as a non-editable base and starts a fresh live editable overlay.
- Do not remove or weaken the in-memory state required by existing per-brush Undo.
- Do not apply this persistence change to Play canvas.

### Accepted contracts that remain closed
- The approved Clear transaction remains intact except for connecting it to the new pixel-first commit boundary; Clear and Delete remain distinct.
- Preserve absolute real-key positions, generated-frame render-only behavior, custom spacing, interpolation settings, real-key-only onion anchors, missing-frame backgrounds, and canonical preview/export projection.
- No backward-compatibility or legacy Roto persistence shims.

### Claude's Discretion
- Select the narrowest existing engine surface-copy API and controller/edit-buffer integration point after tracing the current implementation.
- Coalesce redundant captures only where it preserves the locked per-frame revision semantics.
- Delete obsolete Roto-only save code rather than retaining competing paths.

</decisions>

<specifics>
## Specific Ideas

- Required flow: completed live mutation -> capture existing rendered alpha pixels -> additive cached-base composition when applicable -> per-frame revision acceptance -> real-key cache update -> derived invalidation/regeneration.
- Mandatory RED tests must cover the mounted/native path, existing Undo integration, async source identity/latest-wins behavior, durable flattened persistence, derived consumers, obsolete UI removal, and Play persistence isolation.
- Use `vitest run`; never use watch mode.

</specifics>

<canonical_refs>
## Canonical References

- Invoking `/gsd-quick --discuss --research` task specification is the authoritative product contract and test/UAT checklist.
- Quick task `260714-9es` is the accepted Clear behavior baseline and must not be reopened.

</canonical_refs>
