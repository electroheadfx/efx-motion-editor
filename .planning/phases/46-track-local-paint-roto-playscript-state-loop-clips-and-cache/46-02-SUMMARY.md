---
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
plan: 02
subsystem: core
tags: [physic-paint, multi-track, projection, persistence, cache-paths, track-local-state, typescript, vitest]

# Dependency graph
requires:
  - phase: 46
    plan: 01
    provides: track-addressed runtime (Map<layerId, Map<trackId, T>>), track-scoped extract/install accessors, per-track revisions
  - phase: 45
    provides: EfxPaintDocument v1.0 with stable UUID track ids and activeTrackId
provides:
  - "Multi-track serialize/hydrate projection: serializeRuntimeIntoDocument iterates document.tracks by id (never tracks[0]) and projects each track's runtime payload into that exact track; hydrateRuntimeFromDocument(document, perTrackFrames) installs each track's frames + rotoPhysical keyed by trackId"
  - "TrackId cache paths: buildEfxPaintFrameCachePath(layerId, trackId, frame) emits cache/efx-paint/<stableSegment>/<trackId>/frame-NNNNNN-NNNN.png, every path passing isSafeEfxPaintCachePath (D-15 foundation, T-46-04)"
  - "Per-track save/load frame carriers (trackId → appFrame → frame) in EfxPaintDocumentSaveInput / EfxPaintLoadedDocument; two tracks persist frames at the same appFrame without collision (TRK-03 edge resolved explicit)"
  - "TrackId-augmented save fingerprint terms so identical bytes on distinct tracks stay distinct (T-46-06)"
  - "projectStore funnel wiring: buildEfxPaintDocuments collects per-track frame maps keyed by document.tracks ids; the hydrate seam passes per-track frames through"
affects: [46-03, 46-04, 46-05, 46-06]

# Actuals — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 38000
  tasks: 3
  commits: 8

# Tech tracking
tech-stack:
  added: []
  patterns: [track-id-keyed cache paths, per-track frame carriers, track-augmented fingerprint terms, iterate-by-id projection]

key-files:
  created:
    - app/src/efx-paint/document/efxPaintMultiTrackProjection.test.ts
  modified:
    - app/src/stores/efxPaintStore.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/lib/efxPaintPersistence.ts
    - app/src/stores/projectStore.ts
    - app/src/stores/efxPaintStore.test.ts
    - app/src/lib/efxPaintPersistence.test.ts
    - app/src/stores/projectStore.efxPaintCutover.test.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/stores/physicPaintStore.test.ts
    - app/src/stores/sequenceStore.test.ts

key-decisions:
  - "serializeRuntimeIntoDocument / hydrateRuntimeFromDocument iterate document.tracks by stable id — never tracks[0] (Pitfall 1); each track's runtime payload projects into that exact track"
  - "Cache paths embed the raw UUID trackId between the stable layer segment and the file name so track deletion can address exactly its own sidecars (D-15); every emitted path still passes isSafeEfxPaintCachePath (T-46-04, ASVS V12)"
  - "The save input / load output carry per-track frame maps (trackId → appFrame → frame); two tracks may persist frames at the same appFrame without collision (edge TRK-03 ordering resolved explicit)"
  - "Save fingerprint byte terms include the trackId (trackId:appFrame:dataUrl) so identical bytes on distinct tracks never dedupe incorrectly (T-46-06)"
  - "installRuntimeStateFromDocument fails closed when payload.trackId does not match the claimed trackId — the projection seam rejects cross-track writes"

requirements-completed: [46-02 TRK-01, TRK-03]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: C1
    description: "Multi-track serialize projects each track's payload into that exact track by id (never tracks[0]); empty tracks project without error; documentRevision fingerprint stays 45-01"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintMultiTrackProjection.test.ts (5 tests) + app/src/stores/efxPaintStore.test.ts"
        status: pass
    human_judgment: false
  - id: C2
    description: "Multi-track hydrate installs each track's frames + rotoPhysical under its own trackId; getFrame(layerId, trackA, 5) and getFrame(layerId, trackB, 5) return their own bytes"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintMultiTrackProjection.test.ts#two-track hydrate"
        status: pass
    human_judgment: false
  - id: C3
    description: "Round-trip identity: runtime → serialize → hydrate → runtime preserves track IDs, frame keys, roto key IDs, and revisions per track"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/document/efxPaintMultiTrackProjection.test.ts#round-trip identity"
        status: pass
    human_judgment: false
  - id: C4
    description: "TrackId cache paths: buildEfxPaintFrameCachePath embeds the raw UUID trackId between the stable layer segment and the file name; isSafeEfxPaintCachePath accepts every emitted path and rejects absolute/'..'/empty-trackId sidecars on load (T-46-04, ASVS V12)"
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts (trackId path shape + per-track load + unsafe-path rejection) + isSafeEfxPaintCachePath guard suite"
        status: pass
    human_judgment: false
  - id: C5
    description: "Per-track save/load carriers: two tracks persist frames at the same appFrame without collision — both sidecars staged at their own track paths and both load back per-track; the old cross-track same-appFrame loader throw is gone"
    verification:
      - kind: unit
        ref: "app/src/lib/efxPaintPersistence.test.ts#stages two tracks at the same appFrame"
        status: pass
    human_judgment: false
  - id: C6
    description: "projectStore funnel per-track wiring: buildEfxPaintDocuments produces one framesPerTrack entry per document.tracks entry keyed by trackId (TRK-03); openProject hydrates both tracks' frames at the same appFrame; single-track regression stays green"
    verification:
      - kind: unit
        ref: "app/src/stores/projectStore.efxPaintCutover.test.ts#46-02 Task 3 (3 tests)"
        status: pass
    human_judgment: false
  - id: C7
    description: "No regression: full suite 2732 passed / 1 skipped / 101 todo, 145 files, 0 failed; app typecheck clean"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app run typecheck"
        status: pass
    human_judgment: false

# Metrics
duration: 0h35m
completed: 2026-08-23
status: complete
---

# Phase 46: Track-local Paint/Roto/PlayScript State — Plan 02 Summary

**The Phase 45 single-track guards are gone: the v1.0 document boundary round-trips multi-track runtime state by stable trackId, with trackId cache paths and per-track save/load frame carriers**

## Performance

- **Duration:** ~35m wall clock (23:12 first Task-1 test commit to 23:17 final cleanup commit)
- **Started:** 2026-08-23T23:12:00Z
- **Completed:** 2026-08-23T23:17:00Z
- **Tasks:** 3
- **Commits:** 7 (3 test + 3 feat + 1 fixture cleanup) + close-out

## Accomplishments

- **Multi-track serialize/hydrate projection (TRK-01 boundary):** `serializeRuntimeIntoDocument` iterates `document.tracks` by stable id — never `tracks[0]` (Pitfall 1) — projecting each track's runtime payload (frames via `buildEfxPaintFrameCachePath(layerId, track.id, frame)` + rotoPhysical) into that exact track; the `documentRevision` fingerprint comparison stays the 45-01 `buildEfxPaintDocumentRevision` on the same docrev. `hydrateRuntimeFromDocument(document, perTrackFrames)` installs each track's frames + rotoPhysical under its own trackId; `installRuntimeStateFromDocument` fails closed on a trackId mismatch (`payload.trackId !== trackId` throws)
- **TrackId cache paths (D-15 foundation, T-46-04):** `buildEfxPaintFrameCachePath` emits `cache/efx-paint/<stableSegment(layerId)>/<trackId>/frame-NNNNNN-NNNN.png` — the raw UUID trackId sits between the guarded stable segment and the file name so track deletion can address exactly its own sidecars; every emitted path continues to pass `isSafeEfxPaintCachePath` (prefix-locked, no backslash/absolute/NUL/dot segments, ASVS V12)
- **Per-track save/load carriers (edge TRK-03 ordering resolved explicit):** `EfxPaintDocumentSaveInput.frames` / `EfxPaintLoadedDocument.frames` are `ReadonlyMap<string, ReadonlyMap<number, PhysicPaintRenderedFrame>>` (trackId → appFrame → frame); the save fingerprint terms include trackId (`trackId:appFrame:dataUrl`) so identical bytes on distinct tracks stay distinct (T-46-06); the loader's cross-track same-appFrame throw is gone — two tracks persist frames at the same appFrame without collision, each staged/loaded at its own track path
- **projectStore funnel wiring:** `buildEfxPaintDocuments()` collects per-track frame maps (one entry per `document.tracks` entry, keyed by trackId); the hydrate seam passes per-track frames through to `hydrateEfxPaintRuntimeFromDocument`; the project-save orchestrator shape is unchanged
- **Gates:** full suite 2732 passed / 1 skipped / 101 todo / 0 failed / 145 files; `pnpm --dir app run typecheck` clean

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: multi-track serialize/hydrate projection** - `c728d474` (test) + `1d2545af` (feat)
2. **Task 2: trackId cache paths + per-track save/load carriers** - `9c818787` (test) + `eac323e0` (feat)
3. **Task 3: projectStore wiring (buildEfxPaintDocuments + hydrate seam)** - `b546e563` (test) + `ea954f20` (feat)
4. **Cleanup:** `1832cdf1` (drop unused import in the projection suite — tsc noUnusedLocals)

## Files Created/Modified

- `app/src/stores/efxPaintStore.ts` - Modified: the two single-track guards removed; serialize iterates document.tracks projecting per track; hydrate takes per-track frames; the old guard strings ('must have exactly one default Paint track') are gone
- `app/src/stores/physicPaintStore.ts` - Modified: `EfxPaintRuntimeProjection` gains `trackId`; `extractRuntimeStateForDocument(layerId, trackId)` / `installRuntimeStateFromDocument(layerId, trackId, payload)` address per-track maps and validate `payload.trackId`
- `app/src/lib/efxPaintPersistence.ts` - Modified: `buildEfxPaintFrameCachePath(layerId, trackId, frame)` with trackId segment; per-track `EfxPaintDocumentSaveInput.frames` / `EfxPaintLoadedDocument.frames`; per-track staging + loading; track-augmented fingerprint terms
- `app/src/stores/projectStore.ts` - Modified: `buildEfxPaintDocuments()` collects per-track frame maps keyed by document.tracks ids
- `app/src/efx-paint/document/efxPaintMultiTrackProjection.test.ts` - Created: 5 tests (multi-track serialize by id, two-track hydrate, round-trip identity, same-appFrame across tracks, empty+populated projection)
- Fixtures updated across `efxPaintStore.test.ts`, `efxPaintPersistence.test.ts`, `projectStore.efxPaintCutover.test.ts`, `physicPaintBridge.test.ts`, `physicPaintStore.test.ts`, `sequenceStore.test.ts`

## Decisions Made

- **TrackId is the identity, never an index (TRK-01):** the projection iterates `document.tracks` by id; no `tracks[i]` anywhere (Pitfall 1); two tracks at the same appFrame hold independent state end-to-end
- **TrackId cache paths (D-15):** the raw UUID trackId between the stable layer segment and the file name — every path passes `isSafeEfxPaintCachePath` (T-46-04) and track deletion can address exactly its own sidecars
- **Per-track carriers (edge TRK-03):** save/load frame maps are trackId-keyed; the old cross-track same-appFrame throw is removed — collision-free by construction
- **Track-augmented fingerprint (T-46-06):** byte terms include trackId so identical bytes on distinct tracks never dedupe into one term
- **No back-migration:** new trackId paths apply from the next save; previously saved v1.0 files are not re-derived (Phase 45 no-compat)

## Deviations from Plan

None material. Task 2's path-shape and unsafe-path tests passed immediately (the behavior was pre-established by the 45-04 guard); the RED state for Task 2 came from the per-track carrier semantics (fingerprint, staging, loader) rather than the path builder. Task 3's hydrate RED test (hydrate per-track at the same appFrame) also passed immediately — the hydrate seam from Task 1/2 already carries per-track frames; the plan called out that seam as possibly no-change.

## Issues Encountered

- After Task 2 GREEN, the pre-existing round-trip test in efxPaintPersistence.test.ts read the loaded frames with the old flat accessor (`loaded.get('layer-x')!.frames.get(0)`) and failed against the new per-track carrier — fixed to `frames.get(document.tracks[0].id)?.get(0)` within the task's test files
- A tsc noUnused-vars error surfaced in the final verification: the multi-track projection suite imported `getDocument` without using it — removed in a small cleanup commit (`1832cdf1`) before the close-out

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The persistence boundary now round-trips multi-track documents with per-track identity, per-track frames, rotoPhysical payloads, and per-track cache paths (ROADMAP SC 1 base)
- 46-03 (track-aware edit ops) can rely on the projection boundary proven here; 46-04 (async revalidation) and 46-05 (deletion) build on the same per-track seams
- No blockers; full suite and typecheck green

---
*Phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache*
*Completed: 2026-08-23*
