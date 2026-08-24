---
gsd_state_version: 1.0
milestone: v1.0.0
milestone_name: EFX Paint Multi-Track Frames and Reveal
current_phase: 47
current_phase_name: Internal Multi-track Timeline, Filmstrip Capsules, and Controls
status: executing
stopped_at: Phase 47 UI-SPEC approved
last_updated: "2026-08-24T16:01:08.520Z"
last_activity: 2026-08-24
last_activity_desc: "Phase 46 plan 05 complete (acknowledged track deletion: closed preview, teardown, hold severing, nearest-adjacent activation, transactional sidecar removal)"
state_head: 722e745eaae7c5ea657999b2bf12f1f6f7b508d9
progress:
  total_phases: 9
  completed_phases: 1
  total_plans: 19
  completed_plans: 14
  percent: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-23 after v1.0.0 milestone start)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 46 — Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches

## Current Position

Phase: 47 (Internal Multi-track Timeline, Filmstrip Capsules, and Controls) — READY TO EXECUTE
Plan: 6 of 6 complete (46-06); next Phase 47
Status: Ready to execute
Last activity: 2026-08-24 — Phase 46 plan 06 complete (track-local Hold resolution context, single-source linked resolution with atomic per-track invalidation, fail-closed Hold creation refs validation)

Progress: [█░░░░░░░░░] 11%

## Performance Metrics

**Velocity:**

- Total plans completed: 13 for v0.9.0 (12 phases, shipped 2026-08-21)
- Average duration: N/A
- Total execution time: N/A

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 45. New EFX Paint Document and Clean Cutover | 5 | TBD | - |
| 46. Track-local Paint/Roto/PlayScript State, Loop Clips, and Caches | 3 | TBD | - |
| 47. Internal Multi-track Timeline, Filmstrip Capsules, and Controls | 0 | TBD | - |
| 48. Internal Compositor and Flattened Parent Result | 0 | TBD | - |
| 49. Fixed Background Track and Imported Loop Clips | 0 | TBD | - |
| 50. Photo/Reference Track | 0 | TBD | - |
| 51. Read-only Audio Preview | 0 | TBD | - |
| 52. Shared Mask Compositor and Reveal | 0 | TBD | - |
| 53. Integrated v1.0.0 Acceptance | 0 | TBD | - |
| 45 | 8 | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

- Research flags for planning: exact `.mce` v1.0 schema field-level design (Phase 45), opacity/blend application order + full pixel acceptance matrix enumeration (Phase 48), Reveal result track semantics (Phase 52), track-aware `paintVersion` reactivity model (Phase 46).
- v0.9.0 audit-accepted tech debt and deferred items carried forward (see Deferred Items below).

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

Last session: 2026-08-24T15:24:49.913Z
Stopped at: Phase 47 UI-SPEC approved
Resume file: /Users/lmarques/Dev/efx-motion-editor/.planning/phases/47-internal-multi-track-timeline-filmstrip-capsules-and-control/47-UI-SPEC.md
