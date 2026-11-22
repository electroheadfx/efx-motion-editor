---
phase: 64-medium-engine
plan: 25
subsystem: [watercolor-engine, roto-merge, alpha-law]
tags: [coverage-composite, source-over, transmittance, alpha, cr-04, tdd, modeled-compositor]

requires:
  - phase: 64-medium-engine (64-15)
    provides: the coverage-composite merge and the MED-38 seam pins this plan repairs and keeps green
  - phase: 64-medium-engine (64-17)
    provides: the capture merge law and its call sites
  - phase: 64-medium-engine (64-24)
    provides: the executed wave tail this gap plan follows (no code dependency)
provides:
  - the coverage read fixed for CR-04 — the raster's own 2D pixels first, a TRANSPARENT scratch fallback second, never a white fill — so cover 0 keeps the committed base and cover 0.5 uses the 0.498 exponent on the real compositor
  - the white-filled transmittance scratch kept for the SHEET only (its partial-alpha reading over paper white)
  - the stated OPAQUE TRANSMITTANCE alpha law in the merge module and its supersession of 64-15 truth 4
  - an end-to-end alpha proof over the actual merged bytes through the real `transmittanceRectToPigmentAlpha` (storage 255; 191 / 127 / 159 / 191)
  - a coverage gate that models the platform's source-over compositor instead of a no-op drawImage
affects: [phase-64 verification, any future capture-merge work, the coverage seam contract]

actuals:
  tokens: 7026
  tasks: 2
  commits: 4
plan_head_before: cd4387905152bb434962743688a24d44d47649b9
plan_head_after: 2c60ec1997d5fb782b3b07836b2f4f2b47af97e1

tech-stack:
  added: []
  patterns:
    - "A compositing-law unit gate must model the platform's alpha-over: opaque `fillRect`, source-over `drawImage` with the SOURCE's alpha, unpremultiplied readback — a no-op drawImage pins arithmetic while being blind to the bug"
    - "Prove an alpha law end to end through the REAL display conversion over the merged bytes (only the display seam mocked) instead of asserting storage semantics in prose"
    - "Keep RED evidence TAP-parseable: scalar and boolean assertions, never a whole-file `toContain` whose diagnostic dumps the module"

key-files:
  created: []
  modified:
    - app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts

key-decisions:
  - "The coverage raster is read from its own 2D context (willReadFrequently) when readable, else drawn onto a TRANSPARENT scratch — cover rides RGB and ALPHA, so any opaque backdrop rewrites it to 255·(1 - c + c²)"
  - "The sheet keeps its white-filled scratch: it is opaque transmittance, and white is the no-pigment identity a partial-alpha sheet is read against"
  - "The committed alpha law is OPAQUE TRANSMITTANCE: every stored pixel is alpha 255, coverage enters only as the exponent 1 - cover, and the visible alpha is derived at display as 1 - min(rgb) — 64-15 truth 4 is superseded after the 2026-11-21 darkness-only display amendment"
  - "Fail-open stays: without a readable coverage raster the raw sheet is drawn over the base, never a dropped stroke"

patterns-established:
  - "Two rasters, two laws: the sheet is opaque transmittance (white fill legitimate); the coverage field is transparent where cover is 0 (never white-filled)"
  - "A storage format is stated where it is written: the loop's b[i + 3] = 255 carries its one-line why beside it"

requirements-completed: [MED-22, MED-25, MED-38]

coverage:
  - id: D1
    description: "The coverage-composite merge obeys t' = t_sheet x t_base^(1 - cover) on a real source-over compositor: cover 0 keeps the base's red/green (128,128), cover 128 uses the 0.498 exponent (≈182), cover 255 replaces the base — on both the direct-read and transparent-scratch fallback paths."
    requirement: MED-22
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts#mergeCachedRotoAlphaFrame > COVERAGE-COMPOSITE on the real compositor (CR-04) > keeps the base at cover 0 and the 0.498 exponent at cover 128 — direct 2D read"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts#... — transparent-scratch fallback"
        status: pass
    human_judgment: false
  - id: D2
    description: "The committed payload's alpha law is named and proven end to end from the merged bytes: storage alpha 255 everywhere, coverage only in the exponent, display derivation 1 - min(rgb); Task 1's fixture derives 191 at every cover and the physically coherent scenario derives 127 (the base's own) / 159 (strictly between) / 191 (the sheet's own)."
    requirement: MED-38
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts#... stores opaque transmittance: alpha 255 at every pixel of both scenarios"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts#... derives the base alpha at cover 0, strictly between at cover 128, the sheet alpha at cover 255"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts#the stated alpha law > states OPAQUE TRANSMITTANCE storage and the display derivation in the module docstring"
        status: pass
    human_judgment: false
  - id: D3
    description: "The fail-open path and the seam contract are untouched: without a readable coverage raster the raw sheet is drawn over the base, and the merge keeps exactly one `transmittanceSourceToPigmentAlpha(` occurrence (the pigment-alpha branch)."
    requirement: MED-25
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts#... fails open to the raw sheet when the coverage raster has no readback"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/roto/aquarelleCoverSeamContract.test.ts#MED-38 (narrowed): one display program, one stored format"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-11-22
status: complete
---

# Phase 64 Plan 25: CR-04 coverage read and the committed alpha law Summary

**A committed aquarelle capture now keeps its cached base wherever the new stroke did not paint — the coverage raster is read without a white fill (cover 0 keeps the base, 0.5 uses the 0.498 exponent) — and the payload's opaque-transmittance alpha law is stated and proven end to end over the merged bytes.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-11-22T15:55:03Z
- **Completed:** 2026-11-22T16:03:13Z
- **Tasks:** 2
- **Files modified:** 2 (+ the plan's metadata files)

## Accomplishments

- CR-04's data-loss defect is fixed: `scratchOf` split into a white-filled transmittance scratch for the SHEET only and a `readCoverage` helper that reads the coverage raster's own 2D pixels (or a TRANSPARENT scratch fallback), so source-over can no longer rewrite cover 0 into an observed red of 255.
- The unit gate that missed the bug now models the real compositor: `fillRect` writes opaque white, `drawImage` performs straight-alpha source-over, readback unpremultiplies. Against the pre-fix merge it fails at cover 0 (`255` vs the base's `128`); against the fixed merge all paths pass.
- The committed alpha law is stated in the module (OPAQUE TRANSMITTANCE: alpha 255 storage, coverage only as the `1 - cover` exponent, visible alpha derived at display as `1 - min(rgb)`) with 64-15 truth 4's supersession recorded rather than implied.
- The law is proven end to end through the REAL `transmittanceRectToPigmentAlpha` over the merged bytes: storage alpha 255 everywhere; Task 1's fixture derives 191 at every cover (a law pin); the physically coherent scenario derives 127 (the base's own at cover 0) / 159 (strictly between) / 191 (the sheet's own at cover 1).
- Fail-open, blend order, the sheet's white fill, and the MED-38 seam pins (one conversion, three named laws) are unchanged.

## Task Commits

Each task was committed atomically (TDD: RED → GREEN):

1. **Task 1: The real-compositor gate and the coverage read** — `bd5bd6160` (test, RED) → `833168894` (feat, GREEN)
2. **Task 2: The committed alpha law, stated and proven end to end** — `308bdffed` (test, RED) → `2c60ec199` (feat, GREEN)

**Plan metadata:** see the `docs(64-25): complete ... plan` commit

_Note: TDD tasks have two commits each; no REFACTOR commit was needed._

## Files Created/Modified

- `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.ts` — `readCoverage` (direct 2D read, transparent-scratch fallback) replaces the white-filled coverage scratch; the sheet keeps `transmittanceScratchOf`; the blend-law docstring states the opaque-transmittance alpha law and its supersession; a one-line why sits beside `b[i + 3] = 255`.
- `app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts` — `ModelCanvas`/`ModelContext` model the real source-over compositor (opaque `fillRect`, alpha-over `drawImage`, unpremultiplied readback); the CR-04 describe runs direct-read, fallback, sheet-white-fill and fail-open cases plus the alpha-law stage through the real rect conversion; source pins for the stated law, the one conversion, and the display consumer.

## Decisions Made

- Read the coverage raster's own pixels first and fall back to a transparent scratch — the raster's alpha IS its cover, so no opaque backdrop may sit in the path.
- Keep the sheet's white-filled scratch exactly as shipped: the sheet is opaque transmittance, and white is the no-pigment identity.
- State OPAQUE TRANSMITTANCE as the stored alpha law and record that 64-15 truth 4's coverage-derived alpha was superseded by the 2026-11-21 darkness-only display amendment.
- Model the platform compositor in the gate rather than the previous no-op `drawImage`; keep the real `transmittanceRectToPigmentAlpha` in the alpha stage and mock only the display seam.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected two miscalculated expected constants in the CR-04 sheet-white-fill test**
- **Found during:** Task 1 (GREEN verification)
- **Issue:** The RED test "keeps the sheet on its white-filled transmittance scratch" expected the composed green/blue of a partial-alpha red sheet over a `(128,128,255)` base to exceed 120. The law's actual output is `(128, 60, 127)`: green is the sheet's white-filled transmittance (127) attenuated by the base's green (`×linear(128) → 60`), and blue passes the sheet's 127 through the base's full blue channel. The theoretical maximum composed green with that base is 127, so the committed expectation was unreachable.
- **Fix:** Pinned the law's values (`merged[1] ≈ 60`, `merged[2] ≈ 127`) with tolerance 2; the discriminator vs a no-fill draw (green 0) and vs the pre-fix merge (red 255) is unchanged.
- **Files modified:** app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts
- **Verification:** the test now passes on the fixed merge and failed on the pre-fix code at the first assertion (red 255 vs 128).
- **Committed in:** `833168894` (Task 1 GREEN).

**2. [Rule 1 - Bug] Kept the Task 2 RED diagnostic TAP-parseable**
- **Found during:** Task 2 (RED evidence capture)
- **Issue:** A failing `expect(mergeSource).toContain('OPAQUE TRANSMITTANCE')` prints the entire module into the TAP YAML diagnostic; the strict TAP adapter rejects large embedded strings as non-TAP data (the same INVALID_RED mode Task 1 hit with array dumps).
- **Fix:** Switched the docstring pins to boolean assertions (`includes(...) === true`), keeping the failure message minimal while pinning the same substrings.
- **Files modified:** app/src/components/physic-paint/roto/physicsPaintRotoAlphaMerge.test.ts
- **Verification:** `gsd_run check tdd-red-evidence .gsd/tdd-evidence/64-25/task2-red.json --raw` returned `RED_EVIDENCE_OK` (18 collected, 17 pass, 1 fail).
- **Committed in:** `308bdffed` (Task 2 RED).

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs, both in the plan's own gate code, no product-law change)
**Impact on plan:** No scope creep. Both fixes keep the intended discrimination (pre-fix fails, fixed passes) and restore a parseable RED record.

## TDD Gate Compliance

Both `tdd="true"` tasks ran RED → GREEN with no REFACTOR commit needed:

| Task | RED commit | GREEN commit | RED evidence |
|------|-----------|--------------|--------------|
| 1 — real-compositor gate and coverage read | `bd5bd6160` | `833168894` | exit 1, 4 failing; target `...physicsPaintRotoAlphaMerge.test.ts > mergeCachedRotoAlphaFrame > COVERAGE-COMPOSITE on the real compositor (CR-04) > keeps the base at cover 0 and the 0.498 exponent at cover 128 — direct 2D read`; validated `RED_EVIDENCE_OK` (`target_test_failed`) |
| 2 — committed alpha law end to end | `308bdffed` | `2c60ec199` | exit 1, 1 failing (the stated-law docstring pin) of 18; target `... > the stated alpha law (64-15 truth 4, superseded) > states OPAQUE TRANSMITTANCE storage and the display derivation in the module docstring`; validated `RED_EVIDENCE_OK` (`target_test_failed`) |

No gate violations: no `feat` precedes its task's `test` commit, and no vacuous RED — Task 1's failing tests are the CR-04 assertions themselves (cover-0 red 255 vs 128; the unreadable-coverage case throws inside the pre-fix white-filled scratch), and Task 2's RED is the documentation gap its GREEN fills while the alpha stage already proves the Task-1-fixed merge.

## Issues Encountered

- **TAP diagnostics vs the evidence classifier.** The first Task 1 RED record was rejected as `INVALID_RED` ("Malformed TAP") because Vitest's YAML diagnostics embedded multi-line array dumps (`Array [\n …`). Scalar assertions fixed the capture; Task 2 pre-emptively used boolean assertions (deviation 2). Records live at `.gsd/tdd-evidence/64-25/task1-red.json` and `task2-red.json` (gitignored gate artifacts; verdicts recorded above).
- **Ledger bookkeeping.** The plan commit ledger (`$(git rev-parse --git-dir)/gsd-plan-head-before-64-25`) was written after the tasks were already in progress; the pre-plan HEAD is known from the dispatch (`cd4387905152…`), so the measured commit count above (4) spans the whole plan including both RED commits.
- No other problems; the three-suite verify finished at 50/50 tests and `tsc --noEmit` was clean on both GREENs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The coverage capture path is law-correct again; the remaining gap-closure plans (CR-03/WR-03/IN-04, WR-04, IN-05/IN-07) are independent and file-disjoint.
- The live surface to watch on the next artist UAT: an aquarelle stroke committed over an existing cached base must keep the previous paint outside the new stroke's coverage, and a half-covered pixel must read as the half blend.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-22*

## Self-Check: PASSED

- Files: all 3 present (2 source files + this SUMMARY).
- Commits: `bd5bd6160`, `833168894`, `308bdffed`, `2c60ec199` are all ancestors of HEAD.
