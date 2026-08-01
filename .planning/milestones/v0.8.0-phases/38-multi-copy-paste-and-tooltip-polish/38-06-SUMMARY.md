---
phase: 38-multi-copy-paste-and-tooltip-polish
plan: 06
subsystem: verification
tags: [physics-paint, roto, uat, checkpoint, native-acceptance]

requires:
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 01
    provides: Group clipboard slot and group Copy with `Copied {N} keys` feedback
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 02
    provides: paste-key-group resolver/coordinator/bridge seam with atomic all-empty-or-reject
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 03
    provides: Capsule idle current-cell context with the permanent baseline deleted
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 04
    provides: Group paste activation, locked busy/success/reject copy, one Undo/Redo, post-paste selection
  - phase: 38-multi-copy-paste-and-tooltip-polish
    plan: 05
    provides: Viewport-positioned tooltip rework with directional notch and multiline clamp
  - phase: 38.1-studio-render-path-performance
    plan: 18
    provides: Phase 38.1 completion — render-path performance acceptance unblocking this checkpoint
provides:
  - Explicit user approval of the full 33-step native UAT script (group Copy/Paste, capsule idle context, tooltips, downstream parity)
  - Human evidence for the two UI-SPEC backstop rows (steps 26 viewport clamp/flip; 27 notch tracks clamped control)
  - D-15 gate lift: wave-4 regression plans 38-07 and 38-08 are now eligible
affects: [38-07, 38-08, phase-38-closure]

tech-stack:
  added: []
  patterns:
    - "Checkpoint-only plan: the agent presents the numbered script and records the verdict; no code or test artifacts are touched (D-15)"

key-files:
  created:
    - .planning/phases/38-multi-copy-paste-and-tooltip-polish/38-06-SUMMARY.md
  modified: []

key-decisions:
  - "The user owns the server and native app; the agent launched no server, browser, or native runtime."
  - "Approval converts Plans 38-01..38-05 from automated-ready to accepted behavior and is the only condition that unblocks wave 4 (38-07/38-08)."
  - "Zero test files were created, modified, renamed, or executed during this checkpoint; the known-red physicsPaintWorkflowPresentation.test.ts:159-225 baseline assertions remain expected pre-38-08 state (Pitfall 5)."

requirements-completed:
  - 38-UAT-THEN-REGRESSION
  - 38-DOWNSTREAM-PARITY

coverage:
  - id: A-D
    description: "Group Copy/Paste accept and reject paths, one Undo/Redo, single-key paths unchanged"
    requirement: 38-UAT-THEN-REGRESSION
    verification:
      - kind: manual_procedural
        ref: "Native UAT steps 1-14 — user-approved"
        status: pass
    human_judgment: true
  - id: E
    description: "Capsule idle current-cell context; permanent baseline never appears; playback/feedback arbitration"
    requirement: 38-UAT-THEN-REGRESSION
    verification:
      - kind: manual_procedural
        ref: "Native UAT steps 15-20 — user-approved"
        status: pass
    human_judgment: true
  - id: F
    description: "Tooltip placement/notch/multiline across all regions including both UI-SPEC backstops"
    requirement: 38-UAT-THEN-REGRESSION
    verification:
      - kind: manual_procedural
        ref: "Native UAT steps 21-29, backstops 26-27 — user-approved"
        status: pass
    human_judgment: true
  - id: G
    description: "Downstream parity: save/reopen, playback, preview/export, cached reference/onion, timeline extent"
    requirement: 38-DOWNSTREAM-PARITY
    verification:
      - kind: manual_procedural
        ref: "Native UAT steps 30-33 — user-approved"
        status: pass
    human_judgment: true

metrics:
  duration: user-owned native session
  tasks: 1
  files: 1 planning file
  completed: 2026-07-29

status: complete
---

# Phase 38 Plan 06: Blocking Native UAT Checkpoint Summary

**The user explicitly approved the full 33-step native UAT script on 2026-07-29. Plans 38-01 through 38-05 are now accepted behavior, and wave-4 regression plans 38-07 and 38-08 are unblocked.**

## Verdict

- **Verbatim user verdict:** `approved`
- **Failing steps:** none — all 33 steps passed in the user-owned native runtime.
- **Owning-plan routing:** not applicable; no rejection to route.

## Backstop Evidence

Both UI-SPEC `{ verification: backstop }` rows received human evidence from the approval of the full script:

- **Step 26 — viewport clamp/flip:** tooltips stay fully inside the window with the ~8px margin and flip side when the preferred side lacks room.
- **Step 27 — notch tracking when clamped:** the notch still points at its source control when the pill body is shifted sideways by the clamp.

## D-15 Gate Discipline

- Zero test files created, modified, renamed, or executed during this checkpoint.
- The known-red `physicsPaintWorkflowPresentation.test.ts:159-225` baseline assertions remain untouched and expected pre-38-08 state; no test work happened here.
- The agent launched no server, browser, or native app; the user ran everything natively.

## Prerequisite Context

This checkpoint was blocked until Phase 38.1 completed. Phase 38.1 Plan 18 native acceptance passed on 2026-07-29 and the phase re-verification scored 20/20 (commit `5c88edb0`), making this checkpoint eligible.

## Next Phase Readiness

- Plans 38-07 and 38-08 (post-UAT regression test plans) are now eligible — the D-15 gate has lifted.
- 38-08 owns the rewrite of the three known-red D-15 deferred assertions (header-tooltip placement and the two ambient-baseline capsule assertions).

---

*Phase: 38-multi-copy-paste-and-tooltip-polish*
*Completed: 2026-07-29*
