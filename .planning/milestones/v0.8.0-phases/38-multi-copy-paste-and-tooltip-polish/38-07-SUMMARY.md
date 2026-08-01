---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 07
subsystem: testing
tags: [physics-paint, roto, group-copy, group-paste, vitest, post-uat]

requires:
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 06
    provides: Explicit approval of the full 33-step native UAT and the D-15 gate lift
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 01
    provides: One-slot single/group clipboard contract and group Copy behavior
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 02
    provides: paste-key-group resolver, semantic validator, and intent factory
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 04
    provides: Group paste activation and post-acceptance selection aftermath
provides:
  - GP-1..GP-7 regression anchors for accepted and rejected paste-key-group resolver behavior
  - Regression coverage for pasted-group selection aftermath and fail-safe collapse
  - Session-level coverage for the one-slot group clipboard contract, normalization, and availability parity
affects: [38-08, phase-38-closure, group-copy, group-paste]

tech-stack:
  added: []
  patterns:
    - "Post-UAT regression tests exercise shipped public seams without production edits"
    - "Semantic group-paste tests provide full records matching resolver identities"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts
    - .planning/phases/38-multi-copy-paste-and-tooltip-polish/38-07-SUMMARY.md
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts

key-decisions:
  - "Production remained untouched because the 38-06 native UAT locked the shipped contract; this plan added regression anchors only."
  - "The over-capacity case uses a valid dense four-record capacity-five fixture because the shared A@1/B@3/C@5/D@10 baseline is itself invalid at capacity five."

patterns-established:
  - "Group resolver acceptance assertions derive fresh identities from the intent factory rather than hardcoding generated keyIds."
  - "Clipboard availability tests compare the public actionAvailability signal across single and group slot shapes."

requirements-completed:
  - 38-GROUP-COPY
  - 38-GROUP-PASTE

coverage:
  - id: GP-RESOLVER
    description: "Group paste anchor/offset math, fresh identities, zero ripple, atomic rejection, semantic validation, and factory fail-closed behavior"
    requirement: 38-GROUP-PASTE
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts#GP-1..GP-7 (22 tests passed)"
        status: pass
    human_judgment: false
  - id: GP-SELECTION
    description: "Accepted pasted keys replace selection with the earliest pasted key as anchor; absent or empty added IDs collapse safely"
    requirement: 38-GROUP-PASTE
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts#resolvePostAcceptanceRotoSelection paste-key-group cases (21 tests passed)"
        status: pass
    human_judgment: false
  - id: GC-SESSION
    description: "One-slot group clipboard capture, overwrite, immutability, narrowing, normalization, and paste-availability parity"
    requirement: 38-GROUP-COPY
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts (10 tests passed)"
        status: pass
    human_judgment: false

metrics:
  duration: 16min
  tasks: 3
  files: 4
  completed: 2026-07-29
status: complete
---

# Phase 38 Plan 07: Post-UAT Group Copy/Paste Regression Summary

**Fifty-three focused Vitest tests now lock the UAT-approved group Copy/Paste seam across resolver semantics, selection aftermath, and the shared session clipboard without touching production code.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-29T15:04:06Z
- **Completed:** 2026-07-29T15:19:41Z
- **Tasks:** 3
- **Files modified:** 4 (three test files plus this summary)

## Accomplishments

- Added GP-1..GP-7 resolver anchors covering earliest-source anchoring, relative offsets, complete retargeted records, fresh key IDs, zero ripple, frozen semantic output, occupied/over-capacity/out-of-range/self-collision rejection, shared semantic validation, and factory input discipline.
- Added post-acceptance selection anchors proving that an accepted pasted group becomes the full selection with its earliest pasted key as anchor, while absent or empty added IDs collapse safely and prior state remains unchanged.
- Added a new session regression file covering verbatim group Copy feedback, fail-closed entry counts that preserve the clipboard, both overwrite directions in the single shared slot, union narrowing, input normalization, and shape-agnostic paste availability.

## Verification

Focused task runs:

- `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` — 1 file passed, 22 tests passed.
- `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts` — 1 file passed, 21 tests passed.
- `pnpm --dir app exec vitest run src/components/physic-paint/roto/physicsPaintRotoSession.test.ts` — 1 file passed, 10 tests passed.

Plan-level focused gate:

- The same three files run together — 3 files passed, 53 tests passed.
- `git diff --name-only 43bcc4b5..HEAD` listed exactly the three planned test files.
- Zero production files changed and zero new legacy source/display timing identifiers were introduced.
- No server, browser, native app, full test suite, typecheck, or build was launched; those broader gates remain owned by Plan 38-08.

## GP Anchor Map

- **GP-1:** earliest copied source frame anchors at destination 20; the second copied key preserves its +4 offset and lands at 24.
- **GP-2:** accepted output contains unchanged baseline records plus exactly two fresh retargeted records; earliest fresh identity is selected and semantic output is frozen.
- **GP-3:** occupied computed destinations reject atomically with `duplicate-destination-frame` and both conflicting frames.
- **GP-4:** capacity overflow and out-of-range computed destinations reject atomically with the existing codes.
- **GP-5:** mutually colliding computed destinations reject atomically with `duplicate-destination-frame`.
- **GP-6:** the shared validator accepts the exact declared delta and rejects changed existing ownership, missing fresh records, undeclared identities, and kind mismatch.
- **GP-7:** the factory rejects malformed destination/entry inputs and returns a deeply frozen intent with one distinct fresh identity per entry and no offset table.

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolver paste-key-group regression anchors** — `5de15904` (`test`)
2. **Task 2: Multi-selection aftermath regression anchors** — `3bf47e21` (`test`)
3. **Task 3: Session group clipboard regression file** — `4df33309` (`test`)

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts` — GP-1..GP-7 resolver, semantic-validator, and factory coverage.
- `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts` — pasted-group aftermath, input immutability, and fail-safe collapse cases.
- `app/src/components/physic-paint/roto/physicsPaintRotoSession.test.ts` — new group clipboard session contract coverage.
- `.planning/phases/38-multi-copy-paste-and-tooltip-polish/38-07-SUMMARY.md` — execution and verification record.

## Decisions Made

- Kept the shipped production contract byte-untouched, as required by the post-UAT test-only boundary.
- Retained and corrected the previous executor's partial resolver test work rather than discarding or duplicating it.
- Used a dense valid resolver fixture for the over-capacity assertion: the plan's suggested shared baseline with capacity five fails earlier because records at frames 5 and 10 are out of range.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected focused Vitest paths for the app-root working directory**
- **Found during:** Task 1 verification
- **Issue:** The literal planned command passed an `app/src/...` filter after setting Vitest's root to `app`, so Vitest searched below `app/app/src/...` and found no tests. The first absolute `--dir` form also resolved as an executable and returned `EACCES` under the installed pnpm version.
- **Fix:** Used the equivalent one-shot project command `pnpm --dir app exec vitest run src/...` for every focused run.
- **Files modified:** none
- **Verification:** All three focused files passed individually and together (53/53 tests).
- **Committed in:** no file change; verification command adjustment only.

**2. [Rule 3 - Blocking] Reconciled the impossible shared-baseline capacity example**
- **Found during:** Task 1 GP-4 construction
- **Issue:** A capacity of five cannot validate the shared baseline containing C@5 and D@10, so that fixture reports `out-of-range-frame` before it can exercise record-count overflow.
- **Fix:** Kept the partial executor's valid dense four-record fixture at capacity five, which reaches the shipped `over-capacity` guard deterministically.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts`
- **Verification:** Focused resolver run passed all 22 tests.
- **Committed in:** `5de15904`

**3. [Rule 3 - Blocking] Followed the fallback behavior over the contradictory call-count gate**
- **Found during:** Task 2 acceptance review
- **Issue:** The action requires two fallback calls (absent and empty `acceptedAddedKeyIds`) plus branch and non-mutation calls, which necessarily increases resolver call sites by four rather than the acceptance row's stated three.
- **Fix:** Implemented all required behavior cases without merging or omitting either fallback assertion.
- **Files modified:** `app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts`
- **Verification:** Focused multi-selection run passed all 21 tests.
- **Committed in:** `3bf47e21`

---

**Total deviations:** 3 auto-fixed blocking test-construction/verification issues.
**Impact on plan:** No scope expansion and no production edits; all corrections were necessary to execute the specified regression contract faithfully.

## Issues Encountered

- The previous executor's uncommitted resolver test diff was largely aligned with the plan. It was inspected, exercised, corrected only where the planned capacity fixture was invalid, and committed once without duplicate describes or tests.

## TDD Gate Compliance

- A `test(38-07)` commit exists for every task.
- No `feat(38-07)` GREEN commit exists because Plan 38-07 explicitly prohibits production edits and adds post-UAT regression coverage against already-shipped behavior. The tests passed immediately against the UAT-approved implementation after test-construction corrections; adding implementation solely to manufacture a GREEN commit would violate the plan.

## Self-Check: PASSED

- All three planned test files and this summary exist.
- Task commits `5de15904`, `3bf47e21`, and `4df33309` are present in git history.
- Plan scope contains exactly the three test files and zero production changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 38-08 can run the deferred presentation/capsule regression updates and the full suite, typecheck, and build gate.
- The working contract is regression-locked with zero production changes and no unresolved blocker.

---
*Phase: 38-multi-copy-paste-and-tooltip-polish*
*Completed: 2026-07-29*
