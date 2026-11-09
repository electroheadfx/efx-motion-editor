---
phase: 60
review: 60-REVIEW.md
titles: json
findings:
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "Per-layer zoom memory evicts by first-seen order, so actively used layers silently lose their remembered density"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "The 100% reset test exercises only the off-screen fallback, and neither test file pins the anchored value"
  - id: IN-05
    severity: info
    disposition: fixed
    title: "`getFrameCount` died with `fit()` but is still a required port member, still pinned by the wiring test"
  - id: IN-06
    severity: info
    disposition: fixed
    title: "Stale \"Fit\" documentation where the fourth pill control is now a 100% reset"
  - id: IN-07
    severity: info
    disposition: fixed
    title: "The interp dash is clipped at 0.25x, so the new comment's \"75% of the cell\" does not hold at the floor"
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "Current-frame marker keeps a fixed 16px width while its position scales"
  - id: CR-02
    severity: critical
    disposition: fixed
    title: "Anchored zoom-in scroll is clamped against the pre-render layout, losing the cursor anchor"
  - id: WR-01
    severity: warning
    disposition: open
    title: "Mandatory scroll-snap quantizes the anchored fractional scroll writes"
  - id: WR-02
    severity: warning
    disposition: open
    title: "The 6px content gutter is omitted from three pointer-to-frame projections"
  - id: IN-01
    severity: info
    disposition: open
    title: "Playhead centres on half the PITCH while the ruler centres on half the CELL"
  - id: IN-02
    severity: info
    disposition: open
    title: "Ruler tick row overhangs the lane when the frame count is not a multiple of the step"
  - id: IN-03
    severity: info
    disposition: open
    title: "Stale `ROTO_CELL_WIDTH_PX` reference in the audio controller port contract"
  - id: IN-04
    severity: info
    disposition: open
    title: "Dead exported helpers `frameToPx`, `pxToFrame`, `resolveTimelineViewportFrames`"
open: 6
total: 13
recorded: 2026-11-09T16:53:34.574Z
---

# Phase 60: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-03 | warning | fixed | e88a33204 (fixed during phase verification) |
| WR-04 | warning | fixed | e88a33204 (fixed during phase verification) |
| IN-05 | info | fixed | e88a33204 (fixed during phase verification) |
| IN-06 | info | fixed | e88a33204 (fixed during phase verification) |
| IN-07 | info | fixed | e88a33204 (fixed during phase verification) |
| CR-01 | critical | fixed | e37f7e49d (fixed during phase verification) (not in the current review) |
| CR-02 | critical | fixed | e37f7e49d (fixed during phase verification) (not in the current review) |
| WR-01 | warning | open | - (not in the current review) |
| WR-02 | warning | open | - (not in the current review) |
| IN-01 | info | open | - (not in the current review) |
| IN-02 | info | open | - (not in the current review) |
| IN-03 | info | open | - (not in the current review) |
| IN-04 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
