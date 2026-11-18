---
phase: 64
review: 64-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "A light change never re-lights a committed or cached frame"
  - id: CR-02
    severity: critical
    disposition: open
    title: "One light-slider drag appends one document write and one ledger entry per pointermove, blowing through the 10-entry undo cap"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Fixed draw extents clip the new relief and coverage passes for wide tips"
  - id: WR-02
    severity: warning
    disposition: open
    title: "The two-sheet coverage capture loses its alpha when the coverage export is fully opaque"
  - id: IN-01
    severity: info
    disposition: open
    title: "Dead `coeffsOpacity` in the shipped package with a false docstring"
  - id: IN-02
    severity: info
    disposition: open
    title: "`fillStep` applies scattering but no Body cover/thickness"
  - id: IN-03
    severity: info
    disposition: open
    title: "Azimuth 360 wraps to 0, making the slider knob snap to the left end on release"
open: 7
total: 7
recorded: 2026-11-18T19:45:33.404Z

---

# Phase 64: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| CR-02 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
