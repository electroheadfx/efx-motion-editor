---
phase: 59-rail-motion-channels-v7-interface
plan: 05
subsystem: evaluation
tags: [typescript, pure-evaluator, interpolation, smoothstep, seeded-wiggle, lane-curve, tdd, motn-03, motn-05, motn-06, motn-09, motn-10]

# Dependency graph
requires:
  - phase: 59-02
    provides: "PhysicPaintRotoRailMotionRecord/Channel/Key types, the five-channel id union and the parser caps the evaluator consumes"
provides:
  - "RAIL_MOTION_IDENTITY_TRANSFORM: the frozen identity returned by reference on the absent/empty path"
  - "evaluateRailMotionChannel: per-channel evaluation with endpoint hold, outgoing-key easing, seeded wiggle and appearance clamps"
  - "evaluateRailMotion: the frozen RailMotionTransform (translateX/Y, scale, rotationRadians, opacity) with the ONE degrees -> radians conversion"
  - "resolveRailLocalFrame: the only appFrame - railStart subtraction, clamped at 0, throwing on non-finite input"
  - "railMotionWiggleAt: FNV-1a seeded, stateless, smoothstep-interpolated noise in [-1, 1]"
  - "buildRailMotionCurvePath: the lane SVG path sampled through the evaluator, design-token pitch, 4096-sample budget and explicit hold steps"
affects: [59-08, 59-09, 59-10, 59-12]

actuals:
  tokens: 8177
  tasks: 3
  commits: 6

plan_head_before: d259b78123f61912dbef44942bf1aa0569bd7d5d
plan_head_after: 63758648b79b029689951342c9ee14683d04981e

tech-stack:
  added: []
  patterns:
    - "Single interpolation authority: every consumer imports evaluateRailMotionChannel, and the lane builder samples THROUGH it, so a second interpolation cannot exist without deleting this module"
    - "Outgoing-key segment semantics: the key at or before the frame owns the span (hold/ease/wiggle), which makes endpoint hold, hold steps and wiggle attachment fall out of one rule"
    - "Stateless seeded noise: hash(railId|channelId|keyFrame) plus the integer frame seeds one fresh Random per sample, so no sequential PRNG state can leak between edit, Play and export"
    - "Options bag with design-token defaults: the documented 3-argument buildRailMotionCurvePath call keeps working while pitch and railId stay overridable"

key-files:
  created:
    - app/src/components/physic-paint/roto/railMotionEvaluator.ts
    - app/src/components/physic-paint/roto/railMotionEvaluator.test.ts
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-05-task1.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-05-task2.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-05-task3.json
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-05-task1.xml
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-05-task2.xml
    - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-05-task3.xml
  modified: []

key-decisions:
  - "The evaluator imports TIMELINE_GEOMETRY from ../view/timelineRailDesign rather than hard-coding 18: the module is pure data (one type-only import, no Preact/store/DOM), and Task 3 explicitly names it as the single source. The Task 1 'no view imports' wording is superseded by the more specific Task 3 instruction; documented as a deviation"
  - "Appearance clamps live at the channel level, not the transform level: opacity clamps to 0..1, scale floors at 0, position and rotation stay free. The lane curve and the applied transform therefore see identical values by construction"
  - "The pre-first-key span carries no wiggle because it has no outgoing key: that span must hold the first value exactly, and the outgoing-key rule expresses it without a special case"
  - "Wiggle samples the two neighbouring integer frames and smoothsteps between them: integer frames stay bit-exact across consumers (edit/Play/export) and fractional frames cannot jitter"
  - "The lane builder adds key frames (plus frame - epsilon before a hold key) on top of a strided uniform grid, so a step renders as two points at the same x and long rails are strided, never truncated"
  - "Rotation converts degrees -> radians exactly once, inside evaluateRailMotion; the channel value stays in degrees everywhere else and no consumer converts"
  - "Requirements MOTN-03/05/06/09/10 left pending, matching the 59-01/59-02/59-03 precedent: this plan delivers the evaluation layer, but the user-facing animate command (59-07/59-12), store wiring (59-08), export sampling (59-09) and lane UI (59-10) are not in this plan, and only live UAT closes user-facing rows"

patterns-established:
  - "Evaluator purity gate: the header states the contract and the acceptance grep proves no Math.random, Date.now or performance.now exists in the module"
  - "Curve-from-evaluator parity: the lane path is a client of evaluateRailMotionChannel, and the test suite pins the same transform by calling the public evaluator with the same record and railId"
  - "Compiling RED stubs: each TDD task starts from a compiling placeholder, so every RED failure is a named assertion failure rather than an import or build fault"

requirements-completed: []

coverage:
  - id: D1
    description: "Absent, empty or channel-less records return identity; the frozen identity is returned by reference and the assembled transform is frozen"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts#rail motion channel evaluation (identity-by-reference, absent channels, frozen transform)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Endpoint hold, hold steps, smoothstep ease (no overshoot, exact endpoints), single-key hold and grouped Position independence"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts#rail motion channel evaluation (endpoint hold, hold step, smoothstep, single key, grouped Position)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Rotation is unbounded and linear in degrees with exactly one conversion to radians on the transform surface"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts#rail motion channel evaluation > unbounded rotation"
        status: pass
    human_judgment: false
  - id: D4
    description: "Wiggle is a pure deterministic function of (railId, channel, key frame, evaluated frame): seed separation, repeatability, integer-frame smoothness, outgoing amplitude and zero-amplitude exactness"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts#rail motion wiggle (10 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Lane curve: M/L path format, design-token pitch, SPECS display ranges, hold steps, evaluator parity, 4096-sample cap, explicit pitch/laneHeight overrides"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts#rail motion lane curve (10 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Rail-local frame = appFrame - railStart clamped at 0; non-finite inputs throw"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/railMotionEvaluator.test.ts#rail motion rail-local frame resolution"
        status: pass
    human_judgment: false
  - id: D7
    description: "Purity: no Math.random / Date.now / performance.now, and imports are limited to the core Random, the pure design-token data and model types"
    verification:
      - kind: other
        ref: "grep -c 'Math.random\\|performance.now\\|Date.now' railMotionEvaluator.ts -> 0; imports checked: Random, TIMELINE_GEOMETRY, model types only"
        status: pass
    human_judgment: false

duration: ~8min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 05: Rail-Motion Evaluator Summary

**One pure interpolation authority for rail motion: endpoint hold, hold/ease segments, unbounded rotation, stateless seeded wiggle and a lane curve sampled from the same evaluator — no store, signal, Preact or compositor import.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-11-06T13:14:58Z
- **Completed:** 2026-11-06T13:20Z (last task commit) + summary/state writes
- **Tasks:** 3
- **Files modified:** 2 source files (both created), plus 6 RED evidence artifacts

## Accomplishments

- `evaluateRailMotion` and `evaluateRailMotionChannel` now resolve every motion channel from a `PhysicPaintRotoRailMotionRecord`: the absent or empty record returns the frozen `RAIL_MOTION_IDENTITY_TRANSFORM` by reference, so the common no-motion path allocates nothing and downstream consumers can compare by reference.
- Endpoint semantics are explicit and tested: before the first key the first value holds, at or after the last key the last value holds, a `hold` key steps, and an `ease` key runs the monotone smoothstep `t*t*(3-2t)` — exact at both endpoints, no overshoot.
- Rotation is deliberately unbounded and linear in degrees (0→360 passes through 180; −90, 360 and 720 are ordinary values) and is converted to radians exactly once, inside `evaluateRailMotion`. No consumer converts.
- `resolveRailLocalFrame` is the only place the rail-local subtraction lives: `Math.max(0, appFrame - railStart)`, throwing on non-finite input instead of guessing at a malformed time.
- Wiggle is a pure function of `(railId, channelId, keyFrame, evaluated frame)`: an FNV-1a 32-bit hash of the seed components plus the integer frame seeds one fresh `Random(...).nextFloat(-1, 1)` per sample, and the two neighbouring integer samples are smoothstepped. There is no sequential PRNG state, no wall-clock time and no unseeded randomness, so edit, Play and export agree bit for bit.
- `buildRailMotionCurvePath` draws the lane from the evaluator itself: one sample per frame through `evaluateRailMotionChannel`, x = frame × the design-token pitch (18), y mapped from the SPECS display ranges, a 4096-sample cap with striding instead of truncation, and an explicit left-limit sample before a hold key so a step renders as two points at the same x. The suite pins evaluator parity with the applied transform.
- Purity is proven, not asserted: the module imports only `Random` from the core package, the pure `TIMELINE_GEOMETRY` data block and model types; `grep -c "Math.random\|performance.now\|Date.now"` is 0.

## Task Commits

Each TDD task committed RED then GREEN atomically:

1. **Task 1 RED: add failing rail motion evaluator pins** - `37fa2e8aa` (test)
2. **Task 1 GREEN: implement the pure rail motion channel evaluator** - `13c042b19` (feat)
3. **Task 2 RED: add failing rail motion wiggle pins** - `717083ab8` (test)
4. **Task 2 GREEN: implement the seeded smooth rail motion wiggle** - `77c3533b6` (feat)
5. **Task 3 RED: add failing lane curve path pins** - `7125e870f` (test)
6. **Task 3 GREEN: sample the lane curve path from the one evaluator** - `63758648b` (feat)

**Plan metadata:** `docs(59-05): complete rail-motion evaluator plan` (final commit)

_Note: TDD tasks have multiple commits (test → feat)._

## RED Evidence

All three RED gates were validated by `gsd_run check tdd-red-evidence` with verdict `RED_EVIDENCE_OK` (`target_test_failed`, JUnit format, zero report errors):

| Task | Records | Target test | Outcome |
|------|---------|-------------|---------|
| 1 | 13 tests, 1 pass / 12 fail | `rail motion channel evaluation > eases between two keys with a monotone smoothstep that hits both endpoints` | `expected +0 to be 15.625` against the stub |
| 2 | 20 tests, 17 pass / 3 fail | `rail motion wiggle > seeds differently per rail, channel and key frame` | `expected +0 not to be +0` against the constant-zero stub |
| 3 | 29 tests, 20 pass / 9 fail | `rail motion lane curve > emits an explicit vertical step at a hold key frame` | `expected -1 to be greater than 0` against the placeholder path |

Every named target compiled, executed and failed on its planned assertion — no build, import, collection or fixture faults.

## Files Created/Modified

- `app/src/components/physic-paint/roto/railMotionEvaluator.ts` — identity transform, segment resolution (endpoint hold, hold/ease, outgoing key), channel clamps, per-channel and whole-record evaluation, rail-local frame resolution, display ranges/y formatting, curve frame collection and path builder, FNV-1a seed hash and stateless smooth wiggle. No store, signal, Preact, compositor or DOM import.
- `app/src/components/physic-paint/roto/railMotionEvaluator.test.ts` — 29 tests across channel evaluation, wiggle determinism/seed separation/smoothness, lane curve format/ranges/hold steps/parity/cap, and rail-local frame resolution.
- `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence-59-05-task{1,2,3}.json` + `red-evidence/red-59-05-task{1,2,3}.xml` — validated RED records with the complete JUnit reports embedded.

## Decisions Made

- **Design-token import over a literal 18.** `TIMELINE_GEOMETRY` comes from `../view/timelineRailDesign`, a pure data module with a single type-only import. This honors Task 3's "the design token is the single source; do not write a literal 18" and keeps `buildRailMotionCurvePath(channel, railFrameCount, laneHeight)` callable with three arguments by 59-10. See deviation 1.
- **Clamps at the channel level.** Opacity is clamped to 0..1 after wiggle (the seeded noise can push a legal key past a bound), scale is floored at 0 (a negative scale would mirror the raster, not a shipped behavior), and position/rotation stay unclamped. Because the clamp happens before the value leaves the channel, the drawn curve and the applied transform cannot disagree.
- **Outgoing-key semantics is the whole segment rule.** The key at or before the evaluated frame owns the span. The pre-first-key hold is the one span without an outgoing key and therefore carries no wiggle amplitude; every other span attaches the outgoing key's wiggle. One rule covers endpoint hold, hold steps and wiggle attachment.
- **Stateless noise.** A hash-derived seed plus the integer frame creates a fresh `Random` per sample; interpolation between the two neighbouring integer samples uses the same smoothstep as the ease curve. Integer frames are therefore bit-exact across consumers and fractional frames are smooth by construction.
- **Curve budget favors correctness.** Key frames are always drawn (bounded by the parser's 4096-key cap); the uniform grid is strided to fit the remaining budget. A hold key contributes an additional `frame − 1e-6` sample so the step has a vertical segment rather than a slope.
- **Requirements left pending.** MOTN-03/05/06/09/10 describe user-visible behavior. The evaluation layer is necessary but not sufficient: the animate command (59-07/59-12), store transform wiring (59-08), export sampling (59-09) and the lane UI (59-10) land later, and only live UAT closes them. Following the 59-01/59-02/59-03 precedent, no requirement was falsely flipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Design-token import contradicts the Task 1 "no view imports" wording**
- **Found during:** Task 3 implementation
- **Issue:** Task 1's acceptance wording says "no store/view/DOM imports", while Task 3's action says to import `TIMELINE_GEOMETRY` from `../view/timelineRailDesign` ("the design token is the single source; do not write a literal 18"). The two instructions cannot both be satisfied literally.
- **Fix:** imported `TIMELINE_GEOMETRY` from the pure data module. It has a single type-only import, exports frozen data only, and carries no Preact/store/DOM import; other roto modules already import from `../view/`. A literal 18 would violate the single-source rule, and a required 4th pitch parameter would break 59-10's documented 3-argument call.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionEvaluator.ts`
- **Verification:** targeted suite 29/29; typecheck clean; purity grep 0; the design-token default is pinned by a test.
- **Committed in:** `63758648b`

### Process deviations (additive, no behavior outside the planned contract)

**2. Added an optional `RailMotionCurvePathOptions` 4th parameter**
- **Found during:** Task 3 (lane curve design)
- **Issue:** the lane preview must reproduce the seed of the record whose transform is applied, and tests need to override the pitch; a hard-coded preview railId and a fixed pitch could not express either.
- **Resolution:** `buildRailMotionCurvePath(channel, railFrameCount, laneHeight?, options?)` with `{ cellPitch?, railId? }`. Both default to the design token / a preview railId, so the documented three-argument signature and every planned assertion still hold.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionEvaluator.ts`
- **Verification:** explicit-pitch, explicit-laneHeight, design-token-default and `{ railId }` parity tests all pass.

**3. Compiling RED stubs instead of missing modules**
- **Found during:** Task 1 RED
- **Issue:** a nonexistent module would fail RED on an import error, which the plan's gate cannot distinguish from an unvalidated assertion.
- **Resolution:** each task's RED started from a compiling placeholder (identity returns, wiggle returning 0, path returning `'M0,0'`), so each RED record shows a named target test failing on its planned assertion.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionEvaluator.ts` (stub stages only)
- **Verification:** all three records validated `RED_EVIDENCE_OK`.

**4. Acceptance grep tripped by a doc comment**
- **Found during:** Task 2 GREEN verification
- **Issue:** the wiggle doc comment contained the literal text "`Math.random`", so `grep -c "Math.random\|performance.now\|Date.now"` returned 1 where the plan requires 0.
- **Resolution:** rewrote the comment to "no wall-clock time, no unseeded randomness, no carried state"; the code was never affected.
- **Files modified:** `app/src/components/physic-paint/roto/railMotionEvaluator.ts`
- **Verification:** grep count 0.

**Total deviations:** 1 auto-fixed (Rule 3) + 3 process notes. **Impact on plan:** no behavioral scope change — every planned artifact, truth and prohibition landed; the options parameter is additive and the design-token decision resolves a plan-internal contradiction in favor of the single-source rule.

## Issues Encountered

- The plan-internal import contradiction (deviation 1) required a judgment call; resolved toward the pure design-token module and documented here.
- No source-behavior issues: all three GREEN implementations passed their suites on the first run after each RED was validated.
- Verification at HEAD: targeted file 29/29 pass; full suite 380 files / 7471 passed | 1 skipped | 96 todo; `pnpm --filter efx-motion-editor run typecheck` exit 0; purity grep 0.

## Threat Surface Scan

The plan's threat register is fully mitigated: T-59-13 (no non-finite value can escape — fractional and negative frames are tested, non-finite frame/railStart throw, and opacity/scale clamps bound the wiggle), T-59-14 (no second interpolation exists; the lane builder samples through `evaluateRailMotionChannel`, pinned by an evaluator-parity test), T-59-15 (wiggle is a pure function of its arguments with a stable FNV-1a seed; no `Math.random`, `Date.now` or `performance.now` anywhere in the module). T-59-SC: no install — the only import beyond model types and the design token is the already-vendored core `Random`. No network endpoint, auth path or trust-boundary surface was added; the module is pure and reads no store, signal, Preact component, compositor or DOM state.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- 59-08 can import `evaluateRailMotion` and `resolveRailLocalFrame` directly; the transform is frozen and the identity path is reference-stable, which suits an idempotent store setter.
- 59-09 can call `evaluateRailMotion` at fractional times for sub-frame export sampling; determinism is proven at fractional frames and across interleaved evaluations.
- 59-10 can call `buildRailMotionCurvePath(modelChannel, railFrameCount, laneHeight)` with three arguments, or pass `{ railId }` to reproduce the applied wiggle seed; the pitch comes from `TIMELINE_GEOMETRY`.
- 59-12 can obtain the evaluator-derived sibling value for a grouped Position `set-key` via `evaluateRailMotionChannel(record, 'position-y', frame)`, which matches the `pairedValue` contract from 59-02.
- No blockers.

---

*Phase: 59-rail-motion-channels-v7-interface*
*Completed: 2026-11-06*

## Self-Check: PASSED

- `railMotionEvaluator.ts`, `railMotionEvaluator.test.ts`, all three RED evidence records and their JUnit XML exist at the recorded paths.
- Commits `37fa2e8aa`, `13c042b19`, `717083ab8`, `77c3533b6`, `7125e870f` and `63758648b` are ancestors of `HEAD`.
- Targeted verify: 29/29 tests pass; full suite 380 files / 7471 passed | 1 skipped | 96 todo; typecheck exit 0; purity grep = 0.
