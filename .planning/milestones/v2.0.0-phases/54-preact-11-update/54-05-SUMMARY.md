---
phase: 54-preact-11-update
plan: 05
subsystem: testing
tags: [paintversion, preact11, contract-pin, d11, run-05, run-06, source-scan, live-uat]

# Dependency graph
requires:
  - phase: 54-03
    provides: "Workspace on preact@11.0.1 + @preact/signals@2.11.3 with one preact copy"
  - phase: 54-04
    provides: "tsc green on Preact 11 after mechanical JSX/Ref type migration"
provides:
  - "Standing paintVersion discipline contract pin (D-11 / RUN-05) at app/src/paintVersionDisciplineContract.test.ts"
  - "A1-A5 live UAT row set user-asserted PASS (RUN-06) — Phase 54 hard gate cleared"
affects: [55-efx-paint-host, phase-54-close]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 2719
  tasks: 2
  commits: 1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "paintVersion bump+subscribe source-contract pin (releaseContract.test.ts style): positive source assertions over negative greps"
    - "PINS_GREEN_AT_BIRTH preservation pin of already-shipped discipline — not a manufactured RED"

key-files:
  created:
    - app/src/paintVersionDisciplineContract.test.ts
  modified: []

key-decisions:
  - "Preservation pin is green at birth on unchanged sources — recorded honestly (PINS_GREEN_AT_BIRTH), not manufactured red; the plan explicitly names this path for a D-11 preservation pin"
  - "D-11 held: no subscribe effect rewritten into cleanup-based correctness; no production source touched by this plan"
  - "Compare-then-write truth pinned as source shape (early-return before write) — setRotoPlaybackSettings + setRotoBackgroundMetadata"
  - "RUN-05 marked complete on the pin's proof; RUN-06 closed on live UAT (A1-A5 all PASS 2026-10-14) — Phase 54 hard gate cleared"

patterns-established:
  - "paintVersion discipline contract pin: PaintOverlay requestPreview idiom (body read + same .value in dep array) + bump helpers + compare-then-write setters"

requirements-completed: [RUN-05, RUN-06]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Standing paintVersion discipline contract pin (app/src/paintVersionDisciplineContract.test.ts) — bump+subscribe shape, version-clock bumps, compare-then-write setters"
    requirement: "RUN-05"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/paintVersionDisciplineContract.test.ts (5 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live UAT rows A1-A5 — reactivity paths under Preact 11 (paint stroke, undo/redo, track switch, Studio open/close dispose, standalone ./preact mount)"
    requirement: "RUN-06"
    verification:
      - kind: manual_procedural
        ref: "Live UAT 2026-10-14 — A1-A5 all PASS (user-asserted, see Live UAT Rows section)"
        status: pass
    human_judgment: true
    rationale: "A1-A5 are live-judged reactivity paths (D-03 hard gate). A4 (no orphaned subscription after Studio dispose) and A5 (package entry still mounts) cannot be unit-pinned. Export smoke and chunk-budget checks are release gates and do NOT enter this row set."

# Metrics
duration: 5min
completed: 2026-10-14
status: complete
---

# Phase 54 Plan 05: paintVersion discipline pin + A1-A5 live UAT Summary

**D-11 paintVersion bump+subscribe source-contract pin green at birth; A1-A5 live UAT all PASS — RUN-06 hard gate cleared for Phase 55**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-14T15:37:10Z
- **Completed:** 2026-10-14T15:42:25Z
- **Tasks:** 2 (Task 1 committed; Task 2 live UAT asserted PASS 2026-10-14)
- **Files modified:** 1 (created)

## Accomplishments

- Standing paintVersion discipline contract pin at `app/src/paintVersionDisciplineContract.test.ts` (5 source-scan assertions, permanent)
- Positive source assertions on the three named surfaces: `PaintOverlay.tsx` requestPreview idiom, `physicPaintStore.ts` bump helpers + compare-then-write setters, `paintStore.ts` `_notifyVisualChange`
- Full suite green (4926 passed / 271 files) and `tsc --noEmit` clean before the rows were presented
- A1-A5 live UAT **all PASS (user-asserted 2026-10-14)** — RUN-06 hard gate cleared; Phase 55 may open

## Task Commits

Each task was committed atomically:

1. **Task 1: RED/GREEN paintVersion discipline contract pin** - `6cfd5013` (test)
2. **Task 2: Live UAT close — reactivity paths A1-A5** - no code commit (verification/presentation task; automated gates recorded below)

**TDD note:** Task 1 is `tdd="true"` but `is-behavior-adding=false` (test-only files). The pin is a **preservation pin** of already-shipped discipline and was **green at birth** on unchanged sources — the plan's action explicitly names this path ("If the pin is green at birth on the unchanged sources, record that honestly in the SUMMARY (this is a preservation pin, not a feature)"). No feat commit exists because no implementation was required. See TDD Gate Compliance below.

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (`test(54-05):`) | `6cfd5013` | Present — pin authored and committed |
| GREEN (`feat(54-05):`) | — | **Not applicable** — preservation pin, green at birth (PINS_GREEN_AT_BIRTH); no implementation step |
| REFACTOR | — | None needed |

**Honest verdict: PINS_GREEN_AT_BIRTH.** The five assertions passed against the unchanged Preact-11 sources on first run (`5 passed`). This is the expected outcome for a D-11 preservation pin — the discipline it names was not rewritten during the bump. Manufacturing a RED by temporarily breaking production source would have been theater and is rejected. `is-behavior-adding=false` exempts this task from the MVP+TDD runtime gate (test-only `<files>`).

## Files Created/Modified

- `app/src/paintVersionDisciplineContract.test.ts` - Permanent D-11 / RUN-05 source-contract pin (5 assertions):
  1. `PaintOverlay.tsx` keeps a bump+subscribe effect (body reads `paintStore.paintVersion.value`, same read in dep array)
  2. `physicPaintStore.ts` `bumpTrackRevision` still does `entry.paint.value++` / `entry.roto.value++` / `physicPaintVersion.value++`
  3. `paintStore.ts` `_notifyVisualChange` still does `paintVersion.value++`
  4. `setRotoPlaybackSettings` still early-returns before any write when loop+fps match (compare-then-write)
  5. `setRotoBackgroundMetadata` still early-returns on multi-field equality before write / `bumpTrackRevision`

## Automated Gate Results (recorded before presenting rows)

| Gate | Command | Result |
|------|---------|--------|
| Unit suite | `pnpm --filter efx-motion-editor exec vitest run` | **PASS** — 271 files (2 skipped), 4926 passed / 1 skipped / 96 todo |
| Contract pin | `pnpm --filter efx-motion-editor exec vitest run src/paintVersionDisciplineContract.test.ts` | **PASS** — 5/5 |
| Typecheck | `pnpm --filter efx-motion-editor run typecheck` | **PASS** — `tsc --noEmit` clean |

## Live UAT Rows A1-A5 — USER-ASSERTED PASS (RUN-06 hard gate CLEARED)

> All five rows asserted PASS by the user on 2026-10-14. Phase 55 may open.
> Export smoke and chunk-budget checks are release gates, not Preact gates — they do NOT enter this row set (D-03).

| Row | What to check | Live observation | Result |
|-----|---------------|------------------|--------|
| **A1** | Paint a stroke in Studio — canvas reflects it without a manual refresh (paintVersion bump + subscribe path) | Stroke appears on the Studio canvas immediately, no manual refresh, no slowdown or visual artifact. paintVersion bump + subscribe path is live. | **PASS** |
| **A2** | Undo/redo — canvas and timeline rail both follow | Undo/redo keeps canvas and timeline rail in sync, no desync between the two surfaces. | **PASS** |
| **A3** | Track switch / active-track change — runtime view follows without a stale render | Active-track switch updates the runtime view with no stale render from the previous track. | **PASS** |
| **A4** | Studio open/close round trip — no orphaned subscription, no zombie effect after dispose | No zombie effect. Profile counters show the dispose path actually ran: `lifecycle.canvasMount.beforeDestroy: 1` and `observer.canvasMount.resize.cleanup: 1` against `install: 2` (one closed instance cleaned up, one currently mounted). No idle `render.*` churn, no slowdown after close, `decode.*` all zero. | **PASS** |
| **A5** | `packages/efx-physic-paint` standalone entry (`./preact`) still mounts | `packages/efx-physic-paint` standalone `./preact` entry mounts via the package demo, no `import/preact` error. | **PASS** |

A4 and A5 see this phase's two named failure modes (zombie subscriptions after Preact 11 deferred cleanups; package-entry breakage from the single-preact-copy proof) — both disproved live.

## Decisions Made

- **PINS_GREEN_AT_BIRTH recorded honestly.** The pin passed on first run against unchanged sources. This is a preservation pin of D-11 discipline, not a feature — the plan's action names this path. No RED was manufactured.
- **Positive source assertions, not file-wide negative greps.** Each assertion names its surface in the failure message (PaintOverlay.tsx / physicPaintStore.ts / paintStore.ts) and scopes the scan to the named helper (function-body slice) rather than the whole file.
- **Compare-then-write pinned as source shape.** Both setters must early-return before `Map.set` / `bumpTrackRevision` — "called 1000× with the same value, does it bump 0 times?" must be yes (efx-preact-reactivity rule 3).
- **RUN-05 complete on the pin's proof; RUN-06 closed on live UAT.** All five rows user-asserted PASS 2026-10-14. The hard gate held until live evidence arrived; now cleared.

## Deviations from Plan

None - plan executed exactly as written. Green-at-birth was the plan's anticipated happy path for a preservation pin.

## TDD Gate Compliance Detail

See "TDD Gate Compliance" above. Summary: `test(54-05)` commit present; `feat(54-05)` intentionally absent (no implementation required — preservation pin, `is-behavior-adding=false`).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **DONE — live UAT cleared.** RUN-05 and RUN-06 both satisfied. All five A1-A5 rows user-asserted PASS 2026-10-14. **Phase 55 may open** (orchestrator owns phase completion).
- Standing pin will catch any future rewrite of the bump+subscribe shape into cleanup-based correctness (T-54-09 mitigation).
- A4 profile counters (`lifecycle.canvasMount.beforeDestroy`, `observer.canvasMount.resize.cleanup`) remain the standing detection tool for zombie-subscription dispose regressions (T-54-10).

---
*Phase: 54-preact-11-update*
*Completed: 2026-10-14*

## Self-Check: PASSED

- FOUND: `app/src/paintVersionDisciplineContract.test.ts`
- FOUND: `.planning/phases/54-preact-11-update/54-05-SUMMARY.md`
- FOUND: commit `6cfd5013` (test(54-05): add paintVersion discipline contract pin)
- FOUND: commit `a2c1fe0c` (docs(54-05): complete paintVersion-discipline-pin plan)
- Re-ran `pnpm --filter efx-motion-editor exec vitest run src/paintVersionDisciplineContract.test.ts` — 5/5 still green
- Acceptance criteria: AC1 (collected, exit 0) PASS; AC2 (names all three surfaces) PASS; AC3 (no production source modified) PASS
- `commits:` measured from ledger `f1dd602d..a2c1fe0c` = 2
