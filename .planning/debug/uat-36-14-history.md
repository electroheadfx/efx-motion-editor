---
status: diagnosed
trigger: "Diagnose only the shared root cause(s) behind Phase 36.14 UAT gaps G-36.14-2, G-36.14-3, the history/count portion of G-36.14-5, G-36.14-6, G-36.14-7, G-36.14-8, G-36.14-9, and G-36.14-10. Symptoms: Insert/Delete/Drag/Force Spacing/Duplicate/Paste accepted actions do not provide exact multi-level Undo/Redo; Paste Undo sometimes works only one level; Redo does not work; controls displayed Undo 21 / Redo 0; rejected actions should add no history. Inspect the current working tree, including uncommitted production fixes. Preserve accepted-only parent/coordinator authority and complete physical snapshots. Do not modify production code or tests. Do not run tests, typecheck, build, server, browser, or native app. You may write only `.planning/debug/uat-36-14-history.md`. Read `.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-UAT.md` and relevant code. Report exact root cause(s), evidence with file:line references, files involved, and minimal fix direction."
created: 2026-07-23T20:59:11Z
updated: 2026-07-23T21:35:00Z
---

## Current Focus

bug_class: bohrbug
hypothesis: Confirmed two independent code defects in the requested symptom set: the committed coordinator used render-local signal() identities while stable callbacks mutated earlier identities, so history missed accepted ordinary/replay settlement; separately, successful replay stages only records/interpolation/selection and cannot restore the immutable target snapshot's child-owned buffers, caches, reference, confirmed frames, or engine state.
test: Static working-backwards comparison of UAT symptoms, coordinator publication, history stack transition, replay input, snapshot schema, ownership rebuilding, parent provenance, and the locked Plan 36.14-05 contract.
expecting: A missed accepted output must leave the original command on applied and redo empty after a parent-accepted Undo; an incomplete replay target must omit categories present in the command snapshot and fail to reconstruct identity-owned state that no longer exists in the current source.
next_action: Return diagnose-only root cause with exact file:line evidence and minimal fix direction; no production/test changes or runtime commands.
reasoning_checkpoint:
  hypothesis: "The committed per-render Signal identity split causes accepted-output settlement to be missed, which prevents both command recording and accepted Undo/Redo cursor movement; independently, replaying only records/interpolation leaves complete child snapshot state unrestored."
  confirming_evidence:
    - "The Git diff replaces signal() with useSignal() at useRotoPhysicalEditCoordinator.ts:276-279; stable callbacks mutate those captured Signals at lines 291-300, 360-400, and 490-662 while returned computed outputs are recreated at lines 673-676."
    - "History moves a replay command only after its acceptedOutput effect runs (useRotoPhysicalEditHistory.ts:233-297); Undo/Redo merely set pendingReplayRef and dispatch at lines 341-363 and 397-419."
    - "Replay input contains only replayRecords/replayInterpolation/provenance (rotoCoordinatorPorts.ts:318-326), and successful staging applies only records/selection/launch metadata (useRotoPhysicalEditCoordinator.ts:559-630), despite snapshots carrying buffers/reference/engine state at rotoCoordinatorPorts.ts:108-128."
    - "Identity ownership rebuilding derives output only from the current source maps and drops identities absent from that source (rotoPhysicalOwnership.ts:63-79, 107-160), so it cannot recreate deleted identity-owned state from a stored earlier snapshot that was never applied."
  falsification_test: "Root cause 1 would be false if the same Signal identity were proven to feed both stable settlement callbacks and the history effect across rerenders; root cause 2 would be false if every target snapshot category were applied directly or were losslessly reconstructible from the post-edit state. The static call paths show neither in committed HEAD/current replay code."
  fix_rationale: "Stable useSignal identities reconnect accepted publication to history; applying the stored child target snapshot during replay restores exact state while leaving the parent ledger responsible only for canonical records/interpolation/provenance and deferring cursor movement until parent acceptance."
  blind_spots: "No runtime reproduction, test, typecheck, build, server, browser, or native verification was permitted. The existing uncommitted useSignal correction is therefore statically matched to the first mechanism but not executed."
  candidate_causes:
    - "code: render-local coordinator Signals disconnect history from accepted settlement"
    - "code: replay contract stages only parent-authoritative records/interpolation instead of the complete child target snapshot"
    - "data: identity-set-changing commands expose the second defect because deleted/new identities cannot be reconstructed from current child maps"
    - "environment/config: no matching dependency, platform, feature-flag, or configuration cause was found; the failure follows deterministic in-process ownership paths"
  and_gate: "no — the Signal lifecycle defect independently explains missing cursor/count transitions, while incomplete snapshot replay independently violates exact restoration once a replay is allowed; they are parallel root causes for the requested gap set, not simultaneous prerequisites for one failure."

## Symptoms

expected: Every accepted Insert/Delete/Drag/Force Spacing/Duplicate/Paste operation records one complete physical before/after snapshot; Undo and Redo restore exact maps, identity-owned payloads, selection, caches, revision, and related state across multiple levels; rejected actions record nothing; UI counts represent available physical Undo/Redo commands.
actual: Accepted physical actions do not provide exact multi-level Undo/Redo; Paste Undo sometimes works for only one level; Redo does not work; controls displayed Undo 21 / Redo 0; rejected actions must remain history-free.
errors: Interpolation-enabled Duplicate/Paste can be rejected with "Roto physical revision became stale before commit", but this diagnosis is limited to the shared history/count failure across accepted actions.
reproduction: Phase 36.14 UAT tests 2, 3, history/count portion of 5, 6, 7, 8, 9, and 10; perform multiple accepted physical edits, then inspect counts and execute repeated Undo/Redo.
started: Observed during Phase 36.14 native UAT on 2026-07-23; current working tree includes uncommitted production fixes that must be included in diagnosis.

## Eliminated

- hypothesis: Rejected physical actions are being appended as history commands.
  evidence: useRotoPhysicalEditHistory records ordinary commands only from coordinator acceptedOutput at useRotoPhysicalEditHistory.ts:233-284; coordinator failures set acceptedSignal to null at useRotoPhysicalEditCoordinator.ts:403-431. No rejection-to-history append path exists.
  timestamp: 2026-07-23T21:35:00Z

- hypothesis: The parent ledger must own child engine/cache/edit-buffer snapshots for exact Undo/Redo.
  evidence: Plan 36.14-05 explicitly assigns child snapshot staging to the coordinator and states the parent ledger does not retain child-only categories at 36.14-05-PLAN.md:117-119, 175-180. physicPaintBridge.ts:99-107 correctly stores only canonical parent records/interpolation/revision provenance.
  timestamp: 2026-07-23T21:35:00Z

- hypothesis: The visible Undo 21 badge proves 21 physical or rejected commands were recorded.
  evidence: Availability is appliedRef/redoRef length at useRotoPhysicalEditHistory.ts:193-198, and those arrays intentionally contain both physical commands and paint barriers added/reconciled at lines 200-231. PhysicsPaintToolRail.tsx:96-100,146 displays that raw combined value.
  timestamp: 2026-07-23T21:35:00Z

- hypothesis: Each action resolver independently causes the shared history failure.
  evidence: UAT shows Insert/Delete/Force Spacing/Duplicate/Paste mutations can succeed while the same downstream Undo/Redo behavior fails, and all ordinary kinds converge on one coordinator acceptedOutput and one history hook.
  timestamp: 2026-07-23T21:35:00Z

## Evidence

- timestamp: 2026-07-23T20:59:11Z
  checked: Phase 36.14 UAT report
  found: Insert/Delete and other physical mutations can succeed while Undo/Redo remains broken; Paste sometimes exposes only one Undo level; UI showed Undo 21 / Redo 0; rejected Duplicate/Paste behavior itself remained atomic.
  implication: The shared failure is downstream of mutation semantics and likely lies in history ownership, snapshot routing, stack mutation, or availability reporting rather than in each physical action algorithm.

- timestamp: 2026-07-23T20:59:11Z
  checked: Investigation constraints
  found: User explicitly prohibited tests, typecheck, build, server, browser, and native execution.
  implication: No agent-runnable red loop may be created or executed; diagnosis must use existing native UAT evidence plus static call-path and working-tree analysis.

- timestamp: 2026-07-23T21:04:00Z
  checked: Debug knowledge base
  found: No prior entry matches physical command history, multi-level Undo/Redo, or history count divergence.
  implication: There is no known-pattern shortcut; the current accepted-command and count paths must be traced directly.

- timestamp: 2026-07-23T21:04:00Z
  checked: Symbol inventory in current working tree
  found: Physical commands use a dedicated useRotoPhysicalEditHistory hook and bridge replay ledger, while PhysicsPaintStudio also owns a separate historyAvailability signal displayed by PhysicsPaintToolRail.
  implication: A dual-channel history/count mismatch is a concrete candidate, distinct from per-action ripple algorithms.

- timestamp: 2026-07-23T21:10:00Z
  checked: Current diff and coordinator Signal lifecycle
  found: HEAD used signal() inside useRotoPhysicalEditCoordinator on every render; the uncommitted production diff changes presentation, accepted, failure, and pending Signals to useSignal(). Stable useCallback closures mutate their captured Signal instances, while each render previously returned computed wrappers over newly created Signal instances.
  implication: State updates that rerender the Studio during an operation can make useRotoPhysicalEditHistory read a different acceptedOutput than the one finalized by the coordinator. Ordinary acceptances are missed; replay acceptances do not move commands between applied/redo stacks. The uncommitted useSignal change directly targets this lifecycle break.

- timestamp: 2026-07-23T21:10:00Z
  checked: History transition logic
  found: Undo/Redo return true once executePhysicalEdit sends/stages the replay, but stack movement occurs only later when recordAcceptedEdit observes matching acceptedOutput provenance. If that acceptance is missed, Undo changes the parent map while leaving the command on applied; redo stays empty and the next Undo fails the current-revision guard.
  implication: This mechanism exactly explains one visible Undo, Redo 0, and no further Undo without requiring rejected actions to enter history.

- timestamp: 2026-07-23T21:10:00Z
  checked: Toolbar count path
  found: The visible badges display appliedRef/redoRef lengths, which intentionally interleave physical commands and engine paint barriers. Engine availability events reconcile paint barriers into the same stacks.
  implication: Undo 21 is not a parent physical-command count; it is the combined local ledger, and under missed physical settlement it is not trustworthy as evidence of available exact physical commands.

- timestamp: 2026-07-23T21:35:00Z
  checked: Current working-tree diff for coordinator Signals
  found: The uncommitted production diff changes the import from signal to useSignal at useRotoPhysicalEditCoordinator.ts:41 and replaces all four render-local signal() allocations with useSignal() at lines 276-279. The same diff leaves the history replay shape unchanged.
  implication: The current working tree already contains a targeted correction for the accepted-output/pending Signal lifecycle root cause, but the complete-snapshot replay defect remains present and neither correction was runtime-verified under this diagnosis's constraints.

- timestamp: 2026-07-23T21:35:00Z
  checked: Accepted publication and deferred replay cursor transition
  found: Coordinator acceptance publishes acceptedSignal at useRotoPhysicalEditCoordinator.ts:360-400. History subscribes at useRotoPhysicalEditHistory.ts:286-297 and moves commands only in recordAcceptedEdit at lines 240-265. Undo/Redo set pendingReplayRef and return after dispatch at lines 341-363 and 397-419 without changing stacks.
  implication: Missing one replay acceptance deterministically leaves the command on applied, leaves redo at zero, and makes the next Undo fail the current-revision guard at lines 336-340 because the parent/store is already at the command's before state.

- timestamp: 2026-07-23T21:35:00Z
  checked: Signal identity across coordinator rerenders
  found: In committed HEAD, signal() ran inside useRotoPhysicalEditCoordinator on every render. Stable useCallback closures such as clearPendingOnce and finalizeAccepted retained earlier Signal objects, while computed outputs were recreated at useRotoPhysicalEditCoordinator.ts:673-676. Pending status publication at lines 632-635 calls Studio setters and can rerender before settlement.
  implication: The history effect could remain subscribed to the earlier accepted Signal, wake when that Signal changed, then read inputRef.current.coordinator.acceptedOutput from the latest render's different still-null Signal. This disconnect explains missed ordinary recording and missed Undo/Redo settlement across all operation kinds.

- timestamp: 2026-07-23T21:35:00Z
  checked: Complete snapshot schema versus successful replay input and staging
  found: RotoPhysicalEditSnapshot includes dirty/editable/live-overlay/frame/preview/captured/reference/engine categories at rotoCoordinatorPorts.ts:108-128, but RotoPhysicalEditExecuteInput exposes only replayRecords, replayInterpolation, and provenance at lines 318-326. History passes only those fields plus selection at useRotoPhysicalEditHistory.ts:342-358 and 398-414. Successful coordinator replay applies records, selection, and launch metadata at useRotoPhysicalEditCoordinator.ts:559-630; restoreSnapshot applies broader categories only on failure/cleanup at lines 336-355, 403-433, and 665-671.
  implication: Even after cursor settlement is repaired, accepted Undo/Redo cannot meet the locked exact complete-snapshot contract because successful replay never stages the immutable target's child-owned state.

- timestamp: 2026-07-23T21:35:00Z
  checked: Identity-owned state reconstruction and confirmed-frame coverage
  found: rebuildRotoPhysicalOwnership remaps only entries present in the current source maps and skips identities absent from the target at rotoPhysicalOwnership.ts:63-79, 107-160. The ownership snapshot includes confirmedFrames at lines 15-24 and Studio routes it at PhysicsPaintStudio.tsx:316-346, but RotoPhysicalEditSnapshot and RotoPhysicalEditBufferPort omit confirmedFrames at rotoCoordinatorPorts.ts:108-128 and 192-205.
  implication: Undo Delete or Redo Insert/Duplicate/Paste can restore a real-key record/payload through parent-authorized replay but cannot recreate identity-owned buffers/caches/confirmed frames that disappeared from the current child state. Rollback also lacks an exact confirmed-frame restore path.

- timestamp: 2026-07-23T21:35:00Z
  checked: Locked Phase 36.14-05 history design
  found: The plan requires the coordinator to stage the stored target snapshot and only transition stacks after matching acceptance at 36.14-05-PLAN.md:135-145; Task 2 explicitly requires staging every child-owned category from the immutable target snapshot at lines 173-181.
  implication: The incomplete successful replay is an implementation defect against the accepted design, not a new architectural requirement or a reason to move child state into the parent ledger.

- timestamp: 2026-07-23T21:35:00Z
  checked: Parent replay authority
  found: physicPaintBridge.ts:448-465 validates command ID, direction, current source revision, and target revision before mutation; lines 484-501 record ordinary accepted canonical before/after records and interpolation. Replay acceptances are not recorded as new commands.
  implication: Accepted-only parent authority and rejected-history neutrality are already structurally correct and should be preserved; the defects are the child publication/subscription lifecycle and child replay completeness.

## Resolution

root_cause: "1) Committed HEAD created coordinator Signals with signal() inside the hook on every render, while stable callbacks mutated Signals captured by earlier renders and history read the latest render's computed acceptedOutput/pending handles. Rerenders during pending status split publication from observation, so accepted ordinary edits were not reliably recorded and accepted Undo/Redo replays did not move their command between applied/redo stacks. 2) The child history command stores a nominally complete before/after snapshot, but successful replay transports and stages only records, interpolation, selection, and provenance. It rebuilds child ownership from the current post-edit state instead of applying the immutable target snapshot, omits confirmedFrames from the coordinator snapshot/ports, and never restores target buffers/caches/reference/engine state on successful replay. Exact identity-changing Undo/Redo therefore remains impossible even after cursor settlement is fixed."
fix: "Retain the uncommitted signal() -> useSignal() correction so coordinator callbacks and history observe stable per-component Signal identities. Preserve the existing parent ledger as accepted-command provenance only. Extend the child replay execute contract to receive/select the immutable complete target snapshot; after capturing the current state for rollback, stage the target's frame states, preview/captured/confirmed frames, dirty/editable/live-overlay state, cached reference, selection/current frame, and engine state directly, while sending only canonical parent-owned records/interpolation/selection/provenance across the bridge. Add confirmedFrames to the coordinator snapshot and buffer restore ports. Keep the physical command on its current stack until exact parent acceptance, keep rejected/failed operations history-neutral, and publish the existing combined physical-plus-paint availability only after the corresponding accepted transition."
verification: "Static diagnosis only. Native UAT is the observed failing oracle. No production/test modifications and no tests, typecheck, build, server, browser, or native execution were permitted. The existing uncommitted useSignal correction statically addresses root cause 1; root cause 2 remains in the current working tree."
files_changed: []
