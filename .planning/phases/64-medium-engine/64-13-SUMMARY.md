---
phase: 64-medium-engine
plan: 13
subsystem: rendering
tags: [watercolor, webgl2, coverage-composite, source-over, pigment-alpha, spike-001, pixel-gate, headless-chrome, tdd]

# Dependency graph
requires:
  - phase: 64-06
    provides: the one Body curve (`bodyCurve = clamp01(body)^6`), the cover pass, the canonical `body` key and the probe operands
  - phase: 64-10
    provides: the Kubelka-Munk display reconstruction the mode-4 alpha now sits beside, and the probe comparator contract
provides:
  - the coverage composite — `ink ← ink·(1−a) + C·a`, `fixed ← fixed·(1−a)`, `cover ← cover·(1−a) + a` — in three scissored draws on one shared footprint, with `a = amount · (1 − exp(−8 · m))` pigment-independent
  - a double-buffered HALF_FLOAT_R coverage pair, last in `docTargets()` (11 target allocations) and in the resize copy
  - coverDepositFS / coverMaskFS, and the deletion of inkCoverFS
  - display mode 4's coverage-aware alpha: `clamp(max(1 − tMin, cov), 0, 1)` over the white reconstruction, reducing to the legacy darkness formula at cover 0
  - the `pigment` export background name on the existing mode-4 program
  - coverage.test.ts as the comment-stripped seam contract (10 rows)
affects: [64-14, 64-15, 64-17]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 22322
  tasks: 2
  commits: 3
plan_head_before: c7bb84c619d63de7ec35ccb2d8742f15e0b012e0
plan_head_after: 3759fdef963d3fc6a2a8956afb282015851303d5

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite over erase: the coverage model attenuates and re-adds inside the pigment layer instead of erasing the underlayer, so overlapping dabs converge on the masstone instead of summing absorbances"
    - "One footprint, three draws: bodyCoverFS (attenuate), coverDepositFS (deposit) and coverMaskFS (union) all bind the same footprint mask on one shared rect"
    - "Pigment-independent coverage: the layer alpha is the paint film's union, so a near-white pigment covers as fully as a black one"
    - "Comment-stripped absence gates: every negative pin in coverage.test.ts reads source with `//` and block comments removed, so explanatory prose cannot invalidate a gate"

key-files:
  created:
    - .planning/phases/64-medium-engine/64-13-red-evidence-task1.json
  modified:
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/coverage.test.ts
    - packages/efx-watercolor/src/playground/shaders.test.ts
    - packages/efx-watercolor/src/playground/emboss.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/src/playground/relief.test.ts

key-decisions:
  - "The rev-4 seam is deleted wholesale, not layered on: no `preInk` snapshot, no full-document `inkCover` ping-pong, no `onCoverDab`, no pigment-scaled `coverDensity` method. A covering stroke issues only three scissored draws per dab."
  - "`COVER_MEDIUM_DENSITY = 8` is the MEDIUM's density (`1 − exp(−8 · amount)`, amount ~0.08 -> ~0.48 per full-pressure Body-100 dab) and is computed only when Body is active, so Body 0 never reads it and stays byte-exact."
  - "The coverage sheet is a `DoubleTarget` pair from the start and `drawDisplay` binds `cover.read`; 64-14's advection owns the ping-pong."
  - "`exportBackground` grows `'pigment'` on the already-registered mode 4; modes 0-3 are structurally untouched and the committed neutral baseline proves Body 0 equals it."
  - "Task 2's pins shipped green on first write: every behaviour it asserts landed in this plan's tracer. No RED evidence was fabricated for it; the plan-level RED -> GREEN pair is Task 1's."

patterns-established:
  - "Replace-with-composite: when a medium law changes what a stroke does, delete the superseded machinery in the same task (fields, methods, call sites, callback, shader) and pin its absence on comment-stripped source"
  - "Coverage acceptance without WebGL2: vitest pins source literals and probe/medium-engine proves bytes; the plan's own 1080² and mode-4 pixel gates are deferred to 64-17 by design"

requirements-completed: [MED-19, MED-20, MED-21, MED-25]

coverage:
  - id: D1
    description: "A covering dab composites source-over inside the pigment layer: ink attenuates then receives C·a, fixed is eroded, the coverage unions, all in three scissored draws in order on one shared footprint, with blending restored after each"
    requirement: MED-21
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the coverage composite > runs three scissored draws in order — attenuate, deposit, union the coverage"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the coverage composite > composites the landed coverDepositFS and coverMaskFS laws on the shared footprint"
        status: pass
    human_judgment: false
  - id: D2
    description: "The amount is `Math.min(1, bodyCurve(P.body) * COVER_GAIN)` and the density is `COVER_MEDIUM_DENSITY * amount` — no pigment coefficient reaches either, and the method receives the medium density, not a colour"
    requirement: MED-19
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the pigment-independent amount (T-64-36) > derives the amount from bodyCurve(P.body) and the density from the medium alone"
        status: pass
    human_judgment: false
  - id: D3
    description: "Body 0 takes the additive `brushInk` path (brushInk reachable only through the else arm) and the neutral-identity gate equals the committed pre-milestone baseline on all six fields"
    requirement: MED-20
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the dab branch (SPIKE 001) > routes a covering dab through coverageDeposit and leaves brushInk to the non-cover arm"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity --size 256 && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mode 4 renders `alpha = clamp(max(1 − tMin, cov), 0, 1)` over the white reconstruction, reduces to the legacy darkness formula at cover 0, the emboss scales only the premultiplied colour, and `drawDisplay` binds the coverage sheet at texture unit 8"
    requirement: MED-25
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the display formula (T-64-39)"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/emboss.test.ts#displayFS emboss block (MED-15)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both undo pools are protected once per stamp on a stamp-wide rect before the first dab, and the callback adds no protection of its own"
    requirement: MED-21
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the per-stamp protections (T-64-37) > protects both pools once per stamp, before the first dab"
        status: pass
    human_judgment: false
  - id: D6
    description: "The rev-4 seam is gone from both sources — no preInk, armInkCover, inkCover, dropPreInk, coverDensity( or onCoverDab — with canaries proving the scan reads real code, and no coverageDeposit call in the water, pen or lift branches"
    requirement: MED-21
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the deleted rev-4 seam"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverage.test.ts#the untouched branches"
        status: pass
    human_judgment: false
  - id: D7
    description: "A body-heavy stroke visually covers what it paints over on the live sheet, a near-white pigment covers, and export matches the screen on every mode"
    requirement: MED-21
    verification: []
    human_judgment: true
    rationale: "Perceptual cover quality is a human judgment; this plan proves the law in source and Body-0 byte identity on the probe. The committed pixel gates (white-over-blue, 1080² identity) and the app wiring land in 64-17 and 64-15."

# Metrics
duration: 6min21s (commit span 17:30:36Z-17:36:57Z; the session also included a context-compaction break)
completed: 2026-11-18
status: complete
---

# Phase 64 Plan 13: The Coverage Composite Summary

**A covering brush dab now composites source-over inside the pigment layer — attenuate ink, add C·a, union a pigment-independent coverage alpha — replacing the rev-4 erase-and-snapshot seam while Body 0 stays byte-identical to the committed baseline**

## Performance

- **Duration:** 6 min 21 s commit span (17:30:36Z - 17:36:57Z; the session included a context-compaction break, so wall clock is longer)
- **Started:** 2026-11-18T17:30:36Z (first plan commit, the RED record; the read/analysis phase predates it)
- **Completed:** 2026-11-18T17:36:57Z (Task 2 commit)
- **Tasks:** 2 of 2
- **Files created/modified:** 8 (1 created, 7 modified)

## Accomplishments

- `coverageDeposit()` replaces the rev-4 erase-then-deposit seam: per dab, three scissored draws on one shared footprint rect — `bodyCoverFS` with `ZERO / ONE_MINUS_SRC_COLOR` (ink ← ink·(1−a), all seven coefficients and S), `coverDepositFS` with `ONE / ONE` (+ C·a, with the dab's scattering as the channel's S) and `coverMaskFS` with `ONE / ONE_MINUS_SRC_ALPHA` (cover ← cover·(1−a) + a).
- The coverage is pigment-independent: `a = amount · (1 − exp(−COVER_MEDIUM_DENSITY · m))` with the MEDIUM's `K = 8`, so a near-white pigment covers as fully as a black one — the failure Spike 001 measured in the rev-4 darkness-derived alpha.
- The whole rev-4 seam is deleted, not bypassed: `preInk`, `armInkCover`, `inkCover`, `dropPreInk` and its nine lifecycle releases, `onCoverDab`, the pigment-scaled `coverDensity` method and `inkCoverFS` are gone; `coverageDeposit` performs no snapshot and no full-document pass.
- Display mode 4 now renders `alpha = clamp(max(1 − tMin, cov), 0, 1)` and reconstructs the pigment over WHITE through that same alpha, reducing exactly to the legacy darkness-only formula wherever cover is 0; the emboss scales the premultiplied colour and never the alpha.
- The coverage sheet is a double-buffered HALF_FLOAT_R pair, last in `docTargets()` (11 allocations, 23 programs), copied on resize, with `drawDisplay` binding it at texture unit 8; `exportBackground` grows the `'pigment'` name on the existing mode-4 program.
- Body 0 is byte-identical: the probe's neutral-identity gate equals the committed baseline on all six compared fields (`d2bd637a / 291d4a11 / 6ba88334`), and Body 0 issues no coverage draw at all.
- `coverage.test.ts` is now the seam contract, 10 rows over comment-stripped source: the branch, the three draws, the amount and density, the protections, the display formula and unit, and the deleted seam (with canaries).

## Task Commits

Each task was committed atomically:

1. **Task 1: The coverage composite and the deleted rev-4 seam** - `ba3b17986` (test, RED) then `9cfa83b4d` (feat, GREEN)
2. **Task 2: Pin the coverage seam as a source contract** - `3759fdef9` (test)

**Plan metadata:** the `docs(64-13)` commit that carries this file.

_Note: Task 1 is the plan-level RED -> GREEN pair; Task 2's pins were green on first write (see TDD Gate Compliance)._

## Files Created/Modified

- `packages/efx-watercolor/src/playground/shaders.ts` - `coverDepositFS` and `coverMaskFS` replace `inkCoverFS`; `displayFS` declares `uCover` and mode 4 derives `alpha = clamp(max(1 − tMin, cov), 0, 1)` with the white reconstruction
- `packages/efx-watercolor/src/playground/Engine.ts` - the coverage `DoubleTarget`, `coverageDeposit()`, the `coverAmount > 0 ? coverageDeposit : brushInk` branch, the pigments import, `COVER_MEDIUM_DENSITY = 8`, `exportBackground: 'pigment'`, the unit-8 `uCover` binding, and the deletion of every rev-4 field, method, call site and the `onCoverDab` callback
- `packages/efx-watercolor/src/playground/coverage.test.ts` - rewritten as the comment-stripped composite/display/deleted-seam contract (10 tests)
- `packages/efx-watercolor/src/playground/shaders.test.ts` - the coverage-shader RED pins (coverDepositFS/coverMaskFS exist, inkCoverFS gone, displayFS reads uCover)
- `packages/efx-watercolor/src/playground/emboss.test.ts` - mode-4 literals and the coverage unit in the bind list, `coverPass` pins intact
- `packages/efx-watercolor/src/playground/scattering.test.ts` - 11 allocations, 23 programs, the medium-density token and the amended `coeffs:`/`cov` pins
- `packages/efx-watercolor/src/playground/relief.test.ts` - the cover pair LAST in `docTargets()` with the thickness immediately before it
- `.planning/phases/64-medium-engine/64-13-red-evidence-task1.json` - the validated RED record (`RED_EVIDENCE_OK`, reason `target_test_failed`)

## Decisions Made

- Delete the rev-4 seam wholesale rather than layering the composite on top; the plan's inversion rating accepted the cost of re-deriving coverage baselines in 64-17.
- The coverage pair ping-pongs from the start (`DoubleTarget`); `drawDisplay` binds `cover.read` and 64-14's advection takes the swap.
- `COVER_MEDIUM_DENSITY = 8` lives on the Engine beside `COVER_GAIN` / `RELIEF_ERODE`, is read only under the Body guard, and is passed to the method as `density` so the amount and the density can never drift apart.
- Mode 4 keeps the existing program and the white reconstruction; `'pigment'` is a new union member routing to it, not a new mode.
- Task 2 is pin-only: it asserts behaviour landed by Task 1 and adds no implementation.

## TDD Gate Compliance

- RED: `ba3b17986` `test(64-13): add failing coverage-shader pins` — `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` on `64-13-red-evidence-task1.json` (reason `target_test_failed`; `shaders.ts` exported no `coverDepositFS`/`coverMaskFS` and still exported `inkCoverFS`).
- GREEN: `9cfa83b4d` `feat(64-13): composite the paint film over the underlayer` follows the RED commit.
- Task 2 (`tdd="true"`) shipped no RED commit: every asserted behaviour landed in this plan's Task 1, so all 10 rows passed on first write. It was committed as one `test(64-13)` commit rather than fabricating a failure; the plan-level RED -> GREEN sequence is Task 1's pair. One pin bug was caught before that run (the lift slices ended on section-banner comments that `stripComments` removes) and fixed to code anchors.
- REFACTOR: not required. No gate violations.

## Probe evidence (headless Chrome, real WebGL2)

| Gate | scenario | body | size | digestPaper | digestTransparent | digestWhite | bakeMs | renderMs | Comparison | Result |
|------|----------|------|------|-------------|-------------------|-------------|--------|----------|------------|--------|
| neutral-identity | neutral | (absent) | 256 | d2bd637a | 291d4a11 | 6ba88334 | 30-32 | 14-15 | committed baseline (d1fd7ea3c) | PASS — all 6 fields equal |

The gate was run twice (once in the verify chain, once as the tracer feedback gate re-run) and passed identically both times. **No baseline was written or rewritten by this plan.** Any Body-0 difference would have been a defect in the substitution, not a tuning question.

Exact verify chain (passed end to end):
`pnpm --filter @efxlab/efx-watercolor exec vitest run src/playground/shaders.test.ts src/playground/coverage.test.ts src/playground/emboss.test.ts src/playground/scattering.test.ts src/playground/relief.test.ts src/determinismContract.test.ts && pnpm --filter @efxlab/efx-watercolor check && pnpm --filter @efxlab/efx-watercolor build && node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity --size 256 && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity`

Task 2's verify chain (passed): `pnpm --filter @efxlab/efx-watercolor exec vitest run src/playground/coverage.test.ts src/playground/shaders.test.ts src/determinismContract.test.ts && pnpm --filter @efxlab/efx-watercolor check && pnpm --filter @efxlab/efx-watercolor build` — 30 tests pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `scattering.test.ts` gouache `cov` absence pin invalidated by the sanctioned change**
- **Found during:** Task 1 (pre-GREEN pin sweep)
- **Issue:** The pre-existing pin `expectNotContains(display, 'cov')` forbade any `cov` token in `displayFS`; the coverage model legitimately introduces `float cov = texture(uCover, uv).x;`.
- **Fix:** Pin exactly two `\bcov\b` tokens in `displayFS` (one read, one use) and keep the `gouache` absence, so the pin still proves no second colour model exists.
- **Files modified:** `packages/efx-watercolor/src/playground/scattering.test.ts`
- **Verification:** `scattering.test.ts` 24/24 pass; the neutral identity gate is byte-identical.
- **Committed in:** `9cfa83b4d` (Task 1 GREEN)

**2. [Rule 1 - Bug] `scattering.test.ts` `coeffs:` whole-file count moved 2 -> 3**
- **Found during:** Task 1 (verify sweep)
- **Issue:** The pin asserted exactly two `coeffs:` tokens, both in the interpolation-scratch declaration; `coverageDeposit` receives the pigment coefficients as a typed parameter (`coeffs: Float32Array`), a third token that is not a pigment record.
- **Fix:** Pin three tokens with a label naming each, add a pin that the only two bare `coeffs: Float32Array` annotations are the scratch field and the method parameter, and pin the full `coverageDeposit` signature.
- **Files modified:** `packages/efx-watercolor/src/playground/scattering.test.ts`
- **Verification:** 24/24 pass; the payload pins (`Pigment`, `coeffs` absent) still guard the recorded stroke shape.
- **Committed in:** `9cfa83b4d` (Task 1 GREEN)

**3. [Rule 1 - Bug] `relief.test.ts` docTargets entry polluted by an inline comment**
- **Found during:** Task 1 (verify sweep)
- **Issue:** The array-entry splitter does not strip comments, so `entries[last - 1]` carried the newly added SPIKE 001 comment text instead of `this.cover.read`.
- **Fix:** Moved the SPIKE comment above `return [` in `docTargets()` so the entries stay pure and the positional pin stays meaningful.
- **Files modified:** `packages/efx-watercolor/src/playground/Engine.ts`
- **Verification:** 16/16 relief tests pass; the wipe-loop pins are unchanged.
- **Committed in:** `9cfa83b4d` (Task 1 GREEN)

### Plan-text / requirement-text corrections (implementation follows the tree, not the prose)

- **MED-25's "adds no render target, no texture allocation and no shader program" clause is superseded by Spike 001's GO.** The plan's own parent context and acceptance criteria require the coverage pair (one new HALF_FLOAT_R DoubleTarget) and two new shader programs; the requirement's still-live clauses — the cover pass reusing its program and export matching the screen — are delivered. Recorded so the requirement text is not read as a defect.
- **`coverDensity` token survives as a local const.** The deleted symbol is the rev-4 METHOD `coverDensity(`; the brush case keeps a local `const coverDensity = ...` carrying the medium density. The absence pin is written against `coverDensity(` for exactly that reason.
- **The guard count in the task-1 kept-green pins moved 3 -> 4.** The brush case now has four `coverAmount > 0` occurrences (density read, protection block, coverPass call, coverageDeposit call); the first describe's arity pin was updated in step with the plan's own second call.

**Total deviations:** 3 auto-fixed (all Rule 1) plus 3 plan-text corrections.
**Impact on plan:** All three fixes are consequences of the sanctioned law change; each preserves the pin's original intent rather than loosening it. No scope creep, no baseline movement.

## Issues Encountered

- The rewritten contract's first draft sliced the lift case and `lift()` up to the section-banner comments, which `stripComments` removes (a comment-stripped source has no comment anchors). Caught by the first run and fixed to code anchors (`private eachDab(s: Stroke`, `private dryTau()`); no commit carried the bad anchors.
- **Cross-package consequence, intentional:** deleting `onCoverDab` from `EngineCallbacks` leaves three app consumers referencing it — `app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts`, `app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx` and `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx`. The app package's typecheck is outside this plan's gate; the plan assigns the app carry to 64-15. Do not close the phase without it.

## Next Phase Readiness

- 64-14: the coverage pair is ready for advection, undo pairing and Lift coupling; `coverageLifecycle.test.ts` is its file and deliberately does not exist yet.
- 64-15: must remove/rewire the three `onCoverDab` consumers above and carry the coverage sheet (and `exportCanvas('pigment')`) into the app commit path.
- 64-17: owns the committed pixel gates — white-over-blue, the 1080² identity law and the re-specified wet-underlayer gate; this plan's neutral 256² baseline remains byte-identical.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-18*

## Self-Check: PASSED
