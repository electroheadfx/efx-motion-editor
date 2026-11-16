---
phase: quick/261116-r9k
plan: 01
subsystem: physic-paint vector path editing
tags: [vector-path, resampling, arc-length, aquarelle, vitest, tdd]

# Dependency graph
requires:
  - phase: 62-painted-stroke-curve-editing
    provides: the ONE path writer (updateAquarellePathInScript) and the D-07/D-08 count-preserving re-sample
  - phase: quick/261116-qhm
    provides: the entry-time conversion that rides the writer's anchorless branch
provides:
  - VECTOR_CONVERSION_SAMPLE_STEP_UV / VECTOR_CONVERSION_MAX_SAMPLE_MULTIPLIER / resolveVectorConversionSampleCount
  - resampleVectorSpineWithPressureLaw's optional target count (conversion law)
  - the amended D-08 decision record for the conversion seam
affects: [any future path-edit seam that touches station counts]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# chars/4 over the realized diff (464 insertions + 31 deletions across 5 files).
actuals:
  tokens: 7859
  tasks: 3
  commits: 3
  plan_head_before: 0d1097154230c9aff8efa5d32de8df5dc6a9fdad
  plan_head_after: 9ae3d9db613254ba6b4f0321e7f215a3571a0ec3

# Tech tracking
tech-stack:
  added: []
  patterns: [named-bounded resampling constants, optional target-count resampler, conversion-only count gate]

key-files:
  created:
    - .planning/quick/261116-r9k-in-the-studio-canvas-make-a-painted-stro/261116-r9k-CONTEXT.md
  modified:
    - app/src/components/physic-paint/view/vectorPathHandles.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.ts
    - app/src/components/physic-paint/view/vectorPathHandles.test.ts
    - app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts

key-decisions:
  - "D-08 is amended for the conversion seam only: an anchorless stroke's first path write re-stations at clamp(ceil(spineLength / 0.02), count, 3 x count), evenly by arc length, both ends pinned."
  - "The target count is passed only when (stroke.anchors?.length ?? 0) === 0, so later drags and curve-mode switches keep the minted count and never compound."
  - "The pressure remap keeps indexing the ORIGINAL source polyline with both ends pinned; an all-sentinel stroke stays all-sentinel across the larger station count."
  - "The 3x cap and the 0.02 uv step are exported named constants; dropping to 2x is one production-code line plus its pinned literals."

patterns-established:
  - "Conversion-only count growth: the writer reads the CURRENT stroke's anchors to decide whether it is the first write."
  - "Optional third argument splits one resampler into an EDIT law (two arguments) and a CONVERSION law (three)."

requirements-completed: []

coverage:
  - id: D1
    description: "The conversion count law clamp(ceil(spineLength / 0.02), sourceCount, 3 x sourceCount) with both literal constants exported."
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/vectorPathHandles.test.ts#quick 261116-r9k — the conversion sample-count law"
        status: pass
    human_judgment: false
  - id: D2
    description: "An anchorless conversion stores 15 stations for a 0.8 uv spine (9 for the sentinel 0.2 uv spine), ends pinned, same index, one revision bump, pointTicks dropped."
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleRecordState.path.test.ts#quick 261116-r9k — the conversion re-stations the replay spine"
        status: pass
    human_judgment: false
  - id: D3
    description: "A later anchor drag (1.2 uv spine) and real curve-mode switches keep exactly the 15 stations the conversion minted."
    verification:
      - kind: unit
        ref: "src/components/physic-paint/view/aquarelleRecordState.path.test.ts#never multiplies the count again on a later drag or a real mode switch"
        status: pass
    human_judgment: false
  - id: D4
    description: "The amended D-08 decision record (law, reason, trade-off, kept laws, non-goals, untouched historical artifact)."
    verification:
      - kind: other
        ref: "grep 'D-08 is AMENDED for the conversion seam only' .planning/quick/261116-r9k-in-the-studio-canvas-make-a-painted-stro/261116-r9k-CONTEXT.md"
        status: pass
    human_judgment: false
  - id: D5
    description: "Live Studio UAT: the paint follows the curve; wash density/lifetime is accepted or the cap drops to 2x; a loop occurrence repaint matches the source frame."
    verification: []
    human_judgment: true
    rationale: "Curve-following, wash width and loop-repaint parity are visual judgments on the running Studio canvas; the executor never launches the app or the server."

# Metrics
duration: 3min
completed: 2026-11-16
status: complete
---

# Quick 261116-r9k: Painted-to-vector conversion re-samples the replay spine at up to 3x Summary

**An anchorless painted stroke's first path write now mints clamp(ceil(spineLength / 0.02), n, 3n) arc-length-even stations from named constants, so the replay follows the fitted curve while later edits and mode switches keep the minted count.**

## Performance

- **Duration:** 3 min (18:59:20Z → 19:02:39Z)
- **Started:** 2026-11-16T18:59:20Z
- **Completed:** 2026-11-16T19:02:39Z
- **Tasks:** 3
- **Files modified:** 5 (4 code/test, 1 decision record)

## Accomplishments

- The conversion seam re-stations a sparse hand stroke at up to 3x its recorded count:
  `clamp(ceil(arcLength(spine) / VECTOR_CONVERSION_SAMPLE_STEP_UV), sourceCount, VECTOR_CONVERSION_MAX_SAMPLE_MULTIPLIER × sourceCount)`,
  evenly by arc length, both ends pinned to the evaluated curve's own ends.
- `resampleVectorSpineWithPressureLaw` gained an optional target count; its
  two-argument call (the EDIT law) is unchanged, so every shipped edit pin stayed
  green without rewrites — only the conversion-path pins were retargeted.
- The pressure remap still indexes the ORIGINAL source polyline with both ends
  pinned, all-sentinel stays all-sentinel, the write is still one timeline index
  with one revision bump and one ledger entry, and `pointTicks` stays dropped.
- The amended D-08 decision record lands in the quick's own CONTEXT.md; the
  historical Phase 62 artifact is not edited.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — pin the conversion sample-count law before it exists** - `750d07753` (test)
2. **Task 2: GREEN — the count law, the resampler's target count, the seam wiring** - `2b3d5650d` (feat)
3. **Task 3: Amended D-08 decision record + boundary sweep** - `9ae3d9db6` (docs)

**Plan metadata:** handled by the orchestrator (SUMMARY/STATE/PLAN docs commit).

## Red → Green evidence

- RED run (Task 1): 10 failed / 115 passed — the three exports absent, the four
  resolver cases failing, the seam pins reporting 5 stations where 15 (spline)
  and 9 (sentinel) are demanded. No pre-existing test failed.
- GREEN run (Task 2): typecheck clean; both suites 125/125 passed.
- Boundary run (Task 3): typecheck clean; 8 suites, 806/806 passed
  (`aquarelleRecordState.path`, `vectorPathHandles`, `VectorPathOverlay`,
  `aquarelleStrokeSelection`, `PhysicsPaintStudio`, `aquarelleVectorPathCommit`,
  `vectorStrokeExportParity`, `efxPaintCompositeCache`).
- Full app suite baseline: 1 failed / 9472 passed / 1 skipped / 96 todo. The one
  failure is in the pre-existing flaky file the plan flags
  (`src/lib/physicPaintBridge.test.ts`, a different test in the same file than
  the qhm baseline: `import round trip through the main realm > answers with the
  same operationId and publishes the catalog before the answer`, an unhandled
  Tauri `unregisterListener` rejection). That file passes 186/186 + 1 skipped in
  isolation, and this quick touches nothing in the bridge. No other failing file.

## Files Created/Modified

- `app/src/components/physic-paint/view/vectorPathHandles.ts` — the two exported
  conversion constants, `resolveVectorConversionSampleCount`, and the
  resampler's optional target count.
- `app/src/components/physic-paint/view/aquarelleRecordState.ts` — the
  anchorless-only conversion gate and the target-count wiring; doc comments
  record the amendment.
- `app/src/components/physic-paint/view/vectorPathHandles.test.ts` — the
  conversion-law block plus the block-header split annotation.
- `app/src/components/physic-paint/view/aquarelleRecordState.path.test.ts` — the
  conversion seam pins, and the three conversion-path pins retargeted from 5 to
  15 stations with the amended reason in the block header.
- `.planning/quick/261116-r9k-in-the-studio-canvas-make-a-painted-stro/261116-r9k-CONTEXT.md`
  — the amended D-08 record.

## Decisions Made

- D-08 is amended ONLY at the conversion seam; the EDIT law's wording and
  behaviour are unchanged.
- The gate reads the CURRENT stroke's anchors (`(stroke.anchors?.length ?? 0) ===
  0`), so only the first write can pass a target count.
- The 1.2 uv second-spine pin (ungated would demand 45) is the discriminating
  no-compounding evidence; the older 0.1 uv second spine is count-equivalence
  only and is annotated as such.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The full-suite run surfaced a different flaky test than the qhm baseline, in
  the SAME pre-existing file (`physicPaintBridge.test.ts`). It passes in
  isolation and is unrelated to this quick; the plan's regression policy ("any
  OTHER failing file is a regression") is not tripped.

## Live UAT rows (pending user; the executor never launches the app)

1. Fast sparse painted stroke → convert (enter path edit) → the paint visibly
   follows the curve; the corners are finer or gone; there is no wash blow-out.
2. Wash density/lifetime versus the pre-conversion look: either accepted, or the
   cap steps to 2x by changing `VECTOR_CONVERSION_MAX_SAMPLE_MULTIPLIER` to 2 —
   one production-code line plus its pinned literals, no re-plan.
3. A second anchor drag does not multiply the count again (the paint's weight
   stays put while the curve moves). — deterministically pinned (Task 1/2).
4. Undo/redo restores the exact pre-conversion samples, and one ledger entry
   covers each gesture. — deterministically pinned (Task 1/2).
5. A loop occurrence repaint of the converted stroke matches the source frame.

## Known Stubs

None.

## Threat Flags

None — no new network, auth, file-access or schema surface. T-R9K-01 (unbounded
stations) is mitigated by the 3x multiplier plus the non-finite/zero guards;
T-R9K-03 (compounding) is pinned by the non-compounding seam tests.

## Next Phase Readiness

- Phase 64 planning is unaffected; no deferred items were created.
- The live UAT rows above are CLOSED — see the outcome revision below.

---

## Outcome revision (UAT 2026-11-16) — the station-count approach was withdrawn

The three commits above (`750d07753`, `2b3d5650d`, `9ae3d9db6`) implemented and
recorded a D-08 amendment that re-stationed the stroke's STORED replay points at
conversion. UAT rejected it, and it was reverted in `f0c83faa9` and `02ccdf30b`:

- The added stations were document data, so the path showed up covered in
  vertices the user then has to edit.
- Sample count is the wet lifetime, so a longer stored list also changed the
  wash — a rendering concern leaking into the geometry.

**What shipped instead** (`72a8d6cdf`, UAT approved 2026-11-16):

1. `roto/aquarelleReplayGrid.ts` — `withAquarelleReplayGrid` derives a vector
   stroke's replay grid from its anchors at the bake seam
   (`applyAquarelleTimeline`), through `resampleVectorPaintPoints`. The document
   keeps its spline; the paint is tessellated where it is consumed. Pressure is
   remapped by arc fraction; all-sentinel stays sentinel.
2. `view/vectorPathSimplify.ts` — `simplifyVectorPathAnchors` removes an
   interior anchor only while the evaluated spline stays within
   `VECTOR_PATH_SIMPLIFY_BUDGET_UV` (0.006 uv) of every recorded sample.
   18 anchors → 11 on a 24-sample hand stroke.

**Rejected lever, recorded:** widening `VECTOR_PATH_FIT_TOLERANCE_UV` to 0.01
was tried and reverted — the conversion visibly changed the user's shape. A
chord tolerance cannot bound where the spline lands, so it cannot serve as a
shape budget. The fit stays at 0.002 uv.

**D-08 is NOT amended.** The 62 phase's wording stands unmodified.

**UAT:** approved 2026-11-16 on the shipped behaviour (shape preserved, fewer
anchors, paint following the curve).

### Final gates

- `pnpm --filter efx-motion-editor run typecheck` — clean.
- 12 suites / 897 tests green, including the new `vectorPathSimplify` and
  `aquarelleReplayGrid` suites.

---

## Self-Check: PASSED

- Created `261116-r9k-CONTEXT.md` — FOUND.
- Commit `750d07753` — FOUND (ancestor of HEAD).
- Commit `2b3d5650d` — FOUND (ancestor of HEAD).
- Commit `9ae3d9db6` — FOUND (ancestor of HEAD).
