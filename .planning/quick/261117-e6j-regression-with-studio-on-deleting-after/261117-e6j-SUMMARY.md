---
phase: quick/261117-e6j
plan: 01
subsystem: physics-paint-roto-settlement
tags: [preact, signals, roto, physical-edit, lease, settlement, drift, delete-rails, studio]

# Dependency graph
requires:
  - phase: 59-15
    provides: rail-motion commit-point reconciliation — the staged revision hashes the reconciled motion collection the drift guard compares
  - phase: quick/261116-u63
    provides: the Studio surfaces and stroke seams that exposed the reported wedge; no file it touched is modified here
provides:
  - A drifted post-publication settlement RELEASES the physical-edit lease (clearPendingOnce -> lease.release) instead of transferring it to recovery ownership
  - A culprit-naming drift diagnostic (no document / revision / selectedKeyId / cursorAppFrame, with both values) behind the unchanged "Published physical document drifted before settlement" prefix
  - A core-of-invariant store test pinning staged revision == published revision, with selection/cursor preserved, for four key-rail delete shapes
affects: [physics-paint-studio, useRotoPhysicalEditCoordinator, rail-motion-reconciler, physicPaintStore]

# Actuals (#2632) — pairs with the plan's estimate (50000 tokens, 2 tasks).
actuals:
  tokens: 4240     # chars/4 over the realized diff (16960 chars)
  tasks: 2
  commits: 3

plan_head_before: 90006d7688e6de7abed7b965e98807050928702d
plan_head_after: 9caf1a1160f695ce68f69c8ccfea7dedbe6251da

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-publication drift releases, never transfers: a completed publication has no ambiguous commit for a recovery lease to guard, and a recovery lease gates the very availability the Studio reads"
    - "Failure diagnostics name the failing sub-check and both values, so a live recurrence identifies its own residual trigger from the console line alone"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoDeleteSettlement.test.ts
  modified:
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts

key-decisions:
  - "Release the exclusive lease on a drifted publication: the drift runs after publishCompleteDocument succeeded and the parent committed, so the child state is complete, not ambiguous; a recovery lease kept isRotoPhysicalOperationAvailable false and the Studio's physicalMutationAvailable turned that into a total mutation lock while the coordinator's own release path was unreachable behind it."
  - "Keep the drift guard itself (four checks, same order, same message prefix) — it is the 59-07 staged-vs-published revision guard; only its diagnostic and lease disposition change."
  - "Keep the pre-publication 'exception' branch's { transferLeaseToRecovery: true }: a failed publication is the genuinely ambiguous case the recovery lease exists for."

patterns-established:
  - "Drift diagnostics carry both compared values (revision / selectedKeyId / cursorAppFrame) plus the layer/track on a missing document"

requirements-completed: []

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A drifted child publication still settles as a settlement-mismatch failure but releases the physical-edit lease: transfer never called, recovery slot empty, pendingOperationId cleared, and the diagnostic names the failing sub-check with both values"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#releases a drifted publication so the next Delete Rails can start and names the failing sub-check"
        status: pass
    human_judgment: false
  - id: D2
    description: "The rail-delete settlement invariant holds through the real store for four key-rail shapes: staged 6-argument revision equals the published read-back revision, selection and cursor preserved, motion anchored on a deleted key reconciles away"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoDeleteSettlement.test.ts (4 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live Studio rows 1-4: deleting a selected rail leaves every mutation surface live on the next press (add a key, paint, add a rail), including a rail holding the selected key and a rail carrying a motion; undo/redo keep working; any residual drift logs its culprit verbatim"
    verification: []
    human_judgment: true
    rationale: "Cross-webview judgment in the packaged Studio; the executor never launches the app or the server. Per the plan's evidence policy the regression is not closed until row 1 is reported."

duration: 7min
completed: 2026-11-17
status: complete
---

# Quick 261117-e6j: Regression with Studio on deleting after Summary

**A drifted post-publication settlement now releases the Roto physical-edit lease — instead of transferring it to recovery and locking every Studio mutation surface until the window was closed — and names the failing sub-check, with the rail-delete settlement invariant pinned for four key-rail shapes through the real store.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-11-17T09:30:32Z
- **Completed:** 2026-11-17T09:37:39Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- The drift branch in `consumePhysicalEditResult` builds a culprit string naming exactly one sub-check and both values — `no document for layer <id> (track <id>)`, `revision <current> != <staged>`, `selectedKeyId <current> != <pending>`, or `cursorAppFrame <current> != <pending>` — behind the unchanged `Published physical document drifted before settlement` prefix. The guard's four checks and order are untouched.
- A drifted publication now RELEASES the exclusive lease (`clearPendingOnce` -> `ports.lease.release`) instead of transferring it to recovery ownership. The recovery slot stays empty, so `isRotoPhysicalOperationAvailable` never latches false and the Studio's `physicalMutationAvailable` keeps every edit surface live; the next edit re-stages from the published document.
- The pre-publication `'exception'` branch keeps `{ transferLeaseToRecovery: true }` — a failed publication is the genuinely ambiguous case the recovery lease exists for.
- A forced-drift coordinator test proves the failure surface is preserved (`settlement-mismatch`, diagnostic, failure output), `transferLeaseToRecovery` is never called, `releaseLease` receives the exclusive token, `recoveryLease` and `pendingOperationId` are null, and a second Delete Rails dispatches without the in-flight barrier.
- A store-level characterization test drives the REAL proposer, reconciler, 6-argument revision builder, strict parser and `replace`/`getRotoPhysicalDocument` for four key-rail shapes — whole rail with a selected middle key, whole rail carrying a motion anchored on a deleted key, break-separated trailing single-key rail, leading rail with a selected survivor — asserting the published read-back revision equals the staged revision with selection and cursor preserved.

## Task Commits

Each task was committed atomically (Task 1 was TDD: RED then GREEN):

1. **Task 1 RED: failing test for drifted-publication settlement release** - `10683ee7a` (test)
2. **Task 1 GREEN: release a drifted publication instead of wedging the Studio** - `e4f6ec1a7` (fix)
3. **Task 2: pin the rail-delete settlement invariant through the real store** - `9caf1a116` (test)

_Plan metadata (SUMMARY.md/PLAN.md/STATE.md) is committed by the orchestrator, not the executor._

## Files Created/Modified
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` — culprit-naming drift diagnostic; drift branch releases (no `transferLeaseToRecovery`) with a contract comment naming the Studio gate and the unmount-only escape.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` — `driftNextPublication` harness flag: the fake `replaceDocument` stores a canonically valid but revision-divergent interpolation (a canonical revision term) after writing every field; plus the forced-drift settlement/lease/second-dispatch test.
- `app/src/components/physic-paint/roto/physicsPaintRotoDeleteSettlement.test.ts` — `runScenario` helper (seed -> propose -> reconcile -> stage -> publish -> read back) and four shape tests with shared settlement-agreement assertions.

## Decisions Made
- Release, never transfer, on a drifted publication — the drift runs AFTER a successful publication (complete child document, parent committed), so there is no ambiguous commit for a recovery lease to guard; the recovery lease gates the availability the Studio's `physicalMutationAvailable` reads, and the coordinator's own release path is unreachable behind that gate (only the unmount effect escaped — exactly why closing and reopening the Studio restored everything).
- Keep the 59-07 drift guard verbatim; only the diagnostic and lease disposition change.
- The `'exception'` publication-failure branch keeps its recovery transfer unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan assertion referenced a non-existent payload field**
- **Found during:** Task 1 (drifted-publication test)
- **Issue:** The behavior block said to assert the diagnostic contains `test.getPayload()!.stagedRevision`, but `PhysicPaintRotoPhysicalEditApplyPayload` has no `stagedRevision` member.
- **Fix:** Used `test.makeResult().stagedRevision` — the parent echo the settlement compares against `pending.stagedRevision` on the accepted transition, so it asserts the same staged value.
- **Files modified:** app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
- **Verification:** RED failed on the planned assertions; GREEN passes.
- **Committed in:** `10683ee7a` (Task 1 RED commit)

**2. [Rule 3 - Blocking] Plan seed fixture lacked the second Delete Rails target**
- **Found during:** Task 1 (drifted-publication test)
- **Issue:** The plan seeded `seedGroupDocument(groupLifecycleDocument())` and then deleted `group-1`, expecting a second dispatch of `group-shared`; the default fixture contains only `group-1`.
- **Fix:** Seeded `groupLifecycleDocument({ sharedSourceOwner: true })` (the same seed the existing Delete Rails accept test uses) so the second dispatch targets a real group.
- **Files modified:** app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
- **Verification:** The second Delete Rails dispatches (`sendPhysicalEditPayload` called once more) and the in-flight barrier is never set.
- **Committed in:** `10683ee7a` (Task 1 RED commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Assertion and fixture corrections only — no production behavior change beyond the plan.

## Issues Encountered
- Task gates: typecheck clean at both commits; coordinator suite 107/107; new settlement file 4/4.
- Boundary run: 56/56 green (`railMotionDocumentReconciler.test.ts` 26, `physicPaintStore.rotoRailMotions.test.ts` 30).
- Full-suite baseline: 9496 passed, 1 failed, 1 skipped, 96 todo. The single failure is `src/lib/physicPaintBridge.test.ts > 63-05 brush-tip realm channels > import round trip through the main realm > answers with the same operationId and publishes the catalog before the answer`; the file passes in isolation (186 passed, 1 skipped). The same untouched bridge-timing file flaked in the previous quick (261116-u63) on a different test — a parallel-timing flake, not a regression: no file this plan touches appears in the failure.
- Pre-existing node-environment stderr noise (`[aquarelle-render-split] write failed ReferenceError: window is not defined`, audio decode fetch failures) — unrelated to this change.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Automated gates are green; the live Studio UAT rows below remain PENDING user evidence. Do not claim the regression closed before row 1 is reported.

### Live UAT rows (Studio, Roto physical layer)
1. Select a rail and delete it. The rail disappears and the Studio REMAINS USABLE on the next press — add a key, paint a stroke, add a rail, all without closing and reopening the Studio.
2. Repeat on a rail that contains the selected key, and on a rail carrying a rail motion: same result.
3. Undo (Cmd+Z) after a delete restores the rail(s) and the Studio stays usable; redo works.
4. If the console logs `Roto physical edit failed (settlement-mismatch): Published physical document drifted before settlement (...)`, report the parenthesized text verbatim — it names the residual live-only sub-check (revision / selectedKeyId / cursorAppFrame / no document) for a follow-up quick.

No coordinator refactor, no apply-pipeline change, no `'exception'`-branch change, no installs, no dev-server run.

## Known Stubs
None.

---
*Phase: quick/261117-e6j*
*Completed: 2026-11-17*

## Self-Check: PASSED

- Created file exists: `app/src/components/physic-paint/roto/physicsPaintRotoDeleteSettlement.test.ts`
- SUMMARY exists: `.planning/quick/261117-e6j-regression-with-studio-on-deleting-after/261117-e6j-SUMMARY.md`
- Commits are ancestors of HEAD: `10683ee7a`, `e4f6ec1a7`, `9caf1a116` (measured `commits: 3` over base `90006d768`)
