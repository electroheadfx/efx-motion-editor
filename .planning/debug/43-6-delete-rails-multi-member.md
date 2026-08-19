---
status: diagnosed
trigger: "GSD debug: Delete Rails on a multi-rail set only deletes the LAST rail instead of the whole set; Delete/Backspace does not route to Delete Rails when a set is active. (G-43.6-3 / G-43.6-8)"
goal: find_root_cause_only
symptoms_prefilled: true
created: 2026-08-19T00:00:00.000Z
updated: 2026-08-19T00:00:00.000Z
---

## Current Focus

hypothesis: CONFIRMED (shared with G-43.6-4) — the rail set holds only ONE member at Delete time. updatePhysicsPaintRotoRailSetSelection 'toggle' on a null set returns freezeRailSetSelection([target], target) without carrying over the existing plain single-rail selection, so a plain-click-then-Cmd+click flow yields a set of only the last Cmd+clicked rail. The delete chain (classifier -> dispatch -> coordinator -> proposer -> bridge) is correct and tested for genuine multi-member sets; it deletes exactly the members the set contains. Secondary Loop-Clip keyboard hazard: the 250ms single-click delay leaves the just-clicked rail not-yet-.selected, so Delete/Backspace within that window is blocked by the isPhysicsPaintRotoDeleteTarget gate.
test: traced the full delete chain (classifyRotoDeleteTarget rail-set branch, deleteRotoFrame, executeRailSetDelete, coordinator isRailSetDelete, proposer, bridge recompute) + set construction (handleSelectRotoKeyRail/LoopClip, updatePhysicsPaintRotoRailSetSelection) + keyboard gate (isPhysicsPaintRotoDeleteTarget) + Loop Clip single-click delay
expecting: pure chain handles ALL members (proven by passing 3-member tests); set reduction is the only way "only last rail deleted" occurs; keyboard gate has a 250ms race for Loop Clip rails
next_action: report ROOT CAUSE FOUND

## Symptoms

expected: With a multi-rail set active, pressing Delete/Backspace or the Delete control removes the ENTIRE set (every member) as one atomic command, leaving the intervals as intentional gaps.
actual: Only the last rail of the set is deleted. (Undo/redo on it fails — separate root cause, out of scope.)
errors:
  - G-43.6-3: "I multiple select rails, only the last rail is deleted, and the undo/redo no work"
  - G-43.6-8: "Delete/Backspace no work with multi-rails"
reproduction: Build a multi-rail set via Cmd+click, then press Delete/Backspace or the Delete control; only the last rail is deleted.
started: Phase 43.6 batch delete-rails (new in this phase)

## Eliminated

- hypothesis: "The delete classifier or dispatch drops all but the last member"
  evidence: classifyRotoDeleteTarget rail-set branch (useRotoTimelineActions.ts:652) runs FIRST and derives EVERY railSetMember via deriveRailSetDeleteMembers (:799); deleteRotoFrame rail-set branch (:1848) passes target.members (all) to executeRailSetDelete; useRotoTimelineActions.test.ts has a TRUE 3-member set test (loop + 2 key-rails) that passes and asserts all members dispatched.
  timestamp: 2026-08-19
- hypothesis: "The coordinator/proposer deletes only one member"
  evidence: useRotoPhysicalEditCoordinator.ts isRailSetDelete (:1296) validates non-empty members, stages proposePhysicPaintRotoDeleteRails({ document, members: railSetDeleteInput.members }) (:1585-1609) which composes deletions over EVERY member (physicsPaintRotoGroupLifecycle.ts:897). physicsPaintRotoGroupParity.test.ts proves mixed Key Rail + Motion + Static all removed.
  timestamp: 2026-08-19
- hypothesis: "The bridge recompute accepts a reduced (single-member) delta"
  evidence: physicPaintBridge.ts validateCanonicalGroupLifecycleEdit recomputes proposePhysicPaintRotoDeleteRails with delta.members and exact-matches stableSerialize(impact); it could only pass if the delta itself carried one member.
  timestamp: 2026-08-19

## Evidence

- timestamp: 2026-08-19
  checked: handleSelectRotoKeyRail (PhysicsPaintStudio.tsx:1296) + handleSelectRotoLoopClip (:1348) modifier-gesture branches
  found: Both route 'toggle'/'range'/'union' through updatePhysicsPaintRotoRailSetSelection(railSetSelection.peek(), orderedRailSetIdentities, target, gesture). A PLAIN click collapses the set to null and sets the single-rail signal (selectedRotoKeyRail / selectedLoopClipIds).
  implication: A plain-selected rail and the rail set are MUTUALLY EXCLUSIVE stores. When the user plain-clicks rail A (single selection) then Cmd+clicks rail B, the reducer receives selection=null.
- timestamp: 2026-08-19
  checked: updatePhysicsPaintRotoRailSetSelection 'toggle' branch (physicsPaintRotoRailSetSelection.ts:178-197)
  found: On selection===null it returns freezeRailSetSelection([target], target) — a FRESH one-member set. It never consults the pre-existing plain single-rail selection (selectedRotoKeyRail.value / selectedLoopClipIds) because those live in a different store and are not passed in.
  implication: ROOT MECHANISM (same as G-43.6-4): plain-select A, Cmd+click B -> set = [B] only; A is dropped from the set entirely.
- timestamp: 2026-08-19
  checked: getRailSetMembers port (PhysicsPaintStudio.tsx:1016) + readRotoDeleteTargetInput (useRotoTimelineActions.ts:3393-3410)
  found: Delete reads the LIVE set at activation: railSetMembers: input.getRailSetMembers?.() ?? [] = railSetSelection.value?.members ?? []. With set=[B], classifyRotoDeleteTarget returns rail-set with members=[B].
  implication: Delete then correctly deletes the ONE-member set -> "only the last rail is deleted" (A survives). The pure delete chain is exonerated; the set is wrong at Delete time.
- timestamp: 2026-08-19
  checked: keyboard gate isPhysicsPaintRotoDeleteTarget (physicsPaintStudioKeyboard.ts:54-88) + Loop Clip single-click delay (PhysicsPaintLoopClipRail.tsx:237-241)
  found: Gate requires focus on .physics-paint-roto-cell.current OR .physics-paint-key-rail-target.selected/.physics-paint-loop-clip-rail-target.selected OR a non-button fallback. Loop Clip rails update the set 250ms AFTER the click (single-click delay); set members only get .selected after that commit. PhysicsPaintKeyRail.tsx:337-338 and LoopClipRail.tsx:394-395 give set members the .selected class.
  implication: SECONDARY keyboard hazard — Cmd+click the last Loop Clip rail then press Delete within 250ms: focus is on a rail <button> that is not yet .selected -> gate returns false -> Delete/Backspace silently swallowed ("Delete/Backspace no work"). Key Rail set members (no delay) route fine.
- timestamp: 2026-08-19
  checked: undo/redo half of G-43.6-3/G-43.6-8
  found: Already diagnosed in .planning/debug/43-6-undo-redo-batch-ops.md — 'delete-rails' (plus 'move-rails'/'spacing-on-set') missing from isOrdinaryOperationKind in useRotoPhysicalEditHistory.ts.
  implication: Out of scope for this session; noted for the fix.

## Resolution

root_cause: The multi-rail set does not actually contain all the rails the user selected at Delete time. G-43.6-4 member-loss mechanism: updatePhysicsPaintRotoRailSetSelection 'toggle' on a null set returns freezeRailSetSelection([target], target) and never carries the pre-existing plain single-rail selection into the set. Because the plain-selected rail and the set are mutually exclusive stores (handleSelectRotoKeyRail/LoopClip plain click collapses the set; modifier gestures only read railSetSelection.peek()), the user flow "plain-click A, then Cmd+click B" produces a set of ONLY B. Delete then reads the live one-member set (getRailSetMembers) and correctly deletes just B — "only the last rail is deleted." The entire delete chain (classifier -> dispatch -> coordinator -> proposer -> bridge recompute) is correct and covered by passing 3-member deletion tests; it deletes exactly the members the set contains. Undo/redo failure is a separate diagnosed root cause (history allowlist). G-43.6-8 keyboard "no work" has a secondary contributing hazard: Loop Clip rails commit the set 250ms after the click (single-click delay), so Delete/Backspace pressed within that window targets a rail <button> that is not yet .selected and isPhysicsPaintRotoDeleteTarget blocks it.
fix: (not applied — read-only diagnosis) Fix the set-construction member carry-over: in handleSelectRotoKeyRail / handleSelectRotoLoopClip modifier branches, when railSetSelection.peek() is null but a plain single-rail selection exists, seed the set with that existing identity PLUS the toggled target (rather than letting the reducer start from null). This is the G-43.6-4 root cause and resolves both "only last rail deleted" and the set-size aspect of keyboard Delete. Optionally, for the Loop Clip 250ms keyboard race, commit the set membership synchronously on modifier clicks or exempt a pending-single-click rail from the .selected gate.
verification: (not applied)
files_changed: []
