---
phase: 59-rail-motion-channels-v7-interface
plan: 14
subsystem: testing
tags:
  - vitest
  - dependency-surface
  - package-round-trip
  - canonical-revision
  - design-tokens
  - uat-traceability

# Dependency graph
requires:
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-04
    provides: Rust canonical_rail_motions mirror and the 23-test services::script_library guard suite
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-09
    provides: sub-frame export parity and the composite-cache key law
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-12
    provides: the single Motion writer surface exercised by the live UAT rows
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-13
    provides: the Studio gizmo path
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-15
    provides: Gate B wiring (delete/merge/copy) and the merge-drop notice
  - phase: 59-rail-motion-channels-v7-interface
    plan: 59-16
    provides: the numeric Motion inspector
provides:
  - railMotionDependencySurface.test.ts — REL-01 static import-surface law with a frozen app dependency baseline
  - railMotionPackageRoundTrip.test.ts — REL-02 package save → reopen byte identity with a real parser
  - timelineMotionSurface.contract.test.ts — value pins plus source-read absence pins for the assembled v7 surface
  - 59-UAT.md — three recorded automated gates, a 22-row requirement traceability table, 13 fully-specified live UAT rows
affects:
  - Phase 59 verification and live UAT
  - Any later plan that touches app/package.json dependencies or the timeline motion tokens

# Actuals (#2632) — measured on the plan's own scale (chars/4 over the realized diff)
actuals:
  tokens: 17073
  tasks: 3
  commits: 2
plan_head_before: e5dda4dc9410136e35bd4120996f0ba527eb8343
plan_head_after: 921ab14690f9dffa6f0a445ebd317db3e19db8ca

# Tech tracking
tech-stack:
  added: []
  patterns:
  - "Static import-surface scan: read the phase modules from disk, extract bare specifiers conservatively, resolve them against the workspace manifest union"
  - "Frozen dependency baseline with an add/remove/move diff, so a transitive/dev package cannot slip past a resolvable-import check"
  - "Package-level round trip with only the IPC/fs boundary mocked; savePackage, loadEfxPaintPackage and the canonical parser stay real"
  - "Source-read contract assertions running beside value pins, so an inlined token copy fails even when the token value itself is correct"
  - "Fixture vacuity guards: the scan list length and the motion record count are asserted before any equality proof"

key-files:
  created:
  - app/src/lib/railMotionDependencySurface.test.ts
  - app/src/lib/railMotionPackageRoundTrip.test.ts
  - app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts
  - .planning/phases/59-rail-motion-channels-v7-interface/59-UAT.md
  - .planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-14-task1.xml
  modified:
  - app/src/lib/efxPaintPersistence.ts

key-decisions:
  - "REL-01 freezes the whole app/package.json dependencies map at the phase-start commit, not just names: a silent version move is a dependency change too, and a transitive/dev package would pass a mere resolvability check."
  - "REL-02 mocks only the IPC/fs boundary so the canonical revision is recomputed by the real parser on both the write and read legs; a mocked package layer could never have caught the projectLayerDocument omission."
  - "The reopened revision is compared to the persisted string, and a with-motion/without-motion control proves the collection is inside the canonical revision; the runtime revision over byte payloads is a different, legitimately different string."
  - "Rust acceptance of the motion-bearing revision is proven by the cargo services::script_library gate and the prior frozen-source parity pin, not by a TS-side mock of the Tauri bridge — a mock would never execute the Rust recompute."
  - "The motion surface contract reads the four component sources and forbids both the exact token expressions being absent and the exact literals being present, because a value-only pin cannot see a drifted inline copy."
  - "MOTN-06, MOTN-07 and MUI-01..MUI-05 stay Pending in REQUIREMENTS.md: their remaining evidence is live, and an automated pin must not stand in for a visual row (plan prohibition / T-59-40)."

patterns-established:
  - "Requirement evidence is a file::test-name pointer in a table row, plus a numbered live row when human judgment is required."
  - "A package round trip asserts collection deep-equality, revision identity, re-serialization byte identity, media presence and fail-closed tamper rejection in the same proof."

requirements-completed:
  - MOTN-01
  - MOTN-02
  - MOTN-03
  - MOTN-04
  - MOTN-05
  - MOTN-08
  - MOTN-09
  - MOTN-10
  - MOTN-11
  - MOTN-12
  - MUI-06
  - REL-01
  - REL-02
  - REL-03
  - REL-04

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "REL-01 is an executable law: every bare import in the 15 phase modules resolves to a workspace-declared package, and app/package.json dependencies are identical to the frozen phase-start baseline"
    requirement: REL-01
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionDependencySurface.test.ts#resolves every bare import to a workspace-declared package"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionDependencySurface.test.ts#adds no entry to app/package.json dependencies — frozen against the phase start"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionDependencySurface.test.ts#finds the bare specifiers the phase really imports — the scan is not vacuous"
        status: pass
    human_judgment: false
  - id: D2
    description: "REL-02 is proven at the package level: a motion-bearing document saves, reopens with railMotions deep-equal and the same canonical revision, re-serializes to the same persisted bytes, and a tampered revision is rejected"
    requirement: REL-02
    verification:
      - kind: unit
        ref: "app/src/lib/railMotionPackageRoundTrip.test.ts#reopens with the collection deep-equal and the canonical revision identical"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionPackageRoundTrip.test.ts#re-writes the reopened document to the same persisted physical bytes"
        status: pass
      - kind: unit
        ref: "app/src/lib/railMotionPackageRoundTrip.test.ts#fails closed on a tampered revision rather than re-deriving it"
        status: pass
    human_judgment: false
  - id: D3
    description: "The assembled v7 surface reads TIMELINE_MOTION / TIMELINE_GEOMETRY / TIMELINE_SURFACE instead of inlining lane, key, curve, outline and chevron values"
    verification:
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts#the v7 motion surface values"
        status: pass
      - kind: unit
        ref: "app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts#the assembled surface reads its geometry from timelineRailDesign"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full surface is green and the outcomes are recorded verbatim with the 22-row traceability table"
    verification:
      - kind: other
        ref: "pnpm --filter efx-motion-editor run typecheck (exit 0)"
        status: pass
      - kind: integration
        ref: "pnpm --filter efx-motion-editor exec vitest run — 395 files passed | 2 skipped, 7798 tests passed | 1 skipped | 96 todo"
        status: pass
      - kind: integration
        ref: "cargo test --manifest-path app/src-tauri/Cargo.toml services::script_library — 23 passed; 0 failed; 93 filtered out"
        status: pass
      - kind: other
        ref: ".planning/phases/59-rail-motion-channels-v7-interface/59-UAT.md#Requirement traceability (22 rows)"
        status: pass
    human_judgment: false
  - id: D5
    description: "13 live UAT rows are authored with preconditions, gesture sequence and expected outcome; every row is pending human evidence"
    verification: []
    human_judgment: true
    rationale: "Live rows exist precisely for what automation cannot see: chevron/outline rendering, repeat rhythm, merge-drop confirmation and one-undo restore, export frames, and Studio-vs-Play identity. Plan prohibition: an automated pin never marks a visual row passed."

# Metrics
duration: 22min
completed: 2026-11-06
status: complete
---

# Phase 59 Plan 14: Full-Surface Verification Summary

**Four executable laws close the phase: a frozen dependency baseline for REL-01, a real package save/reopen proof for REL-02 (which caught a write-path canonical-revision omission), a token-vs-source contract for the v7 surface, and a 22-row traceability table with 13 live UAT rows left pending.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-11-06T19:20:00+01:00
- **Completed:** 2026-11-06T19:41:46+01:00
- **Tasks:** 3 (Tasks 1 and 2 fully automated; Task 3 authored, human gate open)
- **Files modified:** 6

## Accomplishments

- **REL-01 is a law, not prose.** `railMotionDependencySurface.test.ts` reads all 15 phase modules from disk, extracts `from` / dynamic-import / side-effect specifiers with a conservative regex, and requires every bare specifier to resolve to a package declared by the root, app or `packages/*` manifests. It also freezes `app/package.json` `dependencies` at the phase-start commit (`724bb6194`) and prints an add/remove/move diff on drift. A positive control names four real bare imports so a broken extractor cannot pass vacuously.
- **REL-02 found and fixed a real defect.** `railMotionPackageRoundTrip.test.ts` saves a fixture with three rail-motion records across five channels and three rail types (bare Key Rail, loop rail, Reveal rail), reopens it through the real parser, and asserts collection deep-equality, revision identity, re-serialization byte identity, media-file presence and fail-closed tamper rejection. Building it exposed that `projectLayerDocument` recomputed the canonical revision **without** `railMotions`, so every motion-bearing save threw `canonical revision mismatch`. The fix is one argument plus a comment naming the format law.
- **The assembled surface is pinned to its tokens.** `timelineMotionSurface.contract.test.ts` pins lane 18, cell 16×18×3, key 6×6 r1.5 rim 1, curve 1.5, outline 1.5/r4, post-block gap 2 and the `#58616B` chevron grey; then reads the lane, row, strip and header-column sources to require the token expressions and forbid the literal copies. Nine tests pass.
- **The whole surface ran green.** typecheck exit 0; full vitest `395 passed | 2 skipped` files and `7798 passed | 1 skipped | 96 todo` tests; cargo `services::script_library` `23 passed; 0 failed; 93 filtered out`. All three commands and outcomes are recorded verbatim in `59-UAT.md`.
- **Every requirement has a named piece of evidence.** The traceability table has 22 rows, each pointing at `file::test-name`, a live row number, or both. No REL row rests on a live row alone.

## Task Commits

Each task was committed atomically:

1. **Task 1: REL-01 import surface and REL-02 package round trip** — `a5c9a17fd` (test). Includes the RED evidence file `red-evidence/red-59-14-task1.xml` (8 tests, 3 failing) and the Rule 1 product fix in `efxPaintPersistence.ts`.
2. **Task 2: v7 surface contract, gates and the 22-row traceability table** — `921ab1469` (test).
3. **Task 3: live UAT rows authored** — delivered inside `921ab1469` (the same `59-UAT.md` document); no separate commit because the authoring produced no additional file change. The human verification gate remains open by design.

**Plan metadata:** committed after this SUMMARY (docs: complete full-surface verification plan).

## Files Created/Modified

- `app/src/lib/railMotionDependencySurface.test.ts` — REL-01 static import scan plus frozen dependency baseline (4 tests).
- `app/src/lib/railMotionPackageRoundTrip.test.ts` — REL-02 package save → reopen proof over real persistence and parser code (5 tests).
- `app/src/lib/efxPaintPersistence.ts` — pass `physical.railMotions` into the canonical revision recompute in `projectLayerDocument`.
- `app/src/components/physic-paint/view/timelineMotionSurface.contract.test.ts` — v7 token values plus component source pins (9 tests).
- `.planning/phases/59-rail-motion-channels-v7-interface/59-UAT.md` — automated gate records, 22-row traceability, 13 pending live rows.
- `.planning/phases/59-rail-motion-channels-v7-interface/red-evidence/red-59-14-task1.xml` — TDD RED evidence for Task 1.

## Decisions Made

- REL-01 compares the entire dependency map, versions included, against a frozen baseline: a resolvability-only check would accept a transitive or dev package.
- REL-02 mocks only `./ipc` and `@tauri-apps/plugin-fs`; the package layer and parser are real, which is why the revision omission surfaced.
- The persisted revision (recomputed over media references) and the runtime revision (built over byte payloads) are legitimately different strings; the test asserts persisted-vs-reopened identity and proves membership with a with-motion/without-motion control instead.
- The motion surface contract asserts absence of literals as well as presence of tokens — the half that a value-only test cannot see.
- Live rows stay pending; MOTN-06, MOTN-07 and MUI-01..MUI-05 stay Pending in REQUIREMENTS.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `projectLayerDocument` omitted `railMotions` from the canonical revision recompute**
- **Found during:** Task 1 (REL-02 package round trip)
- **Issue:** The write path rebuilt the canonical revision from the media-reference records but passed only `groupOverrideRecords`. Any document carrying rail motions therefore persisted a revision the parser recomputed differently, and every motion-bearing package save failed with `PhysicPaintRotoPhysicalDocument: canonical revision mismatch` — the reopen leg could never have run.
- **Fix:** Pass `physical.railMotions` as the sixth revision term with a comment naming the 59-03 canonical-format law.
- **Files modified:** `app/src/lib/efxPaintPersistence.ts`
- **Verification:** The RED run (3 failing package tests) turned green; the full suite and typecheck pass.
- **Committed in:** `a5c9a17fd`

### Plan Adjustments

**2. Rust guard acceptance is proven by the cargo gate instead of a TS-side bridge mock**
- **Found during:** Task 1
- **Issue:** The plan's REL-02 behavior asks the round-trip test to call "the existing bridge apply helper used by `railMotionCanonicalParity.test.ts`". That helper crosses Tauri IPC; mocking it in vitest would assert the mock, not the Rust recompute.
- **Fix:** The reopened revision is asserted equal to the persisted string (the parser's fail-closed acceptance), the Rust leg is covered by the recorded `cargo test services::script_library` gate (23 tests), and the frozen-source parity pin from 59-04 remains green. The reasoning is written in the test comment.
- **Files modified:** `app/src/lib/railMotionPackageRoundTrip.test.ts` (comment only)
- **Verification:** Gate 3 cargo run, 23 tests passed.
- **Committed in:** `a5c9a17fd`

---

**Total deviations:** 1 auto-fixed (Rule 1), 1 documented plan adjustment
**Impact on plan:** The Rule 1 fix is required for motion persistence to work at all. The adjustment avoids a proof that would be vacuous by construction; no scope creep.

## Issues Encountered

- The pre-existing untracked `railMotionDependencySurface.test.ts` resolved its app directory one level short (`app/src` instead of `app`), so all four tests failed with ENOENT before the fix. Corrected to two levels up, with the repo root derived from it.
- The parser canonicalizes motion records by `railId` and channels by fixed model order. The fixture was reordered to the canonical sequence and the reason documented beside the fixture.
- The first cargo invocation raced a rebuild and reported `0 passed … 4 filtered out`; the test names were confirmed with `--list` and the suite re-run in the foreground to 23 passing tests. Both outcomes are recorded in 59-UAT.md so the exit code alone is not mistaken for evidence.
- A first self-authored assertion compared the runtime revision over byte payloads with the persisted revision over media references; that comparison is invalid by design and was replaced with the persisted-vs-reopened identity assertion plus the membership control.

## Live UAT — Open Gate

Thirteen rows are authored in `59-UAT.md` with preconditions, exact gesture sequence and expected observable outcome. **All 13 are `pending` and none was marked passed.** The plan's success criteria state the phase is complete only when the user's live rows are recorded; this SUMMARY therefore claims the automated and authoring work only. MOTN-06, MOTN-07 and MUI-01..MUI-05 remain Pending in REQUIREMENTS.md for that reason.

## Known Stubs

None — the plan added tests and documentation only, plus the one product fix.

## Threat Flags

None — no new network, auth or file-access surface. The plan's mitigations are implemented: T-59-40 (22-row traceability with a concrete pointer per row; live rows require human evidence), T-59-41 (static import scan plus frozen dependency baseline with readable diff), T-59-SC (nothing installed; the scan fails if a phase module imports a package outside the recorded manifest set).

## Next Phase Readiness

- Every automated requirement has a passing pin and every pin is named in `59-UAT.md`.
- The remaining gate is live: run the 13 rows in the app and record pass/fail evidence in `59-UAT.md`. A failed row keeps its observed behaviour verbatim and is fixed in source, never by editing a test.
- No blockers introduced. The product surface is unchanged except the corrected revision argument, which restores the intended save behaviour.

## TDD Gate Compliance

- **Task 1 RED:** `red-evidence/red-59-14-task1.xml` — 8 tests collected, 3 failing with `canonical revision mismatch`; the dependency scan's 4 tests and the vacuity guard were already green, and the package tests failed for the real reason.
- **Task 1 GREEN:** `a5c9a17fd` — after the `railMotions` revision term fix, all 9 tests in the two Task 1 files pass.
- **Task 2:** contract test authored and run to 9 passing tests; full-surface gates recorded.

## Self-Check: PASSED
