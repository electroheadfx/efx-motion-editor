---
phase: quick/260820-lwd-regression-single-rail-drag-drop-no-long
plan: quick-260820-lwd
subsystem: ui
tags: [roto, physics, rail-set, drag, drop, selection, regression, preact, signals]

# Dependency graph
requires:
  - phase: 43.6
    provides: rail-set selection + batch set-drag session (railSetSelection, railSetDragApi, railSetMoveMembers explicit set), the D-08 pointer-down routing contract, and the orange set-of-one paint
  - phase: quick/260820-bjw
    provides: effectiveRailSetMembers — the set-of-one dynamic-scope classifier fed to the rails as railSetMemberKeyRailIds/railSetMemberLoopIds; the regression the UAT-1 fix introduced (single-rail drag routed to the batch session with an empty railSetMoveMembers)
provides:
  - Drag-routing membership split: railSetMoveMemberKeyRailIds / railSetMoveMemberLoopIds derived from the explicit railSetMoveMembers at the strip, passed to both rail hosts
  - Restored native 43.3/43.4 single-rail drag (ghost, clamp, break travel, no-space rejection, atomic command, Undo/Redo) for a plain-selected single Key Rail and single Motion/Static Rail
  - Regression-lock source contract at the strip proving the derivation and prop threading
affects: paint/roto timeline UAT, 43.6 extensions, bjw single-rail Copy/Duplicate scope (unchanged)

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 6700     # chars/4 over the realized diff (26677 chars across RED+GREEN+lock)
  tasks: 3         # Task 1 RED tests + Task 2 implementation + Task 3 regression lock
  commits: 3       # 05fca44b (test) + f2424b43 (fix) + ebae0827 (test)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split membership concerns at the view boundary: paint/overlay membership (set-of-one classifier) stays on railSetMemberKeyRailIds/railSetMemberLoopIds; drag-routing membership (explicit, actually-movable set) is derived fresh from railSetMoveMembers as railSetMoveMemberKeyRailIds/railSetMoveMemberLoopIds and gates the batch-session pointer-down hand-off"
    - "A plain-selected single rail is a paint member but NOT a move member: it keeps its own 43.3/43.4 drag while still painting the set-of-one orange line and set tooltip sentence"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx
    - app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx
    - app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx
    - app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts

key-decisions:
  - "Split the two membership concerns railSetMemberKeyRailIds/railSetMemberLoopIds conflated: paint/overlay membership (effectiveRailSetMembers, set-of-one) vs drag-routing membership (railSetMoveMembers, explicit-only). Only move members hand pointer-down + trailing-click suppression to the batch session"
  - "No Studio change needed — railSetMoveMembers already flows Studio → strip (PhysicsPaintStudio.tsx:2768 → PhysicsPaintWorkflowStrip.tsx:1086); the split is derived at the strip with useMemo, leaving deriveEffectiveRailSetMembers, the batch session, the resolver, history, and persistence untouched"

patterns-established:
  - "One classifier per concern at the view boundary: the parent passes paint membership and move membership separately so a rail's gesture routing never depends on its selection-scope classifier"

requirements-completed: []
coverage:
  - id: D1
    description: "RED 1 — a plain-selected single Key Rail (set-of-one paint member, NOT a move member) runs its OWN native drag: drag.onPointerDown is invoked, onRailSetDragPointerDown is NOT"
    requirement: ""
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx#single rail (set-of-one paint member) runs its own drag"
        status: pass
    human_judgment: false
  - id: D2
    description: "RED 2 — a plain-selected single Motion/Static Rail (set-of-one) runs its OWN Group drag; batch pointer-down is NOT taken"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx#set-of-one paint member runs its own Group drag"
        status: pass
    human_judgment: false
  - id: D3
    description: "RED 3 — explicit move members still route to the batch session: KeyRail onRailSetDragPointerDown routing + non-member own drag; LoopClipRail batch routing + registerClickSequenceCanceller 250ms-timer cancellation preserved"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx#explicit move members route to the batch session"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx#move member routes to the batch session and the canceller survives"
        status: pass
    human_judgment: false
  - id: D4
    description: "RED 4 — with an active move set, a rail NOT in the move list runs its own single-rail drag (collapse is click-time); pinned as no-regression"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx#non-member (unselected) runs its own drag with a move set active"
        status: pass
    human_judgment: false
  - id: D5
    description: "Regression lock — the strip derives railSetMoveMemberKeyRailIds / railSetMoveMemberLoopIds from railSetMoveMembers and passes them to BOTH rail hosts; the bjw set-of-one paint membership railSetMemberKeyRailIds/railSetMemberLoopIds stays fed from effectiveRailSetMembers"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts#single-rail drag-routing split (quick 260820-lwd)"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-20
status: complete
---

# Quick 260820-lwd: Fix single-rail drag'n'drop regression (multi-rail set routing) Summary

**Restores the native 43.3/43.4 single-rail drag for a plain-selected single rail in the multi-rail Timeline by splitting paint/overlay membership from drag-routing membership — the batch set-drag session only owns explicitly-movable set members; a plain-selected single rail keeps its own ghost + clamp + break travel + no-space rejection + atomic Undo/Redo**

## Performance

- **Duration:** 3 min (tracked commits 15:54:05 → 15:56:50 +0200; RED test authoring happened in the prior session)
- **Started:** 2026-08-20 15:54:05 +0200 (05fca44b)
- **Completed:** 2026-08-20 15:56:50 +0200 (ebae0827)
- **Tasks:** 3 (Task 1 RED tests, Task 2 implementation, Task 3 regression lock)
- **Files modified:** 6 (2 RED test files + 3 implementation files + 1 lock test file)

## Accomplishments
- Root cause (confirmed by tracing, not guessed): commit `eb9a3e1f` (260820-bjw UAT-1) switched the Studio's `railSetMemberKeyRailIds`/`railSetMemberLoopIds` from the explicit set to `effectiveRailSetMembers` (set-of-one classifier), so both rail hosts gated pointer-down on `isSetMember` and routed a plain-selected single rail to the batch set-drag session — whose `railSetMoveMembers` is empty (explicit-set-only) → inert drag.
- Split the two membership concerns: paint/overlay membership stays on `railSetMemberKeyRailIds`/`railSetMemberLoopIds` (fed from `effectiveRailSetMembers`, set-of-one Copy/Duplicate scope and orange paint unchanged); NEW drag-routing membership `railSetMoveMemberKeyRailIds`/`railSetMoveMemberLoopIds` is derived at the strip from `railSetMoveMembers` (the explicit, actually-movable members) with `useMemo` and passed to both rail hosts.
- Both rail components now compute `isMoveMember` (move membership) for the pointer-down hand-off (`isMoveMember && onRailSetDragPointerDown`) and the trailing-click suppression gate (`isMoveMember && onRailSetDragClickSuppressed`); `isSetMember` remains only for the orange selection paint, the set tooltip sentence, and the set size.
- A plain-selected single Key Rail / single Motion/Static Rail is a paint member but NOT a move member → it falls through to its own native 43.3/43.4 drag (ghost, clamp, collapse at click, no-space rejection, one atomic command, Undo/Redo).
- 2+ set drag still routes every member to the batch session (`prepareRailSetMove`); the unselected-rail gesture and Push are byte-identical.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED tests** — `05fca44b` (test: RED — single-rail drag routing split) — 4 RED tests written; RED 1-2 fail against HEAD as planned
2. **Task 2: Implementation** — `f2424b43` (fix: route single-rail drag to the native 43.3/43.4 path) — tests green (55 in the two view suites), `tsc --noEmit` clean
3. **Task 3: Regression lock** — `ebae0827` (test: lock single-rail drag routing regression) — full affected surface green (key-rail, loop-clip, rail-set-drag, key-rail-drag, timeline-actions, set-selection, set-copy + 3 view suites = 380 pass) + 270 additional strip/studio suites green

**Plan metadata:** skipped (docs artifacts not committed per user constraint — the orchestrator handles the docs commit)

## Files Created/Modified
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` - NEW `railSetMoveMemberKeyRailIds` / `railSetMoveMemberLoopIds` `useMemo` derivations after `railSetMoveMembers` (filter kind 'key-rail'→`firstKeyId`, 'loop'→`loopId`); passed to both rail hosts. Batch session ports untouched.
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx` — added `railSetMoveMemberKeyRailIds?: readonly string[]` to both prop interfaces; `isMoveMember` in the target; pointer-down and click-suppression gates switched from `isSetMember` to `isMoveMember`; `isSetMember` kept for paint + tooltip sentence.
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` — same split via `railSetMoveMemberLoopIds?: readonly string[]`; `isMoveMember` gates the pointer-down and click suppression.
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx` — RED 1 / RED 3 / RED 4 routing tests.
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx` — RED 2 own-Group-drag test; WR-01 batch-routing + canceller test moved to move-member scope.
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.test.ts` — source-contract lock proving the strip derivations and both prop threads.

## Decisions Made
- Split the two membership concerns: paint/overlay membership (`effectiveRailSetMembers`, set-of-one included) vs drag-routing membership (`railSetMoveMembers`, explicit-only). This is the plan's locked design decision, implemented exactly.
- No Studio change: `railSetMoveMembers` already flows Studio → strip; the view derivations live at the strip.
- `deriveEffectiveRailSetMembers`, the batch set-move session, the resolver, history, and persistence are untouched (out of scope).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- None during execution; RED 1-2 failed against the baseline as designed, GREEN flipped them, full regression stayed green.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- The split is fully automated-tested (RED + implementation + regression lock) — a plain-selected single rail reaches its native drag path; 2+ set drag, Push, and the unselected-rail gesture are pinned.
- Remaining is the native UI UAT step from the plan (single Key Rail drag → ghost + clamp + collapse; single Motion Rail drag; 2+ set drag; drag from an unselected rail with a set active), which stays with the user (no browser automation on this machine).

---

*Phase: quick/260820-lwd*
*Completed: 2026-08-20*

## Self-Check: PASSED
- SUMMARY.md exists at `.planning/quick/260820-lwd-regression-single-rail-drag-drop-no-long/260820-lwd-SUMMARY.md`
- Task 1 commit `05fca44b` present; Task 2 commit `f2424b43` present; Task 3 commit `ebae0827` present
- View test suite green: 173 passed across `PhysicsPaintKeyRail.test.tsx` (11), `PhysicsPaintLoopClipRail.test.tsx` (44), `PhysicsPaintWorkflowStrip.test.ts` (118)
