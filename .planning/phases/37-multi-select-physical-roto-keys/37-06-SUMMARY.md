---
phase: 37-multi-select-physical-roto-keys
plan: 06
subsystem: testing
tags: [physics-paint, roto, selection, group-operations, regression-tests, vitest]

# Dependency graph
requires:
  - phase: 37-multi-select-physical-roto-keys (plan 37-05)
    provides: explicit native-UAT approval ("approved — s2-s10 pass; q1-q4 confirmed"), Q1/Q2 probe-assumption rulings, locked GD/GDel/GFS mappings
provides:
  - Executable regression anchors for GD-1..GD-3, GDel-1/GDel-2, GFS-1..GFS-3 (baseline A@1,B@3,C@5,D@10)
  - Executable selection-reducer and D-17 post-acceptance coverage
  - Executable group presentation coverage (moved-set roles, selected-tooltip copy)
  - Phase 37 final gate: full vitest + typecheck + build green
affects: [phase-37-closure, future-resolver/selection/presentation-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UAT-then-regression (D-18): approval asserted before any test file existed; tests encode approved behavior verbatim"
    - "Honest fixtures: presentation moved-set tests build proposals through a real resolvePhysicPaintRotoPhysicalEdit call, never hand-fabricated literals"
    - "Atomic-reject assertions: every failure case asserts ok === false plus the exact production failure-code literal"

key-files:
  created:
    - app/src/components/physic-paint/roto/physicsPaintRotoPhysicalResolver.test.ts
    - app/src/components/physic-paint/roto/physicsPaintRotoMultiSelection.test.ts
  modified:
    - app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts

key-decisions:
  - "Tests encode the UAT-approved Q1 ruling (toggle-out-of-current transfers current to next selected key in identity order, fallback previous; never-empty no-op) and Q2 ruling (shift-click makes the clicked key current) exactly as recorded in 37-05-SUMMARY.md"
  - "Single-key fallback view-model test asserts D's role as 'idle' when its net frame change is zero (D ripples out and back to frame 10); role metadata tracks net before/after change, matching approved production"

requirements-completed:
  - 37-UAT-THEN-REGRESSION
  - 37-GROUP-DRAG
  - 37-GROUP-DELETE
  - 37-GROUP-FORCE-SPACING
  - 37-ATOMIC-TRANSACTIONS
  - 37-MULTI-SELECT-IDENTITY

coverage:
  - id: D1
    description: "Locked group-operation mappings, selection reducers, D-17 aftermath, and group presentation are executable regression anchors; full suite + typecheck + build green"
    requirement: "37-UAT-THEN-REGRESSION"
    verification:
      - kind: automated
        ref: "pnpm vitest run (849 passed / 0 failed); pnpm typecheck (0); pnpm build (0)"
        status: pass
    human_judgment: false
    rationale: "D-18 post-UAT plan: approval was the human gate (37-05); this plan is deterministic lock-in"

# Metrics
duration: ~7min
completed: 2026-07-27
status: complete
---

# Phase 37 Plan 06: Post-UAT Regression Lock-In Summary

**Locked the UAT-approved Phase 37 group-operation contract as 33 executable regression anchors across three test files — full suite 849 passed / 0 failed, typecheck and build green, zero production edits**

## D-18 Approval Assertion (gate evidence)

Asserted BEFORE any test file was created or any vitest command ran:

- `.planning/phases/37-multi-select-physical-roto-keys/37-05-SUMMARY.md` exists with `status: complete` and records the user's final ruling verbatim: **"approved — s2-s10 pass; q1-q4 confirmed"** (10/10 UAT sections passed, 3/3 UI backstops confirmed, Q1–Q4 rulings CONFIRMED).
- Precondition production symbols verified by grep: `move-key-group` x23 (>= 4), selection reducer exports x4 (>= 4), `resolvePostAcceptanceRotoSelection` x1, `getRotoCellSelectedTooltipCopy` x1, `movedKeyIds` x2 — all met.

## Performance

- **Duration:** ~7min
- **Started:** 2026-07-27T07:08:19Z
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files modified:** 3 (test files only: two NEW, one EXTENDED; zero production, zero test-config)

## Accomplishments

- NEW `physicsPaintRotoPhysicalResolver.test.ts` (11 tests): locked GD-1 (A@1,B@7,D@8,C@9; selected B; drag metadata movedKeyIds [B,C], grabbed/movedKeyId B; 'Keys moved'), GD-2 atomic reject (`duplicate-destination-frame`, conflictingAppFrames [8], no proposal), GD-3 (A@1,B@10,D@11,C@12; selected B), move-key-group intent validation (`unknown-operation-identity` / `duplicate-id` / `malformed-identity` for grabbed-outside-set), GDel-1 (A@1,D@8; survivor D; removedKeyIds [B,C]; 'Keys deleted'), GDel-2 delete-to-empty (empty mapping, null selection), GDel idempotency fail-closed, GFS-1 scoped accept (A@1,B@3,C@6,D@10), GFS-2 hard-wall reject (conflictingAppFrames [10]), GFS-3 null+undefined scope = full-timeline 36.14 path (A@1,B@4,C@7,D@10), `invalid-spacing` for negative/fractional emptyFrames in both scopes. Atomicity locked: every reject asserts `ok === false` with no reachable proposal; every accept asserts 1:1 intent-kind/operation-kind correspondence.
- NEW `physicsPaintRotoMultiSelection.test.ts` (18 tests): select-all ordering + empty-set, toggle add/remove/no-duplicate/never-empty/Q1 current-transfer (next-in-identity-order + previous fallback), range extension anchor semantics + Q2 current-transfer + null-anchor/unknown-target fail-closed, collapse, unknown-keyId fail-closed, D-17 four-rule aftermath (`move-key-group` keep set + anchor to grabbed, `force-spacing` unchanged, `delete-key-group` collapse to survivor, default collapse to accepted selectedKeyId).
- EXTENDED `physicsPaintWorkflowPresentation.test.ts` (+4 tests; existing blocks untouched): moved-set roles over a REAL GD-1 resolver proposal (B@7 and C@9 'moved', rippled D@8 'shifted', A@1 'idle'; grabbed identified via movedKeyId), single-key fallback path unchanged, exact selected-tooltip copy (`Selected key` / `Selected key — {lowercased base copy}` for all four other bases).

## Task Commits

1. **Task 1 (tracer): move-key-group resolver section (GD-1..GD-3 + intent validation)** — `d251d374` (test)
2. **Task 2: delete-key-group + scoped force-spacing sections (GDel/GFS + fail-closed)** — `70201c6c` (test)
3. **Task 3: selection reducers + group presentation + final phase gate** — `5e486e60` (test)

Tracer feedback gate (autonomous): the tracer's `<verify>` re-ran green end-to-end before expansion tasks began.

## Final Phase Gate (verbatim outputs)

1. `pnpm vitest run` — `Test Files 84 passed | 3 skipped (87)` / `Tests 849 passed | 1 skipped | 101 todo (951)` — **0 failed**, exit 0.
2. `pnpm typecheck` (`tsc --noEmit`) — exit 0, no output.
3. `pnpm build` — `✓ 1086 modules transformed.` / `✓ built in 926ms` — exit 0.

**Pass-count delta:** this plan added exactly 33 tests (resolver +11, multi-selection +18, presentation +4). The 36.14-30 reference baseline of 717 passed predates intervening authorized test work; the pre-plan suite was 816 green (849 − 33), all in files untouched by this plan. No failure occurred in any file outside this plan's scope.

**Scope gate:** `git status --porcelain` across the plan showed exactly the three test files; zero production source files, zero test-config files touched. The moved-set view-model test's proposal comes from a real resolver call (`resolvePhysicPaintRotoPhysicalEdit` appears 3x in the new presentation describe section).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected single-key fallback test expectation for D's presentation role**
- **Found during:** Task 3 (first run of the extended presentation file, 1 failure)
- **Issue:** The test authored by this plan expected the rippled unselected key D at frame 10 to carry role `shifted` in the single-key move B@3→6. Production (correctly, per approved D-29 cut-and-insert) ripples D 10→9→10 for a NET zero change, so D carries no change entry and the view model assigns role `idle`.
- **Classification:** test-authoring error in this plan's own expectation, NOT a production regression — the final mapping A@1,C@4,B@6,D@10 matched the approved semantics exactly; no production edit was made or considered.
- **Fix:** Asserted D@10 role `idle` with an explanatory comment (net-zero ripple → idle).
- **Files modified:** `app/src/components/physic-paint/view/physicsPaintWorkflowPresentation.test.ts`
- **Commit:** `5e486e60`

No halted regression signals occurred; every production behavior matched the UAT-approved contract on first assertion.

## Known Stubs

None — all three test files assert real production behavior with no placeholders, mocks, or fabricated proposals.

## Auth Gates

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 37 regression lock-in is complete; the phase's full contract (resolver group intents, selection model, presentation) is now executable. Any future drift from the approved GD/GDel/GFS mappings, selection semantics, or presentation roles fails deterministically.
- 36.14's deferred single-key resolver coverage remains a separate authorized follow-up (intentionally out of scope here per must_haves.prohibitions).
- No blockers.

## Self-Check: PASSED

All four artifacts exist on disk and all three task commits exist in git history (d251d374, 70201c6c, 5e486e60).

---
*Phase: 37-multi-select-physical-roto-keys*
*Completed: 2026-07-27*
