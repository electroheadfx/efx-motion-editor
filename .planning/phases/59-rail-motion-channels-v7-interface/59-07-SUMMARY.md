---
phase: 59-rail-motion-channels-v7-interface
plan: 07
subsystem: store
tags: [typescript, preact-signals, apply-payload, undo-redo, revision-split, raster-cache, tdd, motn-01, motn-02, motn-12, rel-03]

# Dependency graph
requires:
  - phase: 59-02
    provides: "PhysicPaintRotoRailMotionRecord/Channel/Key types, the fail-closed parser and the shared frozen empty collection"
  - phase: 59-03
    provides: "The single revision authority (`_buildRotoPhysicalRevisionFor`), the motion map + getter/setter pair and the 6-argument canonical builder"
provides:
  - "A motion edit is a first-class store mutation: apply payload acceptance (closed allowlist + 59-02 parse), preserve-when-absent semantics, and the settlement write through the 59-03 setter"
  - "Motion rides the existing history snapshot as a REQUIRED member: both comparators cover it and replay restores it through the same store setter as a forward edit"
  - "The coordinator stages rail motion exactly like loop clips at every launch read, and carries it into the staged revision, the deferred document and the wire payload"
  - "`buildPhysicPaintRotoPhysicalRasterRevision`: the motion-free pixel identity, so a motion-only edit never rotates a frame cache key while the canonical revision still moves"
affects: [59-08, 59-11, 59-12, 59-15, 59-16]

actuals:
  tokens: 27395
  tasks: 3
  commits: 6

plan_head_before: 1d9f4863aa76dfcb04f5ca48b2dd9be4ad254c40
plan_head_after: 4bf474e2d159d144f89083cefbeca2311ba26c50

tech-stack:
  added: []
  patterns:
    - "One canonical revision authority: `buildPhysicPaintRotoPhysicalRevision` is called from exactly one place in the store (`_buildRotoPhysicalRevisionFor`); the raster helper delegates to it rather than re-formatting"
    - "Canonical revision = persistence identity (motion included); raster revision = pixel identity (motion replaced by the 59-02 empty constant). The frame path, including the render-source `contentRevision` field its consumers re-hash, uses the raster value"
    - "Snapshot members are required, never optional: a missing `railMotions` must fail typecheck rather than silently drop motion on replay"
    - "Staged decision mirrors the loop-clip precedent: replay target wins, otherwise the launch read; no second staging variable"

key-files:
  created:
    - app/src/components/physic-paint/hooks/physicsPaintRotoRailMotionHistory.test.ts
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-07-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-07-task2.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-07-task3.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-07-task1.xml
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-07-task2.xml
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-07-task3.xml
  modified:
    - app/src/types/physicPaint.ts
    - app/src/lib/physicPaintBridge.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.rotoRailMotions.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
    - app/src/components/physic-paint/hooks/physicsPaintRotoLoopHistory.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts

key-decisions:
  - "The render-source `contentRevision` field carries the RASTER revision. Three consumers (`rotoPhysicalOwnership`, `useRotoReferenceController`, `useRotoFramePersistenceCoordinator`) reconstruct frame cache keys from that field, so leaving it canonical would desync every reconstructed key once a track carries motion. The structural entry's `contentRevision` and `getRotoPhysicalContentRevision` stay canonical."
  - "The staged revision must hash `stagedRailMotions`; a 5-argument build silently hashes the empty collection and settles every edit on a motion-carrying track as a stale-document mismatch."
  - "`stagedRailMotions` selects the replay target on Undo/Redo and the launch read otherwise — the same shape as `stagedLoopClips`, no parallel channel."
  - "All construction sites were fixed rather than widening the snapshot/port members to optional, per the plan's explicit requirement that a snapshot missing `railMotions` cannot typecheck."

metrics:
  duration: "~21 min"
  completed: "2026-11-06"
  files_modified: 15
  files_created: 7
  status: complete
---

# Phase 59 Plan 07: Rail Motion Store, Undo/Redo, and Raster Revision Split Summary

**Motion is now a normal, undoable, persisted store mutation that joins the canonical revision without ever entering pixel identity — a motion-only edit leaves every frame cache key byte-identical.**

## Performance

- **Duration:** ~21 min (plan ledger written 16:00 local; completed 16:21 local)
- **Started:** 2026-11-06T15:00Z
- **Completed:** 2026-11-06T15:21Z
- **Tasks:** 3
- **Files modified:** 15 source/test files, plus 7 RED evidence artifacts

## Accomplishments

- **One motion record travels payload → bridge → store → parent document.** The apply payload base accepts an optional `railMotions` collection through the closed `hasOnlyKeys` allowlist, validates it with a thin `isPhysicPaintRotoRailMotionCollection` guard that delegates to the 59-02 parser in a try/catch, and rejects with `failApplyPayload('bad-railMotions')` before any mutation. Present replaces atomically, absent preserves the target track's collection, `[]` clears it.
- **The store owns motion without touching anything else.** `getRotoPhysicalRailMotions` returns the frozen collection or the shared 59-02 empty constant; `replaceRotoPhysicalRailMotions` mirrors `replaceRotoPhysicalLoopClips` exactly — track-existence guard, fail-closed parse, revision computed through the single 59-03 authority, an idempotent no-bump early return, and no write before every failure path returns. The settlement path writes the proposal's collection between the loop-clip and break writes and maps failure to `apply-failed`.
- **Undo/Redo covers motion as a first-class field.** `railMotions` is a REQUIRED member of `RotoPhysicalEditSnapshot` and of the replay-source Pick; both comparators use the loop-clip rule (reference, length, per-record identity, then a deep `railMotionCollectionsEqual`). Replay emits `railMotions: snapshot.railMotions` in the payload and hashes it into the restore document's revision, so Undo restores the pre-edit collection and Redo restores the edit through the same setter as a forward edit.
- **The coordinator stages motion the same way it stages loops.** A single `cloneRailMotions` helper parses before cloning; the records port exposes `getRailMotions(layerId, trackId)`; the launch snapshot, the settlement comparison and both revalidation builds read it through the established ports. The main apply path selects `stagedRailMotions` (replay target wins, otherwise the launch read) and carries it into the staged revision, the deferred document and the wire payload.
- **Pixel identity is motion-independent.** `buildPhysicPaintRotoPhysicalRasterRevision` delegates to the canonical builder with the 59-02 empty constant, so the two encodings cannot drift. The structural cache entry carries both revisions; every frame cache-key template interpolates `rasterRevision`, the render-source `contentRevision` field carries it, and the JSDoc names the new key shape. The canonical builder now has exactly one call site in the store.

## Task Commits

Tasks 1–3 followed the TDD RED → GREEN cycle; one Rule 1 follow-up repaired the main apply-path staging.

1. **Task 1 RED: add failing rail motion payload pins** - `11fe8612f` (test)
2. **Task 1 GREEN: thread railMotions through the apply payload and bridge** - `f55b0a472` (feat)
3. **Task 2 RED: add failing rail motion history pins** - `5ed762c43` (test)
4. **Task 2 GREEN: stage rail motion through the coordinator and history snapshot** - `12a2ccf57` (feat)
5. **Task 3: split the canonical revision from the raster revision** - `3c85b5e91` (feat, includes its RED evidence)
6. **Task 2 follow-up: stage rail motion in the main apply path** - `4bf474e2d` (fix)

**Plan metadata:** `docs(59-07): complete rail motion store and raster revision plan` (final commit)

_Note: TDD tasks have multiple commits (test → feat)._

## TDD Gate Compliance

All three RED gates were validated by `gsd_run check tdd-red-evidence` with verdict `RED_EVIDENCE_OK` (JUnit format, target test failed with exit 1, zero report errors):

| Task | Record | Target test | Outcome |
|------|--------|-------------|---------|
| 1 | `red-evidence-59-07-task1.json` | `59-07: apply payload railMotions acceptance (MOTN-01/MOTN-12) > lands one motion record in the parent document and moves the canonical revision` | failed as expected |
| 2 | `red-evidence-59-07-task2.json` | `59-07: motion-only edit history (MOTN-12) > records one command for a motion-only change; Undo restores the prior collection and Redo restores the edit` | failed as expected |
| 3 | `red-evidence-59-07-task3.json` | `59-07: raster revision vs canonical revision (REL-03/MOTN-07) > leaves every frame cache key byte-identical across a motion-only edit while the canonical revision moves` | failed as expected |

## Files Created/Modified

- `app/src/types/physicPaint.ts` — optional `railMotions` payload member with D-05/D-06 rationale, `'railMotions'` in the closed allowlist, the `bad-railMotions` validation clause and the thin `isPhysicPaintRotoRailMotionCollection` delegation guard.
- `app/src/lib/physicPaintBridge.ts` — preserve-when-absent on both the staged and proposal paths; the staged document carries the resulting collection.
- `app/src/stores/physicPaintStore.ts` — `getRotoPhysicalRailMotions`, `replaceRotoPhysicalRailMotions`, the settlement write, the structural entry's `railMotions`/`rasterRevision`, the raster-keyed frame templates and the updated key-shape JSDoc.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — `buildPhysicPaintRotoPhysicalRasterRevision` beside the canonical builder, delegating with the empty 59-02 collection.
- `app/src/components/physic-paint/roto/rotoCoordinatorPorts.ts` — required `railMotions` snapshot member (D-29/Phase 43 rationale) and the `getRailMotions` records-port member.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` — `cloneRailMotions`, input snapshot members, launch/settlement/revalidation reads, replay payload + revision, and the main-apply staged revision/document/payload emissions.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — Pick member, `railMotionCollectionsEqual`, both comparators, and `snapshotRevision`'s sixth argument.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — production records-port `getRailMotions` and the live-source snapshot's `railMotions`.
- `app/src/stores/physicPaintStore.rotoRailMotions.test.ts` — 9 Task-1 rows over the real store + bridge plus 3 raster/canonical rows using the same harness.
- `app/src/components/physic-paint/hooks/physicsPaintRotoRailMotionHistory.test.ts` — the motion-only before/after snapshot pair, undo/redo restore and comparator pins.
- Test-fixture files (`physicsPaintRotoLoopHistory.test.ts`, `physicsPaintRotoLoopGuards.test.ts`, `physicsPaintRotoPlayScriptController.test.ts`, `useRotoPhysicalEditCoordinator.test.ts`, `useRotoPhysicalEditHistory.test.ts`) — supply the now-required snapshot/port members.
- `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-07-task{1,2,3}.json` + `red-evidence/red-59-07-task{1,2,3}.xml` — validated RED records with their JUnit reports.

## Decisions Made

- **The render-source `contentRevision` field carries the raster revision.** The plan said to leave "the `contentRevision` field" canonical while also requiring every per-frame cache key to be motion-independent. Tracing the three consumers proved they rebuild `cacheRevision` templates from that field; a canonical value there would desync them on any motion-carrying track. The structural entry's `contentRevision` and `getRotoPhysicalContentRevision` remain canonical, satisfying both statements.
- **Motion is persistence identity but not pixel identity.** The split is documented at the structural entry as the REL-03/MOTN-07 law; sampled motion values never enter a flattened cache key.
- **Required members over optional.** Every snapshot and port construction site was fixed instead of widening the types, matching the plan's "a snapshot missing `railMotions` is impossible" behavior row.
- **Requirements left pending.** MOTN-01/02/12/REL-03 describe the user-facing capability and the fully flattened cache term; this plan delivers the store, persistence and undo plumbing, while 59-08 (cache term) and 59-12 (animate command/UI) and live UAT are still ahead. Following the 59-01/59-02/59-03/59-06 precedent, no requirement was falsely flipped (`requirements-completed: []`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The main apply path did not stage rail motion**
- **Found during:** post-Task 3 emission audit of Task 2's `<action>` ("carry `snapshot.railMotions` into every payload construction that carries `snapshot.loopClips`")
- **Issue:** The apply path's `stagedRevision` was a 5-argument build (motion defaulted to the empty collection), and neither the deferred document nor the payload base carried `railMotions`. On any track holding motion, the parent would echo a revision hashing the preserved collection while the child had staged the empty one — every accepted edit would settle as `settlement-mismatch`; a replay (Undo/Redo) also could not restore the motion collection.
- **Fix:** Added `stagedRailMotions` (replay target wins, otherwise the launch read), hashed it into `stagedRevision`, wrote it into the deferred document, and shipped it on the wire through `cloneRailMotions`.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts`
- **Commit:** `4bf474e2d`

### Process and design deviations (additive, no behavior outside the planned contract)

- **Tasks 1 and 2 RED/GREEN were partially inherited.** A prior attempt on this branch had already committed Task 1 RED+GREEN (`11fe8612f`, `f55b0a472`) and Task 2 RED (`5ed762c43`), leaving Task 2 GREEN uncommitted in the working tree. The existing implementation was verified against every `<behavior>` row and the plan's `<verify>` suites rather than rewritten; Task 2 GREEN was then committed as `12a2ccf57`.
- **Task 3's RED capture required a temporary revert.** Implementation had preceded the test in the inherited working tree. The two production files were backed up to `/tmp/59-07-task3-backup/`, reverted with a specific-file `git checkout --`, the JUnit RED run was captured (12 tests, 2 failures), then the implementation was restored and the suite confirmed green. No `git stash` or `git clean` was used.
- **Five test-fixture files and `PhysicsPaintStudio.tsx` were modified beyond the plan's `files_modified` list.** Making `railMotions` required on the snapshot and the records port forced every construction site to supply it — the plan's own behavior row anticipates this. These are mechanical member additions, not behavior changes.
- **Observed, not changed:** `rebuildRotoPhysicalOwnership` call sites in the Studio still pass the canonical `document.revision`. Motion edits do not traverse the ownership rebuild path, so no plan prohibition is violated; a record edit on a motion-carrying track could at worst cause a cache miss, never corruption. Left for the plan that owns ownership rebuilds.

## Issues Encountered

- Repeated typecheck failures for missing `railMotions`/`getRailMotions` members were resolved by supplying the members at every construction site, per the plan's intent, rather than relaxing the types.
- The structured-clone plain-data guard rejects `undefined` member values, so test payloads that must omit `railMotions` omit the key entirely (`omitRailMotions: true`) instead of passing `{ railMotions: undefined }`.
- A `loop-placeholder` render-source union variant has no `contentRevision`; the new test narrows it before reading, as production consumers do.

## Threat Surface Scan

No new security-relevant surface beyond the plan's threat register. All three mitigations landed: T-59-19 (closed allowlist + fail-closed 59-02 parse before any write + transactional setter), T-59-20 (required snapshot member, both comparators, replay emission, before/after restore test), T-59-21 (512/5/4096 caps enforced by the parser; motion-only edits cannot rotate raster tokens). T-59-SC: no package install occurred.

## Known Stubs

None. Every field wired in this plan is read by production code; no placeholder values, TODOs or components with unwired data were introduced.

## User Setup Required

None.

## Next Phase Readiness

- 59-08 can flatten the sampled motion values into the cache key knowing the canonical revision already carries motion and the raster path is motion-free by construction.
- 59-11/59-12 can issue motion edits through the existing coordinator path: the payload, the store setter, the settlement write and Undo/Redo already accept and restore the collection.
- Verification state: typecheck exit 0; the five plan-named suites pass 65/65; the coordinator + history suites pass 180/180; the full suite passes 383 files / 7528 tests (2 skipped files, 1 skipped test, 96 todo); `grep -c '\${contentRevision}' app/src/stores/physicPaintStore.ts` = 0; `buildPhysicPaintRotoPhysicalRasterRevision` has exactly one definition and two references in the store.

## Self-Check: PASSED
