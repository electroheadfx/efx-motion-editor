---
phase: 261029-lsr
plan: 01
subsystem: ui
tags: [preact, signals, aquarelle, undo-redo, script-authoritative, live-pixel-cache, tdd]

# Dependency graph
requires:
  - phase: 261022-pim
    provides: revision-authoritative aquarelle edit snapshots + the delete re-bake route
  - phase: 52.2-14
    provides: the bounded live-pixel finalization queue and its stale gates
  - phase: 261028-k03
    provides: the durable aquarelle base and its recovery path
provides:
  - beginAquarelleStrokeUndoEdit — a WITH/AFTER, WITHOUT/BEFORE stroke edit at one revision
  - reanchorAquarelleEditRevision — re-seats only the attempted side after a failed bake
  - runAquarelleScriptReplay — the ONE pure replay orchestration (8 injected ports)
  - hasRecordedStroke / replayStroke on the aquarelle script history route
  - a script-epoch capture gate (isStillCurrent) at produce and at commit
affects: [aquarelle undo/redo, live-pixel cache, Studio route contracts, future Roto script work]

# Actuals (#2632) — pairs with the plan's `estimate`.
# Same scale as the plan (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 19542
  tasks: 3
  commits: 3

# Measurement instrument (#3968) — measured with `git rev-list --count`, never narrated.
plan_head_before: d5d660dabd56a9a8a4732323ebf8163c76712078
plan_head_after: 162bd902b875f0f70801d11c72d567f4a29fa882

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure injectable orchestration module (`runAquarelleScriptReplay`) owns step order; the Studio supplies ports"
    - "onStep stream as the failure discriminator (entered / reached-rebake) instead of parallel booleans on the route"
    - "Optional identity port (`isStillCurrent`) that fails closed only when supplied"

key-files:
  created:
    - app/src/components/physic-paint/roto/aquarelleScriptReplay.ts
    - app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts
  modified:
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts
    - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts
    - app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "Script-authoritative replay: a recorded stroke's Cmd+Z mutates the recorded script, resets the live sheet, and re-bakes through the shared Apply path; unrecorded strokes keep undoPaint()"
  - "invalidateLivePixels(playFrame) is the FIRST, synchronous replay step, because applyAquarelleTimeline force-flushes pending captures at its own first await"
  - "Two-layered capture gate: the per-key revision plus a monotonic script epoch (aquarelleStrokesRevision) checked at produce AND at commit"
  - "Orchestration pin only: vitest proves step order and digest equality; real GPU pixels remain the user's native UAT"
  - "Reuse the delete machinery, keep the paint ledger kind, one ledger — no second script-authoritative stack"

patterns-established:
  - "Replay route recovery: entered-but-never-rebaked drops a dead cached edit id; a post-rebake failure re-anchors; a guard refusal leaves the cache untouched"
  - "Source-contract migration: when a route body moves into a module, the route row is re-pointed at the helper slice rather than deleted"

requirements-completed: [UNDO-ROUTE, UNDO-REBAKE, UNDO-CAPTURE-EPOCH, UNDO-PIN, UNDO-AUTOKEY, UNDO-PLAYBACK]

coverage:
  - id: D1
    description: "Recorded aquarelle strokes undo/redo through the script replay (paint and auto-key-paint, both directions); unrecorded strokes keep the engine path"
    requirement: UNDO-ROUTE
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#261029-lsr recorded-stroke routing"
        status: pass
    human_judgment: false
  - id: D2
    description: "One replay orchestration: invalidate -> durable base -> prepare -> restore -> reset -> re-bake -> rollback-on-failure -> notify -> owner publish"
    requirement: UNDO-REBAKE
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts#runAquarelleScriptReplay"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#the replay port restores the snapshot, resets the sheet, and awaits the shared apply"
        status: pass
    human_judgment: false
  - id: D3
    description: "A capture stamped before a script mutation can never publish its pixels (epoch checked before produce and again at commit)"
    requirement: UNDO-CAPTURE-EPOCH
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts#261029-lsr script epoch gate"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts#261029-lsr script epoch stamp and compare (D-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Deterministic pin: after a replay, digestRenderedFrameBytes(display) === digestRenderedFrameBytes(published bake), with a negative control"
    requirement: UNDO-PIN
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts#display digest equals the published bake digest"
        status: pass
    human_judgment: false
  - id: D5
    description: "Auto-key-paint composites route their stroke half through the replay; a rejected key replay rolls the stroke back via the inverse script replay"
    requirement: UNDO-AUTOKEY
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts#261029-lsr recorded-stroke routing"
        status: pass
    human_judgment: false
  - id: D6
    description: "Playback stops only after the guard block passes; a refused Cmd+Z neither kills a queued capture nor stops playback"
    requirement: UNDO-PLAYBACK
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#the replay port restores the snapshot, resets the sheet, and awaits the shared apply"
        status: pass
    human_judgment: false
  - id: D7
    description: "Real GPU pixels: a recorded-stroke undo removes the paint on screen, the frame matches its bake, and Move/Lift see the post-undo script"
    verification: []
    human_judgment: true
    rationale: "vitest runs without WebGL and every bake test mocks the engine; the plan's native UAT rows 1-8 are the only proof of real rendered pixels"

# Metrics
duration: 13min
completed: 2026-10-29
status: complete
---

# Quick Task 261029-lsr: Script-authoritative undo for aquarelle strokes — Summary

**A recorded aquarelle stroke's undo/redo now mutates the recorded script, resets the live sheet, and re-bakes through the shared Apply path, so the frame can never drift from its bake; unrecorded strokes keep the engine-only route, and no capture stamped before the undo can publish its pixels.**

## Performance

- **Duration:** ~13 min (from the final plan revision commit `d5d660da` to the last task commit)
- **Started:** 2026-10-29T15:21:16Z
- **Completed:** 2026-10-29T15:34:01Z
- **Tasks:** 3
- **Files modified:** 12 (2 created, 10 modified)

## Accomplishments

- **The drift is closed for recorded strokes.** `beginAquarelleStrokeUndoEdit` builds a script edit whose `after` is the live timeline WITH the stroke and whose `before` is that same timeline WITHOUT it plus a tombstone — at one revision, so the immediate undo passes the revision guard. `restoreAquarelleEditSnapshot` installs the WITHOUT side, the live sheet is reset, and the re-bake republishes the only authority.
- **One replay orchestration, one order.** `runAquarelleScriptReplay` runs invalidate → ensure-base → prepare → restore → reset → rebake → notify → publish-owner, never throws, and fails closed on every path; the Studio's `runScriptReplay` supplies the ports and guards (`isPhysicalMutationLocked`, apply/mutation lock, script-edit-in-flight) *before* `rotoCachedPlayback.stop()`, so a refused Cmd+Z never stops playback.
- **Routing is a predicate on recordedness, not a new stack.** `hasRecordedStroke` (no tombstone term — a deleted stroke's REDO must still route) sends `paint` and `auto-key-paint` entries through `replayStroke`; unrecorded entries keep the byte-identical optimistic `undoPaint()`/`redoPaint()` path.
- **Dead cached edit ids cannot block undo forever.** The `onStep` stream classifies a false replay: entered-but-never-rebaked drops the cached edit id (10-entry eviction), a post-rebake failure re-anchors the attempted side, and a guard refusal leaves the cache untouched.
- **No pre-undo pixels can commit.** The capture carries an optional `isStillCurrent` epoch gate checked before produce and again at commit; the coordinator stamps `aquarelleStrokesRevision` synchronously at capture entry and re-reads the same port at both gates.
- **Deterministic pin.** The replay test proves `digestRenderedFrameBytes(display) === digestRenderedFrameBytes(bake)` plus a negative control (no reset → digests differ).

## Task Commits

Each task was committed atomically:

1. **Task 1: Stroke undo edit builder + pure replay orchestrator (and their pins)** — `97dc79fd` (feat)
2. **Task 2: Route recorded strokes through the script replay (ledger + Studio route)** — `c179ce82` (feat)
3. **Task 3: Capture epoch (script revision) at stamp and commit + source contract** — `162bd902` (feat)

**Plan metadata:** not committed by the executor — the orchestrator owns the docs commit for `261029-lsr-PLAN.md`, `-CONTEXT.md`, `-RESEARCH.md` and this SUMMARY.

## Files Created/Modified

- `app/src/components/physic-paint/roto/aquarelleScriptReplay.ts` (new) — the pure, injectable replay orchestration and its port/step types.
- `app/src/components/physic-paint/roto/aquarelleScriptReplay.test.ts` (new) — order pin, digest equality + negative control, every fail-closed path, pre-built-id skip.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.ts` — `beginAquarelleStrokeUndoEdit` (direction contract documented) and `reanchorAquarelleEditRevision`.
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` — 5 new rows (build, redo cycle, refusals, Dry survival, re-anchor retryability).
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — `hasRecordedStroke` / `replayStroke` on the route; recorded arms in the paint and auto-key branches.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts` — 8 new routing rows across both kinds and both directions.
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `runScriptReplay`, the three-member route with onStep recovery, `aquarelleStrokeEditIdsRef`, `getScriptEpoch`.
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` — the two former route-contract rows migrated onto the helper + module; the epoch/step-order row.
- `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.ts` — `isStillCurrent` on the capture plus the two guards.
- `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts` — 4 new epoch rows (the 13 pre-existing rows untouched).
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` — `getScriptEpoch` port, the synchronous stamp, the fresh-read compare closure.
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts` — 2 source-contract rows pinning stamp-before-capture and the fresh-read closure.

## Decisions Made

The four locked signal decisions, honoured verbatim from CONTEXT.md:

- **Script-authoritative via `runAquarelleScriptReplay`** — reuse the delete machinery: an undo of a recorded stroke is a single-stroke delete edit (before/after script snapshots), the live sheet is reset, and the frame is re-applied through the shared Apply/re-bake path as one ledger command; redo is the inverse snapshot swap. No dedicated lighter re-bake path, no second rendering authority.
- **`invalidateLivePixels(playFrame)` is the first, synchronous step** — no settle/await barrier before undo: Cmd+Z stays immediate, and a capture queued before the undo is dead before `applyAquarelleTimeline` force-flushes.
- **Two-layered capture gate** — the per-key revision plus a monotonic script epoch recorded at capture start, checked at produce and again at commit; late acks are dropped, never baked.
- **Orchestration pin, native UAT owns real pixels** — vitest proves step order and digest equality (real GPU pixels are unreachable under `vitest run`); the user's native UAT is the only proof of rendered pixels.

Additional execution decisions:

- The edit identity is resolved from `mutationId` at replay time via `aquarelleStrokeEditIdsRef`, keeping the ledger entry shape untouched (the plan's preferred discretion).
- `notify: () => { ... }` / `publishOwner: () => { ... }` are written on one line each so the migrated source contract asserts the exact authored literals.
- The two new epoch rows run *before* the gesture-idle rows in the transaction suite: those rows leave the shared finalization machine parked on a fake-timer idle window, which would stall a later capture's quiescence gate.

## Deviations from Plan

None — the plan was executed as written. Two test-expectation corrections were made during TDD, both inside the authored rows (not changes to planned behaviour):

### Auto-fixed Issues

**1. [Rule 1 - Bug] Auto-key redo availability expectation corrected**

- **Found during:** Task 2 (recorded-stroke routing rows)
- **Issue:** The row expected `{ undo: 0, redo: 1 }` after an accepted key replay, but the pre-existing D-14 acceptance pathway (`recordAcceptedEdit` via the `acceptedOutput` signal) already moves the composite entry redo→applied before the stroke replay runs, yielding `{ undo: 1, redo: 0 }`.
- **Fix:** Corrected the test to the actual (and plan-mandated) behaviour — the stroke result intentionally does not gate the return, mirroring today's unchecked `redoPaint()`.
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts`
- **Verification:** The row documents why the key half moves on its own pathway; the hook suite is green.
- **Committed in:** `c179ce82` (Task 2 commit)

**2. [Rule 1 - Bug] Epoch rows made order-independent**

- **Found during:** Task 3 (transaction rows)
- **Issue:** Captures driven through the shared finalization machine timed out (5s) once the gesture-idle rows had set a recent interaction clock / left a fake-timer idle window parked.
- **Fix:** The reject-before-produce row relies on the gate asking `isStillWanted('before-produce')` *before* its quiet window; the accept/legacy/commit rows open the gate through the documented flush path (`transactions.flush(identity)`). The describe was also moved ahead of the gesture-idle rows with a comment explaining why.
- **Files modified:** `app/src/components/physic-paint/roto/rotoLivePixelCacheTransactions.test.ts`
- **Verification:** All 4 rows pass both in isolation and in the full-file run.
- **Committed in:** `162bd902` (Task 3 commit)

---

**Total deviations:** 0 from plan scope; 2 test-expectation corrections auto-fixed.
**Impact on plan:** None on behaviour. No new dependency, no config change, no feature flag.

## Issues Encountered

- The first `Table`/filter approach in the stroke-edit builder hit a TypeScript narrowing limit (`.filter()` on a union array does not narrow to the stroke payload); resolved with an explicit loop helper in the test (`mutationIdsOf`) rather than a cast.
- `runAquarelleScriptReplay` receives `revert` typed from the caller's `restore` port, so the raw rollback stays type-safe without importing the snapshot type into the module (the module has no runtime imports).

## Verification

- Targeted gate (all six suites): **452 tests passed**, 6 files.
- Full app suite: **355 files passed / 2 skipped (357)**, **6343 tests passed / 1 skipped / 96 todo (6440)** — exit code 0.
- `pnpm --filter efx-motion-editor typecheck`: clean.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Automated work is complete; the plan's native UAT rows 1-8 (real GPU pixels, frame-vs-bake agreement, Move/Lift after undo) are the user's to run.
- Known limit carried by design: a failed re-bake re-anchors only the attempted direction, so the opposite direction stays fail-closed until a successful bake — intentional (never forgive a foreign script mutation).
- Pre-existing, out of scope: the delete/reorder/place handlers still lack `ensureAquarelleDurableBaseRef` before their snapshot swaps (R-1's ordering gap noted by the plan; this task adds the base recovery only to the shared replay route).

---
*Quick task: 261029-lsr*
*Completed: 2026-10-29*

## Self-Check: PASSED

- All three task commits are ancestors of HEAD: `97dc79fd`, `c179ce82`, `162bd902`.
- Both created source files exist on disk; this SUMMARY is intentionally left uncommitted for the orchestrator's docs commit.
