---
phase: 63
review: 63-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "Cross-layer guard disagreement silently blinds the Studio catalog and writes mask-less Roto scripts"
  - id: WR-01
    severity: warning
    disposition: open
    title: "The \"never throws\" wire guards call an unguarded `atob`"
  - id: WR-02
    severity: warning
    disposition: open
    title: "One degraded custom tip blocks every Roto script save, including scripts that never used it"
  - id: WR-03
    severity: warning
    disposition: open
    title: "An absent catalog is indistinguishable from a project with no imports, so scripts are saved without masks"
  - id: WR-04
    severity: warning
    disposition: open
    title: "A publish failure after the mutation destroys the import answer and reports a false timeout"
  - id: WR-05
    severity: warning
    disposition: open
    title: "Mask ids are not reserved — a script or package can shadow a built-in mask"
  - id: WR-06
    severity: warning
    disposition: open
    title: "Unbounded asset read precedes the digest and dimension guards"
  - id: WR-07
    severity: warning
    disposition: open
    title: "The project save can silently erase the whole brush pack"
  - id: IN-01
    severity: info
    disposition: open
    title: "Redundant rejection arm"
  - id: IN-02
    severity: info
    disposition: open
    title: "Dead docker modified with a mask-dropping importer"
  - id: IN-03
    severity: info
    disposition: open
    title: "Entry guard omits the id/name length caps it defines"
  - id: IN-04
    severity: info
    disposition: open
    title: "The import request mask is decoded twice"
open: 12
total: 12
recorded: 2026-11-15T13:40:00.000Z
---

# Phase 63: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| WR-07 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently.
