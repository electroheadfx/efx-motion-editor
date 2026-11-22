---
phase: 64-medium-engine
plan: 29
subsystem: testing
tags: [webgl2, headless-chrome, probe, pixel-gate, tdd, bristle, texture-mask, edge-census]

# Dependency graph
requires:
  - phase: 64-medium-engine
    provides: the bristle-line scenario and acrylic bag (64-23/64-24), the wet-timestamp law, and the GAP-4 texture-tip shader composition
provides:
  - a baseline-free bristle-line gate (rim / halo / enclosure on postApply / postSettle / postFix) plus the `--over` understory leg
  - four edge-census shape scalars per Feather level and per-stroke half-widths (irregularity / roughness / support / fringe density)
  - the `bristle-tip` A/B scenario, the `--texture` operand, the requested/carried/tipMix/bands echoes and a reference-aware band bar
  - recorded HEAD measurements for 64-32 / 64-33 / 64-34 / 64-35, including the two failing states those plans must move
affects: [64-32, 64-33, 64-34, 64-35, 64-36]

# Actuals (#2632) — same scale as the plan's estimate (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 26526
  tasks: 3
  commits: 6

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Baseline-free gates: same-session twin comparison (--other) + --differs-from digest difference, never a committed baseline"
    - "Scenario-keyed invariants evaluated in every compare mode, now reference-aware for A/B bars"
    - "Deterministic probe-owned masks registered through the shipped registry (length contract exercised, not bypassed)"

key-files:
  created: []
  modified:
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts

key-decisions:
  - "The bristle-line gate is judged against its own twin, never a committed baseline (none exists until 64-36)"
  - "Edge shape scalars are derived per stroke from the existing 24-station walk; the support fraction is a constant (EDGE_SUPPORT_FRACTION 0.02), not a new station grid"
  - "tipMix is resolved through buildBrushForStroke — the engine's own fallback law — instead of re-deriving mask resolution in the probe"
  - "The band bar is reference-aware: it fires only when the actual is masked AND the reference is a plain bristle-tip capture, so identical-twin --other stays clean"
  - "The masked capture's failure to add bands at HEAD is recorded as 64-35's finding; no engine code was touched"

patterns-established:
  - "Fail-loud registration: a refused registerMask throws instead of capturing the fallback as the mask"
  - "One-line TAP helpers for every executed comparator case (multi-line assertion messages break RED reports)"
  - "Committed readings in doc blocks are the evidence a later plan moves against"

requirements-completed: [MED-18, MED-21, MED-31]

coverage:
  - id: D1
    description: "A bristle-line gate that fails today on rim/halo/enclosure and is proven baseline-free via same-session twins, including the --over understory"
    requirement: MED-18
    verification:
      - kind: unit
        ref: "probe/medium-engine/harness.test.ts#the bars discriminate (64-29 task 1, executed)"
        status: pass
      - kind: other
        ref: "node compare.mjs bristle-line --other bristle-line-twin → 0 differing fields, 12 INVARIANT lines (recorded HEAD state)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The edge census emits irregularity, roughness, support, fringe density and per-stroke half-widths for both Feather levels"
    requirement: MED-21
    verification:
      - kind: unit
        ref: "probe/medium-engine/harness.test.ts#the four synthetic profiles resolve to four distinct patterns"
        status: pass
      - kind: other
        ref: "bristle-edge-1080 twin: 0/26 differing edge+digest fields"
        status: pass
    human_judgment: false
  - id: D3
    description: "The texture-tip A/B: deterministic registered mask, echoes, unknown-id fallback proof, reference-aware band bar"
    requirement: MED-31
    verification:
      - kind: unit
        ref: "probe/medium-engine/harness.test.ts#the synthetic captures split pass from fail (executed) — the texture-tip A/B block, 10 executed cases"
        status: pass
      - kind: other
        ref: "node compare.mjs bristle-tip-mask --differs-from bristle-tip-plain → 3 digests differ, equal dimensions, band bar FAILS 1 vs 1 (the recorded 64-35 finding)"
        status: pass
    human_judgment: true
    rationale: "The masked capture registers (tipMix 1) but adds no separated bands at HEAD; a human must confirm that recording this as 64-35's finding (rather than fixing engine code here) is the intended disposition."
  - id: D4
    description: "No baseline and no engine change: the plan touches only the four probe files"
    verification:
      - kind: other
        ref: "git status --porcelain packages/efx-watercolor/probe/medium-engine/baselines → empty"
        status: pass
    human_judgment: false

# Metrics
duration: 24min
completed: 2026-11-22
status: complete
commits: 6
plan_head_before: 5d7a744eb95babfec4b0f7bf69949115a3f051ed
plan_head_after: 36696cab933d31c3851905cd2f73bc9ee908425e
---

# Phase 64 Plan 29: The acrylic instruments — bristle-line gate, edge census shape scalars, texture-tip A/B

**Three GAP-5-era instruments on one probe surface: a baseline-free bristle-line rim/halo/enclosure gate (which fails today), an edge census that separates irregular from aliased from graded, and a texture-tip A/B whose unknown-id leg is proven to fall back byte-for-byte — with the mask-not-composing state recorded for 64-35.**

## Performance

- **Duration:** ~24 min (first-to-last plan commit, 2026-11-22 19:18–19:42 +01:00)
- **Started:** 2026-11-22T18:18:00Z (Task 1 RED)
- **Completed:** 2026-11-22T18:41:52Z (Task 3 GREEN)
- **Tasks:** 3 (3 TDD pairs, 6 commits)
- **Files modified:** 4

## Accomplishments

- Task 1 (tracer): the bristle-line gate walks rim, halo and enclosure on the transparent export across postApply / postSettle / postFix, plus the `--over` wet understory leg; twin-proven deterministic and baseline-free. At HEAD it reports **12 scenario invariant failures** (halo peakRel 0.4628 down / 0.4493 up vs the 0.4 cap; runs 3/4 vs the 2-row max) — the recorded defect 64-32/64-33/64-34 must move.
- Task 2: the edge census gains `irregularityPx`, `roughnessPx`, `supportPx`, `fringeDensityPct` and per-stroke half-widths at Feather 0 and 100, all derived from the existing 24-station walk. HEAD readings: Feather 0 — softness 20.27, variation 0.08, irregularity 0.04, roughness 0.08, support 0.31, density 0 %, half-width 28.09, plateau 0.10 (6/24 dash-gap skips); Feather 100 — softness 1.87, variation 4.38, irregularity 1.82, roughness 2.26, support 0.29, density 35 %, half-width 19.57, plateau 0.09 (4/24 skips).
- Task 3: the `bristle-tip` scenario paints one bristle-flat line twice, once through the deterministic `probe/tip-ab` mask (512×512, index arithmetic only, registered through the shipped `registerMask` before the first stroke). The plain leg reports tipMix 0 / bands 1; the masked leg tipMix 1 / bands 1 with **3 differing digests at equal 1080×1080**; the unknown `probe/does-not-exist` leg reports tipMix 0 with its named note and is **byte-identical on all four digests to the plain leg** — the fallback is proven, not assumed.
- A/B finding recorded for 64-35: the mask registers and moves pixels (masked profile is a uniformly attenuated copy of the plain one, ~6 % at the core), but it adds **no separated dark bands** — 1 vs 1 at every stripe geometry tried (row 64, row 256, column 64). The reference-aware bar fires so this state cannot pass silently. No engine code was touched.
- Harness: 104/104 tests pass; `pnpm run check` clean; the masked capture is twin-identical (7/7 fields) and the plain/masked/unknown captures are byte-stable across re-runs.

## Task Commits

Each task committed atomically (RED then GREEN):

1. **Task 1: The bristle-line gate — rim, halo and enclosure on a real capture** — `43d7c0899` (test), `bed9e8d40` (feat)
2. **Task 2: The edge census gains irregularity, roughness, support and per-stroke half-width** — `fec7a9b20` (test), `f1e783db2` (feat)
3. **Task 3: The texture-tip A/B — a registered mask against the response tip** — `f86435c68` (test), `36696cab9` (feat)

**Plan metadata:** (this SUMMARY's docs commit, recorded in the orchestrator's log)

_Note: every task was `tdd="true"`; each has a RED commit with validated evidence under `.gsd/tdd-evidence/64-29/`._

## Files Created/Modified

- `packages/efx-watercolor/probe/medium-engine/probe.ts` — bristle-line rim/halo/enclosure walk + `--over`; `edgeProfileStats` and the ten census emissions; the `bristle-tip` section (mask builder, registry call, script, band metric, report echoes)
- `packages/efx-watercolor/probe/medium-engine/run.mjs` — `bristle-line`/`bristle-tip` closed list, `--over`, `--stroke-size`, `--band`, `--mut`, `--texture` (bristle-tip only) and the page-query plumbing
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` — `bristleLineFailures` bars, `bristleTipFailures` bars, reference-aware `scenarioInvariantFailures`, `printBristleTip`, recorded HEAD readings
- `packages/efx-watercolor/probe/medium-engine/harness.test.ts` — 84 → 104 tests: the bristle-line synthetic split, the census direction pins, the texture-tip contract (37 laws) and 10 executed A/B cases

## Decisions Made

- Twin-first proof: no committed baseline exists for any of the three gates, so every real-capture claim rides `--other` twin equality plus `--differs-from` digest difference; nothing under `baselines/` moved.
- `tipMix` is read through `buildBrushForStroke` — the engine's own projection — so the probe reports the engine's actual fallback instead of a re-derived guess.
- The band bar is reference-aware (masked actual + plain reference only), keeping same-session and committed-baseline modes honest.
- HEAD readings are recorded in the doc blocks of the metric they move, so a later plan must re-record deliberately.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 2 comparator phrases split across template lines**
- **Found during:** Task 2 (edge-census bars)
- **Issue:** Harness pins require one literal phrase; two template literals broke `non-negative roughness` and the `64-34 owns the roughness ceiling` note across source lines (and a doc comment, which the harness strips).
- **Fix:** Joined the phrases into single-line literals in the runtime failure strings.
- **Files modified:** `compare.mjs`
- **Committed in:** `f1e783db2`

**2. [Rule 2 - Missing Critical] Task 2 widened the edge-capture contract without extending its own fixture**
- **Found during:** Task 2 GREEN
- **Issue:** `validEdgeCapture()` lacked the ten new required fields, so the pre-existing "passes a clean capture" case would fail on shape.
- **Fix:** Extended the base fixture with the ten fields and a coherent mean half-width (31.99).
- **Files modified:** `harness.test.ts`
- **Committed in:** `f1e783db2`

**3. [Rule 1 - Bug] Task 3 A/B helper restored equal digests**
- **Found during:** Task 3 GREEN
- **Issue:** The A/B helper spread the caller's reference AFTER the synthetic differing digests; every reference is built from `baseCapture`, so it silently restored the capture's own digests and the "adds two bands" pass case could never pass.
- **Fix:** The helper now controls the reference digests itself (synthetic differing triple by default, the capture's own triple only under an explicit `sameDigests` flag used by the identical-triple failure case).
- **Files modified:** `harness.test.ts`
- **Committed in:** `36696cab9`

**4. [Fixture conformance] Two pre-existing harness pins updated to the extended source**
- **Found during:** Task 3 GREEN
- **Issue:** `scenarioInvariantFailures(actual)` gained a reference operand, and the `resolvedBrush` default chain gained `bristle-tip`; both are pinned verbatim by 64-17/64-16 pins.
- **Fix:** Updated both pinned literals with an in-test comment stating the intent is unchanged; the `brush: resolvedBrush ?? null` echo pin still passes.
- **Files modified:** `harness.test.ts`
- **Committed in:** `36696cab9`

### Recorded, not fixed (plan prohibitions)

**5. bristle-edge-1080 committed baseline drift**
- **Found during:** Task 2 verification
- **Issue:** A fresh 1080 capture reads softness 20.27/1.87 and plateau 0.10/0.09, where the committed baseline records 20.28/25.11 and 0.13/0.16 — pre-existing engine drift from 64-24..64-28, outside this probe-only plan.
- **Disposition:** Twin-proven deterministic (0/26 differing fields); the readings are recorded in the census doc block. Baselines are not touched (64-36 owns them).

**6. The texture-tip mask does not compose as band structure at HEAD**
- **Found during:** Task 3 acceptance runs
- **Issue:** `bristle-tip-mask` reports tipMix 1 but tipBands 1, identical to the plain leg, and the A/B band bar fires (1 vs 1). The mask's bytes reach the capture (digests differ; profile uniformly attenuated ~6 %) but do not resolve as separated runs at any stripe period tried.
- **Disposition:** Recorded in `probe.ts` and `compare.mjs` doc blocks and raised to the broken-windows ledger as 64-35's finding. No engine code changed.

**7. The bristle-line gate fails its own bars at HEAD (12 invariants)**
- **Found during:** plan-level verification
- **Issue:** halo peakRel 0.4628/0.4493 vs HALO_PEAK_MAX 0.4 and runs 3/4 vs HALO_RUN_MAX 2 on all three surfaces; the bars were authored in Task 1 to fail today so 64-32/64-33/64-34 cannot regress silently.
- **Disposition:** The twin still proves determinism (0 differing fields); the failing state is the recorded HEAD truth.

---

**Total deviations:** 4 auto-fixed (2 bug, 1 missing-critical, 1 fixture-conformance) + 3 recorded-not-fixed by plan prohibition
**Impact on plan:** No engine behaviour, no baseline, no scope creep. The three recorded states are exactly the evidence the next plans consume.

## Issues Encountered

- The committed `bristle-line` bars cannot pass at HEAD; acceptance for this plan rests on determinism plus the bars firing. Documented rather than worked around.
- The Task 3 mask geometry was iterated empirically (row/column stripes, periods 64/256) before accepting the no-bands result; the failed variants were not committed.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready: all three instruments are dispatched from the scenario table, pinned by the harness, and have recorded HEAD readings.
- 64-35 inherits the texture-tip finding (mask registers, no separated bands); 64-32/64-33/64-34 inherit the failing bristle-line bars; 64-36 inherits the untouched baselines and the 64-29 shape scalars.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-22*

## Self-Check: PASSED

- All 6 plan commits are ancestors of HEAD.
- All 4 modified probe files exist.
- `.gsd/tdd-evidence/64-29/` holds the three RED records and TAP logs.
