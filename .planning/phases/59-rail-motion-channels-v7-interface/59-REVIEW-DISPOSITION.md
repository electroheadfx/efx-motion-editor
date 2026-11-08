---
phase: 59
review: 59-REVIEW.md
titles: json
findings:
  - id: CR-05
    severity: critical
    disposition: skipped
    title: "Deleting a real key the cycle does not reference silently dissolves the entire Rail cycle (vacuous `.every()`)"
  - id: WR-07
    severity: warning
    disposition: open
    title: "The Motion sheet's \"All\" easing button commits twice in property mode"
  - id: IN-06
    severity: info
    disposition: open
    title: "Unreachable zero-key guard in the apply-all easing command (necessity)"
  - id: IN-07
    severity: info
    disposition: open
    title: "Never-instantiated disabled/reason props on the shared easing control (necessity)"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Canonical number encoding diverges for exponent-notation magnitudes; an in-domain scale/rotation value can never settle"
  - id: WR-01
    severity: warning
    disposition: open
    title: "The canonical ordering/encoding law assumes ASCII ids but no boundary enforces it"
  - id: WR-02
    severity: warning
    disposition: open
    title: "Cross-track Loop Clip materialized source frames are outside the paste extent/occupancy model"
  - id: IN-01
    severity: info
    disposition: open
    title: "Impossible-state guard in the grouped easing/wiggle fan-out (necessity)"
  - id: IN-02
    severity: info
    disposition: open
    title: "`localeCompare` survives in two non-canonical ordering sites"
  - id: IN-03
    severity: info
    disposition: open
    title: "Narrowing payload type erases the new required `sourceEntries` field"
  - id: IN-04
    severity: info
    disposition: open
    title: "`addMotionChannel` still lacks a try/catch around the throwing reducer (carried forward)"
  - id: IN-05
    severity: info
    disposition: open
    title: "Dead exports `resolveRecordChannels` and `describeRailMotionOrphan` (carried forward)"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "The motion-lane curve ignores `railId`, so its wiggle seed differs from the applied transform"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "The grouped Position lane only edits `position-x`; `position-y` easing and wiggle are unreachable"
  - id: WR-05
    severity: warning
    disposition: fixed
    title: "Canonical rail-motion ordering diverges between TypeScript and Rust"
  - id: WR-06
    severity: warning
    disposition: fixed
    title: "The rail-set copy payload derives Key Rail segments with an empty group-owned set"
  - id: CR-02
    severity: critical
    disposition: open
    title: ""
  - id: CR-03
    severity: critical
    disposition: open
    title: ""
  - id: CR-04
    severity: critical
    disposition: open
    title: ""
open: 13
total: 19
recorded: 2026-11-08T18:42:00.000Z
---

# Phase 59: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-05 | critical | skipped | false positive: the approved 261108-pmc law is that deleting a real key a sole canonical lifecycle rail owns dissolves that cycle in the same atomic edit; pinned by physicsPaintRotoLoopGuards.test.ts "dissolves the owning lifecycle cycle when a real key inside it deletes" |
| WR-07 | warning | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| CR-01 | critical | fixed | closed by 797929fd9 + ab9093c79 + 9817da784: numbers now encode as IEEE-754 bits in both languages, serde_json uses float_roundtrip, and -0 is normalized at the encoder so it survives the JSON transport (not in the current review) |
| WR-01 | warning | open | - (not in the current review) |
| WR-02 | warning | open | - (not in the current review) |
| IN-01 | info | open | - (not in the current review) |
| IN-02 | info | open | - (not in the current review) |
| IN-03 | info | open | - (not in the current review) |
| IN-04 | info | open | - (not in the current review) |
| IN-05 | info | open | - (not in the current review) |
| WR-03 | warning | fixed | closed by 59-25 (lane curve seeded with the lane railId) (not in the current review) |
| WR-04 | warning | fixed | closed by 59-25 (grouped Position easing/wiggle fan-out) (not in the current review) |
| WR-05 | warning | fixed | closed by 59-24 (code-unit canonical ordering, mixed-case fixture) (not in the current review) |
| WR-06 | warning | fixed | closed by 59-22 (single rail-motion ownership collector; Option B loop sourceEntries) (not in the current review) |
| CR-02 | critical | open | - (not in the current review) |
| CR-03 | critical | open | - (not in the current review) |
| CR-04 | critical | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
