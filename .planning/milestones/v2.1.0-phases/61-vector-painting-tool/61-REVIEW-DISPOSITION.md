---
phase: 61
review: 61-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Unchanged per-vertex colour commit publishes a false \"refused\" banner"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Paint-control seam swallows refusals; live value and selected strokes silently diverge"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Orphan-focus window key route has no floating-surface guard"
  - id: IN-01
    severity: info
    disposition: open
    title: "`brushMenuPresets` parameter is dead generality"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`addKey` claims `keyActionInFlightRef` after the blank-build await, so a second click can run the sequence twice"
  - id: WR-04
    severity: warning
    disposition: open
    title: "The new curve-mode failure branch omits the reanchor/restore result the path-edit seam already carries"
  - id: IN-02
    severity: info
    disposition: open
    title: "AQTL encode guard fails open on prototype keys (`VECTOR_CURVE_MODE_CODE['constructor']`); decode stays fail-closed"
  - id: IN-03
    severity: info
    disposition: open
    title: "`recordedCurveModeField` has no production caller (necessity) — three seams inline the same rule"
open: 7
total: 8
recorded: 2026-11-12T11:15:42.909Z
---

# Phase 61: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | quick 261112-hfk (c71e3e80f, 749d79dec) — UAT approved 2026-11-12 |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| WR-03 | warning | open | `keyActionInFlightRef` claimed after the first await — double-run window (not in the current review) |
| WR-04 | warning | open | Curve-mode failure branch drops the reanchor/restore result (not in the current review) |
| IN-02 | info | open | Encode guard fails open on prototype keys (not in the current review) |
| IN-03 | info | open | `recordedCurveModeField` has no caller (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
