---
phase: 261108-nq0-phase-59-cycle-rail-bug-adding-a-key-ins
plan: 01
subsystem: physic-paint-roto
tags: [roto, rails, loop-clips, key-rail, dissolve, inside-span, dispatch, vitest]

# Dependency graph
requires:
  - quick: 261105-p9i-extend-rail-with-key-or-paint-inside-mot
    provides: the complete-canonical-lifecycle dissolve machinery (qualification helper, paste-key intent field, resolver re-validation, addEmptyKey dispatch)
  - phase: 58
    provides: the in-rail source-phase insert precedence, canonical lifecycle clip contract and repeat-occurrence phase mapping the inside-span branch must not disturb
provides:
  - inside-span dissolve law — a + Key / paint destination strictly inside a complete canonical lifecycle rail dissolves its Loop Clip when the 58 source-phase insert answers no target
  - the post-edit destination classifies as an ordinary real key, keeping paint routing off the group-frame stale gate
  - resolver and dispatch pins for the one-key cycle gesture (the + Key and paint-promotion shapes)
  - fail-closed pin for a detached real key inside the cycle (old corrupted document state)
affects: [physic-paint roto rails, key rail segmentation, paint promotion, physical-edit proposals, undo]

actuals:
  tokens: 4152
  tasks: 2
  commits: 2
  uat_approved: 2026-11-08

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One predicate, two editions: the inside-span branch calls resolveRailKeyInsertTargetInternal and refuses whenever an insert target exists, so the dispatch seam and the parent paste-key re-validation share the exact same authority."
    - "Insert precedence is proven, not assumed: every inside-span destination the 58 insert can authorize keeps the insert path; only a provable insert refusal opens the dissolve."
    - "Fail-closed ownership is unchanged: the nearest-key-below rule, unique ending-clip rule, ascending sources, exact stored-end proof and other-clip extent guard all still gate the inside-span branch."

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts

key-decisions:
  - "The dissolve consults the existing resolveRailKeyInsertTargetInternal instead of adding a caller flag, a new intent field or a second predicate, so the child-realm dispatch and the canonical parent re-validation cannot disagree about whether a rail is dissolvable."
  - "Every inside-span destination the 58 insert can authorize keeps the insert path; the dissolve fires only when the insert answers null for a complete canonical lifecycle rail (the single-source D-08 one-frame cycle, or an unprovable phase)."
  - "The clip still leaves the whole collection through the existing nextLoopClips proposal field in the same atomic joined-key paste, so the derived Key Rail is one continuous segment and one undo restores the cycle."
  - "No production change in useRotoTimelineActions.ts: its dissolve-consult comment now records the inside-span case; dispatch logic was already correct once the predicate answers."

patterns-established:
  - "Widen a dissolve predicate by delegating to the neighbouring insert predicate rather than duplicating its qualification rules — the two authorities stay in lockstep by construction."
  - "Pin a lifecycle repair at three layers: resolver target, full proposal (including the post-edit classifier), and both real dispatch shapes."

requirements-completed: [QUICK-261108-NQ0]

coverage:
  - id: D1
    description: "A destination strictly inside a one-key cycle yields the dissolve target and one proposal: nextLoopClips empty, no incoming-break change, the source key at its frame and the new key joined at the clicked frame."
    requirement: QUICK-261108-NQ0
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1: a destination strictly inside a one-key cycle dissolves the rail the 58 insert cannot extend"
        status: pass
    human_judgment: false
  - id: D2
    description: "After the dissolve the destination frame classifies as an ordinary real key, so the group-frame paint route and its stale-document gate are unreachable for that frame."
    requirement: QUICK-261108-NQ0
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1: the inside-span dissolve leaves an ordinary real key, never a group occurrence"
        status: pass
    human_judgment: false
  - id: D3
    description: "Insert precedence and fail-closed ownership: a multi-key cycle's inside-span repeat occurrence still resolves through the 58 insert (null dissolve), and a detached key inside the cycle keeps the dissolve refused."
    requirement: QUICK-261108-NQ0
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1: an insertable inside-span destination keeps the 58 insert and never dissolves"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#v2.0.1: a detached key inside the cycle keeps the inside-span law fail-closed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The + Key shape (allowRepeatRailInsert) and the paint-promotion shape (joinPreviousRail only) each dispatch exactly one paste-key command carrying the dissolve authority, and the corrupted-document shape dispatches neither a dissolve nor a rail-insert id."
    requirement: QUICK-261108-NQ0
    verification:
      - kind: integration
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#+ Key inside a one-key cycle dissolves the rail into one joined segment"
        status: pass
      - kind: integration
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#the paint-promotion shape inside a one-key cycle reaches the same dissolve"
        status: pass
      - kind: integration
        ref: "app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts#a detached key inside the cycle keeps the inside-span law fail-closed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live Studio behavior: + Key / paint at frame 5 of a one-key cycle x10 removes the cycle and lands one continuous Key Rail with no stale-document or replay error, one undo restores the cycle, Create rail -> Key still opts out, a two-key cycle keeps the 58 insert and a scripted rail still asks before converting."
    requirement: QUICK-261108-NQ0
    verification: []
    human_judgment: true
    rationale: "Visible rail geometry, the absence of runtime console errors and the single-undo feel are native Studio UAT judgments; vitest cannot observe the rendered timeline or the WKWebView replay path."

# Metrics
duration: 3min
completed: 2026-11-08
status: complete
---

# Quick 261108-nq0: Phase 59 cycle rail — + Key inside a cycled span Summary

**A + Key or paint destination strictly inside a complete canonical lifecycle rail now dissolves that rail's Loop Clip when the 58 source-phase insert cannot authorize the frame, landing one joined Key Rail in the same atomic edit instead of a stale-document error plus a split rail.**

## Performance

- **Duration:** ~3 min (plan read at 16:17:00Z, final task commit at 16:18Z)
- **Started:** 2026-11-08T16:17:00Z
- **Completed:** 2026-11-08T16:19:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- The reported gesture resolves: a one-key rail cycled x10 now yields the dissolve target at an inside-span frame (5), because `resolveRailDissolveTargetInternal` delegates to `resolveRailKeyInsertTargetInternal` and dissolves only when that neighbouring insert answers null.
- The full paste-key path removes the clip (`nextLoopClips: []`), adds no incoming break, keeps the source key at its frame and lands the selected key at the clicked frame; the post-edit destination classifies `ordinary-key`, so the group-frame paint stale gate in `useRotoPhysicalEditCoordinator.ts` is unreachable for it.
- Insert precedence is preserved by construction: a multi-key cycle's repeat occurrence (destination 22 -> first-cycle frame 2) still returns a non-null insert target and a null dissolve target, and the `58 G-06` dispatch rows stay untouched and green.
- Fail-closed ownership is unchanged: a detached real key at frame 3 inside the span makes the nearest-below key no longer the rail's last source key, so no clip is removed at either the resolver or the dispatch layer.
- Both real caller shapes are pinned at the dispatch seam: `+ Key` (`allowRepeatRailInsert: true`) and paint promotion (`joinPreviousRail` only) each dispatch exactly one `paste-key` command with `dissolveRailGroupId: 'rail-1'` and no `railInsertGroupId`.
- Full suite green: 403 files passed | 2 skipped; 8229 tests passed | 1 skipped | 96 todo (8326), 0 failed. Typecheck clean. App diff contains exactly the four plan paths.

## Task Commits

Each task was committed atomically:

1. **Task 1: Inside-span dissolve — the resolver resolves a cycle the 58 insert cannot extend** - `36c2af796` (fix)
2. **Task 2: Pin the + Key and paint-promotion shapes of the gesture at the dispatch seam** - `7de46add1` (test)

Measured from the plan ledger (`d6da76a15` -> `7de46add1`): 2 commits.

**Plan metadata:** docs commit handled by the orchestrator.

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — replaced the unconditional post-end refusal with the two-branch law inside `resolveRailDissolveTargetInternal`; broadened the dissolve law comment and the `isCompleteCanonicalLifecycleRailClip` note.
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` — four regression rows: the reported one-key-cycle gesture end to end, the post-dissolve ordinary-key classifier guard, the multi-key insert precedence row and the detached-key fail-closed row.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — dissolve-consult comment records the inside-span case; no logic change.
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.test.ts` — three dispatch pins: + Key shape, paint-promotion shape and the fail-closed corrupted-document shape.

## Decisions Made

- The dissolve consults the existing `resolveRailKeyInsertTargetInternal` rather than adding a caller flag, intent field or second predicate; the dispatch seam and the parent re-validation therefore read one authority and cannot disagree.
- Inside-span destinations the insert can authorize keep the 58 insert path; the dissolve fires only for a provable insert refusal on a complete canonical lifecycle rail (the D-08 single-source one-frame cycle, or an unprovable phase).
- The clip leaves through the existing `nextLoopClips` proposal field in the same atomic joined-key edit, so the derived Key Rail stays one segment and one undo restores the cycle; no schema, persisted shape, bridge protocol, store projection, motion channel or CSS change.

## Deviations from Plan

**1. [Test-only wording] `realKeyRecords` adapted to the proposal's actual field**
- **Found during:** Task 1 (stale-document classifier row)
- **Issue:** The plan's prose says `result.proposal.realKeyRecords` contains the new key, but `PhysicPaintRotoPhysicalEditProposal` exposes `nextRecords` (and `nextLoopClips`); there is no `realKeyRecords` on a proposal.
- **Fix:** Built the classifier document as `{ loopClips: proposal.nextLoopClips ?? [], realKeyRecords: proposal.nextRecords ?? [], capacity }` and asserted the record at frame 5 through `nextRecords`. No production or behavioural change.
- **Files modified:** app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
- **Verification:** The pin asserts the classifier returns `{ kind: 'ordinary-key', appFrame: 5, keyId: selectedKeyId }` and the suite is green.
- **Committed in:** 36c2af796

---

**Total deviations:** 1 test-only adaptation
**Impact on plan:** None on behaviour or scope; the app diff remains the four plan paths.

## Issues Encountered

None. The tracer feedback gate (Task 1 is `type="tracer"`) re-ran the full `<verify>` chain end-to-end after the Task 1 commit: resolver 251 passed, timeline actions 216 passed, typecheck clean — then execution expanded into Task 2.

## User Setup Required

None - no external service configuration required.

## Verification Evidence

- Targeted suites after both tasks:
  - `physicsPaintRotoPhysicalResolver.test.ts` — 251 passed (baseline 247 + 4 new).
  - `useRotoTimelineActions.test.ts` — 219 passed (baseline 216 + 3 new).
- Typecheck: `pnpm --filter efx-motion-editor run typecheck` — `tsc --noEmit` clean (no output).
- Full suite: `pnpm --filter efx-motion-editor exec vitest run` — 403 test files passed | 2 skipped (405); 8229 tests passed | 1 skipped | 96 todo (8326); 0 failed.
- Scope tripwire: `git diff --name-only d6da76a15..HEAD -- app` lists exactly the resolver, its test, the timeline-actions hook and its test. No store, model, bridge, motion, Tauri or CSS path.

## Known Stubs

None.

## Threat Flags

None - no new network, auth, file-access or schema surface. The widened predicate stays behind the existing fail-closed qualification (nearest-below ownership, unique ending clip, ascending sources, exact stored-end proof, other-clip extent guard), and the parent paste-key branch still re-resolves from its own validated identities before accepting a dissolve id (T-261108-NQ0-01/02/04).

## UAT

Approved 2026-11-08 by the user after the live Studio pass: the reported gesture (one key, cycle x 10, + Key at frame 5) resolves into one continuous Key Rail with the cycle removed and no stale-document or replay-snapshot errors.

Rows covered by the approval:

1. One key at frame 0, Rail cycle x 10 (span 0..10), seek to frame 5, press + Key. Expected: no console error (no `became stale before proposal staging`, no `replay target snapshot does not match`), exactly ONE Key Rail line from frame 0 to frame 5, the cycle repeats gone, the new key at frame 5 selected and paintable, no second one-key rail.
2. Press undo once. Expected: the cycle returns (one key, repeat 10, span 0..10) and the frame-5 key is gone.
3. Recreate the cycle and paint directly on generated frame 5. Expected: one real key at frame 5 on the same single joined rail, no second rail, no stale-document error.
4. With the cycle present, use Create rail -> Key at frame 5. Expected: one isolated fresh rail at frame 5, cycle rail untouched.
5. Two-key rail cycled x 3, + Key on a repeat occurrence. Expected: the key opens at the first-cycle phase (58), the cycle survives, no split.
6. A scripted Motion rail cycled x N, + Key inside the span. Expected: the `Edit this rail?` prompt appears; Convert to Standard dissolves inside the span; New rail keeps the cycle and script and lands a detached key.

## Next Phase Readiness

- UAT approved; the quick task is closed.
- No blockers, no schema or persisted-document change, no dependency change.

---
*Quick: 261108-nq0-phase-59-cycle-rail-bug-adding-a-key-ins*
*Completed: 2026-11-08*

## Self-Check: PASSED

- Existing files verified: the four changed source/test files and this SUMMARY.md.
- Commits verified as ancestors of HEAD: `36c2af796`, `7de46add1`.
- SUMMARY frontmatter carries `status: complete`.
