---
phase: 37-multi-select-physical-roto-keys
plan: 05
subsystem: testing
tags: [uat, physics-paint, roto, multi-select, native-verification]

# Dependency graph
requires:
  - phase: 37-multi-select-physical-roto-keys (plans 37-01..37-04)
    provides: group drag/delete/force-spacing resolvers, selection Signals, coordinator transactions, strip gestures and visuals
provides:
  - Executable native UAT script (37-UAT.md) with all results recorded verbatim
  - Explicit user approval passing the Phase 37 UAT gate
  - Four flagged-assumption rulings (Q1-Q4) locking the group-operation contract
  - Plan 37-06 eligibility per D-18
affects: [37-06, phase-37-closure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Native user-owned UAT gate before regression test authoring (D-18)"
    - "Verbatim outcome recording: the agent transcribes, never declares a pass"

key-files:
  created:
    - .planning/phases/37-multi-select-physical-roto-keys/37-UAT.md
    - .planning/phases/37-multi-select-physical-roto-keys/37-05-SUMMARY.md
  modified: []

key-decisions:
  - "Q1 CONFIRMED: toggling out the current editing key transfers the current highlight to the next selected key in frame order (fallback previous); removal no-ops when it would empty the set"
  - "Q2 CONFIRMED: shift-click makes the clicked key the current editing key"
  - "Q3 CONFIRMED: Select All icon sits at the end of the key-utilities pill, immediately after Delete and before the Key spacing form"
  - "Q4 CONFIRMED: group-reject diagnostic detail routes through the console diagnostic channel (console.error('[PhysicsPaintStudio] physical edit:', ...)), no new LOG surface"

patterns-established:
  - "UAT-then-regression: no vitest/typecheck/build gates or test artifacts in the UAT plan; all of that belongs to 37-06 after approval"

requirements-completed:
  - 37-UAT-THEN-REGRESSION
  - 37-DOWNSTREAM-PARITY
  - 37-UI-INTEGRATION

coverage:
  - id: D1
    description: "Native UAT of all locked group-operation mappings (GD-1..GD-3, GDel-1..GDel-2, GFS-1..GFS-3), selection gestures, backstops, downstream parity, and non-regression sweep"
    requirement: "37-UAT-THEN-REGRESSION"
    verification:
      - kind: manual_procedural
        ref: ".planning/phases/37-multi-select-physical-roto-keys/37-UAT.md (10/10 sections pass; ruling: \"approved — s2-s10 pass; q1-q4 confirmed\")"
        status: pass
    human_judgment: true
    rationale: "D-18 requires native user verification and explicit typed approval; automation cannot waive it"

# Metrics
duration: ~2h 30m (across user UAT sessions)
completed: 2026-07-27
status: complete
---

# Phase 37 Plan 05: Native UAT Gate Summary

**User-approved native UAT of Phase 37 multi-select physical Roto keys: 10/10 script sections passed, 3/3 UI backstops visually confirmed, 4/4 flagged-assumption questions confirmed — plan 37-06 eligible per D-18**

## Performance

- **Duration:** ~2h 30m across native user UAT sessions
- **Started:** 2026-07-26T21:38:20Z
- **Completed:** 2026-07-27
- **Tasks:** 3
- **Files modified:** 2 (both `.planning/` documentation artifacts)

## Accomplishments

- Materialized the executable native UAT script `37-UAT.md` (36.14-UAT.md format): 10 numbered sections anchored on the locked mappings GD-1..GD-3 / GDel-1..GDel-2 / GFS-1..GFS-3, the three 37-UI-SPEC backstops verbatim, the downstream parity checklist, and four flagged-assumption questions.
- Tracer gate (S1, GD-1 happy path) passed natively before any other section ran: final map exactly A@1, B@7, D@8, C@9 with payloads preserved, group selection aftermath correct, exactly one history entry, exact Undo/Redo round-trip.
- User ran the full remaining script (S2..S10) natively and reported all sections pass; every locked mapping, both delete routes, all Force Spacing scopes and rejections, the complete selection gesture set, both Select All routes, all three UI backstops, the full downstream parity checklist (save/reopen, live pixels, caches, dirty state, playback, onion/reference, preview, export, missing/background, timeline extent, interpolation-ENABLED group drag), and the non-regression sweep (single-key D-29 anchors, frame-6 drag, single-key utilities, interpolation toggle, Basic perfect-freehand and FX p5.brush layers unchanged).
- Recorded the user's explicit rulings on all four flagged assumptions (Q1 toggle-out-current transfer, Q2 shift-click current-transfer, Q3 Select All placement, Q4 console diagnostic routing) — all CONFIRMED.
- Recorded the user's final ruling verbatim: **"approved — s2-s10 pass; q1-q4 confirmed"** — UAT PASSED; plan 37-06 (post-UAT regressions, typecheck, build) is now eligible per D-18.

## Task Commits

Each task was committed atomically:

1. **Task 1: Materialize the executable native UAT script (37-UAT.md)** - `46965f24` (docs)
2. **Task 2 (TRACER gate): GD-1 group drag happy path recorded as pass** - `f40743f4` (docs)
3. **Task 3: S2-S10 results, Q1-Q4 rulings, and user approval recorded** - `2e09e0fb` (docs)

## Files Created/Modified

- `.planning/phases/37-multi-select-physical-roto-keys/37-UAT.md` - Executable native UAT script with every section's verbatim result, the four question rulings, the final approval, and `status: resolved`
- `.planning/phases/37-multi-select-physical-roto-keys/37-05-SUMMARY.md` - This outcome record

## Decisions Made

The four flagged planner assumptions received explicit user rulings and are now locked as the group-operation contract:

- **Q1 (37-02):** Toggling out the current editing key transfers the current highlight to the next selected key in frame order (fallback: previous); removal no-ops when it would empty the set. CONFIRMED.
- **Q2 (37-02/37-04):** Shift-click makes the clicked key the current editing key. CONFIRMED.
- **Q3 (37-04 Pitfall 7):** Select All icon placement at the end of the key-utilities pill, immediately after Delete and before the Key spacing form. CONFIRMED.
- **Q4 (37-03):** Reject detail routing through the console diagnostic channel (`console.error('[PhysicsPaintStudio] physical edit:', …)`), mirroring the coordinator's logDiagnostic style, with no new LOG surface after the 36.15-11 LOG-tab retirement. CONFIRMED.

## Deviations from Plan

None - plan executed exactly as written. Docs-only plan; zero production source files touched (verified: `git status --porcelain -- app packages` clean), zero test artifacts created or executed (D-18).

## Issues Encountered

None. Every UAT section passed on first native run; no failure reports, no gap-closure routing required.

## Per-Section Results (recorded verbatim in 37-UAT.md)

| Section | Scope | Result |
| ------- | ----- | ------ |
| S0 | Baseline setup (A@1, B@3, C@5, D@10) | pass |
| S1 | GD-1 happy path (TRACER) → A@1, B@7, D@8, C@9 | pass ("gd1 pass") |
| S2 | GD-2 atomic reject + blocked preview (BACKSTOP 1) | pass |
| S3 | GD-3 occupied caret → A@1, B@10, D@11, C@12 | pass |
| S4 | GDel-1 toolbar + Backspace routes → A@1, D@8 | pass |
| S5 | GDel-2 Select All + Delete → empty timeline | pass |
| S6 | GFS-1/2/3 + N validation | pass |
| S7 | Selection gestures + Q1-Q4 rulings | pass; Q1-Q4 confirmed |
| S8 | UI backstops 2 and 3 | pass (visually confirmed) |
| S9 | Downstream parity checklist | pass |
| S10 | Non-regression sweep (single-key anchors, Basic/FX) | pass |

**Final ruling (verbatim):** "approved — s2-s10 pass; q1-q4 confirmed"

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 37-06 is ELIGIBLE per D-18** (explicit user approval on record): post-UAT regression tests, typecheck, and build may now proceed.
- The confirmed Q1-Q4 rulings and all locked mappings are the authoritative contract for the 37-06 regression suite.
- No blockers.

---
*Phase: 37-multi-select-physical-roto-keys*
*Completed: 2026-07-27*
