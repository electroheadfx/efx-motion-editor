---
phase: 43-hold-loop-clips-filmstrip-capsule
plan: 05
subsystem: roto-resolver
tags: [roto, physics-paint, loop-clips, operation-guards, fail-closed, materialization, preflight, undo-redo, vitest]

requires:
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 01
    provides: loopClips document collection, canonical revision fingerprint, single-snapshot history
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 02
    provides: derivePhysicPaintRotoLoopRanges + resolvePhysicPaintRotoLoopFrame typed contract
  - phase: 43-hold-loop-clips-filmstrip-capsule
    plan: 03
    provides: linked-loop render-source branch (materialization base seam)
provides:
  - Loop-aware intent guards on delete-key / delete-key-group / move-key / force-spacing — fail-closed typed rejections with the locked D-07/D-11 copy, consulting loopClips source keyId membership
  - Rigid whole-cycle group drag carries nextLoopClips on the proposal — original loops (placementStart == pre-move first key frame) follow the drag; duplicated loops keep their own placementStart (D-04 placement/source correction); coordinator stages it atomically
  - resolvePhysicPaintRotoLinkedFrameDeleteGuard — verbatim D-13 rejection at linked/linked-unresolved frames, wired into the keyboard delete route
  - resolvePhysicPaintRotoLoopMaterializationBase — loop-resolved source payload BY REFERENCE as the D-12 paint/erase base; Clear/paste materialization shortens the loop with one-Undo/one-Redo coherence
  - derivePhysicPaintRotoLoopShortenPreflight — resolver-owned D-06 before/after derivation comparison (Pitfall 4); controller exposes the locked preflight line on loopShortenPreflight
  - D-09 paste identity proven by construction — pasted source-cycle keys land as ordinary unreferenced real keys
affects: [43-06, 43-07, 43-08, 43-09, 43-10, filmstrip-capsule, hold-loop-clips]

actuals:
  tokens: 20100
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Loop-aware guard idiom: optional loopClips on the edit input (absent = pre-43 empty collection, byte-identical behavior); guards consult sourceKeyIds membership and reject via the existing fail(code, operationKind, text) typed-failure idiom with locked copy"
    - "Placement/source correction on rigid drag: the proposal carries nextLoopClips (nextRecords precedent); only whole-cycle moves where placementStart == pre-move first key frame follow — everything else returns null and the coordinator stages the current collection unchanged"
    - "D-06 preflight by double derivation: derive current ranges, derive again with destination frames added as real keys (occupied frames keep keyIds so own-cycle regeneration never self-reports), compare effectiveEnd per loopId — O(keys + loops + count), never duration-proportional"
    - "Materialization base by reference: the D-12 base IS the source record's payload object (HOLD-04 identity pattern extends to materialization); never fabricated at real/empty/linked-unresolved frames"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts
    - app/src/components/physic-paint/hooks/useRotoTimelineActions.ts (Rule 2 wiring)
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts (Rule 2 wiring)
    - app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts (Rule 3 typecheck)

key-decisions:
  - "Guard count semantics (D-07): N counts every loop whose sourceKeyIds contain the target key — an original loop plus a duplicated loop sharing the cycle yields N=2, matching 'used by {N} linked loop(s)'"
  - "Force Spacing guard scope: full-timeline scope (null) rejects when ANY linked source key exists; a scoped selection rejects only when a member is a linked source key — scoped spacing over ordinary keys leaves the loop rhythm untouched"
  - "Partial-cycle group moves are NOT rejected: loops resolve source keys by id, so a subset drag succeeds with nextLoopClips null and placementStart unchanged (only whole-cycle moves can carry an original loop's placement)"
  - "D-06 preflight substrate is captured at dialog open AND refreshed from the revalidated authority inside confirm() (revision equality makes the refresh a no-cost recompute guard); the warning is advisory — confirm never blocks on it"
  - "The preflight derivation lives in the resolver (derivePhysicPaintRotoLoopShortenPreflight), not the controller — the plan's key_links declare the controller→resolver shared-derivation dependency and Pitfall 4 forbids controller-local boundary math"

requirements-completed: [HOLD-05]

coverage:
  - id: D1
    description: "D-07 delete-key/delete-key-group on any keyId in a referenced loop's sourceKeyIds rejects with the verbatim locked copy; N counts loops referencing the cycle (1 and 2 proven); ordinary-key deletes proceed; malformed loopClips input fails closed (T-43-05-01)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicsPaintRotoLoopGuards.test.ts#D-07 source-key deletion guard (7 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-11 single-key move and Force Spacing (full-timeline and linked-containing scope) reject with the verbatim locked copy; scoped spacing over ordinary keys succeeds; rigid whole-cycle group drag updates ONLY the original loop's placementStart — duplicated loops keep theirs and resolve the same sourceKeyIds (D-04 correction)"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicsPaintRotoLoopGuards.test.ts#D-11 rigid linked-key guard (5 tests) + D-04 rigid group drag (4 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-13 delete-key at linked/linked-unresolved frames rejects verbatim (never touches the modulo-resolved source, never unlinks); Clear materializes a local empty real key (frame resolves real, loop shortens, boundary real-key); a materialized empty key deletes normally and the loop re-expands"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicsPaintRotoLoopGuards.test.ts#D-13 linked-frame delete guard (3 tests) + D-12/D-13 materialize (4 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-12 paint materialization base is the loop-resolved source payload BY REFERENCE (D-26 one-cache-entry invariant); never fabricated at real/empty/linked-unresolved frames (T-43-05-02); Clear AND paint materialization are each ONE history command — Undo re-expands, Redo re-applies the derived shrink through the real history hook"
    requirement: HOLD-05
    verification:
      - kind: integration
        ref: "physicsPaintRotoLoopGuards.test.ts#D-06/D-10 materialization one-history-command coherence (2 tests, real useRotoPhysicalEditHistory)"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-09 paste-key/paste-key-group of copied source-cycle keys creates ordinary real keys with fresh identities unreferenced by any loop; nextLoopClips null; pasted keys delete normally"
    requirement: HOLD-05
    verification:
      - kind: unit
        ref: "physicsPaintRotoLoopGuards.test.ts#D-09 paste never carries loop identity (2 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-06 preflight surfaces `This operation will shorten {N} linked loop(s), starting at frame {F}.` with substituted values before confirm; absent when no loop is affected, when the destination is beyond the loop, and on own-source-cycle regeneration (D-24 self-exclusion); advisory only; commit + derived shrink remain one undoable/redoable outcome"
    requirement: HOLD-05
    verification:
      - kind: integration
        ref: "physicsPaintRotoPlayScriptController.test.ts#D-06 loop-shorten preflight (6 tests incl. real-history-hook coherence)"
        status: pass
    human_judgment: false

duration: ~28min
completed: 2026-08-06
status: complete
---

# Phase 43 Plan 05: Loop-Aware Operation Guards + D-06 Preflight Summary

**Every existing Roto operation is now loop-safe: source-key deletion, single-key drag, and Force Spacing reject fail-closed with locked copy; rigid whole-cycle drags move original loops while duplicated loops keep their placement; Clear/paint at linked frames materialize local real keys with one-Undo/one-Redo shrink coherence; paste never carries loop identity; and the Play Script confirm path warns `This operation will shorten {N} linked loop(s), starting at frame {F}.` from the shared derivation before committing**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-08-06T21:37:10Z
- **Completed:** 2026-08-06T22:05:00Z
- **Tasks:** 2
- **Files modified:** 7 (1 new spec, 4 source files, 2 spec updates)

## Accomplishments

- **Loop-aware intent guards** (`physicsPaintRotoPhysicalResolver.ts`): the edit input gains an optional `loopClips` collection (absent/null = pre-43 empty collection, byte-identical behavior; malformed members fail closed with `malformed-loop-clips`). delete-key and delete-key-group reject any key referenced by a loop's `sourceKeyIds` with `loop-source-key-delete-rejected` and the verbatim D-07 copy — N counts every loop referencing the cycle (a duplicated loop pair yields N=2). move-key and force-spacing reject linked source keys with `loop-source-key-move-rejected` and the verbatim D-11 copy; Force Spacing checks the full timeline when unscoped and only the scope members when scoped, so spacing ordinary keys beside a loop still works.
- **Rigid whole-cycle drag placement follow (D-04)**: `buildMoveGroupCandidate` computes `nextLoopClips` — a loop follows the drag ONLY when the moved set contains the cycle's entire source list AND its placementStart coincided with the cycle's pre-move first key frame (original loop); duplicated loops keep their own placementStart and resolve the same source keys by id. The proposal carries the collection through the `nextRecords` precedent, and the coordinator stages `proposal.nextLoopClips ?? currentLoopClips` so the follow persists atomically inside the same undoable commit.
- **D-13 linked-frame delete guard**: `resolvePhysicPaintRotoLinkedFrameDeleteGuard(context, appFrame)` returns the verbatim rejection (`linked-frame-delete-rejected`, operationKind `delete-key`) at 'linked' AND 'linked-unresolved' frames, null at real/empty frames. Wired into the keyboard delete route's fail-closed branch so the locked copy actually reaches the user.
- **D-12/D-13 materialization**: `resolvePhysicPaintRotoLoopMaterializationBase` returns the loop-resolved source payload BY REFERENCE (the D-26 one-cache-entry invariant extends to materialization) and never fabricates a base at real/empty/linked-unresolved frames. The spec proves Clear-as-empty-key and paint-base-plus-stroke each land through the existing paste-to-empty machinery: the frame resolves 'real', the loop's derived range shortens to it, and ONE Undo re-expands while ONE Redo re-applies the shrink — proven through the real `useRotoPhysicalEditHistory` hook.
- **D-09 paste identity**: paste-key and paste-key-group of copied source-cycle keys produce fresh unreferenced identities with `nextLoopClips` null; pasted keys delete as ordinary real keys.
- **D-06 preflight shorten warning**: `derivePhysicPaintRotoLoopShortenPreflight` (resolver-owned, Pitfall 4) derives the current ranges, re-derives with the pending destination range added as real keys — occupied frames keep their keyIds, so regenerating over a loop's own source cycle never self-reports (D-24 self-exclusion) — and compares `effectiveEnd` per loopId: N = affected count, F = earliest truncation frame. The controller captures the authority substrate at dialog open, refreshes it from the revalidated authority inside `confirm()`, and exposes the locked line on the advisory `loopShortenPreflight` signal. O(keys + loops + destinationCount), never duration-proportional (T-43-05-03).

## Task Commits

Each task was committed atomically (TDD: RED then GREEN per task):

1. **Task 1 (RED): loop guards spec** — `9b46614e` (test; 25 failures on missing guards/exports confirmed)
2. **Task 1 (GREEN): guards + materialization + wiring** — `81d2ee69` (feat)
3. **Task 2 (RED): preflight spec** — `47fa694d` (test; 5 new-behavior failures confirmed)
4. **Task 2 (GREEN): preflight derivation + controller signal** — `b38de355` (feat)

**Plan metadata:** recorded below (docs: complete plan)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts` — 27-test spec: D-07 deletion guards (verbatim copy, loop count, group delete, ordinary/materialized-key delete, absent-input compat, malformed input), D-11 move/force-spacing guards, D-04 rigid whole-cycle drag (original follows / duplicated keeps placement / partial-cycle and non-source moves carry no update / post-move re-resolution by id), D-13 linked-frame delete guard, D-12 materialization base + Clear/paint commits, D-09 paste identity, D-06/D-10 one-history-command coherence through the real history hook
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.ts` — optional `loopClips` edit input + validation, four new failure codes, guard helpers, branch guards on delete-key/delete-key-group/move-key/force-spacing, `nextLoopClips` on the proposal with the rigid-follow computation in the group-move builder, `resolvePhysicPaintRotoLinkedFrameDeleteGuard`, `resolvePhysicPaintRotoLoopMaterializationBase`, `derivePhysicPaintRotoLoopShortenPreflight`
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts` — `getRotoLoopClips` port, `loopPreflightSnapshot` capture at open + refresh inside confirm(), advisory `loopShortenPreflight` computed signal with the locked line
- `app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.test.ts` — D-06 describe: 6 preflight cases (locked string with substituted N/F, multi-loop earliest frame, unaffected/own-cycle absence, advisory confirm, real-history one-Undo/one-Redo coherence)
- `app/src/components/physic-paint/hooks/useRotoTimelineActions.ts` — all four resolver call sites pass the durable loopClips collection; the delete fail-closed branch surfaces the D-13 rejection at linked frames
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts` — ordinary commits stage `proposal.nextLoopClips ?? currentLoopClips` (rigid-drag placement follow persists atomically)
- `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts` — `nextLoopClips: null` on the synthetic replay proposal (interface extension)

## Decisions Made

- D-07 count semantics: N counts every loop whose `sourceKeyIds` contain the target key, so an original + duplicated pair sharing the cycle reports N=2 — the direct reading of "used by {N} linked loop(s)".
- Force Spacing guard scope: unscoped (full-timeline) spacing rejects when any linked source key exists anywhere; scoped spacing rejects only when a scope member is linked — scoped spacing over ordinary keys proceeds and leaves the loop rhythm untouched.
- Partial-cycle group moves are permitted with `nextLoopClips` null: loops resolve source keys by id, so a subset drag cannot corrupt the loop — it simply keeps its placement and follows the moved keys by identity. Only whole-cycle moves can carry an original loop's placementStart.
- The D-06 preflight derivation lives in the resolver (`derivePhysicPaintRotoLoopShortenPreflight`), not the controller — the plan's key_links declare the controller→resolver shared-derivation dependency and Pitfall 4 forbids controller-local boundary math. The acceptance grep (`derivePhysicPaintRotoLoop` in the controller) is satisfied by the import and call.
- The preflight is advisory by design: `loopShortenPreflight` is a computed signal the dialog renders before final confirmation; `confirm()` refreshes the substrate from the revalidated authority and never blocks on the warning.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected RED spec fixtures before GREEN**
- **Found during:** Task 1 GREEN (first full run)
- **Issue:** (a) payload labels `'empty'` and `'CCCC-plus-stroke'` fail the strict PNG data-URL guard (base64 length must be a multiple of 4, standard alphabet only); (b) the linked-unresolved fixture (`['A','B','MISSING','D','E']` over keys at frames 10–14) self-truncated at frame 12 — the non-owned key C inside the range is a D-24 boundary, so frame 20 resolved 'empty', not 'linked-unresolved'
- **Fix:** valid base64 labels (`RU1QVFk=`, `Q0NDQ1BMVVNTVFJPS0U=`, `TU0=`); the unresolved fixture appends the dangling reference (`['A','B','C','D','E','MISSING']`, cycle 6) so every present source key stays owned and the unresolved range spans frame 20
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts`
- **Commit:** `81d2ee69`

**2. [Rule 2 - Missing critical functionality] Wired the guards into the production call path**
- **Found during:** Task 1 GREEN
- **Issue:** the plan scoped changes to the resolver, but the four resolver call sites in `useRotoTimelineActions` never passed `loopClips` — the D-07/D-11 guards would have been dead code in production; the keyboard delete route would have kept publishing the generic "Select a real Roto key to delete." instead of the locked D-13 copy; and the coordinator staged `currentLoopClips` unchanged, so the original-loop placementStart follow would never persist
- **Fix:** pass `input.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY` at all four call sites (the port shipped in 43-01); the delete fail-closed branch derives the loop context and publishes the D-13 rejection at linked/linked-unresolved frames; the coordinator stages `proposal?.nextLoopClips ?? currentLoopClips` for ordinary commits
- **Files modified:** `useRotoTimelineActions.ts`, `useRotoPhysicalEditCoordinator.ts`
- **Commit:** `81d2ee69`

**3. [Rule 3 - Blocking] Synthetic replay proposal needed the new interface member**
- **Found during:** Task 1 GREEN (`pnpm --dir app run typecheck`)
- **Issue:** `buildReplayProposal` in `useRotoPhysicalEditHistory.ts` constructs a complete `PhysicPaintRotoPhysicalEditProposal` literal — the new required `nextLoopClips` field broke typecheck
- **Fix:** `nextLoopClips: null` on the replay proposal (replay loop state rides the snapshot, never the proposal)
- **Files modified:** `app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.ts`
- **Commit:** `81d2ee69`

**4. [Plan-directed] Task 2 RED contained one characterization case**
- **Found during:** Task 2 RED run — the one-Undo/one-Redo coherence case passed on first run
- **Investigation (TDD fail-fast rule):** the case composes the real history hook over the 43-01 loopClips snapshot contract, which already restores keys + loops together in both directions; the derived shrink/re-expansion is emergent from the 43-02 derivation. The five new-behavior preflight cases were properly RED (missing `loopShortenPreflight`), so the task's RED gate held
- **Fix:** none — kept as characterization coverage pinning the D-06 one-command outcome end to end (43-03 Task 2 precedent)
- **Commit:** `47fa694d`

## Issues Encountered

- Harness cwd resets between Bash calls dropped the `app/` working directory; all test runs use `pnpm --dir app` prefixes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **43-06 (loop ops/dialog):** `loopShortenPreflight` is the dialog-side signal to render in the preflight surface (S6); the controller's `getRotoLoopClips` port needs its Studio composition wiring when the dialog renders the line. The D-13/D-07/D-11 rejections already reach the status channel through the actions hook.
- **43-07 (capsule):** `nextLoopClips` on move-key-group proposals keeps original-loop placementStart coherent with the moved cycle, so capsule geometry reads stay correct after rigid drags.
- **43-08 (tooltip/interaction):** the capsule keyboard Delete route can reuse `resolvePhysicPaintRotoLinkedFrameDeleteGuard` semantics; ghost-cell selection exclusion was locked in 43-02.
- **43-09 (preview/export):** the materialization base helper documents the reference-identity payload contract the placeholder variant must not disturb.

## Self-Check: PASSED

- FOUND: `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-05-SUMMARY.md`
- FOUND: `app/src/components/physic-paint/roto/physicsPaintRotoLoopGuards.test.ts`
- FOUND commits: `9b46614e`, `81d2ee69`, `47fa694d`, `b38de355`
- Verify: `pnpm --dir app exec vitest run physicsPaintRotoLoopGuards physicsPaintRotoLoopResolver physicsPaintRotoPhysicalResolver` — 69 passed; `physicsPaintRotoPlayScriptController physicsPaintRotoLoopHistory` — 52 passed; full suite — 1338 passed, 0 failed (106 files, 1 skipped + 101 todo pre-existing); `pnpm --dir app run typecheck` — exit 0
- Acceptance greps: `grep -n "derivePhysicPaintRotoLoop" physicsPaintRotoPlayScriptController.ts` — import line 17, call line 177 (shared derivation in use, no local boundary math); the three locked rejection strings (D-07/D-11/D-13) asserted verbatim in the guards spec

---
*Phase: 43-hold-loop-clips-filmstrip-capsule*
*Completed: 2026-08-06*
