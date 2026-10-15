---
phase: 55-efx-paint-host-engine-1-host-split
plan: 09
subsystem: testing
tags: [host-split, residue-pin, clean-break, HOST-01, standing-contract, package-surface]

# Dependency graph
requires:
  - phase: 55-efx-paint-host-engine-1-host-split (55-02)
    provides: Atomic animation/ move + 13-site consumer re-point (old dir deleted, dual ./animation export dropped)
provides:
  - "Standing HOST-01 animation-residue + package-surface lock pin (hostAnimationResidueContract.test.ts)"
  - "Matcher self-test proving an in-memory plant of the retired engine-1 animation subpath is caught"
affects: [55-03, 55-04, 55-05, 55-06, 55-07, 55-08]

# Actuals (#2632)
actuals:
  tokens: 2606
  tasks: 1
  commits: 1
  plan_head_before: 34a4666c344a0e2ce160710cf108487b999767fd
  plan_head_after: 4615382e8b6ca373cfadbb69813b7d1750dc26a7

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standing residue pin: comment-stripped zero-match gate + package.json/tsup/dir existence checks in the paintVersionDisciplineContract / efxPaintCleanBreakContract family"
    - "Needle assembled at runtime (['@efxlab/efx-physic-paint', 'animation'].join('/')) so the pin's own source never carries the contiguous specifier outside comments"

key-files:
  created:
    - app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts
  modified: []

key-decisions:
  - "PINS_GREEN_AT_BIRTH recorded honestly — 55-02's atomic move landed, so the pin is born green; detection is proven by an in-memory matcher self-test instead of manufacturing a red against production code"
  - "Comment stripping (the readFileSync idiom of grep -v header-comment filtering) runs before every zero-match gate so this file's own header prose naming the retired subpath cannot self-invalidate the count"
  - "This plan touched no production source — a red pin routes to a 55-02 gap, never a local re-point (55-09 must never unbreak 55-02)"

patterns-established:
  - "Residue lock pin family member: allowlist self + comment-strip + runtime-assembled needle + matcher self-test"

requirements-completed: [HOST-01]

coverage:
  - id: D1
    description: "Standing HOST-01 animation-residue + package-surface lock pin green at birth on the post-move tree (zero engine-1 animation subpath matches, no ./animation export, no animation tsup entry, old dir deleted, host animation/index.ts present)"
    requirement: "HOST-01"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts (5 tests)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/preSplitGoldenParity.test.ts (6 tests, golden pin still green)"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-10-15
status: complete
---

# Phase 55 Plan 09: Standing Animation-Residue Lock Pin Summary

**HOST-01 clean-break guard: standing residue + package-surface lock pin green at birth after 55-02's atomic move**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-15T06:26:11Z
- **Completed:** 2026-10-15T06:33:05Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Wrote `app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts` — a standing pin in the `paintVersionDisciplineContract` / `efxPaintCleanBreakContract` family that locks 55-02's atomic move as a lasting invariant
- The pin asserts five lock points: (1) zero engine-1 animation subpath matches under `app/` and `packages/` source after comment stripping; (2) engine-1 `package.json` has no `exports['./animation']` key and declares `@efxlab/efx-paint-host` as `workspace:*`; (3) engine-1 `tsup.config.ts` has no `animation` entry; (4) `packages/efx-physic-paint/src/animation/` does not exist; (5) `packages/efx-paint-host/src/animation/index.ts` exists
- Green at birth (`PINS_GREEN_AT_BIRTH`) on the post-move tree — recorded honestly, not manufactured
- Matcher self-test proves detection on an in-memory plant (a planted import is caught; header-comment prose is not; the host-owned subpath does not trip the engine-1 needle)
- Live plant/unplant verification: a planted consumer import and a re-added `./animation` export key each flip the pin red; removing the plant returns it to green
- Zero production source changed — `git diff` for this plan is exactly the pin file

## Task Commits

Each task was committed atomically:

1. **Task 1: Standing animation-residue + package-surface lock pin** - `4615382e` (test)

**Plan metadata:** (committed after this SUMMARY)

## Files Created/Modified

- `app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts` - Standing HOST-01 residue + package-surface lock pin (comment-stripped zero-match gate, package.json/tsup/dir checks, matcher self-test)

## Decisions Made

- **PINS_GREEN_AT_BIRTH, honestly recorded:** 55-02's atomic move+re-point landed correctly (verified: zero remaining `@efxlab/efx-physic-paint/animation` references, old dir deleted, export dropped). Manufacturing a red by breaking production code would be theater; instead the pin carries a matcher self-test that proves detection on an in-memory plant.
- **Comment stripping before every zero-match gate:** the readFileSync idiom of `grep -v` header-comment filtering. This file's header names the retired subpath for humans; the stripper removes comment prose so the pin cannot self-invalidate. The needle is also assembled at runtime (`['@efxlab/efx-physic-paint', 'animation'].join('/')`) so the contiguous specifier never appears in code.
- **Self-allowlist, matching the family:** `efxPaintCleanBreakContract.test.ts` allowlists itself; this pin does the same so a future failure-message string mentioning the specifier cannot false-fail the gate.
- **No production edits under any outcome:** a red pin is a 55-02 execution gap. This plan must never be the plan that unbreaks 55-02.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The HOST-01 clean-break guard is now standing: any future re-introduction of the engine-1 animation subpath (import, mock target, export key, tsup entry, or directory) fails the suite loudly.
- 55-01's golden pin remains green alongside (6/6 tests) — the refactor guard for the rest of the phase.
- Remaining plans (55-04 through 55-08) are unaffected; this plan touched no production surface they depend on.

---
*Phase: 55-efx-paint-host-engine-1-host-split*
*Completed: 2026-10-15*

## Self-Check: PASSED

- FOUND: `app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts`
- FOUND: task commit `4615382e`
- Re-run residue pin + golden pin: 2 files / 11 tests passed
- Live plant/unplant: planted consumer import flipped pin red; planted `./animation` export key flipped pin red; removal returned green
- `git status` after commit: clean (no untracked leftovers from plant verification)
