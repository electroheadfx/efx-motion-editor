# Phase 43: Hold Loop Clips + Filmstrip Capsule - Context

**Gathered:** 2026-08-07
**Status:** Ready for correction planning

<domain>
## Phase Boundary

Phase 43 keeps its deterministic static/hold and linked Loop Clip behavior, but its user-facing ownership is corrected after native UAT failed at Step 1. Loop Clips are created, visualized, selected, edited, repaired, relinked, duplicated, unlinked, and deleted inside the EFX Paint/Roto module where physical frames are edited.

The Motion Editor main timeline must not render a Loop Clip capsule, expose Loop Clip hit targets or tooltips, or initiate Loop Clip operations. The main editor remains a consumer of the canonical physical-frame document for preview, playback, save/reopen, and export parity; it does not own the Loop Clip authoring surface.

The correction is a bounded surface relocation, not a rewrite of the Loop Clip model. HOLD-01..05 behavior, persistence, resolver algebra, atomic history, guards, unresolved-source policy, preview/export parity, and source-cycle sharing remain in scope and remain authoritative. HOLD-06's filmstrip capsule moves to a dedicated EFX Paint/Roto lane.

Requirements: HOLD-01..06 in `.planning/REQUIREMENTS.md`. The 2026-08-07 correction decisions in this file supersede earlier Phase 43 references that placed S1 on `TimelineRenderer` or the Motion Editor `PPaint #1` row. `.planning` remains the sole planning authority for Phase 43; SPECS is not active unless the user explicitly re-enables it.

</domain>

<decisions>
## Implementation Decisions

### Surface ownership correction

- **D-33:** Remove the Loop Clip capsule and every Loop Clip interaction from the Motion Editor main timeline. It does not remain as a read-only summary or navigation shortcut. — **Reversibility:** costly — reversing this would reintroduce a second product surface, duplicate interaction ownership, and restore the parent-to-child request protocol removed by the correction.
- **D-34:** Add a dedicated frame-aligned Loop Clip lane immediately above the existing EFX Paint/Roto physical-frame cells. The lane is a separate range-object surface so Loop Clip selection never competes with real-key selection, frame navigation, multi-select, or drag behavior.
- **D-35:** The Loop Clip lane is hidden when there are no Loop Clips. Projects without loops retain the existing EFX Paint/Roto geometry exactly; the lane appears only when needed.
- **D-36:** The EFX Paint lane renders the full filmstrip capsule contract: source-cycle thumbnails, zoom-adaptive linked repetitions, compact finite/infinity badge, requested/effective truncation, amber truncation diagonal, unresolved/error state, and zero-effective anchor flag. The visual semantics move hosts; they are not reduced to a list or minimal range block.
- **D-37:** Clicking the capsule body selects the Loop Clip and opens a local EFX Paint popover for occurrence details and `Edit source frame`, `Duplicate linked loop`, `Unlink loop`, `Delete loop`, `Repair loop…`, and `Relink loop…` as applicable. Clicking the compact badge opens the existing Play Script dialog in Loop Edit mode. No main-editor bridge round-trip is used to open or operate the loop.
- **D-38:** Existing Roto frame cells keep their current click-to-navigate, real-key selection, multi-select, and drag contracts. Linked occurrences may retain the already-implemented additive link badge/border, but they do not become the Loop Clip selection surface; the dedicated lane owns range selection and actions.
- **D-39:** Loop operations execute through the existing EFX Paint controller, physical-edit coordinator, authority request, atomic commit, and Undo/Redo paths. The generic parent/child launch, authority, apply-result, save, and project-context bridges remain. Only the main-timeline-specific open-loop-edit and loop-operation request/result protocol is removed once no callers remain.
- **D-40:** Preserve the lazy performance invariant: compact interval records, visible-window derivation, O(1) modulo frame resolution, no per-repetition rasters, and no materialized Infinity frame list. The earlier main-timeline-specific “zero per-capsule DOM nodes” clause is not a product requirement for the EFX Paint lane; the planner may choose the existing Preact/DOM strip pattern or a local canvas layer, provided the invariant and current strip performance are preserved.

### Carried-forward Loop Clip behavior

- **D-01..D-14 remain locked:** Loop Edit and Source Edit modes, Link/Create, unlink-only deletion, source-cycle sharing, rigid linked source keys, shrink/re-expansion, materialize-on-paint/Clear, Delete-key rejection, loop-loop priority, and atomic Undo/Redo semantics remain unchanged.
- **D-15..D-23 remain locked with a new host:** thumbnail, zoom-band, occurrence, badge, truncation, zero-effective, focus/selection, stale/error, and English-copy semantics apply to the dedicated EFX Paint lane rather than the Motion Editor timeline.
- **D-24..D-31 remain locked:** boundary algebra, dynamic parent end, canonical resolver, preview/export parity, additive persistence, derived Effective duration, and verbatim unresolved references remain unchanged.
- **D-32 is narrowed by D-40:** virtual resolution and no repeated durable/cache assets remain locked; the rendering primitive is now an EFX Paint implementation decision.

### Claude's Discretion

- Exact height and responsive fit of the hidden-when-empty lane within the existing EFX Paint timeline shell.
- Whether the host-neutral capsule derivation is relocated from `components/timeline` or replaced by an equivalent EFX Paint presentation model.
- Exact local popover component reuse, provided it remains inside EFX Paint and exposes the locked actions and copy.
- Whether the additive linked-cell badge remains visible when the full lane is present; it must not redefine existing cell palette or geometry.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements and failure evidence
- `.planning/REQUIREMENTS.md` — HOLD-01..06; HOLD-06's capsule semantics remain, but this correction context owns the host decision.
- `.planning/ROADMAP.md` §“Phase 43” — existing goal and success criteria; planning must correct any main-timeline host interpretation without reopening linked-loop behavior.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-UAT.md` — Step 1 failed because the capsule shipped on `PPaint #1` instead of EFX Paint/Roto; verification is stopped until replacement plans land.
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-UI-SPEC.md` — prior UI contract to revise: S1 host and all main-timeline interaction sections are invalid; S2-S6 semantics are reusable where they already live in EFX Paint or shared guard/export surfaces.

### Prior locked decisions
- `.planning/phases/42-playscript-application-modes-color-override/42-CONTEXT.md` — approved Play Script dialog shell, cycle-only generation, requested/effective conventions, and static/hold behavior reused by Loop Edit and Source Edit.

### Correct authority seams
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — persisted Loop Clip record and physical-frame document authority.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — range derivation, lazy frame resolution, boundary algebra, and physical-edit validation.
- `app/src/stores/physicPaintStore.ts` — structural resolution, render-source parity, unresolved-loop query, and source-scoped cache identity.
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — local Loop Edit, Source Edit, Repair, Relink, Duplicate, Unlink, Link/Create, and atomic operation entry points.
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — existing EFX Paint modal host for loop/source editing.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — target host; already receives `rotoLoopResolutionContext` and preserves physical-cell interactions.
- `app/src/components/physic-paint/physicsPaintStudio.css` — existing physical-strip geometry and additive linked-loop badge styles.
- `app/src/lib/previewRenderer.ts` and `app/src/lib/exportEngine.ts` — placeholder preview and fail-fast export policy, retained unchanged except for correction regressions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Retain unchanged
- Physical model, persistence allowlists, revision fingerprinting, history snapshots, and additive v0.8.1 loading are already on the correct document authority.
- `derivePhysicPaintRotoLoopRanges`, `resolvePhysicPaintRotoLoopFrame`, store render-source resolution, guards, re-expansion, unresolved queries, preview placeholders, and export preflight/parity are surface-independent and remain valid.
- `physicsPaintRotoPlayScriptController.ts`, `PhysicsPaintPlayScriptDialog.tsx`, physical-edit coordination, and Undo/Redo history already implement the intended EFX Paint authoring operations.
- HOLD-01..04 static/hold determinism and one-raster composition tests are unrelated to the surface failure and remain valid.

### Adapt to EFX Paint
- `PhysicsPaintWorkflowStrip.tsx` is the correct insertion point. Its props already include `rotoLoopResolutionContext`, and visible cells already derive linked occurrences without making them selectable or draggable as real keys.
- `physicsPaintStudio.css` already contains the additive `roto-linked-loop-badge` treatment; the correction adds the separate hidden-when-empty range lane without changing the existing cell palette.
- `loopCapsuleGeometry.ts` contains pure badge, zoom, ghost-cell, truncation, and anchor derivations. Those algorithms may be retained after moving them out of the main-timeline namespace or wrapped by an EFX Paint-specific lane model.
- `buildTimelineLoopCapsules` contains useful compact projection ideas, but its `frameMap`/sequence host and `TimelineLoopCapsule` type are main-editor-specific and must not remain the data path.

### Remove from the Motion Editor surface
- `app/src/lib/frameMap.ts`: `loopCapsules` feed and `deriveMainEditorLoopRanges`/`buildTimelineLoopCapsules` main-editor projection.
- `app/src/types/timeline.ts`: Loop Clip capsule fields and types used only by the main timeline.
- `app/src/components/timeline/TimelineRenderer.ts`: `drawLoopCapsules` and its invocation.
- `app/src/components/timeline/TimelineInteraction.ts`: capsule hit testing, selection, tooltip requests, keyboard routing, open/edit/delete handling.
- `app/src/components/timeline/TimelineCapsuleTooltip.tsx` and its `TimelineCanvas.tsx` mount.
- Main-timeline capsule geometry/renderer/interaction/tooltip tests, replaced by EFX Paint lane and local interaction coverage.
- `openPhysicPaintLoopEdit`, `requestPhysicPaintLoopOperation`, loop-operation/open-edit transport events, strict envelope types, and child request handlers when their only main-timeline callers are removed. Generic EFX Paint authority/apply bridges must remain.

### Integration points
- `PhysicsPaintStudio.tsx` should expose the controller operations and loop resolution context to one focused lane component/hook rather than expanding the Studio god component.
- The new lane shares the existing horizontal frame grid, scroll window, zoom, and playhead alignment of `PhysicsPaintWorkflowStrip`.
- Local popover actions call controller operations directly; resulting accepted physical edits continue through the existing parent-authority and commit acknowledgement path.

</code_context>

<specifics>
## Specific Ideas

- Remove the main-timeline capsule completely; do not retain a secondary summary or navigation shortcut.
- In EFX Paint, render a dedicated Loop Clips lane above the Roto cells, hidden when empty.
- Render the full filmstrip capsule in that lane.
- Capsule body click selects and opens a local popover; badge click opens Loop Edit.
- Preserve ordinary Roto-cell navigation and key-selection behavior below the lane.
- Treat the failed Step 1 as a scope/orchestration failure, not a request to patch isolated visual defects.

</specifics>

<deferred>
## Deferred Ideas

None — the correction stays within Phase 43 and removes the unintended second surface.

</deferred>

---

*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Context gathered: 2026-08-07*
