---
phase: 64
review: 64-REVIEW.md
titles: json
findings:
  - id: CR-03
    severity: critical
    disposition: open
    title: "last-touch ping-pong corrupts the field outside the current dab"
  - id: CR-04
    severity: critical
    disposition: open
    title: "coverage-composite white-fill inverts the merge law and wipes the committed base"
  - id: WR-03
    severity: warning
    disposition: open
    title: "last-touch raw stamps are carried across a time-base reset"
  - id: WR-04
    severity: warning
    disposition: open
    title: "a committed-frame relight refused during playback/draft/wireframe is permanently dropped"
  - id: IN-04
    severity: info
    disposition: open
    title: "`uAmount` is a dead uniform in `bristleTouchFS`"
  - id: IN-05
    severity: info
    disposition: open
    title: "`seedSignature` under-specifies the cached sheet's script identity"
  - id: IN-06
    severity: info
    disposition: open
    title: "dead seed path: `seedAquarelleEngine`, the adapter's injected engine/clock, and `yieldToHostMs`"
  - id: IN-07
    severity: info
    disposition: open
    title: "pickup probe invariant cannot detect a collapsed dynamic range"
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
open: 15
total: 15
recorded: 2026-11-22T13:34:20.872Z
---

# Phase 64: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-03 | critical | open | - |
| CR-04 | critical | open | - |
| WR-03 | warning | open | - |
| WR-04 | warning | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| CR-01 | critical | open | - (not in the current review) |
| CR-02 | critical | open | - (not in the current review) |
| WR-01 | warning | open | - (not in the current review) |
| WR-02 | warning | open | - (not in the current review) |
| IN-01 | info | open | - (not in the current review) |
| IN-02 | info | open | - (not in the current review) |
| IN-03 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
