---
phase: 62-painted-stroke-curve-editing
plan: 05
subsystem: physic-paint (roto loop occurrence identity)
tags: [roto, loop-clips, cache-identity, tdd, regression-pins, d-11]

# Dependency graph
requires:
  - phase: 62-01
    provides: curve conversion through updateAquarellePathInScript (one write, one bump) — the single SOURCE re-bake this plan proves reaches every loop occurrence
provides:
  - "buildRotoRealCacheRevision — the ONE source-scoped real cache identity builder"
  - "Store real/defensive-real/linked-occurrence branches, the ownership remap and all three persistence projections routed through the builder"
  - "CRV-03 store-level edge probes: source/occurrence adjacency, shared ordering with one-source-edit invalidation, no materialization, empty placeholder frames"
  - "D-11 source-only curve entry pin: occurrence frames list no selectable stroke row and report no recorded script"
affects: [62 phase verification, UAT rows E/F/G]

# Actuals (#2632) — same chars/4 scale as the plan's estimate.
actuals:
  tokens: 8008
  tasks: 3
  commits: 4

commits: 4
plan_head_before: d4f1c636bb2ce4044da0309c2e03afbccf5e831c
plan_head_after: 7e38f8960a66376363b48565db4bb4b168698341

tech-stack:
  added: []
  patterns:
    - "ONE named builder for a cross-layer identity string; a construction-site scan pins zero hand-built copies outside its module"
    - "Dynamic-import test doubles keep RED a behavioural failure (missing planned export) rather than a module-load failure"
    - "Store-level projection probes assert payload object identity (toBe) to prove zero per-occurrence materialization"

key-files:
  created:
    - .planning/phases/62-painted-stroke-curve-editing/62-05-t1-RED-evidence.json
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts
    - app/src/components/physic-paint/roto/rotoPhysicalOwnership.ts
    - app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts
    - app/src/stores/physicPaintStore.ts
    - app/src/stores/physicPaintStore.rotoLoopClips.test.ts
    - app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts

key-decisions:
  - "D-11: the real-source identity shape is stated in exactly ONE production module (buildRotoRealCacheRevision); every store, remap and persistence site calls it and emits byte-identical strings"
  - "The paper cache term stays a verbatim suffix (no separator, no normalization), preserving every shipped persistence key byte for byte"
  - "CRV-03 edge probes and the D-11 source-only entry are test-only pins over shipped seams and landed GREEN by construction; the plan forbade production changes there, so no RED was fabricated"

patterns-established:
  - "Identity unification by extraction: route every construction site through one named builder, then pin zero remaining literals with a production scan"
  - "Edge probes over the re-bake path assert both new identity and same-object payload reference, so materialization cannot hide behind equality"

requirements-completed: [CRV-03]

coverage:
  - id: D1
    description: "One source-scoped real cache identity builder; every real, defensive-real, linked-occurrence, ownership-remap and persistence-projection site routes through it with byte-identical shipped strings"
    requirement: "CRV-03"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts#Phase 62 CRV-03 — the ONE source-scoped real cache identity"
        status: pass
      - kind: unit
        ref: "src/components/physic-paint/roto/rotoPhysicalOwnership.test.ts (shipped :real: pin), src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.test.ts (36 shipped cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "CRV-03 store-level edge probes: source/occurrence adjacency, shared ordering with one source edit invalidating both loops, no materialization, and empty placeholder frames with no identity"
    requirement: "CRV-03"
    verification:
      - kind: unit
        ref: "src/stores/physicPaintStore.rotoLoopClips.test.ts#Phase 62 CRV-03 — occurrence invalidation and source-only identity"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-11 source-only entry: a painted stroke is selectable only on its recorded source frame; frames 1..24 (occurrence mapping) list no row and report no recorded script"
    requirement: "CRV-03"
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleStrokeSelection.test.ts#lists a painted stroke only on its recorded source frame, never on an occurrence frame"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live app behaviour: a curve conversion on a looped source stroke repaints every occurrence in one gesture release, one undo restores every occurrence, and an occurrence frame exposes no selectable stroke row"
    requirement: "CRV-03"
    verification: []
    human_judgment: true
    rationale: "UAT rows E/F/G are visual/runtime judgments in the packaged editor (stale pixels, doubled paint, disabled curve entrance) that unit probes cannot observe."

# Metrics
duration: 6min
completed: 2026-11-14
status: complete
---

# Phase 62 Plan 05: Source-scoped loop occurrence identity Summary

**One `buildRotoRealCacheRevision` authority now owns every real-source cache key, and the loop-occurrence mapping is pinned at the store and selection seams so one source re-bake reaches every occurrence with nothing materialized.**

## Performance

- **Duration:** 6 min (measured from the first task commit to the last)
- **Started:** 2026-11-14T13:11:22Z
- **Completed:** 2026-11-14T13:17:00Z
- **Tasks:** 3
- **Files modified:** 8 (7 code/test + 1 RED evidence)

## Accomplishments

- `buildRotoRealCacheRevision(contentRevision, keyId, suffix = '')` is the ONE source-scoped real cache identity builder; the render-source contract comment now cites it instead of restating the identity shape.
- All eight production construction sites were routed through it: the store's real cell, defensive real read and linked occurrence, the ownership remap, and the persistence coordinator's runtime-frames, tolerant launch seed and accepted route (paper term passed as the verbatim suffix). The construction-site scan for `:real:` outside the model and tests is 0.
- Every shipped identity pin stayed byte-identical: model 10/10, ownership 4/4, loop-clips 32/32, persistence 36/36, selection 102/102, resolver 23/23 — 207/207 across the plan's six verification files.
- CRV-03's edge cases are regression-proof store facts: the source/occurrence boundary shares one identity family with zero added cache entries; one source re-bake moves both loops in the same transition while occurrences render the source payload by object reference; the record and loop collections are untouched; placeholder frames carry no `keyId` and no `cacheRevision`.
- D-11's source-only curve entry is pinned: a stroke recorded at playFrame 0 is listed with its serial and points, frames 1..24 list nothing and report no script, and the source row survives the occurrence walk.

## Task Commits

Each task was committed atomically:

1. **Task 1: One source-scoped identity builder** — RED `ebdbd8c93` (test), GREEN `52ec2fef0` (feat)
2. **Task 2: CRV-03 edge probes** — `dd659ca41` (test)
3. **Task 3: D-11 source-only entry pin** — `7e38f8960` (test)

**Plan metadata:** (docs: complete plan — committed separately)

_Note: TDD tasks may have multiple commits (test → feat → refactor)._

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts` — the builder plus the render-source contract comment pointing at it
- `app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.test.ts` — four cases pinning the builder's exact strings, verbatim suffix, determinism and source-key separation
- `app/src/stores/physicPaintStore.ts` — three realization paths route through the builder; the contract comment cites it
- `app/src/components/physic-paint/roto/rotoPhysicalOwnership.ts` — ownership remap rebuilds `cacheRevision` through the builder
- `app/src/components/physic-paint/hooks/useRotoFramePersistenceCoordinator.ts` — three persistence projections build the same identity family, paper term as suffix
- `app/src/stores/physicPaintStore.rotoLoopClips.test.ts` — the four CRV-03 edge probes
- `app/src/components/physic-paint/view/aquarelleStrokeSelection.test.ts` — the D-11 source-only entry pin
- `.planning/phases/62-painted-stroke-curve-editing/62-05-t1-RED-evidence.json` — RED evidence for the builder extraction

## Decisions Made

- The identity shape lives in exactly one production module; every caller emits a byte-identical string, so a future divergence cannot silently split the display cache.
- The suffix stays a raw concatenation with no separator and no normalization, which keeps the paper cache key families unchanged.
- Task 2 and Task 3 are test-only pins over shipped seams; they passed on first run because the plan forbade production changes in those tasks. No RED was fabricated.

## TDD Gate Compliance

| Gate | Task | Evidence | Verdict |
|------|------|----------|---------|
| RED | Task 1 | `ebdbd8c93`, `62-05-t1-RED-evidence.json` | `RED_EVIDENCE_OK` (4 target cases failed on the missing planned export; 6 shipped cases green) |
| GREEN | Task 1 | `52ec2fef0` | 10/10 model cases pass; shipped ownership/persistence pins unchanged |
| RED/GREEN | Task 2 | `dd659ca41` | Test-only pin over shipped resolution: 32/32 loop-clips cases pass on first run (28 shipped + 4 new); the plan mandated no production change, so no RED could exist |
| RED/GREEN | Task 3 | `7e38f8960` | Test-only pin over shipped listing: 102/102 selection cases pass on first run (101 shipped + 1 new); same rationale as Task 2 |

Task 1 is `type="tracer"`. Its feedback gate had no `blocking-human` attribute, auto mode was off, and `human_verify_mode=end-of-phase` with an automated-only verify, so the gate re-ran the Task 1 verify end-to-end (78/78 green, construction-site scan 0) before expansion — no checkpoint was raised.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Two shell-reporting nuances were corrected during execution (zsh does not expose `PIPESTATUS` the bash way; piping vitest through `tail` masks its exit code), and both verifications were re-confirmed from the log and JUnit XML rather than from the pipe status.

## Threat Model Coverage

- **T-62-16 (identity divergence):** mitigated by the single builder, the routed sites and the zero-authority scan; pinned by four suites.
- **T-62-17 (occurrence as edit target):** mitigated by the D-11 source-only listing pin and by placeholders carrying no identity fields.
- **T-62-18 (per-occurrence materialization):** mitigated by the no-materialization probe (record count and loop collection unchanged; payload reference identity).
- **T-62-SC (supply chain):** no dependency added.

## User Setup Required

None - no external service configuration required.

## Verification

- `pnpm --filter efx-motion-editor exec vitest run` over the six plan files: 6 files, 207 tests passed.
- `pnpm --filter efx-motion-editor exec tsc --noEmit`: clean (0 output).
- Identity-preservation scan: 0 `:real:` construction sites outside `physicsPaintRotoPhysicalModel.ts` and tests.
- Native UAT rows pending with the user: E (source curve conversion repaints every occurrence in one gesture release), F (one undo restores every occurrence), G (occurrence frame exposes no selectable stroke row; curve entrance stays disabled until the source frame is selected).

## Next Phase Readiness

- CRV-03's single source-scoped identity and its edge probes are complete; the remaining plan-62 work can rely on the loop occurrence mapping never materializing state.
- Live UAT rows E/F/G remain the human acceptance gate for the user-visible promise.

## Known Stubs

None.

---
*Phase: 62-painted-stroke-curve-editing*
*Completed: 2026-11-14*

## Self-Check: PASSED

- All 8 plan files verified present; all 4 task commits verified as ancestors of HEAD.
