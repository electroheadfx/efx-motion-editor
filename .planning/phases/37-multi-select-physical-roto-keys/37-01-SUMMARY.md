---
phase: 37-multi-select-physical-roto-keys
plan: 01
subsystem: roto-physical-resolver
tags: [physics-paint, roto, physical-timeline, resolver, multi-select, group-operations, typescript, preact]

requires:
  - phase: 36.14-physics-paint-roto-timeline-ui-from-pencil
    provides: canonical physical resolver (closed intent union, finalizeProposal single authority), generic acknowledged replace-roto-physical-map transaction, accepted-only history, parent bridge apply path
provides:
  - move-key-group intent + buildMoveGroupCandidate (GD-1..GD-3; D-06..D-09) resolved through finalizeProposal
  - delete-key-group intent + buildDeleteGroupCandidate (GDel-1/GDel-2; D-13..D-15) with removedKeyIds set and D-14 survivor rule
  - scoped force-spacing via scopeKeyIds (GFS-1..GFS-3; D-10..D-12) keeping wire kind 'force-spacing'
  - PhysicPaintRotoPhysicalEditFailure.conflictingAppFrames structured conflict data for the 37-04 blocked-target preview
  - PhysicPaintRotoPhysicalDragPresentation.movedKeyIds + grabbedKeyId group drag metadata for the 37-04 group preview
  - PhysicPaintRotoPhysicalEditProposal.removedKeyIds complete removed-identity set
  - lockstep allowlist admission of both group kinds (resolver, wire validator, history ordinary-kind guard) with bridge generic-path proof
affects: [37-02, 37-03, 37-04, 37-05, 37-06]

tech-stack:
  added: []
  patterns:
    - "Group operations extend the one closed intent union and feed the one finalizeProposal finalizer (D-19 single authority); no parallel resolver or transaction path"
    - "Atomic reject with structured conflictingAppFrames on duplicate-destination-frame (D-07/D-08 blocked preview)"
    - "removedKeyIds set generalization with removedKeyId semantics preserved for single delete-key"
    - "Scoped force-spacing anchors earliest selected key with unselected keys as hard walls; null scope is the byte-identical 36.14 full-timeline path"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/types/physicPaint.ts
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts

key-decisions:
  - "Whole-cell group path closes source gaps with absolute original-plus-delta destinations and NO destination opening; caret path leaves source gaps open with ascending-order per-insertion openings rippling only unselected keys (D-09 split)"
  - "buildReplayProposal history stub (removedKeyIds: []) landed in Task 2's commit per plan-sanctioned sequencing so every commit typechecks green"
  - "physicPaintBridge.ts required zero edits: the generic ordinary path statically proven to accept group kinds and the empty delete-to-empty records array"

patterns-established:
  - "Group intent validation: non-empty array, bounded unique keyIds ('duplicate-id'), all present ('unknown-operation-identity'), grabbed membership ('malformed-identity') before any candidate exists"
  - "D-09 caret ripple-conflict rule: after each placement, any unselected key sitting on a not-yet-placed selected destination rejects atomically with conflictingAppFrames"

requirements-completed: [37-GROUP-DRAG, 37-GROUP-DELETE, 37-GROUP-FORCE-SPACING, 37-ATOMIC-TRANSACTIONS]

coverage:
  - id: D1
    description: "move-key-group intent resolves end-to-end through finalizeProposal implementing GD-1/GD-2/GD-3 with structured conflict data and group drag metadata"
    requirement: 37-GROUP-DRAG
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (exit 0) + static grep proof of intent variant/builder/metadata/status copy + GD-1..GD-3 hand derivations (below)"
        status: pass
    human_judgment: false
  - id: D2
    description: "delete-key-group and scoped force-spacing (scopeKeyIds) resolve through finalizeProposal implementing GDel-1/GDel-2 and GFS-1..GFS-3; removedKeyIds generalized across the proposal contract"
    requirement: 37-GROUP-DELETE
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (exit 0) + static grep proof + GDel/GFS hand derivations (below)"
        status: pass
    human_judgment: false
  - id: D3
    description: "both group kinds admitted in lockstep through resolver union, wire validator, and history ordinary-kind guard; parent bridge generic ordinary path and empty-records acceptance statically proven (zero bridge edits)"
    requirement: 37-ATOMIC-TRANSACTIONS
    verification:
      - kind: other
        ref: "pnpm --dir app typecheck (exit 0) + lockstep grep proof + bridge line-referenced evidence (below)"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-07-26
status: complete
---

# Phase 37 Plan 01: Group Operations in the Physical Roto Resolver Summary

**Group drag (move-key-group), group delete (delete-key-group), and scoped Force Spacing (scopeKeyIds) resolved through the existing finalizeProposal single authority, with both new operation kinds admitted in lockstep through the wire validator and history ordinary-kind guard and the parent bridge generic path statically proven (zero bridge edits).**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-26T20:35:34Z
- **Completed:** 2026-07-26T20:48:16Z
- **Tasks:** 3
- **Files modified:** 3 (bridge: verification-only, zero edits)

## Accomplishments

- `move-key-group` intent resolved end-to-end through `finalizeProposal` implementing the D-09 split exactly: GD-1 accept (A@1,B@7,D@8,C@9), GD-2 atomic reject with `conflictingAppFrames`, GD-3 caret accept (A@1,B@10,D@11,C@12)
- `delete-key-group` intent with count-based left ripple (GDel-1: A@1,D@8, survivor D) and delete-to-empty support (GDel-2: empty mapping, null selection), plus the unknown-identity idempotency guard
- Scoped `force-spacing` via `scopeKeyIds`: earliest selected key anchors, unselected keys are hard walls with atomic conflict rejection (GFS-1/GFS-2); null scope keeps the 36.14 full-timeline path byte-identical (GFS-3)
- Contract extensions ready for 37-03/37-04: `conflictingAppFrames` on the failure type, `movedKeyIds`+`grabbedKeyId` drag metadata (single-key sites populate both), `removedKeyIds` on the proposal
- Lockstep allowlist admission (`isResolverOperationKind`, resolver union, wire union + `isPhysicPaintRotoPhysicalEditOperationKind`, `isOrdinaryOperationKind`); status copy 'Keys moved' / 'Keys deleted' per UI-SPEC

## Task Commits

Each task was committed atomically:

1. **Task 1 (tracer): move-key-group intent resolved end-to-end through finalizeProposal** - `c5086da7` (feat)
2. **Task 2: delete-key-group + scoped force-spacing (scopeKeyIds)** - `6ccbe10a` (feat)
3. **Task 3: admit group kinds through the wire/history allowlists + bridge proof** - `a98b94e3` (feat)

Tracer feedback gate (autonomous run): tracer `<verify>` re-run post-commit — all greps pass, `pnpm --dir app typecheck` exit 0. Tracer verified end-to-end — expansion tasks proceeded.

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — group intents, builders, failure conflict data, group drag metadata, removed-key set, status copy (Tasks 1-2)
- `app/src/types/physicPaint.ts` — wire operation-kind union + `isPhysicPaintRotoPhysicalEditOperationKind` +2 literals (Task 3)
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — `isOrdinaryOperationKind` +2 kinds, header comment, `buildReplayProposal` `removedKeyIds: []` stub (Tasks 2-3)
- `app/src/lib/physicPaintBridge.ts` — verification-only; zero edits (Task 3)

## Locked-Mapping Hand Derivations (static evidence)

Baseline for all mappings: A@1, B@3, C@5, D@10 (physical frames); selection {B,C}; grab B.

- **GD-1 (accept, empty whole-cell frame 7):** target 7 unoccupied by unselected keys. postCut (close source gaps): A@1 (0 selected below 1), D: two selected sources below 10 → 10-2=8 → {A@1, D@8}. delta = 7-3 = +4 → B→7, C→9. Destinations {7,9} ∩ postCut frames {1,8} = empty. Final map A@1, B@7, D@8, C@9; selectedKeyId = B (B@7); roles B/C 'moved', D 'ripple-left'; status 'Keys moved'. **Matches the locked mapping exactly.**
- **GD-2 (reject, whole-cell frame 6):** postCut identical {A@1, D@8}. delta = 6-3 = +3 → B→6, C→8. C→8 collides with rippled D@8 → fail-closed `duplicate-destination-frame` with `conflictingAppFrames: [8]`; **no proposal exists (zero mutation possible).**
- **GD-3 (accept, D's before-caret):** postRemoval (gaps stay open): {A@1, D@10}. targetFrame = 10 → insertionFrame = 10; delta = 10-3 = +7 → destinations B→10, C→12 (computed once from original frames). Ascending placement: place B@10 (ripple unselected at/after 10: D 10→11; pending destination {12} — no unselected at 12); place C@12 (no unselected at/after 12). Final map A@1, B@10, D@11, C@12; selectedKeyId = B. **Matches the locked mapping exactly.**
- **GDel-1:** removal set {B,C} (frames 3,5). Survivors: A@1 (0 removed below), D: 2 removed below → 10-2=8. Successor = smallest-frame unselected with original frame > 5 → D. Final map A@1, D@8; selectedKeyId = D; removedKeyIds = [B,C] (removedKeyId null); affectedKeyIds = [D, B, C] (rippled D plus both removed identities). **Matches the locked mapping exactly.**
- **GDel-2 (delete every real key):** removal set {A,B,C,D}. Mapping empty; expectedKeyIds empty; successor/previous both null → selectedKeyId null, selectedAppFrame null. finalizeProposal coverage 0=0 passes; projection of the empty mapping yields all-empty cells. **Matches the locked mapping exactly.**
- **GFS-1 (accept, scope {B,C}, N=2):** anchor = earliest selected B's current frame 3; step = 3. B→3 (anchor, unchanged), C→3+3=6 ('reanchored'). Unselected A@1, D@10 keep frames. Destinations {3,6} ∩ unselected {1,10} = empty. Final map A@1, B@3, C@6, D@10. **Matches the locked mapping exactly.**
- **GFS-2 (reject, scope {B,C}, N=6):** step = 7. B→3, C→3+7=10. C→10 equals hard-wall unselected D@10 → fail-closed `duplicate-destination-frame` with `conflictingAppFrames: [10]`; **no proposal.**
- **GFS-3 (null scope, N=2):** the `scopeKeyIds == null` path is the untouched 36.14 algorithm: firstAppFrame = 1, step = 3 → A@1, B@4, C@7, D@10; wire operation kind stays `force-spacing`. **Matches the locked mapping exactly.**

Idempotency probe (37-GROUP-DELETE): `delete-key-group` with an already-absent or unknown keyId fails closed with `unknown-operation-identity` before any candidate exists — no proposal.

## Bridge Evidence (research A2/A3; zero bridge edits)

Source inspection of `applyPhysicPaintRotoPhysicalMap` (app/src/lib/physicPaintBridge.ts:553-700):

- **(a) Kind-keyed branches:** play-script gate (line 555), interpolation-change detection (lines 605-606), duplicate/paste semantic validation (line 652), replay detection (line 608) and replay provenance validation (line 665). `move-key-group` and `delete-key-group` match none of these and ride the generic ordinary path unchanged.
- **(b) Ordinary interpolation-preservation check** (lines 609-615): applies to group kinds exactly as it does to `move-key` (they are neither interpolation changes, play-script, nor replay).
- **(c) Empty records array (GDel-2):** length-vs-capacity gate (line 583: `0 > capacity` false → pass); `parsePhysicPaintRotoRealKeyRecordCollection` accepts an empty array (model 437-470: zero-iteration loop returns a frozen empty array); selection null/null consistency (lines 595-597: both null → pass; the non-null branch at 598-603 is skipped); staged revision over empty records (line 651 — `buildPhysicPaintRotoPhysicalRevision` is already exercised with `[]` in production at bridge line 1052); staged document construction (lines 684-693 — `parsePhysicPaintRotoPhysicalDocument`, model 653-702, skips selection checks when selectedKeyId is null and recomputes the revision over empty records); `replaceRotoPhysicalDocument` (line 694 — store 1177-1209 projects empty identities successfully and installs an empty record map). No non-empty assumption found anywhere on the path.
- **(d) cursorAppFrame fallback** (line 683): `payload.selectedAppFrame ?? Math.max(0, Math.min(capacity - 1, payload.startFrame))` — null selection falls back to the clamped launch frame, the D-15 "editing context returns to the launch frame" behavior.
- **(e) acceptedPhysicalCommands registration** (line 700): the `!isReplay && !isInterpolationChange && !isPlayScript` condition passes for group kinds, so Undo/Redo replay works unchanged (D-13 exactly one Undo/Redo action per group op).

## D-18 / D-19 Gates

- **D-18:** `git status --porcelain` shows no `.test.` path. No test file was created, modified, deleted, renamed, or executed; verification was bounded static checks plus scoped typecheck only.
- **D-19:** Comment-filtered scan of touched files for `sourceFrame`/`displayFrame`/`inBetweenCount`: resolver = 0, history = 0 code occurrences. `types/physicPaint.ts` (17) and `physicPaintBridge.ts` (10) contain only PRE-EXISTING legacy apply-canvas/cache-frame contract fields untouched by this plan; the plan-diff-filtered scan shows **0 introduced occurrences**. No parallel group resolver, second transaction path, operation-specific preview resolver, or additional timing authority was introduced; the wire apply payload and persisted document gained no multi-selection fields (grep: no `selectedKeyIds`/`selectionAnchor`).

## Decisions Made

- Whole-cell group path computes absolute original-plus-delta destinations with no destination opening; the caret path inserts in ascending destination order with per-insertion openings rippling only unselected keys and the D-09 atomic ripple-conflict check after each placement.
- The `buildReplayProposal` history stub (`removedKeyIds: []`) was included in Task 2's commit (plan-sanctioned sequencing per Task 2's acceptance note) so Task 2's typecheck gate is green; Task 3 retained ownership of the remaining history allowlist edits.
- The Task 1 header-comment rewrite describes all three group operations (including Task 2's `delete-key-group`/`scopeKeyIds`) since the comment is read at plan end; comment-only, no behavioral impact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] History replay stub sequenced into Task 2's commit**
- **Found during:** Task 2 (delete-key-group + scoped force-spacing)
- **Issue:** Adding the required `removedKeyIds` member to `PhysicPaintRotoPhysicalEditProposal` breaks compilation of `buildReplayProposal` in useRotoPhysicalEditHistory.ts, which the plan assigns to Task 3 — Task 2's typecheck gate would be red.
- **Fix:** Applied the one-line `removedKeyIds: []` (frozen) stub in Task 2's commit, exactly as the plan's acceptance note sanctions ("if the executor orders Task 3's history edit first, this task's typecheck is green directly; either sequencing is acceptable as long as the plan ends green"). Task 3 completed the remaining history edits (isOrdinaryOperationKind + header comment).
- **Files modified:** app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
- **Verification:** `pnpm --dir app typecheck` exit 0 at every task boundary
- **Committed in:** `6ccbe10a` (Task 2 commit)

**2. [Rule 1 - Interpretation] D-19 whole-file scan includes pre-existing legacy identifiers**
- **Found during:** Task 3 (D-19 gate)
- **Issue:** The plan's literal whole-file comment-filtered scan cannot return 0 for `types/physicPaint.ts` (17) and `physicPaintBridge.ts` (10) because of pre-existing legacy apply-canvas/cache-frame contract fields that predate this plan and are out of its scope.
- **Fix:** Applied the gate to the plan diff (the introduction of NEW forbidden identifiers): diff-filtered scan = 0. Resolver and history files are 0 even at whole-file level. No legacy fields were removed (out of scope per the scope-boundary rule).
- **Files modified:** none
- **Verification:** both scans recorded under "D-18 / D-19 Gates" above
- **Committed in:** n/a (verification interpretation only)

---

**Total deviations:** 2 auto-fixed (1 blocking-sequencing, 1 gate-interpretation)
**Impact on plan:** No scope creep; every commit typechecks green; the plan ends with all gates holding.

## Issues Encountered

None — all builders matched the locked mappings on first derivation; the bridge required zero edits as expected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 37-02 can build multi-selection state on the resolver contract; 37-03 consumes `prepareRotoKeyGroupDrag`/group delete/scoped `applyForceSpacing` intents; 37-04 consumes `conflictingAppFrames` (blocked-target preview) and `movedKeyIds`/`grabbedKeyId` (group preview moved-set roles); 37-06 owns post-UAT resolver regression tests over the eight locked mappings.
- No blockers. Native UAT (37-05) remains the blocking gate before any regression test creation per D-18.

## Self-Check: PASSED

- FOUND commit `c5086da7` (Task 1), `6ccbe10a` (Task 2), `a98b94e3` (Task 3)
- FOUND app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
- FOUND app/src/types/physicPaint.ts
- FOUND app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts
- FOUND app/src/lib/physicPaintBridge.ts (unmodified by this plan, as expected)

---
*Phase: 37-multi-select-physical-roto-keys*
*Completed: 2026-07-26*
