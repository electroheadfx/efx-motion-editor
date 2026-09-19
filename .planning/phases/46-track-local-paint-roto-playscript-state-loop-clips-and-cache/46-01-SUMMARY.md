---
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
plan: 01
subsystem: core
tags: [physic-paint, track-local-state, leases, lifecycle, signals, typescript, vitest]

# Dependency graph
requires:
  - phase: 45
    provides: EfxPaintDocument v1.0 with stable UUID track ids and activeTrackId (createEfxPaintDocument)
provides:
  - "Fully track-addressed physicPaintStore runtime: 16 per-track maps keyed Map<layerId, Map<trackId, T>> (frames, roto background/cache/generated-cache metadata, interpolation settings/failure status, real-key records, group overrides, interpolation state, script motion, selection, cursor, capacity, loop clips, incoming break key ids, playback settings)"
  - "Per-track revision signals getTrackPaintVersion(layerId, trackId) / getTrackRotorRevision(layerId, trackId), bumpTrackRevision, and the track-keyed structural cache composite key"
  - "Track-scoped operation leases: PhysicPaintRotorPhysicalOperationLeaseToken.trackId, scope/identity include trackId, publication gate validates the track dimension"
  - "Track lifecycle primitives mountTrackRuntime(layerId, trackId) and removeTrackRuntime(layerId, trackId) with unreferenced-alpha pruning"
affects: [46-02, 46-03, 46-04, 46-05, 46-06]

# Actuals — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 14200
  tasks: 3
  commits: 8

# Tech tracking
tech-stack:
  added: []
  patterns: [per-track map keying, signal-per-track revisions, track-scoped lease identity, mount/teardown lifecycle primitives]

key-files:
  created:
    - app/src/stores/trackIsolation.test.ts
  modified:
    - app/src/stores/physicPaintStore.ts
    - app/src/types/physicPaint.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoScriptLibraryController.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopClips.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotorPhysicalResolver.test.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/stores/physicPaintStore.rotoLoopClips.test.ts
    - app/src/stores/physicPaintStore.test.ts
    - app/src/types/physicPaint.test.ts

key-decisions:
  - "The runtime store is addressed layerId -> trackId -> value; trackId is always the stable UUID identity from the document, never an array index (TRK-01 base law, Pitfall 1)"
  - "Spelling convention locked byte-exactly: all method names use 'Roto' (acquireRotor...); the only 'Rotor' symbol is getTrackRotorRevision — verified with ord-level dumps to kill the Roto/Rotor typo hazard"
  - "Track revisions live in a trackRevisions Map with a global physicPaintVersion clock; bumpTrackRevision bumps the track signal AND the global clock so subscribers over-subscribe only on real track changes (Pitfall 4 closed)"
  - "Lease scope/identity embed trackId: one layer can hold one exclusive lease per track; _validateRotorPhysicalLayerPublication checks token.trackId against the claimed track before any write (T-46-03)"
  - "removeTrackRuntime deletes the complete 16-map inventory plus the structural memo composite key, the trackRevisions entry, settles/expires the track's leases with the established settle pattern, and prunes alpha canvases only when unreferenced; returns true only when something changed"
  - "The bridge apply-side resolves the document's ACTIVE track for the parent tracer (launch IS the document — D-03); a carried request carries no trackId of its own"

requirements-completed: [46-01 TRK-01, TRK-03]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: C1
    description: "Track isolation base law: one track's real keys, frames, records, and caches never leak into another track; empty-but-present track stays addressable by trackId"
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts (10 tests)"
        status: pass
    human_judgment: false
  - id: C2
    description: "Per-track revision signals with global clock; fresh mount reports baseline 0 not-dirty; one mutation fires the injected dirty callback exactly once"
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#per-track revision signals"
        status: pass
    human_judgment: false
  - id: C3
    description: "Track-scoped leases: track A and track B each hold an exclusive lease on the same layer; cross-track validation rejected 'mismatched-token'; teardown clears frames, records, caches, selection, leases, memo entries; never-mounted teardown no-op false"
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#track-scoped operation leases"
        status: pass
    human_judgment: false
  - id: C4
    description: "All production call sites thread trackId (Studio, script library controller, bridge); no call site with the old 2-arg acquire signature (grep proves it)"
    verification:
      - kind: unit
        ref: "grep acquireRotorPhysicalOperationLease across src/ — every call passes a third trackId argument"
        status: pass
    human_judgment: false
  - id: C5
    description: "No regression: full suite 2721 passed, 144 files, 0 failed; app typecheck clean"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run && npx tsc --noEmit"
        status: pass
    human_judgment: false

# Metrics
duration: 2h00m
completed: 2026-08-23
status: complete
---

# Phase 46: Track-local Paint/Roto/PlayScript State — Plan 01 Summary

**The runtime store is fully track-addressed: per-track maps, per-track revision signals with a global clock, track-scoped operation leases, and the mountTrackRuntime/removeTrackRuntime lifecycle primitives**

## Performance

- **Duration:** ~2h00m wall clock (21:33 first Task-1 test commit to 23:04 final Task-3 feat commit)
- **Started:** 2026-08-23T21:33:55Z
- **Completed:** 2026-08-23T23:03:59Z
- **Tasks:** 3
- **Commits:** 8 (1 docs(state) + 3 test + 3 feat + close-out)

## Accomplishments

- **TRK-01 base law enforced:** the runtime store is addressed layerId → trackId → value with 16 per-track maps; editing one internal track never changes another track's real keys, frames, or caches; trackId is the stable UUID identity from the document, never an array index
- **Per-track revision signals (TRK-03):** `getTrackPaintVersion` / `getTrackRotorRevision` per track plus the global `physicPaintVersion` clock; `bumpTrackRevision` bumps the track clock and the global clock; one mutation fires the injected dirty callback exactly once
- **Track-keyed structural cache:** the composite cache key includes trackId so one track's structural publication never invalidates another track's memo entries
- **Track-scoped operation leases:** `PhysicPaintRotorPhysicalOperationLeaseToken.trackId` (and the recovery descriptor) with scope/identity including trackId; a layer holds one exclusive lease per track; `_validateRotorPhysicalLayerPublication` rejects cross-track writes (`mismatched-token`); `removeTrackRuntime` settles the track's leases with the established settle pattern (replayed-token after teardown)
- **Track lifecycle primitives:** `mountTrackRuntime(layerId, trackId)` seeds all per-track maps at baseline (empty collections, default interpolation, zero cursor, null selection, max capacity) and `removeTrackRuntime(layerId, trackId)` deletes the full map inventory, the structural memo key, the trackRevisions entry, settles the track's leases, and prunes alpha canvases only when no longer referenced — returning true only when something changed, no-op false for never-mounted tracks
- **Full call-site threading:** PhysicsPaintStudio, useRotoScriptLibraryController, and the bridge pass trackId through acquire/validate/release/recovery; the DTO guard and payload validators enforce trackId on the lease token
- **Gates:** full suite 2721 passed / 0 failed / 144 files; `npx tsc --noEmit` clean

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: re-key runtime maps + accessors to Map<layerId, Map<trackId, T>>** - `8d1bd2a0` (test) + `6c17ee89` (feat)
2. **Task 2: per-track revision signals + bumpTrackRevision + track-keyed structural cache** - `0ef40c15` (test) + `337a34e1` (feat)
3. **Task 3: track-scoped leases + mountTrackRuntime/removeTrackRuntime** - `385acb93` (test) + `110d51d0` (feat)

**Plan metadata:** `5b31cb5e` (docs(state): mark phase 46 plan 01 execution)

## Files Created/Modified

- `app/src/stores/trackIsolation.test.ts` - Created: 10 tests across the TRK-01 base law (re-key accessors, isolation law, empty track, ordering), TRK-03 per-track revision signals, and track-scoped operation leases (lease scope, teardown, empty-keep)
- `app/src/stores/physicPaintStore.ts` - Modified: 16 per-track maps, trackId on lease token/descriptor, trackId-extended accessors, `getTrackPaintVersion`/`getTrackRotorRevision`/`bumpTrackRevision`, `mountTrackRuntime`/`removeTrackRuntime`, `_leaseScope`/identity with trackId, `_publishValidation` with track dimension
- `app/src/types/physicPaint.ts` - Modified: DTO mirror `trackId` on the lease token guard + validator (payload leaseToken.trackId must equal payload.trackId)
- `app/src/lib/physicPaintBridge.ts` - Modified: pre-check `submittedLeaseToken.trackId !== payload.trackId`, acquire threads payload.trackId, lease-token key allowlist gains `trackId`, validate calls pass token.trackId
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - Modified: lease acquire/isAvailable use `studioActiveTrackId()`
- `app/src/components/physic-paint/hooks/useRotorScriptLibraryController.ts` - Modified: encoded lease carries trackId, acquire resolves active trackId, recovery descriptor gains trackId
- Test fixtures updated across `physicPaintStore.test.ts`, `physicPaintBridge.test.ts`, `useRotoPhysicalEditCoordinator.test.ts`, `physicsPaintRotorLoopClips.test.ts`, `physicsPaintRotorPhysicalResolver.test.ts`, `physicPaintStore.rotoLoopClips.test.ts`, `physicPaint.test.ts`

## Decisions Made

- **TrackId is the identity, never an index** (TRK-01): every accessor takes trackId explicitly; no `tracks[i]` indexing anywhere; two tracks at the same appFrame hold independent state
- **Per-track revisions + one global clock** (Pitfall 4): subscribers see a bump on the track they care about; `physicPaintVersion` still reflects every mutation for coarse invalidation
- **Lease identity includes trackId** (T-46-03): `scope = project/layer/track` and `identity = scope:generation`; a trackA token cannot validate a trackB write
- **removeTrackRuntime settles rather than deletes leases**: the established settle pattern means a replayed token from a torn-down track fails with `replayed-token`, and `isRotorPhysicalOperationAvailable` returns true again after teardown
- **The bridge resolves the ACTIVE track on the validation side** (D-03, launch IS the document): the carried apply request has no trackId; the parent-side resolves `getEfxPaintDocument(layerId)?.activeTrackId` for validation (with `?? ''` so a missing token yields `missing-token`, not a throw)

## Deviations from Plan

None. The plan's action text was executed as written; the only extra work was test-fixture threading (trackId on all legacy lease fixtures) required to keep the pre-existing suites green under the new token contract.

## Issues Encountered

- After Task 3 GREEN in the targeted suite, the FULL suite exposed 20 failures in 3 files: the R-request parser's lease-token key allowlist did not yet contain `trackId` (so tracked tokens failed parse → `malformed`), the guard rejected fixture tokens lacking trackId, and 4 tsc errors from fixtures missing the field. Root causes were in the fixtures and the allowlist, not the store — all fixed within the task's files and re-verified (271+271 passed, tsc clean)
- One RED-ordering trap in the teardown test: `getTrackRotorRevision(...).value` lazily re-creates the trackRevisions entry, so a second `removeTrackRuntime` after the read returned true instead of the expected no-op false; reordered the assertions so the no-op check runs before the lazy read

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Deletion plans (46-xx track delete) and authority plans call `removeTrackRuntime` / `mountTrackRuntime` and the trackId-extended leases exactly as shipped here
- The R and playback addresses are ready for the 46-02..46-06 state scope (Track-local Paint/Roto/PlayScript state, loop clips, caches)
- No blockers; the full suite and typecheck are green with the track-addressed store

---
*Phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache*
*Completed: 2026-08-23*
