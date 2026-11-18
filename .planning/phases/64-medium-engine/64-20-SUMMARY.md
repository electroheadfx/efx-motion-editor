---
phase: 64-medium-engine
plan: 20
subsystem: watercolor / coverage-film coherence and probe gating
tags: [watercolor, coverage, film-presence, paper-white, probe-harness, pixel-gate, capture-clearance, tdd]

# Dependency graph
requires:
  - phase: 64-13
    provides: the coverage composite, the `pigment` export and displayFS mode 4
  - phase: 64-14
    provides: the coverage advection transport and the no-decay law
  - phase: 64-16
    provides: the cover-textured and red-over-blue-50 gates with committed baselines
  - phase: 64-17
    provides: the four-digest captures, `coveredPaperWhitePct` and the white-over-blue gate
provides:
  - the covered-paper-white offender census (`coveredPaperWhiteBox`) sharing `coveredPaperWhitePct`'s single scan and threshold
  - the one shared `FILM_PRESENCE` snippet — display basis, display granulation literal, the scan's own 250/255 line and 5/255 ramp on the scan's 8-bit grid
  - the film-gated coverage transport in `advectCoverFS` (a frozen texel keeps its coverage exactly)
  - the capture-time coverage clearance (`coverClearFS`) at the pigment export boundary only, scoped to coverage-bearing texels
  - six Body>0 baselines re-captured; white-over-blue is an honest supersession record with a zero census
affects: [64-19 (nothing shared), phase-64 verification, 64-UAT row 8]

# Actuals (#2632) — same estimateTokens scale as the plan (chars/4 over the realized diff).
actuals:
  tokens: 20370
  tasks: 3
  commits: 14
plan_head_before: 99354bc38a99c40ba257e913920a8273eece3dd3
plan_head_after: c14228e5174ad3e47a76e0e5bcb166701a0c071f

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One shared GLSL snippet (`FILM_PRESENCE`) IS the film-presence criterion: transport and the capture clearance include the same text, and source pins forbid a second copy"
    - "Capture-boundary clearance: exported coverage is cleared where the FINAL film reads paper-white, scoped to texels that carry coverage (`cov > 0`), so identity exports stay byte-identical"
    - "Supersession-record baselines: a re-capture is written only after its own scenario invariants pass, keeping the old digests and the mechanism in the note"

key-files:
  created: []
  modified:
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/src/playground/shaders.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/coverageLifecycle.test.ts
    - packages/efx-watercolor/src/playground/coverage.test.ts
    - packages/efx-watercolor/src/playground/kmBand.test.ts
    - packages/efx-watercolor/src/playground/scattering.test.ts
    - packages/efx-watercolor/probe/medium-engine/baselines/{white-over-blue,cover-advect,cover-lift,cover-over-wet,cover-textured,red-over-blue-50}.json

key-decisions:
  - "The deposit stays UNGATED. The plan's law is the transport gate; the census is closed at the capture boundary where the FINAL film is known. A deposit gate read the dab's transient film and zeroed the Body-60 partial cover."
  - "The capture-time clearance is an explicit, user-authorized amendment to the plan's must-have truth: frozen transport remains true, and the EXPORTED coverage may additionally be cleared where the final film reads paper-white (64-20 decision checkpoint)."
  - "The clearance is binary and scoped to `cov > 0`: a cleared texel exports exactly zero coverage alpha and its pigment RGB passes through verbatim, so no surviving texel moves and Body-0 exports stay byte-identical."
  - "The gate quantizes to RGBA8 (round to nearest) before the luma mean, so its line is the scan's line and no texel can hide in the [249.5, 250) band the scan already calls paper-white."
  - "No bar, threshold, comparator or invariant was widened; the comparator and every invariant are untouched by this plan."

patterns-established:
  - "Shared-snippet gating: a criterion that must be enforced in two programs is declared once as a GLSL constant and a source pin asserts both programs include it verbatim"
  - "Capture-time clearance as a separate pass: displayFS is never modified for export-only hygiene, so every coverage-free render stays byte-identical"

requirements-completed: [MED-19, MED-20, MED-21]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "The white-over-blue report names its covered-paper-white texels (count, covered count, union bbox in doc uv) beside the percentage, from one scan."
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#covered-paper-white census pins"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate white-over-blue --scenario white-over-blue --size 1080 --body 100"
        status: pass
    human_judgment: false
  - id: D2
    description: "Coverage transport is scaled by the display's own film reconstruction; a paper-white film transports nothing and keeps its value."
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverageLifecycle.test.ts#filmPresence and gated-transport pins"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate white-over-blue ... && compare.mjs white-over-blue"
        status: pass
    human_judgment: false
  - id: D3
    description: "The pigment capture's exported coverage alpha is cleared where the FINAL film reads paper-white, at the export boundary only."
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/coverageLifecycle.test.ts#capture-time clearance pins"
        status: pass
      - kind: integration
        ref: "probe census: coveredPaperWhitePct 0, coveredPaperWhiteBox null at Body 100"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity --size 256 && compare.mjs neutral-identity"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every Body>0 baseline re-captured only after its own scenario invariants passed; identity gates untouched and byte-identical."
    verification:
      - kind: integration
        ref: "compare.mjs: white-over-blue, white-over-blue --other, white-over-blue-60/30 --differs-from, cover-advect (+ --other), cover-lift, cover-over-wet, cover-textured, red-over-blue-50"
        status: pass
      - kind: integration
        ref: "compare.mjs neutral-identity / neutral-pigment / watercolor-50 (no baseline edit)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Body 100 covers, Body 60 partly covers and Body 30 leaves the underlayer, all with no covered paper-white."
    verification:
      - kind: integration
        ref: "probe captures: B100 alpha 0.95/gain 0.90/excess 0.71; B60 0.23/0.08/31.46; B30 0.17/0.00/41.08; pct 0 everywhere"
        status: pass
    human_judgment: true
    rationale: "The live canvas behaviour behind these numbers (a light pigment at high Body covering a dried dark area with no paper-white, Body 50 partly covering without destroying the underlayer) is 64-UAT row 8 and needs the user's eyes."

# Metrics
duration: 41min
completed: 2026-11-18
status: complete
---

# Phase 64 Plan 20: Coverage Rides Only Where Its Film Leaves Paper-White Summary

**The white-over-blue Body-100 gate is green with every bar intact: `coveredPaperWhitePct` 0 and a null offender census (was 0.88 / 489 offending texels), closed by a shared display-basis film gate on the coverage transport plus an authorized capture-time clearance of exported coverage — with zero bar, comparator or invariant widened and every Body-0 render byte-identical.**

## Performance

- **Duration:** 41 min (span of this plan's commits plus the verified continuation)
- **Started:** 2026-11-18T20:50:55Z (first task commit)
- **Completed:** 2026-11-18T21:33:53Z
- **Tasks:** 3 of 3
- **Files modified:** 17

## Accomplishments

- The offender census now names its texels from the same single scan as the percentage (`coveredPaperWhiteBox`): pre-fix Body 100 reported **489 offending of 55,694 covered**, bbox `[0.7065, 0.2287]-[0.7907, 0.2991]`, pct **0.88**.
- One `FILM_PRESENCE` snippet reconstructs the combined mobile+fixed film with the display's own `displayBasisGLSL()` and granulation literal, on the scan's own 8-bit grid (`PAPER_WHITE = 250/255`, `PAPER_WHITE_RAMP = 5/255`), and is included by both the coverage transport and the capture clearance — one criterion, no second copy.
- `advectCoverFS` scales its back-trace mix and diffusion output per texel by the film's presence: a paper-white texel transports nothing and keeps its coverage exactly (no keep, no settle, no decay).
- The authorized capture-time clearance (`coverClearFS` + `Engine.clearPaperWhiteCoverage`) zeroes the exported coverage alpha where the FINAL film reads paper-white, at the pigment export boundary only; pigment/paper channels and every non-cleared texel pass through byte-identically.
- Post-fix Body 100: census **null**, `coveredPaperWhitePct` **0**, crossing **241.04/241.21/241.75** (blue excess 0.71), `crossCoverAlpha` **0.95** vs `crossDarkAlpha` 0.05 (gain 0.90). Body 60 keeps its partial cover (0.23 alpha, gain 0.08, excess 31.46); Body 30 keeps the underlayer (excess 41.08, gain 0.00). No covered paper-white at any body.
- All seven probe gates green on the fixed medium; the three identity gates are byte-identical with **no baseline edit**.

## Task Commits

Each task was committed atomically (TDD tasks split into RED and GREEN commits):

1. **Task 1: The offender census** — `4732a54d6` (feat)
2. **Task 2: Coverage rides only where its film leaves paper-white** (TDD, 13 commits)
   - `2a3af9ae0` (test) pin the film-presence gate in the cover transport
   - `f016ad32d` (test) pin the deposit gate and the scan's 8-bit grid
   - `f78d2a7f5` (test) repoint the coverage mask composite pin to the gated write
   - `10c833f45` (feat) gate the coverage deposit on the film presence
   - `f0efc7fd2` (test) pin the capture-time clearance on the shared film gate
   - `aefed61e4` (test) repoint the scattering-scalar counts to the shared film reconstruction
   - `91be7eb45` (feat) clear exported coverage where the final film reads paper-white
   - `69c21d6c8` (test) scope the clearance to texels that carry coverage
   - `fdc10704b` (feat) keep the clearance to coverage-bearing texels
   - `61b7e3aac` (test) repoint the deposit pins to the committed union write
   - `7c8fafaba` (test) repoint the coverage-composite mask pin to the ungated write
   - `7ca0c63d2` (feat) leave the coverage deposit ungated
3. **Task 3: The probe matrix and the supersession records** — `c14228e51` (test)

**Plan metadata:** the docs commit that carries this SUMMARY.

## Files Created/Modified

- `packages/efx-watercolor/probe/medium-engine/probe.ts` — `coveredPaperWhiteBox` extracted from the percentage's one texel loop; the census rides the white-over-blue report only; header documents it.
- `packages/efx-watercolor/src/playground/shaders.ts` — `TO_SRGB` hoisted above the gates; the shared `FILM_PRESENCE` snippet (two constants, `displayBasisGLSL`, 8-bit quantization); `advectCoverFS` transport gated by `p = filmPresence(vUv)`; `coverMaskFS` deliberately ungated; new `coverClearFS`.
- `packages/efx-watercolor/src/playground/Engine.ts` — cover pass binds the combined film on units 3-7 and the display's granulation literal; new `coverClear` program and `clearPaperWhiteCoverage` pass run only for `MODE.pigment` in `readback`.
- `packages/efx-watercolor/src/playground/coverageLifecycle.test.ts` — pins for the snippet, the constants, `filmPresence`, the gated transport, the clearance and the bind block; kept `expectNotContains(cover, 'uKeep'/'uSettle')` and the shared-literal loop.
- `packages/efx-watercolor/src/playground/coverage.test.ts` — composite mask pin repointed to the ungated union write.
- `packages/efx-watercolor/src/playground/kmBand.test.ts`, `scattering.test.ts` — scattering-scalar counts repointed to the shared film reconstruction.
- Six baselines — white-over-blue (supersession record) and the five other Body>0 gates, each written only from a capture that already passed its own invariants.

## Decisions Made

- **The coverage/film coherence law is transport + capture clearance, and the deposit is ungated.** The plan's own text says the deposit is already clean; gating it read the dab's transient film (ink still being laid, fixed layer already eroded) and zeroed the Body-60 partial cover. The committed union write is restored and the census closes at the export boundary on the FINAL film.
- **The clearance is an explicit truth amendment, authorized at the 64-20 decision checkpoint.** Frozen transport remains true ("a frozen texel transports nothing and keeps its value exactly"); in addition, the EXPORTED coverage alpha is cleared where the final display film reads paper-white — never inside `displayFS`'s interactive output.
- **The clearance is binary and coverage-scoped.** `cleared = (p < 0.0001 && cov > 0.0)`; RGB passes through verbatim. This is why `neutral-identity`, `neutral-pigment`, `watercolor-50` and every Body-0 export stay byte-identical.
- **No bar, comparator, threshold or invariant was touched.** The comparator diff for this plan is empty; only baselines whose own invariants passed were re-captured.

## TDD Gate Compliance

- RED before GREEN for every behavior change: `2a3af9ae0`, `f016ad32d`, `f78d2a7f5`, `f0efc7fd2`, `aefed61e4`, `69c21d6c8`, `61b7e3aac`, `7c8fafaba` are `test(64-20):` commits that precede their `feat(64-20):` counterparts.
- RED evidence records validated by `gsd_run check tdd-red-evidence`: `64-20-red-evidence-task2.json`, `-task2-clearance.json`, `-task2-clearance-scope.json`, `-task2-ungated-deposit.json` all return `RED_EVIDENCE_OK` (`target_test_failed`).
- GREEN proven by `pnpm --filter @efxlab/efx-watercolor exec vitest run` over the four named files: 4 files, 53 tests, all passing.

## Deviations from Plan

### Authorized amendment / decision-driven deviations

**1. [Authorized truth amendment — 64-20 decision checkpoint] Capture-time clearance of exported coverage**
- **Found during:** Task 2 (closing the census)
- **Issue:** The plan's must-have truth says "a frozen texel transports nothing and keeps its value exactly", but the white-over-blue census still counted 489 texels whose coverage alpha survived while the FINAL display film read paper-white (pct 0.88). The transport gate cannot close those texels by itself: the coverage field was already committed there before the film settled.
- **Fix (user-authorized at the 64-20 decision checkpoint, recorded verbatim in the plan's history):** a dedicated pass at the capture/export boundary — `coverClearFS`, run only for the pigment export in `Engine.readback` — zeroes the exported coverage alpha where the FINAL film reads paper-white, reusing the SAME `FILM_PRESENCE` snippet (250/255 and 5/255, quantized 8-bit luma) as the transport gate. Pigment and paper channels are unchanged; `neutral-identity` stays byte-identical. Frozen transport remains true; only the exported coverage is additionally cleared.
- **Files modified:** shaders.ts, Engine.ts, coverageLifecycle.test.ts
- **Verification:** census 0 / `coveredPaperWhiteBox === null` at Body 100; all Body-100 bars hold; identity gates byte-identical; no bar widened.
- **Commits:** `f0efc7fd2` (RED), `91be7eb45` (GREEN), `fdc10704b` (scoped clearance)

**2. [Decision reversal — earlier 64-20 checkpoint] The coverage deposit is left ungated**
- **Found during:** Task 2 (Body-60 bar)
- **Issue:** The earlier 64-20 checkpoint's deposit gate (`10c833f45`) scaled the coverage deposit by the film presence at the dab. Measured on white-over-blue that film is TRANSIENT — the ink the dab is still laying, with the fixed layer already eroded — so it read a partially-covered sheet as paper-white mid-stroke and **zeroed the Body-60 partial cover (gain 0.08 -> 0)**, breaking the plan's must-have truth 2. That is a real bar failure, not a bar to relax.
- **Fix:** the deposit keeps its committed union write (`coverMaskFS` ungated), the transport gate stays, and the authorized capture-time clearance closes the census on the FINAL film. The plan's literal text never specified a deposit gate; this restores it.
- **Files modified:** shaders.ts, Engine.ts, coverageLifecycle.test.ts, coverage.test.ts
- **Verification:** Body 60 gain 0.08, alpha 0.23, excess 31.46 (all bars); census still 0 by construction.
- **Commits:** `61b7e3aac`, `7c8fafaba` (RED), `7ca0c63d2` (GREEN)

**3. [Rule 2 - Correctness] Baseline metadata recorded from the verified capture**
- **Found during:** Task 3 (preparing the baseline commit)
- **Issue:** the working-tree baselines carried pre-written `capturedAt` values that did not match any actual capture time, and a short `capturedFromCommit`.
- **Fix:** each baseline now records the actual UTC time of the verified capture whose digests it carries, and the full 40-character SHA of `7ca0c63d2` (this plan's task-2 landing commit). No digest or measured value was modified.
- **Files modified:** the six baseline JSONs
- **Verification:** every baseline's measured fields equal a fresh capture (field-by-field diff); all seven gates mode-1 PASS afterwards.
- **Commit:** `c14228e51`

**Total deviations:** 2 decision-driven (1 user-authorized truth amendment, 1 measured reversal of an earlier checkpoint's extra gate) + 1 Rule 2 metadata correction.
**Impact on plan:** the plan's core truth (no body raises covered paper-white; Body 100 covers, Body 60 partly covers, Body 30 keeps the underlayer; identity exports byte-identical; no bar widened) is met. The plan's history is preserved: the amendment is recorded here as authorized at the 64-20 decision checkpoint, and the deposit-gate reversal is recorded with its measured reason rather than silently dropped.

## Issues Encountered

- The continuation inherited a working tree where Task 2 was complete and Task 3's baselines were written but uncommitted, with no SUMMARY. Every baseline was therefore re-verified against a fresh capture (all measured fields equal) and the full matrix was re-run green **before** the baseline commit; nothing was committed on the prior run's word alone.
- The deposit gate's Body-60 starvation (deviation 2) was the one substantive problem; resolved by moving closure to the capture boundary rather than relaxing a bar.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 64 has one unexecuted plan left: **64-19** (wave 2, depends on 64-18). This plan does not touch `app/`.
- 64-UAT row 8's coverage clauses are now runnable: a light pigment at high Body covers the dried dark area with no paper-white, and Body 50 partly covers without destroying the underlayer (D5 needs the user's eyes).
- The white-over-blue baseline is an honest supersession record: old digests `4c0d8124 / 766316bb / 2742fec1 / 51099491` -> `905823e6 / a5c4ebd6 / 2bf6f14b / 786fcb32`, with the "never regenerate to make a gate pass" warning qualified, not deleted.
- No blockers; no known stubs.

## Self-Check: PASSED

---
*Phase: 64-medium-engine*
*Completed: 2026-11-18*
