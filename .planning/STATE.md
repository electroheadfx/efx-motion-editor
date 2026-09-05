---
gsd_state_version: 1.0
milestone: v1.0.0
milestone_name: EFX Paint Multi-Track Frames and Reveal
current_phase: 53
current_phase_name: Integrated v1.0.0 Acceptance
status: planning
stopped_at: Phase 52 complete, ready to plan Phase 53
last_updated: "2026-09-04T19:48:46.276Z"
last_activity: 2026-09-04
last_activity_desc: Phase 52 complete, transitioned to Phase 53
state_head: 732c504c2b5d0dbe25b5d599806ab442d57a4017
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 42
  completed_plans: 42
  percent: 56
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-23 after v1.0.0 milestone start)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 53 — Integrated v1.0.0 Acceptance

## Current Position

Phase: 53 — Integrated v1.0.0 Acceptance
Plan: Not started
Status: Ready to plan
Last activity: 2026-09-05 - Completed quick task 260905-d1w amendment: Paste after Copy; + Rail extended gating (generated/repeat frames)

Progress: [████████████████████] 42/42 plans (100%)

## Performance Metrics

**Velocity:**

- Total plans completed: 45 for v0.9.0 (12 phases, shipped 2026-08-21)
- Average duration: N/A
- Total execution time: N/A

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 45. New EFX Paint Document and Clean Cutover | 8 | TBD | - |
| 46. Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches | 6 | TBD | - |
| 47. Internal Multi-track Timeline, Filmstrip Capsules, and Controls | 5 | TBD | - |
| 48. Internal Compositor and Flattened Parent Result | 6 | TBD | - |
| 49. Fixed Background Track and Imported Loop Clips | 0 | TBD | - |
| 50. Photo/Reference Track | 0 | TBD | - |
| 51. Read-only Audio Preview | 0 | TBD | - |
| 52. Shared Mask Compositor and Reveal | 0 | TBD | - |
| 53. Integrated v1.0.0 Acceptance | 0 | TBD | - |
| 45 | 8 | - | - |
| 49 | 6 | - | - |
| 52 | 6 | - | - |

**Recent Trend:**

- N/A (new milestone)

**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 45 P01 | 135 | 3 tasks | 6 files |
| Phase 45 P02 | 110 | 3 tasks | 6 files |
| Phase 45 P03 | 5 | 2 tasks | 7 files |
| Phase 45-new-efx-paint-document-and-clean-cutover P04 | 25 | 3 tasks | 5 files |
| Phase 45-new-efx-paint-document-and-clean-cutover P05 | 30 | 3 tasks | 8 files |
| Phase 45-new-efx-paint-document-and-clean-cutover P06 | 55 | 4 tasks | 42 files |
| Phase 45-new-efx-paint-document-and-clean-cutover P07 | 25 | 2 tasks | 18 files |
| Phase 46-track-local-paint-roto-playscript-state-loop-clips-and-cache P01 | 120 | 3 tasks | 13 files |
| Phase 46-track-local-paint-roto-playscript-state-loop-clips-and-cache P02 | 35 | 3 tasks | 10 files |
| Phase 46 P03 | 33 | 3 tasks | 13 files |
| Phase 46-track-local-paint-roto-playscript-state-loop-clips-and-cache P04 | 25 | 3 tasks | 10 files |
| Phase 46-track-local-paint-roto-playscript-state-loop-clips-and-cache P05 | 35 | 3 tasks | 5 files |
| Phase 46 P06 | 50 | 3 tasks | 4 files |
| Phase 47-internal-multi-track-timeline-filmstrip-capsules-and-control P01 | 225 | 3 tasks | 10 files |
| Phase 47-internal-multi-track-timeline-filmstrip-capsules-and-control P02 | 190 | 3 tasks | 12 files |
| Phase 47-internal-multi-track-timeline-filmstrip-capsules-and-control P03 | 45 | 2 tasks | 6 files |
| Phase 47-internal-multi-track-timeline-filmstrip-capsules-and-control P04 | 130 | 3 tasks | 8 files |
| Phase 47-internal-multi-track-timeline-filmstrip-capsules-and-control P05 | 120 | 2 tasks | 6 files |
| Phase 48 P01 | 15 | 3 tasks | 6 files |
| Phase 48 P02 | 9 | 2 tasks | 2 files |
| Phase 48 P04 | 6 | 2 tasks | 4 files |
| Phase 48-internal-compositor-and-flattened-parent-result P48-03 | 42min | 3 tasks | 13 files |
| Phase 48 P05 | 20 | 2 tasks | 11 files |
| Phase 49 P01 | 3 | 2 tasks | 5 files |
| Phase 49 P02 | 20 | 3 tasks | 6 files |
| Phase 49-fixed-background-track-and-imported-loop-clips P03 | 45 | 3 tasks | 13 files |
| Phase 49-fixed-background-track-and-imported-loop-clips P05 | 4h | 2 tasks | 12 files |
| Phase 49-fixed-background-track-and-imported-loop-clips P06 | 2d | 2 tasks | 15 files |
| Phase 50 P01 | 16 | 2 tasks | 5 files |
| Phase 50 P02 | 4min | 3 tasks | 3 files |
| Phase 50 P03 | 12 | 2 tasks | 12 files |
| Phase 50 P04 | 15min | 2 tasks | 7 files |
| Phase 50 P05 | 19 | 3 tasks | 11 files |
| Phase 50 P06 | 10min | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- v1.0.0 is a clean format break: pre-v1.0 Paint projects are discarded/unsupported; no migration or compatibility shim; legacy data fails explicitly.
- Architectural invariant locked: one parent Paint layer → one EFX Paint document → many internal Paint frame tracks → one flattened frame result delivered to the unchanged main-editor compositor.
- Multi-track means internal Paint frame tracks inside one opened EFX Paint document; no `Sequence.frameTracks`, no main-editor rows for internal tracks, no direct main-renderer iteration over internal tracks.
- All internal tracks share the parent application-frame axis and never change main-editor sequence duration.
- Hold and Background loops share linked source-frame references, modulo resolution, finite repeat from 1, and infinity without duplicating durable images.
- One fixed Background track sits beneath all Paint tracks with non-overlapping imported still/sequence Loop Clips; gaps reveal solid/transparent document fallback.
- One photo/reference track supplies painting reference and Reveal source but is excluded from ordinary flattened output.
- Main-editor audio is available only as read-only synchronized monitoring during EFX Paint playback.
- Internal track opacity/blend applied once inside EFX Paint; parent opacity/blend applied once by the main editor (never double-applied).
- Reveal uses photo source plus internal Paint coverage through one shared mask compositor.
- [Phase 45]: EfxPaintDocument is the v1.0 identity root: one versioned document per parent layer, stable UUID track IDs, one default Paint track, one fixed Background track with transparent fallback (D-08); shared canonical encoder extracted to efxPaintCanonicalEncoder.ts and re-pointed from the roto physical model
- [Phase 45 P02]: efx_paint_documents lands in BOTH models/project.rs and types/project.ts in the same commit (F1 co-change, proven by Rust round-trip test); physic_paint_outputs demoted to an opaque Vec<serde_json::Value> presence carrier (D-02/D-06); legacy Rust output structs deleted (DOC-04); create_project_dir creates cache/efx-paint and never cache/physic-paint, legacy dirs byte-untouched (D-04); native cache transaction service re-pointed to cache/efx-paint with .efx-paint-staging- prefix, command surface unchanged (T-45-06)
- [Phase 45]: The rejection gate is a pure scan over raw parsed .mce JSON: no filesystem, no IPC, no mutation, no throwing on unexpected shapes; fixed precedence outputs → cache-reference → documentless-layer, first match only, reasons terminal (D-07) — Pitfall F2 closed by structure discrimination: a 'physic-paint' layer is a trigger only when the top-level efx_paint_documents map has no entry for its layer id (source.layer_id, falling back to layer.id)
- [Phase 45 P04]: The persisted payload is the layerId → EfxPaintDocument map as-is (rotoPhysical dataUrls inline); the save input carries runtime frame bytes alongside documents and the loader returns hydrated frames (CachedFrameReference carries no dataUrl by 45-01 design)
- [Phase 45 P04]: serializeRuntimeIntoDocument bumps documentRevision by one ONLY when the projected content actually changed (fingerprint comparison on the same docrev) — an unconditional bump would defeat the Task 3 idempotency dedup in the 45-05 save flow
- [Phase 45 P04]: The dedup fingerprint combines buildEfxPaintDocumentRevision per layer with runtime frame byte terms (dataUrls): a repaint changes the bytes while deterministic cachePath refs stay the same, so a document-only key would wrongly skip re-staging
- [Phase 45 P04]: The rotoPhysical payload build is shared between the legacy toMceOutputs roto branch and extractRuntimeStateForDocument via _buildRotoPhysicalDocumentForLayer so both serialization seams emit identical payloads (also kept the main chunk under the 1120 kB V09-C04 budget)
- [Phase 45 P04]: installRuntimeStateFromDocument replaces the layer's runtime maps wholesale (delete-then-install), mirrors loadFromMceOutputs validation (canonical parse + timeline projection) and publication (bump rotoPhysicalRevision + physicPaintVersion, no dirty callback), and clears the per-layer _rotoPhysicalStructuralCache
- [Phase 45 P04]: hydrateRuntimeFromDocument takes (document, frames) — the loader supplies the hydrated frame bytes; registerDocument stays a separate call (45-05 open path: loadEfxPaintDocuments + registerDocument + hydrateRuntimeFromDocument)
- [Phase 45 P04]: The dedup cache is populated only after a successful commit and cleared on every commit, mirroring savedOutputCache; a rollback never touches the cache so the prior committed fingerprint stays reusable
- [Phase 45 P05]: The rejection gate runs immediately after the result.ok check in openProject — before any sidecar IO, closeProject, hydration, or startAutoSave — and on rejection shows a blocking no-recourse native error dialog (single OK) then returns with zero store mutation (D-05/D-07, Pitfall F4); the gate is stateless
- [Phase 45 P05]: The rejection dialog copy is an exported constant (LEGACY_PHYSIC_PAINT_REJECTED_COPY) naming EFX Physic Paint, pre-v1.0, and the impossibility of opening — no partial open, no continue-anyway, no converter offer
- [Phase 45 P05]: There is exactly one save path after this plan: saveProject and saveProjectAs both call saveEfxPaintDocumentsWithProjectWrite(projectDir, documents, writeProject) with the bound cache transaction; physic_paint_outputs is never emitted (explicit undefined override in the spread); version 16
- [Phase 45 P05]: openProject hydrates documents via loadEfxPaintDocuments + registerDocument + hydrateRuntimeFromDocument per document; closeProject calls efxPaintStore.reset() alongside physicPaintStore.reset so no document leaks across projects; the dirty callback is wired at module bottom
- [Phase 45 P05]: AddFxMenu registers exactly one v1.0 document per physic-paint layer at creation (registerDocument(createEfxPaintDocument(layerId)) after both creation branches)
- [Phase 45 P05]: The 45-05 wiring pulled efxPaintStore + efxPaintPersistence + the document model into the main chunk (1124.96 kB measured); the V09-C04 desktop budget was raised 1120 → 1130 with documented measurement (established pattern)
- [Phase 45-new-efx-paint-document-and-clean-cutover]: Session files are v1.0 documents: parsePhysicsPaintStateFile JSON-parses, detects the recognized legacy version:2 / strokes+settings shape and throws the distinct LOAD_STATE_UNSUPPORTED_VERSION_COPY, then validates via parseEfxPaintDocument mapping any parse throw to LOAD_STATE_INVALID_COPY; save serializes the document from efxPaintStore with the efx-paint-doc- filename marker
- [Phase 45-new-efx-paint-document-and-clean-cutover]: The launch IS the document: PhysicPaintLaunchContext carries the full v1.0 document from efxPaintStore.getDocument(layerId) — no fetch round-trip — and the legacy editableState/rotoPhysical/cachedRotoFrames/rotoInterpolationSettings fields are gone from the launch contract
- [Phase 45-new-efx-paint-document-and-clean-cutover]: The standalone engine adopts the v1.0 document: save() emits the document with strokes/settings riding the default track as engine-only carriers; load() validates fail-closed BEFORE mutating engine state, rejecting legacy version:2 with the distinct pre-v1.0 copy and unknown members with the generic invalid copy
- [Phase 45-new-efx-paint-document-and-clean-cutover]: The apply-canvas editableState carrier stays typed as the PACKAGE's EfxPaintDocument (the engine's save() output is not assignable to the app-side type — rotoPhysical: unknown vs PhysicPaintRotoPhysicalDocument); the guard validates a carrier-stripped copy through the full fail-closed parseEfxPaintDocument, rejecting legacy version:2
- [Phase 45-new-efx-paint-document-and-clean-cutover]: The dead PhysicsPaintStudioToolbar.tsx is deleted, not rewired: zero importers anywhere, and its independent v2-only session-load path is exactly the legacy session-file contract D-02 hard-deletes; the live Studio session load already routes through usePhysicsPaintSessionController → parsePhysicsPaintStateFile
- [Phase 45-new-efx-paint-document-and-clean-cutover]: The demo toolbar delegates validation to engine.load: JSON.parse failures surface the invalid-file copy, engine.load failures surface the engine's distinct error message (legacy v2 files hit the pre-v1.0 unsupported copy)
- [Phase 45-new-efx-paint-document-and-clean-cutover]: DOC-04 is mechanically proven by a grep contract test (efxPaintCleanBreakContract.test.ts): the 11 legacy persistence/format tokens ('physicPaintPersistence', 'cache/physic-paint', '.physic-paint-staging-', 'McePhysicPaint*', 'toMceOutputs', 'loadFromMceOutputs', 'efx-paint-state-', 'SerializedProject', 'isSerializedProject') must not appear outside the exact allowlist (gate module, gate test, fixtures, contract itself); the RED failure list IS the deletion checklist (D-02: the audit is a test, not a claim)
- [Phase 45-new-efx-paint-document-and-clean-cutover]: The contract test's token scope is the legacy persistence/format surface only — bare retained runtime-state identifiers (interpolation-settings map, cached-frames signal, editable-state types, per-track rotoPhysical schema field) are intentionally NOT banned (research A4); the 4 removed launch-payload fields are policed by a region-scoped check on the PhysicPaintLaunchContext interface body, not a tree-wide ban
- [Phase 45-new-efx-paint-document-and-clean-cutover]: physic_paint_outputs survives only as the OPAQUE presence carrier for the gate (45-02 design): declared in models/project.rs and types/project.ts, named by the Rust carrier mechanics, confined by a dedicated carrier allowlist — never interpreted by a reader/renderer/serializer
- [Phase 45-new-efx-paint-document-and-clean-cutover]: The legacy one-track surface is hard-deleted: physicPaintPersistence.ts + its test are gone (replaced by efxPaintPersistence.ts in 45-04), the McePhysicPaint* output types are removed from types/project.ts, and toMceOutputs/loadFromMceOutputs + their serialization cache are gone from physicPaintStore.ts — the v1.0 document projection (extractRuntimeStateForDocument + installRuntimeStateFromDocument) is the only save/load seam; git history is the only archive (D-02), deletion is code-only (D-04)
- [Phase 45-new-efx-paint-document-and-clean-cutover]: D-10 four-part native UAT PASSED (45-08): document creation on a v1.0 document with stroke on the default track, save/reopen identity persistence verified via on-disk .mce (version 1, parentLayerId, documentRevision, activeTrackId = default track, one Paint + one transparent-fallback Background track, no legacy keys), explicit no-recourse rejection on a real v0.9 project copy (D-12), and main-editor parity (DOC-06). Three regressions (R1/R2/R3) shared one root cause — Rust PhysicsPaintLaunchContext lacked the v1.0 document field so serde dropped the carrier (fixed b6629984); R4 was saveProjectAs not registering Recents for a fresh project (2c949f18); a save-block was the 45-02 capability fs scope not covering cache/efx-paint (10da700a). Phase 45 is fully verified
- [Phase 46 P01]: The runtime store is addressed layerId -> trackId -> value with 16 per-track maps; trackId is the stable UUID identity from the document, never an array index (TRK-01 base law, Pitfall 1); editing one internal track never changes another track's real keys, frames, or caches
- [Phase 46 P01]: Per-track revision signals (getTrackPaintVersion/getTrackRotorRevision) plus the global physicPaintVersion clock; bumpTrackRevision bumps the track signal AND the global clock; one mutation fires the injected dirty callback exactly once (Pitfall 4 closed)
- [Phase 46 P01]: Lease scope/identity embed trackId — a layer holds one exclusive lease per track; _validateRotorPhysicalLayerPublication checks token.trackId against the claimed track before any write (T-46-03); removeTrackRuntime settles the track's leases with the established settle pattern (replayed-token after teardown)
- [Phase 46 P01]: mountTrackRuntime/removeTrackRuntime are the lifecycle primitives later plans call: teardown deletes the full 16-map inventory, the structural memo composite key, the trackRevisions entry, settles/expires the track's leases, and prunes alpha canvases only when unreferenced; returns true only when something changed
- [Phase 46 P01]: Spelling convention locked byte-exactly: all method names use 'Roto' (acquireRotorPhysicalOperationLease); the ONLY 'Rotor' symbol is getTrackRotorRevision — verified with ord-level dumps to kill the Roto/Rotor typo hazard
- [Phase 46 P01]: The bridge apply-side resolves the document's ACTIVE track for the parent tracer (launch IS the document — D-03); a carried request carries no trackId of its own, and a missing token yields 'missing-token' (not a throw) via `?.trackId ?? ''`
- [Phase 46 P02]: The projection boundary is multi-track: serializeRuntimeIntoDocument / hydrateRuntimeFromDocument iterate document.tracks by stable id — never tracks[0] (Pitfall 1); each track's runtime payload (frames via buildEfxPaintFrameCachePath(layerId, track.id, frame) + rotoPhysical) projects into that exact track; installRuntimeStateFromDocument fails closed when payload.trackId does not match the claimed trackId
- [Phase 46 P02]: Cache paths embed the raw UUID trackId between the stable layer segment and the file name (cache/efx-paint/<stableSegment>/<trackId>/frame-NNNNNN-NNNN.png, D-15 foundation) so track deletion can address exactly its own sidecars; every emitted path still passes isSafeEfxPaintCachePath (T-46-04, ASVS V12); no back-migration of legacy track-less sidecar paths (Phase 45 no-compat)
- [Phase 46 P02]: The save input / load output carry per-track frame maps (trackId → appFrame → frame); two tracks persist frames at the same appFrame without collision (edge TRK-03 ordering resolved explicit) and the loader's cross-track same-appFrame throw is gone; the save fingerprint byte terms include trackId (trackId:appFrame:dataUrl) so identical bytes on distinct tracks never dedupe incorrectly (T-46-06)
- [Phase 46 P02]: buildEfxPaintDocuments collects one per-track frame map per document.tracks entry keyed by trackId; the project-store hydrate seam passes per-track frames through unchanged; the save orchestrator shape (saveEfxPaintDocumentsWithProjectWrite(projectDir, documents, writeProject)) is untouched
- [Phase 46 P03]: The rail-set copy engine (buildRotoRailSetCopyPayload) gains source/target track context: the fresh-identity allocation produces new keyIds/loopIds (D-05); Hold clips pasted across tracks are re-pointed to the destination track's freshly allocated source frames; an unre-pointable Hold rejects the paste with a closed result — never a dangling or foreign-track reference (D-06)
- [Phase 46 P03]: Cross-track paste deep-copies the underlying source frame assets so the destination track is fully self-contained; the no-durable-asset-duplication contract applies only to linked repeats inside ONE Loop Clip (D-07)
- [Phase 46 P03]: moveTrackItems is implemented verbatim as D-09: cut (fresh-identity clipboard payload) then paste into the destination then delete from the source; a failed move returns ok:false and the source stays untouched; the destination identity is always fresh
- [Phase 46 P03]: The undo/redo ledger is one document-wide stack; each physical command carries the accepted edit's trackId; recordAcceptedEdit dedupes on operationId+trackId so one cross-track operation's per-track acceptances all record and same-opId/same-track duplicates still collapse (D-01)
- [Phase 46 P03]: Stored history snapshots are sanitized at record time: the cached repaint base is nulled and the four per-frame raster maps are emptied — records + refs + the prior deterministic revision hash only, never raster bytes (D-03); the undo/redo recompute path stays the single source of raster truth
- [Phase 46 P03]: undo()/redo() validate the live source against the entry's snapshot (existing snapshotReplayAuthorityEqual path) and, when the entry's trackId is not the document's active track, call the new efxPaintStore.setActiveTrackId FIRST so replay targets the live document (D-04); setActiveTrackId validates the track exists (fail closed) and bumps documentRevision via the 45-01 builders since activeTrackId is a docrev term
- [Phase 46 P05]: Track deletion is acknowledge-and-delete (TRK-07, D-14): requestDeleteTrack returns a closed TrackDeletePreview (frames, loop clips, Hold references to sever, isLastTrack) before any mutation; commitDeleteTrack refuses without the acknowledgement, for an unknown track, and for the last surviving Paint track (D-17) — a refused delete writes nothing and the active track never moves (ASVS V4)
- [Phase 46 P05]: The committed deletion runs severTrackHoldReferences → removeTrackRuntime (46-01 sweep: frames, records, loopClips, caches, selection/cursor, leases settled to 'replayed-token', structural memo composite key) then rebuilds the document re-projecting every survivor from the runtime (the runtime is the authority; severed Hold refs stay verbatim, D-31) and re-points activeTrackId directly in the rebuilt document (never setActiveTrackId — the single dirty-callback law); nearest-adjacent is next-first (D-18 executable test contract)
- [Phase 46 P05]: Sidecar deletion rides the tracked save transaction (D-15): EfxPaintDocumentSaveInput.deletions (validated by isSafeEfxPaintCachePath, ASVS V12) ride PreparedSave and are removed only in the settle commit arm — after the canonical publication settles, before the cache record; rollback never touches them; commitDeleteTrack registers the deleted track's cache/efx-paint/<stableSegment>/<trackId> dir in a pending list (takePendingTrackDeletions clears on read) that projectStore merges into the next save input
- [Phase 46]: .planning/phases/46-track-local-paint-roto-playscript-state-loop-clips-and-cache/46-05-SUMMARY.md
- [Phase 47 P03]: The right-panel Track section always shows the ACTIVE track — resolved inside the memoized build from getEfxPaintDocument(layerId).activeTrackId with efxPaintVersion.value in the memo deps, so a row-header click re-renders the panel to the new track (D-05 routing); rejections publish to the status capsule via setApplyMessage
- [Phase 47 P03]: The guarded shortcuts reuse the pointer-path handlers (handleAddTrack/handleDuplicateTrack relocated above the keyboard dispatch hook, TDZ-safe) so the strip '+', the duplicate icon, and Cmd/Ctrl+Shift+N/D all publish failures identically; the new branches skip on mutationLocked BEFORE preventDefault (a blocked shortcut never touches the event) — deliberately different from the pre-existing redo/undo branches; Delete/Backspace track deletion stays acknowledge-and-delete dialog-only (D-17), test-3 contract asserts no deleteTrack binding exists in the dispatch
- [Phase 47 P03]: The panel contract tests needed three RED-phase harness refinements before green (documented in 47-03-SUMMARY): array-children traversal in textContent, function-vnode expansion in childrenOf, and findById skipping function vnodes whose props.id mirrors the inner element's id — kept as separate test-only commits per the no-amend convention
- [Phase 47 P04]: The capsule's shortened/partial-cycle facts come straight from the resolver (range.truncated / range.partialCycle, D-32) and NEVER touch the requested badge (Pitfall m2): cycleLabel stays the REQUESTED duration ('Cycle 4f × 3 = 12f' / 'Cycle 4f × ∞') even when a next clip shortens the loop — shortened is a distinct visual + label ('Loop shortened by next clip', D-12/D-14 English); the diagonal cut renders only when partialCycle; repeatInstanceCount = floor(max(0, effectiveEnd − phaseOrigin)/cycleLength)
- [Phase 47 P04]: Capsule-never-math contract: the filmstrip capsule receives presentation + resolver-derived facts (sourceOffsets/sourceFrameCount/cycleLength/repeat) + geometry + cellWidth and never computes loop math; per-row capsule data comes from the store's memoized getTrackRotoResolutionContext(layerId, trackId) projected through the shared presentation module — no resolver math in the strip (grep gate); capsule paint mounts as a sibling with pointer-events: none at z-index 7
- [Phase 47 P04]: Background-row clips project through the new projectBackgroundFrameLoopClipCapsule (RESEARCH A3): FrameLoopClip is a document record (startFrame/sourceFrameRefs/repeat), not a Hold resolver input, so its projection reads clip facts only; infinite repeats are bounded by the visible frame window (T-47-04-03 DoS guard) and fully-outside clips return null
- [Phase 47 P04]: The interruption tooltip line ('next clip — interrupts the loop') is appended at tooltip index 5 right after Status; projectPhysicsPaintLoopClipFragmentPresentation re-slices 0..5 and intentionally drops it — fragment views are out of scope
- [Phase 47 P05]: The cross-track drag (TML-05, D-15/D-16) is a plain drag with NO modifier: any draggable (real key, Key Rail, Loop Clip Rail, rail-set member) crossing a row boundary exposes read-only destinationTrackId/insertionFrame/isCrossing signals (destination highlight + live insertion preview) and NEVER mutates any document during the gesture; the first row-boundary crossing takes pointer capture on the rows-region, so the same-row drag's source element receives lostpointercapture and cancels non-committing — same-row drags stay plain
- [Phase 47 P05]: The commit is a store port, not a callback: the release handler calls the injected moveTrackItems(layerId, fromTrackId, toTrackId, keys) exactly once and maps the result through buildCrossTrackMoveSuccessMessage ('Moved N key(s) to another track.') / mapCrossTrackMoveRejection (fixed English map: 'Track not found' / 'Destination frame is occupied' / 'Loop would be partially moved' / 'Nothing to move' / 'Key not found', generic 'Move failed.' fallback — D-14) — the hook never computes copy-paste-delete (D-09/D-17); rejections flip the capsule's red warning triangle via the newly forwarded bundle port setApplyStatus('error') (Phase 46 paste UX)
- [Phase 47 P05]: D-18 gesture separation is enforced by structure + resolver: the header reorder grab (47-02) lives OUTSIDE the rows-region so a grab-drag never reaches the cross-track pointerdown, and the source resolver only resolves content draggables (data-roto-key-id / data-rail-first-frame with the rail discriminator classes / rail-set move members — membership never re-derived); tests assert the grip handler contains no moveTrackItems/crossTrackDrag and a grab-area release never reaches the store
- [Phase 47]: .planning/phases/47-internal-multi-track-timeline-filmstrip-capsules-and-control/47-04-SUMMARY.md
- [Phase 47]: .planning/phases/47-internal-multi-track-timeline-filmstrip-capsules-and-control/47-05-SUMMARY.md
- [Phase 47 close-out]: The filmstrip capsule rendering layer was REMOVED by user demand in UAT Round 6 (commit 346d47bc) — the rails return to the locked Phase 43 surface and loop facts live in the rail tooltip only; the rail status dot became a 20x4px rectangle over the 4px line on ALL tracks with the synchronized #A6D334 / modified #FBBF24 / detached #BBC0C8 / unavailable #FF2E56 palette and a tooltip status swatch; the lifecycle reads the clip's own scriptId (never the resolved library name) so the active lane and non-active rows agree; the compositor-death watchdog's window.location.reload() is DISABLED by request (commit ce1008af) — the stall detection stays live as a cooldown-bounded console warn so a future compositor death is traceable and the reload can be re-enabled. Phase 47 UAT passed (round 7), 18/18 threats verified (47-SECURITY.md), 8/8 requirements Nyquist-validated (47-VALIDATION.md).
- [Phase 48]: 48-01: compositor cache ports are caller-opt-in (memo/trackRasterMemo/trackContentRevisions/backgroundClipRevisions optional in EfxPaintCompositorPorts) — uncached path byte-identical to Task 1; 48-03 supplies the complete cache group with store-owned memo lifetimes per layerId
- [Phase 48]: 48-01: flattened cache key wraps buildEfxPaintCompositeRevision output in encodeCanonicalString before hashing with config/track/bg/clip/frame terms; the unwired document.compositeRevision counter is never read (48-RESEARCH finding c)
- [Phase 48]: 48-01: per-track raster memo caches whatever resolution object the port produced (content OR missing) — the pure side never decodes dataUrls; decode lives store-side in 48-03 (D-07)
- [Phase 48]: mode 'progressive' unconditionally for Background clips: the resolver's static/progressive distinction is a Hold/PlayScript concern, not a Background one
- [Phase 48]: interpolationEnabled false for Background derivation: Background gaps reveal the document fallback, generated frames are never produced
- [Phase 48]: knownSources-miss report carries the single unresolved sourceRef; the 'linked-unresolved' defensive path stays for resolver dangling-refs
- [Phase 48]: Synthetic identities dedupe by keyId/appFrame at the resolver — cross-clip shared refs surface the duplicate-identity throw at derivation (fail-closed)
- [Phase 48]: Background port contract moves to the 48-02 source-ref union: resolveBackgroundFrame returns EfxPaintBackgroundFrameResolution (content carries clipId+sourceRef); new resolveBackgroundSourceImage(sourceRef) decode port (null = pending decode, transparent this tick); local raster-based EfxPaintBackgroundResolution type removed
- [Phase 48]: Flattened-key content terms cover participating tracks only (CMP-04): deriveEfxPaintFlattenedCacheKey filters trackContentRevisions through participatingPaintTracks — hidden/non-soloed track content edits never churn the flattened cache; config term covers visibility/solo so re-showing re-composites
- [Phase 48]: CMP-01/D-11 seam: getFlattenedFrame is the only content seam the main renderer/export uses for physic-paint layers; the main renderer never iterates internal tracks
- [Phase 48]: D-09 placeholder excision: missing sources are transparent in the flattened raster and surface via the Studio status capsule; the D-28 stripe fill is unreachable from the flattened path
- [Phase 48]: CMP-03/Pitfall 6: parent opacity/blend applied exactly once at the unchanged parent draw sites (50% x 50% = 25%); the compositor never reads parent layer properties
- [Phase 48]: CMP-05/P-48-4 retention: the export preflight stays a hard block, generalized to participatingPaintTracks(document); flagged for user confirmation at 48-06 UAT
- [Phase 48]: Parent project canvas dims (projectStore width/height) are the flattened raster size authority, with FALLBACK_COMPOSITE_SIZE 1920x1080
- [Phase 48]: Phase 48 P05: The program monitor consumes the SAME shared flattened seam as main preview and export (CMP-01) — its only math is 'which frame do I show'; no second composition path exists in the Studio
- [Phase 48]: Phase 48 P05: The monitor subscribes to BOTH physicPaintVersion and efxPaintVersion — the plan named only physicPaintVersion, but document-only mutations bump only efxPaintVersion; both clocks are required so hide/solo/blend edits AND document changes reflect
- [Phase 48]: Phase 48 P05: During playback currentFrame is constant, so the monitor resolves the playing frame through the per-tick playbackTick signal reference (38.1-D-01) — the literal getFlattenedFrame(layerId, currentFrame) instruction would freeze playback
- [Phase 48]: Phase 48 P05: The missing-source capsule publish reads the FULL including path (not excluding) so an active-track Hold source missing is still reported, gated on !isPlaying, compare-then-write in both directions
- [Phase 49]: White maps to the existing solid arm as { mode: 'solid', color: '#ffffff' } — the total parser/encoder round-trips it with zero information loss, so NO distinct 'white' literal is added (RESEARCH Open Q2 resolved by the Test 4 gate) — Round-trip gate passed with the solid arm; allow-list assertion locks the union to exactly transparent, solid, paper
- [Phase 49]: Hydration factored into a testable hydrateBackgroundSourceImages(document, ports) with injectable ports plus a production wrapper hydrateBackgroundSourceImagesFromLibrary — the plan's 'no new export unless the hydration helper is factored out' clause applied because the tests need the export
- [Phase 49]: Hydration wired into hydrateRuntimeFromDocument in efxPaintStore.ts (Rule 3 deviation — the plan's Task 3 files_modified listed only physicPaintStore.ts + test, but the hydrate seam lives in efxPaintStore.ts, already a plan-modified file)
- [Phase 49]: Registration is runtime-only: no documentRevision bump, no undo record, no dirty callback — re-saving a hydrated document produces an identical dedup fingerprint (BKG-09 save dedup proven by test)
- [Phase 49]: Unknown asset ids resolve to null and are skipped at hydration — the knownSources-miss path reports them (D-10 fail-closed), never a throw and never placeholder content
- [Phase 49]: Fond authority collapsed to the document fallback: _resolveDocumentFondInstruction reads ONLY document.background.fallback; the per-track _rotoBackgroundMetadata fond walk is deleted, not shadowed (Pitfall 1)
- [Phase 49]: Flattened cache key gains a dedicated fallback term via the exported canonical encoder (encodeCanonicalBackgroundFallback) — a fallback-mode change with an unchanged background.revision still rotates the key (BKG-09)
- [Phase 49]: Selector round-trip: backgroundModeToFallback maps each of the fixed five modes to exactly one fallback record; reflectFallbackToBackgroundMode derives the active segment from the document; same-mode dispatch is a revision-stable no-op (BKG-09)
- [Phase 49]: BackgroundSelectorMode = Exclude<BgMode, 'photo'> structurally excludes the Phase 50 photo mode from the fallback surface (D-11)
- [Phase 49]: Monitor fond + checkerboard consume the store's already-resolved plumbing: getDocumentFondInstruction + getBackgroundFrameVerdict reuse the flattened path's resolution, never a re-resolution in the Studio
- [Phase 49]: Clip-selection port for 49-06: onSelectBackgroundClip (strip prop) -> selectedBackgroundClipId (Studio signal) — the right-panel clip section (49-06) reads this signal
- [Phase 49]: Drag source identity lives in backgroundDragSourceRef (set in resolveSource, cleared in onCancel) because prepareAtDestination receives only the destination — the strip resolves the clipId itself
- [Phase 49]: Ghost width comes from resolver facts: range.effectiveEnd - range.phaseOrigin (never recomputed in the strip) — capsule-never-math carried
- [Phase 49]: The commit port is synchronous: moveBackgroundClip returns BackgroundClipMutationResult directly, so there is no commit-in-flight window — the UI-SPEC busy contract (aria-busy on rail targets) is structurally inapplicable; rejection preserves geometry/selection/focus and the capsule announces with role=alert
- [Phase 49]: Chunk budget raised 1180 -> 1190 following the documented measurement pattern (9th raise): the Bg row surface measured 1180.63 kB
- [Phase 50]: PhotoReferenceTrack field shape: source identity is an ordered readonly string[] of library asset IDs in natural-filename-sort order (D-02), mirroring FrameLoopClip.sourceFrameRefs; display preferences (visibleInStudio, opacity, transform, transformLocked) ride on the track itself.
- [Phase 50]: Document-mutation fields (id, sourceFrameRefs, mode, revision) enter the canonical revision term; display-preference fields (visibleInStudio, opacity, transform, transformLocked) are validated but EXCLUDED from the encoder (D-07 vs D-11/D-12/D-13 split).
- [Phase 50]: The reserved 'photo' fond mode stays absent from the PhotoReferenceMode union (D-08); the parser rejects it fail-closed.
- [Phase 50]: Photo reference setters split: setPhotoReferenceSource/Mode are undoable document mutations (bump track revision + documentRevision, record by reference); setPhotoReferenceVisible/Opacity/Transform/TransformLocked are display preferences (no undo, no revision bump).
- [Phase 50]: Reference registry is a PARALLEL _referenceSourceImages map (independent of Background clip lifecycle); registerReferenceSourceImage bumps physicPaintVersion but never clears the flattened memo (D-06).
- [Phase 50]: _referenceSourceRevision preserves sourceFrameRefs ORDER (frame N → refs[N], D-15) — unlike _backgroundSourceRevision which sorts a deduped set.
- [Phase 50]: Reference picker is a second useBackgroundAssetPickerController instance sharing a ports object; only the Confirm handler (replace vs add-clip) and title differ
- [Phase 50]: Confirm replaces the source via setPhotoReferenceSource with natural-sorted ids (D-02); the replacement capsule note uses publishOperationResult, not setApplyMessage
- [Phase 50]: BackgroundAssetPickerView gained a title prop (default Import background images) so the same region swap serves both pickers (D-01)
- [Phase 50]: The reference ghost is a canvas draw (drawReferenceGhost(ctx, document, frame, zoom, isPlaying)) rather than an <img> like the onion overlay — the display transform (position/scale/rotation, D-13) requires canvas translate/rotate/scale
- [Phase 50]: shouldDrawReferenceGhost bridges getReferenceSourceFrameVerdict through document.parentLayerId (the store function takes a layerId, not a document); the missing-source condition is computed separately (track exists AND verdict null)
- [Phase 50]: zoom = paperTextureScale (project→working scale) so the reference image (project resolution) fits the working canvas; the ghost layer is a dedicated leaf canvas mounted at z-index 5 above the composite
- [Phase 50]: The missing-source report uses the existing status capsule (setApplyStatus('error') + 'Missing reference source — use Replace source to re-link.'), independent of the visibility preference
- [Phase 50]: The transform handles are a dedicated component (PhysicsPaintReferenceTransformHandles) + a pure geometry module (getReferenceBounds), NOT inlined into the Studio — the geometry is testable in isolation and the component follows the ghost layer's narrow-leaf pattern
- [Phase 50]: getReferenceBounds computes the SAME bounding box the ghost draws: natural project resolution scaled by zoom (paperTextureScale) to working space, centered at (canvasWidth/2 + x*zoom, canvasHeight/2 + y*zoom), then rotated by rotation and scaled by scaleX/scaleY — no aspect-fit, no crop
- [Phase 50]: The image dimensions are decoded async via new Image() from the frame-aligned verdict's dataUrl and held in a useSignal (no useState); a missing track/verdict/decode failure clears the size fail-closed (no handles without a resolved source, D-04)
- [Phase 50]: The section ports route mode → setPhotoReferenceMode (undoable mutation), opacity → setPhotoReferenceOpacity, lock → setPhotoReferenceTransformLocked (display preferences, no undo) — the mutation vs display-preference split holds at the right-panel boundary (T-50-05-01)
- [Phase 50]: Escape re-lock is a keyboard action (relockReferenceTransform) returning true only when the transform was actually unlocked, layered between the solo disarm and selection collapse so one Escape handles at most one layer (Pitfall 2)
- [Phase 50]: The persistence round-trip asserts on parsed.photoReference deep-equal to the pre-save track — the photoReference field rides the ...document spread in serializeRuntimeIntoDocument, so the round-trip is structural and the only genuinely new persistence work was already proven in Plan 50-02.
- [Phase 50]: The D-06 non-regression is a token allow-list scan over the four raster surfaces (compositor, flattenedCache, previewRenderer, exportRenderer) — fourteen reference-input tokens must not appear in any of them.
- [Phase 50]: The end-to-end contract consolidates the per-plan wiring assertions (50-03 picker, 50-04 ghost, 50-05 section/transform/Escape) into one integration proof, plus the save/reopen seam (hydrateReferenceSourceImagesFromLibrary).
- [Phase 52]: Reveal bake rides the shared compositor at the WORKING canvas size (getPhysicsPaintWorkingSize), not project size — script strokes live in working coordinates; compositeRevealMask reproduces the ghost draw math (image*zoom, center + transform*zoom) so baked keys overlay the reference ghost pixel-perfectly (G-52-2a).
- [Phase 52]: Reveal creation lives in the Create Rail dialog's Reveal Photo Rail tab (Paint Rail / Reveal Photo Rail tab strip, apply mode only) — the Photo Reference modal is a pure reference control surface; the reveal tab routes through the same commitRevealBake mutation (creation IS the first bake) and rides the dialog's phase/abort machinery so Cancel generation aborts mid-span with no keys written (G-52-3).
- [Phase 52]: The alpha-canvas registry OWNS any canvas registered into it (session-lifetime) — no caller may release/resize/mutate a registered canvas; the compositor's registry-first branch only accepts non-zero-size entries (fail-soft) so a poisoned 0x0 canvas can never throw InvalidStateError on drawImage (G-52-10).
- [Phase 52]: The canonical content fingerprint uses a content TOKEN (length + head-64 + tail-64, O(1)) instead of the full payload dataUrl — head+tail is change-safe for same-encoder PNG output because deflate streams have no resync points; the Rust boundary mirrors the token and the parity pin holds (G-52-6).
- [Phase 52]: Photo-weight baked keys decode OFF the main thread (dataUrl → Blob → createImageBitmap, with Image + await img.decode() fallback) and the flattened record carries the composite raster with a LAZY dataUrl getter — the draw path never pays a PNG encode/decode round-trip (G-52-7/G-52-8).

### Pending Todos

None yet.

### Blockers/Concerns

- Research flags for planning: exact `.mce` v1.0 schema field-level design (Phase 45), opacity/blend application order + full pixel acceptance matrix enumeration (Phase 48), track-aware `paintVersion` reactivity model (Phase 46).
- v0.9.0 audit-accepted tech debt and deferred items carried forward (see Deferred Items below).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260827-s52 | NLE ruler seek + playhead bar (Physics Paint Studio timeline) | 2026-08-27 | bbb1908a | [260827-s52-nle-ruler-seek-playhead-bar-physics-pain](./quick/260827-s52-nle-ruler-seek-playhead-bar-physics-pain/) |
| 260902-cfa | Wire the ruler seek to the audio monitoring path (Phase 51 scope) | 2026-09-02 | 7af5382f | [260902-cfa-wire-the-ruler-seek-to-the-audio-monitor](./quick/260902-cfa-wire-the-ruler-seek-to-the-audio-monitor/) |
| 260902-cfa-amendments | D-01 Play cursor re-anchor + D-02 audible scrub + loop-wrap-at-scrub (Phase 51 scope) | 2026-09-02 | 982a343e | [260902-cfa-amendments](./quick/260902-cfa-amendments/) |
| 260905-d1w | Workflow strip action-row layout: + Rail beside + Key with the same gating, Push after + Rail, Solo relocated icon-only beside Loop (+ amendment: Paste after Copy, + Rail extended gating) | 2026-09-05 | 3cc6a108 | [260905-d1w-workflow-strip-action-row-layout-rail-be](./quick/260905-d1w-workflow-strip-action-row-layout-rail-be/) |

### Roadmap Evolution

- Phase 51 edited: marked delivered via quicks 260902-cfa + 260902-cfa-amendments (no full phase cycle)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Persistence | DF-01: `.mce` save and fixed-path Physics Paint cache publication are not one cross-resource transaction | Non-blocking `NEW_SCOPE_FROM_VERIFIER` | Phase 43.1 closure, 2026-08-10 |
| Persistence | DF-02: native cache publication does not sync the containing directory after rename/exchange | Non-blocking `NEW_SCOPE_FROM_VERIFIER` | Phase 43.1 closure, 2026-08-10 |
| Loop Clips | DF-03: provenance-only Loop Clip replacement can be treated as a no-op | Non-blocking `NEW_SCOPE_FROM_VERIFIER` | Phase 43.1 closure, 2026-08-10 |
| Security | DF-04: browser frame-sync does not authenticate `postMessage` origin, source window, or launch identity | Non-blocking for Phase 43.1 | Phase 43.1 closure, 2026-08-10 |
| macOS distribution | Developer ID signing, notarization, stapling, and Gatekeeper validation | Preparation complete in quick 260730-mn0; credentialed release scheduled for v1.0.0 Phase 53 | v0.8.0 closure |
| Architecture | Headless batch adapter replay / editor-driven renderFromStrokes / forceDryAll path | Excluded | v0.7.0 failure post-mortem |

## Session Continuity

Last session: 2026-09-04
Stopped at: Phase 52 complete, ready to plan Phase 53
Resume file: None
