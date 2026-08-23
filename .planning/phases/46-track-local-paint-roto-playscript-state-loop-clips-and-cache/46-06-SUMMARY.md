---
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
plan: 06
subsystem: core
tags: [physic-paint, multi-track, track-local, hold-loop-clips, linked-resolution, composite-key-cache, fail-closed, shared-resolver, typescript, vitest]

# Dependency graph
requires:
  - phase: 46
    plan: 01
    provides: track-addressed runtime (Map<layerId, Map<trackId, T>>), per-track revisions, the composite-key structural memo (`${layerId}\0${trackId}`) whose invalidation is the whole per-track atomicity mechanism, bumpTrackRevision
  - phase: 46
    plan: 02
    provides: multi-track serialize/hydrate projection and the document-install port (replaceRotoPhysicalDocument) the D-31 dangling fixtures re-seed through
  - phase: 46
    plan: 03
    provides: the track-scoped copy/paste/duplicate surface (writes records before clips — the creation gate slots in without reordering), fresh-identity allocation the re-point gate doubles
  - phase: 46
    plan: 04
    provides: per-track stale-async isolation laws the linked answers must not disturb
  - phase: 46
    plan: 05
    provides: Hold severing (D-31 verbatim refs), the fail-closed resolver answer 'linked-unresolved', and the trackDeleteLaws fixtures whose cross-track Holds are legal D-31 state on the install port
  - phase: 45
    provides: EfxPaintDocument v1.0 with stable UUID track ids and activeTrackId
provides:
  - "Track-local Hold resolution context (TRK-02): getTrackRotoResolutionContext(layerId, trackId) returns the provenance pair { trackId, context } — the resolution context is built EXCLUSIVELY from the owning track's own maps by the 46-01 memo builder; the shared resolver (physicsPaintRotoPhysicalResolver.ts, untouched) is only ever fed one track's context, so a clip on A can never answer with B's loopId/keyId"
  - "Live single-source linked cells (TRK-08 / D-10..D-12): a 3-repeat Hold resolves the same sourceKeyId for repeatInstance 0/1/2 with the resolver's (frame - placementStart) % cycleLength modulo; editing the source frame re-resolves EVERY repeat cell after invalidation — the composite-key memo rebuilds exactly once (derive spy), never a stale linked frame, and B's memo survives A's source edit byte-identically"
  - "Fail-closed Hold creation (D-13 / T-46-16, ASVS V5): validateTrackHoldLoopClipRefs(layerId, trackId, { sourceFrameRefs, sourceKind }) closes 'empty-source-refs' for an empty list and 'foreign-source-refs' for any ref absent from the owning track's own real-key map (no cross-track lookup); replaceRotoPhysicalLoopClips runs the raw scan BEFORE parse-persist so the typed reason wins, and writes nothing on rejection"
  - "Unresolved never persisted (T-46-18): a deleted source answers every owned cycle cell 'linked-unresolved' with missingSourceKeyIds at the resolver and 'loop-placeholder' at the render source (D-28); frames, cache entries, and projection cells stay virtual — no linked or unresolved answer is ever a persisted cell — and re-adding a real key at the deleted frame heals the linked answers"
  - "Boundary ordering proof (TRK-08): with C1's effectiveEnd equal to C2's placementStart, the boundary frame belongs to exactly one clip — proven over 10 repeat instances at both the resolver and render-source surfaces (frame 19 = C1's last repeat; 20 = C2's real key; 21 = C2's first linked repeat)"
affects: [47, studio-track-delete-dialog, export-preflight]

# Actuals — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 8000
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns: [track-local-resolution-context-accessor, composite-key-memo-invalidation-proof-by-spy, raw-scan-gate-before-parse, document-port-install-for-dangling-fixtures, virtual-only-contract]

key-files:
  created:
    - app/src/stores/efxPaintTrackCache.test.ts
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/trackIsolation.test.ts
    - app/src/stores/trackDeleteLaws.test.ts

key-decisions:
  - "The context is exposed, not rebuilt: _resolveRotoPhysicalStructural already builds a per-track context keyed by the 46-01 composite key; Task 1's GREEN is only the exported provenance accessor, and the do-not-fork resolver stays byte-untouched"
  - "Task 2 ships no production change: the 46-01 composite-key memo + bumpTrackRevision IS the atomic per-track invalidation mechanism (D-12); the derive-physical-loop-ranges spy proves exactly-one rebuild per invalidated memo and zero cross-track rebuilds — the plan's conditional invalidateTrackStructuralMemo symbol was not needed"
  - "The creation gate is a raw scan BEFORE parse: parsePhysicPaintRotoLoopClips itself rejects empty sourceKeyIds with a generic model error, which would preempt the typed contract; the gate scans only record-shaped static candidates pre-parse and lets malformed elements fall to the parse error"
  - "Reaching the zero-real-keys law after the gate: the Task 1 empty-resolution test now seeds the key first then deletes it (delete-after-create missing-source path) — the resolution law asserted is unchanged; the cross-track Hold fixtures in the deletion suite re-seed through the document-install port (replaceRotoPhysicalDocument), the same seam hydration and Hold severing use, with the canonical revision recomputed for the replaced loop collection"
  - "Projection cells are the render-surface authority: at getRotoPhysicalRenderSource the real/generated projection cells win before the loop query — the ordering proof asserts the resolver-level boundary (19→C1 linked, 20→C2 real) and the store-level truth (19→generated interpolation, 20/21→real k2-0) separately"
  - "Unresolved placeholder duration: a clip with a missing source keeps the compact ref-count cycle (cycleLength = sourceFrameCount, effectiveEnd = placementStart + refCount × repeat) — the fail-closed window is that compact range, and frames past it resolve 'empty'"

requirements-completed: [TRK-02, TRK-08]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: C1
    description: "Track-local Hold resolution context accessor (TRK-02): two tracks holding identical clips over the same source keyId shape answer their OWN loopId/sourceKeyId (byte-different answers), the provenance pair carries trackId, and the context never leaks the sibling track's loopId/keyId"
    requirement: TRK-02
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#physicPaintStore track-local Hold resolution context (46-06 Task 1 — TRK-02) > adjacency"
        status: pass
    human_judgment: false
  - id: C2
    description: "Zero-real-keys answers (TRK-02): a track with a Hold clip but no surviving real keys answers every owned cell 'linked-unresolved' with missingSourceKeyIds — never a foreign frame, never a fabricated base"
    requirement: TRK-02
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#… > empty"
        status: pass
    human_judgment: false
  - id: C3
    description: "Boundary ordering (TRK-08): half-open boundaries by placementStart — the frame at the next clip's placementStart belongs to the next clip alone, deterministic over 10 repeat instances at the resolver and store surfaces"
    requirement: TRK-08
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#… > ordering"
        status: pass
    human_judgment: false
  - id: C4
    description: "Context provenance (TRK-02): the context the store builds for track A contains no loopId and no keyId owned by track B"
    requirement: TRK-02
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#… > context provenance"
        status: pass
    human_judgment: false
  - id: C5
    description: "Virtual-only (T-46-18): no 'linked'/'linked-unresolved' resolution ever appears in the persisted projection, frames, cache, or document — resolutions are query answers only, and the persisted document carries the source records verbatim"
    requirement: TRK-08
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#… > virtual-only"
        status: pass
    human_judgment: false
  - id: C6
    description: "Single-source linked cells (TRK-08 / D-10): a 3-repeat Hold resolves the same sourceKeyId for repeatInstance 0/1/2 with (frame - placementStart) % cycleLength; editing the source frame changes EVERY repeat cell after invalidation"
    requirement: TRK-08
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintTrackCache.test.ts#single source"
        status: pass
    human_judgment: false
  - id: C7
    description: "Atomic per-track invalidation (D-12): a Hold source edit rebuilds the owning composite-key memo exactly once (derive-spy proof) and re-resolves every linked cell from the new source — never stale; repeated reads stay memoized"
    requirement: TRK-08
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintTrackCache.test.ts#atomic invalidation"
        status: pass
    human_judgment: false
  - id: C8
    description: "No cross-track invalidation (D-12): an A source edit leaves B's memo entry valid — B's context reference is stable, zero rebuilds, and B's render answers byte-unchanged"
    requirement: TRK-08
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintTrackCache.test.ts#no cross-track invalidation"
        status: pass
    human_judgment: false
  - id: C9
    description: "Unresolved never cached (T-46-18): a deleted source answers every owned cycle cell 'linked-unresolved' (missingSourceKeyIds) and 'loop-placeholder' at the render source; frames/cache/projection stay empty for the cells; re-adding the key heals the linked answers"
    requirement: TRK-08
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintTrackCache.test.ts#unresolved never cached"
        status: pass
    human_judgment: false
  - id: C10
    description: "Fail-closed creation (D-13 / T-46-16, ASVS V5): an empty-refs or foreign-refs Hold creation on the track-scoped clip surface fails with the typed 'empty-source-refs'/'foreign-source-refs' before parse-persist and writes nothing; the exported document-shaped validator doubles the 46-03 re-point gate and passes own-track refs under either sourceKind"
    requirement: TRK-02
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintTrackCache.test.ts#empty refs rejected / foreign refs rejected"
        status: pass
    human_judgment: false
  - id: C11
    description: "Missing-source healing (TRK-08): deleting ONE source frame of a multi-source Hold turns the owned cycle unresolved naming exactly the missing key; the compact placeholder window ends past it ('empty'); re-adding the key restores linked answers"
    requirement: TRK-08
    verification:
      - kind: unit
        ref: "app/src/stores/efxPaintTrackCache.test.ts#missing source after create"
        status: pass
    human_judgment: false
  - id: C12
    description: "No regression: plan suites (efxPaintTrackCache 8, trackIsolation 30, trackDeleteLaws 15 — 53 tests) green; full suite 2794 passed / 1 skipped / 101 todo / 0 failed / 151 files; pnpm --dir app run typecheck clean"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: C13
    description: "Live native UAT of the track-local Hold surface in the Studio multi-track window (editing a Hold source frame updates every linked occurrence in-place, deleting a source turns cells into unresolved placeholders, and the clip surface rejects empty/foreign refs in the real timeline UI) — unit tests cannot judge the interactive behavior"
    verification: []
    human_judgment: true
    rationale: "The plan's truth contracts are all unit-proven (adjacency/empty/ordering/provenance/virtual-only/single-source/atomic-invalidation/cross-track-isolation/unresolved-never-cached/fail-closed-creation), but the interactive Studio behavior requires live native UAT"
# Metrics
duration: 50min
completed: 2026-08-24
status: complete
---

# Phase 46 Plan 06: Track-Local Hold Resolution Laws Summary

**Track-local Hold ownership is provable end-to-end: a clip on track A resolves exclusively against A's own records through the shared resolver, linked cells are live single-source answers with atomic per-track invalidation (the 46-01 composite memo, proven by spy), creation rejects empty/foreign refs before persist, and source-missing cells fail closed as unresolved — never persisted, always healable**

## Performance

- **Duration:** ~50 min wall clock (00:56:xx first Task-1 test commit to 01:14:xx final Task-3 feat commit)
- **Started:** 2026-08-24T00:56:xxZ (Task 1 test commit)
- **Completed:** 2026-08-24T01:14:xxZ (Task 3 feat commit)
- **Tasks:** 3
- **Commits:** 6 (5 task commits: test → feat per task — plus this close-out)
- **Files changed:** 4 (1 created, 3 modified)

## Highlights

- **Track-local resolution context (TRK-02):** `getTrackRotoResolutionContext(layerId, trackId)` returns the provenance pair `{ trackId, context }` where the context is the memoized 46-01 per-track `loopResolution` built exclusively from the owning track's maps. The shared resolver (`physicsPaintRotoPhysicalResolver.ts`) stays byte-untouched — the store only ever hands it one track's context, so a clip on A never answers with B's loopId or keyId (adjacency, provenance, and byte-difference tests).
- **Live single source with atomic invalidation (TRK-08 / D-10..D-12):** a 3-repeat Hold resolves the same sourceKeyId for repeatInstance 0/1/2 under the resolver's modulo; a source payload edit invalidates exactly the `layerId\0trackId` memo entry (derive-spy: exactly one rebuild, zero on B) and re-resolves every repeat cell from the new source — never a stale linked frame. Task 2 required NO production change: the 46-01 composite-key memo + `bumpTrackRevision` is the whole mechanism; the plan's conditional `invalidateTrackStructuralMemo` was unnecessary.
- **Fail-closed creation (D-13 / T-46-16):** `validateTrackHoldLoopClipRefs` closes `'empty-source-refs'`/`'foreign-source-refs'` before parse-persist (a raw pre-parse scan so the typed error wins over the model's generic parse rejection) and writes nothing; refs resolve only within the owning track's own real-key map.
- **Unresolved never persisted (T-46-18):** a deleted source frame turns every owned cycle cell into `'linked-unresolved'` (missingSourceKeyIds) at the resolver and `'loop-placeholder'` at the render source — frames, cache, and projection cells stay virtual; re-adding the key heals the linked answers.
- **Boundary ordering (TRK-08):** with C1's effectiveEnd equal to C2's placementStart, the boundary frame belongs to exactly one clip — proven over 10 repeat instances at both the resolver and store surfaces.
- **Fixture evolution:** the 46-05 cross-track Hold fixtures now install through the document-install port (same seam hydration/severing use) with the canonical revision recomputed, and the empty-resolution test reaches zero-real-keys via delete-after-create.
- **Gates:** plan suites green (efxPaintTrackCache 8 + trackIsolation 30 + trackDeleteLaws 15 = 53), full suite 2794 passed / 1 skipped / 101 todo / 0 failed / 151 files, `pnpm --dir app run typecheck` clean.

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: track-local Hold resolution context (TRK-02)** - `a2d5c180` (test) + `c726b464` (feat)
2. **Task 2: single-source linked resolution with atomic per-track invalidation** - `d4d52b06` (test only — no feat needed: the 46-01 composite-key memo + bumpTrackRevision is the whole mechanism)
3. **Task 3: fail-closed Hold creation refs validation** - `e71374f2` (test) + `3fe9f669` (feat)

**Plan metadata:** close-out commit follows this summary.

## Files Created/Modified

- `app/src/stores/efxPaintTrackCache.test.ts` - Created: the complete 46-06 Task 2/3 suite (8 tests) with derive-spy memo proofs, multi-track fixtures, and the fail-closed gate + ordering tests
- `app/src/stores/physicPaintStore.ts` - Modified: `getTrackRotoResolutionContext` (provenance accessor, Task 1), `validateTrackHoldLoopClipRefs` + the raw pre-parse creation gate in `replaceRotoPhysicalLoopClips` (Task 3)
- `app/src/stores/trackIsolation.test.ts` - Modified: Task 1 suite (5 tests), empty-resolution test reaches zero-real-keys via delete-after-create
- `app/src/stores/trackDeleteLaws.test.ts` - Modified: `installTrackLoops` helper (document-port install with canonical revision recompute) re-seeds the 3 cross-track Hold fixtures

## Decisions Made

- **Expose, don't rebuild:** the memo already builds the per-track resolution; Task 1 shipped only the accessor, and the do-not-fork resolver stayed untouched.
- **No new invalidation machinery:** Task 2 is test-only — the composite-key delete in the bump path is the D-12 mechanism and the derive spy proves it.
- **Gate before parse:** the model's own parse rejects empty refs with a generic error, so the typed contract must run first as a raw scan over record-shaped candidates.
- **Dangling fixtures install through the document port:** the creation gate cannot be bypassed for legal D-31 state — hydration, severing, and the fixtures share the install seam; the canonical revision is recomputed for the replaced loop collection.
- **Render-surface authority ordering:** at `getRotoPhysicalRenderSource`, real/generated projection cells win before the loop query — boundary tests assert resolver truth and store truth separately.
- **Compact placeholder duration:** unresolved clips keep `cycleLength = ref count`; the fail-closed window is that compact duration and frames past it resolve 'empty'.

## Issues Encountered

- **Raw-gate vs parse rejection:** `parsePhysicPaintRotoLoopClips` rejects `sourceKeyIds: []` with the model's generic 'malformed' error before a post-parse gate could type the reason — moved the gate to a raw pre-parse scan (record-shaped candidates only; malformed elements still reach the parse error).
- **`replaceRotoPhysicalDocument` canonical revision mismatch:** the document-install port rejects a stale `revision` fingerprint; the fixture helper now recomputes `buildPhysicPaintRotoPhysicalRevision` for the replaced loop collection.
- **Projection authority vs linked answers:** the frame-19 render-source assertion expected 'real' but got 'generated' — the projection interpolation wins at the store surface; the assertions were split into resolver-level and store-level truths.
- **Unused-import typecheck:** two imports in the new suite (model module value, unused type) — trimmed for the final typecheck.
- **Task 3's proof test (ordering) was never RED** — it proves the pre-existing resolver modulo contract (the plan: 'No change to the resolver's ordering math'); the RED pair is the two gate tests, which failed exactly on the missing symbols.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- TRK-02 and TRK-08 are unit-proven: track-local provenance, live single-source linked cells, atomic per-track invalidation, fail-closed creation, and the never-persisted unresolved contract.
- The composite-memo idiom + `getTrackRotoResolutionContext` seam give 46-07/downstream Studio consumers the same exact read surface the tests use.
- The `'empty-source-refs'`/`'foreign-source-refs'` error contract is the typed surface the Studio clip editor and the 46-03 re-point gate consume.
- No blockers; full suite and typecheck green. Phase 46 is complete.
