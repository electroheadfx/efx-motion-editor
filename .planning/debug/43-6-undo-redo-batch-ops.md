---
status: diagnosed
trigger: "GSD debug: Cmd+Z / Cmd+Shift+Z Undo/Redo do NOT work for the new Phase 43.6 batch rail operations (Delete Rails, Move Rails, Key Spacing on grouped rails). Shortcuts work in other sections."
goal: find_root_cause_only
created: 2026-08-19T00:00:00.000Z
updated: 2026-08-19T00:00:00.000Z
---

## Current Focus

hypothesis: CONFIRMED — the Phase 43.6 batch operation kinds ('move-rails', 'spacing-on-set', 'delete-rails') are missing from isOrdinaryOperationKind in useRotoPhysicalEditHistory.ts, so their accepted coordinator outputs are dropped as if they were unmatched replay acceptances and never enter the applied undo stack.
test: traced keyboard routing (Cmd+Z -> actions.undo -> rotoMoveHistory.undo), coordinator acceptedOutput wiring, and the history allowlist
expecting: batch kinds absent from allowlist -> recordAcceptedEdit takes the replay branch with no pendingReplay -> returns without appending
next_action: report ROOT CAUSE FOUND

## Symptoms

expected: Cmd+Z / Cmd+Shift+Z undo/redo the Phase 43.6 batch operations (Delete Rails, Move Rails, Key Spacing on set), restoring exact pre-operation document AND selection set state
actual: Cmd+Z / Cmd+Shift+Z do nothing for batch operations on a multi-rail set
errors:
  - G-43.6-3 (Delete Rails): "only the last rail is deleted, and the undo/redo no work"
  - G-43.6-4 (Move Rails): "work but undo/redo no work"
  - G-43.6-6 (Key Spacing grouped rails): "undo/redo no work with grouping rails"
  - G-43.6-8 (Shortcut parity): "Cmd+Z/Cmd+Shift+Z no work with multi-rails"
reproduction: Select a multi-rail set, run batch Delete Rails / Move Rails / Key Spacing, then press Cmd+Z or Cmd+Shift+Z
started: Phase 43.6 batch operations (new in this phase)

## Eliminated

- hypothesis: "Cmd+Z never reaches the undo handler when a rail set is active (shortcut guard / selection-collapse interception)"
  evidence: physicsPaintStudioKeyboard.ts lines 100-117 route Cmd+Z/Cmd+Shift+Z to actions.undo()/actions.redo() unconditionally when not mutationLocked; no rail-set gate exists. The keyboard handler was NOT modified for 43.6.
  timestamp: 2026-08-19
- hypothesis: "The batch operations use a dispatch path that bypasses the coordinator/history acceptedOutput signal"
  evidence: commitRailSetMove (useRotoTimelineActions.ts:2830) and applyForceSpacing spacing-on-set branch (:2941) both call input.executePhysicalEdit; railSetDeleteExecuteRef (PhysicsPaintStudio.tsx:978) calls physicalEditCoordinator.executePhysicalEdit. All three reach the coordinator executePhysicalEdit -> finalizeAccepted -> acceptedSignal, which useRotoPhysicalEditHistory subscribes to (Studio:1696-1700).
  timestamp: 2026-08-19
- hypothesis: "The D-06 rail-set snapshot side-channel is mis-keyed, so undo/redo cannot restore the selection set"
  evidence: recordRailSetSnapshot is keyed by accepted.operationId before dispatch and undo/redo lookups use accepted.historyProvenance?.historyCommandId ?? accepted.operationId (PhysicsPaintStudio.tsx:1842-1853, physicsPaintRotoRailSetSelection.ts:299-315). This is correct but dead — it is only consumed after a history command exists, and none is ever recorded for batch ops.
  timestamp: 2026-08-19

## Evidence

- timestamp: 2026-08-19
  checked: useRotoPhysicalEditHistory.ts isOrdinaryOperationKind (lines 196-224)
  found: The history allowlist contains insert-slot/delete-key/delete-key-group/move-key/move-key-group/move-group/force-spacing/duplicate-key/paste-key/paste-key-group/insert-empty-segment/delete-key-rail/scissor-key-rail/move-key-rail/push-rails/play-script/paint-group-frame/delete-group-frame/delete-group/regenerate-group/detach-action-groups/delete-action-groups. The 43.6 batch kinds 'move-rails', 'spacing-on-set', 'delete-rails' are ABSENT.
  implication: recordAcceptedEdit treats batch acceptances as replay acceptances (isOrdinaryOperationKind=false); with pendingReplayRef.current===null it returns without appending — the batch command never enters appliedRef.
- timestamp: 2026-08-19
  checked: useRotoPhysicalEditHistory.ts recordAcceptedEdit (lines 480-532) and undo/redo (581-702)
  found: Accepted non-ordinary kinds fall into the 'Replay acceptance' branch; if no pendingReplay exists the output is silently dropped. undo() peeks appliedRef top — batch command never there, so Cmd+Z no-ops (or undoes an unrelated prior entry).
  implication: Direct root cause for G-43.6-4/6/8 and the undo/redo half of G-43.6-3.
- timestamp: 2026-08-19
  checked: git log for useRotoPhysicalEditHistory.ts
  found: 8751a903 feat(43.5-03) "implement commitRotoPush and record push in the history allowlist"; daee2df5 fix(43.4-08) "record Key Rail edits in physical history". No 43.6 commit touched the allowlist.
  implication: Pattern confirmed — each new rail-operation kind must be added to the allowlist; 43.6 batch kinds were wired into coordinator/resolver/transport but the allowlist step was forgotten.
- timestamp: 2026-08-19
  checked: tests — useRotoPhysicalEditHistory.test.ts has move-key-rail and push-rails allowlist tests; coordinator test covers delete-rails transport only
  found: No test asserts that a batch acceptance (move-rails/spacing-on-set/delete-rails) is recorded as an undoable history command.
  implication: Automated A16/A22/A27 D-06 tests verified the snapshot resolver in isolation, never the end-to-end history recording — why the gap was not caught.
- timestamp: 2026-08-19
  checked: physicsPaintRotoGroupLifecycle.ts proposePhysicPaintRotoDeleteRails (897-945+) and useRotoTimelineActions.ts deleteRotoFrame rail-set branch (1848-1870)
  found: The delete-rails proposer validates every member (all-or-nothing) and composes deletions over the whole set; dispatch calls executeRailSetDelete directly.
  implication: "only the last rail is deleted" (G-43.6-3) is a SEPARATE selection-collapse/classifier defect (related to the member-loss reported in G-43.6-4), NOT this undo/redo root cause.

## Resolution

root_cause: The Phase 43.6 batch operation kinds 'move-rails', 'spacing-on-set', and 'delete-rails' were never added to isOrdinaryOperationKind in useRotoPhysicalEditHistory.ts. When the coordinator's acceptedOutput fires for a batch acceptance, recordAcceptedEdit falls through to the 'replay acceptance' branch (these kinds are not ordinary), finds no pendingReplayRef, and silently drops the command — so the batch edit never enters the applied undo stack. Cmd+Z/Cmd+Shift+Z therefore have nothing to replay for batch operations, while the same shortcuts keep working for single-rail kinds (move-key-rail, push-rails, delete-key, etc.) that ARE in the allowlist. The D-06 rail-set snapshot side-channel is correctly wired but dead because no history command ever exists to consume it.
fix: (not applied — read-only diagnosis) Add 'move-rails', 'spacing-on-set', 'delete-rails' to isOrdinaryOperationKind in app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts, following the 8751a903 push-rails precedent; add a regression test asserting one batch acceptance -> one applied command -> undo/redo replay.
verification: (not applied)
files_changed: []


## Symptoms

expected: Cmd+Z / Cmd+Shift+Z undo/redo the Phase 43.6 batch operations (Delete Rails, Move Rails, Key Spacing on set), restoring exact pre-operation document AND selection set state
actual: Cmd+Z / Cmd+Shift+Z do nothing for batch operations on a multi-rail set
errors:
  - G-43.6-3 (Delete Rails): "only the last rail is deleted, and the undo/redo no work"
  - G-43.6-4 (Move Rails): "work but undo/redo no work"
  - G-43.6-6 (Key Spacing grouped rails): "undo/redo no work with grouping rails"
  - G-43.6-8 (Shortcut parity): "Cmd+Z/Cmd+Shift+Z no work with multi-rails"
reproduction: Select a multi-rail set, run batch Delete Rails / Move Rails / Key Spacing, then press Cmd+Z or Cmd+Shift+Z
started: Phase 43.6 batch operations (new in this phase)
