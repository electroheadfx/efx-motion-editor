---
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
plan: 05
subsystem: core
tags: [physic-paint, multi-track, track-deletion, acknowledge-and-delete, hold-severing, sidecar-transaction, fail-closed, typescript, vitest]

# Dependency graph
requires:
  - phase: 46
    plan: 01
    provides: track-addressed runtime (Map<layerId, Map<trackId, T>>), per-track revisions, removeTrackRuntime (the complete per-track sweep), track-scoped operation leases with trackId tokens
  - phase: 46
    plan: 02
    provides: multi-track serialize/hydrate projection, per-track save/load carriers, trackId cache paths
  - phase: 46
    plan: 03
    provides: setActiveTrackId with the 45-01 docrev bump, stable track order in document.tracks
  - phase: 46
    plan: 04
    provides: per-track stale-async isolation laws the deletion path must not disturb
  - phase: 45
    provides: EfxPaintDocument v1.0 with stable UUID track ids, activeTrackId, and the 45-01 buildEfxPaintDocumentRevision builder
provides:
  - "Acknowledged track deletion (TRK-07, D-14): requestDeleteTrack(layerId, trackId) returns a closed TrackDeletePreview (frameCount, loopClipCount, holdReferenceCount, isLastTrack) before any mutation; commitDeleteTrack(layerId, trackId, acknowledged) refuses without the acknowledgement, for an unknown track, and for the last surviving Paint track ('last-track', D-17) — a refused delete writes nothing and the active track never moves (ASVS V4)"
  - "Full per-track teardown through 46-01 removeTrackRuntime (D-14 edge): frames, records, loopClips, caches, selection/cursor, leases (settled → 'replayed-token'), and the structural memo composite key are removed for exactly the deleted track; every survivor's maps and per-track revision values stay byte-identical"
  - "Hold severing (D-16/T-46-14): severTrackHoldReferences(layerId, deletedTrackId) counts and severs every surviving Hold Loop Clip referencing the deleted track's keyIds; the resolver's 'linked-unresolved' path (with missingSourceKeyIds) is the only answer the severed cells produce — never a dangling or foreign-track reference (D-13)"
  - "Nearest-adjacent activation (D-18): activeTrackId re-points deterministically to the next survivor by document order if any, else the previous (index+1 preferred over index-1 — executable test contract); a non-active track deletion keeps the active track"
  - "Transactional sidecar removal (D-15/T-46-15): EfxPaintDocumentSaveInput.deletions (validated by isSafeEfxPaintCachePath, ASVS V12) ride PreparedEfxPaintSave and are removed only in settlePreparedEfxPaintSave's commit arm — after the canonical publication settles, before the cache record; rollback never touches them; commitDeleteTrack registers the deleted track's cache/efx-paint/<stableSegment>/<trackId> dir in a pending list that projectStore merges into the next save input and that clears on read"
  - "Single dirty-signal law: the committed deletion bumps buildEfxPaintDocumentRevision (activeTrackId + tracks terms) and fires the injected dirty callback exactly once"
affects: [46-06, 47]

# Actuals — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 24000
  tasks: 3
  commits: 7

# Tech tracking
tech-stack:
  added: []
  patterns: [acknowledge-and-delete, hold-severing-with-verbatim-refs, nearest-adjacent activation, deletion-list-in-cache-transaction, single-dirty-signal]

key-files:
  created:
    - app/src/stores/trackDeleteLaws.test.ts
  modified:
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/lib/efxPaintPersistence.ts
    - app/src/stores/projectStore.ts

key-decisions:
  - "The deletion surface is known before any mutation: requestDeleteTrack counts the deleted track's runtime frames and loop-clip records, scans every surviving track's Hold clips for refs into the deleted track's keyIds (holdReferenceCount), and reports isLastTrack — the commit path then refuses fail-closed without the acknowledgement, for an unknown track, and for the last track (D-14/D-17, ASVS V4)"
  - "The teardown reuses 46-01's removeTrackRuntime unchanged — no second teardown implementation; the commit path orders sever-holds → removeTrackRuntime → rebuild, so severing reads the deleted track's keyIds before they are torn down"
  - "Hold severing keeps sourceKeyIds verbatim (D-31): the canonical clip guard rejects the empty-refs form (isPhysicPaintRotoLoopClip requires sourceKeyIds.length > 0, the resolver throws on guard failure), so 'refs emptied' is impossible; severTrackHoldReferences returns the severed count, replaces the affected tracks' clip-array identity to invalidate the structural memo, and the resolver's existing 'linked-unresolved' path answers the same cells fail-closed (D-13) — the executable contract of the plan's Test 2"
  - "Nearest-adjacent is next-first: the plan's action prose says 'index-1 else index+1' but the plan's own executable Test 3 says deleting B re-points to C (index+1); the test contract wins — remainingTracks[deletedIndex] ?? remainingTracks[deletedIndex - 1] — which satisfies all three cases (delete B → C, delete A → first survivor, delete C → previous)"
  - "The commit path re-points activeTrackId directly in the rebuilt document instead of calling setActiveTrackId: setActiveTrackId fires _notifyChange, which would double the dirty callback — the rebuild keeps the single-notify law; the rebuilt document re-projects every surviving track from the runtime (extractRuntimeStateForDocument + buildEfxPaintFrameCachePath, the runtime is the authority) so severed Hold clips and post-sever state are durable"
  - "Sidecar deletion rides the tracked save transaction (D-15): the deletions list is settled only in the commit arm (after the canonical publication, before savedDocumentCache.clear), failures are non-authoritative, rollback never touches deletions; takePendingTrackDeletions clears on read, so a failed save after the read loses the pending list (documented limitation — the sidecar dirs remain on disk, unreferenced)"

requirements-completed: [TRK-07]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: C1
    description: "Acknowledged-delete preview (D-14): requestDeleteTrack returns a complete TrackDeletePreview (frames, clips, Hold references to sever, isLastTrack) without mutating the document or the runtime; null for an unknown track or absent document"
    verification:
      - kind: unit
        ref: "app/src/stores/trackDeleteLaws.test.ts#requestDeleteTrack preview (46-05 D-14)"
        status: pass
    human_judgment: false
  - id: C2
    description: "Acknowledge gate and last-track refusal (D-14/D-17): commitDeleteTrack fails closed without acknowledged === true, for an unknown track, and for the last surviving Paint track — a refused delete writes nothing, the document stays byte-identical, and the active track never moves"
    verification:
      - kind: unit
        ref: "app/src/stores/trackDeleteLaws.test.ts#commitDeleteTrack acknowledge gate (46-05 D-14)"
        status: pass
    human_judgment: false
  - id: C3
    description: "Full per-track teardown (D-14 edge): after commitDeleteTrack, the deleted track's frames, records, loopClips, projection (structural memo), selection, and leases are gone (lease validate answers 'replayed-token'); the survivor's frames, records, and per-track revision value are byte-identical; the document no longer lists the track"
    verification:
      - kind: unit
        ref: "app/src/stores/trackDeleteLaws.test.ts#commitDeleteTrack full per-track teardown (46-05 D-16)"
        status: pass
    human_judgment: false
  - id: C4
    description: "Hold severing (D-16/T-46-14): severTrackHoldReferences returns the count of surviving Hold clips referencing the deleted track's keyIds (own-track Hold clips and the deleted track's own clips untouched); after commit the resolver answers 'linked-unresolved' with missingSourceKeyIds (render source 'loop-placeholder') and the rebuilt document carries the severed Hold verbatim (D-31)"
    verification:
      - kind: unit
        ref: "app/src/stores/trackDeleteLaws.test.ts#commitDeleteTrack hold severing (46-05 D-16 / T-46-14)"
        status: pass
    human_judgment: false
  - id: C5
    description: "Nearest-adjacent activation (D-18): deleting a middle track re-points activeTrackId to the next survivor, deleting the first re-points to the first survivor, deleting the last re-points to the previous survivor, and deleting a non-active track keeps the active track"
    verification:
      - kind: unit
        ref: "app/src/stores/trackDeleteLaws.test.ts#commitDeleteTrack nearest-adjacent activation (46-05 D-18)"
        status: pass
    human_judgment: false
  - id: C6
    description: "Single dirty signal: the committed deletion bumps buildEfxPaintDocumentRevision (activeTrackId + tracks terms) and fires the injected project-dirty callback exactly once"
    verification:
      - kind: unit
        ref: "app/src/stores/trackDeleteLaws.test.ts#commitDeleteTrack revision and dirty signaling (46-05)"
        status: pass
    human_judgment: false
  - id: C7
    description: "Sidecar deletion in the cache transaction (D-15): a committed save removes exactly the deleted track's sidecar directory via fs remove() inside the transaction (no survivor directory), rollback never calls remove, and the pending deletion list clears on read so a second save is a deletion no-op; the deletions list paths all pass isSafeEfxPaintCachePath"
    verification:
      - kind: unit
        ref: "app/src/stores/trackDeleteLaws.test.ts#commitDeleteTrack sidecar deletion through the cache transaction (46-05 D-15)"
        status: pass
    human_judgment: false
  - id: C8
    description: "No regression: the plan verification suites (trackDeleteLaws, trackIsolation, efxPaintPersistence — 51 tests) and the full suite (2781 passed / 1 skipped / 101 todo / 0 failed / 150 files) are green; pnpm --dir app run typecheck clean"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: C9
    description: "Live native UAT of the Studio track-deletion surface (the delete confirmation dialog with the destruction surface, the last-track refusal surface, Hold cells answering as unresolved placeholders after a delete, and the next-save sidecar cleanup) — unit tests cannot judge the interactive multi-track window behavior"
    verification: []
    human_judgment: true
    rationale: "The plan's truth contracts are all unit-proven (preview/acknowledge/teardown/severing/adjacency/sidecar-transaction), but the interactive Studio surface requires live native UAT"
# Metrics
duration: 35min
completed: 2026-08-24
status: complete
---

# Phase 46 Plan 05: Acknowledged Track Deletion Summary

**Deleting an internal track is acknowledge-and-delete: a closed preview reports the full destruction surface before any mutation, the commit refuses without acknowledgement (and refuses the last track), tears down exactly that track through the 46-01 runtime sweep, severs every Hold reference that could outlive it, re-activates the nearest survivor, and removes its sidecars inside the same cache transaction as the next save**

## Performance

- **Duration:** ~35 min wall clock (00:47:55 first Task-1 test commit to 01:02:xx final Task-3 feat commit)
- **Started:** 2026-08-24T00:47:55Z (Task 1 test commit)
- **Completed:** 2026-08-24T01:02:xxZ (Task 3 feat commit)
- **Tasks:** 3
- **Commits:** 7 (6 task commits: 3 test + 3 feat — plus this close-out)
- **Files modified:** 5

## Accomplishments

- **Acknowledge-and-delete with a closed preview (TRK-07, D-14):** `requestDeleteTrack(layerId, trackId)` returns a `TrackDeletePreview` — `frameCount` (the deleted track's real-key runtime frames), `loopClipCount` (its Loop Clip records), `holdReferenceCount` (every surviving track's Hold clips referencing the deleted track's keyIds), and `isLastTrack` — computed before any mutation. `commitDeleteTrack(layerId, trackId, acknowledged)` refuses fail-closed without `acknowledged === true`, for an unknown track, and for the last surviving Paint track (`'last-track'`, D-17) — a refused delete writes nothing and the active track never moves.
- **Complete per-track teardown through 46-01:** the commit path calls `severTrackHoldReferences` then `removeTrackRuntime(layerId, trackId)` — the exported 46-01 sweep removes frames, records, loopClips, caches, selection/cursor, the structural memo composite key, settles the track's operation leases (`validate...` answers `'replayed-token'`), and prunes unreferenced alpha canvases. Every survivor's maps and per-track revision values stay byte-identical (proven against A before/after deleting B).
- **Hold severing (D-16/T-46-14):** `severTrackHoldReferences(layerId, deletedTrackId)` returns the number of surviving Hold Loop Clips referencing the deleted track's keyIds. The resolver answers `'linked-unresolved'` for the severed cells — the render source surfaces the `'loop-placeholder'` variant (D-28), never a dangling or foreign-track reference. The rebuilt document re-projects the survivor from the runtime so the severed Hold's verbatim refs are durable (D-31).
- **Nearest-adjacent activation (D-18):** deleting a middle track re-points `activeTrackId` to the next survivor (index+1); deleting the first re-points to the first survivor; deleting the last re-points to the previous; deleting a non-active track keeps the active track. The re-point happens in the rebuilt document so the dirty callback fires exactly once per committed deletion.
- **Sidecar deletion rides the cache transaction (D-15):** `EfxPaintDocumentSaveInput.deletions` (validated by `isSafeTrackCachePath`) flows into `PreparedSave.deletions`; the commit arm of `settlePreparedSave` removes each directory after the canonical publication settles and before the cache record — a rollback never touches them. `commitDeleteTrack` registers the deleted track's `cache/efx-paint/<stableSegment(layerId)>/<trackId>` dir in a pending list that `projectStore.buildEfxPaintDocuments` merges into the next save input and that clears on read; `reset()` clears it.
- **Gates:** plan suites (trackDeleteLaws 15 tests, trackIsolation 25, efxPaintPersistence 11 — 51 total) green; full suite 2781 passed / 1 skipped / 101 todo / 0 failed / 150 files; `pnpm --dir app run typecheck` clean.

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: acknowledge-and-delete preview + last-track refusal (D-14/D-17)** - `70bb74ad` (test) + `b3c02c1d` (feat)
2. **Task 2: teardown + Hold severing + nearest-adjacent activation (D-16/D-18)** - `9c9dbb4f` (test) + `3a3364ac` (feat)
3. **Task 3: sidecar deletion through the cache transaction (D-15)** - `9b5aba4a` (test) + `4aef89ae` (feat)

**Plan metadata:** close-out commit follows this summary.

## Files Created/Modified

- `app/src/stores/trackDeleteLaws.test.ts` - Created: the full 46-05 suite (15 tests) with multi-track fixtures, Hold fixtures, an in-memory fs/ipc double for the D-15 transaction tests
- `app/src/stores/efxPaintStore.ts` - Modified: `TrackDeletePreview`, `requestDeleteTrack`, `commitDeleteTrack` (sever → teardown → rebuild with nearest-adjacent re-point → single dirty), `takePendingTrackDeletions` + the pending map, `reset` clears the pending list
- `app/src/stores/physicPaintStore.ts` - Modified: `severTrackHoldReferences` (counts and severs surviving Hold-Hold refs into the deleted track; verbatim refs, memo invalidation)
- `app/src/lib/efxPaintPersistence.ts` - Modified: `EfxPaintDocumentSaveInput.deletions`, `PreparedEfxPaintSave.deletions`, prepare collects/validates/dedupes, settle commit arm removes them
- `app/src/stores/projectStore.ts` - Modified: `buildEfxPaintDocuments` merges `takePendingTrackDeletions(layerId)` into each layer's save input

## Decisions Made

- **Preview before mutation (D-14/ASVS V4):** the preview reports the full destruction surface (frames, clips, Hold refs to sever, last-track flag) and the mutation refuses without the explicit acknowledgement — the dialog can show exactly what will be destroyed before the commit exists.
- **Severs Hold refs by keep-verbatim, not by emptying:** the canonical clip guard rejects empty `sourceKeyIds`, so the literal 'refs emptied' form would break the resolver; the severed refs stay verbatim (D-31) and the resolver answers `'linked-unresolved'` with the missing keyIds (D-13) — the plan's own Test 2 executable contract.
- **Nearest-adjacent is next-first:** the plan's prose says 'previous if any, else next' but its Test 3 says deleting B re-points to C (index+1) — the test contract wins and satisfies all three adjacency cases.
- **The re-point never calls `setActiveTrackId`:** direct assignment in the rebuilt document keeps the single dirty-callback law (setActiveTrackId would fire a second `_notifyChange`).
- **The save re-projects the surviving tracks from the runtime:** the runtime is the authority after a delete; the rebuilt document carries the live survivor state (severed Hold refs verbatim) instead of the pre-delete snapshot.

## Issues Encountered

- **`severTrackHoldReferences` missing initially (RED):** the Task 2 test file failed on the not-yet-implemented export as required.
- **fs/ipc mock path resolution:** `vi.mock('./ipc')` from the stores test file resolves to a non-existent `app/src/stores/ipc` — the persistence module's real `./ipc` load then hit the live module. Fixed by mocking `'../lib/ipc'` (the same absolute module id).
- **Generation-exchange wipe vs on-disk assertions:** the persistence-test mock's `exchangeGeneration` replaces the canonical root on publish, which would make 'deleted dir is gone' pass trivially and made the commit-arm `exists` check see a wiped state; the tests seed the sidecar dirs in the `writeProject` callback (the moment they exist on disk at commit time) and pin `vi.mocked(remove)` call contracts rather than on-disk state.
- **Type-check hygiene:** the Task 1 test file's unused imports (planned for later tasks) were removed at the Task 1 typecheck and re-added when their symbols shipped.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The deletion law is complete: acknowledge gate, preview, complete per-track teardown, Hold severing, nearest-adjacent activation, and transactional sidecar removal are all unit-proven (TRK-07).
- The `takePendingTrackDeletions` seam is in place for 46-06 (the Studio track-delete dialog and any remaining deletion UI surfaces).
- 46-06 can build directly on the acknowledged-delete path without authority-scope surprises.
- No blockers; full suite and typecheck green.
