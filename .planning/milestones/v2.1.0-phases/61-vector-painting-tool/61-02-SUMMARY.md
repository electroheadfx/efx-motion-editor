---
phase: 61-vector-painting-tool
plan: 02
subsystem: testing
tags:
  - watercolor
  - vector-spine
  - catmull-rom
  - arc-length
  - sparse-width
  - determinism-contract
  - tdd

# Dependency graph
requires:
  - phase: 61-01
    provides: "Wave-0 verdict (seam strategy, replay density 4x, reference stroke count, width channel on sizeMult) — binding on the width law's multiplier vocabulary"
provides:
  - "packages/efx-watercolor/src/vector/spine.ts — Vec2 / VectorAnchorKind / VectorAnchor / ResolvedAnchorHandles / SampledVectorPath, the auto-handle law, arc-length evaluation and the sparse width law with constants every later plan imports"
  - "resolveAnchorHandles / sampleVectorPath / pathLength — the one handle and station authority 61-09's overlay reads"
  - "clampAnchorWidth / anchorWidthAt / sampleVectorWidths / isUniformWidthProfile — the width law 61-03 persists and 61-04 feeds into the script sample"
  - "determinismContract.test.ts now scans src/vector with a zero-file guard"
affects:
  - 61-03 (re-exports VectorAnchor as AquarelleAnchor; D-10's sparse profile is the persisted shape)
  - 61-04 (calls sampleVectorWidths per recorded point)
  - 61-09 (reads resolveAnchorHandles and sampleVectorPath)

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 8204
  tasks: 3
  commits: 5
plan_head_before: de9e84d289748dcc6ce3b1e3b47df624dc0691c8
plan_head_after: d5c9c33413af0190ee5ce34bfd18c928cd4c308e

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "Derived-not-stored handles: an auto anchor stores no handle data; both handles are recomputed from the normalised neighbour list on every evaluation"
  - "One-division handle arithmetic — (n·P ∓ Δ) / n instead of P ∓ Δ/n — so the exact rational handles round once and hydrate re-derivation is bit-identical"
  - "One arc-length walk (walkPath) emits points, stations and per-anchor stations together; every consumer indexes that list, never a second sampler"
  - "Effective-factor width model: absent reads ANCHOR_WIDTH_DEFAULT and participates in interpolation at its own anchor station (D-10), so the profile never needs a parallel index array"
  - "Scratch RED stub: when a brand-new module cannot even load, an uncommitted shape-only stub lets the target tests execute and fail on assertions so the #3770 gate accepts the RED evidence"
  - "JUnit XML RED evidence for Vitest: the strict TAP parser rejects Vitest's multi-line YAML diagnostics, so the classifier is fed --reporter=junit output untouched"

key-files:
  created:
  - packages/efx-watercolor/src/vector/spine.ts
  - packages/efx-watercolor/src/vector/spine.test.ts
  modified:
  - packages/efx-watercolor/src/determinismContract.test.ts

key-decisions:
  - "The auto handles are computed as (n·P ∓ Δ)/n with n = 6 interior and n = 3 at the endpoints, because the plan's goldens pin the correctly-rounded rationals (4/6 = 0.6666666666666666, 8/6 = 1.3333333333333333) and P − Δ/n rounds to the midpoint instead."
  - "anchorWidthAt treats an anchor without a factor as the default 1 and interpolates it at that anchor's own station; the plan's 'hold the nearest defined factor' wording is satisfied by the ends holding the first/last anchor's factor, which is what the plan's own behaviour bullets assert (1 at both ends of a mid-list 1.8)."
  - "sampleVectorWidths maps each point to its arc-length station through the sampled polyline's nearest point, with a uniform-profile fast path that returns exact 1s; points past the end read the final factor."
  - "VECTOR_DIR is built from the existing PKG_DIR (join(PKG_DIR, 'src', 'vector')) because the contract file is ESM and has no __dirname."
  - "Reduced-motion-free module: spine.ts imports nothing at all, so REL-01's dependency pin and the engine-1 direction pin are untouched by construction."

patterns-established:
  - "A pure geometry module declares its laws in the header and keeps every later consumer on one authority (handles, stations, width)."
  - "TDD RED evidence for a new module needs the module to exist as a scratch stub; the committed RED carries only the test."

requirements-completed: [VEC-01, VEC-03]

coverage:
  - id: D1
    description: "Two anchor kinds evaluate through one handle law: auto anchors derive both handles from their neighbours, bezier anchors round-trip their stored handles, and the goldens are asserted as literals"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/vector/spine.test.ts#resolveAnchorHandles — the auto-smooth law"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/vector/spine.test.ts#resolveAnchorHandles — bezier anchors"
        status: pass
    human_judgment: false
  - id: D2
    description: "An anchor list evaluates to a continuous spine with strictly increasing arc-length stations, duplicate and degenerate input falling back instead of producing NaN"
    requirement: VEC-01
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/vector/spine.test.ts#sampleVectorPath"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/vector/spine.test.ts#degenerate anchor lists"
        status: pass
    human_judgment: false
  - id: D3
    description: "Sparse per-anchor width: absent reads 1, interpolation is linear on arc length, ends hold, and a 1.8 factor passes through with no clamp below 2.0"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/vector/spine.test.ts#clampAnchorWidth / #isUniformWidthProfile / #anchorWidthAt / #sampleVectorWidths"
        status: pass
    human_judgment: false
  - id: D4
    description: "The determinism contract scans src/vector from the same commit, with a zero-file guard so a rename cannot silently empty the scan"
    requirement: VEC-03
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#unseeded RNG source scan"
        status: pass
      - kind: unit
        ref: "packages/efx-watercolor/src/vector/spine.test.ts#determinism scan coverage"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-11-10
status: complete
---

# Phase 61 Plan 02: Vector Spine Geometry Summary

**The phase's one geometry module lands golden-pinned: auto anchors derive their handles from neighbours (`(n·P ∓ Δ)/n`), the arc-length station list is the single ordering authority, and the sparse width law carries a 1.8 factor through untouched — with the unseeded-RNG scan widened to `src/vector` in the same plan.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-10T12:34:52Z
- **Completed:** 2026-11-10T12:38:27Z
- **Tasks:** 3 (2 TDD cycles, 1 scan-widening task)
- **Files created/modified:** 3

## Accomplishments

- `src/vector/spine.ts` is a zero-import pure module that owns the three laws every later plan indexes into: derived handles, arc-length stations, sparse width.
- Handle goldens are pinned as literals, not descriptions: middle anchor `1.3333333333333333 / 0.6666666666666666`, endpoints `0.3333333333333333 / 1.6666666666666667`, with bezier anchors round-tripping their stored handles including zero-length corners.
- `normaliseVectorAnchors` drops duplicates and non-finite anchors before evaluation, so the centripetal tangent division can never see a zero-length neighbour and the evaluator can never emit NaN.
- The sparse width law reads absent as 1, interpolates linearly on arc length (the quarter station of a mid-list 1.8 reads the literal `1.4`), holds the end factors, and reports a uniform profile so a plain stroke stores nothing (D-10).
- `determinismContract.test.ts` now scans `src/vector` beside `src/engine` and `src/payload`, with a zero-file guard that names `spine.ts`; a temporary `Math.random()` injected into the module fails the contract (verified by hand and reverted).

## Task Commits

Each task was committed atomically; both TDD tasks carry a RED then a GREEN commit:

1. **Task 1 RED: failing pin for the auto-handle law and station ordering** - `c9ec612f2` (test)
2. **Task 1 GREEN: evaluate anchors into a spine with derived handles and stations** - `7cdfd6d86` (feat)
3. **Task 2 RED: failing pin for the sparse width law** - `0ae7cfb38` (test)
4. **Task 2 GREEN: interpolate the sparse width profile on arc length** - `3981f17da` (feat)
5. **Task 3: widen the unseeded-RNG scan to src/vector** - `d5c9c3341` (test)

**Plan metadata:** included in the `docs(61-02)` completion commit.

## TDD Gate Compliance

| Gate | Evidence |
|------|----------|
| Task 1 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `resolveAnchorHandles — the auto-smooth law > derives the middle anchor handles from its neighbours`. 17 tests ran, 12 failed on assertion diffs. |
| Task 1 GREEN | `vitest run src/vector/spine.test.ts` → 17/17 passed; committed as `feat`. |
| Task 2 RED | `gsd_run check tdd-red-evidence` → `RED_EVIDENCE_OK` (`target_test_failed`). Target: `anchorWidthAt > interpolates linearly on arc length between the two bracketing anchors`. 31 tests ran, the 7 width-law tests failed on assertion diffs. |
| Task 2 GREEN | `vitest run src/vector/spine.test.ts` → 31/31 passed; committed as `feat`. |
| REFACTOR | Not needed — no cleanup beyond the in-cycle fixes recorded below. |

The commit order is RED → GREEN for both cycles (`test(61-02)` ancestors of their `feat(61-02)` commits).

## Files Created/Modified

- `packages/efx-watercolor/src/vector/spine.ts` - the geometry module: types, constants, `normaliseVectorAnchors`, `resolveAnchorHandles`, `sampleVectorPath`, `pathLength`, `clampAnchorWidth`, `isUniformWidthProfile`, `anchorWidthAt`, `sampleVectorWidths`
- `packages/efx-watercolor/src/vector/spine.test.ts` - 33 pins across seven sections (handle goldens, bezier round-trip, sampled path, degenerate input, width law, sampling, determinism-scan coverage)
- `packages/efx-watercolor/src/determinismContract.test.ts` - `VECTOR_DIR` root added to both unseeded-RNG scan arms plus the zero-file guard

## Verification Run

- `pnpm --filter @efxlab/efx-watercolor exec vitest run src/vector/spine.test.ts` → 33 passed
- `pnpm --filter @efxlab/efx-watercolor exec vitest run src/determinismContract.test.ts src/vector/spine.test.ts` → 42 passed
- `pnpm --filter @efxlab/efx-watercolor exec vitest run` → 13 files, 221 passed | 8 skipped (baseline before this plan: 12 files, 187 passed | 8 skipped)
- `pnpm --filter @efxlab/efx-watercolor run check` (tsc --noEmit) → clean
- `grep -n "Math.random" packages/efx-watercolor/src/vector/spine.ts` → no match
- `grep -n "Math.min(1" packages/efx-watercolor/src/vector/spine.ts` → no match (the clamp's ceiling is `ANCHOR_WIDTH_MAX`, never 1)
- Manual determinism proof: `export const __probeUnseededDraw = () => Math.random()` appended to `spine.ts` made `unseeded RNG source scan > ... zero Math.random occurrences` fail (1 failed | 8 passed); the file was restored and the same suite returned 9/9.

## Decisions Made

- **One-division handle arithmetic.** `P ∓ Δ/n` rounds the mirrored handle to `0.6666666666666667`, but the plan pins the correctly-rounded rational `4/6 = 0.6666666666666666`. Computing `(n·P ∓ Δ)/n` gives one rounding per handle, matches every golden, and is more accurate on uneven spacing.
- **Effective-factor width model.** An anchor with no factor contributes the default `1` at its own station and interpolates from there; the ends therefore hold the first / last anchor's factor. This is the only reading that satisfies both the plan's interpolation bullet (1 / 1.8 / 1 with `1.4` mid-segment) and its hold-at-ends bullet, and it is exactly D-10's "untouched anchors interpolate from their neighbours".
- **`VECTOR_DIR` from `PKG_DIR`.** The contract file is ESM, so the plan's `__dirname` form cannot work; `join(PKG_DIR, 'src', 'vector')` matches the two existing roots.
- **JUnit evidence for RED.** Vitest's TAP reporter emits multi-line YAML diagnostics that the strict TAP parser rejects; the supported JUnit reporter was used untouched rather than deleting parts of a report.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A load-only failure is not valid RED for a brand-new module**
- **Found during:** Task 1 RED (and repeated for Task 2 RED)
- **Issue:** The plan says "create `spine.test.ts` … and let it fail before the module exists". A missing-module import makes Vitest report `Failed Suites … 0 test`, which the #3770 classifier refuses (`zero_tests_discovered` / `fixture_or_load_failure`) — it cannot authorize GREEN. Task 2 hit the same wall for named imports of the not-yet-existing width exports.
- **Fix:** The load failure was observed and recorded first (the plan's "before the module existed" observation), then a scratch, shape-only stub (types, constants, placeholder returns) was added locally so the target tests executed and failed on their assertions. The stub was never committed: each RED commit carries only the test file.
- **Files modified:** none committed by the stub; the committed RED is `spine.test.ts` alone.
- **Verification:** `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for both cycles with 12 and 7 failing assertion tests respectively.
- **Committed in:** `c9ec612f2`, `0ae7cfb38` (the RED commits)

**2. [Rule 1 - Bug] The mirrored handle golden needed a single rounding**
- **Found during:** Task 1 GREEN
- **Issue:** `P − tangent` for the middle anchor of (0,0),(1,0),(2,0) yields `0.6666666666666667`; the plan's golden is `0.6666666666666666` (the correctly-rounded `4/6`).
- **Fix:** Both handles are computed as `(n·P ∓ Δ) / n` (n = 6 interior, n = 3 at the endpoints) instead of `P ± Δ/n`.
- **Files modified:** `packages/efx-watercolor/src/vector/spine.ts`
- **Verification:** all handle goldens assert exactly; the full spine suite is green.
- **Committed in:** `7cdfd6d86` (Task 1 GREEN)

**3. [Rule 3 - Blocking] `__dirname` does not exist in the ESM contract file**
- **Found during:** Task 3
- **Issue:** The plan specifies `const VECTOR_DIR = resolve(__dirname, 'vector')`; `determinismContract.test.ts` is ESM and derives `PKG_DIR` from `import.meta.url`.
- **Fix:** `const VECTOR_DIR = join(PKG_DIR, 'src', 'vector')`, beside the existing roots.
- **Files modified:** `packages/efx-watercolor/src/determinismContract.test.ts`
- **Verification:** the zero-file guard and both scan arms pass; the injected `Math.random()` proof fails the contract.
- **Committed in:** `d5c9c3341` (Task 3)

**4. [Rule 3 - Blocking] Vitest's TAP output is rejected by the strict RED parser**
- **Found during:** Task 1 RED
- **Issue:** `--reporter=tap` output produced `Non-TAP data in report` and `Malformed TAP` because of the multi-line YAML assertion diagnostics; the classifier returned `INVALID_RED (invalid_record)`.
- **Fix:** The planned target was re-run through the project's test command with the supported JUnit reporter (`--reporter=junit --outputFile=…`) and the untouched XML was submitted, per the RED evidence contract's reporter-rerun clause.
- **Files modified:** none (evidence artifact only).
- **Verification:** both RED records classify as `RED_EVIDENCE_OK`.
- **Committed in:** evidence only, not in the tree.

---

**Total deviations:** 4 auto-fixed (1 Rule 1 bug, 3 Rule 3 blocking)
**Impact on plan:** All four are execution-mechanics fixes; no scope change, no product surface beyond the plan's three files, and every planned behaviour and acceptance criterion is asserted by the committed tests.

## Issues Encountered

- The plan's `anchorWidthAt` prose ("hold the nearest defined factor") and its own behaviour bullets ("a single 1.8 in the middle of a three-anchor list still reads 1 at both ends") only agree under the effective-factor model recorded in Decisions. No ambiguity remains in the implementation.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The scratch RED stubs were deleted before their GREEN commits; the committed module has no placeholder branch.

## Threat Surface

- T-61-05 (tampering on width factors): `clampAnchorWidth` bounds every factor into 0.2..2.0 and defaults non-finite input; `sampleVectorWidths`' test asserts the per-point range.
- T-61-06 (degenerate input): `normaliseVectorAnchors` drops duplicates and non-finite anchors; empty and single-anchor lists return without throwing.
- T-61-07 (unseeded RNG drifting into the new root): the contract scans `src/vector` with a zero-file guard, proven by a temporary injection.
- No new network endpoint, auth path, file access pattern or dependency was introduced; the module imports nothing.

## Next Phase Readiness

- 61-03 can re-export `VectorAnchor` as `AquarelleAnchor` and persist the sparse `width` field: `isUniformWidthProfile` is the "store nothing" gate.
- 61-04 can call `sampleVectorWidths(anchors, points)` per recorded point; the 1.8 factor survives to the sampled value with no clamp.
- 61-09 can draw `resolveAnchorHandles` and the `sampleVectorPath` polyline from the same authority.
- The determinism scan already covers the directory, so any later unseeded draw in `src/vector` fails the existing suite rather than surfacing as replay drift.

---
*Phase: 61-vector-painting-tool*
*Completed: 2026-11-10*

## Self-Check: PASSED

- All three committed files exist on disk.
- All five task commits (`c9ec612f2`, `7cdfd6d86`, `0ae7cfb38`, `3981f17da`, `d5c9c3341`) are ancestors of HEAD.
- No commit deletes a tracked file.
