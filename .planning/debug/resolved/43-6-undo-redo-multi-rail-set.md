---
status: resolved
trigger: "G-43.6-2: Delete with a multi-rail set selected works, but undo/redo does NOT work with a multi-rail selection (works with single-rail). Transient: after multi-select delete+undo, ALL subsequent deletes became blocked until app relaunch (not reproducible)."
goal: find_root_cause_only
symptoms_prefilled: true
created: 2026-08-19T00:00:00.000Z
updated: 2026-08-19T16:30:00.000Z
---

## Current Focus

hypothesis: CONFIRMED — parent-side acceptedPhysicalCommands ledger records delete-rails' `before` snapshot selection/cursor from the FORWARD payload's POST-delete values (childBeforeAuthority + coordinator overwrite), while undo replay submits the child's PRE-delete selection; the replay-target check then rejects as a snapshot mismatch, making undo a silent no-op. Single-rail delete-key-rail is excluded from GROUP_LIFECYCLE_OPERATION_KINDS so it records true pre-op selection and works.
test: traced forward coordinator payload (useRotoPhysicalEditCoordinator.ts:1585-1608, 1868-1870) -> bridge ledger record (physicPaintBridge.ts:1636-1652) -> undo replay validation (1583-1606) vs history undo submit (useRotoPhysicalEditHistory.ts:630)
expecting: delete-rails before-snapshot selection = post-delete selection -> sameAcceptedPhysicalCommandSnapshot rejects the pre-delete proposed target
next_action: report ROOT CAUSE FOUND (diagnosis only, no fix)

## Symptoms

expected: Undo/redo restores a multi-rail set delete like a single-rail delete (one atomic command).
actual: Delete with a multi-rail set works, but undo/redo does NOT work with a multi-rail selection; works correctly with single-rail. Transient (non-reproducible): after multi-select delete+undo, all subsequent deletes became blocked until relaunch.
errors:
  - G-43.6-2: "Delete with multi-rail set works, undo/redo does not with multi-rail selection"
  - transient: "after multi-select delete + undo, ALL subsequent deletes (single and multi) became blocked until relaunch"
reproduction: multi-rail set selected -> Delete (works) -> Undo (fails to restore set)
started: Phase 43.6 multi-rail selection + batch Delete Rails (new in this phase)

## Eliminated
<!-- APPEND only -->

- hypothesis: "delete-rails undo fails because the batch kinds are still absent from the history allowlist (prior bug G-43.6-3/4/6/8)"
  evidence: commit e1259f92 added 'move-rails','spacing-on-set','delete-rails' to isOrdinaryOperationKind; the command now enters appliedRef. Undo still no-ops — so this is a NEW defect beyond the allowlist, in the parent-side replay-validation path.
  timestamp: 2026-08-19
- hypothesis: "undo never fires because a selection-collapse/interception gate swallows Cmd+Z for rail sets"
  evidence: keyboard routing (physicsPaintStudioKeyboard.ts:100-117) routes Cmd+Z to actions.undo() unconditionally when not mutationLocked; history undo() reaches the replay-proposal build for delete-rails (allowlist now passes). The gate that blocks is the parent-side snapshot-equality check, not shortcut routing.
  timestamp: 2026-08-19

## Evidence
<!-- APPEND only -->

- timestamp: 2026-08-19
  checked: useRotoPhysicalEditCoordinator.ts railSetDelete branch (1585-1608) and payload build (1868-1870)
  found: For railSetDelete the coordinator overwrites `targetSelectedKeyId = proposed.proposal.selectedKeyId` and `targetCursorAppFrame = proposed.proposal.cursorAppFrame` — these are the delete PROPOSAL's POST-delete selection/cursor, then shipped as `selectedKeyId`/`cursorAppFrame` in the payload.
  implication: The forward payload always carries the AFTER-delete selection for delete-rails.
- timestamp: 2026-08-19
  checked: physicPaintBridge.ts GROUP_LIFECYCLE_OPERATION_KINDS (1039-1047) and childBeforeAuthority record (1633-1652)
  found: 'delete-rails' is in GROUP_LIFECYCLE_OPERATION_KINDS; for these kinds childBeforeAuthority=true and `beforeSnapshot.selectedKeyId = payload.selectedKeyId` (the POST-delete selection), so the ledger's `before` snapshot is mislabeled.
  implication: The recorded undo target for delete-rails does not reflect the true pre-operation selection.
- timestamp: 2026-08-19
  checked: physicPaintBridge.ts undo replay validation (1583-1606) and useRotoPhysicalEditHistory.ts undo() submit (630, 622)
  found: Undo builds proposedTargetSnapshot from the child's PRE-op selection (entry.before.selectedKeyId = lastAcceptedSelectionRef) and validates against replayEntry.before (POST-op selection) via sameAcceptedPhysicalCommandSnapshot (266-271). Mismatch -> reject "Roto physical replay target snapshot does not match the original accepted command" -> undo silently no-ops.
  implication: Direct root cause for G-43.6-2 multi-rail undo failure. Single-rail delete-key-rail is NOT in GROUP_LIFECYCLE_OPERATION_KINDS -> records true pre-op selection (1644-1649) -> matches -> undo works.
- timestamp: 2026-08-19
  checked: tests (history test 1723-1985 mocks coordinator; coordinator test 254-257 mocks transport; bridge test 3183-3532 uses selectedKeyId=null fixtures)
  found: No test drives a real delete-rails forward with a non-null post-delete selection followed by real undo replay through the actual ledger. Gap not caught.
  implication: Why automated gates missed it.
- timestamp: 2026-08-19
  checked: useRotoPhysicalEditCoordinator.ts releasePhysicalEditRecoveryLease (1260-1264) and physicPaintStore.ts isRotoPhysicalOperationAvailable (1480-1485), PhysicsPaintStudio.tsx mutationLocked (627-642)
  found: releasePhysicalEditRecoveryLease has NO production caller (only a test). Any recovery-lease transfer (finalizeFailed 1194-1202/1208-1216, or settlement 'cleanup-pending') leaves a lease in _rotoPhysicalOperationLeases forever -> availability false -> mutationLocked true -> all deletes blocked; executePhysicalEdit early-returns (coordinator 1273-1276).
  implication: Candidate mechanism for the transient "all deletes blocked until relaunch" (module-level lease map cleared on relaunch).

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Parent-side undo/redo asymmetry. For delete-rails (in GROUP_LIFECYCLE_OPERATION_KINDS), the bridge records the accepted command's `before` snapshot selection/cursor from the FORWARD payload — but the coordinator overwrites `targetSelectedKeyId`/`targetCursorAppFrame` with the delete proposal's POST-delete selection (useRotoPhysicalEditCoordinator.ts:1585-1608,1868-1870), and childBeforeAuthority copies those into `beforeSnapshot` (physicPaintBridge.ts:1636-1652). On undo, the history hook submits the child's PRE-delete selection (useRotoPhysicalEditHistory.ts:630); the bridge's replay-target check (physicPaintBridge.ts:1583-1606) compares it to the recorded (post-delete) `before` and rejects with a snapshot mismatch — undo becomes a silent no-op. Single-rail delete-key-rail is outside GROUP_LIFECYCLE_OPERATION_KINDS, records the true pre-op selection, and undoes correctly. Transient: releasePhysicalEditRecoveryLease has no production caller, so any recovery-lease transfer permanently sets isRotoPhysicalOperationAvailable=false -> mutationLocked=true -> all deletes blocked until relaunch.
fix: (not applied — read-only diagnosis) Record delete-rails' true pre-operation selection/cursor in the ledger (e.g. exclude the selection fields from childBeforeAuthority for delete-rails, or stop overwriting targetSelectedKeyId with the post-delete proposal values), so replayEntry.before matches what undo submits; and wire a real caller for releasePhysicalEditRecoveryLease (or clear the recovery lease on successful settlement).
verification: (not applied)
files_changed: []
