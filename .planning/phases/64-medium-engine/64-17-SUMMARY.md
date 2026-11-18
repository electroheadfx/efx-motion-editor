---
phase: 64-medium-engine
plan: 17
subsystem: testing
tags: [watercolor, coverage-composite, pigment-alpha, probe-harness, pixel-gate, headless-chrome, spike-001, tdd]

# Dependency graph
requires:
  - phase: 64-13
    provides: the coverage composite (ink/fixed/cover source-over), the `pigment` export and mode-4's coverage-aware alpha
  - phase: 64-10
    provides: the probe comparator contract (bakeMs/renderMs printed, never compared) and the `--size` operand
provides:
  - four-digest captures (paper/transparent/white/pigment) with capture-side enforcement and one named reference-legacy exception
  - the 1080² Body-0 identity law (`watercolor-50`) and the cover-0 pigment reference (`neutral-pigment`)
  - Spike 001 criterion 1 as a standing gate (`white-over-blue` at Body 100/60/30 plus `SCENARIO_INVARIANTS`)
  - a `cover-over-wet` gate re-specified for the coverage model, both erase-era directional claims retired, baseline re-captured
affects: [64-14, 64-16]

# Actuals (#2632) — measured on the same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 20875
  tasks: 3
  commits: 8
plan_head_before: 07c493c8c9c3f7e5d32911a77386ae1ee5b62ed4
plan_head_after: 7ba11e607b19850d97f4f0a19e17249545569ad8

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-text contract pins for an untyped probe harness: harness.test.ts reads the three harness files and asserts exact literals, so the probe's shape is gated by vitest without a tsc project"
    - "Capture-side digest enforcement: run.mjs refuses a capture missing any of the four digests, so a broken export fails the run instead of being compared on the remaining fields"
    - "Reference-legacy exception as data: one named baseline, one named field, committed-baseline mode only, printed by name on every run"
    - "Self-contained pixel invariants: a gate asserts outcome inequalities on its own capture, never a direction against a historical reference whose engine model no longer exists"

key-files:
  created:
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts
    - packages/efx-watercolor/probe/medium-engine/baselines/neutral-pigment.json
    - packages/efx-watercolor/probe/medium-engine/baselines/watercolor-50.json
    - packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json
    - .planning/phases/64-medium-engine/64-17-red-evidence-task1.json
    - .planning/phases/64-medium-engine/64-17-red-evidence-task2.json
  modified:
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json

key-decisions:
  - "Both erase-era directional claims are retired, not only the clamped-subtract one: the coverage crossing reads 49.66 against the prefix reference's 34.05 and the subtract reference's 30.74 — ABOVE both — because the covering stroke now deposits its own near-opaque body (own-pigment 3.47 -> 14.54), so a direction against either reference no longer measures the erased underlayer (user decision, Rule 4)."
  - "coverCrossPigment >= coverOwnPigment: the coverage composite can leave the crossing within rounding of the covering stroke alone (residual underlayer under the same `a`), never blanker."
  - "The cover-over-wet digest moved with 64-13's coverage model, not with this plan's drive cadence: removing the trailing rapid-entry fix leaves the export byte-identical (bf0793e3 / 674df400 / abeaf060 / 048928e4 both ways), because the covering stroke already fixes after itself."
  - "The two historical captures stay --differs-from digest anchors only; no numeric substitute claim is attached to the subtract reference, and the prefix reference carries none either."

patterns-established:
  - "Replace-then-recapture: when the engine's model changes under a committed pixel gate, re-specify the gate's prose and invariants in one commit, then commit the re-captured baseline pointing at that harness commit, leaving historical references untouched"

requirements-completed: [MED-20, MED-21, MED-25]

coverage:
  - id: D1
    description: "Every probe report digests the mode-4 pigment sheet; run.mjs refuses a capture missing any of the four digests; compare.mjs compares digestPigment strictly except on the one pre-field baseline (neutral-identity), which prints as not-compared in committed-baseline mode only"
    requirement: MED-20
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#the pigment sheet is digested and required"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity (digestPigment absent on the baseline, printed, PASS)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 1080² Body-0 identity law: the spike's 50-rapid-stroke passage reproduces 2b4a86d7 / 7f56e401 / bc74be59 and repeats exactly, committed as watercolor-50"
    requirement: MED-20
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#the watercolor-50 scenario is the spike script verbatim"
        status: pass
      - kind: integration
        ref: "run.mjs --gate watercolor-50 --scenario watercolor-50 --size 1080 && compare.mjs watercolor-50"
        status: pass
    human_judgment: false
  - id: D3
    description: "The cover-0 pigment reference: neutral-pigment's three backgrounds equal neutral-identity's committed digests and a same-session --other compare passes on all seven fields"
    requirement: MED-20
    verification:
      - kind: integration
        ref: "run.mjs --gate neutral-pigment --size 256 && compare.mjs neutral-pigment && compare.mjs neutral-pigment --other neutral-identity"
        status: pass
    human_judgment: false
  - id: D4
    description: "Spike 001 criterion 1 as a standing gate: white-over-blue at Body 100 commits coverage-derived alpha (0.98 vs darkness 0.05), bodies 60 and 30 pass their own bars, nothing reads covered paper-white, and an unlisted body fails"
    requirement: MED-21
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#the white-over-blue matrix (64-17 task 2)"
        status: pass
      - kind: integration
        ref: "run/compare white-over-blue body 100 + repeat + --differs-from for bodies 60 and 30"
        status: pass
    human_judgment: false
  - id: D5
    description: "cover-over-wet re-specified for the coverage model: narrative names the composite, the deleted snapshot identifier is absent from all three harness files, the four self-contained region invariants hold on a re-captured baseline, and both historical references stay digest-only anchors"
    requirement: MED-21
    verification:
      - kind: integration
        ref: "compare.mjs cover-over-wet / --other / --differs-from cover-over-wet-prefix / --differs-from cover-over-wet-subtract"
        status: pass
      - kind: other
        ref: "test \"$(cat probe.ts run.mjs compare.mjs | grep -c 'preInk')\" = 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cost evidence stays recorded and never gated: every report carries bakeMs and renderMs, printed beside the digests on every gate run"
    requirement: MED-25
    verification:
      - kind: integration
        ref: "run.mjs output lines 'bake: N ms' / 'render: N ms' on every capture; compare.mjs prints both captures' durations"
        status: pass
    human_judgment: false

# Metrics
duration: 32min
completed: 2026-11-18
status: complete
---

# Phase 64 Plan 17: Coverage-model acceptance on the production probe

**The probe now digests the mode-4 coverage sheet, pins the Body-0 identity law at 1080², turns Spike 001's criterion-1 matrix into a standing gate with committed baselines, and re-specifies the last erase-era gate for the coverage composite with both directional claims retired.**

## Performance

- **Duration:** 32 min (first task commit to completion; tasks 1-2 ran in a prior executor session, task 3 in this one)
- **Started:** 2026-11-18T17:46:02Z
- **Completed:** 2026-11-18T18:17:57Z
- **Tasks:** 3 of 3
- **Files modified:** 10

## Accomplishments

- Every report carries `digestPigment` from `engine.exportCanvas('pigment')`; run.mjs requires four digests, and compare.mjs compares the fourth strictly everywhere except the one committed baseline that predates the export (`neutral-identity`, printed as `absent … not compared` in committed-baseline mode only).
- The 1080² Body-0 identity law is committed: `watercolor-50` reproduces the verdict's `2b4a86d7 / 7f56e401 / bc74be59` and repeats exactly; `neutral-pigment` equals `neutral-identity`'s three backgrounds in the same session and records `digestPigment 13b8af1d`.
- Spike 001 criterion 1 is a standing gate. Measured triples: Body 100 `241.41/241.58/242.09` (blue excess 0.68, `crossCoverAlpha` 0.98 vs `crossDarkAlpha` 0.05); Body 60 `217.92/231.89/249.15` (excess 31.23, alphas 0.23 vs 0.15); Body 30 `211.62/229.94/252.69` (excess 41.07, alphas 0.17 vs 0.17). `coveredPaperWhitePct` is 0 at every body.
- `cover-over-wet` is re-specified for the coverage model and re-captured: crossing 49.66 | own 14.54 | under 84.68 | paper 0 (the rev-4 erase-era capture read 33.99 | 3.47 | 55.36 | 0). Both erase-era directional claims are retired; the prefix and subtract captures remain digest-differs anchors only.
- Both Body-0 identity gates were re-proved after the re-capture: `neutral-identity` at 256² and `watercolor-50` at 1080² pass on every field.

## Task Commits

Each task was committed atomically (TDD tasks carry their RED/GREEN pair plus a baseline commit):

1. **Task 1: pigment digest + 1080² Body-0 identity law** — `566e176ef` (test — RED), `da6ddeaef` (feat — GREEN), `877b147e0` (feat — baselines)
2. **Task 2: white over blue at Body 100/60/30** — `9fadccb1e` (test — RED), `4a54aa411` (feat — GREEN), `32a0b080e` (feat — baseline)
3. **Task 3: cover-over-wet re-specified, erase-era prose retired** — `d4ba048fa` (feat — harness), `7ba11e607` (feat — re-captured baseline)

**Plan metadata:** the docs commit that carries this SUMMARY.

## Files Created/Modified

- `packages/efx-watercolor/probe/medium-engine/probe.ts` — `digestPigment`, per-entry `settle`, rapid-entry drive cadence, `watercolor50Script`, `whiteOverBlueScript` + metrics, rewritten cover-over-wet narrative
- `packages/efx-watercolor/probe/medium-engine/run.mjs` — four-digest guard, `watercolor-50` / `white-over-blue` scenario list, printed `digestPigment`, rewritten cover-over-wet header
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` — `digestPigment` field + reference-legacy rule, `SCENARIO_INVARIANTS` scenario dispatch, self-contained cover-over-wet invariants, retired `COVER_CROSS_DIRECTION`
- `packages/efx-watercolor/probe/medium-engine/harness.test.ts` — 16 source-text contract rows pinning the harness shape
- `packages/efx-watercolor/probe/medium-engine/baselines/neutral-pigment.json` — cover-0 pigment reference at 256²
- `packages/efx-watercolor/probe/medium-engine/baselines/watercolor-50.json` — 1080² Body-0 identity law
- `packages/efx-watercolor/probe/medium-engine/baselines/white-over-blue.json` — Body-100 criterion-1 baseline (the only committed body)
- `packages/efx-watercolor/probe/medium-engine/baselines/cover-over-wet.json` — re-captured under the coverage model, superseding the 261117-tq7 rev-4 capture
- `.planning/phases/64-medium-engine/64-17-red-evidence-task1.json`, `…-task2.json` — persisted RED evidence

## Decisions Made

- Retire BOTH erase-era directional claims rather than only the subtract one (see Deviations; user decision after measurement).
- Relax crossing-vs-own to `>=` — the composite's residual underlayer under the same `a` can leave the crossing within rounding of the covering stroke alone.
- Attribute the cover-over-wet digest move to 64-13's coverage model, not the 64-17 drive: removing the trailing rapid-entry fix reproduces the identical four digests (`cover-over-wet-notrail` capture vs the committed one).
- Keep durations printed and never compared (64-10 contract) — every gate run reports bake/render beside the digests.

## TDD Gate Compliance

- Task 1 (`tdd="true"`): RED `566e176ef` (`test(64-17): pin the pigment digest and the watercolor-50 scenario`, 9/9 target rows failing on missing source text; `gsd_run check tdd-red-evidence` recorded in `64-17-red-evidence-task1.json`) → GREEN `da6ddeaef`.
- Task 2 (`tdd="true"`): RED `9fadccb1e` (16 collected, 7 new rows failing on missing source text; record in `64-17-red-evidence-task2.json`) → GREEN `4a54aa411`.
- Task 3 (`type="auto"`, no `tdd` attribute): no RED/GREEN pair required; its absence gate lives in the plan's `<verify>` by design ("not to a test file").

## Deviations from Plan

### Rule 4 — Architectural/acceptance change (user decision)

**1. [Rule 4 - Acceptance contract] Both erase-era directional claims retired, not just the clamped-subtract one**
- **Found during:** Task 3 (cover-over-wet re-specification)
- **Issue:** The plan (and this plan's own must-have) expected the `'cover-over-wet-prefix': 'erased'` claim to survive and the subtract claim to be retired because the crossing would read "well BELOW the subtract reference by construction". The engine falsified that: under the coverage composite the crossing reads 49.66, i.e. ABOVE the prefix reference's 34.05 and the subtract reference's 30.74, because the covering stroke now commits its own near-opaque body (own-pigment 3.47 → 14.54). A "reads below the prefix" claim is therefore impossible without widening nothing and measuring nothing.
- **Fix:** Per the user's explicit decision (Option A), both `COVER_CROSS_DIRECTION` entries were removed, `COVER_CROSS_MARGIN` and the `requireGain` direction logic deleted, and the four self-contained region invariants kept unchanged (`own > 0`, `cross >= own`, `cross < under`, `paper < cross`). The retirement reason is recorded in `compare.mjs` and `run.mjs` with the MEASURED inversion (crossing 49.66 against 34.05 / 30.74 — above both, own-pigment 3.47 → 14.54), never the plan's invented "below" reason. Both historical captures remain `--differs-from` digest anchors; no numeric substitute claim was attached to either.
- **Files modified:** `packages/efx-watercolor/probe/medium-engine/compare.mjs`, `run.mjs`, `probe.ts`, `baselines/cover-over-wet.json`
- **Verification:** `--differs-from cover-over-wet-prefix` and `--differs-from cover-over-wet-subtract` both PASS on three differing digests and four region invariants; the counting gate `preInk` = 0; both Body-0 identity gates PASS.
- **Committed in:** `d4ba048fa`, `7ba11e607`

**2. [Rule 2 - Correctness] Corrected task-1's digest attribution in the probe header**
- **Found during:** Task 3 (prose re-specification)
- **Issue:** The 64-17 task-1 header attributed the cover-over-wet digest change to the new rapid-entry drive cadence ("its trailing fix re-settles mobile ink"). The trailing fix is a no-op for this scenario: removal produces byte-identical output (`cover-over-wet-notrail` = `bf0793e3 / 674df400 / abeaf060 / 048928e4`).
- **Fix:** The header now states the digest moved when 64-13 landed the coverage composite, not from the drive.
- **Files modified:** `packages/efx-watercolor/probe/medium-engine/probe.ts`
- **Verification:** the notrail capture's four digests equal the committed baseline's, and `compare.mjs cover-over-wet` passes.
- **Committed in:** `d4ba048fa`

**Total deviations:** 2 (1 Rule 4 user-decided acceptance change, 1 Rule 2 prose correction).
**Impact on plan:** The task-3 acceptance contract is amended by explicit user decision: the retired claim set is {prefix-erased, subtract-survives}, not {subtract-survives} alone. The plan's `<fails_when>` clause "the prefix directional claim is weakened" is superseded and does not fail this execution. No engine, shader or package source was touched, and no bar was widened.

## Issues Encountered

- The full app suite (`pnpm --filter efx-motion-editor exec vitest run`) reports one unrelated failing file, `app/src/lib/physicPaintBridge.test.ts` (unhandled error attributed to the WR-04 catalog-publish row), reproducible in full-suite runs but passing 186/187 in isolation. Out of scope for this plan (probe harness only) and logged in `deferred-items.md`. Every other file passed, including this plan's `harness.test.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 64-14 and 64-16 can compare against the committed `watercolor-50` (1080²) and `white-over-blue` (body 100) baselines.
- 64-16 extends `SCENARIO_INVARIANTS` with `cover-textured` and `red-over-blue-50`; the dispatch runs in every comparison mode and fails an unlisted body.
- The `cover-over-wet` gate no longer carries any directional claim against the two historical captures — they are digest anchors only.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-18*

## Self-Check: PASSED

- All eight files created or modified by this plan exist on disk.
- All eight task commits (566e176ef, da6ddeaef, 877b147e0, 9fadccb1e, 4a54aa411, 32a0b080e, d4ba048fa, 7ba11e607) are ancestors of HEAD.
