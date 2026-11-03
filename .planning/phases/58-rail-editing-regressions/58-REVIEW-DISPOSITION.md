---
phase: 58
review: 58-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "Rail insert plan compares a source-key COUNT with a cycle SPAN, rejecting every insert at or left of a spaced rail"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Paint/+Key rail insert never grows capacity, so it fails when trailing content sits at the document tail"
  - id: WR-02
    severity: warning
    disposition: open
    title: "G-04 retime is silently discarded when the retimed band exceeds capacity"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Insert-slot rail growth swallows trailing content into the grown band for repeat > 1"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Deleting the first phase of a spaced source cycle silently degrades from contraction to hole semantics"
  - id: IN-01
    severity: info
    disposition: open
    title: "Dead `frameOwners` map in the rail insert target resolver"
  - id: IN-02
    severity: info
    disposition: open
    title: "Unused export silently drops Group override records"
  - id: IN-03
    severity: info
    disposition: open
    title: "Shared override keyIds are not guarded by either rail insert path"
  - id: IN-04
    severity: info
    disposition: open
    title: "Insert classifier and resolver disagree about override-record requirements"
  - id: IN-05
    severity: info
    disposition: open
    title: "Ambiguous rail target silently falls back to a detached key insert"
  - id: IN-06
    severity: info
    disposition: open
    title: "Impossible-state guard — nullable capacity in `resolveGroupBoundedEnd`"
  - id: IN-07
    severity: info
    disposition: open
    title: "`isCanonicalLifecycleRailClip` does not require `placementStart === phaseOrigin`, while retiming rewrites `phaseOrigin = placementStart`"
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "Partial-cycle group move bypasses the source-order invariant established for `move-key`"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "Law A single-loop move can invalidate the loop's source order"
open: 12
total: 14
recorded: 2026-11-03T20:32:00.000Z
---

# Phase 58: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| CR-03 | critical | fixed | 58-10 (not in the current review) |
| CR-02 | critical | fixed | 58-07 (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
