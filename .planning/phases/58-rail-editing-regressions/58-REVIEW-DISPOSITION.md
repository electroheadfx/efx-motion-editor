---
phase: 58
review: 58-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: open
    title: "Rail insert plan compares a source-key COUNT with a cycle SPAN, rejecting every insert at or left of a spaced rail"
  - id: CR-04
    severity: critical
    disposition: open
    title: "Ghost-source guard only inspects the moved key's referencing clip; cross-clip ripples still erase source keys"
  - id: CR-05
    severity: critical
    disposition: open
    title: "Append bypasses the Standard/reveal/script discriminator and mutates Playscript and Reveal rails"
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
  - id: WR-05
    severity: warning
    disposition: open
    title: "Append ripples every trailing key and clip by the full band growth, including content beyond the destination"
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
    title: "Shared override keyIds are not guarded by the paste rail insert path"
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
  - id: IN-08
    severity: info
    disposition: open
    title: "Append tests use a document shape the parser rejects, and the hook test does not assert the new key's frame"
  - id: IN-09
    severity: info
    disposition: open
    title: "No regression test for CR-01's spaced-rail insert-slot path"
  - id: IN-10
    severity: info
    disposition: open
    title: "Ghost-guard tests miss the cross-clip ripple and the group-drag band staleness"
  - id: WR-04
    severity: warning
    disposition: open
    title: "Deleting the first phase of a spaced source cycle silently degrades from contraction to hole semantics"
  - id: CR-03
    severity: critical
    disposition: fixed
    title: "Partial-cycle group move bypasses the source-order invariant established for `move-key`"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "Law A single-loop move can invalidate the loop's source order"
open: 18
total: 20
recorded: 2026-11-05T11:19:33.206Z
---

# Phase 58: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | open | - |
| CR-04 | critical | open | - |
| CR-05 | critical | open | - |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| WR-05 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| WR-04 | warning | open | - (not in the current review) |
| CR-03 | critical | fixed | 58-10 (not in the current review) |
| CR-02 | critical | fixed | 58-07 (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
