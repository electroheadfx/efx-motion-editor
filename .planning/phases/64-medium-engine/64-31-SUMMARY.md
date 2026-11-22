---
phase: 64-medium-engine
plan: 31
subsystem: paint-engine, probe-harness
tags: [aquarelle, medium-engine, probe-harness, coverage-raster, alpha-law, opaque-export, tdd, baselines-stale]

# Dependency graph
requires:
  - phase: 64-medium-engine
    provides: the mode-4 darkness-only display derivation (quick 261121 series) and the probe-only coverage export (`exportCoverageCanvas`) whose value sits in RGB and alpha
  - phase: 64-medium-engine
    provides: the 64-29 probe-gate re-specification and the four surface digests every capture already reads
provides:
  - coverage-raster reads in the cross-cover, spread and five cover-lifecycle statistics, under coverage names with one comparator consumer each
  - the shipped 2026-11-21 alpha law stated in one voice in probe.ts, run.mjs and compare.mjs, guarded by three negative greps
  - opaqueExportMinAlpha / opaqueExportMinAlphaSurface — a captured-export check on paper, white and transparent surfaces at the fixed prime stride 4093
  - visibleAlphaMaxDelta / visibleAlphaSamples / visibleAlphaWorstAt / visibleAlphaSkip — the darkness-only display-alpha check on every non-bristle capture, with the bristle film-blur skip
  - alphaLawFailures in compare.mjs — both law blocks enforced in every comparator mode, absent-fails, skip-cannot-leak-off-bristle
affects: [64-36 baseline re-capture, any future probe gate that names coverage, comparator field-list changes]

# Actuals (#2632) — same scale as the plan's estimate (chars/4 over the realized diff).
# The commit window also contains five interleaved orchestrator docs commits; the count is measured, not narrated.
actuals:
  tokens: 24905
  tasks: 2
  commits: 10
  plan_head_before: 1ec91e2f01dc12865fd2e6d16c5e5302d53458e5
  plan_head_after: eebf9e839dbf12a64f4c796fa1e9b96c7d6673be

# Tech tracking
tech-stack:
  added: []
  patterns: [capture-level law checks over the already-read digest buffers with one fixed prime stride, negative greps as prose-regression gates, comparator enforcement that absent-fails a missing law block]

key-files:
  created: []
  modified:
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/harness.test.ts

key-decisions:
  - "Coverage claims read `exportCanvas('coverage')` — the shipped pigment alpha carries no coverage term, so every derivation through the pigment export is deleted, not reworded."
  - "The visible-alpha check compares the pigment export's ALPHA with the transparent export's RGB darkness on the same pixels: under the shipped law the transparent export is opaque transmittance, so the plan's literal wording ('transparent export's alpha') would compare darkness with 255."
  - "The law checks are pure helpers over the pixel buffers the digests already read (Digest gains `pixels`), so no extra export or readback is taken and the stride is a stated prime (4093)."
  - "Null-on-bristle visible-alpha fields are accepted by the comparator's field loop via a nullable set beside the pinned `aOk` literal, so presence is checked separately from value."
  - "Bristle captures report the visible-alpha check as skipped with the film-blur reason; off-bristle the comparator refuses the skip."
  - "No numeric bar moved and no baseline was edited: the 17 committed baselines are stale by design until 64-36 re-captures them."

requirements-completed: [MED-18, MED-25, MED-38]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Cross-cover, spread and the five cover-lifecycle statistics read the coverage raster under coverage names, each with exactly one comparator consumer"
    requirement: MED-18
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#run mode: the report carries the coverage fields and the comparator consumes each once"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate cover-textured --scenario cover-textured --size 512 --body 100 --brush chalk (coverage fields non-zero where the pigment export read zero)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The 2026-11-21 alpha law stated once in probe.ts, run.mjs and compare.mjs, with the stale composition deleted and three negative greps guarding its return"
    requirement: MED-18
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#source pins (law phrases present in raw sources, stale composition absent)"
        status: pass
      - kind: other
        ref: "! grep -rnF 'max(1 − min(rgb), cover)' probe.ts run.mjs compare.mjs + the two sibling greps — all exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "Opaque-export check on every capture: minimum alpha across paper, white and transparent surfaces equals 255, enforced by the comparator"
    requirement: MED-38
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#executed synthetics — a translucent pixel fails naming the surface"
        status: pass
      - kind: integration
        ref: "fresh cover-textured capture at HEAD: opaqueExportMinAlpha 255 on paper"
        status: pass
    human_judgment: false
  - id: D4
    description: "Visible-alpha check on every non-bristle capture (display alpha = darkness within one 8-bit step), skipped with its reason on bristle captures, enforced by the comparator"
    requirement: MED-25
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/probe/medium-engine/harness.test.ts#executed synthetics — two-step delta fails with coordinate; off-bristle skip rejected; bristle skip accepted"
        status: pass
      - kind: integration
        ref: "fresh cover-textured capture at HEAD: visibleAlphaMaxDelta 0 at x=398,y=303; fresh bristle-tip capture reports the skip reason"
        status: pass
    human_judgment: false

# Metrics
duration: 64min
completed: 2026-11-22
status: complete
---

# Phase 64 Plan 31: Coverage Claims on the Coverage Raster, Alpha Law Stated Once Summary

**Every probe coverage gate now reads the coverage raster under coverage names, and each capture proves the shipped alpha law — opaque exports and a darkness-only display alpha — with comparator enforcement and executed negative synthetics.**

## Performance

- **Duration:** 1h 4m (plan window wall clock; includes the interleaved orchestrator commits)
- **Started:** 2026-11-22T19:48:57+01:00
- **Completed:** 2026-11-22T20:53:18+01:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- The cross-cover, spread and five cover-lifecycle statistics read the engine's probe-only coverage canvas instead of inferring coverage from a pigment export whose alpha no longer carries a coverage term; the old names are gone from report and comparator.
- The shipped 2026-11-21 alpha law is stated once, in the same voice, across `probe.ts`, `run.mjs` and `compare.mjs`; the three composition sentences that wrapped the old `max(darkness, cover)` / `max(1 − min(rgb), cover)` law are deleted, and negative greps pin their absence.
- Two capture-level checks now run on every capture from the already-read digests: `opaqueExportMinAlpha` (paper, white, transparent at prime stride 4093, must be 255) and `visibleAlphaMaxDelta` (pigment alpha vs transparent-export darkness, at most one 8-bit step), with the bristle film-blur skip reported explicitly.
- `alphaLawFailures` in the comparator enforces both blocks in every mode: a missing block fails loudly, a translucent pixel fails naming its surface, an off-by-two-step capture fails naming the coordinate, and an off-bristle skip cannot pass.
- The harness is green at 131/131, including the executed synthetics that prove each failure path; no numeric bar moved and no baseline was touched.

## Task Commits

Each task was committed atomically (TDD: test → feat):

1. **Task 1: Coverage claims read the coverage raster and say coverage**
   - `3264d96ca` (test) — re-specify the coverage claims on the coverage raster (RED)
   - `668bb7056` (feat) — read every coverage claim from the coverage raster (GREEN)
2. **Task 2: The shipped alpha law, stated once and checked on captures**
   - `e602661ac` (test) — pin the shipped alpha law and its capture checks (RED)
   - `aa6738fbc` (docs) — restate the probe header under the shipped alpha law (prose step)
   - `eebf9e839` (feat) — check the shipped alpha law on every capture (GREEN)

Interleaved orchestrator docs commits inside the measured window (not this plan's tasks): `3f5cdd234`, `5c44a5b70`, `431d48f5e`, `0dc6b5330`, `b1755e48d`.

**Plan metadata:** (docs commit created after this SUMMARY)

## Files Created/Modified

- `packages/efx-watercolor/probe/medium-engine/probe.ts` — coverage-raster capture and coverage-named report fields; the law paragraph; `opaqueExportCheck`, `visibleAlphaCheck` and the bristle skip over `ALPHA_LAW_STRIDE = 4093`; `Digest.pixels` so the checks reuse the already-read buffers.
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` — FIELDS extended to the twelve pinned fields; `alphaLawFailures` enforced in all three modes; nullable handling for the bristle-block nulls; header prose restated.
- `packages/efx-watercolor/probe/medium-engine/run.mjs` — usage/header prose restated to the shipped law (three bullets, both law phrases on single lines); coverage vocabulary in the scenario descriptions; field count corrected to 12.
- `packages/efx-watercolor/probe/medium-engine/harness.test.ts` — the RED contract from the pin commits: law-phrase pins on raw sources, stale-composition absence pins, probe/comparator literals, and 12 executed law synthetics. Unchanged by the GREEN commits.

## Decisions Made

- Coverage reads go through `engine.exportCanvas('coverage')` only; the coverage canvas is an instrument, never an export channel, and no engine file changed.
- The visible-alpha identity is pigment-export alpha vs transparent-export RGB darkness — the only orientation the shipped law makes meaningful, since the mode-2 transparent export is opaque transmittance.
- The law helpers are pure functions over the pixels the digests already read; the single prime stride (4093) bounds cost and avoids row/dab period lock.
- The comparator's field loop keeps the pinned `aOk` literal and adds a nullable set for the two null-on-bristle fields; presence is checked with `field in data`.
- White-paper statistics keep their "white paper covered" names and consumers; only their input channel changed.
- Baselines were deliberately untouched: their field vocabulary predates this plan, and 64-36 is the single re-capture authority.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- First GREEN pass left 9 failing tests: the comparator's field loop treated the legitimately-null `visibleAlphaMaxDelta` / `visibleAlphaWorstAt` of a bristle capture as missing fields. Resolved with a nullable-field set beside the pinned `aOk` literal, keeping the pin intact.
- The first fresh capture reported `visibleAlphaWorstAt: null` despite samples being present, because the worst pixel was only recorded on a strict improvement. Seeded it with the first sampled pixel; the fresh capture now reports `x=398,y=303`.
- Both law phrases initially failed their raw-source pins in `run.mjs` because the bullets wrapped across two comment lines; restructured so each phrase sits on a single line. Final grep counts: probe.ts 1/1, run.mjs 1/1, compare.mjs 3/1.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 64-36 is unblocked: the re-capture will replace the 17 stale baselines (stale by design since the field vocabulary moved here) with captures that carry the twelve fields and the two law blocks.
- The twelve previously red gates can now be re-specified against a channel that actually exists; no bar was widened in this plan.
- No engine change: `git diff --quiet -- packages/efx-watercolor/src/playground` holds, and `git status --porcelain packages/efx-watercolor/probe/medium-engine/baselines` prints nothing.

## Self-Check: PASSED

- `packages/efx-watercolor/probe/medium-engine/probe.ts` — FOUND
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` — FOUND
- `packages/efx-watercolor/probe/medium-engine/run.mjs` — FOUND
- `packages/efx-watercolor/probe/medium-engine/harness.test.ts` — FOUND
- Commit `3264d96ca` — FOUND
- Commit `668bb7056` — FOUND
- Commit `e602661ac` — FOUND
- Commit `aa6738fbc` — FOUND
- Commit `eebf9e839` — FOUND
- Harness: 1 file, 131 tests passed
