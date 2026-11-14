---
phase: 59-rail-motion-channels-v7-interface
plan: 06
subsystem: model
tags: [typescript, pure-model, rail-identity, gate-b, reconciliation, tdd, motn-01, motn-02, motn-05]

# Dependency graph
requires:
  - phase: 59-02
    provides: "PhysicPaintRotoRailMotionRecord/Channel/Key types, the fail-closed parser and createPhysicPaintRotoRailId"
  - phase: 59-05
    provides: "The rail-local frame law and the evaluated transform consumers; neither is modified here"
provides:
  - "Durable rail bindings: loopId identity for Loop Clips, minted UUID railId for bare Key Rails, anchorKeyId as a recovery hint only"
  - "reconcileRailMotions: exact railId matching, an active map keyed by railId, and retained orphans in canonical railId order"
  - "deriveRailMotionRailViews / assignRailMotionRailViews: rail views from real loop clips and deriveKeyRailSegments output, with the single documented first-bind anchor lookup"
  - "Gate B transitions: delete-first-key re-anchor (frames unchanged), delete-only-key removal, split (head keeps the railId), merge (adopted/dropped reported), start move no-op"
  - "rekeyRailMotionsForCopy: fail-closed whole-plan validation and re-keying onto fresh destination identities"
affects: [59-07, 59-08, 59-11, 59-12, 59-15, 59-16]

actuals:
  tokens: 12672
  tasks: 3
  commits: 5

plan_head_before: 23fbf4f85ec61457b033c77276bd7c1b5de1eb8c
plan_head_after: 06dbf00983eaba7b2d8a86eb84348c349c6c935b

tech-stack:
  added: []
  patterns:
    - "Identity is a durable railId, never a drawing key: loopId for Loop Clips, a minted UUID for bare Key Rails, anchorKeyId as a recovery hint only"
    - "One permitted anchor-based lookup, confined to assignRailMotionRailViews and documented as first-bind only; every other path matches railId exactly"
    - "Pure transition functions return the input reference when nothing changes; consequences that are not identity changes (merge adopt/drop) travel in an explicit frozen result wrapper"
    - "Truth table driven through the real deriveKeyRailSegments derivation and the real assign/reconcile pair, not hand-built segments"

key-files:
  created:
    - app/src/components/physic-paint/roto/railMotionIdentity.ts
    - app/src/components/physic-paint/roto/railMotionIdentity.test.ts
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-06-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-06-task2.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-06-task1.xml
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-06-task2.xml
  modified: []

key-decisions:
  - "A Loop Clip binds by its own loopId and mints nothing; a bare Key Rail has no durable id, so bindKeyRail mints one through createPhysicPaintRotoRailId and keeps the first drawing key as anchorKeyId"
  - "Reconciliation matches exact railId only: a stale anchorKeyId stays ACTIVE, and a record with no matching view is retained as an orphan in canonical railId order rather than rebound or dropped"
  - "The only anchor-based join is record.anchorKeyId === segment.firstKeyId inside assignRailMotionRailViews; live loop-owned records are excluded so a key-rail anchor cannot capture a loop record"
  - "Merge addresses records by the segment anchors, never by a railId the head may not have: both sides animated keeps the head and reports droppedRailId; only the tail animated adopts that record under its own railId"
  - "rekeyRailMotionsForCopy validates the entire plan before cloning (unbounded id, duplicate source/destination, occupied destination, missing entry for a copied animated source) and returns null so the paste fails closed"
  - "The copy result free-parses through the 59-02 parser as a validation gate, but the assembled collection is returned so retained bystanders keep object identity"
  - "View derivation uses the existing pure resolveTimelineRailType classifier; physicsPaintKeyRailPresentation.ts is intentionally untouched, leaving the file free for 59-16 without a rewrite"
  - "Requirements MOTN-01/02/05 left pending, matching the 59-01/59-02/59-05 precedent: this plan delivers the identity layer, while the store action (59-07), animate command and UI (59-12) and live UAT close the user-facing rows"

patterns-established:
  - "One-permitted-anchor-lookup: the first-bind join lives in exactly one function and a no-rebind test fences it"
  - "Reported consequence: a transition that discards user data returns the discarded id on an explicit result wrapper instead of mutating silently"
  - "Real-derivation truth table: identity rows are exercised through deriveKeyRailSegments, so a presentation-layer change breaks the identity tests"

requirements-completed: []

coverage:
  - id: D1
    description: "Durable bindings: Loop Clip bindings use loopId and mint nothing; Key Rail bindings mint a distinct UUID per call and keep the anchor as a hint"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionIdentity.test.ts#rail motion identity bindings"
        status: pass
    human_judgment: false
  - id: D2
    description: "Exact-railId reconciliation: stale-anchor records stay active, unmatched records are retained as orphans in canonical order, and a never-animated rail matches nothing"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionIdentity.test.ts#rail motion reconciliation"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rail views derived from loop clips and the real KeyRailSegments output, including infinity-as-one-occurrence span and rail-type resolution"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionIdentity.test.ts#rail motion rail views"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/physicsPaintKeyRailPresentation.test.ts (11 tests, unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Gate B transitions: delete-first-key re-anchor, delete-only-key removal, split head retention, merge adoption/drop reporting and start-move identity, all with unchanged rail-local frames"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionIdentity.test.ts#rail motion gate B transitions"
        status: pass
    human_judgment: false
  - id: D5
    description: "Copy re-key: source records adopt fresh destination identities, source collection is untouched, rail-local frames are unchanged, and invalid plans fail closed with null"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionIdentity.test.ts#rail motion gate B transitions (copy rows)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Eleven-row Gate B truth table driven through the real deriveKeyRailSegments output, plus no-heuristic-rebind and session-identity-is-not-persistence pins"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionIdentity.test.ts#rail motion identity truth table (real segment derivation)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Prohibitions held: no RailSetIdentity import, no drawing-key-id mint, no presentation-layer change, no install"
    verification:
      - kind: other
        ref: "grep -c RailSetIdentity railMotionIdentity.ts -> 0; grep -c createPhysicPaintRotoKeyId -> 0; git diff -- physicsPaintKeyRailPresentation.ts empty; git diff -- app/package.json empty"
        status: pass
    human_judgment: false

duration: ~10min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 06: Rail Motion Identity (Gate B) Summary

**Durable rail identity and its reconciliation: loopId-bound Loop Clips, UUID-bound bare Key Rails, exact-match resolution with retained orphans, and pure delete/split/merge/move/copy transitions that never silently rebind or drop motion.**

## Performance

- **Duration:** ~10 min (first RED commit 14:27 local; completed 14:37 local)
- **Started:** 2026-11-06T13:27:16Z
- **Completed:** 2026-11-06T13:37Z
- **Tasks:** 3
- **Files modified:** 2 source files (both created), plus 4 RED evidence artifacts

## Accomplishments

- Gate B now has an executable identity contract. A Loop Clip binds by its own durable `loopId` and mints nothing (`bindLoopRail`); a bare Key Rail mints a UUID through `createPhysicPaintRotoRailId` (`bindKeyRail`) and keeps the first drawing key only as `anchorKeyId`. `grep -c RailSetIdentity` is 0 and `createPhysicPaintRotoKeyId` never appears: session rail-set identity and drawing-key identity are both kept out of the motion record.
- `reconcileRailMotions` resolves on exact `railId` alone. A record whose `anchorKeyId` is stale remains ACTIVE (the hint is not a filter); every record without a matching live view is ORPHANED — retained by reference, never evaluated, never rebound, and returned in canonical railId order so snapshot/undo comparisons are stable. `describeRailMotionOrphan` supplies the short session-warning text; the module never logs.
- `deriveRailMotionRailViews` projects Loop Clips (loopId, placement span honoring `infinity` as one occurrence, resolved rail type) and the real `KeyRailSegment` output (null railId until bound, `lastKeyFrame + 1` half-open span). `assignRailMotionRailViews` performs the one and only anchor-based first bind, excludes live loop-owned records, and then hands the bound ids to the pure view derivation. `deriveKeyRailSegments` is untouched and its 11 existing tests stay green.
- Every Gate B transition is a pure collection transform returning the input reference when nothing changes: first-key deletion re-stamps the anchor with identical channels (no frame rewrite), only-key deletion removes the record in the same operation, split keeps the railId on the head and creates no tail record, merge addresses by segment anchors and reports `adoptedRailId`/`droppedRailId` on an explicit result wrapper, and a rail start move is a same-reference no-op.
- `rekeyRailMotionsForCopy` validates the whole plan before building anything — unbounded ids, duplicate sources, duplicate destinations, an occupied destination, or an animated copied source with no plan entry all return `null` so the paste fails closed. Matched records adopt the destination `railId` and anchor, copy every channel and key frame verbatim, and the source collection is returned untouched. Bystanders keep object identity; the assembled result is free-parsed through the 59-02 parser as a validation gate.
- The truth table is driven through production derivation: 11 rows build real key records, call the real `deriveKeyRailSegments`, assign views, apply the transition, and assert active/orphan identity, adopted/dropped reports and unchanged rail-local frames. Two further pins cover the no-heuristic-rebind rule and the absence of session identity in the persisted record.

## Task Commits

Tasks 1 and 2 followed the TDD RED → GREEN cycle; Task 3 is the integration suite.

1. **Task 1 RED: add failing rail motion identity pins** - `9bfeb0f20` (test)
2. **Task 1 GREEN: implement durable rail bindings and motion reconciliation** - `744cf50c7` (feat)
3. **Task 2 RED: add failing rail view and gate B transition pins** - `f3b3176c3` (test)
4. **Task 2 GREEN: implement rail views and gate B identity transitions** - `733308b64` (feat)
5. **Task 3: add the Gate B truth table over real rail derivation** - `06dbf0098` (test)

**Plan metadata:** `docs(59-06): complete rail-motion identity plan` (final commit)

_Note: TDD tasks have multiple commits (test → feat)._

## RED Evidence

Both TDD gates were validated by `gsd_run check tdd-red-evidence` with verdict `RED_EVIDENCE_OK` (`target_test_failed`, JUnit format, zero report errors):

| Task | Records | Target test | Outcome |
|------|---------|-------------|---------|
| 1 | 13 tests, 5 pass / 8 fail | `rail motion reconciliation > retains every unmatched record as an orphan in canonical railId order` | `expected [ …(2) ] to deeply equal [ 'rail-b', 'rail-c' ]` against the placeholder |
| 2 | 23 tests, 12 pass / 11 fail | `rail motion rail views > derives one view per loop clip with the loop lifecycle span` | `expected [] to deeply equal [ 'loop-1', 'loop-inf', …(2) ]` at railMotionIdentity.test.ts:210 |

Task 3 is a `type="auto"` integration task (not `tdd="true"`), so it has no RED gate; its suite was written against the already-green Task 2 implementation and passed 36/36.

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionIdentity.ts` — durable bindings, exact-railId reconciliation with retained orphans, loop/segment rail-view derivation, the single first-bind anchor lookup, the Gate B transitions (delete-first, delete-only, split, merge, start move) and the fail-closed copy re-key. Pure: imports only the 59-02 model helpers and the pure `timelineRailDesign` classifier; no store, signal, component or bridge import.
- `app/src/components/physic-paint/roto/railMotionIdentity.test.ts` — 36 tests: Task 1 binding/reconciliation pins, Task 2 view/transition pins, an 11-row truth table over real derivation, the no-heuristic-rebind pin and the session-identity pin.
- `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-06-task{1,2}.json` + `red-evidence/red-59-06-task{1,2}.xml` — validated RED records with their JUnit reports.

## Decisions Made

- **Loop identity is the loopId; key-rail identity is a minted UUID.** No railId is ever derived from `firstKeyId`, and the anchor is never identity. This is the core Gate B law and the reason first-key deletion cannot make motion jump.
- **Anchor lookup is fenced, not eliminated.** A bare Key Rail has no durable id before its first motion record exists, so one anchor join is unavoidable. It lives in exactly one function (`assignRailMotionRailViews`), is documented as first-bind only, excludes live loop-owned records, and is fenced by both the loop-coincidence pin and the no-heuristic-rebind pin.
- **Merge is addressed by segment anchors, not rail ids.** The one-sided case (head has no record yet) is only expressible that way. The result wrapper reports `adoptedRailId` or `droppedRailId`, guaranteeing 59-12's merge-drop confirmation row can name the loss; the row itself is owned by 59-12.
- **Copy validation precedes cloning.** No partial application: missing destination, duplicate destination, occupied destination and missing entry for a copied animated source all return `null`. Source records are replaced by their re-keyed copies; non-copied records are retained by reference. The free-parse gate validates the result without replacing object identities.
- **The presentation file stays untouched.** `resolveTimelineRailType` is already the single pure classifier, so no adapter was added to `physicsPaintKeyRailPresentation.ts`. This also leaves the file free for 59-16's additive work.
- **Requirements left pending.** MOTN-01/02/05 describe the user-facing add/edit/remove capability, drawing-key independence and rail-local durability. This plan is necessary but not sufficient: the store action (59-07), animate command and UI (59-12) and live UAT are still ahead. Following the 59-01/59-02/59-05 precedent, no requirement was falsely flipped.

## Deviations from Plan

### Auto-fixed Issues

None — no bug or blocking issue was found in the planned behavior.

### Process and design deviations (additive, no behavior outside the planned contract)

**1. `physicsPaintKeyRailPresentation.ts` was not modified**
- **Found during:** Task 2
- **Issue:** the plan lists the file in `files_modified` and asks for an additive `resolveRailTypeForRail(ownership)` adapter "if an existing export already answers it; otherwise pass the classifier in from the caller".
- **Resolution:** `resolveTimelineRailType` from the pure `timelineRailDesign` module already answers the classification, so the views call it as their default and accept a caller override. The presentation file is untouched, `deriveKeyRailSegments` is unchanged, and its 11 tests remain green. This also avoids an edit to a file that 59-16 will extend.
- **Files modified:** none.

**2. The default rail type uses the real classifier, not `railKind ?? 'motion'`**
- **Found during:** Task 2
- **Issue:** Task 2's `<behavior>` says "railType from railKind ?? 'motion'", but the committed RED pins require `reveal` for a reveal clip and `static` for a static clip.
- **Resolution:** `resolveTimelineRailType(clip.railKind, clip.mode ?? null)` is used as the default; a caller-supplied resolver still wins. This matches the RED evidence and the single-classifier rule.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionIdentity.ts`
- **Verification:** the loop-view test asserts motion/reveal/static from the same input.

**3. Task 1/2 unit pins were kept alongside the Task 3 truth table**
- **Found during:** Task 3
- **Issue:** Task 3 says "replace placeholder unit tests with a table-driven integration suite". The existing 23 tests are not placeholders: they are the behavior pins that produced both validated RED records.
- **Resolution:** the unit pins were kept and the 11-row truth table plus two explicit pins were added. The suite is 36 tests; deleting the unit pins would have broken the RED evidence chain and reduced coverage of the copy-plan rejection table.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionIdentity.test.ts`

**4. Two additive API parameters were kept**
- **Found during:** Task 2 (from the committed RED stub)
- **Issue:** the plan's interface list describes `deriveRailMotionRailViews(loopClips, keyRailSegments, railTypeFor)` and `rekeyRailMotionsForCopy(records, plan)`.
- **Resolution:** the RED stub already carried optional `boundRailIdByAnchor` (fourth parameter) and `copiedSourceRailIds` (third parameter) — the former makes the first-bind map testable and reusable, the latter is the only way to detect "an animated source in the copied set has no plan entry". Both are optional and do not change the documented calls.
- **Verification:** all 36 tests plus the 11 existing presentation tests pass.

**Total deviations:** 0 auto-fixed + 4 process/design notes. **Impact on plan:** no scope change — every planned artifact and truth landed; the only omitted file edit was the one the plan made conditional.

## Issues Encountered

- The session-identity test initially passed a single record to `parsePhysicPaintRotoRailMotions`, which requires an array; the fixture was corrected to serialize `[record]` before the task commit. No production change was involved.
- No behavioral issues: the Task 2 GREEN implementation passed its suite on the first run after the validated RED, and the Task 3 truth table passed on its first run.

## Threat Surface Scan

The plan's threat register is fully mitigated:

- **T-59-16 (spoofing, rail identity resolution):** resolution is an exact `railId` match; `anchorKeyId` is documented and tested as a hint (stale-anchor records stay active). The only anchor-based join is confined to `assignRailMotionRailViews`, excludes live loop-owned records, and is fenced by a no-heuristic-rebind test.
- **T-59-17 (tampering, merge/split transitions):** every transition is a pure function; merge returns `droppedRailId`/`adoptedRailId`; the truth table drives the real derivation and asserts unchanged rail-local frames on every surviving record.
- **T-59-18 (repudiation, session identity leakage):** `grep -c RailSetIdentity` is 0, the persisted record shape is exactly `railId`/`anchorKeyId`/`channels`, and a serialization test proves no `kind`/`loop`/`key-rail` member can leak.
- **T-59-SC:** no install.

No network endpoint, auth path or schema surface was added; the module is pure and reads no store, signal, component or DOM state.

## Known Stubs

None. No placeholder, TODO or unwired data source was introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **59-07/59-08:** the store action can mint with `bindKeyRail` / `bindLoopRail`, resolve with `assignRailMotionRailViews` + `reconcileRailMotions`, and pass the active record map to the evaluator. `reconcileRailMotions` returns a frozen active map keyed by railId, suitable for an idempotent setter.
- **59-12:** the merge command must call `onMergeRails` and surface `droppedRailId` in the confirmation row it owns; the identity layer guarantees the drop is reported, never silent. The animate command can use `bindKeyRail` for a bare rail and `loopId` for a Loop Clip.
- **59-15:** commit-point reconciliation consumes the active/orphan split; orphaned records must stay in the persisted collection byte-identically.
- **59-16:** `physicsPaintKeyRailPresentation.ts` was deliberately left untouched, so its additive work has no conflict with this plan.
- Verification at HEAD: targeted 36/36; presentation 11/11; full suite 381 passed | 2 skipped files, 7507 passed | 1 skipped | 96 todo; typecheck exit 0; `RailSetIdentity` count 0.
- No blockers.

---

*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*

## Self-Check: PASSED

- `railMotionIdentity.ts`, `railMotionIdentity.test.ts` and this SUMMARY exist at the recorded paths.
- Commits `9bfeb0f20`, `744cf50c7`, `f3b3176c3`, `733308b64` and `06dbf0098` are ancestors of `HEAD`.
