# 260820-lwd — Fix single-rail drag'n'drop regression (multi-rail set routing)

**Type:** quick · **Status:** planned
**Source:** Native-confirmed regression report (single-rail drag inert; multi-rail set drag and Push work)

Restores the native single-rail drag for a plain-selected single rail in the multi-rail Timeline. A single rail must run its own dedicated 43.3/43.4 drag path (ghost, clamp, break travel, no-space rejection, atomic command, Undo/Redo). Multi-rail set drag (2+), Push, and the unselected-rail gesture must stay byte-identical.

## Root cause (confirmed by tracing, not guessed)

Commit `eb9a3e1f` (260820-bjw UAT-1 fix) switched the Studio's `railSetMemberLoopIds`/`railSetMemberKeyRailIds` props from `railSetSelection.value?.members` (the **explicit** multi-rail set) to `effectiveRailSetMembers` — the one-shared dynamic-scope classifier (`deriveEffectiveRailSetMembers`) that treats a plain-selected single rail as a **set of one** (43.6 Solo precedent).

Both rail components (`PhysicsPaintKeyRail.tsx:266`, `PhysicsPaintLoopClipRail.tsx:294`) gate pointer-down routing on `props.isSetMember && props.onRailSetDragPointerDown` (43.6-03 D-08: "a set member hands the pointer-down to the batch session"). `isSetMember` is derived from `railSetMemberKeyRailIds`/`railSetMemberLoopIds` (`PhysicsPaintKeyRail.tsx:339`, `PhysicsPaintLoopClipRail.tsx:409`). So:

1. A plain-selected single rail is now a "set member" → its pointer-down routes to the batch set-drag session (`railSetDragApi.onPointerDown`, wired at `PhysicsPaintWorkflowStrip.tsx:2731/2757`).
2. The batch session's `clampDelta`/`prepareAtDelta` read `railSetMoveMembersRef.current` (`PhysicsPaintWorkflowStrip.tsx:1573/1605`) — and `railSetMoveMembers` is still derived from the **explicit** set only (`PhysicsPaintStudio.tsx:680-694`, `effectiveRailSetSelection?.members ?? []`).
3. For a plain single selection `railSetSelection` is null → `railSetMoveMembers` is `[]` → clamp returns `{ delta: 0 }` and prepare rejects `'Rail set move unavailable.'` → the drag is **inert**.

Multi-rail set drag works because the explicit set is non-null → `railSetMoveMembers` is non-empty. Push is unrelated. The unselected-rail path is unaffected (`isSetMember` false → own drag), but needs a lock test.

## Contract (locked, must be preserved)

- A **plain-selected single Key Rail** and a **plain-selected single Motion/Static Rail** each run their own native drag: ghost + clamp to valid range + red blocked edge at hard limits, break travel with key identity preserved, `'No empty space in that direction.'` rejection, one atomic command, Undo/Redo round-trip (buttons AND Cmd+Z / Cmd+Shift+Z), selection and cursor stay put.
- **Multi-rail set drag (2+)** keeps routing to the batch session (`prepareRailSetMove`) unchanged.
- **Drag from an UNSELECTED rail** collapses the set at click time and performs its own single-rail drag (43.6 gesture contract) — unchanged.
- The 260820-bjw set-of-one overlay semantics are KEPT: a plain-selected single rail still paints the orange selection line, shows the set tooltip sentence, and routes Copy/Duplicate/Paste/Delete through the set scope (`effectiveRailSetMembers` stays the classifier for those concerns).

## Design decision (this plan locks the fix)

Split the two membership concerns that `railSetMemberKeyRailIds`/`railSetMemberLoopIds` currently conflate:

- **Paint / overlay membership** (`effectiveRailSetMembers`, set-of-one included) — unchanged. Keeps the bjw single-rail Copy/Duplicate scope and the orange rail paint.
- **Drag-routing membership** (NEW) — derived from `railSetMoveMembers` (the explicit, actually-movable members). Only rails in this list hand their pointer-down (and trailing-click suppression) to the batch session. A plain-selected single rail is a paint member but NOT a move member → it runs its own 43.3/43.4 drag.

No Studio change is needed: `railSetMoveMembers` already flows Studio → strip (`PhysicsPaintStudio.tsx:2768`, `PhysicsPaintWorkflowStrip.tsx:1086`).

## Where / why (file anchors)

- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` — `effectiveRailSetMembers` (lines 664-676, the set-of-one classifier), `railSetMoveMembers` explicit-only derivation (lines 680-694), `railSetMemberLoopIds`/`railSetMemberKeyRailIds` fed from `effectiveRailSetMembers` (lines 2734-2738). **No change here** (context anchor only).
- `app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx` — `railSetMoveMembers` (line 1086) is the source for the NEW `railSetMoveMemberKeyRailIds`/`railSetMoveMemberLoopIds` derivations; pass them to `PhysicsPaintKeyRail` (line 2716 area) and `PhysicsPaintLoopClipRail` (line 2745 area).
- `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx` — add `railSetMoveMemberKeyRailIds` prop (interfaces lines 58-97 / 116-136); gate the pointer-down (`props.isSetMember && props.onRailSetDragPointerDown`, line 266) and the click suppression (line 209) on the new move-member flag.
- `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx` — add `railSetMoveMemberLoopIds` prop (interfaces lines 40- 141); gate the pointer-down (line 294) and the click suppression (line 202) on the new move-member flag.

## Tests (RED first, per the contract)

Targets: `app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx` (D-08 test, lines 306-334), `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx` (batch-routing + canceller test, lines ~1056-1120).

Run: `pnpm --dir app vitest run app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx`

### RED 1 — single Key Rail (set-of-one paint member, NOT a move member) runs its OWN drag
Render with `railSetMemberKeyRailIds: ['A']` (the bjw set-of-one paint membership) and **no** `railSetMoveMemberKeyRailIds`. Pointer-down on rail A → assert `drag.onPointerDown` is called AND `onRailSetDragPointerDown` is NOT called. **RED against current HEAD** (A routes to the batch session).

### RED 2 — single Motion/Static Rail (set-of-one) runs its OWN drag
Render LoopClipRail with `railSetMemberLoopIds: ['loop-a']` and **no** `railSetMoveMemberLoopIds`. Pointer-down on the rail → assert the own `usePhysicsPaintGroupRailDrag.onPointerDown` is invoked, `onRailSetDragPointerDown` is NOT. **RED against current HEAD**.

### RED 3 — explicit move members still route to the batch session (2+ set stays green)
KeyRail: `railSetMoveMemberKeyRailIds: ['A']` (a genuine explicit set member) → pointer-down on A routes to `onRailSetDragPointerDown`, never the own drag; non-member C always runs its own drag. LoopClipRail: `railSetMoveMemberLoopIds: ['loop-a']` → batch routing + the `registerClickSequenceCanceller` 250ms-timer cancellation behavior preserved. These assertions flip against current HEAD because the gate is `isSetMember` today.

### RED 4 — drag from an UNSELECTED rail keeps its own single-rail drag (collapse is click-time)
With an active move set (`railSetMoveMemberKeyRailIds: ['A','C']`) render a rail NOT in the move list (e.g. segment D) → pointer-down on D runs its own drag, never the batch session. This path is already green today (D-08 non-member branch) and is pinned as a no-regression assertion.

RED 1-2 must fail against current HEAD; RED 3-4 pin the unchanged paths.

## Task 1 — RED tests (must fail before the fix)

Update the D-08 routing tests in `PhysicsPaintKeyRail.test.tsx` and `PhysicsPaintLoopClipRail.test.tsx` to the new split contract: add the `railSetMoveMemberKeyRailIds` / `railSetMoveMemberLoopIds` prop to the render calls, and assert RED 1-4. The trailing-click suppression assertion switches from `isSetMember` to move-member scope. Commit: `test(quick-260820-lwd): RED — single-rail drag routing split`.

## Task 2 — Implementation (tests green)

**2a. Strip** (`PhysicsPaintWorkflowStrip.tsx`) — after `railSetMoveMembers` (line 1086), derive with `useMemo`:
- `railSetMoveMemberKeyRailIds` = `railSetMoveMembers.filter(m => m.kind === 'key-rail').map(m => m.firstKeyId)`
- `railSetMoveMemberLoopIds` = `railSetMoveMembers.filter(m => m.kind === 'loop').map(m => m.loopId)`
Pass both to the two rail components at their render sites (lines ~2716 / ~2745). Do NOT change the batch session ports (lines 1568-1624).

**2b. `app/src/components/physic-paint/view/PhysicsPaintKeyRail.tsx`** — add `railSetMoveMemberKeyRailIds?: readonly string[]` to `PhysicsPaintKeyRailProps` and `PhysicsPaintKeyRailTargetProps`; thread it into `PhysicsPaintKeyRailTarget`. Compute `isMoveMember = props.railSetMoveMemberKeyRailIds?.includes(segment.firstKeyId) ?? false`. Change the pointer-down gate (line 266) and the click-suppression gate (line 209) from `props.isSetMember` to the move-member flag; keep `isSetMember` for the orange paint (`selected`, line 337) and the set tooltip sentence (line 194).

**2c. `app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.tsx`** — same split for loops: add `railSetMoveMemberLoopIds?: readonly string[]`, compute `isMoveMember = props.railSetMoveMemberLoopIds?.includes(range.loopId) ?? false`, gate the pointer-down (line 294) and click-suppression (line 202) on it; keep `isSetMember` for paint (line 407) and tooltip (line 151).

Commit: `fix(quick-260820-lwd): route single-rail drag to the native 43.3/43.4 path`

## Task 3 — Regression lock (full suite green)

Run the full affected surface and confirm no set/Push/drag regression:
`pnpm --dir app vitest run app/src/components/physic-paint/view/PhysicsPaintKeyRail.test.tsx app/src/components/physic-paint/view/PhysicsPaintLoopClipRail.test.tsx app/src/components/physic-paint/hooks/usePhysicsPaintRailSetDrag.test.ts app/src/components/physic-paint/hooks/usePhysicsPaintKeyRailDrag.test.ts app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts app/src/components/physic-paint/roto/physicsPaintRotoRailSetSelection.test.ts app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.test.ts`

Confirm the 43.4/43.6 resolver commit paths for single key-rail and Motion rail drags (gap/break semantics, Undo/Redo) are untouched (those suites stay green). Commit: `test(quick-260820-lwd): lock single-rail drag routing regression`.

## Verification / acceptance

- RED 1-2 fail on HEAD, pass after Task 2; RED 3-4 and every pre-existing assertion stay green.
- A plain-selected single Key Rail and a plain-selected single Motion/Static Rail each reach their native `prepareKeyRailDrag` / `prepareRotoGroupDrag` commit path with the locked contract (clamp, blocked edge, no-space sentence, one atomic command, Undo/Redo, selection/cursor stay put).
- A 2+ selected set still routes every member drag to the batch session; Push and the unselected-rail gesture are byte-identical.
- No change to `deriveEffectiveRailSetMembers`, the batch session, the resolver, history, or persistence.
- Native UAT (user): single Key Rail drag → ghost + clamp + break; single Motion Rail drag; 2+ set drag; drag from an unselected rail with a set active.

## Out of scope

- No changes to the set-of-one Copy/Duplicate/Paste/Delete scope or the batch set-move resolver/history.
- No changes to Push, Solo, the popover, or any other Timeline tool.
