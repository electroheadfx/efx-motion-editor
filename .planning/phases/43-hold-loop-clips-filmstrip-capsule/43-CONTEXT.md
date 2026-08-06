# Phase 43: Hold Loop Clips + Filmstrip Capsule - Context

**Gathered:** 2026-08-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver deterministic static/hold rendering hardening, linked Loop Clips, and the timeline filmstrip capsule. Static/hold destination frames materialize the complete script stroke set deterministically (HOLD-01..04, building on the Phase 42 cycle-only generation). Linked Loop Clips replay a source cycle from 1 to infinity by reference — modulo source resolution, half-open intervals, next-clip priority, re-expansion — without duplicating durable source assets (HOLD-05). The filmstrip capsule on the main editor timeline visualizes the source cycle, linked repetitions, badges, requested vs effective duration, and truncation (HOLD-06). The capsule is a pure view of the resolver's outputs and ships WITH the resolver — never split (locked roadmap boundary note).

Requirements: HOLD-01..06 (`.planning/REQUIREMENTS.md`). Phase goal, success criteria, and boundary note: `.planning/ROADMAP.md` §"Phase 43". Carried-forward decisions: `.planning/phases/42-playscript-application-modes-color-override/42-CONTEXT.md`. `.planning` is the sole planning authority for this phase — SPECS is not an active authority for Phase 43 agents unless the user explicitly re-enables it.

**Locked by roadmap and requirements (not negotiable):** no clean format break in v0.9.0 — additive persistence preserving v0.8.1 Paint projects (clean multi-track break reserved for v1.0.0); linked loop region semantics (modulo indexing, half-open intervals, next-clip priority with partial-cycle interruption, re-expansion on move/remove, source-frame edits propagate to every linked occurrence); repetitions never create duplicate durable source images; commit path reuse (HOLD-03); deterministic Script Motion reuse (HOLD-02); the term `clip bloquant` never appears in any language; Phase 42 D-02/D-14 carry forward (cycle-only generation already shipped; a repeated Progressive cycle restarts the build `A|AB|ABC|A|AB|ABC`).

</domain>

<decisions>
## Implementation Decisions

### Editing loops after creation

- **D-01:** Clicking the capsule badge reopens the Play Script dialog in a loop-edit mode targeting that loop. Loop edit mode exposes ONLY Repeat + Infinity plus the Requested/Effective readout; primary action is `Update loop`. Frames-per-cycle and all source fields stay locked in this mode.
- **D-02:** The loop-edit dialog provides a secondary action `Edit source cycle…` that opens the full Play Script dialog in a separate source-edit mode, prefilled with the source cycle's current mode, Frames per cycle, color, and Motion values. The source-edit dialog must clearly state that confirming regenerates the source cycle and updates every linked Loop Clip referencing it; if multiple loops share the source, it shows how many loops are affected. Confirmation button: `Regenerate source cycle`. Regeneration uses the existing staged atomic commit, capacity, authority, cancellation, Undo, and Redo protections; Cancel changes nothing; after success all linked loops re-resolve requested/effective duration and next-clip truncation.
- **D-03:** Deleting a loop clip is unlink-only: the loop link is removed and the source cycle's real keys remain as ordinary Roto keys. Loops are pure references, so deletion is non-destructive by construction.
- **D-04:** A loop is anchored to its source cycle keys — no independent loop drag. The existing rigid group drag (Phase 37) moves the source keys and the loop with them. Single source of position truth. Placement/source identity (corrected 2026-08-06, approved audit finding 4): only a loop whose `placementStart` coincides with its source cycle's first key frame (an original loop) follows the drag; a duplicated Loop Clip (D-05) keeps its own destination `placementStart` when the shared source cycle moves — it keeps resolving the same source keys by id at its own placement.
- **D-05:** Source-cycle sharing between loops is decided at apply time: applying Play Script when an identical source cycle exists (same script + options) offers `Link to existing cycle` vs `Create new cycle`. Additionally, the capsule offers an explicit `Duplicate linked loop` action: pick a destination start frame and a new Loop Clip is created sharing the same source cycle — validated for same-start collision and overlap per D-14, with no regeneration. The duplicate's persisted `placementStart` is the chosen destination frame and its `sourceKeyIds` are the existing shared source-cycle key ids: placement and source location are two independent identities (placement/source correction, 2026-08-06). `Duplicate linked loop` is one atomic undoable operation: one Undo removes only the duplicate Loop Clip, Redo restores it, and no source keys or source assets are regenerated.

### Loops vs other Roto operations

- **D-06:** Uniform shrink policy: ANY content-producing operation (manual insert/paste/drag of real keys, Play Script apply, Roto interpolation) landing inside a loop's effective range shortens the loop's effective duration to that point. The loop object survives; canonical Requested duration is unchanged; only Effective is derived. Before a batch generation operation confirms, preflight reports when its destination will shorten an existing loop: `This operation will shorten {N} linked loop(s), starting at frame {F}.` The generated-key commit and the resulting derived loop shrink remain one coherent undoable outcome — Undo removes the generated keys and the loop re-expands automatically.
- **D-07:** Source-cycle key deletion is REJECTED while any loop references the cycle, with a clear reason; the user unlinks first. Fail-closed, matching the approved Cut-tool precedent.
- **D-08:** A loop shrunk to Effective = 0f SURVIVES as an object (see D-25 for its zero-effective representation). If the blocking content later moves away, the loop re-expands automatically — no regeneration, consistent with HOLD-05 re-expansion.
- **D-09:** Copy/paste never carries loop identity. Copied source-cycle keys paste as ordinary real keys (Phase 38 reusable-clipboard contract unchanged). New loops are created only via Play Script Apply (+ optional Link) or `Duplicate linked loop`.
- **D-10:** `Update loop` and `Unlink loop` are each one atomic undoable operation (Phase 36.14 atomic-transaction model) — one Undo restores the prior state.
- **D-11:** Linked source-cycle keys are rigid: single-key drag (ripple) on a linked source key is rejected with a reason; Force Spacing rejects selections containing linked source keys. One uniform contract: a linked cycle's internal spacing IS the loop rhythm; keys move only via rigid group drag.
- **D-12:** Painting or erasing on a linked repetition frame materializes a new local real key at that frame: the loop's resolved pixels become its base plus the new stroke. The new key becomes the next-clip boundary and the loop shortens (D-06). Canvas and playhead stay at the current frame; one Undo removes the new key and the loop re-expands.
- **D-13:** Clear vs Delete on a linked repetition frame keep their distinct existing meanings. **Clear** materializes a local empty real key (source untouched, frame becomes the boundary, loop shortens, atomic undoable, one Undo re-expands). **Delete-key** is rejected because no local real key exists — it never touches the modulo-resolved source key and never unlinks — showing: `No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.` A materialized empty key can later be deleted normally, re-expanding the loop. `Delete loop` remains the separate unlink-only operation on the selected capsule (D-03).
- **D-14:** Loop-loop priority: Requested ranges may overlap; resolved Effective ranges never overlap. Timeline order (NOT creation order) determines priority. Loop B (later placement start) begins at its placement start B; B's start acts as loop A's next-clip boundary; A's effective end = min(A requested end, B start, parent end); B is NOT pushed after A and is independently truncated by the next content or loop after B. An infinite earlier loop ends effectively at the later loop's start; moving or deleting the later loop re-expands the earlier automatically. Two loops cannot share a placement start — same-start collisions compare `placementStart` and are rejected or handled through an explicit replace/update flow, never by hidden creation-order priority.

### Filmstrip capsule presentation

- **D-15:** Source-cycle cells show real thumbnails (downscaled cached PNGs from the existing cache path). Placement/source identity (corrected 2026-08-06, approved audit finding 4): for an original loop whose placement overlaps its actual source keys, first-cycle cells correspond to real keys and retain real-key diamonds. For a duplicated loop placed elsewhere, first-cycle cells display the shared source thumbnails but are linked/virtual at that placement: they must NOT show real-key diamonds, and clicking them follows the linked-occurrence inspection/edit behavior (D-17), never real-key selection at the destination.
- **D-16:** Repetitions are zoom-adaptive: default zoom renders the compact perforated/hatched band (per spec); high zoom expands repetitions into visually lighter ghost linked cells (no thumbnails); low zoom collapses to band + badge only.
- **D-17:** Clicking a repeated occurrence reveals its repeat instance and source-frame index via tooltip (e.g. `Repeat 3 · Source frame 2 of 5`, flat-multiline Phase 38 convention) PLUS a separate seek action that moves to the modulo-resolved source frame.
- **D-18:** The Physics Paint Studio workflow strip also visualizes loops: linked repetition cells keep their existing cell-state semantics (empty/cached/generated/etc.) and gain an ADDITIVE link badge/border that changes neither cell geometry nor the Phase 36.15 legend/status palette. Source-cycle cells keep real-key diamonds. No new first-class cell state.
- **D-19:** Badge text is compact math only: `Cycle 5f × 5 = 25f` (finite), `Cycle 5f × ∞` (infinity), `Cycle 5f × 1 = 5f` (single cycle). Requested vs Effective values, truncation status, and mode (Progressive / Static-Hold) live in the tooltip. Truncation never changes the badge.
- **D-20:** Capsule copy is English only: `Loop shortened by next clip`. HOLD-06's earlier French truncation label is SUPERSEDED and must not ship (its intent — a clear truncation label — is preserved; Phase 42 D-13 deferred the language decision to this phase; `.planning/REQUIREMENTS.md` HOLD-06 corrected at the source 2026-08-06; the superseded wording is preserved verbatim in the audit-only `43-DISCUSSION-LOG.md`). The term `clip bloquant` remains prohibited in every language.
- **D-21:** Truncation presentation: a diagonal cut slices the capsule's trailing corner (top-right, leaning forward in playback direction) across the whole capsule outline including the band, in an amber/warning-toned stroke distinct from source-cell and ghost-cell colors. The diagonal's position encodes partial vs complete truncation: at normal/high zoom it lands mid-ghost-cell for a partial cycle and exactly on a cycle boundary for complete cycles; the tooltip states `(partial cycle)` vs `(complete cycles)`. At low zoom the diagonal still draws on the band end.
- **D-22:** Zero-effective loop (Effective = 0f): a slim greyed anchor flag (~6px pill) pinned at the loop's placement start frame with a compact `0f` marker; full tooltip (`Cycle 5f × 5 = 25f · Effective 0f — fully shortened by the next clip`); clickable, selectable, keyboard-focusable, with badge-edit, unlink, and delete-loop access intact. Never invisible; re-expands into the full capsule when the blocker moves.
- **D-23:** Capsule interaction states follow existing timeline idioms: hover = raise + tooltip; selected = accent outline around the whole capsule (selection unit = the loop object); keyboard-focus = visible focus ring in timeline keyboard nav; disabled/stale = reduced opacity + reason tooltip; error (unresolvable source refs) = red-toned outline + error tooltip — the capsule never silently disappears. Ghost cells, interpolated frames, and ordinary clips keep their current visuals; only source keys keep diamonds; ghost cells are never key-selectable.

### Next-clip boundary definition

- **D-24:** The next-boundary query is scoped to the same parent Paint authority and explicitly excludes every entity owned by the Loop Clip being resolved — **a loop never truncates itself**. For loop L, boundary candidates exclude: L's own placement start; every virtual linked occurrence produced by L; every source-cycle keyId referenced by L; caches, previews, interpolated render-only frames, and content from other Paint authorities. Valid boundaries are exactly three: a real key not owned by L's source cycle (including empty real keys), another Loop Clip's placement start, and parentEndExclusive. A valid boundary landing exactly at L's start produces Effective = 0f (the zero-effective case of D-08/D-22). **Placement start** (`placementStart`) is the first frame of THIS Loop Clip's presentation on the destination timeline — for an original loop it coincides with the frame of L's first source-cycle key; for a duplicated loop (D-05) it is the chosen destination frame, independent of where the shared source keys live (placement/source correction, 2026-08-06). The physical source location is derived separately from the ordered `sourceKeyIds` and their real-key records. The placement start is the beginning of the whole capsule presentation: the source-cycle thumbnails render first, then the linked repetition region, which begins at placementStart + cycleLength. Resolver and TimelineRenderer share this single definition; neither may interpret placement start as the repetition-region start, and neither may derive placement from the source keys' location. The boundary model is purely key-based, matching the physical-frame document authority. — **Reversibility:** costly — this boundary algebra is the shared contract between the resolver, every ops interaction (D-06..D-14), and the capsule; changing it later re-opens all three.
- **D-25:** Infinite loops track parent end dynamically: extending the parent sequence grows the loop's effective range, shrinking the parent shortens it — no regeneration either way. Finite loops never grow past their requested duration.

### Resolver, caching, and parity

- **D-26:** Loop resolution EXTENDS the existing physical resolver (`physicsPaintRotoPhysicalResolver.ts`): loop records live in the physical-frame document and the resolver gains a virtual-resolution rule mapping a destination frame to its modulo source keyId. Real keys always win over virtual frames — this implements materialize-local-key (D-12) and shrink semantics (D-06) for free. Linked occurrences never receive their own raster/cache entries: one source cache entry serves every occurrence, and a source-frame Paint edit invalidates that single entry so every occurrence reflects it. Cache weight scales with source cycles, never with repetition count. — **Reversibility:** costly — the physical resolver is regression-locked physical-frame authority; extending it touches the same seam every Roto feature depends on.
- **D-27:** One canonical resolver everywhere: main editor preview, playback/scrub, Physics Paint Studio frame display, filmstrip/thumbnails, PNG sequence export, and save/reopen cache regeneration all read the same physical-resolver output. The same project frame resolves to the same Paint raster on every surface; export never differs from preview; Infinity is bounded by the current parent end at export time. No adapters, no surface-specific resolution logic.
- **D-28:** Unavailable source frame policy: preview/playback show a marked placeholder frame (visible, non-blocking); export is BLOCKED with a clear error naming the affected loop and frame — a deliverable never silently contains placeholder frames.

### Persistence and backward compatibility

- **D-29:** Loop Clips persist as additive records inside the physical-frame document — the single persistence authority; no sidecar file. The document gains an optional `loopClips` collection; v0.8.1 documents without it load as an empty collection with no migration and no format break. Locked minimum semantic record: stable Loop Clip id; placement start frame (`placementStart` — the first frame of THIS Loop Clip's presentation: the first source-cycle key frame for an original loop, the chosen destination frame for a duplicated loop; placement/source correction, 2026-08-06); ordered stable source-cycle keyId references (stable Phase 36.14 keyIds) from which the physical source location is derived separately; finite Repeat count or explicit Infinity state; source-cycle provenance required by the approved UI, including Progressive vs Static/Hold if not derivable from existing key metadata. Because Phase 43 product code has not been implemented yet, this model correction ships with NO migration shim and no compatibility alias. — **Reversibility:** one-way — once user projects save `loopClips` records, the field becomes a persisted document contract; removing or renaming it later requires a migration (the v1.0.0 clean break is the designated escape).
- **D-30:** Requested duration is derived (cycle length × Repeat/Infinity). Effective duration, next-clip boundary, parent-end truncation, repeat-instance mappings, and resolved destination frames are NEVER persisted — always recomputed by the canonical resolver. Requested/effective ranges, repetition-region start, and same-start collision checks all derive from `placementStart`, never from the source keys' frames: presentation frame `placementStart + i` resolves to `sourceKeyIds[i % cycleLength]`. No persisted source revision acts as an invalidation authority: editing a source key remains valid and propagates immediately to linked occurrences (existing document/key revision mechanisms may still serve cache invalidation).
- **D-31:** Missing or stale source keyId references are preserved VERBATIM in the canonical record — never dropped silently, never rewritten at load. The Loop Clip is marked unresolved/error; its capsule or zero/error marker is retained (D-23); the tooltip lists the missing references; preview uses placeholders and affected exports are blocked (D-28); explicit repair, relink, unlink, and delete-loop actions are offered. Save/reopen preserves the unresolved record exactly so repair stays possible. Save As copies Loop Clip records and their stable references atomically with the physical document. Exact TypeScript field names and the integration seam are implementation research; the semantic fields, additive/no-migration approach, Effective-derived rule, and no-silent-data-loss behavior are locked.

### Performance

- **D-32:** Virtual resolution invariant: O(1) modulo per frame; Infinity never materializes a frame list; only the requested frame/view resolves. The timeline draws only visible cells (TimelineRenderer is canvas — ghost cells are paint calls, zero DOM nodes). Export resolves incrementally per frame with the existing progress/cancellation. No per-repetition rasters. Moving/removing a boundary re-resolves derived ranges in O(keys + loops in range) with no cache rebuild. No artificial loop-count or cycle-size caps beyond existing key/capacity limits.

### Claude's Discretion

- Exact TypeScript field names and document-schema seam for `loopClips` (semantics locked in D-29..D-31).
- Determinism hardening mechanics for HOLD-02 (proving zero jitter across save/reopen and cache regeneration) — reuse `transformRecordedStrokeForHeldPose`; exact test strategy is planner territory.
- Exact ghost-cell/hatch/diagonal/anchor-flag drawing code within the locked presentation semantics (D-16, D-21, D-22) and TimelineRenderer conventions.
- Thumbnail downscale dimensions for source-cycle cells (existing cache path provides the source imagery).
- Exact tooltip copy phrasing within the locked content requirements (English only, `clip bloquant` prohibited).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap (locked WHAT)
- `.planning/REQUIREMENTS.md` — HOLD-01..06 requirement statements; HOLD-06 ships the English label `Loop shortened by next clip` (earlier French label superseded at the source 2026-08-06; `clip bloquant` prohibited in every language)
- `.planning/ROADMAP.md` §"Phase 43" — goal, success criteria, locked boundary note (additive persistence, no v0.9.0 format break, capsule ships WITH the resolver)

SPECS is deliberately excluded: `.planning` is the sole planning authority for this active milestone. Phase 43 agents must not consult SPECS unless the user explicitly requests it.

### Prior phase decisions (carried forward)
- `.planning/phases/42-playscript-application-modes-color-override/42-CONTEXT.md` — D-02/D-03/D-14 (cycle-only generation; Frames field IS cycle length; repeat/infinity as loop intent; repeated Progressive cycle restarts the build), D-13 (English readout convention), D-16/D-19 (approved dialog layout and modal overlay the loop-edit and source-edit modes extend), locked half-open interval and requested-vs-effective display conventions this phase shares

### Existing seams to extend (read before editing)
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — the resolver D-26 extends with virtual loop resolution; real-key precedence lives here
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — physical-frame document authority where `loopClips` records persist (D-29)
- `app/src/lib/physicPaintPersistence.ts` + `app/src/types/physicPaint.ts` — document hydration/parse/payload path the additive `loopClips` collection rides
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` + `physicsPaintRotoPlayScriptRenderer.ts` — commit path reused by source-cycle regeneration (D-02) and apply-time Link/Create flow (D-05)
- `packages/efx-physic-paint/src/animation/staticStrokeSchedule.ts` — Phase 42 static/hold schedule (complete stroke set per frame; HOLD-01 base)
- `packages/efx-physic-paint/src/animation/recordedStrokeMotion.ts` — `transformRecordedStrokeForHeldPose` deterministic Script Motion transform (HOLD-02)
- `app/src/components/timeline/TimelineRenderer.ts` — capsule render host: physic-paint FX row, `drawPhysicPaintPlayScriptMarkers`, real-key diamond geometry (`getPhysicPaintRotoKeyMarkerGeometry`)
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — Studio strip gaining the additive link badge (D-18)
- `app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx` — dialog extended with loop-edit and source-edit modes (D-01, D-02)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `physicsPaintRotoPhysicalResolver.ts`: already maps appFrame → content (real key / cached / generated) — the virtual loop rule (destination → modulo source keyId) slots in with real-key precedence, which implements D-06 shrink and D-12 materialize-local-key as emergent behavior.
- `physicsPaintRotoPlayScriptController.ts` + Renderer: full authority/capacity/staged-commit machinery — `Regenerate source cycle` (D-02) reuses it verbatim; no new commit path.
- `TimelineRenderer.ts`: canvas renderer (zero DOM nodes — ghost cells satisfy D-32 for free) with an existing physic-paint FX row, Play Script markers, and diamond geometry math to extend for the capsule.
- Stable keyIds (Phase 36.14 physical model): the identity mechanism loop source references are built on (D-29).
- Existing per-frame cache path: provides the one-source-cache invariant (D-26) and the thumbnail imagery for source-cycle cells (D-15).
- Phase 37 rigid group drag: the loop-move mechanism (D-04) — no new interaction.

### Established Patterns
- Fail-closed guarded operations with clear reasons (Cut-tool precedent, Phase 36.15 guarded-icon conventions) — applied to source-key deletion (D-07), single-key drag and Force Spacing on linked keys (D-11), Delete-key on linked frames (D-13).
- Atomic acknowledged transactions with one Undo/Redo (Phase 36.14) — Update loop / Unlink / Clear-materialize follow it (D-10, D-13).
- Flat-multiline tooltip convention (Phase 38) — capsule tooltips (D-17, D-19, D-22).
- Additive optional document fields with absent-means-default loading (physical document payload) — `loopClips` follows it (D-29).
- Native visual UAT is the user's oracle — nothing is "done" until live UAT passes.

### Integration Points
- Physical resolver: virtual-resolution rule + unresolved/error state surfacing.
- Physical document payload: optional `loopClips` collection (load/save/save-as/reopen).
- Play Script dialog: loop-edit mode (Repeat/Infinity + `Update loop`) and source-edit mode (`Regenerate source cycle` + affected-loop count).
- Apply flow: `Link to existing cycle` vs `Create new cycle` when an identical source cycle exists.
- TimelineRenderer physic-paint FX row: capsule (thumbnails, band, ghost cells, badge, diagonal end, anchor flag, interaction states).
- Studio workflow strip: additive link badge on linked repetition cells.
- Preview/playback/Studio display/filmstrip/export: all consume the same resolver output (D-27); export blocks on unresolvable sources (D-28).

</code_context>

<specifics>
## Specific Ideas

- User specified the loop-edit dialog structure verbatim: primary `Update loop`; secondary `Edit source cycle…`; source-edit confirmation `Regenerate source cycle`; affected-loop count shown when the source is shared; Cancel changes nothing; all linked loops re-resolve after successful regeneration (D-01, D-02).
- User specified the Delete-key rejection copy verbatim: `No real key exists at this linked frame. Use Clear to create an empty real key, or select the Loop Clip capsule to delete the loop.` (D-13).
- User specified loop-loop priority semantics: B begins at its placement start; B is NOT pushed after A; A effective end = min(A requested end, B start, parent end); canonical Requested ranges unchanged, Effective derived; same-start collisions never resolved by hidden creation-order priority (D-14; terminology corrected from the single overloaded "canonical start" field to the placement/source identity model per the approved audit correction, 2026-08-06).
- User specified the no-silent-data-loss persistence rule verbatim: stale keyId references preserved verbatim, never dropped, never rewritten at load; unresolved records survive save/reopen exactly so repair remains possible; repair/relink/unlink/delete-loop actions offered (D-31).
- User specified badge forms verbatim: `Cycle 5f × 5 = 25f`, `Cycle 5f × ∞`, `Cycle 5f × 1 = 5f`; zero-effective tooltip form `Cycle 5f × 5 = 25f · Effective 0f — fully shortened by the next clip` (D-19, D-22).
- User explicitly resolved the HOLD-06 language conflict: English-only `Loop shortened by next clip`; the earlier French truncation label is superseded at the requirement source and must not ship; `clip bloquant` prohibited in every language (D-20).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Ping-pong loop mode LOOP-01 and combined progressive-plus-hold scheduler LOOP-02 remain roadmap-deferred future requirements, unchanged.)

</deferred>

---

*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Context gathered: 2026-08-06*
