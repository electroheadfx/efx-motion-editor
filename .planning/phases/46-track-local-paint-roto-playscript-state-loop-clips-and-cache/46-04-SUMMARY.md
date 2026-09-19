---
phase: 46-track-local-paint-roto-playscript-state-loop-clips-and-cache
plan: 04
subsystem: core
tags: [physic-paint, multi-track, async-authority, capture-then-revalidate, fail-closed, track-revision, document-revision, typescript, vitest]

# Dependency graph
requires:
  - phase: 46
    plan: 01
    provides: track-addressed runtime (Map<layerId, Map<trackId, T>>), per-track revisions, track-scoped operation leases with trackId tokens
  - phase: 46
    plan: 02
    provides: multi-track serialize/hydrate projection, per-track save/load carriers
  - phase: 46
    plan: 03
    provides: track-tagged undo/redo, setActiveTrackId with the 45-01 docrev bump, fresh-identity track ops
  - phase: 45
    provides: EfxPaintDocument v1.0 with stable UUID track ids, activeTrackId, and the 45-01 buildEfxPaintDocumentRevision/buildEfxPaintTrackRevision builders
provides:
  - "Three-dimensional async PlayScript commit authority: every PhysicPaintRotoAuthorityRequest/Result carries trackId, and the result additionally carries trackRevision (buildEfxPaintTrackRevision of the requested track) and documentRevision (buildEfxPaintDocumentRevision of the parent document); getPhysicPaintRotorAuthority revalidates project context -> document -> track in order and fails closed on a foreign trackId with 'Track is unavailable.' and zeroed capacity — never a fallback to the active track, never an auto-create (TRK-05, T-46-11)"
  - "Capture-then-revalidate commit gate: the replace-roto-key-frames gate re-requests the authority for the payload's captured trackId (never the live active track), compares authority.trackId/trackRevision/documentRevision against the captured terms, and fails closed with 'Rotor authority became stale before commit.' on any mismatch — an in-flight commit is immune to mid-flight activeTrackId switches and foreign-track edits (TRK-06, T-46-10)"
  - "The per-track stale-async law proofs: a foreign-track edit between capture and commit leaves an in-flight A commit valid; concurrent captures at a shared appFrame land on their own track maps; B-dirty never gates A (the global clock is not the gate); the authority never reflects a foreign track's mutation (TRK-06 edge)"
affects: [46-05, 46-06, 47]

# Actuals — pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 14000
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns: [capture-then-revalidate, three-dimensional authority, deterministic track/document revision terms, fail-closed foreign-track rejection, per-track stale-async law]

key-files:
  created:
    - app/src/lib/physicPaintBridgeAuthority.test.ts
  modified:
    - app/src/types/physicPaint.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/stores/trackIsolation.test.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
    - app/src/components/physic-paint/hooks/useRotoPlayScriptController.createGroup.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    - app/src/lib/physicPaintBridge.test.ts
    - app/src/lib/physicPaintPlayScriptBridge.test.ts

key-decisions:
  - "The authority envelope is three-dimensional: request carries trackId (required); the result carries trackRevision and documentRevision computed by the 45-01 deterministic builders; failure closures carry the terms whenever the document was reachable, empty strings when the document check itself failed"
  - "Fail-closed revalidation chain in getPhysicPaintRotorAuthority: project context -> layer -> canonicalStart -> document exists (getEfxPaintDocument) -> track in document.tracks — a trackId outside the document fails with 'Track is unavailable.' and zeroed capacity, never querying per-track store state beyond the document, never auto-creating a runtime (D-20, ASVS V5)"
  - "The commit gate is capture-then-revalidate (T-46-10): the payload carries expectedLayerEndExclusive/expectedRotorRevision/expectedTrackRevision/expectedDocumentRevision, the gate re-requests the authority with trackId: payload.trackId at commit time, and the staleness error string 'Rotor authority became stale before commit.' is reused for the track and document dimensions — the commit path never reads the live document.activeTrackId"
  - "The stale-async law is per-track, never document-global: a track-B edit between capture and commit leaves an in-flight A commit valid because A's deterministic track term is unchanged; the global paint clock never gates a commit"
  - "The transport seam rejects cross-track lease tokens: applyTransportedPhysicPaintPayload compares the submitted lease token's trackId with the payload's captured trackId before any publication lease is used (46-01 validator also rejects mismatched-track lease payloads fail-closed)"

requirements-completed: [TRK-05, TRK-06]

# Coverage metadata — one entry per shipped deliverable.
coverage:
  - id: C1
    description: "Three-dimensional authority envelope: PhysicPaintRotorAuthorityRequest/Result carry trackId; the result carries trackRevision (buildEfxPaintTrackRevision of the requested track) and documentRevision (buildEfxPaintDocumentRevision of the parent document); the requested trackId is echoed on success AND failure"
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridgeAuthority.test.ts#Task 1 (echo, foreign track, per-track terms, malformed, envelope)"
        status: pass
    human_judgment: false
  - id: C2
    description: "Fail-closed foreign track: a trackId outside document.tracks returns ok:false 'Track is unavailable.' with zeroed capacity/physicalCapacity and no active-track fallback, no auto-create; the failure closure still carries the document revision when the document was reachable"
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridgeAuthority.test.ts#fails closed on a foreign trackId"
        status: pass
    human_judgment: false
  - id: C3
    description: "Capture-then-revalidate commit gate: the replace-roto-key-frames gate re-requests the authority for the captured trackId, compares trackId + trackRevision + documentRevision against the payload's captured terms, and fails closed with the reused 'Rotor authority became stale before commit.' error on any mismatch — writes nothing on staleness, and the commit always lands on the captured track even when the document's activeTrackId moves mid-flight"
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridgeAuthority.test.ts#Task 2 (commit onto A leaves B byte-identical, stale track revision, stale document revision, active-track switch mid-flight)"
        status: pass
    human_judgment: false
  - id: C4
    description: "Transport lease cross-track rejection: a transported payload whose submitted lease token trackId differs from the payload's captured trackId fails closed through the prepared path; the foreign-track token stays unconsumed (release === true); the parent listener replies with the correlated closed result"
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridge.test.ts#fails closed when the transported lease token tracks a different track"
        status: pass
    human_judgment: false
  - id: C5
    description: "Per-track stale-async law (TRK-06 edge): a track-B edit between capture and commit leaves the A capture valid and the commit lands on A with B's records and revision term untouched; two concurrent captures at a shared appFrame commit their own maps without overwriting each other; B-dirty never gates A's commit (the global clock is not the gate); an authority request for A after a B edit returns A's trackRevision/rotoRevision/frames unchanged"
    verification:
      - kind: unit
        ref: "app/src/stores/trackIsolation.test.ts#physicPaintBridge per-track stale-async law (46-04 Task 3)"
        status: pass
    human_judgment: false
  - id: C6
    description: "Malformed-authority fail-closed: isPhysicPaintRotorAuthorityRequest rejects a missing or non-string trackId before store state is touched; getPhysicPaintRotorAuthorityFromUnknown returns a closed failure with zeroed capacity and best-effort envelope fields"
    verification:
      - kind: unit
        ref: "app/src/lib/physicPaintBridgeAuthority.test.ts#rejects a malformed request"
        status: pass
    human_judgment: false
  - id: C7
    description: "No regression: full suite green (2766 passed / 1 skipped / 101 todo / 0 failed / 146 files), the pre-existing authority-adjacent suites still pass with the trackId-bearing fixtures, and the grep gate is clean — no live activeTrackId read in the replace-roto-frames commit path"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run && pnpm --dir app exec tsc --noEmit"
        status: pass
    human_judgment: false
  - id: C8
    description: "Live native UAT of the async PlayScript flow (capture-then-revalidate under a mid-flight active-track switch, fail-closed 'Track is unavailable.' surface, and the studio's cross-track UX) — unit tests cannot judge the interactive multi-track window behavior"
    verification: []
    human_judgment: true
    rationale: "The plan's truth contracts are all unit-proven (the full matrix of authority/commit/law tests), but the interactive multi-track Studio surface (PlayScript in the solo window, track switching, the 'unavailable track' error surface) still requires live native UAT; the flagged assumption (deletion laws are 46-05 scope) stands"
# Metrics
duration: 25min
completed: 2026-08-24
status: complete
---

# Phase 46 Plan 04: Three-Dimensional Async Roto Authority Summary

**The async PlayScript commit authority revalidates parent, document, and track dimensions — every request carries the target trackId, every result carries deterministic track/document revisions, and the commit gate re-checks the captured three dimensions instead of ever reading the live active track**

## Performance

- **Duration:** ~25 min wall clock (00:14:38 first Task-1 test commit to 00:33:48 final Task-3 law commit)
- **Started:** 2026-08-24T00:14:38Z
- **Completed:** 2026-08-24T00:33:48Z
- **Tasks:** 3
- **Commits:** 6 (5 task commits: 3 test + 2 feat — the Task-3 law-proof is the third test — plus this close-out)
- **Files modified:** 6

## Accomplishments

- **Three-dimensional authority (TRK-05):** `PhysicPaintRotorAuthorityRequest` carries a required `trackId`; `PhysicPaintRotorAuthorityResult` carries `trackId`, `trackRevision` (`buildEfxPaintTrackRevision` of the requested document track), and `documentRevision` (`buildEfxPaintDocumentRevision` of the parent document). `getPhysicPaintRotorAuthority` revalidates in order: project context -> layer -> canonical start -> document exists -> track member of `document.tracks`; a foreign trackId fails closed with `'Track is unavailable.'` and zeroed capacity — never an active-track fallback, never an auto-create, and no per-track store reads beyond the document (D-20, ASVS V5, T-46-11).
- **Capture-then-revalidate commit gate (T-46-10):** the replace-roto-key-frames gate now compares `authority.trackId === payload.trackId`, `authority.trackRevision` vs the captured `expectedTrackRevision`, and `authority.documentRevision` vs the captured `expectedDocumentRevision` (both optional) alongside the existing layerEndExclusive/rotorRevision checks — any mismatch returns the reused `'Rotor authority became stale before commit.'` and writes nothing. The commit path never reads the live document's `activeTrackId` (Pitfall 2); the strict validator accepts the two new optional string terms.
- **Per-track stale-lane law proofs (TRK-06 edge):** four isolation laws in `trackIsolation.test.ts` prove the stale-lane law is per-track, never document-global — a track-B edit between capture and commit leaves the A capture valid; two captures at a shared appFrame commit their own maps and never overwrite each other; B-dirty never gates A (the global paint clock is not the gate); and an authority request for A after a B edit returns A's trackRevision/rotorRevision/frames unchanged while the document term moved.
- **Transport lease cross-track rejection:** the exported seam in `applyPhysicPaintPayloadWithPublicationLease`/`applyPreparedPhysicPaintPayload` already validates the submitted lease token's trackId against the payload's captured trackId — a mismatched lease falls back to the prepared path and fails closed, proven by the listener-driven test.
- **Gates:** full suite 2766 passed / 1 skipped / 101 todo / 0 failed / 146 files; `pnpm --dir app exec tsc --noEmit` clean; grep gate no `activeTrackId` in the commit path.

## Task Commits

Each task was committed atomically (TDD: test → feat per task):

1. **Task 1: three-dimensional authority request/result** - `25cfa60d` (test) + `75986094` (feat)
2. **Task 2: capture-then-revalidate commit gate** - `a659b910` (test) + `e382c9de` (feat)
3. **Task 3: per-track stale-lane isolation laws** - `8e347722` (test; the laws already held, no production change was required)

**Plan metadata:** close-out commit follows this summary.

## Files Created/Modified

- `app/src/types/physicPaint.ts` - Modified: `PhysicPaintRotorAuthorityRequest`/`Result`/Message gain `trackId` (request) + `trackId`/`trackRevision`/`documentRevision` (result); `PhysicPaintReplaceRotorFramesPayload` gains `expectedTrackRevision`/`expectedDocumentRevision`; the replace-roto-frames validator branch accepts the optional new terms
- `app/src/lib/physicPaintBridge.ts` - Modified: `getPhysicPaintRotorAuthority` parent → document → track revalidation (document/track fail-closed), revision terms on every result, per-track reads; commit gate extended with the three captured dimensions; `applyPrepared`/`applyTransported` keep the lease-track seam; `getPhysicPaintRotorAuthorityFromUnknown`/`extractAuthorityEnvelopeFields` accept trackId
- `app/src/lib/physicPaintBridgeAuthority.test.ts` - Created: Task 1 (5 tests) + Task 2 (4 tests) authority/gate suites
- `app/src/stores/trackIsolation.test.ts` - Modified: Task 3 suite (4 tests) with the two-track authority fixtures + capture/commit harness
- `app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts` - Modified: authorityFailure + requestAuthority carry the launch document's `activeTrackId` (the child names the track; the parent revalidates)
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts`, `app/src/components/physic-paint/hooks/useRotoPlayScriptController.createGroup.test.ts`, `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts`, `app/src/lib/physicPaintBridge.test.ts`, `app/src/lib/physicPaintPlayScriptBridge.test.ts` - Modified: mechanical trackId fixture additions required by the new envelope fields

## Decisions Made

- **The authority speaks three dimensions (TRK-05):** request `trackId` + result `trackRevision`/`documentRevision`; the failure closure carries the revision terms whenever the document was reachable, so a closed failure is still auditable.
- **Fail-closed on the track dimension (D-20):** no fallback to the active track, no runtime auto-create; the 'Track is unavailable.' error is used for both a missing document and a foreign track.
- **Capture-then-revalidate, never the live active track (Pitfall 2):** the gate re-requests the authority for the payload's captured trackId at commit time and compares the captured terms; the document's `activeTrackId` is never read in the commit path (the `active:` term only moves the documentRevision dimension).
- **The stale-lane law is per-track:** the per-track revision term (buildEfxPaintTrackRevision) is the gate; the global paint clock and foreign-track edits never fail or corrupt an in-flight commit.
- **Transport lease is track-scoped:** a lease token bound to track A can never authorize a publish onto track B — mismatched leases are rejected fail-closed before the publication lease is used.

## Deviations from Plan

### Auto-fixed Issues

**1. The plan's `physicsPaintRotorPhysicalModel` import spelling**
- **Found during:** Task 3 (per-track stale-lane law tests)
- **Issue:** my first Task 3 test draft imported `physicsPaintRotorPhysicalModel` (a non-existent path) — the module is `physicsPaintRotorPhysicalModel` (Roto, single 'r').
- **Fix:** corrected the import paths; the store methods are also `Roto`-prefixed (`replaceRotorPhysicalRecords` not `replaceRotorPhysicalRecords`).
- **Files modified:** app/src/stores/trackIsolation.test.ts
- **Verification:** typecheck clean; suite green.
- **Committed in:** 8e347722 (Task 3 law test commit)

**2. Law-proof tests that held immediately (no production change for Task 3)**
- **Found during:** Task 3
- **Issue:** the plan's RED/GREEN cycle for Task 3 assumed the production laws might need changes; the four stale-lane laws already hold (the per-track maps, per-track revisions, and the Task 2 gate are all in place), so the Task 3 commit is the law-proof test commit alone.
- **Fix:** none needed — committed the four proof tests as `test(46-04): per-track stale-lane isolation laws`; the full suite and typecheck verify.
- **Committed in:** 8e347722

---

**Total deviations:** 2 auto-fixed (1 mechanical test correction, 1 law-proof commit with no production change)
**Impact on plan:** none — the plan's own truth contracts are all enforced and the flagged assumption (deletion laws are 46-05 scope) remains untouched.

## Issues Encountered

- The `PhysicRotorAuthorityResult` fixture additions were needed in three pre-existing suites (useRotoPhysicalEditCoordinator, physicsPaintRotoPlayScriptController) plus the message-listener test in `physicPaintPlayScriptBridge.test.ts` (the listener event payload needed the now-required `trackId`).
- The document track fixtures must be canonical (their `rotoPhysical.revision` computed via `buildPhysicPaintRotorPhysicalRevision`) so the 45-01 docrev builders re-parse fail-closed — the same rule as 46-03.
- The payload validator rejects objects containing `undefined`-valued keys (isStructuredClonePlainData), so omitting a dimension means destructuring the key out, never passing `undefined`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The async commit path is fully three-dimensional: the authority revalidates parent → document → track and the gate fails closed on any captured-dimension mismatch; the per-track stale-lane law is proven under concurrent activity.
- 46-05 (track deletion) builds on the same per-track maps, the fail-closed track authority, and the track-tagged history from 46-03 without authority-scope surprises.
- The `requestTrackId`/`authorityTrackId` child-side launch naming is in place — the Studio hook now names the launch document's active track in authority requests.
- No blockers; full suite and typecheck green.
