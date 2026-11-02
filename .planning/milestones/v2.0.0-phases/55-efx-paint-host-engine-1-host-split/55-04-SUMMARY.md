---
phase: 55-efx-paint-host-engine-1-host-split
plan: 04
subsystem: packages
tags: [tick-grid, HOST_TICK_HZ, cuisson, diffusionFrames, DATA-03, D-20, D-23, integer-ticks]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split (55-03)
    provides: StudioStroke<P> schedule contract (cuisson field) + script payload seam
provides:
  - "HOST_TICK_HZ = 60 integer tick grid (DATA-03 / D-23) in packages/efx-paint-host/src/time/ticks.ts"
  - "Uncapped cuisson tick-budget mechanism (D-20) in packages/efx-paint-host/src/time/diffusion.ts"
  - "Public re-exports from packages/efx-paint-host/src/time/index.ts and src/index.ts"
affects: [55-05, 55-06, 55-07, 55-08, 55-09, 56-efx-watercolor]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
actuals:
  tokens: 5377
  tasks: 2
  commits: 2
  plan_head_before: d7b2bea543d4aacb8ee9df7a5a79d5b27c7cd8d1
  plan_head_after: 7b084208ab892f571e9e63907673f0b893748513

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Integer tick domain law: public timing APIs take/return non-negative integer ticks; named RangeError (never silent coercion) on non-finite / negative / fractional input"
    - "Host mechanism vs engine policy split: cuisson tick budget is host-owned and uncapped; clampCuissonTicks requires caller-supplied bounds (no host default max)"

key-files:
  created:
    - packages/efx-paint-host/src/time/ticks.ts
    - packages/efx-paint-host/src/time/diffusion.ts
    - packages/efx-paint-host/src/time/index.ts
    - packages/efx-paint-host/src/time/ticks.test.ts
  modified:
    - packages/efx-paint-host/src/index.ts

key-decisions:
  - "HOST_TICK_HZ resolved to 60 (D-23 plan-time item): 1 tick = 1/60 s; ticksFromSeconds(0.5) === 30 is the law"
  - "secondsFromTicks also rejects negative integer ticks as out-of-range (superset of the plan's fractional/non-finite cases) — matches must_have 'out-of-range or non-finite input is rejected by a named rule'"
  - "snapSampleToTick clamps negative seconds to tick 0 (named clamp rule) and throws on non-finite; nearest integer via Math.round"
  - "cuissonTicks returns the stroke budget unchanged with NO upper ceiling — cuisson 10000 proves the host never bakes in the engine-1 frame cap (D-20)"
  - "clampCuissonTicks is a pure range clamp requiring caller min/max; host exports carry no default maximum"
  - "rg \"600\" packages/efx-paint-host/src/time acceptance gate is literal: comments and test names in time/ must not contain the digits 600"

patterns-established:
  - "Host time law: integer ticks only, named RangeError domain door, mechanism/policy split for cuisson"

requirements-completed: [DATA-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Fixed integer tick grid at HOST_TICK_HZ = 60 with ticksFromSeconds / secondsFromTicks / snapSampleToTick; never raw ms (DATA-03 / D-23)"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "packages/efx-paint-host/src/time/ticks.test.ts#HOST_TICK_HZ is the constant 60"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/time/ticks.test.ts#ticksFromSeconds(0.5) returns 30 ticks at 60 Hz"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/time/ticks.test.ts#secondsFromTicks(30) returns 0.5 seconds"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/time/ticks.test.ts#snapSampleToTick(0.501) snaps to the nearest tick 30"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/time/ticks.test.ts#ticksFromSeconds(Number.NaN) throws a named RangeError"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/time/ticks.test.ts#secondsFromTicks(1.5) throws a named RangeError (fractional ticks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Host-owned diffusion/cuisson tick-budget mechanism with no host ceiling; clampCuissonTicks is caller-bounded (D-20)"
    requirement: "DATA-03"
    verification:
      - kind: unit
        ref: "packages/efx-paint-host/src/time/ticks.test.ts#cuissonTicks({ cuisson: 10000 }) returns 10000 unchanged (no host ceiling)"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/time/ticks.test.ts#clampCuissonTicks(5, 1, 3) clamps to the caller-supplied max 3"
        status: pass
      - kind: unit
        ref: "packages/efx-paint-host/src/time/ticks.test.ts#clampCuissonTicks(0, 1, 3) clamps to the caller-supplied min 1"
        status: pass
      - kind: other
        ref: "rg \"600\" packages/efx-paint-host/src/time → no matches (engine ceiling stays engine-side)"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-10-15
status: complete
---

# Phase 55 Plan 04: Integer Tick Grid and Uncapped Cuisson Summary

**Host time law landed: HOST_TICK_HZ = 60 integer tick grid plus an uncapped cuisson tick-budget mechanism, proven RED→GREEN (DATA-03 / D-20 / D-23)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-10-15T06:40:04Z
- **Completed:** 2026-10-15T06:44:13Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `HOST_TICK_HZ = 60` fixed integer tick grid with `ticksFromSeconds` / `secondsFromTicks` / `snapSampleToTick` — public timing APIs take and return integer ticks, never raw milliseconds (DATA-03 / D-23)
- Domain door is named and total: non-finite, negative, or fractional tick input throws `RangeError`; `snapSampleToTick` clamps negative sample seconds to tick 0 by a named rule
- `cuissonTicks` returns the stroke's non-negative integer budget with **no host ceiling** — `cuisson: 10000` passes through unchanged (D-20)
- `clampCuissonTicks` is a pure range clamp that requires the engine's own min/max — the host exports no default maximum
- Re-exported from `time/index.ts` and `src/index.ts`; `rg "600" packages/efx-paint-host/src/time` is clean (engine-1 ceiling stays engine-side)
- 55-01 golden pin (6 tests) and 55-09 residue pin (5 tests) remain green

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED | `b785071d` test(55-04): add failing test for integer tick grid and uncapped cuisson | RED_EVIDENCE_OK |
| GREEN | `7b084208` feat(55-04): implement integer tick grid and uncapped cuisson mechanism | 14/14 pass |
| REFACTOR | — | Not needed |

**RED evidence:** 14 tests failed on `./ticks must export ticksFromSeconds: expected undefined to be type of 'function'` (and the matching `./diffusion` missing-export assertions) — a missing-module target assertion, not a syntax/collection error. 1 test file collected (14 tests). Classifier verdict: `RED_EVIDENCE_OK` (`target_test_failed`). Record at `.planning/phases/55-efx-paint-host-engine-1-host-split/55-04-red-evidence.json`.

**Semantic assessment:** Target test executed and failed on the planned assertion — the named exports are undefined because `./ticks` and `./diffusion` do not exist yet. All 14 failing tests name the missing export. Not a syntax error, not a collection error, not a fixture crash.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED: integer tick grid and uncapped cuisson cases** - `b785071d` (test)
2. **Task 2: GREEN: implement ticks.ts + diffusion.ts (no host cap)** - `7b084208` (feat)

## Files Created/Modified
- `packages/efx-paint-host/src/time/ticks.ts` - HOST_TICK_HZ + integer tick conversion helpers (DATA-03 / D-23)
- `packages/efx-paint-host/src/time/diffusion.ts` - uncapped cuisson mechanism + caller-bounded clamp (D-20)
- `packages/efx-paint-host/src/time/index.ts` - time surface re-exports
- `packages/efx-paint-host/src/time/ticks.test.ts` - RED/GREEN coverage (14 tests)
- `packages/efx-paint-host/src/index.ts` - package entry re-exports the time law

## Decisions Made
- HOST_TICK_HZ resolved to 60 (D-23 plan-time item): 1 tick = 1/60 s
- `secondsFromTicks` rejects negative integer ticks as out-of-range (superset of the plan's fractional/non-finite cases) — matches the must_have "out-of-range or non-finite input is rejected by a named rule"
- `snapSampleToTick` clamps negative seconds to 0 (named clamp rule); non-finite throws
- `cuissonTicks` never ceilings: the engine-1 frame cap stays in `packages/efx-physic-paint` (DIFFUSION_CAP / engine clamp sites) — host mechanism only (D-20)
- The `rg "600"` acceptance gate is literal: comments and test names inside `time/` must not contain the digits 600

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Host time law is green and re-exported; 55-05+ can consume `HOST_TICK_HZ` / tick helpers / `cuissonTicks` from `@efxlab/efx-paint-host`
- Engine-1's 600 ceiling remains engine-side and must not migrate into the host
- Ready for 55-05

---
*Phase: 55-efx-paint-host-engine-1-host-split*
*Completed: 2026-10-15*

## Self-Check: PASSED

- Created files exist: ticks.ts, diffusion.ts, index.ts, ticks.test.ts, 55-04-SUMMARY.md
- Commits exist on HEAD: `b785071d` (RED), `7b084208` (GREEN)
- TDD gates present: `test(55-04):` and `feat(55-04):` in git log
- ticks.test.ts 14/14 green; typecheck exit 0; `rg "600" packages/efx-paint-host/src/time` clean
- 55-01 golden pin + 55-09 residue pin green
