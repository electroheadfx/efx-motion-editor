---
phase: 261112-hfk-fix-cr-01-from-planning-phases-61-vector
plan: 01
subsystem: ui
tags: [vector-path, per-vertex-colour, preact, signals, source-scan-tests, cr-01]

# Dependency graph
requires:
  - quick: 261111-wd6
    provides: buildAnchorColorCommit and the Color tab per-vertex branch
provides:
  - anchorColorCommitIsNoOp — the pure unchanged-gesture predicate in the handle module
  - the Studio guard that returns before commit(target, next) on an unchanged colour gesture
  - the repointed shared-module import pin and the build -> guard -> commit ordering pin
affects: [61-REVIEW.md CR-01, 62-painted-stroke-curve-editing]

actuals:
  tokens: 1537
  tasks: 2
  commits: 2
plan_head_before: 71a2dcc5e698e40e1ea6e83b3248a10eb67bb6cc
plan_head_after: 749d79dec7ee6fabb538f6d236ac13c4257929cb

tech-stack:
  added: []
  patterns:
    - "Decide a gesture's no-op status from the exact list the builder produced, never from a second equality pass over the raw inputs"
    - "A pure predicate beside its builder, behaviourally pinned; the Studio wiring pinned by the source-scan suite"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/view/vectorPathHandles.ts
    - app/src/components/physic-paint/view/vectorPathHandles.test.ts
    - app/src/components/physic-paint/PhysicsPaintStudio.tsx
    - app/src/components/physic-paint/PhysicsPaintStudio.test.ts

key-decisions:
  - "anchorColorCommitIsNoOp compares the explicit colours of the built list only: every non-targeted anchor is reference-identical, so only listed indices can differ"
  - "An uncoloured anchor that gains a colour — including its own stroke's colour — is a real change (explicit wins over inherit), never skipped"
  - "The guard returns before the commit, so an unchanged gesture publishes nothing; a genuine refusal still publishes through the untouched block"

patterns-established:
  - "No-op predicate beside its builder: the list comparison IS the decision, no second normalise pass"
  - "Import pins are repointed, never deleted, when a shared module gains an export"

requirements-completed: [QUICK-261112-HFK]

coverage:
  - id: D1
    description: "Pure anchorColorCommitIsNoOp predicate reporting the six documented verdicts (same colour, canonical re-pick, uncoloured anchor gaining a colour, one differing listed anchor, different pick on a coloured list, colours outside the selection)"
    requirement: QUICK-261112-HFK
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/vectorPathHandles.test.ts#anchorColorCommitIsNoOp — the unchanged colour gesture (261112-hfk CR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Studio anchor-colour branch: build -> guard -> commit ordering, one guard, genuine-refusal publication and stroke-level fallback intact"
    requirement: QUICK-261112-HFK
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/PhysicsPaintStudio.test.ts#skips an unchanged colour before committing (261112-hfk CR-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Live behaviour: releasing an unmoved colour box, re-picking the same swatch or retyping the same hex publishes no banner; a genuine refusal still publishes; the stroke-level pick is unchanged"
    verification: []
    human_judgment: true
    rationale: "The five native UAT rows in the plan require the live Studio picker (pointer release, swatch re-pick, undo/redo, in-flight refusal); the source-scan and node-environment suites cannot observe the banner or the engine re-bake."

# Metrics
duration: 2min
completed: 2026-11-12
status: complete
---

# Quick 261112-hfk: CR-01 — no false "Vertex colour not applied" banner Summary

**An unchanged per-vertex colour gesture now returns before the path-edit commit, so releasing an unmoved colour box publishes nothing while a genuine refusal still publishes through the untouched block.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-11-12T11:36:35Z
- **Completed:** 2026-11-12T11:38:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `anchorColorCommitIsNoOp` exported from the pure handle module beside `buildAnchorColorCommit`: one pass comparing the explicit colours of the built list, with the reference-identity contract documented (only listed indices can differ)
- Six behavioural pins in `vectorPathHandles.test.ts`, including the explicit-wins-over-inherit case (an uncoloured anchor gaining a colour is a real change) and a canonical `#FF0000` re-pick being a no-op
- `handleRightPanelColorCommit` guards the anchor branch with the predicate between the build and `commit(target, next)`; the refusal publication (`setApplyMessage` / `setApplyStatus('error')` / `setLastError`) and the stroke-level fallback are byte-identical to HEAD
- The shared-module import literal pin was repointed (never deleted) and a new ordering pin proves build -> guard -> commit with exactly one guard and the refusal strings still present

## Task Commits

Each task was committed atomically:

1. **Task 1: The pure unchanged-gesture predicate** - `c71e3e80f` (feat)
2. **Task 2: Guard the Studio branch** - `749d79dec` (fix)

TDD note: Task 1 ran RED first (6 new tests failing with `anchorColorCommitIsNoOp is not a function`, 67 existing passing) then GREEN (73/73) within the task boundary, committed once as the plan's task granularity specifies.

## Files Created/Modified
- `app/src/components/physic-paint/view/vectorPathHandles.ts` - added `anchorColorCommitIsNoOp` after `buildAnchorColorCommit`; the builder itself untouched
- `app/src/components/physic-paint/view/vectorPathHandles.test.ts` - import entry plus the six-case behavioural describe
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx` - extended the handle-module import and added the CR-01 guard inside the anchor branch
- `app/src/components/physic-paint/PhysicsPaintStudio.test.ts` - repointed the import literal pin and added the ordering pin

## Decisions Made
- The no-op verdict compares the exact list the builder produced rather than re-normalising the pick: every non-targeted anchor is reference-identical, so the colour comparison covers the whole decision.
- The guard sits after `if (next !== null) {` so a malformed/empty-selection null still falls through to the shipped stroke-level commit exactly as before.
- The guard comment states the reason without repeating the predicate call literal, keeping the source pin's `indexOf` unambiguous.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The plan's scope check expects `grep -c "anchorColorCommitIsNoOp(" PhysicsPaintStudio.tsx` to report 2 (import + guard). The import literal has no `(` directly after the identifier, so the actual count is 1 matching line / 1 occurrence of `anchorColorCommitIsNoOp(` — the guard alone. The invariant the check protects (one guard, never a second) is proven both by the occurrence count and by the new pin's `split(...).length - 1 === 1` assertion.

## Verification

- `pnpm --prefix app run typecheck` — green
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/vectorPathHandles.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts` — 483 passed
- `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint` — 253 files / 6431 tests passed
- Scope: `git diff --stat` against the plan base names exactly the four `files_modified` paths; `RightPanelColorTab.tsx`, `aquarelleRecordState.ts`, `aquarelleStrokeSelection.ts` and `strokeSettingsModel.ts` are untouched; `buildAnchorColorCommit`'s body is byte-identical to HEAD
- Native UAT rows 1-5 from the plan are handed to the user, not claimed here

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CR-01's automated half is complete; the live Studio UAT rows (unchanged gesture silent, genuine refusal still publishes, stroke-level pick unchanged) remain for the user
- WR-01 and WR-02 from the Phase 61 review remain open

---
*Quick: 261112-hfk-fix-cr-01-from-planning-phases-61-vector*
*Completed: 2026-11-12*

## Self-Check: PASSED
