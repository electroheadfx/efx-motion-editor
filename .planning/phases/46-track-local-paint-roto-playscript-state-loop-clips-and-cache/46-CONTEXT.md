# Phase 46: Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Move every piece of editable and generated EFX Physic Paint state out of parent-layer/frame addressing and into `parentLayerId → trackId → frame` addressing inside the v1.0 document built in Phase 45. Delivers track-local Paint frames, Roto real keys, generated interpolation/caches, Script Motion, PlayScript progressive/static output + linked Hold Loop Clips, per-track revision + dirty state + cache invalidation, track-aware copy/cut/paste/duplicate/clear/undo/redo, async parent+document+track revalidation authority, and fail-closed track deletion. This is the DATA/STATE layer only — the multi-row timeline UI, filmstrip capsules, and track CRUD controls arrive in Phase 47. The drag *gesture* is Phase 47; Phase 46 provides the store-level data operation it calls.

**Naming contract (locked by user, carried from Phase 45):** "EFX Paint" = the inline main-editor Basic/FX layer (out of scope, unchanged). "EFX Physic Paint" = the independent module + Studio window — the sole target of v1.0.0 and this phase.

</domain>

<decisions>
## Implementation Decisions

### Track-aware Undo/Redo (TRK-04)
- **D-01:** Undo/redo is a **unified document-wide stack**; each entry is tagged with the `trackId` it mutated. Undo always targets the exact track that produced the edit and never touches another track's history (meets acceptance "Undo/redo targets the exact internal track"). — **Reversibility:** costly — splitting to per-track stacks later would need the history model re-keyed and cross-track action routing redesigned.
- **D-02:** Undo depth keeps the **10-level operation-count cap** (the accepted Roto Undo model). Paint and PlayScript edits also feed the same capped stack.
- **D-03:** Undo entries store **references + the prior deterministic revision hash** (revision builders already built in Phase 45), NOT raster bytes (Pitfall 17). Cached frames are recomputed from real keys on restore. — **Reversibility:** one-way — switching to snapshot-based undo later would change memory and cache-divergence guarantees the recompute design provides.
- **D-04:** Undoing an entry that targets a **non-active track auto-activates the target track**, so the user sees the affected track.

### Cross-track copy/paste semantics (TRK-04)
- **D-05:** Pasted items always get **fresh identities** (the v0.9 rail-set rule) — paste is a deep, self-contained copy that never links back to the source track.
- **D-06:** A Hold Loop Clip pasted across tracks is **re-pointed to the destination track's own copied source frames** (fresh identity, never a cross-track reference). If re-pointing is impossible (e.g. partial selection where the source frames are not part of the paste), the paste is **rejected explicitly** — never a dangling or foreign-track reference.
- **D-07:** Cross-track paste **deep-copies the underlying source frame assets**, so the destination track is fully self-contained (editable/reordered/deleted with zero effect on the source, TRK-06/07). The "no durable asset duplication" contract applies ONLY to linked repeats INSIDE one Loop Clip; a paste is new independent content, so duplication is expected.

### Cross-track drag (data op)
- **D-08:** Phase 46 implements the **store-level cross-track move operation** (re-tag `trackId`, preserve frame timing); the **drag gesture arrives in Phase 47** with the multi-row timeline. Phase 46 exposes the data primitive the Phase 47 UI calls.
- **D-09:** Cross-track move behaves exactly as **copy-paste-delete**: fresh identities in the destination, source items removed, references re-pointed under the same paste rules (fail-closed for Hold clips).

### Hold linked-source semantics (TRK-08)
- **D-10:** A Hold source is a **live single source-of-truth**: one real frame on the owning track; every linked occurrence (Loop Clip `sourceFrameRefs`) renders live **by reference — never a copy**.
- **D-11:** A Hold occurrence is **strictly a live reference** — no per-occurrence override. Editing a Hold frame means editing the source.
- **D-12:** Editing the source frame performs **atomic invalidation + recompute**: one revision bump invalidates the owning track's cache and every linked occurrence across the document.
- **D-13:** If the source frame is deleted or cleared, linked occurrences **fail-closed**: the Loop Clip is flagged source-missing and renders nothing/placeholder until the source is restored — never silently falls back to a stale copy.

### Track deletion + assets (TRK-07)
- **D-14:** Deleting a track that holds accepted cache assets is **acknowledge-and-delete**: an explicit dialog states how many accepted frames will be removed; confirming removes the track AND its cached PNG sidecars. Fail-closed here means the action is explicit, not blocked.
- **D-15:** On acknowledged delete, the track's cached **PNG sidecars are deleted in the same transaction** as the track removal (no orphaned files).
- **D-16:** If another track's Hold/Loop references this track's frames, deletion **severs the references first**: the dependent occurrence is re-pointed or flagged source-missing (per D-13), then the track deletes.
- **D-17:** Deleting the **last Paint track is refused** — a document must always have at least one Paint track (Phase 45 invariant: one default Paint track + fixed Background track). The delete is blocked with a message.
- **D-18:** When the active track is deleted, the **nearest adjacent Paint track** (closest by order/row) becomes the new active track, keeping the active track unambiguous (TML-03).

### Async work on track switch (TRK-05, TRK-06)
- **D-19:** Async PlayScript/Reveal **captures its target track at the moment the operation starts**. If the user switches tracks mid-flight, the work **completes on the original captured track** (after revalidation) — non-destructive to the new selection.
- **D-20:** Before commit, async work **revalidates parent + document + track revision**; on any mismatch, OR if the target track is no longer present, it **fails closed** — discards, no partial write.

### Claude's Discretion
- Exact store/function shape for the track-local addressing extension (`paintStore.ts`, `physicPaintStore.ts` → `Map<layerId, Map<trackId, ...>>`), per-track revision/dirty flags, and the per-track `paintVersion` split from the current single global `rotoPhysicalRevision`.
- Where the new track-local state lives in `app/src/efx-paint/` vs. the existing `physic-paint/` store tree (research recommends extending the stores; researcher finalizes).
- Exact acknowledge-delete dialog copy (must be plain and explicit per D-14).
- Undo entry serialization details (refs + revision hash shape) within the 10-level cap.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec (source of truth)
- `SPECS/milestone-v1.0.0-plan.md` §Phase 2 — Track-local Paint, Roto, PlayScript, and caches (objective, requirements, acceptance). Also §Phase 1 for the document/identity rules this phase operates on.

### Milestone research (2026-08-23, confidence HIGH)
- `.planning/research/SUMMARY.md` — executive summary, build-order rationale, per-phase pitfalls. Pitfall 1 (track identity), Pitfall 3 (stale async), Pitfall 4 (cache keys / global paintVersion), Pitfall 9 (loop asset duplication), Pitfall 17 (raster bytes in undo) are owned by this phase.
- `.planning/research/ARCHITECTURE.md` — Pattern 2 (track-local addressing `layerId → trackId → frame`), Pattern 3 (revision authority), file map for `efxPaintStore.ts`, `physicPaintStore.ts`, `paintStore.ts`, `physicPaintBridge.ts`.
- `.planning/research/PITFALLS.md` — full pitfall list with prevention patterns.

### Requirements
- `requirements/REQUIREMENTS.md` §TRK — TRK-01..TRK-08 mapped to this phase.

### Prior phase context
- `.planning/phases/45-new-efx-paint-document-and-clean-cutover/45-CONTEXT.md` — document model decisions (D-01..D-12), identity rules, revision builders, track UUIDs, clean-break invariants this phase extends.
- `app/src/efx-paint/document/efxPaintDocument.ts` — the v1.0 document model built in Phase 45 (`InternalPaintTrack` carries `id`, `revision`, `frames`, `rotoPhysical`, `loopClips`; `EfxPaintDocument` carries `documentRevision`, `activeTrackId`, `tracks`, `compositeRevision`).
- `app/src/efx-paint/document/efxPaintDocumentRevision.ts` — deterministic document/track/composite revision builders Phase 46 undo/async authority uses.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/efx-paint/document/efxPaintDocument.ts` + `efxPaintDocumentRevision.ts` — the v1.0 document + deterministic track/document/composite revision builders (Phase 45). Track-local state and undo/async authority build directly on these.
- `app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.ts` — the Loop Clip resolver (modulo, finite/infinite, next-clip interruption, half-open intervals). **Reused verbatim** for Hold clips; do not build a second scheduler.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — fail-closed parser pattern + `buildPhysicPaintRotoPhysicalRevision`, mirrored by the Phase 45 revision builders.
- `app/src/components/physic-paint/roto/rotoEditBufferTransactions.ts` / `rotoSaveTransactions.ts` — the existing transaction-based undo/redo model Phase 46 extends to a track-tagged unified stack (D-01).

### Established Patterns
- Track identity: stable `trackId` UUID strings, never array indices — reorder must never rewrite IDs (Pitfall 1).
- Track-local addressing `layerId → trackId → frame` everywhere; every cache key embeds `trackId`; per-track `paintVersion` bump + subscribe (Pitfall 4 — current `physicPaintStore` has one global `rotoPhysicalRevision`/`physicPaintVersion` to split per track).
- Revision-based async lease authority, fail-closed (existing Phase 43.4 `physicPaintBridge.ts` pattern), extended to include track revision.

### Integration Points
- `app/src/stores/physicPaintStore.ts` — current single `rotoPhysicalRevision`/`physicPaintVersion` counters to split per track; add track CRUD + deletion laws.
- `app/src/stores/paintStore.ts` — Paint frames become `Map<layerId, Map<trackId, Map<number, T>>>`.
- `app/src/lib/physicPaintBridge.ts` — request/result listen branches add track revision to messages; async commit revalidates parent+document+track (D-19/D-20).
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — existing toolbar/shortcut wiring that will invoke the track-aware copy/cut/paste/duplicate/clear/undo/redo store ops (UI itself is Phase 47).
- `previewRenderer.ts` — unchanged main-editor boundary; consumes the parent flattened raster (out of scope here).

</code_context>

<specifics>
## Specific Ideas

- The user anchored the paste semantics to the **v0.9 rail-set rule**: paste is always new identity. And clarified the "no durable asset duplication" contract is **narrow — it only forbids duplicating assets across the repeated occurrences of ONE Loop Clip; a paste is new independent content and may duplicate**.
- User explicitly wants cross-track paste/Hold re-pointing to **fail closed rather than ever produce a dangling/foreign reference**, and async work to **always complete on the track it started on**, never follow the user's mid-operation switch.
- The undo model keeps the **10-level cap the user already accepted for Roto**, and undoing a cross-track entry auto-selects that track so the result is never hidden.
- Track deletion is **explicit, never silent**: a confirm that removes the cached assets, but deleting the last Paint track is refused outright.

</specifics>

<deferred>
## Deferred Ideas

- **Multi-row timeline + drag gesture UI** (the actual drag interaction, filmstrip, and track CRUD controls) — **Phase 47** (D-08/D-09).
- Per-track opacity/blend/hide/solo controls that consume the track-local state — **Phase 47** (timeline controls), compositor application **Phase 48**.
- Independent per-track transforms / track effects stacks — research "Defer (v2+)" list, future milestone.

</deferred>

---

*Phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache*
*Context gathered: 2026-08-23*
