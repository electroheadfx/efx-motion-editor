---
phase: 59-rail-motion-channels-v7-interface
plan: 15
subsystem: roto rail-motion identity, copy re-key and merge-drop settlement
tags: [preact, signals, rail-motion, reconciliation, bridge, tdd]
plan_head_before: 918aa2fa7d0dd324b179b448301f8ed77d57d724
plan_head_after: 01fb2a5c7bc025d2eb97dd45286d65d649c69d48

requires:
  - phase: 59-06
    provides: rail-motion identity transitions and the copy re-key authority
  - phase: 59-07
    provides: replay settlement contract and explicit collection emission
  - phase: 59-12
    provides: the session-only merge-drop notice module and signal
provides:
  - one pure reconciler invoked at the bridge commit point before `stagedRevision`
  - store-direct reconciliation inside every document write
  - copy / paste / duplicate that carries motion onto fresh rail identities
  - a two-sided merge drop delivered through the settlement contract and published at acceptance
affects: [59 verify-work, rail-motion UI strip, future motion channel phases]

actuals:
  tokens: 39420
  tasks: 4
  commits: 7

tech-stack:
  added: []
  patterns:
    - "One reconciler call site before the staged revision; the 59-06 transitions are the only identity authority"
    - "Copy re-key: frozen payload collection is the copy authority, validated whole-plan before any destination merge"
    - "Optional settlement metadata: a three-scalar notice, validator-gated and published only in the accepted path"

key-files:
  created:
    - app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts
    - app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts
  modified:
    - app/src/lib/physicPaintBridge.ts
    - app/src/lib/railMotionGateBEdits.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.rotoRailMotions.test.ts
    - app/src/types/physicPaint.ts
    - app/src/types/physicPaint.test.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts

key-decisions:
  - "Reconcile rail motion once, in the bridge before `stagedRevision`, and inside the store-direct helpers in the same write — so the motion consequence and its undo share one commit."
  - "A paste re-keys from the FROZEN payload collection via `rekeyRailMotionsForCopy(..., copiedSourceRailIds)` and then merges the destination collection sorted by railId; the plan's literal `rekeyRailMotionsForCopy(document.railMotions, plan)` would have dropped the copied source record."
  - "The parent paste recompute starts from the PRE-edit collection; otherwise the child's staged copies look like destination collisions and every paste self-rejects."
  - "The merge-drop notice is optional scalar settlement metadata: allowlisted and validated, absent on failure and replay, published only after the accepted revision is confirmed."
  - "Any accepted edit without a drop dismisses the session slot, so the accepted restoring undo clears the row without a new effect or subscription."

requirements-completed: [MOTN-01, MOTN-02, MOTN-05, MOTN-12]

coverage:
  - id: D1
    description: "Every Gate B structural edit writes the reconciled rail-motion collection in the same commit, and one undo restores it"
    requirement: MOTN-12
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionGateBEdits.test.ts (18 tests)"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Copy / paste / duplicate carries motion onto fresh rail identities and fails closed on identity conflicts"
    requirement: MOTN-02
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts (34 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Store-direct document helpers reconcile rail motion inside the same write"
    requirement: MOTN-01
    verification:
      - kind: unit
        ref: "app/src/stores/physicPaintStore.rotoRailMotions.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "A rail start move leaves every rail-local motion frame unchanged"
    requirement: MOTN-05
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionGateBEdits.test.ts#keeps every rail-local frame when the rail start moves"
        status: pass
    human_judgment: false
  - id: D5
    description: "A two-sided merge reports the dropped rail and its prior span through the settlement contract, and the accepted restoring undo dismisses the row"
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionGateBEdits.test.ts#reports the two-sided merge drop in the accepted settlement and omits it on the restoring undo"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts#59-15 (MOTN-10): merge-drop notice settlement"
        status: pass
      - kind: unit
        ref: "app/src/types/physicPaint.test.ts#accepts the merge-drop notice only on an ordinary accepted settlement"
        status: pass
    human_judgment: false

metrics:
  duration: 37min
  started: 2026-11-06T18:23:06+01:00
  completed: 2026-11-06T19:00:23+01:00
  tasks: 4
  files: 17
status: complete
---

# Phase 59 Plan 15: Rail Motion Follows Every Rail Edit Summary

**Rail motion is written in the same commit as the edit that changes the rail, survives copy/paste/duplicate onto fresh identities, and reports a two-sided merge drop through the settlement contract.**

## Performance

- **Duration:** 37min
- **Started:** 2026-11-06T18:23:06+01:00
- **Completed:** 2026-11-06T19:00:23+01:00
- **Tasks:** 4
- **Files modified:** 17 (application + test files)

## Accomplishments

- One pure reconciler (`railMotionDocumentReconciler.ts`, 379 lines) classifies every structural edit from production `deriveKeyRailSegments` output on both sides and invokes the ratified 59-06 transitions by name. The bridge calls it before `stagedRevision`, so the motion consequence lands in the same document write, fingerprint, accepted-command snapshot and undo step; the store-direct helpers reconcile inside their own write.
- Copy/paste/duplicate freezes the animated members' records into the copy payload, allocates fresh rail identities, re-keys the whole copy plan through `rekeyRailMotionsForCopy`, and merges the copies into the destination collection. Every identity conflict fails closed before any construction.
- A two-sided merge's drop (railId + prior app-frame span) travels through the settlement result as a bounded three-scalar `railMotionMergeNotice`; the coordinator publishes it on acceptance and dismisses it on any accepted edit without a drop. Failed settlements never touch the slot, and replay results never carry the member.
- Gate B is proven end-to-end through the REAL transport: 18 real-store specs drive the real resolver payloads, assert the stored collection and revision, and assert one undo restores motion exactly.

## Task Commits

Each task was committed atomically (TDD tasks have RED then GREEN):

1. **Task 1: Delete-first-key end-to-end tracer** — `90c2523e2` (feat; tracer slice with its reconciler + real-transport specs)
2. **Task 2: Every Gate B transition through its real product operation** — `155d6b495` (test RED), `26f284cfe` (feat GREEN)
3. **Task 3: Copy / paste / duplicate carries motion onto fresh identities** — `eee91565f` (test RED), `50c85967d` (feat GREEN)
4. **Task 4: Merge-drop notice through the settlement contract** — `cce5f8dd8` (test RED), `01fb2a5c7` (feat GREEN)

**Plan metadata:** committed after this SUMMARY (docs: complete plan)

## TDD Gate Compliance

- **Task 2** — `red-evidence-59-15-task2.json`, validated `RED_EVIDENCE_OK`; RED `155d6b495`, GREEN `26f284cfe`.
- **Task 3** — `red-evidence-59-15-task3.json`, validated `RED_EVIDENCE_OK` (target: key-rail re-key assertion); RED `eee91565f`, GREEN `50c85967d`.
- **Task 4** — `red-evidence-59-15-task4.json`, validated `RED_EVIDENCE_OK` (target: two-sided merge settlement notice); RED `cce5f8dd8`, GREEN `01fb2a5c7`.
- **Task 1** is a `type="tracer"` task (no `tdd` attribute); its production slice and real-transport specs were committed together, and the slice was verified end-to-end before the expansion tasks.

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts` — the one pure reconciler; classifies edits from production segment derivation and invokes 59-06 transitions.
- `app/src/components/physic-paint/roto/railMotionDocumentReconciler.test.ts` — transition table, group ownership, idempotence and merged drop-report rows.
- `app/src/lib/physicPaintBridge.ts` — commit-point reconciliation before `stagedRevision`, paste collection comparison, merge-drop notice construction and the optional result member.
- `app/src/lib/railMotionGateBEdits.test.ts` — 18 real-transport Gate B rows covering every structural edit, paste identity, and the settlement notice.
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts` — payload motion snapshot, fresh railIds allocation, whole-plan re-key and destination merge.
- `app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts` — copy/paste/duplicate motion identity rows and conflict rejections.
- `app/src/stores/physicPaintStore.ts` — store-direct reconciliation and clipboard narrowing that preserves motion.
- `app/src/stores/physicPaintStore.rotoRailMotions.test.ts` — document-write reconciliation rows.
- `app/src/types/physicPaint.ts` — strict allowlist/validation for the new payload, allocation and settlement members.
- `app/src/types/physicPaint.test.ts` — payload/allocation/notice validator contract rows.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` — staged collection shipping and notice publish/dismiss at acceptance.
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.test.ts` — settlement notice rows and updated fixtures.
- `app/src/components/physic-paint/roto/physicsPaintRotoGroupLifecycle.ts` — delete-rails proposal carries the collection.

## Decisions Made

- Reconciler call site: exactly one in the bridge, before the staged revision, and one per store-direct helper. Transitions remain the only identity authority.
- Copy re-key authority: the frozen payload collection, not the source document. `rekeyRailMotionsForCopy` validates the whole plan; the destination merge is explicit, sorted by railId, and destination-collision checked.
- Paste staging and parent recomputation both start from the pre-edit destination collection, so the child's copies cannot masquerade as destination records.
- The notice is scalar settlement metadata, not document state: no store write, no revision term, no fingerprint term, no undo entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Paste re-key used the payload authority, not the destination collection**
- **Found during:** Task 3
- **Issue:** The plan's literal `rekeyRailMotionsForCopy(document.railMotions, plan)` drops the source record when re-keying, so pasting an animated rail lost its motion; the destination collection also had to survive the merge.
- **Fix:** Call the re-key authority with the frozen payload collection plus `[...payloadMotionRailIds]` as the copied-source set, then merge the destination collection and the re-keyed copies in railId order with an explicit destination-collision check.
- **Files modified:** `physicsPaintRotoRailSetCopy.ts`
- **Verification:** 34 copy/paste/duplicate tests, including multi-member, loop and collision rows.
- **Committed in:** `50c85967d`

**2. [Rule 3 - Blocking] Paste self-rejection at the parent recompute**
- **Found during:** Task 3
- **Issue:** The bridge recomputed the paste target from the post-edit collection, so the child's staged copies appeared as destination records and every paste failed the parent comparison.
- **Fix:** The paste target document and its comparison start from the PRE-edit collection; the reproposal supplies the explicit collection.
- **Files modified:** `physicPaintBridge.ts`, `useRotoPhysicalEditCoordinator.ts`
- **Verification:** Gate B paste acceptance/rejection rows and bridge suite (159 tests, 1 skip).
- **Committed in:** `50c85967d`

**3. [Rule 3 - Blocking] Strict semantic validators rejected the new members**
- **Found during:** Task 3
- **Issue:** The fail-closed payload/allocation validators rejected `railMotions`, `railIds` and member `sourceRailId`, so the bridge returned "Invalid physics paint apply payload".
- **Fix:** Extended the allowlists and bounded validation for `isRotoRailSetCopyPayloadValue`, `isRotoRailSetFreshIdentityAllocationValue` and `isRotoRailSetCopyMemberValue`; no arm was loosened.
- **Files modified:** `app/src/types/physicPaint.ts`
- **Verification:** Payload/semantic-delta suites and bridge suite.
- **Committed in:** `50c85967d`

**4. [Rule 1 - Bug] Loop copy minted a railId distinct from the fresh loopId**
- **Found during:** Task 3
- **Issue:** A copied loop member's motion record must bind to the fresh loopId; a separately minted UUID broke the identity assertion.
- **Fix:** Loop members map their railId to the fresh loopId (and a prescribed allocation must equal it).
- **Files modified:** `physicsPaintRotoRailSetCopy.ts`
- **Verification:** "re-keys a copied loop member onto the fresh loopId" row.
- **Committed in:** `50c85967d`

**5. [Rule 1 - Bug] Document-parser canonical ordering in a test fixture**
- **Found during:** Task 3
- **Issue:** The document parser sorts the collection by railId; the new test expected input order.
- **Fix:** Corrected the expectation to `[loopSource, railA, railB]`.
- **Files modified:** `physicsPaintRotoRailSetCopy.test.ts`
- **Verification:** Multi-member copy row.
- **Committed in:** `50c85967d`

**6. [Rule 2 - Missing critical] Validator rows added to `physicPaint.test.ts`**
- **Found during:** Task 4
- **Issue:** The task action requires validator rows, but the task `<files>` list omitted `app/src/types/physicPaint.test.ts`.
- **Fix:** Added the four contract rows there (well-formed accepted, malformed, failed, replay), the established home of the result validator suite.
- **Files modified:** `app/src/types/physicPaint.test.ts`
- **Verification:** 64 tests pass.
- **Committed in:** `cce5f8dd8`

**7. [Rule 1 - Process] Scalar-first notice assertion for parseable RED evidence**
- **Found during:** Task 4 RED
- **Issue:** `gsd_run check tdd-red-evidence` rejected the deep-equal failure because its multi-line YAML diagnostic is non-TAP.
- **Fix:** Assert the notice's three scalars in order before the structural row; the failure message is then a single scalar and the evidence validates `RED_EVIDENCE_OK`.
- **Files modified:** `railMotionGateBEdits.test.ts`
- **Verification:** RED verdict changed from `INVALID_RED` to `RED_EVIDENCE_OK`.
- **Committed in:** `cce5f8dd8`

**Total deviations:** 7 auto-fixed (2 Rule 1, 1 Rule 2, 3 Rule 3, 1 process).
**Impact on plan:** The re-key authority and paste staging deviations were required for correctness; the validator/test additions are test-only. No scope creep: no new UI, schema, or infrastructure.

## Issues Encountered

- The child and parent must agree on which collection the paste proposal is recomputed from; starting from the post-edit collection produced deterministic self-rejection until the pre-edit base was used.
- The RED evidence parser only accepts single-line TAP failure scalars; deep-equal diagnostics need scalar-first assertions in the target row.
- New required payload members forced fixture updates across six test files (`useRotoKeyUtilities`, `useRotoPhysicalEditCoordinator`, `useRotoTimelineActions`, `physicsPaintRotoSession`, `physicPaintBridge`, Gate B); all are test-only and `pnpm run typecheck` exits 0.

## User Setup Required

None.

## Verification

- `vitest run railMotionDocumentReconciler.test.ts railMotionGateBEdits.test.ts physicsPaintRotoRailSetCopy.test.ts` — 68 passed.
- `vitest run physicPaintBridge.test.ts physicPaintStore.rotoRailMotions.test.ts physicsPaintRotoRailSetCopyBoundary.test.ts physicsPaintRotoRailSetCopySemanticDelta.test.ts` — 178 passed, 1 skipped.
- `vitest run useRotoPhysicalEditCoordinator.test.ts railMotionGateBEdits.test.ts` — 117 passed.
- `vitest run physicPaint.test.ts` — 64 passed.
- `pnpm run typecheck` — exit 0.
- Greps: bridge reconciler calls = 1; reconciler `groupOwnedKeyIds` = 6; `droppedRailFrames` = 5; rail-set-copy `railMotions` = 10; `rekeyRailMotionsForCopy(` = 1; types notice mentions = 4; store notice mentions = 0; coordinator publish = 1, publish+dismiss = 2.

## Next Phase Readiness

Gate B and the merge-drop settlement are ready for `/gsd-verify-work`; the notice row remains session-only UI state owned by the 59-12 module.

## Self-Check: PASSED
