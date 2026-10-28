---
gsd_state_version: "1.0"
milestone: v2.0.0
milestone_name: Multi-Module Paint Workstation (MAJOR)
current_phase: 56
status: completed
stopped_at: Completed 261024-mz5-PLAN.md
last_updated: "2026-10-28T14:56:38.403Z"
last_activity: 2026-10-27
last_activity_desc: Quick task 261027-klx closed — engine-1 Brush module removed; native UAT approved 2026-10-27
state_head: 234655adbb7a061f225fd14327c3030aae272132
progress:
  total_phases: 3
  completed_phases: 3
  total_plans: 26
  completed_plans: 26
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-14 after milestone v2.0.0 started)

**Core value:** Users can import key photographs, arrange them into timed sequences with FX layers, preview in real-time, and export as PNG image sequences — the complete stop-motion-to-cinema pipeline must work end-to-end.
**Current focus:** Phase 56 — efx-watercolor (engine 2, paint-aquarelle, clean-room)

## Current Position

Phase: 56 — COMPLETE
Plan: 11/11 complete
Status: All phases complete — milestone v2.0.0 awaiting dev verification, QUICK-01, and milestone close
Last activity: 2026-10-28 - Quick 261028-k03 CLOSED after native UAT. k03b shipped (5c81d9b9, 729a4896, 6e8ad48b: script-authoritative Lift, live preview, strength, Select lifts). UAT failed: scripted Lift refuses (old project's SNAP v5 durable-base section is empty) and raster-only Lift erase is lost on frame leave/return. Follow-up quick 261028-k03c required: base recovery, capture fencing/commit retry, true-shape cursor, sidebar Brush tab + tip/shape for Brush and Lift (default Filbert).

Progress: [██████████] 100%

**v2.0.0 phase map (locked 2026-10-14; revised 2026-10-21):**

- 54 Preact 11 (RUN-01..06) → 55 efx-paint-host (HOST-01..05 + DATA-01..04) → 56 efx-watercolor (AQUA-01..08 + PAPER-01..04 + MOD-01..06)
- `packages/efx-spectral` (SPEC-01..05) was delivered early inside Phase 56 through the dependency hook; **Phase 57 is retired** (no standalone spectral phase). Engine-1 adoption remains a future milestone concern.
- Hard gate: 54 live UAT closes before 55 opens
- QUICK-01 audio-trim-to-view is an in-milestone quick, never a phase

## Performance Metrics

**Velocity:**

- Total plans completed: 86 for v0.9.0 (12 phases, shipped 2026-08-21)
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
| 52.3 | 3 | - | - |
| 52.4 | 4 | - | - |
| 52.5 | 3 | - | - |
| 53 | 5 | - | - |
| 54 | 5 | - | - |
| 55 | 10 | - | - |
| 56 | 11 | - | - |

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
| Phase 52.1 P01 | 2 min | 2 tasks | 5 files |
| Phase 52.1-modern-frame-runtime-native-hd-paint P02 | 35 | 2 tasks | 6 files |
| Phase 52.1 P04 | 19 | 4 tasks | 9 files |
| Phase 52.1 P05 | 0min | 2 tasks | 7 files |
| Phase 52.1 P06 | 0min | 2 tasks | 6 files |
| Phase 52.2 P01 | 8min | 3 tasks | 9 files |
| Phase 52.2 P02 | 22min | 3 tasks | 22 files |
| Phase 52.2 P03 | 63min | 3 tasks | 11 files |
| Phase 52.2 P04 | 9 | 3 tasks | 6 files |
| Phase 52.2 P05 | 25min | 3 tasks | 9 files |
| Phase 52.2 P06 | 11min | 3 tasks | 8 files |
| Phase 52.2 P07 | 54min | 3 tasks | 13 files |
| Phase 52.2 P08 | ~45min | 3 tasks | 12 files |
| Phase 52.2 P09 | ~31 min | 3 tasks | 14 files |
| Phase 52.2 P10 | 30min | 3 tasks | 10 files |
| Phase 52.2 P11 | 16min | 3 tasks | 9 files |
| Phase 52.2 P12 | 1h53min | 3 tasks | 10 files |
| Phase 52.2 P13 | 7 | 4 tasks | 35 files |
| Phase 52.2 P14 | 46 min | 2 tasks | 15 files |
| Phase 52.2 P15 | 10min | 2 tasks | 6 files |
| Phase 52.3 P01 | 22min | 3 tasks | 12 files |
| Phase 52.3 P02 | 13min | 2 tasks | 4 files |
| Phase 52.3 P03 | ~15 min + UAT | 2 tasks | 0 files |
| Phase 260921-bjm P260921-bjm | 12min | 3 tasks | 11 files |
| Phase quick-260923-bcm P260923-bcm | 40min | 3 tasks | 34 files |
| Phase quick-260924-d6l P260924-d6l | 9min | 3 tasks | 3 files |
| Phase 52.4 P01 | 47min | 3 tasks | 10 files |
| Phase 52.4 P02 | 68min | 3 tasks | 4 files |
| Phase 52.4 P03 | 30min | 3 tasks | 3 files |
| Phase 52.4 P04 | 98min | 3 tasks | 4 files |
| Phase quick-260930-wm6 P260930-wm6 | 41m | 3 tasks | 12 files |
| Phase 52.5-physic-paint-document-sound-track P01a | 78min | 3 tasks | 26 files |
| Phase 52.5 P01b | 2h40m | 3 tasks | 26 files |
| Phase quick-261009-6ee P261009-6ee | 45m | 2 tasks | 15 files |
| Phase quick-261009-rko P261009-rko | 28 | 2 tasks | 18 files |
| Phase quick-261009-rko P261009-rko | 15 | 2 tasks | 18 files |
| Phase quick-261009-v0s P261009-v0s | 9min | 2 tasks | 8 files |
| Phase quick-261010-bkv P261010-bkv | 29 | 3 tasks | 12 files |
| Phase quick-261010-en9 P261010-en9 | 14min | 3 tasks | 28 files |
| Phase quick-261010-g2n P261010-g2n | 11min | 3 tasks | 8 files |
| Phase quick-261010-ht0 P261010-ht0 | 780 | 3 tasks | 29 files |
| Phase 53.1 P53.1-01 | 31 | 2 tasks | 28 files |
| Phase 53.1 P53.1-02 | 31 | 3 tasks | 7 files |
| Phase 53.1 P53.1-03 | 16min | 2 tasks | 31 files |
| Phase 53.1 P53.1-04 | 14min | 2 tasks | 5 files |
| Phase 53.1 P53.1-05 | 20 | 3 tasks | 12 files |
| Phase quick-261013-ctd P261013-ctd | 7min | 2 tasks | 3 files |
| Phase 54 P54-01 | 9min | 2 tasks | 3 files |
| Phase 54 P54-02 | 6min | 1 tasks | 1 files |
| Phase 54 P54-03 | 11min | 3 tasks | 6 files |
| Phase 54 P54-04 | 13min | 2 tasks | 20 files |
| Phase 54 P54-05 | 5min | 2 tasks | 1 files |
| Phase 55 P55-01 | 10min | 2 tasks | 2 files |
| Phase 55 P55-03 | 20min | 2 tasks | 5 files |
| Phase 55 P55-09 | 7min | 1 tasks | 1 files |
| Phase 55 P04 | 4min | 2 tasks | 5 files |
| Phase 55-efx-paint-host-engine-1-host-split P05 | 19min | 2 tasks | 17 files |
| Phase 55 P55-06 | 14min | 2 tasks | 6 files |
| Phase 55 P55-07 | 25min | 3 tasks | 10 files |
| Phase 55-efx-paint-host-engine-1-host-split P08 | 12min | 1 tasks | 2 files |
| Phase quick-261017-iwm P261017-iwm | 22min | 2 tasks | 4 files |
| Phase quick-261017-vcn P261017-vcn | 17min | 2 tasks | 10 files |
| Phase quick-261017-xa0 P261017-xa0 | 17 | 2 tasks | 7 files |
| Phase quick-261018-cy1 P261018-cy1 | 8min | 3 tasks | 14 files |
| Phase quick-261018-f15 P261018-f15 | 23 | 3 tasks | 16 files |
| Phase quick-261018-gqo P261018-gqo | 8min | 3 tasks | 12 files |
| Phase quick-261018-odm P261018-odm | 12min | 4 tasks | 8 files |
| Phase quick-261024-mz5 P261024-mz5 | 19 | 3 tasks | 23 files |

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
- [Phase 52.1]: Corrected plan target versions to actual latest (api 2.11.1, cli 2.11.4, tauri-build 2.6.3, plugins independent latest; only Rust tauri crate has 2.11.5)
- [Phase 52.1]: Raised root pnpm overrides (preact ^10.29.8, @preact/signals ^2.11.2) so the bump is not pinned back
- [Phase 52.1]: Encode via encode_advanced with exact=1 (config_exact), not encode_lossless() which does not set exact
- [Phase 52.1]: Use direct invoke (not safeInvoke) so raw Uint8Array return is explicit and acceptance grep invoke( matches
- [Phase 52.1]: Keep bytesToBase64/base64ToBytes — deletion is Plan 03's apply-path retarget
- [Phase 52.1]: rotoAlphaCanvasRegistry stays (canvas registry for interpolation/reveal bake, not a decode cache); only _compositorImageCache absorbed into the LRU
- [Phase 52.1]: decode_webp_frame takes bytes (not a path), so fetch-on-demand is deferred to Plan 05; Plan 04 decode path is invoke(decode_webp_frame, { bytes })
- [Phase 52.1]: prefetchNeighborFrames wired via an optional prefetchNeighbors callback on useRotoNavigationCoordinator (layer-agnostic); the Studio closes over launchContext.layerId
- [Phase 52.1]: ImageData exists only as the transient IPC-to-bitmap bridge, never stored
- [Phase 52.1 close]: Plan-04 TDD deviation (tests bundled inside feat commits, no RED-first history) receives a conscious `--force-mvp-gate` override at phase close, on the record (52.1-04-SUMMARY "Phase-close override" + 52.1-07-SUMMARY)
- [Phase 52.1 close]: The chunk budget stays at 1300 kB — NOT raised. Main chunk 1305.11 kB (13.68 kB over the 1291.43 kB baseline). Attribution via a pre-phase baseline build against the bumped node_modules (1296.24 kB): ~4.8 kB dep bumps (+ intervening quicks) + ~8.9 kB 52.1 feature code — the overage is NOT purely dep-bumps-only; documented and left red pending user sign-off on any future raise
- [Phase 52.1 close]: Plan-07 native roto UAT signed off on feeling (drag, paint-burst, general fluidity); the numeric docSync count was declined by the user — validation recorded as feeling-based
- [Phase 52.2]: Rule 3: tauri 2.11.5 Response has no header API — the frame-media read leg returns a base64 JSON envelope with bytesBase64 instead of bytes+response headers; plans 07/09 build on this wire contract (coverage item D6, human review).
- [Phase 52.2]: One uniform EfxPaintMediaError (Rejected variant | Io) serialized as a single fixed label so no path or io detail reaches the renderer.
- [Phase 52.2]: Two-guard asymmetry: the media lock stays frames/ + .webp-only; the save transaction's resolve_package_bound_path carries its own allowlist and delegates every frames/ entry back to the media code path.
- [Phase 52.2]: Rule 3 deviation (52.2-02): the persisted payload mode is selected at the on-disk read door (loadEfxPaintDocuments), not inside parseEfxPaintDocument — the same entry point validates live in-memory documents on the save/fingerprint/launch paths, so an unconditional rule caused 116 failures. payloadMode defaults to 'runtime'; exactly one non-test call site passes 'reference-only'.
- [Phase 52.2]: 52.2-02: one record type, two carriers — bytes is optional with media (FrameMediaReference: frames/<layerId>/<keyId>.webp + 64-hex digest) as the alternative. buildPhysicPaintRotoPayloadContentToken is total over both shapes (byte token | media digest) so revision/equality/dedup never dereference the raster carrier; requirePhysicPaintRotoInlineBytes throws at every runtime pixel projection (Law 1).
- [Phase 52.2]: 52.2-03: numeric fields use one shared NumericStepper (type=text + inputMode=decimal, single clamp+round commit path, hold-to-repeat 400ms/60ms); per-field step/min/max preserved; numericStepperSweep source-scan contract over 6 files with a length-asserted list
- [Phase 52.2]: 52.2-03: typed values commit on blur/Enter + -/+ buttons (shared gesture) instead of per keystroke; ColorPickerModal channel commits take a single-channel override; the Hold Frames popover reads its field text back on close so an uncommitted typed value is not lost
- [Phase 52.2]: 52.2-04: the solo content start is a lazy getter (getSoloContentStart) returning null when no solo is active — arming the pill does not re-render the Studio, so a captured value would be stale at Play press; null keeps the Phase 51 play-from-cursor branch byte-for-byte
- [Phase 52.2]: 52.2-04: the solo content start is resolved once and assigned to BOTH frameIndexRef and loopStartIndexRef — the wrap branch reads loopStartIndexRef, so the single assignment is what makes every loop iteration return to the isolated content start (D-22)
- [Phase 52.2]: 52.2-04: one Studio closure (resolveSessionSoloWindow) serves both the playback filter (getSoloWindow) and the D-21 content start, so the pil's window derivation and the start seam can never drift; row-S reads the document soloed tracks + physicPaintStore.getRotoRealKeyRecords filtered to those ids, capacity = composite end frame
- [Phase 52.2]: 52.2-05: the cache leg no longer binds a project write at all — a cache marker found at open is always rolled back, and no project write carries a cache transaction id (D-05/D-14)
- [Phase 52.2]: 52.2-05: marker/entry structs stay snake_case because the marker's on-disk shape is untrusted input; the renderer-facing DTOs are camelCase command structs (BoundPackageFileSet)
- [Phase 52.2]: 52.2-05: Save As holds ONE transaction open across the active-path migration (publish → migrate → commit | rollback), so a migration failure restores the previous destination through the transaction's own rollback (T-52.2-18)
- [Phase 52.2]: 52.2-05: physicPaintCacheTransactionId is dead by design in both TS project-save signatures — plan 07 Task 3 stops passing it, plan 09 deletes the declaration; nothing may leave it in shipped code
- [Phase 52.2]: 52.2-05: the cache producers' conversion to the machine cache root (efxPaintStore.ts + the efxPaintPersistence.ts guard) is plan 07 Task 2 and was deliberately not pre-empted
- [Phase 52.2]: 52.2-06: resolveRef is OPTIONAL on serializeRuntimeIntoDocument — the roto media projection engages only when the package-write caller supplies digests; live Studio push, sibling sync and undo paths keep bytes
- [Phase 52.2]: 52.2-06: toRuntimeRotoRecords passes a live bytes-carrying record through untouched and rebuilds a media-carrying one as an immutable media-only record — never allocates a byte buffer
- [Phase 52.2]: 52.2-06: hydrate refuses a carrier-less roto record by keyId BEFORE the canonical parse (the parser's refusal is generic and cannot name the record)
- [Phase 52.2]: The staged media path joins the bound set: the publish set IS the bound set, so no reference can outlive its bytes (T-52.2-21)
- [Phase 52.2]: An empty change set returns without touching the package but still runs the derived-frame cache leg — a repaint moves frames without moving document tokens (D-11/D-14)
- [Phase 52.2]: Both save call sites pass project + path only; the dead cache transaction id parameter is scheduled for removal in plan 09 Task 1
- [Phase 52.2]: 52.2-08: the refusal gate keys on formatVersion with four terminal reasons in fixed precedence (not-a-package-manifest → old-project-layout → missing-format-version → unsupported-format-version{found,required}); all four render the identical blocking no-recourse dialog; the openProject call site passes pathKind:'directory'
- [Phase 52.2]: 52.2-08: the Rust MceProject had to declare formatVersion/projectId/efxPaint in the same task as the carrier deletion — serde drops undeclared keys, so without them plan 07's manifest would lose all three on every save
- [Phase 52.2]: 52.2-08: efx_paint_documents is kept in both models and in openProject's read (unreachable behind the gate) — plan 09 Task 2 deletes it together with wiring the layers/<layerId>.json reader; app/src/lib/ipc.ts joined the frame-transport allowlist because base64ToBytes is the package media read leg plan 09 depends on
- [Phase 52.2]: 52.2-08: the rescue converter emits empty documentRevision/compositeRevision (the codebase's 'recompute' sentinel — the canonical revisions need the app's parser graph) and drops pre-52.2 derived-frame cache refs (machine-local, D-14) rather than rewriting them
- [Phase 52.2]: 52.2-09: media LRU keyed by persisted digest (same raster referenced by several keys decodes once); mismatch refused before decode and before any LRU write
- [Phase 52.2]: 52.2-09: missing/refused media draws the Phase 49 slate with the reference named — never an invented placeholder; verdicts are terminal per digest so failed reads are not re-issued per tick
- [Phase 52.2]: 52.2-10: the receiver's digest decision runs BEFORE the document's revision guard — a re-pushed unchanged document may still carry bytes the receiver lost
- [Phase 52.2]: 52.2-10: bridged raster bytes are held undecoded in _frameMediaBytes and enter the frame LRU only when the compositor actually needs the frame (byte copy dropped on decode)
- [Phase 52.2]: 52.2-10: the main→Studio frame-media request ships as a Tauri-guarded protocol signal only — the responder rides the sender's queue, deferred to plan 14 (pilot)
- [Phase 52.2]: 52.2-11: the .mce document-type declaration lives in exactly ONE file (app/src-tauri/Info.plist) — Tauri's plist merge is a shallow top-level overwrite and bundle.fileAssociations cannot express LSTypeIsPackage
- [Phase 52.2]: 52.2-11: toPackageManifestPath is the single package-directory -> manifest-file conversion (OS/dialog paths name the package, projectStore reads the file inside it); shortcuts.ts:95 + WelcomeScreen.tsx:168 still pass raw paths — deferred-items, no scheduled owner
- [Phase 52.2]: 52.2-11: the Finder one-icon/double-click and the rfd dialog package treatment stay PENDING until plan 52.2-16's bundled UAT (tauri dev carries no Info.plist)
- [Phase 52.2]: Gate 2 CLOSED 2026-09-12: SPECS/async-conventions.md approved; plans 52.2-13 and 52.2-14 unblocked; no XState/Effect code or dependency exists
- [Phase 52.2]: XState v6 alpha 6.0.0-alpha.53 stands per locked D-15; plan 13 re-verifies dist-tags + breaking changes at pilot start; SPECS/phase-52.3-async-conventions.md is superseded and void (user-owned deletion)
- [Phase 52.2]: Void-numbers branch resolved: if the post-format re-capture already meets T1-T3, the pilot is admitted on T4/T5 + inspectability (rows 1-4 architectural problems survive the format change, answering D-17(a)); the honest-failure clause then evaluates T4 + T5 only
- [Phase 52.2]: Verdict table approved as-is; NEITHER ('neither library here, and nowhere yet') remains the default everywhere else
- [Phase 52.2]: BEFORE render-churn capture is a user-side action on the current dev build (efx.physicsPaint.profile), to run before any pilot code lands (plan 52.2-14)
- [Phase 52.2]: 52.2-13: chunk budget raised 1320 -> 1340 kB (measured 1,326.36 + ~13.6 kB headroom) — pre/post-install builds emitted the byte-identical index-knu_IwqL.js main chunk, so the pinned xstate/effect install's delta is 0.00 kB and the raise is attributed to the already-landed 52.2 format work (plans 08-12), never to pilot code
- [Phase 52.2]: 52.2-13: xstate 6.0.0-alpha.53 + effect 4.0.0-rc.115 installed --save-exact and left unimported (zero imports in app/src); pilot library imports stay behind the PhysicsPaintStudio lazy boundary. Pilot-start re-verification (D-15) recorded in SPECS/async-conventions.md: pins unchanged, five v6 breaking changes recorded (guard signature last), no Preact binding, @effect/platform still absent for v4
- [Phase 52.2]: 52.2-13: scripts/verify-async-api-surface.ts is the installed-surface API gate (D-17) — the doc's import bindings, cited-but-not-imported names, removed-creator absence and dotted members all resolve against the shipped .d.ts; audit result zero unresolved names, zero corrections; effect-ts skill 0.6.5 installed (v4 default, upstream effect@4.0.0-beta.92 older than the pin, so the installed .d.ts is authoritative)
- [Phase 52.2]: Failures are data, not fiber death: Effect v4 tryPromise's catch maps into the typed ERROR channel, so produce/commit run as never-rejecting Effect.promise thunks returning a discriminated result
- [Phase 52.2]: The machine's wait IS the yield: the queue always awaits waitUntilDrainable (a macrotask when already drainable) so a turn never produces ahead of work submitted later in the same task
- [Phase 52.2]: Settle-through interruption: interrupt() cancels live turns but each turn resolves its own settlement promise, and a cancelled turn's commit is never called
- [Phase 52.2]: D-19 proven by measurement: main chunk byte-stable at 1,326.43 kB (budget 1340); the only xstate/effect imports in app/src are the two pilot modules; app/src/lib untouched
- [Phase 52.2]: The pipeline's queue port is a forced capture-queue drain (drain/interrupt), not flushLivePixels: the port settles the gesture's queued captures BEFORE the caller's steps, while parent deliveries and their retries stay inside step 2 (52.2-15).
- [Phase 52.2]: flush() returns the SAME in-flight promise to every concurrent caller: overlapping requests (or a close during a requested flush) produce one drain, one push and one shared outcome (T-52.2-54, 52.2-15).
- [Phase 52.2]: The pipeline never rejects - a throwing step resolves failed with the error attached and an interrupted drain resolves interrupted - so the shared Studio runner rethrows for the callers whose contract is a rejection (52.2-15).
- [Phase 52.2]: Interruption races the forced port drain against an interrupt wake, so a port whose work never settles cannot wedge Save/Export (T-52.2-48); the facade's unchanged 5 s timeout stays the outer bound (52.2-15).
- [Phase 52.2]: The delivery retry is one beginFlush-wrapped pilot queue turn whose produce re-schedules only the narrowed per-identity entry and whose commit waits out that delivery chain - queue owns concurrency, coordinator keeps owning identity (52.2-15).
- [Phase 52.2]: 52.2-16 CLOSED phase execution — bundled session 2026-09-18 (bundle facf1351, subject the rebuilt §7-pair at ~/Desktop/efx-motion-editor-project-test/v1.0.0.mce): rows 1-5 PASS (ONE Finder icon warm+cold with the unsaved-changes guard; file-style dialogs, no directory fallback; changed-media-only saves + autosave with no bind modal; stroke train smooth, finalization catches up during idle pauses; both solos content-start with identical wraps; steppers click/hold/keyboard/clamp) + the converted-fixture open PASS (2 keys, near-blank canvas expected)
- [Phase 52.2]: 52.2-16 converter proof — one run on the committed fixture (app/src/efx-paint/document/__fixtures__/pre-52.2-project.mce.json → /tmp/efx-52.2-16-rescue/pre-52.2-project.mce): 2 layers / 2 keys / 5 files written / 0 skipped / 0 failed; source sha256 52f22844…f190 unchanged before and after (re-verified 2026-09-18); mechanics-not-scale recorded (the user's 37 MB original was discarded 2026-09-14)
- [Phase 52.2]: 52.2-16 D-25 numbers (dev runtime of the shipped commit; bundle emits no telemetry by design): finalization median 113 ms (pre ~900 ms); input delay median 16 / p95 104 / max 186 ms, 0 stalls; queue waits stay in the idle-gate class by design (T3-as-written recorded UNMET, max 10 891 ms); persist.total 1 404 ms = commit 872 + media 460 + layers 11 + manifest 10 — the ~4.6 s full-document serialize is abolished, not optimized (n=1, architectural proof); §7 churn MET: tracksStrip 123 vs 369 (−78% per row), rightPanel 4 vs 72, canvas 114 vs 248, no surface up
- [Phase 52.2]: 52.2-16 pilot verdict — ADMITTED on T4/T5 + inspectability (numbers axis void-not-waived; the D-01 miss, T3-unmet and T4's unrun 10-minute leg recorded honestly); skill .claude/skills/efx-async-orchestration/SKILL.md written (D-17 contract earned); close-out chores committed: 33a92f3d (52r E/H diagnostic cluster removed) + 8e5f219d (body background into the bundled stylesheet — packaged-CSP fix); the next bundle carries both, no behavior change
- [Phase 52.2]: 52.2-16 carried to phase close — re-enable ui.safety_gate; delete the superseded SPECS/phase-52.3-async-conventions.md draft (user-owned); save progress-modal UX idea stays a registered candidate; the sequence-extension bug is routed as a later quick; the branch merge decision is the user's
- [Phase 52.2]: PHASE CLOSED 2026-09-18 — verification PASSED (`52.2-VERIFICATION.md`: 12/12 must-haves, 0 behavior-unverified; real-package digest check 32/32, zero-base64 scan 0 matches, bundled plist verified); Nyquist validation clean (0 gaps; `52.2-VALIDATION.md` status: validated, nyquist_compliant: true); close-out chores done (ui.safety_gate re-enabled, superseded SPECS/phase-52.3 draft deleted); next: Phase 53
- [Phase 52.3]: [Phase 52.3 P01]: FrameEntry is now a discriminated union (ContentFrameEntry | PaintFrameEntry | GapFrameEntry) — fail-closed by type per D-01; PaintFrameEntry carries the owning fx sequenceId + layerId and never keyPhotoId/imageId; GapFrameEntry is ownerless (sequenceId ''). Paint enumeration in frameMap fires only in content-empty projects (entries.length === 0 guard, Finding F1) with coverage via the shared getTimelineOverlaySequenceOutFrame predicate (anti-drift lock with the overlay leg); D-06 top-level identity clearRect gated on !hasContentEntry; efxPaintVersion consciously subscribed (Pitfall 2); D-08 pinned: paint-only fx-active selectedSequenceOnly completes, mixed fx-active refuses with the locked copy (Case E2)
- [Phase 52.3]: [Phase 52.3 P03]: 7/7 native UAT rows pass across formats, resolutions, and 0.5x/1x/2x scales — the WYSIWYG law (D-05) holds on the real surface; Phase 53 unblocked
- [Phase 52.3]: [Phase 52.3 P03]: Playback activation callout (UAT Row 7) confirmed deliberate and D-08-consistent — sidebar activating the fx row as the playhead enters paint frames is intended, not a bug
- [Phase 53]: Verdict (b) root cause: the Studio picker's Import wrote the CHILD webview's imageStore module instance, never the main realm's — the only source of the manifest images array; the 52.2 reference-only package format is exonerated and unchanged.
- [Phase 53]: The fix reuses the existing 49-04 bridge idiom: a validated child-to-main image-import-request/-result pair (operationId + paths only — the main realm resolves its own project directory), no new IPC/Rust command, no picker UI change.
- [Phase 53]: Chunk-size budget raised 1340 -> 1355 (measured 1340.68 kB + ~14.3 kB headroom) per the f57ec8e7 precedent — this plan's +3.38 kB tipped the gate and the two config files are the plan's only scope expansion.
- [Phase 53]: quick-260921-e21 verdict (a) on all three Studio-origin surfaces: the loss was in the child push wiring (clear-before-mode-check on the close flush and both scheduler bodies, plus a push-guard fingerprint latched before the send resolves) - transport, parent apply, reopen carrier, child hydration and store/package save all exonerated by live probe; fix extends the existing physic-paint:efx-paint-document pair only, no manifest change, c7x untouched
- [Phase 53]: quick-260921-e21 locks: three RED-then-GREEN wiring pins + one end-to-end reopen-carrier leg + two store-seam cases (background clip frame/refs, reference source refs) - full suite 4065 passed (c7x base 4059, +6 = exactly the new legs); native UAT 5 rows PENDING
- [Phase 53]: quick-260922-al1: the Scripts-panel layer scope is MAIN-realm-owned and travels the existing physic-paint:project-context channel; the child pulls it read-only at mount (no argument) and writes back over one new request event, so a Studio reopen can never reset the stored filter
- [Phase 53]: quick-260922-al1: an Action-apply refusal is surfaced through the EXISTING status capsule (setApplyMessage + setApplyStatus('error')) because the Studio discards setLastError's value in an empty destructure — before this, a refused apply reached the user as nothing; apply-cancelled keeps the error's own message verbatim since 'nothing changed' is false after committed brushes
- [Phase 53]: Type shape law: settings.grainScale REQUIRED default 1; metadata/fallback/instruction members OPTIONAL with ?? 1 normalization (optional-member idiom, not migration).
- [Phase 53]: Acceptance split (T-260923-01): efx fallback parse NORMALIZES absent/invalid to 1; physical/types guards and _isValidFallback REFUSE out-of-range (fail-closed).
- [Phase 53]: handleGrainScaleChange is one synchronous action: settings + track mirror + document fallback; no engine setVisibleBackground* call.
- [Phase 53]: canvasStack memo gains settings.grainScale and physicPaintVersion.value as the convergence door for flattened fond rotation.
- [Phase 53]: Pattern scale: setTransform only when scale !== 1 (with typeof guard); tile step floored >= 1; cache key includes normalized scale.
- [Phase 53]: quick-260924-d6l: three contract pins green at birth (PINS_GREEN_AT_BIRTH honest verdict); conditional re-scope not triggered, only the explicit classic-default contract docs shipped in NumericStepper.tsx; grain rule frozen as 260923-bcm shipped (0.5 interior / 0.1 edges)
- [Phase 52.4]: 52.4-01: D-05/D-07/D-14 locked one-way (shared tier-independent seeded stream = deposit contract; single finalize deposit; no paper height in footprint); D-01/D-04 costly-but-ungated
- [Phase 52.4]: 52.4-01: live display = dry-canvas blit at tier=live + engine bbox snapshot/putImageData restore before the finalize deposit (replace-not-stack, no ghost density)
- [Phase 52.4]: 52.4-01 shipped constants: LIVE_TIER_DIVISOR=4, LIVE_WIDTH_MUL=1.6, STREAK_ALPHA=0.4 (keep-gate: 0.30 -> 76.5/255 >= 70); values tunable in plan 02, architecture never reopened
- [Phase 52.4]: 52.4-01: engine gained a 'finalize' phase (raster -> finalize -> post-raster) as the single tier=final deposit site, generation-guarded phase-machine pattern
- [Phase 52.4]: 52.4-02 placement: plan-literal RSA provably jams below required count and undershoots D-02 density ratio; shipped seeded two-band stratified jitter (gap law + density by construction, mutationId-keyed) — documented in footprintLanes header
- [Phase 52.4]: 52.4-02 shipped look constants: STREAK_ALPHA 0.995 (FP margin at k=1), POISSON_FILL 0.7, BODY_BAND 0.52, BODY_WIDTH 1.3-1.6, RIM 0.5-0.9, NW_AMPLITUDE 0.4, NW_ARC_SCALE 0.1, WIDTH_FLOOR 0.5, MAX_TRACE_WIDTH 2, POISSON_MAX_ATTEMPTS 24, LIVE_WIDTH_MUL 4 — Claude's Discretion, judged at UAT
- [Phase 52.4]: 52.4-02 gauge: raw-arc keying aliased at 10px sampling into per-sample edge chatter; NW_ARC_SCALE 0.1 keys the D-12(a) gauge on slowed arc — production fix, pin threshold untouched
- [Phase 52.4]: 52.4-03: Tier-parity tolerances shipped 3/4/2 px (gap/silhouette/centroid) — silhouette 4 px carries the DiVerdi 4.1 fewer-but-thicker delta; strict containment deliberately rejected (Test 2 pins FALSE beside a pass)
- [Phase 52.4]: 52.4-03: flush-before-await ordering — publication fires synchronously inside flushPendingStrokeFinalizations; awaiting the live promise first risks the 400ms raf idle gate (deadlock headless); 1500ms race bounds a failed capture -> tierParity null, never zeros
- [Phase 52.4]: 52.4-03: both tiers observed through the engine's own tier passes (publication-stage offscreen read via translate-hook lastRasterCanvas) — package entry does not export drawBristleFootprint and the zero-diff lock forbids adding it
- [Phase 52.4]: Source-shape gates are region-scoped and never widen: G2/G3/G4 scan only the drawBristleFootprint body slice + footprintLanes.ts (paint.ts whole-file is never scanned for getImageData/paper), G1 covers paint.ts whole-file + lanes, G5 footprint body, G6 the per-file constant literals — real sources pass at birth and the scope cannot silently expand
- [Phase 52.4]: Row i fixture: both bands share one construction (constant body 200 + identical 1px falloff ring at value 3 below DH1_INK_FLOOR so it never enters ink runs or interiority) so the only difference under test is thickness; the salt checkerboard uses 200/5 (|200-5|=195 >= DH1_HARD_JUMP=32) with BOTH cells above the ink floor so interiority survives and the jump detector fires
- [Phase 52.4]: R2 velocity scope lock: heavyFast asserts byte-equality with the heavy-slow op log instead of an ink inequality — tranche 1a carries no velocity deposit term; the inequality returns when R2 lands in 53.1+
- [Phase 52.4]: ABA determinism (7 -> 99 -> 7): first and third logs byte-identical proves no module-level seed-state leak while a different id proves the seed is consumed; replaces same-run repetition
- [Phase 52.4]: Green-at-birth recorded honestly: the six real-source gates passed against the 52.4-01/02 implementation and were never manufactured red; the RED phase is the six negative controls failing against the zero-stub (RED_EVIDENCE_OK, re-verified at SUMMARY time)
- [Phase 52.4]: quick-260930-wm6: ONE LOOK LAW — every wet-to-dry transfer alpha is wetDisplayAlpha(alpha, pixelOpacity, sampleH(...))/255 (compositor.ts READ-ONLY import); cooking window + drySpeed control surface deleted (solver keeps literal 100); rail 9 -> 6 actions; accepted tradeoff: the slow post-stroke densification is gone. The stroke freezes on what the solver produced at lift
- [Phase 52.4]: quick-260930-wm6 revision R1: PREVIEW == SETTLED. THREE render paths existed and the eye judged the one no settled path could reproduce (tier='live' raw dry-canvas blit at LIVE_WIDTH_MUL=4 vs tier='final' reduced-clone deposit + R9 solver). ONE PIPELINE (raw blit + liveSnapshot/restore + the second renderPaintStroke pass deleted) + ONE LANDING (reveal only after the physicsTicks solver) + THREE NAMED DEPOSIT KNOBS (DEPOSIT_KEEP_TIER 70→40, DEPOSIT_DENSITY_SCALE 3000→4500, D-08 floor userOpacity²→userOpacity + gamma 0.8→0.5). Standing gate lookLawDigest.test.ts = byte-equal preview == cache == reloaded. Look = dense + physics texture, never the solid raw blit (that is Paint's job, paint-width)
- [Phase 52.4]: quick-260930-wm6 revision R2: GESTURE STALL + WHITE SEAM (measure-first, one fix per defect). Look UAT on R1 PASSED; knobs 40/4500/0.5 STAND. Defect 1 writer = paint-pickup-canvas-snap full-canvas getImageData (2,073,600px at 1080p) feeding only a ceil(radius/2) disc → scoped to the curve footprint (whole-source readbacks 1→0). S1 preview EXONERATED; S1 finalize drain NAMED NOT FIXED (unbounded flushPendingStrokeFinalizations + dead hasPendingInput in WKWebView). Defect 2 writer = paper tile seams — plain repeat of a photographed paper_*.jpg steps 0.8000 at every tile boundary (the cut grid + one tile's block outline) → loadPaperTexture mirror-tiles (step 0.8000→0.0000). (a) bbox clip EXONERATED (94,710 hull verts, clippedVerts=0); (d) solver overflow is a HALO not a cut
- [Phase 52.4]: quick-260930-wm6 revision R3b: TRUE-WHITE HOLES (paper exonerated). R2's mirror did NOT kill the seams. STEP 1 (user): lines are TRUE WHITE (alpha ~ 0) at 100% brush opacity -> paper exonerated BY PHYSICS (fast path skips paperMod at pixelOpacity >= 0.90; conditionHeightMap clamps h to [0.10, 0.90] so paperMod >= 0.775 = lighten at most 22%, never 0; measured min 0.7756). paper.ts byte-untouched. INVARIANT: no VISIBLE wet pixel may vanish without landing in dry (getBakedCanvas = previewBase + dry, no wet overlay). (a) segBounds clip CLEAN at production extremes the R2 pin missed (edgeDetail 100 -> edgeMul 2, r 8/32/64, deform depth 4, INTERIOR offscreens: 60828/88160/84700 verts, clippedVerts 0). (d1) sa==0 clear-without-transfer CLEAN (wet.alpha 1-4 -> sa rounds to 0, but those bytes render 0 on the display TOO). (d2) THE WRITER: dryRegionForStroke = +/- brushRenderRadius but the solver solves +/-(brushR + margin); 384 VISIBLE pixels in the ring never land in dry -> the bbox rectangle = the 'full block outline' + its four sides. Disproven 52.1 assumption (drying.ts): "wet pixels of one finalized stroke are bounded by the stroke bbox". ONE FIX: forceDryAll unions the caller's bounds with the real wet extent (compositeWetLayer's existing O(W*H) scan) -> ring 0->384 written, 384->0 visible-absent; 52.1 bounded-readback law holds. Fix in drying.ts so the uncommitted previewBase fix stays out. drying.bboxLoss.test.ts (q6t Addendum B) flipped to gate the fix. RED c5914ff6 -> GREEN 70d79adf
- [Phase 52.5-physic-paint-document-sound-track]: 52.5-01a: clip fps chain = current?.fps ?? store.getFps(), store seeded at hydration (context.fps ?? 12)
- [Phase 52.5-physic-paint-document-sound-track]: 52.5-01a: child documentAudio store keeps a persistent appliedRevision watermark surviving null-clears (stale replay can never resurrect a clip)
- [Phase 52.5-physic-paint-document-sound-track]: 52.5-01a Rule 2 deviation: launch hydration seeds store identity + routes documentAudio through the single funnel (usePhysicsPaintLaunchIntegration.ts)
- [Phase 52.5]: Sound band gestures use window capture-phase listeners: identity fixed at pointer-down, stopPropagation only once armed (stain press bubbles for the single sub-threshold seek; trim stops before guards and never seeks)
- [Phase 52.5]: Direct-DOM drag preview with one settle on release through setDocumentSound (T-52.5-02 settle-only push); peaks re-derive on reopen via existing decode/cache, fail-closed
- [Phase 52.5]: Trim law mirrors the NLE model: left end moves start+in together (timeline end invariant), right end clamped so start+(out-in) <= parentEnd, min span 1 frame
- [Phase quick-261009-6ee]: One-switch law: header preview toggle dropped from the Document sounds modal; footer On/Off pill is its only audio switch, strip Audio Preview toggle remains the main-app-audio surface
- [Phase quick-261009-6ee]: Shared NumericStepper restyled to unified 22px single-pill chrome app-wide; base box keys removed, contextual CSS input box rules stripped (Rule 2) to keep one outline
- [Phase quick-261009-6ee]: Live-UAT refinements locked — new shared blended SliderStepper (value on top, bare −/+, sliderMax track-only range) on all five snapshot surfaces; audio modal: FILE section header, header On/Off pill (VolumeX off-state), icon Remove + Cancel/Remove confirmation modal, singular "Document sound" title, opaque bar #4c4e51, rail/knob midline-centered, panel alpha 0.9 (faint glass only, photo-ref dialogs keep full glass)
- [Phase quick-261009-rko]: source_path is the absolute on-disk path carried verbatim; relative_path retired at both load doors
- [Phase quick-261009-rko]: readAudioSourceBytes/efxasset is the sole main-app audio byte-read; gallery import and sidebar Replace never copy into the package
- [Phase quick-261009-v0s]: RuleSectionHeader single-sources Studio section values as inline styles; physicsPaintStudio.css rules deleted
- [Phase quick-261009-v0s]: Physic-paint rail hover hit-tests trim edges before the row-body pointer hint
- [Phase quick-261009-v0s]: Playhead hover consults isOnPlayhead before the content-area default fallback; 10px zone unchanged
- [Phase quick-261009-v0s]: Position SliderStepper commit unbounded (negatives legal); sliderMin/sliderMax track-only
- [Phase quick-261009-v0s]: BPM and Beat Offset stay NumericInput; AUTO-ARRANGE keeps bpm+markers gate and one-undo Apply
- [Phase quick-261010-bkv]: dB is the only UI amplitude domain; audioGain.ts is the single bridge (linear volume editor / integer -100..+100 Studio gain)
- [Phase quick-261010-en9]: Offset (s) sign law: UI positive = earlier source; engine slipOffset is the inverse (slipOffsetBounds.ts owns bounds + clamp)
- [Phase quick-261010-en9]: DocumentSoundClip.slipOffset is a clean-break required integer; MceAudioTrack.slip_offset untouched
- [Phase quick-261010-en9]: setIn writes inFrame AND offsetFrame in one undo action so the clip end stays fixed
- [Phase quick-261010-g2n]: Peaks drawn once in SOURCE space windowed to the clip bar; visiblePeakCount rescale deleted
- [Phase quick-261010-g2n]: Fit to view is one audioStore snapshot (In/Out/Position/slip=0), never chained setters
- [Phase quick-261010-g2n]: Replace file-row is a real small-button; handleReplace never-copy body byte-stable
- [Phase quick-261010-ht0]: fadeCurves.ts is the single home of f(t); fade-in loudness = 1-f(1-t) mirrors fade-out = 1-f(t)
- [Phase quick-261010-ht0]: sourceFrames is a required positive integer (clean break); Offset bounds read it first, trim-out fallback gone
- [Phase 53.1]: 53.1-01: D-01/D-15 clean break — per-sequence fps deleted from Sequence/MceSequence/factories/serializer/parser; no shim, no migration
- [Phase 53.1]: 53.1-01: D-02 shared reader — exportRenderer, previewRenderer video seek, and SequenceList all read projectStore.fps; frame 15 = 1.0s at 15fps
- [Phase 53.1]: 53.1-01: target-law frame-LIST contract landed with four exact describes; tail-policy + past-source stay red until 53.1-02/03; I-6 fade pins byte-stable (D-13)
- [Phase 53.1]: 53.1-02: D-03 resolveOverlaySample is the single tail-policy resolver — sample/skip/hold-last/loop discriminated union; callers use the returned localFrame uniformly and never recompute the hold index
- [Phase 53.1]: 53.1-02: D-04 absent outFrame = untrimmed = follows N; createContentOverlaySequence no longer freezes outFrame at import (the I-2 root). Present outFrame stays authoritative — past out is nothing
- [Phase 53.1]: 53.1-03: D-07 extrapolation is a required Sequence field (clip grain) with setSequenceExtrapolation matching updateFxSequenceRange
- [Phase 53.1]: 53.1-03: D-09 HOLD-everywhere — factories default hold, hydrate maps absent/unknown to hold (only literal loop is LOOP), no legacy-LOOP branch
- [Phase 53.1]: 53.1-03: D-08 Hold last frame / Loop two-state control in SidebarProperties content-overlay branch; LeftPanel passes parent Sequence
- [Phase 53.1]: 53.1-03: VideoAsset.sourceFrameCount feeds the export gate past-source law; preview caches probed video.duration count
- [Phase 53.1]: D-10: playhead ceiling 0..N inclusive at the store boundary only (seek/stepForward upper = max; frameFromX default totalFrames); resolveTimelinePointerFrame byte-untouched
- [Phase 53.1]: D-10 END-STATE: mapPreviewEndStateFrame one-liner (playhead >= N ? N-1 : playhead) applied once at renderGlobalFrame before the fm lookup; export never sees N
- [Phase 53.1]: D-11: drawRuler isEndLimit at f === N is a taller tick + horizontal cap with no numeric label and no time glyph; ticks 0..N-1 unchanged
- [Phase 53.1]: 53.1-05: D-05 hatched gap tail on the clip's own row from fxTrackLayouts.skipRange (getOverlaySkipRange on the authoritative outFrame); barW stays (out-in)*frameWidth, fades flush, hatch outside both
- [Phase 53.1]: 53.1-05: D-06/D-14 warnings: string[] parallel to errorMessage — named gap warnings via getOverlaySkipRange never abort and never set error status; export still writes 0..N-1
- [Phase 53.1]: 53.1-05: D-12 inspector Coverage readout (range line + Follows sequence end / Ends at N · gap) derived from getOverlaySkipRange — three surfaces, one coverage truth
- [Phase quick-261013-ctd]: Option 2 only: ffmpeg -shortest on the audio arm; mixer anti-cut-off pad stays internal (EXP-01)
- [Phase quick-261013-ctd]: encode_video_args is the single pure argv builder; mux-truncation pin lives only in its audio arm
- [Phase 53.1]: PHASE CLOSED 2026-10-13 — live signed-build UAT PASSED (5/5 rows: black-hole frame 16 gone; tick N end-limit + playhead reachable; 15fps I-4 export timings; gap marker + named export warning; clean project exports no regression). Guardrails held: exclusive outFrame [in, out) unchanged, 260918-o0n span-drag law unchanged, resolveTimelinePointerFrame floor unchanged, no version bump, no release action. Verdict in `53.1-UAT.md`. No further work in this phase — v1.0.1 release unblocks, merges user-sequenced.
- [Phase 54]: 54-01 RUN-01 satisfied: two-leg throwaway probe green on preact@11.0.1 + @preact/signals@2.11.3 (pattern teardown-clean + pairing witness typecheck/build); probe deleted per D-02; workspace pins untouched
- [Phase 54]: 54-02 option A: four Preact 11 bump targets confirmed legitimate on npm (preact@11.0.1 preactjs org, @preact/signals@2.11.3 preactjs org, lucide-preact@1.57.0 ericfennis with peer ^10.27.2 || ^11.0.0-0, @preact/preset-vite@2.10.6 preactjs org with no preact peer); no [SLOP] admitted
- [Phase 54]: 54-02 D-13 concrete target: align every @preact/preset-vite pin on 2.10.6 (app/package.json already uses it), replacing the 2.10.3 / 2.10.5 / 2.10.6 triple and closing the extra pnpm resolution lane riding preact@10.28.4
- [Phase 54]: Option A (D-04 one-way door): efx-physic-paint peerDependencies.preact >=11.0.0 AND devDependencies.preact ^11.0.1 in the SAME commit; no dual-major range (clean-break law)
- [Phase 54]: Workspace on preact@11.0.1 + @preact/signals@2.11.3 with exactly one preact copy; D-06 divergence eliminated
- [Phase 54]: lucide-preact ^1.57.0 and every @preact/preset-vite pin aligned on 2.10.6 (D-10, D-13)
- [Phase 54]: Standing one-preact-copy contract pin at app/src/preactSingleCopyContract.test.ts (RED first, GREEN after bump)
- [Phase 54]: D-07 form locked: bare named type imports from 'preact' (CSSProperties, Targeted*Event); JSX.Element return types left as-is; no preact.JSX.* namespace form
- [Phase 54]: Rule 3 scope expansion: Preact 11 also removed MutableRef and changed useRef overloads to RefObject<T | null> — type-only mechanical fixes beyond the three D-07 files, required for tsc green
- [Phase 54]: Hook-using lucide-preact 1.57 icons stay opaque leaves in six no-DOM vnode materializers; full vitest suite green (4921 passed)
- [Phase 54]: PINS_GREEN_AT_BIRTH: paintVersion discipline contract pin green at birth on unchanged sources — preservation pin (D-11/RUN-05), not manufactured RED; is-behavior-adding=false (test-only) — Plan action explicitly names the green-at-birth path for a preservation pin. Manufacturing a RED by breaking production source would be theater. RUN-05 marked complete on the pin proof; RUN-06 left OPEN until user asserts A1-A5.
- [Phase 54]: RUN-06 closed on live UAT: A1-A5 all PASS 2026-10-14 (paintVersion bump+subscribe live; undo/redo sync; track switch clean; Studio dispose profile counters clean; standalone ./preact mounts) — Phase 54 hard gate cleared
- [Phase 55]: 55-01: D-04 sequencing held — golden captured entirely on pre-split code before any module move; fixture stores RotoPaintScript (renderer runtime input) not PersistedRotoScriptV1 so 55-05's envelope cutover leaves these files untouched
- [Phase 55]: 55-01: one shared deterministic bake entry (production animation schedules + transformRecordedStrokeForHeldPose + traceSeed mirrors) drives both capture and pin; PINS_GREEN_AT_BIRTH recorded honestly; D-01 independent oracle (no tier-parity metrics helper)
- [Phase 55]: 55-02: packages/efx-paint-host created Preact-free (D-17) with animation/ + util/traceSeed + util/noise moved; seededRng signature byte-stable (D-25); golden pin green after move
- [Phase 55]: 55-02: ONE StudioStroke<P> contract (pts/ticks/cuisson/motion/brushId/toolOverrides/traceSeed/recordedOrder/playFrame/color/engine: P); color kept as shared field so held-pose hashStroke stays byte-identical
- [Phase 55]: 55-02: AnimationPlayer drives generic EngineAdapter<P> (live + bake surface); AnimationStrokeStyleOverride<P> is generic with opaque engine slot (D-18)
- [Phase 55]: 55-02: atomic move + 13-site consumer re-point in one change set (D-18 clean-break); toStudioStroke/fromStudioStroke at the seam (FIELD-MAPPING CONTRACT)
- [Phase 55]: 55-03: script payload types re-export StudioStroke<P> from animation/types.ts (one schedule contract); EngineAdapter<P> in payload.ts with full surface (engineId + payloadCodec + live + bake); parse validates envelope fields only, engine slot untouched
- [Phase 55]: 55-03: schema version fixed at 1 (exact match, fail-closed); named failures return null without throwing (D-12 refuse-before-write)
- [Phase 55]: PINS_GREEN_AT_BIRTH for hostAnimationResidueContract — 55-02 move landed; detection proven by in-memory matcher self-test
- [Phase 55]: Residue pin never unbreaks 55-02 — a red pin opens a 55-02 gap, no local re-point
- [Phase 55]: 55-04: HOST_TICK_HZ resolved to 60 (D-23); integer ticks only, named RangeError domain door, never raw ms (DATA-03)
- [Phase 55]: 55-04: cuisson mechanism host-owned and uncapped (D-20) — cuissonTicks has no ceiling; clampCuissonTicks requires caller bounds; engine-1 frame cap stays engine-side
- [Phase 55-efx-paint-host-engine-1-host-split]: 55-05: PersistedRotoScriptV1 IS StudioScriptEnvelope<PhysicStrokePayload> — one saved shape (D-13) — Avoid a second document type; engine-1 payload rides the opaque engine slot
- [Phase 55-efx-paint-host-engine-1-host-split]: 55-05: brushPack pinned as { kind: efx-physic-paint, entries: [] } (landed 55-03 field name) — Keep the landed BrushPackSnapshot type; plan prose said brushes
- [Phase 55-efx-paint-host-engine-1-host-split]: 55-05: Rust durable path cut over with the codec (Rule 2) so save/scan keep working — Cutover without it would break every save; D-16 refused rows need scan emission
- [Phase 55]: 55-06: Four host codes map to four distinct named English lines on the existing owned-refusal surface (D-09/D-10); engine-mismatch detail carries package-id pair with D-15 display-name mapping; parseRotoScript discriminates engine-mismatch from malformed-engine-payload (Rule 2)
- [Phase 55]: A5 play path is ONE shape: AnimationPlayer on StudioStroke<P> + bake via applyStroke/stepTick*/captureFrame on the same stub (D-05/D-06)
- [Phase 55]: Import-graph pin walks the whole packages/efx-paint-host/src tree; dispose() does not bump generation for surviving flush-survives-navigation turns (D-21)
- [Phase 55]: createBakeHost is the Phase 56 consumer API — PlayScript stays on finalizationQueue this phase (R1.3); deferral recorded in 55-07-SUMMARY
- [Phase 55-efx-paint-host-engine-1-host-split]: 55-08: suite gate asserts pin visibility (present + collectable + non-empty + still-has-tests) on the shared vitest include; PINS_GREEN_AT_BIRTH preservation gate
- [Phase 55-efx-paint-host-engine-1-host-split]: 55-08: live UAT A1-A4 staged PENDING (human_judgment) — phase stays automated-ready; A5 stays the automated pin (D-05)
- [Phase quick-261017-iwm]: PAPER_REFERENCE_HEIGHT = 1100 exported from procedural.ts as single home of the playground sheet-height constant; referenceHeight param uses isotropic f/refH cycles-per-texel
- [Phase quick-261017-iwm]: Procedural fond arm returns WxH canvas directly (no createPattern repeat); lattice sized to cover span under referenceHeight to prevent wrap
- [Phase quick-261017-vcn]: Q6 grain widgets move to the TOP of the Paper tab; the D-10 bottom Strength/Scale pair is deleted so one pair survives
- [Phase quick-261017-vcn]: Transparent + White sit between grain and grid as background arms wired to handleBackgroundChange; paper cells keep the paper-id path
- [Phase quick-261017-vcn]: handleGrainStrengthChange / handleGrainScaleChange absorb setPaper* so one grain change hits settings + paper-display + track metadata + document fallback
- [Phase quick-261017-w4x]: Top-bar Opacity routes at call time: watercolor -> aquarelleParams.load (Pigment), else settings.opacity — mirrors onBrushSizeChange
- [Phase quick-261017-w4x]: Paint tab (watercolor) is settings only; Dry is rail-only with D-15 record seam unchanged; AquarelleToolRow.tsx stays on disk for I-10
- [Phase quick-261017-xa0]: I-03 seam accepts BRUSH_PRESETS ids and forces Brush tool on any successful non-null pick
- [Phase quick-261017-xa0]: Thumb painter ported app-side into watercolorStrokeThumb.ts with paint-once HTMLCanvasElement cache (no package surface)
- [Phase quick-261018-cy1]: Top-pane Actions tab removed in every mode; bottom-pane scripts Actions label stays
- [Phase quick-261018-cy1]: Thumb pigment is the single oracle constant #2338a8 in watercolorStrokeThumb.ts (SPECS/ read-only)
- [Phase quick-261018-cy1]: Grain Soft active = nearest GRAIN_STRENGTH_OPTIONS match; non-finite -> 0.35; factory default untouched
- [Phase quick-261018-cy1]: Watercolor rail history reuses PhysicsPaintHistoryActionButton + existing onUndo/onRedo/onClearFrame props
- [Phase quick-261018-f15]: Paper-thumb wash ported app-side to Canvas 2D; engine.paperSwatch never called on the 1x1 offscreen engine
- [Phase quick-261018-f15]: Brush size + Opacity routers extract to identity-stable useCallbacks; top bar and Paint tab share ONE write-through pair
- [Phase quick-261018-f15]: Transparent/White join the Real section as paper-card cells via a display:contents hook wrapper
- [Phase quick-261018-gqo]: Landscape paper cards CARD_WIDTH=112/THUMB_HEIGHT=64/GRID_GAP=8 override the old 64x64 UI-SPEC lock
- [Phase quick-261018-gqo]: Oracle Title Case paper names; PAPER-04 scans relabel to Scan 1/2/3 (no PAPER N placeholder, no invented paper types)
- [Phase quick-261018-gqo]: Top bar Modes+settings one centered group; Engine ready left; slider min-width 112px; write-through pair unchanged
- [Phase quick-261018-odm]: Dual-engine script envelope: document engineId discriminates efx-physic-paint vs efx-watercolor; aquarelle pts stay UV; Dry events persist as distinguished stroke entries (D-16)
- [Phase quick-261024-mz5]: Scale is direct manipulation: factor = currentDistance / startDistance, clamped [0.1, 10] — the plan text's inverted ratio was overridden
- [Phase quick-261024-mz5]: A degenerate (zero) distance is identity, never NaN and never a collapse
- [Phase quick-261024-mz5]: transformStrokes honors angle and factor together: scale first, then rotate about the same centre, matching the shared apply law
- [Phase quick-261024-mz5]: Handles render only when the adapter supplies onTransformStrokes; hit-testing the handle wins over the stroke hit test
- [Phase quick-261024-mz5]: Watercolor transform is UV-space via one aquarelleEnginePixelToUv crossing and a NEGATED screen angle (UV y is up)
- [Phase quick-261024-mz5]: Watercolor failure path restores the raw pre-attempt snapshot and surfaces the existing refusal capsule

### Pending Todos

None yet.

### Blockers/Concerns

- Research flags for planning: exact `.mce` v1.0 schema field-level design (Phase 45), opacity/blend application order + full pixel acceptance matrix enumeration (Phase 48), track-aware `paintVersion` reactivity model (Phase 46).
- v0.9.0 audit-accepted tech debt and deferred items carried forward (see Deferred Items below).
- 52.2-02 leaves 8 round-trip tests red by design until plan 07's writer projects media references: efxPaintPersistence.test.ts (1, owned by plans 07/09) and 7 in files NO phase plan lists — physicsPaintRotoLoopClips.test.ts (5) and physicsPaintRotoGroupParity.test.ts (2). Plans 07 and 09 both carry a 'full suite green' exit criterion, which is where this surfaces.
- 52.2-03: vitest run exits 1 on 9 pre-existing failures (roto persistence x7, base64ToBytes frame-transport token in app/src/lib/ipc.ts, efxPaintPersistence base64) — identical at the plan base 15e680cc; not introduced by this plan, owners must clear them before /gsd-ship
- BEFORE render-churn capture pending - owner: user. Run the SPECS/async-conventions.md section 7 protocol on the current dev build (render.tracksStrip/rightPanel/canvas through window.__EFX_PHYSICS_PAINT_PROFILE__.snapshot().counters) before plan 52.2-14 pilot code lands.
- 260924-stb intermediate STOP (RESOLVED in-run): f(run) carrier regressed pyp texture d(b)→0 on the r=3 production raster; 210-candidate re-calibration FALSIFIED (run=0 ambiguous between hairline body and thick-stroke edge columns). Resolved by carrier revision to neighborhood mean-thickness field — GREEN 6341afba, all pins pass. Windows ledger 76 records the superseded f(run) attempt.
- RESOLVED 2026-10-11 — Phase 53 wave 1 / plan 53-01: blocking-human precondition cleared. User approved a D-21 scoped fix owned by the orchestrator (replacing the user-dispatched quick): WINDOWS.md #90 paintStore/projectStore ESM module-body cycle broken via a late-bound `_setPaintProjectDimensionsProvider` (fix commit 2075e873 on fix/90-paint-dimensions-provider; two files only, no typeof guards, no test/config edits). Merged into preserved worktree agent-a903db740857f072f as 0dc40f8b (bump 359ada83 untouched; a4357fa untouched). Acceptance 1 green (PhysicsPaintStudioView 4/4); acceptance 2 green (full suite 259 files passed / 0 failed / 4809 tests — precondition re-run GREEN in a903db); acceptance 3 (live non-1920x1080 flatten/unflatten dims) PENDING USER. Task 2 continuation dispatching.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261017-dc2 | Accept paper/* in the roto document parser and never write an empty-string background (fixes invalid background metadata crash killing timeline navigation) | 2026-10-17 | 1876f4b3 | [261017-dc2-fix-validator-divergence-document-parser](./quick/261017-dc2-fix-validator-divergence-document-parser/) |
| 261017-e7n | Render procedural paper tooth in the editor fond + route engine grain keys (I-07 paper must show) | 2026-10-17 | 117cd92b | [261017-e7n-i-07-procedural-paper-must-show-in-the-e](./quick/261017-e7n-i-07-procedural-paper-must-show-in-the-e/) |
| 261017-fz3 | Paper correctness: single PaperPicker home, paper in aquarelle bake+cache key, playground PAPER_UNITS relief scale | 2026-10-17 | 66c9eab0 | [261017-fz3-paper-correctness-round-1-remove-duplica](./quick/261017-fz3-paper-correctness-round-1-remove-duplica/) |
| 261017-iwm | Continuous procedural fond at WxH + PAPER_REFERENCE_HEIGHT=1100 scale law (no more tile grid) | 2026-10-17 | 8d292c4d | [261017-iwm-fix-visible-tiling-and-wrong-scale-of-th](./quick/261017-iwm-fix-visible-tiling-and-wrong-scale-of-th/) |
| 261017-ki6 | Transliterate playground paper shader to TS (paperFieldFS + paperLightFS + PAPER_COLOUR, 10 kinds, PAPER_UNITS=1100); clean-room procedural.ts deleted | 2026-10-17 | 71ea1277 | [261017-ki6-transliterate-the-watercolor-playground-](./quick/261017-ki6-transliterate-the-watercolor-playground-/) |
| 261017-lny | Run paper shader on GPU (WebGL2, playground GLSL verbatim) + keep procedural sheet full density (no white+0.18 under-fill) | 2026-10-17 | a7eaf78a | [261017-lny-paper-performance-and-reopen-density-run](./quick/261017-lny-paper-performance-and-reopen-density-run/) |
| 261017-mdr | Kill first-render stall: GPU blit instead of readPixels+y-flip loop, idle warm-up of the selected sheet + thumbs | 2026-10-17 | c93077c3 | [261017-mdr-kill-the-first-render-stall-on-the-proce](./quick/261017-mdr-kill-the-first-render-stall-on-the-proce/) |
| 261017-nnu | Delete duplicate paper subsystem; render paper via vendored WatercolorEngine.paperSheet() (12ms @ 1920x1080, no wash) | 2026-10-17 | aba8ebcd | [261017-nnu-delete-the-duplicate-paper-subsystem-and](./quick/261017-nnu-delete-the-duplicate-paper-subsystem-and/) |
| 261017-vcn | I-04 remainder: Paper tab single home (grain at top, Transparent/White arms, top-bar Background/Grain gone) | 2026-10-18 | 1b6146be | [261017-vcn-i-04-remainder-paper-tab-is-the-single-h](./quick/261017-vcn-i-04-remainder-paper-tab-is-the-single-h/) |
| 261017-w4x | I-05 + I-06: Opacity top-bar only; tools leave Paint tab, Dry rail-only | 2026-10-18 | 1b6146be | [261017-w4x-i-05-i-06-paint-tab-shows-settings-only-](./quick/261017-w4x-i-05-i-06-paint-tab-shows-settings-only-/) |
| 261017-wmw | I-01 + I-02: Paint = watercolor params (playground labels + Reset); Brush = brush response | 2026-10-18 | 1b6146be | [261017-wmw-i-01-i-02-paint-watercolor-params-brush-](./quick/261017-wmw-i-01-i-02-paint-watercolor-params-brush-/) |
| 261017-xa0 | I-03: Brush tab = the 14 playground brushes with stroke thumbs | 2026-10-18 | 1b6146be | [261017-xa0-i-03-brush-tab-the-14-playground-brushes](./quick/261017-xa0-i-03-brush-tab-the-14-playground-brushes/) |
| 261018-0ox | I-08 + I-10 + Row 11: Brush-mode gating pin, adopt RightPanel tab components, grain default 0.35 | 2026-10-18 | 1b6146be | [261018-0ox-i-08-i-10-row-11-context-gating-orphan-t](./quick/261018-0ox-i-08-i-10-row-11-context-gating-orphan-t/) |
| 261018-cy1 | UAT feedback batch on the phase-55 watercolor UI (images 59-65): tabs by mode, oracle brush list, centered top-bar controls, watercolor Undo/Redo/Trash, flat paper tab Real-first grain Soft, Actions tab removed | 2026-10-18 | bba5bc2b | [261018-cy1-uat-feedback-batch-on-the-phase-55-water](./quick/261018-cy1-uat-feedback-batch-on-the-phase-55-water/) |
| 261018-f15 | Second UAT round on the watercolor/brush Studio UI: right-panel inset, flat paper tab with oracle wash thumbs 2-col, Water/Edges/Grain in top bar, duplicated size/opacity, brush smoothing first | 2026-10-18 | aba0b8c1 | [261018-f15-second-uat-round-on-the-watercolor-brush](./quick/261018-f15-second-uat-round-on-the-watercolor-brush/) |
| 261018-gqo | Third UAT round: landscape paper cards, oracle paper catalog, spacing pass, light brush borders, centered top-bar group | 2026-10-18 | 4d6ed5c2 | [261018-gqo-third-uat-round-on-the-watercolor-brush](./quick/261018-gqo-third-uat-round-on-the-watercolor-brush/) |
| 261018-ias | Fourth UAT round: Paper tab Texture slider + 15 CSS adjustments (images 78+) | 2026-10-18 | e0a00b61 | [261018-ias-fourth-uat-round-on-the-watercolor-brush](./quick/261018-ias-fourth-uat-round-on-the-watercolor-brush/) |
| 261018-jlb | Fifth UAT round: six cosmetic moves (Brush response title, #777 borders, cell fill, full-width thumbs) | 2026-10-18 | 60f331cb | [261018-jlb-fifth-uat-round-on-the-watercolor-brush-](./quick/261018-jlb-fifth-uat-round-on-the-watercolor-brush-/) |
| 261018-k1o | Top bar layout: ModuleSwitcher left near Engine ready; sliders stay centered | 2026-10-18 | 5491ee97 | [261018-k1o-top-bar-layout-tweak-move-moduleswitcher](./quick/261018-k1o-top-bar-layout-tweak-move-moduleswitcher/) |
| 261018-l05 | Brush tab DOM cleanup: remove invisible toggle line + simplify brush card markup to stylesheet classes | 2026-10-18 | 0f059c19 | [261018-l05-brush-tab-dom-cleanup-1-remove-leftover-](./quick/261018-l05-brush-tab-dom-cleanup-1-remove-leftover-/) |
| 261018-lqv | Fix save-script validator: isRotoBackground accepts paper/* + grainScale (parity with types validator) | 2026-10-18 | 77e64dcb | [261018-lqv-fix-captured-roto-script-is-not-persista](./quick/261018-lqv-fix-captured-roto-script-is-not-persista/) |
| 261018-odm | Watercolor script playback: dual-engine schema + aquarelle save/play route + Rust validator | 2026-10-18 | d1e57be7 | [261018-odm-build-watercolor-script-playback-extend-](./quick/261018-odm-build-watercolor-script-playback-extend-/) |
| 261019-mj2 | Roto paint workflow: direct-paint auto-key + Create key fallback, Insert as a pure gap, +Key from nearest previous real key, composite undo, atomic cache re-anchor | 2026-10-20 | c5314d3a | [261019-mj2-roto-paint-workflow-auto-key-on-paint-ke](./quick/261019-mj2-roto-paint-workflow-auto-key-on-paint-ke/) |
| 261022-cfn | Auto-paint key creation clones the previous paint and joins its rail; replace the timeline + Rail dropdown with a single-purpose new-rail button; rename Action to Script in visible UI | 2026-10-22 | 713bc1b0 | [261022-cfn-key-creation-new-behaviour-1-auto-paint-](./quick/261022-cfn-key-creation-new-behaviour-1-auto-paint-/) |
| 261022-iff | One global Solo button (Focus pill solos the active track, follows selection, Escape/re-click exits; per-track S chip and rail-solo window retired; hide wins over solo) | 2026-10-22 | c2ca4a01 | [261022-iff-one-global-solo-button-1-replace-the-sol](./quick/261022-iff-one-global-solo-button-1-replace-the-sol/) |
| 261022-jq0 | Selected rail plays its full range (Studio transport): a selected Key Rail / Loop Clip / rail set scopes Play to its contiguous span, Loop wraps to the selection start, and no selection keeps full-timeline play-from-cursor | 2026-10-22 | dad851ff | [261022-jq0-selected-rail-plays-its-full-range-1-sel](./quick/261022-jq0-selected-rail-plays-its-full-range-1-sel/) |
| 261022-ljt | Fix: Add progression to play script in watercolor mode (brush mode has it but watercolor play has no progress) | 2026-10-22 | c0163344 | [261022-ljt-fix-add-progression-to-play-script-in-wa](./quick/261022-ljt-fix-add-progression-to-play-script-in-wa/) |
| 261022-mne | Solo persists for the whole Studio session: frame navigation, playback, selection changes and mutation locks no longer disarm it | 2026-10-22 | 23229e73 | [261022-mne-solo-track-is-not-persistent-when-i-chec](./quick/261022-mne-solo-track-is-not-persistent-when-i-chec/) |
| 261022-mvs | Feat: Add progression to apply script (watercolor) not sure if brush mode has it | 2026-10-22 | 2bd6af0f | [261022-mvs-feat-add-progression-to-apply-script-wat](./quick/261022-mvs-feat-add-progression-to-apply-script-wat/) |
| 261022-ne3 | Bottom timeline buttons arrangement - Tools modal: Push mode after Trash; six Scripts-tab actions cloned into the Tools popover with labels | 2026-10-22 | bcaf1013 | [261022-ne3-bottom-timeline-buttons-arrangement-tool](./quick/261022-ne3-bottom-timeline-buttons-arrangement-tool/) |
| 261022-o2a | Tools Scripts/Living Script sections, shared script picker, sidebar four labeled actions + per-row hover delete | 2026-10-22 | 47e7ee26 | [261022-o2a-tools-modal-and-scripts-sidebar-regroup-](./quick/261022-o2a-tools-modal-and-scripts-sidebar-regroup-/) |
| 261022-pim | Watercolor stroke select + delete in Studio (Move/Cmd select mode, outline overlay, Alt+click delete re-bakes through shared Apply, one-step undo/redo) | 2026-10-22 | e6914b28 | [261022-pim-watercolor-stroke-select-delete-in-studi](./quick/261022-pim-watercolor-stroke-select-delete-in-studi/) |
| 261022-tv1 | Cmd+drag moves a selected watercolor stroke as a ghost, release translates the script and re-bakes, one undo step | 2026-10-22 | 649a924b | [261022-tv1-watercolor-stroke-move](./quick/261022-tv1-watercolor-stroke-move/) |
| 261022-ujp | Feat: with move tool for brush or watercolor you move stroke to behind stroke stack. Each time I type 'space' key it goes one step behind from strokes stack list and re-render like for move and delete stroke. Space stack change action works only if I am in move mode and a stroke was selected. | 2026-10-22 | eac877a3 | [261022-ujp-feat-with-move-tool-for-brush-or-waterco](./quick/261022-ujp-feat-with-move-tool-for-brush-or-waterco/) |
| 261023-bji | Feat: when the session Solo is armed in Studio, every non-target Paint row wears the exact disabled-track grey so only the soloed (active) track reads as audible; the Bg row stays bright and disarm restores everything | 2026-10-23 | d10a2ed4 | [261023-bji-feat-when-i-solo-track-in-studio-i-want-](./quick/261023-bji-feat-when-i-solo-track-in-studio-i-want-/) |
| 261023-bxm | Duplicate carries the source key's script/uncooked paint to the next key (settle displayed pixels, then clone) | 2026-10-23 | 45f8f4b4 | [261023-bxm-feat-i-d-like-to-send-the-current-paint-](./quick/261023-bxm-feat-i-d-like-to-send-the-current-paint-/) |
| 261023-cxc | Duplicate replays the source script onto the next free key (brush strokes / watercolor timeline) so Move/Select edits it; the bxm raster clone stays as fallback | 2026-10-23 | 4427ec0b | [261023-cxc-uat-follow-up-to-261023-bxm-the-bottom-t](./quick/261023-cxc-uat-follow-up-to-261023-bxm-the-bottom-t/) |
| 261023-f9c | Read-only script-memory measurement: DEV window.__EFX_SCRIPT_MEMORY__.snapshot() (watercolor per-frame totals, current brush frame, frame caches reported separately) + JSON-vs-versioned packed-binary codec prototype with round-trip tests | 2026-10-23 | 7d3572f8 | [261023-f9c-v2-0-0-read-specs-quick-prompts-studio-s](./quick/261023-f9c-v2-0-0-read-specs-quick-prompts-studio-s/) |
| 261023-g4p | Brush per-frame script store + DEV probe totals; one shared script-edition seam gives Brush Move the Water color select/drag/delete/restack UI | 2026-10-23 | 2c2fb99f | [261023-g4p-read-specs-quick-prompts-studio-brush-sc](./quick/261023-g4p-read-specs-quick-prompts-studio-brush-sc/) |
| 261023-h9v | In-session brush script rehydration on navigation: complete light brush frames restore silently into the engine (Move enabled on revisited keys); partial/heavy/diffusion frames fail closed to cached pixels. Fixes the clear-listener deleting the retained entry. | 2026-10-23 | 62bdaea4 | [261023-h9v-add-in-session-brush-script-rehydration-](./quick/261023-h9v-add-in-session-brush-script-rehydration-/) |
| 261023-j5b | Lazy brush script attach over cached pixels (instant navigation) + faithful live-deposit rebake on edits; Duplicate phantom, revisit-cache duplicate and Duplicate-in-Move overlay fixes; diffusion/physics frames fail closed. UAT passed 2026-10-23. | 2026-10-23 | be5b3e90 | [261023-j5b-replace-eager-brush-script-replay-on-nav](./quick/261023-j5b-replace-eager-brush-script-replay-on-nav/) |
| 261023-l35 | Persist the Studio script snapshot (watercolor timeline + per-frame brush ledger) to a Rust app-managed SNAP v1 binary cache keyed by project/layer/track; debounced save, close flush, launch restore, prune, fail-closed | 2026-10-23 | b3c23b1c | [261023-l35-v2-0-0-read-specs-quick-prompts-studio-s](./quick/261023-l35-v2-0-0-read-specs-quick-prompts-studio-s/) |
| 261023-o3n | Store the Studio script snapshot inside the .mce package at scripts/<layerId>/<trackId>-v1.snap via the scriptLibraryAuthority seam; cache kept for unsaved/missing fallback; Save As/Duplicate carries the per-layer folders | 2026-10-23 | 6987642a | [261023-o3n-v2-0-0-read-specs-quick-prompts-studio-s](./quick/261023-o3n-v2-0-0-read-specs-quick-prompts-studio-s/) |
| 261023-ors | Studio script-memory gauge Memory tab + confirmed per-key/active-rail purge with snapshot cleanup + rail-delete cascade | 2026-10-23 | c1132a13 | [261023-ors-v2-0-0-read-specs-quick-prompts-studio-s](./quick/261023-ors-v2-0-0-read-specs-quick-prompts-studio-s/) |
| 261024-hsd | update preact to 11.0.2 | 2026-10-24 | 0b15de7c | [261024-hsd-update-preact-to-11-0-2](./quick/261024-hsd-update-preact-to-11-0-2/) |
| 261024-i51 | Fix pre-existing typecheck and vitest baseline failures | 2026-10-24 | 25949add | [261024-i51-fix-pre-existing-typecheck-and-vitest-ba](./quick/261024-i51-fix-pre-existing-typecheck-and-vitest-ba/) |
| 261024-m20 | Remap watercolor scripts by key identity on accepted physical replaces; extract one shared key-identity frame map for roto, brush and watercolor | 2026-10-24 | 55a5a95f | [261024-m20-watercolor-key-spacing-remap](./quick/261024-m20-watercolor-key-spacing-remap/) |
| 261024-mz5 | Feat Studio: Add multiselect strokes (verify its already in brush) then Add rotation and scale for stroke(s) (single or multi select) | 2026-10-24 | 5e4c1b70 | [261024-mz5-feat-studio-add-multiselect-strokes-veri](./quick/261024-mz5-feat-studio-add-multiselect-strokes-veri/) |
| 261024-p5q | Studio stroke settings modal: selection-gated movable dialog for selected strokes (Brush Move / Water color Select) | 2026-10-24 | 72cfac43 | [261024-p5q-studio-stroke-settings-modal-add-a-selec](./quick/261024-p5q-studio-stroke-settings-modal-add-a-selec/) |
| 261024-vga | stack-order control for Brush Move and Water color Select stroke settings | 2026-10-25 | 475a3816 | [261024-vga-stack-order-control-for-brush-move-and-w](./quick/261024-vga-stack-order-control-for-brush-move-and-w/) |
| 261025-awl | One module per frame: detect the selected key's script owner, auto-switch on explicit frame selection, lock the non-owning Studio module slot, and add a confirmed Raster action that preserves pixels | 2026-10-25 | 8037302b | [261025-awl-auto-mode-switch-on-frame-is-detect-that](./quick/261025-awl-auto-mode-switch-on-frame-is-detect-that/) |
| 261025-co0 | Color palette: remove the per-swatch X, add selectable swatches with commit-time in-place color rewrite, and delete the selected swatch with Delete/Backspace | 2026-10-25 | ac9fa3a1 | [261025-co0-enhance-color-palette-remove-the-delete-](./quick/261025-co0-enhance-color-palette-remove-the-delete-/) |
| 261025-d3r | Brush Move hides the legacy pointing-hand cursor on hover (erase hover keeps it); held-Cmd momentary Move retained | 2026-10-25 | a8cb7897 | [261025-d3r-in-brush-there-is-the-old-move-code-with](./quick/261025-d3r-in-brush-there-is-the-old-move-code-with/) |
| 261026-nvq | Watercolor scripts save the live aquarelle sheet as the library thumbnail (multiply over paper) instead of the thin engine-1 guide strokes | 2026-10-26 | 312a4252 | [261026-nvq-could-you-fix-the-watercolor-thumb-in-sc](./quick/261026-nvq-could-you-fix-the-watercolor-thumb-in-sc/) |
| 261026-odd | Fix: actually create a rail with motion, reveal or static write just pixel and have no script for now but the Move tool is activated, it should not because these rails for now do not add stroke scripts (later yes like an option). If script is empty on a key -> no move (tool greyed) its a law we decided | 2026-10-26 | a74bf8cc | [261026-odd-fix-actually-create-a-rail-with-motion-r](./quick/261026-odd-fix-actually-create-a-rail-with-motion-r/) |
| 261027-gh9 | Watercolor-only UI gate + Chalk dry-media preset: one WATERCOLOR_ONLY seam, inert Brush/Krita slots, clamped setActiveModule, and a 15-card Brush tab | 2026-10-27 | be27a481 | [261027-gh9-watercolor-only-ui-gate-chalk-dry-brush-](./quick/261027-gh9-watercolor-only-ui-gate-chalk-dry-brush-/) |
| 261027-k6j | Script switch in the Studio top bar: On (default) records painted strokes into the key's watercolor script; Off paints pixels without writing or extending any script (existing scripts stay editable) | 2026-10-27 | e1d437fd | [261027-k6j-add-near-brush-dropdown-in-top-bar-an-on](./quick/261027-k6j-add-near-brush-dropdown-in-top-bar-an-on/) |
| 261027-klx | Remove 'engine-1' called Brush mode (efx-physic-paint) | 2026-10-27 | 52b82030 | [261027-klx-remove-engine-1-called-brush-mode-efx-ph](./quick/261027-klx-remove-engine-1-called-brush-mode-efx-ph/) |
| 261028-k03 | Lift (eraser) must erase live, scripted, and raster-only paint — settle the three-state truth table first | 2026-10-28 | 234655ad | [261028-k03-lift-eraser-must-erase-live-scripted-and](./quick/261028-k03-lift-eraser-must-erase-live-scripted-and/) |

### Roadmap Evolution

- Phase 51 edited: marked delivered via quicks 260902-cfa + 260902-cfa-amendments (no full phase cycle)
- Phase 52.1 inserted after Phase 52: Modern frame runtime + native HD paint (URGENT)
- Phase 52.2 inserted after Phase 52: Project package format — references only: sidecar .webp media files + per-layer manifests; absorbs and cancels the autosave quick (URGENT)
- Phase 52.3 inserted after Phase 52: Paint content export — per-frame compositor enumeration (quick 260919-azh verdict NEVER-WIRED; blocks Phase 53 acceptance) (URGENT)
- Phase 52.4 inserted after Phase 52: Real-paint kill the salt-and-pepper (URGENT)
- Phase 52.5 inserted after Phase 52: Physic Paint document sound track (Studio waveform/reposition/start-end + main-editor playback of the layer clip) (URGENT)
- Phase 53.1 inserted after Phase 53: Frame-model fix (release blocker from debug frame-model-coherence) (URGENT)

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
| debug_sessions | studio-blend-off-corruption | awaiting_human_verify | 2026-10-12 (v1.0.0) |
| debug_sessions | studio-track-physical-edits | fix-applied | 2026-10-12 (v1.0.0) |
| todos | 261003-d08-tier-parity-harness-rescope.md | (presence-only) | 2026-10-12 (v1.0.0) |
| quick_tasks | 260905-ibd-perf-stop-per-frame-workflowstrip-action | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260911-sli-surface-armed-solo-on-the-track-row | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260913-52r-52-2-cutover-regressions-f-e-c-d | missing | 2026-10-12 (v1.0.0) |
| quick_tasks | 260920-j5r-wr-01-52-3-guard-scrub-gap-entries-must- | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260920-k34-fond-preload-gate-export-must-read-the-a | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260924-m7w-quick-8b-physics-stroke-settles-bolder-t | incomplete | 2026-10-12 (v1.0.0) |
| quick_tasks | 260924-nqe-quick-8c-redo-bound-the-physics-settled- | incomplete | 2026-10-12 (v1.0.0) |
| quick_tasks | 260924-ort-water-coupled-deposit-cutoff-in-transfer | incomplete | 2026-10-12 (v1.0.0) |
| quick_tasks | 260924-pyp-measure-production-s-continuous-aa-raste | incomplete | 2026-10-12 (v1.0.0) |
| quick_tasks | 260928-dh1-paint-deposit-debug-kill-the-pixel-speck | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 260930-wm6-sans-cuisson-kill-the-post-stroke-cookin | automated-ready | 2026-10-12 (v1.0.0) |
| quick_tasks | 261009-6ee-audio-modal-grouped-field-layout-shared- | unknown | 2026-10-12 (v1.0.0) |
| quick_tasks | 261009-v0s-audio-properties-panel-re-flow-timeline- | unknown | 2026-10-12 (v1.0.0) |
| uat_gaps | 46/46-UAT.md | testing | 2026-10-12 (v1.0.0) |
| uat_gaps | 47/47-UAT.md | passed | 2026-10-12 (v1.0.0) |
| uat_gaps | 50/50-UAT.md | passed | 2026-10-12 (v1.0.0) |
| uat_gaps | 53/53-UAT.md | unknown | 2026-10-12 (v1.0.0) |
| verification_gaps | 46/46-VERIFICATION.md | human_needed | 2026-10-12 (v1.0.0) |
| verification_gaps | 47/47-VERIFICATION.md | human_needed | 2026-10-12 (v1.0.0) |
| verification_gaps | 52.1/52.1-VERIFICATION.md | human_needed | 2026-10-12 (v1.0.0) |
| verification_gaps | 36.2/36.2-VERIFICATION.md | gaps_found | 2026-10-12 (v1.0.0) |
| deferred_items | 52.2/deferred-items.md: Deferred Items — Phase 52.2  Out-of-scope discoveries found during execution (not caused by this phase's plans; do not fix here).  - **WINDOWS.md ledger coun... | acknowledged | 2026-10-12 (v1.0.0) |
| deferred_items | 52.5/deferred-items.md: 1. Pre-existing typecheck errors — `ToolType '"move"'` (3 errors)  - **Found during:** 52.5-01a Task 1 GREEN (full `pnpm --filter efx-motion-editor run typec... | acknowledged | 2026-10-12 (v1.0.0) |
| deferred_items | 52.5/deferred-items.md: 2. Pre-existing test suite failure — `PhysicsPaintStudioView.test.ts` (collection error)  - **Found during:** 52.5-01a Task 1 GREEN (full `vitest run`: 4443 ... | acknowledged | 2026-10-12 (v1.0.0) |

## Session Continuity

Last session: 2026-10-24T15:04:48.947Z
Stopped at: Completed 261024-mz5-PLAN.md
Resume file: None

## Operator Next Steps

- Verify the merged dev branch live (Studio paint, script/bake, modules, papers, UI)
- Run small quicks for cosmetic fixes found on dev; open a GSD debug only for a big bug
- QUICK-01 audio-trim-to-view remains the in-milestone quick
- Run `/gsd-audit-milestone` before `/gsd-complete-milestone`; do not tag/publish before the audit and the signed release checklist
- Phase 57 is retired: `packages/efx-spectral` stays as the engine-2 mixing package; engine-1 adoption is not part of v2.0.0
