---
phase: 64
review: 64-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "64-27 — a relight request in the frame between playback start and the gate-effect flush is dropped, not parked"
  - id: WR-02
    severity: warning
    disposition: open
    title: "64-25 — the coverage read's dimension guard is vacuous; a mis-sized coverage raster is silently cropped instead of scaled"
  - id: IN-01
    severity: info
    disposition: open
    title: "the `pow` LUT size claim is wrong by 4× (64 KiB vs 256 KiB)"
  - id: IN-02
    severity: info
    disposition: open
    title: "`rememberSheet` can park a sheet that `restoreCachedSheet` can never take (empty event list)"
  - id: IN-03
    severity: info
    disposition: open
    title: "`travel()` is a whole-target last-touch write that does not invalidate the carry"
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
open: 15
total: 15
recorded: 2026-11-22T16:44:50.062Z
---

# Phase 64: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| CR-03 | critical | open | - (not in the current review) |
| CR-04 | critical | open | - (not in the current review) |
| WR-03 | warning | open | - (not in the current review) |
| WR-04 | warning | open | - (not in the current review) |
| IN-04 | info | open | - (not in the current review) |
| IN-05 | info | open | - (not in the current review) |
| IN-06 | info | open | - (not in the current review) |
| IN-07 | info | open | - (not in the current review) |
| CR-01 | critical | open | - (not in the current review) |
| CR-02 | critical | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
