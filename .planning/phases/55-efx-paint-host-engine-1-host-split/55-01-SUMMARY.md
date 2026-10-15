---
phase: 55-efx-paint-host-engine-1-host-split
plan: 01
subsystem: testing
tags: [golden-fixture, parity-pin, host-split, roto-script, traceSeed, animation-schedules]

# Dependency graph
requires:
  - phase: 54-preact-11-update
    provides: Preact 11 workspace bump closed; Phase 55 hard gate cleared
provides:
  - "Pre-split golden replay fixture (RotoPaintScript + baked RGBA frames) at app/src/efx-paint/host-split/preSplitGoldenFixture.ts"
  - "Standing delta-zero HOST-03 parity pin at app/src/efx-paint/host-split/preSplitGoldenParity.test.ts"
  - "Shared deterministic bake entry (schedule + held-pose + traceSeed mirrors) both capture and pin re-run"
affects: [55-02, 55-03, 55-04, 55-05, 55-06, 55-07, 55-08, 55-09]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 31551
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standing golden parity pin: pure fixture data + shared deterministic bake entry + delta-zero re-bake comparison naming the drifted frame"

key-files:
  created:
    - app/src/efx-paint/host-split/preSplitGoldenFixture.ts
    - app/src/efx-paint/host-split/preSplitGoldenParity.test.ts
  modified: []

key-decisions:
  - "D-04 sequencing held: golden captured entirely on pre-split code before any module move — capture-after-move would be split-vs-itself"
  - "Fixture stores RotoPaintScript (renderer runtime input), not PersistedRotoScriptV1 — 55-05's envelope cutover does not rewrite these golden files"
  - "Shared bake entry driven by production animation schedules + transformRecordedStrokeForHeldPose + traceSeed mirrors (hashMutationId/seededRng); capture and pin share one entry"
  - "PINS_GREEN_AT_BIRTH recorded honestly: preservation pin, never manufactured red by breaking production code"
  - "D-01 held: parity oracle never imports or calls the engine-1 tier-parity metrics helper family"

patterns-established:
  - "Golden parity pin family: pure data fixture + one bake entry + compare helper that names drifted frame index and pixel-delta count"

requirements-completed: [HOST-03]

coverage:
  - id: D1
    description: "Recorded engine-1 RotoPaintScript fixture with progressive, playFrame-anchored, diffusionFrames-tail, erase, and held-pose coverage plus pre-split baked RGBA frames"
    requirement: "HOST-03"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/host-split/preSplitGoldenParity.test.ts#re-bakes every stored frame at delta zero on pre-split code (PINS_GREEN_AT_BIRTH)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/preSplitGoldenParity.test.ts#keeps the fixture script as RotoPaintScript runtime input (not PersistedRotoScriptV1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Standing delta-zero replay parity pin green at birth on pre-split code, naming drifted frame index and pixel-delta count"
    requirement: "HOST-03"
    verification:
      - kind: unit
        ref: "app/src/efx-paint/host-split/preSplitGoldenParity.test.ts#names the drifted frame index and pixel-delta count on a forced expected-pixel mutation"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/preSplitGoldenParity.test.ts#never imports or calls the engine-1 tier-parity metrics helper (D-01)"
        status: pass
      - kind: unit
        ref: "app/src/efx-paint/host-split/preSplitGoldenParity.test.ts#rejects a wiped golden (empty frames cannot false-green the pin)"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-10-15
status: complete
---

# Phase 55 Plan 01: Pre-split golden capture Summary

**Pre-split golden RotoPaintScript fixture with baked RGBA frames plus a standing delta-zero HOST-03 parity pin, captured before any module move**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-15T05:06:32Z
- **Completed:** 2026-10-15T05:17:21Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Recorded one engine-1 `RotoPaintScript` with broad seam coverage (D-02): progressive paint primary + point continuation, playFrame-anchored paint, paint + positive `diffusionFrames` tail, erase primary, and a held-pose/motion-wiggle paint stroke — every stroke seeded through `hashMutationId` / `seededRng`
- Baked that script on pre-split code through one shared deterministic entry (production `buildProgressiveStrokeSchedule` / `buildStaticStrokeSchedule` / `getProgressiveFrameStrokes` / `getStaticFrameStrokes` / `transformRecordedStrokeForHeldPose` + traceSeed mirrors) at 48x48, storing per-frame RGBA base64 + SHA-256 digests for progressive (5 frames) and static (3 frames) modes
- Stood up the standing delta-zero parity pin `preSplitGoldenParity.test.ts` (6 tests, green at birth) that re-bakes the fixture and names the drifted frame index and pixel-delta count on mismatch

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "pre-split golden bake"** - `73ef9d56` (test)
2. **Task 2: Standing delta-zero replay parity pin** - `d4c471c4` (test)

**Plan metadata:** (committed after this SUMMARY)

_Note: Task 1 is a tracer whose `<verify>` runs the pin, so the end-to-end slice (fixture + pin) landed together; Task 2 hardened the pin with the PINS_GREEN_AT_BIRTH record and the non-empty-golden false-green guard._

## Files Created/Modified

- `app/src/efx-paint/host-split/preSplitGoldenFixture.ts` - Pure golden fixture: recorded `RotoPaintScript`, bake configs, baked RGBA frames/digests, shared deterministic bake entry, compare helper (names drifted frame + pixel-delta count), pure loader. Trace-seed mirrors (fnv1a/hashMutationId/seededRng) kept byte-aligned with `packages/efx-physic-paint/src/util/traceSeed.ts` by a source-scan pin.
- `app/src/efx-paint/host-split/preSplitGoldenParity.test.ts` - Standing HOST-03 delta-zero replay parity pin (PINS_GREEN_AT_BIRTH). Re-bakes the fixture, asserts non-empty goldens, names drifted frame index on forced mutation, pins the RotoPaintScript runtime shape, forbids the tier-parity metrics helper (D-01), and scans the trace-seed mirrors against the package source.

## Decisions Made

- **D-04 sequencing held:** the golden was captured entirely on pre-split code (commit `73ef9d56`) before any module move — a capture after the move would be split-vs-itself and prove nothing.
- **Runtime shape, not on-disk shape:** the fixture stores `RotoPaintScript` (what `physicsPaintRotoPlayScriptRenderer.ts` actually bakes), not `PersistedRotoScriptV1`. 55-05's persisted-format envelope cutover does not rewrite these golden files.
- **One bake entry:** capture and pin both call `bakePreSplitGoldenFrames` — no divergent capture path. The entry is driven by the production animation schedule family (the host-split move surface) plus `transformRecordedStrokeForHeldPose`, rasterized through a seeded deterministic deposit keyed by `hashMutationId` / `seededRng`.
- **PINS_GREEN_AT_BIRTH:** the pin is green at birth on unchanged pre-split sources. No red was manufactured by breaking production code.
- **D-01 independent oracle:** neither the fixture nor the pin imports or calls the engine-1 tier-parity metrics helper family.

## Deviations from Plan

None - plan executed exactly as written.

**Task-file note (not a deviation):** Task 1 is a `type="tracer"` whose `<verify>` runs `preSplitGoldenParity.test.ts`, so the end-to-end slice necessarily includes the pin file listed under Task 2. The pin was therefore landed with the tracer commit (`73ef9d56`) and Task 2 (`d4c471c4`) hardened it (PINS_GREEN_AT_BIRTH record + non-empty-golden false-green guard). Task 2's acceptance criteria were all verified.

## Issues Encountered

- First D-01 source scan self-matched its own doc comments (`tier-parity metrics` / the helper symbol in prose). Fixed by constructing the forbidden symbol so the scan source cannot contain it, and by stripping the literal helper name from the fixture header comment. Not a plan deviation — test-harness tightening during Task 2.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Golden fixture and standing pin are live under `app/src/efx-paint/host-split/` and collected by `pnpm --filter efx-motion-editor exec vitest run`.
- Ready for 55-02 (animation/ + traceSeed extraction): the pin is the refactor guard — any schedule/transform/seed drift flips it and names the drifted frame.
- Phase remains automated-ready until later plans and live UAT (A1–A4) close.
- HOST-03 flagged assumption recorded in the plan (edge probe unclassified) stays covered by this standing pin plus the future live UAT row A4 (save/reopen replay parity).

---
*Phase: 55-efx-paint-host-engine-1-host-split*
*Completed: 2026-10-15*

## Self-Check: PASSED

- FOUND: `app/src/efx-paint/host-split/preSplitGoldenFixture.ts`
- FOUND: `app/src/efx-paint/host-split/preSplitGoldenParity.test.ts`
- FOUND: `app/src/efx-paint/host-split/55-01-SUMMARY.md`
- FOUND: task commit `73ef9d56`
- FOUND: task commit `d4c471c4`
- Re-run `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/host-split/preSplitGoldenParity.test.ts` — 1 file / 6 tests passed
- Re-run plan verification: `git diff --name-only` shows zero `packages/` paths across the plan
